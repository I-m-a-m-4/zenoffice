/**
 * Generates the raster assets the campaign email needs, into `public/email/`.
 *
 * Run once, commit the output, deploy:
 *
 *     node scripts/generate-email-assets.mjs
 *
 * ## Why PNGs at all
 *
 * Gmail strips `<svg>` and blocks `data:` URIs, so the only icon that renders for
 * most of the list is a hosted raster one. Inline SVG would simply be missing.
 *
 * ## Why the geometry is fetched rather than written here
 *
 * Hand-transcribed path data is how a logo ends up subtly wrong, and a mangled
 * brand mark in outgoing mail is worse than no mark. The official Simple Icons
 * geometry is pulled at generation time from a **pinned tag** so the output is
 * reproducible, and every response is checked to actually be an SVG before it is
 * used. If a fetch fails the script exits non-zero rather than writing a broken
 * file — a silent placeholder would ship to customers.
 *
 * Simple Icons' icon data is CC0. The marks themselves remain trademarks of their
 * owners; using them to link to Zeneva's own profiles is ordinary nominative use.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Pinned so a re-run produces the same bytes. Bump deliberately. */
const SIMPLE_ICONS_TAG = '13.0.0';
const ICON_BASE = `https://raw.githubusercontent.com/simple-icons/simple-icons/${SIMPLE_ICONS_TAG}/icons`;

const OUT_DIR = path.join(process.cwd(), 'public', 'email');

/** Slug in simple-icons -> the filename the template asks for. */
const ICONS = [
  { slug: 'instagram', key: 'instagram' },
  { slug: 'x', key: 'x' },
  { slug: 'tiktok', key: 'tiktok' },
  { slug: 'youtube', key: 'youtube' },
  { slug: 'whatsapp', key: 'whatsapp' },
];

/** Matches the template's BRAND.orange. Keep the two in step. */
const ORANGE = '#ea580c';
/** Rendered at 2x the 30px display size, for retina inboxes. */
const SIZE = 60;
/** Glyph inset inside the circle. */
const GLYPH = 32;

async function fetchIconPath(slug) {
  const url = `${ICON_BASE}/${slug}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status} from ${url}`);

  const svg = await res.text();
  if (!svg.includes('<svg') || !svg.includes('viewBox')) {
    throw new Error(`${slug}: response was not an SVG (got ${svg.slice(0, 60)}…)`);
  }

  const match = /\sd="([^"]+)"/.exec(svg);
  if (!match) throw new Error(`${slug}: no path data found in the SVG`);
  return match[1];
}

/**
 * Orange disc with the glyph knocked out in white.
 *
 * The disc is part of the PNG rather than a CSS `border-radius` on the `<img>`,
 * because Outlook's engine ignores border-radius and would render a hard square.
 */
function composeSvg(pathData) {
  const offset = (SIZE - GLYPH) / 2;
  const scale = GLYPH / 24; // simple-icons uses a 24x24 viewBox
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="${ORANGE}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${pathData}" fill="#ffffff"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const failures = [];
  for (const { slug, key } of ICONS) {
    try {
      const pathData = await fetchIconPath(slug);
      const png = await sharp(Buffer.from(composeSvg(pathData)))
        .png({ compressionLevel: 9 })
        .toBuffer();
      const out = path.join(OUT_DIR, `social-${key}.png`);
      await writeFile(out, png);
      console.log(`wrote ${path.relative(process.cwd(), out)} (${png.length} bytes)`);
    } catch (err) {
      failures.push(`${slug}: ${err.message}`);
    }
  }

  if (failures.length) {
    console.error('\nFailed:\n  ' + failures.join('\n  '));
    console.error(
      '\nNo placeholder was written. The email footer will show alt text for the '
      + 'missing icons until this succeeds, which is the safe failure.',
    );
    process.exit(1);
  }

  console.log(`\nDone. Commit public/email/ and redeploy zeneva.space — the template `
    + `loads these by absolute URL, so they must be live before the next campaign.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
