/*
 * scene.js — the cinematic compositor.
 *
 * Injected into a blank page and driven from `page.mjs` the same way `overlay.js`
 * is: the source is read at import time, evaluated once per document, and then
 * poked with small `zen(...)` expressions. Nothing here is bundled and nothing
 * here imports — it has to survive being pasted into a CDP evaluate string.
 *
 * ## What this file is for
 *
 * A screen recording of a web app cannot be smooth. A browser only paints when
 * the page changes, so every still moment repeats the last frame — takes in
 * `marketing-out/` measure 21-50% unique frames against a 30fps container, and
 * that gap is what reads as stutter. The reference promo this scene is modelled
 * on measures 97%, because it was rendered rather than sampled.
 *
 * So this scene does not record the app. It holds *stills* of the app and
 * animates them, on a `requestAnimationFrame` loop that moves something every
 * single frame. The sampler in `capture.mjs` then has a genuinely new paint to
 * take each tick, and unique-frame count goes where it needs to be.
 *
 * ## Two consequences worth understanding before editing
 *
 * The camera lives *here*, not in ffmpeg. `zoompan` crops on integer pixels, so a
 * slow drift rounds to the same origin for several frames and then jumps — the
 * filter meant to add motion adds judder. A CSS transform is sub-pixel. Encoding
 * a cinematic take must therefore pass `zooms: []`, or the two cameras fight.
 *
 * And a punch-in here is a *downscale* of a 2x still rather than an upscale of
 * captured pixels, so text stays sharp at any zoom. That is the failure described
 * in `Page.punch` — "past about 1.5x that starts to read as soft" — and it is the
 * main reason this exists rather than a nicer `zoompan` expression.
 *
 * ## The drift is load-bearing, not decoration
 *
 * `DRIFT` never stops, including during a hold. If it did, a hold would go
 * pixel-identical and the file would start repeating frames again exactly like
 * the plain path. It is deliberately slow enough to read as "the shot is alive"
 * rather than as movement.
 */

/* eslint-disable */
(function () {
  if (window.__zenScene) return;

  /*
   * Mirror of `BACKDROP`/`FADE`/`CAPTION`/`GLOW_CENTRE` in
   * `src/lib/marketing/backdrop.ts`, which is the source of truth and carries the
   * derivation. Duplicated because the recorder is `.mjs` run by node and cannot
   * import a `.ts` module — the same reason `FLOW_CARD_DEFAULTS` mirrors
   * `FLOW_CARDS`. Keep the two in step; a drift here shows up as a recorded take
   * that does not match the live site.
   *
   * The one rule, if you change a colour: R stays pinned in the 250-253 band. The
   * fade is clean because red barely moves across it while green and blue do, so
   * nothing passes through grey. Break that and the dissolve goes muddy.
   */
  var TOKENS = {
    top: '#FDF6EF',
    mid: '#FDE6D6',
    bottom: '#FCF0E6',
    warmWhite: '#F9F5F3',
    glowCentre: 0.38,
    fade: { solid: 0.578, clear: 0.641 },
    caption: { headline: 0.68, sub: 0.77, cta: 0.88 },
  };

  /** Cubic ease-out. The same curve `moveExpr` emits, so both cameras agree. */
  function ease(u) {
    var t = u < 0 ? 0 : u > 1 ? 1 : u;
    return 1 - Math.pow(1 - t, 3);
  }

  function lerp(a, b, u) { return a + (b - a) * u; }

  /**
   * The never-stopping camera breath.
   *
   * Two sines at incommensurable periods so the path does not visibly loop inside
   * a 60s take. Amplitudes are in the fractions of a percent that read as depth
   * without anyone noticing a movement — big enough that every frame differs,
   * which is the actual job.
   */
  var DRIFT = {
    scale: function (t) { return 1 + 0.012 * Math.sin(t / 7.3); },
    x: function (t) { return 0.9 * Math.sin(t / 11.1); },
    y: function (t) { return 0.7 * Math.cos(t / 8.7); },
    rot: function (t) { return 0.25 * Math.sin(t / 13.7); },
  };

  function el(tag, css) {
    var n = document.createElement(tag);
    if (css) n.setAttribute('style', css);
    return n;
  }

  var pct = function (n) { return (n * 100).toFixed(2) + '%'; };

  /**
   * Where a still is centred, as a fraction down the frame.
   *
   * Not 0.5. The caption owns everything from `caption.headline` (0.68) down and
   * the dissolve finishes at `fade.clear` (0.641), so the band a still is actually
   * *seen* in is 0 to 0.64 — whose centre is 0.32. Nudged to 0.36 so a
   * normally-proportioned still overhangs the dissolve slightly and melts into the
   * ground, which is the effect, rather than stopping short of it and floating.
   */
  var SHOT_CENTRE = 0.36;

  var Scene = {
    root: null,
    stage: null,
    capNode: null,
    shots: [],
    beats: [],
    raf: 0,
    startedAt: 0,

    /**
     * Build the DOM. Idempotent — a second call rebuilds, because a navigation
     * wipes the document and the recorder re-injects.
     *
     * Mounted as an opaque full-bleed layer *over* the app rather than in a blank
     * document of its own. Three reasons, in order of how much they cost to get
     * wrong: the app's webfonts are already loaded in this document, and a caption
     * set in a fallback face is the first thing that makes a take look cheap;
     * `overlay.js` and its cursor stay live underneath, so nothing about the
     * existing machinery has to know this file exists; and there is no navigation,
     * so no reload, no re-login, no re-warm.
     *
     * The app keeps running under here. That is fine — it is completely covered,
     * and a paint nobody can see cannot reach the file.
     *
     * The layer order is the whole design and is not arbitrary:
     *
     *   ground   the warm gradient, full bleed
     *   stage    the stills, in 3D, masked so their bottom edge dissolves
     *   caption  fixed text, never moves for the length of the take
     *
     * The stills are masked rather than having a gradient painted over them. An
     * overlaid gradient has to know the ground colour and stops being correct the
     * moment the ground changes; a mask lets the ground show through and is right
     * by construction.
     */
    mount: function (opts) {
      var o = opts || {};
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);

      /*
       * Nothing is written to `documentElement` or `body`. An earlier draft set
       * `overflow:hidden` and a background on them, which is exactly the kind of
       * mutation that outlives the scene: `unmount` would have to remember the
       * previous values, and the app would be left subtly altered for the rest of
       * the take if it did not. The layer is opaque and `position:fixed`, so it
       * needs neither.
       */
      var root = el('div',
        'position:fixed;inset:0;overflow:hidden;z-index:2147483000;'
        + 'font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;'
        + 'background:'
          + 'radial-gradient(ellipse 120% 55% at 50% ' + pct(TOKENS.glowCentre) + ','
          + TOKENS.mid + ',transparent 70%),'
          + 'linear-gradient(180deg,' + TOKENS.top + ' 0%,' + TOKENS.mid + ' '
          + pct(TOKENS.glowCentre) + ',' + TOKENS.bottom + ' '
          + pct(TOKENS.fade.clear) + ',' + TOKENS.bottom + ' 100%);');

      /*
       * `perspective` on the wrapper rather than on each still, so every still
       * shares one vanishing point. Per-element perspective gives each its own,
       * which is what makes a 3D scene look like unrelated skewed rectangles.
       *
       * Full-bleed, and that matters: the mask stops are fractions of *frame*
       * height, because that is how they were measured. Sizing this to
       * `fade.clear` instead — which an earlier draft did — makes them fractions
       * of 64% of the frame, and the dissolve lands at 41% and eats the product.
       */
      var stage = el('div',
        'position:absolute;inset:0;'
        + 'perspective:1400px;transform-style:preserve-3d;'
        + '-webkit-mask-image:' + this.maskCss() + ';mask-image:' + this.maskCss() + ';');

      root.appendChild(stage);
      root.appendChild(this.buildCaption(o.caption || null));
      document.body.appendChild(root);

      this.root = root;
      this.stage = stage;
      this.shots = [];
      this.beats = [];
      return true;
    },

    maskCss: function () {
      return 'linear-gradient(180deg,#000 0%,#000 ' + pct(TOKENS.fade.solid)
        + ',transparent ' + pct(TOKENS.fade.clear) + ',transparent 100%)';
    },

    /**
     * The fixed block at the bottom.
     *
     * Pinned at the measured fractions and never moved. A still anchor is what
     * lets the top of the frame carry hard motion without the piece feeling
     * unstable — the reference holds its bottom 40% dead still for a full minute.
     *
     * `textContent`, never `innerHTML`: these strings arrive from a request body
     * and may have been written by a model, exactly as in `cleanSlide`.
     */
    buildCaption: function (cap) {
      var wrap = el('div', 'position:absolute;left:0;right:0;top:0;bottom:0;pointer-events:none;');
      if (!cap) { this.capNode = wrap; return wrap; }

      var mk = function (text, top, css) {
        if (!text) return null;
        var n = el('div',
          'position:absolute;left:6%;right:6%;top:' + pct(top) + ';'
          + 'transform:translateY(-50%);text-align:center;color:#0B0B0F;' + css);
        n.textContent = String(text);
        return n;
      };

      var title = mk(cap.title, TOKENS.caption.headline,
        'font-size:clamp(28px,7.4vw,64px);font-weight:700;letter-spacing:-.02em;line-height:1.04;');
      var sub = mk(cap.subtitle, TOKENS.caption.sub,
        'font-size:clamp(14px,3.1vw,26px);font-weight:450;line-height:1.34;opacity:.86;');

      if (title) wrap.appendChild(title);
      if (sub) wrap.appendChild(sub);

      if (cap.cta) {
        var pill = el('div',
          'position:absolute;left:50%;top:' + pct(TOKENS.caption.cta) + ';'
          + 'transform:translate(-50%,-50%);background:#fff;color:#0B0B0F;'
          + 'padding:.5em 1.1em;border-radius:6px;font-style:italic;font-weight:600;'
          + 'font-size:clamp(12px,2.5vw,20px);box-shadow:0 1px 3px rgba(60,30,10,.13);');
        pill.textContent = String(cap.cta);
        wrap.appendChild(pill);
      }

      this.capNode = wrap;
      return wrap;
    },

    /**
     * Add a still.
     *
     * `src` is a `data:` URI produced by `Page.captureScreenshot` at
     * deviceScaleFactor 2, so the element is displayed at roughly half its natural
     * size and a push-in spends that headroom instead of upscaling. `chrome` draws
     * the soft shadow and rounded corners that make a flat screenshot read as a
     * panel floating in the scene rather than a pasted rectangle.
     */
    addShot: function (src, placement) {
      if (!this.stage) return -1;
      var p = placement || {};
      var holder = el('div',
        'position:absolute;left:50%;top:' + pct(typeof p.centre === 'number' ? p.centre : SHOT_CENTRE) + ';'
        + 'width:' + (p.width || 86) + '%;'
        + 'transform-style:preserve-3d;opacity:0;will-change:transform,opacity,filter;');

      var img = el('img',
        'display:block;width:100%;height:auto;border-radius:14px;'
        + 'background:' + TOKENS.warmWhite + ';'
        + 'box-shadow:0 26px 70px -18px rgba(120,52,10,.34),0 2px 10px rgba(120,52,10,.10);');
      img.setAttribute('alt', '');
      img.src = src;

      holder.appendChild(img);
      this.stage.appendChild(holder);
      this.shots.push({ node: holder, img: img });
      return this.shots.length - 1;
    },

    /**
     * Queue the timeline.
     *
     * A beat is one continuous move of one still. Every channel — position,
     * scale, Y-rotation, blur, opacity — rides the *same* eased `u`, which is what
     * makes a move read as one gesture. Animating blur on its own timing is the
     * usual way a focus pull ends up looking like a mistake.
     */
    setBeats: function (beats) {
      this.beats = (beats || []).map(function (b) {
        var from = b.from || {};
        var to = b.to || {};
        var d = function (k, dflt) {
          return {
            a: typeof from[k] === 'number' ? from[k] : dflt,
            b: typeof to[k] === 'number' ? to[k] : (typeof from[k] === 'number' ? from[k] : dflt),
          };
        };
        return {
          shot: b.shot | 0,
          at: Math.max(0, Number(b.at) || 0),
          ms: Math.max(80, Number(b.ms) || 900),
          z: d('z', 1), rotY: d('rotY', 0), x: d('x', 0), y: d('y', 0),
          blur: d('blur', 0), opacity: d('opacity', 1),
        };
      }).sort(function (p, q) { return p.at - q.at; });
      return this.beats.length;
    },

    /** Total scene length in ms, including the tail of the last beat. */
    duration: function () {
      var end = 0;
      for (var i = 0; i < this.beats.length; i++) {
        var b = this.beats[i];
        if (b.at + b.ms > end) end = b.at + b.ms;
      }
      return end;
    },

    /**
     * Run it.
     *
     * Advanced on `performance.now()` rather than on a frame counter, so a
     * dropped browser frame costs a frame of *sampling* and never bends the
     * timeline. The sampler runs on its own 30fps clock and decimates whatever
     * this paints; tying scene time to frame count would make the two disagree
     * about how long a beat lasted.
     *
     * Resolves once past the last beat, plus `holdMs` so the final composition is
     * on screen long enough to read.
     */
    play: function (holdMs) {
      var self = this;
      var total = this.duration() + Math.max(0, holdMs || 0);
      this.startedAt = performance.now();

      return new Promise(function (resolve) {
        function frame(now) {
          var t = (now - self.startedAt) / 1000;
          var ms = t * 1000;

          // Applied to the whole stage, so the drift is a camera move rather than
          // the stills sliding independently inside a static frame.
          self.stage.style.transform =
            'scale(' + DRIFT.scale(t).toFixed(5) + ') '
            + 'translate3d(' + DRIFT.x(t).toFixed(3) + '%,' + DRIFT.y(t).toFixed(3) + '%,0) '
            + 'rotate(' + DRIFT.rot(t).toFixed(4) + 'deg)';

          for (var i = 0; i < self.beats.length; i++) {
            var b = self.beats[i];
            var shot = self.shots[b.shot];
            if (!shot) continue;
            if (ms < b.at) continue;

            var u = ease((ms - b.at) / b.ms);
            var z = lerp(b.z.a, b.z.b, u);
            var blur = lerp(b.blur.a, b.blur.b, u);

            shot.node.style.opacity = lerp(b.opacity.a, b.opacity.b, u).toFixed(4);
            shot.node.style.transform =
              'translate(-50%,-50%) '
              + 'translate3d(' + lerp(b.x.a, b.x.b, u).toFixed(3) + '%,'
              + lerp(b.y.a, b.y.b, u).toFixed(3) + '%,0) '
              + 'scale(' + z.toFixed(5) + ') '
              + 'rotateY(' + lerp(b.rotY.a, b.rotY.b, u).toFixed(4) + 'deg)';
            // Skipped entirely at zero: a `blur(0px)` filter still forces the
            // element onto its own compositing layer for the whole take.
            shot.img.style.filter = blur > 0.01 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
          }

          if (ms >= total) { self.raf = 0; resolve(true); return; }
          self.raf = requestAnimationFrame(frame);
        }
        self.raf = requestAnimationFrame(frame);
      });
    },

    /**
     * Wait until every still can actually be painted.
     *
     * Setting `img.src` to a data URI does not decode it synchronously. Without
     * this, `play` can start while the first shot is still an empty box — and
     * because a shot enters *from* opacity 0, that failure is invisible in the
     * scene and only shows up as a take that opens on bare gradient. Awaiting the
     * decode is the difference between "the animation is subtle" and "the first
     * beat is missing".
     *
     * `decode()` where available, `onload`/`onerror` otherwise, and a broken image
     * resolves rather than rejecting: a shot that will not decode should cost its
     * own beat, not the whole take.
     */
    ready: function () {
      var imgs = this.shots.map(function (s) { return s.img; });
      return Promise.all(imgs.map(function (im) {
        if (im.complete && im.naturalWidth > 0) return Promise.resolve(true);
        if (im.decode) return im.decode().then(function () { return true; }, function () { return false; });
        return new Promise(function (res) {
          im.onload = function () { res(true); };
          im.onerror = function () { res(false); };
        });
      })).then(function () { return true; });
    },

    stop: function () {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return true;
    },

    /**
     * Hide the layer without tearing it down.
     *
     * For `Page.shot`, which raises the device scale factor and photographs the
     * viewport: an opaque layer left up would photograph itself. `visibility`
     * rather than `display` so nothing reflows and the rAF loop keeps its
     * geometry — a mid-take shot must not move anything.
     */
    hide: function (on) {
      if (this.root) this.root.style.visibility = on ? 'hidden' : '';
      return true;
    },

    /**
     * Take the layer back off, leaving the app exactly as it was.
     *
     * Cheap because `mount` never wrote to `documentElement` or `body` — removing
     * one node is the whole undo. Called before the closing card so the card is
     * drawn by `overlay.js` over the real app, as it is in a plain take.
     */
    unmount: function () {
      this.stop();
      if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
      this.root = null;
      this.stage = null;
      this.capNode = null;
      this.shots = [];
      this.beats = [];
      return true;
    },
  };

  window.__zenScene = Scene;
})();
