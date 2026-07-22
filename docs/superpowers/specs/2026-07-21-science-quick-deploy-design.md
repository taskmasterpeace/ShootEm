# Science Mission Quick Deploy Cards Design

**Date:** 2026-07-21
**Branch:** `codex/science-missions`

## Goal

Put several immediately playable Science Missions on the main Deploy menu so a
tester can enter a representative operation with one click and without knowing
the generator, campaign map, clone economy, or mission vocabulary.

## Recommended Experience

Add an always-visible **SCIENCE MISSIONS · QUICK DEPLOY** section directly below
the ordinary game-mode cards. It contains five semantic button cards:

1. **K9 House Clear** — Hunt in an officer villa; Infantry handler, eight prints,
   no complication. Exercises the dog, rooms, doors, glass, and upper floors.
2. **Researcher Rescue** — Rescue in a research annex; Medic, eight prints, no
   complication. Exercises captives, escorting, interiors, and extraction.
3. **Clone Vault Raid** — Raid a clone vault; Engineer, eight prints, alarm net.
   Exercises several objective interactions and reinforcements.
4. **Quarantine Sweep** — Deny a quarantine zone; Heavy, eight prints, third
   party. Exercises demolition points, zombies, and crossfire.
5. **Airfield Ambush** — Ambush an enemy airfield; Heavy, eight prints, no
   complication. Exercises the moving convoy, vehicles, exterior/interior flow,
   and extraction.

Each card shows its verb, site, recommended class, and two or three tactical
tags. Clicking anywhere on a card immediately starts that exact operation.

## Architecture

Create `src/client/science-presets.ts` as the single catalog. Each preset owns a
stable ID, icon, title, description, class, seed, and the typed
`ScienceMissionOptions` used by the existing `prepareScienceMission` path. A
pure `prepareSciencePreset` helper returns a normal `ScienceLaunchState`; it
does not add a second mission system.

`main.ts` renders the catalog into a dedicated container. A click:

1. selects Science mode;
2. applies the preset's class and theme;
3. resets custom weapon picks to the selected class's issue kit;
4. queues the prepared free-play launch with eight prints;
5. clears campaign/front context; and
6. calls the existing `startGame()` path.

These are consequence-free free-play launches. They do not spend Scar windows
or modify a campaign. Mission completion continues through the existing Science
runtime, debrief, and newspaper code.

## Presentation

The section uses the existing War World amber/steel visual language with a
slightly richer card hierarchy: icon tile, operation name, short briefing,
class label, and compact capability tags. Cards are real `<button>` elements,
at least 44px tall, keyboard-focusable, responsive, hoverable, and compliant
with reduced-motion settings. The section is visible without first selecting
the generic Science Mission mode.

## Failure and Re-entry

The normal `running` guard prevents double launch. If a mission ends, the
existing page-reset path returns to the menu with all five cards available.
There is no persistence, unlock, or campaign cost attached to quick deploy.

## Verification

- Unit tests pin catalog uniqueness, exact preset composition, eight-print
  stock, consequence-free launches, and determinism.
- Presentation tests pin semantic card markup and all five preset IDs.
- Browser verification clicks at least the K9 House Clear and one non-K9 card,
  confirms the expected mission title/site/class in live state, checks layout,
  and reports console errors.
- Required repository gates remain TypeScript, full Vitest, ESLint, and build.

## Scope Boundary

This is a curated quick-deploy shelf, not a mission editor, unlock tree, or
campaign operation browser. The generic random Science Mission card and the
Scar's strategic Science windows remain available unchanged.
