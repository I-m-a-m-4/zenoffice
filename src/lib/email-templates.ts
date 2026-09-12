/**
 * Zeneva campaign email design system.
 *
 * One renderer plus one draft per behavioural segment. Kept pure (no Firestore,
 * no React, no `window`) so the admin console can preview the exact bytes that
 * `sendEmail` will hand to Resend — a preview rendered by different code is a
 * preview that lies.
 *
 * ## Why the markup looks like 2004
 *
 * Mail clients are not browsers. Everything here is deliberate:
 *
 * - **Tables, not flex or grid.** Outlook renders through Word's HTML engine,
 *   which has no support for either.
 * - **Inline styles only.** Gmail strips `<style>` blocks in several contexts,
 *   including forwarded mail, so anything that matters has to sit on the element.
 * - **No `<img>` for the logo.** `AppConfig.logoUrl` is a base64 SVG, and Gmail
 *   blocks both `data:` URIs and SVG outright — the brand would simply be a
 *   broken-image icon. The wordmark is therefore live text and the brand bar is
 *   a background colour, which is also why they survive image-blocking, the
 *   default state for a first-time sender.
 * - **`color-scheme: light` + explicit `bgcolor`.** Left to itself, iOS Mail and
 *   Outlook dark mode invert light backgrounds and drag Zeneva's orange toward
 *   brown. Declaring the scheme opts out of the automatic inversion, and the
 *   attribute form of the background is what Outlook actually honours.
 * - **A bulletproof button** — a table cell with a background colour, not a
 *   styled `<a>` — because Outlook ignores padding on inline elements and would
 *   otherwise render a bare blue link.
 *
 * ## Tokens
 *
 * Draft copy is written with `{{token}}` placeholders and filled per recipient at
 * send time, so one campaign personalises every message from that recipient's own
 * behaviour. `%%UNSUBSCRIBE_URL%%` is different: it is filled by `sendEmail`,
 * which is the only place the tracking id exists. See `src/lib/server/resend.ts`.
 */

import {
  FAMILY_META,
  humanUsage,
  type BehaviorProfile,
  type BehaviorSegment,
} from '@/lib/behavior-segments';

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://zeneva.space').replace(/\/+$/, '');

/** The signature every campaign goes out under. */
export const CAMPAIGN_FROM = 'Imam Shaffy <hello@zeneva.space>';
export const CAMPAIGN_REPLY_TO = 'hello@zeneva.space';

/**
 * Substituted by `sendEmail` once the tracking id exists.
 *
 * Deliberately not `{{...}}`: recipient tokens are filled on the client from data
 * the client has, and this one cannot be. Two different syntaxes make it
 * impossible to confuse the two passes.
 */
export const UNSUBSCRIBE_TOKEN = '%%UNSUBSCRIBE_URL%%';

/* ------------------------------------------------------------------ *
 * Escaping and the small markdown subset
 * ------------------------------------------------------------------ */

/**
 * HTML-escape a value.
 *
 * Names and business names come from self-registered `users` and
 * `businessInstances` documents — fields an account sets for itself. Unescaped, a
 * name like `<img src=x onerror=…>` goes out as live markup *and* is archived in
 * `follow_up_logs`, where the admin audit dialog renders it back on the
 * super-admin origin. Escaping at the source keeps the stored record clean too,
 * not just the outgoing mail.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape a URL for an `href`, refusing anything that is not http(s) or mailto. */
function safeUrl(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) return escapeHtml(trimmed);
  if (trimmed.startsWith('/')) return escapeHtml(`${BASE_URL}${trimmed}`);
  // `javascript:` and friends land here and become a harmless link home.
  return escapeHtml(BASE_URL);
}

/**
 * Render operator-authored plain text as email-safe HTML.
 *
 * The compose screen edits prose, not markup — handing an operator raw HTML is
 * how malformed campaigns get sent. A deliberately tiny markdown subset covers
 * what the copy actually needs: `**bold**` and `[label](url)`. Escaping runs
 * *first*, so the subset is applied to already-inert text and cannot be used to
 * smuggle a tag through.
 */
function renderProse(text: string, linkColor = '#c2410c'): string {
  const paragraphs = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  return paragraphs
    .map(paragraph => {
      const inline = escapeHtml(paragraph)
        .replace(/\n/g, '<br />')
        .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#18181b;font-weight:700;">$1</strong>')
        // The label is already escaped; the url is re-checked by safeUrl. Both
        // halves are matched narrowly so a stray bracket cannot open a tag.
        .replace(
          /\[([^\]]+)\]\(([^)\s]+)\)/g,
          (_m, label: string, url: string) =>
            `<a href="${safeUrl(url)}" style="color:${linkColor};font-weight:600;text-decoration:underline;">${label}</a>`,
        );
      return `<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#3f3f46;">${inline}</p>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ *
 * Merge tokens
 * ------------------------------------------------------------------ */

export type MergeTokens = Record<string, string>;

/**
 * Every token a draft may reference, resolved for one recipient.
 *
 * Values are raw here and escaped at render time — escaping twice would show
 * `&amp;amp;` in a business name containing an ampersand.
 *
 * Each token has a fallback that still reads as a sentence, because the operator
 * can put any token in any draft. `{{topFeature}}` in a template shown to a user
 * with no feature history must degrade to something sendable, never to a visible
 * `{{topFeature}}`.
 */
export function mergeTokensFor(profile: BehaviorProfile): MergeTokens {
  const top = profile.topFeature ? FAMILY_META[profile.topFeature] : null;
  const unused = profile.unusedHighValue[0] ? FAMILY_META[profile.unusedHighValue[0]] : null;

  return {
    firstName: profile.firstName,
    businessName: profile.businessName,
    plan: profile.plan === 'starter' ? 'free' : profile.plan,
    usage: humanUsage(profile.usageSeconds),
    pageViews: profile.pageViews.toLocaleString('en-US'),
    topFeature: top?.label ?? 'Zeneva',
    topFeatureWhere: top?.inSentence ?? 'in Zeneva',
    topFeatureShare: profile.topFeatureShare
      ? `${Math.round(profile.topFeatureShare * 100)}%`
      : 'most',
    unusedFeature: unused?.label ?? 'Zen AI',
    unusedPitch: unused?.pitch ?? FAMILY_META.ai.pitch,
    unusedHref: unused?.href ?? FAMILY_META.ai.href,
    daysSince: profile.daysSinceSeen === null ? 'a while' : String(profile.daysSinceSeen),
    lastPage: profile.lastPage ?? '/dashboard',
    featureCount: String(profile.familiesTouched),
  };
}

/**
 * Replace every `{{token}}` in `text`.
 *
 * An unrecognised token collapses to an empty string rather than being left in
 * place: a typo'd `{{firtName}}` should read as a slightly clumsy sentence, not
 * ship braces to a paying customer.
 */
export function fillTokens(text: string, tokens: MergeTokens): string {
  return String(text ?? '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) =>
    tokens[key] ?? '',
  );
}

/** Tokens still unresolved in a draft — surfaced in the compose screen. */
export function unknownTokensIn(text: string, tokens: MergeTokens): string[] {
  const found = new Set<string>();
  for (const match of String(text ?? '').matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
    if (!(match[1] in tokens)) found.add(match[1]);
  }
  return [...found];
}

/* ------------------------------------------------------------------ *
 * The draft
 * ------------------------------------------------------------------ */

export type EmailDraft = {
  subject: string;
  /** Inbox preview line. Invisible in the body; wasted if left empty. */
  preheader: string;
  /** Small uppercase kicker above the headline. Empty hides it. */
  eyebrow: string;
  heading: string;
  /** Optional 3D claymorphic hero illustration (e.g. '/emails/3d-gift.jpg'). Empty hides it. */
  heroImage?: string;
  /** Prose, blank-line separated. Supports `**bold**` and `[label](url)`. */
  body: string;
  /**
   * The proof-you-looked panel: their real numbers, in a highlighted box.
   * Empty hides it entirely.
   */
  callout: string;
  ctaLabel: string;
  /** Absolute, or app-relative starting with `/`. */
  ctaPath: string;
  signOffName: string;
  signOffTitle: string;
};

export const AVAILABLE_3D_ASSETS = [
  {
    key: 'gift',
    label: 'Reward / Gift',
    path: '/emails/3d-gift.jpg',
    blurb: 'Ceramic gift box with glowing amber crystal (perks, upgrades, referrals)',
  },
  {
    key: 'milestone',
    label: 'Growth Milestone',
    path: '/emails/3d-milestone.jpg',
    blurb: 'Terracotta ascending steps with amber diamond (sales streaks & growth)',
  },
  {
    key: 'folder',
    label: 'First Product / File',
    path: '/emails/3d-folder.jpg',
    blurb: 'Glossy orange folder with floating document (onboarding & catalog setup)',
  },
  {
    key: 'verified',
    label: 'Verified / Restock',
    path: '/emails/3d-verified.jpg',
    blurb: 'Ceramic desktop tray with checkmark badge (inventory updates & reports)',
  },
] as const;

/* ------------------------------------------------------------------ *
 * Renderer
 * ------------------------------------------------------------------ */

/**
 * Palette — neutral-dominant by design.
 *
 * The first version of this template was mostly orange: a full-width gradient
 * bar, a cream footer, orange headings. At that saturation the brand stops
 * reading as confident and starts reading as a promotion, and a promotion is the
 * thing an inbox filters.
 *
 * So roughly 80% of the surface is now warm neutral (the stone family, which sits
 * better against Zeneva's orange than a blue-grey would) and orange is reserved
 * for four things: the CTA button, the wordmark, the rule under the header, and
 * the accent edge of the callout. Everything else is ink on off-white.
 */
const BRAND = {
  orange: '#ea580c',
  orangeDeep: '#c2410c',
  orangeSoft: '#fff7ed',
  ink: '#1c1917',
  body: '#44403c',
  muted: '#78716c',
  faint: '#a8a29e',
  page: '#f5f5f4',
  card: '#ffffff',
  panel: '#fafaf9',
  line: '#e7e5e4',
};

/**
 * Type stacks.
 *
 * Bricolage Grotesque is the face the Zeneva logo is set in and DM Sans is the
 * app's body font, so the mail matches the product rather than approximating it.
 *
 * **These will not render everywhere, and that is not a bug to chase.** Gmail —
 * web and mobile — strips `<link>` and `@import` webfonts outright, so Gmail
 * readers get the system fallback. Apple Mail, iOS Mail and Outlook.com do load
 * them. That is why the fallback chain matters as much as the webfont: the mail
 * has to look deliberate in the fallback, which is the case most recipients see.
 */
const FONT_DISPLAY =
  "'Bricolage Grotesque','DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const FONT_BODY =
  "'DM Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2'
  + '?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800'
  + '&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700'
  + '&display=swap';

/** Where the generated raster assets live. See scripts/generate-email-assets.mjs. */
const ASSETS = `${BASE_URL}/email`;

/**
 * Footer social row.
 *
 * Handles copied from the live marketing footer (`marketing-footer.tsx`) so the
 * two cannot drift. Rendered as **PNG images**, not inline SVG: Gmail strips SVG
 * entirely, so an `<svg>` icon set would simply be missing for most of the list.
 */
export const SOCIAL_LINKS = [
  { key: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/zeneva_pos/' },
  { key: 'x', label: 'X', href: 'https://x.com/zeneva_retail' },
  { key: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@zeneva_retail' },
  { key: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@ZenevaPos' },
  { key: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/2349064233805' },
];

/**
 * Render a draft to a complete, standalone HTML document.
 *
 * `unsubscribeUrl` defaults to the `%%UNSUBSCRIBE_URL%%` token so the normal send
 * path leaves it for `sendEmail` to fill. The preview passes a real (or dummy)
 * URL, which is also what makes the preview show a clickable footer rather than
 * a literal token.
 */
export function renderCampaignEmail(
  draft: EmailDraft,
  tokens: MergeTokens,
  options: { unsubscribeUrl?: string; isLocalPreview?: boolean } = {},
): string {
  const unsubscribeUrl = options.unsubscribeUrl ?? UNSUBSCRIBE_TOKEN;

  const fill = (value: string) => fillTokens(value, tokens);
  const heading = escapeHtml(fill(draft.heading));
  const eyebrow = escapeHtml(fill(draft.eyebrow));
  const preheader = escapeHtml(fill(draft.preheader));
  const ctaLabel = escapeHtml(fill(draft.ctaLabel));
  const ctaHref = safeUrl(fill(draft.ctaPath));
  const bodyHtml = renderProse(fill(draft.body), BRAND.orangeDeep);
  const calloutText = fill(draft.callout).trim();
  const calloutHtml = calloutText ? renderProse(calloutText, BRAND.orangeDeep) : '';
  const signName = escapeHtml(fill(draft.signOffName));
  const signTitle = escapeHtml(fill(draft.signOffTitle));
  const year = new Date().getFullYear();

  // Resolve 3D Hero image URL (local relative for sandboxed iframe preview, absolute URL for external email clients)
  const rawHero = draft.heroImage ? fill(draft.heroImage).trim() : '';
  let heroImgUrl = '';
  if (rawHero) {
    if (rawHero.startsWith('http://') || rawHero.startsWith('https://')) {
      heroImgUrl = rawHero;
    } else if (options.isLocalPreview) {
      heroImgUrl = rawHero.startsWith('/') ? rawHero : `/${rawHero}`;
    } else {
      heroImgUrl = `${BASE_URL}${rawHero.startsWith('/') ? '' : '/'}${rawHero}`;
    }
  }

  const socialRow = SOCIAL_LINKS.map(
    s => `<td style="padding:0 5px;">
                <a href="${s.href}" style="text-decoration:none;">
                  <img src="${ASSETS}/social-${s.key}.png" width="30" height="30" alt="${s.label}"
                       style="display:block;border:0;outline:none;text-decoration:none;border-radius:15px;" />
                </a>
              </td>`,
  ).join('');

  return `<!doctype html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<!-- Opts out of automatic dark-mode inversion; without these the orange goes brown. -->
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${heading}</title>
<!--
  Webfonts, three ways, because no single mechanism covers the field:
  the <link> is honoured by Apple Mail and iOS Mail, the @import by Outlook.com,
  and Gmail honours neither and falls back — which is why every element below
  also carries a full inline stack rather than relying on inheritance.
  The mso conditional keeps Word's engine on a real sans instead of Times.
-->
<!--[if !mso]><!-->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${GOOGLE_FONTS_HREF}" rel="stylesheet" />
<!--<![endif]-->
<style type="text/css">
  @import url('${GOOGLE_FONTS_HREF}');
  body, table, td, p, h1, a { -webkit-font-smoothing:antialiased; }
  a { text-decoration:none; }
  @media only screen and (max-width:620px) {
    .z-pad { padding-left:22px !important; padding-right:22px !important; }
    .z-h1 { font-size:24px !important; }
  }
</style>
<!--[if mso]>
<style type="text/css">
  body, table, td, p, h1, a { font-family:'Segoe UI',Arial,sans-serif !important; }
</style>
<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.page};font-family:${FONT_BODY};">

<!-- Preheader: the line the inbox shows next to the subject. -->
<div style="display:none;font-size:1px;color:${BRAND.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${preheader}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.page}" style="background-color:${BRAND.page};margin:0;padding:0;">
<tr>
<td align="center" style="padding:36px 12px;">

  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background-color:${BRAND.card};border:1px solid ${BRAND.line};border-radius:24px;overflow:hidden;font-family:${FONT_BODY};box-shadow:0 4px 24px rgba(0,0,0,0.03);">

    <!-- Header / Brand Mark -->
    <tr>
      <td class="z-pad" align="center" style="padding:32px 32px 14px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center">
              <img src="https://i.ibb.co/tMp65gRP/5c1014423d18.png" alt="Zeneva" width="68" height="68"
                   style="width:68px;height:68px;display:block;border:0;outline:none;text-decoration:none;object-fit:contain;" />
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <!-- Headline with Period -->
    <tr>
      <td class="z-pad" align="center" style="padding:0 32px 4px;text-align:center;">
        ${
          eyebrow
            ? `<p style="margin:0 0 8px;font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${BRAND.orangeDeep};">${eyebrow}</p>`
            : ''
        }
        <h1 class="z-h1" style="margin:0;font-family:${FONT_DISPLAY};font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-0.7px;color:${BRAND.ink};">
          ${heading}
        </h1>
      </td>
    </tr>

    <!-- 3D Hero Illustration Render -->
    ${
      heroImgUrl
        ? `<tr>
      <td align="center" style="padding:22px 32px 16px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center">
              <img src="${heroImgUrl}" alt="${heading}" width="260" height="260"
                   style="display:block;width:100%;max-width:260px;height:auto;border-radius:22px;margin:0 auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
        </table>
      </td>
    </tr>`
        : ''
    }

    <!-- Body -->
    <tr>
      <td class="z-pad" align="center" style="padding:10px 32px 0;font-family:${FONT_BODY};text-align:center;">
        <div style="max-width:440px;margin:0 auto;text-align:left;">
          ${bodyHtml}
        </div>
      </td>
    </tr>

    ${
      calloutHtml
        ? `<!-- The proof-you-looked panel -->
    <tr>
      <td class="z-pad" align="center" style="padding:6px 32px 4px;text-align:center;">
        <div style="max-width:440px;margin:0 auto;text-align:left;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${BRAND.panel}" style="background-color:${BRAND.panel};border:1px solid ${BRAND.line};border-left:3px solid ${BRAND.orange};border-radius:0 12px 12px 0;">
            <tr>
              <td style="padding:14px 16px 0;font-family:${FONT_BODY};">
                ${calloutHtml}
              </td>
            </tr>
          </table>
        </div>
      </td>
    </tr>`
        : ''
    }

    <!-- Bulletproof Orange Pill CTA Button -->
    <tr>
      <td class="z-pad" align="center" style="padding:26px 32px 18px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
          <tr>
            <td align="center" bgcolor="${BRAND.orange}" style="background-color:${BRAND.orange};border-radius:9999px;">
              <a href="${ctaHref}" style="display:inline-block;padding:14px 36px;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9999px;letter-spacing:-0.2px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Sign-off -->
    <tr>
      <td class="z-pad" align="center" style="padding:4px 32px 28px;text-align:center;">
        <p style="margin:0 0 2px;font-family:${FONT_BODY};font-size:14px;color:${BRAND.body};">Thanks for reading,</p>
        <p style="margin:0;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${BRAND.ink};">${signName}</p>
        <p style="margin:2px 0 0;font-family:${FONT_BODY};font-size:12px;color:${BRAND.muted};">${signTitle}</p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td bgcolor="${BRAND.panel}" style="background-color:${BRAND.panel};border-top:1px solid ${BRAND.line};padding:22px 32px 24px;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 14px;">
          <tr>${socialRow}</tr>
        </table>
        <p style="margin:0 0 6px;font-family:${FONT_BODY};font-size:12px;line-height:1.5;color:${BRAND.muted};">
          <a href="${BASE_URL}" style="color:${BRAND.orangeDeep};font-weight:600;text-decoration:none;">zeneva.space</a>
          &nbsp;&middot;&nbsp;
          <a href="${unsubscribeUrl}" style="color:${BRAND.muted};text-decoration:underline;">Unsubscribe</a>
        </p>
        <p style="margin:0;font-family:${FONT_BODY};font-size:11px;color:${BRAND.faint};">
          &copy; ${year} Zeneva POS &amp; Inventory. All rights reserved.
        </p>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>
</body>
</html>`;
}

/* ------------------------------------------------------------------ *
 * One draft per behavioural segment
 * ------------------------------------------------------------------ */

/**
 * Starting copy for each segment.
 *
 * Written to be *editable* — the operator picks a segment, reads the draft,
 * changes what they want and sends. Each one leans on the callout to show the
 * recipient their own numbers, because that is the whole difference between this
 * and a mail-merge blast: it is visibly not a template.
 *
 * The tone is one founder writing to one shop owner. No exclamation marks in the
 * subject lines, no "Dear valued customer", and every email asks for exactly one
 * thing.
 */
export const CAMPAIGN_DRAFTS: Record<BehaviorSegment, EmailDraft> = {
  never_activated: {
    subject: 'Start with your first product',
    preheader: 'It takes about two minutes. Here is how to get started.',
    eyebrow: 'Quick setup',
    heading: 'Start with one product.',
    heroImage: '/emails/3d-folder.jpg',
    body: `I am Imam, the founder of Zeneva. I noticed you created an account for **{{businessName}}** but have not had a chance to get into it yet.

Getting your products into a new system can feel like a chore, but in Zeneva it takes seconds: snap a barcode, add an item name, and you are ready to sell.

If you have a spreadsheet, a notebook, or a price list, send it my way via email or WhatsApp and I will load it into your store myself.

If now is not the right time, that is completely fine. Reply anytime and I will help you out.`,
    callout: '',
    ctaLabel: 'Add your first product',
    ctaPath: '/inventory',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  onboarding_stalled: {
    subject: 'Your store is ready for its first sale',
    preheader: 'The point of sale is two taps away. Sell online or offline.',
    eyebrow: 'One step left',
    heading: '{{firstName}}, you are one step away.',
    heroImage: '/emails/3d-folder.jpg',
    body: `You have your catalog in Zeneva for **{{businessName}}**, which is awesome. The only missing piece is ringing up your very first sale.

It is genuinely two taps: pick an item, choose cash or transfer, and print or WhatsApp a receipt to your customer. It even works 100% offline when the internet drops.

If anything is blocking you — a barcode scanner, receipt printer, or custom pricing — hit reply and let me know.`,
    callout:
      'What I can see on **{{businessName}}**: {{pageViews}} page views and {{usage}} in the app so far, mostly {{topFeatureWhere}} — but nothing through the point of sale yet.',
    ctaLabel: 'Ring up a sale',
    ctaPath: '/sales/pos',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  invested_then_left: {
    subject: 'Look how far {{businessName}} has come',
    preheader: 'You did the hard part already. Everything is right where you left it.',
    eyebrow: 'We saved your spot',
    heading: 'Look how far you’ve come.',
    heroImage: '/emails/3d-milestone.jpg',
    body: `You did the part almost nobody finishes: you set up **{{businessName}}** in Zeneva, imported your inventory, and spent real time in it.

Everything is preserved and updated with our newest offline-first engine, stock backdating, and instant thermal printing.

If a bug or missing feature slowed you down, tell me. I read and reply to every message personally.`,
    callout:
      'Why I am writing to you: {{usage}} in the app across {{pageViews}} page views, mostly {{topFeatureWhere}}. That is real dedication to your business.',
    ctaLabel: 'Pick up where you left off',
    ctaPath: '/dashboard',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  champion: {
    subject: 'A milestone reward for our top merchant',
    preheader: 'No pitch. You are one of our highest-volume stores.',
    eyebrow: 'VIP Merchant',
    heading: 'A thank-you, just for you.',
    heroImage: '/emails/3d-gift.jpg',
    body: `You are one of the rare merchants running their daily business operations entirely on Zeneva.

To say thank you, we have unlocked extra bonus perks and direct VIP engineering support for **{{businessName}}**.

What is one thing we could build next that would save you 30 minutes every day? Reply and let me know.`,
    callout:
      'Your business milestone: {{usage}} active time across {{featureCount}} operational areas, {{pageViews}} page views.',
    ctaLabel: 'View your merchant perks',
    ctaPath: '/dashboard',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  feature_focused: {
    subject: 'Inventory updated with new superpowers',
    preheader: 'New analytics and valuation reports are live in your account.',
    eyebrow: 'New feature',
    heading: 'Inventory updated.',
    heroImage: '/emails/3d-verified.jpg',
    body: `You spend most of your time in {{topFeature}} — and we just shipped a major upgrade tailored to high-volume store operations.

Now you can track real-time inventory valuation, backdate purchase restocks, and review deep customer analytics in 1 click.

It is already active in your account — no setup or extra fees required.`,
    callout:
      'Your store activity: {{topFeatureShare}} of your activity in Zeneva is {{topFeatureWhere}}, out of {{pageViews}} total views.',
    ctaLabel: 'Explore new analytics',
    ctaPath: '/reports',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  casual_active: {
    subject: 'Three shortcuts for {{businessName}}',
    preheader: 'Short list. All already unlocked in your Zeneva account.',
    eyebrow: 'Power tips',
    heading: 'Look how far you’ve come.',
    heroImage: '/emails/3d-milestone.jpg',
    body: `You have been checking into Zeneva regularly. Here are three quick power features that store owners love most:

**Instant WhatsApp Invoicing:** Send beautiful PDF receipts directly to your customer's WhatsApp in 1 tap.

**Offline Point of Sale:** Keep ringing up sales even when the shop Wi-Fi or mobile network drops.

**Low-Stock Alerts:** Get notified before popular items run out of stock.`,
    callout: 'You have put {{usage}} into Zeneva so far across {{pageViews}} page views.',
    ctaLabel: 'Open Zeneva dashboard',
    ctaPath: '/dashboard',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  slipping: {
    subject: 'A thank-you perk for {{businessName}}',
    preheader: 'We credited bonus time to your account. Come take a look.',
    eyebrow: 'Welcome back gift',
    heading: 'A thank-you, just for you.',
    heroImage: '/emails/3d-gift.jpg',
    body: `We noticed you have not visited Zeneva in {{daysSince}} days. Running a store is busy, and we want to make sure you have everything you need to succeed.

We have added a bonus reward to your account to help you get back on track. Plus, all your items, sales history, and customer records are safely waiting for you.

Come see what is new in version 3.3.2!`,
    callout:
      'Your store history: {{usage}} logged in Zeneva across {{pageViews}} page views.',
    ctaLabel: 'Claim your perk',
    ctaPath: '/dashboard',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },

  dormant: {
    subject: 'Should I keep your Zeneva account open, {{firstName}}?',
    preheader: 'We saved your products and reports. Plus a gift for your return.',
    eyebrow: 'A gift for you',
    heading: 'A thank-you, just for you.',
    heroImage: '/emails/3d-gift.jpg',
    body: `It has been a while since **{{businessName}}** checked into Zeneva, so I wanted to reach out personally.

Zeneva now features full desktop offline mode, backdating inventory restocks, barcode label printing, and smart sales intelligence.

Your account is still active and ready whenever you are. Reply to this email if you need anything at all.`,
    callout: '',
    ctaLabel: 'Reopen your store',
    ctaPath: '/dashboard',
    signOffName: 'Imam Shaffy',
    signOffTitle: 'Founder, Zeneva',
  },
};

/** Fresh copy of a segment's draft, so the compose screen can edit it freely. */
export function draftForSegment(segment: BehaviorSegment): EmailDraft {
  return { ...CAMPAIGN_DRAFTS[segment] };
}

/**
 * Render a draft for one recipient in a single call — what both the preview and
 * the send path use, so the two cannot drift.
 */
export function renderForProfile(
  draft: EmailDraft,
  profile: BehaviorProfile,
  options: { unsubscribeUrl?: string; isLocalPreview?: boolean } = {},
): { subject: string; html: string } {
  const tokens = mergeTokensFor(profile);
  return {
    subject: fillTokens(draft.subject, tokens),
    html: renderCampaignEmail(draft, tokens, options),
  };
}
