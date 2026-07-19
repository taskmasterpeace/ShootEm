# War World — Bot AI Audit (2026-07-19)

*Method: six fresh-context agents audited the AI in parallel — navigation/anti-stuck, perception/targeting, objectives/decision-brain, combat/classes/vehicles/ladders, LSW & zombie AI, and architecture/tuning. Every claim below is anchored to `file:line` in current code. `bots.ts` is now **1524 lines** (the old [`AI-REPORT.md`](AI-REPORT.md) describes a ~330-line brain and is stale).*

## The one thing that's right

Bots produce the **same `PlayerCmd` a human's keyboard emits** (`world.ts:1083`), applied through the identical code path — no wallhacks, no teleport-to-objective. The sim is **deterministic** (no `Math.random`/`Date.now` anywhere in `src/sim`; one seeded mulberry32), so everything is replay- and snapshot-safe. The **black box** flight recorder (`blackbox.ts`) is excellent instrumentation and is how the real bugs (CTF freeze, vibrating sentry) were caught and regression-locked. Vehicle *driving* and the *ladder* machinery are mature and tested. This is a solid foundation — the findings below are about depth, not rot.

---

## Cross-cutting themes, ranked by leverage

### THEME 1 — Bots are inhumanly omniscient (the biggest "feel" problem)
The bot brain **never imports `perception.ts`** — the rich sight model (grass concealment, weather tax, cloak, ping reveal, linger memory) that governs the *human's* screen. Bots run their own thin `findTarget` instead. Result:
- **See through tall grass** — `findTarget` uses only `sightClear`, never the `T_GRASS` range clamp players get (`bots.ts:284-286` vs `perception.ts:94-96`). Crouching in grass breaks contact with humans but not bots. **High.**
- **Ignore the weather vision tax** — `acqRange` is weapon-range based (`bots.ts:774`); fog (`visionMult`) handicaps only the human trail (`world.ts:1134`). In fog a human sees ~32u, a bot still fires to 95u. **High.**
- **No reaction delay + instant snap-aim** — same tick a target enters range with LOS, the bot sets `yaw = aimYaw` (no turn-rate cap, `world.ts:1597`) and fires (`world.ts:1988`). Only *spatial* error exists; no acquire delay field exists at all. An Elite bot (±~1°) corner-headshots before a human could flick. **High.**
- **No target hysteresis → 60 Hz aim-thrash** — `findTarget` re-picks nearest every tick (`bots.ts:287`); two near-equidistant enemies swing the gun ~60×/s, landing few shots and reading as broken. **Med-High.**
- **Zero memory after LOS breaks** — bots don't use the `seenRecently`/linger system built for players (`perception.ts:112`); strafe behind a wall and a bot instantly forgets you. Corner-play is risk-free. **Med.**

> **The unlock:** route `findTarget` through the shared `perceivesNow` — one change fixes grass, weather, ping, and cloak consistency at once. Add a per-difficulty acquire delay + a yaw slew cap to kill the instant-snap.

### THEME 2 — No threat/priority awareness anywhere
Everything is **nearest-only**. Targeting (`bots.ts:287`), objectives, and combat all pick the closest thing and ignore what matters.
- **No focus-fire; `w.pinged` is dead to bots** — dog-nose, ghost-drone, tag-darts feed `w.pinged` and light enemies up on the human HUD, but `findTarget` never reads it (`bots.ts:268-293`). 12 bots never concentrate fire; a marked cloaked raider is invisible to bot allies yet auto-spotted at 9u without any mark. **Med.**
- **A rampaging LSW / the flag carrier / a near-dead shooter are all "just the nearest"** — no threat weighting (`bots.ts:287`). Bots plink a trash-mob while the god behind it kills them. **Med.**
- **On-foot bots can't target vehicles at all** — `findTarget` excludes vehicle occupants (`bots.ts:275`), so the heavy's anti-armor swap (`bots.ts:979`) is **dead code**. An enemy tank rolls through a squad of missile-heavies untouched. **High** (confirmed by two independent audits).

### THEME 3 — The objective brain is `if/else` with real roles in ONE mode
`objectiveFor` (`bots.ts:382-525`) is a `switch(mode)` with nested `if` chains — **no utility scoring**.
- **Roles (`guardsHome`/`raidsFlags`) are consulted in CTF only** — KOTH, Conquest, TDM, Survival are monocultures where all 12 bots get the identical objective (`bots.ts:481-523`). In KOTH all 12 stack one hill point; in Conquest nobody *defends* a captured point. **High.**
- **No pursuit of a live enemy carrier of our flag** — bots recover our flag only when it's *dropped* (`bots.ts:399`); while an enemy actively carries it home, the team keeps raiding. The standoff-breaker only fixed the narrow "we're parked with their flag" freeze — **Robert's "nobody plays defense" is still half-open.** **Med-High.**
- **No score adaptivity** — `objectiveFor` never reads `m.scores`; down 0:2 with 60s left plays identically to winning. **Med.**
- **Frozen roles, no backfill** — roles are functions of unchanging class+id (`bots.ts:310,325`); if all guards die at once, nobody re-tasks to hold home. **Med.**
- **Objective flip-flop at hard cutoffs** — the 12u "parked" test and the rescue trigger bang-bang at ~1 Hz as bodies jostle the boundary (`bots.ts:414,359`). **Med.**
- **CTF logic is accreted special-case patches** (`bots.ts:453-479`: hard-coded `dFlag>70`, `side=1` with a double-negation-bug comment, `wing`, `prog<0.45`, room-duty, parked patch). Correct but brittle. **Med tech-debt.**
- **TDM drift point has a coordinate bug** — `bots.ts:522` drops the `0.6·hill.z` term, so the whole team drifts to a skewed point. **Low.**

> **The unlock:** replace the `switch` with **per-mode utility scoring** over a small candidate set (attack / defend / hunt-carrier / hold-point / rescue / regroup). Soft scores don't bang-bang at a 12u line, defenders *emerge* when "defend" out-scores "attack," and the mono-mode + special-case debt both dissolve. (This is the old report's own #3 idea, `AI-REPORT.md:57`.)

### THEME 4 — Pathfinding is BFS-not-A*, and the walkable map is wrong
- **Uniform-cost BFS, not A\*** (`bots.ts:83-98`) — floods every tile closer than the goal, ~5,000 nodes for a base→mid path, *per repath*. 24 bots + 12 zombies repathing ~1/s is >100k node-visits/s with zero directional bias. **High.**
- **Thundering herd** — all fresh/respawned bots have `botGoal=null` and repath on the *same tick* (`world.ts:914`); the stagger only starts after the first path. The most expensive BFS moment lands exactly on a respawn wave. **Med.**
- **Unreachable goal floods the whole component, then oscillates forever** — BFS expands ~10k tiles returning null every repath, and the foot stuck-check that would break it is **gated on `!target`** (`bots.ts:838`). A stuck-but-can-see-enemy bot never re-plans. **High.**
- **Tall grass & breached rubble are walkable in physics but excluded from the planner** — `T_GRASS`/`T_RUBBLE` aren't in the `open()` predicate (`bots.ts:52-56`). Forests (grass is their *primary* walkable texture) silently defeat the AI — "choke, not seal" becomes "seal"; and bots never exploit a breach they just drilled. **Med** (×2).
- **Arriving-behind-cover guards trigger a full BFS every tick** (within 3u but no LOS → the cheap shortcut is skipped, `bots.ts:848` vs `892`). **Med.**
- **Door-dance in crowds** — `doorAhead` reads the *shoved* heading (`bots.ts:1130`) and only fires with `!target`; separation pushes each bot off-axis so no one opens the door while the shove pushes them off the doorway tile. **Med.**

### THEME 5 — Combat lacks tactical depth
- **Healthy/retreating bots never seek cover** — `nearestCover` exists but is called *only* in the downed-crawl (`bots.ts:572,616`); retreat is a dead-straight backpedal past cover it never uses. **High.**
- **Never reload behind cover mid-fight** — reload is idle-only (`bots.ts:1053`); a heavy empties its 75-round LMG then eats a 3.2s reload standing in the open. **Med.**
- **Tanks/APCs sit empty all match** — the ride-shop excludes `speed<20` (`bots.ts:823`); the map's strongest unit is boardable only by a rare 2%/tick roll within 10u. **High.**
- **Half the per-class doctrine is inert outside TDM** — `chase`/`flank` are gated to `mode==='tdm'` (`bots.ts:1016`); in CTF/Conquest a pathfinder's `flank:0.7` never appears, so all classes close identically. **Med.**
- **Verticality is defensive-only** — the only proactive climb is a room-duty guard (`bots.ts:437`); nobody ever takes the high ground over a contested flag. **Med.**
- **Engineer's combat grenade plants a mine at its own feet** — the blanket `cmd.grenade` (`bots.ts:1042`) routes to the mine-plant branch for engineers (`world.ts:1964`), dribbling its mine budget across the ground it's strafing. **Med.**

### THEME 6 — Special agents: behavioral-quality bugs (not balance)
- **Fliers path on the ground grid** — Inferno/Stormcaller/Gargoyle follow `pathStep` BFS and detour *around* walls they cruise 5.2u *above* (`bots.ts:848` vs `world.ts:2251`); vehicles got a `flying` fast-path, LSW fliers didn't. **Med.**
- **Blind fixed-cadence casts fire into empty space** — sniperhawk rail every 2.5s down current yaw, reactor nova every 4s, magnetar every 6s, etc. (`sniperhawk.ts:53`, `reactor.ts:47`) — signatures + VO + telegraphs fire at nobody, so "the telegraph is the counterplay" cries wolf. **Low-Med.**
- **Bot Eclipse forgets half her kit and blinds herself** — her DOME is `active()`-only (never cast by a bot), and her rifle can't see through her *own* trailed smoke while enemies see her through it (`eclipse.ts:20-33`). A controller reduced to a passive smoke-emitter. **Med.**
- **Crimson blood-brute roster leak** — the brute spawns as `kind:'bot'`, respawns forever, and is never purged (`crimson.ts:45`, `world.ts:1043,1099`); a long match silently grows the Collective roster. **Med.**
- **Survival stalls on the last zombie** — `nextWaveAt=Infinity` until `zombies.length===0` (`modes.ts:388,411`); one kiting spitter or a wedged stalker freezes all wave progress. Horde/Safehouse dodge this with `targetPop`; marquee Survival doesn't. **Med.**

### THEME 7 — Code health, perf & tuning
- **`stepBot` is a 605-line god function** — 40% of the file, with the vehicle sub-brain, combat resolver, and 4 vehicle-grab blocks inlined over shared mutable locals (`bots.ts:608-1213`). **High** (maintainability).
- **Hot-loop cost** — `isolatedFriendly` is O(n²) run **every tick per bot** (≈O(n³), `bots.ts:348-367`); the separation loop **re-allocates a full soldier array per bot per tick** (`bots.ts:1159`, `world.ts:3966`) — the exact GC churn the pathfinder pooling was written to avoid; `findTarget` is an O(n) LOS scan per bot per tick with no broad-phase. **Med (High under hordes).**
- **Difficulty only changes aim accuracy** — `DIFFICULTY_AIM` is its sole consumer (`bots.ts:989`); Recruit and Elite perceive, react, repath, chase, and grenade identically. A shallow ladder with no single knob to deepen it. **Med.**
- **Tuning literals scattered across 600 lines** — vision 42/95, lead 0.85, aim 0.055·(d/18+0.6), grenade band 8-24, SEP_R 5, repath 0.9+0.7, ~15 bare probabilities — no table a designer can turn. **Med.**
- **Thin test coverage of the decision core** — `findTarget`, `leadYaw`, target-priority, and difficulty-monotonicity have no direct tests; behavioral quality (do bots use powers only with a target?) regresses silently. **Med.**

---

## Recurring unlocks (the same fix serves many findings)

1. **Route bots through `perceivesNow`** → closes grass, weather, ping, cloak, and enables focus-fire (Themes 1, 2).
2. **Utility-scored objectives** → dissolves mono-mode play, flip-flop, live-carrier-hunt gap, and CTF special-case debt; enables dynamic role backfill (Theme 3).
3. **A\* + fix the walkable predicate (grass/rubble) + a stuck-escalation not gated on `!target`** → forests/breaches work, no more flood-and-oscillate, cheaper at scale (Theme 4).
4. **Reuse `nearestCover` in retreat/reload; activate `chase`/`flank`; foot anti-vehicle path** → real micro-tactics (Themes 2, 5).
5. **Split `stepBot`; a `BOT_TUNING` table with difficulty as a multiplier-set; gate the O(n²) scans to repath cadence** → maintainable, tunable, faster, deeper difficulty (Theme 7).
6. **Gate LSW casts on a real target; give fliers an air fast-path; fix Eclipse/Crimson/Survival-stall** → the boss/horde modes stop feeling dumb (Theme 6).
