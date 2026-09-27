/* Review Coach landing — the motion layer.

   The same motion vocabulary as consensuslabs.net, re-derived for a static page
   with no build step: GSAP + ScrollTrigger + SplitText and Lenis are vendored
   globals, and the react-bits effects the Astro site uses (RotatingText,
   DecryptedText, Magnet, SpotlightCard, FlowingMenu) are rewritten by hand.

   THE RULES
   1. Opacity and transform only. Nothing here writes height, margin or width,
      so the reduced-motion render is a layout oracle (see scripts/verify.mjs):
      the two documents may differ by the pinned track's scroll distance and
      by nothing else.
   2. prefers-reduced-motion is a hard stop: no Lenis, no curtain, no pin, no
      Vanta, every element in its final state. The menu still works.
   3. Fail safe. The curtain is display:none until armed; storage access is
      wrapped because it can THROW, not just return null; if this file never
      reports ready, the page's 3s timer drops .js-motion and shows everything. */
(() => {
  'use strict';

  const de = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  setupMenu();

  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) { de.classList.remove('js-motion'); return; }
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);

  let storageOK = true;
  const introSeen = (() => {
    try { return sessionStorage.getItem('rc-intro') === '1'; }
    catch { storageOK = false; return true; }
  })();
  const firstVisit = !reduced && storageOK && !introSeen;

  const lenis = reduced ? null : initLenis();
  wireAnchors();
  navProgress();
  setupSpotlight();
  setupScrollSpy();
  nativeRail();
  $$('details').forEach((d) => d.addEventListener('toggle', () => ScrollTrigger.refresh()));

  if (reduced) {
    $('#curtain')?.classList.add('is-done');
    window.__rcPin = 0;
    window.__rcReady = true;
    return;
  }

  playIntro();
  runMotion();
  window.__rcReady = true;
  de.classList.add('motion-ready');

  /* ------------------------------------------------------------------ */

  function initLenis() {
    if (!window.Lenis) return null;
    const l = new window.Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false, // touch keeps native momentum
      autoRaf: false,
    });
    l.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => l.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = l;
    return l;
  }

  /* One scroll authority for in-page links. Without Lenis the browser jumps
     natively and `scroll-margin-top` keeps the target clear of the header. */
  function wireAnchors() {
    if (!lenis) return;
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const hash = a.getAttribute('href');
        if (!hash || hash.length < 2) return;
        const target = hash === '#top' ? 0 : $(hash);
        if (target === null) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: hash === '#top' ? 0 : -64, duration: 1.1 });
      });
    });
  }

  function navProgress() {
    gsap.to('#navProgress', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: 'main', start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
  }

  /* Shown once per tab: a visitor coming back from /github should not sit
     through it again. */
  function playIntro() {
    const curtain = $('#curtain');
    const count = $('#curtainCount');
    if (!curtain || !count) return;
    if (!firstVisit) { curtain.classList.add('is-done'); return; }
    try { sessionStorage.setItem('rc-intro', '1'); } catch { /* plays once, not idempotently */ }

    curtain.classList.add('is-armed');
    lenis?.stop();
    const n = { v: 0 };
    gsap.timeline({
      onComplete: () => {
        curtain.classList.add('is-done');
        lenis?.start();
        ScrollTrigger.refresh();
      },
    })
      .to(n, { v: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { count.textContent = String(Math.round(n.v)).padStart(3, '0'); } })
      .to('#curtainBar', { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 0)
      .to('.curtain-inner, #curtainBar', { opacity: 0, duration: 0.3, ease: 'power2.in' })
      .to(curtain, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' }, '-=0.1');
  }

  function runMotion() {
    const introDelay = firstVisit ? 1.95 : 0.15;

    // ----- hero -----
    gsap.fromTo('.hero-meta', { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', delay: introDelay });
    gsap.fromTo('[data-hero-reveal]', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: introDelay + 0.55 });
    gsap.from('.hero-grid', { opacity: 0, scale: 1.08, duration: 1.6, ease: 'power2.out', delay: introDelay });
    const heroReady = () => de.classList.add('hero-ready');
    setTimeout(heroReady, 4000); // fonts that never settle must not hide the title
    document.fonts.ready.then(() => {
      if (SplitText) {
        const split = new SplitText('#heroTitle', { type: 'lines', mask: 'lines' });
        gsap.from(split.lines, { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.09, delay: introDelay });
      }
      heroReady();
      ScrollTrigger.refresh();
    });
    gsap.to('.hero .wrap', {
      yPercent: 14, opacity: 0.35, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
    gsap.to('.scroll-hint .sh-line', { scaleX: 0.25, duration: 1, ease: 'power2.inOut', repeat: -1, yoyo: true });
    rotate($('#rot'), introDelay + 1.2);
    decrypt($('#heroGeo'), introDelay + 0.2);
    if (finePointer) $$('.magnet').forEach(magnet);
    stageDemo(introDelay + 1.3);

    ticker();

    // ----- section titles: masked line rise -----
    document.fonts.ready.then(() => {
      if (!SplitText) return;
      $$('[data-split]').forEach((el) => {
        const s = new SplitText(el, { type: 'lines', mask: 'lines' });
        gsap.from(s.lines, { yPercent: 110, duration: 0.9, ease: 'power4.out', stagger: 0.08, scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
      ScrollTrigger.refresh();
    });

    // ----- generic reveals -----
    $$('[data-reveal]').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
    });

    // ----- the app illustration: cards are dealt in -----
    gsap.fromTo('.app-card', { opacity: 0, x: 40 }, {
      opacity: 1, x: 0, duration: 0.7, ease: 'power3.out', stagger: 0.16,
      scrollTrigger: { trigger: '#appMock', start: 'top 65%' },
    });

    setupHorizontalStack();

    gsap.fromTo('#procGrid .proc', { opacity: 0, y: 44 }, {
      opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1,
      scrollTrigger: { trigger: '#procGrid', start: 'top 85%' },
    });

    // ----- counters: the true value ships in the HTML -----
    $$('[data-count]').forEach((el) => {
      const target = parseInt(el.getAttribute('data-count') || '0', 10);
      const o = { v: 0 };
      gsap.to(o, {
        v: target, duration: 1.4, ease: 'power2.out', snap: { v: 1 },
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onStart: () => { el.textContent = '0'; },
        onUpdate: () => { el.textContent = String(o.v); },
      });
    });

    // ----- footer wordmark: per-char rise, scrubbed -----
    document.fonts.ready.then(() => {
      if (!SplitText) return;
      const fw = new SplitText('#footWord', { type: 'chars', charsClass: 'char' });
      gsap.from(fw.chars, {
        yPercent: 70, opacity: 0, ease: 'power2.out', stagger: { each: 0.04, from: 'center' },
        scrollTrigger: { trigger: '#footWord', start: 'top 102%', end: 'top 78%', scrub: 0.5 },
      });
    });

    setupFlow();
    setupVanta();
    if (finePointer) setupCursor();
  }

  /* RotatingText, by hand: the outgoing phrase leaves upward from its last
     letter, the next one rises in behind it. Every phrase is built once and
     stacked in the same grid cell (see .rot-word), so the box keeps the
     widest phrase's size and a swap never re-wraps the hero. */
  function rotate(el, delay) {
    if (!el) return;
    const words = (el.dataset.words || el.textContent).split('|');
    el.textContent = '';
    const phrases = words.map((w, k) => {
      const word = document.createElement('span');
      word.className = 'rot-word';
      const chars = [...w].map((c) => {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        word.appendChild(s);
        return s;
      });
      if (k) gsap.set(chars, { yPercent: 120, opacity: 0 });
      el.appendChild(word);
      return chars;
    });
    let i = 0;
    const tick = () => {
      const out = phrases[i];
      i = (i + 1) % phrases.length;
      gsap.to(out, { yPercent: -120, opacity: 0, duration: 0.3, ease: 'power2.in', stagger: { each: 0.012, from: 'end' } });
      gsap.fromTo(phrases[i], { yPercent: 120, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: { each: 0.018, from: 'end' }, delay: 0.22 });
    };
    setTimeout(() => setInterval(tick, 2800), delay * 1000);
  }

  /* The hero stage: three cards are dealt, a cursor keeps two (each flies
     into the pending review) and dismisses one. Two cycles, then the cards
     are dealt once more and it holds on that frame: a loop that never stops
     beside the reading copy is a distraction. Slot positions are absolute
     values read from CSS (--slot1/--slot2), never relative, so repeats cannot
     drift; every target rect is measured only once its card has settled. */
  function stageDemo(delay) {
    const stage = $('#stage');
    if (!stage) return;
    const cards = $$('.scard', stage); // front, middle, back
    const cursor = $('.stage-cursor', stage);
    const chip = $('.stage-pending', stage);
    const plus = $('.stage-plus', stage);
    if (cards.length !== 3 || !cursor || !chip || !plus) return;
    const accept = cards.map((c) => $('.scard-actions span:nth-child(1)', c));
    const dismiss = cards.map((c) => $('.scard-actions span:nth-child(3)', c));
    const stamps = cards.map((c) => $('.scard-stamp', c));
    const buttons = [...accept, ...dismiss];
    const GREEN = '#0e7a4e', INK = '#131210', PAPER = '#f7f1e3';
    const SCALE = [1, 0.95, 0.9];
    const slotY = () => {
      const css = getComputedStyle(stage);
      return [parseFloat(css.getPropertyValue('--slot1')) || 104, parseFloat(css.getPropertyValue('--slot2')) || 52, 0];
    };
    const centre = (el) => {
      const r = el.getBoundingClientRect(), st = stage.getBoundingClientRect();
      return { x: r.left - st.left + r.width / 2, y: r.top - st.top + r.height / 2 };
    };
    const dealt = { x: 0, opacity: 1, rotation: 0, duration: 0.7, ease: 'power3.out', stagger: 0.16 };
    const offDeck = () => ({
      transformOrigin: '50% 0', x: 150, opacity: 0, rotation: 7,
      y: (i) => slotY()[i], scale: (i) => SCALE[i], zIndex: (i) => 3 - i,
    });

    gsap.set(cards, offDeck()); // hidden before the first frame, no flash

    const tl = gsap.timeline({ paused: true, repeat: 1, repeatDelay: 0.8, repeatRefresh: true, onComplete: finalFrame });
    tl.set(cards, offDeck())
      .set(stamps, { opacity: 0, scale: 1.8 })
      .set(buttons, { clearProps: 'backgroundColor,color,borderColor' })
      .set(cursor, { x: () => stage.clientWidth * 0.92, y: () => stage.clientHeight * 0.96, opacity: 0, scale: 1 })
      .set(plus, { opacity: 0, y: 0 })
      .to([cards[2], cards[1], cards[0]], dealt)
      .to(cursor, { opacity: 1, duration: 0.25 }, '+=0.2');

    const click = (btn, fill) => {
      tl.to(cursor, { x: () => centre(btn).x, y: () => centre(btn).y, duration: 0.75, ease: 'power2.inOut' }, '+=0.35')
        .to(cursor, { scale: 0.82, duration: 0.09, yoyo: true, repeat: 1, ease: 'power1.inOut' })
        .to(btn, { backgroundColor: fill, borderColor: fill, color: PAPER, duration: 0.12 }, '<');
    };
    // cards behind `k` each step up one slot
    const advance = (k, at) => {
      const rest = cards.slice(k + 1);
      tl.to(rest, { y: (i) => slotY()[i], scale: (i) => SCALE[i], zIndex: (i) => 3 - i, duration: 0.5, ease: 'power3.out' }, at);
    };
    const keep = (k) => {
      click(accept[k], GREEN);
      tl.to(stamps[k], { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)' }, '<0.05');
      const fly = `fly${k}`;
      tl.addLabel(fly, '+=0.45')
        .to(cards[k], {
          transformOrigin: '50% 50%', rotation: -4, scale: 0.16, opacity: 0, duration: 0.6, ease: 'power3.in',
          x: () => centre(chip).x - centre(cards[k]).x,
          y: () => gsap.getProperty(cards[k], 'y') + centre(chip).y - centre(cards[k]).y,
        }, fly)
        .fromTo(plus, { opacity: 0, y: 6 }, { opacity: 1, y: -10, duration: 0.35, ease: 'power2.out' }, `${fly}+=0.5`)
        .to(plus, { opacity: 0, y: -22, duration: 0.4, ease: 'power2.in' }, `${fly}+=1.2`);
      advance(k, `${fly}+=0.35`);
    };
    keep(0);
    keep(1);
    click(dismiss[2], INK);
    tl.to(cards[2], { x: 160, rotation: 8, opacity: 0, duration: 0.5, ease: 'power2.in' }, '+=0.3')
      .to(cursor, { opacity: 0, duration: 0.3 }, '+=0.2')
      .to({}, { duration: 0.6 });

    // The resting frame: dealt again, the front card kept.
    function finalFrame() {
      gsap.set(stamps, { opacity: 0, scale: 1.8 });
      gsap.set(buttons, { clearProps: 'backgroundColor,color,borderColor' });
      gsap.set(cards, offDeck());
      gsap.to([cards[2], cards[1], cards[0]], dealt);
      gsap.to(accept[0], { backgroundColor: GREEN, borderColor: GREEN, color: PAPER, duration: 0.2, delay: 1.1 });
      gsap.to(stamps[0], { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.5)', delay: 1.15 });
    }

    let started = false, visible = true;
    ScrollTrigger.create({
      trigger: stage, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        visible = self.isActive;
        if (started && tl.progress() < 1) (visible ? tl.resume() : tl.pause());
      },
    });
    gsap.delayedCall(delay, () => { started = true; if (visible) tl.play(); });
  }

  /* DecryptedText, by hand: scrambled glyphs resolve left to right. */
  function decrypt(el, delay) {
    if (!el) return;
    const final = el.textContent;
    const glyphs = '01·°→#$%/<>';
    el.setAttribute('aria-label', final);
    let shown = 0;
    const draw = () => {
      let enc = '';
      for (let k = shown; k < final.length; k++) enc += final[k] === ' ' ? ' ' : glyphs[(Math.random() * glyphs.length) | 0];
      el.innerHTML = '';
      el.append(final.slice(0, shown));
      const span = document.createElement('span');
      span.className = 'enc';
      span.textContent = enc;
      el.append(span);
    };
    draw();
    setTimeout(() => {
      const iv = setInterval(() => {
        shown++;
        if (shown >= final.length) { clearInterval(iv); el.textContent = final; return; }
        draw();
      }, 28);
    }, delay * 1000);
  }

  function magnet(m) {
    const xTo = gsap.quickTo(m, 'x', { duration: 0.5, ease: 'power3' });
    const yTo = gsap.quickTo(m, 'y', { duration: 0.5, ease: 'power3' });
    const pad = 70, strength = 4;
    window.addEventListener('mousemove', (e) => {
      const r = m.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const near = Math.abs(e.clientX - cx) < r.width / 2 + pad && Math.abs(e.clientY - cy) < r.height / 2 + pad;
      xTo(near ? (e.clientX - cx) / strength : 0);
      yTo(near ? (e.clientY - cy) / strength : 0);
    }, { passive: true });
  }

  /* Velocity-reactive ticker: direction follows the scroll direction. */
  function ticker() {
    const track = $('#tickerTrack');
    if (!track) return;
    const base = track.innerHTML;
    while (track.scrollWidth < window.innerWidth * 2.5) track.innerHTML += base;
    const half = track.scrollWidth / 2;
    let x = 0, speed = 0.8, dir = -1;
    const setX = gsap.quickSetter(track, 'x', 'px');
    gsap.ticker.add(() => {
      x += speed * dir;
      if (x <= -half) x += half;
      if (x >= 0) x -= half;
      setX(x);
    });
    ScrollTrigger.create({
      trigger: '.ticker', start: 'top bottom', end: 'bottom top',
      onUpdate: (self) => {
        const v = self.getVelocity();
        if (Math.abs(v) > 40) dir = v > 0 ? -1 : 1;
        speed = 0.8 + Math.min(Math.abs(v) / 350, 6);
      },
    });
  }

  /* Pins the session section and turns vertical scroll into horizontal travel
     across the track. The distance is the track's real overflow, published
     as window.__rcPin so the layout oracle can check it to the pixel. */
  function setupHorizontalStack() {
    window.__rcPin = 0;
    const section = $('#session');
    const viewport = $('#hscroll');
    const track = $('#hscrollTrack');
    const bar = $('#hscrollBar');
    if (!section || !viewport || !track) return;
    if (matchMedia('(max-width: 900px)').matches) return; // native swipe below the breakpoint

    viewport.classList.add('is-pinned');
    viewport.scrollLeft = 0;
    viewport.removeAttribute('tabindex'); // scroll drives it now; nothing to focus
    const overflow = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    const tween = gsap.to(track, {
      x: () => -overflow(),
      ease: 'none',
      scrollTrigger: {
        trigger: section,
        start: 'top 64px',
        end: () => { window.__rcPin = overflow(); return '+=' + window.__rcPin; },
        pin: section,
        pinSpacing: true,
        scrub: 0.6,
        invalidateOnRefresh: true,
        anticipatePin: 1,
        onUpdate: (self) => { if (bar) gsap.set(bar, { scaleX: self.progress }); },
      },
    });
    // The closing card never travels past 62% of the viewport, so a lift
    // scrubbed against that line would strand it half-faded. It stays still.
    $$('.hcard:not(.hcard-end)').forEach((card) => {
      gsap.from(card.children, {
        y: 36, opacity: 0, ease: 'none', stagger: 0.04,
        scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 96%', end: 'left 62%', scrub: true },
      });
    });
  }

  /* Unpinned (reduced motion, phones), the track scrolls natively; the rail
     under it then follows scrollLeft instead of the pin's progress. */
  function nativeRail() {
    const viewport = $('#hscroll');
    const bar = $('#hscrollBar');
    if (!viewport || !bar) return;
    viewport.addEventListener('scroll', () => {
      if (viewport.classList.contains('is-pinned')) return;
      const max = viewport.scrollWidth - viewport.clientWidth;
      bar.style.transform = `scaleX(${max > 0 ? viewport.scrollLeft / max : 0})`;
    }, { passive: true });
  }

  /* SpotlightCard: a soft green light follows the pointer inside each cell. */
  function setupSpotlight() {
    $$('.svc').forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* FlowingMenu: a green marquee band slides in from the edge the pointer
     crossed, and leaves through the edge it exits by. */
  function setupFlow() {
    $$('.flow-item').forEach((item) => {
      const mq = $('.flow-marquee', item);
      const inner = $('.flow-marquee-inner', item);
      const track = $('.flow-track', item);
      if (!mq || !inner || !track) return;
      // The loop runs to -50%, so the track must be two equal halves wider than the row.
      while (track.scrollWidth < item.clientWidth * 2.2) track.innerHTML += track.innerHTML;
      const fromTop = (e) => { const r = item.getBoundingClientRect(); return e.clientY - r.top < r.height / 2; };
      item.addEventListener('mouseenter', (e) => {
        const top = fromTop(e);
        gsap.timeline({ defaults: { duration: 0.6, ease: 'expo.out' } })
          .set(mq, { yPercent: top ? -101 : 101 }, 0)
          .set(inner, { yPercent: top ? 101 : -101 }, 0)
          .to([mq, inner], { yPercent: 0 }, 0);
      });
      item.addEventListener('mouseleave', (e) => {
        const top = fromTop(e);
        gsap.timeline({ defaults: { duration: 0.6, ease: 'expo.out' } })
          .to(mq, { yPercent: top ? -101 : 101 }, 0)
          .to(inner, { yPercent: top ? 101 : -101 }, 0);
      });
    });
  }

  /* The ink panel's Vanta NET field. three.js is 150K gzipped, so nothing is
     fetched until the panel approaches, and the GL context is released when
     it leaves. A missing WebGL context just leaves the panel flat. */
  function setupVanta() {
    const mount = $('#vantaMount');
    if (!mount || !('IntersectionObserver' in window)) return;
    let effect = null, loading = null, near = false;
    const load = (src) => new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = src; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
    const libs = () => (loading ||= load('./vendor/three.min.js').then(() => load('./vendor/vanta.net.min.js')));
    const start = () => libs().then(() => {
      if (effect || !near || !window.VANTA) return;
      effect = window.VANTA.NET({
        el: mount, THREE: window.THREE,
        mouseControls: true, touchControls: false, gyroControls: false,
        minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
        backgroundAlpha: 0, color: 0x1f7a4e,
        points: 9, maxDistance: 24, spacing: 18, showDots: true,
      });
      gsap.to(mount, { opacity: 0.55, duration: 1.6, ease: 'power2.out' });
    }).catch((err) => console.warn('[vanta] background unavailable', err));
    const stop = () => {
      if (!effect) return;
      effect.destroy();
      effect = null;
      gsap.set(mount, { opacity: 0 });
    };
    new IntersectionObserver((entries) => {
      near = entries.some((e) => e.isIntersecting);
      if (near) start(); else stop();
    }, { rootMargin: '300px 0px' }).observe(mount);
  }

  function setupCursor() {
    const dot = $('#cursorDot');
    const ring = $('#cursorRing');
    if (!dot || !ring) return;
    const dx = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2' });
    const dy = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2' });
    const rx = gsap.quickTo(ring, 'x', { duration: 0.3, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.3, ease: 'power3' });
    let shown = false;
    window.addEventListener('mousemove', (e) => {
      if (!shown) { shown = true; gsap.to([dot, ring], { opacity: 1, duration: 0.3 }); }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const drag = !!t.closest('.hscroll');
      ring.classList.toggle('is-drag', drag);
      ring.classList.toggle('is-link', !drag && !!t.closest('a, button, summary'));
      ring.classList.toggle('on-ink', !!t.closest('.ink-panel, .term, .hcard-end'));
    });
  }

  /* Underlines the nav link for the section under the header. A live rect
     test against a fixed midline, not a ScrollTrigger per section: a pinned
     section is position:fixed while pinned, and a trigger on it reads stale
     coordinates. */
  function setupScrollSpy() {
    const entries = $$('.nav-links a.mono')
      .map((link) => ({ link, section: $(link.getAttribute('href') || '') }))
      .filter((e) => e.section);
    if (!entries.length) return;
    let queued = false;
    const update = () => {
      queued = false;
      const mid = window.innerHeight * 0.3;
      let active = null;
      for (const { link, section } of entries) {
        const r = section.getBoundingClientRect();
        if (r.top <= mid && r.bottom > mid) active = link;
      }
      entries.forEach(({ link }) => link.classList.toggle('is-current', link === active));
    };
    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', schedule, { passive: true });
    ScrollTrigger.addEventListener('refresh', schedule);
    update();
  }

  /* Full-screen menu below 900px. The header's backdrop-filter makes it the
     containing block for fixed children, so the overlay is reparented to
     <body> or it would clip to the 64px bar. */
  function setupMenu() {
    const btn = $('#menuBtn');
    const overlay = $('#menuOverlay');
    if (!btn || !overlay) return;
    document.body.appendChild(overlay);
    const items = $$('.menu-item a, .menu-cta', overlay);
    let open = false, tl = null;

    const setOpen = (next) => {
      if (next === open) return;
      open = next;
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      de.style.overflow = open ? 'hidden' : '';
      de.classList.toggle('menu-open', open);
      window.__lenis?.[open ? 'stop' : 'start']();

      const g = window.gsap;
      if (!g || reduced) {
        overlay.style.clipPath = 'none';
        overlay.hidden = !open;
        if (open) items[0]?.focus();
        return;
      }
      tl?.kill();
      if (open) {
        overlay.hidden = false;
        tl = g.timeline({ onComplete: () => items[0]?.focus() })
          .to(overlay, { clipPath: 'inset(0 0 0% 0)', duration: 0.55, ease: 'power4.inOut' })
          .fromTo(items, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'power3.out', stagger: 0.05 }, '-=0.25');
      } else {
        tl = g.timeline({ onComplete: () => { overlay.hidden = true; } })
          .to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: 0.45, ease: 'power4.inOut' });
      }
    };

    btn.addEventListener('click', () => setOpen(!open));
    overlay.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) { setOpen(false); btn.focus(); }
    });
    // The button is hidden above 900px; rotating a tablet with the menu open
    // must not strand overflow:hidden on <html>.
    matchMedia('(min-width: 901px)').addEventListener('change', (e) => { if (e.matches) setOpen(false); });
  }
})();
