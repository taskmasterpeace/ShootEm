# Real-city geospatial maps

War World's real-city path is a compiler, not a live map viewer. It converts geographic features into the existing semantic `GameMap` layers, then the normal simulation and Three.js renderer take over.

## Deployed battlefield: Miami Gardens 33056

- Theater ID: `geocity`
- Place: Miami Gardens Civic Front, ZIP 33056, Florida
- Center: `25.943952,-80.2437793` (Miami Gardens City Hall, 18605 NW 27th Avenue)
- Bounds: `-80.24827,25.93991,-80.23929,25.94799`
- Runtime geometry: 300×300 tiles at 3 units per tile, or 900 m × 900 m at 1:1 horizontal scale
- SHT city identity: Miami, city ID `69:miami:e08:2700000`, `Resort` + `Seaport`, population rating 6, crime 53.15, safety 46.85
- Source snapshot: 368 road ways, 342 building footprints, 1 water polygon
- Elevation snapshot: 13×13 USGS samples, 0.1–2.9 m source range
- Compiled terrain: 64,143 low and 25,857 middle tiles, no artificial high band, 524 road-ramp tiles
- Gameplay adaptation: six enterable native buildings, primary and service ground routes, a foot flank, protected insertion/extraction courts, vehicle clearance, three named objectives, and unreachable-sliver removal
- Presentation: humid South Florida palette, low pale-stucco masses, palms, streetlights, drainage water, and amber/cyan faction barriers

The checked-in artifact is `src/data/geospatial/miami-gardens-33056.json`. It is loaded into a fresh mutable `GameMap` for each match; no network request occurs during play.

The City of Miami Gardens publishes an official ZIP boundary map identifying 33056 around the selected NW 183rd Street/NW 27th Avenue area:

- [City of Miami Gardens ZIP boundary map](https://www.miamigardens-fl.gov/DocumentCenter/View/84/Miami-Gardens-Zip-Code-Boundary-Map-PDF)
- [City of Miami Gardens profile](https://www.miamigardens-fl.gov/252/About-the-City)

## Rebuild

```bash
npm run map:import:33056
```

The command validates bounds, data presence, legal terrain bands, enterable buildings, theater laws, and the 2 MB artifact cap. If the artifact already exists with matching identity, bounds, and retrieval date, the importer rebuilds from its embedded source snapshot. The cached rebuild is byte-stable even if public map services later change.

To intentionally refresh the geographic snapshot, move the current artifact out of the output path, run the import, and review source counts, visual result, attribution, artifact size, and Git diff before committing it. Public endpoints can throttle or fail; the importer retries USGS gaps and refuses elevation with more than 5% unavailable samples.

## Original San Francisco pipeline pilot

`src/data/geospatial/san-francisco-potrero.json` remains checked in as the first technical proof of the compiler. It covers Potrero Hill / Dogpatch at `-122.4045,37.7520,-122.3943,37.7601` and can be rebuilt with:

```bash
npm run map:import:sf
```

It is no longer the artifact deployed by `geocity`.

## Data boundary and attribution

Both artifacts use OpenStreetMap vector features under ODbL 1.0 and USGS 3D Elevation Program samples, which are United States public-domain data. Player-facing attribution appears on the deployment screen and machine-readable attribution remains inside each artifact.

Geographic source data is kept in the artifact's `geography` section. War World interiors, mission anchors, spawns, vehicle pads, objectives, and corrective edits live in `gameplay`. Presentation metadata identifies the visual style and source-derived building heights, but decorative meshes never create collision. This separation makes provenance explicit, but a commercial distribution should still receive an ODbL compliance review.

- [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright)
- [Open Data Commons ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- [USGS 3D Elevation Program](https://www.usgs.gov/3d-elevation-program)
- [USGS copyrights and credits](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)

Do not extract geometry from Google Photorealistic 3D Tiles or rendered map tiles for this pipeline. Add future providers behind the normalized source adapter and record their license and retrieval metadata in the artifact.

## Compiler shape

1. Project the bounded slice into local meters and rotate its dominant street axis onto the tile grid.
2. Rasterize road widths, water, green space, and building envelopes into source classification.
3. Bilinearly sample and median-smooth elevation, then quantize relative relief into zero, one, or two traversal bands according to actual relief.
4. Preserve road grade changes as ramps while keeping abrupt low-to-high boundaries as cliffs.
5. Turn source buildings into blocking masses and fit native one-to-three-storey interiors into several suitable, distributed parcels.
6. Apply a separately recorded gameplay overlay for access, armor clearance, mission anchors, and bad GIS slivers.
7. Derive visual-only district metadata for background heights and sparse landmarks without adding collision.
8. Run theater and Map Maker validation, encode byte layers as deterministic runs, and package the frozen result.

The compiler intentionally favors playable spatial DNA over survey-grade literalism. Exact real interiors, businesses, doors, and underground infrastructure are not inferred.
