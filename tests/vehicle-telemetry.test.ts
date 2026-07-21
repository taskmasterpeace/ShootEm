import { describe, expect, it } from 'vitest';
import {
  boxedVehicleProbe,
  runDuel,
  runScenario,
  runTelemetryProbe,
} from '../src/sim/scenario-runner';
import { VEHICLE_INCIDENT_LIMIT, VEHICLE_SAMPLE_LIMIT, vehicleTelemetryReport } from '../src/sim/vehicle-telemetry';

describe('vehicle battle telemetry', () => {
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
