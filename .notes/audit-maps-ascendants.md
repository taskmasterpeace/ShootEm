# MASTER SYSTEMS AUDIT — MAPS / TERRAIN / BUILDINGS · ASCENDANTS (LSW) · MODES / MISSIONS
*Read from code, 2026-07-23. Every status is grounded in a file:line. "The code is truth."*

Legend: ✅ WIRED (runs in a live match) · 🟡 PARTIAL (half-built / read-path only / stub) · 👻 INVISIBLE (built + tested but no UI/generator reaches it) · ⬜ UNBUILT (spec only)

---

## PART A — MAP GENERATION, TERRAIN & BUILDINGS

### A1. Stock procedural maps — ✅ WIRED · `src/sim/map.ts:1022` `generateMap(seed, mode, theme)`
The entry point. Dispatches: `safehouse`→neighborhood, `paintball`→field, `race`/`timetrial`→track, else a themed scatter map. Six generators keyed by theme `gen` (`map.ts:1046` MIX table): **field, corridors, rocks, ocean, ice, armor**. Scatter mirrors every obstacle across the vertical centre-line for fairness; lays wall segments (¼ become `T_CLIMB` container barricades, `map.ts:1081`), crate cover-clusters, rock blobs, ponds (deep core / shallow rim), an ocean "moat" with fords. Border sealed to `T_WALL`.
**What remains:** the `field` and `corridors` themes deliberately DON'T scatter — they route to the chunk grammar and interior carve (below). Rocks/ocean/ice/armor are pure scatter, no region structure.

### A2. Chunk region grammar — ✅ WIRED · `src/sim/chunks.ts`
Robert's modular-map system. A field map is diced into `RegionRect`s, each filled by a **chunk**: `forest` (soft bottleneck — trees+grass), `neighborhood` (medium — houses+streets), `interior` (hard CQB — rooms+corridors), `industrial`, `farm`, `open` (`chunks.ts:28`). **The hard contract:** every chunk keeps a 3-wide clear cross (`laneCross`, `chunks.ts:86`), and regions share a grid so lanes line up into a connected street network — "choke, never seal." Mirror-aware writes.
**Open question:** none — this is the "bottlenecks not complete-bottlenecks" design realized.

### A3. The ten authored fronts — ✅ WIRED · `src/sim/fronts.ts:1892` `FRONT_GROUNDS`
Hand-placed BONES (river where the river is), seed deals only dressing. `bridge_delta, fort_raven, eastern_plains, the_city, highland_pass, blacksite, refinery, the_port, airbase, the_mine`. Reached via `generateFront(frontId, seed, size)` (`fronts.ts:1910`), which also parses a `front@size` suffix. Each front: readable lanes (BFS-reachability enforced by `tests/fronts.test.ts`), a signature moment, a persistent scar, a doctrine lean. 8 authored building stencils (`FRONT_STENCILS`, incl. `BARRACKS_XL` — a platoon-scale 2-storey compound, `fronts.ts:1935`).

### A4. Population-scaled size tiers — ✅ WIRED · `fronts.ts:135` `MapSize`
`small` (62 tiles ≈186u) / `standard` (82 ≈246u) / `large` (100 ≈300u). `mapSizeForPlayers(botsPerTeam)` (`fronts.ts:152`): ≤6→small, ≤9→standard, else large. A front authors once per tier — buildings keep their size; what scales is ground-between-features and feature COUNT. Everything outside the centred playable box is sealed solid (`sealOutside`, `fronts.ts:159`).

### A5. Buildings you can enter — ✅ WIRED
- **Static stencils** (`buildings.ts:98` `BUILDINGS`) — hand-authored floor plans with doors/windows/stairs, categorized (`residential/commercial/industrial/civic/military`). `stampBuilding` (`buildings.ts:762`) writes them into the grid + upper storey `grid2`; `stencilConnected` (`buildings.ts:707`) guarantees no sealed room.
- **Grown houses** — ✅ `generateHouse(rng, type)` (`buildings.ts:416`): 4 archetypes (`manor/bungalow/hall_house/cottage`), procedural rooms/corridors/windows, regrows until every room is reachable from the front door.
- **Grown districts** — ✅ `generateDistrict(rng, type)` (`buildings.ts:573`): `storefront/market/office/factory/depot_hall`.
- **Full city buildings** — ✅ `generateCityBuilding` (`building-generator.ts:452`): multi-storey with sockets (`entry/exit/objective/guard/civilian/dog-handler/reinforcement`), footprint families (`rectangle/l-shape/courtyard/twin-wing/arcade`), balcony-support + layer-connectivity validators (`building-generator.ts:253/274`).
- **Second storey is real:** `grid2` + `upperLayers[]` (Level 3), `T_STAIRS_*`, `T_LADDER`; 49 storey/rows2 references across buildings+fronts. You genuinely go up.
**"Can you enter a building?" → YES.** Doors open on E (`toggleDoorTile`), windows break to firing sills, `houseAt()` tracks interiors, furniture is placed (`furnitureFor`), and scatter is pruned from indoors (`pruneIndoorProps`, the "trees in the hallway" fix).

### A6. Indoor AI — ✅ WIRED · `src/sim/indoor-ai.ts` (created `world.ts:694`, driven `bots.ts:1038/1706/1944`)
A per-map `IndoorTacticalState` derived from building navigation (rooms, portals, room-by-cell index). Guards run intents `post → investigate → search → return` toward alert positions with portal-claiming so they don't clump a doorway (`indoorGuardWaypoint`). Civilians `evacuate` away from the threat (`indoorCivilianWaypoint`). Dogs follow **scent trails** (`recordIndoorScent`/`strongestDogScent`, 8s decay, cross-floor via stairs) and hesitate at intact glazing (`dogWindowHesitation`). This is a genuine CQB brain, not a stub.
**What remains:** it activates only on maps that expose a `buildingAuthoringLayoutFromMap` (city/science layouts); a random scatter map returns `null` and falls back to open-field bot AI.

### A7. Materials table — ✅ WIRED · `src/sim/materials.ts`
One record per substance (dirt/grass/wood/woodFrame/sandbag/masonry/stone/metal/metalDoor/ice/grit/wet/mud/water/rubble/bedrock). Single source of truth for: destruction HP + heavy-gate, drill rate, walk speed per drivetrain, grip (the weight law), ricochet, penetrable, **flammable**, impact VFX. `materialOf(tile)` maps T_* tiles; `materialForSurface(surf)` maps S_* floors (starship deck = metal = same substance as a metal wall).

### A8. Destruction — ✅ WIRED · `world.ts:897` `damageWall(tx,tz,dmg,heavy)`
Tiered + monotonic (only ever OPENS paths, so reachability survives any sequence). Ladder: intact → damaged (HP ledger `wallHp`) → **T_RUBBLE** (knee cover, eyes clear, walk-slow) → gone. Soft cover breaks under splash; masonry/stone are `heavyOnly` (≥100 dmg — 120mm, demo, drill only; grenades never); metal & the rim NEVER break by blast (drill only). Breaches ride the wire (`breached`/`dug` → snapshot). Drives Titan/Crusher/Tremor/Leviathan and every tank shell.
**What's just static geometry:** the map border/rim (`bedrock`, HP ∞), metal walls vs small arms (drill-only), and any `dirt/grit/wet/mud/water` ground (HP ∞ — nothing to destroy).

### A9. Field fire / burnable wood — ✅ WIRED · `world.ts:948` `igniteTile` / `world.ts:964` `stepFires`
A tile catches when its wall material OR ground surface is flammable (grass ground; wood cover/doors/frames — `tileFlammable`, `world.ts:941`). Fire burns down over `FIRE_LIFE`, spreads to the 4 orthogonal flammable neighbours ONCE (`world.ts:970`), scorches the living (metered DoT, gods/riders exempt) and **burns down corpses to `neutralized`** (the field path to reanimation-denial). Incendiary rounds ignite on flammable cover (`world.ts:6799`). Deterministic (empty → early-out → byte-identical replays).
**What burns:** grass, wood doors, wood cover, wood frames, corpses. **What doesn't:** masonry, stone, metal, ice, dirt, water.

### A10. Surfaces & per-surface movement — ✅ WIRED · `map.ts:98` (S_DIRT…S_MUD) + `surfaceAt`/materials `walk`
Seven floor surfaces feed drivetrain speed multipliers (`SURF_SOLDIER/WHEELS/TRACKS`, folded into `material.walk`). `S_ICE` is `slick` (momentum carries — vehicles spin out, Frostbite's sheets are real code). Grip governs how hard boots bite (weight law #102).

### A11. Terrain elevation (3-level height) — 🟡 PARTIAL / 👻 INVISIBLE · `map.ts:301` `height?` / `map.ts:657` `TERRAIN_U=[0,4,16]`
The READ path is fully wired: `terrainTopAt`, `losClearTerrain`, `terrainLevelAt` (Ground/Building/**Sky-mountain**) are consumed by LOS (`snapshot.ts:189/201`), vehicle ground-follow (`world.ts:5660/6273`), and flight sky-level gating (`world.ts:6180`, fliers clear sky-mountains). **But NO procedural generator ever assigns `map.height`** — the only writer is the Map Maker JSON loader (`mapedit.ts:287`, format v2 with `ramp`). So in every *generated* match the map is flat; terrain only exists on hand-authored/imported maps.
**Open question:** should the chunk/front generators author terrain height, or is elevation permanently a Map-Maker-only feature?

### A12. Vehicle-scale theaters — ✅ WIRED · `src/sim/theaters.ts` + `theater-builder.ts`
8 theater defs (`theaters.ts:8`): city (Iron Meridian), geocity (Miami Gardens 33056), desert, countryside, mountain, coastal, ocean, steppe. 200²–300² tile grids, per-theater domains (`foot/ground/air/surface/deep`), free-dogfight flags, default vehicle pads. `generateTheater(id, seed)` builds a base + carves routes (`carveRoute`), stages rotor/sub pads, validates base-to-base route connectivity (`routesConnectBases`, `deepWaterConnected`). This is the vehicle-war map layer under Operations.

### A13. Real-city geospatial import — 🟡 PARTIAL *(NOTE ONLY — a parallel instance owns this; NOT audited for change)*
`src/sim/geospatial/*` compiles OSM/NSI/terrain sources into a `GameMap`. `compileGeospatialMap` (`compiler.ts:566`) rasterizes 5 classes (empty/road/water/building/green). Shipped cities: `miami-gardens-33056.json`, `san-francisco-potrero.json`, `lower-manhattan-civic-financial.json` (`src/data/geospatial/`). Wired into `geocity` theater + the `real_city_assault` military mission. **Currently under active modification by another instance (dirty working tree on 12 geospatial files + `terrain-lab.html`)** — flagged, not touched.

### A14. Race track / paintball / neighborhood generators — ✅ WIRED
`generateRaceTrack` (`map.ts:956`) carves a checkpoint circuit; `generatePaintballField` (`map.ts:800`) the onboarding yard with 3 control pads; `generateNeighborhood` (safehouse) the searchable-house block. All three are live, mode-selected in `generateMap`.

---

## PART B — THE ASCENDANTS (LIVING SUPER WEAPONS)

### B1. The entity — ✅ WIRED · `src/sim/lsw.ts`
An LSW is a `Soldier` with `ascendant?: AscendantId` set (replicates free — snapshot spread law). Bigger scale, signature palette, its own signature arm (family `lsw`, clip `Infinity`), and a brain file. Same rig, same eight joints, **every LSW dies to ordinary rifles** (threat buys HP, never immunity).

### B2. Threat table — ✅ WIRED · `lsw.ts:24` `THREAT` (code is truth; doc corrected to match)
| Tier | Name | HP | Materiel | Telegraph |
|---|---|---|---|---|
| 1 | SKIRMISH | 800 | 1 | 15s |
| 2 | STRONGPOINT | 1600 | 2 | 20s |
| 3 | SIEGE | 3200 | 4 | 30s |
| 4 | EXTINCTION | 5800 | 7 | 40s |
HP was retuned ~36% down from squad-only numbers so 1v1 duels resolve while squad-focus windows still hold; measured in `tests/threat-measure.test.ts`.

### B3. The roster — ✅ WIRED · **40 units** (20 United Front team 0, 20 Collective team 1)
All 40 in `LSWS` (`lsw.ts:87`, confirmed 40 entries) and `AscendantId` (`types.ts:60`). All 40 have a brain in `LSW_BRAINS` (`lsw/index.ts:56`, one `src/sim/lsw/<id>.ts` file each — 40 files, verified). Each brain exports `step` (bot cadence + passives) and `active` (pilot Q; returns true only on a real cast so cooldown charges only on a hit). Every unit carries an embodiment (`EMBODY`, `lsw.ts:537` — rig/prop/attackPose across melee-six / beam-seven / arc-five / etc.) and 5 VO moments (`VO_LINES`, `lsw.ts:595`) + 4 announcer lines each.
- **Threat spread (measured in code):** T1 ×9, T2 ×22, T3 ×9, **T4 ×0**. *(The doc's designation table lists Titan/Stormcaller as EXTINCTION T4 and names Collective T4 bosses, but `lsw.ts` assigns `threat:4` to NOBODY — the max coded tier is 3, and Cataclysm is coded threat 2 not the doc's T4. The 5800-HP EXTINCTION tier is defined but unused. **Doc-vs-code drift, confirmed by grep.**)*

### B4. Shared mechanics (the toolbox that unlocks the roster) — ✅ WIRED
- ENCASE (the Ice Block, `lsw.ts:809` constants + `world.encaseSoldier`) → Frostbite, Venatrix.
- FORCE FIELDS (`world.ts:1112` `forceFields`, radial pulls + directional currents) → Gravity Warden, Riptide, Oblivion, Stormcaller's tornado.
- TIME FIELDS (`world.ts:1174` `timeFields`, `timeMulAt` scales position-advance) → Chronos.
- MACHINE POSSESSION (`world.ts:3065` `possessMachine`, EMP evicts instantly, never humans) → Phantom, Wraith.
- TRUE FLIGHT (`Soldier.flightAlt`, SAM-lockable) → Inferno, Stormcaller, Gargoyle.
- DESTRUCTION (`damageWall`) → Titan, Crusher, Tremor, Leviathan.
- LEAP movement (`world.ts:1399`, shadow-telegraphed, soft mid-air) → Titan/Crusher/Ragebeast/Tremor/Cataclysm.

### B5. Deployment / the officer's call — ✅ WIRED · `world.ts:1199` `requestLsw(id, team, callerId)`
Gates, in order: (1) `lswAllowed(mode)` — OFF in paintball/range/race/timetrial (`lsw.ts:816`); (2) **rank commission** — a human caller needs Lieutenant+ (`mayCallStable`, rank 5 @ 520 pts, `ranks.ts:40/107`); (3) **campaign pass escalation** (`lswPass`: 1=gods sleep, 2=only Collective answers, 3=both, `world.ts:1216`); (4) faction match; (5) **one-per-faction slot** (live OR inbound); (6) **materiel purse** — opens at 10, drips +1/60s cap 14 (`world.ts:1121`), charged `THREAT[].materiel`; (7) telegraphed delay by tier, then the pod lands. The **bot officer** auto-calls for any humanless faction on a 45s radio-check cadence (`world.ts:1242` `stepLswDrops`); a faction WITH a human never auto-calls.

### B6. Playing AS an LSW (the ascension) — ✅ WIRED · `world.ts:1323` `ascendSoldier`
If the human caller is standing at the LZ at landing (alive, not downed/frozen/mounted), their trooper BECOMES the god — same id, same killfeed, 2s pod-flash protection, Q = the signature, death hands the class body back. Forfeit (dead at landing) → the stable sends a bot pilot (`addLsw`, `world.ts:1359`). **All 37 ground LSWs are player-pilotable; the 3 fliers are AI-only** — `ascendSoldier` refuses a human on `flies` (D3 law, `world.ts:1328`). `godMorph` (`world.ts:1286`) is a testing backdoor that wears any god ignoring every gate (+invuln).
**What remains (per `docs/ASCENDANTS.md §6`):** LSWs as campaign War Materiel with per-front stables; recipes that START with a god on the field (Cataclysm siege); the OCS "become an officer" chain is a design fork (§6.1) — commission currently keys off rank/record only.

### B7. Voices & threat room — ✅ WIRED
Every god SPEaks (5 positional TTS moments + map-wide announcer net; `VO_LINES` + `annSlot`). **The Threat Room** (`src/sim/threatroom.ts`, `THREAT_PRESETS` ×20 "questions") is the LSW/enemy laboratory — summon any unit/crowd to probe melee/gunplay/physics/crowd/gods; client at `threat-mode='threat'` (`modes.ts:168`, no clock, "the lab runs on what YOU put in it"). Personas (`personas.ts` `PB_PERSONAS`) drive paintball trash-talk, not LSWs.

---

## PART C — GAME MODES & MISSIONS

`ModeId` (`types.ts:20`) = **17 modes**. All are initialized (`modes.ts:12 initMode`) and stepped (`modes.ts:130 stepMode`, called `world.ts:2124`).

| Mode | Status | What runs |
|---|---|---|
| **tdm** | ✅ WIRED | first team to 50 kills (`modes.ts:478`) |
| **ctf** | ✅ WIRED | grab/carry/capture, auto-return 25s, credits runner+defender (`modes.ts:489`) |
| **koth** | ✅ WIRED | uncontested hill accrues to 120 (`modes.ts:558`) |
| **conquest** | ✅ WIRED | control points → ticket bleed to 500 (`modes.ts:578`) |
| **survival** | ✅ WIRED | discrete waves, hp-scaling, straggler grace, roster law (`modes.ts:610`) |
| **horde** | ✅ WIRED | continuous ramp, base 12→cap 80 shamblers (`modes.ts:862`) |
| **tide** | ✅ WIRED | horde's twin — a sea of slow dead from minute one, cap 130 (`modes.ts:881`) |
| **safehouse** | ✅ WIRED | protect Dr. Voss, 5-min evac countdown, alert/hunt AI (`modes.ts:673`) |
| **science** | ✅ WIRED | Scientist-Hunt covert op (its own runtime, see C2) |
| **paintball** | ✅ WIRED | onboarding hunters-vs-hunted, best-of-5 rounds, "the break" (`modes.ts:182`) |
| **race** | ✅ WIRED | circuit, 3 laps, grid countdown, fastest-lap (`modes.ts:387`) |
| **timetrial** | ✅ WIRED | you vs your ghost (`modes.ts:441`) |
| **derby** | ✅ WIRED | last machine running (`modes.ts:768`) |
| **school** | ✅ WIRED | vehicle-cert course, gates in order, no-fail (`modes.ts:820`) |
| **threat** | ✅ WIRED | the laboratory (summon what you want) |
| **shop** | ✅ WIRED | Vanessa's pro shop — a place, not a match |
| **range** | ✅ WIRED | the Proving Grounds — endless, no clock |

**Every one of the 17 modes runs end-to-end.** None is a stub.

### C1. Campaign / Operations layer — ✅ WIRED (single-player IS built) · `src/client/campaign.ts`
A persistent Living Campaign: 10 named fronts each with a control value (band `coalition/contested/collective`), a signature scar applied as a match modifier, seasons, a motor pool, a treasury, and offline time-skip. `applyResult` moves front control by result (banded, mode-weighted); `stageCampaignOperation`/`settleCampaignOperation` run Operations; `scienceWindowsFor`/`spendScienceWindow` gate Scientist Hunts (2/pass) with a clone economy; `checkSeasonEnd` closes a season. Persisted to local storage (`loadCampaign`/`saveCampaign`). UI in `client/operations-ui.ts`, `military-missions-ui.ts`, `science-flow.ts`, `campaign.ts`.

### C2. Operations runtime — ✅ WIRED · `src/sim/operation-runtime.ts` (stepped `world.ts:2123`)
When a match is launched with `opts.operation`, the World runs `stepWorldOperation` INSTEAD of `stepMode`. An operation is a phase chain over 7 objective kinds — `capture/hold/destroy/escort/arrive/defend/eliminate` (`operation-runtime.ts:139`) — observed against real world state (`observeWorldOperation:189`), with fail conditions (force destroyed, reinforcement clock, prize destroyed, critical airframe lost, 15-min window). Map from `generateOperationMap` (`operation-map.ts:196`) mapping site→front/theater. Domains land/air/sea, scales skirmish/standard/large, support none/artillery/CAS, complications (air-cover-denied, god-on-objective, storm, no-collateral…).

### C3. Military missions — ✅ WIRED · `src/sim/military-missions.ts:126` (7 presets)
Named combined-arms set-pieces: `urban_assault, real_city_assault (Miami Gardens 33056), air_superiority, convoy_interdiction, pass_assault, beachhead, naval_hunt`. Each is a full operation plan (phases + issued vehicle manifest) launched via `createMilitaryMissionLaunch` from the UI (`main.ts:885`). These are the "instant" single-player operations independent of campaign state.

### C4. Scientist Hunt ("science") — ✅ WIRED · `src/sim/science.ts` + `science-runtime.ts` + `science-operation.ts`
NOT forensics — this is the covert-ops mission generator: 10 verbs (`assassinate/steal/raid/deny/rescue/infiltrate/ambush/hold/hunt/decapitate`), 10 sites (clone-vault, research-annex, officer-villa, quarantine-zone…), complications (alarm-net, god-on-guard, no-kill, one-life…), an encounter budget that scales guards/dogs/civilians to the print commitment (`scienceEncounterBudget:101`), and 12 campaign rewards (clone reinforcement, morale, materiel, weather authority, LSW assignment rights). Runs in-world via `stepScienceMission` (`modes.ts:163`). This is the "Scientist Hunt" meta-track.

### C5. 'Science'/forensics/decay-to-bones — ⬜ MOSTLY UNBUILT (idea only)
There is **no forensic decay-to-bones system**. What exists near it: corpses burn to `neutralized` in fire (C/A9), and the OUTBREAK **reanimation clock** — a corpse booked ≥40 contamination rises as a zombie unless denied by fire/blast/BNR ammo (`types.ts:890`, ammo `corpse`-denial ratings `data.ts:249`). `types.ts:423` notes "decay is LOCKED" as a meta-layer lever, and `docs/TEST-FINDINGS.md` records decay-to-bones as an *idea*. Visual/temporal skeleton decay: not in code.

### C6. Track builder — ✅ WIRED (creator-only) · `src/sim/tracks.ts`
A parts-box track editor (straight/curve/chicane, paved/dirt/ice surfaces), validates closure/fit, exports JSON. Behind the Admin Room door; feeds race/derby/timetrial.

---

## TOP 5 GAPS in maps / Ascendants / modes

1. **Terrain elevation is a dead read-path in generated play** (`map.ts:301/657`). Full 3-level height LOS + flight-gating + vehicle ground-follow is wired, but NO procedural generator authors `map.height` — only the Map Maker JSON does. Every generated match is flat. Either the chunk/front generators need to place terrain, or elevation should be documented as Map-Maker-only.

2. **LSW threat-tier doc-vs-code drift** (`lsw.ts` vs `docs/ASCENDANTS.md §1.5`). The designation table promises two T4 EXTINCTION gods (Titan, Stormcaller) and T4 Collective bosses, but in code the **maximum threat actually assigned is 3**, and Cataclysm is coded threat 2. The 5800-HP EXTINCTION tier is defined but no unit uses it. Balance table and code disagree on the top of the ladder.

3. **Indoor AI only wakes on authored/city layouts** (`indoor-ai.ts` via `buildingAuthoringLayoutFromMap`). On stock scatter maps `createIndoorTacticalState` returns null, so the genuine CQB brain (guard search, civilian evac, dog scent) never runs — bots inside grown houses on a field map fall back to open-field behaviour.

4. **The LSW campaign economy is half-plumbed** (`ASCENDANTS.md §6`). Per-front stables, gods as bankable War Materiel, and boss recipes that START with a god on the field are specified but not built — deployment today is purse+rank+pass, not a campaign stock. The "how you BECOME an officer" (OCS) chain is an open fork.

5. **No forensic/decay layer** (C5). Decay-to-bones and any evidence/forensic-science system are idea-stage; the only corpse lifecycle is fire-neutralization and the outbreak reanimation clock. If "Science" is meant to grow toward forensics it currently only means covert Scientist-Hunt ops.

## Open design questions (real forks)
- **Terrain:** do the generators author height, or is elevation forever Map-Maker-only? (blocks vertical warfare on generated maps)
- **The EXTINCTION tier:** raise Titan/Stormcaller/the Collective bosses to the coded 5800-HP T4, or retire the tier and correct the doc?
- **LSW ↔ campaign marriage:** per-front stables & god-as-materiel (design §6) — build now or keep the flat purse?
- **Officer chain (OCS):** how does a player *become* commissioned beyond crossing a rank threshold?
- **Iron Eaters:** speced (procedural scrap-composition, D4) and fielded in horde/tide `roster:'both'`, but their bespoke bodies are noted-not-built (`ASCENDANTS.md §10`).
