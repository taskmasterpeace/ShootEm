// ---------------------------------------------------------------------------
// THE SHAMBLER TIDE (Robert: "right now it's a little bit of zombies and it
// slowly raises up — it needs to be A LOT of shamblers with very few of the
// quick ones"). The tide IS the peak: a sea of slow dead from the first
// minute, runners twice as rare as the horde's, each body softer because
// the MASS is the menace.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { isCoopMode, isZed } from '../src/sim/types';
import type { ModeId } from '../src/sim/types';
import { World } from '../src/sim/world';

function runOutbreak(mode: ModeId, seconds: number) {
  const w = new World({ seed: 77, mode, botsPerTeam: 0 });
  const witness = w.addSoldier('Witness', 'heavy', 0, 'human');
  w.spawn(witness);
  // keep the witness ALIVE the honest way — top up hp and scrub the strain
  // every tick. (A 1e9-hp witness survives the TURNING's 99999 overkill and
  // becomes a brute FACTORY — riseKind fires while the body walks. The game
  // can never do that; a probe must not either.)
  for (let i = 0; i < seconds * 30; i++) {
    witness.hp = witness.maxHp;
    witness.viralLoad = 0;
    w.step(1 / 30, new Map());
  }
  const zeds = [...w.soldiers.values()].filter((s) => s.alive && isZed(s.kind));
  return { w, zeds };
}

describe('the shambler tide', () => {
  it('is a coop outbreak mode with the horde machinery behind it', () => {
    expect(isCoopMode('tide')).toBe(true);
    const w = new World({ seed: 3, mode: 'tide', botsPerTeam: 0 });
    expect(w.outbreakEnabled, 'the outbreak systems arm for the tide').toBe(true);
  });

  it('floods immediately — the sea is in the streets while the horde is still a trickle', () => {
    const tide = runOutbreak('tide', 45);
    const horde = runOutbreak('horde', 45);
    expect(tide.zeds.length, 'the tide is a WALL by 45s').toBeGreaterThanOrEqual(40);
    expect(tide.zeds.length, 'and it dwarfs the horde at the same clock')
      .toBeGreaterThan(horde.zeds.length * 1.6);
  });

  it('is almost entirely shamblers — a runner is an event, not a pattern', () => {
    const { zeds } = runOutbreak('tide', 45);
    const shamblers = zeds.filter((z) => z.kind === 'zombie').length;
    expect(shamblers / zeds.length, 'the slow dead are the sea').toBeGreaterThan(0.9);
  });

  it('runs deterministic — same seed, same sea', () => {
    const a = runOutbreak('tide', 20);
    const b = runOutbreak('tide', 20);
    expect(a.zeds.length).toBe(b.zeds.length);
    expect(a.zeds.map((z) => z.kind)).toEqual(b.zeds.map((z) => z.kind));
  });
});
