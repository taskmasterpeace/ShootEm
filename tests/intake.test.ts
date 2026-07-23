// ---------------------------------------------------------------------------
// PERSONNEL INTAKE (THREE-GAMES-ONE-WAR §Prints) — the psych desk's pure laws.
// Three answers, each a class lean; the majority is the ministry's
// recommendation; ties break toward the FIRST answer (your gut spoke first).
// The temperament is the word stamped beside it on the file.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { recommendClass, temperamentFor } from '../src/client/identity';

describe('the psych desk', () => {
  it('the majority lean is the recommendation', () => {
    expect(recommendClass(['heavy', 'heavy', 'medic'])).toBe('heavy');
    expect(recommendClass(['infantry', 'engineer', 'engineer'])).toBe('engineer');
  });

  it('a three-way tie goes to the gut — the first answer wins', () => {
    expect(recommendClass(['infiltrator', 'medic', 'jump'])).toBe('infiltrator');
    expect(recommendClass(['ghost', 'heavy', 'pathfinder'])).toBe('ghost');
  });

  it('a two-way tie still honors first blood', () => {
    expect(recommendClass(['jump', 'medic', 'jump'])).toBe('jump');
    expect(recommendClass(['medic', 'jump', 'medic'])).toBe('medic');
  });

  it('no answers still yields a post — the line always has room', () => {
    expect(recommendClass([])).toBe('infantry');
  });

  it('every recommended post carries a stamped temperament, never blank', () => {
    for (const c of ['infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost']) {
      const t = temperamentFor(c);
      expect(t.length).toBeGreaterThan(2);
      expect(t).toBe(t.toUpperCase());
    }
  });
});
