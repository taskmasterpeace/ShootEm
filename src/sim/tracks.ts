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
  /** schema version, so a track file from today still loads later */
  version: 1;
}

export const DEFAULT_PIECE: TrackPiece = { kind: 'straight', width: 14, height: 0, surface: 'paved' };

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

export interface TrackProblem { kind: 'open' | 'offmap' | 'short' | 'nogrid'; detail: string }

/** The editor's verdict line — what is wrong, in the creator's language. */
export function validateTrack(track: BuiltTrack): TrackProblem[] {
  const out: TrackProblem[] = [];
  if (track.pieces.length < 4) out.push({ kind: 'short', detail: 'A circuit needs at least four pieces.' });
  if (!trackFits(track)) out.push({ kind: 'offmap', detail: 'The route runs off the edge of the world.' });
  if (!trackCloses(track)) out.push({ kind: 'open', detail: 'The route never returns to the grid — a lap cannot be timed.' });
  if (!track.name.trim()) out.push({ kind: 'nogrid', detail: 'The track has no name.' });
  return out;
}

/** The checkpoints a built track hands the race mode — one per piece. The
 *  radius is the whole width plus a margin, so a car on the racing line always
 *  clears the gate (a stingy gate is a lap that never banks). */
export function checkpointsFor(track: BuiltTrack): { pos: Vec3; radius: number }[] {
  return walkTrack(track).map((n) => ({ pos: { ...n.pos }, radius: Math.max(10, n.piece.width * 0.9) }));
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
      pieces: t.pieces.filter((p) => !!PIECE_SHAPE[p?.kind]).map((p) => ({
        kind: p.kind,
        width: Math.max(6, Math.min(30, +p.width || DEFAULT_PIECE.width)),
        height: Math.max(0, Math.min(2, +p.height || 0)),
        surface: (['paved', 'dirt', 'ice'] as Pavement[]).includes(p.surface) ? p.surface : 'paved',
      })),
    };
  } catch { return null; }
}
