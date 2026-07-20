# SCIENCE MISSIONS — the design
### Locked 2026-07-20. The Hotline-Miami-tight side ops that make the science layer load-bearing. Tracked as BACKLOG W3.5. Not built yet — this is the spec.

> **What a mission IS.** A small map, a hard job, and a squad of clones you are *spending*. You allocate **1–8 clones** to a run (the difficulty dial). Die and you restart instantly — no menu, no loading, Hotline-tight — but **each death burns one clone from that squad.** Run the squad dry and the mission fails; those clones are gone from the war reserve for good. A great player spends one clone where a sloppy player spends six, and a **ghost run (zero deaths) pays a bonus.** That single rule gives free-feeling retries, real stakes, and a score chase — all off the clone economy (W3.3), which is why the two are built together.

Each front grants a limited number of **mission windows per pass**, so missions compete — you can't grind them all. Picking is the strategy layer.

---

## THE TEN VERBS

Every mission is one of these. Each has a distinct emotional shape.

| Verb | The job | What it feels like |
|---|---|---|
| **Assassinate** | Kill one named officer in a garrison | A hunt — he runs when alerted |
| **Steal** | Grab a thing and carry it out | Carrying slows you and blocks your primary |
| **Raid** | Take as much as you can before the alarm ends it | Greed — every extra crate is banked clones |
| **Deny** | Charge N objects, leave before the boom | The DX-9 charge already exists for this |
| **Rescue** | Free captives, walk them out alive | They follow, they're fragile, they panic |
| **Infiltrate** | Reach a terminal unseen, hold it, leave | The perception system as the whole game |
| **Ambush** | Hit a convoy inside a window | Timing, vehicles, one shot at it |
| **Hold** | You have it — now survive until extraction | Inverted tension, waves closing in |
| **Hunt** | A loose asset is out there; track and kill it | Quiet, then very loud |
| **Decapitate** | Three officers, one map, they warn each other | Escalating chaos by design |

## THE TEN SITES

Tone, and reuse of tech that already ships:

Clone vault · research annex · rail yard · comms relay · field hospital · foundry (Iron-Eater flavored) · buried archive · **enemy airfield** (the shipped hangars, on the other side) · an officer's **villa** (a nice house, in a war) · a **quarantine zone** where a third party is already eating everyone.

## THE GENERATOR

A mission is **VERB × SITE × STAKE × COMPLICATION.** Ten verbs and ten sites give a hundred authored-feeling frames before complications multiply it. Every one is legible in a sentence:

> *"Raid the clone vault at Tessaly under storm — a god walks the perimeter."*

**Complications** (the spice): an alarm net · a god on guard · a storm · a third faction already fighting · a no-kill clause · a one-life clause.

## THE FIFTY EFFECTS (rewards)

The law: **every reward moves a number the player already watches.** Grouped:

**Clones (10)** — reinforce a front · reinforce the theater pool · drain theirs · take their cloning offline for a battle · ransom captives for materiel · reprint with full kit · shorter respawn · one banked instant respawn · see their reserves on the war board forever · spawn-death insurance (dying inside 30s of a print doesn't burn one).

**Tech (15)** — family-wide weapon upgrade · ammo doctrine · a permanent secondary-fire retrofit · infantry plate · bot optics · a tank variant (ECM / materiel-printer / clone-carrier) · an aircraft loadout · field repair · non-lethal munitions · class grenades · the leap · jetpack tuning · reactive plating · beam containment · personal shields.

**Gods (10)** — unlock an LSW · win assignment rights (you choose its front) · deny a front to theirs · kill one permanently · assassinate the officer guarding a program · capture an enemy god and field it · cut their deploy count · upgrade a signature arm · deploy two at once · see which god they're bringing before you commit.

**Logistics (10)** — deny reinforcements · steal their opening purse · ground their air · cheaper requisition · rearm pads on the field · open a permanent route through a front · one off-map barrage per battle · pre-placed hazards · pick the weather · start holding midfield.

**Intel (5)** — roster preview · a Nemesis file on the bot that keeps killing you · first-thirty-seconds fog lift · live radio intercept · permanent sight of their books.

## HOW THEY ESCALATE

- **Pass 1** — optional; they teach the verbs.
- **Pass 2** — the ONLY answer to enemy gods; the stakes are LSW and tech. The pass is built to hurt until you run them.
- **Pass 3** — the war is symmetric, so **denial and intel** become the sharpest rewards.

The Courier reports the aftermath: a raid you pulled off Tuesday is a headline Wednesday, written from the enemy's side of it.

## INDIVIDUAL-PLAYER HOOKS

- **The unnamed soldier.** No name = a serial number, an unregistered print. Officers address you as **PRINT 7749** and don't warm up; bots address you exactly (bots are precise); the dossier header sits blank. Name yourself — offered diegetically after your first confirmed kill or first mission, never in a settings pane — and the first officer who says your callsign instead of your number is a genuine beat. (Bonus: solves offline TTS — a recruiter can *read digits* out loud, so the unnamed player is the voiced case; named players get the ticker/text or the Tier-2 LLM+TTS pass.)

---

## LOCKED DECISIONS

- **Squad size 1 → 8**, scaling with difficulty. A 1-clone run is a knife-edge solo infiltration; an 8-clone run is a forgiving assault. The squad size is itself a difficulty dial.
- **Multiplayer path:** co-op science missions are the FIRST real multiplayer (2–4 players, tiny worlds, short sessions, friends-only) — see the netcode plan in `docs/OPTIMIZATION-AUDIT.md`.

## OPEN — Robert's call

- **Stake on failure:** permanent loss of the clones (war gets scarier) vs retry next window (fairer)?
- **Captured gods:** can you actually field an enemy LSW, or is that too big a swing?

## Substrate that already ships (what to build ON)

- The **skirmish** builder generates small "mission grounds" maps (`src/sim/skirmish.ts`) — its own header says "the rules land later." This is that.
- The **DX-9 demolition charge** exists (Deny).
- The **materiel purse + warLedger** (`world.ts:454-472`) is the economy rail rewards move.
- The **clone bay** prop + the Reprint fiction ship; the clone *economy* (W3.3) is the missing accounting this rides on.
- **Generated briefing-card art** via the ad-lab image pipeline (see W4.1's image path).
