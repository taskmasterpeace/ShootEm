# THE ONE CLOCK — and the control

> Robert, 2026-07-23: *"at a time of day in the game, battlefield or not, we
> should see a clock that we will control later."*

The chip has been in the corner since #123. Two things were missing: on the
battlefield it was reading the **wrong clock**, and there was nothing to
control it with beyond a raw offset.

---

## 1. Two clocks, and which one is true

| | Where it comes from | Who obeys it |
|---|---|---|
| **The world clock** | real UTC at a fixed ratio — one game day per two real hours | menus, launches, everyone everywhere |
| **The field clock** | a match's own day, advanced from `world.time` | the sky you are standing under |

They are the same clock at launch and then they **drift**, because only one of
them is the world you're in:

- a **paused** match freezes the sky and not the wall
- a **killcam or replay** doesn't advance sim time
- **paintball, the pro shop and the threat room** carry no clock at all

The chip used to read the world clock always — including on the battlefield,
the one place it could be wrong. Now:

```
in a match          → the field clock (what the sky is actually doing)
outside a match     → the world clock
a match with no clock → "NO CLOCK · THE YARD KEEPS NO DAY"
```

A world with no day does **not** get an invented hour. `clockForField()` is the
single entry point; `World.hasClock()` is how a world admits it has none.

**The tells.** A clock that means something different should look different:

| State | Look |
|---|---|
| on the field | amber left rail |
| held | amber border, the dot blinks |
| running fast/slow | green border and dot |
| no clock | dashed border, grey dot |

And it now says the time of day **in words** — DAWN, MIDDAY, DUSK, DEAD OF
NIGHT — because the thing a player actually reads at a glance is what kind of
light they are fighting in, not four digits.

## 2. The control

One `TimeControl` drives both halves (`src/client/worldclock.ts`):

| Knob | What it does |
|---|---|
| **scrub** (`offsetMs`, `scrubToHour`, `nudge`) | drag the clock to an hour. Always forward — asking for an hour already past goes to tomorrow rather than jumping a day backwards. |
| **rate** (`setRate`) | how fast the day runs. 0 stops it; 60 is the ceiling. |
| **hold** (`freeze` / `unfreeze`) | stop the clock where it stands, and carry on from there when released. |

**Changing the rate never teleports the world.** The control carries an
*anchor* — where the clock was and when — so switching to 12× continues from
the current moment instead of recomputing the whole session at the new speed
and flinging the world days forward. `setRate` re-anchors before it changes
anything; the test pins that the reading is identical across the switch.

Guarded: a negative rate is clamped to 0 (the world never runs backwards), an
absurd one to 60, a corrupt store falls back to true time, and the clock can
never be pushed before the war began. #90's bare admin offset is inherited on
first load.

### It reaches the battlefield

The sim is *told* the rate at launch (`WorldOptions.clockRate`) — it never
reads the control, so replays stay pure:

```ts
clockRate: frozen ? 0 : rate
```

So a **held clock holds the sky mid-match**, and a 12× day really does run dusk
across a firefight.

### Where the knobs are

`/admin.html` → THE ONE CLOCK: jump to noon/dusk/midnight/dawn, ±1 game hour,
**HOLD THE DAY**, and ½× / 1× / 4× / 12×. CLEAR returns true time.

That is the "later" made ready: the government turns the same knobs when it
arrives.

---

## A real bug this uncovered

`clockFromPhase` floored `phase × 1440` to get minutes. An exact hour is rarely
exact in binary — 11:00 arrives as `0.4583333333333333`, and `× 1440` is
`659.9999999999999`. Floored, that renders **10:59**.

Every whole hour, the clock could read one minute short of itself. It is fixed
with a `1e-6` epsilon (60 microseconds — it cannot move a real reading), and
two tests would now catch it.

---

## Verifying

- `window.__ww.world.clockNow()` — the field's day fraction
- `window.__ww.world.clockDayOffset()` — days crossed since launch
- `worldclock.ts` holds no module state (it reads storage per call), so an
  eval-side `import()` of it **is** safe — unlike the music deck singleton.

Verified live: the chip read `11:47 MIDDAY` in a Conquest match, and pushing the
sim eight game-hours moved it to `19:48 DUSK` — matching `clockNow()` exactly —
while the wall clock never moved. Freeze held it across seconds; 12× ran five
game-minutes in two real ones; paintball reported NO CLOCK.
