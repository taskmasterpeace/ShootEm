// ---------------------------------------------------------------------------
// THE UI GALLERY (#96) — Robert's decision sheet. Every contested HUD piece
// rendered from the REAL modules (icons.ts, the bar-label classes, the live
// CSS var) so what he picks here is byte-for-byte what ships. No mockups:
// a component that doesn't exist yet appears as a SPEC CARD, clearly marked.
// ---------------------------------------------------------------------------
import { ICON_NAMES, icon } from './icons';

const root = document.getElementById('gallery')!;

const sec = (title: string, inner: string, note = '') => `
  <div class="gal-sec"><h2>${title}</h2>${inner}${note ? `<div class="gal-note">${note}</div>` : ''}</div>`;

const item = (cap: string, body: string) => `<div class="gal-item">${body}<span class="gal-cap">${cap}</span></div>`;

// 1 ── the icon vocabulary, all of it, at reading and command size
const icons = ICON_NAMES.map((n) => item(n, `<span class="big-ico" style="color:#e8a33d">${icon(n)}</span>`)).join('');

// 2 ── the vitals chip family (real classes from styles.css)
const chip = (id: string, html: string, hot = false) =>
  `<div class="bar-label${hot ? ' hot' : ''}" style="position:static">${html}</div>`;
const stamps = [
  item('bleeding · hot', chip('m1', 'BLEEDING', true)),
  item('armor gone · hot', chip('m2', 'ARMOR GONE', true)),
  item('low energy', chip('m3', 'LOW ENERGY')),
  item('jet recovering', chip('m4', 'JET RECOVERING')),
  item('cloaked', chip('m5', 'CLOAKED')),
  item('corpse burn (#56)', chip('m6', 'CORPSE BURNING · 72%', true)),
  item('rangefinder (#79)', `<div id="range-chip" style="position:static">RANGE 34u</div>`),
].join('');

// 3 ── the feed glyphs on a real ammo counter
const ammo = (glyph: string, txt: string, cls = '', tint = '') =>
  `<div id="ammo-count" style="position:static" class="${cls}">${icon(glyph as never, tint)} ${txt}</div>`;
const feeds = [
  item('energy weapon', ammo('energy', '∞ / ∞')),
  item('plain ball', ammo('ball', '30 / 120')),
  item('AP loaded', ammo('ap', '30 / 90 · AP')),
  item('incendiary (yellow tip)', ammo('incendiary', '30 / 60 · INC', '', 'ico-inc')),
  item('low mag warn', ammo('ball', '6 / 120', 'low-ammo')),
  item('dry', ammo('ball', '0 / 0', 'no-ammo')),
].join('');

// 4 ── HUD opacity, live against a sample block
const opacity = `
  <div class="gal-row">
    <input type="range" id="gal-op" min="40" max="100" value="100" style="width:220px;accent-color:#e8a33d">
    <span id="gal-op-val" class="gal-cap">100%</span>
    <div id="gal-op-demo" style="display:flex;gap:0.6rem">
      ${chip('d1', '100 HP')}${chip('d2', 'CLOAKED')}${ammo('ball', '30 / 120')}
    </div>
  </div>`;

// 5 ── spec cards: designed, awaiting build — clearly NOT shipped
const spec = (name: string, what: string) =>
  `<div class="gal-item" style="opacity:0.75"><div class="bar-label" style="position:static;border-style:dashed">◇ ${name}</div><span class="gal-cap">${what}</span></div>`;
const specs = [
  spec('RED DOT (#87)', 'gradient dot ON the target, nothing between'),
  spec('SPOTTER WINDOW (#87)', 'hover an enemy → magnified inset'),
  spec('EMOTION PLATE (#98)', 'the capsule face — anger, joy, fear'),
  spec('SHAPE-CHANNEL MARKS (#66)', 'circle/triangle/diamond/square world marks'),
].join('');

root.innerHTML = `
  <h1 class="gal-h">THE UI GALLERY</h1>
  <p class="gal-sub">the decision sheet — everything here renders from the SHIPPING modules; dashed cards are designed-not-built. Pick, reject, or redirect by ticket number.</p>
  ${sec('The icon vocabulary — 13 glyphs, no emoji', `<div class="gal-row">${icons}</div>`,
    'stroke = currentColor: every glyph inherits its line’s tone (amber hint, red warn, viral green).')}
  ${sec('The vitals chips — stamps & readouts (#89 #56 #79)', `<div class="gal-row">${stamps}</div>`,
    'one stamp at a time, priority-picked, plain words; silence when nothing matters.')}
  ${sec('The feed glyphs (#91)', `<div class="gal-row">${feeds}</div>`,
    'the counter’s warn colors carry through the glyph; INC wears the yellow tip.')}
  ${sec('HUD opacity (#89) — live', opacity, 'the same slider ships in Options; drag it.')}
  ${sec('Awaiting build — spec cards', `<div class="gal-row">${specs}</div>`,
    'these exist as tickets, not pixels. Approving a card promotes its ticket in the grind.')}
`;

// the live opacity demo
const op = document.getElementById('gal-op') as HTMLInputElement;
const opVal = document.getElementById('gal-op-val')!;
const demo = document.getElementById('gal-op-demo')!;
op.oninput = () => { opVal.textContent = `${op.value}%`; demo.style.opacity = String(Number(op.value) / 100); };
