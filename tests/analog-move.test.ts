import { describe, expect, it } from 'vitest';
import { analogDrive } from '../src/client/input';

// ANALOG CONTROLLER MOVEMENT (Robert: "slow when barely moved, full when it's
// all the way"). The left-stick magnitude → a movement drive in [0,1], with a
// radial deadzone rescaled so the usable travel spans 0→full, and a sprint at
// the top. The sim already turns sub-unit drive into sub-full speed.
describe('analogDrive', () => {
  const DZ = 0.18;

  it('is dead inside the deadzone — no crawl, no sprint', () => {
    expect(analogDrive(0, DZ)).toEqual({ drive: 0, sprint: false });
    expect(analogDrive(DZ, DZ)).toEqual({ drive: 0, sprint: false });
  });

  it('ramps smoothly from 0 at the deadzone edge (no jump to a hard floor)', () => {
    // just past the deadzone → a genuine crawl, not an 18% lurch
    const barely = analogDrive(DZ + 0.02, DZ).drive;
    expect(barely).toBeGreaterThan(0);
    expect(barely).toBeLessThan(0.06);
  });

  it('scales monotonically — a firmer push is faster', () => {
    const gentle = analogDrive(0.35, DZ).drive;
    const firm = analogDrive(0.7, DZ).drive;
    expect(firm).toBeGreaterThan(gentle);
    expect(gentle).toBeGreaterThan(0);
    expect(gentle).toBeLessThan(1);
  });

  it('reaches full drive + a SPRINT when pushed all the way', () => {
    const full = analogDrive(1, DZ);
    expect(full.drive).toBeCloseTo(1);
    expect(full.sprint).toBe(true);
  });

  it('does not sprint at a partial push', () => {
    expect(analogDrive(0.6, DZ).sprint).toBe(false);
  });

  it('respects a custom deadzone', () => {
    expect(analogDrive(0.25, 0.3).drive).toBe(0); // inside a wider deadzone
    expect(analogDrive(0.65, 0.3).drive).toBeCloseTo((0.65 - 0.3) / 0.7);
  });
});
