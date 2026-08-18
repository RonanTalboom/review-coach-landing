/* Motion layer — Lenis (smooth scroll), GSAP + ScrollTrigger (reveals), a
   hand-ported pair of react-bits effects (decrypt-text, magnet), and a
   contained Vanta NET lattice behind the hero.

   THE MOTION LAWS (this page's, not a library's):
   #1 opacity and transform ONLY. The page is built on a 24px leading unit
      with `text-box: trim-both`; anything touching height, margin or
      font-size destroys the rhythm the stylesheet's own comments obsess over.
   #2 prefers-reduced-motion is a hard stop, not a slowdown: Lenis never
      initialises, every tween resolves to its final state, Vanta never starts.
   #3 decorative layers carry pointer-events: none — the same contract the
      registration crosses already sign so they don't eat image-slot's drops.
   #4 one color. Everything drawn here takes --color-accent / --color-divider.
   #5 the vocabulary is the system's own: lines get DRAWN (scaleX from the
      left), registration crosses REGISTER (fade + scale to their mark),
      the spec sheet PLOTS row by row. No slide-and-fade generics. */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const $ = (s, r = document) => Array.from((r || document).querySelectorAll(s));

  /* law #2: paint the finished page and leave. Every animated property below
     is declared in the stylesheet at its final value, so "do nothing" IS the
     final state — the only work is un-arming the pre-set classes. */
  if (reduced) {
    document.documentElement.removeAttribute('data-motion');
    window.__motionReady = true;
    return;
  }
  document.documentElement.setAttribute('data-motion', 'on');

  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  /* no GSAP means no reveals, so the pre-hidden states must come back off or
     the page is left blank — the head script's 3s failsafe covers the case
     where this file itself never arrives; this covers the case where it did
     but its dependencies did not */
  if (!gsap || !ScrollTrigger) {
    document.documentElement.removeAttribute('data-motion');
    return;
  }
  window.__motionReady = true;   /* stand the head script's failsafe down */
  gsap.registerPlugin(ScrollTrigger);

  /* ——— smooth scroll (Lenis) ———————————————————————————————————
     Three wirings, all mandatory:
     a) the page's own `html { scroll-behavior: smooth }` double-eases against
        Lenis's virtual scroll — the .lenis class in the page style turns it off;
     b) ScrollTrigger has no idea Lenis exists until it is told to update on
        every virtual scroll frame;
     c) two rAF loops drift against each other, so Lenis rides gsap.ticker. */
  let lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.6,
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    /* the nav's in-page anchors bypass the virtual scroll entirely and jump */
    $('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -24, duration: 1.2 });
        history.pushState(null, '', a.getAttribute('href'));
      });
    });
  }

  /* ——— the plot ————————————————————————————————————————————————
     The sheet set draws itself before it is read: crosses set, a rule swept,
     a plot counter run to 100. Returns a promise so the hero's own reveal can
     wait for it, and resolves IMMEDIATELY when the sequence is skipped — once
     per session, on any click or key, or on a reduced-motion visit (which
     never reaches this code at all).

     The failsafe is the point of the design: a full-screen overlay that
     outlives its script makes the page unreachable, so removal is scheduled
     unconditionally rather than as the last step of a sequence that might
     throw halfway. */
  const booted = (() => {
    let already = false;
    try { already = sessionStorage.getItem('rc-plotted') === '1'; } catch (_) { /* private mode */ }
    if (already) return Promise.resolve();
    try { sessionStorage.setItem('rc-plotted', '1'); } catch (_) {}

    const boot = document.createElement('div');
    boot.className = 'plot-boot';
    boot.setAttribute('aria-hidden', 'true');
    boot.innerHTML = `<div class="pb-frame">
      <span class="pb-meta"><span>Review Coach — sheet set RC-01</span><span class="pb-pct">Plotting 000%</span></span>
      <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
      <i class="pb-rule"></i>
      <span class="pb-skip">Click to skip</span>
    </div>`;
    document.body.appendChild(boot);
    if (lenis) lenis.stop();   /* nothing scrolls under a sheet still on the plotter */

    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        boot.remove();
        if (lenis) lenis.start();
        removeEventListener('keydown', finish);
        removeEventListener('pointerdown', finish);
        resolve();
      };
      /* unconditional: the page comes back whether or not the plot finished */
      setTimeout(finish, 4000);
      addEventListener('keydown', finish);
      addEventListener('pointerdown', finish);

      const pct = boot.querySelector('.pb-pct');
      const counter = { n: 0 };
      gsap.timeline({ onComplete: finish })
        .fromTo(boot.querySelectorAll('.corner'), { autoAlpha: 0, scale: 2.4 },
          { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.05 })
        .fromTo(boot.querySelector('.pb-meta'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 0.15)
        .to(boot.querySelector('.pb-rule'), { scaleX: 1, duration: 0.9, ease: 'power1.inOut' }, 0.3)
        .to(counter, { n: 100, duration: 0.9, ease: 'power1.inOut',
          onUpdate: () => { pct.textContent = 'Plotting ' + String(Math.round(counter.n)).padStart(3, '0') + '%'; } }, 0.3)
        .to(boot.querySelector('.pb-skip'), { autoAlpha: 1, duration: 0.3 }, 0.5)
        .to(boot, { autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, '>0.12');
    });
  })();

  /* ——— the scroll rail ————————————————————————————————————————
     A 1px accent hairline across the top edge, drawn left-to-right with the
     read. The page's grammar is a caption rule; this is the page's own. */
  const rail = document.createElement('div');
  rail.className = 'scroll-rail';
  rail.setAttribute('aria-hidden', 'true');
  document.body.appendChild(rail);
  gsap.to(rail, {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
  });

  /* ——— the sheet index ————————————————————————————————————————
     The drawing set gets a register in the right margin: one numbered tab per
     sheet, the current one marked. Built from the sections' own data-sheet
     attributes rather than a list kept in here, so adding a sheet to the page
     adds its tab and nothing needs editing twice. */
  const sheets = $('section[data-sheet]');
  if (sheets.length) {
    const index = document.createElement('nav');
    index.className = 'sheet-index';
    index.setAttribute('aria-label', 'Sheet index');
    index.innerHTML = sheets.map((sec) =>
      `<a href="#${sec.id}"><span>${sec.dataset.sheet}</span><span class="nm">${sec.dataset.sheetName}</span></a>`
    ).join('');
    document.body.appendChild(index);

    const tabs = $('a', index);
    tabs.forEach((a, i) => {
      a.addEventListener('click', (e) => {
        if (!lenis) return;                       /* no Lenis: let the browser do it */
        e.preventDefault();
        lenis.scrollTo(sheets[i], { offset: -24, duration: 1.2 });
        history.pushState(null, '', '#' + sheets[i].id);
      });
    });

    /* Which sheet is current is decided by a live rect test against the
       viewport midline, NOT by a ScrollTrigger per section. A pinned section
       is position: fixed while it holds, so its document-space start/end stop
       describing where it actually is, and a per-section trigger marks the
       NEXT sheet current while you are still reading the pinned one — which
       is exactly what it did. A rect is true in both states. Five rects on a
       coalesced frame is cheaper than the triggers it replaces. */
    let markRaf = 0, active = 0;
    const markCurrent = () => {
      markRaf = 0;
      const mid = innerHeight / 2;
      let hit = -1;
      sheets.forEach((sec, i) => {
        const r = sec.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) hit = i;
      });
      /* the midline can fall in the air BETWEEN two sheets — that is not sheet
         01, it is still whichever sheet you last read. Falling back to 0 made
         the rail jump to the top of the set every time it crossed a gap. */
      if (hit === -1) return;
      active = hit;
      tabs.forEach((t, j) => t.setAttribute('aria-current', String(j === active)));
    };
    const queueMark = () => { if (!markRaf) markRaf = requestAnimationFrame(markCurrent); };
    if (lenis) lenis.on('scroll', queueMark);
    addEventListener('scroll', queueMark, { passive: true });
    addEventListener('resize', queueMark);
    markCurrent();
  }

  /* ——— shared reveal helpers ——————————————————————————————————— */
  const enter = (trigger) => ({ trigger, start: 'top 85%', once: true });

  /* rules DRAW from their left edge — the system's caption-rule grammar */
  $('.caption-rule').forEach((rule) => {
    gsap.fromTo(rule, { scaleX: 0 }, {
      scaleX: 1, duration: 0.7, ease: 'power2.out', scrollTrigger: enter(rule),
    });
  });

  /* kickers seat in with their rule */
  $('.kicker').forEach((k) => {
    gsap.fromTo(k, { autoAlpha: 0, y: 6 }, {
      autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', scrollTrigger: enter(k),
    });
  });

  /* registration crosses REGISTER: they scale down onto their mark, the way a
     print register is pulled into alignment. Corner order is tl, tr, bl, br —
     stagger walks the frame rather than fading it as a block. */
  /* PLOT: an SVG rect laid over the frame, drawn by running its dash offset to
     zero. pathLength="100" normalises the dash maths to percentages, so the
     same tween is correct at every size and survives a resize without being
     re-measured — the alternative, measuring the real perimeter, is a layout
     read that goes stale the moment the column reflows. */
  function penFrame(el) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'pen-frame');
    svg.setAttribute('aria-hidden', 'true');
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('pathLength', '100');
    svg.appendChild(rect);
    el.appendChild(svg);
    return rect;
  }

  /* the crosses register first, then the pen draws the box between them */
  $('.plate, .cell-frame, .split-figure').forEach((frame) => {
    const corners = frame.querySelectorAll(':scope > .corner');
    const tl = gsap.timeline({ scrollTrigger: enter(frame) });
    if (corners.length) {
      tl.fromTo(corners, { autoAlpha: 0, scale: 2.2 },
        { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2)', stagger: 0.06 }, 0);
    }
    if (frame.matches('.plate, .cell-frame')) {
      tl.fromTo(penFrame(frame), { strokeDasharray: 100, strokeDashoffset: 100 },
        { strokeDashoffset: 0, duration: 1.1, ease: 'power1.inOut' }, 0.18);
    }
  });

  /* the wireframe cells: the frame arrives, then its contents */
  /* the cells' CONTENTS arrive, not the cells: fading the whole .cell-frame
     would fade the pen stroke drawing it, so the box and what it holds are
     animated separately */
  $('.cells').forEach((cells) => {
    gsap.fromTo(cells.querySelectorAll('.cell-frame > h2, .cell-frame > p'),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out',
        stagger: 0.08, delay: 0.3, scrollTrigger: enter(cells) });
  });

  /* the sheet PLOTS: title block, then one row at a time, then the note.
     No count-up on the values — they read "≤ 7", "0", "0", "2"; counting up
     to zero is theatre with nothing to show. */
  const plate = document.querySelector('.plate');
  if (plate) {
    const rows = plate.querySelectorAll('.spec tbody tr');
    /* the plate itself is never faded — it carries the pen stroke drawing its
       own frame; its contents plot inside it instead */
    gsap.timeline({ scrollTrigger: enter(plate) })
      .fromTo(plate.querySelector('.title-block'), { autoAlpha: 0, y: -8 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0.35)
      .fromTo(rows, { autoAlpha: 0, x: -10 },
        { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.09 }, 0.5)
      .fromTo(plate.querySelector('.sheet-note'), { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.4 }, '>-0.15');
  }

  /* ——— sheet 03: the pipeline strip ————————————————————————————
     The section pins and the strip runs sideways under it, so the five stages
     are read left to right by scrolling down. Two things make this safe:

     a) PIN_DISTANCE is a constant chosen here, not a measured one. The whole
        point of the layout oracle is that the two renders differ by exactly
        the pin distance and by nothing else — a pin distance derived from
        content would make the expected delta unknowable, and the check would
        degrade into "some number came out".
     b) below 880px there is no pin at all: the strip is the plain native
        horizontal scroll it already is without JS. Same height either way,
        which is what keeps (a) true. */
  /* 1200 against roughly 620px of travel at desktop width: the strip reads as
     a deliberate drag rather than the crawl 2000 produced. It is a constant
     rather than a multiple of the measured travel so the oracle's expected
     delta stays a number I can state up front. */
  const PIN_DISTANCE = 1200;
  const works = document.querySelector('.works');
  if (works) {
    const strip = works.querySelector('.strip');
    const track = works.querySelector('.track');

    gsap.matchMedia().add('(min-width: 880px)', () => {
      /* re-read on every match: the travel is content-width dependent, but the
         PIN distance deliberately is not */
      const travel = () => Math.max(0, track.scrollWidth - strip.clientWidth);
      const tween = gsap.fromTo(track, { x: 0 }, {
        x: () => -travel(), ease: 'none',
        scrollTrigger: {
          trigger: works, start: 'center center', end: '+=' + PIN_DISTANCE,
          pin: true, scrub: 0.4, invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      return () => { tween.scrollTrigger && tween.scrollTrigger.kill(true); tween.kill(); gsap.set(track, { x: 0 }); };
    });

    /* the stages plot themselves as they come, driven by the strip's own
       horizontal position rather than the page's vertical one */
    gsap.fromTo(works.querySelectorAll('.stage'), { autoAlpha: 0, y: 16 }, {
      autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.09,
      scrollTrigger: { trigger: works, start: 'top 85%', once: true },
    });
  }

  /* the split: copy from the left, the framed photograph holds a slow
     transform-only parallax (never a background-position — see law #1) */
  const split = document.querySelector('.split');
  if (split) {
    gsap.fromTo(split.querySelector('.split-title'), { autoAlpha: 0, y: 14 }, {
      autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: enter(split),
    });
    gsap.fromTo(split.querySelector('.split-copy .note'), { autoAlpha: 0, y: 14 }, {
      autoAlpha: 1, y: 0, duration: 0.6, delay: 0.1, ease: 'power2.out', scrollTrigger: enter(split),
    });
    const fig = split.querySelector('.split-figure');
    if (fig) {
      gsap.fromTo(fig, { autoAlpha: 0, scale: 0.97 }, {
        autoAlpha: 1, scale: 1, duration: 0.8, ease: 'power2.out', scrollTrigger: enter(fig),
      });
      gsap.fromTo(fig, { y: 26 }, {
        y: -26, ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      });
    }
  }

  /* the quote and the close */
  const quote = document.querySelector('.quote blockquote');
  if (quote) {
    gsap.fromTo([quote, document.querySelector('.quote figcaption')],
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power2.out', stagger: 0.12,
        scrollTrigger: enter(document.querySelector('.quote')) });
  }
  const close = document.querySelector('.close');
  if (close) {
    gsap.fromTo(close.querySelectorAll('h3, .sub, .row'), { autoAlpha: 0, y: 14 }, {
      autoAlpha: 1, y: 0, duration: 0.55, ease: 'power2.out', stagger: 0.1, scrollTrigger: enter(close),
    });
  }

  /* ——— the drafting cursor ————————————————————————————————————
     A full-viewport crosshair with a live coordinate readout, ticked at the
     page edges. This is the one effect in here that only makes sense in THIS
     design language: on an engineering drawing the cursor is a rule, and where
     the rule crosses the sheet edge the drawing marks it.

     Y reads in document space (clientY + scrollY), not viewport space — the
     sheet is the thing being measured, and a coordinate that resets when you
     scroll would be measuring the window instead. */
  if (!coarse) {
    const ch = document.createElement('div');
    ch.className = 'crosshair';
    ch.setAttribute('aria-hidden', 'true');
    ch.innerHTML = '<i class="h"></i><i class="v"></i>' +
      '<i class="tick tx"></i><i class="tick bx"></i><i class="tick ly"></i><i class="tick ry"></i>' +
      '<span class="read"></span>';
    document.body.appendChild(ch);

    const h = ch.querySelector('.h'), v = ch.querySelector('.v');
    const read = ch.querySelector('.read');
    const tx = ch.querySelector('.tx'), bx = ch.querySelector('.bx');
    const ly = ch.querySelector('.ly'), ry = ch.querySelector('.ry');
    /* quickTo keeps one tween per property alive instead of allocating a new
       one per pointer event — at pointer-event rates the difference is the
       whole cost of the effect */
    const set = {
      hy: gsap.quickTo(h, 'y', { duration: 0.18, ease: 'power3.out' }),
      vx: gsap.quickTo(v, 'x', { duration: 0.18, ease: 'power3.out' }),
      rx: gsap.quickTo(read, 'x', { duration: 0.18, ease: 'power3.out' }),
      ry: gsap.quickTo(read, 'y', { duration: 0.18, ease: 'power3.out' }),
      txx: gsap.quickTo(tx, 'x', { duration: 0.18, ease: 'power3.out' }),
      bxx: gsap.quickTo(bx, 'x', { duration: 0.18, ease: 'power3.out' }),
      lyy: gsap.quickTo(ly, 'y', { duration: 0.18, ease: 'power3.out' }),
      ryy: gsap.quickTo(ry, 'y', { duration: 0.18, ease: 'power3.out' }),
    };
    const pad = (n) => String(Math.max(0, Math.round(n))).padStart(4, '0');
    /* over a framed object the rule stops being a position and becomes a
       measurement: the readout takes the object's size, the way a dimension
       call-out on a drawing does. Only the system's own drawn frames answer —
       measuring a paragraph would be noise. */
    const MEASURABLE = '.cell-frame, .plate, .stage, .split-figure, .btn';
    let raf = 0, px = 0, py = 0;
    const paint = () => {
      raf = 0;
      set.hy(py); set.lyy(py); set.ryy(py);
      set.vx(px); set.txx(px); set.bxx(px);
      set.rx(px); set.ry(py);
      let text = `X ${pad(px)}  Y ${pad(py + scrollY)}`;
      const hit = document.elementFromPoint(px, py);
      const frame = hit && hit.closest && hit.closest(MEASURABLE);
      if (frame) {
        const r = frame.getBoundingClientRect();
        text += `  ⌀ ${Math.round(r.width)}×${Math.round(r.height)}`;
      }
      read.textContent = text;
    };
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      px = e.clientX; py = e.clientY;
      ch.classList.add('on');
      if (!raf) raf = requestAnimationFrame(paint);   /* coalesce to one paint
         per frame — pointermove can fire faster than the display refreshes */
    }, { passive: true });
    addEventListener('pointerdown', () => ch.classList.add('on'), { passive: true });
    document.addEventListener('mouseleave', () => ch.classList.remove('on'));
    /* the Y readout is document-space, so it is stale the moment the page
       scrolls under a still pointer */
    if (lenis) lenis.on('scroll', () => { if (!raf && ch.classList.contains('on')) raf = requestAnimationFrame(paint); });
  }

  /* ——— react-bits, hand-ported ————————————————————————————————
     react-bits ships React components (Tailwind + framer-motion) and this
     repo has no package.json and no build step by design, so the two effects
     worth having are re-derived here in ~30 lines of vanilla each:
     "Decrypted Text" and "Magnet". */

  /* DECRYPT: the hero's display lines resolve out of a glyph cipher, one
     character at a time, left to right. The h1 takes an aria-label first so
     assistive tech reads the sentence, never the cipher; the element's height
     is pinned for the duration so a mid-scramble rewrap can never nudge the
     24px rhythm (law #1 applies to the side effects too, not just the tweens). */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\\|<>[]{}=+*-#%';
  function decrypt(el, delay, onDone) {
    const final = el.textContent;
    const chars = final.split('');
    let frame = 0;
    const speed = 1.6;            /* characters resolved per frame */
    const total = chars.length / speed + 12;
    const tick = () => {
      const settled = Math.floor(frame * speed);
      el.textContent = chars.map((c, i) => {
        if (i < settled || c === ' ') return c;
        return GLYPHS[(Math.floor(frame * 7 + i * 13) % GLYPHS.length)];
      }).join('');
      if (frame++ < total) requestAnimationFrame(tick);
      else { el.textContent = final; if (onDone) onDone(); }
    };
    setTimeout(() => requestAnimationFrame(tick), delay);
  }

  const display = document.querySelector('.hero .display');
  if (display) {
    const lines = $('.line', display);
    /* the h1 is NAMED by its aria-label, so assistive tech reads the finished
       sentence and never the cipher. The spans stay aria-hidden permanently
       and deliberately — un-hiding them would double the heading's name back
       into the accessibility tree alongside the label. */
    display.setAttribute('aria-label', display.textContent.replace(/\s+/g, ' ').trim());
    lines.forEach((l) => l.setAttribute('aria-hidden', 'true'));

    /* Everything below waits on document.fonts.ready, and the reason is law #1.
       min-height is a layout write, and measuring it before Barlow Condensed
       lands measures the fallback face: at 96px each line wraps to two, so the
       block is pinned to roughly twice its real height and never recovers —
       the 24px lattice moved, which is exactly what law #1 forbids. Measure
       after the real face, and release the pin the moment the last line
       resolves, so the lock exists only for the frames that can rewrap. */
    Promise.all([document.fonts.ready, booted]).then(() => {
      display.style.minHeight = display.getBoundingClientRect().height + 'px';

      gsap.timeline()
        .fromTo(lines, { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.12 })
        .fromTo('.hero .sub', { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 0.2)
        .fromTo('.hero .row > *', { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, 0.35);

      const last = lines.length - 1;
      lines.forEach((l, i) => decrypt(l, 100 + i * 120,
        i === last ? () => { display.style.minHeight = ''; ScrollTrigger.refresh(); } : null));

      /* the triggers below were measured against the fallback face's taller
         layout; every start: 'top 85%' is wrong until this runs */
      ScrollTrigger.refresh();
    });
  }

  /* MAGNET: the solid accent action is the one solid object on the board, so
     it is the one that answers the cursor. Capped at 5px — a nudge, not a
     drift — and off entirely for coarse pointers, which have no hover to read. */
  if (!coarse) {
    $('.btn').forEach((btn) => {
      const pull = 5, radius = 90;
      const to = gsap.quickTo(btn, 'x', { duration: 0.4, ease: 'power3.out' });
      const toY = gsap.quickTo(btn, 'y', { duration: 0.4, ease: 'power3.out' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        to(gsap.utils.clamp(-pull, pull, (dx / radius) * pull * 2));
        toY(gsap.utils.clamp(-pull, pull, (dy / radius) * pull * 2));
      });
      btn.addEventListener('pointerleave', () => { to(0); toY(0); });
    });
  }

  /* ——— the two background fields, both fetched on demand ————————
     three.js is 148K gzipped and p5 is 239K — together nine tenths of this
     page's JavaScript, for two textures that live at a quarter opacity behind
     the content. Neither is in the document's script tags: each stack is
     fetched the first time its section comes near, so a visitor who reads the
     hero and leaves downloads neither, and nobody downloads p5 until they have
     scrolled to the end of the page.

     Both instances are torn down whenever their section leaves the viewport —
     a WebGL or p5 draw loop running behind a scrolled-past marketing section
     is pure battery for nothing. */
  const loaded = new Map();
  const loadScript = (src) => {
    if (loaded.has(src)) return loaded.get(src);
    const p = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.async = false;   /* async=false preserves ORDER across a
        batch: vanta reads window.THREE / window.p5 at evaluation time, so the
        engine must have finished evaluating before its plugin starts */
      el.onload = resolve; el.onerror = reject;
      document.head.appendChild(el);
    });
    loaded.set(src, p);
    return p;
  };
  const loadAll = (srcs) => srcs.reduce((chain, s) => chain.then(() => loadScript(s)), Promise.resolve());

  /* mount(section, className, srcs, make) — the shared shape of both fields:
     fetch on approach, start on entry, destroy on exit, never start twice. */
  function backgroundField(section, className, srcs, make) {
    if (!section) return;
    const host = document.createElement('div');
    host.className = className;
    host.setAttribute('aria-hidden', 'true');  /* decorative; the stylesheet
      also gives it pointer-events: none, or the canvas eats the section's
      controls — the same contract the registration crosses sign */
    section.prepend(host);

    let effect = null, pending = false, wanted = false;
    const stop = () => { if (effect) { effect.destroy(); effect = null; } };
    const start = () => {
      if (effect || pending) return;
      pending = true;
      loadAll(srcs).then(() => {
        pending = false;
        if (!wanted) return;              /* scrolled away while it downloaded */
        try { effect = make(host); } catch (e) { host.remove(); }
      }).catch(() => { pending = false; host.remove(); });
    };

    /* fetch early (400px of runway), but only start drawing on actual entry */
    new IntersectionObserver(([e]) => { if (e.isIntersecting) loadAll(srcs); },
      { rootMargin: '400px' }).observe(section);
    new IntersectionObserver(([e]) => { wanted = e.isIntersecting; e.isIntersecting ? start() : stop(); },
      { threshold: 0 }).observe(section);
    addEventListener('pagehide', stop);
  }

  /* the hero: NET is a wireframe lattice of points and hairlines — this
     system's own grammar, visible drawn structure — in the single steel
     accent on a transparent ground, so the paper stays paper. The rest of
     Vanta's catalog is weather, and none of it belongs on a drawing. */
  backgroundField(document.querySelector('.hero'), 'vanta-host',
    ['./vendor/three.min.js', './vendor/vanta.net.min.js'],
    (host) => window.VANTA.NET({
      el: host, THREE: window.THREE,
      /* mouseControls registers a global scroll listener that reads
         getCanvasRect() on every Lenis frame, for a parallax invisible here */
      mouseControls: false, touchControls: false, gyroControls: false,
      minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
      color: 0x5980a6,          /* --color-accent, the single hue */
      backgroundAlpha: 0,       /* the paper ground shows through */
      points: 6, maxDistance: 19, spacing: 22,   /* sparse: a lattice, not a mesh */
      showDots: true,
    }));

  /* the close: TOPOLOGY draws contours, which is what the last sheet of a
     drawing set should be sitting on. It is p5-based, so unlike NET it has no
     transparent-ground path — backgroundColor takes the paper token instead
     and the slab is invisible against the page it sits on. */
  backgroundField(document.querySelector('.close'), 'topo-host',
    ['./vendor/p5.min.js', './vendor/vanta.topology.min.js'],
    (host) => window.VANTA.TOPOLOGY({
      el: host, p5: window.p5,
      mouseControls: false, touchControls: false, gyroControls: false,
      minHeight: 200, minWidth: 200, scale: 1, scaleMobile: 1,
      color: 0x5980a6,
      backgroundColor: 0xf2f2f3,   /* --color-bg */
    }));

  ScrollTrigger.refresh();
})();
