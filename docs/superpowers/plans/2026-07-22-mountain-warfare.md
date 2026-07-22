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
- 2026-07-22: spec approved (518c4bb); plan written. Starting Phase 1.
