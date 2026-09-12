/**
 * Audio descriptions: the picture, in words, for someone who cannot see it.
 *
 * Microsoft's listing takes two accessibility files per trailer and they are not
 * the same file twice. Closed captions are the *audio* in text, for someone who
 * cannot hear it — and those need no writing at all, because the caption track the
 * recorder already burns into the film is the script. An audio description is the
 * *visual* in audio, for someone who cannot see it, and nothing in the pipeline
 * knows what the screen looks like. So this is the one part of the trailer that is
 * written by hand.
 *
 * ## What a description is allowed to say
 *
 * Only what is on screen. That sounds obvious and it is the entire discipline: the
 * temptation is to write marketing copy, because marketing copy is what the rest of
 * the trailer is made of. "Zeneva makes stocktaking effortless" is an advertisement;
 * "a table of products, three of them flagged in amber" is a description. Somebody
 * relying on this track is trying to follow the film, not be sold to — and they are
 * already getting the sales pitch, because the narration is playing too.
 *
 * Three rules follow from that:
 *
 * - **Never restate the narration.** It is audible. A description that repeats it
 *   wastes the only silence there is.
 * - **Name the slides.** A full-screen title card is pure text: it is the one thing
 *   in the film that is *completely* invisible without this track. Every card gets
 *   a description, and it quotes the card.
 * - **Say what changed, not what it means.** "The total jumps to eighteen thousand
 *   naira" — not "the total updates instantly", which is the caption's job.
 *
 * ## Why the times are hard numbers
 *
 * `at` is seconds into the finished film, and they are the numbers they are because
 * the film was measured. `node scripts/record/store.mjs <take> --scaffold` prints
 * the caption track and every silence between the spoken lines; each `at` below sits
 * inside one of those gaps with room for the sentence to finish.
 *
 * That makes them fragile in an honest way. Re-time the flow and these are wrong —
 * so `store.mjs` re-checks every one against the take it is building for and refuses
 * to place a description that would talk over the narration, naming the line it
 * would have collided with. A stale number is reported, never quietly shifted:
 * moving a description to where it fits puts it over a different shot, and a
 * description of the wrong shot is worse than a gap.
 */

/**
 * Keyed by flow id — the same ids `--flow` takes, so a take carries its own
 * description script in `marks.flow` and `store.mjs` needs to be told nothing.
 */
export const AUDIO_DESCRIPTIONS = {
  /*
   * The 60-second Microsoft Store trailer. Six descriptions.
   *
   * Every `at` sits inside a gap `store.mjs --scaffold` measured on the finished
   * take, with room for the sentence to end before the next line of narration
   * starts. The lengths are budgeted at **2.1 words per second**, which is what SAPI's
   * David actually measures at rate -1 — not the 2.6 the first draft assumed, and the
   * reason four of these are shorter than they want to be.
   *
   * Both interstitial slides are named inside a description of the screen that
   * follows them, rather than getting one of their own. That is not tidiness: the
   * gap the "Know what you have" card plays in is 2.12 seconds long, which is the
   * card's own duration, and there is no room in it for a sentence about it. A slide
   * is pure text, so it is the one thing in the film that is *completely* invisible
   * without this track — folding it into the next description is how it still gets
   * said.
   *
   * The payment step gets nothing, because its caption already names all four tiles
   * out loud. A description there would be the narration repeated over itself.
   */
  trailer: [
    { at: 0.30, text: 'Title: sell anywhere, even offline.' },
    { at: 6.55, text: 'A point of sale screen, with a grid of product cards showing photo, price and stock.' },
    { at: 14.60, text: 'Three items drop into the cart, and the total climbs with each one.' },
    { at: 21.10, text: 'Then the customer step.' },
    { at: 34.95, text: 'A slide read: know what you have. Now the inventory table.' },
    { at: 45.30, text: 'Slide: Zen AI. A chat panel; a question is typed, an answer appears.' },
  ],
};
