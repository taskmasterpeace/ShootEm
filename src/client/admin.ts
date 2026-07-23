// ---------------------------------------------------------------------------
// THE ADMIN ROOM (#90) — dev knobs behind a login, before going online.
// Robert's ruling (2026-07-22): "I'm the admin… it could just be admin and
// Galactic for right now. We don't have to harden the security." So: a
// plaintext door by DESIGN, session-scoped, replaced wholesale when accounts
// (#83) arrive. First knob: THE CLOCK SCRUB — drag the one clock (#123) and
// the whole client follows: chip, launches, skies.
// ---------------------------------------------------------------------------
import {
  GAME_DAY_MS, adminClockOffsetMs, clockLabel, freeze, gameNow, loadTimeControl, phaseName,
  resetControl, saveTimeControl, setAdminClockOffsetMs, setRate, unfreeze,
} from './worldclock';

const $ = (id: string) => document.getElementById(id)!;

// ---- the door (ruling: admin / Galactic, no hardening until #83) -----------
const SESSION_KEY = 'ww_admin_session';
const inSession = () => sessionStorage.getItem(SESSION_KEY) === '1';

function paintDoor() {
  $('door').classList.toggle('hidden', inSession());
  $('knobs').classList.toggle('hidden', !inSession());
  if (inSession()) { paintClock(); paintIdentity(); paintTrackBuilder(); }
}

$('adm-enter').onclick = () => {
  const u = ($('adm-user') as HTMLInputElement).value.trim();
  const p = ($('adm-pass') as HTMLInputElement).value;
  if (u === 'admin' && p === 'Galactic') {
    sessionStorage.setItem(SESSION_KEY, '1');
    paintDoor();
  } else {
    ($('adm-err') as HTMLElement).style.display = 'block';
  }
};
($('adm-pass') as HTMLInputElement).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ($('adm-enter') as HTMLButtonElement).click();
});
$('adm-logout').onclick = () => { sessionStorage.removeItem(SESSION_KEY); paintDoor(); };

// ---- the clock scrub -------------------------------------------------------
function paintClock() {
  const c = gameNow();
  $('adm-clock').textContent = clockLabel(c) + (c.night ? '  ☾' : '  ☀');
  const off = adminClockOffsetMs();
  const tc = loadTimeControl();
  const bits: string[] = [phaseName(c)];
  if (tc.frozenElapsedMs !== null) bits.push('HELD');
  else if (tc.rate !== 1) bits.push(tc.rate + '× DAY');
  if (off !== 0) bits.push(`SCRUBBED ${off > 0 ? '+' : ''}${(off / (GAME_DAY_MS / 24)).toFixed(1)}h`);
  if (off === 0 && tc.rate === 1 && tc.frozenElapsedMs === null) bits.push('TRUE TIME');
  $('adm-phase').textContent = bits.join('  ·  ');
  const hold = document.getElementById('adm-clock-hold');
  if (hold) hold.textContent = tc.frozenElapsedMs !== null ? 'RELEASE THE DAY' : 'HOLD THE DAY';
}
setInterval(() => { if (inSession()) paintClock(); }, 2000);

/** Jump the clock so the CURRENT moment reads as the target hour today. */
function jumpTo(hour: number, minute = 0) {
  const now = gameNow(Date.now() + adminClockOffsetMs());
  const wantPhase = (hour * 60 + minute) / (24 * 60);
  const deltaDayFrac = wantPhase - now.phase01;
  setAdminClockOffsetMs(adminClockOffsetMs() + deltaDayFrac * GAME_DAY_MS);
  paintClock();
}
const JUMPS: Record<string, [number, number]> = {
  noon: [12, 0], midnight: [0, 0], dusk: [20, 55], dawn: [5, 55],
};
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-jump]'))) {
  b.onclick = () => { const [h, m] = JUMPS[b.dataset.jump!]; jumpTo(h, m); };
}
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-nudge]'))) {
  b.onclick = () => {
    setAdminClockOffsetMs(adminClockOffsetMs() + Number(b.dataset.nudge) * (GAME_DAY_MS / 24 / 60));
    paintClock();
  };
}
// THE CONTROL (Robert: "a clock that we will control later"). HOLD stops the
// day where it stands; RATE changes how fast it runs. Both reach the
// battlefield — a match is handed the rate at launch, and a held clock hands
// it 0, so the sky holds mid-match too.
$('adm-clock-hold').onclick = () => {
  const tc = loadTimeControl();
  saveTimeControl(tc.frozenElapsedMs !== null ? unfreeze(tc) : freeze(tc));
  paintClock();
};
for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-rate]'))) {
  b.onclick = () => {
    // re-anchors first, so changing the speed never teleports the world
    saveTimeControl(setRate(unfreeze(loadTimeControl()), Number(b.dataset.rate)));
    paintClock();
  };
}
$('adm-clock-clear').onclick = () => { saveTimeControl(resetControl()); paintClock(); };

// ---- identity (read-only until #83) ----------------------------------------
function paintIdentity() {
  try {
    const raw = localStorage.getItem('ww_enlist') ?? localStorage.getItem('ww_identity');
    if (!raw) { $('adm-identity').textContent = 'No enlistment on this client yet — the front door makes one.'; return; }
    const e = JSON.parse(raw) as Record<string, unknown>;
    $('adm-identity').textContent = Object.entries(e)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => `${k}: ${v}`)
      .join('  ·  ');
  } catch {
    $('adm-identity').textContent = 'Enlistment store unreadable.';
  }
}

paintDoor();

// ═══════════════════════════════════════════════════════════════════════════
// THE TRACK BUILDER (#131) — creator-only, behind this door by design.
// Robert: "creating the track is just for me, the creator."
//
// The parts box lays pieces; each carries its own WIDTH, HEIGHT and PAVEMENT
// (RDS's three sliders). The minimap draws the route as you build, and the
// verdict line answers the only question that matters: can this be driven
// and can a lap be timed on it?
// ═══════════════════════════════════════════════════════════════════════════
import {
  DEFAULT_PIECE, PIECE_SHAPE, exportTrack, starterOval, validateTrack, walkTrack,
  type BuiltTrack, type Pavement, type PieceKind, type TrackPiece,
} from '../sim/tracks';

const SHELF_KEY = 'ww_tracks';

const PIECE_LABEL: Record<PieceKind, string> = {
  straight: 'STRAIGHT', curve_l: 'CURVE ◄', curve_r: 'CURVE ►',
  chicane: 'CHICANE', ramp_up: 'RAMP ▲', ramp_down: 'RAMP ▼',
  jump: 'JUMP', bank_l: 'BANK ◄', bank_r: 'BANK ►',
};

let draft: BuiltTrack = {
  id: 'draft', name: 'New Circuit', author: 'THE CREATOR', version: 1,
  start: { x: -70, y: 0, z: -60 }, startYaw: 0, pieces: [],
};

function currentSpec(): TrackPiece {
  const w = Number((document.getElementById('tb-width') as HTMLInputElement)?.value ?? 14);
  const h = Number((document.getElementById('tb-height') as HTMLInputElement)?.value ?? 0);
  const s = ((document.getElementById('tb-surface') as HTMLSelectElement)?.value ?? 'paved') as Pavement;
  return { ...DEFAULT_PIECE, width: w, height: h, surface: s };
}

function drawTrackMap() {
  const cv = document.getElementById('tb-map') as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#0d0f0c';
  ctx.fillRect(0, 0, cv.width, cv.height);
  // the world fence, so "off the map" is visible before the verdict says it
  const S = cv.width / 320;
  const ox = cv.width / 2, oz = cv.height / 2;
  ctx.strokeStyle = '#2a2d26';
  ctx.strokeRect(ox - 145 * S, oz - 145 * S, 290 * S, 290 * S);
  const nodes = walkTrack(draft);
  if (!nodes.length) return;
  const SURF: Record<Pavement, string> = { paved: '#9aa0a6', dirt: '#8a6a3a', ice: '#7fd0e8' };
  ctx.lineWidth = 3;
  nodes.forEach((n, i) => {
    const shape = PIECE_SHAPE[n.piece.kind];
    const ex = n.pos.x + Math.cos(n.yaw) * shape.run;
    const ez = n.pos.z + Math.sin(n.yaw) * shape.run;
    ctx.strokeStyle = SURF[n.piece.surface];
    ctx.beginPath();
    ctx.moveTo(ox + n.pos.x * S, oz + n.pos.z * S);
    ctx.lineTo(ox + ex * S, oz + ez * S);
    ctx.stroke();
    if (n.piece.kind === 'jump') {
      ctx.fillStyle = '#e8a33d';
      ctx.fillRect(ox + ex * S - 3, oz + ez * S - 3, 6, 6);
    }
    if (i === 0) { // the grid
      ctx.fillStyle = '#e8a33d';
      ctx.fillRect(ox + n.pos.x * S - 4, oz + n.pos.z * S - 4, 8, 8);
    }
  });
}

function paintTrackBuilder() {
  const box = document.getElementById('tb-box');
  if (!box) return;
  if (!box.dataset.built) {
    box.dataset.built = '1';
    for (const kind of Object.keys(PIECE_SHAPE) as PieceKind[]) {
      const b = document.createElement('button');
      b.textContent = PIECE_LABEL[kind];
      b.onclick = () => { draft.pieces.push({ ...currentSpec(), kind }); paintTrackBuilder(); };
      box.appendChild(b);
    }
    (document.getElementById('tb-undo') as HTMLButtonElement).onclick = () => { draft.pieces.pop(); paintTrackBuilder(); };
    (document.getElementById('tb-clear') as HTMLButtonElement).onclick = () => { draft.pieces = []; paintTrackBuilder(); };
    (document.getElementById('tb-oval') as HTMLButtonElement).onclick = () => {
      draft = starterOval(draft.author);
      (document.getElementById('tb-name') as HTMLInputElement).value = draft.name;
      paintTrackBuilder();
    };
    (document.getElementById('tb-export') as HTMLButtonElement).onclick = () => {
      const ta = document.getElementById('tb-json') as HTMLTextAreaElement;
      ta.classList.remove('hidden');
      ta.value = exportTrack({ ...draft, name: (document.getElementById('tb-name') as HTMLInputElement).value });
      ta.select();
    };
    (document.getElementById('tb-save') as HTMLButtonElement).onclick = () => {
      const name = (document.getElementById('tb-name') as HTMLInputElement).value.trim() || 'Untitled';
      const t: BuiltTrack = { ...draft, name, id: name.toLowerCase().replace(/\s+/g, '_') };
      let shelf: BuiltTrack[] = [];
      try { shelf = JSON.parse(localStorage.getItem(SHELF_KEY) ?? '[]') as BuiltTrack[]; } catch { shelf = []; }
      const at = shelf.findIndex((s) => s.id === t.id);
      if (at >= 0) shelf[at] = t; else shelf.push(t);
      try { localStorage.setItem(SHELF_KEY, JSON.stringify(shelf)); } catch { /* private mode */ }
      paintTrackBuilder();
    };
    for (const id of ['tb-width', 'tb-height', 'tb-surface']) {
      document.getElementById(id)?.addEventListener('input', drawTrackMap);
    }
  }
  const verdict = document.getElementById('tb-verdict');
  if (verdict) {
    const named = { ...draft, name: (document.getElementById('tb-name') as HTMLInputElement)?.value ?? draft.name };
    const problems = validateTrack(named);
    let shelfN = 0;
    try { shelfN = (JSON.parse(localStorage.getItem(SHELF_KEY) ?? '[]') as unknown[]).length; } catch { shelfN = 0; }
    verdict.innerHTML = `<b>${draft.pieces.length} PIECES</b> · ${shelfN} on the shelf<br>`
      + (problems.length
        ? problems.map((p) => `<span style="color:#e8a33d">▸ ${p.detail}</span>`).join('<br>')
        : '<span style="color:#6fe06f">▸ DRIVABLE — the route closes, fits the world, and a lap can be timed.</span>');
  }
  drawTrackMap();
}
