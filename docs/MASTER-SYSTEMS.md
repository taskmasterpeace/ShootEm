# WAR WORLD: EARTH — THE MASTER SYSTEMS DOCUMENT

### Every system in the game, its true build status, what remains to finish it, and the questions only Robert can answer. Written by reading 100% of the source — not the design docs. Where a doc and the code disagree, **the code wins.**

> **Robert asked:** *"check 100% of the code… a master document of all of the systems that we need to finish building, all the other systems that are not built… we need to ask stuff for the animals, the dogs, the officers, the certifications. Give me all of that, all of the details, go to 100% of the code."*
>
> This document answers that. It was assembled by walking every module under `src/` — 63 sim files, the `sim/ai/` brain, all 42 per-god `sim/lsw/` files, the `sim/theaters/` builders, ~75 client modules, the 11 GONET apps, the 7 model builders, the multiplayer server, and `main.ts` — cross-checked against the two prior source-audits (`STATISTICS.md`, `COMMAND-AUDIT.md`). Nothing here is taken from a design doc on faith; every claim carries a `file:line`.

---

## 0 · HOW TO READ THIS

### 0.1 The status legend (the whole point)

Every system carries one tag. "We have it" and "the code uses it" are different sentences, and this document only cares about the second.

| Tag | Meaning | The test it passed |
|---|---|---|
| **✅ WIRED** | Real. Code that changes what the player experiences reads this and acts on it. | There is a `file:line` where the value/behaviour is consumed and the outcome changes. |
| **🟡 PARTIAL** | Works, but a named piece is missing or reactive-only. | It runs, but the audit names the specific half that isn't built. |
| **👻 INVISIBLE** | The code runs and affects the sim, but the player sees **no evidence** of the mechanism. | Grep finds a consumer, but no HUD/audio/UI surfaces it. From the seat it feels identical to "not built." |
| **⬜ UNBUILT** | Named in canon/docs (or stubbed in a table), no working consumer. | Only prose, or a field nothing reads. |

**👻 INVISIBLE is the tag Robert feels most.** When he says "I never see any evidence," he is almost always pointing at an INVISIBLE system: it *is* built, it *does* run, but nothing on screen tells him so. Those are cheap to fix (add a line, a pip, a readout) and they are called out throughout.

### 0.2 The honest one-paragraph verdict, up front

**The fight is real. The world around the fight is half-real. The RPG layer on top is mostly a promise.**

- **Combat & AI** is the deepest, most-wired system in the game: real A\*, multi-storey pathfinding, full perception parity, a complete damage→down→bleedout→revive model, per-class doctrine, emergent objective roles. Its one honest weakness is *tactics* — bots fight standoff-and-strafe in the open; there is no flanking, no fighting-from-cover, no squad coordination, and no strategic commander.
- **Vehicles, weapons, materials, weather, terrain, the clock, the LSW threat table** — all genuinely wired. You can feel every number.
- **The GONET laptop** is a real desktop of apps (mail, broadcast, sports, music, briefings) — the most complete "meta" surface.
- **The gaps live in three places Robert keeps pointing at:** (1) the **RPG progression** — 5 of 8 master stats and 14 of 22 skills are generated-and-shown but inert, decay is unbuilt; (2) the **command/officer layer** — one-fifth real, and the part Robert pictures (seats, a visible AI commander, taking command) does not exist in the build; (3) the **living-world entities** — there is a real K9 dog brain but no player-fieldable dog, no walking pedestrian, no vigilante entity, and no other animals.
- **Multiplayer** is a thin real spine (a server that relays the god-call) with an entire political/seat layer unbuilt behind the missing accounts backend.

The three sections Robert named — **Dogs/Animals (§10)**, **Officers/Command (§11)**, **Certifications (§12)** — are the deep-dives, and each ends with the concrete questions he must answer.

### 0.3 Where the questions live

Every section ends with **OPEN QUESTIONS** where a real design fork exists. They are also collected at the end (§27) into one punch-list, grouped, with the dogs/officers/certifications decisions at the top because those are the ones Robert asked for by name.

---

## 1 · THE COVERAGE MAP — proof this reached 100% of the code

Every source module in `src/`, the system it belongs to, and the section that audits it. This is the "you actually checked all of it" table. Line counts are the module's size; **∑ ≈ 80,000 lines of source.**

### 1.1 Simulation core (`src/sim/` — the deterministic engine)

| Module | Lines | System | Section |
|---|---|---|---|
| `world.ts` | 8178 | The sim spine — damage, firing, physics, spawn, step loop | §2, §3, §6, §13 |
| `bots.ts` | 1990 | The bot brain (also stepDog, stepScientist) | §2, §10 |
| `fronts.ts` | 1986 | Front/campaign generation, theatre control | §7, §8 |
| `map.ts` | 1584 | Map generation, tiles, terrain height | §7 |
| `types.ts` | 1493 | Every data contract (SoldierStats, VehicleDef, WeaponDef…) | all |
| `data.ts` | 981 | CLASSES, VEHICLES, CORE_WEAPONS, THEMES | §3, §4, §13 |
| `buildings.ts` | 949 | Building placement & footprints | §7 |
| `modes.ts` | 917 | Game modes / objectives | §8 |
| `lsw.ts` | 828 | The Ascendants threat table & roster | §6 |
| `mapedit.ts` | 773 | Map-editor primitives | §7 |
| `scenario-runner.ts` | 528 | Scenario/mission scripting | §8 |
| `science-runtime.ts` | 506 | Science-mission runtime | §9 |
| `building-generator.ts` | 470 | Procedural building interiors | §7 |
| `operations.ts` | 403 | Operations layer (manifest/command) | §8, §11 |
| `chunks.ts` | 398 | Chunked world streaming | §7 |
| `skirmish.ts` | 348 | Skirmish setup | §8 |
| `building-navigation.ts` | 347 | Indoor nav graph | §7 |
| `science-map.ts` | 336 | Science map layout | §9 |
| `snapshot.ts` | 308 | State serialization (replay/net) | §22 |
| `theater-builder.ts` | 307 | Theatre assembly | §7 |
| `indoor-ai.ts` | 268 | Indoor bot behaviour | §2, §7 |
| `courses.ts` | 268 | Driving schools (certification courses) | §12 |
| `operation-runtime.ts` | 259 | Operation execution | §8 |
| `blackbox.ts` | 257 | Match telemetry recorder | §22, §25 |
| `operation-map.ts` | 246 | Operation map | §8 |
| `threatroom.ts` | 240 | The Combat Room / threat measure | §6 |
| `science.ts` | 237 | Science definitions | §9 |
| `vehicle-telemetry.ts` | 234 | Per-vehicle telemetry | §5, §25 |
| `science-operation.ts` | 228 | Science operations | §9 |
| `perception.ts` | 226 | Shared sight model | §2 |
| `boardtricks.ts` | 222 | Hoverboard trick economy | §5 |
| `arsenal.ts` | 221 | The generated weapon arsenal | §4 |
| `city-profile.ts` | 194 | City doctrine profile | §15 |
| `k9-orders.ts` | 189 | Dog order definitions | §10 |
| `paintball.ts` | 186 | Paintball mode | §24 |
| `traffic.ts` | 185 | Civilian traffic autopilot | §5, §19 |
| `military-missions.ts` | 182 | Military mission set | §8 |
| `tracks.ts` | 172 | Race-track pieces | §5 |
| `spatial.ts` | 168 | Spatial index (perf) | §2 |
| `skills.ts` | 139 | The 22 secondary skills | §13 |
| `interior.ts` | 133 | Interior dressing | §7 |
| `map-layers.ts` | 132 | Multi-storey map layers | §7 |
| `hullcollide.ts` | 131 | Vehicle-vehicle collision | §3 |
| `ranks.ts` | 128 | Rank ladder & authorities | §11, §13 |
| `garage.ts` | 128 | Vehicle tuning/cargo garage | §3 |
| `culture.ts` | 128 | The 12-culture legend | §15, §19 |
| `morale.ts` | 120 | Morale bands & shifts | §2, §13 |
| `licenses.ts` | 115 | The 12 certifications | §12 |
| `materials.ts` | 110 | Per-substance material table | §7 |
| `base.ts` | 104 | Base/spawn structures | §7 |
| `weather.ts` | 99 | The 7 skies | §20 |
| `operation-pads.ts` | 97 | Operation launch pads | §8 |
| `personas.ts` | 87 | LSW personas | §6 |
| `bot-tuning.ts` | 81 | Difficulty tuning constants | §2 |
| `influence.ts` | 79 | Per-team threat/influence map | §2 |
| `director.ts` | 74 | Dynamic-difficulty director | §2 |
| `map-geometry.ts` | 70 | Map geometry keystone | §7 |
| `radar.ts` | 69 | Radar/emitter tracks | §2 |
| `officer.ts` | 54 | The officer class-ruling AI | §11 |
| `theaters.ts` | 52 | Theatre registry | §7 |
| `map-identity.ts` | 50 | Map identity/naming | §7 |
| `theater-types.ts` | 43 | Theatre type defs | §7 |
| `elevation.ts` | 35 | Elevation helpers | §7 |
| `rng.ts` | 29 | Seeded RNG | §2 |
| `ai/pathfinding.ts` | 371 | A\* + layered BFS | §2 |
| `ai/horde.ts` | 365 | Zombie/iron-eater brains | §2 |
| `ai/perception.ts` | 122 | Bot target acquisition | §2 |
| `lsw/*.ts` (42 files) | 2894 | Per-god ability implementations | §6 |
| `theaters/land.ts` + `domain.ts` + `geospatial.ts` | 458 | Theatre domain builders | §7 |
| `geospatial/*` | (parallel) | Real-city import — **owned by a parallel instance; not modified** | §7 (noted only) |

### 1.2 Client (`src/client/` — rendering, HUD, the GONET, the labs)

| Module | Lines | System | Section |
|---|---|---|---|
| `renderer.ts` | 6515 | The Three.js render pipeline | §21 |
| `hud.ts` | 2029 | The heads-up display | §21 |
| `models/soldiers.ts` | 1400 | Soldier/body model builder | §21 |
| `models/vehicles.ts` | 1376 | Vehicle model builder | §21 |
| `stylelab.ts` | 1040 | Body/style dev lab | §26 |
| `models/weapons.ts` | 946 | Weapon model builder | §4 |
| `audio.ts` | 871 | Sound bus & lazy-load | §19, §21 |
| `gonet/index.ts` | 821 | The GONET desktop shell | §16 |
| `codex.ts` | 814 | The arsenal/bestiary codex | §4 |
| `campaign.ts` | 810 | Campaign client | §8 |
| `frontend.ts` | 624 | Enlistment / main-menu shell | §15 |
| `models/props.ts` | 591 | Prop model builder | §21 |
| `record.ts` | 515 | Service record / rank points | §13 |
| `bodylab.ts` | 509 | Body dev lab | §26 |
| `beamlab.ts` | 502 | Beam/FX dev lab | §26 |
| `models/gadgets.ts` | 426 | Gadget models | §4 |
| `onboarding.ts` | 399 | Enlistment flow | §15 |
| `effects.ts` | 392 | Particle/VFX | §21 |
| `geospatial-visuals.ts` | 346 | Real-city visuals | §7 |
| `replay.ts` | 342 | Replay playback | §22 |
| `animation.ts` | 326 | Rig animation / weapon holds | §21 |
| `input.ts` | 308 | Input mapping | §21, §23 |
| `gamepad-ui.ts` | 291 | Steam Deck controller nav | §23 |
| `vanessas.ts` | 278 | Vanessa's pro shop | §24 |
| `ledger.ts` | 275 | War ledger (résumé) | §14 |
| `newspaper.ts` | 262 | The press / headlines | §16, §18 |
| `gonet/broadcast.ts` | 259 | The video/broadcast desk | §16, §18 |
| `reviews.ts` | 257 | Gear reviews | §16 |
| `chat.ts` | 257 | In-match / MP chat | §22 |
| `streetvo.ts` | 255 | Street-VO catalogue | §19 |
| `gonet/library.ts` | 250 | Music library manager | §16 |
| `fieldrecord.ts` | 250 | Field telemetry record | §25 |
| `board.ts` | 246 | THE BOARD telemetry desk | §25 |
| `worldclock.ts` | 232 | The one clock | §20 |
| `admin.ts` | 232 | Admin/dev console | §26 |
| `threat-room.ts` | 227 | Combat Room client | §6 |
| `models/grip.ts` | 226 | Hand-grip CCD solver | §4 |
| `vanessas-place.ts` | 225 | Vanessa's venue | §24 |
| `touch.ts` | 221 | Touch controls | §21 |
| `gallerydrill.ts` | 219 | Gallery dev tool | §26 |
| `operations-ui.ts` | 215 | Operation planner UI | §8, §11 |
| `gonet/player.ts` | 206 | Music player (corner deck) | §16 |
| `net.ts` | 204 | Multiplayer client netcode | §22 |
| `godmode.ts` | 192 | Dev god-mode | §26 |
| `gonet/cartridges.ts` | 191 | The cartridge/arcade system | §17 |
| `hometown.ts` | 189 | Hometown archetypes | §15 |
| `gonet/mail.ts` | 189 | Ministry/school/home mail | §16 |
| `armorysheet.ts` | 185 | Armory contact sheet (dev) | §26 |
| `gonet/sports.ts` | 182 | The sports league | §18 |
| `classvo.ts` | 173 | Class voice lines | §19 |
| `propsheet.ts` | 168 | Prop sheet (dev) | §26 |
| `ring.ts` | 156 | Ring/objective markers | §21 |
| `settings.ts` | 153 | Settings | §21 |
| `trophies.ts` | 152 | Trophy/medal case | §14 |
| `damagetext.ts` | 151 | Floating damage numbers | §21 |
| `gonet/briefings.ts` | 143 | Intel briefings app | §16 |
| `fxsheet.ts` | 140 | FX sheet (dev) | §26 |
| `range.ts` | 131 | The firing range | §12 |
| `service-file.ts` | 130 | YOUR FILE / promotion board | §11, §14 |
| `reticle.ts` | 127 | Reticle/spread ring | §21 |
| `auth.ts` | 123 | Auth stub | §22 |
| `garage-ui.ts` | 121 | Garage UI | §3 |
| `darkness.ts` | 121 | Night/darkness overlay | §20, §21 |
| `music.ts` | 118 | Music deck core | §16 |
| `treasury.ts` | 116 | The war chest | §14 |
| `identity.ts` | 115 | Player identity | §15 |
| `hopper.ts` | 114 | Match hopper/matchmaking | §22 |
| `science.ts` | 106 | Science client | §9 |
| `codex-cost.ts` | 106 | Codex cost display | §4 |
| `service.ts` | 99 | Service authorities | §11 |
| `streetvoice.ts` | 98 | Street-VO client updater | §19 |
| `science-flow.ts` | 96 | Science flow | §9 |
| `stable.ts` | 95 | The god-call console (V) | §6, §11 |
| `dialogue.ts` | 95 | Dialogue lines | §19 |
| `records.ts` | 91 | Lap records | §5 |
| `ringdrill.ts` | 90 | Ring dev drill | §26 |
| `ghost.ts` | 88 | Race ghost replay | §5 |
| `ui-gallery.ts` | 82 | UI gallery (dev) | §26 |
| `science-presets.ts` | 80 | Science presets | §9 |
| `weaponcam.ts` | 79 | Weapon-cam plate | §4 |
| `military-missions-ui.ts` | 74 | Mission UI | §8 |
| `gonet/headphones.ts` | 74 | Field headphones (H) | §16 |
| `licences.ts` | 69 | Certification client store | §12 |
| `vanessas-stock.ts` | 68 | Vanessa's stock | §24 |
| `glyphs.ts` | 63 | Glyph/insignia atlas | §21 |
| `segmeter.ts` | 57 | Segment meter | §25 |
| `icons.ts` | 53 | Icon set | §21 |
| `models/shared.ts` | 41 | Shared model helpers | §21 |
| `soundscape.ts` | 34 | Ambient soundscape | §19 |
| `k9-controls.ts` | 33 | Dog control UI | §10 |
| `hometown-bridge.ts` | 31 | Hometown→culture bridge | §15, §19 |
| `deathpose.ts` | 18 | Death-pose helper | §21 |
| `models.ts` | 7 | Model barrel export | §21 |

### 1.3 Server, harness, entry, data

| Module | Lines | System | Section |
|---|---|---|---|
| `src/main.ts` | 2527 | The client entry — wires everything | all |
| `src/server/server.ts` | 500 | The multiplayer server | §22 |
| `src/server/warroom.ts` | 149 | Server operator console (backend) | §22 |
| `src/server/input-queue.ts` | 72 | Server input queue | §22 |
| `src/warroom/warroom.ts` | 198 | War-room admin client | §22 |
| `src/harness/mapmaker.ts` | 953 | **The Map Maker** (built separately, lives here) | §7 |
| `src/harness/matchup.ts` | 233 | Deterministic match harness (dev) | §26 |
| `src/data/nations.ts` | 215 | 169 nations + doctrine stats | §15 |

> **Coverage statement:** every `.ts` under `src/` is accounted for above and audited in the section named. The only files deliberately **not modified or deeply re-audited** are `src/sim/geospatial/*` and `src/data/geospatial/*` — a parallel working instance owns them (its one red test, `tests/geospatial-theater.test.ts`, is theirs). They are noted in §7 for completeness.

---

## 2 · COMBAT & AI CORE — the deepest, most-wired system

*Full detail: `.notes/audit-combat.md`. Counts: **68 wired · 8 partial · 3 invisible · 1 unbuilt.***

**The verdict:** combat is genuinely deep and correct. The bot brain has real perception parity (it is *not* an omniscient snap-shooter), real navigation (A\* + multi-storey), and a complete life-cycle model. What it lacks is a *tactical* layer — it fights in the open and never cooperates.

### 2.1 The bot brain — perception & targeting (all ✅ WIRED)

- **`findTarget`** (`ai/perception.ts:20`): nearest enemy inside a weather-taxed eye that must pass grass / cloak / vision-cone / close-ring / line-of-sight gates. Deterministic tie-break.
- **Vision cone + ring parity** (`ai/perception.ts:55`): a ~130° cone plus a 9u all-around ring — behind a bot, past the ring, you are invisible. *This is what makes flanking physically possible* (and the gap in §2.7 is that bots don't exploit it).
- **Grass / cloak / ping** (`ai/perception.ts:46,60,39`): grass hides you past 14u, cloak past 9u, and a ping (beacon/drone/camera/**dog nose**) pierces both to full range. Bots read *last tick's* ping set (recon fills it after brains run).
- **Reaction delay** (`bots.ts:1299`): a freshly-acquired contact gets a 0.16–0.5s human beat (by difficulty) before the trigger; re-arms only on a *new* contact; LSWs exempt.
- **Turn-to-aim cap** (`bots.ts:1647`): yaw slews at 7–15 rad/s, so a corner-flick headshot costs real time.
- **Nemesis bias** (`ai/perception.ts:77`): the enemy who last killed you gets a ×0.6 target-score grudge weight.

### 2.2 The firing model (the honest core, all ✅ WIRED)

Aim-error cone (`bots.ts:1293`) = base 0.055 × distance-falloff × difficulty × doctrine × paintball-mercy ÷ director-pressure. Deliberate **under-lead** on moving targets (`leadYaw`, `bots.ts:1675`) so fast strafing beats bots. Fire discipline, dry-clip sidearm fallback, cluster-grenade AI, reload-to-cover — all wired.

### 2.3 Movement & combat doctrine

- **Per-class doctrine table** (`bots.ts:461`, ✅): all 8 classes get standoff/chase/retreat/strafe/flank/aim numbers — anchors hold, skirmishers close, marksmen keep the street.
- **Standoff + strafe-dance** (`bots.ts:1380`, ✅): **this IS the combat loop** — hold the class's standoff band, strafe, retreat if too close, close if too far. It is standoff+strafe, *not* positional/cover fighting.
- **Cover seeking** (`nearestCover`, `bots.ts:493`, 🟡 **PARTIAL**): influence-weighted, but used **only reactively** — when hurt, reloading, or downed. Bots never choose a *fighting* position behind cover.
- **"Flanking"** (`bots.ts:1384`, 🟡 **PARTIAL**): a lateral *curl* on approach + per-life lane bias + a CTF two-wing route. It reads as "curved approach," not a real flank to the target's blind side.
- Retreat/break-contact, last-stand clutch, anti-bunching separation, stuck-detection repath, per-life lane bias, nest/turret engagement, foot anti-vehicle — all ✅ WIRED.

### 2.4 Objective & role selection (all ✅ WIRED)

Per-mode `objectiveFor` (`bots.ts:243`); a **utility-scored defender count** (`defendsNow`, `bots.ts:107` — the *only* utility function in the brain, defenders emerge and re-rank); CTF role split by class; a standoff-breaker that detects parked-carrier stalemates; single-designated rescuer for cut-off friendlies; room-duty overwatch inside houses.

### 2.5 Navigation (all ✅ WIRED — the strongest part of the AI)

Real **A\*** with octile heuristic + binary heap (`ai/pathfinding.ts:48`); path smoothing on a walkability ray (boots ≠ bullets); **layered ladder/stair BFS** for multi-storey (`pathStepLayered`); ladder-IQ (presses E at the well), door-IQ (opens doors on the line, not mid-firefight), climb-IQ (jump-troopers jet over barricades), and wheeled-vehicle pathfinding with a bow-brake.

### 2.6 Vehicle/pilot AI, class-ability AI, the horde (all ✅ WIRED)

Theatre-route driving, jet dogfights (energy-fight on overshoot), missile evasion with flares, boat patrols, race-driver checkpoint lines. Medic (revive priority), infiltrator (cloaks for the CTF crossing), ghost drone, engineer sentry/mine, MANPADS discipline, LSW melee doctrine. The zombie brain, iron-eater brain, sprinter dormancy, and horde-targets-structures are all live. **`stepDog`** (`bots.ts:1880`) and **`stepScientist`** (`bots.ts:1685`) live here — detailed in §10 and §9.

### 2.7 The meta-brain / "commander" — where the gaps are

| System | Status | The gap |
|---|---|---|
| **The Director** (`director.ts:44`) | 👻 INVISIBLE | Reads scoreboard lead + fresh human deaths every 6s, drifts a single `pressure` band (0.78–1.30) that scales bot aim + reaction. It is the closest thing to a commander — **but it only tunes twitch, never tactics**, and has no UI tell. |
| **Morale — behavioural half** (`morale.ts:108`) | 🟡 PARTIAL / ⬜ | `wantsCover` → `s.shaken` → retreat sooner works. **`wantsToPush` (m≥88) is DEAD CODE — never called.** Winning/inspired bots hold contact 0.7× longer but never actually *press* harder. |
| **Squad coordination** (`squadId`) | 🟡 PARTIAL | Only a spawn-on-squadmate + rescue-weight label. No fireteam maneuver, bounding overwatch, regroup, or focus-fire order. **No AI commander issues objectives.** |
| **Influence/threat map** (`influence.ts`) | 👻 INVISIBLE | A 32×32 per-team threat field rebuilt 2.5×/s, LSW-weighted 4× — read by **exactly one consumer** (`nearestCover`). A paid-for asset that retreat/objective/flank/grenade decisions could all read for near-zero cost. |

### 2.8 TOP 5 COMBAT/AI GAPS (ranked)

1. **No true flanking / positional play** — bots have the cone data but never route to an unwatched angle. Highest-impact, highest-visibility.
2. **Cover is reactive only** — a "fight from this cover tile (peek/hold)" behaviour would transform every engagement; all the pieces exist.
3. **Morale's aggressive half is dead code** — wire `wantsToPush` into objective aggression so a surging side looks different from a routed one.
4. **The influence map has one tiny consumer** — biggest ROI-per-hour: feed it into retreat direction, objective picking, flank-side, grenade targeting.
5. **No squad-level coordination / commander** — the largest missing *system*: bounding overwatch, suppress-and-move, regroup, focus-fire.

### 2.9 OPEN QUESTIONS — combat/AI

1. **How smart do you want the bots to *look*?** True flanking + fight-from-cover is the single biggest lift to how combat *reads*, but it makes bots harder. Do we add it globally, or gate it to higher difficulty tiers so low tiers stay beatable?
2. **Should there be a real AI commander** that issues squad orders (suppress/move/regroup/focus-fire), or is emergent per-bot behaviour the intended feel?
3. **Should the Director be visible** (a "the enemy is adapting" tell) or stay a silent hand?

---

## 3 · VEHICLES, THE GARAGE & THE DRIVETRAIN — fully wired

*Full detail: `.notes/audit-vehicles.md` + `STATISTICS.md §3`.*

**The verdict:** the vehicle *physics* spine is one of the most-wired systems in the game. 80 hulls, a real traction/mass/shock model, hull-to-hull collision, a jump-and-landing model, and a complete garage. The gaps are in racing *content* (§5) and one absent concept (cargo capacity).

### 3.1 The hull table & physics (all ✅ WIRED)

- **80 hull definitions** (`data.ts:390`), 53 flagged `civilian`. Every hull carries hp/speed/turnRate/weapon/seats + the racing dials `mass`, `grip`, `traction{ice,dirt,paved}`, `shock`, `slip`. ~28 `VehicleDef` fields drive something you can feel (`STATISTICS.md §3.1`).
- **Traction profile** (`world.ts:6104`): the floor names its material family (ice/paved/dirt), `traction[family] × grip` becomes the handling multiplier. Slicks-on-tarmac vs knobblies-on-dirt genuinely diverge.
- **Mass / heft** (`world.ts:6093`): `heft = clamp(pow(mass/1.6, 0.34), 0.8, 2.4)` divides accel and braking and widens drift — a tanker builds and loses speed slower than a hatchback.
- **Shock & the landing** (`world.ts:6272`): wheeled/surface hulls leave the ground over terrain steps, gravity owns them, arrival is judged `mass × −vSpeed` against `def.shock` — under, stick it; over, bounce + scrub + crash damage. A bike is a stunt, a laden truck is a wreck.
- **Hull-to-hull collision** (`hullcollide.ts` + `world.ts:5877`): O(n²) mass-weighted impulse each tick, `crashDamage` billed to both hulls above a force threshold. "A jeep no longer passes through a tank." (Soldiers deliberately excluded — the separation shove handles bodies.)
- **Roadkill** (`world.ts:6316`): a driven ground hull >6 u/s that overlaps an on-foot enemy deals speed-scaled damage.

### 3.2 The garage (✅ WIRED, with two dead spots)

4 slots (`garage.ts`): **Tires** rewrite the traction profile (slicks/all-terrain/knobblies/studs), **Engines** trade top-end vs launch, **Chassis** trade mass vs HP, **Cargo** (mines/oil/armour/crusher) adds mass. `fitted()` resolves the card, applied once by `setFit` (`world.ts:2044`), cached on `fittedDef`. Account-level, survives prints.

- **👻 Crusher Ram** (`garage.ts:86`): a buyable ram item with flavour, but **no code reads `fit.cargo.includes('crusher')`** — it only adds 0.45 t of mass, a strict downgrade. (Armour, by contrast, IS wired → HP ×1.35.)
- **👻 `fitLegal()`** (`garage.ts:123`): defined but **zero call sites** — the 2-slot cap is enforced in the UI instead; the sim never validates a fit.

### 3.3 Tank vs pickup (the answer to a question you asked)

Ares Tank: 11 u/s, 650 HP, 62 t, 8 seats, 120mm cannon. Workhorse Pickup: 16 u/s, 90 HP, 2.1 t, 3 seats, no gun. **The pickup is ~45% faster in a straight line and stops/accelerates far quicker** (lower heft). The tank pays for its 650 HP with the worst straight-line speed of any armed ground hull.

### 3.4 CARGO CAPACITY — ⬜ UNBUILT (your instinct confirmed)

There is **no cargo-capacity system anywhere.** Grep across `src/` for `cargoCapacity`/`maxCargo`/`haulWeight`/`load` returns zero. A pickup does **not** haul more than a sports car in any gameplay sense. The three things that sound like cargo are all something else: the garage `CargoId[]` (a 2-slot droppable *loadout*, identical for every road hull), the traffic `PayloadKind` (wreck *behaviour* — a tanker detonates), and `Vehicle.mines`/`.oil` (droppable *counts*). `seats` carries soldiers, not freight. To build it: a `VehicleDef.cargoSpace` number + a carried-load model + a supply economy to fill it.

### 3.5 OPEN QUESTIONS — vehicles

1. **Cargo:** do you want true freight tonnage (a truck moves what a sports car can't, feeding an economy/objective), or is the garage `CargoId` row the intended stand-in? Today it is neither.
2. **Crusher Ram:** wire it (a contact-damage/knockback multiplier for a nose-on hull carrying it) or delete it? Right now it's a strict downgrade.

---

## 4 · WEAPONS & ARSENAL — 316 weapons, fully wired

*Full detail: `.notes/audit-misc.md` + `STATISTICS.md §4`. The weapons pipeline is wired end-to-end (stats → sim → model → sound) with **no stubbed families.***

### 4.1 The generator (✅ WIRED)

`buildArsenal()` (`arsenal.ts:94`): **16 families** × 4-of-6 rotating **brands** × 3 **Mk tiers** = 192, plus 9 grenade launchers + 5 specials = **206 generated ids**. Merge law: `WEAPONS = { ...buildArsenal(), ...CORE_WEAPONS, ...LSW_ARMS }` → **316 total WeaponDefs** live. `CLASS_ARMORY` gates which families each class draws.

- **The SIDEGRADE law** (`arsenal.ts:37`, test-enforced): Mk III hits harder and groups tighter, but the clip shrinks (×0.62) and reload drags (×1.25). No mark is strictly better; every brand stat-bump pays somewhere. DPS-per-cost stays flat across the whole table.
- **6 brand signatures are wired** (Maklov moves-cheap, Kuchler back-half-faster, Titan every-round-shoves, Harkov no-falloff, Ceres cheap-special-pools, Kamenel +15% muzzle) — `STATISTICS.md §4.3`.

### 4.2 Models, grip, codex, HUD (all ✅ WIRED)

- **Weapon models** (`models/weapons.ts`): one builder per family, variation derived from the id (not bespoke), brand = proportions + palette + one physical tell, Mk = amber bands. Muzzle +X, ≤500 tris, deterministic per id.
- **The grip solver** (`models/grip.ts`): CCD closes the right hand on the pistol grip and left on the handguard with real arm-chain IK. *(MEMORY carries a prior "held-gun grip still broken" note — this solver is the fix that landed; live in-game feel not re-verified in this audit.)*
- **The Codex** (`codex.ts`, 814 lines): the master browser — 6 sections (Vehicles/Civilian/Weapons ~316 rows/Infantry/Ascendants/Threats), every number read from the sim's own tables at render time (pinned by `tests/codex.test.ts`), live 3D turntables, a compare tray, and a Service-Net review layer. Genuinely complete and drift-proof.
- **Weapon-cam** (`weaponcam.ts`): the HUD shows a baked render of your *exact* equipped weapon, not an icon.
- **Reticles** (`reticle.ts`): the "8 or 9" aim cursors, 10 styles surfaced via Settings.

**Open question — weapons:** none material. The one adjacent gap is a *weapon-competence certification* (see §12) — weapon skill is entirely the ungated secondary-skill system today.

---

## 5 · RACING AS A SPORT — the physics is ready, the content and one bug are not

*Full detail: `.notes/audit-vehicles.md §C–G`.*

> **UPDATE (2026-07-23, "improve racing track creation"):** two of this section's gaps are now **FIXED**. (1) The car-lap bug (§5.2) is closed — `collectRacers` (`modes.ts`) now counts every ground racer, not just boards, so car/truck/bike races bank laps and finish (locked by a new car-race regression in `tests/race.test.ts`). (2) The Track Builder is now **wired into play** (§5.3): a new `buildTrackMap()` (`map.ts`) carves a `BuiltTrack` into a real raceable `GameMap` — per-piece surfaces, a start grid, and **real terrain height on ramp pieces** (the first generator to author `map.height`) — and a **circuit picker on the race deploy screen** lets you pick a built track off the shelf and drive it (`tests/track-build.test.ts`, 8 tests). Still open below: ramps only elevate on *built* tracks (the procedural oval is still flat), overpasses/railings, and Gun Run / Freestyle.

### 5.1 What runs

- **The hoverboard trick economy** (`boardtricks.ts` + `world.ts:5658`, ✅ **fully wired** — the most complete system in the slice): airtime + spin (180→1080) + grind + wall-ride + power-slide build a combo; the landing banks it to boost or bails it; all nine canon verbs are driven by steering, not trick buttons.
- **Driving schools** (`courses.ts` + `modes.ts:820`, ✅): 13 course programs, a real in-sim examiner, sign the licence — see §12.
- **Lap records + ghosts** (`records.ts`, `ghost.ts`, ✅): account-level record board keyed by track + class, holder name, and a ~20 Hz ghost line beside you next lap.
- **The GONET league shell** (`gonet/sports.ts`, ✅): disciplines, deterministic fixtures, standings off the record board, an ENTER button — and it feeds the newspaper + broadcast (§18).
- **Demolition/Derby** (`modes.ts:768`, ✅): last machine running, drivers walk away from wrecks.

### 5.2 THE LIVE BUG — car/truck/bike races count zero laps 🟡

`collectRacers` (`modes.ts:362`) still filters **`isBoard(v.kind)` only** — but the grid (`main.ts:1128`) spawns cars/trucks/bikes and the bot AI (`bots.ts:849`) was widened to drive any ground hull. Result: **pick a car and `m.racers` is empty → no laps counted, no places, the race never ends, no record filed, and the AI cars pile at gate 0.** This silently voids 3 of the 4 advertised race classes. **One-line class of fix** (widen the filter to all raceable ground hulls). *I verified this directly at `modes.ts:362`.* This is the highest-value first target for the racing `/loop`.

### 5.3 What's missing

- **The Track Builder is unreachable** (`tracks.ts:128`): a full finished editor (9 piece kinds incl. ramps/jumps/banks, validate/save/export, live 2D map in `admin.ts`) — but `checkpointsFor()`, the sole `BuiltTrack`→circuit bridge, has **zero call sites**. Built tracks can't be raced. Wire it into `map.raceTrack`.
- **The race circuit is flat** (`map.ts:956`): the only raceable circuit is a deterministic ellipse with **no ramps, overpasses, railings, or elevation** — so the special landing physics (§3.1) never fires in a race. The "barrier stubs" comment is an explicit no-op.
- **Gun Run + Freestyle are shells** (`sports.ts:95,108`, `live:false`): no car-mounted forward weapon, no scored trick session — even though freestyle's trick economy is fully built and just needs a scoring loop.

### 5.4 OPEN QUESTIONS — racing

1. **Fix the car-lap bug now?** (It's a one-liner and it unblocks 3 of 4 classes — recommended as the first `/loop` action.)
2. **Wire the Track Builder into deploy** so built tracks are raceable — and should `generateRaceTrack` author elevation/ramps/railings, or is that Track-Builder-only?
3. **Build Gun Run and Freestyle** (the parts exist — freestyle just needs a scored no-finish session reading the combo bank).
4. **Season structure:** should SPORTS become a real league (points, championship, result persistence, fixture venue/class passed into the match) or stay a launcher for the modes? (See §18.)

---

## 6 · THE ASCENDANTS (Living Super Weapons) — 40 gods, all fielded

*Full detail: `.notes/audit-maps-ascendants.md §B` + `STATISTICS.md §5`. `docs/ASCENDANTS.md` is the design source of truth.*

**The verdict:** deep and complete. An LSW is a `Soldier` with `ascendant` set — same rig, same physics, **ordinary bullets kill it** (threat buys HP, never immunity). All 40 have a dedicated brain file (`src/sim/lsw/<id>.ts` — 42 files, 2894 lines).

### 6.1 The roster & threat (✅ WIRED)

- **40 units** (20 per faction), each with a `step` (bot cadence + passives) and `active` (pilot Q — cooldown charges only on a real cast), an embodiment (rig/prop/pose), 5 VO moments + 4 announcer lines.
- **The threat table** (`lsw.ts:24`): T1 SKIRMISH 800 HP / T2 STRONGPOINT 1600 / T3 SIEGE 3200 / T4 EXTINCTION 5800. HP was *measured*, not guessed (trimmed ~36% so 1v1s resolve; `tests/threat-measure.test.ts`).
- **Shared mechanics toolbox** (all wired): ENCASE (ice block), FORCE FIELDS (radial pulls/currents), TIME FIELDS (Chronos), MACHINE POSSESSION (Phantom/Wraith, EMP evicts), TRUE FLIGHT (SAM-lockable), DESTRUCTION (Titan/Crusher/Tremor/Leviathan), LEAP movement.

### 6.2 Deployment & ascension (✅ WIRED)

`requestLsw` (`world.ts:1199`) gates in order: mode allows → **rank commission (Lieutenant+)** → campaign pass escalation → faction → one-per-faction slot → materiel purse (opens at 10, +1/60s cap 14, charged by tier) → telegraphed delay → pod lands. A **bot officer** auto-calls for any humanless faction on a 45 s cadence. If the human caller stands at the LZ at landing, their trooper **becomes the god** (same id, 2 s pod-flash protection, Q = signature, death hands the body back). **All 37 ground LSWs are player-pilotable; the 3 fliers are AI-only.**

### 6.3 The gaps

- **⬜ The EXTINCTION tier (T4) is empty** (confirmed doc-vs-code drift): the 5800-HP tier is fully defined but **no roster unit is assigned `threat:4`** (spread is T1×9, T2×22, T3×9, T4×0; Cataclysm is coded threat 2, not the doc's T4). The top of the god ladder is an empty promise. `docs/ASCENDANTS.md §1.5` also still prints T1 HP as 1200 — the code says 800.
- **🟡 The LSW↔campaign marriage is half-plumbed** (`ASCENDANTS.md §6`): per-front stables, gods as bankable War Materiel, and boss recipes that START with a god on the field are specified but not built — deployment is purse+rank+pass, not a campaign stock.

### 6.4 OPEN QUESTIONS — Ascendants

1. **The EXTINCTION tier:** raise Titan/Stormcaller/the Collective bosses to the coded 5800-HP T4, or retire the tier and correct the doc? (Right now the ladder's top rung is unused.)
2. **LSW as campaign materiel:** build per-front stables and god-as-materiel now, or keep the flat purse?
3. **The 3 flier gods are AI-only** — intended (a flying god is un-pilotable by design), or a gap?

---

## 7 · MAPS, TERRAIN, BUILDINGS & DESTRUCTION — deep, with one flat spot

*Full detail: `.notes/audit-maps-ascendants.md §A` + `STATISTICS.md §6`.*

### 7.1 Generation (✅ WIRED)

- **Stock procedural maps** (`map.ts:1022`): six theme generators (field/corridors/rocks/ocean/ice/armor), mirror-symmetric for fairness.
- **Chunk region grammar** (`chunks.ts`): a field map is diced into regions each filled by a chunk (forest/neighborhood/interior/industrial/farm/open); every chunk keeps a 3-wide clear cross so lanes line up into a connected street network — "choke, never seal."
- **10 authored fronts** (`fronts.ts:1892`): hand-placed bones (bridge_delta, fort_raven, the_city, blacksite, refinery, the_port, airbase, the_mine…), seed deals only dressing; reachability test-enforced.
- **Population-scaled size tiers** (`fronts.ts:135`): small/standard/large by bot count; buildings keep size, ground-between-features scales.
- **8 vehicle-scale theaters** (`theaters.ts`): city/geocity/desert/countryside/mountain/coastal/ocean/steppe, 200²–300², route-connectivity validated — the map layer under Operations.
- **3 real cities** (`geospatial/*`, 🟡 PARTIAL, **owned by a parallel instance — not modified**): Miami Gardens 33056, SF Potrero, Lower Manhattan, compiled from OSM/terrain.

### 7.2 Buildings & indoor AI (✅ WIRED — you can genuinely go inside)

Static stencils + procedurally-grown houses (4 archetypes, regrow until every room is reachable), grown districts, and full multi-storey city buildings with sockets (entry/guard/civilian/dog-handler…). **Second storey is real** (`grid2` + `upperLayers`, stairs, ladders). Doors open on E, windows break to firing sills, furniture placed, indoor scatter pruned. **Indoor AI** (`indoor-ai.ts`): a real CQB brain — guards run post→investigate→search→return with portal-claiming so they don't clump a doorway; civilians evacuate; dogs follow scent trails.

### 7.3 Destruction, materials, fire (all ✅ WIRED)

- **Materials table** (`materials.ts`): one record per substance (dirt/grass/wood/masonry/stone/metal/ice…), single source of truth for destruction HP, drill rate, walk speed, grip, ricochet, flammability, impact VFX.
- **Destruction** (`world.ts:897`): tiered and *monotonic* (only ever opens paths, so reachability survives) — intact → damaged → rubble (knee cover) → gone. Masonry/stone are heavy-only (≥100 dmg); metal & the rim never break by blast (drill only).
- **Field fire** (`world.ts:948`): grass/wood/frames/corpses burn; fire spreads to orthogonal flammable neighbours once, scorches the living, and **burns corpses to `neutralized`** (the field path to reanimation-denial). Masonry/stone/metal/ice/water don't burn.

### 7.4 THE FLAT SPOT — terrain elevation is a dead read-path 🟡

The 3-level height model (`TERRAIN_U = [0, 4, 16]`) is **fully wired on the read side** — LOS occlusion, vehicle ground-follow, and flight sky-gating all consume it — **but NO procedural generator ever assigns `map.height`.** The only writer is the Map Maker JSON loader. So **every *generated* match is flat**; terrain only exists on hand-authored/imported maps. Vertical warfare is one generator-write away.

Also: **indoor AI only wakes on authored/city layouts** — on a stock scatter map `createIndoorTacticalState` returns null, so bots inside grown houses fall back to open-field behaviour.

### 7.5 OPEN QUESTIONS — maps

1. **Terrain:** should the chunk/front generators author height (unlocking hills/ramps/vertical fights on every map), or is elevation permanently a Map-Maker-only feature?
2. **Indoor AI reach:** should the CQB brain wake on stock scatter maps too (so grown houses fight like buildings), or is it intentionally city/science-only?
3. **The Map Maker** (`harness/mapmaker.ts`, 953 lines) lives in the tree — is it the "separate map-builder" you referenced, and how does it hand tracks/maps to the game?

---

## 8 · GAME MODES, CAMPAIGN, OPERATIONS & MISSIONS — single-player IS built

*Full detail: `.notes/audit-maps-ascendants.md §C`.*

**The verdict:** far more complete than a skirmish sandbox. **All 17 modes run end-to-end — none is a stub.**

### 8.1 The 17 modes (all ✅ WIRED)

tdm · ctf · koth · conquest · survival · horde · tide · safehouse · science · paintball · race · timetrial · derby · school · threat · shop · range. Each is initialized and stepped from the world loop.

### 8.2 The single-player spine (all ✅ WIRED)

- **Living Campaign** (`campaign.ts`): a persistent 10-front war, each front with a control value (coalition/contested/collective), a signature scar applied as a match modifier, seasons, a motor pool, a treasury, and offline time-skip. Match results move front control.
- **Operations runtime** (`operation-runtime.ts`): when launched with `opts.operation`, the world runs `stepWorldOperation` *instead of* `stepMode` — a phase chain over 7 objective kinds (capture/hold/destroy/escort/arrive/defend/eliminate) observed against real world state, with fail conditions, support (artillery/CAS), and complications.
- **7 military missions** (`military-missions.ts`): named combined-arms set-pieces (urban_assault, real_city_assault @ Miami Gardens, air_superiority, convoy_interdiction, pass_assault, beachhead, naval_hunt) — instant single-player operations independent of campaign state.

### 8.3 OPEN QUESTIONS — modes/campaign

1. **The campaign is real but buried** — is it surfaced enough? (Most players will meet only skirmish/deploy.) Should the GONET foreground the 10-front war?
2. **The LSW campaign economy** (per-front stables) — build it into Operations now, or later?

---

## 9 · SCIENCE / SCIENTIST HUNT / FORENSICS — covert ops, not forensics

*Full detail: `.notes/audit-maps-ascendants.md §C4–C5`.*

### 9.1 What "Science" means today (✅ WIRED)

The **Scientist Hunt** — a covert-ops mission generator (`science.ts` + `science-runtime.ts`): 10 verbs (assassinate/steal/raid/deny/rescue/infiltrate/ambush/hold/hunt/decapitate), 10 sites (clone-vault, research-annex, officer-villa, quarantine-zone…), complications (alarm-net, god-on-guard, no-kill, one-life), an encounter budget that scales guards/dogs/civilians to your print commitment, and 12 campaign rewards (clone reinforcement, morale, materiel, weather authority, LSW assignment rights). Runs in-world; gated 2/pass by the campaign.

### 9.2 Forensics / decay-to-bones — ⬜ MOSTLY UNBUILT (idea only)

There is **no forensic decay-to-bones system.** The only corpse lifecycle is (a) fire burns a body to `neutralized`, and (b) the **outbreak reanimation clock** — a corpse booked ≥40 contamination rises as a zombie unless denied by fire/blast/BNR ammo. `types.ts:423` notes "decay is LOCKED" as a meta-layer lever; `docs/TEST-FINDINGS.md` records decay-to-bones as an *idea*. Visual/temporal skeleton decay: not in code.

### 9.3 OPEN QUESTIONS — science

1. **Does "Science" grow toward forensics** (decay-to-bones, evidence, a coroner/lab layer), or does it stay covert Scientist-Hunt ops? These are two very different features sharing one word.
2. **If forensics:** where do bones live, and is it a mission type, a corpse-lifecycle visual, or a Science-mission reward?

---

## 10 · ★ DOGS & ANIMALS — the deep dive

*Full detail: `.notes/audit-dogs-officers.md` Part One. You asked for this by name. Here is all of it.*

### 10.1 The headline: the dog is REAL, and it is the ONLY animal

**There is a genuine dog entity in the sim — not scaffolding, not orders-into-the-void.** A dog is a first-class `Soldier` with `kind: 'dog'` (`types.ts:436`). It spawns, moves, paths, bites, deals and takes damage, dies, and redeploys. It has a bespoke AI brain (`stepDog`, `bots.ts:1880`), a rigged German-Shepherd model with a four-leg trot animation, a HUD control panel, key/gamepad bindings, and a network-replicated order state. **Dogs are 12-of-14 WIRED** — one of the most complete "living" systems in the game.

**And the K9 is the ONLY animal in the entire game.** An exhaustive sweep found no birds, mounts, wildlife, pests, or livestock as entities. Every other animal word is a metaphor or a machine:
- `kennel` (`buildings.ts:297`) is a **building floorplan template** — it does not house or spawn dogs.
- `junkhound` (`data.ts:834`) is a **machine** — one of the four Iron Eaters (scrap horde enemy), borrows the `dog_bite` weapon and a dog silhouette but is "machine to the last."
- "rabbit/prey/hounds/pack" are **paintball metaphors** for the Prey/Hunt mode; "the bird" is aircraft slang; "perch/bird down" is the Gargoyle LSW; "swarm" is the zombie horde.

### 10.2 Every dog system, by status

| # | System | Status | What it does |
|---|---|---|---|
| 1 | **Dog entity & stats** (`data.ts:839`, `world.ts:1613`) | ✅ WIRED | HP 60, speed 16.8 (~1.6× a man — "nobody outruns the dog"), `dog_bite` (16 dmg melee), `heelDist 4`, `guardRadius 18`, `noseRadius 10`, a real name from a pool of 8 (Rex, Ajax, Bruno, Sable, Grit, Valkyrie, Koda, Havoc). |
| 2 | **Fielding** (`main.ts:1217`, `k9-orders.ts:27`) | ✅/🟡 | Each side **automatically** fields exactly one K9 (except range/paintball/races), paired to a handler — prefers the local player, else the first infantry/engineer bot. **The player does not choose to bring a dog, and only controls it if they're infantry/engineer.** |
| 3 | **Packs** (`science-runtime.ts:221`) | 🟡 science-only | `addDog(allowPack=true)` bypasses the one-per-team guard — used ONLY by science missions (a raid can face a pack of guard dogs). No pack *coordination* AI. Unreachable in normal PvP. |
| 4 | **Order system heel/sic/stay** (`k9-orders.ts`) | ✅ WIRED | Three orders. State stored on the dog Soldier itself, so it **replicates over the wire for free**. `sic` resolves the aimed point to a building (8u snap); `stay` toggles back to heel. |
| 5 | **`stepDog` brain** (`bots.ts:1880`) | ✅ WIRED | Per-tick priority ladder: nose (always) → handler-down freeze → stay → sic → guard (bite nearest hostile within 18u of the *handler*) → indoor scent chase → heel. Horde-style pathing so walls don't save the target. |
| 6 | **`sic` — building clear** (`bots.ts:1812`) | ✅ WIRED | Drives into a siced building, bites hostiles inside, runs a deterministic room/door sweep. At a **closed door it stops and BARKS "WAITING AT DOOR"** — the dog will not open doors; it waits for a human. Announces "BUILDING CLEAR" after 2 s quiet. |
| 7 | **`stay` — hold & bite** (`bots.ts:1790`) | ✅ WIRED | Holds an anchor, bites anything in range, self-corrects if shoved off. Area-denial tool. |
| 8 | **THE NOSE — anti-stealth ping** (`bots.ts:1885`) | ✅ WIRED | **The dog's whole reason to exist.** Every enemy within 10u (floor-aware) is added to `world.pinged` — the *same* reveal channel spy cameras use — so perception sees it **even through cloak**. "With a K9 on the field, stealth has to sweat" is literally true in code. |
| 9 | **Indoor scent-trail** (`indoor-ai.ts:218`) | 🟡 **ASYMMETRIC** | Team-0 operators lay a decaying scent trail a dog can follow. **But the gate is team-0-only (`world.ts:2203`)** — so only an *enemy* dog can meaningfully track, and a normal player's own dog can't scent-hunt. Tuned for the science raid; effectively one-way in PvP. **The single biggest "is this intended?" in the dog code.** |
| 10 | **Bite — hold/haul** (`world.ts:4601`) | ✅ WIRED | The bite hauls the victim ~5u toward the jaws ("the added threat is space"), 0.2 s windup. No pin/immobilize (that's zombies), no bleed/infection. |
| 11 | **Death, respawn, redeploy** (`world.ts:1765`) | ✅ WIRED | Dies like any soldier; **redeploys at the handler's side** with full HP once the handler is up. Handler leaves → "the dog goes home" (deleted). Exempt from corpse-purge, morale, and the class-request loop. No cross-match consequence. |
| 12 | **Rendering & animation** (`models/soldiers.ts:554`) | ✅ WIRED | A real low-poly German Shepherd: sloped body, black saddle, dark snout, pricked ears, tail, four named leg joints, a **team-colored K9 harness** (read whose dog it is). Trot swings diagonal leg pairs, wags the tail (fast when working). A floating sic/stay marker over your own dog. |
| 13 | **HUD control panel** (`k9-controls.ts`) | ✅ WIRED | HEEL/STAY/CLEARING/"WAITING·DOOR" readout, SIC + STAY/HEEL buttons. **K = sic, L = stay/heel**; gamepad **L3 = sic, R3 = stay**; on-screen + touch. Only appears for infantry/engineer handlers. |
| 14 | **Iron Eater "junkhound"** (`data.ts:834`) | ✅ but NOT an animal | A machine, flagged only so this doc doesn't miscount it as fauna. |

### 10.3 What exists vs what's missing (one line)

*A fully-simulated, rendered, player-controllable military dog with heel/sic/stay orders and a load-bearing anti-stealth nose EXISTS and works; what's MISSING is player agency to field it, symmetric scent tracking, richer orders/roles/packs, and any meta-consequence for its death.*

### 10.4 OPEN QUESTIONS — DOGS & ANIMALS (your punch-list)

1. **Fielding agency:** should bringing a dog be a deliberate choice (loadout slot / rank perk / purchase), or stay an automatic infantry/engineer freebie, one per team?
2. **Scent asymmetry (highest priority):** is the team-0-only scent gate (`world.ts:2203`) intended (guard dogs hunt raiders in science), or a latent bug that should let *both* teams' dogs track? Right now your own dog can't scent-hunt.
3. **Sic scope:** should `sic` target open ground / a marked enemy, not just buildings?
4. **Order vocabulary:** are heel/sic/stay the final three, or does the design want track-this-scent, guard-this-teammate, return-to-vehicle, fetch?
5. **Nose through walls:** should the 10u nose respect walls, and should it draw an explicit scent-ping on the *player's* HUD (not just feed AI perception)?
6. **Breeds/roles:** one archetype forever, or scout/attack/detection variants with different stats?
7. **Packs:** should packs (with real group AI) exist outside science?
8. **Breaching:** keep "dog waits, human opens", or add a breach upgrade?
9. **Bite depth:** should a bite pin/immobilize (a real takedown) rather than haul-and-rebite? Bleed/infect?
10. **Losing your dog:** any consequence (redeploy cooldown, vet cost, handler morale hit, wounded state)?
11. **Handler bond:** is there meant to be a handler-bond stat/relationship, or is ownership purely mechanical?
12. **Other animals:** is a one-species animal kingdom the intent, or do you want wildlife/mounts/pests to make the world feel alive (ties to civilian/pedestrian work in §19)?

---

## 11 · ★ OFFICERS & COMMAND — the deep dive

*Full detail: `.notes/audit-dogs-officers.md` Part Two + `COMMAND-AUDIT.md` (a whole prior audit devoted to this). You asked for this by name.*

### 11.1 The headline: "officer" is three unrelated things, and the command layer you picture does not exist

**Roughly one-fifth of the command vision is real, and almost none of the part you mean when you say "the officers, the command."** What shipped is the *bottom* of the chain and the *money* around it. What's missing is everything above the squad.

"Officer" in the code is **three unrelated things wearing one word**, none of which is a commanding-officer entity that issues orders to bots:
1. **`officer.ts` = a class-quota rules function** — a bodiless, rankless pure function that approves/denies a dead player's class-change request based on team composition. "The officer" is fiction wrapped around a cap check.
2. **`ranks.ts` = a promotion ladder that grants AUTHORITY, not orders** — read off lifetime service; buys a morale aura, the god-call, and a "may take command" label.
3. **The fiction's chain of command** (an officer whose orders bots obey, a hierarchy, in-match promotion, rally) — **does not exist in the sim.** Bots obey their own per-class doctrine AI; nothing commands them but the K9 order.

### 11.2 What actually touches the sim

| # | System | Status | What it does |
|---|---|---|---|
| 15 | **The "officer" class-ruling** (`officer.ts`, `world.ts:1732`) | ✅ WIRED (quota, not entity) | When a *dead* player requests a class change, a leader-AI weighs the live roster and answers in the officer's voice ("DENIED — one wrench per trench"). Infantry always approved; specialists capped by headcount. Deterministic, anonymous, redeploy-only. **The closest thing to "an officer" you hear.** |
| 16 | **Rank ladder & board** (`ranks.ts`, `service.ts`) | ✅ progression / 👻 command | 10 ranks Recruit→General, read off service (a certification is worth 30 — "knowledge is the progression"). Surfaced in the GONET board. But its *command* meaning is mostly fiction text. |
| 17 | **Leadership reach — the morale aura** (`ranks.ts:115`, `world.ts:2430`) | ✅ WIRED (the ONE real command effect) | A ranked soldier steadies nearby teammates' morale (10u Corporal → 38u General). **This is the only place rank changes the sim.** It's passive, proximity-only, has no UI, and **only the human carries rank** — bots never radiate leadership. So in practice it's "stand near the high-rank human." A food truck does the same. |
| 18 | **`mayCallStable` — the god-call gate** (`world.ts:1207`, `stable.ts`) | ✅ WIRED | Lieutenant+ unlocks the V-channel to call an LSW. Real, gated authority. (THE STABLE is the LSW console — **not** an animal stable.) |
| 19 | **`mayCommand` — "the command seat & doctrine package"** (`service-file.ts:115`) | ⬜ UNBUILT (label only) | Captain is advertised as granting "the command seat and set the doctrine." In code `mayCommand` is computed in **exactly one place** — to render a static "MAY TAKE COMMAND" line. **There is no command seat, no doctrine package, no gameplay behind it.** This badge is the whole gap in one line: a door with no room behind it. |
| 20 | **`materielBonus` — rank → manifest** (`ranks.ts:121`) | 👻 defined, never called | Meant to grant +1/+2 opening materiel by rank. **Never imported or called anywhere.** The Staff-Sergeant "heavier manifest" and Major "full manifest" grants are text with nothing behind them. |
| 21 | **The `commander` skill** (`skills.ts:51`) | 👻 declared, unwired | "Squad holds its nerve better," earned by "time holding a command seat." No reader; and since the command seat doesn't exist, the skill can't be earned. |
| 22 | **The squad container `squadId`** (`world.ts:1060`) | 🟡 PARTIAL | Fireteams of 4 by roster order. Does two real things: spawn-on-safe-squadmate, and half-distance rescue bias. **No squad leader, no orders, no squad UI, no squad morale.** A spawn/rescue affinity, not a command unit — and unrelated to leadership radius. |
| 23 | **The `leadership` master-stat** (`types.ts:431`) | 👻 rolled, never read | Commented "squad size, command radius, radio authority." **No sim code reads it** — command radius uses *rankId*, not this stat; squad size is a fixed 4. The stat that literally says "command radius" does not drive the command radius. |
| 24 | **Order flow — do bots obey a commander?** (`bots.ts`) | ⬜ UNBUILT | The **only** order any unit obeys from a player is the K9 command. Bots run entirely on autonomous per-class doctrine. There is **no** "move here / hold / focus / fall back / regroup" for friendly bots. `rally` is flavor text only. |

### 11.3 The chain of command — canon vs reality (from `COMMAND-AUDIT.md`)

Canon: **President → Secretary of War → General → Officer → squad → soldier.** Reality: President is data-only (surfaced on one enlistment screen; 131/169 nations have a blank president string). Secretary of War, General: nothing. Officer: partially real in three disconnected pieces (the manifest planner, the class ruling, the god-call) never presented as "you, the Officer." Squad: a spawn/intel layer. Soldier: you — the whole rest of the game.

**And there are two rival rank ladders** (see §13.3): the god-call is gated by *both* — the console UI checks a 8000-point dossier Lieutenant, the sim checks a 520-service Lieutenant. They can disagree.

### 11.4 What exists vs what's missing (one line)

*What EXISTS is a rank ladder read from real service, a passive proximity morale aura, a rank-gated LSW-summon, and a class-quota "officer" rules function; what's MISSING is the entire command layer the fiction promises — no order-issuing officer, no command seat, no doctrine package, no bots obeying a commander, and the `mayCommand`/`materielBonus`/`commander`-skill/`leadership`-stat hooks all dangle unwired.*

### 11.5 The cheapest path to making command VISIBLE (from `COMMAND-AUDIT.md §8`)

1. **[XS] Give the AI commander a voice** — when any officer (bot or your side's AI) commits a god or draws a manifest, emit one line naming it as command. The decision already happens in `stepLswDrops`; it just needs a string. Instantly satisfies the LOCKED "visible as AI" law.
2. **[XS] Retire or wire the hollow "MAY TAKE COMMAND" badge.**
3. **[S] A "YOUR COMMAND" GONET panel** — your rung + the AI-held seats above (General/Secretary/President with the real nation president), each tagged `[AI] — you may take this seat`. Pure read-only from data that already exists.
4. **[S] Reconcile the two rank ladders** (see §13.3).
5. **[S] Show morale + "under command"** — a pip when inside `leadershipRadius` so rank's real effect is felt.

### 11.6 OPEN QUESTIONS — OFFICERS (your punch-list)

1. **Define the command seat (the biggest one):** what does Captain's "command seat & doctrine package" actually DO — order-issuing, team re-kit, an RTS view, or stance selection? Until answered, rank 6+ is command in name only.
2. **Do bots obey a commander at all?** Decide whether player-as-officer can command friendly bots, and the shape (verbs / stance / seat). This unblocks the command seat, the `commander` skill, and the squad link.
3. **`materielBonus`:** wire rank → opening materiel (rank becomes a soft power curve), or delete it (rank stays strictly non-numeric authority — the stated law)?
4. **`leadership` stat vs `rankId`:** unify command authority, or keep two systems (earned rank aura + innate trait)?
5. **NCO/officer bots:** should bots carry rank and radiate leadership (a real chain on the field), or is the aura the human's alone?
6. **Squad ↔ command link:** give the 4-man squad a leader tied to rank, and make it the unit orders act on?
7. **The "officer" identity:** should the class-quota officer become an actual in-world CO (visible, mortal, whose absence lifts the quota), or stay a disembodied rule?
8. **Leadership feedback:** any UI so you perceive the command/morale aura you provide, or is it invisible-by-design?

---

## 12 · ★ CERTIFICATIONS & SCHOOLS — the deep dive

*Full detail: `.notes/audit-progression.md §1` + `STATISTICS.md §2.7`. You asked for this by name. This is the healthiest system in the progression slice.*

### 12.1 The headline: 12 vehicle certifications, earned by driving a real exam, gate one thing — the wheel

**All certifications are VEHICLE certs.** You earn one by **driving a course** (a genuine in-sim exam, not a purchase), and holding it does exactly one thing in the sim: **it lets you take the driver's seat.** There is **no weapon/combat certification** — that's a gap you flagged, and it's real.

### 12.2 The full register (all 12, ✅ WIRED)

| # | Licence | Tier | School | Covers | Requires |
|---|---|---|---|---|---|
| 1 | Basic Driver | 1 | Motor Pool | Cars, runabouts, bikes, light utility | — |
| 2 | Heavy Truck | 2 | Motor Pool | Trucks, buses, plant, air brakes | Basic Driver |
| 3 | APC | 3 | Armour School | Armoured personnel carriers | Heavy Truck |
| 4 | Tank | 4 | Armour School | MBTs, assault walkers, breachers | APC |
| 5 | Hovercraft | 2 | Motor Pool | Hover decks, skirted hulls, raceboards | Basic Driver |
| 6 | Boat | 2 | Naval Yard | Surface craft, gunboats | — |
| 7 | Helicopter | 3 | Flight School | Rotary wing | — |
| 8 | Fixed Wing | 3 | Flight School | Non-hovering aircraft | — |
| 9 | Bomber | 5 | Flight School | Heavy payload airframes | Fixed Wing |
| 10 | Transport | 3 | Flight School | Crewed lifters, large passenger hulls | Heavy Truck |
| 11 | Drone Pilot | 2 | Signals School | Remote hulls, FPV drones | — |
| 12 | Dropship | 5 | Flight School | Combat insertion craft | Transport |

**5 schools:** Motor Pool, Armour School, Naval Yard, Flight School, Signals School. Awarding the top of a chain awards the whole chain (Tank → Basic Driver → Heavy Truck → APC → Tank).

### 12.3 Does a cert change gameplay? — YES, exactly one effect (✅ WIRED)

`world.mayDrive(s, kind)` (`world.ts:5451`): a soldier lacking the paper for the *wheel* is pushed to a passenger bench ("NOT CERTIFIED TO DRIVE — RIDING · <licence> at <school>") — or refused if no bench. **Bots are never gated** (no `papers` array = ISSUED). Only the human, whose papers the client hands over at spawn, can be told no — and only for the *wheel* (you may still ride in the back).

**Second-order effect (✅ WIRED, indirect):** holding a cert feeds the **service score** at 30 points each — the highest per-unit value in the game (a cert = 30 kills) — which raises rank, which gates the god-call and the morale aura. This is the one place a cert does more than open a seat.

**Everything else that touches licences is read-only surfacing (👻 for gameplay):** the codex "Licence" column, the GONET desk "Certifications X/Y", the mail nudge, the broadcast "Training Films" reel (they *display* the drill lessons; they don't teach or gate), and the briefings readiness line.

### 12.4 How a cert is EARNED — a real, driven exam (✅ WIRED)

You **drive a course** (`courses.ts` — a program for all 12 licences). Each course is a chain of drills (straight/slalom/brakebox/handbrake/parking/circuit), each with a one-line lesson, laid deterministically as gates. The examiner `stepSchool` (`modes.ts:820`) seats you in the course hull, you drive the gates **in order**, and clearing the last gate signs the licence (whole chain persisted, account-level).

**The exam's limits:** it's a **drive-through, not a skills assessment** — nothing checks you actually braked in the box or held the slalom; touching the gate radius is the whole test (**on foot passes too**). There is **no wash-out** — par time is recorded but gates nothing (just "QUALIFIED" vs "QUALIFIED, INSIDE PAR").

### 12.5 The "weapons-testing / training certs" you mentioned — PARTIALLY exists, and gates nothing

- There **is** a weapons/infantry test: the Proving Grounds range (`range.ts`) — 6 timed targets, grades Qualified/Marksman/Sharpshooter/Expert.
- **But:** (a) it feeds the *dossier* rankPoints ladder, **not** the service ladder that gates the god-call; (b) the qual is read only for a **barracks display card** — it gates nothing in the sim; (c) **only the infantry class has a qual** — every other class's qual is unbuilt.
- There is **no weapon-specific certification** at all (no "cleared for the railgun," no marksmanship cert that unlocks a weapon). Weapon competence is entirely the ungated secondary-skill system.

### 12.6 The naming collision — three unrelated "certifications"

The word is overloaded: **(1) vehicle LICENCES** (this section, real & earned), **(2) infantry QUAL** (`range.ts`, a display stub), **(3) command certification** (`record.ts:119`, Provisional→Operation Officer, driven by operation points, display-only). The GONET/codex/mail blur them.

### 12.7 OPEN QUESTIONS — CERTIFICATIONS (your punch-list)

1. **Which commission ladder is canonical** for opening the stable — the dossier `rankPoints` (8000/OCS) or the service `serviceScore` (Lieutenant@520)? One should gate; the other retire or map onto it. (This is the single biggest progression contradiction — see §13.3.)
2. **Should the exam actually test the drill** (brake inside the box, hold the slalom, respect min-airspeed), or is "touch every gate, no wash-out" the intended forgiving design? Should par ever gate (a distinction tier)?
3. **Do you want weapon/combat certifications at all** — a per-class or per-weapon-family qual that *unlocks* or *gates* something — or is weapon competence meant to stay the ungated skill system? If quals stay, should they extend past infantry and feed the canonical rank ladder?
4. **Should holding a licence do more than open a seat** — e.g. a piloting/handling feel bonus for certified drivers — or should that stay the job of the separate secondary skill? (Today: cert = seat, skill = feel, and they never interact.)
5. **Naming:** consolidate the three "certification" concepts so the UI stops blurring them.
6. **Should the AI faction's certs matter** (its bodies are auto-issued all papers), or is the whole progression layer intentionally player-only?

---

## 13 · PROGRESSION — the 8 stats, 22 skills, rank, morale

*Full detail: `.notes/audit-progression.md` + `STATISTICS.md §2`. This is where the RPG-layer gaps live.*

### 13.1 The 8 master stats — 3 wired, 5 dead, and all inert for the human

`SoldierStats` (`types.ts:425`): power, agility, handling, piloting, engineering, leadership, science, charisma. Applied via `statMul`/`statQuick` (±2%/point around 5).

- **✅ WIRED (3):** POWER (spawn HP + melee), AGILITY (dash/roll cooldown), HANDLING (reload time).
- **👻 DEAD (5):** piloting, engineering, leadership, science, charisma — generated on every soldier, carried on the print, ride the wire — and **no sim code reads them.** (Leadership reach uses *rankId*, not the leadership stat.)
- **The critical caveat:** the **human spawns with hardcoded neutral 5s** and nothing ever raises them ("until the meta-layer assigns real people"). `statMul(5) = 1`, so **even the 3 wired stats are a no-op for the player.** They only vary for *bots* (hash-rolled 3–7). Five of eight stats are dead everywhere; the other three are alive for bots only.
- **Decay ("use it or lose it")** is LOCKED in canon — **⬜ UNBUILT.** No decay code exists.

### 13.2 The 22 secondary skills — 8 wired, 14 inert, and they don't persist

Skills (`skills.ts`) level through use, cap at Master (+12%).
- **✅ WIRED (8 gun families):** rifle/smg/lmg/sniper/rocket/knife/pistol/explosives — landing a round practises the skill, which tightens the aim cone via `handSpreadMul`.
- **👻 INERT (14):** tank_driver, tank_gunner, helicopter, jet, boat, engineer, medic, dog_handler, drone_pilot, radio_operator, commander, navigator, mechanic, scout — each has a `gives` promise ("faster revives," "steadier hover," "the dog holds longer") but **no consumer.**
- **🟡 No cross-match persistence:** there is no per-account skill store — `s.skill` resets to the hometown head-start every spawn. "Levels through use" is only true within a single match; at match end only a *count* of bands feeds service.
- **Hometown head start (✅ WIRED as seed):** your archetype grants 2 skills at 30 practice.

### 13.3 Rank — and the two-ladder contradiction

Two independent "rank" systems run at once, both claiming to gate the god-call with different currencies:
- **System B — `ranks.ts` (service):** 10 rungs, Lieutenant at **520 service**; gates `world.requestLsw` and the morale aura. *(The authority-based ladder — the right one to keep.)*
- **System A — `record.ts` (dossier rankPoints):** 14 rungs, Lieutenant at **8000 points**; gates the stable *console UI*.

A player can satisfy one and not the other. **This is the single biggest thing to resolve in progression.** Also: `materielBonus` is defined-but-never-called (§11), and `fileService` (`main.ts:1484`) **omits medals**, so `SERVICE_POINTS.medal = 25` is unreachable in the service ladder.

### 13.4 Morale (✅ WIRED — but invisible)

A live 0–100 value (`morale.ts`), base 60, five bands that scale the aim cone and bot cover-seeking. Moved by ~10 events (friend down −14, kill +7, led-well +0.7/s, alone −0.9/s). **But there is no morale HUD readout at all** — it's a real system the player can never see. And its aggressive half (`wantsToPush`, m≥88) is **dead code** (§2.7) — a winning side never actually presses harder.

### 13.5 OPEN QUESTIONS — progression

1. **The two rank ladders** — pick one canonical (recommended: `ranks.ts` service), retire/bridge the other.
2. **The 5 dead stats** — wire them (piloting→flight feel, engineering→repair speed, etc.) or accept them as meta-layer theatre? And **decay** — build it or drop the LOCKED promise?
3. **Skill persistence** — add a per-account skill store so "levels through use" is true across matches, and wire the 14 inert skills' bonuses?
4. **Make morale visible** — a meter/band + "under command" pip? (It's a fully-wired system the player can't perceive.)

---

## 14 · ECONOMY — the war chest, treasury & ledger

*Full detail: `.notes/audit-progression.md §6` + `COMMAND-AUDIT.md §2.1`.*

**✅ WIRED — a genuine closed win-or-lose loop.** The war chest (`treasury.ts`, opening 12,000) earns/loses on every decisive match (win +3,000 / loss −1,500 / draw +250, minus hull bills), and `budgetMultiplier()` bands the balance into a 0.6–1.25 multiplier handed to the sim as `opts.budget`, scaling **opening materiel** (`world.ts:730`). A broke army genuinely fields fewer requisitions and god-calls. Surfaced on the after-action pane, the GONET desk, YOUR FILE, and ministry mail.

- **The Combat Ledger** (`ledger.ts`) is the accountant behind THE BOARD — folds multi-pellet/plate+flesh hits into whole "attacks," ranks hardest blow / longest kill / defence, read-only by construction.
- **Asymmetry (note):** only the player's faction is settled; the AI faction's treasury never moves (`main.ts:928` hardcodes the enemy budget to 1).

**OPEN QUESTION — economy:** should the AI faction's economy matter (a live opposing war chest), or is the treasury intentionally player-only? And is there a spend sink beyond opening materiel (a shop, upkeep, the meta-layer)?

---

## 15 · IDENTITY, ENLISTMENT, HOMETOWN, NATIONS & CULTURE

*Full detail: `.notes/audit-progression.md §8` + `STATISTICS.md §7`.*

- **Enlistment/identity (✅ WIRED):** country → faction (derived, frozen), callsign, hometown, a psych intake (3 answers → recommended class + temperament). `faction` keys the treasury and the sim team.
- **169 nations** (`nations.ts`) each carry 4 doctrine stats (military/intel/science/lswActivity). **These DECIDE your faction and colour the onboarding (✅ WIRED for identity) but do NOT change what a nation fields in battle (◐ for combat)** — a high-military nation brings no extra armour. That's the meta-layer's unbuilt job. **131/169 nations have a blank president string.**
- **Hometown archetype (✅ WIRED as skill seed):** 9 archetypes (port/industrial/capital/garrison/frontier/university/mining/farm/transport), each granting 2 starting skills at 30 practice, derived deterministically from the nation's doctrine + city index + name hash.
- **Culture (✅ WIRED as VO selector):** 12–14 culture codes (`culture.ts`) reverse-engineered from `map-cities.json`; `playerCultureCode()` maps your enlisted nation → culture for street VO (§19). Also drives architecture. Does not touch combat.

**OPEN QUESTIONS — identity:**
1. **Nation doctrine in combat** — should a high-military nation actually field more armour, a high-science nation better tech (making your country choice matter in the fight), or is doctrine intentionally identity-only?
2. **The blank presidents** — fill the 131 missing names (the data model supports it) so the enlistment reveal isn't blank for most nations?
3. **Home-city weight** — does picking a specific *city* (not just archetype) matter enough? (Today two cities of the same archetype are identical.)

---

## 16 · THE GONET — the in-game laptop OS

*Full detail: `.notes/audit-gonet.md`. The most complete meta surface in the game — a faux-OS of real apps, every figure derived from real state (nothing faked).*

### 16.1 The apps (status)

| App | Status | Notes |
|---|---|---|
| **Shell** (`gonet/index.ts`) | ✅ WIRED | 8-tab faux-OS, 1–8 walk the apps, ESC → desk, always-mounted corner music player. |
| **DESK / world status** | ✅ WIRED | Every row derived (front standing, the light/clock, mission counts, unread mail, rank, certs held, garage count, war chest). "The most honest surface in the game." |
| **BRIEFINGS** | ✅ WIRED | 7 military + 5 science missions as briefs with objective phases and a licence-checked hull manifest; deploy-on-brief routes into the same `startGame`. |
| **MAIL** | ✅ WIRED | A real inbox with read-state, unread badge, per-message CTAs — every message derived (treasury, next cert, fastest lap, hometown, temperament). |
| **BROADCAST** | ✅ WIRED | "TV with no video" — timed graphic reels off the press/records/certs across 3 channels (War Desk / Home Service / Training Films). Reports what you actually did. |
| **MUSIC** | ✅ WIRED | See §16.2. |
| **SPORTS** | 🟡 PARTIAL | See §18. |
| **THE DECK** (cartridges) | 🟡 SHELL | See §17. |
| **YOUR FILE** | ✅ WIRED | Papers, board, war chest, garage (delegates to `renderServiceFile`). |

### 16.2 Music → field headphones — the marquee promise is 100% REAL

The single most-asked question, answered in code: **yes.** `library.ts` (9 tracks, playlists, favourites, exactly one FIELD playlist) + `musicDeck()` (one shared HTMLAudio deck) + `Headphones.wear()` (stops the war score, cuts the world bus 55%, swaps to the field playlist) + **the H key** (`main.ts:672`, in-match only). The corner player and the field cans are provably the **same deck singleton** — a song queued at the laptop is the song still playing when you put the cans on, and the war score yields while the cans are on. The only friction: 9 fixed tracks (no user import), volume-only mixer.

### 16.3 OPEN QUESTIONS — the GONET

1. **User music import** — the field-headphones system is complete but the library is 9 fixed tracks. Allow the player to add their own?
2. **The dead MULTIPLAYER tile** (`index.ts:229`, "COMING SOON") — wire it to the real netcode (§22) or hide it?
3. **Promised apps** (friends/marketplace/war-map) — build as tabs, or leave folded into YOUR FILE/desk?

---

## 17 · THE ARCADE / CARTRIDGE SYSTEM — a display case, not games (yet)

*Full detail: `.notes/audit-gonet.md §6`. This is your `/loop` target — here is exactly where it stands.*

**Status: 🟡 SHELL. There are NO playable portable games and NO walk-up arcade cabinets in the world.**

**What exists (nicely made):** a footlocker UI of 5 cartridges (ORBIT RUN, DEEP SHAFT, HARVEST 88, SIEGE TOWER, NIGHTWATCH — all flavour text) with an in-fiction arcade-industry voice, a mock console face, and **real save data** (owned + provenance + per-cartridge best + session count).

**What does NOT exist:**
- **No actual game.** `playCartridge()` (`main.ts:2452`) increments a counter and shows an **`alert()`** with the blurb. There is no minigame canvas, no loop, no interaction.
- **The morale payout is unwired.** `DECK_MORALE = 6` is referenced *only* in that alert string — nothing reads it, and there is no persistent player-morale store to write to. **The UI promises a reward it never grants.**
- **No walk-up arcade consoles in the world.** No cartridge cabinet entity, no proximity-E arcade machine.
- **"drive-n-shoot / divided states of america" appears nowhere in `src/` or `docs/`.** It's a concept from your prompt, not yet in code.

### 17.1 OPEN QUESTIONS — the arcade (the biggest fork for your `/loop`)

1. **Do cartridges become real minigames, or stay collectible objects?** If real: you need an in-Deck canvas + a score→`fileScore`→morale pipe, and at least one actual playable loop (this is where "drive-n-shoot / divided states" would be built). If collectible: drop the morale promise and make them pure found/trade objects.
2. **Where does persistent player morale live?** `sim/morale.ts` is per-soldier-per-match. The Deck's "morale on your next deployment," the newspaper's morale figures, and much of the meta-layer all imply a *persistent* morale store that doesn't exist. Deciding this unblocks the arcade reward and more.
3. **Walk-up cabinets:** do you want real proximity-E arcade machines in the world (Vanessa's-style walk-up), and are they the same games as the portable cartridges or a separate set?

---

## 18 · SPORTS AS AN INSTITUTION & THE NEWS

*Full detail: `.notes/audit-gonet.md §5` + `.notes/audit-vehicles.md §D,G`.*

**Status: 🟡 real institution, thin league.** SPORTS (`gonet/sports.ts`) is genuinely tied into the world: 3 of 5 disciplines run (circuit/time-attack/demolition; gun-run/freestyle honestly flagged PLANNED), standings derived off the record board, deterministic weekly fixtures, and — critically — **the circuit lives in the same paper as the war**: a finished race files a `RacePressData` issue, the newspaper runs a sports headline, and the GONET broadcast cuts a sports reel. That news tie is wired and load-bearing.

**What's thin:** no season structure (standings = a record-count leaderboard, not a points table; no championship, no result persistence), and fixtures are a *rotation* whose venue/class don't pass through to the launched match (`enterSport` takes only `mode`). Plus the car-lap bug (§5.2) means the "circuit" discipline only counts board laps in practice.

### 18.1 OPEN QUESTIONS — sports/news

1. **League or launcher?** Build points + a season calendar + result persistence + pass fixture venue/class into the match, or accept SPORTS as a themed launcher for the modes?
2. **Single vs multiplayer racing** — you named both; the modes run locally and over the real netcode (§22), but there's no matchmaking/ladder. Is racing a ranked online sport, or local + async ghosts?
3. **A shared wire service** — today only *your* battles/races file news. For a world that "generates its own news," should other players'/AI fronts file issues too?

---

## 19 · STREET VOICE — pedestrians & the vigilante

*Full detail: `.notes/audit-gonet.md §7` + `docs/STREET-VO.md`.*

**Status: 🟡 catalogue built, 👻 mostly unheard.** The culture legend (`culture.ts`), the full bark catalogue (`streetvo.ts` — 10 events across 12 cultures, both speakers), the deterministic picker, and the enlisted-nation → culture map are all wired, with 18 sample TTS clips across 6 cultures. **But of 10 catalogued events, only 2 ever fire:** `gunfire` (a civilian *car* panics) and `god` (an Ascendant walks past). The other 8 (idle/flee/reckless/wounded + all four vigilante lines) have text but **no trigger**.

**The core blocker:** there is **NO walking-pedestrian entity and NO vigilante entity.** The "pedestrian" is literally a **civilian vehicle** (`traffic.ts`) — a fleeing car with a voice. `StreetVoice.vigilante()` exists but has **zero callers**. So the whole "do bad things and the street turns on you — first a neighbour with a bat" lore seed is unbuilt, and the voiced `challenge` audio can never play.

### 19.1 OPEN QUESTIONS — street voice

1. **Do civilians ever get out of the car?** Every street-VO ambition (the vigilante, walking pedestrians) is blocked on there being no foot-civilian entity. Commit to a walking-pedestrian entity, or re-scope street VO permanently around vehicles (capping it at gunfire/god/reckless)?
2. **`reckless` is low-hanging fruit** — the traffic layer already knows when you nearly hit a civilian; wire that one event for an easy win.
3. **The vigilante** — build the entity (the pedestrian who doesn't run, who challenges → warns → engages)? The barks are ready and waiting.
4. **The remaining 6 cultures' audio** — generate the full set (`--all`), or keep the text-bark fallback?

---

## 20 · THE CLOCK & WEATHER

*Full detail: `STATISTICS.md §6.4–6.5` + `docs/THE-CLOCK.md` + `.notes/audit-gonet.md §3.1`.*

- **The one clock (✅ WIRED):** one game-day = two real hours. Two clocks — the **world clock** (menus, derived from real UTC so every client agrees with no server) and the **field clock** (`world.time` in a match) — which drift when a match pauses. The corner chip reads *the world you stand in*, and returns "NO CLOCK" where there is none (yard/shop/threat). Full `TimeControl` (scrub/rate/freeze/nudge, re-anchored so rate changes don't teleport). Night is TIME not weather when a clock rides a match. Driven by the admin room today — the **government-facing control ("the government turns these knobs later") is not built.**
- **Weather (✅ WIRED):** 7 skies, each a modifier set — `visionMult` (fog 0.3, storm 0.42), locomotion drag, and air-grounding. Each theme has its own allowed sky menu. A 0.16 vision floor. Consumed by both the player's eyes and the bots'.

**OPEN QUESTION — clock:** the "government controls the clock later" hook is unbuilt — is time control a player/command power, or purely an operator tool?

---

## 21 · THE RENDERING PIPELINE

*Full detail: `.notes/audit-misc.md` (Rendering).*

**✅ WIRED, no half-built visual systems found.** `renderer.ts` (6515 lines — the largest client module) owns the full static-world build, per-frame update, and the event→VFX bridge: weather precipitation, impact/blood/blast-ring decals, the vision-cone darkness shader, sky dome + water, reticles, melee/struggle rings, killcam round, unit tags/minimap, the ghost-board placement preview, soldier animation, LSW presentation (aura/ice-encase/blink), projectiles/tracers, grenade-arc preview, in-world Vanessa's + paintball dressing, and destruction (breach piles/tile collapse). Supported by the model builders (`soldiers`/`vehicles`/`props`, procedural low-poly, shared by the codex bench and the game), `animation.ts` (one shared walk cycle), `effects.ts` (pooled particles), `damagetext.ts`, `darkness.ts` (the analytic cone as a ~6-ALU shader chunk), and `segmeter.ts` (the one meter grammar).

**Note (worth a live-verify pass):** the grip solver, the classvo dispatcher, and the LSW aura/ice/blink all have complete code, but MEMORY carries prior "grip still broken" / "abilities need wiring" notes — worth a Playwright live-match visual check rather than trusting the code read alone.

---

## 22 · MULTIPLAYER & REPLAY — a real authoritative spine, no service layer

*Full detail: `.notes/audit-misc.md` (Headline) + `COMMAND-AUDIT.md §6`.*

**The verdict: multiplayer is REAL, not aspirational — but it is a *game*, not yet a *service*.**

**What's real (✅ WIRED):** a dedicated authoritative Node WebSocket server (`server.ts`, `npm run server`, port 3401) running the *same* deterministic sim at 30 Hz, broadcasting per-viewer interest-culled snapshots at 15 Hz (`cullSnapshotFor` — genuine server-side anti-cheat: "nobody's wire carries an enemy they couldn't perceive"). The client is a true thin puppet that dead-reckons between authoritative snapshots. Bots fill every room, joins/leaves swap them in/out, chat/waypoints/mailbox/god-call all ride the wire. Single-player (offline bots) and multiplayer **share one deterministic sim**, with a graceful fallback to bots if the socket fails. The whole replay/killcam spine uses the same puppet-world machinery.

**What's missing (the honest caveats):**
- **No matchmaking, lobby, or server browser** — you paste a URL.
- **No accounts / auth / server-side persistence** — career is IndexedDB-local; the code self-flags "Stage-2 hardening" (plain HTTP, dev-key default, wide-open CORS) and self-describes as LAN-grade.
- **The rank gate doesn't hold server-side** (`COMMAND-AUDIT.md §6`): the server builds its World without `opts.rank`, so the commission check is skipped — *any* human can call a god online; the `commissioned` flag is client-honor-system.
- **`godmode` ships in the live client** — a backtick-key untouchable-any-god testing harness that needs a gate before online exposure.
- The **entire political/command layer** (seats, votes of confidence, take-over) is unbuilt behind the missing accounts backend (§11, `COMMAND-AUDIT.md`).

### 22.1 OPEN QUESTIONS — multiplayer

1. **Product shape:** does War World ship as (a) a self-host/LAN build (the current honest state), or (b) a hosted service (needs matchmaking + accounts + hardening + delta-compressed snapshots)? Every deferred item hangs off this.
2. **Close the commission hole** (pass `opts.rank` / enforce `commissioned` server-side) before MP is public.
3. **Gate `godmode`** out of the live client for online play.
4. **One career or two, synced?** The war Dossier and the yard Field Record are separate local books — if accounts arrive, do they sync as one identity?

---

## 23 · STEAM DECK / DESKTOP BUILD

*(Built this session — see `docs/STEAM-DECK.md` and `memory/steam-deck-desktop-build.md`.)*

**✅ WIRED (the shell + controller nav):** an Electron desktop shell (`electron/main.cjs`) with an `app://` custom protocol (fixes `file://` absolute-asset 404s), Deck RDNA2 GPU flags, fullscreen, and START/F11 handling; a spatial DOM gamepad navigator (`gamepad-ui.ts`) that scopes focus to the topmost visible layer (pause-overlay → options → onboarding), with pad START → pause and quit-any-game. Controller-only navigation to deploy, options, and the pause/quit flow.

**What remains:** the AppImage can't be built on Windows (needs a Linux box or CI); a full controller pass over *every* surface (the GONET apps, the garage, the schools) beyond the core menus; and a real Deck on-device test.

**OPEN QUESTION — Deck:** do you want a full controller pass over every GONET app and sub-screen (armory/garage/schools/sports), or is controller-to-deploy + pause/quit enough for the first Deck build?

---

## 24 · PAINTBALL & VANESSA'S PRO SHOP

*Full detail: `.notes/audit-misc.md` (Paintball & the Shop). Robert's competitive arc — all ✅ WIRED.*

- **Paintball AI** (`paintball.ts`): every yard bot dealt a style (rusher/flanker/anchor); hunters chase by **sight not sonar** (break LOS in the maze and after 6 s they lose the trail); positioned barks/taunts.
- **The Field Record** (`fieldrecord.ts`): the paintball card kept OUT of the war Dossier — outnumbered splits, off-the-break splats, clutches, the **Gauntlet ladder** (you vs a pack of N, two losses ends a run).
- **The Honors** (`trophies.ts`): circulating single-holder artifacts with append-only lineage — the Yard Cup, the Longball Belt (transfers mid-match on a record splat), the House Score.
- **Vanessa's Pro Shop — built twice:** a standalone page (`/vanessas.html`) and an in-game walkable interior (`vanessas-place.ts`) — a real sealed map under the war camera, walk-up stations, E-key comic-lettered conversations, "take it to the yard" writing the same marker store the yard deploys from.
- **RingDrill** (READ-THE-RING boot camp) and **GalleryDrill** (the target range feeding the House Score) are wired player features.

**OPEN QUESTION — paintball:** the persona-driven trash-talk is scripts-only (VO generation is a separate workstream) — voice it now, or keep overhead text?

---

## 25 · TELEMETRY — THE BOARD

*Full detail: `.notes/audit-misc.md` (Telemetry) + `memory/the-board-telemetry.md`.*

**✅ WIRED.** THE BOARD (`board.ts`) — the cinemascope 2.28:1 desk under the TV, four derived columns: **THE RECKONING** (named superlatives — hardest blow, best defence, longest kill, deadeye), **THE FIGHTERS** (click-to-rank table), **THE ENGINE** (fps/1%-low/sim+draw ms/draw calls/tris + body/hull counts, from `renderer.stats()`), **THE FEED** (rolling killfeed). Owns no truth — the Combat Ledger (`ledger.ts`) is the read-only accountant behind it. On by default on desktop.

Plus the **Black Box** (`blackbox.ts`) — every authoritative sim self-records a 0.5 Hz time-series (spread, base-pooling, STUCK bodies — the statue-bug signature) readable via `__ww.blackbox('report')`.

---

## 26 · DEV TOOLS & HARNESS (internal — not player features)

*Full detail: `.notes/audit-misc.md` (Dev Labs).*

Separate `/*.html` Vite entry points, not reachable from the game menu: `stylelab` (papercraft-body experiment), `bodylab` (capsule-vs-papercraft bench), `beamlab` (continuous-beam harness), `armorysheet` (the weapon contact sheet), `propsheet`, `fxsheet`, `ui-gallery` (the HUD decision sheet), `admin` (THE ADMIN ROOM — the clock scrub lives here), and `harness/matchup.ts` + `harness/mapmaker.ts` (the Map Maker). **Exceptions that ARE live:** `ringdrill` and `gallerydrill` (player features, §24); `godmode` (a testing harness that currently ships in the live client — needs a gate, §22).

---

## 27 · THE MASTER GAP TABLE & THE QUESTIONS FOR ROBERT

### 27.1 Everything not finished, ranked by leverage

**The tier that makes the game *read* smarter/richer (highest player-visible impact):**

| # | Gap | Status | Where | Fix size |
|---|---|---|---|---|
| 1 | **Car/truck/bike races count zero laps** | 🟡 live bug | `modes.ts:362` | **XS** (one-line filter widen) |
| 2 | **No true flanking / fight-from-cover** (bots trade in the open) | 🟡 | `bots.ts` | L |
| 3 | **Command is invisible** — no seat, no visible AI commander, hollow "MAY TAKE COMMAND" badge | ⬜/👻 | §11 | S (visible) → L (takeable) |
| 4 | **Morale is invisible** (no HUD) and `wantsToPush` is dead code | 👻/⬜ | §13.4, §2.7 | S |
| 5 | **The arcade Deck has no game and pays no morale** | 🟡 shell | §17 | M (one playable loop + morale store) |
| 6 | **Street VO fires 2 of 10 events; no walking pedestrian / vigilante entity** | 👻/⬜ | §19 | M |
| 7 | **Terrain is flat on every generated map** (read-path wired, no generator writes height) | 🟡 | §7.4 | M |

**The tier that makes the RPG layer real:**

| # | Gap | Status | Where |
|---|---|---|---|
| 8 | **Two rival rank ladders** both gate the god-call with different currencies | 🟡 | §13.3 |
| 9 | **5 of 8 master stats dead; all 8 inert for the human; decay unbuilt** | 👻/⬜ | §13.1 |
| 10 | **14 of 22 skills inert; skills don't persist across matches** | 👻/🟡 | §13.2 |
| 11 | **`materielBonus` defined-but-never-called; `fileService` omits medals** | 👻 | §11, §13.3 |
| 12 | **No weapon/combat certification; infantry qual is a display stub** | ⬜/🟡 | §12.5 |
| 13 | **Cargo capacity does not exist** (no hull out-hauls another) | ⬜ | §3.4 |
| 14 | **Nation combat doctrine unbuilt** (your country doesn't change what you field) | ◐ | §15 |

**The tier of unfinished content/layers:**

| # | Gap | Status | Where |
|---|---|---|---|
| 15 | **EXTINCTION T4 tier defined, zero units use it** | ⬜ | §6.3 |
| 16 | **Track Builder unreachable** (`checkpointsFor` no callers); race circuit flat (no ramps/railings) | 👻/⬜ | §5.3 |
| 17 | **Gun Run + Freestyle disciplines are shells** | ⬜ | §5.3 |
| 18 | **Crusher Ram cargo has no mechanic; `fitLegal` dead code** | 👻 | §3.2 |
| 19 | **Multiplayer: no matchmaking/accounts/hardening; commission gate skipped server-side; `godmode` ships** | 🟡 | §22 |
| 20 | **Forensics / decay-to-bones is idea-stage only** | ⬜ | §9.2 |
| 21 | **SPORTS has no season** (record-count "standings," no points/persistence) | 🟡 | §18 |
| 22 | **Indoor CQB AI only wakes on city/science maps** | 🟡 | §7.4 |
| 23 | **Influence map has one consumer; the Director tunes only twitch** | 👻 | §2.7 |
| 24 | **LSW↔campaign economy half-plumbed** (no per-front stables) | 🟡 | §6.3 |

### 27.2 THE QUESTIONS — grouped, your named three first

**★ DOGS / ANIMALS** (§10.4 — full 12)
- Should fielding a dog be a *choice* (loadout/perk/purchase) or stay an auto infantry/engineer freebie, one per team?
- **Is the team-0-only scent gate intended, or a bug?** (Your own dog can't scent-hunt today — highest-priority flag.)
- Should `sic` work on open ground / a marked enemy, not just buildings? Are heel/sic/stay the final vocabulary?
- Breeds/roles? Packs outside science? A breach upgrade? A pin/takedown bite? A cost for losing your dog? A handler bond?
- **Is a one-species animal kingdom the intent, or do you want wildlife/mounts/pests?**

**★ OFFICERS / COMMAND** (§11.6 — full 8)
- **Define the command seat: what does Captain's "command seat & doctrine package" DO?** (Until answered, rank 6+ is command in name only.)
- **Do bots obey a commander at all** — and in what shape (order verbs / a team stance / an RTS seat)? This unblocks the command seat, the `commander` skill, and the squad link.
- `materielBonus`: wire rank→materiel, or delete it (is rank ever numeric power)?
- Unify the `leadership` stat with `rankId`, or keep both? Should officer *bots* carry rank and radiate leadership? Give the squad a leader?
- Should the class-quota "officer" become a visible, mortal in-world CO? Any UI so you feel the leadership aura?

**★ CERTIFICATIONS** (§12.7 — full 6)
- **Which commission ladder is canonical** — dossier rankPoints (8000/OCS) or service score (Lieutenant@520)? (Retire/bridge the other.)
- Should the exam actually test the drill (brake in the box, hold the slalom), or is "touch every gate, no wash-out" intended? Should par ever gate?
- **Do you want weapon/combat certifications at all** (a qual that unlocks/gates a weapon), or does weapon competence stay the ungated skill system? Extend quals past infantry?
- Should a licence do more than open a seat (a certified-driver feel bonus)? Consolidate the three "certification" concepts? Should the AI faction's certs matter?

**RACING & THE ARCADE** (your `/loop` — §5.4, §17.1, §18.1)
- **Fix the car-lap bug now?** (One-liner, unblocks 3 of 4 classes — recommended first action.)
- Wire the Track Builder into deploy; should the generator author ramps/railings/elevation?
- Build Gun Run + Freestyle (parts exist)?
- **Do cartridges become real minigames** (where "drive-n-shoot / divided states" gets built) or stay collectibles? **Where does persistent player morale live?** Walk-up cabinets — same games or separate?
- SPORTS: a real league (points/season/persistence) or a launcher? Racing single-player + async ghosts, or ranked online?

**COMBAT / AI** (§2.9)
- How smart should bots *look* (flanking + fight-from-cover), and gate it to higher difficulty? A real AI squad commander, or emergent-only? Make the Director visible?

**THE WORLD & PROGRESSION** (§7.5, §13.5, §15)
- Should generators author terrain height (vertical warfare on every map)? Should the indoor CQB brain wake on scatter maps?
- Wire the 5 dead stats + decay, or accept them as theatre? Add per-account skill persistence? **Make morale visible?**
- Should your **nation's doctrine change what you field in battle**? Fill the 131 blank presidents? Make the specific home *city* matter?

**MULTIPLAYER & THE META** (§22.1, §14, §9.3)
- **Self-host/LAN or hosted service?** (Everything deferred hangs off this.) Close the commission hole + gate `godmode` before public. One synced career or two?
- Should the AI faction have a live economy? Is there a spend sink beyond opening materiel?
- Does "Science" grow toward **forensics** (decay-to-bones, evidence, a coroner layer), or stay covert Scientist-Hunt ops?

---

## 28 · THE ONE-PAGE TAKEAWAY

**Built and excellent:** the combat sim (damage, AI perception, A\* nav, 40 gods, 316 weapons), the whole vehicle drivetrain, materials/weather/destruction/fire, 17 game modes, a real 10-front campaign with Operations, the K9 dog (a genuinely first-class entity), the certification schools, the war-chest economy, the GONET laptop, the music-on-the-field system, THE BOARD, paintball + Vanessa's, and a real authoritative-server multiplayer spine.

**Built but the player can't see it (👻 — cheapest wins):** morale, the leadership aura, the AI commander's decisions, the influence map. Add readouts and these *feel* built.

**Half-built (🟡 — finish these):** car-class racing (one-line bug), the Track Builder bridge, the arcade Deck (needs a real game + a morale store), street VO (needs a foot-pedestrian entity), terrain on generated maps, the two-ladder rank system, SPORTS seasons.

**Named but empty (⬜ — decide before building):** the command seat & doctrine package, weapon certifications, cargo capacity, master-stat decay, the EXTINCTION god tier, nation combat doctrine, forensics/decay-to-bones, the multiplayer service layer.

**The three you asked about, in one line each:**
- **Dogs** — *fully real and one of the best systems; the only animal in the game; needs player agency to field it, symmetric scent, and richer orders.*
- **Officers** — *the rank ladder and a passive morale aura are real; the entire "command" the fiction promises (a seat, orders bots obey, doctrine) is unbuilt — define the command seat first.*
- **Certifications** — *12 vehicle certs, earned by a real driven exam, gate the driver's seat and nothing else; there is no weapon certification, the exam has no wash-out, and two rank ladders disagree on what a cert-fed rank unlocks.*

*Every claim in this document carries a `file:line` and was read out of the source on `main`, 2026-07-23. The `.notes/audit-*.md` files hold the full per-system tables behind each section.*



