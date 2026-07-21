# DEATH DATA — what the war knows about every death

> **Provenance:** Robert, 2026-07-21: *"Where are we with the death stuff, the killcam upgrade? Do we have a document of all the data that we're capturing for death?"* No such document existed. This is it — the complete audit of every datum the game captures at the moment of death, where each one surfaces, the consolidated state of the killcam upgrade, and the `DeathReport` design that turns five ad-hoc reads into one record.
>
> **Status legend, used on every row:**
> - **CAPTURED** — exists in code today, with the file:line where it is written.
> - **DERIVABLE** — computable from captured data with no new sim capture (client work only).
> - **MISSING** — needs a new capture in the sim before anything can show it.
>
> Audited against the code 2026-07-21. Everything below §4 is DESIGN — nothing in §4/§5 has shipped.

---

## §1 · THE DEATH RECORD — every field at the moment of death, today

There is no single "kill" record. A death today is **one `'death'` SimEvent + mutations scattered across the victim, the attacker, and the world**. The `'death'` event payload is exactly this, and nothing more (`world.ts:4979-4987`, fields declared `types.ts:820-869`):

```
{ type: 'death', pos, soldierId,            // victim id + where they died
  killerName?, victimName?, killerTeam?,    // display strings + team hue for the feed
  weaponName?,                              // DISPLAY name, not the WeaponId
  classId?,                                 // victim class (human/bot only) — picks the death cry
  fallX?, fallZ? }                          // normalized ragdoll tip direction
```

Everything else lives on soldier/world state (which the snapshot replicates whole — `snapshot.ts:63` "new fields still replicate free") or is thrown away in the same tick.

### 1.1 Identity & credit

| Field | Status | Where | Notes |
|---|---|---|---|
| Victim id | **CAPTURED** | `world.ts:4980` (`soldierId` on the event) | |
| Victim name | **CAPTURED** | `world.ts:4982` | |
| Victim class | **CAPTURED** | `world.ts:4985` (event, human/bot only); corpse booking keeps it too (`world.ts:4917`) | |
| Victim kind (human/bot/zed/iron/dog) | **DERIVABLE** | on `Soldier.kind` (`types.ts:262`), not on the event — one map lookup via `soldierId` | needed by the flesh/chrome ledger, which does exactly this lookup (`hud.ts:793`) |
| Victim team | **DERIVABLE** | `Soldier.team` via `soldierId` | not on the event |
| Victim ascendant (an LSW fell) | **CAPTURED** | death branch announces it (`world.ts:4876-4880`); `Soldier.ascendant` (`types.ts:386`) | cleared on respawn (`world.ts:1163`) |
| Killer id | **CAPTURED** | `victim.lastKillerId` (`world.ts:4904`, declared `types.ts:360-362`) | soldier state, snapshot-replicated. **NOT on the event** — the killfeed only ever gets a name string |
| Killer name / team | **CAPTURED** | `world.ts:4981,4983` | `undefined` killer = suicide/environment (`attacker.id !== victim.id` guard `world.ts:4904`) |
| Killer class / kind / loadout / hp at kill | **DERIVABLE** | via `lastKillerId` → live soldier lookup — exactly what the killcam does (`replay.ts:240`) | goes stale/lost if the killer dies or respawns before the read |
| Downed-by (who put them on the ground) | **CAPTURED** | `victim.downedBy` (`world.ts:3569`, declared `types.ts:373-376`); bleed-out clock charges this id (`world.ts:1432-1434`) | |
| Ice credit (froze → died inside) | **CAPTURED** | `encasedBy` carried into the kill (`world.ts:1457-1462`, `4746-4755`) — "THE ICE GETS THE KILL" | weapon arrives as `'bleedout'` |
| Assists / damage contribution | **MISSING** | per-hit `'damage'` events carry attacker + amount (`world.ts:4842,4846`) but nothing accumulates per-victim-life | needs a per-life damage ledger if assists are ever wanted |

### 1.2 The weapon

| Field | Status | Where | Notes |
|---|---|---|---|
| Weapon id (`WeaponId`) | **CAPTURED but DROPPED** | the `weapon` arg to `damageSoldier` (`world.ts:4758`) is in scope at the death branch and is used for the shove (`world.ts:4973`) — **but only `weaponName` is emitted** (`world.ts:4984`) | the single biggest free win in this audit: the id is in hand and thrown away |
| Weapon display name | **CAPTURED** | `WEAPONS[weapon]?.name` (`world.ts:4984`) | synthetic ids have no def: `'bleedout'` (bleed-out `world.ts:1433`, ice `1461,4755`, decoy pops `lsw/mirage.ts:55`) is **not in WEAPONS**, so those deaths ride the wire with `weaponName: undefined` and the killfeed prints a blank weapon (`hud.ts:824`) |
| Weapon family / tier / tracer | **DERIVABLE** | `WEAPONS[id].family/tier/tracer` (`types.ts:88-92`) — once the id is on the record | the director branch table (§3.2) keys on family |
| Ammunition type on the killing round (AP/INC/EXP/BNR/TRC) | **MISSING** | the projectile carries it (`types.ts:677-687`) and the hit path reads it (`world.ts:4334-4360`) but it never reaches the death branch | the Autopsy card wants it |
| Charge / damage multiplier of the round | **MISSING** | `Projectile.dmgMul` (`types.ts:689`) not captured at death | |
| Synthetic causes | **CAPTURED** (as ids) | `'bleedout'` (clock/ice/pop) · `'ar606'` for the outbreak turn (`world.ts:4544`) · `'zombie_claw'` bite (`world.ts:1502`) · `'tank_cannon'` roadkill (`world.ts:3927`) | the turn borrowing a rifle id is a lie the autopsy line will eventually tell — a real `'turned'` cause belongs on the DeathReport |

### 1.3 Geometry

| Field | Status | Where | Notes |
|---|---|---|---|
| Victim position at death | **CAPTURED** | event `pos` (`world.ts:4980`) | the BODY then keeps moving: corpse physics for 2.2 s (`CORPSE_PHYSICS_S`, `world.ts:174-176`, set `4978`, stepped `928-963` with gravity, wall-slam `corpse_slam` event, skid friction) |
| Fall direction | **CAPTURED** | `fallX/fallZ` — normalized away-from-attacker, victim's own facing for suicides (`world.ts:4958-4965`, emitted `4986`) | |
| Death shove magnitude | **CAPTURED in effect** | `deathShove(WEAPONS[weapon])` applied to `pushX/pushZ` + vertical pop (`world.ts:4973-4977`); the per-family law is `world.ts:178-197` (beam/rail = 0, buckshot biggest, splash uses knockback) | the *number* is never recorded — derivable from the weapon id |
| Killer position at the kill | **DERIVABLE (lossy)** | read live three separate times today: trophy `longestKill` at credit (`world.ts:4952-4954` — exact), killcam banner range (`replay.ts:241` — at cam start, killer may have moved), MatchTracker `longestHit` (`record.ts:189-191` — local player's *current* pos vs event pos, approximate) | **three ad-hoc distance computations, none stored** — the poster child for §4 |
| Kill distance | **DERIVABLE** | see above | not on any record; shown only on the killcam banner (`replay.ts:242`) |
| Shot line / muzzle origin | **MISSING** | `Projectile` stores only current `pos/vel/bornAt` (`types.ts:644-652`) — launch origin is never kept; hitscan tracers never existed as sim data at all | **hard-blocks Ride the Round and The Autopsy** (§3.2) |
| Floor / storey | **DERIVABLE** | `Soldier.floor` (`types.ts:364`) | not on the event |

### 1.4 The kill's character

| Field | Status | Where | Notes |
|---|---|---|---|
| Overkill | **DERIVABLE at the moment, then destroyed** | computed as a *branch*, never a *number*: `victim.hp > -DOWNED_HP` decides down-vs-die (`world.ts:4866-4873`, `DOWNED_HP = 25` at `world.ts:65`); magnitude = `-victim.hp` in the instant before the clamp at `world.ts:4881` | backlog 2.3 says "sim already computes it" — true as a branch, false as a datum. One line captures it |
| Downed-then-finished vs instant vs bled out | **DERIVABLE (event correlation), MISSING (as a field)** | the path is fully determined in code (`world.ts:4866-4873` + `1432-1434`) and both `'downed'` (`world.ts:3574-3579`) and `'death'` events fire — but the death event doesn't say which road it took; `weaponName === undefined` + `'bleedout'` is the only (fragile) tell | |
| Victim streak at death (SHUTDOWN) | **CAPTURED transiently** | read for the announce (`world.ts:4922-4924`), zeroed one line later (`4925`) | the victim is never shown their own ended streak |
| Killer streak | **CAPTURED** | `attacker.streak` (`world.ts:4931-4933`), snapshot-replicated; HR announce lines at 4/6/9 (`world.ts:4936-4938`) | not on the event |
| Time alive this life | **MISSING** | **no `spawnedAt` exists anywhere in `src/`** (grep clean); `spawn()` records nothing (`world.ts:1143-1210`) | blocks the director's spawn-kill branch (<3 s alive, §3.2) |
| Multi-kill window | **MISSING (sim)** / **DERIVABLE (client, local only)** | no per-killer recent-kill timestamps in sim; `MatchTracker.fragTimes` does it for the local player's GL kills only (`record.ts:146,193-197`) | the KILL cam (2.5) needs it for any soldier |
| Last-stand state | **CAPTURED (adjacent)** | `lastStandSaid` latch (`types.ts:331`) | a "kill scored while nearly dead" flag would come free on the DeathReport via killer hp |
| Bare-flesh vs plate on the killing blow | **CAPTURED (adjacent)** | per-hit `bare` flag on `'hit'` (`types.ts:843-846`), armor-vs-hp split on `'damage'` events (`world.ts:4838-4846`) | not folded onto the death record |
| Hit location / headshot | **N/A** | the sim has one hit cylinder — no location model | not a gap, a design fact |
| Kill under possession / psi-link / marked | **DERIVABLE** | `possessedBy`, `psiLinkId`, `markedBy` all on the Soldier (`types.ts:396-421`) | flavor for the autopsy line |

### 1.5 Bookkeeping written at the credit site

| Field | Status | Where |
|---|---|---|
| `victim.deaths++` | **CAPTURED** | `world.ts:4883` |
| `victim.respawnAt` (zeds 2 s, everyone else 4 s) | **CAPTURED** | `world.ts:4887`, `RESPAWN_DELAY` `world.ts:25` |
| Seat freed ("a ghost may not hold a chair") | **CAPTURED** | `world.ts:4893-4901` |
| `attacker.kills++` | **CAPTURED** | `world.ts:4927` |
| `attacker.score` (+10, or the zed's bounty) | **CAPTURED** | `world.ts:4951` |
| `attacker.longestKill` trophy | **CAPTURED** | `world.ts:4952-4954` (rounded to 0.1u) |
| War ledger | **CAPTURED for hulls only** | `world.ts:5011` — soldier deaths bill nothing (clones-as-currency is backlog 3.3, unbuilt) |
| Print number | **CAPTURED (client-local only)** | HUD counts local respawns (`hud.ts:809-816,836-841`) — `deaths + 1` in the sim is the deterministic equivalent nobody reads yet |

### 1.6 The outbreak layer — when a death becomes a future enemy

| Field | Status | Where | Notes |
|---|---|---|---|
| Viral load at death | **CAPTURED, read, then zeroed** | read at `world.ts:4910` (≥40 books a corpse), wiped at `4920` ("the NEXT print is clean") | |
| The corpse record | **CAPTURED** | `{pos, reanimatesAt, neutralized, name, classId, warned}` (`world.ts:276`, booked `4911-4918`), cap 40 shift-oldest | **a death can become a named enemy**: the corpse keeps `name` + `classId` |
| Reanimation clock | **CAPTURED** | `reanimatesAt = time + 6 + (100 − viralLoad) × 0.08` (`world.ts:4914`) — hotter turns faster | |
| Rise form | **DERIVABLE** | `riseKind(classId)` (`world.ts:37-41`): scout→sprinter, heavy→brute, else shambler | causal, not a roster roll |
| Turn-in-place (viral 100) | **CAPTURED** | `stepOutbreak` kills with `attackerId −1`, weapon `'ar606'`, dmg 99999 (`world.ts:4536-4550`); zombie named `NAME (turned)` (`4547`) | the strain earns no kill credit — matches WEAPON-MEMORY §6 |
| Risen / mutated names | **CAPTURED** | `NAME (risen)` / `NAME (mutated)` (`world.ts:4617-4621`); nest mutation +40% hp (`4618`) | |
| Corpse denial | **CAPTURED** | blast (`world.ts:4642-4645`), INC/BNR rounds (`world.ts:4354-4360`) set `neutralized` | |
| Death-adjacent events | **CAPTURED** | `corpse_critical` (`world.ts:4607-4609`), `reanimated` (`4548,4620`), `contamination` (`4583`), `corpse_slam` (`947`) | |

### 1.7 Deaths that aren't deaths (the killcam must know these)

- **Chronos's echo** — a lethal hit that never lands; he snaps to the breadcrumb at a sliver of HP (`world.ts:4819-4830`). No death event, no killcam. Correct.
- **Decoy pops** — Mirage illusions die via `'bleedout'`/id −1 (`lsw/mirage.ts:55`); no downed crawl (`decoyOf` guard `world.ts:4868`).
- **Paintball** — training rounds kill normally (999 rides the overkill rule, `types.ts:73-86`) but the respawn overlay says SPLAT!, not K.I.A. (`hud.ts:404-409`), and there is no reprint ceremony (`hud.ts:836`).
- **Dummies** — fall over, never down (`world.ts:4868`), stay down (`world.ts:1428`).

---

## §2 · WHERE EACH FIELD SURFACES — the coverage matrix

Surfaces today: **KILLFEED** (`hud.ts:819-828`) · **KILLCAM** (`replay.ts:238-252` trigger, banner `242`; duel camera + red killer ring `renderer.ts:223-229, 2482-2489`; wired `src/main.ts:792-803`, `net.ts:157-159`) · **RESPAWN overlay** (`hud.ts:398-410`) · **SCOREBOARD + trophies + flesh/chrome** (`hud.ts:751-804`) · **DOSSIER/career** (`record.ts`) · **ANNOUNCES** (SHUTDOWN `world.ts:4923`, HR `4936-4938`, LSW down `4878`). Future surfaces from the specs: **WEAPON LEDGER** (`docs/WEAPON-MEMORY.md`), **DEATH CONSTELLATION** (backlog 9.6), **AUTOPSY line** (9.7), **SERVICE CARD** (9.15).

| Field | Killfeed | Killcam | Respawn overlay | Scoreboard | Dossier/career | Weapon ledger *(spec)* | Constellation / Autopsy *(spec)* |
|---|---|---|---|---|---|---|---|
| Killer name | ✅ team-colored | ✅ banner | ❌ | — | ✅ (string match!) | ✅ tally | ✅ |
| Killer id | ❌ (not on event) | ✅ (`lastKillerId`) | ❌ | — | ❌ | ✅ needs it | ✅ |
| Weapon name | ✅ (blank on bleed-out) | ❌ | ❌ | — | ✅ keyed by *display string* (`record.ts:187`) | — | ✅ |
| Weapon id / family | ❌ | ❌ (2.1 needs it) | ❌ | — | ❌ | ✅ needs it | ✅ |
| Distance | ❌ | ✅ banner only | ❌ | ✅ Longest Shot trophy at whistle | ✅ `longestHit` (approx.) | — | ✅ |
| Victim class | (death cry only) | ❌ | ❌ | ✅ | ✅ per-class record | — | ✅ |
| Fall direction | — | ✅ (the body uses it) | — | — | — | drop offset (spec §3.2) | — |
| Overkill | ❌ | ❌ (2.1/2.3 need it) | ❌ | — | ❌ | — | ✅ |
| Downed-vs-instant path | ❌ | ❌ | ❌ | — | ❌ | bleed-out credit rule needs it | ✅ |
| Victim streak (SHUTDOWN) | announce only | ❌ | ❌ | — | ❌ | — | ✅ |
| Killer streak | ❌ | ❌ (2.1 branch input) | ❌ | — | — | — | — |
| Death position | — | ✅ (is the scene) | — | — | — | drop site | ✅ constellation IS this |
| K / D / score | — | — | — | ✅ live | ✅ lifetime | — | — |
| Deaths→print number | ❌ | ❌ (9.15 wants it) | ❌ | — | ❌ | — | ✅ |
| Flesh vs chrome | — | — | — | ✅ (`hud.ts:788-796`) | — | — | — |
| Viral load / corpse booking | ❌ | ❌ | ❌ | — | ❌ | — | ✅ autopsy gold |
| Time alive | *(missing everywhere — not captured)* | | | | | | |

**The free wins this matrix exposes** (captured today, shown nowhere):

1. **The respawn overlay knows nothing.** `K.I.A.` + a countdown (`hud.ts:398-410`) while `lastKillerId`, the weapon, and the range sit captured one lookup away. The killcam banner and the respawn overlay describe the same event with wildly different richness.
2. **Distance is computed three times and shown once.** The killfeed could carry a range TAG for free.
3. **The victim's ended streak** is announced to everyone *except the person it happened to*, then destroyed (`world.ts:4922-4925`).
4. **The weapon id never surfaces** — every consumer downstream gets a display string. The Dossier keys careers off that string with an `'unknown'` fallback (`record.ts:187`), so a weapon *rename* silently forks a player's career record.
5. **Kill credit by name-string matching** — `MatchTracker` decides "was this my kill?" via `e.killerName === this.me` (`record.ts:180`). Duplicate callsigns (explicitly a feature — WEAPON-MEMORY §6 "collisions merge") make this wrong today, in shipped code.
6. **`deaths` is a deterministic print counter** nobody reads — the HUD keeps its own client-local one (`hud.ts:812`) that a mid-match join would miscount.

---

## §3 · THE KILLCAM UPGRADE — consolidated state

### 3.1 SHIPPED (verified in code this audit)

The **contains-the-death fix** (backlog line 40, commit c95c707) is live in `src/client/replay.ts`:

| Piece | Where | What |
|---|---|---|
| Ring buffer | `replay.ts:15-16, 66-94` | 10 Hz snapshots, 14 s deep, `structuredClone`-frozen so sim mutation can't corrupt history |
| The window fix | `replay.ts:17-41, 145-155, 251-252` | opens on 0.7 s of run-up (`KILLCAM_PRE`) and **streams the aftermath live** — slow-mo consumes at half the record rate, so the tape is written ahead of the playhead; `endT` deadline ends the cam (`117, 178-182`), total 1.8 s (`KILLCAM_S`) |
| Hit-stop tempo | `replay.ts:48-52` | 0.75× run-up → **0.15× through the hit** (−0.35 s..0.18 s) → 0.45× for the fall |
| Duel framing | `replay.ts:239-242` → `renderer.ts:223-229, 2482-2489` | `killerId` from `lastKillerId`; camera frames victim + killer at midpoint, pulsing red ring on the killer, cam pulled to 14 u (`KILLCAM_CAM`, `replay.ts:54`) |
| Banner | `replay.ts:242` | `☠ Killed by NAME · Nu` — the one place range is shown |
| Trigger | `replay.ts:238` | **victim-only**: local player just died, match not over, ≥2 s of tape |
| The body performs | `world.ts:912-963` | corpse physics (2.2 s — sized to the cam's ~1.1 s of streamed aftermath, `world.ts:174-176`) + per-weapon-family death shove (`world.ts:178-197`) mean the cam has something true to film |
| Wiring | `src/main.ts:792-803` (local), `net.ts:157-159` (multiplayer) | one director serves both loops |
| Highlights | `replay.ts:259-261` | closing 10 s looped after the whistle |

### 3.2 DESIGNED, UNBUILT — restated from the backlog with data dependencies

Consolidated from `docs/MASTER-BACKLOG.md` Wave 2 (lines 65-71) and details 9.6/9.7/9.15 (lines 133-134, 142). Nothing below contradicts them; the **Needs** column is what this audit adds.

| Item | The shot | Needs from §1 (status) |
|---|---|---|
| **2.1 The DIRECTOR** — branch table on the death's data; rotation-seeded; every branch skippable. `replay.ts:202-268` is the machine to branch | · >55 u → **Ride the Round** (camera flies muzzle→chest)<br>· laser/rail → **The Autopsy** (hard freeze at impact, shot line drawn in world space, range/weapon/shooter card)<br>· explosion/vehicle → **The Wide** (pull back, watch the blast take you)<br>· <3 s alive → quick cut, no celebration<br>· default → the shipped straddle | weapon **family** (needs weapon id on the record — captured-but-dropped) · **range** (derivable, must be stored) · **overkill** (derivable-then-destroyed) · killer **streak** (captured) · **time-since-spawn** (MISSING — no `spawnedAt`) · **shot line** (MISSING — blocks Ride the Round + the Autopsy's drawn line) |
| **2.2 Collapse variants** — fire→kneel-burn-fold, melee→half-spin, laser→straight-down, bullet→stagger along the shot line (`renderer.ts:2764-2803` takes no weapon input today) | client pose layering | weapon id/family **on the death event** (today the renderer would have to guess from `weaponName` strings) |
| **2.3 Gore pass** — overkill + explosive/heavy kills hide limb groups, spawn chunks; respects the blood setting | client only, no gib code exists (backlog audit) | **overkill as a number** + weapon family on the record |
| **2.4 Corpse linger** — bodies 20-30 s client-side after the sim forgets (~4 s respawn), cap ~40; decals fade by type | client corpse cache | death event as the cache key (has pos/class/fall). **Unblocks outbreak corpse VISUALS**: `world.corpses[]` (`world.ts:276`) is invisible after the body despawns — the reanimation clock ticks on an empty patch of ground today |
| **2.5 The KILL cam** — a great kill earns the KILLER a 1.5 s cut; budgeted (max 1/45 s, queued to quiet); today's trigger is victim-only (`replay.ts:238`) | killer-facing trigger path in the director | notable-kill detection: distance ≥55 u (derivable once stored) · **3-kill-in-4-s multi** (MISSING — no per-killer kill timestamps in sim) · last-stand kill (derivable from killer hp on the report) |
| **9.15 Killer's service card** — killcam footer: the killer's record vs your print number ("chrome: 6 wars of service · you: PRINT 4") | PLATE + TAGs on the killcam surface | killer **kind** (derivable) · print number (= `deaths + 1`, captured, unread) · a deterministic bot "service years" (derivable — hash of id/name; no capture) |
| **9.6 Death constellation** — your deaths as dim ×s on the minimap | minimap MARK layer | a client-side per-match archive of your own death positions — the event has `pos`; nothing retains it today |
| **9.7 Cause-of-death autopsy** — career pane deadpan line ("Print 3: exsanguination, 40 m from help") | career pane copywriting | the whole DeathReport, archived per death (path, weapon, range, downed context). Note: backlog says "(blackbox)" but the blackbox records **zero death data** — it is a movement/knot recorder only (`blackbox.ts:1-80`). The archive must come from death records, not the box |

### 3.3 The missing-capture list — every new sim capture the whole program needs

Six captures unlock everything above. Nothing else in Wave 2 / 9.x needs new sim state.

| # | Capture | Cost | Unlocks |
|---|---|---|---|
| C1 | `Soldier.spawnedAt` — one line in `spawn()` (`world.ts:1143`) | trivial | 2.1 spawn-kill branch, "time alive" everywhere |
| C2 | Weapon **id** on the death record (already in scope, `world.ts:4758→4979`) | trivial | 2.1 branching, 2.2 variants, weapon ledger, Dossier de-stringing |
| C3 | `Projectile.origin` (`{x,z}` stamped at launch) + attacker pos for hitscan | small | Ride the Round, the Autopsy's shot line |
| C4 | Overkill magnitude (`-victim.hp` before the clamp at `world.ts:4881`) | trivial | 2.1, 2.3 gore gate, autopsy |
| C5 | Death **path** enum (instant / downed-finished / bled-out / ice / turned / popped) — all branches already distinct in code | trivial | 2.1, autopsy, honest killfeed on bleed-outs (blank weapon bug, §1.2) |
| C6 | Killer pos → **distance** at the credit instant (the `longestKill` hypot, `world.ts:4953`, kept instead of discarded) | trivial | killfeed range TAG, 2.1, 2.5, constellation context |

(2.5's multi-kill detection needs no sim capture if the client derives it from a DeathReport stream — reports carry killer id + time.)

---

## §4 · THE DEATH REPORT — one record, five consumers

**The problem in one sentence:** the killfeed reads event strings, the killcam reads live soldier state, the Dossier matches *display names*, the future weapon ledger wants credit-site writes, and the autopsy wants an archive — **five readers, five different partial views of the same instant, three of which recompute distance independently.**

**The proposal:** `damageSoldier`'s death branch assembles ONE `DeathReport` from values already in scope (plus §3.3's six captures) and puts it **on the `'death'` event**. Events already ride every snapshot (`snapshot.ts:46,89`) and are consumed-per-tick, so this adds nothing to standing snapshot size.

```ts
/** Emitted on every soldier death — the single source of truth every
 *  death-consumer reads. Assembled in damageSoldier's death branch
 *  (world.ts:4861-4988) from values in scope at the credit site. */
export interface DeathReport {
  t: number;                       // sim time of death
  victim: {
    id: number; name: string; team: Team; kind: SoldierKind;
    classId: ClassId; ascendant?: AscendantId; floor: number;
    pos: Vec3;                     // where they died (body keeps moving after)
    streak: number;                // read BEFORE the zero at world.ts:4925
    printNo: number;               // deaths (post-increment) — "PRINT n" everywhere
    lifeSpan: number;              // t − spawnedAt  [C1]
    viralLoad: number;             // read BEFORE the zero at world.ts:4920
  };
  killer?: {                       // absent = self / environment / the strain
    id: number; name: string; team: Team; kind: SoldierKind;
    classId: ClassId; ascendant?: AscendantId;
    pos: Vec3;                     // at the credit instant  [C6]
    streak: number;                // post-increment
    hpFrac: number;                // last-stand kills read from this
  };
  weapon: { id: WeaponId; family?: WeaponFamily; ammo?: string };  // [C2]
  shot?: { origin: Vec3; distance: number };                       // [C3][C6]
  overkill: number;                // damage past zero; 0 = exact   [C4]
  path: 'instant' | 'downed-finished' | 'bled-out' | 'ice'
      | 'turned' | 'popped';                                       // [C5]
  downedBy?: number;               // when the path went through the ground
  fall: { x: number; z: number; shove: number };
  outbreak?: { booked: boolean; reanimatesAt?: number };           // the corpse's future
}
```

**Consumers, and what each stops doing:**

| Consumer | Today | With the report |
|---|---|---|
| Killfeed (`hud.ts:819-828`) | name·weaponName·name, blank on bleed-outs | same line + honest bleed-out/turn causes + optional range TAG. Chips stay UX-LANGUAGE §2.10 FEED grammar |
| Killcam director (`replay.ts:238-249`) | reads `lastKillerId` + live positions | branches the 2.1 table off `weapon.family / shot.distance / overkill / killer.streak / victim.lifeSpan`; the Autopsy card is a straight print of the report |
| Respawn overlay (`hud.ts:398-410`) | K.I.A. + countdown | killer card + weapon + range — captured data, finally shown |
| Dossier `MatchTracker` (`record.ts:178-211`) | **name-string matching** (`killerName === this.me`), approximate distance | id matching (duplicate-callsign-proof), exact `shot.distance`, weapon **id** keys (rename-proof careers) |
| Weapon ledger (WEAPON-MEMORY §1.3) | spec'd against raw credit sites | the report **is** the engraving payload: victim name for the tally, path for the bleed-out serial rule, killer id for custody |
| Autopsy / constellation / service card (9.7/9.6/9.15) | no data source exists | a client-side match-scoped `DeathLedger` (array of reports for the local player) feeds all three |

**Determinism notes.** Every field is a pure function of sim state already ordered by the credit site — no RNG, no wall clock, no iteration-order reads. Two worlds, same seed + inputs → byte-identical report streams; pin with a test beside the existing determinism suite (same pattern WEAPON-MEMORY §1.4 demands for gun registries). `streak`/`printNo`/`viralLoad` must be read at the exact points noted above (before their zeroing lines) — the report assembly therefore lives **inline in the death branch**, not in a helper called after it.

**Snapshot-size notes.** ~300 bytes of quantized JSON (`wireRound`, `snapshot.ts:58-66`) per death, riding the transient `events` array — deaths are a few per minute, so wire cost is noise next to the 15 Hz full-soldier snapshot (`snapshot.ts:23`). **Do not** put reports on the `Soldier` (that would bloat every snapshot forever). The existing flat event fields (`killerName` etc.) stay for one release so old readers keep working, then fold.

---

## §5 · BUILD PLAN — four slices, dependency-ordered

Gates for every slice (repo law): `npx tsc --noEmit` → `npx vitest run` → `npm run build` → on-screen verify per memory law (Playwright for live match; harness/standalone pages for renderer work) → no push unasked.

### Slice 1 — the DeathReport + the six captures (C1-C6)
Sim: `spawnedAt`, projectile origin, report assembly in the death branch; event carries `report`. Client: killfeed + MatchTracker read it; killfeed prints honest causes for bleed-out/turn (fixes the blank-weapon line, §1.2); Dossier folds by ids/weapon-ids.
**Accept:** (1) determinism test — two worlds, 5000 scripted ticks, collected report streams byte-identical; (2) path classification unit tests: finisher-on-downed → `downed-finished`, clock → `bled-out` credited to `downedBy`, ice → `ice` credited to `encasedBy`, viral 100 → `turned` with no killer, overkill ≥ `DOWNED_HP` → `instant` with `overkill > 0`; (3) two same-named bots — MatchTracker credits by id, not name; (4) killfeed renders every path with a non-blank cause; (5) snapshot round-trips the report through a puppet world.

### Slice 2 — the DIRECTOR branch table (2.1) + the killer's service card (9.15)
`replay.ts:202-268` grows the branch table keyed off the report; rotation-seeded variety inside each category; every shot skippable. The service-card PLATE (UX-LANGUAGE §2.1/§2.3 grammar; killcam surface budget per §5's fullscreen row) rides the killcam footer: killer identity vs `PRINT ${report.victim.printNo}`.
**Accept:** each branch reachable via a scripted scenario (a 60u rail kill → Autopsy; GL splash → Wide; kill at t<3s of victim spawn → quick cut); screenshots of all five filed in `docs/reference/`; the card shows chrome-service vs print number; the default straddle is bit-identical to today when no branch matches.

### Slice 3 — the KILL cam (2.5) + collapse variants (2.2)
Killer-facing trigger in the director consuming the report stream (≥55 u, 3-in-4s multi from report timestamps, last-stand via `killer.hpFrac`), budget max one per 45 s, queued to the next quiet 2 s or the respawn wait. Renderer collapse variants keyed off `report.weapon.family` (fire/melee/laser/bullet).
**Accept:** the cut never fires mid-firefight (queue verified in a bot match); budget honored; each collapse variant verified in the harness (memory law: pump `world.step`+`applyEvents`+`update` synchronously, focus the unit); laser death drops in place (`deathShove` 0) while shotgun death launches — cam and body agree.

### Slice 4 — corpse linger (2.4) + death constellation (9.6) + autopsy line (9.7)
Client corpse cache (20-30 s, cap 40, oldest-out) keyed off death events — **explicitly the enabler for outbreak corpse visuals**: the cache's bodies are what `corpse_critical` twitching and nest piles get drawn on. Constellation: local player's `DeathLedger` positions as dim × MARKs on the minimap (GHOST exit law, UX-LANGUAGE §2.9/§4.2). Autopsy: one deadpan line per death in the career pane from the ledger (`path` + weapon + range + outbreak fate).
**Accept:** bodies persist past sim despawn and vanish oldest-first at cap; a booked corpse visibly twitches through its CRITICAL window on the lingering body; minimap shows ×s only for YOUR deaths, faded per the exit law; career pane prints one line per print ("PRINT 3 — exsanguination. Downed by VEX at 41u; the clock finished the job."); decal-fade half of 2.4 lands or is split out per loop hygiene.

---

*Filed beside the backlog. The sim already knows how you died — this program is about making it say so, once, in one voice.*
