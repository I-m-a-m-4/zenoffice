import fs from 'fs';
import path from 'path';

const pathsToDelete = [
  'src/app/api',
  'src/app/robots.ts',
  'src/app/sitemap.ts',
  'src/app/industries',
  'src/app/blog',
  'src/app/store',
  // NOTE: 'src/app/admin-imamshaffy' is deliberately NOT deleted.
  // Deleting it is what made the Admin Panel link dead-end on mobile: the route
  // was never in the bundle, so it fell through to the root redirect below. The
  // panel is all client components and static-exports fine; the handful of server
  // modules it touched are stubbed in `stubs` further down, and everything else
  // goes over HTTPS to the hosted API via src/lib/admin-api.ts.
  'firestore.rules',
  'firestore.indexes.json',
  'firebase.json',
  'src/firebase/admin.ts',
  'src/lib/server'
];

const foldersToClear = [
  'src/actions',
  'src/ai'
];

console.log('--- Preparing Tauri Build: Stripping non-static components ---');

pathsToDelete.forEach(p => {
  const fullPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    console.log(`Deleting: ${p}`);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
});

/**
 * Value exports (functions, consts, classes) a module declares.
 *
 * Types are deliberately not collected: a stub missing a type fails the *build*
 * loudly, which needs no guard. A stub missing a function compiles fine and
 * throws `(0, x.name) is not a function` the first time a human presses the
 * button, which is exactly the failure this exists to catch.
 */
function valueExports(source) {
  const names = new Set();
  const re = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return names;
}

/** Every .ts/.tsx file under `dir`, recursively, as repo-relative paths. */
function walkSources(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSources(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Recorded before the wipe, so the stubs written further down can be checked
// against what they are standing in for.
const originalExports = new Map();
foldersToClear.forEach(p => {
  for (const full of walkSources(path.resolve(process.cwd(), p))) {
    const rel = path.relative(process.cwd(), full).split(path.sep).join('/');
    originalExports.set(rel, valueExports(fs.readFileSync(full, 'utf8')));
  }
});

foldersToClear.forEach(p => {
  const fullPath = path.resolve(process.cwd(), p);
  if (fs.existsSync(fullPath)) {
    console.log(`Clearing folder for stubbing: ${p}`);
    fs.readdirSync(fullPath).forEach(file => {
        const filePath = path.join(fullPath, file);
        fs.rmSync(filePath, { recursive: true, force: true });
    });
  }
});

// Specific stubs for core app dependencies to satisfy imports.
//
// `src/actions` and `src/ai` are wiped above because they are 'use server'
// modules that pull in firebase-admin/genkit, which cannot be statically
// exported. Anything a *client* component imports from them must be replaced
// here or the build fails on an unresolved module.
//
// The admin-panel stubs below throw rather than silently no-op: these actions
// have real consequences (deleting auth accounts, emailing every merchant), so
// a caller must find out it did not happen. Every call site already catches and
// toasts, so the message is what the operator sees.
const WEB_ONLY = 'This action is only available in the web admin panel at zeneva.space.';

/**
 * Phone pushes need the Admin SDK, which cannot ship in a static export. The
 * wording says what still happened, because it did: the in-app alert is a
 * Firestore document the client writes itself, and that document is what fills
 * the bell and drives both document→OS bridges. Only the FCM leg is missing.
 */
const PUSH_WEB_ONLY =
  'Phone push needs the web admin panel at zeneva.space. The in-app alert was still delivered.';

const stubs = [
    { path: 'src/ai/genkit.ts', content: 'export const ai = {}; export const getAI = () => ({});' },
    { path: 'src/ai/flows/customer-insights-flow.ts', content: 'export const getCustomerInsights = async () => ({ summary: "AI Insights disabled in desktop build", productSuggestions: [], engagementTactics: [] });' },
    { path: 'src/ai/flows/business-analysis-flow.ts', content: 'export const businessAnalysis = async () => ({ summary: "Tactical analysis is optimized for the cloud node.", metrics: {}, recommendations: [] });' },
    { path: 'src/ai/flows/product-troubleshoot-flow.ts', content: 'export const productTroubleshoot = async () => ({ solution: "Please connect to the command center via mobile or web for deeper diagnostics.", steps: [], confidence: 0 });' },
    { path: 'src/ai/flows/support-chat-flow.ts', content: 'export const zenevaSupportChat = async () => ({ response: "Direct support stream is available via the web terminal.", citations: [], suggestedActions: [] });' },
    { path: 'src/ai/flows/audit-log-analysis-flow.ts', content: 'export const analyzeAuditLogs = async () => ({ summary: "Security audit stream is encrypted for server-side processing only.", anomalies: [], riskScore: 0 });' },
    { path: 'src/ai/flows/visual-count-flow.ts', content: 'export const visualCount = async () => ({ count: 0, confidence: 0, details: "Hardware-accelerated visual counting requires active telemetry link." });' },

    // --- Admin panel dependencies (the panel now ships in the bundle) ---

    // content-strategy.tsx calls this; its types live in '@/types' precisely so
    // they survive this stub.
    {
        path: 'src/ai/flows/content-strategy-flow.ts',
        content: `export async function generateContentPlan() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n`,
    },

    // cyber-shield.tsx. Auth deletion needs the Admin SDK, so it cannot run here;
    // the component surfaces a warning that the accounts survived the purge.
    {
        path: 'src/actions/admin-actions.ts',
        content: `export async function deleteBusinessUsersAuth() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n\nexport async function revokeUserSessions() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n\nexport async function manuallySetBusinessPlan() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n`,
    },

    // admin-imamshaffy/page.tsx dynamically imports broadcastNotification;
    // notifications/page.tsx imports pushAlertToPhones; support/page.tsx imports
    // sendDirectUserPush.
    //
    // This stub listed only the first two for a long time, and the drift was
    // invisible until someone pressed the button: calling a name the stub does not
    // export is `(0, z.pushAlertToPhones) is not a function`, a *synchronous*
    // TypeError. On the Alerts page that escaped the push-specific handler and hit
    // the outer catch, so an alert whose in-app document had already been written
    // was reported as "Send Failed" — inviting a duplicate send. On the Support page
    // the call is fire-and-forget with `.catch()`, which a synchronous throw skips
    // entirely, so it broke the whole reply handler.
    //
    // The two push stubs *return* the documented `{ success: false, error }` shape
    // instead of throwing, unlike their siblings above. That is deliberate: both
    // call sites already tell "the in-app alert was delivered, the push was not"
    // apart from "nothing happened", and returning is what lets them keep saying
    // the true one. The `verifyStubs` check below now fails the build on any
    // future drift.
    {
        path: 'src/actions/notifications.ts',
        content: `export async function broadcastNotification() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n\nexport async function sendTestNotification() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n\nexport async function pushAlertToPhones() {\n  return { success: false, error: ${JSON.stringify(PUSH_WEB_ONLY)} };\n}\n\nexport async function sendDirectUserPush() {\n  return { success: false, error: ${JSON.stringify(PUSH_WEB_ONLY)} };\n}\n`,
    },

    // uninstall-tracker.tsx imports the UninstallScanResult *type* as well as the
    // two functions, so the stub has to re-declare it or the build fails on a
    // missing type rather than a missing function.
    {
        path: 'src/actions/uninstalls.ts',
        content: `export type UninstallChannelStat = {\n  channel: string;\n  total: number;\n  uninstalled: number;\n  rate: number;\n};\n\nexport type UninstallScanResult = {\n  scannedAt: string;\n  totalTokens: number;\n  totalUninstalled: number;\n  byChannel: UninstallChannelStat[];\n};\n\nexport async function scanForUninstalls() {\n  throw new Error(${JSON.stringify(WEB_ONLY)});\n}\n\nexport async function getUninstallStats(): Promise<UninstallScanResult | null> {\n  return null;\n}\n`,
    },

    // settings/subscription-section.tsx dynamically imports this. It was already
    // broken in native builds (the folder is wiped and nothing replaced it); the
    // stub turns an unresolved-module crash into a message the user can act on.
    {
        path: 'src/actions/subscription.ts',
        content: `export type UpgradeResult = { ok: true; plan: string; expiresAt: string } | { ok: false; error: string };\n\nexport async function activateSubscription(): Promise<UpgradeResult> {\n  return { ok: false, error: 'Please complete your upgrade at zeneva.space.' };\n}\n`,
    },
];

stubs.forEach(s => {
    const fullPath = path.resolve(process.cwd(), s.path);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, s.content);
    console.log(`Created stub: ${s.path}`);
});

/**
 * Fail the build if a stub exports fewer names than the module it replaced.
 *
 * This is the guard for the bug that shipped: `pushAlertToPhones` and
 * `sendDirectUserPush` were added to `src/actions/notifications.ts` and nobody
 * updated its stub. TypeScript never saw it — the stub is written at build time,
 * long after typechecking — and the native bundle compiled cleanly. The Alerts
 * page then reported "Send Failed" on an alert it had already delivered, and the
 * Support page's reply handler broke outright.
 *
 * Only files that already have a stub are checked. A wiped module that no client
 * component imports needs no stub, and demanding one would be noise.
 */
const drifted = [];
for (const [rel, expected] of originalExports) {
    const stub = stubs.find(s => s.path === rel);
    if (!stub) continue;
    const provided = valueExports(stub.content);
    const missing = [...expected].filter(name => !provided.has(name));
    if (missing.length > 0) drifted.push({ rel, missing });
}

if (drifted.length > 0) {
    console.error('\n--- STUB DRIFT: native build would ship broken buttons ---');
    for (const { rel, missing } of drifted) {
        console.error(`  ${rel} exports ${missing.join(', ')} but its stub does not.`);
    }
    console.error(
        '\nAdd the missing export(s) to the matching entry in `stubs` in scripts/prepare-tauri.mjs.\n' +
        'Calling a name a stub omits is a synchronous TypeError at the call site, not a\n' +
        'compile error, so nothing else will catch this.\n'
    );
    process.exit(1);
}
console.log(`Verified ${stubs.length} stubs against the modules they replace.`);

console.log('--- Setting up root page redirect ---');
const rootPagePath = path.resolve(process.cwd(), 'src/app/page.tsx');
// Mobile opens on the /welcome carousel; desktop gets it on a genuine first
// launch and /login after that. signedOutLandingRoute() reads the userAgent and
// a localStorage flag, so this has to run client-side.
const redirectContent = `'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signedOutLandingRoute } from '@/lib/platform';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(signedOutLandingRoute());
  }, [router]);
  return null;
}`;

if (fs.existsSync(rootPagePath)) {
    fs.writeFileSync(rootPagePath, redirectContent);
    console.log('Root page updated: /welcome on mobile and on a desktop first launch, /login after that');
}

console.log('--- Preparation Complete ---');
