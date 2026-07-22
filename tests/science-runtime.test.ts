import { describe, expect, it } from 'vitest';
import { generateScienceMission, type ScienceVerb } from '../src/sim/science';
import { GRID, TILE, WORLD, doorIsOpen, isDoorTile, T_METAL_DOOR, T_THIN_DOOR_H, T_THIN_DOOR_H_OPEN } from '../src/sim/map';
import {
  scienceObjectiveText,
  stepScienceMission,
  tryScienceInteraction,
} from '../src/sim/science-runtime';
import type { PlayerCmd } from '../src/sim/types';
import { World } from '../src/sim/world';

const idle: PlayerCmd = {
  moveX: 0, moveZ: 0, aimYaw: 0, fire: false, altFire: false, jump: false,
  use: false, ability: false, reload: false, grenade: false, weaponSlot: -1,
};

function missionWorld(verb: ScienceVerb = 'steal', squadSize = 4): World {
  const scienceMission = generateScienceMission(7301, {
    verb,
    site: verb === 'rescue' ? 'field-hospital' : 'research-annex',
    complication: null,
    squadSize,
  });
  return new World({ seed: scienceMission.seed, mode: 'science', scienceMission });
}

function stepFor(world: World, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) world.step(1 / 60, new Map());
}

const primitive: Record<ScienceVerb, string> = {
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

describe('science mission objective compiler', () => {
  it.each(Object.entries(primitive))('%s compiles to %s', (verb, kind) => {
    const world = missionWorld(verb as ScienceVerb);
    expect(world.science?.objective.kind).toBe(kind);
    expect(scienceObjectiveText(world.science!)).toBeTruthy();
  });

  it('attaches patrols, report nodes, and permanent floor-aware waypoints', () => {
    const world = missionWorld('steal');
    const runtime = world.science!;

    expect(runtime.operationGraph.metrics.rooms).toBeGreaterThanOrEqual(2);
    expect(runtime.patrolRoutes).toHaveLength(runtime.encounterBudget.initialGuards);
    expect(runtime.reportNodes.length).toBeGreaterThanOrEqual(1);
    expect(runtime.missionWaypoints.some((waypoint) => waypoint.kind === 'insertion' && waypoint.active)).toBe(true);
    expect(runtime.missionWaypoints.some((waypoint) => waypoint.kind === 'objective' && waypoint.active)).toBe(true);
    expect(runtime.missionWaypoints.some((waypoint) => waypoint.kind === 'extraction' && !waypoint.active)).toBe(true);
    expect(runtime.missionWaypoints.every((waypoint) => waypoint.floor === Math.round(waypoint.pos.y / 4))).toBe(true);
  });

  it('walks guards around their authored patrol loops before an alarm', () => {
    const world = missionWorld('steal');
    const runtime = world.science!;
    const guard = world.soldiers.get(runtime.guardIds[0])!;
    const route = runtime.patrolRoutes[0];
    const start = { ...guard.pos };
    expect(route.points[0]).toEqual(start);
    expect(Math.hypot(route.points[1].x - start.x, route.points[1].z - start.z)).toBeGreaterThan(0.5);

    stepFor(world, 1.5);

    expect(runtime.awareness).toBe('ghost');
    expect(Math.hypot(guard.pos.x - start.x, guard.pos.z - start.z)).toBeGreaterThan(0.5);
    expect(guard.botPatrolIndex).toBeGreaterThanOrEqual(1);
  });

  it('keeps insertion outside immediate guard detection across site seeds', () => {
    for (let seed = 8400; seed < 8430; seed++) {
      const scienceMission = generateScienceMission(seed, { squadSize: 4, complication: null });
      const world = new World({ seed, mode: 'science', scienceMission });
      const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
      operator.pos = { ...world.science!.entry };
      operator.floor = 0;
      stepFor(world, 0.2);
      expect(world.science!.pendingReport, `${scienceMission.site}/${seed}`).toBeUndefined();
      expect(world.science!.awareness, `${scienceMission.site}/${seed}`).toBe('ghost');
    }
  });

  it('keeps an idle operator concealed at insertion until they move', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    operator.pos = { ...world.science!.entry };

    for (let i = 0; i < 360; i++) world.step(1 / 60, new Map([[operator.id, idle]]));
    expect(operator.scienceConcealedUntil).toBeGreaterThan(world.time);

    world.step(1 / 60, new Map([[operator.id, { ...idle, moveX: 1 }]]));
    expect(operator.scienceConcealedUntil).toBeUndefined();
  });

  it.each(Object.keys(primitive) as ScienceVerb[])('%s can complete its primary and extract', (verb) => {
    const world = missionWorld(verb);
    const runtime = world.science!;
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');

    if (runtime.objective.kind === 'eliminate') {
      for (const id of runtime.targetIds) world.damageSoldier(world.soldiers.get(id)!, 9999, operator.id, 'ar606');
      for (const id of runtime.vehicleTargetIds) world.damageVehicle(world.vehicles.get(id)!, 99999, operator.id, 'tank_cannon');
      stepScienceMission(world, 1 / 60);
    } else if (runtime.objective.kind === 'interact') {
      for (let i = 0; i < runtime.objective.required; i++) {
        operator.pos = { ...runtime.objective.pos[i] };
        operator.floor = operator.pos.y >= 4 ? 1 : 0;
        expect(tryScienceInteraction(world, operator, 1)).toBe(true);
      }
    } else if (runtime.objective.kind === 'escort') {
      for (const id of runtime.targetIds) {
        const scientist = world.soldiers.get(id)!;
        operator.pos = { ...scientist.pos };
        operator.floor = scientist.floor;
        expect(tryScienceInteraction(world, operator, 1)).toBe(true);
        scientist.pos = { ...runtime.extraction };
        scientist.floor = 0;
      }
      stepScienceMission(world, 1 / 60);
    } else {
      operator.pos = { ...runtime.objective.pos[0] };
      stepScienceMission(world, runtime.objective.required);
    }

    expect(runtime.phase).toBe('extract');
    operator.pos = { ...runtime.extraction };
    operator.floor = 0;
    stepScienceMission(world, 1 / 60);
    expect(runtime.phase).toBe('won');
    expect(world.mode.winner).toBe(0);
  });

  it('interaction objectives unlock extraction', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    operator.pos = { ...world.science!.objective.pos[0] };

    expect(tryScienceInteraction(world, operator, 1)).toBe(true);
    expect(world.science?.objective.complete).toBe(true);
    expect(world.science?.phase).toBe('extract');
    expect(world.science?.missionWaypoints.some((waypoint) => waypoint.kind === 'objective' && waypoint.active)).toBe(false);
    expect(world.science?.missionWaypoints.some((waypoint) => waypoint.kind === 'extraction' && waypoint.active)).toBe(true);
  });

  it('requires the operator to climb to an upstairs villa objective', () => {
    const scienceMission = generateScienceMission(99, {
      verb: 'steal',
      site: 'officer-villa',
      complication: null,
      squadSize: 4,
    });
    const world = new World({ seed: scienceMission.seed, mode: 'science', scienceMission });
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    const upstairs = world.science!.objective.pos.find((pos) => pos.y >= 4)!;

    operator.pos = { ...upstairs, y: 0 };
    operator.floor = 0;
    expect(tryScienceInteraction(world, operator, 1)).toBe(false);

    operator.pos = { ...upstairs };
    operator.floor = 1;
    expect(tryScienceInteraction(world, operator, 1)).toBe(true);
  });

  it('keeps mission doors manual and opens a thin door with the shared use action', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    const idx = world.map.grid.findIndex((tile) => isDoorTile(tile) && tile !== T_METAL_DOOR);
    const tx = idx % GRID;
    const tz = Math.floor(idx / GRID);
    const tile = world.map.grid[idx];
    const spansX = tile === T_THIN_DOOR_H || tile === T_THIN_DOOR_H_OPEN;
    const center = {
      x: (tx + 0.5) * TILE - WORLD / 2,
      z: (tz + 0.5) * TILE - WORLD / 2,
    };
    operator.pos = spansX
      ? { x: center.x, y: 0, z: center.z - TILE * 0.6 }
      : { x: center.x - TILE * 0.6, y: 0, z: center.z };
    operator.yaw = spansX ? Math.PI / 2 : 0;

    world.step(1 / 60, new Map([[operator.id, idle]]));
    expect(doorIsOpen(world.map.grid[idx])).toBe(false);
    world.step(1 / 60, new Map([[operator.id, { ...idle, aimYaw: spansX ? Math.PI / 2 : 0, use: true }]]));
    expect(doorIsOpen(world.map.grid[idx])).toBe(true);
  });

  it('rescue missions attach named scientist actors', () => {
    const world = missionWorld('rescue');
    const operator = world.addSoldier('Operator', 'medic', 0, 'human');
    const scientists = world.science!.civilianIds
      .map((id) => world.soldiers.get(id)!)
      .filter((soldier) => world.science!.targetIds.includes(soldier.id));

    expect(scientists.length).toBeGreaterThanOrEqual(2);
    expect(scientists.every((scientist) => scientist.kind === 'scientist' && scientist.name.startsWith('Dr. '))).toBe(true);
    operator.pos = { ...scientists[0].pos };
    expect(tryScienceInteraction(world, operator, 1)).toBe(true);
    expect(scientists[0].botTargetId).toBe(operator.id);
  });

  it('keeps captive researchers alive while facility guards patrol', () => {
    const scienceMission = generateScienceMission(12017, {
      verb: 'rescue', site: 'research-annex', complication: null, squadSize: 8,
    });
    const world = new World({ seed: scienceMission.seed, mode: 'science', scienceMission });
    const operator = world.addSoldier('Operator', 'medic', 0, 'human');
    operator.pos = { ...world.science!.entry };

    stepFor(world, 6);

    expect(world.science!.phase).toBe('objective');
    expect(world.science!.awareness).toBe('ghost');
    expect(world.science!.targetIds.every((id) => world.soldiers.get(id)?.alive)).toBe(true);
  });

  it('keeps captive pedestrians out of unrelated firefights', () => {
    const world = missionWorld('steal');
    expect(world.science?.civilianIds).toEqual([]);
    expect([...world.soldiers.values()].filter((soldier) => soldier.kind === 'scientist')).toEqual([]);
  });

  it('direct sight starts an interruptible report before the facility alarm', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    operator.scienceConcealedUntil = undefined;
    const guard = [...world.soldiers.values()].find((soldier) => soldier.team === 1 && soldier.kind === 'bot')!;
    operator.pos = { ...guard.pos };

    stepScienceMission(world, 1 / 60);
    expect(world.science?.alarm).toBe(false);
    expect(world.science?.awareness).toBe('searching');
    expect(world.science?.pendingReport?.guardId).toBe(guard.id);
    expect(world.science?.detections).toBe(1);
  });

  it('cancels a report when the reporting guard is stopped', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    operator.scienceConcealedUntil = undefined;
    const guard = world.soldiers.get(world.science!.guardIds[0])!;
    operator.pos = { ...guard.pos };
    stepScienceMission(world, 1 / 60);

    operator.pos = { x: -999, y: 0, z: -999 };
    world.damageSoldier(guard, 9999, operator.id, 'pistol');
    world.time += 2;
    stepScienceMission(world, 1 / 60);

    expect(world.science?.pendingReport).toBeUndefined();
    expect(world.science?.awareness).toBe('ghost');
    expect(world.science?.alarm).toBe(false);
  });

  it('shares only the completed report position, never the live operator position', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    operator.scienceConcealedUntil = undefined;
    const guard = world.soldiers.get(world.science!.guardIds[0])!;
    operator.pos = { ...guard.pos };
    stepScienceMission(world, 1 / 60);
    const sighting = { ...world.science!.pendingReport!.lastKnown };

    operator.pos = { x: sighting.x + 24, y: sighting.y, z: sighting.z + 24 };
    world.time += 2;
    stepScienceMission(world, 1 / 60);

    expect(world.science?.alarm).toBe(true);
    expect(world.science?.awareness).toBe('alarmed');
    expect(world.science?.lastReported).toEqual(sighting);
    world.time += 1;
    stepScienceMission(world, 1 / 60);
    expect(world.science?.lastReported).toEqual(sighting);
  });

  it('an alarm deploys one deterministic reinforcement beat', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    operator.scienceConcealedUntil = undefined;
    const guard = world.soldiers.get(world.science!.guardIds[0])!;
    operator.pos = { ...guard.pos };
    const originalGuards = world.science!.guardIds.length;

    stepScienceMission(world, 1 / 60);
    world.time += 2;
    stepScienceMission(world, 1 / 60);
    world.time += 4.1;
    stepScienceMission(world, 1 / 60);
    stepScienceMission(world, 1 / 60);
    expect(world.science?.guardIds).toHaveLength(originalGuards + world.science!.encounterBudget.reserveGuards);
  });

  it('alarm-net complications begin hot and schedule the response team', () => {
    const scienceMission = generateScienceMission(7310, {
      verb: 'steal', site: 'comms-relay', complication: 'alarm-net', squadSize: 4,
    });
    const world = new World({ seed: scienceMission.seed, mode: 'science', scienceMission });

    expect(world.science?.alarm).toBe(true);
    expect(world.science?.awareness).toBe('alarmed');
    expect(world.science?.detections).toBe(1);
    expect(world.science?.reinforcementAt).toBe(world.time + 4);
  });

  it('a no-kill clause permits the named target but fails on collateral guards', () => {
    const objectiveMission = generateScienceMission(7311, {
      verb: 'assassinate', site: 'officer-villa', complication: 'no-kill', squadSize: 4,
    });
    const objectiveWorld = new World({ seed: objectiveMission.seed, mode: 'science', scienceMission: objectiveMission });
    const operator = objectiveWorld.addSoldier('Operator', 'infiltrator', 0, 'human');
    const target = objectiveWorld.soldiers.get(objectiveWorld.science!.targetIds[0])!;
    objectiveWorld.damageSoldier(target, 9999, operator.id, 'ar606');
    stepScienceMission(objectiveWorld, 1 / 60);
    expect(objectiveWorld.science?.phase).toBe('extract');

    const collateralMission = generateScienceMission(7312, {
      verb: 'steal', site: 'research-annex', complication: 'no-kill', squadSize: 4,
    });
    const collateralWorld = new World({ seed: collateralMission.seed, mode: 'science', scienceMission: collateralMission });
    const secondOperator = collateralWorld.addSoldier('Operator', 'infiltrator', 0, 'human');
    const guard = collateralWorld.soldiers.get(collateralWorld.science!.guardIds[0])!;
    collateralWorld.damageSoldier(guard, 9999, secondOperator.id, 'ar606');
    expect(collateralWorld.science?.phase).toBe('failed');
  });

  it('ambush requires the convoy and escort detail, while the convoy moves toward escape', () => {
    const world = missionWorld('ambush');
    const runtime = world.science!;
    const transport = world.vehicles.get(runtime.vehicleTargetIds[0])!;
    const start = { ...transport.pos };
    stepScienceMission(world, 1);
    expect(Math.hypot(transport.pos.x - start.x, transport.pos.z - start.z)).toBeGreaterThan(0);

    for (const id of runtime.targetIds) world.damageSoldier(world.soldiers.get(id)!, 9999, -1, 'ar606');
    stepScienceMission(world, 1 / 60);
    expect(runtime.objective.complete).toBe(false);
    world.damageVehicle(transport, 99999, -1, 'tank_cannon');
    stepScienceMission(world, 1 / 60);
    expect(runtime.objective.complete).toBe(true);
  });

  it('wins at extraction only after the primary objective is complete', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    operator.pos = { ...world.science!.extraction };
    stepScienceMission(world, 1 / 60);
    expect(world.mode.over).toBe(false);

    operator.pos = { ...world.science!.objective.pos[0] };
    tryScienceInteraction(world, operator, 1);
    operator.pos = { ...world.science!.extraction };
    stepScienceMission(world, 1 / 60);
    expect(world.mode.over).toBe(true);
    expect(world.mode.winner).toBe(0);
  });
});

describe('science mission clone printer', () => {
  it('burns one clone and reprints at the field printer without a downed wait', () => {
    const world = missionWorld('steal', 2);
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    world.damageSoldier(operator, 9999, -1, 'ar606');

    expect(world.science?.clonesRemaining).toBe(1);
    expect(operator.downed).toBe(false);
    expect(operator.alive).toBe(false);
    stepFor(world, 0.5);
    expect(operator.alive).toBe(true);
    expect(Math.hypot(operator.pos.x - world.science!.entry.x, operator.pos.z - world.science!.entry.z)).toBeLessThan(6);
  });

  it('the final clone ends the operation with no reprint', () => {
    const world = missionWorld('steal', 1);
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    world.damageSoldier(operator, 9999, -1, 'ar606');

    expect(world.science?.clonesRemaining).toBe(0);
    expect(world.mode.over).toBe(true);
    expect(world.mode.winner).toBe(1);
    world.step(1, new Map([[operator.id, idle]]));
    expect(operator.alive).toBe(false);
  });
});

describe('science armor policy', () => {
  it('suppresses issued armor for every ordinary science print', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human', {
      equipment: ['armor_vest', 'power_armor'],
    });

    expect(operator.equipment).toEqual([]);
    expect(operator.armor).toBe(0);
    expect(operator.maxArmor).toBe(0);
  });

  it('does not change armor equipment in battle modes', () => {
    const world = new World({ seed: 7302, mode: 'tdm', botsPerTeam: 0 });
    const soldier = world.addSoldier('Rifleman', 'infantry', 0, 'human', {
      equipment: ['armor_vest'],
    });

    expect(soldier.equipment).toEqual(['armor_vest']);
    expect(soldier.armor).toBeGreaterThan(0);
    expect(soldier.maxArmor).toBe(soldier.armor);
  });
});
