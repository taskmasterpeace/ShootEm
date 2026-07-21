// ---------------------------------------------------------------------------
// W3.4 PASS ESCALATION — the front's pass gates the stables at requestLsw
// (the ONE door every god walks through: human calls and the bot officer
// alike). P1 = the gods sleep; P2 = only the ENEMY stable (team 1) answers;
// P3/absent = both loose — every off-campaign match keeps today's behavior.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { lswsForTeam } from '../src/sim/lsw';
import { World } from '../src/sim/world';

function arena(lswPass?: 1 | 2 | 3) {
  const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0, lswPass });
  w.materiel[0] = 99999; w.materiel[1] = 99999; // the purse never says no here
  return w;
}
const pick = (team: 0 | 1) => lswsForTeam(team)[0];

describe('W3.4 — the pass gates the stables', () => {
  it('PASS 1: the gods sleep — neither stable answers', () => {
    const w = arena(1);
    expect(w.requestLsw(pick(0), 0)).toBe(false);
    expect(w.requestLsw(pick(1), 1)).toBe(false);
  });

  it('PASS 2: only THEIR stable answers — the war escalates AT you first', () => {
    const w = arena(2);
    expect(w.requestLsw(pick(0), 0), 'your stable stays shut').toBe(false);
    expect(w.requestLsw(pick(1), 1), 'theirs is awake').toBe(true);
  });

  it('PASS 3 and absent: both stables are loose (today\'s behavior)', () => {
    const w3 = arena(3);
    expect(w3.requestLsw(pick(0), 0)).toBe(true);
    const w = arena(); // absent — quick match off the campaign map
    expect(w.requestLsw(pick(1), 1)).toBe(true);
  });
});
