/**
 * A ready-made recording for every Zeneva page you can land on cold.
 *
 * The recorder could always shoot any page — that is what a recipe is for. What
 * it could not do was shoot one *without someone authoring the recipe first*, and
 * "pick the page you want" is the whole difference between a tool and a chore.
 * So this is a library, not a new capability: each preset is an ordinary `Recipe`,
 * it goes down the same `--recipe` path the studio's builder uses, and it is
 * validated by `parseRecipe` on the recorder's side of the process boundary like
 * everything else. There is no second execution path to keep honest.
 *
 * ## Why presets barely click anything
 *
 * Almost every label in the app comes from an i18n catalog — `t('customers.
 * addCustomer')`, not "Add Customer" — so the text on screen depends on the
 * operator's locale. A preset that clicked by text would work in English and
 * silently record the wrong screen in the other ten languages.
 *
 * So a preset is built from the four things that cannot miss: the route, the
 * caption track, scrolling, and the camera. That produces a real tour of the real
 * page in any language. When you *do* want a click, load the preset into the
 * builder and add one — you are looking at the app while you do it, which is the
 * only reliable way to name a button anyway.
 *
 * ## Pages deliberately absent
 *
 * - `/onboarding` — a pre-setup flow. The recorder signs into an account that
 *   already has a business, so this route redirects away mid-take.
 * - `/customers/details`, `/inventory/details` — both need a specific record id
 *   in the query string. Without one they render an empty shell.
 * - `/sales/pos/customer`, `/payment`, `/review` — these need a cart in progress.
 *   Landing on them cold bounces back to the counter; the coded `pos` flow walks
 *   all three properly, in order, with a real basket.
 */

import type { Recipe, RecipeStep, TitleCard } from './recorder';

// ------------------------------------------------------------------ step sugar
//
// A preset is read far more often than it is written, so the beats are spelled as
// verbs. Every default here is a timing that reads well on camera rather than a
// round number: 3.4s is long enough to read a caption of this length, and a 1.25x
// punch is a push the eye follows without noticing the frame move.

const say = (text: string, ms = 3400): RecipeStep => ({ kind: 'caption', text, ms });
const hold = (ms: number): RecipeStep => ({ kind: 'hold', ms });
const down = (dy = 520): RecipeStep => ({ kind: 'scroll', dy });
const up = (dy = 520): RecipeStep => ({ kind: 'scroll', dy: -dy });
const punch = (to = 1.25, ms = 900): RecipeStep => ({ kind: 'punch', to, ms });
const wide = (ms = 800): RecipeStep => ({ kind: 'wide', ms });

export type PresetGroup = 'Sell' | 'Stock' | 'Money' | 'People' | 'Insight' | 'Run';

export type Preset = {
  /** Stable slug. Becomes `custom-<id>` when the recorder registers it. */
  id: string;
  route: string;
  /** Shown in the picker, and used as the recipe title. */
  title: string;
  blurb: string;
  group: PresetGroup;
  /** Opening card: [title, subtitle]. */
  open: [string, string];
  /** Closing card. Falls back to the house sign-off. */
  end?: [string, string, string];
  steps: RecipeStep[];
};

const HOUSE_END: [string, string, string] = ['Zeneva', 'Retail, handled.', 'Start free'];

/** Groups in the order the picker shows them — the order a shop meets them. */
export const PRESET_GROUPS: PresetGroup[] = ['Sell', 'Stock', 'Money', 'People', 'Insight', 'Run'];

export const PRESETS: Preset[] = [
  // ------------------------------------------------------------------- Sell
  {
    id: 'pos-counter',
    route: '/sales/pos/select-products',
    title: 'POS counter',
    blurb: 'A tour of the till itself — the product grid, the running cart, the totals.',
    group: 'Sell',
    open: ['The counter.', 'Built for a queue.'],
    end: ['Sell anywhere. Even offline.', 'Zeneva POS', 'Start free'],
    steps: [
      say('This is the till. Everything a sale needs, on one screen.'),
      hold(1500),
      punch(1.22),
      say('Tap a product. It lands in the cart with its price and stock.'),
      hold(2200),
      wide(),
      down(420),
      say('The basket totals as you go — discounts, coupons, change due.'),
      hold(2400),
      up(420),
      say('No internet? The register keeps taking money and syncs later.'),
      hold(2600),
    ],
  },
  {
    id: 'online-orders',
    route: '/online-orders',
    title: 'Online orders',
    blurb: 'Orders arriving from the storefront, with revenue and average order value on top.',
    group: 'Sell',
    open: ['Orders while you sleep.', 'Same shop, same stock.'],
    steps: [
      say('Orders from your online storefront land here.'),
      hold(1600),
      punch(1.2),
      say('Revenue, order count and average order value, live.'),
      hold(2300),
      wide(),
      down(560),
      say('Accept, fulfil and track each one without leaving the counter.'),
      hold(2400),
    ],
  },
  {
    id: 'storefront',
    route: '/storefront',
    title: 'Storefront',
    blurb: 'The customer-facing catalogue and how it is dressed.',
    group: 'Sell',
    open: ['Your shop, online.', 'No website to build.'],
    steps: [
      say('Your catalogue becomes a storefront customers can browse.'),
      hold(1700),
      down(520),
      say('Name it, colour it, choose what shows. That is the whole setup.'),
      hold(2400),
      down(520),
      hold(1800),
      up(1040),
      say('One inventory behind both. Sell in person and online off the same stock.'),
      hold(2600),
    ],
  },
  {
    id: 'receipts',
    route: '/receipts',
    title: 'Receipts',
    blurb: 'The receipt ledger — searchable, printable, shareable.',
    group: 'Sell',
    open: ['Every sale, on the record.', 'Findable in seconds.'],
    steps: [
      say('Every sale writes a receipt you can find again.'),
      hold(1600),
      punch(1.2),
      say('Print to thermal, save as PDF, or send it to the customer.'),
      hold(2400),
      wide(),
      down(560),
      say('Refunds and reprints trace back to the original sale.'),
      hold(2300),
    ],
  },
  {
    id: 'terminal-alerts',
    route: '/terminal-alerts',
    title: 'Terminal alerts',
    blurb: 'Card terminal notifications matched against recorded sales.',
    group: 'Sell',
    open: ['Card payments, reconciled.', 'Nothing slips past.'],
    steps: [
      say('Terminal alerts arrive here as customers pay by card.'),
      hold(1800),
      punch(1.22),
      say('Each one is traced to the receipt it belongs to.'),
      hold(2400),
      wide(),
      down(480),
      say('A payment with no sale behind it stands out immediately.'),
      hold(2300),
    ],
  },

  // ------------------------------------------------------------------ Stock
  {
    id: 'inventory',
    route: '/inventory',
    title: 'Inventory',
    blurb: 'The catalogue itself — search, categories, per-branch stock.',
    group: 'Stock',
    open: ['Know what you have.', 'Down to the last unit.'],
    end: ['Counts you can trust, on every device.', 'Zeneva Inventory', 'Start free'],
    steps: [
      say('Your whole catalogue, with live stock against every line.'),
      hold(1700),
      punch(1.24),
      say('Variants group under one product instead of cluttering the list.'),
      hold(2400),
      wide(),
      down(600),
      say('Filter by category, branch or what is running out.'),
      hold(2400),
      down(600),
      hold(1900),
    ],
  },
  {
    id: 'inventory-add',
    route: '/inventory/add',
    title: 'Add a product',
    blurb: 'The new-product form — pricing, stock, variants, barcode.',
    group: 'Stock',
    open: ['Adding stock.', 'Once, properly.'],
    steps: [
      say('Adding a product takes one form.'),
      hold(1600),
      punch(1.2),
      say('Cost, price and margin sit together, so you price with the number in view.'),
      hold(2600),
      wide(),
      down(560),
      say('Variants, barcodes and per-branch counts are all on the same page.'),
      hold(2500),
      down(520),
      hold(1800),
    ],
  },
  {
    id: 'inventory-troubleshoot',
    route: '/inventory/troubleshoot',
    title: 'Inventory health',
    blurb: 'The data-health scanner: missing prices, duplicates, negative stock.',
    group: 'Stock',
    open: ['Find the broken rows.', 'Before they cost you.'],
    steps: [
      say('This scans your catalogue for the problems that quietly lose money.'),
      hold(2100),
      punch(1.22),
      say('Missing prices, uncategorised products, probable duplicates, negative stock.'),
      hold(2800),
      wide(),
      down(560),
      say('Each finding links straight to the product so you can fix it now.'),
      hold(2500),
    ],
  },
  {
    id: 'inventory-debts',
    route: '/inventory/debts',
    title: 'Supplier debts',
    blurb: 'What you owe suppliers and what is on backorder.',
    group: 'Stock',
    open: ['What you owe.', 'And what is still coming.'],
    steps: [
      say('Stock taken on credit is tracked as debt, not forgotten.'),
      hold(1900),
      punch(1.22),
      say('Items owed, their value, and the profit still tied up in them.'),
      hold(2600),
      wide(),
      down(540),
      say('Backorders show what is due in, so you stop reordering twice.'),
      hold(2400),
    ],
  },
  {
    id: 'product-items',
    route: '/product-items',
    title: 'Product items',
    blurb: 'Individual serialised units beneath a product line.',
    group: 'Stock',
    open: ['Serial by serial.', 'When one unit matters.'],
    steps: [
      say('Some stock has to be tracked one unit at a time.'),
      hold(1800),
      punch(1.2),
      say('Serial numbers, condition and where each unit is now.'),
      hold(2500),
      wide(),
      down(520),
      hold(2000),
    ],
  },

  // ------------------------------------------------------------------ Money
  {
    id: 'invoices',
    route: '/invoices',
    title: 'Invoices',
    blurb: 'Outstanding balances and the invoice ledger.',
    group: 'Money',
    open: ['Who owes you.', 'And since when.'],
    steps: [
      say('Sales on account become invoices you can chase.'),
      hold(1700),
      punch(1.22),
      say('Outstanding balance, age, and what has been paid so far.'),
      hold(2500),
      wide(),
      down(560),
      say('Search the ledger, mark a payment, send a reminder.'),
      hold(2400),
    ],
  },
  {
    id: 'billing',
    route: '/billing',
    title: 'Billing',
    blurb: 'The subscription screen — plan, usage and invoices.',
    group: 'Money',
    open: ['Your plan.', 'No surprises.'],
    steps: [
      say('Your plan, what it includes, and what you have used.'),
      hold(2000),
      punch(1.2),
      say('Upgrades take effect immediately. A lapse drops you to free — it never locks the till.'),
      hold(2900),
      wide(),
      down(520),
      hold(2000),
    ],
  },

  // ----------------------------------------------------------------- People
  {
    id: 'customers',
    route: '/customers',
    title: 'Customers',
    blurb: 'The customer directory with spend, loyalty and debt.',
    group: 'People',
    open: ['Who buys from you.', 'And what they buy.'],
    steps: [
      say('Every customer you have served, in one directory.'),
      hold(1700),
      punch(1.24),
      say('Spend history, loyalty points, outstanding debt, last seen.'),
      hold(2600),
      wide(),
      down(580),
      say('Attach a customer at the till and it all updates itself.'),
      hold(2400),
    ],
  },
  {
    id: 'users',
    route: '/users',
    title: 'Staff and roles',
    blurb: 'User management and the fine-grained permission map.',
    group: 'People',
    open: ['Your team.', 'Exactly the access they need.'],
    steps: [
      say('Add staff and decide what each of them can reach.'),
      hold(1900),
      punch(1.22),
      say('Admin, manager and operator — then permission by permission on top.'),
      hold(2700),
      wide(),
      down(540),
      say('A cashier can ring up sales without ever seeing your margins.'),
      hold(2500),
    ],
  },
  {
    id: 'settings-branches',
    route: '/settings/branches',
    title: 'Branches',
    blurb: 'Multiple locations and the active-branch switcher.',
    group: 'People',
    open: ['More than one shop?', 'Same account.'],
    steps: [
      say('Every location is a branch under one business.'),
      hold(1800),
      punch(1.2),
      say('Stock, sales and staff are counted per branch.'),
      hold(2400),
      wide(),
      down(520),
      say('Switch branch and the whole app follows — even a sale recorded offline.'),
      hold(2600),
    ],
  },

  // ---------------------------------------------------------------- Insight
  {
    id: 'dashboard',
    route: '/dashboard',
    title: 'Dashboard',
    blurb: 'The opening screen — takings, profit, best sellers, peak hours.',
    group: 'Insight',
    open: ['Your whole business.', 'One screen.'],
    steps: [
      say('This is the first thing you see. Today, at a glance.'),
      hold(1800),
      punch(1.24),
      say('Takings, profit and what is selling — no report to run.'),
      hold(2600),
      wide(),
      down(620),
      say('Peak hours, category splits, best sellers.'),
      hold(2500),
      down(600),
      hold(2000),
      up(1220),
      hold(1200),
    ],
  },
  {
    id: 'reports',
    route: '/reports',
    title: 'Reports',
    blurb: 'Revenue, sales, average order value and the daily item report.',
    group: 'Insight',
    open: ['The deeper look.', 'When a glance is not enough.'],
    steps: [
      say('Revenue, order count and average order value over any period.'),
      hold(2200),
      punch(1.22),
      say('Sales over time, so a bad week is visible while it is still this week.'),
      hold(2700),
      wide(),
      down(600),
      say('Then the daily item report: exactly what left the shelf, and when.'),
      hold(2600),
      down(560),
      hold(1900),
    ],
  },
  {
    id: 'zen-ai',
    route: '/ai-insights',
    title: 'Zen AI',
    blurb: 'The chat surface itself — the composer, the tool status line, the answer.',
    group: 'Insight',
    open: ['41 tools.', 'Reads everything. Writes nothing without you.'],
    end: ['Zen AI', 'Reads everything. Writes nothing without you.', 'Try Zen AI'],
    steps: [
      say('Ask about your own shop in your own words.'),
      hold(1900),
      punch(1.2),
      say('Forty-one tools read your sales, stock, customers and margins.'),
      hold(2700),
      wide(),
      say('It can propose a change — a reorder, a price — but it cannot make one.'),
      hold(2700),
      say('You approve it. Then it happens. That boundary never moves.'),
      hold(2600),
    ],
  },
  {
    id: 'zen-use-cases',
    route: '/ai-insights/use-cases',
    title: 'Zen AI use cases',
    blurb: 'The worked examples of what to ask and what comes back.',
    group: 'Insight',
    open: ['What to ask it.', 'Worked examples.'],
    steps: [
      say('Not sure what to ask? Start from a real question.'),
      hold(1900),
      down(560),
      say('Trapped cash in slow stock. What to reorder. Which lines carry the margin.'),
      hold(2800),
      down(560),
      hold(2000),
      down(540),
      hold(2000),
    ],
  },
  {
    id: 'achievements',
    route: '/achievements',
    title: 'Achievements',
    blurb: 'Goals and milestones the shop has hit.',
    group: 'Insight',
    open: ['Progress worth noticing.', 'Milestone by milestone.'],
    steps: [
      say('Goals your shop is working towards, and the ones already behind you.'),
      hold(2200),
      punch(1.2),
      hold(2100),
      wide(),
      down(540),
      hold(2100),
    ],
  },

  // -------------------------------------------------------------------- Run
  {
    id: 'settings',
    route: '/settings',
    title: 'Settings',
    blurb: 'General, storefront, financials and system security.',
    group: 'Run',
    open: ['Set it up once.', 'Then forget it.'],
    steps: [
      say('Everything about how your shop runs, in four tabs.'),
      hold(2000),
      punch(1.2),
      say('Business details, storefront, financials, security.'),
      hold(2500),
      wide(),
      down(560),
      hold(2100),
    ],
  },
  {
    id: 'audit-log',
    route: '/audit-log',
    title: 'Audit log',
    blurb: 'Every change, by whom, when.',
    group: 'Run',
    open: ['Every change.', 'By whom, and when.'],
    steps: [
      say('Every change anyone makes is written down.'),
      hold(1900),
      punch(1.24),
      say('Who did it, what changed, and the exact moment.'),
      hold(2500),
      wide(),
      down(600),
      say('A price that moved overnight has a name against it.'),
      hold(2500),
    ],
  },
  {
    id: 'notifications',
    route: '/notifications',
    title: 'Notifications',
    blurb: 'Low stock, debts due, orders in — the things that need you.',
    group: 'Run',
    open: ['What needs you.', 'Before it becomes a problem.'],
    steps: [
      say('Low stock, debts coming due, new orders — they find you.'),
      hold(2300),
      punch(1.2),
      hold(2100),
      wide(),
      down(560),
      say('On the counter, on your phone, and on the desktop app.'),
      hold(2400),
    ],
  },
  {
    id: 'support',
    route: '/support',
    title: 'Support',
    blurb: 'Getting help without leaving the app.',
    group: 'Run',
    open: ['Stuck?', 'Help is in the app.'],
    steps: [
      say('Ask for help without leaving the shop floor.'),
      hold(1900),
      down(520),
      say('We answer in the app, with your account already in front of us.'),
      hold(2600),
      hold(1600),
    ],
  },
];

// ---------------------------------------------------------------- accessors

/** Turn a preset into the `Recipe` the builder and the recorder both speak. */
export function presetRecipe(p: Preset): Recipe {
  const card = (c: [string, string] | [string, string, string], ms: number): TitleCard => ({
    title: c[0],
    subtitle: c[1],
    cta: c[2],
    ms,
  });
  return {
    title: p.title,
    route: p.route,
    open: card(p.open, 2100),
    end: card(p.end ?? HOUSE_END, 2600),
    // Copied, not shared. The builder mutates the recipe it is handed, and a
    // preset that came back edited the second time you picked it would be a
    // genuinely baffling bug.
    steps: p.steps.map((s) => ({ ...s })),
  };
}

export function presetById(id: string): Preset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

/** Presets in picker order, bucketed by group. Empty groups are dropped. */
export function presetsByGroup(): { group: PresetGroup; presets: Preset[] }[] {
  return PRESET_GROUPS
    .map((group) => ({ group, presets: PRESETS.filter((p) => p.group === group) }))
    .filter((g) => g.presets.length > 0);
}

