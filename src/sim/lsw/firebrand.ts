// ---------------------------------------------------------------------------
// FIREBRAND — zoner. §5's law: one brain file per LSW, deterministic,
// DOM-free. step() is the bot's cadence + passives; active() is the pilot's
// Q — it returns true only when the signature actually fired (a whiff keeps
// the key hot).
// ---------------------------------------------------------------------------
import { WEAPONS } from '../data';
import type { Soldier } from '../types';
import type { World } from '../world';

/** How long a painted patch burns. Robert: "the fire trail behind is a little
 *  long" — at 9s and one patch every 0.5s of walking, 18 patches lived at once
 *  and the ribbon ran ~80 units, most of it nowhere near the fight. Halved: a
 *  ~40u trail is still a road you own, and cashing it is a decision about
 *  WHERE you have been recently, not everywhere you have ever walked. */
const TRAIL_LIFE = 4.5;
/** the fire the eruption leaves behind — short, so the board is a play, not a
 *  permanent minefield he re-cashes every 8 seconds */
const RELIGHT_LIFE = 3.5;

/** the board, cashed: every patch he painted erupts at once — shared by the
 *  bot brain's signal and the human pilot's Q */
function cashBoard(w: World, s: Soldier) {
  // THE ERUPTION RELIGHTS THE GROUND (Robert: "the fireball things — they
  // should cause flame when he uses his special ability"). Cashing used to be
  // a one-frame bang that left nothing: the patches kept their old timers and
  // the ground you just erupted was as safe a second later as before. Now each
  // detonation reseeds its own tile, so a cashed board is an AREA DENIAL play
  // — the eruption is the damage, the fresh fire is the consequence.
  // Collected first: spawning inside the values() walk would re-erupt the new
  // patches in the same pass and chain the whole board into one frame.
  const board: { x: number; y: number; z: number }[] = [];
  for (const g of w.gadgets.values()) {
    if (g.type === 'fire_field' && g.ownerId === s.id) board.push({ ...g.pos });
  }
  for (const at of board) {
    w.explode({ ...at }, WEAPONS.gl, s.id, s.team);
    w.spawnGadget('fire_field', s.team, s.id, at, Infinity, RELIGHT_LIFE);
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
    w.spawnGadget('fire_field', s.team, s.id, { ...s.pos }, Infinity, TRAIL_LIFE);
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
