// ---------------------------------------------------------------------------
// THE FEEL-PASS LAWS — the spring, the holds, the throw, the flights, and
// the cast schools, pinned so the feel can't quietly regress.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  CAST_SCHOOL, FLIGHT_POSES, RECOIL_SCALE, stepYawSpring, throwArmCurve, WEAPON_HOLDS,
} from '../src/client/animation';
import { LSWS } from '../src/sim/lsw';

describe('THE TURN (the yaw spring)', () => {
  it('never teleports: a hard 180° flip takes real frames to cover', () => {
    const st = { v: 0 };
    const dt = 1 / 60;
    let covered = 0, frames = 0;
    while (Math.abs(covered) < Math.PI * 0.9 && frames < 240) {
      stepYawSpring(st, Math.PI, dt, true);
      covered = st.v;
      frames++;
    }
    expect(frames, 'the flip covered too fast — the snap is back').toBeGreaterThan(4);
    expect(frames, 'the flip takes forever — the spring is mush').toBeLessThan(60);
  });

  it('the residual diff (what the head leads with) starts big and decays', () => {
    const st = { v: 0 };
    const dt = 1 / 60;
    const d0 = stepYawSpring(st, Math.PI / 2, dt, false);
    for (let i = 0; i < 40; i++) stepYawSpring(st, Math.PI / 2, dt, false);
    const d1 = stepYawSpring(st, Math.PI / 2, dt, false);
    expect(Math.abs(d0)).toBeGreaterThan(1.0);
    expect(Math.abs(d1)).toBeLessThan(Math.abs(d0) * 0.2);
  });

  it('wraps the short way around (never turns 350° to go 10°)', () => {
    const st = { v: 0.05 };
    const diff = stepYawSpring(st, -0.05, 1 / 60, true);
    expect(Math.abs(diff)).toBeLessThan(0.2);
  });
});

describe('the hold library', () => {
  it('each family holds differently from the rifle baseline', () => {
    const base = WEAPON_HOLDS.rifle;
    for (const fam of ['pistol', 'shotgun', 'slugger', 'hmg', 'at_rocket']) {
      const h = WEAPON_HOLDS[fam];
      const differs = h.armL !== base.armL || h.armR !== base.armR ||
        h.gunY !== base.gunY || h.gunZ !== base.gunZ || h.gunRotZ !== base.gunRotZ;
      expect(differs, `${fam} holds exactly like the rifle — the silhouette lies`).toBe(true);
    }
  });

  it('the melee row hides the gun (unarmed arms swing free)', () => {
    expect(WEAPON_HOLDS.melee.hideGun).toBe(true);
  });

  it('rocket families shoulder the tube (gun sits up and inboard)', () => {
    expect(WEAPON_HOLDS.at_rocket.gunY).toBeGreaterThan(0.15);
    expect(WEAPON_HOLDS.at_rocket.gunZ).toBeLessThan(0);
  });
});

describe('the grenade throw curve', () => {
  it('winds back, whips past vertical with overshoot, and settles to rest', () => {
    expect(throwArmCurve(0.2)).toBeLessThan(0);                    // wound back
    const peak = Math.max(...[0.5, 0.55, 0.6, 0.65, 0.7, 0.75].map(throwArmCurve));
    expect(peak, 'the whip never passes the shoulder').toBeGreaterThan(1.5);
    expect(Math.abs(throwArmCurve(1)), 'the arm never comes home').toBeLessThan(0.05);
  });
});

describe('the flight silhouettes', () => {
  it('each flier reads different from the other two', () => {
    const a = FLIGHT_POSES.inferno, b = FLIGHT_POSES.stormcaller, c = FLIGHT_POSES.gargoyle;
    expect(a.pitch).not.toBeCloseTo(b.pitch, 2);
    expect(a.armZ).not.toBeCloseTo(b.armZ, 2);
    expect(b.armZ).not.toBeCloseTo(c.armZ, 2);
    expect(c.armX).toBeGreaterThan(0); // only the gargoyle folds its wings
  });

  it('the shriek dive is steeper than the cruise', () => {
    expect(FLIGHT_POSES.gargoyle_dive.pitch).toBeLessThan(FLIGHT_POSES.gargoyle.pitch);
  });
});

describe('the cast schools', () => {
  it('every school from the brief exists', () => {
    for (const id of ['titan', 'crusher', 'tremor', 'ragebeast', 'leviathan', 'cataclysm', 'gargoyle', 'vanguard']) {
      expect(CAST_SCHOOL[id], `${id} should SLAM`).toBe('slam');
    }
    for (const id of ['frostbite', 'reactor', 'crimson', 'magnetar', 'eclipse', 'chronos', 'wraith', 'dominator']) {
      expect(CAST_SCHOOL[id], `${id} should CHANNEL`).toBe('channel');
    }
  });

  it('every roster unit resolves to a school (THRUST is the floor)', () => {
    for (const id of Object.keys(LSWS)) {
      expect(CAST_SCHOOL[id] ?? 'thrust').toMatch(/slam|thrust|channel/);
    }
  });
});

describe('the recoil personality', () => {
  it('the slugger out-shoves everything, the smg barely shrugs', () => {
    expect(RECOIL_SCALE.slugger.kick).toBeGreaterThan(RECOIL_SCALE.shotgun.kick);
    expect(RECOIL_SCALE.shotgun.kick).toBeGreaterThan(RECOIL_SCALE.rifle.kick);
    expect(RECOIL_SCALE.smg.kick).toBeLessThan(RECOIL_SCALE.rifle.kick);
    expect(RECOIL_SCALE.slugger.recover).toBeGreaterThan(RECOIL_SCALE.rifle.recover * 3);
  });
});
