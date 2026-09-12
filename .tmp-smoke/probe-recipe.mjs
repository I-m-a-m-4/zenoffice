/**
 * Recipe probe: does a recipe parse, produce a runnable flow, and refuse bad input?
 *
 *   node .tmp-smoke/probe-recipe.mjs <recipe.json>
 *
 * Nothing here launches a browser — the whole point of validating recipes up
 * front is that this check costs milliseconds.
 */
import { readFileSync } from 'node:fs';
import { parseRecipe, recipeToFlow, recipeRoutes } from '../scripts/record/recipe.mjs';

const file = process.argv[2];
const parsed = parseRecipe(JSON.parse(readFileSync(file, 'utf8')));
console.log('id:      ', parsed.id);
console.log('title:   ', parsed.title);
console.log('route:   ', parsed.route);
console.log('open:    ', JSON.stringify(parsed.open));
console.log('end:     ', JSON.stringify(parsed.end));
console.log('routes:  ', recipeRoutes(parsed).join(', '));
console.log('steps:');
for (const s of parsed.steps) console.log('   ', JSON.stringify(s));

// Drive the generated flow against a fake Page that records the calls, to prove
// every step kind dispatches to a method that exists rather than throwing on a
// typo'd name at take time.
const calls = [];
const rec = (name) => (...args) => {
  calls.push(`${name}(${args.map((a) => JSON.stringify(a)).join(', ')})`);
  return Promise.resolve({});
};
const fake = {
  card: rec('card'), clearCard: rec('clearCard'), goto: rec('goto'),
  caption: rec('caption'), click: rec('click'), clickTo: rec('clickTo'),
  hover: rec('hover'), fill: rec('fill'), press: rec('press'),
  scrollBy: rec('scrollBy'), hold: rec('hold'),
};
const flow = recipeToFlow(parsed);
const ending = await flow(fake);
console.log('\ndispatched:');
for (const c of calls) console.log('   ', c);
console.log('ending:  ', JSON.stringify(ending));

// Every method the recipe reached must actually exist on the real Page, or the
// fake above is only proving that a stub answers to a name nothing else has.
const { Page } = await import('../scripts/record/page.mjs');
const used = [...new Set(calls.map((c) => c.slice(0, c.indexOf('('))))];
const missing = used.filter((m) => typeof Page.prototype[m] !== 'function');
console.log('\nPage methods used:', used.join(', '));
console.log(missing.length ? `  ✗ MISSING ON Page: ${missing.join(', ')}` : '  ✓ all present on Page');

// The trust boundary: routes that leave the app must be refused.
const bad = [
  ['absolute url', { route: 'https://evil.example', steps: [{ hold: 1 }] }],
  ['protocol-relative', { route: '//evil.example', steps: [{ hold: 1 }] }],
  ['goto escape', { route: '/ok', steps: [{ goto: 'https://evil.example' }] }],
  ['clickTo escape', { route: '/ok', steps: [{ clickTo: { text: 'x' }, path: '//evil.example' }] }],
  ['no steps', { route: '/ok', steps: [] }],
  ['unknown step', { route: '/ok', steps: [{ wiggle: 3 }] }],
  ['spec with nothing', { route: '/ok', steps: [{ click: {} }] }],
  ['bad press key', { route: '/ok', steps: [{ press: 'F12' }] }],
];
console.log('\nrejections:');
for (const [name, raw] of bad) {
  try {
    parseRecipe(raw);
    console.log(`    x ${name}: ACCEPTED — should have been refused`);
  } catch (err) {
    console.log(`    ok ${name}: ${err.message}`);
  }
}

// A 300-second hold is a typo for milliseconds; it clamps rather than failing.
const clamped = parseRecipe({ route: '/ok', steps: [{ hold: 300000 }] });
console.log('\nhold 300000 clamps to:', clamped.steps[0].ms, '(expect 20000)');
