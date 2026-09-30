/* ═══════════════════════════════════════════════════════════════════════════
   James Ciclitira — motion layer
   Vanilla, no dependencies. Everything degrades to a static page.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── THEME ─────────────────────────────────────────────────────────────── */
  function theme() {
    var root = document.documentElement;
    var sync = function () {
      $$('.tt').forEach(function (b) { b.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark'); });
    };
    sync();
    $$('.tt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        root.classList.add('theme-anim');
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('theme', next); } catch (e) {}
        sync();
        setTimeout(function () { root.classList.remove('theme-anim'); }, 400);
      });
    });
  }

  /* ── INTRO CURTAIN ─────────────────────────────────────────────────────── */
  function intro(done) {
    var el = $('#intro');
    if (!el || reduced) {
      if (el) el.classList.add('done');
      document.documentElement.classList.remove("introing");
      done();
      return;
    }
    var seen = false;
    try { seen = sessionStorage.getItem('introSeen') === '1'; } catch (e) {}
    if (seen) {
      el.classList.add('done');
      document.documentElement.classList.remove("introing");
      done();
      return;
    }
    try { sessionStorage.setItem('introSeen', '1'); } catch (e) {}

    var ct = $('.ct', el);
    requestAnimationFrame(function () { el.classList.add('lift'); });

    var t0 = performance.now(), DUR = 900;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / DUR);
      var eased = 1 - Math.pow(1 - p, 3);
      if (ct) ct.textContent = String(Math.round(eased * 100)).padStart(3, '0');
      if (p < 1) requestAnimationFrame(tick);
      else {
        $$('.col', el).forEach(function (c, i) { c.style.transitionDelay = (i * 0.06) + 's'; });
        el.classList.add('go');
        document.documentElement.classList.remove("introing");
        done();
        setTimeout(function () { el.classList.add('done'); }, 1500);
      }
    })(t0);
  }

  /* The custom cursor lived here. It was removed: replacing the system pointer
     means owning its legibility over every ground the page has — paper, the ink
     band, the footer, a greyscale portrait — and it took `cursor:none` off the
     text fields with it. Hover is communicated by the accent swap and the
     hairline underline already on every link. */

  /* ── SCROLL ────────────────────────────────────────────────────────────── */
  /* One scroll listener for the whole page, batched into a frame.

     The progress bar and the back-to-top button each used to register their
     own scroll and resize handlers, and each called getBoundingClientRect on
     every event. Two forced layouts per scroll event, on a page that runs to
     23,000px. They now subscribe here instead: the browser fires once, we
     measure once on the next frame, and every subscriber reads the same
     numbers. Adding a third thing that watches the scroll position costs one
     more line and no more measuring. */
  var watchers = [];
  function onScroll(fn) { watchers.push(fn); }

  function scrollLoop() {
    var queued = false;
    var flush = function () {
      queued = false;
      for (var i = 0; i < watchers.length; i++) watchers[i]();
    };
    var request = function () {
      // A hidden tab gets no animation frames, so batching there would park
      // the progress bar and the back-to-top button at whatever they read when
      // the tab went away — and leave them stale until it comes back. Nothing
      // is painting anyway, so the measurement is cheap: just take it.
      if (document.hidden) return flush();
      if (queued) return;
      queued = true;
      requestAnimationFrame(flush);
    };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    addEventListener('visibilitychange', request);
    flush();
  }

  /* ── READING PROGRESS ──────────────────────────────────────────────────── */
  /* The bar measures the article, not the document. Against scrollHeight it
     spent its last stretch filling up through the next-project card and the
     footer, so it read 90% while the reader had in fact finished — which is
     the one thing a progress indicator must not do. The track runs from the
     top of <main> to the top of whatever closes the article (the next-project
     card, the back-home block, or the footer), and it is full when the last
     section has been read. */
  function progress() {
    var el = $('#prog');
    if (!el) return;
    var main = $('#main');
    var tail = articleEnd();
    onScroll(function () {
      var p;
      if (main && tail) {
        var start = main.getBoundingClientRect().top + scrollY;
        var span = (tail.getBoundingClientRect().top + scrollY) - start - innerHeight;
        p = span > 0 ? (scrollY - start) / span : (scrollY > start ? 1 : 0);
      } else {
        var h = document.documentElement.scrollHeight - innerHeight;
        p = h > 0 ? scrollY / h : 0;
      }
      el.style.setProperty('--p', Math.max(0, Math.min(1, p)));
    });
  }

  /* Whatever closes the article: the next-project card, the back-home block,
     or the footer. Both the progress bar and the back-to-top button stop at
     it, and they have to agree on where it is. */
  function articleEnd() { return $('.next') || $('.backhome') || $('footer'); }

  /* ── GAME LAUNCHER: fade in past the hero ──────────────────────────────── */
  /* Was a side effect inside the progress bar, which meant the launcher only
     appeared on pages that happened to carry a progress bar. It is its own
     concern; see game.css for what body.scrolled does with it. */
  function launcherFade() {
    if (!$('#game-launch')) return;
    onScroll(function () {
      document.body.classList.toggle('scrolled', scrollY > innerHeight * 0.6);
    });
  }

  /* ── SECTION REVEAL ────────────────────────────────────────────────────── */
  /* One treatment, applied to sections. Anything marked [data-reveal] fades and
     rises once as it arrives; its contents are not observed and do not animate
     separately. The per-element ladder this replaced observed every paragraph,
     figure, rule and image on the page and staggered them with data-delay,
     which meant six things moving in one viewport.

     A section is a large target, so the observer fires on a low threshold: at
     0.04 a section taller than the viewport would otherwise have to be almost
     entirely past the fold before 4% of it counted as visible. */
  var SEL = '[data-reveal]';
  var revealed = false;

  // Sweep anything already in view that the observer has not caught — covers
  // layout shifts from late web fonts or images.
  //
  // `all` skips the viewport test and reveals everything. The failsafe at the
  // end of boot() passes it: its job is to guarantee nothing stays hidden, and
  // re-running the same measurement that failed cannot do that. A viewport of
  // zero height — a background tab in some embedders, a print context — makes
  // the test below false for every element on the page, so without this the
  // last line of defence leaves the whole document at opacity 0.
  function revealOnScreen(all) {
    $$(SEL + ':not(.in)').forEach(function (e) {
      if (all) return e.classList.add('in');
      var r = e.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) e.classList.add('in');
    });
  }

  function reveals() {
    if (revealed) return;
    revealed = true;
    var els = $$(SEL);
    if (!els.length) return;
    if (reduced || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    els.forEach(function (el) {
      // Anything already on screen reveals now rather than waiting on the
      // observer — above-the-fold content must never depend on a callback.
      var r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) el.classList.add('in');
      else io.observe(el);
    });
  }

  /* ── NAV: active section + mobile menu ─────────────────────────────────── */
  function nav() {
    var links = $$('.nav-links a[href^="#"]');
    if (links.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      links.forEach(function (a) {
        var s = document.getElementById(a.getAttribute('href').slice(1));
        if (s) io.observe(s);
      });
    }
    var burger = $('.burger');
    if (!burger) return;
    // The visible word is real text, not a CSS ::after, so it is part of the
    // button's accessible name — and it has to stay in step with the state or
    // the name says "Menu" while the button says "Close".
    var burgerT = $('.b-t', burger);
    // The open menu covers the whole screen except the bar holding this button,
    // so everything else is made inert while it is up. Without that, tabbing
    // past the last menu link walked focus into the page hidden underneath.
    var bar = burger.closest('nav');
    var behind = $$('body > *').filter(function (el) {
      return el !== bar && el.id !== 'menu' && el.tagName !== 'SCRIPT';
    });
    var setOpen = function (open) {
      document.body.classList.toggle('menu-on', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (burgerT) burgerT.textContent = open ? 'Close' : 'Menu';
      behind.forEach(function (el) { el.inert = open; });
    };
    setOpen(false);
    var close = function (refocus) {
      if (!document.body.classList.contains('menu-on')) return;
      setOpen(false);
      // send focus back to the control that opened it, or it lands at the top
      // of the document with no indication of what just happened
      if (refocus) burger.focus();
    };
    burger.addEventListener('click', function () {
      setOpen(!document.body.classList.contains('menu-on'));
    });
    $$('#menu a').forEach(function (a) { a.addEventListener('click', function () { close(false); }); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    // Widen the window past the nav's breakpoint with the menu open and the
    // burger that closes it disappears, leaving a full-screen menu and an
    // inert page behind it. Matches the 1024px collapse in swiss.css.
    matchMedia('(min-width:1025px)').addEventListener('change', function (e) {
      if (e.matches) close(false);
    });
  }

  /* ── GAME LAUNCHER: stand down over the footer ─────────────────────────── */
  // Pinned bottom-right, it sat exactly on top of the footer's "Back to top"
  // link — one control covering another. Watch the footer rather than guessing
  // a scroll offset, so it stays right whatever the footer's height becomes.
  function launcher() {
    var btn = $('#game-launch'), foot = $('footer');
    if (!btn || !foot || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (en) {
      document.body.classList.toggle('foot-in', en[0].isIntersecting);
    }, { rootMargin: '0px 0px -12% 0px' }).observe(foot);
  }

  /* ── BACK TO TOP ───────────────────────────────────────────────────────── */
  /* Only present on the long pages. It shows once the reader is past the first
     screen and stands down again as the footer arrives, since the footer
     carries the same link. Focus follows the scroll: without it a
     keyboard user is returned to the top visually while their tab position is
     still several thousand pixels down the page. */
  function toTop() {
    var btn = $('#totop');
    if (!btn) return;
    // Two measured edges rather than one guessed screen height. It appears
    // once the first section has actually been read, and it stands down over
    // the next-project card as well as the footer — the card is a link the
    // size of the viewport, and a floating button was landing on top of it.
    var first = $('main .section, main .warm-band, main .dark-band');
    var tail = articleEnd();
    onScroll(function () {
      var gate = first
        ? first.getBoundingClientRect().bottom + scrollY
        : innerHeight * 1.1;
      var on = scrollY > gate;
      if (on && tail) on = tail.getBoundingClientRect().top > innerHeight * 0.88;
      document.body.classList.toggle('totop-on', on);
    });

    btn.addEventListener('click', toTopNow);
  }

  /* The same journey, from the link in the footer. That link used to carry an
     onclick attribute with the scroll call written inline in the markup — on
     eight pages, and with no focus handling, so a keyboard user was returned
     to the top of the page visually while their tab position stayed several
     thousand pixels down it. */
  function toTopNow(e) {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    var m = $('#main');
    if (m) m.focus({ preventScroll: true });
  }

  function footerTop() {
    var link = $('.f-top');
    if (link) link.addEventListener('click', toTopNow);
  }

  /* ── PRINT (résumé only) ───────────────────────────────────────────────── */
  /* The last inline handler on the site. Bound here rather than written into
     the markup so that every behaviour on the page is in one file, and so a
     Content-Security-Policy without unsafe-inline would not quietly break the
     one button that produces the PDF. */
  function printButton() {
    var btn = $('.print-btn');
    if (btn) btn.addEventListener('click', function () { window.print(); });
  }

  /* ── IMAGE LIGHTBOX ────────────────────────────────────────────────────── */
  /* The app screens are the evidence the page is built on, and at 300px in a
     four-up row they are a texture rather than a screenshot. Every figure and
     photograph that is not already a link becomes a button wrapping its own
     image; opening one shows the full-size render with the caption it already
     had underneath it, so the overlay says the same thing the page did.

     A native <dialog>: showModal() supplies the focus trap, Escape, the inert
     background and the return of focus to the thumbnail that opened it. What
     is left to write is the backdrop click, the caption, and staying out of
     the way of anything already wrapped in an <a>. */
  var LB_SEL = 'main .appshot .device-img, main .phone-col .device-img, ' +
               'main .phone-col .phone, main .artifact img, ' +
               'main .walk-media img, main .photo, main .img';

  function lightbox() {
    if (!('showModal' in document.createElement('dialog'))) return;
    var imgs = $$(LB_SEL).filter(function (im) { return !im.closest('a'); });
    if (!imgs.length) return;

    var dlg = document.createElement('dialog');
    dlg.id = 'lb';
    dlg.setAttribute('aria-label', 'Enlarged image');
    dlg.innerHTML =
      '<button type="button" class="lb-x" aria-label="Close image">' +
        '<span aria-hidden="true">&#10005;</span>' +
      '</button>' +
      '<figure class="lb-fig">' +
        '<img class="lb-img" alt="">' +
        '<figcaption class="lb-cap"></figcaption>' +
      '</figure>';
    document.body.appendChild(dlg);
    var lbImg = $('.lb-img', dlg), lbCap = $('.lb-cap', dlg);

    // Everything the overlay owns outside the dialog itself, undone. Called
    // from every close path rather than from the close event alone: not every
    // engine fires that event for a programmatic close, and the scroll lock is
    // not something to leave on if one of them doesn't.
    function done() {
      document.body.classList.remove('lb-on');
      document.body.style.paddingRight = '';
      lbImg.removeAttribute('src');
      if (map) map.close();
    }
    // Built on the first diagram opened, not on load: most pages have none.
    var map = null;
    function shut() { if (dlg.open) dlg.close(); done(); }

    // The caption already exists on the page in one of three shapes. Carry it
    // across rather than inventing a second one that can drift out of step.
    function captionFor(im, btn) {
      var fig = im.closest('figure');
      var inFig = fig && $('.appshot-c, figcaption', fig);
      if (inFig) return { html: inFig.innerHTML, plain: false };
      var sib = btn.nextElementSibling;
      if (sib && sib.classList.contains('cap')) return { html: sib.innerHTML, plain: true };
      // An artefact on a plate carries its caption under the plate, not the image
      var plate = im.closest('.artifact');
      sib = plate && plate.nextElementSibling;
      if (sib && sib.classList.contains('cap')) return { html: sib.innerHTML, plain: true };
      var row = im.closest('.walk-row');
      var t = row && $('.walk-t', row);
      if (t) return { html: t.textContent, plain: true };
      return { html: im.alt || '', plain: true };
    }

    imgs.forEach(function (im) {
      var btn = document.createElement('button');
      // A diagram carrying data-map opens as a map to move around in, from a
      // larger render than the page shows. The cue says so on the page itself:
      // a zoom-in cursor alone doesn't tell anyone they'll be able to pan.
      var isMap = !!im.getAttribute('data-map');
      btn.type = 'button';
      btn.className = isMap ? 'zoom is-map' : 'zoom';
      btn.setAttribute('aria-label', (isMap ? 'Explore diagram' : 'Enlarge image') + (im.alt ? ': ' + im.alt : ''));
      im.parentNode.insertBefore(btn, im);
      btn.appendChild(im);
      if (isMap) {
        btn.insertAdjacentHTML('beforeend',
          '<span class="map-cue" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
          'stroke-width="2" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/>' +
          '<path d="M10.5 7.8v5.4"/><path d="M7.8 10.5h5.4"/></svg>Zoom in</span>');
        // The larger render is fetched on intent, so it's usually in hand by
        // the time the click lands, and pages that are only read never pay for it.
        var warm = function () {
          im.getAttribute('data-map').trim().split(/\s+/).forEach(function (u) { new Image().src = u; });
        };
        btn.addEventListener('pointerenter', warm, { once: true });
        btn.addEventListener('focus', warm, { once: true });
      }
      btn.addEventListener('click', function () {
        var cap = captionFor(im, btn);
        dlg.classList.toggle('is-map', isMap);
        dlg.setAttribute('aria-label', isMap ? 'Zoomable diagram' : 'Enlarged image');
        if (!isMap) {
          lbImg.src = im.currentSrc || im.src;
          lbImg.alt = im.alt || '';
        }
        lbCap.innerHTML = cap.html;
        lbCap.hidden = !cap.html;
        lbCap.classList.toggle('is-plain', cap.plain);
        // .is-doc images are desaturated on the page; the overlay is the same
        // image larger, not a differently graded one.
        dlg.classList.toggle('is-doc', im.classList.contains('is-doc'));
        // Locking the page removes the scrollbar with it; hold its width so
        // the article behind the scrim doesn't jump a few pixels sideways.
        var sbw = innerWidth - document.documentElement.clientWidth;
        if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
        document.body.classList.add('lb-on');
        dlg.showModal();
        // After showModal, not before: the map frames itself to the viewport
        // it measures, and a closed dialog measures nothing.
        if (isMap) (map = map || mapView(dlg)).open(im, cap.html);
      });
    });

    // Click outside the figure. The dialog fills the viewport, so anything
    // that lands on the dialog itself rather than on its contents is outside.
    dlg.addEventListener('click', function (e) { if (e.target === dlg) shut(); });
    $('.lb-x', dlg).addEventListener('click', shut);
    // Escape: take the cancel over rather than letting the default close run,
    // so the page is unlocked on the same tick the dialog goes.
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); shut(); });
    dlg.addEventListener('close', done);
  }

  /* ── DIAGRAM MAP ───────────────────────────────────────────────────────── */
  /* A flowchart is read by following it, and at the page's measure its boxes
     are four pixels tall. So a diagram with data-map opens full screen as a
     map: it moves the way Figma does, since that is where it was drawn.
     Scroll or drag pans, pinch or ⌘/Ctrl + scroll zooms, double-click zooms in
     at the pointer, and the bar carries buttons for anyone without a trackpad.

       data-map       the larger render, one file or several stacked bands
                      (a very tall render is cut in equal bands so no single
                      image has to be decoded at 30 megapixels)
       data-map-size  its full size in pixels, "3000x9810"
       data-map-view  the part the page shows, as fractions "x y w h". The map
                      opens framed on it, so the first thing you see is the
                      thing you clicked, only bigger

     The view is kept in fractions so a sharper export can replace the files
     with only data-map-size changing. The sheet is one transformed element;
     will-change goes on only while it's moving, because a layer promoted for
     good is rastered once and then just stretched, and zoomed text goes soft. */
  function mapView(dlg) {
    var mac = /Mac|iP(hone|ad|od)/.test(navigator.platform || navigator.userAgent);
    var coarse = document.documentElement.classList.contains('coarse');
    var box = document.createElement('div');
    box.className = 'lb-map';
    box.innerHTML =
      '<div class="lb-stage" role="img"><div class="lb-sheet"></div></div>' +
      '<p class="lb-hint" aria-hidden="true">' + (coarse
        ? 'Drag to move · Pinch to zoom'
        : 'Scroll or drag to move · Pinch or ' + (mac ? '⌘' : 'Ctrl') + ' + scroll to zoom') + '</p>' +
      '<div class="lb-bar">' +
        '<p class="lb-mcap"></p>' +
        '<div class="lb-ctl">' +
          '<button type="button" class="lb-btn" data-z="out" aria-label="Zoom out">&minus;</button>' +
          '<output class="lb-pct"></output>' +
          '<button type="button" class="lb-btn" data-z="in" aria-label="Zoom in">+</button>' +
          '<button type="button" class="lb-btn lb-fit" data-z="fit" aria-label="Show the whole diagram">Fit</button>' +
        '</div>' +
      '</div>';
    dlg.appendChild(box);

    var stage = $('.lb-stage', box), sheet = $('.lb-sheet', box), bar = $('.lb-bar', box),
        mcap = $('.lb-mcap', box), pct = $('.lb-pct', box), hint = $('.lb-hint', box),
        bOut = $('[data-z="out"]', box), bIn = $('[data-z="in"]', box), xBtn = $('.lb-x', dlg);
    var MAX = 2;                       // renders are ~1x; past 2x it's blur
    var W = 1, H = 1, s = 1, x = 0, y = 0, minS = 0.1, src = '';
    var pts = new Map(), g = null, multi = false, lastTap = null, lastType = 'mouse';
    var idleT = 0, animT = 0, hintT = 0, gs = 1;

    // The rectangle the map is framed in: clear of the close button above
    // and the bar below, so "fit" never tucks an edge under either.
    function area() {
      var vw = stage.clientWidth, vh = stage.clientHeight, pad = vw < 700 ? 12 : 32;
      return { l: pad, t: xBtn.getBoundingClientRect().bottom + 8, r: vw - pad, b: vh - bar.offsetHeight - pad };
    }
    function fitScale(w, h, a) { return Math.min((a.r - a.l) / w, (a.b - a.t) / h); }
    function clampS(v) { return Math.max(minS, Math.min(MAX, v)); }
    // Smaller than the frame on an axis: centred on it. Larger: its edges can
    // come in as far as the frame's and no further, so it can't be lost.
    function clamp(a) {
      var sw = W * s, sh = H * s, aw = a.r - a.l, ah = a.b - a.t;
      x = sw <= aw ? a.l + (aw - sw) / 2 : Math.min(a.l, Math.max(a.r - sw, x));
      y = sh <= ah ? a.t + (ah - sh) / 2 : Math.min(a.t, Math.max(a.b - sh, y));
    }
    function paint() {
      sheet.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + s + ')';
      pct.textContent = Math.round(s * 100) + '%';
      bOut.disabled = s <= minS * 1.001;
      bIn.disabled = s >= MAX * 0.999;
    }
    function moving() {
      sheet.classList.add('is-moving');
      clearTimeout(idleT);
      idleT = setTimeout(function () { sheet.classList.remove('is-moving'); }, 180);
    }
    // Buttons and keys glide; fingers, wheels and drags never do, or the map
    // lags a beat behind the hand moving it.
    function glide(on) {
      sheet.classList.toggle('is-anim', on);
      clearTimeout(animT);
      if (on) animT = setTimeout(function () { sheet.classList.remove('is-anim'); }, 360);
    }
    function commit(animate) { clamp(area()); glide(!!animate); moving(); paint(); }
    // Zoom to ns keeping the map point under (px, py) where it is.
    function zoom(ns, px, py, animate) {
      ns = clampS(ns);
      x = px - (px - x) * ns / s;
      y = py - (py - y) * ns / s;
      s = ns;
      commit(animate);
    }
    function frame(fx, fy, fw, fh, animate) {
      var a = area(), rw = fw * W, rh = fh * H;
      minS = Math.min(fitScale(W, H, a), MAX);
      s = clampS(fitScale(rw, rh, a));
      x = a.l + (a.r - a.l - rw * s) / 2 - fx * W * s;
      y = a.t + (a.b - a.t - rh * s) / 2 - fy * H * s;
      commit(animate);
    }
    function whole(animate) { frame(0, 0, 1, 1, animate); }
    function centre() { var a = area(); return [(a.l + a.r) / 2, (a.t + a.b) / 2]; }
    function zoomIn(px, py) { if (s >= MAX * 0.999) whole(true); else zoom(s * 2, px, py, true); }
    function pan(dx, dy, animate) { x += dx; y += dy; commit(animate); }
    function quiet() { clearTimeout(hintT); hint.classList.add('is-gone'); }

    // ── pointer: one finger pans, two pinch, and lifting one of two carries
    //    on as a pan from wherever the other finger is
    function begin() {
      var p = Array.from(pts.values());
      if (p.length === 1) g = { x0: p[0].x, y0: p[0].y, sx: x, sy: y };
      else {
        var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
        g = { pinch: true, s0: s, d0: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1,
              ux: (mx - x) / s, uy: (my - y) / s };
      }
    }
    stage.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      lastType = e.pointerType;
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: e.timeStamp });
      if (pts.size > 1) multi = true;
      begin();
      stage.classList.add('is-grabbing');
      glide(false); quiet();
    });
    stage.addEventListener('pointermove', function (e) {
      var p = pts.get(e.pointerId);
      if (!p || !g) return;
      p.x = e.clientX; p.y = e.clientY;
      var q = Array.from(pts.values());
      if (g.pinch && q.length > 1) {
        var mx = (q[0].x + q[1].x) / 2, my = (q[0].y + q[1].y) / 2;
        s = clampS(g.s0 * Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y) / g.d0);
        x = mx - g.ux * s;
        y = my - g.uy * s;
      } else if (!g.pinch) {
        x = g.sx + p.x - g.x0;
        y = g.sy + p.y - g.y0;
      }
      commit(false);
    });
    function up(e) {
      var p = pts.get(e.pointerId);
      if (!p) return;
      pts.delete(e.pointerId);
      // A touch that barely moved, twice in quick succession, is a double tap.
      var tap = e.type === 'pointerup' && e.pointerType === 'touch' && !multi &&
                Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 10 && e.timeStamp - p.t < 300;
      if (pts.size) begin();
      else { g = null; multi = false; stage.classList.remove('is-grabbing'); }
      if (!tap) return;
      if (lastTap && e.timeStamp - lastTap.t < 320 &&
          Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        zoomIn(e.clientX, e.clientY);
        lastTap = null;
      } else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('dblclick', function (e) {
      if (lastType === 'touch') return;   // handled as a double tap above
      e.preventDefault();
      if (e.shiftKey) zoom(s / 2, e.clientX, e.clientY, true);
      else zoomIn(e.clientX, e.clientY);
    });

    // ── wheel: a trackpad pinch arrives as a wheel event with ctrlKey set, so
    //    it and ⌘/Ctrl + wheel zoom; everything else is a scroll, and pans
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      quiet(); glide(false);
      var k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? stage.clientHeight : 1;
      if (e.ctrlKey || e.metaKey) {
        zoom(s * Math.exp(-Math.max(-40, Math.min(40, e.deltaY * k)) * 0.01), e.clientX, e.clientY);
      } else pan(-e.deltaX * k, -e.deltaY * k);
    }, { passive: false });
    // Safari's trackpad pinch is a gesture event instead. On iOS the same
    // pinch also arrives as two pointers, which already handle it.
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); gs = s; quiet(); });
    stage.addEventListener('gesturechange', function (e) {
      e.preventDefault();
      if (pts.size) return;
      var c = centre();
      zoom(gs * e.scale, e.clientX || c[0], e.clientY || c[1]);
    });
    stage.addEventListener('gestureend', function (e) { e.preventDefault(); });

    // ── buttons and keys, zooming about the middle of the frame
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]');
      if (!b) return;
      var c = centre(), z = b.getAttribute('data-z');
      quiet();
      if (z === 'in') zoom(s * 1.5, c[0], c[1], true);
      else if (z === 'out') zoom(s / 1.5, c[0], c[1], true);
      else whole(true);
    });
    dlg.addEventListener('keydown', function (e) {
      if (!dlg.classList.contains('is-map') || e.altKey || e.ctrlKey || e.metaKey) return;
      var c = centre(), step = e.shiftKey ? 240 : 80, k = e.key;
      if (k === '+' || k === '=') zoom(s * 1.5, c[0], c[1], true);
      else if (k === '-' || k === '_') zoom(s / 1.5, c[0], c[1], true);
      else if (k === '0') whole(true);
      else if (k === 'ArrowLeft') pan(step, 0, true);
      else if (k === 'ArrowRight') pan(-step, 0, true);
      else if (k === 'ArrowUp') pan(0, step, true);
      else if (k === 'ArrowDown') pan(0, -step, true);
      else return;
      e.preventDefault();
      quiet();
    });

    // A resize keeps the zoom and the point in the middle, within the new limits.
    function onResize() {
      var a = area();
      minS = Math.min(fitScale(W, H, a), MAX);
      s = clampS(s);
      commit(false);
    }

    function open(im, capHtml) {
      var list = im.getAttribute('data-map').trim().split(/\s+/),
          size = (im.getAttribute('data-map-size') || '').split('x'),
          v = (im.getAttribute('data-map-view') || '0 0 1 1').trim().split(/\s+/).map(Number);
      W = +size[0] || 1; H = +size[1] || 1;
      if (src !== im.getAttribute('data-map')) {
        src = im.getAttribute('data-map');
        sheet.innerHTML = '';
        sheet.style.width = W + 'px';
        sheet.style.height = H + 'px';
        list.forEach(function (u) {
          var t = new Image();
          t.alt = ''; t.draggable = false; t.decoding = 'async';
          t.width = W; t.height = Math.round(H / list.length);   // cut in equal bands
          t.src = u;
          sheet.appendChild(t);
        });
      }
      stage.setAttribute('aria-label', im.alt || '');
      mcap.innerHTML = capHtml || '';
      mcap.hidden = !capHtml;
      hint.classList.remove('is-gone');
      clearTimeout(hintT);
      hintT = setTimeout(quiet, 6000);
      frame(v[0], v[1], v[2], v[3], false);
      window.addEventListener('resize', onResize);
    }
    function close() {
      window.removeEventListener('resize', onResize);
      pts.clear(); g = null; multi = false;
      stage.classList.remove('is-grabbing');
    }
    return { open: open, close: close };
  }

  /* ── GRID OVERLAY (press G) ────────────────────────────────────────────── */
  function gridOverlay() {
    var ov = $('#gridov');
    if (!ov) return;
    for (var i = 0; i < 12; i++) ov.appendChild(document.createElement('i'));

    // The overlay is purely visual, so a screen reader gets told about it
    // instead: an off-screen live region that announces each toggle.
    var say = document.createElement('div');
    say.className = 'sr-only';
    say.setAttribute('role', 'status');
    say.setAttribute('aria-live', 'polite');
    document.body.appendChild(say);

    addEventListener('keydown', function (e) {
      if (e.key !== 'g' && e.key !== 'G') return;
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var on = document.body.classList.toggle('grid-on');
      say.textContent = on ? '12-column grid overlay shown' : '12-column grid overlay hidden';
    });
  }

  /* ── THE GAME, FETCHED ON DEMAND ───────────────────────────────────────── */
  /* game.js and game.css are 52KB gzipped — nearly three times the rest of the
     site's script — for an easter egg behind a corner button. They used to load
     on every homepage visit, with the stylesheet render-blocking in <head>.

     Now the page ships the launcher and nothing else, and the first press of it
     (or of B) fetches the pair. The button reports back through its own label
     while that happens, because on a slow connection the gap between the click
     and the bridge appearing is otherwise unexplained.

     The one thing this has to get right: game.js binds its own listeners when
     it runs, and those bindings are what start the game. So the click that
     triggered the fetch has to be replayed once the script is in — which is
     what start() does after the load resolves. */
  function game() {
    /* Two ways in, and no page has both. The homepage has the corner launcher,
       which is the easter egg. lab.html lists the game as a project and opens
       it from a named link in that entry, because a project you are being told
       about should not also have to be stumbled upon. Either control loads the
       pair the same way, so whichever one was pressed is the one that has to
       report back and the one whose press gets replayed. */
    var ctrls = [$('#game-launch'), $('#play-game')].filter(Boolean);
    if (!ctrls.length) return;
    var state = 'idle';

    // The stylesheet has to be in before the stage is opened and before
    // game.js measures anything, so it is awaited rather than fired and
    // forgotten. The script is only appended once the CSS has landed.
    function load() {
      var stage = $('#astro-stage');
      return new Promise(function (resolve, reject) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'css/game.css';
        css.onload = resolve;
        css.onerror = reject;
        document.head.appendChild(css);
      }).then(function () {
        if (stage) stage.hidden = false;
        return new Promise(function (resolve, reject) {
          var js = document.createElement('script');
          js.src = 'js/game.js';
          js.onload = resolve;
          js.onerror = reject;
          document.body.appendChild(js);
        });
      });
    }

    /* The launcher's own word (.gl-t) is collapsed to nothing until you hover
       it, so on the homepage the waiting is announced through the aria-label
       and nowhere else. The Experiments link is a word on screen with no label
       of its own, so there the word itself changes. Rewriting the label on that
       one instead would leave the accessible name saying one thing while the
       button said another. */
    function start(from) {
      if (state === 'ready') return from.click();
      if (state === 'loading') return;
      state = 'loading';
      var slot  = from.querySelector('.gl-t') || from;
      var word  = slot.textContent;
      var label = from.getAttribute('aria-label');
      slot.textContent = 'Loading…';
      if (label !== null) from.setAttribute('aria-label', 'Loading the bridge…');
      var settle = function (ready) {
        state = ready ? 'ready' : 'idle';
        slot.textContent = word;
        if (label !== null) from.setAttribute('aria-label', label);
      };
      load().then(function () {
        settle(true);
        from.click();         // replay the press that asked for it
      }, function () {
        settle(false);
      });
    }

    ctrls.forEach(function (el) {
      el.addEventListener('click', function (e) {
        if (state === 'ready') return;   // game.js owns the click from here
        e.preventDefault();
        e.stopImmediatePropagation();
        start(el);
      });
    });

    // B launches too, so the game stays reachable with the keyboard alone. It
    // reports on the first control the page has, which is the only one it has.
    addEventListener('keydown', function (e) {
      if (state !== 'idle') return;    // once loaded, game.js has its own binding
      if (e.key !== 'b' && e.key !== 'B') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || e.target.isContentEditable) return;
      e.preventDefault();
      start(ctrls[0]);
    });
  }

  /* ── BOOT ──────────────────────────────────────────────────────────────── */
  function boot() {
    document.documentElement.dataset.swiss = '1';
    theme(); nav(); gridOverlay(); lightbox(); footerTop(); printButton();
    progress(); launcherFade(); toTop(); launcher(); game();
    scrollLoop();
    intro(reveals);
    addEventListener('load', function () { revealOnScreen(false); });
    // failsafe: never let the curtain trap the page, and never leave content hidden
    setTimeout(function () {
      var el = $('#intro');
      if (el && !el.classList.contains('done')) { el.classList.add('go'); document.documentElement.classList.remove('introing'); }
      reveals();
      revealOnScreen(true);
    }, 3500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
