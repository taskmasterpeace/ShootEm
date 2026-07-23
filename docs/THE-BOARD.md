# THE BOARD — the desk under the TV

> Robert: *"I want to increase visibility into the game's engine and combat so
> that I can monitor stuff. There's a lot of space under the TV. Figure out the
> aspect ratio it needs to be... who threw the hardest attack, what was the
> hardest attack, who had the best defense — that is a lot of good stuff to read
> on that screen."*

A broadcast desk pinned under the picture: four columns of live telemetry, the
combat superlatives named, and the engine's own vital signs. Raised by default
on a real screen, **F9** toggles it.

---

## 1. The aspect ratio, decided

The picture runs **CINEMASCOPE — 2.28:1**, near enough 21:9. The desk takes
what is left underneath.

That is not decoration; it is the only ratio that *makes* the room. A 16:9
picture on a 16:9 display leaves exactly nothing below it. Letterboxing the
view frees 22% of the screen height, which on the overwhelmingly common
1920×1080 panel is 238px — enough for four columns of telemetry at a readable
11–13px, and not so much that the game becomes a small window.

| Display | Desk | Picture | Aspect |
|---|---|---|---|
| 1920×1080 | 238px | 1920×842 | **2.28:1** |
| 1366×768 | 169px | 1366×599 | 2.28:1 |
| 2560×1440 | 280px (capped) | 2560×1160 | 2.21:1 |
| 1024×768 landscape | 132px (floor) | 1024×636 | 1.61:1 |
| phone landscape (675×312) | 84px | 675×228 | 2.96:1 |

The whole rule is one clamp, and the three numbers in it are the three
decisions:

```css
#app.board-on { --board-h: clamp(132px, 22vh, 280px); }
```

- **132px floor** — below this the desk stops being readable, so it stops
  shrinking and the picture gives up its aspect instead.
- **22vh** — the target that lands a 1080p panel on cinemascope.
- **280px cap** — above this the picture stops being the point.

A landscape phone overrides the floor to 84px (`max-width: 700px`): the 132px
floor would have taken a third of a 312px-tall screen. The desk is off by
default on touch anyway.

### One variable, three consumers

`--board-h` is declared in exactly one place and read by everything that must
agree about where the screen stops being the game:

- `#game-canvas` — `height: calc(100% - var(--board-h))`
- `#hud` — `bottom: var(--board-h)`
- the floating damage-number layer — `bottom: var(--board-h, 0px)`

`tests/board.test.ts` enforces all three.

> **Trap already paid for.** The canvas states its height *outright*. Written
> as `left/right/top/bottom` with `width/height: auto`, a canvas lays out at
> its **drawing-buffer** size — which the renderer sizes *from the element*.
> That ratchet inflated the canvas to 26,843,546px on the first live run.
> `calc()` is the fixed point the loop never had.

The renderer refits from the **canvas**, not the window, via `ResizeObserver`:
toggling the desk changes the picture's height without any window resize event
firing. Verified: desk down → cam aspect 1.778, desk up → 2.279, with the CSS
box, the drawing buffer and the camera all moving together.

---

## 2. What the desk reads

### THE RECKONING — the superlatives, each one *named*

| Block | Figure | Answers |
|---|---|---|
| HARDEST BLOW | damage, weapon, attacker ▸ victim | "who threw the hardest attack, and what was it" |
| BEST DEFENCE | soak per life | "who had the best defense" |
| LONGEST KILL | metres, weapon, killer ▸ victim | the sniper's board |
| DEADLIEST | kills, damage dealt, best blow | who is winning the fight |
| BEST RUN | streak, still running or broken | who is on a tear |
| TOUGHEST | punishment absorbed, times down | who refuses to die |
| DEADEYE | hit %, connections of rounds fired | who wastes nothing |
| THE MATCH | total damage, kills, blows, fighters | the whole battle at a glance |

### THE FIGHTERS — the account table

`NAME · K · DEALT · TAKEN · DEF · BEST · ACC`, your own row highlighted, name
in team colour. **Click any column header to re-rank.**

### THE ENGINE — vital signs

Frame rate and **1% low** (worst frame in a 2s window), sim-step ms, draw ms,
draw calls, triangles, geometries/textures, live bodies split by bot/threat,
hulls, projectiles, event rate, and the picture's live resolution + aspect.
Each figure carries a health colour: green ok, amber warn, red bad.

### THE FEED — the rolling log

Kills with weapon and range, blows over 45, guards that held, men bleeding out,
new records. Capped at 60 lines.

---

## 3. The ledger

`src/client/ledger.ts` — the accountant. It reads the event stream once per
tick and touches nothing. Read-only by construction: if a figure here disagrees
with the fight, the fight is right and this is a bug.

**A blow is an attack, not a fragment.** One `damageSoldier` call emits plate
and flesh separately; a shotgun emits one per pellet. All in the same tick,
all from one trigger pull. The ledger **folds** damage by
attacker+victim+weapon before ranking, which is what makes "the hardest attack"
mean the attack and not the loudest pellet of it.

The `damage` event now carries its `weapon` (it was in scope at the emit and
discarded) — that is the "what" half of Robert's question.

### Two measures that a live battle forced

Both of these read **zero for an entire match** on the first live run, and were
replaced with measures that always have an answer:

- **DEFENCE** was plate-eaten + blocks. But most fighters carry no armour and
  land no melee, so "best defence" sat blank while men were plainly surviving
  punishment. It is now **`(eaten + taken) / (deaths + 1) + blocks × 20`** —
  punishment absorbed per life, plus strikes actively turned away. Standing up
  under fire *is* defence.
- **ACCURACY** keyed off the `hit` event, which carries an attacker only for
  some weapons — so it read 0% for everyone. A hit is now a **connection**: a
  tick in which your blow landed on somebody. At 60Hz no gun fires twice in one
  tick, and a grenade catching three men counts once, so it can never exceed
  100%.

### The book is per-match

The desk outlives the world it reports on, so `startLocal` resets the ledger.
Without it the totals silently became lifetime figures.

---

## 4. Verifying it

`window.__ww.desk` is the live handle — `.ledger` is the book, `.toggle()`
raises and lowers the desk.

A live match must be driven in a **visible Playwright tab**; the Browser pane
is throttled and `__ww` never appears there. Read the desk's rendered text
straight out of the DOM (`#board .bd-col`) — it is the content itself, and more
verifiable than a screenshot.
