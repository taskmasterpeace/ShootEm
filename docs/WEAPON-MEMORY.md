# WEAPON MEMORY — the gun remembers

> **Provenance:** Robert's direction, 2026-07-21 (verbatim intent): *"When you kill somebody, I want you to be able to see their name on your gun. You kill somebody five times, you see their name and then a 5x in parenthesis. Maybe a little symbol for the vehicle… Right now you can't pick up weapons — we've done a lot of optimization and I'm wondering if we have the budget for that now. That would mean weapons have to drop. The body is already important (people want to burn it — outbreak). If the weapon drops and it has that information, that will be cool. It adds value before you even get into combat. You don't clone your weapons — you can clone your character."*
>
> **Doctrine:** characters are printed, expendable, replaceable. WEAPONS are machined, persistent, unique. The soldier is a copy; the gun is the original. This document is DESIGN ONLY — nothing here has shipped.

The precedent is fighter-pilot victory stencils and rifle-stock notches: a kill marking is not a stat, it is a *story carved into an object*. WWII crews painted swastikas and rising suns under the canopy rail; snipers filed notches into walnut. War World already prints the soldier fresh every death (`world.ts:4907` — "the reprint itself is clean, the printer filters the strain"). The gun is the only thing on the field that is allowed to get old.

---

## 1. THE ENGRAVING MODEL — what a weapon remembers

### 1.1 The gun becomes an entity

Today a "weapon" is a `WeaponId` string in `Soldier.weapons[]` (`src/sim/types.ts:295`) — a *pattern*, not a *piece*. Two soldiers carrying `rifle_kuchler_2` carry the same abstract idea. Memory requires identity: a **serial**.

**`world.guns: Map<number, GunRecord>`** — a sim-owned registry, serial allocated from the same `this.id()` counter every entity uses (`world.ts:510`). Soldiers grow a parallel array `gunIds: number[]` matching `weapons[]`/`clip[]`/`reserve[]` slot-for-slot (the flamer-pickup precedent already grows all three arrays together, `world.ts:5094-5105`).

```ts
interface GunRecord {
  serial: number;          // world entity id — THE identity
  weaponId: WeaponId;      // the pattern this piece was machined from
  kills: number;           // total confirmed (human/bot victims)
  hordeKills: number;      // unnamed zeds — one bucket, no lines
  tallies: { name: string; n: number; lastAt: number }[];  // the ledger, capped
  vehicleStamps: Partial<Record<VehicleKind, number>>;     // nose-art silhouettes
  lswStamps: number;       // gods felled by this piece — skull-tier
  /** Robert (2026-07-21): "certain guns have the distance — how far away they
   *  shot somebody." The piece's own record shot: distance + who took it. */
  longestKill?: { dist: number; victim: string; at: number };
  forgedAt: number;        // sim time of issue
  owners: string[];        // chain of custody, last 3 names
}
```

**The distance line (Robert, 2026-07-21):** every gun tracks its own `longestKill` (distance in units, victim, when). Distance is already computed at kill-credit time for the soldier trophy (`longestKill` on Soldier) — the gun's chisel reads the same number, zero new math. **Display is FAMILY-GATED — "certain guns":** marksman/sniper/rail families wear the range line proudly on the nameplate (`LONGEST: 87u — VEX`); SMGs/shotguns keep it in the inspect ledger only (a 9u shotgun record is not a boast). The family gate lives in display, not capture — every piece records it.

### 1.2 The tally cap and retention policy

| Parameter | Value | Why |
|---|---|---|
| `tallies` max entries | **8** | one gun face can't hold a phone book; 8 lines is a story, 80 is a database |
| retention on eviction | **most-killed first, then most-recent (`lastAt`), then name ascending** | the ×5 nemesis never falls off for a drive-by ×1; the tiebreak chain is total and deterministic |
| insertion order | first-kill order, re-sorted ONLY at eviction time | stable arrays, stable JSON, byte-identical replays |
| `owners` | last 3, push-shift | provenance without unbounded growth |
| `hordeKills` | unbounded counter | "SHAMBLERS ×214" is a horde-mode trophy but never occupies a ledger line |

A name tally is keyed by the victim's **display name string, verbatim** — including suffixes. `VEX` and `VEX (RISEN)` are two different lines (see §6). Name collisions merge, and that is correct doctrine: in a clone war the gun remembers a *name*, not a soul — killing "Vex" nine times is only possible *because* Vex reprints. The ×N **is** the clone counter.

### 1.3 When the chisel falls — write sites

Engraving writes happen at the **existing kill-credit sites and nowhere else**, so tick order is inherited from the code that already gates the 1301-test determinism suite:

| Kill | Credit site | Engraving rule |
|---|---|---|
| direct kill | `attacker.kills++` — `world.ts:4927` | tally on the gun matching the `weapon` arg in the attacker's `gunIds[]`; if the killing `weapon` isn't in their hands (grenade `'gl'`, vehicle gun, `'bleedout'`), fall through to the serial captured at down time, else the attacker's slot-0 gun |
| bleed-out | `damageSoldier(s, s.hp+1, s.downedBy, 'bleedout')` — `world.ts:1433` | `downSoldier` captures `downedByGun` (serial) beside `downedBy`; the clock's kill engraves THAT serial — the gun that put them on the ground gets the credit, even if its owner has since died and the gun is lying in the mud |
| vehicle-seat kill (incl. roadkill, `world.ts:3927`) | driver credited | tally lands on the driver's **carried primary** with a hull glyph beside the name — Robert's "little symbol for the vehicle." The hull is pool equipment; the trophy goes home with the man |
| vehicle DESTROYED | `attacker.vehicleKills++` — `world.ts:5028` | `vehicleStamps[kind]++` on the gun/serial in hand — the WWII nose-art silhouette row |
| LSW felled | death branch `world.ts:4876-4880` | `lswStamps++` **and** a name tally under the god's name — killing RAGEBEAST with a rifle is the story of a career |

**No engraving:** suicides and environment kills (`attacker.id !== victim.id` guard, `world.ts:4926`), turn-by-outbreak deaths (`attackerId = -1`, `world.ts:4544`), dummies (`Soldier.dummy`, `types.ts:359`), Mirage decoys (`decoyOf`, no corpse, no confirmation), and **training rounds** — a paint splat is not a confirmed kill (`WeaponDef.training`, `types.ts:73-86`; the yard stays innocent).

### 1.4 Determinism and the wire

- **Sim-owned, replay-safe.** All writes are inside `damageSoldier`/`damageVehicle`, downstream of the same RNG-free comparisons that already order kill credit. Two worlds, same seed, same inputs → byte-identical registries. The eviction sort's tiebreak chain (§1.2) is total, so no `Array.sort` instability can leak.
- **Snapshot spread law.** `Snapshot` grows one field: `guns: GunRecord[]` (and `Soldier.gunIds` rides the existing whole-object soldier spread — `snapshot.ts:63` states the invariant: "new fields still replicate free"). Puppet worlds (`snapshot.ts:13-21`) and the replay player consume it like everything else; clients never write.
- **Size, honestly.** A full 8-line GunRecord is ~220 bytes of quantized JSON. Standing population: 24 soldiers (12v12 default, `main.ts:500`) × 2 slots + 16 field drops ≈ **64 records ≈ 14 KB per snapshot**. The wire already ships every Soldier field-complete at 15 Hz and calls itself "fine for LAN" (`snapshot.ts:23`); this is a same-order-of-magnitude add. If it ever matters, `cullSnapshotFor` (`snapshot.ts:102`) is the ready hook: send only guns held by visible soldiers + field drops the viewer can see.

---

## 2. WHERE IT SHOWS

Three surfaces, three ranges: the HUD plate (always), the model itself (close), the ledger (deliberate).

### 2.1 The weapon-cam nameplate — the daily surface

The bottom-right weapon block is already decided and framed: a **live 3D weapon-cam** of the exact equipped model inside a per-manufacturer PixelLab frame (`docs/reference/hud/README.md` — DECIDED 2026-07-21; empty-bay frames exist for all 6 makers). The engraving line is the plate's missing caption.

**Persistent line** (under the gun, stencil caps, house amber — the weapon block already owns `weapon-name`/`ammo-count`, `hud.ts:260-289`):

```
K-7 KÜCHLER Mk II          31 / 120
── VEX (×5) · 23 CONFIRMED ──
```

Copy format, exact: `NAME (×N)` — count shown only when N ≥ 2; headline = highest-tally name; right side = `kills` total when > 0. A blank gun shows nothing — silence is what a fresh print sounds like. (Robert's verbatim `R. VASQUEZ (×5)` format holds; the shipping name pool is single callsigns — `main.ts:37-41` — so it renders as `VEX (×5)`.)

**Kill-moment flash:** on a `death` event where `killerName` is the local player (the killfeed already keys this, `hud.ts:823-825`), the plate runs a 2.5 s engrave flash — the new line stamps in bright, with the count ticking up: `VEX (×4 → ×5)`. Then it settles into the persistent line. The moment the chisel bites is *felt*, every time.

### 2.2 On the model — notches and nose art

Weapons budget ≤ 500 tris, most under 300 (`weapons.ts:16`). Two candidate treatments:

| Approach | Cost | Verdict |
|---|---|---|
| instanced tick geometry (tiny boxes on the stock) | 12 tris/notch → 120 tris at ×10, blows several builders' budgets | **rejected** |
| **one decal quad + per-serial CanvasTexture** | **+2 tris, one 64×32 canvas** redrawn client-side on engrave | **adopted** |

The decal strip rides the receiver flank (each family builder exposes receiver dims already — `frame()` in `weapons.ts:110`). Tick marks in groups of five (four and a gate), vehicle silhouettes as tiny stamped glyphs, one skull per `lswStamp`. **Weapon-cam and inspect view only** — the world-scale carried model (soldiers carry the exact gun already, `docs/MASTER-BACKLOG.md` §Armory) skips the decal: at top-down camera range it is sub-pixel, and 24+ live canvas textures would be pure waste. The dressing is client-side presentation keyed off the snapshot's GunRecord — zero sim cost, deterministic input.

### 2.3 The ledger — inspect and armory

- **Field inspect:** hold the weapon-switch key on the current slot (no new bind) → the weapon-cam plate expands to the full ledger: all 8 lines, vehicle stamp row, `hordeKills`, `forgedAt` age, owner chain. Out of combat only (plate collapses on damage).
- **Armory / pre-deploy:** the Dossier already reserves exactly this shelf — `armory: string[]` with the comment "*personal armory — weapons with service history (carried into battle)*" (`record.ts:31`) and a per-weapon `WeaponRecord {kills, longestHit, matches}` (`record.ts:13`). Slice 3 extends the dossier entry with the career ledger of any gun you **ended a match holding** — the match-end fold (`MatchTracker`, `record.ts:139`) copies the GunRecord out of the sim. Client-side persistence, sim untouched.
- **Killcam:** the killcam already frames the duel via `lastKillerId` (`types.ts:363`, set at `world.ts:4904`). Add the killer's gun plate to the killcam frame — so the man who just died reads *his own name* being carved. That is the revenge loop's ignition (§5).

| Surface | When | What |
|---|---|---|
| weapon-cam line | always, persistent | headline tally + total |
| engrave flash | kill moment, 2.5 s | new line stamps in, count ticks |
| model decal | weapon-cam + inspect | notches, silhouettes, skulls |
| full ledger | inspect hold / armory | everything |
| killcam plate | on death | the gun that did it, its ledger line for YOU |

---

## 3. THE DROP SYSTEM — weapons have to drop

### 3.1 Reuse verdict: the Pickup system carries it

Verified: a pickup system exists and is small. `Pickup` is `{id, type, pos, respawnAt, oneShot?}` with a closed type union `'medkit'|'ammo'|'flamer'|'energy'|'orbital'` (`types.ts:698-704`). `stepPickups` walks pickups × soldiers at radius 1.6u (`world.ts:5070-5115`), supply pods already spawn **one-shot loot at a death site** (`world.ts:1900-1916`), and the flamer branch already **grants a weapon with clip/reserve** on walk-over (`world.ts:5094-5105`). The renderer manages one mesh per pickup id in a map (`renderer.ts:167`, `2102-2108`). Every piece of plumbing exists; the drop is a new pickup type, not a new system.

**Extension:** `type: 'weapon'` + optional fields `{ gunId: number; weaponId: WeaponId; clip: number; reserve: number; droppedAt: number }`. `oneShot: true` always; `respawnAt` stays 0 (a storied gun never "respawns" — the 18 s `PICKUP_RESPAWN` cycle at `world.ts:205` is for crates).

### 3.2 The drop, at death

In `damageSoldier`'s death branch (`world.ts:4861-4988`), beside the corpse booking (`4909-4919`):

| Rule | Value |
|---|---|
| who drops | victims of kind `human`/`bot` only — zeds carry claws, dogs carry teeth |
| what drops | the gun **in hand** (`weapons[weaponIdx]` + its `gunIds` serial), with its live `clip`/`reserve` as-is — you inherit their half-spent magazine |
| what never drops | family `'lsw'` — signature arms are "never issued, never dropped" (`types.ts:140`) and die with the god (`world.ts:1186-1188`); training markers (paintball yard stays clean); dummy/decoy "deaths" |
| where | 0.9u from the corpse, offset along the ragdoll fall direction (`fallX/fallZ`, `world.ts:4960-4965`) — *beside* the body, never under it: the burn crew and the scavenger reach for different objects |
| event | new `SimEvent` `'weapon_drop'` (clatter sound, brief minimap glint for the victim's team only — your gun calls to YOU) |

The corpse and the gun are two objects with two fates: **burn the body, take the gun.** The corpse rides the reanimation clock (`corpses[]`, `world.ts:276`); the gun rides the pickup map.

### 3.3 The pickup — a deliberate act

Walk-over is wrong for weapons — auto-swapping mid-firefight is a griefing engine. Weapon drops use the **E interact** (the `use` verb, `types.ts:920`), 0.6 s hold beside the gun:

- **Swap, not stack:** your current in-hand gun drops in its place (a fresh `'weapon'` pickup, with *its* engravings) and the field gun fills the slot — `weapons[i]`, `clip[i]`, `reserve[i]`, `gunIds[i]` all move together. Gun-for-gun; stories change hands. (The third-slot special mechanic — `weaponIdx 2`, `types.ts:294` — stays reserved for crate flamers; storied guns replace, they don't accumulate.)
- **What transfers: everything.** The piece, its remaining ammunition, and its ENGRAVINGS — the registry entry is keyed by serial and never copies. You now carry your killer's storied gun, and the plate (§2.1) reads *their* trophies — possibly including you.
- **Bots ignore weapon drops in v1.** Bot gun-swapping is a brain feature with its own balance surface; ship the human fantasy first.

### 3.4 The outbreak rule — fire takes the body, not the steel

Corpse denial exists in two forms: blast neutralization (`world.ts:4642-4645`) and incendiary/bio-neutralizing rounds (`world.ts:4354-4360`). **Proposed rule: neither destroys the weapon.** Doctrine and counterplay both say so:

- **Doctrine:** denial burns *flesh* so it cannot rise. Steel doesn't reanimate. A game where burning corpses (mandatory outbreak hygiene) also deletes the loot punishes the player for doing the correct thing.
- **The counterplay is spatial, and it is already built:** the gun lies *beside* a corpse that is on the reanimation clock. Retrieving your named rifle means standing in the CRITICAL window (`corpse_critical`, `world.ts:4607-4610`) next to a body that is about to stand up — and inside a possible nest radius (`world.ts:4562-4583`). The gun is the bait; the corpse is the trap. No new mechanic needed — the tension is free.
- One cosmetic concession: a gun inside a denial blast gets a client-side scorch tint on its decal. The steel remembers the fire too.

### 3.5 Anti-clutter caps

Mirrors the corpse cap exactly (`corpses.length >= 40` shift-oldest, `world.ts:4911`):

| Cap | Value | Behavior |
|---|---|---|
| max weapon drops on field | **16** | 17th drop evicts the oldest (its GunRecord is deleted with it — the field forgets) |
| despawn timer | **90 s** | last 10 s the mesh blink-fades (client reads `droppedAt`) |
| held guns | uncapped | a carried gun never despawns; respawning issues a fresh serial (§5) so the registry's live size stays ≈ soldiers×2 + field drops ≤ ~64 |

---

## 4. THE PERF BUDGET — honest numbers

The fear was real in the pre-optimization era; the ledger says it is paid off. All figures from `docs/bench/zombie-history.json` (S2 spatial-grid row, commit `88477cd`) via `tools/zombie-bench.ts`:

| Shamblers | sim mean/tick | % of 16.7 ms frame |
|---|---|---|
| 300 | 2.31 ms | 14% |
| 500 | 6.26 ms | 37% |
| 800 | 16.9 ms | ~100% |

### Cost of this feature

| Item | Cost | Grounding |
|---|---|---|
| sim: one dropped weapon | one Map entry + membership in the `stepPickups` scan | `world.ts:5070` |
| sim: pickup scan with 16 drops | current loop is O(pickups × soldiers): PvP (24-40 soldiers, ~26 pickups) ≈ ~1K distance checks/tick — noise. Horde worst case (800 zeds): ~21K early-out `isZed` Set lookups/tick — measurable but small | the loop already early-outs zeds/dogs/downed at `world.ts:5078` |
| sim: engraving write | one array touch per KILL — kills happen a few times a minute, not per tick | §1.3 write sites |
| client: one dropped weapon mesh | one static Group, ≤500 tris (most <300), zero animation, map-managed exactly like `pickupMeshes` | `weapons.ts:16`, `renderer.ts:167` |
| client: 16 drops | ≤ 8K tris total — the scene won't notice | |
| wire | ~14 KB/snapshot standing (§1.4) | `snapshot.ts:23` |

**Ready lever if horde flinches:** convert the pickup scan's inner loop to `soldierIndex.collect(pk.pos, 1.6)` — the per-team spatial grid exists, is rebuilt every tick anyway, and its ascending-id determinism law is documented (`spatial.ts:2-33`). Estimated to erase the scan cost entirely.

**Measure before shipping slice 2:** `npx tsx tools/zombie-bench.ts 800 600` with 16 seeded weapon drops on the field, appended to `zombie-history.json` under a `weapon-drops` label. **Acceptance: mean regression < 0.3 ms at N=800.**

### Verdict

**Fits now. No gate.** PvP-scale cost is unmeasurable; horde-scale cost is one known loop with a pre-built escape hatch. Robert's instinct ("I'm wondering if we have the budget for that now") is confirmed by the bench ledger — the spatial grid bought this feature.

---

## 5. THE ECONOMY TIE — you clone your character, not your weapons

The game already speaks this language everywhere except the armory:

- Bodies are PRINTS: "the reprint itself is clean (the printer filters the strain)" — `world.ts:4907`. Death is a personnel event, processed by payroll: the HR streak notices (`world.ts:4936-4938`), the war ledger's `FLESH · CHROME` loss line (`hud.ts:796`).
- Loadout choice already survives respawn (`world.ts:1185-1192` keeps your chosen weapon **ids**) — but ids are patterns. The missing law:

**THE SERIAL LAW: the printer stocks the pattern, never the piece.** Respawn reissues your chosen `weaponId` with a **fresh serial and a blank ledger**. Your storied gun — the one with VEX ×5 on the receiver — is exactly where you died, or in the hands of the man who killed you. There is now precisely one of it in the universe.

What this buys, in order:

1. **Losing your gun MEANS something.** Death costs nothing the printer can't fix — except the object your whole match is carved into. The corpse run stops being about the corpse.
2. **The revenge loop is physical.** Your killer swaps for your gun (§3.3); the killcam shows you your own name on his plate (§2.3); `lastKillerId` already aims you at him. Getting your named gun back off his body is the nemesis loop with no nemesis *system* — it's just property law. Spawn-farmers engrave their own wanted poster (§6).
3. **"Value before you even get into combat"** — Robert's phrase, satisfied literally: the armory screen (§2.3) shows service history before deploy, and the Dossier's `armory`/`WeaponRecord` shelves (`record.ts:13,31`) were built waiting for exactly this cargo. A gun that survives to the whistle in your hands writes its ledger into your career file.
4. **The war-ledger rhyme:** vehicles already carry requisition manifests and hotwire theft (`Vehicle.requisitionedBy`, `types.ts:597-608`). Guns joining the property economy makes the doctrine uniform: *everything of value on this battlefield has a name on it except the people.*

---

## 6. EDGE CASES — the ruling on each

| Case | Ruling | Grounding |
|---|---|---|
| Suicide / environment | No engraving (credit guard already excludes, `world.ts:4926`). The gun still drops — the field doesn't care how you died | §1.3 |
| Bleed-out | Engraves the serial captured at down time (`downedByGun`), credited when the clock kills (`world.ts:1433`) — the gun that dropped them gets the notch even if it has since changed hands or lies in the mud | §1.3 |
| Turned by outbreak | `attackerId = -1` (`world.ts:4544`) → no engraving. **The strain earns no trophies.** No weapon drop either — the body *stands up still holding nothing* (zed weapons are claws, `world.ts:1093`); their gun dropped at the moment of turning, beside where they stood |
| **Does the zombie that was Vasquez count as Vasquez?** | **As his own line.** Risen bodies keep their names with suffixes — `"Vasquez (turned)"` (`world.ts:4547`), `"(risen)"/"(mutated)"` (`world.ts:4619`) — and tallies key on the verbatim string (§1.2). `VASQUEZ ×3` and `VASQUEZ (RISEN) ×1` are two lines: the gun remembers killing the man, and then killing what got back up. Two stories, both true |
| Generic zeds | `hordeKills` bucket only — `"Shambler"` (`world.ts:1089`) never occupies a ledger line, so horde mode can't flood the cap | §1.2 |
| Bot names | Pool of 22 callsigns, shuffled (`main.ts:37-41,497`); server wraps with `-2` suffixes (`server.ts:65`). Collisions merge — **feature**: clones share names by design, ×N is the clone counter | §1.2 |
| Human named "Vex" vs bot "Vex" | Merges. Acceptable now; server-side name uniqueness is a lobby nicety, not a sim problem (humans capped at 16 chars, `server.ts:118`) |
| LSW / god kills | Felling a god = name tally + `lswStamps` skull. God-mode testers (`Soldier.god`) engrave normally — the harness gets stories too. LSW signature arms never drop (`types.ts:140`) |
| Vehicle roadkill | Driver credited with weapon `'tank_cannon'` (`world.ts:3927`) → name + hull glyph on the driver's carried primary. Destroying the hull itself → silhouette stamp (`world.ts:5028`) | §1.3 |
| Occupants killed in a destroyed hull | Normal kills via ejection damage (`world.ts:5016-5023`) — engrave normally; their guns drop beside the wreck |
| Paintball / training | `training` rounds (`types.ts:73-86`) never engrave, never drop. The yard settles fights and marks men — it does not confirm kills |
| Dummies / decoys | `dummy` (`types.ts:359`) and `decoyOf` pops: no engraving, no drop — no body, no story |
| Spawn-farming one player | **Feature, ruled deliberately.** ×9 on one name is the nemesis made legible — and it is self-limiting: spawn protection exists (`protectedUntil`, `world.ts:357`), enemy-aware pad selection scatters the farm (`world.ts:1210-1236`), and the farmer's gun becomes the most wanted object on the map. Grief becomes narrative becomes retaliation |
| Name-cap eviction abuse | Killing 9 different bots once each to flush a rival's ×5 line: impossible — retention keeps highest-N first (§1.2); a ×5 outranks any ×1 forever |

---

## 7. BUILD PLAN — three slices

Gates for every slice: `tsc` clean · full vitest suite (determinism law intact) · production build · no-push hold per standing orders.

### Slice 1 — THE ENGRAVING (sim registry + HUD nameplate; no drops)

Scope: `GunRecord` registry + `Soldier.gunIds` (serials issued in `addSoldier`/`spawn`/flamer-grant); engraving writes at the §1.3 credit sites; `guns` on the snapshot; weapon-cam persistent line + kill-moment flash in the weapon block.

**Acceptance:**
1. Determinism: two worlds, same seed + scripted inputs, 5000 ticks → `JSON.stringify` of both gun registries byte-identical (new test beside the existing determinism suite).
2. A scripted 5-kill run against one bot yields exactly `{name, n: 5}`; 9 distinct victims on one gun holds 8 lines with the ruled retention order; horde kills land in `hordeKills` only.
3. HUD: plate shows `VEX (×5) · N CONFIRMED`; flash fires only for the local killer; blank gun shows nothing; killfeed untouched.
4. Excluded cases (suicide, training, dummy, turned) engrave nothing — asserted in tests.

### Slice 2 — THE DROP (weapons fall, weapons change hands)

Scope: `'weapon'` pickup type + drop-at-death beside the corpse; E-hold swap with gun-for-gun exchange (ammo + serial + engravings transfer); caps 16/90 s; outbreak survival rule (denial never deletes a gun); `weapon_drop`/`weapon_taken` events + dropped-gun mesh via `buildWeaponModel` in the renderer's pickup path; bots ignore drops.

**Acceptance:**
1. Kill a bot → its in-hand gun lies 0.9u from the corpse with its half-spent clip; E-hold swaps: your old gun is now a field drop with *its* ledger; the taken gun's plate shows the dead man's trophies.
2. Burn the corpse (incendiary / blast denial) → corpse neutralized, gun intact and still liftable.
3. 17th drop evicts the oldest; 90 s despawn with client fade; LSW arms and paintball markers never drop.
4. Bench: `zombie-bench 800` with 16 seeded drops — mean regression < 0.3 ms vs the S2 row, appended to `docs/bench/zombie-history.json`.

### Slice 3 — THE OBJECT (notches, ledger, career)

Scope: per-serial CanvasTexture decal strip on the weapon-cam model (+2 tris; notch groups of five, vehicle silhouettes, LSW skulls, denial scorch tint); inspect-hold full-ledger plate; killcam shows the killer's gun plate; match-end fold writes surviving guns' ledgers into the Dossier `armory`/`WeaponRecord` (`record.ts:13,31`).

**Acceptance:**
1. Tri budget test (the armory suite already gates budgets) passes with the decal quad on every family.
2. ×7 on one name renders 5-gate + 2 notches; a tank silhouette and a skull render distinctly at weapon-cam scale (Playwright screenshot vs reference).
3. Killcam frames victim + killer + the gun plate carrying the victim's own name.
4. End a match holding a storied gun → armory screen shows its ledger next deploy; end it holding a blank reissue → blank.

---

*Filed under the armory. The printer makes soldiers; the war makes weapons.*
