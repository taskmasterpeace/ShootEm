import { generateFront, type MapSize } from './fronts';
import { T_DEEP, T_WATER, houseAt, isBlocked, type GameMap } from './map';
import { inBounds, tileIndex, tileToWorld, worldToTile } from './map-geometry';
import { generateSkirmishMap } from './skirmish';
import { dressOperationPads, operationWaterSpawns } from './operation-pads';
import type { ThemeId, VehicleKind } from './types';
import type {
  OperationHull,
  OperationManifest,
  OperationPlan,
  OperationSiteId,
} from './operations';
import { operationRequiresVehicleTheater, siteTheater, theaterForOperation } from './operations';
import { generateTheater } from './theaters';

const SITE_FRONT: Record<OperationSiteId, string> = {
  front_line: 'eastern_plains',
  strongpoint: 'fort_raven',
  river_crossing: 'bridge_delta',
  supply_depot: 'refinery',
  rail_hub: 'the_city',
  civic_front: 'the_city',
  airfield: 'airbase',
  coastal_battery: 'the_port',
  port: 'the_port',
  carrier_anchorage: 'the_port',
  mountain_pass: 'highland_pass',
};

const SITE_THEME: Record<OperationSiteId, ThemeId> = {
  front_line: 'savanna',
  strongpoint: 'titan',
  river_crossing: 'europa',
  supply_depot: 'starship',
  rail_hub: 'titan',
  civic_front: 'hardpan',
  airfield: 'savanna',
  coastal_battery: 'europa',
  port: 'europa',
  carrier_anchorage: 'europa',
  mountain_pass: 'asteroid',
};

// The City's procedural lots have four law-patrolled rolls. Operation plans
// deterministically choose among them instead of allowing a random building
// stamp to seal a medkit room and invalidate an otherwise valid rail-hub op.
const CITY_OPERATION_SEEDS = [4207, 5150, 1337, 90210] as const;

function cloneMap(map: GameMap): GameMap {
  return {
    ...map,
    geometry: { ...map.geometry },
    theater: map.theater ? {
      ...map.theater,
      domains: [...map.theater.domains],
      routes: map.theater.routes.map((route) => ({ ...route, points: route.points.map((point) => ({ ...point })) })),
      landingZones: map.theater.landingZones.map((zone) => ({ ...zone, pos: { ...zone.pos } })),
      deepWater: [...map.theater.deepWater],
    } : undefined,
    grid: map.grid.slice(),
    grid2: map.grid2.slice(),
    surface: map.surface.slice(),
    basePos: [{ ...map.basePos[0] }, { ...map.basePos[1] }],
    spawns: [map.spawns[0].map((spawn) => ({ ...spawn })), map.spawns[1].map((spawn) => ({ ...spawn }))],
    flagPos: [{ ...map.flagPos[0] }, { ...map.flagPos[1] }],
    hillPos: { ...map.hillPos },
    controlPoints: map.controlPoints.map((point) => ({ name: point.name, pos: { ...point.pos } })),
    vehiclePads: map.vehiclePads.map((pad) => ({ ...pad, pos: { ...pad.pos } })),
    pickups: map.pickups.map((pickup) => ({ ...pickup, pos: { ...pickup.pos } })),
    props: map.props.map((prop) => ({ ...prop, pos: { ...prop.pos } })),
    zombieSpawns: map.zombieSpawns.map((spawn) => ({ ...spawn })),
    houses: map.houses.map((house) => ({
      ...house,
      center: { ...house.center },
      door: { ...house.door },
      maskRows: house.maskRows?.slice(),
    })),
    gates: map.gates.map((gate) => ({ a: { ...gate.a }, b: { ...gate.b } })),
    pads: map.pads.map((pad) => ({ pos: { ...pad.pos }, dir: { ...pad.dir } })),
    propCovered: map.propCovered.slice(),
    operation: undefined,
  };
}

function selectedHulls(manifest: OperationManifest, inventory: readonly OperationHull[]): Array<{ id: string; kind: VehicleKind }> {
  const byId = new Map(inventory.map((hull) => [hull.id, hull]));
  return [...new Set(manifest.hullIds)].flatMap((id) => {
    const hull = byId.get(id);
    return hull && hull.status !== 'lost' ? [{ id: hull.id, kind: hull.kind }] : [];
  });
}

function objectiveMetadata(plan: OperationPlan, map: GameMap): NonNullable<GameMap['operation']> {
  const points = map.controlPoints.length > 0 ? map.controlPoints.map((point) => point.pos) : [map.hillPos];
  const firstTarget = map.props.findIndex((prop) => prop.type === 'bunker' || prop.type === 'crate' || prop.type === 'hangar' || prop.type === 'silo');
  return {
    operationId: plan.id,
    site: plan.site,
    scale: plan.scale,
    objectives: plan.phases.map((phase, index) => ({
      id: `${plan.id}:objective:${index + 1}`,
      phaseId: phase.id,
      kind: phase.kind,
      pos: { ...points[index % points.length] },
      radius: phase.kind === 'arrive' || phase.kind === 'escort' ? 8 : 6,
      ...(phase.targetCount === undefined ? {} : { targetCount: phase.targetCount }),
      ...(phase.kind === 'destroy' && firstTarget >= 0 ? { targetPropIndex: firstTarget } : {}),
    })),
    protectedZones: plan.complication === 'no_collateral'
      ? [{ pos: { ...(map.houses[0]?.center ?? points[0]) }, radius: 10 }]
      : [],
  };
}

function destroyTargetPositions(map: GameMap, objective: NonNullable<GameMap['operation']>['objectives'][number]) {
  const count = Math.max(1, objective.targetCount ?? 1);
  const candidates: Array<{ x: number; y: number; z: number; angle: number }> = [];
  const [tx, tz] = worldToTile(map.geometry, objective.pos.x, objective.pos.z);
  const rings = Math.max(2, Math.ceil(objective.radius / map.geometry.tile));
  for (let dz = -rings; dz <= rings; dz++) for (let dx = -rings; dx <= rings; dx++) {
    const x = tx + dx;
    const z = tz + dz;
    if (!inBounds(map.geometry, x, z) || x < 1 || z < 1 || x >= map.geometry.cols - 1 || z >= map.geometry.rows - 1) continue;
    const pos = tileToWorld(map.geometry, x, z);
    if (Math.hypot(pos.x - objective.pos.x, pos.z - objective.pos.z) > objective.radius) continue;
    const tile = map.grid[tileIndex(map.geometry, x, z)];
    if (tile === T_WATER || tile === T_DEEP || isBlocked(map.grid, pos.x, pos.z, false, map.geometry)) continue;
    candidates.push({ ...pos, angle: Math.atan2(pos.z - objective.pos.z, pos.x - objective.pos.x) });
  }
  candidates.sort((a, b) => a.angle - b.angle || Math.hypot(a.x - objective.pos.x, a.z - objective.pos.z) - Math.hypot(b.x - objective.pos.x, b.z - objective.pos.z));
  if (candidates.length < count) throw new Error(`Operation objective '${objective.phaseId}' has no room for ${count} targets.`);
  return Array.from({ length: count }, (_, index) => {
    const candidate = candidates[Math.floor(index * candidates.length / count)];
    return { x: candidate.x, y: candidate.y, z: candidate.z };
  });
}

function dressDestroyTargets(map: GameMap) {
  if (!map.operation) return;
  for (const objective of map.operation.objectives) {
    if (objective.kind !== 'destroy') continue;
    for (const pos of destroyTargetPositions(map, objective)) {
      map.vehiclePads.push({ kind: 'emplacement', team: 1, pos, operationObjectiveId: objective.id });
    }
  }
}

function enemyAirSpawns(map: GameMap) {
  const home = map.basePos[1];
  const used = new Set(map.vehiclePads.map((pad) => `${pad.pos.x.toFixed(3)}:${pad.pos.z.toFixed(3)}`));
  const candidates: Array<{ x: number; y: number; z: number }> = [];
  for (let z = 1; z < map.geometry.rows - 1; z++) for (let x = 1; x < map.geometry.cols - 1; x++) {
    const pos = tileToWorld(map.geometry, x, z);
    const key = `${pos.x.toFixed(3)}:${pos.z.toFixed(3)}`;
    if (used.has(key) || isBlocked(map.grid, pos.x, pos.z, false, map.geometry) || houseAt(map.houses, pos.x, pos.z) >= 0) continue;
    const tile = map.grid[tileIndex(map.geometry, x, z)];
    if (tile === T_WATER || tile === T_DEEP) continue;
    candidates.push(pos);
  }
  candidates.sort((a, b) => ((a.x - home.x) ** 2 + (a.z - home.z) ** 2) - ((b.x - home.x) ** 2 + (b.z - home.z) ** 2));
  return candidates;
}

function dressEnemyDomains(map: GameMap, plan: OperationPlan) {
  if (plan.domains.includes('air')) {
    const required = Math.max(1, ...plan.phases
      .filter((phase) => phase.domain === 'air' && phase.kind === 'eliminate')
      .map((phase) => phase.targetCount ?? 1));
    const existing = map.vehiclePads.filter((pad) => pad.team === 1
      && ['flyer', 'strikejet', 'interceptor', 'bomber'].includes(pad.kind)).length;
    const spawns = enemyAirSpawns(map);
    for (let i = existing; i < required; i++) {
      const pos = spawns[i - existing];
      if (!pos) throw new Error(`Operation ground has no room for ${required} hostile airframes.`);
      map.vehiclePads.push({ kind: 'interceptor', team: 1, pos });
    }
  }
  if (plan.domains.includes('sea')) {
    const required = Math.max(1, ...plan.phases
      .filter((phase) => phase.domain === 'sea' && phase.kind === 'eliminate')
      .map((phase) => phase.targetCount ?? 1));
    const wet = operationWaterSpawns(map, 1);
    const boats = map.vehiclePads.filter((pad) => pad.team === 1 && pad.kind === 'boat');
    if (wet.length < Math.max(required, boats.length)) throw new Error(`Operation ground has no room for ${required} hostile boats.`);
    boats.forEach((pad, index) => { pad.pos = { ...wet[index] }; });
    for (let i = boats.length; i < required; i++) map.vehiclePads.push({ kind: 'boat', team: 1, pos: { ...wet[i] } });
  }
}

function dressComplication(map: GameMap, plan: OperationPlan) {
  if (plan.complication !== 'scorched_earth' || !map.operation) return;
  const prizeAt = map.operation.objectives.at(-1)?.pos ?? map.hillPos;
  map.vehiclePads.push({ kind: 'transport', team: 0, pos: { ...prizeAt }, operationPrize: true });
}

export function generateOperationMap(
  plan: OperationPlan,
  manifest: OperationManifest,
  inventory: readonly OperationHull[],
): GameMap {
  const hulls = selectedHulls(manifest, inventory);
  const selectedTheater = theaterForOperation(plan);
  if (selectedTheater || operationRequiresVehicleTheater(plan, manifest, inventory)) {
    const map = generateTheater(selectedTheater ?? siteTheater(plan.site), plan.seed);
    map.controlPoints = plan.phases.map((phase, index) => ({
      name: phase.label.toUpperCase(),
      pos: { ...(map.controlPoints[index % map.controlPoints.length]?.pos ?? map.hillPos) },
    }));
    dressOperationPads(map, hulls);
    map.operation = objectiveMetadata(plan, map);
    dressEnemyDomains(map, plan);
    dressDestroyTargets(map);
    dressComplication(map, plan);
    return map;
  }
  if (plan.scale === 'skirmish') {
    const map = generateSkirmishMap(SITE_THEME[plan.site], plan.seed, {
      site: plan.site,
      objectiveLabels: plan.phases.map((phase) => phase.label),
      vehicles: hulls,
    });
    map.operation = objectiveMetadata(plan, map);
    dressEnemyDomains(map, plan);
    dressDestroyTargets(map);
    dressComplication(map, plan);
    return map;
  }

  const size: MapSize = plan.scale === 'large' ? 'large' : 'standard';
  const mapSeed = plan.site === 'rail_hub'
    ? CITY_OPERATION_SEEDS[plan.seed % CITY_OPERATION_SEEDS.length]
    : plan.seed;
  const generated = generateFront(SITE_FRONT[plan.site], mapSeed, size);
  if (!generated) throw new Error(`No Operation ground for site '${plan.site}'.`);
  const map = cloneMap(generated);
  map.controlPoints = plan.phases.map((phase, index) => ({
    name: phase.label.toUpperCase(),
    pos: { ...(generated.controlPoints[index % generated.controlPoints.length]?.pos ?? generated.hillPos) },
  }));
  dressOperationPads(map, hulls);
  map.operation = objectiveMetadata(plan, map);
  dressEnemyDomains(map, plan);
  dressDestroyTargets(map);
  dressComplication(map, plan);
  return map;
}
