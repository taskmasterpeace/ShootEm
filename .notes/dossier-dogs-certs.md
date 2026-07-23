# DOSSIER FRAGMENTS — DOGS & ANIMALS · CERTIFICATIONS & SCHOOLS

Code-read evidence. Every claim carries a `file:line`. Verified against the working
tree on 2026-07-23 (branch `main`). Where this contradicts
`.notes/audit-dogs-officers.md`, **this file is the corrected one** — the
corrections are called out inline as `⚠ CORRECTION`.

Status legend:
- ✅ **WIRED** — the sim executes it; it affects play.
- 🟡 **PARTIAL** — real code runs, but scoped/gated so most players never see it.
- 👻 **INVISIBLE** — the code runs (or the data exists) but produces no perceptible effect.
- ⬜ **UNBUILT** — named in labels/fiction only; no gameplay code behind it.

---

# ═══ FRAGMENT A — DOGS & ANIMALS ═══

**Headline:** the military working dog is a first-class `Soldier` with
`kind: 'dog'` (`src/sim/types.ts:436`). It spawns, paths, bites, hauls, dies,
redeploys, has a bespoke brain, a bespoke quadruped model + trot, a replicated
order state, a HUD panel and key/gamepad bindings. **It is the only animal in
the game.**

## A1 · STATUS TABLE

| # | System | Status | What it does | Cite |
|---|--------|--------|--------------|------|
| 1 | Dog entity + stats | ✅ WIRED | `addDog()` builds a full `Soldier`; `DOG_STATS` is the single archetype (no breeds/variants) | `src/sim/world.ts:1613`, `src/sim/data.ts:839-847` |
| 2 | Bite weapon `dog_bite` | ✅ WIRED | Melee weapon def, 16 dmg / 1.6 rof / 2.0 range | `src/sim/data.ts:96` |
| 3 | Service names | ✅ WIRED | 8-name pool, rolled off the world RNG | `src/sim/data.ts:849`, `src/sim/world.ts:1619` |
| 4 | Auto-fielding (SP) | ✅ WIRED | One K9 per side in every mode except `range`/`paintball`/races | `src/main.ts:1277-1281` |
| 5 | Auto-fielding (MP) | ✅ WIRED | Server pairs each side's dog to its first infantry/engineer **bot** — never the human | `src/server/server.ts:95-99` |
| 6 | Handler selection | ✅ WIRED | alive + on-team + human/bot + classId infantry\|engineer; prefers `preferredId`, then any **bot**, then first eligible | `src/sim/k9-orders.ts:27-36` |
| 7 | Player agency to field a dog | ⬜ UNBUILT | No loadout slot, purchase, kennel, or toggle. It is automatic and unchosen. Grep: `addDog` has exactly 3 call sites (`main.ts:1280`, `server.ts:99`, `science-runtime.ts:224`) | — |
| 8 | Pack support (`allowPack`) | 🟡 PARTIAL | `addDog(handler, true)` bypasses the one-per-team guard; only science calls it | `src/sim/world.ts:1613-1617`, `src/sim/science-runtime.ts:221-228` |
| 9 | Science dog teams | 🟡 PARTIAL | `dogTeams` is **0 or 1**, not N — gated on `security ≥ 0.55 && prints ≥ 3` | `src/sim/science.ts:108` |
| 10 | K9 order state (heel/sic/stay) | ✅ WIRED | 3 orders; 9 fields live on the dog Soldier so they replicate for free | `src/sim/types.ts:457-458, 546-563` |
| 11 | `issueK9Command` | ✅ WIRED | Finds owned dog, validates alive, resolves aim→building, sets order | `src/sim/k9-orders.ts:172-189` |
| 12 | `stepDog` brain | ✅ WIRED | Per-tick priority ladder; dispatched from the world soldier loop | `src/sim/bots.ts:1880-1989`, dispatch `src/sim/world.ts:2384` |
| 13 | THE NOSE (anti-stealth ping) | ✅ WIRED | Every hostile in `noseRadius` added to `world.pinged` — cloak-piercing, wall-ignoring | `src/sim/bots.ts:1883-1891` |
| 14 | `sic` building clear | ✅ WIRED | Hostile hunt inside the building, else deterministic room/door sweep, then "BUILDING CLEAR" | `src/sim/bots.ts:1812-1872` |
| 15 | Door-waiting bark | ✅ WIRED | Dog stops at a closed door, barks every 5 s, goes loud; **cannot open doors** | `src/sim/bots.ts:1740-1762`, `src/sim/k9-orders.ts:152-170` |
| 16 | `stay` hold & bite | ✅ WIRED | Anchors, bites anything in bite-range+0.5, self-corrects past 0.18u drift | `src/sim/bots.ts:1790-1810` |
| 17 | Bite haul (pull toward jaws) | ✅ WIRED | Dog-only extra impulse of 5 toward the dog, on top of the generic melee shove | `src/sim/world.ts:4607-4612` |
| 18 | Fast bite windup | ✅ WIRED | 0.2 s (vs 0.25 default, brute 0.4, sprinter 0.18) | `src/sim/world.ts:223-228` |
| 19 | Indoor scent trail | 🟡 PARTIAL | Trail laid + followed, but **only team-0 operators lay scent** (see TRAP T1) | write `src/sim/world.ts:2206-2212`; read `src/sim/bots.ts:1944-1965`; impl `src/sim/indoor-ai.ts:218-252` |
| 20 | Window hesitation | ✅ WIRED | Speed × 0.35 when the path crosses an **unbroken** window pane | `src/sim/bots.ts:1952`, `src/sim/indoor-ai.ts:257-269` |
| 21 | Death / redeploy | ✅ WIRED | Redeploys at the handler's side, full HP, no armory/spawn queue; deleted if the handler leaves | `src/sim/world.ts:1763-1778` (spawn branch), `2216-2221` (respawn wave) |
| 22 | Corpse-purge exemption | ✅ WIRED | Dogs are not swept by the non-human purge | `src/sim/world.ts:2406` |
| 23 | Morale exemption | ✅ WIRED | Dogs skipped by the morale/leadership loop entirely | `src/sim/world.ts:2437` |
| 24 | Loot exemption | ✅ WIRED | "dogs have no pockets" — no pickups | `src/sim/world.ts:8059` |
| 25 | Rescue exemption | ✅ WIRED | Bots never designate a dog as the isolated friendly to rescue | `src/sim/bots.ts:175` |
| 26 | Ladder ban / stairs OK | ✅ WIRED | `actorCanUseVerticalTransition` refuses ladders to dogs, allows stairs | `src/sim/map-layers.ts:106-108`, enforced `src/sim/world.ts:5135` (stairs), `:5335` (ladder) |
| 27 | Model (`buildDog`) | ✅ WIRED | Shepherd body, saddle, snout, ears, tail, 4 named leg joints, team-colored K9 harness | `src/client/models/soldiers.ts:559-640`, dispatch `:136` |
| 28 | Trot animation | ✅ WIRED | Diagonal leg pairs anti-phase, tail wag, head drop; `footstep:false, growl:false` | `src/client/animation.ts:204-221`; joint names `:16` |
| 29 | Order marker sprite | ✅ WIRED | Floating sic/stay sprite above **your own** dog, pulsing opacity | `src/client/renderer.ts:2971-2987`; kind from `src/client/k9-controls.ts:30-33` |
| 30 | Low name tag | ✅ WIRED | Name sprite hangs at y=1.55 vs 2.55 for people | `src/client/renderer.ts:3093` |
| 31 | No armory piece / no land-squash | ✅ WIRED | Dogs never wear a carried weapon mesh; excluded from the coil-leap landing dress | `src/client/renderer.ts:2886-2889`, `:5341` |
| 32 | HUD control panel | ✅ WIRED | Derived purely from replicated sim state; 4 statuses | `src/client/k9-controls.ts:12-28`, painted `src/client/hud.ts:496-503` |
| 33 | Phantom LSW counter | ✅ WIRED | A phase-blink landing within **12u** of any enemy dog is uncloaked and the strike is cancelled | `src/sim/lsw/phantom.ts:37-47` |
| 34 | Minimap classification | ✅ WIRED | Dogs read as soldiers, not horde | `src/client/hud.ts:1528` |
| 35 | Pack coordination AI | ⬜ UNBUILT | Each dog runs its own independent `stepDog`; no flanking/relay. No grep hit for pack logic. | — |
| 36 | Breeds / roles / handler bond | ⬜ UNBUILT | One `DOG_STATS` block; no breed field anywhere in `types.ts` | `src/sim/data.ts:839-847` |
| 37 | Dog fear / stamina / wounded state | ⬜ UNBUILT | Nothing in `stepDog` reads `s.hp`; morale loop excludes dogs (`world.ts:2437`) | — |
| 38 | Meta-consequence for losing the dog | ⬜ UNBUILT | Respawn is unconditional once the handler is up; no cost, cooldown, or record | `src/sim/world.ts:2216-2221` |

## A2 · EXACT NUMBERS (tune without hunting)

**`DOG_STATS` — `src/sim/data.ts:839-847`**

| Field | Value | Note |
|-------|-------|------|
| `hp` / `maxHp` | **60** | set at `world.ts:1622`, reset on redeploy `world.ts:1766` |
| `speed` | **16.8** | "~1.6× an infantryman" |
| `weapon` | `dog_bite` | the dog's only weapon: `weapons: [DOG_STATS.weapon]`, `world.ts:1623` |
| `heelDist` | **4** | trailing distance off the handler's shoulder, read `bots.ts:1968` |
| `guardRadius` | **18** | measured from the **HANDLER**, not the dog — `bots.ts:1919` |
| `noseRadius` | **10** | ping radius, floor-weighted ×4 — `bots.ts:1885-1891` |

**`dog_bite` — `src/sim/data.ts:96`**

| Field | Value |
|-------|-------|
| `damage` | **16** |
| `rof` | **1.6** → bite cadence `nextFireAt = time + 1/1.6 = 0.625 s` (`world.ts:4510`) |
| `range` | **2.0** (bite triggers at `range + 0.5` = **2.5**) |
| `clip` / `reserve` | `Infinity` |
| `speed` | 20 · `spread` 0 · `sound` `claw` · `tracer` `none` · `icon` 🐕 |

**Derived / hard-coded combat numbers**

| Thing | Value | Cite |
|-------|-------|------|
| Bite windup | **0.2 s**, clamped by `min(windup, 0.8/rof = 0.5)` | `world.ts:227`, `world.ts:4512` |
| Effective bite damage | **exactly 16** — a dog has no `stats` object, so `statMul(undefined) = 1` | `world.ts:4558`, `world.ts:609-611`; `addDog` never sets `stats` (`world.ts:1618-1636`) |
| Generic melee shove on hit | `3 + (force? knockback)` | `world.ts:4605` |
| **Dog-only haul toward jaws** | **+5** impulse | `world.ts:4609-4612` |
| Melee arc / max targets / stagger / lunge | `π/2` · **2** · 0.15 s · 7.5 | `world.ts:200,202,204,206` |
| A raised GUARD blocks a bite | soak **0.12**, parry stagger 0.5 s, arc 150° | `world.ts:4590-4599`, consts `:222-226` |
| Nose vertical weighting | `(floorΔ) × 4` inside the hypot | `bots.ts:1888` |
| Guard-target repath cadence | 0.5 s | `bots.ts:1929` |
| Scent repath cadence | 0.45 s | `bots.ts:1947` |
| Heel repath cadence | 0.6 s, re-target if goal < 1.5u | `bots.ts:1971-1972` |
| Heel trot speed | `speed` if handler > 10u away, else `speed × 0.7` | `bots.ts:1978` |
| Window-crossing speed | `speed × 0.35` | `bots.ts:1952` |
| Stay anchor drift threshold | **0.18 u** | `bots.ts:1800` |
| `sic` target sort | `|floorΔ| × 20 + planar distance`, tie-break by id | `bots.ts:1814-1818` |
| `sic` waypoint arrival | < **1.2 u** on the same floor | `bots.ts:1848` |
| "BUILDING CLEAR" confirm hold | **2 s** quiet | `bots.ts:1867` |
| Door bark interval | **5 s**, `loudUntil = time + 1.5` | `bots.ts:1753-1754` |
| Scent bark interval | **5 s**, `loudUntil = time + 1.5` | `bots.ts:1958-1960` |
| `driveK9Toward` repath | 0.4 s with a goal, 1.2 s without; re-goal within 0.8u | `bots.ts:1765-1775` |
| Building snap tolerance for `sic` | **8 u** (`K9_BUILDING_SNAP`) | `src/sim/k9-orders.ts:13, 60-73` |
| Sic aim distance | player yaw × `cmd.aimDist ?? 12`, clamped **0–80** | `world.ts:3273`, `k9-orders.ts:38-47` |
| Spawn jitter around handler | ±1.5 u on X and Z | `world.ts:1621`, `world.ts:1774` |
| Phantom-LSW dog detection radius | **12 u** | `src/sim/lsw/phantom.ts:41` |
| Scent memory | `SCENT_SECONDS = 8` s, `SCENT_NODES = 24` max nodes | `src/sim/indoor-ai.ts:50-51` |
| Scent node throttle | new node only if >0.34 s **or** >0.75 u from the last | `src/sim/indoor-ai.ts:221` |
| Scent pull radius from handler | `DOG_HANDLER_PULL = 32` u | `src/sim/indoor-ai.ts:52`, used `:245` |
| Science dog count | `security ≥ 0.55 && prints ≥ 3 ? 1 : 0` | `src/sim/science.ts:108` |
| Science dog threat weight | `dogTeams × 12` | `src/sim/science.ts:115` |
| Science `dogPosts` available | 2 spread ground-floor guard posts | `src/sim/science-map.ts:225` |

## A3 · THE CONTROL SURFACE (every binding)

| Input | Command | Cite |
|-------|---------|------|
| Keyboard **K** | `sic` — clear the aimed building | `src/client/input.ts:133` |
| Keyboard **L** | `stay` — toggles stay ⇄ heel | `src/client/input.ts:134` |
| Gamepad **button 10 (L3)** | `sic` | `src/client/input.ts:240` |
| Gamepad **button 11 (R3)** | `stay` | `src/client/input.ts:241` |
| On-screen `#k9-sic` (also the touch affordance) | `sic` via `input.queueK9('sic')` | `src/main.ts:783`, markup `index.html:71-73` |
| On-screen `#k9-stay` | `stay` via `input.queueK9('stay')` | `src/main.ts:784`, markup `index.html:74-76` |
| Programmatic seam | `InputManager.queueK9(command)` | `src/client/input.ts:184` |
| Wire format | `cmd.k9?: K9Command` on `PlayerCmd`, packed at `input.ts:291` | `src/sim/types.ts:1492` |

⚠ **CORRECTION vs the old audit:** there is **no separate touch layer**. The
`#k9-sic`/`#k9-stay` DOM buttons in `index.html:69-77` *are* the touch path;
grep for `k9` in any `touch*`/`mobile*` client file returns nothing (no such
file exists — see `ls src/client`).

**Panel behaviour** — `src/client/k9-controls.ts:12-28`:
- Visible only when the local soldier is `alive && !downed` **and** owns a live dog
  (`candidate.ownerId === local.id`). `hud.ts:498` toggles `.hidden`.
- Status strings: `HEEL` · `STAY` · `CLEARING` · `WAITING · DOOR`
  (`k9-controls.ts:18-20`); `hud.ts:503` adds a `.waiting` class for the amber
  readout at `styles.css:576`.
- Button label flips STAY⇄HEEL from the same state (`k9-controls.ts:25`).
- Panel CSS + mobile layout: `src/styles.css:560-598`.

**Feedback events** the player gets:
- Order accepted → `K9 · CLEARING|STAY|HEEL` announce (`world.ts:3279-3281`).
- Order refused because the mark wasn't a building → `NO BUILDING AT MARK`
  (`world.ts:3275`). The `no-dog` / `dog-down` refusals are **silent** —
  `world.ts:3274` only handles `'no-building'`.
- Dog barks: `<name> · WAITING AT DOOR` (`bots.ts:1757`), `<name> · BUILDING CLEAR`
  (`bots.ts:1868`), `<name> HAS THE SCENT` (`bots.ts:1961`).

## A4 · TRAPS

**T1 — the team-0-only scent gate is REAL. `src/sim/world.ts:2209`.**
```ts
if (!operator.alive || operator.team !== 0 || (operator.kind !== 'human' && operator.kind !== 'bot')) continue;
recordIndoorScent(this.indoorTactics, operator.id, { ...operator.pos, y: operator.floor * 4 }, this.time);
```
Verified verbatim. Only **team 0** lays scent nodes.
*Consequence:* `strongestDogScent` (`bots.ts:1944`) reads the union of ALL trails
(`indoor-ai.ts:243` iterates `state.scents.values()` with no team filter), so:
- A **team-1** dog tracks team-0 intruders correctly. This is the science/safehouse
  case (raiders = team 0, guards + their dogs = team 1) and is presumably why it
  was written this way.
- A **team-0** dog follows its **own team's** trail and pings its own teammates:
  `bots.ts:1956` does `w.pinged.add(scent.targetId)` unconditionally. In symmetric
  PvP the player's own dog wanders onto friendly scent and marks friendlies into
  `world.pinged`.
- The whole block is additionally gated on `this.indoorTactics` existing at all
  (`world.ts:2208`) — outdoor maps never allocate it (`world.ts` creates it only
  for maps with rooms), so scent is silent on most maps.

**T2 — `guardRadius` measures from the HANDLER, `noseRadius` from the DOG.**
`bots.ts:1919` filters on distance to `handler.pos`; `bots.ts:1920` then ranks by
distance to the **dog**. A dog 30u from its handler still only engages things
within 18u of the *handler*. Changing one radius without the other silently
breaks the leash geometry.

**T3 — the guard scan skips vehicles and scientists.** `bots.ts:1917`:
`e.vehicleId >= 0 || e.kind === 'scientist'` → `continue`. A dog will not attack
anyone in a seat and will not attack the VIP. `nearestK9Threat` (used only by
`stay`, `bots.ts:1727-1738`) uses a **different** filter — it requires
`kind === 'human' || 'bot'` and **same floor**, and does *not* exclude vehicle
occupants. The two threat scans disagree; a `stay` dog will bite a seated enemy,
a `heel` dog won't.

**T4 — `stay` biting ignores `pinged`/cloak.** `nearestK9Threat` has no cloak
check, so a `stay` dog bites cloaked enemies at bite range regardless. The heel
brain *does* check (`bots.ts:1921`). Don't assume one anti-stealth rule.

**T5 — the nose ignores walls.** `bots.ts:1885-1891` is a raw `hypot` with a
floor term; no LOS, no wall test. A dog "smells" through a bunker wall at 10u.
This feeds `world.pinged`, the same channel spy cameras use, and perception
treats a pinged unit as visible **through cloak**. It is load-bearing
anti-stealth, so any wall-respecting change is a balance change, not a bugfix.

**T6 — dogs are outside four global loops.** Morale (`world.ts:2437`), the
corpse purge (`world.ts:2406`), pickups (`world.ts:8059`), and bot-rescue target
selection (`bots.ts:175`). Adding a new per-soldier loop? Decide explicitly
whether dogs belong, or you'll get a dog with a shaken flag, a deleted dog
corpse, a dog carrying a medkit, or a squad diverting to rescue the dog.

**T7 — dogs are exempt from the class-request "officer" loop by construction.**
`redeployAs` (`world.ts:1732`) is only reachable from `main.ts:1045` for the
local human; a dog never redeploys through it (`spawn()` short-circuits at
`world.ts:1765` before the class/loadout machinery). `classId` on a dog is
nominally `'infantry'` (`world.ts:1620`) and **inert** — it exists only so the
Soldier type is satisfied and so class-count code doesn't crash. If you ever
count team composition by `classId`, **the dog inflates your infantry count.**

**T8 — the RNG/id-sequence trap (determinism).** `addDog` consumes the shared
world RNG three times — `rng.int` for the name (`world.ts:1619`) and two
`rng.range` calls for the spawn jitter (`world.ts:1621`) — plus one `this.id()`
(`world.ts:995`, a monotonic counter). Dogs are added **after** all bots in
`main.ts:1277-1281`. Moving, adding, or conditionally skipping a dog shifts every
subsequent RNG draw and every subsequent entity id, which will change unrelated
sim outcomes and break snapshot/replay determinism. Same hazard in
`science-runtime.ts:221-228`, which spawns its dogs *after* the guards.

**T9 — `allowPack` defaults to FALSE and silently returns the existing dog.**
`world.ts:1613-1617`: `addDog(handler)` with a dog already on that team returns
**the other dog** without re-pairing it to your handler. It looks like a spawn
and isn't. In science mode both paths run — `main.ts:1280` (one per team) and
`science-runtime.ts:224` (`allowPack = true`) — so **team 1 can carry two dogs
in a science mission**, one owned by a guard bot and one owned by a `dogPost`
guard.

⚠ **CORRECTION vs the old audit:** science does **not** spawn "N dogs".
`dogTeams` is `0 or 1` (`science.ts:108`), and only 2 `dogPosts` exist
(`science-map.ts:225`). There is no pack in practice anywhere in the game.

**T10 — the dog cannot open doors or climb ladders.** `dogWaitsAtDoor`
(`bots.ts:1740-1762`) zeroes velocity and returns `true` *from inside*
`driveK9Toward` (`bots.ts:1782`), so the caller silently loses its movement.
Metal doors on floor 0 are *excluded* from the block check
(`k9-orders.ts:165`: `(upper || tile !== T_METAL_DOOR)`), meaning the dog will
walk into a closed ground-floor metal door and neither bark nor pass. Ladders
are hard-refused (`map-layers.ts:107`), so a `sic` on a ladder-only upper floor
never completes — the sweep stalls at the waypoint forever (no timeout exists in
`stepK9Sic`).

**T11 — order fields are ALL optional and cleared as a set.** `setK9Heel`
(`k9-orders.ts:75-87`) resets nine fields plus `botGoal`/`botRepathAt`. Adding a
new `k9*` field means adding it to **all three** setters (`setK9Heel`,
`setK9Stay`, `setK9Sic`, `k9-orders.ts:75-119`) or it leaks across orders.

**T12 — `stay` is a toggle, not a set.** `setK9Stay` on an already-staying dog
falls through to `setK9Heel` (`k9-orders.ts:90-93`). A UI that "sets stay"
twice cancels it.

**T13 — the panel is invisible to most players.** `k9HandlerForTeam`
(`k9-orders.ts:30-35`) only accepts `infantry` or `engineer`. A medic/heavy/ghost
player never owns the dog, so `k9ControlState.visible` is false and K/L/L3/R3 do
nothing. In **multiplayer the human never owns a dog at all** — `server.ts:96-98`
searches `s.kind === 'bot'` explicitly.

**T14 — no per-tick `hp` reaction.** `stepDog` never reads `s.hp`. A 1-HP dog
charges identically to a full one.

## A5 · ANIMALS SWEEP — is there any other animal?

**No. One species.** Exhaustive check:

| Candidate | Verdict | Cite |
|-----------|---------|------|
| `kennel` | **Building floorplan template only.** A 5-row ASCII interior in the `military` category, themed savanna/titan/asteroid. It does not spawn, house, or reference a dog. Its only other appearance is a display label. | `src/sim/buildings.ts:297-303`, label `src/sim/skirmish.ts:140` |
| `junkhound` | **A MACHINE, not an animal.** One of four Iron Eaters (`hp 55, plate 35, speed 15`), borrows `dog_bite` and a dog silhouette. Named with a serial (`HOUND-03`), explicitly "machine to the last". | `src/sim/data.ts:834`, `src/sim/world.ts:1699-1727`, kind `src/sim/types.ts:436` |
| `DOG_NAMES` "kennel" comment | Flavor text on the name pool. | `src/sim/data.ts:848` |
| `scraprat` / `weaver` / `ravager` | Iron Eaters — machines, same table. | `src/sim/data.ts:833-836` |
| `barn` | Building floorplan template, `house` category. Empty of livestock. | `src/sim/buildings.ts:310`, label `src/sim/skirmish.ts:140` |
| "goat paths" | Terrain feature name in the front generator (one-tile infantry threads). | `src/sim/fronts.ts:965, 1055` |
| "the bird" / Falcon / Barracuda / Pike / Mastodon | **Aircraft, boats, tanks.** Vehicle names and slang. | `src/sim/data.ts:480-524, 716`, `src/sim/military-missions.ts:146,174`, `src/sim/world.ts:4790,4839` |
| "spider mine" | Engineer's walking mine — a device. | `src/sim/types.ts:1208-1211`, `src/sim/world.ts:4282, 8007` |
| "lone wolf", "swarm", "predator/prey" | Metaphors in AI/mode comments. | `src/sim/bots.ts:1322`, `src/sim/world.ts:4839` |
| THE STABLE | **Not an animal stable.** It is the LSW-summoning console. | `src/client/stable.ts:1-8` |

**Conclusion:** the game's animal kingdom is exactly one entity kind — `'dog'`.
No birds, mounts, wildlife, pests, livestock, or stubs thereof. There is no
kennel *system*, only a kennel *floorplan*.

---

# ═══ FRAGMENT B — CERTIFICATIONS & SCHOOLS ═══

**Headline:** twelve vehicle licences exist as a real, tested register with a
prerequisite chain and twelve drivable courses. They produce **exactly one**
gameplay effect (the driver's seat), and **only in singleplayer**, and only for
the human. Everything else the word "certification" touches in this codebase is
a different, unrelated system.

## B1 · THE FULL 12-LICENCE REGISTER

Source: `src/sim/licenses.ts:42-56`. `tier` is display order only (1 = first day,
5 = the trusted seat) — nothing reads it as a gate. `hulls` computed via
`hullsUnder()` (`licenses.ts:113-115`) against the 80-vehicle fleet.

| id | Name | Tier | School | Covers | Prereq | Hulls gated | Cite |
|----|------|------|--------|--------|--------|-------------|------|
| `basic_driver` | Basic Driver | 1 | Motor Pool | Cars, runabouts, bikes, light utility | — | **19** | `licenses.ts:44` |
| `heavy_truck` | Heavy Truck | 2 | Motor Pool | Trucks, buses, plant, air brakes | `basic_driver` | **12** | `licenses.ts:45` |
| `apc` | APC | 3 | Armour School | APCs and protected transports | `heavy_truck` | **1** | `licenses.ts:46` |
| `tank` | Tank | 4 | Armour School | MBTs, assault walkers, tracked breachers | `apc` | **3** | `licenses.ts:47` |
| `hovercraft` | Hovercraft | 2 | Motor Pool | Hover decks, skirted hulls, raceboards | `basic_driver` | **5** | `licenses.ts:48` |
| `boat` | Boat | 2 | Naval Yard | Surface craft, gunboats, anything afloat | — | **11** | `licenses.ts:49` |
| `helicopter` | Helicopter | 3 | Flight School | Rotary wing | — | **7** | `licenses.ts:50` |
| `fixed_wing` | Fixed Wing | 3 | Flight School | Aircraft that cannot hover | — | **8** | `licenses.ts:51` |
| `bomber` | Bomber | 5 | Flight School | Heavy payload airframes | `fixed_wing` | **2** | `licenses.ts:52` |
| `transport` | Transport | 3 | Flight School | Crewed lifters, large-hull passenger craft | `heavy_truck` | **4** | `licenses.ts:53` |
| `drone_pilot` | Drone Pilot | 2 | Signals School | Remote hulls and FPV drones | — | **0** ⚠ | `licenses.ts:54` |
| `dropship` | Dropship | 5 | Flight School | Combat insertion craft | `transport` | **1** | `licenses.ts:55` |
| `none` | *No licence required* | 1 | — | Anything a soldier can push, pedal or ride | — | **7** | `licenses.ts:43` |

Full chains (`licenceChain`, `licenses.ts:95-103`, all licences awarded together
by `awardLicence`):
- `tank` → `basic_driver → heavy_truck → apc → tank`
- `bomber` → `fixed_wing → bomber`
- `dropship` → `basic_driver → heavy_truck → transport → dropship`
- `apc` → `basic_driver → heavy_truck → apc`
- `hovercraft` → `basic_driver → hovercraft`
- `boat`, `helicopter`, `fixed_wing`, `drone_pilot` — single-step (no prereq)

Assignment rule (`licenceFor`, `licenses.ts:78-92`): explicit `OVERRIDES` table
(`licenses.ts:59-75`) first, then shape inference —
`flies && minAirspeed → fixed_wing` · `flies → helicopter` · `boat → boat` ·
`hover → hovercraft` · `immobile → none` · else `basic_driver`.
Note the comment at `licenses.ts:83-86`: in this codebase `hover` means
"crosses water", not "hovers in place".

## B2 · THE ONE GAMEPLAY EFFECT — the driver's seat

**The gate:** `World.mayDrive` — `src/sim/world.ts:5457-5460`
```ts
mayDrive(s: Soldier, kind: VehicleKind): boolean {
  if (!s.papers) return true;
  return licenceHeld(s.papers, kind);
}
```

**Where it fires:** `tryEnterVehicle` — `src/sim/world.ts:5505-5520`. Called from
the `use` verb at `world.ts:3850`.

**Bench, not refusal** (`world.ts:5505-5519`):
1. `if (seat === 0 && !this.mayDrive(s, v.kind))` — the check runs **only on seat 0**.
2. It searches for a free non-driver seat: `v.seats.findIndex((x, i) => i > 0 && x < 0)`.
3. **If a bench exists** → `seat = bench`, and the player rides. Announce:
   `NOT CERTIFIED TO DRIVE — RIDING · <LICENCE> at <School>` (`world.ts:5517-5519`).
4. **If no bench exists** → hard refusal, `return` before any seating. Announce:
   `<HULL> — NOT CERTIFIED · <LICENCE> (<School>)` (`world.ts:5510-5513`).

So on a single-seat hull the licence is a full lockout; on anything with a
passenger seat it is a demotion to passenger. The comment at `world.ts:5485-5492`
states the design intent explicitly: *"you are not barred from the truck, you are
barred from DRIVING the truck."*

**Why bots are never gated:** `mayDrive` returns `true` when `s.papers` is
`undefined`, and `papers` is only stamped onto **human** prints:
`world.ts:1076-1079`
```ts
if (kind === 'human') {
  if (this.opts.papers) s.papers = [...this.opts.papers];
```
The field is declared optional at `src/sim/types.ts:618` with the doc comment
"ABSENT MEANS ISSUED". `WorldOpts.papers` is documented at `world.ts:401-406`.

**Who supplies `opts.papers`:** exactly one call site —
`src/main.ts:978` `papers: loadLicences().held`.

⚠ **`world.ts:5505` is the ONLY consumer of the licence system in the sim.**
Grep for `mayDrive` / `licenceHeld` returns: the definition, this one call, and
one read-only client display (`src/client/gonet/briefings.ts:64`, which colours
the mission-board hull chips). Nothing else gates on a licence.

## B3 · HOW A CERT IS EARNED — the course/exam flow

**1. Enrol.** The Schools shelf paints an enrolment board:
`paintSchoolBoard` — `src/main.ts:513-560`. Each card shows the program name,
school, the training hull, the brief, every drill lesson, par, your best time,
and one of `CERTIFIED` / `OPEN` / `NEEDS <prereq>` (`main.ts:521-523`).
Eligibility comes from `canEnrol` (`src/client/licences.ts:59-64`): every step
of the chain **before** the target must already be held.
Clicking ENROL sets `enrolledCourse` and `selectedMode = 'school'`
(`main.ts:553-557`).

**2. Launch.** `src/main.ts:1138-1152`: the world's mode state gets
`courseLicence` and `coursePar`; the course is laid with `layCourse`; the player
is teleported 30u before gate 1; the training hull is spawned; and
`world.forceBoard(me, hull)` seats the candidate — no walk-up.

**3. The course geometry.** `src/sim/courses.ts:181-258`. Six drill kinds
(`straight`, `slalom`, `brakebox`, `handbrake`, `parking`, `circuit`,
`courses.ts:20`) each lay their own gates procedurally along +X (`layDrill`,
`courses.ts:181-222`). `layCourse` serpentines: when the cursor passes
`FOLD_X = 20` it lays a U-turn plus link gates down a new lane
`LANE = 58` apart with `LINK_STEP = 55` (`courses.ts:233-252`). Default gate
radius `GATE_R = 4.5` (`courses.ts:177`); tight gates are 3.2 (brakebox), 2.6
(parking bay), 4 (slalom/handbrake). Pure and deterministic — no RNG, no map
dependency.

**4. The exam.** `stepSchool` — `src/sim/modes.ts:828-865`, dispatched from
`stepMode` at `modes.ts:167`. Mode init at `modes.ts:21-27` sets
`timeLeft = Infinity`, `courseGate = 0`, `coursePassed = false`.

Per tick, for the **current** gate index only:
```ts
const d = Math.hypot(s.pos.x - gate.pos.x, s.pos.z - gate.pos.z);
if (d > gate.radius) continue;
m.courseGate = idx + 1;
```
On the last gate → `coursePassed = true; over = true; winner = 0`, and an announce
that reads `COURSE COMPLETE — QUALIFIED, INSIDE PAR` if `w.time <= coursePar`,
else `COURSE COMPLETE — QUALIFIED` (`modes.ts:843-855`). Crossing into a new
drill fires that drill's lesson as an announce (`modes.ts:855-862`).

**5. The signature.** `src/main.ts:1581-1588` — on `over && coursePassed`,
`awardLicence(enrolledCourse, world.time)`
(`src/client/licences.ts:41-50`). `awardLicence` grants **the whole chain**
(`licences.ts:43`) and records a personal best in `r.best[id]` only if faster
(`licences.ts:44-47`). Storage: `localStorage['ww_licences']`
(`licences.ts:11, 21-24`), account-scoped, survives every print.

### What the exam ACTUALLY checks — and does not

| Checked | Cite |
|---------|------|
| You touched gate *n* before gate *n+1* (strict order — only the current index is tested) | `modes.ts:833-841` |
| You were within `gate.radius` in the **XZ plane** | `modes.ts:838` |
| You reached the last gate | `modes.ts:843` |

| **NOT** checked | Evidence |
|-----------------|----------|
| **That you are in the hull at all.** The comment says so: *"on foot counts too"* | `modes.ts:835-836` |
| That you are in the **right** hull. No `vehicleId`/`kind` read anywhere in `stepSchool`. | `modes.ts:828-865` |
| **Altitude.** `Math.hypot(x, z)` only — a plane 400 m overhead clears every ground gate. | `modes.ts:838` |
| **That you stopped in the brakebox / parked in the bay.** No velocity read exists; the tight radius is the entire "test". | `courses.ts:194-207` |
| **Time.** Par only picks which of two congratulation strings prints. There is no fail branch — the doc comment states *"no failure state, no wash-out"*. | `modes.ts:824-827, 847-853` |
| **Damage / collisions / cones.** Nothing. | — |
| **Who the candidate is.** The loop is `w.humansAndBots()` — **any** living bot on the field advances your gate counter. | `modes.ts:837` |

## B4 · SECOND-ORDER EFFECT — certs → service score → rank

**Points value: a certification is worth `30` service.**
`SERVICE_POINTS.certification = 30` — `src/sim/ranks.ts:49-58`, with the comment
*"a certification is worth more than thirty kills, because the canon says
knowledge is the progression."*

Full table (`ranks.ts:49-58`): `matchFought 5` · `matchWon 15` · `kill 1` ·
`medal 25` · **`certification 30`** · `trackRecord 10` · `skillBand 8`.

**The path:**
1. `serviceRecord()` counts held licences that have a course:
   `certifications: all.filter((l) => lic.held.includes(l)).length` where
   `all = Object.keys(COURSES)` — `src/client/service.ts:57-73`.
   All 12 licences have courses (`courses.ts:50-173`), so the ceiling is
   **12 × 30 = 360 service points from certifications**.
2. `serviceScore()` sums it — `ranks.ts:75-83`.
3. `rankFor(score)` picks the rung — `ranks.ts:86-90`. Rank is **read, never
   stored** (`service.ts:9-10, 78`).
4. `currentRank().id` is handed to the sim at launch as `opts.rank`
   (`src/main.ts:985`), stamped onto the human print at `world.ts:1078`.

**What the rank then does (the only two sim effects):**
- `leadershipRadius(rankId)` — `ranks.ts:115-118`: `0` below Corporal, then
  `10 + (rankId-2)*4` (Corporal 10 → General 38). Consumed in the morale loop at
  `world.ts:2444-2448` (`MORALE_SHIFTS.ledWell`).
- `mayCallStable(rankId) → rankId >= 5` — `ranks.ts:104,107`, enforced at
  `world.ts:1205-1211` (refusal announce at `:1208`: `THE STABLE ANSWERS LIEUTENANTS`).

**Ladder thresholds** (`ranks.ts:34-45`): Recruit 0 · Private 25 · Corporal 70 ·
Sergeant 160 · Staff Sergeant 300 · **Lieutenant 520** · Captain 820 · Major 1220
· Colonel 1750 · General 2500.

So 12 certifications alone = 360 points = **Staff Sergeant** (300), and get you
69% of the way to the Lieutenant line that unlocks THE STABLE.

`materielBonus` (`ranks.ts:121`) is defined and **never imported anywhere** —
grep returns only its own definition line. Staff Sergeant's "heavier opening
manifest" and Major's "full manifest" have no code behind them. 👻 INVISIBLE.

## B5 · THE THREE UNRELATED THINGS CALLED "CERTIFICATION"

| # | System | What it is | Storage | Does it gate anything? |
|---|--------|-----------|---------|------------------------|
| 1 | **Vehicle licences** | The 12-licence register + 12 courses | `localStorage['ww_licences']` (`licences.ts:11`) | **YES — the only one that gates.** Driver's seat, `world.ts:5505`. Plus a read-only readiness colour on the mission board (`gonet/briefings.ts:64, 116-130`). |
| 2 | **The infantry qualification** | The Proving Grounds run in `range` mode: 6 dummy targets, a clock, `scoreRun(elapsed)` = `100 - max(0, elapsed-6)*4` clamped 0-100 (`range.ts:14-16`); grades Expert ≥90 / Sharpshooter ≥75 / Marksman ≥55 / Qualified (`range.ts:18-20`). The **first official run is permanent** (`range.ts:121-123`) and pays `score` straight into `dossier.soldier.rankPoints` (`range.ts:124`). Posts to a 50-entry local Wall (`range.ts:22-33`). | IndexedDB dossier (`record.ts:60` `quals`) + `localStorage['ww_wall_infantry']` (`range.ts:23`) | **NO.** Grep for `quals`: 3 write sites in `range.ts`, 2 type/init sites in `record.ts`, and **one read** — a display block in the barracks card at `main.ts:2000`. It gates nothing. Its only mechanical effect is the `rankPoints` deposit. |
| 3 | **Command certification** | An operations-career grade ladder off `certificationPoints`: Provisional Command (0) / Field Certified (4) / Combined-Arms Certified (10) / Operation Officer (20) — `record.ts:119-129`. Points accrue per operation: `completedPhases + (won ? 2 : 0) + (cleanSheet ? 1 : 0) - min(2, collateral)`, floored at 0 — `record.ts:151-152`. | IndexedDB dossier `operations.certificationPoints` (`record.ts:41`) | **NO.** `commandCertification` is called at `main.ts:1656` (debrief line), `main.ts:1970/1993` (barracks stat row) and `record.ts:139-173` (its own recorder). Pure display. |

**Also worth knowing: there are TWO INDEPENDENT RANK LADDERS.**
- `src/sim/ranks.ts:34-45` — 10 rungs, thresholds 0…2500, driven by `serviceScore`.
  This is what the sim reads (`opts.rank`).
- `src/client/record.ts:177-192` — **14** rungs (Private … Colonel), thresholds
  0…21000, driven by `dossier.soldier.rankPoints`. This is what the infantry qual
  pays into and what the STABLE console's `isCommissioned` reads:
  `(dossier?.soldier.rankPoints ?? 0) >= 8000` — `src/client/stable.ts:16-19`.
  8000 is the *record.ts* Lieutenant line (`record.ts:187`), **not** the
  *ranks.ts* Lieutenant line (520 service, `ranks.ts:40`).
  Both `rankFor` functions are exported under the same name from different modules.

## B6 · TRAPS

**T1 — `mayDrive` is a no-op in multiplayer.** The server never passes
`opts.papers`: `new World({ seed, mode, theme })` — `src/server/server.ts:106`
and `:224`. No `papers` key. Every MP body therefore has `papers === undefined`
and `mayDrive` returns `true` at `world.ts:5458`. The licence system is
**singleplayer-only** today.

**T2 — `awardLicence` grants the whole chain.** `licences.ts:43` walks
`licenceChain(id)` and pushes every missing step. Pass the tank course as a fresh
account and you are instantly signed for `basic_driver`, `heavy_truck`, `apc`
**and** `tank` — 4 certifications = 120 service points from one run. But
`canEnrol` (`licences.ts:59-64`) prevents reaching that course in the UI, so this
only bites if you call `awardLicence` directly (tests, debug, a new entry point).

**T3 — `schoolAwarded` is a module-global that is never reset.**
`src/main.ts:164` `let schoolAwarded = false;` — set `true` at `main.ts:1582` and
**assigned nowhere else** (`grep -c "schoolAwarded = false"` → 1, the declaration).
Today it survives only because `endGame()` does a full
`window.location.reload()` (`main.ts:796`). Remove or bypass that reload — an SPA
menu return, a "run it again" button, a test harness — and the **second course of
a session silently never signs papers**.

**T4 — `stepSchool` advances on ANY living human or bot.** `modes.ts:837` iterates
`w.humansAndBots()`. School mode currently spawns no bots, but any future
spectator/instructor/AI-traffic body standing near a gate completes the course
for the candidate.

**T5 — the exam does not require the vehicle.** `modes.ts:835-836` explicitly
allows walking the course. Combined with T4, "qualification" is currently
"be within 4.5u of a series of points in order".

**T6 — `coursePar` is client-supplied.** Only `main.ts:1142` sets it. In a headless
world (tests, server) it is `undefined`, so `modes.ts:847` reads
`par = Infinity` and **every run is "INSIDE PAR."**

**T7 — module-global course cache in `modes.ts`.** `schoolGates` / `schoolFor`
(`modes.ts:802-803`) live at module scope and key only on the licence id
(`modes.ts:809`). They persist across `World` instances. Two worlds running the
same licence share the cached gate array; a test that mutates gates poisons the
next test. The layout itself is pure, so this is a lifetime bug, not a
determinism bug — but it is a shared-mutable-array hazard.

**T8 — `drone_pilot` gates zero hulls.** Computed: `hullsUnder('drone_pilot')`
returns `[]` against all 80 vehicles. No entry in `OVERRIDES`
(`licenses.ts:59-75`) maps to it and no shape rule produces it
(`licenceFor`, `licenses.ts:78-92`). Earning it changes nothing except +30
service. If drones are added, they must be added to `OVERRIDES` by hand.

**T9 — the course hull is not always the hull the licence covers.**
`hovercraft`'s course trains on `hoverboard` (`courses.ts:74`) — and
`licenceFor('hoverboard') === 'none'` (`licenses.ts:65`). `drone_pilot` trains on
`buggy` (`courses.ts:154`), a `basic_driver` hull. This is **deliberate** and
encoded in the test at `tests/courses.test.ts:30-39`, which accepts
`need === c.licence || need === 'none' || need === 'basic_driver'`. Don't "fix" it
without changing that test.

**T10 — the licence gate only tests seat 0, and it runs *after* seat selection.**
`world.ts:5497-5504` computes `seat` (humans get per-hatch entry: nose → wheel,
tail → bench; bots take first-free). Only then does `world.ts:5505` check papers.
A human who walks up to the **tail** of a tank gets `seat = free.find(i => i > 0)`
and boards the bench **without any licence check at all** — the gate is never
consulted because `seat !== 0`. That is the intended "ride, don't drive" outcome,
but it means the check is positional, not a hull-level permission.

**T11 — seat-yield runs before the licence check.** `world.ts:5474-5484`: a human
approaching a full hull ejects the rear-most bot *first*. An uncertified human can
therefore evict a bot from a hull they are not allowed to drive.

**T12 — `certifications` counts only licences that have a COURSE.**
`service.ts:60` uses `Object.keys(COURSES)`, not `Object.keys(LICENCES)`. Today
those sets match (12 each), so the count is right. Add a licence without a course
and it silently stops counting toward rank.

**T13 — two `rankFor` exports, two ladders, two Lieutenant lines.** See B5. If you
touch rank, confirm which module you are in: `sim/ranks.ts` (service, 520 =
Lieutenant, read by the sim) vs `client/record.ts` (rankPoints, 8000 =
Lieutenant, read by the STABLE console at `stable.ts:18`).

**T14 — `mayCommand` is a display label.** `ranks.ts:105,108` defines it;
`service.ts:92` computes it; `service-file.ts:115` prints
`MAY TAKE COMMAND` / `MAY NOT TAKE COMMAND`. Grep shows no sim consumer. Captain's
"command seat and the doctrine package" (`ranks.ts:41`) is ⬜ UNBUILT.

**T15 — the school mode is unreachable from the mode grid.** `main.ts:599` filters
`id !== 'shop' && id !== 'school'` out of the card list, and the `schools` shelf
declares `modes: []` (`main.ts:492`). The **only** entry point is the ENROL button
on the school board (`main.ts:553-557`). `MODE_INFO.school` exists
(`src/sim/data.ts:862`) purely for the label.

---

## Cross-fragment note

Both features share the same shape: a well-built, tested, data-clean sim layer
with a single narrow enforcement seam — for dogs it is `world.pinged`
(`bots.ts:1891`), for certifications it is `tryEnterVehicle` seat 0
(`world.ts:5505`). In both cases the *player-agency* half is the missing half:
you cannot choose to field a dog, and you cannot fail a certification.
