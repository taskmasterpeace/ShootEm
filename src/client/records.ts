// ---------------------------------------------------------------------------
// THE RECORD BOARD (docs/RACING.md — Robert: "we also need to keep track of,
// like, the records and who got the best time on what track").
//
// A record is a track, a class of machine, a time, and A NAME. The name is
// the point: a time nobody holds is a number, and a time somebody holds is a
// reason to come back. Account-level, so it survives every print.
// ---------------------------------------------------------------------------
import type { VehicleKind } from '../sim/types';

const KEY = 'ww_records';

/** Machines race their own kind — a bike record is not a truck record. */
export type RaceClass = 'bike' | 'car' | 'truck' | 'board';

export interface TrackRecord {
  trackId: string;
  cls: RaceClass;
  /** best LAP, seconds */
  lap: number;
  /** best full race, seconds (0 = never finished one) */
  race: number;
  /** who holds it — the whole reason the board exists */
  holder: string;
  /** what they held it in */
  hull: VehicleKind;
  /** when it was set (client clock — biography, not sim) */
  at: number;
}

export const recordStorage = {
  get(): string | null { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v: string): void { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } },
};

/** Which board a machine races on. */
export function raceClassOf(kind: VehicleKind, mass = 1.6): RaceClass {
  if (kind === 'bike' || kind === 'scooter' || kind === 'bicycle' || kind === 'atv') return 'bike';
  if (kind === 'hoverboard' || kind === 'comet' || kind === 'vector' || kind === 'sprite') return 'board';
  return mass >= 4 ? 'truck' : 'car';
}

const rowKey = (trackId: string, cls: RaceClass) => `${trackId}::${cls}`;

export function loadRecords(): Record<string, TrackRecord> {
  try { return JSON.parse(recordStorage.get() ?? '{}') as Record<string, TrackRecord>; }
  catch { return {}; }
}

export function recordFor(trackId: string, cls: RaceClass): TrackRecord | undefined {
  return loadRecords()[rowKey(trackId, cls)];
}

/**
 * File a run. Returns what (if anything) was beaten — the caller announces it,
 * because taking a record off somebody by name is the moment worth showing.
 */
export function fileRun(input: {
  trackId: string; hull: VehicleKind; mass?: number; holder: string;
  lap?: number; race?: number; at?: number;
}): { tookLap: boolean; tookRace: boolean; previous?: TrackRecord } {
  const cls = raceClassOf(input.hull, input.mass);
  const all = loadRecords();
  const key = rowKey(input.trackId, cls);
  const prev = all[key];
  const lap = input.lap ?? 0;
  const race = input.race ?? 0;
  const tookLap = lap > 0 && (!prev || prev.lap <= 0 || lap < prev.lap);
  const tookRace = race > 0 && (!prev || prev.race <= 0 || race < prev.race);
  if (!tookLap && !tookRace) return { tookLap: false, tookRace: false, previous: prev };
  all[key] = {
    trackId: input.trackId, cls,
    lap: tookLap ? lap : (prev?.lap ?? 0),
    race: tookRace ? race : (prev?.race ?? 0),
    // the name goes with whatever was just taken
    holder: input.holder,
    hull: input.hull,
    at: input.at ?? Date.now(),
  };
  recordStorage.set(JSON.stringify(all));
  return { tookLap, tookRace, previous: prev };
}

/** The whole board, newest records first — the screen the player reads. */
export function allRecords(): TrackRecord[] {
  return Object.values(loadRecords()).sort((a, b) => b.at - a.at);
}

export function clearRecords(): void {
  try { localStorage.removeItem(KEY); } catch { /* private mode */ }
}
