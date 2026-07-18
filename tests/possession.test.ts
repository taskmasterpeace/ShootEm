// ---------------------------------------------------------------------------
// MACHINE POSSESSION (§4.4 #4, the shared mechanic → Wraith, Phantom) — a
// TIMED take of an enemy machine. The laws: expiry hands it home; an EMP
// burst evicts INSTANTLY; never humans (the API only takes machines).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import type { Turret } from '../src/sim/types';
import { World } from '../src/sim/world';

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

const sentry = (w: World, id: number, x: number): Turret => {
  const t: Turret = { id, team: 0, pos: { x, y: 0, z: 0 }, yaw: 0, hp: 100, maxHp: 100, nextFireAt: 0, ownerId: -1, alive: true };
  w.turrets.set(id, t);
  return t;
};

describe('machine possession', () => {
  it('a possessed sentry fights for its new master, then comes HOME on expiry', () => {
    const w = quiet();
    const ghost = w.addSoldier('G', 'infantry', 1, 'human');
    const t = sentry(w, 6001, 4);
    w.possessMachine(t, ghost, 0.5);
    expect(t.team, 'the take did not flip the guns').toBe(1);
    expect(t.possessedBy).toBe(ghost.id);
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(t.team, 'the sentry never came home').toBe(0);
    expect(t.possessedBy, 'the ghost lingered past the hold').toBeUndefined();
    expect(t.ownerId, 'ownership must revert with the team').toBe(-1);
  });

  it('an EMP burst evicts the ghost INSTANTLY', () => {
    const w = quiet();
    const ghost = w.addSoldier('G', 'infantry', 1, 'human');
    const t = sentry(w, 6002, 4);
    w.possessMachine(t, ghost, 60); // a long hold — only the EMP can end it early
    expect(t.team).toBe(1);
    w.empBlast({ x: 4, y: 0, z: 0 }, 0, -1); // the original side's EMP
    expect(t.team, 'the EMP did not evict').toBe(0);
    expect(t.possessedBy).toBeUndefined();
  });

  it("Wraith's take is timed now — his sentry returns to its side", () => {
    const w = quiet();
    const wr = w.addLsw('wraith', 1, { x: 0, y: 0, z: 0 })!;
    const t = sentry(w, 6003, 4);
    w.applyCmd(wr, {
      moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
      use: false, ability: true, reload: false, grenade: false, weaponSlot: -1,
    }, 1 / 60);
    expect(t.team, 'Wraith failed the take').toBe(1);
    expect(t.possessedUntil, 'the take must carry a timer now').toBeGreaterThan(w.time);
  });
});
