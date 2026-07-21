# War World — Optimization Audit (2026-07-20)

*Scope: low-end machines and network-play readiness. Method: every finding below was measured (headless benches, V8 CPU profiles, on-disk byte counts, twin-world determinism runs) and then adversarially re-verified by fresh-context agents against current code; where the re-check moved a number, the corrected number is printed. Effort scale: **hours** / **day** / **days**. IDs (R/S/N/L/E) link the board to the sections below.*

**Headline:** the game's biggest costs are structural, not mysterious — ~60 draw calls per soldier body, a 132 MB uncompressed WAV pack decoded to ~265 MB of RAM before the first shot, an O(S²) rescue scan that is the hottest function in the sim, and a snapshot pipeline that costs the server more CPU than the war it describes. The sim itself is genuinely deterministic and already shaped correctly for server-authoritative netcode — the netcode work is finishing a stack that exists, not inventing one.

---

## THE BOARD

Ranked by payoff-per-effort. Quick wins first.

### ✅ CLOSED (all byte-identical — 1560 tests + twin-run gate green each)

**Prior:** #1 (audio Opus), #3 (input queue), #5 (objective cache 2-4 Hz), #38 (uniform spatial grid).

**This pass (2026-07-21)** — measured before/after on `tools/zombie-bench.ts` (horde) + the new `tools/combat-bench.ts` (12v12 conquest), min-of-4:
- **#11 (S8) encased-body set** — `groundBlocked` no longer walks the roster hunting ice (O(S²)→short list). The headline: **N=240 horde −30%**, and it flattened the whole curve.
- **#10 (S6) parked-hull drivetrain skip** — 32/34 hulls sit idle; they skip the drivetrain. **Vehicle-dominated −33%**, ~5% of a 12v12 step (a fixed ~0.02 ms/tick).
- **#8 (S7) humansAndBots() cache** — match-stable roster memoized. **N=240 −4%** (the big separation win was already banked by #38; this is the residual).
- **#9 (S5) losClearXZ** — kills ~11.5k perception object-allocs/tick. Byte-identical; no headless delta (GC didn't fire), a preventive browser GC-pressure win.
- **#27 (S9) possession-scan gate** — one counter skips the 3 expiry scans (one walks the full roster) when nothing is possessed. Byte-identical; µs-level, below the bench floor.

**Cumulative (all 5 vs pre-campaign):** horde N=120 **−22%**, N=240 **−37%**; the superlinear O(S²) tail (1.80×→1.46× for 2× bodies) is gone. Vehicle-dominated combat **−33%**. Remaining sim tickets (#2 S1, plus the folds in #27) are now µs-level or throttled by #5 — **further gains are in the renderer (R-series) and netcode (N-series), not the sim tick.**

| # | Fix | Where | Payoff | Effort | § |
|---|-----|-------|--------|--------|---|
| 1 | Encode audio WAV → Opus, prune dist WAVs | `audio.ts:340` | dist 175 MB → ~30 MB (audio 132 → ~9 MB) | hours | L3 |
| 2 | Shared per-tick rescue pass (kill per-bot `isolatedFriendly`) | `bots.ts:508` | ~16% of sim tick back | hours | S1 |
| 3 | Per-client input queue + staleness cutoff | `server.ts:436` | no eaten one-shot presses, no stuck fire/walk | hours | N3 |
| 4 | Cull events/gadgets/turrets/projectiles per viewer | `snapshot.ts:147` | closes the map-wide ESP leak; −30-50% event bytes | hours | N4/E5 |
| 5 | Cache bot objective at ~2-4 Hz | `bots.ts:1015` | 20-33% of `World.step` | hours | S4 |
| 6 | Throttle minimap + read sim perception | `hud.ts:435` | up to 144 LOS raymarches/frame → ~0 | hours | R7/E2 |
| 7 | Key HUD innerHTML writes; 4 Hz scoreboard | `hud.ts:418` | ~59/60 of HUD DOM work gone | hours | R8/E3 |
| 8 | Cached roster for `humansAndBots()` | `world.ts:4654` | ~6 MB/s of the 25.7 MB/s GC churn | hours | S7 |
| 9 | `updateLastSeen` every 2nd tick + scratch buffers | `world.ts:1419` | halves the biggest LOS loop, zero fidelity loss | hours | S5 |
| 10 | Parked-hull early-out in `stepVehicle` | `world.ts:3467` | ~5% of `step()` | hours | S6 |
| 11 | Per-tick encased set (guard the physics scan) | `world.ts:3008` | kills a latent O(S²) that scales to hordes | hours | S8 |
| 12 | Cache named nodes in vehicle/gadget/LSW loops | `renderer.ts:1654` | ~270 recursive searches/frame → 0 | hours | R6 |
| 13 | Pool projectile geometries/materials | `renderer.ts:3219` | no GPU buffer churn at fire rate | hours | R5 |
| 14 | Validate join loadouts vs `CLASS_ARMORY` | `world.ts:386` | no `tank_cannon` infantry | hours | N5 |
| 15 | Accumulator server tick loop | `server.ts:103` | sim time stops dilating under load | hours | N6 |
| 16 | dt-scale the 8 bot probability rolls (or unify rate) | `bots.ts:1343` | same bot army offline and online | hours | N7 |
| 17 | Strip all `bot*` wire fields; delta dug/breached/doors | `snapshot.ts:49` | −6.3% snapshot now; stops monotonic growth | hours | N8 |
| 18 | Cap/flush the hidden-tab event buffer | `net.ts:84` | no refocus hitch, no unbounded growth | hours | E6 |
| 19 | Alias-free record snapshot (drop structuredClone) | `replay.ts:74` | 0.42 ms → ~0.13 ms per record at 10 Hz | hours | E4 |
| 20 | Twin-world determinism regression in CI | `tests/` | protects replays, killcam, and all netcode | hours | N9 |
| 21 | DPR/renderScale + AA off + far-plane clamp on LOW | `renderer.ts:338` | ~4× fewer fragments on 4K iGPU laptops | hours | L6 |
| 22 | Online killcam records received snapshots directly | `replay.ts:74` | deletes a duplicate 10 Hz serialize | hours | N11 |
| 23 | Particle pool idle-skip + drawRange | `effects.ts:92` | no 4.3 MB/s GPU upload while idle | hours | R9 |
| 24 | Global audio voice cap | `audio.ts:452` | bounded WebAudio mixing in teamfights | hours | E9 |
| 25 | Pool blast/smudge/slash/sweep FX | `renderer.ts:544` | zero allocation at combat moments | hours | R11/E8 |
| 26 | Hoist frame-loop scratch (Vector3s, fogK, Sets, indexOf) | `renderer.ts:2346` | fewer GC hitches in the hottest client loop | hours | R10 |
| 27 | Merge `step()` housekeeping scans | `world.ts:1235` | several full-Map traversals per tick | hours | S9 |
| 28 | Lazy soldier-GLB probes | `soldiers.ts:28` | 8 requests off the menu's critical path | hours | L8 |
| 29 | Theater map → WebP, render `<img>` once | `main.ts:990` | 3.5 MB → ~350 KB, no re-decode per click | hours | L7 |
| 30 | Quality-scaled FlashLights (2 on LOW) | `effects.ts:101` | cheaper every lit fragment on iGPUs | hours | R12 |
| 31 | Quality settings system (`low`/`medium`/`high`) | `settings.ts:17` | the knob everything hangs off; shadows off + DPR 1 on LOW | day | L1/R3 |
| 32 | Tiered audio load: CORE now, LSW voices on demand | `audio.ts:337` | deploy stall gone; ~265 MB PCM → ~15 MB | day | L2/E1 |
| 33 | Merge roofs/uppers per house | `renderer.ts:1060` | ~900 static draws → ~30 | day | R2 |
| 34 | Splats → InstancedMesh per color | `renderer.ts:504` | ≤10 draws for 900 decals, sort cost gone | day | R4/E7 |
| 35 | Snapshot interpolation buffer | `net.ts:83` | remotes stop warping every 66 ms | day | N1 |
| 36 | Per-team snapshot stringify | `server.ts:184` | 5.7 ms/snap-tick → ~0.5 ms at full roster | day | N10 |
| 37 | Merge + template-clone soldier bodies | `soldiers.ts:725` | ~2,900 → ~480 soldier draws (procedural ceiling) | days | R1/L4 |
| 38 | Uniform spatial grid + `forEachInRadius` | `world.ts:3967` | kills the O(S²) family; 80-body tick 8.4 ms → sane | days | S2 |
| 39 | Static/dynamic snapshot split + per-entity deltas | `snapshot.ts:65` | wire CPU from 2.5× sim → minor; ~1-2 KB/snap | days | S3 |
| 40 | Cmd seq + client prediction/reconciliation | `net.ts:129` | rubber-banding gone at real RTT | days | N2 |
| 41 | One canonical 30 Hz sim rate | `main.ts:595` | −50% sim cost on low-end; offline = online | days | S10 |
| 42 | Real match teardown (no page reload) | `main.ts:339` | 10-30 s between-match gap gone | days | L5 |

---

## 1 · RENDERER

The client is draw-call-bound on exactly the hardware being protected. Soldiers, roofs, and decals independently contribute hundreds-to-thousands of draws; a busy fight reaches 3,000-8,000 draw calls/frame against the ~1-2k an Intel iGPU sustains at 60 fps.

### R1 — Soldier bodies are ~60 draw calls each
`src/client/models/soldiers.ts:725` — **high / days**

Measured headlessly: `buildTrooper()` = 60 meshes / 60 **unique** BufferGeometries / 13 materials per body, all `castShadow` (heavy 59, zombie 20, LSW titan 64). Nothing is shared between soldiers — every `box`/`cyl`/`limb` allocates fresh geometry, `mat()` a fresh `MeshStandardMaterial`. The all-procedural ceiling at default 12v12 is ~1,440 meshes ≈ ~2,900 draws/frame including the shadow pass — exact for headless/tests and all Collective bodies; a live browser match runs ~1,100-1,300 because team-0 infantry/pathfinder ride shared-geometry GLBs (`soldiers.ts:129-131`). The color pass frustum-culls and fog-of-war hides unseen enemies (`renderer.ts:1472`), but the sun's fixed ±130u ortho box (`renderer.ts:629-632`) covers the whole map — **every visible soldier map-wide pays its full shadow draws every frame regardless of camera**. This is the single biggest low-end cost in the game.

**Fix:** (1) Merge rigid decoration into the joint it rides: torso gear (~25 meshes) becomes ONE geometry via `BufferGeometryUtils.mergeGeometries` with baked vertex colors; likewise per leg/shin/arm/head/gun. The 8 animated joints + gun stay separate groups, so `animateSoldier`/`poseSoldierJoints`/ragdoll are untouched. ~12 draws per body — emissive trim needs a second merged material, since vertex colors can't bake per-part emissive. Soldiers: ~2,900 → ~480 draws. (2) One template per (team, classId), `clone()` per soldier — clone shares geometry; clone the ~10 materials per body so `setAlpha`/cloak fades stay per-soldier (the pattern `buildGlbTrooper` already uses at `soldiers.ts:488`). Guard with `tests/rig.test.ts`.

### R2 — Roofs and second storeys are one mesh per tile
`src/client/renderer.ts:1060` — **high / day**

The flat/parapet/vents roof path creates a Box mesh **per covered tile** (`renderer.ts:1060-1067`); the second-storey builder does the same for floor slabs and upper walls (`renderer.ts:946-961`). Measured (seed 1234, 10 houses): **570 roof slabs + 380 upper meshes** (240 upper tiles) — ~900 color-pass draws, most again in the shadow pass (roofs and upper walls/slits cast; upper floor slabs don't), plus ~900 GPU buffers — for geometry that never moves.

**Fix:** merge per house, per material, with `mergeGeometries` (slabs already share `rmat`/`matU`/`matF` per house — exactly what the cutaway fades key on): 1-3 meshes per house, ~900 draws → ~30. The `roofs[]`/`uppers[]` fade loops keep working unchanged (they touch only per-house materials); `collapseTile` never removes roof/upper/ladder meshes; three 0.170 ships `mergeGeometries`. Ladders/stairs (`renderer.ts:896-926`, 9 meshes each) join the merge — bake each group's `rotation.y`/position into the geometry.

### R3 — Graphics budgets are hard-coded at construction
`src/client/renderer.ts:336` — **high / day** (system design at L1)

Constructor hard-codes `antialias: true`, `setPixelRatio(min(devicePixelRatio, 2))`, `PCFSoftShadowMap` with a 2048² map (`renderer.ts:628`) whose ortho frustum spans S=130 — a 260u box over the **300u** world (TILE 3 × GRID 100, `src/sim/map.ts:9-11`), ~87% coverage: poor texel density AND every castShadow mesh renders into it each frame. No resolution scale, no `powerPreference` hint (dual-GPU laptops may pick the iGPU), and `settings.ts:17-30` has zero graphics knobs. (The resize handler's missing `setPixelRatio` only matters when DPR itself changes — three.js reuses the stored ratio.)

**Fix:** the quality tiers of L1, plus renderer-specific moves: tighten the shadow camera to a ~60u box following `camPos` each frame — sharper shadows AND far fewer casters in-frustum; pass `powerPreference: 'high-performance'` at construction (settings load at `main.ts:1018` precedes `new Renderer` at `main.ts:323` — the order already works); dynamic resolution that steps DPR down 0.25 when frame dt exceeds 20 ms for a second.

### R4 — Up to 900 individual transparent splat meshes
`src/client/renderer.ts:504` — **high / day**

`spawnSplat` adds one Mesh per paint/blood/pock decal with a 900-mesh FIFO cap (`renderer.ts:521`). Geometry and materials are cached (good) but three.js does not batch: at cap that is 900 overlapping transparent draws plus an O(n log n) transparent sort every frame — and even off-screen, all 900 pay per-frame matrix recomposition, traversal, and frustum tests. Pock/dirt spawn unconditionally in **all** modes, so any sustained firefight reaches the cap; paintball sprints there (`spawnGoo` = blob + 2-4 satellites per hit, `renderer.ts:490-502`).

**Fix:** one `InstancedMesh` per cached color material — ~10 in practice (6 `PAINT_COLORS` dealt per soldier id via `onboarding.ts:121-145`, blood 0x6b1414/0x5e1010, pock, dirt). `spawnSplat` writes an instanceMatrix slot; the FIFO overwrites the oldest slot. 900 draws → ≤10, sort gone, zero allocation per splat. Renderer-only — splats are static after placement, no test touches them.

### R5 — Every bullet allocates 1-4 geometries + materials, disposed at death
`src/client/renderer.ts:3219` — **medium / hours**

`makeProjectile` builds each round from fresh Cylinder/Cone/Box/Sphere geometry plus fresh `MeshBasicMaterial`s (default bullet = 4 meshes: slug, tip, streak, glow — `renderer.ts:3321-3339`); the despawn loop disposes them (`renderer.ts:1975-1987`). A 24-bot firefight fires tens of rounds/second — dozens of GPU buffers allocated and freed per second, forever; 40 rounds airborne ≈ 120-160 draws. LSW needlers, paintballs, and beams ride the same path.

**Fix:** hoist geometries to module constants keyed by tracer family (identical per family — color lives in the material) and cache materials in a Map keyed `${tracer}:${color}` like `splatMats`. `makeProjectile` then allocates only Group + Mesh wrappers; despawn stops disposing shared assets. Follow-up: render default slugs+streaks as one InstancedMesh driven from `world.projectiles` → ~2 draws total in flight.

### R6 — `getObjectByName` in the per-frame hot loops
`src/client/renderer.ts:1654` — **medium / hours**

The vehicle loop runs 6 unconditional recursive name searches per vehicle per frame (`'rider'`, `'pulse'`, `'spin'`, `'healRing'`, `'turret'`, `'gunRecoil'`) plus 0-2 kind-conditional ones (rotors/thrust/legs/drill) — 6-8 per hull over 15-27-node graphs. A standard generated map spawns 34 vehicles → **~270 recursive searches ≈ 7k+ node visits per frame** before any rendering, plus the gadget loop (`'spin'` :2031, `'camHead'` :2053, `'pulse'` :2095) and `animateSoldier`'s per-LSW `'cape'`/`'clockdial'` walks over 77-node god bodies (:3064, :3070). The codebase already knows the fix — soldier joints are cached in userData at build (`renderer.ts:1405-1408`), wheels at `vehicles.ts:729`.

**Fix:** one traversal at build (or first sight) fills `mesh.userData.named = { rider, rotorL, ..., gunRecoil }`; the frame loop reads the record. Same for LSW cape/clockdial in `dressAsLsw`. Mechanical, zero behavior risk.

### R7 — Minimap repaints at 60 Hz with hand-rolled LOS raymarches
`src/client/hud.ts:435` — **medium-high / hours**

`hud.update` runs every RAF (`main.ts:812`) and `updateMinimap` fully repaints the 440×440 canvas each time, then recomputes visibility from scratch: `seesEnemy → eyeSees → losClear` (`hud.ts:513-524`), a ~37-step grid raymarch at 55u range. With the headcam equipped it loops every teammate per enemy — up to 144 raymarches ≈ 5k+ `blocksShot` calls per frame (the worst case: checks are distance-gated at 55u/50u, skip smoked/pinged/cloaked, and early-exit once seen — typical no-headcam cost is ~12/frame). Enemy vehicles add a `losClear` plus a `mates.some()` chain each (`hud.ts:582-584`). All of it duplicates perception the sim already stamps every tick.

**Fix:** throttle to 10-15 Hz (it's a radar), and read `world.lastSeen[localTeam]` + `world.pinged` — the same source the 3D view draws from (`renderer.ts:1424`) — O(1) per enemy, and minimap intel becomes consistent with the world view. Two verified amendments: `SeenMark` records no per-viewer attribution, so headcam's "see what teammates see" (`data.ts:520`) cannot be a post-filter on `lastSeen` — either keep cheap local-only raycasts for the no-headcam path and use `lastSeen` only when headcam is equipped (which alone kills the 144-raycast case), or deliberately promote team vision to baseline (matches the renderer, but nullifies head_cam's sole perk — owner sign-off). And puppet/net worlds never stamp `lastSeen` — mirror `renderer.ts:1301-1310`'s snapshot-presence guard or enemy dots vanish in network play.

### R8 — HUD rebuilds innerHTML every frame
`src/client/hud.ts:418` — **medium / hours**

`updateObjectives` assigns `bar.innerHTML` unconditionally every frame; in a vehicle `sysPips` (`hud.ts:204-208`) and `crewPips` (`hud.ts:223`) rebuild per frame; while Tab is held — and for the entire post-match linger — `renderScoreboard` reconstructs the full table with sorts and string joins every frame (`hud.ts:340-341, 655-676`). innerHTML assignment is never a no-op: identical strings still reparse and rebuild all children. The self-ring canvas already demonstrates the house fix — redraw only when a rounded key changes (`hud.ts:139-141`).

**Fix:** key every block — `if (chips !== this.lastChips) { this.lastChips = chips; bar.innerHTML = chips; }` — and throttle `renderScoreboard` to 4 Hz while held. Content changes at ~1 Hz, so this removes ~59/60 of the DOM work for ~15 lines across the four sites (418, 204, 223, 676).

### R9 — Particle pool uploads 72 KB to the GPU every frame, even idle
`src/client/effects.ts:92` — **low / hours**

`Particles.update` always walks all `MAX_PARTICLES=3000` slots and unconditionally flags position+color `needsUpdate` (`effects.ts:92-93`) — ~4.3 MB/s at 60 fps regardless of alive count, including menus. `emit()` allocates a `new THREE.Color` per call (`effects.ts:49`).

**Fix:** alive count + high-water index — skip the loop and both uploads at zero alive; `geo.setDrawRange(0, highWater)` so the GPU stops processing 3000 points when 40 live; module-scratch Color in `emit()`; optionally `addUpdateRange` around the touched span.

### R10 — Per-frame allocations in `Renderer.update`
`src/client/renderer.ts:2346` — **low / hours**

Every frame: up to four `new THREE.Vector3` in the camera block (:2342, :2346, :2352, :2356), the `fogK` record literal in `updateWeather` (:379-382) plus two `new THREE.Color` while dust is active (:413-414), fresh `revealRoof`/`revealUpper` Sets (:1303-1304), and `world.map.houses.indexOf(...)` per roof/upper entry per frame (:1327, :1347) — O(houses²) scans for a value that never changes.

**Fix:** instance scratch vectors, a static `fogK` table, persistent Sets cleared per frame, and the house index stored on `roofs[]`/`uppers[]` entries at `buildStaticWorld`. ~30 minutes of mechanical edits in the hottest client loop.

### R11 — Combat-moment FX allocate and dispose geometry per event
`src/client/renderer.ts:544` — **low / hours**

`spawnBlastRings`: Circle(28) + Ring(44) + two materials per explosion (:550-567). `spawnSmudge`: Ring(20) + material per heard-step (:530-540). Melee slashes: Ring(14) + material per swing (:3466-3476). Sensor sweeps: Ring(40) + material every 2 s per crewed sensor hull (:1804-1815). All disposed seconds later — GPU buffer create/destroy stacked on projectile churn at exactly the worst time. The counter-example sits next door: `Fireballs` (`effects.ts:154`) is fully pre-built and pooled.

**Fix:** shared unit geometries (one ring per segment count, one circle) scaled per instance — scale already drives the animations — with materials from a small cached-by-color Map; pool 8-12 slots each, Fireballs-style. The slash wedge angle moves from geometry (`thetaStart`) to `mesh.rotation.y` so one wedge geometry serves every swing.

### R12 — Five permanent PointLights tax every lit fragment
`src/client/effects.ts:101` — **low / hours**

`FlashLights` pre-creates 5 PointLights and leaves them in-scene at intensity 0 (:101-107). Stable count is deliberately smart (no shader recompiles), but in forward rendering every `MeshStandardMaterial` fragment evaluates all 5 + hemi + sun, every frame — a fixed fullscreen tax multiplied across the ground plane, walls, and ~1,000+ soldier meshes at DPR 2.

**Fix:** pool size from the quality tier — 2 on LOW, 5 on high, created once at startup so the count never changes mid-match. On LOW, consider `MeshLambertMaterial` for static walls/roofs — per-vertex lighting is near-identical on flat boxes at this camera distance and much cheaper per fragment.

---

## 2 · SIM

The sim is deterministic and correct; it is also full-scan-everything. Nearly every hot cost below is "iterate the whole roster/Map at 60 Hz for something that is rare, slow-changing, or already computed elsewhere."

### S1 — `isolatedFriendly` is O(S²) per bot per tick — the hottest helper in the sim
`src/sim/bots.ts:508` — **high / hours**

`objectiveFor()` runs every tick for every bot (`bots.ts:1015`); every non-guard bot calls `isolatedFriendly()` (:548), which scans **all** soldiers per friendly — O(S²) per bot at 60 Hz. Profiled (headless, seed 4207): 8.5% self + ~8% inlined into `objectiveFor` ≈ **16% of non-idle sim work** — the hottest helper in the sim, ahead of projectiles, physics, and perception (only the giant `step`/`stepBot` umbrella bodies out-rank it in raw self-time). ~5,000 `Math.hypot` calls/tick at 12v12 (~300k/s); the aggregate is O(S³) with roster size — ~40% of tick work at 24v24. A headless server pays it per room.

**Fix:** one shared per-tick pass producing `rescueAssignments: Map<victimId, rescuerId>` (nearest free bot per victim, deterministic id tie-break); `stepBot` reads O(1). Two verified caveats: (1) it is not behavior-identical as naively sketched — victim isolation excludes the asking rescuer (:514) and weights squadmates 0.5× (:523), so the shared pass needs an O(1) per-pair adjustment; (2) `tests/finish-list.test.ts` calls `objectiveFor` directly without stepping the world — memoize lazily per tick (or use the `botRepathAt`-cadence cache variant), never compute only inside `World.step`.

### S2 — No spatial index anywhere in `src/sim`
`src/sim/world.ts:3967` — **high / days**

`chunks.ts` is map generation, not a spatial index. Every projectile scans all soldiers (:3967), vehicles (:4062), turrets (:4088), gadgets (:3845, :4111); `explode()` scans everything (:4177); every bot's `findTarget` scans all soldiers with LOS raymarch on candidates (`bots.ts:336`); the separation shove scans the full roster per bot (`bots.ts:1482`); zombies (`bots.ts:1714`), recon gadgets (`world.ts:1597-1712`), mines and pickups (:4549, :4577) all scan per tick. Measured under sustained combat on a fast desktop: 12v12 = 0.53 ms/tick, 16v16 = 0.99 ms (**+86% cost for +33% bodies**), 24v24 = 2.6 ms, 80 soldiers = 8.4 ms/tick — superlinear, and past the frame budget on 3-5× slower hardware at horde scale. The server pays it per room at 30 Hz; the client at 60 Hz (`main.ts:595`).

**Fix:** one uniform grid rebuilt at the top of `step()`. The map is **300u** square (TILE 3 × GRID 100, `map.ts:9-11` — the "200 units" comment on :11 is stale), so 8-12u cells = 25×25 up to 38×38 — trivial memory; `Int32Array` bucket heads + next-pointers, O(S) fill, `forEachInRadius(x, z, r, cb)`. Convert call sites incrementally — and serve `isolatedFriendly`/`objectiveFor` **first** (the single largest scan cost; see S1), then projectile-vs-soldier, `explode`, separation, `findTarget`, zombies, and auras; kill `humansAndBots()`'s per-call allocation on the way (S7). Determinism law: nearest-picks tie-break on Map insertion order via strict `<` (`bots.ts:381/1717/394/524`, `world.ts:1600`) — visit cells in fixed row-major order and keep strict `<` (or sort candidates by id) so replays and lockstep-adjacent tooling stay byte-identical; the twin-run gate (`tests/sim.test.ts:21`) survives deterministic ordering. Pair with target memory — `s.botTargetId` already exists (`world.ts:414`).

### S3 — The snapshot pipeline costs the server more CPU than the sim
`src/sim/snapshot.ts:65` — **high / days**

(Re-titled by verification: this does **not** block internet play — permessage-deflate is already enabled at `server.ts:408-414`, level 1, threshold 512. The honest severity: the wire pipeline dominates server CPU with big easy wins.) Server-shaped bench (8 clients, 30 Hz sim, 15 Hz snapshots, 12v12): **serialization 3,048 ms vs simulation 1,846 ms per 60 s** — ~2.5× the sim including deflate. Three compounding causes: (1) the `wireRound` replacer (:65) runs per JSON key — stringify measured 3.7× slower; the quantization itself is worth keeping (saves 26% of post-deflate wire bytes) — kill the per-key callback mechanism, not the rounding. (2) `takeSnapshot` (:68) re-sends full soldier state every 66 ms including never-changing fields (name/weapons/equipment/loadout), and spreads soldiers + gadgets per snapshot. (3) `server.ts:184` stringifies per client, and `cullSnapshotFor` re-runs `perceivesNow` per enemy per client (:129) though visibility is team-level — softened by the fresh-`lastSeen` short-circuit (:128); cull measured 257 ms/60 s, the smallest cause. Wire reality: ~8 KB/snap deflated ≈ ~1.0 Mbps ceiling per client; 12 clients ≤ ~12 Mbps — high, but hostable.

**Fix, staged:** (a) *hours* — delete the replacer, quantize at build time. Determinism trap: `takeSnapshot` passes vehicles/turrets/projectiles/pickups/mines **by live reference** (:77-81; the invariant is documented at :58-63) — quantizing in place would mutate authoritative sim state at 15 Hz. Clone-then-quantize, or round while writing a custom serializer; update `tests/sim.test.ts:811`. (b) *hours* — split the soldier wire format into static-on-join vs per-tick dynamics: roughly half the snapshot. (c) *days* — per-**team** visible sets computed once and reused across teammates, then per-entity deltas vs last acked snapshot with int16 positions. (a)+(b) alone ≈ 4× snapshot throughput and half the bandwidth with no protocol redesign.

### S4 — The objective layer runs at 60 Hz but matters at ~1 Hz
`src/sim/bots.ts:1015` — **medium / hours**

The goal is consumed at repath cadence (0.9-1.6 s, mean ~1.25 s — `bot-tuning.ts:54-55`) and a few distance gates, but computed every tick: `objectiveFor` 11.0% self-time, plus `defendsNow` O(S) up to twice per CTF bot per tick (:458), `amCloseHunter` O(S) (:483), conquest's two array allocations per bot per tick (:662-663), survival's reduce over an allocated array (:682-686). Benched: the objective layer is **25.1% of `World.step`** in 12v12 CTF, 20.5-32.5% across modes.

**Fix:** cache the objective on the soldier with a dedicated staggered ~2-4 Hz clock — **not** the repath branch, whose `dist<3` clause fires every tick near a waypoint (:1126-1130). Cover **both** call sites (:1015 and the utility-vehicle driver at :878). Force refresh on the events that actually change objectives: `carryingFlag` changes, own-flag flips, point ownership, death/respawn. `objectiveFor` is pure (no rng draws, no writes) so same-seed determinism holds — but expect seeded full-match behavior tests to need re-baselining, since a stale `dGoal` shifts rng short-circuit order (e.g. :1019).

### S5 — Team perception runs full O(eyes × enemies) LOS at 60 Hz
`src/sim/world.ts:1419` — **medium / hours**

Every tick, for both teams: fresh eyes arrays (:1434-1435), a fresh revealed Set (:1428), and `perceivesNow` per enemy — `eyeSees` per eye plus a `losClear` raymarch (~20-40 `tileAt` samples) allocating two `{x,y,z}` literals per pair (`perception.ts:113`). Measured 8.7 µs/call at 12v12 → 29.6 µs at 30v30 — O(A×B). The client runs it at 60 Hz (`main.ts:595`) while the server gets identical fidelity at 30 Hz (`server.ts:27`).

**Fix:** every-2nd-tick (30 Hz) is the strictly-free throttle — the server's own baseline. 10 Hz is a design tradeoff, not free: the renderer decides which enemies **draw** from `lastSeen` (`renderer.ts:1426-1435`), so 10 Hz adds up to 100 ms enemy pop-in on peeks (SEEN_LINGER's 1.5 s only covers late removal, not first acquisition). Use a time-accumulator with a first-step stamp, not `tick % 6` — the modulo breaks 5 existing assertions (`finish-list.test.ts:163,168,171,183`; `grenades.test.ts:232`). Keep the cheap `smokeBlobs` rebuild per-tick (:1422-1425) — bots' `sightClear` consumes it every think. Hoist eyes/revealed to World-level scratch, and add a coordinate-based `losClearXZ(grid, ax, az, bx, bz, y)` used here, in `sightClear` (:1412), and in `findTarget` (`bots.ts:374`) to kill the per-pair object literals.

### S6 — Parked, crewless hulls pay full drivetrain math every tick
`src/sim/world.ts:3467` — **medium / hours**

~29 of a standard map's 34 hulls sit parked and crewless, yet every tick each pays `surfaceAt`/weather `moveMult` (:3474/:3482), yaw trig + slip/accel integration toward zero (:3520-3543), the 8-probe `clearAt` collision check (:3587-3591), and two closure allocations — 122,400 calls/60 s, 14.1% of `step()` measured in a real 12v12 CTF. Verified refinement: parked calls cost 1.57 µs vs 10.2 µs crewed (bot-driver `stepBot` at :3426 is attributed inside the bucket), so the recoverable win is **~5% of `step()`**, not 14%.

**Fix — with the verified carve-out, because the naive early-out diverges the sim:** skip the movement block only when **all** seats are empty (`!v.seats.some(...)` — the passenger-bail path at :3457 must keep running), `|vel| < 0.01`, band 0, not burrowed, **and** `def.healRadius` unset (or keep the heal block — the ambulance pulse at :3612-3623 needs no crew and skipping it was proven by end-state hash to diverge). Keep `stepRequisition` + possession/infection expiry; zero the vel once on exit. No force-field dirty flag needed — `stepForceFields` skips crewless hulls (:487). With the carve-out, the end state is bit-identical over 3,600 ticks and the suite passes.

### S7 — ~25.7 MB/s of steady-state allocation churn
`src/sim/world.ts:4654` — **medium / hours**

Measured gross churn: **~25.7 MB per sim-second at 12v12/60 Hz headless (438 KB/tick)** — the original 4-5 MB/s estimate was conservative. `humansAndBots()` alone is ~6 MB/s (~23%): two arrays per call (spread + filter), called from the per-bot separation loop (`bots.ts:1482` — ~2,880 arrays/s) plus per-tick `modes.ts` sites (:147, :263, :392-393, :459, :467, :530, :541; note :131 runs once per match and :217 once per paintball round). Also: `stepProjectiles` spreads+filters the roster for magnetars every tick even when none exists (:3751); survival/safehouse allocate zombie arrays per tick (`modes.ts:400, 465`); `stepSoldierPhysics` creates two closures per soldier per tick (:2991-3013). In a browser this shares the main thread with three.js — periodic multi-ms GC pauses on low-end.

**Fix:** a cached roster rebuilt via dirty flag — per-tick memoization was verified to leave the sim bit-identical — with two required adjustments: `hud.ts:658` sorts the returned array **in place**, so the scoreboard must copy before sorting or presentation reorders sim iteration and breaks determinism; and the flag can't be private — `server.ts:75,168` and `snapshot.ts:171` delete from `w.soldiers` outside the class, so expose `invalidateRoster()` or a generation counter. Magnetars: a maintained list or plain counter. Mode counters: iterate `soldiers.values()` directly. `blocksAir`/`groundBlocked`: private methods taking `(s, x, z)`.

### S8 — Encased-body scan walks the full roster twice per soldier per tick
`src/sim/world.ts:3008` — **medium / hours**

`groundBlocked` iterates **all** soldiers (including dead ones) hunting encased bodies, and is invoked twice per grounded soldier per tick (:3015/:3016): ~1,150 Map-entry visits/tick at 24 soldiers, ~12,800 at an 80-body horde (~768k/s at 60 Hz) — paying every tick for Frostbite/Venatrix ice that exists a few seconds per match.

**Fix (verified variant):** recompute an encased set/flag **once per tick at the top of `step()`** rather than an incremental counter — server disconnects (`server.ts:75/168`) and puppet pruning (`snapshot.ts:171`) can delete a live encased soldier and silently drift a counter under network play; per-tick recompute is O(S), drift-proof, and behavior-identical. (`world.ts:745` needs no guard — that leap-target scan iterates the roster regardless.)

### S9 — Six per-tick housekeeping scans for almost-always-absent states
`src/sim/world.ts:1235` — **low / hours**

Possessed turrets (:1235-1237), possessed bots (:1238-1240), possessed vehicles (:1241-1243), overload fuses (:1246-1258), infected hulls (:1260-1268), and the dead-zombie purge (:1363-1365) each traverse a full entity Map per tick — ~150 wasted iterator steps/tick, linear with entity count, identical on the server.

**Fix:** fold the three vehicle scans into the existing per-vehicle loop at :1367 (move expiry checks to `stepVehicle`'s top); gate turret/bot possession behind counters maintained by `possessBot`/`possessMachine`/`evict*`; fold the purge into the main soldier loop at :1282.

### S10 — The client sims at 60 Hz; the server proves 30 Hz is enough
`src/main.ts:595` — **low sev, big lever / days**

Offline runs `FIXED = 1/60` (accumulator :651-658, spiral-clamped by the 0.1 s dt cap at :643); the dedicated server runs the identical world at `TICK = 1/30` (`server.ts:27`), and net clients already render smoothly from 15 Hz snapshots via puppet extrapolation (`net.ts:137`). Every sim cost in this audit is paid **twice as often** on exactly the machines being protected: 1.38 ms/tick at 16v16 on a fast desktop is ~4-7 ms/frame of pure sim on a low-end laptop.

**Fix:** `FIXED = 1/30` plus inter-tick render smoothing — the accumulator loop currently has **no render interpolation**, so 30 Hz under a 60 fps render judders without it; reuse the puppet-extrapolation pattern (render `pos + vel × accSinceStep` in `renderer.update`'s read path). Halves total sim cost at a stroke and gives replays and netcode one canonical rate (see N7 for the bot-roll parity this fixes and the test-suite split it must re-baseline).

---

## 3 · NETCODE

The verdict up front (N9): the sim is genuinely deterministic in-process, `PlayerCmd` is already the single intent funnel, and the server-authoritative snapshot stack that exists is the right architecture. The findings below are the gaps between "exists" and "shippable."

### N1 — No snapshot interpolation buffer
`src/client/net.ts:83` — **high / day**

`applySnapshot` runs directly in `ws.onmessage` — snap every entity to the newest 15 Hz state, then dead-reckon forward (`world.ts:1205-1217`). Snap-to-latest + extrapolate is the model that **maximizes** visible jitter: any entity that changed velocity between snapshots teleport-corrects every 66 ms, arrhythmically under network jitter. No buffering, no render-time delay, no lerp anywhere in the pipeline.

**Fix:** standard entity interpolation — ring of the last ~6 snapshots keyed by `snap.time`; render at `newestSnapTime − 0.12 s`, lerping pos/yaw (and vehicle `turretYaw`) between the bracketing snapshots per id; fall back to dead-reckoning only on buffer underrun. Apply events when their snapshot becomes current, not on arrival, so sounds/VFX stay in sync with what is drawn.

### N2 — Own-player prediction is a hardcoded velocity hack with no reconciliation
`src/client/net.ts:129` — **high / days**

On each 33 ms cmd send the client sets `me.vel = move × 10` flat (:130-135) — ignoring class speed (real range 8.2-12.5 with sprint/crouch/surface/equipment multipliers, `world.ts:2173-2216`), knockback, and terrain; in vehicles the `vehicleId<0` guard skips prediction entirely, so own-vehicle motion is pure 15 Hz snapshot extrapolation. Every arriving snapshot then overwrites pos wholesale (`{...cur, ...sd}`, `snapshot.ts:163-169`) with no smoothing — continuous rubber-banding at any real RTT, worst while sprinting or knocked back. There is no `seq` anywhere (the server keeps only the latest cmd, `server.ts:45`) — reconciliation is impossible in the current wire format.

**Fix:** add an **additive optional** `seq` to `PlayerCmd` (`types.ts:855`) — ignored by `world.step`, so sim determinism and tests are untouched — and echo `lastAppliedSeq` per client in the snapshot. Client queues unacked cmds; on snapshot apply, restore server pos for self and re-run the real movement code for each unacked cmd at fixed 1/30 steps (matches server TICK). One verified prerequisite: `stepSoldierPhysics` (`world.ts:2887`) is directly callable, but the cmd movement-intent block lives inside a per-soldier step with side effects (reload/jetpack event emits, E-interactions, abilities) — extract that ~40-line block into a standalone function (or a movement-only variant with events suppressed) before replaying it client-side. Smooth residual error over ~100 ms instead of snapping. The single biggest online feel win; no server physics changes.

### N3 — Latest-wins cmd storage drops one-shot inputs and replays stale cmds forever
`src/server/server.ts:436` — **high / hours**

`client.cmd = msg.cmd`, and `Room.tick()` re-applies the stored cmd every 30 Hz tick until replaced. Two failure modes: (1) **lost presses** — when jitter bunches two ~30 Hz cmds into one server tick, the first is silently overwritten, eating one-frame flags (use/E, reload, grenade, ability, dash, melee, weaponSlot, nadeCycle — `input.ts:188` clears them client-side after one send; they are never re-sent). (2) **stuck cmds** — never cleared or aged: a background-tab stall (RAF stops the send loop, `net.ts:125`) leaves held fire firing and `moveZ=-1` walking indefinitely.

**Fix:** per-client queue (cap ~8); `tick()` drains one per tick; when empty, reuse the last cmd with one-shot flags zeroed (keep held move/fire/sprint/crouch). Stamp `receivedAt`; zero movement/fire when the newest is older than ~250 ms. ~30 lines, no wire change.

### N4 — Interest management culls soldiers/vehicles/mines but leaks everything else
`src/sim/snapshot.ts:147` — **high / hours**

`cullSnapshotFor` returns `{ ...snap, soldiers, vehicles, mines }` — events, gadgets, projectiles, and turrets pass through uncensored to every client. `world.ts` has **171 emit sites** — 21 `'shot'` emits alone carry pos + soldierId — plus `'hit'`, `'death'`, `'explosion'`, `'damage'` (with amounts for every exchange), `'heal'`, `'cloak'`. `snap.gadgets` includes enemy spy cameras/beacons/smoke with positions; `snap.projectiles` reveals firing origins; `snap.turrets` is unculled. An ESP overlay can plot every enemy who fires, plants, or heals anywhere on the map — defeating the per-viewer cull the file's own header declares prerequisite for any public wss endpoint.

**Fix:** three more `.filter` calls on the `seesPoint` closure that already exists in the function. Events: keep global types (announce, match_over, vo-without-pos, wave_start, flag_*, point_captured, whistle); pass positional events only when `seesPoint(pos)` or the emitter is on the viewer's team; always pass events targeting the viewer (`damage` where `soldierId === viewerId`). Two verified carve-outs: keep `'death'` **global with pos stripped** (the kill feed at `hud.ts:684` and the recorder at `record.ts:179` depend on it), and always pass projectiles whose `homingVehicleId` targets the viewer's vehicle — pilots must see the SAM chasing them beyond perceive range. Filter gadgets like mines; turrets and projectiles by `seesPoint`.

### N5 — Join loadout lets a modified client spawn infantry with a tank cannon
`src/sim/world.ts:386` — **medium / hours**

`addSoldier` validates `loadout.primary/secondary` only as `WEAPONS[...]` existence — and the table also holds vehicle/monster weapons: `tank_cannon` (damage 110, splash 6.5, clip and reserve Infinity — `data.ts:67`), `buggy_mg`, `mech_stomp`, `zombie_claw`. The server passes the join loadout straight through (`server.ts:434` → `Room.join:116`): `{ t:'join', loadout:{ primary:'tank_cannon' } }` walks the map as infantry artillery. Equipment is properly validated and capped at 2 (`world.ts:410`); weapons are not.

**Fix:** validate primary against `CLASS_ARMORY[classId]` (the familyWeapons pools the loadout UI itself uses) and secondary against the sidearm pool; fall back to the class default rather than rejecting the join. One guard.

### N6 — Server tick is a raw setInterval — sim time permanently dilates under load
`src/server/server.ts:103` — **medium / hours**

`setInterval(() => this.tick(), 33.33)` with no accumulator. Node timers only ever fire late (event-loop delay, GC, other rooms), and every late fire is sim time lost forever — the world steps exactly TICK per fire regardless of wall clock. Under several rooms plus per-client stringify+deflate on the same loop, match clocks, respawn timers, and the 60 s materiel drip all stretch, and the client's 33 ms cmd cadence beats against the slipping tick — feeding N3's lost presses.

**Fix:** accumulator per room — interval at ~10-15 ms; each fire, step while wall-clock ticks are owed (cap ~5 catch-up steps to survive a GC pause). `dt` stays exactly TICK; determinism untouched.

### N7 — 60 Hz offline vs 30 Hz server: per-tick probability rolls change the bots
`src/main.ts:595` — **medium / hours**

The sim is dt-correct for physics, but `bots.ts` rolls per-**tick** probabilities that ignore dt — verified 8 sites: strafe 0.02 (:1343), grenade `nadeChance` 0.006 (:1361), jetpack 0.02 (:1371), engineer turret 0.01 (:1380), infiltrator cloak 0.06/0.008 (:1426), ghost drone 0.012 (:1429), armed-vehicle grab 0.02 (:1019), emplacement manning 0.01 (:1029). All fire at half rate at 30 Hz. Controlled twin harness (seed 999, main.ts-mirrored 12v12 TDM roster, 60 sim-seconds): **59 kills at 60 Hz vs 32 at 30 Hz**, scores [27,32] vs [12,20] — a larger divergence than first claimed. Not a desync (the server is authoritative), but solo and online field visibly different bot armies, and replay tooling wants one canonical rate.

**Fix A:** scale rolls to per-second rates — scaling must touch the **threshold only**; the rng draws stay unconditional (the stream law, `bots.ts:1362-1363`). **Fix B (preferred, pairs with S10):** standardize both loops on 30 Hz. Either way, the test suite currently steps at **both** rates (`sim.test.ts` at 1/60; autodoor/blackbox/compound/spawn/ctf-standoff at 1/30) — one side shifts behavior and needs a suite pass.

### N8 — Snapshot wire format: ~53 KB JSON per tick, 80 fields per soldier, bot-brain scratch on the wire
`src/sim/snapshot.ts:49` — **medium / hours now, days later**

Reproduced at the server's real roster (26 soldiers, CTF, 90 s in): full snapshot = **52.9 KB** wireRound JSON; one live soldier = 1,206 B across 80 fields. `stripBot` (:49-52) strips only 4 of 14 bot fields — `botUseAt`, `botStuckAt`, `botLastX/Z`, `botMoveCheckAt`, `botLifeSeed`, `botFreshUntil`, `botWantFloor`, `botAcqId`, `botAcquireAt` ride every snapshot (3.3 KB, 6.3%) into puppets that never run brains. `dug`/`breached`/`doors` are cumulative and resent in full at 15 Hz (:85-87) — ~134 B at 6 min in a normal match, but monotonic: a destruction-heavy match grows every snapshot (90 KB measured by 6 min). Deflate-1 wire: 8.8 KB/snap ≈ 1.06 Mbps per client at 15 Hz.

**Fix now (hours):** strip all `bot*` by key filter. Key-aware elision of default-false/0 optionals — **must** pair with client-side default-reset, because `applySnapshot` merges `{...cur, ...sd}`: an elided-when-false `sprinting`/`crouching` sticks stale-true on the puppet; and never elide inside arrays (replacer-undefined serializes `null` and corrupts `clip`/`reserve`). Send `dug`/`breached`/`doors` as since-last-ack deltas — the per-tile apply loops are idempotent, but the gates are length-based and there is no ack yet, so add an ack (see the plan: `lastAppliedSeq` doubles as one) or a periodic-full scheme. **Later (days, before public):** per-entity dirty-field deltas vs last acked + integer quantization over the existing puppet path — consecutive snapshots are near-identical, expect ~1-2 KB/snap uncompressed.

### N9 — Verdict: deterministic in-process; snapshots are the right model; lockstep rejected
`src/sim/rng.ts:8` — **medium / hours**

Verified empirically and independently replicated: twin seed-777 worlds, 26 bodies, 3,600 ticks at 30 Hz produce **byte-identical 60,726-byte snapshots** with active combat. All sim randomness flows through the seeded mulberry32 `w.rng` (integer-op only); zero `Date.now`/`Math.random`/`performance.now` in `src/sim`; `hash01`'s `Math.sin` trick is renderer-only (`renderer.ts:16`); map gen is seed-pure (`tests/sim.test.ts:21`). `PlayerCmd` (`types.ts:855`) is the **only** way intent enters `step()` — humans and bots, offline and online — the ideal shape for any netcode. The lockstep disqualifier: the step path makes **311** `Math.sin/cos/atan2/hypot/pow/exp` calls (`world.ts` 183, `bots.ts` 128; 552 across `src/sim`) whose results are implementation-approximated per the ES spec — a Chrome-vs-Firefox (or vs future-V8) pair silently desyncs, and 24 bot brains would have to run on every client. The shipped stack (server rooms + snapshot puppet + net.ts) is the correct minimal plan; the killcam already proves snapshots replay (`replay.ts`).

**Fix:** commit to server-authoritative snapshots; do not pursue lockstep. Guard the property everything rents: a vitest determinism regression — twin seeded worlds, full roster, 3,600 ticks, expect identical `takeSnapshot` JSON — so a stray `Math.random` or wall-clock read in `src/sim` fails CI the day it lands. Work order → THE NETCODE PLAN.

### N10 — Per-client JSON.stringify is the rooms-per-core ceiling
`src/server/server.ts:184` — **low / day**

`Room.tick` stringifies a per-client culled snapshot: 0.236 ms stringify+wireRound per client (cull itself 0.006 ms) — 24 human clients = **5.7 ms every 66 ms snap tick** (~9% of a core per full room) before zlib, sharing the event loop with the tick timer (compounding N6). Fine for one bot-heavy room; it is the ceiling for public hosting.

**Fix:** the cull result is ~team-determined (per-viewer deltas are only tracking-optics linger, mine detector, and own-soldier fields) — build and stringify two per-team snapshots once, splice the tiny viewer-specific arrays per client. Or fold into the N8 delta encoder, which serializes each entity once per tick by design.

### N11 — Online killcam duplicates the serialization the network already did
`src/client/replay.ts:74` — **low / hours**

`ReplayRecorder.record` runs `structuredClone(takeSnapshot(world, []))` at 10 Hz with a 14 s ring. Online this is pure duplication: NetGame already receives authoritative culled snapshots at 15 Hz (`net.ts:83`), then the director re-snapshots the **same puppet** (`net.ts:146` → `replay.ts:233`).

**Fix:** online, record the received `msg.snap` frames directly — plain JSON-safe data, zero extra serialization or clone. Offline, see E4 for the alias-free copy that lets the recorder drop `structuredClone`.

---

## 4 · LOW-END

A weak machine currently has no path to a playable frame rate short of editing source, and pays a 132 MB uncompressed-audio toll before the first shot. Both are fixable without touching the sim.

### L1 — No quality settings system exists
`src/client/settings.ts:17` — **high / day**

Settings = masterVolume, reducedMotion, blood, three speed multipliers — no graphics tier, no resolution scale, no shadow/particle/decal knobs. Every renderer budget is a hard constant: antialias + PCFSoft always (`renderer.ts:337-341`), 2048² shadows over ±130u (:628-632), 14 clouds (:646), 700/450/600/500 precipitation particles (:573, :590), `MAX_PARTICLES=3000` (`effects.ts:5`), 5 PointLights (`effects.ts:101`), 900 splats (:521), 240 rubble chunks (:305). `reducedMotion` is a comfort valve, not a perf tier.

**Fix:** `quality: 'low'|'medium'|'high'` (+ optional `renderScale`) persisted like blood, with a pill row in the existing settings pane (`main.ts:1020`). The Renderer is constructed fresh each match (`main.ts:323`), so construction-time reads cover everything. LOW: `antialias:false`, DPR ≤ 1 × renderScale, `shadowMap.enabled=false` (halves total draw calls in one line — the hemi light carries the scene; give soldiers a shared blob-disc like the existing blip). MEDIUM: PCFShadow + 1024. Scaled budgets on LOW: clouds 0/4, precip halved, particles 1000, lights 2, splats 250, rubble 80, minimap every other frame; skip vo_/ann_ preload (L2).

### L2 — First deploy blocks on fetching + decoding all 460 WAVs
`src/client/audio.ts:337` — **high / day**

`AudioEngine.init()` runs `Promise.all` fetch + `decodeAudioData` over all 460 slots, and `startGame` awaits it before the menu hides (`src/main.ts:315`, reached from Deploy at `main.ts:1078`; menu hides at :320). On disk: 200 vo_ (68.5 MB) + 160 ann_ (49.2 MB) + 7 amb_ (6.9 MB) + 93 core SFX (7.7 MB) = **132.3 MB** of mono 16-bit 44.1 kHz WAV. Decoded float32: **264.5 MB resident** at a 44.1 kHz context (287.9 MB at 48 kHz) — the biggest memory driver in the game, enough to OOM a 4 GB Chromebook tab — and a ~45 s first-deploy stall at 25 Mbps. A match touches a handful of LSW voice sets; ~119 MB is dead weight per match. Music already does it right: streamed HTMLAudio, never decoded (`music.ts:12-14`). Map gen is NOT the startup problem: 8 ms for a full World, 24 bots in 7 ms.

**Fix:** (1) split `SOUND_NAMES` into CORE (93 SFX + ambience ≈ 14.6 MB) and per-LSW vo_/ann_ groups; `init()` preloads CORE only. (2) `loadLswVoice(id)` fetches an LSW's 9 files when a pod is requested/pending — the pod telegraph is **15-40 s** (THREAT table, `src/sim/lsw.ts:36-39`), ample lead; only `ann_X_inbound` (emitted at request time, `world.ts:545`) can miss on a cold cache — prefetch the team's stable (`lswsForTeam`) at match start, or accept skipping that one line (`play()` already returns false harmlessly, `audio.ts:456-461`). (3) Stop awaiting the world: `void audio.init()` at first menu interaction, await only CORE readiness on deploy. Keep a load-everything path for the harness Sound Lab (`harness.ts:763,774` iterates all `SOUND_NAMES`).

### L3 — Audio ships as raw WAV: 165 MB of a 175 MB dist
`src/client/audio.ts:340` — **high / hours**

`dist/` totals 175 MB: `dist/audio` = 165 MB (132 MB WAV + 29 MB mp3 music) — **94% of the build is audio** — while ALL game JS is 1.6 MB and models 4.1 MB. The `.wav` extension is hard-coded at the fetch site. These are mono 44.1 kHz/16-bit files: Opus 48k is **~14.7× smaller** with no audible loss at this use.

**Fix:** batch-encode `public/audio/*.wav` → `.ogg` (`ffmpeg -c:a libopus -b:a 48k`, mono) as a `tools/` script beside the gen-sounds pipeline; `audio.ts:340` tries `.ogg`, falls back to `.wav` (ship mp3 instead if Safari matters). The build must also **prune `dist/audio/*.wav`** — Vite copies `public/` verbatim, so the fetch-site change alone doesn't shrink dist; keep the WAVs in `public/` as the pipeline/test source (`tests/ascendants.test.ts:855-881` asserts them on disk — stays green). Optional: resample VO to 22.05 kHz during encode — decoded-PCM RAM scales with sample rate, halving L2's AudioBuffer footprint too. Re-encode the 29 MB music at 96 kbps (~12 MB; streamed via HTMLAudioElement at `music.ts:103`, transparent). Net dist: **175 MB → ~30 MB (~83%)**. `src/sim` imports no audio; Sound Lab customs come from IndexedDB — both untouched.

### L4 — Per-primitive soldier geometry (the low-end face of R1)
`src/client/models/shared.ts:14` — **high / day for this step**

Same root cause as R1, with verified guardrails for the incremental step: memoize **geometry only** — `const geoCache = new Map` keyed `box:${w}:${h}:${d}` (limb bakes its translate into the key). Memoizing `mat()` is **unsafe**: the renderer mutates soldier materials in place per-instance (`setAlpha` writes opacity/transparent for cloak/ghost/death fades, `renderer.ts:3408-3423`; `dressAsLsw` writes emissive, `soldiers.ts:402-405`) — `buildGlbTrooper` clones materials per body for exactly this reason (`soldiers.ts:487-489`); share materials only with clone-on-write in those two sites. Know what this buys: geometry memoization alone does **not** reduce draw calls (draws == meshes) — the draw-call relief comes from L1's LOW shadow toggle (`shadowMap.enabled` is hardcoded true today, `renderer.ts:340`) and R1's merge. Removal-path trap: the per-mesh geometry dispose at `renderer.ts:1613-1618` (repeated for projectiles at :1990-1994) must skip cache-owned geometry — the blip detach at :1608-1611 is the in-repo precedent. Live-match count runs under the 1,500 ceiling (team-0 infantry/pathfinder GLBs share geometry, `soldiers.ts:22-47`), but ~1,000+ unique-geometry shadow-casting body meshes stands.

### L5 — Every match ends in `window.location.reload()`
`src/main.ts:339` — **medium / days**

`endGame()` tears down by reloading the page, so match N+1 pays the entire boot again: JS re-parse, `initCampaign`, and — the big one — `audio.init()`'s full re-fetch and re-decode (~264 MB reallocated). `public/` assets are unhashed and `vite preview` sends no cache-control — 460 revalidation round-trips per match minimum on a network deploy. On low-end hardware: a 10-30 s dead gap between 15-minute matches.

**Fix:** explicit teardown — `renderer.renderer.dispose()` + a scene traverse dispose (the per-entity pattern exists at `renderer.ts:1613`), remove `startLocal`'s keydown/beforeunload listeners (`main.ts:453,631`), null the `__ww` handle — while keeping the AudioEngine and its decoded buffers alive across matches (match-independent by construction). Interim, if the reload must stay: immutable cache headers on `/audio` in the real deployment plus a service-worker Cache API layer.

### L6 — DPR and MSAA are fixed: a 4K iGPU laptop renders 8.3M multisampled pixels with no escape hatch
`src/client/renderer.ts:338` — **medium / hours**

`setPixelRatio(min(devicePixelRatio, 2))` + `antialias:true` hard-coded; resize keeps full window size (:352). The worst low-end case is the common one — a 4K or 200%-scaled panel (dpr 2) on Intel UHD: 3840×2160 backing buffer × MSAA, under heavy fullscreen transparent overdraw (additive particle Points with `frustumCulled=false`, 0.85-alpha grass planes :800, 14 transparent clouds, precipitation, `depthWrite:false` splats). And camera far = 400 (:342) outruns every theme's fog (max fogFar 300) — fully fogged geometry is still drawn.

**Fix:** fold into L1's preset (LOW: `antialias:false`, DPR ≤ 1 × renderScale at construction — the renderer is per-match). Cheap dynamic resolution: reuse the harness's 0.5 s fps-accumulator pattern (`harness.ts:1325-1327`) in the main frame loop — p50 frame time > 33 ms for 5 s steps renderScale 1.0 → 0.85 → 0.7 via `setPixelRatio` (live-safe, no context rebuild). Clamp `camera.far` to the theme's fogFar + 20 in `buildStaticWorld`.

### L7 — The theater map is a 3.5 MB PNG re-instantiated on every click
`src/main.ts:990` — **low / hours**

`renderScarMap()` rebuilds `#map-root` innerHTML — including `<img src="/scar-map.png">` — on every marker click and match-end update. 3.5 MB decoding to ~12 megapixels on a menu tab; the second-largest single asset after audio.

**Fix:** quality-80 WebP/JPEG (~300-400 KB); render the `<img>` once and mutate `.scar-marker` classes + the side panel in place, so the bitmap never re-decodes.

### L8 — Eight soldier-GLB probes fire at module import, on the menu's critical path
`src/client/models/soldiers.ts:28` — **low / hours**

At import time — before the menu paints — the module fires `GLTFLoader.load('/models/soldier_<class>.glb')` for all 8 classes (:27-47). Existing files download immediately (~1 MB each); absent classes 404 — eight requests contending with fonts and main chunks during first paint, in sessions that may never leave the menu. The prop GLBs already do this correctly (lazy cached promise, `props.ts:93-115`).

**Fix:** wrap the loop in `ensureGlbBodies()` called from `buildSoldier()` — first deploy triggers the downloads, the per-build "never pop mid-soldier" law is preserved, menu-only sessions never fetch.

---

## 5 · EVENTS & AUDIO

### E1 — The 132 MB eager audio load (see L2)
`src/client/audio.ts:337` — **high / day**

Full treatment at L2. The split that matters here: **360 of 460 files (117.7 MB, 89%) are per-LSW vo_/ann_ lines — 40 LSWs × 9 slots — and a match plays ~18-36 of those 360** (one LSW per faction on-field; sequential drops add sets). Tier the manifest; prefetch the team's stable (`lswsForTeam`) at match start to cover the `ann_X_inbound` race (`world.ts:545`); Opus for the wire (L3).

### E2 — Minimap (see R7)
`src/client/hud.ts:435` — **high / hours**

Same finding as R7; the verified amendments live there: headcam semantics can't be a `lastSeen` post-filter (`SeenMark` has no per-viewer attribution — pick local-raycast-unless-headcam, or promote team vision with owner sign-off since it nullifies head_cam's sole perk, `data.ts:520`), and net-play puppets need the `renderer.ts:1301-1310` snapshot-presence guard. Presentation-only: no test imports `hud.ts`.

### E3 — HUD innerHTML (see R8)
`src/client/hud.ts:418` — **medium / hours**

Four sites: objective bar :418, sysPips :204, crewPips :223, scoreboard :676 — plus `renderTrophies`' five full-array sorts every frame while held, including the entire ~22 s post-match linger.

### E4 — Replay recorder structuredClones the world 10×/s all match
`src/client/replay.ts:74` — **medium / hours**

`structuredClone(takeSnapshot(world, []))` fires 10×/s from **both** loops (`main.ts:792`, `net.ts:146`). Measured on a busy 12v12: 0.417 ms/record vs 0.130 ms for `takeSnapshot` alone (~56 KiB, hundreds of nested objects); the 140-frame ring retains **11.5 MB**. On a 5× slower machine: a ~2 ms allocation burst every 100 ms plus 2-3 MB/s of garbage.

**Fix:** a `recordSnapshot` variant with explicit copies instead of the blanket clone — and the verified copy list is longer than pos/vel: `takeSnapshot` passes **whole live objects** for vehicles/turrets/projectiles/pickups/mines (`snapshot.ts:77-81`) and live refs for `dug`/`breached` and `mode.scores/tickets/flags/points`. So shallow-copy those five entity kinds plus `vehicle.systems/padPos`, `projectile.hit`, `gadget.anchor/vel`, the mode fields (incl. `hillPos`), `dug`/`breached` slices, and `soldier.weapons` (push-mutated at `world.ts:4597`). Pure read — no determinism risk; `tests/expansion.test.ts:497-528` pins both aliasing invariants and will fail a botched copy. Online, N11 makes this moot.

### E5 — Events broadcast to every client uncalled (the bandwidth face of N4)
`src/sim/snapshot.ts:147` — **medium / hours**

Measured in a busy 12v12: `'damage'` is 16% of all events (578 of 3,666/min), each carrying full pos + amount — yet clients render a damage event **only** when `ev.ownerId === localId` (`damagetext.ts:40-42`). Bot-vs-bot damage floods every client and is discarded on arrival; positional `'shot'`/`'hit'` beyond the 140u max earshot likewise.

**Fix:** keep `'damage'` only for the viewer-owned; drop positional events farther than ~150u from the viewer; keep non-positional/announce/vo. ~10 lines, −30-50% event wire bytes in bot-heavy rooms and less per-frame `applyEvents` work. N4's security filter subsumes this — do them together.

### E6 — Net event buffer grows unbounded while the tab is hidden, then floods on refocus
`src/client/net.ts:84` — **medium / hours**

`pendingEvents.push(...msg.snap.events)` on every 15 Hz snapshot, drained only inside RAF (:139). Backgrounded tab: RAF stops, WebSocket keeps delivering — minutes accumulate thousands of events, and the first frame back processes **all** of them: killfeed DOM churn, dozens of `audio.play` calls, particle bursts — a multi-hundred-ms hitch exactly at refocus, on top of unbounded growth.

**Fix:** cap at push (`splice` oldest past ~300) — or better, drop events that arrived while `document.hidden` (the snapshot state is authoritative; stale VFX have no value). One or two lines.

### E7 — Ground decals (see R4)
`src/client/renderer.ts:521` — **medium / day**

One `InstancedMesh` with `instanceColor` is the one-draw-call endpoint; keep the `spawnSplat` signature so `spawnGoo` and the event paths don't move.

### E8 — Melee slash arcs allocate fresh geometry per swing
`src/client/renderer.ts:3466` — **low / hours**

Fresh RingGeometry + material per swing, disposed 0.22 s later (:2148-2159). Horde/survival with 30+ zeds swinging ~1/s = ~30 allocations, GPU uploads, and disposals per second — on the machines being optimized for. **Fix:** pool ~12 slash meshes, re-pose per swing (rotation.y for arc, scale for range), reset a ttl, skip when saturated — the Fireballs pattern (`effects.ts:154`). Folds into R11's shared-unit-geometry pass.

### E9 — No global cap on concurrent one-shot audio sources
`src/client/audio.ts:452` — **low / hours**

`play()` throttles identical names within 30 ms (:459-462) and VO rides a capped bus, but distinct-name world SFX are unlimited: a teamfight stacks 30+ simultaneous BufferSource→Gain→Panner(→Biquad) chains, allocating 3-4 nodes per play. The compressor stops clipping, not mixing cost — measurable CPU on low-end laptops at exactly the busiest moments.

**Fix:** live-voice counter (increment on `src.start()`, decrement in `onended`). At a cap (~24), refuse new plays whose computed volume is below the quietest live voice, or steal the oldest non-VO voice with the existing 80 ms `fadeCutVo`. Pure addition inside `play()`; the pos-volume math is already computed.

---

## THE NETCODE PLAN

**Architecture verdict (N9): server-authoritative snapshots. Committed.** The sim is byte-identical across seeded runs, `PlayerCmd` is the only intent funnel, and the rooms + puppet + snapshot stack already exists and works. Lockstep is rejected permanently: 311 implementation-approximated transcendental calls in the step path (552 across `src/sim`) mean cross-browser float drift, and it would put 24 bot brains on every client. **Bandwidth is not the blocker** — permessage-deflate is already live and a client costs ~1.0-1.06 Mbps at 15 Hz. The blockers are server CPU (the wire pipeline costs 2.5× the sim), game feel (no interpolation, fake prediction, eaten inputs), and the anti-ESP cull the code itself declares prerequisite for any public endpoint.

| Phase | Ships | Effort | Unblocks |
|-------|-------|--------|----------|
| 0 — Foundation | determinism CI gate; one canonical 30 Hz rate | hours | everything below; replays/killcam stay cheap forever |
| 1 — Server correctness | input queue; accumulator tick; loadout guard | hours | honest LAN play |
| 2 — Feel | interpolation buffer; then seq + prediction/reconciliation | day, then days | internet-quality movement |
| 3 — The wire | bot-strip + elision + event/gadget cull; then quantize/split/deltas | hours, then days | public wss (anti-ESP gate); rooms-per-core |
| 4 — Capacity | per-room sim wins (S1/S4/S5/S6/S7/S2); Opus payload | days, parallelizable | cheap VPS hosting; sane first download |

### Phase 0 — Lock the foundation (hours) — prerequisite for everything

- **Determinism regression in CI** (N9): twin seeded worlds, full 26-body roster, 3,600 ticks, expect byte-identical `takeSnapshot` JSON. This is the property that makes servers cheap, replays free, and reconciliation possible — make it un-regressable before touching anything else.
- **One canonical rate: 30 Hz** (S10 + N7). Preferred: solo `FIXED = 1/30` with render interpolation (which also halves solo sim cost on low-end); alternatively dt-scale the 8 bot probability rolls — thresholds only, draws stay unconditional (`bots.ts:1362-1363`). Either choice shifts one side of the currently split test suite (`sim.test.ts` steps 1/60; autodoor/blackbox/compound/spawn/ctf-standoff step 1/30) — budget a suite pass.

### Phase 1 — Server correctness (hours) — the server stops lying

- Per-client **input queue** with one-shot preservation and a ~250 ms staleness cutoff (N3). Fixes eaten E-presses and forever-walking ghosts before any feel work, and stops the cmd cadence beating against a slipping tick.
- **Accumulator tick loop** (N6) so sim time equals wall time under load.
- **Loadout validation** vs `CLASS_ARMORY` (N5). One guard; closes the tank-cannon-infantry hole.

### Phase 2 — Feel (a day, then days) — what players actually notice

- **Interpolation buffer first** (N1): ring of ~6 snapshots, render at newest − 120 ms, events applied when their snapshot becomes current. Biggest visible win per line of code; no wire change.
- **Then prediction/reconciliation** (N2): additive `seq` on `PlayerCmd` + `lastAppliedSeq` echo; extract the ~40-line movement-intent block from the per-soldier step (its event emits must be suppressed during replay); re-run unacked cmds at 1/30 on snapshot apply; smooth residual error over ~100 ms. Depends on Phase 0's rate unification (replay steps at server TICK). Vehicles stay snapshot-extrapolated (today's behavior) until a later pass.
- Free synergy: the `lastAppliedSeq` echo **is** the ack the Phase 3 delta scheme needs — one mechanism, two uses.

### Phase 3 — The wire (hours now; days before public)

- **Now:** strip all `bot*` fields; key-aware elision with client default-reset (never inside arrays); `dug`/`breached`/`doors` as since-ack deltas (N8). **Event/gadget/turret/projectile culling** with the two carve-outs — `'death'` global with pos stripped, homing projectiles always visible to their target's pilot (N4/E5). This is the anti-ESP gate `snapshot.ts`'s own header names as prerequisite for any public wss — nothing goes public before it.
- **Before public hosting:** kill the `wireRound` replacer via clone-then-quantize (respect the live-reference invariant at `snapshot.ts:58-63`; update `tests/sim.test.ts:811`); static-on-join vs per-tick dynamics split; per-team visible sets + per-team stringify (N10/S3); then per-entity dirty deltas + int16 positions → ~1-2 KB/snap (N8/S3). Endpoint: serialization goes from 2.5× the sim's CPU to a rounding error, and rooms-per-core stops being stringify-bound.

### Phase 4 — Capacity (days, parallel-friendly)

- The sim findings **are** server findings — every room pays them at 30 Hz: S1 (shared rescue pass), S4 (objective cache), S5 (perception throttle — the server is already at the free 30 Hz baseline), S6 (parked hulls), S7 (roster cache), and ultimately S2 (spatial grid, which serves S1's queries first).
- Hosting payload: L3's Opus encode + dist prune (**175 MB → ~30 MB**) before anyone downloads the game over the internet, and L2's tiered audio so joining a match isn't gated on a 132 MB decode.

### Do not build

- **Lockstep** — disqualified above, permanently.
- **Client authority of any kind** — the snapshot model's whole value is that the server is the only truth.
- **A binary protocol before the delta encoder proves the shape** — deflated JSON deltas are within ~2× of hand-packed binary at this entity count; earn the complexity with measurements first.

*Gates as always: `tsc && vitest && build` green before any of this merges; sim changes ride the Phase 0 determinism test from day one.*