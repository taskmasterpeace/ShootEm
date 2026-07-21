// ---------------------------------------------------------------------------
// THE RAGDOLL THRESHOLD (STATUS §1 / W1.5, Robert: "a knockback threshold that
// ragdolls us"). It used to fire only inside explode(), so a Titan-class slam
// shoved but never flipped. maybeRagdoll is the one shared gate — a big enough
// impulse flips the body wherever it comes from; gods and the encased are too
// heavy; overlapping hits extend the tumble without stuttering the event.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

const mk = () => {
  const w = new World({ seed: 1, mode: 'tdm', matchMinutes: 10 });
  const s = w.addSoldier('S', 'infantry', 0, 'human');
  return { w, s };
};

describe('the ragdoll threshold (W1.5)', () => {
  it('a shove past the threshold flips the body; a small one does not', () => {
    const { w, s } = mk();
    w.maybeRagdoll(s, 10);
    expect(s.ragdollUntil).toBeUndefined();          // under threshold — stays up
    w.takeEvents();
    w.maybeRagdoll(s, 24);
    expect(s.ragdollUntil).toBeGreaterThan(w.time);  // over — luggage
    expect(w.takeEvents().some((e) => e.type === 'ragdoll' && e.soldierId === s.id)).toBe(true);
  });

  it('gods and the encased are too heavy to flip', () => {
    const { w, s } = mk();
    s.encasedUntil = w.time + 5;
    w.maybeRagdoll(s, 40);
    expect(s.ragdollUntil).toBeUndefined();
    s.encasedUntil = undefined;
    (s as unknown as { ascendant: string }).ascendant = 'anything';
    w.maybeRagdoll(s, 40);
    expect(s.ragdollUntil).toBeUndefined();
  });

  it('overlapping shoves EXTEND the tumble, never shorten it, and do not re-ring', () => {
    const { w, s } = mk();
    w.maybeRagdoll(s, 40);          // a long tumble
    const long = s.ragdollUntil!;
    w.takeEvents();
    w.maybeRagdoll(s, 17);          // a weaker follow-up mid-tumble
    expect(s.ragdollUntil).toBe(long);                                  // not shortened
    expect(w.takeEvents().some((e) => e.type === 'ragdoll')).toBe(false); // no stutter re-emit
  });
});
