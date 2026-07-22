# Miami Gardens 33056 War District

## Decision

War World will use a real-scale tactical slice of ZIP 33056 rather than compressing the entire ZIP into one battlefield. The pilot slice is a 900 m by 900 m square centered on Miami Gardens City Hall at 18605 NW 27th Avenue. At the engine's 3 m tile scale this is a 300 by 300 map.

The imported street graph and parcel silhouettes remain recognizable geography. A deterministic gameplay overlay may widen lanes, open damaged flanks, protect insertion zones, connect interiors, and place objectives. The source geography and every gameplay edit remain separately attributable in the compiled artifact.

## Why this slice

- ZIP 33056 is in Miami Gardens, Florida. The city's official ZIP boundary map places it around NW 183rd Street and NW 27th Avenue.
- The selected bounds contain the wide NW 27th arterial, neighborhood streets, civic parcels, low-rise homes, commercial frontage, footpaths, and mapped water.
- A live OpenStreetMap probe returned 368 road segments and 343 building footprints in the slice. That is dense enough to read as a real place but open enough for War World's vehicles and air layer.
- The SHT city source classifies Miami as `Resort` plus `Seaport`, with population rating 6, crime 53.15, and safety 46.85. Those values drive the mission treatment instead of inventing a disconnected city identity.

## Geographic contract

- Artifact ID: `miami-gardens-33056-civic-front`
- Display name: `Miami Gardens 33056 / Civic Front`
- Center: 25.943952, -80.2437793
- Bounds: -80.24827, 25.93991, -80.23929, 25.94799
- Horizontal scale: 1 world unit per meter; 3 m per tile
- Map geometry: 300 columns by 300 rows
- Rotation: align the dominant road direction with the battle grid
- Vector source: OpenStreetMap contributors, ODbL 1.0
- Elevation source: USGS 3DEP, US public domain
- ZIP/civic reference: City of Miami Gardens official boundary map and city address

The battlefield is not claimed to reproduce private interiors, exact facade appearance, traffic furniture, or current occupancy. Source footprints are context; enterable interiors are deterministic War World stencils fitted inside suitable parcels.

## Playability contract

The compiler must produce:

1. At least three tactically distinct cross-map routes: the primary armor spine, a secondary street route, and a foot/flanking route.
2. Protected insertion courts on opposite sides with infantry spawn rings and vehicle clearance.
3. Three named control points derived from the selected district rather than the previous San Francisco labels.
4. More than one enterable building when source parcels can host them, distributed across the route rather than stacked together.
5. Continuous infantry traversal between both bases and continuous ground-vehicle traversal along the primary route.
6. No inaccessible walkable islands, source walls hiding beneath props, or interior props outside their stamped building.
7. Flat South Florida terrain behavior. Elevation noise may provide drainage relief, but may not create artificial mountain bands merely to satisfy a generic importer assertion.

## City-category gameplay

Miami's SHT tags are consumed as follows:

- `Resort`: denser civilian/commercial frontage, a civic plaza objective, visual signage, and collateral-sensitive cover placement.
- `Seaport`: wet/drainage surfaces, water-aware routes, maritime-smuggling mission language, and industrial service-yard props even though this inland ZIP slice is not the port itself.
- Moderate crime: contested alleys, abandoned vehicles, barricades, and asymmetric flanking routes without turning the whole district into a ruin.
- Large-city rating: several simultaneous tactical anchors and full vehicle access.

## Visual direction

The district must look like War World occupying South Florida, not Titan recolored orange and not a photoreal city model.

- Atmosphere: humid blue-gray sky, warm high sun, long visibility, slightly turquoise distance haze.
- Ground: charcoal asphalt, pale concrete, muted grass, dark drainage water, subtle wet patches.
- Architecture: low flat roofs, parapets, vents, roof equipment, pale stucco/concrete, occasional faded coral and aqua accents.
- Local silhouette: procedural palms, utility/street poles, concrete road barriers, service-yard clutter, low civic/commercial masses.
- War layer: United Front olive/amber and Collective graphite/cyan hardware. Faction colors appear as deliberate trim, spawn paint, barriers, and objective hardware—not as a blanket environment tint.
- Geometry language: chunky low-poly forms, layered silhouettes, visible wear, and instancing-friendly repetition.

No purple is used. Background buildings remain simplified collision masses, while enterable buildings use the existing interior grammar and roof system.

## Data and rendering design

The artifact format gains optional geospatial presentation metadata while remaining backward compatible with the San Francisco pilot. Presentation metadata identifies the district style and compact source-building descriptors needed to render low-rise roof/parapet masses without pretending every source footprint is enterable.

The renderer consumes that metadata to:

- select the Miami Gardens palette without adding a fake off-world global theme;
- tint streets, concrete, grass, and water appropriately;
- vary background-building height and roof color deterministically;
- add lightweight facade/roof detail and district props without changing collision.

Gameplay-critical geometry stays in `grid`, `surface`, `height`, and theater routes. Visual metadata cannot create collision, so rendering refinements cannot introduce invisible walls.

## Iteration and acceptance

The map is accepted only after:

- deterministic compiler and artifact tests;
- route, spawn, objective, interior, and theater validation tests;
- command-height inspection of the whole district;
- street-height inspection while moving through primary and flank routes;
- an in-game conquest run with infantry and default vehicles;
- typecheck, full Vitest suite, lint, and production build.

The existing San Francisco artifact remains as a documented technical pilot unless removal becomes necessary. The `geocity` theater intentionally switches to the 33056 artifact and receives the Miami Gardens name and visual treatment.
