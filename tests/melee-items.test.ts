import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { GRID, T_OPEN } from '../src/sim/map';
import { generateScienceMission } from '../src/sim/science';
import { World } from '../src/sim/world';

const DT = 1 / 60;

function openArena(world: World): void {
  for (let z = 45; z <= 65; z++) for (let x = 45; x <= 70; x++) world.map.grid[z * GRID + x] = T_OPEN;
}

function strike(world: World, weapon: 'unarmed' | 'baseball_bat' | 'katana' | 'fire_axe') {
  const attacker = world.addSoldier('Striker', 'infantry', 0, 'human', { primary: weapon });
  const victim = world.addSoldier('Target', 'infantry', 1, 'human');
  attacker.pos = { x: 0, y: 0, z: 0 };
  attacker.yaw = 0;
  victim.pos = { x: 1.7, y: 0, z: 0 };
  world.startMelee(attacker, WEAPONS[weapon]);
  for (let i = 0; i < 30; i++) world.step(DT, new Map());
  return { attacker, victim };
}

describe('civilian melee vocabulary', () => {
  it('assigns fists, bat, katana, and fire axe distinct impact roles', () => {
    expect(WEAPONS.unarmed.meleeTrait).toBe('force');
    expect(WEAPONS.baseball_bat.meleeTrait).toBe('force');
    expect(WEAPONS.katana.meleeTrait).toBe('blood');
    expect(WEAPONS.fire_axe.meleeTrait).toBe('pierce');
    expect(WEAPONS.baseball_bat.knockback).toBeGreaterThan(WEAPONS.unarmed.knockback);
  });

  it('lets a bat launch harder than fists', () => {
    const fistsWorld = new World({ seed: 11, mode: 'tdm' });
    const batWorld = new World({ seed: 11, mode: 'tdm' });
    const fists = strike(fistsWorld, 'unarmed');
    const bat = strike(batWorld, 'baseball_bat');
    expect(bat.victim.pushX).toBeGreaterThan(fists.victim.pushX);
  });

  it('lets a katana leave a credited bleeding wound after contact', () => {
    const world = new World({ seed: 12, mode: 'tdm' });
    const { victim } = strike(world, 'katana');
    const afterStrike = victim.hp;
    for (let i = 0; i < 90; i++) world.step(DT, new Map());
    expect(victim.hp).toBeLessThan(afterStrike);
    expect(victim.bleedingUntil).toBeGreaterThan(world.time);
    expect(victim.bleedWeapon).toBe('katana');
  });

  it('lets the fire axe chop through issued armor', () => {
    const world = new World({ seed: 13, mode: 'tdm' });
    const attacker = world.addSoldier('Axe', 'infantry', 0, 'human', { primary: 'fire_axe' });
    const victim = world.addSoldier('Plate', 'infantry', 1, 'human', { equipment: ['armor_vest'] });
    attacker.pos = { x: 0, y: 0, z: 0 };
    attacker.yaw = 0;
    victim.pos = { x: 1.7, y: 0, z: 0 };
    const armor = victim.armor;
    world.startMelee(attacker, WEAPONS.fire_axe);
    for (let i = 0; i < 30; i++) world.step(DT, new Map());
    expect(victim.hp).toBeLessThan(victim.maxHp);
    expect(victim.armor).toBe(armor);
  });

  it('gives an unarmed bot a closing-and-striking doctrine', () => {
    const world = new World({ seed: 14, mode: 'tdm' });
    openArena(world);
    const bot = world.addSoldier('Brawler', 'infantry', 0, 'bot', { primary: 'unarmed' });
    const foe = world.addSoldier('Runner', 'infantry', 1, 'human');
    bot.pos = { x: 0, y: 0, z: 0 };
    foe.pos = { x: 8, y: 0, z: 0 };
    foe.hp = foe.maxHp = 500;
    const initialDistance = 8;
    for (let i = 0; i < 240; i++) world.step(DT, new Map());
    expect(Math.hypot(foe.pos.x - bot.pos.x, foe.pos.z - bot.pos.z)).toBeLessThan(initialDistance);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });

  it('mixes one melee guard into ordinary Science security without adding armor', () => {
    const allowed = new Set(['pistol', 'kuchler', 'unarmed', 'baseball_bat', 'katana', 'fire_axe']);
    for (let seed = 9500; seed < 9510; seed++) {
      const spec = generateScienceMission(seed, { site: 'research-annex', squadSize: 5, complication: null });
      const world = new World({ seed, mode: 'science', scienceMission: spec });
      const guards = world.science!.guardIds.map((id) => world.soldiers.get(id)!);
      expect(guards.some((guard) => WEAPONS[guard.weapons[0]].range <= 2.5)).toBe(true);
      expect(guards.every((guard) => allowed.has(guard.weapons[0]))).toBe(true);
      expect(guards.every((guard) => guard.maxArmor === 0)).toBe(true);
    }
  });
});
