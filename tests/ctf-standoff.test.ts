// ---------------------------------------------------------------------------
// THE STANDOFF BREAKER — the black box caught CTF's frozen endgame: both
// flags held, both carriers parked at their own bases (capture blocked while
// the own flag is away), and objectiveFor's unconditional "escort the
// carrier" stacking all twelve bodies on the parked runner. 12/12 pooled at
// each home base for eleven minutes, score 0:0, match never over — Robert's
// "they bunch up around my home base, eventually."
//
// The law now: a PARKED carrier keeps only his guards (as a ring); everyone
// else hunts the team's own flag — whose position IS the enemy carrier. And
// escort of a LIVE run is a ring around the runner, never his exact tile.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { guardsHome, objectiveFor } from '../src/sim/bots';
import { World } from '../src/sim/world';
import type { Soldier } from '../src/sim/types';

const MIX = ['infantry', 'infantry', 'heavy', 'medic', 'engineer', 'jump', 'infantry', 'infiltrator', 'infantry', 'heavy', 'medic', 'infantry'] as const;

function ctfWorld(seed: number): { w: World; bots: Soldier[] } {
  const w = new World({ seed, mode: 'ctf', matchMinutes: 15 });
  const bots: Soldier[] = [];
  for (const team of [0, 1] as const) {
    for (let i = 0; i < 12; i++) bots.push(w.addSoldier(`T${team}B${i}`, MIX[i], team, 'bot'));
  }
  return { w, bots };
}

/** Rig the double-held standoff: each team's raider holds the other's flag. */
function rigStandoff(w: World, bots: Soldier[]) {
  const m = w.mode;
  const t0carrier = bots.find((b) => b.team === 0 && !guardsHome(b))!;
  const t1carrier = bots.find((b) => b.team === 1 && !guardsHome(b))!;
  // team 0's runner holds team 1's flag, PARKED on his own base
  const base0 = w.map.basePos[0];
  t0carrier.pos = { x: base0.x + 1, y: 0, z: base0.z };
  t0carrier.carryingFlag = 1;
  m.flags![1].atHome = false;
  m.flags![1].carrierId = t0carrier.id;
  m.flags![1].pos = { ...t0carrier.pos };
  // team 1's runner holds team 0's flag, far away on their side
  t1carrier.pos = { x: 60, y: 0, z: 40 };
  t1carrier.carryingFlag = 0;
  m.flags![0].atHome = false;
  m.flags![0].carrierId = t1carrier.id;
  m.flags![0].pos = { ...t1carrier.pos };
  return { t0carrier, t1carrier };
}

describe('the CTF standoff breaker', () => {
  it('a parked carrier keeps his guards; the rest hunt the stolen flag', () => {
    const { w, bots } = ctfWorld(31);
    const { t0carrier, t1carrier } = rigStandoff(w, bots);

    const hunter = bots.find((b) => b.team === 0 && b.id !== t0carrier.id && !guardsHome(b))!;
    const guard = bots.find((b) => b.team === 0 && guardsHome(b))!;
    // park the teammates somewhere neutral so rescue logic stays quiet
    hunter.pos = { x: -60, y: 0, z: 10 };
    guard.pos = { x: -90, y: 0, z: 5 };

    // the hunter's war is RECOVERING the flag — its pos is the enemy carrier
    const oHunter = objectiveFor(w, hunter);
    expect(Math.hypot(oHunter.x - t1carrier.pos.x, oHunter.z - t1carrier.pos.z)).toBeLessThan(1);

    // the guard rings the waiting carrier (near, but never his exact tile)
    const oGuard = objectiveFor(w, guard);
    const dGuard = Math.hypot(oGuard.x - t0carrier.pos.x, oGuard.z - t0carrier.pos.z);
    expect(dGuard).toBeGreaterThan(4);
    expect(dGuard).toBeLessThan(10);

    // the carrier himself still wants his base
    const oCarrier = objectiveFor(w, t0carrier);
    const base0 = w.map.basePos[0];
    expect(Math.hypot(oCarrier.x - base0.x, oCarrier.z - base0.z)).toBeLessThan(1);
  });

  it('escort of a LIVE run is a ring around the runner, not his tile', () => {
    const { w, bots } = ctfWorld(32);
    const m = w.mode;
    // team 0's runner is mid-map with the enemy flag; own flag is safe at home
    const runner = bots.find((b) => b.team === 0 && !guardsHome(b))!;
    runner.pos = { x: 10, y: 0, z: -5 };
    runner.carryingFlag = 1;
    m.flags![1].atHome = false;
    m.flags![1].carrierId = runner.id;
    m.flags![1].pos = { ...runner.pos };

    for (const b of bots) {
      if (b.team !== 0 || b.id === runner.id) continue;
      b.pos = { x: -40, y: 0, z: 20 }; // clear of rescue triggers
      const o = objectiveFor(w, b);
      const d = Math.hypot(o.x - runner.pos.x, o.z - runner.pos.z);
      expect(d, `${b.name} must ring the runner, not stand on him`).toBeGreaterThan(4);
      expect(d, `${b.name} must stay in escort range`).toBeLessThan(10);
    }
  });

  it('the seed-4207 match never freezes into the home blob (the flight-log scene)', () => {
    // baseline before the breaker: score 0:0 with BOTH teams 12/12 pooled at
    // their own bases from t=240 on, 10-22 bodies "stuck" at any moment,
    // forever. Whether a given seed reaches 3 captures is chaotic — the LAWS
    // are: the whole-team home blob never forms, the war keeps moving (stuck
    // stays near zero), and if the match does resolve, somebody scored.
    const { w } = ctfWorld(4207);
    const DT = 1 / 30;
    for (let sec = 1; sec <= 600 && !w.mode.over; sec++) {
      for (let i = 0; i < Math.round(1 / DT); i++) w.step(DT, new Map());
    }
    if (w.mode.over) expect(w.mode.scores[0] + w.mode.scores[1]).toBeGreaterThan(0);

    // the black box must never see the whole-team home blob again
    const fullHouse = w.blackbox.samples.filter(
      (s) => s.t > 60 && ([0, 1] as const).some((t) => s.teams[t].n >= 10 && s.teams[t].nearBase === s.teams[t].n),
    );
    expect(fullHouse.map((s) => s.t), 'whole-team home blob resurfaced').toEqual([]);

    // and the bodies kept moving: the frozen build averaged 10+ stuck, calm
    // play averages ~0 — a generous ceiling still catches any relapse
    const samples = w.blackbox.samples.filter((s) => s.t > 60);
    const meanStuck = samples.reduce((a, s) => a + s.teams[0].stuck + s.teams[1].stuck, 0) / Math.max(1, samples.length);
    expect(meanStuck, `mean stuck bodies ${meanStuck.toFixed(2)} — the war seized up`).toBeLessThan(3);
  });
});
