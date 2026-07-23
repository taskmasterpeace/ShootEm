# AUDIT — VEHICLES, RACING & THE GARAGE

Scope: `src/sim/data.ts` (VEHICLES), `types.ts` (VehicleDef/Vehicle), `garage.ts`,
`client/garage-ui.ts`, `tracks.ts`, `courses.ts`, `boardtricks.ts`, `traffic.ts`,
`vehicle-telemetry.ts`, `client/records.ts`, `client/gonet/sports.ts`, `client/ghost.ts`,
`hullcollide.ts`, and the drivetrain/board/landing/roadkill/droppables in `world.ts`.
Read at the code level, 100% of the slice.

Status legend: ✅ WIRED · 🟡 PARTIAL · 👻 INVISIBLE (built but unreachable in play) · ⬜ UNBUILT

---

## A. VEHICLE DATA & PHYSICS MODEL

### A1 · The VEHICLES table — ✅ WIRED (`src/sim/data.ts:390`)
- **What it does:** 80 hull definitions in one `Record<VehicleKind, VehicleDef>`; 53 flagged `civilian: true`. Every hull carries hp/speed/turnRate/weapon/seats/radius plus the racing dials: `mass`, `grip`, `traction{ice,dirt,paved}`, `shock`, `slip`. The 9 race hulls the UI offers (`comet/vector/sprite` boards, `musclecar/roadster/hotrod` cars, `rallytruck/racetruck` trucks, `bike`) are all present and stat-differentiated.
- **What remains:** nothing structural; it is the spine of the whole system.

### A2 · VehicleDef / Vehicle types — ✅ WIRED (`src/sim/types.ts:296`, `:939`)
- **What it does:** `VehicleDef` (36 fields) is the static card; `Vehicle` is the live entity. Vehicle carries the racing state: `fit`, `fittedDef`, `airborneAt`, `trick`, `chargeHeld`, `civilianDrive`, `oiledUntil`, `mines`, `oil`, plus `band`/`vel.y` for the jump.
- **Open question:** none — but see A6 (no capacity field exists here).

### A3 · The traction profile (ice/dirt/paved) — ✅ WIRED (`world.ts:6104-6113`)
- **What it does:** the floor names its material family (`materialForSurface` → ice/paved/dirt), the card's `traction[family]` × `grip` becomes the `handling` multiplier on acceleration and lateral bite. Slicks-on-tarmac vs knobblies-on-dirt genuinely diverge. Oil temporarily forces the `ice` family (`oiledUntil`).
- **What remains:** solid.

### A4 · Mass / weight (heft) — ✅ WIRED (`world.ts:6093`, `hullcollide.ts`)
- **What it does:** `heft = clamp(pow(mass/1.6, 0.34), 0.8, 2.4)` divides accel and braking (heavy builds/loses speed slower) and widens the drift; mass also weights hull-vs-hull shove share.
- **What remains:** solid; this is the "give vehicles handling and weight" payoff.

### A5 · Shock strength & the landing — ✅ WIRED (`world.ts:6272-6305`)
- **What it does:** wheeled/surface hulls leave the ground over terrain steps (`airborneAt` set), gravity (−22) owns them, and the arrival is judged `force = mass × −vSpeed` against `def.shock`. Under → stick it; over → bounce + scrub + `crash` damage (clamped 120). A bike is a stunt, a laden truck is a wreck. This is the "land in a realistic way" system, and it is real.
- **What remains:** it fires against **map terrain steps**, but the *race circuit itself is flat* (see B2), so in racing it only triggers from mine-pitches (`world.ts:2905`), not ramps.

### A6 · CARGO CAPACITY — ⬜ UNBUILT (owner's belief CONFIRMED)
- **Finding:** there is **no cargo-capacity system anywhere.** `VehicleDef` has no `cargoCapacity`/`maxCargo`/`haulWeight`/`load` field (grep across `src/` for all such names returns zero). A pickup does **not** haul more than a sports car in any gameplay sense.
- The three things that *sound* like cargo are all something else:
  1. **Garage `CargoId[]`** (`garage.ts:23`) — a *loadout* of droppables/mods (mines/oil/armour/crusher), capped at 2 slots, identical for every road hull. Not a capacity.
  2. **Traffic `PayloadKind`** (`traffic.ts:36`) — narrative *wreck behaviour* (a tanker detonates, a food truck is morale). Not a capacity, not haulable.
  3. **`Vehicle.mines`/`.oil`** — droppable *counts* loaded from the garage cargo row.
- `seats` is the only per-hull "how much can it hold," and it holds *soldiers*, not freight (pickup 3, sportscar 2 — no meaningful haul gap).
- **Open question (real fork):** does the game want a true freight system (tonnage a truck moves and a sports car can't, feeding an economy/objective), or is the garage `CargoId` row the intended stand-in? Today it is neither — the concept is absent.

---

## B. THE GARAGE

### B1 · Garage fits: tyres / engines / chassis / cargo — ✅ WIRED (`src/sim/garage.ts`)
- **What it does:** 4 slots. `TIRES` rewrite the traction profile (slicks/all-terrain/knobblies/studs), `ENGINES` trade top-end vs launch, `CHASSIS` trade mass vs hp, `CARGO` (mines/oil/armour/crusher) adds mass. `fitted()` resolves the whole card; `accelRating()` prints a 1–10 number. Applied to the live hull once by `world.setFit` (`world.ts:2044`) → cached on `fittedDef`, so the hot path never recomputes. Loading `mines`/`oil` fills `v.mines`/`v.oil`.
- **What remains:** two dead spots — see B3, B4.

### B2 · Garage UI (the live card) — ✅ WIRED (`src/client/garage-ui.ts`, deploy screen `main.ts:323`)
- **What it does:** renders the 4 slots + a live-updating RDS-style card (traction bars, weight, top speed, accel, hull, shock). Fit is per-machine, account-level in `localStorage['ww_fits']`, survives prints. Shown on the deploy screen for road hulls only (`paintGarage` hides it for fliers/boats). The fit rides onto the grid via `setFit` at race start (`main.ts:1138`).
- **What remains:** solid.

### B3 · The Crusher Ram cargo — 👻 INVISIBLE (`garage.ts:86`)
- **Finding:** `crusher` is a buyable cargo item with ram flavour ("contact stops being an accident and becomes a plan"), but **no code ever reads `fit.cargo.includes('crusher')`.** It contributes only its 0.45 t mass. Roadkill (`world.ts:6320`) and hull-crash (`hullcollide.ts`) key off radius+mass, not a crusher flag — so fitting it gives you *less* performance for *no* ram bonus. (The `crusher` hits elsewhere are the LSW Ascendant of that name, unrelated.)
- **What remains:** wire a contact-damage/knockback multiplier when the nose-on hull carries `crusher`. `armour` by contrast IS wired (`garage.ts:103` → hp × 1.35).

### B4 · `fitLegal()` — 👻 dead code (`garage.ts:123`)
- **Finding:** defined (blocks fliers/boats/rails, caps cargo at 2) but **zero call sites.** The 2-slot cap is instead enforced in the UI (`garage-ui.ts` `.slice(-2)`, `fitFor` `.slice(0,2)`), and the road-hull guard by `paintGarage`. Harmless, but the sim never validates a fit.

---

## C. TRACKS, COURSES & THE RACE CIRCUIT

### C1 · The Track Builder — 👻 INVISIBLE (`src/sim/tracks.ts` + `src/client/admin.ts`)
- **What it does:** a full creator-only editor. 9 piece kinds (straight/curves/chicane/ramp_up/down/jump/banks) with width/height/surface, `walkTrack`, `trackCloses`, `trackFits`, `validateTrack`, `starterOval`, `exportTrack`/`importTrack`. `admin.ts` draws a live 2D map, saves to `localStorage['ww_tracks']`, exports JSON.
- **THE GAP:** `checkpointsFor(track)` (`tracks.ts:128`) is the *only* bridge from a `BuiltTrack` to a raceable circuit — and it has **zero call sites.** The race mode never loads the shelf. So a creator can build, validate, save and export a track, **but nobody can ever race on it.** The builder is a beautifully finished island wired to nothing downstream.
- **What remains:** feed a saved `BuiltTrack`'s `checkpointsFor()` into `map.raceTrack` (and carve its geometry) so built tracks are selectable at deploy.

### C2 · The generated race circuit — ✅ WIRED but flat (`src/sim/map.ts:956 generateRaceTrack`)
- **What it does:** the *only* raceable circuit. A deterministic elliptical ring carved between two concentric ellipses, sealed with `T_WALL` in-field and out-field, 12 ordered checkpoints (gate 0 = start/finish), a 10-slot staggered start grid, seed-nudged so no two ovals drive alike. This — not the builder — is what `stepRace` reads.
- **What remains:** it is **dead flat** — no terrain steps, so A5's landing never fires here. The "decorative barrier stubs" comment (`map.ts:1006`) is an explicit no-op (`void rng`). No ramps, no railings, no elevation on the actual track.

### C3 · Driving schools / certification courses — ✅ WIRED (`src/sim/courses.ts`, `modes.ts:820 stepSchool`)
- **What it does:** 13 course programs (basic_driver → bomber/dropship), each a chain of drills (straight/slalom/brakebox/handbrake/parking/circuit) with a one-line lesson, laid deterministically as gates by `layCourse` (with a serpentine fold so it fits the map). `stepSchool` is the examiner: drive the gates in order, no fail state, par is a stretch goal, and it signs the licence. Renderer draws the gates (`courseGates`).
- **What remains:** solid and self-contained; this is the licensing on-ramp, fully playable.

---

## D. RACE MODES & THE 5 SPORT DISCIPLINES

### D1 · Circuit racing (`stepRace`) — 🟡 PARTIAL (`src/sim/modes.ts:387`)
- **What it does (boards):** grid countdown → lap banking off the checkpoint ring → fastest-lap announces → first-to-N-laps wins → files the record. Places computed by loop progress. Fully works for the board classes.
- **THE GAP (cars/trucks/bikes):** `collectRacers` (`modes.ts:362`) still filters to **`isBoard(v.kind)` only.** But `main.ts:1128-1148` spawns cars/trucks/bikes on the grid and `bots.ts:849` was widened to drive *any* ground hull round the circuit. Result: pick a car and `m.racers` is **empty** → no laps counted, no places, the race **never ends**, no record filed, and the AI cars (getting `cur=0` from an absent racer) pile at gate 0. Car/truck/bike racing is UI-and-AI-wired but the lap engine ignores them. **This is the single biggest live bug in the slice.**

### D2 · Time Attack (`timetrial`) — 🟡 PARTIAL (`modes.ts:441`, ghost in `main.ts`)
- **What it does:** solo run, ends when the human completes their laps, best-lap filed; ghost recorder/player wired (D6). Works on boards.
- **What remains:** inherits D1's car-class blind spot (a car time-trial never registers a lap).

### D3 · Demolition / Derby (`stepDerby`) — ✅ WIRED (`modes.ts:768`)
- **What it does:** no laps — count hulls with a live driver, last machine running wins; drivers walk away from wrecks (nobody dies at the fair). `derby` mode is fully implemented with its own countdown.
- **Doc discrepancy:** `sports.ts` header comment (`:48`) calls Demolition "PLANNED," but `SPORTS[demolition].live = true` and the mode runs — the comment is **stale**; demolition genuinely runs.

### D4 · The Gun Run (`gunrun`) — ⬜ UNBUILT / PLANNED (`sports.ts:95`, `live:false`)
- **What it does:** listed in the league as fixed-forward-armament racing, `mode: 'race'`, but `live:false`. There is no system that bolts a fixed race weapon onto a car or enforces "guns you have are what's on the nose." The GONET card shows "not running yet — the parts exist; the league does not."
- **What remains:** a car-mounted forward weapon variant of the race mode.

### D5 · Freestyle (`freestyle`) — ⬜ UNBUILT / PLANNED (`sports.ts:108`, `live:false`)
- **What it does:** listed as the board park scored on landed tricks; `live:false`, and `mode:'race'` (not a real scoring session). The trick *economy* is fully live in-game (E1), but there is **no freestyle mode** that scores "best single run of the session."
- **What remains:** a scored, no-finish-line session reading the board's combo bank.

**Verdict on the 5 disciplines:** 3 run (circuit, time-attack, demolition — the first two with the car-class bug), 2 are honestly flagged PLANNED (gun run, freestyle). The board is honest about the split.

---

## E. THE BOARD (HOVERBOARD TRICK ECONOMY)

### E1 · Trick economy — ✅ WIRED, fully (`src/sim/boardtricks.ts` + `world.ts:5658 stepBoard`)
- **What it does:** the complete "Tony Hawk meets Halo" loop is real and playable. Airtime + spin (`spinName` 180→1080) + grind (wall-line) + wall-ride + power-slide (slip-angle gated) all build an unbanked **combo**; the **landing** (`land()`, alignment vs `LAND_WINDOW`) decides bank-or-bail; a clean land banks combo × multiplier into **boost** and climbs the multiplier (cap 6), a bad land **BAILS** (combo gone, board mush 0.9 s). Spend boost (fire trigger) for +55% top speed; hold jump for a **boost jump**; tap for the free **hop**; crouch is the **air brake**. `coolChain` decays the multiplier on the ground. All nine canon verbs are present and driven by steering, not trick buttons.
- **What remains:** nothing — this is the most complete system in the slice. Only missing consumer is a *freestyle mode* to score it (D5).

---

## F. DROPPABLES, DAMAGE & COLLISION

### F1 · Droppables (mines & oil) — ✅ WIRED (`world.ts:3742 drop`, `:2894 effects`)
- **What it does:** G drops what's loaded, out the back, mines-then-oil. `race_mine` arms 1.2 s late (can't kill yourself), damages + pitches the hull it catches; `oil_slick` forces `oiledUntil` (floor becomes ice 2.5 s). Counts come from the garage cargo row via `setFit`.
- **What remains:** solid. (armour/crusher are the *other* cargo items — armour wired, crusher not; see B3.)

### F2 · Hull-to-hull collision — ✅ WIRED (`src/sim/hullcollide.ts`, `world.ts:5877 resolveHullContacts`, called `:2404`)
- **What it does:** O(n²) impulse solver over all grounded/surface hulls each tick — mass-weighted separation (a tanker shoves a hatchback), restitution 0.25, and `crashDamage` above a force threshold billed to *both* hulls with sparks/explosion. Aircraft (by band), boats, burrowed and submerged excluded. "A jeep no longer passes through a tank."
- **What remains:** solid.

### F3 · Roadkill — ✅ WIRED (`world.ts:6316`)
- **What it does:** a driven ground hull > 6 u/s that overlaps an on-foot enemy deals speed-scaled damage. Simple and live.

---

## G. RECORDS, GHOST, LEAGUE, TELEMETRY, TRAFFIC

### G1 · Lap records — ✅ WIRED (`src/client/records.ts`, filed `main.ts:1489`)
- **What it does:** account-level board (`localStorage['ww_records']`) keyed by track + `RaceClass` (bike/car/truck/board via `raceClassOf`), storing best lap, best race, **holder name**, hull and date. `fileRun` returns whether a record was *taken* (and from whom) so the HUD can announce the theft. Filed at race end.
- **What remains:** only board-class races actually reach `fileRun` today because of D1; the record schema itself is class-complete.

### G2 · Ghost — ✅ WIRED (`src/client/ghost.ts`, `main.ts:1229`)
- **What it does:** client-only recorder samples the deck ~20 Hz over a lap; a better lap is stored per circuit+board (`ghostKey`) in localStorage; `GhostPlayer` interpolates the stored line beside you next lap. Never touches the deterministic sim.
- **What remains:** solid.

### G3 · GONET sports league — ✅ WIRED (`src/client/gonet/sports.ts` + `gonet/index.ts:243`)
- **What it does:** the laptop renders disciplines (with **PLANNED** tags for non-live), a deterministic 5-fixture list from the game-day, standings read straight off the record board, rules/what-it-trains, and an **ENTER** button that launches the mode (live sports only; PLANNED show "not running yet"). Also surfaces the track builder button and feeds the newspaper/broadcast (`broadcast.ts`, `mail.ts`, `newspaper`).
- **What remains:** solid as a shell; its liveness mirrors D1–D5.

### G4 · Vehicle telemetry — ✅ WIRED, dev-facing (`src/sim/vehicle-telemetry.ts`, stepped `world.ts:2127`)
- **What it does:** samples every 2 s (distance/elevation/route/engaged), files incidents (stuck, wrong_surface, crash, landing, boundary_wrap, non_finite…), aggregates shots/hits/losses/radar, and prints a black-box report consumed by `main.ts` "LAST FLIGHT" and `scenario-runner.ts`. Instrumentation, not a player HUD — appropriately invisible.
- **What remains:** nothing; it's a diagnostics spine.

### G5 · Civilian traffic autopilot — ✅ WIRED (`src/sim/traffic.ts`, `world.ts:5780 civilianCmd`)
- **What it does:** a driverless civilian hull picks a destination, steers there through the *same* drivetrain the war uses, wanders, unwedges (`updateStuck` → reverse), and **panics** from nearby gunfire (flee vector + horn + reckless pace). No soldier is spawned (dodges the `id % 4` bot-role trap). Payload table gives each civilian hull its wreck meaning (fuel = bomb, ambulance = dressing station, etc.).
- **What remains:** solid; this is the "city feels alive" layer, and it drives.

---

## SPECIFIC ANSWERS

- **Cargo capacity (does a pickup out-haul a sports car)?** **No system exists — CONFIRMED.** No capacity field on `VehicleDef`; the only "cargo" is the 2-slot garage loadout (same for every hull) and traffic wreck-payload flavour. `seats` carries soldiers, not freight. (§A6)
- **RDS racing — ramps / overpasses / railings / damage / droppables:**
  - Ramps: **🟡** — full jump/landing/shock physics exists against *terrain* (§A5) and the builder defines ramp/jump pieces (§C1), but the only raceable circuit is a **flat ellipse** (§C2), so ramps never appear in an actual race.
  - Overpasses: **⬜ UNBUILT** — no code anywhere.
  - Railings/guardrails: **⬜ UNBUILT** — the circuit uses walls as boundary; the "barrier stubs" are a no-op.
  - Damage models: **✅** — hull-hull crash, landing shock, mine, roadkill, per-subsystem `systemHp`.
  - Droppables: **✅** — mines + oil, armed-delay + oil→ice.
- **Hoverboard trick economy fully wired?** **✅ Yes**, end to end (§E1) — the most complete system here. Only gap is a *freestyle mode* to score it.
- **Do the 5 disciplines run?** **3 run, 2 PLANNED.** Circuit + Time-Attack run (board-only in practice — the car-class lap-counter is broken), Demolition runs (derby mode; the "PLANNED" code comment is stale). Gun Run and Freestyle are honestly flagged `live:false`.

---

## TOP 5 GAPS IN VEHICLES/RACING

1. **Car/truck/bike racing never counts a lap (live bug).** `collectRacers` (`modes.ts:362`) is still `isBoard`-only, while the grid (`main.ts`) and bot AI (`bots.ts:849`) were widened to all ground hulls. Pick a car and the race registers no racers, no laps, never ends, files no record, and the AI stalls at gate 0. One-line class of fix, highest impact — it silently voids 3 of the 4 advertised race classes.

2. **The Track Builder is unreachable from play.** `checkpointsFor()` (`tracks.ts:128`) — the sole `BuiltTrack`→circuit bridge — has zero call sites; the race mode only ever loads the procedural ellipse. A whole finished editor (draw/validate/save/export) produces tracks nobody can race. Wire the shelf into `map.raceTrack`.

3. **Cargo capacity is entirely absent.** No hull hauls more than another; the concept the owner flagged simply isn't modelled (§A6). Needs a design fork (true freight tonnage + economy/objective, or formalise the garage `CargoId` row) before it can be built.

4. **The race circuit is flat — ramps/overpasses/railings unbuilt.** The landing physics is genuinely special (§A5) but has nothing to land off *in a race*; `generateRaceTrack` lays no elevation, jumps, banking or barriers, and the "barrier stubs" are a no-op. The most cinematic system is starved of a stage.

5. **Crusher Ram is a shop item with no mechanic (👻), and Gun Run + Freestyle are shells.** `fit.cargo.includes('crusher')` is read nowhere — it only adds weight, a strict downgrade (§B3). Alongside it, two league disciplines (gun-run, freestyle) are `live:false` with no underlying mode, even though freestyle's trick economy is fully built and just needs a scoring session. (Minor sibling: `fitLegal()` is dead code.)
