/**
 * The cinematic backdrop: a warm gradient ground, and the mask that dissolves
 * product imagery into it instead of ending it on a line.
 *
 * ## Where these numbers come from
 *
 * They are measured, not invented. The reference is a 720x960 promo the owner
 * supplied; the values below are its geometry transposed to Zeneva orange.
 *
 * The recipes, so a future change can re-derive rather than guess:
 *
 *   # a column of real pixels, averaged to 24 vertical samples
 *   ffmpeg -v error -ss 10 -i ref.mp4 -frames:v 1 \
 *     -vf "crop=3:960:359:0,scale=1:24:flags=area,format=rgb24" -f rawvideo - | xxd -c 3
 *
 *   # how much of the file is actually animating, vs repeated frames
 *   ffmpeg -i ref.mp4 -vf mpdecimate -f null -      # kept frames / total
 *
 * Sample two columns, not one: through the content, and through bare background.
 * They answer different questions and mixing them up sends you after the wrong
 * bug.
 *
 * ## The one rule that matters: pin the dominant channel
 *
 * The reference fades a near-white screenshot into a pale blue ground, and the
 * reason it reads as clean rather than muddy is that its *blue* channel barely
 * moves across the fade — B sits at ~250 on both sides, so only R and G travel
 * (R 246->224, G 248->236). Nothing has to pass through grey on the way.
 *
 * Fade a colour into a colour without that alignment and the midpoint goes
 * flat and dirty, which is the usual tell of a hand-rolled gradient mask.
 *
 * Orange is the mirror of that: the dominant channel is *red*, so every value
 * here keeps R pinned in the 250-253 band and moves G and B instead. That is
 * also why `WARM_WHITE` exists — a cool white (#F3F5F9, the reference's own
 * screen colour) has its *blue* highest, so fading it into an orange ground
 * would move all three channels and undo the trick. Content that will sit over
 * this backdrop should sit on `WARM_WHITE`.
 *
 * Derived at the brand hue: `--primary: 22 90% 55%` in `globals.css`, the same
 * orange `overlay.js` already paints as `rgba(244,113,37,...)`. Holding hue and
 * saturation and moving only lightness is what keeps R pinned for free.
 */

/**
 * The ground, top to bottom.
 *
 * `mid` is deliberately the *deepest* of the three and sits mid-frame rather
 * than at an edge. The reference's ground is not a linear ramp — sampling its
 * bare left edge gives light at the top, deepest through the middle band, then
 * flat and slightly lighter through the bottom third. That is a soft radial
 * glow, and it is most of why the frame looks lit rather than filled. A plain
 * `linear-gradient(top, light, dark)` is the thing this is avoiding.
 */
export const BACKDROP = {
  /** Frame top. */
  top: '#FDF6EF',
  /** The deepest band, around `GLOW_CENTRE` down the frame. */
  mid: '#FDE6D6',
  /** Flat through the caption area, so text has an even ground to sit on. */
  bottom: '#FCF0E6',
} as const;

/**
 * What a dissolving edge lands on.
 *
 * Slightly deeper than `BACKDROP.bottom` so the dissolve reads as the image
 * *settling into* the ground rather than vanishing at exactly ground level.
 * R=250 against `WARM_WHITE`'s R=249 is the pinned channel: across the whole
 * fade red moves one point while green moves nine and blue nineteen.
 */
export const FADE_SETTLE = '#FAECE0';

/**
 * The white content should sit on to fade cleanly into `BACKDROP`.
 *
 * Warm — red highest. See the header: a cool white defeats the pinned channel.
 */
export const WARM_WHITE = '#F9F5F3';

/**
 * Where the radial glow is centred, as a fraction down the frame.
 *
 * 0.38 rather than 0.5 because the deepest band wants to land behind the
 * *product*, above the caption block, which is where a viewer's eye already is.
 */
export const GLOW_CENTRE = 0.38;

/**
 * The dissolve, as fractions of frame height.
 *
 * Measured off the reference: its phone screen holds solid to y=555/960 and has
 * fully become ground by y=615/960. That is 0.578 to 0.641 — a 6% band. Short
 * enough that almost no product area is lost, long enough that the eye reads
 * atmosphere rather than an edge.
 *
 * `solid` is where the mask is still fully opaque; `clear` is where it has
 * finished. Everything between is the ramp.
 */
export const FADE = { solid: 0.578, clear: 0.641 } as const;

/**
 * Caption metrics, as fractions of frame height.
 *
 * The reference pins these for its whole run and never moves them — the block
 * is one fixed overlay composited over every scene, which is what lets the top
 * of the frame carry violent motion without the piece feeling unstable. Treat
 * them as a layout contract, not as suggestions.
 */
export const CAPTION = {
  /** Headline baseline. */
  headline: 0.68,
  /** Sub-line baseline. */
  sub: 0.77,
  /** The small pill, if there is one. */
  cta: 0.88,
} as const;

/**
 * The ground as a CSS `background` value.
 *
 * Two layers, and the order matters: a radial glow over a linear base. The
 * radial alone cannot hold the bottom third flat, and the linear alone cannot
 * put the deepest band in the middle — see `BACKDROP.mid`.
 *
 * @param h  frame height in px, for the glow's vertical radius. Fractions of a
 *           percentage are fine, so this is only needed to keep the glow round
 *           on very wide or very tall frames.
 */
export function backdropCss(): string {
  return [
    `radial-gradient(ellipse 120% 55% at 50% ${(GLOW_CENTRE * 100).toFixed(1)}%,`
      + ` ${BACKDROP.mid}, transparent 70%)`,
    `linear-gradient(180deg, ${BACKDROP.top} 0%, ${BACKDROP.mid} ${(GLOW_CENTRE * 100).toFixed(1)}%,`
      + ` ${BACKDROP.bottom} ${(FADE.clear * 100).toFixed(1)}%, ${BACKDROP.bottom} 100%)`,
  ].join(', ');
}

/**
 * The dissolve as a CSS mask value, for the element holding the product imagery.
 *
 * Applied as a mask rather than as a gradient *over* the image on purpose: an
 * overlaid gradient has to know the ground colour and stops being right the
 * moment the ground changes, while a mask lets whatever is behind show through
 * and is correct by construction.
 */
export function fadeMaskCss(): string {
  return `linear-gradient(180deg, #000 0%, #000 ${(FADE.solid * 100).toFixed(1)}%,`
    + ` transparent ${(FADE.clear * 100).toFixed(1)}%, transparent 100%)`;
}
