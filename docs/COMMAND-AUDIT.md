# COMMAND & GOVERNMENT — WHERE WE ACTUALLY ARE
### An honest audit, 2026-07-23. Robert asked "WHERE ARE WE WITH IT… whenever I play, I NEVER see any evidence of that." This document answers that, without pretending the design docs are the game.

> **Read this first.** Every element below is tagged one of four ways:
> **✅ VISIBLE** (built and a player encounters it in play) · **👻 INVISIBLE**
> (code runs, but the player sees no evidence) · **📋 PLANNED** (only in docs /
> issues) · **⚠️ CONTRADICTED** (built, but differently than the plan says).
> The plan lives in `docs/GOVERNMENT.md`, `docs/THREE-GAMES-ONE-WAR.md`
> §"Economy & command", `docs/META-LAYER.md`, and `docs/SECRETARY-OF-WAR-PITCHES.md`.
> This document is about the gap between those and the running build.

---

## 1 · THE VERDICT UP FRONT

**Roughly one-fifth of the command vision is real, and almost none of the part
Robert is picturing when he says "the officers, the command."** What actually
shipped is the *bottom* of the chain and the *money* around it: a war chest that
really does set your opening manifest (`treasury.ts`), a rank ladder that really
does gate the god-call (`ranks.ts`), a leader-AI that rules on your class
request (`officer.ts`), and the "officer's channel" — press V, spend materiel,
call a god down (`stable.ts`). Those are genuine, and two of them are visible.

**Everything above the squad is missing.** There is no President, no Secretary
of War, no General, no seat you can hold or take, no visible AI holding a seat,
no vote of confidence, no doctrine package, and no developer's desk to tune any
of it. The chain of command as a *thing the player perceives* — a face, a name,
a hierarchy above you that is AI-held-but-takeable — **does not exist in the
build at all.** It exists only in `docs/` and in issue #129. So when Robert
plays and "never sees any evidence," he is correct: the parts he means were
designed, filed, and never built. What he *does* see (the war chest line, the
rank chip, the officer's class ruling) he probably doesn't recognize as "the
command system," because nothing in the game frames them that way.

The single worst offender is a badge in the promotion board that reads **"MAY
TAKE COMMAND"** (`service-file.ts:115`). It is a door with no room behind it —
there is nothing to command, no seat to take. That badge is the whole gap in
one line.

---

## 2 · WHAT EXISTS AND IS VISIBLE IN PLAY

These are real, and a player *does* encounter them — though never labelled "the
command system."

### 2.1 ✅ THE WAR CHEST (Government program G1)
- **Code:** `src/client/treasury.ts` — per-faction balance, win/loss payouts
  (+3000 / −1500 / +250 draw), hull bill off the top.
- **Where you meet it:**
  - **After every decisive match** — settled at `src/main.ts:1468`, and the
    after-action career pane prints `treasuryLine()`: *"WAR CHEST 12,500 · +2,850
    — Victory payout"* (`src/main.ts:1469`).
  - **The GONET desk** shows `War Chest` and `Your Record W·L` rows
    (`src/client/gonet/index.ts:208-209`).
  - **YOUR FILE** in the GONET has a "THE WAR CHEST" block with the funding band
    in words — *"your government funds a lean manifest"* (`service-file.ts:56-68`).
  - **Ministry mail** reports the balance in plain language (`gonet/mail.ts:88-100`).
- **It is load-bearing, not cosmetic:** `budgetMultiplier()` bands the balance
  into a 0.6–1.25 multiplier that is handed to the sim as `opts.budget`, and
  `world.ts:722-728` scales the **opening materiel** by it. A broke army
  genuinely fields fewer requisitions and god-calls. This is the one piece of
  "the government" that a player can feel change the battlefield.

### 2.2 ✅ THE OFFICER'S CLASS RULING
- **Code:** `src/sim/officer.ts` (`ruleOnClassRequest`), wired at
  `world.ts:1740` inside `redeployAs`.
- **Where you meet it:** the K.I.A. re-select rack. Pick a new class and a
  leader-AI weighs the live roster and answers *in the officer's voice* on the
  HUD banner: *"DENIED — the line has medics enough. Hold your post."* /
  *"REQUEST APPROVED — HEAVY. Bring the iron."*
- **This is the closest thing in the game to "an officer" the player hears.**
  It is deterministic, per-team, and it works. But it is anonymous — there is no
  named officer, no face, and it only speaks when you try to switch class.

### 2.3 ✅ THE STABLE — the officer's V-channel (the god-call)
- **Code:** `src/client/stable.ts` (the console), `world.ts:1192` (`requestLsw`,
  the pricing + judging).
- **Where you meet it:** press **V** in a war match → a terminal lists the
  living-super-weapons your faction can call, each priced in materiel; click one
  and the pod drops where you stand.
- **Gated by rank** (this is the "earned responsibility" law made real):
  - The console shows *"CHANNEL LOCKED — the V channel belongs to OFFICERS"*
    unless `isCommissioned(dossier)` (`stable.ts:63`).
  - The sim independently refuses an uncommissioned human at `world.ts:1200`
    with *"THE STABLE ANSWERS LIEUTENANTS — YOU ARE NOT COMMISSIONED."*
- **⚠️ Caveat — see §4 and §8:** this is gated by **two different rank ladders
  at once**, which is a real bug-in-waiting.

### 2.4 ✅ THE RANK CHIP
- **Code:** `setRankChip` (`hud.ts:262`), fed from `record.ts` `rankFor(rankPoints)`.
- **Where you meet it:** the in-match vitals row — *"· PRIVATE"* with insignia
  glyphs, and the after-action "Career — what this match added" pane shows the
  points gained and any promotion.
- This is visible and works, but it is the **old** 14-rung ladder (see §4), and
  the rank it shows is *not* the rank that gates your command authority.

### 2.5 ✅ THE OPERATIONS PLANNER — the "Operation Officer buys the manifest" rung
- **Code:** `src/client/operations-ui.ts`, reached from the **MAP tab → a front
  → the operation board → the manifest dialog** (`main.ts:2149`, `2035`).
- **Where you meet it:** on the Scar map you can stage an operation, pick hulls
  for the manifest, and the board prints *"COMMAND COST · LAUNCH 4 · TREASURY
  12,000"* and *"MANIFEST VALIDATED · COMMAND AUTHORIZED"* (`operations-ui.ts:157,189`).
- **This is genuinely the bottom rung of the canon chain** (President →
  Secretary → General → **Officer buys the manifest**). It ships. But it is
  buried in the MAP tab, never framed as "you are the Operation Officer," and
  most players will never realize it is the command layer.

---

## 3 · WHAT EXISTS BUT IS INVISIBLE — **Robert's complaint lives here**

This is the biggest section on purpose. These systems **run**, but the player
sees no evidence, so from the seat it feels identical to "not built."

### 3.1 👻 THE AI COMMANDER (the LOCKED law, silently half-built)
The canon says (THREE-GAMES-ONE-WAR §"Economy & command", LOCKED): *"AI commander
is visible as AI — the player must KNOW command is AI-held and that they can take
over."*

- **What runs:** `world.ts` `stepLswDrops()` (~line 2440) has a **bot officer**.
  A faction with no human on its roster calls its own stable on a timer
  (`nextLswCallAt`), spending materiel and dropping gods for its side. So there
  *is* an AI commander making the single biggest tactical call in the game.
- **What the player sees:** **nothing.** There is no name, no face, no "COMMAND:
  AI" readout, no indication a decision was even made by anyone. A god just
  appears for the other side. The "visible as AI" half of the LOCKED law is
  100% absent. The "you can take over" half does not exist at all.
- **Verdict:** ⚠️ CONTRADICTED — the law says *visible*; it shipped *invisible*.

### 3.2 👻 LEADERSHIP RADIUS (rank actually does something, silently)
- **Code:** `ranks.ts` `leadershipRadius(rankId)` (Corporal 10u → General 38u),
  applied at `world.ts:2431`: soldiers inside a higher-ranked friendly's radius
  hold their morale (the `ledWell` shift).
- **What the player sees:** nothing. Morale itself has **no HUD readout at all**
  (grep confirms: morale drives spread and bot cover-seeking, but there is no
  meter, no icon, no number anywhere in `hud.ts`/`renderer.ts`). So "a sergeant
  near you steadies the men" is real math the player can never perceive.
- **Verdict:** 👻 INVISIBLE. The authority exists; the feedback loop doesn't.

### 3.3 👻 THE PROMOTION BOARD'S AUTHORITIES (badges over empty rooms)
- **Code:** `service-file.ts` `boardHtml()` shows, in the GONET "YOUR FILE" tab:
  *"MAY CALL THE STABLE"* and *"MAY TAKE COMMAND"* badges (`service-file.ts:113-116`),
  driven by `mayCallStable()`/`mayCommand()` from `ranks.ts`.
- **The problem:** "MAY CALL THE STABLE" is honest — it maps to a real thing
  (§2.3). **"MAY TAKE COMMAND" maps to nothing.** `mayCommand` (Captain, id 6)
  is checked in exactly one place — to render its own badge. There is no command
  seat, so the badge grants an ability the game does not contain.
- **Verdict:** 👻 INVISIBLE / hollow. This badge is the single clearest symptom
  of the whole gap.

### 3.4 👻 MINISTRY MAIL (built, but nation-blind)
- **Code:** `gonet/mail.ts` generates ministry/school/board/home mail derived
  from real account state.
- **What's there:** *"MINISTRY OF WAR · THE COLLECTIVE — Funding notice, 12,000
  on the books."* Real, and it reads well.
- **What's missing vs. G3:** the plan says the letterhead carries *"the nation
  name, leader title, stat-tinted flavor"* — a high-science nation sends lab
  work, a manpower nation sends fronts. Reality: mail is **faction-generic**
  (Collective / United Front), never nation-specific. It never uses the
  President or `leaderTitle` your country has. So "mail from YOUR government"
  is really "mail from your side." (See §4 — the President data exists but is
  surfaced in exactly one screen.)
- **Verdict:** ✅ shipped as faction mail / 📋 the nation-tinted ministry is not built.

### 3.5 👻 THE WAR ROOM (a server-operator console, not the player's command chain)
- **Code:** `src/server/warroom.ts` + `src/warroom/warroom.ts` + `warroom.html`.
- **What it is:** a polling admin panel for whoever runs a multiplayer server —
  observe live rooms, see rosters, kick humans, nudge front control. It is a
  *sysadmin wall display*, wired to HTTP endpoints.
- **Why it doesn't count as "command":** a normal player never sees it; it is
  not in the game client; it holds no seat and issues no orders to soldiers. It
  is easy to mistake for "the command layer shipped" — it isn't.
- **Verdict:** ✅ exists, 👻 invisible to players, and orthogonal to the chain.

---

## 4 · THE CHAIN OF COMMAND — CANON vs REALITY, RUNG BY RUNG

Canon chain (THREE-GAMES-ONE-WAR §"Economy & command"):
**President → Secretary of War → General (per front) → Officer → squad → soldier.**

| Rung | Canon says | Reality | Status |
|---|---|---|---|
| **President** | Head of the government you enlisted under; funds the war. | Data only. `nations.ts` has `president` + `leaderTitle`, surfaced on **one** screen (the enlistment review, `frontend.ts:431`). **131 of 169 nations have an empty president string** — most players see a blank. Never referenced again after enlistment. | 📋 data, no role |
| **Secretary of War** | Shapes the economy: treasury %, priority front, factories, doctrine. | **Nothing.** No entity, no AI, no screen. The `SECRETARY-OF-WAR-PITCHES.md` doc is a pitch; issue #75/#129 are open. Front funding splits (G2) are unbuilt — `budgetMultiplier` is one faction-wide number, not a per-front military/science/civic split. | 📋 PLANNED |
| **General (per front)** | Runs one front's operations, sets standing orders. | **Nothing.** No theater-commander entity. The Scar map moves control by your battle results, but no General decides anything. | 📋 PLANNED |
| **Officer** | Picks a Doctrine Package (Armor Spearhead / Air Superiority / Infantry Surge / Spec Ops), fine-tunes the manifest, calls gods. | **Partially real, in three disconnected pieces:** the manifest planner (§2.5), the class-request ruling (§2.2), and the V-channel god-call (§2.3). But **no doctrine package exists** — the 4-package choice is unbuilt. And these three pieces are never presented as "you, the Officer." | ⚠️ partial, unlabelled |
| **Squad** | The fireteam; by-name orders; the command wheel. | `squadId` is assigned (`world.ts:1061`), and it biases spawns / rescue / intel-rings. But **there is no order system** — RMB is alt-fire, not a command wheel (`STATUS.md:207` confirms ❌), and by-name orders are issue #105 (planned). A squad is a spawn-and-intel layer, never a command layer. | ⚠️ layer only |
| **Soldier** | You. | ✅ You. This rung is the whole rest of the game. | ✅ |

**The two-ladder contradiction (⚠️, important):** there are **two independent
rank systems live at once**, with different names and different thresholds:

- `src/client/record.ts` — **14 rungs**, Private → Colonel, Lieutenant at
  **8000 points**. This drives the **in-match rank chip** and the after-action
  pane. *This is the rank the player sees.*
- `src/sim/ranks.ts` — **10 rungs**, Recruit → General, Lieutenant at **520
  service**, Captain (`MAY_COMMAND`) at 820. This drives the **promotion board**
  in YOUR FILE and the `opts.rank` handed to the sim.

The god-call is gated by **both at once**: the console UI checks
`isCommissioned` = record.ts's 8000-point Lieutenant *or* the OCS path
(`stable.ts:16-19`), while the sim checks `mayCallStable(opts.rank)` =
ranks.ts's id≥5 (`world.ts:1200`). A player can therefore be "Lieutenant" on the
chip and a different rung on the board, and the two gates can disagree. This is
latent confusion that will surface the moment anyone tunes rank.

---

## 5 · SINGLE PLAYER — THE OFFICER EXPERIENCE

### What it is today
Concretely, right now, a solo player's entire "officer/command" experience is:

1. Enlist → see your country's President for one screen (blank for most nations).
2. Deploy. Wear a rank chip that ticks up with points.
3. If you try to switch class at a death screen, an anonymous officer-voice
   approves or denies it on the banner.
4. Once you cross the commission line, press **V** to spend the war's materiel
   and drop a god where you stand.
5. Between matches, read faction mail about the war chest, and see a promotion
   board that tells you you "MAY TAKE COMMAND" of nothing.
6. Optionally, in the MAP tab, stage an operation and pick its manifest.

That's it. There is no one you report to, no one who reports to you, no seat, no
name above yours, no sense of a hierarchy. The "AI commander" that the canon
insists you must *see* is invisible; you never learn a decision was made.

### What it should be (the cheapest honest version of the vision)
The canon is explicit that **the single-player government is the war's weather —
you never "play" it, you FEEL it** (`GOVERNMENT.md` §SP). The smallest build
that would make Robert *see* command:

- **Name the officer and show the chain.** A one-screen "YOUR COMMAND" panel in
  the GONET: *your* rank at the bottom, and the AI-held seats above you —
  **General [AI], Secretary of War [AI], President [your country's real name]** —
  each with a name and a **"[AI] — you may petition/take this seat"** tag when
  you're eligible. This alone satisfies the LOCKED "visible as AI" law and turns
  "MAY TAKE COMMAND" from a hollow badge into a door.
- **Make the AI commander speak.** When the enemy bot-officer calls a god, or
  when your side's AI officer sets the manifest, say so in a line —
  *"ENEMY COMMAND (AI) committed a Titan"* / *"Your officer drew a full
  manifest — the chest could afford it."* The decision already happens
  (`stepLswDrops`); it just needs a voice.
- **A morale/leadership readout.** Since `leadershipRadius` already steadies men
  silently, show it: a small "UNDER COMMAND" pip when you're inside a leader's
  reach, and a squad-morale band. This makes rank's real effect perceptible.

---

## 6 · MULTIPLAYER — THE OFFICER EXPERIENCE

### What's planned
The canon endgame (`GOVERNMENT.md` §MP, THREE-GAMES-ONE-WAR): empty seats are
**visibly AI** and any qualified human can **take** one; a second human arriving
**splits** command; a **vote of confidence** (LOCKED) seats and unseats people,
weighing their war-effort record (the ledger is the résumé). None of this
exists.

### What's actually wired for MP today
- A real server exists (`src/server/server.ts`) and relays the god-call over the
  wire (`callLsw`, `server.ts:178`). The client sends a `commissioned` flag
  (`net.ts:39,73`).
- **⚠️ The rank gate does not hold on the server.** The server builds its World
  with `new World({ seed, mode, theme })` (`server.ts:106,224`) — **no
  `opts.rank`**. In `requestLsw` the commission check is
  `if (caller?.kind === 'human' && this.opts.rank !== undefined && !mayCallStable(...))`
  — with `opts.rank` undefined, the check is **skipped entirely**. So in
  multiplayer today, *any* human can call a god regardless of rank; the
  `commissioned` flag is decorative and only the client-side console UI respects
  it. The "earned responsibility" law is client-honor-system in MP.

### What it's blocked on
- **Accounts (#83)** — there is no auth/DB, so no persistent identity to attach
  a seat, a résumé, or a vote to. Seats and votes are impossible without this.
- **Netcode for seats** — the wire protocol carries joins, snapshots, chat,
  waypoints, and the god-call. It has no concept of a command seat, an order, a
  doctrine, or a vote. All of that is greenfield.

**Bottom line for MP:** the officer experience is one working feature (the
god-call, ungated) and an entire unbuilt political layer sitting behind #83.

---

## 7 · THE AI COMMANDER — is any of the LOCKED law real?

The law (LOCKED, THREE-GAMES-ONE-WAR): *"AI commander is visible as AI — the
player must KNOW command is AI-held and that they can take over."*

| Half of the law | Real? | Evidence |
|---|---|---|
| An AI actually holds command | **Yes, at the god-call rung only.** | `world.ts` `stepLswDrops` — a humanless faction's bot officer calls its own stable on a timer. That is the AI making the biggest call. |
| The player KNOWS it's AI-held | **No.** | Zero UI. No name, no seat, no "AI" tag, no line when it acts. Completely silent. |
| The player can take over | **No.** | There is no seat, no take-over control, no split-on-arrival. `mayCommand` gates only its own badge. |

So: **one-sixth of the AI-commander law is real (an AI does decide), and it is
the invisible sixth.** The two halves that were LOCKED as the *point* — that you
see it, and that you can seize it — are entirely unbuilt. This is the precise
technical statement of Robert's "I never see any evidence."

---

## 8 · THE GAP, RANKED — what would most make command VISIBLE, cheapest first

1. **[XS] Give the AI commander a voice.** When any officer (bot or your side's
   AI) commits a god or draws a manifest, emit one HUD/announce line naming it as
   command. The decision already happens in `stepLswDrops`; this is ~an event +
   a string. Instantly satisfies "visible as AI." **Highest leverage per hour.**
2. **[XS] Retire or wire the hollow badge.** Either delete "MAY TAKE COMMAND"
   from `service-file.ts`, or point it at #9 below. A badge that lies is worse
   than no badge.
3. **[S] "YOUR COMMAND" panel in the GONET.** One derived screen: your rung, and
   the seats above (General/Secretary/President) with `[AI]` tags and the real
   nation President. Pure read-only, uses data that already exists
   (`nations.ts`, `ranks.ts`). Makes the chain *perceptible* for the first time.
4. **[S] Reconcile the two rank ladders.** Pick one (`ranks.ts` is the newer,
   authority-based one and is the right choice) and make the chip, the board,
   and both stable gates read it. Removes a latent contradiction and makes
   "Lieutenant unlocks the stable" mean one thing.
5. **[S] Show morale + "under command."** A squad-morale band and an "UNDER
   COMMAND" pip when inside `leadershipRadius`. Turns rank's already-real morale
   effect into something the player feels. (Composes with issue on squads.)
6. **[M] Frame the operations planner as the Officer's desk.** Rename/reframe the
   MAP-tab operation board as "OPERATION OFFICER — your manifest" and surface the
   Doctrine Package choice (Armor Spearhead / Air Superiority / Infantry Surge /
   Spec Ops) as the manifest's spine. The planner exists; it needs an identity
   and the 4-package layer.
7. **[M] Close the MP commission hole.** Pass `opts.rank` (or enforce
   `commissioned`) server-side so the god-call gate holds online. Small code,
   real integrity fix — do it before MP is public.
8. **[L] The seat registry + take-over (G4).** The real thing: a seat model
   (President/Secretary/General/Officer), visibly AI when empty, takeable by a
   qualified human, splitting on a second arrival. SP-first (you take the Officer
   seat today); votes wait on accounts (#83). This is the big build, and the
   one that finally makes "the command" a system rather than a feeling.

---

## 9 · RECOMMENDATION — the single next thing to build

**Build the "YOUR COMMAND" panel + give the AI commander a voice (gap items #1
and #3), as one small slice.** It is a day or two of work, uses only data and
decisions that already exist, and it is the *exact* thing Robert says he never
sees: a screen that shows him the chain — his rung, and the AI seats above him,
named and tagged `[AI]` — plus in-match lines that say *"ENEMY COMMAND (AI)
committed a god."* It satisfies the LOCKED "visible as AI" law, converts the
hollow "MAY TAKE COMMAND" badge into a real door (the seat you'll later be able
to take), and — critically — it makes the command layer *perceptible* before we
spend weeks on the seat registry and the accounts backend behind it. Make command
**visible** first; make it **takeable** second.

*Everything here is checked against the build at commit `305e4ac`
(v0.9.0). Sources cited inline; the plan is `docs/GOVERNMENT.md` and issue #129.*
