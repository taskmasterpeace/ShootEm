import { describe, expect, it } from 'vitest';
import {
  radarDisplayState, radarRangeEllipse, radarSweepAngle,
  renderVehicleInstruments, vehicleInstrumentState,
} from '../src/client/hud';
import { World } from '../src/sim/world';

describe('vehicle instrument presenters', () => {
  it('keeps radar range circular in rectangular world space', () => {
    expect(radarRangeEllipse({ cols: 200, rows: 300, tile: 3 }, 220, 125)).toEqual({
      radiusX: 125 / 600 * 220,
      radiusY: 125 / 900 * 220,
    });
    expect(radarSweepAngle(10, 11.25, 1.25)).toBeCloseTo(-Math.PI / 2);
    expect(radarSweepAngle(10.625, 11.25, 1.25)).toBeCloseTo(Math.PI / 2);
  });

  it('selects onboard radar before a staffed team picture', () => {
    const world = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    world.soldiers.clear();
    world.vehicles.clear();
    const pilot = world.addSoldier('Pilot', 'infantry', 0, 'human');
    pilot.alive = true;
    const jet = world.spawnVehicle('interceptor', 0, { x: 10, y: 0, z: 20 });
    jet.seats[0] = pilot.id;
    pilot.vehicleId = jet.id;
    pilot.seat = 0;
    const transport = world.spawnVehicle('transport', 0, { x: -20, y: 0, z: 0 });
    const sensor = world.addSoldier('Sensor', 'infantry', 0, 'human');
    sensor.alive = true;
    transport.seats[2] = sensor.id;
    sensor.vehicleId = transport.id;
    sensor.seat = 2;

    expect(radarDisplayState(world, pilot)).toMatchObject({
      source: 'fixedWing', range: 125, cadence: 1.25, origin: jet.pos,
    });
    pilot.vehicleId = -1;
    pilot.seat = -1;
    jet.seats[0] = -1;
    expect(radarDisplayState(world, pilot)).toMatchObject({
      source: 'staffedSensors', range: 160, cadence: 2, origin: transport.pos,
    });
  });

  it('normalizes heading and exposes speed, altitude, and onboard radar', () => {
    const state = vehicleInstrumentState({
      kind: 'interceptor', yaw: -Math.PI / 2, vel: { x: 0, y: 0, z: -30 },
      band: 3, submerged: false, burnerOn: false, spoolRemaining: 0,
      sensorsHp: 14, sensorsMax: 14,
      radar: { source: 'fixedWing', range: 125, freshTracks: 2, jammed: false },
      locked: false,
    });
    expect(state.heading).toBe(270);
    expect(state.headingText).toBe('N 270°');
    expect(state.speed).toBe(30);
    expect(state.speedPercent).toBeCloseTo(30 / 46);
    expect(state.altitudePips).toEqual([false, false, false, true]);
    expect(state.radarText).toBe('RDR AIR 125 · 2 TRACKS');
    expect(state.flightMode).toBe('CRUISE');
  });

  it('renders afterburner and missile lock as redundant live text', () => {
    const state = vehicleInstrumentState({
      kind: 'strikejet', yaw: 0, vel: { x: 42, y: 0, z: 0 },
      band: 2, submerged: false, burnerOn: true, spoolRemaining: 0,
      sensorsHp: 16, sensorsMax: 16,
      radar: { source: 'fixedWing', range: 125, freshTracks: 1, jammed: true },
      locked: true,
    });
    const html = renderVehicleInstruments(state);
    expect(state.flightMode).toBe('AB');
    expect(state.threatText).toBe('LOCK · MISSILE INBOUND');
    expect(html).toContain('MISSILE INBOUND');
    expect(html).toContain('AB');
    expect(html).toContain('JAM');
    expect(html).toContain('id="airspeed-needle"');
  });

  it('states stall, rotor spool, dead sensors, and submerged sonar precisely', () => {
    const stalled = vehicleInstrumentState({
      kind: 'interceptor', yaw: 0, vel: { x: 2, y: 0, z: 0 }, band: 1,
      submerged: false, burnerOn: false, spoolRemaining: 0,
      sensorsHp: 0, sensorsMax: 14, radar: null, locked: false,
    });
    expect(stalled.flightMode).toBe('STALL');
    expect(stalled.radarText).toBe('SEN DEAD');

    const rotor = vehicleInstrumentState({
      kind: 'attackheli', yaw: Math.PI / 2, vel: { x: 0, y: 0, z: 0 }, band: 0,
      submerged: false, burnerOn: false, spoolRemaining: 2.4,
      sensorsHp: 24, sensorsMax: 24,
      radar: { source: 'rotorcraft', range: 90, freshTracks: 0, jammed: false }, locked: false,
    });
    expect(rotor.flightMode).toBe('SPOOL 2.4');
    expect(rotor.headingText).toBe('S 90°');

    const sonar = vehicleInstrumentState({
      kind: 'submarine', yaw: Math.PI, vel: { x: -8, y: 0, z: 0 }, band: 0,
      submerged: true, burnerOn: false, spoolRemaining: 0,
      sensorsHp: 60, sensorsMax: 60,
      radar: { source: 'sonar', range: 80, freshTracks: 3, jammed: false }, locked: false,
    });
    expect(sonar.flightMode).toBe('SUBMERGED');
    expect(sonar.radarText).toBe('SONAR 80 · 3 TRACKS');
  });
});
