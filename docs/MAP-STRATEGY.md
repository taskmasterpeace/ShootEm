# War World — Map Strategy

**The plan for every battlefield we build.** Split out of the Design
Directive (§8.2 keeps the canonical front roster; this document owns *how we
get from here to there*). Living document — updated as decisions land.

- Companion to: [`DESIGN-DIRECTIVE.md`](DESIGN-DIRECTIVE.md) (§8 terrain &
  fronts, §8.4 roofs/slits, §8.6 surfaces, §8.7 jump vocabulary, §19 vision)

---

## 1. The four map families

Everything we will ever build falls into four families, each with its own
job, scale, and toolchain:

| Family | Scale | Job | Built by |
|---|---|---|---|
| **A · Arena pockets** (paintball, duels, drills) | 40–60u | teach movement, taste weapons, arcade fun (§3.3 Paintball Yard) | hand-authored tile stamps |
| **B · Neighborhoods** | 150–250u | close-quarters infantry war; the Outbreak's hunting ground; The City's building blocks | the **dynamic house generator** |
| **C · The ten fronts** | 300–400u | the campaign's named theatres (DD §8.2 roster) | generator recipes v1 → authored maps post-§8.4 |
| **D · Proving Grounds wings** | mixed | qualification courses + tech testbeds | hand-authored, reuse A + B pieces |

The families share one grid engine, one tile vocabulary, one prop system —
a piece built for any family is inventory for all of them.

## 2. The tile vocabulary (the alphabet everything is written in)

Maps are sentences in a small alphabet, and the alphabet is nearly complete:

- **Blocking:** `T_OPEN · T_WALL (4u) · T_COVER (1.2u) · T_WATER` — shipped.
- **Jump tiers (DD §8.7):** HOP (1.2u, anyone vaults) · CLIMB (2–2.5u, jump
  troopers) · WALL (4u, nobody) — *height-aware blocking, to build.* Arena
  pockets (family A) are the proving ground: they're built almost entirely
  from this grammar.
- **Slits & roofs (DD §8.4):** `T_SLIT` firing band + cutaway roofs —
  *decided, build before authoring fronts.*
- **Surfaces (DD §8.6):** grass/mud/sand/ice/snow/road/marsh/rubble layer —
  movement, sound (footstep designation is live), and tracks.

**Sequencing law (from §8.4): no front gets authored twice.** Families A and
B can ship on today's alphabet; family C waits for slits + roofs + surfaces
+ the 300–400u scale decision.

## 2.5 The building library — SHIPPED

`src/sim/buildings.ts`: **20 hand-authored stencil templates** (10 houses +
10 industrial/military structures), procedurally dealt onto every generated
front as mirrored pairs. The stencil legend is the whole authoring surface:
walls, METAL walls (undrillable — the breacher sparks off them), firing
slits, DOORS (closed; **E opens them** — grid state, replicated like digs),
interior crate cover (claimed), and floor loot. Every template registers a
roof rect, so cutaway + concealment come free. `floors: 1` is a reserved
slot — second storeys wait on the Phase-2 height decision (DD §8.4).

Authoring a new building is writing ASCII art; the tests enforce legend
legality, door presence, and size caps.

**Dynamic interiors — SHIPPED on top.** `generateHouse(rng, type)` GROWS
houses instead of picking them, and emits the same stencil format so the
whole proven pipeline (stamp, mirror, doors, drills, zeds) applies
unchanged. Three types, each with its own floor-plan grammar: **manor**
(big BSP plan — rooms split from rooms, a door in every wall), **bungalow**
(modest two-or-three-room BSP), **hall house** (a corridor spine with rooms
hanging off it). Guarantees, test-enforced across 90 layouts: every room
reachable from the front door (no sealed rooms — the generator re-grows on
the rare disconnected layout), windows on the exteriors, furniture and loot
inside, deterministic from the map seed, mirror-safe. ~40% of every battle
front's building stock is grown; the safehouse neighborhood is now 100%
grown — with REAL front doors the horde has to break down (200+ door
poundings and 15–26 breaches per simulated siege).

## 2.6 Population-scaled tiers — SHIPPED (33C, `feature/maps`)

Every front now builds in **three tiers keyed to lobby headcount**, decided
per-front, never stretched (33C "population-scaled families"):

| Tier | Ground | For | Reads as |
|---|---|---|---|
| `small` | 62×62 tiles (~186u) | ≤6 bots/team | the neighborhood fight |
| `standard` | 82×82 (~246u) | 7–9 | the mid war |
| `large` | the full 100×100 (~300u) | 10+ (12v12 keeps its balance ground) | the shipped fronts, as authored |

- **Engine law:** `WORLD` stays 300u — a front authors inside a centered
  playable **box** and seals everything outside it to solid ground (the
  Highland Pass trick, generalized). No renderer/minimap/wire changes. What
  scales is the ground BETWEEN the features and the COUNT of features — a
  small city has fewer blocks, not smaller houses.
- **The wire:** `generateFront(id, seed, size)`, or a `front@size` suffix on
  the id — `main.ts` pushes the lobby's `botsPerTeam` through that suffix
  (`mapSizeForPlayers`), so world.ts never learned about tiers.
- **The law coverage:** every §8.2 law (sealed rim, zero orphans, full
  reachability, no invisible walls, nothing indoors) now patrols all **30
  grounds** in `tests/fronts.test.ts`, plus the new SCALE law (walkable
  small < standard < large, per front).

## 2.7 The City grows up — enterable everything + THE SEWER — SHIPPED

The City was the first full rebuild on the tier system, and it carries the
two ordinances Robert asked for:

- **EVERY BUILDING IS ENTERABLE** — machine-checked, not hoped-for: from
  each building's recorded front door, the BFS must reach a tile strictly
  inside its roof rect. No facades, on any front, at any tier.
- **THE SEWER** — roofed tunnel trunks under the sidewalk columns. Each
  trunk is a stamped building (metal masonry the drill sparks off), entered
  by **manhole ladders** set in both sidewalk walls, draining to the canal
  through grate doors. The roof gives the §4 concealment rule: inside the
  trunk you are OFF the map. Trunks run in segments that never wall a
  street shut, and the quarantine's mouths can breach them. THE SEWER LAW
  (same test file) pins manholes, roofed trunks, and reachable dark at
  every tier.
- **A guaranteed second storey** per tier (the `office2` lot: a grown
  two-storey office, or the authored TENEMENT walk-up when the lot is
  tight).

## 2.8 The skirmish family — procedural hunt grounds — SHIPPED (`feature/maps`)

The fifth map family, and the first one that is **grown whole** rather than
authored: `generateSkirmishMap(theme, seed)` (`src/sim/skirmish.ts`) builds a
62×62 squad pocket for the LSW-hunt concept — two light bases, the **LSW
DEN** in its fenced yard at the heart, and two **named support locations**
(RELAY, TOWER, KENNEL, BARN, DOME, PUMP, SILO...) drawn from the theme's
shelf. The mode's rules (reinforcement tickets, the boss fight) land later;
the GROUND carries the fiction now — control point names read `LSW DEN`.

- **Six biome grammars**, not one scatter: farmstead savanna · colony-row
  titan · deck-corridor starship · dome-field europa · station triton · a
  carved asteroid mine. Deterministic from (theme, seed).
- **The category system behind it** (`src/sim/buildings.ts`): `kind` is the
  function axis (house/commercial/industrial/military/ruin), `biomes` the
  fit axis (which themes a building belongs in — omitted = universal).
  `buildingsFor(theme, kind)` is the shelf every procedural builder picks
  from. The 12-stencil skirmish pack (lsw_den, containment_lab, kennel,
  relay_station, watchtower (2F), barn, dome_hab, mine_barracks, deck_cabin,
  ice_hut, pump_station, ore_silo) ships the location vocabulary.
- **Laws:** every roll answers the six front laws through `validateDoc` —
  all 24 (6 themes × 4 seeds) patrolled in `tests/skirmish.test.ts`.
- **Harness:** the Map Maker's source picker grows them (Skirmish optgroup,
  any seed, editable + exportable); Building Lab and the stamp shelf speak
  the two category axes.

## 3. Dynamic houses — the neighborhood requirement (largely SHIPPED)

The dynamic-interior system above delivers most of this: multi-room plans,
row-scale variety, real doors + window slits, cutaway roofs, yards. What
remains for family B:

- **Parameterized footprints** — size/shape variety, multi-room plans,
  attached garages; row-houses vs detached lots vs the dense blocks The City
  needs.
- **Openings become vocabulary** — doors (exist), window slits (§8.4
  `T_SLIT`), breachable wall segments (the breacher's dinner).
- **Cutaway roofs** (§8.4) — non-negotiable for family B: a house without a
  roof is a floor plan, not a building.
- **Yards & streets carry the surface layer** (§8.6) — lawns, pavement,
  mud alleys: the neighborhood *sounds* like one (footstep designation).

## 4. The concealment rule — houses hide people

The rule that makes buildings matter (user-decided, ties DD §19 + §8.4):

> **If you can't see a character, they are not on your map.** Inside a
> house, an enemy is invisible AND un-minimapped until your cone, your
> squad's eyes, a camera, or the dog finds them. The roof conceals; the
> doorway is the question; the slit is the answer.

The v1 vision cone is the *light* cone (enemy-draw only, no wall-shadow
pass) — but interiors get the concealment rule from day one because roofs
already hide them visually and the minimap simply respects it.

## 5. Sequencing — updated for the locked decisions (DD Appendix B)

Decision **35B** merges the old phases 2–3: roofs/slits, scale, the surface
layer, and jump obstacles are **one integrated map-foundation pass** — they
touch the same grid and authoring assumptions, so splitting them means
rebuilding maps and movement rules repeatedly.

| Phase | Ships | Unblocks |
|---|---|---|
| 1 | **Jump tiers** (§8.7) + arena-pocket authoring on today's alphabet | movement school (§14); Paintball Yard *design-ready* (production sits post-freeze per 7A) |
| 2 | **THE FOUNDATION PASS (35B):** slits + cutaway roofs (§8.4) · population-scaled sizes (33C) · surface layer (§8.6) · height-aware obstacles — plus house generator generalization | Neighborhood family, The City prototype, down/drag/revive (§4.3), weather (§8.8) |
| 3 | **The ten fronts**, authored ONCE against the finished alphabet | the Living Campaign's real theatres (§8.2) |

## 6. Decisions & remaining questions

**Decided (DD Appendix B):**
- **Front scale (33C):** population-scaled families — ~300–360u for standard
  **12v12** fronts (32B), smaller mission pockets, larger vehicle corridors
  only where a front's vehicle play earns them. Per-front, never global.
- **Foundation is one pass (35B)** — see sequencing above.

**Still open:**
- Arena pockets: hand-stamped layouts or a mini-generator with heavy
  constraints? (Lean: hand-stamp the first six — arenas live and die on
  exact geometry.)
- Neighborhood streets: grid (classic suburbs) vs organic (older towns)?
  Affects readability from the top-down camera.
- How many arena pockets does the Paintball Yard open with? (Lean: 3.)
