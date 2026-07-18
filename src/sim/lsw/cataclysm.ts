// ---------------------------------------------------------------------------
// CATACLYSM — siege boss, massive. One brain file per LSW (§5),
// deterministic, DOM-free. Huge slow area slams up close — and while he
// LIVES, seismic eruptions fire map-wide, WORSENING the longer he's up.
// He is a DPS check that punishes stalling: all-in focus is the counter,
// and the announcer counts the quakes you survived.
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

/** the quake interval: starts patient, ends relentless — stalling is the sin */
export function quakeInterval(uptime: number): number {
  return Math.max(2, 6 - uptime / 22.5); // 6s at birth, the 2s floor at 90s up
}

/** THE SLAM: huge, slow, close — the classic siege argument */
function slam(w: World, s: Soldier): boolean {
  let hit = 0;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id || e.encasedUntil !== undefined) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z, dd = Math.hypot(dx, dz);
    if (dd > 8) continue;
    w.damageSoldier(e, 60 * (1 - dd / 10), s.id, 'gl');
    const inv = dd > 0.01 ? 1 / dd : 0;
    e.pushX += dx * inv * 30; e.pushZ += dz * inv * 30;
    hit++;
  }
  if (hit) {
    w.emit({ type: 'explosion', pos: { ...s.pos }, weapon: 'gl' });
    w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'cataclysm', soldierId: s.id });
    w.emit({ type: 'vo', text: 'vo_cataclysm_ability', pos: { ...s.pos }, soldierId: s.id });
  }
  return hit > 0;
}

export function step(w: World, s: Soldier, _dt: number) {
  // THE WORSENING (any kind, while he lives): seismic eruptions map-wide.
  // nextBoltAt paces them; stormX carries the running count the announcer
  // reads; stormUntil stamps his birth (set once) so uptime is honest.
  if (s.stormUntil === undefined) { s.stormUntil = w.time; s.stormX = 0; }
  if (w.time >= (s.nextBoltAt ?? 0)) {
    s.nextBoltAt = w.time + quakeInterval(w.time - s.stormUntil);
    // the eruption finds a knot of the living — deterministic pick
    const targets = [...w.soldiers.values()].filter((e) => e.alive && e.team !== s.team && e.encasedUntil === undefined);
    if (targets.length) {
      const at = targets[w.rng.int(0, targets.length - 1)].pos;
      const ex = at.x + (w.rng.next() - 0.5) * 8, ez = at.z + (w.rng.next() - 0.5) * 8;
      for (const e of w.soldiers.values()) {
        if (!e.alive || e.team === s.team || e.encasedUntil !== undefined) continue;
        const dd = Math.hypot(e.pos.x - ex, e.pos.z - ez);
        if (dd > 6) continue;
        w.damageSoldier(e, 40 * (1 - dd / 8), s.id, 'gl');
      }
      w.emit({ type: 'explosion', pos: { x: ex, y: 0, z: ez }, weapon: 'gl' });
      s.stormX = (s.stormX ?? 0) + 1;
      // the announcer counts what you survived — every fifth quake, out loud
      if (s.stormX % 5 === 0) {
        w.emit({ type: 'hacked', pos: { x: ex, y: 0, z: ez }, soldierId: s.id, text: `QUAKE ${s.stormX} — CATACLYSM IS STILL UP` });
      }
    }
  }
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + (slam(w, s) ? 4 : 0.8);
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: the slam. The quakes need no key — LIVING is his second ability.
  return slam(w, s);
}
