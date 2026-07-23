// ═══════════════════════════════════════════════════════════════════════════
// UI LAB — boot.
//
// Lifts the REAL HUD out of index.html and stands it up over a fake horizon so
// the two corner blocks can be sized against something. Nothing here re-draws
// the HUD: it is the same markup, the same stylesheet, the same settings store.
// That is the whole point — a lab that shows you a hand-made mock is a lab that
// lies to you the moment the game's markup moves.
// ═══════════════════════════════════════════════════════════════════════════
import { mountUiLab } from './uilab';

/** the corner blocks the lab is for */
const WANTED = ['hud-bottom-left', 'hud-bottom-right'];

/** What a normal fight looks like: a ring, vitals, armour, a rank. */
const QUIET: Record<string, string> = {
  'hp-num': '86', 'en-num': '72', 'ar-num': '40',
  'weapon-name': 'AR-606 · KUCHLER', 'ammo-count': '24 / 120',
  'wcam-brand': 'KUCHLER', 'rank-name': 'SERGEANT', 'rank-glyphs': '▲▲▲',
};
/** The chips that only appear when something is happening to you. Sizing for
 *  the quiet case is how you ship a HUD that fits right up until the moment
 *  you catch a virus, so the lab can turn the bad day on. */
const LOUD: Record<string, string> = {
  'viral-num': '38%', 'viral-ico': '☣', 'moodle-txt': 'WINDED', 'burn-num': 'BODY BURNING 12s',
};
/** ids that are `.hidden` in the shipped markup and belong to the bad day */
const SITUATIONAL = ['viral-chip', 'moodle-chip', 'burn-chip', 'status-strip'];

/** Sketch the two canvases. They are drawn by the game at runtime; blank white
 *  holes would make both blocks read smaller than they are. */
function paintCanvases(): void {
  const ring = document.getElementById('self-ring') as HTMLCanvasElement | null;
  if (ring) {
    const c = ring.getContext('2d')!;
    const R = ring.width / 2;
    c.lineWidth = 9; c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,255,255,0.10)';
    c.beginPath(); c.arc(R, R, R - 10, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#7ac74f';
    c.beginPath(); c.arc(R, R, R - 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.86); c.stroke();
  }
  const mini = document.getElementById('minimap') as HTMLCanvasElement | null;
  if (mini) {
    const c = mini.getContext('2d')!;
    const W = mini.width;
    c.fillStyle = '#12140f'; c.fillRect(0, 0, W, W);
    c.strokeStyle = 'rgba(232,163,61,0.16)'; c.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const p = (W / 8) * i;
      c.beginPath(); c.moveTo(p, 0); c.lineTo(p, W); c.moveTo(0, p); c.lineTo(W, p); c.stroke();
    }
    c.fillStyle = '#e8a33d';
    c.beginPath(); c.arc(W / 2, W / 2, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d2453a';
    for (const [x, y] of [[0.7, 0.3], [0.28, 0.66], [0.8, 0.75]] as const) {
      c.beginPath(); c.arc(W * x, W * y, 6, 0, Math.PI * 2); c.fill();
    }
  }
}

async function boot(): Promise<void> {
  const host = document.getElementById('hud-host')!;
  try {
    const html = await (await fetch('/index.html')).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const hud = doc.getElementById('hud');
    if (!hud) throw new Error('no #hud in index.html');
    hud.classList.remove('hidden');
    // keep only the corner blocks — the crosshair, killfeed and top bar are a
    // different conversation and would just be noise behind the desk
    for (const kid of [...hud.children]) if (!WANTED.includes(kid.id)) kid.remove();
    host.appendChild(document.importNode(hud, true));

    // armour and rank ride the vitals in any real fight — show them
    document.getElementById('ar-label')?.classList.remove('hidden');
    document.getElementById('rank-chip')?.classList.remove('hidden');
    for (const [id, text] of Object.entries({ ...QUIET, ...LOUD })) {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    }
    paintCanvases();
  } catch (err) {
    host.innerHTML = `<p id="miss">Could not lift the HUD out of index.html — ${String(err)}</p>`;
  }

  mountUiLab(document.getElementById('lab')!, (loud) => {
    for (const id of SITUATIONAL) document.getElementById(id)?.classList.toggle('hidden', !loud);
  });
}

void boot();
