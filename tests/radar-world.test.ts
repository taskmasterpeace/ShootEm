import { describe, expect, it } from 'vitest';
import { radarSearchPoint, stepBot } from '../src/sim/bots';
import { T_OPEN, T_WALL } from '../src/sim/map';
import { worldToTile } from '../src/sim/map-geometry';
import { generateTheater } from '../src/sim/theaters';
import type { Soldier, Vehicle, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

function quiet(map?: ReturnType<typeof generateTheater>) {
  const world = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0, ...(map ? { map } : {}) });
  world.soldiers.clear();
  world.vehicles.clear();
  return world;
}

function crew(world: World, kind: VehicleKind, team: 0 | 1, x = 0, z = 0): { pilot: Soldier; vehicle: Vehicle } {
  const pilot = world.addSoldier(`${kind} pilot`, 'infantry', team, 'human');
  pilot.alive = true;
  const vehicle = world.spawnVehicle(kind, team, { x, y: 0, z });
  vehicle.seats[0] = pilot.id;
  pilot.vehicleId = vehicle.id;
  pilot.seat = 0;
  pilot.enteredVehicleAt = -10;
  vehicle.spoolUntil = 0;
  return { pilot, vehicle };
}

describe('world radar sweeps', () => {
  it('holds a swept aircraft at its last-known point until the next pulse', () => {
    const world = quiet();
    const { vehicle: jet } = crew(world, 'interceptor', 0);
    jet.band = 3;
    const { vehicle: foe } = crew(world, 'strikejet', 1, 60, 0);
    foe.band = 3;
    foe.systems.ecm = 0;

    world.stepRadar();
    const key = `v:${foe.id}`;
    const first = structuredClone(world.radarTracksFor(0).get(key));
    expect(first?.pos).toEqual({ x: 60, y: 0, z: 0 });

    foe.pos.z = 20;
    world.time += 0.5;
    world.stepRadar();
    expect(world.radarTracksFor(0).get(key)?.pos).toEqual(first?.pos);

    world.time = 1.25;
    world.stepRadar();
    expect(world.radarTracksFor(0).get(key)?.pos).toEqual({ x: 60, y: 0, z: 20 });
  });

  it('reduces live-ECM range and returns an uncertain offset inside it', () => {
    const world = quiet();
    const { vehicle: jet } = crew(world, 'interceptor', 0);
    jet.band = 3;
    const { vehicle: far } = crew(world, 'transportheli', 1, 100, 0);
    far.band = 2;
    world.stepRadar();
    expect(world.radarTracksFor(0).has(`v:${far.id}`)).toBe(false);

    const { vehicle: near } = crew(world, 'transportheli', 1, 60, 0);
    near.band = 2;
    world.time = 1.25;
    world.stepRadar();
    const jammed = world.radarTracksFor(0).get(`v:${near.id}`);
    expect(jammed).toMatchObject({ jammed: true, precision: 0.45 });
    expect(jammed?.pos).not.toEqual(near.pos);

    near.systems.ecm = 0;
    far.systems.ecm = 0;
    world.time = 2.5;
    world.stepRadar();
    expect(world.radarTracksFor(0).get(`v:${near.id}`)).toMatchObject({
      jammed: false, precision: 1, pos: near.pos,
    });
    expect(world.radarTracksFor(0).has(`v:${far.id}`)).toBe(true);
  });

  it('shares a long-range picture only from a staffed, working sensor station', () => {
    const world = quiet();
    const transport = world.spawnVehicle('transport', 0, { x: 0, y: 0, z: 0 });
    const operator = world.addSoldier('Sensor', 'infantry', 0, 'human');
    operator.alive = true;
    const sensorSeat = 1 + (transport.kind === 'transport' ? 1 : 0);
    transport.seats[sensorSeat] = operator.id;
    operator.vehicleId = transport.id;
    operator.seat = sensorSeat;
    const { vehicle: foe } = crew(world, 'interceptor', 1, 145, 0);
    foe.band = 3;
    foe.systems.ecm = 0;

    world.stepRadar();
    expect(world.radarTracksFor(0).get(`v:${foe.id}`)?.source).toBe('staffedSensors');

    world.radarTracks[0].clear();
    transport.systems.sensors = 0;
    world.time = 2;
    world.stepRadar();
    expect(world.radarTracksFor(0).has(`v:${foe.id}`)).toBe(false);
  });

  it('masks low ground radar behind walls while high aircraft radar sees over them', () => {
    const world = quiet();
    world.map.grid.fill(T_OPEN);
    const [, wallZ] = worldToTile(world.map.geometry, 0, 0);
    const [wallX] = worldToTile(world.map.geometry, 0, 0);
    world.map.grid[wallZ * world.map.geometry.cols + wallX] = T_WALL;
    const transport = world.spawnVehicle('transport', 0, { x: -30, y: 0, z: 0 });
    const operator = world.addSoldier('Sensor', 'infantry', 0, 'human');
    operator.alive = true;
    transport.seats[2] = operator.id;
    operator.vehicleId = transport.id;
    operator.seat = 2;
    const target = world.spawnVehicle('tank', 1, { x: 30, y: 0, z: 0 });
    target.systems.ecm = 0;
    world.stepRadar();
    expect(world.radarTracksFor(0).has(`v:${target.id}`)).toBe(false);

    const { vehicle: jet } = crew(world, 'interceptor', 0, -30, 0);
    jet.band = 3;
    world.time = 0.01;
    world.stepRadar();
    expect(world.radarTracksFor(0).get(`v:${target.id}`)?.source).toBe('fixedWing');
  });

  it('uses sonar underwater and never resolves air contacts', () => {
    const world = quiet(generateTheater('ocean', 42));
    const deep = world.map.theater!.routes.find((route) => route.domain === 'deep')!.points[0];
    const { vehicle: sub } = crew(world, 'submarine', 0, deep.x, deep.z);
    sub.submerged = true;
    const { vehicle: foeSub } = crew(world, 'submarine', 1, deep.x + 25, deep.z);
    foeSub.submerged = true;
    const { vehicle: boat } = crew(world, 'boat', 1, deep.x + 35, deep.z);
    const { vehicle: jet } = crew(world, 'interceptor', 1, deep.x + 40, deep.z);
    jet.band = 3;

    world.stepRadar();
    const tracks = world.radarTracksFor(0);
    expect(tracks.get(`v:${foeSub.id}`)?.source).toBe('sonar');
    expect(tracks.get(`v:${boat.id}`)?.source).toBe('sonar');
    expect(tracks.has(`v:${jet.id}`)).toBe(false);
  });

  it('expires contacts after their final hold-and-fade window', () => {
    const world = quiet();
    const { vehicle: jet } = crew(world, 'interceptor', 0);
    jet.band = 3;
    const { vehicle: foe } = crew(world, 'strikejet', 1, 60, 0);
    foe.band = 3;
    world.stepRadar();
    const key = `v:${foe.id}`;
    expect(world.radarTracksFor(0).has(key)).toBe(true);

    foe.pos.x = 500;
    world.time = 3.76;
    world.stepRadar();
    expect(world.radarTracksFor(0).has(key)).toBe(false);
  });

  it('gives AI the frozen radar position without leaking the live target', () => {
    const world = quiet();
    world.map.grid.fill(T_OPEN);
    const bot = world.addSoldier('Radar Bot', 'infantry', 0, 'bot');
    bot.alive = true;
    bot.pos = { x: 0, y: 0, z: 0 };
    const foe = world.addSoldier('Hidden Foe', 'infantry', 1, 'human');
    foe.alive = true;
    foe.pos = { x: -90, y: 0, z: 0 };
    world.radarTracks[0].set(`s:${foe.id}`, {
      key: `s:${foe.id}`, targetId: foe.id, targetType: 'soldier', receivingTeam: 0,
      pos: { x: 30, y: 0, z: 4 }, heading: 0, band: 0, domain: 'ground', source: 'staffedSensors',
      observedAt: world.time, expiresAt: world.time + 4, precision: 1, jammed: false,
    });

    expect(radarSearchPoint(world, bot)).toEqual({ x: 30, y: 0, z: 4 });
    foe.pos = { x: -110, y: 0, z: 20 };
    expect(radarSearchPoint(world, bot)).toEqual({ x: 30, y: 0, z: 4 });
    const command = stepBot(world, bot, 1 / 60);
    expect(command.moveX).toBeGreaterThan(0);
  });
});
