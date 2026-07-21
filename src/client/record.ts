import type { ClassId, ModeId, SimEvent, Team } from '../sim/types';
import type { World } from '../sim/world';

// ---------------------------------------------------------------------------
// The Record (DD §3.4, Slice 1) — the Dossier: one versioned document holding
// a soldier's whole career. Fed by the SAME event stream the HUD reads,
// folded during the match, checkpointed against crashes, merged at the
// whistle. The sim is untouched — this is presentation-side persistence,
// shaped for Stage-3 server sync from day one.
// ---------------------------------------------------------------------------

export interface ClassRecord { kills: number; deaths: number; time: number; wins: number; matches: number }
export interface WeaponRecord { kills: number; longestHit: number; matches: number }
export interface MedalAward { id: string; name: string; icon: string; earnedAt: number; matchRef: string }
export interface JournalEntry { text: string; at: number; matchRef: string }
export interface QualRecord { score: number; percentile: number; grade: string; firstAttemptAt: number }

export interface Dossier {
  v: 1;
  soldier: { callsign: string; created: number; rankPoints: number;
    /** B1: underfunded victories bank morale — the officer's proof his side
     *  fights above its budget. Spent as opening materiel on later deploys. */
    morale?: number };
  tours: { faction: Team; season: number; startedAt: number }[];
  lifetime: {
    matches: number; wins: number; kills: number; deaths: number; score: number;
    perClass: Partial<Record<ClassId, ClassRecord>>;
    perWeapon: Record<string, WeaponRecord>;
  };
  /** §3.1 personal armory — weapons with service history (carried into battle) */
  armory: string[];
  quals: Partial<Record<ClassId, QualRecord>>;
  medals: MedalAward[];
  journal: JournalEntry[];
}

export function freshDossier(callsign: string): Dossier {
  return {
    v: 1,
    soldier: { callsign, created: Date.now(), rankPoints: 0 },
    tours: [{ faction: 0, season: 1, startedAt: Date.now() }],
    lifetime: { matches: 0, wins: 0, kills: 0, deaths: 0, score: 0, perClass: {}, perWeapon: {} },
    armory: [],
    quals: {},
    medals: [],
    journal: [],
  };
}

// ---- rank ladder: points buy the record a name --------------------------------
export const RANKS = [
  { name: 'Private', at: 0 },
  { name: 'Lance Corporal', at: 150 },
  { name: 'Corporal', at: 400 },
  { name: 'Sergeant', at: 800 },
  { name: 'Staff Sergeant', at: 1400 },
  { name: 'Sergeant First Class', at: 2200 },
  { name: 'Master Sergeant', at: 3200 },
  { name: 'First Sergeant', at: 4500 },
  { name: 'Sergeant Major', at: 6000 },
  { name: 'Lieutenant', at: 8000 },
  { name: 'Captain', at: 10500 },
  { name: 'Major', at: 13500 },
  { name: 'Lieutenant Colonel', at: 17000 },
  { name: 'Colonel', at: 21000 },
] as const;

export function rankFor(points: number): { name: string; index: number; next: number | null } {
  let i = 0;
  while (i + 1 < RANKS.length && points >= RANKS[i + 1].at) i++;
  return { name: RANKS[i].name, index: i, next: i + 1 < RANKS.length ? RANKS[i + 1].at : null };
}

/** W3.9 — the INSIGNIA, in the HUD's own mono vocabulary (no emoji):
 *  enlisted wear chevrons (▴×1-6), senior NCOs a diamond over chevrons
 *  (◆, ◆▴, ◆▴▴), officers wear bars (▮×1-5). A Private wears the dot —
 *  everyone starts a mark. All fourteen are distinct at a glance. */
export function rankInsignia(index: number): string {
  if (index <= 0) return '·';
  if (index <= 6) return '▴'.repeat(index);
  if (index <= 8) return '◆' + '▴'.repeat(index - 7 + 1);
  return '▮'.repeat(index - 8);
}

// ---- storage: IndexedDB, same pattern the Sound Lab proved -------------------
const IDB_NAME = 'ww_dossier';
const IDB_STORE = 'dossier';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDossier(callsign: string): Promise<Dossier> {
  try {
    const db = await openDb();
    const d = await new Promise<Dossier | undefined>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get('me');
      req.onsuccess = () => resolve(req.result as Dossier | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (d && d.v === 1) {
      d.soldier.callsign = callsign || d.soldier.callsign; // callsign follows the player
      return d;
    }
  } catch { /* first boot, private browsing, or node — a fresh record */ }
  return freshDossier(callsign);
}

export async function saveDossier(d: Dossier): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(d, 'me');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch { /* storage unavailable — the match still plays */ }
}

// ---- the match tracker: fold the war as it happens ---------------------------

export interface MatchSummary {
  kills: number; deaths: number; score: number; won: boolean | null;
  rankPointsGained: number; rankBefore: string; rankAfter: string;
  medals: MedalAward[]; journal: JournalEntry[];
}

interface TeammateDeath { killerName: string; victimName: string; at: number }

const MEDAL_DEFS = {
  first_blood: { name: 'First Blood', icon: '🩸' },
  marksman: { name: 'Marksman', icon: '🎯' },
  iron_defender: { name: 'Iron Defender', icon: '🛡️' },
  tank_killer: { name: 'Tank Killer', icon: '💥' },
  purple_heart: { name: 'Combat Wound Badge', icon: '🎗️' }, // no purple in this army
  medics_cross: { name: "Medic's Cross", icon: '⚕️' },
  grenadier: { name: 'Grenadier', icon: '🧨' },
  avenger: { name: 'Avenger', icon: '⚔️' },
} as const;

export class MatchTracker {
  private kills = 0;
  private deaths = 0;
  private byWeapon = new Map<string, number>();
  private longestHit = 0;
  private firstBlood = false;
  private sawAnyKill = false;
  private fragTimes: number[] = [];
  private grenadier = false;
  private avenged = false;
  private teammateDeaths: TeammateDeath[] = [];
  /** AAR v2 (Robert: "way more details"): your duels — who you killed most
   *  (your PREY) and who killed you most (your NEMESIS), off the DeathReport. */
  private myVictims = new Map<string, number>();
  private myKillers = new Map<string, number>();
  private hillHold = 0;
  private lowHpThisLife = false;
  private woundSurvived = false;
  private startVehicleKills = -1;
  private startHealGiven = -1;
  private startScore = -1;
  private lastCheckpoint = 0;
  private finalized = false;
  readonly matchRef: string;

  constructor(
    private dossier: Dossier,
    private me: string,
    private classId: ClassId,
    private mode: ModeId,
    seed: number,
  ) {
    this.matchRef = `${mode}:${seed}:${Date.now()}`;
  }

  /** Fold this frame's events — the same array the HUD just consumed. */
  applyEvents(events: SimEvent[], world: World, meId: number) {
    const meS = world.soldiers.get(meId);
    if (meS && this.startScore < 0) {
      this.startScore = meS.score;
      this.startVehicleKills = meS.vehicleKills;
      this.startHealGiven = meS.healGiven;
    }
    for (const e of events) {
      if (e.type !== 'death') continue;
      const mine = e.killerName === this.me;
      if (!this.sawAnyKill && e.killerName) {
        this.sawAnyKill = true;
        if (mine) this.firstBlood = true;
      }
      if (mine) {
        this.kills++;
        const w = e.weaponName ?? 'unknown';
        this.byWeapon.set(w, (this.byWeapon.get(w) ?? 0) + 1);
        if (e.victimName) this.myVictims.set(e.victimName, (this.myVictims.get(e.victimName) ?? 0) + 1);
        if (meS && e.pos) {
          const d = Math.hypot(e.pos.x - meS.pos.x, e.pos.z - meS.pos.z);
          if (d > this.longestHit) this.longestHit = Math.round(d * 10) / 10;
        }
        // grenadier: two frag-launcher kills inside 1.5s of sim time
        if ((e.weaponName ?? '').includes('GL-40') || (e.weaponName ?? '').toLowerCase().includes('frag')) {
          this.fragTimes.push(world.time);
          const n = this.fragTimes.length;
          if (n >= 2 && this.fragTimes[n - 1] - this.fragTimes[n - 2] <= 1.5) this.grenadier = true;
        }
        // avenger: dropped a teammate's killer within 20s
        if (this.teammateDeaths.some((t) => t.killerName === e.victimName && world.time - t.at <= 20)) {
          this.avenged = true;
        }
      }
      if (e.victimName === this.me) {
        this.deaths++;
        this.lowHpThisLife = false; // that life's story ended
        if (e.killerName && e.killerName !== this.me) this.myKillers.set(e.killerName, (this.myKillers.get(e.killerName) ?? 0) + 1);
      } else if (e.killerName && e.victimName && meS && e.killerTeam !== undefined && e.killerTeam !== meS.team) {
        // a teammate fell — remember who to hunt
        this.teammateDeaths.push({ killerName: e.killerName, victimName: e.victimName, at: world.time });
      }
    }
  }

  /** THE AAR VIEWS (Robert: "at the end of the match we need WAY more
   *  details — we captured rich data, show rich stuff"). Read-only windows
   *  into what the tracker already hoarded, for the closing screen. */
  weaponLines(): { weapon: string; kills: number }[] {
    return [...this.byWeapon].map(([weapon, kills]) => ({ weapon, kills }))
      .sort((a, b) => b.kills - a.kills || a.weapon.localeCompare(b.weapon));
  }

  get longestHitDist(): number { return this.longestHit; }

  /** Your NEMESIS (killed you most) and your PREY (you killed most) — the two
   *  faces of the match's grudge, for the AAR. Ties break most-recent-first
   *  via Map insertion order. */
  nemesis(): { name: string; n: number } | null {
    let best: { name: string; n: number } | null = null;
    for (const [name, n] of this.myKillers) if (!best || n > best.n) best = { name, n };
    return best && best.n >= 2 ? best : null; // one kill isn't a nemesis
  }
  prey(): { name: string; n: number } | null {
    let best: { name: string; n: number } | null = null;
    for (const [name, n] of this.myVictims) if (!best || n > best.n) best = { name, n };
    return best && best.n >= 2 ? best : null;
  }

  /** The match's story beats, as chips. */
  moments(): string[] {
    const out: string[] = [];
    if (this.firstBlood) out.push('🩸 FIRST BLOOD');
    if (this.grenadier) out.push('💣 GRENADIER — doubled with the frag');
    if (this.avenged) out.push('⚔ AVENGER — dropped a teammate\'s killer');
    if (this.woundSurvived) out.push('🩹 WALKED IT OFF — back from under 10hp');
    if (this.hillHold >= 20) out.push(`⛰ HELD THE HILL — ${Math.round(this.hillHold)}s`);
    // multikill: the densest 4s window of frags across ALL weapons is caught
    // by fragTimes only for launchers — read kill cadence from byWeapon totals
    return out;
  }

  /** Per-frame accumulation: hill holds and near-death survivals. */
  update(world: World, meId: number, dt: number) {
    const meS = world.soldiers.get(meId);
    if (!meS) return;
    if (this.mode === 'koth' && world.mode.hillHolder === meS.team && meS.alive) {
      const d = Math.hypot(meS.pos.x - world.map.hillPos.x, meS.pos.z - world.map.hillPos.z);
      if (d < 11) this.hillHold += dt;
    }
    if (meS.alive && meS.hp > 0) {
      if (meS.hp < 10) this.lowHpThisLife = true;
      else if (this.lowHpThisLife && meS.hp >= meS.maxHp * 0.5) this.woundSurvived = true;
    }
    // crash-safety checkpoint: fold what we have every 30s
    if (world.time - this.lastCheckpoint >= 30) {
      this.lastCheckpoint = world.time;
      void saveDossier(this.foldInto(structuredClone(this.dossier), world, meId, null));
    }
  }

  private earnedMedals(world: World, meId: number): MedalAward[] {
    const meS = world.soldiers.get(meId);
    const out: MedalAward[] = [];
    const award = (id: keyof typeof MEDAL_DEFS) =>
      out.push({ id, ...MEDAL_DEFS[id], earnedAt: Date.now(), matchRef: this.matchRef });
    if (this.firstBlood) award('first_blood');
    if (this.longestHit >= 60) award('marksman');
    if (this.hillHold >= 60) award('iron_defender');
    if (meS && this.startVehicleKills >= 0 && meS.vehicleKills - this.startVehicleKills >= 3) award('tank_killer');
    if (this.woundSurvived) award('purple_heart');
    if (meS && this.startHealGiven >= 0 && meS.healGiven - this.startHealGiven >= 300) award('medics_cross');
    if (this.grenadier) award('grenadier');
    if (this.avenged) award('avenger');
    return out;
  }

  private journalEntries(world: World, won: boolean | null, medals: MedalAward[]): JournalEntry[] {
    const out: JournalEntry[] = [];
    const at = Date.now();
    const add = (text: string) => out.push({ text, at, matchRef: this.matchRef });
    const modeName = this.mode.toUpperCase();
    if (won === true) add(`Won the ${modeName} at ${world.map.theme} — ${this.kills} kills, ${this.deaths} deaths.`);
    else if (won === false) add(`Lost the ${modeName} at ${world.map.theme} — held the line for ${this.kills} kills.`);
    else add(`Fought the ${modeName} at ${world.map.theme} to the whistle.`);
    if (this.deaths === 0 && this.kills > 0) add('Walked out without a scratch on the record — not one death.');
    if (this.longestHit >= 60) add(`Connected from ${this.longestHit}u out. They never saw it.`);
    if (this.hillHold >= 60) add(`Held the hill for ${Math.round(this.hillHold)} seconds of the war.`);
    if (this.avenged) add('A teammate went down. Their killer followed inside twenty seconds.');
    for (const m of medals) if (m.id === 'purple_heart') add('Bled below ten points of life and fought back to standing.');
    const bestWeapon = [...this.byWeapon.entries()].sort((a, b) => b[1] - a[1])[0];
    if (bestWeapon && bestWeapon[1] >= 3) add(`The ${bestWeapon[0]} did the talking: ${bestWeapon[1]} kills.`);
    return out.slice(0, 5);
  }

  /** Merge tracker state into a dossier object (pure — used by checkpoints and finalize). */
  private foldInto(d: Dossier, world: World, meId: number, _won: boolean | null): Dossier {
    const meS = world.soldiers.get(meId);
    const scoreDelta = meS && this.startScore >= 0 ? Math.max(0, meS.score - this.startScore) : 0;
    d.lifetime.kills += this.kills;
    d.lifetime.deaths += this.deaths;
    d.lifetime.score += scoreDelta;
    const cls = (d.lifetime.perClass[this.classId] ??= { kills: 0, deaths: 0, time: 0, wins: 0, matches: 0 });
    cls.kills += this.kills;
    cls.deaths += this.deaths;
    cls.time += world.time;
    for (const [w, k] of this.byWeapon) {
      const rec = (d.lifetime.perWeapon[w] ??= { kills: 0, longestHit: 0, matches: 0 });
      rec.kills += k;
      if (this.longestHit > rec.longestHit) rec.longestHit = this.longestHit;
      if (!d.armory.includes(w)) d.armory.push(w); // carried into battle = service history
    }
    d.soldier.rankPoints += scoreDelta;
    return d;
  }

  /** The whistle: fold everything, mint medals + journal, persist. Idempotent. */
  async finalize(world: World, meId: number): Promise<MatchSummary | null> {
    if (this.finalized) return null;
    this.finalized = true;
    const meS = world.soldiers.get(meId);
    const won = world.mode.winner === undefined || world.mode.winner === -1 || !meS
      ? null : world.mode.winner === meS.team;
    const rankBefore = rankFor(this.dossier.soldier.rankPoints).name;
    const medals = this.earnedMedals(world, meId);
    const journal = this.journalEntries(world, won, medals);
    this.foldInto(this.dossier, world, meId, won);
    this.dossier.lifetime.matches++;
    if (won === true) {
      this.dossier.lifetime.wins++;
      const cls = this.dossier.lifetime.perClass[this.classId];
      if (cls) cls.wins++;
    }
    const clsRec = this.dossier.lifetime.perClass[this.classId];
    if (clsRec) clsRec.matches++;
    for (const [w] of this.byWeapon) {
      const rec = this.dossier.lifetime.perWeapon[w];
      if (rec) rec.matches++;
    }
    this.dossier.medals.push(...medals);
    this.dossier.journal.unshift(...journal);
    if (this.dossier.journal.length > 200) this.dossier.journal.length = 200;
    this.dossier.soldier.rankPoints += medals.length * 25;
    await saveDossier(this.dossier);
    const meScore = meS && this.startScore >= 0 ? Math.max(0, meS.score - this.startScore) : 0;
    return {
      kills: this.kills, deaths: this.deaths, score: meScore, won,
      rankPointsGained: meScore + medals.length * 25,
      rankBefore, rankAfter: rankFor(this.dossier.soldier.rankPoints).name,
      medals, journal,
    };
  }
}
