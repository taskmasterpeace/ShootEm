// ---------------------------------------------------------------------------
// MIRAGE — trickster. One brain file per LSW (§5), deterministic, DOM-free.
// Up to three walking, fake-firing DECOYS wear his face; the swap teleports
// him into one of them. Which one is real?
// ---------------------------------------------------------------------------
import type { Soldier } from '../types';
import type { World } from '../world';

const MAX_DECOYS = 3;
const DECOY_LIFE = 6;

function myDecoys(w: World, s: Soldier): Soldier[] {
  return [...w.soldiers.values()].filter((d) => d.alive && d.decoyOf === s.id);
}

/** raise a decoy: one hit pops it, it makes no footsteps (the client knows),
 *  dogs are never fooled — but a rifleman across the street is. */
function decoy(w: World, s: Soldier): boolean {
  if (myDecoys(w, s).length >= MAX_DECOYS) return false;
  const d = w.addSoldier(s.name, s.classId, s.team, 'bot');
  d.decoyOf = s.id;
  d.pos = { x: s.pos.x + (w.rng.range(-2, 2)), y: 0, z: s.pos.z + w.rng.range(-2, 2) };
  d.alive = true; d.respawnAt = 0;
  d.hp = 1; d.maxHp = 1; // one bullet, one truth
  d.armor = 0; d.maxArmor = 0; // illusions wear no plate
  d.clip = d.clip.map(() => 0); d.reserve = d.reserve.map(() => 0); // fake fire only
  d.nextWarpAt = w.time; // the birth stamp — decoys age out on it
  w.emit({ type: 'blink', pos: { ...d.pos } });
  return true;
}

/** THE SWAP: trade places with the nearest decoy, instantly. */
function swap(w: World, s: Soldier): boolean {
  const ds = myDecoys(w, s);
  if (!ds.length) return false;
  ds.sort((a, b) => Math.hypot(a.pos.x - s.pos.x, a.pos.z - s.pos.z) - Math.hypot(b.pos.x - s.pos.x, b.pos.z - s.pos.z));
  const d = ds[0];
  const mine = { ...s.pos };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  s.pos = { x: d.pos.x, y: 0, z: d.pos.z };
  d.pos = mine;
  s.vel = { x: 0, y: 0, z: 0 };
  w.emit({ type: 'blink', pos: { ...s.pos } });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'mirage', soldierId: s.id });
  w.emit({ type: 'vo', text: 'vo_mirage_ability', pos: { ...s.pos }, soldierId: s.id });
  return true;
}

export function step(w: World, s: Soldier, _dt: number) {
  // decoys age out with a pop, and FAKE-FIRE on a cadence (muzzle theater,
  // no rounds — their clips are empty by construction)
  for (const d of myDecoys(w, s)) {
    if (w.time - (d.nextWarpAt ?? 0) > DECOY_LIFE) {
      d.protectedUntil = 0;
      w.damageSoldier(d, 9999, -1, 'bleedout'); // the illusion pops
      continue;
    }
    if (w.rng.next() < 0.04) w.emit({ type: 'shot', pos: { x: d.pos.x, y: 1.4, z: d.pos.z }, weapon: 'ar606', soldierId: d.id });
  }
  if (s.kind !== 'bot') return;
  if (w.time >= (s.nextLswAt ?? 0)) { s.nextLswAt = w.time + (decoy(w, s) ? 3 : 1); }
  if (w.time >= (s.nextLswActiveAt ?? 0) && s.hp < s.maxHp * 0.6 && swap(w, s)) s.nextLswActiveAt = w.time + 7;
}

export function active(w: World, s: Soldier): boolean {
  // Q: swap with the nearest decoy — or raise one if none stand.
  return swap(w, s) || decoy(w, s);
}
