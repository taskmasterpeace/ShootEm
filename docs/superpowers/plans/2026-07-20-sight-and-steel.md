# SIGHT & STEEL — the visibility rewrite and the melee verbs

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** two things Robert asked for, planned together because they share the same law — *the screen must never lie about what you know*.

- **PART A — SIGHT.** Enemies vanish the instant you lose them; what remains is obviously a memory, not a man. The world outside your eyes goes dark. Walking into a house or a maze, you see what you can see and nothing more.
- **PART B — STEEL.** A real melee layer: **punch · block · grab · stab**, readable from command height.

**Tech Stack:** TypeScript deterministic sim (`src/sim/`), Three.js client (`src/client/`), Vitest. Gates: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`.

**Sequencing:** Part A first. It is mostly *subtraction*, it pays for itself in frame time, and A3 (the visibility polygon) is the substrate that makes indoor melee legible. Part B lands on top.

---

## PART A — SIGHT

### The diagnosis (measured, not guessed)

The perception system is already correct and already culls. `src/client/renderer.ts:1472` reads:

```ts
mesh.visible = (s.alive || corpse) && (!inVehicle || surfing) && !dark && !(s.cloaked && …);
if (!mesh.visible) continue;
```

An enemy you cannot see is **invisible and skipped entirely** — no color pass, no shadow pass, no pose work. Nothing is broken there.

The ambiguity Robert is describing is one specific thing: **the linger ghost**. Between "I see him" and "he's gone" there is a window (`src/client/renderer.ts:1440-1444`) where a **person-shaped, animated-looking, frozen soldier body** is drawn at a dissolving alpha:

| Viewer class | Ghost holds for | With tracking optics |
|---|---|---|
| base (infantry, heavy, medic, engineer…) | **2.5 s** | 4.0 s |
| pathfinder | 3.5 s | 5.0 s (capped) |
| infiltrator | 4.0 s | 5.0 s (capped) |
| ghost | 5.0 s | 5.0 s (capped) |

*(`src/sim/perception.ts:43-48`, `MAX_LINGER = 5`.)*

At 90% alpha that ghost looks like a man. At 20% it looks like a man in fog. **Nothing in the visual language separates "he is there" from "he was there."** That is the whole complaint, and it is a presentation bug, not a systems gap.

### A1 — The body vanishes; the memory becomes a mark

**Files:** `src/client/renderer.ts` (~1420-1473), new `src/client/contacts.ts`

The rule: **a soldier mesh is only ever drawn when the team can see him right now.** The linger information is valuable and already computed — it just must stop wearing a body.

- [ ] **Step 1:** In the ghost branch, stop setting `ghost`/`ghostAlpha` on the mesh. Set `dark = true` for anything not fresh, so the body is hidden the same tick sight breaks. Delete the ghost-alpha dissolve path and its `setAlpha` call.
- [ ] **Step 2:** New `contacts.ts` draws a **LAST KNOWN CONTACT** mark at `mark.x/mark.z` for the remaining linger window: a flat ground stencil in the terminal language — a hollow bracket-diamond in enemy team color, no body, no limbs, no animation, drawn on the ground plane, with a small age tick that shortens as the mark expires. It must read as **UI, not a person**, from command height.
- [ ] **Step 3:** Keep the footstep smudge (`renderer.ts:1450-1464`) exactly as is — hearing stays a skill, and it is now the *only* thing that moves in the dark.
- [ ] **Step 4:** Pool the marks (never allocate per frame — see audit R11/E8, [issue #25](https://github.com/taskmasterpeace/ShootEm/issues/25)).

**The read Robert asked for, in three states:** solid body = *I see you* · bracket mark = *I remember you* · nothing = *dark*.

**Cost:** this is a **subtraction**. Today every lost contact keeps drawing a ~60-mesh body (audit R1) for up to 2.5 s. In a firefight, contacts break constantly. Removing the ghost body is a straight frame-time win — measure it as such.

### A2 — Reading the dark: the vision overlay

**Files:** `src/client/renderer.ts` (ground/lighting build ~662-710), new `src/client/visibility.ts`

There is **no post-processing pipeline** in this renderer (grep: only `THREE.Fog` distance fog at `renderer.ts:343,613`; no `EffectComposer`). Adding one for a fullscreen darkness pass would cost every fragment on exactly the iGPUs we are protecting — wrong tool.

The ground texture is a **1024×1024 CanvasTexture built once per match** (`renderer.ts:662-704`), not per frame — so it is not a live hook either.

The right instrument is a **visibility polygon**, the classic top-down solution, drawn as one overlay mesh:

- [ ] **Step 1:** Cast N rays (start at 96) from the local player's eye across the ~132° cone (`CONE_HALF`, `src/sim/perception.ts:22`) plus the 9u all-around ring (`RING`), each marching the tile grid until `losClear` fails. Rebuild at **10-15 Hz**, not per frame, interpolating between rebuilds.
- [ ] **Step 2:** Build a triangle-fan mesh of the lit region; render a large dark plane over the world with the fan punched through it (stencil, or the fan drawn with additive light against a dark quad). One extra draw call total.
- [ ] **Step 3:** Soften the boundary (a short alpha ramp on the outer vertices) so the edge reads as *falloff*, not a laser line.
- [ ] **Step 4:** Darkness must be **team-honest, not player-selfish.** Perception is a team union (`perceivesNow` takes `eyes: Soldier[]`). Teammates' cones light their own regions too, or an enemy you legitimately see through a squadmate would stand in blackness. A lit pocket across the map that you personally can't see *is* your squadmate's eyes — that reads beautifully and is truthful.
- [ ] **Step 5:** Tie depth to weather: `visionMult` (`src/sim/weather.ts:70`) already taxes the eye — fog should visibly close the polygon in, which is free once the radius reads the same number the sim uses.

**Budget note:** 96 rays at 12 Hz ≈ 1.2k marches/second. The minimap today does *up to 144 raymarches per frame at 60 Hz* (audit R7/E2, [issue #6](https://github.com/taskmasterpeace/ShootEm/issues/6)) — an order of magnitude more than this feature costs. Fix #6 first and the whole feature is free out of the savings.

### A3 — Houses and mazes

**Files:** `src/client/visibility.ts`, roof-cutaway path in `src/client/renderer.ts`

This falls out of A2 for free and is the reason to build A2 as a polygon rather than a radial gradient: **the rays already stop at walls.** Standing at a doorway, the lit wedge reaches into the room you're facing and the other rooms stay black. That is exactly "you should see what you can see and what you can't."

- [ ] **Step 1:** Verify the polygon uses the same `losClear` eye height (1.4, inside the `T_SLIT` firing band) as `perceivesNow` — so a defender framed in a window is lit, matching the sim's own truth.
- [ ] **Step 2:** Reconcile with the roof cutaway: the roof already hides/reveals to keep the wire and the screen agreeing (`src/sim/perception.ts:1-13` states this law explicitly). The polygon must not contradict it — one source of truth, or the header's own warning comes true.
- [ ] **Step 3:** Second storey (`grid2`): the polygon is per-storey. Draw the one the player is on; do not light an upper floor from below.

### A4 — Make it pay (the optimization half of Robert's question)

**Direct answer: darkness itself is roughly cost-neutral — one overlay draw plus a 12 Hz rebuild. It does not save frame time on its own. But it arrives beside two changes that do, and it is the reason to make them:**

- [ ] **Step 1 — the shadow box.** Audit R3 ([issue #31](https://github.com/taskmasterpeace/ShootEm/issues/31)): the sun's ortho box is a fixed ±130u covering the *whole map* (`renderer.ts:629-632`), so every visible soldier map-wide pays full shadow draws every frame regardless of where the camera is. Tighten it to a ~60u box following `camPos`. Sharper shadows, far fewer casters. **This is the real win adjacent to darkness.**
- [ ] **Step 2 — A1's subtraction**, measured: capture draw calls before/after removing ghost bodies during a firefight.
- [ ] **Step 3 — the honest license.** Once the world outside the polygon is genuinely dark, props, decals, particles and grass blades outside it can be skipped rather than dimmed. Do this only after measuring Steps 1-2; do not claim it in advance.

### A5 — Tuning and safety rails

**This reverses an earlier call, deliberately.** `tests/visionfade.test.ts:1-5` records the original law in Robert's own words — *"when you look away they should fade over 5s; different classes see longer; the MAX is 5"* (§11 row 6). He is now saying he can't tell who he can and can't see. Both are right: **the information was correct, the costume was wrong.** The fix keeps the fade window and the per-class perk and changes only what wears it — a mark instead of a man. Say so in the commit, so the next reader doesn't think the law was forgotten.

- [ ] Linger *marks* keep the existing per-class durations — recon still remembers longest, `classLinger` is untouched, and **`tests/visionfade.test.ts` stays green** (it pins the linger math in `src/sim/perception.ts`, not the rendering — verified).
- [ ] The exceptions in `perceivesNow` are law and must still shine through: cloak is TRUE, the flag is public, pings are electronic, the **skyline rule** (`pos.y > 3`, no cone check) means a jet or a jump trooper against the sky is seen in your periphery, and a muzzle flash cuts murk to 50u.
- [ ] Bots must not gain or lose sight from any of this — Part A is **presentation only**; nothing in `src/sim` changes except reading existing values. `tests/visibility.test.ts`, `tests/visionfade.test.ts` and `tests/culling.test.ts` must stay green **without being edited** — if one needs a change, the change is wrong.
- [ ] Accessibility: expose overlay strength in settings (`off / subtle / full`). Some players will want the information without the murk.
- [ ] Ghost bodies are drawn **transparent**, which costs more than opaque (sorting, no early-z). Removing them is a slightly bigger win than the raw mesh count suggests.

---

## PART B — STEEL

### The surprise: the swing already works

The melee **attack half is shipped and tested** — it is simply wired to nothing a player can hold:

- `startMelee` / `resolveMeleeStrike` (`src/sim/world.ts:2569-2619`): a real state machine — **0.25 s windup** (`MELEE_WINDUP`), a **90° front wedge** (`MELEE_ARC`), **2 targets max**, **0.15 s stagger** on the victim's next shot, a **7.5 lunge** impulse at the strike, and it **locks `meleeYaw` at windup** so you commit to a facing.
- It is entered by exactly one rule — `if (def.range <= 2.5)` (`world.ts:2544`) — and exactly two weapons in the game qualify: `zombie_claw` (2.2) and `dog_bite` (2.0) (`src/sim/data.ts:78-79`).
- `tests/melee.test.ts:32-39` already proves a **human** carrying a claw swings correctly. The path works for players today; nobody can reach it.
- The **slash ring VFX exists** (`renderer.ts:3470-3488`) and already reads the sim's locked `meleeYaw`.
- `melee_windup` is a real event (`types.ts:744`) with a renderer consumer (`renderer.ts:3491`).

So Part B is not "build melee." It is: **give players a weapon and a key, add the defensive verbs, and make it visible.**

Three traps found in the ground-truth pass, worth knowing before writing a line:

1. **`cmd.melee` is a misnomer** — F is the *thrown axe* (range 30, `world.ts:1941-1954`). There is no melee-attack key at all.
2. **`WEAPON_HOLDS.melee` is dead code** (`animation.ts:111`). The `W()` helper (`data.ts:4-20`) never sets `family`, so no weapon is family `'melee'` and every claw-carrier falls back to the rifle hold (`renderer.ts:3063`). Set `family` explicitly or the hold stays unreachable.
3. **The run-carry layer absolutely rebases `armL/armR.rotation.z` every frame** for every living soldier (`renderer.ts:3036-3057`). A punch pose that is merely additive will be erased. It must suppress `runBlend` or apply after it — this is the single most likely way this feature ships looking broken.

### The shape

A shooter's melee layer, not a fighting game. Four verbs, one triangle, readable from command height:

| Verb | Input | What it does |
|---|---|---|
| **PUNCH** | melee key, tap (any weapon in hand) | Fast, low damage, staggers. The out-of-ammo answer. 1 target. |
| **STAB** | melee key with a blade drawn | Committed, slow, lethal. **From behind: an execution.** 1 target. |
| **BLOCK** | hold (RMB when a blade is drawn) | Frontal arc only. Beats strikes, drains energy, can't fire, slow walk. |
| **GRAB** | melee key at contact range (< 1.2u) | Beats block. Pins both, then finish or throw. |

**The triangle:** BLOCK beats STRIKE · GRAB beats BLOCK · STRIKE beats GRAB. No verb is universal.

**Facing is the whole game — and the sim can already do it.** `resolveMeleeStrike` computes a wrapped relative bearing against a locked yaw at `world.ts:2601-2606`; `vanguard.ts:19-22` does the same. A "was this blow inside the defender's front arc" test is the same three lines. Backstab would be the **first directional damage modifier in the game** (`damageSoldier` has none) — keep it scoped *inside the melee resolve* so it never perturbs ballistics balance.

**Energy is the cost.** The EN meter already exists on the HUD (`hud.ts:127-152`) with spend-flash and visible regen. Melee spends it, so the layer is self-limiting without inventing a resource.

### B1 — A weapon in the hand and a key under the thumb

**Files:** `src/sim/types.ts`, `src/sim/data.ts`, `src/sim/arsenal.ts`, `src/client/input.ts`

- [ ] **Step 1:** Add `'melee'` to `WeaponFamily` (`types.ts:136-140`). Add `FAMILY_ICONS.melee` (`arsenal.ts:86`).
- [ ] **Step 2:** Add hand-tuned entries to `CORE_WEAPONS` with **explicit `family: 'melee'`** (the `W()` helper omits it — trap #2): `fists` (range 1.6, fast, low damage — always available, never occupies a slot) and `trench_knife` (range 2.0, a real sidearm-slot draw). Both must satisfy `range <= 2.5` to reach `startMelee`.
- [ ] **Step 3:** **Quick melee** — a new `cmd.meleeAttack` distinct from the axe's `cmd.melee`. With any gun in hand it swings `fists`; with a blade drawn it swings that. Gate it exactly like the axe branch does: `!s.downed && s.vehicleId < 0 && s.encasedUntil === undefined` (`world.ts:1941`).
- [ ] **Step 4:** Bind it. F is taken by the axe, V by the Stable Console. **Free: `Z`, `B`, `MMB`, mouse4.** Prefer **MMB or `B`** for quick melee; gamepad stick-clicks (buttons 9/10/11) are unbound (`input.ts:137-153`).
- [ ] **Step 5:** Add the melee weapons to `CLASS_ARMORY` (`arsenal.ts:202`) so a knife is a real armory choice, and give the family a `buildWeaponModel` builder (`src/client/models/weapons.ts` — the armory system shipped 2026-07-20; a knife needs a silhouette).

### B2 — Block: the first defensive state

**Files:** `src/sim/types.ts`, `src/sim/world.ts`, `src/client/input.ts`

- [ ] **Step 1:** Add `blockUntil` / `blocking` + `blockYaw` to `Soldier` beside the existing melee block (`types.ts:475-481`). Block is a **held state**, which `oneShot` (`input.ts:16`) cannot express — take `mouse.rightDown` directly.
- [ ] **Step 2:** **RMB context-switch:** with a melee weapon in hand RMB blocks; otherwise it stays `altFire`. Only 4 weapons use alt-fire (`world.ts:2500-2537`), so the collision is small and the switch is legible.
- [ ] **Step 3:** In `resolveMeleeStrike`'s victim loop (`world.ts:2610`), before damage: if the victim is blocking and the blow's bearing is inside their front arc → absorb (heavy damage reduction), drain energy, and emit `melee_block`. A **parry window** (blow lands within ~0.2 s of block start) instead *staggers the attacker* — reuse the existing gun-lock primitive (`nextFireAt += …`, the same one Vanguard's shield bash uses at `vanguard.ts:11-33`) and emit `melee_parry`.
- [ ] **Step 4:** Block costs: can't fire, movement to walk speed, energy drain while held. Blocking does nothing against bullets — it is a **melee answer**, not a shield (the `shield` gadget already owns projectile-eating, `vanguard.ts:37-44`).
- [ ] **Step 5:** Add `melee_block` / `melee_parry` to the `SimEvent` union (`types.ts:744`).

### B3 — Grab: the block-breaker

**Files:** `src/sim/world.ts`, `src/sim/types.ts`

- [ ] **Step 1:** Add `grabbedBy` / `grabbing` to `Soldier`. The only existing body-attachment is `draggingId` for downed allies (`world.ts:3227-3240`) — same re-assert-every-tick shape, a good pattern to copy, but grab works on a **standing** enemy.
- [ ] **Step 2:** Melee key inside ~1.2u with the target facing you (or blocking) → grab. Pins both bodies, cancels the victim's block, locks both out of firing.
- [ ] **Step 3:** Two exits: **finish** (a knife in the grab = execution, lethal) or **throw** (shove along your facing — reuse `deathShove`-style knockback; slamming a thrown body into a wall should hurt, and `world.ts:812-848` already has corpse wall-slam machinery to borrow).
- [ ] **Step 4:** A grab must be **escapable** — reuse the ice-encasement struggle meter (`world.ts:1310-1336`), the game's only existing action-lockout with a counterplay.
- [ ] **Step 5:** Grab beats block; a **strike** landing on a grabber breaks the grab (closes the triangle). Never allow grabbing an LSW — that is a griefer we would be writing (same spirit as the smoke carve-out in `perception.ts:110-112`).

### B4 — Making it visible (the half Robert actually asked for)

**Files:** `src/client/renderer.ts`, `src/client/animation.ts`, `src/client/audio.ts`

- [ ] **Step 1 — unlock the poses.** `castPoses`' `slam` (`renderer.ts:3138-3142`) and `thrust` (`:3171-3174`) are **already the punch curves**; they are gated behind `if (s.ascendant …)` (`:3131`). Drop the LSW guard so soldiers can play them.
- [ ] **Step 2 — un-gate the telegraph.** The melee wind-up arm-lift is hard-gated to undead by `zed ? … : undefined` (`renderer.ts:3013`). A living soldier must telegraph too — the wind-up is what makes blocking readable.
- [ ] **Step 3 — beat the rebase (trap #3).** Suppress `runBlend` for the duration of a strike, or apply the strike layer after the run-carry rebase at `renderer.ts:3050-3051`. Verify by punching *while sprinting* — that is where it breaks.
- [ ] **Step 4 — port the lab's slash.** `stylelab.ts:869-919` has the good version: per-weapon reach arcs (`ARC_STYLES`, `:308-314`), an edge that sweeps +1.9 → −1.9 rad, a two-layer trail, torso twist into the sweep, counter-rotating legs, and a **hit flash** that recolors the whole arc red for 0.18 s. Replace the flat single `RingGeometry` (`renderer.ts:3470-3488`) with it. Pool the geometry — the lab rebuilds and disposes it *every frame*, which is fine in a lab and unacceptable in the match loop (audit R11/E8, [issue #25](https://github.com/taskmasterpeace/ShootEm/issues/25)).
- [ ] **Step 5 — hit-stop.** A ~60 ms freeze on the connecting frame is what makes a hit feel like a hit. The killcam already owns a time-ramp curve (`replay.ts:38-54`) — the same idea, one-shot, at the strike.
- [ ] **Step 6 — sound.** There is exactly one melee sound in the game (`claw`, `audio.ts:5`). Needs: whoosh (miss), impact-flesh, **block-clang**, parry-ring, grab-grunt, execution. The block-clang is the load-bearing one — it is how you learn the defensive verb exists.
- [ ] **Step 7 — HUD.** Nothing anywhere hints at melee (`hud.ts`, `index.html` have no F or axe hint today). Show the melee key on the weapon lockup, and a block-energy read while held.
- [ ] **Step 8 — cleanup.** Register the new transient pose/VFX maps in `resetTransient` (`renderer.ts:2737-2743`) or a harness re-pick will render a stale swing on a new body.

### B5 — Elbows (the quality ceiling)

The live rig can only swing from the shoulder: `foreR`/`foreL` groups **exist** (`models/soldiers.ts:973-1008`) but are **unnamed**, so `getObjectByName` can't reach them and they're absent from `JOINT_NAMES` (`animation.ts:13-16`). They are posed once at build by `solveTwoHandedGrip` and never touched again.

- [ ] A shoulder-only punch reads *acceptably* from command height — ship B4 without this.
- [ ] For a punch that reads *well*, name them and grow `JOINT_NAMES` — which is exactly **Wave 6.2 of `docs/MASTER-BACKLOG.md`** (the papercraft port's rig surgery, 8 joints → 10, `tests/rig.test.ts` is the law). **Land B5 with Wave 6.2, not separately.** Robert's GLB bodies have no elbow at all (`grip.ts:175-226` treats each arm as one rigid segment) and need an explicit fallback.

### B6 — Balance rails

- [ ] Melee must not become the primary weapon. Damage sits under a rifle's DPS at any range a rifle works; the reward is **stealth (backstab), desperation (out of ammo), and interiors** — which is why it lands after Part A gives interiors real sight lines.
- [ ] Backstab multiplier lives **inside the melee resolve only**, never in `damageSoldier` — no global directional damage.
- [ ] Bots must learn the verbs or melee becomes a human-only exploit: `bots.ts` already calls `startMelee` directly for zeds (`:1856-1860`) — give bot infantry a "close and swing when out of ammo / cornered" rule and a block reaction, or the whole layer is free kills.
- [ ] Run a 2-minute bot match and check the K/D spread before and after (the balance law in `docs/MASTER-BACKLOG.md`).
- [ ] `tests/melee.test.ts` exists — extend it: block absorbs, parry staggers, grab pins and is escapable, backstab multiplies, and **a swing still can't hit through a wall** (note: `resolveMeleeStrike` never calls `losClear` today — decide deliberately whether a 2u swing needs it).

