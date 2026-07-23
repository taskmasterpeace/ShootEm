// ---------------------------------------------------------------------------
// THE FIELD RECORD, THE LADDER, THE HONORS (docs/COMPETITIVE-ARC.md §§1-3).
// The paintball card folds from the live event stream; the Gauntlet climbs
// 1v1 → 1v7 and dies on two losses at a rung; the Cup moves at the whistle;
// the Belt moves the moment the record falls. The laws under test:
//   · outnumbered splits only count when you are genuinely alone
//   · ledgers only append, transfers name both parties
//   · the player never loses an honor off-screen (every ledger entry comes
//     from a played match — settleCup only reads a finished world)
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { PAINTBALL_FIELDS } from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import {
  FieldTracker, advanceGauntlet, freshFieldRecord, outnumberedKey, GAUNTLET_MAX,
} from '../src/client/fieldrecord';
import { BELT_FLOOR, checkBelt, holderOf, beltRecord, settleCup, type TrophyLedger } from '../src/client/trophies';

const yardWorld = () => {
  const w = new World({ seed: PAINTBALL_FIELDS[0].seed, mode: 'paintball', theme: PAINTBALL_FIELDS[0].theme });
  const hunters = [0, 1, 2].map((i) => w.addSoldier(`Hunter${i}`, 'infantry', 0, 'bot', { primary: 'marker_blitz' }));
  const prey = w.addSoldier('Redline', 'infantry', 1, 'human', { primary: 'marker_pump' });
  w.step(1 / 60, new Map());
  return { w, hunters, prey };
};

const freshTrophies = () => ({
  cup: { v: 1, trophy: 'yard_cup', reigns: [] } as TrophyLedger,
  belt: { v: 1, trophy: 'longball_belt', reigns: [] } as TrophyLedger,
});

describe('the outnumbered math', () => {
  it('buckets enemies the way a paintballer brags', () => {
    expect(outnumberedKey(1)).toBe('1v1');
    expect(outnumberedKey(3)).toBe('1v3');
    expect(outnumberedKey(5)).toBe('1v5plus');
    expect(outnumberedKey(7)).toBe('1v5plus');
  });
});

describe('the field tracker', () => {
  it('folds a splat, a spill, and thrown paint into the card', () => {
    const { w, hunters, prey } = yardWorld();
    const tr = new FieldTracker('Redline', 'Kopje Court');
    tr.step(w, [], prey.id); // opening walk-on snapshots the 1v3 bucket
    hunters[0].lastKillerId = prey.id;
    hunters[0].alive = false;
    tr.step(w, [
      { type: 'death', soldierId: hunters[0].id, pos: { ...hunters[0].pos } },
      { type: 'shot', soldierId: prey.id, weapon: 'marker_pump', pos: { ...prey.pos } },
      { type: 'spill', soldierId: prey.id, pos: { ...prey.pos } },
    ] as never, prey.id);
    expect(tr.record.splats).toBe(1);
    expect(tr.record.paintThrown).toBe(1);
    expect(tr.record.podSpills).toBe(1);
    expect(tr.record.longestSplat).toBeGreaterThan(0);
    expect(tr.record.longestSplatField).toBe('Kopje Court');
    expect(tr.record.offTheBreak, 'a splat this early is off the break').toBe(1);
  });

  it('a settled round lands in the 1v3 bucket — the crown-jewel split', () => {
    const { w, prey } = yardWorld();
    const tr = new FieldTracker('Redline', 'Kopje Court');
    tr.step(w, [], prey.id);
    // the referee banks a round for the prey's team
    w.mode.roundWins = [0, 1];
    tr.step(w, [], prey.id);
    expect(tr.record.rounds).toEqual({ played: 1, won: 1 });
    expect(tr.record.outnumbered['1v3']).toEqual({ rounds: 1, won: 1 });
  });

  it('EVERY round buckets, not just the first — the score line is not a whistle', () => {
    // Regression: the round-END announce ("ROUND 1 — PREY · 0–1") also starts
    // with "ROUND ", and matching it once re-snapshotted the roster with a
    // dead pack, nulling the bucket the round was ABOUT to settle into.
    const w = new World({ seed: PAINTBALL_FIELDS[0].seed, mode: 'paintball', theme: PAINTBALL_FIELDS[0].theme });
    const hunter = w.addSoldier('Hunter', 'infantry', 1, 'bot', { primary: 'marker_blitz' });
    const me = w.addSoldier('Redline', 'infantry', 0, 'human', { primary: 'marker_blitz' });
    w.step(1 / 60, new Map());
    const tr = new FieldTracker('Redline', 'Kopje Court');
    let killAt = 2, killed = 0;
    for (let i = 0; i < 60 * 60 && !w.mode.over; i++) {
      w.step(1 / 60, new Map());
      tr.step(w, w.takeEvents(), me.id);
      if (w.time > killAt && hunter.alive && killed < 3) {
        hunter.protectedUntil = 0;
        w.damageSoldier(hunter, 999, me.id, 'marker_blitz');
        killed++;
        killAt = w.time + 8;
      }
    }
    expect(tr.record.rounds).toEqual({ played: 3, won: 3 });
    expect(tr.record.outnumbered['1v1'], 'all three rounds land in the 1v1 bucket').toEqual({ rounds: 3, won: 3 });
  });

  it('a dummy is a lesson, not a splat — and never a Belt distance', () => {
    const { w, prey } = yardWorld();
    const tr = new FieldTracker('Redline', 'Kopje Court');
    tr.step(w, [], prey.id);
    const dummy = w.addSoldier('Ring-1', 'infantry', 0, 'dummy' as never);
    dummy.lastKillerId = prey.id;
    tr.step(w, [{ type: 'death', soldierId: dummy.id, pos: { ...dummy.pos } }] as never, prey.id);
    expect(tr.record.splats).toBe(0);
  });
});

describe('the Gauntlet ladder', () => {
  const fresh = () => ({ record: freshFieldRecord('Redline'), gauntlet: { rung: 1, lossesAtRung: 0, runStartAt: 1 } });

  it('a win climbs, banks depth, and calls the next rung', () => {
    const st = fresh();
    const line = advanceGauntlet(st, true);
    expect(st.gauntlet.rung).toBe(2);
    expect(st.record.gauntletDepth).toBe(1);
    expect(line).toContain('NEXT: 1v2');
  });

  it('two losses at a rung end the run — depth survives, the ladder resets', () => {
    const st = fresh();
    advanceGauntlet(st, true);  // rung 2
    advanceGauntlet(st, true);  // rung 3
    advanceGauntlet(st, false);
    expect(st.gauntlet.rung, 'one loss holds the rung').toBe(3);
    const line = advanceGauntlet(st, false);
    expect(line).toContain('THE RUN ENDS');
    expect(st.gauntlet.rung).toBe(1);
    expect(st.record.gauntletDepth, 'the banked depth outlives the run').toBe(2);
    expect(st.record.gauntletBestRun).toBe(2);
  });

  it('clearing all seven retires the run undefeated', () => {
    const st = fresh();
    let line = '';
    for (let i = 0; i < GAUNTLET_MAX; i++) line = advanceGauntlet(st, true);
    expect(line).toContain('THE GAUNTLET FALLS');
    expect(st.record.gauntletDepth).toBe(GAUNTLET_MAX);
    expect(st.gauntlet.rung, 'the ladder resets for the next legend').toBe(1);
  });
});

describe('the honors', () => {
  it('the Belt: first claim must clear the floor, then only the record moves it', () => {
    const st = freshTrophies();
    expect(checkBelt(st, 'Redline', BELT_FLOOR - 1, 'Kopje Court'), 'point blank never starts a lineage').toBeNull();
    const first = checkBelt(st, 'Redline', 31.4, 'Kopje Court');
    expect(first).toContain('SETS THE MARK');
    expect(holderOf(st.belt)).toBe('Redline');
    expect(checkBelt(st, 'Vex', 30.0, 'Kopje Court'), 'short of the record — no transfer').toBeNull();
    const taken = checkBelt(st, 'Vex', 33.1, 'Deck Nine');
    expect(taken).toContain('THE LONGBALL BELT MOVES');
    expect(holderOf(st.belt)).toBe('Vex');
    expect(beltRecord(st.belt)).toBeCloseTo(33.1, 1);
    // the ledger APPENDED — history is sacred
    expect(st.belt.reigns.length).toBe(2);
    expect(st.belt.reigns[1].takenFrom).toBe('Redline');
  });

  it('the Cup: vacant → claimed by a series win; lost only in a played series', () => {
    const { w, prey } = yardWorld();
    const st = freshTrophies();
    w.mode.over = true;
    w.mode.winner = prey.team;
    w.mode.roundWins = [1, 3];
    const claim = settleCup(st, w, prey.id, 'Kopje Court', false);
    expect(claim).toContain('CLAIMS THE YARD CUP');
    expect(holderOf(st.cup)).toBe('Redline');
    // defended — no new reign
    expect(settleCup(st, w, prey.id, 'Kopje Court', false)).toBeNull();
    expect(st.cup.reigns.length).toBe(1);
    // now the player LOSES a series while holding it — the enemy champion takes it
    const { w: w2, hunters: h2, prey: p2 } = yardWorld();
    h2[1].kills = 3; // the champion by splats
    w2.mode.over = true;
    w2.mode.winner = 0;
    w2.mode.roundWins = [3, 2];
    const loss = settleCup(st, w2, p2.id, 'Deck Nine', true);
    expect(loss).toContain('THE CUP IS LOST');
    expect(holderOf(st.cup)).toBe(h2[1].name);
    expect(st.cup.reigns[1].takenFrom).toBe('Redline');
    expect(st.cup.reigns[1].kind).toBe('gauntlet');
  });
});
