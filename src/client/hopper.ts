// ---------------------------------------------------------------------------
// THE LIVING HOPPER (Robert's paintball overhaul: "imagine a transparent
// hopper, and you seeing it like slowly come out… especially if it was like
// physics based where you just see a ball drop out of each one").
//
// The marker models (models/weapons.ts buildMarker) ship a see-through shell
// with individually named balls, ordered bottom-first. This module is the
// pulse: every frame it reads the sim's REAL clip count and drives the shell —
// the stack dwindles as you shoot, a feed ball falls through the neck on each
// shot (cheap analytic gravity, no physics engine — determinism law), the
// whole load rattles when the gun cycles, and a reload dumps a fresh pod in
// with the biggest rattle of all. The balls also wear the OWNER's paint color:
// the hopper is identity, same law as the tracer and the splat.
//
// State lives on the gun mesh's userData, so it dies with the mesh on a
// weapon switch and never leaks across rebuilds.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { WEAPONS } from '../sim/data';
import type { Soldier } from '../sim/types';

interface HopperState {
  lastClip: number;
  /** rattle energy 0..1 — every visible ball jiggles by it, decays fast */
  energy: number;
  /** feed-ball drop animation clock; <0 = idle, 0..1 = falling */
  drop: number;
  tint: number;
}

/** Per-frame drive. `gun` is the soldier mesh's cached 'gun' joint; `paint`
 *  is the owner's paint color (undefined outside the yard = keep defaults). */
export function updateHopper(gun: THREE.Object3D, s: Soldier, time: number, dt: number, paint?: number) {
  const spec = gun.userData.hopper as { balls: number; ballR: number; ry: number } | undefined;
  if (!spec) return;

  let st = gun.userData.hopperState as HopperState | undefined;
  if (!st) {
    st = { lastClip: -1, energy: 0, drop: -1, tint: -1 };
    gun.userData.hopperState = st;
    // cache ball handles + rest positions once — getObjectByName per frame
    // is the renderer's cardinal sin
    const balls: THREE.Object3D[] = [];
    for (let i = 0; i < spec.balls; i++) {
      const b = gun.getObjectByName(`pb-ball-${i}`);
      if (!b) return; // not a marker build we know — leave it static
      b.userData.rest = b.position.clone();
      balls.push(b);
    }
    gun.userData.hopperBalls = balls;
    gun.userData.hopperFeed = gun.getObjectByName('pb-feed');
  }
  const balls = gun.userData.hopperBalls as THREE.Object3D[];
  const feed = gun.userData.hopperFeed as THREE.Object3D | undefined;

  // the hopper wears its owner's paint — retint once, not per frame
  if (paint !== undefined && paint !== st.tint) {
    st.tint = paint;
    const mats = gun.userData.hopperMats as { paint?: THREE.MeshStandardMaterial } | undefined;
    mats?.paint?.color.set(paint);
  }

  const def = WEAPONS[s.weapons[s.weaponIdx]];
  const clipMax = def?.clip ?? spec.balls;
  const clip = Math.max(0, s.clip[s.weaponIdx] ?? 0);
  // fill level → how many of the bottom-first balls stand
  const want = clip <= 0 ? 0
    : Math.max(1, Math.min(spec.balls, Math.ceil((clip / clipMax) * spec.balls)));

  if (st.lastClip >= 0 && clip < st.lastClip) {
    // a shot left the barrel: the load shifts, and one ball visibly falls
    // through the feedneck into the body
    st.energy = Math.min(1, st.energy + 0.45);
    st.drop = 0;
  } else if (st.lastClip >= 0 && clip > st.lastClip) {
    // reload: a fresh pod dumped in — the whole shell rattles
    st.energy = 1;
  }
  st.lastClip = clip;

  // the rattle dies quickly — a settled hopper sits still
  st.energy *= Math.exp(-3.2 * dt);
  const amp = spec.ballR * 0.5 * st.energy;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    b.visible = i < want;
    if (!b.visible) continue;
    const rest = b.userData.rest as THREE.Vector3;
    if (amp > 0.0004) {
      // deterministic per-ball phase — reads as loose balls, costs a sine
      b.position.set(
        rest.x + Math.sin(time * 31 + i * 2.1) * amp,
        rest.y + Math.abs(Math.sin(time * 26 + i * 1.3)) * amp * 1.4,
        rest.z + Math.sin(time * 29 + i * 3.7) * amp,
      );
    } else b.position.copy(rest);
  }

  // the feed ball: analytic free-fall from the shell floor through the neck
  if (feed && st.drop >= 0) {
    st.drop += dt * 5.5;
    if (st.drop >= 1) {
      st.drop = -1;
      feed.visible = false;
    } else {
      feed.visible = true;
      const base = spec.ry;
      // t² — it FALLS, it doesn't slide
      feed.position.y = (feed.userData.restY ??= feed.position.y) - st.drop * st.drop * (base * 1.9);
      const shrink = 1 - st.drop * 0.35; // swallowed by the body
      feed.scale.setScalar(shrink);
    }
  }
}
