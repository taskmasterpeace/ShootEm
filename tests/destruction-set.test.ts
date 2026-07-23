// ───────────────────────────────────────────────────────────────────────────
// THE RACING DESTRUCTION SET
//
// Robert: *"what about the oil slick and other things like mines, and such —
// think racing destruction set."*
//
// Five droppables. The reason it is a SET and not a list is that each item
// takes a different thing away, so the garage door is a real decision:
//
//   MINES  your life · OIL your steering · SPIKES your pace
//   SMOKE  your eyes · DRUM your paint
//
// The law this file defends: SPIKES AND OIL MUST NEVER CONVERGE. Oil is a
// traction lie and leaves your speed alone; spikes are a speed tax and leave
// your grip alone. The moment one starts doing the other's job, carrying both
// stops being a choice and the set collapses back into a list.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import {
  RACE_DROPS, RACE_DROP_ORDER, World, armedDrop, loadedDrops, type RaceDropId,
} from '../src/sim/world';
import { CARGO } from '../src/sim/garage';
import type { PlayerCmd, Team, VehicleKind } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

/** a car with a driver already behind the wheel */
function rig(cargo: RaceDropId[] = [], seed = 5) {
  const w = new World({ seed, mode: 'tdm', botsPerTeam: 0 });
  const v = w.spawnVehicle('buggy' as VehicleKind, 0 as Team, { x: 0, y: 0, z: 0 });
  if (cargo.length) {
    w.setFit(v, { tires: 'allterrain', engine: 'stock', chassis: 'standard', cargo } as never);
  }
  const d = w.addSoldier('D', 'infantry', v.team, 'human');
  d.alive = true; d.pos = { ...v.pos };
  v.seats[0] = d.id; d.vehicleId = v.id; d.seat = 0; d.enteredVehicleAt = -10;
  return { w, v, d };
}

/** how fast this car gets after `n` ticks of full throttle (W is moveZ -1) */
function topSpeed(mutate?: (r: ReturnType<typeof rig>) => void, n = 180): number {
  const r = rig(); mutate?.(r);
  for (let i = 0; i < n; i++) r.w.step(1 / 60, new Map([[r.d.id, cmd({ moveZ: -1 })]]));
  return Math.hypot(r.v.vel.x, r.v.vel.z);
}

describe('the set is a set', () => {
  it('every droppable is a cargo part you chose to carry, with a count', () => {
    for (const d of RACE_DROP_ORDER) {
      expect(CARGO[d], `${d} is buyable`).toBeDefined();
      expect(CARGO[d].count ?? 0, `${d} has a load`).toBeGreaterThan(0);
      expect(CARGO[d].mass, `${d} costs weight`).toBeGreaterThan(0);
    }
  });

  it('and each one is a DIFFERENT answer — no two share a gadget', () => {
    const gadgets = RACE_DROP_ORDER.map((d) => RACE_DROPS[d].gadget);
    expect(new Set(gadgets).size).toBe(gadgets.length);
  });

  it('anything that can kill you arms a beat late — you cannot suicide on your own drop', () => {
    for (const d of ['mines', 'spikes', 'firedrum'] as RaceDropId[]) {
      expect(RACE_DROPS[d].armDelay ?? 0, `${d} arms late`).toBeGreaterThan(0);
    }
  });
});

describe('the bag', () => {
  it('loads only what the garage bolted on', () => {
    const { v } = rig(['mines', 'spikes']);
    expect(loadedDrops(v)).toEqual(['mines', 'spikes']);
    expect(v.oil ?? 0).toBe(0);
  });

  it('X walks the whole bag and wraps', () => {
    const { w, v, d } = rig(['mines', 'oil', 'spikes']);
    const seen: RaceDropId[] = [];
    for (let i = 0; i < 4; i++) {
      w.step(1 / 60, new Map([[d.id, cmd({ nadeCycle: true })]]));
      seen.push(armedDrop(v));
      for (let k = 0; k < 3; k++) w.step(1 / 60, new Map());
    }
    expect(seen).toEqual(['oil', 'spikes', 'mines', 'oil']);
  });

  it('G throws the ARMED one, not the first one', () => {
    const { w, v, d } = rig(['mines', 'oil', 'spikes']);
    v.dropIdx = RACE_DROP_ORDER.indexOf('spikes');
    w.step(1 / 60, new Map([[d.id, cmd({ grenade: true })]]));
    expect(v.spikes).toBe((CARGO.spikes.count ?? 0) - 1);
    expect(v.mines, 'the mines are untouched').toBe(CARGO.mines.count);
    expect([...w.gadgets.values()].some((g) => g.type === 'spike_strip')).toBe(true);
  });

  it('falls to whatever is left when the armed drop runs out', () => {
    const { w, v, d } = rig(['oil', 'mines']);
    v.dropIdx = RACE_DROP_ORDER.indexOf('oil');
    for (let i = 0; i < (CARGO.oil.count ?? 4); i++) {
      w.step(1 / 60, new Map([[d.id, cmd({ grenade: true })]]));
      for (let k = 0; k < 45; k++) w.step(1 / 60, new Map());
    }
    expect(v.oil).toBe(0);
    expect(armedDrop(v), 'the bag re-arms itself').toBe('mines');
  });

  it('an empty bag drops nothing at all', () => {
    const { w, v, d } = rig();
    const before = w.gadgets.size;
    w.step(1 / 60, new Map([[d.id, cmd({ grenade: true })]]));
    expect(loadedDrops(v)).toEqual([]);
    expect(w.gadgets.size).toBe(before);
  });
});

describe('each one takes away its own thing', () => {
  it('SPIKES tax your pace', () => {
    const clean = topSpeed();
    const spiked = topSpeed((r) => { r.v.spikedUntil = r.w.time + 999; });
    expect(clean).toBeGreaterThan(10);
    expect(spiked).toBeLessThan(clean * 0.6);
  });

  it('…and OIL does NOT — the two must never converge', () => {
    const clean = topSpeed();
    const oiled = topSpeed((r) => { r.v.oiledUntil = r.w.time + 999; });
    // oil is a TRACTION lie; it has no business capping top speed
    expect(oiled).toBeGreaterThan(clean * 0.8);
  });

  it('the DRUM eats paint by the second, and follows you out of the flames', () => {
    const { w, v } = rig();
    const hp0 = v.hp;
    v.burningUntil = w.time + 3;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map());
    const mid = v.hp;
    expect(mid, 'it started charging').toBeLessThan(hp0);
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(v.hp, 'and kept charging after you left the patch').toBeLessThan(mid);
  });

  it('spikes wear off — a flat tyre is a setback, not a death sentence', () => {
    const { w, v } = rig();
    v.spikedUntil = w.time + 1;
    for (let i = 0; i < 120; i++) w.step(1 / 60, new Map());
    expect((v.spikedUntil ?? 0) > w.time).toBe(false);
  });

  it('nothing you drop can bite the car that dropped it', () => {
    const { w, v, d } = rig(['spikes']);
    w.step(1 / 60, new Map([[d.id, cmd({ grenade: true })]]));
    // sit on your own strip well past its arming delay
    for (let i = 0; i < 180; i++) w.step(1 / 60, new Map());
    expect((v.spikedUntil ?? 0) > w.time, 'your own strip ignores you').toBe(false);
    expect(v.alive).toBe(true);
  });
});
