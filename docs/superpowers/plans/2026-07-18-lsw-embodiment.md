# LSW Embodiment (Movement + Attack Animation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the 40 LSWs from looking and moving like riflemen — give each a per-school hold/prop and attack pose (killing the shared rifle rig), tune the movement classes so they read right in a room, and dress the movement (leap squash/stretch, blink afterimage, hover bob).

**Architecture:** Three new `LswDef` fields — `rig`, `prop?`, `attackPose` — drive rendering: `dressAsLsw` hides the gun mesh and shows a hand-prop for melee schools (else shows the rig's weapon), and the LSW's `attackPose` drives the fire animation (extending the feel-pass SLAM/THRUST/CHANNEL with four new poses: LOB/BRACE/SHOULDER/FLICK). Movement is two halves: sim tuning (leap/blink cadence + hop distance) and animation dress (squash/stretch/afterimage/bob). Pure data on 40 defs, guarded by the threat-measure law suite.

**Tech Stack:** TypeScript deterministic sim (`src/sim/`), Three.js client (`src/client/`), Vitest. Gates: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`.

**Context / sequencing:** This is layers 2 (movement) + 3 (attack animation) of LSW embodiment. Layer 1 (silhouette: tint/aura/size) already shipped (`dressAsLsw`, `LSW_TINT`). Layer 4 (projectile/VFX) is the separate projectile-effects plan (`docs/superpowers/plans/2026-07-18-projectile-effects.md`), mid-execution. **These two plans pair school-by-school** — a charge-beam (projectile Part C) and its cupped-hands wind-up (this plan's attackPose) should land together, or a Wave Cannon fires from a rifleman's shoulder. Ship order by visible payoff: **Melee first** (hide the guns → instant "that's Titan"), **Beam second** (gauntlets + Eclipse's Wave Cannon), then the rest. It's a solo repo now — the feel pass (SLAM/THRUST/CHANNEL) is already on `main` to extend; no other agent to flag.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `src/sim/lsw.ts` | `LswDef` fields (`rig`/`prop`/`attackPose`); the 40 per-LSW assignments | Modify (interface ~39-65; defs throughout) |
| `src/sim/world.ts` | Leap + blink cadence/hop tuning | Modify (leap ~577-593; blink ~599-615) |
| `src/sim/lsw/gravwarden.ts`, `leviathan.ts`, `wraith.ts` | slow-fall / crush-walk / hover feel | Modify (per-unit step) |
| `src/client/models/soldiers.ts` | `dressAsLsw`: rig → hide gun / show prop / per-rig model | Modify (`dressAsLsw` ~106) |
| `src/client/renderer.ts` | attackPose → fire animation (LOB/BRACE/SHOULDER/FLICK); movement dress (leap squash, blink afterimage, hover bob) | Modify (`castPoses` ~152, render ~2617, shot trigger ~2833; `animateSoldier`) |
| `tests/lsw-embodiment.test.ts` | Data completeness + movement-tuning unit tests | Create |
| `tests/threat-measure.test.ts` | Existing law suite — re-run after each school | Verify only |

---

## Task 1: The `LswDef` embodiment fields

**Files:** Modify `src/sim/lsw.ts` (interface ~39-65)

- [ ] **Step 1: Add the fields to `interface LswDef`.** After the existing `moves?: 'leap' | 'blinkwalk';` line (~65), add:

```ts
  /** how the model holds/shows its weapon. fists|blade HIDE the gun mesh and
   *  show a hand-prop; the rest show the rig's weapon model. */
  rig?: 'fists' | 'blade' | 'gauntlet' | 'palm' | 'rifle' | 'launcher' | 'thrower' | 'sidearm';
  /** the melee/tool prop shown in the hands when rig hides the gun */
  prop?: 'hammer' | 'claws' | 'talons' | 'blade' | 'knives' | 'chain' | 'harpoon' | 'driver' | 'hose' | 'shield';
  /** the fire animation this LSW plays. SLAM/THRUST/CHANNEL exist (feel pass);
   *  LOB/BRACE/SHOULDER/FLICK are added in this plan. */
  attackPose?: 'SLAM' | 'CHANNEL' | 'THRUST' | 'LOB' | 'BRACE' | 'SHOULDER' | 'FLICK';
```

- [ ] **Step 2: Verify.** Run `npx tsc --noEmit` — expected exit 0 (optional fields).
- [ ] **Step 3: Commit.**

```bash
git add src/sim/lsw.ts
git commit -m "lsw-embodiment: rig/prop/attackPose fields on LswDef"
```

---

## Task 2: Data completeness test (every LSW is embodied)

**Files:** Create `tests/lsw-embodiment.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
import { describe, expect, it } from 'vitest';
import { LSWS } from '../src/sim/lsw';

describe('every LSW is embodied', () => {
  it('all 40 have a rig and an attackPose', () => {
    const bare = Object.values(LSWS).filter((d) => !d.rig || !d.attackPose).map((d) => d.id);
    expect(bare).toEqual([]);
  });
  it('fists/blade rigs carry a prop or are bare-handed fists', () => {
    for (const d of Object.values(LSWS)) {
      if (d.rig === 'blade') expect(d.prop).toBeTruthy(); // a blade rig needs a prop
    }
  });
});
```

- [ ] **Step 2: Run, watch it fail.** `npx vitest run tests/lsw-embodiment.test.ts` — expected FAIL (no defs have rig yet; `bare` lists all 40).
- [ ] **Step 3:** Leave the test failing on purpose — Task 10 (the data pass) turns it green. Commit the test now as the acceptance gate:

```bash
git add tests/lsw-embodiment.test.ts
git commit -m "lsw-embodiment: completeness test (rig+attackPose for all 40) — RED until data pass"
```

> Note for the executor: this is the one intentional RED commit. Every other task ends green. Task 10 makes this pass. If executing subagent-driven, tell the implementer of Task 10 this test must go green.

---

## Task 3: `dressAsLsw` — hide the gun, show the prop, per-rig model

**Files:** Modify `src/client/models/soldiers.ts` (`dressAsLsw` ~106)

- [ ] **Step 1: Read `dressAsLsw` and how the soldier mesh names its gun.** Run: `sed -n '106,160p' src/client/models/soldiers.ts` and `grep -n "name = 'gun'\|\.name = 'gun'\|gun\b" src/client/models/soldiers.ts`. Identify the gun mesh (the rifle) in the built soldier group and how props/children are named.

- [ ] **Step 2: Implement the rig rule.** Extend `dressAsLsw(mesh, id)` so, after the tint/scale it already applies, it reads `LSWS[id]?.rig`:
  - If `rig === 'fists'`: set the gun mesh `.visible = false` (bare hands).
  - If `rig === 'blade'`: hide the gun mesh and attach a simple prop mesh to the right hand (`prop` = claws/talons/blade/knives → a thin box/cone; keep it procedural, one small helper `makeProp(kind)`).
  - Else (gauntlet/palm/rifle/launcher/thrower/sidearm): leave the gun visible for now (the per-rig distinct weapon models are a follow-up; the headline is hiding the melee guns). Optionally swap the gun's scale/tint per rig as a cheap tell.

```ts
// inside dressAsLsw, after the existing tint/scale block:
const rig = LSWS[id]?.rig;
if (rig === 'fists' || rig === 'blade') {
  mesh.traverse((o) => { if (o.name === 'gun') o.visible = false; });
  if (rig === 'blade') {
    const hand = mesh.getObjectByName('armR') ?? mesh;
    hand.add(makeProp(LSWS[id]?.prop ?? 'blade'));
  }
}
```
Add a small `makeProp(kind)` helper returning a `THREE.Group` (a claw = three thin cones; a blade = a flat box; a hammer = box on a stick). Import `LSWS` from `../../sim/lsw` (guard against circular import — `LSWS` is data, `soldiers.ts` is client, no cycle).

- [ ] **Step 3: Confirm the gun mesh name.** If the gun isn't named `'gun'`, use the actual name found in Step 1 (report it).
- [ ] **Step 4: Gate + live-verify.** `npx tsc --noEmit && npm run lint && npm run build`, then open the harness Combat Lab (Matchup tab), pick Titan vs anyone, confirm **no rifle in Titan's hands** (fists) and a blade prop on Ragebeast. Screenshot.
- [ ] **Step 5: Commit.**

```bash
git add src/client/models/soldiers.ts
git commit -m "lsw-embodiment: melee LSWs hide the gun and show hand-props"
```

---

## Task 4: attackPose drives the fire animation (+ the 4 new poses)

**Files:** Modify `src/client/renderer.ts` (`castPoses` ~152, pose render ~2617, shot trigger ~2833)

- [ ] **Step 1: Read the existing pose system.** Run: `sed -n '2580,2640p' src/client/renderer.ts` (throwPoses + castPoses render) and `sed -n '2825,2845p' src/client/renderer.ts` (where the 'shot'/grenade event sets throwPoses). Understand how `castPoses` maps `school: 'slam'|'thrust'|'channel'` to additive joint offsets.

- [ ] **Step 2: Extend the pose union + add the 4 new poses.** Change the `castPoses` value type (line ~152) to accept the new poses, and in the render block (~2617) add cases for `lob` (overhand wind-up → hurl on armR), `brace` (cheek-weld both arms + a recoil shove via a small `-z` body offset), `shoulder` (weapon up on the shoulder), `flick` (fast short armR snap, low amplitude). Reuse the additive-offset pattern the existing three use.

- [ ] **Step 3: Trigger the pose on the LSW's shot.** Where the 'shot' event is handled (~2833, next to the grenade `throwPoses.set`), add: if the shooter is an LSW, set its attack pose from `LSWS[shooter.ascendant].attackPose` (map the seven names to the pose renderer). Sustained poses (CHANNEL for hose beams) hold while firing; one-shot poses (LOB/BRACE/FLICK) play for ~0.4s.

```ts
// near the throwPoses.set for grenades, in applyEvents 'shot':
const sh = world.soldiers.get(e.soldierId!);
if (sh?.ascendant) {
  const pose = LSWS[sh.ascendant].attackPose;
  if (pose) this.attackPoses.set(sh.id, { at: world.time, until: world.time + 0.4, pose });
}
```
Add an `attackPoses` map alongside `castPoses`, rendered in the same block. (Reusing `castPoses` is fine too — extend its `school` union to the 7 pose names and rename for clarity; either way, keep one code path.)

- [ ] **Step 4: Gate + live-verify.** Build; in the Combat Lab watch Sniperhawk (BRACE recoil), Firebrand (CHANNEL stream), Plaguebearer (LOB). Confirm the motion differs by school.
- [ ] **Step 5: Commit.**

```bash
git add src/client/renderer.ts
git commit -m "lsw-embodiment: attackPose drives the fire animation (+LOB/BRACE/SHOULDER/FLICK)"
```

---

## Task 5: Leap tuning — short hops in tight space

**Files:** Modify `src/sim/world.ts` (leap ~577-593); Test `tests/lsw-embodiment.test.ts`

- [ ] **Step 1: Write the failing test.** Append:

```ts
import { World } from '../src/sim/world';
describe('leap tuning', () => {
  it('leaps a SHORT distance at a near target (no 30u overshoot)', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;   // a leaper
    const e = w.addSoldier('E', 'infantry', 1, 'bot');
    e.pos = { x: 14, y: 0, z: 0 };                            // 14u away
    t.nextLeapAt = 0;
    w.step(1 / 60, new Map());
    // reach ≈ dist*0.9 ≈ 12.6, clamped [8,30] — the dive target sits well short of 30u
    expect(t.diveX ?? 0).toBeLessThan(20);
    expect(t.diveX ?? 0).toBeGreaterThan(8);
  });
});
```

- [ ] **Step 2: Run, watch it fail.** `npx vitest run tests/lsw-embodiment.test.ts -t "leap tuning"` — expected FAIL (current `reach = min(30, dl-2)` → ~12 here, actually may pass; if it passes, tighten the assertion to check a FAR target still clamps to ≤30 and a near target scales — see Step 3's real change). Adjust the test to prove the *scaling* behavior the change adds.

- [ ] **Step 3: Implement.** In the leap block (~587), change the reach + cadence:

```ts
        s.nextLeapAt = this.time + 6;                        // was 7
        ...
          const reach = Math.max(8, Math.min(30, dl * 0.9)); // was Math.min(30, dl - 2)
```

- [ ] **Step 4: Run + full suite.** `npx vitest run tests/lsw-embodiment.test.ts -t "leap tuning"`, then `npx vitest run` (leap feeds threat fights — confirm no regressions).
- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/lsw-embodiment.test.ts
git commit -m "lsw-embodiment: leap hop scales to range (clamp 8..30), cadence 6s"
```

---

## Task 6: Blink tuning — snappier cadence

**Files:** Modify `src/sim/world.ts` (blink ~599-615); Test `tests/lsw-embodiment.test.ts`

- [ ] **Step 1: Write the failing test.** Append:

```ts
describe('blink tuning', () => {
  it('re-arms the blink at 1.6s cadence', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const c = w.addLsw('chronos', 1, { x: 0, y: 0, z: 0 })!;
    c.nextBlinkAt = 0;
    const t0 = w.time;
    w.step(1 / 60, new Map());
    expect(c.nextBlinkAt).toBeCloseTo(t0 + 1 / 60 + 1.6, 2);
  });
});
```

- [ ] **Step 2: Run, watch it fail.** Expected FAIL (currently `+2.0`).
- [ ] **Step 3: Implement.** In the blink block (~600): `s.nextBlinkAt = this.time + 1.6;` (was `2.0`). The `[15,10,5]` hop fallback already does `min(hop, dl)` — leave it.
- [ ] **Step 4: Run + full suite.** `npx vitest run`.
- [ ] **Step 5: Commit.**

```bash
git add src/sim/world.ts tests/lsw-embodiment.test.ts
git commit -m "lsw-embodiment: blink cadence 2.0s -> 1.6s"
```

---

## Task 7: Strange-five feel — verify + tune hover / slow-fall / crush-walk

**Files:** Modify `src/sim/lsw/wraith.ts` (hover), `gravwarden.ts` (slow-fall), `leviathan.ts` (crush-walk)

- [ ] **Step 1: Read each unit's movement step.** `grep -n "float\|hover\|fall\|gravity\|slow\|crush\|footfall\|pos.y" src/sim/lsw/wraith.ts src/sim/lsw/gravwarden.ts src/sim/lsw/leviathan.ts`. Confirm each still triggers (some may have regressed).
- [ ] **Step 2: Tune (per the numbers).** Wraith: constant `pos.y = 0.6` float, gravity off, gentle bob (the bob is dress — Task 9). GravWarden: fall speed `× 0.35`. Leviathan: normal speed, footfall dust + shudder (dust/shudder is dress — Task 9). Keep changes minimal and deterministic.
- [ ] **Step 3: Test** — a hover unit stays at ~0.6y after stepping; a slow-fall unit descends slower than 1g. Append targeted tests.
- [ ] **Step 4: Gate.** `npx tsc --noEmit && npx vitest run`.
- [ ] **Step 5: Commit.**

```bash
git add src/sim/lsw/wraith.ts src/sim/lsw/gravwarden.ts src/sim/lsw/leviathan.ts tests/lsw-embodiment.test.ts
git commit -m "lsw-embodiment: strange-five feel — hover float, slow-fall, crush-walk"
```

---

## Task 8: Movement dress — leap squash/stretch/crater (animation)

**Files:** Modify `src/client/renderer.ts` (`animateSoldier` — the leap/`diveAt` handling)

- [ ] **Step 1: Read how animateSoldier handles airborne/leap.** `grep -n "diveAt\|airborne\|squash\|scale.y\|leap" src/client/renderer.ts`.
- [ ] **Step 2: Implement squash-and-stretch.** For a soldier with `diveAt !== undefined`: on launch (first ~0.15s) `mesh.scale.y = 0.7` (crouch), at apex `mesh.scale.y = 1.15` (stretch), and on land emit a crater dust puff + a brief `scale.y = 0.8` squash. Drive off the flight progress (the sim already computes `pos.y`); reset scale when grounded.
- [ ] **Step 3: Gate + live-verify.** Build; watch Titan leap in the Combat Lab — crouch → stretch → thud. Screenshot.
- [ ] **Step 4: Commit.**

```bash
git add src/client/renderer.ts
git commit -m "lsw-embodiment: leap dress — squash on launch, stretch at apex, crater on land"
```

---

## Task 9: Movement dress — blink afterimage + hover bob + crush-walk footfall

**Files:** Modify `src/client/renderer.ts` (`animateSoldier` + the `blink` event in `applyEvents`)

- [ ] **Step 1: Blink afterimage.** On the `blink` event (already emitted at world.ts 608/610), spawn a fading ghost mesh at the old position (0.3s): tint by unit — Chronos gold, Voidwalker inward-collapse (scale→0), Specter mirror-flicker. Pop-in `scale 1.2→1` at the new spot.
- [ ] **Step 2: Hover bob (Wraith).** In animateSoldier, if the unit hovers, add a `sin(time)` y-bob, tuck the feet, suppress footstep particles.
- [ ] **Step 3: Crush-walk footfall (Leviathan).** On each footstep marker, emit a dust puff + a small camera shudder when near the camera.
- [ ] **Step 4: Gate + live-verify.** Build; watch Chronos (gold afterimage), Wraith (float/bob), Leviathan (dust). Screenshot.
- [ ] **Step 5: Commit.**

```bash
git add src/client/renderer.ts
git commit -m "lsw-embodiment: blink afterimage, hover bob, crush-walk footfall dust"
```

---

## Task 10: The embodiment data pass — all 40 (school-by-school)

**Files:** Modify `src/sim/lsw.ts` (the 40 defs)

Apply `rig`/`prop`/`attackPose` to each LSW def. This turns the Task 2 completeness test GREEN. Ship in the visible-payoff order (Melee, Beam, then rest); within this task, apply all so the test passes.

- [ ] **Step 1: MELEE SIX** (hide the guns):

```
titan     rig:'fists', attackPose:'SLAM'          crusher rig:'fists', attackPose:'SLAM'
ragebeast rig:'blade', prop:'claws', attackPose:'SLAM'    leviathan rig:'fists', attackPose:'SLAM'
gargoyle  rig:'blade', prop:'talons', attackPose:'SLAM'   blitz rig:'blade', prop:'blade', attackPose:'SLAM'
```

- [ ] **Step 2: BEAM SEVEN** (`rig:'gauntlet', attackPose:'CHANNEL'`): reactor, crimson, magnetar, pulse, frostbite, mirage, eclipse. (Eclipse's cupped-hands Wave Cannon wind-up is the CHANNEL variant driven by its charge flag from the projectile plan.)

- [ ] **Step 3: RAIL TWO** (`rig:'rifle', attackPose:'BRACE'`): sniperhawk, chronos.

- [ ] **Step 4: ARC FIVE** (`rig:'palm', attackPose:'THRUST'`): voltstriker, overload, stormcaller, wraith, dominator.

- [ ] **Step 5: FLAME THREE** (`rig:'thrower'`): firebrand `prop:'hose', attackPose:'CHANNEL'`; inferno `attackPose:'LOB'`; pyroclasm `attackPose:'LOB'`.

- [ ] **Step 6: ACID TWO** (`rig:'thrower'`): plaguebearer `attackPose:'LOB'`; venom `attackPose:'CHANNEL'`.

- [ ] **Step 7: PLASMA-EXOTIC FIVE** (`rig:'sidearm'`, gravwarden `rig:'palm'`, all `attackPose:'THRUST'`): riptide, voidwalker, barrier, gravwarden, oblivion.

- [ ] **Step 8: QUIET FIVE** (`attackPose:'FLICK'`): phantom `rig:'sidearm'`; shadowstep `rig:'blade', prop:'knives'`; specter `rig:'blade', prop:'knives'`; nightmare `rig:'palm'`; reaper `rig:'launcher', prop:'chain'`.

- [ ] **Step 9: SHELL FIVE** (`rig:'launcher', attackPose:'SHOULDER'`): vanguard `prop:'shield'`; tremor; venatrix `prop:'harpoon'`; steelweaver `prop:'driver'`; cataclysm.

- [ ] **Step 10: Turn the completeness test green.** Run `npx vitest run tests/lsw-embodiment.test.ts` — expected PASS (Task 2's test now green).
- [ ] **Step 11: Gate.** `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`.
- [ ] **Step 12: Commit.**

```bash
git add src/sim/lsw.ts
git commit -m "lsw-embodiment: rig/prop/attackPose on all 40 LSWs — the guns are gone"
```

---

## Task 11: Re-measure threat bands

**Files:** Verify `tests/threat-measure.test.ts`; tune `src/sim/lsw.ts` / pose timings if needed

- [ ] **Step 1: Run the law suite.** `npx vitest run tests/threat-measure.test.ts` — pose timing (BRACE recoil, LOB wind-up) can shift TTK slightly.
- [ ] **Step 2: For any unit that tips out of tier, adjust its pose duration or the leap/blink numbers** (not the tier) until it holds. Re-run after each change.
- [ ] **Step 3: Full gate + live sweep.** `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`, then the Combat Lab: Titan (fists, leap crater), Eclipse (Wave Cannon), Sniperhawk (BRACE), Chronos (gold blink) — confirm none read as riflemen.
- [ ] **Step 4: Commit.**

```bash
git add src/sim/lsw.ts
git commit -m "lsw-embodiment: hold every threat band after the embodiment pass"
```

---

## Self-Review

**Spec coverage:** Fix #1 (kill the guns) → Tasks 1,3,10. Fix #2a (movement feel) → Tasks 5 (leap), 6 (blink), 7 (strange-five). Fix #2b (movement dress) → Tasks 8 (leap), 9 (blink/hover/crush). Attack poses (LOB/BRACE/SHOULDER/FLICK) → Task 4. The four new `LswDef` fields + all per-school data tables → Tasks 1, 10. Threat re-measure → Task 11. All covered.

**Placeholders:** Task 5 Step 2 flags that the initial test may pass and says exactly how to tighten it (prove scaling: far target clamps ≤30, near target scales down) — not a placeholder, a real branch to resolve at implementation. Task 3/4/8/9 rendering steps give concrete code patterns + the exact hooks (`dressAsLsw`, `castPoses`, the `blink`/`shot` events, `diveAt`); the executor confirms one mesh name (the gun) in Task 3 Step 1. No TBDs.

**Type consistency:** `rig`/`prop`/`attackPose` names + literal unions are declared in Task 1 and used verbatim in Tasks 3, 4, 10. `attackPoses`/`castPoses` map naming is called out in Task 4 (one code path). `LSWS`, `diveAt`, `nextLeapAt`, `nextBlinkAt` match the real symbols confirmed in `src/sim/lsw.ts` / `src/sim/world.ts`.

**Cross-plan:** Pairs school-by-school with `2026-07-18-projectile-effects.md` (Eclipse CHANNEL ↔ its charge flag). Both touch `renderer.ts` — sequence them, don't run their renderer tasks in parallel.
