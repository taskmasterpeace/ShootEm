# Real-City Geospatial Slice — Design Spec

**Status:** approved by Robert's `/YOLO`, 2026-07-22.

**Goal:** prove that War World can turn the spatial DNA of a real American
place into a deterministic, playable operation map without becoming a general
volumetric-voxel engine or querying map services during a match.

The pilot is gameplay-first. Geographic recognizability is valuable, but the
compiler may alter reality whenever traversal, combat readability, performance,
or War World's tile laws require it.

## 1. Decision

Build a hybrid geospatial compiler that emits the existing `GameMap` format.
It imports real roads, water, building footprints, and bare-earth elevation,
then turns those features into War World's semantic tile layers. Selected
building parcels receive native one-to-three-storey procedural interiors;
background buildings become simplified voxel-like masses. A deterministic
gameplay pass adds routes, cover, objectives, spawns, and underground fiction.

The first checked-in pilot uses a roughly 900 m urban/industrial slice in
Pittsburgh, Pennsylvania. Pittsburgh exercises the hard parts at once: a
legible road network, mixed building stock, and meaningful terrain relief.
The import command remains coordinate-driven so another slice can replace it
without changing the compiler.

## 2. Alternatives considered

### A. Literal volumetric voxelization

Fill a three-dimensional voxel volume from terrain and building geometry, then
greedy-mesh chunks for Three.js.

Rejected for the pilot. It would create a second collision, destruction,
navigation, storage, and rendering substrate while bypassing the mature
`GameMap` laws. Most of its cost would buy vertical cells War World does not
need.

### B. Hybrid semantic compilation — selected

Rasterize geospatial features into `grid`, `surface`, `height`, and `ramp`, then
use existing building and prop systems for playable detail.

This preserves real macro-layout while retaining War World's simulation,
determinism, interiors, terrain LOS, vehicle rules, renderer, and tests.

### C. Visual-only city mesh

Render a photogrammetric or voxel-styled city behind a simplified collision
map.

Rejected as the foundation. It could become distant scenery later, but it
would make visible streets and buildings disagree with movement, destruction,
AI, and line of sight. Google Photorealistic 3D Tiles also cannot be used as
extraction input under the standard Map Tiles policy.

## 3. Product boundary

The pilot ships:

- one real, checked-in Pittsburgh map artifact;
- an offline CLI that fetches or accepts source features for a bounding box;
- source attribution and release/provenance metadata;
- road, water, building, and elevation compilation;
- deterministic gameplay adaptation;
- selected enterable procedural buildings;
- a new front that can be launched and rendered through the normal game path;
- tests for geometry, determinism, reachability, terrain, and serialization.

The pilot does not ship:

- arbitrary-coordinate generation from the live game client;
- nationwide catalog selection;
- Google imagery or Photorealistic 3D Tiles extraction;
- exact real interiors, doors, businesses, or underground infrastructure;
- continuous survey-grade elevation;
- arbitrary-angle walls;
- city-wide dynamic destruction;
- runtime chunk streaming.

Those remain follow-on decisions after the vertical slice proves gameplay.

## 4. Source and licensing boundary

The initial vector adapter uses OpenStreetMap data obtained as vector features,
never rendered public map tiles. A later Overture adapter can feed the same
normalized schema. United States elevation comes from USGS 3DEP.

Every imported slice records:

- source dataset and adapter;
- source release or retrieval time;
- bounding box and projection origin;
- attribution text and license URL;
- compiler version and deterministic seed;
- source feature identifiers retained only in the geographic layer.

OSM/Overture-derived geography stays a distinct layer from proprietary War
World content. Missions, factions, objectives, NPCs, loot, encounter tuning,
interiors, destructible state, and campaign identity are generated separately
and do not enter the geographic source record.

The game exposes map-data attribution in its existing credits/about surface.
The repository retains a machine-readable attribution record beside the map
artifact. Commercial release still requires legal review of the distributed
artifact format and ODbL obligations.

## 5. Normalized input model

The network/source adapters normalize data before gameplay compilation:

```ts
interface GeoSliceSource {
  schemaVersion: 1;
  id: string;
  name: string;
  bbox: [west: number, south: number, east: number, north: number];
  origin: { longitude: number; latitude: number };
  dominantRoadAngle: number;
  roads: GeoRoad[];
  buildings: GeoBuilding[];
  water: GeoPolygon[];
  land: GeoLandPolygon[];
  elevation: GeoElevationGrid;
  attribution: GeoAttribution[];
}
```

Coordinates inside feature geometry are local meters after projection and
rotation. The compiler never reasons in latitude/longitude. Source identifiers
and original attributes remain provenance, not simulation identity.

`GeoRoad` carries class, width hint, bridge/tunnel status, and a polyline.
`GeoBuilding` carries a polygon, use hint, optional height/floor count, and
confidence/source fields. The elevation grid contains regularly sampled
bare-earth meters plus its sample spacing and dimensions.

## 6. Coordinate normalization

For a sub-kilometer slice, use a local equirectangular projection around the
bounds center. Rotate all projected features by the negative dominant road
angle so the strongest street family aligns to the tile axes. Record that
angle in metadata so provenance and any future geographic overlay can reverse
the transform.

This deliberate rotation reduces stair-stepped roads and makes existing
axis-aligned building stencils useful. Secondary diagonals remain rasterized
curves or diagonals; they are not forced into a rectangular street grid.

The default geometry is derived from the projected bounds at `tile = 3` world
units, rounded outward to whole tiles with a protected border. No hard-coded
`GRID=100` assumption is allowed in the compiler.

## 7. Terrain compilation

USGS bare-earth samples are bilinearly interpolated onto tile centers, lightly
smoothed, and reduced to relative relief. The compiler maps that relief into
the existing semantic levels:

- `0` — local flats and valley floor;
- `1` — terraces, shoulders, and ordinary elevated neighborhoods;
- `2` — major ridge/high ground that should dominate movement and airspace.

Thresholds are deterministic and stored in the artifact. Small isolated
height islands are removed; meaningful ridges are preserved. The compiler does
not claim that `TERRAIN_U` values are literal source meters.

Road crossings between adjacent levels become `ramp` corridors when the source
grade is within the chosen vehicle threshold. Abrupt terrain boundaries away
from roads remain cliffs. The existing terrain LOS, movement, aircraft, and
camera rules remain authoritative after compilation.

## 8. Road, water, and surface compilation

Road centerlines are buffered by class into tile corridors. Major roads receive
vehicle width; residential and service roads may narrow but must preserve a
walkable connected centerline. Bridge segments cross water without replacing
the water body; tunnel segments may become underground-fiction anchors instead
of surface roads.

For the pilot, paved roads use the existing `S_PLATE` surface and surrounding
urban ground uses `S_GRIT`. A dedicated asphalt surface is deferred unless the
pilot proves that its movement/audio distinction is worth expanding the global
surface vocabulary.

Water polygons compile to shallow rims and deep cores where width permits.
Narrow waterways remain shallow or decorative so rasterization cannot create
an accidental impassable one-tile moat.

## 9. Building compilation

Building footprints are treated as parcel envelopes, not trusted interior
plans.

The compiler classifies each parcel into one of three outcomes:

1. **Playable building:** choose an archetype from the existing city profile,
   generate a deterministic complete building, and fit it inside the parcel's
   rotated bounding box. Retry with smaller footprints before falling back.
2. **Background mass:** rasterize a simplified solid or hollow shell, using
   inferred floors up to War World's three-storey production cap. It is visible
   and blocks combat but has no invented public entrance.
3. **Removed/repurposed parcel:** use low-confidence, overlapping, tiny, or
   tactically harmful footprints as alleys, rubble, yards, markets, cover, or
   mission space.

Playable buildings are chosen by frontage, usable area, mission value, and
route position—not by random percentage alone. Doors face a reachable road or
alley. The existing `generateCityBuilding`, `stampBuilding`, building metadata,
upper layers, and navigation derivation remain the only match-time interior
substrate.

Large landmarks that cannot fit the stencil grammar remain background masses
in v1. Doorway-instanced landmark interiors are a later extension, not required
for the pilot.

## 10. Gameplay corruption pass

Geographic compilation produces a structurally recognizable draft. A separate
deterministic pass turns it into a level:

- identify primary vehicle and infantry route graphs;
- preserve at least two routes between operation anchors;
- shorten or open excessively long blocks with alleys or breaches;
- guarantee vehicle turn width on designated roads;
- select enterable buildings and orient entrances;
- place cover without sealing the street graph;
- establish safe insertion, hostile staging, objectives, and extraction;
- add authored landmarks and orientation cues;
- derive fictional sewers/utilities from roads, slope, and water outlets;
- validate reachability after every destructive transformation.

The geographic layer is never mutated silently. Gameplay changes are stored as
a separate overlay with a reason code such as `open_flank`, `armor_clearance`,
`mission_anchor`, or `remove_low_confidence`.

## 11. Artifact and runtime path

The CLI emits a versioned `GeoMapArtifact`, not raw OSM, DEM, or a dense 3D
voxel volume. Typed map layers are encoded compactly and restored to
`Uint8Array`s by a pure loader. Static gameplay metadata, buildings, props,
spawns, objectives, provenance, and attribution are serialized alongside them.

The checked-in artifact is loaded through a new front generator that returns a
normal `GameMap`. The renderer and simulation receive no special geospatial
code. There are no network requests after the build step.

The artifact keeps source geography and proprietary gameplay overlay as named,
separate sections even when both are packaged in one file.

## 12. Error handling

The importer fails with a descriptive error when:

- bounds are invalid or exceed the pilot size cap;
- no connected road component is large enough for the map;
- elevation samples are missing beyond the permitted interpolation threshold;
- source projection produces non-finite coordinates;
- the compiled layers do not match `MapGeometry`;
- attribution metadata is absent;
- gameplay validation cannot connect insertion, objective, and extraction.

Malformed individual features are skipped with counted diagnostics and source
IDs. The report records every skip/fallback category so a visually plausible
map cannot hide a broken import.

## 13. Testing and acceptance

The vertical slice is accepted only when:

- the same source artifact and seed produce byte-identical map layers;
- projection and rotation keep all retained geometry inside bounds;
- road rasterization preserves the selected source graph's primary routes;
- terrain contains meaningful relief and all road level changes are correctly
  ramped or blocked;
- insertion, objectives, extraction, and playable-building entrances are
  reachable under actual movement rules;
- at least one native procedural building is enterable and navigable;
- vehicle routes meet the minimum clearance contract;
- serialization round-trips without data loss;
- attribution and source metadata survive the round trip;
- the pilot launches through the normal front/runtime path;
- the full repository gates pass: typecheck, complete Vitest suite, lint, and
  production build.

Visual verification must inspect the pilot from command height and at street
scale. Success means the result feels like a deliberate War World battlefield
whose street and relief pattern came from Pittsburgh—not a GIS screenshot and
not an unplayable exact replica.

## 14. Follow-on sequence

If the pilot succeeds:

1. add an Overture GeoParquet adapter behind the normalized schema;
2. build a scored catalog of candidate 0.5–2 km cells;
3. add archetype matching by region, density, terrain, water, and road pattern;
4. add artifact chunking/LOD only when measured map sizes require it;
5. evaluate instanced landmark interiors and distant skyline meshes;
6. perform commercial-release legal review of distributed ODbL artifacts.

The nationwide selector does not begin until the checked-in pilot is both fun
and operationally cheap.
