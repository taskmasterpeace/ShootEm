// ---------------------------------------------------------------------------
// §BEAMS row 188 — THE HELD STREAM (LSW only; soldiers never carry one).
// While the trigger is held the beam CONNECTS: a per-tick chest-height ray
// pours dps·dt into the first wall or body on the aim line. No projectiles,
// no clip. The governor is HEAT — `sustain` seconds of pour jams the emitter
// for `jam` seconds, and heat bleeds off whenever the pour stops. Crimson's
// Haemal Siphon is the archetype: dps 100 = the old 10 dmg × 10 rof
// (DPS-neutral conversion — the feel changed, the balance sheet didn't).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { T_OPEN, T_WALL, TILE, WORLD as WORLD_SIZE, GRID } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD_SIZE / 2) / TILE) * GRID + Math.floor((x + WORLD_SIZE / 2) / TILE);

/** a Crimson at the origin facing +x down a CARVED lane, with an inert human
 *  witness (the bot-brain law: bots walk off their marks) standing at range. */
function staged(witnessAt = 12) {
  const w = new World({ seed: 7, mode: 'tdm', matchMinutes: 10 });
  const god = w.addSoldier('Pour', 'infantry', 0, 'human');
  god.pos = { x: 0, y: 0, z: 0 }; god.yaw = 0; god.protectedUntil = 0;
  god.ascendant = 'crimson';
  god.weapons = ['lsw_crimson']; god.clip = [Infinity]; god.reserve = [Infinity]; god.weaponIdx = 0;
  const vic = w.addSoldier('Wit', 'infantry', 1, 'human');
  vic.pos = { x: witnessAt, y: 0, z: 0 }; vic.protectedUntil = 0; vic.hp = 100;
  // carve the lane so terrain never eats the ray (memory law: carve arenas)
  for (let x = -3; x <= witnessAt + 6; x += 1) {
    w.map.grid[tileIdx(x, 0)] = T_OPEN;
    w.map.grid[tileIdx(x, -3)] = T_OPEN; w.map.grid[tileIdx(x, 3)] = T_OPEN;
  }
  w.step(1 / 60, new Map());
  return { w, god, vic };
}

describe('§BEAMS — the held stream', () => {
  it('the def is LSW-only and DPS-neutral (100 = the old 10×10)', () => {
    const def = WEAPONS.lsw_crimson;
    expect(def.held).toBeTruthy();
    expect(def.held!.dps).toBe(def.damage * def.rof);
    // no SOLDIER weapon carries a held stream — the law of row 188
    for (const [id, d] of Object.entries(WEAPONS)) {
      if (d.held) expect(id.startsWith('lsw_'), `${id} must be an LSW arm`).toBe(true);
    }
  });

  it('holding the trigger POURS ~dps into the first body on the line', () => {
    const { w, god, vic } = staged();
    const hp0 = vic.hp;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: true })]]));
    const poured = hp0 - vic.hp;
    expect(poured, 'one second of pour ≈ 100 dps (armor may soak a little)').toBeGreaterThan(55);
    expect(god.clip[0], 'no clip spent — a stream, not shots').toBe(Infinity);
    expect((god.beamingUntil ?? 0) > w.time - 0.2, 'the renderer window is stamped').toBe(true);
  });

  it('a wall between them starves the pour', () => {
    const { w, god, vic } = staged();
    w.map.grid[tileIdx(6, 0)] = T_WALL; // brick mid-lane
    const hp0 = vic.hp;
    for (let i = 0; i < 40; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: true })]]));
    expect(vic.hp, 'the wall drank it all').toBe(hp0);
  });

  it('HEAT governs: sustain jams the emitter, release cools it back', () => {
    const { w, god, vic } = staged();
    // pour past the 4s sustain — the emitter jams (heat clamps at 1 for one
    // tick, then bleeds: the jam LOCKOUT is the durable state, not the number)
    for (let i = 0; i < 60 * 4 + 10; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: true })]]));
    expect(god.beamHeat ?? 0, 'still glowing near full').toBeGreaterThan(0.85);
    expect((god.beamJamUntil ?? 0) > w.time, 'jammed').toBe(true);
    const hpAtJam = vic.hp;
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: true })]]));
    expect(vic.hp, 'a jammed emitter pours nothing').toBe(hpAtJam);
    // stop firing: heat bleeds off (a real client sends cmds every tick —
    // the released trigger is a cmd with fire:false, not an absent cmd)
    for (let i = 0; i < 60 * 4; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: false })]]));
    expect(god.beamHeat).toBe(0);
  });

  it('releasing the trigger stops the pour at once', () => {
    const { w, god, vic } = staged();
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: true })]]));
    const hpMid = vic.hp;
    expect(hpMid).toBeLessThan(100);
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map([[god.id, cmd({ fire: false })]]));
    expect(vic.hp, 'no trigger, no stream').toBe(hpMid);
  });
});
