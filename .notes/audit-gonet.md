# MASTER AUDIT — THE GONET · ARCADE/CARTRIDGE · SPORTS · WORLD-VOICE

Audited from code on branch `main`, 2026-07-23. Every claim below is grounded in a
file:line. Status legend:

- ✅ **WIRED** — functional and reachable in normal play.
- 🟡 **PARTIAL** — works, but a named piece is missing or stubbed.
- 👻 **INVISIBLE** — the code exists and is correct, but nothing in the game
  actually *triggers* or *renders* it, so a player never sees it.
- ⬜ **UNBUILT** — declared in data/types only; no implementation behind it.

Cross-cutting fact worth stating once: **the entire GONET is `localStorage` +
derived-from-real-state UI.** There is no server, no save file beyond browser
storage. Everything the laptop shows is computed from four real stores (identity,
licences, records/`ww_press`, treasury) plus mission/skill data tables. That is a
strength — nothing is faked — but it also means every "app" is a *reader*, and the
few things that should *write* game state (deck morale) mostly don't.

---

## 1. THE SHELL — `src/client/gonet/index.ts` (38 KB, the whole front door)

**Status: ✅ WIRED.** This replaced the main menu (`renderLegacyMenu()` in
frontend.ts is dead, kept as documentation — THE-GONET.md).

- **What it does.** Renders a faux-OS: a header (`chrome()`, index.ts:123) with
  greeting + callsign + flag + faction + the one-clock readout; a tab bar of 8
  apps; a body that swaps per app (`bodyFor`, :159); and an always-mounted corner
  music player (`corner()`, :608). Keyboard: **1–8 walk the apps, ESC → desk**
  (:100–114). Host contract (`GonetHost`, :52) hands off to the real game:
  `deploy`, `launchBrief`, `enterSport`, `playCartridge`, `options`, `reenlist`.
- **App tabs** (index.ts:131): DESK, BRIEFINGS, SPORTS, MAIL, BROADCAST, MUSIC,
  THE DECK, YOUR FILE. Note the tab bar (8) and the desk tile grid (:219) diverge
  slightly — the desk grid also surfaces THE YARD (paintball) and a disabled
  **MULTIPLAYER "COMING SOON"** tile (:229, the only overt stub in the shell).
- **What remains.** The transcript's promised "friends", "marketplace", "war map",
  "promotion board" as *apps* never became tabs — they were folded into YOUR FILE
  and the desk status rows instead. MULTIPLAYER is the one visible dead tile.

---

## 2. THE APPS (each tab)

### 2.1 DESK / WORLD STATUS — `desk()` index.ts:171 — ✅ WIRED
The status board. **Every row is derived, none invented** (:186 comment documents
the de-mocking): Front standing read off the last press issue; "The light" =
`phaseName()` of the world clock; Military/Science counts = real mission-roster
lengths (7 and 5, via `missionCounts()`); unread mail; rank + promotion-board
"service to next"; certifications held / total; next open training; garage machine
count (`loadFits()`); war chest balance + W-L. Tiles below launch DEPLOY (skirmish),
THE YARD (paintball), and the apps.
- **Remains:** nothing structural — it is the most honest surface in the game.

### 2.2 BRIEFINGS — `briefingsApp()` index.ts:387 + `briefings.ts` — ✅ WIRED
The best-realized app after the desk. `allBriefs()` (briefings.ts:74) turns the 7
`MILITARY_MISSIONS` and 5 `SCIENCE_PRESETS` into briefs with theatre, tagline,
objective phases, tags, and an **issued-hull manifest that checks your licences**
(`hullFor` → `licenceHeld`, :57). `readiness()` (:124) gives the honest verdict:
you may still take a mission you can't drive the hull for — "you may ride; somebody
else drives." DEPLOY-ON-BRIEF calls `host.launchBrief` → `main.ts:2418`, which
routes into the *same* `startGame()` path as the deploy screen (not a second
config path). MILITARY/SCIENCE filter toggle works.
- **Remains:** science briefs have a canned 2-phase chain ("VERB the objective /
  Extract", :100) because presets don't carry a real phase list; military ones do.

### 2.3 SPORTS — `sportsApp()` index.ts:251 + `sports.ts` — 🟡 PARTIAL (see §5)

### 2.4 MAIL — `mailApp()` index.ts:443 + `mail.ts` — ✅ WIRED
A real inbox with read-state persistence (`ww.mail.v1`), unread badge, mark-all-read,
and per-message CTAs that jump to other apps. **Every message is derived** (mail.ts):
the ministry funding notice quotes the actual treasury balance + budget band; the
motor-pool letter names your next uncertified licence; the board letter cites your
fastest filed lap; a hometown civic notice (if `id.hometown`); the squad-waiting
note; and the psych desk quotes your temperament back at you. CTAs route via
`[data-cta]` (index.ts:711).
- **Remains:** the roster is fixed (~6 messages); no threading, no compose/reply,
  no time-based new mail. "Friends"/social from the transcript never landed here.

### 2.5 BROADCAST — `videoApp()` index.ts:484 + `broadcast.ts` — ✅ WIRED
A genuinely clever "TV with no video." A **reel** is an ordered list of timed
graphic *shots*; a real transport (play/pause/seek/next, 250 ms clock
`startVideoClock` :540, autoplay to next segment :532) plays them as broadcast
lower-thirds. Three channels: **WAR DESK** (one reel per press issue — battles cut
into duel/money/field/decoration shots, races cut as sports segments), **HOME
SERVICE** (your file + board + certs read back), **TRAINING FILMS** (one reel per
licence school, teaching the actual covers). Content comes off `loadPress()`,
`allRecords()`, licences — reports what you actually did. Falls back to a standing
"desk is quiet" bulletin with zero press.
- **Remains:** graphics only, by design. No highlight-clip playback of real match
  moments (the killcam/ReplayDirector exists elsewhere but isn't piped here).

### 2.6 MUSIC — `musicApp()` index.ts:548 + `library.ts` + `player.ts` — ✅ WIRED (see §4)

### 2.7 THE DECK (cartridges) — `deckApp()` index.ts:320 + `cartridges.ts` — 🟡 PARTIAL (see §6)

### 2.8 YOUR FILE — index.ts:166 — ✅ WIRED (delegated)
Reuses `renderServiceFile()` unchanged (papers, the board, the chest, the garage).
Out of this audit's slice; it renders and is reachable.

---

## 3. SUPPORTING SYSTEMS

### 3.1 THE ONE CLOCK — `src/client/worldclock.ts` — ✅ WIRED
(File is `client/worldclock.ts`, not `sim/`.) Two-half clock: a **world clock**
derived from real UTC at 1 game-day / 2 real-hours (`GAME_DAY_MS`, :33) so every
client agrees with no server; and a **field clock** off `world.time` in a match.
`clockForField()` (:206) makes the corner chip read *the world you stand in*, and
returns `field:false` where there is no clock (yard/shop/threat → "NO CLOCK").
Full **`TimeControl`** (:75): scrub (`scrubToHour`), rate (`setRate`, re-anchored so
rate changes don't teleport), freeze/unfreeze, nudge — persisted to `ww_time_control`,
driven by the admin room today. The epsilon-at-whole-hours bug is fixed and
commented (:47). `phaseName()` (:221) gives the light in words. GONET reads it via
`gameNow()` in the header and desk.
- **Remains:** the government-facing control ("the government turns these knobs
  later") is not built; only the admin room drives it.

### 3.2 THE PRESS — `src/client/newspaper.ts` — ✅ WIRED
The Front Courier. Every finished battle/race/science op files a `PressIssue`
(data, never HTML) into `ww_press`, KEEP=12 (:76). `renderIssueHTML` prints a
masthead + hash-stable headline + THREE derived columns (duel/ledger/field, or the
science variant) + a **corrections desk** that retracts something true about the
*previous* issue (:187). A race files `RacePressData` (:27), so the circuit lives
in the same paper as the war — this is the load-bearing tie between SPORTS and the
news, and between the news and BROADCAST (broadcast.ts reads `loadPress()`).
- **Remains:** nothing broken; it is a finished subsystem. Note only the *local
  player's* battles file issues (no world-wide wire service).

---

## 4. MUSIC & HEADPHONES — does the library actually play on the field?

**YES. This is fully wired end to end.** The single most-asked question, answered
in code:

- **`library.ts`** ✅ — pure state: 9 real tracks (`/audio/music/*.mp3`, the score's
  3 tiers relabeled as in-world artists), playlists over them, `favourites`,
  shuffle/repeat, learned durations. Exactly one playlist is **THE FIELD**
  (`fieldPlaylistId`, default `FIELD_ID`), self-healing built-ins so the field is
  never left with nothing. All ops pure + unit-testable (`nextIndex` shuffle
  guard, etc.).
- **`player.ts` — `MusicPlayer` / `musicDeck()` singleton** ✅ — one HTMLAudio deck
  the whole client shares (streams ~29 MB, never decoded to buffers). `toField()`
  (:146) swaps the queue to the field playlist **and keeps the current song
  playing if it's in the field kit** (no restart on headphone-on). `setFieldDuck`
  lets a big moment duck your music.
- **`headphones.ts` — `Headphones`** ✅ — `wear()` stops the war's `MusicDirector`
  score, cuts the world bus by `HEADPHONE_WORLD_CUT = 0.55`, calls `deck.toField()`
  + `deck.play()`. The trade (you get music, you lose your ears) is real.
- **The H key** ✅ — `main.ts:672–685`: H toggles `cansRef.toggle()` **only in a
  match**, shows the `cans-chip` HUD. The corner player (`corner()`) and the field
  headphones are provably **the same deck** (`musicDeck()` singleton) — a song
  queued at the laptop is the song still playing when you put the cans on.
  `main.ts:1420`: `if (!cans.on) music.update(...)` — the war score yields while
  the cans are on, exactly as designed.

**Verdict:** the "music library plays on the field through H" promise is 100% real.
The only friction: the library is 9 fixed score tracks (no user import), and volume
is the only mixer control.

---

## 5. SPORTS — is the racing league real, or a display?

**Status: 🟡 PARTIAL — real institution, but only 3 of 5 disciplines run, and the
"season/standings" are thin.** `sports.ts` + `sportsApp()` index.ts:251.

**Real:**
- **Disciplines** (`SPORTS`, sports.ts:53): CIRCUIT, TIME ATTACK, DEMOLITION are
  `live:true`; GUN RUN and FREESTYLE are `live:false` and the board honestly says
  **PLANNED** rather than lying (index.ts:262, :305). Each has a strap, real
  **rules** text, the **skills it trains** (`trains`, resolved through `SKILLS`),
  and machine classes.
- **The modes are real.** `enterSport(mode)` → `main.ts:2443` → `startGame()`;
  `race`/`timetrial`/`derby` are genuine `ModeId`s with implementations
  (`sim/modes.ts:106–166`, `stepRace`/`stepDerby`). So a discipline is a real way
  *into* a running mode, not a poster.
- **Standings are derived** (`standings()`, sports.ts:165): read straight off the
  record board (`allRecords()`) — who holds how many boards + best lap. Ties into
  MAIL (board letter) and BROADCAST (sports segment) and the newspaper
  (`RacePressData`). The circuit genuinely lives across the whole GONET.
- **Fixtures** (`fixtures()`, :141): a 5-item "this week" list, **deterministic
  from the game day** (same no-server trick as the clock), cycling live sports ×
  built track names.

**Not real / thin:**
- There is **no season structure** — no points table, no championship, no rounds,
  no persistence of *results* (only lap *records* persist). "Standings" = a
  record-count leaderboard, not a league table. `Standing.records` is the only
  "currency."
- Fixtures are a rotation, not a schedule you can enter *on that day/venue* — the
  ENTER button just drops you into the mode generically; venue/class from the
  fixture are not passed through (`enterSport` takes only `mode`).
- GUN RUN + FREESTYLE are ⬜ UNBUILT (declared, `live:false`).
- The TRACK BUILDER button (index.ts:308, `data-act="builder"`) — wiring not in
  this file's `[data-act]` handler (index.ts:640); appears to be handled elsewhere
  or dangling. **Open question flagged below.**

---

## 6. THE CARTRIDGE / ARCADE SYSTEM — playable games, or a shell?

**Status: 🟡 PARTIAL, leaning SHELL. There are NO playable portable games and NO
walk-up arcade cabinets in the world.** `cartridges.ts` + `deckApp()` index.ts:320.

**What exists (and is nicely made):**
- A **footlocker/shelf UI**: 5 cartridges (`CARTRIDGES`, cartridges.ts:79) with
  title/maker/year/blurb/score-unit/rarity/2-colour label, an in-fiction 2188–2207
  arcade-industry voice. A mock console face renders the slotted cartridge with a
  bad little screen (index.ts:354, `.gn-console` CSS at styles.css:2842).
- Real **save data** (`DeckSave`, `ww.deck.v1`): owned + provenance
  (issued/found/traded/awarded), per-cartridge best, session count, in-slot.
  `fileScore`/`acquire` are implemented and correct.

**What does NOT exist:**
- **No actual game.** `playCartridge()` (`main.ts:2452`) increments `sessions`,
  sets `inSlot`, and shows an **`alert()`** with the blurb + "+6 morale on your
  next deployment." There is **no minigame canvas, no loop, no interaction** —
  switching a cartridge "on" is a text pop-up.
- **The morale payout is unwired.** `DECK_MORALE = 6` is referenced *only* in that
  alert string (`main.ts:2461`). Nothing reads `DECK_MORALE` or `d.sessions` to
  grant morale — `sim/morale.ts` is per-Soldier *in-match* morale
  (`moraleOf(s)`), with no persistent player-morale store the deck writes to. **The
  promise "the only thing that pays MORALE" is currently a lie in the UI.**
- **No walk-up arcade consoles in the world.** Grep for arcade/console/cabinet
  turns up only: the STABLE console (officer command UI, `client/stable.ts`),
  building-generator's "arcade" *facade* family (architecture, not a cabinet),
  and Vanessa's paintball walk-up booths. No cartridge cabinet entity, no
  proximity-E arcade machine.
- **"drive-n-shoot / divided states of america": does not exist anywhere.** Zero
  references in `src/` or `docs/`. It is a concept from your prompt, not in code —
  the 5 shipped cartridges are ORBIT RUN, DEEP SHAFT, HARVEST 88, SIEGE TOWER,
  NIGHTWATCH (all flavour text, no code).

**Verdict:** the Deck is a beautifully-dressed **display case with a save file**.
The cartridges are objects-to-own, not games-to-play. To become real it needs (a)
at least one actual playable cartridge loop, and (b) the morale write it already
advertises.

---

## 7. STREET VO — the world's voice

Three files, all pure/read-only so they can't perturb a replay.

### 7.1 `sim/culture.ts` — ✅ WIRED (data)
14 culture codes (1–14, no 7) reverse-engineered from `map-cities.json`: region,
tongues, anchor countries, street demeanour. `cultureFor`/`cultureSlug` always
resolve (neutral fallback so nowhere is mute). Already consumed by architecture
(`city-profile.ts`) and now by VO.

### 7.2 `client/streetvo.ts` — 🟡 PARTIAL (catalogue)
The **text catalogue + deterministic picker**. 10 events (idle/gunfire/flee/god/
reckless/wounded = pedestrian; challenge/warn/engage/triumph = vigilante), 2 lines
each, for **12 of 14 cultures** (codes 4 The Steppe and 7 are absent from `LINES`).
`pickStreetLine` (:242) returns `{slot, text, culture}` so text shows even with no
audio; `hash01`-seeded so a bark never draws from the rng stream. `streetManifest()`
(:221) is the generator's to-do list.

### 7.3 `client/streetvoice.ts` — 👻 INVISIBLE (mostly) — the player
The runtime. Instantiated (`main.ts:1055`) and ticked every frame
(`street.update(world, world.time)`, main.ts:1422). **But look at what actually
fires:**
- ✅ **gunfire** — `update()` scans civilian *vehicles* (`v.civilianDrive`), and
  when one first panics within `EARSHOT=55`, speaks a `gunfire` line (throttled
  `COOLDOWN=2.6s`). This is the only routinely-firing street voice.
- ✅ **god** — `onGod()` fires on the `lsw_active` event (main.ts:1423) if a
  civilian is near. Works.
- 👻 **vigilante (`challenge/warn/engage/triumph`)** — `StreetVoice.vigilante()`
  exists (:81) but **has ZERO callers** (`grep '\.vigilante(' src/` → nothing).
  STREET-VO.md claims the barks are "reachable"; they are reachable as a *method*
  but no game system invokes them. **Dead until wired.**
- 👻 **idle / flee / reckless / wounded** — in the catalogue, **never triggered by
  any code path.** No idle chatter, no "you nearly ran me over," no crossfire cry.

**The pedestrian/vigilante entity question, answered:** there is **NO
walking-pedestrian entity and NO vigilante entity.** The "pedestrian" is literally
a **civilian vehicle** with a `civilianDrive` (`sim/traffic.ts`) — a fleeing car
with a voice. STREET-VO.md admits this: *"there is no walking-pedestrian entity yet
— the traffic layer models civilians as vehicles."* So the vigilante ("the
pedestrian who does NOT run") has no body to inhabit.

**Audio coverage:** 36 files = **6 cultures × 3 events × (ogg+wav)**. Voiced
cultures: West Africa (2), East Asia (6), Central America & Caribbean (8), Eastern
Europe (10), Jamaica (13), The Middle East (14). Voiced events: **gunfire, god,
challenge** only. So even for a voiced city, `challenge` audio is unreachable
(no vigilante caller), leaving **gunfire + god as the only VO a player ever
actually hears.** The barked *text* still surfaces (`world.emit({type:'bark',…})`,
streetvoice.ts:95) for every culture in the catalogue.

---

## TOP 5 GAPS in the GONET / arcade / sports

1. **The Deck has no game and pays no morale.** `playCartridge` is an `alert()`;
   `DECK_MORALE` is never consumed (`main.ts:2461` is its only use). The one system
   in the game explicitly meant to pay morale, doesn't. Highest-impact, because the
   UI actively promises a reward it never grants. Fix = one playable cartridge loop
   + a persistent-morale write on session end.

2. **The vigilante is a voice with no body — and no caller.** `StreetVoice.
   vigilante()` is dead code (0 callers); there is no pedestrian/vigilante entity,
   only civilian cars. The whole "do bad things and the street turns on you" lore
   seed is unbuilt. `challenge/warn/engage/triumph` audio exists for 6 cultures and
   can never play.

3. **Street VO is 2 events deep.** Of 10 catalogued events only **gunfire + god**
   ever fire; idle/flee/reckless/wounded have text but no trigger. The street feels
   alive only during a firefight or an Ascendant walk. `reckless` in particular is
   low-hanging fruit — the traffic layer already knows when you nearly hit a
   civilian.

4. **SPORTS has disciplines but no season.** Standings are a record-count
   leaderboard, not a league table; fixtures are a deterministic *rotation* whose
   venue/class don't pass through to the launched match; no points, no
   championship, no result persistence. Two of five disciplines (Gun Run,
   Freestyle) are unbuilt. It's an institution's *shell* around real modes.

5. **Promised GONET apps never became apps; MULTIPLAYER is a dead tile.** The
   transcript's friends / marketplace / war-map / promotion-board are absent or
   folded away, and the desk grid ships a disabled "MULTIPLAYER — COMING SOON"
   tile (index.ts:229). Also: the SPORTS **Track Builder** button (index.ts:308)
   has no handler in this module's wiring — verify it isn't dangling.

---

## OPEN DESIGN QUESTIONS (real forks, not clean-ups)

- **Does a cartridge become a real minigame, or stay a collectible object?** The
  design doc leans "the games are Robert's — this file is the shelf." If they stay
  collectibles, the honest move is to *drop the morale promise* and make them pure
  found-objects/trade-bait. If they become real, you need an in-Deck canvas and a
  score→`fileScore`→morale pipe. This is the biggest unresolved fork.

- **Where does persistent player morale live?** `sim/morale.ts` is per-soldier,
  per-match. The Deck, the newspaper's morale figures, and "morale on your next
  deployment" all imply a *persistent* morale store that doesn't exist. Deciding
  this unblocks gaps #1 and much of the meta layer.

- **Do civilians ever get out of the car?** Every street-VO ambition
  (vigilante, walking pedestrians, "a neighbour with a bat") is blocked on there
  being no pedestrian entity. Either commit to a foot-civilian entity, or re-scope
  street VO permanently around vehicles (which caps it at gunfire/god/reckless).

- **Is SPORTS a league or a launcher?** If a league: build points, a season
  calendar, and pass fixture venue/class into `enterSport`. If a launcher: stop
  showing standings/fixtures as if they mean more than "here are the modes."

- **Should BROADCAST/press stay single-player-local?** Only your own battles file
  issues and reels. For a world that "generates its own news," a shared wire
  service (other players'/AI fronts filing issues) is the obvious next scope.
