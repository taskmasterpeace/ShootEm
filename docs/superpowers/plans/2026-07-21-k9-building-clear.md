# K9 Building-Clear Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add server-authoritative `SIC` and `STAY / HEEL` commands that let a handler send a dog through an aimed building to detect and attack hidden occupants while using stairs but never opening doors, breaking glass, or using ladders.

**Architecture:** Add optional replicated K9 order fields to `Soldier` and an optional one-shot command to `PlayerCmd`. A focused `k9-orders.ts` module owns building selection, scoped hostile detection, order transitions, and presentation state; `World.applyCmd` validates and applies commands, while the existing dog brain executes them with the existing layered pathfinder and bite system. Client input, HUD controls, and renderer consume the same replicated order state.

**Tech Stack:** TypeScript, deterministic War World simulation, Three.js renderer, DOM HUD, Vitest, Vite.

## Global Constraints

- The handler is the only soldier allowed to command its dog.
- `SIC` targets the aimed house footprint or the nearest footprint within eight world units.
- A sweep detects hostile living humans/bots inside the assigned building regardless of LOS, darkness, crouch, or cloak, but team intel is emitted only inside the shipped K9 nose radius.
- Dogs may use stairs and existing open passages; they may never use ladders, toggle or damage doors, or break glass.
- `STAY` cancels pursuit and holds an anchor; only an already-in-reach hostile may be bitten. A second press recalls to heel.
- New command and soldier fields remain optional for old clients, saves, recordings, and snapshots.
- Commands and targeting are authoritative simulation decisions; clients never send enemy IDs.
- Do not push. Stage files by explicit name. Keep commits focused and omit `Co-Authored-By` lines.
- Completion requires `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.

---

### Task 1: K9 Order Contract and Building Selection

**Files:**
- Create: `src/sim/k9-orders.ts`
- Modify: `src/sim/types.ts`
- Test: `tests/k9-orders.test.ts`

**Interfaces:**
- Produces `K9Order = 'heel' | 'sic' | 'stay'` and `K9Command = 'sic' | 'stay'`.
- Adds `PlayerCmd.k9?: K9Command`.
- Adds optional `Soldier` fields `k9Order`, `k9BuildingId`, `k9OrderPos`, `k9StayAnchor`, `k9TargetId`, `k9Door`, `k9SearchIndex`, and `k9ClearSince`.
- Produces `ownedDog`, `buildingAtOrderPoint`, `hostilesInK9Building`, `k9AimPoint`, `setK9Heel`, `setK9Stay`, and `setK9Sic`.

- [ ] **Step 1: Write the failing contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildingAtOrderPoint, hostilesInK9Building, k9AimPoint, setK9Sic, setK9Stay } from '../src/sim/k9-orders';
import { World } from '../src/sim/world';

describe('K9 orders', () => {
  it('selects the aimed house or a house no farther than eight units away', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const house = world.map.houses[0];
    expect(buildingAtOrderPoint(world.map, house.center)).toBe(0);
    expect(buildingAtOrderPoint(world.map, { x: 999, y: 0, z: 999 })).toBe(-1);
  });

  it('scopes zombie-like detection to living hostile humans and bots inside the ordered house', () => {
    const world = new World({ seed: 42, mode: 'safehouse' });
    const house = world.map.houses[0];
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    setK9Sic(dog, 0, house.center);
    const hidden = world.addSoldier('Hidden', 'infiltrator', 1, 'bot');
    hidden.pos = { ...house.center }; hidden.cloaked = true;
    const outside = world.addSoldier('Outside', 'infantry', 1, 'bot');
    outside.pos = { x: house.center.x + 40, y: 0, z: house.center.z + 40 };
    expect(hostilesInK9Building(world.map, dog, world.soldiers.values()).map((s) => s.id)).toEqual([hidden.id]);
  });

  it('toggles stay to heel while a new sic order replaces stay', () => {
    const world = new World({ seed: 42, mode: 'tdm' });
    const handler = world.addSoldier('Handler', 'infantry', 0, 'human');
    const dog = world.addDog(handler);
    setK9Stay(dog); expect(dog.k9Order).toBe('stay');
    setK9Stay(dog); expect(dog.k9Order).toBe('heel');
  });

  it('reconstructs the command point from authoritative handler aim', () => {
    expect(k9AimPoint({ x: 10, y: 0, z: 20 }, Math.PI / 2, 12)).toEqual({ x: 10, y: 0, z: 32 });
  });
});
```

- [ ] **Step 2: Run `npx vitest run tests/k9-orders.test.ts`; confirm RED** because the module and fields do not exist.

- [ ] **Step 3: Add the optional wire/state contracts**

```ts
export type K9Order = 'heel' | 'sic' | 'stay';
export type K9Command = 'sic' | 'stay';

// Soldier
k9Order?: K9Order;
k9BuildingId?: number;
k9OrderPos?: Vec3;
k9StayAnchor?: Vec3;
k9TargetId?: number;
k9Door?: number;       // floor * GRID² + tile index
k9SearchIndex?: number;
k9ClearSince?: number;

// PlayerCmd
k9?: K9Command;
```

- [ ] **Step 4: Implement the pure order helpers**

```ts
export const K9_BUILDING_SNAP = 8;

export function k9AimPoint(pos: Vec3, yaw: number, distance: number): Vec3 {
  const d = Number.isFinite(distance) ? Math.max(0, Math.min(80, distance)) : 0;
  return { x: pos.x + Math.cos(yaw) * d, y: 0, z: pos.z + Math.sin(yaw) * d };
}

export function buildingAtOrderPoint(map: GameMap, point: Vec3): number {
  const direct = houseAt(map.houses, point.x, point.z);
  if (direct >= 0) return direct;
  let best = -1, distance = K9_BUILDING_SNAP;
  for (let i = 0; i < map.houses.length; i++) {
    const d = Math.hypot(map.houses[i].center.x - point.x, map.houses[i].center.z - point.z);
    if (d <= distance) { best = i; distance = d; }
  }
  return best;
}

export function hostilesInK9Building(map: GameMap, dog: Soldier, soldiers: Iterable<Soldier>): Soldier[] {
  if (dog.k9Order !== 'sic' || dog.k9BuildingId === undefined) return [];
  return [...soldiers].filter((s) => s.alive && !s.downed && s.team !== dog.team
    && (s.kind === 'human' || s.kind === 'bot')
    && houseAt(map.houses, s.pos.x, s.pos.z) === dog.k9BuildingId);
}
```

- [ ] **Step 5: Run `npx vitest run tests/k9-orders.test.ts`; confirm GREEN.**

- [ ] **Step 6: Commit**

```powershell
git add src/sim/k9-orders.ts src/sim/types.ts tests/k9-orders.test.ts
git commit -m "feat: define k9 building clear orders"
```

---

### Task 2: Authoritative Command Application and Replication

**Files:**
- Modify: `src/sim/k9-orders.ts`
- Modify: `src/sim/world.ts`
- Modify: `src/sim/snapshot.ts` only if the existing whole-object snapshot test exposes a gap
- Test: `tests/k9-orders.test.ts`
- Test: `tests/record.test.ts`

**Interfaces:**
- Produces `issueK9Command(world, handler, command, aimPoint): K9CommandResult`.
- `K9CommandResult` is `{ ok: true; dog: Soldier } | { ok: false; reason: 'no-dog' | 'dog-down' | 'no-building' }`.
- `World.applyCmd` invokes the command once and emits concise handler feedback.

- [ ] **Step 1: Add failing authority and snapshot tests** proving a non-owner cannot command the dog, no-building leaves the old order intact, a valid `SIC` stores only a building ID/point rather than an enemy ID, and `takeSnapshot`/`applySnapshot` preserves `k9Order`, building, stay anchor, and door wait state.

```ts
const aim = k9AimPoint(handler.pos, handler.yaw, 20);
expect(issueK9Command(world, stranger, 'stay', aim)).toEqual({ ok: false, reason: 'no-dog' });
const before = { order: dog.k9Order, building: dog.k9BuildingId };
expect(issueK9Command(world, handler, 'sic', { x: 999, y: 0, z: 999 })).toEqual({ ok: false, reason: 'no-building' });
expect({ order: dog.k9Order, building: dog.k9BuildingId }).toEqual(before);
```

- [ ] **Step 2: Run `npx vitest run tests/k9-orders.test.ts tests/record.test.ts`; confirm RED** on missing authority behavior.

- [ ] **Step 3: Implement authoritative order application**

```ts
export function issueK9Command(world: World, handler: Soldier, command: K9Command, aim: Vec3): K9CommandResult {
  const dog = ownedDog(world.soldiers.values(), handler.id);
  if (!dog) return { ok: false, reason: 'no-dog' };
  if (!dog.alive || !handler.alive) return { ok: false, reason: 'dog-down' };
  if (command === 'stay') { setK9Stay(dog); return { ok: true, dog }; }
  const building = buildingAtOrderPoint(world.map, aim);
  if (building < 0) return { ok: false, reason: 'no-building' };
  setK9Sic(dog, building, aim);
  return { ok: true, dog };
}
```

- [ ] **Step 4: Apply `cmd.k9` before ordinary ability handling** and reconstruct the point from `s.pos`, `cmd.aimYaw`, and `cmd.aimDist`. Emit `K9 · CLEARING`, `K9 · STAY`, `K9 · HEEL`, or `NO BUILDING AT MARK`; never accept an enemy ID from the client.

- [ ] **Step 5: Run the focused tests, `npx tsc --noEmit`, and confirm GREEN.**

- [ ] **Step 6: Commit**

```powershell
git add src/sim/k9-orders.ts src/sim/world.ts src/sim/snapshot.ts tests/k9-orders.test.ts tests/record.test.ts
git commit -m "feat: apply authoritative k9 commands"
```

---

### Task 3: SIC Sweep, Door Waiting, Stairs, and Stay Brain

**Files:**
- Modify: `src/sim/bots.ts`
- Modify: `src/sim/k9-orders.ts`
- Modify: `src/sim/indoor-ai.ts`
- Modify: `src/sim/map-layers.ts` only if a floor-aware closed-door query is not already exposed
- Test: `tests/k9-building-clear.test.ts`
- Test: `tests/stairs-ai.test.ts`
- Test: `tests/dogs.test.ts`

**Interfaces:**
- Produces `k9SearchWaypoints(world, dog): readonly Vec3[]`, using the assigned house and generated room centers when present, with house center/door fallback.
- Produces `closedDoorAhead(map, dog): number`, returning a packed floor/tile or `-1`.
- Extends `stepDog` with strict order precedence: handler-down hold → stay → sic → existing protective/heel behavior.

- [ ] **Step 1: Create failing three-storey sweep tests** from a generated city building. Put a cloaked enemy on Level 3, issue `SIC`, and assert the dog acquires it, transitions Ground→L2→L3 by stairs, pings only after entering nose radius, and deals bite damage.

```ts
expect(dog.floor).toBe(2);
expect(hidden.hp).toBeLessThan(hidden.maxHp);
expect(world.pinged.has(hidden.id)).toBe(true);
expect(dog.ladderDirection).toBeUndefined();
```

- [ ] **Step 2: Add failing door/glass tests.** Close the exterior normal door and an upper thin door; run the dog and assert their tile values and door HP remain unchanged, `dog.k9Door` is set, and the dog stays on the approach side. Open the door through the human door verb and assert the same order resumes. Place an intact window on the route and assert it remains intact.

- [ ] **Step 3: Add failing Stay tests.** Prove a distant hostile cannot move the dog off its anchor, a hostile within `dog_bite.range + 0.5` may be bitten without pursuit, a shove is corrected back within `0.75`, and the next Stay/Heel toggle restores handler follow.

- [ ] **Step 4: Run `npx vitest run tests/k9-building-clear.test.ts tests/stairs-ai.test.ts tests/dogs.test.ts`; confirm RED** for missing order execution.

- [ ] **Step 5: Add floor-aware closed-door detection**

```ts
export function closedDoorAhead(map: GameMap, dog: Soldier): number {
  const layer = floorLayer(map, dog.floor);
  for (const reach of [TILE * 0.6, TILE * 1.3]) {
    const tx = Math.floor((dog.pos.x + Math.cos(dog.yaw) * reach + WORLD / 2) / TILE);
    const tz = Math.floor((dog.pos.z + Math.sin(dog.yaw) * reach + WORLD / 2) / TILE);
    const tile = layer[tz * GRID + tx];
    if (isDoorTile(tile) && !doorIsOpen(tile) && tile !== T_METAL_DOOR) return dog.floor * GRID * GRID + tz * GRID + tx;
  }
  return -1;
}
```

- [ ] **Step 6: Implement Stay before all scent/guard logic.** Zero velocity at the anchor, correct only displacement beyond `0.75`, and call `startMelee` only when a hostile is already within bite reach. Never call `pathStep` while staying.

- [ ] **Step 7: Implement SIC targeting.** Rank `hostilesInK9Building` by layered route/distance, set `k9TargetId`, path with `allowLadders=false`, and keep the shipped bite/drag. When no target is present, traverse deterministic room-center waypoints for the assigned building. Start the two-second clear timer only after the dog has entered the building and exhausted its room waypoints.

- [ ] **Step 8: Stop at every closed door.** Set `k9Door`, zero velocity, rate-limit bark/announce to five seconds, and leave the tile/door ledger untouched. Clear `k9Door` and resume the existing order as soon as `doorIsOpen` is true.

- [ ] **Step 9: Preserve stairs and reject ladders.** Keep `allowLadders=false` for all K9 layered paths; add closed door tiles as potential planner nodes so the dog reaches the approach side, while collision and `closedDoorAhead` prevent traversal.

- [ ] **Step 10: Run focused tests and confirm GREEN; then run `npx vitest run tests/indoor-ai.test.ts tests/multistorey.test.ts tests/glass.test.ts`.**

- [ ] **Step 11: Commit**

```powershell
git add src/sim/bots.ts src/sim/k9-orders.ts src/sim/indoor-ai.ts src/sim/map-layers.ts tests/k9-building-clear.test.ts tests/stairs-ai.test.ts tests/dogs.test.ts
git commit -m "feat: let k9 teams clear buildings"
```

---

### Task 4: Handler Controls, Status, and World Marker

**Files:**
- Create: `src/client/k9-controls.ts`
- Modify: `src/client/input.ts`
- Modify: `src/client/hud.ts`
- Modify: `src/client/renderer.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `src/styles.css`
- Test: `tests/k9-controls.test.ts`
- Test: `tests/visual.test.ts`

**Interfaces:**
- Produces `k9ControlState(local, soldiers): { visible, disabled, status, stayLabel }`.
- Adds `Input.queueK9(command)`; `buildCmd` consumes it once.
- Keyboard `K` queues `sic`, `L` queues `stay`; gamepad L3/R3 use buttons 10/11.
- HUD buttons call the queue API and render authoritative replicated status.

- [ ] **Step 1: Write failing pure presentation/input tests** proving controls are visible only to the owning handler, the status mapping covers heel/sic/door-wait/stay/dead, `K` and `L` are one-shot, and L3/R3 map to the same commands.

```ts
expect(k9ControlState(handler, [handler, dog])).toMatchObject({ visible: true, status: 'K9 · HEEL', stayLabel: 'STAY' });
dog.k9Order = 'stay';
expect(k9ControlState(handler, [handler, dog])).toMatchObject({ status: 'K9 · STAY', stayLabel: 'HEEL' });
dog.k9Order = 'sic'; dog.k9Door = 10;
expect(k9ControlState(handler, [handler, dog]).status).toBe('K9 · WAITING — OPEN THE DOOR');
```

- [ ] **Step 2: Run `npx vitest run tests/k9-controls.test.ts tests/visual.test.ts`; confirm RED.**

- [ ] **Step 3: Implement the pure control-state helper** and render two semantic buttons in `index.html`:

```html
<div id="k9-controls" class="k9-controls hidden" aria-label="K9 commands">
  <button id="k9-sic" type="button"><b>SIC</b><span>K · L3</span></button>
  <button id="k9-stay" type="button"><b>STAY</b><span>L · R3</span></button>
  <div id="k9-status" role="status">K9 · HEEL</div>
</div>
```

- [ ] **Step 4: Add input production.** Extend `oneShot` with `k9: undefined as K9Command | undefined`, queue on `K`/`L`, consume into `PlayerCmd.k9`, reset after `buildCmd`, and map gamepad buttons 10/11 on rising edges. `queueK9` lets mouse/touch buttons use the identical path.

- [ ] **Step 5: Wire controls in `main.ts` and update them from the HUD/world frame.** Buttons play `ui_click`, call `input.queueK9`, and never mutate world state directly.

- [ ] **Step 6: Add polished styles** using the existing War World palette: compact amber bordered controls, 10px corners, hover/focus/pressed states, disabled state, touch target of at least 44px, and reduced-motion compliance.

- [ ] **Step 7: Render the K9 order marker.** Draw a small team-colored forward chevron over a `sic` dog, a square hold marker over a `stay` dog, and no additional marker for heel. Use a pure marker-kind helper covered by `tests/visual.test.ts`.

- [ ] **Step 8: Run focused tests, `npx tsc --noEmit`, and confirm GREEN.**

- [ ] **Step 9: Commit**

```powershell
git add src/client/k9-controls.ts src/client/input.ts src/client/hud.ts src/client/renderer.ts src/main.ts index.html src/styles.css tests/k9-controls.test.ts tests/visual.test.ts
git commit -m "feat: add k9 handler controls"
```

---

### Task 5: Production Playtest, Documentation, and Release Gates

**Files:**
- Modify as failures require, always with a focused failing regression test first.
- Modify: `docs/SCIENCE-MISSIONS.md`
- Modify: `docs/SHIPPING-LOG.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-21-k9-building-clear.md`

**Interfaces:** None new; this task proves the complete handler-to-dog story.

- [ ] **Step 1: Run all focused K9 suites**

```powershell
npx vitest run tests/k9-orders.test.ts tests/k9-building-clear.test.ts tests/k9-controls.test.ts tests/dogs.test.ts tests/stairs-ai.test.ts tests/indoor-ai.test.ts tests/glass.test.ts tests/record.test.ts tests/visual.test.ts
```

Expected: every file and assertion passes with no unexpected warning.

- [ ] **Step 2: Start Vite and use the in-app browser** to launch a three-storey generated Science building with a handler, dog, and hidden hostile. Exercise `SIC`, closed-door wait, human-opened continuation, stairs, target acquisition/bite, `BUILDING CLEAR`, `STAY`, and `HEEL`. Confirm no ladder activation, no door/glass mutation by the dog, and zero console warnings.

- [ ] **Step 3: For every runtime defect, add a failing regression test, observe RED, implement the smallest correction, and observe GREEN.**

- [ ] **Step 4: Update shipping documentation** with exact commands, detection scope, door/glass/ladder limits, multi-floor behavior, and browser verification evidence.

- [ ] **Step 5: Run all four release gates in order**

```powershell
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

Expected: TypeScript has no diagnostics; every Vitest file/test passes; ESLint reports zero errors; Vite emits the production bundle.

- [ ] **Step 6: Verify repository hygiene**

```powershell
git diff --check
git status --short
git log --oneline -12
git diff --stat main...HEAD
git -C D:\git\ShootEM status --short
```

Expected: no whitespace errors, no untracked production files, the original checkout retains only its pre-existing user-owned changes, and no push occurred.

- [ ] **Step 7: Commit the production record**

```powershell
git add docs/SCIENCE-MISSIONS.md docs/SHIPPING-LOG.md docs/STATUS.md docs/superpowers/plans/2026-07-21-k9-building-clear.md
git commit -m "docs: ship k9 building clear commands"
```
