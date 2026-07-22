import { describe, expect, it } from 'vitest';
import {
  buildingAtOrderPoint,
  hostilesInK9Building,
  issueK9Command,
  k9AimPoint,
  setK9Sic,
  setK9Stay,
} from '../src/sim/k9-orders';
import { applySnapshot, createPuppetWorld, takeSnapshot } from '../src/sim/snapshot';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

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

  it('accepts commands only from the owner and preserves an order when no building is aimed', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const stranger = world.addSoldier('Stranger', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    setK9Stay(dog);
    const before = { order: dog.k9Order, anchor: dog.k9StayAnchor };

    expect(issueK9Command(world, stranger, 'stay', stranger.pos)).toEqual({ ok: false, reason: 'no-dog' });
    expect(issueK9Command(world, handler, 'sic', { x: 999, y: 0, z: 999 }))
      .toEqual({ ok: false, reason: 'no-building' });
    expect({ order: dog.k9Order, anchor: dog.k9StayAnchor }).toEqual(before);
  });

  it('stores a validated building order without accepting a client target id', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    const house = world.map.houses[0];

    expect(issueK9Command(world, handler, 'sic', house.center)).toMatchObject({ ok: true });
    expect(dog.k9Order).toBe('sic');
    expect(dog.k9BuildingId).toBe(0);
    expect(dog.k9OrderPos).toEqual(house.center);
    expect(dog.k9TargetId).toBeUndefined();
  });

  it('round-trips authoritative K9 order state through a snapshot', () => {
    const world = new World({ seed: 42, mode: 'tdm' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    dog.k9Order = 'sic';
    dog.k9BuildingId = 3;
    dog.k9OrderPos = { x: 8, y: 0, z: 12 };
    dog.k9StayAnchor = { x: 1, y: 0, z: 2 };
    dog.k9Door = 20_050;
    dog.k9SearchIndex = 4;
    dog.k9ClearSince = 7.5;

    const puppet = createPuppetWorld(42, 'tdm', undefined);
    applySnapshot(puppet, takeSnapshot(world, []));
    expect(puppet.soldiers.get(dog.id)).toMatchObject({
      k9Order: 'sic',
      k9BuildingId: 3,
      k9OrderPos: { x: 8, y: 0, z: 12 },
      k9StayAnchor: { x: 1, y: 0, z: 2 },
      k9Door: 20_050,
      k9SearchIndex: 4,
      k9ClearSince: 7.5,
    });
  });

  it('applies a one-shot K9 command from authoritative aim data', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    const house = world.map.houses[0];
    handler.pos = { x: house.center.x - 20, y: 0, z: house.center.z };

    world.applyCmd(handler, cmd({ k9: 'sic', aimYaw: 0, aimDist: 20 }), 1 / 60);

    expect(dog.k9Order).toBe('sic');
    expect(dog.k9BuildingId).toBe(0);
    expect(world.takeEvents().some((event) => event.type === 'announce' && event.text?.includes('CLEARING'))).toBe(true);
  });
});
