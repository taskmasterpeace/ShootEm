import { describe, expect, it, vi, beforeEach } from 'vitest';
import { World } from '../src/sim/world';
import { ClassVo } from '../src/client/classvo';
import { audio } from '../src/client/audio';
import type { SimEvent } from '../src/sim/types';

// The mortal-class VO dispatcher is client-side and reads events the sim
// already emits. audio.play no-ops headless (no AudioContext), so we spy on it
// to assert WHICH slot each moment requests, and that the guards hold.

function world() {
  return new World({
    seed: 5, mode: 'tdm', difficulty: 'veteran', botsPerTeam: 2, matchMinutes: 15,
    theme: 'savanna', hordeRoster: 'zombies', moraleBoost: [0, 0], lswPass: 3,
  } as never);
}
const played = () => (audio.play as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0]);

beforeEach(() => { vi.spyOn(audio, 'play').mockReturnValue(true); });

describe('class VO — the right voice for the moment', () => {
  it('a confirmed kill speaks the killer class kill line', () => {
    const w = world();
    const s = w.addSoldier('Gabe', 'infantry', 0, 'human'); s.alive = true;
    const cv = new ClassVo();
    cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'foe' } as SimEvent, w, s.id);
    expect(played()).toContain('vo_infantry_kill');
  });

  it('a second kill inside the window becomes the multi line', () => {
    const w = world();
    const s = w.addSoldier('Amina', 'medic', 0, 'human'); s.alive = true;
    const cv = new ClassVo();
    cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'a' } as SimEvent, w, s.id);
    cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'b' } as SimEvent, w, s.id);
    expect(played()).toContain('vo_medic_kill_multi');
  });

  it('is silent for another soldier’s kill (only YOUR moments)', () => {
    const w = world();
    const me = w.addSoldier('Me', 'heavy', 0, 'human'); me.alive = true;
    const other = w.addSoldier('Them', 'heavy', 1, 'bot'); other.alive = true;
    const cv = new ClassVo();
    cv.consider({ type: 'kill_confirm', soldierId: other.id, text: 'x' } as SimEvent, w, me.id);
    expect(played().filter((n) => String(n).startsWith('vo_'))).toHaveLength(0);
  });

  it('a repeated reload is gated by the slot cooldown', () => {
    const w = world();
    const s = w.addSoldier('Naveen', 'engineer', 0, 'human'); s.alive = true;
    const cv = new ClassVo();
    cv.consider({ type: 'reload', soldierId: s.id } as SimEvent, w, s.id);
    cv.consider({ type: 'reload', soldierId: s.id } as SimEvent, w, s.id);
    expect(played().filter((n) => n === 'vo_engineer_reload')).toHaveLength(1);
  });

  it('the flag run: pickup then capture off the carrier bit', () => {
    const w = world();
    const s = w.addSoldier('Keisha', 'jump', 0, 'human'); s.alive = true; s.carryingFlag = -1;
    const cv = new ClassVo();
    cv.tick(w, s.id);                 // opens with the intro
    s.carryingFlag = 1; cv.tick(w, s.id);   // grabbed the enemy flag
    s.carryingFlag = -1; cv.tick(w, s.id);  // scored while still standing
    expect(played()).toContain('vo_jump_flag_pickup');
    expect(played()).toContain('vo_jump_flag_capture');
  });

  it('stays quiet in the paintball boot camp', () => {
    const w = world();
    (w.mode as { id: string }).id = 'paintball';
    const s = w.addSoldier('Gabe', 'infantry', 0, 'human'); s.alive = true;
    const cv = new ClassVo();
    cv.tick(w, s.id);
    cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'x' } as SimEvent, w, s.id);
    expect(played().filter((n) => String(n).startsWith('vo_'))).toHaveLength(0);
  });
});

describe('class VO — the Odessa shape (numbered variants rotate)', () => {
  it('the infiltrator kill line resolves vo_infiltrator_kill_N and rotates', () => {
    const w = world();
    const s = w.addSoldier('Dee', 'infiltrator', 0, 'human'); s.alive = true;
    const cv = new ClassVo();
    // kill CD is 3.5s wall-clock and the 4s multi-window must NOT trip —
    // drive the dispatcher's clock (performance.now) 10s per kill
    const clock = vi.spyOn(performance, 'now');
    try {
      clock.mockReturnValue(0);
      cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'a' } as SimEvent, w, s.id);
      clock.mockReturnValue(10000);
      cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'b' } as SimEvent, w, s.id);
      clock.mockReturnValue(20000);
      cv.consider({ type: 'kill_confirm', soldierId: s.id, text: 'c' } as SimEvent, w, s.id);
    } finally { clock.mockRestore(); }
    const kills = played().filter((n) => String(n).startsWith('vo_infiltrator_kill'));
    expect(kills.length).toBe(3);
    expect(new Set(kills).size).toBeGreaterThan(1); // rotated, never the same take thrice
  });
});
