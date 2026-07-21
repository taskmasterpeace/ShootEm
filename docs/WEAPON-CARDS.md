# WEAPON CARDS — the arsenal, dealt

> **Provenance:** Robert's direction, 2026-07-21 (verbatim intent): *"We need weapon cards. I don't know where we would use them, but we need weapon cards. And I know we got models for all the weapons."* This document is BOTH answers: the card itself (§1, §3, §4) and the catalog of everywhere it earns its keep (§2). DESIGN ONLY — nothing here has shipped.
>
> **Doctrine:** ONE card, three sizes, one grammar. A weapon card is the *trading-card portrait of a machined object* — the same way the Dossier is the soldier's paper, the card is the gun's. It composes entirely from UX-LANGUAGE §2 primitives (it is a PLATE holding METERs, CHIPs, and TAGs — no new primitive), wears its manufacturer's chrome (§6 skin system, extended — see §5.2), and has exactly two states of being: **STOCK** (the pattern) and **STORIED** (the piece, with a serial and a ledger — `docs/WEAPON-MEMORY.md`).

**Companions:** `docs/UX-LANGUAGE.md` (the grammar this composes from) · `docs/WEAPON-MEMORY.md` (the service-history layer, §1 GunRecord) · `docs/reference/hud/README.md` (the 6 empty manufacturer shells) · `src/client/models/weapons.ts` (`buildWeaponModel`, `BRAND_STYLES`, `parseBrand`) · `src/sim/data.ts` + `src/sim/arsenal.ts` (every stat a card can show).

---

## §0 · THE INVENTORY THE CARD MUST COVER (counted, not guessed)

| Pool | Count | Source |
|---|---|---|
| Generated family guns (16 families × 4 brands × 3 marks) | **192** | `arsenal.ts:94-132` (`buildArsenal`), families `arsenal.ts:64-81` |
| Grenade-launcher line (frag/smoke/wp × Mk I-III) | **9** | `arsenal.ts:137-159` |
| Hand-tuned carryables (AR-606, CAW-8, RG-2, markers, axe, CL-40…) | **~20** | `data.ts:23-109` |
| **Card-bearing total (the portrait universe)** | **~220** | — |
| LSW signature arms (default plate — a god has no manufacturer, UX §6.4.5) | 40 | `data.ts:141-190` |
| Vehicle guns / zed attacks / alt-fire internals (codex rows only, maklov-default chrome) | ~36 | `data.ts:66-108` |
| WEAPONS table grand total | ~296 ("~300 rows", `codex.ts:492`) | `data.ts:192` |

Every id builds a deterministic model: `buildWeaponModel(weaponId)` (`weapons.ts:717-730`) routes family → builder, `parseBrand` (`weapons.ts:708-712`) → `BRAND_STYLES` (`weapons.ts:33-40`), tier → mark bands (`weapons.ts:66-75`). Unknown ids still build honestly (fallback rifle/maklov). Budget: ≤500 tris, most <300 (`weapons.ts:16`) — the census tool already audits this live (`armorysheet.ts:147-168`).

---

## §1 · THE CARD ANATOMY

### 1.1 The one card, three sizes

| Size | Px (@1x) | Job | Portrait | Service layer |
|---|---|---|---|---|
| **FULL** | **340×210** | detail views: codex detail pane, honors, inspect ledger, export | live turntable OR baked still, 324×88 bay | full band: serial · top tally · CONFIRMED · stamp glyphs |
| **COMPACT** | **240×140** | lists & grids: armory slots, picker grid, killcam footer, dossier shelf, reward previews | baked still, 96×62 | one line: `№ · NAME (×N) · K CONFIRMED` |
| **MICRO** | **120×70** | hover-chips: killfeed hover, scoreboard hover, inline references | baked still, 112×36 strip | amber serial tick + `×N` tag only |

All three are DOM elements (screens are DOM in this game — `main.ts` picker, `codex.ts` sheets), radius `2px` (`--radius`), 1px `--border`, corner brackets 10px (`.brk` default ladder, UX §1.4), amber brackets when `.selected`. **Zone geometry is identical in every manufacturer skin** — chrome varies, the grammar never moves (mirror of UX §6.3).

### 1.2 FULL — 340×210, zone by zone

```
┌╔══════════════════════════════════════╗┐  340×210 · pad 3px · maker chrome border
│║ MAKLOV               R-2 · MK II ▮   ║│  HEADER 22px  (maker wordmark / family code + tier TAG)
│╠──────────────────────────────────────╣│
│║ ┌──────────────────────────────────┐ ║│
│║ │        ╓─╥──────────╥────═▶      │ ║│  BAY 88px  (portrait: muzzle +X → points RIGHT,
│║ │        ╙─╨────╥─────╨            │ ║│   inner well 324×88, --bg-deep floor, maker tell echo)
│║ └──────────────────────────────────┘ ║│
│║ MAKLOV R-2 RIFLE                     ║│  NAME 20px  (Saira Stencil One 0.9rem — codex-name voice)
│║ DMG    RATE   DPS    RNG    CLIP     ║│  STATS 32px (5 columns × 62px:
│║ ▓▓▓░░  ▓▓▓▓░  ▓▓▓░░  ▓▓▓▓░  ▓▓░░░   ║│   label 0.62rem / meter 4px / value 0.72rem mono)
│║ 13     7.5    68     66     30       ║│
│║ [BALL][AP][INC] · LONG · TTK 8·0.9s  ║│  CHIPS 20px (ammo-compat CHIPs + band TAG + TTK TAG)
│║ ── №1187 · VEX ×5 · 23 CONFIRMED ──  ║│  SERVICE 22px (STORIED only; STOCK = empty band, hairline)
└╚══════════════════════════════════════╝┘
     22+88+20+32+20+22 = 204 + 6px padding rhythm = 210 ✓
```

| Zone | Height | Content | Voice / primitive |
|---|---|---|---|
| HEADER | 22px | maker wordmark left (Oswald 700, 0.66rem, ls 0.2em, uppercase) · family code + `MK n` + tier ticks right (`▮` per mark band, echoing the barrel bands `weapons.ts:66-75`) | TAG pair riding the PLATE |
| BAY | 88px | the portrait (§3): model render, muzzle +X → pointing RIGHT, on a `--bg-deep` well; storied guns show the engraving decal (WEAPON-MEMORY §2.2) | PLATE well; the ONLY image on the card |
| NAME | 20px | `def.name` verbatim (`arsenal.ts:109` format: "Maklov R-2 Rifle"), uppercase | Display voice — same as codex names (UX §1.2) |
| STATS | 32px | 5 micro-meters (§1.4) | METER ×5, static (§5.3 ruling) |
| CHIPS | 20px | ammo-compat CHIPs (§1.5) + range-band word TAG + TTK TAG | CHIP + TAG |
| SERVICE | 22px | §1.6 — serial, headline tally, CONFIRMED, stamp glyphs. STOCK: the band stays (constant geometry for grids) but holds only its top hairline — **silence is what a fresh print sounds like** (WEAPON-MEMORY §2.1) | TAG line; HIDDEN→shown per UX §3 |

### 1.3 COMPACT — 240×140 · MICRO — 120×70

```
COMPACT 240×140                          MICRO 120×70
┌╔════════════════════════╗┐             ┌╔══════════╗┐
│║ MAKLOV      R-2 · MKII ║│ 18px        │║ ──═▶     ║│ 36px portrait strip
│║ ┌────────┐ DMG ▓▓▓░ 13 ║│             │║ R-2 MKII ║│ 12px name (0.62rem)
│║ │ ──═▶   │ RATE▓▓▓▓ 7.5║│ 66px       │║ 68DPS·66u║│ 12px data line (mono)
│║ └────────┘ RNG ▓▓▓▓ 66 ║│             └╚══════════╝┘
│║  96×62     CLIP▓▓░  30 ║│             storied: amber № tick
│║ [BALL][AP][INC] · LONG ║│ 18px        top-right + ×N after name
│║ №1187 · VEX ×5 · 23 CFM║│ 18px
└╚════════════════════════╝┘
  18+66+18+18 = 120 + 20px gaps/pad = 140 ✓
```

- COMPACT drops the DPS meter (4 bars: DMG/RATE/RNG/CLIP — DPS moves to the data the name line's right edge if space allows), name moves into the portrait row's right column header (Oswald 600 0.85rem, no stencil at this size).
- MICRO is a *reference chip*, not a datasheet: portrait strip + name + one mono line (`68DPS · 66u · 30rd`). No meters, no chips. Storied = amber serial tick (2px corner notch) + `×N` after the name.
- Truncation law: names ellipsize, never wrap; the id's family code + mark (`R-2 · MK II`) is the fallback short name (codes from `arsenal.ts:64-81`, brand short codes from `armorysheet.ts:21-23`).

### 1.4 The stat row — which five, and why

Chosen to match what players already read in the picker telemetry line (`main.ts:77-81`) plus the one derived number they actually feel:

| Meter | Value | Derivation | Normalization (bar fill) |
|---|---|---|---|
| **DMG** | damage/shot, `×n` TAG when pellets>1 | `def.damage` (`def.pellets` — `data.ts:29` CAW-8 9×8) | v / p95 of carryable pool |
| **RATE** | rounds/s | `def.rof` | v / p95 |
| **DPS** | sustained | `sustainedDps()` — clip·dmg / (clip/rof + reload) (`codex.ts:104-109`) — the honest average, not the burst lie | v / p95 |
| **RNG** | reach in u | `def.range` | v / 125 (RG-2 is the ceiling, `data.ts:30`) |
| **CLIP** | magazine | `def.clip` (`∞` renders full bar + `∞` numeral, codex convention `codex.ts:161`) | v / p95 |

- Bars: 4px tall on a `--bg-deep` track, fill amber at 70% alpha (a stat is information, not a severity — no state colors), leading-edge 1px bright tick (the stamina-bar accent promoted to law, UX §2.7 note). p95 percentiles computed ONCE from the ~220 carryable defs at module load — deterministic, no magic constants in markup. Floor fill 4% (a sliver, never zero — the bar must read as a bar).
- Derived TAGs on the chip row: **range band word** (CQ <30 · MID 30-59 · LONG 60-89 · SIEGE ≥90 u — AR-606's 66 = LONG, CAW-8's 26 = CQ) and **TTK vs 100hp** (`shots = ceil(100/(dmg·pellets))`, `t = (shots−1)/rof` → `TTK 8 · 0.9s`).
- Family substitutions (same slots, honest labels): healers (`heals: true`) relabel DMG→HEAL; launchers with `splash` swap CLIP's chip-row TAG for `SPL 6.0u`; `knockback ≥ 16` earns a `RAGDOLLS` TAG (the threshold restated at `codex.ts:218`); markers (`training: true`, `data.ts:97-99`) wear a `TRAINING` chip and suppress TTK (paint doesn't kill).

### 1.5 Ammo-compatibility chips

Derived from the same test the HUD already runs (`hud.ts:284-285`: ballistic = `tracer === 'bullet' || 'shell'`):

| Chip | Shown when | Meaning |
|---|---|---|
| `BALL` | ballistic | plain rounds — always first |
| `AP` `INC` | ballistic | B-cycle compatible (OUTBREAK-SPEC §11; AP equipment gate `data.ts:537`) |
| `ENERGY` | tracer plasma/rail/beam | cell-fed, no ammo-type cycling |
| `SMOKE` / `FIRE` / `CONC` | `def.payload` set (`data.ts:48-50`, `arsenal.ts:137-141`) | what the round delivers |
| `TRAINING` | `def.training` | paint — never engraves, never drops (WEAPON-MEMORY §1.3) |

Chips are the §2.3 CHIP primitive at square-icon size: steel border, muted text, NO state motion (a card is at rest). Max 3 visible + `+n` overflow.

### 1.6 The service layer — STOCK vs STORIED

The two states of one card. STORIED requires WEAPON-MEMORY slice 1 (the `GunRecord` registry — serial, `tallies[]`, `kills`, `vehicleStamps`, `lswStamps`, `owners[]`, WEAPON-MEMORY §1.1).

| Element | STOCK | STORIED |
|---|---|---|
| SERVICE band | empty band, top hairline only (geometry constant) | `№1187 · VEX (×5) · 23 CONFIRMED` — serial mono, headline = highest tally (×N only when N≥2, WEAPON-MEMORY §2.1 copy law), total right |
| Stamp glyphs | — | after CONFIRMED: hull silhouettes ×`vehicleStamps`, one skull per `lswStamp`, `SHAMBLERS ×214` folds to a single TAG (hordeKills never gets lines, WEAPON-MEMORY §1.2) |
| BAY portrait | clean model | model + engraving decal strip (the per-serial CanvasTexture, +2 tris — WEAPON-MEMORY §2.2) and denial scorch tint if earned |
| Serial tick | — | 2px amber corner notch (all sizes — the "this is a piece, not a pattern" mark) |
| Owner chain | — | FULL only, on inspect-expand: last 3 names, muted mono |

State grammar: the service band enters via HIDDEN→shown (`T_IN`, UX §3) the first time a gun earns a line; it never animates otherwise. A card never breathes — nothing on it is a live severity. The ONE sanctioned motion: the kill-moment engrave flash on the weapon-block plate (WEAPON-MEMORY §2.1) — that belongs to the HUD plate, **not** to cards.

---

## §2 · THE USAGE CATALOG — everywhere the card earns its keep

Robert: *"I don't know where we would use them."* Here is where. Ordered by build value; sizes and triggers exact.

| # | Surface | Size | Trigger | What the card replaces / adds | Grounding |
|---|---|---|---|---|---|
| U1 | **Armory loadout slots** (deploy screen) | COMPACT ×2 | always, on class select | the current `slot-icon` emoji + name + telemetry text rows (`main.ts:84-99`) become real cards — your primary and sidearm ARE cards on the desk | `renderArmorySlots` |
| U2 | **Weapon picker grid** | COMPACT grid | opening SELECT PRIMARY/SIDEARM | today's `wp-card` buttons (emoji icon + `MK` chip + text stats, `main.ts:158-173`) become cards; `.selected` = amber brackets; `◆ ISSUE` stays as a TAG; family rail + search unchanged | `openWeaponPicker` `main.ts:105-141` |
| U3 | **Codex weapons chapter** | MICRO (sheet rows) + FULL (detail pane) | codex open | the weapons section is the ONLY one with no model today (`codex.ts:461` — no `model` kind; detail pane literally prints "No model — this is a weapon system, carried", `codex.ts:586`). MICRO portraits slot into the existing 132×88 thumb cell (`codex.ts:432`); the detail pane mounts a FULL card with live turntable (reuse `mountTurntable` spin, `codex.ts:606-628`) | SECTIONS table |
| U4 | **Killcam footer — "KILLED BY"** | COMPACT (storied) | `director.killcamActive` (`replay.ts:222`), killer known (`replay.ts:239` ← `lastKillerId`) | the dead man reads the gun that did it — including, if he's a repeat customer, HIS OWN NAME on its service line (the revenge-loop ignition, WEAPON-MEMORY §2.3). Composes with backlog **9.15** Killer's Service Card (`MASTER-BACKLOG.md:142`) — soldier card left, weapon card right | replay director |
| U5 | **Killfeed hover** | MICRO | mouse hover ≥150ms on a `kf-entry`'s weapon span (`hud.ts:824`, the `.wpn` cell) | the feed already names the weapon; hover materializes it. Enters `T_IN`, anchored below the entry, dies with the entry (6s cap, `hud.ts:827-828`). Never during pointer-lock combat aim — pause/spectate/death only | killfeed `hud.ts:818-828` |
| U6 | **Dropped-weapon inspect prompt** | COMPACT (storied) | walk-up to a `'weapon'` pickup (WEAPON-MEMORY §3.3 E-hold) | the loot moment: BEFORE you swap, the card shows what the dead man's gun has done — beside it, your current gun's MICRO for the trade-off read. The card IS the "should I?" | WEAPON-MEMORY §3 |
| U7 | **End-of-match honors** | FULL | `m.over` trophies roll (`hud.ts:781` `renderTrophies`) | **WEAPON OF THE MATCH**: the highest-kill weapon from the tracker's fold (`byWeapon` best, `record.ts:262-263`) dealt face-up under the trophies — storied if a serial survived to the whistle | scoreboard |
| U8 | **Dossier armory shelf** | COMPACT wall | career/barracks screen | `Dossier.armory` was built waiting for this cargo (`record.ts:31` — "personal armory — weapons with service history") + `perWeapon` records (`record.ts:13`) fill the service band from career data (kills, longestHit, matches) even before per-serial ledgers land | the Record |
| U9 | **Science-mission reward previews** | COMPACT + delta TAGs | mission brief screens | weapons-tech rewards ("upgrade a signature arm", `SCIENCE-MISSIONS.md:49`) preview as the card you'd earn, with amber `+` delta TAGs on the changed meters — the reward moves a number the player already watches, in the card's own grammar | SCIENCE-MISSIONS law |
| U10 | **The share/export artifact** | FULL @2x → 680×420 PNG | export button on FULL cards (dossier, honors) | the card as the MARKETING UNIT: a screenshot-ready object for Robert's universe ambitions — one gun, one story, one image. Export composites the card DOM to canvas + a 512×224 portrait re-bake; filename `weaponId-serial.png` | §3.4 |

**Placement law (UX §5):** cards are SCREEN furniture and deliberate-moment furniture (killcam, walk-up inspect, honors). They NEVER ride the live HUD — the bottom-right weapon block stays the §6-skinned PLATE with live meters; a card is the *record*, the plate is the *instrument*. The killfeed-hover MICRO is the only card that touches a HUD surface, and only under a mouse that isn't aiming.

---

## §3 · THE RENDER PIPELINE — how portraits get made

### 3.1 The two shipped precedents, weighed

| Approach | What it does | Verdict for cards |
|---|---|---|
| **Contact sheet** (`/armory.html` → `armorysheet.ts`) | ALL ~200 models live in ONE scene at 4.5× scale (`armorysheet.ts:16`), one camera walks rows; labels are projected DOM | right for a lab page, wrong for cards — no per-id crop, one giant live scene, shadows/ground baked in |
| **Codex thumb bench** (`codex.ts:374-452`) | ONE shared offscreen `WebGLRenderer` (`preserveDrawingBuffer: true`, `codex.ts:376`), per-id build → `frame()` fit-solve → render → `toDataURL` into a `Map<string,string>` cache (`codex.ts:372`); plus a live turntable variant (`mountTurntable`) | **adopted** — this IS the card pipeline; it just doesn't know about weapons yet |

**Decision: extract the codex bench into a shared `src/client/portraits.ts` module** (bench + cache + fit-solve move out of `codex.ts`; codex re-imports). Add kind `'weapon'` → `buildWeaponModel(id)`. Cache keys: `wpn:<weaponId>` stock · `wpn:<weaponId>:<serial>` storied (portrait re-rendered with the engraving decal applied).

### 3.2 Portrait spec (one bake serves all three sizes)

| Parameter | Value | Why |
|---|---|---|
| Bake size | **256×112, alpha PNG** (16:7) | downscales clean to 324×88 / 96×62 / 112×36; one bake per id |
| Pose | profile, muzzle +X → screen-right; yaw **−0.25 rad**, pitch ~−0.12 | the contact sheet's proven angle (`armorysheet.ts:90`) — enough 3/4 to read girth and tells, still a silhouette |
| Camera | perspective fov 38, fit via the codex `frame()` solve (`codex.ts:414-427`) adapted to fixed 16:7 aspect | the roster runs pistol (~0.4u) to AT tube (~1.2u, `armory.html:33` "a rifle is ~0.9u in hand") — solve, never guess a scale |
| Lights | the codex rig exactly: hemi `0xdfe9f2/0x53514a` @1.15 + dir `0xfff2d8` @1.5 from (6,12,8) (`codex.ts:381-384`) | "a codex lit differently is a codex that lies" — cards obey the same law |
| Background | transparent — the card's BAY well provides the floor | maker chrome tints the well, not the bake |
| No purple check | mark bands/glows are house amber `ACCENT 0xe8a33d` (`weapons.ts:42`); harkov lens is `0x66ccff` | already legal |

### 3.3 Live vs baked, and the boot question

**Boot-atlas rejected.** ~220 ids × (build ≤500 tris + render + `toDataURL` ≈ 3-6ms each) ≈ **0.7-1.4s of main-thread jank** at boot for cards nobody has opened. Instead:

1. **Lazy bake, chunked:** portraits bake on first request, ≤4 ids per frame (≈≤6ms/frame budget), request-ordered by visibility — the picker's current family filter (~12-15 visible ids) fills in under 250ms; a full "All" scroll back-fills as rows enter view (the codex sheet already uses `loading="lazy"` imgs, `codex.ts:555` — same instinct).
2. **Session cache:** `Map<string, dataURL>` — ~220 × ~20KB ≈ **4.5MB strings worst case**, capped by LRU at 256 entries. No persistence; bakes are deterministic and cheap to redo next boot.
3. **Live turntable:** FULL detail views only (codex detail, honors), max ONE mounted at a time (the codex `raf`-singleton pattern, `codex.ts:615`), spin 0.006 rad/frame (`codex.ts:623`). Everything else is a still.
4. **Storied re-bakes** are bounded by reality: only guns with ledgers YOU are looking at (killcam killer, your two slots, inspect target) — single digits per match.

### 3.4 Budgets (acceptance numbers)

| Item | Budget |
|---|---|
| bench renderers alive | 1 (shared), + 1 turntable canvas max |
| bake cost | ≤4 ids/frame; picker first-paint of a family filter < 250ms |
| portrait memory | ≤5MB dataURL cache (LRU 256) |
| card DOM | COMPACT grid of 200 cards scrolls at 60fps (they're static DOM + one `<img>` each — no per-card canvas, no per-frame JS) |
| model tris | portraits inherit the ≤500 armory law (`weapons.ts:16`); storied decal +2 tris (WEAPON-MEMORY §2.2) |
| export | 680×420 @2x composite ≤ 50ms, user-initiated only |

---

## §4 · CARD CHROME PER MANUFACTURER

The frame varies; the content grammar is constant (the §6.3 constants apply verbatim: zone geometry, fonts, meter shape, state colors, 4.5:1 contrast floor, no purple).

### 4.1 The asset question, ruled

The six PixelLab empty shells (`docs/reference/hud/frame-empty-*.png`, 512×224, seed 21) are **weapon-block art**: their aspect (2.29:1) and baked bay/groove layout don't fit the card ratios (340×210 = 1.62:1), and 9-slicing them shears the bay art. **Cards ship on VECTOR chrome derived from the same `BRAND_STYLES` record the guns are built from** (`weapons.ts:33-40`) — zero new art, crisp at all three sizes, ratio-proof. The PixelLab path stays open as an upgrade: commission card-ratio shells (512×320, seed 21, same empty-bay law — content composites live, nothing baked) for FULL only; COMPACT/MICRO stay vector forever (pixel-art chrome at 120×70 is mush).

### 4.2 The six vector chromes (each derived from the maker's own record)

| Maker | Bezel (from `metal`/`furniture` hexes) | Border | Tell echo (the ONE brand detail) | Header treatment |
|---|---|---|---|---|
| **maklov** | `#23231f`/`#3a352b` | 1px steel | none — plain stamped steel, THE default (and the fallback for unknown/vehicle/LSW ids per UX §6.4.2-3) | furniture wash 25% |
| **titan** | `#1c1c1a`/`#2b2620` | **2px**, brackets thickened to 3px | slab: a 3px top rail with 1px bevel highlight across the header (girth 1.2 made visible) | heavier, darker |
| **kuchler** | `#4a4e55`/`#39404a` | 1px + 1px inset double hairline | vents: three 6×2px slots cut into the header band's right run (echoes `weapons.ts:82-86`) | cool steel, tighter ls |
| **harkov** | `#262b24`/`#2e3428` | 1px | optic: a 10×6px lens slot top-right with a 2px `#66ccff` glint (echoes the lens, `weapons.ts:96-99`) | wordmark ls stretched 0.3em (the long-frame) |
| **ceres** | `#2d2a24`/`#4a3d28` | 1px warm | drum: 2×2px brass rivet squares at all four inner corners; BAY floor warmed toward the furniture hex | ornate brass tint |
| **kamenel** | `#2a2320`/`#33291f` | 1px | coil: a 1px amber seam hairline under the header + a 2px `#ff7a1a` @40% coil dot at the bay's muzzle corner (echoes the seam/coil, `weapons.ts:100-105,301`) | ember-warm |

Selection is `parseBrand(weaponId)` — the exact call the HUD skin uses (UX §6.4.1); the gun in the bay and the chrome around it CANNOT disagree because they read the same record. Skin may touch: bezel palette, border weight, tell echo, header wash, bay-floor tint. Skin may never touch: zone px, fonts, meter geometry, chip shapes, state colors, the service band's layout.

---

## §5 · GRAMMAR COMPLIANCE — and the two amendments this design requires

### 5.1 Composition audit (UX §9 step 3 — passed)

`CARD := PLATE( TAG-header + portrait-well + TAG-name + METER×5 + CHIP-row + TAG-service )`. No new primitive. States used: IDLE (the card at rest), `.selected` amber brackets (picker), HIDDEN→shown for the service band. No breathing, no blinking — a card never carries live severity.

### 5.2 Amendment A — the §6.4.6 scope stop

UX-LANGUAGE §6.4.6 reads: *"manufacturer skinning applies to the weapon block ONLY."* Its intent is that PLAYER-IDENTITY surfaces (vitals, top bar, minimap) never skin — one player, one HUD. A weapon card is not a player surface; it is the weapon itself, on paper. Proposed amended text: *"manufacturer skinning applies to WEAPON-SCOPED surfaces only: the weapon block and weapon cards. Vitals, top bar, minimap, and non-card screen chrome never skin."* Log in UX §10 with date on adoption.

### 5.3 Amendment B — the static stat-bar ruling

§8.4 makes the §8 winner "the ONLY continuous meter in the game." Card stat bars are **print, not telemetry**: they render fixed `WeaponDef` data (still Law-2-derived — from the table, deterministically), track nothing live, and carry no states. Ruling to log: *"§8 governs continuous LIVE meters. Static comparison bars on cards/sheets are METER-primitive in permanent IDLE, motion NONE, and are exempt from the §8 shape decision — but adopt the winner's visual dialect (segment texture or fill style) once chosen, so the two never look like siblings from different families."*

### 5.4 New §7 enforcement rows (add on adoption, per UX §9.5)

| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Weapon card (FULL/COMPACT/MICRO) | PLATE + TAG + METER×5 + CHIP row | screens, killcam footer, walk-up prompt | IDLE / selected / service-HIDDEN→shown | 📋 this doc |
| Killfeed weapon hover | MICRO card | killfeed (non-combat pointer only) | IDLE | 📋 this doc |
| Weapon of the Match | FULL card | scoreboard honors | IDLE | 📋 this doc |

---

## §6 · BUILD PLAN — three slices

Gates for every slice (standing orders): `tsc` clean · full vitest suite · production build · no-push hold · Playwright screenshot per new surface · every screenshot checked against Law 3 (reads by shape, color removed) and the no-purple sweep.

### Slice 1 — THE CARD + THE ARMORY (static, no portraits yet)

Scope: `src/client/cards.ts` — one function, `renderWeaponCard(weaponId, size, opts)` → DOM element; the five-meter stat row with p95 normalization computed from the WEAPONS table; ammo chips; six vector chromes off `BRAND_STYLES`; empty BAY well (portrait lands slice 2 — the bay shows the family code stencil, no emoji). Wire U1 (armory slots, replacing `renderArmorySlots` internals `main.ts:84-99`) and U2 (picker grid, replacing the `wp-card` build `main.ts:158-173`; family rail, search, issue-first ordering untouched).

Acceptance:
1. Picker shows COMPACT cards for all ~200 eligible ids; a titan card is visibly heavier chrome than a kuchler beside it; `.selected` flips amber brackets; `◆ ISSUE` TAG preserved.
2. Stat bars: `rifle_titan_3` out-fills `rifle_kuchler_1` on DMG and under-fills it on CLIP (the sidegrade law made visible, `arsenal.ts:37-41`); ∞-clip renders full bar + `∞`.
3. Zone geometry byte-identical across all six chromes (DOM audit: same offsets per zone).
4. Contrast ≥4.5:1 for every text/bezel pairing in all six skins; zero hues in 270-320.

### Slice 2 — THE PORTRAITS + CODEX + KILLFEED (the card gets its face)

Scope: extract the codex bench into `src/client/portraits.ts` (bench, `frame()` solve, cache; codex re-imports — zero behavior change to existing sections); add `'weapon'` kind → 256×112 alpha bakes, lazy ≤4/frame + LRU 256; portraits into all slice-1 cards; U3 codex weapons chapter (MICRO in the sheet's thumb cell, FULL + turntable replacing the "No model" detail pane `codex.ts:586`); U5 killfeed hover MICRO; U9 reward-preview variant (delta TAGs).

Acceptance:
1. Codex weapons detail pane shows a spinning weapon for any row — the "No model — this is a weapon system, carried" string is deleted.
2. Picker family filter first-paint fully portraited < 250ms; scrolling "All" back-fills without frame drops (perf trace attached).
3. One bench renderer total; turntable singleton verified (open two details in sequence — one RAF loop).
4. Bake determinism: same id → identical dataURL across two bakes in one session.

### Slice 3 — THE SERVICE LAYER + THE MOMENTS (needs WEAPON-MEMORY slice 1)

Scope: storied state fed by `GunRecord` (serial, tallies, stamps — WEAPON-MEMORY §1.1 via the snapshot); storied portrait re-bake with the engraving decal; U4 killcam footer (COMPACT storied card of `director.killerId`'s gun, composed with backlog 9.15's soldier card); U6 dropped-weapon inspect card at the E-hold prompt; U7 Weapon of the Match in the trophies roll; U8 dossier shelf (career-data service bands from `perWeapon`, per-serial ledgers where a gun survived the whistle); U10 PNG export.

Acceptance:
1. Kill the same bot 5× → your slot card's service band reads `VEX (×5) · 5 CONFIRMED`; a fresh respawn reissue shows the empty band (the Serial Law, WEAPON-MEMORY §5).
2. Die to a storied gun → killcam footer deals its card, your own name legible on its top line (Playwright screenshot vs reference).
3. Walk up to a field drop → COMPACT storied card + your gun's MICRO render before any swap input is accepted.
4. Match end → WEAPON OF THE MATCH card matches the tracker's `byWeapon` argmax; export produces a 680×420 PNG named `weaponId-serial.png`.
5. Both UX-LANGUAGE amendments (§5.2, §5.3) and the three §7 rows are committed to `docs/UX-LANGUAGE.md` §10 in the same wave.

---

*Filed under the armory, beside WEAPON-MEMORY. The printer makes soldiers; the war makes weapons; the card is how a weapon shows its papers.*
