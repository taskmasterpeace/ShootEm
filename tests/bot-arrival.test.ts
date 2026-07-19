// ---------------------------------------------------------------------------
// THE VIBRATING SENTRY — Robert, match start: "they IMMEDIATELY stayed at
// the man and started jittering." The flight recorder clocked posted guards
// at ~80 velocity-direction flips per second, standing ON their orbit posts
// beside the player's spawn. Two mechanisms, both fixed and both pinned here:
//  · applyCmd scaled ANY nonzero intent up to full stride, so a 0.001
//    separation whisper became a 9.5 u/s lunge (bang-bang equilibria);
//  · goal steering had no arrival — full pull at the goal (sign-flip noise),
//    and a hard stop-band just moved the bang-bang to the band's edge. The
//    pull now fades continuously through the last stride (the arrival ramp).
// The law: bodies posted near the standing player hold STILL.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import type { Soldier } from '../src/sim/types';

const MIX = ['infantry', 'infantry', 'heavy', 'medic', 'engineer', 'jump', 'infantry', 'infiltrator', 'infantry', 'heavy', 'medic', 'infantry'] as const;

describe('bot arrival (the vibrating-sentry law)', () => {
  it('guards posted around the standing player hold still — no full-speed jitter', () => {
    const DT = 1 / 30;
    // the exact reported scene: CTF, the human standing at spawn reading the
    // field, guard-role bots taking their orbit posts around the flag stand
    const w = new World({ seed: 7, mode: 'ctf', matchMinutes: 15 });
    const me = w.addSoldier('Robert', 'infantry', 0, 'human');
    for (const team of [0, 1] as const) {
      for (let i = 0; i < 12; i++) w.addSoldier(`T${team}B${i}`, MIX[i], team, 'bot');
    }
    for (let i = 0; i < Math.round(8 / DT); i++) w.step(DT, new Map());

    // five seconds of observation. The vibration signature is flips AT SPEED
    // while going NOWHERE — a bot threading the crowd turns hard and that's
    // fine; a bot reversing direction dozens of times inside two units is
    // the bug. Per body: count >90° direction changes at speed, and net
    // displacement over the window.
    const prevDir = new Map<number, number>();
    const flips = new Map<number, number>();
    const startPos = new Map<number, { x: number; z: number }>();
    const near = (s: Soldier) =>
      Math.hypot(s.pos.x - me.pos.x, s.pos.z - me.pos.z) < 10;
    for (const s of w.soldiers.values()) {
      if (s.team === 0 && s.kind === 'bot' && near(s)) startPos.set(s.id, { x: s.pos.x, z: s.pos.z });
    }
    expect(startPos.size, 'scene rig broke: no bodies posted near the player').toBeGreaterThanOrEqual(2);

    for (let i = 0; i < Math.round(5 / DT); i++) {
      w.step(DT, new Map());
      for (const s of w.soldiers.values()) {
        if (s.team !== 0 || s.kind !== 'bot' || !s.alive || !near(s)) continue;
        if (!startPos.has(s.id)) startPos.set(s.id, { x: s.pos.x, z: s.pos.z });
        const spd = Math.hypot(s.vel.x, s.vel.z);
        if (spd < 2) { prevDir.delete(s.id); continue; }
        const dir = Math.atan2(s.vel.z, s.vel.x);
        const prev = prevDir.get(s.id);
        if (prev !== undefined) {
          let dd = Math.abs(dir - prev);
          if (dd > Math.PI) dd = 2 * Math.PI - dd;
          if (dd > Math.PI / 2) flips.set(s.id, (flips.get(s.id) ?? 0) + 1);
        }
        prevDir.set(s.id, dir);
      }
    }
    const vibrating: string[] = [];
    for (const [id, n] of flips) {
      const s = w.soldiers.get(id);
      const p0 = startPos.get(id);
      if (!s || !p0) continue;
      const disp = Math.hypot(s.pos.x - p0.x, s.pos.z - p0.z);
      // the broken build: ~150 flips per posted body at ~0.3u displacement
      if (n > 10 && disp < 2) vibrating.push(`${s.name} ${n} flips in ${disp.toFixed(1)}u`);
    }
    expect(vibrating, `bodies vibrating in place: ${vibrating.join('; ')}`).toEqual([]);

    // and the posts held: bodies that started posted didn't wander (they may
    // step for separation, never orbit at speed)
    for (const [id, p0] of startPos) {
      const s = w.soldiers.get(id)!;
      if (!s.alive) continue;
      const drift = Math.hypot(s.pos.x - p0.x, s.pos.z - p0.z);
      expect(drift, `${s.name} wandered ${drift.toFixed(1)}u off his post`).toBeLessThan(6);
    }
  });
});
