# CERTIFICATIONS & SCHOOLS — the paper that opens a seat
### Status: **BUILT** for vehicles (register, schools, a driven exam, a real gate). **UNBUILT** for everything else the design promises. Verified against code 2026-07-23.

## 0 · FOR THE NEXT AI

A certification is a **paper you earn by driving a course**, and holding it does exactly one thing in the simulation: **it lets you take the driver's seat.** You do not buy it, you are not granted it at a level, and it is owned by the **account**, not the print — so it survives your death.

This is meant to be the spine of progression. The design says it plainly:

> *"You don't fly the bomber because you're level 20 — you passed flight school."*
> *"Knowledge, certifications, rank, relationships and reputation ARE the progression. Stats help — but the most powerful feeling is earned responsibility."*

**The files that ARE the feature:**
| File | What it owns |
|---|---|
| `src/sim/licenses.ts` | The register: 12 licences, tiers, schools, prereq chains, which hull needs which paper. |
| `src/sim/courses.ts` | The 12 course programs — drills, lessons, deterministic gate layout. |
| `src/sim/modes.ts` `stepSchool` (~820) | The examiner: drive the gates in order, sign the licence. |
| `src/sim/world.ts` `mayDrive` / `tryEnterVehicle` (~5451) | **The one gate that matters.** |
| `src/client/licences.ts` | The account-level store (`ww_licences`), award + prereq enrolment rules. |
| `src/client/range.ts` | A *different* thing also called a qualification — see §1.5. |

**The one thing to know before touching it:** the gate is on the **wheel, not the ride**. An uncertified soldier is pushed to a passenger bench, not refused the vehicle. And **bots are never gated** — a body with no `papers` array is treated as ISSUED, so only the human, whose file the client hands in at spawn, can ever be told no.

---

## 1 · WHAT THE CODE DOES

### 1.1 The register — 12 licences, 5 schools, chains not levels
`licenses.ts:42`. Awarding the top of a chain awards the whole chain (`client/licences.ts:41`).

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
| 11 | Drone Pilot | 2 | Signals School | Remote hulls, FPV drones — **gates ZERO hulls today** ⚠ | — |
| 12 | Dropship | 5 | Flight School | Combat insertion craft | Transport |

Which hull needs which paper: the `OVERRIDES` table (`licenses.ts:59`) plus a derived fallback `licenceFor()` (`:78`) — flies+minAirspeed → fixed_wing, flies → helicopter, boat → boat, hover → hovercraft, immobile → none, else basic_driver. **Boards, bikes and scooters need no paperwork on purpose.** `hullsUnder(id)` (`:113`) inverts it into a per-school syllabus.

### 1.2 The one gameplay effect — ✅ WIRED (singleplayer only)
`world.mayDrive(s, kind)` → `licenceHeld(s.papers, kind)`, enforced in `tryEnterVehicle` (`world.ts:5505-5520`, reached from the `use` verb at `world.ts:3850`). **This is the ONLY consumer of the licence system in the entire sim.**

- The check runs **on seat 0 only** — `if (seat === 0 && !this.mayDrive(s, v.kind))`.
- **Bench, not refusal:** it looks for a free non-driver seat (`findIndex((x,i) => i > 0 && x < 0)`). Found → you ride, with the announce *"NOT CERTIFIED TO DRIVE — RIDING · &lt;licence&gt; at &lt;school&gt;"*. No bench → hard refusal.
- **Bots are never gated:** `papers === undefined` is treated as ISSUED (`world.ts:5458`).
- The human's papers reach the sim as `WorldOptions.papers = loadLicences().held` (`main.ts:920` → `world.ts:1078`).

> ⚠ **`mayDrive` is a NO-OP IN MULTIPLAYER.** The server builds its world as `new World({ seed, mode, theme })` — **no `papers` key** (`server.ts:106`, `:224`). Every online body therefore has `papers === undefined` and `mayDrive` returns `true`. **The licence system is singleplayer-only today.** (This is the same class of hole as the LSW commission gate — see `COMMAND-AUDIT.md §6`.)

### 1.3 How a cert is EARNED — a real, driven exam
**You drive a course.** `courses.ts:50` has a program for **all twelve** licences — no orphan certs. Each is a chain of drills (`straight | slalom | brakebox | handbrake | parking | circuit`), each carrying a one-line teaching lesson, laid out deterministically by `layCourse` (`:226`) with a serpentine fold so it fits a 300u ground.

The examiner is `stepSchool` (`modes.ts:820`): you are seated in the course hull, you drive the gates **in order**, the drill's lesson shows on the HUD, and clearing the last gate sets `coursePassed` → `awardLicence` persists the whole chain plus your best time to `localStorage['ww_licences']`.

**Enrolment is gated by the chain:** `canEnrol` (`client/licences.ts:59`) refuses until every prerequisite is signed; the board renders OPEN / CERTIFIED / "NEEDS &lt;prereq&gt;".

**What the exam does NOT do — be honest about this:** the drill *kinds* are gate-position layouts only. Nothing checks that you braked in the box, held the slalom, or respected min-airspeed — **touching the gate radius is the whole test** (`modes.ts:832`). It does not check **which hull you are in**, or your altitude, or that you stopped. **Walking the gates on foot passes** (`:828`), and `stepSchool` advances on **any living human *or bot*** (`modes.ts:837`) — a passing bot can drive your gates for you. There is **no failure state**; par is recorded but gates nothing beyond a "QUALIFIED, INSIDE PAR" line.

### 1.4 The second-order effect — certs are the best rank currency
Holding a cert feeds the **service score**: `SERVICE_POINTS.certification = 30` (`ranks.ts:56`) — the highest per-unit value in the game. **A certification is worth 30 kills.** That is deliberate: knowledge is the progression. Rank then gates the LSW stable and the leadership morale aura.

### 1.5 THREE unrelated things are called "certification" — do not confuse them
| Name | Where | Does it gate anything? |
|---|---|---|
| **Vehicle LICENCES** | `sim/licenses.ts` (this document) | ✅ Yes — the driver's seat. |
| **Infantry QUAL** | `client/range.ts` — Qualified / Marksman / Sharpshooter / Expert from a 6-target timed run | ❌ No. Display-only on a barracks card, and it feeds the *dossier* rankPoints ladder, not the service ladder. **Only the infantry class has one.** |
| **Command certification** | `client/record.ts:119` — Provisional → Field Certified → Combined-Arms → Operation Officer, from operation points | ❌ No. Display-only (`main.ts:1911`). |

### 1.6 What is NOT built
- ⬜ **Weapon / combat certifications.** There is no "cleared for the railgun", no marksmanship cert that unlocks anything. Weapon competence is entirely the ungated secondary-skill system.
- ⬜ **Per-class quals** beyond infantry.
- ⬜ **Any exam that can be failed.**

---

## 2 · WHAT WE ARE AIMING AT

From `THREE-GAMES-ONE-WAR.md` (the canon laws):

> - *"Classes become **licenses**: Medic CERTIFIED · Pilot NOT CERTIFIED · **Explosives Level II** · **Nuclear DENIED**."*
> - *"Earned at **schools** (flight school, tank school, medical school) at training bases — **training bases stay valuable forever. Tutorials are academies; you graduate.**"*
> - *"Vehicle licenses gate hulls… **You don't fly the bomber because you're level 20 — you passed flight school.**"*
> - *"**Account owns:** identity, certifications, reputation, friends, research, war history."*
> - *"Don't make the RPG stats the main progression. **Knowledge, certifications, rank, relationships and reputation ARE the progression.**"*

Two things in that list are much bigger than what shipped:
1. **Certification is meant to cover CLASSES and CAPABILITIES, not just vehicles** — Medic, Explosives *with levels*, Nuclear *denied*. The code only knows hulls.
2. **Tutorials are academies; you graduate.** Schools are meant to be how the game teaches itself — the on-ramp, not a side activity.

*(Note: `THREE-GAMES-ONE-WAR.md:73` says what remained was "the schools themselves as playable qualification courses… and the entry gate that refuses an unlicensed driver." **Both of those are now built** — that line is stale in the good direction.)*

---

## 3 · THE GAP, RANKED

1. **Certification stops at vehicles.** The design's headline examples — Medic CERTIFIED, Explosives Level II, Nuclear DENIED — have no representation. This is the difference between "a driving licence system" and "certification as the progression".
2. **The exam cannot be failed and does not test the drill.** Touch the gates, on foot if you like. A qualification you cannot fail does not confer the "earned responsibility" the design is built on.
3. **Two rival rank ladders** both gate the god-call with different currencies (dossier `rankPoints` @8000 + OCS in `stable.ts:18` vs service score Lieutenant@520 in `world.ts:1207`). Certs feed one of them. They can contradict.
4. **The infantry qual is a stub on the wrong ladder** — display-only, infantry-only, feeding `rankPoints` rather than service.
5. **Schools are not the tutorial.** The Proving Grounds is "the door" per the design, but nothing routes a new player through the academies.
6. **The word "certification" means three unrelated things** in the UI.

---

## 4 · OPEN QUESTIONS

1. **Which commission ladder is canonical** — dossier `rankPoints` (8000/OCS) or service score (Lieutenant@520)? One should gate the stable; the other should be retired or mapped onto it. *This blocks tidy progression work and it is a one-line decision.*
2. **Do we want CLASS/capability certifications** (Medic, Explosives Level II, Nuclear DENIED) as the design states? If yes: do they gate the class picker, the equipment, or both?
3. **Should the exam be failable** — brake inside the box, hold the slalom, respect min-airspeed? Should par gate a distinction tier, or stay cosmetic? (A forgiving exam is a legitimate choice; it just needs to be a choice.)
4. **Do we want weapon certifications at all**, or does weapon competence stay the ungated skill system?
5. **Should a licence do more than open a seat** — e.g. a handling bonus for the certified — or does that stay the job of the separate `tank_driver`/`jet`/`boat` skills? *Today cert = seat, skill = feel, and they never interact.*
6. **Should schools be the tutorial?** ("Tutorials are academies; you graduate.")

---

## 5 · MY RECOMMENDATION

**This is the healthiest system in the progression slice, and the cheapest place to make progression *mean* something. Two moves.**

**1. Extend certification past the motor pool — it is the design's own headline and it is mostly data.** The register, the chain logic, the school board, the account store and the enrolment gate are all generic already; nothing about `licenses.ts` is vehicle-specific except the hull lookup. Adding **Medic**, **Explosives (levelled)** and a denied-by-default **Nuclear** would cost a data table and one gate each, and it would convert "a driving licence system" into the progression spine the design keeps promising. Start with Medic, because the medic already has a distinct capability (the revive beam) worth gating.

**2. Reconcile the two rank ladders before anything else touches rank.** I would keep `sim/ranks.ts` (service-based, authority-shaped, already gates the sim) and retire the dossier `rankPoints` ladder to a *display* stat. Right now a player can be a Lieutenant on one and not the other, and the god-call is gated by both — that is a contradiction that gets more expensive with every system that reads rank.

**On the exam:** I would make it failable but forgiving — keep "no wash-out" for the basic papers, and make the **tier-5 papers (Bomber, Dropship) actually test something**. The feeling the design wants is *earned responsibility*; the bomber seat is exactly where earning it should bite. That is a small change to `stepSchool` (a per-drill check) and it makes the top of the ladder mean what the fiction says it means.

**What I would not do:** build weapon certifications. Weapon competence already has a system (the 22 skills), and adding a second gate over the same ground would fight it. If we want weapons to feel earned, wire the *skills* that already exist rather than inventing paper for them.

---

## 6 · TRAPS

- **Bots have no papers and that is deliberate** (`world.ts:5452`). Any test asserting "an uncertified body cannot drive" must use a **human** with a `papers` array, or it will pass for the wrong reason.
- **The gate is on the WHEEL only.** A refused soldier still rides in the back. Do not "fix" this into a full refusal without a decision — riding along is the intended fallback.
- **Certs are ACCOUNT-level** (`localStorage['ww_licences']`), not per-print. They survive death by design; do not move them onto the dossier/print.
- **Awarding a licence awards its whole chain.** Grant `dropship` and the holder also gets `heavy_truck` and `transport`. Tests that count held licences must expect the chain.
- **`mayDrive` does nothing in multiplayer** (`server.ts:106`, `:224` never pass `papers`). Do not assume a licence gate you tested offline holds online.
- **`schoolAwarded` is a module-global that is never reset** (`main.ts:164`, set true at `:1582`, cleared nowhere). It survives today only because `endGame()` does a full `window.location.reload()`. Remove or bypass that reload — an SPA menu return, a "run it again" button, a test harness — and **the second course of a session silently never signs papers.**
- **`stepSchool` advances on any living human OR bot** (`modes.ts:837`). A bot wandering your course can clear your gates.
- **`drone_pilot` gates zero hulls.** It is a licence you can earn that opens nothing — decide whether to point it at the FPV drone or retire it.
- **A cert is worth 30 service points** — the largest single source. Change that number and you re-balance the entire rank ladder.
- **`fileService` omits medals** (`main.ts:1484`), so `SERVICE_POINTS.medal = 25` is unreachable today. If you are auditing why rank feels slow, that is why — and it is next to the cert points.

---

*Verified against `main`, 2026-07-23. Code evidence from `.notes/audit-progression.md`; intent from `THREE-GAMES-ONE-WAR.md`.*
