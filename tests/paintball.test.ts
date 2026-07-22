// ---------------------------------------------------------------------------
// PAINTBALL — Hunters vs Hunted (§3.3/§14). The onboarding yard: one prey,
// one pack, two-minute rounds, one splat and you sit down. The prey tags
// three points or survives the clock; the pack paints them out.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GRID, PAINTBALL_FIELDS, T_COVER, T_OPEN, T_WALL, TILE, WORLD,
  generatePaintballField, isBlocked, tileAt,
} from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import { buildWeaponModel } from '../src/client/models';
import { updateHopper } from '../src/client/hopper';
import type { PlayerCmd, Projectile, Soldier, WeaponId } from '../src/sim/types';

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

  it('balls fly in the paint band — dodgeable, never floaty (Robert, third pass)', () => {
    // Measured against a RIFLE, not against a constant — what matters is how
    // paint compares to live rounds, not the absolute number. The bar has
    // moved twice: pass one "too hard" pulled paint under the rifle; pass two
    // pinned it at a quarter-rifle; pass three found THAT floaty ("the
    // paintball seemed too slow… way faster than it is right now, but slower
    // than the bullets"). The band that survives all three: direct-fire
    // markers fly at roughly half a rifle round — never under 0.45x (floaty),
    // never over 0.7x (undodgeable). The Lobber arcs, so it only wears the
    // ceiling; its drama is the rainbow, not the straight line.
    const rifle = WEAPONS.ar606.speed;
    for (const id of ['marker_blitz', 'marker_pump', 'marker_lobber']) {
      const ratio = WEAPONS[id].speed / rifle;
      expect(ratio, `${id} flies at ${ratio.toFixed(2)}x a rifle round`).toBeLessThan(0.7);
    }
    for (const id of ['marker_blitz', 'marker_pump']) {
      const ratio = WEAPONS[id].speed / rifle;
      expect(ratio, `${id} floats at ${ratio.toFixed(2)}x a rifle round`).toBeGreaterThan(0.45);
    }
  });

  it('the dash works in the yard — the stamina burst is paintball law too (Robert)', () => {
    // "we have the dashes right… but what if you could do that during
    // paintball?" You can — movement verbs are global, not mode-gated —
    // and this test keeps it that way. The prey spawns on the east fence,
    // so the dash aims WEST, into the yard.
    const { w, prey } = yard();
    const e0 = prey.energy;
    const x0 = prey.pos.x;
    w.step(1 / 60, new Map([[prey.id, cmd({ dash: 1, aimYaw: Math.PI })]]));
    const events = w.takeEvents();
    expect(events.some((e) => e.type === 'dash'), 'the dash event fires in paintball').toBe(true);
    expect(prey.energy, 'the burst is PAID for — stamina is the meter').toBeLessThan(e0 - 20);
    for (let i = 0; i < 30; i++) w.step(1 / 60, new Map([[prey.id, cmd()]]));
    expect(x0 - prey.pos.x, 'the burst actually carries you').toBeGreaterThan(1.5);
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

// ---------------------------------------------------------------------------
// THE LIVING HOPPER (Robert: "imagine a transparent hopper, and you seeing it
// like slowly come out… see a ball just drop out of each one"). The marker
// models carry a see-through shell with named balls; client/hopper.ts drives
// them off the sim's REAL clip. These tests pin both halves of the contract.
// ---------------------------------------------------------------------------
describe('the living hopper', () => {
  const gunFor = (id: string) => buildWeaponModel(id);
  const soldierWith = (id: WeaponId, clip: number) =>
    ({ weapons: [id], weaponIdx: 0, clip: [clip] }) as unknown as Soldier;

  it('every marker ships the hopper contract: shell, named balls, feed ball', () => {
    for (const id of ['marker_blitz', 'marker_pump', 'marker_lobber'] as const) {
      const g = gunFor(id);
      const spec = g.userData.hopper as { balls: number };
      expect(spec, `${id} declares its hopper`).toBeTruthy();
      for (let i = 0; i < spec.balls; i++) {
        expect(g.getObjectByName(`pb-ball-${i}`), `${id} ball ${i}`).toBeTruthy();
      }
      const shell = g.getObjectByName('pb-shell') as THREE.Mesh;
      expect(shell, `${id} shell`).toBeTruthy();
      expect((shell.material as THREE.MeshStandardMaterial).transparent, 'you can SEE the paint').toBe(true);
      const feed = g.getObjectByName('pb-feed')!;
      expect(feed.visible, 'the feed ball waits for a shot').toBe(false);
    }
  });

  it('the pump and the lobber show ONE ball per shot — the clip is the shell', () => {
    expect((gunFor('marker_pump').userData.hopper as { balls: number }).balls).toBe(WEAPONS.marker_pump.clip);
    expect((gunFor('marker_lobber').userData.hopper as { balls: number }).balls).toBe(WEAPONS.marker_lobber.clip);
  });

  it('the shell drains with the clip, a shot drops the feed ball, a reload refills', () => {
    const g = gunFor('marker_pump');
    const step = (clip: number, frames = 1) => {
      for (let f = 0; f < frames; f++) updateHopper(g, soldierWith('marker_pump', clip), f / 60, 1 / 60);
    };
    const visible = () => {
      let n = 0;
      for (let i = 0; i < 8; i++) if (g.getObjectByName(`pb-ball-${i}`)!.visible) n++;
      return n;
    };
    step(8);
    expect(visible(), 'a full clip is a full shell').toBe(8);
    step(4);
    expect(visible(), 'half a clip is half a shell').toBe(4);
    const feed = g.getObjectByName('pb-feed')!;
    expect(feed.visible, 'the shot sends a ball through the neck').toBe(true);
    step(4, 60); // let the drop finish — the ball is swallowed by the body
    expect(feed.visible).toBe(false);
    step(0);
    expect(visible(), 'an empty gun is an empty window').toBe(0);
    step(8);
    expect(visible(), 'the reload pours the pod back in').toBe(8);
  });

  it('a shot RATTLES the load — and a settled hopper sits still again', () => {
    const g = gunFor('marker_blitz');
    const s30 = soldierWith('marker_blitz', 30);
    updateHopper(g, s30, 0, 1 / 60);
    const ball = g.getObjectByName('pb-ball-0')!;
    const rest = (ball.userData.rest as THREE.Vector3).clone();
    updateHopper(g, soldierWith('marker_blitz', 29), 0.5, 1 / 60);
    expect(ball.position.distanceTo(rest), 'the load shifts when the gun cycles').toBeGreaterThan(0.0005);
    // ~2 seconds of quiet and the balls settle back onto their rests
    for (let f = 0; f < 120; f++) updateHopper(g, soldierWith('marker_blitz', 29), 0.5 + f / 60, 1 / 60);
    expect(ball.position.distanceTo(rest)).toBeLessThan(0.0005);
  });
});

// ---------------------------------------------------------------------------
// THE YARD SURVIVES THE LESSON (Robert: "we gotta change the mechanics of the
// paintball. Right now it destroys the structure.")
//
// Markers carry damage 999 so paint rides the overkill rule and skips the
// down-and-crawl — nobody bleeds in the yard. But every wall in the game
// breaches on `damage >= 100`, so that same 999 quietly made a training round
// the most destructive weapon in the game: one ball turned masonry to rubble,
// a second erased it to open ground, and the Lobber's splashDamage 999 landed
// ~1500 across a 3.3u circle. The boot camp was demolishing its own cover.
//
// The fix is not a smaller number — the 999 is load-bearing. It is declaring
// what a training round IS: it marks men, never buildings.
// ---------------------------------------------------------------------------
describe('training rounds leave the architecture alone', () => {
  const MARKERS = ['marker_blitz', 'marker_pump', 'marker_lobber'] as const;

  /**
   * Fire a REAL round at a real tile and let the sim resolve it. An earlier
   * cut of this suite called damageSurface() directly and "passed" against
   * code that still demolished the yard — the guard lives on the projectile's
   * impact branch, so a test that skips the projectile skips the guard.
   */
  function shootTile(weapon: WeaponId, kind: number) {
    const w = new World({ seed: 4, mode: 'tdm' });
    const tx = Math.floor(GRID / 2), tz = Math.floor(GRID / 2);
    const idx = tz * GRID + tx;
    w.map.grid[idx] = kind;
    for (let d = 1; d <= 4; d++) w.map.grid[idx - d] = T_OPEN; // a clear lane
    const cx = (tx + 0.5) * TILE - WORLD / 2;
    const cz = (tz + 0.5) * TILE - WORLD / 2;
    const def = WEAPONS[weapon];
    w.launch({
      id: 90001, weapon, ownerId: -1, team: 0,
      pos: { x: cx - TILE * 2.5, y: 1, z: cz },
      vel: { x: def.speed, y: 0, z: 0 },
      bornAt: w.time, ttl: 3, arc: false,
    } as Projectile);
    for (let i = 0; i < 240 && w.projectiles.size; i++) w.step(1 / 60, new Map());
    return w.map.grid[idx];
  }

  it('every marker is DECLARED a training round — and nothing else is', () => {
    for (const id of MARKERS) expect(WEAPONS[id].training, id).toBe(true);
    const strays = Object.values(WEAPONS)
      .filter((d) => d.training && !MARKERS.includes(d.id as typeof MARKERS[number]));
    expect(strays.map((d) => d.id), 'live ordnance must never be marked training').toEqual([]);
  });

  for (const id of MARKERS) {
    it(`${id} cannot breach masonry`, () => {
      expect(shootTile(id, T_WALL), 'the wall must still be a wall').toBe(T_WALL);
    });
    it(`${id} cannot shred soft cover`, () => {
      expect(shootTile(id, T_COVER)).toBe(T_COVER);
    });
  }

  it('the Lobber no longer flattens the circle it lands in', () => {
    const w = new World({ seed: 4, mode: 'tdm' });
    const cx = Math.floor(GRID / 2), cz = Math.floor(GRID / 2);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) w.map.grid[(cz + dz) * GRID + cx + dx] = T_COVER;
    }
    w.explode(
      { x: (cx + 0.5) * TILE - WORLD / 2, y: 0.5, z: (cz + 0.5) * TILE - WORLD / 2 },
      WEAPONS.marker_lobber, -1, 0,
    );
    let gone = 0;
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) if (w.map.grid[(cz + dz) * GRID + cx + dx] === T_OPEN) gone++;
    }
    expect(gone, 'one lobbed ball used to erase every destructible tile in reach').toBe(0);
  });

  it('CONTROL: real ordnance still breaks things, so the gate is not just off', () => {
    // Sandbag, not masonry: one 120mm lands (60 + 110*0.5) = 115 on a wall and
    // masonry carries 300hp, so a shell is SUPPOSED to need three goes at a
    // wall. It flattens an 80hp earthwork in one — the cleanest proof the
    // destruction ledger still works for everything that isn't paint.
    expect(shootTile('tank_cannon', T_COVER), 'a paint rule, not a peace treaty')
      .not.toBe(T_COVER);
  });
});
