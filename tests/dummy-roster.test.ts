// ---------------------------------------------------------------------------
// F.1 — PEOPLE, NOT FURNITURE: a range dummy is a target, never a roster
// entry. Dummies inflated the paintball yard's headcount (the human drew
// HUNTER both rounds) and held squad-wipe checks "alive" after everyone
// fell. humansAndBots() excludes them at the source, so every roster read
// (prey pick, wipe checks, kill totals) agrees.
//
// CLONE INFECTION (spec × W3.3): a HOT death books its corpse AND a viral
// tally — the campaign vat pays double for every body that rose.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

describe('F.1 — dummies are not people', () => {
  it('humansAndBots leaves the furniture out of the roster', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const h = w.addSoldier('H', 'infantry', 0, 'human'); h.alive = true;
    const b = w.addSoldier('B', 'infantry', 1, 'bot'); b.alive = true;
    for (let i = 0; i < 3; i++) {
      const d = w.addSoldier(`D${i}`, 'infantry', 0, 'bot');
      d.alive = true; d.dummy = true; // range furniture on team 0
    }
    const roster = w.humansAndBots();
    expect(roster.length, 'two people, three targets').toBe(2);
    // the yard's prey math: team 0 counts ONE person, not four
    const count: [number, number] = [0, 0];
    for (const s of roster) count[s.team]++;
    expect(count[0]).toBe(1);
    expect(count[0] <= count[1], 'the human side reads SMALLER — the prey').toBe(true);
  });
});

describe('clone infection × the reinforcement economy', () => {
  it('a HOT death raises the viral tally; a clean death does not', () => {
    const w = new World({ seed: 42, mode: 'horde' });
    w.outbreakEnabled = true;
    const hot = w.addSoldier('HOT', 'infantry', 0, 'bot');
    hot.alive = true; hot.protectedUntil = 0; hot.viralLoad = 80;
    w.damageSoldier(hot, 999, -1, 'rifle');
    expect(w.viralDeaths[0], 'the vat pays for the risen body').toBe(1);
    const clean = w.addSoldier('CLEAN', 'infantry', 0, 'bot');
    clean.alive = true; clean.protectedUntil = 0;
    w.damageSoldier(clean, 999, -1, 'rifle');
    expect(w.viralDeaths[0], 'a clean death costs only the reprint').toBe(1);
  });
});
