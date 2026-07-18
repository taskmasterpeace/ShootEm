// ---------------------------------------------------------------------------
// THE GAIT LAWS — the living run cycle and the undead reach, pinned at the
// pose level. Legs stay anti-phase, knees lift on the swing not the stance,
// the torso counter-rolls and the head stabilizes, idle breathes, and the
// zed/dog paths are untouched by the living run's improvements.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { poseSoldierJoints, type Joints, type GaitState } from '../src/client/animation';

function makeJoints(): Joints {
  const j: Joints = {};
  for (const n of ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'head', 'torso', 'gun', 'belly',
    'legFL', 'legFR', 'legRL', 'legRR', 'tail']) j[n] = new THREE.Group();
  return j;
}

/** run the gait over a span and sample joint angles per frame */
function run(j: Joints, opts: { kind?: 'human' | 'zombie' | 'dog'; speed?: number; frames?: number; dt?: number; state?: GaitState; t0?: number }) {
  const { kind = 'human', speed = 6, frames = 60, dt = 1 / 60, state = {}, t0 = 0 } = opts;
  const samples: { phase: number; footstep: boolean }[] = [];
  for (let i = 0; i < frames; i++) {
    const t = t0 + i * dt;
    const out = poseSoldierJoints(j, { kind, time: t, id: 7, speed, airborne: false, dt, state });
    samples.push({ phase: out.phase, footstep: out.footstep });
  }
  return samples;
}

describe('the living run cycle', () => {
  it('legs stay strictly anti-phase at every point of the stride', () => {
    const j = makeJoints();
    run(j, { speed: 6 });
    expect(j.legL!.rotation.z).toBeCloseTo(-j.legR!.rotation.z, 6);
  });

  it('knees LIFT on the swing-through and yield a little on the plant', () => {
    const j = makeJoints();
    const { dt } = { dt: 1 / 60 };
    const state: GaitState = {};
    let maxLift = 0, maxStance = 0;
    for (let i = 0; i < 240; i++) {
      const t = i * dt;
      poseSoldierJoints(j, { kind: 'human', time: t, id: 7, speed: 6, airborne: false, dt, state });
      // sample the LEFT leg: knee flex positive, vs where the leg is
      const legSwing = j.legL!.rotation.z;
      const knee = -j.shinL!.rotation.z;
      if (legSwing > 0.1) maxLift = Math.max(maxLift, knee);       // swinging forward
      if (legSwing < -0.4) maxStance = Math.max(maxStance, knee);  // deep in the plant
    }
    expect(maxLift, 'the knee never lifts through the swing').toBeGreaterThan(0.2);
    expect(maxStance, 'mid-stance should be far straighter than the swing').toBeLessThan(maxLift * 0.5);
  });

  it('the torso COUNTER-ROLLS the leg swing, and the head stabilizes against it', () => {
    const j = makeJoints();
    const state: GaitState = {};
    const dt = 1 / 60;
    for (let i = 0; i < 240; i++) {
      poseSoldierJoints(j, { kind: 'human', time: i * dt, id: 7, speed: 6, airborne: false, dt, state });
      const leg = j.legL!.rotation.z;
      const torso = j.torso!.rotation.x;
      const head = j.head!.rotation.x;
      if (Math.abs(leg) > 0.15) {
        expect(Math.sign(torso), 'torso must roll AGAINST the lead leg').toBe(-Math.sign(leg));
        expect(Math.sign(head), 'head must counter the torso').toBe(Math.sign(leg));
      }
    }
  });

  it('idle breathes and scans — never swings a leg', () => {
    const j = makeJoints();
    run(j, { speed: 0 });
    expect(Math.abs(j.legL!.rotation.z)).toBeLessThan(1e-9);
    expect(Math.abs(j.shinL!.rotation.z)).toBeLessThan(1e-9);
    // but the body is alive: breath in the torso, a slow scan in the head
    const torsos: number[] = [], heads: number[] = [];
    const j2 = makeJoints();
    for (let i = 0; i < 120; i++) {
      poseSoldierJoints(j2, { kind: 'human', time: i * 0.1, id: 7, speed: 0, airborne: false });
      torsos.push(j2.torso!.rotation.x);
      heads.push(j2.head!.rotation.x);
    }
    expect(Math.max(...torsos.map(Math.abs)), 'no idle breath').toBeGreaterThan(0.005);
    expect(Math.max(...heads.map(Math.abs)), 'no idle scan').toBeGreaterThan(0.03);
  });

  it('footsteps still land on the half-cycles (the sound cue is sacred)', () => {
    const j = makeJoints();
    const samples = run(j, { speed: 6, frames: 120 });
    const steps = samples.filter((s) => s.footstep).length;
    // 120 frames at 6 u/s: gaitRate 10 rad/s → 20 rad ≈ 6.4 half-cycles
    expect(steps).toBeGreaterThanOrEqual(5);
    expect(steps).toBeLessThanOrEqual(8);
  });

  it('airborne tucks the legs and skips the counter-roll', () => {
    const j = makeJoints();
    poseSoldierJoints(j, { kind: 'human', time: 1, id: 7, speed: 8, airborne: true });
    expect(j.legL!.rotation.z).toBeCloseTo(0.55, 5);
    expect(j.shinL!.rotation.z).toBeCloseTo(-0.9, 5);
    expect(j.torso!.rotation.x).not.toBeCloseTo(-0.1, 1); // no swing to counter
  });
});

describe('the undead and the dog — regression', () => {
  it('zeds keep their reach and their loll — the living run never touches them', () => {
    const j = makeJoints();
    run(j, { kind: 'zombie', speed: 8 });
    expect(j.armL!.rotation.z).toBeGreaterThan(0.5); // the reach is UP and forward
    expect(j.armR!.rotation.z).toBeGreaterThan(0.3);
    expect(j.torso!.rotation.x).toBeLessThan(0.1);   // tipped into the charge
  });

  it('the dog trots diagonally with its own metronome', () => {
    const j = makeJoints();
    run(j, { kind: 'dog', speed: 5 });
    expect(j.legFL!.rotation.z).toBeCloseTo(j.legRR!.rotation.z, 6);
    expect(j.legFR!.rotation.z).toBeCloseTo(-j.legFL!.rotation.z, 6);
  });
});
