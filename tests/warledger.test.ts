// ---------------------------------------------------------------------------
// B1 THE WAR BUDGET (Robert: "a budget on each side… if you won and were
// underfunded it increased your morale — we could keep track of those kind
// of things").
//
// Every side keeps books: materiel SPENT (gods, warheads) and hulls LOST
// (each vehicle's requisition cost). At the whistle the books are compared —
// a winner whose whole bill came in at three-quarters of the loser's fought
// poor and won anyway, and the campaign banks that as morale.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { VEHICLES } from '../src/sim/data';
import type { VehicleKind } from '../src/sim/types';
import { World } from '../src/sim/world';

describe('B1 — the war ledger', () => {
  it('every hull in the fleet carries a requisition cost', () => {
    for (const kind of Object.keys(VEHICLES) as VehicleKind[]) {
      expect(VEHICLES[kind].cost, `${kind} has no price tag`).toBeGreaterThan(0);
    }
    // and the ladder is sane: a tank costs more than a buggy, a bomber more than a bike
    expect(VEHICLES.tank.cost!).toBeGreaterThan(VEHICLES.buggy.cost!);
    expect(VEHICLES.bomber.cost!).toBeGreaterThan(VEHICLES.bike.cost!);
  });

  it('a wreck goes on its owner team\'s bill at requisition value', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    const before = w.warCost(0);
    const v = w.spawnVehicle('tank', 0, { x: 0, y: 0, z: 0 });
    v.alive = true;
    while (v.alive) w.damageVehicle(v, 300, -1, 'gl');
    expect(w.warCost(0) - before).toBe(VEHICLES.tank.cost!);
    expect(w.warCost(1), 'the enemy pays nothing for our wreck').toBe(0);
  });

  it('the whistle crowns an UNDERDOG when the winner spent under three-quarters', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    w.warLedger[0].spent = 2;   // the poor side
    w.warLedger[1].spent = 9;   // the rich side
    w.mode.target = 1;
    const s = w.addSoldier('Winner', 'infantry', 0, 'human');
    s.kills = 1;                // tdm target met
    w.takeEvents();
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
    expect(w.mode.winner).toBe(0);
    expect(w.mode.underdog, 'won on 2 against 9 — that is the morale event').toBe(0);
  });

  it('a RICH winner is just a winner — no morale for outspending', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    w.warLedger[0].spent = 9;
    w.warLedger[1].spent = 5;
    w.mode.target = 1;
    const s = w.addSoldier('Winner', 'infantry', 0, 'human');
    s.kills = 1;
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
    expect(w.mode.underdog).toBeUndefined();
  });

  it('a QUIET match crowns nobody — two empty ledgers are not an upset', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    w.mode.target = 1;
    const s = w.addSoldier('Winner', 'infantry', 0, 'human');
    s.kills = 1;
    w.step(1 / 60, new Map());
    expect(w.mode.over).toBe(true);
    expect(w.mode.underdog, '0 vs 0 must not read as an underfunded victory').toBeUndefined();
  });

  it('MORALE ARRIVES AS MATERIEL: a believing army opens with a fuller stable', () => {
    const plain = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    const boosted = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0, moraleBoost: [2, 0] });
    expect(boosted.materiel[0]).toBe(plain.materiel[0] + 2);
    expect(boosted.materiel[1]).toBe(plain.materiel[1]);
    // and belief is not a printing press
    const flooded = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0, moraleBoost: [99, 0] });
    expect(flooded.materiel[0]).toBeLessThanOrEqual(14);
  });

  it('the ledger rides the wire — a snapshot carries both books', () => {
    const w = new World({ seed: 3, mode: 'tdm', botsPerTeam: 0 });
    w.warLedger[0].spent = 4;
    w.warLedger[1].hulls = 3;
    // the ledger is plain data on the world — new fields must be serializable
    const json = JSON.parse(JSON.stringify(w.warLedger)) as typeof w.warLedger;
    expect(json[0].spent).toBe(4);
    expect(json[1].hulls).toBe(3);
  });
});
