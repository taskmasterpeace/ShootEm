# War World — AI Architecture Map

*The index to every piece of bot "thinking." Companion to [`AI-AUDIT.md`](AI-AUDIT.md)
(what to improve) — this is **where** each thing lives and **how** to change it
safely. Started 2026-07-22 as the "organize the AI so it can be analyzed and
improved easier" pass; kept current as the split proceeds.*

## The shape of it

The AI is **one brain file** (`src/sim/bots.ts`) being progressively split into
`src/sim/ai/*` leaf modules, wrapped by a ring of already-extracted support
modules. Everything runs deterministically off one seeded RNG (see
[Determinism](#determinism-the-rules-that-keep-2200-tests-green)).

```
                 ┌─────────────────────────────────────────────┐
   world.ts ───► │ bots.ts  — the brain (dispatch + stepBot)    │
   (tick loop)   │   objectives · doctrine · nav · piloting ·   │
                 │   stepBot core · scientist · K9 · horde      │
                 └───────┬───────────────────────────┬─────────┘
                         │ imports                    │ imports
              ┌──────────▼─────────┐       ┌──────────▼──────────┐
              │ src/sim/ai/        │       │ the support ring    │
              │  pathfinding.ts ✅ │       │  bot-tuning.ts      │
              │  perception.ts  ✅ │       │  indoor-ai.ts       │
              │  (planned: nav,    │       │  k9-orders.ts       │
              │   objectives,      │       │  influence.ts       │
              │   piloting, agents)│       │  director.ts        │
              └────────────────────┘       │  perception.ts*     │
                                           └─────────────────────┘
   * perception.ts is the HUMAN/render sight model — distinct from the bot's
     own findTarget (ai/perception.ts). Merging them is AI-AUDIT Theme 1.
```

## `src/sim/ai/` — the extracted leaves

| Module | What it owns | Depends on |
|---|---|---|
| **`ai/pathfinding.ts`** ✅ | THE PLANNER — grid BFS + A* (`pathStep`), the BFS/A* scratch, floor/ladder transitions. Pure nav. | map, map-layers, geometry, types |
| **`ai/perception.ts`** ✅ | THE EYES — `findTarget` (grass clamp, cone/ring, cloak, ping, LOS, nemesis bias), `enemyVehicleNear`, `radarSearchPoint`, `vehicleCrewReacted`. | map, bot-tuning, types |

Both are **leaves** (they import nothing from `bots.ts`), so there's no cycle.
`bots.ts` imports what it needs and re-exports the few symbols tests reach for
(`radarSearchPoint`). Behaviour is byte-identical — the split is pure code
motion, proven by the determinism suites after each extraction.

## `bots.ts` — the clusters still inside (2198 lines)

Each `// ----------` banner is a section; ranges drift as the split proceeds, so
trust the banners over the numbers.

| Cluster | ~Lines | What it decides | Extract to (planned) |
|---|---|---|---|
| **Objective selection** | 59–428 | `objectiveFor` — the per-mode strategic-goal switch (ctf/koth/conquest/…) + role predicates (`raidsFlags`, `guardsHome`, `defendsNow`) + the `OBJ_CACHE`. | `ai/objectives.ts` |
| **Per-class doctrine** | 429–460 | `DOCTRINE` table — standoff/chase/retreat/strafe/flank/aim per class. | `ai/objectives.ts` or fold into combat |
| **Nav primitives** | 461–534 | `doorAhead`, `nearestCover`, `climbAhead`, `buildingAhead` — tile scans shared by movement & combat. | `ai/nav.ts` |
| **Piloting** | 535–774 | Vehicle/aircraft AI: route selection, `vehicleWaypoint`, `assignVehicleRoles`, `stepTheaterVehicle` (dogfight/energy-fight/altitude), `raceDriverCmd` (Motor Trials). | `ai/piloting.ts` |
| **`stepBot` (the core)** | 804–1582 | The infantry brain: perception→objective→movement→combat→abilities→spacing→aim, plus the inlined vehicle-driving block. The god function (AI-AUDIT Theme 7). | stays; lift sub-blocks out first |
| **`leadYaw`** | 1583 | Projectile lead angle (shared kernel). | stays / `ai/nav.ts` |
| **Scientist** | 1591–1632 | `stepScientist` — flee-to-safehouse escort. | `ai/agents.ts` |
| **K9** | 1633–1898 | `stepDog` + `nearestK9Threat`/`driveK9Toward`/`stepK9Sic`… — the dog brain (pairs with `k9-orders.ts`). | `ai/agents.ts` |
| **Horde** | 1899–end | `stepIron` + `stepZombie` — the undead/scrap brains (own targeting loop). | `ai/horde.ts` |

**Extraction order (bottom-up, to keep the dependency DAG acyclic):**
pathfinding ✅ → perception ✅ → nav → objectives → piloting → the tail agents
(scientist/K9/horde import the leaves, never `bots.ts`) → `stepBot` last.

## The support ring (already its own modules)

| File | Concern |
|---|---|
| `bot-tuning.ts` | **The dial-board** — `BOT_TUNING` (every AI magic number: vision, lead, aim, grenade band, repath cadence, separation) + the `DIFFICULTY` ladder. **This is where a designer turns knobs.** |
| `indoor-ai.ts` | Per-actor indoor FSM (guard/investigate/search/evacuate) + dog scent trails. State on `world.indoorTactics`. |
| `k9-orders.ts` | K9 command layer (heel/stay/sic, building-snap, door/scent helpers). |
| `perception.ts` | The **human** sight model (cone/ring/grass/weather/cloak/ping). Bots run their own `ai/perception.ts` instead — unifying them is AI-AUDIT Theme 1. |
| `influence.ts` | Team threat field (`threatAt`) — biases radar-search scoring. |
| `director.ts` | Pacing "pressure" band — scales bot aim-error & reaction. |
| `officer.ts` | K9 handler eligibility. |

## Cross-cutting AI (steering outside `bots.ts`)

- **`world.ts`** — the AI tick dispatch (`stepBot`/`stepDog`/`stepIron`/`stepScientist`/`stepZombie`), and **`stepLsw`** (the LSW signature/leap AI — intent is set in `bots.ts`, executed here).
- **`modes.ts`** — the wave/population director (`targetPop`) and the **Motor Trials race engine** (`stepRace`: countdown, laps, placement).

## The bot's brain state (`Soldier`, `src/sim/types.ts`)

Per-agent AI memory lives on the `Soldier`: targeting (`botTargetId`, `botAcqId`,
`botAcquireAt`), objective cache (`botObjective`, `botObjAt`), pathing/stuck
(`botGoal`, `botRepathAt`, `botStuckAt`, `botLastX/Z`), vehicle routes
(`botVehicleRouteId/Index/Dir`, `botAirProfile`), personality (`botLifeSeed`),
and K9 orders (`k9Order`, `k9TargetId`, …). The only off-`Soldier` AI memory is
`IndoorTacticalState` on `world.indoorTactics`.

## Determinism — the rules that keep 2200+ tests green

Any AI edit (and every extraction) MUST preserve these, or replays/snapshots and
the deterministic test suites break:

1. **One seeded RNG.** Bots draw only via `w.rng.next()` (mulberry32). No
   `Math.random`/`Date.now` anywhere in `src/sim`.
2. **Unconditional draws.** RNG draws happen *before* the effect gate, so the
   stream stays byte-identical regardless of branch (see the grenade / bite
   comments in `stepBot` / `stepZombie`).
3. **`id % N` is off-stream.** Terrain-decoupled choices (flank side, bite
   grabber, lane offset, race skill tier) use `s.id`, never the RNG.
4. **Per-agent time-gates, not a global stagger.** `stepBot` runs every tick;
   "thinking" is amortized by cooldown fields (`botRepathAt`, `botObjAt`,
   `botAcquireAt`). Keep them intact.
5. **`world.indoorTactics` stays on the World** (not a split module).

## "To improve X → open Y"

| Want to change… | Open |
|---|---|
| Bots seeing through grass/fog / omniscience / focus-fire | `ai/perception.ts` (`findTarget`) |
| Pathfinding (A* upgrade, walkable predicate, stuck escalation) | `ai/pathfinding.ts` |
| Objective/role logic (utility scoring, defenders, score adaptivity) | `bots.ts` `objectiveFor` |
| Any tuning number, or the difficulty ladder | `bot-tuning.ts` (`BOT_TUNING`, `DIFFICULTY`) |
| Vehicle / aircraft / racing driving | `bots.ts` `stepTheaterVehicle`, `raceDriverCmd` |
| Zombie / Iron-Eater behaviour | `bots.ts` `stepIron`, `stepZombie` |
| Military working dogs | `bots.ts` `stepDog` + `k9-orders.ts` |
| LSW signature powers / leap targeting | `world.ts` `stepLsw` |
| The race (laps, placement, countdown) | `modes.ts` `stepRace` |

## Verify after any AI change (the ritual)

1. `npx tsc --noEmit`
2. `npx vitest run tests/sim.test.ts tests/botbrain.test.ts tests/ai-behavior.test.ts tests/bots-nav.test.ts tests/race.test.ts` — the determinism + behaviour net.
3. For a bigger change, the full suite. Any drift in `sim.test.ts` means a
   determinism rule above was broken.
