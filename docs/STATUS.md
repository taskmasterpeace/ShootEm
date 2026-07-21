# STATUS — everything asked for, done vs not
### The honest ledger. Robert: "I need to find out what's not been completed. That's the most important thing." Last swept 2026-07-20 against the code + the two ground-truth audits this session.

**Legend:** ✅ SHIPPED · 🔨 PARTIAL (substrate exists, the ask isn't finished) · ❌ NOT DONE · 📋 DESIGNED (a spec is written, no code yet) · 🎯 DECISION (a call only Robert makes)

**Where it's tracked:** `BACKLOG` = a wave in `docs/MASTER-BACKLOG.md` · `#N` = GitHub issue · `PLAN` = a doc under `docs/superpowers/plans/`.

---

## THE SHORT LIST — what you asked for that is NOT done

If you read one thing, read this. Everything below has a full row further down.

**Combat feel:** the aim ring · accuracy-by-movement · ballistic falloff · tap-jump/hold-duck · tank hull wobble.
**The death show:** death-cam director (varies by death) · gore/gibs · corpses lingering 20–30s · a kill-cam reward.
**Sight (you just approved the fix):** 3D-shows-you / minimap-shows-team · contacts hold-then-fade instead of blinking · darkness outside your cone · house/maze line-of-sight · the second-storey fishbowl bug.
**Melee:** STRIKE / GUARD / GRAPPLE + Impact Charge + the Control Struggle (terminology now LAW per the outbreak spec; the swing engine exists, wired only to zombie claws).
**The outbreak (new spec, §17):** infection/viral load · corpse lifecycle & reanimation · outbreak pressure/levels · zombies as a third faction mid-war · emergent variants · ammo TYPES (Ball/AP/Incendiary…) · flashlight interiors · Bite Struggle — all designed, none built.
**The war:** the 3×3 board · killing the time-skip · the clone economy · pass escalation · **science missions** (now fully designed) · class-change requests · the two faction leaders · bots looking like robots.
**The press:** AI-generated newspaper · the base TV newscast · the unnamed-soldier fiction.
**Air & armor:** aircraft can't crash · no map wraparound · **planes don't read as high enough** (no shadow, HIGH sits below rooftops) · drive-by shooting · cars that handle like cars · seat-yield · rearm pads.
**Weapons:** fire modes (single/auto/burst/**double-barrel**/pump) · per-family secondary fire · brand signature mechanics · and the Codex columns for all of it.
**Beams:** continuous/held beams · **beam-vs-beam clash** · beam birth effects · the seven beam types.
**Movement:** the charged leap · the jetpack regen timeout.
**Loot:** dropped weapons you can pick up off the dead.
**Armed gods:** bow · spear · recall axe · summoners.
**Multiplayer:** the whole server/netcode stack (the sim is built for it; nothing is wired).
**Ammo:** the diagnostics pass, then the 25% cut.
**Optimization:** 42 findings, [issues #1–#42](https://github.com/taskmasterpeace/ShootEm/issues) — none started.

---

## 1 · COMBAT FEEL

| Ask | Status | Evidence / where |
|---|---|---|
| Aim ring orbiting the character, showing facing + accuracy bloom | ❌ | no aim UI exists (`hud.ts`/`renderer.ts` swept). BACKLOG W1.2 |
| Accuracy varies by movement (crouch/still/walk/sprint/airborne/vehicle) | ❌ | spread is a flat weapon constant (`world.ts:2629`). BACKLOG W1.1 |
| Ballistic falloff (bullets tire; lasers exempt) | ❌ | flat damage to the ttl cutoff (`world.ts:4013`). BACKLOG W1.4 |
| Tap space = jump, hold = duck | ❌ | full crouch exists but on **C** (`input.ts:175`). BACKLOG W1.3 |
| Ragdoll threshold applied at every knockback site | 🔨 | check is only inside `explode()` — Titan's 40u slam never ragdolls. BACKLOG W1.5 |
| Tank hull wobble/settle on cannon fire | 🔨 | barrel recoil yes (`renderer.ts:1862`), hull shove no. BACKLOG W1.6 |
| Grass concealment (hide in tall grass, deeper when ducked) | ✅ | `perception.ts:95-101`, bots respect it |
| Duck behind cover / in grass | ✅ | crouch stance on C, sinks below grass line |

## 2 · THE DEATH SHOW

| Ask | Status | Evidence / where |
|---|---|---|
| Death-cam **director** — different shot per death (bullet path / autopsy / wide / spawn-cut) | 🔨 | one fixed presentation shipped (hit-stop + duel framing, c95c707); no branching. BACKLOG W2.1 |
| Deaths differ by weapon in the **animation** (fire collapse, laser drop-straight, melee spin) | 🔨 | knockback already varies; the collapse pose doesn't. BACKLOG W2.2 |
| Gore / gibs on overkill + explosives | ❌ | no gib code anywhere. BACKLOG W2.3 |
| Corpses linger 20–30s (a fought-on battlefield) | ❌ | ~4s today (`RESPAWN_DELAY`). BACKLOG W2.4 |
| A **kill** cam — reward a great kill, not just the death | ❌ | replay is victim-only. BACKLOG W2.5 |
| Blood past armor, sparks off plate | ✅ | `bare` flag on hit events, `renderer.ts:3536` |

## 3 · SIGHT — the visibility rewrite (you approved this 2026-07-20)

Full spec: **`PLAN 2026-07-20-sight-and-steel.md` § A**. Measured: the game draws **8.70 enemies when you can personally see 4.84** — because vision is keyed by team, not by your eyes.

| Ask | Status | Evidence / where |
|---|---|---|
| 3D view shows what **you** see; minimap shows what your **team** sees | 🎯→❌ | you love it; not built. BACKLOG W0.2 / [#46](https://github.com/taskmasterpeace/ShootEm/issues/46) |
| Contacts **hold then fade** — never blink/pop out | ❌ | today the ghost is a translucent jogging body; the new mark holds, then dissolves (your 2026-07-20 refinement). W0.2 |
| The world outside your cone goes **dark** | ❌ | no darkness machinery; the cheap path is shader injection (zero draws). W0.2 |
| In a house/maze, see what you can see and no more | ❌ | ground-floor LOS is good; upstairs + roof-peek are not. W0.3 |
| **BUG:** any second storey is a fishbowl — seen through walls by the whole enemy team | ❌ | the skyline rule (`perception.ts:94`) skips cone+LOS for `y>3`. [#43](https://github.com/taskmasterpeace/ShootEm/issues/43) |
| **BUG:** enemy corpses bypass the fog entirely | ❌ | `renderer.ts:1434` vs `:1472`. [#44](https://github.com/taskmasterpeace/ShootEm/issues/44) |
| **BUG:** enemy vehicles are never fog-culled | ❌ | `renderer.ts:1662`. [#45](https://github.com/taskmasterpeace/ShootEm/issues/45) |

## 4 · MELEE — STRIKE, GUARD, GRAPPLE

Implementation plan: **`PLAN 2026-07-20-sight-and-steel.md` § B** · **terminology and rules now LAW per `docs/OUTBREAK-SPEC.md` §12-16** (same triangle, locked words: GUARD beats STRIKE, STRIKE beats GRAPPLE, GRAPPLE beats GUARD; charged melee = **Impact Charge**; rear grab = **Rear Control** resolved by the **Control Struggle** best-of-three; vs zombies = **Bite Struggle**). The surprise stands: the swing engine (windup, 90° arc, locked facing, stagger, lunge) **already ships** at `world.ts:2569-2619` — wired only to zombie claws.

| Ask | Status | Evidence / where |
|---|---|---|
| A real melee weapon + a melee key | ❌ | no melee weapon a class can carry; F is the thrown axe. W0.3 / [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| STRIKE (interrupts grabs, deals damage) | ❌ | swing engine exists; needs a weapon + key. [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| GUARD (frontal arc, beats strikes) | ❌ | no defensive state anywhere. [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| GRAPPLE → Rear Control → Control Struggle (zone vs needle, best-of-three) | ❌📋 | fully specced (OUTBREAK-SPEC §14-15); nearest substrate is the ice-encasement struggle meter (`world.ts:1310`). [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |
| Impact Charge (wind-up → charged → maximum → overcharged, meter NEAR the action) | ❌📋 | specced §13; the sim already has a hold-charge-release mechanic on LSW arms (`charge:{t,mul}`, Eclipse) to generalize |
| See it — the swing animation reads | 🔨 | slash ring VFX + the "slam"/"thrust" curves exist but are gated to gods/zeds. [#47](https://github.com/taskmasterpeace/ShootEm/issues/47) |

## 5 · HUD

| Ask | Status | Evidence / where |
|---|---|---|
| Health / armor / integrity meters | ✅ | `hud.ts:122-163` |
| Energy meter + weapon-recharge (soldier) | ✅ | reload bar + stamina/energy arc |
| **Vehicle** weapon recharge (see when the gun's ready) | ✅ | **shipped this session** (WPN cycle bar, `hud.ts`) |
| Crew dots per seat + walk-up occupancy | ✅ | `hud.ts:209-226` |
| Right-click command wheel (order bots) | ❌ | RMB is alt-fire; no order path. BACKLOG (E1) |
| Rank insignia visible in match | ❌ | rank shows only in menus. BACKLOG W3.9 |
| Altitude band readout when flying | ❌ | HUD is band-blind. §8 below |

## 6 · AIR & ARMOR

| Ask | Status | Evidence / where |
|---|---|---|
| Q/E discrete altitude bands | ✅ | `world.ts:1970-1995` |
| Afterburner · belly MG · missiles faster than planes | ✅ | J1, `world.ts:3502` |
| Helicopters (band-2 flyer) | ✅ | the Kestrel |
| Flares vs heat-seekers | ✅ | `world.ts:2820`, bots pop them too |
| Hoverboard drift / slip | ✅ | `world.ts:3526` |
| Death frees the vehicle seat | ✅ | `world.ts:4409` |
| **Planes read as HIGH enough** | ❌ | **new diagnosis:** aircraft cast NO shadow, no parallax scale, no camera lift, and the HIGH band (Y=5.4) sits *below* two-storey rooftops (8.15). §8. BACKLOG (new air item) |
| Aircraft can crash into terrain/buildings | ❌ | `flies` skips collision entirely (`world.ts:3553`). BACKLOG W5.1 |
| Map wraparound for aircraft | ❌ | hard border clamp. BACKLOG W5.2 |
| Drive-by shooting (personal weapon from a seat) | ❌ | seated fire never reaches `fireWeapon`. BACKLOG W5.4 |
| Cars handle like cars / handbrake | ❌ | slip dial exists but wheeled hulls don't use it. BACKLOG W5.5 |
| Seat-yield (bot gives up its seat to a human) | ❌ | no yield mechanic. BACKLOG W5.6 |
| Diegetic per-hatch entry | ❌ | one generic E prompt. BACKLOG W5.6 |
| **Rearm pads** (a place to reload, turrets ringed around it) | 📋 | designed this session; base becomes clone-bay + hangars + rearm pad + turret ring. BACKLOG (new) |

## 7 · THE WAR

Full law: **`docs/WAR.md`**. Almost all of it is 📋 DESIGN — the substrate (ten-front living campaign, materiel purse, LSW rosters) ships, but the solo-war shape does not.

| Ask | Status | Evidence / where |
|---|---|---|
| Enlist once; 3×3 board (three fronts × three passes) | ❌ | ships as a flat ten-front campaign. BACKLOG W3.2 |
| Kill the time-skip (war only moves while you play) | ❌ | `simulateTimeSkip` still called every boot. BACKLOG W3.1 |
| Clones are the currency (per-front reserves, front lost at zero) | ❌ | clones are scenery only. BACKLOG W3.3 |
| Pass escalation (P1 no gods → P2 enemy gods → P3 both) | ❌ | no pass concept in code. BACKLOG W3.4 |
| **Science missions** | ❌📋 | **now fully designed** — `docs/SCIENCE-MISSIONS.md` (10 verbs × 10 sites × 50 effects). BACKLOG W3.5 |
| Class change by request (leader AI rules on it) | ❌ | free lobby pick. BACKLOG W3.6 |
| Two authored faction leaders (voiced) | ❌ | no leader entity. BACKLOG W3.7 |
| Bots look like robots (chrome, subordinate) | ❌ | bots render identical to humans. BACKLOG W3.8 |
| Iron Eaters finished (weaver/ravager signatures, named, in Codex) | 🔨 | roster exists, half the behaviors + naming missing. Codex THREATS now lists them ✅. BACKLOG W3.10 |
| Underfunded-victory + morale banking | ✅ | B1, `world.ts:458` |

## 8 · THE PRESS

| Ask | Status | Evidence / where |
|---|---|---|
| The Front Courier newspaper | ✅ | HTML edition + archive (`newspaper.ts`) |
| **AI-generated** newspaper image per war-front change | ❌ | no image hook; HTML stays the fallback. BACKLOG W4.1 · 🎯 which image API |
| Base TV newscast (~25s, anchor VO + ticker, before deploy) | ❌ | no TV substrate. BACKLOG W4.2 |
| Corrections box (the paper corrects itself) | ❌ | BACKLOG W4.3 |
| **Unnamed-soldier fiction** (a serial number, not "recruiter"; TTS reads digits; naming yourself is a beat) | 📋 | designed this session. BACKLOG (new) |

## 9 · SOLDIER & WEAPON VISUALS

| Ask | Status | Evidence / where |
|---|---|---|
| Show the actual weapon on screen; swap on switch | ✅ | **shipped this session** (the armory, `models/weapons.ts`) |
| Papercraft body adopted into the game | ❌ | still only in the style lab. BACKLOG W6 |
| Named elbow joints (better strikes/holds) | ❌ | forearm groups exist but unnamed. BACKLOG W6.2 |
| Vehicle guns read as their armament | ✅ | `models/vehicles.ts` |

## 10 · WEAPONS — the variation gap

You have 200 weapons with 200 stat lines and **one firing behavior**. That's the gap.

| Ask | Status | Evidence / where |
|---|---|---|
| Fire modes: single / auto / burst-2/3 / **double-barrel** / charge / pump | ❌📋 | designed; no fire-mode property today. BACKLOG (new) |
| Double-barrel · auto-shotgun · two-round-burst rifle | ❌ | subsumed by fire modes. BACKLOG (new) |
| Per-family **secondary fire** | ❌ | only 4 weapons have alt-fire (`world.ts:2500`). BACKLOG (new) |
| Brand **signature mechanics** (not just stat curves) | ❌📋 | designed: each brand carries a firing behavior. BACKLOG (new) |
| Codex shows fire-mode + secondary columns | ❌ | needs the data to exist first. BACKLOG (new) |

## 11 · BEAMS

Ground-truthed this session. **Beams draw** (as fast box tracers); everything interactive is unbuilt.

| Ask | Status | Evidence / where |
|---|---|---|
| Beams render | ✅ | `makeProjectile` case 'beam', `renderer.ts:3310` — a flying box, not a stream |
| **Continuous / held** beam (LSW only — soldiers never carry one) | ❌📋 | only in the beam LAB (`/beams.html`); no held stream in-game. BACKLOG (new) |
| **Beam-vs-beam clash** (DBZ struggle, overpower, knock-off-aim) | ❌📋 | no projectile-projectile collision at all. BACKLOG (new) |
| Beam **birth** effects (charge tell, muzzle bloom) | ❌ | beams are *excluded* from the muzzle spark (`renderer.ts:3453`). BACKLOG (new) |
| Beam **landing** effects, material-aware | ✅ | the hit handler already branches on tile/surface (`renderer.ts:3532`) |
| Seven beam types (Lance/Torrent/Tether/Sweep/Pulse/Siphon/Prism) | ❌📋 | designed this session. BACKLOG (new) |
| LSW production/landing effects (each god's beam looks distinct) | 🔨 | per-god tints exist; birth/impact/type flavor doesn't. BACKLOG (new) |

## 12 · MOVEMENT

| Ask | Status | Evidence / where |
|---|---|---|
| Charged **leap** (hold-and-release with a direction; land loud, no air control) | ❌📋 | designed: space = tap-jump / hold-duck / hold+dir-leap. BACKLOG (new) |
| Jetpack **commitment cost** (no regen airborne + a timeout after landing) | ❌📋 | designed; jetpack is currently a hover platform. BACKLOG (new) |
| Dive-roll / mantle / slide-off-sprint | ❌📋 | later; slide rides the hoverboard slip system. BACKLOG (new) |

## 13 · LOOT & BODIES

| Ask | Status | Evidence / where |
|---|---|---|
| Weapon shows on the body when you die; others pick it up | ❌📋 | pickup system exists (medkits/ammo); dropped-weapon entity doesn't. BACKLOG (new) |
| Bodies last longer (so loot reads as loot) | ❌ | same as W2.4 (4s → 20–30s) |
| Lower ammo (**25%** reserve cut) so fights end in pistols | ❌📋 | **locked at 25%**, but MEASURE FIRST. BACKLOG (new) |
| Ammo **diagnostics** (rounds fired, reloads, dry-clicks, secondary time) | ❌📋 | teach the blackbox to log it; run before the cut. BACKLOG (new, ordered before the cut) |

## 14 · ARMED GODS

| Ask | Status | Evidence / where |
|---|---|---|
| A god with a **bow** (charge-draw, arcing, pins bodies) | ❌📋 | designed. BACKLOG (new) |
| A god with a **spear** (thrown + tethered, recalled) | ❌📋 | designed. BACKLOG (new) |
| A god with a **recall axe** (boomerangs through the return path) | ❌📋 | the recall-weapon idea. BACKLOG (new) |
| A **summoner** (human squad) and a summoner (the horde) | ❌📋 | reuses the clone + Iron-Eater rosters. BACKLOG (new) |

## 15 · MULTIPLAYER

The sim was **built** for this (deterministic, seeded, headless, already serializes snapshots for the kill cam). The plan is in `docs/OPTIMIZATION-AUDIT.md` § THE NETCODE PLAN.

| Ask | Status | Evidence / where |
|---|---|---|
| A server process (Node, same sim, 20 Hz) | ❌ | doesn't exist. OPT-AUDIT |
| Transport + input protocol (WebSockets, input-relay) | ❌ | OPT-AUDIT N-series |
| Determinism airtight (no drift) | 🔨 | deterministic by design; verification is a netcode-plan prerequisite. #20 |
| Client-reaches-into-sim cleanup | 🔨 | audited; several seams. OPT-AUDIT |
| Sessions / lobby / reconnect / late-join | ❌ | OPT-AUDIT |
| **Staged path:** co-op science missions first → full PvP second | 📋 | recommended in the netcode plan |

## 16 · WORLD / MATERIALS / ONBOARDING

| Ask | Status | Evidence / where |
|---|---|---|
| Trees | ✅ | procedural + GLB, forest regions |
| Materials: SURF fold (one movement source) | 🔨 | table exists; movement still on legacy tables. BACKLOG W7.1 |
| Ice is slick (momentum carry) | 🔨 | `slick` flag is dead data. BACKLOG W7.2 |
| Fire / burnable wood | ❌ | `flammable` declared, never consumed. BACKLOG W7.3 |
| Per-material impact VFX | 🔨 | only drill sparks read it. BACKLOG W7.4 |
| Non-lethal training rounds | ✅ | `training` flag, the yard survives |
| Boot-camp prey bug (you're hunter both rounds) | ❌ | dummies counted as people. BACKLOG F.1 |
| 3+ storey buildings | ❌ | tops out at 2 (typed `1|2`). DEFERRED by you |
| Water that freezes into a crossable surface | 🔨 | ice is a surface; water never freezes |

## 17 · THE OUTBREAK — zombies as a systemic third faction (spec landed 2026-07-20)

Full spec: **`docs/OUTBREAK-SPEC.md`** (infection model, outbreak pressure/levels, corpse lifecycle, emergent variants, ammo types, melee UI, networking authority, 4-phase roadmap, acceptance criteria). Core promise: *the horde grows from casualties and contamination, not invisible spawn points.* Everything below is 📋 designed / ❌ unbuilt except where noted.

| System | Status | Substrate that already ships |
|---|---|---|
| Base Shambler + rare Sprinter as the production roster | 🔨 | both exist (`ZOMBIE_STATS`: zombie 60hp, sprinter 40hp/15.5u/s); brute/bomber/stalker/spitter also ship but the spec scopes them OUT of the base implementation |
| Shamblers at materially greater density (acceptance §21.17) | 🔨 | **the zombie bench + spatial index (#38) just proved ~790 shamblers inside the frame budget** — the perf groundwork is real; the spec's AI tiers/flow fields would push further |
| Infection model (viralLoad, incubation, conversion; damage ≠ infection) | ❌ | nothing — no infection field exists in the sim |
| Corpse lifecycle (fresh → incubating → critical → reanimated; lootable) | ❌ | corpses vanish in ~4s (`RESPAWN_DELAY`); pairs with backlog W2.4 (linger) + 10.4 (dropped weapons = the lootable half) |
| Corpse burning / neutralization meter | ❌ | needs the fire system (W7.3 — `flammable` is declared, never consumed); incendiary→material interaction is exactly W7's fold |
| Outbreak Pressure + Levels 0-4 + sector loss | ❌ | no pressure value; zombies appear only in survival/horde/safehouse via authored spawns |
| Third-faction outbreak DURING a human-vs-human front | ❌ | zombies are hardcoded team 1 — a true third faction needs the team model widened (the spec's biggest structural ask) |
| Clone infection tied to the reinforcement economy | ❌ | rides the clone economy (W3.3), itself unbuilt |
| Emergent variants from casualties (heavy/lean/armored from the body that died) | ❌ | variants roll from spawn tables (`rollZedKind`), not from corpses |
| Environmental mutation fields (readable causes) | ❌ | none; Iron-Eater foundry site exists as a SCIENCE-MISSIONS location to reuse |
| Ammunition TYPES (Ball / AP / Incendiary launch; TRC/SUB/EXP/BNR later) | ❌📋 | one ammo per weapon today; **a different axis than Wave 10.1's fire modes** (how it fires vs what it fires) — build as sisters |
| Weapon HUD: ammo type, penetration, noise, fire hazard | ❌ | today's HUD shows clip/reserve only |
| Interior flashlight (vision cone as a tool; wakes dormant sprinters) | ❌📋 | composes directly with SIGHT (W0.2): the darkness cone A2 builds is the flashlight's world |
| Networking authority for infection/grapples | 📋 | matches the netcode plan's server-authoritative model (OPT-AUDIT); grapple latency handling is new |
| Analytics for tuning (§19) | 🔨 | the blackbox ships and is the rail; ammo diagnostics already queued (10.5) |

**Sequencing note:** the spec's Phase 1 (Shambler+Sprinter, infection component, corpse timers, burning, Ball/AP/INC, the melee triangle) overlaps Wave 0.3 (#47), W2.4, W7.3, and 10.1/10.4/10.5 — build those as ONE campaign, not five.

---

## LOCKED DECISIONS (this session)

- **Sight:** 3D view = your eyes, minimap = team intel. Contacts **hold, then fade** — never blink out.
- **Science mission squad size:** scales **1 → 8** clones with difficulty (1 = knife-edge solo, 8 = forgiving assault).
- **Ammo cut:** **25%** on reserves — but the **diagnostics pass runs first** and validates it before it lands.
- **Beams:** LSW only. Soldiers never carry a continuous beam.
- **Repo:** push only when you ask (last sync 2026-07-20); commits stay local between asks.

**From the outbreak spec (§22.1 — these are LAW):**
- Clones can become infected. Outbreaks are **condition-driven**, never fixed-time; the infected can emerge as a third faction during active fronts.
- Shamblers are the horde's mass; **sprinters stay rare** (0.5–2%). Most variants emerge from casualties + environment, not rosters.
- **Fire is the primary corpse-denial mechanic.** Ball / AP / Incendiary are the launch ammunition trio.
- Melee is **STRIKE / GUARD / GRAPPLE**; rear grabs enter the **Control Struggle** (attacker's Control Zone vs defender's Break Needle, best-of-three); the horde's version is the **Bite Struggle**.

## STILL ON THE DECISION DESK (only you can answer)

- Which image API funds the AI newspaper (W4.1).
- Which three of the ten fronts survive into the 3×3 board (W3.2).
- Can you field a **captured** enemy god, or is that too big a swing? (science-mission reward)
- Science-mission stake: **permanent loss** on a failed run, or retry next window? (fear vs fairness)
- Leader names/personalities sign-off before they're voiced (W3.7).

**From the outbreak spec (§22.2):**
- Does a perfect Break Hit give escape only, or an immediate **reversal** (defender takes control)?
- Can players **haul infected corpses into enemy territory** — and what anti-grief/war-crime rules apply?
- Who sees the exact incubation timer: everyone, or medics/recon only?
- Does incendiary ignite corpses reliably, or do armor/wetness make it genuinely uncertain?
- Do contaminated sectors **persist across sessions**, and for how long?
- Which rear-grab outcomes are allowed in PvP at launch (drag / disarm / human shield / choke / takedown / throw)?
- **The title on the spec is "DIVIDED STATES OF AMERICA"** — the repo, docs and menus all say **War World**. Rename, subtitle, or working-title? Nothing gets renamed until you call it.

---

*This file is the index. `docs/MASTER-BACKLOG.md` is the ordered work queue (Wave 0 first). `docs/OPTIMIZATION-AUDIT.md` + [issues #1–#47](https://github.com/taskmasterpeace/ShootEm/issues) are the performance/bug board. `docs/SCIENCE-MISSIONS.md` is the mission design. The DOCUMENTS INDEX below catalogs every design doc.*

---

## THE DOCUMENTS INDEX — every doc, what it is, its state

**REFERENCE** = a living spec that stays true (not "done/undone") · **SHIPPED** = describes built code · **DESIGN/PLAN** = a spec for something not yet built · **STALE** = superseded.

| Document | What it is | State | Note |
|---|---|---|---|
| `DESIGN-DIRECTIVE.md` | The wide-angle war directive (Rev 6) — factions, "enlist, don't pick" | REFERENCE | Direction, not spec; faction names/colors locked & shipped |
| `WAR.md` | The solo-war bible — 3×3 board, clones-as-currency, science missions, the press | REFERENCE | Locked source-of-truth for war shape; mostly 📋 with a thin ✅ substrate |
| `LORE.md` | Setting — year 2222, factions, gods-vs-LSW naming, clone fiction | REFERENCE | Faction names ✅; god-naming split + clone economy 📋 |
| `ASCENDANTS.md` | The LSW roster law — threat tiers, per-unit status | REFERENCE | Roster/threat law; specific numbers superseded by ABILITIES.md |
| `ABILITIES.md` | Complete ability reference, read from source, updated 2026-07-20 | REFERENCE | The **trusted** numbers doc; matches code today |
| `ARSENAL.md` | The armory catalog — 16 families × 4 makers × 3 marks, vehicles, equipment | REFERENCE | Live in the sim & menu today |
| `BALANCE-PLAN.md` | The standing balance loop + tooling | REFERENCE | Living process doc; tools exist |
| `MANUAL.md` | Field manual — deployment, controls, HUD, modes, classes | REFERENCE | Player-facing how-to; core controls accurate |
| `HARNESS.md` | Dev-tool manual for the model/physics/combat inspector | REFERENCE | Describes the shipped `harness.html` |
| `MAP-STRATEGY.md` | Map-building doctrine — map families, tile alphabet, generator | REFERENCE | Tile vocab shipped; height-aware jump tiers still to build |
| `UI-AND-RESOURCES.md` | Audit of HP/armor/energy + the UI inventory | REFERENCE | Concludes the three resources exist & are correct |
| `SOUND-MANIFEST.md` | Every loadable sound file + how to swap one | REFERENCE | Living asset manifest |
| `ASSETS.md` | Third-party (Quaternius) asset audit | REFERENCE | ⚠ license UNRESOLVED — flagged blocker before shipping |
| `MASTER-BACKLOG.md` | The loop document — everything owed, Waves 0–9 | REFERENCE | Living queue; "ALREADY DONE" shipped, all wave items unchecked |
| `STATUS.md` | **This file** — everything asked for, done vs not | REFERENCE | The ledger you're reading |
| `SCIENCE-MISSIONS.md` | Full science-mission design — 10 verbs × 10 sites × 50 effects | DESIGN | Written this session; unbuilt (BACKLOG W3.5) |
| `OUTBREAK-SPEC.md` | The zombie outbreak / ammo types / melee combat & UI spec (Robert, 2026-07-20) | DESIGN | §22.1 decisions are LAW; STRIKE/GUARD/GRAPPLE naming supersedes older drafts; status in §17 |
| `BLAST-AUDIT.md` | The two-zone explosion model + the C-9 concussion grenade | SHIPPED | Rings read the sim's own numbers; C-9 shipped |
| `VO-DIRECTORS-NOTES.md` | Whisper-verified transcript of 160 VO takes | SHIPPED | All 160 clean, 0 off-script |
| `plans/2026-07-18-lsw-embodiment.md` | Per-school LSW rig/prop/attackPose + movement dress | SHIPPED | Verified in code (EMBODY record, silhouette pass done) |
| `plans/2026-07-18-projectile-effects.md` | Composable projectile effect-flags on 40 LSW weapons | SHIPPED | pierce/beam flags in code; only `ignite` waits on the fire system |
| `MOBILE-FEASIBILITY.md` | Feasibility — loads on phones, needs touch controls | DESIGN | "What works now" is true; touch controls unbuilt, parked |
| `AI-AUDIT.md` | 2026-07-19 six-agent bot-AI audit — ranked findings | DESIGN | Roadmap mostly unbuilt (Utility Brain, A*, cover, Nemesis open) |
| `OPTIMIZATION-AUDIT.md` | Perf + netcode audit — the ranked board of fixes (#1–42) | DESIGN | Measurements real; the board is Wave 8, unexecuted |
| `plans/2026-07-20-sight-and-steel.md` | The by-viewer visibility rewrite + the melee layer | DESIGN | Wave 0; unbuilt (`lastSeen` still team-keyed, no melee weapon) |
| `AI-REPORT.md` | 2026-07-10 writeup of the bot brain as a ~330-line AI | **STALE** | AI-AUDIT supersedes it; `bots.ts` is now ~1524 lines |
