/**
 * Checks for src/lib/product-catalog-state.ts — `npm run test:catalog-state`.
 *
 * Worth keeping because this module decides what a shop is *told* when its till
 * has nothing on it, and the thing it replaced told people something that was
 * not true of anybody: that their account lacked permission to view products,
 * when `firestore.rules` gates that list on tenancy alone. The checks below are
 * mostly about wording and reachability rather than arithmetic, because those
 * are the properties that broke.
 *
 * Must be `.ts`, never `.mts`: there is no `"type": "module"` in this repo, so
 * `src/**` compiles to CJS and a true-ESM importer fails named-import interop
 * (see the rating, import and launch-funnel harnesses, which all hit this).
 */

import {
  catalogUnavailableMessageKey,
  classifyProductSyncFailure,
  describeRefusal,
  isServerRefusal,
  CATALOG_UNAVAILABLE_MESSAGE_KEY,
  PRODUCT_SYNC_ERROR_KINDS,
  PRODUCT_SYNC_RETRY_POLICY,
  type ProductSyncErrorKind,
  type RefusalProbe,
} from '../src/lib/product-catalog-state';

import en from '../src/lib/i18n/messages/en';
import ar from '../src/lib/i18n/messages/ar';
import de from '../src/lib/i18n/messages/de';
import es from '../src/lib/i18n/messages/es';
import fr from '../src/lib/i18n/messages/fr';
import hi from '../src/lib/i18n/messages/hi';
import it from '../src/lib/i18n/messages/it';
import ja from '../src/lib/i18n/messages/ja';
import ko from '../src/lib/i18n/messages/ko';
import pt from '../src/lib/i18n/messages/pt';
import zh from '../src/lib/i18n/messages/zh';

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
  } else {
    failures.push(`${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`);
  }
}

// ---------------------------------------------------------------------------
// 1. The vocabulary itself
// ---------------------------------------------------------------------------

check('three kinds exist', PRODUCT_SYNC_ERROR_KINDS.length === 3, PRODUCT_SYNC_ERROR_KINDS);

/*
 * The whole point of the change. A `'permission'` kind cannot come back without
 * something also deciding what it renders — and the only honest sentence for it
 * is the one `'access'` already carries.
 */
check(
  "no 'permission' kind survives",
  !(PRODUCT_SYNC_ERROR_KINDS as readonly string[]).includes('permission'),
);
check(
  'every kind has a message key',
  PRODUCT_SYNC_ERROR_KINDS.every(k => typeof CATALOG_UNAVAILABLE_MESSAGE_KEY[k] === 'string'),
);
check(
  'every kind has a retry policy or is cache',
  PRODUCT_SYNC_ERROR_KINDS.every(k => k === 'cache' || !!(PRODUCT_SYNC_RETRY_POLICY as any)[k]),
);

// ---------------------------------------------------------------------------
// 2. isServerRefusal — codes carry meaning, prose does not
// ---------------------------------------------------------------------------

check('permission-denied is a refusal', isServerRefusal({ code: 'permission-denied' }));
check('unauthenticated is a refusal', isServerRefusal({ code: 'unauthenticated' }));
check(
  'namespaced code is a refusal',
  isServerRefusal({ code: 'firestore/permission-denied' }),
);
check(
  'uppercase code is a refusal',
  isServerRefusal({ code: 'PERMISSION-DENIED' }),
);
check(
  "Firestore's own wording is a refusal when the code was lost",
  isServerRefusal(new Error('Missing or insufficient permissions.')),
);

check('unavailable is not a refusal', !isServerRefusal({ code: 'unavailable' }));
check('deadline-exceeded is not a refusal', !isServerRefusal({ code: 'deadline-exceeded' }));
check('a dropped fetch is not a refusal', !isServerRefusal(new Error('Failed to fetch')));
check('null is not a refusal', !isServerRefusal(null));
check('undefined is not a refusal', !isServerRefusal(undefined));

/*
 * The two strings that broke the old substring test, and the reason it is a
 * regexp against Firestore's wording now rather than `.includes('permission')`.
 * Both of these are real messages this app can produce, and neither says
 * anything about a claim on this shop's products — one is a browser prompt, the
 * other a Tauri capability.
 */
check(
  'a denied browser prompt is not a refusal',
  !isServerRefusal(new Error('Notification failed, possibly because the user denied permission')),
);
check(
  'a Tauri capability refusal is not a refusal',
  !isServerRefusal(
    new Error('not allowed. Permissions associated with this command: sql:allow-load'),
  ),
);
check(
  'a product named "Permission Slip" in an error is not a refusal',
  !isServerRefusal(new Error('Could not write product "Permission Slips (50pk)"')),
);

// ---------------------------------------------------------------------------
// 3. classifyProductSyncFailure
// ---------------------------------------------------------------------------

check(
  'a refusal classifies as access',
  classifyProductSyncFailure({ code: 'permission-denied' }) === 'access',
);
check(
  'a transport failure classifies as network',
  classifyProductSyncFailure(new Error('Failed to fetch')) === 'network',
);
check(
  'an unknown failure classifies as network',
  classifyProductSyncFailure(undefined) === 'network',
);
check(
  'classification never returns permission',
  (['permission-denied', 'unavailable', 'internal'] as const).every(
    code => (classifyProductSyncFailure({ code }) as string) !== 'permission',
  ),
);

// ---------------------------------------------------------------------------
// 4. The retry ladder — a refusal must be retried, and sooner
// ---------------------------------------------------------------------------

/*
 * A refusal used to `return` from the catch immediately: no retry scheduled, no
 * Retry button, terminal for the session. It is the transient case that reaches
 * users most, so a zero-attempt ladder is the bug.
 */
check('a refusal is retried at least once', PRODUCT_SYNC_RETRY_POLICY.access.maxRetries >= 1);
check('a network failure is retried at least once', PRODUCT_SYNC_RETRY_POLICY.network.maxRetries >= 1);
check(
  'a refusal settles no later than a network failure',
  PRODUCT_SYNC_RETRY_POLICY.access.maxRetries * PRODUCT_SYNC_RETRY_POLICY.access.baseDelayMs <=
    PRODUCT_SYNC_RETRY_POLICY.network.maxRetries * PRODUCT_SYNC_RETRY_POLICY.network.baseDelayMs,
);
/*
 * A cashier stands at the till while this runs. The ladder is linear —
 * `baseDelayMs * attempt` — so total wait is base × n(n+1)/2.
 */
for (const kind of ['network', 'access'] as const) {
  const { maxRetries, baseDelayMs } = PRODUCT_SYNC_RETRY_POLICY[kind];
  const total = (baseDelayMs * (maxRetries * (maxRetries + 1))) / 2;
  check(`${kind} ladder settles within 30s`, total <= 30_000, total);
  check(`${kind} first attempt is not instant`, baseDelayMs >= 1_000, baseDelayMs);
}

// ---------------------------------------------------------------------------
// 5. Message keys
// ---------------------------------------------------------------------------

check(
  'a null kind falls back to the network wording',
  catalogUnavailableMessageKey(null) === CATALOG_UNAVAILABLE_MESSAGE_KEY.network,
);
for (const kind of PRODUCT_SYNC_ERROR_KINDS) {
  check(
    `${kind} maps to its own key`,
    catalogUnavailableMessageKey(kind) === CATALOG_UNAVAILABLE_MESSAGE_KEY[kind],
  );
  check(`${kind} key is under pos.`, CATALOG_UNAVAILABLE_MESSAGE_KEY[kind].startsWith('pos.'));
}
check(
  'the three keys are distinct',
  new Set(Object.values(CATALOG_UNAVAILABLE_MESSAGE_KEY)).size === 3,
);

// ---------------------------------------------------------------------------
// 6. Every catalog carries every key, and none carries the old one
// ---------------------------------------------------------------------------

const CATALOGS: Array<[string, any]> = [
  ['en', en], ['ar', ar], ['de', de], ['es', es], ['fr', fr], ['hi', hi],
  ['it', it], ['ja', ja], ['ko', ko], ['pt', pt], ['zh', zh],
];

check('all eleven catalogs are loaded', CATALOGS.length === 11, CATALOGS.length);

for (const [code, catalog] of CATALOGS) {
  const pos = catalog?.pos ?? {};

  for (const kind of PRODUCT_SYNC_ERROR_KINDS) {
    const leaf = CATALOG_UNAVAILABLE_MESSAGE_KEY[kind].slice('pos.'.length);
    const value = pos[leaf];
    check(`${code}: ${leaf} exists`, typeof value === 'string' && value.trim().length > 0);
  }

  check(`${code}: title exists`, typeof pos.catalogUnavailableTitle === 'string');
  check(`${code}: retry label exists`, typeof pos.retryLoadingProducts === 'string');

  /*
   * The deleted key. Left behind, it is a live string one `t()` call away from
   * being shown again — this repo has eleven catalogs and a habit of drifting.
   */
  check(
    `${code}: the old permission copy is gone`,
    !('catalogUnavailablePermission' in pos),
  );

  /*
   * The Portuguese screenshot that prompted this said "Esta conta não tem
   * permissão…" — the claim is what was wrong, not the translation, so no
   * catalog may reintroduce it under the new key. Checked against each
   * language's own word for permission, plus the "ask the owner" instruction it
   * came with.
   */
  const access: string = pos[CATALOG_UNAVAILABLE_MESSAGE_KEY.access.slice('pos.'.length)] ?? '';
  const ACCUSATIONS: Record<string, RegExp> = {
    en: /permission|not allowed|isn't allowed/i,
    pt: /permiss[ãa]o|n[ãa]o tem acesso/i,
    es: /permiso/i,
    fr: /autoris|permission/i,
    de: /berechtigung|erlaubnis/i,
    it: /autorizzat|permesso/i,
    ar: /صلاحية|غير مسموح/,
    zh: /无权|权限/,
    ja: /権限/,
    ko: /권한/,
    hi: /अनुमति/,
  };
  check(
    `${code}: access copy does not accuse the account`,
    !ACCUSATIONS[code].test(access),
    access,
  );

  /*
   * And it must still be actionable. Every one of these ends by telling the
   * reader to try again, because the Retry button is now always offered and the
   * common cause is transient.
   */
  const RETRY_HINT: Record<string, RegExp> = {
    en: /try again/i,
    pt: /tente novamente/i,
    es: /int[ée]ntalo de nuevo/i,
    fr: /r[ée]essayez/i,
    de: /erneut/i,
    it: /riprova/i,
    ar: /أعد المحاولة/,
    zh: /重试/,
    ja: /お試し/,
    ko: /다시 시도/,
    hi: /कोशिश/,
  };
  check(`${code}: access copy tells the reader to retry`, RETRY_HINT[code].test(access), access);
}

// ---------------------------------------------------------------------------
// 7. describeRefusal — the diagnosis that goes to the platform owner
// ---------------------------------------------------------------------------

const OK_PROBE: RefusalProbe = { reachedServer: true, profileExists: true, profileBusinessId: 'biz-1' };
const CTX = {
  queriedBusinessId: 'biz-1',
  authUid: 'uid-1',
  isImpersonating: false,
  code: 'permission-denied',
  attempts: 3,
};

check(
  'a missing server profile is named',
  describeRefusal({ reachedServer: true, profileExists: false, profileBusinessId: null }, CTX)
    .cause === 'no-server-profile',
);
check(
  'a tenant mismatch is named',
  describeRefusal({ reachedServer: true, profileExists: true, profileBusinessId: 'biz-2' }, CTX)
    .cause === 'tenant-mismatch',
);
check(
  'a failed probe is named, not guessed past',
  describeRefusal({ reachedServer: false, profileExists: false, profileBusinessId: null }, CTX)
    .cause === 'probe-failed',
);
check(
  'impersonation is named first',
  describeRefusal(OK_PROBE, { ...CTX, isImpersonating: true }).cause === 'impersonation',
);
check(
  'impersonation wins over a probe that failed',
  describeRefusal(
    { reachedServer: false, profileExists: false, profileBusinessId: null },
    { ...CTX, isImpersonating: true },
  ).cause === 'impersonation',
);
check(
  'a healthy profile is reported as unattributed, not invented',
  describeRefusal(OK_PROBE, CTX).cause === 'unattributed',
);
check(
  'a null businessId on both sides is not a mismatch',
  describeRefusal(
    { reachedServer: true, profileExists: true, profileBusinessId: null },
    { ...CTX, queriedBusinessId: null },
  ).cause === 'unattributed',
);

// Every message must carry the code and the attempt count — that is what makes
// an error_logs row triageable without asking the shop anything.
for (const probe of [
  OK_PROBE,
  { reachedServer: true, profileExists: false, profileBusinessId: null },
  { reachedServer: true, profileExists: true, profileBusinessId: 'biz-2' },
  { reachedServer: false, profileExists: false, profileBusinessId: null },
] as RefusalProbe[]) {
  const { message } = describeRefusal(probe, CTX);
  check('message names the code', message.includes('permission-denied'), message);
  check('message names the attempt count', message.includes('3 attempts'), message);
  check('message is a real sentence', message.length > 60, message.length);
}

check(
  'one attempt is not pluralised',
  describeRefusal(OK_PROBE, { ...CTX, attempts: 1 }).message.includes('1 attempt.'),
);
check(
  'a missing code is stated rather than blank',
  describeRefusal(OK_PROBE, { ...CTX, code: null }).message.includes('no code'),
);

/*
 * The diagnosis is for `error_logs`, never for the screen. If one of these
 * sentences ever reaches a shopkeeper it should at least not be the accusation
 * that started all this — and none of them should mention rules jargon to a
 * user, which is a second reason they stay server-side.
 */
for (const probe of [OK_PROBE, { reachedServer: true, profileExists: false, profileBusinessId: null }] as RefusalProbe[]) {
  check(
    'diagnosis never tells the user they lack a permission',
    !/you (are not|aren't) allowed|ask the (business )?owner/i.test(describeRefusal(probe, CTX).message),
  );
}

// ---------------------------------------------------------------------------

const KINDS: ProductSyncErrorKind[] = ['network', 'cache', 'access'];
check('the exported kind list matches the type', KINDS.every(k => PRODUCT_SYNC_ERROR_KINDS.includes(k)));

console.log(`\nproduct-catalog-state: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
