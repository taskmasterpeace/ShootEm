# Military Operations Submarine — Design

**Date:** 2026-07-21  
**Status:** Shipped and production-verified
**Depends on:** Vehicle Theater Foundation and Military Rotorcraft

## Purpose

The Pike already supplies fast surface gunboat combat. The missing naval verb
is undersea hunting: a hull that owns the authored deep routes, disappears from
ordinary sight, and can only be fought with sonar and torpedoes while submerged.
This release adds that loop without treating ocean depth as a fifth air level.

## Approaches Considered

1. **Recommended: separate naval depth state.** Add `Surface | Submerged` to a
   purpose-built submarine. Elevation remains `Ground | Building | Sky | Clouds`.
   This keeps air targeting, HUD language, and collision laws coherent.
2. Reuse `Vehicle.band` with negative or overloaded values. This saves one field
   but makes altitude labels, snapshots, weapons, and rendering lie.
3. Make the submarine a cosmetic boat with stealth. This is cheap but provides
   no deep-water navigation, depth control, sonar counterplay, or distinct weapon law.

The first approach is selected.

## Barracuda Attack Submarine

- Kind: `submarine`; display name: **Barracuda Attack Submarine**.
- Role: blockade, convoy interdiction, and submarine picket.
- Crew: helm, weapons, sensors, and comms (four seats).
- Economy: cost 4; 320 hull points; 2.8-unit collision radius.
- Movement: 17u/s surfaced and 12.2u/s submerged. Surface movement accepts
  shallow or deep water. Submerged movement accepts deep water only.
- Weapon: guided heavy torpedo, 74u range, deliberate cadence, strong naval
  damage and modest splash. Torpedoes are the only ordnance that can damage a
  submerged hull. The Barracuda can fire surfaced or submerged.
- Control: Q toggles dive/surface with a 1.5-second debounce. A dive is rejected
  unless the entire hull is over deep water. Surfacing is always allowed.

## Sonar and Visibility

A submerged enemy is removed from enemy snapshots and the local renderer unless
detected by sonar. Detection is team-shared and deterministic:

- a friendly Barracuda within 65u detects it;
- a friendly vehicle with a living, staffed sensors station within 55u detects it;
- friendly submarines are always visible to their own team.

Detected contacts render with their normal team silhouette at submerged depth;
undetected contacts are absent rather than translucent client-side secrets.
Dead sensors do not detect. Surface submarines use ordinary sight and ECM rules.

## Maps and AI

Coastal and Ocean each stage one Barracuda per team on authored deep-water route
ends. No dry or shallow-only map receives a submarine pad. The existing Pike
continues to follow surface routes; Barracuda AI follows `deep` routes.

Submarine AI dives after leaving its pad, remains on deep anchors, searches with
sonar, fires torpedoes at detected enemy naval hulls, and surfaces only if its
route or damage state requires it. It never attempts a deep waypoint through
shallow water. Deep routes and deep pads remain map-authored and validator-enforced.

## Procedural Model and Presentation

The Barracuda faces +X and uses the established faction hull palette with team
trim. Its top-down read is a long teardrop pressure hull, sail, bow tubes, stern
planes, and a named spinning propeller. It exposes `turret` and `gunRecoil` for
weapon animation plus `propeller` for propulsion. It remains below 1,500 triangles
and inside the vehicle extent law.

The renderer eases the hull to -0.25u surfaced and -2.4u submerged. A friendly or
sonar-detected submerged hull keeps a restrained cyan/amber sonar ring; the ring
is marked as an aura and excluded from collision-scale tests. HUD text reports
`DEPTH SURFACE` or `DEPTH SUBMERGED` and the Q hint.

## Network, Telemetry, and Acceptance

`Vehicle.submerged` replicates through the existing whole-object snapshot. The
server performs sonar culling before serialization. Telemetry records dive,
surface, torpedo shot/hit/loss, wrong-depth, route completion, and non-finite
incidents.

Acceptance requires:

- a surfaced Barracuda moves on shallow/deep water and cannot enter land;
- a submerged Barracuda remains inside connected deep water and moves slower;
- ordinary gunboat fire cannot damage it submerged; torpedoes can;
- enemy snapshots hide it without sonar and reveal it with a staffed sensor;
- ten seeds across Coastal and Ocean complete deep-route submarine fights with
  contact, shots, hits, finite positions, and no wrong-depth incidents;
- Pike surface-route scenarios remain green;
- model parts, scale, triangle budget, typecheck, full tests, lint, build, and
  browser smoke all pass.

## Scope Boundary

This release does not add carriers, destroyers, minesweepers, or multi-depth
thermal layers. The Pike plus Barracuda form the first complete surface/deep
naval loop. Carrier decks and larger fleets can build on the same domain and
sonar laws later without changing this release's identifiers.
