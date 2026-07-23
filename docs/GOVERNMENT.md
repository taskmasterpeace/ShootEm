# THE GOVERNMENT — one layer, three seats of power
### Robert, 2026-07-23: "We need the government… figure out how that's gonna be both for single player, multiplayer — and I'm the developer, so I need to develop it. We need to figure it all out." This is the figuring.

## What a government IS (the data already exists)
A government = a **nations.ts row** (the COF spreadsheet: government form, leader title,
president, faction lean, military/intel/science scores, cloning & LSW policy) **plus three
live pieces of state**:
- **THE TREASURY** — the war chest. Fed by match outcomes (money law, LOCKED: *"you either
  gotta win or you gotta lose"* — decisive results, real payouts). `warLedger` already bills
  hull losses; the treasury is its other half.
- **THE DOCTRINE** — how the money leans: the officer's Doctrine Package (Armor Spearhead /
  Air Superiority / Infantry Surge / Spec Ops) writ national.
- **THE SEATS** — President → **Secretary of War** → General (per front) → Officer → squad.
  A seat is either a HUMAN or a **visible AI** (LOCKED: the player must always KNOW command
  is AI-held and that they can take it).

## SINGLE PLAYER — the government is the war's weather
The player never "plays" the government; they FEEL it:
1. **The ministry pays and the ministry asks.** Missions arrive as mail from YOUR government
   (chat.deliverMail exists); briefs carry the nation's voice and its stats — a high-science
   nation sends lab work, a manpower nation sends fronts.
2. **Budgets are real.** Each front carries a funding split (military/science/civic) set by
   the AI Secretary; the split caps requisition (vehicles/gods) on that front. Lose matches →
   the treasury bleeds → leaner manifests. Win → richer drops. The war chest is the difficulty.
3. **The government provides** (his words): kit grants, the truck behind its tech gate,
   nation-tinted equipment tables.

## MULTIPLAYER — the seats are the endgame
1. **Empty seats are AI, always visible as AI.** Any qualified human can TAKE a seat;
   another human arriving splits command (the shipped take-over law generalized).
2. **The vote of confidence** (LOCKED) seats and unseats: the vote weighs the candidate's
   war-effort record (the ledger is the résumé).
3. **The Secretary of War** shapes the economy between matches — funding priorities,
   factories, doctrine (the pitch doc is the spec seed: docs/SECRETARY-OF-WAR-PITCHES.md).
4. **Leadership is the LEADERSHIP stat's home**: seat eligibility keys off rank +
   certifications + the hidden record (fronts served, decorations) — responsibilities, not
   numbers (the closing law of THREE-GAMES-ONE-WAR).

## THE DEVELOPER'S DESK — Robert develops it live
The Admin Room (#90) grows a **GOVERNMENT DESK** tab:
- edit any treasury/doctrine/seat inline; force a budget cycle; call a vote; seat/unseat anyone
- impersonate any seat (send a ministry mail, set a front's split, sign a doctrine)
- one JSON export/import per government so a session's tuning survives
- the gen-nations.mjs pipeline (D:/git/COF CSVs) stays the single data door — the desk edits
  RUNTIME state, never the spreadsheet truth

## Build order (each lands alone)
- **G1 THE TREASURY** — per-faction chest fed by match outcomes through warLedger; visible on
  the scoreboard tail + war room. *(sim + docs, no new UI)*
- **G2 THE SPLIT** — front funding splits cap requisition; AI Secretary drifts splits toward
  losses (rubber-band, visible in the brief). *(sim)*
- **G3 THE MINISTRY** — mission mail carries the government's letterhead: nation name, leader
  title, stat-tinted flavor; the newspaper quotes it. *(client, uses existing mail)*
- **G4 THE SEATS** — seat registry + visible-AI badges + take-over; vote of confidence
  (MP-gated, but the registry runs in SP so the player can take the officer seat today).
- **G5 THE DESK** — the Admin Room tab (Robert's develop-it surface).

*Sources of truth: docs/THREE-GAMES-ONE-WAR.md (chain, votes, AI-visible law, money law),
docs/META-LAYER.md §2/§6 (buildings, budgets), docs/SECRETARY-OF-WAR-PITCHES.md,
src/data/nations.ts (the COF governments — never invent faction names).*
