import { describe, expect, it } from 'vitest';
import { makeAirProbe, makeRouteProbe, runScenario } from '../src/sim/scenario-runner';

describe('deterministic vehicle theater probes', () => {
  it.each(['city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const)
  ('a bot completes a declared %s vehicle route', (theater) => {
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
});
