import { perceivesNow } from './perception';
import { noteIndoorAlert } from './indoor-ai';
import type { ScienceMapLayout } from './science-map';
import type { ScienceOperationGraph, SciencePatrolRoute } from './science-operation';
import { scienceEncounterBudget, scienceGuardRole, type ScienceEncounterBudget, type ScienceMissionSpec, type ScienceVerb } from './science';
import { worldFloorForHeight } from './map-layers';
import type { Soldier, Vec3 } from './types';
import type { World } from './world';

export type ScienceObjectiveKind = 'eliminate' | 'interact' | 'escort' | 'survive';

export interface ScienceObjective {
  kind: ScienceObjectiveKind;
  label: string;
  pos: Vec3[];
  required: number;
  progress: number;
  complete: boolean;
}

export type ScienceAwareness = 'ghost' | 'searching' | 'alarmed';

export interface SciencePendingReport {
  guardId: number;
  lastKnown: Vec3;
  floor: number;
  completeAt: number;
}

export type ScienceMissionWaypointKind = 'insertion' | 'objective' | 'extraction' | 'report';

export interface ScienceMissionWaypoint {
  id: string;
  kind: ScienceMissionWaypointKind;
  label: string;
  pos: Vec3;
  floor: number;
  active: boolean;
}

export interface ScienceMissionRuntime {
  spec: ScienceMissionSpec;
  phase: 'objective' | 'extract' | 'won' | 'failed';
  objective: ScienceObjective;
  entry: Vec3;
  extraction: Vec3;
  guardPosts: Vec3[];
  civilianSpawns: Vec3[];
  dogPosts: Vec3[];
  reinforcementPosts: Vec3[];
  convoyRoute: Vec3[];
  encounterBudget: ScienceEncounterBudget;
  operationGraph: ScienceOperationGraph;
  patrolRoutes: SciencePatrolRoute[];
  reportNodes: Vec3[];
  missionWaypoints: ScienceMissionWaypoint[];
  clonesRemaining: number;
  clonesSpent: number;
  detections: number;
  alarm: boolean;
  awareness: ScienceAwareness;
  pendingReport?: SciencePendingReport;
  lastReported?: Vec3;
  civilianIds: number[];
  targetIds: number[];
  guardIds: number[];
  dogIds: number[];
  vehicleTargetIds: number[];
  interacted: Set<number>;
  reinforcementAt: number;
  reinforcementsDeployed: boolean;
  convoyWaypoint: number;
  applied: boolean;
}

const PRIMITIVE: Record<ScienceVerb, ScienceObjectiveKind> = {
  assassinate: 'eliminate',
  steal: 'interact',
  raid: 'interact',
  deny: 'interact',
  rescue: 'escort',
  infiltrate: 'interact',
  ambush: 'eliminate',
  hold: 'survive',
  hunt: 'eliminate',
  decapitate: 'eliminate',
};

const LABEL: Record<ScienceVerb, string> = {
  assassinate: 'Eliminate the program director',
  steal: 'Secure the program core',
  raid: 'Raid the clone stores',
  deny: 'Arm the denial charges',
  rescue: 'Escort the researchers to extraction',
  infiltrate: 'Ghost the research terminal',
  ambush: 'Destroy the convoy detail',
  hold: 'Hold the science uplink',
  hunt: 'Hunt the loose asset',
  decapitate: 'Eliminate the command cell',
};

function requiredFor(verb: ScienceVerb): number {
  if (verb === 'raid' || verb === 'deny' || verb === 'decapitate') return 3;
  if (verb === 'rescue') return 2;
  if (verb === 'hold') return 12;
  if (verb === 'ambush') return 4;
  return 1;
}

export function createScienceRuntime(spec: ScienceMissionSpec, layout: ScienceMapLayout): ScienceMissionRuntime {
  const encounterBudget = scienceEncounterBudget({
    prints: spec.squadSize,
    security: spec.security ?? 0.5,
    verb: spec.verb,
    floors: layout.building.floors,
    complication: spec.complication,
  });
  return {
    spec,
    phase: 'objective',
    objective: {
      kind: PRIMITIVE[spec.verb],
      label: LABEL[spec.verb],
      pos: layout.objectiveSockets.slice(0, 4).map((pos) => ({ ...pos })),
      required: requiredFor(spec.verb),
      progress: 0,
      complete: false,
    },
    entry: { ...layout.entry },
    extraction: { ...layout.extraction },
    guardPosts: layout.guardPosts.slice(0, encounterBudget.initialGuards).map((pos) => ({ ...pos })),
    civilianSpawns: layout.civilianSpawns.slice(0, encounterBudget.initialCivilians).map((pos) => ({ ...pos })),
    dogPosts: layout.dogPosts.slice(0, encounterBudget.dogTeams).map((pos) => ({ ...pos })),
    reinforcementPosts: layout.reinforcementPosts.map((pos) => ({ ...pos })),
    convoyRoute: layout.convoyRoute.map((pos) => ({ ...pos })),
    encounterBudget,
    operationGraph: layout.operationGraph,
    patrolRoutes: layout.operationGraph.patrolRoutes.slice(0, encounterBudget.initialGuards).map((route) => ({
      ...route,
      points: route.points.map((pos) => ({ ...pos })),
      roomIds: [...route.roomIds],
    })),
    reportNodes: layout.operationGraph.reportNodes.map((node) => ({ ...node.pos })),
    missionWaypoints: [
      { id: 'insertion', kind: 'insertion', label: 'INSERTION', pos: { ...layout.entry }, floor: worldFloorForHeight(layout.entry.y), active: true },
      ...layout.objectiveSockets.slice(0, 4).map((pos, index) => ({
        id: `objective-${index + 1}`, kind: 'objective' as const, label: index === 0 ? 'OBJECTIVE' : `OBJECTIVE ${index + 1}`,
        pos: { ...pos }, floor: worldFloorForHeight(pos.y), active: true,
      })),
      ...layout.operationGraph.reportNodes.map((node, index) => ({
        id: `report-${index + 1}`, kind: 'report' as const, label: 'REPORT', pos: { ...node.pos }, floor: node.floor, active: false,
      })),
      { id: 'extraction', kind: 'extraction', label: 'EXTRACTION', pos: { ...layout.extraction }, floor: worldFloorForHeight(layout.extraction.y), active: false },
    ],
    clonesRemaining: spec.squadSize,
    clonesSpent: 0,
    detections: 0,
    alarm: false,
    awareness: 'ghost',
    civilianIds: [],
    targetIds: [],
    guardIds: [],
    dogIds: [],
    vehicleTargetIds: [],
    interacted: new Set(),
    reinforcementAt: Infinity,
    reinforcementsDeployed: false,
    convoyWaypoint: 2,
    applied: false,
  };
}

function hostileTargetCount(verb: ScienceVerb): number {
  if (verb === 'decapitate' || verb === 'ambush') return 3;
  if (verb === 'assassinate' || verb === 'hunt') return 1;
  return 0;
}

function issueScienceGuard(world: World, name: string, index: number, total: number, reserve = false): Soldier {
  const role = scienceGuardRole(index, total, reserve);
  const meleeIssue = ['unarmed', 'baseball_bat', 'katana', 'fire_axe'][(total + index) % 4];
  const guard = world.addSoldier(name, 'infantry', 1, 'bot', {
    primary: role === 'smg' ? 'kuchler' : role === 'melee' ? meleeIssue : 'pistol',
    secondary: 'pistol',
    equipment: [],
  });
  guard.grenades = 0;
  guard.smokes = 0;
  guard.firebombs = 0;
  guard.concs = 0;
  guard.gravs = 0;
  guard.plasmas = 0;
  guard.timebombs = 0;
  return guard;
}

/** Deal actors onto authored sockets; every combatant still uses stock brains and weapons. */
export function populateScienceMission(world: World, layout: ScienceMapLayout): void {
  const runtime = world.science;
  if (!runtime) return;
  const targetCount = hostileTargetCount(runtime.spec.verb);
  for (let i = 0; i < runtime.guardPosts.length; i++) {
    const namedTarget = i >= runtime.guardPosts.length - targetCount;
    const name = runtime.spec.verb === 'decapitate' && namedTarget
      ? `Program Officer ${targetCount - (runtime.guardPosts.length - 1 - i)}`
      : runtime.spec.verb === 'assassinate' && namedTarget
        ? 'Director Silex'
        : runtime.spec.verb === 'hunt' && namedTarget
          ? 'Asset Kestrel'
          : runtime.spec.verb === 'ambush' && namedTarget
            ? `Convoy Guard ${targetCount - (runtime.guardPosts.length - 1 - i)}`
            : `Security ${i + 1}`;
    const guard = issueScienceGuard(world, name, i, runtime.guardPosts.length);
    guard.pos = { ...runtime.guardPosts[i] };
    guard.floor = worldFloorForHeight(guard.pos.y);
    guard.yaw = Math.PI;
    runtime.guardIds.push(guard.id);
    if (namedTarget) runtime.targetIds.push(guard.id);
  }

  for (let i = 0; i < runtime.encounterBudget.dogTeams; i++) {
    const handler = world.soldiers.get(runtime.guardIds[i % Math.max(1, runtime.guardIds.length)]);
    if (!handler) break;
    const dog = world.addDog(handler, true);
    dog.pos = { ...(runtime.dogPosts[i] ?? handler.pos) };
    dog.floor = worldFloorForHeight(dog.pos.y);
    runtime.dogIds.push(dog.id);
  }

  if (runtime.spec.verb === 'rescue') {
    for (let i = 0; i < runtime.civilianSpawns.length; i++) {
      const scientist = world.addScientist(runtime.civilianSpawns[i]);
      scientist.floor = worldFloorForHeight(scientist.pos.y);
      scientist.name = ['Dr. Okafor', 'Dr. Chen', 'Dr. Reyes', 'Dr. Marin'][i] ?? `Dr. ${i + 1}`;
      runtime.civilianIds.push(scientist.id);
    }
    runtime.targetIds = runtime.civilianIds.slice(0, 2);
  }

  if (runtime.spec.verb === 'ambush') {
    const transport = world.spawnVehicle('transport', 1, runtime.convoyRoute[1]);
    runtime.vehicleTargetIds.push(transport.id);
  }
  if (runtime.spec.complication === 'alarm-net') {
    runtime.alarm = true;
    runtime.awareness = 'alarmed';
    runtime.detections = 1;
    runtime.reinforcementAt = world.time + 4;
    world.emit({ type: 'announce', text: 'ALARM NET LIVE — SECURITY IS MOBILIZING', big: true });
  }
  if (runtime.spec.complication === 'storm') {
    world.weather = { kind: 'storm', intensity: 0.85, until: Infinity };
  }
  if (runtime.spec.complication === 'god-on-guard') {
    const god = world.addLsw('plaguebearer', 1, runtime.guardPosts[runtime.guardPosts.length - 1]);
    if (god) runtime.guardIds.push(god.id);
  }
  if (runtime.spec.site === 'quarantine-zone' || runtime.spec.complication === 'third-party') {
    const thirdPartySpawns = layout.map.zombieSpawns.length ? layout.map.zombieSpawns : runtime.convoyRoute;
    for (const pos of thirdPartySpawns.slice(0, 3)) world.addZombie('zombie', pos);
  }
}

function finishPrimary(world: World): void {
  const runtime = world.science;
  if (!runtime || runtime.objective.complete) return;
  runtime.objective.complete = true;
  runtime.objective.progress = runtime.objective.required;
  runtime.phase = 'extract';
  setMissionWaypointKind(runtime, 'objective', false);
  setMissionWaypointKind(runtime, 'report', false);
  setMissionWaypointKind(runtime, 'extraction', true);
  world.emit({ type: 'announce', text: 'PRIMARY COMPLETE — RETURN TO THE FIELD PRINTER', big: true });
}

function setMissionWaypointKind(runtime: ScienceMissionRuntime, kind: ScienceMissionWaypointKind, active: boolean): void {
  for (const waypoint of runtime.missionWaypoints) {
    if (waypoint.kind === kind) waypoint.active = active;
  }
}

function activateNearestReportWaypoint(runtime: ScienceMissionRuntime, origin: Vec3): void {
  let nearest: ScienceMissionWaypoint | undefined;
  let nearestDistance = Infinity;
  for (const waypoint of runtime.missionWaypoints) {
    if (waypoint.kind !== 'report') continue;
    waypoint.active = false;
    const distance = Math.hypot(waypoint.pos.x - origin.x, waypoint.pos.z - origin.z)
      + Math.abs(waypoint.pos.y - origin.y) * 2;
    if (distance < nearestDistance) {
      nearest = waypoint;
      nearestDistance = distance;
    }
  }
  if (nearest) nearest.active = true;
}

function failScience(world: World, text: string): void {
  const runtime = world.science;
  if (!runtime || runtime.phase === 'failed' || runtime.phase === 'won') return;
  runtime.phase = 'failed';
  world.mode.over = true;
  world.mode.winner = 1;
  world.emit({ type: 'announce', text, big: true });
  world.emit({ type: 'match_over', team: 1, text: 'OPERATION FAILED', big: true });
}

function winScience(world: World): void {
  const runtime = world.science;
  if (!runtime || runtime.phase !== 'extract') return;
  runtime.phase = 'won';
  world.mode.over = true;
  world.mode.winner = 0;
  world.emit({ type: 'announce', text: runtime.alarm ? 'SCIENCE PACKAGE EXTRACTED' : 'GHOST EXTRACTION — NO ALARM', big: true });
  world.emit({ type: 'match_over', team: 0, text: 'OPERATION COMPLETE', big: true });
}

function near(a: Vec3, b: Vec3, radius = 3.2): boolean {
  return Math.abs(a.y - b.y) <= 1.8 && Math.hypot(a.x - b.x, a.z - b.z) <= radius;
}

/** E-action for terminals, stores, charges, and scientist escort attachment. */
export function tryScienceInteraction(world: World, operator: Soldier, dt: number): boolean {
  const runtime = world.science;
  if (!runtime || runtime.phase !== 'objective' || !operator.alive || operator.team !== 0) return false;
  const objective = runtime.objective;
  if (objective.kind === 'escort') {
    const scientist = runtime.targetIds
      .map((id) => world.soldiers.get(id))
      .find((candidate) => candidate?.alive && near(operator.pos, candidate.pos));
    if (!scientist) return false;
    scientist.botTargetId = operator.id;
    world.emit({ type: 'announce', text: `${scientist.name.toUpperCase()} ATTACHED`, big: false });
    return true;
  }
  if (objective.kind !== 'interact') return false;
  const socket = objective.pos.findIndex((pos, index) => !runtime.interacted.has(index) && near(operator.pos, pos));
  if (socket < 0) return false;
  runtime.interacted.add(socket);
  objective.progress = Math.min(objective.required, objective.progress + Math.max(1, dt));
  world.emit({ type: 'announce', text: `${objective.label.toUpperCase()} ${Math.floor(objective.progress)}/${objective.required}`, big: false });
  if (objective.progress >= objective.required) finishPrimary(world);
  return true;
}

/** Per-tick mission state: alarm, objective primitives, and extraction. */
export function stepScienceMission(world: World, dt: number): void {
  const runtime = world.science;
  if (!runtime || runtime.phase === 'won' || runtime.phase === 'failed') return;
  const operators = [...world.soldiers.values()].filter((soldier) =>
    soldier.alive && soldier.team === 0 && (soldier.kind === 'human' || soldier.kind === 'bot'));

  if (runtime.pendingReport) {
    const report = runtime.pendingReport;
    const reporter = world.soldiers.get(report.guardId);
    if (!reporter?.alive) {
      runtime.pendingReport = undefined;
      runtime.awareness = runtime.alarm ? 'alarmed' : 'ghost';
      setMissionWaypointKind(runtime, 'report', false);
    } else if (world.time >= report.completeAt) {
      runtime.lastReported = { ...report.lastKnown };
      runtime.pendingReport = undefined;
      runtime.alarm = true;
      runtime.awareness = 'alarmed';
      setMissionWaypointKind(runtime, 'report', false);
      runtime.reinforcementAt = world.time + 4;
      noteIndoorAlert(world.indoorTactics, report.lastKnown, report.floor, world.time);
      world.emit({ type: 'announce', text: 'ALARM — SECURITY IS MOBILIZING', big: true });
    }
  }

  if (!runtime.alarm && !runtime.pendingReport) {
    let witness: { guard: Soldier; operator: Soldier } | undefined;
    for (const id of runtime.guardIds) {
      const guard = world.soldiers.get(id);
      if (!guard?.alive) continue;
      const operator = operators.find((candidate) => perceivesNow(world.map.grid, [guard], world.pinged,
        candidate, 32, world.smokeBlobs, undefined, world.map.grid2, world.map.upperLayers));
      if (operator) { witness = { guard, operator }; break; }
    }
    if (witness) {
      runtime.detections++;
      runtime.awareness = 'searching';
      runtime.pendingReport = {
        guardId: witness.guard.id,
        lastKnown: { ...witness.operator.pos, y: witness.operator.floor * 4 },
        floor: witness.operator.floor,
        completeAt: world.time + 1.5,
      };
      activateNearestReportWaypoint(runtime, witness.guard.pos);
      world.emit({ type: 'announce', text: 'SECURITY REPORTING — STOP THE CALL', big: false });
    }
  }

  if (runtime.alarm && !runtime.reinforcementsDeployed && world.time >= runtime.reinforcementAt) {
    runtime.reinforcementsDeployed = true;
    for (let i = 0; i < runtime.encounterBudget.reserveGuards; i++) {
      const guard = issueScienceGuard(world, `Response ${i + 1}`, i, runtime.encounterBudget.reserveGuards, true);
      guard.pos = { ...(runtime.reinforcementPosts[i % runtime.reinforcementPosts.length]
        ?? runtime.guardPosts[i % runtime.guardPosts.length]) };
      guard.floor = worldFloorForHeight(guard.pos.y);
      guard.yaw = Math.PI;
      runtime.guardIds.push(guard.id);
    }
    world.emit({ type: 'announce', text: 'RESPONSE TEAM ENTERING THE SITE', big: false });
  }

  if (runtime.spec.verb === 'ambush') {
    const target = runtime.convoyRoute[runtime.convoyWaypoint];
    for (const id of runtime.vehicleTargetIds) {
      const vehicle = world.vehicles.get(id);
      if (!vehicle?.alive || !target) continue;
      const dx = target.x - vehicle.pos.x;
      const dz = target.z - vehicle.pos.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= 1) {
        failScience(world, 'CONVOY ESCAPED — OPERATION FAILED');
        return;
      }
      const travel = Math.min(distance, dt * 3.5);
      vehicle.yaw = Math.atan2(dz, dx);
      vehicle.pos.x += dx / distance * travel;
      vehicle.pos.z += dz / distance * travel;
    }
  }

  if (runtime.phase === 'objective') {
    const objective = runtime.objective;
    if (objective.kind === 'eliminate') {
      const dead = runtime.targetIds.filter((id) => !world.soldiers.get(id)?.alive).length
        + runtime.vehicleTargetIds.filter((id) => !world.vehicles.get(id)?.alive).length;
      objective.progress = dead;
      if (runtime.targetIds.length > 0 && dead >= objective.required) finishPrimary(world);
    } else if (objective.kind === 'escort') {
      const targets = runtime.targetIds.map((id) => world.soldiers.get(id));
      if (targets.some((target) => !target?.alive)) {
        failScience(world, 'RESEARCHER LOST — OPERATION FAILED');
        return;
      }
      objective.progress = targets.filter((target) => target?.botTargetId !== undefined && target.botTargetId >= 0).length;
      if (targets.length >= objective.required && targets.every((target) => target && near(target.pos, runtime.extraction, 4))) finishPrimary(world);
    } else if (objective.kind === 'survive') {
      if (operators.some((operator) => near(operator.pos, objective.pos[0], 4.5))) {
        objective.progress = Math.min(objective.required, objective.progress + dt);
        if (objective.progress >= objective.required) finishPrimary(world);
      }
    }

  } else if (runtime.phase === 'extract' && operators.some((operator) => near(operator.pos, runtime.extraction, 4))) {
    winScience(world);
  }
}

/** Called once from the authoritative lethal branch. Returns true if handled. */
export function onScienceDeath(world: World, victim: Soldier, attackerId = -1): boolean {
  const runtime = world.science;
  const attacker = world.soldiers.get(attackerId);
  const isRequiredTarget = runtime?.targetIds.includes(victim.id) ?? false;
  if (runtime?.spec.complication === 'no-kill' && victim.team === 1 && attacker?.team === 0 && !isRequiredTarget) {
    failScience(world, 'NO-KILL CLAUSE BROKEN — OPERATION FAILED');
  }
  if (!runtime || victim.team !== 0 || victim.kind !== 'human' || runtime.phase === 'won' || runtime.phase === 'failed') return false;
  runtime.clonesRemaining = Math.max(0, runtime.clonesRemaining - 1);
  runtime.clonesSpent++;
  if (runtime.clonesRemaining <= 0) {
    victim.respawnAt = Infinity;
    failScience(world, 'CLONE STOCK DRY — OPERATION FAILED');
  } else {
    victim.respawnAt = world.time + 0.25;
    world.emit({ type: 'announce', text: `REPRINTING — ${runtime.clonesRemaining} CLONES REMAIN`, big: false });
  }
  return true;
}

export function scienceObjectiveText(runtime: ScienceMissionRuntime): string {
  if (runtime.phase === 'extract') return 'Return to the field printer for extraction';
  if (runtime.phase === 'won') return 'Operation complete';
  if (runtime.phase === 'failed') return 'Operation failed';
  const objective = runtime.objective;
  const progress = objective.kind === 'survive'
    ? `${Math.floor(objective.progress)}s / ${objective.required}s`
    : `${Math.floor(objective.progress)} / ${objective.required}`;
  return `${objective.label} — ${progress}`;
}

export interface ScienceMissionResult {
  id: string;
  won: boolean;
  ghost: boolean;
  clonesSpent: number;
  clonesRemaining: number;
  reward: ScienceMissionSpec['reward'];
}

export function scienceResult(runtime: ScienceMissionRuntime): ScienceMissionResult {
  return {
    id: runtime.spec.id,
    won: runtime.phase === 'won',
    ghost: runtime.phase === 'won' && runtime.detections === 0,
    clonesSpent: runtime.clonesSpent,
    clonesRemaining: runtime.clonesRemaining,
    reward: runtime.spec.reward,
  };
}
