# BIG MOMENTS — WAR WORLD: EARTH
### The spectacle doctrine, headlined by THE NUKE. Design spec, 2026-07-21.

Robert: *"We got nukes even though I haven't seen a mushroom cloud yet."*

He's right, and the audit below proves it's worse than that: the nuke doesn't
just lack a cloud — the client drops the entire moment on the floor. This
document is the design for the game's exclamation points: what a big moment IS
here, the Cradle detonation beat by beat, the other five moments that deserve
the same treatment, the one screen-shake grammar under all of them, and the
build plan.

**Companions:** `docs/UX-LANGUAGE.md` (every screen element below composes from
its §2 primitives — CHIP, BANNER, VEIL, MARK/GHOST, RING, TAG — nothing bespoke)
· `docs/VO-CATALOG.md` (the moment's voices are already cataloged) ·
`docs/UI-MASTER.md` · `docs/OUTBREAK-SPEC.md` §8 (the contamination grammar the
AFTER borrows). **Law zero: no purple, ever** — the fireball is fire
(white/amber/red), the cloud is ash and dust, the scar is char
(`docs/UX-LANGUAGE.md:76`).

Legend: ✅ shipped · 🔨 partial · ❌ missing · ⚖ decision for Robert.

---

## §0 · THE AUDIT — what ships vs. what shows

The sim's half of the nuke is COMPLETE and correct. The client's half does not
exist. That asymmetry is the whole gap:

| Piece | Sim (truth) | Client (drama) |
|---|---|---|
| The Anvil bomber (V4) | ✅ `src/sim/data.ts:301-310` — cost 4, no gun, turnRate 0.75, escort-dependent by design | ✅ flies, banks, bands |
| Arming ritual | ✅ `src/sim/world.ts:2281-2290` — priced (`NUKE_PRICE 4` = a tier-3 god, `world.ts:166-168`), sets `v.nukeAboard`, emits `nuke_armed` with `big: true` and text `'CRADLE WARHEAD ARMED — CLEAR THE FIELD'` | ❌ **the event is DROPPED.** `hud.ts:843-847`'s announce filter does not list `nuke_armed`; `renderer.ts`'s event switch has no case for it. No banner, no sound, no strobe, no chip. The test says "the whole field is told" (`tests/bomber.test.ts:63-66`) — the sim tells; nobody renders the telling. |
| Release | ✅ `world.ts:2291-2302` — `bomb_away` (`big`, `'WARHEAD AWAY'`), warhead launched with the hull's momentum, ttl 2.6 | ❌ same: no client case for `bomb_away`. The warhead falls as a stock `'shell'` tracer. |
| Detonation | ✅ one seam: `explode()` `world.ts:4632-4723` — killR `min(26×0.4, 2.4) = 2.4` (`world.ts:4638`), splash 26, ragdolls to ~14u, levels walls to ~26u (`world.ts:4701-4721`) | 🔨 renders as a FRAG. `renderer.ts:3658` classifies `big` as `tank_cannon || mml` — `baby_nuke` isn't on the list, so the largest blast in the game gets the SMALL fireball, 35 particles, and 0.5 shake. |
| The cloud | — (client-only dressing) | ❌ flagged missing in `docs/UX-LANGUAGE.md:574` (§7.17) with the treatment sketch this doc expands |
| The scar | ✅ rubble tiles are real sim state (`damageWall`, `world.ts:4717`) | 🔨 per-tile rubble + breach piles render (`renderer.ts:4031-4045`, `:293-346`); no char decal, no lingering dust, and roofs likely FLOAT (see §2.3-D) |

The weapon itself, for the record (`src/sim/data.ts:392-396`): `baby_nuke` —
damage 400, splash **26** (nothing else reaches past ~7.5), splashDamage 260,
knockback 34 (ragdoll threshold is 16, `world.ts:165`). Practical lethality
against a 100 hp trooper: certain death inside 2.4u, death by falloff out to
**~17u**, ragdolled out to **~14u**, damaged to the 26u rim. Those numbers ARE
the rings (§2.3-C).

---

## §1 · THE DOCTRINE — what makes a big moment in THIS game

Top-down camera (~30u up at a 60° tilt, `renderer.ts:153`, `:2518`),
deterministic lockstep sim, a 300u battlefield (`src/sim/map.ts:9-11`). A big
moment here cannot be a cutscene — the war never pauses — so it must be built
from five laws:

1. **The sim decides, the client dresses.** Every beat below hangs off an event
   the sim already emits (`nuke_armed`, `bomb_away`, `explosion`, `wallbreak`,
   `contamination`, `match_over` — `src/sim/types.ts:781-817`). No moment adds
   sim state except where flagged ⚖. Replays get every moment for free.
2. **The world reacts before the HUD explains** (UX Law 5,
   `docs/UX-LANGUAGE.md:16`). The bomber's hull strobes before any chip says
   ARMED. The flash blooms before any banner names it. Corners caption; the
   field speaks.
3. **The rings never lie.** The two-truth-rings law (`world.ts:4633-4638`,
   drawn at the sim's exact radii by `spawnBlastRings`, `renderer.ts:547-573`)
   scales UP, never bends: however big the fireball art gets, the kill disc and
   the splash ring state the literal damage law. Spectacle exaggerates light
   and dust — never reach.
4. **Physics arrives late at distance.** The sonic boom already established it:
   the ring snaps, then the double-crack lands afterward
   (`renderer.ts:1798-1823`). Generalized (§2.4): at range you get the FLASH
   first (light, instant), the SHAKE next (ground wave), the SOUND seconds
   later, then the WIND. Delay is information — it tells you how far, and how
   big.
5. **Every moment has three acts.** BEFORE (dread — the counterplay window),
   NOW (spectacle — short, total), AFTER (the scar — the map remembers). A
   moment with no BEFORE is a cheap shot; one with no AFTER never happened.

### 1.1 · The moment budget — rarity is the fuel

A moment repeated is a texture. The economy already rations the big ones —
the doctrine adds a screen-time cap on top:

| Moment | Natural cap per 10-min match | Enforced by |
|---|---|---|
| THE NUKE | ~1 (2 in a rich match) | `NUKE_PRICE 4` — "the stable's whole afternoon" (`world.ts:166-168`) |
| LSW pod drop | 1 per team concurrent | `world.ts:648`; telegraph 15-40s (`src/sim/lsw.ts:36-39`) |
| Orbital strike | 2-3 | designator is a 40%-chance supply-pod prize (`world.ts:1907`) |
| Sonic boom | per burner commit | once per burn (`renderer.ts:1802`) — the small-change moment |
| Building collapse | terrain-limited | ammo spent on masonry |
| SECTOR LOST | ≤1 | outbreak L4 is nearly terminal (`world.ts:4585-4598`) |
| Victory | exactly 1 | — |

**The screen-ownership rule:** at most ONE moment owns the fullscreen surface
at a time, priority NUKE > SECTOR LOST > pod > orbital > collapse > boom —
mirroring the VO P0 ladder (`docs/VO-CATALOG.md:269`). A lower moment that
fires during a higher one keeps its world VFX (the world never lies) but
forfeits its VEIL/BANNER. Budget honesty: the fullscreen surface already caps
at 1 damage veil + 1 ambient veil + 1 state banner + 1 announce + 1 caption
(`docs/UX-LANGUAGE.md:339`) — moments spend from that same purse.

---

## §2 · THE NUKE, BEAT BY BEAT

One continuous timeline, four phases. `A+0` = the arming tick, `R+0` = release,
`D+0` = the detonation `explosion` event. All UI composed from UX-LANGUAGE §2
primitives; all colors from §1.1 tokens + the Fireballs fire family
(`0xfff3d0` white-hot / `0xffb32e` amber / `0xff5a1f` red-orange / `0x4a443c`
ash — `src/client/effects.ts:166-179`).

### 2.1 · ARMING — the ritual (the dread window IS the counterplay)

The sim already made the design promise: *"a weapon that reshapes a map must
never be a surprise — the counterplay is the warning, and the whole enemy team
gets it"* (`world.ts:2278-2280`). The client must now keep it. From `A+0` the
bomber is the loudest object in the war, and killing it BEFORE release is the
play — the warhead dies silently with the hull (`nukeAboard` has no cook-off
path; verified: `world.ts` grep, no death handler touches it). Hunt rewarded,
cleanly.

| T | World (first, Law 5) | HUD (caption) | Audio |
|---|---|---|---|
| A+0.0 | **Hull strobe**: the Anvil's belly lamps pulse `RED_UI`→white at `BREATHE_DANGER` period 0.7s (`docs/UX-LANGUAGE.md:143`) — emissive on the bomber mesh, visible to both teams, for as long as `nukeAboard` is true | — | `ann_nuke_armed` P0, interrupts everything (`fadeCutVo`): *"THE CRADLE IS ARMED…"* (`docs/VO-CATALOG.md:163`) + `audio.duck(0.4, 1.2)` — the field holds its breath |
| A+0.2 | — | **BANNER (record, big)**: the event's own text `CRADLE WARHEAD ARMED — CLEAR THE FIELD`, holds `HOLD_ANNOUNCE` 4s. Fix: add `nuke_armed`/`bomb_away` to the `hud.ts:843-847` filter — one line, the sim already wrote the copy | — |
| A+0.2 | — | **CHIP, top bar**: `☢ CRADLE ARMED` — enemy-armed wears `RED_UI` edge + `BREATHE_DANGER`; yours wears amber (ownership hue rule, `docs/UX-LANGUAGE.md:290`). HOLDS while `v.nukeAboard` (`src/sim/types.ts:585`, already replicated); exits per the fade law, never pops (`docs/UX-LANGUAGE.md:312-317`) | — |
| A+0.2 | **Minimap MARK** ⚖: the armed bomber as a red triangle + 6px pulsing ring — for the ENEMY team too. This overrides the perception filter ("enemies when seen", `hud.ts:694-695`), justified by the announced-weapon law; DECISION §6-1 | mark pulses at `BREATHE_DANGER` | — |
| A+2.0 | earliest possible release (`s.nextAbilityAt = time + 2`, `world.ts:2287`) — in practice the run-in takes 10-30s at speed 17 across a 300u map: that flight IS the hunt window | — | pilots near the flight path get `spotted_bomber_ac`: *"BOMBER ON APPROACH — SCATTER!"* (`docs/VO-CATALOG.md:135`) |
| A+n | AA tracks, Falcons, and SAMs converge — no new UI needed: MISSILE INBOUND, SAM lock, and flare grammar all ship (`docs/UX-LANGUAGE.md:481-483`) | — | the music director may treat an armed Cradle as LSW-tier dread ⚖ §6-2 (`src/client/music.ts:26-40` — same "the telegraph is the overture" logic) |

Cost: ~0 new tech. One emissive pulse, one chip, two lines in the announce
filter, one minimap mark. This beat is 80% of the moment and ships in an hour.

### 2.2 · RELEASE + FALL — the whistle and the tightening ring

At `R+0` the sim emits `bomb_away` (`big`, `'WARHEAD AWAY'`, `world.ts:2300`)
and launches the warhead: y = 2.4, vy = −2, inheriting 0.7× hull velocity
(`world.ts:2294-2299`).

**The fall-time problem, honestly:** arc rounds feel gravity ×0.7
(`world.ts:4089`) of Terra's 22 u/s² (`data.ts:556`) → the warhead grounds in
**≈0.45s**. That is a blink, not a beat. ⚖ §6-3 proposes the **laydown drop**
(real doctrine: parachute-retarded so the bomber escapes its own blast): the
`baby_nuke` projectile falls at constant −2 u/s (skip the gravity line for
this one weapon) → **1.2s** of fall, still inside its shipped ttl 2.6
(`world.ts:2298` — the generous ttl suggests this was half-intended). Sim
change, one flag, one test. The table assumes 1.2s; at 0.45s the same beats
compress and survive.

| T | World | HUD | Audio |
|---|---|---|---|
| R+0.0 | the bay: 8 amber sparks drop from the hull (`particles.emit`, count 8) — the visible letting-go | **BANNER (record, big)** `WARHEAD AWAY` (same filter fix) | bombardier VO `bomb_away` P1 (`docs/VO-CATALOG.md:162`); a deep bay-door `thump` at the hull |
| R+0.0 → impact | **THE GROUND RING** — the pod-LZ grammar reused verbatim (`renderer.ts:2335-2370`): a 360° ground MARK at the predicted impact point (integrate the projectile's pos/vel — client-side, deterministic), color `RED_WORLD` for everyone (a nuke has no friendly side under it), scale **tightening** from 26u (the true splash, ring-law honest) toward the 2.4u kill disc as it falls, panic-pulse 9Hz in the last 0.4s (`renderer.ts:2359-2361`) | — | **THE WHISTLE**: new slot `nuke_whistle`, played at the warhead's position with `rate` ramping 1.3 → 0.7 over the fall (the deepening = the arriving; rate is a shipped knob, `audio.ts:455`) |
| R+0.3 | the warhead itself: swap the stock `'shell'` tracer for a finned dart mesh, tumbling once — small, dark, believable | — | — |
| impact | → §2.3 | — | whistle cuts dead 80ms BEFORE detonation — the silence gap is the oldest trick in the reel |

Cost: 1 predicted-impact ring (lzRings clone), 1 whistle sample, 1 tracer mesh.

### 2.3 · DETONATION — whiteout, fireball, THE CLOUD

`D+0` = the `explosion` event with `radius 26, killRadius 2.4`
(`world.ts:4647`). First fix: `renderer.ts:3658` must classify `baby_nuke` as
its own tier above `big` — call it `apocalyptic` — and route to the sequence
below instead of the stock frag dressing.

**A · The whiteout (0 → 2s).** VEIL, fullscreen (`docs/UX-LANGUAGE.md:265-270`):
white `#f2f0ea` snap-in <50ms, hold 0.2s, bleed out 2s — exactly the flagged
treatment ("white VEIL flash snap→2s bleed", `docs/UX-LANGUAGE.md:574`).
Opacity by viewer distance (§2.6): 1.0 at ground zero falling to 0.12 at the
far map edge — never fully blinding past 60u (VEIL law: "never full-opacity"
except for the dead, §2.6). `reducedMotion` caps it at 0.55
(`src/client/settings.ts:19` — the same valve that tones the drone whiteout).
Plus all 5 FlashLight slots (`effects.ts:98-124`) at intensity 260, dur 0.5 —
every wall on the map throws a hard shadow away from zero for half a second.

**B · The fireball (0 → 1.6s).** The Fireballs grammar (`effects.ts:126-299`)
at nuke scale — but NOT through the pooled frag slots (their `r` derives from
killR, capped at 2.4 → a 5u puff, `effects.ts:211`). A dedicated
`NukeCloud` slot (1 live, cap 2) runs its own sequence: white core pop to r6
(0-0.25s), two faceted fire shells (the house icosahedron style) boiling to
r10 by 0.6s, squashed 0.78 like the shipped shells, burning out into the
column by 1.6s.

**C · The pressure ring (0 → 0.6s).** The two-truth-rings, scaled up and slowed
just enough to be SEEN traveling: kill disc (2.4u, filled, white-hot) stamps
instantly; the splash ring races 2.4 → 26u over **0.6s** (43 u/s — the shipped
frag ring does its run in 0.24s, `effects.ts:261-266`; a nuke's rim deserves
one readable beat, and 0.6s is still too fast to outrun, so the ring never
misrepresents who was already hit). The ring IS the damage edge — same
`spawnBlastRings` geometry (`renderer.ts:547-573`), fire-orange `0xff7a30`,
double stroke width. Behind the rim, a ground-hugging dust skirt (60 particles,
ash `0x8a7f6a`, life 2.2s) chases it at half speed — drama trailing truth,
never leading it.

**D · The destruction (0 → 0.6s, sim-driven).** Free, and already real: the
sim levels every destructible tile to ~26u (`world.ts:4701-4721`, heavy breach
since damage 400 ≥ 100) → a hail of `wallbreak` events → `collapseTile` +
breach piles + per-tile dust (`renderer.ts:4031-4045`). Rubble cap 240
(`renderer.ts:4070`) absorbs it. **VERIFY — the floating-lid problem:** roofs
are built per-house (`renderer.ts:995` §8.4) and nothing removes a lid when
the walls under it die; a nuked block likely leaves roofs hovering on air.
Interim fix inside this slice: when ≥60% of a house's wall tiles are rubble,
drop its lid 3u with a 0.4s ease + dust burst (client-side, derived from grid
state — Law 2 clean). The full collapse moment is §3.4.

**E · THE MUSHROOM CLOUD (0.4 → 15s).** The signature, designed for a
top-down camera — which mostly sees the CAP, so the cap carries the read and
the column reads via its skirt and its shadow:

| Part | Build | Tris | Notes |
|---|---|---|---|
| Stem | 6 ash lumps (shared `IcosahedronGeometry(1,0)`, 20 tris each), stacked y 1→9u, each rotating 0.25 rad/s, scale breathing ±6% | 120 | MeshLambert ash `0x4a443c`; bottom two lumps tinted ember `0xff5a1f` emissive fading to 0 by 4s — the fire dies INTO the dust |
| Cap | 8 lumps in a ring r4→7u + 1 crown lump, riding y 8→11u, the whole ring counter-rotating 0.15 rad/s | 180 | from above this ring of boiling facets IS the mushroom; edges catch the sun (Lambert + hemi does this free) |
| Skirt | 6 lumps hugging ground r3→8u, opacity 0.5→0 by 6s | 120 | the base surge — sells the column's foot to a top-down eye |
| Dust veil | 140 particles from the shared 3000 pool (`effects.ts:5`), ash, life 4-8s, gravity 0.3, slow rise | 0 (points) | hangs over the crater after the geometry dies |
| **Total** | 21 meshes, 1 geometry, 2 materials | **≤420 tris, ≤21 draw calls** | one slot, pre-built and pooled like Fireballs — a boom re-poses, never allocates (`effects.ts:131`) |

Timeline: stem rises 0.4-2.5s · cap blooms 2-4.5s · full column stands 4.5-10s
· **wind-lean**: from 3s the whole group shears toward the weather's drift
axis (the precip system's own slant, `renderer.ts:583`), lean 6° + top-drift
0.3 u/s × weather intensity — calm days build a straight pillar, storms smear
it · 10-15s dissolve, opacity ease-out. **Life ~15s** and it FADES — nothing
blinks out, Law 6 at landscape scale (`docs/UX-LANGUAGE.md:17`, `:574`).
`reducedMotion`: life 8s, no scale-breathing, veil cap per A.
The whole assembly joins the FX bench (`src/client/fxsheet.ts`) with a
`reset()` like Fireballs' (`effects.ts:200-202`) so it can be tuned frozen.

### 2.4 · THE PHYSICS ARRIVES LATE — the propagation ladder

The sonic boom set the precedent: visual truth instant, sound afterward
(`renderer.ts:1819-1820` — the double-crack lands 90ms behind the ring).
Generalized into three wavefronts with honest speeds (map is 300u across;
booms are audible to 140u, `audio.ts:152`):

| Wave | Speed | Arrival at distance d | Carrier |
|---|---|---|---|
| LIGHT | instant | 0 | whiteout VEIL + FlashLights + the cloud itself |
| GROUND | 120 u/s | `d / 120` (≤1.2s) | camShake via §4 — the floor kicks before the air does |
| SOUND | 60 u/s | `max(0, (d − 40) / 60)` (≤1.7s) | `nuke_blast` near/far pair + `audio.duck(0.7, 2.5)` on arrival |
| WIND | 30 u/s | `d / 30` (≤4.6s) | a 0.5s particle-drift impulse away from zero + grass/smoke lean; the LAST touch of the bomb |

**The delay formula** (the sonic-boom grammar, made law): sounds may arrive
late only when an instant visual already told the truth — and close fights
stay tight via the 40u grace (inside it, sound is effectively instant, so the
two-truth rings and their bang never desync where aim matters).
Implementation: `audio.play` grows `delay?: number` seconds — WebAudio buffer
sources take `start(when)` natively; one parameter threaded through
`audio.ts:455`. Applied to: the nuke always, `explosion_big` and
`orbital_strike` past 40u, and the shipped boom double-crack migrates off its
`setTimeout` onto the same rail. Ordinary gunfire is NEVER delayed —
positional gunshot audio is live combat information.

Air absorption already does the tone half: distant booms arrive as dark thuds
via `distanceCutoff` (`audio.ts:206-215`). Delay + darkening together = the
postcard thud.

### 2.5 · THE AFTER — the scar

| Element | Treatment | Cost |
|---|---|---|
| **The char decal** | one 30u charred disc (radial gradient: black char core → ash rim, baked canvas texture) stamped at zero, y 0.04. NOT in the 900-cap FIFO splat pool (`renderer.ts:526` — it would age out under paint); its own slot, cap 2 per match, persists to the whistle | 1 quad, 1 texture |
| **The rubble field** | already real — sim tiles stay rubble (real cover, `renderer.ts:4032-4034`); the breach piles inside the char read as the bones of the block | 0 |
| **Lingering dust** | 40-particle ash haze re-emitted over the crater every 6s for 90s, life 5s, barely rising — the ground still smoking | ~7 particles/s |
| **Minimap scorch GHOST** | the UX row's own ask (`docs/UX-LANGUAGE.md:574`): a 26u-scaled hollow ash-grey circle on the minimap at zero, `GHOST` state (hollow stroke = memory, `docs/UX-LANGUAGE.md:253-257`), persists the match | 1 arc/frame |
| **Carrion birds scatter** | at D+0 every bird on the map bursts and the sky stays empty for 60s — map-wide tell that outlives the sound. DEPENDENCY: the boid layer is design-locked but unbuilt (`docs/UX-LANGUAGE.md:577`); this line activates when it lands | — |
| **Radiation hazard field** ⚖ | §6-4 — see below | sim |
| **The DUD beat** | if the bomber dies ARMED (the hunt won): kill the strobe + chip per the exit law, one killfeed CHIP `CRADLE DENIED` in the hunter's color, one announcer line (new P1 slot). The counterplay deserves its receipt | 1 chip |

**⚖ The radiation field (§6-4).** The brief's instinct: tie the crater to the
outbreak grammar — a nuke site as a mutation field. Honest complication: the
sim says the OPPOSITE — a blast is *corpse denial*; every body in the splash
is neutralized and never rises (`world.ts:4639-4646`), so a fresh nuke site is
the most sterile dirt on the map, and nests need 3+ unburned corpses to curdle
(`world.ts:4563-4583`). Two coherent options:

- **(a) RADIATION ZONE** — a new hazard, not a nest: soldiers inside the 12u
  core take 4 hp/s, HUD via the shipped biohazard CHIP family
  (`hud.ts:531-536`) + a `VIRAL_GREEN`-free amber-red edge VEIL when inside.
  Sim: an `inNest`-style check (`world.ts:4627-4630`) on a `craters[]` list.
  Ring-law cost: a field that hurts must draw its true edge — a ground RING at
  exactly 12u, always.
- **(b) VISUAL-ONLY SCAR** (recommended v1) — the char, dust, and minimap
  ghost with zero gameplay field. Rationale: the nuke's price already bought
  its damage; a lingering denial zone punishes the VICTIM team's map twice,
  and v1 spectacle shouldn't smuggle in a balance change.

Ship (b) in slice 3; hold (a) as a mode-flag experiment.

### 2.6 · SCREEN LANGUAGE BY VIEWER DISTANCE

One detonation, four seats. Distances from the lethality math in §0:

| Seat | Distance | What YOUR screen does |
|---|---|---|
| **Ground zero** | < ~17u (death by falloff for 100 hp) | You're dead and the whiteout IS the death screen: VEIL to full white, hold, then **K.I.A. resolves out of the white** — the shipped respawn overlay (`docs/UX-LANGUAGE.md:565`) fades in THROUGH the bleed-out instead of after black. No shake (you have no camera anymore). The kill feed credits the Cradle. |
| **Near** | 17-40u | Survived, barely: full whiteout 0.2s → shake amp 1.6 (§4 cap) + the knockback camera-kick you already own (`renderer.ts:2531-2534` rides the sim's shove) · **deafened**: `audio.duck(0.85, 4)` + a 3s tinnitus sine that fades as the mix returns — the concussion grammar the UX table already reserves (ringing/tinnitus row, `docs/UX-LANGUAGE.md:430`) · dust VEIL (ambient class) 6s · likely ragdolled by the sim (≤14u) — the M1 get-up IS the beat. |
| **Mid** | 40-90u | Flash veil 0.4 opacity, ground thump at d/120, boom at (d−40)/60 with the duck, shake 0.6 falling with distance, the cloud dominating the top of your view, wind tug at d/30. Fight continues — rattled. |
| **Far / postcard** | 90u+ | Flash blink 0.12, the tiny cloud rising over the fog line (fog far 130-300 by theme, `renderer.ts:73-109` — the cloud's 11u crown clears it), a late dark THUD 1-1.7s on, a whisper of shake. You stop for one second anyway. That second is the point. |

---

## §3 · THE OTHER MOMENTS

Same three acts, shorter. Each with what ships, what's missing, and cost
(S = hours, M = a day, L = days).

### 3.1 · The sound barrier — the reference standard ✅
BEFORE: burner spool + flame stretch (`renderer.ts:1787-1797`). NOW: vapor
cone-ring snaps perpendicular, expands, shreds in 0.4s
(`renderer.ts:1798-1823`, `:2371-2383`); double-crack 90ms apart. AFTER: none —
correct; a boom leaves no scar. **This is the bar**: sim tick → world-space
physics → late audio, zero HUD. Missing: the crack should reach distant ears
via the §2.4 delay rail instead of instantly. Cost S.

### 3.2 · The LSW pod drop 🔨
BEFORE ✅: announcer call + score flip (`music.ts:10-14, 26-40`) + INBOUND chip
(`hud.ts:524-528`) + LZ ring tightening with T-5 panic (`renderer.ts:2335-2370`).
NOW 🔨: `pod_landed` is 40 dust particles + a stock explosion
(`renderer.ts:3969-3974`) — a god deserves: the streak (a 0.3s emissive line
from sky to LZ), impact shake via §4 (energy tier 3), a 12u dust ring, and
2s of `audio.duck` silence before the god's first VO. AFTER ❌: a scorched LZ
decal (small char, splat-pool exempt like §2.5) + bent-grass ring for 60s;
birds burst at T-3 when the boid layer lands (`docs/UX-LANGUAGE.md:577`).
Cost S-M.

### 3.3 · The orbital strike 🔨
NOW ✅ and good: beam + 120 particles + flash 140 + shake 1.2 + the duck
(`renderer.ts:3947-3964`). BEFORE 🔨: the ground lamp blinks faster while
arming (`renderer.ts:2211-2212`) and the minimap dot ships (`hud.ts:608`) — add
the 7u true-splash ground RING tightening over the 3s arm (`world.ts:1889-1896`)
so victims read the EDGE, not the gadget. AFTER ❌: a 7u glassed-earth decal
(darker, glossier than char) + 20s of ember particles. Migrate its boom onto
the §2.4 delay rail past 40u. Cost S.

### 3.4 · The building collapse ❌
BEFORE ✅ free: masonry chips, cracks, per-tile breaches — the sim's damage
ledger is the telegraph. NOW: when a house's standing wall-tile fraction
crosses 40%, the client plays the fall: lid drops with a 0.5s ease + 2°
tip, 80 ash particles down the walls, breach piles for the footprint, §4
shake energy 2 within 24u, and a rolling `impact_stone`×3 rumble. Derived
entirely from grid state + the house registry (`src/sim/map.ts:161-169`,
`src/sim/buildings.ts:720`, `:785-808`) — no new sim state, Law 2 clean.
AFTER: the lid persists as canted rubble-cover; concealment honestly gone
(perception already keys off roof rects — `src/sim/perception.ts:3-5` — ⚖
whether a fallen lid stops concealing is a sim decision, §6-5). Kills the
§2.3-D floating-lid bug for good. Cost M.

### 3.5 · SECTOR LOST — the outbreak declaration ❌
BEFORE ✅: the biohazard chip climbs L1→L3 (`hud.ts:531-536`, ladder colors
`docs/UX-LANGUAGE.md:62`). NOW, at L4 (`'OUTBREAK LEVEL 4 — SECTOR LOST'`,
`world.ts:49`, level machinery `:4585-4598`): the sky itself turns — lerp fog
color + hemisphere toward a sick olive-grey (`0x6a6a4a` family — VIRAL hue,
never green-as-good, and never purple) over 8s, sun −30%, riding the SAME
per-frame atmosphere pass the weather owns (`renderer.ts:384-435`, base
palette `:617-628`) so it stacks with rain or dusk and always finds its way
back if the level falls. Announce banner big + a low klaxon-tail sting. The
sky is a state, not a flash: it HOLDS while L4 holds (a breathing WARN at
landscape scale), exits by the fade law. AFTER: the world under that sky is
the after — nests glowing in the murk. Cost S.

### 3.6 · Match victory 🔨
NOW today: a sting (`renderer.ts:4111-4115`) + text banner. Design: freeze
input, not the world (determinism untouched — the sim runs its last ticks):
winner-color VEIL edge glow (team amber/cyan — identity hue, never severity),
every surviving winner fires one tracer volley skyward over 1.5s (world
speaks first), `announce` big holds, then the scoreboard slides. Defeat: no
volley, the muted grey wash, the same honest sheet. AFTER: the scar map and
career ledger already keep the memory. Cost S.

---

## §4 · THE SHAKE SYSTEM — one grammar for every kick

### 4.1 · Audit — it exists, but it's folklore

`camShake` ships: a scalar, random x/z jitter on the camera, decay `dt × 2.5`,
zeroed by `reducedMotion` (`renderer.ts:132`, `:2521-2526`). Nine call sites
each hand-roll amplitude and falloff:

| Site | Amp | Range | Event |
|---|---|---|---|
| `renderer.ts:3046` | 0.3 | 26 | Leviathan crush-walk |
| `renderer.ts:3676` | 0.5 / 0.9 big | 30 | explosions |
| `renderer.ts:3813` | 0.7 | self | corpse-slammed (you) |
| `renderer.ts:3839` | 0.55 | self | ragdolled (you) |
| `renderer.ts:3880` | 0.6 | 22 | Ragebeast roar |
| `renderer.ts:3961` | 1.2 | — | orbital strike |
| `renderer.ts:4026` | 0.35 | 18 | doorbreak |
| `renderer.ts:4042` | 0.4 | 20 | wallbreak |
| `renderer.ts:4082` | 0.45 | 24 | breacher grinding rock |

No cap, no shared falloff, no energy scale — 1.2 is "orbital" only because
someone typed 1.2.

### 4.2 · The law

One helper, all sites migrate, new moments may ONLY shake through it:

```
shake(energy E, at?: pos, range R = 14 + 8·E)
  amp   = min(1.6, 0.28 · √E)              // concave: doubling E ≠ doubling kick
  d     = at ? dist(local, at) : 0
  final = amp · (1 − d/R)                   // linear falloff, floor 0
  delay = at ? d / 120 : 0                  // the GROUND wave (§2.4) — free drama
  camShake = max(camShake, final) after delay
```

**The energy scale** (calibrated so every shipped site lands within ±0.1 of
its current feel — migration changes no one's hands):

| E | Feels like | Examples (mapped from 4.1) |
|---|---|---|
| 1 | a door giving way | doorbreak, footfall, grind |
| 2 | a shell | frag/wallbreak (0.4), explosion (0.5) |
| 4 | heavy ordnance | big explosion (0.9 → E≈4 caps ~0.56·range-boost), corpse-slam/ragdoll self-hits |
| 6 | the sky falling | orbital (≈1.2 with its tight range), pod landing |
| 12 | THE CRADLE | amp caps at 1.6, R = 110 — the whole map's floor jumps, scaled by distance |

Personal hits (`at` = self) skip falloff and delay. Cap 1.6 is absolute — past
it the game is unplayable, not dramatic. Decay stays `dt × 2.5` (shipped
feel). The nuke adds ONE extension: a low-frequency rumble term (amp 0.15,
period 0.4s, 2.5s duration) layered under the jitter — spectacle for the
spine, small enough to aim through.

**Accessibility:** `reducedMotion` continues to zero all of it
(`renderer.ts:2521`) including the rumble, and independently caps the
whiteout (§2.3-A) and skips debris (`effects.ts:231`) — one valve, every
moment honors it, no per-moment opt-outs.

---

## §5 · BUILD PLAN

Standing gates on every slice: `tsc` clean · `vitest` green · build passes ·
no sim change outside flagged ⚖ items, each behind its own test · new VFX
verified in the FX bench (`src/client/fxsheet.ts`) AND a live match (visible
tab — the preview pane freezes RAF; use the harness/Playwright route).

### Slice 1 — the floor: shake law + late audio (S-M)
1. `shake()` helper per §4.2; migrate all nine call sites; add the E-scale
   table as a comment where the helper lives.
2. `audio.play` gains `delay?: number` (WebAudio `start(when)`); migrate the
   sonic-boom `setTimeout` (`renderer.ts:1820`); apply `(d−40)/60` to
   `explosion_big` + `orbital_strike`.
- **Accept:** all shakes route through one function (grep: no bare
  `camShake =` outside the helper + the camera applier); reducedMotion still
  zeroes everything; a scripted far explosion demonstrably flashes → shakes →
  sounds in that order; no shipped feel regresses past ±0.1 amp.

### Slice 2 — the nuke timeline (M-L)
1. ARMING: hull strobe · `☢` top-bar CHIP · `nuke_armed`/`bomb_away` added to
   the hud announce filter · minimap mark (pending ⚖ §6-1) · `ann_nuke_armed`
   VO wired (slot exists, `docs/VO-CATALOG.md:163`; generate via the
   expressive-tts pipeline).
2. FALL: predicted-impact ground ring (lzRings grammar) · `nuke_whistle` with
   rate ramp · finned tracer · ⚖ §6-3 laydown-drop retune if approved
   (+ test: fall time ≈1.2s, ttl still covers it).
3. DETONATION: `apocalyptic` tier in the explosion case (`renderer.ts:3658`) ·
   whiteout VEIL by distance · NukeCloud pooled assembly per the §2.3-E budget
   table · slowed truth-ring (0.6s to 26u) · floating-lid interim drop ·
   §2.6 near-seat deafen (duck + tinnitus) · K.I.A.-out-of-white for the dead.
- **Accept:** FX-bench freeze-frames of cloud at t = 0.5/2/6/12s match the
  §2.3-E timeline; a live CTF match with a scripted Cradle run shows all four
  §2.6 seats correct (screenshot each); cloud ≤ 21 draw calls (renderer.info);
  frame time at detonation within 2ms of a tank-shell baseline; two-truth
  rings verified at exactly 2.4/26u against a placed test soldier at 17u
  taking non-lethal damage; `bomber.test.ts` extended: armed-bomber death
  emits no explosion (the DUD stays quiet in sim) and the client shows
  CRADLE DENIED.

### Slice 3 — the after + the other moments (M-L)
1. Char decal (pool-exempt) · lingering dust · minimap scorch GHOST · DUD
   killfeed chip · ⚖ §6-4 decision applied (visual-only unless (a) approved).
2. Other moments, cheapest first: orbital before/after (S) · sound-barrier
   delay migration (S, done in slice 1) · SECTOR LOST sky (S) · pod-landing
   upgrade (S-M) · victory volley (S) · building collapse (M, retires the
   lid hack).
- **Accept:** scar survives 5 minutes + a killcam replay; minimap ghost
  persists to match end and never blocks newer marks; SECTOR LOST sky stacks
  correctly with rain and night and recovers when the level drops; collapse
  triggers at the 40% threshold in a scripted demolition and the lid becomes
  standing cover; every §7 UX row touched here gets its status flipped in
  `docs/UX-LANGUAGE.md` (a PR without the row edit does not merge,
  `docs/UX-LANGUAGE.md:651`).

---

## §6 · DECISIONS FOR ROBERT

| # | Question | Recommendation |
|---|---|---|
| 1 | Armed bomber broadcast on the ENEMY minimap (perception-filter exception, `hud.ts:694-695`)? | YES — the announced-weapon law; the hunt needs a trail |
| 2 | Armed Cradle flips the music to LSW-tier dread (`music.ts:26-40`)? | YES — same telegraph-is-the-overture logic |
| 3 | Laydown drop: warhead falls at constant −2 u/s (~1.2s) instead of ballistic (~0.45s)? Sim change, one flag + test | YES — the fall is a beat, and the bomber escaping its own blast is doctrine |
| 4 | Crater gameplay: (a) radiation DoT field with honest ring, or (b) visual-only scar? | (b) for v1; (a) as a mode-flag experiment later |
| 5 | Does a collapsed roof stop concealing (`src/sim/perception.ts:3-5`)? | YES eventually — but it's a sim/balance change; ship the visual collapse first |

*Amendment path: when built, flip the §7.17 rows in `docs/UX-LANGUAGE.md:574-578`
and log the two new world-VFX compositions (NukeCloud, collapse) there — the
grammar grows, it is never bypassed.*
