# Semantic Neighborhood Compiler — Design Spec

**Status:** neighborhood-first direction approved by Robert on 2026-07-22;
written specification pending Robert’s review.

## 1. Goal

Upgrade War World’s real-city pipeline from recognizable road traces and solid
building extrusions into complete, organized neighborhoods. A generated map
must preserve the spatial DNA of a real place while making its street fabric,
building types, frontage, setbacks, roofs, entrances, yards, parking, and
landmarks readable in play.

The production comparison contains three equal-scale, approximately 900 m by
900 m American slices:

- Miami Gardens 33056 Civic Front: low-rise Sun Belt suburb and civic corridor;
- Lower Manhattan Civic/Financial District: dense attached urban core;
- Tarboro Town Common/Main Street: historic small-town center and detached
  residential fabric.

The milestone is **neighborhood-first**. Every retained source building gets a
coherent exterior and semantic identity. Six to twelve mission-relevant
buildings per slice receive native, embedded interiors through the existing
multi-storey building system. Every other building receives a reachable,
correctly oriented entrance and an explicit future interior policy instead of
remaining an anonymous block.

## 2. Approaches considered

### A. Enrich the existing OpenStreetMap extrusion

Keep the current Overpass source and add more OSM tags, roof shapes, facade
colors, and local inference rules.

This is the smallest change, but its quality ceiling is too low. Many American
buildings lack detailed tags, parcels are rarely mapped, and a road centerline
does not contain enough information to reconstruct a coherent street. It would
improve individual boxes without solving neighborhood organization.

### B. Deterministic multi-source semantic fusion — selected

Fuse open geometry and topology from Overture/OpenStreetMap, American structure
attributes from the USACE National Structure Inventory, elevation from USGS
3DEP, and deterministic regional grammars. Preserve per-attribute provenance
and confidence, compile a semantic district model, then produce War World map
layers and presentation data offline.

This approach directly addresses the observed failure. It identifies what a
building probably is, how it relates to its road and lot, what massing and roof
it should have, and which entrance should connect to the pedestrian network.
It remains reproducible, cacheable, licensable, and compatible with the
existing simulation.

### C. LiDAR-first surface reconstruction

Use USGS point clouds to reconstruct terrain, roof planes, vegetation, and
surface objects before voxelization.

This can produce the best roof fidelity, but national point-cloud processing
would greatly increase preprocessing, storage, quality-control, and build
cost. LiDAR also does not provide interiors or reliable building use. It is an
optional enrichment for showcase maps, not the primary nationwide pipeline.

## 3. Product boundary

This slice ships:

- a versioned semantic district schema with attribute-level provenance;
- offline OSM/Overture, NSI, and USGS source adapters with checked-in cached
  source records for the three production slices;
- deterministic source conflation and confidence scoring;
- connected street topology, carriageway width, intersection surfaces,
  sidewalks/foot paths, service access, and driveways where data or inference
  permits;
- derived blocks, lots, frontage, setbacks, yards, parking, and access paths;
- regional building classification, massing, roofs, facade rhythm, materials,
  entrances, and lightweight local props;
- native embedded interiors for six to twelve selected buildings per map;
- gameplay adaptation stored separately from source geography;
- three launchable real-city operations and matching command/street-scale
  screenshots;
- deterministic, structural, gameplay, performance, and visual regression
  verification.

This slice does not claim:

- survey-grade reconstruction;
- exact private architecture or occupancy;
- exact floor plans inferred from exterior data;
- native embedded interiors in every building;
- live map-service queries during a match;
- Google imagery or Photorealistic 3D Tiles extraction;
- a nationwide runtime selector before the three production slices pass.

## 4. Source strategy and precedence

No single public source is sufficient. The compiler uses an explicit source
precedence per attribute:

1. directly mapped building part, height, floors, roof, entrance, width, or
   access attribute from OSM/Overture;
2. authoritative municipal or federal geometry/attribute data;
3. USACE NSI modeled structure attributes;
4. footprint and neighborhood measurements;
5. deterministic regional inference.

The selected baseline sources are:

- **Overture Buildings:** conflated footprints, building parts, subtype/class,
  floors, height, roof attributes, and stable GERS identifiers;
- **Overture Transportation/OpenStreetMap:** road and path centerlines,
  connectors, class/subclass, width, surface, access, bridge/tunnel state, and
  directly mapped entrances or local details;
- **USACE NSI:** modeled occupancy, damage/use category, number of stories,
  square footage, construction category, foundation, footprint source/link,
  and reported building height where available;
- **USGS 3DEP:** bare-earth elevation for every slice and optional point-cloud
  roof enrichment when coverage and preprocessing quality justify it.

Overture is not blindly trusted. Machine-derived footprints can contain false
positives. NSI is a modeled exposure inventory rather than a structure survey.
Every retained value records its source, source record ID, retrieval/release
date, confidence, and whether it was observed, modeled, or inferred.

The importer never mutates a checked-in artifact after a partial source
failure. It builds into memory, validates the complete semantic district, and
only then writes a replacement.

## 5. Semantic district model

The normalized source schema advances independently from `GameMap`. It
describes the city before gameplay rasterization:

```ts
interface SemanticDistrict {
  schemaVersion: 2;
  id: string;
  name: string;
  bounds: GeoBounds;
  origin: LonLat;
  rotation: number;
  profile: DistrictProfileId;
  roads: SemanticRoad[];
  blocks: SemanticBlock[];
  lots: SemanticLot[];
  buildings: SemanticBuilding[];
  land: SemanticLandFeature[];
  water: SemanticWaterFeature[];
  elevation: GeoElevationGrid;
  diagnostics: DistrictDiagnostics;
  attribution: GeoAttribution[];
}
```

A semantic road retains its centerline and topology plus effective width,
class, subclass, surface, access modes, bridge/tunnel/level, sidewalk state,
and confidence. A block is a closed region bounded by the navigable street
network. A lot records its block, frontage edge, access point, yard/parking
regions, and the buildings it contains.

A semantic building records:

- source footprint and optional building-part polygons;
- matched Overture, OSM, and NSI identifiers;
- use/occupancy family and detailed archetype;
- attached/detached relationship;
- footprint area, aspect, dominant orientation, frontage, and setback;
- height, storeys, minimum height, roof shape/orientation/height;
- facade material/color hints and deterministic regional fallback;
- entrances and their access paths;
- exterior grammar seed and interior grammar seed;
- `interiorPolicy: 'embedded' | 'instanced' | 'sealed'`;
- provenance and confidence for every non-geometric field.

The district schema is serializable, testable without Three.js, and retained
beside the compiled map so later interior work does not need to rediscover the
meaning of voxel cells.

## 6. Conflation and quality scoring

Building sources are matched before any procedural inference:

1. prefer a shared source/GERS/footprint identifier;
2. otherwise match polygons by intersection-over-union;
3. associate an NSI point contained by a footprint;
4. when the point lies outside, use nearest plausible footprint within a
   bounded distance and require compatible area/use evidence;
5. leave ambiguous records unmatched rather than forcing a false identity.

Multiple candidates are scored by overlap, centroid distance, area agreement,
use compatibility, and source priority. The winning match and rejected
alternatives are recorded in diagnostics.

Invalid, duplicate, overlapping, submerged, implausibly tiny, and implausibly
large footprints receive explicit rejection reasons. A low-confidence
footprint can become a yard, parking structure, shed, rubble, or omitted source
feature, but it cannot silently become a full house.

District quality is measured before compilation. Required metrics include
source retention, match rate, unknown-use rate, unknown-height rate, illegal
overlap count, road connectivity, entrance connectivity, and inferred-value
share. A production map cannot pass merely because it renders.

## 7. Street fabric reconstruction

Road centerlines are not painted directly into a single generic road class.
The street compiler builds a coherent surface network:

1. construct a connector graph and split segments at true intersections;
2. resolve effective width from source width rules, class, lanes, sidewalk
   state, and regional fallback;
3. buffer segments into carriageway polygons;
4. union compatible segment ends into intersection surfaces;
5. preserve bridge, tunnel, and vertical-level separation;
6. derive sidewalks or pedestrian shoulders where the profile expects them;
7. retain service roads, alleys, paths, and driveways as distinct access
   classes instead of treating them as combat-equivalent arterials;
8. create curb cuts and lot access only where a driveway, entrance, parking
   field, or deterministic frontage rule supports them.

Simulation may continue using existing surface IDs when a new movement
material would add no gameplay value. Presentation metadata still distinguishes
asphalt, concrete, sidewalk, shoulder, driveway, path, parking, and crosswalk.
Road geometry and rendered geometry must use the same reconstructed polygons so
there are no decorative streets through collidable buildings.

## 8. Blocks, lots, and organization

Blocks are polygonized from the reconstructed street graph after removing
non-boundary paths such as interior footways. Real parcel data is used when a
compatible source is available. Otherwise lots are inferred inside each block
from building footprints, addresses, entrances, driveways, frontage, and
nearest-road relationships.

Inferred lots are organizational constraints, not legal parcel claims. The
algorithm uses road-facing seeded subdivision/Voronoi regions clipped to the
block, then regularizes boundaries to avoid unusable slivers. It must preserve:

- one plausible frontage for ordinary detached buildings;
- shared frontage and party-wall groups for attached buildings;
- civic/commercial campuses with multiple buildings on one lot;
- rear service access for appropriate commercial and industrial buildings;
- yards, courtyards, parking, and setbacks consistent with the district
  profile;
- pedestrian access from every retained entrance to a walkable street/path.

This layer is the principal fix for the current “objects floating beside road
lines” appearance. Buildings are placed in a street/lot relationship before
any facade or prop detail is generated.

## 9. Regional district profiles

Profiles provide priors only when source attributes are absent. They never
override reliable direct data.

### Miami Gardens 33056

- predominantly detached one- and two-storey residential masses;
- broad arterial and residential road hierarchy;
- deep setbacks, front yards, driveways, carports/garages, fences, and service
  structures;
- low civic/commercial campuses with parking and flat/parapet roofs;
- palms, drainage, utility/street poles, and humid South Florida palette.

### Lower Manhattan Civic/Financial District

- attached street walls, very shallow setbacks, interior courtyards, alleys,
  and podium/tower relationships;
- strong hierarchy between pedestrian sidewalks and vehicle carriageways;
- vertically varied building parts, flat/mechanical roofs, setbacks, and
  landmark massing;
- ground-floor storefront/civic frontage and dense roof equipment;
- distant skyline height preserved visually even when embedded interiors keep
  War World’s three-storey gameplay cap.

### Tarboro Town Common/Main Street

- detached one- and two-storey houses on visible lots;
- porches, pitched/hipped roofs, sheds, yards, mature tree spacing, and longer
  setbacks off residential streets;
- attached or closely spaced two- to three-storey Main Street storefronts;
- churches, civic buildings, Town Common/open-space edges, and surface parking;
- small-town road widths and block rhythm rather than suburban Miami spacing.

## 10. Exterior building grammar

Every retained semantic building receives an exterior grammar result. The
generator starts from the actual footprint or building parts, not a generic
rectangle chosen independently of the source.

The exterior pass produces:

- massing and storey heights;
- roof type, ridge orientation, overhang/parapet, and roof equipment;
- facade segmentation based on edge length, storeys, use, and attachment;
- doors placed on the frontage or mapped entrance;
- window rhythm aligned to storeys and building archetype;
- porches, awnings, balconies, loading doors, fire escapes, and signs only when
  allowed by archetype/profile;
- foundation/stoop treatment where source or terrain calls for it;
- lot-level yard, fence, parking, driveway, service, and vegetation sockets.

Background buildings are no longer raw per-tile columns capped at two visible
storeys. They use low-poly footprint shells and instanced facade/roof modules.
Tall buildings preserve their exterior skyline height and parts, while
collision and enterable gameplay floors remain deliberately simplified.

The renderer batches repeated modules and materials by profile/archetype.
Individual cubes or meshes per wall cell are forbidden at city scale.

## 11. Entrances and interiors

Every retained building has at least one entrance record. Directly mapped
entrances win. Otherwise the compiler chooses a frontage-facing facade segment
near a connected sidewalk, driveway, or service access. An entrance is invalid
until a pedestrian path connects it to the street graph without crossing
another building or forbidden terrain.

Interior policies are explicit:

- **embedded:** six to twelve mission-relevant buildings per slice use the
  existing deterministic city-building grammar, upper layers, stairs, doors,
  rooms, and native navigation;
- **instanced:** the exterior has a valid door and stable interior seed; the
  player can later transition to a separately compiled interior without
  changing the district artifact;
- **sealed:** exceptional structures whose source confidence, geometry, or
  gameplay role cannot support entry yet. The door still reads correctly but
  clearly communicates that it is inaccessible.

Embedded selection is based on route position, archetype coverage, footprint
fitness, mission value, and spatial distribution. It must include residential,
commercial/civic, and location-specific types where present. No slice may put
all enterable buildings in one cluster.

The long-term dream of every building being enterable is preserved by the
semantic building and stable interior seed. It is not faked by stamping an
unrelated floor plan into a footprint that cannot contain it.

## 12. Gameplay adaptation

Source reconstruction and gameplay adaptation remain separate deterministic
passes. The gameplay compiler may:

- widen a designated vehicle route;
- open a damaged alley or breach;
- protect insertion/extraction zones;
- select mission interiors and objective anchors;
- turn low-confidence lots into cover, rubble, camps, markets, or staging;
- add fictional sewer/utility entrances based on street, slope, and drainage;
- place cover and props without sealing frontage or entrances.

Every deviation records a reason, source feature IDs, and before/after bounds.
High-confidence buildings are not moved merely to make generation easier.
Gameplay changes must retain the location’s road hierarchy and block rhythm.

## 13. Artifact and runtime architecture

The offline build emits two versioned layers:

1. `SemanticDistrictArtifact`: normalized/conflated geography, profiles,
   buildings, lots, roads, confidence, provenance, and attribution;
2. `GameMapArtifact`: compressed simulation layers, objectives, routes,
   embedded buildings, props, and the gameplay overlay.

The runtime performs no source queries, polygon conflation, LiDAR processing,
or district inference. It loads checked-in artifacts and creates a normal
`GameMap` plus a batched presentation group. The current mission launcher gains
separate cards for the three real-city operations.

The artifact format may exceed the pilot’s arbitrary 2 MB JSON ceiling only
after measured size and load tests justify a new explicit budget. Compression
uses stable ordering, run encoding for dense layers, and compact binary or
packed JSON sections where useful. Deterministic source and compiler versions
remain human-reviewable in metadata.

## 14. Error handling and fallbacks

The pipeline fails the build when:

- source bounds, projection, or attribution are invalid;
- no connected primary street component crosses the slice;
- source conflation produces unresolved duplicate geometry above tolerance;
- illegal building/road overlaps remain;
- a retained building has no valid lot/frontage relationship;
- an entrance cannot reach the pedestrian network;
- gameplay anchors, embedded interiors, or vehicle routes are unreachable;
- artifact round-trip changes semantic identity or simulation layers;
- source quality falls below the location’s checked-in acceptance baseline.

Missing optional attributes do not abort the build. They fall through the
precedence chain and receive an inferred value with lower confidence. Optional
details such as a porch or facade material may be skipped; building identity,
frontage, entrance, and navigation may not.

Network/service failures use a previously checked-in source cache only when
the cache’s release and attribution are explicit. A build never silently
relabels stale data as current.

## 15. Validation and tests

### Unit and property tests

- Overture/OSM/NSI parsing, provenance, and attribution;
- polygon matching, NSI association, duplicate rejection, and confidence;
- road connectors, widths, intersections, bridges, tunnels, and access;
- block polygonization and deterministic inferred lots;
- frontage, setback, attached-building groups, and entrance paths;
- regional archetype inference across footprint/use/height combinations;
- roof and facade grammar determinism;
- embedded/instanced/sealed policy and stable interior seeds;
- artifact serialization and backward compatibility.

### Structural acceptance per slice

- retain at least 95% of valid high-confidence source building footprints;
- zero unexplained building/carriageway overlaps;
- every retained entrance reaches the pedestrian network;
- every embedded interior entrance reaches its mission route;
- primary vehicle graph connects insertion, objectives, and extraction;
- no inaccessible walkable islands;
- source-derived height/type distributions remain within documented tolerance;
- unknown semantic fields report their inferred share rather than disappearing.

### Visual and gameplay acceptance

For each of the three locations capture and review:

1. full command-height street/block organization;
2. residential or local-typology street view;
3. commercial/civic frontage view;
4. one embedded interior entry and traversal;
5. enlarged tactical map;
6. live operation playthrough with infantry and issued vehicles.

The three screenshots must be distinguishable without reading their labels.
Miami must read as low-rise Sun Belt suburb/civic corridor, Lower Manhattan as
a dense attached vertical core, and Tarboro as a small-town Main Street plus
detached residential fabric.

Performance is measured on the densest Lower Manhattan slice. The production
budget requires stable frame pacing, bounded draw calls through batching and
instancing, bounded artifact load time, and no match-time network work.

Completion requires all repository gates:

```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```

## 16. Delivery sequence

1. Advance normalized schemas and add provenance/confidence.
2. Add cached Overture/NSI adapters and source-conflation fixtures.
3. Rebuild street surfaces, intersections, sidewalks, and access classes.
4. Derive blocks, lots, frontage, setbacks, and entrances.
5. Implement semantic classification and the three district profiles.
6. Replace raw background columns with batched exterior shells and roofs.
7. Select and fit distributed embedded interiors.
8. Compile the upgraded 33056, Lower Manhattan, and Tarboro artifacts.
9. Add three mission entries and location-specific operation framing.
10. Run structural diagnostics, visual/play tests, performance checks, and the
    four repository gates.

The nationwide location catalog and all-building interior expansion begin only
after this three-location comparison is visibly and mechanically successful.
