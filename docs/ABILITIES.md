# War World — Complete Ability Reference

*Read from source: `data.ts` (CLASSES/WEAPONS), `world.ts` (applyCmd, damageSoldier, stepProjectiles), `lsw.ts` (LSWS/THREAT), and all 40 `lsw/*.ts` brains. Numbers are from code — `ASCENDANTS.md` is stale, trust this.*

---

## PART 1 — THE CLASSES

### Shared systems

| System | Value |
|---|---|
| Energy regen | **14/s** — suppressed while cloaked; jump troopers regen **only on the ground** |
| Cloak drain | 11/s |
| Jetpack | thrust 9.5, drain 30/s; thrust fades above **6u**. Burn dry and the pack **latches** until energy hits **35** |
| Hand frag | GL-40 round, 1.2s cd, cursor-targeted, ~22u reach, **banks off walls** |
| Grenade bag (X) | cycles class default → smoke → incendiary → concussion. Everyone spawns **smoke ×2, concussion ×1**; infantry + heavy also get **incendiary ×1** |
| G priority | bag item → orbital designator → MANPADS → demo charge → spy camera → **class special** → frag |

**Alt-fire (RMB)** rides the weapon in hand: **burst** (AR-606, flame burp, 3/life) · **tag dart** (RG-2, pins a target on every enemy screen, 4/life) · **skitter** (GL-40, a 30hp charge that sprints at the nearest enemy, 2/life) · **overcharge** (Plasma, 6 cells → one 60-dmg orb).

### Per class

| Class | HP / spd | Primary | Secondary | ABILITY (Q) | GRENADE (G) |
|---|---|---|---|---|---|
| **Infantry** | 100 / 10.5 | AR-606 (13, r66) | Pistol | ⚠ **nothing — not wired** | Frag ×**4** (passive) |
| **Heavy** | 145 / 8.2 | AC-Mk2 (16, r56) | **MML** (65, splash 5.4/45) | **SHIELD DOME** — 80 energy, **400hp / 30s**, one at a time | Frag ×2 |
| **Jump** | 90 / 11.5 | Kuchler SMG (9, r40) | GL-40 (55, arcs) | **Jetpack** — on SPACE, not Q | Frag ×2 |
| **Engineer** | 110 / 9.5 | CAW-8 (9×8, r26) | Repair Gun | **Build Sentry** — 80 energy, **max 2**, 180hp | ⚠ **MINE** — max 3, arms 1.2s, **80 dmg** |
| **Medic** | 100 / 10.8 | Kuchler SMG | Medi-Beam (22 heal) | **Self-Stim** — 50 energy, **+45 HP** | Frag ×2 |
| **Infiltrator** | 80 / 11 | **RG-2 Railgun** (85, r125) | Pistol | **Cloak** — toggle, 11/s drain, breaks on fire/damage | Frag ×2 |
| **Pathfinder** | 85 / **12.5** | Impulse (30, knockback 17) | Pistol | **Warp Beacon** — plants a paired portal, any teammate uses it | ⚠ **TARGET BEACON** — pings enemies in 25u for 15s |
| **Ghost** | 90 / 11 | Plasma (21, ∞ reserve) | Pistol | **Recon Drone** — humans fly it FPV; pings 22u through walls | ⚠ **EMP** — stuns vehicles 4s, **evicts all possession**, strips cloaks |

> ⚠ **Four classes do NOT throw a frag on G** — engineer plants a mine, pathfinder throws a target beacon, ghost throws an EMP. And **infantry's Q is dead**: `data.ts` declares `ability: 'grenade'` but `applyCmd` has no branch for it (only cloak/drone/heal/jetpack/shield/turret/warp are wired). Pressing Q as infantry does nothing — its "ability" is really the passive 4 frags.

---

## PART 2 — THE LIVING SUPER WEAPONS (40)

### Threat tiers

| Tier | Name | HP | Cost | Telegraph |
|---|---|---|---|---|
| 1 | SKIRMISH | 800 | 1 | 15s |
| 2 | STRONGPOINT | 1600 | 2 | 20s |
| 3 | SIEGE | 3200 | 4 | 30s |
| 4 | EXTINCTION | 5800 | 7 | 40s |

Roster is **9×T1, 22×T2, 9×T3** — no shipped unit uses tier 4.

**Laws binding all 40:** threat buys HP, never immunity · one LSW per faction on field · OFF in paintball/range/onboarding · a pilot's **Q replaces the class kit entirely** · death returns the mortal's kit · LSW armor is exempt from AP rounds.

**Movement classes:** `leap` (Titan, Ragebeast, Tremor, Crusher, Cataclysm) — bot-only, **1.6× damage taken mid-air**. `blinkwalk` (Chronos, Voidwalker, Specter) — hops every 1.6s and is **perfectly still between them; you can't lead a target that doesn't travel**. `flies` (Inferno, Stormcaller, Gargoyle) — **AI-ONLY**, cruise 5.2u, MANPADS-lockable above y2.5. Levitators: Wraith (0.6u, silent), Gravity Warden (falls at 0.35× gravity).

### United Front (faction 0)

| Name | T | Signature (Q) | Second ability / passive |
|---|---|---|---|
| Volt Striker | 1 | Chain lightning 3 links, 55/38/26 | same cast: 2s **overload fuse** on a hull (500 hull dmg unless crew bails) |
| Sniperhawk | 1 | Piercing rail, 80u, 90 dmg, pierces all | **Orbital mark** — 3s arm, 170 dmg |
| Barrier | 1 | Reflect wall 250hp — first **2s reverses fire back at the shooter** | *one ability* |
| Mirage | 1 | **Swap places** with a decoy | up to 3 fake-firing decoys, 6s |
| Blitz | 1 | Dash-strike 16u, 60 dmg — **a kill refunds it** | afterimages: last 2 dash paths replay, 35 dmg |
| Shadowstep | 1 | Blink behind 22u, 50 dmg, **live mine where he left** | *one ability* |
| Firebrand | 2 | **Cash the board** — every painted patch erupts | passive: paints fire under his feet every 0.5s |
| Reactor | 2 | **Overcharge an ally** (1.7× dmg+speed, 6s), else nova | nova 8u, 60 dmg |
| Riptide | 2 | The Wave — shove **+ douses every fire in the corridor** | whirlpool −4 pull (**−8 over water**) |
| Vanguard | 2 | Shield bash 35 dmg + **1.2s gun lock** | barricade 300hp — **blocks BOTH sides, yours too** |
| Pulse | 2 | Sonic wave 16u — **tags through walls**, no LOS needed | deafening burst: 3s vehicle stun |
| Venom | 2 | Acid glob — **sets armor to 0** + 20 dmg | gas volley · passive: his gas tags you |
| Crusher | 2 | The Charge 10u, **smashes cover**, 55 dmg | hurl terrain to **create new cover** |
| Steel Weaver | 2 | **Rip a metal tile out of the map** → +80 armor | exosuit: +120 armor, 1.25× dmg, 10s |
| Phantom | 2 | The Phase — through a wall (3 thick), 50 dmg strike | **The Ride** — possess a machine 3s (never flesh) |
| Frostbite | 3 | **The Ice Block** — encase the aimed soldier, 20u | *one ability* (bot auto-freezes ≤16u) |
| Titan | 3 | **Seismic Hands** — hurl a vehicle (260 dmg, crew ejected) or soldier | pound 7u, 45 dmg, **grinds cover to rubble** |
| Gravity Warden | 3 | **Reverse Gravity** — float them 2.5s, land staggered | pull-then-slam: −6 pull then 50 dmg |
| Inferno ✈ | 3 | Dive-bomb 55 dmg + fire crater (**committed low 2.4s**) | passive: **burning aura 9 dmg/0.6s within 6u 3D** |
| Stormcaller ✈ | 3 | Seed a **roaming tornado** (−26 pull, flings skyward) | call the storm: 8s of 45-dmg bolts — **hits her own team too** |

### The Collective (faction 1)

| Name | T | Signature (Q) | Second ability / passive |
|---|---|---|---|
| Venatrix | 1 | Harpoon — reel in 26u, 15 dmg (**plants a trap every cast**) | up to 3 snap-traps that encase |
| Voidwalker | 1 | Blink-strike 55 dmg + **1s-fuse shadow where he left** | *one ability* |
| Specter | 1 | **Detonate** — every mirror image explodes at once | up to 3 images that **walk and hunt** |
| Plaguebearer | 2 | Quarantine ring — a 6-point plague wall | **vehicle-infect** 14s (engineer repair cleanses) |
| Oblivion | 2 | **Black hole** — −5 pull r14, bursts at 1.5s | void bolts: 45 dmg arcing **over cover** |
| Tremor | 2 | Earthquake stomp 7u, 40 dmg + aim rattle | soil ripple — **slow, visible, sidesteppable** |
| Magnetar | 2 | Magnetic pulse 12u — jams guns, stalls armor | **passive halo eats 68% of bullets within 4u** |
| Wraith | 2 | **Possess** a sentry 12s (+80hp) / stall a hull (+40hp) | *one cast, two targets* · levitates silently |
| Eclipse | 2 | **Darkness dome** — vision dies inside | passive: trails smoke every 0.6s |
| Dominator | 2 | **Psychic Link** — 4 enemies share **60% of all damage** | the Lance: 60u pierce, 70 dmg |
| Pyroclasm | 2 | Magma volley — 3 rocks, 3 lava pools | **passive eruption fires ONCE at 25% HP** (70 dmg, 8 fires) |
| Crimson | 2 | **Blood Rite** — raise a 320hp Blood Brute from a corpse | drain: 10 dmg / +5 HP rhythm |
| Nightmare | 2 | **The Blind** — 2s of no eyes (a blinded bot cannot target) | fear pulse: 3 false contacts per enemy |
| Reaper | 2 | The Chain — reel the **first** body in, 45 dmg | **The Mark** — his blows land **double** for 8s |
| Overload | 2 | **Become Current** — ride the metal circuit, emerge far | arc burst 40 dmg at 8u |
| Cataclysm | 2 | The Slam 8u, 60 dmg | **passive quakes that speed up 6s → 2s over 90s** |
| Ragebeast | 3 | Ground slam 55 × rage, 7u | **rampage to 1.5× as HP drops** + flesh-hurl (costs 25 HP) |
| Chronos | 3 | **Time bubble** — 0.35× inside, he's exempt | **passive: temporal echo saves him ONCE** (~3s back, 12% HP) |
| Gargoyle ✈ | 3 | Screaming dive — **0.8s telegraph**, 55 dmg, lands grounded 2s | perch: **HALF damage** until the tile breaks |
| Leviathan | 3 | Belly flop — 1.5s shadow, **rim** shockwave (55 in the ring, 70 center) | sweep + **juggernaut: walking crushes cover** |

---

## Coded counters — the ones the code actually implements

| Unit | Counter |
|---|---|
| **Phantom** | A **K9 within 12u of the phase exit** cancels the strike and drops his cloak |
| **Gargoyle** | **Destruction** — break the perch tile; he falls stunned, half-damage gone |
| **Crusher** | **Bait the charge into a structural wall** — it stops him *and* stuns him |
| **Crimson** | **Burn the pools** — a corpse within 5u of fire raises no brute |
| **Overload** | **Fight him on dirt** — no connected metal, no circuit |
| **Magnetar** | **~1 round in 3 slips the halo**; energy, arcs and melee pass clean |
| **Stormcaller** | **Eaves** — any tile adjacent to wall/metal can't be struck |
| **Wraith / Phantom** | **EMP evicts possession instantly** |
| **Chronos** | **Camp the glowing echo point** — the save works only once |
| **Leviathan + all 5 leapers** | **Soft mid-air: 1.6× damage** between takeoff and landing |
| **Cataclysm / Pyroclasm** | **DPS checks** — all-in focus; burst Pyroclasm through 25% |
| **Dominator** | **Scatter** beyond the 18u thread |

**Only ONE ability:** Barrier, Shadowstep, Voidwalker, Frostbite · Wraith (one cast, two targets) · Volt Striker (one cast, two halves).
