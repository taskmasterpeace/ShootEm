import { VEHICLES } from './data';
import { asElevationLevel, maxElevationFor } from './elevation';
import { generateTheater, THEATER_DEFS } from './theaters';
import type { TheaterId } from './theater-types';
import type { PlayerCmd, Soldier, Vehicle, VehicleKind } from './types';
import { World } from './world';
import { T_WALL } from './map';
import { tileIndex, worldToTile } from './map-geometry';
import { createVehicleTelemetry, vehicleTelemetrySnapshot, type VehicleTelemetrySnapshot } from './vehicle-telemetry';
import { createTheaterBase, validateTheater } from './theater-builder';

type Observer = () => void;
const observers = new WeakMap<World, Observer[]>();

function observe(world: World, observer: Observer): void {
  const list = observers.get(world) ?? [];
  list.push(observer);
  observers.set(world, list);
}

export function runScenario(world: World, seconds: number, hz = 20): World {
  const dt = 1 / hz;
  const steps = Math.ceil(seconds * hz);
  for (let step = 0; step < steps; step++) {
    world.step(dt, new Map());
    for (const observer of observers.get(world) ?? []) observer();
  }
  return world;
}

export interface RouteProbeResult {
  nonFinite: number;
  persistentStalls: number;
  routeCompleted: boolean;
}

export interface RouteProbe {
  world: World;
  soldier: Soldier;
  vehicle: Vehicle;
  result(): RouteProbeResult;
}

function routeVehicleKind(theaterId: TheaterId): VehicleKind {
  return theaterId === 'ocean' ? 'boat' : 'tank';
}

export function makeRouteProbe(theaterId: TheaterId, seed: number): RouteProbe {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  const soldier = world.addSoldier('ROUTE-PROBE', 'infantry', 0, 'bot');
  const kind = routeVehicleKind(theaterId);
  const domain = kind === 'boat' ? 'surface' : 'ground';
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === domain).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no ${domain} route for probe`);
  const vehicle = world.spawnVehicle(kind, 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  vehicle.spoolUntil = 0;
  vehicle.landed = false;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  let nonFinite = 0;
  observe(world, () => {
    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z].every(Number.isFinite)) nonFinite++;
  });
  return {
    world, soldier, vehicle,
    result: () => ({
      nonFinite,
      persistentStalls: soldier.botVehiclePersistentStalls ?? 0,
      routeCompleted: soldier.botVehicleRouteCompleted === true,
    }),
  };
}

export interface AirProbeResult extends RouteProbeResult { elevationUsed: number[] }
export interface AirProbe {
  world: World;
  soldier: Soldier;
  vehicle: Vehicle;
  result(): AirProbeResult;
}

export function makeAirProbe(theaterId: TheaterId, seed: number, profile: 'patrol' | 'strike'): AirProbe {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  const soldier = world.addSoldier('AIR-PROBE', 'infantry', 0, 'bot');
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === 'air').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no air route for probe`);
  const vehicle = world.spawnVehicle('interceptor', 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  vehicle.spoolUntil = 0;
  vehicle.band = 3;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  soldier.botAirProfile = profile;
  const elevationUsed = new Set<number>([3]);
  let nonFinite = 0;
  observe(world, () => {
    elevationUsed.add(asElevationLevel(vehicle.band));
    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z].every(Number.isFinite)) nonFinite++;
  });
  return {
    world, soldier, vehicle,
    result: () => ({
      nonFinite,
      persistentStalls: soldier.botVehiclePersistentStalls ?? 0,
      routeCompleted: soldier.botVehicleRouteCompleted === true,
      elevationUsed: [...elevationUsed].sort(),
    }),
  };
}

export function runTelemetryProbe(theaterId: TheaterId, seed: number, seconds: number): VehicleTelemetrySnapshot {
  const probe = makeAirProbe(theaterId, seed, 'strike');
  runScenario(probe.world, seconds);
  return vehicleTelemetrySnapshot(probe.world.vehicleTelemetry);
}

export function boxedVehicleProbe(): { world: World; vehicle: Vehicle; soldier: Soldier } {
  const world = new World({ seed: 31337, mode: 'tdm', botsPerTeam: 0, map: generateTheater('city', 31337) });
  const route = world.map.theater!.routes.find((candidate) => candidate.domain === 'ground')!;
  const soldier = world.addSoldier('BOXED-DRIVER', 'infantry', 0, 'bot');
  const vehicle = world.spawnVehicle('tank', 0, route.points[0]);
  vehicle.seats[0] = soldier.id;
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = route.id;
  const [cx, cz] = worldToTile(world.map.geometry, vehicle.pos.x, vehicle.pos.z);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== 1) continue;
    world.map.grid[tileIndex(world.map.geometry, cx + dx, cz + dz)] = T_WALL;
  }
  return { world, vehicle, soldier };
}

export function runDuel(attackerKind: VehicleKind, victimKind: VehicleKind, seed: number): VehicleTelemetrySnapshot {
  const map = createTheaterBase(THEATER_DEFS.countryside, seed);
  map.theater = undefined;
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map });
  const left = world.addSoldier('DUEL-A', 'infantry', 0, 'human');
  const right = world.addSoldier('DUEL-B', 'infantry', 1, 'human');
  const attacker = world.spawnVehicle(attackerKind, 0, { x: -18, y: 0, z: 0 });
  const victim = world.spawnVehicle(victimKind, 1, { x: 18, y: 0, z: 0 });
  attacker.seats[0] = left.id; left.vehicleId = attacker.id; left.seat = 0; left.enteredVehicleAt = -10;
  victim.seats[0] = right.id; right.vehicleId = victim.id; right.seat = 0; right.enteredVehicleAt = -10;
  attacker.turretYaw = 0;
  victim.turretYaw = Math.PI;
  const command = (aimYaw: number): PlayerCmd => ({
    moveX: 0, moveZ: 0, aimYaw, fire: true, altFire: false, jump: false,
    use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
  });
  const dt = 1 / 30;
  for (let step = 0; step < 90 / dt && attacker.alive && victim.alive; step++) {
    world.step(dt, new Map([[left.id, command(0)], [right.id, command(Math.PI)]]));
  }
  return vehicleTelemetrySnapshot(world.vehicleTelemetry);
}

export type VehicleScenarioKind = 'route' | 'fixed_wing' | 'ground_duel' | 'naval' | 'combined_arms';

export interface VehicleScenario {
  id: string;
  kind: VehicleScenarioKind;
  theater: TheaterId;
  seed: number;
  duration: number;
  attacker: VehicleKind;
  defender: VehicleKind;
  domain: 'ground' | 'surface' | 'air';
  mirror?: boolean;
}

export interface VehicleScenarioResult {
  id: string;
  kind: VehicleScenarioKind;
  theater: TheaterId;
  seed: number;
  mirror: boolean;
  manifests: [VehicleKind[], VehicleKind[]];
  duration: number;
  winner: -1 | 0 | 1;
  firstContact: number | null;
  objectiveComplete: boolean;
  telemetry: VehicleTelemetrySnapshot['summary'];
  structuralViolations: string[];
  routeFailure: string | null;
  timingSamples: { steps: number; simulatedSeconds: number };
}

function crewVehicle(world: World, kind: VehicleKind, team: 0 | 1, pos: { x: number; y: number; z: number }, routeId: string, profile: NonNullable<Soldier['botAirProfile']> = 'patrol') {
  const soldier = world.addSoldier(`SCENARIO-${team}-${kind}`, 'infantry', team, 'bot');
  const vehicle = world.spawnVehicle(kind, team, pos);
  vehicle.seats[0] = soldier.id;
  vehicle.spoolUntil = 0;
  if (VEHICLES[kind].flies) vehicle.band = maxElevationFor(VEHICLES[kind]);
  soldier.vehicleId = vehicle.id;
  soldier.seat = 0;
  soldier.enteredVehicleAt = -10;
  soldier.botVehicleRouteId = routeId;
  soldier.botAirProfile = profile;
  return { soldier, vehicle };
}

export function runVehicleScenario(scenario: VehicleScenario): VehicleScenarioResult {
  const map = generateTheater(scenario.theater, scenario.seed);
  const structuralViolations = validateTheater(map).issues;
  const route = map.theater?.routes.filter((candidate) => candidate.domain === scenario.domain).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) {
    return {
      id: scenario.id, kind: scenario.kind, theater: scenario.theater, seed: scenario.seed,
      mirror: scenario.mirror === true,
      manifests: [[scenario.attacker], [scenario.defender]], duration: 0, winner: -1,
      firstContact: null, objectiveComplete: false, telemetry: vehicleTelemetrySnapshot(createVehicleTelemetry()).summary,
      structuralViolations, routeFailure: `missing ${scenario.domain} route`, timingSamples: { steps: 0, simulatedSeconds: 0 },
    };
  }
  const world = new World({ seed: scenario.seed, mode: 'tdm', botsPerTeam: 0, map });
  world.vehicles.clear();
  const leftKind = scenario.mirror ? scenario.defender : scenario.attacker;
  const rightKind = scenario.mirror ? scenario.attacker : scenario.defender;
  const left = crewVehicle(world, leftKind, 0, route.points[0], route.id, scenario.kind === 'fixed_wing' ? 'strike' : 'patrol');
  const right = crewVehicle(world, rightKind, 1, route.points.at(-1)!, route.id, scenario.kind === 'fixed_wing' ? 'strike' : 'patrol');
  const hz = 20;
  runScenario(world, scenario.duration, hz);
  const leftScore = left.vehicle.alive ? left.vehicle.hp / left.vehicle.maxHp : 0;
  const rightScore = right.vehicle.alive ? right.vehicle.hp / right.vehicle.maxHp : 0;
  const winner: -1 | 0 | 1 = Math.abs(leftScore - rightScore) < 0.01 ? -1 : leftScore > rightScore ? 0 : 1;
  const telemetry = vehicleTelemetrySnapshot(world.vehicleTelemetry);
  const completed = left.soldier.botVehicleRouteCompleted === true || right.soldier.botVehicleRouteCompleted === true;
  return {
    id: scenario.id, kind: scenario.kind, theater: scenario.theater, seed: scenario.seed,
    mirror: scenario.mirror === true,
    manifests: [[leftKind], [rightKind]], duration: scenario.duration, winner,
    firstContact: telemetry.summary.firstContact ?? null,
    objectiveComplete: completed, telemetry: telemetry.summary, structuralViolations,
    routeFailure: completed ? null : `route ${route.id} incomplete`,
    timingSamples: { steps: Math.ceil(scenario.duration * hz), simulatedSeconds: scenario.duration },
  };
}

export interface FoundationMatrixReport {
  generatedAt: string;
  seeds: number[];
  scenarios: VehicleScenarioResult[];
}

export interface FoundationMatrixVerdict {
  structuralFailures: string[];
  routeFailures: string[];
  contactFailures: string[];
  fixedWingFirstContact: { min: number; max: number };
  groundNavalFirstContact: { min: number; max: number };
  maxMirroredWinRate: number;
}

export function runFoundationMatrix({ seeds }: { seeds: number[] }): FoundationMatrixReport {
  const scenarios: VehicleScenarioResult[] = [];
  const theaters = ['city', 'desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const;
  for (const seed of seeds) {
    for (const theater of theaters) {
      const probe = makeRouteProbe(theater, seed);
      runScenario(probe.world, 180);
      const result = probe.result();
      scenarios.push({
        id: `route:${theater}:${seed}`, kind: 'route', theater, seed,
        mirror: false,
        manifests: [[probe.vehicle.kind], []], duration: 180, winner: -1, firstContact: null,
        objectiveComplete: result.routeCompleted, telemetry: vehicleTelemetrySnapshot(probe.world.vehicleTelemetry).summary,
        structuralViolations: validateTheater(probe.world.map).issues,
        routeFailure: result.routeCompleted && result.persistentStalls === 0 && result.nonFinite === 0 ? null : `complete=${result.routeCompleted} stalls=${result.persistentStalls} nonFinite=${result.nonFinite}`,
        timingSamples: { steps: 3600, simulatedSeconds: 180 },
      });
    }
    for (const theater of ['desert', 'countryside', 'mountain', 'coastal', 'ocean'] as const) {
      scenarios.push(runVehicleScenario({ id: `air:${theater}:${seed}`, kind: 'fixed_wing', theater, seed, duration: 55, attacker: 'interceptor', defender: 'strikejet', domain: 'air' }));
    }
    for (const theater of ['city', 'desert', 'countryside', 'mountain'] as const) {
      scenarios.push(runVehicleScenario({ id: `armor:${theater}:${seed}:a`, kind: 'ground_duel', theater, seed, duration: 120, attacker: 'tank', defender: 'tank', domain: 'ground' }));
      scenarios.push(runVehicleScenario({ id: `armor:${theater}:${seed}:b`, kind: 'ground_duel', theater, seed, duration: 120, attacker: 'tank', defender: 'tank', domain: 'ground', mirror: true }));
    }
    for (const theater of ['coastal', 'ocean'] as const) {
      scenarios.push(runVehicleScenario({ id: `naval:${theater}:${seed}`, kind: 'naval', theater, seed, duration: 120, attacker: 'boat', defender: 'boat', domain: 'surface' }));
    }
  }
  return { generatedAt: 'deterministic', seeds: [...seeds], scenarios };
}

function range(values: number[]): { min: number; max: number } {
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: NaN, max: NaN };
}

export function evaluateFoundationMatrix(report: FoundationMatrixReport): FoundationMatrixVerdict {
  const structuralFailures = report.scenarios.flatMap((scenario) => scenario.structuralViolations.map((violation) => `${scenario.id}: ${violation}`));
  const routeFailures = report.scenarios.filter((scenario) => scenario.kind === 'route' && scenario.routeFailure).map((scenario) => `${scenario.id}: ${scenario.routeFailure}`);
  const contactFailures = report.scenarios
    .filter((scenario) => scenario.kind !== 'route' && scenario.firstContact === null)
    .map((scenario) => `${scenario.id}: no contact`);
  const fixedWing = report.scenarios.filter((scenario) => scenario.kind === 'fixed_wing').flatMap((scenario) => scenario.firstContact === null ? [] : [scenario.firstContact]);
  const groundNaval = report.scenarios.filter((scenario) => scenario.kind === 'ground_duel' || scenario.kind === 'naval').flatMap((scenario) => scenario.firstContact === null ? [] : [scenario.firstContact]);
  const mirrored = report.scenarios.filter((scenario) => scenario.mirror);
  const decisive = mirrored.filter((scenario) => scenario.winner !== -1);
  const sideZeroWins = decisive.filter((scenario) => scenario.winner === 0).length;
  const maxMirroredWinRate = decisive.length
    ? Math.max(sideZeroWins, decisive.length - sideZeroWins) / decisive.length
    : 0.5;
  return { structuralFailures, routeFailures, contactFailures, fixedWingFirstContact: range(fixedWing), groundNavalFirstContact: range(groundNaval), maxMirroredWinRate };
}

export interface RotorcraftInsertionResult {
  landed: boolean;
  nonFinite: number;
  persistentStalls: number;
  crashes: number;
  telemetry: VehicleTelemetrySnapshot;
}

export function runRotorcraftInsertion(theaterId: Exclude<TheaterId, 'ocean'>, seed: number, seconds: number): RotorcraftInsertionResult {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  world.vehicles.clear();
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === 'air').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no insertion air route`);
  const { soldier, vehicle } = crewVehicle(world, 'transportheli', 0, route.points[0], route.id, 'insertion');
  let nonFinite = 0;
  observe(world, () => {
    if (![vehicle.pos.x, vehicle.pos.y, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z].every(Number.isFinite)) nonFinite++;
  });
  runScenario(world, seconds);
  const telemetry = vehicleTelemetrySnapshot(world.vehicleTelemetry);
  return {
    landed: telemetry.incidents.some((incident) => incident.kind === 'landing' && incident.vehicleId === vehicle.id),
    nonFinite,
    persistentStalls: soldier.botVehiclePersistentStalls ?? 0,
    crashes: telemetry.incidents.filter((incident) => incident.kind === 'crash' && incident.vehicleId === vehicle.id).length,
    telemetry,
  };
}

export interface RotorcraftSupportResult {
  firstContact: number | null;
  shots: number;
  hits: number;
  targetHp: number;
  targetMaxHp: number;
  telemetry: VehicleTelemetrySnapshot;
}

export function runRotorcraftSupport(theaterId: Exclude<TheaterId, 'ocean'>, seed: number, seconds: number): RotorcraftSupportResult {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, seed) });
  world.vehicles.clear();
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === 'air').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theaterId} has no support air route`);
  crewVehicle(world, 'attackheli', 0, route.points[0], route.id, 'support');
  const targetCrew = world.addSoldier('SUPPORT-TARGET', 'infantry', 1, 'human');
  const target = world.spawnVehicle('tank', 1, route.points[Math.min(1, route.points.length - 1)]);
  target.seats[0] = targetCrew.id;
  targetCrew.vehicleId = target.id;
  targetCrew.seat = 0;
  targetCrew.enteredVehicleAt = -10;
  let minimumTargetHp = target.hp;
  observe(world, () => { minimumTargetHp = Math.min(minimumTargetHp, target.hp); });
  runScenario(world, seconds);
  const telemetry = vehicleTelemetrySnapshot(world.vehicleTelemetry);
  return {
    firstContact: telemetry.summary.firstContact ?? null,
    shots: telemetry.summary.shotsByKind.attackheli ?? 0,
    hits: telemetry.summary.hitsByKind.attackheli ?? 0,
    targetHp: minimumTargetHp,
    targetMaxHp: target.maxHp,
    telemetry,
  };
}

export interface RotorcraftMatrixReport {
  generatedAt: string;
  seeds: number[];
  insertions: Array<{
    id: string; theater: Exclude<TheaterId, 'ocean'>; seed: number;
    landed: boolean; nonFinite: number; persistentStalls: number; crashes: number;
    distance: number; objectiveProgress: number; radarSweeps: number; radarContacts: number; radarJammed: number;
  }>;
  support: Array<{
    id: string; theater: Exclude<TheaterId, 'ocean'>; seed: number;
    firstContact: number | null; shots: number; hits: number; targetHp: number; targetMaxHp: number;
    radarSweeps: number; radarContacts: number; radarJammed: number;
  }>;
}

export interface RotorcraftMatrixVerdict {
  insertionFailures: string[];
  supportFailures: string[];
}

export function runRotorcraftMatrix({ seeds }: { seeds: number[] }): RotorcraftMatrixReport {
  const theaters = ['city', 'desert', 'countryside', 'mountain', 'coastal'] as const;
  const insertions: RotorcraftMatrixReport['insertions'] = [];
  const support: RotorcraftMatrixReport['support'] = [];
  for (const seed of seeds) for (const theater of theaters) {
    const insertion = runRotorcraftInsertion(theater, seed, 180);
    insertions.push({
      id: `rotor-insertion:${theater}:${seed}`, theater, seed,
      landed: insertion.landed, nonFinite: insertion.nonFinite,
      persistentStalls: insertion.persistentStalls, crashes: insertion.crashes,
      distance: insertion.telemetry.summary.distanceByKind.transportheli ?? 0,
      objectiveProgress: insertion.telemetry.summary.objectiveProgress,
      radarSweeps: insertion.telemetry.summary.radarSweeps,
      radarContacts: insertion.telemetry.summary.radarContacts,
      radarJammed: insertion.telemetry.summary.radarJammed,
    });
    const strike = runRotorcraftSupport(theater, seed, 120);
    support.push({
      id: `rotor-support:${theater}:${seed}`, theater, seed,
      firstContact: strike.firstContact, shots: strike.shots, hits: strike.hits,
      targetHp: +strike.targetHp.toFixed(3), targetMaxHp: strike.targetMaxHp,
      radarSweeps: strike.telemetry.summary.radarSweeps,
      radarContacts: strike.telemetry.summary.radarContacts,
      radarJammed: strike.telemetry.summary.radarJammed,
    });
  }
  return { generatedAt: 'deterministic', seeds: [...seeds], insertions, support };
}

export function evaluateRotorcraftMatrix(report: RotorcraftMatrixReport): RotorcraftMatrixVerdict {
  const insertionFailures = report.insertions.flatMap((row) => {
    const failures = [
      ...(!row.landed ? ['did not land'] : []),
      ...(row.nonFinite > 0 ? [`${row.nonFinite} non-finite samples`] : []),
      ...(row.persistentStalls > 0 ? [`${row.persistentStalls} persistent stalls`] : []),
      ...(row.crashes > 0 ? [`${row.crashes} crashes`] : []),
      ...(row.distance <= 0 ? ['did not move'] : []),
      ...(row.objectiveProgress <= 0 ? ['did not record objective progress'] : []),
    ];
    return failures.map((failure) => `${row.id}: ${failure}`);
  });
  const supportFailures = report.support.flatMap((row) => {
    const failures = [
      ...(row.firstContact === null ? ['no contact'] : []),
      ...(row.shots <= 0 ? ['no shots'] : []),
      ...(row.hits <= 0 ? ['no hits'] : []),
      ...(row.targetHp >= row.targetMaxHp ? ['target undamaged'] : []),
    ];
    return failures.map((failure) => `${row.id}: ${failure}`);
  });
  return { insertionFailures, supportFailures };
}

export interface SubmarineBattleResult {
  theater: 'coastal' | 'ocean';
  seed: number;
  dives: number;
  firstContact: number | null;
  shots: number;
  hits: number;
  damage: number;
  nonFinite: number;
  wrongDepth: number;
  routeCompletions: number;
  radarSweeps: number;
  radarContacts: number;
  radarJammed: number;
}

export function runSubmarineBattle(theater: 'coastal' | 'ocean', seed: number, seconds: number): SubmarineBattleResult {
  const world = new World({ seed, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theater, seed) });
  world.vehicles.clear();
  const route = world.map.theater!.routes.filter((candidate) => candidate.domain === 'deep').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!route) throw new Error(`${theater} has no deep route`);
  const left = crewVehicle(world, 'submarine', 0, route.points[0], route.id);
  const right = crewVehicle(world, 'submarine', 1, route.points.at(-1)!, route.id);
  let nonFinite = 0;
  let leftMinimum = left.vehicle.hp;
  let rightMinimum = right.vehicle.hp;
  observe(world, () => {
    leftMinimum = Math.min(leftMinimum, left.vehicle.hp);
    rightMinimum = Math.min(rightMinimum, right.vehicle.hp);
    if (![left.vehicle, right.vehicle].flatMap((vehicle) => [vehicle.pos.x, vehicle.pos.z, vehicle.vel.x, vehicle.vel.z]).every(Number.isFinite)) nonFinite++;
  });
  runScenario(world, seconds);
  const telemetry = vehicleTelemetrySnapshot(world.vehicleTelemetry);
  return {
    theater, seed,
    dives: telemetry.incidents.filter((incident) => incident.kind === 'dive').length,
    firstContact: telemetry.summary.firstContact ?? null,
    shots: telemetry.summary.shotsByKind.submarine ?? 0,
    hits: telemetry.summary.hitsByKind.submarine ?? 0,
    damage: +(left.vehicle.maxHp - leftMinimum + right.vehicle.maxHp - rightMinimum).toFixed(3),
    nonFinite,
    wrongDepth: telemetry.incidents.filter((incident) => incident.kind === 'wrong_depth').length,
    routeCompletions: telemetry.summary.routeCompletions,
    radarSweeps: telemetry.summary.radarSweeps,
    radarContacts: telemetry.summary.radarContacts,
    radarJammed: telemetry.summary.radarJammed,
  };
}

export interface SubmarineMatrixReport {
  generatedAt: string;
  seeds: number[];
  scenarios: SubmarineBattleResult[];
}

export function runSubmarineMatrix({ seeds }: { seeds: number[] }): SubmarineMatrixReport {
  const scenarios: SubmarineBattleResult[] = [];
  for (const seed of seeds) for (const theater of ['coastal', 'ocean'] as const) {
    scenarios.push(runSubmarineBattle(theater, seed, 180));
  }
  return { generatedAt: 'deterministic', seeds: [...seeds], scenarios };
}

export function evaluateSubmarineMatrix(report: SubmarineMatrixReport): { failures: string[] } {
  const failures = report.scenarios.flatMap((row) => {
    const issues = [
      ...(row.dives < 2 ? [`only ${row.dives} dives`] : []),
      ...(row.firstContact === null ? ['no contact'] : []),
      ...(row.shots <= 0 ? ['no torpedoes'] : []),
      ...(row.hits <= 0 ? ['no hits'] : []),
      ...(row.damage <= 0 ? ['no damage'] : []),
      ...(row.nonFinite > 0 ? [`${row.nonFinite} non-finite samples`] : []),
      ...(row.wrongDepth > 0 ? [`${row.wrongDepth} wrong-depth incidents`] : []),
      ...(row.routeCompletions <= 0 ? ['no route completion'] : []),
    ];
    return issues.map((issue) => `submarine:${row.theater}:${row.seed}: ${issue}`);
  });
  return { failures };
}
