# 🔫 The Arsenal — 200+ Weapons, 11 Vehicles, 13 Equipment Items

War World's answer to Infantry Online's armory. Everything below is live in
the sim and the menu today.

## Weapons (200+)

The armory is the hand-tuned core set (class issue weapons, vehicle guns,
zombie attacks) plus a generated catalog built in
[`src/sim/arsenal.ts`](../src/sim/arsenal.ts):

**16 families × 4 manufacturers × 3 marks**, deterministic on every client
and server:

| Family | Role |
|---|---|
| Pistols | sidearms — every class carries one |
| Rifles / Carbines / SMGs | the infantry bread and butter |
| Shotguns / Slug Throwers / Scatter Packs | close-quarters spread and slugs |
| Lasers | precision energy — near-hitscan, tight groups |
| Light & Heavy MGs | sustained suppression, huge belts |
| AT Rockets / AP Rockets | single-target armor killers vs splash |
| Mortars / Field Guns (artillery) | lobbed and long-range indirect fire |
| Sonic Cannons | damage + knockback shove |
| Flamethrowers | short-range burn hoses |
| Grenade Launchers | frag, **smoke** (blocks pings/minimap), **phosphorus** (burning ground) |
| Specials | DX-9 demolition charge, Bulwark emplacement gun |

Manufacturers flavor the stats: **Maklov** (balanced), **Kuchler** (fast,
light), **Titan Arms** (heavy, slow), **Harkov** (precise), **Ceres Foundry**
(big magazines), **Kamenel** (hot energy). Mk I→III raises damage, tightens
spread, speeds reloads.

**Picking one:** the menu's **Armory** section lists every weapon your class
may draw (each class has allowed families — heavies get MGs, rockets, mortars,
artillery, sonic; infiltrators get lasers and marksman rifles…). Bots draw
varied primaries from the same lists, so no two matches sound alike.

Balance is enforced by tests: no generated weapon exceeds ~260 burst DPS, 130
range, or a 5s reload (`tests/expansion.test.ts`).

### Range = literal reach

Every weapon's **`range` is the exact distance its shot travels** — direct-fire
rounds are culled at `range`, and **arc weapons (grenades, mortars, artillery)
are launched at an angle that lands them at `range`** rather than a fixed short
ballistic. Ranges are tuned to the 200-unit battlefield in role bands, playtest-validated
against 660+ bot-match kills, and locked by `tests/range.test.ts`:

| Band | Reach | Families |
|---|---|---|
| CQC | 16–27 | flamethrower, scatter, shotgun |
| Short | 40–46 | SMG, pistol/sidearm |
| Mid | 50–66 | carbine, sonic, plasma, impulse, LMG, autocannon, slugger, rifle |
| Long | 64–96 | HMG, AP/AT rockets, micro-missiles, mortar, laser, tank cannon |
| Sniper/arty | 105–125 | field-gun artillery, RG-2 railgun |

Bots acquire targets out to their weapon's reach, so a railgun infiltrator
genuinely snipes and a shotgun engineer must close — the tuned distances show
up in real firefights.

## Vehicles (11)

| Vehicle | Armor | Seats | Role |
|---|---|---|---|
| Scout Buggy | 220 | 2 | fast harassment, MG |
| **Ares Battle Tank** | 650 | **8** | 120mm cannon · **sensors/ECM/comms stations + 4 passenger benches** |
| Bastion APC | 450 | 4 | mobile spawn (needs live comms) |
| Wraith Skiff | 160 | 1 | hover, crosses water |
| **Jackal Recon Bike** | 130 | 1 | fastest ground vehicle, MG |
| **Halo Hoverboard** | 70 | 1 | personal hover deck — fast, fragile, unarmed |
| **Kestrel Gunship** | 200 | 2 | **flies over walls**, plasma battery |
| **Atlas Transport** | 520 | **9** | gunner + sensors + ECM + comms stations, 4 passengers, mobile spawn |
| **Mercy Field Ambulance** | 300 | 3 | heals soldiers around it (faster aboard) |
| **Mole Tunneling Machine** | 700 | 2 | **grinds walls into open ground** — reroute the whole map |
| **Bulwark Emplacement** | 380 | 1 | static manned artillery guarding each midfield |

### Crew stations & subsystem damage

Every vehicle carries five damageable systems — **engine, weapon, sensors,
ECM, comms** — each with its own hit points. 35% of every hit chews into a
random system:

- **Engine out** → limps at ~1/3 throttle
- **Weapon out** → the gun is dead metal
- **Sensors out** → the sensor station goes dark
- **ECM out** → the vehicle shows permanently on enemy minimaps
- **Comms out** → APC/Transport stops being a mobile spawn

Manning the stations matters: a crewed **sensors** seat pings every enemy
within 28u onto the team minimap; a crewed **ECM** seat projects a 14u
jamming bubble that scrubs friendly contacts off enemy pings. Passengers
disembark with E when leg work is required.

## Equipment (pick two at deploy)

| Item | Effect |
|---|---|
| 🦺 Ballistic Vest | +25 max HP, −8% speed |
| 🛡️ Power Armor | +60 max HP, −15% speed, immune to knockback |
| 🥷 Stealth Suit | beacons and drones cannot ping you |
| 🥽 IR/UV Goggles | cloaked enemies appear on your minimap |
| 📡 Mine Detector | enemy mines appear on your minimap |
| 🔧 Mechanic Kit | E repairs a friendly vehicle/turret (+120, braces the weakest system) |
| 💉 Combat Medikit | auto-heals +45 once per life below 25% |
| 📹 Head Cam Network | your minimap shows everything your teammates see |
| 🗺️ Tactical System | click the minimap to drop waypoints your team sees |
| 🔮 Psi Scanner | pings the nearest hidden enemy every 8s |
| 🧨 Demolition Kit | G plants DX-9 charges (3 per life) |
| 💻 Hacking Kit | E converts an enemy sentry to your side |
| 📷 Spy Camera | G plants a camera that feeds enemy positions (2 active) |

## Comms

- **Enter** opens chat · **Tab** cycles channel · **F1–F8** fire macros
- `/join <name>` creates/joins custom channels; TEAM stays team-only
- `/macro <1-8> <text>` stores your macros (persisted)
- `/msg <player> <text>` **stores a message delivered the next time that
  callsign deploys** — locally offline, server-side in multiplayer

## Advanced line of sight

The minimap is fog-of-war: you see what you can see (LOS-checked), plus
anything pinged by beacons, drones, spy cameras, sensor crews, or psi scans.
Smoke hides everyone inside it. Head cams share your whole team's eyes;
IR goggles cut through cloaks; ECM crews jam it all.

## Reading the battlefield — visual feedback

Everything above announces itself visually:

- **Vehicle HUD pips** — five per-system chips (ENG WEA SEN ECM COM): green
  healthy, amber damaged, blinking red destroyed.
- **Battle damage** — vehicles with a dead system trail gray smoke; hulls
  under 35% burn.
- **Crew stations** — a crewed sensor seat sends visible radar sweep rings;
  a crewed ECM seat shows its cyan 14u jamming footprint on the ground.
- **Ambulance** — a breathing green aura ring marks the exact heal radius.
- **Revealed enemies** — anyone pinged (beacon, drone, camera, sensors, psi)
  wears a bobbing red chevron, visible through walls.
- **Waypoints** — tactical-system marks stand as amber light pillars on the
  field, not just minimap dots.
- **You** — the screen edge flashes red when you're hit and green when
  healed; the ammo counter turns amber at low clip and blinks red empty;
  a reload progress bar fills under the counter; equipment chips show
  cooldowns (mechanic/hacking kit), spent state (medikit), and the psi
  scanner flashes teal when it finds someone.

## Post-match honors

The sim keeps a trophy ledger — longest kill distance, vehicles wrecked, hit
points healed — and the final scoreboard crowns 🏆 MVP, 💀 Top Gun,
🎯 Longest Shot, ⚕️ Combat Medic, and 💥 Tank Buster.

## Camera & controls

Mouse wheel zooms 16–55u; the camera leads toward where you're aiming so you
see the fight ahead, not the ground behind you. Flyers spool their rotors for
2.5s before liftoff — plan your exits.

## The Sound Lab

The harness (`/harness.html`) carries a Sound Lab: audition all 43 CC0
sounds, set per-sound volume and pitch (saved), or **replace any sound with
your own audio file** (wav/mp3/ogg — stored in your browser). The game honors
every change on every launch; ↺ restores stock.

## Environments — the war scales the solar system

| Theme | Gravity | Character |
|---|---|---|
| 🌍 Terra — Savanna | 22 | the classic: grass, kopjes, ponds |
| 🚀 Starship Boarding | 22 | long corridor fighting, no water, deck plate |
| ☄️ Hollowed Asteroid | 14 | rock galleries, regolith |
| 🌊 Europa Depths | 9 | ocean-floor domes, glowing vents, floaty jumps |
| 🪐 Titan Colony | 16 | orange methane haze, short sightlines |
| ❄️ Triton Outpost | 9 | nitrogen ice, crevasses, low-g |

Low gravity changes everything ballistic: hops float, grenades sail, jetpacks
cross the map.
