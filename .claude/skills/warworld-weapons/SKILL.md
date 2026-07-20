---
name: warworld-weapons
description: Use when adding, rebalancing, reskinning, or debugging ANY War World weapon — a new family, brand, or mark; a core weapon; sounds/tracers; the carried gun model or grip; armory menus. Covers the arsenal generator, the WEAPONS merge law, buildWeaponModel + anchors, WEAPON_HOLDS, and the /armory.html verification ritual. Read BEFORE touching src/sim/arsenal.ts or src/client/models/weapons.ts.
---

# War World Weapons — stats in the sim, silhouettes derived from the id

A weapon is ONE id living in two worlds. Stats: `WeaponDef` generated in
`src/sim/arsenal.ts` or hand-tuned in `src/sim/data.ts` (CORE_WEAPONS /
LSW_ARMS). Visuals: `buildWeaponModel(weaponId)` in
`src/client/models/weapons.ts` — no per-gun art; family picks a
FamilyBuilder, brand a BrandStyle, mark the dress. Same id, same gun,
every client.

## The id scheme

- Generated: `${family}_${brand}_${mk}` (`rifle_kuchler_2`): 16 FAMILIES
  × 4 of 6 rotating BRANDS (`(fi+b)%6`) × 3 TIERS — `buildArsenal()`.
  Plus `grenade_{frag|smoke|wp}_{1..3}` and specials (demo_charge, bike_mg…).
- Merge law (`src/sim/data.ts` WEAPONS): `{ ...buildArsenal(),
  ...CORE_WEAPONS, ...LSW_ARMS }` — core ids beat generated on collision.
  Never hand-add an id shaped `family_brand_mk` unless you MEAN to override.
- `buildWeaponModel` survives unknown ids: family off def else id prefix,
  brand via `parseBrand` (fallback maklov), mark off `def.tier` else id tail.

## Hard laws (test-enforced)

1. **SIDEGRADES, by law** (Robert 2026-07-16, arsenal.ts TIERS): Mk III
   hits harder and groups tighter, but the clip SHRINKS (×0.62) and reload
   DRAGS (×1.25). No mark strictly better — `tests/expansion.test.ts`.
   Same for brands: every stat bump pays somewhere else.
2. **Ceilings**: generated dps ≤ 260, range ≤ 130, reload ≤ 5s
   (`tests/expansion.test.ts`; reload also clamped at generation).
3. **Range is LITERAL reach** (`tests/range.test.ts`): direct fire culls at
   `range`; arcs launch at the angle that LANDS at `range`. Role bands are
   law: CQC 16–27, short 40–46, mid 50–66, long 64–96, sniper/arty 105–125
   (docs/ARSENAL.md table). A new weapon picks a band, not a number.
4. **Model laws** (`tests/visual.test.ts` "the armory models"): root Group
   named `'gun'`, muzzle +X, < 500 tris, length 0.25–1.7, girth < 0.9,
   NO PURPLE EVER (sweep incl. emissives). Brands must measurably change
   the bbox; higher marks must add meshes (amber bands, ACCENT 0xe8a33d).
5. **Magic damage numbers**: ≥ 100 breaches masonry; 999 = overkill (skips
   down-and-crawl — the paint recipe with `training: true`, which never
   touches architecture). `speed ≥ 200` reads/renders as hitscan.
   `range ≤ 2.5` = melee state machine, not a projectile.
6. **One launch door**: every round passes `World.launch()`. Non-arc scales
   by `projectileSpeedMul` (client ships 0.35!); arcs exempt; `airScaled`
   rounds (SAMs + anything a flying hull fires) scale by `vehicleSpeedMul`
   instead — the J1 frame-shear fix. Never hand a weapon raw velocity.

## Adding a family (end to end)

1. `WeaponFamily` union in `src/sim/types.ts`, then `F(...)` FamilySpec in
   arsenal.ts FAMILIES — base stats sit in a range band (law 3).
2. `FAMILY_ICONS` entry (arsenal.ts — missing icon is a type error);
   `CLASS_ARMORY` families for who may draw it; `FAMILY_LABELS` in
   `src/main.ts` for the picker.
3. FamilyBuilder in `src/client/models/weapons.ts` + BUILDERS entry. Reuse
   `frame()` for rifle-shaped things; call `brandTell()` + `markBands()`;
   ONE readable silhouette idea per family (the sonic's horn, the AT's tube).
4. `WEAPON_HOLDS` entry in `src/client/animation.ts` — keyed by FAMILY.
   Missing entry silently falls back to the rifle carry (no error).
5. `sound` must name a `SOUND_NAMES` slot (`src/client/audio.ts`) — a
   missing sound fails SILENTLY (boot catches per-file; the gun fires mute).
   `tracer` picks mesh/color via TRACER_COLORS / WEAPON_TINTS (renderer.ts).
6. Tests: extend the range-band expectations in tests/range.test.ts;
   expansion/visual/codex sweeps pick the family up automatically —
   `tests/codex.test.ts` fails any weapon with non-finite dps or no name.

Rebalancing a mark/brand = edit TIERS/BRANDS multipliers only; the
sidegrade suite will tell you if you made one strictly better.

## The grip contract (anchors)

`grip.ts` closes REAL hands on the gun via CCD. Default RIFLE_ANCHORS:
pistol grip (-0.15, -0.11), handguard (+0.30, -0.06). A builder whose
geometry moves them MUST declare `g.userData.anchors = { grip, handguard }`
— `handguard: null` = one-handed carry (pistol, the special case). The
solver slides the gun toward the chest when the handguard is out of reach,
so a too-long forend reads as a hunched carry: fix the anchor, not the arms.

## Verify (never skip — the ritual)

1. `npx tsc --noEmit`
2. `npx vitest run tests/visual.test.ts tests/expansion.test.ts tests/range.test.ts tests/codex.test.ts`
3. **The contact sheet**: `npm run dev` → `/armory.html`. One row per
   family, 4 brands × 3 marks across. `window.__sheet.census()` prints
   per-id tris/bbox; `__sheet.focus(row)` + ↑/↓ walk rows, `overview()`
   resets. Screenshot the new row AND the overview — "the Kuchler is
   skeletal, the Titan is a brick" must read at command height.
4. **In hand**: the renderer rebuilds the body on weapon switch (search
   `wantWeapon`, renderer.ts) — `buildSoldier(team, classId, kind, weaponId)`
   bakes the gun in. Live-check via `window.__ww`: a soldier's mesh
   `.getObjectByName('gun').userData.weaponId` must equal
   `s.weapons[s.weaponIdx]`. RAF throttles in hidden tabs — drive
   `world.step` + `renderer.update` manually, or use Playwright.

## Traps already paid for

- Editing sounds: `npm run sounds` has NO --only flag and a module-global
  RNG — regenerating shifts every wav after your target; regenerate, then
  `git checkout` all non-target wavs.
- Splash weapons on direct hits resolve through `explode()` and never also
  apply direct damage — codex mirrors this; don't "fix" the double.
- `payload` grenades detonate with the CARRIER's numbers (hardcoding
  conc_nade capped the CL-40 once — the M3 lesson).
- Vehicle 'special' guns (bike_mg, flyer_plasma…) never render in hand —
  buildSpecial gives them a case, not a rifle.
