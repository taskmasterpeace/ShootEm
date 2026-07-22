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
import { personaByName } from './personas';
import type { Soldier, Vec3 } from './types';
import type { World } from './world';

export type PbStyle = 'rusher' | 'flanker' | 'anchor';

/** The style is dealt from the id — same bot, same personality, all series. */
export function pbStyleFor(id: number): PbStyle {
  const r = hash01(id * 17 + 3);
  return r < 0.34 ? 'rusher' : r < 0.67 ? 'flanker' : 'anchor';
}

/** A persona DECLARES its style; anonymous bots draw from the id hash. */
export function pbStyleOf(s: Pick<Soldier, 'id' | 'pbStyle'>): PbStyle {
  return s.pbStyle ?? pbStyleFor(s.id);
}

/** Where a HUNTER wants to be, by personality. The return is an intent the
 *  bot's local steering resolves — walls still get walked around.
 *
 *  THE PACK HUNTS BY SIGHT, NOT SONAR: the chase runs on the team's
 *  last-seen mark of the prey, not its live position. Break line of sight
 *  in the maze and the pack converges on a GHOST — six quiet seconds and
 *  they give up the trail and fall back to cutting the tag circuit. This
 *  single rule is what makes the maze walls worth hiding behind. */
export function pbHuntObjective(w: World, s: Soldier, prey: Soldier): Vec3 {
  const mark = w.lastSeen[s.team as 0 | 1]?.get(prey.id);
  const stale = !mark || w.time - mark.t > 6;
  if (stale) {
    // trail's cold. Two jobs, split by personality: anchors/flankers DENY
    // the circuit (camp the pads the prey still needs), while rushers SWEEP
    // — rotating through the yard's hiding spots every few seconds. A pack
    // that only camps let the first AI probe stall into 120-second
    // hide-and-seek; the sweeper is what flushes the rabbit back into play.
    const anchorPos = mark ? { x: mark.x, z: mark.z } : w.map.hillPos;
    if (pbStyleOf(s) === 'rusher') {
      const beat = Math.floor(w.time / 7) + s.id;
      const [sx, sz] = EVADE_SPOTS[beat % EVADE_SPOTS.length];
      return { x: sx, y: 0, z: sz };
    }
    const open = w.mode.points?.filter((p) => p.owner !== prey.team) ?? [];
    if (open.length) {
      // spread by id so cold campers cover DIFFERENT pads
      return { ...open[s.id % open.length].pos };
    }
    return { x: anchorPos.x, y: 0, z: anchorPos.z };
  }
  // the mark is warm — hunt IT (fresh = the prey itself; lingering = where
  // they were when the wall took them out of view)
  const hx = mark.x, hz = mark.z;
  // y-channel contract: storey, never altitude (a hopping prey is ground floor)
  const py = prey.floor === 1 ? 4 : 0;
  const d = Math.hypot(hx - s.pos.x, hz - s.pos.z);
  const style = pbStyleOf(s);
  if (style === 'flanker' && d > 9) {
    // aim BESIDE the mark, perpendicular to the approach — the arc tightens
    // as the gap closes, so a flanker arrives from the wall, not the front
    const dx = hx - s.pos.x, dz = hz - s.pos.z;
    const l = d || 1;
    const side = s.id % 2 === 0 ? 1 : -1;
    const k = Math.min(10, d * 0.5) * side;
    return { x: hx + (-dz / l) * k, y: py, z: hz + (dx / l) * k };
  }
  if (style === 'anchor' && d > 10 && w.mode.points?.length) {
    // guard the circuit: stand on the open pad the prey most wants (the one
    // nearest their mark) — the prey's own win condition walks them into you
    const open = w.mode.points.filter((p) => p.owner !== prey.team);
    if (open.length) {
      let best = open[0], bd = Infinity;
      for (const p of open) {
        const pd = Math.hypot(p.pos.x - hx, p.pos.z - hz);
        if (pd < bd) { bd = pd; best = p; }
      }
      return { x: best.pos.x, y: 0, z: best.pos.z };
    }
  }
  // rusher — and every style once the range collapses: run the mark down
  return { x: hx, y: py, z: hz };
}

/** The rabbit's waiting spots: arena corners and mid-edges (world units,
 *  inside the fence). Evasion runs the ring; the maze lanes do the rest. */
const EVADE_SPOTS: [number, number][] = [
  [-36, -36], [36, -36], [-36, 36], [36, 36],
  [0, -36], [0, 36], [-36, 0], [36, 0],
];

/** Where the PREY wants to be. Two modes, and knowing which one you're in
 *  IS the prey brain: when an open pad sits genuinely unguarded, COMMIT to
 *  the tag run; when every pad is covered, EVADE — run the spot that
 *  stretches the pack thinnest and let the clock do the winning (§14: the
 *  prey wins by tags OR by outliving the whistle — evasion is scoring). */
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
  // an unguarded pad (or a dead pack) is a green light — go take the tag
  if (bestSafety > 15 || !hunters.length) return { ...best.pos };
  // every pad is covered: pull the pack across the yard instead of feeding
  // it — best spot balances "far from every hunter" against "I can get there"
  let ex = 0, ez = 0, bestScore = -Infinity;
  for (const [cx, cz] of EVADE_SPOTS) {
    let minH = Infinity;
    for (const h of hunters) minH = Math.min(minH, Math.hypot(cx - h.pos.x, cz - h.pos.z));
    const score = minH - Math.hypot(cx - s.pos.x, cz - s.pos.z) * 0.35;
    if (score > bestScore) { bestScore = score; ex = cx; ez = cz; }
  }
  return { x: ex, y: 0, z: ez };
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

/** One overhead bark, deterministic off (id, sim-time second). A PERSONA
 *  speaks its own script (src/sim/personas.ts); an anonymous bot borrows the
 *  style table. 'bark' events render as words hanging over the speaker's
 *  head (Robert: "I wanna SEE what they're saying"). */
export function pbBark(w: World, s: Soldier, moment: 'start' | 'splat' | 'taunt') {
  const persona = personaByName.get(s.name);
  const lines = persona
    ? persona.lines[moment]
    : BARKS[pbStyleOf(s)][moment === 'taunt' ? 'splat' : moment];
  const line = lines[Math.floor(hash01(s.id * 7 + Math.floor(w.time) * 13 + 1) * lines.length) % lines.length];
  w.emit({ type: 'bark', pos: { ...s.pos }, soldierId: s.id, text: line });
}

/** PROXIMITY TAUNTS (Robert: "they should be able to YELL at me when they're
 *  within distance"): a bot that closes on a living enemy HUMAN runs its
 *  mouth — once per mouth per cooldown, deterministic gate, no rng draws. */
export function pbProximityTaunts(w: World) {
  for (const s of w.humansAndBots()) {
    if (s.kind !== 'bot' || !s.alive || s.dummy) continue;
    if (w.time < (s.pbTauntAt ?? 0)) continue;
    for (const h of w.soldiers.values()) {
      if (h.kind !== 'human' || !h.alive || h.team === s.team) continue;
      const d = Math.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z);
      if (d < 14 && d > 2) {
        s.pbTauntAt = w.time + 9 + hash01(s.id * 3 + Math.floor(w.time)) * 5;
        pbBark(w, s, 'taunt');
        break;
      }
    }
  }
}
