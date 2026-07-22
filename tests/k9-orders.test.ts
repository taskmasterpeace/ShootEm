import { describe, expect, it } from 'vitest';
import {
  buildingAtOrderPoint,
  hostilesInK9Building,
  k9AimPoint,
  setK9Sic,
  setK9Stay,
} from '../src/sim/k9-orders';
import { World } from '../src/sim/world';

describe('K9 orders', () => {
  it('selects the aimed house or a house no farther than eight units away', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const house = world.map.houses[0];
    expect(house).toBeDefined();
    expect(buildingAtOrderPoint(world.map, house.center)).toBe(0);
    expect(buildingAtOrderPoint(world.map, {
      x: house.center.x + 6,
      y: 0,
      z: house.center.z + house.th * 2 + 2,
    })).toBe(0);
    expect(buildingAtOrderPoint(world.map, { x: 999, y: 0, z: 999 })).toBe(-1);
  });

  it('scopes zombie-like detection to living hostile humans and bots inside the ordered house', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const house = world.map.houses[0];
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    setK9Sic(dog, 0, house.center);

    const hidden = world.addSoldier('Hidden', 'infiltrator', 1, 'bot');
    hidden.pos = { ...house.center };
    hidden.cloaked = true;
    const outside = world.addSoldier('Outside', 'infantry', 1, 'bot');
    outside.pos = { x: house.center.x + 40, y: 0, z: house.center.z + 40 };
    const friendly = world.addSoldier('Friendly', 'infantry', 0, 'bot');
    friendly.pos = { ...house.center };

    expect(hostilesInK9Building(world.map, dog, world.soldiers.values()).map((soldier) => soldier.id))
      .toEqual([hidden.id]);
  });

  it('toggles stay to heel while a new sic order replaces stay', () => {
    const world = new World({ seed: 42, mode: 'tdm' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    dog.pos = { x: 4, y: 0, z: 9 };

    setK9Stay(dog);
    expect(dog.k9Order).toBe('stay');
    expect(dog.k9StayAnchor).toEqual(dog.pos);
    setK9Stay(dog);
    expect(dog.k9Order).toBe('heel');
    expect(dog.k9StayAnchor).toBeUndefined();

    setK9Stay(dog);
    setK9Sic(dog, 3, { x: 12, y: 0, z: -8 });
    expect(dog.k9Order).toBe('sic');
    expect(dog.k9BuildingId).toBe(3);
    expect(dog.k9StayAnchor).toBeUndefined();
  });

  it('reconstructs the command point from authoritative handler aim and clamps bad distance', () => {
    expect(k9AimPoint({ x: 10, y: 0, z: 20 }, Math.PI / 2, 12)).toEqual({ x: 10, y: 0, z: 32 });
    expect(k9AimPoint({ x: 10, y: 0, z: 20 }, 0, Infinity)).toEqual({ x: 10, y: 0, z: 20 });
    expect(k9AimPoint({ x: 10, y: 0, z: 20 }, 0, 500)).toEqual({ x: 90, y: 0, z: 20 });
  });
});
