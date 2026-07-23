# THE STATISTICS BIBLE — War World: Earth

*Every number in the game, and whether the code actually reads it.*

This document was written by walking the source, not the design docs. Where a
doc and the code disagree, **the code wins** and the disagreement is called out.
Numbers are pulled from `src/sim/*.ts` at the file:line cited. Read it on the
couch; when you want to change a number, the cite tells you which file to open.

---

## 1. How to read this — the WIRED / DECLARED / UNBUILT legend

Every stat in this document carries one of three tags. This is the whole point
of the audit — "we have it" and "the code uses it" are different sentences.

| Tag | Meaning | The test it passed |
|---|---|---|
| **● WIRED** | Real. Code that changes gameplay reads this value. | There is a `file:line` where the number is consumed and the outcome (damage, speed, spawn, a gate) changes because of it. |
| **◐ DECLARED ONLY** | The number exists in a data table and is even shown on screens, but **nothing in the simulation reads it to change the fight.** | It is defined and maybe rendered in a menu/HUD, but grep finds no consumer that alters gameplay. |
| **○ UNBUILT** | Named in canon/docs, no data table and no code. | It only exists as prose in a `docs/*.md`. |

A stat can be WIRED for one thing and mean nothing for another — those are
listed twice with the honest tag each time.

**The one-line honest summary up front (re-audited 2026-07-23):** all **8 master
stats and all 22 skills now reach the simulation.** They did not when this file
was first written — the audit below is kept in full, because how a stat was dead
is more useful than a claim that it is alive.

**THE AUDIT IS A TEST NOW.** `tests/stat-wiring.test.ts` (18) asks every skill
the only two questions that matter — *can it be EARNED?* and *does being better
at it CHANGE anything?* — and fails the suite if either answer goes back to no.
This document drifted once and reported "8 gun families wired" while **255 of
316 weapons trained nothing**; it can't drift silently again.

---

## 2. THE CHARACTER

### 2.1 The 8 Master Stats

Defined in `src/sim/types.ts:425` (`SoldierStats`). Canon in
`docs/THREE-GAMES-ONE-WAR.md`. The scale is **1..10, where 5 = today's exact
shipped numbers** — a soldier with all-5 stats is the baseline the whole game
was tuned around.

**The multiplier math** (`src/sim/world.ts:602`):

```
statMul(v)   = 1 + (v - 5) × 0.02     // bigger is better  (HP, melee)
statQuick(v) = 1 - (v - 5) × 0.02     // bigger is quicker  (reload, dash CD)
```

So the entire swing from stat 1 to stat 10 is only **−8% … +10%** — deliberately
tiny. The canon law: *"stats help, they do not decide."* Absent stats read as
neutral (×1) and cost nothing — zeds, dogs and legacy tests pay nothing.

| # | Master stat | What canon says it powers | What the CODE actually does | Status | Cite |
|---|---|---|---|---|---|
| 1 | **POWER** | melee damage · the frame (spawn HP) · later carry/breach/throw | Spawn HP = `classHP × statMul(power)`. Melee strike damage = `weaponDamage × chargeMul × statMul(power)`. | **● WIRED** (2 hooks) | `world.ts:1791`, `world.ts:4545` |
| 2 | **AGILITY** | dash/roll recovery · later vault/climb/mount | Dash cooldown = `DASH_CD × statQuick(agility)`. Nothing else. | **● WIRED** (1 hook) | `world.ts:3312`, `world.ts:3350` |
| 3 | **WEAPON HANDLING** | reload · later swap/ADS/recoil recovery | Every reload runs through `reloadTimeFor()` = `reloadTime × statQuick(handling)`. | **● WIRED** (1 hook) | `world.ts:611` |
| 4 | **PILOTING** | aircraft/hover feel | Turn AUTHORITY on anything that leaves the ground: `controlAuthority()`. Canon-scoped — it does **not** touch a jeep, and it moves how hard the airframe turns, never how fast it goes. | **● WIRED** | `world.ts` `controlAuthority` |
| 5 | **ENGINEERING** | repairs, turrets, field construction | `repairMul()` — what a field patch is WORTH (hull hp, subsystem brace, turret hp), and `statQuick(…,2)` on the kit's 10s cooldown. | **● WIRED** (3 hooks) | `world.ts` `repairMul`, `tryFieldKit` |
| 6 | **LEADERSHIP** | squad size, command radius, radio authority | Multiplies `leadershipRadius(rankId)` in the morale pass at strength 3. Rank GRANTS the authority; the stat says how far the man carries it. | **● WIRED** | `world.ts` morale pass |
| 7 | **SCIENCE** | hacking, artifacts, lab work | The hack-kit cooldown — a trained head is on the next sentry sooner. | **● WIRED** | `world.ts` `tryFieldKit` |
| 8 | **CHARISMA** | negotiation, recruitment, black market | Hotwire/requisition RATE. This is the only place in the sim where a soldier talks somebody out of something, so it is the canon-true home: a persuasive man is out of the owner's car sooner. | **● WIRED** | `world.ts` `stepRequisition` |

**The strength dial.** `statMul(v, strength)` / `statQuick(v, strength)` scale the
same ±2%/point curve where a fuller effect is warranted. Combat hooks stay at
strength 1 (the ±10% canon band — *stats help, they do not decide*); the utility
hooks that cannot kill anybody take a bigger share, because a ±2% morale circle
is not a difference any player could ever feel:

| Hook | Strength | 1 → 10 swing |
|---|---|---|
| HP, melee, reload, dash | 1 | ±10% |
| repair worth, kit/hack cooldown, hotwire | 2 | ±20% |
| leadership reach, piloting authority | 3 | ±30% |

**Decay ("use it or lose it")** is LOCKED in canon and repeated in the type
comment. **Status: ○ UNBUILT.** There is no decay code anywhere — stats are set
once at spawn and never move.

#### What a soldier STARTS with (the master stats)

The roll happens in `addSoldier` (`world.ts:1021`):

| Who | Power | Agility | Handling | Piloting | Engineering | Leadership | Science | Charisma |
|---|---|---|---|---|---|---|---|---|
| **Human (you)** | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| **Bot** | 3–7 | 3–7 | 3–7 | 3–7 | 3–7 | 3–7 | 3–7 | 3–7 |
| **Zed / dog / beast** | — (none, pays ×1) | — | — | — | — | — | — | — |

- **The human starts dead-neutral** — flat 5s until the meta-layer assigns real
  people. So today, your three wired stats do literally nothing for you (×1),
  and they never will until the meta-layer writes a real number onto the print.
- **Bots roll 3–7** from a seed-stable hash (`roll(k) = 3 + floor(hash01(seed + id×k) × 5)`),
  never the live RNG — so bot stats survive across streams and the harness stays
  deterministic. Their real swing is therefore only **−4% … +4%** on the wired
  three.

> **The punchline for the character sheet:** the only master stats that touch
> the fight are Power (HP + melee), Agility (dash cooldown) and Handling
> (reload). And they only vary on *bots*. For the human player they are all 5
> and all inert. Everything else is a promise.

### 2.2 HP, Armor, Energy — the survival pool

Set at spawn in `world.ts:1786-1792`. **● WIRED** (all consumed constantly).

| Field | Value / formula | Status | Cite |
|---|---|---|---|
| **maxHp** | `round(classHP × statMul(power))` | ● WIRED | `world.ts:1791` |
| **armor** (plate) | Σ equipment `hpBonus` (vest +25, power armor +60); absorbs before HP, does NOT regen, restored on respawn | ● WIRED | `world.ts:1788`, `data.ts:926` |
| **energy** | starts 100. The ONE tank: jetpack fuel, sprint, dash, roll, slide, guard, cloak, LSW abilities all drain it | ● WIRED | `world.ts:1792` |
| **energyRegen** (class field) | multiplies the base 14/s regen; only 4 classes set it (heavy .75, engineer .9, infiltrator 1.15, pathfinder 1.35) | ● WIRED | `world.ts:4007`, `data.ts:351` |

Base energy regen `ENERGY_REGEN = 14/s` (`world.ts:230`).

#### Class base stats (`src/sim/data.ts:345`, `CLASSES`)

All ● WIRED — `hp` sets the frame, `speed` sets movement, `primary/secondary`
are the issued loadout, `energyRegen` scales the tank.

| Class | HP | Speed | Primary | Secondary | Ability | energyRegen |
|---|---|---|---|---|---|---|
| Infantry | 100 | 10.5 | AR-606 | P9 Sidearm | Frag grenade | 1 (default) |
| Heavy Weapons | **145** | **8.2** | AC-Mk2 | Micro-Missile | Shield Dome | 0.75 |
| Jump Trooper | 90 | 11.5 | Kuchler SMG | CL-40 Concussor | Jetpack | 1 |
| Combat Engineer | 110 | 9.5 | CAW-8 | Repair Gun | Sentry / Mine | 0.9 |
| Field Medic | 100 | 10.8 | Kuchler SMG | Medi-Beam | Self-Stim | 1 |
| Infiltrator | 80 | 11 | RG-2 Railgun | P9 Sidearm | Cloak | 1.15 |
| Pathfinder | 85 | **12.5** | Impulse Cannon | P9 Sidearm | Warp Beacon | 1.35 |
| Ghost | 90 | 11 | Kamenel Plasma | P9 Sidearm | Recon Drone / EMP | 1 (default) |

Starting grenades: infantry 4, engineer 3, everyone else 2 (`world.ts:1039`).

### 2.3 The movement verbs (the stamina economy)

All paid from the one energy tank. All ● WIRED (`world.ts:288-348`).

| Verb | Cost | Effect | Cite |
|---|---|---|---|
| Sprint | 10/s held | ×1.35 speed (`SPRINT_MULT`) | `world.ts:288` |
| Dash | 25 | 16 u/s impulse, ~3.2u burst; CD 0.9s × statQuick(agility) | `world.ts:290,293,296` |
| Roll | 20 | 13 u/s impulse | `world.ts:291,294` |
| Slide | 14 | 19 u/s skid (spends sprint momentum) | `world.ts:292,295` |
| Charged leap | 25 | 9–15 u/s horizontal + 6.5 up; ballistic, no air steer | `world.ts:299-302` |
| Guard (brace) | 10/s | ×0.45 speed, blocks frontal melee | `world.ts:234`, `world.ts:3899` |
| Jetpack | 30/s | 9.5 thrust; latches empty until energy ≥ 35 | `world.ts:346-347` |

**Ragdoll threshold** `RAGDOLL_AT = 16` (`world.ts:308`): a knockback impulse ≥16
flips the body. A plain frag (knockback 13) only shoves; a concussion (26) or
artillery flips you.

### 2.4 The 22 Secondary Skills (`src/sim/skills.ts`)

*"Levelled through use, deliberately small."* The whole ceiling is **+12%**.

**The full roster** (`skills.ts:33`, all present as data, ◐ mostly):

Rifle · SMG · LMG · Sniper · Rocket · Knife · Pistol · Tank Driver · Tank
Gunner · Helicopter · Jet · Boat · Engineer · Medic · Dog Handler · Drone
Pilot · Radio Operator · Commander · Navigator · Mechanic · Explosives · Scout

**The bands** (`skills.ts:67`): raw practice thresholds
`[0, 25, 80, 200, 450, 900]` →
`Untrained · Familiar · Practised · Skilled · Expert · Master`. Practice caps at
900 (a campaign of doing one thing). `skillEdge = 1 + level × 0.024 × strength`
— Master (level 5) at strength 1 = +12%.

#### THE RETICLE TELLS THE TRUTH

Robert, 2026-07-23: *"the reticle should reflect your skills at shooting — think
about it, smaller for some, larger for others."* He was describing a bug.

The round left the barrel through `handSpreadMul` = **stance × morale × skill**.
The reticle was drawn with `aimSpreadMul` = **stance only**. So the one HUD
element whose entire job is *"your shot goes in here"* was wrong in both
directions: a Master grouped ~14% tighter than his own circle promised, and a
rattled soldier grouped worse than it admitted. The renderer now sizes both the
ground wedge and the standing reticle from the **same function the bullet uses**,
so practice and nerve are things you can SEE.

Measured live, AC-Mk2, same soldier:

| State | Cone |
|---|---|
| recruit, standing | ×1.000 |
| recruit, sprinting | ×1.700 |
| **Master**, standing | **×0.856** |
| **Master**, crouched | **×0.599** |
| **Master**, sprinting | ×1.455 |

#### What is actually WIRED

`handSpreadMul` (`world.ts:134`) tightens the aim cone by the weapon's trained
skill:

```
trained = 1 / skillEdge(practiceOf(s, skillForWeapon(weapon)), 1.4)
```

So a Master with the matching weapon skill groups ~**17% tighter** (strength
1.4). And practice is *earned* — landing a round on an enemy calls
`practise(shooter, trains, 0.5)` (`world.ts:7648`), gated to humans/bots that
aren't gods.

#### THE MAP THAT WAS BROKEN (found 2026-07-23)

`skillForWeapon` was written against family names that **mostly do not exist.**
It asked for `at`, `melee`, `sniper`, `assault`, `dmr`, `railgun`, `mg`; the
real arsenal ships `at_rocket`, `melee_weapon`, `slugger`, `carbine`, `hmg` and
eleven more it had never heard of. Worse, every hand-tuned CORE weapon carries
**no `family` at all** — including `ar606`, the issue rifle every infantryman
spawns holding — so the id-prefix fallback found nothing either.

**Measured: 255 of 316 weapons trained nothing.** The one wired skill in the
game reached 19% of the guns in it, and the starting rifle was not one of them.

After the fix: **49 of 316**, and those are exactly the 40 LSW god-arms (a god
does not improve with practice — the threat table is measured against its card)
and 9 monster attacks (claws, bites, acid). Every weapon a soldier can hold now
teaches a trade. `family` itself was left alone, because family also picks the
weapon's MODEL — retagging guns to fix a skill map would have silently
restyled the arsenal.

#### All 22, earned and spent

| Skill | EARNED by | SPENT on |
|---|---|---|
| Rifle · SMG · LMG · Sniper · Rocket · Knife · Pistol · Explosives | landing rounds with that family | tighter cone — `handSpreadMul` |
| **Tank Gunner** | firing a ground mount (`tank_cannon`, `apc_mg`, `turret_mg`…) | tighter mount — `mountSpreadMul` |
| **Helicopter · Jet · Boat** | firing that airframe's/boat's gun **and** seat time under way | turn authority — `controlAuthority` |
| **Tank Driver** | seat time in a moving ground hull (`practiseSeat`, 1/s, never while parked) | turn authority — `controlAuthority` |
| **Engineer · Mechanic** | patching hulls and turrets with the kit | what a patch is WORTH — `repairMul` |
| **Medic** | getting a downed man back on his feet | faster revive channel |
| **Dog Handler** | every bite his dog lands | weight behind the bite |
| **Drone Pilot** | stick time on a live FPV drone | the LEASH — how far the link survives |
| **Radio Operator** | planting beacons | how long a targeting beacon holds the mark |
| **Commander** | seconds actually spent steadying men inside your reach | a wider circle — the leadership reach |
| **Navigator** | ground covered at a sprint | less wind wasted — sprint energy drain |
| **Scout** | first eyes on a body that was not on the board | the team's perceive range (best scout only — ten recruits do not add up to one pathfinder) |

> The design rule this table encodes: **a skill needs BOTH.** Earnable but never
> spent is a number that goes up for nothing; spendable but never earnable is a
> stat you can never actually get. Three skills were each half-wired before this
> pass (`tank_gunner`/`medic`/`radio_operator` earnable-not-spent;
> `tank_driver`/`commander`/`mechanic` spent-not-earnable) and four
> (`dog_handler`, `drone_pilot`, `navigator`, `scout`) were neither.

#### What you START with (skills)

Your **hometown** grants **2 skills a head start** of **30 raw practice** each
(`hometown.ts:146`, `HEAD_START = 30` — just past Familiar/25). The archetype is
DERIVED from the nation's doctrine stats + city index + name hash — no
hand-authoring. **● WIRED** — handed to the sim as `startingSkills`
(`main.ts:922` → `world.ts:1074`).

| Archetype | Skills granted |
|---|---|
| Port Town | Boat, Navigator |
| Industrial City | Mechanic, Engineer |
| The Capital | Commander, Radio Operator |
| Garrison Town | Rifle, Scout |
| Frontier | Scout, Navigator |
| University City | Engineer, Medic |
| Mining Town | Explosives, Mechanic |
| Farm Country | Rifle, Mechanic |
| Transport Hub | Tank Driver, Mechanic |

Note: only Garrison (Rifle+Scout — Rifle wired), Mining (Explosives wired),
Farm (Rifle wired) hand you a skill that currently *does* anything. The rest
seed inert skills.

### 2.5 Morale (`src/sim/morale.ts`) — ● WIRED

A live 0–100 value on humans/bots. Base **60** (`MORALE_BASE`). Moves during
the fight, comes back out in the hands.

**The bands** (`morale.ts:61`) and their **spread multiplier** (`moraleSpread`,
consumed in `handSpreadMul` at `world.ts:138`):

| Band | Range | Aim-cone × | Behaviour (bots) |
|---|---|---|---|
| BROKEN | <20 | **1.18** (hands gone) | wants cover |
| SHAKEN | 20–39 | 1.08 | wants cover (<40) |
| STEADY | 40–67 | **1.00** (the honest middle) | — |
| HIGH | 68–87 | 0.96 | — |
| INSPIRED | ≥88 | **0.93** (nothing stops this) | wants to push |

**What moves it** (`MORALE_SHIFTS`, `morale.ts:36`), all applied in `world.ts`:

| Event | Δ | Cite |
|---|---|---|
| Friend down within earshot | −14 | `world.ts:7707` |
| You kill | +7 | `world.ts:7716` |
| Your side scored | +9 | (event-driven) |
| Other side scored | −7 | — |
| Mauled (>½ HP in one blow) | −9 | — |
| Revived | +12 | — |
| Medal | +15 | — |
| Alone (no friends near) | −0.9/s | `world.ts:2434` |
| Led well (rank in reach, or near a live food truck) | +0.7/s (×0.8 for food) | `world.ts:2435,2439` |
| Settle toward 60 | 0.5/s | `world.ts:2440` |

Bot behaviour: `s.shaken` is set when a bot's morale wants cover
(`world.ts:2442`), and the bot AI reads it as a **nerve** multiplier —
`nerve = shaken ? 1.5 : morale≥88 ? 0.7 : 1` (`bots.ts:1329`).

**The banked-morale carry:** your dossier morale opens the stable richer for
your side — `moraleBoost: [min(3, morale), 0]` (`main.ts:914`). ● WIRED.

### 2.6 Rank & Service (`src/sim/ranks.ts`) — ● WIRED (authorities), ◐ (leadership stat)

Rank is **read off SERVICE**, never bought. Service score
(`serviceScore`, `ranks.ts:75`):

| Deed | Points |
|---|---|
| Match fought | 5 |
| Match won | 15 |
| Kill | 1 |
| Medal | 25 |
| **Certification** | **30** (a cert beats 30 kills — canon: knowledge is the progression) |
| Track record | 10 |
| Skill band | 8 |

**The ladder** (`ranks.ts:34`) and what each rank is TRUSTED with:

| Rank | Service req | Grants | Wired? |
|---|---|---|---|
| Recruit | 0 | Nothing | — |
| Private | 25 | Name on manifest | — |
| Corporal | 70 | Leadership reach begins (steadies men near) | ● |
| Sergeant | 160 | Reach further | ● |
| Staff Sergeant | 300 | +1 opening materiel | ● |
| **Lieutenant** | 520 | **MAY CALL THE STABLE** (spend materiel on a god) | ● WIRED `world.ts:1200` |
| Captain | 820 | Command seat + doctrine | ◐ (checked at `service.ts:92`, command layer partial) |
| Major | 1220 | +1 materiel, long calls | ● (materielBonus) |
| Colonel | 1750 | A front of your own | ◐ |
| General | 2500 | The war | ◐ |

- **Leadership REACH** (`leadershipRadius`, `ranks.ts:115`): Corporal 10u →
  General 38u. Men inside it hold their morale (`world.ts:2431`). **● WIRED —
  but keyed to `rankId`, NOT to the Leadership master stat.**
- **`mayCallStable(rank ≥ 5)`**: the stable refuses a human below Lieutenant
  (`world.ts:1200`). **● WIRED.**
- **`materielBonus`** (`ranks.ts:121`): +1 at Staff Sgt, +2 at Major. **● WIRED.**

You start at `currentRank().id` from your stored service (`main.ts:923`).

### 2.7 The 12 Certifications / Licences (`src/sim/licenses.ts`) — ● WIRED

The wheel is gated. A hull names the licence it needs; you must hold the whole
**chain** (Bomber needs Fixed Wing; Tank needs Basic Driver → Heavy Truck → APC).

| # | Licence | School | Tier | Requires |
|---|---|---|---|---|
| 1 | Basic Driver | Motor Pool | 1 | — |
| 2 | Heavy Truck | Motor Pool | 2 | Basic Driver |
| 3 | APC | Armour School | 3 | Heavy Truck |
| 4 | Tank | Armour School | 4 | APC |
| 5 | Hovercraft | Motor Pool | 2 | Basic Driver |
| 6 | Boat | Naval Yard | 2 | — |
| 7 | Helicopter | Flight School | 3 | — |
| 8 | Fixed Wing | Flight School | 3 | — |
| 9 | Bomber | Flight School | 5 | Fixed Wing |
| 10 | Transport | Flight School | 3 | Heavy Truck |
| 11 | Drone Pilot | Signals School | 2 | — |
| 12 | Dropship | Flight School | 5 | Transport |

**The enforcement seam** `mayDrive()` (`world.ts:5444`): a body with no `papers`
array is ISSUED (every bot — drives anything). Only the human, whose file the
client hands in at spawn (`main.ts:919`, `world.ts:1071`), can be **refused the
wheel** — and only the wheel; you may still ride in the back
(`world.ts:5493`). **● WIRED.**

**What you START with:** whatever `loadLicences().held` holds (localStorage,
account-level, survives death). A fresh account holds **none** — canon: *"a new
soldier starts empty."* Earned by DRIVING a course at the Proving Grounds
(`courses.ts`, 12 courses, par times generous). **● WIRED** (award →
`licences.ts:41`).

---

## 3. VEHICLES

### 3.1 The VehicleDef stat contract (`src/sim/types.ts:296`)

| Field | Meaning | Status | Where consumed |
|---|---|---|---|
| `hp` | hull hit points | ● WIRED | `damageVehicle` throughout |
| `speed` | top speed (u/s) | ● WIRED | `stepVehicle` `world.ts:6066` |
| `turnRate` | rad/s steering | ● WIRED | `world.ts` steering; bank at `renderer.ts:3516` |
| `mass` | tonnes (1.6 = neutral saloon) | ● WIRED | heft `world.ts:6086`, collisions `hullcollide.ts`, shock `world.ts:6277` |
| `grip` | 0.6–1.4 handling, ×surface grip | ● WIRED | `world.ts:6102` |
| `traction` | `{ice,dirt,paved}` profile | ● WIRED | `world.ts:6099-6102` |
| `shock` | landing force it absorbs before damage | ● WIRED | `world.ts:6277` |
| `slip` | drift rate (velocity chases nose) | ● WIRED | `world.ts:6115` |
| `seats` | 1 driver + crew + passengers | ● WIRED | boarding |
| `radius` | collision size | ● WIRED | everywhere |
| `systemHp` | per-subsystem HP (~10% hull) | ● WIRED | subsystem damage |
| `cost` | war-ledger requisition value | ● WIRED (billed) | `world.ts:7912`, `operations.ts:340` |
| `mobileSpawn` | rolling team spawn (needs comms) | ● WIRED | `world.ts:1933` |
| `hover` | crosses water | ● WIRED | surface logic |
| `flies` | over walls/cover | ● WIRED | flight block |
| `minAirspeed` | fixed-wing stall floor (fraction of top) | ● WIRED | `world.ts:6064` |
| `bankAngle` | visual roll into a turn | ● WIRED (visual) | `renderer.ts:3516` |
| `liftoffTime` | rotor spool seconds | ● WIRED | boarding→liftoff |
| `antiAir` | homing SAM vs aircraft | ● WIRED | `world.ts:1541` |
| `stealth` | radar can't lock beyond visual range | ● WIRED | `world.ts:2584,4814,6362` |
| `digs` | grinds walls (tunneler) | ● WIRED | `world.ts:6204` |
| `strider` | legs step over cover (mech) | ● WIRED | `world.ts:6019,6106` |
| `stomps` | AoE ground slam | ● WIRED | mech ability |
| `immobile` | can't move (emplacement) | ● WIRED | `world.ts` |
| `boat` | water-locked | ● WIRED | surface logic |
| `submersible` | surface/dive toggle | ● WIRED | `world.ts` (7 hits) |
| `healRadius`/`healRate` | ambulance heal pulse | ● WIRED | `world.ts:6320` |
| `crew` | crew station order | ● WIRED | crew seats |
| `rails` | rail-locked route | ◐ **partial** — read to EXCLUDE from wheel physics/garage (`world.ts:6265`, `garage.ts:126`), but the **track generator that gives it a route is UNBUILT** (#65). The hull is boardable dressing. |
| `bombs` | bomb-stick count | ● WIRED | bomber drop |
| `altWeapon` | secondary trigger | ● WIRED | vehicle fire |
| `civilian` | world-traffic flag | ◐ **DECLARED ONLY** in the sim — read only by the **Codex** (`codex.ts:245`) and **model picker** (`models/vehicles.ts:11`); no sim rule keys off it |

### 3.2 The full hull comparison — MILITARY roster

From `VEHICLES` (`src/sim/data.ts:390`). Speed in u/s. Licence from
`licenseFor()`. All rows ● WIRED.

| Hull | Cost | HP | **Speed** | Turn | Mass(t) | Grip | Traction ice/dirt/paved | Shock | Seats | Weapon | Licence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Scout Buggy | 1 | 95 | 19 | 2.6 | 1.3 | 1.05 | .7/1.1/1.05 | 4 | 2 | Buggy MG | Basic Driver |
| **Ares Battle Tank** | 4 | **650** | **11** | 1.5 | **62** | 0.9 | .95/1.3/1 | 40 | 8 | 120mm Cannon | **Tank** |
| Bastion APC | 3 | 450 | 14 | 1.8 | 19 | 0.95 | .9/1.25/1 | 22 | 4 | APC MG | APC |
| Wraith Skiff | 1 | 90 | 22 | 3.2 | 2.2 | 1 | .85/1/1 | 3 | 1 | Skiff Plasma | Hovercraft |
| Halo Hoverboard | 1 | 45 | 24 | 4.2 | 0.12 | 1.1 | .8/.95/1 | 1.4 | 1 | — | none |
| Jackal Recon Bike | 1 | 85 | 26 | 3.4 | 0.35 | 1.15 | .55/1/1.15 | 1.6 | 1 | Bike MG | Basic Driver |
| Kestrel Gunship (flyer) | 2 | 48 | 24 | 2.8 | 4 | 1 | (air) | — | 2 | Flyer Plasma | Helicopter |
| Shrike Attack Heli | 3 | 105 | 27 | 2.5 | 6 | 1 | (air) | — | 2 | Heli Rockets/Cannon | Helicopter |
| Condor Transport Heli | 4 | 260 | 21 | 1.65 | 11 | 1 | (air) | — | 9 | Transport MG | **Dropship** |
| Vulture Strike Jet | 3 | 62 | **40** | 1.5 | 9 | 1 | (air, stall .45) | — | 1 | Rockets/MG | Fixed Wing |
| Falcon Interceptor | 3 | 55 | **46** | 2.3 | 8 | 1 | (air, stall .5) | — | 1 | Falcon Cannon | Fixed Wing |
| Lance AA Track | 2 | 130 | 13 | 1.9 | 14 | 1 | .9/1.2/1 | 12 | 2 | AA Missile | Basic Driver |
| Anvil Heavy Bomber | 4 | 240 | 17 | 0.75 | 30 | 1 | (air, 12 bombs) | — | 3 | — | Bomber |
| Warhawk Gun Jet | 4 | 130 | 30 | 1.5 | 16 | 1 | (air, stall .4) | — | 1 | Warhawk GAU | Fixed Wing |
| Specter Fighter | 4 | 70 | 44 | 1.9 | 10 | 1 | (air, stall .5) | — | 1 | Specter AAM | Fixed Wing |
| Reaper Stealth Bomber | **6** | 150 | 24 | 0.9 | 22 | 1 | (air, **stealth**, 8 bombs) | — | 2 | Reaper JDAM | Bomber |
| Hydra Gunship Heli | 4 | 115 | 25 | 2.4 | 7 | 1 | (air) | — | 2 | Hydra Guided | Helicopter |
| Atlas Transport | 3 | 520 | 12 | 1.6 | 13 | 0.9 | .7/.95/1.05 | 14 | 9 | Transport MG | Transport |
| Mercy Ambulance | 2 | 240 | 17 | 2.2 | 3.2 | 1 | .7/.9/1.1 | 3.5 | 3 | — (heals) | Basic Driver |
| Mole Tunneler | 2 | **700** | **4.5** | 1.0 | 45 | 0.8 | 1/1.4/.9 | 35 | 2 | — (digs) | **Tank** |
| Bulwark Emplacement | 1 | 380 | **0** | 0 | 8 | 1 | 1/1/1 | 20 | 1 | Emplacement Gun | none |
| Pike Gunboat | 2 | 145 | 21 | 2.6 | 3.5 | 1 | (water) | — | 3 | Boat MG | Boat |
| Barracuda Submarine | 4 | 320 | 17 | 1.35 | 210 | 0.9 | (water, submersible) | — | 4 | Torpedo | Boat |
| Goliath Assault Walker (mech) | 3 | 480 | **9** | 2.4 | 28 | 1 | 1/1.2/1 | 30 | 2 | Arm Cannon (strider/stomps) | **Tank** |

### 3.3 "Tank vs pickup top speed" — the answer Robert asked for

| | Ares **Tank** | Workhorse **Pickup** |
|---|---|---|
| **Top speed** | **11 u/s** | **16 u/s** |
| HP | 650 | 90 |
| Mass | 62 t | 2.1 t |
| Seats | 8 | 3 |
| Weapon | 120mm cannon (110 dmg) | none |
| Grip / traction | 0.9 · dirt-biased (.95/1.3/1) | 0.95 · dirt-biased (.8/1.15/1) |

**The pickup is ~45% faster than the tank in a straight line** (16 vs 11), and
because it weighs 2.1 t against 62 t its `heft`
(`heft = clamp(pow(mass/1.6, 0.34), 0.8, 2.4)`, `world.ts:6086`) is far lower —
so it also **accelerates and stops far quicker**. The tank pays for its 650 HP
and its cannon with the worst straight-line speed of any armed ground hull. In
short: the pickup is the runabout; the tank is a fact of nature.

**Where the pickup DOESN'T win — cargo:** see §3.5. Robert's instinct ("a
pickup is gonna have much more CARGO SPACE") is **correct as a design goal but
NOT yet implemented as a per-hull number.** Today the pickup and every other
road hull share the *same* 2 cargo slots. The truck's advantage is currently
only mass/HP, not capacity.

### 3.4 The CIVILIAN roster (`data.ts:230`) — the world-traffic hulls

48 civilian hulls, all `civilian: true`. Speeds respect the armour-ladder
ceiling (ground/water < the slowest live round 33.3, air < the Vulture 40).
All the physics fields are ● WIRED (they drive), but `civilian` itself is a
◐ Codex/model flag. Selected highlights (full table in the Codex):

| Hull | Cost | HP | Speed | Mass | Cargo payload (traffic.ts) |
|---|---|---|---|---|---|
| Commuter Sedan | 1 | 70 | 18 | 1.5 | — |
| **Workhorse Pickup** | 1 | 90 | 16 | 2.1 | — |
| Range SUV | 1 | 100 | 17 | 2.3 | — |
| Meridian Sports Car | 2 | 60 | **26** | 1.35 | — |
| **Petrochem Fuel Tanker** | 2 | 110 | 11 | 15 | **fuel — blast 16, 190 dmg** |
| Municipal Garbage Truck | 2 | 200 | 9 | 14 | cargo — blast 5, 40 |
| Corner Food Truck | 1 | 120 | 12 | 4.4 | **food — steadies morale** |
| Metro Police Cruiser | 1 | 95 | **22** | 1.85 | siren |
| Interurban Freight **Train** | 4 | **600** | 14 | 80 | — (rail-locked, route UNBUILT) |
| **Broadside V8 Muscle** | 2 | 85 | **31** | 1.9 | — (the fast lane) |
| Meridian Roadster | 2 | 55 | 27 | 1.05 | — (grip 1.4, corners on rails) |
| Dust Devil Rally Pickup | 2 | 120 | 26 | 2.0 | — (dirt .35 traction) |
| Longhaul Cargo Ship | 4 | 380 | 6 | **900** | cargo |

**The traffic payload table** (`src/sim/traffic.ts:49`) is a REAL system —
`payloadOf()` is read at `world.ts:7922` so a wrecked fuel tanker actually
detonates (blast 16, 190 dmg). This is the "which civilian vehicles weaponize"
answer, and it is ● WIRED. Only the 10 hulls in `CIVILIAN_PAYLOAD` carry
anything.

### 3.5 CARGO — what exists vs. what a real cargo system needs

**What exists TODAY (`src/sim/garage.ts` — the 4-slot garage):**

The garage is a real, ● WIRED system (`world.ts:2039`, `fitted()`), but "cargo"
in it means the **Racing Destruction Set droppables row**, not carrying
capacity:

| Cargo item | Mass added | Effect | Status |
|---|---|---|---|
| Land Mines | +0.18 t | 6 mines dropped behind (arm 1.2s late) | ● WIRED `world.ts:2042,3746` |
| Oil Gallons | +0.22 t | 4 slicks — anything crossing drives on ice 2.5s | ● WIRED `world.ts:2043,2913` |
| Armour Plate | +0.75 t | ×1.35 hull HP | ● WIRED `garage.ts:103` |
| Crusher Ram | +0.45 t | "contact becomes a plan" — **the ram bonus is DECLARED ONLY; no code reads `crusher` for extra ram damage** | ◐ DECLARED |

Rules: **2 cargo slots max**, road hulls only (no flying/boats/rails,
`garage.ts:127`). Every item is **mass**, and mass is charged by the drivetrain
(heft) — so cargo already has a real cost. `fitLegal` enforces it.

**What a TRUE cargo-CAPACITY system (Robert's pickup-vs-tank idea) would need —
● all UNBUILT:**

1. A **`cargoSpace` field on VehicleDef** (tonnes or slots) — the pickup gets a
   big number, the tank a small one, the sports car almost none. Nothing like
   this exists today; every road hull shares the same flat 2-slot garage.
2. A **carried-load model** separate from the garage droppables — hauling
   ammo/fuel/wounded/loot, where the load is both mass (already charged) AND a
   quantity the hull can hold.
3. **Bed geometry** on the model (`models/vehicles.ts`) so the pickup bed
   visibly fills.
4. A **loot/supply economy** to fill it (the meta-layer's job).

So the honest status: the garage's 4 slots and its mine/oil/armour effects are
real and wired; **per-hull cargo CAPACITY does not exist** — implementing it is
a `VehicleDef.cargoSpace` number plus a load model.

### 3.6 The garage tuning parts (`garage.ts`) — ● WIRED

| Slot | Options | What it rewrites |
|---|---|---|
| **Tires** | Slicks (.35/.6/1.45) · All-Terrain (.75/1/1) · Knobblies (.8/1.4/.75) · Studded (1.6/1/.7) | overwrites the traction profile (`fitted`, `garage.ts:105`) |
| **Engine** | Stock (1/1) · Sprint (0.9 speed / 1.35 accel) · Long Ratio (1.14 / 0.75) | top speed vs launch |
| **Chassis** | Stripped (−0.35t, ×0.75 HP) · Standard · Reinforced (+0.6t, ×1.4 HP) | weight vs survival |

`accelRating` prints a 1–10 number (power-to-weight). `vehicleSpeedMul` /
`moveSpeedMul` are global knobs (default 1, `world.ts:640-641`).

---

## 4. WEAPONS

### 4.1 The WeaponDef contract (`types.ts:128`)

Core fields — all ● WIRED: `damage`, `rof` (shots/s), `speed` (≥200 = instant
tracer), `spread` (radians), `pellets`, `clip`, `reloadTime`, `reserve`
(Infinity = unlimited), `range`, `splash`/`splashDamage`, `knockback`, `arc`,
`heals`, `homing`, `sound`, `tracer`.

**The one true DPS on paper** = `damage × pellets × rof`. Range falloff
(`ballisticFalloff`, `world.ts:105`): bullet/shell rounds taper past 55% of
range down to a floor; energy/beam are exempt; Harkov brand is exempt.

### 4.2 Core weapons (`data.ts:23`, hand-tuned) — selection

| Weapon | Dmg | RoF | Spread | Clip | Reload | Range | Notes |
|---|---|---|---|---|---|---|---|
| Maklov AR-606 | 13 | 7.5 | .025 | 30 | 1.6 | 66 | infantry issue; ~97 DPS paper |
| Kuchler K6 SMG | 9 | 12 | .05 | 40 | 1.3 | 40 | |
| CAW-8 Shotgun | 9×8 | 1.4 | .11 | 6 | 2.2 | 26 | |
| The Boomstick | 11×11 | 1.5 | .17 | 2 | 2.7 | 18 | double-barrel, both on one press |
| RG-2 Railgun | 85 | 0.8 | .001 | 4 | 2.4 | 125 | instant tracer |
| AC-Mk2 Autocannon | 16 | 6.5 | .04 | 60 | 2.8 | 56 | heavy issue |
| Micro-Missile | 65 | 0.9 | — | 3 | 2.6 | 80 | splash 5.4/45, KB 14 |
| GL-40 Grenade Launcher | 55 | 1.1 | — | 5 | 2.4 | 46 | arc, splash 6/50 |
| Kamenel Plasma | 21 | 5 | .015 | 25 | 1.8 | 54 | ∞ reserve |
| F-3 Flamer | 7 | 14 | .12 | 100 | 2.5 | 16 | |
| P9 Sidearm | 12 | 4.5 | .02 | 12 | 1.1 | 44 | ∞ reserve — the eternal fallback |
| 120mm Cannon | 110 | 0.5 | .004 | ∞ | — | 94 | splash 6.5/60, KB 18 |
| Cradle Tactical Warhead (baby nuke) | **400** | 0.2 | — | 1 | — | 30 | splash **26/260**, KB 34 |

Melee (F, universal): Bare Hands 18, Baseball Bat 30, Katana 38 (bleed 4/s×3s),
Fire Axe 46, Combat Knife 34, Breacher Axe 62 (throw+recall).

### 4.3 The generated Arsenal (`src/sim/arsenal.ts`) — 200+ weapons

Built deterministically as **FAMILY base × BRAND flavor × Mk-tier curve**. All
● WIRED (they're merged into `WEAPONS`, `data.ts:234`, and any can be drawn).

**16 families** (`FAMILIES`, `arsenal.ts:64`): pistol, rifle, carbine, smg,
shotgun, slugger, laser, lmg, hmg, at_rocket, ap_rocket, mortar, artillery,
scatter, sonic, flamethrower — plus generated grenade (frag/smoke/wp) and
specials.

**6 brands** (`BRANDS`, `arsenal.ts:23`) — stat multipliers AND a firing
**signature** (● WIRED signatures):

| Brand | dmg | rof | clip | spread | reload | range | Signature (wired) |
|---|---|---|---|---|---|---|---|
| Maklov | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | moving costs 25% less accuracy (`world.ts:4627`) |
| Kuchler | 0.85 | 1.25 | 1.15 | 1.2 | 0.9 | 0.9 | back half of mag fires 10% faster (`world.ts:4449`) |
| Titan Arms | 1.28 | 0.7 | 0.8 | 0.9 | 1.15 | 1.0 | every round shoves (`world.ts:6829`) |
| Harkov | 1.05 | 0.9 | 0.9 | 0.55 | 1.0 | 1.15 | no ballistic falloff (`world.ts:6885`) |
| Ceres Foundry | 0.92 | 1.05 | 1.25 | 1.1 | 0.85 | 0.95 | special pools cost 25% less/reload (`world.ts:3231`) |
| Kamenel | 1.15 | 0.85 | 0.95 | 0.8 | 1.05 | 1.05 | +15% muzzle speed (`world.ts:4623`) |

**The Mk-tier SIDEGRADE LAW** (`TIERS`, `arsenal.ts:37`) — no mark is strictly
better:

| Mk | dmg | spread | reload | clip | reserve |
|---|---|---|---|---|---|
| I | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 |
| II | 1.22 | 0.82 | **1.12 (slower)** | **0.8 (smaller)** | 1.0 |
| III | 1.5 | 0.62 | **1.25** | **0.62** | 0.85 |

Higher marks hit harder and group tighter but the **magazine shrinks and the
reload drags** — the "hot rod that feeds like a diva." A rookie's Mk I loses
nothing to a veteran's Mk III but taste.

**Fire modes** (`fireMode`, wired `world.ts:4340`): single, auto, burst2,
burst3, double (both barrels), pump — every mode is DPS-neutral by
construction. Bots bypass trigger discipline (perfect finger).

### 4.4 The sidegrade law, stated

Damage, RoF, clip, spread, reload and range all trade against each other so
that **DPS-per-cost stays flat across the table** (enforced by
`tests/sim.test.ts` balance ceilings). The brand picks a *behaviour*, the tier
picks a *feel*, the family picks a *role*. Class armories
(`CLASS_ARMORY`, `arsenal.ts:205`) gate which families each class may draw.

---

## 5. THE ASCENDANTS (Living Super Weapons) — `src/sim/lsw.ts`

40 LSWs. An LSW is a Soldier with `ascendant` set — same rig, same physics,
**ordinary bullets kill it**. Threat buys HP, never immunity. At most ONE per
faction on the field.

### 5.1 The threat table (`lsw.ts:35`, `THREAT`) — ● WIRED

The HP was **measured, not guessed** (trimmed ~36% from squad-only numbers so
1v1 duels resolve).

| Tier | Designation | **HP** | Materiel cost | Telegraph | What the tier promises |
|---|---|---|---|---|---|
| **1** | SKIRMISH | **800** | 1 | 15s | A squad of 4, ~6s of honest focus, brings it down. A new combination of systems that ship today. |
| **2** | STRONGPOINT | **1600** | 2 | 20s | Needs a fireteam's full attention; one new sim mechanic. |
| **3** | SIEGE | **3200** | 4 | 30s | A position the front has to stop for; real engine work. |
| **4** | EXTINCTION | **5800** | 7 | 40s | The whole front answers. **See gap below.** |

> **Doc vs code discrepancy:** `docs/ASCENDANTS.md §1.5` still prints T1 HP as
> **1200**. The **code says 800** (`lsw.ts:36`) — the code is truth; the doc is
> stale.

### 5.2 Roster distribution (all 40, `lsw.ts:87`)

| Threat | Count | Examples |
|---|---|---|
| **T1 SKIRMISH** (800 HP) | **9** | Volt Striker, Sniperhawk, Barrier, Venatrix, Voidwalker, Mirage, Blitz, Shadowstep, Specter |
| **T2 STRONGPOINT** (1600 HP) | **22** | Firebrand, Plaguebearer, Reactor, Oblivion, Tremor, Magnetar, Wraith, Eclipse, Dominator, Riptide, Pulse, Venom, Nightmare, Reaper, Crusher, Steel Weaver, Overload, Phantom, Cataclysm, Vanguard, Pyroclasm, Crimson |
| **T3 SIEGE** (3200 HP) | **9** | Frostbite, Ragebeast, Titan, Gravity Warden, Chronos, Inferno, Stormcaller, Gargoyle, Leviathan |
| **T4 EXTINCTION** (5800 HP) | **0** | — |

Each LSW also carries: `scale` (body size, ~1.25–1.6), `speed` (6–9),
`color` (no purple — house law), `energyRegen`, a signature `weapon`
(family `lsw`), `moves` (`leap`/`blinkwalk`/grounded), and per-moment announcer
lines. All ● WIRED.

> **GAP:** the **EXTINCTION tier is fully DECLARED (5800 HP, cost 7, 40s
> telegraph) but no roster unit uses it.** The top of the threat ladder is an
> empty promise today.

---

## 6. THE WORLD

### 6.1 Terrain heights (`TERRAIN_U`, `src/sim/map.ts:657`) — ● WIRED

**The height that we have right now** is exactly three levels, and they are
**non-linear on purpose** so mountains mean something:

| Level | World units | Band | Meaning |
|---|---|---|---|
| 0 | **0** | Ground | flat / out of bounds |
| 1 | **4** | Building (≈ WALL_H) | a rise, a rooftop |
| 2 | **16** | Sky | a mountain — ~4× a building, not 2× |

`SKY_LEVEL = 2` is the mountain band; rotorcraft cap here and **cannot fly over
a Sky mountain** — only jets cruising band 3 (clouds) clear it
(`world.ts:6155`). Terrain also occludes line-of-sight (`losClearTerrain`) and
governs vehicle landing shock. ● WIRED throughout.

### 6.2 Tile types (`map.ts:24`) — ● WIRED

31 tile constants. The load-bearing ones: `T_OPEN` 0, `T_WALL` 1 (blocks all),
`T_COVER` 2, `T_WATER` 3 (wade), `T_SLIT` 4, `T_DOOR` 5 / `T_DOOR_OPEN` 6,
`T_METAL` 7, `T_LADDER` 8, `T_DEEP` 9 (swim), `T_CLIMB` 10 (2.5u barricade),
`T_RUBBLE` 11, `T_GRASS` 12 (hides), `T_METAL_DOOR` 13 (toughest breach), thin
walls/doors 14–20, windows 21–24, stairs 25–28, section shutters 29–30.

### 6.3 The materials table (`src/sim/materials.ts`) — ● WIRED

One record per substance; every tile and every floor points at one. Key
numbers:

| Material | HP | Hardness | Drill | heavyOnly | ricochet | flammable | **walk sol/wheel/track** | slick | **grip** |
|---|---|---|---|---|---|---|---|---|---|
| Dirt | ∞ | 0 | 0 | no | 0 | no | 1/1/1 | — | 13 |
| Grass | 20 | 0 | 1.5 | no | 0 | **yes** | .85/1/1 | — | 12 |
| Wood | 60 | 0 | 1.5 | no | 0 | **yes** | — | — | — |
| Wood frame | 140 | 0 | 1.3 | no | 0 | **yes** | — | — | — |
| Earthwork (sandbag) | 80 | 1 | 1.2 | no | 0 | no | — | — | — |
| Masonry | 300 | 2 | 0.7 | **yes** | 0 | no | — | — | — |
| Stone | 600 | 2 | 0.4 | **yes** | 0.3 | no | — | — | — |
| Metal | 650 | 3 | 0.3 | **yes** | 0.8 | no | 1/1.05/1 | — | 14 |
| Metal door | 900 | 3 | 0.25 | **yes** | 0.6 | no | — | — | — |
| **Ice** | 100 | 1 | 1 | no | 0.6 | no | 1/.85/.9 | **yes** | **4.5** |
| Grit | ∞ | 0 | 0 | no | 0 | no | .92/.72/.9 | — | 9 |
| Wet | ∞ | 0 | 0 | no | 0 | no | .96/.9/.95 | — | 8 |
| Mud | ∞ | 0 | 0 | no | 0 | no | **.8/.6/.85** | — | **6** |
| Water | ∞ | 0 | 0 | no | 0 | no | — | — | 8 |
| Rubble | 120 | 1 | 1 | yes | 0 | no | .6/.6/.6 | — | 7 |
| Bedrock | ∞ | 3 | 0 | yes | 0.5 | no | — | — | — |

- **`grip`** is the boot-bite / drivetrain rate. Ice (4.5) barely holds; metal
  deck (14) grabs hardest. Consumed for soldiers `world.ts:3935` and vehicles
  `world.ts:6104`. ● WIRED.
- **`slick`** (ice only) makes momentum carry — the long glide. ● WIRED
  `world.ts:3945,6099`.
- **`walk` (sol/wheel/track)** — legacy per-surface speed via `SURF_*` tables
  (`map.ts:107`), still consumed at `world.ts:3870,6014`. ● WIRED.
- `hp`, `drill`, `heavyOnly`, `ricochet`, `flammable`, `impact` — all consumed
  by `damageWall`, the drill (`world.ts:6204`), fire spread (`world.ts:938`),
  and projectile surface reactions (`world.ts:6757`). ● WIRED.
- `hardness`, `penetrable` — ◐ mostly derived/informational; `penetrable` gates
  AP rounds through cover.

**Drill timing**: `DRILL_BASE / material.drill` seconds per tile — masonry
≈0.35s, metal ≈0.82s, metal door ≈0.98s (the toughest).

### 6.4 Weather (`src/sim/weather.ts`) — ● WIRED

7 skies. A front is a MODIFIER SET (vision × perception, drivetrain drag,
grounds aircraft). `visionMult` consumed `world.ts:2498` + `bots.ts:1033`;
`moveMult` `world.ts:3871,6019`; `airGrounded` `world.ts:6159`.

| Sky | vision× | soldier | wheels | tracks | grounds air? | zoom cap |
|---|---|---|---|---|---|---|
| clear | 1 | 1 | 1 | 1 | no | — |
| rain | 0.7 | .97 | .9 | .97 | no | — |
| storm | **0.42** | .92 | .8 | .9 | **yes** | 40 |
| fog | **0.3** | 1 | 1 | 1 | **yes** | 34 |
| snow | 0.5 | .9 | .82 | .88 | **yes** | 46 |
| dust | 0.55 | .96 | .78 | .93 | **yes** | 46 |
| night | 0.7 | 1 | 1 | 1 | no | — |

`MIN_VISION = 0.16` floor — even thickest murk leaves a knife-range read.
Each theme has its own allowed sky menu (`THEME_WEATHER`) — no snow in the
desert.

### 6.5 The day/night clock (`docs/THE-CLOCK.md`) — ● WIRED

One game day = **two real hours** (`world.ts:582`, ratio `time/7200`). Two
clocks: the **world clock** (menus) and the **field clock** (the sky you stand
under) — they drift when a match pauses. Night is **21:00–06:00**
(`clockNight`, `world.ts:594`). When a clock rides a match, **night is TIME not
weather** — dusk/dawn land when the clock says, mid-match if need be
(`world.ts:2469`), and a clocked world never rolls a random `night` front
(`world.ts:2485`). `clockRate` is controllable (freeze/scrub) and passed from
`main.ts:900`. Paintball/pro-shop/threat-room carry **no clock** (`hasClock`
false).

### 6.6 Per-theme gravity (`THEMES`, `data.ts:965`) — ● WIRED

`this.gravity = THEMES[theme].gravity` (`world.ts:688`), consumed by every
projectile arc and jump (`world.ts:4952,5011,6574`).

| Theme | Gravity | Gen |
|---|---|---|
| Savanna, Starship, Titan, Hardpan | 22 / 22 / 16 / 22 | field/corridors/field/armor |
| Asteroid | 14 | rocks |
| Europa, Triton, Winter | 9 | ocean/ice/field |

### 6.7 Perception constants (`src/sim/perception.ts`) — ● WIRED

`PERCEIVE_RANGE` 65 · cone half-angle 1.15 rad (~130°) · `RING` 9 (footsteps-
close, 360°) · `MUZZLE_REVEAL` 50 (a shot cuts fog) · `SEEN_LINGER` 1.5s
(3s geared, 5s max) · `TORCH_MULT` 1.35. Class linger: ghost 5, infiltrator 4,
pathfinder 3.5.

---

## 7. NATIONS (`src/data/nations.ts`) — the 4 doctrine stats

169 nations (auto-generated from the Consequences of Failure Country Master
Sheet). Each carries 4 doctrine stats (0–100) plus cloning/LSW policy.

| Stat | What it's meant to drive | What the code does with it | Status |
|---|---|---|---|
| **military** | how heavy your side arrives | **FACTION derivation** (`deriveFaction`), hometown-archetype weighting (`hometown.ts:114`), enlistment flavour text (`frontend.ts:374`, `hometown.ts:165`) | ● WIRED (identity layer) / ◐ (combat) |
| **intel** | recon/vision doctrine | faction derivation + display | ◐ DECLARED (no combat consumer) |
| **science** | tech doctrine | faction derivation, archetype weight (`hometown.ts:113`), city-profile (`city-profile.ts:164`) | ● WIRED (identity) / ◐ (combat) |
| **lswActivity** | how often gods walk your streets | faction derivation, hometown flavour ("gods walk here often", `hometown.ts:173`), display | ● WIRED (identity) / ◐ (combat) |
| cloning / lswReg (policy strings) | faction lean | **FACTION derivation** (unregulated LSW+cloning+science → Collective) | ● WIRED |

**What they now drive (honestly):** the doctrine stats DECIDE **your faction**
(`faction: NationFaction`, derived, not transcribed) and **colour the
onboarding** — the archetype you're assigned, the enlistment card, the hometown
line. **● WIRED for identity/onboarding.**

**What they do NOT yet drive:** the actual battle. There is no code that makes a
high-`military` nation field more armour in a match, or a high-`science` nation
bring better tech. That is the meta-layer's unbuilt job. **The `budgetMultiplier`
(`treasury.ts:99`) that opens your manifest reads the TREASURY balance, not the
nation's military stat.** So for combat, three of the four doctrine stats are
◐ DECLARED ONLY.

Also on each nation, ● WIRED into onboarding: `cities[]` (you pick a hometown →
archetype → 2 starting skills), `flag`, `nationality`, `faction`.

---

## 8. THE GAPS — DECLARED-but-does-nothing, ranked

This is the punchline. Ranked by how much the game *pretends* the stat matters
versus what the code does.

| # | Stat / system | Where it's declared | Why it's a gap |
|---|---|---|---|
| ~~1~~ | ~~5 of the 8 master stats~~ | — | **CLOSED 2026-07-23.** All 8 read by the sim; see §2.1. Guarded by `tests/stat-wiring.test.ts`. |
| **2** | **Master-stat DECAY ("use it or lose it")** | LOCKED in canon + `types.ts` comment | ○ UNBUILT — no decay code exists. Stats are set once at spawn, never move. The entire "generalist cap" balancing mechanism is prose. |
| ~~3~~ | ~~14 of 22 secondary skills~~ | — | **CLOSED 2026-07-23.** All 22 are both earnable and spendable; see the table in §2.4. The related defect — `skillForWeapon` reaching only 61 of 316 weapons — is closed with it. |
| **4** | **Per-hull CARGO CAPACITY** (Robert's pickup idea) | design intent only | ○ UNBUILT — no `cargoSpace` field. Every road hull shares the same flat 2-slot garage. The pickup's only edge over the tank today is mass/HP, not capacity. Needs a `VehicleDef.cargoSpace` number + a carried-load model. |
| **5** | **The EXTINCTION threat tier (T4)** | `lsw.ts:38` — 5800 HP, cost 7, 40s telegraph | Fully specified, **zero roster units use it.** The top of the god ladder is empty (roster is 9× T1, 22× T2, 9× T3). |
| **6** | **The Crusher Ram cargo** | `garage.ts:86` | ◐ — the item exists, adds 0.45t mass, but **no code reads `crusher` for the promised extra ram damage.** It's dead weight with a good blurb. |
| **7** | **Rail routes (train/subway)** | `types.ts:399` `rails`, defs in `data.ts:269` | The hulls and stats are real and boardable, but the **track generator (#65) is UNBUILT** — they are world dressing that can't drive a route. |
| **8** | **Nation combat doctrine (military/intel/science in a match)** | `nations.ts` | Doctrine stats decide faction + onboarding (wired) but **do not change what a nation fields in battle** — a high-military nation brings no extra armour. Meta-layer's unbuilt job. |
| **9** | **Command seat / doctrine package (Captain+ authorities)** | `ranks.ts:41`, `mayCommand` | ◐ — `mayCommand` is checked in the service UI but the full "take over all three battlegrounds / vote of confidence" command layer is largely UNBUILT. |
| **10** | **`VehicleDef.civilian` as a sim rule** | `types.ts:372` | ◐ — read only by the Codex and model picker; no *simulation* rule keys off it (the payload/traffic behaviours key off other flags). Harmless, but it's a flag that reads like it should gate something and doesn't. |
| **11** | **Hidden story-stats** (Fear, Discipline, Fame, Infamy, Loyalty, Squad Trust, Pilot Hours, Kill-Distance Record, Rescue Count, FF Incidents, Cities Liberated, Fronts Served, Campaign Tours…) | `THREE-GAMES-ONE-WAR.md` roster | ○ UNBUILT — named in canon as "stories, not power." Only Morale and (per-life) kill streak / longest-kill actually exist in code. The rest are prose. |

### The one-paragraph verdict

*(The original verdict is preserved below, struck through, because the shape of
the old gap is the most useful part of this document.)*

> ~~The character progression is where the gaps live: 5 of 8 master stats and 14
> of 22 skills are generated-and-shown but inert.~~

**As of 2026-07-23:** the fight was always honestly wired — class HP/speed, every
weapon number, the whole vehicle drivetrain, materials, weather, gravity, terrain
height, LSW threat HP, morale, rank authorities, licences and the garage all read
their numbers. **The character progression now is too:** 8/8 master stats and
22/22 skills reach the simulation, and the reticle finally reports the cone the
bullet actually flies through.

What is still genuinely empty is the **meta layer**, not the character: stat
decay, per-hull cargo capacity, the EXTINCTION T4 roster, nation doctrine in
combat, the command/doctrine-vote layer, and the ~14 hidden story-stats. Those
are named-but-empty and are honestly tagged as such below. Robert's original
complaint — "I never see evidence of the planned systems" — was correct for the
RPG layer, and is now correct only for the meta layer above it.

---

## 9. Tally — WIRED vs DECLARED-ONLY vs UNBUILT

Counting distinct stats/fields audited above:

| Bucket | Count | What's in it |
|---|---|---|
| **● WIRED** | **~90** | **all 8 master stats** · **all 22 skills** (earned + spent) · HP/armor/energy/energyRegen (4) · 8 class stat-rows · 7 movement verbs · 8 gun skills (via handSpreadMul) · hometown starting-skills · morale (band + 10 shifts + carry) · rank ladder authorities (leadership reach, mayCallStable, materielBonus) · 12 licences + enforcement · ~28 VehicleDef fields that drive · garage tires/engine/chassis + mine/oil/armour · weapon core fields (damage/rof/spread/clip/reload/range/splash/knockback/homing/falloff) · 6 brand signatures · Mk-tier curve · fireModes · LSW threat HP table · terrain heights · tile types · material grip/slick/walk/hp/drill/flammable/ricochet · 7 weather rows · day-night clock · per-theme gravity · perception constants · nation faction-derivation + onboarding |
| **◐ DECLARED ONLY** | **~5** | crusher ram · `rails` route · `civilian` sim-flag · nation military/intel/science/lswActivity *for combat* |
| **○ UNBUILT** | **~7 systems** | master-stat decay · per-hull cargo capacity · EXTINCTION T4 roster · full command/doctrine-vote layer · nation combat doctrine · the ~14 hidden story-stats · rail track generator |

**Headline (2026-07-23 re-audit): 8 of 8 master stats wired · 22 of 22 skills
wired, each both earnable and spendable · 267 of 316 weapons now train a trade
(was 61) · the reticle reports the true cone · the entire vehicle drivetrain
wired · 4 flags declared-but-inert · 7 named META systems unbuilt.**

**The audit is executable.** `tests/stat-wiring.test.ts` re-proves the two
questions — earnable? spendable? — on every run, so this file cannot quietly
become fiction again.

*Written from the source at the cited lines. When a number here disagrees with a
`docs/*.md`, trust this file — it was read out of the code.*
