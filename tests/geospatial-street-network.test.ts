import { describe, expect, it } from 'vitest';
import { buildStreetNetwork, resolveRoadWidth } from '../src/sim/geospatial/street-network';
import type { ProjectedGeoRoad } from '../src/sim/geospatial/types';

const geometry = { cols: 40, rows: 40, tile: 3 } as const;

const road = (
  id: string,
  points: ProjectedGeoRoad['points'],
  options: Partial<ProjectedGeoRoad> = {},
): ProjectedGeoRoad => ({
  id,
  roadClass: 'residential',
  points,
  bridge: false,
  tunnel: false,
  ...options,
});

describe('semantic street network', () => {
  it('splits geometric crossings into shared connectors and one vehicle component', () => {
    const network = buildStreetNetwork([
      road('east-west', [{ x: -45, z: 0 }, { x: 45, z: 0 }], { width: 9, sidewalk: 'both' }),
      road('north-south', [{ x: 0, z: -45 }, { x: 0, z: 45 }], { lanes: 2, sidewalk: 'both' }),
    ], geometry);

    const crossing = network.connectors.find((connector) =>
      Math.hypot(connector.point.x, connector.point.z) < 0.01);
    expect(crossing?.roadIds).toEqual(['east-west', 'north-south']);
    expect(network.segments).toHaveLength(4);
    expect(network.vehicleComponents).toHaveLength(1);
    expect(network.carriagewayCells.size).toBeGreaterThan(0);
    expect(network.sidewalkCells.size).toBeGreaterThan(0);
    expect(network.pedestrianCells.size).toBeGreaterThan(network.sidewalkCells.size - 1);
  });

  it('keeps bridge and ground crossings grade-separated', () => {
    const network = buildStreetNetwork([
      road('ground', [{ x: -45, z: 0 }, { x: 45, z: 0 }]),
      road('bridge', [{ x: 0, z: -45 }, { x: 0, z: 45 }], { bridge: true }),
    ], geometry);

    expect(network.connectors.some((connector) => connector.roadIds.length > 1)).toBe(false);
    expect(network.segments).toHaveLength(2);
  });

  it('resolves widths from explicit measurements, lanes, and profile defaults', () => {
    expect(resolveRoadWidth(road('measured', [], { width: 11 }), { residential: 6 })).toBe(11);
    expect(resolveRoadWidth(road('laned', [], { lanes: 3 }), { residential: 6 })).toBeCloseTo(10.2);
    expect(resolveRoadWidth(road('default', []), { residential: 7 })).toBe(7);
  });

  it('classifies service access and foot paths separately', () => {
    const network = buildStreetNetwork([
      road('alley', [{ x: -30, z: -12 }, { x: 30, z: -12 }], { roadClass: 'service', service: 'alley' }),
      road('walk', [{ x: -30, z: 12 }, { x: 30, z: 12 }], { roadClass: 'footway' }),
    ], geometry);

    expect(network.segments.find((segment) => segment.roadId === 'alley')?.kind).toBe('service');
    expect(network.segments.find((segment) => segment.roadId === 'walk')?.kind).toBe('path');
    expect(network.pedestrianCells.size).toBeGreaterThan(0);
  });
});
