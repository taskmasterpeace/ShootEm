// ---------------------------------------------------------------------------
// FIREBRAND — zoner. §5's law: one brain file per LSW, deterministic,
// DOM-free. step() is the bot's cadence + passives; active() is the pilot's
// Q — it returns true only when the signature actually fired (a whiff keeps
// the key hot).
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** the board, cashed: every patch he painted erupts at once — shared by the
 *  bot brain's signal and the human pilot's Q */
function cashBoard(w: World, s: Soldier) {
  for (const g of w.gadgets.values()) {
    if (g.type === 'fire_field' && g.ownerId === s.id) {
      w.explode({ ...g.pos }, WEAPONS.gl, s.id, s.team);
    }
  }
  w.emit({ type: 'vo', text: 'vo_firebrand_ability', pos: { ...s.pos }, soldierId: s.id });
  w.emit({ type: 'lsw_active', pos: { ...s.pos }, text: 'firebrand', soldierId: s.id });
}

export function step(w: World, s: Soldier, _dt: number) {
  // PRIMARY: paint a burning trail under his own feet as he advances — the
  // floor he owns. One patch every ~0.5s while moving; each is a real
  // fire_field (it burns enemies who cross it, rain douses it).
  const moving = Math.hypot(s.vel.x, s.vel.z) > 1;
  if (moving && w.time >= (s.nextLswAt ?? 0)) {
    s.nextLswAt = w.time + 0.5;
    w.spawnGadget('fire_field', s.team, s.id, { ...s.pos }, Infinity, 9);
    w.emit({ type: 'shot', pos: s.pos, weapon: 'flamer', soldierId: s.id });
  }
  // SECONDARY (the board, cashed): the BOT brain raises `nextGrenadeAt` past
  // now to ask for the detonation (bots.ts watches for enemies standing on
  // the paint). A human pilot cashes it on Q — the brain never usurps a
  // player's timing.
  if (s.kind === 'bot' && s.grenades > 0 && w.time < (s.nextGrenadeAt ?? 0) - 90) {
    s.grenades = 0; // one board per stable of patches
    cashBoard(w, s);
  }
}

export function active(w: World, s: Soldier): boolean {
  // nothing painted = nothing to cash — keep the key hot
  let painted = false;
  for (const g of w.gadgets.values()) if (g.type === 'fire_field' && g.ownerId === s.id) { painted = true; break; }
  if (!painted) return false;
  cashBoard(w, s);
  return true;
}
