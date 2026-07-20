# THE WAR — the solo-war design bible
### SOURCE OF TRUTH for the shape of the war. Locked 2026-07-20.

> **What this file is.** The Design Directive (`docs/DESIGN-DIRECTIVE.md`)
> stays the wide-angle directive; `docs/ASCENDANTS.md` stays the LSW law.
> THIS file captures the decisions Robert locked for the SOLO war so they
> stop living only in chat. Where an older doc disagrees with a section
> below, this file wins for solo play.

**Status tags** — every section is honest about what exists:

| Tag | Meaning |
|---|---|
| ✅ SHIPPED | in the code today, file references attached |
| 🔨 PARTIAL | the substrate exists; the decision reshapes it |
| 📋 DESIGN | locked decision, not yet built |

---

## 1. THE SHAPE — enlist once, win it three times over 📋 DESIGN

You enlist **once** — one side, the whole war. No per-match team picker;
your faction is your identity from the first deploy (DD §1's "you don't
pick a team, you enlist," now taken literally for solo).

- **Three fronts.** Win all three, three times over — **~9 matches** is one
  war. Small enough to finish, big enough to mean something.
- **The war board is a 3×3 grid** of front-flags — three fronts across,
  three passes down — readable at a glance. No scrolling, no drill-down;
  a glance tells you where the war stands.
- **The passes escalate through the gods:**
  - **Pass 1 — conventional war.** No LSWs on either side. Rifles, armor,
    air. You learn the war at human scale.
  - **Pass 2 — outgunned.** The ENEMY fields LSWs; you have none. The only
    answer is the science missions (§5) — the pass is designed to hurt
    until you run them.
  - **Pass 3 — gods on both sides.** You've earned yours. The full stable
    fights the full stable.
- **The name tells you who's talking:** one faction calls them **"gods"**,
  the other **"living super weapons"** (see `docs/LORE.md`).

**What exists under it** 🔨 — the shipped substrate this reshapes, not
replaces: the living campaign (`src/client/campaign.ts` — TEN named fronts,
control bands at ±34/±67, scars, seasons won at 6 of 10 via
`checkSeasonEnd`), authored front ground (`src/sim/fronts.ts`), both LSW
rosters measured and shipped (`docs/ASCENDANTS.md`), and the materiel purse
that already prices god-drops (`src/sim/world.ts:454`). The 3-front board
is a re-cut of this machine, not a second one.

---

## 2. THE CLOCK — the war only moves while you're in it 📋 DESIGN (a deletion)

**LOCKED: `simulateTimeSkip` is REMOVED for solo play.** A war that
advances while you sleep can undo your progress — an offline "honest
overnight" is still a slot machine you didn't pull. Rip it out.

- The function: `src/client/campaign.ts:219` (`simulateTimeSkip`).
- The call site to delete: `src/main.ts:954`.
- The dispatch's `simulated` flag and its plumbing go with it.

The rule that replaces it: **no battle, no movement.** Every line in the
journal traces to something the player did (the §16 audit spirit — nudges
already sign themselves OPERATOR; now nothing moves the map anonymously).

---

## 3. LIVES ARE CLONES — the spine of the economy 🔨 PARTIAL

The Reprint is already the game's respawn fiction (DD §21, ✅ shipped v1:
the announcer says **REPRINTED** — `src/client/hud.ts:702`; a clone bay
stands in every base — `src/sim/base.ts:39`, `src/client/models/props.ts:364`).
The locked decision makes it an ECONOMY:

- **You're issued clones.** Deaths burn them. Lives are the war's currency,
  and the ledger is public.
- **Officers allocate clones to fronts.** The reserve is a strategic stock,
  not a personal stat.
- **Science missions steal, earn, and deny them** (§5) — the clone economy
  is what makes those missions load-bearing.
- **Careless driving is priced in the currency: crashing a full transport
  burns eight clones.** (The shipped Ox Transport seats 9 —
  `src/sim/data.ts:308` — so the exact bill is a tuning line, but the law
  stands: a hull full of people is a hull full of money.)
- **FAIL STATE — locked:** if a front's clone reserve hits **zero**, that
  front is **LOST** until a set number of clones is invested to reopen it.
  **Winning means nothing if losing is impossible.**

**What exists under it** ✅ — the accounting rails are live: the B1 WAR
LEDGER already books each side's materiel spent and hulls lost
(`src/sim/world.ts:458`), underfunded victories already bank **morale**
into the dossier (`src/client/record.ts:20`) and return as opening materiel
(`src/sim/world.ts:246`). Clone reserves are the same pattern pointed at
lives instead of hulls. 📋 To build: the per-front reserve, death debits,
officer allocation, the transport bill, the zero-lockout and buy-back.

---

## 4. BOTS ARE ROBOTS 📋 DESIGN

Every non-human soldier on the field is a MACHINE — chrome-framed, and
**automatically outranked by every human**, always. A private outranks a
veteran robot; that's the point of being made of people.

- **Robots are scrap; clones are treasure.** A destroyed robot costs steel,
  not lives — so the horde can shred robots all day without touching the
  clone economy (§3). The fail state only counts flesh.
- **Personality matrices per bot** — aggression / caution / obedience
  dials — ride systems that already ship: the bot dial-board
  (`src/sim/bot-tuning.ts` — every eye/trigger/legs number named in one
  table), the Nemesis grudge (`src/sim/bots.ts:377` — a bot hunts the enemy
  that last killed it), and the blackbox flight recorder
  (`src/sim/blackbox.ts`) that can prove a personality is actually
  expressed on the field.

📋 To build: the chrome dress (today a `bot` is sim-identical to a human —
`SoldierKind` in `src/sim/types.ts:236`), the rank floor, per-bot matrix
persistence, and robots-don't-burn-clones in the §3 ledger.

---

## 5. SCIENCE MISSIONS — the war's second clock 📋 DESIGN

Run **off the war clock** — Hotline-Miami tight: small maps, instant
restart, no ceremony. They are **load-bearing**, not side content — Pass 2
(§1) is unwinnable without them.

Mission verbs, all war-legible:
- **Assassinate** the officer guarding an LSW program.
- **Steal tech** — the road to your own gods.
- **Raid clone stockpiles** — the §3 treasury, taken at gunpoint.
- **Deny reinforcements** — starve a front instead of storming it.

**Rewards are war-legible: clones, tech, LSW access.** Never abstract
points — every payout lands in a ledger the war board can show.

Substrate 🔨: the mode engine already runs authored small-format pressure
(`src/sim/modes.ts` — Safehouse, Survival, Horde) and pocket arenas
(`src/sim/skirmish.ts`); instant-restart and the mission verbs are new.

---

## 6. THE LEADERS — one authored voice per faction 📋 DESIGN

One authored character per faction — **written and voiced with real
personality, the same each war.** Not generated flavor: a person you
recognize by Pass 3.

- **They rule on CLASS-CHANGE REQUESTS based on what the war needs:**
  *"Request denied. We have enough snipers. We need medics."* Your class is
  a posting, not a menu — and the denial is characterization AND balance in
  one line.
- **They cut into the news** (§7) for campaign beats — a pass falling, a
  front lost to the clone fail state, your first god.

Substrate 🔨: the VO pipeline is proven at scale (40 LSWs speak through the
`vo` event bus — `src/sim/lsw.ts:756`; generation via the `expressive-tts`
skill), and the announcer already owns the ear. The leaders are two more
voices with a veto.

---

## 7. THE NEWS — the war has a press 🔨 PARTIAL

**~25 seconds, plays at base before deploy, always skippable.** Later it
lives on a physical TV in the HQ town (§8) — the war is read off a screen
in the world, not a menu.

Two tiers, degrading gracefully:
- **Tier 1 — offline.** Authored anchor VO carries the broadcast; the
  lower-third **ticker carries the specifics in text** (your callsign, the
  94u kill, the front that flipped). The anchor never says a variable; the
  ticker never needs a voice.
- **Tier 2 — API key present.** An LLM writes the script from the blackbox
  (`src/sim/blackbox.ts` — the match's own flight recorder is the source
  material), TTS voices it fresh.
- **Each faction gets its own channel with opposite spin.** Same facts, two
  broadcasts — the propaganda IS the worldbuilding.
- **The match's biggest moment wins the lead story** — the director reads
  the record, not a template order.
- **Newspaper front pages become AI-generated images when a front changes
  hands** (reference image + copy → cheap image model).

**What exists** ✅ — N1 THE FRONT COURIER: every finished battle already
files a data-archived newspaper issue — masthead, front headline, the duel
/ the money / the field (`src/client/newspaper.ts`, filed at
`src/main.ts:770`, printed on the career sheet at `src/main.ts:786`).
Issues are stored as DATA, never HTML, so the AI front-page upgrade
re-renders the whole archive for free. 📋 To build: the broadcast itself,
faction channels, the TV, Tier 2, image front pages.

---

## 8. THE DIEGETIC LAW 📋 DESIGN

**If the world can teach it, the world teaches it. Menus are the last
resort, and every kept menu is an apology.**

- **Seats are chosen by walking to the hatch.** Entry points light up in
  place — driver's hatch, gunner's ring, bay door. (Today E takes the first
  open seat, no choice — `src/sim/world.ts:3233`.)
- **Bots yield their seat to a human who walks up.** The machine gets out;
  rank is §4 law, expressed in the world.
- **Orders are a hand pointed at ground.** Not a command rose.
- **Rank is read off a shoulder.** Not a nameplate.
- **The war is read off a TV** (§7). Not a lobby screen.

Substrate 🔨: rank already exists to wear (`RANKS`,
`src/client/record.ts:51`), crew stations are already named slots
(`crewAt`, `src/sim/world.ts:3272`), and the no-pulldown armory proved the
house UI law this extends.

---

## 9. THE SKY — discrete bands, not height 📋 DESIGN

Continuous altitude is unreadable top-down. The sky becomes **three
discrete BANDS**:

| Band | Who lives there | The law |
|---|---|---|
| **1** | drones, hoverboard | first-storey height |
| **2** | helicopters | above every rooftop |
| **3** | jets | can **DIVE through band 2** for strafing runs, can't linger low |

- **AA reaches band 2 but not band 3.** Jets can't fire into band 0 without
  diving into the envelope — the dive is the duel.
- **Planes become CRASHABLE.** Today `flies` skips terrain collision
  entirely — "flyers soar over everything," only the map border stops them
  (`src/sim/world.ts:3471`). Making the ground real for aircraft is the
  cheapest big win in the sky.
- **Map wraparound for aircraft** — fly off one edge, come in the other.
  Fights the minimap and the "nothing escapes the world" test (the border
  clamp at `src/sim/world.ts:3509` is that test made law); solvable,
  planned, not v1.

Substrate ✅: the flyer stable exists (`src/sim/data.ts:246`), the AA
economy exists (SAM / MANPADS / flares — `src/sim/world.ts:122`), storms
already ground aircraft (`airGrounded`, `src/sim/world.ts:3469`).

---

## 10. THE DEATH CAM DIRECTOR 🔨 PARTIAL

**Shipped** ✅ — the default presentation: the killcam straddles the death
instead of ending on it (opens `KILLCAM_PRE` before the hit, streams the
aftermath from beyond the grave) with a speed ramp that near-freezes
THROUGH the impact (`src/client/replay.ts:17`, `killcamSpeedAt`
`replay.ts:48`). **Death-by-weapon physics is shipped** — `deathShove`
(`src/sim/world.ts:106`): bullets stagger, buckshot launches, energy drops
you where you stood, explosives lift.

**The director** 📋 — reads each death's data — weapon, range, direction,
overkill, wall proximity, killer's streak, airborne/mounted, time since
spawn — and varies the shot:

| Read | Shot |
|---|---|
| default | straddle + hit-stop (✅ shipped, above) |
| long range | **Ride the Round** — camera flies the bullet path |
| instant / laser | **The Autopsy** — hard freeze, shot line, range/weapon card |
| explosion / vehicle | **The Wide** — pull back, let the blast be the frame |
| spawn-kill | quick cut, **no celebration** |

Rotation-seeded so the variety is deterministic; **every one skippable.**

**Queued** 📋: ragdoll-threshold at the push sites (a shove big enough
should break the pose) and **20–30s lingering corpses** so the field
remembers the fight.

---

## 11. CUT — decided, on the record

| Cut | Why |
|---|---|
| **Underground drilling** | the altitude bands (§9) are the same idea pointed somewhere visible |
| **Personal player houses** | the walkable HQ town survives as a later ambition (§7's TV lives there); private real estate doesn't |
| **`simulateTimeSkip` for solo** | §2 — the war only moves while you're in it |

Cut means cut: don't re-pitch these as features; re-pitch them only if the
reason above stops being true.
