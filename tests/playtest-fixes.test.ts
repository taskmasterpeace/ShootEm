// ---------------------------------------------------------------------------
// ROBERT'S PLAYTEST LIST, PINNED. Every law here came from him playing the
// game and saying "this is wrong" — which is the only bug report that counts.
// These are the sim-side halves; the HUD halves (hull bar, signature meter,
// hover-to-read vitals) live in the client and are verified on screen.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});
const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });

describe("Robert's playtest list", () => {
  it('YOU CANNOT OUTRUN YOUR OWN FLAME — the stream carries the thrower', () => {
    const w = quiet();
    const s = w.addSoldier('F', 'heavy', 0, 'human');
    s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; s.yaw = 0;
    s.weapons = ['flamer']; s.weaponIdx = 0; s.clip = [999]; s.reserve = [999];
    const sprintAndBurn = new Map([[s.id, cmd({ fire: true, moveX: 1 })]]);
    for (let i = 0; i < 10; i++) w.step(1 / 60, sprintAndBurn);
    const flames = [...w.projectiles.values()].filter((p) => p.weapon === 'flamer');
    expect(flames.length, 'nothing left the nozzle').toBeGreaterThan(0);
    const slowest = Math.min(...flames.map((p) => Math.hypot(p.vel.x, p.vel.z)));
    expect(slowest, 'the man caught his own fire').toBeGreaterThan(Math.hypot(s.vel.x, s.vel.z));
  });

  it('THE HULL KNOB BITES — vehicles finally answer to a global multiplier', () => {
    const drive = (mul: number) => {
      const w = quiet();
      w.vehicleSpeedMul = mul;
      const v = [...w.vehicles.values()].find((x) => x.kind === 'buggy')!;
      const s = w.addSoldier('D', 'infantry', v.team as 0 | 1, 'human');
      s.pos = { ...v.pos };
      w.step(1 / 60, new Map([[s.id, cmd({ use: true })]]));
      const x0 = v.pos.x, z0 = v.pos.z;
      for (let i = 0; i < 120; i++) w.step(1 / 60, new Map([[s.id, cmd({ moveZ: -1 })]]));
      return Math.hypot(v.pos.x - x0, v.pos.z - z0);
    };
    expect(drive(0.5), 'the hull ignored the knob').toBeLessThan(drive(1) * 0.75);
  });

  it('A GOD CARRIES ITS SIGNATURE ARM AND NOTHING ELSE — no frags, no jeep', () => {
    const w = quiet();
    const g = w.addLsw('firebrand', LSWS.firebrand.faction, { x: 0, y: 0, z: 0 })!;
    const pouch = g.grenades;
    w.applyCmd(g, cmd({ grenade: true }), 1 / 60);
    expect(g.grenades, 'a god reached for the recruit\'s pouch').toBe(pouch);
    expect([...w.projectiles.values()].some((p) => p.ownerId === g.id && p.weapon === 'gl'))
      .toBe(false);
    // …and the count is deliberately UNTOUCHED: Firebrand's bot brain uses
    // s.grenades as its cash-the-board signal, so emptying it would mute the bot
    expect(pouch, 'the signal channel was drained').toBeGreaterThan(0);

    const v = [...w.vehicles.values()].find((x) => x.team === g.team)!;
    g.pos = { ...v.pos };
    w.tryEnterVehicle(g);
    expect(g.vehicleId, 'a 1600hp strongpoint took the wheel').toBe(-1);
  });

  it('FIREBRAND — a shorter road, and cashing it leaves the ground burning', () => {
    const w = quiet();
    const f = w.addLsw('firebrand', LSWS.firebrand.faction, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60 * 3; i++) w.step(1 / 60, new Map([[f.id, cmd({ moveZ: -1 })]]));
    const patches = () => [...w.gadgets.values()].filter((g) => g.type === 'fire_field' && g.ownerId === f.id);
    const painted = patches();
    expect(painted.length, 'he still paints a road').toBeGreaterThan(0);
    expect(painted.length, 'the ribbon is long again — 9s of patches was ~80u').toBeLessThanOrEqual(11);

    const youngest = Math.max(...painted.map((g) => g.bornAt));
    f.nextLswActiveAt = 0;
    w.applyCmd(f, cmd({ ability: true }), 1 / 60);
    const relit = patches().filter((g) => g.bornAt > youngest);
    expect(relit.length, 'the eruption left cold ground behind it').toBeGreaterThan(0);
  });

  it('THE ICE NAMES ITS OWNER — a death in the block is never credited to nobody', () => {
    const w = quiet();
    const team = LSWS.frostbite.faction;
    const fb = w.addLsw('frostbite', team, { x: 0, y: 0, z: 0 })!;
    const v = w.addSoldier('V', 'infantry', (team === 0 ? 1 : 0) as 0 | 1, 'human');
    v.pos = { x: 6, y: 0, z: 0 }; v.alive = true; v.protectedUntil = 0; v.hp = 8; v.yaw = 0;
    fb.yaw = 0; fb.nextLswActiveAt = 0;
    w.applyCmd(fb, cmd({ ability: true }), 1 / 60);
    expect(v.encasedUntil, 'the ice never formed').toBeDefined();
    expect(v.encasedBy, 'the ice forgot whose hand it was').toBe(fb.id);
    // regen fights the 2.5/s drain, so bleeding out inside the block is slow
    for (let i = 0; i < 60 * 40 && v.alive; i++) w.step(1 / 60, new Map());
    expect(v.alive, 'he never bled out — the drain is broken').toBe(false);
    expect(v.lastKillerId, 'the freezer got no credit for the kill').toBe(fb.id);
  });
});
