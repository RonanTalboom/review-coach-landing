/* Layout oracle + click-through for review-coach-landing.

   Renders the page twice under CDP — motion on, and prefers-reduced-motion —
   and asserts:
     LANDMARK  #session's absolute document Y is identical in both modes, so
               nothing above the pinned track wrote layout.
     DELTA     scrollH(motion) - scrollH(reduced) === window.__rcPin, the pin
               distance the motion layer itself published. Any other number is
               a layout write that leaked out of the motion layer.
     OVERFLOW  no horizontal page scroll in either mode.
     SETTLED   after walking the whole page, no revealed element is left at
               opacity 0 or visibility hidden.
     CLICK     the hero and header calls to action receive their own clicks.
     MENU      below 900px the menu opens, and Escape closes it.
     ERRORS    no console errors or uncaught exceptions.
     REACH     when the session track is not pinned (reduced motion, phones),
               its overflow can still be scrolled: a clipped track with
               overflow-x:hidden passes every other check and hides four steps.
     FOLD      above 900px wide (two-column hero), the whole hero stage,
               its offset plate included, is on screen without scrolling.
     STEADY    with motion on, #session's Y does not move while the hero's
               rotating phrase cycles (sampled for ~9s after load). A phrase
               that wraps on some cycles is a layout write the 5s snapshot
               misses.

   Usage:  python3 -m http.server 4321 --directory public &
           node scripts/verify.mjs            # 1440x1000
           node scripts/verify.mjs 390 844    # phone
   Screenshots land in $SHOT_DIR (default: a fresh temp dir). */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SHELL = process.env.CHROME_SHELL ||
  `${os.homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const OUT = process.env.SHOT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'rc-landing-shots-'));
fs.mkdirSync(OUT, { recursive: true });
const W = Number(process.argv[2] ?? 1440), H = Number(process.argv[3] ?? 1000);
const URL_ = process.env.URL || 'http://localhost:4321/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const proc = spawn(SHELL, ['--remote-debugging-port=9334', '--headless=new', '--hide-scrollbars',
  `--window-size=${W},${H}`, '--use-gl=angle', '--enable-unsafe-swiftshader', 'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
let wsurl = null;
proc.stderr.on('data', (d) => { const m = /ws:\/\/[^\s]+/.exec(d.toString()); if (m && !wsurl) wsurl = m[0]; });
for (let i = 0; i < 60 && !wsurl; i++) await sleep(200);
if (!wsurl) { console.error('no devtools websocket'); process.exit(1); }
const ws = new WebSocket(wsurl);
let id = 0; const pend = new Map(); let events = [];
await new Promise((r) => (ws.onopen = r));
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else if (m.method) events.push(m); };
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

async function run(reduced, prefix) {
  events = [];
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p = {}) => send(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
  const mobile = W <= 900;
  await S('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
  if (reduced) await S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await S('Page.navigate', { url: URL_ });
  await sleep(5000); // the first-visit curtain runs ~2.3s
  const ev = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return 'EXCEPTION: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const r = await S('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}/${prefix}-${name}.png`, Buffer.from(r.result.data, 'base64'));
  };
  const hits = (sel) => `(()=>{const b=document.querySelector('${sel}'); if(!b) return 'missing'; const r=b.getBoundingClientRect();
    if(!r.width) return 'hidden'; const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!el && b.contains(el);})()`;

  const out = {};
  out.top = JSON.parse(await ev(`JSON.stringify({
    scrollH: document.documentElement.scrollHeight,
    sessionY: Math.round(document.querySelector('#session').getBoundingClientRect().top + window.scrollY),
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    ready: !!window.__rcReady, pin: window.__rcPin ?? null,
    curtainGone: getComputedStyle(document.getElementById('curtain')).display === 'none',
    heroCta: ${hits('.hero-actions .btn-solid')},
    stageBottom: Math.round(document.getElementById('stage').getBoundingClientRect().bottom + 16), innerH: window.innerHeight,
    navCta: ${mobile ? "'n/a'" : hits('.nav-cta')},
  })`));
  await shot('01-hero');

  out.reach = JSON.parse(await ev(`JSON.stringify((()=>{const h=document.getElementById('hscroll');
    return { overflows: h.scrollWidth > h.clientWidth + 1, overflowX: getComputedStyle(h).overflowX, pinned: (window.__rcPin||0) > 0 };})())`));

  if (!reduced) {
    const ys = new Set();
    for (let i = 0; i < 13; i++) {
      ys.add(await ev(`Math.round(document.querySelector('#session').getBoundingClientRect().top + window.scrollY)`));
      await sleep(700);
    }
    out.steady = [...ys];
  }

  if (mobile) {
    await ev(`document.getElementById('menuBtn').click()`); await sleep(900);
    out.menuOpen = JSON.parse(await ev(`JSON.stringify({ expanded: document.getElementById('menuBtn').getAttribute('aria-expanded'),
      visible: !document.getElementById('menuOverlay').hidden, linkHit: ${hits('.menu-item a')} })`));
    await shot('02-menu');
    await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await S('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(900);
    out.menuClosed = JSON.parse(await ev(`JSON.stringify({ expanded: document.getElementById('menuBtn').getAttribute('aria-expanded'),
      hidden: document.getElementById('menuOverlay').hidden, htmlOverflow: document.documentElement.style.overflow })`));
  }

  // Walk the page so every ScrollTrigger fires; screenshot each section as it lands.
  const ids = ['app', 'different', 'limits', 'session', 'tags', 'judgment', 'learning', 'github', 'providers', 'faq', 'access'];
  let n = 3;
  for (const sid of ids) {
    await ev(`(()=>{const el=document.getElementById('${sid}'); const y=el.getBoundingClientRect().top+window.scrollY-64;
      (window.__lenis ? window.__lenis.scrollTo(y,{immediate:true}) : window.scrollTo(0,y));})()`);
    await sleep(1100);
    await shot(String(n++).padStart(2, '0') + '-' + sid);
    if (sid === 'session' && !mobile && !reduced) {
      // travel half the pin, then all of it, to see the track move
      for (const f of [0.5, 1]) {
        await ev(`(()=>{const y=window.scrollY + ${f === 0.5 ? 0.5 : 0.5}*(window.__rcPin||0); (window.__lenis ? window.__lenis.scrollTo(y,{immediate:true}) : window.scrollTo(0,y));})()`);
        await sleep(1200);
        await shot(String(n++).padStart(2, '0') + '-session-' + f);
      }
    }
  }
  await ev(`(()=>{const y=document.documentElement.scrollHeight; (window.__lenis ? window.__lenis.scrollTo(y,{immediate:true}) : window.scrollTo(0,y));})()`);
  await sleep(1600);
  await shot(String(n++).padStart(2, '0') + '-footer');

  out.bottom = JSON.parse(await ev(`JSON.stringify({
    stillHidden: [...document.querySelectorAll('[data-reveal], [data-hero-reveal], .app-card, .proc, .hcard > *, #heroTitle, .sec-title')]
      .filter(e => { const s = getComputedStyle(e); return s.visibility === 'hidden' || parseFloat(s.opacity) < 0.99; })
      .map(e => (e.id ? '#' + e.id : '') + '.' + String(e.className).split(' ')[0]).slice(0, 12),
    watched: document.querySelectorAll('[data-reveal], [data-hero-reveal], .app-card, .proc, .hcard > *').length,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
  })`));
  out.errors = [...new Set(events
    .filter((e) => (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') || e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.entry?.text || e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text))];
  await S('Target.closeTarget', { targetId });
  return out;
}

const motion = await run(false, 'm');
const rm = await run(true, 'rm');
const delta = motion.top.scrollH - rm.top.scrollH;
const checks = {
  LANDMARK: motion.top.sessionY === rm.top.sessionY ? `PASS (#session at ${rm.top.sessionY} in both)` : `FAIL motion=${motion.top.sessionY} reduced=${rm.top.sessionY}`,
  DELTA: delta === motion.top.pin ? `PASS (${delta} === published pin ${motion.top.pin})` : `FAIL got ${delta}, pin says ${motion.top.pin}`,
  OVERFLOW: [motion.top, motion.bottom, rm.top, rm.bottom].every((o) => o.overflowX <= 0) ? 'PASS' : `FAIL ${[motion.top, motion.bottom, rm.top, rm.bottom].map((o) => o.overflowX)}`,
  SETTLED: !motion.bottom.stillHidden.length && !rm.bottom.stillHidden.length ? `PASS (${motion.bottom.watched} watched)` : `FAIL m=${motion.bottom.stillHidden} rm=${rm.bottom.stillHidden}`,
  CLICK: [motion.top.heroCta, rm.top.heroCta].every((v) => v === true) && [motion.top.navCta, rm.top.navCta].every((v) => v === true || v === 'n/a') ? 'PASS' : `FAIL hero=${motion.top.heroCta}/${rm.top.heroCta} nav=${motion.top.navCta}/${rm.top.navCta}`,
  MENU: W > 900 ? 'n/a' : [motion, rm].every((o) => o.menuOpen.expanded === 'true' && o.menuOpen.visible && o.menuOpen.linkHit === true && o.menuClosed.expanded === 'false' && o.menuClosed.hidden && o.menuClosed.htmlOverflow === '') ? 'PASS' : `FAIL ${JSON.stringify([motion.menuOpen, motion.menuClosed, rm.menuOpen, rm.menuClosed])}`,
  ERRORS: !motion.errors.length && !rm.errors.length ? 'PASS' : `FAIL ${JSON.stringify([...motion.errors, ...rm.errors])}`,
  FOLD: W <= 900 ? 'n/a' : rm.top.stageBottom <= rm.top.innerH ? `PASS (stage ends at ${rm.top.stageBottom} of ${rm.top.innerH})` : `FAIL stage ends at ${rm.top.stageBottom}, viewport is ${rm.top.innerH}`,
  REACH: [motion, rm].every((o) => o.reach.pinned || !o.reach.overflows || o.reach.overflowX !== 'hidden') ? 'PASS' : `FAIL ${JSON.stringify([motion.reach, rm.reach])}`,
  STEADY: motion.steady.length === 1 ? `PASS (#session held at ${motion.steady[0]} through the rotation)` : `FAIL #session moved: ${motion.steady}`,
};
console.log(`screenshots: ${OUT}  (${W}x${H})`);
console.log(JSON.stringify({ ...checks, motion: motion.top, reduced: rm.top }, null, 1));
proc.kill();
process.exit(Object.values(checks).every((v) => v === 'n/a' || v.startsWith('PASS')) ? 0 : 1);
