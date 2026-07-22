# Military Operations Rotorcraft — Design

**Date:** 2026-07-21  
**Status:** Shipped and production-verified
**Depends on:** Vehicle Theater Foundation

## Purpose

Military Operations need helicopters that do jobs fixed-wing aircraft and the
legacy Kestrel flyer cannot do: remain over a ground fight, mask behind a city
or ridge, and deliver troops to a landing zone. This release adds an explicit
attack helicopter and transport helicopter while preserving every existing
vehicle kind and save/network identifier.

## Approaches Considered

1. **Recommended: add two explicit rotorcraft kinds.** Keep `flyer` as the
   lightweight Kestrel sci-fi gunship and add purpose-built attack and transport
   helicopters. This is compatible, gives each mission role a readable hull,
   and avoids changing old manifests.
2. Rebrand `flyer` as the attack helicopter and add only a transport. This is
   smaller, but silently changes an established hull and leaves old screenshots,
   inventories, and balance expectations misleading.
3. Add one configurable helicopter hull. This reduces model work but makes
   manifest roles, AI behavior, silhouettes, and balance depend on hidden
   loadout state.

The first approach is selected.

## Airframes

### Shrike Attack Helicopter

- Kind: `attackheli`; display name: **Shrike Attack Helicopter**.
- Role: close air support and low-altitude anti-armor ambush.
- Crew: pilot plus gunner; no passengers or mobile spawn.
- Flight: hover-capable rotorcraft, 3-second spool, maximum elevation Sky.
- Armament: Hydra rocket pod as primary and a lighter chin cannon as secondary.
  Rockets threaten armor but do not match a Vulture's one-pass burst; the cannon
  handles infantry and light vehicles.
- Survivability: tougher than the Kestrel, much weaker than a tank, vulnerable
  to MANPADS and Lance AA. Building-level flight trades concealment for collision
  risk; Sky clears roofs; it cannot enter Clouds.
- Economy: cost 3, making a lost Shrike as meaningful as a jet.

### Condor Transport Helicopter

- Kind: `transportheli`; display name: **Condor Transport Helicopter**.
- Role: airborne insertion, extraction, and forward reinforcement.
- Crew: pilot, door gunner, sensors, and comms, plus five passengers (nine seats).
- Flight: hover-capable rotorcraft, 4-second spool, maximum elevation Sky.
- Armament: gunner-operated door gun. The pilot flies; a staffed gunner owns the
  trigger under the existing crew-station law.
- Survivability: 260 hull points, slower and wider than the Shrike. It is a
  mobile spawn only while landed at Ground with working comms; airborne spawning
  is forbidden.
- Economy: cost 4 because it can reposition a team and a lost insertion craft
  should matter to the national purse.

## Controls and Elevation

The shared four-level model remains authoritative:

- Ground: parked/landed; passengers can enter and exit; Condor mobile spawn is active.
- Building: low masked flight; tall structures collide with the hull.
- Sky: safe transit above ordinary roofs; maximum rotorcraft level.
- Clouds: fixed-wing only.

Q climbs and E descends exactly as current aircraft do. E at Ground exits.
Rotorcraft have no minimum airspeed and can hold position. Both use flare and AA
rules already shared by aircraft. Renderer height, HUD labels, snapshots, and
network state continue to consume `Vehicle.band` without a parallel altitude.

## Maps, Pads, and Mission Use

City, Countryside, Mountain, Coastal, and Desert receive helipads positioned
outside stamped structures. Ocean does not receive a default rotorcraft pad;
carrier operations remain a later surface-fleet feature. Theaters keep their
authored air routes and landing zones:

- Shrike AI follows air routes with a `support` profile, descending to Building
  only when the look-ahead volume is clear and climbing around structures.
- Condor AI follows an `insertion` profile to a side-compatible landing zone,
  descends to Ground inside the zone, and records landing/objective completion.
- `airborne_insertion` accepts and prefers Condors; close-air-support manifests
  accept Shrikes. Both kinds belong to `AIR_KINDS`.

Classic generated maps gain one pad for each new airframe on the existing south
flight line. Rotorcraft use open helipads rather than fixed-wing hangars.

## Procedural Models

Both models face +X and use the existing faction body palettes and team trim.

- Shrike: narrow tandem canopy, short weapons wings, paired rocket pods, chin
  turret, tail boom, and a broad coaxial rotor silhouette.
- Condor: long cabin, tandem fore/aft rotors, side sponsons, door-gun turret,
  and a high tail. Its larger planform must read immediately at command zoom.

Each exposes `turret`, `gunRecoil`, `rotorL`, and `rotorR`; the renderer spins
both named rotors. Models remain below 1,500 triangles and within the visual
extent law. No new asset format or loader is introduced.

## AI, Telemetry, and Acceptance

The scenario runner adds deterministic Shrike-vs-armor and Condor insertion
probes across ten seeds. Acceptance requires:

- both rotorcraft definitions cap at Sky and remain stationary without a pilot;
- Shrike obtains contact and damages an armored target in each compatible theater;
- Condor reaches a compatible LZ, lands, and records a landing/route completion;
- no non-finite positions, persistent stalls, wrong-surface incidents, or
  building crashes during the accepted insertion runs;
- Condor mobile spawn is false while airborne and true when landed, crewed, and
  comms are alive;
- all named model parts exist, models fit collision scale, and triangle budgets pass;
- typecheck, full tests, lint, and production build pass.

## Scope Boundary

This release does not add ropes, player-controlled cargo loading, carrier decks,
or submarine depth. The next release adds the submarine and expands naval
scenarios on the already-authored deep routes. The overall Military Operations
goal stays active until that release and the final browser/gate pass are done.
