// ---------------------------------------------------------------------------
// THE THREAT ROOM (Robert's combat laboratory). The laws: twenty experiments
// that each ASK something, a summon shelf that can put anything in the room,
// blockers that really block, movers that really move, and a CLEAR that
// leaves the room genuinely empty — an experiment is only worth running if
// the last one is gone.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  PRESET_TAGS, SUMMON_SHELF, THREAT_PRESETS, presetById, summonPositions,
} from '../src/sim/threatroom';
import {
  clearRoom, newRoom, roomCensus, runPreset, shelfSpec, stepRoom, summon,
} from '../src/client/threat-room';
import { LSWS } from '../src/sim/lsw';
import type { AscendantId } from '../src/sim/types';
import { World } from '../src/sim/world';

function lab() {
  const w = new World({ seed: 3, mode: 'threat', botsPerTeam: 0 });
  const me = w.addSoldier('ME', 'infantry', 0, 'human');
  me.pos = { x: 0, y: 0, z: 0 };
  me.alive = true;
  me.yaw = 0;
  return { w, me, room: newRoom() };
}

describe('the twenty', () => {
  it('there are twenty, each with a real question', () => {
    expect(THREAT_PRESETS.length).toBe(20);
    for (const p of THREAT_PRESETS) {
      expect(p.question.length, `${p.name} asks nothing`).toBeGreaterThan(30);
      expect(p.question).toMatch(/\?/); // it is a QUESTION
      expect(PRESET_TAGS).toContain(p.tag);
      expect(presetById(p.id)).toBe(p);
    }
  });

  it('they cover melee, gunplay, physics and crowds — not one axis', () => {
    const tags = new Set(THREAT_PRESETS.map((p) => p.tag));
    for (const need of ['melee', 'gunplay', 'physics', 'crowd'] as const) {
      expect(tags.has(need), `nothing probes ${need}`).toBe(true);
    }
    expect(THREAT_PRESETS.filter((p) => p.tag === 'melee').length,
      'melee is the thing being refined — it needs more than one').toBeGreaterThanOrEqual(4);
  });

  it('every summon lands in FRONT of you, at its stated range', () => {
    const spec = { kind: { what: 'dummy' } as const, count: 3, range: 20, arc: 1.2 };
    for (const p of summonPositions(spec, { x: 0, z: 0 }, 0)) {
      expect(p.x, 'it spawned behind the player').toBeGreaterThan(0);
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(15);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(26);
    }
  });
});

describe('the room', () => {
  it('a preset fills the room, and CLEAR empties it completely', () => {
    const { w, me, room } = lab();
    runPreset(w, room, me, 'the_tide_test');
    expect(roomCensus(w, room).alive).toBeGreaterThan(20);
    clearRoom(w, room);
    expect(roomCensus(w, room)).toEqual({ alive: 0, total: 0, vehicles: 0 });
  });

  it('running a preset CLEARS the last one — an experiment starts clean', () => {
    const { w, me, room } = lab();
    runPreset(w, room, me, 'the_tide_test');
    runPreset(w, room, me, 'first_blood');
    expect(roomCensus(w, room).total, 'the last experiment was still standing').toBe(1);
  });

  it('THE WALL really blocks — and never drops the guard', () => {
    const { w, me, room } = lab();
    runPreset(w, room, me, 'the_wall');
    const blocker = [...w.soldiers.values()].find((s) => s.roomBlocker)!;
    expect(blocker).toBeTruthy();
    expect(blocker.guarding).toBe(true);
    blocker.guarding = false; // try to knock the guard down
    blocker.energy = 0;       // and drain the tank that holds it
    stepRoom(w, room, 1 / 60);
    expect(blocker.guarding, 'the wall dropped its guard').toBe(true);
    expect(blocker.energy, 'and got tired of holding it').toBeGreaterThan(50);
  });

  it('THE MOVER really moves, and paces instead of wandering off', () => {
    const { w, me, room } = lab();
    runPreset(w, room, me, 'the_mover');
    const mover = [...w.soldiers.values()].find((s) => s.roomMover)!;
    const home = { ...mover.pos };
    let maxDrift = 0;
    for (let i = 0; i < 60 * 20; i++) {
      stepRoom(w, room, 1 / 60);
      maxDrift = Math.max(maxDrift, Math.hypot(mover.pos.x - home.x, mover.pos.z - home.z));
    }
    expect(maxDrift, 'it never moved').toBeGreaterThan(8);
    expect(maxDrift, 'it wandered out of the room').toBeLessThan(25);
  });

  it('a summoned GOD belongs to its own stable — or it never arrives', () => {
    const { w, me, room } = lab();
    summon(w, room, me, shelfSpec('ragebeast')!);
    const god = [...w.soldiers.values()].find((s) => s.ascendant);
    expect(god, 'the god refused to arrive').toBeTruthy();
    expect(god!.team).toBe(LSWS[god!.ascendant as AscendantId].faction);
  });

  it('the shelf can summon every one of its entries', () => {
    for (const entry of SUMMON_SHELF) {
      const { w, me, room } = lab();
      const spec = shelfSpec(entry.id);
      expect(spec, `${entry.id} has no spec`).toBeTruthy();
      summon(w, room, me, spec!);
      const c = roomCensus(w, room);
      expect(c.alive + c.vehicles, `${entry.id} summoned nothing`).toBeGreaterThan(0);
    }
  });

  it('the lab is CLEAN — nothing is in it that you did not ask for', () => {
    const w = new World({ seed: 3, mode: 'threat', botsPerTeam: 0, traffic: true });
    expect(w.vehicles.size, 'the lab came with hulls in it').toBe(0);
  });
});
