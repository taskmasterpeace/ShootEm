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

describe('blink tuning', () => {
  it('re-arms the blink at a 1.6s cadence (was 2.0s)', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const c = w.addLsw('chronos', 1, { x: 0, y: 0, z: 0 })!; // a blink-walker
    c.nextBlinkAt = 0;
    w.step(1 / 60, new Map());
    expect(c.nextBlinkAt! - w.time).toBeCloseTo(1.6, 1);    // snappier than the old 2.0
  });
});

describe('bots use their powers — the 1v1 actually fights', () => {
  // Before the melee doctrine + wired signatures, a Titan/Ragebeast duel chipped
  // ~19 dps and never resolved (Robert: "way too much health"). Now the bots
  // fight at their own range and land their powers, so a duel is a real fight.
  it('a Titan vs Ragebeast duel trades heavy damage and drives to a result', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0, matchMinutes: 15 });
    w.map.basePos = [{ x: -30, y: 0, z: 0 }, { x: 30, y: 0, z: 0 }];
    w.map.hillPos = { x: 0, y: 0, z: 0 };
    const t = w.addLsw('titan', 0, { x: -12, y: 0, z: 0 })!;
    const r = w.addLsw('ragebeast', 1, { x: 12, y: 0, z: 0 })!;
    for (let i = 0; i < 60 * 90 && t.alive && r.alive; i++) w.step(1 / 60, new Map());
    // a real fight: by 90s someone is dead, or both are deep in the red — not
    // the old stalemate where two 5000-HP bodies barely scratched each other
    const resolved = !t.alive || !r.alive;
    const bloodied = t.hp < t.maxHp * 0.35 && r.hp < r.maxHp * 0.35;
    expect(resolved || bloodied, `titan ${Math.round(t.hp)}/${t.maxHp}, ragebeast ${Math.round(r.hp)}/${r.maxHp}`).toBe(true);
  });
});

describe('strange-five feel', () => {
  it('the wraith hovers at ~0.6u with gravity off', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const wr = w.addLsw('wraith', 1, { x: 0, y: 0, z: 0 })!;
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map()); // let it rise to its float
    expect(wr.pos.y).toBeCloseTo(0.6, 1);
    expect(wr.vel.y).toBe(0); // no falling — the silence is the tell
  });

  it('gravity is polite to the warden — it falls slower than a mortal', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const gw = w.addLsw('gravwarden', 0, { x: 0, y: 10, z: 0 })!;
    const mortal = w.addSoldier('M', 'infantry', 0, 'human');
    mortal.pos = { x: 5, y: 10, z: 0 };
    for (let i = 0; i < 24; i++) w.step(1 / 60, new Map());
    expect(gw.pos.y).toBeGreaterThan(mortal.pos.y); // 0.35x fall — still higher
  });
});
