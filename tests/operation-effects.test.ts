import { describe, expect, it } from 'vitest';
import { consumeOperationBattleBonuses, freshCampaign, operationBattleBonuses } from '../src/client/campaign';
import { generateOperation, type OperationHull, type OperationManifest } from '../src/sim/operations';
import { World } from '../src/sim/world';

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
});
