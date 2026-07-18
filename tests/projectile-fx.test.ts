import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';
import { WEAPONS } from '../src/sim/data';
import type { Projectile } from '../src/sim/types';

// helper: launch a bare projectile aimed +x from origin
function shot(w: World, weapon: string, over: Partial<Projectile> = {}) {
  return w.launch({
    id: w.id(), weapon, ownerId: -1, team: 0,
    pos: { x: 0, y: 1.2, z: 0 }, vel: { x: 60, y: 0, z: 0 },
    bornAt: w.time, ttl: 3, arc: false, ...over,
  } as Projectile);
}

describe('launch copies effect flags from the weapon def', () => {
  it('a pierce weapon hands its projectile the pierce count', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    (WEAPONS.lsw_pulse as { pierce?: number }).pierce = 3; // arrange
    const p = shot(w, 'lsw_pulse');
    expect(p.pierce).toBe(3);
  });

  it('defaults dmgMul to 1 on every round', () => {
    const w = new World({ seed: 1, mode: 'tdm' });
    const p = shot(w, 'ar606');
    expect(p.dmgMul).toBe(1);
  });
});
