# Radar and aircraft instruments production design

## Goal

Turn the existing minimap into a tactical radar surface and give pilots a readable aircraft instrument cluster. Radar must create gameplay through sweep timing, last-known contacts, terrain and altitude, damaged sensors, weather, and ECM; it must not become an omniscient live enemy feed. The aircraft panel must reuse the established PixelLab gunmetal/amber language and expose airspeed, heading, altitude, radar state, and lock danger at a glance.

## Product decisions

- Radar reports a contact's position at the instant of a sweep. Between sweeps the mark remains at that last-known position and fades; it does not track the target continuously.
- Ordinary infantry keep the current visual/headcam minimap. Radar overlays appear when the local player is piloting a radar-equipped aircraft/ship or is on a team with a staffed, working sensor station.
- Aircraft carry short-range onboard radar. A staffed sensor station provides the strongest shared radar picture. A surfaced submarine uses surface radar; a submerged submarine uses sonar and never sees airborne contacts through sonar.
- Radar is domain-aware: air, surface/ground, naval, and submerged contacts have different glyphs and altitude/depth annotations.
- Buildings and mountains mask ground/surface contacts. Aircraft at Sky or Clouds resolve over ordinary buildings, but mountains and severe weather still reduce coverage. Submerged contacts require sonar.
- Working enemy ECM shortens detection range and degrades a resolved return into a larger uncertainty ghost. Destroyed ECM makes a vehicle easier to resolve. Destroyed friendly sensors disables that emitter.
- The map remains north-up. Heading belongs to the instrument cluster, avoiding a rotating tactical map that would make mission geography harder to learn.
- The PixelLab `hud-B-gunmetal-dial.png` asset is the aircraft plate's physical style source. Live HTML/canvas content overlays its empty bay and dial so values remain accessible, crisp, and data-driven.

## Approaches considered

### Recommended: deterministic team radar tracks over the existing minimap

The simulation owns per-team radar contacts and refreshes them on fixed sweep cadences. The HUD only renders those records. Existing visual LOS, tactical pings, contact memory, and radar returns share the minimap but remain distinguishable by shape and animation.

This makes radar usable by AI and future networking, keeps replay/headless behavior deterministic, and prevents the HUD from cheating by inspecting live enemy state.

### Alternative: render range-filtered enemies directly in the HUD

This is smaller, but every client would reconstruct truth independently and could expose precise positions every frame. AI could not reason from the same radar picture, and replay/network authority would drift.

### Alternative: replace the minimap with a separate circular radar scope

This creates attractive cockpit fiction but duplicates navigation, objectives, waypoints, and contact code. It also costs too much screen space beside the weapon block. The minimap is already the tactical surface and should gain radar behavior rather than compete with a second map.

## Simulation architecture

### Radar tracks

`src/sim/radar.ts` owns pure radar rules and types:

- `RadarDomain`: `ground | air | surface | submerged`
- `RadarSource`: onboard aircraft/surface radar, staffed sensor station, or sonar
- `RadarTrack`: stable target key, team receiving the track, last-known position, observed heading, altitude band/depth, domain, source, observed time, expiry, precision, and jammed state
- emitter profile helpers for range, cadence, domain coverage, and weather penalties
- deterministic detection and uncertainty helpers

`World` owns one radar-track map per team and the next sweep time per emitter. Tracks are serializable records and are updated only on a scheduled simulation tick. No wall clock or random browser state participates.

### Emitters and ranges

- Piloted fixed-wing aircraft: 125-unit 360-degree air/surface radar, 1.25-second cadence.
- Piloted rotorcraft: 90-unit air/ground radar, 1.5-second cadence.
- Staffed vehicle sensor station: 160-unit shared ground/air/surface picture, 2-second cadence.
- Piloted surface boat/submarine: 105-unit surface radar, 1.75-second cadence.
- Submerged submarine: 80-unit sonar for surface/submerged contacts, 2.25-second cadence.

Ranges are meaningful on the 600–900-unit Operations theaters without revealing the entire map. Profiles are exported constants so balance tests and future tuning use one source of truth.

### Detection rules

Each sweep evaluates enemy soldiers and vehicles eligible for the source's domains.

1. Reject dead, out-of-range, and unsupported-domain targets.
2. Apply weather range multipliers; storm, dust, fog, and snow affect air/surface radar, while sonar is unaffected by visibility weather.
3. Apply altitude advantage. Air targets at Sky/Clouds are easiest to detect; ground targets under a roof remain concealed unless the emitter has a valid line over that obstruction.
4. Apply terrain masking using the existing lawful map grid and LOS helpers. Mountains/walls block low returns. High aircraft can see across ordinary building cover but not beyond the profile's range.
5. Apply ECM. Live enemy ECM reduces effective range to 65% and records a jammed track with positional uncertainty. Dead ECM restores full resolution.
6. Store a last-known observation. Accurate contacts hold for one cadence and fade over the following two cadences. Jammed contacts expire sooner and render hollow with an uncertainty ring.

Soldier contacts from radar are classified as ground returns and never identify class or name. Existing tactical-system pings remain more precise and preserve their red targeting ring.

### AI and data gathering

- AI target acquisition may use only fresh radar tracks when direct perception is absent.
- Radar-assisted AI receives a last-known destination, not the hidden live target position.
- Vehicle telemetry records sweeps, contacts resolved, jammed returns, tracks reacquired, and locks received by domain/source.
- The vehicle scenario runner includes radar acquisition, terrain masking, ECM degradation, track expiry, and sonar domain scenarios.

## Minimap radar surface

The existing square, north-up minimap remains the base.

- A subtle sweep line and two range rings appear only while the local player has an active onboard emitter or receives a staffed-sensor picture.
- The scope header reads the strongest current source and state: `RDR AIR 125`, `RDR TEAM 160`, `SONAR 80`, `SEN DAMAGED`, or `JAM`.
- Friendly units remain filled dots. Directly seen hostiles remain solid triangles. Radar-only hostiles are hollow domain glyphs: triangle for air, hard square for ground/machine, chevron for surface, and paired arc for submerged.
- Air contacts carry a one-character band (`B`, `S`, `C` for Building/Sky/Clouds); submerged contacts carry `D`.
- Fresh returns brighten when the sweep crosses them, then hold and fade at their last-known point. Jammed returns use a hollow uncertainty ring and never pretend to show exact truth.
- The player's range rings use world-to-map scale, so they remain correct on rectangular 600×900 and 900×600 theaters.
- Mission objectives, waypoints, pads, gates, LOS contacts, and contact ghosts retain their current behavior.

## Aircraft instrument cluster

`index.html` gains one `#vehicle-instruments` plate above the weapon block and below the minimap. It is visible only to the driver of a flying vehicle; a compact naval variant may show speed/depth/sonar without the airspeed dial.

The aircraft layout uses the existing PixelLab gunmetal analog-dial frame as chrome:

- **Airspeed dial:** a live needle rotates across the PixelLab 0–8 arc. The digital center bay states actual speed and top-speed percentage. The stall region is marked red; afterburner adds an amber `AB` state.
- **Heading tape:** `W 274°` with adjacent cardinal ticks, derived from vehicle yaw and normalized to 0–359 degrees.
- **Altitude ladder:** four discrete pips labeled `G B S C`; the current band fills amber, unreachable bands stay dim, climb/dive controls remain in the hint line.
- **Radar line:** source, range, next sweep pulse, number of fresh tracks, sensor health, and `JAM` status.
- **Threat line:** the existing missile detection becomes a dedicated red `LOCK / MISSILE INBOUND` state on the plate while remaining in the textual hint for redundancy.
- **Rotor state:** rotorcraft show spool progress or `FLIGHT`; fixed-wing aircraft show `STALL`, `CRUISE`, or `AB` based on current speed and burner state.

All critical readings are real DOM text with accessible labels. The image is decorative chrome, never baked information. The clean vector plate remains the fallback if the PixelLab asset fails.

## Error handling and compatibility

- Worlds without radar-capable vehicles behave byte-for-byte as before apart from an empty radar-track container.
- Missing optional vehicle fields default safely; old campaign saves require no migration because tracks are transient battle state.
- Destroyed or unstaffed emitters stop refreshing tracks, but existing tracks fade naturally rather than blinking away.
- A local pilot leaving or dying hides the instrument cluster immediately.
- Canvas drawing saves/restores alpha and transforms around every radar overlay to prevent state leaks into existing minimap marks.
- Radar source selection is deterministic when several emitters overlap: prefer sonar for a submerged local submarine, then onboard radar, then the freshest/highest-range team sensor source.

## Testing and production evidence

- Pure radar tests cover domain classification, every emitter profile, range/cadence, rectangular-map projection, terrain masking, elevation advantage, weather penalties, ECM uncertainty, last-known immobility, expiry, and deterministic results.
- World tests prove staffed sensors share tracks, damaged sensors stop sweeps, destroyed enemy ECM improves resolution, aircraft onboard radar works without a sensor operator, and submarine sonar never resolves air contacts.
- HUD tests cover heading normalization, speed percentage, stall/afterburner state, altitude pips, radar source labels, lock danger, and hidden states outside the driver seat.
- Scenario telemetry proves AI uses last-known positions, reacquisition is measured, and no hidden live position leaks between sweeps.
- Harness verification renders the instrument plate at desktop and short-window sizes with fixed-wing, rotorcraft, and submarine states.
- Live verification flies at least one jet and helicopter, observes a moving hostile remain at its last-known point between sweeps, validates ECM/track fade, and dives a submarine to verify sonar-only contacts.
- Production gates: `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build` all pass.

## Scope boundary

This slice does not add beyond-visual-range weapon firing, manual radar-mode keybinds, radar-guided missile launch authority, airborne warning aircraft, or a second full-screen tactical command UI. It ships the radar truth model, minimap presentation, AI-consumable last-known tracks, telemetry, and the complete vehicle instrument surface those later systems require.
