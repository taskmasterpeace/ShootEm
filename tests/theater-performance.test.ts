import { describe, expect, it } from 'vitest';
import { measureTheaterGeneration, type TheaterId } from '../src/sim/theaters';

describe('vehicle theater generation budget', () => {
  it('keeps 900x900 theater generation below the approved p95 budget', () => {
    const samples = (['desert', 'countryside', 'ocean'] as TheaterId[]).flatMap((id) =>
      Array.from({ length: 20 }, (_, seed) => measureTheaterGeneration(id, seed).ms));
    samples.sort((a, b) => a - b);
    expect(samples[Math.floor(samples.length * 0.95)]).toBeLessThan(750);
  });
});
