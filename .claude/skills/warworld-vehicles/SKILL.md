---
name: warworld-vehicles
description: Use when adding, tuning, or debugging ANY War World vehicle — a new hull, seats/crew stations, subsystem damage, spawning pads, jets/bands/afterburner, hangars, wheels/rotors animation, or the hull model. Covers the VEHICLES def table, buildVehicle named-part contract, the pad economy, flight laws, and verification. Read BEFORE touching src/sim/data.ts VEHICLES or src/client/models/vehicles.ts.
---

# War World Vehicles — a def, a hull, a pad, and five ways to break

A vehicle is a `VehicleDef` in `src/sim/data.ts` VEHICLES (17 kinds,
union in `src/sim/types.ts` VehicleKind), stepped by `stepVehicle` in
`src/sim/world.ts`, drawn by `buildVehicle(kind, team)` in
`src/client/models/vehicles.ts`. Anchor code refs by SYMBOL — world.ts
drifts daily.

## The def (fields that carry law)

- `hp` hull + `systemHp` per-subsystem (~10% of hull — systems break
  DURING fights). Five systems: engine/weapon/sensors/ecm/comms.
  **Damage splits 65% hull / 35% ONE random system** (`damageVehicle`);
  overflow past a system's last point is EATEN; a dead system passes its
  share to the hull. Codex restates it as `HULL_SHARE = 0.65` and
  simulates `hitsToKill` (201 trials, fixed LCG) — `tests/codex.test.ts`.
- `seats` layout is LAW: `[0]` driver, then `crew[]` stations in order,
  then passengers (`crewAt()`). Gunner overrides the driver's trigger;
  sensors = 28u ping ring; ecm = 14u jam bubble; comms gates
  `mobileSpawn` (counts only alive + comms > 0 + any seat crewed).
- `weapon: ''` = unarmed. Mounted guns fire through `World.launch()` at
  muzzle `radius+0.8`, y 1.8. `altWeapon` (J1) = right-mouse mount with
  its own clock (Vulture belly MG); the bomber's alt is the Cradle nuke.
- `cost` = requisition value: a wreck bills `warLedger[team].hulls += cost`
  (`tests/warledger.test.ts`). Respawn 22s on its pad; occupants ejected
  at 70 damage each. Direct projectile hits need `p.pos.y < 3`.
- Movement flags: `hover` (water), `flies` (over walls), `boat`
  (water ONLY), `digs`, `strider`, `immobile`, `slip` (hoverboard drift),
  `healRadius/healRate` (ambulance).

## Flight law (jets earn the sky)

- `liftoffTime` spools on boarding seat 0; spooling hulls can't move.
- `minAirspeed` = the stall floor, but ONLY when flown:
  `flown = seats[0] >= 0 && time >= spoolUntil` (stepVehicle). The A1
  airfield fix (b7730bd) — an unconditional floor had every uncrewed jet
  self-taxiing at stall speed forever. Old screenshots of drifted jets are
  that bug. `tests/airfield.test.ts` pins "parked jets hold still".
- **Bands, not altitude** (J1, c652814): discrete `v.band` 0–3. Q climbs,
  E dives, E at band 0 is the DOOR; jets cap 3, rotors 2; uncrewed = 0.
  Afterburner: sprint = ×1.4 thrust off pilot energy, `burnerOn` for the
  renderer flame. `tests/airwar.test.ts`.
- **airScaled**: SAMs and anything a `flies` hull fires scale by
  `vehicleSpeedMul`, NOT `projectileSpeedMul` (client ships 0.35) — before
  this a Vulture outran its own rockets and no SAM could close. SAM speeds
  are DERIVED (`SAM_SPEED_RATIO` 0.92 × prey speed): the missile must
  always lose a drag race. Never hardcode an AA speed.
- Flight tests MUST kill the map's AA first (`noAutoAA` pattern,
  tests/flight.test.ts) or your "hovering" flyer is a frozen corpse.

## Spawning & the pad economy

- Pads: `padKinds` + `padOffsets` in `generateMap` (src/sim/map.ts),
  `clearArea` r=3 (aircraft r=4). World boot walks `map.vehiclePads` →
  `spawnVehicle`. **THE LAST-STAMP-WINS TRAP** (paid twice): the base
  compound stamps LAST — a pad placed where buildings stamp later spawns
  the hull inside a wall. The whole airfield lives on the south flank at
  lateral 15–25 for this reason. New pad = stay clear of the compound.
- Hangars are PROPS (`type: 'hangar'`), paint not architecture — no grid
  stamps, mouths toward the front, and they wrap the TAIL so the nose
  reads at zoom (bomber ×1.35). `tests/airfield.test.ts`.
- Crewless live hulls run `stepRequisition`: RECOVERY (home < 6u),
  WRITE-OFF (≥180s abandoned + >25u out — struck, pad frees, ledger NOT
  billed), HOTWIRE (≥90s + enemy human holds E 6s, engineers 3s).
- LSWs are refused at the door (`tryEnterVehicle` — "a turret with wheels").

## The hull model contract

- One `buildVehicle` switch; hull faces +X; olive vs blue-steel palettes,
  team color as trim. NO PURPLE, EVER (tests/visual.test.ts sweeps all).
- **Named parts** (animator finds by `getObjectByName`): `turret` +
  `gunRecoil` for anything that shoots; kind-specific: `rotorL/rotorR`,
  `thrustL/thrustR`, `spin` (radar), `bay`, `drill`, `pulse`, `healRing`,
  `legL/legR`, `rider` (bike ONLY — the hoverboard carries NO rider proxy;
  the renderer surf-poses the REAL soldier mesh, a proxy = two riders).
- Wheeled kinds push axle groups into `g.userData.wheels` (buggy, apc,
  bike, transport, ambulance — test-checked non-empty). Ground-ring
  overlays set `userData.aura = true` so size tests ignore them.
- **Enrollment**: a new kind MUST be added to `VEHICLE_PARTS` in
  tests/visual.test.ts or the suite fails. Mesh extent must be 0.45×–3.2×
  `VEHICLES[kind].radius`, < 1500 tris. Aircraft: "planform is the read
  at command zoom" — design the top-down silhouette first.
- Renderer hooks read the names: rotors wind to blur, wheels roll, jets
  roll into turns via `bankAngle` (rotation.order 'YXZ'), `burnerOn`
  scales the flame, dead systems trail smoke, hulls < 35% burn.

## Workflow (never skip 5–7)

1. Def in data.ts VEHICLES + `VehicleKind` union; pick seats/crew/cost;
   any new mounted weapon id must EXIST in WEAPONS (codex names it if not).
2. Hull in models/vehicles.ts with named parts; enroll in `VEHICLE_PARTS`.
3. Pad: add to `padKinds`/`padOffsets` — respect the last-stamp trap.
4. `npx tsc --noEmit` → `npx vitest run` (visual, flight, airfield,
   airwar, antiair, armour-ladder, requisition, codex at minimum).
5. **Harness**: `/harness.html` ▸ Stage tab — bbox/joints/parts overlays,
   team toggle; `/props.html` contact sheet for scale against the world.
6. **Codex bench**: menu ▸ Codex turntables every hull on the game's own
   light rig — a throwing constructor shows "Model unavailable".
7. **In game** via `window.__ww`: board it, fire it, wreck it — check
   HUD system pips, smoke, respawn on the pad. Hidden tabs freeze RAF:
   drive `world.step` + `renderer.update` manually or use Playwright
   (visible tab, CTF not TDM — TDM ends under you).
