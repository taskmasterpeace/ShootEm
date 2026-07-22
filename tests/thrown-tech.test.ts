// ---------------------------------------------------------------------------
// NEW THROWN TECH (Robert): the singularity grenade, the plasma stick, and the
// planted time bomb. Each is built on shipped substrate — force-fields, the
// pendingBlasts scheduler, projectile attach, gadgets — so it stays
// deterministic and cheap. Enemies here are HUMANS (no bot brain) so the only
// force on them is the one under test.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { World } from '../src/sim/world';

const step = (w: World, secs: number) => {
  for (let i = 0; i < Math.round(secs * 60); i++) { w.step(1 / 60, new Map()); w.takeEvents(); }
};

describe('grav grenade — the singularity', () => {
  it('the gravity well YANKS enemies toward the epicenter', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 40, y: 0, z: 40 };
    const e1 = w.addSoldier('E1', 'infantry', 1, 'human'); e1.pos = { x: 5, y: 0, z: 0 };
    const e2 = w.addSoldier('E2', 'infantry', 1, 'human'); e2.pos = { x: -4, y: 0, z: 3 };
    const d1 = Math.hypot(e1.pos.x, e1.pos.z), d2 = Math.hypot(e2.pos.x, e2.pos.z);
    // open the well exactly as the grav payload does
    w.forceFields.push({ x: 0, z: 0, r: 6.5, radial: -16, team: 0, ownerId: t.id, until: w.time + 1.2 });
    step(w, 1.0);
    expect(Math.hypot(e1.pos.x, e1.pos.z), 'E1 dragged inward').toBeLessThan(d1 - 1);
    expect(Math.hypot(e2.pos.x, e2.pos.z), 'E2 dragged inward').toBeLessThan(d2 - 1);
  });

  it('a scheduled blast fires on its clock, not before (pendingBlasts)', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const o = w.addSoldier('O', 'infantry', 0, 'human'); o.pos = { x: 40, y: 0, z: 0 };
    const e = w.addSoldier('E', 'infantry', 1, 'human'); e.pos = { x: 0, y: 0, z: 0 }; e.armor = 0;
    const hp0 = e.hp;
    w.pendingBlasts.push({ x: 0, y: 0, z: 0, at: w.time + 1.0, weapon: 'grav_nade', ownerId: o.id, team: 0 });
    step(w, 0.5);
    expect(e.hp, 'still ticking — no boom yet').toBe(hp0);
    step(w, 0.8);
    expect(e.hp, 'the implosion collapsed on the pile').toBeLessThan(hp0);
    expect(w.pendingBlasts.length, 'the blast is spent, not re-firing').toBe(0);
  });

  it('throwing a grav_nade opens a well where it lands (payload wiring)', () => {
    const w = new World({ seed: 3, mode: 'tdm', matchMinutes: 10 });
    const t = w.addSoldier('T', 'infantry', 0, 'human'); t.pos = { x: 0, y: 0, z: 0 }; t.yaw = 0;
    w.throwProjectile(t, 'grav_nade', 1.4, 16, true, 20, 1, true);
    let welled = false;
    for (let i = 0; i < 240 && !welled; i++) {
      w.step(1 / 60, new Map());
      for (const ev of w.takeEvents()) if (ev.type === 'grav_well') welled = true;
    }
    expect(welled, 'the singularity opened').toBe(true);
    expect(w.pendingBlasts.length, 'and armed its implosion').toBeGreaterThan(0);
  });
});
