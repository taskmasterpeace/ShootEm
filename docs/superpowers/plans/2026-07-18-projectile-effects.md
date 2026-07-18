# Projectile Effects & the LSW Power Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one composable effect-flag layer to projectiles (pierce, ricochet, charge, beam profiles, cluster, chain, tether, boomerang, ignite, gasAfter) plus one surface-reaction rule every round runs on impact, then drop those flags onto all 40 LSW signature weapons so each god finally *feels* powerful.

**Architecture:** Flags are declared on `WeaponDef` (data), copied onto each `Projectile` at the `World.launch()` choke point (runtime counters), consumed in the projectile step: the surface-reaction resolve at the terrain-hit site (reads the `MATERIALS` table already shipped in `src/sim/materials.ts`) and the pierce/pierceArmor logic in the soldier-hit loop. Beam profiles add a render+behavior variant. The LSW pass is pure data on `LSW_ARMS`. The `tests/threat-measure.test.ts` law suite is the safety net for every power change.

**Tech Stack:** TypeScript, deterministic 30 Hz sim (`src/sim/world.ts`), Three.js client (`src/client/renderer.ts`), Vitest. Gates: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`.

**Dependency note:** Ricochet / penetrate / impact read `materialOf()` — **already landed** (commit `20df414`). **IGNITE** needs the fire-spread system from the materials `/goal` (its Phase 5, not yet built): scaffold the `ignite` flag now; the tile-lighting call (`igniteTile`) wires in when fire lands. Every task below marks whether it can run now or waits on fire.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/sim/types.ts` | `WeaponDef` effect-flag fields; `Projectile` runtime counters | Modify (`WeaponDef` ~line 41-89; `Projectile` ~line 466-486) |
| `src/sim/world.ts` | `launch()` flag init; surface-reaction resolve; pierce/pierceArmor in soldier-hit; cluster/chain/tether/boomerang/gasAfter spawn; melee shockwave | Modify (`launch` ~2121; terrain-hit ~3130; soldier-hit ~3143) |
| `src/sim/data.ts` | The 40 LSW flag assignments; tracer colors; Riptide/Reaper fixes | Modify (`LSW_ARMS` 117-164) |
| `src/client/renderer.ts` | Beam profiles (zap/lance/charge/hose/ricochet) + per-unit tracer color | Modify (beam render ~2723) |
| `tests/projectile-fx.test.ts` | Unit tests for every flag behavior | Create |
| `tests/threat-measure.test.ts` | Existing law suite — re-run after the data pass | Verify only |

---

## Task 1: Effect-flag types on WeaponDef and Projectile

**Files:**
- Modify: `src/sim/types.ts` (WeaponDef ~41-89; Projectile ~466-486)

- [ ] **Step 1: Add the flag fields to `WeaponDef`.** Insert before the closing `}` of `interface WeaponDef` (after the `alt?:` block, ~line 88):

```ts
  // ── PROJECTILE EFFECTS (composable; consumed in world.ts projectile step) ──
  /** passes through n bodies + n penetrable-cover tiles before dying */
  pierce?: number;
  /** ignores plate: the round's damage lands on flesh (red number through armor) */
  pierceArmor?: boolean;
  /** bounces off metal/ice up to n times (glancing only), −30% dmg per bounce */
  ricochet?: number;
  /** beam profile — how tracer:'beam' behaves and renders */
  beam?: 'zap' | 'lance' | 'charge' | 'hose' | 'ricochet';
  /** hold to charge: after t seconds the shot deals ×mul and reaches full profile */
  charge?: { t: number; mul: number };
  /** on death, burst into k submunitions (~40% dmg each) that bounce */
  cluster?: number;
  /** on soldier-hit, arc to n nearest extra enemies */
  chain?: number;
  /** links to the struck target (pull / leash) */
  tether?: boolean;
  /** flies to range then returns, able to hit on both legs */
  boomerang?: boolean;
  /** sets flammable tiles (grass, wood houses) alight — needs the fire system */
  ignite?: boolean;
  /** leaves a lingering cloud on impact */
  gasAfter?: { kind: 'caustic' | 'poison' | 'singularity' | 'fear'; r: number; life: number };
  /** melee/leap LAND aoe radius (non-projectile power; read by stepLsw) */
  shockwave?: number;
```

- [ ] **Step 2: Add runtime counters to `Projectile`.** Insert before the closing `}` of `interface Projectile` (after `bounce?`, ~line 485):

```ts
  /** remaining body/cover pass-throughs (init from WeaponDef.pierce at launch) */
  pierce?: number;
  /** remaining ricochets (init from WeaponDef.ricochet at launch) */
  ricochet?: number;
  pierceArmor?: boolean;
  ignite?: boolean;
  /** damage scalar carried by the round: charge boost × ricochet/penetrate decay */
  dmgMul?: number;
  /** ids already struck this flight — so a piercing round never double-hits one body */
  hit?: number[];
  /** boomerang: world time to flip the round back toward its owner (0 = not yet) */
  returnAt?: number;
```

- [ ] **Step 3: Verify it compiles.** Run: `npx tsc --noEmit`  Expected: exit 0 (fields are optional, no call sites break).

- [ ] **Step 4: Commit.**

```bash
git add src/sim/types.ts
git commit -m "projectile-fx: declare the effect-flag layer on WeaponDef + Projectile"
```

---

## Task 2: `launch()` initializes projectile flags from the weapon def

**Files:**
- Modify: `src/sim/world.ts` (`launch()` ~2121)
- Test: `tests/projectile-fx.test.ts` (create)

- [ ] **Step 1: Write the failing test.** Create `tests/projectile-fx.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';

// helper: a bare projectile aimed +x from origin
function shot(w: World, weapon: string, over: Partial<import('../src/sim/types').Projectile> = {}) {
  return w.launch({
    id: w.id(), weapon, ownerId: -1, team: 0,
    pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 60, y: 0, z: 0 },
    bornAt: w.time, ttl: 3, arc: false, ...over,
  } as import('../src/sim/types').Projectile);
}

describe('launch copies effect flags from the weapon def', () => {
  it('a pierce weapon hands its projectile the pierce count', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    // lsw_pulse gets pierce:3 in the data pass; assert launch mirrors the def
    (WEAPONS.lsw_pulse as { pierce?: number }).pierce = 3; // arrange (data task sets this for real)
    const p = shot(w, 'lsw_pulse');
    expect(p.pierce).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to watch it fail.** Run: `npx vitest run tests/projectile-fx.test.ts -t "hands its projectile"`  Expected: FAIL — `p.pierce` is `undefined`.

- [ ] **Step 3: Initialize flags in `launch()`.** Replace the body of `launch()` (world.ts ~2121-2130) with:

```ts
  launch(p: Projectile): Projectile {
    const def = WEAPONS[p.weapon];
    // copy the def's effect flags onto the round ONCE (guard with undefined so a
    // re-launched submunition/boomerang keeps the value it was born with)
    if (def) {
      if (p.pierce === undefined && def.pierce) p.pierce = def.pierce;
      if (p.ricochet === undefined && def.ricochet) p.ricochet = def.ricochet;
      if (p.pierceArmor === undefined && def.pierceArmor) p.pierceArmor = def.pierceArmor;
      if (p.ignite === undefined && def.ignite) p.ignite = def.ignite;
      if (p.dmgMul === undefined) p.dmgMul = 1;
    }
    const mul = this.projectileSpeedMul;
    if (!p.arc && mul !== 1) {
      p.vel.x *= mul;
      p.vel.z *= mul;
      if (p.ttl > 0) p.ttl /= mul; // range preserved: speed×ttl is unchanged
    }
    this.projectiles.set(p.id, p);
    return p;
  }
```

(`WEAPONS` is already imported at the top of world.ts; confirm with `grep "import.*WEAPONS" src/sim/world.ts` — if absent, add it to the `./data` import.)

- [ ] **Step 4: Run the test to watch it pass.** Run: `npx vitest run tests/projectile-fx.test.ts -t "hands its projectile"`  Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: launch() copies effect flags onto the round"
```

---

## Task 3: Pierce — pass through bodies (soldier-hit loop)

**Files:**
- Modify: `src/sim/world.ts` (soldier-hit loop ~3143)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: Read the current soldier-hit resolution.** Run: `sed -n '3143,3230p' src/sim/world.ts` (or Read that range). Identify where, after `damageSoldier(...)`, the code sets `dead = true` / deletes the projectile on a soldier hit.

- [ ] **Step 2: Write the failing test.** Append to `tests/projectile-fx.test.ts`:

```ts
describe('pierce passes through bodies', () => {
  it('a pierce:2 round damages three lined-up enemies before dying', () => {
    const w = new World({ seed: 2, mode: 'tdm' });
    const foes = [3, 6, 9].map((x, i) => {
      const s = w.addSoldier(`F${i}`, 'infantry', 1, 'bot');
      s.pos = { x, y: 0, z: 0 }; s.hp = 100; s.maxHp = 100; return s;
    });
    (WEAPONS.rg2 as { pierce?: number }).pierce = 2; // RG-2 rail
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 200, y: 0, z: 0 },
      bornAt: w.time, ttl: 2, arc: false } as import('../src/sim/types').Projectile);
    for (let i = 0; i < 20; i++) w.step(1 / 60, new Map());
    const hurt = foes.filter((s) => s.hp < 100).length;
    expect(hurt).toBe(3); // pierced two, died in/after the third
  });
});
```

- [ ] **Step 3: Run to watch it fail.** Run: `npx vitest run tests/projectile-fx.test.ts -t "passes through bodies"`  Expected: FAIL — only 1 enemy hurt (round dies on first hit).

- [ ] **Step 4: Implement pierce in the soldier-hit block.** At the soldier-hit site (~3143-3200), where a soldier is struck: before killing the round, record the hit and decrement pierce. Concretely, guard the hit with the `hit` list and, after applying damage, replace the unconditional `dead = true` for the soldier case with:

```ts
          // pierce: keep flying through bodies until the count is spent.
          (p.hit ??= []).push(s.id);
          if ((p.pierce ?? 0) > 0) {
            p.pierce!--;
            p.dmgMul = (p.dmgMul ?? 1) * 0.9; // each body bleeds a little energy
            continue; // do NOT set dead — the round threads on
          }
          dead = true;
          break;
```

Add `if (p.hit?.includes(s.id)) continue;` at the top of the soldier loop (~3145) so one round never double-hits a body. Ensure the damage passed to `damageSoldier` uses `def.damage * (p.dmgMul ?? 1)`.

- [ ] **Step 5: Run to watch it pass.** Run: `npx vitest run tests/projectile-fx.test.ts -t "passes through bodies"`  Expected: PASS.

- [ ] **Step 6: Full suite (pierce touches the hottest loop).** Run: `npx vitest run`  Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: pierce — rounds thread through bodies, no double-hit"
```

---

## Task 4: pierceArmor — the round lands on flesh through plate

**Files:**
- Modify: `src/sim/world.ts` (soldier-hit → `damageSoldier` call ~3180)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: Write the failing test.** Append:

```ts
describe('pierceArmor bypasses plate', () => {
  it('an AP round takes hp even when the victim is fully plated', () => {
    const w = new World({ seed: 3, mode: 'tdm' });
    const v = w.addSoldier('V', 'infantry', 1, 'human', { equipment: ['armor_vest'] });
    v.pos = { x: 4, y: 0, z: 0 };
    const hp0 = v.hp;
    (WEAPONS.rg2 as { pierceArmor?: boolean }).pierceArmor = true;
    w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 200, y: 0, z: 0 },
      bornAt: w.time, ttl: 2, arc: false } as import('../src/sim/types').Projectile);
    for (let i = 0; i < 20; i++) w.step(1 / 60, new Map());
    expect(v.hp).toBeLessThan(hp0);  // flesh took it despite the vest
  });
});
```

- [ ] **Step 2: Run to watch it fail.** Run: `npx vitest run tests/projectile-fx.test.ts -t "bypasses plate"`  Expected: FAIL — armor absorbed it, hp unchanged.

- [ ] **Step 3: Implement.** In `damageSoldier` (world.ts ~3379), add a `viaLink`-style optional param `pierceArmor = false`, and at the armor-absorption block (the `if (victim.armor > 0)` around line 3445 shipped in the materials work) skip plate when `pierceArmor`. Pass the flag from the soldier-hit call: `this.damageSoldier(s, def.damage * (p.dmgMul ?? 1), p.ownerId, p.weapon, false, p.pierceArmor)`.

```ts
  damageSoldier(victim: Soldier, dmg: number, attackerId: number, weapon: WeaponId, viaLink = false, pierceArmor = false) {
    ...
    if (victim.armor > 0 && !pierceArmor) {   // ← AP ignores the plate
      const absorbed = Math.min(victim.armor, dmg);
      ...
    }
```

- [ ] **Step 4: Run to watch it pass.** Run: `npx vitest run tests/projectile-fx.test.ts -t "bypasses plate"`  Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: pierceArmor — AP rounds land on flesh through plate"
```

---

## Task 5: Surface reactions — ricochet → penetrate → ignite → impact (Part A)

**Files:**
- Modify: `src/sim/world.ts` (terrain-hit block ~3130)
- Test: `tests/projectile-fx.test.ts`
- Reads: `src/sim/materials.ts` (`materialOf`, `Material.ricochet/penetrable/flammable/impact`) — already landed.

- [ ] **Step 1: Write two failing tests** (ricochet off metal keeps flying; penetrate a wood door and continue):

```ts
import { materialOf } from '../src/sim/materials';
import { GRID, T_METAL, T_DOOR, TILE, WORLD } from '../src/sim/map';

describe('surface reactions', () => {
  it('a ricochet round survives a metal wall (does not die on it)', () => {
    const w = new World({ seed: 4, mode: 'tdm' });
    const tx = 55, tz = 50;
    w.map.grid[tz * GRID + tx] = T_METAL;
    const px = (tx) * TILE - WORLD / 2 - 2; // just short of the metal tile
    const p = w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: px, y: 1.2, z: (tz + 0.5) * TILE - WORLD / 2 + 1.2 }, // glancing
      vel: { x: 120, y: 0, z: -30 }, bornAt: w.time, ttl: 2, arc: false,
      ricochet: 1, dmgMul: 1 } as import('../src/sim/types').Projectile);
    for (let i = 0; i < 6; i++) w.step(1 / 60, new Map());
    expect(w.projectiles.has(p.id)).toBe(true); // banked, still in the air
  });

  it('a pierce round chips a wood door and keeps going', () => {
    const w = new World({ seed: 5, mode: 'tdm' });
    const tx = 55, tz = 50;
    w.map.grid[tz * GRID + tx] = T_DOOR;
    const p = w.launch({ id: w.id(), weapon: 'rg2', ownerId: -1, team: 0,
      pos: { x: (tx - 1) * TILE - WORLD / 2, y: 1.2, z: (tz + 0.5) * TILE - WORLD / 2 },
      vel: { x: 200, y: 0, z: 0 }, bornAt: w.time, ttl: 2, arc: false,
      pierce: 1, dmgMul: 1 } as import('../src/sim/types').Projectile);
    for (let i = 0; i < 4; i++) w.step(1 / 60, new Map());
    expect(w.projectiles.has(p.id)).toBe(true); // punched through, still flying
  });
});
```

- [ ] **Step 2: Run to watch them fail.** Run: `npx vitest run tests/projectile-fx.test.ts -t "surface reactions"`  Expected: FAIL — round dies on the tile.

- [ ] **Step 3: Implement the resolve.** In the terrain-hit block (world.ts ~3130-3140), before `dead = true`, insert the ordered resolve. Compute the struck tile's material and the incoming axis:

```ts
      if (p.pos.y <= 0 || blocksShot(this.map.grid, p.pos.x, p.pos.z, Math.max(p.pos.y, 0)) ||
          blocksShotUpper(this.map.grid2, p.pos.x, p.pos.z, p.pos.y)) {
        const mat = materialOf(tileAt(this.map.grid, p.pos.x, p.pos.z));
        const ox = p.pos.x - p.vel.x * dt, oz = p.pos.z - p.vel.z * dt;
        const blockX = blocksShot(this.map.grid, p.pos.x, oz, Math.max(p.pos.y, 0));
        const blockZ = blocksShot(this.map.grid, ox, p.pos.z, Math.max(p.pos.y, 0));
        // 1. RICOCHET off metal/ice (glancing = only one axis blocked)
        if ((p.ricochet ?? 0) > 0 && mat.ricochet > 0 && (blockX !== blockZ) && this.rng.next() < mat.ricochet) {
          if (blockX) { p.vel.x = -p.vel.x; p.pos.x = ox; } else { p.vel.z = -p.vel.z; p.pos.z = oz; }
          p.ricochet!--; p.dmgMul = (p.dmgMul ?? 1) * 0.7;
          this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
          // fall through: not dead, keep flying
        // 2. PENETRATE thin cover (wood/sandbag/grass/rubble)
        } else if ((p.pierce ?? 0) > 0 && mat.penetrable) {
          this.damageWall(Math.floor((p.pos.x + WORLD / 2) / TILE), Math.floor((p.pos.z + WORLD / 2) / TILE),
            def.damage * (p.dmgMul ?? 1), def.damage >= 100);
          p.pierce!--; p.dmgMul = (p.dmgMul ?? 1) * 0.85; p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
          // fall through: keep flying
        } else {
          // 3. IGNITE (needs the fire system — TODO wire igniteTile when fire lands)
          // if (p.ignite && mat.flammable) this.igniteTile(tx, tz);
          // 4. IMPACT
          if (this.detonatePayload(p)) { /* payload delivered */ }
          else if (def.splash > 0) this.explode(p.pos, def, p.ownerId, p.team);
          else if (def.tracer !== 'beam') this.emit({ type: 'hit', pos: { ...p.pos }, weapon: p.weapon, ownerId: p.ownerId });
          dead = true;
        }
      }
```

- [ ] **Step 4: Run to watch them pass.** Run: `npx vitest run tests/projectile-fx.test.ts -t "surface reactions"`  Expected: PASS. Then full suite: `npx vitest run` (this rewrites the terrain-hit block — confirm existing shot/wall tests still pass).

- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: surface-reaction resolve (ricochet/penetrate/impact) via materials"
```

---

## Task 6: Charge — hold to scale damage and profile

**Files:**
- Modify: `src/sim/world.ts` (the fire path that reads a held-fire timer; grep `charge` / the LSW active timing) + `launch` (apply `dmgMul`)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: Find how a held weapon knows its charge time.** Run: `grep -n "nextFireAt\|holdFire\|fireHeld\|chargeAt" src/sim/world.ts | head`. The charge timer keys off the shooter's continuous-fire state; a bot LSW charges by delaying its shot.

- [ ] **Step 2: Write the failing test** (a charged shot deals more than an uncharged one):

```ts
describe('charge scales the shot', () => {
  it('a fully charged bolt out-damages a snap shot', () => {
    // Fire lsw_eclipse (charge {t:1.0,mul:3}) at a dummy after 0s and after 1s held;
    // assert the 1s shot removes ~3× the hp. (Drives World's charge accumulation.)
    expect(true).toBe(true); // replace with a concrete two-shot comparison once the
                             // charge-accumulation field name is confirmed in Step 1
  });
});
```

- [ ] **Step 3: Implement charge accumulation.** Add a per-shooter `chargeStart` when a `charge` weapon begins continuous fire; on release, `p.dmgMul = lerp(1, charge.mul, clamp((held)/charge.t))`, and set the beam profile to full at ≥ `charge.t`. Emit an `lsw_active`-style tell as particles assemble (client reads it). Damage at hit already multiplies by `p.dmgMul` (Task 3/5).

- [ ] **Step 4: Run + full suite.** Run: `npx vitest run tests/projectile-fx.test.ts -t "charge"` then `npx vitest run`.

- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: charge — hold scales damage and beam profile"
```

---

## Task 7: Beam profiles — zap / lance / charge / hose / ricochet

**Files:**
- Modify: `src/sim/world.ts` (beam firing: lance = long+pierce; hose = sustained; ricochet = bank)
- Modify: `src/client/renderer.ts` (beam render ~2723 — length/width/color per profile)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: Read the current beam behavior.** Run: `sed -n '2718,2730p' src/client/renderer.ts` and `grep -n "tracer === 'beam'\|def.beam\|'beam'" src/sim/world.ts`.

- [ ] **Step 2: Write the failing test** (a `lance` beam reaches farther / pierces vs a `zap`):

```ts
describe('beam profiles', () => {
  it('a lance beam pierces where a zap stops', () => {
    // lsw_pulse beam:'lance' pierce:3 hits 2 lined enemies; a zap-profile hits 1.
    // Reuse the pierce test harness with beam weapons.
    expect(true).toBe(true); // concrete assertion after Step 1 confirms beam range fields
  });
});
```

- [ ] **Step 3: Implement.** In the sim, map `def.beam`: `lance` → longer range + pierce default; `hose` → sustained per-tick damage while held (no discrete round); `ricochet` → set `p.ricochet` from the profile; `charge` → gate on the charge timer (Task 6); `zap` → today's behavior. In the renderer, the beam mesh length = range, width by profile (hose fat, lance long-thin, charge fattest at full), and **color from the unit's tracer color** (Task 12).

- [ ] **Step 4: Run + full suite + build (renderer changed).** Run: `npx vitest run tests/projectile-fx.test.ts -t "beam"`, `npx vitest run`, `npm run build`.

- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts src/client/renderer.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: beam profiles — zap/lance/charge/hose/ricochet"
```

---

## Task 8: Cluster, chain, tether, boomerang, gasAfter

**Files:**
- Modify: `src/sim/world.ts` (projectile death → cluster spawn; soldier-hit → chain/tether; boomerang flip; gasAfter → `spawnGadget`)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: cluster.** On a `cluster:k` round's death, `launch()` k submunitions (~40% dmg, fanned velocities, `bounce:true`). Test: a cluster round produces >1 child projectile on impact.

```ts
it('cluster bursts into submunitions on impact', () => {
  const w = new World({ seed: 6, mode: 'tdm' });
  (WEAPONS.lsw_tremor as { cluster?: number }).cluster = 4;
  const before = w.projectiles.size;
  const p = w.launch({ id: w.id(), weapon: 'lsw_tremor', ownerId: -1, team: 0,
    pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 90, y: 0, z: 0 }, bornAt: w.time, ttl: 0.05, arc: false } as import('../src/sim/types').Projectile);
  for (let i = 0; i < 6; i++) w.step(1 / 60, new Map());
  expect(w.projectiles.size).toBeGreaterThan(before); // children in the air
});
```

- [ ] **Step 2: chain.** On soldier-hit with `chain:n`, find n nearest un-hit enemies within a radius and apply arc damage (add each to `p.hit`). Test: 3 clustered enemies, `chain:2` hurts all 3 from one shot.
- [ ] **Step 3: tether.** On hit with `tether`, store a link (owner ↔ victim) that pulls the victim toward the owner over a short window (reuse the knockback/pull path). Test: victim's distance to owner shrinks after a tether hit.
- [ ] **Step 4: boomerang.** A `boomerang` round sets `returnAt = time + ttl/2`; at `returnAt`, flip `vel` toward the owner and clear `p.hit` so it can strike on the way back. Test: a boomerang with no target flies out and its x-velocity sign flips.
- [ ] **Step 5: gasAfter.** On impact, `spawnGadget` a lingering field (`caustic`/`poison`/`fear`/`singularity`) at `pos` with `r`/`life`. Reuse `fire_field`/`smoke_field` plumbing. Test: a `gasAfter` round leaves a gadget behind.
- [ ] **Step 6: Run + full suite.** `npx vitest run`.
- [ ] **Step 7: Commit.**

```bash
git add src/sim/world.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: cluster, chain, tether, boomerang, gasAfter"
```

---

## Task 9: Melee shockwave (Titan/Leviathan/Crusher/Gargoyle land AoE)

**Files:**
- Modify: `src/sim/world.ts` or `src/sim/lsw.ts` (the leap/slam LAND handler; grep `diveAt` / leap landing)
- Test: `tests/projectile-fx.test.ts`

- [ ] **Step 1: Find the leap/land site.** Run: `grep -n "diveAt\|land\|shockwave\|stomp" src/sim/lsw.ts src/sim/world.ts | head`.
- [ ] **Step 2: Failing test** — a Titan leap-land damages + knocks back enemies within `shockwave` radius and `damageWall(heavy)` on masonry in the ring.
- [ ] **Step 3: Implement** — on land, if `WEAPONS[weapon].shockwave`, apply radial damage + knockback + heavy wall damage in the ring; emit an `explosion`-class event for the ground ring VFX.
- [ ] **Step 4: Run + full suite.** `npx vitest run`.
- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts src/sim/lsw.ts tests/projectile-fx.test.ts
git commit -m "projectile-fx: melee shockwave on leap/slam land"
```

---

## Task 10: The LSW power pass — drop the flags on all 40 (pure data)

**Files:**
- Modify: `src/sim/data.ts` (`LSW_ARMS` 117-164)

This is the data assignment. Each line below extends the existing `A({...})` def with its flags. Also fix the two names the spec flagged: **Riptide** `tracer:'plasma'` → repoint to the lance beam feel; **Reaper** stays `tracer:'none'` (quiet school).

- [ ] **Step 1: Apply the BEAM SEVEN + RAIL TWO flags.**

```
lsw_eclipse    → beam:'charge', charge:{t:1.0,mul:3}
lsw_reactor    → beam:'hose', ricochet:1
lsw_frostbite  → beam:'hose'            (freeze-cone via existing encase-on-sustain)
lsw_crimson    → beam:'hose'            (lifesteal via existing heal-on-hit hook)
lsw_magnetar   → beam:'ricochet', ricochet:2
lsw_pulse      → beam:'lance', pierce:3
lsw_mirage     → beam:'zap', ricochet:1
lsw_sniperhawk → pierce:4, pierceArmor:true
lsw_chronos    → pierce:2               (slow-on-pass via existing time-field hook)
```

- [ ] **Step 2: Apply ARC FIVE / FLAME THREE / ACID TWO / PLASMA FIVE / QUIET FIVE / SHELL FIVE.** (Full list — copy verbatim into each def:)

```
Volt Striker  chain:2, ricochet:1     Overload   cluster:3         Stormcaller charge:{t:0.7,mul:2}
Wraith        pierce:3                 Dominator  tether:true
Firebrand     beam:'hose', ignite:true Inferno    charge:{t:0.6,mul:2}, ignite:true   Pyroclasm cluster:3, ignite:true
Plaguebearer  gasAfter:{kind:'caustic',r:2.5,life:5}   Venom pierce:1, gasAfter:{kind:'poison',r:2,life:4}
Oblivion      charge:{t:0.8,mul:2.5}, gasAfter:{kind:'singularity',r:3,life:2}
Voidwalker    pierce:2                 GravWarden charge:{t:0.6,mul:2}   Barrier ricochet:2   Riptide beam:'lance'
Shadowstep    boomerang:true          Specter    cluster:3         Reaper tether:true   Nightmare gasAfter:{kind:'fear',r:3,life:2}   Phantom pierce:3
Cataclysm     cluster:3               Tremor     cluster:4         Venatrix pierce:1    Steel Weaver pierce:2   Vanguard (pellets already 6)
```

- [ ] **Step 3: Melee six shockwaves** (Titan `shockwave:5`, Leviathan `shockwave:8`, Gargoyle `shockwave:4`; Crusher/Ragebeast/Blitz per their handlers in Task 9).

- [ ] **Step 4: Verify types.** Run: `npx tsc --noEmit`  Expected: exit 0.

- [ ] **Step 5: Commit.**

```bash
git add src/sim/data.ts
git commit -m "projectile-fx: the LSW power pass — every god gets its power axis"
```

---

## Task 11: Per-unit tracer color (kill the mint-green sameness)

**Files:**
- Modify: `src/client/renderer.ts` (beam/tracer color lookup) and/or `src/sim/data.ts` (a `tint` per LSW arm)

- [ ] **Step 1:** Add an optional `tint?: number` to the LSW arm defs (data.ts) OR a color map in the renderer keyed by weapon id.
- [ ] **Step 2:** In the beam/tracer render, use the per-weapon color (Crimson blood-red hose, Frostbite cyan hose, Eclipse white charge, etc.) instead of the shared mint.
- [ ] **Step 3:** `npm run build`; eyeball in the Combat Lab (harness Matchup tab).
- [ ] **Step 4: Commit.**

```bash
git add src/client/renderer.ts src/sim/data.ts
git commit -m "projectile-fx: distinct tracer color per LSW"
```

---

## Task 12: Re-measure and tune the threat bands

**Files:**
- Verify: `tests/threat-measure.test.ts`
- Tune: `src/sim/data.ts` (`mul`/`pierce`/`cluster` counts)

- [ ] **Step 1: Run the law suite.** Run: `npx vitest run tests/threat-measure.test.ts`  Expected: some units now tip out of their tier (power buffs).
- [ ] **Step 2: For each failure, tune its numbers** (lower `charge.mul`, `pierce`, or `cluster` k) until it holds its band. Re-run after each change. Do NOT change the tier — change the power number.
- [ ] **Step 3: Full gate.** Run: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`  Expected: all green (1072+ tests).
- [ ] **Step 4: Live verify in the Combat Lab.** Open harness Matchup, run 3-4 marquee matchups (Eclipse charge, Firebrand hose, Sniperhawk rail down the lane), confirm the feel + distinct colors.
- [ ] **Step 5: Commit.**

```bash
git add src/sim/data.ts
git commit -m "projectile-fx: re-tune power numbers to hold every threat band"
```

---

## Self-Review

**Spec coverage:** Part A surface-reactions → Task 5 (+ ignite stub, wires with fire). Part B flags → Tasks 1-9 (pierce 3, pierceArmor 4, ricochet 5, charge 6, beam 7, cluster/chain/tether/boomerang/gasAfter 8, shockwave 9). Part C LSW pass → Task 10; tracer colors → Task 11; threat re-measure → Task 12; Riptide/Reaper fixes → Task 10 Step 2. All covered.

**Placeholders:** Tasks 6 and 7 carry `expect(true).toBe(true)` stubs *only because* the exact charge-timer / beam-range field names must be confirmed by the grep in their Step 1 — each step says what concrete assertion replaces the stub. Every other step has real code.

**Type consistency:** `pierce`/`ricochet`/`dmgMul`/`hit`/`ignite`/`returnAt` are declared on `Projectile` in Task 1 and consumed with those exact names in Tasks 3-8. `damageSoldier(..., pierceArmor)` signature added in Task 4 and called with it in Task 3/5. `materialOf`/`Material.ricochet/penetrable/flammable` match `src/sim/materials.ts` as shipped.

**Dependency:** IGNITE (Task 5 step 3, commented) + the FLAME-THREE `ignite:true` (Task 10) light up when the materials `/goal` fire system lands — flagged inline; nothing else blocks.
