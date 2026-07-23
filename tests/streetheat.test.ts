// ---------------------------------------------------------------------------
// STREET HEAT — the street's temper (GTA2's wanted level, neighbourly).
//
// Robert: *"create vigilante and pedestrian audio. think gta2."* The vigilante
// is not a mood, it is a LADDER: mayhem near civilians stokes a temper, and
// crossing each line makes the corner say something worse. These lock that
// ladder so a refactor can't quietly make the street shout at nothing — or
// never shout at all.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { DEFAULT_HEAT, StreetHeat } from '../src/client/streetheat';

describe('the street keeps score', () => {
  it('starts calm and silent', () => {
    const h = new StreetHeat();
    expect(h.heat).toBe(0);
    expect(h.stage).toBe(0);
    expect(h.hostile).toBe(false);
    expect(h.tick(0.5)).toBeNull();
  });

  it('stays silent while the mayhem is minor', () => {
    const h = new StreetHeat();
    h.provokeShot(); // one shot on the corner is not a riot
    expect(h.tick(0)).toBeNull();
    expect(h.hostile).toBe(false);
  });

  it('CHALLENGES once the temper crosses the line — and only once', () => {
    const h = new StreetHeat();
    h.provoke(DEFAULT_HEAT.challengeAt);
    expect(h.tick(0)).toBe('challenge');
    expect(h.stage).toBe(1);
    expect(h.hostile).toBe(true);
    // holding at the same temper does not re-shout
    expect(h.tick(0)).toBeNull();
  });

  it('climbs the ladder in order: challenge → warn → engage', () => {
    const h = new StreetHeat();
    const cries: (string | null)[] = [];
    // keep offending in small steps so every line is crossed in turn
    for (let i = 0; i < 40; i++) {
      h.provoke(0.06);
      const c = h.tick(0);
      if (c) cries.push(c);
    }
    expect(cries).toEqual(['challenge', 'warn', 'engage']);
  });

  it('a single atrocity can jump straight to a swing', () => {
    const h = new StreetHeat();
    h.provoke(DEFAULT_HEAT.engageAt + 0.1); // someone died
    expect(h.tick(0)).toBe('engage');
    expect(h.stage).toBe(3);
  });

  it('cools when you behave, and forgets — then can be angered again', () => {
    const h = new StreetHeat();
    h.provoke(DEFAULT_HEAT.challengeAt);
    expect(h.tick(0)).toBe('challenge');
    // walk away and let it cool right down
    for (let i = 0; i < 100; i++) h.tick(0.5);
    expect(h.heat).toBe(0);
    expect(h.stage).toBe(0);
    expect(h.hostile).toBe(false);
    // come back and do it again — the street challenges afresh
    h.provoke(DEFAULT_HEAT.challengeAt);
    expect(h.tick(0)).toBe('challenge');
  });

  it('never goes negative and never runs away', () => {
    const h = new StreetHeat();
    for (let i = 0; i < 50; i++) h.tick(1);
    expect(h.heat).toBe(0);
    for (let i = 0; i < 200; i++) h.provokeCasualty();
    expect(h.heat).toBeLessThanOrEqual(2);
  });

  it('the named provocations are ordered — a death outweighs a near-miss outweighs a shot', () => {
    expect(DEFAULT_HEAT.casualty).toBeGreaterThan(DEFAULT_HEAT.nearMiss);
    expect(DEFAULT_HEAT.nearMiss).toBeGreaterThan(DEFAULT_HEAT.shotNearby);
  });
});
