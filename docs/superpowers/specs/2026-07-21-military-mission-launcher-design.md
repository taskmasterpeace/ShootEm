# Military Missions launcher design

**Date:** 2026-07-21  
**Status:** Approved concept; written-spec review pending

## Goal

Put one unmistakable **MILITARY MISSIONS** card on the normal Deploy screen. It opens a six-theater launch board so a player can immediately run real Operation objectives in City, Desert, Countryside, Mountain, Coastal, or Ocean without waiting for a Living Campaign window. These launches are field exercises: they use the production Operation runtime, theater maps, AI, radar, vehicles, objectives, and after-action result, but never spend campaign treasury or risk the persistent named motor pool.

## Player flow

1. The Game Mode grid gains one amber/steel `MILITARY MISSIONS` card using the existing selectable-card grammar.
2. Activating it opens a modal launch board. The ordinary Deploy screen remains visible behind the modal and retains callsign, class, loadout, difficulty, bot count, and speed settings.
3. The board presents exactly six mission cards:
   - **Iron Meridian — Urban Assault**: City, 600×600u, capture and defend the rail hub with armor and rotor support.
   - **Sirocco Reach — Air Superiority**: Desert, 900×900u, clear the sky and seize the airfield with fixed-wing aircraft and armor.
   - **Green March — Convoy Interdiction**: Countryside, 900×900u, intercept the hostile column and secure its route with ground/air forces.
   - **Crown Divide — Pass Assault**: Mountain, 600×900u, land beyond the ridge and take the high pass through radar-masking terrain.
   - **Breaker Coast — Beachhead**: Coastal, 900×600u, land forces from sea/air and capture the shore strongpoint.
   - **Pelagic Expanse — Naval Hunt**: Ocean, 900×900u, hunt surface/submerged contacts and hold the air above the channel.
4. Every card states dimensions, domains, mission phases, and its issued vehicle package. One click selects the sortie and closes the modal. The main CTA becomes `DEPLOY MISSION` and the selected mission summary remains visible.
5. Deploy launches a normal local playable match. On completion, the AAR reports mission success/failure and objective progress, then returns to the menu. No campaign state changes.

## Architecture

### Pure mission catalog

Create `src/sim/military-missions.ts` with a serializable `MilitaryMissionPreset` catalog and a pure `createMilitaryMissionLaunch(id)` function. A launch contains:

- a typed `OperationPlan` with fixed site, verb, domains, phases, complication, and effect;
- a small exercise-only `OperationHull[]` inventory with named issued hulls;
- a legal `OperationManifest` selecting that package;
- the target `TheaterId`, seed, and launch mode.

The catalog owns the six curated identities and fixed seeds. It does not read DOM, local storage, campaign state, or wall-clock time. `theaterForOperation(plan)` must resolve to the card’s declared theater, and `validateManifest()` must accept every package.

### Launch-board presenter

Create `src/client/military-missions-ui.ts` with pure HTML presenters for the card and modal, plus escaping helpers. The board reuses current steel panels, amber selection borders, mono labels, domain chips, and modal behavior. It adds no new dependency or visual language. The modal is keyboard reachable, has a real heading, Close control, descriptive buttons, visible focus, and redundant text for every color-coded domain.

### Main-menu integration

`src/main.ts` owns a session-only `selectedMilitaryMissionId`. Selecting an ordinary game mode clears it. Selecting a military mission clears any campaign-front deployment intent for this launch but does not mutate or cancel a staged campaign Operation.

At local startup, launch precedence is:

1. selected Military Mission exercise;
2. staged campaign Operation for the selected front;
3. ordinary front or quick match.

The selected exercise supplies `operation`, `operationManifest`, and `operationInventory` to `World`, which already generates the correct vehicle-scale Operation map and runs the authoritative objective state machine. Campaign settlement, treasury, records, and named-hull loss paths remain guarded by the existing staged-campaign Operation object. An exercise gets only an ephemeral result summary.

### Playability laws

- All six launches use the production bot brain, radar/sonar, vehicle telemetry, four elevation levels, and Operation runtime.
- Ocean starts soldiers on the authored west/east port islands, within reach of issued boat/submarine/aircraft pads; no forced auto-piloting or teleport.
- Mission launches are offline/local in this release. The optional multiplayer address is ignored for an exercise and the board says `LOCAL FIELD EXERCISE`.
- Existing normal modes, environments, campaign Operations, saved campaign state, and server messages are unchanged when no exercise is selected.

## Failure handling

- Unknown preset ids fail closed to no selection and leave ordinary Deploy available.
- The board disables a preset if its manifest fails validation and prints the validation reason; production tests require zero disabled presets.
- Closing the modal changes nothing. Pressing Escape closes it. Reopening retains the current selection.
- If a staged campaign Operation exists, the board explains that the exercise does not cancel or consume it.

## Verification

### Automated

- Catalog test: exactly six ids, six theater ids, unique plan ids/seeds, and exact 600/900u geometry labels.
- Operation-law test: `theaterForOperation(plan)` equals the preset theater and every manifest passes `validateManifest()`.
- Runtime test: each preset constructs a `World` whose map has the intended theater id, Operation phases, issued hulls, radar-capable forces, and legal human spawn.
- Presenter test: six accessible mission buttons, domains/dimensions/phases, selected state, campaign-safety copy, and escaped content.
- Existing Operation, theater, radar, HUD, menu, campaign, network, and snapshot suites remain green.

### Browser

- Open the Military Missions card from the normal Deploy screen.
- Select and deploy each of the six cards in turn; verify the expected theater id/name, dimensions, objective HUD, issued vehicles, minimap/radar, and playable spawn.
- Fly/drive/dive at least one issued vehicle in the Desert, Coastal, and Ocean sorties.
- Verify modal focus/close behavior, responsive layout, no horizontal overflow, and zero console errors/warnings.

### Production gates

`npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build` must all exit zero before completion.

## Scope boundaries

This release does not add a seventh theater, procedural mission editing, multiplayer Operation authority, campaign rewards for exercises, persistent exercise progression, new vehicles, or new objective kinds. It exposes the six completed theaters through a trustworthy playable mission door using systems that already ship.
