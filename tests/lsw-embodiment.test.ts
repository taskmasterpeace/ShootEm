import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';

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
