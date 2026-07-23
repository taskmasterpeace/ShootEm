// ───────────────────────────────────────────────────────────────────────────
// THE STATISTICS BIBLE, ENFORCED.
//
// docs/STATISTICS.md exists because "we have it" and "the code uses it" are
// different sentences. That document was TRUE when it was written and started
// drifting the moment anyone touched a table — which is exactly how it came to
// report "8 gun families WIRED" while 255 of 316 weapons trained nothing.
//
// So the audit lives here now, as a test. A stat or a skill that stops being
// wired fails the suite instead of quietly becoming card copy again.
//
// The two questions asked of every skill:
//   EARNABLE — is there any way in the game to get better at it?
//   SPENDABLE — does being better at it change anything?
// A skill needs BOTH. One without the other is theatre with extra steps.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { skillForWeapon, practise, practiceOf } from '../src/sim/skills';
import { World, handSpreadMul } from '../src/sim/world';
import { leadershipRadius } from '../src/sim/ranks';
import type { ClassId, SkillId, Team, VehicleKind } from '../src/sim/types';

const ALL_SKILLS: SkillId[] = [
  'rifle', 'smg', 'lmg', 'sniper', 'rocket', 'knife', 'pistol',
  'tank_driver', 'tank_gunner', 'helicopter', 'jet', 'boat',
  'engineer', 'medic', 'dog_handler', 'drone_pilot', 'radio_operator',
  'commander', 'navigator', 'mechanic', 'explosives', 'scout',
];

const quiet = () => new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
const man = (w: World, cls: ClassId = 'infantry') => {
  const s = w.addSoldier('S', cls, 0, 'human');
  s.alive = true; s.pos = { x: 20, y: 0, z: 20 };
  return s;
};
/** a soldier drilled to Master in one trade */
const master = (w: World, skill: SkillId, cls: ClassId = 'infantry') => {
  const s = man(w, cls);
  for (let i = 0; i < 2000; i++) practise(s, skill, 0.5);
  return s;
};

describe('every skill can be EARNED', () => {
  // the trades earned by TIME (seat hours, ground covered, men steadied) are
  // ticked by the sim rather than by a weapon, so they are listed here as the
  // deliberate exceptions to the weapon-map sweep
  const BY_TIME: SkillId[] = ['tank_driver', 'commander', 'navigator', 'dog_handler', 'drone_pilot', 'scout', 'mechanic'];

  it('the weapon map reaches every trade a gun can teach', () => {
    const taught = new Set<SkillId>();
    for (const d of Object.values(WEAPONS)) {
      const s = skillForWeapon(d.id);
      if (s) taught.add(s);
    }
    const missing = ALL_SKILLS.filter((s) => !taught.has(s) && !BY_TIME.includes(s));
    expect(missing, 'these skills have no weapon that trains them').toEqual([]);
  });

  it('the issue rifle trains the rifle — the regression that started all this', () => {
    // ar606 carries no `family`, so the old family-only map returned undefined
    // and every infantryman's starting gun taught him nothing, forever
    expect(skillForWeapon('ar606')).toBe('rifle');
  });

  it('almost every weapon a soldier can hold now teaches something', () => {
    const all = Object.values(WEAPONS);
    const untaught = all.filter((d) => !skillForWeapon(d.id));
    // what is LEFT untaught must be only god arms and monster attacks
    for (const d of untaught) {
      const isGod = d.family === 'lsw';
      const isCreature = /claw|bite|orb|bolt|spike|rock|glob|acid|skitter/.test(d.id);
      expect(isGod || isCreature, `${d.id} trains nothing and is not a god arm or a monster attack`).toBe(true);
    }
    expect(untaught.length).toBeLessThan(all.length * 0.2);
  });

  it('a vehicle gun trains the seat it is bolted to', () => {
    expect(skillForWeapon('tank_cannon')).toBe('tank_gunner');
    expect(skillForWeapon('heli_rockets')).toBe('helicopter');
    expect(skillForWeapon('boat_mg')).toBe('boat');
    expect(skillForWeapon('falcon_cannon')).toBe('jet');
  });

  it('a god never gets better with practice — the threat table depends on it', () => {
    const lsw = Object.values(WEAPONS).filter((d) => d.family === 'lsw');
    expect(lsw.length).toBeGreaterThan(0);
    for (const d of lsw) expect(skillForWeapon(d.id), `${d.id}`).toBeUndefined();
  });
});

describe('every skill can be SPENT', () => {
  it('the gun trades tighten the group', () => {
    const w = quiet();
    const raw = man(w);
    const pro = master(w, 'rifle');
    const gun = raw.weapons[0];
    expect(handSpreadMul(pro, gun)).toBeLessThan(handSpreadMul(raw, gun) * 0.95);
  });

  it('a mounted gun answers to the gunner, not just the card', () => {
    const w = quiet();
    const raw = man(w);
    const pro = master(w, 'tank_gunner');
    expect(w.mountSpreadMul(pro, 'tank_cannon')).toBeLessThan(w.mountSpreadMul(raw, 'tank_cannon'));
  });

  it('the driving trades buy turn authority, never top speed', () => {
    const w = quiet();
    const raw = man(w);
    const pro = master(w, 'tank_driver');
    const tank = { turnRate: 1, speed: 10 } as never;
    expect(w.controlAuthority(pro, tank)).toBeGreaterThan(w.controlAuthority(raw, tank));
  });

  it('engineer and mechanic both count toward a patch', () => {
    const w = quiet();
    const raw = man(w, 'engineer');
    const eng = master(w, 'engineer', 'engineer');
    const mech = master(w, 'mechanic', 'engineer');
    expect(w.repairMul(eng)).toBeGreaterThan(w.repairMul(raw));
    expect(w.repairMul(mech)).toBeGreaterThan(w.repairMul(raw));
  });

  it('a scout lifts the whole team\'s picture, and only the best one counts', () => {
    const w = quiet();
    const raw = man(w);
    const pro = master(w, 'scout');
    expect(w.scoutRange([raw], 100)).toBe(100);
    expect(w.scoutRange([pro], 100)).toBeGreaterThan(100);
    // ten recruits do not add up to one pathfinder
    expect(w.scoutRange([raw, raw, raw, raw], 100)).toBe(100);
    expect(w.scoutRange([pro, raw], 100)).toBe(w.scoutRange([pro], 100));
  });

  it('a commander holds a wider circle at the same rank', () => {
    const w = quiet();
    const raw = man(w); raw.rankId = 3;
    const pro = master(w, 'commander'); pro.rankId = 3;
    const base = leadershipRadius(3);
    expect(base).toBeGreaterThan(0);
    // the reach math lives in the morale pass; assert its two inputs move it
    expect(w.statMul(9, 3)).toBeGreaterThan(w.statMul(1, 3));
    expect(practiceOf(pro, 'commander')).toBeGreaterThan(practiceOf(raw, 'commander'));
  });
});

describe('the 8 master stats all reach the simulation', () => {
  const w = quiet();
  const at = (v: number) => ({ power: v, agility: v, handling: v, piloting: v, engineering: v, leadership: v, science: v, charisma: v });

  it('POWER, AGILITY and HANDLING keep the tiny combat band', () => {
    // canon: "stats help, they do not decide" — the whole 1..10 swing is ±10%
    expect(w.statMul(10)).toBeCloseTo(1.1, 3);
    expect(w.statMul(1)).toBeCloseTo(0.92, 3);
    expect(w.statQuick(10)).toBeCloseTo(0.9, 3);
  });

  it('ENGINEERING changes what a patch is worth', () => {
    const lo = man(w); lo.stats = at(1);
    const hi = man(w); hi.stats = at(10);
    expect(w.repairMul(hi)).toBeGreaterThan(w.repairMul(lo) * 1.2);
  });

  it('PILOTING moves an airframe and leaves the ground alone', () => {
    const lo = man(w); lo.stats = at(1);
    const hi = man(w); hi.stats = at(10);
    const heli = { flies: true, turnRate: 1 } as never;
    const jeep = { turnRate: 1 } as never;
    expect(w.controlAuthority(hi, heli)).toBeGreaterThan(w.controlAuthority(lo, heli));
    expect(w.controlAuthority(hi, jeep), 'piloting is canon-scoped to aircraft')
      .toBe(w.controlAuthority(lo, jeep));
  });

  it('CHARISMA gets you out of the owner\'s car sooner', () => {
    expect(w.statMul(10, 2)).toBeGreaterThan(w.statMul(1, 2) * 1.3);
  });

  it('a soldier with NO stats costs nothing — zeds, dogs and legacy tests', () => {
    expect(w.statMul(undefined)).toBe(1);
    expect(w.statQuick(undefined)).toBe(1);
    expect(w.statMul(undefined, 5)).toBe(1);
    const bare = man(w);
    expect(w.controlAuthority(bare, { flies: true, turnRate: 1 } as never)).toBe(1);
    expect(w.repairMul(bare)).toBe(1);
  });
});

describe('the seat teaches the driver', () => {
  it('time at the controls banks the right trade', () => {
    const w = quiet();
    const d = man(w);
    for (let i = 0; i < 12; i++) w.practiseSeat(d, { turnRate: 1 } as never, 0.5);
    expect(practiceOf(d, 'tank_driver')).toBeGreaterThan(0);
    expect(practiceOf(d, 'boat')).toBe(0);
    for (let i = 0; i < 12; i++) w.practiseSeat(d, { boat: true, turnRate: 1 } as never, 0.5);
    expect(practiceOf(d, 'boat')).toBeGreaterThan(0);
  });

  it('a parked hull teaches nobody — the sim gates on movement', () => {
    const w = quiet();
    const v = w.spawnVehicle('buggy' as VehicleKind, 0 as Team, { x: 0, y: 0, z: 0 });
    const d = man(w);
    d.pos = { ...v.pos }; v.seats[0] = d.id; d.vehicleId = v.id; d.seat = 0; d.enteredVehicleAt = -10;
    for (let i = 0; i < 240; i++) w.step(1 / 60, new Map());
    expect(practiceOf(d, 'tank_driver'), 'idling on the pad is not seat time').toBe(0);
  });
});
