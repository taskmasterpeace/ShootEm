# COMBAT & AI CORE — Systems Audit

Scope: `src/sim/world.ts`, `bots.ts`, `bot-tuning.ts`, `ai/{pathfinding,perception,horde}.ts`,
`perception.ts`, `morale.ts`, `materials.ts`, `hullcollide.ts`, `weather.ts`, `influence.ts`,
`radar.ts`, `spatial.ts`, `skills.ts`, `director.ts`. Read from CODE, not design docs.

Status legend: ✅ WIRED (code reads it and it changes play) · 🟡 PARTIAL (works, incomplete) ·
👻 BUILT-INVISIBLE (runs, no player-facing evidence of the *mechanism*) · ⬜ UNBUILT (referenced/stubbed, does nothing).

---

## A. THE BOT BRAIN — perception & targeting

| System | Status | What it does | What remains |
|---|---|---|---|
| **Target acquisition** `findTarget` (ai/perception.ts:20) | ✅ WIRED | Nearest enemy inside a weather-taxed eye that passes grass/cloak/cone/ring/LOS gates. Uses the per-team spatial index (`forEach`), lowest-id tie-break preserves determinism. | — |
| **Vision cone + ring parity** (ai/perception.ts:55, TUNE.coneHalf/ringClose) | ✅ WIRED | Bots see a ~130° cone in their facing plus a 9u all-around ring; past the ring, behind them = invisible. This is what makes flanking *possible*. | — |
| **Grass concealment for bots** (ai/perception.ts:46) | ✅ WIRED | Enemy in `T_GRASS` is a rumor past 14u (9u if crouched) unless pinged — mirrors the player's own eyes. | — |
| **Cloak vs bot eyes** (ai/perception.ts:60) | ✅ WIRED | Cloaked enemy only registers inside 9u unless a ping reveals. | — |
| **Ping-awareness (stale-by-one-tick)** (ai/perception.ts:39, `pingedLast`) | ✅ WIRED | Bots read *last* tick's ping set (beacons/drones/cameras/dog nose) because recon fills `pinged` after brains run. Ping carries to full weapon range & pierces cloak. | — |
| **Nemesis bias** (ai/perception.ts:77) | ✅ WIRED | Target score ×0.6 for the enemy who last killed you — a grudge weight, not an override. | — |
| **Reaction delay** (bots.ts:1299, DIFFICULTY.react) | ✅ WIRED | A freshly-acquired contact gets a human beat (0.16–0.5s by tier) before the trigger. Re-arms only on a NEW contact. LSWs exempt. | — |
| **Turn-to-aim cap** (bots.ts:1647, DIFFICULTY.turn) | ✅ WIRED | Per-tick yaw slew capped (7–15 rad/s by tier) so a corner-flick headshot costs time. LSWs exempt. | — |
| **Weather-taxed bot sight** (bots.ts:1033, `visionMult`) | ✅ WIRED | Fog/rain pull the bot's acquire radius exactly like the player's, 16u floor. | — |
| **Radar search points** (ai/perception.ts:101) | ✅ WIRED | In TDM a bot with no visual target walks to the nearest live radar track (frozen intel point). | — |
| **Blind (Nightmare LSW)** (ai/perception.ts:23, `blindUntil`) | ✅ WIRED | A blinded bot returns no targets — ears only. | — |

## B. THE BOT BRAIN — the firing model (this is the honest core)

| System | Status | What it does | What remains |
|---|---|---|---|
| **Aim-error cone** (bots.ts:1293) | ✅ WIRED | Spread = base(0.055) × distance-falloff × difficulty × doctrine.aim × paintball-mercy ÷ director.pressure. | — |
| **Velocity lead** `leadYaw` (bots.ts:1675, TUNE.lead 0.85) | ✅ WIRED | Deliberate under-lead so fast strafing beats bots. | — |
| **Fire discipline** (bots.ts:1303) | ✅ WIRED | Fires only when reacted AND inside range×fireFrac(0.95); melee inside range+0.35. | — |
| **Dry-clip fallback** (bots.ts:1272) | ✅ WIRED | Empty primary + no reserve → swaps to the never-empty sidearm (only if slot 1 is a real gun). | — |
| **Grenade AI** (bots.ts:1471) | ✅ WIRED | Lobs at clusters 8–24u, `aimDist`=range, ~0.6%/roll. Engineers excluded (they mine instead); paintball only at near-still targets. | — |
| **Reload-to-cover** (bots.ts:1464) | ✅ WIRED | Out-of-clip with a live enemy → reload + peel toward `nearestCover`, not stand in the open. | — |

## C. THE BOT BRAIN — movement & combat doctrine

| System | Status | What it does | What remains |
|---|---|---|---|
| **Per-class doctrine table** `DOCTRINE` (bots.ts:461) | ✅ WIRED | 8 classes each get standoff/chase/retreat/strafe/flank/aim numbers. Anchors hold, skirmishers close, marksmen keep the street. | — |
| **Standoff + strafe-dance** (bots.ts:1380–1411) | ✅ WIRED | THE core combat loop: hold the class's standoff band, strafe (dir flips ~2%/roll), retreat inside 0.55×band, close outside 1.3×band. Re-normalized to full stride. | This *is* the combat AI — it is standoff+strafe, not positional/cover-based fighting. |
| **"Flanking" (curl + prong)** (bots.ts:1384–1393, doc.flank) | 🟡 PARTIAL | Adds a lateral curve to the approach vector (TDM full, objective modes 0.6×) + per-life lane bias + CTF two-wing route. | It is a curved *approach*, NOT true flanking. The cone data exists (§A) but bots never route to an enemy's blind side / unwatched angle. Real flank = pick an approach the target's cone can't see. |
| **Cover seeking** `nearestCover` (bots.ts:493) | 🟡 PARTIAL | Influence-weighted nearest sandbag/crate; used on low-HP retreat (bots.ts:1369) and reload-break (1466). Downed crawl uses pure-nearest. | REACTIVE only (hurt / reloading / downed). Bots never choose a *fighting* position behind cover — they strafe in the open during the standoff band. No "hold this angle from cover". |
| **Retreat / break-contact** (bots.ts:1364, doc.retreat × nerve) | ✅ WIRED | Below hp×retreat×nerve a bot breaks toward cover-or-home, guns up. The line between a human and a zed (zeds never step back). | — |
| **Last stand** (bots.ts:1331) | ✅ WIRED | A squad down to its last member skips retreat and clutches; announces once. | — |
| **Separation / anti-bunching** (bots.ts:1595) | ✅ WIRED | Friendlies inside 5u shove apart (firmer-than-linear), hard override inside 2u, deterministic un-stack when perfectly co-located. Uses spatial index. | — |
| **Stuck detection & recovery** (bots.ts:1099 foot, 917 vehicle) | ✅ WIRED | <0.8u moved in 2.5s → force repath (fires even with an enemy in view). Vehicles get reverse-escape then abandon. | — |
| **Per-life lane bias** (bots.ts:1128, botLifeSeed) | ✅ WIRED | Each life leans left/right/straight so waves arrive as prongs, not a single-file rerun of the last death. | — |
| **Nest / turret engagement** `enemyTurretNear` (bots.ts:159, 1216) | ✅ WIRED | `findTarget` returns only soldiers, so bots aim+fire at enemy sentry structures separately (with LOS + arc). | — |
| **Foot anti-vehicle** (bots.ts:1231) | ✅ WIRED | Heavy class aims its slot-1 launcher at the nearest crewed enemy hull, holds at rocket range, peels back inside 15u. | — |

## D. THE BOT BRAIN — objective & role selection

| System | Status | What it does | What remains |
|---|---|---|---|
| **Objective selection** `objectiveFor` (bots.ts:243) | ✅ WIRED | Per-mode goal: CTF wings/escort/hunt, KOTH hill, conquest points, survival squad-center, safehouse/science perimeters, paintball prey/hunter, TDM midfield blend. | — |
| **Objective cache** `cachedObjective` (bots.ts:229) | ✅ WIRED (perf) | ~4Hz staggered recompute; forces fresh compute when own carry-state flips. | — |
| **Utility-scored defenders** `defendsNow` (bots.ts:107) | ✅ WIRED | The ONE real utility function: computes how many defenders home needs (pressure + affordability, capped at a third), ranks squad by fitness, top-N hold. Defenders EMERGE and re-rank every repath. | This is the *only* utility-scored decision. Everything else is rule-based doctrine. |
| **CTF role split** `raidsFlags`/`guardsHome` (bots.ts:68, 83) | ✅ WIRED | Roles by CLASS (never bare id): fast boots raid, armor/engineers guard, medics split. | — |
| **Standoff-breaker** (bots.ts:276) | ✅ WIRED | Detects the parked-carrier deadlock (black-box caught 11-min 0:0 stalemates) and sends non-guards to recover the blocking flag. | — |
| **Thief interception** (bots.ts:266) `amCloseHunter` | ✅ WIRED | A MOVING enemy carrier gets the 3 nearest non-guards converging on a ring, rest keep raiding. | — |
| **Rescue** `isolatedFriendly`/`amClosestRescuer` (bots.ts:172, 203) | ✅ WIRED | A cut-off friendly (no mate in 24u, foe in 30u) gets exactly ONE designated rescuer (nearest free bot). Squadmates weighted at half-distance. | — |
| **Room-duty overwatch** (bots.ts:310) | ✅ WIRED | A third of guard-lives post INSIDE the nearest house overlooking the flag (y=4 channel routes to the upper storey). | — |

## E. NAVIGATION

| System | Status | What it does | What remains |
|---|---|---|---|
| **A\* pathfinding** `pathStep` (ai/pathfinding.ts:48) | ✅ WIRED | Real A* with octile heuristic + binary heap, deterministic tile-index tie-break. Doors passable to planner (hands open them), grass/rubble/shallow-water walkable, spiral-out when goal is inside masonry. | — |
| **Path smoothing** (ai/pathfinding.ts:192) | ✅ WIRED | Walkability ray (NOT losClear — boots ≠ bullets) with elbow checks; takes farthest straight-walkable node up to 24 ahead. | — |
| **Layered ladder/stair BFS** `pathStepLayered` (ai/pathfinding.ts:222) | ✅ WIRED | Multi-storey walk over floor-0 + upper plates + ladder wells + aligned stairs; returns `climb:true` at the well. | — |
| **Ladder IQ (the hands)** (bots.ts:1197, botWantFloor) | ✅ WIRED | Presses E at the well the path aimed at; want clears on floor-flip (ping-pong guard). | — |
| **Door IQ** `doorAhead` (bots.ts:473, 1567) | ✅ WIRED | Closed door on the walk line → aim at it + press use (not mid-firefight). Half the human/horde capability gap. | — |
| **Climb IQ (jump troopers)** `climbAhead` (bots.ts:520, 1584) | ✅ WIRED | Sees a CLIMB barricade coming, lights the jet, burns past the lip. Pathfinder routes this class through barricades. | — |
| **Wheel pathfinding** (bots.ts:948, pathStep wheels=true) | ✅ WIRED | Ground vehicles run the same BFS with a hull menu (no doorways/ladders/barricades) + bow look-ahead brake. Fixed "drivers run into walls". | — |

## F. VEHICLE / PILOT AI

| System | Status | What it does | What remains |
|---|---|---|---|
| **Theater route driving** `stepTheaterVehicle` (bots.ts:649) | ✅ WIRED | Authored waypoint routes per domain (air/ground/surface/deep), stall detection, insertion/strike/support air profiles, altitude-band control. | — |
| **Jet dogfight** (bots.ts:659) | ✅ WIRED | Interceptors break patrol to hunt enemy aircraft: pursue, match altitude band, lead & fire, energy-fight EXTENSION on merge overshoot. | — |
| **Missile evasion** (bots.ts:970) | ✅ WIRED | 50° beam turn (not pure flee) + flares — evades while keeping the gun working. | — |
| **Boat patrol** (bots.ts:873) | ✅ WIRED | Circles the moat ring with the deck gun talking; beaches only after 12 quiet seconds. | — |
| **Breacher depth discipline** (bots.ts:903) | ✅ WIRED | Runs deep on quiet legs, surfaces near objective/contact. | — |
| **Emplacement gunner** (bots.ts:855) | ✅ WIRED | Mans/holds/traverses, dismounts when quiet. | — |
| **Race driver** `raceDriverCmd` (bots.ts:793) | ✅ WIRED | Checkpoint racing line + throttle-easing into carves, 3 deterministic skill tiers. | — |
| **Ride-shopping** (bots.ts:1043, 1063, 1078) | ✅ WIRED | Fresh spawns / CTF runners detour to grab armed rides, gunboats, emplacements for long crossings. | — |
| **Vehicle crew reaction delay** `vehicleCrewReacted` (ai/perception.ts:115) | ✅ WIRED | Crewed weapons get a longer (≥0.6s) reaction beat than infantry. | — |

## G. CLASS ABILITY AI

| System | Status | What it does | What remains |
|---|---|---|---|
| **Medic AI** (bots.ts:1496) | ✅ WIRED | Downed ally outranks the wounded outranks the medic's own fight — paths to the body, one beam touch = revive. Self-heal below 50%. | — |
| **Infiltrator cloak AI** (bots.ts:1540) | ✅ WIRED | Cloaks on idle; a CTF raider cloaks FOR THE CROSSING (6% vs 0.8%) to walk the guard wall. | — |
| **Ghost recon drone** (bots.ts:1544) | ✅ WIRED | Deploys the auto-orbit marking drone when a fight is on and battery allows. | — |
| **Engineer sentry/mine** (bots.ts:1495) | ✅ WIRED | Plants near objective when energy full and no target. | — |
| **Jump trooper hops** (bots.ts:1486) | ✅ WIRED | Jets in fights (~2%/roll) and burns out of low-HP retreat. | — |
| **MANPADS discipline** (bots.ts:1549) | ✅ WIRED | Tracks the sky; airborne gunship in range gets the launcher cone. | — |
| **LSW melee doctrine** (bots.ts:1262) | ✅ WIRED | An ascendant fights at ITS arm's reach (0.65×weapon range, ≥6u), always chases; ranged gods keep distance. | — |
| **LSW ability intent** (bots.ts:1661, Firebrand) | 🟡 PARTIAL | Firebrand watches for ≥2 enemies on his fire-field then signals `stepLsw` to detonate (via nextGrenadeAt). | Only Firebrand has explicit intent wiring here; other LSW abilities are driven inside `stepLsw` / step(). Not a gap per se — noted for coverage. |

## H. THE HORDE & NON-COMBATANTS

| System | Status | What it does | What remains |
|---|---|---|---|
| **Zombie brain** `stepZombie` (ai/horde.ts:136) | ✅ WIRED | Nearest-living chase via roster loop, per-variant speed, door-break (brutes ram, bombers detonate, walkers claw), spitter kiting, stalker blink, bite-struggle grabs. | — |
| **Sprinter dormancy** (ai/horde.ts:243) | ✅ WIRED | Creeps until a survivor is near / seen down a clear line / makes weapon-report noise → wakes for good. Torch doubles sight-wake radius. | — |
| **Horde targets structures** (ai/horde.ts:207) | ✅ WIRED | Zeds with nothing better tear down player turrets — makes placed defense testable. | — |
| **Iron-Eater brain** `stepIron` (ai/horde.ts:32) | ✅ WIRED | Scraprats gnaw hulls, junkhounds jump cover, weavers re-plate the swarm, ravagers charge-and-slam. Molt (armor) is the health bar; exposed frame takes 2× + rages. | — |
| **Scientist AI** `stepScientist` (bots.ts:1685) | ✅ WIRED | Follows escort (hustles), or shelters via indoor waypoints, nervous glance. | — |
| **K9 dog AI** `stepDog` (bots.ts:1880) | ✅ WIRED | THE NOSE pings all hostiles in radius (defeats cloak); heel/stay/sic orders, scent trails, door-wait barks, guard-radius takedowns. | — |

## I. THE COMBAT MODEL (world.ts)

| System | Status | What it does | What remains |
|---|---|---|---|
| **`damageSoldier`** (world.ts:7533) | ✅ WIRED | Armor→flesh split w/ separate floating numbers, AP threads issued plate, spawn/god/protect gates, infection load, human-shield redirect, psychic-link share, ice/echo/mark/perch/dive modifiers, auto-medikit, down-vs-die branch. | — |
| **Down / bleedout / revive / drag** (world.ts:5410, 5429, 5394, 2237) | ✅ WIRED | Lethal hit downs humans/bots once (unless overkill), bleedout clock, E-channel revive (interrupted by damage), body drag to cover, revive at partial HP. | — |
| **Explosion two-zone model** `explode` (world.ts:7215) | ✅ WIRED | Lethal kill-circle (splash×0.4, cap 2.4) + linear falloff to rim, no friendly splash, self 0.6×, knockback + ragdoll threshold + corpse-denial + ignite. Client draws both rings. | — |
| **Melee swing** `startMelee`/`resolveMeleeStrike` (world.ts:4502, 4542) | ✅ WIRED | Windup telegraph → arc strike (yaw locked at windup, dodges honored) → recover, ≤2 victims in wedge, lunge impulse, charge mult. | — |
| **Bite struggle (grapple)** `beginBiteStruggle` (world.ts:4520) | ✅ WIRED | Zed latches, roots victim, mash-to-break, gnaws viral load; sprinter short / brute long holds. | — |
| **Projectile launch + homing** `launch` (world.ts:4691) | ✅ WIRED | Effect-flag copy, air/ground heat-seek acquisition (forward cone, SAM speed cap), air-frame speed scaling. | — |
| **Ballistic falloff** (world.ts:110) | ✅ WIRED | Bullet/shell damage tapers past 0.55×range to a floor; energy weapons exempt. | — |
| **Hand-spread model** `handSpreadMul`/`aimSpreadMul` (world.ts:134, 141) | ✅ WIRED | Stance (crouch 0.7 / sprint 1.7 / airborne 2.1) × morale spread × skill-trained tightening. | — |
| **Death consequences** (world.ts:7682+) | ✅ WIRED | Loot-drop of primary, morale shifts, streak/rampage/shutdown announces, killfeed w/ range+weapon, seat release, corpse physics + shove, reanimation booking, viral-clone economy. | — |
| **Respawn** (world.ts:2208+) | ✅ WIRED | Ring pick with crowd penalty, spawn-on-safe-squadmate, statue-law block, APC/mobile spawn. | — |
| **Knockback / ragdoll** (world.ts:7257, `maybeRagdoll`) | ✅ WIRED | Blast/slam shove with a ragdoll threshold — tumble then get up. | — |

## J. SUPPORT SYSTEMS

| System | Status | What it does | What remains |
|---|---|---|---|
| **Perception (shared eyes)** `perceivesNow` (perception.ts:119) | ✅ WIRED | ONE sight model for wire-cull/minimap/roof-cutaway: cone+ring, skyline rule, grass rumor, muzzle-flash reveal, smoke blocking, cross-floor LOS, terrain occlusion. | — |
| **Seen-linger / ghost trail** (perception.ts:219, classLinger) | ✅ WIRED | Lost contacts persist 1.5–5s per-viewer (recon classes + optics longest, capped at 5). | — |
| **Weather** (weather.ts) | ✅ WIRED | Vision tax (`visionMult`, world.ts:2505), locomotion drag (`moveMult`, 3878/6026), air-grounding (`airGrounded`, 6166), per-theme sky menu, announcer lines. | — |
| **Materials table** (materials.ts) | ✅ WIRED | One substance per tile/surface: wall HP + heavyOnly gate (world.ts:909), drill rate, surface grip/slick (6105), flammability (945), ricochet gate (6774), penetrable gate (6788), impact VFX. | — |
| **Hull collision** `resolveHulls` (hullcollide.ts:65) | 🟡 PARTIAL (by design) | Mass-weighted impulse separation + crash damage for ground/surface vehicles (world.ts:5877). | Soldiers deliberately excluded (Robert's call) — the separation shove handles bodies instead. Air/immobile/burrowed/submerged hulls excluded. |
| **Influence / threat map** (influence.ts) | 👻 BUILT-INVISIBLE | 32×32 per-team threat field rebuilt 2.5×/s (world.ts:2454), LSW weighted 4×. | Read by exactly ONE consumer: `nearestCover` scoring (bots.ts:510, 1369, 1466). Its effect (bots peel to the quiet side) is subtle; the field itself has no visualization. Underused vs its cost — retreat direction, objective picking, and flank-side choice could all read it. |
| **Radar** (radar.ts) | ✅ WIRED | Emitter profiles (fixedWing/rotor/sensors/naval/sonar), track expiry/precision/jamming, weather multiplier; feeds bot `radarSearchPoint` + HUD. | — |
| **Spatial index** `SoldierIndex` (spatial.ts) | ✅ WIRED (perf) | Per-team uniform grid rebuilt once/tick; powers findTarget/zombie/melee/separation/projectile queries deterministically. | — |
| **Skill practice** (skills.ts) | ✅ WIRED | 22 use-levelled skills, 6 bands (cap 900 = a campaign), Master +12%. Practised in `damageSoldier` (world.ts:7655) for humans/bots only; tightens groups via `handSpreadMul`. | Only weapon-hit skills (rifle/smg/lmg/sniper/rocket/knife/pistol/explosives) actually practise in combat. The other 14 (tank/heli/jet/medic/engineer/commander/navigator…) have no practise call in the combat core — levelled elsewhere or not yet. |

## K. META-BRAIN / "COMMANDER"

| System | Status | What it does | What remains |
|---|---|---|---|
| **The Director (dynamic difficulty)** `stepDirector` (director.ts:44) | 👻 BUILT-INVISIBLE | Match-level meta-brain: reads scoreboard lead + fresh human deaths every 6s, drifts a single `pressure` band (0.78–1.30) that scales bot aim + reaction. Deterministic; neutral (1.0) with no human present. | Works, but it's the closest thing to a "commander" and it only tunes *twitch*, never *tactics*. No UI tell. Player feels it only as "bots got sharper". |
| **Morale — behavioural half** (morale.ts:108, wired at world.ts:2449 → bots.ts:1329) | 🟡 PARTIAL | `wantsCover` (m<40) sets `s.shaken`, which raises the bot's `nerve` to 1.5 → breaks contact sooner. Inspired (m≥88) uses an inline 0.7 to hold longer. | **`wantsToPush` (m≥88) is DEAD CODE — never called anywhere.** Morale's "push harder when winning" half does not exist behaviourally; inspired bots hold contact longer but do not press objectives/aggression more. The only behavioural output is the retreat threshold. |
| **Squad coordination** (squadId — world.ts:1068, 1872; bots.ts:182) | 🟡 PARTIAL | `squadId` (team×100 + mates/4) drives spawn-on-squadmate + weights rescue toward squadmates. | No squad *orders*, no fireteam maneuver, no bounding overwatch, no "regroup" behaviour. Squads exist as a spawn/rescue label only. There is NO AI commander issuing objectives — role emergence is fully per-bot (`defendsNow`). |
| **Leadership / rank morale** (world.ts:2438, leadershipRadius) | ✅ WIRED | A ranked soldier nearby steadies the men (morale hold within leadership radius); food truck does the same. | — |

---

## HONEST ANSWERS TO THE OWNER'S QUESTIONS

- **Does the bot use cover?** Only *reactively* — when hurt (retreat), reloading, or downed it peels to `nearestCover` (influence-weighted). It never chooses a *fighting* position behind cover; during the standoff band it strafe-dances in the open.
- **Flanking?** No, not really. There is a lateral *curl* on approach (doc.flank), a two-prong CTF wing route, and a per-life lane bias — the wave arrives from spread angles. But no bot ever routes to a target's blind side using the cone data it already has. It reads as "curved approach", not "flank".
- **A\*?** Yes — genuine A* (octile heuristic, binary heap) plus a layered multi-storey BFS. This is the strongest part of the AI.
- **Utility system?** Only for defender-role assignment (`defendsNow`). All combat/target/position decisions are rule-based doctrine bands, not utility-scored.
- **Standoff + strafe?** Yes — that is literally the combat core (hold band, strafe, retreat-if-close, close-if-far).
- **Is morale's behavioural half wired to bot decisions?** Half-wired: the shaken→retreat-sooner path works; the inspired→push-harder path is a dead function (`wantsToPush` unused).
- **Any AI commander?** No strategic commander. The Director tunes bot *accuracy* match-wide; roles *emerge* per-bot; squads are a spawn/rescue label. Nothing issues orders or coordinates maneuver.

## STATUS COUNTS

- ✅ WIRED: **68**
- 🟡 PARTIAL: **8** (curl-flanking, reactive-only cover, LSW-intent-only-Firebrand, hull-collision-by-design, morale-behavioural-half, squad-coordination, combat-only-skills, single-consumer-influence*)
- 👻 BUILT-INVISIBLE: **3** (influence map*, the Director, — mechanism-level; effects are visible)
- ⬜ UNBUILT: **1** (`wantsToPush` — morale's push-harder behaviour)

\*The influence map is counted once as BUILT-INVISIBLE (the mechanism has no visualization) and its single-consumer underuse is noted as the partial concern.

---

## TOP 5 GAPS IN COMBAT / AI (ranked)

1. **No true flanking / positional play.** Bots have the enemy vision-cone data (§A) but never use it to attack from an unwatched angle. Combat is standoff+strafe in the open. Highest-impact, highest-visibility gap — it's what makes firefights feel "dumb". Fix: score approach directions against the target's cone + the influence field, prefer the blind quiet side.

2. **Cover is reactive only.** `nearestCover` exists and is influence-weighted, but bots only run to it when hurt/reloading — they stand in the open to trade. A "fight from this cover tile" behaviour (peek/hold) would transform the read of every engagement. The pieces (cover tiles, influence field, LOS) are all already built.

3. **Morale's aggressive half is dead code.** `wantsToPush` (m≥88) is never called. Inspired/winning bots hold contact 0.7× longer but never actually press harder — so a routed side and a surging side look nearly identical on the attack. Wire `wantsToPush` into objective aggression / standoff-band tightening.

4. **The influence/threat map is a paid-for asset with one tiny consumer.** Rebuilt 2.5×/second, LSW-weighted, per-team — and read only by cover scoring. Retreat direction, objective picking, flank-side selection, and grenade targeting could all read it for near-zero extra cost. Biggest ROI-per-effort item.

5. **No squad-level coordination / commander.** `squadId` is only a spawn+rescue label; the Director only tunes accuracy. There's no bounding overwatch, no "one team suppresses while the other moves", no regroup, no focus-fire order. Roles emerge per-bot but bots never *cooperate* tactically. This is the largest missing *system* (vs the smaller behavioural gaps above).
