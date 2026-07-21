import { describe, expect, it } from 'vitest';
import {
  createOperationRuntime,
  emptyOperationObservation,
  stepOperation,
  type OperationObservation,
  type OperationRuntimeState,
} from '../src/sim/operation-runtime';
import {
  OPERATION_VERBS,
  generateOperation,
  type OperationHull,
  type OperationManifest,
  type OperationPhase,
  type OperationPlan,
  type OperationVerbDef,
} from '../src/sim/operations';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';

function planForVerb(verb: OperationVerbDef, complication: OperationPlan['complication'] = 'storm'): OperationPlan {
  const base = generateOperation({ seed: 4207, frontId: 'eastern_plains', frontName: 'Eastern Plains', pass: 1 });
  return {
    ...base,
    id: `test:${verb.id}`,
    verb: verb.id,
    domains: [verb.domain],
    site: verb.sites[0],
    complication,
    phases: verb.phases.map((phase, index) => ({ ...phase, duration: phase.duration ? 0.1 : undefined, id: `${verb.id}:${index + 1}` })),
    requirements: { [verb.domain]: 1 },
  };
}

function successObservation(phase: OperationPhase): OperationObservation {
  const observation = emptyOperationObservation();
  observation.friendlyCombatants = 2;
  observation.phase.friendly = 2;
  observation.phase.friendlyDomain = Math.max(phase.targetCount ?? 1, 1);
  observation.phase.enemy = 0;
  observation.enemyAliveByDomain[phase.domain] = 0;
  observation.phase.targetDestroyed = true;
  observation.criticalAirframesAlive = 1;
  observation.hulls = [{ hullId: 'test-hull', alive: true }];
  return observation;
}

function finish(state: OperationRuntimeState) {
  let guard = 0;
  while (!state.result && guard++ < 20) {
    const phase = state.plan.phases[state.currentPhase];
    stepOperation(state, successObservation(phase), 1);
  }
}

describe('the fifteen Operation verbs', () => {
  it.each(OPERATION_VERBS)('$name has a real success path', (verb) => {
    const state = createOperationRuntime(planForVerb(verb));
    finish(state);
    expect(state.result, verb.id).toMatchObject({ won: true, operationId: `test:${verb.id}` });
    expect(state.completedPhaseIds).toEqual(state.plan.phases.map((phase) => phase.id));
  });

  it.each(OPERATION_VERBS)('$name fails when the committed force is wiped', (verb) => {
    const state = createOperationRuntime(planForVerb(verb));
    const observation = emptyOperationObservation();
    observation.friendlyCombatants = 0;
    observation.hulls = [{ hullId: 'test-hull', alive: false }];
    stepOperation(state, observation, 1);
    expect(state.result).toMatchObject({ won: false, reason: 'force_destroyed', destroyedHullIds: ['test-hull'] });
  });

  it('does not skip phases in a combined-arms signature', () => {
    const plan = generateOperation({ seed: 9, frontId: 'highland_pass', frontName: 'Highland Pass', pass: 2, signatureId: 'hammer' });
    const state = createOperationRuntime(plan);
    const first = plan.phases[0];
    stepOperation(state, successObservation(first), 1);
    expect(state.completedPhaseIds).toEqual([first.id]);
    expect(state.currentPhase).toBe(1);
    expect(state.result).toBeNull();
    finish(state);
    expect(state.result?.won).toBe(true);
  });

  it('remembers a named hull loss across later phases even if an observation becomes stale', () => {
    const plan = generateOperation({ seed: 9, frontId: 'highland_pass', frontName: 'Highland Pass', pass: 2, signatureId: 'hammer' });
    const state = createOperationRuntime(plan);
    const first = successObservation(plan.phases[0]);
    first.hulls = [{ hullId: 'ares-01', alive: false }, { hullId: 'falcon-01', alive: true }];
    stepOperation(state, first, 1);
    const second = successObservation(plan.phases[1]);
    second.hulls = [{ hullId: 'ares-01', alive: true }, { hullId: 'falcon-01', alive: true }];
    stepOperation(state, second, 6);
    expect(state.result).toMatchObject({ destroyedHullIds: ['ares-01'], survivingHullIds: ['falcon-01'], cleanSheet: false });
  });
});

describe('Operation complications', () => {
  const stateFor = (complication: OperationPlan['complication']) =>
    createOperationRuntime(planForVerb(OPERATION_VERBS[0], complication));

  it('translates weather, support, god, and airframe clauses into setup requirements', () => {
    expect(stateFor('storm').setup.weather).toBe('storm');
    expect(stateFor('air_cover_denied').setup.deniedSupport).toBe('cas');
    expect(stateFor('god_on_objective').setup.defenderLswRequired).toBe(true);
    expect(stateFor('one_airframe').setup.criticalAirframeRequired).toBe(true);
  });

  it('fails against the reinforcement clock', () => {
    const state = stateFor('reinforcement_clock');
    const observation = emptyOperationObservation();
    observation.friendlyCombatants = 1;
    observation.criticalAirframesAlive = 1;
    stepOperation(state, observation, 121);
    expect(state.result).toMatchObject({ won: false, reason: 'reinforcements_arrived' });
  });

  it('fails when scorched earth destroys the prize', () => {
    const state = stateFor('scorched_earth');
    const observation = emptyOperationObservation();
    observation.friendlyCombatants = 1;
    observation.scorchedTargetDestroyed = true;
    stepOperation(state, observation, 1);
    expect(state.result).toMatchObject({ won: false, reason: 'prize_destroyed' });
  });

  it('records collateral without changing a tactical win into a loss', () => {
    const state = stateFor('no_collateral');
    const observation = successObservation(state.plan.phases[0]);
    observation.collateral = 3;
    stepOperation(state, observation, 6);
    expect(state.result).toMatchObject({ won: true, collateral: 3 });
  });

  it('fails when the one critical airframe is lost', () => {
    const state = stateFor('one_airframe');
    const observation = emptyOperationObservation();
    observation.friendlyCombatants = 1;
    observation.criticalAirframesAlive = 0;
    stepOperation(state, observation, 1);
    expect(state.result).toMatchObject({ won: false, reason: 'critical_airframe_lost' });
  });
});

describe('World Operation integration', () => {
  it('uses Operation ground, completes the objective, and emits one terminal event', () => {
    const base = planForVerb(OPERATION_VERBS.find((verb) => verb.id === 'spearhead')!);
    const plan: OperationPlan = {
      ...base,
      phases: [{ id: 'spearhead:1', kind: 'arrive', label: 'Cross the line', domain: 'land' }],
      complication: 'storm',
    };
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const manifest: OperationManifest = { hullIds: ['ares-01'], ammunition: 1, support: 'none' };
    const world = new World({ seed: plan.seed, mode: 'conquest', botsPerTeam: 0, operation: plan, operationManifest: manifest, operationInventory: hulls });
    const soldier = world.addSoldier('Reyes', 'infantry', 0, 'human');
    soldier.pos = { ...world.map.operation!.objectives[0].pos };
    world.step(0.1, new Map());
    expect(world.operation?.result).toMatchObject({ won: true });
    expect(world.mode).toMatchObject({ over: true, winner: 0 });
    const terminal = world.takeEvents().filter((event) => event.type === 'operation_complete');
    expect(terminal).toHaveLength(1);
  });

  it('tags a destroy objective onto a real enemy emplacement', () => {
    const base = planForVerb(OPERATION_VERBS.find((verb) => verb.id === 'siege')!);
    const plan: OperationPlan = {
      ...base,
      phases: [{ id: 'siege:1', kind: 'destroy', label: 'Break the battery', domain: 'land', targetCount: 1 }],
      complication: 'storm',
    };
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const manifest: OperationManifest = { hullIds: ['ares-01'], ammunition: 1, support: 'none' };
    const world = new World({ seed: plan.seed, mode: 'conquest', botsPerTeam: 0, operation: plan, operationManifest: manifest, operationInventory: hulls });
    world.addSoldier('Reyes', 'infantry', 0, 'human');
    const target = [...world.vehicles.values()].find((vehicle) => vehicle.operationObjectiveId === 'test:siege:objective:1');
    expect(target).toBeTruthy();
    world.damageVehicle(target!, 9999, -1, 'tank_cannon');
    world.step(0.1, new Map());
    expect(world.operation?.result).toMatchObject({ won: true });
  });

  it('applies authorized support and enforces denied air cover', () => {
    const base = planForVerb(OPERATION_VERBS[0]);
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const artilleryPlan: OperationPlan = { ...base, authorizedSupport: ['none', 'artillery'] };
    const artillery = new World({
      seed: base.seed, mode: 'conquest', operation: artilleryPlan,
      operationManifest: { hullIds: ['ares-01'], ammunition: 1, support: 'artillery' }, operationInventory: hulls,
    });
    expect(artillery.operationArtillery).toBe(1);

    const deniedPlan: OperationPlan = { ...base, complication: 'air_cover_denied', authorizedSupport: ['none', 'cas'] };
    const denied = new World({
      seed: base.seed, mode: 'conquest', operation: deniedPlan,
      operationManifest: { hullIds: ['ares-01'], ammunition: 1, support: 'cas' }, operationInventory: hulls,
    });
    expect([...denied.vehicles.values()].some((vehicle) => vehicle.team === 0 && vehicle.kind === 'strikejet')).toBe(false);
  });

  it('places a hostile god on the objective', () => {
    const plan = { ...planForVerb(OPERATION_VERBS[0], 'god_on_objective'), pass: 2 as const };
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const world = new World({
      seed: plan.seed, mode: 'conquest', lswPass: 2, operation: plan,
      operationManifest: { hullIds: ['ares-01'], ammunition: 1, support: 'none' }, operationInventory: hulls,
    });
    const god = [...world.soldiers.values()].find((soldier) => soldier.team === 1 && soldier.ascendant);
    expect(god).toBeTruthy();
    expect(Math.hypot(god!.pos.x - world.map.operation!.objectives[0].pos.x, god!.pos.z - world.map.operation!.objectives[0].pos.z)).toBeLessThan(1);
  });

  it('fails when the live scorched-earth prize is destroyed', () => {
    const plan = planForVerb(OPERATION_VERBS[0], 'scorched_earth');
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const world = new World({
      seed: plan.seed, mode: 'conquest', operation: plan,
      operationManifest: { hullIds: ['ares-01'], ammunition: 1, support: 'none' }, operationInventory: hulls,
    });
    world.addSoldier('Reyes', 'infantry', 0, 'human');
    const prize = [...world.vehicles.values()].find((vehicle) => vehicle.operationPrize);
    expect(prize).toBeTruthy();
    world.damageVehicle(prize!, 9999, -1, 'tank_cannon');
    world.step(0.1, new Map());
    expect(world.operation?.result).toMatchObject({ won: false, reason: 'prize_destroyed' });
  });

  it('counts friendly explosions in a protected zone as collateral', () => {
    const plan = planForVerb(OPERATION_VERBS[0], 'no_collateral');
    const hulls: OperationHull[] = [{ id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' }];
    const world = new World({
      seed: plan.seed, mode: 'conquest', operation: plan,
      operationManifest: { hullIds: ['ares-01'], ammunition: 1, support: 'none' }, operationInventory: hulls,
    });
    const me = world.addSoldier('Reyes', 'infantry', 0, 'human');
    const zone = world.map.operation!.protectedZones[0];
    world.explode(zone.pos, WEAPONS.gl, me.id, 0);
    world.step(0.1, new Map());
    expect(world.operationCollateral).toBe(1);
    expect(world.operation?.collateral).toBe(1);
  });
});
