// ---------------------------------------------------------------------------
// THE GHOST — race against your own best lap.
//
// A lightweight per-board recorder (NOT the killcam's whole-world snapshotter):
// sample the local racer's deck transform ~20×/s over a lap, and when a lap
// beats the stored best, keep it. Next lap, a translucent phantom replays that
// best line synced to your current lap clock — you chase your own tail.
// Client-only: it never touches the deterministic sim. Persists per circuit +
// board in localStorage, so your best survives the session.
// ---------------------------------------------------------------------------

export interface GhostSample { t: number; x: number; y: number; z: number; yaw: number }

const GHOST_HZ = 20;

/** Records the local racer's deck over one lap, lap-relative time. */
export class GhostRecorder {
  private samples: GhostSample[] = [];
  private lapStart = 0;
  private nextAt = 0;

  startLap(now: number): void {
    this.samples = [];
    this.lapStart = now;
    this.nextAt = 0;
  }

  record(now: number, x: number, y: number, z: number, yaw: number): void {
    const t = now - this.lapStart;
    if (t < this.nextAt) return;
    this.nextAt = t + 1 / GHOST_HZ;
    this.samples.push({ t, x, y, z, yaw });
  }

  /** The lap just finished — hand back its samples (a copy). */
  takeLap(): GhostSample[] {
    return this.samples.slice();
  }
}

const angLerp = (a: number, b: number, f: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * f;
};

/** Replays a stored lap: interpolate the deck transform at a lap-relative time. */
export class GhostPlayer {
  constructor(private samples: GhostSample[]) {}

  get length(): number { return this.samples.length; }
  get duration(): number { return this.samples.length ? this.samples[this.samples.length - 1].t : 0; }

  /** Transform at lap-relative time t, or null if the ghost holds no lap. */
  at(t: number): { x: number; y: number; z: number; yaw: number } | null {
    const s = this.samples;
    if (!s.length) return null;
    if (t <= s[0].t) return s[0];
    if (t >= s[s.length - 1].t) return s[s.length - 1]; // hold at the line
    let lo = 0, hi = s.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid].t <= t) lo = mid; else hi = mid; }
    const a = s[lo], b = s[hi];
    const f = (t - a.t) / (b.t - a.t || 1);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, yaw: angLerp(a.yaw, b.yaw, f) };
  }
}

/** localStorage key for a circuit + board's best ghost. */
export function ghostKey(trackSeed: number, board: string): string {
  return `ww_ghost_${trackSeed}_${board}`;
}

export interface StoredGhost { lapTime: number; samples: GhostSample[] }

export function loadGhost(key: string): StoredGhost | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const g = JSON.parse(raw) as StoredGhost;
    if (g && Array.isArray(g.samples) && g.samples.length && typeof g.lapTime === 'number') return g;
  } catch { /* private mode / bad record */ }
  return null;
}

export function saveGhost(key: string, lapTime: number, samples: GhostSample[]): void {
  try { localStorage.setItem(key, JSON.stringify({ lapTime, samples })); } catch { /* private mode */ }
}
