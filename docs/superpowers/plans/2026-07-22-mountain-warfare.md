# Mountain Warfare — Overnight Build (2026-07-22)

**Goal (Robert, overnight):** terrain elevation → mountain procedural maps → jet/heli
combat + pilot AI → codex/pricing/balance. Dev-team-complete, maximum visibility to tune.
"Don't stop until everything a development team would expect."

Design spec: [`2026-07-22-terrain-elevation-design.md`](../specs/2026-07-22-terrain-elevation-design.md).
Work on `main`, GATED (tsc · vitest · build) + committed at each phase so nothing is left broken.

## Phases (priority order) — progress log at bottom

1. **Terrain elevation v1** — `height`+`ramp` layers, `TERRAIN_U`, `terrainTopAt`;
   thread into LOS (`blocksShot`/`losClear*`); movement gating (infantry slope /
   vehicle ramp / cliff block); air obstacle (heli blocked at Sky, jet clears);
   elevation-follow camera. LEGACY flat (all-zero) = byte-identical, tests untouched.
2. **Mountain procgen** — `generateMountainTheater(seed)` on the 900² geometry:
   ridgelines, passes, valleys, peaks; **ramps as armor lanes**; locations of interest
   the game needs (bases, LZs, radar sites, objectives, chokepoints, fuel/ammo,
   observation peaks). + **winter** reskin + **flat-large** ambiguous-terrain variant.
3. **Aircraft (4)** — 2 new **jets**; a **stealth bomber** (low radar signature, bomb
   drop); an **attack helicopter** with **guided multi-rocket**. Stats (`data.ts`),
   models (`models/`), sounds, holds, tracers. Sidegrade law respected.
4. **Pilot AI** — jet dogfighting + terrain use (mountain masking / radar shadow),
   engaging the new airframes; heli standoff-rocket behavior.
5. **Codex + pricing + balance** — every new airframe/weapon in the codex with a
   price; balance-tested (threat-measure / range-band / sidegrade suites).
6. **Visibility** — harness/live views of terrain + air combat; screenshots; tune.

## Design decisions locked
- 4 bands (Ground/Building/Sky/Clouds); terrain uses 0–2; Clouds = jet-only air.
- Heights `[0,4,16]`u (non-linear). Terrain height separate from building floors.
- Infantry scramble any slope (slow); vehicles need ramps; sheer cliff blocks (climb = Phase-2 ability).
- Stealth = avoids radar/lock; jets fight around mountains; heli fires guided rockets from cover.

## Progress log
- 2026-07-22: spec approved (518c4bb); plan written.
- **Phase 1 ✅ terrain foundation** (3344b9f): GameMap `height`/`ramp` layers, `TERRAIN_U`,
  `terrainTopAt`/`terrainLevelAt`/`isRampAt`, `losClearTerrain`; vision (perceivesNow/eyesSeePoint)
  reads terrain — high ground sees over, mountains block. Absent height = flat = byte-identical.
- **Phase 2 ✅ mountain procgen** (7083bcd): Crown Divide massifs RISE (Sky summit/Building
  shoulder) — block sight over the ridge, cap rotorcraft, jets clear; +radar stations & caches.
- **Phase 3 ✅ air program** (40ec6fe): Warhawk gun jet, Specter fighter, Reaper STEALTH bomber
  (radar can't lock past 42u), Hydra guided-rocket gunship heli. 7 weapons, priced, auto-codexed,
  rendered (proven airframes), spawnable. Stealth wired into hullLockTarget.
- **Phase 4 ✅ pilot AI** (1d2245d): fighters hunt enemy aircraft, match altitude, lead-fire —
  the sky is contested. Builds on the SAM beam-evade.
- **Phase 5 ✅ render relief** (22bf332): wall+metal InstancedMeshes scale to terrain height —
  the mountains READ as mountains from command height. (tsc+build; **live 3D screenshot still owed**.)
- All five gated (tsc · vitest **2184** · build). Nothing pushed.

## Post-checkpoint work (2026-07-22, this session)
- **Distinct airframe models ✅** (`df7e066`): Warhawk/Specter/Reaper/Hydra each got their own
  silhouette (dropped the strikejet/interceptor/bomber/attackheli remap); proven on the new
  `vehicle-sheet.html` motor-pool contact sheet. Ledger recorded (`38ef849`).
- **Winter reskin ✅** (`26cda37`): a `winter` theme, Crown Divide moved onto it. Sim-byte-identical
  (winter mirrors europa's gravity/surface/weather); only the palette turns snow-white.

## Remaining (next session)
- **Live visual pass** on Crown Divide (deploy the `pass_assault` military mission) → tune mountain
  heights/look + the snow palette, confirm heli-blocked/jet-over reads on screen.
- **Flat-large variant** — a new open vehicle theater (wide: touches the theater-sweep suites).
- **Walkable elevation** (Phase-2 spec item): infantry-slope/vehicle-ramp movement + the terrain-Y
  baseline + cliff-climbing ability (grapple/jetpack). v1 mountains are impassable masonry.
- **Deeper balance** on the four airframes in live play; the altitude UI meter (Robert's UI track).
