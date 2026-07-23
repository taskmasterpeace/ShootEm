# FIVE FEATURES THAT WERE SKIN

> Robert, 2026-07-23: *"improve 5 features that only have surface stuff now,
> add lots of depth and gameplay teeth."*

Five systems existed, had UI, had documentation, and **did nothing**. Each one
is now load-bearing. They were chosen because they all serve the same canon law:

> *"Don't make the RPG stats the main progression. Knowledge, certifications,
> rank, relationships, and reputation ARE the progression. Stats help — but the
> most powerful feeling is earned responsibility."*
> — docs/THREE-GAMES-ONE-WAR.md, the closing law

| Feature | What it was | What it does now |
|---|---|---|
| **Certifications** | a codex label | refuses you the wheel |
| **The war chest** | a sentence describing itself | sets the opening manifest |
| **The hoverboard** | a hull with `speed: 24` | a trick economy you can lose |
| **Rank** | the word "Eligible" | the authority to call a god down |
| **Morale** | ≤3 materiel at spawn | a nerve that breaks, and shows |

---

## 1. CERTIFICATIONS — the gate that refuses

`licenceHeld()` was written when the register shipped and **nothing ever called
it**. `licenceFor()` was used in exactly one place: to print a label on a codex
card.

Now `World.mayDrive()` gates the **wheel** in `tryEnterVehicle`.

**You may always ride.** A soldier without the ticket is offered a bench
instead, and told what they'd need:

```
NOT CERTIFIED TO DRIVE — RIDING · TANK at Armour School
```

Only if there is no bench are they refused outright. You are not barred from
the truck; you are barred from *driving* the truck.

- **The chain, not the top rung.** Holding `tank` alone clears nothing — you
  need `basic_driver → heavy_truck → apc → tank`.
- **Absent papers mean ISSUED.** A body with no `papers` array drives anything,
  which is exactly right for a bot: the army trained it. Only the human, whose
  file the client hands over at spawn, can be told no.
- The personal decks (board, bike, scooter) need no paperwork — canon.

Papers ride in on `WorldOptions.papers` and are stamped onto the human print in
`addSoldier`, so the sim never reads storage.

## 2. THE WAR CHEST — a budget that restricts

`budgetMultiplier()` was called in exactly two places, both of which used it to
print a *description of itself* ("a lean manifest", "what is left in the shed").
It restricted nothing.

Now `WorldOptions.budget` scales the **opening materiel** — the pool that buys
requisitions and god-calls. Verified live: funding 0.8 opened the match at
**8 materiel against the enemy's 10**.

Clamped 4..14 at both ends: never starve a side out of the game, never let money
alone win it.

## 3. THE HOVERBOARD — "Tony Hawk meets Halo"

Nine verbs sat on the canon sheet — *wall ride · power slide · grind rails ·
drift · bunny hop · boost jump · reverse · air brake · trick off ramps* — and
none of them were in the game.

`src/sim/boardtricks.ts` is the economy, and the loop is the design:

```
do something difficult  →  COMBO builds
land it clean           →  the combo BANKS into BOOST
spend boost             →  more speed → bigger tricks
land it badly           →  you BAIL and the combo is gone
```

That last line is the whole point. **Tricks that pay out on take-off are free;
tricks that only pay when you land them are a game.**

- **Spin is just steering held in the air** — no trick buttons, so the board
  stays playable with one thumb. Runs are named the way people name them: 360,
  540, 900.
- **The landing window** is how well the nose agrees with the direction of
  travel. Inside it, the whole combo banks and the multiplier climbs (cap ×6).
  Outside it, you eat it and the chain resets.
- **Stepping off a kerb is not a bail** — a run with nothing banked can't fail.
- Wall rides and grinds come off `buildingAt()`; power slides read the real slip
  angle, so a lazy drift earns nothing and a full carve earns properly.
- The board is a `hover` hull and sits outside the wheeled landing physics
  entirely, so `stepBoard` gives it its own gravity.

Verified live: launched, spun, landed a **540** → 10 boost, ×2 multiplier.

## 4. RANK — earned responsibility

The GONET desk has printed `Promotion Board — Eligible` since the day it was
built, over an empty room.

Rank is **read** from service, never stored, so it can't drift out of step:

| Source | Worth |
|---|---|
| A certification | 30 |
| A decoration | 25 |
| A win | 15 |
| A track record | 10 |
| A skill band | 8 |
| A match fought | 5 |
| A kill | 1 |

A certification outweighs thirty kills. That ordering is the canon's, not a
balance guess.

What rank grants is **authority, never numbers**:

- **LIEUTENANT** may call the stable — spend the war's materiel on a god. Until
  now anyone could make the biggest call in the game. (The AI commander is
  ungated; it still calls for its side.)
- **CAPTAIN** may take the command seat.
- **Every rank from Corporal** has a `leadershipRadius` — men inside it hold
  their morale. That is what rank actually *does* in a firefight.

The board lives in YOUR FILE and shows the rank, what it grants, what the next
rung would grant, and both authorities as plain yes/no.

## 5. MORALE — a nerve that breaks

`moraleBoost` added at most three materiel at spawn and was never spoken of
again.

Now it moves during the fight, for reasons you can watch happen:

| Event | Shift |
|---|---|
| a friend drops nearby | −14, scaled by distance (26u) |
| you put someone down | +7 |
| revived | +12 |
| a decoration | +15 |
| alone | −0.9/s |
| a leader close by | +0.7/s |
| nothing happening | drifts back to 60 |

And it comes out in the hands: `handSpreadMul` = stance × morale × skill.
BROKEN opens the group ~18%, INSPIRED closes it ~7%, STEADY is exactly 1 — the
middle costs nothing and buys nothing, which is what makes the ends mean
something. Bots read it too: a shaken bot breaks contact sooner
(`doc.retreat × nerve`), so a losing side visibly starts to come apart.

The HUD chip only appears once morale **leaves** steady. A chip that is always
up is wallpaper.

## The quiet fifth-and-a-half: SECONDARY SKILLS

The canon roster of 22, levelled **through use** (`src/sim/skills.ts`). Landing
rounds with a rifle makes you better with rifles. Deliberately small: Master is
**+12%**, the bands run to 900 practice, and practice is capped so a long match
can't run the number away.

---

## Two traps paid for

**A god is not a soldier.** `tests/threat-measure` caught a Barrier that was
*practising* — sharpening its own aim off the squad sent to kill it, cutting
them down faster, and pushing its own time-to-kill past the T1 band. Then the
same thing via morale: it climbed to INSPIRED off its own kills and tightened
its group. Ascendants are now exempt from **both** practice and morale: a god's
threat is its card, and the whole threat table is measured against that card.

The fix was in the sim, not the harness — `tests/threat-measure.test.ts` is
**untouched** and its balance bands are unchanged.

**Approach from the nose.** W5.6 per-hatch entry seats a human by the hatch they
walked to, so a body standing behind a hull takes a bench whatever its papers
say. A gate test has to approach from the front or it proves nothing.
