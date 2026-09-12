/**
 * Checks for src/lib/launch-funnel.ts — `npm run test:launch-funnel`.
 *
 * Worth keeping because this module answers a question about real people who
 * could not get into the app, and the answer drives what gets fixed next. A
 * funnel that quietly double-counts, or that reports somebody as "dropped at the
 * welcome screen" when they were never sent there, sends the next week of work in
 * the wrong direction.
 *
 * Must be `.ts`, never `.mts`: there is no `"type": "module"` in this repo, so
 * `src/**` compiles to CJS and a true-ESM importer fails named-import interop
 * (see the rating and import harnesses, which both hit this).
 */

import {
  baseLanguage,
  furthestStage,
  launchDate,
  stageLabel,
  summariseLaunches,
  STAGE_LABELS,
  type LaunchDoc,
} from '../src/lib/launch-funnel';
import { LAUNCH_STAGE_ORDER, type LaunchStage } from '../src/lib/launch-telemetry';

let pass = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++;
  } else {
    failures.push(
      `${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`,
    );
  }
}

const T = '2026-08-24T10:00:00.000Z';

/** A document with the given stages marked, plus whatever else is passed. */
function doc(
  installId: string,
  stages: LaunchStage[],
  extra: Partial<LaunchDoc> = {},
): LaunchDoc {
  const map: Record<string, string> = {};
  for (const s of stages) map[s] = T;
  return { installId, stages: map, ...extra };
}

const step = (s: ReturnType<typeof summariseLaunches>, key: string) =>
  s.steps.find((x) => x.key === key)!;

/* ── 1. baseLanguage: the Store listings are per-language, the funnel is too ── */
{
  check('1a: pt-BR groups to pt', baseLanguage('pt-BR') === 'pt', baseLanguage('pt-BR'));
  check('1b: pt-PT groups to pt', baseLanguage('pt-PT') === 'pt');
  check('1c: underscore form groups', baseLanguage('es_MX') === 'es', baseLanguage('es_MX'));
  check('1d: case folded', baseLanguage('AR-SA') === 'ar', baseLanguage('AR-SA'));
  check('1e: bare tag survives', baseLanguage('en') === 'en');
  check('1f: undefined is unknown, not empty', baseLanguage(undefined) === 'unknown');
  check('1g: blank is unknown', baseLanguage('   ') === 'unknown', baseLanguage('   '));
}

/* ── 2. furthestStage: a failure must not pull an install backwards ─────────── */
{
  // Submitted the form and Firebase rejected it. `signup_failed` is absent from
  // LAUNCH_STAGE_ORDER on purpose, so the answer is signup_started.
  const d = doc('a', ['reached_login', 'reached_signup', 'signup_started', 'signup_failed']);
  check('2a: failure does not pull back', furthestStage(d) === 'signup_started', furthestStage(d));

  // The document existing is proof the app opened; app_opened is never written
  // into `stages` (it is per-session, so it would overwrite the first-launch time).
  check('2b: no stages at all reports app_opened', furthestStage({ installId: 'b' }) === 'app_opened');
  check('2c: empty stages map reports app_opened', furthestStage({ installId: 'c', stages: {} }) === 'app_opened');

  const onboarded = doc('d', ['reached_signup', 'signup_started', 'signup_succeeded', 'onboarding_started', 'onboarding_completed']);
  check('2d: full run reports onboarding_completed', furthestStage(onboarded) === 'onboarding_completed', furthestStage(onboarded));

  // Queue loss: only the last stage was delivered. It must still report the
  // furthest, not fall back to app_opened because the earlier ones are missing.
  const sparse = doc('e', ['signup_succeeded']);
  check('2e: sparse stages still report the furthest', furthestStage(sparse) === 'signup_succeeded', furthestStage(sparse));

  // login_attempted sits before signup_started in the order; someone who tried to
  // log in on a fresh install got further than someone who only saw the form.
  const tried = doc('f', ['reached_login', 'login_attempted']);
  check('2f: login_attempted beats reached_login', furthestStage(tried) === 'login_attempted', furthestStage(tried));
}

/* ── 3. The alternatives collapse: nobody drops out of a route they never saw ─ */
{
  // Desktop first launch lands on /welcome, a returning one on /login, and the
  // sign-up form is a third alternative. Counting them as three sequential steps
  // would report every install dropping out of two screens it was never sent to.
  const s = summariseLaunches([
    doc('welcome-only', ['reached_welcome']),
    doc('login-only', ['reached_login']),
    doc('signup-only', ['reached_signup']),
  ]);
  check('3a: all three routes reach saw_a_way_in', step(s, 'saw_a_way_in').reached === 3, step(s, 'saw_a_way_in').reached);
  check('3b: only the signup route reaches reached_signup', step(s, 'reached_signup').reached === 1, step(s, 'reached_signup').reached);
  check('3c: welcome-only and login-only are lost at saw_a_way_in', step(s, 'saw_a_way_in').lostHere === 2, step(s, 'saw_a_way_in').lostHere);
  check('3d: nobody is lost at "opened" — all three got further', step(s, 'opened').lostHere === 0, step(s, 'opened').lostHere);
}

/* ── 4. An install that opened and did nothing else is lost at step one ─────── */
{
  const s = summariseLaunches([{ installId: 'ghost' }, { installId: 'ghost2', stages: {} }]);
  check('4a: opened is reached by both', step(s, 'opened').reached === 2);
  check('4b: both lost at opened', step(s, 'opened').lostHere === 2, step(s, 'opened').lostHere);
  check('4c: saw_a_way_in reached by nobody', step(s, 'saw_a_way_in').reached === 0);
  check('4d: a stage nobody reached is 0, not absent', step(s, 'signup_succeeded').reached === 0);
  check('4e: worst step is "opened"', s.worstStep?.key === 'opened', s.worstStep?.key);
}

/* ── 5. The funnel is monotonic and lostHere sums to the install count ──────── */
{
  const docs: LaunchDoc[] = [
    doc('1', ['reached_welcome']),
    doc('2', ['reached_login']),
    doc('3', ['reached_welcome', 'reached_signup']),
    doc('4', ['reached_signup', 'signup_started']),
    doc('5', ['reached_signup', 'signup_started', 'signup_succeeded'], { signedUp: true }),
    doc('6', ['reached_signup', 'signup_started', 'signup_succeeded', 'onboarding_completed'], { signedUp: true, onboarded: true }),
    { installId: '7' },
  ];
  const s = summariseLaunches(docs);

  check('5a: installs counted', s.installs === 7, s.installs);
  let monotonic = true;
  for (let i = 1; i < s.steps.length; i++) {
    if (s.steps[i].reached > s.steps[i - 1].reached) monotonic = false;
  }
  check('5b: reached never rises down the funnel', monotonic, s.steps.map((x) => x.reached));
  check(
    '5c: lostHere sums to installs',
    s.steps.reduce((sum, x) => sum + x.lostHere, 0) === 7,
    s.steps.map((x) => x.lostHere),
  );
  check('5d: signedUp counted from the flag, not the stage', s.signedUp === 2, s.signedUp);
  check('5e: onboarded counted', s.onboarded === 1, s.onboarded);
  // 2/7 = 28.571… → one decimal.
  check('5f: conversionPct keeps one decimal', s.conversionPct === 28.6, s.conversionPct);
  check('5g: first step has no carry figure', s.steps[0].carryPct === null, s.steps[0].carryPct);
  // 4 of the 6 who saw a way in opened the sign-up form.
  check('5h: carryPct is against the previous step', step(s, 'reached_signup').carryPct === 67, step(s, 'reached_signup').carryPct);
}

/* ── 6. worstStep never blames the finish line ──────────────────────────────── */
{
  // Three accounts created, none finished setup. "Finished setup" holds the most
  // stalled installs, but it is the goal — it cannot lose anyone.
  const s = summariseLaunches([
    doc('a', ['reached_signup', 'signup_started', 'signup_succeeded'], { signedUp: true }),
    doc('b', ['reached_signup', 'signup_started', 'signup_succeeded'], { signedUp: true }),
    doc('c', ['reached_signup', 'signup_started', 'signup_succeeded'], { signedUp: true }),
    doc('d', ['reached_login']),
  ]);
  check('6a: worst step is not the final step', s.worstStep?.key !== 'onboarding_completed', s.worstStep?.key);
  check('6b: worst step is signup_succeeded (3 stalled there)', s.worstStep?.key === 'signup_succeeded', s.worstStep?.key);

  // Everybody made it: there is no drop-off to report, and reporting a zero-loss
  // step as "the biggest drop-off" would invent a problem.
  const perfect = summariseLaunches([
    doc('x', ['reached_signup', 'signup_started', 'signup_succeeded', 'onboarding_completed'], { signedUp: true, onboarded: true }),
  ]);
  check('6c: no losses means no worst step', perfect.worstStep === null, perfect.worstStep);
}

/* ── 7. lostLocales asks the language question of the people who left ──────── */
{
  const s = summariseLaunches([
    doc('a', ['reached_login'], { locale: 'ar-SA' }),
    doc('b', ['reached_login'], { locale: 'ar-EG' }),
    doc('c', ['reached_signup'], { locale: 'pt-BR' }),
    doc('d', ['signup_succeeded'], { locale: 'en-GB', signedUp: true }),
    doc('e', ['signup_succeeded'], { locale: 'en-US', signedUp: true }),
    doc('f', ['signup_succeeded'], { locale: 'en-US', signedUp: true }),
  ]);
  const langs = s.lostLocales.map((x) => x.value);
  check('7a: only non-signups are tallied', !langs.includes('en'), langs);
  check('7b: ar leads with 2', s.lostLocales[0]?.value === 'ar' && s.lostLocales[0]?.count === 2, s.lostLocales[0]);
  check('7c: pt present with 1', s.lostLocales.some((x) => x.value === 'pt' && x.count === 1), s.lostLocales);
  check('7d: platform tally covers everybody, not just the lost', s.platforms[0]?.count === 6, s.platforms[0]);
  check('7e: a missing platform reads as unknown, not dropped', s.platforms[0]?.value === 'unknown', s.platforms[0]?.value);
}

/* ── 8. tally ordering is stable: count desc, then value asc ────────────────── */
{
  const s = summariseLaunches([
    doc('a', [], { country: 'ZA' }),
    doc('b', [], { country: 'NG' }),
    doc('c', [], { country: 'NG' }),
    doc('d', [], { country: 'GB' }),
  ]);
  check('8a: commonest first', s.countries[0]?.value === 'NG', s.countries);
  // GB and ZA tie at 1 — alphabetical, not Map insertion order (which would be ZA).
  check('8b: ties break alphabetically, not by insertion', s.countries[1]?.value === 'GB', s.countries.map((x) => x.value));
}

/* ── 9. Failures and repeat opens ───────────────────────────────────────────── */
{
  const s = summariseLaunches([
    doc('a', ['reached_login', 'login_attempted'], {
      launches: 4,
      failures: [
        { stage: 'login_failed', code: 'popup-fallback:auth/popup-blocked', at: T },
        { stage: 'login_failed', code: 'password:auth/wrong-password', at: T },
      ],
    }),
    doc('b', ['reached_signup', 'signup_started'], {
      launches: 1,
      failures: [{ stage: 'signup_failed', code: 'password:auth/email-already-in-use', at: T }],
    }),
    doc('c', ['reached_login'], { launches: 3 }),
    doc('d', ['signup_succeeded'], { launches: 5, signedUp: true }),
  ]);
  check('9a: installs with a failure, not failure count', s.installsWithFailures === 2, s.installsWithFailures);
  check('9b: every failure code is tallied', s.failureCodes.length === 3, s.failureCodes.length);
  // 'd' came back four times but did sign up, so it is not a returner-without-signup.
  check('9c: returned without signing up excludes signups', s.returnedWithoutSigningUp === 2, s.returnedWithoutSigningUp);
  // A doc with no `launches` field must read as one open, never as zero.
  const single = summariseLaunches([doc('e', ['reached_login'])]);
  check('9d: a missing launches field is not a returner', single.returnedWithoutSigningUp === 0, single.returnedWithoutSigningUp);
}

/* ── 10. Zero installs: every figure present and zero, nothing thrown ───────── */
{
  const s = summariseLaunches([]);
  check('10a: installs 0', s.installs === 0);
  check('10b: conversionPct 0, not NaN', s.conversionPct === 0, s.conversionPct);
  check('10c: all six steps still drawn', s.steps.length === 6, s.steps.length);
  check('10d: reachedPct 0, not NaN', s.steps.every((x) => x.reachedPct === 0), s.steps.map((x) => x.reachedPct));
  check('10e: carryPct 0 where the previous step is empty', s.steps[1].carryPct === 0, s.steps[1].carryPct);
  check('10f: worstStep null', s.worstStep === null);
  check('10g: breakdowns empty, not undefined', s.lostLocales.length === 0 && s.failureCodes.length === 0);
}

/* ── 11. launchDate prefers server time, then the client's claim, then null ─── */
{
  const server = new Date('2026-08-20T09:00:00.000Z');
  check(
    '11a: Timestamp.toDate wins',
    launchDate({ installId: 'a', lastSeenAt: { toDate: () => server }, firstSeenAt: T })?.getTime() === server.getTime(),
  );
  check(
    '11b: seconds form is read when toDate is absent',
    launchDate({ installId: 'b', lastSeenAt: { seconds: 1_755_680_400 } })?.getTime() === 1_755_680_400_000,
  );
  check(
    '11c: falls back to the client stamp',
    launchDate({ installId: 'c', firstSeenAt: T })?.toISOString() === T,
  );
  check('11d: nothing usable is null, not epoch', launchDate({ installId: 'd' }) === null);
  check(
    '11e: an unparseable client stamp is null, not Invalid Date',
    launchDate({ installId: 'e', firstSeenAt: 'not a date' }) === null,
  );
}

/* ── 12. Every stage has a label, and the panel never prints a raw stage id ─── */
{
  const missing = LAUNCH_STAGE_ORDER.filter((s) => !STAGE_LABELS[s]);
  check('12a: every progress stage has a label', missing.length === 0, missing);
  check('12b: signup_failed is labelled too', Boolean(STAGE_LABELS.signup_failed));
  check('12c: login_failed is labelled too', Boolean(STAGE_LABELS.login_failed));
  check('12d: an unknown stage falls back to itself', stageLabel('something_new') === 'something_new');
  check('12e: app_opened reads as opened-only', STAGE_LABELS.app_opened.toLowerCase().includes('opened'));
}

/* ── 13. Failure stages are deliberately absent from the progress order ────── */
{
  // Documented in launch-telemetry.ts: including signup_failed between started and
  // succeeded would report a stuck install as further along than one still typing.
  check('13a: signup_failed is not progress', !LAUNCH_STAGE_ORDER.includes('signup_failed' as LaunchStage));
  check('13b: login_failed is not progress', !LAUNCH_STAGE_ORDER.includes('login_failed' as LaunchStage));
  check('13c: login_succeeded is not in the sign-up funnel order', !LAUNCH_STAGE_ORDER.includes('login_succeeded' as LaunchStage));
  check('13d: app_opened is first', LAUNCH_STAGE_ORDER[0] === 'app_opened');
  check('13e: onboarding_completed is last', LAUNCH_STAGE_ORDER[LAUNCH_STAGE_ORDER.length - 1] === 'onboarding_completed');
}

/* ── Report ────────────────────────────────────────────────────────────────── */
const total = pass + failures.length;
if (failures.length) {
  console.error(`launch-funnel: ${pass}/${total} passed, ${failures.length} FAILED`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`launch-funnel: ${pass}/${total} checks passed`);
