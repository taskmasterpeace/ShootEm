import { AIR_KINDS, LAND_KINDS, SEA_KINDS, type OperationDomain, type OperationPlan } from './operations';
import type { VehicleKind } from './types';
import type { World } from './world';

export type OperationFailureReason =
  | 'force_destroyed' | 'reinforcements_arrived' | 'prize_destroyed'
  | 'critical_airframe_lost' | 'time_expired';

export interface OperationResult {
  operationId: string;
  won: boolean;
  reason?: OperationFailureReason;
  completedPhaseIds: string[];
  destroyedHullIds: string[];
  survivingHullIds: string[];
  collateral: number;
  elapsed: number;
  cleanSheet: boolean;
}

export interface OperationObservation {
  friendlyCombatants: number;
  phase: { friendly: number; enemy: number; friendlyDomain: number; targetDestroyed: boolean };
  enemyAliveByDomain: Record<OperationDomain, number>;
  hulls: Array<{ hullId: string; alive: boolean }>;
  collateral: number;
  criticalAirframesAlive: number;
  scorchedTargetDestroyed: boolean;
}

export interface OperationRuntimeEvent {
  type: 'phase' | 'progress' | 'complete';
  operationId: string;
  phaseId?: string;
  label?: string;
  progress?: number;
  result?: OperationResult;
}

export interface OperationRuntimeState {
  plan: OperationPlan;
  currentPhase: number;
  phaseProgress: number;
  completedPhaseIds: string[];
  elapsed: number;
  collateral: number;
  result: OperationResult | null;
  setup: {
    weather?: 'storm';
    deniedSupport?: 'cas';
    defenderLswRequired: boolean;
    criticalAirframeRequired: boolean;
  };
}

export function emptyOperationObservation(): OperationObservation {
  return {
    friendlyCombatants: 1,
    phase: { friendly: 0, enemy: 0, friendlyDomain: 0, targetDestroyed: false },
    enemyAliveByDomain: { land: 1, air: 1, sea: 1 },
    hulls: [],
    collateral: 0,
    criticalAirframesAlive: 0,
    scorchedTargetDestroyed: false,
  };
}

export function createOperationRuntime(plan: OperationPlan): OperationRuntimeState {
  return {
    plan,
    currentPhase: 0,
    phaseProgress: 0,
    completedPhaseIds: [],
    elapsed: 0,
    collateral: 0,
    result: null,
    setup: {
      ...(plan.complication === 'storm' ? { weather: 'storm' as const } : {}),
      ...(plan.complication === 'air_cover_denied' ? { deniedSupport: 'cas' as const } : {}),
      defenderLswRequired: plan.complication === 'god_on_objective',
      criticalAirframeRequired: plan.complication === 'one_airframe',
    },
  };
}

function finish(state: OperationRuntimeState, observation: OperationObservation, won: boolean, reason?: OperationFailureReason): OperationResult {
  const destroyedHullIds = observation.hulls.filter((hull) => !hull.alive).map((hull) => hull.hullId);
  const survivingHullIds = observation.hulls.filter((hull) => hull.alive).map((hull) => hull.hullId);
  const result: OperationResult = {
    operationId: state.plan.id,
    won,
    ...(reason ? { reason } : {}),
    completedPhaseIds: [...state.completedPhaseIds],
    destroyedHullIds,
    survivingHullIds,
    collateral: state.collateral,
    elapsed: state.elapsed,
    cleanSheet: destroyedHullIds.length === 0,
  };
  state.result = result;
  return result;
}

export function stepOperation(state: OperationRuntimeState, observation: OperationObservation, dt: number): OperationRuntimeEvent[] {
  if (state.result) return [];
  state.elapsed += Math.max(0, dt);
  state.collateral = Math.max(state.collateral, observation.collateral);

  const fail = (reason: OperationFailureReason): OperationRuntimeEvent[] => [{
    type: 'complete', operationId: state.plan.id, result: finish(state, observation, false, reason),
  }];
  if (observation.friendlyCombatants <= 0) return fail('force_destroyed');
  if (state.plan.complication === 'reinforcement_clock' && state.elapsed >= 120) return fail('reinforcements_arrived');
  if (state.plan.complication === 'scorched_earth' && observation.scorchedTargetDestroyed) return fail('prize_destroyed');
  if (state.setup.criticalAirframeRequired && observation.criticalAirframesAlive <= 0) return fail('critical_airframe_lost');
  if (state.elapsed >= 15 * 60) return fail('time_expired');

  const phase = state.plan.phases[state.currentPhase];
  if (!phase) return [{ type: 'complete', operationId: state.plan.id, result: finish(state, observation, true) }];
  let complete = false;
  let progress = 0;
  switch (phase.kind) {
    case 'capture': {
      if (observation.phase.friendly > 0 && observation.phase.friendly > observation.phase.enemy) state.phaseProgress += dt;
      else state.phaseProgress = Math.max(0, state.phaseProgress - dt * 0.5);
      progress = Math.min(1, state.phaseProgress / 5);
      complete = progress >= 1;
      break;
    }
    case 'hold':
    case 'defend': {
      if (observation.phase.friendly > 0 && (phase.kind === 'hold' || observation.phase.enemy === 0)) state.phaseProgress += dt;
      const duration = phase.duration ?? 60;
      progress = Math.min(1, state.phaseProgress / duration);
      complete = progress >= 1;
      break;
    }
    case 'destroy':
      complete = observation.phase.targetDestroyed;
      progress = complete ? 1 : 0;
      break;
    case 'escort':
    case 'arrive': {
      const need = phase.targetCount ?? 1;
      progress = Math.min(1, observation.phase.friendlyDomain / need);
      complete = progress >= 1;
      break;
    }
    case 'eliminate':
      complete = observation.enemyAliveByDomain[phase.domain] <= 0;
      progress = complete ? 1 : 0;
      break;
  }

  const events: OperationRuntimeEvent[] = [{ type: 'progress', operationId: state.plan.id, phaseId: phase.id, progress }];
  if (!complete) return events;
  state.completedPhaseIds.push(phase.id);
  state.currentPhase++;
  state.phaseProgress = 0;
  const next = state.plan.phases[state.currentPhase];
  if (next) {
    events.push({ type: 'phase', operationId: state.plan.id, phaseId: next.id, label: next.label });
  } else {
    events.push({ type: 'complete', operationId: state.plan.id, result: finish(state, observation, true) });
  }
  return events;
}

const DOMAIN_KINDS: Record<OperationDomain, ReadonlySet<VehicleKind>> = { land: LAND_KINDS, air: AIR_KINDS, sea: SEA_KINDS };
const domainOf = (kind: VehicleKind): OperationDomain => AIR_KINDS.has(kind) ? 'air' : SEA_KINDS.has(kind) ? 'sea' : 'land';

export function observeWorldOperation(world: World): OperationObservation {
  const state = world.operation;
  const objective = state && world.map.operation?.objectives[state.currentPhase];
  const observation = emptyOperationObservation();
  if (!state || !objective) return observation;
  const inside = (x: number, z: number) => Math.hypot(x - objective.pos.x, z - objective.pos.z) <= objective.radius;
  observation.friendlyCombatants = 0;
  observation.phase = { friendly: 0, enemy: 0, friendlyDomain: 0, targetDestroyed: false };
  observation.enemyAliveByDomain = { land: 0, air: 0, sea: 0 };

  for (const soldier of world.soldiers.values()) {
    if (!soldier.alive || (soldier.kind !== 'human' && soldier.kind !== 'bot')) continue;
    if (soldier.team === 0) {
      observation.friendlyCombatants++;
      if (inside(soldier.pos.x, soldier.pos.z)) {
        observation.phase.friendly++;
        if (state.plan.phases[state.currentPhase].domain === 'land') observation.phase.friendlyDomain++;
      }
    } else {
      observation.enemyAliveByDomain.land++;
      if (inside(soldier.pos.x, soldier.pos.z)) observation.phase.enemy++;
    }
  }
  for (const vehicle of world.vehicles.values()) {
    const domain = domainOf(vehicle.kind);
    if (vehicle.alive && vehicle.team === 0) {
      observation.friendlyCombatants++;
      if (inside(vehicle.pos.x, vehicle.pos.z)) {
        observation.phase.friendly++;
        if (domain === state.plan.phases[state.currentPhase].domain) observation.phase.friendlyDomain++;
      }
    } else if (vehicle.alive && vehicle.team === 1) {
      observation.enemyAliveByDomain[domain]++;
      if (inside(vehicle.pos.x, vehicle.pos.z)) observation.phase.enemy++;
    }
  }
  const target = [...world.vehicles.values()].find((vehicle) => vehicle.operationObjectiveId === objective.id);
  observation.phase.targetDestroyed = target !== undefined && !target.alive;
  observation.hulls = (world.opts.operationInventory ?? []).filter((hull) => world.opts.operationManifest?.hullIds.includes(hull.id)).map((hull) => ({
    hullId: hull.id,
    alive: [...world.vehicles.values()].some((vehicle) => vehicle.operationHullId === hull.id && vehicle.alive),
  }));
  observation.criticalAirframesAlive = observation.hulls.filter((hull) => {
    const source = world.opts.operationInventory?.find((entry) => entry.id === hull.hullId);
    return hull.alive && source !== undefined && DOMAIN_KINDS.air.has(source.kind);
  }).length;
  observation.collateral = world.operationCollateral;
  return observation;
}

export function stepWorldOperation(world: World, dt: number) {
  const state = world.operation;
  if (!state || state.result) return;
  for (const event of stepOperation(state, observeWorldOperation(world), dt)) {
    if (event.type === 'progress') {
      world.emit({ type: 'operation_progress', operationId: event.operationId, phaseId: event.phaseId, progress: event.progress });
    } else if (event.type === 'phase') {
      world.emit({ type: 'operation_phase', operationId: event.operationId, phaseId: event.phaseId, text: event.label, big: true });
    } else if (event.result) {
      world.mode.over = true;
      world.mode.winner = event.result.won ? 0 : 1;
      world.emit({
        type: 'operation_complete', operationId: event.operationId, won: event.result.won,
        text: event.result.won ? 'OPERATION COMPLETE' : 'OPERATION FAILED', big: true,
      });
      world.emit({ type: 'match_over', team: event.result.won ? 0 : 1, text: event.result.won ? 'UNITED FRONT WINS' : 'THE COLLECTIVE WINS', big: true });
    }
  }
}
