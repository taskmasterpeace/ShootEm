import { describe, expect, it } from 'vitest';
import { freshCampaign, type SettlementReceipt } from '../src/client/campaign';
import { MatchTracker, commandCertification, freshDossier, migrateDossier, recordOperationService } from '../src/client/record';
import { generateOperation, type OperationManifest } from '../src/sim/operations';
import type { OperationResult } from '../src/sim/operation-runtime';
import type { SimEvent, VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

function operationFacts() {
  const campaign = freshCampaign(1000);
  const plan = generateOperation({ seed: 7749, frontId: 'the_port', frontName: 'The Port', pass: 2, signatureId: 'beachhead' });
  const tank = campaign.motorPool.find((hull) => hull.kind === 'tank')!;
  const boat = campaign.motorPool.find((hull) => hull.kind === 'boat')!;
  const manifest: OperationManifest = { hullIds: [tank.id, boat.id], ammunition: 2, support: 'none' };
  const result: OperationResult = {
    operationId: plan.id, won: true, completedPhaseIds: plan.phases.map((phase) => phase.id),
    destroyedHullIds: [], survivingHullIds: manifest.hullIds, collateral: 0, elapsed: 90, cleanSheet: true,
    hullKills: { [tank.id]: { tank: 1, boat: 1, flyer: 1 } },
  };
  const receipt: SettlementReceipt = {
    ok: true, duplicate: false, operationId: plan.id, won: true, effect: plan.effect,
    treasuryDelta: 8, hullsLost: [], hullsReturned: manifest.hullIds, errors: [],
  };
  return { campaign, plan, tank, boat, manifest, result, receipt };
}

describe('Operation service record', () => {
  it('migrates an existing v1 career without dropping its record', () => {
    const old = freshDossier('Reyes') as unknown as { v: number; operations?: unknown; lifetime: { kills: number } };
    old.v = 1;
    old.lifetime.kills = 19;
    delete old.operations;
    const migrated = migrateDossier(old, 'Reyes');
    expect(migrated.v).toBe(2);
    expect(migrated.lifetime.kills).toBe(19);
    expect(migrated.operations.sorties).toBe(0);
  });

  it('attributes destroyed target kinds to the named committed hull in the event stream', () => {
    const world = new World({ seed: 3, mode: 'tdm' });
    const dossier = freshDossier('Reyes');
    const me = world.addSoldier('Reyes', 'infantry', 0, 'human');
    const carrier = world.spawnVehicle('tank', 0, { x: 0, y: 0, z: 0 });
    carrier.operationHullId = 'tank-01';
    me.vehicleId = carrier.id;
    const tracker = new MatchTracker(dossier, 'Reyes', 'infantry', 'tdm', 3);
    const events = (['tank', 'boat', 'flyer'] as VehicleKind[]).map((vehKind): SimEvent => ({
      type: 'vehicle_destroyed', killerId: me.id, weaponId: 'tank_cannon', vehKind,
    }));
    tracker.applyEvents(events, world, me.id);
    expect(tracker.operationHullKills()).toEqual({ 'tank-01': { tank: 1, boat: 1, flyer: 1 } });
  });

  it('persists sorties, clean sheets, efficiency, certification, and vehicle-ace history once', () => {
    const { campaign, plan, tank, manifest, result, receipt } = operationFacts();
    const dossier = freshDossier('Reyes');
    const first = recordOperationService(dossier, { plan, manifest, result, receipt, inventory: campaign.motorPool });
    expect(first.recorded).toBe(true);
    expect(dossier.operations).toMatchObject({ sorties: 1, wins: 1, cleanSheets: 1, objectivesCompleted: 2 });
    expect(dossier.operations.vehicles[tank.id]).toMatchObject({ name: tank.name, sorties: 1, cleanSheets: 1, killsByKind: { tank: 1, boat: 1, flyer: 1 } });
    expect(commandCertification(dossier.operations).points).toBeGreaterThan(0);
    expect(recordOperationService(dossier, { plan, manifest, result, receipt, inventory: campaign.motorPool }).recorded).toBe(false);
    expect(dossier.operations.sorties).toBe(1);
  });
});
