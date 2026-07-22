// ---------------------------------------------------------------------------
// PAINTBALL PLAY TYPES (Robert: "some AI logic for paintball — right now they
// just run right towards you… add different play types, 'cause our play types
// are gonna drive what they say").
//
// Every bot in the yard is dealt a STYLE off its id — pure function, no
// state, byte-identical every run:
//   RUSHER  — the old behavior, kept on purpose: straight down the throat.
//   FLANKER — swings wide on a perpendicular arc and closes from the wall.
//   ANCHOR  — sits on the tag circuit and lets the prey come to the paint.
// The prey got smarter too: it runs the SAFEST open pad (the one farthest
// from the nearest live hunter), not the first one on the list.
//
// And the style is a VOICE: short text barks at round start and over a fresh
// splat, emitted as positioned announces (the nameplate chip, not the big
// center text). The full VO treatment — generated speech per play type — is
// its own workstream (see the GitHub issue); these lines are its script.
// ---------------------------------------------------------------------------
import { hash01 } from './rng';
import type { Soldier, Vec3 } from './types';
import type { World } from './world';

export type PbStyle = 'rusher' | 'flanker' | 'anchor';

/** The style is dealt from the id — same bot, same personality, all series. */
export function pbStyleFor(id: number): PbStyle {
  const r = hash01(id * 17 + 3);
  return r < 0.34 ? 'rusher' : r < 0.67 ? 'flanker' : 'anchor';
}

/** Where a HUNTER wants to be, by personality. The return is an intent the
 *  bot's local steering resolves — walls still get walked around. */
export function pbHuntObjective(w: World, s: Soldier, prey: Soldier): Vec3 {
  // y-channel contract: storey, never altitude (a hopping prey is ground floor)
  const py = prey.floor === 1 ? 4 : 0;
  const d = Math.hypot(prey.pos.x - s.pos.x, prey.pos.z - s.pos.z);
  const style = pbStyleFor(s.id);
  if (style === 'flanker' && d > 9) {
    // aim BESIDE the prey, perpendicular to the approach — the arc tightens
    // as the gap closes, so a flanker arrives from the wall, not the front
    const dx = prey.pos.x - s.pos.x, dz = prey.pos.z - s.pos.z;
    const l = d || 1;
    const side = s.id % 2 === 0 ? 1 : -1;
    const k = Math.min(10, d * 0.5) * side;
    return { x: prey.pos.x + (-dz / l) * k, y: py, z: prey.pos.z + (dx / l) * k };
  }
  if (style === 'anchor' && d > 10 && w.mode.points?.length) {
    // guard the circuit: stand on the open pad the prey most wants (the one
    // nearest THEM) — the prey's own win condition walks them into you
    const open = w.mode.points.filter((p) => p.owner !== prey.team);
    if (open.length) {
      let best = open[0], bd = Infinity;
      for (const p of open) {
        const pd = Math.hypot(p.pos.x - prey.pos.x, p.pos.z - prey.pos.z);
        if (pd < bd) { bd = pd; best = p; }
      }
      return { x: best.pos.x, y: 0, z: best.pos.z };
    }
  }
  // rusher — and every style once the range collapses: take the shot
  return { x: prey.pos.x, y: py, z: prey.pos.z };
}

/** Where the PREY wants to be: the safest open pad — farthest from the
 *  nearest live hunter — or null when the circuit is fully tagged. */
export function pbPreyObjective(w: World, s: Soldier): Vec3 | null {
  const open = w.mode.points?.filter((p) => p.owner !== s.team) ?? [];
  if (!open.length) return null;
  const hunters = [...w.soldiers.values()]
    .filter((e) => e.alive && e.team !== s.team && (e.kind === 'human' || e.kind === 'bot'));
  let best = open[0], bestSafety = -Infinity;
  for (const p of open) {
    let safety = Infinity;
    for (const h of hunters) {
      safety = Math.min(safety, Math.hypot(p.pos.x - h.pos.x, p.pos.z - h.pos.z));
    }
    if (safety > bestSafety) { bestSafety = safety; best = p; }
  }
  return { ...best.pos };
}

// ---- the script: what each personality SAYS -------------------------------

const BARKS: Record<PbStyle, { start: string[]; splat: string[] }> = {
  rusher: {
    start: ['RUNNING IT — KEEP UP!', 'ON YOU IN THREE… TWO…', 'NO ANGLES. JUST SPEED.'],
    splat: ['TOO SLOW!', 'SHOULD\'VE KEPT RUNNING!', 'POINT BLANK. SORRY.'],
  },
  flanker: {
    start: ['SWINGING WIDE.', 'TAKING THE LONG WAY ROUND.', 'WATCH YOUR OFF SIDE.'],
    splat: ['NEVER SAW ME.', 'WRONG WALL, FRIEND.', 'THE LONG WAY PAYS.'],
  },
  anchor: {
    start: ['HOLDING THE PADS.', 'COME GET YOUR TAGS.', 'I\'LL BE RIGHT HERE.'],
    splat: ['MY PAD. MY PAINT.', 'YOU WALKED INTO IT.', 'TOLD YOU I\'D BE HERE.'],
  },
};

/** One positioned bark, deterministic off (id, sim-time second). */
export function pbBark(w: World, s: Soldier, moment: 'start' | 'splat') {
  const lines = BARKS[pbStyleFor(s.id)][moment];
  const line = lines[Math.floor(hash01(s.id * 7 + Math.floor(w.time) * 13 + 1) * lines.length) % lines.length];
  w.emit({ type: 'announce', pos: { ...s.pos }, soldierId: s.id, text: line, big: false });
}
