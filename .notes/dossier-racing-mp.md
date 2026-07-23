# DOSSIER — RACING & THE GARAGE · MULTIPLAYER
**Established from the code at `D:/git/ShootEM`, 2026-07-23.** Every claim carries a `file:line`.
Written for an agent working these features **cold**. Where a design doc contradicts the code, the
code wins and the contradiction is called out explicitly.

Verification note: the two prior audits (`.notes/audit-vehicles.md`, `.notes/audit-misc.md`) were
re-checked against current source. Three of their claims are now **stale** and are corrected below
(§A5.1, §A5.2, §A5.3). One new empirically-confirmed defect was found (§A5.4, Derby).

---
---

# FRAGMENT A — RACING & THE GARAGE (status truth)

## A1 · THE CARD — line by line

`docs/RACING.md:17-21` marks **traction / shock / tires / engine / cargo** as `▶ build`.
**That table is stale. All five shipped.** Corrected status:

| RDS card line | Ours | Status | Defined at | **Consumed at (the proof)** |
|---|---|---|---|---|
| WEIGHT | `VehicleDef.mass` (tonnes) | ✅ **SHIPPED** | `src/sim/types.ts:381`; per-hull values `src/sim/data.ts:390`+ | `src/sim/world.ts:6099` (`heft`, divides accel/brake), `world.ts:6144` + `:6156` (widens the slide), `world.ts:5891` (hull-contact mass), `world.ts:6290` (landing force) |
| TOP SPEED | `VehicleDef.speed` | ✅ **SHIPPED** | `types.ts:300` | drivetrain target speed, `world.ts:5936` reads `v.fittedDef ?? VEHICLES[v.kind]` |
| ACCELERATION | derived (power-to-weight) | ✅ **SHIPPED** (derived, not stored) | `src/sim/garage.ts:114` `accelRating()` | printed on the card `src/client/garage-ui.ts:64`; the *actual* accel is `world.ts:6120-6124` |
| TRACTION ICE / DIRT / PAVED | `VehicleDef.traction:{ice,dirt,paved}` | ✅ **SHIPPED** — doc says `▶ build`, **wrong** | `types.ts:393`; values `data.ts:395,400,406,617-633,648,650`… | `world.ts:6112` picks the family from the floor material, `world.ts:6115` `handling = grip × traction[family]`, fed into cornering `world.ts:6144`/`:6156` |
| SHOCK STRENGTH | `VehicleDef.shock` | ✅ **SHIPPED** — doc says `▶ build`, **wrong** | `types.ts:398` | `world.ts:6291-6301`: `force = mass × −fallSpeed`; over `shock` ⇒ bounce + speed scrub + `damageVehicle(…, 'crash')`; under ⇒ `v.vel.y = 0` ("stuck the landing") |
| TIRES (rewrite the triple) | `TIRES` part table | ✅ **SHIPPED** — doc says `▶ build`, **wrong** | `garage.ts:44-67` (slicks / allterrain / knobblies / studs) | `garage.ts:90-112` `fitted()` rewrites `traction`; baked onto the hull once at `world.ts:2046` (`setFit`), read every tick at `world.ts:5936` |
| ENGINE (top end vs launch) | `ENGINES` part table | ✅ **SHIPPED** — doc says `▶ build`, **wrong** | `garage.ts:68-73` (stock / sprint / longratio) | `garage.ts:99` (`speed × engine.speed`), `garage.ts:114-120` (accel rating); the `accel` multiplier is **card-only** — see TRAP A5.6 |
| CHASSIS (weight vs survival) | `CHASSIS` part table | ✅ **SHIPPED** | `garage.ts:75-79` (stripped / standard / reinforced) | `garage.ts:100` (`hp × chassis.hp`), mass at `garage.ts:97`; applied `world.ts:2052-2054` |
| CARGO (mines · oil · armour · crusher) | `CARGO` part table | ✅ **SHIPPED (3 of 4)** — doc says `▶ build`, **wrong** | `garage.ts:82-87` | mines/oil become droppables `world.ts:2055-2056`; dropped `world.ts:3748-3765`; effects `world.ts:2899-2929`; armour ×1.35 hp `garage.ts:100`. **CRUSHER is mass-only** — see A1.1 |

### A1.1 · The one card line that is genuinely NOT shipped
**CRUSHER RAM** (`garage.ts:86`) has **no directional/ram behaviour anywhere.** The only string
matches for `'crusher'` in the sim outside `garage.ts` are the *LSW* named Crusher
(`src/sim/lsw.ts:430`) — a different thing entirely. Grepping `fit.cargo` in `world.ts` returns
exactly three hits: `:2045`, `:2055` (mines), `:2056` (oil). So the crusher does **one** thing —
it adds `0.45 t`, and mass feeds `resolveHullContacts` (`world.ts:5891`) so a crusher car hits
marginally harder. There is no wedge, no front-arc bonus, no attacker credit.
`docs/RACING.md:32` ("mass × speed decides who wins the contact") describes a directional rule
that does not exist.

### A1.2 · Where the card is *shown*
`src/client/garage-ui.ts:49-68` `cardHtml()` prints TRACTION·ICE/DIRT/PAVED, WEIGHT, TOP SPEED,
ACCELERATION, HULL, SHOCK STRENGTH as live bar-graphs off `fitted()`. Fits persist to
`localStorage['ww_fits']` (`garage-ui.ts:17-44`), per machine. Mounted on the deploy screen at
`src/main.ts:371-374` (road hulls only).

### A1.3 · The one-line rule for how a fit reaches the sim
`World.setFit(v, fit)` — `src/sim/world.ts:2044-2058` — resolves the card **once** onto
`v.fittedDef`, and every hot-path read is `const def = v.fittedDef ?? VEHICLES[v.kind]`
(`world.ts:5936`, `:5887`). **If you add a new fitted stat, it only works if `stepVehicle` reads
`fittedDef`, not `VEHICLES[...]`.** Several places still read the raw table on purpose
(e.g. `world.ts:3749`, `:3757` for the drop position radius).

---

## A2 · THE FIVE SPORT DISCIPLINES (`src/client/gonet/sports.ts`)

`SPORTS` is declared at `sports.ts:53-120`. `live` is an honesty flag the GONET renders
(`src/client/gonet/index.ts:269-273` paints `PLANNED` + a `.soon` class; `:315-317` swaps the
ENTER button for "This discipline is not running yet").

| # | Sport | `live` | `mode` | Mode implementation | Real status |
|---|---|---|---|---|---|
| 1 | CIRCUIT RACING (`sports.ts:55`) | `true` (`:66`) | `race` | `initMode` `modes.ts:106`; `stepRace` `modes.ts:395-455` | ✅ **RUNS.** Grid countdown, checkpoint lap banking, fastest-lap announce, first-to-N-laps flag, record filed |
| 2 | TIME ATTACK (`sports.ts:69`) | `true` (`:79`) | `timetrial` | `initMode` `modes.ts:119`; same `stepRace`, trial branch `modes.ts:449-455` | ✅ **RUNS.** Solo, ends on the human's lap count, ghost wired (see A4.2 for the key bug) |
| 3 | DEMOLITION (`sports.ts:82`) | `true` (`:92`) | `derby` | `initMode` `modes.ts:113`; `stepDerby` `modes.ts:776-797` | 🟡 **MODE LOGIC EXISTS, LAUNCH IS BROKEN** — see A5.4. The rule ("last hull with a live driver") is correct; the *deploy path* never puts anyone in a hull |
| 4 | THE GUN RUN (`sports.ts:95`) | **`false`** (`:105`) | `race` | none — no fixed-forward-armament system exists | ⬜ **SHELL.** Honest: the board says PLANNED |
| 5 | FREESTYLE (`sports.ts:108`) | **`false`** (`:118`) | `race` | none — there is no scored, no-finish-line session | ⬜ **SHELL**, and it is further from working than it looks — see A5.5 (the trick economy does not run on raceboards) |

**Note the stale in-file comment.** `sports.ts:48-51` says *"Circuit and Time Attack run today.
Demolition … PLANNED"* — but `sports.ts:92` sets `demolition.live = true`. The header comment
contradicts the data three lines later.

**League layer (all pure, all client, all localStorage-backed):**
- `fixtures(day, tracks)` `sports.ts:141-151` — deterministic from the game day, only cycles
  `liveSports()`, so a shell discipline never appears on the fixture list.
- `standings(records)` `sports.ts:165-175` — derived purely from the record board.
- `leagueLine(day, tracks)` `sports.ts:178-182` — the one-line GONET desk headline.
- Rendered `src/client/gonet/index.ts:261-324` (`sportsApp`); "ENTER" handler `index.ts:691-698`.

---

## A3 · TRACK CREATION

### A3.1 · The Track Builder — data + rules (`src/sim/tracks.ts`, 190 lines, pure)
- 9 piece kinds `tracks.ts:19-25`; 3 pavements `tracks.ts:28`; `TrackPiece{kind,width,height,surface}` `tracks.ts:30-37`.
- Geometry table `PIECE_SHAPE` `tracks.ts:62-72` (`run` / `turn` / `rise` per kind).
- `walkTrack()` `tracks.ts:86-102` — pure polyline walk; the node sits at the piece's **entry**, then the yaw turns.
- `trackCloses()` `tracks.ts:105-115` (tolerance 30u) · `trackFits()` `tracks.ts:118-120` (halfExtent 145u; `WORLD = 300` at `map.ts:23`, so 145 is just inside the fence).
- `validateTrack()` `tracks.ts:125-141` → `TrackProblem[]` of `short | offmap | open | nogrid | narrow`.
- `checkpointsFor()` `tracks.ts:146-148` — one gate per piece, radius `max(10, width×0.9)`.
- `starterOval()` `tracks.ts:151-162` · `exportTrack/importTrack` `tracks.ts:167-190`
  (`importTrack` **sanitises**: clamps width to `[6,30]`, height to `[0,2]`, drops unknown kinds).

### A3.2 · The Builder UI — creator-only (`src/client/admin.ts`, behind `admin.html`)
- Piece buttons built from `PIECE_SHAPE` `admin.ts:193-197`; undo/clear/oval/export/save `admin.ts:199-221`.
- Live minimap on a canvas incl. the 290×290 world fence `admin.ts:152-186`.
- Verdict line `admin.ts:225-243`: **blocking problems are red; `narrow` is an amber CAUTION, not a refusal** (`admin.ts:232-234`) — a board-only knife-fight circuit is legal, it just is not a car track.
- Saved to `localStorage['ww_tracks']` (`SHELF_KEY`, `admin.ts:133`, write `:216-219`).
- ⚠️ `admin.ts:110-116` documents a real past failure: the room used to boot at the top of the file and hit the TDZ on `PIECE_LABEL`; **`paintDoor()` must stay the last statement in the file** (`admin.ts:249`).

### A3.3 · How a built track becomes raceable — the bridge
```
admin.ts (save) → localStorage['ww_tracks']
   → main.ts:110-115  loadTrackShelf()
   → main.ts:120-137  refreshTrackPills()   (pills: "Proving Oval — procedural" + one per shelf track)
   → main.ts:141-148  selectedRaceMap()     (importTrack sanitise → buildTrackMap(clean, theme))
   → main.ts:957-960  new World({ …, map: selectedRaceMap() })   ← race/timetrial ONLY
   → World uses opts.map verbatim (world.ts:687)
   → main.ts:1177-1207  the grid is filled from world.map.raceTrack
```
With no track selected, `selectedRaceMap()` returns `undefined` and the sim carves its own
procedural oval: `generateMap` `map.ts:1211` → `generateRaceTrack` `map.ts:957-1023`.

`buildTrackMap()` — `src/sim/map.ts:1035-1206` — is the whole bridge. What it does:
| Step | Line | Notes |
|---|---|---|
| seals the field, carves the route | `map.ts:1036`, `:1052-1082` (`carve`) | round brush, per-piece surface, per-piece height level |
| authors **real terrain height** | `map.ts:1039-1040`, `:1046`, `:1077-1079` | `TERRAIN_U = [0,4,16]`; `ramp[]` marks graded (drivable) tiles. Ramp pieces make a built track **the first generated map that isn't dead flat** — but only if it uses ramps (`elevated` flag, `map.ts:1196-1198`) |
| rounds the corners | `map.ts:1084-1100` (`stampDisc`), called `:1113-1116` | **load-bearing.** A polyline kink carves a square wall on the outside of a turn; cars drove into it and the race stranded |
| checkpoints | `map.ts:1118` → `checkpointsFor()` | one per piece, gate 0 = start/finish |
| **start grid** | `map.ts:1148-1176` | walks the centre line **BACKWARDS** (`backFrom`), rows at `7 + row*6` units, ±3u lanes, then `snapToOpen()` |
| `startYaw` | `map.ts:1184` = `backFrom(2).yaw` | the heading the circuit **arrives** on, not the first piece's heading |
| determinism | `map.ts:1188-1190` | seed = a stable char-hash of `track.id`, so the same track builds a byte-identical map (`tests/track-build.test.ts:165-172`) |

### A3.4 · `RACEABLE_WIDTH` — the measured constraint

```ts
// src/sim/tracks.ts:52-55
/** The narrowest road a CAR can still take a corner on. Measured, not guessed:
 *  a full grid of cars/trucks/bikes strands below this and runs clean at or
 *  above it (tests/track-build.test.ts drives all four classes). */
export const RACEABLE_WIDTH = 20;
```
**What it protects:** the *field finishing the race*, not the car fitting the road. Below 20u a
full grid piles into the outside of every corner and three-quarters of the field never completes a
lap — the code says so at `tracks.ts:57-58`: *"14 used to be the default and it was a car-trap."*
It is enforced as a **warning only** (`tracks.ts:133-139` emits `kind:'narrow'`; the UI treats it
as a caution, `admin.ts:232`), because boards *can* thread a narrow circuit.
Related constants: `DEFAULT_PIECE.width = 22` (`tracks.ts:59`) — deliberately above the floor.
Locked by `tests/track-build.test.ts:156-163` and by the four-class "nobody is left on the grid"
suite `tests/track-build.test.ts:99-126`.

**⚠️ TRAP (live inconsistency):** the Builder's width slider ships at **14**, below the floor —
`admin.html:87` `<input id="tb-width" … value="14">`, read by `currentSpec()` `admin.ts:146-151`.
So every piece a creator lays *without touching the slider* is 14u and trips the narrow caution,
even though `DEFAULT_PIECE` and `starterOval()` are 22u and clean. Fix the HTML default to 22, not
the constant.

---

## A4 · RECORDS · GHOSTS · LEAGUE — what persists, keyed by what

| Artefact | Store | Key | Written at | Read at |
|---|---|---|---|---|
| Lap / race **records** | `localStorage['ww_records']` (`records.ts:11`) | `` `${trackId}::${cls}` `` (`records.ts:43`); `cls` from `raceClassOf()` `records.ts:37-41` (bike/car/truck/board, truck = `mass ≥ 4`) | `fileRun()` `records.ts:58-82`, called **once per match** at `main.ts:1554` | `allRecords()` `records.ts:85`; GONET `gonet/index.ts:263`, mail `gonet/mail.ts:130`, broadcast `gonet/broadcast.ts:181`, service file `service-file.ts:47`, standings `sports.ts:165` |
| **Ghost** lap | `localStorage[ghostKey(...)]` (`ghost.ts:70-72`) | `` `ww_ghost_${trackSeed}_${board}` `` | `saveGhost()` `ghost.ts:86`, called `main.ts:1446` on a new personal best | `loadGhost()` `ghost.ts:76`, `main.ts:1292` at deploy and `main.ts:1444` per lap |
| **Garage fits** | `localStorage['ww_fits']` (`garage-ui.ts:17`) | `VehicleKind` | `saveFit()` `garage-ui.ts:40` | `fitFor()` `garage-ui.ts:29-38`; ridden onto the grid `main.ts:1196` |
| **Track shelf** | `localStorage['ww_tracks']` (`admin.ts:133`) | array, `id` = slugified name (`admin.ts:214`) | `admin.ts:216-219` | `main.ts:110-115` |
| League standings / fixtures | *nothing persists* — pure derivations | — | — | `sports.ts:141`, `:165` |

### A4.1 · ⚠️ The record key is a **THEME**, not a track (honest answer to the brief)
```ts
// src/main.ts:1553
const trackId = (world.map.theater?.id ?? selectedTheme) + '-circuit';
```
Not the deploy seed (the brief's guess), and **not** the built track's `id` either. Consequences:
- Every built track raced on the same theme shares **one** record row per class. Lay ten circuits
  on `savanna`, and all ten fight over `savanna-circuit::car`.
- `sports.ts:141` `fixtures()` derives its venue list from `[...new Set(recs.map(r => r.trackId))]`
  (`gonet/index.ts:264`), so the league's "venues" are themes, never track names.
- `buildTrackMap` already computes a stable per-track seed (`map.ts:1188-1190`) and the track
  carries an `id` — the fix is one line at `main.ts:1553`, but it will orphan existing records.

### A4.2 · ⚠️ The ghost key is the **deploy seed**, and the deploy seed is random
```ts
// src/main.ts:944-945
const seed = exercise?.seed ?? queuedScienceLaunch?.spec.seed ?? deployedOperation?.plan.seed
  ?? seedOverride ?? (Math.random() * 0xffffffff) >>> 0;
// src/main.ts:1286
const ghostK = ghostKey(seed, selectedRaceBoard);
```
`seedOverride` is only set by the paintball-field path (`main.ts:154`), never by racing. So for a
race **`seed` is a fresh random number every deploy**, the ghost is saved under a key that will
never be looked up again, and `loadGhost()` at `main.ts:1292` essentially always returns `null`.
The ghost machinery (`ghost.ts` recorder/interpolator, `renderer.setGhostBoard`, `moveGhost`) is
correct and complete — **only the key is wrong.** The natural fix is `world.map.seed` (which
`buildTrackMap` derives deterministically from the track id, `map.ts:1188-1190,:1193`) or the same
`trackId` records use.

Net effect: TIME ATTACK's headline promise (`sports.ts:72` *"Your best lap runs beside you as a
ghost"*) does not survive a session restart today.

---

## A5 · TRAPS FOR A NEW DEV

### A5.1 · CORRECTION to `.notes/audit-vehicles.md` §D1/§D2 — `collectRacers` is **fixed**
The prior audit calls this "the single biggest live bug in the slice": *`collectRacers` still
filters to `isBoard(v.kind)` only.* **That is no longer true.** Current code
(`src/sim/modes.ts:355-375`) admits **any grounded, driven hull** and the comment records the fix
verbatim: *"This used to filter boards ONLY, which silently voided every car/truck/bike race."*
```ts
// modes.ts:369-370
const grounded = !!def && !def.flies && !def.boat; // boards hover → still grounded
if (grounded) racers.push({ id: s.id, next: 0, lap: 0, … });
```
Locked by `tests/track-build.test.ts:99-126`, which drives cars, trucks, boards and bikes and
asserts nobody is stranded.

### A5.2 · CORRECTION — the trick economy does **not** run on raceboards
`.notes/audit-vehicles.md` §E1 calls the trick economy "✅ WIRED, fully." It is fully written
(`src/sim/boardtricks.ts`, 222 lines, pure: `stepAir` `:74`, `stepGrind` `:82`, `stepWallRide`
`:88`, `stepSlide` `:98`, `land` `:157`, `boostJump` `:212`) — but it is **gated on one hull kind**:
```ts
// src/sim/world.ts:6318
if (v.kind === 'hoverboard') this.stepBoard(v, stunned ? undefined : driverCmd, dt);
```
`RACEBOARD_KINDS = ['comet','vector','sprite']` (`src/sim/types.ts:120`) — none of them is
`'hoverboard'`, and the race screen defaults to `'vector'` (`main.ts:103`). `types.ts:948` even
self-documents the field as *"hoverboard only."* **So the board class you actually race has no
combo, no boost, no bail.** This is why FREESTYLE (`sports.ts:108`) is further from shipping than
"add a scoring session" — the economy has to reach the raceboards first.

### A5.3 · CORRECTION — line drift in the prior audits
`.notes/audit-vehicles.md` cites `fileRun` at `main.ts:1489` and the ghost at `main.ts:1229`;
they are now `main.ts:1554` and `main.ts:1286`. `.notes/audit-misc.md` cites the `server-url`
input at `main.ts:695`; it is `main.ts:743`. Re-grep before trusting any line number in those files.

### A5.4 · 🔴 DERBY IS LAUNCH-BROKEN — it ends 4.6 s after the flag, every time
`stepDerby` (`modes.ts:776-797`) is correct. The **deploy path** is not:
1. `main.ts:1016` — `isRace` includes `'derby'`, which suppresses the normal bot roster (`main.ts:1017-1019` excludes race modes from `factionModes`; the bot-filling `else` at `main.ts:1262-1273` is skipped because the `isRace` branch at `:1177` claims the chain).
2. `main.ts:957-960` — a map is only substituted for `'race' | 'timetrial'`. Derby gets `undefined`.
3. `map.ts:1211` — `generateMap` carves a `raceTrack` only for `'race' | 'timetrial'`. **Derby's map has no `raceTrack`.**
4. `main.ts:1180-1181` — the grid-fill block is `if (track) { … }`. With no track, **no vehicles and no AI racers are ever spawned.**
5. `modes.ts:781-788` counts hulls with a live driver ⇒ `running.length === 0` ⇒ `running.length <= 1` ⇒ `endMatch(w, -1)` the instant the 4.5 s countdown expires.

Confirmed by direct execution (`npx tsx`, World seed 7, mode `derby`, one human, zero bots):
```
derby map raceTrack: ABSENT
race  map raceTrack: PRESENT
derby over after 4.57 s · winner -1
```
Derby *is* offered to the player — `main.ts:490` lists it under "Training & Trials". Minimal fix:
extend the two mode checks (`main.ts:959` and `map.ts:1211`) to include `'derby'`, or give derby its
own arena generator + grid.

### A5.5 · `collectRacers` history — read the comment before you touch it
`modes.ts:355-361` is a scar. Two behaviours are load-bearing and easy to break:
- **It runs exactly twice per match, both lazily**: once when the countdown expires
  (`modes.ts:408-409`) and again as a guard if the list came back empty (`modes.ts:413`). Anyone who
  boards a hull *after* the lights go out **is never a racer** — no laps, no place, no record.
  Correspondingly, a racer whose hull is wrecked stays in `m.racers` forever (their `place` is
  computed from a stale `next` gate, `modes.ts:378-392`).
- **It admits passengers.** The filter is `s.vehicleId >= 0` (`modes.ts:364`), not `s.seat === 0`.
  A 2-seat car with a driver and a passenger produces **two racers at identical coordinates**, both
  banking the same laps. Harmless today because the race spawner seats one soldier per hull
  (`main.ts:1200-1206`), but it will bite the moment a mode lets a second body in.
- The AI reads the same list: `raceDriverCmd` (`bots.ts:793-813`) does
  `w.mode.racers?.find(r => r.id === s.id)` and falls back to gate 0 if absent — an un-collected
  bot drives at checkpoint 0 forever. That is exactly how the old boards-only bug manifested.

### A5.6 · The engine's `accel` multiplier is card-only
`ENGINES[*].accel` (`garage.ts:69-71`) is read **only** by `accelRating()` (`garage.ts:117`) — i.e.
by the printed card. The drivetrain's real acceleration is a flat `18 / 27 / 6.5` scaled by
`tractionK / heft` (`world.ts:6120-6124`) and never sees `engine.accel`. A Sprint Tune therefore
*reads* punchier on the card while only actually lowering top speed (`garage.ts:99`). If you want
the trade to be real, `fitted()` must carry the accel factor onto `VehicleDef` and `stepVehicle`
must read it off `def`.

### A5.7 · Grid-slot placement — the two fixes already paid for
Both generators encode a bug-fix in a comment; don't undo them.
- **Built tracks** (`map.ts:1140-1176`): slots must walk the centre line **backwards** (`backFrom`),
  not backwards off `startYaw`. Laying them off `startYaw` assumes the circuit arrives at the line
  on the same heading the first piece leaves it — false on any track that closes through a corner.
  On the starter oval that put all ten slots in sealed ground, `snapToOpen()` collapsed them onto
  the start point, and *"four or five cars never completed a lap."*
- **Procedural oval** (`map.ts:996-1004`): the stagger constant is `0.12` per row, not `0.05` —
  0.05 put same-lane rows under 4u apart, *"closer than a car is long, so the field spawned inside
  itself."*
- Both are pinned: `tests/track-build.test.ts:128-143` demands the worst pairwise slot distance
  exceed 5u on **both** generators, and `:145-153` demands the grid spread exceed 14u.

### A5.8 · Corner geometry — the disc is not decoration
`map.ts:1101-1117`: after carving each piece, any piece with `|turn| > 0.01` stamps a disc at the
vertex of radius `halfW × (1 + min(1, |turn|))`. Remove it and every corner regains a square outer
wall; boards thread it, everything heavier stops dead. There is no test that isolates the disc —
the four-class grid test (`track-build.test.ts:99-126`) is what catches its removal.

### A5.9 · `setFit` health handling — carry the *fraction*, never clamp
```ts
// src/sim/world.ts:2050-2054
const frac = v.maxHp > 0 ? v.hp / v.maxHp : 1;
v.maxHp = v.fittedDef.hp;
v.hp = Math.max(1, Math.min(v.maxHp, Math.round(v.maxHp * frac)));
```
The earlier version clamped `hp` to the new ceiling and never raised it, so bolting ARMOUR on
(×1.35 max hp) left a factory-fresh car on the grid at 85/115 — *"the garage was handing you a
pre-dented car."* Both directions are locked: `tests/garage.test.ts:104-117` (a fresh hull stays
full) and `:118-128` (a damaged hull keeps its damage — a re-fit is not a repair).
Also note `setFit` is the **only** place `v.mines` / `v.oil` are stocked (`world.ts:2055-2056`) —
change the cargo table and the boot inventory changes with it.

### A5.10 · Racing is single-player only
`src/server/server.ts:33` — `MODES = ['tdm','ctf','koth','conquest','survival','horde','tide','safehouse']`.
No `race`, no `timetrial`, no `derby`, no `school`. A join for an unlisted mode is silently coerced
to `'ctf'` (`server.ts:453`). Any networked-racing work starts by widening that array **and**
solving map handshake for a built track (see Fragment B, B5.4).

### A5.11 · Smaller sharp edges
- `fitLegal()` (`garage.ts:123-128`) is **never called** — grep returns only `garage.ts` and
  `tests/garage.test.ts`. The 2-cargo cap is actually enforced by `fitFor()`'s
  `.slice(0, 2)` at `garage-ui.ts:36`. A fit written straight to `localStorage` bypasses nothing
  else.
- `lswAllowed()` (`src/sim/lsw.ts:816-818`) excludes `race` and `timetrial` but **not `derby`** —
  gods are legal at the demolition fair.
- `courseGates()` (`modes.ts:806-825`) caches into **module-level** `schoolGates`/`schoolFor`,
  keyed by licence id only. Two Worlds in one process (tests, the harness) share that cache.
- `stepSchool` (`modes.ts:828-861`) has **no failure state by design** (`modes.ts:818-822`) — the
  clock only decides pass vs pass-with-notes. Don't "fix" it into a wash-out.
- Bots never use droppables. `raceDriverCmd` (`bots.ts:793-813`) sets only `moveX/moveZ/aimYaw` —
  no `grenade`, so no AI mines or oil. It is also deliberately RNG-free (id-hashed skill tiers,
  `bots.ts:806`) so races replay byte-identically; **do not reach for `w.rng` in there.**

---
---

# FRAGMENT B — MULTIPLAYER (what is actually running)

`docs/MULTIPLAYER-PLAN.md` describes M0–M2 as work to do. **The authoritative server exists, runs,
and is the shipping path.** Establish that first; everything below is the current truth.

## B1 · WHAT EXISTS AND RUNS

| Fact | Value | Citation |
|---|---|---|
| Server entry | `src/server/server.ts` (500 lines) | — |
| Start command | `npm run server` → `tsx src/server/server.ts [port]` | `package.json:11` |
| Port | `argv[2]` ?? `process.env.PORT` ?? **3401** | `server.ts:21` |
| Transport | one `ws` `WebSocketServer` **sharing the HTTP server** (same port serves both the game wire and the War Room) | `server.ts:433-439`, `:496` |
| Compression | `permessage-deflate`, `threshold: 512`, zlib level 1. Measured in-comment: 27.2 KB → ≤5.5 KB, 0.11 ms CPU/snapshot | `server.ts:426-439` |
| Sim tick | **30 Hz** (`TICK = 1/30`) | `server.ts:26` |
| Snapshot rate | **15 Hz** (`SNAP_EVERY = 2`) | `server.ts:27` |
| Tick loop | wall-clock **accumulator**, polled at 2× tick rate, owed-ticks capped at 5 | `server.ts:114-121` |
| Rooms | **one room per mode**, created on first join, disposed 60 s after the last client leaves | `server.ts:288`, `:452-458`, `:478-493` |
| Modes served | `tdm ctf koth conquest survival horde tide safehouse` — anything else coerced to `ctf` | `server.ts:33`, `:453` |
| Theme | random per room from a 6-theme rotation | `server.ts:34`, `:105` |
| Bot backfill | `TEAM_TARGET = 12`/side; joins swap a bot **out**, leaves swap one **in**; co-op rooms fill to 5 on team 0; each side gets one K9 | `server.ts:62`, `:86-101`, `:133`, `:191` |
| Team assignment | balance by **human** count, not body count | `server.ts:126-132` |
| Match restart | 12 s after the whistle, fresh seed + theme, players re-welcomed and their queues reset | `server.ts:213-217`, `:220-245` |
| Client | `src/client/net.ts` `NetGame` (204 lines) | — |
| Client sim | **thin puppet** — `createPuppetWorld` (`snapshot.ts:29-44`) clears all locally-generated entities and sets `w.puppet = true`; `world.step(dt, emptyCmds)` is extrapolation only | `net.ts:56`, `:148` |
| Input rate | client sends `{t:'cmd'}` every **>33 ms** (~30 Hz), and locally predicts its own on-foot movement only | `net.ts:136-147` |
| Input handling | per-client **queue**, not latest-wins: cap 8, one drained per tick, held-repeat when starved, `STALE_MS = 250` forces a standstill | `src/server/input-queue.ts:22-23`, `:54-71`; drained `server.ts:198-201` |

### B1.1 · How a client joins (the full handshake)
1. Player types a URL into `#server-url` (`index.html:551`), read at `main.ts:743`.
2. `main.ts:799-810` constructs `new NetGame(url, name, class, mode, loadout, chat, hud, isCommissioned(dossier))`; a `connect()` failure (5 s timeout, `net.ts:45`) falls back to offline bots (`main.ts:804-807`).
3. `net.ts:47` sends `{t:'join', name, classId, mode, loadout}`.
4. `server.ts:452-459` finds-or-creates the room, `Room.join` (`server.ts:125-149`) balances teams, swaps a bot out, adds a human soldier, and replies
   `{t:'welcome', id, seed, mode, theme, ...mapHandshake(world)}` (`server.ts:137-140`).
   `mapHandshake` (`snapshot.ts:22-27`) carries `theaterId?` + a `mapIdentity` fingerprint.
5. `net.ts:52-57` builds the puppet world from `(seed, mode, theme, theaterId)` and
   **asserts the map fingerprint matches** (`snapshot.ts:37` `assertMapIdentity`) — a desync is caught at the door, not five minutes in.
6. Stored mail for that callsign is delivered immediately (`server.ts:141-146` ← mailbox `server.ts:40`).

### B1.2 · What rides the wire
| Direction | Message | Server handler | Notes |
|---|---|---|---|
| C→S | `join` | `server.ts:452` | once per socket (`&& !client`) |
| C→S | `cmd` | `server.ts:460` → `pushCmd` | raw `PlayerCmd`, **unvalidated** — see B4.2 |
| C→S | `chat` {channel,text} | `server.ts:462` → `relayChat` `:152-161` | broadcast to **everyone**; channel truncated to 12, text to 200. TEAM filtering is **client-side** (`net.ts:97-100`) |
| C→S | `mail` {to,text} | `server.ts:464-470` | in-memory mailbox, 20 msgs/callsign, delivered on next join |
| C→S | `wp` {x,z} | `server.ts:471` → `relayWaypoint` `:164-173` | teammates only, server-filtered |
| C→S | `lsw` {id} | `server.ts:473` → `callLsw` `:178-183` | **the integrity hole — see B3** |
| S→C | `welcome` | `net.ts:52` | id, seed, mode, theme, map handshake |
| S→C | `snap` | `net.ts:83` → `applySnapshot` | per-client **culled** snapshot, quantized via `wireRound` |
| S→C | `chat` / `mail` / `wp` | `net.ts:96`, `:101`, `:103` | — |

### B1.3 · Interest management / anti-cheat (real, and load-bearing)
`server.ts:204-212` takes **one** authoritative snapshot then culls it **per client**:
`cullSnapshotFor(world, base, c.soldierId)` — `src/sim/snapshot.ts:176-220`. Rules:
- teammates always ride the wire (`snapshot.ts:192`);
- a cloaked enemy is removed **even mid-linger** unless pinged (`:193`);
- corpses only where a friendly eye rests (`:194`);
- a live enemy is sent at **live coordinates only if perceived on this exact tick** (`:198-202`, the `< 0.001` stamp test) — otherwise, inside the linger window, the client gets the **frozen last-seen point**, never the live path behind a wall (`:205-207`);
- vehicles obey fog (`:210-216`), burrowed = invisible, submerged needs detection, dead ECM broadcasts you;
- enemy mines require a `mine_detector` on the viewer's kit (`:218-219`).
The header states the rule plainly (`snapshot.ts:167-173`): *"No wss:// endpoint goes public
without this."* Covered by `tests/culling.test.ts` (8 cases) and `tests/fogcull.test.ts`.
Weather taxes the range (`w.perceiveRange()`, `snapshot.ts:186`); tracking optics stretch the linger (`:187`).

### B1.4 · The operator surface (War Room)
`GET /warroom/status` — no key, read-only, returns rooms + campaign (`server.ts:397-405`).
`POST /warroom/cmd` — one op per request, guarded by an `x-warroom-key` header
(`server.ts:408-421`, `keyOk` `warroom.ts:147`). Ops: `end · restart · announce · kick · nudge ·
operation` (`warroom.ts:65`, dispatch `server.ts:345-387`). Server-side campaign state lives in a
JSON file, `.warroom-campaign.json` by default (`server.ts:297-315`). Pure half is
`src/server/warroom.ts` (149 lines, zero side effects) so `tests/warroom.test.ts` can exercise it
without a socket.

---

## B2 · WHAT IS **NOT** THERE

| Missing | Evidence |
|---|---|
| **Matchmaking / lobby / server browser** | none. The player pastes a URL into a text input (`index.html:551`, read `main.ts:743`). One room per mode, keyed by the mode you picked (`server.ts:288`, `:452-458`) |
| **Accounts / identity / auth on the game wire** | `join` accepts any `name` (`server.ts:459`, truncated to 16 chars at `:134`). Nothing verifies it. Two clients may claim the same callsign — and the **mailbox is keyed by lowercased callsign** (`server.ts:466`), so impersonation reads someone else's stored mail |
| **TLS** | plain `http.createServer` (`server.ts:389`) + `ws://` (`server.ts:497` logs `ws://0.0.0.0:PORT`); the placeholder is `ws://192.168.1.217:3401` (`index.html:551`) |
| **Real secret store / rate limiting** | `WARROOM_KEY = process.env.WARROOM_KEY ?? 'dev-key'` — `server.ts:25`, with the in-code caveat at `server.ts:22-24`: *"Stage-2 hardening point: this is a dev-key-by-default header check over plain HTTP — before the war runs public it needs a real secret store, TLS, and rate limiting. Not before."* |
| **Same-origin / CORS discipline** | `Access-Control-Allow-Origin: *` (`server.ts:390`), with `server.ts:320-321`: *"CORS is wide open … Stage-2 hardening: same-origin + real auth."* Also `warroom.ts:146`: *"Stage-2 hardening (real auth, TLS, rate limits) before the war runs public."* |
| **Server-side persistence of player progress** | none. Career/dossier/records/fits/ghosts/tracks are all browser `localStorage`/IndexedDB. The server persists exactly one file: the campaign (`server.ts:297`) |
| **Delta compression / binary wire** | full-world JSON every snapshot; `snapshot.ts:46` self-labels *"Fine for LAN play at 15Hz."* Only float quantization (`wireRound`, `snapshot.ts:90-91`) and zlib |
| **Reconnect / session resume** | `ws.on('close')` deletes the soldier and backfills a bot (`server.ts:185-193`, `:478`). Rejoining is a brand-new soldier. The room is held warm 60 s but state is not |
| **Racing, school, science, military missions online** | `server.ts:33` omits them; science is forced local at `main.ts:812-814` and documented at `server.ts:31-32` |
| **A front door to multiplayer at all** | The GONET laptop — which replaced the main menu — ships MP as a **disabled** tile: `appTile('mp', …, soon=true)` `gonet/index.ts:239` (`disabled` at `:246`, handler is `else if (t === 'mp') { /* soon */ }` `gonet/index.ts:683`). The front menu's MULTIPLAYER button is `soon: true` with no handler (`src/client/frontend.ts:142`, `menuButton` disables it at `:179-185`). **The working netcode is reachable only via the legacy `#server-url` box on the older `#menu` screen.** |

---

## B3 · KNOWN INTEGRITY HOLE — the LSW commission gate does **NOT** hold server-side

**Verdict: the gate is open on the server. Any connected client can call a god regardless of rank.**

The gate, in the sim:
```ts
// src/sim/world.ts:1201-1213  (requestLsw)
if (callerId >= 0) {
  const caller = this.soldiers.get(callerId);
  if (caller?.kind === 'human' && this.opts.rank !== undefined && !mayCallStable(this.opts.rank)) {
    this.emit({ type: 'announce', soldierId: callerId, text: 'THE STABLE ANSWERS LIEUTENANTS — YOU ARE NOT COMMISSIONED' });
    return false;
  }
}
```
It is conditioned on **`this.opts.rank !== undefined`**. `WorldOpts.rank` is declared at
`src/sim/world.ts:407-408` and stamped onto the human print at `world.ts:1079`.

- **Single player passes it.** `src/main.ts:985` — `rank: currentRank().id`.
- **The server does not.** Both World constructions omit it:
  - `src/server/server.ts:106` — `this.world = new World({ seed, mode, theme: this.theme });`
  - `src/server/server.ts:224` — `this.world = new World({ seed, mode, theme: this.theme });` (restart)

  No `rank`, no `papers`, no `startingSkills`, no `difficulty`, no `botsPerTeam`, no `matchMinutes`,
  no `traffic`, no `clockPhase`, no `budget`, no `moraleBoost`.

So on the server `this.opts.rank === undefined`, the `&&` short-circuits, and the branch **never
fires**. The call then proceeds to the checks that *do* hold server-side (`world.ts:1215-1231`):
mode gate (`lswAllowed`), pass escalation, faction ownership, one-live-per-faction, and the
materiel price. Those are real. The **commission** is not.

The only thing enforcing the commission online is the **client UI**:
- `net.ts:71-81` constructs `StableConsole({ commissioned: this.commissioned, … })`;
- `src/client/stable.ts:63-69` renders "CHANNEL LOCKED" and refuses to draw the call rows.

An uncommissioned player who sends `{"t":"lsw","id":"<any AscendantId>"}` on the socket bypasses
that entirely — `server.ts:178-183` `callLsw` checks only that the id is in `LSWS` and the caller's
soldier is alive, then calls `world.requestLsw(id, s.team, s.id)`.

**The one-line fix** is to pass the rank when the room's World is built — but the server has no
account system to know a player's rank (§B2), and rank arrives per-*player* while `opts.rank` is
per-*World*. The structurally correct fix is to move the check off `WorldOpts` and onto the
soldier: `s.rankId` is already stamped (`world.ts:1079`) and already read elsewhere
(`world.ts:2444` `leadershipRadius(o.rankId ?? 0)`). Then gate on `caller.rankId` in
`requestLsw`, and have `join` carry a claimed-then-verified rank.

Secondary note: `lswAllowed` (`src/sim/lsw.ts:816-818`) excludes only `paintball`, `range`, `race`,
`timetrial` — every server mode is stable-eligible.

---

## B4 · SINGLE-PLAYER vs MULTIPLAYER — one sim, two drivers

**Confirmed: they share one deterministic simulation.** There is exactly one `World` class
(`src/sim/world.ts`) and one `World.step`. Both paths call it:

| | Single player | Multiplayer |
|---|---|---|
| Sim owner | the browser | the server room |
| Step call | `main.ts:1427` — fixed accumulator, `world.step(FIXED, cmds)` | `server.ts:202` — `this.world.step(TICK, cmds)` inside the wall-clock accumulator (`:115-121`) |
| Input | `input.buildCmd(me, camera)` straight into the cmd map (`main.ts:1426`) | same `buildCmd` (`net.ts:138`) → JSON → `pushCmd` → `drainCmd` → the cmd map |
| Client world | the authoritative one | `createPuppetWorld` (`snapshot.ts:29-44`), `puppet = true`, extrapolation only (`net.ts:148`) |
| Map agreement | trivially the same object | same `(seed, mode, theme, theaterId)` **plus** a `mapIdentity` fingerprint asserted at welcome (`snapshot.ts:22-27`, `:37`) |
| Determinism guarantee | `World` never reads `Date.now` — the day-phase is an *input* (`WorldOpts.clockPhase`, `world.ts:428`); bot race AI is explicitly RNG-free (`bots.ts:790-792`) | same |
| Killcam / highlights | `ReplayDirector` | **the same** `ReplayDirector` (`net.ts:57`, `:156-158`) |
| Match-end onboarding | `onMatchEnd` | **the same** (`net.ts:196`) |

**The fallback path** — `src/main.ts:799-810`:
```ts
if (serverUrl && selectedMode !== 'science' && !selectedMilitaryMissionId) {
  const net = new NetGame(serverUrl, name, selectedClass, selectedMode, currentLoadout(), chat, hud, isCommissioned(dossier));
  try { await net.connect(); }
  catch {
    hud.announce('Could not reach server — falling back to offline bots', true, 0);
    startLocal(renderer, dmgText, hud, input, desk, name, endGame);
    return;
  }
  net.run(renderer, dmgText, hud, input, endGame);
  return;
}
```
So: **empty URL ⇒ offline. Unreachable URL ⇒ 5 s timeout (`net.ts:45`) then offline, announced.
Science mode with a URL ⇒ forced local with a notice (`main.ts:812-814`).** Mid-match disconnect is
*not* a fallback — `net.ts:119-123` announces and returns to the menu after 2.5 s.

---

## B5 · TRAPS FOR A NEW DEV

### B5.1 · `takeSnapshot` replicates by whole-object spread — new fields ride free, and so do secrets
`snapshot.ts:97-107` spreads live sim objects (`{...stripBot(s)}`, `[...w.vehicles.values()]`).
Add a field to `Soldier` or `Vehicle` and it replicates automatically — **including** anything you
did not intend to reveal. Only `botGoal/botRepathAt/botTargetId/botStrafeDir` are stripped
(`snapshot.ts:74-77`). The quantizer is deliberately at the `JSON.stringify` boundary, not in
`takeSnapshot` (`snapshot.ts:83-91`), precisely to preserve that spread invariant — don't move it.

### B5.2 · The server does **no** schema validation on `cmd`
`server.ts:460-461` pushes `msg.cmd` — whatever JSON arrived — straight into the queue. The sim has
a partial "seam sanitizer" (`world.ts:3915-3929`) that clamps `moveX/moveZ` finite and normalizes
**down only**, so a `moveX: 1000` speed hack does not work. But **`aimYaw` is unguarded**:
`world.ts:3269` is a bare `s.yaw = cmd.aimYaw`, so a `null`/string `aimYaw` propagates NaN into the
soldier. `aimDist`, `dash`, `leap`, `lob`, `weaponSlot`, `k9` are likewise untyped at the boundary.
Any hardening pass starts here.

### B5.3 · Snapshot events are lossy **by design** on the client
`net.ts:85-95`: when `document.hidden`, incoming `snap.events` are **dropped outright**, and when
visible the buffer is capped at 300 (oldest shed). This is deliberate (a background tab used to
burst minutes of killfeed/audio/particles on refocus). Consequence: **never make gameplay state
depend on receiving an event** — the snapshot body is the only thing guaranteed to arrive.

### B5.4 · `mapHandshake` / `assertMapIdentity` will reject any server-side map substitution
`createPuppetWorld` (`snapshot.ts:29-44`) rebuilds the map **from `(seed, mode, theme, theaterId)`
alone** and then asserts the fingerprint (`snapshot.ts:37`). A room that hands out a `map:` built
from data the client cannot regenerate — e.g. a built race track (`buildTrackMap`), a geospatial
city, a Place — will hard-fail the handshake. Networking racing therefore needs a map-transfer or
track-id channel, not just an entry in `MODES` (`server.ts:33`).

### B5.5 · The cull is per-client and runs at snapshot cadence
`server.ts:204-211` calls `cullSnapshotFor` **once per connected client per snapshot** (15 Hz), and
each call rebuilds the friendly-eyes array and runs LOS per entity (`snapshot.ts:188-216`). It is
`O(clients × entities × eyes)`. With 12v12 + bots this is the server's dominant per-frame cost.
`cullSnapshotFor` is documented pure (`snapshot.ts:175`) — keep it that way or per-client culling
starts mutating shared state.
Also: **a viewer the server can't find gets the uncut snapshot** (`snapshot.ts:177-178`,
*"spectators see the war whole (admin surface)"*). If a spectator/observer socket is ever added,
that line is a full-map ESP feed.

### B5.6 · Chat is broadcast; the TEAM filter is client-side
`relayChat` (`server.ts:152-161`) sends every line to **every** client in the room; `net.ts:97-100`
is what hides the other team's TEAM channel. A modified client reads enemy team chat. (Waypoints,
by contrast, *are* server-filtered — `server.ts:164-173`.) There is no mute, no rate limit, no
profanity handling; `docs/DESIGN-DIRECTIVE.md:1360` calls those Stage 2.

### B5.7 · `restart()` re-welcomes but does not re-send loadout or dog handlers
`server.ts:220-245` re-adds each human as `addSoldier(name, classId, team, 'human')` with **no
loadout argument** — the loadout supplied at join (`server.ts:134`) is dropped on match restart.
`resetCmdQueue` is called (`:236`), which is right; the loadout omission is a bug.

### B5.8 · `input-queue` semantics are subtle and tested — read them before tuning
`src/server/input-queue.ts:1-19` documents two real failure modes (lost one-shot presses when
jitter bunches two cmds into one tick; stuck held-inputs from a dead tab). The contract:
one drain per tick; a starved tick repeats the last cmd with **one-shots zeroed**
(`zeroOneShots`, `:44-46`); past `STALE_MS = 250` movement/fire are forced to zero (`stall`, `:49-51`).
`tests/input-queue.test.ts` is the law. Raising `CMD_QUEUE_CAP` (8) trades latency for press
fidelity; the queue drains at exactly 30/s so a deep queue is pure added delay.

### B5.9 · The mailbox is in-memory and callsign-keyed
`server.ts:40` — a plain `Map`, wiped on restart, capped at 20 per callsign (`:469`), keyed by
lowercased name (`:466`, `:142`). It is also the impersonation surface noted in §B2.

### B5.10 · Timing details that bite
- `TICK * 500` polling (`server.ts:121`) = poll at 2× tick rate; a due tick lands within half a tick.
- Owed ticks are capped at 5 (`server.ts:119`) — a hard stall **drops** sim time rather than
  death-spiraling. Don't raise it.
- `Infinity` does not survive JSON: `timeLeft` and gadget/clip/reserve fields are encoded as `-1`
  on the wire and decoded back (`snapshot.ts:79-81`, `:96`, `:99-100`, `:107`, `:228-229`, `:239-240`, `:252`).
  Any new possibly-infinite field must be added to **both** ends or it arrives as literal `-1`.
- The client exits **before** the server restarts its room: `MATCH_LINGER_NET_MS` (`net.ts:198`)
  vs the server's 12 s (`server.ts:215`).

---

## Appendix — files that matter, at a glance

**Racing:** `src/sim/data.ts:390`+ (VEHICLES) · `src/sim/garage.ts` (128) · `src/sim/tracks.ts` (190) ·
`src/sim/map.ts:957` `generateRaceTrack`, `:1035` `buildTrackMap` · `src/sim/modes.ts:344-455` (race),
`:764-797` (derby), `:806-861` (school) · `src/sim/boardtricks.ts` (222) · `src/sim/bots.ts:793` (race AI) ·
`src/sim/world.ts:2044` `setFit`, `:5936-6180` drivetrain, `:6272-6310` landing, `:6318` board gate ·
`src/client/records.ts` (91) · `src/client/ghost.ts` (88) · `src/client/garage-ui.ts` (121) ·
`src/client/admin.ts:118-249` (builder) · `src/client/gonet/sports.ts` (182) · `src/main.ts:103-148`,
`:1177-1207`, `:1436-1460`, `:1548-1585`.
**Tests:** `tests/garage.test.ts` · `tests/tracks.test.ts` · `tests/track-build.test.ts` ·
`tests/race.test.ts` · `tests/race-ai.test.ts` · `tests/race-press.test.ts` · `tests/board.test.ts` ·
`tests/hoverboard.test.ts`.

**Multiplayer:** `src/server/server.ts` (500) · `src/server/input-queue.ts` (72) ·
`src/server/warroom.ts` (149) · `src/sim/snapshot.ts` (308) · `src/client/net.ts` (204) ·
`src/client/chat.ts` (257) · `src/client/stable.ts` · `src/main.ts:743`, `:799-814` ·
`package.json:11`.
**Tests:** `tests/input-queue.test.ts` · `tests/culling.test.ts` · `tests/fogcull.test.ts` ·
`tests/warroom.test.ts`.
