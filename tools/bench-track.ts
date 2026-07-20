/**
 * BENCH TRACKER — Robert's ask: "do a benchmark, do the fixes, do another
 * benchmark, and see the improvement on a graph every time." Runs a SWEEP of
 * shambler counts (ramping up to find the wall), appends the labelled run to
 * docs/bench/zombie-history.json, and regenerates a self-contained graph at
 * docs/bench/zombie-perf.html — one line per run, so each fix draws a new
 * (lower, we hope) curve over the last.
 *
 *   npx tsx tools/bench-track.ts "<label>" [--nocache] [--counts=50,100,300,...]
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
// the graph — a self-contained tactical-terminal page (War World's own look:
// ink ground, house amber, hard edges, mono type). One polyline per run.
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
    --ink:#12151a; --panel:#1a1e24; --line:#2b323c; --grid:#232a33;
    --fg:#e7ecf2; --muted:#8b98a8; --amber:#e8a33d; --good:#46d17a; --bad:#ff4736;
  }
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--ink);color:var(--fg);
    font:14px/1.5 ui-monospace,"SF Mono",Menlo,Consolas,monospace}
  .wrap{max-width:1000px;margin:0 auto;padding:28px 20px 60px}
  h1{font-size:20px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 2px;color:var(--amber)}
  .sub{color:var(--muted);font-size:12px;margin:0 0 22px}
  .panel{background:var(--panel);border:1px solid var(--line);padding:18px 16px 8px;position:relative}
  .panel::before,.panel::after{content:"";position:absolute;width:10px;height:10px;border:2px solid var(--amber)}
  .panel::before{left:-1px;top:-1px;border-right:0;border-bottom:0}
  .panel::after{right:-1px;bottom:-1px;border-left:0;border-top:0}
  svg{display:block;width:100%;height:auto;overflow:visible}
  .legend{display:flex;flex-wrap:wrap;gap:14px;margin:14px 2px 2px;font-size:12px}
  .lg{display:flex;align-items:center;gap:7px;color:var(--muted)}
  .sw{width:16px;height:3px;display:inline-block}
  table{border-collapse:collapse;width:100%;margin-top:26px;font-size:12px;
    font-variant-numeric:tabular-nums;overflow-x:auto;display:block}
  th,td{text-align:right;padding:5px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
  th:first-child,td:first-child{text-align:left}
  thead th{color:var(--amber);text-transform:uppercase;letter-spacing:.05em;font-weight:400;border-bottom:1px solid var(--amber)}
  td.over{color:var(--bad)} td.under{color:var(--good)}
  .note{color:var(--muted);font-size:12px;margin-top:18px;max-width:70ch}
  .runlbl{color:var(--fg)}
  .commit{color:var(--muted)}
</style>
</head>
<body>
<div class="wrap">
  <h1>Zombie Stress Bench</h1>
  <p class="sub">Sim-step cost vs shambler count — 12 defenders holding, population pinned each tick, <span style="color:var(--fg)">step() only</span>. Lower is faster. Each fix draws a new line.</p>
  <div class="panel">
    <svg id="chart" viewBox="0 0 900 460" role="img" aria-label="Step time versus zombie count"></svg>
  </div>
  <div class="legend" id="legend"></div>
  <table id="tbl"></table>
  <p class="note" id="note"></p>
</div>
<script>
const HISTORY = ${data};
const BUDGET = ${BUDGET_MS};
const COLORS = ['#e8a33d','#3dbde8','#46d17a','#ff8a2a','#c9d1d9','#e85d9c','#8fd4e8'];
const runs = HISTORY.map((r,i)=>({...r, color: COLORS[i % COLORS.length]}));

// scales
const allN = [...new Set(runs.flatMap(r=>r.points.map(p=>p.n)))].sort((a,b)=>a-b);
const maxN = Math.max(...allN, 1);
const maxMs = Math.max(BUDGET*1.05, ...runs.flatMap(r=>r.points.map(p=>p.mean)))*1.08;
const M={l:58,r:18,t:14,b:44}, W=900, H=460, iw=W-M.l-M.r, ih=H-M.t-M.b;
const x=n=>M.l+(n/maxN)*iw;
const y=ms=>M.t+ih-(ms/maxMs)*ih;

const svg=document.getElementById('chart');
const NS='http://www.w3.org/2000/svg';
const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);return e;};

// y grid + labels
for(let ms=0;ms<=maxMs;ms+= maxMs>20?5:2){
  svg.appendChild(el('line',{x1:M.l,y1:y(ms),x2:W-M.r,y2:y(ms),stroke:'#232a33', 'stroke-width':1}));
  const t=el('text',{x:M.l-8,y:y(ms)+4,fill:'#8b98a8','font-size':11,'text-anchor':'end'});t.textContent=ms.toFixed(0);svg.appendChild(t);
}
// budget line
svg.appendChild(el('line',{x1:M.l,y1:y(BUDGET),x2:W-M.r,y2:y(BUDGET),stroke:'#ff4736','stroke-width':1.5,'stroke-dasharray':'6 4'}));
const bl=el('text',{x:W-M.r,y:y(BUDGET)-6,fill:'#ff4736','font-size':11,'text-anchor':'end'});bl.textContent='16.7 ms — one 60fps frame';svg.appendChild(bl);
// x ticks
for(const n of allN){
  const t=el('text',{x:x(n),y:H-M.b+18,fill:'#8b98a8','font-size':11,'text-anchor':'middle'});t.textContent=n;svg.appendChild(t);
}
const xl=el('text',{x:M.l+iw/2,y:H-6,fill:'#8b98a8','font-size':11,'text-anchor':'middle'});xl.textContent='shamblers on the field';svg.appendChild(xl);
const yl=el('text',{x:16,y:M.t+ih/2,fill:'#8b98a8','font-size':11,'text-anchor':'middle',transform:'rotate(-90 16 '+(M.t+ih/2)+')'});yl.textContent='sim step (ms)';svg.appendChild(yl);

// one polyline per run
for(const r of runs){
  const pts=r.points.map(p=>x(p.n)+','+y(p.mean)).join(' ');
  svg.appendChild(el('polyline',{points:pts,fill:'none',stroke:r.color,'stroke-width':2}));
  for(const p of r.points){
    svg.appendChild(el('circle',{cx:x(p.n),cy:y(p.mean),r:3.2,fill:p.mean>BUDGET?'#ff4736':r.color}));
  }
}

// legend
const lg=document.getElementById('legend');
runs.forEach(r=>{
  const d=document.createElement('div');d.className='lg';
  d.innerHTML='<span class="sw" style="background:'+r.color+'"></span><span class="runlbl">'+r.label+'</span> <span class="commit">'+r.commit+' · '+r.ts.slice(0,10)+'</span>';
  lg.appendChild(d);
});

// table
const tbl=document.getElementById('tbl');
let head='<thead><tr><th>Run</th>'+allN.map(n=>'<th>'+n+'</th>').join('')+'</tr></thead><tbody>';
let body=runs.map(r=>{
  const byN=Object.fromEntries(r.points.map(p=>[p.n,p]));
  const cells=allN.map(n=>{const p=byN[n];if(!p)return '<td>·</td>';const cls=p.mean>BUDGET?'over':'under';return '<td class="'+cls+'">'+p.mean.toFixed(2)+'</td>';}).join('');
  return '<tr><td>'+r.label+'</td>'+cells+'</tr>';
}).join('');
tbl.innerHTML=head+body+'</tbody>';

// note: the improvement between the first and last run
if(runs.length>=2){
  const a=runs[0], b=runs[runs.length-1];
  const common=a.points.filter(p=>b.points.some(q=>q.n===p.n));
  const deltas=common.map(p=>{const q=b.points.find(q=>q.n===p.n);return {n:p.n, pct:Math.round((1-q.mean/p.mean)*100)};});
  const best=deltas.reduce((m,d)=>Math.abs(d.pct)>Math.abs(m.pct)?d:m,{pct:0,n:0});
  document.getElementById('note').textContent='"'+b.label+'" vs "'+a.label+'": up to '+best.pct+'% faster (at '+best.n+' shamblers). Values are mean step ms over the measured window; a point turns red when a single step blows the frame budget.';
}
</script>`;
  return full ? `${head}\n${body}\n</body>\n</html>` : body;
}
