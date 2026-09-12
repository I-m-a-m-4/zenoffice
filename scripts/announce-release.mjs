#!/usr/bin/env node
/**
 * Publishes the in-app update banner.
 *
 * Writes Firestore `system_config/app_release`, which UpdatePrompt watches.
 * Store-distributed installs (Google Play, Microsoft Store) running an older
 * version than `latestVersion` will show a banner linking to their store.
 *
 * Usage:
 *   node scripts/announce-release.mjs 3.1.7
 *   node scripts/announce-release.mjs 3.1.7 --notes "Faster receipts"
 *   node scripts/announce-release.mjs 3.1.7 --mandatory
 *   node scripts/announce-release.mjs --show      # read current value
 *   node scripts/announce-release.mjs --clear     # remove the banner
 *
 * Credentials come from .env (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY), the same ones src/firebase/admin.ts uses.
 *
 * IMPORTANT: only announce a version that is actually live in the stores.
 * Announcing ahead of the rollout sends users to a listing that still offers
 * the build they already have.
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

const DOC_PATH = ['system_config', 'app_release'];

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

// ---- args -----------------------------------------------------------------

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const valueOf = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
};

const showOnly = flag('show');
const clear = flag('clear');
const mandatory = flag('mandatory');
const notes = valueOf('notes') ?? '';
const version = argv.find((a) => !a.startsWith('--') && a !== notes);

if (!showOnly && !clear && !version) {
  fail('Usage: node scripts/announce-release.mjs <version> [--notes "..."] [--mandatory]');
}

if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
  fail(`"${version}" is not a valid version. Expected e.g. 3.1.7`);
}

// ---- guard: never announce a version older than what is shipping ----------

const shipping = JSON.parse(
  readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
).version;

if (version) {
  const parse = (v) => v.split('.').map(Number);
  const [a, b, c] = parse(version);
  const [x, y, z] = parse(shipping);
  const newer = a > x || (a === x && (b > y || (b === y && c > z)));
  if (!newer) {
    fail(
      `Refusing to announce ${version}: package.json is on ${shipping}.\n` +
        `  Announce a version NEWER than the one currently building, and only\n` +
        `  once it is actually live in the stores.`
    );
  }
}

// ---- firebase -------------------------------------------------------------

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  fail(
    'Missing admin credentials in .env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
  );
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey: privateKey.includes('---')
      ? privateKey.replace(/\\n/g, '\n')
      : privateKey,
  }),
});

const ref = admin.firestore().collection(DOC_PATH[0]).doc(DOC_PATH[1]);

try {
  if (showOnly) {
    const snap = await ref.get();
    console.log(`\n  project: ${projectId}`);
    console.log(`  shipping (package.json): ${shipping}`);
    console.log(
      snap.exists
        ? `  ${DOC_PATH.join('/')}: ${JSON.stringify(snap.data(), null, 2)}`
        : `  ${DOC_PATH.join('/')}: does not exist - no banner is showing`
    );
    console.log();
  } else if (clear) {
    await ref.delete();
    console.log(`\n  Deleted ${DOC_PATH.join('/')} - the update banner is now hidden.\n`);
  } else {
    const payload = {
      latestVersion: version,
      notes,
      mandatory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(payload, { merge: true });
    console.log(`\n  Announced v${version} to store-distributed installs.`);
    if (notes) console.log(`  Notes: ${notes}`);
    if (mandatory) console.log('  Mandatory: banner cannot be dismissed.');
    console.log(`\n  Undo with: node scripts/announce-release.mjs --clear\n`);
  }
  process.exit(0);
} catch (err) {
  fail(`Firestore write failed: ${err.message}`);
}
