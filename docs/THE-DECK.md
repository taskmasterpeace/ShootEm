# THE DECK — the handheld, the cartridges, and the arcade that does not exist yet
### Status: **PARTIAL** — one cartridge really plays; four are objects with no runtime; walk-up arcade cabinets are unbuilt. Verified against code 2026-07-23 (`f6a96bc`).

## 0 · FOR THE NEXT AI

Every soldier is issued a **DECK**: a scuffed ministry-olive handheld that plays **CARTRIDGES**. It is the only thing in a soldier's kit that is not for the war. It lives in the GONET laptop beside MUSIC and BROADCAST, because that is the part of the laptop that is not the war.

**The law, and it is the whole point — it is stated at the top of `cartridges.ts` and you must not break it:**

> **A SPORT MAKES YOU BETTER AT THE WAR. A CARTRIDGE DOES NOT.**

No cartridge grants a skill, a stat, a licence or a rank. Getting good at ORBIT RUN is worth *exactly nothing* on a battlefield — which is precisely why it works. It is the only activity in the game with no instrumental value, and that is what makes it **rest**.

**The files that ARE the feature:**
| File | What it owns |
|---|---|
| `src/client/gonet/cartridges.ts` | The shelf: registry, save data, high scores, provenance. Pure. |
| `src/client/gonet/cartridge-games.ts` | The `CartridgeGame` contract + the games themselves. Pure, no DOM. |
| `src/client/gonet/deck-player.ts` | The host: mounts a game in the console screen, RAF loop, input, teardown. |
| `src/client/gonet/index.ts` `deckApp()` (~line 322) | The footlocker + console-face UI. |
| `src/styles.css` (`.gn-console`, `.gn-screen2`, `.gn-playfield`) | The bezel, the tint channel, the scanlines. |

**The one thing to know before touching it:** the cartridge **runs inside the console screen** (`.gn-screen2`), not in a modal. That element already provides the bezel, the per-cartridge colour channel (`--ink`/`--base`) and a CRT scanline overlay. Mount into it and you get the period look for free.

---

## 1 · WHAT THE CODE DOES

### 1.1 The shelf (`cartridges.ts`) — ✅ BUILT
Five cartridges, each with title, maker, year, blurb, `scoreUnit`, a two-colour label (`ink`/`base` — this *is* the game's palette), and rarity.

| id | title | maker · year | scores in | rarity | runtime? |
|---|---|---|---|---|---|
| `orbit_run` | ORBIT RUN | Maklov Amusements · 2196 | POINTS | common | ✅ **plays** |
| `deep_shaft` | DEEP SHAFT | Kuchler Home · 2201 | METRES | common | ⬜ |
| `harvest_88` | HARVEST 88 | Green March Software · 2188 | TONNES | uncommon | ⬜ |
| `siege_tower` | SIEGE TOWER | Maklov Amusements · 2199 | FLOORS | common | ⬜ |
| `nightwatch` | NIGHTWATCH | Odessa Grey Interactive · 2207 | HOURS | rare | ⬜ |

`ISSUED = ['orbit_run', 'siege_tower']` — the Deck ships with two; everything else must be found.

**Save data** (`DeckSave`, key `ww.deck.v1`): `owned` (id → provenance), `best` (id → score), `sessions`, `inSlot`. `loadDeck()` is genuinely defensive — bad JSON, unknown ids and a dangling `inSlot` all self-heal.

### 1.2 The runtime — ✅ BUILT (one game)
`cartridge-games.ts` defines the contract every cartridge implements:

```ts
interface CartridgeGame {
  step(dt, input): void;      // advance a frame
  draw(ctx): void;            // one colour, no shading
  readonly score: number;     // goes on the high-score table
  readonly over: boolean;     // host files the score
  readonly hint: string;      // the line under the screen
}
```

**The hardware is the period constraint** — `SCREEN_W = 160`, `SCREEN_H = 96`, scaled up with smoothing off. House rules, enforced by convention:
- **One colour.** Every game draws in its cartridge's own ink on its own base. The label *is* the palette.
- **A low grid.** A pixel is a chunky square you can count.
- **No easing.** Whole steps at a fixed rate.
- **The CRT is the screen's, not ours** — `.gn-screen2::after` lays the scanlines.

**ORBIT RUN** is the one implemented game: thread a scrolling rock belt, gaps that do not line up, speed that climbs and never stops climbing (`speed = 44 + t * 3.2`). It uses **its own seeded noise**, never the match RNG, so a cabinet can never perturb a replay.

### 1.3 The host (`deck-player.ts`) — ✅ BUILT
`playInScreen(screen, cart, prevBest, onEnd)` mounts a 160×96 canvas into the console screen and runs it: a **warm-up frame** (maker · year, a filling bar — what a handheld does before it shows you anything), then the game, then GAME OVER with the score and **NEW BEST** announced *on the screen* where you are already looking. Keyboard (arrows/WASD + space/enter) **and gamepad** (sticks, d-pad, button 0). Square-wave blips via a throwaway `AudioContext` honouring `settings.masterVolume` — deliberately *not* in `SOUND_NAMES`, because `audio.ts` is sample-based and a cabinet bleep is not a sample.

Full teardown on stop; `paint()` in `gonet/index.ts` kills any live session first, so a repaint can never orphan a canvas and its RAF loop.

### 1.4 The loop that closes — ✅ BUILT
A finished run calls `fileScore(save, id, score)` → `saveDeck` → `paint()`. `fileScore` owns the session count *and* the personal best, and refuses NaN (which sails past `<=` and would enshrine itself as an unbeatable best), Infinity, negatives, and unknown cartridges.

### 1.5 What is NOT built
| Gap | Detail |
|---|---|
| ⬜ **4 of 5 cartridges have no runtime** | The shelf says so honestly: `NO RUNTIME YET`. |
| ⬜ **Walk-up ARCADE cabinets** | No cabinet entity, no proximity-E machine anywhere in the world. |
| ⬜ **`acquire()` has zero callers** | FOUND / TRADED / AWARDED do not exist. Every player is stuck with the 2 ISSUED cartridges; the other three read `FOUND IN WRECKS` and cannot be. |
| ⬜ **`DECK_MORALE = 6` is never credited** | See §3. The UI says `PAYS +6 MORALE`; nothing pays it. |
| ⬜ **No cooldown** | The fiction says a session is "twenty minutes"; a session is one click. |

---

## 2 · WHAT WE ARE AIMING AT

Robert, on the origin: *"I wanna add games that's not a sport game. A game that don't increase your skill — you get good at it, it won't make you better at this. Imagine little Atari-type video game systems, a mock video game system inside of this, with different cartridges."*

Robert, on the split (this is the important one, and it is two different features):
- **PORTABLE GAMES** — *"things you play inside the OS/laptop"*. The Deck. This is what exists.
- **ARCADE GAMES** — *"walk-up consoles in the world: you approach one, a UI pops up, and you're actually playing a video game."* Reference feel: **"Drive-N-Shoot / Divided States of America."** This does not exist at all. (Note: that title appears nowhere in the codebase — it is a reference, not a thing we have.)

Robert, on the job: *"take the cartridge system and OVERHAUL + POLISH it — the games are already cleared; make them feel good."*

The in-world reason, from the design header: a print deploys for months, and the ministry worked out — expensively — that *a body that never stops being a soldier stops being a good one*. The Deck is a morale device with a requisition number. **The army issues you a toy because the army did the maths.**

Acquisition is meant to be a story, never a shop: **ISSUED** (two with the Deck) · **FOUND** (in wrecks, footlockers, dead men's kits) · **TRADED** (doubles — the most social object in the game) · **AWARDED** (a decoration nobody at the ministry thinks is a decoration).

---

## 3 · THE GAP, RANKED

1. **The morale promise is not paid.** Two surfaces claim it (the `PAYS +6 MORALE` chip and, formerly, the play alert). Nothing credits it. *This is the single dishonest thing left in the feature.*
2. **Acquisition does not exist.** `acquire()` has no callers, so 60% of the shelf is permanently unobtainable and the lore panel advertises three routes that are all closed.
3. **One game is not a games console.** ORBIT RUN proves the contract; a second title proves it is a *system*.
4. **No arcade cabinets.** The whole second half of Robert's design — the walk-up, the "UI pops up and you're playing" — is unstarted.
5. **No cooldown / session meaning.** A twenty-minute session costs one keypress.

---

## 4 · OPEN QUESTIONS

1. **How should the morale credit work?** The mechanism exists — `dossier.soldier.morale` persists and reaches the sim as `moraleBoost` (opening materiel, capped at 3). But +6 per click is farmable in one press. **My proposal: credit it once per deployment** (a `credit` flag on `DeckSave`, consumed at deploy and cleared) — un-grindable, honest, and the law stays intact because it is still not a skill. *This is a balance call and it is Robert's.*
2. **Do cartridges stay collectibles, or does every one become playable?** If collectibles: drop the morale promise and make them pure found-objects/trade-bait. If playable: each needs a runtime, and the contract already supports it.
3. **Where do FOUND cartridges come from?** The natural hook is a post-match wreck/loot roll weighted by the unused `rarity` field. Needs a decision on whether looting exists as a general system or just for this.
4. **Are the arcade cabinets the same games as the cartridges, or a separate set?** The contract can serve both. A cabinet is "the same game, a bigger screen, three lives and a coin".

---

## 5 · MY RECOMMENDATION

**Pay the morale debt first — it is the cheapest honesty in the codebase.** Wire the once-per-deployment credit (§4.1) or delete the `PAYS` chip. Right now the Deck advertises a reward it never grants, and that is the kind of thing that quietly teaches a player not to trust any of our UI.

**Then build the second cartridge, and pick SIEGE TOWER.** "Stack it higher. It is going to fall. Stack it higher." is one entity, one axis, one timing window — the same size of build as ORBIT RUN, and it is the *other* arcade verb (precision under mounting pressure, versus ORBIT RUN's evasion). Two games with genuinely different verbs is what makes the Deck read as a console rather than a tech demo.

**Then wire `acquire()` to a single source** — a post-match wreck roll. It is a handful of lines and it switches on the entire provenance system that is already written and sitting idle: the "found in a dead man's kit" story, doubles, trading.

**On the arcade cabinets: do them after, and reuse the contract.** A walk-up cabinet is the same `CartridgeGame` in a world-space popup with a coin-op framing (three lives, a per-map high-score board). Do not write a second games system — that is the trap, and the contract was deliberately shaped to prevent it.

**What I would not do:** implement all five cartridges before any of them pays out or can be found. The shelf's problem was never quantity — it was that nothing it promised was true.

---

## 6 · TRAPS

- **`fileScore()` owns the session count.** Do not also `sessions++` by hand — `main.ts` used to, which is why the two halves drifted.
- **`paint()` destroys the canvas.** Any repaint (app switch, ESC, a save) blows away `root.innerHTML`. `paint()` stops the live deck session first; if you add another repaint path, it must go through `paint()`.
- **Ownership is not the `disabled` attribute.** The shelf renders unowned cartridges `disabled`, but the handlers now check `owns(d, id)` — trust the locker, not the markup.
- **Do not add cabinet bleeps to `SOUND_NAMES`.** `audio.ts` is sample-based and preloads by prefix; the Deck uses a throwaway oscillator on purpose.
- **Never use the match RNG in a cartridge.** ORBIT RUN carries its own LCG. A cabinet that draws from the sim stream would desync a replay.
- **The law is load-bearing.** If you find yourself granting XP, a skill, or a stat for a cartridge score, you have broken the one rule that makes this feature mean anything.

---

*Verified against `main` at `f6a96bc`, 2026-07-23. The coach-feature panel that graded the pre-fix version F/F/D/D/D+ is summarised in the commit message.*
