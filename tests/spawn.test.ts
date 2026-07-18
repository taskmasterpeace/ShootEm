// ---------------------------------------------------------------------------
// THE STATUE LAW — nobody spawns inside masonry, and nobody STAYS inside it.
//
// Diagnosed 2026-07-18 (Robert: "soldiers are bunched up again"): spawn()'s
// ±2.6u scatter never checked walkability, so a body could land INSIDE a
// blocked tile — where groundBlocked vetoes every step forever (the movement
// integrator only tests destinations, so from deep inside a wall every
// destination is also wall). The frozen body then became a spawn-on-squadmate
// ANCHOR, accreting the whole fireteam into the same structure: the full-HP
// blob standing in the base, legs pumping, going nowhere. A second entry
// vector: jump/leap landings put airborne bodies down on blocked tiles.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_WALL, TILE, WORLD, isBlocked } from '../src/sim/map';
import { World } from '../src/sim/world';
import type { Soldier } from '../src/sim/types';

const toWorld = (t: number) => (t + 0.5) * TILE - WORLD / 2;

describe('spawn placement (the statue law)', () => {
  it('never lands a respawn on a blocked tile, even when the squad anchor is embedded in a wall', () => {
    const w = new World({ seed: 11, mode: 'tdm', matchMinutes: 15 });
    // two squadmates (same team, consecutive → same fireteam)
    const mate = w.addSoldier('Anchor', 'infantry', 0, 'bot');
    const subject = w.addSoldier('Subject', 'infantry', 0, 'bot');
    expect(mate.squadId).toBe(subject.squadId);

    // a 7×7 wall block far from map features, with the mate EMBEDDED at its
    // center — the leap-landing vector, rigged. Every point of the ±2.6u
    // scatter square around the mate is masonry.
    const cx = 50, cz = 30;
    for (let dz = -4; dz <= 4; dz++)
      for (let dx = -4; dx <= 4; dx++)
        w.map.grid[(cz + dz) * GRID + (cx + dx)] = T_OPEN;
    for (let dz = -3; dz <= 3; dz++)
      for (let dx = -3; dx <= 3; dx++)
        w.map.grid[(cz + dz) * GRID + (cx + dx)] = T_WALL;
    mate.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
    expect(isBlocked(w.map.grid, mate.pos.x, mate.pos.z)).toBe(true);

    // fifty deaths, fifty redeployments: not one may stand inside a wall
    for (let i = 0; i < 50; i++) {
      subject.alive = false;
      w.spawn(subject);
      expect(
        isBlocked(w.map.grid, subject.pos.x, subject.pos.z),
        `respawn ${i} landed inside masonry at (${subject.pos.x.toFixed(1)}, ${subject.pos.z.toFixed(1)})`,
      ).toBe(false);
    }
  });

  it('a body standing inside a blocked tile walks itself out (no permanent statues)', () => {
    const w = new World({ seed: 12, mode: 'tdm', matchMinutes: 15 });
    const s = w.addSoldier('Buried', 'infantry', 0, 'bot');
    // bury him at the center of a wall block — deeper than one tick-step
    // from every open edge, the exact shape of the frozen forensic pair
    const cx = 50, cz = 30;
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++)
        w.map.grid[(cz + dz) * GRID + (cx + dx)] = dx === 0 && dz === 0 ? T_WALL : T_OPEN;
    s.pos = { x: toWorld(cx), y: 0, z: toWorld(cz) };
    s.dummy = true; // stand still — the escape must come from physics, not the brain

    for (let i = 0; i < Math.round(2 / (1 / 30)); i++) w.step(1 / 30, new Map());
    expect(
      isBlocked(w.map.grid, s.pos.x, s.pos.z),
      `still embedded at (${s.pos.x.toFixed(1)}, ${s.pos.z.toFixed(1)}) after 2s`,
    ).toBe(false);
  });

  it('a 12v12 match with an LSW produces no lasting statues (the screenshot scene)', () => {
    // seed 4207 reproduced Robert's blob deterministically: by t≈80s two
    // bodies froze inside the base structure and the squad accreted onto
    // them, 6 permanent statues by t=150s. The law: nobody stays blocked
    // for 3 consecutive sampled seconds.
    const w = new World({ seed: 4207, mode: 'tdm', matchMinutes: 15 });
    const MIX = ['infantry', 'infantry', 'heavy', 'medic', 'engineer', 'jump', 'infantry', 'infiltrator', 'infantry', 'heavy', 'medic', 'infantry'] as const;
    for (const team of [0, 1] as const) {
      for (let i = 0; i < 12; i++) w.addSoldier(`T${team}B${i}`, MIX[i], team, 'bot');
    }
    const base = w.map.basePos[0];
    w.addLsw('titan', 0, { x: base.x + 4, y: 0, z: base.z });

    const DT = 1 / 30;
    const blockedFor = new Map<number, number>(); // id → consecutive blocked seconds
    const statues: string[] = [];
    for (let sec = 1; sec <= 120; sec++) {
      for (let i = 0; i < Math.round(1 / DT); i++) w.step(DT, new Map());
      for (const s of w.humansAndBots()) {
        if (!s.alive || s.vehicleId >= 0 || s.pos.y > 0.9) { blockedFor.set(s.id, 0); continue; }
        const b = isBlocked(w.map.grid, s.pos.x, s.pos.z);
        const run = b ? (blockedFor.get(s.id) ?? 0) + 1 : 0;
        blockedFor.set(s.id, run);
        if (run === 3) statues.push(`${s.name} statue at (${s.pos.x.toFixed(1)}, ${s.pos.z.toFixed(1)}) t=${sec}s`);
      }
    }
    expect(statues, statues.join('; ')).toEqual([]);
  });
});

// keep the Soldier import earning its line — the rigs above mutate live bodies
type _Check = Soldier['pos'];
