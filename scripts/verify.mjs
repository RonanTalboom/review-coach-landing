/* Layout oracle + click-through for review-coach-landing.
   Renders the page twice — motion on, and prefers-reduced-motion — and asserts:
     1. LANDMARK: .plate's absolute document Y matches between modes. Everything
        above the pinned section is covered by this, exactly as the old
        scrollHeight check was, and it survives the pin.
     2. DELTA: scrollH_motion - scrollH_reduced === the pin distance I chose.
        Any other number is a layout write that leaked out of the motion layer.
   Usage: node verify.mjs [expectedDelta] [width] [height]  */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const SHELL='/Users/ronan/Library/Caches/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-mac-arm64/chrome-headless-shell';
const OUT=process.env.SHOT_DIR || fs.mkdtempSync('/tmp/rc-landing-shots-');
const EXPECTED_DELTA = Number(process.argv[2] ?? 0);
const W = Number(process.argv[3] ?? 1440), H = Number(process.argv[4] ?? 1000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const proc=spawn(SHELL,['--remote-debugging-port=9334','--headless=new','--hide-scrollbars',
  `--window-size=${W},${H}`,'--use-gl=angle','--enable-unsafe-swiftshader','about:blank'],{stdio:['ignore','pipe','pipe']});
let wsurl=null;
proc.stderr.on('data',d=>{const m=/ws:\/\/[^\s]+/.exec(d.toString()); if(m&&!wsurl) wsurl=m[0];});
for(let i=0;i<60 && !wsurl;i++) await sleep(200);
if(!wsurl){console.error('no ws'); process.exit(1);}
const ws=new WebSocket(wsurl); let id=0; const pend=new Map();
await new Promise(r=>ws.onopen=r);
let events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m); pend.delete(m.id);} else if(m.method) events.push(m);};
const send=(method,params={},sessionId)=>new Promise(r=>{const i=++id; pend.set(i,r); ws.send(JSON.stringify({id:i,method,params,sessionId}));});

async function run(reduced, shotPrefix){
  events=[];
  const {result:{targetId}}=await send('Target.createTarget',{url:'about:blank'});
  const {result:{sessionId}}=await send('Target.attachToTarget',{targetId,flatten:true});
  const S=(m,p={})=>send(m,p,sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable');
  await S('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});
  if(reduced) await S('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await S('Page.navigate',{url:'http://localhost:4321/'});
  await sleep(5000);
  const ev=async expr=>{const r=await S('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    if(r.result?.exceptionDetails) return 'EXCEPTION: '+r.result.exceptionDetails.text+' '+(r.result.exceptionDetails.exception?.description||'');
    return r.result?.result?.value;};
  const shot=async name=>{const r=await S('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(`${OUT}/${shotPrefix}-${name}.png`,Buffer.from(r.result.data,'base64'));};

  const out={};
  out.top = JSON.parse(await ev(`JSON.stringify({
    scrollH: document.documentElement.scrollHeight,
    plateY: Math.round(document.querySelector('.plate').getBoundingClientRect().top + window.scrollY),
    motionAttr: document.documentElement.getAttribute('data-motion'),
    overlayGone: !document.querySelector('.plot-boot'),
    btnClickable: (()=>{const b=document.querySelector('.hero .row .btn-primary'); const r=b.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!el && b.contains(el);})(),
    navClickable: (()=>{const b=document.querySelector('.nav .btn-primary'); const r=b.getBoundingClientRect();
      const el=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2); return !!el && b.contains(el);})()
  })`));
  await shot('hero');

  /* walk the whole page in steps so every ScrollTrigger fires */
  const steps = 14;
  for(let i=1;i<=steps;i++){
    await ev(`window.scrollTo(0, ${i}/${steps} * (document.documentElement.scrollHeight - innerHeight))`);
    await sleep(650);
    if(i===Math.round(steps*0.55)) await shot('mid');
  }
  await sleep(1200);
  out.bottom = JSON.parse(await ev(`JSON.stringify({
    stillHidden: [...document.querySelectorAll('.kicker, .cells > *, .plate, .quote blockquote, .close h3, .corner, .split-figure, .stage')]
      .filter(e=>{const s=getComputedStyle(e); return s.visibility==='hidden'||s.opacity==='0';})
      .map(e=>e.className).slice(0,8),
    watched: document.querySelectorAll('.kicker, .cells > *, .plate, .quote blockquote, .close h3, .corner, .split-figure, .stage').length,
    scrollH: document.documentElement.scrollHeight
  })`));
  await shot('bottom');
  out.errors=[...new Set(events.filter(e=>e.method==='Log.entryAdded' && e.params.entry.level==='error')
    .map(e=>e.params.entry.text))].filter(t=>!t.includes('image-slots.state.json'));
  await S('Target.closeTarget',{targetId});
  return out;
}

const motion = await run(false,'m');
const rm = await run(true,'rm');
const delta = motion.top.scrollH - rm.top.scrollH;
const landmarkOK = motion.top.plateY === rm.top.plateY;
const deltaOK = delta === EXPECTED_DELTA;
console.log('screenshots: '+OUT);
console.log(JSON.stringify({
  LANDMARK: landmarkOK ? `PASS (plate at ${motion.top.plateY} in both)` : `FAIL motion=${motion.top.plateY} reduced=${rm.top.plateY}`,
  DELTA: deltaOK ? `PASS (${delta} === expected ${EXPECTED_DELTA})` : `FAIL got ${delta}, expected ${EXPECTED_DELTA}`,
  motion, rm
},null,1));
proc.kill();
process.exit(landmarkOK && deltaOK ? 0 : 1);
