import { describe, expect, it } from 'vitest';
import { runRotorcraftInsertion, runRotorcraftSupport } from '../src/sim/scenario-runner';

describe('rotorcraft mission AI', () => {
  it('lands a Condor in a compatible mountain insertion zone', () => {
    const result = runRotorcraftInsertion('mountain', 4207, 180);
    expect(result.landed).toBe(true);
    expect(result.nonFinite).toBe(0);
    expect(result.persistentStalls).toBe(0);
    expect(result.crashes).toBe(0);
  });

  it('flies a Shrike support route and damages enemy armor', () => {
    const result = runRotorcraftSupport('countryside', 7749, 120);
    expect(result.firstContact).not.toBeNull();
    expect(result.shots).toBeGreaterThan(0);
    expect(result.hits).toBeGreaterThan(0);
    expect(result.targetHp).toBeLessThan(result.targetMaxHp);
  });

  it.each(['city', 'desert', 'countryside', 'mountain', 'coastal'] as const)(
  'completes a %s insertion without crashing', (theater) => {
    const result = runRotorcraftInsertion(theater, 42, 180);
    expect(result.landed).toBe(true);
    expect(result.crashes).toBe(0);
    expect(result.nonFinite).toBe(0);
  });
});
