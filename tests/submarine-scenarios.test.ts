import { describe, expect, it } from 'vitest';
import { evaluateSubmarineMatrix, runSubmarineBattle, runSubmarineMatrix } from '../src/sim/scenario-runner';

const SEEDS = [7, 31, 42, 99, 4207, 5150, 7749, 1337, 90210, 606];

describe('submarine battle AI', () => {
  it.each(['coastal', 'ocean'] as const)('fights a submerged torpedo duel on %s deep routes', (theater) => {
    const result = runSubmarineBattle(theater, 42, 180);
    expect(result.dives).toBeGreaterThanOrEqual(2);
    expect(result.firstContact).not.toBeNull();
    expect(result.shots).toBeGreaterThan(0);
    expect(result.hits).toBeGreaterThan(0);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.nonFinite).toBe(0);
    expect(result.wrongDepth).toBe(0);
    expect(result.routeCompletions).toBeGreaterThan(0);
  });

  it('passes Coastal and Ocean submarine fights over ten seeds', () => {
    const report = runSubmarineMatrix({ seeds: SEEDS });
    expect(report.scenarios).toHaveLength(20);
    expect(evaluateSubmarineMatrix(report)).toEqual({ failures: [] });
  });
});
