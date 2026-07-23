// ---------------------------------------------------------------------------
// THE LEDGER — every blow in the match, tallied and ranked.
//
// Robert: *"who threw the hardest attack, what was the hardest attack, who had
// the best defense — we want all of that stuff so that is a lot of good stuff
// to read on that screen."*
//
// The sim already narrates itself in exhaustive detail; nobody was listening.
// Every 'damage' event names an attacker, a victim, a magnitude and (now) the
// weapon; every 'death' carries the range and the killing tool; every
// 'melee_block' names a guard that held. This module is the accountant: it
// reads the event stream once per tick and keeps a running book.
//
// Read-only by construction. The ledger never touches the world, never emits,
// never decides anything — so it can be wrong about nothing. If a figure here
// disagrees with the fight, the fight is right and this is a bug.
// ---------------------------------------------------------------------------
import type { SimEvent, Team, WeaponId } from '../sim/types';
import type { World } from '../sim/world';

/** One fighter's whole account. */
export interface FighterLine {
  id: number;
  name: string;
  team: Team;
  /** damage put out, plate and flesh together */
  dealt: number;
  /** damage that reached this one's flesh */
  taken: number;
  /** damage this one's PLATE ate before it reached flesh — the armour's work */
  eaten: number;
  /** strikes a raised guard caught outright */
  blocks: number;
  kills: number;
  deaths: number;
  /** the hardest single blow this one has thrown */
  best: number;
  bestWeapon?: WeaponId;
  bestVictim?: string;
  /** rounds sent and rounds that found a body — accuracy, honestly counted */
  shots: number;
  hits: number;
  streak: number;
  bestStreak: number;
}

/** A blow worth remembering: the marquee line of the whole board. */
export interface BlowRecord {
  amount: number;
  attacker: string;
  victim: string;
  weapon?: WeaponId;
  weaponName?: string;
  /** seconds into the match */
  at: number;
  /** range in world units, when the blow was a kill */
  dist?: number;
}

/** One line of the rolling feed. */
export interface FeedLine {
  at: number;
  kind: 'kill' | 'blow' | 'block' | 'record' | 'down';
  text: string;
}

const BLOW_FEED_FLOOR = 45; // a hit has to matter to earn a line

function blank(id: number, name: string, team: Team): FighterLine {
  return {
    id, name, team,
    dealt: 0, taken: 0, eaten: 0, blocks: 0, kills: 0, deaths: 0,
    best: 0, shots: 0, hits: 0, streak: 0, bestStreak: 0,
  };
}

export class CombatLedger {
  readonly fighters = new Map<number, FighterLine>();
  /** the hardest blow of the match, and the hardest of the last 10 seconds */
  hardest?: BlowRecord;
  recent?: BlowRecord;
  longestKill?: BlowRecord;
  readonly feed: FeedLine[] = [];

  totalDamage = 0;
  totalKills = 0;
  blows = 0;
  events = 0;
  /** events seen in the last sampling window, for the rate readout */
  private windowEvents = 0;
  private windowAt = 0;
  eventRate = 0;

  /** Names outlive bodies: a fighter deleted from the world keeps its line. */
  private line(world: World, id: number): FighterLine | undefined {
    if (id < 0) return undefined;
    const known = this.fighters.get(id);
    if (known) return known;
    const s = world.soldiers.get(id);
    if (!s) return undefined;
    const made = blank(id, s.name, s.team);
    this.fighters.set(id, made);
    return made;
  }

  /**
   * Read one tick's events. Blows are FOLDED first: a damageSoldier call emits
   * plate and flesh separately, and a shotgun emits one per pellet — all in
   * the same tick, all from one trigger pull. Summing them per
   * attacker+victim+weapon is what makes "the hardest attack" mean the ATTACK
   * and not the loudest pellet of it.
   */
  applyEvents(evts: SimEvent[], world: World): void {
    this.events += evts.length;
    this.windowEvents += evts.length;
    const now = world.time;
    if (now - this.windowAt >= 1) {
      this.eventRate = Math.round(this.windowEvents / Math.max(0.001, now - this.windowAt));
      this.windowEvents = 0;
      this.windowAt = now;
    }

    const folded = new Map<string, { atk: number; vic: number; weapon?: WeaponId; amount: number }>();

    for (const e of evts) {
      switch (e.type) {
        case 'damage': {
          const amount = e.amount ?? 0;
          if (amount <= 0) break;
          const vic = e.soldierId ?? -1;
          const atk = e.ownerId ?? -1;
          const vl = this.line(world, vic);
          if (vl) {
            if (e.armorHit) vl.eaten += amount; else vl.taken += amount;
          }
          const al = this.line(world, atk);
          if (al && atk !== vic) {
            al.dealt += amount;
            this.totalDamage += amount;
            const key = `${atk}:${vic}:${e.weapon ?? '?'}`;
            const f = folded.get(key);
            if (f) f.amount += amount;
            else folded.set(key, { atk, vic, weapon: e.weapon, amount });
          }
          break;
        }
        case 'melee_block': {
          const l = this.line(world, e.soldierId ?? -1);
          if (l) {
            l.blocks++;
            this.feed.push({ at: now, kind: 'block', text: `${l.name} CAUGHT IT ON THE GUARD` });
          }
          break;
        }
        case 'shot': {
          const l = this.line(world, e.soldierId ?? -1);
          if (l) l.shots++;
          break;
        }
        case 'death': {
          const vl = this.line(world, e.soldierId ?? -1);
          if (vl) { vl.deaths++; vl.streak = 0; }
          const kid = e.killerId ?? -1;
          const kl = this.line(world, kid);
          if (kl && kid !== (e.soldierId ?? -1)) {
            kl.kills++;
            kl.streak++;
            if (kl.streak > kl.bestStreak) kl.bestStreak = kl.streak;
            this.totalKills++;
            const dist = e.dist ?? 0;
            if (!this.longestKill || dist > this.longestKill.amount) {
              this.longestKill = {
                amount: dist, attacker: kl.name, victim: e.victimName ?? '—',
                weapon: e.weaponId, weaponName: e.weaponName, at: now, dist,
              };
              this.feed.push({ at: now, kind: 'record', text: `NEW LONGEST — ${kl.name} AT ${Math.round(dist)}m` });
            }
            this.feed.push({
              at: now, kind: 'kill',
              text: `${kl.name} ▸ ${e.victimName ?? '—'} · ${e.weaponName ?? 'unknown'}${dist ? ` · ${Math.round(dist)}m` : ''}`,
            });
          }
          break;
        }
        case 'downed': {
          const l = this.line(world, e.soldierId ?? -1);
          if (l) this.feed.push({ at: now, kind: 'down', text: `${l.name} IS DOWN — BLEEDING` });
          break;
        }
      }
    }

    // A CONNECTION IS THE HONEST HIT COUNT. The 'hit' event carries an
    // attacker only for some weapons, so keying accuracy off it read 0% for a
    // whole battle. A tick in which your blow landed on somebody is a tick in
    // which your round connected — and at 60Hz no gun fires twice in one, so
    // connections-over-rounds is the accuracy figure that is always live.
    const connected = new Set<number>();
    for (const f of folded.values()) connected.add(f.atk);
    for (const id of connected) {
      const l = this.fighters.get(id);
      if (l) l.hits++;
    }

    // now the folded blows are whole attacks — rank them
    for (const f of folded.values()) {
      this.blows++;
      const al = this.fighters.get(f.atk);
      if (!al) continue;
      const victim = this.fighters.get(f.vic)?.name ?? world.soldiers.get(f.vic)?.name ?? '—';
      const rec: BlowRecord = {
        amount: f.amount, attacker: al.name, victim, weapon: f.weapon, at: now,
      };
      if (f.amount > al.best) {
        al.best = f.amount;
        al.bestWeapon = f.weapon;
        al.bestVictim = victim;
      }
      if (!this.hardest || f.amount > this.hardest.amount) {
        this.hardest = rec;
        if (f.amount >= BLOW_FEED_FLOOR) {
          this.feed.push({ at: now, kind: 'record', text: `HARDEST YET — ${al.name} FOR ${Math.round(f.amount)}` });
        }
      }
      if (!this.recent || f.amount >= this.recent.amount || now - this.recent.at > 10) this.recent = rec;
      if (f.amount >= BLOW_FEED_FLOOR) {
        this.feed.push({ at: now, kind: 'blow', text: `${al.name} HIT ${victim} FOR ${Math.round(f.amount)}` });
      }
    }

    if (this.feed.length > 60) this.feed.splice(0, this.feed.length - 60);
  }

  /**
   * DEFENCE: punishment absorbed PER LIFE, plus the strikes actively turned
   * away by a raised guard.
   *
   * Plate is the obvious half, and it was the whole measure until a live
   * battle proved it useless: most fighters carry no armour and land no
   * melee, so "who had the best defence" sat blank for a whole match while
   * men were plainly surviving things. Standing up under fire IS defence.
   * Dividing what you soaked by the number of times you went down is the
   * figure that always has an answer and still means what the word means.
   */
  static defence(l: FighterLine): number {
    return (l.eaten + l.taken) / (l.deaths + 1) + l.blocks * 20;
  }

  /** The table, richest account first. */
  table(by: 'dealt' | 'kills' | 'taken' | 'defence' = 'dealt', n = 8): FighterLine[] {
    const key = (l: FighterLine) =>
      by === 'kills' ? l.kills : by === 'taken' ? l.taken : by === 'defence' ? CombatLedger.defence(l) : l.dealt;
    return [...this.fighters.values()]
      .filter((l) => key(l) > 0)
      .sort((a, b) => key(b) - key(a))
      .slice(0, n);
  }

  /** The best line by any measure, or undefined when nobody has done anything. */
  leader(by: (l: FighterLine) => number): FighterLine | undefined {
    let best: FighterLine | undefined;
    for (const l of this.fighters.values()) {
      if (by(l) <= 0) continue;
      if (!best || by(l) > by(best)) best = l;
    }
    return best;
  }

  reset(): void {
    this.fighters.clear();
    this.feed.length = 0;
    this.hardest = this.recent = this.longestKill = undefined;
    this.totalDamage = this.totalKills = this.blows = this.events = 0;
  }
}
