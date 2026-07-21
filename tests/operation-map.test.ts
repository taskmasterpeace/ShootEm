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
  { id: 'pike-02', kind: 'boat', name: 'Pike Two', status: 'available' },
  { id: 'pike-03', kind: 'boat', name: 'Pike Three', status: 'available' },
];
const WET_SITES = new Set<OperationSiteId>(['river_crossing', 'coastal_battery', 'port', 'carrier_anchorage']);
const manifestFor = (site: OperationSiteId): OperationManifest => ({
  hullIds: hulls.filter((hull) => hull.kind !== 'boat' || WET_SITES.has(site)).map((hull) => hull.id),
  ammunition: 2,
  support: 'none',
});

function planFor(site: OperationSiteId, scale: OperationScale, seed: number): OperationPlan {
  const pass = scale === 'skirmish' ? 1 : scale === 'standard' ? 2 : 3;
  const base = generateOperation({ seed, frontId: 'the_port', frontName: 'The Port', pass });
  return {
    ...base,
    site,
    scale,
    verb: 'spearhead',
    domains: ['land'],
    requirements: { land: 1 },
    phases: [{ id: 'spearhead:1', kind: 'capture', label: 'Break the line', domain: 'land' }],
  };
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
    const manifest = manifestFor(site);
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
    const map = generateOperationMap(planFor('port', 'large', 7749), manifestFor('port'), hulls);
    const kinds = map.vehiclePads.filter((pad) => pad.team === 0).map((pad) => pad.kind);
    for (const hull of hulls) expect(kinds).toContain(hull.kind);
    const pikes = map.vehiclePads.filter((pad) => pad.operationHullId?.startsWith('pike-'));
    expect(pikes).toHaveLength(3);
    expect(new Set(pikes.map((pad) => `${pad.pos.x}:${pad.pos.z}`)).size).toBe(3);
    for (const pike of pikes) expect(tileAt(map.grid, pike.pos.x, pike.pos.z, map.geometry)).toBe(T_WATER);
  });

  it('keeps every skirmish Pike on a distinct water spawn', () => {
    const map = generateOperationMap(planFor('port', 'skirmish', 7749), manifestFor('port'), hulls);
    const pikes = map.vehiclePads.filter((pad) => pad.operationHullId?.startsWith('pike-'));
    expect(pikes).toHaveLength(3);
    expect(new Set(pikes.map((pad) => `${pad.pos.x}:${pad.pos.z}`)).size).toBe(3);
    for (const pike of pikes) expect(tileAt(map.grid, pike.pos.x, pike.pos.z, map.geometry)).toBe(T_WATER);
  });

  it('keeps objective metadata through Map Maker serialization', () => {
    const map = generateOperationMap(planFor('airfield', 'standard', 5150), manifestFor('airfield'), hulls);
    const restored = deserializeDoc(serializeDoc(asDoc(map))).map;
    expect(restored.operation).toEqual(map.operation);
  });

  it('materializes every target in a multi-emplacement destroy phase', () => {
    const base = planFor('strongpoint', 'standard', 5150);
    const plan: OperationPlan = {
      ...base,
      phases: [{ id: 'siege:1', kind: 'destroy', label: 'Reduce the defenses', domain: 'land', targetCount: 3 }],
    };
    const map = generateOperationMap(plan, manifestFor('strongpoint'), hulls);
    const targets = map.vehiclePads.filter((pad) => pad.operationObjectiveId === `${plan.id}:objective:1`);
    expect(targets).toHaveLength(3);
    expect(new Set(targets.map((pad) => `${pad.pos.x}:${pad.pos.z}`)).size).toBe(3);
    expect(map.operation?.objectives[0].targetCount).toBe(3);
  });

  it('fields enough enemy airframes for an Air Superiority skirmish', () => {
    const base = planFor('airfield', 'skirmish', 31);
    const plan: OperationPlan = {
      ...base,
      verb: 'air_superiority',
      domains: ['air'],
      requirements: { air: 1 },
      phases: [{ id: 'air_superiority:1', kind: 'eliminate', label: 'Clear the sector sky', domain: 'air', targetCount: 4 }],
    };
    const airManifest: OperationManifest = { hullIds: ['falcon-01'], ammunition: 1, support: 'none' };
    const map = generateOperationMap(plan, airManifest, hulls);
    const enemyAir = map.vehiclePads.filter((pad) => pad.team === 1 && ['flyer', 'strikejet', 'interceptor', 'bomber'].includes(pad.kind));
    expect(enemyAir.length).toBeGreaterThanOrEqual(4);
  });

  it('fields enemy gunboats on water for a Blockade skirmish', () => {
    const base = planFor('port', 'skirmish', 41);
    const plan: OperationPlan = {
      ...base,
      verb: 'blockade',
      domains: ['sea'],
      requirements: { sea: 1 },
      phases: [{ id: 'blockade:1', kind: 'hold', label: 'Seal the channel', domain: 'sea', duration: 120 }],
    };
    const seaManifest: OperationManifest = { hullIds: ['pike-01'], ammunition: 1, support: 'none' };
    const map = generateOperationMap(plan, seaManifest, hulls);
    const boats = map.vehiclePads.filter((pad) => pad.team === 1 && pad.kind === 'boat');
    expect(boats.length).toBeGreaterThanOrEqual(1);
    for (const boat of boats) expect(tileAt(map.grid, boat.pos.x, boat.pos.z, map.geometry)).toBe(T_WATER);
  });

  it('does not mutate an earlier generated map while dressing another', () => {
    const plan = planFor('mountain_pass', 'large', 99);
    const manifest = manifestFor('mountain_pass');
    const first = generateOperationMap(plan, manifest, hulls);
    const snapshot = JSON.stringify(first.operation);
    generateOperationMap({ ...plan, id: `${plan.id}:other`, site: 'airfield' }, manifest, hulls);
    expect(JSON.stringify(first.operation)).toBe(snapshot);
  });
});
