import { describe, expect, it } from 'vitest';
import { GhostPlayer, GhostRecorder } from '../src/client/ghost';

// THE GHOST — a lightweight per-board lap recorder + interpolating replay. Pure
// logic (no DOM), so it can be locked here; the render + persistence wiring is
// verified live.

describe('GhostRecorder', () => {
  it('samples lap-relative time, throttled to ~20 Hz', () => {
    const rec = new GhostRecorder();
    rec.startLap(100);
    // feed 1s of frames at 60 Hz — should thin to ~20 samples
    for (let i = 0; i <= 60; i++) rec.record(100 + i / 60, i, 0, 0, 0);
    const s = rec.takeLap();
    expect(s.length).toBeGreaterThanOrEqual(14);   // ~17 Hz effective (frames miss the exact grid)
    expect(s.length).toBeLessThanOrEqual(22);
    expect(s[0].t).toBe(0);                       // lap-relative
    expect(s[s.length - 1].t).toBeLessThanOrEqual(1.01);
  });

  it('restarts cleanly for the next lap', () => {
    const rec = new GhostRecorder();
    rec.startLap(0); rec.record(0, 1, 0, 1, 0); rec.record(0.1, 2, 0, 2, 0);
    rec.startLap(5);
    rec.record(5, 9, 0, 9, 0);
    const s = rec.takeLap();
    expect(s.length).toBe(1);
    expect(s[0].t).toBe(0);
    expect(s[0].x).toBe(9);
  });
});

describe('GhostPlayer', () => {
  const samples = [
    { t: 0, x: 0, y: 0, z: 0, yaw: 0 },
    { t: 1, x: 10, y: 0, z: 0, yaw: Math.PI / 2 },
    { t: 2, x: 10, y: 0, z: 10, yaw: Math.PI },
  ];
  it('interpolates between samples', () => {
    const g = new GhostPlayer(samples);
    const at = g.at(0.5)!;
    expect(at.x).toBeCloseTo(5);
    expect(at.yaw).toBeCloseTo(Math.PI / 4);
  });
  it('holds at the ends', () => {
    const g = new GhostPlayer(samples);
    expect(g.at(-1)!.x).toBe(0);
    expect(g.at(99)!.z).toBe(10);
    expect(g.duration).toBe(2);
  });
  it('takes the short way round on yaw', () => {
    const g = new GhostPlayer([
      { t: 0, x: 0, y: 0, z: 0, yaw: -3 },
      { t: 1, x: 0, y: 0, z: 0, yaw: 3 }, // 6 rad apart the long way, ~0.28 the short way
    ]);
    const at = g.at(0.5)!;
    expect(Math.abs(at.yaw)).toBeGreaterThan(3); // crossed ±π, not through 0
  });
  it('is empty-safe', () => {
    expect(new GhostPlayer([]).at(0)).toBeNull();
  });
});
