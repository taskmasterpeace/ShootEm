// ---------------------------------------------------------------------------
// THE BOARD — the desk under the TV.
//
// Robert: *"I want to increase visibility into the game's engine and combat so
// that I can monitor stuff. There's a lot of space under the TV. Figure out the
// aspect ratio it needs to be... who threw the hardest attack, what was the
// hardest attack, who had the best defense — that is a lot of good stuff to
// read on that screen."*
//
// THE ASPECT RATIO, decided and defended:
//
//   The picture runs CINEMASCOPE — 2.35:1, near enough 21:9 — and the desk
//   takes what is left underneath. That choice is not decoration; it is the
//   only ratio that MAKES the room he is asking for. A 16:9 picture on a 16:9
//   display leaves exactly nothing below it. Letterboxing the view to 2.35
//   frees 22% of the screen height on the overwhelmingly common 1920x1080
//   panel, which is 238px — enough for four columns of real telemetry at a
//   readable 11-13px, and not so much that the game becomes a small window.
//
//   1920x1080 -> desk 238px, picture 1920x842 = 2.28:1   (the design target)
//   2560x1440 -> desk 280px (capped), picture 2560x1160 = 2.21:1
//   1366x768  -> desk 169px, picture 1366x599 = 2.28:1
//
//   The clamp() in the stylesheet is the same three numbers: never below 132px
//   (the desk stops being readable), never above 280px (the picture stops
//   being the point). A shooter is played in the middle of the screen; the
//   desk is read in the pauses between.
//
// Everything here is DERIVED. The board owns no truth: combat figures come
// from the ledger, draw cost from the renderer, populations from the world.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../sim/data';
import type { Soldier, WeaponId } from '../sim/types';
import type { World } from '../sim/world';
import { CombatLedger, type FighterLine } from './ledger';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const n0 = (v: number) => Math.round(v).toLocaleString();
const gunName = (w?: WeaponId) => (w ? WEAPONS[w]?.name ?? String(w) : '—');

/** What the renderer will tell us about the frame it just drew. */
export interface DrawStats {
  calls: number;
  tris: number;
  geometries: number;
  textures: number;
  w: number;
  h: number;
}

/** Costs the match loop measures around its own work, in milliseconds. */
export interface EnginePulse {
  simMs: number;
  drawMs: number;
}

const FRAME_WINDOW = 120; // ~2 seconds of frames for the average and the low

export class Board {
  readonly ledger = new CombatLedger();
  private host: HTMLElement;
  private frames: number[] = [];
  private lastPaint = -1;
  private sort: 'dealt' | 'kills' | 'taken' | 'defence' = 'dealt';
  on = false;

  constructor(host: HTMLElement) {
    this.host = host;
    // the column headers double as sort controls — one click re-ranks the table
    host.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-sort]');
      if (!t) return;
      this.sort = t.dataset.sort as typeof this.sort;
      this.lastPaint = -1; // repaint on the next frame, don't wait for the tick
    });
  }

  setOn(on: boolean): void {
    this.on = on;
    this.host.classList.toggle('hidden', !on);
    document.getElementById('app')?.classList.toggle('board-on', on);
  }

  toggle(): void { this.setOn(!this.on); }

  /** Every frame: remember what it cost, so the average and the low are real. */
  frame(ms: number): void {
    this.frames.push(ms);
    if (this.frames.length > FRAME_WINDOW) this.frames.shift();
  }

  private fps(): { avg: number; low: number } {
    if (!this.frames.length) return { avg: 0, low: 0 };
    let sum = 0, worst = 0;
    for (const f of this.frames) { sum += f; if (f > worst) worst = f; }
    const mean = sum / this.frames.length;
    return { avg: mean > 0 ? 1000 / mean : 0, low: worst > 0 ? 1000 / worst : 0 };
  }

  applyEvents(evts: import('../sim/types').SimEvent[], world: World): void {
    this.ledger.applyEvents(evts, world);
  }

  // ── the four columns ─────────────────────────────────────────────────────

  /** A superlative block: the figure, then who, then the context. */
  private stat(label: string, figure: string, who: string, detail: string): string {
    return `<div class="bd-stat"><h5>${esc(label)}</h5>`
      + `<b>${esc(figure)}</b>`
      + `<span class="bd-who">${esc(who)}</span>`
      + `<span class="bd-det">${esc(detail)}</span></div>`;
  }

  private reckoning(): string {
    const L = this.ledger;
    const hard = L.hardest;
    const long = L.longestKill;
    const def = L.leader(CombatLedger.defence);
    const kills = L.leader((l) => l.kills);
    const streak = L.leader((l) => l.bestStreak);
    const tough = L.leader((l) => l.taken + l.eaten);
    const acc = L.leader((l) => (l.shots >= 12 ? l.hits / l.shots : 0));

    const blocks = [
      hard
        ? this.stat('HARDEST BLOW', n0(hard.amount), hard.attacker,
          `${gunName(hard.weapon)} ▸ ${hard.victim}`)
        : this.stat('HARDEST BLOW', '—', 'no blows landed', 'the field is quiet'),
      def
        ? this.stat('BEST DEFENCE', `${n0(CombatLedger.defence(def))}/life`, def.name,
          `${n0(def.taken + def.eaten)} soaked · ${def.deaths} down`
          + (def.eaten ? ` · ${n0(def.eaten)} on plate` : '')
          + (def.blocks ? ` · ${def.blocks} blocked` : ''))
        : this.stat('BEST DEFENCE', '—', 'nobody has been hit', 'no punishment to absorb'),
      long
        ? this.stat('LONGEST KILL', `${Math.round(long.amount)}m`, long.attacker,
          `${long.weaponName ?? gunName(long.weapon)} ▸ ${long.victim}`)
        : this.stat('LONGEST KILL', '—', 'nobody has fallen', ''),
      kills
        ? this.stat('DEADLIEST', `${kills.kills}`, kills.name,
          `${n0(kills.dealt)} dealt · best ${n0(kills.best)}`)
        : this.stat('DEADLIEST', '0', 'no kills yet', ''),
      streak
        ? this.stat('BEST RUN', `${streak.bestStreak}`, streak.name,
          streak.streak === streak.bestStreak && streak.streak > 0 ? 'STILL RUNNING' : 'broken')
        : this.stat('BEST RUN', '—', 'no streaks', ''),
      tough
        ? this.stat('TOUGHEST', n0(tough.taken + tough.eaten), tough.name,
          `${n0(tough.taken)} to flesh · ${tough.deaths} down`)
        : this.stat('TOUGHEST', '—', 'nobody has been hit', ''),
      acc
        ? this.stat('DEADEYE', `${Math.round((acc.hits / acc.shots) * 100)}%`, acc.name,
          `${acc.hits} of ${acc.shots} rounds`)
        : this.stat('DEADEYE', '—', 'not enough rounds', 'needs 12 fired'),
      this.stat('THE MATCH', n0(L.totalDamage), `${L.totalKills} killed`,
        `${n0(L.blows)} blows · ${L.fighters.size} fighters`),
    ];
    return `<section class="bd-col bd-reck"><h4>THE RECKONING</h4>
      <div class="bd-stats">${blocks.join('')}</div></section>`;
  }

  private fighters(me: Soldier): string {
    const rows = this.ledger.table(this.sort, 7);
    const head = (key: typeof this.sort, label: string) =>
      `<span data-sort="${key}" class="${this.sort === key ? 'up' : ''}">${label}</span>`;
    const body = rows.length
      ? rows.map((l) => {
        const pct = l.shots >= 6 ? `${Math.round((l.hits / l.shots) * 100)}%` : '—';
        return `<div class="bd-row${l.id === me.id ? ' you' : ''} t${l.team}">
          <span class="bd-name">${esc(l.name)}</span>
          <span>${l.kills}</span>
          <span>${n0(l.dealt)}</span>
          <span>${n0(l.taken)}</span>
          <span>${n0(CombatLedger.defence(l))}</span>
          <span>${n0(l.best)}</span>
          <span>${pct}</span>
        </div>`;
      }).join('')
      : '<div class="bd-empty">No blows struck. The book opens with the first shot.</div>';
    return `<section class="bd-col bd-fight"><h4>THE FIGHTERS <i>click a column to rank</i></h4>
      <div class="bd-row bd-head">
        <span class="bd-name">NAME</span>
        ${head('kills', 'K')}
        ${head('dealt', 'DEALT')}
        ${head('taken', 'TAKEN')}
        ${head('defence', 'DEF')}
        <span>BEST</span>
        <span>ACC</span>
      </div>
      <div class="bd-rows">${body}</div></section>`;
  }

  private engine(world: World, d: DrawStats, pulse: EnginePulse): string {
    const { avg, low } = this.fps();
    let alive = 0, bots = 0, zeds = 0;
    for (const s of world.soldiers.values()) {
      if (!s.alive) continue;
      alive++;
      if (s.kind === 'bot') bots++;
      else if (s.kind !== 'human') zeds++;
    }
    let hulls = 0;
    for (const v of world.vehicles.values()) if (v.alive) hulls++;
    const aspect = d.h > 0 ? (d.w / d.h) : 0;
    const budget = avg >= 58 ? 'ok' : avg >= 45 ? 'warn' : 'bad';

    const row = (k: string, v: string, cls = '') =>
      `<div class="bd-kv ${cls}"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;
    return `<section class="bd-col bd-eng"><h4>THE ENGINE</h4>
      ${row('FRAME RATE', `${avg.toFixed(0)} fps`, budget)}
      ${row('1% LOW', `${low.toFixed(0)} fps`, low >= 40 ? 'ok' : low >= 25 ? 'warn' : 'bad')}
      ${row('SIM STEP', `${pulse.simMs.toFixed(2)} ms`, pulse.simMs < 4 ? 'ok' : pulse.simMs < 8 ? 'warn' : 'bad')}
      ${row('DRAW', `${pulse.drawMs.toFixed(2)} ms`, pulse.drawMs < 8 ? 'ok' : pulse.drawMs < 14 ? 'warn' : 'bad')}
      ${row('DRAW CALLS', n0(d.calls))}
      ${row('TRIANGLES', n0(d.tris))}
      ${row('GEOMETRY / TEX', `${n0(d.geometries)} / ${n0(d.textures)}`)}
      ${row('BODIES', `${alive} (${bots} bot · ${zeds} threat)`)}
      ${row('HULLS / SHOTS', `${hulls} / ${world.projectiles.size}`)}
      ${row('EVENTS', `${n0(this.ledger.eventRate)}/s`)}
      ${row('PICTURE', `${d.w}×${d.h} · ${aspect.toFixed(2)}:1`)}
    </section>`;
  }

  private feedCol(world: World): string {
    const lines = this.ledger.feed.slice(-9).reverse();
    const body = lines.length
      ? lines.map((f) => `<div class="bd-feed-line k-${f.kind}">`
        + `<span class="bd-t">${Math.floor(f.at / 60)}:${String(Math.floor(f.at % 60)).padStart(2, '0')}</span>`
        + `<span>${esc(f.text)}</span></div>`).join('')
      : '<div class="bd-empty">Nothing has happened yet.</div>';
    return `<section class="bd-col bd-feed"><h4>THE FEED <i>${Math.floor(world.time / 60)}:${String(Math.floor(world.time % 60)).padStart(2, '0')}</i></h4>
      <div class="bd-feed-body">${body}</div></section>`;
  }

  /**
   * Paint. Throttled to 5Hz by the caller's clock — the numbers are for
   * reading, and a figure that changes 60 times a second cannot be read.
   */
  render(world: World, me: Soldier, draw: DrawStats, pulse: EnginePulse): void {
    if (!this.on) return;
    if (this.lastPaint >= 0 && world.time - this.lastPaint < 0.2) return;
    this.lastPaint = world.time;
    this.host.innerHTML = this.reckoning() + this.fighters(me)
      + this.engine(world, draw, pulse) + this.feedCol(world);
  }
}
