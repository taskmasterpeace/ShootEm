// ---------------------------------------------------------------------------
// PAINTBALL — Hunters vs Hunted (§3.3/§14). The onboarding yard: one prey,
// one pack, two-minute rounds, one splat and you sit down. The prey tags
// three points or survives the clock; the pack paints them out.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { PAINTBALL_FIELDS, T_OPEN, generatePaintballField, isBlocked, tileAt } from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import type { PlayerCmd } from '../src/sim/types';

const cmd = (over: Partial<PlayerCmd> = {}): PlayerCmd => ({
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  ...over,
});

/** One prey (team 1) vs a three-bot pack (team 0), markers all around. */
function yard() {
  const w = new World({ seed: PAINTBALL_FIELDS[0].seed, mode: 'paintball', theme: PAINTBALL_FIELDS[0].theme });
  const hunters = [0, 1, 2].map((i) =>
    w.addSoldier(`Hunter${i}`, 'infantry', 0, 'human', { primary: 'marker_blitz' }));
  const prey = w.addSoldier('Prey', 'infantry', 1, 'human', { primary: 'marker_pump' });
  w.step(1 / 60, new Map()); // huntedTeam resolves off the roster
  return { w, hunters, prey };
}

describe('the fields', () => {
  it('every named field is a sealed arena: walls outside, play inside, 3 tag points', () => {
    for (const f of PAINTBALL_FIELDS) {
      const map = generatePaintballField(f.seed, f.theme);
      expect(map.controlPoints.length).toBe(3);
      // the fence holds: everything at the map rim is wall
      expect(tileAt(map.grid, -140, -140)).not.toBe(T_OPEN);
      // both sides spawn on open paint inside the yard
      for (const side of map.spawns) {
        for (const p of side) expect(isBlocked(map.grid, p.x, p.z)).toBe(false);
      }
      // tag pads stand on open ground
      for (const cp of map.controlPoints) expect(isBlocked(map.grid, cp.pos.x, cp.pos.z)).toBe(false);
      // no motor pool in a paintball yard
      expect(map.vehiclePads.length).toBe(0);
    }
  });

  it('every yard has water to splash through and pads to jump from (Robert)', () => {
    for (const f of PAINTBALL_FIELDS) {
      const map = generatePaintballField(f.seed, f.theme);
      let water = 0;
      for (const t of map.grid) if (t === 3 /* T_WATER */) water++;
      expect(water, `${f.name} needs its pool`).toBeGreaterThanOrEqual(12);
      expect(map.pads.length, `${f.name} needs its jumps`).toBe(2);
      for (const pd of map.pads) expect(isBlocked(map.grid, pd.pos.x, pd.pos.z)).toBe(false);
    }
  });

  it('fields are deterministic — the same seed deals the same yard', () => {
    const a = generatePaintballField(1101, 'savanna');
    const b = generatePaintballField(1101, 'savanna');
    expect(Buffer.from(a.grid).equals(Buffer.from(b.grid))).toBe(true);
  });
});

describe('the rules', () => {
  it('reads the hunted side off the roster: the smaller team is the prey', () => {
    const { w } = yard();
    expect(w.mode.huntedTeam).toBe(1);
  });

  it('one splat and you SIT — paint is final inside a round', () => {
    const { w, hunters } = yard();
    w.damageSoldier(hunters[0], 999, -1, 'marker_pump'); // 999 rides the overkill rule
    expect(hunters[0].alive).toBe(false);
    expect(hunters[0].downed).toBe(false);               // paint never leaves you crawling
    for (let i = 0; i < 300; i++) w.step(1 / 60, new Map());
    expect(hunters[0].alive).toBe(false);                // still in the dead-box
  });

  it('painting out the prey banks a ROUND for the pack — the series plays on', () => {
    const { w, prey } = yard();
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    w.step(1 / 60, new Map());
    expect(w.mode.roundWins).toEqual([1, 0]);
    expect(w.mode.over).toBe(false);            // best of 5 — one splat ≠ the afternoon
    expect(w.mode.intermission).toBeGreaterThan(0);
  });

  it('tagging all three points banks the round for the prey', () => {
    const { w, prey } = yard();
    for (const p of w.mode.points!) {
      prey.pos = { ...p.pos };
      for (let i = 0; i < 130; i++) w.step(1 / 60, new Map([[prey.id, cmd()]]));
      if ((w.mode.roundWins ?? [0, 0])[1] > 0) break;
    }
    expect(w.mode.roundWins).toEqual([0, 1]);
    expect(w.mode.over).toBe(false);
  });

  it('outliving the clock banks the round for the prey', () => {
    const { w } = yard();
    w.mode.timeLeft = 0.05;
    for (let i = 0; i < 10; i++) w.step(1 / 60, new Map());
    expect(w.mode.roundWins).toEqual([0, 1]);
    expect(w.mode.over).toBe(false);
  });

  it('markers are honest paint: every one splats in a single hit', () => {
    for (const id of ['marker_blitz', 'marker_pump', 'marker_lobber']) {
      expect(WEAPONS[id].damage).toBeGreaterThanOrEqual(999);
    }
  });

  it('balls fly slow enough to SEE — paint you can dodge (Robert: too hard)', () => {
    for (const id of ['marker_blitz', 'marker_pump', 'marker_lobber']) {
      expect(WEAPONS[id].speed, `${id} should be dodgeable`).toBeLessThanOrEqual(65);
    }
  });

  it('the yard stays sunny — no whiteout in anyone\'s first hour', () => {
    const { w } = yard();
    expect(w.weather.until).toBe(Infinity);
    expect(w.weather.kind).toBe('clear');
  });
});

// ---------------------------------------------------------------------------
// THE SERIES (Robert: "best out of 5") — first to 3 round wins. One quick
// splat costs a round, never the afternoon; the whistle resets the yard.
// ---------------------------------------------------------------------------
describe('the series', () => {
  /** step the sim `sec` seconds, collecting every event on the way */
  const run = (w: World, sec: number) => {
    const events: { type: string; text?: string }[] = [];
    for (let i = 0; i < Math.ceil(sec * 60); i++) {
      w.step(1 / 60, new Map());
      events.push(...w.takeEvents());
    }
    return events;
  };

  it('a round end blows the whistle, and the next whistle walks everyone back on', () => {
    const { w, prey, hunters } = yard();
    hunters[0].pos = { x: 11, y: 0, z: 7 };  // remember a mid-yard position
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    const endEvents = run(w, 0.1);
    expect(endEvents.some((e) => e.type === 'whistle'), 'round-end whistle').toBe(true);

    const resetEvents = run(w, 4.5);          // through the 4s intermission
    expect(resetEvents.some((e) => e.type === 'whistle'), 'round-start whistle').toBe(true);
    expect(resetEvents.some((e) => e.type === 'announce' && e.text === 'ROUND 2')).toBe(true);
    expect(w.mode.round).toBe(2);
    expect(prey.alive, 'the splatted walk back on').toBe(true);
    expect(w.mode.timeLeft).toBeGreaterThan(100);              // fresh clock
    for (const p of w.mode.points!) expect(p.owner).toBe(-1);  // pads wiped
  });

  it('round 2 keeps yard law: marker only, no sidearm, no frags', () => {
    const { w, prey, hunters } = yard();
    // impose match-setup yard law (main.ts does this at deploy)
    for (const s of [prey, ...hunters]) { s.weapons = [s.weapons[0]]; s.clip = [30]; s.reserve = [100]; s.grenades = 0; }
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    run(w, 5); // round ends, intermission passes, round 2 starts
    expect(w.mode.round).toBe(2);
    for (const s of [prey, ...hunters]) {
      expect(s.weapons.length, `${s.name} smuggled a sidearm past the whistle`).toBe(1);
      expect(s.weapons[0].startsWith('marker'), `${s.name} holds ${s.weapons[0]}`).toBe(true);
      expect(s.grenades, `${s.name} smuggled frags into the yard`).toBe(0);
    }
  });

  it('a fresh round opens with walk-on protection — a real "ten seconds, go!"', () => {
    const { w, prey } = yard();
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    run(w, 5);                            // round 2 is ~1s old now
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    expect(prey.alive, 'paint slid off the walk-on grace').toBe(true);
    expect(prey.protectedUntil).toBeGreaterThan(w.time);
  });

  it('first to 3 round wins takes the series — and only then is it over', () => {
    const { w, prey } = yard();
    for (let round = 1; round <= 3; round++) {
      prey.protectedUntil = 0;           // past the walk-on grace
      w.damageSoldier(prey, 999, -1, 'marker_blitz');
      run(w, 0.1);                       // bank the round
      if (round < 3) {
        expect(w.mode.over, `series ended early at round ${round}`).toBe(false);
        run(w, 4.5);                     // intermission → next round revives the prey
        expect(prey.alive).toBe(true);
      }
    }
    expect(w.mode.roundWins).toEqual([3, 0]);
    expect(w.mode.over, 'three round wins IS the series').toBe(true);
    expect(w.mode.winner).toBe(0);
  });

  it('match point gets announced — tension is the product', () => {
    const { w, prey } = yard();
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    run(w, 5);
    prey.protectedUntil = 0;             // past the walk-on grace
    w.damageSoldier(prey, 999, -1, 'marker_blitz');
    const events = run(w, 0.2);          // pack reaches 2 wins = match point
    expect(events.some((e) => e.type === 'announce' && e.text === 'MATCH POINT')).toBe(true);
  });

  // Regression: misses used to reach the renderer with no owner at all, so
  // every wall splat fell back to one stranger's shade — you picked cyan and
  // painted the yard red. A miss must still name its thrower, and must still
  // keep the HUD quiet (soldierId is the hitmarker's cue, not the decal's).
  it('a ball that eats a wall still names who threw it — and taps no hitmarker (Robert)', () => {
    const { w, hunters } = yard();
    const shooter = hunters[0];
    // stand him off against the map rim and hold the trigger into it
    shooter.pos.x = -140; shooter.pos.z = 0;
    const intoTheFence = cmd({ fire: true, aimYaw: -Math.PI / 2 });
    const wallHits: { ownerId?: number; soldierId?: number }[] = [];
    for (let i = 0; i < 120; i++) {
      w.step(1 / 60, new Map([[shooter.id, intoTheFence]]));
      for (const e of w.takeEvents()) {
        if (e.type === 'hit' && e.weapon?.startsWith('marker') && e.soldierId === undefined) {
          wallHits.push({ ownerId: e.ownerId, soldierId: e.soldierId });
        }
      }
    }
    expect(wallHits.length, 'the fence should have eaten some paint').toBeGreaterThan(0);
    for (const h of wallHits) {
      expect(h.ownerId, 'a miss must still wear its thrower').toBe(shooter.id);
      expect(h.soldierId, 'a miss must not flash a phantom tag').toBeUndefined();
    }
  });
});
