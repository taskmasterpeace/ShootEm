# WAR WORLD: EARTH — Shipping Log

The public record of what shipped, written for players and backers — not engineers. Newest first. Versions anchor to `docs/VERSION`.

---

## Unreleased — 2026-07-21 · "Every Door Goes Somewhere"

### New

- **Five Science Missions are always one click away.** The Deploy screen now
  opens with K9 House Clear, Researcher Rescue, Clone Vault Raid, Quarantine
  Sweep, and Airfield Ambush. Each card loads its intended class, environment,
  deterministic site, and eight-print reserve without spending campaign data.

- **Handlers can clear a house with their dog.** Infantry and Engineer players
  now own the friendly K9 in offline battles and Science Missions. Aim at a
  building and press **K / L3 / SIC**; press **L / R3** for Stay and again for
  Heel. The live command deck reports clearing and closed-door waits.
- **The dog knows the boundary of the order.** It can find hidden or cloaked
  hostile occupants inside the assigned building, sweep all three storeys by
  stairs, and bite with the existing K9 weapon. It refuses ladders, doors, and
  intact glass. A closed door waits for the human to open it, then the same
  sweep continues.

- **The world has addresses.** 168 countries and 1,050 cities now drive the
  architecture and security of Science Mission sites, with city provenance in
  briefings and aftermath reports.
- **Whole buildings, one to three storeys.** Nineteen residential, commercial,
  industrial, civic, and military structures combine thin room walls, proper
  doors, windows that break, balconies, courtyards, stairs, ladders, shutters,
  and complete facades.
- **A real city Map Maker.** Pick a country and city, generate a building, move
  between Ground/L2/L3, paint the architectural vocabulary, inspect operation
  sockets and live laws, export/import it, walk an open-topped 3D model, or
  launch the generated Science Operation directly.
- **Security knows the house.** Guards investigate sounds, search rooms, share
  doorways, answer alarms upstairs, and return to post. Civilians seek shelter.
  Dogs track recent scent through darkness and cloak, use stairs but refuse
  ladders, pause at intact glass, bark alarms, and pull victims off position.
- **Print reserves shape the opposition.** A 1-print infiltration stays small;
  an 8-print assault deals more patrol sectors, dog teams, and a reserve wave
  without stacking the entry room.

### Verification record

- Desktop and 390px in-app playtests launched **K9 House Clear** as Hunt at an
  officer villa with the Infantry handler kit, then **Researcher Rescue** as
  Rescue at a research annex with the Field Medic kit and eight prints. All
  five cards stayed readable and keyboard-addressable; the browser reported no
  runtime errors.

- The in-app production playtest assigned the friendly dog to the local
  handler, exercised Stay → Heel, issued SIC at a visible building, and watched
  the live deck transition **HEEL → CLEARING → WAITING · DOOR**. The dog stopped
  outside the closed entry and the browser reported zero runtime errors.
- Focused simulation coverage proves hidden Level-3 acquisition, stair-only
  routing, nose-radius pinging, bite damage, ladder refusal, closed ground and
  upper-door waits, human-opened continuation, intact glass, Stay anchoring,
  Heel recall, two-second clear confirmation, snapshot replication, command
  authority, and non-repeating network one-shots.

- In-app browser playtests generated a three-storey Belgrade command villa,
  mall section, and secure archive. All six battlefield laws and all eight
  whole-building laws passed; Ground/L2/L3 editing, exploded and open-topped
  3D views, provenance, and direct Science Operation launch worked with zero
  console warnings.
- Deterministic mission playtests cover print reserves 1–8 at low and high
  security, every Science verb across residential, commercial, and military
  sites, multi-floor objectives/extraction, guard search, dog scent/stairs,
  and dog ladder refusal.
- Fresh release gates pass: TypeScript emits no diagnostics; the full suite is
  **157 files / 1,739 tests** green; ESLint reports zero errors; and Vite emits
  the production bundle.

### Fixed during visual production

- Courtyard voids could become sealed orphan pockets even while structural
  building laws were green. Ground-floor courts now receive a deliberate door,
  and launch requires both battlefield and whole-building law suites.
- The Matchup panel could cover the right half of the Map Maker after switching
  tabs. Hidden tool surfaces now remain hidden.
- The old harness preview only drew full-tile battle walls, making a three-floor
  science building look like an empty perimeter. It now renders thin walls,
  glass, balconies, stairs, ladders, shutters, floor slabs, and all storeys at
  building inspection scale.

---

## v0.10.0 — 2026-07-21 · "Science Has a Body Count"

### New

- **Science Missions are playable.** Ten verbs combine with ten compact sites,
  six complications, 1–8 committed clones, ordinary War World guns/classes,
  manual doors, guards, rescue scientists, moving transports, LSW security,
  quarantine zombies, objective scripting, extraction, and an immediate field
  printer reprint loop.
- **The rooms fit the fight.** Science stencils use thin oriented walls and
  door-like slabs instead of battle-map masonry blocks. The officer's villa is
  always a real two-storey job with a required upstairs objective and a
  downstairs extraction.
- **Science reaches the war.** Each front grants two sortie windows per pass.
  Clone loss, Ghost bonuses, reward banks, control/clones, Morning Dispatch,
  and Front Courier issues share the existing campaign save and are applied
  once per operation ID. Free Play remains consequence-free.
- **The Scar shows the books.** The selected front shows its operation,
  committed prints, payment, windows, enemy-print pressure, and insurance; the
  theater science bank exposes every persisted strategic reward counter.

### Verification record

- Browser playtest launched `SM-5EPM · STEAL · OFFICER VILLA` with four live
  clone pips and the opening-materiel payment, `SM-62QM · DENY · QUARANTINE
  ZONE` with three denial points and the third-party substrate, and `SM-0Q3D ·
  HOLD · CLONE VAULT` under the live storm system. All three rendered the field
  printer, compact perimeter, thin building shell, objective rail, minimap, and
  mission card with zero console warnings.
- The focused production suite passes **80 checks across six files**. It drives
  every verb from primary objective through extraction; proves villa floor
  separation; alarm and reinforcement transitions; Rescue captives; moving
  convoy failure; clone-pip decrement; 0.25-second printer reprint; final-clone
  failure; two-window refresh; permanent and retry-next-window clone policies;
  idempotent campaign/Courier closeout; all twelve reward adapters; and escaped
  newspaper/HUD copy.
- Fresh release gates pass: TypeScript emits no diagnostics; the full suite is
  **141 files / 1,640 tests** green; ESLint reports zero errors; and Vite emits
  the production bundle (including the dedicated science chunk).

### Fixed during production playtest

- Compact sites initially buried the unused 100×100 world under roughly 9,400
  wall tiles. They now use one bounded perimeter and keep total solid masonry
  below 300 tiles, eliminating the static-geometry spike without opening an
  escape route.
- Villa objective sockets originally lived only on the ground floor, and an E
  interaction directly beneath an upper marker could count. The required
  socket now lives at `y=4`, actors carry the correct floor, ladder reachability
  is verified, and cross-floor interactions are rejected.
- Decorative scientist actors on unrelated verbs spawned as friendlies, so
  security opened fire on them at mission start. Captives now spawn only for
  Rescue, where their survival is an actual fail condition.
- Alarm-net now starts hot and schedules its response team. The no-kill clause
  now permits the named required target while correctly failing on collateral
  security.

---

## v0.9.0 — 2026-07-21 · "The Air War to The Outbreak"

**Momentum: 43 commits in 37 hours.** 547 files touched, ~8,000 lines added, the automated battle-test suite grew to **1,355 passing checks**, and the download shrank **73%** — all between the afternoon of July 20 and the small hours of July 21.

### New

- **The sky has floors.** Aircraft now fly in three altitude bands — tap Q to climb a level, E to dive one, and on the deck E becomes the door. Jets earn the sky: a real afterburner stretch, and when you cross the threshold **the sound barrier visibly breaks** — a vapor ring snaps off the fuselage and distant listeners hear the double-crack *late*, because that's how physics works.
- **Every gun is real now.** All weapon families have actual 3D models — six manufacturers each change the silhouette (vents, slabs, drums, coils), and higher marks visibly dress the barrel. Soldiers carry the exact gun they're firing; an armory contact sheet shows the whole catalog.
- **THE OUTBREAK.** The dead are now a system, not a spawn point:
  - Infection is separate from damage — armor stops the claw, not the contamination. Exposed soldiers incubate, and untreated they **TURN — your own side rising against you**. Medics are the cure.
  - Bodies that die hot rise on a clock, **by name**. A corpse warning fires in the final seconds — burn it or meet it.
  - Blasts, incendiary rounds, and bio-neutralizer deny corpses. Fire is policy.
  - A sector-wide **Outbreak Level (0–4)** climbs from CLEAR to SECTOR LOST, driven by real conditions — bodies, bites, and nests — with biohazard alerts as it escalates.
  - **The body decides the form**: scouts rise as sprinters, heavies as brutes. Sprinters spawn *dormant* — light, noise, or proximity wakes them, and only once.
  - Leave corpses piled and they **curdle into contamination nests**: infected inside run hotter, and bodies that rot there rise *mutated*.
- **Seven ammunition types.** Tap B to cycle Ball → Armor-Piercing → Incendiary → Tracer → Subsonic → Expanding → Bio-Neutralizer. Each solves a different battlefield problem — AP threads plate, INC burns the dead, TRC marks what it hits, SUB trades reach for silence.
- **Close combat is a contest now.** The full counter triangle: **STRIKE beats GRAPPLE beats GUARD beats STRIKE.** Every soldier carries a combat knife (F), a held guard blocks and *parries* (V), a grab pins through a raised guard (Z), and holding F winds up an **Impact Charge** — quick, heavy, maximum, or a fumbled overcharge if you're greedy. When a zombie latches on, it's a **Bite Struggle**: mash free before the jaws close.
- **The downed experience speaks.** A breathing bleedout banner with the clock, a pulsing ground ring under every fallen friendly, and a revive arc that closes around the body as the medic works.
- **The HUD tells the truth.** Grenade pouches as refilling pips, a spawn-protection shell you can see expire, **MISSILE INBOUND** warnings with flare counts, the enemy god's drop countdown with a tightening landing ring, and the mounted gun's recharge cycle on the vehicle panel.
- **The war has a memory.** Print counters on every clone, HR streak notices for kill runs, a flesh-vs-chrome scoreboard ledger, and a deadpan weather desk calling the sky.
- **The Codex grew war intelligence** — ASCENDANTS and THREATS pages: every god and every horde unit, with real shots-to-kill numbers.

### Improved

- **The game runs dramatically better under load** — four optimization waves, each proven on a public benchmark graph:
  - The horde stress-wall moved to **~790 simultaneous zombies** inside the frame budget (per-team spatial index).
  - Bot thinking under a horde got **26–37% cheaper** (objective caching).
  - The download shrank from **173MB to 47.6MB** (audio re-encoded, nothing cut).
  - Multiplayer inputs queue per-client — no eaten button presses, no stuck-walking after tabbing out.
- The game has its name: **WAR WORLD: EARTH**, on the masthead.

### Fixed

- Hover unit-tags and enemy health rings never appeared in offline matches — now they do everywhere.
- A hand-tuned pass from a live playtest: vehicle hulls, flame behavior, god balance, and meters that weren't drawing.

---

*Log begins at v0.9.0. Earlier history lives in git. Rendered page: `docs/whats-new.html`.*
