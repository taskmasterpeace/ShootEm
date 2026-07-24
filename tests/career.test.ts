// ───────────────────────────────────────────────────────────────────────────
// THE CAREER — the sheet between deployments.
//
// The audit that produced this found the stats system was wired to a soldier
// who forgot everything, and the two facts were measurable:
//
//   THE PLAYER HAD NO STATS   — every human was hardcoded to a flat 5, and
//                               statMul(5)/statQuick(5) are EXACTLY 1.000 at
//                               every strength, so all nine hooks multiplied
//                               by one for the person actually playing.
//   THE PLAYER HAD NO MEMORY  — practice was copied in from the hometown at
//                               spawn and dropped on the floor at the whistle.
//
// This suite is the guard on both, plus the three laws the ledger has to keep:
// the BADGE is safe from rust, the BIRTHRIGHT is not a reputation, and a GOD
// neither trains nor rusts.
// ───────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import {
  BAND_LABEL, bankDeploy, careerBands, careerSkills, careerStats,
  deployDeltaHtml, rustingTrades,
} from '../src/client/career';
import { freshDossier, migrateDossier, type Dossier } from '../src/client/record';
import { BANDS, RUST_GRACE, isTrainable, rust, skillLevel } from '../src/sim/skills';
import { World } from '../src/sim/world';
import type { SkillId } from '../src/sim/types';

const HOME = { rifle: 30, scout: 30 };
/** run one deploy: seed the sim the way main.ts does, then bank the result */
function deploy(d: Dossier, sheet: Partial<Record<SkillId, number>>, home = HOME) {
  const seed = careerSkills(d, home);
  return { seed, delta: bankDeploy(d, { ...seed, ...sheet }, seed) };
}

describe('the sheet survives the whistle', () => {
  it('a trade banked in one deploy is handed back to the next', () => {
    const d = freshDossier('Doc');
    deploy(d, { rifle: 140 });
    const next = careerSkills(d, HOME);
    expect(next?.rifle, 'the career carries it in').toBe(140);
  });

  it('the hometown grant is a FLOOR you can never fall below', () => {
    const d = freshDossier('Doc');
    // never touch scout for a very long time
    for (let i = 0; i < 30; i++) deploy(d, { rifle: 100 + i });
    expect(careerSkills(d, HOME)?.scout, 'the town keeps its promise').toBe(30);
  });

  it('carrying the floor is not the same as USING it — no sawtooth', () => {
    // measured the wrong way first: careerSkills floors every trade at the
    // hometown grant, so a rusted trade came back at 30, read as "used",
    // cleared its idle counter and rusted again — forever
    const d = freshDossier('Doc');
    for (let i = 0; i < 12; i++) deploy(d, { rifle: 100 + i });
    const scoutLedger = d.lifetime.trades.scout;
    expect(scoutLedger, 'an untouched trade never enters the ledger at all').toBeUndefined();
  });

  it('a fresh career hands the sim nothing but its hometown', () => {
    expect(careerSkills(freshDossier('Doc'), HOME)).toEqual(HOME);
    expect(careerSkills(null, HOME)).toEqual(HOME);
  });
});

describe('rust — the badge is safe, the momentum is not', () => {
  it('grace: a trade you skip for a deploy or two is untouched', () => {
    const d = freshDossier('Doc');
    deploy(d, { rifle: 300, medic: 300 });
    for (let i = 0; i < RUST_GRACE - 1; i++) deploy(d, { rifle: 400 + i });
    expect(d.lifetime.trades.medic!.practice, 'still whole inside the grace period').toBe(300);
  });

  it('a proved band is NEVER revoked — rust stops at the floor forever', () => {
    const d = freshDossier('Doc');
    deploy(d, { rifle: 700 });                       // deep EXPERT
    const proved = skillLevel(700);
    for (let i = 0; i < 60; i++) deploy(d, { medic: 10 + i });  // ignore rifle for a career
    const t = d.lifetime.trades.rifle!;
    expect(t.peak, 'the high-water mark never falls').toBe(700);
    expect(t.practice, 'it rests exactly on the band floor').toBe(BANDS[proved]);
    expect(skillLevel(t.practice), 'still EXPERT after sixty idle deploys').toBe(proved);
  });

  it('rust() itself is pure and monotonic — more idle is never less loss', () => {
    let last = 900;
    for (let idle = 0; idle < 40; idle++) {
      const v = rust(900, 900, idle);
      expect(v).toBeLessThanOrEqual(last);
      expect(v).toBeGreaterThanOrEqual(BANDS[skillLevel(900)]);
      last = v;
    }
  });

  it('a trade that never proved a band can go all the way back to nothing', () => {
    const d = freshDossier('Doc');
    deploy(d, { medic: 12 });                        // below the first band at 25
    for (let i = 0; i < 20; i++) deploy(d, { rifle: 50 + i });
    expect(d.lifetime.trades.medic!.practice).toBe(0);
    expect(d.lifetime.trades.medic!.peak, 'but the record of it remains').toBe(12);
  });

  it('names what is going rusty, worst first', () => {
    const d = freshDossier('Doc');
    deploy(d, { medic: 300, boat: 300 });
    for (let i = 0; i < 6; i++) deploy(d, { rifle: 100 + i });
    const rusting = rustingTrades(d);
    expect(rusting.length).toBe(2);
    expect(rusting[0].idle).toBeGreaterThanOrEqual(RUST_GRACE);
  });

  it('the unit is the DEPLOY, not the clock — being offline is free', () => {
    // no Date.now, no game-day, nothing a player could scrub or freeze:
    // twelve game-days pass per real day and the time-control store is
    // player-writable, so a calendar rule would let anyone erase or embalm
    // a career. Ten deploys is ten deploys whenever you play them.
    const a = freshDossier('Doc');
    deploy(a, { rifle: 300 });
    for (let i = 0; i < 10; i++) deploy(a, { medic: 5 });
    const b = freshDossier('Doc');
    deploy(b, { rifle: 300 });
    for (let i = 0; i < 10; i++) deploy(b, { medic: 5 });
    expect(b.lifetime.trades.rifle!.practice).toBe(a.lifetime.trades.rifle!.practice);
  });
});

describe('the eight reach the player at last', () => {
  it('a fresh career reads the neutral 5s', () => {
    const st = careerStats(freshDossier('Doc'));
    expect(Object.values(st).every((v) => v === 5)).toBe(true);
  });

  it('the sim takes them through WorldOptions, like papers', () => {
    const w = new World({
      seed: 5, mode: 'tdm', botsPerTeam: 0,
      startingStats: { power: 9, charisma: 2 },
    });
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    expect(me.stats?.power, 'the ledger reached the field').toBe(9);
    expect(me.stats?.charisma).toBe(2);
    expect(me.stats?.agility, 'anything unset stays neutral').toBe(5);
  });

  it('…and they actually move a hook, which flat 5s never could', () => {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0, startingStats: { charisma: 10 } });
    const strong = w.addSoldier('A', 'infantry', 0, 'human');
    const w2 = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const flat = w2.addSoldier('B', 'infantry', 0, 'human');
    expect(w.statMul(flat.stats?.charisma, 2), 'the old world: exactly one').toBe(1);
    expect(w.statMul(strong.stats?.charisma, 2)).toBeGreaterThan(1);
  });

  it('bots are untouched — their seed-stable hash feeds the threat table', () => {
    const a = new World({ seed: 77, mode: 'tdm', botsPerTeam: 0, startingStats: { power: 10 } });
    const b = new World({ seed: 77, mode: 'tdm', botsPerTeam: 0 });
    const ba = a.addSoldier('X', 'infantry', 1, 'bot');
    const bb = b.addSoldier('X', 'infantry', 1, 'bot');
    expect(ba.stats).toEqual(bb.stats);
  });
});

describe('a god neither trains nor rusts', () => {
  it('isTrainable is the ONE predicate, and it excludes the gods', () => {
    const w = new World({ seed: 6, mode: 'tdm', botsPerTeam: 0 });
    const man = w.addSoldier('M', 'infantry', 0, 'human');
    const god = w.addSoldier('G', 'infantry', 0, 'human');
    god.ascendant = 'barrier' as never;
    expect(isTrainable(man)).toBe(true);
    expect(isTrainable(god)).toBe(false);
  });

  it('a god put through the practice door learns absolutely nothing', () => {
    const w = new World({ seed: 6, mode: 'tdm', botsPerTeam: 0 });
    const god = w.addSoldier('G', 'infantry', 0, 'human');
    god.ascendant = 'barrier' as never;
    w.events.length = 0;
    for (let i = 0; i < 500; i++) w.practiseAt(god, 'rifle', 1);
    expect(god.skill?.rifle ?? 0, 'its threat IS its card').toBe(0);
    expect(w.events.filter((e) => e.type === 'skill_band').length).toBe(0);
  });
});

describe('the band crossing is announced, and only then', () => {
  it('exactly one event per rung — five in a whole career', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    w.events.length = 0;
    for (let i = 0; i < 2000; i++) w.practiseAt(s, 'rifle', 0.5);
    const bands = w.events.filter((e) => e.type === 'skill_band');
    expect(bands.length).toBe(BANDS.length - 1);
    expect(bands.map((e) => e.amount)).toEqual([1, 2, 3, 4, 5]);
    expect(bands.every((e) => e.text === 'rifle')).toBe(true);
  });

  it('practice that does not cross says nothing at all', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    const s = w.addSoldier('S', 'infantry', 0, 'human');
    w.practiseAt(s, 'rifle', 30);      // straight past FAMILIAR
    w.events.length = 0;
    w.practiseAt(s, 'rifle', 1);       // still FAMILIAR
    expect(w.events.filter((e) => e.type === 'skill_band').length).toBe(0);
  });
});

describe('the promotion board stops inflating', () => {
  it('bands are a SNAPSHOT of the career, not a running sum', () => {
    // the defect this replaces: a per-match band count was ADDED to a lifetime
    // tally worth 8 service points each, recomputed every deploy from a soldier
    // who always restarted at his hometown's 30 — so rank climbed forever on
    // the same three bands.
    const d = freshDossier('Doc');
    deploy(d, { rifle: 300 });
    const after1 = careerBands(d);
    for (let i = 0; i < 10; i++) deploy(d, { rifle: 300 });   // learn nothing new
    expect(careerBands(d), 'ten empty deploys are worth no rank').toBe(after1);
  });

  it('and it does rise when you actually learn something', () => {
    const d = freshDossier('Doc');
    deploy(d, { rifle: 30 });
    const low = careerBands(d);
    deploy(d, { rifle: 500 });
    expect(careerBands(d)).toBeGreaterThan(low);
  });
});

describe('the after-action says what the deploy was worth', () => {
  it('a crossing is called out by name and band', () => {
    const d = freshDossier('Doc');
    const { delta } = deploy(d, { rifle: 240 });
    const html = deployDeltaHtml(delta);
    expect(html).toContain('RIFLE');
    expect(html).toContain(BAND_LABEL[skillLevel(240)]);
  });

  it('rust is printed in the same breath — never discovered later', () => {
    const d = freshDossier('Doc');
    deploy(d, { medic: 300 });
    let html = '';
    for (let i = 0; i < RUST_GRACE + 1; i++) html = deployDeltaHtml(deploy(d, { rifle: 60 + i }).delta);
    expect(html).toContain('RUSTING');
    expect(html).toContain('MEDIC');
  });

  it('a deploy that changed nothing prints nothing', () => {
    expect(deployDeltaHtml({ gained: [], rusted: [] })).toBe('');
  });
});

describe('an old career loses nothing to the schema', () => {
  it('a v1 dossier migrates forward with its record and an empty sheet', () => {
    const old = freshDossier('Reyes') as unknown as { v: number; lifetime: Record<string, unknown> };
    old.v = 1;
    old.lifetime.kills = 41;
    delete old.lifetime.trades;
    delete old.lifetime.stats;
    const m = migrateDossier(old, 'Reyes');
    expect(m.v).toBe(3);
    expect(m.lifetime.kills).toBe(41);
    expect(m.lifetime.trades).toEqual({});
    expect(careerStats(m).power).toBe(5);
  });
});
