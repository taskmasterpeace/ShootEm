// ---------------------------------------------------------------------------
// READ THE RING, the drill's laws: three dummies at the right fractions, the
// lesson lands on the first dummy the PLAYER bleeds, and the yard folds
// after — no leftovers interfering with the hunt.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { RingDrill } from '../src/client/ringdrill';
import { World } from '../src/sim/world';
import type { SimEvent } from '../src/sim/types';

function setup() {
  const world = new World({ seed: 42, mode: 'paintball', botsPerTeam: 0 });
  const me = world.addSoldier('me', 'infantry', 0, 'human');
  const lines: string[] = [];
  const drill = new RingDrill((t, big) => lines.push(big ? `BIG:${t}` : t));
  drill.begin(world, me.id);
  return { world, me, drill, lines };
}

const hit = (victim: number, owner: number): SimEvent => ({ type: 'hit', soldierId: victim, ownerId: owner });

describe('READ THE RING — the boot-camp station', () => {
  it('three dummies spawn at full / two-thirds / a sliver, on the player team', () => {
    const { world } = setup();
    const rings = [...world.soldiers.values()].filter((s) => s.name.startsWith('RING-'));
    expect(rings.length).toBe(3);
    expect(rings.every((s) => s.dummy && s.team === 0)).toBe(true);
    const fracs = rings.map((s) => s.hp / s.maxHp).sort((a, b) => a - b);
    expect(fracs[0]).toBeCloseTo(0.15, 2);
    expect(fracs[1]).toBeCloseTo(2 / 3, 2);
    expect(fracs[2]).toBeCloseTo(1, 2);
  });

  it('splatting the sliver first lands the praise — and folds the other two', () => {
    const { world, me, drill, lines } = setup();
    const rings = [...world.soldiers.values()].filter((s) => s.name.startsWith('RING-'));
    const sliver = rings.find((s) => s.hp / s.maxHp < 0.2)!;
    drill.update(world, me.id, [hit(sliver.id, me.id)]);
    expect(lines.some((l) => l.includes("That's the read"))).toBe(true);
    expect(lines.some((l) => l.includes('chunks') && l.includes('grade') && l.includes('truth'))).toBe(true);
    const others = rings.filter((s) => s.id !== sliver.id);
    expect(others.every((s) => !s.alive)).toBe(true);
  });

  it('splatting the wrong one first lands the lesson instead', () => {
    const { world, me, drill, lines } = setup();
    const rings = [...world.soldiers.values()].filter((s) => s.name.startsWith('RING-'));
    const full = rings.find((s) => s.hp / s.maxHp > 0.9)!;
    drill.update(world, me.id, [hit(full.id, me.id)]);
    expect(lines.some((l) => l.includes('The ring told you'))).toBe(true);
  });

  it('another player bleeding a dummy teaches nothing and breaks nothing', () => {
    const { world, me, drill, lines } = setup();
    const rings = [...world.soldiers.values()].filter((s) => s.name.startsWith('RING-'));
    drill.update(world, me.id, [hit(rings[0].id, me.id + 999)]);
    expect(lines.length).toBe(1); // only the briefing line
    expect(rings.every((s) => s.alive)).toBe(true);
  });
});
