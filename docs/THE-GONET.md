# THE GONET — the laptop that replaced the main menu

> THREE-GAMES-ONE-WAR §"The GONET laptop (menus become the world)":
> *"Boot into the operations network, not a menu: world status, briefings,
> messages, friends, certifications, print hangar, war map, marketplace, news,
> promotion board. **The laptop is home; 'logging in' replaces 'main menu'.**"*

> Robert, 2026-07-23: *"find the laptop vision we discussed previously for the
> interface — overhaul this and create that vision. Email. Video. Music player
> (corner), where you manage your music library. Songs from the music library
> are played in the game on the field when you put on headphones."*

The button stack is gone. You log into a machine.

---

## 1. The shape

```
┌────────────────────────────────────────────────────────────┐
│ GONET  OPERATIONS NETWORK   GOOD EVENING, SMITH  🇺🇸  D271 · 00:25 │
├────────────────────────────────────────────────────────────┤
│ DESK │ MAIL ④ │ BROADCAST │ MUSIC │ YOUR FILE │      OPTIONS │
├──────────────────┬─────────────────────────────────────────┤
│ WORLD STATUS     │ THE NETWORK                             │
│  Front   LOSING  │  [DEPLOY] [THE YARD] [MAIL] [BROADCAST] │
│  Mail    4 UNREAD│  [MUSIC]  [YOUR FILE] [MULTIPLAYER]     │
│  …               │                          ┌────────────┐ │
│                  │                          │ ♫ corner   │ │
└──────────────────┴──────────────────────────┴────────────┘ │
```

The status board is the transcript's mock, **filled with real figures**: the
front's standing off the last press issue, unread mail, certifications held,
the war chest and your W–L, the squad, the factory, the promotion board, and a
news line naming the actual last battle.

`src/client/gonet/index.ts` owns the shell. The old menu survives in
`frontend.ts` as `renderLegacyMenu()` — nothing calls it; it documents what
this replaced.

---

## 2. MAIL — it reports, it never invents

`src/client/gonet/mail.ts`. Every message is derived from account state:

| From | Derived from |
|---|---|
| MINISTRY OF WAR | the treasury — balance, W–L, the actual last payout reason, and what your funding band lets you draw |
| MOTOR POOL · TRAINING COMMAND | the licence register — names the *next paper you do not hold* and the school that teaches it |
| THE BOARD · CIRCUIT OFFICE | your filed lap times, or an honest "every track is open" |
| YOUR HOMETOWN · CIVIC NOTICE | the hometown from personnel intake |
| YOUR SQUAD | the mock's "2 Waiting" |
| PSYCHOLOGICAL SERVICES | the temperament the psych desk stamped at intake |

Read/unread persists. Messages can carry one action (`OPEN THE FILE ▸`,
`DEPLOY ▸`) that jumps to the app that answers them.

---

## 3. BROADCAST — a real transport, no fake footage

`src/client/gonet/broadcast.ts`. There is no video file in this game and there
should not be one: pre-rendered footage would show a war that never happened.

A broadcast is a **reel** — an ordered set of timed *shots* played on a real
transport (play/pause, seek, prev/next, autoplay into the next segment) and
drawn as broadcast graphics with a slug, a figure, a headline and a ticker.

Three channels:
- **WAR DESK** — one segment per press issue: the score, the ace, the longest
  shot of the day, an outspent-and-still-standing beat when you were the
  underdog, the decorations.
- **HOME SERVICE** — your file, your board, your certifications.
- **TRAINING FILMS** — one per school, naming each certification, what it
  covers, and its real gate state (`HELD` / `OPEN` / `NEEDS BASIC DRIVER`).

---

## 4. MUSIC — the library, and THE FIELD

`src/client/gonet/library.ts` (state) + `player.ts` (the deck).

The nine real score files became a shelf with in-world identities — The Ninth
Column, Odessa Grey, Maklov Choir. You get playlists: create, rename, delete,
reorder (the ordering *is* the playlist), favourite, add from the shelf.

**Exactly one playlist is marked THE FIELD.** That is the contract with the
battlefield.

Two laws the tests pin:
- **The field is never silent.** Empty the field list and `fieldTracks()`
  falls back to the whole shelf — a soldier pressing H and getting nothing is
  worse than a soldier getting the wrong song.
- **The built-ins cannot be deleted**, and deleting whatever list *was* on the
  field sends the field home rather than leaving a dangling id.

### One deck, two faces

The corner player in the GONET and the headphones on the field are the **same
`MusicPlayer`**. A song you queued at the laptop is the song still playing when
you put your headphones on, because there was never a second player to fall out
of sync with the first. `toField()` even keeps the current song spinning if it
is also in the field kit.

---

## 5. HEADPHONES — the trade

`src/client/gonet/headphones.ts`. **H** in a match.

Headphones are not a free jukebox:

- your library plays, drawn from THE FIELD playlist
- the war's own score **stops** — two soundtracks at once is noise
- the master audio bus drops by `HEADPHONE_WORLD_CUT` (0.55), so gunfire,
  footsteps and callouts all sit further away

You get your music and you give up your ears. Everything in this game is a
sidegrade; this is no different. The HUD chip names the track and says
`WORLD MUFFLED` so the trade is never invisible.

Verified live: master gain **0.5 → 0.225** on H (exactly the 55% cut) and back
on release; a one-track field kit called `NIGHT PATROL` produced
`source: 'field'`, playing *Siege Engine — Maklov Choir*.

---

## 6. Verifying it

`window.__ww.deck` is the live deck, `__ww.cans` the headphones.

> **Trap.** `await import('/src/client/gonet/player.ts')` inside a page eval
> returns a **fresh module instance**, so `musicDeck()` there is NOT the game's
> deck — it reported `source: 'library'` while the real one was on the field.
> The library *functions* are pure and safe to import that way; apply them to
> `__ww.deck.lib`. Only the singleton is instance-bound.

A live match must be driven in a visible Playwright tab; the Browser pane never
boots a match (`__ww` never appears there).
