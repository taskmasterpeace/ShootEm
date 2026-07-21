import { describe, expect, it } from 'vitest';
import { F2_FLOOR, F2_STAIR_E, F2_WELL, GRID, T_LADDER, T_OPEN, T_STAIRS_E, TILE, WORLD } from '../src/sim/map';
import { actorCanUseVerticalTransition, ensureUpperFloor } from '../src/sim/map-layers';
import { World } from '../src/sim/world';

const at = (tile: number) => (tile + 0.5) * TILE - WORLD / 2;

describe('NPC vertical traversal policy', () => {
  it('lets dogs take stairs but never ladders', () => {
    expect(actorCanUseVerticalTransition('dog', 'stairs')).toBe(true);
    expect(actorCanUseVerticalTransition('dog', 'ladder')).toBe(false);
    expect(actorCanUseVerticalTransition('bot', 'stairs')).toBe(true);
    expect(actorCanUseVerticalTransition('bot', 'ladder')).toBe(true);
  });

  it('dogs following an upstairs handler use aligned stairs', () => {
    const world = new World({ seed: 977, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 6;
    const cz = Math.floor(GRID / 2);
    const level2 = ensureUpperFloor(world.map, 1);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -3; dx <= 3; dx++) {
      const i = (cz + dz) * GRID + cx + dx;
      world.map.grid[i] = T_OPEN;
      level2[i] = F2_FLOOR;
    }
    const stair = cz * GRID + cx;
    world.map.grid[stair] = T_STAIRS_E;
    level2[stair] = F2_STAIR_E;
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addSoldier('Scout', 'infantry', 0, 'dog');
    dog.ownerId = handler.id;
    dog.pos = { x: at(cx - 2), y: 0, z: at(cz) };
    handler.floor = 1;
    handler.pos = { x: at(cx + 2), y: 4, z: at(cz) };

    for (let i = 0; i < 120 && dog.floor === 0; i++) world.step(1 / 30, new Map());
    expect(dog.floor).toBe(1);
  });

  it('guards route through stacked stairs to a Level 3 target', () => {
    const world = new World({ seed: 979, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 7;
    const cz = Math.floor(GRID / 2);
    const level2 = ensureUpperFloor(world.map, 1);
    const level3 = ensureUpperFloor(world.map, 2);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -4; dx <= 4; dx++) {
      const i = (cz + dz) * GRID + cx + dx;
      world.map.grid[i] = T_OPEN;
      level2[i] = F2_FLOOR;
      level3[i] = F2_FLOOR;
    }
    const stair = cz * GRID + cx;
    world.map.grid[stair] = T_STAIRS_E;
    level2[stair] = F2_STAIR_E;
    level3[stair] = F2_STAIR_E;
    const guard = world.addSoldier('Guard', 'infantry', 0, 'bot');
    const intruder = world.addSoldier('Intruder', 'infantry', 1, 'human');
    guard.pos = { x: at(cx - 3), y: 0, z: at(cz) };
    intruder.floor = 2;
    intruder.pos = { x: at(cx + 3), y: 8, z: at(cz) };
    intruder.dummy = true;
    intruder.hp = intruder.maxHp = 10_000;

    for (let i = 0; i < 360 && guard.floor < 2; i++) world.step(1 / 30, new Map());
    expect(guard.floor).toBe(2);
  });

  it('a dog does not activate a ladder shaft', () => {
    const world = new World({ seed: 978, mode: 'tdm' });
    const cx = Math.floor(GRID / 2) + 6;
    const cz = Math.floor(GRID / 2);
    const level2 = ensureUpperFloor(world.map, 1);
    const i = cz * GRID + cx;
    world.map.grid[i] = T_LADDER;
    level2[i] = F2_WELL;
    const dog = world.addSoldier('Scout', 'infantry', 0, 'dog');
    dog.pos = { x: at(cx), y: 0, z: at(cz) };
    world.stepSoldierPhysics(dog, 1 / 30);
    expect(dog.floor).toBe(0);
  });
});
