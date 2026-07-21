# SQUADS — THE FIRETEAM LAYER
### Design spec for WAR WORLD: EARTH. 2026-07-21. DESIGN-ONLY — nothing here is wired except where §0 says so.

> Robert: *"We're gonna need to have squads."*

The squad is where the war gets personal. Soldiers are persistent, endearing,
Jagged-Alliance-grade personas (VO-CATALOG §1's speaker model is built for
exactly this); the squad is the room where those personas talk, coordinate,
and come to matter. Military missions are coming — large vehicle-vs-vehicle
operations and smaller individual-scale ops — and **the squad is the unit of
the smaller scale** (the skirmish builder already stamps "two squad bases"
into every mission ground, `src/sim/skirmish.ts:4`).

**Companions:** `docs/UX-LANGUAGE.md` (every UI element below composes from
its §2 primitives, lives on a §5 surface, obeys §4's motion law — no purple,
ever) · `docs/VO-CATALOG.md` (§2F is the squad-comms table; every order below
maps 1:1 to its slots) · `docs/WAR.md` §5 (science missions — the
individual-scale op) · `docs/MASTER-BACKLOG.md` (0.2 SIGHT decision, 10.5
squad size 1-8 LOCKED for missions).

**The one law, stated first: A SQUAD IS A LAYER, NEVER A LEASH.** This is a
shooter. Nobody baby-sits a formation, nobody's soldier is steered by someone
else's click, and a player who ignores the squad entirely loses nothing but
flavor and convenience. The squad biases spawns, intel, revives, and voices —
it never takes the sticks.

---

## §0 · THE SHIPPED SUBSTRATE — what already exists (verified)

The sim already has squad plumbing. Build on it; reinvent nothing.

| piece | where | what actually ships |
|---|---|---|
| `squadId?: number` | `src/sim/types.ts:444-447` | "the fireteam this soldier deploys with — 2-4 bodies who share a spawn and read each other. Offline your friendly bots ARE your squad. Rides the wire free." |
| The squad container | `src/sim/world.ts:531-540` | Assignment at `addSoldier`: humans + bots only (dogs and the horde "stay outside the org chart"), **fours by roster order** — `squadId = team*100 + floor(mates/4)`. |
| Spawn-on-squadmate | `src/sim/world.ts:1237-1255` | On respawn, a living, upright, **safe** squadmate (no enemy within 20u) beats the spawn ring; the Statue Law rejects mates stuck in masonry/deep water; ±2.6u scatter, 12 rolls, ring fallback. |
| Rescue bias | `src/sim/bots.ts:537-541` | `isolatedFriendly`: a cut-off **squadmate counts as half the distance** when a rescuer picks who to answer. |
| Squadmates read each other | `src/client/ring.ts:19-28` | `ringTier`: squadmates always read each other at ≥ T1 (the grade); a medic viewer reads a squadmate at T2 (the exact number — "the diagnostic eye"). |
| Squad overhead tag | `src/client/renderer.ts:1548-1575` | Friendly name + vitals tag ON DEMAND (hover), not always-on — the anti-clutter law. |
| Squad VO slots (spec) | `docs/VO-CATALOG.md` §2F | `order_move/hold/help`, `ack_*`, `medic_call`, `ammo_call`, `squad_wipe` — specced with tiers + cooldowns, **not wired**. "squadId is live; a player ORDER system isn't." |
| Squad UI rows (spec) | `docs/UX-LANGUAGE.md` §7.13 | Squad pips, distinct squadmate marks, squad killfeed line, squad-scoped order diamonds — all ❌ today. |
| Team waypoints | `src/client/hud.ts:11-26,51-62,103-109` | Click-minimap waypoint (equipment-gated `waypointsEnabled`), 25s TTL, cap 8, diamond MARK on minimap (`hud.ts:722-736`) + amber light pillars in world (`renderer.ts:2424-2450`), relayed in MP (`net.ts:65`). **Client-only state — bots never see these.** |
| The bot brain to build on | `src/sim/bots.ts:574-586` (`cachedObjective`, ~4 Hz) · `:588-761` (`objectiveFor` per mode) · `:1427-1466` (medic Decision 49A) · `:460-492` (`defendsNow`) · `:548-557` (`amClosestRescuer`) | The four things a bot already knows how to do: go somewhere, hold somewhere, go to a body, shoot a thing. The four order verbs (§2) are exactly these. |

**Honesty notes — where the comments outrun the code:**
- "LAST STAND — a SQUAD down to its last member" (`bots.ts:1324-1341`)
  actually counts the whole **team** roster, not the squad. With real squads,
  re-scope it (slice 2 cleanup) so LAST STAND means your fireteam.
- "hold near squad center" in horde/survival (`bots.ts:727-732`) is the
  **team** centroid. With 1-2 squads alive that's usually the same thing;
  it becomes squad-scoped for free once orders land.
- Spawn sharing takes the **first** safe squadmate found, not the best one —
  acceptable; the wave-in (§3.1) is the real upgrade.

---

## §1 · THE SQUAD MODEL

### 1.1 Size & assignment

| rule | value | why |
|---|---|---|
| Squad size | **2-4, target 4** | Shipped container maths (`world.ts:539`). 4 is the read budget: three mate chips fit the vitals block without crowding it (§4.1); 4 voices is the most the radio lane can charm without spamming (§5). |
| Remainder rule | a leftover of 1 rebalances the last two squads to 3+2 — **no squad of one** | A squad of one is a lie the UI has to keep telling. (Today's floor-div CAN produce it; slice 1 fixes assignment.) |
| 12v12 default | 3 squads per side (`main.ts:50`, `botsPerTeam = 12`) | |
| Membership | humans + bots only; dogs, scientists, LSWs, the horde stay outside (shipped, `world.ts:534`) | A god has no fireteam; a K9 attaches to a handler, not a roster slot. |
| Mid-match joins (MP) | a joining human fills the first squad with an open slot, else opens a new one | Same roster-order law, live. |
| LSW ascension | an ascended squadmate LEAVES the squad for the duration (the strip shows the slot as ☄ ASCENDED, not dead); death hands the mortal back (`world.ts:699-703`) | A god on your strip would dwarf the meter and the fiction. |

### 1.2 Composition — incentives, never mandates

Slice 1 upgrades assignment from bare roster order to a **class-spread deal**:
deal classes round-robin so no squad is four snipers, and deal every medic to
a different squad first (**the medic slot**: with 3 squads and ≤3 medics,
every squad gets its doc).

Why the medic slot is worth a rule and the rest is only a shuffle:
- The medic already reads squadmates at T2 (`ring.ts:26`) — the diagnostic
  eye is squad-scoped TODAY.
- Decision 49A ("nobody bleeds out alone", `bots.ts:1427-1466`) plus §3.2's
  squad revive weighting makes the squad medic the difference between a
  15-second bleedout and a fireteam that gets back up.
- VO-CATALOG `medic_call`/`medic_ack` (§2F) are squad-channel lines.

Human class choice is never overridden — you pick sniper, your squad's spread
adjusts around you. Composition is a dealer's courtesy, not a lobby rule.

### 1.3 Formation vs freedom

**No formation system. None.** Bots keep their class doctrine
(`bots.ts:783-792`), their separation shove, their own pathing, their
retreat-at-`doc.retreat` self-preservation. What the squad changes about
movement is exactly two biases, both already precedented:

1. **Spawn gravity** (shipped): you re-enter the war near your people
   (`world.ts:1237`).
2. **Answer gravity** (shipped): when someone must peel off to help, a
   squadmate's call weighs double (`bots.ts:539-540`).

Everything else — moving as a unit, stacking a door, holding a line — happens
only while an ORDER (§2) is live, and orders expire. Between orders a squad
is four soldiers who happen to know each other's names.

### 1.4 Human + bot mixed squads — the common case

Offline, `addSoldier` order (`main.ts:454-508`: you first, then bots) puts
**you + the first 3 bots in squad `team*100`** — you plus Vex, Talon, and
Havoc (`main.ts:37-41`). That IS the product: your three named regulars.

| situation | leadership rule |
|---|---|
| 1 human in the squad | You are leader. You never asked for the job; it costs nothing (leading = you MAY issue orders; you never must). |
| 2+ humans | The senior roster slot leads BY DEFAULT; any human may issue orders — last order wins, 2s per-leader input cooldown (§2.2). No permission UI, no kick votes. It's a fireteam, not a committee. |
| 0 humans (all-bot squad) | The bot with the highest `defendsNow`-style fitness is the nominal leader — meaningful only for VO attribution (who "calls" the squad's plays) and the future mission layer. Bot squads need no orders to function; the mode brain (`objectiveFor`) already runs them. |
| Bot leader, human member | **Suggestions, never control** — §2.4. |

### 1.5 Identity — name, patch, personas

| element | design | grounding |
|---|---|---|
| Squad name | Faction-flavored callsign table, deterministic from `(team, squadIndex, map seed)`: United Front squads are stones and tools (HAMMER, ANVIL, FLINT, WEDGE); Collective squads are process words (VECTOR, LATTICE, CIPHER, RELAY) | The two-names law (LORE.md via backlog 3.4): factions don't even name squads the same way. |
| Patch | A 1-glyph + 1-color stamp (shape channel legal: squares/diamonds, hard edges, faction hue family only) shown on the strip header and the scoreboard SHEET. Generated art later (PixelLab, seed-stable); glyph-only ships first. | UX §1.4 shape constitution; no art blocks the feature (UX §6.4 rule 3). |
| Member personas | Bot names already persist per match (`main.ts:37`); the VO personalization ladder (VO-CATALOG §1: class voice → archetype → generated persona) is the voice of it. Squads add the RULE: **no two mates share a voice archetype** (v2+) — a squad must sound like four people. | The manifest-is-the-product bet (VO §1). |
| Roster continuity | Offline career keeps your squad roster between matches (same names, same classes unless you change difficulty/mode constraints). The dossier/barracks screen lists them. Backgrounds/origins/friend-graphs are a future pass — the NAME persisting is the hook that costs nothing now. | MASTER-BACKLOG 10.9 (the unnamed soldier addresses YOU; your mates are already named). |

---

## §2 · THE ORDER SYSTEM

### 2.1 The verb set — four, and why exactly four

Every verb is a thing the bot brain ALREADY does, re-aimed. A verb without
shipped machinery behind it doesn't ship.

| verb | meaning | the shipped machinery it re-aims | why it earns a slot |
|---|---|---|---|
| **MOVE** | "get to this point" | The objective override lane: `cachedObjective`/`objectiveFor` (`bots.ts:574-586, 588`) already feeds `botGoal` → `pathStep` A* (`bots.ts:49`). RESCUE already outranks the mode at the top of `objectiveFor` (`bots.ts:593-598`) — MOVE inserts at the same altitude. | The universal verb; the waypoint system already teaches the gesture (`hud.ts:52`). |
| **HOLD** | "stay here, use cover, watch" | The defend orbit: conquest defenders ring a point at r≈7 with per-id spread (`bots.ts:721-723`); guard room-duty posts bodies indoors (`bots.ts:651-666`); `nearestCover` threat-scores tiles (`bots.ts:814`). | MOVE without HOLD means bots arrive and wander off; HOLD is the other half of every plan. |
| **HELP** | "rally on me / on this mate — bodies now" | The rescue beacon: `isolatedFriendly` + `amClosestRescuer` (`bots.ts:525-557`) and medic Decision 49A (`bots.ts:1427-1466`). HELP is that machinery, summoned instead of inferred — and it summons the SQUAD, not one rescuer. | The distress verb; it's also the medic call (VO `medic_call` rides it when the issuer is downed/hurt). |
| **FOCUS** | "this target dies first" | Target selection: `botTargetId` (`types.ts:512`), the acquire path (`bots.ts:1311`), and the tag-dart pin pattern — "soldier id → time the pin burns out (re-pings each tick)" (`world.ts:307`). | Focus fire is the one squad behavior that visibly wins fights; it's also how a leader answers an LSW (the threat table assumes concentrated fire, `lsw.ts:28-34`). |

**Deliberately absent:** FOLLOW (a standing leash — MOVE re-issued is honest
about the cost), RETREAT (bots already retreat by doctrine; HOLD at a rear
point does the job), class-specific verbs (SENTRY HERE, SMOKE THAT — v2 at
the earliest; four verbs is a rose a thumb can learn).

### 2.2 Issuing — top-down, ping-based, one key

Reuse the waypoint gesture family; add one key. Free keys checked against
`input.ts:70-79` (`r g q e x b z f 1-3 tab m c` taken): **V** is the comms key.

| gesture | result |
|---|---|
| **Tap V** | Smart ping at the reticle/cursor: enemy under cursor → FOCUS · downed/hurt squadmate → HELP (on them) · ground → MOVE. The context does the choosing; 90% of orders are a tap. |
| **Hold V** | The comms rose: 4 verbs on the diamond (MOVE north, HOLD south, FOCUS east, HELP west) + release over one to issue at the cursor point. Gamepad: d-pad-left opens the same rose (d-pad ◄ currently only picks weapon slots with ►, `input.ts:112-116` — confirm free at build time). |
| **Minimap click** | While the squad strip is present, a minimap click issues squad MOVE to that point (the shipped waypoint gesture, re-scoped; the equipment-gated TEAM waypoint stays as-is for Tactical System carriers — squad orders are standard kit, team-wide marks stay equipment). |
| **HELP on self** | Tap V while aiming at nothing within 4u of yourself while below 50% hp or downed → HELP on you. Downed players get it free: the existing down-state E-prompt row grows a "V — call squad" hint. |

Rate limit: one order per 2s per leader (input-side), and re-issuing a verb
replaces the previous order of that verb — **a squad holds at most ONE order
per verb, and in practice one order at a time** (a new MOVE cancels a live
HOLD; FOCUS coexists with movement orders; HELP preempts everything but is
itself replaced by any new order once resolved).

### 2.3 Bot obedience — mapping each verb into the brain

Orders are **sim state** (see §2.6), read by `objectiveFor` at the same
altitude as RESCUE — above the mode, below survival instinct.

| verb | insertion point | exact behavior | what the bot NEVER surrenders |
|---|---|---|---|
| MOVE | top of `objectiveFor` (`bots.ts:588`), same pattern as the rescue outrank (`:593-598`) | objective = order point + per-id ring spread (the conquest r=3 pattern, `bots.ts:721-723`) so four bodies don't stack a tile; `botObjAt` cache honors the order tick (force-recompute on order receipt, the same trick as the carry-state flip, `bots.ts:562-566`) | Combat doctrine en route (they fight contacts per class), retreat at low HP, door IQ, pathfinding — MOVE sets WHERE, never HOW. |
| HOLD | same lane | objective = hold point; inside r=7 the bot picks a `nearestCover(w, point, 10, team)` tile if one exists (`bots.ts:814`), else the id-spread ring; `chase` is suppressed (anchors don't chase — the heavy's own doctrine, `bots.ts:785`, applied squad-wide while held) | Shooting back, grenade use, medic duties (49A outranks HOLD — the doc leaves the line to save a life, then returns). |
| HELP | replaces `isolatedFriendly`'s inference | ALL living squadmates set objective = the beneficiary (y-channel storey law respected, `bots.ts:596-598`); medics weapon-slot-1 and beam on arrival (49A's own code path); non-medics take overwatch ring r=5 (the safehouse perimeter pattern, `bots.ts:738-740`) | The one-rescuer economy stays for NON-ordered rescues; an ordered HELP is the whole squad because a human said so. |
| FOCUS | target selection, not movement | while the pin lives, squadmates within weapon range of the target treat it as `botTargetId` if they have LOS (`findTarget` bias, not override — no wallhack aiming); the pin re-marks the target for the SQUAD's minimap each tick (the tag-dart pattern, `world.ts:307`) — squad-scoped, NOT the global `pinged` set | LOS honesty (no shooting what they can't see), self-defense (a bot being stabbed answers the knife first). |

**Compliance is loud** (the ack IS the confirmation UI): exactly ONE mate
voices the ack per order — the nearest living mate, 0.3-0.9s staggered delay
— per VO-CATALOG §2F (`ack_move` P3/D, `ack_hold` P3/D, `ack_help` P2/B) and
the C-class team dedupe (§3.3). The others just go.

### 2.4 A bot leader and a human squadmate — suggestions, never control

When an all-bot-led squad (or the bot officer channel) has something for YOU:

- It renders as a **suggested MARK** — the order diamond in muted steel
  (`--muted`), never amber, with a mono TAG (`SUGGEST · MOVE`) — plus one
  radio line ("Rally point marked, your call."). It never blinks, never
  breathes, expires in 15s per the exit law.
- Your soldier's controls are untouched, always. There is no "decline" —
  ignoring it is declining.
- Precedent: the officer channel already defers to humans — "a faction WITH
  a human never auto-calls: the officer channel is yours"
  (`world.ts:668-677`). The squad obeys the same constitution.

### 2.5 Order TTL and the nothing-blinks-out law

| verb | TTL | early release | ghost |
|---|---|---|---|
| MOVE | 25s (matches shipped waypoint TTL, `hud.ts:107`) | all living mates within 6u of the point | diamond holds 0.4s, fades `T_FADE` 0.55s (UX §4.2.1); minimap ghost hollow-stroke 2-3s (§4.2.3) |
| HOLD | 90s hard cap | countermanded, or squad reduced to the holder alone | same; the hold ring collapses inward over the fade — an emptying position reads as one |
| HELP | 20s | beneficiary upright (revived/healed >50%) or dead | same |
| FOCUS | 12s | target dies (impulse flash on the mark — the snap-reset exception, §4.2.4) or breaks LOS from the whole squad for 3s | pin becomes a GHOST contact mark at last-seen (§3.3) |

Expiry hands every bot back to `objectiveFor`'s mode brain the same tick —
no lingering half-orders, no bot standing at a stale diamond.

### 2.6 Determinism & the wire — orders are sim state

Today's waypoints are client-only cosmetics (`hud.ts:21` — the sim never
sees them). **Squad orders cannot be**: bots read them, so they must live in
the sim and replicate, or replays and MP diverge.

- `world.issueOrder(squadId, verb, target: Vec3 | soldierId, issuerId)` — an
  explicit API call from input, the same shape as `requestLsw`
  (`world.ts:642`): validated in the sim (issuer alive, in squad, rate
  limit), applied deterministically.
- Order state lives on the World keyed by squadId (one slot per verb per
  squad — bounded, snapshot-cheap), rides the snapshot exactly like
  `squadId` "rides the wire free" (`types.ts:446`, `snapshot.ts`).
- The HUD's waypoint pillars/diamonds render FROM sim order state for squad
  orders; the legacy client-side team waypoint stays cosmetic.

### 2.7 The VO contract — orders map 1:1 to VO-CATALOG §2F

| game moment | VO slot (§2F) | tier/CD | note |
|---|---|---|---|
| leader issues MOVE | `order_move` | P2/B | issuer's mouth, radio FX if mates >34u (§1 speaker model) |
| leader issues HOLD | `order_hold` | P2/B | |
| leader issues HELP | `order_help` | P1/A | |
| leader issues FOCUS | `order_focus` — **NEW ROW for §2F** | P2/B | "Drop THAT one first." · "Priority target — light it up." |
| mate accepts | `ack_move` / `ack_hold` / `ack_help` / `ack_focus` (new) | P3/D · P3/D · P2/B · P3/D | ONE ack per order (§2.3) |
| downed leader calls | `medic_call` → squad medic answers `medic_ack` | P1/A · P2/B | HELP-on-self wears this pair when the issuer is the casualty |
| last mate falls | `squad_wipe` | P1/A | your own mouth: "Squad's gone… just me." |

FOCUS rows are the one addition VO-CATALOG needs — same table, same doctrine,
logged here per the catalog's own extension pattern. Everything else is
already specced with lines, tiers, and cooldowns; the order feature "ships
speaking" exactly as §2F intended.

---

## §3 · SHARED LIFE

### 3.1 Spawn ON squad (shipped) → spawn WITH squad (the wave)

**ON squad — shipped and kept as-is** (`world.ts:1237-1255`): a respawn
lands ±2.6u off a living, upright squadmate with no enemy inside 20u, Statue
Law enforced. This is what makes reaching a downed teammate "a decision
instead of a formality" — keep every number.

**WITH squad — the addition:** when 2+ squadmates are dead at once, sync the
wave. The earlier `respawnAt` waits for the later, **wait capped at 4s and
never extending the latest timer** — the squad walks back in together, one
spawn resolve, one shared entry point (the mate-or-ring pick runs once for
the wave). Two dead soldiers trickling back one by one feed a camper; a
fireteam arriving as a fireteam is a counter-attack. Deploy VO (`deploy`,
§2A — "Squad, on me.") plays once for the wave, not per body.

**The spawn priority ladder** (design of record, mostly shipped order):

1. Safe squadmate (shipped) — the anchor.
2. Squad APC/mobile spawn — shipped as a 33% roll (`world.ts:1256-1257`,
   "the APC is a door, not a clown car"); becomes deterministic preference
   #2 when the APC has a squadmate aboard (the crew callout already knows a
   squadmate boarding is news, `renderer.ts:3817`).
3. The spawn ring (shipped argmax with the dogpile fix, `world.ts:1220-1234`).

**Beacon/warp interplay:** the game's beacons are TARGETING beacons
(`world.ts:4056-4058` — intel, not spawns) and pathfinder WARP pairs
(`world.ts:1929-1935`) — neither is a spawn point and this spec adds no
spawn-beacon. The interplay is mobility, not spawning: a pathfinder's warp
pair is the squad's door once you're alive. Keep it that way — spawn gravity
already has three rungs; a placeable fourth is power creep on the dead.

### 3.2 Squad-scoped revive priority — the drag-your-buddy loop

Shipped loop, untouched: lethal damage downs, bleedout clock
(`world.ts:3564-3580`), E while moving = drag at half speed with the body
trailing 1.2u (`world.ts:3539-3562`, `:2431`), E standing still = 3s field
revive channel, medibeam = one-touch revive (49A, `bots.ts:1430`).

The squad layer adds **weights, not rules**:

| chooser | today | with squads |
|---|---|---|
| Bot medic picking a patient (`bots.ts:1431-1444`) | nearest downed within 34u | squadmate downed counts at ×0.5 distance (the exact `isolatedFriendly` precedent, `bots.ts:539-540`) — your doc crosses the street for YOU, another squad's doc for their own |
| Non-medic field revive (`world.ts:3529`) | nearest downed in AID_RANGE | unchanged — hands within 2u don't check patches |
| Downed-mate urgency UI | ground RING, urgency-paced (UX §7.2, shipped) | a downed SQUADMATE additionally lights their strip chip DANGER + an edge chevron if off-screen (§4.3) — the squad knows first and loudest |

The bleedout window plus spawn-ON-squad already makes the save worth more
than the respawn; squad weighting just makes sure it's YOUR people doing the
saving, which is where the persona attachment (§5) is earned.

### 3.3 Shared intel — squadmate sightings pin contacts

Grounding: perception memory is per-TEAM `lastSeen` marks (`world.ts:302-306`)
and the SIGHT decision of record is **"the 3D view shows what YOU see, the
minimap shows what your TEAM sees"** with ghosts as ground contact marks, not
jogging bodies (MASTER-BACKLOG 0.2, issue #46). Squads sharpen that split
without breaking it:

| layer | who feeds it | how it reads | law |
|---|---|---|---|
| Your own eyes | you | full-truth 3D + minimap | unchanged |
| **Squad sightings** | your 3 mates' live perception | minimap contact at full mark strength **with a squad tick** (the §7.13 "dot + underline tick" grammar, inverted for hostiles: triangle + tick) — plus FIRST-CONTACT VO (`spotted_*`, §2C: "the words are the minimap") | the mark holds while any mate holds the sight, then GHOSTS: hollow stroke at last-seen, 2-3s fade (UX §4.2.3 — the hold-then-fade law, exactly the sight system's own) |
| Team-wide | everyone else | plain minimap marks per the shipped `lastSeen` linger | unchanged |
| FOCUS pin | the order (§2.1) | the target's mark re-pins each tick for the squad while any mate has LOS (tag-dart pattern, `world.ts:307`) — squad-scoped state, deliberately NOT the global `pinged` set (`world.ts:296`), so a squad order never feeds the whole team wallhack-grade intel | pin expires → GHOST, same law |

**Never** does squad intel put an enemy body on your 3D screen that your own
eyes can't see — intel is marks, sight is sight. (See §4.3.)

---

## §4 · THE SQUAD UI — composed strictly from UX-LANGUAGE §2

Every element below names its composition line per UX §9. New §7.13 rows are
listed in §4.5 for the enforcement table.

### 4.1 The squad strip

```
╔═ HAMMER ◈ ═══════════════════════════╗   <- squad name + patch glyph (TAG pair)
║ ▪VEX    ▪TALON   ▪HAVOC              ║   <- 3 mate CHIPs
║  ▓▓▓░    ▓▓▓▓     ▓░░░  ← hp micro-METER (3px) per chip
╚══════════════════════════════════════╝
```

- **Composition:** `PIP-ROW of 3 mate CHIPs (glyph + name TAG + hp
  micro-METER) + squad-name TAG header — vitals block`.
- **Surface (the §5 map):** the **vitals block**, bottom-left — which
  already lists "PIP-ROW (squad)" as an allowed primitive (UX §5, vitals
  row). It sits above the stamina bar, below the status strip; the strip's
  8-chip cap is untouched (mate chips are their own row, not status chips).
- **Sizing:** each mate CHIP `~4.6rem` wide, S1 padding, micro type
  (0.62rem) for names, 3px METER; the whole strip one S2 gap tall. Three
  chips + header ≤ the vitals plate's 19rem width with room to spare.
- **The glyph slot** is the portrait slot: ships as the class glyph
  (`.eq-chip` square-icon variant, 1.05rem); slice 3 swaps in 1-bit pixel
  portraits (PixelLab, seed-stable per name) — same slot, no layout change.
- **States** (the §3 seven, per chip):

| mate state | chip state | render |
|---|---|---|
| alive, healthy | IDLE | steel border, muted name, green-family meter |
| alive, hp ≤50% / ≤25% | WARN / DANGER meter ladder | meter color only — the chip border stays quiet (UX gauge ladder §2.5) |
| **downed** | DANGER | border + name breathe `BREATHE_DANGER`; mono bleedout TAG (`0:12`) replaces the meter — counts the shipped `downedUntil` |
| dead, waiting | DEAD | 38% opacity grayscale + mono respawn countdown TAG (§3's DEAD allows the countdown) |
| ascended (LSW) | ACTIVE | ☄ glyph + amber — the slot is empty because your mate is currently a god |
| being dragged / reviving | ACTIVE | green arc-wipe over the chip tracking `reviveProgress` (the CHIP radial-wipe variant, §2.3) |

- Hover a chip → the world camera does nothing (no leash), but the mate's
  overhead tag lights as if hovered in-world (`renderer.ts:1554-1575` — the
  existing on-demand tag, triggered from the strip).
- Budget: ≤1 breathing element at a time on the strip — if two mates are
  down, severity sorts, the older down breathes, the newer holds solid
  (UX §4.1's two-breathing-per-surface cap shared with the vitals ring).

### 4.2 Order MARKs — world + minimap

The order glyph is the shipped waypoint diamond ◇ — "waypoint/order" is
already the diamond's assigned meaning in the shape channel (UX §1.4).

| element | composition | look |
|---|---|---|
| Order point (world) | `MARK (diamond) + one verb TAG — world marks surface` | the shipped amber light pillar (`renderer.ts:2424-2450`) reused at squad scope, diamond at its base, mono TAG: `MOVE` / `HOLD` / `HELP`; `#ffe08a` waypoint family (UX §1.1 ordnance family) |
| Order point (minimap) | `MARK (diamond, 4px)` | the shipped diamond draw (`hud.ts:722-736`) minus the number — squad orders aren't numbered, there's only ever one per verb |
| HOLD ring | `ground RING (360°, closed — the circle IS the area, UX §2.6)` at r=7 | hairline amber; collapses inward on expiry (§2.5) |
| FOCUS pin | `MARK on the target (bracket corners, RED_WORLD) + minimap tick` | brackets quote the `.brk` language on a hostile; kill → IMPULSE flash then gone (the sanctioned snap, §4.2.4) |
| Suggested order (bot→human) | same diamond in `--muted` steel + `SUGGEST` TAG | §2.4 — never amber, never breathing |
| All ghosts | GHOST variant per mark (UX §2.9: "Every MARK must define its GHOST") | hollow stroke, hold-then-fade per §2.5's table |

### 4.3 Squadmate silhouettes through walls? **NO.**

The sight law is the game's spine: the 3D view shows what you see (backlog
0.2 decision; the cloak, smoke, roof-concealment and ghost rules all hang off
it, `hud.ts:619-692`). Wallhack silhouettes for friendlies would make every
interior fight read as X-ray and cheapen the one honest channel. The lawful
alternative, in placement-ladder order (UX §5):

1. **The minimap** — squadmate dots are always-on team truth (shipped,
   `hud.ts:683`); slice 1 adds the §7.13 underline tick so YOUR three read
   distinct from the other nine.
2. **Edge chevrons** — `MARK (chevron, screen-edge-clamped) + distance TAG`,
   fullscreen surface: a small amber chevron at the screen edge pointing at
   an off-screen squadmate, shown ONLY when that mate is downed, is the HELP
   beneficiary, or holds a live order point — cap 3, exit law applies.
   (An always-on trio of arrows is clutter; event-gated arrows are wayfinding.)
3. **The overhead tag on demand** — shipped hover behavior
   (`renderer.ts:1548`), now also triggerable from the strip (§4.1).

### 4.4 BANNER moments — rationed hard

Banners are the game's loudest surface (max one state + one announce,
UX §2.8); squads earn exactly these:

| moment | kind | text | trigger |
|---|---|---|---|
| Squad wiped (yours) | RECORD announce, `HOLD_ANNOUNCE` 2.5s | `HAMMER WIPED` | last living mate falls (client-derivable: all `squadId`-mates dead/downed — VO `squad_wipe` plays with it) |
| You are the last | reuse the shipped LAST STAND announce (`bots.ts:1338-1341`) — re-scoped to the squad (the §0 honesty fix) | `VEX — LAST STAND` | squad down to one |
| Enemy squad wiped by yours | killfeed FEED line, NOT a banner | `HAMMER ✕ CIPHER — squad wiped` | squad-attributed kill closes an enemy roster |
| "Squad holding" / order confirms | **never a banner** — the ack VO + the mark's ACTIVE state are the confirmation | — | — |

The safehouse mode's "SQUAD WIPED" announce (`modes.ts:461`) already speaks
this language at match scale; the squad-scoped line is its little brother.

### 4.5 New rows for UX-LANGUAGE §7.13 (the enforcement table)

| Element | Primitive(s) | Surface | States | Status |
|---|---|---|---|---|
| Squad strip (3 mate chips + header) | PIP-ROW of CHIPs + TAG + micro-METER | vitals block | per-chip, all seven | 📋 this doc |
| Squad order marks (MOVE/HOLD/HELP/FOCUS) | MARK (diamond/brackets) + TAG + ground RING, each with GHOST | world + minimap | ACTIVE→GHOST | 📋 |
| Squadmate distinct minimap read | MARK (dot + underline tick) | minimap | IDLE | 📋 |
| Edge chevron (downed mate / order point) | MARK (edge-clamped chevron) + TAG | fullscreen edge | DANGER/ACTIVE | 📋 |
| Squad wipe / last stand lines | BANNER (record) + FEED CHIP variant | fullscreen + killfeed | DANGER | 📋 |
| Suggested order (bot→human) | MARK (muted diamond) + TAG | world + minimap | IDLE, 15s | 📋 |

---

## §5 · THE PERSONA HOOK

### 5.1 Where squad chatter lives

Every squad voice moment is already a VO-CATALOG row — the squad feature adds
**zero new speech infrastructure**, it just finally gives §2F its trigger:

| moment family | catalog rows | lane (VO §3.2) |
|---|---|---|
| Orders + acks | §2F (+ the FOCUS pair, §2.7) | radio (>34u) or positional (near) |
| The casualty loop | `downed_ally`, `reviving`, `revived`, `medic_call/ack` (§2A/§2F) | positional/radio |
| Contact calls | `spotted_*` (§2C) — spoken by "whoever sees it first", which with §3.3 is usually a squadmate; the per-kind line IS the intel | positional |
| The carpet | `idle_squad` (§2J), `deploy`, `walk_corpses` | positional |
| The gut-punch | `squad_wipe`, `ally_turned` (§2B), `last_stand` | personal |

The 4-lane voice bus (§3.2: announcer 1 · personal 1 · positional 2 ·
radio 1) already reserves the radio lane squads will live on.

### 5.2 Personality WITHOUT spam — the banter budget

The anti-spam doctrine (VO §3) is the contract; squads add one pattern and
change no numbers:

- Idle banter is **P3, class E**: 45-90s rolled cooldown, 50% chance gate,
  combat-silences instantly, dropped never queued (VO §3.1/§3.3). Under the
  global governor (≤10 lines/min heard, hard cap 14, §3.5) squad flavor is
  the FIRST thing muted under pressure — by design. Silence is a feature.
- **The exchange:** an `idle_squad` line may draw exactly ONE response line
  from a different mate (2-4s later, same E budget, only into a free lane).
  Two voices is banter; three is noise. Max one exchange per 60s per squad.
- Personality surfaces in the mandatory lines too, for free: the same
  `ack_move` slot rendered per-persona ("Moving." vs "Copy, relocating." vs
  whatever a v3 generated persona does with it) — the manifest-is-the-product
  bet (VO §1, §4.6) means squad character costs a render pass, not a system.
- Who banters: mates within 10u (§2J trigger), weighted toward pairs who've
  shared a match event this life (a revive, a shared FOCUS kill) — the
  cheapest possible "these two have history" without a relationship model.

### 5.3 The retention hook — the characters you'd pay not to lose

The design bet: **your squadmates are the persistent characters the war
gives you** — named (§1.5), voiced distinctly (§5.1), the people who drag
you behind cover (§3.2) and answer when you call (§2). The economy of WAR.md
§3 (lives are clones, bodies are hardware) leaves one thing that is NOT
reprintable on a whim: a persona.

Noted for the meta/monetization layer — **explicitly not designed here**:
the charge-to-wipe idea (a squad wipe in campaign/mission modes threatens
permanent loss of a named squadmate unless paid off/insured) hangs off this
spec cleanly — everything it needs (per-squad identity, roster continuity,
the wipe event, the attachment loop) ships in slices 1-3. Whether loss is
purchasable protection, mission-earned insurance, or simply permadeath-with-
memorial is a Robert call for the war layer, not the fireteam layer. This
spec's only law for it: **the attachment must be earned by play before
anything monetizes it.**

---

## §6 · SQUADS BY MODE

Read against `src/sim/modes.ts` (initMode `:8-83`, per-mode steps).

| mode | what ships today | the squad layer's fit |
|---|---|---|
| **tdm** (`modes.ts:32,260`) | 50 kills, hunt-blend objective (`bots.ts:753-759`) | Cleanest testbed: spawn wave + orders + strip with zero objective interference. FOCUS is the tdm power play. |
| **ctf** (`modes.ts:35,271`) | raid wings by odd/even id (`bots.ts:644`), escorts, guards, interceptors | Wings become **squad-keyed** (squad A north prong, squad B south) — same two-prong doctrine, now legible ("HAMMER takes north"). Escort-the-carrier is a natural squad HELP; a MOVE onto your own flag stand is the defense call. |
| **koth** (`modes.ts:46,338`) | bare-point objective, deliberate (`bots.ts:699-705`) | HOLD on the hill IS the mode; squads rotate — one holds, one flanks (leader's MOVE). No mechanical changes. |
| **conquest** (`modes.ts:52,358`) | nearest-contestable-point pool (`bots.ts:706-724`) | The nearest-point pick becomes **squad-sticky**: mates share the squad's point choice instead of each picking their own nearest — squads naturally spread A/B/C without new strategy code. The one mode where the squad layer touches `objectiveFor` outside orders. |
| **survival** (`modes.ts:58,390`) / **horde** (`modes.ts:65,528`) | hold near team centroid (`bots.ts:727-732`), wave/intensity ramps | The team here IS 1-2 squads; centroid becomes squad-scoped for free. Co-op zombie modes field only squad support vehicles already (`world.ts:359`). The casualty loop (§3.2) is the whole game here. |
| **safehouse** (`modes.ts:72,449`) | escort Voss, `SQUAD WIPED` loss announce (`modes.ts:459-462`) | Already squad-fiction. HOLD = the perimeter verb; HELP = the Voss-is-in-trouble scramble. The 5-minute countdown is a squad story with a clock. |
| **paintball** (`modes.ts:17,126`) | rounds, no respawn in-round, prey vs pack | Squads **inert by design**: no respawn = no spawn law, the yard is the onboarding room and the strip would be noise. The prey has no squad — that's the loneliness the mode sells. Squad UI hidden in paintball and range. |
| **range** (`modes.ts:13`) | endless proving grounds | No squads. |
| **skirmish grounds** (`skirmish.ts:4-10, 113-146, 287-288`) | ~62×62 mission maps with **two squad bases** and the LSW DEN — "the mode's rules land later; the GROUND carries the fiction now" | **This is the individual-scale military mission ground.** One squad per side, your fireteam vs theirs, den boss at the heart. The order system + strip + personas ARE the mission UI; nothing extra needed to make the first skirmish mode playable as a squad op. |
| **future: military missions, large scale** | fronts + vehicle economy + conquest-style tickets (WAR.md, war ledger `world.ts:574-579`) | Squads are the infantry unit inside the big machine: a squad crews a vehicle (crew pips already read seats), a squad holds a point. Orders scale sideways (MOVE a squad, not an army) — the ARMY layer (multiple squads) is the officer's future console, out of scope here. |
| **future: science missions / small ops** | WAR.md §5; squad size **1-8 LOCKED** for missions (MASTER-BACKLOG 10.5) | The 1-8 lock supersedes the 2-4 match rule INSIDE missions — mission squads are hand-rostered on the mission screen, match squads stay 2-4. The two rules never meet in the same mode. |

---

## §7 · THE BUILD PLAN — three slices

Standing gates for every slice: `tsc` clean · `vitest` green · build passes ·
sim changes deterministic (replay/snapshot tests) · no purple anywhere ·
every new HUD element lands its §7 row in UX-LANGUAGE per the §9 forcing
function. Test-harness law (learned the hard way, memory of record): any
long 1-human-team tdm test must add an inert witness human on the bot side
or pick a mode where `lswAllowed` is false — otherwise the bot officer drops
gods into your assertions (`world.ts:668-680`); carve flat arenas for
movement asserts so terrain doesn't couple to RNG.

### Slice 1 — the squad EXISTS: assignment + shared spawn + strip

Scope:
1. Assignment upgrade in `addSoldier`'s container (`world.ts:531-540`):
   class-spread deal + the medic slot + the no-squad-of-one remainder rule
   (§1.1-1.2). Deterministic from roster order alone.
2. Squad names/patch glyphs, deterministic from `(team, squadIndex, seed)`
   (§1.5), surfaced on scoreboard SHEET + strip header.
3. Spawn wave sync (§3.1): ≤4s wait, never extending the latest timer; wave
   resolves one shared spawn pick.
4. The squad strip (§4.1) + squadmate minimap tick + downed-mate chip states
   wired to shipped fields (`downed`, `downedUntil`, `reviveProgress`,
   `respawnAt` — all already on the wire).

Acceptance criteria:
- [ ] Sim test: 12v12 roster → every squad size ∈ {2,3,4}; every medic in a
      distinct squad while medics ≤ squads; same seed → identical rosters.
- [ ] Sim test: two mates dying within 4s respawn on the same tick, within
      6u of each other or both on ring fallback; a mate dying 10s later does
      NOT wait. Replay determinism suite stays green.
- [ ] Harness screenshot: strip renders 3 chips with correct states for
      alive/hurt/downed/dead/ascended (drive states via `window.__ww`);
      reads by shape with color removed (Law 3 check).
- [ ] Strip lives in the vitals block, ≤1 breathing chip, zero layout shift
      on the existing vitals plate at 19rem.
- [ ] Paintball + range show NO squad UI.

### Slice 2 — the squad LISTENS: orders + bot obedience

Scope:
1. `world.issueOrder` sim API + per-squad order slots + snapshot replication
   (§2.6); V-key input (tap smart-ping + hold rose) + minimap MOVE (§2.2).
2. `objectiveFor` order lane (MOVE/HOLD/HELP) at the rescue altitude +
   FOCUS target bias (§2.3); TTLs + early release (§2.5); LAST STAND
   re-scoped to the squad (§0 honesty fix).
3. Order MARKs world + minimap with GHOSTs (§4.2); text acks in the killfeed
   voice (chat-line style) now, VO slots wired the day §2F audio generates
   (the `'vo'` event path already exists, VO §0).
4. Bot-leader suggestion marks (§2.4).

Acceptance criteria:
- [ ] Sim test (carved arena, inert witness): MOVE to a point 40u away →
      all living mates inside 6u before TTL; brains resume mode objective
      the tick the order releases (assert `botObjective` flips).
- [ ] Sim test: HOLD → mates stay inside r=9 for 30s under no contact; a
      mate at 15% hp still retreats (the leash test — doctrine wins).
- [ ] Sim test: HELP on a downed mate → medic arrives and beams (revive
      event fires); non-medics ring at r≈5. FOCUS → ≥2 mates' `botTargetId`
      is the pin target while LOS holds; nobody fires without LOS.
- [ ] Determinism: an ordered match replays byte-identical from the command
      stream; orders appear in snapshots.
- [ ] Screenshot: MOVE diamond + pillar + verb TAG in world and on minimap;
      expiry ghost visible across a 3s capture (nothing blinks out).
- [ ] Rate limit: >1 order per 2s from one leader is dropped in the sim,
      not just the input layer.

### Slice 3 — the squad SPEAKS AND IS KNOWN: intel + chatter + identity

Scope:
1. Shared intel (§3.3): squad-tick minimap marks off squad perception,
   hold-then-fade ghosts; FOCUS pin as squad-scoped re-mark (tag-dart
   pattern) — coordinated with backlog 0.2's SIGHT split, whichever lands
   first defines the mark plumbing.
2. VO wiring: generate the §2F set (+ FOCUS rows) for v1 class voices via
   the existing manifest pipeline (VO §4), wire order/ack/casualty/idle
   slots through the 4-lane bus; the exchange pattern + per-squad banter
   budget (§5.2); the lines-per-minute governor asserts in a test.
3. Identity finish: pixel portraits in the chip glyph slot, squad-attributed
   killfeed lines + squad-wipe FEED/BANNER moments (§4.4), offline roster
   continuity in the barracks (§1.5).

Acceptance criteria:
- [ ] Sim/client test: a contact seen ONLY by a squadmate appears on your
      minimap with the squad tick and NEVER as a 3D body; mark ghosts and
      fades 2-3s after all squad LOS breaks.
- [ ] VO bench (headless, the voVoicesToCut pure-law pattern, VO §3.2):
      scripted 60s firefight stays ≤10 heard lines/min, P0 always plays,
      one ack per order, ≤1 banter exchange per 60s, banter silences on
      combat within one line.
- [ ] Transcribe-verify loop run on every generated squad slot (VO §4.5) —
      OFF takes regenerated to ~0.
- [ ] Squad wipe: banner + `squad_wipe` line + killfeed variant fire once,
      together, only when the last mate falls.
- [ ] Barracks screenshot: same three names, portraits, and patch across
      two consecutive offline matches (roster continuity).

---

## §8 · OPEN DECISIONS (for Robert)

1. **The comms key** — V proposed (T/H free alternates); gamepad rose on
   d-pad-left needs a conflict check against the slot-picker.
2. **Multiple-humans order etiquette** — last-order-wins proposed (§1.4);
   if squabbling shows up in playtest, senior-slot-only is the fallback.
3. **Mission squad hand-rostering (1-8)** — which screen owns it: barracks
   or the mission briefing? (Spec assumes briefing.)
4. **Charge-to-wipe** — parked per §5.3 until the war/meta layer opens.
5. **Portrait art direction** — 1-bit pixel portraits proposed for the chip
   glyph slot; needs a look-dev pass against the tactical-terminal language
   before batch generation.
