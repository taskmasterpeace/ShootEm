// ---------------------------------------------------------------------------
// FIVE FEATURES THAT WERE SKIN, GIVEN TEETH.
//
// Each of these existed and did nothing:
//   1. CERTIFICATIONS — licenceHeld() was written and never called
//   2. THE WAR CHEST  — budgetMultiplier only printed a sentence about itself
//   3. THE BOARD      — nine canon verbs, none in the game
//   4. RANK           — the GONET said "Eligible" over an empty room
//   5. MORALE         — one number, +3 materiel at spawn, never spoken of again
//
// The laws below are what "teeth" means for each: a refusal that really
// refuses, a budget that really restricts, a landing you can really miss, an
// authority you really have to earn, and a nerve that really breaks.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { licenceHeld } from '../src/sim/licenses';
import {
  BANDS, bandProgress, practise, practiceOf, skillEdge, skillForWeapon, skillLevel, SKILL_IDS,
} from '../src/sim/skills';
import {
  MORALE_BASE, MORALE_SHIFTS, bandOf, moraleOf, moraleSpread, settleMorale, shiftMorale, wantsCover,
} from '../src/sim/morale';
import {
  RANKS, blankService, boardVerdict, leadershipRadius, materielBonus, mayCallStable,
  mayCommand, nextRank, rankFor, serviceScore,
} from '../src/sim/ranks';
import {
  BOOST_JUMP_COST, BOOST_MAX, LAND_WINDOW, boostJump, coolChain, land, newTrickState,
  spendBoost, spinName, stepAir, stepGrind, stepSlide, stepWallRide, trickName,
} from '../src/sim/boardtricks';

// ═══ 1. CERTIFICATIONS: the gate that refuses ═══════════════════════════════
describe('the papers are a gate now, not a label', () => {
  // APPROACH FROM THE NOSE. W5.6 per-hatch entry seats a human by the hatch
  // they walked to, so a body standing behind the hull takes a bench whatever
  // its papers say — approaching from the front is what makes the PAPERS the
  // only thing under test here.
  function field(papers?: string[]) {
    const w = new World({ seed: 5, mode: 'tdm', botsPerTeam: 0 });
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    if (papers) me.papers = papers as never;
    const v = w.spawnVehicle('tank', 0, { x: 0, y: 0, z: 0 });
    v.alive = true;
    v.yaw = 0;                          // nose points +x
    me.pos = { x: 2, y: 0, z: 0 };      // stood at the nose
    return { w, me, v };
  }

  it('refuses the WHEEL of a hull you never qualified on', () => {
    const { w, me, v } = field([]); // a file with nothing on it
    w.tryEnterVehicle(me);
    expect(v.seats[0]).not.toBe(me.id); // never got the driver's seat
  });

  it('but lets you RIDE — you are barred from driving, not from the truck', () => {
    const { w, me, v } = field([]);
    w.tryEnterVehicle(me);
    // the tank has more than one seat, so the refusal hands over a bench
    expect(v.seats.slice(1)).toContain(me.id);
    expect(me.vehicleId).toBe(v.id);
  });

  it('names the licence AND the school when it refuses', () => {
    const { w, me } = field([]);
    w.takeEvents();
    w.tryEnterVehicle(me);
    const said = w.takeEvents().filter((e) => e.type === 'announce').map((e) => e.text).join(' | ');
    expect(said).toMatch(/NOT CERTIFIED/);
    expect(said).toMatch(/TANK/i);
    expect(said).toMatch(/Armour School/i);
  });

  it('the full chain clears it — the ladder, not the top rung alone', () => {
    // holding only 'tank' is NOT enough; you need the road up to it
    const alone = field(['tank']);
    alone.w.tryEnterVehicle(alone.me);
    expect(alone.v.seats[0]).not.toBe(alone.me.id);

    const whole = field(['basic_driver', 'heavy_truck', 'apc', 'tank']);
    whole.w.tryEnterVehicle(whole.me);
    expect(whole.v.seats[0]).toBe(whole.me.id);
  });

  it('a body with NO papers array is ISSUED — every bot drives anything', () => {
    const { w, v } = field(); // papers undefined
    const bot = w.addSoldier('BOT', 'infantry', 0, 'bot');
    bot.pos = { x: 1, y: 0, z: 0 };
    w.tryEnterVehicle(bot);
    expect(v.seats[0]).toBe(bot.id);
  });

  it('the personal decks need no paperwork — canon', () => {
    expect(licenceHeld([], 'hoverboard')).toBe(true);
    expect(licenceHeld([], 'bicycle')).toBe(true);
    expect(licenceHeld([], 'tank')).toBe(false);
  });
});

// ═══ 2. THE WAR CHEST: a budget that restricts ══════════════════════════════
describe('the war chest buys the opening manifest', () => {
  const open = (budget?: [number, number]) =>
    new World({ seed: 9, mode: 'tdm', botsPerTeam: 0, budget }).materiel;

  it('a broke army opens with less than a funded one', () => {
    const broke = open([0.6, 1]);
    const rich = open([1.35, 1]);
    expect(broke[0]).toBeLessThan(rich[0]);
  });

  it('never starves a side out of the game, and never floods it', () => {
    expect(open([0.01, 0.01])[0]).toBeGreaterThanOrEqual(4);
    expect(open([99, 99])[0]).toBeLessThanOrEqual(14);
  });

  it('no budget = the old behaviour, untouched', () => {
    expect(open()[0]).toBe(open([1, 1])[0]);
  });

  it('the chest really gates a god-call: a broke side cannot afford one', () => {
    const broke = new World({ seed: 4, mode: 'tdm', botsPerTeam: 0, budget: [0.5, 1] });
    const rich = new World({ seed: 4, mode: 'tdm', botsPerTeam: 0, budget: [1.4, 1] });
    expect(broke.materiel[0]).toBeLessThan(rich.materiel[0]);
  });
});

// ═══ 3. THE BOARD: an economy you can actually lose ═════════════════════════
describe('the board earns, banks, and bails', () => {
  it('a clean landing banks the combo into boost', () => {
    const t = newTrickState();
    stepAir(t, 1.2, Math.PI * 2); // a big float with a 360 in it
    expect(t.combo).toBeGreaterThan(0);
    const r = land(t, 1, 0);
    expect(r.landed).toBe(true);
    expect(r.banked).toBeGreaterThan(0);
    expect(t.boost).toBeGreaterThan(0);
    expect(r.name).toContain('360');
  });

  it('A BAD LANDING COSTS YOU THE RUN — the whole point', () => {
    const t = newTrickState();
    stepAir(t, 1.5, Math.PI * 3);
    const before = t.boost;
    const r = land(t, LAND_WINDOW - 0.01, 10); // just outside the window
    expect(r.landed).toBe(false);
    expect(r.banked).toBe(0);
    expect(t.boost).toBe(before);   // nothing banked
    expect(t.multiplier).toBe(1);   // the chain is broken
    expect(t.bailedUntil).toBeGreaterThan(10);
  });

  it('the multiplier climbs with each landed run and caps', () => {
    const t = newTrickState();
    for (let i = 0; i < 12; i++) { stepAir(t, 0.8, Math.PI); land(t, 1, i); }
    expect(t.multiplier).toBe(6);
  });

  it('stepping off a kerb is not a bail — nothing to lose, nothing lost', () => {
    const t = newTrickState();
    stepAir(t, 0.01, 0); // barely airborne
    const r = land(t, 0, 0);
    expect(r.landed).toBe(true);
    expect(t.multiplier).toBe(1);
    expect(t.bailedUntil).toBe(0);
  });

  it('names a run the way people name them', () => {
    expect(spinName(Math.PI * 2)).toBe('360');
    expect(spinName(Math.PI * 5)).toBe('900');
    expect(spinName(Math.PI * 0.5)).toBeUndefined();
    const t = newTrickState();
    stepAir(t, 0.9, Math.PI * 2);
    stepWallRide(t, 0.5);
    expect(trickName(t)).toBe('360 + WALL RIDE');
  });

  it('a lazy drift earns nothing; a real carve earns', () => {
    const lazy = newTrickState();
    stepSlide(lazy, 1, 0.1, 1);
    expect(lazy.combo).toBe(0);
    const carve = newTrickState();
    stepSlide(carve, 1, Math.PI * 0.4, 1);
    expect(carve.combo).toBeGreaterThan(0);
  });

  it('a grind pays and holds the chain open', () => {
    const t = newTrickState();
    stepGrind(t, 1);
    expect(t.combo).toBeGreaterThan(0);
    expect(trickName(t)).toContain('GRIND');
  });

  it('boost is spent, not free — and the jump costs real fuel', () => {
    const t = newTrickState();
    t.boost = BOOST_MAX;
    const mul = spendBoost(t, 1, true);
    expect(mul).toBeGreaterThan(1);
    expect(t.boost).toBeLessThan(BOOST_MAX);

    const empty = newTrickState();
    expect(spendBoost(empty, 1, true)).toBe(1); // nothing in the tank
    expect(boostJump(empty, 1)).toBe(0);        // and no launch either

    const full = newTrickState();
    full.boost = BOOST_MAX;
    expect(boostJump(full, 1)).toBeGreaterThan(0);
    expect(full.boost).toBe(BOOST_MAX - BOOST_JUMP_COST);
  });

  it('the chain cools off if you just roll around', () => {
    const t = newTrickState();
    t.multiplier = 5; t.chain = ['360'];
    for (let i = 0; i < 40; i++) coolChain(t, 0.2);
    expect(t.multiplier).toBe(1);
    expect(t.chain).toHaveLength(0);
  });
});

// ═══ 4. RANK: authority you have to earn ════════════════════════════════════
describe('rank is earned responsibility', () => {
  it('service is made of doing, and knowledge outweighs kills', () => {
    const r = blankService();
    r.kills = 29;
    const killer = serviceScore(r);
    const scholar = serviceScore({ ...blankService(), certifications: 1 });
    expect(scholar).toBeGreaterThan(killer); // the canon's own priority
  });

  it('the ladder climbs in order and never skips', () => {
    let last = -1;
    for (const rank of RANKS) {
      expect(rank.at).toBeGreaterThan(last);
      last = rank.at;
      expect(rankFor(rank.at).id).toBe(rank.id);
    }
  });

  it('THE STABLE ANSWERS LIEUTENANTS — the authority that matters', () => {
    expect(mayCallStable(rankFor(0).id)).toBe(false);
    expect(mayCallStable(4)).toBe(false);
    expect(mayCallStable(5)).toBe(true);
    expect(mayCommand(5)).toBe(false);
    expect(mayCommand(6)).toBe(true);
  });

  it('a private cannot call a god down; a lieutenant can', () => {
    const call = (rank: number) => {
      const w = new World({ seed: 2, mode: 'tdm', botsPerTeam: 0, rank });
      const me = w.addSoldier('ME', 'infantry', 0, 'human');
      w.materiel[0] = 14;
      return w.requestLsw('titan', 0, me.id);
    };
    expect(call(1)).toBe(false);  // Private
    expect(call(6)).toBe(true);   // Captain
  });

  it('the AI commander still calls for its side (no rank, no gate)', () => {
    const w = new World({ seed: 2, mode: 'tdm', botsPerTeam: 0, rank: 0 });
    w.materiel[0] = 14;
    expect(w.requestLsw('titan', 0, -1)).toBe(true);
  });

  it('leadership REACH is what rank buys in the field', () => {
    expect(leadershipRadius(0)).toBe(0); // one of the men
    expect(leadershipRadius(1)).toBe(0);
    expect(leadershipRadius(2)).toBeGreaterThan(0); // Corporal
    expect(leadershipRadius(9)).toBeGreaterThan(leadershipRadius(2));
  });

  it('the board always says what you are eligible for', () => {
    expect(boardVerdict(0)).toMatch(/Eligible for Private/);
    expect(boardVerdict(999_999)).toMatch(/top of the ladder/);
    expect(nextRank(999_999)).toBeUndefined();
    expect(materielBonus(9)).toBeGreaterThan(materielBonus(0));
  });
});

// ═══ 5. MORALE: a nerve that really breaks ══════════════════════════════════
describe('morale moves, and it comes out in the hands', () => {
  it('a friend dropping nearby costs you, and a kill pays', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    const mate = w.addSoldier('MATE', 'infantry', 0, 'bot');
    const foe = w.addSoldier('FOE', 'infantry', 1, 'bot');
    for (const s of [me, mate, foe]) { s.pos = { x: 0, y: 0, z: 0 }; s.alive = true; }
    me.morale = MORALE_BASE;

    w.damageSoldier(mate, 9999, foe.id, 'knife');
    expect(moraleOf(me)).toBeLessThan(MORALE_BASE); // he watched it happen

    const before = moraleOf(foe);
    expect(before).toBeGreaterThan(MORALE_BASE);    // and the killer gained
  });

  it('distance matters — a death across the map is not your problem', () => {
    const w = new World({ seed: 7, mode: 'tdm', botsPerTeam: 0 });
    const near = w.addSoldier('NEAR', 'infantry', 0, 'bot');
    const far = w.addSoldier('FAR', 'infantry', 0, 'bot');
    const mate = w.addSoldier('MATE', 'infantry', 0, 'bot');
    const foe = w.addSoldier('FOE', 'infantry', 1, 'bot');
    near.pos = { x: 0, y: 0, z: 0 };
    far.pos = { x: 400, y: 0, z: 400 };
    mate.pos = { x: 1, y: 0, z: 0 };
    foe.pos = { x: 2, y: 0, z: 0 };
    near.morale = far.morale = MORALE_BASE;
    w.damageSoldier(mate, 9999, foe.id, 'knife');
    expect(moraleOf(near)).toBeLessThan(MORALE_BASE);
    expect(moraleOf(far)).toBe(MORALE_BASE);
  });

  it('BROKEN hands open the group; INSPIRED ones close it', () => {
    expect(moraleSpread(5)).toBeGreaterThan(1);    // broken
    expect(moraleSpread(60)).toBe(1);              // steady costs nothing
    expect(moraleSpread(95)).toBeLessThan(1);      // inspired
    // and the whole swing stays modest — morale is a story, not a damage stat
    expect(moraleSpread(0) / moraleSpread(100)).toBeLessThan(1.35);
  });

  it('the bands read the way the words mean', () => {
    expect(bandOf(0)).toBe('broken');
    expect(bandOf(30)).toBe('shaken');
    expect(bandOf(60)).toBe('steady');
    expect(bandOf(75)).toBe('high');
    expect(bandOf(95)).toBe('inspired');
    expect(wantsCover(30)).toBe(true);
    expect(wantsCover(70)).toBe(false);
  });

  it('a quiet minute puts a man back together — both directions', () => {
    const low = { morale: 10 } as never;
    const high = { morale: 95 } as never;
    for (let i = 0; i < 200; i++) { settleMorale(low, 0.5); settleMorale(high, 0.5); }
    expect(moraleOf(low)).toBe(MORALE_BASE);
    expect(moraleOf(high)).toBe(MORALE_BASE);
  });

  it('clamps at both ends — no negative nerve, no infinite courage', () => {
    const s = { morale: MORALE_BASE } as never;
    for (let i = 0; i < 50; i++) shiftMorale(s, MORALE_SHIFTS.friendDown);
    expect(moraleOf(s)).toBe(0);
    for (let i = 0; i < 100; i++) shiftMorale(s, MORALE_SHIFTS.medal);
    expect(moraleOf(s)).toBe(100);
  });
});

// ═══ SKILLS: the quiet fifth, riding with morale ════════════════════════════
describe('skills level through use and stay small', () => {
  it('practice caps, so a long match cannot run the number away', () => {
    const s = { skill: {} } as never;
    for (let i = 0; i < 5000; i++) practise(s, 'rifle', 1);
    expect(practiceOf(s, 'rifle')).toBe(BANDS[BANDS.length - 1]);
    expect(skillLevel(practiceOf(s, 'rifle'))).toBe(5);
  });

  it('THE CEILING IS THE POINT — mastery is worth about 12%', () => {
    expect(skillEdge(0)).toBe(1);
    expect(skillEdge(BANDS[5])).toBeCloseTo(1.12, 2);
    expect(skillEdge(BANDS[5])).toBeLessThan(1.2); // never a god-maker
  });

  it('bands fill smoothly and the top band is full', () => {
    expect(bandProgress(0)).toBe(0);
    expect(bandProgress(BANDS[1])).toBe(0);
    expect(bandProgress((BANDS[1] + BANDS[2]) / 2)).toBeCloseTo(0.5, 1);
    expect(bandProgress(BANDS[5])).toBe(1);
  });

  it('weapons train the skill they belong to', () => {
    expect(skillForWeapon('rifle_maklov_1')).toBe('rifle');
    expect(skillForWeapon('sniper_kuchler_3')).toBe('sniper');
    expect(skillForWeapon('pistol_maklov_1')).toBe('pistol');
  });

  it('the whole canon roster is present', () => {
    expect(SKILL_IDS).toHaveLength(22);
  });

  it('landing rounds really practises the weapon', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    const me = w.addSoldier('ME', 'infantry', 0, 'human');
    const foe = w.addSoldier('FOE', 'infantry', 1, 'bot');
    foe.pos = { x: 5, y: 0, z: 0 };
    const before = practiceOf(me, 'rifle');
    for (let i = 0; i < 10; i++) w.damageSoldier(foe, 1, me.id, 'rifle_maklov_1');
    expect(practiceOf(me, 'rifle')).toBeGreaterThan(before);
  });
});
