// ---------------------------------------------------------------------------
// SPECTER — trickster. One brain file per LSW (§5), deterministic, DOM-free.
// Mirror images of himself CONVERGE on the enemy (decoys with legs — the
// shared decoy system walks them); ALL IMAGES DETONATE ON COMMAND.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

const MAX_IMAGES = 3;

function images(w: World, s: Soldier): Soldier[] {
  return [...w.soldiers.values()].filter((d) => d.alive && d.decoyOf === s.id);
}

/** raise a mirror image — 1 hp, no plate, walks and hunts like a bot */
function mirror(w: World, s: Soldier): boolean {
  if (images(w, s).length >= MAX_IMAGES) return false;
  const d = w.addSoldier(s.name, s.classId, s.team, 'bot');
  d.decoyOf = s.id;
  d.pos = { x: s.pos.x + w.rng.range(-2, 2), y: 0, z: s.pos.z + w.rng.range(-2, 2) };
  d.alive = true; d.respawnAt = 0;
  d.hp = 1; d.maxHp = 1;
  d.armor = 0; d.maxArmor = 0;
  d.clip = d.clip.map(() => 0); d.reserve = d.reserve.map(() => 0);
  d.nextWarpAt = w.time; // the birth stamp
  w.emit({ type: 'blink', pos: { ...d.pos } });
  return true;
}

/** THE COMMAND: every image detonates at once — the guessing game has a fuse */
function detonate(w: World, s: Soldier): boolean {
  const ds = images(w, s);
  if (!ds.length) return false;
  for (const d of ds) {
    const at = { x: d.pos.x, y: 0, z: d.pos.z };
    d.protectedUntil = 0;
    w.damageSoldier(d, 9999, -1, 'bleedout'); // the image pops...
    w.explode(at, WEAPONS.gl, s.id, s.team);  // ...and takes the room with it
  }
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'specter', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_specter_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // aged images fade quietly (no blast — the blast is the COMMAND)
  for (const d of images(w, s)) {
    if (w.time - (d.nextWarpAt ?? 0) > 8) { d.protectedUntil = 0; w.damageSoldier(d, 9999, -1, 'bleedout'); }
  }
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (mirror(w, s) ? 2.5 : 1); }
  // the bot cashes the images when enemies stand among them
  if (w.time >= (s.nextLswActiveAt ?? 0)) {
    const ds = images(w, s);
    let among = false;
    for (const d of ds) {
      for (const e of w.soldiers.values()) {
        if (e.alive && e.team !== s.team && e.decoyOf === undefined && Math.hypot(e.pos.x - d.pos.x, e.pos.z - d.pos.z) < 5) { among = true; break; }
      }
      if (among) break;
    }
    if (among && detonate(w, s)) s.nextLswActiveAt = w.time + 8;
  }
}

export function active(w: World, s: Soldier): boolean {
  // Q: detonate every image — or raise one if none stand.
  return detonate(w, s) || mirror(w, s);
}
