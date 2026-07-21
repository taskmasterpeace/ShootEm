// ---------------------------------------------------------------------------
// §BEAMS row 189 — BEAM-VS-BEAM CLASH. Where two enemy held streams cross, a
// struggle NODE is born on the wielder axis and WALKS toward the weaker side
// (power = dps + surge; surge = sprint held, stamina-fed). Reaching an end
// SHEARS through: the loser's emitter is knocked off-axis (jammed) and the
// body staggered. Clashing streams pour into each other — NEITHER damages
// bodies while locked. Stepping out dissolves the clash without penalty.
// Projectiles never clash — only the rare held streams pay this cost.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { T_OPEN, TILE, WORLD as WORLD_SIZE, GRID } from '../src/sim/map';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1, ...over,
});

const tileIdx = (x: number, z: number) =>
  Math.floor((z + WORLD_SIZE / 2) / TILE) * GRID + Math.floor((x + WORLD_SIZE / 2) / TILE);

/** two Siphon wielders whose streams CROSS at the origin-ish: A fires +x from
 *  the west, B fires -z from the north — perpendicular, guaranteed crossing.
 *  A bystander stands past the crossing on A's line. Humans (no brains). */
function crossed() {
  const w = new World({ seed: 11, mode: 'tdm', matchMinutes: 10 });
  const arm = (name: string, team: 0 | 1, x: number, z: number, yaw: number) => {
    const g = w.addSoldier(name, 'infantry', team, 'human');
    g.pos = { x, y: 0, z }; g.yaw = yaw; g.protectedUntil = 0;
    (g as { ascendant?: string }).ascendant = 'crimson';
    g.weapons = ['lsw_crimson']; g.clip = [Infinity]; g.reserve = [Infinity]; g.weaponIdx = 0;
    return g;
  };
  const A = arm('A', 0, -8, 0, 0);              // west, firing +x
  const B = arm('B', 1, 0, -8, Math.PI / 2);    // north, firing +z (toward origin)
  const wit = w.addSoldier('Wit', 'infantry', 1, 'human');
  wit.pos = { x: 8, y: 0, z: 0 }; wit.protectedUntil = 0; wit.hp = 100; // past the crossing on A's line
  for (let x = -12; x <= 12; x += 1) for (let z = -12; z <= 12; z += 3) w.map.grid[tileIdx(x, z)] = T_OPEN;
  w.step(1 / 60, new Map());
  return { w, A, B, wit };
}

/** each wielder's cmd carries HIS aim — applyCmd re-derives yaw from aimYaw
 *  every tick, so a default aimYaw 0 would silently parallel the streams. */
const both = (a: Partial<PlayerCmd>, b: Partial<PlayerCmd>, A: { id: number }, B: { id: number }) =>
  new Map([[A.id, cmd({ ...a, aimYaw: 0 })], [B.id, cmd({ ...b, aimYaw: Math.PI / 2 })]]);

describe('§BEAMS — beam-vs-beam clash', () => {
  it('crossed streams birth the node, and NEITHER damages bodies while locked', () => {
    const { w, A, B, wit } = crossed();
    for (let i = 0; i < 20; i++) w.step(1 / 60, both({ fire: true }, { fire: true }, A, B));
    expect(w.beamClashes.size, 'the clash formed').toBe(1);
    expect(wit.hp, 'the bystander past the crossing is untouched — the node eats the pour').toBe(100);
    const c = [...w.beamClashes.values()][0];
    expect(c.t).toBeGreaterThan(0.3);
    expect(c.t).toBeLessThan(0.7);
  });

  it('equal power is a STALEMATE — the node holds the middle', () => {
    const { w, A, B } = crossed();
    for (let i = 0; i < 90; i++) w.step(1 / 60, both({ fire: true }, { fire: true }, A, B));
    const c = [...w.beamClashes.values()][0];
    expect(c, 'still locked').toBeTruthy();
    expect(Math.abs(c.t - 0.5), 'no drift without a power gap').toBeLessThan(0.02);
  });

  it('SURGE shoves the node — sustained surge SHEARS the loser off-axis', () => {
    const { w, A, B } = crossed();
    const e0 = A.energy;
    const events: string[] = [];
    for (let i = 0; i < 60 * 8 && B.beamJamUntil === undefined; i++) {
      w.step(1 / 60, both({ fire: true, sprint: true }, { fire: true }, A, B));
      for (const ev of w.takeEvents()) if (ev.type.startsWith('beam_clash')) events.push(ev.type + ':' + ev.soldierId);
    }
    expect(A.energy, 'the surge burned stamina').toBeLessThan(e0);
    expect(B.beamJamUntil ?? 0, 'B was SHEARED — emitter knocked out').toBeGreaterThan(w.time);
    expect(events.some((e) => e.startsWith('beam_clash:')), 'the birth event fired').toBe(true);
    expect(events.some((e) => e === `beam_clash_break:${B.id}`), 'the shear named the loser').toBe(true);
    expect(w.beamClashes.size, 'the clash resolved').toBe(0);
  });

  it('releasing the trigger dissolves the clash without penalty', () => {
    const { w, A, B } = crossed();
    for (let i = 0; i < 20; i++) w.step(1 / 60, both({ fire: true }, { fire: true }, A, B));
    expect(w.beamClashes.size).toBe(1);
    for (let i = 0; i < 10; i++) w.step(1 / 60, both({ fire: false }, { fire: true }, A, B));
    expect(w.beamClashes.size, 'the node dies with the stream').toBe(0);
    expect(A.beamJamUntil ?? 0, 'stepping out costs nothing').toBeLessThanOrEqual(w.time);
  });

  it('same-team streams never clash', () => {
    const { w, A, B } = crossed();
    (B as { team: number }).team = 0; // now allies
    for (let i = 0; i < 20; i++) w.step(1 / 60, both({ fire: true }, { fire: true }, A, B));
    expect(w.beamClashes.size).toBe(0);
  });
});
