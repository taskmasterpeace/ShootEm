/**
 * BENCH TRACKER — Robert's ask: "do a benchmark, do the fixes, do another
 * benchmark, and see the improvement on a graph every time… each wave of
 * optimization continuing to the next." Runs a SWEEP of shambler counts
 * (ramping up to find the wall), appends the labelled run to
 * docs/bench/zombie-history.json, and regenerates a self-contained graph at
 * docs/bench/zombie-perf.html — every recorded run is a WAVE: older waves
 * recede into steel, the newest burns amber, and the wall's march shows as
 * its own panel.
 *
 *   npx tsx tools/bench-track.ts "<label>" [--nocache] [--counts=50,100,300,...]
 *   npx tsx tools/bench-track.ts --regen        (rewrite pages from history only)
 *
 *   --nocache : run with the S4 objective cache OFF (the honest baseline, same
 *               binary) — auto-labels the run as a baseline.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { runBench, type BenchResult } from './zombie-bench-core';
import { _setObjectiveCache } from '../src/sim/bots';

const BUDGET_MS = 16.7; // one 60fps frame
const DIR = 'docs/bench';
const HISTORY = `${DIR}/zombie-history.json`;
const PAGE = `${DIR}/zombie-perf.html`;
const FRAGMENT = `${DIR}/zombie-perf.fragment.html`; // body-only, for publishing as an Artifact

interface Run { ts: string; commit: string; label: string; nocache: boolean; points: BenchResult[] }

const args = process.argv.slice(2);
const regen = args.includes('--regen'); // rewrite the pages from history, no benchmarking
const nocache = args.includes('--nocache');

if (regen) {
  const hist: Run[] = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : [];
  writeFileSync(PAGE, renderPage(hist, true));
  writeFileSync(FRAGMENT, renderPage(hist, false));
  console.log(`regenerated ${PAGE} and ${FRAGMENT} from ${hist.length} runs`);
  process.exit(0);
}

const countsArg = args.find((a) => a.startsWith('--counts='));
const label = args.find((a) => !a.startsWith('--')) ?? (nocache ? 'baseline' : 'run');
const counts = countsArg
  ? countsArg.slice('--counts='.length).split(',').map(Number).filter((n) => n > 0)
  : [50, 100, 200, 300, 500, 800, 1200, 1600];

let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* not a repo */ }

if (nocache) _setObjectiveCache(false);

console.log(`bench-track: "${label}" @ ${commit}${nocache ? ' (obj-cache OFF)' : ''}`);
console.log(`sweep: ${counts.join(', ')} shamblers`);
const points: BenchResult[] = [];
for (const n of counts) {
  // fewer measured ticks as the horde grows, so a big sweep stays quick
  const ticks = n <= 300 ? 400 : n <= 800 ? 250 : 150;
  const r = runBench(n, ticks, n <= 800 ? 500 : 350);
  points.push(r);
  const overBudget = r.mean > BUDGET_MS ? '  ⚠ OVER BUDGET' : '';
  console.log(`  ${String(n).padStart(4)} shamblers  mean ${r.mean.toFixed(2)} ms  (${(r.mean / BUDGET_MS * 100).toFixed(0)}% frame)  p95 ${r.p95.toFixed(2)}${overBudget}`);
}

const run: Run = {
  ts: new Date().toISOString(),
  commit,
  label: nocache && !args.find((a) => !a.startsWith('--')) ? 'baseline (no obj-cache)' : label,
  nocache,
  points,
};

mkdirSync(DIR, { recursive: true });
const history: Run[] = existsSync(HISTORY) ? JSON.parse(readFileSync(HISTORY, 'utf8')) : [];
history.push(run);
writeFileSync(HISTORY, JSON.stringify(history, null, 1));
writeFileSync(PAGE, renderPage(history, true));
writeFileSync(FRAGMENT, renderPage(history, false)); // body-only for the Artifact

// the wall: first count where this run crosses the frame budget (interpolated)
const wall = estimateWall(points);
console.log(`\nrecorded → ${HISTORY} (${history.length} runs total)`);
console.log(`graph    → ${PAGE}`);
console.log(wall ? `the wall: ~${wall} shamblers before a single step blows the 16.7 ms frame budget` : 'the wall: not reached within this sweep');

function estimateWall(pts: BenchResult[]): number | null {
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].mean >= BUDGET_MS && pts[i - 1].mean < BUDGET_MS) {
      const a = pts[i - 1], b = pts[i];
      const t = (BUDGET_MS - a.mean) / (b.mean - a.mean);
      return Math.round(a.n + t * (b.n - a.n));
    }
  }
  if (pts.every((p) => p.mean < BUDGET_MS)) {
    // extrapolate from the top two points
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    if (a && b && b.mean > a.mean) {
      const slope = (b.mean - a.mean) / (b.n - a.n);
      return Math.round(b.n + (BUDGET_MS - b.mean) / slope);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// THE GRAPH — a self-contained tactical-terminal page in War World's own
// language: ink ground, house amber, hard edges + corner brackets, mono type.
// Every run is a WAVE. Older waves recede into steel; the newest wave burns
// amber with an area fill. Panels: the sweep chart (LIN/LOG), THE WALL
// ADVANCES (per-wave staircase), the raw table. Hover any point for numbers.
// ---------------------------------------------------------------------------
function renderPage(hist: Run[], full: boolean): string {
  const data = JSON.stringify(hist);
  const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>War World — Zombie Stress Bench</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🧟</text></svg>" />
</head>
<body>`;
  const body = `<style>
  :root{
    --ink:#111419; --panel:#181d24; --panel2:#141920; --line:#2a313b; --grid:#20262e;
    --fg:#e7ecf2; --muted:#8b98a8; --dim:#5a6675;
    --amber:#e8a33d; --amber-hot:#ffc266; --good:#46d17a; --bad:#ff4736;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--ink);color:var(--fg);
    font:14px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  ::selection{background:var(--amber);color:var(--ink)}
  .wrap{max-width:1040px;margin:0 auto;padding:30px 22px 70px}

  /* ── masthead ─────────────────────────────────────────────── */
  header{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;
    gap:16px;border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:18px}
  h1{font-size:21px;letter-spacing:.14em;text-transform:uppercase;margin:0;color:var(--fg)}
  h1 b{color:var(--amber);font-weight:700}
  .sub{color:var(--muted);font-size:12px;margin:4px 0 0;max-width:62ch}
  .chips{display:flex;gap:10px;flex-wrap:wrap}
  .chip{border:1px solid var(--line);background:var(--panel2);padding:7px 12px;min-width:104px}
  .chip .k{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
  .chip .v{font-size:19px;color:var(--amber);font-variant-numeric:tabular-nums}
  .chip .v small{font-size:11px;color:var(--muted)}
  .chip.up .v{color:var(--good)}

  /* ── panels ───────────────────────────────────────────────── */
  .panel{background:var(--panel);border:1px solid var(--line);padding:16px;position:relative;margin-top:22px}
  .panel::before,.panel::after{content:"";position:absolute;width:11px;height:11px;border:2px solid var(--amber);pointer-events:none}
  .panel::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
  .panel::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
  .phead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 12px}
  .ptitle{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--amber)}
  .toggle{display:flex;border:1px solid var(--line)}
  .toggle button{all:unset;cursor:pointer;font:11px ui-monospace,Menlo,Consolas,monospace;
    letter-spacing:.1em;color:var(--muted);padding:4px 12px}
  .toggle button.on{background:var(--amber);color:var(--ink)}
  .toggle button:focus-visible{outline:2px solid var(--amber-hot);outline-offset:-2px}
  svg{display:block;width:100%;height:auto;overflow:visible}
  text{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}

  /* ── waves legend ─────────────────────────────────────────── */
  .waves{display:flex;flex-direction:column;gap:6px;margin-top:14px}
  .wave{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--muted);
    border-left:3px solid transparent;padding:3px 8px}
  .wave .no{color:var(--dim);letter-spacing:.08em}
  .wave .lbl{color:var(--fg)}
  .wave .meta{margin-left:auto;color:var(--dim);font-size:11px;white-space:nowrap}
  .wave.latest{background:var(--panel2)}
  .wave.latest .lbl{color:var(--amber-hot)}

  /* ── table ────────────────────────────────────────────────── */
  .tblwrap{overflow-x:auto;margin-top:4px}
  table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}
  th,td{text-align:right;padding:6px 11px;border-bottom:1px solid var(--grid);white-space:nowrap}
  th:first-child,td:first-child{text-align:left}
  thead th{color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:400;
    font-size:10px;border-bottom:1px solid var(--line)}
  td.over{color:var(--bad)} td.under{color:var(--good)} td.na{color:var(--dim)}
  tr.latest td{color:var(--fg);background:var(--panel2)}
  tr.latest td.over{color:var(--bad)} tr.latest td.under{color:var(--good)}
  .dot{display:inline-block;width:8px;height:8px;margin-right:7px}

  .note{color:var(--muted);font-size:12px;margin-top:20px;max-width:74ch;line-height:1.65}
  .note b{color:var(--fg);font-weight:400}

  /* tooltip */
  #tip{position:fixed;pointer-events:none;background:var(--ink);border:1px solid var(--amber);
    padding:7px 10px;font-size:11px;line-height:1.6;display:none;z-index:9;
    box-shadow:0 4px 18px rgba(0,0,0,.5)}
  #tip .t-n{color:var(--amber);letter-spacing:.06em}
  #tip .t-run{color:var(--muted)}
  @media (prefers-reduced-motion: no-preference){
    .drawable{transition:stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)}
  }
</style>
<div class="wrap">
  <header>
    <div>
      <h1>Zombie <b>Stress Bench</b></h1>
      <p class="sub">Sim-step cost as the shambler horde grows — 12 defenders holding, population pinned every tick, <span style="color:var(--fg)">step() only</span>. Each optimization is a <span style="color:var(--amber)">wave</span>; each wave should ride lower than the last.</p>
    </div>
    <div class="chips" id="chips"></div>
  </header>

  <div class="panel">
    <div class="phead">
      <span class="ptitle">Step time vs horde size</span>
      <div class="toggle" role="group" aria-label="y scale">
        <button id="sc-lin" class="on">LIN</button><button id="sc-log">LOG</button>
      </div>
    </div>
    <svg id="chart" viewBox="0 0 940 470" role="img" aria-label="Step time versus zombie count, one curve per optimization wave"></svg>
    <div class="waves" id="waves"></div>
  </div>

  <div class="panel">
    <div class="phead"><span class="ptitle">The wall advances</span>
      <span style="font-size:11px;color:var(--muted)">shamblers before one step blows the 16.7&nbsp;ms frame</span></div>
    <svg id="wallchart" viewBox="0 0 940 10" aria-label="Frame-budget wall per wave"></svg>
  </div>

  <div class="panel">
    <div class="phead"><span class="ptitle">Every run on record</span></div>
    <div class="tblwrap"><table id="tbl"></table></div>
  </div>

  <p class="note" id="note"></p>
</div>
<div id="tip"></div>
<script>
const HISTORY = ${data};
const BUDGET = ${BUDGET_MS};
const NS='http://www.w3.org/2000/svg';
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};
const fmt=(x,d)=>x.toFixed(d===undefined?2:d);

// ── wave palette: older waves recede into steel, the newest burns amber ──
function waveColor(i,n){
  if(i===n-1) return '#e8a33d';
  if(n<=1) return '#e8a33d';
  const t=i/(n-1); // 0 oldest … →1 newest
  const mix=(a,b,k)=>Math.round(a+(b-a)*k);
  // steel #4a5462 → pale slate #93a0b0 as waves get more recent
  return 'rgb('+mix(74,147,t)+','+mix(84,160,t)+','+mix(98,176,t)+')';
}
const runs=HISTORY.map((r,i)=>({...r,i,color:waveColor(i,HISTORY.length),latest:i===HISTORY.length-1}));

function wallOf(pts){
  for(let i=1;i<pts.length;i++){
    if(pts[i].mean>=BUDGET&&pts[i-1].mean<BUDGET){
      const a=pts[i-1],b=pts[i],t=(BUDGET-a.mean)/(b.mean-a.mean);
      return Math.round(a.n+t*(b.n-a.n));
    }
  }
  if(pts.every(p=>p.mean<BUDGET)&&pts.length>1){
    const a=pts[pts.length-2],b=pts[pts.length-1];
    if(b.mean>a.mean) return Math.round(b.n+(BUDGET-b.mean)*(b.n-a.n)/(b.mean-a.mean));
  }
  return null;
}
runs.forEach(r=>r.wall=wallOf(r.points));

const allN=[...new Set(runs.flatMap(r=>r.points.map(p=>p.n)))].sort((a,b)=>a-b);
const maxN=Math.max.apply(null,allN);
const maxMs=Math.max.apply(null,[BUDGET*1.05].concat(runs.flatMap(r=>r.points.map(p=>p.mean))))*1.09;
const minMs=Math.min.apply(null,runs.flatMap(r=>r.points.map(p=>p.mean)));

// ── header chips ──
(function(){
  const first=runs[0],last=runs[runs.length-1];
  const chips=[];
  chips.push({k:'waves recorded',v:String(runs.length)});
  if(last.wall)chips.push({k:'current wall',v:'~'+last.wall+'<small> zeds</small>'});
  if(runs.length>=2&&first.wall&&last.wall){
    const d=last.wall-first.wall;
    chips.push({k:'wall moved',v:(d>=0?'+':'')+d+'<small> zeds</small>',up:d>0});
  }
  if(runs.length>=2){
    const common=first.points.filter(p=>last.points.some(q=>q.n===p.n));
    let best=0,bn=0;
    common.forEach(p=>{const q=last.points.find(q=>q.n===p.n);const pct=Math.round((1-q.mean/p.mean)*100);
      if(pct>best){best=pct;bn=p.n;}});
    if(best>0)chips.push({k:'best gain',v:'-'+best+'%<small> @'+bn+'</small>',up:true});
  }
  document.getElementById('chips').innerHTML=chips.map(c=>
    '<div class="chip'+(c.up?' up':'')+'"><div class="k">'+c.k+'</div><div class="v">'+c.v+'</div></div>').join('');
})();

// ── main chart ──
const svg=document.getElementById('chart');
const M={l:60,r:20,t:16,b:46},W=940,H=470,iw=W-M.l-M.r,ih=H-M.t-M.b;
let yMode='lin';
const x=n=>M.l+(n/maxN)*iw;
const yLin=ms=>M.t+ih-(ms/maxMs)*ih;
const lo=Math.max(0.2,minMs*0.8);
const yLog=ms=>{const a=Math.log(lo),b=Math.log(maxMs);return M.t+ih-((Math.log(Math.max(lo,ms))-a)/(b-a))*ih;};
const Y=ms=>yMode==='lin'?yLin(ms):yLog(ms);

// smooth catmull-rom→bezier, control-y clamped so the curve never dips
// below/above its own endpoints (an honest chart doesn't overshoot)
function smooth(pts){
  if(pts.length<3)return 'M'+pts.map(p=>p[0]+' '+p[1]).join(' L ');
  let d='M'+pts[0][0]+','+pts[0][1];
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    const lo2=Math.min(p1[1],p2[1]),hi=Math.max(p1[1],p2[1]);
    const c1y=Math.min(hi,Math.max(lo2,p1[1]+(p2[1]-p0[1])/6));
    const c2y=Math.min(hi,Math.max(lo2,p2[1]-(p3[1]-p1[1])/6));
    d+='C'+(p1[0]+(p2[0]-p0[0])/6)+','+c1y+' '+(p2[0]-(p3[0]-p1[0])/6)+','+c2y+' '+p2[0]+','+p2[1];
  }
  return d;
}

const tip=document.getElementById('tip');
let hoverPts=[]; // {sx,sy,n,mean,p95,label,color}

function drawChart(){
  svg.innerHTML='';
  hoverPts=[];
  // defs: amber area gradient for the latest wave
  const defs=el('defs',{});
  defs.innerHTML='<linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0" stop-color="#e8a33d" stop-opacity=".22"/>'
    +'<stop offset="1" stop-color="#e8a33d" stop-opacity="0"/></linearGradient>';
  svg.appendChild(defs);

  // y grid + labels
  const ticks=yMode==='lin'
    ? (function(){const s=maxMs>24?10:maxMs>12?5:2;const t=[];for(let v=0;v<=maxMs;v+=s)t.push(v);return t;})()
    : [0.5,1,2,4,8,16.7,32,64].filter(v=>v>=lo*0.9&&v<=maxMs);
  ticks.forEach(ms=>{
    svg.appendChild(el('line',{x1:M.l,y1:Y(ms),x2:W-M.r,y2:Y(ms),stroke:'#20262e','stroke-width':1}));
    const t=el('text',{x:M.l-9,y:Y(ms)+4,fill:'#8b98a8','font-size':11,'text-anchor':'end'});
    t.textContent=ms===16.7?'16.7':fmt(ms,ms<2?1:0);svg.appendChild(t);
  });
  // budget line
  svg.appendChild(el('line',{x1:M.l,y1:Y(BUDGET),x2:W-M.r,y2:Y(BUDGET),stroke:'#ff4736','stroke-width':1.5,'stroke-dasharray':'7 5'}));
  const bl=el('text',{x:W-M.r,y:Y(BUDGET)-7,fill:'#ff4736','font-size':11,'text-anchor':'end'});
  bl.textContent='16.7 ms — the 60 fps frame';svg.appendChild(bl);
  // x ticks
  allN.forEach(n=>{
    const t=el('text',{x:x(n),y:H-M.b+19,fill:'#8b98a8','font-size':11,'text-anchor':'middle'});
    t.textContent=n;svg.appendChild(t);
  });
  const xl=el('text',{x:M.l+iw/2,y:H-7,fill:'#5a6675','font-size':11,'text-anchor':'middle','letter-spacing':'.12em'});
  xl.textContent='SHAMBLERS ON THE FIELD';svg.appendChild(xl);
  const yl=el('text',{x:17,y:M.t+ih/2,fill:'#5a6675','font-size':11,'text-anchor':'middle',
    transform:'rotate(-90 17 '+(M.t+ih/2)+')','letter-spacing':'.12em'});
  yl.textContent='SIM STEP (MS)';svg.appendChild(yl);

  // waves, oldest first so the newest paints on top
  runs.forEach(r=>{
    const P=r.points.map(p=>[x(p.n),Y(p.mean)]);
    const d=smooth(P);
    if(r.latest){
      const area=d+' L'+P[P.length-1][0]+','+(M.t+ih)+' L'+P[0][0]+','+(M.t+ih)+' Z';
      svg.appendChild(el('path',{d:area,fill:'url(#gA)',stroke:'none'}));
    }
    const path=el('path',{d,fill:'none',stroke:r.color,
      'stroke-width':r.latest?2.6:1.4,'stroke-opacity':r.latest?1:0.75,class:'drawable'});
    svg.appendChild(path);
    // line-draw reveal, newest last (each wave "continues" from the one before)
    try{
      const len=path.getTotalLength();
      path.style.strokeDasharray=String(len);
      path.style.strokeDashoffset=String(len);
      requestAnimationFrame(()=>setTimeout(()=>{path.style.strokeDashoffset='0';},140*r.i));
    }catch(e){/* headless */}
    r.points.forEach(p=>{
      const sx=x(p.n),sy=Y(p.mean);
      svg.appendChild(el('circle',{cx:sx,cy:sy,r:r.latest?3.8:2.6,
        fill:p.mean>BUDGET?'#ff4736':r.color,'fill-opacity':r.latest?1:0.85}));
      hoverPts.push({sx,sy,n:p.n,mean:p.mean,p95:p.p95,label:r.label,color:r.color});
    });
  });
}
drawChart();

// hover readout
svg.addEventListener('mousemove',ev=>{
  const rect=svg.getBoundingClientRect();
  const sx=(ev.clientX-rect.left)*(W/rect.width), sy=(ev.clientY-rect.top)*(H/rect.height);
  let best=null,bd=17*17;
  hoverPts.forEach(p=>{const d=(p.sx-sx)*(p.sx-sx)+(p.sy-sy)*(p.sy-sy);if(d<bd){bd=d;best=p;}});
  if(!best){tip.style.display='none';return;}
  tip.innerHTML='<div class="t-n">'+best.n+' shamblers — '+fmt(best.mean)+' ms</div>'
    +'<div class="t-run">p95 '+fmt(best.p95)+' · '+Math.round(best.mean/BUDGET*100)+'% of frame</div>'
    +'<div class="t-run" style="color:'+best.color+'">'+best.label+'</div>';
  tip.style.display='block';
  tip.style.left=Math.min(window.innerWidth-190,ev.clientX+14)+'px';
  tip.style.top=(ev.clientY+14)+'px';
});
svg.addEventListener('mouseleave',()=>{tip.style.display='none';});

// scale toggle
const bLin=document.getElementById('sc-lin'),bLog=document.getElementById('sc-log');
function setMode(m){yMode=m;bLin.classList.toggle('on',m==='lin');bLog.classList.toggle('on',m==='log');drawChart();}
bLin.onclick=()=>setMode('lin');bLog.onclick=()=>setMode('log');

// ── waves legend ──
document.getElementById('waves').innerHTML=runs.map(r=>
  '<div class="wave'+(r.latest?' latest':'')+'" style="border-left-color:'+r.color+'">'
  +'<span class="no">W'+String(r.i+1).padStart(2,'0')+'</span>'
  +'<span class="lbl">'+r.label+'</span>'
  +'<span class="meta">'+r.commit+' · '+r.ts.slice(0,10)
  +(r.wall?' · wall ~'+r.wall:'')+'</span></div>').join('');

// ── the wall advances ──
(function(){
  const wsvg=document.getElementById('wallchart');
  const rows=runs.filter(r=>r.wall!==null);
  if(!rows.length){wsvg.remove();return;}
  const RH=34,PAD=6,LW=940;
  const h=rows.length*(RH+PAD)+8;
  wsvg.setAttribute('viewBox','0 0 '+LW+' '+h);
  const wMax=Math.max.apply(null,rows.map(r=>r.wall))*1.12;
  rows.forEach((r,j)=>{
    const yy=j*(RH+PAD)+4;
    const bw=Math.max(3,(r.wall/wMax)*(LW-260));
    wsvg.appendChild(el('rect',{x:150,y:yy+6,width:bw,height:RH-14,
      fill:r.latest?'#e8a33d':r.color,'fill-opacity':r.latest?1:0.55}));
    const lbl=el('text',{x:142,y:yy+RH/2+4,fill:r.latest?'#ffc266':'#8b98a8','font-size':11,'text-anchor':'end'});
    lbl.textContent='W'+String(r.i+1).padStart(2,'0');wsvg.appendChild(lbl);
    const val=el('text',{x:150+bw+10,y:yy+RH/2+4,fill:r.latest?'#e8a33d':'#8b98a8','font-size':12});
    const prev=j>0?rows[j-1].wall:null;
    const delta=prev!==null?(r.wall-prev):null;
    val.textContent='~'+r.wall+(delta!==null?'  ('+(delta>=0?'+':'')+delta+')':'');
    wsvg.appendChild(val);
    // continuity tick: where the previous wave's wall stood
    if(prev!==null){
      const px=150+(prev/wMax)*(LW-260);
      wsvg.appendChild(el('line',{x1:px,y1:yy+2,x2:px,y2:yy+RH-6,stroke:'#5a6675','stroke-width':1,'stroke-dasharray':'2 3'}));
    }
  });
})();

// ── table ──
(function(){
  const tbl=document.getElementById('tbl');
  let html='<thead><tr><th>wave</th>'+allN.map(n=>'<th>'+n+'</th>').join('')+'<th>wall</th></tr></thead><tbody>';
  html+=runs.map(r=>{
    const byN={};r.points.forEach(p=>byN[p.n]=p);
    const cells=allN.map(n=>{const p=byN[n];if(!p)return '<td class="na">·</td>';
      return '<td class="'+(p.mean>BUDGET?'over':'under')+'">'+fmt(p.mean)+'</td>';}).join('');
    return '<tr'+(r.latest?' class="latest"':'')+'><td><span class="dot" style="background:'+r.color+'"></span>W'
      +String(r.i+1).padStart(2,'0')+' '+r.label+'</td>'+cells
      +'<td>'+(r.wall?'~'+r.wall:'—')+'</td></tr>';
  }).join('');
  tbl.innerHTML=html+'</tbody>';
})();

// ── the note ──
(function(){
  if(runs.length<2)return;
  const a=runs[0],b=runs[runs.length-1];
  const common=a.points.filter(p=>b.points.some(q=>q.n===p.n));
  const deltas=common.map(p=>{const q=b.points.find(q=>q.n===p.n);
    return {n:p.n,pct:Math.round((1-q.mean/p.mean)*100)};});
  const best=deltas.reduce((m,d)=>d.pct>m.pct?d:m,{pct:-999,n:0});
  let s='Latest wave <b>“'+b.label+'”</b> vs <b>“'+a.label+'”</b>: up to <b>'+best.pct+'% faster</b> (at '+best.n+' shamblers)';
  if(a.wall&&b.wall)s+=', and the wall has marched from <b>~'+a.wall+'</b> to <b>~'+b.wall+'</b> shamblers';
  s+='. Values are mean step ms; a red point means a single step blew the frame budget. Older waves fade to steel — the amber wave is the war as it stands.';
  document.getElementById('note').innerHTML=s;
})();
</script>`;
  return full ? `${head}\n${body}\n</body>\n</html>` : body;
}
