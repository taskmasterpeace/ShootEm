import { beforeEach, describe, expect, it } from 'vitest';
import {
  FILE_COOLDOWN_MS, PHRASES, aggregate, fileGate, fileReview, reviewStorage, reviewsFor, starRow, synthReviews,
} from '../src/client/reviews';

// THE SERVICE NET's laws: deterministic synth voices, premade-text-only,
// one filing per item per print (refile replaces), and the cooldown gate.

let mem: string | null = null;
beforeEach(() => {
  mem = null;
  reviewStorage.get = () => mem;
  reviewStorage.set = (v: string) => { mem = v; };
});

describe('the service net — synthetic population', () => {
  it('same item, same reviews, every boot (deterministic)', () => {
    const a = synthReviews('ar606', 'weapon');
    const b = synthReviews('ar606', 'weapon');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(3);
  });

  it('different items get different voices', () => {
    expect(synthReviews('ar606', 'weapon')).not.toEqual(synthReviews('rg2', 'weapon'));
  });

  it('every phrase comes from the premade pools (no freeform, ever)', () => {
    for (const rv of synthReviews('tank', 'vehicle')) {
      const all = [...PHRASES.vehicle.hi, ...PHRASES.vehicle.mid, ...PHRASES.vehicle.lo];
      expect(all).toContain(rv.phrase);
    }
  });

  it('threats skew traumatized (1-3 stars — the joke holds)', () => {
    for (const rv of synthReviews('brute', 'threat')) expect(rv.stars).toBeLessThanOrEqual(3);
  });
});

describe('the service net — filing (spam armor)', () => {
  it('a filing lands, tops the drill-down, and moves the aggregate', () => {
    const before = aggregate('ar606', 'weapon');
    expect(fileReview('ar606', 5, 0, 1_000_000)).toBe(true);
    const after = aggregate('ar606', 'weapon');
    expect(after.count).toBe(before.count + 1);
    const list = reviewsFor('ar606', 'weapon');
    expect(list[0].mine).toBe(true);
    expect(list[0].stars).toBe(5);
  });

  it('one review per item per print — a refile REPLACES, never stacks', () => {
    fileReview('ar606', 5, 0, 1_000_000);
    fileReview('ar606', 1, 0, 1_000_000 + FILE_COOLDOWN_MS + 1);
    const list = reviewsFor('ar606', 'weapon');
    expect(list.filter((r) => r.mine)).toHaveLength(1);
    expect(list[0].stars).toBe(1);
  });

  it('the cooldown gate holds and names its reason', () => {
    fileReview('ar606', 4, 0, 1_000_000);
    expect(fileGate(1_000_000 + 5_000)).toMatch(/RATE-LIMITS/);
    expect(fileReview('rg2', 4, 0, 1_000_000 + 5_000)).toBe(false); // gated across items too
    expect(fileGate(1_000_000 + FILE_COOLDOWN_MS + 1)).toBe('');
  });
});

describe('the star row', () => {
  it('renders mono stars, never emoji', () => {
    expect(starRow(4.4)).toBe('★★★★☆');
    expect(starRow(1)).toBe('★☆☆☆☆');
  });
});
