# LSWs — LIVING SUPER WEAPONS
### The 40-unit roster, triaged against the engine we actually ship

> **The frame (Robert's law):** these are NOT heroes and villains. There are
> two factions; each fields its own stable of **Living Super Weapons**.
> Roster A belongs to **the United Front**, roster B to **the Collective**.
> When you fight the Collective, *their* LSWs drop on you; *yours* fight
> beside you. Same war, two arsenals. Every line below keeps the standard:
> powers that create decisions, nothing that steals control from a human,
> every counter mapped to a system already in the game.
>
> This supersedes DD §21.6's "Ascendants" sketch — same idea, grown up.

---

## How to read the triage

| Tier | Meaning | Typical cost |
|---|---|---|
| **T1** | Rides systems that ship TODAY — ability = new combination of existing sim pieces | days |
| **T2** | Needs exactly ONE new sim mechanic (which then usually serves several LSWs) | ~a week each mechanic |
| **T3** | Real engine work — new movement/physics/AI layers | weeks; sequence carefully |

**The shipped toolbox these map onto:** fire/smoke fields · quarantine gas
· EMP (stalls machines, strips energy) · orbital strike + beacons · warp
gates + blink · knockback · tagged pings + psi scan · the §19 vision cone +
sound-and-movement smudges · K9 noses (ignore decoys, smell cloaks) ·
possession-of-machines (hacked turrets) · drones + SAM/MANPADS/AA economy ·
downed/revive · the recorder/replay · grenade bounce physics · per-surface
movement (ice!) · dynamic houses/rubble (drill eats walls) · spawn
protection · per-theme gravity · the announcer.

---

## UNITED FRONT — Roster A (20)

| # | LSW | Tier | Rides on / needs | Notes & cuts |
|---|---|---|---|---|
| 1 | **Vanguard** | **T1** | knockback, stun (new 1s stagger flag), barricade = placeable T_COVER gadget | Barricades block BOTH sides ✓ decision-rich. Cheapest LSW in the roster — build first. |
| 2 | **Firebrand** | **T1** | fire_field gadgets painted as trails; detonate = burst all owned fields | Rain douse: weather already tracks rain ✓. The "cash the board" button is one sim call. |
| 3 | **Volt Striker** | **T1/T2** | chain arc = 3-hop target search; vehicle overload = 2s fuse + bail check (vehicle exit exists) | The arc VISUAL is renderer work, cheap. |
| 4 | **Shadowstep** | **T1** | blink exists; decoy = mine-like gadget with soldier mesh | Dogs smell him ✓ free counter, already simmed. |
| 5 | **Titan** | **T3** | grab-throw VEHICLES = new carry physics + crew-inside state | The throw is the hard part. Ground pound = rubble (drill logic) + slow cone (T2). Build LAST of the big ones. |
| 6 | **Frostbite** ⭐ | **T2** | **THE ENCASE STATE** — new Soldier state: frozen {blocks damage+movement, struggle-vs-wait choice, teammate shatter} | The flagship mechanic. Build the encase state ONCE — Venatrix's traps, and any future stasis reuse it. Ice sheets = S_ICE painting, ALREADY a surface ✓ vehicles already slip. |
| 7 | **Phantom** | **T2/T3** | phase-through-walls (ghost collision mode, T3-lite); possession of BOTS/turrets/vehicles ≤3s (hacked-turret logic generalized, T2) | No footsteps ✓ trivially (skip step events); dogs smell ✓ free. Never possesses humans ✓ law kept. |
| 8 | **Sniperhawk** | **T1** | rail pierce exists; laser telegraph = renderer line; artillery mark = orbital beacon reskin | Rooftop perching needs the Phase-2 walkable roofs — v1: high-ground ledges instead. |
| 9 | **Gravity Warden** | **T2** | **FORCE FIELDS** — radial pull/push velocity fields; reverse-gravity = per-soldier gravity sign + stagger on land | Floaters can shoot ✓ (input untouched — law kept). Kill-to-cancel = channel state on the LSW. |
| 10 | **Inferno** | **T3** | **TRUE FLIGHT AI** (shared with Stormcaller/Gargoyle) | Burn aura = fire_field following him (T1). Flight plugs into SAM/MANPADS ✓ the counter-economy is already live. |
| 11 | **Steel Weaver** | **T2** | rip wall panel = drill-eats-wall + carried shield state; exosuit = armor buff + slow | "His defense costs the team's walls" — the map already rewrites ✓. |
| 12 | **Pulse** | **T1** | stagger + reveal = tagged pings (exist); deafen = client audio duck + vehicle stall (EMP variant) | Muting the enemy's ears in THIS game is genuinely vicious ✓ keep. |
| 13 | **Venom** | **T1** | quarantine gas fields ✓ exist; acid armor-melt = armor damage type; poison trail = leaking tagged marks | Pressures medics ✓ support economy exists. |
| 14 | **Blitz** | **T1/T2** | dash = blink-with-trail; kill-refund = kill event hook; afterimages = the RECORDER replaying his own path as damage | The recorder-as-weapon is the coolest cheap trick in the roster. |
| 15 | **Barrier** | **T1** | shield dome exists; reflect window = projectile bounce (grenades already bounce — reflection reuses the same axis math) | 2s telegraphed reflect ✓ bait-able. |
| 16 | **Riptide** | **T2** | wave = traveling knockback line (force fields, same mechanic as #9); douses fire = removes fire_fields ✓; whirlpool = pull field | The anti-fire counterpick — schedule with/after Firebrand & Pyroclasm. Water-map double: map theme check, trivial. |
| 17 | **Crusher** | **T2** | charge = dash + cover destruction along path (drill); thrown terrain chunk = new T_COVER where it lands (map write, exists) | Self-stun on wall bait ✓ decision. |
| 18 | **Mirage** | **T1** | decoys = bot-brained fakes that fire blanks; swap = position exchange | Dogs ignore decoys ✓, decoys silent ✓ — the counters are ALREADY the game's senses. |
| 19 | **Stormcaller** | **T3** | true flight (shared); tornado = roaming pull+launch field (force fields); lightning area = random orbital-lite strikes | Roofs block bolts ✓ houses have roofs now. |
| 20 | **Reactor** | **T2** | charge-up nova = channel state; ally overcharge = next-attack multiplier flag | Overcharged Frostbite line-freeze = the flag widens the encase cone. Support LSW — kill-the-battery gameplay. |

## THE COLLECTIVE — Roster B (20)

| # | LSW | Tier | Rides on / needs | Notes & cuts |
|---|---|---|---|---|
| 1 | **Oblivion** | **T2** | void bolts = arc projectiles (lob over cover ✓ ships); black hole = pull field + burst | Black-with-white-rim ✓ house law honored, no purple. |
| 2 | **Ragebeast** | **T1** | damage-taken → speed/power scalars; flesh chunks = HP-cost homing projectiles (homing exists — SAMs) | Burst-or-starve is pure numbers ✓ cheap and scary. |
| 3 | **Nightmare** | **T1** | fear pulse = vision-cone shrink (perception budget is a NUMBER) + false minimap pings (pinged set exists); blind = client vignette 2s | "Ears still work" ✓ the whole sound game carries it. |
| 4 | **Chronos** | **T2** | **TIME FIELDS** — zone where projectile+move speeds scale down (multipliers, not clock changes — sim stays 30Hz deterministic) | Echo rewind = position snapshot 3s ago, once (recorder data ✓ exists). Glowing echo point = renderer. |
| 5 | **Plaguebearer** | **T1** | toxic clouds = quarantine gas ✓; infected vehicle trail = gas fields dropped along its path | Abandon-or-drive ✓ decision, zero new tech. |
| 6 | **Leviathan** | **T3** | massive-scale body + terrain flatten + map-leap with shadow telegraph | The belly flop IS the pod-incoming telegraph pattern (exists) at boss scale. AA window mid-air ✓. Second-hardest build. |
| 7 | **Pyroclasm** | **T1** | lava pools = fire_fields with long TTL; eruption threshold = HP trigger | Riptide douses ✓ cross-roster counter as designed. |
| 8 | **Voidwalker** | **T1** | blink ✓; shadow clone bombs = timed decoy-mines at departure points | Same bones as Shadowstep — DIFFERENT decision (his trap detonates on a fuse, not touch; hold ground vs shoot-at-range). Distinct enough to keep. |
| 9 | **Tremor** | **T2** | quake stagger = aim-shake + slow; burrow = tunneler logic (EXISTS — the breacher vehicle burrows!) with soil ripple = mound particles ✓ | "Deaf underground" ✓ acoustics already muffle. Cheapest T2 — the tunneler donated its organs. |
| 10 | **Wraith** | **T1/T2** | possesses MACHINES only (hacked-turret logic + vehicle brain swap); drain-to-heal | EMP evicts ✓ counter ships. Destroy-your-own-tank dilemma ✓ requisition economy feels it. |
| 11 | **Crimson** | **T1** | drain beam = medibeam inverted; blood pools = decal-gadgets on deaths; raise ONE brute = zombie spawn (exists) | Fire denies pools ✓ fire_fields burn them. |
| 12 | **Eclipse** | **T2** | darkness dome = per-soldier vision budget crushed inside a zone; he sees all inside | Dogs + psi scanners break it ✓ counters ship. Ears-are-eyes inside = the §19.2 smudges DO the work. |
| 13 | **Magnetar** | **T1/T2** | bullet-curve halo = projectile deflection field (reuses bounce/steer math); jam = reload-lock pulse + vehicle stall (EMP variant) | Frags don't care ✓ — and ours BOUNCE now, poetic. Melee/arc/energy pass ✓ weapon-class check. |
| 14 | **Venatrix** | **T2** | snap-traps = mine + ENCASE state (Frostbite's mechanic, softer); harpoon reel = tether with HP (drag exists — downed dragging) | Little sister of the ice block, as written ✓ shared mechanic pays twice. |
| 15 | **Overload** | **T2/T3** | metal-circuit travel: graph of connected T_METAL/vehicles/turrets, emerge anywhere on it | Map-dependent identity (Refinery/Port/Blacksite are metal-rich ✓ authored fronts exist). Fight him on dirt ✓. The circuit graph is honest work but bounded. |
| 16 | **Gargoyle** | **T3** | true flight (shared #3 of 3); dive slam with shriek telegraph; perch = stationary turret mode (turret logic ✓) | Collapse the perch — houses/roofs are destructible via drill logic. |
| 17 | **Reaper** | **T1/T2** | chain pull = harpoon (Venatrix's tether, reversed); tanks eat the pull ✓ (grab-first-body check); mark = double-damage flag SHOWN on victim HUD | You-know-you're-hunted ✓ decision. |
| 18 | **Specter** | **T1** | mirror images = Mirage's decoy tech; command detonate; only-the-real-casts-a-shadow = renderer skip on clones | Dogs know ✓. Shares tech with Mirage — DIFFERENT tell (shadow vs sound). Keep both, they teach different senses. |
| 19 | **Cataclysm** | **T2** | siege boss: big slams + random map-wide eruptions that worsen (orbital-lite scheduler); announcer counts quakes ✓ | The DPS-check boss. Pairs with the officer-drop system for siege events. |
| 20 | **Dominator** ⭐ | **T2** | **PSYCHIC LINKS** — visible threads chain ≤4 soldiers; damage to one deals 60% to all linked; break by scattering beyond thread range | The crown piece. Linking the ENEMY squad weaponizes their own spacing — and our new bot SPACING fix is, accidentally, the bots learning to fight him. Positioning IS the fight ✓. |

---

## The five shared mechanics to build (they unlock 17 LSWs between them)

1. **ENCASE** (Frostbite ⭐, Venatrix, + future stasis) — a Soldier state:
   immobile, untargetable-or-shielded, struggle/wait choice, teammate
   shatter. One state machine, huge payoff. **Build first.**
2. **FORCE FIELDS** (Gravity Warden, Riptide, Oblivion, Stormcaller's
   tornado, Magnetar's halo) — radial/directional velocity fields applied in
   the soldier/projectile step. One system, five LSWs.
3. **TIME FIELDS** (Chronos) — zone speed multipliers for movement +
   projectiles. Deterministic (multipliers, never clock manipulation).
4. **MACHINE POSSESSION** (Phantom, Wraith) — generalize the hacked-turret
   flip to vehicles/bots with a timer + EMP eviction. Never humans — law.
5. **TRUE FLIGHT AI** (Inferno, Stormcaller, Gargoyle — exactly the three
   fliers) — a 3D-capable brain that respects the AA economy. The most
   engine-ish work; schedule after the roster has legs on the ground.

## Special AI — the architecture (per Robert: "special AI for each one")

The sim already runs per-kind brains (`stepBot` / `stepZombie` / `stepDog` /
`stepScientist`). LSWs slot in as **new SoldierKinds with one brain file
each** (`src/sim/lsw/<name>.ts`), sharing a small `LswBrain` toolkit
(target selection, ability cadence, retreat thresholds, telegraph timers).
Laws: deterministic, DOM-free, every ability emits telegraphed SimEvents
(the counter-play IS the telegraph), and every LSW dies to ordinary guns —
an unanswerable boss is a griefer we wrote ourselves (§21.6's rule stands).

## Deployment — the officer calls it (Robert's idea, and it's the right one)

- LSWs are **War Materiel assets (§17)**: each faction's campaign stock
  holds a limited stable per front.
- **The officer (§7.1/§11.5) decides WHEN** — mid-match, from the officer
  surface: "deploy Frostbite." That's a human decision spending a shared
  resource: exactly what officers exist for.
- **The drop is telegraphed and DELAYED** (Robert: "a little delayed
  sometime — that would be dope"): the announcer calls it, a pod-incoming
  shadow (system exists) marks the LZ, 20–40s of dread before arrival.
  Both sides get the information; the fight bends around the countdown.
- Some match recipes **start** with an LSW on the field (siege/boss modes:
  Cataclysm); most arrive as officer calls. AI officers (bot matches) use
  a materiel budget + pressure heuristic.
- One per side on the field at a time; dropping the enemy's LSW is a
  campaign event worth Materiel + a Journal line (the §21.6 economy).

## Cuts and merges (per "get rid of whatever doesn't work")

- **No cuts required by engine law** — the roster as written respects every
  hard rule (no human control theft, no purple, counters all exist).
- **Watchlist for feel, not feasibility:** Shadowstep/Voidwalker and
  Mirage/Specter are close cousins — shipped v1 keeps all four (their
  DECISIONS differ), but if the stable needs trimming these merge first.
- **Sniperhawk's rooftop perch** and **walkable roofs** are the same
  engine question — his v1 uses high ledges; revisit at Roofs Phase 2.

## Build order (recommendation)

1. **The officer-drop pipeline** with ONE T1 LSW per faction as proof:
   **Firebrand (UF)** vs **Plaguebearer (C)** — both pure fire/gas field
   plays on shipped systems, instant faction flavor.
2. **ENCASE** + **Frostbite ⭐** (UF flagship) vs **Ragebeast (C)** (pure
   numbers, terrifying) — the first "oh hell" pair.
3. **FORCE FIELDS** → Gravity Warden + Oblivion (one mechanic, two drops).
4. **Dominator ⭐** (the Collective finale mechanic — psychic links).
5. Machine possession pair (Phantom/Wraith), then Tremor (tunneler organs).
6. True flight trio last, once the AA meta has data.

## What Robert needs to make (when we get there — not yet)

Models via the shipped pipeline (`tools/add-soldier.mjs` handles humanoid
LSWs at any `--height`; Titan/Leviathan-scale bodies will need a pipeline
`--parts` tweak for non-human proportions — noted, not built). Each LSW
also wants: one ability VFX pass, one telegraph sound, one announcer line.
The sound pack pattern (standalone gen scripts) is ready for all three.
