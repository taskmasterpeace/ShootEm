// ---------------------------------------------------------------------------
// THE SCHOOLS (Robert: "create the certification programs… don't stop until
// you have programs that help new players use any of the vehicles"). A course
// is a chain of DRILLS; each drill lays its own gates and carries a lesson in
// one line. The laws: every teachable licence has a program, every drill
// teaches something, the layout is deterministic and reachable, and the
// ladder is honoured — you cannot enrol on the bomber first.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it } from 'vitest';
import { COURSES, allCourses, courseFor, layCourse } from '../src/sim/courses';
import { VEHICLES } from '../src/sim/data';
import { LICENCES, licenceFor, type LicenceId } from '../src/sim/licenses';
import { awardLicence, canEnrol, holdsLicence, licenceStorage, loadLicences } from '../src/client/licences';

let mem: string | null = null;
beforeEach(() => {
  mem = null;
  licenceStorage.get = () => mem;
  licenceStorage.set = (v: string) => { mem = v; };
});

describe('the programs', () => {
  it('every licence a player can earn has a course to earn it on', () => {
    const teachable = (Object.keys(LICENCES) as LicenceId[]).filter((id) => id !== 'none');
    for (const id of teachable) {
      expect(courseFor(id), `${LICENCES[id].name} has no program`).toBeTruthy();
    }
  });

  it('a course trains you on a hull that course actually licenses', () => {
    for (const c of allCourses()) {
      expect(VEHICLES[c.hull], `${c.name} trains on a hull that does not exist`).toBeTruthy();
      const need = licenceFor(c.hull);
      // you train on the machine the paper covers — or on something simpler
      // that needs no paper at all (a board, a bike)
      expect(need === c.licence || need === 'none' || need === 'basic_driver',
        `${c.name} trains on the ${c.hull}, which needs ${need}`).toBe(true);
    }
  });

  it('every drill TEACHES — a lesson, in a sentence, in the school voice', () => {
    for (const c of allCourses()) {
      expect(c.drills.length, `${c.name} has no drills`).toBeGreaterThanOrEqual(3);
      expect(c.brief.length).toBeGreaterThan(30);
      for (const d of c.drills) {
        expect(d.lesson.length, `${c.name}/${d.name} has no lesson`).toBeGreaterThan(25);
        expect(d.name.length).toBeGreaterThan(2);
      }
      expect(c.par).toBeGreaterThan(60); // generous: a school, not a time trial
    }
  });

  it('the layout is deterministic, ordered, and every gate is reachable', () => {
    for (const c of allCourses()) {
      const a = layCourse(c);
      const b = layCourse(c);
      expect(a).toEqual(b); // same course, same course, every boot
      expect(a.length).toBeGreaterThanOrEqual(c.drills.length * 2);
      // gates carry their drill index, in non-decreasing order — the HUD
      // reads the lesson off this and must never jump backwards
      let last = -1;
      for (const g of a) {
        expect(g.drill).toBeGreaterThanOrEqual(last);
        last = g.drill;
        expect(g.radius).toBeGreaterThan(1.5);
      }
      // no impossible leap between consecutive gates
      for (let i = 1; i < a.length; i++) {
        const d = Math.hypot(a[i].pos.x - a[i - 1].pos.x, a[i].pos.z - a[i - 1].pos.z);
        expect(d, `${c.name} gate ${i} is ${d.toFixed(0)}u from the last`).toBeLessThan(85);
      }
    }
  });
});

describe('the papers', () => {
  it('a new account holds nothing and may only enrol at the bottom', () => {
    expect(loadLicences().held).toEqual([]);
    expect(canEnrol('basic_driver')).toBe(true);
    expect(canEnrol('boat'), 'the naval yard takes anyone').toBe(true);
    expect(canEnrol('tank'), 'nobody drives a tank on day one').toBe(false);
    expect(canEnrol('bomber')).toBe(false);
  });

  it('passing a course signs the whole chain beneath it', () => {
    awardLicence('apc');
    const held = loadLicences().held;
    expect(held).toContain('basic_driver');
    expect(held).toContain('heavy_truck');
    expect(held).toContain('apc');
    expect(holdsLicence('tank'), 'the chain stops at what you passed').toBe(false);
    expect(canEnrol('tank'), 'and the next rung is now open').toBe(true);
  });

  it('your best time is kept, and only improves', () => {
    awardLicence('basic_driver', 120);
    expect(loadLicences().best.basic_driver).toBe(120);
    awardLicence('basic_driver', 96);
    expect(loadLicences().best.basic_driver).toBe(96);
    awardLicence('basic_driver', 140);
    expect(loadLicences().best.basic_driver, 'a slower run never overwrites').toBe(96);
  });

  it('the twelve courses cover the whole fleet — every hull is teachable', () => {
    const licences = new Set(Object.keys(COURSES));
    for (const kind of Object.keys(VEHICLES)) {
      const need = licenceFor(kind as never);
      if (need === 'none') continue;
      expect(licences.has(need), `nothing teaches ${need} (needed by ${kind})`).toBe(true);
    }
  });
});
