// ---------------------------------------------------------------------------
// Locked-decision mechanics: 55B spawn protection (until first hostile act,
// 5s cap, enemy-aware spawn pick) and 49A bot parity (bots fire MANPADS,
// bot breachers run deep, ghost bots fly the recon net).
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

const run = (w: World, cmds: Map<number, PlayerCmd>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) w.step(1 / 60, cmds);
};

describe('spawn protection (55B)', () => {
  it('a fresh spawn shrugs off bullets and blasts — shove included', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    run(w, new Map(), 0.1); // protection arms on MID-MATCH spawns
    w.spawn(s);
    w.damageSoldier(s, 60, -1, 'rifle');
    expect(s.hp).toBe(s.maxHp);
    w.explode({ x: s.pos.x + 1.5, y: 0, z: s.pos.z }, WEAPONS.gl, -1, 1);
    expect(s.hp).toBe(s.maxHp);
    expect(s.pushX).toBe(0); // protected soldiers aren't ragdolled either
  });

  it('protection expires after ~5 seconds', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    run(w, new Map(), 0.1);
    w.spawn(s);
    run(w, new Map(), 5.2);
    w.damageSoldier(s, 30, -1, 'rifle');
    expect(s.hp).toBeLessThan(s.maxHp);
  });

  it('firing your weapon ends it instantly', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    run(w, new Map(), 0.1);
    w.spawn(s);
    w.step(1 / 60, new Map([[s.id, cmd({ fire: true })]]));
    w.damageSoldier(s, 30, -1, 'rifle');
    expect(s.hp).toBeLessThan(s.maxHp);
  });

  it('throwing a grenade ends it too', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    run(w, new Map(), 0.1);
    w.spawn(s);
    w.step(1 / 60, new Map([[s.id, cmd({ grenade: true })]]));
    expect(s.protectedUntil).toBe(0);
  });

  it('zombies never get it — a horde you cannot shoot is no horde', () => {
    const w = new World({ seed: 5, mode: 'survival' });
    const z = w.addZombie('zombie', { x: 0, y: 0, z: 0 });
    expect(w.time < z.protectedUntil).toBe(false);
  });

  it('the spawn ring picks the point farthest from the enemy push', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const ring = w.map.spawns[0];
    // camp one specific ring point with a squad of enemies
    const camped = ring[0];
    for (let i = 0; i < 3; i++) {
      const e = w.addSoldier(`E${i}`, 'infantry', 1, 'human');
      e.pos = { x: camped.x + i * 0.5, y: 0, z: camped.z };
    }
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    run(w, new Map(), 0.1);
    w.spawn(s);
    const dCamped = Math.hypot(s.pos.x - camped.x, s.pos.z - camped.z);
    expect(dCamped).toBeGreaterThan(4); // never dropped into the campers' lap
  });
});

describe('bot parity (49A)', () => {
  it('a heavy bot with tubes brings down range on an airborne gunship', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const bot = w.addSoldier('AA-Bot', 'heavy', 0, 'bot', { equipment: ['manpads'] });
    bot.pos = { ...w.map.hillPos };
    expect(bot.manpads).toBe(2);
    // stage an airborne enemy flyer nearby
    const fly = [...w.vehicles.values()].find((v) => v.kind === 'flyer' && v.team === 1)!;
    const pilot = w.addSoldier('P', 'infantry', 1, 'human');
    fly.seats[0] = pilot.id; pilot.vehicleId = fly.id; pilot.seat = 0;
    fly.pos = { x: bot.pos.x + 30, y: 6, z: bot.pos.z };
    let fired = false;
    for (let i = 0; i < 60 * 6 && !fired; i++) {
      fly.pos = { x: bot.pos.x + 30, y: 6, z: bot.pos.z }; // hold it on station
      w.step(1 / 60, new Map());
      fired = [...w.projectiles.values()].some((p) => p.weapon === 'sam_missile');
    }
    expect(fired).toBe(true);
  });

  it('a bot breacher driver dives on the long quiet leg', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const tun = [...w.vehicles.values()].find((v) => v.kind === 'tunneler' && v.team === 0)!;
    const bot = w.addSoldier('Mole-Bot', 'engineer', 0, 'bot');
    bot.pos = { ...tun.pos };
    // seat the bot directly (the grab heuristic is probabilistic)
    tun.seats[0] = bot.id; bot.vehicleId = tun.id; bot.seat = 0;
    let dived = false;
    for (let i = 0; i < 60 * 8 && !dived; i++) {
      w.step(1 / 60, new Map());
      dived = tun.burrowed === true;
    }
    expect(dived).toBe(true);
  });

  it('a ghost bot deploys its recon drone when a fight is on', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    const bot = w.addSoldier('Spooky', 'ghost', 0, 'bot');
    bot.pos = { ...w.map.hillPos };
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: bot.pos.x + 12, y: 0, z: bot.pos.z };
    let drone = false;
    for (let i = 0; i < 60 * 10 && !drone; i++) {
      foe.pos = { x: bot.pos.x + 12, y: 0, z: bot.pos.z }; // keep the fight on
      foe.hp = foe.maxHp; foe.alive = true;
      w.step(1 / 60, new Map());
      drone = [...w.gadgets.values()].some((g) => g.type === 'drone' && g.ownerId === bot.id);
    }
    expect(drone).toBe(true);
  });
});
