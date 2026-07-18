// ---------------------------------------------------------------------------
// RAGEBEAST — bruiser. One brain file per LSW (§5), deterministic, DOM-free.
// Rampage (passive), the flesh-hurl (secondary), and the ground slam (Q).
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Projectile, Soldier } from '../types';
import type { World } from '../world';

export function step(w: World, s: Soldier, _dt: number) {
  // RAMPAGE: the lower his HP, the faster and harder he hits — burst him or
  // starve him, half-measures feed him. Pure scalars on shipped fields; the
  // "feed" is the missing-HP fraction, refreshed each tick.
  const missing = 1 - s.hp / s.maxHp;
  // rage is speed/damage, not immortality: the harness showed a 1.9x ceiling
  // let him out-trade an ENDLESS squad forever. Capped at 1.5x — a real,
  // mortal team still burns him down; the wound just makes the last quarter
  // of his HP the dangerous part.
  s.rageMul = 1 + missing * 0.5; // up to 1.5x wounded
  // THE FLESH-HURL (secondary, shipped): wounded past a quarter he TEARS his
  // own armored flesh — costing him HP — and hurls it as slow homing globs
  // that hunt the two nearest enemies. Starving the rage starves the ammo:
  // the wound IS the magazine.
  if (s.kind === 'bot' && missing > 0.25 && s.hp > 60 && w.time >= (s.nextLswAt ?? 0)) {
    const targets = [...w.soldiers.values()]
      .filter((e) => e.alive && e.team !== s.team && e.encasedUntil === undefined
        && Math.hypot(e.pos.x - s.pos.x, e.pos.z - s.pos.z) < WEAPONS.flesh_glob.range)
      .sort((a, b) => Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z) - Math.hypot(b.pos.x - s.pos.x, b.pos.z - s.pos.z))
      .slice(0, 2);
    if (targets.length) {
      s.hp -= 25; // the tear — flesh is not free
      for (const e of targets) {
        const ang = Math.atan2(e.pos.z - s.pos.z, e.pos.x - s.pos.x);
        const p: Projectile = {
          id: w.id(), weapon: 'flesh_glob', ownerId: s.id, team: s.team,
          pos: { x: s.pos.x, y: 1.4, z: s.pos.z },
          vel: { x: Math.cos(ang) * WEAPONS.flesh_glob.speed, y: 0, z: Math.sin(ang) * WEAPONS.flesh_glob.speed },
          bornAt: w.time, ttl: WEAPONS.flesh_glob.range / WEAPONS.flesh_glob.speed, arc: false,
          homingSoldierId: e.id,
        };
        w.launch(p);
      }
      w.emit({ type: 'shot', pos: { x: s.pos.x, y: 1.4, z: s.pos.z }, weapon: 'flesh_glob', soldierId: s.id });
      w.emit({ type: 'vo', text: 'vo_ragebeast_ability', pos: { ...s.pos }, soldierId: s.id });
      s.nextLswAt = w.time + 5;
    }
  }
}

export function active(w: World, s: Soldier): boolean {
  // GROUND SLAM: everyone close is hurt and THROWN — and like the rampage
  // itself, it hits harder the more he bleeds
  const mul = s.rageMul ?? 1;
  for (const e of w.soldiers.values()) {
    if (!e.alive || e.team === s.team || e.id === s.id) continue;
    const dx = e.pos.x - s.pos.x, dz = e.pos.z - s.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 7) continue;
    w.damageSoldier(e, 55 * mul * (1 - d / 9), s.id, 'gl');
    const inv = d > 0.01 ? 1 / d : 0;
    e.pushX += dx * inv * 26;
    e.pushZ += dz * inv * 26;
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'ragebeast', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_ragebeast_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}
