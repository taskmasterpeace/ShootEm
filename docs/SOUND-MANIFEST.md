# Sound file manifest

Every sound the game loads. To replace one, drop a file named **exactly**
`<name>.wav` into `public/audio/`. WAV (PCM), mono preferred, ~44.1 kHz,
normalized to about −1 dBFS, dry (no baked-in reverb). Refresh the browser to
hear it (no rebuild in dev; `npm run build` bakes them for production).

You do **not** need to replace all of them — any file you leave alone keeps its
current procedurally-synthesized CC0 version.

Loader: `fetch('/audio/<name>.wav')` → WebAudio `decodeAudioData`. Identical
sounds are throttled to one per 30 ms, playback rate is auto-jittered ±6 %, and
positional sounds fade out past ~85 world units — so keep sources short and dry.

Prefer **CC0 / public-domain** sources (e.g. freesound.org filtered to CC0) to
match the project's licensing. CC-BY requires attribution in the repo.

## Weapons — fire sounds (short, punchy, dry)

| file | what it is | target length |
|------|------------|---------------|
| `rifle.wav` | assault-rifle shot | ~0.3 s |
| `smg.wav` | SMG shot (snappier/higher) | ~0.15 s |
| `pistol.wav` | sidearm shot | ~0.2 s |
| `shotgun.wav` | shotgun boom + pellet spray | ~0.5 s |
| `autocannon.wav` | heavy mechanical cannon | ~0.3 s |
| `rail.wav` | railgun electric snap → descending zap | ~0.7 s |
| `rocket.wav` | rocket/missile launch whoosh | ~0.9 s |
| `thump.wav` | grenade-launcher lob | ~0.35 s |
| `cannon.wav` | tank 120 mm — crack → deep boom | ~1.1 s |
| `plasma.wav` | energy bolt "zwip" | ~0.3 s |
| `flame.wav` | flamethrower burst | ~0.4 s |
| `acid.wav` | spitter acid glob | ~0.35 s |
| `repair.wav` | engineer repair tool | ~0.4 s |
| `heal.wav` | medic medi-beam | ~0.4 s |
| `claw.wav` | zombie/melee swipe | ~0.25 s |

## Impacts & explosions

| file | what it is | target length |
|------|------------|---------------|
| `hit.wav` | bullet impact / flesh-armor thwack | ~0.12 s |
| `hitmarker.wav` | UI "you hit them" tick | ~0.09 s |
| `explosion.wav` | standard explosion | ~1.5 s |
| `explosion_big.wav` | large explosion (deeper, longer) | ~2.5 s |
| `death.wav` | generic death (zombies / fallback) | ~0.6 s |

## Per-class death cries (a distinct human voice + gear per class)

| file | class | target length |
|------|-------|---------------|
| `death_infantry.wav` | Infantry | ~0.7 s |
| `death_heavy.wav` | Heavy Weapons (deep, armored) | ~0.85 s |
| `death_jump.wav` | Jump Trooper (yelp + jetpack sputter) | ~0.65 s |
| `death_engineer.wav` | Combat Engineer (grunt + dropped tools) | ~0.7 s |
| `death_medic.wav` | Field Medic | ~0.75 s |
| `death_infiltrator.wav` | Infiltrator (sharp gasp + cloak fizzle) | ~0.55 s |
| `death_pathfinder.wav` | Pathfinder (cry + warp zip) | ~0.6 s |
| `death_ghost.wav` | Ghost (grunt + comms static) | ~0.7 s |

## Movement / gear

| file | what it is | target length |
|------|------------|---------------|
| `jetpack.wav` | jetpack thrust (played in bursts) | ~0.3 s |
| `cloak.wav` | cloak toggle | ~0.4 s |
| `reload.wav` | magazine reload | ~0.5 s |
| `pickup.wav` | item/ammo pickup | ~0.3 s |
| `engine.wav` | vehicle engine (played in bursts) | ~0.5 s |
| `mine_plant.wav` | planting a mine/charge | ~0.3 s |
| `turret_built.wav` | sentry turret deployed | ~0.6 s |
| `footstep.wav` | single footstep (fires per stride) | ~0.15 s |
| `growl.wav` | zombie growl | ~0.6 s |

## Abilities / sci-fi tech

| file | what it is | target length |
|------|------------|---------------|
| `impulse.wav` | knockback impulse cannon | ~0.4 s |
| `warp.wav` | warp-beacon teleport | ~0.6 s |
| `blink.wav` | phase/blink | ~0.3 s |
| `emp_burst.wav` | EMP charge detonation | ~0.6 s |
| `gravlift.wav` | grav-lift launch | ~0.5 s |
| `beacon.wav` | beacon deploy/ping | ~0.4 s |
| `orbital_charge.wav` | orbital strike charge-up | ~1.0 s |

## Objective / UI / match flow (stingers)

| file | what it is | target length |
|------|------------|---------------|
| `flag_taken.wav` | flag stolen | ~0.6 s |
| `flag_captured.wav` | flag captured (positive) | ~1.0 s |
| `flag_returned.wav` | flag returned | ~0.6 s |
| `point_captured.wav` | control point taken | ~0.8 s |
| `wave_start.wav` | zombie wave begins | ~1.0 s |
| `victory.wav` | match won | ~1.5 s |
| `defeat.wav` | match lost | ~1.5 s |
| `ui_click.wav` | menu click | ~0.05 s |
| `spawn.wav` | (re)spawn | ~0.4 s |

**53 files total.** Names must match exactly — the game maps each to an event.
