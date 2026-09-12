/**
 * Flow scripts: coded click paths for the POS, inventory and Zen AI demos.
 *
 * The scripts talk to `Page`, which resolves a spec to a rect in the live DOM and
 * then fires real CDP input events at it. Nothing here touches React or Firebase
 * — every step is something a person could do with a mouse and keyboard.
 *
 * Selectors are written against what the app actually renders. Where a control
 * has readable text ("Next: Customer", "Quick Edit") the text is the selector;
 * `css` is the escape hatch for icon-only buttons, and each one below is pinned
 * to a class combination that is unique on its page — see the notes inline,
 * because "looks unique" is how a flow silently clicks the wrong thing.
 *
 * `ctx.commit` decides whether a flow performs its write. It defaults to false,
 * so a take against the wrong account cannot ring up a sale or change a stock
 * count; `--commit` opts in for the real demo footage, and the captions change
 * to match so the video never claims something that did not happen.
 *
 * **Title cards are not here.** They live in `FLOW_CARDS` below and are played by
 * `record.mjs`, the same way a recipe's are — one path for both kinds, so the
 * studio can edit the opening and closing screen of any recording without a flow
 * having to opt in.
 */

/**
 * The opening and closing screen of each coded flow.
 *
 * These are the first and last thing a viewer sees, so they are written as ad
 * copy rather than as labels: a claim on the open, the product name and a way to
 * act on the close. `record.mjs` plays them, and anything passed to `--cards`
 * (or set in the studio) overrides them per run — the wording is a marketing
 * decision that should not need a code change.
 */
export const FLOW_CARDS = {
  pos: {
    open: { title: 'Sell anywhere.', subtitle: 'Even offline.', ms: 1900 },
    end: { title: 'Sell anywhere. Even offline.', subtitle: 'Zeneva POS', cta: 'Start free', ms: 2600 },
  },
  inventory: {
    open: { title: 'Know what you have.', subtitle: 'Down to the last unit.', ms: 1900 },
    end: {
      title: 'Counts you can trust, on every device.',
      subtitle: 'Zeneva Inventory',
      cta: 'Start free',
      ms: 2600,
    },
  },
  zen: {
    open: { title: '41 tools.', subtitle: 'Reads everything. Writes nothing without you.', ms: 2000 },
    end: {
      title: 'Zen AI',
      subtitle: 'Reads everything. Writes nothing without you.',
      cta: 'Try Zen AI',
      ms: 2600,
    },
  },
  /*
   * The store trailer's own bookends.
   *
   * Shorter than the single-feature cards above, because this take has three more
   * of them inside it and a 60-second film cannot spend nine seconds on title
   * screens. The close is the only place in any of this footage that names a price
   * position — "Free to start" — and it is here because a store listing is the one
   * context where the viewer's next action is a decision about installing.
   */
  trailer: {
    open: { title: 'Sell anywhere.', subtitle: 'Even offline.', ms: 1200, motion: 'rise' },
    end: {
      title: 'Zeneva',
      subtitle: 'Retail, handled.',
      cta: 'Free to start',
      ms: 2200,
      motion: 'zoom',
    },
  },
};


/**
 * POS: select products → customer → payment → review (→ complete, with --commit).
 *
 * The add-to-cart control is icon-only. On this page four buttons carry `h-11`
 * (search, scan, filter, sort) but only the two product-card buttons combine
 * `h-11 w-11 rounded-lg` — one plain, one a units dropdown trigger — so that
 * triple is the anchor. Both add to cart, so hitting either is correct.
 *
 * The cart is a genuinely different control below `md`. On desktop it is a
 * sidebar that is always on screen with "Next: Customer" at its foot; on mobile
 * that whole card is `hidden md:block` and the cart lives in a bottom sheet
 * behind a fixed "View Cart (n)" bar. Same button text at the end, one extra tap
 * to reach it — so the flow branches on `page.device.mobile` rather than
 * pretending the two layouts are one. Asking for "Next: Customer" on a phone
 * without opening the sheet first times out after 20s, which is how this was
 * found.
 */
export async function posFlow(page, ctx = {}) {
  const ADD = 'button[class*="h-11"][class*="w-11"][class*="rounded-lg"]';
  const mobile = page.device.mobile;

  await page.goto('/sales/pos/select-products');
  await page.caption('Tap to add. Stock and totals update instantly.', 4200);

  // Wait for the grid before framing it. `punch` gives an anchor 1.5s and then
  // gives up, because a camera move is decoration and must never cost the run —
  // but that budget is for a page already on screen, and here the products are
  // still arriving. The first click needs the same element anyway, so this waits
  // for something the flow was about to wait for regardless.
  await page.find({ css: ADD, nth: 0 });

  // Punch in on the grid before the first tap, so the viewer sees *what* is
  // being added rather than a cursor crossing a wall of cards. 1.3 is the
  // ceiling worth using: the camera is an upscale of captured frames, not a
  // re-render, and past about 1.5 the text goes soft. See Page.punch.
  await page.punch({ css: ADD, nth: 0 }, { to: 1.3 });
  await page.click({ css: ADD, nth: 0 });
  await page.hold(200);
  await page.click({ css: ADD, nth: 1 });
  await page.hold(200);
  await page.click({ css: ADD, nth: 2 });
  await page.hold(500);

  if (mobile) {
    // The running total lives on the bar itself, so this is the mobile version
    // of the cart payoff — and the bar is the thing being tapped next.
    await page.punch({ text: 'View Cart', exact: false }, { to: 1.24, ms: 700 });
    await page.hold(600);
    await page.caption('');
    await page.click({ text: 'View Cart', exact: false }, { settle: 1100 });
    // The sheet animates up over 500ms and its footer button is the target, so
    // going wide here is both the right frame and the right pause.
    await page.wide({ ms: 620 });
    await page.hold(900);
  } else {
    // Out to the cart, which is the payoff of the three taps — the totals the
    // caption just promised would update.
    await page.punch({ text: 'Next: Customer', exact: true }, { to: 1.22, ms: 700 });
    await page.hold(700);
    await page.caption('');
  }

  await page.clickTo({ text: 'Next: Customer', exact: true }, '/sales/pos/customer', { settle: 1300 });

  await page.caption('Attach a customer, or keep the queue moving without one.', 3600);
  await page.hold(900);
  await page.caption('');
  await page.clickTo({ text: 'Next: Payment', exact: true }, '/sales/pos/payment', { settle: 1200 });

  await page.caption('Cash, card, transfer or invoice — all in one step.', 4000);
  // Each payment tile is <Label htmlFor="cash|card|bank|invoice"> wrapping a Card
  // whose RadioGroupItem is sr-only, so the label is the real click target.
  await page.punch({ css: 'label[for="cash"]' }, { to: 1.28, ms: 720 });
  await page.click({ css: 'label[for="cash"]' }, { settle: 500 });
  await page.hold(600);
  await page.caption('');
  // "Review & Complete" unless the business has autoPrint on, in which case the
  // same button reads "Finalize & Print".
  await page.clickAny(
    [
      { text: 'Review & Complete', exact: true },
      { text: 'Finalize & Print', exact: true },
    ],
    { settle: 0 },
  );
  await page.waitForPath('/sales/pos/review');
  await page.hold(1200);

  await page.caption('Every line, every total — checked before anything is saved.', 3800);
  // The totals block is what the caption is pointing at, so frame it. `punch`
  // silently does nothing if no total is on screen, which is the right failure:
  // the take continues wide rather than dying over a camera move.
  await page.punch({ text: 'Total', exact: false }, { to: 1.26, ms: 800 });
  await page.hold(1200);

  if (ctx.commit) {
    await page.caption('');
    // Cash/card/transfer finalise as "Complete Sale"; an Invoice sale renames the
    // same button to "Issue Professional Invoice".
    await page.clickAny(
      [
        { text: 'Complete Sale', exact: true },
        { text: 'Issue Professional Invoice', exact: true },
      ],
      { settle: 2600 },
    );
    await page.caption('Sale recorded. Receipt ready. Stock deducted. Books balanced.', 3800);
    await page.hold(1800);
  } else {
    await page.caption('One tap finalises it: receipt printed, stock deducted, books balanced.', 4200);
    await page.hold(1400);
  }
  await page.caption('');
}

/** Routes each flow visits, so they can be compiled before the camera rolls. */
export const FLOW_ROUTES = {
  pos: [
    '/sales/pos/select-products',
    '/sales/pos/customer',
    '/sales/pos/payment',
    '/sales/pos/review',
  ],
  inventory: ['/inventory'],
  zen: ['/ai-insights'],
  trailer: [
    '/sales/pos/select-products',
    '/sales/pos/customer',
    '/sales/pos/payment',
    '/inventory',
    '/ai-insights',
  ],
};

/**
 * Inventory: search → Inventory Health tab → Low Stock filter → Quick Edit.
 *
 * There is no inline stock editor on this page. Stock is changed through the
 * row's ⋯ menu → Quick Edit → dialog, which is also the better shot: it ends on
 * the toast that explains the write is queued and will land when you are online.
 */
export async function inventoryFlow(page, ctx = {}) {
  await page.goto('/inventory');
  await page.caption('Search your whole catalogue — instantly, and offline.', 3800);

  // The search box is at the top of a long page, so a punch here both makes the
  // typing legible and keeps the results list in shot as it filters.
  await page.punch({ placeholder: 'Search products' }, { to: 1.2, ms: 680 });
  await page.fill({ placeholder: 'Search products' }, 'sh', { clear: true, settle: 1400 });
  await page.hold(900);
  await page.press('Backspace');
  await page.press('Backspace');
  await page.hold(900);
  await page.wide({ ms: 640 });

  await page.caption('Inventory Health finds the problems before a customer does.', 4000);
  await page.click({ text: 'Inventory Health', exact: false, tag: 'button' }, { settle: 1100 });
  await page.hold(700);

  // The four health tiles are Cards with no button role; their text comes from
  // i18n (`inventory.healthLowStock` = "Low Stock (≤5)"), so match the stable
  // English prefix rather than the parenthetical.
  //
  // Frame the tiles before the click. They are the whole point of the tab and
  // they are small — at 1080p a health tile's number is barely legible on a
  // phone, which is where most of this footage gets watched.
  await page.punch({ text: 'Low Stock', exact: false }, { to: 1.32, ms: 780 });
  await page.click({ text: 'Low Stock', exact: false }, { settle: 1200 });
  await page.caption('');
  await page.hold(500);
  await page.wide({ ms: 700 });
  await page.hold(500);

  await page.caption('Fix a count in two taps. No forms, no page reload.', 4000);
  // Radix sets aria-haspopup="menu" on the row's ⋯ trigger — stable across
  // icon renames, unlike the lucide class on the glyph inside it.
  await page.punch({ css: 'tbody [aria-haspopup="menu"]', nth: 0 }, { to: 1.3, ms: 720 });
  await page.click({ css: 'tbody [aria-haspopup="menu"]', nth: 0 }, { settle: 700 });
  await page.click({ text: 'Quick Edit', exact: true }, { settle: 1100 });
  // The dialog is centred and modal; a camera still parked on the row it came
  // from would frame the overlay's blur instead of the fields being typed into.
  await page.wide({ ms: 520 });

  // Dialog fields in order: Price, Cost Price, Stock. Scoped to the dialog so a
  // number input on the page behind it can never be picked up instead.
  await page.punch({ css: '[role="dialog"] input[type="number"]', nth: 2 }, { to: 1.34, ms: 700 });
  await page.fill(
    { css: '[role="dialog"] input[type="number"]', nth: 2 },
    '46',
    { clear: true, delay: 150, settle: 700 },
  );
  await page.hold(600);
  await page.wide({ ms: 640 });

  if (ctx.commit) {
    await page.click({ text: 'Save Changes', exact: true }, { settle: 2200 });
    await page.caption('Saved offline, synced the moment you reconnect.', 3800);
  } else {
    await page.caption('Saved offline, synced the moment you reconnect.', 3800);
    await page.hold(1500);
    await page.click({ text: 'Cancel', exact: true }, { settle: 1200 });
  }
  await page.hold(1600);
  await page.caption('');
}

/**
 * Zen AI: ask a real question, watch real tools run against real data.
 *
 * The composer swaps placeholder once the thread opens ("Ask anything about your
 * business..." → "Ask Zen AI..."), which is the one reliable signal that the
 * message was actually sent — the status line cycles through generic copy until
 * a tool starts, so waiting on any particular status text is a coin flip.
 */
export async function zenFlow(page) {
  await page.goto('/ai-insights');
  await page.caption('Ask anything about your business.', 3400);

  // In on the composer while the question is typed — this is the one moment in
  // the take where the words on screen are the whole content of the shot.
  await page.punch({ placeholder: 'Ask anything about your business' }, { to: 1.26, ms: 700 });
  await page.fill(
    { placeholder: 'Ask anything about your business' },
    'Which products are about to run out?',
    { enter: true, delay: 62, settle: 900 },
  );

  await page.caption('It reads your live data — never a guess, never a generic answer.', 5200);
  await page.find({ placeholder: 'Ask Zen AI' }, { timeoutMs: 30_000 });
  // Back out for the answer. The reply streams top-down and the tool-status line
  // runs above it, so anything tighter than the full frame loses half of what
  // makes this shot worth having.
  await page.wide({ ms: 760 });
  await page.hold(10_500);

  await page.caption('Zen AI proposes. Nothing is written until you approve it.', 4200);
  await page.hold(2200);
  await page.caption('');
}

/**
 * Close anything the app decided to celebrate.
 *
 * `<AchievementCelebration />` is mounted in `(app)/layout.tsx`, so it can appear
 * over *any* page — and the recorder is the worst case for it. Every take runs in a
 * throwaway Chrome profile, so `zeneva_ach_seen_<businessId>` is always empty; the
 * first-run seeding that normally keeps an existing shop quiet is racing the data
 * it seeds from, and when it loses, real milestones arrive as fresh unlocks. This
 * take hit "₦1 Million in Sales" over the product grid on the second run of an
 * otherwise identical flow, and the click failed with "covered by div (pinned)".
 *
 * Escape rather than a button: the card is a Radix `<Dialog open onOpenChange>`, so
 * Escape resolves to the same `onDismiss` the close button calls, and it needs to
 * know nothing about the copy on it — which is i18n'd into eleven languages and
 * would make this a translation-dependent selector.
 *
 * Pressed more than once because the unlock queue holds one card per ladder, and a
 * fresh profile can have several ready at once. Cheap and idempotent: with no
 * dialog open, Escape does nothing at all.
 */
export async function dismissCelebrations(page, times = 2) {
  for (let i = 0; i < times; i++) {
    await page.press('Escape');
    await page.hold(140);
  }
}

/**
 * The Microsoft Store trailer: one continuous 60-second take across three features.
 *
 * ## Why this is a coded flow and not a recipe
 *
 * Recipes exist so a new video does not need new code, and most videos should be
 * recipes. This one cannot be. It needs `clickAny` — the POS finalise button is
 * named by a business setting, and a recipe has no way to say "whichever of these
 * two exists" — and it needs to cross four routes while holding a time budget,
 * which is exactly the domain knowledge the top of this file says stays coded.
 *
 * ## The budget is the design constraint
 *
 * Microsoft recommends 60 seconds or less, and the runner plays a title card at
 * each end of whatever this function does, so the body has about 52 seconds. Three
 * features and two interstitial slides fit in that only if every hold is deliberate,
 * which is why the numbers below are small and odd rather than round. The single
 * biggest cost is the Zen AI answer — a real model call against real data takes as
 * long as it takes — so it is last, where a long tail can be cut without losing a
 * transition.
 *
 * Two things are deliberately *not* in the film. There is no review-and-complete
 * step: it is the most convincing shot in the POS flow and it costs four seconds
 * plus a conditional, and this take needs the seconds more than it needs the shot.
 * And nothing here writes — the flow takes no `ctx.commit`, so the trailer is
 * repeatable and its captions never claim a sale was rung up. A store listing is
 * the wrong place to find out that the demo shop's stock drifts every time
 * marketing re-shoots.
 *
 * ## The captions are three scripts at once
 *
 * Each `page.caption()` here becomes the on-screen subtitle, the voice-over line
 * (`--narrate` speaks the caption track), and a cue in the `.vtt` closed-caption
 * file Partner Center asks for. So they are written to be *spoken* — short clauses,
 * no parentheses, no slashes — and not just to be read.
 */
export async function trailerFlow(page) {
  const ADD = 'button[class*="h-11"][class*="w-11"][class*="rounded-lg"]';

  /* ---- Sell: three taps, a customer, a payment. ---------------------------- */

  await page.goto('/sales/pos/select-products');
  // Before the caption, so a milestone card cannot be the trailer's opening shot.
  await dismissCelebrations(page);
  await page.caption('Ring up a sale in seconds.', 3000);

  // Wait for the grid before framing it, exactly as posFlow does: `punch` gives an
  // anchor 1.5s and then gives up, and on a cold production route the products are
  // still arriving. The first click needs this element anyway.
  await page.find({ css: ADD, nth: 0 });
  await page.punch({ css: ADD, nth: 0 }, { to: 1.28, ms: 620 });

  // 240ms between taps rather than posFlow's 200-500. Fast enough to read as one
  // gesture, slow enough that three separate cart animations are visible — at a
  // shorter interval they overlap and it looks like one item was added.
  await page.click({ css: ADD, nth: 0 }, { settle: 240 });
  await page.click({ css: ADD, nth: 1 }, { settle: 240 });
  await page.click({ css: ADD, nth: 2 }, { settle: 300 });

  // No second punch out to the cart before this click. Measured: every click in
  // this flow carries about 1.2s of its own overhead — find, scroll-into-view,
  // hit-test, cursor travel — so a camera move whose only job is to frame the
  // button about to be pressed costs more of the 60s budget than it earns.
  await page.caption('');
  await page.clickTo({ text: 'Next: Customer', exact: true }, '/sales/pos/customer', { settle: 900 });

  /*
   * The customer step gets a beat, not a caption.
   *
   * It had one, and the hidden navigation below is why it cannot: `goto` keeps a
   * page load out of the film, which compresses the finished timeline while the
   * caption marks are stamped in wall clock. The customer line landed at 18.16s and
   * the payment line at 18.67s — a 2.6s overlap, two subtitles stacked, and two
   * `.vtt` cues the clamp had to throw away.
   *
   * So one caption covers both screens, and it is written to be true of the one it
   * is actually over: the payment step is where "with or without a customer" is a
   * visible fact rather than a claim.
   */
  await page.hold(600);

  /*
   * Routed rather than clicked, and this one is measured.
   *
   * `clickTo` films the wait: the click lands, the payment step mounts, and the film
   * sits on it. On this account that navigation took **13.4 seconds** of finished
   * trailer — a fifth of the whole budget spent watching a page arrive, because the
   * payment step loads its own chunk and reads before it is interactive.
   *
   * `goto` performs the same navigation, but the recorder holds the camera through a
   * page load and keeps it out of the film, so the cut goes from the customer step to
   * a payment screen that is already up. Nothing is faked — same route, same data,
   * same screen a cashier reaches by pressing the button. What is removed is the
   * loading, which no trailer should sell.
   */
  await page.goto('/sales/pos/payment');

  await page.caption('Cash, card, transfer or invoice — with or without a customer.', 3200);
  // Each payment tile is <Label htmlFor="cash|card|bank|invoice"> wrapping a Card
  // whose RadioGroupItem is sr-only, so the label is the real click target.
  await page.punch({ css: 'label[for="cash"]' }, { to: 1.26, ms: 480 });
  await page.click({ css: 'label[for="cash"]' }, { settle: 380 });
  await page.hold(420);
  await page.caption('');

  /* ---- Slide, then stock. ------------------------------------------------- */

  // No `wide` before the card: the card is full-screen, so pulling the camera back
  // first is a move nobody sees. The punch is released by the next `goto` anyway.
  await page.card({
    title: 'Know what you have.',
    subtitle: 'Down to the last unit.',
    ms: 1500,
    motion: 'wipe',
  });
  // The card covers the route change, which is the point of putting it here rather
  // than between two shots of the same page: the inventory page mounts behind it.
  await page.goto('/inventory');
  await page.clearCard();

  /*
   * The search box is deliberately not filmed.
   *
   * `inventoryFlow` types into it, deletes two characters and waits — six seconds
   * for "the list filters as you type", which every app on the store also does. It
   * was the first thing cut when this came in at 78s: the Inventory Health tab is
   * the shot nobody else has, and it needed the room.
   */
  await page.caption('Inventory Health finds the problems first.', 3000);
  await page.click({ text: 'Inventory Health', exact: false, tag: 'button' }, { settle: 800 });
  // The four health tiles come from i18n (`inventory.healthLowStock` = "Low Stock
  // (≤5)"), so match the stable English prefix, not the parenthetical. They are
  // small — at 1080p the number on a tile is barely legible on a phone, which is
  // where most of this footage gets watched.
  await page.punch({ text: 'Low Stock', exact: false }, { to: 1.32, ms: 620 });
  await page.hold(300);
  await page.click({ text: 'Low Stock', exact: false }, { settle: 800 });
  await page.hold(250);
  await page.caption('');

  /* ---- Slide, then the differentiator. ------------------------------------ */

  await page.card({
    title: 'Zen AI',
    subtitle: 'Reads everything. Writes nothing without you.',
    ms: 1500,
    motion: 'split',
  });
  await page.goto('/ai-insights');
  await page.clearCard();

  await page.caption('Ask about your own shop, in your own words.', 3000);
  // In on the composer while the question is typed. This is the one moment in the
  // take where the words on screen are the whole content of the shot.
  await page.punch({ placeholder: 'Ask anything about your business' }, { to: 1.24, ms: 560 });
  await page.fill(
    { placeholder: 'Ask anything about your business' },
    'Which products are about to run out?',
    { enter: true, delay: 46, settle: 600 },
  );

  // The composer's placeholder swaps once the thread opens ("Ask anything about
  // your business..." → "Ask Zen AI..."), which is the one reliable signal that the
  // message was actually sent — the status line cycles generic copy until a tool
  // starts, so waiting on any particular status text is a coin flip.
  await page.find({ placeholder: 'Ask Zen AI' }, { timeoutMs: 30_000 });
  // Back out for the answer: the reply streams top-down with the tool-status line
  // above it, and anything tighter than the full frame loses half the shot.
  await page.wide({ ms: 560 });
  await page.caption('It reads your live data. Never a guess.', 3200);
  /*
   * 3700, and it is the spoken length that sets it, not the pacing.
   *
   * A caption is also a voice-over line, and `narrate.mjs` places each line at the
   * instant its caption appeared — so two captions closer together than the first
   * one takes to *say* produce two voices talking at once. This pair did: measured
   * 63.64→67.06 against a next line starting at 66.33, a 0.73s double-take that the
   * `.vtt` clamp hid and the audio did not.
   *
   * The line runs 3.42s in SAPI's David. Any hold under that is a bug you can only
   * hear, so when a caption is edited, check the measured length with
   * `store.mjs --scaffold` rather than guessing from the word count.
   */
  await page.hold(3700);

  await page.caption('It proposes. You approve. Then it happens.', 3200);
  await page.hold(900);
  await page.caption('');
}

export const FLOWS = { pos: posFlow, inventory: inventoryFlow, zen: zenFlow, trailer: trailerFlow };