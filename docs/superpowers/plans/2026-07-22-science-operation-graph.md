# Science Operation Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a deterministic tactical graph for every Science map that owns its critical route, guard patrol loops, alarm/report nodes, response routes, and permanent player waypoints.

**Architecture:** A new pure `science-operation.ts` module derives room centers and portal adjacency from the existing authoritative building-navigation document. `science-map.ts` attaches the graph to its layout, `science-runtime.ts` copies only mutable mission state, and client surfaces consume stable waypoint data without recomputing topology.

**Tech Stack:** TypeScript, seeded War World building generator/navigation, Vitest, Canvas/Three.js client HUD and Map Maker.

## Global Constraints

- The same mission seed and generated building produce value-equivalent graph data.
- Existing `GeneratedBuilding`, `BuildingNavigation`, map tiles, and validation laws remain authoritative.
- Entry, every required objective, and extraction must be connected through the graph.
- Patrol routes contain two to four reachable points and return to their authored post.
- Dog-compatible routes may not require a ladder edge.
- Graph generation never mutates the `GameMap`, building document, or input socket arrays.
- No Delaunay dependency is added; current room adjacency already supplies plausible building edges.
- All graph generation uses the existing seeded `Rng` or deterministic sorting.
- Battle modes and non-Science maps remain unchanged.

---

### Task 1: Pure Operation Graph

**Files:**
- Create: `src/sim/science-operation.ts`
- Create: `tests/science-operation.test.ts`

**Interfaces:**
- Produces: `ScienceOperationNodeKind = 'insertion' | 'room' | 'objective' | 'report' | 'response' | 'extraction'`
- Produces: `ScienceOperationNode { id: string; kind: ScienceOperationNodeKind; pos: Vec3; floor: number; roomId?: number }`
- Produces: `SciencePatrolRoute { id: string; guardIndex: number; points: Vec3[]; roomIds: number[] }`
- Produces: `ScienceOperationGraph { seed; nodes; roomEdges; criticalRoute; patrolRoutes; reportNodes; responseRoutes; metrics }`
- Produces: `generateScienceOperationGraph(input): ScienceOperationGraph`
- Produces: `validateScienceOperationGraph(graph): string[]`
- Consumes: `GameMap`, `GeneratedBuilding`, entry/extraction/objective/guard/reinforcement positions, and seed.

- [ ] **Step 1: Write deterministic and topology tests**

Generate villa, annex, and vault layouts. Assert repeat generation is equal; source arrays are unchanged; insertion/objective/extraction nodes exist; critical route starts at insertion and ends at extraction; every patrol has two to four points and closes on its post; report nodes are real room nodes; response routes end inside the building; metrics report rooms, edges, loops, and critical-route length; validation returns no issues.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx vitest run tests/science-operation.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Derive immutable room topology**

Use `buildingAuthoringLayoutFromMap(map)` and `deriveBuildingNavigation(layout)`. Convert each navigation room's average local tile to a world-space center using the returned origin, `TILE`, and `WORLD`. Convert each portal with two room IDs into one normalized undirected edge; retain its portal kind for traversal validation.

- [ ] **Step 4: Build the critical route**

Map insertion, primary objective, and extraction to their nearest floor-aware rooms. Run deterministic breadth-first search for insertion-room → objective-room and objective-room → extraction-room. Emit `[entry, ...room centers, objective, ...room centers, extraction]` with consecutive duplicate positions removed.

- [ ] **Step 5: Assign patrol and report routes**

For each guard post, find its nearest room and choose reachable adjacent rooms using `(seed + guardIndex)` rotation over sorted room IDs. Emit the post, one or two room centers, then the post; cap at four points. Choose one report node for small buildings and two for buildings with eight or more rooms by descending portal degree, breaking ties by room ID.

- [ ] **Step 6: Build response routes and metrics**

For each reinforcement post, route from its nearest room to the entry room and emit the exterior point followed by room centers. Compute unique undirected edge count, `loops = max(0, edgeCount - roomCount + 1)`, critical route point count, patrol count, and report count.

- [ ] **Step 7: Validate graph laws**

Reject missing required node kinds, a critical route shorter than three points, non-closing patrols, patrol points outside known rooms/posts, report nodes without room IDs, empty response routes, and non-finite coordinates. Return descriptive strings without throwing.

- [ ] **Step 8: Run the focused test and typecheck**

Run: `npx vitest run tests/science-operation.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/sim/science-operation.ts tests/science-operation.test.ts
git commit -m "feat: generate science operation graphs"
```

### Task 2: Attach Graph to Map and Runtime

**Files:**
- Modify: `src/sim/science-map.ts`
- Modify: `src/sim/science-runtime.ts`
- Modify: `tests/science-map.test.ts`
- Modify: `tests/science-runtime.test.ts`
- Modify: `tests/science-presentation.test.ts`

**Interfaces:**
- Produces: `ScienceMapLayout.operationGraph: ScienceOperationGraph`
- Produces: `ScienceMissionRuntime.operationGraph: ScienceOperationGraph`
- Produces: `ScienceMissionRuntime.patrolRoutes`, `.reportNodes`, and `.missionWaypoints`
- Consumes: `generateScienceOperationGraph`

- [ ] **Step 1: Write failing layout/runtime tests**

Assert every site seed attaches a valid deterministic graph, runtime patrol count matches the initial guard count, report nodes are non-empty, and mission waypoints contain insertion, current objective, and extraction with correct `y`/floor data.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/science-map.test.ts tests/science-runtime.test.ts`

Expected: FAIL because layouts and runtimes do not expose graph data.

- [ ] **Step 3: Generate the graph once in `generateScienceMap`**

After all sockets are selected, call `generateScienceOperationGraph` with copied inputs and attach the returned graph. Throw a descriptive generation error if `validateScienceOperationGraph` returns issues; the surrounding Science generation retry/fallback contract remains responsible for recovery.

- [ ] **Step 4: Copy graph contracts into runtime**

Keep the graph immutable by reference. Copy patrol route point arrays for runtime assignment, copy report-node positions, and create typed waypoints:

```ts
type ScienceMissionWaypointKind = 'insertion' | 'objective' | 'extraction' | 'report';
interface ScienceMissionWaypoint {
  id: string;
  kind: ScienceMissionWaypointKind;
  label: string;
  pos: Vec3;
  floor: number;
  active: boolean;
}
```

Objective is active during `objective`; extraction becomes active in `extract`; insertion stays visible; report is active only during `searching`.

- [ ] **Step 5: Update waypoint state during mission transitions**

When primary completes, deactivate objective waypoints and activate extraction. When a report begins, activate the nearest report node; cancel/completion deactivates it. Preserve all waypoints in data so renderer labels do not churn identities.

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npx vitest run tests/science-map.test.ts tests/science-runtime.test.ts tests/science-presentation.test.ts && npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sim/science-map.ts src/sim/science-runtime.ts tests/science-map.test.ts tests/science-runtime.test.ts tests/science-presentation.test.ts
git commit -m "feat: attach tactical graph to science missions"
```

### Task 3: Player Waypoints and Map Maker Overlay

**Files:**
- Modify: `src/client/hud.ts`
- Modify: `src/client/renderer.ts`
- Modify: `src/client/mapmaker.ts`
- Modify: `src/styles.css`
- Modify: `tests/science-presentation.test.ts`
- Modify: `tests/mapmaker-ui.test.ts`

**Interfaces:**
- Consumes: `ScienceMissionRuntime.missionWaypoints`, `.operationGraph`, and `.patrolRoutes`
- Produces: floor-aware mission diamonds/pillars and Map Maker graph overlay legend.

- [ ] **Step 1: Write failing presentation and editor tests**

Assert active waypoint labels include `INSERTION`, objective label, `REPORT` while searching, and `EXTRACTION` after primary completion. Assert Map Maker HTML exposes toggles/legend for critical route, patrols, report nodes, and response routes plus graph metrics.

- [ ] **Step 2: Run tests and verify failure**

Run: `npx vitest run tests/science-presentation.test.ts tests/mapmaker-ui.test.ts`

Expected: FAIL because only temporary tactical-system waypoints exist.

- [ ] **Step 3: Render permanent mission waypoints**

Extend renderer waypoint input with `y`, label, kind, and active. Reuse the existing light-pillar pool with kind colors: insertion cyan, objective amber, report red-amber, extraction green. Hide a waypoint when its floor is not the focused actor floor unless it is the next required waypoint; then show an up/down chevron in the label.

- [ ] **Step 4: Draw minimap waypoints and labels**

Merge active mission waypoints with temporary player pings without mutating either collection. Mission waypoints do not expire and use stable IDs rather than positional numbering.

- [ ] **Step 5: Add Map Maker graph overlay**

Draw the critical route as a thick amber polyline, patrols as thin cyan loops with arrows, report nodes as red radio diamonds, and response routes as dashed vermilion lines. Add graph metric chips for rooms, edges, loops, critical length, patrols, reports, guards, armor policy, and weapon profile.

- [ ] **Step 6: Run focused tests and build**

Run: `npx vitest run tests/science-presentation.test.ts tests/mapmaker-ui.test.ts && npx tsc --noEmit && npm run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/client/hud.ts src/client/renderer.ts src/client/mapmaker.ts src/styles.css tests/science-presentation.test.ts tests/mapmaker-ui.test.ts
git commit -m "feat: render science operation routes"
```

### Task 4: Operation Graph Verification

**Files:**
- Modify: `docs/STATUS.md`
- Modify: `docs/SHIPPING-LOG.md`

**Interfaces:**
- Consumes: all operation graph contracts.
- Produces: verified tactical procgen slice.

- [ ] **Step 1: Run a seed-matrix soak**

Run the operation-graph tests across every Science site and at least 100 seeds. Assert no validation issues, unreachable required nodes, malformed patrols, missing report nodes, or non-finite coordinates.

- [ ] **Step 2: Run all repository gates**

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: all commands exit zero.

- [ ] **Step 3: Live-check villa, annex, and vault**

Confirm permanent objective/extraction floor markers, at least two multi-point patrol routes, a visible interruptible report node, and correct up/down waypoint treatment. In Map Maker confirm route overlays follow room/portal topology and remain identical after regenerating the same seed.

- [ ] **Step 4: Record and commit evidence**

```bash
git add docs/STATUS.md docs/SHIPPING-LOG.md
git commit -m "docs: verify science operation graphs"
```
