// ═══════════════════════════════════════════════════════════════════════════
// THE CAREER — the sheet between deployments.
//
// Robert: *"obsess over getting our stats system on point and wired into the
// game in a satisfying way."*
//
// The audit that started this found the system was wired to a soldier who
// forgot everything. Two facts, both measured:
//
//   1. THE PLAYER HAD NO STATS. `world.ts` hardcoded every human to a flat 5,
//      and statMul(5) / statQuick(5) are EXACTLY 1.000 at every strength — so
//      all nine stat hooks multiplied by one. Eight named stats, none of which
//      could ever change anything for the person actually playing.
//   2. THE PLAYER HAD NO MEMORY. `s.skill` was copied from the hometown grant
//      at spawn and never written back. Twenty-five save stores existed; not
//      one held a skill. Every trade was re-earned from 30 and deleted at the
//      whistle.
//
// This file is the answer to both. It owns the READ (what the sim is handed on
// the way in) and the WRITE (what the deploy is worth on the way out), so no
// other file has to know the shape of a career.
//
// It never touches the sim. Values enter through `WorldOptions` — the same
// door `papers`, `rank` and `clockPhase` already come through — so the tick
// loop stays the pure function it claims to be, and nothing here can desync a
// multiplayer match: the sheet is not in the snapshot at all.
// ═══════════════════════════════════════════════════════════════════════════
import { BANDS, RUST_GRACE, SKILL_IDS, rust, skillLevel } from '../sim/skills';
import type { SkillId, SoldierStats } from '../sim/types';
import { FRESH_STATS, type Dossier, type TradeLedger } from './record';

const blank = (): TradeLedger => ({ practice: 0, peak: 0, idle: 0 });

/**
 * THE CURRENT SHEET, for read-only surfaces.
 *
 * The dossier lives in IndexedDB and is loaded asynchronously at boot, so a
 * synchronous painter (the service file, the GONET tab) cannot go and fetch it.
 * `main.ts` owns the document and publishes it here whenever it changes; every
 * read-only surface takes it from this one place rather than growing its own
 * copy or its own loader.
 */
let current: Dossier | null = null;
export const publishCareer = (d: Dossier | null): void => { current = d; };
export const currentCareer = (): Dossier | null => current;

/** What one deploy did to the sheet, in the order a person would ask about it. */
export interface DeployDelta {
  /** trades that gained ground this deploy */
  gained: Array<{ id: SkillId; from: number; to: number; band: number; crossed: boolean }>;
  /** trades that went backwards because you have not touched them */
  rusted: Array<{ id: SkillId; lost: number; idle: number; band: number }>;
}

/**
 * THE WAY IN. The sheet the sim should start this deploy with.
 *
 * Merged OVER the hometown grant rather than replacing it: where you are from
 * is a floor you can never fall below, so the two skills your town put in your
 * hands stay yours even after a career of ignoring them.
 */
export function careerSkills(
  d: Dossier | null,
  hometown: Partial<Record<SkillId, number>> | undefined,
): Partial<Record<SkillId, number>> | undefined {
  const trades = d?.lifetime.trades;
  if (!trades || Object.keys(trades).length === 0) return hometown;
  const out: Partial<Record<SkillId, number>> = { ...(hometown ?? {}) };
  for (const id of SKILL_IDS) {
    const t = trades[id];
    if (!t) continue;
    out[id] = Math.max(out[id] ?? 0, t.practice);
  }
  return out;
}

/** THE WAY IN, for the eight. A career with no sheet reads as the neutral 5s. */
export const careerStats = (d: Dossier | null): SoldierStats =>
  ({ ...FRESH_STATS(), ...(d?.lifetime.stats ?? {}) });

/**
 * THE WAY OUT. Fold one finished deploy into the career and say what changed.
 *
 * `sheet` is the soldier's skills as they stood at the whistle — the numbers
 * that used to be dropped on the floor. Every trade he used banks the ground
 * it gained and has its idle counter cleared; every trade he did not use ages
 * one deploy and, past the grace period, gives some momentum back.
 *
 * Returns the delta so the after-action can show it. Decay you WATCH is a
 * scoreboard; decay you discover later is theft.
 */
export function bankDeploy(
  d: Dossier,
  sheet: Partial<Record<SkillId, number>> | undefined,
  seed: Partial<Record<SkillId, number>> | undefined,
): DeployDelta {
  const trades = d.lifetime.trades;
  const delta: DeployDelta = { gained: [], rusted: [] };

  for (const id of SKILL_IDS) {
    const before = trades[id] ?? blank();
    const now = sheet?.[id] ?? 0;
    // "USED IT" MEANS YOU GAINED GROUND DURING THE MATCH — measured against the
    // sheet the sim was actually HANDED, not against what the career held.
    //
    // Measured the other way first, and it sawtoothed: `careerSkills` floors
    // every trade at the hometown grant, so a trade rusted below 30 came back
    // at 30 on the next deploy, read as "used", cleared its idle counter, and
    // rusted again — a skill nobody had touched in a month oscillating forever
    // just under its birthright. What the town gave you is a floor, not a rep.
    const used = now > (seed?.[id] ?? 0);

    if (used) {
      const t: TradeLedger = {
        practice: Math.max(before.practice, now),
        peak: Math.max(before.peak, now),
        idle: 0,
      };
      trades[id] = t;
      const fromBand = skillLevel(before.practice);
      const toBand = skillLevel(t.practice);
      delta.gained.push({
        id, from: before.practice, to: t.practice, band: toBand,
        crossed: toBand > fromBand,
      });
    } else if (before.practice > 0) {
      const idle = before.idle + 1;
      const after = rust(before.practice, before.peak, idle);
      trades[id] = { practice: after, peak: before.peak, idle };
      if (after < before.practice) {
        delta.rusted.push({
          id, lost: Math.round(before.practice - after), idle, band: skillLevel(after),
        });
      }
    }
  }
  return delta;
}

/** Trades that have started to go, worst first — what a training officer would nag about. */
export function rustingTrades(d: Dossier | null): Array<{ id: SkillId; idle: number }> {
  const trades = d?.lifetime.trades;
  if (!trades) return [];
  return SKILL_IDS
    .map((id) => ({ id, idle: trades[id]?.idle ?? 0, practice: trades[id]?.practice ?? 0 }))
    .filter((t) => t.practice > 0 && t.idle >= RUST_GRACE)
    .sort((a, b) => b.idle - a.idle)
    .map(({ id, idle }) => ({ id, idle }));
}

/**
 * THE BANDS YOU HOLD, right now — a SNAPSHOT, never a running sum.
 *
 * This exists because of a real defect it replaces. The service tally did
 * `t.skillBands += bandsThisMatch`, where the count was recomputed each match
 * from a soldier who always restarted at his hometown's 30 — so a per-match
 * figure was being added as if it were an increment, and rank (8 service points
 * a band) inflated by your whole band total on every single deploy, forever,
 * whether or not you had learned anything. A career total must be READ from the
 * career, not accumulated from snapshots of it.
 */
export function careerBands(d: Dossier | null): number {
  const trades = d?.lifetime.trades;
  if (!trades) return 0;
  return SKILL_IDS.reduce((n, id) => n + skillLevel(trades[id]?.practice ?? 0), 0);
}

/** the raw practice a band is worth — for progress bars in the file */
export const bandFloor = (level: number): number => BANDS[Math.max(0, Math.min(BANDS.length - 1, level))];

/**
 * WHAT THIS DEPLOYMENT TAUGHT YOU — the after-action row.
 *
 * This is the beat the system never had: the moment where the last twelve
 * minutes turn into something you keep. A band crossed gets said out loud; the
 * rest is a quiet ledger line. Rust is printed in the same breath, because
 * decay you WATCH is a scoreboard and decay you find out about later is theft.
 */
export function deployDeltaHtml(d: DeployDelta): string {
  if (!d.gained.length && !d.rusted.length) return '';
  const crossed = d.gained.filter((g) => g.crossed);
  const rows: string[] = [];

  if (crossed.length) {
    rows.push('<p class="cp-row"><b>⌁ ' + crossed
      .map((g) => `${SKILL_LABEL[g.id]} — ${BAND_LABEL[g.band]}`)
      .join(' · ') + '</b></p>');
  }
  const quiet = d.gained.filter((g) => !g.crossed && g.to > g.from);
  if (quiet.length) {
    rows.push('<p class="cp-row">' + quiet
      .map((g) => `${SKILL_LABEL[g.id]} +${Math.round(g.to - g.from)}`)
      .join(' · ') + '</p>');
  }
  if (d.rusted.length) {
    rows.push('<p class="cp-row" style="opacity:0.72">RUSTING — ' + d.rusted
      .map((r) => `${SKILL_LABEL[r.id]} −${r.lost} (${r.idle} deploys idle)`)
      .join(' · ') + '</p>');
  }
  return rows.join('');
}

/** the trades, in the words a soldier would use */
export const SKILL_LABEL: Record<SkillId, string> = {
  rifle: 'RIFLE', smg: 'SMG', lmg: 'LMG', sniper: 'SNIPER', rocket: 'ROCKET',
  knife: 'KNIFE', pistol: 'PISTOL', tank_driver: 'TANK DRIVER', tank_gunner: 'TANK GUNNER',
  helicopter: 'HELICOPTER', jet: 'JET', boat: 'BOAT', engineer: 'ENGINEER',
  medic: 'MEDIC', dog_handler: 'DOG HANDLER', drone_pilot: 'DRONE PILOT',
  radio_operator: 'RADIO', commander: 'COMMANDER', navigator: 'NAVIGATOR',
  mechanic: 'MECHANIC', explosives: 'EXPLOSIVES', scout: 'SCOUT',
};

/** the five rungs, named */
export const BAND_LABEL = ['UNTRAINED', 'FAMILIAR', 'PRACTISED', 'SKILLED', 'EXPERT', 'MASTER'];
