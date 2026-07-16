// ---------------------------------------------------------------------------
// The Proving Grounds (§3.3) + the Wall (18B): dummies stand and stay down,
// the course clocks the run, scoring and grades hold their curve.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { COURSE_TARGETS, RangeCourse, gradeFor, percentileOn, scoreRun } from '../src/client/range';
import { freshDossier } from '../src/client/record';
import { World } from '../src/sim/world';

describe('the Proving Grounds', () => {
  it('score curve and grades hold', () => {
    expect(scoreRun(5)).toBe(100);
    expect(scoreRun(6)).toBe(100);
    expect(scoreRun(12)).toBe(76);
    expect(scoreRun(31)).toBe(0);
    expect(gradeFor(95)).toBe('Expert');
    expect(gradeFor(80)).toBe('Sharpshooter');
    expect(gradeFor(60)).toBe('Marksman');
    expect(gradeFor(30)).toBe('Qualified');
  });

  it('percentile ranks against OFFICIAL entries only', () => {
    const wall = [
      { callsign: 'A', score: 90, elapsed: 8, official: true, at: 1 },
      { callsign: 'B', score: 60, elapsed: 16, official: true, at: 1 },
      { callsign: 'C', score: 99, elapsed: 6, official: false, at: 1 }, // practice — invisible to rank
    ];
    expect(percentileOn(wall, 95)).toBe(100);
    expect(percentileOn(wall, 70)).toBe(50);
    expect(percentileOn([], 50)).toBe(100); // first on the Wall stands alone
  });

  it('dummies stand, take fire, and STAY down; the course clocks the run', () => {
    const w = new World({ seed: 12, mode: 'range' });
    expect(w.mode.timeLeft).toBe(Infinity);
    const me = w.addSoldier('Shooter', 'infantry', 0, 'human');
    const said: string[] = [];
    const course = new RangeCourse(false, 'Shooter', null, (t) => said.push(t));
    course.begin(w, me.id);
    const dummies = [...w.soldiers.values()].filter((s) => s.dummy);
    expect(dummies.length).toBe(COURSE_TARGETS);

    // countdown runs on real steps
    for (let i = 0; i < 60 * 3.2; i++) { w.step(1 / 60, new Map()); course.update(w, 1 / 60); }
    expect(course.phase).toBe('live');

    // dummies do not act: step a while, nobody fired, nobody moved
    const before = dummies.map((d) => ({ x: d.pos.x, z: d.pos.z }));
    for (let i = 0; i < 60; i++) w.step(1 / 60, new Map());
    expect(w.projectiles.size).toBe(0);
    dummies.forEach((d, i) => {
      expect(d.pos.x).toBeCloseTo(before[i].x, 5);
      expect(d.pos.z).toBeCloseTo(before[i].z, 5);
    });

    // drop all six — course completes with a score; the dead stay dead
    for (const d of dummies) w.damageSoldier(d, 999, me.id, 'rifle');
    for (let i = 0; i < 10; i++) { w.step(1 / 60, new Map()); course.update(w, 1 / 60); }
    expect(course.phase).toBe('done');
    expect(course.score).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 5; i++) w.step(1 / 60, new Map());
    expect([...w.soldiers.values()].filter((s) => s.dummy && s.alive).length).toBe(0);
  });

  it('the OFFICIAL run writes the qualification once, forever (18B)', () => {
    const w = new World({ seed: 12, mode: 'range' });
    const me = w.addSoldier('OneShot', 'infantry', 0, 'human');
    const d = freshDossier('OneShot');
    const course = new RangeCourse(true, 'OneShot', d, () => {});
    course.begin(w, me.id);
    for (let i = 0; i < 60 * 3.2; i++) { w.step(1 / 60, new Map()); course.update(w, 1 / 60); }
    for (const s of [...w.soldiers.values()].filter((x) => x.dummy)) w.damageSoldier(s, 999, me.id, 'rifle');
    for (let i = 0; i < 5; i++) { w.step(1 / 60, new Map()); course.update(w, 1 / 60); }
    expect(course.phase).toBe('done');
    const q = d.quals.infantry!;
    expect(q).toBeDefined();
    expect(q.score).toBe(course.score);
    expect(q.grade).toBe(gradeFor(course.score));
    expect(q.percentile).toBeGreaterThan(0);
    expect(d.soldier.rankPoints).toBe(course.score); // qualification pays its citation
  });
});
