// ---------------------------------------------------------------------------
// THE FLASHLIGHT (§10 / STATUS "interior flashlight — vision cone as a tool;
// wakes dormant sprinters"). T toggles a torch: the CONE reaches TORCH_MULT
// further (the ring — your back sensor — is untouched), and the price is
// paid in light discipline: a dormant sprinter notices a lit torch at twice
// its sight radius. The darkness beam stretches by the same TORCH_MULT —
// one law, two surfaces.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { TORCH_MULT, perceivesNow } from '../src/sim/perception';
import { GRID } from '../src/sim/map';
import type { PlayerCmd, Soldier } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

describe('§10 — the flashlight', () => {
  it('T toggles the torch on and off', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    s.alive = true;
    w.step(1 / 60, new Map([[s.id, cmd({ torch: true })]]));
    expect(s.torchOn).toBe(true);
    w.step(1 / 60, new Map([[s.id, cmd({ torch: true })]]));
    expect(s.torchOn).toBe(false);
  });

  it('a lit torch buys the CONE extra reach — the beam sees past the bare eye', () => {
    const empty = new Uint8Array(GRID * GRID); // open field — LOS never blocks
    const eye = {
      id: 1, pos: { x: 10, y: 0, z: 10 }, yaw: 0, equipment: [], floor: 0,
    } as unknown as Soldier;
    const range = 40;
    const target = {
      id: 2, pos: { x: 10 + range * 1.2, y: 0, z: 10 }, alive: true, cloaked: false,
      carryingFlag: -1, equipment: [], floor: 0,
    } as unknown as Soldier; // 20% past the bare budget, dead ahead
    const none = new Set<number>();
    expect(perceivesNow(empty, [eye], none, target, range), 'bare eye: too far').toBe(false);
    (eye as { torchOn?: boolean }).torchOn = true;
    expect(TORCH_MULT).toBeGreaterThan(1.2);
    expect(perceivesNow(empty, [eye], none, target, range), 'the beam reaches').toBe(true);
  });

  it('light discipline: a dormant sprinter notices a lit torch at DOUBLE sight radius', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    w.outbreakEnabled = true;
    const a = w.addSoldier('A', 'infantry', 0, 'human');
    const far = { x: 40, y: 0, z: 40 };
    const sprinter = w.addZombie('sprinter', far);
    // 15u: outside bare SIGHT (12), inside torch sight (24) — quiet feet
    a.pos = { x: far.x + 15, y: 0, z: far.z };
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[a.id, cmd()]]));
    expect(sprinter.dormant, 'dark and quiet: still asleep').toBe(true);
    // click the torch on — the beacon carries
    w.step(1 / 60, new Map([[a.id, cmd({ torch: true })]]));
    let woke = false;
    for (let i = 0; i < 30 && !woke; i++) {
      w.step(1 / 60, new Map([[a.id, cmd()]]));
      for (const e of w.takeEvents()) if (e.type === 'sprinter_wake' && e.soldierId === sprinter.id) woke = true;
    }
    expect(woke, 'the light gave them away').toBe(true);
    expect(sprinter.dormant).toBe(false);
  });
});
