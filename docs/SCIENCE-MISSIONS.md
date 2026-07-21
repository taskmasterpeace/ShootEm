# SCIENCE MISSIONS — shipped v1 and catalog direction
### Locked 2026-07-20 · production slice shipped 2026-07-21 on `codex/science-missions`.

## CITY BUILDING MAP MAKER — 2026-07-21

Science sites now come from the same complete-building grammar exposed in the
Map Maker. The checked-in Country Master Sheet normalization contains **168
countries and 1,050 named cities**. Country, city population/type, culture,
crime/safety, government, enforcement, military, science, and lifestyle data
become deterministic architectural weights and security pressure; they are
biases, not hard cultural stereotypes.

- **19 archetypes** span residential, commercial, industrial, civic/science,
  and military uses across rectangle, L-shape, courtyard, twin-wing, and arcade
  footprints. Every result is a complete one-to-three-storey building, not a
  detached room fragment. Courtyards have deliberate entrances.
- Compact architecture uses thin oriented walls and doors, framed breakable
  windows, section shutters, balconies/rails, automatic directional stairs,
  and deliberate E-use ladders. Indexed Ground/L2/L3 layers remain backward
  compatible with v1 Map Maker JSON.
- Clone vaults, research annexes, depots, clinics, factories, archives,
  airfields, villas, and quarantine/processing sites compile through the whole
  building system. Mission specs retain `cityId`, city name, and security so
  briefings and the existing Courier/newspaper aftermath carry provenance.
- Print commitments still run **1–8**, but now budget initial security,
  civilians, dog teams, patrol sectors, and a later reserve wave. The first
  room is capped at two guards; larger commitments spread pressure instead of
  making a spawn pile.
- Indoor security hears, investigates, searches adjacent rooms, coordinates
  portal claims, recovers blocked routes, and returns to post. Civilians choose
  shelter away from the last-known threat. This layer is opt-in through
  building metadata, leaving open battle bots unchanged.
- Dogs retain a capped 24-node/eight-second scent trail through cloak and
  darkness, remain inside handler pull, take stairs, reject ladders, hesitate
  at intact glazing, bark an alarm, and briefly drag on a successful bite. Bite
  damage and dog HP did not increase.

The Map Maker drafting table adds country→city selection, grouped archetypes,
seed/storey/print controls, Ground/L2/L3 tabs (keys 1–3), floor-aware painting
and law labels, operation sockets, provenance, autosave/import/export, exploded
view, a full open-topped 3D inspection model, and direct Science Operation
launch. Launch stays disabled unless both the six battlefield laws and eight
whole-building laws pass.

Current boundary: this ships one complete mission building or bounded
building/yard hybrid at a time. It does not yet assemble an entire procedural
city block or mall from several independently editable buildings, and the Map
Maker remains a developer harness rather than a player-facing campaign editor.

## SHIPPED PRODUCTION SLICE

Science Missions is now a native offline War World mode. Free Play exposes a
**Science Mission** card; every selected campaign front exposes a deterministic
**Science Window** briefing. The mode reuses the live weapon catalog, movement,
perception, bots, vehicles, LSWs, scientists, zombies, doors, second storeys,
HUD, campaign save, and Front Courier.

### How to play

- Pick **Science Mission** under Deploy, set **Mission Clone Stock** from 1–8,
  choose class/loadout/environment, and deploy; or select a front on **Map** and
  use **Run Science Mission**.
- Movement, aim, fire, reload, crouch, equipment, and melee are the normal War
  World controls. Press **E** to open mission doors, secure terminals/stores,
  arm denial points, attach captives, and use the villa stair/ladder well.
- Complete the primary, then return to the field printer/transport beacon. The
  mission card and top objective rail show objective progress, alarm/ghost
  state, payment, and live clone pips.
- Death skips the ordinary downed wait. One committed print burns and the next
  body appears at the field printer after 0.25 seconds. Spending the final print
  fails the operation immediately. A zero-death win is a **Ghost Run** and
  recovers ten clean sleeves for the front.

### Exact v1 mission rules

| Verb | Shipped objective |
|---|---|
| Assassinate | Eliminate one named program director. |
| Steal | Secure one program core interaction, then extract. Carry encumbrance is catalog expansion, not v1. |
| Raid | Secure three clone-store markers. |
| Deny | Arm three denial markers with E, then extract. |
| Rescue | Attach and extract two living named scientist captives; losing either fails the job. |
| Infiltrate | Reach and secure the terminal; detection raises the alarm and forfeits Ghost status. |
| Ambush | Destroy the moving transport and its three target guards before the convoy exits. |
| Hold | Occupy the uplink for twelve seconds, then extract. |
| Hunt | Eliminate one named loose asset. |
| Decapitate | Eliminate three named program officers. |

All ten site profiles ship. They are compact bounded pockets with thin oriented
walls, door-like manual doors, objective/guard sockets, and one safe printer.
The **officer villa always has two storeys**: at least one required objective is
upstairs, the stair well is traversable, and extraction remains downstairs.
Quarantine jobs reuse the zombie substrate; Rescue is the only verb that deals
captives into the firefight, preventing unrelated guards from massacring
decorative scientists at mission start.

The six complications are executable rules: alarm-net starts hot and schedules
a response team; god-on-guard requests the existing Plaguebearer; storm applies
the live weather system; third-party and quarantine add zombies; no-kill fails
on collateral guards but permits required targets; one-life clamps the squad to
one print.

### Campaign windows, loss policy, and aftermath

- Every front gets **two science windows per pass**. Launching spends a window;
  quitting or failing does not refund it. Advancing the front to a new pass
  refreshes the two windows. Free Play never mutates campaign state.
- `DEFAULT_SCIENCE_CLONE_LOSS_POLICY` is `spent-permanent`: deaths on successful
  or failed campaign runs permanently reduce that front's reserve. The campaign
  adapter also supports `retry-next-window`, which restores a failed squad's
  clone allocation while still spending the sortie window. The runtime and
  mission result format do not change between policies.
- Result application is idempotent by operation ID. A completed operation
  writes one Morning Dispatch transaction and one normal `PressIssue` with the
  operation, clone bill, Ghost/alarm result, and reward.

### Shipped rewards versus the larger catalog

The v1 generator draws from twelve typed, persisted reward adapters. Two act
immediately: **Front Reinforcement** adds 40 front clones and **Front
Breakthrough** moves control +6. A Ghost Run independently returns ten front
clones. The other ten adapters are explicit strategic banks shown on the Scar: theater clones,
enemy print pressure, clone insurance, morale, opening materiel, requisition
discounts, reinforcement cuts, weather picks, roster intel, and LSW assignment
rights. Those banks persist and are reported; ordinary-battle spend/selection
UI for those banked rights is the next campaign-consumer slice and is not
silently simulated in v1.

The fifty-effect lists below remain catalog direction. Weapon-family tech,
captured gods, retrofit selection, carried-core encumbrance, greedy variable
raid loot, generated briefing art, and friends-only co-op are not claimed as
part of this production slice.

---

## LOCKED CATALOG DIRECTION

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
