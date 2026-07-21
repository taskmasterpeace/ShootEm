import { describe, expect, it } from 'vitest';
import { assignVehicleRoles, vehicleRouteFor, vehicleWaypoint } from '../src/sim/bots';
import { generateTheater } from '../src/sim/theaters';
import { World } from '../src/sim/world';

function rig(theaterId: 'desert' | 'coastal') {
  const world = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0, map: generateTheater(theaterId, 42) });
  const bot = world.addSoldier('Route Bot', 'infantry', 0, 'bot');
  const kind = theaterId === 'coastal' ? 'boat' : 'tank';
  const route = world.map.theater!.routes.find((candidate) => candidate.domain === (kind === 'boat' ? 'surface' : 'ground'))!;
  const vehicle = world.spawnVehicle(kind, 0, route.points[0]);
  vehicle.seats[0] = bot.id;
  bot.vehicleId = vehicle.id;
  bot.seat = 0;
  return { world, bot, vehicle, route };
}

describe('theater-aware vehicle AI', () => {
  it('chooses a compatible declared route deterministically', () => {
    const first = rig('desert');
    const second = rig('desert');
    expect(vehicleRouteFor(first.world, first.bot, first.vehicle)?.id)
      .toBe(vehicleRouteFor(second.world, second.bot, second.vehicle)?.id);
    expect(vehicleRouteFor(first.world, first.bot, first.vehicle)?.domain).toBe('ground');
    const coastal = rig('coastal');
    expect(vehicleRouteFor(coastal.world, coastal.bot, coastal.vehicle)?.domain).toBe('surface');
  });

  it('advances route anchors from the friendly side toward the enemy side', () => {
    const { world, bot, vehicle, route } = rig('desert');
    assignVehicleRoles(world);
    const first = vehicleWaypoint(world, bot, vehicle, route);
    expect(first).toEqual(route.points[1]);
    vehicle.pos = { ...first! };
    expect(vehicleWaypoint(world, bot, vehicle, route)).toEqual(route.points[2]);
  });
});
