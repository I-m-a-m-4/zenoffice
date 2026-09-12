/* eslint-disable */
/**
 * Presentation overlay injected into the real Zeneva app while recording.
 *
 * This file runs *inside the page* (via CDP `addScriptToEvaluateOnNewDocument`),
 * never as part of the app bundle. It is deliberately self-contained plain ES5-ish
 * JS with no imports: nothing in `src/` knows it exists, and removing the recorder
 * removes it completely.
 *
 * What it adds, all inside one `pointer-events:none` shadow-free root pinned at
 * z-index 2147483000:
 *
 *   - a hand-feeling cursor that glides along a bowed cubic bezier rather than a
 *     straight line, with a slow idle drift so it never looks parked;
 *   - a press squash + expanding click ripple;
 *   - a focus halo that blooms on the target just before the click, so the
 *     viewer's eye is already there when the UI changes;
 *   - caption / title / end-card cards for the marketing voice-over lines.
 *
 * It never dispatches input. Real clicks come from `Input.dispatchMouseEvent` on
 * the driver side, so the app receives trusted events on its normal code path —
 * the overlay is purely what the camera sees.
 */
(function () {
  if (window.__zen && window.__zen.__v === 8) return;

  var NS = 'http://www.w3.org/2000/svg';
  var Z = 2147483000;
  var root = null;
  var cursorEl = null;
  var haloEl = null;
  var capWrap = null;
  var cardWrap = null;

  // ---------------------------------------------------------------- state
  var st = {
    x: -200,
    y: -200,
    tween: null,
    bowSign: 1,
    visible: false,
    press: 0,
    mode: 'desktop',
    t0: 0,
  };

  var easeInOut = function (t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  function el(tag, css, parent) {
    var n = document.createElement(tag);
    if (css) n.setAttribute('style', css);
    (parent || root).appendChild(n);
    return n;
  }

  /**
   * Resolve a freshly built subtree's styles, so the transitions that follow have a
   * from-value to leave.
   *
   * Creating an element with `opacity:0` in its style attribute and flipping it to
   * `1` inside one `requestAnimationFrame` looks like it animates, and does not:
   * rAF callbacks run *before* the frame's style recalculation, so the from-state
   * is never resolved, the browser only ever sees the final value, and the element
   * cuts straight in. In footage that reads as a card appearing between two frames
   * — measured at exactly one frame of change in the band, identically for all four
   * motions, which is also why every motion looked the same on film.
   *
   * Measured, not assumed: during an entrance `document.getAnimations()` listed one
   * animation (the page's own) without this call and six with it, the scrim ramping
   * 0.05, 0.22, 0.37, 0.58, 0.83 instead of jumping to 1. Reading `offsetWidth`
   * forces style and layout, which is what puts the from-value on record.
   */
  function settleStyles(node) {
    if (node) void node.offsetWidth;
  }

  // ---------------------------------------------------------------- mount
  function mount() {
    // `page.mjs` injects this file with `addScriptToEvaluateOnNewDocument`, which
    // runs before the parser has built anything at all: `document.documentElement`
    // is null there, and `document.body` with it. Verified, not assumed — a probe
    // reported hasDocEl:false, readyState:"loading", and `appendChild` of null.
    //
    // Returning instead of throwing is the whole point. The first version threw out
    // of here on every document, which skipped the remount listeners at the bottom
    // of this file, so a take ran against an overlay that had a working API and no
    // DOM: `place()` and `show()` still answered `true`, `card()` returned silently
    // at its `if (!cardWrap)` guard, and the only symptom was footage with no
    // cursor and no title cards. Only `moveTo()` re-mounted, which is why the
    // cursor appeared partway in while the opening card never did.
    //
    // Waiting for `body` rather than just `documentElement` also keeps the overlay
    // a sibling after <head> and <body> instead of inserting it ahead of the parser.
    if (!document.body) return;
    if (root && document.documentElement.contains(root)) return;
    root = document.createElement('div');
    root.id = '__zen_overlay';
    root.setAttribute(
      'style',
      'position:fixed;inset:0;pointer-events:none;z-index:' + Z + ';' +
      'font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
      '-webkit-font-smoothing:antialiased;contain:layout style;'
    );
    document.documentElement.appendChild(root);

    // Focus halo sits under the cursor so the arrow never gets washed out.
    haloEl = el('div',
      'position:absolute;left:0;top:0;border-radius:14px;opacity:0;' +
      'box-shadow:0 0 0 3px rgba(244,113,37,.85),0 0 0 10px rgba(244,113,37,.18),' +
      '0 8px 30px rgba(244,113,37,.28);transition:opacity .18s ease;'
    );

    capWrap = el('div',
      'position:absolute;left:0;right:0;bottom:44px;display:flex;justify-content:center;'
    );
    cardWrap = el('div', 'position:absolute;inset:0;');
    cursorEl = buildCursor();
    root.appendChild(cursorEl);
    paint();
  }

  function buildCursor() {
    var wrap = document.createElement('div');
    wrap.setAttribute(
      'style',
      'position:absolute;left:0;top:0;width:0;height:0;opacity:0;' +
      'transition:opacity .22s ease;will-change:transform;'
    );

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '30');
    svg.setAttribute('height', '30');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('style', 'position:absolute;left:-2px;top:-2px;overflow:visible;');

    var defs = document.createElementNS(NS, 'defs');
    var f = document.createElementNS(NS, 'filter');
    // Unique per mount: two overlays in one document would otherwise share the
    // filter id and the second would silently reuse the first's blur radius.
    var fid = 'zenCurShadow' + Math.floor(performance.now());
    f.setAttribute('id', fid);
    f.setAttribute('x', '-60%'); f.setAttribute('y', '-60%');
    f.setAttribute('width', '260%'); f.setAttribute('height', '260%');
    var blur = document.createElementNS(NS, 'feDropShadow');
    blur.setAttribute('dx', '0'); blur.setAttribute('dy', '2');
    blur.setAttribute('stdDeviation', '2.4');
    blur.setAttribute('flood-color', 'rgba(8,10,14,.45)');
    f.appendChild(blur);
    defs.appendChild(f);
    svg.appendChild(defs);

    // macOS-style arrow: white body, dark keyline, so it reads on both themes.
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('d', 'M5.5 2.2 L5.5 19.4 L9.9 15.2 L12.6 21.6 L15.4 20.4 L12.7 14.1 L18.6 14.1 Z');
    p.setAttribute('fill', '#ffffff');
    p.setAttribute('stroke', 'rgba(10,12,16,.82)');
    p.setAttribute('stroke-width', '1.1');
    p.setAttribute('stroke-linejoin', 'round');
    p.setAttribute('filter', 'url(#' + fid + ')');
    svg.appendChild(p);
    wrap.appendChild(svg);

    // Touch mode disc, hidden unless mode === 'touch'.
    var disc = document.createElement('div');
    disc.className = '__zen_disc';
    disc.setAttribute(
      'style',
      'position:absolute;left:-21px;top:-21px;width:42px;height:42px;border-radius:50%;' +
      'background:radial-gradient(circle at 38% 34%,rgba(255,255,255,.55),rgba(244,113,37,.42) 62%,rgba(244,113,37,.14));' +
      'border:1.5px solid rgba(255,255,255,.7);box-shadow:0 6px 22px rgba(8,10,14,.34);display:none;'
    );
    wrap.appendChild(disc);
    return wrap;
  }

  function paint() {
    if (!cursorEl) return;
    var squash = 1 - st.press * 0.16;
    cursorEl.style.transform =
      'translate3d(' + st.x.toFixed(2) + 'px,' + st.y.toFixed(2) + 'px,0) scale(' + squash.toFixed(3) + ')';
    cursorEl.style.opacity = st.visible ? '1' : '0';
  }

  // ---------------------------------------------------------------- rAF loop
  function tick(now) {
    if (!st.t0) st.t0 = now;
    var tw = st.tween;
    if (tw) {
      var t = clamp01((now - tw.start) / tw.dur);
      var e = easeInOut(t);
      // Quadratic bezier: the bowed control point is what makes a machine move
      // read as a hand. A straight lerp always looks like a robot.
      var mt = 1 - e;
      st.x = mt * mt * tw.x0 + 2 * mt * e * tw.cx + e * e * tw.x1;
      st.y = mt * mt * tw.y0 + 2 * mt * e * tw.cy + e * e * tw.y1;
      if (t >= 1) {
        st.tween = null;
        if (tw.done) tw.done();
      }
    } else if (st.visible) {
      // Idle drift — two prime-ish periods so it never repeats visibly.
      var ms = now - st.t0;
      st.x += Math.sin(ms / 1490) * 0.055;
      st.y += Math.sin(ms / 1130 + 0.7) * 0.042;
    }
    paint();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------------------------------------------------------------- helpers
  function visible(node) {
    if (!node || !node.getBoundingClientRect) return false;
    var r = node.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    var cs = getComputedStyle(node);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false;
    return true;
  }

  function inViewport(r) {
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  }

  function rectOf(node) {
    var r = node.getBoundingClientRect();
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      left: r.left, top: r.top, w: r.width, h: r.height,
      inView: inViewport(r),
    };
  }

  function ownText(node) {
    // innerText collapses hidden text and respects line breaks, which is what
    // "what the user can read" means. textContent would match sr-only labels.
    var s = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    return s;
  }

  /**
   * Resolve a step's target spec to the element itself.
   *
   * Split out from `find` so that scrolling, hit-testing and clicking all act on
   * the *same* node. The old `nodeFor` re-derived it with `elementFromPoint` at
   * the resolved centre, which quietly returned something else entirely whenever
   * the target was off-screen: the point gets clamped into the viewport, and on a
   * phone the bottom of the viewport is the fixed nav. `scrollClear` then called
   * `scrollIntoView` on a `position: fixed` bar, which by definition scrolls
   * nothing, and the take failed reporting that the nav was covering a button
   * 200px below the fold.
   *
   * spec: { text?, exact?, tag?, placeholder?, label?, css?, nth?, within? }
   */
  function nodeFor(spec) {
    var scope = document;
    if (spec.within) {
      var s = document.querySelector(spec.within);
      if (s) scope = s;
    }

    var pool = [];
    if (spec.css) {
      pool = Array.prototype.slice.call(scope.querySelectorAll(spec.css));
    } else if (spec.placeholder) {
      pool = Array.prototype.slice.call(scope.querySelectorAll('input,textarea')).filter(function (n) {
        return (n.getAttribute('placeholder') || '').toLowerCase().indexOf(spec.placeholder.toLowerCase()) >= 0;
      });
    } else if (spec.label) {
      pool = Array.prototype.slice.call(scope.querySelectorAll('[aria-label]')).filter(function (n) {
        return (n.getAttribute('aria-label') || '').toLowerCase().indexOf(spec.label.toLowerCase()) >= 0;
      });
    } else if (spec.text) {
      var want = spec.text.toLowerCase();
      var tags = spec.tag ? [spec.tag] : ['button', 'a', 'label', '[role="button"]', 'h1', 'h2', 'h3', 'td', 'div', 'span', 'p'];
      var seen = [];
      for (var i = 0; i < tags.length; i++) {
        var list = scope.querySelectorAll(tags[i]);
        for (var j = 0; j < list.length; j++) {
          var n = list[j];
          var txt = ownText(n).toLowerCase();
          if (!txt) continue;
          var hit = spec.exact ? txt === want : txt.indexOf(want) >= 0;
          if (hit) seen.push(n);
        }
        // Stop at the first tag class that produced anything: a <button> match
        // is always more specific than the <div> wrapping it.
        if (seen.length) break;
      }
      // Prefer the innermost / smallest match so we click the button, not the card.
      pool = seen.filter(function (n) {
        return !seen.some(function (m) { return m !== n && n.contains(m); });
      });
    }

    pool = pool.filter(visible);
    if (!pool.length) return null;
    return pool[spec.nth || 0] || pool[0];
  }

  /**
   * Resolve a step's target spec to a rect. Specs use what a person sees —
   * visible text, placeholder, aria-label — so no `data-testid` has to be added
   * to any component. `css` is the escape hatch for things with no text at all.
   */
  function find(spec) {
    var pick = nodeFor(spec);
    if (!pick) return null;
    var out = rectOf(pick);
    out.tag = pick.tagName.toLowerCase();
    out.snippet = ownText(pick).slice(0, 60);
    hitTest(pick, out);
    return out;
  }

  /**
   * Does a click at the resolved point actually land on the element?
   *
   * `getBoundingClientRect` says where a node *is*, not whether anything is on
   * top of it. The app's toasts render in an `ol.fixed.z-[9999]` with
   * `pointer-events:auto` at the bottom-right — exactly where the POS cart's
   * "Next: Customer" button sits — so an add-to-cart toast silently swallows the
   * click on it. The button stays enabled, the event goes to the toast, the flow
   * waits out its timeout on a step that looks perfectly fine in a screenshot.
   *
   * The overlay is `pointer-events:none`, so it never covers anything itself and
   * cannot show up as its own blocker.
   *
   * Sets `covered` plus `coveredBy`, and when the element is only partly
   * obscured, moves x/y to a corner-inset point that *is* clear — enough for the
   * common case of a toast overlapping one end of a wide button. The caller
   * decides what to do about a fully-covered target; see `Page.click`.
   */
  function hitTest(node, out) {
    /*
     * Off-screen is not covered, and conflating the two cost a mobile take.
     *
     * `elementFromPoint` is viewport-relative and returns null outside it, so
     * every probe below has to clamp. On a phone the POS customer page puts
     * "Next: Payment" at y=1035 in an 844px viewport — the clamp drags the probe
     * to y=843, which is inside the fixed bottom nav, and the recorder reports
     * that the nav is covering a button it is nowhere near. Worse, `nodeFor`
     * resolves the same spec through the same clamped point, so `scrollClear`
     * then calls `scrollIntoView` on the *nav* — a `position:fixed` element,
     * which scrolls nothing, forever.
     *
     * So: say what is actually true. Nothing is on top of it; it is out of
     * frame, and the caller already knows how to scroll.
     */
    if (out.top + out.h <= 0 || out.top >= innerHeight
        || out.left + out.w <= 0 || out.left >= innerWidth) {
      out.covered = false;
      out.offscreen = true;
      return;
    }

    var reaches = function (x, y) {
      var cx = Math.max(1, Math.min(innerWidth - 1, x));
      var cy = Math.max(1, Math.min(innerHeight - 1, y));
      var top = document.elementFromPoint(cx, cy);
      while (top) {
        if (top === node) return true;
        top = top.parentElement;
      }
      return false;
    };

    if (reaches(out.x, out.y)) {
      out.covered = false;
      return;
    }

    // Try points inside the element before giving up: a toast usually clips one
    // side of a control rather than the whole of it.
    var inset = 6;
    var candidates = [
      [out.left + inset, out.top + out.h / 2],
      [out.left + out.w - inset, out.top + out.h / 2],
      [out.left + out.w / 2, out.top + inset],
      [out.left + out.w / 2, out.top + out.h - inset],
      [out.left + inset, out.top + inset],
      [out.left + out.w - inset, out.top + out.h - inset]
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (reaches(candidates[i][0], candidates[i][1])) {
        out.x = candidates[i][0];
        out.y = candidates[i][1];
        out.covered = false;
        out.shifted = true;
        return;
      }
    }

    var blocker = document.elementFromPoint(
      Math.max(1, Math.min(innerWidth - 1, out.x)),
      Math.max(1, Math.min(innerHeight - 1, out.y))
    );
    out.covered = true;
    out.coveredBy = blocker
      ? (blocker.tagName.toLowerCase() + ' ' + ownText(blocker).slice(0, 60)).trim()
      : 'an unknown element';
    // Whether waiting can possibly help. A toast expires; a sticky header or the
    // POS cart bar pinned to the bottom of a 390px viewport does not, so the
    // recorder needs to know which kind of obstruction it is looking at rather
    // than spending six seconds finding out. See Page.click.
    out.coveredByPinned = isPinned(blocker);
  }

  /** Is this node, or anything it sits inside, taken out of the scroll flow? */
  function isPinned(node) {
    var n = node;
    while (n && n !== document.documentElement) {
      var p = getComputedStyle(n).position;
      if (p === 'fixed' || p === 'sticky') return true;
      n = n.parentElement;
    }
    return false;
  }

  /**
   * The nearest ancestor that actually scrolls.
   *
   * Not the window: the app's shell is a full-height flex column with
   * `overflow:hidden`, and the one element with real scroll is
   * `main#app-main-content`. `document.documentElement.scrollHeight` equals the
   * viewport height on every page, so anything reasoning about `scrollY` sees a
   * page that cannot move and concludes, wrongly, that a target below the fold
   * is unreachable.
   */
  function scrollerFor(node) {
    var n = node.parentElement;
    while (n && n !== document.documentElement) {
      var oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 2) return n;
      n = n.parentElement;
    }
    return null;
  }

  /**
   * Scroll `node` to the middle of the *clear* part of its scroller.
   *
   * `scrollIntoView({block:'center'})` centres against the scrollport, which is
   * the right idea and the wrong rectangle: on a phone the bottom 64px of that
   * scrollport sits under the fixed nav, and the POS "Next: Payment" button is
   * the last thing in the document, so the scroller runs out of range before the
   * centre is reached and the button settles behind the nav anyway. It stayed
   * clickable only because the hit-test shifts to an inset point — nine pixels of
   * the button were visible, which is not a margin worth shipping.
   *
   * So aim at the centre of what is actually visible, and account for the
   * scroller having a maximum: when it does, and the target is still under the
   * bottom chrome, there is nothing further to give and the caller's second pass
   * is what catches it — the app renders the totals block late, which extends the
   * scroll range after the first attempt has already run.
   *
   * Returns true if something was asked to move.
   */
  function centreClear(node) {
    var box = scrollerFor(node);
    if (!box) {
      if (!node.scrollIntoView) return false;
      node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      return true;
    }

    var port = box.getBoundingClientRect();
    var clearTop = port.top;
    var clearBottom = port.bottom;

    // Trim the band each piece of pinned chrome steals from the scrollport. Only
    // bars spanning most of the width count — a floating action button overlaps
    // the port too, and shrinking the whole target band for it would be wrong.
    var pinned = document.body.querySelectorAll('nav,header,footer,aside,div');
    for (var i = 0; i < pinned.length; i++) {
      var p = pinned[i];
      var cs = getComputedStyle(p);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      var r = p.getBoundingClientRect();
      if (r.width < innerWidth * 0.6 || r.height < 4) continue;
      if (r.top <= clearTop && r.bottom > clearTop && r.bottom < clearBottom) clearTop = r.bottom;
      if (r.bottom >= clearBottom && r.top < clearBottom && r.top > clearTop) clearBottom = r.top;
    }
    if (clearBottom - clearTop < 80) { clearTop = port.top; clearBottom = port.bottom; }

    var rect = node.getBoundingClientRect();
    var want = (clearTop + clearBottom) / 2 - rect.height / 2;
    var delta = rect.top - want;
    if (Math.abs(delta) < 2) return false;

    var max = box.scrollHeight - box.clientHeight;
    var next = Math.max(0, Math.min(max, box.scrollTop + delta));
    if (Math.abs(next - box.scrollTop) < 2) return false;
    box.scrollTo({ top: next, behavior: 'smooth' });
    return true;
  }

  function scrollTo(spec) {
    var node = nodeFor(spec);
    if (!node) return false;
    return centreClear(node);
  }

  /**
   * Scroll a target out from under a pinned element.
   *
   * `inViewport` counts anything that merely intersects the viewport, so a button
   * sitting *behind* a fixed bottom bar is "in view" and `ensureInView` never
   * fires — which is how a mobile take died on the third add-to-cart button while
   * a screenshot of the moment looked completely fine.
   *
   * Same move as `scrollTo`, because the fix for both is the same: put the target
   * in the middle of the band no pinned chrome reaches. A pinned element covering
   * that band is a modal, and no amount of scrolling clears one of those — the
   * caller reports it instead.
   */
  function scrollClear(spec) {
    var node = nodeFor(spec);
    if (!node) return false;
    return centreClear(node);
  }

  // ---------------------------------------------------------------- effects
  function ripple(x, y, tone) {
    if (!root) return;
    var r = el('div',
      'position:absolute;left:' + (x - 6) + 'px;top:' + (y - 6) + 'px;width:12px;height:12px;' +
      'border-radius:50%;border:2.5px solid ' + (tone || 'rgba(244,113,37,.95)') + ';' +
      'box-shadow:0 0 18px rgba(244,113,37,.5);transform:scale(.4);opacity:.95;'
    );
    var start = performance.now();
    (function step(now) {
      var t = clamp01((now - start) / 560);
      var e = easeOut(t);
      r.style.transform = 'scale(' + (0.4 + e * 4.2).toFixed(3) + ')';
      r.style.opacity = String((1 - t) * 0.95);
      if (t < 1) requestAnimationFrame(step);
      else if (r.parentNode) r.parentNode.removeChild(r);
    })(start);
  }

  function halo(rect, on) {
    if (!haloEl) return;
    if (!on) { haloEl.style.opacity = '0'; return; }
    var pad = 6;
    haloEl.style.left = (rect.left - pad) + 'px';
    haloEl.style.top = (rect.top - pad) + 'px';
    haloEl.style.width = (rect.w + pad * 2) + 'px';
    haloEl.style.height = (rect.h + pad * 2) + 'px';
    haloEl.style.opacity = '1';
  }

  function caption(textStr, ms) {
    if (!capWrap) return;
    while (capWrap.firstChild) capWrap.removeChild(capWrap.firstChild);
    if (!textStr) return;
    var c = el('div',
      'max-width:min(78vw,940px);padding:14px 26px;border-radius:14px;' +
      'background:rgba(9,10,13,.86);backdrop-filter:blur(10px);color:#fff;' +
      'font-size:clamp(15px,1.55vw,25px);font-weight:500;letter-spacing:-.01em;line-height:1.35;' +
      'text-align:center;box-shadow:0 18px 48px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.09);' +
      'opacity:0;transform:translateY(14px);transition:opacity .34s ease,transform .34s cubic-bezier(.22,1,.36,1);',
      capWrap
    );
    c.textContent = textStr;
    settleStyles(c);
    requestAnimationFrame(function () { c.style.opacity = '1'; c.style.transform = 'translateY(0)'; });
    if (ms) {
      setTimeout(function () {
        c.style.opacity = '0';
        c.style.transform = 'translateY(-10px)';
      }, ms);
    }
  }

  /*
   * The title screens.
   *
   * `motion` chooses how the words arrive and `image` puts a still behind them.
   * Both are optional, and absent means what this function has always drawn:
   * `rise` over the dark radial scrim. A take recorded before these existed and
   * one recorded after, from the same copy, are the same film — every existing
   * preset, recipe and `--cards` file omits both fields.
   *
   * The per-motion tables below hold only the *starting* transform and the
   * transition for each of the three lines; the shared code fades the scrim in
   * and lets everything settle to its resting position on the next frame. Adding
   * a motion is one more entry here plus one in `slides.ts` and `recipe.mjs`.
   *
   * Everything the caller supplies lands in `textContent` or in a
   * `background-image:url(...)` for a data URI that `cleanSlideImage` has already
   * checked. Nothing reaches `innerHTML` — a slide can be written by a model, and
   * a model's words are content, never markup.
   */
  var EASE = 'cubic-bezier(.22,1,.36,1)';
  var MOTIONS = {
    // The original, to the character. `all .6s` and the .12s/.24s stagger are
    // what shipped, so a re-record of an old take is frame-for-frame the same.
    rise: {
      title: ['translateY(18px)', 'all .6s ' + EASE],
      sub: ['translateY(18px)', 'all .6s ' + EASE + ' .12s'],
      cta: ['translateY(18px)', 'all .6s ' + EASE + ' .24s'],
    },
    // The panel does the revealing, so the words themselves do not move: they
    // just stop being invisible as it passes over them.
    wipe: {
      title: ['none', 'opacity .26s ease .30s'],
      sub: ['none', 'opacity .26s ease .44s'],
      cta: ['none', 'opacity .26s ease .58s'],
      panel: true,
    },
    // One unit settling, not three lines arriving — the stagger is deliberately
    // absent here or it reads as a wobble rather than a push.
    zoom: {
      stack: ['scale(1.085)', 'opacity .7s ease,transform .9s ' + EASE],
      title: ['none', 'opacity .5s ease .05s'],
      sub: ['none', 'opacity .5s ease .16s'],
      cta: ['none', 'opacity .5s ease .28s'],
    },
    split: {
      title: ['translateX(-64px)', 'all .68s ' + EASE],
      sub: ['translateX(64px)', 'all .68s ' + EASE + ' .08s'],
      cta: ['translateY(16px)', 'all .6s ' + EASE + ' .26s'],
    },
  };

  function card(title, sub, cta, opts) {
    if (!cardWrap) return;
    while (cardWrap.firstChild) cardWrap.removeChild(cardWrap.firstChild);
    var o = opts || {};
    var m = MOTIONS[o.motion] || MOTIONS.rise;
    var image = typeof o.image === 'string' && o.image.indexOf('data:image/') === 0 ? o.image : null;

    var scrim = el('div',
      'position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,rgba(12,13,17,.9),rgba(6,7,9,.97));' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'opacity:0;transition:opacity .5s ease;overflow:hidden;',
      cardWrap
    );

    // A photograph, if one was uploaded: full-bleed under a vertical scrim dark
    // enough to keep white text legible over anything, with a slow push so the
    // still does not read as a frozen video. The push runs longer than any hold
    // `cleanSlide` allows, so it never visibly finishes and snaps.
    var pic = null;
    if (image) {
      pic = el('div',
        'position:absolute;inset:0;background-image:url("' + image + '");background-size:cover;' +
        'background-position:center;transform:scale(1.075);transition:transform 9s linear;',
        scrim
      );
      el('div',
        'position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,7,9,.52),rgba(6,7,9,.7) 46%,rgba(6,7,9,.88));',
        scrim
      );
    }

    // The wipe panel, above the picture and below the words.
    var panel = null;
    if (m.panel) {
      panel = el('div',
        'position:absolute;top:0;bottom:0;left:0;width:130%;background:linear-gradient(90deg,' +
        'rgba(244,113,37,0),#f47125 18%,#f47125 82%,rgba(244,113,37,0));' +
        'transform:translateX(-110%);transition:transform 1.05s cubic-bezier(.65,0,.35,1);',
        scrim
      );
    }

    // One stack for the three lines, so a motion can move them together. The
    // flex properties are the scrim's own, moved inward: `align-items:center` and
    // the 18px gap laid out the same column before this wrapper existed.
    var stack = el('div',
      'position:relative;display:flex;flex-direction:column;align-items:center;gap:18px;' +
      'opacity:' + (m.stack ? '0' : '1') + ';'
      + (m.stack ? 'transform:' + m.stack[0] + ';transition:' + m.stack[1] + ';' : ''),
      scrim
    );

    var mark = el('div',
      'font-family:"Bricolage Grotesque",Inter,sans-serif;font-weight:800;letter-spacing:-.03em;' +
      'font-size:clamp(30px,4.4vw,74px);color:#f47125;text-shadow:0 0 60px rgba(244,113,37,.34);' +
      'text-align:center;max-width:88vw;' +
      'opacity:0;transform:' + m.title[0] + ';transition:' + m.title[1] + ';',
      stack
    );
    mark.textContent = title || '';
    // An image-only slide would otherwise reserve a line's worth of empty space.
    if (!title) mark.style.display = 'none';

    var s2 = el('div',
      'color:rgba(255,255,255,.82);font-size:clamp(15px,1.7vw,27px);font-weight:400;text-align:center;' +
      'max-width:74vw;opacity:0;transform:' + m.sub[0] + ';transition:' + m.sub[1] + ';',
      stack
    );
    s2.textContent = sub || '';
    var btn = null;
    if (cta) {
      btn = el('div',
        'margin-top:12px;padding:13px 30px;border-radius:11px;background:#f47125;color:#fff;' +
        'font-weight:600;font-size:clamp(14px,1.25vw,20px);box-shadow:0 14px 40px rgba(244,113,37,.4);' +
        'opacity:0;transform:' + m.cta[0] + ';transition:' + m.cta[1] + ';',
        stack
      );
      btn.textContent = cta;
    }

    // One read of the finished subtree, so every from-state above is resolved before
    // the flip below. Without it the whole card hard-cuts in on a single frame and
    // all four motions look identical on film. See `settleStyles`.
    settleStyles(scrim);
    requestAnimationFrame(function () {
      scrim.style.opacity = '1';
      if (pic) pic.style.transform = 'scale(1)';
      if (panel) panel.style.transform = 'translateX(110%)';
      if (m.stack) { stack.style.opacity = '1'; stack.style.transform = 'none'; }
      mark.style.opacity = '1'; mark.style.transform = 'none';
      s2.style.opacity = '1'; s2.style.transform = 'none';
      if (btn) { btn.style.opacity = '1'; btn.style.transform = 'none'; }
    });
    return scrim;
  }

  function clearCard() {
    if (!cardWrap) return;
    var kids = Array.prototype.slice.call(cardWrap.children);
    kids.forEach(function (k) {
      k.style.opacity = '0';
      setTimeout(function () { if (k.parentNode) k.parentNode.removeChild(k); }, 560);
    });
  }

  /*
   * The mobile device frame used to be drawn here, as an inset box-shadow.
   * It moved to `phone.mjs` and is composited at encode time instead: a frame
   * painted in the page covers the app's outer pixels, while a composited one
   * contains the screen. Nothing calls `__zen.frame()` any more, so it is gone
   * rather than kept as a dead path that could quietly draw a second bezel over
   * the first.
   */

  // ---------------------------------------------------------------- API
  window.__zen = {
    __v: 8,

    mount: function () { mount(); return true; },

    /**
     * Everything about the cursor that a fresh document would forget.
     *
     * A hard navigation gets a brand-new overlay with the defaults — invisible,
     * and in desktop mode even on a phone take — so the driver reads this before
     * navigating and hands it straight back afterwards. Without it, the cursor
     * blinked out at every route change and a mobile take grew an arrow pointer.
     */
    state: function () {
      return { visible: st.visible, mode: st.mode, x: st.x, y: st.y };
    },

    mode: function (m) {
      st.mode = m === 'touch' ? 'touch' : 'desktop';
      if (!cursorEl) return st.mode;
      var svg = cursorEl.querySelector('svg');
      var disc = cursorEl.querySelector('.__zen_disc');
      if (svg) svg.style.display = st.mode === 'touch' ? 'none' : '';
      if (disc) disc.style.display = st.mode === 'touch' ? '' : 'none';
      return st.mode;
    },

    show: function (on) {
      st.visible = on !== false;
      paint();
      return st.visible;
    },

    at: function () { return { x: st.x, y: st.y }; },

    place: function (x, y) { st.x = x; st.y = y; st.tween = null; paint(); return true; },

    /** Glide to (x,y) over `dur` ms along a bowed arc. Resolves when it lands. */
    moveTo: function (x, y, dur) {
      mount();
      var self = this;
      return new Promise(function (resolve) {
        var x0 = st.x, y0 = st.y;
        if (x0 < -100) { st.x = x0 = x - 220; st.y = y0 = y + 170; }
        var dx = x - x0, dy = y - y0;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var d = dur || Math.max(320, Math.min(1150, 300 + dist * 1.15));
        // Perpendicular bow, alternating side per move.
        var bow = Math.min(90, dist * 0.19) * st.bowSign;
        st.bowSign *= -1;
        var nx = dist > 1 ? -dy / dist : 0;
        var ny = dist > 1 ? dx / dist : 0;
        st.tween = {
          x0: x0, y0: y0, x1: x, y1: y,
          cx: (x0 + x) / 2 + nx * bow,
          cy: (y0 + y) / 2 + ny * bow,
          start: performance.now(), dur: d,
          done: resolve,
        };
        st.visible = true;
        void self;
      });
    },

    press: function (on) { st.press = on ? 1 : 0; paint(); return true; },

    ripple: function (x, y) { ripple(x == null ? st.x : x, y == null ? st.y : y); return true; },

    halo: function (rect) { halo(rect, !!rect); return true; },

    caption: caption,
    card: function (t, s2, cta, opts) { card(t, s2, cta, opts); return true; },
    clearCard: clearCard,

    find: function (spec) { return find(spec); },
    scrollTo: function (spec) { return scrollTo(spec); },
    scrollClear: function (spec) { return scrollClear(spec); },

    /** True once the app has painted something real (not just a loader). */
    settled: function () {
      var b = document.body;
      if (!b) return false;
      return b.innerText.replace(/\s+/g, '').length > 40;
    },
  };

  /*
   * Listeners before the eager call, for exactly the reason `HIDE_DEV_UI` documents
   * in `page.mjs`: at document-start there is nothing to append to, so the first
   * mount is *expected* to do nothing and something has to come back for it later.
   * Registering first means a failure in the eager path can never cost us the
   * second chance — and the previous version's `observe(document.documentElement)`
   * threw on a null documentElement, so the remount observer was never installed
   * at all. A take then ran against an overlay with a working API and no DOM: no
   * cursor, no title cards, and nothing anywhere reporting a problem.
   *
   * `document` itself is watched as well as <html>, because the <html> this script
   * sees is not the one the take runs against — the parser replaces it, which
   * detaches the overlay along with any observer bound only to the old one.
   */
  var watching = null;
  var keep = new MutationObserver(function () { boot(); });

  function boot() {
    mount();
    // Watch whatever <html> is current, whether or not the overlay went in: the
    // parser appends <body> to it, and that is the moment mounting becomes possible.
    // `waitForSettled` can be satisfied while the document is still parsing, so
    // waiting for DOMContentLoaded alone would let a take start un-mounted.
    var de = document.documentElement;
    if (de && watching !== de) {
      watching = de;
      keep.disconnect();
      keep.observe(document, { childList: true, subtree: false });
      // Next.js swaps whole subtrees on navigation; if anything ever detaches the
      // overlay, put it straight back rather than losing the cursor mid-take.
      keep.observe(de, { childList: true, subtree: false });
    }
  }

  keep.observe(document, { childList: true, subtree: false });
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('readystatechange', boot);
  boot();
})();
