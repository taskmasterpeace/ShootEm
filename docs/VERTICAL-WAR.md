# VERTICAL WAR — SKY, SURFACE, DEPTHS
### The design spec for War World's full vertical axis. 2026-07-21.

Robert's direction (2026-07-21, verbatim intent):
- *"I want the three depths. The surface, the middle, the depth"* — submarines mirror the three air bands the planes already own.
- *"Adding submarines means we need boats. Definitely boats."* Carriers tempt immediately after — *"that seems like a lot, we need a solution, or maybe we save aircraft carriers for later. Now we just do boats."*
- *"That third level, that high level — it should be HIGHER... I want to be away from the projectiles a little more. It should VISUALLY feel like we're high — do we lower the clouds or put some clouds there? When you get to the highest level with the plane you should kind of be in the clouds."*
- *"The bomber is supposed to have access to [the high band]. Right now the bomber feels super vulnerable because you can't fly high enough. I think that's the root problem with a lot of the flight right now."*
- *"Are the planes at scale right now for our characters? I want the vehicles to be at scale."*
- Inspiration: Infantry Online + Atari Combat. Simple, readable, top-down.

**Companions:** `docs/UX-LANGUAGE.md` (every readout below composes from its §2 primitives on its §5 surfaces — nothing bespoke, no purple) · `src/sim/world.ts` (the band system) · `src/sim/data.ts` (the motor pool).

---

## §1 · THE STATE OF THE VERTICAL AXIS — what the code actually does today

Before designing up and down, the ground truth. Three findings drive everything in this spec.

### 1.1 The sky has floors — and they're all in the same room

The band system shipped (J1): aircraft live in discrete altitude bands 0–3, Q climbs one per press, E dives one, and at band 0 the E key becomes the door (`src/sim/types.ts:586-590`, `src/sim/world.ts:2209-2234`). Jets own band 3, rotors cap at 2 (`world.ts:2231-2232`); taking the sky opens at the airframe's home band — jets 3, rotors 2 (`world.ts:3817-3821`). The grammar is right. The heights are wrong:

| Band | Render height (`renderer.ts:1775`, `BAND_ALT`) | What's around it |
|---|---|---|
| 0 deck | 0.12u | boots, hulls |
| 1 | 1.9u | soldier eye level (a soldier stands ~1.9u — §5) |
| 2 | 3.4u | **below the 4–8u upper-storey wall band** (`map.ts:278`) — the renderer's own comment promises band 2 is "clear of every roof" (`renderer.ts:1773-1774`) and it isn't |
| 3 | 5.4u | 5% of the map width; ~14% of the piloted camera height (camDist 30 × 1.25 in-vehicle = 37.5u eye — `renderer.ts:153`, `renderer.ts:2500-2501`) |
| cloud deck | 48–68u | 14 drifting puffs, pure backdrop (`renderer.ts:640-660`) — planes fly **43u below the clouds** |

Band 3 renders one soldier-height above a rooftop, under a cloud ceiling eight times higher than it will ever fly. That is why the high sky feels low.

### 1.2 Altitude is cosmetic — the hit test never asks

The projectile-vs-vehicle test is: horizontal distance < radius + 0.3 **and `p.pos.y < 3`** — the *projectile's* height, with no check of the vehicle's band and no `flies` exemption (`world.ts:4411-4416`). Sim-side, an aircraft's `pos.y` is never raised — `BAND_ALT` is renderer-only, and the bomb-bay code has to guard with `Math.max(2.4, v.pos.y)` because the hull's own y is deck-level (`world.ts:2271`). Rifle rounds launch at y ≈ 1.2–1.6 and fly flat, so **every small arm in the game can strike a band-3 bomber**. The SAM system even *dives to 2.6u to get under "the 3u vehicle-hit ceiling"* to be allowed to connect (`world.ts:213-214`, `world.ts:3201-3203`).

The bomber isn't under-altituded. It's un-armored by physics: the Anvil (240hp, turn 0.75, the slowest thing that flies — `data.ts:305-310`) is legally hittable by every autocannon on the field at any band. **That is Robert's "root problem with a lot of the flight."** Raising the render height alone fixes nothing; the sim must honor the band.

### 1.3 The depth grammar already exists — twice

- **The burrow.** The Mole tunneler toggles `burrowed` on Q with a public announce ("Breacher DIVING/SURFACING"), moves at half speed, passes *under* walls and water, can't dig while deep, and surfaces as a wreck (`world.ts:2235-2244`, `:3792`, `:3876-3880`, `:3734`). The renderer sinks the hull −1.6u and betrays it with churned-earth mounds while it moves (`renderer.ts:1867-1875`). This is a submarine in dirt: a depth ladder, a speed tax, a pass-under privilege, and an honest surface tell.
- **The water.** `T_WATER` (shallow: everyone wades, wheels ford) and `T_DEEP` (soldiers swim — slow, disarmed: no fire, no grenades, no alt-fire — `map.ts:16`, `:25`, `world.ts:2363`, `:2625`, `:2712`) already ship. Boats are water-locked ("every land tile is their wall", `world.ts:3899-3901`) with a shallow-draft collision probe (`world.ts:3868-3870`). The Port front builds a harbor channel with moorings and a moored ship (`fronts.ts:1420-1505`); gunboats moor on the shallow bank of the field map's moat (`map.ts:730-737`).

Everything below is composed from these three truths.

---

## §2 · THE NINE-LAYER LADDER — one vertical model

One ladder, top to bottom, every rung already named by a system that ships or is specced here. Six rungs on the main ladder; three parallel lanes (upper floors, swimmers, the burrow) that already exist and slot between rungs without new grammar.

```
        ─────────────  high cloud deck (y 48–68, backdrop only) ──────────

 +3  HIGH SKY        y 14.0   jets + bomber only. Above the cloud shelf.
                              Reachable ONLY by SAMs and other band-3 aircraft.
        ▒▒▒▒▒▒▒▒▒▒▒  THE CLOUD SHELF (y 10–12, drifting puffs — §3.2)  ▒▒▒▒

 +2  MID AIR         y 8.6    the rotor ceiling. Finally clear of every roof.
 +1  LOW AIR         y 2.0    rooftop skim, under the eaves. Gun-height.
      ┆ +F UPPER FLOOR (y 4–8 interiors — map.ts:270-278; soldiers only) ┆

  0  THE SURFACE     y 0      boots, hulls, boats, SURFACED subs, parked
                              aircraft. The whole war until now.
      ┆ −S THE SWIM (soldiers in T_DEEP: slow, disarmed — world.ts:2363) ┆
      ┆ −E UNDER-EARTH (the burrowed Mole — land's only basement)        ┆

 −1  PERISCOPE DEPTH  "the middle" — torpedo depth. Wake tell on the surface.
 −2  THE DEEP         silent, slow, near-blind. Safe from almost everything.
        ──────────────  the sea floor (wreck salvage — LATER, §7.4) ─────────
```

**Robert's three depths** map to sub states `depth 0/1/2`: **SURFACED** (the surface — fast, deck gun, visible to all), **PERISCOPE** (the middle — torpedo depth), **THE DEEP** (the depth — silent transit). Three states mirroring the three air bands, exactly as asked.

### 2.1 One control grammar — Q up, E down, everywhere

The band walk already has the right feel: one rung per PRESS, never per tick, on a 0.28s gate so a held key walks and never falls (`world.ts:2217-2223`). The same code path, sign-flipped, drives the sub:

| Craft | Q | E | The door |
|---|---|---|---|
| Aircraft | climb one band (cap: jets 3, rotors 2) | dive one band | at band 0, E = exit (`world.ts:2211-2214`) |
| Submarine | rise one depth | dive one depth (cap: depth 2) | at SURFACED, Q = hatch |
| Mole | — (Q toggles burrow today — migrates to this grammar: Q rise/surface, E dive) | dive | at surfaced, E = exit (unchanged) |

The law that unifies it: **the key that walks you home also opens the door.** A pilot lands on E, then E again is the door. A sub captain blows tanks on Q, then Q again is the hatch. Same 0.3s re-press gate that already stands "between the last dive and the door" (`world.ts:2218-2220`) stands between the last rise and the hatch.

The Mole's bespoke toggle (`world.ts:2237-2244`) folds into this grammar in Slice 3 — one vertical control scheme across dirt, air, and water.

### 2.2 The sim finally learns altitude

`v.band` becomes load-bearing (it already replicates — `types.ts:590`). Depth reuses the same field with the sub's ladder reading it as depth (0 = surfaced). No new state; the burrow boolean retires in favor of `band` on the Mole too (0 = surfaced, 1 = deep). One integer, one meaning per medium: **distance from the surface, in rungs.**

---

## §3 · THE HIGH-ALTITUDE FIX — making band 3 real

Three changes, in dependency order: the sim gate (the sanctuary), the render raise + cloud shelf (the feeling), the bomber doctrine (the payoff).

### 3.1 The Sanctuary Law — what can reach which band

Projectiles gain a `reach` (max band they can strike), stamped at launch. The hit test at `world.ts:4416` becomes: horizontal overlap AND `(v.band ?? 0) <= p.reach`. The `p.pos.y < 3` ceiling stays for band-0 targets (it is what stops a mortar lobbing over a tank); the band gate is the new law on top.

| Source | Reach | Rationale |
|---|---|---|
| Small arms, turrets, vehicle MGs, tank cannon | band 1 | flat-trajectory fire clips the rooftop skimmer, nothing higher — strafing at band 1 is a choice with a price |
| Falcon cannon / Vulture rockets / belly MGs (air-to-air, `airScaled` — `world.ts:2322`) | shooter's band + 1, and one below | you fight the deck you fly; climbing to the fight is the play |
| Lance `aa_missile`, MANPADS `sam_missile` (homing — `world.ts:3042-3131`) | band 3 | the only ground answer to the high sky. "The reason the sky is not free" (`data.ts:290-295`) stays true — it just becomes *exclusively* true at band 3 |
| Bombs, baby nuke (arcs, falling) | they fall — bombs strike whatever surface they land on, never air targets (unchanged) |
| Explosions (`explode()` splash) | band 1 | a ground blast doesn't swat the high sky |

Consequences, stated as doctrine:
- **Band 3 is a sanctuary from the ground war, not from the air war.** Only SAMs and other band-3 aircraft reach it. The interceptor's whole job — "the answer to aircraft, and ONLY to aircraft" (`data.ts:281-283`) — now has a place it is the *only* answer.
- **Band 1 is the gun deck.** Every rifle can touch you there. Strafing runs and rocket passes live at band 1-2 and accept the fire.
- The SAM keeps its predator/prey ratio (8% slower than its prey, straight flight escapes — `SAM_SPEED_RATIO`, `data.ts:399-406`) and no longer needs its terminal dive hack under the 3u ceiling (`world.ts:213-214`) — the band gate supersedes it.
- Flares (`world.ts:2327`) and the storm grounding (`weather.ts:82-84`, `world.ts:3874`) are untouched.

### 3.2 The raise + the cloud shelf — the feeling of high

**New `BAND_ALT = [0.12, 2.0, 8.6, 14.0]`** (`renderer.ts:1775`).

| Band | Old → new | Why this number |
|---|---|---|
| 1 | 1.9 → 2.0 | under the 4u eave line — reads "rooftop skim" |
| 2 | 3.4 → 8.6 | finally above the 8u roofline — the renderer's own promise ("clear of every roof") kept |
| 3 | 5.4 → 14.0 | ~37% of the piloted camera height (37.5u) — parallax finally reads as altitude |

**The cloud shelf.** A second, *low* cloud layer between bands 2 and 3 — the thing the plane climbs through:
- ~28 puffs, the shipped cloud recipe reused verbatim (icosahedron + shared Lambert material, `transparent`, `depthWrite: false` — `renderer.ts:646-660`): scale 5–11u wide × 1.5–2.5u tall, y 10–12, opacity 0.35, drift 1.5–3 u/s, seeded per match, wrapping at the world border.
- Density couples to the weather pass exactly as the high deck's mood already does (`renderer.ts:642`): clear sky = 16 puffs, overcast = 34.
- Budget: one geometry, one material, ≤34 meshes, no shadows cast/received (`renderer.ts:657`) — same cost class as the existing 14-cloud deck. No particles needed.
- A band-3 aircraft flies **above** the shelf (14 > 12): the player sees their own plane crest the puffs, and the ground dims slightly *because puffs drift under the hull*. The world teaches first (UX Law 5); no vignette required.
- **The shadow is the altimeter.** The blob shadow scales up and fades with band: band 1 = sharp/full, band 2 = 1.3× at 55%, band 3 = 1.6× at 25%. Reading a hull's shadow tells you its band from the deck — counterplay stays honest (the fair-warning law, same family as the LSW landing shadow, `world.ts:820-823`).
- Camera: entering band 3 eases the follow distance +15% (the in-vehicle 1.25× multiplier pattern, `renderer.ts:2500-2501`) — more world under you, the high-command view Robert described as "feel like we're high."

### 3.3 The bomber doctrine — the fortress at band 3

The Anvil already homes at band 3 (`minAirspeed` → band 3 home, `world.ts:3820`, `data.ts:309`). With the Sanctuary Law it finally *lives* there:

- **Bombing from band 3 is the doctrine.** The bomb bay is untouched mechanically — one bomb per trigger, released into the aircraft's momentum, "a LINE you walk across the target" (`world.ts:2254-2275`). What changes is fall time, scaled by release band: ttl **1.2s / 2.2s / 3.4s** from bands 1/2/3 (today: flat 2.2s — `world.ts:2274`). High bombing is safe but *slow to land* — the fortress trades immediacy for immunity.
- **The bomb-fall ring.** The moment a bomb releases, a ground RING appears at the predicted impact point (position + inherited velocity × ttl), tightening over the fall — the LSW pod-warning grammar reused whole (dread ring, panic tempo in the last second — UX §7.8). Radius = the bomb's 7.5u splash (`data.ts:384-388`). The nuke draws it at 26u with the arm-announce that already ships ("CRADLE WARHEAD ARMED — CLEAR THE FIELD", `world.ts:2288-2289`). Counterplay = the warning, priced into the longer fall.
- **The kill chain is social.** A band-3 Anvil is untouchable by the ground. The answers: a Falcon climbs to it (air superiority), or a Lance/MANPADS crew takes the AA position the ground war must fight over (`data.ts:290-295`). An unescorted Anvil dies to the first interceptor; an unescorted Falcon hunting it dies to the escort. "That dependency IS the design" (`data.ts:301-304`) — now enforced by geometry instead of hoped for.

---

## §4 · THE SUBMARINE — the Atari fish

Top-down sub combat stays three verbs: **pick your depth, listen, shoot the fish.** Everything below reuses a shipped grammar: the band walk (§2.1), the burrow's tells (§1.3), the SAM lock diamond, the noise-buys-information law ("EVERYONE HEARS THE LAUNCH" — `world.ts:3128-3130`).

### 4.1 The hull

**Moray Attack Submarine** — new `VehicleDef`, water-locked like the Pike but harder: legal tiles are `T_DEEP` only (a sub in the shallows is a beached sub; §4.5).

| Stat | Value | Note |
|---|---|---|
| cost | 3 | between Pike (2) and tank (4) |
| hp | 180 | two torpedo hits; ~1.6 Pike volleys |
| speed | 13 surfaced · ×0.75 periscope · ×0.45 deep | the burrow's depth tax, graduated (`world.ts:3792` precedent) |
| turnRate | 1.7 | a boat that commits, not a jet-ski |
| seats | 2 | captain + one passenger (the infiltrator insert — §4.6) |
| radius | 2.0 · draft ×0.55 | boat draft rule reused (`world.ts:3868-3870`) |
| systemHp | 24 | engines/sensors break like everything else |

### 4.2 The three depths — what each buys and costs

| Depth | Speed | Weapons | Seen by | Hit by |
|---|---|---|---|---|
| **SURFACED** (0) | 13 | deck MG (`boat_mg` family — `data.ts:74`) | everyone (it's a boat) | everything that hits boats |
| **PERISCOPE** (1) — *"the middle"* | ×0.75 | **torpedoes** | the scope-wake MARK (a foam feather on the surface, always-on while moving); passive sonar | depth charges · enemy torpedoes |
| **THE DEEP** (2) | ×0.45 | none | active sonar only; a faint surface shimmer while moving (the mound grammar, `renderer.ts:1872-1875`, water-flavored) | depth charges · enemy torpedoes |

The deep is the burrow's promise kept at sea: near-invisible, unarmed, slow. Safety you can't shoot from — transit and escape, not a camp spot.

### 4.3 SONAR — the sight system

Water rewrites the sight law: line-of-sight (perception's 65u eye — `perception.ts:19`) applies only to surfaced hulls. Submerged contact is **sound**:

- **Passive (always on, free):** moving hulls (boats, subs at any depth) within 40u appear on the minimap as **hollow** marks — the GHOST variant, bearings that update every 1.5s, never exact (UX §2.9: memory = hollow stroke). A stopped or deep-and-slow sub makes no noise and no mark. Speed is loudness — the outbreak's noise rule, wet.
- **Active PING (G, 6s cooldown):** a RING sweep expands from your hull to 55u; every hull it touches becomes a **solid** mark for 3s — real truth, both depths, exact position. The price: the ping is a broadcast. Every enemy sub and sonar ship hears it and gets **your** exact mark for 5s, and the world plays the ping audibly. Same law as the SAM launch: information you take loudly is information you gave (`world.ts:3128-3130`).

No sonar screen, no minigame. The minimap IS the sonar display — one new mark family, one ring sweep.

### 4.4 The torpedo — the submarine's whole argument

- Fired at PERISCOPE depth only. `torpedo`: damage 110 + splash 4/60, speed 26, range 70, reload 4s. Two fish kill anything afloat; a Pike survives one at 35hp — the drama is the second fish.
- **Wake-visible:** the torpedo drags a foam MARK line on the surface its entire run — everyone sees the spear coming (the whole Atari read).
- **Lock (optional, better):** hold aim on a surface hull 1.2s → the SAM diamond grammar (rotates → tightens → solid + tone, UX §7.3) → the fish gains gentle homing (turn 1.2 rad/s). Predator/prey law applies: it runs ~8% faster than a Pike's top speed, so a flooring gunboat *almost* holds the gap and any turn loses it — the exact `SAM_SPEED_RATIO` doctrine (`data.ts:399-406`), inverted media.
- **The shallow escape:** torpedoes run just under the surface and **die entering `T_WATER`** — the bank-hug is the boat's dodge, the same map-driven mercy as the boat's shallow draft. Deep channels are torpedo country; the shore is sanctuary.

### 4.5 Depth charges — the counter (lives on the destroyer, §5.2)

G on the Marlin rolls a charge astern: it sinks 1.4s, then detonates in a 5.5u ring that damages **submerged** hulls only (130 — both depths; the deep sub's defense is not being *found*, not tanking) and swimmers caught in it. Surface hulls are immune — it bursts below them. The charge drop is loud: it pings the dropper on every sub's passive sonar. Depth-charge runs are commitment.

### 4.6 What subs DO — the strategic sentence

**A submarine denies water the way a Lance denies sky.** On the moat map, the Port front (`fronts.ts:1420-1505`), and ocean-gen maps (`data.ts:559`), a live Moray makes every boat crossing a bet. Its jobs: ambush the boat lanes (torpedo from periscope), scout silently (passive sonar feeds the team like a wet spy camera), **insert one infiltrator** (passenger rides submerged, sub surfaces at the enemy bank, hatch — the APC drop, wet), and — LATER — threaten the carrier, which is the entire reason navies exist.

### 4.7 Shoaling — the depth ladder meets the map

Submerged bands are legal over `T_DEEP` only. Driving deep toward a shallow bank auto-rises the ladder one rung with a **SHOALING** WARN chip — the map, not a timer, is the crush-depth. (UX §7.9's submarine row reserves a "crush-depth warning"; this is it, made deterministic and Atari-simple. No air gauge, no hull-creak meter.)

---

## §5 · THE SCALE AUDIT — soldiers vs machines

The yardstick: the procedural soldier stands **~1.9u** (hips at 0.96, head group at 1.62 + 0.28 face + helmet — `models/soldiers.ts:755`, `:798`, `:1016`). Real trooper ≈ 1.8m ⇒ **1u ≈ 0.95m**. Measured from `src/client/models/vehicles.ts`:

| Hull | Model size (u) | In soldier-heights | Real machine | Real (heights) | Game/real | Verdict |
|---|---|---|---|---|---|---|
| Ares tank (`:102-105`) | hull 3.9 × 2.4 | 2.1 long | M1 Abrams 7.9m hull | 4.4 | **0.48×** | undersized — but HOLD (see below) |
| Bastion APC (`:157-160`) | 3.4 × 2.1 | 1.8 | M2 Bradley 6.5m | 3.6 | 0.50× | HOLD |
| Atlas transport (`:494-498`) | 4.2 × 2.2 | 2.2 | — | — | — | HOLD |
| Scout buggy (`:70-95`) | ~3.5 w/ nose | 1.8 | Humvee 4.6m | 2.6 | 0.71× | closest to honest — HOLD |
| Goliath mech (`:624-695`) | 3.7 tall | 2.0 tall | (fiction) | — | — | HOLD — two men tall reads perfectly top-down |
| Pike gunboat (`:37-68`) | ~4.4 LOA × 1.7 | 2.3 | PBR Mk II 9.7m | 5.4 | **0.43×** | **too small — ×1.4** |
| Kestrel flyer (`:462-466`) | hull 2.4 | 1.3 | UH-1 fuselage 12.7m | 7.1 | **0.18×** | **too small — ×1.35** |
| Vulture strikejet (`:279-296`) | 3.0 long, ~4.0 span | 1.6 | A-10 16.3/17.5m | 9.1 | **0.17×** | **far too small — ×1.7** |
| Falcon interceptor (`:329-345`) | 3.4 long, ~3.2 span | 1.8 | F-16 15.0m | 8.3 | **0.21×** | **far too small — ×1.6** |
| Anvil bomber (`:377-392`) | 4.4 long, ~7.2 span | 2.3 | B-25 16.1/20.6m | 8.9 | **0.26×** | **too small — ×1.6** |

**The verdict Robert asked for:** ground vehicles are ~half real scale and should STAY there — that is the correct *game* scale. The map's grammar is 3u tiles (`map.ts:9-11`, WORLD = 300u square), lanes and doorway gaps are 1–2 tiles, and the tank's 2.4 sim radius already brushes single-tile gaps. A true-scale Abrams (7.9u) could not turn in a street; a true-scale F-16 (15.8u) would be 5% of the map long. Uniform realism is unplayable top-down.

**The fix is differential:** aircraft and boats never thread doorways, so they can afford honesty. Recommended multipliers (model + sim radius together, `radius` in `data.ts` scaled to match):

| Family | Multiplier | Result | Why it lands |
|---|---|---|---|
| Fixed wings (Vulture ×1.7, Falcon ×1.6) | → 5.1 / 5.4u long | ~2.8 heights | a jet finally *dwarfs* the man it strafes; at band 3 + the eased camera it still reads small against the sky — which is the point |
| Anvil bomber ×1.6 | → 7.0 long, 11.5 span | 6 heights of wing | the bomber SHOULD read as a flying building; its shadow (§3.2) becomes the warning it deserves |
| Kestrel ×1.35 | → 3.2 hull | rotors read over rooftops | |
| Pike ×1.4, all new naval hulls born at this scale | → 6.2u LOA | channels are 4+ tiles wide (`map.ts:557-574`) — room to spare | water lanes are the widest roads on the map |
| Ground pool | ×1.0 | — | game scale is correct; do not touch |

One caveat to verify in Slice 1: scaled jets parked on requisition pads (`world.ts:1317`) must still fit the pad art — if not, parked jets fold wings (a one-line model state), which is also just true of naval aircraft.

---

## §6 · UI — every new readout, composed from the closed set

All from UX-LANGUAGE §2 primitives on §5 surfaces, states from §3, motion from §4. Rows below are written ready to append to UX-LANGUAGE §7.9 (per its §9 forcing function — no element ships without its row).

| Element | Primitive(s) | Surface | States | Notes |
|---|---|---|---|---|
| Altitude band `ALT ▲3 ▁▃▅` + Q/E hint | CHIP + minimap ring-per-band | weapon block + minimap | IDLE | already reserved as ❌ in UX §7.9; the three cells fill bottom-up |
| Depth `DEPTH ▼2 ▆▄▂` | CHIP — the ALT chip mirrored (cells fill top-down) | weapon block + minimap | IDLE / WARN (SHOALING) | UX §7.9's submarine row, kept to its "zero new primitives" claim |
| Band transition felt | world (cloud shelf + shadow scale + camera ease) + one-time TAG `HIGH SKY` | world + weapon block | IDLE | teach-once, same pattern as the stall-floor TAG (UX §7.9) |
| Bomb-fall warning | ground RING tightening over ttl + MARK at impact point | world | DANGER | pod dread-ring grammar (UX §7.8); nuke variant 26u + radiation CHIP top bar (UX §7.9 bomb row) |
| Sonar passive contact | minimap MARK — hollow ▲/● (GHOST = the primitive; bearings, 1.5s refresh) | minimap | GHOST | hollow = uncertain, the sight law's own vocabulary |
| Active ping | minimap RING sweep (expanding, one-shot) → contacts flip solid 3s | minimap | ACTIVE → IDLE | |
| YOU are pinged | CHIP (red edge, enemy-sourced) in status strip + faint red ground RING you-only | vitals + world | DANGER | exact reuse of UX §7.6 "YOU are pinged/tagged" |
| Torpedo lock (firing) | reticle MARK diamond — rotates, tightens, solid + tone | reticle + target | ACTIVE → READY | the SAM diamond row, UX §7.3 |
| TORPEDO INBOUND (victim) | TAG on the vehicle role line, red blink (top severity) + wake MARK in world | weapon block + world | DANGER | the MISSILE INBOUND grammar verbatim (UX §7.9, shipped) |
| Torpedo tubes | PIP-ROW `FISH ▮▮` + reload METER (charge) | weapon block | IDLE/ACTIVE→READY | |
| Depth charges | PIP-ROW burn-down `G charges ●●●` | weapon block | IDLE | the flares row, wet (UX §7.9) |
| SHOALING | CHIP, amber breathe | weapon block | WARN | auto-rise is the action; the chip is the caption (Law 5) |

No purple anywhere; enemy-sourced = red family, yours = amber, per the ownership hue rule.

---

## §7 · BUILD PLAN — dependency-ordered slices

Gates for every slice: `tsc` + `vitest` + build green, sim determinism preserved (band/depth walks are already command-driven and deterministic), harness verify via `window.__ww`, Playwright screenshot for anything visual.

### Slice 1 — THE AIR FIX (band-3 raise + sanctuary + clouds + bomber)
1. Sim: projectile `reach` stamping + the band gate at the vehicle-hit test (`world.ts:4416`); retire the SAM terminal-dive hack (`world.ts:213-214`); explosions capped at reach 1.
2. Render: `BAND_ALT = [0.12, 2.0, 8.6, 14.0]`; cloud shelf (≤34 puffs, weather-coupled); band-scaled shadow; band-3 camera ease.
3. Bomber: band-scaled bomb ttl (1.2/2.2/3.4) + bomb-fall ring + nuke ring.
4. Scale: aircraft multipliers (§5) + pad-fit check.
5. UI: ALT chip + minimap band ring + HIGH SKY teach-once TAG.

**Accept:** a harness test proves rifle/autocannon fire cannot damage a band-3 hull and CAN at band 1; a band-3 Anvil survives 10s of massed ground fire and dies to 2 SAM hits; a screenshot from a live match (Playwright, visible tab) shows the jet above puffs with a faded wide shadow; bombs from band 3 land ~3.4s late inside their pre-drawn ring.

### Slice 2 — BOATS NOW (the navy that makes water matter)
1. **Marlin Escort Destroyer** (§5.2 stats: cost 3, hp 260, speed 17, deck MG, passive sonar mast that feeds contacts to the whole team — the head-cam pattern, depth charges on G). The sub's predator, shipped BEFORE the sub so its counter is waiting.
2. **Mudskipper Landing Barge** — cost 2, hp 300, `mobileSpawn: true` (the APC precedent, `data.ts:249`), seats 6, speed 11, may cross `T_WATER` shallows to beach at a bank.
3. Pike scale pass (×1.4) + verify deck-marine seats fire as promised (`data.ts:330-333`).
4. Map duty: boats requisitionable at the Port moorings (`fronts.ts:268`) and moat banks (`map.ts:730-737`); bots learn to crew them.

**Accept:** on the Port front, a Marlin + Pike pair contest the channel; a barge beach-landing spawns a squad on the far bank; headless reachability test confirms no water lane is boat-illegal end-to-end.

### Slice 3 — THE SUBMARINE
1. Moray hull (§4.1) + the three-depth ladder on the Q/E grammar (§2.1) + hatch-on-Q; Mole's toggle migrates to the same grammar.
2. Torpedo (+wake MARK, +lock diamond, +shallow-death rule) · deck MG (surfaced only) · sonar passive/active · SHOALING auto-rise.
3. Depth-charge interaction (Marlin ready from Slice 2).
4. UI: DEPTH chip, sonar marks, ping sweep, TORPEDO INBOUND, tube pips.

**Accept:** deterministic test — a deep, slow Moray produces zero passive contacts; an active ping reveals it AND marks the pinger; a locked torpedo loses a straight-flooring Pike but catches a turning one; a periscope Moray sinks a Pike in two fish; depth charges kill submerged hulls only. Live match: sub inserts an infiltrator at the enemy bank.

### Slice 4 — LATER (parked, on purpose)
- **Albatross Fleet Carrier, v1 — the honest cheap version:** one big hull (radius ~6, the widest thing afloat), `mobileSpawn: true`, and a **deck pad** — a requisition pad that rides the hull (`padId` grammar, `world.ts:1317`) so aircraft spawn, spool, and lift from the deck; landing = touch the deck at band 0. **NO interior** — walkable interiors are the expensive part (per-vehicle interior grids, cameras, doors — none of it exists) and the fantasy ("planes taking off from a ship") needs none of it. Robert's instinct was right: save it; this v1 is ~a pad on a hull.
- Depth −3 / the sea floor: wrecks settle; salvage/hotwire-at-depth plays.
- Sub-vs-sub polish: hydrophone duel (both silent, both listening — the mirrored-ping mind game).
- Carrier v2 someday: interior via the starship corridor generator (`fronts.ts:1404`) if boarding actions ever earn their cost.

---

## §8 · THE CUT LIST — simplicity debts declined

Named so nobody re-litigates them silently: continuous altitude (bands or nothing — `types.ts:588` said it first) · oxygen/air meters for subs (the map is the limit, §4.7) · torpedo depth-keeping minigames · a sonar screen (the minimap is the sonar) · carrier interiors (§7.4) · sub crush damage timers · seaplanes/torpedo bombers (until the carrier exists, they have no home).

*Every altitude is a promise: what can reach you, what you can reach, and what everyone else can read off your shadow. Keep the ladder honest and the rest is gunnery.*
