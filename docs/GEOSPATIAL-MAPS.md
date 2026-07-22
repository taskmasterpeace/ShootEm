# Real-city geospatial maps

War World's real-city path is a compiler, not a live map viewer. It converts geographic features into the existing semantic `GameMap` layers, then the normal simulation and Three.js renderer take over.

## Shipped pilot

- Theater ID: `geocity`
- Place: Potrero Hill / Dogpatch, San Francisco
- Bounds: `-122.4045,37.7520,-122.3943,37.7601`
- Runtime geometry: 300×300 tiles at 3 units per tile
- Source snapshot: 616 road ways, 1,304 building footprints, 16 green polygons
- Elevation snapshot: 13×13 USGS samples, 9.2–98.5 m source range
- Compiled terrain: 35,999 low, 34,202 middle, 19,799 high tiles; 470 road-ramp tiles
- Gameplay adaptation: one complete enterable native building, background blocking masses, connected insertion/extraction route, vehicle clearances, objectives, pads, and unreachable-sliver removal

The checked-in artifact is `src/data/geospatial/san-francisco-potrero.json`. It is loaded into a fresh mutable `GameMap` for each match; no network request occurs during play.

## Rebuild

```bash
npm run map:import:sf
```

The command validates bounds, data presence, all three terrain bands, an enterable building, theater laws, and a 2 MB artifact cap. If the artifact already exists with matching identity, bounds, and retrieval date, the importer rebuilds from its embedded source snapshot. This makes ordinary regeneration byte-stable even if public map services later change.

To intentionally refresh the geographic snapshot, move the current artifact out of the output path, run the import, and review the source counts, visual result, attribution, artifact size, and Git diff before committing it. Public endpoints can throttle or fail; the importer retries USGS gaps and refuses elevation with more than 5% unavailable samples.

## Data boundary and attribution

The pilot uses OpenStreetMap vector features under ODbL 1.0 and USGS 3D Elevation Program samples, which are United States public-domain data. Player-facing attribution appears on the deployment screen and machine-readable attribution remains inside the artifact.

Geographic source data is kept in the artifact's `geography` section. War World interiors, mission anchors, spawns, vehicle pads, objectives, and corrective edits live in `gameplay`. This separation makes provenance explicit, but a commercial distribution should still receive an ODbL compliance review.

- [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright)
- [Open Data Commons ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
- [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)

Do not extract geometry from Google Photorealistic 3D Tiles or rendered map tiles for this pipeline. Add future providers behind the normalized source adapter and record their license and retrieval metadata in the artifact.

## Compiler shape

1. Project the bounded slice into local meters and rotate its dominant street axis onto the tile grid.
2. Rasterize road widths, water, green space, and building envelopes into source classification.
3. Bilinearly sample and median-smooth elevation, then quantize relative relief into the game's 0/1/2 terrain bands.
4. Preserve road grade changes as ramps while keeping abrupt 0↔2 boundaries as cliffs.
5. Turn source buildings into blocking masses and fit a native one-to-three-storey interior into a suitable parcel.
6. Apply a separately recorded gameplay overlay for access, armor clearance, mission anchors, and bad GIS slivers.
7. Run theater and Map Maker validation, encode byte layers as deterministic runs, and package the frozen result.

The pilot intentionally favors playable spatial DNA over survey-grade literalism. Exact real interiors, businesses, doors, and underground infrastructure are not inferred.
