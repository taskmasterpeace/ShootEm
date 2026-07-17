// ---------------------------------------------------------------------------
// THE WAR'S SCORE (music.ts) — Robert's three-tier soundtrack law: soldier
// combat plays until a Living Super Weapon enters the story; the REAL
// monsters (threat 3+) get completely different music. The dread starts at
// the ANNOUNCEMENT — an inbound pod flips the score during the telegraph.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { L5_THREAT, musicTierFor } from '../src/client/music';
import { LSWS } from '../src/sim/lsw';
import { World } from '../src/sim/world';

describe('the score follows the field', () => {
  it('ordinary combat plays the soldier tier', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    expect(musicTierFor(w)).toBe('soldier');
  });

  it('a walking low-threat LSW turns the LSW score on', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    w.addLsw('voltstriker', 0, { x: 0, y: 0, z: 0 }); // T1
    expect(musicTierFor(w)).toBe('lsw');
  });

  it('a SIEGE-class monster gets the l5 score — completely different music', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    expect(LSWS.titan.threat).toBeGreaterThanOrEqual(L5_THREAT); // the premise
    w.addLsw('titan', 0, { x: 0, y: 0, z: 0 });
    expect(musicTierFor(w)).toBe('l5');
  });

  it('the dread starts at the announcement — an inbound pod flips the score', () => {
    const w = new World({ seed: 42, mode: 'ctf', botsPerTeam: 0 });
    expect(musicTierFor(w)).toBe('soldier');
    expect(w.requestLsw('titan', 0)).toBe(true); // announced, not yet landed
    expect(musicTierFor(w), 'the telegraph must already carry the music').toBe('l5');
  });

  it('a dead LSW hands the score back to the soldiers', () => {
    const w = new World({ seed: 42, mode: 'tdm', botsPerTeam: 0 });
    const t = w.addLsw('titan', 0, { x: 0, y: 0, z: 0 })!;
    t.protectedUntil = 0;
    w.damageSoldier(t, 99999, -1, 'ar606');
    expect(t.alive).toBe(false);
    expect(musicTierFor(w)).toBe('soldier');
  });
});
