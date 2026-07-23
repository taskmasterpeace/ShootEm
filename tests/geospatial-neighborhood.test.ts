import { describe, expect, it } from 'vitest';
import { buildStreetNetwork } from '../src/sim/geospatial/street-network';
import {
  auditBuildingRoadOverlap,
  auditEntranceConnectivity,
  deriveNeighborhood,
} from '../src/sim/geospatial/neighborhood';
import type {
  ProjectedGeoBuilding,
  ProjectedGeoRoad,
  SemanticDistrict,
} from '../src/sim/geospatial/types';

const geometry = { cols: 60, rows: 60, tile: 3 } as const;

const road = (id: string, points: ProjectedGeoRoad['points']): ProjectedGeoRoad => ({
  id,
  roadClass: 'residential',
  points,
  width: 6,
  sidewalk: 'both',
  bridge: false,
  tunnel: false,
});

const building = (id: string, x: number, z: number, width = 12, depth = 9): ProjectedGeoBuilding => ({
  id,
  polygon: [
    { x: x - width / 2, z: z - depth / 2 },
    { x: x + width / 2, z: z - depth / 2 },
    { x: x + width / 2, z: z + depth / 2 },
    { x: x - width / 2, z: z + depth / 2 },
  ],
});

describe('semantic neighborhood derivation', () => {
  it('creates varied interlocking blocks, disjoint lots, and connected front doors', () => {
    const network = buildStreetNetwork([
      road('vertical-west', [{ x: -36, z: -90 }, { x: -36, z: 90 }]),
      road('vertical-east', [{ x: 24, z: -90 }, { x: 24, z: 90 }]),
      road('horizontal-south', [{ x: -90, z: -27 }, { x: 90, z: -27 }]),
      road('horizontal-north', [{ x: -90, z: 30 }, { x: 90, z: 30 }]),
    ], geometry);
    const buildings = [
      building('house:southwest', -58, -56),
      building('shop:south', -4, -54, 18, 12),
      building('hall:center', -5, 0, 21, 15),
      building('house:northeast', 55, 58),
      building('house:northwest', -60, 57, 15, 12),
    ];

    const first = deriveNeighborhood(buildings, network, geometry);
    const second = deriveNeighborhood(buildings, network, geometry);

    expect(first).toEqual(second);
    expect(first.blocks.length).toBeGreaterThanOrEqual(4);
    expect(new Set(first.blocks.map((block) => block.area)).size).toBeGreaterThanOrEqual(3);
    expect(first.lots).toHaveLength(buildings.length);
    expect(first.placements).toHaveLength(buildings.length);

    const claimed = new Set<number>();
    for (const lot of first.lots) {
      for (const cell of lot.cells) {
        expect(claimed.has(cell), `overlapping lot cell ${cell}`).toBe(false);
        claimed.add(cell);
      }
    }
    for (const placement of first.placements) {
      expect(placement.frontageRoadId).toBeTruthy();
      expect(placement.entrance.pedestrianConnector.length).toBeGreaterThan(0);
      expect(network.pedestrianCells.has(placement.entrance.pedestrianConnector.at(-1)!)).toBe(true);
    }
  });

  it('audits disconnected entrances and building/carriageway overlap by id', () => {
    const network = buildStreetNetwork([
      road('main', [{ x: -90, z: 0 }, { x: 90, z: 0 }]),
    ], geometry);
    const layout = deriveNeighborhood([building('house', -30, 18)], network, geometry);
    const placed = layout.placements[0];
    const semanticBuilding = {
      id: placed.buildingId,
      footprint: building('house', -30, 18).polygon,
      blockId: placed.blockId,
      lotId: placed.lotId,
      use: { value: 'house', source: 'osm', confidence: 'high' },
      floors: { value: 1, source: 'inferred', confidence: 'medium' },
      height: { value: 4, source: 'inferred', confidence: 'medium' },
      archetype: 'house', roof: 'gable', facade: 'detached',
      entrances: [placed.entrance], interiorPolicy: 'sealed',
    } as const;
    const district = {
      buildings: [semanticBuilding],
    } as unknown as SemanticDistrict;

    expect(auditEntranceConnectivity(district, network.pedestrianCells, geometry)).toEqual([]);
    semanticBuilding.entrances[0].pedestrianConnector.length = 0;
    expect(auditEntranceConnectivity(district, network.pedestrianCells, geometry)).toEqual(['house']);

    const overlapping = { ...semanticBuilding, footprint: [{ x: -6, z: -3 }, { x: 6, z: -3 }, { x: 6, z: 3 }, { x: -6, z: 3 }] };
    expect(auditBuildingRoadOverlap([overlapping], network.carriagewayCells, geometry)).toEqual(['house']);
  });
});
