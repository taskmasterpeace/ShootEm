import { describe, expect, it } from 'vitest';
import { evaluateFoundationMatrix, makeAirProbe, makeRouteProbe, runFoundationMatrix, runScenario } from '../src/sim/scenario-runner';

describe('deterministic vehicle theater probes', () => {
  it.each(['city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const)(
  'a bot completes a declared %s vehicle route', (theater) => {
    const probe = makeRouteProbe(theater, 42);
    runScenario(probe.world, 180);
    expect(probe.result().nonFinite).toBe(0);
    expect(probe.result().persistentStalls).toBe(0);
    expect(probe.result().routeCompleted).toBe(true);
  });

  it('a jet uses Building, Sky, and Clouds during a strike profile', () => {
    const probe = makeAirProbe('desert', 7749, 'strike');
    runScenario(probe.world, 150);
    expect(probe.result().elevationUsed).toEqual(expect.arrayContaining([1, 2, 3]));
    expect(probe.result().nonFinite).toBe(0);
  });

  it('passes the foundation scenario matrix', () => {
    const report = runFoundationMatrix({ seeds: [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606] });
    const verdict = evaluateFoundationMatrix(report);
    expect(report.scenarios.reduce((sum, row) => sum + row.telemetry.radarSweeps, 0)).toBeGreaterThan(0);
    expect(report.scenarios.reduce((sum, row) => sum + row.telemetry.radarContacts, 0)).toBeGreaterThan(0);
    expect(report.scenarios.reduce((sum, row) => sum + row.telemetry.radarJammed, 0)).toBeGreaterThan(0);
    expect(verdict.structuralFailures).toEqual([]);
    expect(verdict.routeFailures).toEqual([]);
    expect(verdict.contactFailures).toEqual([]);
    expect(verdict.fixedWingFirstContact.min).toBeGreaterThanOrEqual(8);
    expect(verdict.fixedWingFirstContact.max).toBeLessThanOrEqual(45);
    expect(verdict.groundNavalFirstContact.min).toBeGreaterThanOrEqual(20);
    expect(verdict.groundNavalFirstContact.max).toBeLessThanOrEqual(120);
    expect(verdict.maxMirroredWinRate).toBeLessThanOrEqual(0.70);
  });
});
