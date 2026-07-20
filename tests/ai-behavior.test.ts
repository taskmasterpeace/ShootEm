// ---------------------------------------------------------------------------
// THE AI BEHAVIOR LAWS — the decision-core contracts added in the 2026-07-19
// audit pass (docs/AI-AUDIT.md). These lock behaviors that are otherwise
// invisible to the suite: a bot's eyes, its trigger discipline, whether a god
// wastes its signature on empty air, and whether armor has an infantry answer.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_COVER, T_OPEN, T_WALL, TILE, WORLD } from '../src/sim/map';
import { World, type Difficulty } from '../src/sim/world';
import { visionMult } from '../src/sim/weather';
import { DIRECTOR_EVAL, PRESSURE_MAX, PRESSURE_MIN, stepDirector } from '../src/sim/director';
import { threatAt } from '../src/sim/influence';
import { defendsNow } from '../src/sim/bots';
import type { AscendantId, Team } from '../src/sim/types';

const DT = 1 / 60;
/** carve open ground with clear sight around the origin */
const carve = (w: World) => {
  for (let tz = 54; tz <= 74; tz++) for (let tx = 48; tx <= 88; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
};
/** count events of a kind emitted by `id` while stepping (events accumulate) */
function run(w: World, secs: number, tally: (e: World['events'][number]) => void) {
  let prev = w.events.length;
  for (let i = 0; i < Math.round(secs / DT); i++) {
    w.step(DT, new Map());
    for (let k = prev; k < w.events.length; k++) tally(w.events[k]);
    prev = w.events.length;
  }
}

describe('bot trigger discipline (§reaction)', () => {
  /** ticks until a bot opens fire on a fresh contact */
  function ticksToFire(difficulty: Difficulty): number {
    const w = new World({ seed: 3, mode: 'tdm', difficulty });
    carve(w);
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    bot.pos = { x: 0, y: 0, z: 0 }; bot.yaw = 0;
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: 6, y: 0, z: 0 }; foe.hp = 9999; foe.maxHp = 9999;
    let prev = w.events.length;
    for (let i = 0; i < 120; i++) {
      w.step(DT, new Map());
      for (let k = prev; k < w.events.length; k++) {
        if (w.events[k].soldierId === bot.id && w.events[k].type === 'shot') return i + 1;
      }
      prev = w.events.length;
      foe.pos = { x: 6, y: 0, z: 0 }; foe.hp = 9999;
    }
    return -1;
  }

  it('a bot does NOT headshot the tick it sees you — it reacts first', () => {
    const t = ticksToFire('veteran');
    expect(t, 'never fired').toBeGreaterThan(0);
    expect(t, 'fired instantly — the inhuman snap is back').toBeGreaterThan(6);
  });

  it('reaction time IS the difficulty ladder: elite reacts faster than recruit', () => {
    const elite = ticksToFire('elite');
    const recruit = ticksToFire('recruit');
    expect(elite).toBeGreaterThan(0);
    expect(elite).toBeLessThan(recruit);
  });
});

describe('the sky taxes the AI too (§8.8)', () => {
  /** does a bot engage a foe `d` away under this sky? */
  function engages(kind: 'clear' | 'fog', d: number): boolean {
    const w = new World({ seed: 3, mode: 'tdm' });
    carve(w);
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    if (kind === 'fog') w.weather = { kind: 'fog', intensity: 1, until: 1e9 };
    let fired = false, prev = w.events.length;
    for (let i = 0; i < 120; i++) {
      // PIN both bodies each tick — the sight gate decides, not footwork
      // (left free, the bot simply walks into range and the test proves nothing)
      bot.pos = { x: 0, y: 0, z: 0 };
      foe.pos = { x: d, y: 0, z: 0 }; foe.hp = 9999; foe.maxHp = 9999;
      w.step(DT, new Map());
      for (let k = prev; k < w.events.length; k++) {
        if (w.events[k].soldierId === bot.id && w.events[k].type === 'shot') fired = true;
      }
      prev = w.events.length;
    }
    return fired;
  }

  it('heavy fog pulls a bot to a short radius — it cannot laser you across the field', () => {
    expect(engages('clear', 34), 'a bot should engage at 34u in clear air').toBe(true);
    expect(engages('fog', 34), 'a bot still saw 34u through heavy fog').toBe(false);
  });

  it('the fog multiplier is the tightest sky, and heavy rain cuts far more than a drizzle', () => {
    const v = (k: 'clear' | 'rain' | 'storm' | 'fog') => visionMult({ kind: k, intensity: 1, until: 0 });
    expect(v('fog')).toBeLessThanOrEqual(v('storm'));
    expect(v('storm')).toBeLessThan(v('rain'));
    expect(v('rain')).toBeLessThan(v('clear'));
  });
});

describe('a god does not cast at nobody (§lsw kit)', () => {
  function casts(id: AscendantId, faction: Team, withEnemy: boolean): number {
    const w = new World({ seed: 3, mode: 'tdm' });
    const lsw = w.addLsw(id, faction, { x: 0, y: 0, z: 0 })!;
    lsw.pos = { x: 0, y: 0, z: 0 };
    const foeTeam = (1 - faction) as Team;
    if (withEnemy) {
      const foe = w.addSoldier('F', 'infantry', foeTeam, 'human');
      foe.pos = { x: 6, y: 0, z: 0 }; foe.hp = 99999; foe.maxHp = 99999;
    }
    let n = 0;
    const tag = `vo_${id}_ability`;
    run(w, 6, (e) => { if (e.soldierId === lsw.id && e.type === 'vo' && e.text === tag) n++; });
    return n;
  }

  it('a bot Sniperhawk never rails an empty lane, but rails a real target', () => {
    expect(casts('sniperhawk', 0, false), 'railed at empty air').toBe(0);
    expect(casts('sniperhawk', 0, true), 'never railed a target in reach').toBeGreaterThan(0);
  });

  it('a bot Reactor never novas an empty circle, but blooms on a body in the blast', () => {
    expect(casts('reactor', 0, false), 'novaed nobody').toBe(0);
    expect(casts('reactor', 0, true), 'never novaed a body in the blast').toBeGreaterThan(0);
  });
});

describe('armor has an infantry answer (§foot anti-vehicle)', () => {
  it('a heavy on foot puts missiles into a crewed enemy tank', () => {
    const w = new World({ seed: 7, mode: 'tdm' });
    carve(w);
    const tank = w.spawnVehicle('tank', 1, { x: 30, y: 0, z: 0 });
    const driver = w.addSoldier('D', 'infantry', 1, 'human');
    driver.pos = { ...tank.pos }; tank.seats[0] = driver.id; driver.vehicleId = tank.id; driver.seat = 0;
    const heavy = w.addSoldier('H', 'heavy', 0, 'bot');
    heavy.pos = { x: 0, y: 0, z: 0 };
    const hp0 = tank.hp;
    let shots = 0;
    run(w, 6, (e) => { if (e.soldierId === heavy.id && e.type === 'shot' && e.weapon === 'mml') shots++; });
    expect(shots, 'the heavy never fired its launcher at the tank').toBeGreaterThan(0);
    expect(tank.hp, 'the tank took no damage').toBeLessThan(hp0);
  });
});

describe('the last of a squad fights (§last stand)', () => {
  it('a lone duelist still breaks contact when mauled — last-stand is squad-only', () => {
    // one bot per team: NOT a squad, so the retreat law still applies
    const w = new World({ seed: 5, mode: 'tdm' });
    carve(w);
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    bot.pos = { x: 0, y: 0, z: 0 }; bot.hp = bot.maxHp * 0.15;
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    foe.pos = { x: 12, y: 0, z: 0 };
    const d0 = Math.hypot(foe.pos.x - bot.pos.x, foe.pos.z - bot.pos.z);
    for (let i = 0; i < 40; i++) { w.step(DT, new Map()); bot.hp = bot.maxHp * 0.15; foe.pos = { x: 12, y: 0, z: 0 }; }
    expect(Math.hypot(foe.pos.x - bot.pos.x, foe.pos.z - bot.pos.z), 'a mauled duelist charged instead of retreating').toBeGreaterThan(d0);
  });
});

describe('the Director paces the match (§director)', () => {
  /** drive the band directly — a live mode recomputes scores mid-step */
  function band(setup: (w: World) => void, evals = 8): number {
    const w = new World({ seed: 5, mode: 'tdm' });
    w.addSoldier('Player', 'infantry', 0, 'human');
    for (let i = 0; i < 6; i++) w.addSoldier(`e${i}`, 'infantry', 1, 'bot');
    for (let i = 0; i < evals; i++) {
      setup(w);
      w.time += DIRECTOR_EVAL + 0.1;
      stepDirector(w, w.director);
    }
    return w.director.pressure;
  }

  it('stays PINNED neutral with no human on the field (bot-vs-bot is untouched)', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    for (const t of [0, 1] as const) for (let i = 0; i < 6; i++) w.addSoldier(`b${t}${i}`, 'infantry', t, 'bot');
    for (let i = 0; i < 60 * 20; i++) {
      w.step(DT, new Map());
      expect(w.director.pressure, 'the sky moved with nobody watching').toBe(1);
    }
  });

  it('gives a mauled player air, and leans on one running away with it', () => {
    const mauled = band((w) => { const me = [...w.soldiers.values()].find((s) => s.kind === 'human')!; me.deaths += 3; });
    const winning = band((w) => { w.mode.scores[0] = 30; w.mode.scores[1] = 2; });
    expect(mauled, 'no relief for a player being farmed').toBeLessThan(0.99);
    expect(winning, 'no push against a player dominating').toBeGreaterThan(1.01);
    expect(mauled).toBeLessThan(winning);
  });

  it('never leaves the band — it can lean, never cheat', () => {
    const hard = band((w) => { w.mode.scores[0] = 9999; w.mode.scores[1] = 0; }, 40);
    const soft = band((w) => { const me = [...w.soldiers.values()].find((s) => s.kind === 'human')!; me.deaths += 99; }, 40);
    expect(hard).toBeLessThanOrEqual(PRESSURE_MAX);
    expect(soft).toBeGreaterThanOrEqual(PRESSURE_MIN);
  });
});

describe('the influence map gives cover a brain (§influence)', () => {
  it('threat radiates from enemy guns, and a mauled bot breaks for the QUIET cover', () => {
    const at = (t: number) => (t + 0.5) * TILE - WORLD / 2;
    const w = new World({ seed: 11, mode: 'tdm' });
    for (let tz = 50; tz <= 78; tz++) for (let tx = 50; tx <= 82; tx++) w.map.grid[tz * GRID + tx] = T_OPEN;
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    bot.pos = { x: at(64), y: 0, z: at(64) };
    // HOT cover: closer, but ringed by four enemies
    const hot = { x: at(68), z: at(64) };
    w.map.grid[64 * GRID + 68] = T_COVER;
    for (let i = 0; i < 4; i++) {
      const e = w.addSoldier(`E${i}`, 'infantry', 1, 'bot');
      e.pos = { x: at(71 + (i % 2)), y: 0, z: at(63 + i) };
    }
    // QUIET cover: further, nobody near it
    const quiet = { x: at(58), z: at(64) };
    w.map.grid[64 * GRID + 58] = T_COVER;
    for (let i = 0; i < 60; i++) w.step(DT, new Map());

    expect(threatAt(w.influence, 0, hot.x, hot.z), 'the field is blind to four guns')
      .toBeGreaterThan(threatAt(w.influence, 0, quiet.x, quiet.z));

    const d0h = Math.hypot(bot.pos.x - hot.x, bot.pos.z - hot.z);
    const d0q = Math.hypot(bot.pos.x - quiet.x, bot.pos.z - quiet.z);
    for (let i = 0; i < 90; i++) {
      bot.alive = true; bot.downed = false; bot.hp = bot.maxHp * 0.15; bot.respawnAt = 0;
      w.step(DT, new Map());
    }
    const closedOnQuiet = d0q - Math.hypot(bot.pos.x - quiet.x, bot.pos.z - quiet.z);
    const closedOnHot = d0h - Math.hypot(bot.pos.x - hot.x, bot.pos.z - hot.z);
    expect(closedOnQuiet, 'it peeled to the nearest crate under four guns')
      .toBeGreaterThan(closedOnHot);
  });
});

describe('defence is scored, not frozen (§utility role)', () => {
  const squad = () => {
    const w = new World({ seed: 17, mode: 'ctf', matchMinutes: 15 });
    const bots: ReturnType<World['addSoldier']>[] = [];
    const MIX = ['infantry', 'heavy', 'medic', 'engineer', 'jump', 'infantry', 'infiltrator', 'heavy', 'infantry', 'medic', 'infantry', 'ghost'] as const;
    for (const t of [0, 1] as const) for (let i = 0; i < 12; i++) bots.push(w.addSoldier(`${t}-${i}`, MIX[i], t, 'bot'));
    w.step(1 / 60, new Map());
    return { w, mine: bots.filter((b) => b.team === 0) };
  };

  it('holds a sane number of defenders — never lets the attack die', () => {
    const { w, mine } = squad();
    const n = mine.filter((b) => defendsNow(w, b)).length;
    expect(n, 'nobody defended').toBeGreaterThan(0);
    expect(n, 'half the squad went home — the attack dies').toBeLessThanOrEqual(Math.ceil(mine.length / 3) + 1);
  });

  it('BACKFILLS: kill the defenders and someone else steps up', () => {
    const { w, mine } = squad();
    const first = mine.filter((b) => defendsNow(w, b));
    expect(first.length).toBeGreaterThan(0);
    for (const b of first) { b.alive = false; b.respawnAt = 1e9; } // the whole guard detail dies
    const second = mine.filter((b) => b.alive && defendsNow(w, b));
    expect(second.length, 'home sat open after the guards died').toBeGreaterThan(0);
    expect(second.some((b) => !first.includes(b)), 'the same dead men were re-picked').toBe(true);
  });
});

describe('a bot has eyes, not radar (§facing cone)', () => {
  /** does the bot (facing +x at the origin) engage a foe `deg` off its facing? */
  function engages(deg: number, dist: number, ping = false): boolean {
    const w = new World({ seed: 3, mode: 'tdm' });
    carve(w);
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    const foe = w.addSoldier('F', 'infantry', 1, 'human');
    const a = (deg * Math.PI) / 180;
    let fired = false, prev = w.events.length;
    for (let i = 0; i < 90; i++) {
      bot.pos = { x: 0, y: 0, z: 0 }; bot.yaw = 0;
      foe.pos = { x: Math.cos(a) * dist, y: 0, z: Math.sin(a) * dist };
      foe.hp = 9999; foe.maxHp = 9999;
      // a REAL ping source: world.step rebuilds `pinged` each tick, so a manual
      // add is wiped. A friendly target beacon paints enemies within 25u.
      if (ping && i === 0) w.spawnGadget('target_beacon', 0, bot.id, { x: foe.pos.x, y: 0, z: foe.pos.z }, 60, 9999);
      w.step(DT, new Map());
      for (let k = prev; k < w.events.length; k++) {
        if (w.events[k].soldierId === bot.id && w.events[k].type === 'shot') fired = true;
      }
      prev = w.events.length;
    }
    return fired;
  }

  it('FLANKING works: it engages what it faces and is blind to what is behind it', () => {
    expect(engages(0, 20), 'blind straight ahead').toBe(true);
    expect(engages(45, 20), 'blind at 45deg — the cone is too narrow').toBe(true);
    expect(engages(120, 20), 'saw a body at 120deg — the cone is too wide').toBe(false);
    expect(engages(180, 20), 'it has eyes in the back of its head again').toBe(false);
  });

  it('a ping ignores facing, and the footstep ring still hears what is on top of you', () => {
    // regression: `pinged` is repopulated AFTER the bot brains run, so bots must
    // read the previous tick's snapshot — reading it live made every ping-aware
    // branch dead code, silently.
    expect(engages(180, 20, true), 'a MARKED enemy behind it stayed invisible').toBe(true);
    expect(engages(180, 6), 'it ignored a body inside the footstep ring').toBe(true);
  });
});

describe('the planner knows the ground (§walkable)', () => {
  it('a bot routes THROUGH tall grass instead of treating a forest as a wall', () => {
    // a grass corridor is the only way through a wall line — if the planner
    // treats grass as solid, the bot never crosses.
    const w = new World({ seed: 9, mode: 'tdm' });
    carve(w);
    for (let tz = 54; tz <= 74; tz++) w.map.grid[tz * GRID + 68] = T_WALL; // wall line
    for (let tz = 63; tz <= 65; tz++) w.map.grid[tz * GRID + 68] = 12;     // T_GRASS gap
    const bot = w.addSoldier('B', 'infantry', 0, 'bot');
    bot.pos = { x: -20, y: 0, z: 0 };
    const goal = { x: 40, y: 0, z: 0 };
    let crossed = false;
    for (let i = 0; i < 60 * 12; i++) {
      w.step(DT, new Map());
      bot.botGoal = null; // force a fresh route each beat toward the far side
      w.map.hillPos = goal;
      if (bot.pos.x > 12) { crossed = true; break; }
    }
    expect(crossed, 'the bot never threaded the grass gap — grass still reads as wall').toBe(true);
  });
});
