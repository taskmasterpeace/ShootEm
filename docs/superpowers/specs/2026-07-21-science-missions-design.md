# Science Missions Design

**Status:** Approved for autonomous implementation from Robert's locked 2026-07-20 brief and his explicit request to continue without routine interruptions.

## Outcome

Science missions become a first-class, playable War World mode: compact deterministic side operations built from **verb × site × stake × complication**, entered from free play or a campaign-front mission window. They reuse the shipped weapons, movement, perception, bots, pedestrians, destruction, two-storey traversal, clone economy, after-action record, and Front Courier.

The production slice supports all ten verbs and all ten sites through a small set of composable objective primitives. A mission is short, readable, restart-fast, and costly: the player commits 1–8 clones, every death burns one, and exhausting the squad fails the operation. A zero-death completion earns a ghost bonus.

## Approaches Considered

### 1. Native War World mode — selected

Add a `science` mode to the deterministic simulation and let a focused mission runtime compose existing systems. This keeps one source of truth for gunplay, AI, doors, floors, perception, clone accounting, replay, and results. It requires careful integration, but every improvement remains useful to the main war.

### 2. TDM reskin with scripted client overlays

This would launch a small TDM map and infer objectives in the browser. It is fast to prototype but fails authority, replay, snapshot, and testability requirements. Clone loss and objective state could disagree with the simulation.

### 3. Standalone mini-game engine

This would allow custom geometry and rules quickly, but would duplicate War World's weapons, movement, AI, and rendering. It would immediately drift from the game Robert asked to build on.

## Mission Contract

`ScienceMissionSpec` is deterministic from a seed and contains:

- one of ten verbs: assassinate, steal, raid, deny, rescue, infiltrate, ambush, hold, hunt, decapitate;
- one of ten sites: clone vault, research annex, rail yard, comms relay, field hospital, foundry, buried archive, enemy airfield, officer villa, quarantine zone;
- a stake with a real campaign-facing reward;
- zero or one complication: alarm net, god on guard, storm, third-party fight, no-kill clause, or one-life clause;
- a committed squad size from 1 through 8;
- a short generated briefing sentence and stable operation code.

The generator uses seeded `Rng`; the same seed produces byte-equivalent mission structure and map data.

## Shared Objective Primitives

The ten verbs compile into five tested primitives rather than ten unrelated scripts:

1. **Eliminate** — named target IDs must die. Assassinate uses one, Hunt uses one mobile target, Decapitate uses three mutually alerting officers.
2. **Interact** — hold/use a world marker. Steal takes a carryable data core, Raid banks several crates, Deny arms several charges, and Infiltrate hacks a terminal.
3. **Escort** — captives use the shipped scientist body and follower AI; Rescue frees them individually and requires living captives at extraction.
4. **Survive** — Hold runs a short escalating defense clock at the objective.
5. **Extract** — every successful job ends by returning to the field printer/transport beacon. Carrying a stolen objective slows the player and suppresses the primary weapon until extraction.

Every state transition emits a typed mission event for the HUD, audio/VFX seam, test suite, replay, and after-action data. Interactions use `E`, preserving War World's single activation verb.

## Clone Loop

- The map entry contains exactly one visible clone-bay/field-printer prop beside a safe spawn ring.
- The first print arrives there at mission start.
- Science-mode player deaths skip the normal downed wait, decrement the committed clone budget once, and schedule a near-instant reprint at the field printer.
- No squadmate or mobile spawn may override the mission entry.
- When the final clone is spent, the mission ends immediately as a loss and no further reprint occurs.
- A one-life complication clamps the commitment to one clone.
- The runtime records committed, remaining, spent, elapsed time, detections, civilians lost, optional loot, and ghost status.
- Campaign policy defaults to permanent loss of spent clones. The policy is explicit data so balance can switch to retry-next-window later without rewriting the runtime.

## Compact Indoor Maps

The existing stencil pipeline remains authoritative. Science sites extend it with oriented thin-wall and thin-door stencil characters. Existing `#`, `M`, `S`, and `D` behavior is unchanged on battle maps.

Thin walls occupy a narrow slab through a tile instead of the full 3×3 tile. Collision and shot blocking use the same oriented slab profile as rendering, so the player sees the space they can actually occupy. Thin doors are single, correctly oriented slabs that slide to a jamb when open. Bot navigation may treat the wall's center tile as blocked; room floors and door cells remain the legal graph, preserving deterministic pathfinding.

Each site profile supplies a procedural stencil, objective sockets, guard posts, civilian sockets, extraction, and optional vehicle route. Site grammar changes the play:

- clone vault and buried archive use secure nested rooms;
- research annex, comms relay, and field hospital use office/lab rooms;
- rail yard, foundry, and airfield mix open service lanes with compact interiors;
- officer villa is always a furnished two-storey mansion with a real upper floor and stair/ladder traversal;
- quarantine zone uses the third-party zombie substrate.

All maps are bounded to a small mission pocket, keep spawn-to-objective routes connected, expose at least two viable approaches, and guarantee every required objective is reachable.

## Alarm, Guards, Pedestrians, and Complications

The runtime reads the shipped perception system. A hostile eye seeing the player raises the alarm once and records detection; gunfire can also break stealth. Alarm state changes guard goals and can trigger a reinforcement beat. Infiltrate fails its unseen clause when detected but remains completable unless a no-kill or one-life clause explicitly fails the run.

Guards are ordinary War World bots with ordinary classes and weapons. Named officers are tagged bots, not bespoke actors. Civilian/captive pedestrians reuse the scientist rig and follower brain with mission-specific names and health. Quarantine and third-party complications opt into the existing outbreak/horde actors. God-on-guard uses the existing LSW request/spawn seam only where the selected pass permits it.

Scripted beats are deterministic thresholds—briefing, perimeter breach, alarm, objective phase changes, reinforcement, extraction unlocked—not timeline-only cutscenes. Control never leaves the player.

## Campaign and Rewards

Each front receives two science windows per pass. Starting a campaign science mission spends one window; abandoning or failing still consumes it. A pass change replenishes that front's windows. Free-play missions do not touch campaign state.

The first production reward set contains real effects on watched values, not flavor-only unlocks: front clones, theater clone reserve, enemy clones, next-battle clone insurance, front control, morale, opening materiel, requisition discount, enemy reinforcement denial, weather choice, roster intel, and LSW assignment/denial flags. The generator only draws rewards with an implemented campaign adapter. Reward data is typed and extensible to the full fifty-effect catalog without changing mission runtime APIs.

Mission completion applies the reward, clone spend, ghost bonus, and dispatch in one pure campaign transaction. Failure applies clone spend and consumes the window but grants no reward.

## Courier and After-Action Data

`PressIssue` gains an optional science-operation block rather than a second newspaper store. A science edition names the operation, verb, site, result, clone bill, alarm/ghost status, and reward. The existing archive, corrections desk, storage limit, and rendering path continue to work for battle and science issues.

The match tracker continues to record combat. The science runtime adds an objective summary to the closing panel. Campaign mutation and newspaper filing occur once when the mode first reaches `over`, guarded against duplicate animation frames.

## Player Interface

- Free play exposes a Science Missions card.
- The Scar shows a Science Window action for the selected front, remaining windows, and the generated briefing.
- A focused modal/panel selects 1–8 committed clones; the one-life complication locks it to one.
- During play, a compact mission card shows operation, current objective, clone pips, alarm state, optional-progress count, and extraction state.
- Context hints use the existing HUD interaction rail and `E` language.
- The closing panel shows outcome, clone cost, ghost bonus, reward, and the Courier edition.

## Failure and Recovery

- Invalid mission specs are rejected before world creation with a descriptive error.
- An unreachable generated layout retries with the next deterministic sub-seed up to a fixed bound, then falls back to a known-valid site stencil.
- Missing optional actors downgrade the complication, never the base mission.
- The mission transaction is idempotent; reloads cannot double-spend windows, clones, or rewards.
- Existing modes and existing building stencils remain byte-compatible unless science mode is selected.

## Verification

Automated tests cover deterministic generation; all verb/site compilation; thin-wall movement, sight, bullets, and door state; map reachability; guaranteed two-storey villa traversal; objective transitions; alarms; civilians; clone decrement and last-clone failure; instant beacon reprint; campaign windows and idempotent outcome application; rewards; and science newspaper copy.

Visual verification uses the Building Lab for thin-wall sites and the in-game `window.__ww` harness for a villa mission, a stealth mission, and a clone exhaustion/reprint sequence. Completion requires all four repository gates:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```
