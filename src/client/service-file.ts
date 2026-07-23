// ---------------------------------------------------------------------------
// YOUR SERVICE FILE (high-code #10) — everything the account has earned, on
// one page.
//
// Four systems shipped their own storage this session and none of them had a
// home the player could read: LICENCES (the schools), RECORDS (the board),
// THE TREASURY (the government), and FITS (the garage). A thing you earned
// and cannot look at is a thing you did not earn. This is the file — the
// same tactical-terminal dossier voice as the front door's identity strip.
//
// Read-only, derived, no new truth: every figure comes from the module that
// owns it.
// ---------------------------------------------------------------------------
import { LICENCES, licenceChain, type LicenceId } from '../sim/licenses';
import { COURSES } from '../sim/courses';
import { VEHICLES } from '../sim/data';
import { loadLicences } from './licences';
import { allRecords } from './records';
import { treasuryFor, budgetMultiplier } from './treasury';
import { loadFits } from './garage-ui';
import { loadIdentity } from './identity';
import { board } from './service';
import { SERVICE_POINTS } from '../sim/ranks';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function papersHtml(): string {
  const rec = loadLicences();
  const all = (Object.keys(COURSES) as LicenceId[]);
  const held = all.filter((id) => rec.held.includes(id));
  const rows = all.map((id) => {
    const has = rec.held.includes(id);
    const best = rec.best[id];
    // the next rung you could take, named — never a locked door with no sign
    const chain = licenceChain(id);
    const missing = chain.slice(0, -1).filter((s) => !rec.held.includes(s));
    const state = has ? '<span class="sf-yes">CERTIFIED</span>'
      : missing.length ? `<span class="sf-no">needs ${esc(LICENCES[missing[0]].name)}</span>`
        : '<span class="sf-open">open</span>';
    return `<div class="sf-row"><span>${esc(LICENCES[id].name)}</span>${state}`
      + `<span class="sf-fig">${best !== undefined ? `${Math.round(best)}s` : '—'}</span></div>`;
  }).join('');
  return `<div class="sf-block"><h4>PAPERS <i>${held.length} / ${all.length}</i></h4>${rows}</div>`;
}

function recordsHtml(): string {
  const recs = allRecords();
  const rows = recs.length
    ? recs.slice(0, 8).map((r) => `<div class="sf-row"><span>${esc(r.trackId)}</span>`
      + `<span class="sf-no">${r.cls.toUpperCase()}</span>`
      + `<span class="sf-fig">${r.lap > 0 ? `${r.lap.toFixed(1)}s` : '—'}</span></div>`).join('')
    : '<div class="sf-empty">No times filed. Every track is open.</div>';
  return `<div class="sf-block"><h4>THE BOARD <i>${recs.length}</i></h4>${rows}</div>`;
}

function chestHtml(): string {
  const id = loadIdentity();
  if (!id) return '';
  const t = treasuryFor(id.faction);
  const mult = budgetMultiplier(id.faction);
  const band = mult >= 1.25 ? 'the whole stable' : mult >= 1 ? 'a full manifest'
    : mult >= 0.8 ? 'a lean manifest' : 'what is left in the shed';
  return `<div class="sf-block"><h4>THE WAR CHEST</h4>`
    + `<div class="sf-row"><span>Balance</span><span class="sf-fig">${t.balance.toLocaleString()}</span></div>`
    + `<div class="sf-row"><span>Record</span><span class="sf-fig">${t.wins}W · ${t.losses}L</span></div>`
    + `<div class="sf-row"><span>Your government funds</span><span class="sf-no">${band}</span></div>`
    + `<div class="sf-note">${esc(t.lastReason)}</div></div>`;
}

function garageHtml(): string {
  const fits = loadFits();
  const kinds = Object.keys(fits);
  if (!kinds.length) return '<div class="sf-block"><h4>THE GARAGE</h4><div class="sf-empty">Nothing built yet. Pick a machine and open the garage.</div></div>';
  const rows = kinds.map((k) => {
    const f = fits[k];
    return `<div class="sf-row"><span>${esc(VEHICLES[k as keyof typeof VEHICLES]?.name ?? k)}</span>`
      + `<span class="sf-no">${esc(f.tires)} · ${esc(f.engine)}</span>`
      + `<span class="sf-fig">${f.cargo.length ? esc(f.cargo.join('+')) : '—'}</span></div>`;
  }).join('');
  return `<div class="sf-block"><h4>THE GARAGE <i>${kinds.length}</i></h4>${rows}</div>`;
}

/**
 * THE PROMOTION BOARD — the room behind the word "Eligible".
 *
 * The GONET desk has advertised a promotion board since the day it was built
 * and there was nothing behind it. Rank is read off SERVICE (ranks.ts), and
 * what a rank grants is AUTHORITY, never numbers — so the board shows what you
 * are trusted with, and exactly what the next rung would add.
 */
function boardHtml(): string {
  const b = board();
  const r = b.record;
  const rows: Array<[string, number, number]> = [
    ['Matches fought', r.matches, SERVICE_POINTS.matchFought],
    ['Won', r.wins, SERVICE_POINTS.matchWon],
    ['Kills', r.kills, SERVICE_POINTS.kill],
    ['Certifications', r.certifications, SERVICE_POINTS.certification],
    ['Times on the board', r.trackRecords, SERVICE_POINTS.trackRecord],
    ['Decorations', r.medals, SERVICE_POINTS.medal],
    ['Skill bands', r.skillBands, SERVICE_POINTS.skillBand],
  ];
  const bar = b.next
    ? `<div class="sf-rankbar"><i style="width:${(b.next.progress * 100).toFixed(1)}%"></i></div>`
    : '';
  return `<div class="sf-block sf-rank">
      <h4>THE PROMOTION BOARD <i>${b.score.toLocaleString()} service</i></h4>
      <div class="sf-rankname">${esc(b.rank.name.toUpperCase())}</div>
      <div class="sf-grants">${esc(b.rank.grants)}</div>
      ${bar}
      <div class="sf-note">${esc(b.verdict)}</div>
      ${b.next ? `<div class="sf-next"><b>${esc(b.next.rank.name.toUpperCase())} WOULD GRANT</b><span>${esc(b.next.rank.grants)}</span></div>` : ''}
      <div class="sf-auth">
        <span class="${b.mayCallStable ? 'sf-yes' : 'sf-no'}">${b.mayCallStable ? 'MAY CALL THE STABLE' : 'MAY NOT CALL THE STABLE'}</span>
        <span class="${b.mayCommand ? 'sf-yes' : 'sf-no'}">${b.mayCommand ? 'MAY TAKE COMMAND' : 'MAY NOT TAKE COMMAND'}</span>
      </div>
      ${rows.filter(([, n]) => n > 0).map(([k, n, w]) =>
        `<div class="sf-row"><span>${esc(k)}</span><span class="sf-no">${n} × ${w}</span>`
        + `<span class="sf-fig">${(n * w).toLocaleString()}</span></div>`).join('')
        || '<div class="sf-empty">No service on file yet. Fight a match and the board opens.</div>'}
    </div>`;
}

/** Paint the whole file into a host element. */
export function renderServiceFile(host: HTMLElement): void {
  const id = loadIdentity();
  const who = id ? `${esc(id.callsign)} · ${id.faction === 'collective' ? 'THE COLLECTIVE' : 'THE UNITED FRONT'}` : 'UNREGISTERED';
  host.innerHTML = `<div class="sf-head">SERVICE FILE — ${who}</div>`
    + `<div class="sf-grid">${boardHtml()}${papersHtml()}${chestHtml()}${recordsHtml()}${garageHtml()}</div>`;
}
