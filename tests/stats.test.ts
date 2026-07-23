// ---------------------------------------------------------------------------
// THE STATS (#127) — visceral, never a hidden aim-roll (META-LAYER canon).
// DEX→reload · STR→melee + health · AGL→dash recovery. 5 = today's exact
// numbers (the whole legacy suite is the proof); the band caps near ±10%.
// Bots roll from a seed-stable hash so the rng streams never shift.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';

const world = () => new World({ seed: 21, mode: 'tdm' });

describe('the stats — the visceral three', () => {
  it('neutral 5s change NOTHING — todays numbers are stat-5 numbers', () => {
    const w = world();
    const s = w.addSoldier('Neutral', 'infantry', 0, 'human');
    expect(s.stats).toEqual({ str: 5, dex: 5, agl: 5 });
    expect(w.statMul(5)).toBe(1);
    expect(w.statQuick(5)).toBe(1);
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBe(WEAPONS[s.weapons[0]].reloadTime);
  });

  it('DEX owns the hands: 10 reloads a tenth faster, 1 a tenth slower', () => {
    const w = world();
    const s = w.addSoldier('Hands', 'infantry', 0, 'human');
    const base = WEAPONS[s.weapons[0]].reloadTime;
    s.stats = { str: 5, dex: 10, agl: 5 };
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBeCloseTo(base * 0.9, 5);
    s.stats = { str: 5, dex: 1, agl: 5 };
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBeCloseTo(base * 1.08, 5);
  });

  it('STR carries the frame: spawn health follows it around todays average', () => {
    const w = world();
    const strong = w.addSoldier('Ox', 'infantry', 0, 'human');
    strong.stats = { str: 10, dex: 5, agl: 5 };
    w.spawn(strong);
    const weak = w.addSoldier('Reed', 'infantry', 0, 'human');
    weak.stats = { str: 1, dex: 5, agl: 5 };
    w.spawn(weak);
    const base = w.addSoldier('Avg', 'infantry', 0, 'human');
    w.spawn(base);
    expect(strong.maxHp).toBe(Math.round(base.maxHp * 1.1));
    expect(weak.maxHp).toBe(Math.round(base.maxHp * 0.92));
  });

  it('bots roll 3..7 from the seed — stable across identical worlds, rng untouched', () => {
    const a = world();
    const b = world();
    const botsA = [1, 2, 3].map(() => a.addSoldier('P', 'infantry', 1, 'bot').stats);
    const botsB = [1, 2, 3].map(() => b.addSoldier('P', 'infantry', 1, 'bot').stats);
    expect(botsA).toEqual(botsB); // same seed, same people
    for (const st of botsA) {
      for (const v of Object.values(st!)) {
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      }
    }
    // and the streams stayed in lockstep — the stat roll drew NOTHING from
    // the rng (bots draw for loadouts as they always did; identical worlds
    // must agree on the very next number)
    expect(a.rng.next()).toBeCloseTo(b.rng.next(), 12);
  });

  it('the beasts carry no stats and pay nothing', () => {
    const w = world();
    const z = w.addSoldier('Shambler', 'infantry', 1, 'zombie');
    expect(z.stats).toBeUndefined();
    expect(w.statMul(undefined)).toBe(1);
  });
});
