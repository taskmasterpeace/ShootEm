import { describe, expect, it } from 'vitest';
import { applyResult, consumeOperationBattleBonuses, freshCampaign, operationBattleBonuses } from '../src/client/campaign';
import { generateOperation, type OperationHull, type OperationManifest } from '../src/sim/operations';
import { World } from '../src/sim/world';
import { T_DEEP, T_WATER, tileAt } from '../src/sim/map';

function rewardedCampaign() {
  const campaign = freshCampaign(1000);
  campaign.facilities.push(
    'capture_airfield', 'capture_fuel_farm', 'capture_rail_hub', 'capture_radar',
    'capture_sam', 'capture_repair_depot', 'capture_bridge',
  );
  campaign.modifiers.push(
    { id: 'steal_opening_purse', scope: 'next_battle', uses: 1, value: 3, frontId: 'highland_pass' },
    { id: 'cheaper_requisition', scope: 'season', uses: -1, value: 0.2 },
    { id: 'artillery_barrage', scope: 'next_battle', uses: 1, value: 1, frontId: 'highland_pass' },
    { id: 'preplaced_hazards', scope: 'next_battle', uses: 1, value: 3, frontId: 'highland_pass' },
    { id: 'rearm_pads', scope: 'season', uses: -1, value: 1, frontId: 'highland_pass' },
    { id: 'ground_enemy_air', scope: 'next_battle', uses: 1, value: 1, frontId: 'highland_pass' },
    { id: 'cas_allotment', scope: 'season', uses: -1, value: 1, frontId: 'highland_pass' },
    { id: 'escort_wing', scope: 'season', uses: -1, value: 1, frontId: 'highland_pass' },
    { id: 'early_warning', scope: 'season', uses: -1, value: 1, frontId: 'highland_pass' },
    { id: 'no_fly_zone', scope: 'season', uses: -1, value: 1, frontId: 'highland_pass' },
  );
  campaign.intel.push('opening_fog_lift');
  return campaign;
}

describe('Operation rewards enter the next battle', () => {
  it('folds facilities, modifiers, and intel into one serializable bonus contract', () => {
    const bonuses = operationBattleBonuses(rewardedCampaign(), 'highland_pass');
    expect(bonuses).toEqual({
      openingMateriel: 5,
      enemyMaterielPenalty: 3,
      requisitionDiscount: 0.35,
      denyEnemyAir: true,
      earlyWarningSeconds: 30,
      fogLiftSeconds: 30,
      forwardSpawn: true,
      repairPad: true,
      rearmPad: true,
      bridgeAccess: true,
      samCover: true,
      cas: true,
      escortWing: true,
      artillery: 1,
      hazards: 3,
      coastalCover: false,
      navalSupport: false,
    });
  });

  it('materializes bonuses in a real Operation World', () => {
    const campaign = rewardedCampaign();
    const plan = {
      ...generateOperation({ seed: 7749, pass: 2, frontId: 'highland_pass', frontName: 'Highland Pass', signatureId: 'hammer' }),
      complication: 'storm' as const,
    };
    const hulls: OperationHull[] = [
      { id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' },
      { id: 'falcon-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
    ];
    const manifest: OperationManifest = { hullIds: hulls.map((hull) => hull.id), ammunition: 2, support: 'none' };
    const world = new World({
      seed: plan.seed,
      mode: 'conquest',
      botsPerTeam: 0,
      operation: plan,
      operationManifest: manifest,
      operationInventory: hulls,
      operationBonuses: operationBattleBonuses(campaign, plan.frontId),
    });

    expect(world.materiel).toEqual([14, 7]);
    expect(world.operationRequisitionDiscount).toBe(0.35);
    expect(world.operationEarlyWarningSeconds).toBe(30);
    expect(world.operationFogLiftUntil).toBe(30);
    expect(world.operationRepairPadPos).toBeTruthy();
    expect(world.operationArtillery).toBe(1);
    expect(world.mines.size).toBe(3);
    expect(world.map.pickups.some((pickup) => pickup.type === 'ammo')).toBe(true);
    expect([...world.vehicles.values()].some((vehicle) => vehicle.team === 0 && vehicle.kind === 'aatrack')).toBe(true);
    expect([...world.vehicles.values()].some((vehicle) => vehicle.team === 0 && vehicle.kind === 'strikejet')).toBe(true);
    expect([...world.vehicles.values()].some((vehicle) => vehicle.team === 0 && vehicle.kind === 'interceptor')).toBe(true);
    expect([...world.vehicles.values()].some((vehicle) => vehicle.team === 1 && ['flyer', 'strikejet', 'interceptor', 'bomber'].includes(vehicle.kind))).toBe(false);
    expect(world.map.spawns[0][0]).toEqual(world.map.controlPoints[0].pos);

    expect(world.callOperationArtillery({ ...world.map.controlPoints[0].pos }, 0)).toBe(true);
    expect(world.operationArtillery).toBe(0);
    expect(world.callOperationArtillery({ ...world.map.controlPoints[0].pos }, 0)).toBe(false);
    expect(world.takeEvents().some((event) => event.type === 'orbital_strike')).toBe(true);
  });

  it('consumes one-battle rewards while keeping seasonal infrastructure', () => {
    const campaign = rewardedCampaign();
    consumeOperationBattleBonuses(campaign, 'highland_pass');
    expect(campaign.modifiers.some((modifier) => modifier.scope === 'next_battle' && modifier.frontId === 'highland_pass')).toBe(false);
    expect(campaign.modifiers.some((modifier) => modifier.scope === 'season')).toBe(true);
    expect(campaign.facilities).toContain('capture_airfield');
  });

  it('turns the remaining strategic rewards into concrete battle or campaign advantages', () => {
    const campaign = freshCampaign(1000);
    campaign.facilities.push('capture_port', 'capture_forge', 'capture_clone_hub');
    campaign.modifiers.push(
      { id: 'open_supply_route', scope: 'front', uses: 1, value: 1, frontId: 'eastern_plains' },
      { id: 'deny_supply_route', scope: 'front', uses: 1, value: -1, frontId: 'eastern_plains' },
      { id: 'hold_chokepoint', scope: 'front', uses: 1, value: 1, frontId: 'eastern_plains' },
      { id: 'air_superiority_control', scope: 'season', uses: -1, value: 1, frontId: 'eastern_plains' },
      { id: 'carrier_slot', scope: 'season', uses: -1, value: 1, frontId: 'eastern_plains' },
    );
    campaign.doctrine.push('doctrine_node', 'vehicle_retrofit');
    campaign.intel.push('reveal_manifest', 'see_enemy_books');
    const bonuses = operationBattleBonuses(campaign, 'eastern_plains');
    expect(bonuses).toMatchObject({
      openingMateriel: 1, enemyMaterielPenalty: 2, requisitionDiscount: 0.2,
      denyEnemyAir: true, earlyWarningSeconds: 30, repairPad: true,
      cas: true, escortWing: true, hazards: 1, navalSupport: true,
    });

    campaign.fronts.eastern_plains.clones = 100;
    applyResult(campaign, 'eastern_plains', true, 2000, 0);
    expect(campaign.fronts.eastern_plains.clones).toBe(200); // standard 60 + clone-hub 40
  });

  it('only deploys naval support onto navigable water', () => {
    const campaign = freshCampaign(1000);
    campaign.facilities.push('capture_port');
    const base = generateOperation({ seed: 901, pass: 2, frontId: 'highland_pass', signatureId: 'hammer' });
    const hulls: OperationHull[] = [
      { id: 'ares-01', kind: 'tank', name: 'Ares One', status: 'available' },
      { id: 'falcon-01', kind: 'interceptor', name: 'Falcon One', status: 'available' },
    ];
    const manifest: OperationManifest = { hullIds: hulls.map((hull) => hull.id), ammunition: 2, support: 'none' };
    const makeWorld = (site: 'mountain_pass' | 'river_crossing') => new World({
      seed: base.seed,
      mode: 'conquest',
      botsPerTeam: 0,
      operation: { ...base, site },
      operationManifest: manifest,
      operationInventory: hulls,
      operationBonuses: operationBattleBonuses(campaign, base.frontId),
    });

    expect([...makeWorld('mountain_pass').vehicles.values()].some((vehicle) => vehicle.team === 0 && vehicle.kind === 'boat')).toBe(false);
    const wet = makeWorld('river_crossing');
    const boat = [...wet.vehicles.values()].find((vehicle) => vehicle.team === 0 && vehicle.kind === 'boat');
    expect(boat).toBeTruthy();
    expect([T_WATER, T_DEEP]).toContain(tileAt(wet.map.grid, boat!.pos.x, boat!.pos.z, wet.map.geometry));
  });
});
