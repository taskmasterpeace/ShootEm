import { perceivesNow } from './perception';
import type { ScienceMapLayout } from './science-map';
import type { ScienceMissionSpec, ScienceVerb } from './science';
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

export interface ScienceMissionRuntime {
  spec: ScienceMissionSpec;
  phase: 'objective' | 'extract' | 'won' | 'failed';
  objective: ScienceObjective;
  entry: Vec3;
  extraction: Vec3;
  guardPosts: Vec3[];
  civilianSpawns: Vec3[];
  convoyRoute: Vec3[];
  clonesRemaining: number;
  clonesSpent: number;
  detections: number;
  alarm: boolean;
  civilianIds: number[];
  targetIds: number[];
  guardIds: number[];
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
    guardPosts: layout.guardPosts.map((pos) => ({ ...pos })),
    civilianSpawns: layout.civilianSpawns.map((pos) => ({ ...pos })),
    convoyRoute: layout.convoyRoute.map((pos) => ({ ...pos })),
    clonesRemaining: spec.squadSize,
    clonesSpent: 0,
    detections: 0,
    alarm: false,
    civilianIds: [],
    targetIds: [],
    guardIds: [],
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
    const guard = world.addSoldier(name, i % 4 === 0 ? 'heavy' : 'infantry', 1, 'bot');
    guard.pos = { ...runtime.guardPosts[i] };
    guard.floor = guard.pos.y >= 4 ? 1 : 0;
    guard.yaw = Math.PI;
    runtime.guardIds.push(guard.id);
    if (namedTarget) runtime.targetIds.push(guard.id);
  }

  for (let i = 0; i < runtime.civilianSpawns.length; i++) {
    const scientist = world.addScientist(runtime.civilianSpawns[i]);
    scientist.floor = scientist.pos.y >= 4 ? 1 : 0;
    scientist.name = ['Dr. Okafor', 'Dr. Chen', 'Dr. Reyes', 'Dr. Marin'][i] ?? `Dr. ${i + 1}`;
    runtime.civilianIds.push(scientist.id);
  }
  if (runtime.spec.verb === 'rescue') runtime.targetIds = runtime.civilianIds.slice(0, 2);

  if (runtime.spec.verb === 'ambush') {
    const transport = world.spawnVehicle('transport', 1, runtime.convoyRoute[1]);
    runtime.vehicleTargetIds.push(transport.id);
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
  world.emit({ type: 'announce', text: 'PRIMARY COMPLETE — RETURN TO THE FIELD PRINTER', big: true });
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

  if (!runtime.alarm) {
    const detected = runtime.guardIds.some((id) => {
      const guard = world.soldiers.get(id);
      return guard?.alive && operators.some((operator) =>
        perceivesNow(world.map.grid, [guard], world.pinged, operator, 32, world.smokeBlobs, undefined, world.map.grid2));
    });
    if (detected) {
      runtime.alarm = true;
      runtime.detections++;
      runtime.reinforcementAt = world.time + 4;
      world.emit({ type: 'announce', text: 'ALARM — SECURITY IS MOBILIZING', big: true });
    }
  }

  if (runtime.alarm && !runtime.reinforcementsDeployed && world.time >= runtime.reinforcementAt) {
    runtime.reinforcementsDeployed = true;
    for (let i = 0; i < 3; i++) {
      const guard = world.addSoldier(`Response ${i + 1}`, i === 0 ? 'heavy' : 'infantry', 1, 'bot');
      guard.pos = { ...runtime.guardPosts[i % runtime.guardPosts.length] };
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
  if (runtime?.spec.complication === 'no-kill' && victim.team === 1 && attacker?.team === 0) {
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
