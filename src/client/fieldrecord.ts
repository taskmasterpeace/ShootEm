// ---------------------------------------------------------------------------
// THE FIELD RECORD (docs/COMPETITIVE-ARC.md §1) — the paintball card. The war
// has the Dossier; the yard gets its own book, holding the numbers PAINTBALL
// players brag about: the outnumbered splits (1v1…1v5+), off-the-break
// splats, clutches, clock-outs, the longest splat, spills, and the Gauntlet
// ladder. Fed by the SAME event stream the HUD reads, folded live by the
// FieldTracker, persisted beside the Dossier — sim untouched, sync-shaped.
//
// The yard stays OUT of the war Record on purpose (§14 Q3) — this file is
// where its history lives instead.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../sim/data';
import type { SimEvent, Team } from '../sim/types';
import type { World } from '../sim/world';

export type OutnumberedKey = '1v1' | '1v2' | '1v3' | '1v4' | '1v5plus';

export interface FieldRecord {
  v: 1;
  identity: string;
  series: { played: number; won: number };
  rounds: { played: number; won: number };
  splats: number;
  outs: number;
  outnumbered: Partial<Record<OutnumberedKey, { rounds: number; won: number }>>;
  offTheBreak: number;
  clutches: number;
  padsTagged: number;
  clockOuts: number;
  podSpills: number;
  paintThrown: number;
  longestSplat: number;
  longestSplatField: string;
  gauntletDepth: number;
  gauntletBestRun: number;
  /** THE GALLERY (§6): personal-best run score */
  galleryBest?: number;
}

/** THE GAUNTLET ladder (COMPETITIVE-ARC §2): rung N = you vs a pack of N.
 *  Win a series → climb; two series losses on a rung → the run ends. */
export interface GauntletState {
  rung: number;          // 1..7 — the pack size the next deploy fields
  lossesAtRung: number;  // two and the run is over
  runStartAt: number;    // rung the current run started on (for best-run math)
}

const KEY = 'ww_fieldrecord';
export const GAUNTLET_MAX = 7; // the fence — nobody outruns a full seven

export function freshFieldRecord(identity: string): FieldRecord {
  return {
    v: 1, identity,
    series: { played: 0, won: 0 }, rounds: { played: 0, won: 0 },
    splats: 0, outs: 0, outnumbered: {}, offTheBreak: 0, clutches: 0,
    padsTagged: 0, clockOuts: 0, podSpills: 0, paintThrown: 0,
    longestSplat: 0, longestSplatField: '',
    gauntletDepth: 0, gauntletBestRun: 0,
  };
}

interface Stored { record: FieldRecord; gauntlet: GauntletState }

export function loadFieldRecord(identity: string): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = JSON.parse(raw) as Stored;
      // trust nothing a hand-edit could have broken (the Dossier's own law)
      if (st?.record?.v === 1 && typeof st.record.splats === 'number' && st.gauntlet) {
        st.record.identity = identity; // the callsign can change; the book follows
        return st;
      }
    }
  } catch { /* fresh card */ }
  return { record: freshFieldRecord(identity), gauntlet: { rung: 1, lossesAtRung: 0, runStartAt: 1 } };
}

export function saveFieldRecord(st: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ }
}

export function outnumberedKey(enemies: number): OutnumberedKey {
  return enemies <= 1 ? '1v1' : enemies === 2 ? '1v2' : enemies === 3 ? '1v3'
    : enemies === 4 ? '1v4' : '1v5plus';
}

/** Advance the ladder off a finished series. Returns the line to announce. */
export function advanceGauntlet(st: Stored, won: boolean): string {
  const g = st.gauntlet;
  const r = st.record;
  if (won) {
    const cleared = g.rung;
    r.gauntletDepth = Math.max(r.gauntletDepth, cleared);
    r.gauntletBestRun = Math.max(r.gauntletBestRun, cleared - g.runStartAt + 1);
    if (g.rung >= GAUNTLET_MAX) {
      // the full seven — the run RETIRES undefeated and the ladder resets
      g.rung = 1; g.lossesAtRung = 0; g.runStartAt = 1;
      return `THE GAUNTLET FALLS — ALL ${GAUNTLET_MAX} RUNGS CLEARED`;
    }
    g.rung++; g.lossesAtRung = 0;
    return `RUNG ${cleared} CLEARED — NEXT: 1v${g.rung}`;
  }
  g.lossesAtRung++;
  if (g.lossesAtRung >= 2) {
    const depth = g.rung - 1;
    g.rung = 1; g.lossesAtRung = 0; g.runStartAt = 1;
    return depth > 0 ? `THE RUN ENDS AT RUNG ${depth + 1} — DEPTH ${depth} BANKED` : 'THE RUN ENDS AT THE FIRST RUNG';
  }
  return `RUNG ${g.rung} HOLDS — ONE MORE LOSS ENDS THE RUN`;
}

// ---------------------------------------------------------------------------
// THE FIELD TRACKER — folds one paintball match into the card, live.
// ---------------------------------------------------------------------------

export class FieldTracker {
  private st: Stored;
  private roundStart = 0;
  private bucket: OutnumberedKey | null = null;
  private alliesAtStart = 1;
  private lastWins: [number, number] = [0, 0];
  private clockOutFlag = false;
  private seriesDone = false;
  private fieldName: string;
  /** callbacks the host wires: announcements + belt checks stay out of here */
  onSplat?: (dist: number, field: string) => void;

  constructor(identity: string, fieldName: string) {
    this.st = loadFieldRecord(identity);
    this.fieldName = fieldName;
  }

  get record(): FieldRecord { return this.st.record; }
  get stored(): Stored { return this.st; }

  private openRound(w: World, meId: number) {
    const me = w.soldiers.get(meId);
    if (!me) return;
    this.roundStart = w.time;
    this.clockOutFlag = false;
    let allies = 0, enemies = 0;
    for (const s of w.humansAndBots()) {
      if (!s.alive) continue;
      if (s.team === me.team) allies++; else enemies++;
    }
    this.alliesAtStart = allies;
    // the outnumbered splits only count when you're genuinely ALONE (§1 —
    // the crown-jewel stat is 1-versus-N, not team-versus-team)
    this.bucket = allies === 1 && enemies >= 1 ? outnumberedKey(enemies) : null;
  }

  private closeRound(w: World, meId: number, winner: Team) {
    const me = w.soldiers.get(meId);
    if (!me) return;
    const r = this.st.record;
    const won = winner === me.team;
    r.rounds.played++;
    if (won) r.rounds.won++;
    if (this.bucket) {
      const b = (r.outnumbered[this.bucket] ??= { rounds: 0, won: 0 });
      b.rounds++;
      if (won) b.won++;
    }
    // clutch: your squad started 2+, you ended it as the last one standing
    if (won && this.alliesAtStart >= 2 && me.alive) {
      const others = [...w.soldiers.values()]
        .some((s) => s.id !== me.id && s.alive && s.team === me.team && (s.kind === 'human' || s.kind === 'bot'));
      if (!others) r.clutches++;
    }
    if (won && this.clockOutFlag && me.alive) r.clockOuts++;
    saveFieldRecord(this.st);
  }

  /** One call per frame from the paintball path: events are the frame's
   *  already-taken batch (shared with the HUD — never re-take them). */
  step(w: World, events: SimEvent[], meId: number) {
    const me = w.soldiers.get(meId);
    if (!me) return;
    const r = this.st.record;
    if (this.roundStart === 0) this.openRound(w, meId); // the first walk-on

    // settle the wins ledger BEFORE reading this frame's announces — the
    // round-end frame carries both the banked win and the score announce, and
    // the close must use the bucket the round OPENED with
    const wins = w.mode.roundWins ?? [0, 0];
    if (wins[0] !== this.lastWins[0] || wins[1] !== this.lastWins[1]) {
      const winner: Team = wins[0] > this.lastWins[0] ? 0 : 1;
      this.lastWins = [wins[0], wins[1]];
      this.closeRound(w, meId, winner);
    }

    for (const e of events) {
      switch (e.type) {
        case 'death': {
          if (e.soldierId === undefined) break;
          if (e.soldierId === meId) { r.outs++; break; }
          const victim = w.soldiers.get(e.soldierId);
          // only PLAYERS count — a drill dummy (RingDrill, the Gallery) is a
          // lesson, not a splat, and NEVER a Belt distance
          if (victim && (victim.kind === 'human' || victim.kind === 'bot') && !victim.dummy
            && victim.team !== me.team && victim.lastKillerId === meId && e.pos) {
            r.splats++;
            const dist = Math.hypot(me.pos.x - e.pos.x, me.pos.z - e.pos.z);
            if (dist > r.longestSplat) { r.longestSplat = dist; r.longestSplatField = this.fieldName; }
            // the break holds guns 8s — "off the break" is the 5s after release
            if (w.time - this.roundStart < 13) r.offTheBreak++;
            this.onSplat?.(dist, this.fieldName);
          }
          break;
        }
        case 'shot':
          if (e.soldierId === meId && (e.weapon?.startsWith('marker') || e.weapon === 'paint_nade')) r.paintThrown++;
          break;
        case 'spill':
          if (e.soldierId === meId) r.podSpills++;
          break;
        case 'announce':
          if (e.text?.includes('TAGGED') && me.team === (w.mode.huntedTeam ?? 1)) {
            // the tag announce carries no author — credit the player when they
            // are standing the pad (the only way a solo prey ever tags)
            const onPad = w.mode.points?.some((p) =>
              Math.hypot(me.pos.x - p.pos.x, me.pos.z - p.pos.z) < p.radius + 1);
            if (onPad) r.padsTagged++;
          }
          if (e.text === 'TIME — THE PREY SURVIVED') this.clockOutFlag = true;
          // the round-START announce is exactly "ROUND N" — the round-END
          // score line ("ROUND 1 — PREY · 0–1") also begins with the word,
          // and matching it once clobbered every bucket with a dead roster
          if (e.text && /^ROUND \d+$/.test(e.text)) this.openRound(w, meId);
          break;
      }
    }

    // series settlement — once
    if (w.mode.over && !this.seriesDone) {
      this.seriesDone = true;
      r.series.played++;
      if (w.mode.winner === me.team) r.series.won++;
      saveFieldRecord(this.st);
    }
  }

  /** true once the series has been folded (the host reads this to run the
   *  honors + ladder settlements exactly once) */
  get finished(): boolean { return this.seriesDone; }
}

/** Weapon label helper for cards ("Blitz Marker", never a raw id). */
export function markerLabel(id: string): string { return WEAPONS[id]?.name ?? id; }
