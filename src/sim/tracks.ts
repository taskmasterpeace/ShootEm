// ═══════════════════════════════════════════════════════════════════════════
// THE TRACK BUILDER — Racing Destruction Set's parts box, ours.
//
// Robert: *"you can build tracks… creating the track is just for me, the
// creator."* So this is the DATA and the RULES of a built track; the editor
// that drives it lives behind the Admin Room door (creator-only), and a
// finished track exports as JSON so it can ship with a build.
//
// RDS laid track from a box of PIECES, each with its own HEIGHT, WIDTH and
// PAVEMENT. Ours does the same — and because our floor materials already
// decide what a tyre does (the traction profile reads ice/dirt/paved), a
// piece's surface is not decoration: it is the corner's whole character.
//
// Pure data + pure geometry. No THREE, no DOM, no rng.
// ═══════════════════════════════════════════════════════════════════════════
import type { Vec3 } from './types';

/** The parts box. Each piece is a segment of route with a shape. */
export type PieceKind =
  | 'straight'   // the plain run
  | 'curve_l' | 'curve_r'
  | 'chicane'    // quick left-right — brakes and weight transfer
  | 'ramp_up' | 'ramp_down'
  | 'jump'       // a lip with a gap after it — the shock-strength test
  | 'bank_l' | 'bank_r'; // a banked turn: faster than it looks

/** What the piece is paved with. The traction profile reads this. */
export type Pavement = 'paved' | 'dirt' | 'ice';

export interface TrackPiece {
  kind: PieceKind;
  /** lane width in world units — narrow is a knife fight */
  width: number;
  /** terrain step this piece sits at (RDS's HEIGHT slider) */
  height: number;
  surface: Pavement;
}

export interface BuiltTrack {
  id: string;
  name: string;
  /** who laid it — the creator's name goes on the board */
  author: string;
  /** where the grid sits and which way the first piece runs */
  start: Vec3;
  startYaw: number;
  pieces: TrackPiece[];
  /** THE CAMERAS. Trackside points the broadcast cuts to. The creator drops
   *  them while laying the route; a track with none gets the two every circuit
   *  deserves (see `camerasFor`) — one on the START LINE and one out on the
   *  circuit where something usually happens. */
  cameras?: Vec3[];
  /** schema version, so a track file from today still loads later */
  version: 1;
}

/** The narrowest road a CAR can still take a corner on. Measured, not guessed:
 *  a full grid of cars/trucks/bikes strands below this and runs clean at or
 *  above it (tests/track-build.test.ts drives all four classes). */
export const RACEABLE_WIDTH = 20;

// 14 used to be the default and it was a car-trap: the field piled into the
// outside of every corner and three-quarters of the grid never finished a lap.
export const DEFAULT_PIECE: TrackPiece = { kind: 'straight', width: 22, height: 0, surface: 'paved' };

/** How far a piece carries the route, and how much it turns it. */
export const PIECE_SHAPE: Record<PieceKind, { run: number; turn: number; rise: number }> = {
  straight:   { run: 40, turn: 0, rise: 0 },
  curve_l:    { run: 34, turn: -Math.PI / 2, rise: 0 },
  curve_r:    { run: 34, turn: Math.PI / 2, rise: 0 },
  chicane:    { run: 38, turn: 0, rise: 0 },
  ramp_up:    { run: 30, turn: 0, rise: 1 },
  ramp_down:  { run: 30, turn: 0, rise: -1 },
  jump:       { run: 44, turn: 0, rise: 0 },
  bank_l:     { run: 36, turn: -Math.PI / 3, rise: 0 },
  bank_r:     { run: 36, turn: Math.PI / 3, rise: 0 },
};

export interface TrackNode {
  pos: Vec3;
  yaw: number;
  piece: TrackPiece;
  index: number;
}

/**
 * Walk a track into world nodes — the centre line, piece by piece. Pure and
 * deterministic: the same track is the same track on every machine, which is
 * what makes a lap RECORD mean anything.
 */
export function walkTrack(track: BuiltTrack): TrackNode[] {
  const nodes: TrackNode[] = [];
  let pos = { ...track.start };
  let yaw = track.startYaw;
  track.pieces.forEach((piece, index) => {
    const shape = PIECE_SHAPE[piece.kind] ?? PIECE_SHAPE.straight;
    // the node sits at the piece's ENTRY — you drive through it, then turn
    nodes.push({ pos: { ...pos }, yaw, piece, index });
    pos = {
      x: pos.x + Math.cos(yaw) * shape.run,
      y: pos.y + shape.rise * 4,
      z: pos.z + Math.sin(yaw) * shape.run,
    };
    yaw += shape.turn;
  });
  return nodes;
}

/** Does the route come back to its own grid? A circuit must CLOSE. */
export function trackCloses(track: BuiltTrack, tolerance = 30): boolean {
  const nodes = walkTrack(track);
  if (nodes.length < 3) return false;
  const last = nodes[nodes.length - 1];
  const shape = PIECE_SHAPE[last.piece.kind] ?? PIECE_SHAPE.straight;
  const end = {
    x: last.pos.x + Math.cos(last.yaw) * shape.run,
    z: last.pos.z + Math.sin(last.yaw) * shape.run,
  };
  return Math.hypot(end.x - track.start.x, end.z - track.start.z) <= tolerance;
}

/** Does it fit inside the world? A track that leaves the map is unfinishable. */
export function trackFits(track: BuiltTrack, halfExtent = 145): boolean {
  return walkTrack(track).every((n) => Math.abs(n.pos.x) < halfExtent && Math.abs(n.pos.z) < halfExtent);
}

export interface TrackProblem { kind: 'open' | 'offmap' | 'short' | 'nogrid' | 'narrow'; detail: string }

/** The editor's verdict line — what is wrong, in the creator's language. */
export function validateTrack(track: BuiltTrack): TrackProblem[] {
  const out: TrackProblem[] = [];
  if (track.pieces.length < 4) out.push({ kind: 'short', detail: 'A circuit needs at least four pieces.' });
  if (!trackFits(track)) out.push({ kind: 'offmap', detail: 'The route runs off the edge of the world.' });
  if (!trackCloses(track)) out.push({ kind: 'open', detail: 'The route never returns to the grid — a lap cannot be timed.' });
  if (!track.name.trim()) out.push({ kind: 'nogrid', detail: 'The track has no name.' });
  // A road a car cannot corner on is not a circuit, it is a trap — and the
  // creator cannot see it on the minimap, so the verdict has to say it.
  const tight = track.pieces.filter((p) => p.width < RACEABLE_WIDTH).length;
  if (tight) {
    out.push({
      kind: 'narrow',
      detail: `${tight} piece${tight === 1 ? '' : 's'} narrower than ${RACEABLE_WIDTH} — boards will thread it, but cars and trucks will pile into the corners.`,
    });
  }
  return out;
}

/** The checkpoints a built track hands the race mode — one per piece. The
 *  radius is the whole width plus a margin, so a car on the racing line always
 *  clears the gate (a stingy gate is a lap that never banks). */
export function checkpointsFor(track: BuiltTrack): { pos: Vec3; radius: number }[] {
  return walkTrack(track).map((n) => ({ pos: { ...n.pos }, radius: Math.max(10, n.piece.width * 0.9) }));
}

/**
 * THE CAMERAS A CIRCUIT GETS.
 *
 * Robert: *"have racing cameras at start and a random place… when building
 * tracks we should be able to select this."* So: whatever the creator authored
 * comes first, and every track is guaranteed the two that matter — the START
 * LINE, and one out on the circuit. The "random" one is picked by a hash of the
 * track id, so it is arbitrary but STABLE: the same track always cuts to the
 * same corner, which is what makes a circuit feel like a place.
 *
 * Cameras are pulled a little off the racing line so the shot looks across the
 * track rather than down at the roof of the car.
 */
export function camerasFor(track: BuiltTrack): Vec3[] {
  if (track.cameras?.length) return track.cameras.map((c) => ({ ...c }));
  const nodes = walkTrack(track);
  if (!nodes.length) return [{ ...track.start }];
  const offset = (n: TrackNode, by: number): Vec3 => ({
    x: n.pos.x - Math.sin(n.yaw) * by, y: 0, z: n.pos.z + Math.cos(n.yaw) * by,
  });
  let h = 0;
  for (let i = 0; i < track.id.length; i++) h = (h * 31 + track.id.charCodeAt(i)) >>> 0;
  // index 1.. so the "random" camera can never land back on the start line and
  // give the circuit two cameras pointing at the same piece of tarmac
  const far = nodes.length > 1 ? nodes[1 + (h % (nodes.length - 1))] : nodes[0];
  return [offset(nodes[0], 16), offset(far, 16)];
}

/** A ready-made oval, so the editor opens on something drivable. */
export function starterOval(author = 'THE CREATOR'): BuiltTrack {
  const P = (kind: PieceKind, over: Partial<TrackPiece> = {}): TrackPiece => ({ ...DEFAULT_PIECE, kind, ...over });
  return {
    id: 'oval', name: 'Proving Oval', author, version: 1,
    start: { x: -70, y: 0, z: -60 }, startYaw: 0,
    pieces: [
      P('straight'), P('straight'), P('curve_r'), P('straight'),
      P('curve_r'), P('straight'), P('straight'), P('curve_r'),
      P('straight'), P('curve_r'),
    ],
  };
}

// ── the creator's shelf (client persists; this is the shape) ───────────────
export interface TrackLibrary { tracks: BuiltTrack[] }

export function exportTrack(track: BuiltTrack): string {
  return JSON.stringify(track, null, 2);
}

export function importTrack(json: string): BuiltTrack | null {
  try {
    const t = JSON.parse(json) as BuiltTrack;
    if (!t || !Array.isArray(t.pieces) || !t.start) return null;
    return {
      id: String(t.id ?? 'imported'),
      name: String(t.name ?? 'Imported Track'),
      author: String(t.author ?? 'UNKNOWN'),
      start: { x: +t.start.x || 0, y: 0, z: +t.start.z || 0 },
      startYaw: +t.startYaw || 0,
      version: 1,
      ...(Array.isArray(t.cameras) && t.cameras.length
        ? { cameras: t.cameras.filter((c) => c && Number.isFinite(+c.x) && Number.isFinite(+c.z))
            .map((c) => ({ x: +c.x, y: 0, z: +c.z })) }
        : {}),
      pieces: t.pieces.filter((p) => !!PIECE_SHAPE[p?.kind]).map((p) => ({
        kind: p.kind,
        width: Math.max(6, Math.min(30, +p.width || DEFAULT_PIECE.width)),
        height: Math.max(0, Math.min(2, +p.height || 0)),
        surface: (['paved', 'dirt', 'ice'] as Pavement[]).includes(p.surface) ? p.surface : 'paved',
      })),
    };
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE CIRCUIT'S CHARACTER — what kind of racetrack this is.
//
// Last cycle gave the procedural circuit a real SHAPE (510–724u, 10–13 gates,
// every one a different ribbon). But a venue that varies and cannot say how is
// still not a place: the league had seven different racetracks and one
// description. A sport talks about its circuits — the fast one, the twisty one,
// the one with the long back straight — and that talk is most of what makes a
// fixture list feel like a season instead of a queue.
//
// THE CHARACTER IS MEASURED, NEVER ASSIGNED. Every figure here is read off the
// checkpoint ring itself, so a circuit cannot be described as a flowing sweeper
// while actually being a knot of hairpins — the same law the reticle and the
// service file were repaired under. Author a track in the builder or roll one
// from a seed; either way the description is the truth about the tarmac.
//
// Pure: geometry in, words out. No rng, no clock, no DOM.
// ═══════════════════════════════════════════════════════════════════════════

export type CircuitCharacter = 'sweeper' | 'technical' | 'balanced';

export interface CircuitProfile {
  /** one lap of the centreline, world units */
  length: number;
  gates: number;
  /** the longest run between two gates — the overtaking place */
  longestStraight: number;
  /** degrees of steering per unit of track: the whole fast/twisty axis */
  turnPerUnit: number;
  /** corners past ~40°, the ones you have to brake for */
  hardCorners: number;
  character: CircuitCharacter;
  /** the one line the sports desk reads out */
  strap: string;
}

/** measured on seven seeds: 0.54 (flowing) … 0.74 (twisty) */
const SWEEPER_MAX = 0.60;
const TECHNICAL_MIN = 0.66;

/**
 * Read a circuit off its own checkpoint ring.
 *
 * Works for procedural circuits and hand-built ones alike, because both end up
 * as the same ordered loop of gates — which is exactly why the description can
 * be trusted for a track somebody laid by hand in the builder.
 */
export function circuitProfile(cps: Array<{ pos: { x: number; z: number } }>): CircuitProfile {
  const N = cps.length;
  if (N < 3) {
    return { length: 0, gates: N, longestStraight: 0, turnPerUnit: 0, hardCorners: 0,
      character: 'balanced', strap: 'An unfinished circuit.' };
  }
  let length = 0;
  let longestStraight = 0;
  let sumTurn = 0;
  let hardCorners = 0;
  for (let i = 0; i < N; i++) {
    const a = cps[i].pos;
    const b = cps[(i + 1) % N].pos;
    const c = cps[(i + 2) % N].pos;
    const seg = Math.hypot(b.x - a.x, b.z - a.z);
    length += seg;
    if (seg > longestStraight) longestStraight = seg;
    const h1 = Math.atan2(b.z - a.z, b.x - a.x);
    const h2 = Math.atan2(c.z - b.z, c.x - b.x);
    let d = Math.abs(h2 - h1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    sumTurn += d;
    if (d > 0.7) hardCorners++;          // ~40°: a corner you brake for
  }
  const turnPerUnit = length > 0 ? (sumTurn * 180) / Math.PI / length : 0;
  const character: CircuitCharacter = turnPerUnit <= SWEEPER_MAX ? 'sweeper'
    : turnPerUnit >= TECHNICAL_MIN ? 'technical' : 'balanced';

  return {
    length: Math.round(length),
    gates: N,
    longestStraight: Math.round(longestStraight),
    turnPerUnit: Math.round(turnPerUnit * 100) / 100,
    hardCorners,
    character,
    strap: strapFor(character, Math.round(length), Math.round(longestStraight), hardCorners),
  };
}

/** The sports desk's own words for a circuit. */
function strapFor(c: CircuitCharacter, length: number, straight: number, hard: number): string {
  const long = length >= 640 ? 'A long ' : length <= 520 ? 'A short ' : 'A ';
  if (c === 'sweeper') {
    return `${long}flowing circuit — ${straight}u of open road to slipstream down, and only ${hard} corner${hard === 1 ? '' : 's'} worth braking for.`;
  }
  if (c === 'technical') {
    return `${long}technical circuit — ${hard} corners you have to brake for, and nowhere much to make it back.`;
  }
  return `${long}circuit with a bit of everything — ${hard} real corner${hard === 1 ? '' : 's'} and ${straight}u to have a go down.`;
}

/** The short label a fixture list or a marquee uses. */
export const CHARACTER_LABEL: Record<CircuitCharacter, string> = {
  sweeper: 'FAST SWEEPER',
  technical: 'TECHNICAL',
  balanced: 'MIXED',
};

// ═══════════════════════════════════════════════════════════════════════════
// EVERY CIRCUIT HAS A NAME.
//
// The venues vary (last-but-one cycle) and describe themselves (last cycle) —
// but they all still filed under one id, `savanna-circuit`. So the flowing 666u
// sweeper and the technical 486u loop overwrote each other on the record board,
// and the standings could not tell two racetracks apart. A record with no venue
// is not a record; it is the last person to drive.
//
// The name is DERIVED from the seed, so it is stable (a circuit is the same
// circuit and the same NAME every time it comes up) and needs no store. It is
// built to sound like a real circuit — a PLACE and a TYPE — and the type half
// is pulled from the same character measurement the desk already trusts, so the
// name never lies about the tarmac: a circuit called "…SWEEP" really flows.
//
// Pure: a seed and a character in, a name and an id out.
// ═══════════════════════════════════════════════════════════════════════════

/** the place half — evocative, generic enough to never read as a real town */
const CIRCUIT_PLACES = [
  'REDLINE', 'DUSTBOWL', 'IRONWORKS', 'THE BASIN', 'HIGHSIDE', 'SALT FLATS',
  'THE GANTRY', 'BLACKPAN', 'COPPERHEAD', 'THE CAULDRON', 'DEADMAN', 'THE SPUR',
  'GRAVEL PIT', 'THE STACK', 'LONGACRE', 'THE KETTLE', 'RUSTMOUTH', 'THE ANVIL',
  'HOLLOW RUN', 'THE MARROWS',
] as const;

/** the type half — reads off the circuit's measured character */
const CIRCUIT_TYPES: Record<CircuitCharacter, readonly string[]> = {
  sweeper: ['SWEEP', 'FLYER', 'CURVE', 'MILE'],
  technical: ['TWIST', 'KNOT', 'MAZE', 'SNAKE'],
  balanced: ['CIRCUIT', 'LOOP', 'RING', 'RUN'],
};

/** a small deterministic hash so the name is stable per seed, no rng draw */
function nameHash(seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

export interface CircuitName {
  /** the venue's proper name — "COPPERHEAD SWEEP" */
  name: string;
  /** the stable board key — "copperhead-sweep" (record rows hang off this) */
  id: string;
}

/**
 * Name a circuit from its seed and its measured character.
 *
 * The place is picked by the seed alone, so it never moves; the type is picked
 * from the character band, so a sweeper is called a sweep and a hairpin knot is
 * called a knot. Two halves, one hash offset apart, so "REDLINE SWEEP" and
 * "REDLINE KNOT" are different venues that can share a place name the way real
 * circuits share a town.
 */
export function circuitName(seed: number, character: CircuitCharacter): CircuitName {
  const h = nameHash(seed);
  const place = CIRCUIT_PLACES[h % CIRCUIT_PLACES.length];
  const types = CIRCUIT_TYPES[character];
  const type = types[(h >>> 8) % types.length];
  const name = `${place} ${type}`;
  return { name, id: name.toLowerCase().replace(/\s+/g, '-') };
}
