# War World — How the AI Works

*Technical report, 2026-07-10. Source: [`src/sim/bots.ts`](../src/sim/bots.ts) (~330 lines — the entire AI).*

## The one rule that keeps bots honest

Bots do not get special powers. Every tick, each bot produces the **same `PlayerCmd` struct a human's keyboard and mouse produce** — move axes, aim angle, fire/jump/ability booleans — and the simulation applies it through the exact same code path as your input. A bot cannot shoot faster than its weapon, see through walls, or teleport, because it literally plays through the same verbs you do.

```
perception → objective → pathfinding → combat → PlayerCmd
```

## Perception

- Vision radius **42 units**, and a target must pass a **line-of-sight raycast** across the tile grid (walls block sight at soldier height; low cover doesn't).
- **Cloaked Infiltrators are invisible to bots beyond 9 units** — the same rule the renderer applies to your screen.
- Nearest visible enemy wins target selection. No memory of targets that break LOS (this is deliberate — it makes flanking and cloak-repositioning actually work against them).

## Objectives (per mode)

A bot always has somewhere to be, computed fresh every repath:

| Mode | Objective logic |
|---|---|
| CTF | Carrying? → run home. Own flag on the ground? → touch it to return. Enemy flag unclaimed? → go steal it. Teammate has it? → push midfield as escort pressure. |
| KOTH | The hill. Always the hill. |
| Conquest | Nearest point your team doesn't own; if you own all three, reinforce the nearest. |
| TDM | Drift toward the midfield/enemy side where the action is. |
| Survival | Stay near the squad's center of mass — bots naturally form defensive knots. |

## Pathfinding

**Breadth-first search over the 100×100 tile grid**, 8-connected with corner-cutting forbidden, recomputed roughly once a second per bot (staggered with jitter so they don't all path on the same frame). The raw path is then **smoothed with line-of-sight skips** — the bot walks straight to the farthest path node it can see, so routes look like movement, not tile-crawling. If a destination is unreachable, the bot falls back to straight-line steering with wall-slide.

Cost: a full cross-map BFS visits ≤10,000 nodes with typed-array bookkeeping — microseconds in practice; 24 bots pathing at 60Hz sim doesn't move the needle.

## Combat behavior

- **Target leading** — bots compute your projected position from your velocity and their projectile's flight time, then aim there (85% lead weight, so fast strafing still beats them).
- **Aim error** scales with distance and the difficulty you picked in Match Setup: Recruit ×1.9, Veteran ×1.0, Elite ×0.45.
- **Strafe dance** — inside 22 units they orbit you, randomly flipping direction so they're not predictable.
- **Range discipline** — Heavies and Infiltrators back off if you close inside 8 units; zombies never do.
- **Grenades** — thrown at targets in the 8–24 unit band, low random gate so they punctuate rather than spam.

Class flavor: Medics divert to any ally under 75% HP within 13 units and beam-heal (and self-stim when hurt); Engineers drop sentries when idle near an objective; Infiltrators cloak while traveling; Jump Troopers pop jetpack hops mid-fight.

## Vehicles

A bot on foot with an objective **more than 45 units away** will mount an empty friendly vehicle nearby, drive it with the same throttle/steer commands you use (with lead-aimed turret fire on the way), and dismount within ~14 units of the goal. Tanks stay mounted — they *are* the objective plan.

## Zombies (Survival)

Zombies run a separate, simpler brain: beeline to the nearest living soldier, BFS around walls only when sight is blocked, melee on contact. **Spitters kite** — they retreat below 14 units and lob acid from range. Each zombie gets a per-ID speed jitter so hordes smear into a wave instead of marching in lockstep. Wave *n* spawns 6+3n zombies at map-edge points with +12% HP per wave; Spitters mix in from wave 2, Brutes from wave 3.

## Where it could go next

Ranked by payoff: (1) squad roles in CTF (dedicated defenders vs runners), (2) sound-event memory ("shots behind me" → investigate), (3) utility scoring instead of if/else objectives, (4) bot chatter in the killfeed. The current architecture (pure function per tick, all state on the soldier struct) makes all four straightforward to add.
