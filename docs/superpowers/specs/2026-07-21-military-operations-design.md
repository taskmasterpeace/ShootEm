# Military Operations production design

## Goal

Ship Military Operations as a complete play loop: select a generated mission from the Scar, purchase a vehicle manifest, fight the objective on a mission-shaped map, and fold losses and rewards back into the persistent war. The feature covers small military skirmishes and standard/large combined-arms Operations while preserving deterministic simulation and offline play.

## Product decisions

- Strategic consequences persist for the current season and reset at armistice.
- Every front receives one Operation window per pass. Completing or failing it consumes that window; escalating the front opens the next pass's window.
- A destroyed committed hull is removed from the national motor pool. Unlost hulls return after the battle.
- Facilities persist for the season. Their effects apply to later Operations.
- Pass 1 favors single-domain missions, Pass 2 unlocks combined-arms signatures, and Pass 3 favors denial and control.
- The Pike is the only playable naval hull in this release. Carriers and submarines are strategic modifiers/sites. The existing flyer represents the helicopter/gunship role.

## Approaches considered

### Recommended: one Operation contract across two map scales

A pure deterministic generator produces an `OperationPlan`. Small skirmishes and large Operations consume the same plan, objective vocabulary, manifest rules, persistence, and after-action settlement. Map construction differs by scale: small missions extend the procedural skirmish builder; large missions dress the authored front grounds.

This avoids two mission systems drifting apart, reuses mature lawful maps, and lets every rule be tested without the renderer.

### Alternative: one new mode per verb

Fifteen independent game modes would be direct but duplicate timers, win conditions, HUD wiring, serialization, and tests. Combined-arms sequences would become brittle mode switching.

### Alternative: data-only mission cards over existing modes

This is inexpensive but would not make the verbs mechanically true. A Spearhead that is merely labeled Conquest is not a production-ready Operation.

## Architecture

### Pure mission domain

`src/sim/operations.ts` owns typed catalogs and deterministic generation:

- 15 verbs, 3 domains, 10 sites, 7 complications, 50 effects, and 4 combined-arms signatures
- compatibility rules between verbs, sites, domains, and complications
- pass-aware weighting and deterministic briefing text/codenames
- objective phases, stakes, manifest requirements, launch cost, and reward selection
- manifest pricing, commitment rating, validation, and Fiscal Efficiency scoring

The generator accepts only serializable inputs (`seed`, front, pass, campaign modifiers) and returns a serializable `OperationPlan`. It never reads DOM, storage, or wall-clock time.

### Map layer

`src/sim/operation-map.ts` converts an `OperationPlan` into lawful ground.

- `skirmish` scale extends `generateSkirmishMap` with a site profile, appropriate control markers, domain-specific pads, and objective props.
- `standard` and `large` scales start from the authored front associated with the site, then clone and dress it with phase markers, manifest pads, convoy routes, landing zones, defended targets, or capture areas.
- Site mapping uses all ten military sites. Each generated map keeps sealed rims, connected walkable ground, enterable buildings, deterministic output, and honest water/air access.
- `GameMap` gains optional serializable Operation objective metadata. Existing modes ignore it.

### Runtime objective layer

`src/sim/operation-runtime.ts` is a deterministic state machine attached to `World` only when `WorldOptions.operation` is present.

- Phases are ordered for combined arms and independent for parallel objectives.
- Objective adapters observe existing world facts: control occupancy, vehicle arrival, target destruction, survival timers, kills by domain, convoy survival, and friendly collateral.
- Each of the 15 verbs has explicit success/failure rules rather than a renamed stock mode.
- Complications alter the state machine: reinforcement clocks, scorched-earth deadline, protected civilians, restricted air cover, a defending LSW, weather, or critical-airframe survival.
- Runtime emits typed Operation events consumed by HUD, announcer, blackbox, tests, and after-action settlement.
- A mission ends exactly once. Replay and headless simulation remain deterministic.

### Campaign persistence

The campaign save migrates to a new schema without deleting v1 fields. It adds:

- national treasury and motor-pool hull records
- captured facilities and strategic modifiers
- one Operation-window state per front/pass
- doctrine/intel/control rewards
- Operation history and active staged Operation

Settlement is a pure transaction:

1. Verify that the result belongs to the staged Operation and has not already settled.
2. Consume the Operation window.
3. Remove destroyed committed hulls and return survivors.
4. Charge collateral and failure penalties.
5. Apply exactly one typed reward on success.
6. Move front control and write dispatch/newspaper facts.
7. Calculate clean sheet and Fiscal Efficiency.

Armistice replenishes the motor pool, clears facilities/modifiers/windows, and keeps career history.

### Vehicle records and command certification

Motor-pool hulls are serialized records with stable IDs, generated names, vehicle kind, kills by target vehicle kind, sorties, and status. Committed map vehicles carry their hull ID so kills and destruction settle against the correct record. The dossier stores Operation performance and Command Certification; certification is earned from completed Operations and Fiscal Efficiency, never a hidden toggle.

### UI and player flow

The Scar Map tab becomes the Operations board:

1. Select a front marker.
2. Review available Operation cards: briefing, domains, site, complication, reward, window, and launch cost.
3. Open a modal manifest editor. It shows motor-pool availability, required domains, treasury price, and Light/Balanced/Heavy commitment.
4. Stage the Operation and deploy. Invalid manifests explain the exact missing requirement.
5. In match, a compact objective panel shows current phase, next phase, timer, and complication warning.
6. The after-action panel itemizes objectives, committed/returned/lost hulls, treasury movement, reward, clean sheet, and Fiscal Efficiency.

The interface follows the existing War World steel/amber visual language, responsive layout, keyboard focus, modal escape/close behavior, and clear disabled states. No new purple palette is introduced.

## Error handling and integrity

- Invalid or stale saved Operations are regenerated from their recorded seed or safely canceled with reserved hulls returned.
- Settlement is idempotent by Operation ID.
- Unknown catalog IDs fail closed during generation tests and migrate to safe defaults during save loading.
- Manifest reservations prevent the same named hull from entering two active Operations.
- Insufficient treasury, exhausted windows, missing domains, or unavailable hulls block launch before the World is created.
- Multiplayer wire payloads stay serializable; a server-authoritative Operation can be added without changing the plan schema.

## Testing and production evidence

- Catalog tests cover uniqueness, all 15 verbs, all 10 sites, all 7 complications, all 50 effects, compatibility, and briefing legibility.
- Property-style seed matrices prove deterministic plans and lawful maps at both scales.
- Runtime tests prove success and failure for every verb and complication, phase ordering, idempotent completion, and byte-stable behavior when no Operation is active.
- Campaign tests prove migration, window consumption, motor-pool loss/return, facility persistence, reward application, armistice reset, and idempotent settlement.
- UI tests cover card rendering, manifest validation, staging, objective display, and after-action facts.
- Full repository gates must pass: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.
- A live browser smoke test must stage, launch, complete, and settle at least one land skirmish and one combined sea/air/land Operation with no console errors.

## Scope boundary

This release does not invent submarine or carrier vehicle physics, network matchmaking, AI Secretary elections, or new 3D hull assets. It does ship their strategic site/effect hooks where specified. Those exclusions do not reduce the playable Operations loop: land, air, sea, combined-arms sequencing, persistent materiel stakes, facilities, and campaign settlement are all functional with the shipped fleet.
