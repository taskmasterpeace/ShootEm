# THE AIR PROGRAM — spec of record + honest status

**Robert's authoritative design (2026-07-22).** This is the codex note: the four
airframes, the mountain procgen, and the pilot AI, each with what is BUILT vs
what is still owed. The airframes already auto-list in the in-game Codex (they
live in `WEAPONS`/`VEHICLES`); this doc is the "make sure we get it done" ledger
behind those entries.

**Answer to "are there blockers?":** No *hard* engine blockers — every mechanic
Robert wants runs on systems that already ship (homing missiles, arc bombs,
stealth-lock, the radar/ECM track system, terrain height + LOS). What remains is
*wiring and tuning*, listed as GAP rows below. Nothing here is blocked on a
capability we don't have.

---

## The four airframes — his spec ↔ what shipped

Built overnight as Warhawk / Specter / Reaper / Hydra (commits `40ec6fe`,
`1d2245d`, `df7e066`). They map onto Robert's named designs; the deltas are the
work.

| Robert's design | Built as | Role | Status of the SPEC |
|---|---|---|---|
| **Sparrowhawk** — fast multirole strike (hp~90, hitscan cannon + rocket pods, no A2A) | **Warhawk** (hp130) | CAS / anti-ground | 🔨 Airframe + cannon + splash pods SHIP. **Concept delta:** my Warhawk is the SLOW A-10 tank-buster (hp130, dmg-40 gun); his Sparrowhawk is a FAST thin multirole (hp90). *Decision: retune Warhawk→Sparrowhawk, or keep the A-10 and add Sparrowhawk as a 5th?* |
| **Kite** — air-superiority interceptor (hp~80, rapid cannon + heat-seeker AAM homing on aircraft) | **Specter** (hp70) | Dogfighter | 🔨 Airframe + cannon + a long-reach missile SHIP, and the pilot AI HUNTS aircraft. **GAP: the AAM does not HOME** — `specter_aam` is a dumb splash rocket (no homing flag). His Kite needs a true heat-seeker (homes on aircraft, flares counter it). |
| **Nighthawk** — stealth bomber (hp~110, low signature, bomb bay) | **Reaper** (hp150, `stealth:true`) | Radar-evading strike | 🔨 Airframe + arc bombs (breach masonry) SHIP; stealth HALVES vehicle target-lock (`hullLockTarget`, 42u). **GAP: stealth is NOT in `radar.ts`** — the Reaper still paints on the enemy minimap. His mechanic: low signature = halved AA/SAM lock **and** no minimap track until it drops. |
| **Copperhead** — attack heli, guided multi-rocket (hp~140, rotorcraft, mountain-gated) | **Hydra** (hp115) | Standoff tank-killer | 🔨 Airframe + a rocket volley + chin gun SHIP. **GAP 1: the rockets are NOT guided** — `hydra_guided` is a dumb splash volley (no soft-lock/homing). **GAP 2: rotorcraft are NOT Sky-gated** — a heli can still fly over a Sky peak (terrain does LOS + renders tall, but flight movement ignores height). |

**Codex + pricing:** all four auto-list in the Codex with their weapons. Deploy
**cost** is the game's small-integer scale (Warhawk/Specter/Hydra `4`, Reaper
`6`). Robert's price tags (~2200–3400) read as a **credits economy** that the
game doesn't have as a field yet — *decision: add a codex `credits` price, or
map his intent onto the deploy-cost scale?*

---

## Mountain procgen — `generateMountainTheater`

| Piece | Status |
|---|---|
| 900²-ish deterministic seeded generation (no `Math.random`) | ✅ `7083bcd` |
| Height field → levels 0/1/2, ridges, passes/valleys, peaks as Sky heli-walls | 🔨 SHIP as a **radial** massif (r<0.45 → Sky). **Refine to Robert's spec:** 3–4 octaves of value-noise + a ridged transform for real ridgelines. |
| Ramps (1-step slopes vehicles climb; 2-step cliffs force the passes) | ❌ `ramp` layer exists in the map type; generation doesn't flag ramps yet. |
| LOI: 2 mirrored valley bases, radar sites on peaks, LZ helipads, central objective, supply crossroads, observation posts | 🔨 Radar silos + supply caches seed on routes. **Remaining:** mirror for fairness, put radar sites ON peaks as **destructible AA-blinders** (the stealth counterplay), OPs on high ground, an explicit central objective. |
| Variant: **winter** (ice/snow, cold palette) | ✅ `26cda37` — the `winter` theme; Crown Divide is snowbound (sim-byte-identical). |
| Variant: **flat-large** (mostly level-0, sparse rises, long sightlines — "ambiguous large terrain") | 🔨 IN PROGRESS this session (a new open theater). |

---

## Pilot AI (`bots.ts`)

| Behavior | Status |
|---|---|
| Jets hunt enemy aircraft, match altitude, lead-fire | ✅ `1d2245d` |
| Energy fight — hold speed, guns-in-range, missile-on-lock, **extend & re-merge** (no death-spiral) | 🔨 Basic lead-fire only; the energy/extend loop is the refinement. |
| **Break missile lock behind a ridge** (`losClearTerrain` occludes the seeker) | ❌ Seeker doesn't check terrain LOS yet. |
| Stealth bomber routes **around** known radar/SAM coverage, drops, egresses | 🔨 Basic strike run; radar-aware routing is the refinement. |
| Copperhead terrain-masks — hull-down behind a Sky peak, pop up to salvo, drop back; routes through passes | ❌ Needs the rotorcraft Sky-gate (above) first, then the hull-down behavior. |

---

## THE REMAINING CHECKLIST (the honest blockers — none are hard)

Priority order, each buildable on shipped systems:

1. **Rotorcraft Sky-gate** — a heli at Building band cannot cross a Sky-height massif; jets can. Wire terrain `height`/`SKY_LEVEL` into flight movement (`world.ts`). *Robert's core terrain tie-in.*
2. **Heat-seeker AAM** — give `specter_aam` homing-on-aircraft (the `homingVehicleId` path already exists; flares already counter it).
3. **Guided multi-rocket** — `hydra_guided` soft-locks a marked target and the salvo homes.
4. **Stealth radar suppression** — `stealth` hides the airframe from enemy minimap radar tracks (`radar.ts`) until it drops, and halves SAM lock-range.
5. **Radar sites as destructible AA-blinders** — killing the peak radar extends the stealth window (procgen LOI + a systemHp hook).
6. **flat-large theater** — finish the open variant (in progress).
7. **Pilot-AI refinements** — missile-lock-break behind ridges, energy extend/re-merge, heli hull-down, radar-aware bomber routing.
8. **Procgen refinements** — ridged-noise height field, ramps, mirrored LOI + central objective.
9. **Tuning pass** — reconcile stats/names/prices to Robert's spec once the concept + economy decisions are made.

**Decisions on the desk (Robert's):** (a) Sparrowhawk fast-multirole vs. keep the
A-10 Warhawk (retune or add a 5th); (b) his names vs. the shipped names; (c) the
credits price economy (~2200–3400) vs. the deploy-cost scale. Everything else
proceeds without a decision.

*Gates for every item: tsc · vitest · eslint · build, on-screen proof, update
this checklist + `docs/STATUS.md`. Push on ask.*
