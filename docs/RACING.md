# THE CIRCUIT — Racing Destruction Set, reimagined
### Status: **BUILT** — the card, the garage, the landings, the weapons, the records and the builder all ship. Two disciplines remain shells. Verified against code 2026-07-23 (`422a9bc`).

> **This document was STALE until 2026-07-23.** It listed traction, shock, tires, engine and cargo as "▶ build" — all five had shipped. If you are reading an old copy: **grep before you build.** The status table below is cited.

### Robert, 2026-07-23, with the RDS stat cards + track editor on screen:
> *"think Racing Destruction Set, where you can build tracks, you can race, and there's an aspect where you can drop mines behind you… but keep in mind this thing got elevation, it got jumping, they got motorcycles — if we could have the motorcycles and the cars land in a realistic way, then I think we might have something special."*

---

## 0 · FOR THE NEXT AI

Racing is a **real sport inside the war game**, not a minigame: it shares the war's drivetrain, materials table, vehicles and news. A finished race files a press issue, the newspaper runs a sports headline and the GONET broadcast cuts a sports reel — the circuit lives in the same paper the war does.

**The files that ARE the feature:**
| File | What it owns |
|---|---|
| `src/sim/data.ts` (`VEHICLES`) | 80 hulls and their cards (mass, traction, shock, slip…). |
| `src/sim/world.ts` drivetrain (~6000–6330) | Heft, traction, the airborne state, the landing, roadkill. |
| `src/sim/garage.ts` | Tires / engine / chassis / cargo — every fit a sidegrade. |
| `src/sim/modes.ts` | `stepRace`, `stepDerby`, `collectRacers`, `stepSchool`. |
| `src/sim/tracks.ts` | The parts box: pieces, `walkTrack`, validation, `RACEABLE_WIDTH`. |
| `src/sim/map.ts` | `generateRaceTrack` (the procedural oval) and **`buildTrackMap`** (built track → raceable map). |
| `src/sim/boardtricks.ts` | The hoverboard trick economy. |
| `src/client/records.ts`, `ghost.ts` | Lap records and the ghost line. |
| `src/client/gonet/sports.ts` | The league: disciplines, fixtures, standings. |

**The one thing to know before touching it:** the road must be at least **`RACEABLE_WIDTH` (20 units)** wide or cars and trucks pile into the corners and the field strands. That number is measured, not guessed (`tracks.ts:55`).

---

## 1 · WHAT THE CODE DOES

### 1.1 THE CARD — every RDS line, shipped
| RDS line | Ours | Status | Consumed at |
|---|---|---|---|
| WEIGHT | `mass` (tonnes) | ✅ | `heft` — `world.ts:6093` |
| TOP SPEED | `speed` | ✅ | `world.ts:6066` |
| ACCELERATION | derived (power-to-weight) | ✅ | `garage.ts accelRating` |
| **TRACTION ICE / DIRT / PAVED** | `traction:{ice,dirt,paved}` × the floor's material grip | ✅ | `world.ts:6104` |
| **SHOCK STRENGTH** | `shock` — force absorbed before damage/bounce | ✅ | `world.ts:6272` |
| **TIRES** | rewrite the traction triple | ✅ | `garage.ts:105` |
| **ENGINE** | top end vs launch | ✅ | `garage.ts` |
| **CHASSIS** | mass vs hull | ✅ | `garage.ts` |
| **CARGO** (mines/oil/armour/crusher) | each adds mass | ✅ mostly | **`crusher` is 👻 dead — nothing reads it** (`garage.ts:86`) |
| SLIP / drift | `slip` | ✅ | `world.ts:6115` |

**The landings are real.** Wheeled/surface hulls leave the ground over terrain steps, gravity owns them, and arrival is judged `mass × −vSpeed` against `shock`: under it you stick it, over it you bounce, scrub and take crash damage. *A bike is a stunt; a laden truck is a wreck.*

### 1.2 The weapons and the contact
- **MINES** — 6 out the back, **arm 1.2 s late** so you cannot suicide (`world.ts:3746`).
- **OIL** — 4 slicks; anything crossing drives on ice 2.5 s (`world.ts:2913`).
- **ARMOUR** — ×1.35 hull (`garage.ts:103`).
- **CRUSHER** — 👻 flavour only. Adds 0.45 t, nothing reads the flag: fitting it is a strict downgrade.
- **Hull-to-hull collision** — mass-weighted impulse + crash damage billed to both (`hullcollide.ts`). A jeep no longer passes through a tank.
- **Roadkill** — a driven ground hull > 6 u/s damages an on-foot enemy (`world.ts:6316`).

### 1.3 The disciplines (`sports.ts`)
| Discipline | Live? | Reality |
|---|---|---|
| CIRCUIT | ✅ | `stepRace` — grid countdown, lap banking, fastest-lap, first-to-N wins, files a record **and a press issue**. |
| TIME ATTACK | ✅ | the trial branch — you, the circuit and your own ghost. |
| DEMOLITION | 🔴 **LAUNCH-BROKEN** | `stepDerby` is written and correct, but **a derby deploy spawns zero hulls**: `map.ts:1211` and `main.ts:959` carve a `raceTrack` (and therefore a start grid) only for `race\|timetrial`. With no grid, nothing is seated, and `stepDerby` ends the match at **~4.6 s with no winner**. Verified by running the World directly. |
| GUN RUN | ⬜ | `live:false`. No fixed-forward race armament exists. |
| FREESTYLE | ⬜ | `live:false`. **The trick economy is fully built** (§1.5) — this needs only a scored, no-finish-line session. |

### 1.4 Track creation — the builder reaches the track now
- **The parts box** (`tracks.ts`): 9 piece kinds (straight, curve L/R, chicane, ramp up/down, jump, bank L/R), each with its own **WIDTH · HEIGHT · SURFACE**. `walkTrack` is the centre line; `validateTrack` gives the verdict (closes? fits? long enough? **wide enough?**).
- **The editor** is behind the Admin Room door (`client/admin.ts`) — creator-only by Robert's ruling. Saves to the `ww_tracks` shelf, exports JSON.
- **`buildTrackMap`** (`map.ts`) is the bridge that was missing until 2026-07-23: it carves a built track into a real `GameMap` — an open corridor through sealed ground, **each piece paved with its own surface**, rounded corners, checkpoints and a start grid off the same centre line.
- **Ramp pieces author real terrain height** with the graded-ramp flag — built tracks are the **only** generator in the game that writes `map.height`.
- **Pick it at deploy:** the race screen's CIRCUIT row lists the shelf; choose one and drive it.

### 1.5 The board (the trick economy) — ✅ complete, ⚠ but not on the race boards
`boardtricks.ts` + `world.ts:5658`. Airtime + spin (180→1080) + grind + wall-ride + power-slide build an unbanked **combo**; the **landing** decides bank-or-bail; a clean land banks combo × multiplier into **boost** and climbs the multiplier (cap 6); a bad land **BAILS**. All nine canon verbs driven by steering, not trick buttons.

> ⚠ **It is gated to `kind === 'hoverboard'`** (`world.ts:6318`) — so the three **raceboards** the sport actually offers (comet / vector / sprite) do **not** get tricks. The most complete system in the slice has no mode to score it *and* is switched off for the machines you race on.

### 1.6 Records, ghosts, the league
- **Records** (`client/records.ts`) — account-level, per class (bike/car/truck/board): best lap, best race, **holder's name**, hull, date. `fileRun` reports whether a record was *taken* and from whom. ⚠ **The "track" key is the THEME** (`main.ts:1553`) — not the track id and not the seed. Every circuit on a given theme, procedural or hand-built, shares one record.
- **Ghost** (`ghost.ts`) — samples ~20 Hz and replays your best lap beside you. Client-only; never touches the sim. 🔴 **But the ghost key includes the per-deploy random seed** (`main.ts:944`, `:1286`), which changes every launch — so **a saved ghost is never loaded back.** You race against a ghost only within the session that recorded it.
- **The league** (`gonet/sports.ts`) — disciplines with rules and what-they-train, deterministic weekly fixtures, standings off the record board, and an ENTER that launches the real mode.

---

## 2 · WHAT WE ARE AIMING AT

**Why RDS is the right ancestor** — the 1985 card is a complete vehicle language in eleven lines, and three of its ideas beat what modern racers do:
1. **Traction is three numbers, not one "grip" stat** — a *profile* you read on the card before you drive. We already had the substrate: the materials table gives every floor a grip value.
2. **Shock strength** — a suspension number, because the track has elevation and jumps. This makes "land in a realistic way" a *rule* instead of an animation.
3. **The cargo row is the loadout** — mines, oil, armour, crusher. Weight you *choose* to carry, and mass is already real in our sim. **The trade is the fun.**

**The garage stays shallow** (Robert: *"not too deep, but a little bit of modification"*) — four slots, every fit a **sidegrade**.

**Racing is a sport, and the sport is public.** Robert: improve it, *"add DEPTH so it feels like an engaging sport, and TIE RESULTS INTO THE NEWS"*, and it must work **single and multiplayer**.

**Records are the reason to come back** — *"keep track of who got the best time on what track."*

**The builder is the creator's** — *"creating the track is just for me, the creator."*

---

## 3 · THE GAP, RANKED

0. 🔴 **Demolition does not launch** (§1.3) — no grid is carved for `derby`, so no hulls spawn and the match ends in ~4.6 s. One of the three "live" disciplines is dead on arrival.
0b. 🔴 **The ghost never loads back** (§1.6) — its key contains the per-deploy random seed, so your best lap is unreachable next session. The feature works only within one launch.
1. **No season.** "Standings" is a record-count leaderboard, not a league table — no points, no championship, no persisted results. This is the biggest thing between "modes you can enter" and "a sport".
2. **Fixtures do not carry through.** A fixture names a venue and class; `enterSport(mode)` passes only the mode, so entering a fixture does not race *that* fixture.
3. **Records key by THEME** — every circuit on a theme shares one record, so a hand-built track cannot own its own board.
4. **Gun Run and Freestyle are shells** — and Freestyle is nearly free, except the trick economy is switched off for the raceboards (§1.5).
5. **The procedural oval is flat.** Elevation, ramps and jumps exist only on **built** tracks, so the default circuit cannot deliver "the something special".
6. **No overpasses or railings**; the boundary is a wall.
7. **`crusher` is a shop item with no mechanic.**

---

## 4 · OPEN QUESTIONS

1. **Is SPORTS a league or a launcher?** If a league: points, a season calendar, persisted results, fixtures that pass venue+class into the match. If a launcher: stop showing standings as if they mean more.
2. **Should `generateRaceTrack` author elevation**, or does terrain stay a built-track feature?
3. **Multiplayer racing** — a ranked online sport (needs matchmaking + a ladder, see `MULTIPLAYER.md`), or local + async ghosts and shared record boards?
4. **Should records key by track identity** rather than seed? (I think obviously yes — but it migrates the existing board.)
5. **What is Gun Run, exactly?** Fixed forward armament only, or the full garage weapons?

---

## 5 · MY RECOMMENDATION

**First, three small fixes — because right now a third of the sport is quietly broken.** These were all found by *driving* it, not reading it, and none is more than a few lines:
1. **Carve a grid for `derby`.** One mode-list edit in `map.ts:1211` / `main.ts:959`. A whole advertised discipline currently ends in under five seconds with no winner.
2. **Take the random seed out of the ghost key.** Your best lap is being saved and never read. The ghost is one of the best feel features in the game and it is effectively off.
3. **Key records by track identity, not theme.** Otherwise a hand-built circuit can never own its own board — and the whole point of the builder is that people set times on *your* track.

**Then build the season. It is the one thing standing between "racing works" and "racing is a sport."**

Everything a league needs already exists and is *derived from real play*: results file to the press, records carry holders' names, fixtures generate deterministically, and the disciplines are real modes. What is missing is a table that remembers. Add a `Season` store (rounds, points per finish, standings keyed by **track id**), have the finish path write to it, and let the GONET show a real championship. That single addition makes every race matter to the next one — which is the definition of a sport, and it is exactly Robert's *"add DEPTH so it feels like an engaging sport."*

**Then ship Freestyle, because it is nearly free.** The trick economy is the most complete system in this slice and has nowhere to be spent. A scored, no-finish-line session reading the combo bank is a small mode that immediately doubles the board's reason to exist.

**Then give the procedural oval elevation.** `buildTrackMap` already proves terrain works and is the only generator writing `map.height`; teaching `generateRaceTrack` the same trick is contained work — and it is the literal thing Robert called "the something special". Today you can only get it by hand-building a track.

**Fix the record key while the board is still small.** Keying by deploy-seed instead of track id is a latent data bug that gets more expensive with every lap anyone sets.

**What I would not do:** add more vehicles. 80 hulls with a real card each is not the constraint — the constraint is that nothing remembers what you did with them.

---

## 6 · TRAPS

- **`collectRacers` used to filter boards only** (`modes.ts`), silently voiding every car/truck/bike race — no laps, no winner, no record. It now counts every grounded hull. If lap counting breaks for a class, look here first.
- **The start grid must be laid along the track's ARRIVAL heading**, not `startYaw`. They differ on any circuit that closes through a corner; laying it the wrong way spawns the whole field in one pile.
- **A polyline corner is a square wall.** `buildTrackMap` rounds the vertex — keep the rounding or wide hulls drive into the outside of every turn.
- **`RACEABLE_WIDTH = 20` is measured.** Below it boards thread and cars strand. The builder warns but does not refuse — a narrow board-only circuit is legitimate.
- **`setFit` must preserve the health FRACTION.** It used to clamp `hp` to the new ceiling and never raise it, so fitting armour put a fresh car on the grid at 85/115.
- **Sports never bleed.** Crash damage lands on the unarmoured driver, so `bare` is true and gore would spray on the circuit. `isSportMode` in `renderer.ts` exempts race/timetrial/derby/paintball.
- **THE BOARD is the war desk** — switched off for race/timetrial in `main.ts`; demolition keeps it.
- **The ghost is client-only.** Never let it touch the sim, or you lose determinism.

---

*Verified against `main` at `422a9bc`, 2026-07-23. See `FEATURES.md` for the trust rule.*
