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

  it('interaction objectives unlock extraction', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infiltrator', 0, 'human');
    operator.pos = { ...world.science!.objective.pos[0] };

    expect(tryScienceInteraction(world, operator, 1)).toBe(true);
    expect(world.science?.objective.complete).toBe(true);
    expect(world.science?.phase).toBe('extract');
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

  it('detection raises the alarm exactly once', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    const guard = [...world.soldiers.values()].find((soldier) => soldier.team === 1 && soldier.kind === 'bot')!;
    operator.pos = { ...guard.pos };

    stepScienceMission(world, 1 / 60);
    stepScienceMission(world, 1 / 60);
    expect(world.science?.alarm).toBe(true);
    expect(world.science?.detections).toBe(1);
  });

  it('an alarm deploys one deterministic reinforcement beat', () => {
    const world = missionWorld('steal');
    const operator = world.addSoldier('Operator', 'infantry', 0, 'human');
    const guard = world.soldiers.get(world.science!.guardIds[0])!;
    operator.pos = { ...guard.pos };
    const originalGuards = world.science!.guardIds.length;

    stepScienceMission(world, 1 / 60);
    world.time += 5;
    stepScienceMission(world, 1 / 60);
    stepScienceMission(world, 1 / 60);
    expect(world.science?.guardIds).toHaveLength(originalGuards + 3);
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
