import { describe, expect, it } from 'vitest';
import { generateScienceMission } from '../src/sim/science';
import { generateScienceMap } from '../src/sim/science-map';
import { CITY_MAP_PROFILES } from '../src/sim/city-profile';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import {
  claimIndoorPortal,
  createIndoorTacticalState,
  indoorCivilianWaypoint,
  indoorGuardWaypoint,
  noteIndoorAlert,
  noteIndoorProgress,
  recordIndoorScent,
  strongestDogScent,
} from '../src/sim/indoor-ai';

const fixture = () => {
  const city = CITY_MAP_PROFILES.find((entry) => entry.name === 'Belgrade')!;
  const spec = generateScienceMission(7331, {
    site: 'clone-vault', cityId: city.id, squadSize: 3, complication: null,
  });
  return createIndoorTacticalState(generateScienceMap(spec).map)!;
};

describe('indoor tactical memory', () => {
  it('copies a reported position instead of retaining a live target reference', () => {
    const state = fixture();
    const sighting = { ...state.roomCenters[0] };
    noteIndoorAlert(state, sighting, 0, 1);
    sighting.x += 50;
    sighting.z += 50;

    expect(state.alert?.pos).not.toEqual(sighting);
    expect(state.alert?.pos.x).toBeCloseTo(state.roomCenters[0].x);
    expect(state.alert?.pos.z).toBeCloseTo(state.roomCenters[0].z);
  });

  it('builds an immutable room graph with stairs connecting every storey', () => {
    const state = fixture();
    expect(state.navigation.rooms.length).toBeGreaterThan(3);
    expect(state.navigation.portals.filter((portal) => portal.kind === 'stairs')).toHaveLength(2);
    expect(Object.isFrozen(state.navigation.rooms)).toBe(true);
    expect(Object.isFrozen(state.navigation.portals)).toBe(true);
  });

  it('moves a guard from hearing to investigation, room search, and return to post', () => {
    const state = fixture();
    const post = state.roomCenters[0];
    const disturbance = state.roomCenters.at(-1)!;
    noteIndoorAlert(state, disturbance, disturbance.y / 4, 1);
    const investigate = indoorGuardWaypoint(state, 10, post, 0, 1.1)!;
    expect(state.memories.get(10)?.intent).toBe('investigate');
    expect(investigate).not.toEqual(post);

    indoorGuardWaypoint(state, 10, investigate, Math.round(investigate.y / 4), 2);
    expect(state.memories.get(10)?.intent).toBe('search');
    const returning = indoorGuardWaypoint(state, 10, investigate, Math.round(investigate.y / 4), 12)!;
    expect(state.memories.get(10)?.intent).toBe('return');
    expect(returning.x).toBeCloseTo(post.x);
    expect(returning.z).toBeCloseTo(post.z);
  });

  it('keeps two guards from crowding the same portal and recovers a blocked route', () => {
    const state = fixture();
    const portals = state.navigation.portals.filter((portal) => portal.kind === 'door');
    expect(portals.length).toBeGreaterThan(1);
    expect(claimIndoorPortal(state, 1, portals.map((portal) => portal.id), 0)).toBe(portals[0].id);
    expect(claimIndoorPortal(state, 2, portals.map((portal) => portal.id), 0)).toBe(portals[1].id);

    const pos = state.roomCenters[0];
    noteIndoorAlert(state, state.roomCenters.at(-1)!, 2, 0);
    indoorGuardWaypoint(state, 1, pos, 0, 0.1);
    noteIndoorProgress(state, 1, pos, 0.2);
    noteIndoorProgress(state, 1, pos, 2.1);
    expect(state.memories.get(1)?.blockedRecoveries).toBe(1);
    expect(state.memories.get(1)?.portalId).toBeUndefined();
  });

  it('routes an alarm upstairs and sends civilians away from the threat', () => {
    const state = fixture();
    const low = state.roomCenters.find((center) => center.y === 0)!;
    const high = [...state.roomCenters].reverse().find((center) => center.y >= 8)!;
    noteIndoorAlert(state, high, 2, 3);
    const response = indoorGuardWaypoint(state, 20, low, 0, 3.1)!;
    expect(response.y).toBeGreaterThanOrEqual(4);
    const escape = indoorCivilianWaypoint(state, 30, low, 0, 3.1)!;
    const threatDistance = Math.hypot(high.x - escape.x, high.z - escape.z) + Math.abs(high.y - escape.y);
    expect(threatDistance).toBeGreaterThan(6);
  });
});

describe('indoor dog threat', () => {
  it('retains at most 24 scent nodes for eight seconds and ignores visual cloak', () => {
    const state = fixture();
    for (let index = 0; index < 30; index++) {
      recordIndoorScent(state, 99, { ...state.roomCenters[index % state.roomCenters.length], x: state.roomCenters[index % state.roomCenters.length].x + index * 0.05 }, index * 0.3);
    }
    const trail = state.scents.get(99)!;
    expect(trail.length).toBeLessThanOrEqual(24);
    expect(trail.every((node) => 8.7 - node.at <= 8)).toBe(true);
    const handler = trail.at(-1)!.pos;
    expect(strongestDogScent(state, handler, 0, 8.7)?.targetId).toBe(99);
  });

  it('keeps a dog inside handler pull and rejects ladder-only scent transitions', () => {
    const state = fixture();
    const handler = state.roomCenters[0];
    const upstairs = state.roomCenters.find((center) => center.y >= 4)!;
    recordIndoorScent(state, 5, upstairs, 1);
    expect(strongestDogScent(state, handler, 0, 1.1)).not.toBeNull();
    recordIndoorScent(state, 6, { x: handler.x + 50, y: 0, z: handler.z + 50 }, 1.2);
    expect(strongestDogScent(state, handler, 0, 1.3)?.targetId).toBe(5);
  });

  it('makes the bite pull dangerous without increasing bite damage', () => {
    const world = new World({ seed: 71, mode: 'tdm' });
    const handler = world.addSoldier('Handler', 'infantry', 1, 'human');
    const dog = world.addDog(handler);
    const victim = world.addSoldier('Operator', 'infantry', 0, 'human');
    dog.pos = { x: 0, y: 0, z: 0 };
    victim.pos = { x: 1.5, y: 0, z: 0 };
    dog.meleeWeapon = 'dog_bite';
    dog.meleeStrikeAt = world.time;
    dog.meleeYaw = 0;
    world.soldierIndex.rebuild(world.soldiers);
    world.resolveMeleeStrike(dog);
    expect(victim.hp).toBe(victim.maxHp - WEAPONS.dog_bite.damage);
    expect(victim.pushX).toBeLessThan(0);
  });
});
