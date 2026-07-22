# K9 Building-Clear Commands Design

**Date:** 2026-07-21  
**Status:** Approved for production  
**Branch:** `codex/science-missions`

## Purpose

Turn the military working dog from a passive handler escort into an intentional
building-clear tool. A handler can aim at a building and issue `SIC`; the dog
uses scent rather than sight to find hostile occupants, enters through routes
that are already open, climbs stairs, clears reachable rooms and returns to
heel. `STAY` gives the handler an equally explicit way to stop pursuit.

The fantasy is simple: arrive at a house with a dog, point at it, let the dog
find the person hiding inside, and follow the dog through the building.

## Player Commands

Two handler-only HUD controls appear when the local soldier owns the team's K9:

- **SIC** assigns the building under the cursor. Keyboard `K`; gamepad L3.
- **STAY / HEEL** is one toggle. The first press orders the dog to hold its
  current point; the next press recalls it to heel. Keyboard `L`; gamepad R3.

The controls show the live order (`HEEL`, `CLEARING`, `WAITING AT DOOR`, or
`STAY`) and are disabled while the dog or handler is unavailable. Commands are
one-shot `PlayerCmd` inputs and are judged by the authoritative simulation.
Old clients and recorded commands remain valid because the new field is
optional.

`SIC` uses the existing aim yaw and cursor distance to reconstruct the ordered
world point. The simulation accepts the house whose footprint contains that
point, or the nearest footprint within eight world units. If there is no
building, the previous order remains intact and the handler receives a small
`NO BUILDING AT MARK` notice.

## Dog Order State

The dog owns replicated, optional order state:

- mode: `heel | sic | stay`
- ordered building index and ordered world point
- stay anchor
- current hostile target
- current blocked-door index and bark cooldown
- timestamp used to confirm that a building is clear

The handler is the only soldier allowed to mutate the order. Death clears the
active sweep: a surviving dog holds while its handler is down, and both return
to `heel` after redeployment. A team can still own only one dog.

## SIC: Building Sweep

The selected building bounds define the search scope across every supported
floor. Within those bounds the dog detects every living hostile human or bot,
including crouched, dark, out-of-line-of-sight, and cloaked occupants. This is
the same deliberate target knowledge used by zombie pursuit, but it is scoped
to the ordered building instead of becoming a global wallhack.

The dog selects the nearest reachable hostile, paths to the hostile's actual
floor, and attacks with the existing bite and drag behavior. Target selection
is refreshed when the target dies, leaves the building, or becomes unreachable.
The dog may use any aligned stair transition. Ladder transitions are never
eligible.

The handler's team is not given the target immediately. The normal K9 nose
radius controls `pinged` intel. Once the dog gets close enough to smell the
occupant, it marks that occupant and uses the existing bark/announcement
channel. This keeps `SIC` useful without revealing an entire building from the
street.

If no hostile remains in the assigned building for two continuous seconds, the
dog emits one `BUILDING CLEAR` acknowledgement and returns to heel.

## Doors, Glass, and Route Boundaries

Dogs have no hands and receive no breaching behavior:

- They never call the door-toggle function.
- They never damage a closed door.
- A closed normal or thin door stops the dog at the approach side.
- The dog enters a `WAITING AT DOOR` state and barks at a rate-limited cadence.
- When a handler or teammate opens that door, the original sweep resumes
  automatically.
- Intact glass remains blocked and the dog never breaks it.
- An already-open doorway, existing breach, or valid open passage is usable.
- Stairs are usable; ladders remain forbidden.

The route planner may continue to treat a door as a potential route so the dog
can reach its approach tile, but the K9 movement layer must explicitly stop at
the closed leaf. That distinction prevents both magical door traversal and a
planner that gives up outside the building.

## STAY and HEEL

`STAY` stores the dog's current position as an anchor and cancels its active
building sweep. While staying, the dog:

- ignores scent trails and distant enemies;
- does not chase;
- may bite a hostile already within bite reach;
- corrects small displacement back toward the anchor after a shove;
- remains on the current floor.

Pressing the same control again changes the order to `HEEL`. `SIC` can also
replace `STAY` directly. Heel behavior remains the shipped handler-following
behavior.

## Presentation and Feedback

The two compact K9 controls sit near the existing ability hint rather than in a
modal. They inherit the game's amber tactical language, include hover/focus and
pressed states, and remain large enough for touch. Status feedback is concise:

- `K9 · CLEARING <BUILDING>`
- `K9 · WAITING — OPEN THE DOOR`
- `K9 · STAY`
- `K9 · HEEL`
- `NO BUILDING AT MARK`

The dog's world marker changes by order: forward chevron for `SIC`, square hold
marker for `STAY`, and no extra marker for ordinary heel. Existing nameplate,
health, bark audio, and team coloring remain unchanged.

## Server Authority and Replication

The client sends only intent. The simulation validates ownership, dog/handler
life state, finite aim data, map bounds, and building selection. It chooses
targets, paths, door waiting, bites, clear completion, and order transitions.
Snapshots replicate the small K9 order state so remote clients render the same
status and reconnecting clients recover it. No client may nominate an enemy ID.

## Verification

Test-first coverage must prove:

1. Only the owner can issue K9 commands, and invalid/no-building orders are
   rejected without destroying the previous order.
2. `SIC` detects a hidden or cloaked hostile inside the aimed building without
   selecting an equally close hostile outside it.
3. A dog clears ground, Level 2, and Level 3 occupants using stairs.
4. A ladder-only occupant is unreachable and never causes a ladder transition.
5. A closed normal or thin door is never toggled or damaged; the dog waits,
   then resumes after a human opens it.
6. Intact glass is never broken by the dog.
7. `STAY` cancels pursuit, holds its anchor, permits an in-reach bite, and the
   second press recalls to heel.
8. Target intel appears only inside the existing nose radius.
9. The order survives snapshot round-trip and optional fields preserve old
   command compatibility.
10. HUD buttons, keyboard commands, and gamepad commands produce the intended
    one-shot command state and are visible only to the owning handler.
11. An in-app browser playtest clears a generated three-storey building,
    demonstrates the closed-door wait, and exercises Stay/Heel with no console
    warnings.
12. TypeScript, the entire Vitest suite, ESLint, and the production build pass.

## Non-Goals

- Dogs do not open, close, bash, or unlock doors.
- Dogs do not break windows or vault intact window frames.
- Dogs do not use ladders.
- `SIC` does not reveal every enemy to the team from arbitrary range.
- This slice does not add dog inventory, direct possession, skill trees, or
  multiple dogs per team.
