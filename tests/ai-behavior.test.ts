// ---------------------------------------------------------------------------
// THE AI BEHAVIOR LAWS — the decision-core contracts added in the 2026-07-19
// audit pass (docs/AI-AUDIT.md). These lock behaviors that are otherwise
// invisible to the suite: a bot's eyes, its trigger discipline, whether a god
// wastes its signature on empty air, and whether armor has an infantry answer.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { GRID, T_OPEN, T_WALL } from '../src/sim/map';
import { World, type Difficulty } from '../src/sim/world';
import { visionMult } from '../src/sim/weather';
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
