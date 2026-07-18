# LIVING SUPER WEAPONS — the LSW roster
### SOURCE OF TRUTH. Supersedes DD §21.6 ("the Ascendants") and the old `LSW-ROSTER.md`.

> **The frame — Robert's law, and it overrides the older text everywhere:**
> **There are no heroes and villains. There are two factions, and each fields
> its own stable of Living Super Weapons.** Roster A belongs to **the United
> Front**, roster B to **the Collective**. When you fight the Collective,
> *their* LSWs drop on you; *yours* fight beside you. Same war, two arsenals.
> Wherever inherited spec text says "hero", read *UF LSW*; "villain", read
> *Collective LSW*. The file keeps the ASCENDANTS name for its §21.6 lineage;
> the units are **LSWs**.
>
> **The standard every unit is held to:** powers that create DECISIONS, not
> damage numbers · no duplicate identities · **nothing that takes control
> away from a human player** · every ability telegraphs · every counter maps
> to a system the game already ships · every LSW dies to ordinary guns. An
> unanswerable boss is a griefer we wrote ourselves.

---

## 1. Legend

| Status | Meaning |
|---|---|
| ⬜ | not started |
| 🔧 | in progress |
| ✅ | shipped (sim + bot brain + VFX + tests + live-verified) |
| 🧊 | shipped procedurally, awaiting Robert's GLB — never a blocker |

| Tier | Meaning | Cost |
|---|---|---|
| **T1** | new combination of systems that ship TODAY | days |
| **T2** | needs ONE new sim mechanic (which usually serves several LSWs) | ~a week per mechanic |
| **T3** | real engine work — new movement/physics/AI layers | weeks; sequence last |

**The shipped toolbox:** fire/smoke fields · quarantine gas · EMP · orbital
strike + beacons · warp gates + blink · knockback · tagged pings + psi scan ·
the §19 vision cone + §19.2 sound smudges · K9 noses · hacked turrets
(machine possession) · drones + the SAM/MANPADS/AA economy · downed/revive ·
the recorder/replay · **grenade bounce + the loft solver** · per-surface
movement (S_ICE!) · dynamic houses + drill-eats-wall rubble · drop pods ·
spawn protection · per-theme gravity · the announcer · **the run carry**.

---

## 1.5 THREAT LEVELS — the designation, and the balance behind it

Robert: *"We need balance, then threat level designations."* The threat level
is the LSW's **price, its telegraph, and the announcer's warning** — one
number that says how much of the front has to stop what it's doing.

**The baseline everything is priced against (measured, not invented):**
a trooper has **100 HP**; the AR-606 does **13 × 7.5/s ≈ 97 dps** on paper,
call it **~45 dps** in a real fight (cover, misses, reloads, being shot at);
the hardest thing currently on the field, a **brute, is 320 HP**. So one
rifleman ≈ 45 dps, a 4-man squad ≈ 180, a focused 12-man team ≈ 540.

| Threat | Designation | HP | ≈ brutes | Who has to answer it | Materiel | Telegraph |
|---|---|---|---|---|---|---|
| **1** | **SKIRMISH** | 1200 | 3.75× | a squad of 4, ~6s of honest focus | 1 | 15s |
| **2** | **STRONGPOINT** | 2600 | 8× | a squad + the right counter-pick, or a vehicle | 2 | 20s |
| **3** | **SIEGE** | 5000 | 16× | the TEAM, with heavy weapons — the front stops | 4 | 30s |
| **4** | **EXTINCTION** | 9000 | 28× | everyone, all-in, and you still might lose | 7 | 40s |

> **HP is MEASURED, not guessed** (Robert: "test to determine threat
> level"). The measurement rig is `tests/threat-measure.test.ts` — every
> shipped LSW is dropped against its DESIGNATED answer (T1 → a squad of 4,
> T2 → a squad + support (8, incl. the counter-pick), T3/T4 → the team of
> 12) with the pressure never lapsing, and the kill must land inside the
> tier's band. **The 2026-07-17 measured table (seed 42):**
> T1 — Sniperhawk 8.2s · Volt Striker 15.6s · Barrier 19.3s.
> T2 — Eclipse 8.8s · Oblivion 9.8s · Wraith 12.0s · Dominator 12.1s ·
> Plaguebearer 12.3s · Tremor 13.2s · Firebrand 18.0s · Reactor 23.6s ·
> **Magnetar 55.7s** (the anti-ranged identity, working).
> T3 — Frostbite 15.3s · Titan 20.5s · Ragebeast 23.7s.
> The rig already earned its keep: it caught Plaguebearer and Eclipse
> IMMORTAL inside their own smoke (fixed: an LSW is too big for smoke — the
> silhouette looms), Magnetar immortal on halo income (fixed: +0.5/bullet
> and the orbit saturates — one round in five leaks), Volt Striker WIPING
> his own answer (trimmed), and a NaN-intent bug that turned bots into
> untargetable ghosts (the seam sanitizer). These laws run in every suite —
> a regression that breaks a band fails CI.

**The laws that keep it honest:**
- **Threat buys HP, never immunity.** Every LSW dies to ordinary rifles —
  a T4 is 62 seconds of a full team's focused fire, which is an eternity in
  a firefight but never a locked door. No damage floors, no phase gates, no
  "you need the special weapon."
- **Bigger threat = longer telegraph.** A T4 announces 40 seconds before it
  lands. That's not mercy, it's the drama: both sides get the countdown, and
  the fight bends around it.
- **The officer pays.** Materiel cost scales with threat, so a T4 is the
  stable's whole afternoon. Dropping one is a decision, not a rotation.
- **These are DESIGN TARGETS, not final numbers.** Robert: *"test to fix
  bugs and to determine threat level."* Every LSW gets an empirical pass in
  the harness at build time — time-to-kill under a real squad, and the row
  below gets corrected to what actually happened. A number nobody measured
  is a guess wearing a uniform.

### The designations

| Threat | United Front | The Collective |
|---|---|---|
| **1 · SKIRMISH** | Shadowstep · Blitz · Mirage | Voidwalker · Venatrix |
| **2 · STRONGPOINT** | Vanguard · Firebrand · Volt Striker · Phantom · Sniperhawk · Pulse · Venom · Barrier · Riptide · Reactor | Nightmare · Plaguebearer · Tremor · Wraith · Crimson · Reaper · Specter |
| **3 · SIEGE** | Frostbite ⭐ · Gravity Warden · Inferno · Steel Weaver · Crusher | Oblivion · Ragebeast · Chronos · Pyroclasm · Eclipse · Magnetar · Overload · Gargoyle |
| **4 · EXTINCTION** | Titan · Stormcaller | Leviathan · Cataclysm · Dominator ⭐ |

*Read the shape:* the assassins and tricksters are **T1** — they're paper
between blinks, and their threat is the decision they force, not the HP bar.
The Collective is **top-heavy** (3 EXTINCTIONs to the UF's 2, 8 SIEGEs to 5)
— which is correct and canon: the machine army fields the horrors, the human
army fields the answers. **Balance lives in the counter, not the mirror.**

---

## 2. UNITED FRONT — roster A

| # | LSW | Role · Movement | Primary | Secondary | The decision it creates | Counterplay | Tier | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Vanguard** | breacher · ground | Shield bash: short charge, stuns + shoves; raised shield blocks frontal fire | Plants barricades that block bullets **for both sides** | Placement is the skill — his own wall can cage his team | Flanks; banked frags (they bounce now) | T1 | ✅ (bash + barricades SHIPPED: the bash charges, stuns (gun-lock 1.2s) and shoves the front cone — flankers behind the shield untouched (counterplay law). Barricades are shield domes with the new `bothSides` flag: they swallow EVERYONE'S rounds — his own wall can cage his own team. Threat MEASURED 15.0s vs 8) 🎮 pilot: Q = SHIELD BASH |
| 2 | **Firebrand** | zoner · ground | Fire streams that paint burning trails on the ground | Detonates every patch he's painted, **all at once** | You see the floor he owns: cross NOW or wait — he chooses when to cash the board | Don't stand in paint; rain douses it | T2 | ✅ 🎮 pilot: Q = CASH THE BOARD |
| 3 | **Volt Striker** | anti-cluster · ground | Chain lightning, arcs to 3 | Overloads a vehicle: detonates in 2s **unless the crew bails** | Punishes clustering; the crew decides — abandon armor or gamble | Spread out; bail fast | T1 | ✅ (chain lightning shipped: a bolt finds the nearest enemy, leaps to two more within arc range, decaying damage + an `emp` pop each; the FULL OVERLOAD shipped: the nearest enemy hull seizes and a **2s fuse** arms — it DETONATES unless every crew member bails (exiting is never blocked; only the escape-by-driving is). The doc's exact gamble, live) 🎮 pilot: Q = CHAIN LIGHTNING |
| 4 | **Shadowstep** | assassin · blink | Blink behind, stab | Departure point holds an explosive decoy — **blows on touch** | Chasing him IS the trap | Shoot the decoy at range | T1 | ⬜ |
| 5 | **Titan** | bruiser · huge, slow | **Grabs and throws vehicles** — crew included | Ground pound cracks cover to rubble, slows a cone | Starve him: keep armor out of his reach | Kite him — he's slow | **T3** | ✅ (grab+throw shipped: enemy vehicle → crew ejected & flung, hull launched/stunned/cracked; else nearest soldier hurled. Pound = AoE damage + knockback + digTile cover-crack. The "slows a cone" ships as a **fire-rate stagger** — a true movement-slow status is a Notes gap the engine still lacks) 🎮 pilot: Q = SEISMIC HANDS |
| 6 | **Frostbite** ⭐ | controller · ground | **THE ICE BLOCK** (§4.2) — encases a soldier alive | Ice sheets — vehicles genuinely spin out (S_ICE) | The encased player: struggle out hurt, or hold still and outlast. Freezing their star also **saves** him — timing is everything | Stay near squadmates who can shatter you free | T3 | ✅ COMPLETE (encase core + the block is a real BLOCK now: an encased soldier stops movement — nobody walks through a frozen man; rounds already stop on the shield) 🎮 pilot: Q = aimed freeze |
| 7 | **Phantom** | infiltrator · hover, silent | Phases through walls, strikes out of them | Possesses a **bot/turret/vehicle** 3s — never a human | Your own machines become the threat | K9 noses smell him; psi scanner | T2/T3 | ✅ (the phase + the ride SHIPPED: he walks INTO the wall he faces and out the far side (runs up to 3 tiles), blade first — 50 to whoever camped the safe side; and the RIDE takes the nearest enemy BOT / turret / vehicle for exactly 3s (team flips, expiry hands the chassis home, EMP evicts INSTANTLY — and the API refuses flesh, law-tested). K9 COUNTER is real: a nose within 12u of the exit BLOWS the strike and his cover. Threat MEASURED 12.4s vs 8) 🎮 pilot: Q = THE PHASE |
| 8 | **Sniperhawk** | marksman · perches | Piercing rail through bodies + thin cover, **visible laser telegraph between shots** | Marks a point; artillery erases it | The laser tells you where he is — close the gap between shots | Rush him during the telegraph | T1 | ✅ (piercing rail shipped: a hitscan line, LOS checked per-target so bodies never shield each other — pierces the whole line, 90 dmg each, rail tracer VFX. Artillery mark = shipped Orbital Designator, 3s arm → strike. Cover/walls stop the rail — through-thin-cover 🔧; persistent between-shots laser sight 🔧) 🎮 pilot: Q = PIERCING RAIL |
| 9 | **Gravity Warden** | controller · levitates | Pull-field, then slam | Reverses gravity: enemies float 2.5s, then drop staggered — **they can still shoot** | Floating: panic-fire or hold discipline | Kill him mid-channel to end it | T2 | ✅ (pull-then-slam on the shared FORCE FIELDS — a 1.2s tug telegraph, then the cash; REVERSE GRAVITY ships as the new lift state: floated men drift at ~2.2u, CAN STILL SHOOT, and drop STAGGERED. Threat MEASURED 21.4s vs the team; counterplay law: his death never gifts a kill — the float ends on schedule) 🎮 pilot: Q = REVERSE GRAVITY |
| 10 | **Inferno** | skirmisher · **TRUE FLIGHT** | Dive-bombing fireballs | Burning aura: anyone within 6u cooks | Flight is his power AND his exposure | SAMs, MANPADS, small arms | **T3** | ✅ (TRUE FLIGHT + dive-bombs SHIPPED: he cruises at 5.2 — over every wall — and the DIVE-BOMB trades the sky for the crater: an 80%-gap plunge, a 55-point fireball, fire that stays, and 2.4s COMMITTED LOW where every rifle owns him. The burning aura is a THREE-dimensional six: cruise spares, descent cooks (law-tested). SAMs lock him aloft (the tube answers the sky, law-tested); dive under the seeker and it flies dumb. AI-only by D3. Threat MEASURED 50.1s vs 12) 🤖 AI: the sky, on a duty cycle |
| 11 | **Steel Weaver** | tank · ground | Rips a T_METAL panel from the map, carries it as a tower shield — **the team loses that wall** | Assembles panels into an exosuit: +armor, +damage, loud, slow | His defense literally costs the map | Flank the noise | T2 | ✅ (the panel + the suit SHIPPED: he RIPS the nearest T_METAL tile out of the map (the wall is GONE for everyone — his defense costs the team the terrain, law-tested) and wears it as plate (+80, the one exception to plateless LSWs); the EXOSUIT stacks panels into +120 armor and a 1.25x force channel on a timer. Threat MEASURED 23.6s vs 8 — the tank dies slow, as built. The loud-and-slow suit penalty 🔧) 🎮 pilot: Q = RIP A PANEL |
| 12 | **Pulse** | recon · ground | Sonic wave staggers + pings victims **through walls**, footsteps map-wide | Deafening burst: disables vehicle controls and **mutes the enemy's sound cues** | In this game, muting ears is blinding half their information | Dodge the visible wave | T1 | ✅ (the wave + the burst SHIPPED: the sonic wave staggers and TAGS everyone in 16u THROUGH WALLS (the shipped tag-pin, 5s on every enemy screen — ears beat eyes, law-tested through masonry); the deafening burst stalls enemy hulls in 18u. Counterplay law: past the ring, untouched. Threat MEASURED 16.7s vs 8. Enemy sound-cue MUTE is a client detail 🔧) 🎮 pilot: Q = SONIC WAVE |
| 13 | **Venom** | attrition · ground | Poison volley → contamination zones (quarantine canon); poisoned enemies **leak a visible trail** | Acid glob eats armor plate | Pressures the support economy | Medics cleanse | T1 | ✅ (volley + acid SHIPPED: contamination lobbed on the nearest knot (smoke + acid pairs, quarantine canon); anyone standing in HIS fog is TAGGED — the poisoned leak a visible trail (law-tested). The ACID GLOB dissolves the aimed plate WHOLE (+20 bite). Out of reach = untouched (law). Threat MEASURED 10.1s vs 8) 🎮 pilot: Q = ACID GLOB |
| 14 | **Blitz** | momentum · dash | Dash-strike; each kill inside 1.5s **refunds the dash** | His last two dash paths replay as damaging afterimages (**the recorder, weaponized**) | Break his chain or he never stops | He's paper between dashes | T1/T2 | ✅ (dash + afterimages SHIPPED: the dash-strike closes 16u onto the aimed mark and cuts for 60 — a KILL refunds the dash on the spot (the chain is the character); the AFTERIMAGES replay his last two dash paths as damaging lines off his own lswTrail — the recorder, weaponized. Whiffs never blink him. Threat MEASURED 14.2s (T1)) 🎮 pilot: Q = DASH-STRIKE |
| 15 | **Barrier** | zoner · ground | Projects an energy wall | 2s **REFLECT**: returns projectiles to their shooters (grenade-bounce math + re-team) | Shoot and it's your bullet — the wall telegraphs | Bait it; lob over the top | T1 | ✅ (shipped as ONE cast: Q projects a shield-dome wall down his aim whose first 2s REFLECT approaching enemy fire — velocity reversal + re-team to Barrier in the projectile step, so the round flies back at its shooter; after the window it swallows like a normal dome. New `Gadget.reflect` flag, guarded so the Heavy's dome is untouched) 🎮 pilot: Q = ENERGY WALL |
| 16 | **Riptide** | counter-pick · water-strong | Traveling wave shoves a line back **and extinguishes fire** | Whirlpool traps a circle; **doubled on real water** (Port, Bridge Delta, the leads) | The answer to every flame character | Leave the painted circle early | T2 | ✅ (BOTH abilities on the shared FORCE FIELDS: the wave is a 0.8s directional current + a corridor fire-purge (every flame in its path dies with a hiss); the whirlpool is a painted radial pull, −4 dry / **−8 on real water**, gravlift-telegraphed. Bot waves when enemies or enemy fire crowd his front, whirlpools on the slow play; pilot Q = THE WAVE. Threat MEASURED in-band, counterplay law: leave the circle early) 🎮 pilot: Q = THE WAVE |
| 17 | **Crusher** | bruiser · ground | Charging smash straight through cover | Hurls terrain that **becomes new cover where it lands** | He remodels the map — for whoever's smart enough to use it | Bait the charge into a wall: self-stun | T2 | ✅ (charge + hurl SHIPPED: the charge smashes 10u through COVER (DESTRUCTION does the paperwork), bulldozes the lane, and a STRUCTURAL WALL wins — it stops him and stuns HIM (bait-the-charge, law-tested). The hurl turns bare ground downrange into NEW T_COVER — hop-clearable, so reachability survives what he builds. Threat MEASURED 14.2s vs 8) 🎮 pilot: Q = THE CHARGE |
| 18 | **Mirage** | trickster · ground | Up to 3 walking, fake-firing decoys | Swaps places with any decoy instantly | Which one is real? | **Dogs ignore decoys; decoys make no footsteps** — senses tell the truth | T1 | ✅ (decoys + the swap SHIPPED: up to three 1-hp, no-plate illusions wear her face and fake-fire muzzle theater; a POP never crawls (decoys skip the downed state); the swap trades places with the nearest one instantly. Threat MEASURED 20.0s (T1). Dogs-ignore + no-footstep-audio client details 🔧) 🎮 pilot: Q = THE SWAP |
| 19 | **Stormcaller** | zoner · **TRUE FLIGHT** | Seeds a roaming tornado that flings soldiers skyward | 8s lightning storm over an area — **both sides beware** | Her own team eats bolts too | AA; fight indoors — roofs block bolts | **T3** | ✅ (the tornado + the storm SHIPPED: a ROAMING suction twister (a moving force field — deterministic wander) that FLINGS anyone in the core skyward via the lift state; and 8s of lightning that BOTH SIDES eat — her own team included, law-tested — while EAVES shelter (wall-adjacent tiles have no open sky: 'fight indoors' is real code). CONDUCTING IS WORK: the rig proved a 2s casting swoop bought immunity, so she now stays at gun height the whole 8s the storm rains. AI-only by D3. Threat MEASURED 129.7s vs 12 — the tankiest T3, by identity) 🤖 AI: the weather, with a work ethic |
| 20 | **Reactor** | support · ground | Charged nova — longer charge, bigger risk window | **Overcharges an ally's next attack** (an overcharged Frostbite freezes a three-wide line) | Kill the battery first | Focus him, not the carry | T2 | ✅ (nova + overcharge shipped: the nova is an AoE burst around him; the overcharge pours the shipped `rageMul` channel into the nearest ally so their outgoing damage + step run hot for 6s, handed back when a new `overchargeUntil` window expires. Bot novas + feeds; a human pilot feeds the nearest ally on Q, or novas when alone. The overcharged-Frostbite-3-wide-line flavor is 🔧) 🎮 pilot: Q = OVERCHARGE / NOVA |

## 3. THE COLLECTIVE — roster B

| # | LSW | Role · Movement | Primary | Secondary | The decision it creates | Counterplay | Tier | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | **Oblivion** | zoner · levitates | Void bolts that lob over any cover (**black with a white rim — house law: no purple**) | Black hole drags soldiers AND vehicles to a collapse point, then bursts | 1.5s telegraph: run tangentially or die | Sprint across the pull, never against it | T2 | ✅ (void bolts shipped: arcing `void_bolt` rounds that lob over cover and burst with splash; the black hole opens a collapse point, drags enemy soldiers + CREWED hulls inward with a sustained inward impulse across a 1.5s telegraph — sprint TANGENTIALLY to escape — then `explode`s. Body is black-and-white, no purple. The exact black/white-rim bolt art is 🔧) 🎮 pilot: Q = BLACK HOLE |
| 2 | **Ragebeast** | bruiser · ground | Rampage: **damage taken feeds his speed and power** | Tears his own armored flesh (costing HP) and hurls it as homing projectiles | Burst him or starve him — half-measures feed him | Disengage; deny the rage | T3 | ✅ COMPLETE (rampage: speed + damage scale wounded, capped 1.5×; flesh-hurl SHIPPED: wounded past a quarter he tears 25 HP of his own flesh and hurls homing globs (`homingSoldierId`, turn-capped — sidestep hard and they overshoot) at the two nearest enemies — the wound IS the magazine) 🎮 pilot: Q = GROUND SLAM |
| 3 | **Nightmare** | disruptor · ground | Fear pulse: **vision cones shrink**, false red pings litter the minimap | Blinds one target 2s — **ears still work** | Trust your ears or trust a lying map | Fight by ear (§19.2 trained you for this) | T1 | ✅ (fear + THE BLIND shipped: the pulse litters every nearby enemy's net with THREE false psi-contacts each — the map lies; THE BLIND puts one set of eyes out for exactly 2s (a blinded bot cannot acquire targets — findTarget law) and ALWAYS expires ('fight by ear' is a real window, law-tested). Vision-cone shrink 🔧. Threat MEASURED 8.1s vs 8) 🎮 pilot: Q = THE BLIND |
| 4 | **Chronos** | controller · ground | Slow-time bubble: bullets crawl, movement drags — **walk through a frozen bullet-wall** | Temporal echo: on lethal damage he snaps back 3s, once per fight — **the echo point glows** | Burst him now, or camp the glow | Camp the echo point | T2 | ✅ (the bubble rides TIME FIELDS — movement and rounds at 0.35x, he walks through untouched; the TEMPORAL ECHO lives in damageSoldier: a lethal hit snaps him to his 3s-old breadcrumb ONCE, arriving at a 12% sliver — and the breadcrumb GLOWS gold the whole time, so camping it is real. Threat MEASURED 15.3s vs the team) 🎮 pilot: Q = TIME BUBBLE |
| 5 | **Plaguebearer** | attrition · ground | Toxic clouds (quarantine canon) | Infects a vehicle — it trails poison as it drives | The crew chooses: abandon the tank, or drive the plague wagon | Park it; engineer cleanse | T2 | ✅ COMPLETE (cloud + vehicle-infect SHIPPED: the nearest crewed enemy hull in 14u catches a 14s plague — while it DRIVES it trails poison fields, so the crew chooses: park it or spread it. An engineer's field repair CLEANSES — the kit now treats a full-HP infected hull as a patient) 🎮 pilot: Q = QUARANTINE RING |
| 6 | **Leviathan** | boss · massive | Terrain-flattening sweeps | **Belly flop**: map-scale leap, shadow-telegraphed landing, rim shockwave | Scatter from the shadow — and he's soft mid-air | Hit him in the air (the AA window) | **T3** | ⬜ |
| 7 | **Pyroclasm** | zoner · ground | Molten rocks leaving long-lived lava pools | **Erupts at 25% HP** — the room decides | Burst through the threshold, or poke and pray | Range the threshold; Riptide douses him | T1 | ✅ (magma + the threshold SHIPPED: molten rocks are arc rounds on the shipped fire payload — every landing leaves a burning pool; at 25% HP he ERUPTS exactly once (12u burst + a lava ring). 'Range the threshold' is law-tested: 26% never triggers. Threat MEASURED 12.1s vs 8) 🎮 pilot: Q = MAGMA VOLLEY |
| 8 | **Voidwalker** | assassin · blink | Teleport strikes | Every blink leaves a shadow clone that **detonates after 1s** | Chase him and walk a cluster bomb | Hold ground; don't follow | T1 | ✅ (blink-strikes SHIPPED: vanish, arrive at arm's length behind the aimed mark, cut for 55 — and the DEPARTURE point holds a 1s-fuse shadow on the shared burst timer. 'Hold ground, don't follow' is law-tested: the chaser eats the shadow, the holder never does. Threat MEASURED 10.2s (T1). Clone visual mesh 🔧) 🎮 pilot: Q = BLINK-STRIKE |
| 9 | **Tremor** | siege · burrow | Earthquake stomps: stagger + shaken aim | Burrows; a **visible soil ripple** races forward and erupts in spikes | Sidestep the ripple — you can see it coming | He's deaf underground | T2 | ✅ (stomp + ripple shipped: the earthquake stomp is an AoE burst — damage + knockback + a fire-rate **stagger** standing in for "shaken aim"; the soil ripple is a slow, low `soil_spike` round lobbed at the nearest enemy that bursts into spikes where it lands — you see it coming, sidestep it. Bot stomps a close crowd, else ripples; a human pilot stomps on Q. The movement/accuracy "shaken aim" + true burrow-underground are 🔧) 🎮 pilot: Q = EARTHQUAKE STOMP |
| 10 | **Wraith** | thief · levitates | Possesses vehicles/turrets/bots — **never your body** | Drains possessed machines to heal himself | Destroy your own tank to deny him, or duel it | **EMP evicts him instantly**; empty your vehicles | T1/T2 | ✅ (possession shipped: he SEIZES the nearest enemy sentry turret (team flip — the shipped hack, so EMP/re-hack evicts) and STALLS the nearest enemy vehicle (EMP), draining a heal from each take. Bot possesses on a cadence; a human pilot on Q, whiff-safe. Driving a possessed vehicle & taking an enemy BOT are 🔧) 🎮 pilot: Q = POSSESS |
| 11 | **Crimson** | attrition · ground | Life-drain beam | Consumes a blood pool (from nearby deaths) to raise **one** blood brute | Deny his economy or fight two | **Burn the pools** — fire denies him | T1 | ✅ (drain + the rite SHIPPED: the leech ticks the nearest enemy in line (10/tick, half comes home); a fresh corpse within reach raises ONE 320-hp BLOOD BRUTE — only one walks at a time, a drunk pool is never drunk twice, and a corpse lying in FIRE can never be consumed ('burn the pools' is law). Threat MEASURED 30.4s vs 8) 🎮 pilot: Q = BLOOD RITE |
| 12 | **Eclipse** | controller · levitates | Moving dome of darkness — vision drops to arm's length inside | **Asymmetric sight**: he sees everything in the dome; nobody sees in or out | Inside, ears are eyes | Dogs, psi scanners, sound | T2 | ✅ (darkness dome shipped on the smoke-vision system: she TRAILS a smoke dome as she drifts (moving darkness) and BLOOMS a full ring of it on Q — vision dies through it (`smokeBlocks`), so ears/dogs/scanners are the counter the doc promises. The **asymmetric** "she sees through it" is 🔧 — for now the dark blinds everyone inside) 🎮 pilot: Q = DARKNESS DOME |
| 13 | **Magnetar** | anti-ranged · ground | Bullets curve into a harmless debris orbit around him — **melee, energy, and arcs pass clean** | Magnetic pulse: guns jam mid-reload, metal vehicles stall | Ranged fire FEEDS his halo — change weapons or close | **Frags don't care** (and yours bounce now) | T1/T2 | ✅ (halo + pulse shipped: in the projectile step, a straight enemy BULLET that reaches his 4u field is absorbed AND feeds him +HP — energy (plasma/rail), arcs (grenades), and melee pass clean, so close or switch weapons. The magnetic pulse jams nearby enemy guns (fire-rate lock + stuck reload) and stalls metal vehicles. Bot pulses on a cadence; a human pilot on Q) 🎮 pilot: Q = MAGNETIC PULSE |
| 14 | **Venatrix** | trapper · ground | Snap-traps that hold a soldier fast (**the ice block's little sister** — same state) | Harpoon reels one enemy to her through the open | The tether has HP: **shoot your teammate free** | Spot the glint | T2 | ✅ (snap-traps SHIPPED on the shared ENCASE — a sprung trap is literally THE ICE BLOCK: teammates shatter, struggling hurts; jaws render with ONE GLINTING brass tooth (the counter), spent on the spring, 3 armed at a time. The HARPOON reels the aimed enemy across the open with a biting barb — live-proven by reeling the actual human player. Threat MEASURED 7.2s (T1 band). Tether-HP shoot-your-teammate-free is 🔧) 🎮 pilot: Q = HARPOON |
| 15 | **Overload** | ambusher · ground | Arc bursts | Becomes pure current, travels **connected metal** — walls, vehicles, turrets — emerging anywhere on the circuit | The Refinery, the Port, the Blacksite are HIS maps | **Fight him on dirt** | T2/T3 | ✅ (arc bursts + BECOME CURRENT shipped: the burst jolts everyone in 8u; the current rides the CONNECTED METAL — a real BFS over touching T_METAL tiles — and emerges at the circuit's far end. 'Fight him on dirt' is law: no metal within reach, no trick at all. Threat MEASURED 12.0s vs 8) 🎮 pilot: Q = BECOME CURRENT |
| 16 | **Gargoyle** | skirmisher · **TRUE FLIGHT** | Screaming dive slams — **the shriek is the telegraph** | Perches on a roof as a stone turret: half damage while perched | Rush the perch or answer the sky | AA; collapse the perch | **T3** | ✅ (the shriek + the perch SHIPPED: the SCREAM is a real 0.8s telegraph — zero damage until the promise lands ON the marked point (law-tested), then a 55-point slam, a shove, and 2s grounded in his own crater. Hurt, he PERCHES on masonry at HALF damage — and DESTRUCTION is the counter: collapse the tile (damageWall) and he falls stunned at FULL price, law-tested. SAMs lock him aloft. AI-only by D3. Threat MEASURED 65.9s vs 12) 🤖 AI: the roof, disputed |
| 17 | **Reaper** | duelist · ground | Chain pull into scythe combo — **the chain grabs the first body** | Marks a target for double damage — **the mark shows on your HUD** | Tanks can eat the pull for the squad; you know you're hunted | Bait him into the guns | T1/T2 | ✅ (chain + THE MARK shipped: the chain grabs the FIRST body on the line — law-tested: the tank eats it for the squad — and reels it into a swinging scythe (44-impulse + 45). THE MARK doubles the hunter's OWN blows on one target for 8s and makes them public (tagged) — the victim KNOWS; the mark itself deals no damage (law: being hunted is information). Threat MEASURED 7.8s vs 8) 🎮 pilot: Q = THE CHAIN |
| 18 | **Specter** | trickster · ground | Mirror images converge on you | All images detonate **on his command** | The guessing game has a fuse | **Only the real one casts a shadow**; dogs know | T1 | ✅ (images + THE COMMAND shipped: up to three 1-hp mirror images on the shared decoy system — they WALK and hunt like bots; DETONATE bursts every image at once (the bot cashes when enemies stand among them). Counterplay law: popping an image at range is never a blast — only the command is. Threat MEASURED 12.2s (T1)) 🎮 pilot: Q = DETONATE |
| 19 | **Cataclysm** | siege boss · massive | Huge, slow area slams | While he lives, seismic eruptions fire map-wide, **worsening the longer he's up** | A DPS check that punishes stalling — the announcer counts the quakes you survived | All-in focus | T2 | ⬜ |
| 20 | **Dominator** ⭐ | finale · levitates | Psychic lance — a piercing line | **PSYCHIC LINKS**: visible threads chain up to 4 soldiers; damage one and every linked soldier takes 60%. **He can link YOUR squad to each other** | Your own tight formation becomes his weapon — positioning IS the fight | Scatter beyond thread range, or melt as a group | T2 | ✅ (lance + links shipped: the psychic lance is a piercing hitscan line; the LINKS bind up to 4 nearby enemies onto one thread (new `psiLinkId`/`psiLinkUntil`), and `damageSoldier` shares 60% of any hit across the whole group — your tight squad becomes his weapon, scatter beyond ~18u or melt together. Bot lances + links; a human pilot links on Q, lance if no cluster) 🎮 pilot: Q = PSYCHIC LINK |

---

## 4. ENGINE FIRST — build before any character

### 4.1 The LSW entity
- `ascendant?: AscendantId` on `Soldier` — **replicates for free** (the snapshot
  spread law: a new field on Soldier rides the wire with no codec edit).
- Soldier-like, big HP pool, its own brain file, faction-flagged (an LSW is
  simply on team 0 or team 1 — no third allegiance).
- **At most one LSW per faction on the field.** OFF in paintball / range /
  onboarding (the yard stays the yard).
- Arrives by **drop pod** (system ships) with an announcer line. Killing one
  pays score + a Journal line (§21.6 canon).

### 4.2 THE ICE BLOCK ⭐ (shared: Frostbite, Venatrix, all future stasis)
The flagship mechanic. Build it **once**, correctly:
- An encased soldier becomes a **real 1-tile block**: blocks movement AND
  shots, **both ways** (it is cover — for both sides).
- **Inside, the player chooses:** hold still → HP drains very slowly (outlast
  it); struggle (any move/fire input) → out in ~4s but **arrives badly hurt**.
  Die slow, or gamble.
- **Teammates shatter the block by shooting it** → instant, free release.
- **Encased soldiers cannot be hurt by anything else.** Freezing an enemy
  briefly *saves* him — freezing their star mid-firefight takes him off the
  board and protects him. **Timing is the entire skill.**
- Gone at round/match end. Never applied to a human without an escape.

### 4.3 Status scaffolding
`slow` · `stun` (short stagger) · burn-zone (reuse `fire_field`) ·
`visionShrink` (the perception budget is already a number — crush it) ·
`damageLink` (Dominator) · `mark` (double damage, shown on the victim's HUD).

### 4.4 The shared mechanics that unlock 17 LSWs
1. **ENCASE** ✅ → Frostbite ⭐, Venatrix (+ future stasis). *Shipped.*
2. **FORCE FIELDS** ✅ (2026-07-17) → Gravity Warden, Riptide, Oblivion,
   Stormcaller's tornado. *Shipped:* `World.forceFields` — sustained radial
   pulls/pushes (`radial` ± ) and directional currents (`fx`,`fz`),
   re-applied every tick so they survive the impulse decay. Laws: the
   owner's team is exempt; only CREWED hulls move (§8.1a); the radial term
   dead-zones at the singularity so currents still flow at center.
   Oblivion's black hole now RIDES it (a radial −5 field on the burst
   timer). Gravity Warden's pull-then-slam, Riptide's push wave, and the
   tornado are field pushes + one ability wrapper each.
3. **TIME FIELDS** ✅ (2026-07-17) → Chronos. *Shipped:* `World.timeFields`
   zones scale POSITION ADVANCE for movement and rounds (`timeMulAt`) — never
   the clock; the sim stays deterministic 30Hz. A slowed round's fuse clock
   stretches (`bornAt` slides) so it neither cheats its timer nor dies short.
   The field's OWNER walks free — he strolls through his own frozen
   bullet-wall. Chronos just has to call it.
4. **MACHINE POSSESSION** ✅ (2026-07-17) → Phantom, Wraith. *Shipped:*
   `possessMachine` — a TIMED take (team + guns flip, the machine remembers
   whose it was), expiry hands it home, and **an EMP burst evicts
   INSTANTLY** (empBlast). **Never humans — the API only takes machines.**
   Wraith rides it (12s holds). Phantom CLOSED the open items (2026-07-17):
   `possessBot` (the 3s enemy-bot ride — team flips, NEVER a human, the API
   refuses flesh) and `possessVehicle` (the hull's guns serve the ghost).
   Expiry hands everything home; EMP evicts all three shapes instantly.
5. **TRUE FLIGHT AI** ✅ (2026-07-17) → Inferno, Stormcaller, Gargoyle
   (exactly the three fliers). *Shipped as a movement law, not an overlay:*
   `Soldier.flightAlt` commands the altitude, the body climbs toward it, and
   above the wall tier (y > 4.05) NOTHING on the grid blocks a flier — §8.7's
   height vocabulary gains its final tier. EXPOSURE IS THE PRICE: bullets
   live at chest height, so every attack run is a descent into range, and
   the brains run duty cycles (cruise → strike → committed low). SAMs and
   MANPADS lock a TRUE-FLIGHT body like any aircraft (`samLockTarget` scans
   airborne LSWs; the missile rides the homing-soldier seam at full SAM turn
   rate and chases ALTITUDE — dive under 1.5 and the seeker head loses you).
   D3 stands: `ascendSoldier` refuses a human hands on a flier, by law.
6. **DESTRUCTION** ✅ (2026-07-17) → Titan, Crusher, Tremor, Leviathan (+
   every tank). *Shipped as tile-state, not physics:* masonry carries an HP
   ledger (`damageWall`); the ladder runs intact → damaged → **T_RUBBLE**
   (walkable-SLOW, knee cover, eyes clear) → gone. **TIERED** — soft cover
   breaks under real splash, STRUCTURAL walls breach only under HEAVY fire
   (damage ≥ 100: the 120mm, demo charges; grenades never), METAL and the rim
   never break. **MONOTONIC** — destruction only ever OPENS paths, so the
   fronts' reachability law survives any sequence by construction. Breaches
   ride the wire like `dug` (`World.breached` → snapshot). Debris is
   renderer-side, pooled, capped at 240 chunks. Live-proven: three tank
   shells breached a house wall and a soldier walked through the hole.

---

## 5. Special AI — one brain per LSW
The sim already runs per-kind brains (`stepBot` / `stepZombie` / `stepDog` /
`stepScientist`). LSWs slot in as **new kinds with one brain file each**:
`src/sim/lsw/<id>.ts`, sharing a small `LswBrain` toolkit (target selection,
ability cadence, retreat thresholds, telegraph timers).

**Laws:** deterministic · DOM-free · every ability emits a telegraphed
SimEvent (**the counter-play IS the telegraph**) · an ability the AI never
uses doesn't exist — the brain ships with the character, not after.

---

## 6. Deployment — the officer calls it ✅ (core shipped; economy pending)

Robert's design, and it's right. What's LIVE in `world.requestLsw`:
- **The call is telegraphed and DELAYED** — `pod_incoming` announces to both
  sides, then **15–40s of dread by threat tier**, then the pod lands. ✅
- **One per faction** — live OR inbound, the slot refuses a second. ✅
- **A human caller plants the LZ where they stand** and ascends into the
  body at landing (§7). A bot call (or a forfeited pod) spawns the stable's
  own pilot at the mark. ✅
- **The bot officer**: humanless factions call their own stable on a
  45s radio-check cadence from ~90s; factions with a human never
  auto-call. ✅
- Still pending: LSWs as **War Materiel (§17)** — campaign stock, per-front
  stables, the materiel price per threat tier (the THREAT table already
  carries the numbers). Some recipes **starting** with an LSW on the field
  (siege/boss: Cataclysm). Dropping the enemy's LSW = Materiel + a medal +
  a Journal line.

### 6.1 How you BECOME an officer — ⚠️ OPEN, needs Robert
§7 promises the chain of command; onboarding already shows an **OCS** card;
**no officer system exists in code.** This is a design fork, not an
implementation detail — see §13 Q2.

---

## 7. PLAYING AS AN LSW — ✅ SHIPPED (the ground stable; fliers wait for flight)
Robert: *"we need to be able to play as LSWs in a way that is fun and fits
our game."* Shipped 2026-07-17 for every ground LSW in the stable. The
design is **the ascension**, and it fits because it reuses the game's own
laws — the officer call, the telegraph, the one-slot economy — instead of a
character-select screen:

**The pilot loop:**
1. **V calls your faction's first LSW, ⇧V the second** (the officer channel;
   a HUD line tells you the binds at deploy). One call per faction slot —
   live or inbound — same law the bots obey.
2. **The LZ is WHERE YOU STAND.** Your call plants the mark under your own
   boots: hold that ground through the telegraph (15–40s by threat) while
   the whole server watches the countdown. Calling from a safe corner means
   ascending in a safe corner — the risk is the price of the spot.
3. **The pod turns YOU into the weapon.** If you're standing at landing —
   alive, not downed, not frozen, not in a vehicle — your trooper vanishes
   in the pod flash and the LSW stands up with your name on it. Same
   soldier id: your killfeed, your record, your body. 2s of pod-flash
   protection so the landing is an entrance, not an ambush.
   - Dead **at the moment of landing** forfeits: the stable sends its own
     pilot (a bot LSW) — the call is never wasted. Die and RESPAWN before
     the pod hits and it's still yours.
4. **Q is the SIGNATURE, not the class kit** (the class ability is
   suppressed while ascended — an ascended medic doesn't self-stim). Whiffs
   never burn the cooldown. The passives run themselves — walking IS the
   weapon:
   | LSW | passive (automatic) | Q (yours) |
   |---|---|---|
   | Firebrand | paints burning floor as you move | **CASH THE BOARD** — every patch erupts at once (8s) |
   | Frostbite | — | **THE ICE BLOCK** — freeze the soldier you're *aiming* at, 20u cone + LOS (4s) |
   | Plaguebearer | lays contamination as you move | **QUARANTINE RING** — a wall of plague around you (10s) |
   | Ragebeast | rampage: speed+damage climb as you bleed | **GROUND SLAM** — hurts and THROWS everyone close; harder the more you bleed (6s) |
5. **Death hands the body back.** The overlay dies with the LSW; you
   redeploy as the class you signed up as. One life per call — the LSW is
   an event, not a loadout.

**The bot officer:** a faction with NO human on its roster calls its own
stable (radio checks from ~90s, every 45s, seeded pick). A faction WITH a
human never auto-calls — the channel is yours, even if you never press V.

**Honest gaps:** materiel isn't priced yet (calls are free until §17
campaign stock lands); MP clients can't call (the sim call is
server-authoritative; the net command comes with the officer console);
the TRUE FLIGHT trio stays AI-until-flight-feels-right (§13 Q1 stands —
Superman/Goku is a movement model, not an overlay).

---

## 8. Look & sound — every LSW is unmistakable

> **✅ THE VOICES SHIPPED (2026-07-17):** every LSW SPEAKS — real expressive
> TTS (google/gemini-3.1-flash-tts via the `expressive-tts` skill), directed
> per-line with personas and director's notes (tools/lsw-vo-script.mjs is the
> casting sheet). Five moments each — arrival, third kill of the life, the
> signature, bloodied (<25%, once), last words — POSITIONAL (~34u: only
> people around them hear it, subtitles obey the same earshot). The announcer
> reads its own per-LSW radio-net calls (inbound/landed/down/rampage-at-5)
> map-wide through a 300–3400Hz net filter. Sci-fi FX per character: beast
> double under Ragebeast, crystal shimmer on Frostbite, respirator on
> Plaguebearer. All 36 clips are Sound-Lab-replaceable slots.
Robert: *"make sure visually the LSWs look different. Like the fire — I want
them to look like they're on fire. When they shoot energy blasts, shoot it.
Make sure they have their own sound effects."*

Per LSW, non-negotiable:
- **A distinct procedural body**: bigger silhouette than a trooper, signature
  palette, readable at command zoom. **No purple, ever** (test-swept).
- **A signature CONSTANT effect** — the thing that says *this is not a
  soldier*: Firebrand/Inferno/Pyroclasm **visibly burn** (persistent flame
  emitters on the body, heat shimmer, ember trail); Volt Striker crackles;
  Frostbite fogs and frosts the ground he stands on; Oblivion drinks light
  (black core, white rim — never purple); Dominator trails visible threads.
- **Real projectiles/beams**, not recolored bullets: energy blasts get their
  own tracer family (the `makeProjectile` switch is the seam).
- **A telegraph sound + an ability sound + an announcer line** each. The
  standalone generator pattern (`tools/gen-*-sounds.mjs`) is proven — three
  packs shipped that way; never regenerate the curated pack.
- **GLB slot**: probe `/models/ascendant_<id>.glb` exactly like class bodies.
  Missing model = procedural forever, mark 🧊, **never block**. When Robert
  drops one: `node tools/add-soldier.mjs` conventions (pipeline →
  glb-strip-rotations → **harness check FIRST**).

---

## 9. The harness must adjust to them
`/harness.html` ▸ Stage is where every model gets judged before a match ever
sees it. Required work when the first LSW lands:
- An **LSW section** in the Troopers panel: pick any LSW → Show.
- The Stage already does bbox/joint/arm-vector overlays, gait, team toggle —
  LSWs must answer the same overlays (they're Soldiers; the rig contract is
  the same eight joints).
- **Ability preview**: a "fire ability" button per LSW (the Arsenal Lab
  already has "Fire selected" for weapons — same pattern).
- This is how "concentrate on easiest to hardest" stays honest: the harness
  tells you in one screenshot whether a body is assembled, scaled, and posed.

---

## 10. The Iron Eaters — model them alongside (DD §20)
Robert: *"since we're doing these, we might as well model the Iron Eaters —
they're really blocky, they look like random things, metal chairs, TVs, just
scraps. Need to be humanoid-ish. We gotta figure that part out."*

DD §20 already specs them fully (canon, don't re-litigate): rogue
self-replicating nanite munitions that **corrode, consume, and assemble**.
Where the Outbreak eats flesh, the Iron Eaters eat **metal** — each faction's
greatest strength is what its nightmare eats. The bestiary: **scrap-rats**
(swarm), **junkhounds** (fast packs, they jump), **weavers** (wall-climbing
junk spiders), **ravagers** (siege beasts from dead MBTs), **the swarm**
(corrupted Collective drones), **the Leviathan** (a walking foundry).

**The modeling answer — and it's good news:** the pipeline's **voxel-block
remesh is already the Iron Eater art style.** Junk that learned a body plan
IS blocky assembled scrap. Two routes:
- **Procedural-first (recommended):** compose bodies from the existing prop
  vocabulary — crate/wreck/silo/crane parts on the eight-joint rig. A
  humanoid junkhound built from a thrown track and two drone rotors reads
  exactly right, costs no GLB, and is seed-varied per beast (no two alike —
  which is the whole point of "assembled from scrap").
- **GLB route:** Robert generates "pile of scrap metal chairs and TVs shaped
  like a man" → `add-soldier.mjs` at any `--height`. **Known gap:** the
  pipeline's `classify()` assumes human proportions (neck at 90% height, arms
  at 78%). Non-humanoid scale (Titan, Leviathan, scrap-rats) needs a
  `--parts` override. *Noted, not built.*

---

## 11. Adjacent fixes Robert reported (not LSW work — but blocking the feel)

| # | Report | Diagnosis | Status |
|---|---|---|---|
| 1 | "trees inside a house… couldn't get down the hallways" | **FOUND.** `map.ts` tree placement checks `grid[...] === T_OPEN` — but a house's interior floor **is** T_OPEN. The `houses` array and `houseAt()` sit right there, unconsulted. Trees grow indoors and wall the hallways. | ✅ fixed |
| 2 | "we need to SEE when bullets impact stuff" | Sound + debris shipped (`78501e2`). Robert wants it more visible: sparks on metal, chips on stone, dust puffs, decals. | ⬜ |
| 3 | "if one teammate sees you, they ALL know" | **Already true** (vision-share is team-wide, §19 explicit decision, holds until squads §15). The gap is REACTION, not knowledge. | ✅ by design |
| 4 | "if you're behind enemy lines they should come GET you" | No rescue behavior exists. Bots have no concept of an isolated friendly. Design: the spotter (or nearest free bot) breaks off and moves to you. | ⬜ |
| 5 | "everybody goes for the flag, nobody plays defense — they let people set up turrets near them" | **Real.** `raidsFlags()` sends bots at the flag; nothing assigns defense. Design: a role split (N attackers / M defenders per team), defenders anchored to their own flag/CP, and turret-sighting adds a defense pull. | ⬜ |
| 6 | "when you look away from an enemy they should fade over 5s; different classes see longer; max 5" | Today: `SEEN_LINGER = 1.5s`, `SEEN_LINGER_GEARED = 3s` — a hard pop, not a fade. Design: per-class linger (recon classes long, max **5s**), and a **visual fade** across the linger instead of a snap. | ⬜ |
| 7 | ElevenLabs "isn't that emotional" for death sounds | Every sound in the game is **synthesized from scratch** (CC0, no third-party audio) — four packs shipped that way. Real emotional VO is a different pipeline and a licensing question. See §13 Q4. | ⬜ |

---

## 12. Build order — easiest to hardest (Robert's rule)

1. **The officer-drop pipeline** + ONE T1 LSW per faction as proof:
   **Firebrand (UF)** vs **Plaguebearer (Collective)** — both pure
   fire/gas-field plays on shipped systems. Instant faction flavor, no new
   mechanics, and it proves the whole entry path end to end.
2. **ENCASE** ⭐ + **Frostbite** (UF flagship) vs **Ragebeast** (Collective —
   pure numbers, terrifying, T1). The first "oh hell" pair.
3. **FORCE FIELDS** → **Gravity Warden** + **Oblivion** (one mechanic, two
   drops).
4. **Dominator** ⭐ — the Collective finale mechanic (psychic links). Note:
   our new bot spacing fix is, accidentally, the bots learning to fight him.
5. Machine possession pair (**Phantom** / **Wraith**), then **Tremor** (the
   tunneler already donated its organs — burrow ships).
6. Remaining T1s in roster order (they're nearly free).
7. **TRUE FLIGHT** trio last, once the AA meta has data — and that same layer
   is what makes a **playable** LSW possible (§7).

*(The wave-1 order in the loop spec — Frostbite, Titan, Volt Striker,
Sniperhawk, Barrier, Reactor, Oblivion, Tremor, Magnetar, Wraith, Eclipse,
Dominator — is honored EXCEPT Titan, which is T3 (vehicle-throw physics) and
belongs after the T1s. Flagged, not silently reordered.)*

---

## 13. DECIDED (Robert, 2026-07-17)

- **D1 — Order of work: the AI and feel fixes come FIRST**, then the roster.
  They affect every match today; LSWs land on a better game. The agreed
  sequence:
  1. **Bot role split** — attackers/defenders; someone guards home and
     answers turret nests. *(§11 row 5)*
  2. **Rescue** — the spotter breaks off and comes for the isolated friendly.
     *(§11 row 4)*
  3. **Vision fade** — 0→5s, per-class linger, a visual dissolve not a pop.
     *(§11 row 6)*
  4. **Impact VFX** — sparks/chips/dust + decals. *(§11 row 2)*
  5. **THEN** the LSW engine + **Firebrand (UF) vs Plaguebearer (Collective)**.
- **D2 — Officers are EARNED BY RECORD.** The Dossier already tracks service
  (kills, objectives, tours, longest hold). Cross a threshold → OCS → you're
  an officer **across matches**. This is §7's "orders that outlive your
  login", and it needs no new tracking — the record already exists.
- **D3 — LSWs are AI-first; the player gets the keys later.** Ship them as
  events with counterplay, build TRUE FLIGHT for the three fliers, and only
  once flight genuinely feels like Superman/Goku does a human drive one — as
  its own decision, on proven movement. **Do not** shape the entity around a
  playable case now.
  - **D3 UPDATE (2026-07-17, Robert: "we need to be able to play as LSWs in
    a way that is fun and fits our game"):** the "later" arrived for the
    GROUND stable — §7 ships the ascension (call → hold the mark → become →
    Q signature → death hands the body back). The AI-first shape held: the
    entity never bent for the pilot (the same body serves both), which is
    exactly why this took a day, not a rework. **The flight clause still
    stands** — the TRUE FLIGHT trio stays AI until the movement model earns
    Superman/Goku.
- **D4 — Iron Eaters are PROCEDURAL scrap-composition.** Compose bodies from
  the existing prop vocabulary (crate/wreck/silo/crane parts) on the
  eight-joint rig, seed-varied so no two beasts are alike — which is the
  whole point of "assembled from scrap". Free, testable, animates today,
  matches the voxel look. No GLB dependency. *(The pipeline's non-humanoid
  `--parts` gap stays noted, unbuilt, and unblocking.)*

### Still open
- **Emotional VO:** every sound ships synthesized CC0 (four packs). Robert
  finds ElevenLabs "not that emotional" for death cries. Options: stay
  synth-only, license a VO pipeline, or Robert records. **Unanswered —
  doesn't block anything above.**
