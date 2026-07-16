/**
 * Headless balance simulator — the numbers half of docs/BALANCE-PLAN.md.
 *
 *   npx tsx tools/balance-sim.ts                     # 4 matches, tdm, 5 sim-minutes
 *   npx tsx tools/balance-sim.ts --matches 10 --mode conquest --minutes 8
 *
 * Runs full bot-vs-bot wars at simulation speed (no renderer, no RAF) and
 * prints the per-class and per-weapon ledger: pick a knob in the Arsenal Lab,
 * apply the Δ to data.ts/arsenal.ts, re-run this, watch the table move.
 * Testing finds balance; the table is the witness.
 */
import { World } from '../src/sim/world';
import { CLASSES } from '../src/sim/data';
import type { ClassId, ModeId, SimEvent } from '../src/sim/types';

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const MATCHES = Number(arg('matches', '4'));
const MODE = arg('mode', 'tdm') as ModeId;
const MINUTES = Number(arg('minutes', '5'));
const TEAM = 12; // 32B

const CLASS_POOL = Object.keys(CLASSES) as ClassId[];

interface ClassStat { kills: number; deaths: number; soldiers: number; wins: number }
const byClass = new Map<ClassId, ClassStat>();
const byWeapon = new Map<string, number>();
let draws = 0;
const durations: number[] = [];

for (let m = 0; m < MATCHES; m++) {
  const seed = (m * 2654435761 + 12345) >>> 0; // deterministic batch
  const w = new World({ seed, mode: MODE, matchMinutes: MINUTES, difficulty: 'veteran' });
  const classOf = new Map<string, ClassId>();
  let n = 0;
  for (const team of [0, 1] as const) {
    for (let i = 0; i < TEAM; i++) {
      const cls = CLASS_POOL[(i + team * 3) % CLASS_POOL.length];
      const s = w.addSoldier(`B${team}-${n++}`, cls, team, 'bot',
        cls === 'heavy' ? { equipment: ['manpads'] } : undefined);
      classOf.set(s.name, cls);
      const st = byClass.get(cls) ?? { kills: 0, deaths: 0, soldiers: 0, wins: 0 };
      st.soldiers++;
      byClass.set(cls, st);
    }
  }
  const maxSteps = Math.round(MINUTES * 60 * 60) + 600;
  let steps = 0;
  while (!w.mode.over && steps < maxSteps) {
    w.step(1 / 60, new Map());
    steps++;
    for (const e of w.takeEvents() as SimEvent[]) {
      if (e.type !== 'death') continue;
      if (e.killerName && classOf.has(e.killerName)) {
        const st = byClass.get(classOf.get(e.killerName)!)!;
        st.kills++;
        byWeapon.set(e.weaponName ?? '?', (byWeapon.get(e.weaponName ?? '?') ?? 0) + 1);
      }
      if (e.victimName && classOf.has(e.victimName)) byClass.get(classOf.get(e.victimName)!)!.deaths++;
    }
  }
  durations.push(w.time);
  const winner = w.mode.winner;
  if (winner === -1 || winner === undefined) draws++;
  else {
    for (const s of w.soldiers.values()) {
      if (s.kind === 'bot' && s.team === winner) {
        const st = byClass.get(classOf.get(s.name)!);
        if (st) st.wins++;
      }
    }
  }
  console.log(`match ${m + 1}/${MATCHES}: ${MODE} seed ${seed} → ${winner === 0 ? 'United Front' : winner === 1 ? 'Collective' : 'draw'} in ${(w.time / 60).toFixed(1)} sim-min (${w.mode.scores[0]}–${w.mode.scores[1]})`);
}

console.log(`\n══ CLASS LEDGER — ${MATCHES}× ${MODE}, ${TEAM}v${TEAM}, ${MINUTES} sim-min cap ══`);
console.log('class'.padEnd(14), 'K'.padStart(6), 'D'.padStart(6), 'K/D'.padStart(6), 'K/soldier'.padStart(10), 'win%'.padStart(6));
const kds: number[] = [];
for (const [cls, st] of [...byClass.entries()].sort((a, b) => b[1].kills - a[1].kills)) {
  const kd = st.deaths ? st.kills / st.deaths : st.kills;
  kds.push(kd);
  console.log(cls.padEnd(14), String(st.kills).padStart(6), String(st.deaths).padStart(6),
    kd.toFixed(2).padStart(6), (st.kills / st.soldiers).toFixed(1).padStart(10),
    `${Math.round((st.wins / st.soldiers) * 100)}%`.padStart(6));
}
const meanKd = kds.reduce((a, b) => a + b, 0) / kds.length;
const outliers = [...byClass.entries()].filter(([, st]) => {
  const kd = st.deaths ? st.kills / st.deaths : st.kills;
  return Math.abs(kd - meanKd) > meanKd * 0.35;
});
if (outliers.length) console.log(`\n⚠ K/D outliers (±35% of mean ${meanKd.toFixed(2)}):`, outliers.map(([c]) => c).join(', '));
else console.log(`\n✓ class K/D spread within ±35% of mean (${meanKd.toFixed(2)})`);

console.log('\n══ TOP WEAPONS ══');
for (const [wpn, k] of [...byWeapon.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(wpn.padEnd(28), String(k).padStart(5));
}
console.log(`\ndraws: ${draws}/${MATCHES} · mean duration ${(durations.reduce((a, b) => a + b, 0) / durations.length / 60).toFixed(1)} sim-min`);
