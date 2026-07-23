// ---------------------------------------------------------------------------
// THE TREASURY (G1, docs/GOVERNMENT.md). Robert's money law, LOCKED: "when
// you have money, you either gotta win or you gotta lose." The chest is a
// CONSEQUENCE, not a score — and when it runs low, the manifest gets lean.
// ---------------------------------------------------------------------------
import { beforeEach, describe, expect, it } from 'vitest';
import {
  OPENING_BALANCE, PAYOUTS, budgetMultiplier, settleMatch, treasuryFor,
  treasuryLine, treasuryStorage,
} from '../src/client/treasury';

let mem: string | null = null;
beforeEach(() => {
  mem = null;
  treasuryStorage.get = () => mem;
  treasuryStorage.set = (v: string) => { mem = v; };
});

describe('the war chest', () => {
  it('a new government opens with a working balance', () => {
    expect(treasuryFor('united_front').balance).toBe(OPENING_BALANCE);
  });

  it('winning pays and losing costs — the result must MATTER', () => {
    const win = settleMatch('united_front', { result: 'win' });
    expect(win.balance).toBe(OPENING_BALANCE + PAYOUTS.win);
    expect(win.wins).toBe(1);
    const loss = settleMatch('united_front', { result: 'loss' });
    expect(loss.balance).toBe(OPENING_BALANCE + PAYOUTS.win + PAYOUTS.loss);
    expect(loss.losses).toBe(1);
  });

  it('the hulls you wrecked come off the top', () => {
    const clean = settleMatch('collective', { result: 'win' });
    const cleanBal = clean.balance;
    const costly = settleMatch('collective', { result: 'win', hullsLost: 20 });
    expect(costly.balance).toBe(cleanBal + PAYOUTS.win - 20 * PAYOUTS.hullRate);
  });

  it('a chest never goes negative — you fight on what is left', () => {
    for (let i = 0; i < 40; i++) settleMatch('united_front', { result: 'loss', hullsLost: 40 });
    expect(treasuryFor('united_front').balance).toBe(0);
  });

  it('the budget CAPS what a side can field — rich opens the stable, broke sends the shed', () => {
    const rich = budgetMultiplier('united_front');
    expect(rich).toBe(1); // opening balance is the honest middle
    for (let i = 0; i < 20; i++) settleMatch('united_front', { result: 'win' });
    expect(budgetMultiplier('united_front')).toBeGreaterThan(1);
    for (let i = 0; i < 60; i++) settleMatch('united_front', { result: 'loss', hullsLost: 30 });
    expect(budgetMultiplier('united_front'), 'a broke army fields less').toBeLessThan(1);
  });

  it('the two governments keep separate books', () => {
    settleMatch('united_front', { result: 'win' });
    expect(treasuryFor('collective').balance).toBe(OPENING_BALANCE);
  });

  it('every movement explains itself in one line', () => {
    settleMatch('united_front', { result: 'win', hullsLost: 4 });
    const line = treasuryLine('united_front');
    expect(line).toMatch(/WAR CHEST/);
    expect(line).toMatch(/Victory payout/);
  });
});
