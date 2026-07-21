# SIGHT & STEEL — the visibility rewrite and the melee verbs

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** two things Robert asked for, planned together because they share the same law — *the screen must never lie about what you know*.

- **PART A — SIGHT.** Enemies vanish the instant you lose them; what remains is obviously a memory, not a man. The world outside your eyes goes dark. Walking into a house or a maze, you see what you can see and nothing more.
- **PART B — STEEL.** A real melee layer: **punch · block · grab · stab**, readable from command height.

**Tech Stack:** TypeScript deterministic sim (`src/sim/`), Three.js client (`src/client/`), Vitest. Gates: `npx tsc --noEmit && npx vitest run && npm run lint && npm run build`.

**Sequencing:** Part A first. It is mostly *subtraction*, it pays for itself in frame time, and A3 (the visibility polygon) is the substrate that makes indoor melee legible. Part B lands on top.

---

## PART A — SIGHT

### The diagnosis (measured headless: seed 1234, 12v12 TDM, 120 s, sampled 2 Hz)

The culling **machinery** is correct and already free. `src/client/renderer.ts:1472-1473`:

```ts
mesh.visible = (s.alive || corpse) && (!inVehicle || surfing) && !dark && !(s.cloaked && …);
if (!mesh.visible) continue;
```

`.visible = false` zeroes the color pass, the **shadow pass** (verified in the installed build: `three.cjs:22644`, `WebGLShadowMap.renderObject` returns early on invisible), and every line of pose work below the `continue`. Nothing there is broken.

**The machinery is ~95% ineffective, and not because it is slow — because it asks the wrong question.** `world.lastSeen` is indexed **by team, not by viewer** (`world.ts:1434-1435` gathers *all live friendlies* as `eyes`). The renderer draws an enemy if **any of your twelve teammates** saw him, then holds him for **your** class's linger.

| For the local player, per frame | count |
|---|---|
| enemies alive | 9.20 |
| seen by **your own eyes** | **4.84** |
| seen by the **team** | 7.62 |
| **actually drawn on your screen** | **8.70** |

**You are shown 80% more enemies than you can personally see.** That is the complaint, stated as a number.

**Three compounding causes:**

1. **Team vision wears your body's eyes.** The screen is answering "has anyone on my side seen him lately," which is a *radio* question, not an *eyes* question.

2. **The ghost is a man, not a memory.** With the default 2.5 s linger and a linear ramp (`renderer.ts:1443`), a lost contact is drawn at **80% alpha at 0.5 s** and stays **over 50% for ~1.2 s** — indistinguishable from a live enemy at combat pace. Worse: the ghost is frozen in position (`renderer.ts:1574`) but **still fully animated** (`animateSoldier` at `:1610` gets the *live* soldier), so it is a half-transparent enemy **jogging in place** where you lost him. The health ring inherits the same alpha and reads as real too.

| Viewer class | linger | with `tracking_optics` |
|---|---|---|
| infantry / heavy / jump / engineer / medic / **anything unlisted** | **2.5 s** | 4.0 s |
| pathfinder | 3.5 s | 5.0 s |
| infiltrator | 4.0 s | 5.0 s (capped) |
| ghost | 5.0 s | 5.0 s (capped) |

3. **Four systems answer "can I see him" four different ways.** This is the deepest reason the screen feels untrustworthy:

| Consumer | Whose eyes | Cone? | Range | Linger |
|---|---|---|---|---|
| sim `perceivesNow` | team | yes, 132° | 65 × weather | — |
| 3D view (`renderer.ts:1435`) | team | inherited | inherited | **2.5–5 s** |
| minimap (`hud.ts:536-543`) | **you** (+headcam mates) | **no — 360°** | 55 | **none** |
| net cull (`snapshot.ts:115-118`) | team | **no — 360°** | 65 × weather | 1.5 / 3 s |

The minimap and the 3D view are reading different data to answer the same question, and offline vs online the linger differs by up to 3.5 s.

**Two leaks found on the way:**
- **Corpses bypass the fog entirely** — the `dark` computation requires `s.alive` (`renderer.ts:1434`) while `:1472` admits `corpse` independently. ~2.8 dead enemies at any moment, drawn at full cost map-wide: **~168 shadow draws** for bodies you cannot see, plus free intel on where your team is dying.
- **Enemy vehicles are never culled** — `renderer.ts:1662` is `mesh.visible = v.alive;`, the entire test. Enemy hulls draw map-wide regardless of perception. The *network* cull does filter them (`snapshot.ts:138-145`), so **offline leaks what online does not.**

### A1 — Your eyes draw your screen; your team feeds your map

**Files:** `src/client/renderer.ts` (~1425-1473, 1662), `src/client/hud.ts` (~532-543), `src/sim/snapshot.ts` (~115-137)

**[DECISION — Robert's call, and the heart of this whole plan.]** §19.1 deliberately chose *friendly eyes* — team vision. Robert is now saying that reads as noise. The resolution I recommend is not to pick one, but to **split them by surface**:

> **Your 3D view shows what YOU see. Your minimap shows what your TEAM sees.**

That is diegetically exact — the minimap *is* the radio, shared intel is what a radio is for — it keeps the squad-vision fantasy §19.1 wanted, it makes the screen trustworthy, and it happens to be where all the frame time is. It also collapses the four-way inconsistency above into two honest, clearly-labelled channels.

- [ ] **Step 1 — per-viewer bodies.** Replace the `world.lastSeen[localTeam]` read (`renderer.ts:1435`) with a direct `perceivesNow(grid, [local], pinged, s, range, smokeBlobs, revealed)` per enemy. Cost: ~9 calls/frame; audit S5 benched the *whole 24-body team pass* at 8.7 µs, so a one-eye pass is ~1 µs. Free.
- [ ] **Step 2 — the ghost stops being a man, and it HOLDS then FADES (Robert, 2026-07-20: "I used to see it blinking out — I don't want that. I want it to hold, and fade out if needed").** The body still vanishes fast (~0.2–0.4 s so a doorway-strafer doesn't strobe), but what replaces it is a **LAST KNOWN CONTACT mark** at `mark.x/mark.z` that **holds solid for the bulk of the linger window, then dissolves over the last stretch** — never a hard pop at the end. A flat ground stencil in the terminal language: hollow bracket-diamond, enemy team color, **no body, no limbs, no animation**, an age tick that shortens as it ages. It must read as **UI, not a person**, from command height. (The current bug is the opposite failure — the *body* fades from 80% while still animating, and the mark it should become doesn't exist. Hold the mark, dissolve the mark, never blink.) Pool the marks (audit R11/E8, [issue #25](https://github.com/taskmasterpeace/ShootEm/issues/25)).
- [ ] **Step 3 — the ghost must also stop *moving*.** Today a frozen ghost is still fed the live soldier to `animateSoldier` (`renderer.ts:1610`), so it jogs in place. Whatever survives Step 2 must not animate.
- [ ] **Step 4 — plug the corpse leak.** `dark` requires `s.alive` (`:1434`) while `:1472` admits `corpse` independently. Corpses must obey the same fog. (~168 shadow draws, plus it is free intel about where your team is dying.)
- [ ] **Step 5 — plug the vehicle leak.** `renderer.ts:1662` is `mesh.visible = v.alive;`. Enemy hulls need the same perception test — the net cull already does this (`snapshot.ts:138-145`), so this is offline catching up to online.
- [ ] **Step 6 — keep the minimap team-wide, and say so.** Leave `hud.ts` on team intel deliberately, and label it in the UI so the split is legible rather than a bug. (This composes with audit R7/E2, [issue #6](https://github.com/taskmasterpeace/ShootEm/issues/6) — that fix should read `lastSeen` instead of raymarching.)
- [ ] **Step 7 — unify the net linger** (`snapshot.ts:115-118`, 1.5/3 s) with whatever Step 2 lands on, so online and offline agree.
- [ ] **Step 8:** Keep the footstep smudge (`renderer.ts:1450-1464`) untouched — hearing stays a skill, and it becomes the *main* channel for the hidden instead of firing on ~5% of enemies.

**The read Robert asked for, in three states:** solid body = *I see you* · bracket mark = *I remember you* · nothing = *dark*.

### A2 — Reading the dark

**Files:** `src/client/renderer.ts` (every material-creation site), `src/client/models/shared.ts` (`mat()`)

Two hooks ruled out by measurement, so nobody re-proposes them:

- **No post-processing exists** (no `EffectComposer` anywhere; `renderer.ts:2394` is a bare `render()`). A fullscreen pass at DPR 2 / 4K writes **8.3 M fragments twice** and forces MSAA onto a multisampled render target — audit L6 already names fullscreen overdraw as the low-end killer. Wrong tool.
- **The ground canvas is built once per match** (1024², `renderer.ts:663-710`), never re-uploaded. Repainting it per frame = 10,000 `fillRect`s **+ a 4 MB upload every frame** (~250 MB/s). And it would darken only the ground while soldiers and walls stayed lit, which reads as a bug.

**The right hook is shader injection via `Material.onBeforeCompile` — zero extra draws, zero passes, zero uploads:**

- [ ] **Step 1 — the analytic cone (near-free).** One shared chunk, four uniforms — `uEyePos`, `uEyeYaw`, `uConeHalf` (1.15), `uRange` — multiplying `gl_FragColor.rgb` by a visibility factor computed per fragment from world position. **~6 ALU ops per fragment.** No texture, no upload, no draw call. This alone gives Robert directionally-correct darkness at no measurable cost.
- [ ] **Step 2 — soften and tune.** A falloff ramp at the cone edge and at `uRange` so the boundary reads as murk, not a laser line; keep the 9u `RING` lit all around (`perception.ts:25`) or you blind the player to their own feet.
- [ ] **Step 3 — weather ties in free.** `visionMult` (`src/sim/weather.ts:70`) already taxes the eye and `renderer.ts:389-392` already pins fog to `perceiveRange`. Feed the same number to `uRange` and fog visibly closes the cone in.
- [ ] **Step 4 (optional, only if wall-shadowing is wanted) — the LOS mask.** A **128×128 R8** texture over the 300u world (2.34 u/texel) written CPU-side per frame from the same raymarch `losClear` already does, uploaded as **16 KB/frame**. Still zero extra draws. Do this only after Step 1 ships and only if the analytic cone feels insufficient indoors.

**The real work is coverage, not the shader.** The injection must reach *every* material site or the effect looks broken: ground `:705`, walls `:776`, grass `:815`, cover `:821`, climb `:837/:841`, slits `:858`, metal `:872`, houses `:953-985`, roofs/uppers `:933-1099`, plus `models/shared.ts:mat()` and the GLB bodies. That is the day of work — budget it there, not in the GLSL.

- [ ] **Step 5 — accessibility.** Expose strength in settings (`off / subtle / full`). Some players want the information without the murk.

### A3 — Houses and mazes (two real bugs, then the hard part)

- [ ] **Step 1 — the upstairs fishbowl [BUG, hours].** `world.ts:2902,3182` set `s.pos.y = 4` for `floor === 1`. `perception.ts:94` then reads `if (s.pos.y > 3 && eyes.some(within range)) return true` — **no cone, no LOS, no smoke.** So **anyone on a second storey is visible to the entire enemy team out to 65 u through every wall and every roof.** The skyline rule was written for jetpacks and silhouettes against the sky; it catches the second storey by accident. Guard it on floor (`(s.floor ?? 0) !== 1`) or require an LOS check at the upper band. **This single line is most of Robert's "I should see what I can see in a house."**
- [ ] **Step 2 — upstairs has no walls, to the eyes [BUG, hours].** `losClear(grid, a, b, y)` takes **one layer** and never consults `grid2`. `blocksShotUpper` (`map.ts:279-285`: F2_WALL blocks 4..8, F2_SLIT passes 5.2–5.8) **already exists and is never called from perception.** Wire it in so upstairs-to-upstairs sight obeys upper walls.
- [ ] **Step 3 — what already works, don't break it.** Ground-floor interior LOS is genuinely good: `losClear` marches at y=1.4 through `blocksShot`, `T_SLIT` passes only in the 1.2–1.8 firing band, houses have real BSP floor plans with interior doors (`buildings.ts:397-445`), and the reveal sets (`renderer.ts:1303-1319`) already guarantee a legitimately-seen enemy can never hide under an opaque roof. Standing outside a house today, occupants are correctly hidden.
- [ ] **Step 4 — the floor plan giveaway [days, do last].** The roof opens when you are within **4.5 u of the house rect** (`renderer.ts:1350-1354`), which hands you a room layout you have not earned. Fixing it needs A2's darkness to extend indoors, or per-room roof opacity keyed to rooms actually entered (needs per-room tagging in `buildings.ts`). Do not attempt before Steps 1-3.

### A4 — Does this help performance? (the direct answer)

**No — darkness never saves frame time. Culling does, and the culling hook already exists and is currently defeated.**

Darkening is a shading operation: it changes fragment color and removes no geometry, no draw call, no shadow draw, no animation. Done as A2 Step 1 it is unmeasurable; done as a fullscreen pass it is measurably *bad* on the iGPUs we're protecting. At best it is free.

**The saving is A1, and it is large:**

| change | effect |
|---|---|
| per-viewer bodies (A1 S1-2) | drawn enemies **8.70 → ~4.84**: ~**230 color draws + 230 shadow draws** and ~4 `animateSoldier` calls gone per frame, for ~1 µs of `perceivesNow` |
| corpse leak (A1 S4) | ~**168 shadow draws** |
| vehicle leak (A1 S5) | more, unmeasured |

Stated plainly: **darkness is what the player sees; visibility is what the GPU is told. They are the same variable with the wrong subject today.** Fixing the subject is the optimization; the darkness is the feedback that makes it legible.

- [ ] **Step 1 — do the shadow box first, it is the biggest line in the report.** The sun's ortho box is nailed to `S = 130` over a 300 u world (`renderer.ts:629-632`) with a 2048² map, and **never follows the camera** — every soldier map-wide pays full shadow draws every frame. **~75–80% of ~1,242 soldier shadow draws are for bodies not on screen.** Tighten to a ~60 u box tracking `camPos`: far fewer casters *and* sharper shadows. Effort: **hours**. (Audit R3, [issue #31](https://github.com/taskmasterpeace/ShootEm/issues/31).)
- [ ] **Step 2 — measure A1** before/after with draw-call counts during a firefight; the numbers above are the prediction to check.
- [ ] **Step 3 — only then, the honest license.** Once the world outside the cone is genuinely dark, props/decals/particles/grass outside it may be skipped rather than dimmed. Do not claim this in advance.

### A5 — Tuning and safety rails

**This reverses an earlier call, deliberately.** `tests/visionfade.test.ts:1-5` records the original law in Robert's own words — *"when you look away they should fade over 5s; different classes see longer; the MAX is 5"* (§11 row 6). He is now saying he can't tell who he can and can't see. Both are right: **the information was correct, the costume was wrong.** The fix keeps the fade window and the per-class perk and changes only what wears it — a mark instead of a man. Say so in the commit, so the next reader doesn't think the law was forgotten.

- [ ] Linger *marks* keep the existing per-class durations — recon still remembers longest, `classLinger` is untouched, and **`tests/visionfade.test.ts` stays green** (it pins the linger math in `src/sim/perception.ts`, not the rendering — verified).
- [ ] The exceptions in `perceivesNow` are law and must still shine through: cloak is TRUE, the flag is public, pings are electronic, the **skyline rule** (`pos.y > 3`, no cone check) means a jet or a jump trooper against the sky is seen in your periphery, and a muzzle flash cuts murk to 50u.
- [ ] **A1 and A2 are presentation only** — they read existing sim values and change nothing in `src/sim`. `tests/visibility.test.ts`, `tests/visionfade.test.ts` and `tests/culling.test.ts` must stay green **without being edited**; if one needs a change, the change is wrong.
- [ ] **A3 Steps 1-2 are the exception and must be treated as sim surgery.** Guarding the skyline rule and teaching `losClear` about `grid2` change `perceivesNow`, which **bots read too** (`bots.ts:344-357`) — correctly, since the fishbowl cheats bots and players alike, but it *will* shift bot behavior. Expect terrain-coupled harnesses to move (a known trap: RNG/vision shifts expose seed-fragile tests). Land A3 in its own commit, run the full suite, and re-run a 2-minute bot match watching the blackbox (`__ww.blackbox('report')`) for new stuck/knot incidents before calling it done.
- [ ] Nothing here may make an LSW hideable — the smoke carve-out (`perception.ts:110-112`) exists because an unanswerable boss is a griefer we wrote. Same spirit applies to the cone and the mask.
- [ ] Accessibility: expose overlay strength in settings (`off / subtle / full`). Some players will want the information without the murk.
- [ ] Ghost bodies are drawn **transparent**, which costs more than opaque (sorting, no early-z). Removing them is a slightly bigger win than the raw mesh count suggests.

---

## PART B — STEEL

> **Terminology updated by law (2026-07-20, later the same day):** `docs/OUTBREAK-SPEC.md` §12-16 locks the player-facing words — **STRIKE / GUARD / GRAPPLE** (same triangle as below: GUARD beats STRIKE, STRIKE beats GRAPPLE, GRAPPLE beats GUARD), charged melee = **Impact Charge**, rear grab = **Rear Control** resolved by the **Control Struggle** (attacker's Control Zone vs defender's Break Needle, best-of-three), zombie version = **Bite Struggle**. Where this plan says punch/block/grab, read STRIKE/GUARD/GRAPPLE; B3's grab design is superseded by the spec's richer Control Struggle. Everything structural below (the traps, the shipped swing engine, the integration points) stands.

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

