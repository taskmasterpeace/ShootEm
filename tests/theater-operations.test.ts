import { describe, expect, it } from 'vitest';
import { generateOperationMap } from '../src/sim/operation-map';
import {
  generateOperation,
  operationRequiresVehicleTheater,
  theaterForOperation,
  type OperationHull,
  type OperationManifest,
  type OperationPlan,
  type OperationSiteId,
  type OperationVerbId,
} from '../src/sim/operations';

const inventory: OperationHull[] = [
  { id: 'tank-01', kind: 'tank', name: 'Ares One', status: 'available' },
  { id: 'jet-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
  { id: 'boat-01', kind: 'boat', name: 'Pike One', status: 'available' },
];

const manifest = (hullIds: string[]): OperationManifest => ({ hullIds, ammunition: 1, support: 'none' });

function operation(verb: OperationVerbId, site: OperationSiteId, pass: 1 | 2 | 3 = 2): OperationPlan {
  const base = generateOperation({ seed: 0x51a7, frontId: 'test_front', frontName: 'Test Front', pass });
  const domain = verb === 'amphibious_assault' || verb === 'blockade' ? 'sea'
    : verb === 'air_superiority' || verb === 'intercept' ? 'air'
      : 'land';
  return {
    ...base,
    verb,
    site,
    domains: [domain],
    requirements: { [domain]: 1 },
    phases: [{ id: `${verb}:1`, kind: domain === 'air' ? 'eliminate' : domain === 'sea' ? 'hold' : 'capture', label: 'Test objective', domain }],
  };
}

describe('Operation theater selection', () => {
  it.each([
    ['air_superiority', 'airfield', 'desert'],
    ['intercept', 'mountain_pass', 'mountain'],
    ['amphibious_assault', 'port', 'coastal'],
    ['blockade', 'carrier_anchorage', 'ocean'],
    ['spearhead', 'rail_hub', 'city'],
  ] as const)('maps %s at %s to the %s theater', (verb, site, theater) => {
    expect(theaterForOperation(operation(verb, site))).toBe(theater);
  });

  it('moves fixed-wing operations out of the dense city and into countryside airspace', () => {
    expect(theaterForOperation(operation('air_superiority', 'rail_hub'))).toBe('countryside');
  });

  it('keeps only small land-only spearhead and siege plans on legacy grounds', () => {
    const small = operation('spearhead', 'front_line', 1);
    expect(operationRequiresVehicleTheater(small, manifest(['tank-01']), inventory)).toBe(false);
    expect(theaterForOperation(small)).toBeNull();
    expect(operationRequiresVehicleTheater({ ...small, scale: 'standard' }, manifest(['tank-01']), inventory)).toBe(true);
    expect(operationRequiresVehicleTheater(small, manifest(['jet-01']), inventory)).toBe(true);
  });

  it('generates operation maps from the selected vehicle theater', () => {
    const plan = operation('amphibious_assault', 'port');
    const map = generateOperationMap(plan, manifest(['boat-01']), inventory);
    expect(map.theater?.id).toBe('coastal');
    expect(map.geometry).toMatchObject({ cols: 300, rows: 200, tile: 3 });
    expect(map.operation?.operationId).toBe(plan.id);
  });
});
