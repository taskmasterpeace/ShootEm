// ---------------------------------------------------------------------------
// THE FRONT DOOR — the boot shell the player meets before the war.
//
//   first run  →  ENLISTMENT (name → homeland → the faction the sheet assigns
//                 you → your file) — META-LAYER §5, "the character is the root."
//   every run  →  the MAIN MENU: SINGLE PLAYER · MULTIPLAYER (soon) · OPTIONS.
//
// It owns the #onboarding overlay (same full-screen tactical door the paintball
// yard used). SINGLE PLAYER drops the overlay to reveal the deploy screen
// (#menu); a ◄ back control brings the door back. OPTIONS gathers every
// persistent setting in one place, relocated out of the deploy form so Deploy
// stays lean. Identity is biography (src/client/identity.ts) — never the sim.
// ---------------------------------------------------------------------------
import { NATIONS, type Nation } from '../data/nations';
import {
  clearIdentity, factionDoctrine, factionLabel, loadIdentity, nationOf, saveIdentity,
  type PlayerIdentity,
} from './identity';

export interface FrontendHost {
  /** SINGLE PLAYER chosen — reveal the deploy screen. */
  /** door: SKIRMISH lands on the war categories, PAINTBALL on the yard. */
  enterMenu(door?: 'skirmish' | 'paintball'): void;
  /** Identity established or changed — push the callsign into the deploy form + record. */
  onIdentity(id: PlayerIdentity): void;
}

const $id = (id: string) => document.getElementById(id)!;
const FACTION_HUE = { collective: '#3dbde8', united_front: '#e8a33d' } as const;

let host: FrontendHost;
let draft: { callsign: string; nationCode: number | null; hometown: string };

/** Boot the front door. First run enlists; a returning player lands on the menu. */
export function mountFrontend(h: FrontendHost): void {
  host = h;
  const existing = loadIdentity();
  wireBackToMenu();
  buildOptionsPanel(); // relocate settings out of Deploy now — a lean deploy form
  if (existing) {
    host.onIdentity(existing);
    renderMenu();
  } else {
    draft = { callsign: '', nationCode: null, hometown: '' };
    renderEnlist('callsign');
  }
}

// ── the overlay frame ────────────────────────────────────────────────────────
function shell(): HTMLDivElement {
  const root = $id('onboarding') as HTMLDivElement;
  root.classList.remove('hidden');
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ob-wrap fm-wrap';
  root.appendChild(wrap);
  return wrap;
}

function hideOverlay() { $id('onboarding').classList.add('hidden'); }

// ── MAIN MENU ────────────────────────────────────────────────────────────────
function renderMenu() {
  const wrap = shell();
  const id = loadIdentity();
  const nation = id ? nationOf(id) : undefined;

  const title = document.createElement('div');
  title.className = 'fm-title';
  title.innerHTML = `WAR <span>WORLD</span>`;
  wrap.appendChild(title);
  const tag = document.createElement('div');
  tag.className = 'fm-tag';
  tag.textContent = '2222 · EIGHT YEARS TO THE ALIENS · THE WAR SQUANDERS THE CLOCK';
  wrap.appendChild(tag);

  if (id && nation) wrap.appendChild(identityStrip(id, nation));

  const buttons = document.createElement('div');
  buttons.className = 'fm-menu';
  wrap.appendChild(buttons);

  // SINGLE PLAYER opens the two doors (Robert's tree): SKIRMISH — the war
  // in all its shapes — and PAINTBALL, the yard. The row toggles in place.
  const spDoors = document.createElement('div');
  spDoors.className = 'fm-subrow hidden';
  buttons.appendChild(menuButton('▶', 'SINGLE PLAYER', 'Fight the war offline — skirmish or the paintball yard.', false, () => {
    spDoors.classList.toggle('hidden');
  }));
  spDoors.appendChild(menuButton('⚔', 'SKIRMISH', 'War, military missions, science missions, the outbreak.', false, () => {
    hideOverlay();
    host.enterMenu('skirmish');
  }));
  spDoors.appendChild(menuButton('🎨', 'PAINTBALL', 'The yard: hunters vs hunted, the Gauntlet, the pro shop.', false, () => {
    hideOverlay();
    host.enterMenu('paintball');
  }));
  buttons.appendChild(spDoors);
  buttons.appendChild(menuButton('⛨', 'MULTIPLAYER', 'Two real armies over one contested world.', true));
  buttons.appendChild(menuButton('⚙', 'OPTIONS', 'Audio, comfort, blood, speeds, reticle, controls.', false, renderOptions));

  const foot = document.createElement('div');
  foot.className = 'fm-foot';
  const reenlist = document.createElement('button');
  reenlist.className = 'ob-skip';
  reenlist.textContent = 'Re-enlist under a different flag';
  reenlist.onclick = () => {
    if (!confirm('Re-enlisting rewrites your homeland and the faction the sheet assigns you. Your record is kept. Continue?')) return;
    clearIdentity();
    draft = { callsign: id?.callsign ?? '', nationCode: null, hometown: '' };
    renderEnlist('homeland');
  };
  foot.appendChild(reenlist);
  wrap.appendChild(foot);
}

function identityStrip(id: PlayerIdentity, nation: Nation): HTMLElement {
  const hue = FACTION_HUE[id.faction];
  const strip = document.createElement('div');
  strip.className = 'fm-idstrip';
  strip.innerHTML = `
    <span class="fm-flag">${nation.flag}</span>
    <span class="fm-idmeta">
      <b>${escapeHtml(id.callsign)}</b>
      <span>${escapeHtml(nation.nationality || nation.name)}${id.hometown ? ' · ' + escapeHtml(id.hometown) : ''}</span>
    </span>
    <span class="fm-badge" style="--fh:${hue}">${factionLabel(id.faction).toUpperCase()}</span>`;
  return strip;
}

function menuButton(glyph: string, label: string, sub: string, soon: boolean, onClick?: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `fm-btn${soon ? ' soon' : ''}`;
  b.disabled = soon;
  b.innerHTML = `
    <span class="fm-btn-glyph">${glyph}</span>
    <span class="fm-btn-body"><b>${label}</b><span>${sub}</span></span>
    ${soon ? '<span class="fm-soon">COMING SOON</span>' : '<span class="fm-btn-go">▸</span>'}`;
  if (onClick && !soon) b.onclick = onClick;
  return b;
}

// ── ENLISTMENT (first run) ────────────────────────────────────────────────────
type EnlistStep = 'callsign' | 'homeland' | 'review';

function renderEnlist(step: EnlistStep) {
  if (step === 'callsign') return renderCallsign();
  if (step === 'homeland') return renderHomeland();
  return renderReview();
}

function stepHead(wrap: HTMLElement, n: number, title: string, sub: string) {
  const dots = ['①', '②', '③'].map((d, i) => `<span class="${i < n ? 'on' : ''}">${d}</span>`).join('');
  const head = document.createElement('div');
  head.className = 'enl-head';
  head.innerHTML = `<div class="enl-steps">${dots}</div><h1>${title}</h1><p class="ob-sub">${sub}</p>`;
  wrap.appendChild(head);
}

function renderCallsign() {
  const wrap = shell();
  stepHead(wrap, 1, 'ENLIST · YOUR NAME', 'Every clone answers to a name. This one is yours — pick it well; the record keeps it.');
  const field = document.createElement('div');
  field.className = 'enl-namefield';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 18;
  input.placeholder = 'Name your soldier';
  input.value = draft.callsign;
  input.className = 'enl-nameinput';
  field.appendChild(input);
  wrap.appendChild(field);

  const go = document.createElement('button');
  go.className = 'ob-go';
  go.textContent = 'CONTINUE ▸';
  const sync = () => { draft.callsign = input.value.trim(); go.disabled = !draft.callsign; };
  input.oninput = sync;
  input.onkeydown = (e) => { if (e.key === 'Enter' && draft.callsign) { renderEnlist('homeland'); } };
  go.onclick = () => renderEnlist('homeland');
  wrap.appendChild(go);
  sync();
  setTimeout(() => input.focus(), 0);
}

function renderHomeland() {
  const wrap = shell();
  stepHead(wrap, 2, 'ENLIST · YOUR HOMELAND', `Where does ${draft.callsign || 'your soldier'} answer the call from? Your country decides the faction you fight for.`);

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'Search 168 nations…';
  search.className = 'enl-search';
  wrap.appendChild(search);

  const grid = document.createElement('div');
  grid.className = 'enl-grid';
  wrap.appendChild(grid);

  const paint = (q: string) => {
    grid.innerHTML = '';
    const needle = q.trim().toLowerCase();
    const list = needle
      ? NATIONS.filter((n) => n.name.toLowerCase().includes(needle) || n.nationality.toLowerCase().includes(needle))
      : NATIONS;
    for (const n of list) {
      const b = document.createElement('button');
      b.className = 'enl-nation';
      b.innerHTML = `<span class="enl-nflag">${n.flag}</span><span class="enl-nname">${escapeHtml(n.name)}</span><span class="enl-ndot" style="--fh:${FACTION_HUE[n.faction]}"></span>`;
      b.onclick = () => { draft.nationCode = n.code; draft.hometown = ''; renderEnlist('review'); };
      grid.appendChild(b);
    }
    if (!list.length) grid.innerHTML = `<p class="ob-sub" style="opacity:.7">No nation matches “${escapeHtml(q)}”.</p>`;
  };
  search.oninput = () => paint(search.value);
  paint('');

  const back = document.createElement('button');
  back.className = 'ob-alt';
  back.textContent = '◄ Back to name';
  back.onclick = () => renderEnlist('callsign');
  wrap.appendChild(back);
  setTimeout(() => search.focus(), 0);
}

function renderReview() {
  const wrap = shell();
  const nation = draft.nationCode != null ? NATIONS.find((n) => n.code === draft.nationCode) : undefined;
  if (!nation) { renderEnlist('homeland'); return; }
  const hue = FACTION_HUE[nation.faction];

  stepHead(wrap, 3, 'ENLIST · YOUR FILE', 'Command stamped your papers. Read them, set your hometown, and take the oath.');

  const dossier = document.createElement('div');
  dossier.className = 'enl-dossier';
  dossier.style.setProperty('--fh', hue);

  const president = nation.president
    ? `<div class="enl-fact"><span>${escapeHtml(nation.leaderTitle || 'Leader')}</span><b>${escapeHtml(nation.president)}</b></div>` : '';
  dossier.innerHTML = `
    <div class="enl-dhero">
      <span class="enl-dflag">${nation.flag}</span>
      <div class="enl-dnames">
        <div class="enl-dcountry">${escapeHtml(nation.name)}</div>
        <div class="enl-dmotto">${nation.motto && nation.motto !== 'None' ? '“' + escapeHtml(nation.motto) + '”' : escapeHtml(nation.government)}</div>
      </div>
    </div>
    <div class="enl-assign" style="--fh:${hue}">
      <span class="enl-assign-k">ASSIGNED TO</span>
      <span class="enl-assign-v">${factionLabel(nation.faction).toUpperCase()}</span>
      <span class="enl-assign-why">${factionDoctrine(nation.faction)}</span>
    </div>
    <div class="enl-facts">
      <div class="enl-fact"><span>Soldier</span><b>${escapeHtml(draft.callsign)}</b></div>
      <div class="enl-fact"><span>Nationality</span><b>${escapeHtml(nation.nationality || '—')}</b></div>
      ${president}
      <div class="enl-fact"><span>Government</span><b>${escapeHtml(nation.perception || nation.government)}</b></div>
      <div class="enl-fact"><span>Cloning</span><b>${escapeHtml(nation.cloning || '—')}</b></div>
      <div class="enl-fact"><span>LSW law</span><b>${escapeHtml(nation.lswReg || '—')}</b></div>
    </div>`;
  wrap.appendChild(dossier);

  // hometown — a PICK from the nation's real cities, never a blank to fill in.
  const cities = nation.cities;
  const townWrap = document.createElement('div');
  townWrap.className = 'enl-town';
  townWrap.innerHTML = `<label>Hometown <span class="opt">— where in ${escapeHtml(nation.name)}?</span></label>`;
  const town = document.createElement('select');
  town.className = 'enl-townselect';
  for (const c of cities) { const o = document.createElement('option'); o.value = c; o.textContent = c; town.appendChild(o); }
  // keep the draft's pick if it's still valid for this country, else the first city
  draft.hometown = cities.includes(draft.hometown) ? draft.hometown : (cities[0] ?? '');
  town.value = draft.hometown;
  town.onchange = () => { draft.hometown = town.value; };
  townWrap.appendChild(town);
  wrap.appendChild(townWrap);

  const go = document.createElement('button');
  go.className = 'ob-go';
  go.textContent = 'ENLIST ▸';
  go.onclick = () => {
    const id: PlayerIdentity = {
      callsign: draft.callsign || 'Recruit',
      nationCode: nation.code,
      hometown: draft.hometown || (cities[0] ?? ''),
      faction: nation.faction,
      created: Date.now(),
    };
    saveIdentity(id);
    host.onIdentity(id);
    renderMenu();
  };
  wrap.appendChild(go);

  const back = document.createElement('button');
  back.className = 'ob-alt';
  back.textContent = '◄ Choose another country';
  back.onclick = () => renderEnlist('homeland');
  wrap.appendChild(back);
}

// ── OPTIONS ──────────────────────────────────────────────────────────────────
// The settings/controls/multiplayer DOM is relocated ONCE into a persistent
// #options-panel (never cleared by the shell re-render), so the deploy form
// stays lean and #server-url etc. survive for every later deploy read.
let optionsBuilt = false;
function buildOptionsPanel() {
  if (optionsBuilt) return;
  const panel = $id('options-panel');
  panel.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ob-wrap fm-wrap';
  panel.appendChild(wrap);

  const head = document.createElement('div');
  head.className = 'enl-head';
  head.innerHTML = `<h1>OPTIONS</h1><p class="ob-sub">Everything that isn't a match choice lives here. Changes save the moment you make them.</p>`;
  wrap.appendChild(head);

  const holder = document.createElement('div');
  holder.className = 'fm-options';
  wrap.appendChild(holder);
  // the wiring already bound these exact elements — moving the subtree keeps
  // every listener live and the settings singleton untouched.
  for (const secId of ['settings-section', 'controls-section', 'controller-section', 'mp-section']) {
    const sec = document.getElementById(secId);
    if (sec) holder.appendChild(sec);
  }

  const back = document.createElement('button');
  back.className = 'ob-go';
  back.textContent = '◄ BACK TO MENU';
  back.onclick = () => { panel.classList.add('hidden'); renderMenu(); };
  wrap.appendChild(back);
  optionsBuilt = true;
}

function renderOptions() {
  buildOptionsPanel();
  hideOverlay();
  $id('options-panel').classList.remove('hidden');
}

// ── returning to the front door from the deploy screen ────────────────────────
function wireBackToMenu() {
  const btn = document.getElementById('to-frontmenu');
  if (btn) btn.onclick = () => { $id('menu').classList.add('hidden'); renderMenu(); };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Whether the settings DOM has been relocated into the options panel (tests). */
export function optionsRelocated(): boolean { return optionsBuilt; }
