// ---------------------------------------------------------------------------
// THE 8 MASTER STATS (#127 — docs/THREE-GAMES-ONE-WAR.md, Robert's canon
// roster, re-affirmed 2026-07-23). POWER · AGILITY · WEAPON HANDLING ·
// PILOTING · ENGINEERING · LEADERSHIP · SCIENCE · CHARISMA. Never a hidden
// aim-roll. The shipped visceral three re-mapped: STR→POWER (melee + frame),
// DEX→HANDLING (reload), AGL→AGILITY (dash recovery) — and the original
// hash constants stayed on that trio, so every bot's numbers survived the
// rename byte-identical. 5 = today's exact numbers (the legacy suite is the
// proof); the band caps near ±10%.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { WEAPONS } from '../src/sim/data';
import { lswsForTeam } from '../src/sim/lsw';
import { hash01 } from '../src/sim/rng';
import { World } from '../src/sim/world';
import type { SoldierStats } from '../src/sim/types';

const world = () => new World({ seed: 21, mode: 'tdm' });
const flat = (v: number): SoldierStats => ({
  power: v, agility: v, handling: v, piloting: v,
  engineering: v, leadership: v, science: v, charisma: v,
});

describe('the 8 master stats — the canon roster', () => {
  it('every print carries EXACTLY the canon eight — no more visceral three', () => {
    const w = world();
    const s = w.addSoldier('Canon', 'infantry', 0, 'human');
    expect(Object.keys(s.stats!).sort()).toEqual([
      'agility', 'charisma', 'engineering', 'handling',
      'leadership', 'piloting', 'power', 'science',
    ]);
    // the old names are DEAD — a stale reader must get undefined, never a number
    expect((s.stats as unknown as Record<string, unknown>).str).toBeUndefined();
    expect((s.stats as unknown as Record<string, unknown>).dex).toBeUndefined();
    expect((s.stats as unknown as Record<string, unknown>).agl).toBeUndefined();
  });

  it('neutral 5s change NOTHING — todays numbers are stat-5 numbers', () => {
    const w = world();
    const s = w.addSoldier('Neutral', 'infantry', 0, 'human');
    expect(s.stats).toEqual(flat(5));
    expect(w.statMul(5)).toBe(1);
    expect(w.statQuick(5)).toBe(1);
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBe(WEAPONS[s.weapons[0]].reloadTime);
  });

  it('WEAPON HANDLING owns the hands: 10 reloads a tenth faster, 1 a tenth slower', () => {
    const w = world();
    const s = w.addSoldier('Hands', 'infantry', 0, 'human');
    const base = WEAPONS[s.weapons[0]].reloadTime;
    s.stats = { ...flat(5), handling: 10 };
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBeCloseTo(base * 0.9, 5);
    s.stats = { ...flat(5), handling: 1 };
    expect(w.reloadTimeFor(s, WEAPONS[s.weapons[0]])).toBeCloseTo(base * 1.08, 5);
  });

  it('POWER carries the frame: spawn health follows it around todays average', () => {
    const w = world();
    const strong = w.addSoldier('Ox', 'infantry', 0, 'human');
    strong.stats = { ...flat(5), power: 10 };
    w.spawn(strong);
    const weak = w.addSoldier('Reed', 'infantry', 0, 'human');
    weak.stats = { ...flat(5), power: 1 };
    w.spawn(weak);
    const base = w.addSoldier('Avg', 'infantry', 0, 'human');
    w.spawn(base);
    expect(strong.maxHp).toBe(Math.round(base.maxHp * 1.1));
    expect(weak.maxHp).toBe(Math.round(base.maxHp * 0.92));
  });

  it('bots roll all eight 3..7 from the seed — stable across identical worlds, rng untouched', () => {
    const a = world();
    const b = world();
    const botsA = [1, 2, 3].map(() => a.addSoldier('P', 'infantry', 1, 'bot').stats);
    const botsB = [1, 2, 3].map(() => b.addSoldier('P', 'infantry', 1, 'bot').stats);
    expect(botsA).toEqual(botsB); // same seed, same people
    for (const st of botsA) {
      expect(Object.keys(st!)).toHaveLength(8);
      for (const v of Object.values(st!)) {
        expect(v).toBeGreaterThanOrEqual(3);
        expect(v).toBeLessThanOrEqual(7);
      }
    }
    // and the streams stayed in lockstep — the stat roll drew NOTHING from
    // the rng (bots draw for loadouts as they always did; identical worlds
    // must agree on the very next number)
    expect(a.rng.next()).toBeCloseTo(b.rng.next(), 12);
  });

  it('the rename never moved a bot: power/handling/agility ride the ORIGINAL hash constants', () => {
    // the visceral three rolled 31.7/57.3/91.1 — the canon trio must land on
    // the exact same numbers for the same seed+id, or every replay drifts
    const w = world();
    const bot = w.addSoldier('P', 'infantry', 1, 'bot');
    expect(bot.stats!.power).toBe(3 + Math.floor(hash01(21 + bot.id * 31.7) * 5));
    expect(bot.stats!.handling).toBe(3 + Math.floor(hash01(21 + bot.id * 57.3) * 5));
    expect(bot.stats!.agility).toBe(3 + Math.floor(hash01(21 + bot.id * 91.1) * 5));
  });

  it('the beasts carry no stats and pay nothing', () => {
    const w = world();
    const z = w.addSoldier('Shambler', 'infantry', 1, 'zombie');
    expect(z.stats).toBeUndefined();
    expect(w.statMul(undefined)).toBe(1);
  });
});

describe('the capture (#127) — the fallen god is a prize', () => {
  it('an enemy at the carcass channels the DNA out in ~3 seconds', () => {
    const w = new World({ seed: 31, mode: 'tdm' });
    const god = w.addSoldier('Vessel', 'infantry', 1, 'human');
    w.spawn(god);
    const asc = lswsForTeam(1)[0]; // a god from the side's OWN stable
    expect(w.ascendSoldier(god, asc)).toBe(true);
    const harvester = w.addSoldier('Jackal', 'infantry', 0, 'human');
    w.spawn(harvester);
    // the god falls with the jackal standing over the body. Fresh spawns are
    // untouchable (55B) — the test strips the shield; and some gods cheat
    // death once (chronos rewinds), so the war hits until they stay down.
    harvester.pos = { ...god.pos };
    god.protectedUntil = 0;
    for (let hit = 0; hit < 4 && god.alive; hit++) w.damageSoldier(god, 999999, harvester.id, 'rifle_kuchler_1');
    expect(god.alive).toBe(false);
    expect(w.godCarcasses.length).toBe(1);
    let dna = false;
    for (let i = 0; i < 4 * 30 && !dna; i++) {
      harvester.pos = { ...w.godCarcasses[0]?.pos ?? harvester.pos };
      w.step(1 / 30, new Map());
      dna = w.takeEvents().some((e) => e.type === 'dna' && e.text === asc);
    }
    expect(dna).toBe(true);
    expect(w.godCarcasses.length).toBe(0);
  });

  it('an unharvested carcass expires — the prize is not forever', () => {
    const w = new World({ seed: 32, mode: 'tdm' });
    const god = w.addSoldier('Vessel', 'infantry', 1, 'human');
    w.spawn(god);
    expect(w.ascendSoldier(god, lswsForTeam(1)[0])).toBe(true);
    god.pos = { x: 60, y: 0, z: 60 }; // far from everyone
    god.protectedUntil = 0; // strip the 55B spawn shield — this is an execution
    for (let hit = 0; hit < 4 && god.alive; hit++) w.damageSoldier(god, 999999, -1, 'rifle_kuchler_1');
    expect(god.alive).toBe(false);
    expect(w.godCarcasses.length).toBe(1);
    for (let i = 0; i < 31 * 30; i++) w.step(1 / 30, new Map());
    expect(w.godCarcasses.length).toBe(0);
    expect(w.takeEvents().some((e) => e.type === 'dna')).toBe(false);
  });
});
