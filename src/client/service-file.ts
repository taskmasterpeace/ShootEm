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

/** Paint the whole file into a host element. */
export function renderServiceFile(host: HTMLElement): void {
  const id = loadIdentity();
  const who = id ? `${esc(id.callsign)} · ${id.faction === 'collective' ? 'THE COLLECTIVE' : 'THE UNITED FRONT'}` : 'UNREGISTERED';
  host.innerHTML = `<div class="sf-head">SERVICE FILE — ${who}</div>`
    + `<div class="sf-grid">${papersHtml()}${chestHtml()}${recordsHtml()}${garageHtml()}</div>`;
}
