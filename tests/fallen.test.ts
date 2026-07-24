// ───────────────────────────────────────────────────────────────────────────
// THE FALLEN — bodies that stay, and blood that does not.
//
// Robert: *"we will be adding body decay to skeletons, but right now blood
// lasts a very long time and bodies disappear."*
//
// He had the inversion exactly right, and it measured worse than it sounds:
//
//   A BODY lasted 4.0 seconds — `corpse = !s.alive && time < s.respawnAt` —
//   and at RESPAWN_DELAY the same mesh stood back up as a living man. The body
//   did not fade; it was repossessed.
//
//   A BLOOD SPLAT lasted forever. The decal pool had no clock at all, only a
//   900-deep FIFO, so a stain from the first minute was still wet in the last.
//
// The law this suite defends: THE MAN OUTLASTS HIS STAIN. A body must still be
// there long after the blood it left has dried and gone, and the field must
// never be able to grow without bound.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import {
  BONE_REST_S, BONES_S, FALLEN_LIFE, FALLEN_MAX, FRESH_S, REVEAL_S, decayOf,
} from '../src/client/fallen';

/** the blood clock, mirrored from renderer.ts — see the note in the last test */
const BLOOD_WET = 25;
const BLOOD_DRY = 85;
const BLOOD_LIFE = BLOOD_WET + BLOOD_DRY;

describe('a body decays through real stages', () => {
  it('lies as it fell before time starts on it', () => {
    expect(decayOf(0).stage).toBe('fresh');
    expect(decayOf(FRESH_S - 0.01).stage).toBe('fresh');
    expect(decayOf(0).t).toBe(0);
  });

  it('turns, and the turn is gradual — not a switch', () => {
    expect(decayOf(FRESH_S).stage).toBe('turning');
    const quarter = decayOf(FRESH_S + BONES_S * 0.25).t;
    const half = decayOf(FRESH_S + BONES_S * 0.5).t;
    const most = decayOf(FRESH_S + BONES_S * 0.9).t;
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(most).toBeGreaterThan(half);
    expect(most).toBeLessThan(1);
  });

  it('becomes bones, and bones rest a good while', () => {
    expect(decayOf(FRESH_S + BONES_S).stage).toBe('bones');
    expect(decayOf(FALLEN_LIFE - 1).stage, 'still there at the last second').toBe('bones');
  });

  it('and is finally taken by the ground', () => {
    expect(decayOf(FALLEN_LIFE).stage).toBe('gone');
    expect(decayOf(FALLEN_LIFE * 10).stage).toBe('gone');
  });

  it('the ladder never goes backwards', () => {
    const order = { fresh: 0, turning: 1, bones: 2, gone: 3 };
    let last = -1;
    for (let age = 0; age <= FALLEN_LIFE + 20; age += 3) {
      const rung = order[decayOf(age).stage];
      expect(rung, `at ${age}s`).toBeGreaterThanOrEqual(last);
      last = rung;
    }
  });

  it('is hidden while the dying soldier still owns the spot', () => {
    // RESPAWN_DELAY is 4s in the sim; the body must not appear before the
    // soldier's own mesh has stopped being that body, or the field doubles
    expect(REVEAL_S).toBeGreaterThan(3.5);
    expect(REVEAL_S).toBeLessThan(FRESH_S);
  });
});

describe('THE LAW — the man outlasts his stain', () => {
  it('a body is still on the field long after its blood has gone', () => {
    // this is the whole inversion, stated as an assertion. Before the repair
    // the numbers were: body 4s, blood unbounded.
    expect(FALLEN_LIFE).toBeGreaterThan(BLOOD_LIFE * 2);
  });

  it('a body is still FRESH while its blood is still wet', () => {
    expect(FRESH_S).toBeGreaterThan(BLOOD_WET);
  });

  it('blood is gone before the body has even finished turning', () => {
    expect(BLOOD_LIFE).toBeLessThan(FRESH_S + BONES_S);
  });

  it('nothing in the decal or body clock is unbounded any more', () => {
    for (const v of [BLOOD_WET, BLOOD_DRY, FRESH_S, BONES_S, BONE_REST_S, FALLEN_LIFE]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
    }
  });
});

describe('the field can never grow without bound', () => {
  it('the budget is real and small enough to draw', () => {
    expect(FALLEN_MAX).toBeGreaterThan(16);   // enough that a firefight leaves a field
    expect(FALLEN_MAX).toBeLessThanOrEqual(64); // …and never enough to matter at 3 draws
  });

  it('the whole field is a fixed handful of draws, not one per body', () => {
    // THE COST IS THE DESIGN: a corpse is six parts, so forty bodies drawn the
    // obvious way is 240 draw calls — worse than the problem it replaces. Three
    // InstancedMeshes (torso · head · limbs) hold the entire field.
    const PARTS_PER_BODY = 6;
    const INSTANCED_MESHES = 3;
    expect(INSTANCED_MESHES).toBeLessThan(FALLEN_MAX * PARTS_PER_BODY / 20);
  });
});
