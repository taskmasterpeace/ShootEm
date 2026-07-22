// ---------------------------------------------------------------------------
// Killcam duel framing — every death answers "where did that come from?"
// The sim stamps lastKillerId on the victim; the client frames victim+killer.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { applySnapshot, takeSnapshot } from '../src/sim/snapshot';
import {
  KILLCAM_PRE, KILLCAM_S, KILLCAM_SPEED, REPLAY_HZ, ReplayDirector, ReplayPlayer,
  killcamSpeedAt, type ReplayFrame,
} from '../src/client/replay';
import { World } from '../src/sim/world';

const world = () => new World({ seed: 7, mode: 'tdm' });

describe('killcam duel framing', () => {
  it('a kill stamps the killer on the victim', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    expect(victim.lastKillerId).toBe(-1);
    w.damageSoldier(victim, 999, shooter.id, 'rifle');
    expect(victim.alive).toBe(false);
    expect(victim.lastKillerId).toBe(shooter.id);
  });

  it('self- and environment kills stamp nobody — the camera stays on the corpse', () => {
    const w = world();
    const s = w.addSoldier('Oops', 'infantry', 0, 'human');
    w.damageSoldier(s, 999, s.id, 'gl'); // cooked his own frag
    expect(s.lastKillerId).toBe(-1);

    const e = w.addSoldier('Unlucky', 'infantry', 0, 'human');
    w.damageSoldier(e, 999, -1, 'gl'); // no attacker at all
    expect(e.lastKillerId).toBe(-1);
  });

  it('the stamp rides the wire — a puppet world sees who did it', () => {
    const w = world();
    const shooter = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const victim = w.addSoldier('Victim', 'infantry', 1, 'human');
    w.damageSoldier(victim, 999, shooter.id, 'rifle');

    const snap = JSON.parse(JSON.stringify(takeSnapshot(w, [])));
    const w2 = world();
    w2.puppet = true;
    applySnapshot(w2, snap);
    expect(w2.soldiers.get(victim.id)!.lastKillerId).toBe(shooter.id);
  });
});

// ---------------------------------------------------------------------------
// THE DEATH CAM WINDOW (Robert: "it cuts out too quick and the deaths aren't
// worth seeing"). The old cut took clip(KILLCAM_S) at the instant of death —
// a clip taken then ENDS on the death frame, so the killcam showed the run-up
// and stopped exactly when the interesting thing happened. These tests pin the
// property that was missing: the window must CONTAIN the death.
// ---------------------------------------------------------------------------
describe('the death cam window', () => {
  // real snapshots — a ReplayPlayer applies them into a live puppet world on
  // start(), so a stub would only prove the test harness works
  const snap0 = JSON.parse(JSON.stringify(takeSnapshot(world(), [])));
  const frames = (from: number, to: number, hz = REPLAY_HZ) => {
    const out: ReplayFrame[] = [];
    for (let t = from; t <= to + 1e-9; t += 1 / hz) {
      out.push({ t, snap: JSON.parse(JSON.stringify(snap0)) });
    }
    return out;
  };

  it('THE MONEY SHOT: the window straddles the death, it does not end on it', () => {
    // footage exists up to the death, and no further — exactly the state the
    // director is in when the player dies
    const deathT = 10;
    const pre = frames(deathT - KILLCAM_PRE, deathT);
    expect(pre[pre.length - 1].t).toBeCloseTo(deathT, 6); // the tape ends AT the death

    const p = new ReplayPlayer(1, 'tdm', undefined);
    p.start(pre, 'x', false, KILLCAM_SPEED, { endT: deathT + (KILLCAM_S - KILLCAM_PRE) });
    expect(p.endT, 'the cam must be aimed past the death').toBeGreaterThan(deathT);
    expect(p.endT! - deathT, 'and spend most of its window on the aftermath')
      .toBeGreaterThan(KILLCAM_PRE);
  });

  it('STREAMING: playback is slower than recording, so the tape is never caught', () => {
    // this is the property the whole design rests on — if playback ever ran at
    // or above 1x, the cam would outrun footage that does not exist yet
    for (const since of [-1, -0.5, 0, 0.2, 1, 3]) {
      expect(killcamSpeedAt(since), `speed at ${since}s`).toBeLessThan(1);
      expect(killcamSpeedAt(since)).toBeGreaterThan(0);
    }
  });

  it('a streaming player HOLDS when it runs dry instead of ending early', () => {
    const p = new ReplayPlayer(1, 'tdm', undefined);
    p.start(frames(0, 0.5), 'x', false, 0.5, { endT: 5 });
    // burn well past the end of the footage it was handed
    for (let i = 0; i < 200; i++) p.tick(1 / 60);
    expect(p.active, 'it must wait for the recorder, not cut out').toBe(true);
  });

  it('and it ENDS at its deadline, so a death cam can never run forever', () => {
    const p = new ReplayPlayer(1, 'tdm', undefined);
    p.start(frames(0, 0.5), 'x', false, 0.5, { endT: 1.0 });
    let n = 0;
    while (p.active && n < 5000) { p.tick(1 / 60); n++; }
    expect(p.active).toBe(false);
  });

  it('append only ever extends the tape forward — no rewriting history', () => {
    const p = new ReplayPlayer(1, 'tdm', undefined);
    p.start(frames(0, 1), 'x', false, 0.5, { endT: 9 });
    const was = p.lastT;
    p.append(frames(0, 0.4));        // stale footage, already played
    expect(p.lastT, 'old frames must not move the head').toBe(was);
    p.append(frames(1.1, 1.6));      // genuinely new footage
    expect(p.lastT).toBeGreaterThan(was);
  });

  it('THE HIT LANDS SLOWEST — the ramp is not flat', () => {
    const approach = killcamSpeedAt(-0.8);
    const impact = killcamSpeedAt(0);
    const fall = killcamSpeedAt(0.6);
    expect(impact, 'the moment of the kill must be the slowest').toBeLessThan(approach);
    expect(impact).toBeLessThan(fall);
    expect(approach, 'the run-up should not drag').toBeGreaterThan(fall);
  });
});

// ---------------------------------------------------------------------------
// THE REWARD KILL-CAM (Robert's shot #4): a great kill earns a brief cut of the
// moment instead of the death cam's punishment — the same machinery, framing
// the soldier YOU dropped. Rate-limited so it stays a treat.
// ---------------------------------------------------------------------------
describe('the reward kill-cam', () => {
  it('fires on a great kill, frames your victim as the SHOOTER, and rate-limits', () => {
    const w = world();
    const dir = new ReplayDirector(7, 'tdm', undefined);
    for (let i = 0; i < 15; i++) { w.step(0.1, new Map()); dir.recorder.record(w); } // lay a tape

    const took = dir.rewardKillCam(w, 42, '★ LONGSHOT · 80u', 'ride');
    expect(took, 'a great kill earns the cut').toBe(true);
    expect(dir.killcamActive).toBe(true);
    expect(dir.shotKind).toBe('ride');
    expect(dir.localIsShooter, 'YOU fired the round, so the ride flies your way').toBe(true);
    expect(dir.killerId, 'it frames the soldier you dropped').toBe(42);

    // a second great kill an instant later is suppressed — a treat, not a barrage
    expect(dir.rewardKillCam(w, 43, '★ MULTI-KILL', 'duel')).toBe(false);
  });

  it('will not fire with no tape to clip', () => {
    const dir = new ReplayDirector(7, 'tdm', undefined);
    expect(dir.rewardKillCam(world(), 1, '★ x', 'duel')).toBe(false);
  });
});
