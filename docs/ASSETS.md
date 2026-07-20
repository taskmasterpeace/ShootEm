# Third-party assets — what we use, what we don't, and why

*2026-07-20. Covers the five Quaternius packs Robert added (`assets/*.zip`). Every number below was measured, not assumed.*

## ⚠ License — UNRESOLVED, resolve before shipping

The zips contain **no license file**, and I could not find license text on `quaternius.com`, its `/license.html` (404), or the itch.io mirror. Quaternius is *widely believed* to be CC0, but **I have not verified it and we should not ship on a belief.**

**The 30-second check:** the itch.io / download page for any one pack states the license, or email `laulhet@gmail.com`. Paste the wording into this doc when you have it. Prototyping locally is fine meanwhile — nothing here is published.

## The format problem, solved

The packs ship **`.blend` only** (260 files). three.js loads glTF. So:

```
blender -b --python tools/blend-to-glb.py -- <srcDir> <outDir> <files...>
```

One Blender session for the whole batch (startup is the slow part), mesh-only export (every pack file ships a camera + lamp we don't want), modifiers baked, Y-up. Source zips and intermediates are gitignored; only staged `.glb` ship in `public/models/props/`.

**Send `.blend` in future** — it's the best source, and we convert. `.glb` is fine if offered. OBJ/FBX are strictly worse (OBJ has no rig at all).

## Two constraints that decide everything

1. **Animation is procedural.** No imported clips exist in this game — `animation.ts` poses 8 named joints in code. Any animated character pack's animations are **worthless to us**; we'd take the mesh and re-rig. Characters are a project, not a drop-in.
2. **Buildings are tile grids, not models.** The sim stamps buildings into the tile grid — that's what gives them walls, doors, rooms, and interiors bots path through. A building *mesh* has no tile data, so it has no collision, no interior, no AI. This is why "houses (no interior)" can only ever be scenery, and why **modular wall/floor pieces are a better fit than whole buildings** — our buildings already *are* modular tiles.

## Measured cost

| Model | Tris | Verdict |
|---|---|---|
| Rock, Grass, Fence | 34–188 | free — place hundreds |
| Tree1–4 | 390–752 | free |
| Windmill, Silo, Barn | 1.4k–2.9k | landmark, a few per map |
| TowerWindmill | 7.8k | one per map |
| **House1 (detailed)** | **28,354** | **too heavy — 10× a barn** |

21 models staged = **888 KB** total. Cheap. The detailed houses would be 6 MB for 9.

## Verdict per pack

| Pack | Decision |
|---|---|
| **trees** (13) | ✅ **WIRED** — tree ×4 + rock ×3 variants replace the procedural cone-trees. Every field map upgraded. |
| **farm houses** (13) | ✅ **WIRED** — barn (×3: Barn/BigBarn/SmallBarn), silo, windmill (×2), water tower as *solid landmark props* that claim tiles. `OpenBarn` deliberately **skipped**: an open-sided barn standing on a solid tile invites a player into a wall. |
| **crops** (102) | ✅ **WIRED, but only ONE model of it.** The FARMLAND chunk ships: crop rows as walkable concealment (the "soft bottleneck" role tall grass plays) under a barn + farmhouse. **Measure your models before you trust a folder name** — the eight `*_Crop` files are ankle-high ground cover, not crops: Wheat_Crop 0.10u tall, Tomato 0.15u, Corn_Crop 0.15u, Lettuce 0.40u. Only `Corn_4` (1.97u) stands tall enough to justify a concealment tile. Scattering the short ones on `T_GRASS` would make the picture lie about cover. A crop tile is five jittered corn plants; the low ones stay out until there's a *decorative* garden tile that conceals nothing. |
| **props** (123, interior furniture) | ✅ **High value** — our stamped houses are *enterable but empty rooms*. Couches, tables, shelves, beds make them real **and** give cover. Furniture is just props on tiles. |
| **houses** (9, detailed) | ⚠️ **Partly wired — verdict revised.** Still not a replacement for the stamped houses (no tile data, so non-enterable). But House1/House2/Building4 are only ~4u wide, i.e. *single-building props*, not architecture — scaled to 7u they make a fine **farmhouse** on a solid 2×2. They live in the **farm only**, on purpose: the neighbourhood teaches "a house has a door," and a doorless one there would make a liar of every other house on the map. |

## Should we add more? — yes, but narrowly

Worth pulling, in order:

1. **Modular sci-fi / interior kits** — wall segments, door frames, floor tiles. These map 1:1 onto our tile-stamped walls, which is the *only* clean path to good-looking **enterable** buildings. Best fit for the starship corridor maps.
2. **Industrial / city props** — our chunk grammar already has an `industrial` region that's currently procedural boxes.
3. **Military props & weapons** — sandbags, barriers, crates; we place cover on tiles constantly.
4. **Vehicles** — usable, but the turret must be a separate child object to traverse. Medium work.

**Don't bother with:** animated character packs (animations discarded — see constraint 1), and any *whole-building* pack (constraint 2).

## Roadmap

- [x] Converter + prop library + trees/rocks wired
- [x] Farm buildings as solid landmark props (barn, silo, windmill, water tower)
- [x] FARMLAND chunk — crop rows + barn + farmhouse. 11/20 seeds grow one;
      every crop stands on walkable grass, reachability 100% on all seeds
      (`npx tsx tools/farm-check.ts`)
- [x] `/props.html` — the prop contact sheet. Every prop beside a 1.8u man,
      on its claimed footprint. The one check the gates cannot run for you;
      it caught the stretched-wheat crop and a prop that rendered nothing.
- [ ] Fences along crop rows — needs a decision first: a fence prop is either
      solid (claims tiles, and a 5.9u fence spans two of them) or it's a
      visual lie you walk through. Not free, so not done blind.
- [ ] Furniture inside stamped houses ← **the remaining high-value item**
- [ ] Resolve the license ⚠ — still unresolved, still blocking ship

## Tools

| Tool | What it answers |
|---|---|
| `node tools/glb-bounds.mjs <dir>` | How big is this model, really? Reads the POSITION accessor min/max straight out of the GLB container — no parser, no three.js. This is how the ankle-high "crops" were caught. |
| `npx tsx tools/farm-check.ts` | Does the farm land, per seed? Crops on grass, landmarks placed, bases and hill still reachable. |
| `/props.html` | Does it *look* right? Scale, grounding, orientation. `window.__sheet.census()` returns mesh count, size and ground contact per prop. |
