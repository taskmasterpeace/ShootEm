# ⚔️ War World

**A modern, browser-native reimagining of [Infantry Online](https://github.com/InfantryOnline/Infantry-Online-Server)** — the classic 1998 top-down multiplayer shooter — rebuilt from scratch in TypeScript + Three.js with vehicles, seven game modes, eight combat classes, Tribes-style warp tech, bots, and LAN multiplayer.

No install, no launcher, no plugins. `npm run dev`, open a browser, deploy.

![modes](https://img.shields.io/badge/modes-7-e8a33d) ![classes](https://img.shields.io/badge/classes-8-3dbde8) ![vehicles](https://img.shields.io/badge/vehicles-4%20%2B%20sentries-8fb98a) ![license](https://img.shields.io/badge/license-MIT-blue)

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3400 — play vs bots offline
```

**Multiplayer (LAN):**

```bash
npm run server       # dedicated server on ws://0.0.0.0:3401
```

Then enter `ws://<host-ip>:3401` in the Multiplayer field on the menu. One room per game mode, bots fill empty slots, matches auto-restart. Leave the field blank to play offline against bots.

**Everything else:**

```bash
npm run build        # typecheck + production bundle → dist/
npm test             # 42 sim tests (combat, modes, vehicles, bots, warp tech, netcode)
npm run sounds       # regenerate the CC0 sound pack from source
```

## Controls

| Input | Action |
|---|---|
| WASD | Move (drive/steer in vehicles) |
| Mouse | Aim · left-click fire |
| Space | Jetpack (Jump Trooper) / hop |
| E | Enter/exit vehicle · use warp beacon · escort Dr. Voss |
| Q | Class ability (cloak, sentry, warp beacon, drone, shield dome…) |
| G | Frag grenade (Engineer: mine · Pathfinder: targeting beacon · Ghost: EMP · orbital designator if held) |
| R | Reload · 1-3 weapon slots · TAB scoreboard |

## Game modes

| Mode | Rules |
|---|---|
| 💀 **Team Deathmatch** | First team to 50 kills |
| 🚩 **Capture the Flag** | Steal the enemy flag while yours is home — first to 3 caps |
| ⛰️ **King of the Hill** | Hold the center hill for 120 accumulated seconds |
| 🎯 **Conquest** | Hold control points A/B/C to drain tickets — first to 500 |
| 🧟 **Zombie Survival** | Co-op vs escalating waves (specials mix in from wave 2) |
| 🩸 **Endless Horde** | No waves, no breaks — continuous spawning that ramps every 30s until the squad falls |
| 🧪 **Protect the Scientist** | A suburban neighborhood map. The horde searches house to house for Dr. Voss — hide him (E to escort/relocate), defend when they find him, survive the 5-minute evac countdown |

## Classes

| Class | HP | Loadout | Ability |
|---|---|---|---|
| Infantry | 100 | Maklov AR-606 + P9 | 4 frag grenades |
| Heavy Weapons | 145 | AC-Mk2 Autocannon + Micro-Missiles | Slow but devastating |
| Jump Trooper | 90 | Kuchler K6 SMG + GL-40 | Jetpack (energy-fueled) |
| Combat Engineer | 110 | CAW-8 Shotgun + Repair Gun | Builds sentry turrets, plants mines |
| Field Medic | 100 | K6 SMG + Medi-Beam | Heals squad, self-stim |
| Infiltrator | 80 | RG-2 Railgun + P9 | Cloaking field |
| Pathfinder | 85 | Impulse Cannon (knockback) + P9 | **Warp beacon pair** (Q), targeting beacons (G), fastest on foot |
| Ghost | 90 | Kamenel Plasma + P9 | **Recon drone** (Q) marks enemies through walls, EMP charges (G) |

Plus battlefield pickups: medkits, ammo crates, energy cells, the F-3 Flamer, and **orbital strike designators**.

## Field tech (the Tribes homage)

- **Warp Beacons** — Pathfinders plant an ALPHA/BETA pair; any teammate presses E on one to teleport to the other. Beacons are destroyable (150 HP).
- **Jump Gates** — paired glowing arches on battlefield maps; walk in, come out the other side (4s cooldown).
- **Grav-Lifts** — step on a pad, get flung ballistically toward midfield.
- **Targeting Beacon** — lobbed; pings every enemy within 25 units onto your minimap for 15s (cloaks included).
- **Orbital Strike** — pickup-only designator: throw it, 3 seconds of klaxon, then a beam annihilates the area. The beacon can be shot before it fires.
- **Shield Dome** — Heavy's deployable bubble (400 HP, 30s) that eats enemy projectiles.
- **EMP Charge** — Ghost's lobbed charge: stalls vehicles 4s, blinds turrets 5s, strips cloak and energy.
- **Supply Pods** — every 90s a pod screams down from orbit with one-shot loot, sometimes an orbital designator.
- **Phase Stalker** — the undead answer to all of it: a rare zombie that blinks through walls toward prey.

## Vehicles

| Vehicle | Armor | Role |
|---|---|---|
| Scout Buggy | 220 | Fast harassment, mounted MG |
| Ares Battle Tank | 650 | 120mm splash cannon |
| Bastion APC | 450 | 4 seats, **mobile spawn point** for its team |
| Wraith Skiff | 160 | Hover — crosses water, plasma repeater |

Vehicles spawn on team pads and respawn 22s after destruction. Engineers can repair them.

## Docs

- **[Field Manual](docs/MANUAL.md)** — how to play, HUD guide, class doctrine, vehicle guide, field tips (with live screenshots)
- **[AI Report](docs/AI-REPORT.md)** — how the bots perceive, path, fight, drive, and swarm
- **[Mobile Feasibility](docs/MOBILE-FEASIBILITY.md)** — runs in a phone browser today; what touch controls would take
- Screenshots regenerate with `node tools/capture-screenshots.mjs` while the dev server runs

## Architecture

```
src/
  sim/        deterministic simulation — zero DOM/Three imports, runs anywhere
    world.ts    entities, physics, combat, damage, vehicles, turrets, mines
    modes.ts    the five game-mode rulesets
    bots.ts     BFS pathfinding + combat AI + zombie hordes
    map.ts      seeded symmetric map generator (same seed ⇒ same map)
    snapshot.ts wire codec (server-authoritative full snapshots)
  client/     Three.js renderer, particles, positional audio, HUD, input, netcode
  server/     dedicated WebSocket server (rooms, bots, auto-restart)
tools/        procedural sound-pack generator
tests/        vitest suite over the sim
```

The sim is deterministic and shared verbatim by the offline game, the client's dead-reckoning, and the dedicated server — the classic "server-authoritative with client extrapolation" model, at 30Hz ticks / 15Hz snapshots.

## Sounds

All 43 sound effects are **synthesized from scratch** by [`tools/gen-sounds.mjs`](tools/gen-sounds.mjs) (noise bursts, filtered sweeps, arpeggio stingers — no samples) and dedicated to the **public domain (CC0 1.0)**. See [public/audio/LICENSE-CC0.txt](public/audio/LICENSE-CC0.txt).

## Lineage

War World is an original homage to *Infantry Online* (Sony Online Entertainment, 1998), whose community keeps the original alive at [InfantryOnline/Infantry-Online-Server](https://github.com/InfantryOnline/Infantry-Online-Server). The class archetypes (Jump Trooper, Combat Engineer, Infiltrator…), weapon naming style (Maklov, Kuchler, Kamenel, RG-2, AC-Mk2, CAW), vehicle categories, and mode list (CTF, KOTH, Conquest, Zombie) all trace back to the original's design. No code or assets from the original are used.

## License

MIT — see [LICENSE](LICENSE). Audio is CC0.
