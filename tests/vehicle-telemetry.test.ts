import { describe, expect, it } from 'vitest';
import {
  boxedVehicleProbe,
  runDuel,
  runScenario,
  runTelemetryProbe,
} from '../src/sim/scenario-runner';
import {
  VEHICLE_INCIDENT_LIMIT, VEHICLE_SAMPLE_LIMIT, createVehicleTelemetry,
  recordVehicleEvent, vehicleTelemetryReport,
} from '../src/sim/vehicle-telemetry';

describe('vehicle battle telemetry', () => {
  it('counts radar sweeps, contacts, jamming, and reacquisition', () => {
    const telemetry = createVehicleTelemetry();
    const base = {
      t: 2, vehicleId: 7, vehicleKind: 'interceptor' as const,
      theaterId: 'desert', seed: 42, x: 0, z: 0,
    };
    recordVehicleEvent(telemetry, { ...base, kind: 'radar_sweep' });
    recordVehicleEvent(telemetry, { ...base, kind: 'radar_contact' });
    recordVehicleEvent(telemetry, { ...base, kind: 'radar_jammed' });
    recordVehicleEvent(telemetry, { ...base, kind: 'radar_reacquired' });
    expect(telemetry.summary).toMatchObject({
      radarSweeps: 1, radarContacts: 1, radarJammed: 1, radarReacquired: 1,
    });
    expect(vehicleTelemetryReport(telemetry)).toContain('radar 1 sweep / 1 contact / 1 jam / 1 reacquired');
  });

  it('records bounded deterministic movement and elevation data', () => {
    const a = runTelemetryProbe('desert', 42, 180);
    const b = runTelemetryProbe('desert', 42, 180);
    expect(a).toEqual(b);
    expect(a.samples.length).toBeLessThanOrEqual(VEHICLE_SAMPLE_LIMIT);
    expect(a.incidents.length).toBeLessThanOrEqual(VEHICLE_INCIDENT_LIMIT);
    expect(a.summary.distanceByKind.interceptor).toBeGreaterThan(0);
    expect(a.summary.elevationSeconds[3]).toBeGreaterThan(0);
  });

  it('files a reproducible persistent vehicle stall', () => {
    const { world, vehicle } = boxedVehicleProbe();
    runScenario(world, 8);
    expect(world.vehicleTelemetry.incidents).toContainEqual(expect.objectContaining({
      kind: 'stuck', vehicleId: vehicle.id, theaterId: 'city', seed: world.map.seed,
    }));
  });

  it('reports combat by attacker and victim hull kind', () => {
    const result = runDuel('tank', 'tank', 31);
    expect(result.summary.lossesByKind.tank).toBeGreaterThan(0);
    expect(vehicleTelemetryReport(result)).toMatch(/first contact|tank.*loss/i);
  });
});
