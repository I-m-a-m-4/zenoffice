/*
 * Diagnostic for the studio's 401 and for the cinematic changes. Throwaway —
 * delete when done.
 *
 * Prints presence, never values. No environment variable is echoed: each is
 * reported only as `present` or `MISSING`, and the one place an error message is
 * printed is length-capped and PEM-stripped, because a malformed-key error is the
 * one error that could plausibly quote key material back at you.
 *
 * Two questions, one run, because the shell keeps flaking and a single call that
 * answers both is worth more than two that might not land:
 *
 *   1. Would `adminAuth` be null? That is what makes every /api/admin route
 *      answer 401, which is what the studio is showing.
 *   2. Do the recorder modules I changed even parse and import?
 */

const path = require('node:path');

/** Strip anything that looks like key material out of a message before printing. */
function safe(msg) {
  return String(msg ?? 'unknown')
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, '[pem redacted]')
    .replace(/[A-Za-z0-9+/=]{40,}/g, '[redacted]')
    .slice(0, 300);
}

async function checkAdminCreds() {
  console.log('--- 1. Firebase Admin credentials ---');
  try {
    // Next loads .env.local; plain node does not. This is Next's own loader, so
    // it resolves exactly the files the dev server would.
    const { loadEnvConfig } = require('@next/env');
    loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
  } catch (e) {
    console.log(`  (could not load .env via @next/env: ${safe(e.message)})`);
  }

  const names = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  const missing = names.filter((n) => !process.env[n]);
  for (const n of names) console.log(`  ${n}: ${process.env[n] ? 'present' : 'MISSING'}`);

  if (missing.length) {
    console.log(`  Failed: ${missing.length} missing -> src/firebase/admin.ts exports adminAuth = null`);
    console.log('  => every /api/admin/* route answers 401, including the POST that');
    console.log('     starts a recording. The recorder never spawns.');
    return false;
  }

  try {
    const admin = require('firebase-admin');
    const pk = process.env.FIREBASE_PRIVATE_KEY;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Same normalisation as src/firebase/admin.ts, so this tests what runs.
          privateKey: pk.includes('---') ? pk.replace(/\\n/g, '\n') : pk,
        }),
      });
    }
    // Proves the cert is accepted by Google, not merely well-formed. The result
    // is user data, so it is counted and discarded, never printed.
    const res = await admin.auth().listUsers(1);
    console.log(`  Success: credentials initialise and authenticate (${res.users.length ? 'reachable' : 'reachable, no users'})`);
    console.log('  => the 401 is NOT missing credentials. Most likely an expired');
    console.log('     ID token (they last 1h — hard-refresh the studio tab), or');
    console.log('     checkRevoked:true in admin-guard.ts:42 failing to reach Google.');
    return true;
  } catch (e) {
    console.log(`  Failed: ${safe(e.message)}`);
    return false;
  }
}

async function checkRecorderModules() {
  console.log('--- 2. Recorder modules (my changes) ---');
  const mods = [
    'scripts/record/page.mjs',
    'scripts/record/record.mjs',
    'scripts/record/capture.mjs',
  ];
  let ok = true;
  for (const m of mods) {
    try {
      await import(`file://${path.resolve(m).replace(/\\/g, '/')}`);
      console.log(`  Success: ${m}`);
    } catch (e) {
      ok = false;
      console.log(`  Failed: ${m} -> ${safe(e.message)}`);
    }
  }

  // scene.js is browser code and is never imported by node — it is read as a
  // string and injected. So it is syntax-checked as a script instead.
  try {
    const { readFileSync } = require('node:fs');
    const src = readFileSync('scripts/record/scene.js', 'utf8');
    new (require('node:vm').Script)(src);
    console.log('  Success: scripts/record/scene.js (parses)');
  } catch (e) {
    ok = false;
    console.log(`  Failed: scripts/record/scene.js -> ${safe(e.message)}`);
  }
  return ok;
}

(async () => {
  const creds = await checkAdminCreds();
  const mods = await checkRecorderModules();
  console.log('--- summary ---');
  console.log(`  admin creds: ${creds ? 'OK' : 'PROBLEM (explains the 401)'}`);
  console.log(`  recorder modules: ${mods ? 'OK' : 'PROBLEM'}`);
  process.exit(0);
})();
