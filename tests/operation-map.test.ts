import { describe, expect, it } from 'vitest';
import { generateOperationMap } from '../src/sim/operation-map';
import { deserializeDoc, serializeDoc, validateDoc, type MakerDoc } from '../src/sim/mapedit';
import { Rng } from '../src/sim/rng';
import {
  OPERATION_SITES,
  generateOperation,
  type OperationHull,
  type OperationManifest,
  type OperationPlan,
  type OperationScale,
  type OperationSiteId,
} from '../src/sim/operations';
import type { GameMap } from '../src/sim/map';
import { T_WATER, tileAt } from '../src/sim/map';

const hulls: OperationHull[] = [
  { id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' },
  { id: 'falcon-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
  { id: 'pike-01', kind: 'boat', name: 'Pike One', status: 'available' },
];
const manifest: OperationManifest = { hullIds: hulls.map((hull) => hull.id), ammunition: 2, support: 'none' };

function planFor(site: OperationSiteId, scale: OperationScale, seed: number): OperationPlan {
  const pass = scale === 'skirmish' ? 1 : scale === 'standard' ? 2 : 3;
  return { ...generateOperation({ seed, frontId: 'the_port', frontName: 'The Port', pass }), site, scale };
}

function asDoc(map: GameMap): MakerDoc {
  return {
    frontId: null,
    size: map.operation?.scale === 'large' ? 'large' : map.operation?.scale === 'standard' ? 'standard' : 'small',
    seed: map.seed,
    mode: 'operation',
    map,
    claims: map.propCovered.map((idx) => ({ idx, t: map.grid[idx] })),
    rng: new Rng(map.seed),
    undoStack: [],
    redoStack: [],
  };
}

describe('Operation mission grounds', () => {
  const matrix = OPERATION_SITES.flatMap((site) =>
    (['skirmish', 'standard', 'large'] as const).flatMap((scale) =>
      [7, 42, 1337, 90210].map((seed) => ({ site: site.id, scale, seed })),
    ),
  );

  it.each(matrix)('$site $scale seed $seed is lawful, deterministic mission ground', ({ site, scale, seed }) => {
    const plan = planFor(site, scale, seed);
    const map = generateOperationMap(plan, manifest, hulls);
    const again = generateOperationMap(plan, manifest, hulls);
    const report = validateDoc(asDoc(map));
    expect(report.ok, report.issues.map((issue) => `${issue.law}: ${issue.detail}`).join(' · ')).toBe(true);
    expect(Buffer.from(map.grid)).toEqual(Buffer.from(again.grid));
    expect(map.operation?.operationId).toBe(plan.id);
    expect(map.operation?.site).toBe(site);
    expect(map.operation?.scale).toBe(scale);
    expect(map.operation?.objectives.map((objective) => objective.phaseId)).toEqual(plan.phases.map((phase) => phase.id));
  });

  it('puts every committed hull on a safe team-zero pad', () => {
    const map = generateOperationMap(planFor('port', 'large', 7749), manifest, hulls);
    const kinds = map.vehiclePads.filter((pad) => pad.team === 0).map((pad) => pad.kind);
    for (const hull of hulls) expect(kinds).toContain(hull.kind);
    const pike = map.vehiclePads.find((pad) => pad.operationHullId === 'pike-01');
    expect(pike).toBeTruthy();
    expect(tileAt(map.grid, pike!.pos.x, pike!.pos.z)).toBe(T_WATER);
  });

  it('keeps objective metadata through Map Maker serialization', () => {
    const map = generateOperationMap(planFor('airfield', 'standard', 5150), manifest, hulls);
    const restored = deserializeDoc(serializeDoc(asDoc(map))).map;
    expect(restored.operation).toEqual(map.operation);
  });

  it('does not mutate an earlier generated map while dressing another', () => {
    const plan = planFor('mountain_pass', 'large', 99);
    const first = generateOperationMap(plan, manifest, hulls);
    const snapshot = JSON.stringify(first.operation);
    generateOperationMap({ ...plan, id: `${plan.id}:other`, site: 'airfield' }, manifest, hulls);
    expect(JSON.stringify(first.operation)).toBe(snapshot);
  });
});
