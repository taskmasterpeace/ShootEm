# PROGRESSION, ECONOMY & CERTIFICATIONS — Systems Audit

Scope: licences/certs, the schools/courses, the 8 master stats + secondary skills, the rank ladder(s), service record, treasury/economy, enlistment/hometown/culture, and how each is (or isn't) consumed by the sim. Read from code on branch `main`, 2026-07-23.

**Legend:** ✅ WIRED (read by the sim, changes play) · 🟡 PARTIAL (half-wired / one path only) · 👻 INVISIBLE (data/logic exists, nothing reads it) · ⬜ UNBUILT.

**Headline finding:** progression is split across **two parallel, independently-stored career systems that both call themselves "rank"** and that both claim to gate the LSW stable with *different* thresholds and *different* point currencies. See §7. This is the single biggest thing the owner must resolve.

---

## 1. THE LICENCES / CERTIFICATIONS — deep dive

### 1.1 The register (what exists)

`src/sim/licenses.ts:42` — `LICENCES: Record<LicenceId, LicenceDef>`. **Thirteen** ids (twelve real + `none`). Every def has `{ id, name, school, covers, requires?, tier }`. This is the whole certification catalog — **all certs are VEHICLE certs; there is no weapon/combat cert here** (see §1.6).

| id | name | tier | school | covers | requires (prereq) |
|---|---|---|---|---|---|
| `none` | No licence required | 1 | — | Anything push/pedal/ride, no paperwork | — |
| `basic_driver` | Basic Driver | 1 | Motor Pool | Cars, runabouts, bikes, light utility | — |
| `heavy_truck` | Heavy Truck | 2 | Motor Pool | Trucks, buses, plant, air brakes | `basic_driver` |
| `apc` | APC | 3 | Armour School | Armoured personnel carriers | `heavy_truck` |
| `tank` | Tank | 4 | Armour School | MBTs, assault walkers, breachers | `apc` |
| `hovercraft` | Hovercraft | 2 | Motor Pool | Hover decks, skirted hulls, raceboards | `basic_driver` |
| `boat` | Boat | 2 | Naval Yard | Surface craft, gunboats | — |
| `helicopter` | Helicopter | 3 | Flight School | Rotary wing | — |
| `fixed_wing` | Fixed Wing | 3 | Flight School | Non-hovering aircraft | — |
| `bomber` | Bomber | 5 | Flight School | Heavy payload airframes | `fixed_wing` |
| `transport` | Transport | 3 | Flight School | Crewed lifters, large passenger hulls | `heavy_truck` |
| `drone_pilot` | Drone Pilot | 2 | Signals School | Remote hulls, FPV drones | — |
| `dropship` | Dropship | 5 | Flight School | Combat insertion craft | `transport` |

Prereq chains resolve via `licenceChain()` (`licenses.ts:95`): e.g. Dropship → `heavy_truck → transport → dropship`; Tank → `basic_driver → heavy_truck → apc → tank`; Bomber → `fixed_wing → bomber`. Awarding the top of a chain awards the whole chain (`client/licences.ts:41 awardLicence`).

**Schools (5):** Motor Pool, Armour School, Naval Yard, Flight School, Signals School. Every school stays "valuable forever" is the design intent (file header) — realized, because certs are the only way to unlock driver seats.

**Which hull needs which licence** — `OVERRIDES` table (`licenses.ts:59`) plus a derived fallback `licenceFor()` (`licenses.ts:78`): flies+minAirspeed→fixed_wing, flies→helicopter, boat→boat, hover→hovercraft, immobile→none, else basic_driver. Personal decks (hoverboard/bicycle/scooter/paraglider/hangglider/balloon) = `none` on purpose. `hullsUnder(id)` (`licenses.ts:113`) inverts it into a per-school syllabus.

### 1.2 Do certs actually change gameplay? — YES, exactly one effect

**✅ WIRED — the driver's-seat gate, and only that.** The single place holding a licence matters in the sim:

- `world.mayDrive(s, kind)` — `src/sim/world.ts:5451` → `licenceHeld(s.papers, kind)` (`licenses.ts:106`).
- Enforced at `world.tryEnterVehicle` — `world.ts:5499`. If the soldier lacks the paper for the *wheel*, they are pushed to a passenger **bench** with an announce ("NOT CERTIFIED TO DRIVE — RIDING · <licence> at <school>", `world.ts:5512`); if no bench exists they are refused entirely (`world.ts:5505`).
- **Bots are never gated:** a soldier with no `papers` array is treated as ISSUED (`world.ts:5452 "if (!s.papers) return true"`). Only the human, whose `papers` the client hands over at spawn, can be told no.
- The human's papers reach the sim via `WorldOptions.papers = loadLicences().held` (`main.ts:920`) → applied to the soldier at `world.ts:1078`.

**Everything else that touches licences is read-only surfacing (👻 for gameplay):**
- Codex column — `client/codex.ts:149-150,264` (a "Licence"/"Earned at" column per hull).
- GONET desk status — `gonet/index.ts:205-206` ("Certifications X/Y held", "Training: <next> is open").
- GONET mail — `gonet/mail.ts:102-125` (a "you are not certified for X" nudge + a "register closed" mail).
- GONET broadcast "TRAINING FILMS" reel — `gonet/broadcast.ts:226-239` — surfaces each school + its licences' lesson lines. **Named "and they actually teach" but they do not grant or gate anything — they display the drill lessons.** Purely a video reel.
- GONET briefings room — `gonet/briefings.ts` — checks your papers against a mission's *issued hulls* and prints a readiness line ("N of M issued need paper you do not hold… you may ride; somebody else drives", `briefings.ts:131`). Informational; it does not block the deploy (the gate is still only on the wheel, in-sim).
- Service file page — `client/service-file.ts:27 papersHtml()` renders held/needed per licence with best time.

**Second-order effect (✅ WIRED, indirect):** holding a cert feeds the **service score** → rank. `service.ts:69` counts `certifications = COURSES-keys held`, worth `SERVICE_POINTS.certification = 30` each (`ranks.ts:56`) — the highest per-unit service value in the game (a cert = 30 kills). So certs raise your rank, which gates the LSW stable and morale reach (§7). This is the one place a cert does more than open a driver seat.

### 1.3 How is a cert EARNED? — a real, driven exam (no wash-out)

**✅ WIRED — this is a genuine testing mechanic, not a purchase.** You do not buy or get granted a licence; you **drive a course**.

- Courses: `src/sim/courses.ts:50 COURSES` — a `Partial<Record<LicenceId, Course>>` with a program for **all twelve** real licences (every earnable licence is teachable — no orphan cert). Each `Course = { licence, hull, name, brief, drills[], par }`. A `Drill` carries a one-line teaching `lesson`; drills are `straight | slalom | brakebox | handbrake | parking | circuit`.
- Layout is pure/deterministic: `layDrill` + `layCourse` (`courses.ts:181,226`) turn drills into a serpentine gate chain that folds to fit a 300u ground (the FOLD_X/LANE logic). No map dependency.
- The examiner runs in the sim: `stepSchool()` — `src/sim/modes.ts:820`. The candidate is seated in the course hull (`main.ts:1088 spawnVehicle` + `forceBoard`), drives gates **in order**, each gate's drill lesson shown on the HUD (`hud.ts:564-568`, renderer draws gates `renderer.ts:2164`). Clearing the last gate sets `m.coursePassed = true; m.over = true` (`modes.ts:836`). **No failure state** by design — par only decides "QUALIFIED" vs "QUALIFIED, INSIDE PAR" (`modes.ts:840`).
- Enrolment gating: `canEnrol(id)` (`client/licences.ts:59`) — the school won't enrol you until every prerequisite step is already signed. Board renders OPEN / CERTIFIED / "NEEDS <prereq>" (`main.ts:475-477`, school board `paintSchoolBoard`).
- Signing: on `coursePassed`, `main.ts:1522-1525` calls `awardLicence(enrolledCourse, secs)` → persists the whole chain + best time to `localStorage['ww_licences']` (`client/licences.ts:41`). **Account-level, survives every print** (canon: the account owns certs).

**Gaps in the exam layer:** the drill *kinds* are gate-position layouts only — nothing checks you actually braked in the box, held the slalom, or stayed under min-airspeed; touching the gate radius is the whole test (`modes.ts:832 "if (d > gate.radius) continue"`). On-foot walking the gates also passes (`modes.ts:828-830`). So it's a "drive-through", not a skills assessment. Par time is recorded but never gates anything.

### 1.4 Cert → skills relationship

Certs (vehicle papers) and secondary skills (§4) are **different systems**: a licence unlocks the *seat*; the matching skill (e.g. `tank_driver`, `helicopter`, `jet`, `boat`, `drone_pilot`) is leveled separately through use and buys a small feel bonus. A cert grants no skill and a skill grants no cert. Hometown archetype can hand a starting *skill* (e.g. `tank_driver`) but never a *licence*.

### 1.5 Naming collision — THREE different "certification" concepts

The word "certification" is overloaded across the codebase; the owner should be aware these are unrelated:
1. **Vehicle LICENCES** (this section) — `sim/licenses.ts`, earned in the schools.
2. **Infantry QUAL** — `client/range.ts` (Qualified/Marksman/Sharpshooter/Expert), a weapons test (see §1.6).
3. **Command certification** — `client/record.ts:119 commandCertification` (Provisional Command → Field Certified → Combined-Arms → Operation Officer), driven by `operations.certificationPoints` earned completing military operations. **Display-only** — used solely at `main.ts:1911` (barracks card); gates nothing.

### 1.6 The "weapons-testing / training certs" Robert mentioned

**Verdict: PARTIALLY exists as a separate system, and it is NOT a cert that gates anything.**

- There **is** a weapons/infantry test: the Proving Grounds range — `client/range.ts`. Six timed dummy targets, `scoreRun()` → `gradeFor()` = **Qualified / Marksman / Sharpshooter / Expert** (`range.ts:15-20`). An "OFFICIAL" run (one shot, `main.ts:1989` warning) writes `dossier.quals.infantry = { score, percentile, grade }` and adds the score to `rankPoints` (`range.ts:121-125`), and posts to a local "Wall" leaderboard (`range.ts:28`).
- **But:** (a) it feeds the *dossier* rankPoints ladder (System A, §7), **not** the `sim/ranks.ts` service ladder that actually gates the LSW stable; (b) the qual is **read only for a barracks display card** (`main.ts:1941`) — `dossier.quals` gates nothing in the sim; (c) **only the `infantry` class has a qual** — `quals: Partial<Record<ClassId, QualRecord>>` is defined for all classes but only infantry is ever written (`range.ts:123`). Heavy/engineer/medic/etc. qual courses = ⬜ UNBUILT.
- There is **no weapon-specific certification** at all (no "cleared for the railgun", no marksmanship cert that unlocks a weapon). Weapon competence is entirely the secondary-skill system (§4), leveled through use, ungated.

So: the vehicle-licence school system is fully built; the weapons/infantry qual exists but is a stub (infantry-only, display-only, wrong ladder); per-class weapon certs are a gap.

---

## 2. THE SCHOOLS / COURSES

**✅ WIRED.** `src/sim/courses.ts`. Covered in §1.3. Twelve programs, deterministic gate layout, real in-sim examiner (`modes.ts stepSchool`), school board UI (`main.ts:467 paintSchoolBoard`), enrol flow (`main.ts:506-513` sets `enrolledCourse` + `selectedMode='school'`). Best times persisted per licence (`ww_licences.best`). **Remaining:** the drill *kind* is cosmetic (no per-drill skill check); par is recorded but inert; no other-vehicle-class breadth beyond the 12 licences (fine).

---

## 3. THE 8 MASTER STATS

`src/sim/types.ts:425 SoldierStats` = `power, agility, handling, piloting, engineering, leadership, science, charisma`. Absent = neutral. Applied at events (not per-tick) via `statMul` (bigger=better, ±2%/point around 5) and `statQuick` (bigger=quicker) — `world.ts:609-614`.

| Stat | Status | Wired effect (code) |
|---|---|---|
| **power** | ✅ WIRED | Spawn HP `hpMax = c.hp * statMul(power)` (`world.ts:1798`); melee damage `* statMul(power)` (`world.ts:4552`). |
| **handling** | ✅ WIRED | Reload duration `reloadTimeFor` = `def.reloadTime * statQuick(handling)` (`world.ts:617`). |
| **agility** | ✅ WIRED | Dash/roll recovery `nextDashAt += DASH_CD * statQuick(agility)` (`world.ts:3319,3357`). |
| **piloting** | 👻 INVISIBLE | Declared only. No reader in sim (types comment `world.ts`/`types.ts:429` calls it "the touch" but nothing consumes it; certs gate the seat, not this). |
| **engineering** | 👻 INVISIBLE | Declared only. Repairs/turrets/construction do not read it. |
| **leadership** | 👻 INVISIBLE | Declared only. **Command radius uses `rankId`, not this stat** (`world.ts:2438 leadershipRadius(rankId)`). |
| **science** | 👻 INVISIBLE | Declared only. Hacking/artifacts/lab do not read it. |
| **charisma** | 👻 INVISIBLE | Declared only. Negotiation/recruitment/black-market unbuilt. |

**Critical caveat — for the human player, ALL 8 stats are effectively inert.** Humans spawn with hardcoded neutral `5`s (`world.ts:1035`), and nothing in progression ever raises them ("Humans start neutral 5s **until the meta-layer assigns real people**" — comment `world.ts:1024`). `statMul(5)=1`, `statQuick(5)=1`, so even the 3 wired stats produce a ×1 no-op for the player. Only **bots** get differentiated stats (hash-rolled, `world.ts:1027-1033`), so power/handling/agility only actually vary combat for AI bodies. **5 of 8 stats are dead everywhere; the other 3 are alive for bots only.**

---

## 4. THE SECONDARY SKILLS (22)

`src/sim/skills.ts:33 SKILLS` — 22 skills, each `{ earnedBy, gives }`. Bands `[0,25,80,200,450,900]` → Untrained…Master (`skills.ts:67`). `skillLevel`, `bandProgress`, `bandName` pure.

- **✅ WIRED (weapon skills):** `practise()` on a landed hit (`world.ts:7655`, +0.5 per trainable hit) and `skillEdge()` tightens spread — `world.ts:135-137` divides accuracy cone by `skillEdge(practiceOf(s, skill), 1.4)` (Master ≈ +12% at strength 1, more at 1.4). `skillForWeapon` maps families→skill (`skills.ts:101`).
- **🟡 PARTIAL (non-weapon skills):** the 14 non-weapon skills (engineer, medic, dog_handler, drone_pilot, radio_operator, commander, navigator, mechanic, explosives, scout, tank_driver, tank_gunner, helicopter, jet, boat, lmg-etc.) have `gives` copy but **only the weapon-family skills feed `skillEdge` in combat.** Grep shows no reader for medic/engineer/etc. skill edges → those bonus lines are 👻 for now.
- **🟡 PARTIAL persistence — skills do NOT grow across matches for the account.** The human's `s.skill` is seeded each spawn from `hometownSkills()` (`main.ts:923` → `world.ts:1081`), practised **in-match**, then discarded — there is **no per-account skill store** (grep: no `ww_skill`/saveSkills anywhere). At match end only a *count* of bands is filed into service (`main.ts:1483` sums `skillLevel` across skills → `fileService(skillBands)`), worth `SERVICE_POINTS.skillBand = 8`. So skill practice is ephemeral theatre except as a one-shot service contribution; you start every match back at the hometown head-start.
- **Hometown head start (✅ WIRED as seed):** `client/hometown.ts` archetype → `startingSkills()` = two skills at `HEAD_START = 30` raw practice (just into band 1). Reaches the sim via `hometownSkills()` (`hometown-bridge.ts:14`) → `WorldOptions.startingSkills` (`main.ts:923`).

---

## 5. THE RANK LADDER(S) & SERVICE

### System B — `sim/ranks.ts` + `client/service.ts` (the "service" ladder)
**✅ WIRED (gates real authority).** `ranks.ts:34 RANKS` — 10 rungs Recruit(0)→General(2500), each with a `grants` line and `at` service threshold. `serviceScore()` sums a `ServiceRecord` using `SERVICE_POINTS` (`ranks.ts:49`: matchFought 5, matchWon 15, kill 1, medal 25, certification 30, trackRecord 10, skillBand 8). `service.ts:57 serviceRecord()` assembles the record live from every owning store (tally + licences + records + treasury wins). Rank is **read, never stored** (`service.ts:78 currentRank`).

Authorities actually wired:
- **✅ LSW stable commission** — `mayCallStable(rankId>=5 Lieutenant)`. `world.requestLsw` refuses a human caller below Lieutenant (`world.ts:1207-1209`). `opts.rank = currentRank().id` (`main.ts:927`).
- **✅ Leadership/morale reach** — `leadershipRadius(rankId)` (`ranks.ts:115`) steadies nearby men's morale (`world.ts:2438`). Corporal 10u → General 38u. (Uses rankId, **not** the leadership stat.)
- **👻 materielBonus** — `ranks.ts:121 materielBonus(rankId)` (Major=+2, StaffSgt=+1) is **defined and never called** (grep: only the definition). So the rank grants "a heavier opening manifest" / "a full manifest" (StaffSgt/Major cards) are **text with nothing behind them.**
- `mayCommand(rankId>=6 Captain)` (`ranks.ts:108`) — read by the service-file board display (`service-file.ts:115`); the actual command-seat/doctrine feature it names is UNBUILT.

**Filing gap:** `fileService` (`main.ts:1484`) passes `{won, kills, skillBands}` but **omits medals** — so `SERVICE_POINTS.medal (25)` never contributes to service rank; the service record's `medals` is always 0 even though the dossier (System A) mints medals.

### System A — `client/record.ts` dossier `rankPoints` (the older ladder)
**🟡 PARTIAL / competing.** A **different** 14-rung ladder (`record.ts:177 RANKS`, Private(0)→Colonel(21000)) driven by `dossier.soldier.rankPoints`. Points come from match score + `medals×25` (`record.ts:475,505`) and infantry qual score (`range.ts:124`). Rendered in the barracks (`main.ts:1895,1635`) with insignia (`record.ts:204`). Persisted in IndexedDB. **This ladder gates the LSW stable UI** via `isCommissioned` (§7) — a different gate than System B's `mayCallStable`.

---

## 6. THE ECONOMY / TREASURY

**✅ WIRED (earns and spends, and the spend changes the next match).** `client/treasury.ts`. Per-faction war chest in `localStorage['ww_treasury']`, `OPENING_BALANCE = 12,000`.
- **Earns/loses:** `settleMatch()` (`treasury.ts:71`) on every non-race match end (`main.ts:1471-1477`): win +3,000, loss −1,500, draw +250, minus `hullsLost × 25` billed from the sim's own war ledger (`world.warLedger[playerTeam].hulls`). Balance floored at 0. Lifetime earned/spent/wins/losses tracked.
- **Spends into gameplay:** `budgetMultiplier()` (`treasury.ts:99`) → `WorldOptions.budget` (`main.ts:928` `[budgetMultiplier(faction), 1]`) → scales the **opening materiel** each side fields (`world.ts:730-734`, clamped 4–14). A broke army genuinely fields fewer requisitions/god-calls; a rich one opens the stable. This is a real, closed win-or-lose loop.
- **Surfaced:** `treasuryLine()` on the after-action screen (`main.ts:1478`) and service file (`service-file.ts:56 chestHtml`).
- **Note (asymmetry):** only the player's faction is settled and only the player's side gets a real budget multiplier (`main.ts:928` hardcodes the enemy side to `1`). The AI faction's treasury never moves.

---

## 7. THE FORK — two commission systems disagree (OPEN QUESTION)

Calling the LSW stable is gated by **two independent systems with different currencies and thresholds:**

| | System A (dossier) | System B (service) |
|---|---|---|
| Store | `record.ts` `dossier.soldier.rankPoints` (IndexedDB) | `service.ts serviceRecord()` (localStorage tally + derived) |
| "Lieutenant" at | **8,000 rankPoints** (`stable.ts:18`) | **520 service** (`ranks.ts:40`, rank id 5) |
| Gates | **StableConsole UI opens** — `isCommissioned(dossier)` = rankPoints≥8000 **OR** OCS onboarding path (`stable.ts:16`) | **`world.requestLsw` accepts the call** — `mayCallStable(opts.rank)` (`world.ts:1207`) |
| Fed by | match score, medals×25, infantry qual | matches, wins, kills, certs×30, trackRecords, skillBands |

Both are wired at once: `main.ts:1000 new StableConsole({ commissioned: isCommissioned(dossier) })` **and** `main.ts:927 rank: currentRank().id`. A player can satisfy one and not the other (e.g. OCS-path player with 0 service passes the UI gate but `requestLsw` still refuses below Lieutenant; or a highly-certified service-Lieutenant with <8000 rankPoints can't open the console). They will contradict each other. **The owner must decide which ladder is canonical and retire or bridge the other.**

---

## 8. ENLISTMENT / IDENTITY / HOMETOWN / CULTURE

- **Identity ✅ WIRED (as biography + real seeds):** `client/identity.ts`. Country→faction (derived, frozen at enlistment), callsign, hometown, psych intake (3 answers → `recommendClass` → `temperamentFor`), `cityIndex`, `print`. `factionTeam()` picks the sim team (`main.ts` uses it), `faction` keys the treasury. Persisted `localStorage['ww_identity']`.
- **Hometown archetype ✅ WIRED (as skill seed):** `client/hometown.ts`. 9 archetypes (port/industrial/capital/garrison/frontier/university/mining/farm/transport), each grants two starting skills at 30 practice. `archetypeFor()` derives deterministically from the nation's doctrine stats + city index + name hash (no hand-authoring for ~800 cities). Reaches sim via `hometown-bridge.ts` → `startingSkills`. The country→faction→doctrine lines (`doctrineLine`, `lswLine`, `cloningLine`, `band`) are enlistment-reveal copy (display).
- **Culture ✅ WIRED (as VO selector):** `sim/culture.ts`. 14 culture codes → region/tongues/demeanour, reverse-engineered from `map-cities.json`. `playerCultureCode()` (`hometown-bridge.ts:27`) maps enlisted nation→culture for street/pedestrian VO persona selection. Pure data; drives `streetvo.ts`/TTS (out of this slice). Does not touch combat.

---

## 9. SERVICE FILE / GONET SURFACES (read-only aggregators)

`client/service-file.ts renderServiceFile` — one dossier page pulling from every store: PAPERS (licences), THE BOARD (track records), THE WAR CHEST (treasury + budget band), THE GARAGE (fits), THE PROMOTION BOARD (service rank + authorities + point breakdown). All read-only/derived. GONET desk (`gonet/index.ts`), mail, broadcast reels, briefings all read these stores for display (see §1.2). None introduce new truth.

---

## TOP 5 GAPS in progression/certs

1. **Two rival "rank" ladders both gate the LSW stable with different currencies (System A dossier rankPoints@8000 vs System B service@520).** They can contradict. Highest-priority reconciliation. (`stable.ts:18` vs `world.ts:1207`/`ranks.ts:40`.)
2. **The 8 master stats are dead for the human** (hardcoded neutral 5s, never raised — `world.ts:1035`), and **5 of 8 are dead for everyone** (piloting/engineering/leadership/science/charisma have no sim reader). The whole stat layer is theatre for the player. Plus `materielBonus` (rank's "heavier manifest" grant) is defined-but-never-called (`ranks.ts:121`).
3. **Secondary-skill growth doesn't persist across matches** — no per-account skill store; `s.skill` resets to the hometown head-start every spawn, and 14 of 22 skills' `gives` bonuses are never read (only weapon families feed `skillEdge`). "Levels through use" is only true within a single match.
4. **Weapons/combat certification is a stub.** The infantry qual (`range.ts`, Qualified→Expert) is the only "weapons test", it feeds the *wrong* ladder (dossier, not service), it gates nothing, and only the infantry class has one — the other classes' quals and any weapon-unlock cert are unbuilt.
5. **The cert "exam" is a drive-through, and medals never reach the service score.** `stepSchool` only checks gate-radius touch (on foot passes too; par is inert) — no real per-drill assessment. And `fileService` omits medals (`main.ts:1484`), so `SERVICE_POINTS.medal=25` is unreachable in System B.

---

## OPEN QUESTIONS the owner must answer (certifications specifically)

1. **Which commission ladder is canonical** for opening the stable — the dossier `rankPoints` (8000/OCS) or the service `serviceScore` (Lieutenant@520)? One should gate; the other retire or map onto it.
2. **Should the drive-through exam actually test the drill** (brake inside the box, hold the slalom, respect min-airspeed), or is "touch every gate, no wash-out" the intended forgiving design? Should par ever gate (e.g. a distinction tier), or stay cosmetic?
3. **Do you want weapon/combat certifications at all** (a per-class or per-weapon-family qual that *unlocks* or *gates* something), or is weapon competence meant to stay purely the ungated skill system? If quals stay, should they extend past infantry to every class, and should they feed the canonical rank ladder?
4. **Should holding a licence do more than open a driver seat** — e.g. a piloting/handling feel bonus for certified drivers, or should that remain the job of the separate secondary skill (`tank_driver`, `jet`, …)? Right now cert = seat, skill = feel, and they never interact.
5. **Naming:** three unrelated things are called "certification" (vehicle licences, infantry qual, command certification). Consolidate the vocabulary so the GONET/codex/mail don't blur them.
6. **Should the AI faction's economy and certs matter** (its treasury never moves; its bodies are auto-ISSUED all papers), or is the whole progression layer intentionally player-only?
