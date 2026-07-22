// ---------------------------------------------------------------------------
// A1 THE AIRFIELD (Robert: "planes have to start off grounded… put them all
// together… buildings dedicated to certain aircraft").
//
// One strip behind the motor pool: jets flanking the runway head, the bomber
// deepest on the centreline, every airframe in its own hangar, and a poured-
// plate runway painted down the lane. Hangars are PROPS — no grid stamps, so
// they can never trap a hull or break a path.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  GRID, S_PLATE, TILE, WORLD, generateMap, isBlocked,
} from '../src/sim/map';
import type { Team } from '../src/sim/types';

const AIRCRAFT = ['strikejet', 'interceptor', 'bomber'] as const;
const ROTORCRAFT = ['attackheli', 'transportheli'] as const;

describe('A1 — the airfield', () => {
  it('stages two open-air rotorcraft pads beside each flight line', () => {
    const m = generateMap(42, 'tdm', 'savanna');
    for (const team of [0, 1] as Team[]) {
      const pads = m.vehiclePads.filter((pad) => pad.team === team && (ROTORCRAFT as readonly string[]).includes(pad.kind));
      expect(pads.map((pad) => pad.kind).sort()).toEqual([...ROTORCRAFT].sort());
      expect(pads.every((pad) => !isBlocked(m.grid, pad.pos.x, pad.pos.z))).toBe(true);
    }
  });
  it('THE FIELD IS TOGETHER: all three airframes park within one strip', () => {
    const m = generateMap(42, 'tdm', 'savanna');
    for (const team of [0, 1] as Team[]) {
      const pads = m.vehiclePads.filter((p) => p.team === team && (AIRCRAFT as readonly string[]).includes(p.kind));
      expect(pads.length).toBe(3);
      for (let i = 0; i < pads.length; i++) {
        for (let j = i + 1; j < pads.length; j++) {
          const d = Math.hypot(pads[i].pos.x - pads[j].pos.x, pads[i].pos.z - pads[j].pos.z);
          expect(d, `${pads[i].kind} and ${pads[j].kind} must share an airfield`).toBeLessThan(45);
        }
      }
    }
  });

  it('EVERY AIRFRAME SLEEPS INDOORS: a hangar prop stands on each aircraft pad', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const m = generateMap(seed, 'tdm', 'savanna');
      const hangars = m.props.filter((p) => p.type === 'hangar');
      expect(hangars.length, `seed ${seed}: 3 airframes x 2 teams`).toBe(6);
      for (const pad of m.vehiclePads) {
        if (!(AIRCRAFT as readonly string[]).includes(pad.kind)) continue;
        // the hangar wraps the TAIL — it sits 2.6u behind the pad on purpose
        const roof = hangars.find((h) => Math.hypot(h.pos.x - pad.pos.x, h.pos.z - pad.pos.z) < 4);
        expect(roof, `seed ${seed}: ${pad.kind} team ${pad.team} parks outdoors`).toBeTruthy();
      }
      // and the bomber's is the big one
      for (const pad of m.vehiclePads.filter((p) => p.kind === 'bomber')) {
        const h = hangars.find((x) => Math.hypot(x.pos.x - pad.pos.x, x.pos.z - pad.pos.z) < 4)!;
        expect(h.scale).toBeGreaterThan(1.2);
      }
    }
  });

  it('the pads under the hangars stay open ground — a canopy is not a wall', () => {
    for (const seed of [1, 7, 42, 1234]) {
      const m = generateMap(seed, 'tdm', 'savanna');
      const bad = m.vehiclePads.filter(
        (p) => (AIRCRAFT as readonly string[]).includes(p.kind) && isBlocked(m.grid, p.pos.x, p.pos.z));
      expect(bad.map((p) => `${p.kind}:${p.team}`), `seed ${seed}`).toEqual([]);
    }
  });

  it('THE APRON: a poured-plate flight line fronts each airfield', () => {
    const m = generateMap(42, 'tdm', 'savanna');
    for (const team of [0, 1] as Team[]) {
      const bomber = m.vehiclePads.find((p) => p.kind === 'bomber' && p.team === team)!;
      let plate = 0;
      const btx = Math.floor((bomber.pos.x + WORLD / 2) / TILE);
      const btz = Math.floor((bomber.pos.z + WORLD / 2) / TILE);
      for (let dx = -6; dx <= 6; dx++) {
        for (let dz = -2; dz <= 14; dz++) {
          if (m.surface[(btz + dz) * GRID + btx + dx] === S_PLATE) plate++;
        }
      }
      expect(plate, `team ${team} flight line must read as poured deck`).toBeGreaterThan(25);
    }
  });

  it('the apron is paint, not architecture — and the compound stays untouched', () => {
    // the first cut re-cleared pads AFTER the base stamped, which punched
    // lopsided holes in compound walls (the mirror-fair suite caught it).
    // The field lives outside the building envelope now; nothing to carve.
    const m = generateMap(42, 'tdm', 'savanna');
    const jet = m.vehiclePads.find((p) => p.kind === 'strikejet' && p.team === 0)!;
    const bomber = m.vehiclePads.find((p) => p.kind === 'bomber' && p.team === 0)!;
    // the line between the two ends of the flight line is walkable
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const x = jet.pos.x + ((bomber.pos.x - jet.pos.x) * i) / steps;
      const z = jet.pos.z + ((bomber.pos.z - jet.pos.z) * i) / steps;
      expect(isBlocked(m.grid, x, z), `flight line blocked at step ${i}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// PLANES START GROUNDED — AND STAY GROUNDED (found by the airfield bench: at
// t=0 every jet sat on its pad; one simulated second later all three had
// taxied 9u east). The V2 stall floor applied with NOBODY ABOARD, so every
// uncrewed jet in the game crept at stall speed forever.
// ---------------------------------------------------------------------------
import { World } from '../src/sim/world';

describe('parked aircraft hold still', () => {
  it('an uncrewed jet does not taxi itself off its pad', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const before = [...w.vehicles.values()]
      .filter((v) => (AIRCRAFT as readonly string[]).includes(v.kind))
      .map((v) => ({ id: v.id, x: v.pos.x, z: v.pos.z }));
    expect(before.length).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) w.step(1 / 60, new Map()); // five quiet seconds
    for (const b of before) {
      const v = w.vehicles.get(b.id)!;
      const drift = Math.hypot(v.pos.x - b.x, v.pos.z - b.z);
      expect(drift, `${v.kind} crept ${drift.toFixed(1)}u with nobody aboard`).toBeLessThan(0.1);
    }
  });

  it('a pilot who has finished the spool still rides the stall floor', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    for (const v of w.vehicles.values()) if (v.kind === 'aatrack') v.alive = false;
    const p = w.addSoldier('P', 'infantry', 0, 'human');
    const jet = [...w.vehicles.values()].find((v) => v.kind === 'strikejet' && v.team === 0)!;
    jet.seats[0] = p.id; p.vehicleId = jet.id; p.seat = 0;
    p.enteredVehicleAt = w.time - 10; jet.spoolUntil = 0;
    const c = { moveX: 0, moveZ: -1, aimYaw: 0, fire: false, altFire: false, jump: false,
      use: false, ability: false, reload: false, grenade: false, weaponSlot: -1 };
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map([[p.id, c]]));    // wind up…
    const cIdle = { ...c, moveZ: 0 };
    for (let i = 0; i < 180; i++) w.step(1 / 60, new Map([[p.id, cIdle]])); // …hands off
    const speed = Math.hypot(jet.vel.x, jet.vel.z);
    expect(speed, 'a FLOWN jet must still refuse to stop').toBeGreaterThan(10);
  });
});
