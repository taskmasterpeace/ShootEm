import { generateFront, type MapSize } from './fronts';
import type { GameMap } from './map';
import { generateSkirmishMap } from './skirmish';
import type { ThemeId, VehicleKind } from './types';
import type {
  OperationHull,
  OperationManifest,
  OperationPlan,
  OperationSiteId,
} from './operations';

const SITE_FRONT: Record<OperationSiteId, string> = {
  front_line: 'eastern_plains',
  strongpoint: 'fort_raven',
  river_crossing: 'bridge_delta',
  supply_depot: 'refinery',
  rail_hub: 'the_city',
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

function selectedKinds(manifest: OperationManifest, inventory: readonly OperationHull[]): VehicleKind[] {
  const byId = new Map(inventory.map((hull) => [hull.id, hull]));
  return [...new Set(manifest.hullIds)].flatMap((id) => {
    const hull = byId.get(id);
    return hull?.status === 'available' ? [hull.kind] : [];
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
      ...(phase.kind === 'destroy' && firstTarget >= 0 ? { targetPropIndex: firstTarget } : {}),
    })),
    protectedZones: plan.complication === 'no_collateral'
      ? [{ pos: { ...(map.houses[0]?.center ?? points[0]) }, radius: 10 }]
      : [],
  };
}

function dressPads(map: GameMap, kinds: VehicleKind[]) {
  if (kinds.length === 0) return;
  const safe = map.vehiclePads.filter((pad) => pad.team === 0);
  if (safe.length === 0) return;
  map.vehiclePads = [
    ...kinds.map((kind, index) => ({ kind, team: 0 as const, pos: { ...safe[index % safe.length].pos } })),
    ...map.vehiclePads.filter((pad) => pad.team === 1),
  ];
}

export function generateOperationMap(
  plan: OperationPlan,
  manifest: OperationManifest,
  inventory: readonly OperationHull[],
): GameMap {
  const kinds = selectedKinds(manifest, inventory);
  if (plan.scale === 'skirmish') {
    const map = generateSkirmishMap(SITE_THEME[plan.site], plan.seed, {
      site: plan.site,
      objectiveLabels: plan.phases.map((phase) => phase.label),
      vehicleKinds: kinds,
    });
    map.operation = objectiveMetadata(plan, map);
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
  dressPads(map, kinds);
  map.operation = objectiveMetadata(plan, map);
  return map;
}
