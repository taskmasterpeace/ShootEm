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
| **farm houses** (13) | ✅ **Next** — barn/silo/windmill/water-tower/well as *solid landmark props* that claim tiles. No interior needed, which is exactly what they are. |
| **crops** (102) | ✅ **Next** — a new **FARMLAND chunk**: crop rows as walkable concealment (the same "soft bottleneck" role tall grass plays), with a barn + fences as the landmark. This is a whole map texture the game doesn't have. |
| **props** (123, interior furniture) | ✅ **High value** — our stamped houses are *enterable but empty rooms*. Couches, tables, shelves, beds make them real **and** give cover. Furniture is just props on tiles. |
| **houses** (9, detailed) | ❌ **Skip.** 28k tris, no tile data (so non-enterable), and our own stamped houses are already enterable and look right after the roof/cottage pass. Keep 1–2 only if we ever want map-edge skyline. |

## Should we add more? — yes, but narrowly

Worth pulling, in order:

1. **Modular sci-fi / interior kits** — wall segments, door frames, floor tiles. These map 1:1 onto our tile-stamped walls, which is the *only* clean path to good-looking **enterable** buildings. Best fit for the starship corridor maps.
2. **Industrial / city props** — our chunk grammar already has an `industrial` region that's currently procedural boxes.
3. **Military props & weapons** — sandbags, barriers, crates; we place cover on tiles constantly.
4. **Vehicles** — usable, but the turret must be a separate child object to traverse. Medium work.

**Don't bother with:** animated character packs (animations discarded — see constraint 1), and any *whole-building* pack (constraint 2).

## Roadmap

- [x] Converter + prop library + trees/rocks wired
- [ ] Farm buildings as solid landmark props
- [ ] FARMLAND chunk (crop rows + barn + fences)
- [ ] Furniture inside stamped houses
- [ ] Resolve the license ⚠
