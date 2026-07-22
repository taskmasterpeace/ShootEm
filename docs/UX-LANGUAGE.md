# THE UX LANGUAGE — WAR WORLD: EARTH
### The one grammar every display element is forced into — current and future. 2026-07-21.

Robert: *"we gotta create a whole language where everything that we create should be able to automatically be forced into some consistent User Experience Language."* This document IS that language. Nothing renders that is not composed from §2's primitives, colored from §1's tokens, behaving per §3-4, living on a §5 surface. If a new element cannot be expressed in this grammar, the grammar is wrong — amend it here first (§10), then build.

**Companions:** `docs/UI-MASTER.md` (the 100% display audit — WHAT must show and WHEN; this doc is HOW it must look and move) · `docs/reference/hud/README.md` (the weapon-block direction + PixelLab frames) · `src/styles.css:1-21` (the live tokens) · `src/client/models/weapons.ts` (`BRAND_STYLES` + `parseBrand`).

---

## §0 · THE LAWS (absorbed from UI-MASTER — every rule below serves these)

1. **Near the action.** Critical feedback lives ON the body, the target, or the reticle. Corners hold summaries only.
2. **Derived, never transcribed.** Every readout reads live from the sim. A meter that can drift from truth is worse than no meter.
3. **Shape is a channel.** Friendlies are dots, enemies triangles, memories hollow marks, machines hard corners, the living curves. Color-blind players read shape alone.
4. **One accent.** House amber = yours/ready. Signal-red = enemy/danger. Steel = information. Semantic green/red for health-family states. **No purple, ever** — not in any hue slot, gradient stop, or generated asset.
5. **The world teaches first, the HUD confirms.** If the body can wear a state (shimmer, stance, flame), wear it there — the HUD chip is the caption, not the message.
6. **Nothing blinks out.** States HOLD, then fade (exact durations: §4).

New standing law added by this document:

7. **Composed, never bespoke.** Every element is an arrangement of §2 primitives in §3 states. Inventing a new visual form without amending this grammar is a build error, same class as a type error.

---

## §1 · THE TOKENS

### 1.1 Color — the canonical palette

The CSS custom properties are the source of truth (`src/styles.css:1-21`). Canvas/JS code must use the constants column — the ad-hoc hexes currently scattered through `hud.ts`/`ring.ts` consolidate to these (see §10 for the migration list).

| Token | Value | Hex anchor | Job |
|---|---|---|---|
| `--bg` | `oklch(0.15 0.014 74)` | — | field background |
| `--bg-deep` | `oklch(0.11 0.012 74)` | — | wells, meter tracks, screens |
| `--card` | `oklch(0.19 0.018 74)` | — | plate fill |
| `--card-hover` | `oklch(0.23 0.026 74)` | — | plate hover |
| `--border` | `oklch(0.34 0.018 74)` | — | steel hairline (deliberately cool, not warm) |
| `--border-bright` | `oklch(0.52 0.03 74)` | — | emphasized frame, bracket corners |
| `--text` | `oklch(0.93 0.01 80)` | — | primary text |
| `--muted` | `oklch(0.64 0.03 78)` | — | labels, hints, secondary |
| `--accent` | `oklch(0.76 0.16 74)` | **`#e8a33d`** | THE amber: yours / attention / charging |
| `--accent-strong` | `oklch(0.66 0.19 58)` | — | pressed/gradient partner of accent |
| `--team0` | = `--accent` | `#e8a33d` | Coalition |
| `--team1` | `oklch(0.72 0.13 225)` | `#3dbde8`-family | Collective (identity only — never "danger") |
| `--danger` | `oklch(0.6 0.21 25)` | UI red `#ff4736` | enemy / danger / critical |
| `--ok` | `oklch(0.72 0.16 145)` | ready green `#46d17a` | GO / ready / healthy |
| `--radius` | `2px` | — | the hard military edge — the MAXIMUM radius anywhere |

**Canvas constants (the sanctioned JS-side family):**

| Constant | Hex | Where it lives |
|---|---|---|
| `AMBER` | `#e8a33d` | fills, marks, mark bands (weapons.ts `ACCENT` already = this). `#f5b21a` (hud.ts:205) is a stray — migrate. |
| `RED_UI` | `#ff4736` | DOM danger text/borders (down-banner, missile inbound, no-ammo) |
| `RED_WORLD` | `#e05252` | hostile rings/marks in the 3D world (`RING_COLORS.hostile`) |
| `RED_MAP` | `#ff5040` | minimap hostile strokes (ping rings, mine squares) |
| `GREEN_READY` | `#46d17a` | a meter that says PRESS IT (reload done, signature up) |
| `HP_LADDER` | `#7fd45c` → `#e0b352` → `#e05252` | health fraction ≥0.7 / ≥0.35 / below (`RING_COLORS.hp`) |
| `PLATE_STEEL` | `#9fc3d8` | armor plate arc |
| `ENERGY_CREAM` | `#e8d9a0` | energy arc; `#f0d9a8` numerals on rings |
| `VIRAL_GREEN` | `#7fa83c` | infection family (sickly — never used for "good") |
| `BIOHAZARD LADDER` | `#e8d34d` → `#e8a33d` → `#ff7a1a` → `#ff4736` | outbreak L1→L4 |
| `TRACK` | `rgba(0,0,0,0.45)` | every ring/meter's empty track |

**Minimap glyph palette** (organized into families; anything outside these families is a violation):

| Family | Colors | Members |
|---|---|---|
| Team | `#e8a33d` / `#3dbde8` soldiers · `#c8882d` / `#2d9dc8` vehicles (darker = machine) | dots, triangles, shields |
| Map-tech teal | `#66e8ff` gates · `#30d0c0` pads · `#7dffdc` your warps | fixed infrastructure |
| Hostile-of-mine | `#ff8866` enemy warps · `#ffb0a0` enemy drones · `RED_MAP` rings/mines | enemy gadgets |
| Ordnance | `#ff3020` orbital · `#ffd870` supply · `#ffe08a` waypoints | danger/prize marks |
| Horde | `#8fce5a` shambler · `#e06a50` sprinter · `#b7e34a` bomber · `#3fe0c8` stalker | zed kinds |
| Neutral-living | `#f4ffd8`+`#5aa845` scientist · `#b8ffe8` IR ghost | protected/spectral |

**Forbidden:** any OKLCH/HSL hue ~270–320 (purple/violet/indigo/lavender/magenta), anywhere, ever — including generated art, PixelLab frames, VFX gradients, and emoji that render magenta (see the `hud.ts:261` incident).

### 1.2 Type — three voices, no more

| Voice | Font | Job | Never |
|---|---|---|---|
| **Display** | `'Saira Stencil One'` (`--font-display`), weight 400, uppercase, ls `0.02–0.1em` | wordmark, screen titles, K.I.A., codex names | body copy, numbers |
| **UI** | `'Oswald'` (`--font`), 400/600/700, uppercase for labels ls `0.04–0.2em` | labels, chips, buttons, names | telemetry numerals |
| **Telemetry** | `'Share Tech Mono'` (`--font-mono`), `tabular-nums`, ls 0 | every live number, timers, ammo, stats, hints | headings |

One diegetic exception stands: the Front Courier newspaper (`.np-paper`) speaks Georgia serif on cream — it is an artifact IN the world, not UI, and is the only surface allowed to leave the three voices.

**Type scale (rem — use these steps, nothing between):**

| Step | Size | Used by |
|---|---|---|
| micro | `0.62` | pip labels, cooldown counts, tier tags |
| label | `0.66–0.72` | eyebrows, bar-labels, column heads |
| tele | `0.72–0.82` | hints, killfeed, chat, table cells |
| body | `0.85–0.9` | chips, weapon name, buttons |
| emphasis | `1.05–1.15` | ammo reloading, announce, codex names |
| numeral | `1.5–1.7` | ammo count, HP number, DOWN |
| big | `2.2` | announce.big |
| display | `2.8–4.6 (clamp)` / `3.0` | game title / K.I.A. |

### 1.3 Spacing — the six steps

| Step | Value | Job |
|---|---|---|
| S1 | `0.3rem` | intra-chip padding, pip gaps |
| S2 | `0.5rem` | gaps between chips / stacked HUD rows |
| S3 | `0.75rem` | gaps between cards on screens |
| S4 | `0.9–1.1rem` | plate padding |
| S5 | `1.25rem` | HUD corner inset (`#hud-bottom-left/right` at `1.25rem`) |
| S6 | `1.5rem` | screen-panel padding |

Fixed dimensions of record: vitals plate `19rem` wide · weapon plate `min-width 12rem` · minimap `min(264px, 34vh)`, large `min(430px, 60vh)` · body-ring canvas `128px` (main arc r = 44, energy r = 34, plate r = 54) · meter heights: reload `4px`, hull/lsw `5px`, stamina `7px`, hp bar `0.85rem`.

### 1.4 Shape — the hard-edge constitution

- Rectangles: radius ≤ `2px` (`--radius`). No pills, no rounded SaaS cards. (`.bk-medal`'s `999px` pill is a standing violation — §10.)
- Corner brackets (`.brk`): `10px` legs, `2px` stroke, `--border-bright`, amber when `.selected`. Scale ladder: 9px (HUD plates) · 10px (default) · 14px (pause) · 16px (screen panels).
- Clip-cuts (the "launch key" corner): `5px` cut on small controls (`.wp-fam`), `12px` on primary action buttons. Cut, never rounded.
- Circles are RESERVED for the shape channel: friendly dots, RING primitives, paint swatches, map markers. A circle never frames a rectangle's content.
- **The shape channel (Law 3), glyph table:**

| Meaning | Shape | Shipped example |
|---|---|---|
| friendly unit | filled dot ● | minimap dots |
| hostile unit | filled triangle ▲ | minimap `tri()` |
| machine | hard-corner square/rect | mine squares, sys pips |
| waypoint/order | diamond ◇ (rotated square) | tactical waypoints |
| memory/ghost | hollow stroke of the live shape | IR ghost circle, contact ghosts |
| living/organic | curve/circle family | rings, scientist double-dot |
| seat/quantum | ● filled ○ empty ◉ special | crew pips |
| refill-in-progress | ◔◑◕→● quarter sweep | grenade lead pip |

### 1.5 Motion tokens (the constants §4's rules spend)

| Token | Value | Job |
|---|---|---|
| `T_IN` | `0.2s` ease-out | anything entering (killfeed slide 12px, chips) |
| `T_STATE` | `0.15s` | hover/border/color transitions |
| `T_FILL` | `0.1–0.15s` linear | meter width/arc tracking |
| `T_FADE` | `0.55s` ease-out | the exit fade (vignette law) |
| `T_FLASH` | `0.28s` one-shot | spend flash, READY flash |
| `BREATHE_WARN` | `1.1–1.2s` ease-in-out ∞ | warn-tier breathing (border alpha, not opacity) |
| `BREATHE_DANGER` | `0.7–0.9s` ease-in-out ∞ | danger-tier breathing |
| `BLINK` | `0.5–0.7s` steps(2) ∞ | TOP severity only (missile lock, empty mag) |
| `HOLD_KF` | `6s` | killfeed entry lifetime |
| `HOLD_ANNOUNCE` | `2.5s` / `4s` big | announce lifetime |
| `HOLD_SUB` | `3.4s` | subtitle lifetime |

### 1.6 The words — approved player-facing vocabulary (OUTBREAK-SPEC §16.1, adopted whole)

| System | Only these words |
|---|---|
| Melee | STRIKE · GUARD · GRAPPLE |
| Charge ladder | IMPACT CHARGE · **WIND-UP → HEAVY → MAXIMUM → OVERCHARGE** · RECOVERY (Robert's band names; HEAVY supersedes the spec's CHARGED — matches the shipped 0-30/31-70/71-100/hold bands) |
| Grab | GRAB ATTEMPT · CONTACT · REAR CONTROL · CONTROL STRUGGLE · LOCK SECURED · ESCAPE · REVERSAL · TAKEDOWN |
| Grapple feedback | BREAK HIT · LOCK PROGRESS · CONTROL CONFIRMED · ESCAPE |
| Zombie grab | BITE STRUGGLE |
| Infection | CLEAN · EXPOSED · INFECTED · CRITICAL · TURNING · REANIMATED · NEUTRALIZED |
| Cooldown family | CYCLING → READY |
| Icon language | strike=fist/blade · guard=angled brace · grapple=gripping hand · impact charge=filling ring · rear control=hand-behind-silhouette · escape=broken chain · infection=biohazard · INC=flame · AP=round-through-plate · corpse warning=body+timer · reanimation=rising silhouette |

Glyphs are single-codepoint, currentColor-inheriting characters (⚠ ☄ ☣ ⛊ ● ▲ ◈). Full-color emoji are banned from the HUD (they broke the mono/stencil system once — `hud.ts:261`); they survive only on post-match screens (trophies) until glyph art replaces them.

---

## §2 · THE COMPONENT GRAMMAR — eleven primitives, closed set

Everything on screen is one of these or a composition of these. Each entry: anatomy, states used (§3 vocabulary), sizing, allowed surfaces (§5).

### 2.1 PLATE — the bracketed panel
```
┌╔════════════ ─ ─ ─ ─ ─ ─ ─ ─
│║  LABEL (Oswald 600 upper)          <- optional eyebrow
│║  CONTENT (meters/pips/tags/cam)
│                                ─ ─ ─╗║
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ══════╝┘   <- .brk corners, opposite pair
```
- Fill `oklch(0.16 0.018 74 / 0.78)` + `backdrop-filter: blur(6px)`; border 1px `--border`; bracket pair 9px amber (HUD) / bright-steel (screens).
- Padding S4. Radius 2px. Screens use the gradient variant (`linear-gradient(180deg, var(--card), oklch(0.15 0.014 74))`).
- States: IDLE only (a plate never carries state itself — its CONTENTS do). The manufacturer skin (§6) re-chromes the weapon PLATE without touching contents.
- Surfaces: weapon block, vitals block, screens, pause.

### 2.2 SHEET — the field-manual table (screens only)
- `--font-mono` `0.78rem` cells, tabular; Oswald `0.66rem` uppercase sticky headers; row rule `1px oklch(0.34 0.018 74 / 0.4)`; hover `--card-hover`; active row amber wash `oklch(0.76 0.16 74 / 0.14)` + `inset 2px 0 0 var(--accent)`.
- Sort state = amber header. Pinned row = 2px team1 left rule.
- Surfaces: codex, scoreboard, barracks, career.

### 2.3 CHIP — the bordered state capsule
```
╭─────────────────╮        (radius 2px — "╭" only for the diagram)
│ ☣ L3 · LABEL 42 │  <- glyph · payload, Oswald 600 / mono numbers
╰─────────────────╯
```
- Padding `0.3rem 0.7rem`; border 1px; `backdrop-filter: blur(6px)`; fill `oklch(0.18 0.02 80 / 0.75)`.
- Border+text carry the state color TOGETHER (obj-chip pattern): t0 amber, t1 cyan, neutral muted, danger red.
- Optional radial-wipe timer (status-strip variant): a `conic-gradient` overlay draining clockwise.
- Enemy-sourced chips wear `RED_UI` edges; buffs wear amber (UI-MASTER §6).
- States: all seven. Sizing: content + S1 padding; square icon variant `1.05rem` glyph (`.eq-chip`).
- Surfaces: top bar, vitals block (status strip), weapon block, killfeed (via FEED), screens.

### 2.4 TAG — the naked label (a word riding a parent)
- No border, no fill. Mono for values (`· AP`, `×2.4`, `0:29`), Oswald for words (`MAXIMUM`, `DRIVER`).
- A TAG never stands alone — it annotates a PLATE line, CHIP, METER, RING, or MARK.
- States: color-only (no motion of its own; it inherits the parent's breathing).
- Surfaces: anywhere its parent lives.

### 2.5 METER — the linear fill
```
LABEL                        87%   <- TAG pair (optional at 4-5px heights)
▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░   <- fill on TRACK, h 4-7px, r 2px
```
- Track `oklch(0.22–0.25 0.02 80)`; fill tracks value at `T_FILL`; leading-edge highlight `inset -2px 0 0 oklch(0.9 0.1 85)` on the stamina variant.
- Two families, one look: **CHARGE** (rises to a release: reload, signature, impact, spool, hotwire) — amber fill → `GREEN_READY` at ready, or the band ladder for held charges; **GAUGE** (level truth: hull, stamina, battery, link) — `GREEN_READY` >50%, amber ≤50%, `RED_UI` ≤25%.
- The info-rich upgrade of this primitive is §8 — whichever shape wins there becomes the ONLY continuous meter in the game. (Quantized counts stay PIP-ROW — the grenade pip-refill is LOCKED.)
- States: IDLE, ACTIVE, READY, WARN, DANGER.
- Surfaces: weapon block, vitals block, target orbit (struggle bar), screens.

### 2.6 RING — the radial meter (the body's native language)
```
      ╭ ─ ─ ╮          270° arc, gap centered on the back (start 135°)
    ╱    N    ╲        r44 main · r34 inner (energy) · r54 outer (plate)
    ▏   128   ▕        canvas 128px; lineCap round; TRACK under every arc
    ╲  .    . ╱        widths: 11 main · 3.5 inner · 4 plate · 5 hostile
      ╰ ─ ─ ╯          center numeral #f0d9a8 mono
```
- 270° for vitals/charge (the gap is a design signature); 360° closed circles ONLY for world ground-rings (LZ, revive, capture) where the circle IS the area.
- Notch pips may ride the arc (threat tiers, band thresholds).
- States: all seven; DANGER breathes the arc alpha, never strobes radius.
- Surfaces: body orbit, target orbit, world (ground), minimap (ping rings), codex bench.

### 2.7 PIP-ROW — discrete quanta
```
CREW 3/5  ◉●●○○      LABEL micro-mono · one glyph per unit
```
- Glyph set from §1.4's channel table; gap S1; micro label optional.
- The LEAD pip carries transitions: refill sweep ◔◑◕→●, or the "spent" flash.
- **Robert's accent note (fresh):** segmented rows carry ONE small accent — the approved treatments are the amber **lead-notch tick** (a 2px amber hairline on the filling segment's leading edge), **bracket caps** (`[` `]` end caps in `--border-bright` that flip amber at full), and the **hairline underline** (1px continuous-truth line under the quantized row). Pick per §8; never more than one full-brightness accent per row.
- States: per-pip (ok/hurt/dead pip coloring = sys-pips pattern); row-level WARN/DANGER allowed.
- Surfaces: weapon block, vitals block, body orbit (as arc notches), vehicle block.

### 2.8 BANNER — the center-screen state line
```
        ╔══════════════════════════════╗
        ║ DOWN  bleeding out 14s · crawl ║   <- mono upper, breathing border
        ╚══════════════════════════════╝
```
- Position ladder (top→bottom): replay `top 4.4rem` · announce `top 26%` · state banner `top 34%` (down/grabbed/bite) · walk-up prompt `bottom 22%` · caption `bottom 17%` (vo-sub).
- Two kinds: **STATE banner** (holds while true — down, grabbed, guard) breathing at its severity tier; **RECORD banner** (timed — announce, reprint, replay) holds `HOLD_*` then fades.
- Max ONE state banner + one announce + one caption at once — a new state banner replaces, never stacks.
- States: WARN, DANGER (state kind); IDLE (record kind).
- Surfaces: fullscreen center column only.

### 2.9 MARK — the world-space glyph (+ GHOST variant)
- A shape-channel glyph drawn at a place through the camera or on the minimap: chevrons, waypoint diamonds, LZ rings, SAM diamond, contact marks, buried-axe glint.
- Always shape-first (Law 3), color second. Sizes on minimap: 2–5px radius by importance; in world: sized by the thing it marks.
- **GHOST**: the hollow-stroke memory variant — a mark whose truth expired holds position and fades per §4.3 (the sight law). Every MARK must define its GHOST.
- States: IDLE, ACTIVE, WARN, DANGER, GHOST.
- Surfaces: world, minimap, reticle.

### 2.10 FEED — the time-ordered stack
- A column of CHIPs, newest at the anchor edge, hard cap + oldest-drops: killfeed (cap 6, `HOLD_KF` 6s, enter `kf-in` 0.2s/12px), chat log (cap by height, `.old` at 25% opacity — a built-in GHOST), subtitle queue (cap 1).
- States: entries carry their own; the feed itself never animates as a whole.
- Surfaces: top-right (killfeed), bottom-left above vitals (chat), bottom-center (captions).

### 2.11 VEIL — the screen-edge/fullscreen wash
- `inset box-shadow` edge glows (hurt `oklch(0.5 0.21 25 / 0.85)` 120px/40px, heal green 110px/30px), smoke grey vignette, FPV static, blind bloom, respawn red wash `oklch(0.12 0.04 25 / 0.45)`.
- Snap in (transition none → opacity set), bleed out `T_FADE`. Never blocks input reading; never full-opacity.
- Max ONE damage-class veil + one ambient veil (smoke/static) at once.
- States: IMPULSE (hurt/heal flash), ACTIVE (smoke, static), DANGER (blind, overload).
- Surfaces: fullscreen only.

**Composition rules:** PLATE holds METERs/PIP-ROWs/TAGs/CHIPs/cams · CHIP holds a glyph + TAG + optional wipe · RING holds notch-pips + a center numeral + a band TAG · MARK holds at most one TAG · FEED holds CHIPs only · nothing holds a BANNER or VEIL.

---

## §3 · THE STATE GRAMMAR — one vocabulary for state, everywhere

Seven states. Every element maps every sim value it reads onto these — no element invents an eighth.

| State | Meaning | Color | Motion | Shipped exemplar |
|---|---|---|---|---|
| **HIDDEN** | not earned / not true | — | enters via `T_IN` when earned; never flickers in/out at a boundary (hysteresis: a state must be true 0.3s before showing, except DANGER which is instant) | viral chip at 0 load |
| **IDLE** | information at rest | `--border` frame, `--muted` text, steel | none | weapon name, crew pips empty |
| **READY** | press it / go | `GREEN_READY` fill/text | one `T_FLASH` on entry, then static — READY never loops | lsw-fill at 100%, reload done |
| **ACTIVE** | working / filling / yours | `--accent` amber | continuous `T_FILL` tracking; fill motion only | reload cycling, charge rising |
| **WARN** | costing you something | amber + `BREATHE_WARN` border-alpha breathe | breathe only — never opacity-blink | weather `.rough`, biohazard L3 |
| **DANGER** | enemy / dying / now | `RED_UI` (DOM) / `RED_WORLD` (3D) / `RED_MAP` (map) + `BREATHE_DANGER`; TOP severity may `BLINK` | breathe; blink is rationed (§4.2) | down-banner, MISSILE INBOUND, no-ammo |
| **DEAD** | destroyed / disabled / cooling | 38% opacity + `grayscale(0.8)`, or red DEAD pip | none (a corpse doesn't move); optional mono countdown TAG | eq-chip cooling, sys-pip dead |

**Ownership hue rule (rides every state):** enemy-sourced anything = red family · yours = amber · team identity = t0 amber / t1 cyan (identity is never severity) · infection family = `VIRAL_GREEN` until CRITICAL flips it red · healing/GO = green.

**The ladders in state terms:**
- Charge: WIND-UP (ACTIVE) → HEAVY (ACTIVE) → MAXIMUM (READY-gold: accent at full brightness + entry flash) → OVERCHARGE (DANGER) → release → RECOVERY (IDLE refilling as ACTIVE).
- Gauge: >50% READY-green · ≤50% WARN · ≤25% DANGER (hull/ammo shipped thresholds).
- Infection: EXPOSED (IDLE, viral green) · INFECTED (WARN, viral green) · CRITICAL (DANGER, red breathe 0.9s) — shipped in `#viral-chip`.
- Outbreak: L1 IDLE `#e8d34d` · L2 WARN amber · L3 WARN `#ff7a1a` breathe 1.2s · L4 DANGER breathe 0.7s — shipped ladder.

---

## §4 · THE MOTION RULES

### 4.1 What may animate
| Class | Definition | Budget |
|---|---|---|
| **IMPULSE** | one-shot ≤0.3s, fire-and-forget | hitmarker 0.18s, spend-flash 0.28s, kf-in 0.2s |
| **TRACKING** | a fill following the sim | `T_FILL` 0.1–0.15s linear, width/arc only |
| **BREATHING** | a held WARN/DANGER state | border/stroke alpha only, `BREATHE_*` periods |
| **BLINK** | steps(2) opacity | TOP severity only; max ONE blinking element per surface at a time |

Nothing else moves. No idle shimmer loops, no decorative easing, no parallax. Floor: no loop faster than 0.5s. Cap: ≤2 breathing elements per surface (the third-worst problem must wait its turn — severity sorts).

### 4.2 "Nothing blinks out" — the exit law, made precise
1. A STATE element whose truth ends **holds at full for 0.4s**, then fades over `T_FADE` (0.55s ease-out). `display:none` may only follow the fade.
2. A RECORD element holds its `HOLD_*` (killfeed 6s · announce 2.5/4s · subtitle 3.4s · contact marks 3s) then fades 0.55s.
3. Minimap/world contacts that leave truth become their **GHOST** (hollow stroke, held position) and fade over 2–3s — never vanish on the frame LOS breaks.
4. Snap-resets (revive arc reset-on-hit, struggle knockback) are the ONE sanctioned instant change — accompanied by an IMPULSE flash so the snap reads as an event, not a glitch.
5. Entries are fast (≤0.2s), exits are slow. The eye forgives late arrivals; it panics at disappearances.

### 4.3 Sequencing
- State transitions within an element: color crossfade `T_STATE` (0.15s). Never tween BETWEEN severity colors during a breathe cycle — finish the breath, then cross.
- A meter reaching READY: fill completes → `T_FLASH` green flash → static green. (Shipped: reload/lsw green-at-full.)
- MAXIMUM band entry: single flash + optional one audio tick — the "perfect release cue" (OUTBREAK-SPEC §13) is an IMPULSE, not a loop.

---

## §5 · THE SURFACE MAP — where each primitive may live

| Surface | Anchor / size | Allowed primitives | Hard budget |
|---|---|---|---|
| **Body orbit** | 128px canvas on YOUR soldier | RING, arc-notch PIP, band TAG | 3 arcs (hp/energy/charge) + 1 shell + pips; ONE breathing max |
| **Target orbit** | on what you aim at / fight | RING (hover hp, revive, hotwire), METER (struggle), TAG | 1 ring + 1 meter |
| **Reticle** | crosshair | MARK (SAM diamond, stagger wobble), IMPULSE | 1 mark |
| **World marks** | at a place, through the camera | MARK+GHOST, ground RING, TAG | uncapped, exit law enforced |
| **Weapon block** | bottom-right PLATE (manufacturer-skinned, §6) | weapon-cam, METER, PIP-ROW, TAG, CHIP | one plate; ≤2 meters visible at once |
| **Vitals block** | bottom-left PLATE, 19rem | RING, METER (stamina), CHIP (viral, equip, status strip), PIP-ROW (squad) | strip caps at 8 chips, overflow drops oldest buff first |
| **Top bar** | center-top column | CHIP row, TAG (mode/clock/weather) | ≤6 chips before priority-drop |
| **Killfeed** | top-right | FEED of CHIPs | 6 entries |
| **Minimap** | corner canvas 264/430px | MARK set + GHOST per §1.1 families | legend-listed layers only |
| **Fullscreen** | edges + center column | VEIL, BANNER | 1 damage veil + 1 ambient veil + 1 state banner + 1 announce + 1 caption |
| **Screens** | menu/armory/codex/barracks/map/scoreboard | PLATE, SHEET, CHIP, TAG, METER, clip-cut buttons | — |

Placement decision ladder (Laws 1+5, in order): **can the world wear it?** → body orbit → target orbit → reticle → world mark → corner block summary → screen. An element takes the FIRST surface that can carry it; corners are the fallback, never the default.

---

## §6 · THE MANUFACTURER SKIN SYSTEM

The weapon block's frame is skinned per maker (Robert, LOCKED 2026-07-21); the grammar inside never changes. **The frame varies; the meter is constant** ("same across the board").

### 6.1 The six makers (names are placeholders — Robert will rename)

Identity already ships in `BRAND_STYLES` (`src/client/models/weapons.ts:33-40`) — the HUD frame derives from the SAME record, so gun and frame speak one brand language automatically:

| Maker | Metal / furniture | Tell | Frame character | Empty shell (512×224, seed 21) |
|---|---|---|---|---|
| maklov | `0x23231f` / `0x3a352b` | none | plain stamped steel — the default | `frame-empty-maklov.png` · `c275cf3e` |
| titan | `0x1c1c1a` / `0x2b2620` | slab | heavy armored slab, girth 1.2 | `frame-empty-titan.png` · `a5cc9190` |
| kuchler | `0x4a4e55` / `0x39404a` | vents | precise cool-steel, vent lines | `frame-empty-kuchler.png` · `7ecb5fee` |
| harkov | `0x262b24` / `0x2e3428` | optic | long-frame, optic window | `frame-empty-harkov.png` · `268d040b` |
| ceres | `0x2d2a24` / `0x4a3d28` | drum | ornate brass, drum curve | `frame-empty-ceres.png` · `8295c818` |
| kamenel | `0x2a2320` / `0x33291f` | coil | coil/energy filigree | `frame-empty-kamenel.png` · `bcbc5dce` |

### 6.2 What a skin MAY change (chrome only)
- Frame art (the PixelLab shell), bezel palette (derived from the maker's metal/furniture hexes), corner treatment style, the one physical tell echoed as frame detail, plate texture/rivets, the weapon-bay lip.

### 6.3 What a skin may NEVER change (the constants)
- The **charge-meter geometry and position** — the meter groove is identical in every shell (rev-B shells were regenerated empty for exactly this: content composites live, nothing baked in).
- State colors (§3), the band ladder and its words (§1.6), the three fonts, numeral sizes, layout anchors (name / ammo / hint line positions), the weapon-cam framing (live 3D model of the equipped gun via `buildWeaponModel(weaponId)`), pip glyphs, and every motion token.
- Readability floor: meter fill vs groove contrast ≥ 4.5:1 in every skin; a skin that fails is rejected art, not a design choice.
- No purple in any skin, any maker, any era.

### 6.4 Selection + fallback rules
1. Skin = `parseBrand(weaponId)` — zero new plumbing; `rifle_titan_2` → titan frame.
2. Unknown/hand-tuned ids → **maklov** (already the code's fallback brand).
3. Missing/failed frame asset → the clean vector default PLATE (§2.1) — the game never blocks on art.
4. Weapon swap mid-match: frame crossfades `T_STATE` (0.15s); the meter NEVER resets visually on a frame change — value carries across the swap.
5. Vehicles: hull frames may join the system later using the same rule (vehicle maker → frame); until then vehicles wear the default plate. LSW/gods are NOT products — the signature meter rides the default plate always (a god has no manufacturer).
6. Scope stop: manufacturer skinning applies to the weapon block ONLY. Vitals, top bar, minimap, and screens never skin — one player-identity, one HUD.

---

## §7 · THE FULL INVENTORY — the enforcement table

Every element from UI-MASTER plus every system Robert named, expressed in the grammar. **If a row cannot be expressed, the grammar is wrong — fix §2, log it in §10.** (All 100+ rows below compose from the eleven primitives; two grammar additions — FEED, VEIL — were forced during this mapping and are already folded in.)

Legend: status ✅ shipped · 🔨 partial · ❌ missing · 📋 designed.

### 7.1 Soldier — vitals & movement
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| HP/armor/energy | RING (3 arcs + numeral) | body orbit + vitals | READY/WARN/DANGER ladder | ✅ |
| Stamina bar + spend flash | METER (gauge) + IMPULSE | vitals | ACTIVE/WARN | ✅ |
| Energy regen STALL (⏸ notch, `RELIGHT 35`) | METER lead-notch TAG + CHIP | vitals + status strip | WARN | ❌ |
| Sprint lean / pant | world (body) + audio | — | — | 🔨 |
| Dash/roll cooldown 0.9s | RING (hair-thin boot arc) | body orbit | ACTIVE | ❌ |
| Crouch/grass CONCEALED | world + whisper CHIP (once) | world + vitals | IDLE | ❌ |
| Swimming — hands busy | TAG (weapon-name swap) | weapon block | IDLE | ❌ |
| Ragdoll | world only (correct: no UI) | — | — | ✅ |
| Warp gate cooldown | world RING (gate rebuilds) | world | ACTIVE | ❌ |
| Spawn protection shell | world MARK (wire shell thins) | body | ACTIVE | ✅ |

### 7.2 The downed experience
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| YOU are down (bleedout + revive %) | BANNER (state) + ground RING | fullscreen + body | DANGER | ✅ |
| Teammate downed | ground RING (urgency-paced) | world | DANGER | ✅ |
| Revive channel 3s | RING (green arc closes) + snap-reset IMPULSE | target orbit | ACTIVE | ✅ |
| Being dragged (heel furrows) | world decal MARK pair | world | — | ❌ |
| Medibeam snap-lift | world + gasp SFX | world | IMPULSE | 🔨 |

### 7.3 Grenades & thrown kit
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Pouches as pips + ➤ selector | PIP-ROW ×4 (frags/smoke/fire/conc) | weapon block | IDLE/ACTIVE | ✅ |
| Throw cooldown ◔◑◕→● | PIP-ROW lead-pip sweep (LOCKED) | weapon block | ACTIVE | ✅ |
| Held-aim arc + landing ring + LOFT apex | world MARK (dashed arc, ring, apex) | world | ACTIVE | 🔨 |
| Selected pouch grows 1px, warms | PIP-ROW accent | weapon block | ACTIVE | 🔨 |
| Beacon/MANPADS count `◈2` | CHIP count TAG | vitals equip row | IDLE | ❌ |
| SAM lock diamond (rotates, tightens, solid+tone) | MARK (reticle + target) | reticle + world | ACTIVE→READY | ❌ |
| Axe flying/buried/recallable + return-lane warning | CHIP + world MARK glint + hairline MARK | equip row + world | ACTIVE/WARN | ❌ |

### 7.4 Weapons — charge, alt-fire, melee
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| **Impact Charge** (one meter for melee AND weapons) | §8 winner (METER or RING) + band TAGs | per §8 shape | WIND-UP→OVERCHARGE ladder | ❌ P1 — text-only today (`⚔ IMPACT ▮▮▮▯▯`) |
| Gun-model emissive rises with charge | world (enemy-visible counterplay) | world | ACTIVE | ❌ |
| Alt-fire cooldown + burst window | TAG + micro METER sweep behind `RMB ×N` | weapon block | ACTIVE | ❌ |
| Melee windup/slash ring | world MARK telegraph | world | ACTIVE | 🔨 |
| GUARD brace line `⛊ GUARD — bracing` | BANNER-line TAG on hint row | weapon block | WARN | ✅ |
| Fire-rate stagger — ringing crosshair | reticle MARK wobble + VEIL tinnitus hint | reticle + fullscreen | DANGER | ❌ |
| Weapon switch (name + in-hand model) | TAG + world | weapon block | IDLE | ✅ |
| Reload bar / ammo counter warns | METER (charge) + TAG states | weapon block | ACTIVE→READY / WARN / DANGER blink | ✅ |
| Ammo type tag `· AP` | TAG | weapon block | IDLE | ✅ |
| Penetration/noise/fire-hazard readout | TAG micro-row (§16.2 weapon HUD) | weapon block | IDLE | ❌📋 |

### 7.5 Melee struggles (OUTBREAK-SPEC §14-15)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| BITE STRUGGLE / GRABBED banner + % | BANNER (state) + TAG | fullscreen | DANGER | ✅ |
| Control Struggle: Contest Track / Control Zone / Break Needle / round timer / success pips / momentum | METER (track) + zone MARK + needle MARK + PIP-ROW + TAG | target orbit (near the grapple, Law 1) | ACTIVE/DANGER | ❌📋 |
| Encased-in-ice struggle (cracks = the meter) | world crack decals driven by `struggle` + 2 hair TAGs (`MASH −45` / `HOLD 2.5/s`) | world + target orbit | DANGER | ❌ |
| Rear-grab opportunity cue | MARK (hand-behind-silhouette glyph) | reticle | READY | ❌📋 |

### 7.6 Stealth, marks, being hunted
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| YOU are pinged/tagged | CHIP (`📡`→glyph) + faint red ground RING (you-only) | status strip + body | DANGER | ❌ |
| Inside smoke | VEIL (grey breathe) + whisper CHIP | fullscreen + strip | ACTIVE | ❌ |
| Reaper mark ×2 | MARK (scythe crescent, screen top) + heartbeat | fullscreen | DANGER | ❌ |
| Psi-link tether | world MARK (line to partner) | world | ACTIVE | ❌ |
| Cloak alpha + move-ripple | world | world | ACTIVE | 🔨 |
| Blind (white-noise bloom, 2s collapse) | VEIL | fullscreen | DANGER | ❌ |

### 7.7 The status strip (the one system for all timers — highest-leverage NEW element)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| The strip itself | FEED-row of square CHIPs w/ radial-wipe timers, slide-in, fade-never-pop | vitals (above stamina) | all | ❌ P1 |
| Feeds: overcharge, SLOWED, possession, EMP, encased, protected, marked, pinged, tagged, smoked, psi-linked | one CHIP each; enemy-sourced = red edge, buff = amber | status strip | per source | ❌ |

### 7.8 LSW — piloting & facing gods
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Signature meter (Q) | METER charge → §8 winner | weapon block (default plate — no maker skin) | ACTIVE→READY | ✅ |
| God hands glow last 20% | world emissive | world | ACTIVE | ❌ |
| Drop countdown `☄ TITAN INBOUND 0:29` | CHIP (t0/t1) + LZ ground RING tightening, panic at T-5 | top bar + world | WARN/DANGER | ✅ |
| Enemy god threat tier | RING notches + first-sight CHIP (SKIRMISH→EXTINCTION) | its body orbit | WARN | 🔨 |
| Gargoyle perch tile | world MARK (red glow + cracks) | world | WARN | ❌ |
| Chronos echo point | world MARK (hourglass at the spot) | world | IDLE | 🔨 |
| Oblivion hole charge | world RING (event-horizon radius + shimmer speed; the physics is the meter — no numbers) | world | ACTIVE→DANGER | ❌ |
| Magnetar halo (tracers curve+fizzle) | world VFX lesson | world | ACTIVE | ❌ |
| Venatrix traps + K9 growl | world MARK glint + audio | world | WARN | 🔨 |
| Leap landing ring tightens | world RING | world | DANGER | 🔨 |

### 7.9 Vehicles — land, air, sea (and under it)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Hull fraction + bar | TAG (`n / max HULL`) + METER gauge | weapon block | READY/WARN/DANGER | ✅ |
| System pips ENG WPN SEN ECM COM | PIP-ROW (ok/hurt/dead) | weapon block | per-pip | ✅ |
| Crew seats ◉●○ + CREW n/m | PIP-ROW; empty wheel blinks | weapon block | IDLE/DANGER | ✅ |
| Mounted WPN recharge (slow guns only) | METER charge | weapon block | ACTIVE→READY | ✅ |
| MISSILE INBOUND | TAG on role line, red blink (top-severity) | weapon block | DANGER | ✅ |
| Flares `G flares ●●●` | PIP-ROW burn-down | weapon block | IDLE | ✅ |
| Afterburner + SONIC BOOM cone-ring + late double-crack | world VFX (flame stretch, shimmer cone, vapor ring 0.4s shred) | world | IMPULSE | ❌→✦ |
| PixelLab flight instruments: airspeed needle + digital %, compass heading, `STALL / CRUISE / AB` | live TAGs + instrument DIAL over the gunmetal reference plate | vehicle instrument plate | IDLE→WARN | ✅ 2026-07-21 |
| Altitude band `G / B / S / C` + Q/E | four-state PIP-ROW; active band repeated in text | vehicle instrument plate + vehicle block | IDLE | ✅ 2026-07-21 |
| Tactical radar / sonar: range rings, scheduled sweep, hollow domain glyphs, last-known hold/fade | RING + rotating MARK sweep + MARK→GHOST; hostile red is redundant with shape and domain label | minimap + vehicle instrument plate | IDLE→WARN | ✅ 2026-07-21 |
| Radar degradation: `SEN DEAD`, `JAM`, offset contact + uncertainty ring | DEAD/WARN TAG + hollow uncertainty RING | minimap + vehicle instrument plate | WARN/DEAD | ✅ 2026-07-21 |
| Rotor spool / `SPOOL n.n` | live TAG countdown; existing rotor world presentation remains separate | vehicle instrument plate | ACTIVE | ✅ 2026-07-21 |
| Bomb pips `BOMBS ▮▮▮▮` / nuke armed | PIP-ROW + everyone's radiation CHIP + hull strobe | weapon block + top bar + world | DANGER | ❌ |
| Hotwire lockpick ring (snaps on move) | RING + snap IMPULSE | target orbit | ACTIVE | ❌ |
| Abandonment/write-off clocks | TAG lines under [E] prompt | walk-up BANNER | IDLE | ❌ |
| EMP stun — pips flicker, `REBOOT n.n` | PIP-ROW flicker + TAG | weapon block | DEAD | ❌ |
| Infected wagon drip + spore smear | CHIP + VEIL grime | weapon block + fullscreen | WARN | 🔨 |
| Ambulance heal bubble breathes w/ pulse | world RING + green-cross IMPULSEs | world | ACTIVE | 🔨 |
| Overload fuse `BAIL — 2.0…` | BANNER (danger, whole block flashes) | fullscreen | DANGER | ❌ |
| Walk-up `[E] Enter · seats` | BANNER (prompt) + PIP-ROW | fullscreen bottom | IDLE | ✅ |
| Submarine `SURFACE / SUBMERGED`, `DEPTH S / D`, sonar-only sweep and surface/submerged returns | CHIP mirror of ALT + minimap RING sweep + distinct surface/submerged MARK shapes | vehicle instrument plate + minimap | IDLE/ACTIVE | ✅ 2026-07-21 |

### 7.10 Fields, domes, time
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Force-field body (soap-film + drift lines; steel-faint yours, red victims) | world volume MARK | world | ACTIVE | ❌ |
| Field charge (`OVERDRAW` on the energy bar + boundary brightens) | METER TAG + world | vitals + world | ACTIVE | ❌ |
| Time-field slow (clock chip + slow casings) | CHIP + world | status strip + world | WARN | ❌ |
| Shield dome hp-cracks ×3 + reflect sheen 2s | world crack stages + sheen burn-off | world | WARN | 🔨 |

### 7.11 Turrets, drones, gadgets
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| FPV static + `LINK ▂▄▆` + horizon tilt | VEIL + CHIP + world | fullscreen + weapon block | ACTIVE→DANGER | 🔨 |
| Drone battery 🔋 on energy bar | METER TAG | vitals | WARN | ❌ |
| Turret flip glitch-flicker 1s | world IMPULSE | world | IMPULSE | 🔨 |
| Mine arming lamp fast→solid | world MARK | world | ACTIVE→READY | 🔨 |
| Skitter leg-taps proximity pitch | audio | — | — | 🔨 |
| Beacons/cameras/fields/traps on minimap | MARK layers (owner-colored, §1.1 families) | minimap | IDLE | ❌ |

### 7.12 The outbreak (three HUD modules from §16.2 not yet fully placed)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Viral chip `42% INFECTED` | CHIP (viral green→red ladder) | vitals | ladder | ✅ |
| Biohazard sector chip `☣ L3` | CHIP (color-climbing) | top bar | ladder | ✅ |
| Corpse HUD: clean/exposed/incubating/burning/CRITICAL rising | world MARK on the body (twitch, smoke, rising-silhouette glyph at T-2s) | world | ladder→DANGER | 🔨 (`corpse_critical` event ships; visuals partial) |
| Nest / contamination field | world MARK (readable cause) | world + minimap | WARN | 🔨 |
| Infection HUD: treatment/incubation estimate | TAG on viral chip (medic/recon gated — open decision) | vitals | ladder | ❌📋 |
| World-map outbreak: quarantine line, spread direction | SHEET + MARK overlay | map screen | ladder | ❌📋 |

### 7.13 Squads (`squadId` ships — `world.ts:539`, squads of 4 — zero UI today)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Squad pips (your 4: alive/downed/dead) | PIP-ROW (● / amber-breathe / DEAD grey) | vitals | per-pip | ❌ |
| Squadmate marks read distinct | MARK (dot + underline tick) | minimap + world | IDLE | ❌ |
| Squad wipe / squad kill feed line | FEED CHIP variant | killfeed | DANGER | ❌ |
| Squad orders (follow waypoint) | MARK diamond (existing waypoints, squad-scoped) | minimap + world | ACTIVE | ❌ |

### 7.14 Modes, objectives, meta
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Objective chips per mode (tdm/ctf/koth/conquest/survival/horde/safehouse/paintball) | CHIP row | top bar | t0/t1/neutral | ✅ |
| Conquest capture fill (point + chip) | world ground RING fill + CHIP fill | world + top bar | ACTIVE | ❌ |
| CTF dropped-flag 25s drain | CHIP slice + world pole dim | top bar + world | WARN | ❌ |
| Wave countdown `NEXT WAVE 0:12` | TAG beside wave chip | top bar | IDLE | ❌ |
| Materiel purse `◈ n` (officers see both) | CHIP | top bar | IDLE | ❌ |
| Weather chip + intensity + AIR GROUNDED | CHIP + struck-through jet glyph | top bar | WARN | 🔨 |
| Match clock / mode name | TAG mono / TAG | top bar | IDLE | ✅ |
| YOU HAVE THE FLAG banner + back-streamer | BANNER (once) + world cloth | fullscreen + world | WARN | ❌ |
| Underfunded-victory ledger | SHEET (career pane) | scoreboard | — | ✅ |

### 7.15 Feeds, records, screens
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Killfeed | FEED of CHIPs (cap 6, 6s) | top-right | t0/t1/zed | ✅ |
| Announce / REPRINTED — PRINT n | BANNER (record) | fullscreen | IDLE | ✅ |
| VO subtitles (earshot-gated) | BANNER (caption) — **font violation, §10** | fullscreen bottom | IDLE | ✅ |
| Chat + channels | FEED + input PLATE | bottom-left | IDLE/GHOST(.old) | ✅ |
| Scoreboard + trophies + flesh/chrome ledger | PLATE + SHEET + trophy CHIPs | screens | — | ✅ |
| Career pane | PLATE | screens | — | ✅ |
| Menu / armory / picker / codex / barracks / scar map / onboarding / pause | PLATE + SHEET + CHIP + clip-cut buttons (all shipped in-grammar) | screens | — | ✅ |
| Minimap full inventory + M large toggle | MARK system | minimap | — | ✅ |

### 7.16 Impulse feedback & the death show
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Hitmarker ✕ 0.18s | IMPULSE MARK | reticle | IMPULSE | ✅ |
| Kill-confirm variant (heavier ✕, one pitch-up tick) | IMPULSE MARK | reticle | IMPULSE | ❌ |
| **Damage numbers** (opt-in): mono, rises 8px over 0.4s, holds 0.2s, fades 0.3s; amber yours, `RED_WORLD` crits; never on teammates | world TAG (IMPULSE class) | world | IMPULSE | ❌📋 — off by default; the world-teaches law prefers flinches, this is an accessibility/readability option |
| Damage/heal vignette | VEIL | fullscreen | IMPULSE | ✅ |
| Respawn overlay K.I.A./SPLAT! | VEIL + display type | fullscreen | DANGER | ✅ |
| Killcam REPLAY banner | BANNER (record, pulse 1.6s) | fullscreen | IDLE | ✅ |
| Spectator/death cam HUD (who you watch: name CHIP, their vitals RING mirrored, cycle TAG) | CHIP + RING + TAG | fullscreen bottom | IDLE | ❌ |
| Ping chevrons / waypoints / blast rings | world MARK | world | ACTIVE | ✅ |
| Contact marks (last-seen) | MARK→GHOST | world + minimap | GHOST | ❌ (W0.2) |

### 7.17 Big-moment VFX (the war's exclamation points)
| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| **NUKE MUSHROOM CLOUD — MISSING.** The Cradle arms and detonates with no signature cloud today. Full treatment: world column+cap VFX (30s linger, Law 6 at landscape scale), white VEIL flash snap→2s bleed, everyone's radiation CHIP, delayed boom by distance (sonic-boom grammar §7.9), minimap scorch GHOST that persists the match | world VFX + VEIL + CHIP + MARK/GHOST | world + fullscreen + top bar + minimap | IMPULSE→held | ❌ **flagged** |
| Sonic boom cone-ring | world IMPULSE | world | IMPULSE | ❌ |
| LSW pod-fall + LZ dread ring | world RING (tightens, panic T-5) | world | DANGER | ✅ |
| Carrion birds (corpse intel layer; scatter betrays flankers; burst at pod T-3) | world boids (they ARE a MARK — living, so curves) | world sky | IDLE | ❌ design locked |
| Blast rings | world RING IMPULSE | world | IMPULSE | ✅ |

---

## §8 · THE INFO-RICH METER SPEC — three candidates, one will rule

Robert (fresh): meters must carry **more information than a fill** — *what* is charging, *how full* (number), *what state* (band word), *what happens at release*. The winner becomes the ONLY continuous meter in the game (reload, Impact Charge, signature, spool, hotwire, struggle) — one shape a player learns once. The shape is **held constant across every manufacturer skin** (§6.3).

### 8.0 The five context layers (every candidate must carry all five)

| Layer | Content | Voice |
|---|---|---|
| L1 SOURCE | what is charging: glyph + word (`⚔ IMPACT`, `SIGNATURE`, `RELOAD`, `SPOOL`) | Oswald 600, `0.66rem`, muted |
| L2 FILL | the geometry itself, amber, `T_FILL` tracking | — |
| L3 NUMBER | live value, mono tabular: `%` for charges, `s` for clocks | Share Tech Mono `0.72rem` (HUD floor) |
| L4 BAND | the ladder word: WIND-UP → HEAVY → MAXIMUM → OVERCHARGE (or CYCLING → READY) | Oswald 700, `0.66rem`, band-colored |
| L5 RELEASE | what release/ready buys: `×2.4 ON RELEASE`, `READY — Q`, `FUMBLE ×1.2` in OVERCHARGE | mono `0.62rem`, muted; flips red in OVERCHARGE |

Band thresholds (shipped tuning, canonical): 0–30% WIND-UP · 31–70% HEAVY · 71–100% MAXIMUM (entry flash = the perfect-release cue) · past-hold OVERCHARGE (DANGER, breathe 0.7s, stamina bleed shown by L5).

### 8.1 Candidate A — SEGMENTED BAR (Field Terminal)
```
 ⚔ IMPACT                        HEAVY   62%
 [▮▮▮▮▮▮▮░░░|░░░]⟨!⟩
  ─────────────────                       <- hairline underline (continuous truth)
 ×1.6 ON RELEASE
```
- Geometry: 10 segments `12×18px`, 2px gaps, total ≈ `152×18px` + caps. Segment 8-10 = MAXIMUM zone (brighter groove); one extra `⟨!⟩` red segment past the cap = OVERCHARGE.
- **The small accent (Robert #2) — DECIDED 2026-07-21: the amber lead-notch tick.** Every segmented meter in the game wears it; bracket caps and the underline stay in the grammar as unused reserves. The three treatments, for the record:
  - **Amber lead-notch tick**: a 2px amber hairline on the leading edge of the filling segment — the eye's anchor (this is the stamina bar's shipped `inset -2px` edge, promoted to law).
  - **Bracket caps**: `[` `]` in `--border-bright`, flipping amber the frame MAXIMUM is entered — the meter quotes the `.brk` corner language.
  - **Hairline underline**: a 1px continuous fill under the quantized row — coarse segments for glance, fine line for timing.
- Layer placement at HUD size: L1 top-left · L4+L3 top-right (band word then number, `0.3rem` gap) · L5 bottom-left · band thresholds are the segment boundaries themselves (8/10 line brighter).
- Feel: most readable, classic-military; quantized "click" per segment can carry one audio tick each.

### 8.2 Candidate B — ANALOG DIAL (Gunmetal)
```
        WIND-UP    HEAVY
      ╱  ╱    |    ╲  ▓╲      <- 270° sweep, start 135° (ring grammar)
     ▕   ·   62%  ·   ▓ ▏     <- gold inlay 71-100%, red wedge past
      ╲   ╲ [HEAVY] ╱!╱       <- band window under pivot (odometer)
        ⚔ IMPACT · ×1.6
```
- Geometry: `64px` diameter at HUD (÷2 of the 128 body canvas — same arc constants: start 135°, span 270°). Needle 2px, counterweighted; MAXIMUM = gold arc inlay; OVERCHARGE = red wedge past 100% with the needle shaking ±2° at 0.7s period (the breathe, made physical).
- Layer placement: L3 center numeral (`#f0d9a8`, the ring-numeral grammar) · L4 in a cut window under the pivot · L1+L5 engraved plate line below the dial · thresholds as radial ticks at 30/70/100%.
- Feel: most physical, most manufacturer-skinnable bezel (§6 frames were literally drawn around a gauge) — but the smallest numerals of the three.

### 8.3 Candidate C — BODY-ORBIT ARC (Recon Holo — the Law 1 purist)
```
        ◜▓▓▓ 62 ▓╮            <- arc r=60 on the 128 canvas, number rides the tip
      ◜           ◝           <- ticks at 30/70/100%
      ▏  (soldier) ▕
      ◟           ◞
        ◟  HEAVY ◞            <- band word under the feet, 0.68rem
```
- Geometry: radius `RING_R+16 = 60px` on the existing 128px body canvas, 270°, width 5px — outside the plate arc (r54) so vitals stay legible. Fills clockwise from the 135° start.
- Layer placement (clutter-capped — the action is UNDER this meter): L2 arc · L3 number rides the arc TIP (follows the leading edge, mono `0.72rem`) · L4 band word centered under the feet · L1 glyph at arc origin only (⚔/☄) · **L5 lives in the weapon block, not the orbit** — the one layer this shape delegates to the corner.
- MAXIMUM = arc flips to full-bright accent + tick flash; OVERCHARGE = arc breathes red; release = arc collapses into the strike direction over 0.15s (the spec's "directional strike cue").
- Feel: most "near the action" (Law 1), doubles for target-orbit struggles (the same arc wraps the grapple); weakest for L5 detail.

### 8.4 The decision rule
Whichever wins: the other two shapes are DELETED from the language — no element may use a losing shape "just this once." Struggle bars, reload, signature, spool, hotwire, FPV link, drone battery all re-render in the winner within one build wave. Pip-rows (quantized counts) are exempt — LOCKED as pips.

---

## §9 · HOW TO ADD A NEW ELEMENT — the forcing function (5 steps)

1. **Name the truth.** Which sim field(s) does it read, live? (Law 2.) No sim field → no element — go add the field first.
2. **Climb the placement ladder** (§5): world-wearable? → body orbit → target orbit → reticle → world mark → corner summary → screen. Take the FIRST surface that can carry it; check that surface's budget.
3. **Compose from §2 only.** Pick primitive(s) and write the composition line (e.g. `CHIP + radial wipe, status strip`). Cannot compose it? STOP — amend the grammar in §10 first, then continue.
4. **Wire the states.** Map every value range onto the seven §3 states; take colors and motion ONLY from §1.5/§3-4. Confirm: holds-then-fades (§4.2), one breathe max added to the surface, no purple, meter shape = the §8 winner, skin-invariant (§6.3).
5. **Prove it.** Add the row to §7 (element | primitives | surface | states | status), screenshot it in the harness, and check it reads by SHAPE with color removed (Law 3).

A PR that adds a display element without its §7 row does not merge.

---

## §10 · GRAMMAR CHANGELOG & STANDING VIOLATIONS

**Amendments made by this document (the "fix the grammar" clause in action):**
- Added **FEED** — killfeed/chat/captions were not expressible as bare CHIPs (they have caps, lifetimes, and entry motion).
- Added **VEIL** — vignettes/static/blind had no primitive.
- Added **SHEET** — the codex/scoreboard table pattern, screens-only.
- Canonized the charge ladder as WIND-UP/HEAVY/MAXIMUM/OVERCHARGE (HEAVY supersedes spec CHARGED; matches shipped bands).
- **2026-07-21 (WEAPON-CARDS.md):** §6's manufacturer-skin scope widened from "the weapon block ONLY" to **the weapon block + weapon cards** — a card is the gun's paper twin and wears the same maker chrome (vector chrome derived from `BRAND_STYLES`; the 512×224 frame shells stay HUD-only).
- **2026-07-21 (WEAPON-CARDS.md):** §8's one-meter law gains an explicit exemption for **static stat-bars on cards** — a printed spec-sheet bar (DMG/RATE/DPS/RNG/CLIP, never animating, never derived-live) is PRINT, not telemetry; the law governs meters that MOVE.

**Standing violations to burn down (each is a small fix, none blocks new work):**
| Violation | Where | Fix |
|---|---|---|
| `#f5b21a` stray amber | `hud.ts:205` reload tint | → `#e8a33d` |
| `IBM Plex Mono` | `#vo-sub` (`styles.css:398`) | → `--font-mono` |
| `ui-monospace` stack | `#down-banner` (`styles.css:102`) | → `--font-mono` |
| `9px Inter` | minimap waypoint numerals (`hud.ts:734`) | → `9px 'Share Tech Mono'` |
| `999px` pill | `.bk-medal` (`styles.css:705`) | → radius 2px + bracket or clip-cut |
| Full-color emoji in HUD chips | weather 🌧, objective ✊🎯🔫🧪, equip icons | → single-codepoint glyphs / icon art (screens keep theirs until trophy art lands) |
| Two hull/ready green ramps in JS (`#46d17a` vs `RING_COLORS`) | hud.ts / ring.ts | → one exported palette module reading §1.1 |

*Every future amendment gets a dated line here. The grammar is allowed to grow; it is not allowed to be bypassed.*
