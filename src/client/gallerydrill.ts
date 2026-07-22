// ---------------------------------------------------------------------------
// THE GALLERY, V1 (docs/COMPETITIVE-ARC.md §6, issue #120) — the yard's
// target range. 3-2-1-GO, then a 60-second run mixing two target games:
//
//   POP-UPS (Robert: "like the amusement park — it pops up, you gotta shoot
//   it before it goes back down"): five posts in an arc; one target stands
//   at a time, you get a ~2.6s window, then the next one pops. It is always
//   CLEAR what you're supposed to shoot — exactly one target is up.
//
//   RUNNERS (Robert's diagonal): a target that starts CLOSE but extreme to
//   your left or right — you don't know which side — then recedes AND
//   crosses your line of sight at once. Farther it gets, more it's worth.
//
// Targets are drill dummies (the RingDrill pattern): sim-shootable, splat
// like anything else, never touch the FieldRecord (the dummy guard) and
// never set a Belt distance. Scores: pop-up 100 + speed bonus; runner 150 +
// distance bonus; balls landed in the last 10 seconds ride a 1.5x closing
// multiplier. Personal best lives on the card (galleryBest); the HOUSE
// SCORE is the standing record with a name on it (trophies store).
// ---------------------------------------------------------------------------
import { isBlocked } from '../sim/map';
import { hash01 } from '../sim/rng';
import type { SimEvent, Soldier, Vec3 } from '../sim/types';
import type { World } from '../sim/world';
import { loadFieldRecord, saveFieldRecord } from './fieldrecord';
import { checkGalleryRecord, loadTrophies } from './trophies';

const RUN_SECONDS = 60;
const POP_WINDOW = 2.6;
const RUNNER_LIFE = 5.5;

type Phase = 'idle' | 'countdown' | 'running' | 'done';

interface GalleryEvent { kind: 'pop' | 'runner'; post?: number; side?: 1 | -1 }

export class GalleryDrill {
  private phase: Phase = 'idle';
  private started = false;
  private dummies: number[] = [];
  private dugout: Vec3[] = [];
  private posts: Vec3[] = [];
  private line: Vec3 = { x: 0, y: 0, z: 0 };
  private seq: GalleryEvent[] = [];
  private seqIdx = 0;
  private activeDummy = -1;
  private activeKind: 'pop' | 'runner' | null = null;
  private eventUntil = 0;
  private runnerDir = { x: 1, z: 0 };
  private runnerSpeed = 8;
  private phaseAt = 0;
  private countdownStep = 0;
  private runEndsAt = 0;
  private score = 0;
  private runSeed = 1;

  constructor(private who: string, private say: (text: string, big: boolean) => void) {}

  /** nudge an ideal spot to the nearest open tile (never park a target in a bunker) */
  private open(w: World, x: number, z: number): Vec3 {
    for (let r = 0; r <= 4; r++) {
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        const px = x + dx * 1.5, pz = z + dz * 1.5;
        if (!isBlocked(w.map.grid, px, pz)) return { x: px, y: 0, z: pz };
      }
    }
    return { x, y: 0, z };
  }

  begin(w: World, localId: number) {
    if (this.started) return;
    this.started = true;
    const me = w.soldiers.get(localId);
    if (!me) return;
    // the firing line: the plaza's west edge — the open middle IS the range
    this.line = this.open(w, -12, 0);
    me.pos = { ...this.line };
    // the arc of posts, east of the line; the dugout rack along the north
    const arc: [number, number][] = [[14, -9], [18, -4], [20, 1], [18, 6], [14, 11]];
    this.posts = arc.map(([dx, dz]) => this.open(w, this.line.x + dx, this.line.z + dz));
    for (let i = 0; i < 3; i++) {
      const park = this.open(w, this.line.x + 2 + i * 2.5, this.line.z - 22);
      this.dugout.push(park);
      const d = w.addSoldier(`GAL-${i + 1}`, 'infantry', 1, 'bot');
      d.dummy = true;
      d.pos = { ...park };
      this.dummies.push(d.id);
    }
    this.phase = 'countdown';
    this.phaseAt = w.time;
    this.countdownStep = 0;
    this.say('THE GALLERY — targets pop and RUN. Splat them before the clock does.', true);
  }

  private park(w: World, id: number) {
    const s = w.soldiers.get(id);
    if (!s) return;
    const slot = this.dugout[this.dummies.indexOf(id) % this.dugout.length];
    s.alive = true;
    s.hp = s.maxHp;
    s.downed = false;
    s.pos = { ...slot };
    s.vel.x = 0; s.vel.z = 0;
  }

  private nextEvent(w: World) {
    if (w.time >= this.runEndsAt || this.seqIdx >= this.seq.length) {
      this.finish(w);
      return;
    }
    const ev = this.seq[this.seqIdx++];
    const id = this.dummies[this.seqIdx % this.dummies.length];
    const s = w.soldiers.get(id);
    if (!s) return;
    this.activeDummy = id;
    this.activeKind = ev.kind;
    if (ev.kind === 'pop') {
      s.pos = { ...this.posts[ev.post ?? 0] };
      this.eventUntil = w.time + POP_WINDOW;
    } else {
      // THE RUNNER: close but extreme left/right, then away AND across
      const side = ev.side ?? 1;
      s.pos = this.open(w, this.line.x + 6, this.line.z + side * 20);
      const dir = { x: 1, z: -side * 0.8 };
      const l = Math.hypot(dir.x, dir.z);
      this.runnerDir = { x: dir.x / l, z: dir.z / l };
      this.runnerSpeed = 7.5 + this.seqIdx * 0.35; // each one a hair quicker
      this.eventUntil = w.time + RUNNER_LIFE;
      this.say(side > 0 ? 'RUNNER — RIGHT!' : 'RUNNER — LEFT!', false);
    }
  }

  private finish(w: World) {
    this.phase = 'done';
    this.phaseAt = w.time;
    if (this.activeDummy >= 0) this.park(w, this.activeDummy);
    this.activeDummy = -1;
    this.activeKind = null;
    // the two numbers that persist: yours, and the house's
    const st = loadFieldRecord(this.who);
    const best = st.record.galleryBest ?? 0;
    if (this.score > best) st.record.galleryBest = this.score;
    saveFieldRecord(st);
    const house = checkGalleryRecord(loadTrophies(), this.who, this.score);
    this.say(`RUN COMPLETE — ${this.score} POINTS${this.score > best ? ' · PERSONAL BEST' : ''}`, true);
    if (house) this.say(house, true);
  }

  update(w: World, localId: number, events: SimEvent[], dt: number) {
    if (!this.started || this.phase === 'idle') return;
    const me = w.soldiers.get(localId);
    if (!me) return;
    // the range holds the referee's clock — no whistle interrupts a run
    w.mode.timeLeft = Math.max(w.mode.timeLeft, 300);

    if (this.phase === 'countdown') {
      const step = Math.floor(w.time - this.phaseAt);
      if (step > this.countdownStep - 1 && step <= 3) {
        this.countdownStep = step + 1;
        this.say(step < 3 ? `${3 - step}…` : 'GO!', true);
        if (step >= 3) {
          this.phase = 'running';
          this.score = 0;
          this.runSeed++;
          this.runEndsAt = w.time + RUN_SECONDS;
          // deal the run: pop-ups with runners salted through, seeded per run
          this.seq = [];
          for (let i = 0; i < 14; i++) {
            const r = hash01(this.runSeed * 97 + i * 13);
            if (r < 0.35) this.seq.push({ kind: 'runner', side: r < 0.175 ? 1 : -1 });
            else this.seq.push({ kind: 'pop', post: Math.floor(hash01(this.runSeed * 31 + i * 7) * this.posts.length) });
          }
          this.nextEvent(w);
        }
      }
      return;
    }

    if (this.phase === 'done') {
      // the range resets itself — walk-ons welcome
      if (w.time - this.phaseAt > 8) {
        this.phase = 'countdown';
        this.phaseAt = w.time;
        this.countdownStep = 0;
        this.say('AGAIN — on the line.', false);
      }
      return;
    }

    // running: drive the active target, read the splats
    const active = this.activeDummy >= 0 ? w.soldiers.get(this.activeDummy) : undefined;
    if (active && this.activeKind === 'runner' && active.alive) {
      active.pos.x += this.runnerDir.x * this.runnerSpeed * dt;
      active.pos.z += this.runnerDir.z * this.runnerSpeed * dt;
    }
    for (const e of events) {
      if (e.type !== 'death' || e.soldierId !== this.activeDummy) continue;
      const closing = this.runEndsAt - w.time <= 10 ? 1.5 : 1;
      let pts: number;
      if (this.activeKind === 'pop') {
        pts = Math.round((100 + Math.max(0, this.eventUntil - w.time) * 40) * closing);
      } else {
        const dist = active ? Math.hypot(active.pos.x - me.pos.x, active.pos.z - me.pos.z) : 10;
        pts = Math.round((150 + dist * 3) * closing);
      }
      this.score += pts;
      this.say(`+${pts}${closing > 1 ? ' (CLOSING!)' : ''} — ${this.score}`, false);
      this.park(w, this.activeDummy);
      this.activeDummy = -1;
      this.nextEvent(w);
      return;
    }
    // the window closed or the runner escaped
    if (w.time >= this.eventUntil) {
      if (this.activeDummy >= 0) this.park(w, this.activeDummy);
      this.activeDummy = -1;
      this.nextEvent(w);
    }
  }
}
