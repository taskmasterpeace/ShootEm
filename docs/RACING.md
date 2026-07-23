# THE CIRCUIT — Racing Destruction Set, reimagined
### Robert, 2026-07-23, with the RDS stat cards + track editor on screen: *"think Racing Destruction Set, where you can build tracks, you can race, and there's an aspect where you can drop mines behind you… but keep in mind this thing got elevation, it got jumping, they got motorcycles — if we could have the motorcycles and the cars land in a realistic way, then I think we might have something special."*

## Why RDS is the right ancestor
The 1985 card is a *complete vehicle language* in eleven lines, and three of its ideas are better than what modern racers do:

1. **TRACTION IS THREE NUMBERS — ICE · DIRT · PAVED.** Not one "grip" stat: a *profile*. The Indy car reads 5 / 48 / 253; the Can-Am reads 8 / 68 / 255. The Indy is faster on tarmac and useless in the dirt, and you can SEE it on the card before you ever drive. **We already have the substrate** — the MATERIALS table gives every floor a grip value (#102/#121). A per-vehicle traction profile multiplies it.
2. **SHOCK STRENGTH.** A suspension number, because the track has *elevation and jumps*. Land harder than your shocks and you're punished. This is the stat that makes Robert's "land in a realistic way" a rule instead of an animation.
3. **THE CARGO ROW IS THE LOADOUT** — LAND MINES · OIL GALLONS · ARMOR · CRUSHER. Weight you *choose* to carry. Every one costs you acceleration, because it's mass, and mass is already real in our sim. The trade is honest and it's the whole game.

## THE CARD (our version)
| Line | Ours | Status |
|---|---|---|
| WEIGHT | `mass` (tonnes) | ✅ shipped (e254428) |
| TOP SPEED | `speed` | ✅ |
| ACCELERATION | derived from mass + engine | ✅ (derived) |
| TRACTION ICE / DIRT / PAVED | **`traction: {ice, dirt, paved}`** — multiplies the floor's material grip | ▶ build |
| SHOCK STRENGTH | **`shock`** — landing force absorbed before damage/bounce | ▶ build |
| TIRES | a fitted part that REWRITES the traction triple | ▶ build |
| ENGINE | a fitted part: top speed vs acceleration | ▶ build |
| LAND MINES · OIL · ARMOR · CRUSHER | carried cargo — each adds mass | ▶ build |

## THE GARAGE (Robert: *"not too deep, but a little bit of modification"*)
Four slots, no more. Every fit is a **sidegrade** — the house law.
- **TIRES** — Slicks (paved ★★★, dirt ✗) · All-Terrain (even) · Knobblies (dirt ★★★, paved poor) · Studs (ice ★★★, slow everywhere else)
- **ENGINE** — Stock · Sprint (accel over top end) · Long-Ratio (top end over accel)
- **CHASSIS** — Stripped (light, fragile) · Standard · Reinforced (heavy, survives contact)
- **CARGO** — mines / oil / armour / crusher, each costing mass

## THE WEAPONS (the RDS soul: you race *and* you fight)
- **MINES** dropped behind you — arm after a beat so you can't suicide
- **OIL SLICKS** — a patch that overrides surface traction for anyone who crosses it (the materials system already owns "what the floor does to you")
- **CRUSHER** — a front ram: mass × speed decides who wins the contact
- **ARMOUR** — soak, at the cost of acceleration

## ELEVATION, JUMPS, LANDINGS (the "something special")
The map has real height. A ramp is a height step you hit fast.
- **AIRBORNE** — wheels leave the ground; no steering authority in the air (you commit at the lip)
- **THE LANDING** — impact force = mass × vertical speed. Under `shock`: clean. Over: bounce, damage, a slide.
- **NOSE ATTITUDE** — land flat or you understeer away the exit. **Motorcycles** (light, high shock) reward this most — Robert's bikes-and-cars-landing-right.

## MODES
- **CIRCUIT** — laps vs a pack, weapons live
- **TIME TRIAL** — you vs the record, weapons off
- **DESTRUCTION** — last car running
- **CUSTOM TRACK** — race any track the creator has built

## RECORDS (Robert: *"keep track of who got the best time on what track"*)
Per track, per vehicle class: best lap, best race, and the HOLDER's callsign. Records are account-level, they survive prints, and they're the reason to come back to a track.

## THE TRACK BUILDER — creator-only (his words: *"creating the track is just for me, the creator"*)
Behind the Admin Room door. RDS's parts box, our engine: straights, curves, chicanes, ramps, banks, jumps; per-piece HEIGHT, WIDTH and SURFACE (paved/dirt/ice — which the traction triple then reads). Tracks export as data so the creator can ship them with a build.

## Build order
1. **THE CARD** — traction triple + shock on every hull; codex shows the profile *(the foundation)*
2. **THE LANDINGS** — airborne state, impact force vs shock, nose attitude
3. **THE GARAGE** — tires/engine/chassis/cargo, each a sidegrade, mass-honest
4. **THE WEAPONS** — mines, oil, crusher, armour
5. **RECORDS** — per track+class, with the holder's name
6. **THE BUILDER** — creator-only track editor, tracks as data
