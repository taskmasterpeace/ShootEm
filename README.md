# ⚔️ War World

**A modern, browser-native reimagining of [Infantry Online](https://github.com/InfantryOnline/Infantry-Online-Server)** — the classic 1998 top-down multiplayer shooter — rebuilt from scratch in TypeScript + Three.js with vehicles, five game modes, six combat classes, bots, and LAN multiplayer.

No install, no launcher, no plugins. `npm run dev`, open a browser, deploy.

![modes](https://img.shields.io/badge/modes-5-e8a33d) ![classes](https://img.shields.io/badge/classes-6-3dbde8) ![vehicles](https://img.shields.io/badge/vehicles-4%20%2B%20sentries-8fb98a) ![license](https://img.shields.io/badge/license-MIT-blue)

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
npm test             # 20 sim tests (combat, modes, vehicles, bots, netcode)
npm run sounds       # regenerate the CC0 sound pack from source
```

## Controls

| Input | Action |
|---|---|
| WASD | Move (drive/steer in vehicles) |
| Mouse | Aim · left-click fire |
| Space | Jetpack (Jump Trooper) / hop |
| E | Enter / exit vehicle |
| Q | Class ability (cloak, sentry, self-stim…) |
| G | Frag grenade (Engineer: plant mine) |
| R | Reload · 1-3 weapon slots · TAB scoreboard |

## Game modes

| Mode | Rules |
|---|---|
| 💀 **Team Deathmatch** | First team to 50 kills |
| 🚩 **Capture the Flag** | Steal the enemy flag while yours is home — first to 3 caps |
| ⛰️ **King of the Hill** | Hold the center hill for 120 accumulated seconds |
| 🎯 **Conquest** | Hold control points A/B/C to drain tickets — first to 500 |
| 🧟 **Zombie Survival** | Co-op vs escalating waves (spitters and brutes from wave 2-3) |

## Classes

| Class | HP | Loadout | Ability |
|---|---|---|---|
| Infantry | 100 | Maklov AR-606 + P9 | 4 frag grenades |
| Heavy Weapons | 145 | AC-Mk2 Autocannon + Micro-Missiles | Slow but devastating |
| Jump Trooper | 90 | Kuchler K6 SMG + GL-40 | Jetpack (energy-fueled) |
| Combat Engineer | 110 | CAW-8 Shotgun + Repair Gun | Builds sentry turrets, plants mines |
| Field Medic | 100 | K6 SMG + Medi-Beam | Heals squad, self-stim |
| Infiltrator | 80 | RG-2 Railgun + P9 | Cloaking field |

Plus battlefield pickups: medkits, ammo crates, energy cells, and the F-3 Flamer.

## Vehicles

| Vehicle | Armor | Role |
|---|---|---|
| Scout Buggy | 220 | Fast harassment, mounted MG |
| Ares Battle Tank | 650 | 120mm splash cannon |
| Bastion APC | 450 | 4 seats, **mobile spawn point** for its team |
| Wraith Skiff | 160 | Hover — crosses water, plasma repeater |

Vehicles spawn on team pads and respawn 22s after destruction. Engineers can repair them.

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

All 36 sound effects are **synthesized from scratch** by [`tools/gen-sounds.mjs`](tools/gen-sounds.mjs) (noise bursts, filtered sweeps, arpeggio stingers — no samples) and dedicated to the **public domain (CC0 1.0)**. See [public/audio/LICENSE-CC0.txt](public/audio/LICENSE-CC0.txt).

## Lineage

War World is an original homage to *Infantry Online* (Sony Online Entertainment, 1998), whose community keeps the original alive at [InfantryOnline/Infantry-Online-Server](https://github.com/InfantryOnline/Infantry-Online-Server). The class archetypes (Jump Trooper, Combat Engineer, Infiltrator…), weapon naming style (Maklov, Kuchler, Kamenel, RG-2, AC-Mk2, CAW), vehicle categories, and mode list (CTF, KOTH, Conquest, Zombie) all trace back to the original's design. No code or assets from the original are used.

## License

MIT — see [LICENSE](LICENSE). Audio is CC0.
