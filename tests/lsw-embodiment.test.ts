import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';
import { World } from '../src/sim/world';

// LSW EMBODIMENT — the four fields (rig/prop/attackPose) plus the movement
// tuning must hold for all 40 gods. This suite is the data-completeness gate
// (every god embodied) and the movement-feel gate (leap/blink numbers).

describe('every LSW is embodied', () => {
  it('all 40 have a rig and an attackPose', () => {
    const bare = Object.values(LSWS)
      .filter((d) => !d.rig || !d.attackPose)
      .map((d) => d.id);
    expect(bare).toEqual([]);
  });

  it('blade rigs carry a hand-prop', () => {
    for (const d of Object.values(LSWS)) {
      if (d.rig === 'blade') expect(d.prop).toBeTruthy(); // a blade rig needs a prop to show
    }
  });

  it('every attackPose is one the renderer knows', () => {
    const known = new Set(['SLAM', 'CHANNEL', 'THRUST', 'LOB', 'BRACE', 'SHOULDER', 'FLICK']);
    for (const d of Object.values(LSWS)) {
      if (d.attackPose) expect(known.has(d.attackPose)).toBe(true);
    }
  });
});

describe('leap tuning', () => {
  it('re-arms the leap at a 6s cadence (was 7s)', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!; // a leaper
    const e = w.addSoldier('E', 'infantry', 1, 'bot');
    e.pos = { x: 18, y: 0, z: 0 };                          // a valid leap target
    t.nextLeapAt = 0;
    w.step(1 / 60, new Map());
    expect(t.nextLeapAt! - w.time).toBeCloseTo(6, 1);       // cadence, not the 7 it was
  });

  it('the hop scales to 0.9x the gap — lands short of the enemy, never past it', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    const e = w.addSoldier('E', 'infantry', 1, 'bot');
    e.pos = { x: 14, y: 0, z: 0 };                          // 14u away (valid 12..34 target)
    t.nextLeapAt = 0;
    w.step(1 / 60, new Map());
    // reach = clamp(14 * 0.9, 8, 30) = 12.6 (the old code hopped 14 - 2 = 12)
    expect(t.diveX!).toBeCloseTo(12.6, 0);
    expect(t.diveX!).toBeLessThan(14);                      // never overshoots the target
  });
});
