# WAR WORLD — THE FEATURE INDEX
### The first thing a new AI (or a new person) should read. Every major feature, what it actually does today, where its code lives, and which document to trust.

> **Why this file exists.** Robert: *"every major feature should have a document with feature status and plans… the purpose is so another AI has the details on each feature. The docs should be 100% based on code and conversations — code is what we have, conversation is what we are aiming toward."*
>
> There are ~70 documents in `docs/`. That is not a shortage of documentation, it is a **routing problem**: a doc written as a plan in June reads exactly like a doc written as a status report in July, and a fresh reader cannot tell which one describes the game that exists. This file is the router.

---

## 0 · THE TRUST RULE (read this before any other doc)

**THE CODE WINS. Always.** Where a document and the source disagree, the source is right and the document is stale.

Every doc in `docs/` is one of three kinds. Know which you are reading:

| Kind | What it is | How to treat it |
|---|---|---|
| **STATUS** | Written by walking the source; claims carry `file:line`; dated. | Trust it to the date on it. Re-verify anything load-bearing. |
| **INTENT** | Design, pitch, spec, lore, plan. Describes what we are AIMING at. | Trust it for *what we want*. **Never** for *what exists*. |
| **HISTORICAL** | Superseded — kept because it records a decision or a moment. | Read for the "why". Do not act on it. |

**This distinction is not academic — it has already bitten.** Two live examples, both true as of 2026-07-23:

- `RACING.md` lists **traction, shock, tires, engine and cargo** as "▶ build". All five shipped. An AI reading it would go and re-implement working systems.
- `MULTIPLAYER-PLAN.md` lays out stages M0–M2 as the road to net play. The authoritative 30 Hz server, per-client interest culling and the input queue **already exist and run** (`npm run server`).

If you take one thing from this file: **before you build anything, grep for it.** The thing you were told to build is often already there and merely unwired.

---

## 1 · THE STATUS BOARD

Status is code-verified against `main` on **2026-07-23**. Legend: **✅ BUILT** (works, a player meets it) · **🟡 PARTIAL** (runs, a named piece missing) · **👻 INVISIBLE** (runs, but the player sees no evidence — cheapest wins live here) · **⬜ UNBUILT** (named in docs, no working consumer).

### The fight
| Feature | Status | Code | Dossier |
|---|---|---|---|
| Combat model (damage, down/bleedout/revive, explosions, melee) | ✅ | `sim/world.ts` | `MASTER-SYSTEMS.md §2` |
| Bot AI (perception, A\*, doctrine, objectives) | ✅ | `sim/bots.ts`, `sim/ai/*` | `MASTER-SYSTEMS.md §2`, `.notes/audit-combat.md` |
| — tactical layer (flanking, fight-from-cover, squad coordination) | ⬜ | — | same |
| Weapons & arsenal (316 defs, families×brands×marks) | ✅ | `sim/arsenal.ts`, `sim/data.ts` | `ARSENAL.md`, `STATISTICS.md §4` |
| The Ascendants / LSW (40 gods, per-god brains) | ✅ | `sim/lsw.ts`, `sim/lsw/*` (42 files) | `ASCENDANTS.md`, `STATISTICS.md §5` |
| — EXTINCTION tier (T4, 5800 HP) | ⬜ | defined, **zero units use it** | `MASTER-SYSTEMS.md §6.3` |
| Materials, destruction, fire | ✅ | `sim/materials.ts`, `world.ts:897` | `STATISTICS.md §6.3` |
| Weather (7 skies) | ✅ | `sim/weather.ts` | `STATISTICS.md §6.4` |

### The world
| Feature | Status | Code | Dossier |
|---|---|---|---|
| Map generation (chunks, 10 authored fronts, size tiers) | ✅ | `sim/map.ts`, `sim/fronts.ts`, `sim/chunks.ts` | `MASTER-SYSTEMS.md §7` |
| Buildings + indoor CQB AI | ✅ | `sim/buildings.ts`, `sim/indoor-ai.ts` | `MASTER-SYSTEMS.md §7.2` |
| Terrain elevation | 🟡 | read path wired; **no generator writes `map.height`** except built tracks | `MASTER-SYSTEMS.md §7.4` |
| Game modes (17) | ✅ | `sim/modes.ts` | `MASTER-SYSTEMS.md §8` |
| Campaign / Operations (10 fronts, phases) | ✅ | `client/campaign.ts`, `sim/operation-runtime.ts` | `MASTER-SYSTEMS.md §8.2` |
| Scientist Hunt ("science") | ✅ | `sim/science*.ts` | `SCIENCE-MISSIONS.md` |
| Forensics / decay-to-bones | ⬜ | idea only | `MASTER-SYSTEMS.md §9.2` |
| Real-city geospatial import | 🟡 | `sim/geospatial/*` — **owned by a parallel worktree; do not edit** | `GEOSPATIAL-MAPS.md` |

### Racing & vehicles
| Feature | Status | Code | Dossier |
|---|---|---|---|
| Vehicle physics (80 hulls, mass/traction/shock/slip) | ✅ | `sim/data.ts`, `world.ts` drivetrain | **`RACING.md`** |
| The garage (tires/engine/chassis/cargo) | ✅ | `sim/garage.ts` | **`RACING.md`** |
| Racing — circuit, time trial | ✅ | `sim/modes.ts` | **`RACING.md`** |
| — **Demolition (derby)** | 🔴 **launch-broken** | no grid is carved for `derby` → zero hulls spawn, match ends ~4.6 s | **`RACING.md §1.3`** |
| — Gun Run, Freestyle | ⬜ | `live:false` shells | **`RACING.md`** |
| — Ghost lap | 🔴 | saved, but the key holds a per-deploy random seed → **never loaded back** | **`RACING.md §1.6`** |
| Track Builder → raceable circuit | ✅ | `sim/tracks.ts`, `map.ts buildTrackMap`, `client/admin.ts` | **`RACING.md`** |
| Hoverboard trick economy | ✅ | `sim/boardtricks.ts` | **`RACING.md`** |
| Sports league (standings, fixtures, news tie-in) | 🟡 | `client/gonet/sports.ts` — no season/points | **`RACING.md`** |
| Cargo CAPACITY (a truck hauls more) | ⬜ | no such field exists | `MASTER-SYSTEMS.md §3.4` |

### The soldier & the meta
| Feature | Status | Code | Dossier |
|---|---|---|---|
| The 8 master stats | 🟡 | 3 wired; **all 8 inert for the human (hardcoded 5s)** | `STATISTICS.md §2.1` |
| 22 secondary skills | 🟡 | 8 wired; **no cross-match persistence** | `STATISTICS.md §2.4` |
| Rank & service | 🟡 | real authorities, but **two rival ladders** | `STATISTICS.md §2.6`, `COMMAND-AUDIT.md` |
| **Certifications & schools** | ✅ | `sim/licenses.ts`, `sim/courses.ts` | **`CERTIFICATIONS.md`** |
| Morale | 👻 | real system, **no HUD readout at all** | `STATISTICS.md §2.5` |
| Economy / war chest | ✅ | `client/treasury.ts` → `opts.budget` | `MASTER-SYSTEMS.md §14` |
| Identity, hometown, 169 nations | ✅ (identity) / 🟡 (combat) | `client/identity.ts`, `data/nations.ts` | `STATISTICS.md §7` |
| **Officers & command** | 🟡 / ⬜ | aura + god-call real; **no command seat** | **`COMMAND-AUDIT.md`** |

### The living world
| Feature | Status | Code | Dossier |
|---|---|---|---|
| **Dogs / K9** | ✅ | `sim/k9-orders.ts`, `bots.ts stepDog`, `client/k9-controls.ts` | **`DOGS-AND-ANIMALS.md`** |
| Any other animal | ⬜ | **the K9 is the only animal in the game** | **`DOGS-AND-ANIMALS.md`** |
| Civilian traffic | ✅ | `sim/traffic.ts` | `MASTER-SYSTEMS.md §5` |
| Street VO (pedestrian + vigilante, 216 clips) | ✅ (voice) / ⬜ (body) | `client/streetvo.ts`, `streetheat.ts` | **`STREET-VO.md`** |
| Walking-pedestrian / vigilante entity | ⬜ | civilians are modelled as vehicles | `STREET-VO.md` |
| The one clock | ✅ | `client/worldclock.ts` | `THE-CLOCK.md` |
| The press / newspaper | ✅ | `client/newspaper.ts` | `THE-GONET.md` |

### The laptop, the yard, the shell
| Feature | Status | Code | Dossier |
|---|---|---|---|
| THE GONET (8 apps) | ✅ | `client/gonet/*` | `THE-GONET.md` |
| Music library → field headphones (H) | ✅ | `gonet/library.ts`, `player.ts`, `headphones.ts` | `THE-GONET.md` |
| **THE DECK (cartridges)** | 🟡 | ORBIT RUN plays; 4 of 5 have no runtime | **`THE-DECK.md`** |
| Walk-up ARCADE cabinets | ⬜ | none exist in the world | **`THE-DECK.md`** |
| Paintball, the Gauntlet, Vanessa's | ✅ | `sim/paintball.ts`, `client/vanessas*.ts` | `MASTER-SYSTEMS.md §24` |
| THE BOARD (telemetry desk) | ✅ | `client/board.ts`, `ledger.ts` | `THE-BOARD.md` |
| **Multiplayer** | 🟡 | real authoritative 30 Hz server — but **hidden behind a disabled "COMING SOON" tile**, and the rank + licence gates do not hold online | **`MULTIPLAYER.md`** |
| Replay / killcam | ✅ | `client/replay.ts`, `sim/snapshot.ts` | `MASTER-SYSTEMS.md §22` |
| Steam Deck / desktop build | 🟡 | Electron shell + pad nav; AppImage not built | `STEAM-DECK.md` |

---

## 2 · THE DOC MAP — what to trust for what

**STATUS docs (code-verified, cite `file:line`) — trust these for what exists:**
`MASTER-SYSTEMS.md` (the 100%-coverage audit — start here) · `STATISTICS.md` (every number, WIRED/DECLARED/UNBUILT) · `COMMAND-AUDIT.md` (officers) · `RACING.md` · `CERTIFICATIONS.md` · `DOGS-AND-ANIMALS.md` · `THE-DECK.md` · `MULTIPLAYER.md` · `STREET-VO.md` · `.notes/audit-*.md` (the per-slice working audits behind `MASTER-SYSTEMS.md`).

**INTENT docs — trust these for what we are aiming at, never for status:**
`DESIGN-DIRECTIVE.md` (the largest single statement of intent) · `THREE-GAMES-ONE-WAR.md` (the canon laws) · `THE-LORE.md` / `LORE-COF-INTEGRATION.md` / `NARRATIVE.md` · `META-LAYER.md` · `GOVERNMENT.md` / `SECRETARY-OF-WAR-PITCHES.md` · `THE-TOWN.md` · `OUTBREAK-SPEC.md` · `VERTICAL-WAR.md` · `MAP-STRATEGY.md` · `BUSINESS-PLAN.md` · `UI-BIBLE.md` / `UI-MASTER.md` / `UX-LANGUAGE.md` · `MULTIPLAYER-PLAN.md` (**the plan; `MULTIPLAYER.md` is the status**).

**WORK BOARDS — what is queued:**
`MASTER-BACKLOG.md` (the open-work board) · `QUESTIONS.md` (decisions waiting on Robert) · `DECISIONS-OPEN.md` · `EXECUTION-ORDER.md` · `LOOP-LOG.md` / `SHIPPING-LOG.md` (what landed when).

**KNOWN STALE — do not act on without re-verifying:**
- `RACING.md` **was** stale (shipped features marked "▶ build") — **rewritten 2026-07-23**; the card table now states shipped-vs-not with cites.
- `ASCENDANTS.md` — the designation table promises T4 EXTINCTION gods; **no unit in `lsw.ts` is assigned `threat:4`**. Treat the roster tiers as intent.
- Any doc dated before a feature's ship date. Check `git log` on the feature's files.

---

## 3 · THE DOSSIER TEMPLATE

Every feature dossier from here uses this shape, so a reader always knows where to look. Copy it.

```markdown
# <FEATURE> — <one line: what it is>
### Status: <BUILT|PARTIAL|SHELL|PLANNED> · verified against code <date>

## 0. FOR THE NEXT AI
   What it is in a paragraph · the files that ARE the feature · the one thing
   to know before touching it.

## 1. WHAT THE CODE DOES (evidence)
   Table: system · status · what it does · file:line. Real numbers, cited.

## 2. WHAT WE ARE AIMING AT (from conversation)
   Robert's intent, quoted where possible. The design law. This is the half
   the code cannot tell you.

## 3. THE GAP, RANKED
   What stands between §1 and §2, cheapest-first.

## 4. OPEN QUESTIONS
   Decisions only Robert can make. Real forks, not clean-ups.

## 5. MY RECOMMENDATION
   Claude's take: what to do next and why. Say it plainly.

## 6. TRAPS
   Things already paid for. Do not rediscover these.
```

**The two halves matter equally.** §1 without §2 produces an AI that faithfully implements the wrong thing. §2 without §1 produces an AI that rebuilds what already exists. The reason this project keeps hitting both failure modes is that most docs contain only one half.

---

## 4 · MY RECOMMENDATION — what I think we should do

Robert asked for my input, so here it is straight.

**1. The documentation problem is not volume, it is truth-decay — and the fix is cheap.**
~70 docs, 1.3 MB, and the two I spot-checked both described shipped systems as unbuilt. Every doc should carry one line at the top: *kind* (STATUS/INTENT/HISTORICAL) and *date verified*. That is a ten-minute pass per doc and it is worth more than any new document. **Do that before writing more.**

**2. Stop writing docs that a grep would replace.** The dossiers that earn their keep are the ones carrying things the code cannot tell you: Robert's intent, the traps already paid for, and the ranked gap. `STATISTICS.md` is the model precisely because it is *evidence plus judgement*, not narration.

**3. The single highest-value engineering work right now is making the invisible visible.** Across the whole audit, the same pattern recurs: systems that are BUILT and RUNNING but that the player cannot perceive — morale (a full system, no HUD), the leadership aura, the AI commander's decisions, the influence map. These are hours of work each, not weeks, and every one converts an existing investment into something a player can feel. **This is the best return in the codebase.** Robert's own complaint — *"I never see any evidence"* — is precisely this class of bug.

**4. Three things are promising rewards they do not pay.** The Deck's "+6 MORALE", the Captain's "MAY TAKE COMMAND", and the rank cards' "heavier manifest" (`materielBonus` is never called). A UI that lies is worse than a UI that is silent. Either wire them or delete the claim — and both are small.

**5. Decide the two contradictions before building on top of them.** (a) Two rival rank ladders both gate the god-call with different currencies — pick one. (b) `wounded`/`triumph`-style declared-but-unbuilt hooks. These are cheap now and expensive after more code leans on them.

**6. On scope: the game is much further along than the docs suggest.** 17 modes run, a 10-front campaign with real operations exists, multiplayer is a working authoritative server, there are 316 weapons and 40 gods with individual brains. The gap is not *content*, it is *legibility and finish*. I would spend the next stretch making what exists readable to a player before adding another system.

**7. Writing these dossiers found four live defects that no amount of reading would have.** Every one came from *driving or running* the system: demolition never spawns a grid; the ghost lap is saved and never loaded; the rank **and** licence gates are both no-ops online because the server passes neither `rank` nor `papers`; and multiplayer is hidden behind a disabled tile. **That is the strongest argument for the dossier format** — §1 must be written by exercising the feature, not summarising the design.

**What I would do next, in order:** (i) the four defects above — all small, all currently invisible; (ii) tag every doc with kind + date; (iii) morale + command made visible; (iv) kill or wire the false promises; (v) reconcile the rank ladders; (vi) then new content.

---

*Index written 2026-07-23 against `main`. When you add a feature, add a row here and a dossier — and put the date on it.*
