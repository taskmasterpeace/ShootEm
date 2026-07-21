import type { Dossier } from './record';
import { saveDossier } from './record';
import type { World } from '../sim/world';

// ---------------------------------------------------------------------------
// The Proving Grounds v1 (DD §3.3) — the infantry qualification course, run
// on the 'range' mode: six dummy targets in an arc, a clock that starts on
// GO, a score the instant the last target drops. Practice is unlimited and
// says so; the OFFICIAL run (18B) is explicitly confirmed, recorded forever,
// and posted to the local Wall.
// ---------------------------------------------------------------------------

export const COURSE_TARGETS = 6;
/** score curve: 6s = 100, every second past par costs 4 */
export function scoreRun(elapsed: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - Math.max(0, elapsed - 6) * 4)));
}
export function gradeFor(score: number): string {
  return score >= 90 ? 'Expert' : score >= 75 ? 'Sharpshooter' : score >= 55 ? 'Marksman' : 'Qualified';
}

export interface WallEntry { callsign: string; score: number; elapsed: number; official: boolean; at: number }
const WALL_KEY = 'ww_wall_infantry';

export function loadWall(): WallEntry[] {
  try { return JSON.parse(localStorage.getItem(WALL_KEY) ?? '[]') as WallEntry[]; } catch { return []; }
}
export function postToWall(e: WallEntry) {
  const wall = loadWall();
  wall.push(e);
  wall.sort((a, b) => b.score - a.score || a.elapsed - b.elapsed);
  if (wall.length > 50) wall.length = 50;
  try { localStorage.setItem(WALL_KEY, JSON.stringify(wall)); } catch { /* board full, war goes on */ }
}
/** share of official Wall scores at or below this one — 18B records it fixed */
export function percentileOn(wall: WallEntry[], score: number): number {
  const official = wall.filter((w) => w.official);
  if (official.length === 0) return 100;
  const atOrBelow = official.filter((w) => w.score <= score).length;
  return Math.round((atOrBelow / official.length) * 100);
}

export type CoursePhase = 'countdown' | 'live' | 'done';

export class RangeCourse {
  phase: CoursePhase = 'countdown';
  private countdown = 3;
  private lastWhole = 4;
  private startAt = 0;
  private dummyIds: number[] = [];
  private dropped = new Set<number>(); // targets knocked down at least once this run
  elapsed = 0;
  score = 0;

  constructor(
    private official: boolean,
    private callsign: string,
    private dossier: Dossier | null,
    private say: (text: string, big?: boolean) => void,
  ) {}

  /** Stage the lane: six dummies in an arc downrange of the start plate. */
  begin(world: World, meId: number) {
    const me = world.soldiers.get(meId);
    if (!me) return;
    me.pos = { x: world.map.hillPos.x - 18, y: 0, z: world.map.hillPos.z };
    const ranges = [10, 13, 16, 20, 25, 31];
    for (let i = 0; i < COURSE_TARGETS; i++) {
      const a = (i / (COURSE_TARGETS - 1) - 0.5) * 1.2;
      const d = world.addSoldier(`Target-${i + 1}`, 'infantry', 1, 'bot');
      d.dummy = true;
      d.pos = {
        x: me.pos.x + Math.cos(a) * ranges[i],
        y: 0,
        z: me.pos.z + Math.sin(a) * ranges[i],
      };
      d.yaw = Math.PI; // face the shooter — they're brave like that
      // Robert: "the dummies don't regenerate." They do now — each pops back
      // up at its home ~4s after it drops, so the range never runs out of
      // targets to test on. The timed qual run still ends on all-six-DROPPED
      // (tracked below), so respawns don't stop you from finishing.
      d.respawns = true;
      d.dummyHome = { ...d.pos };
      this.dummyIds.push(d.id);
    }
    this.say(this.official ? 'OFFICIAL QUALIFICATION — this one counts, forever' : 'PRACTICE RUN — the Wall never sees practice', true);
  }

  update(world: World, dt: number) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      const whole = Math.ceil(this.countdown);
      if (whole < this.lastWhole && whole > 0) { this.lastWhole = whole; this.say(String(whole), true); }
      if (this.countdown <= 0) {
        this.phase = 'live';
        this.startAt = world.time;
        this.say('GO — six targets, the clock is running', true);
      }
      return;
    }
    if (this.phase !== 'live') return;
    // the run ends when every target has been DROPPED at least once — tracked,
    // not "none standing," so the regenerating dummies (which pop back up ~4s
    // after they fall) can't reset your progress mid-run.
    for (const id of this.dummyIds) {
      if (!world.soldiers.get(id)?.alive) this.dropped.add(id);
    }
    if (this.dropped.size >= this.dummyIds.length) {
      this.phase = 'done';
      this.elapsed = Math.round((world.time - this.startAt) * 100) / 100;
      this.score = scoreRun(this.elapsed);
      this.finish();
    }
  }

  private finish() {
    const grade = gradeFor(this.score);
    const wallBefore = loadWall();
    const pct = percentileOn(wallBefore.concat({ callsign: this.callsign, score: this.score, elapsed: this.elapsed, official: this.official, at: Date.now() }), this.score);
    postToWall({ callsign: this.callsign, score: this.score, elapsed: this.elapsed, official: this.official, at: Date.now() });
    if (this.official && this.dossier && !this.dossier.quals.infantry) {
      // 18B: the first OFFICIAL run is the permanent qualification
      this.dossier.quals.infantry = { score: this.score, percentile: pct, grade, firstAttemptAt: Date.now() };
      this.dossier.soldier.rankPoints += this.score; // qualification pays its own citation
      void saveDossier(this.dossier);
      this.say(`QUALIFIED ${grade.toUpperCase()} — ${this.score} pts, ${pct}th percentile. The Wall remembers.`, true);
    } else {
      this.say(`${this.official ? 'Official run' : 'Practice'}: ${this.score} pts (${grade}) in ${this.elapsed}s`, true);
    }
  }
}
