// ---------------------------------------------------------------------------
// THE $COST MODEL (Robert: "make sure we have $cost for everything that's
// balance"). One law, same as the rest of the Codex: every price is DERIVED
// from the item's own combat power — the sim's numbers, not a hand-typed table
// — so the price is balanced by construction and can never drift from the game.
// A stronger thing costs more because its numbers say so.
//
// Each per-category formula was derived from the real roster's stat
// distribution and validated so the ranking reads right end to end (weapons
// sidegrade-safe within 15% across a mark family; aircraft in the $2–3.5k band;
// god tiers non-overlapping). Inputs are the Codex's own derived rows.
// ---------------------------------------------------------------------------
import type { VehicleDef } from '../sim/types';

/** Credits, grouped for readability: 1240 → "$1,240". */
export function fmtCost(n: unknown): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

type Any = Record<string, unknown>;
const num = (v: unknown, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

/** WEAPONS — a sum of dollar-valued capabilities: LINEAR sustained DPS (sidearms
 *  stay cheap), superlinear reach, saturating anti-armor, splash/hitscan/knock
 *  premiums, minus a reload penalty. Every mark-varying term is compressed (√)
 *  and the reload penalty RISES with mark, so a higher mark's damage bump is
 *  cancelled by its smaller clip + slower reload — the sidegrade law, priced.
 *  LSW signature arms remap onto their own top band. ~[80, 2800]. */
export function weaponCost(r: Any): number {
  const overkill = num(r.damage) >= 900;                       // paint/training 999 ≠ combat value
  const dps = overkill ? Math.min(num(r.rof) * 22, 110) : num(r.dps);
  const range = num(r.range);
  const splash = num(r.splash);
  const splashDmg = Math.min(num(r.splashDamage), 120);
  const knock = num(r.knockback);
  const clip = num(r.clip, 60);                                // ∞ mag reads as a big finite belt
  const buggy = overkill ? 40 : num(r.buggy, 40);             // ∞/paint = no anti-armor
  const hitscan = num(r.speed) >= 200;
  const isLsw = String(r.id).startsWith('lsw_') || r.family === 'lsw';
  const cost0 = 60
    + 1.7 * Math.min(dps, 160)                                 // sustained lethality (linear → sidearms cheap)
    + 1.25 * Math.pow(Math.max(0, Math.min(range, 125) - 40), 1.6) // reach: ~0 CQC, superlinear for snipers
    + 0.9 * (240 / (buggy + 2))                                // anti-vehicle, saturating
    + 25 * splash + 12 * Math.sqrt(splashDmg)                  // AoE denial
    + (hitscan ? 380 : 0)                                      // instant hit — rails/lasers/beams
    + 3 * knock + (r.ragdolls ? 30 : 0)                        // space control
    + 22 * Math.sqrt(Math.max(0, Math.min(clip, 120) - 12))    // deep mags/belts over a sidearm floor
    - 26 * Math.min(num(r.reloadTime), 5);                     // slow reload is a real cost; rises with mark
  const cost = isLsw ? 1660 + 0.58 * cost0 : cost0;            // god-fists into their own band
  return Math.max(80, Math.min(2800, Math.round(cost)));
}

/** VEHICLES — effective HP is the spine, priced SUPERLINEARLY (ehp^1.5) so
 *  armour costs disproportionately more; DPS×reach + speed layer on, then flat
 *  capability premiums (flies, AA, bombs, mobile-spawn, stealth, sub, heal,
 *  dig, crew seats). Aircraft land ~$2–3.5k, heavies to ~$6.2k. ~[500, 6500]. */
export function vehicleCost(r: Any, def: VehicleDef): number {
  let chassis = 0.16 * Math.pow(num(r.ehp), 1.5);
  if (def.immobile) chassis *= 0.5;                            // a static gun can't reposition its armour
  let cost = 200 + chassis
    + 1.3 * num(r.dps) * (0.6 + num(r.range) / 150)            // firepower weighted by reach
    + 11 * num(r.speed);
  if (r.flies) cost += 1150;
  if (r.antiAir) cost += 650;
  cost += 120 * num(r.bombs);
  if (r.mobileSpawn) cost += 450;
  if (def.stealth) cost += 1400;
  if (def.submersible) cost += 950;
  if (def.healRadius) cost += 550;
  if (def.digs) cost += 500;
  cost += 45 * Math.max(0, num(r.seats) - 2);
  return Math.round(Math.max(500, Math.min(6500, cost)) / 25) * 25;
}

/** INFANTRY CLASSES — survivability + sustained primary DPS + reach + elite
 *  legs, with a premium for a team-utility kit (medic/engineer/recon) and half
 *  that for a strong personal ability. ~[200, 900]. */
export function classCost(r: Any): number {
  let v = 80 + (num(r.hp) - 90) * 5 + (num(r.pdps) - 55) * 6
    + (num(r.prange) - 40) * 1.5 + Math.max(0, num(r.sprint) - 13) * 34;
  const kit = `${r.abilityName ?? ''} ${r.secondaryName ?? ''}`.toLowerCase();
  if (/medi|heal|repair|sentry|turret|mine|drone|recon|warp|beacon|target/.test(kit)) v += 280;
  else if (/shield|dome|cloak|jet/.test(kit)) v += 150;
  return Math.max(200, Math.min(900, Math.round(v)));
}

/** ASCENDANTS (gods) — premium, rare. ~90% threat-tier HP (so the tiers fall
 *  into non-overlapping bands), plus the signature arm's DPS, sheer size, and a
 *  ×1.1 flight multiplier deciding the order within a tier. ~[9k, 45k]. */
export function ascendantCost(r: Any): number {
  let v = 700 + num(r.hp) * 11 + Math.max(0, num(r.armDps) - 95) * 40
    + Math.max(0, num(r.scale) - 1.25) * 5000;
  if (r.flies) v *= 1.1;
  return Math.max(9000, Math.min(45000, Math.round(v)));
}

/** THREATS — the $ BOUNTY for a kill (the natural "$" for an enemy you don't
 *  buy). Durability (hp+plate) super-linearly, plus the sim's own kill-score
 *  and a speed premium; Iron Eaters pay extra for the molt. ~[5, 150]. */
export function threatBounty(r: Any): number {
  const pool = num(r.hp) + num(r.plate);
  let v = 0.018 * Math.pow(pool, 1.35) + num(r.score) * 0.35 + Math.max(0, num(r.speed) - 8) * 0.9;
  if (r.family === 'Iron Eater') v += 4;
  return Math.max(5, Math.min(150, Math.round(v)));
}
