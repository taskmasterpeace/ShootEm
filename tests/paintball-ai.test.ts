// ---------------------------------------------------------------------------
// THE YARD AI IS COMPETENT (Robert: "I want you to run some tests and get
// the AI really good at paintball"). These are full bot-vs-bot SERIES run
// headless: they prove the pack can hunt through the maze, the prey can
// survive and score, nobody deadlocks in a hallway, and the paintball verbs
// (dashes, serpentine) actually fire. If a maze change strands the AI, this
// file goes red before any human ever walks the yard.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { PAINTBALL_FIELDS } from '../src/sim/map';
import { WEAPONS } from '../src/sim/data';
import { World } from '../src/sim/world';
import type { WeaponId } from '../src/sim/types';

/** A full bot yard: 3-bot pack (team 0) vs 1-bot prey (team 1), yard law imposed. */
function botYard(seed: number, theme: (typeof PAINTBALL_FIELDS)[number]['theme']) {
  const w = new World({ seed, mode: 'paintball', theme });
  const packMarkers: WeaponId[] = ['marker_blitz', 'marker_scatter', 'marker_lobber'];
  for (let i = 0; i < 3; i++) w.addSoldier(`Hunter${i}`, 'infantry', 0, 'bot', { primary: packMarkers[i] });
  w.addSoldier('Prey', 'infantry', 1, 'bot', { primary: 'marker_pump' });
  w.step(1 / 60, new Map());
  for (const s of w.humansAndBots()) {
    const marker = s.weapons[0];
    s.weapons = [marker];
    s.clip = [WEAPONS[marker].clip];
    s.reserve = [WEAPONS[marker].reserve];
    s.weaponIdx = 0;
    s.grenades = 2;
    s.smokes = 0; s.firebombs = 0; s.concs = 0; s.gravs = 0; s.plasmas = 0; s.timebombs = 0;
  }
  return w;
}

describe('bot-vs-bot series across the fields', () => {
  // aggregated across ALL fields so a single lopsided seed can't flake the
  // suite — but every individual series must FINISH (no deadlock, ever)
  it('every series finishes, both sides win rounds, and the maze gets navigated', () => {
    let packRounds = 0, preyRounds = 0, tags = 0, dashes = 0;
    for (const f of PAINTBALL_FIELDS) {
      const w = botYard(f.seed, f.theme);
      const cap = 14 * 60 * 60; // a best-of-5 of 2-minute rounds fits well inside
      let steps = 0;
      while (!w.mode.over && steps < cap) {
        w.step(1 / 60, new Map());
        for (const e of w.takeEvents()) {
          if (e.type === 'announce' && e.text?.includes('TAGGED')) tags++;
          if (e.type === 'dash') dashes++;
        }
        steps++;
      }
      expect(w.mode.over, `${f.name}: the series must END (no hallway deadlock)`).toBe(true);
      const wins = w.mode.roundWins ?? [0, 0];
      packRounds += wins[0];
      preyRounds += wins[1];
    }
    expect(packRounds, 'the pack can actually hunt').toBeGreaterThan(0);
    expect(preyRounds, 'the prey can actually survive').toBeGreaterThan(0);
    expect(dashes, 'the yard verbs get SPENT — bots dash and roll').toBeGreaterThan(0);
    // the prey navigating the maze to a pad at least once across three
    // fields is the floor of "the maze is walkable by the AI"
    expect(tags, 'the prey works the tag circuit through the maze').toBeGreaterThan(0);
  });
});
