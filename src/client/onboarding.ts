// ---------------------------------------------------------------------------
// §14 THE FIRST HOUR — boot camp is a paintball match, not a menu.
//
// Phase 1  Immediate drop: pick a marker, pick a field, play Hunters vs
//          Hunted. Two-minute rounds. The game is quietly profiling you.
// Phase 2  After two skirmishes (once hunting, once AS the prey) the yard
//          reads your play and recommends a class — with one piece of that
//          class's signature gear to try. Rejectable in one click (§14
//          decision: NEVER force the recommendation).
// Phase 3  First real war drop: 12v12, objectives, the recommended kit
//          preloaded. Your record starts here, not in the yard.
// Phase 4  After three real matches: the path split — Enlisted or OCS.
//          Earned, because it comes after real play. Skipping any of this
//          enlists you as a DRAFTEE (biography, never power — settled).
//
// The whole machine rides localStorage and the existing end-of-match page
// reload: every boot, the driver looks at where you are and sets the stage.
// ---------------------------------------------------------------------------
import { CLASSES, EQUIPMENT, WEAPONS } from '../sim/data';
import { PAINTBALL_FIELDS, GRID, T_CLIMB, T_COVER, T_OPEN, T_WALL, generatePaintballField } from '../sim/map';
import type { ClassId, ModeId, ThemeId, WeaponId } from '../sim/types';
import type { World } from '../sim/world';

// ---- the profile: what the yard measures, and what it concludes ----------

export interface SkirmishStats {
  role: 'hunter' | 'prey';
  kills: number;
  longestKill: number;
  tags: number;      // tag pads claimed while prey
  survived: boolean; // still unsplatted at the whistle
  won: boolean;
}

export interface OnboardingState {
  stage: 'skirmish' | 'profile' | 'war' | 'split' | 'done';
  marker: WeaponId;
  fieldId: string;
  rounds: SkirmishStats[];
  recommended?: ClassId;
  gear?: string;
  warMatches: number;
  path?: 'enlisted' | 'ocs' | 'draftee';
  /** the war-stage interstitial explains itself once, then stays out of the way */
  warSeen?: boolean;
  /** chosen paint color name (PAINT_COLORS) — pure identity, splats in your shade */
  paint?: string;
  /** READ THE RING taught its lesson (or got its 30 seconds) — never respawns */
  ringDone?: boolean;
}

const KEY = 'ww_onboarding';

const STAGES = ['skirmish', 'profile', 'war', 'split', 'done'] as const;

export function loadOnboarding(): OnboardingState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const st = JSON.parse(raw) as OnboardingState;
      // trust nothing: a hand-edited or half-written record must never brick
      // the boot (a null here once froze the whole frame loop at match-over)
      if (st && typeof st === 'object' && STAGES.includes(st.stage)
        && Array.isArray(st.rounds) && Number.isFinite(st.warMatches)) {
        return st;
      }
    }
  } catch { /* fresh recruit */ }
  return { stage: 'skirmish', marker: 'marker_blitz', fieldId: PAINTBALL_FIELDS[0].id, rounds: [], warMatches: 0 };
}

export function saveOnboarding(st: OnboardingState) {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* private mode */ }
}

/**
 * The recommendation, from two rounds of paint. Deliberately legible rules —
 * a player should be able to guess WHY the yard called them what it did:
 *   long splats        → Infiltrator (you were already sniping)
 *   ran the tag circuit→ Pathfinder (objective legs)
 *   many close splats  → Jump Trooper; many splats at range → Heavy
 *   survived as prey quietly → Ghost (evasion is a skill)
 *   steady middle      → Infantry
 *   caught early, low aggression → Engineer (build your own cover next time)
 */
export function recommendClass(rounds: SkirmishStats[]): ClassId {
  const kills = rounds.reduce((a, r) => a + r.kills, 0);
  const longest = Math.max(0, ...rounds.map((r) => r.longestKill));
  const tags = rounds.reduce((a, r) => a + r.tags, 0);
  const prey = rounds.find((r) => r.role === 'prey');
  if (longest >= 26) return 'infiltrator';
  if (tags >= 2) return 'pathfinder';
  if (kills >= 4) return longest <= 14 ? 'jump' : 'heavy';
  if (prey?.survived && kills <= 1) return 'ghost';
  if (kills >= 2) return 'infantry';
  return prey && !prey.survived ? 'medic' : 'engineer';
}

/** One signature piece per class — the taste of the kit, not the whole kit. */
export const SIGNATURE_GEAR: Record<ClassId, string> = {
  infantry: 'medikit', heavy: 'power_armor', jump: 'sensor_360',
  engineer: 'repair_kit', medic: 'psi_scanner', infiltrator: 'tracking_optics',
  pathfinder: 'tac_system', ghost: 'spy_camera',
};

/** The words on the profile card — playstyle names, not stat dumps (§14 Q3:
 *  ONE legacy beat per phase, everything else stays in the Barracks). */
const STYLE_NAMES: Record<ClassId, string> = {
  infiltrator: 'THE MARKSMAN', pathfinder: 'THE RUNNER', jump: 'THE BRAWLER',
  heavy: 'THE ANCHOR', ghost: 'THE PHANTOM', infantry: 'THE SOLDIER',
  medic: 'THE LIFELINE', engineer: 'THE BUILDER',
};

export const PAINTBALL_MARKERS: { id: WeaponId; blurb: string }[] = [
  { id: 'marker_blitz', blurb: 'Spray and move. Volume wins.' },
  { id: 'marker_pump', blurb: 'One ball, one splat. Aim wins.' },
  { id: 'marker_lobber', blurb: 'Paint from above. Angles win.' },
  { id: 'marker_scatter', blurb: 'Seven balls, one press. Doorways win.' },
];

/** coach-ui: the marker icon slot is a CHANNEL again — four distinct SVG
 *  silhouettes in currentColor (steel at rest, amber when the card selects),
 *  replacing the repeated palette emoji whose magenta blobs broke both the
 *  no-purple law and the terminal voice. */
const MARKER_GLYPHS: Record<string, string> = {
  // spray burst — many small balls leaving fast
  marker_blitz: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="11" cy="8" r="1.6"/><circle cx="12" cy="16" r="1.6"/><circle cx="17" cy="6" r="1.3"/><circle cx="18" cy="12" r="1.3"/><circle cx="17" cy="18" r="1.3"/><circle cx="22" cy="9" r="1"/><circle cx="22" cy="15" r="1"/></svg>',
  // one ball, dead center, ringed — the aimed shot
  marker_pump: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3.2M12 19.3v3.2M1.5 12h3.2M19.3 12h3.2"/></svg>',
  // the lobbed arc, ball at apex falling
  marker_lobber: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 19 Q8 4 19 7" stroke-dasharray="2.5 2.2"/><circle cx="19.5" cy="13" r="2.6" fill="currentColor" stroke="none"/><path d="M19.5 16.5v3" stroke-width="1.2"/></svg>',
  // the fan — seven balls in a spread
  marker_scatter: '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><circle cx="4" cy="12" r="1.8"/><circle cx="12" cy="4.5" r="1.5"/><circle cx="13" cy="8.2" r="1.5"/><circle cx="14" cy="12" r="1.5"/><circle cx="13" cy="15.8" r="1.5"/><circle cx="12" cy="19.5" r="1.5"/><circle cx="20" cy="12" r="1.2"/><circle cx="19" cy="6" r="1.2"/><circle cx="19" cy="18" r="1.2"/></svg>',
};

/** The paint rack (Robert: pick your paintballs). No purple — house law.
 *  Everyone else draws by id hash from the rack minus your pick, so the yard
 *  ends up confetti and your shade stays yours. */
export const PAINT_COLORS: { name: string; hex: number }[] = [
  { name: 'Blaze Orange', hex: 0xff8c1a },
  { name: 'Cyan Burst', hex: 0x3dbde8 },
  { name: 'Lime Splat', hex: 0x8fce3a },
  { name: 'Hot Yellow', hex: 0xffd23d },
  { name: 'Cherry Bomb', hex: 0xff4a4a },
  { name: 'Whiteout', hex: 0xf2f0ea },
];

/** The local player's chosen paint (falls back to Blaze Orange). */
export function paintColorOf(st?: OnboardingState): number {
  const s = st ?? loadOnboarding();
  return PAINT_COLORS.find((c) => c.name === s.paint)?.hex ?? PAINT_COLORS[0].hex;
}

/** Everyone else's paint: dealt from the rack by id — stable per soldier, and
 *  never YOUR shade. The pick only means something if the splat by your ear
 *  can't be mistaken for your own, so the rest of the yard draws from the rack
 *  minus the one you claimed. */
export function paintColorFor(soldierId: number, localId: number, st?: OnboardingState): number {
  const mine = paintColorOf(st);
  if (soldierId === localId) return mine;
  const theirs = PAINT_COLORS.filter((c) => c.hex !== mine);
  return theirs[Math.abs(soldierId * 7 + 3) % theirs.length].hex;
}

// ---- match hooks (called from main.ts) ------------------------------------

/** What the paintball roster should look like this skirmish. */
export function paintballConfig(): { role: 'hunter' | 'prey'; marker: WeaponId; seed: number; theme: ThemeId } {
  const st = loadOnboarding();
  const field = PAINTBALL_FIELDS.find((f) => f.id === st.fieldId) ?? PAINTBALL_FIELDS[0];
  return {
    role: st.stage === 'skirmish' && st.rounds.length === 0 ? 'hunter' : 'prey',
    marker: st.marker,
    seed: field.seed,
    theme: field.theme,
  };
}

/** Record a finished match. Skirmishes advance the machine; war matches
 *  count toward the path split. Idempotent per match via the `taken` guard. */
let taken = false;
export function onMatchEnd(world: World, meId: number, mode: ModeId) {
  if (taken) return;
  taken = true;
  const st = loadOnboarding();
  const me = world.soldiers.get(meId);
  if (!me) return;
  if (mode === 'paintball' && st.stage === 'skirmish') {
    const hunted = world.mode.huntedTeam ?? 1;
    const role: 'hunter' | 'prey' = me.team === hunted ? 'prey' : 'hunter';
    st.rounds.push({
      role,
      kills: me.kills,
      longestKill: me.longestKill,
      tags: role === 'prey' ? world.mode.scores[hunted] : 0,
      survived: me.alive,
      won: world.mode.winner === me.team,
    });
    if (st.rounds.length >= 2) {
      st.stage = 'profile';
      st.recommended = recommendClass(st.rounds);
      st.gear = SIGNATURE_GEAR[st.recommended];
    }
    saveOnboarding(st);
  } else if (st.stage === 'war' && mode !== 'paintball' && mode !== 'range') {
    st.warMatches++;
    if (st.warMatches >= 3) st.stage = 'split';
    saveOnboarding(st);
  }
}

// ---- the overlay ----------------------------------------------------------

export interface OnboardingHost {
  /** set the module-level selections and start the match */
  launch(cfg: { mode: ModeId; theme: ThemeId; seed?: number; classId?: ClassId; equipment?: string[] }): void;
}

const $id = (id: string) => document.getElementById(id)!;

/** Paint a field thumbnail straight from its generated grid — the map IS the
 *  image reference. Amber cover, pale barricades, dark fences. */
function fieldThumb(seed: number, theme: ThemeId): HTMLCanvasElement {
  const map = generatePaintballField(seed, theme);
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = 116;
  const ctx = cvs.getContext('2d')!;
  const A0 = 34, A1 = 66, px = cvs.width / (A1 - A0);
  const ground = theme === 'savanna' ? '#3d4a2c' : theme === 'starship' ? '#2b3038' : '#4a3d2b';
  ctx.fillStyle = '#14171b';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  for (let tz = A0; tz < A1; tz++) {
    for (let tx = A0; tx < A1; tx++) {
      const t = map.grid[tz * GRID + tx];
      ctx.fillStyle = t === T_OPEN ? ground : t === T_COVER ? '#e8a33d'
        : t === T_CLIMB ? '#c9b18a' : t === T_WALL ? '#14171b' : ground;
      ctx.fillRect((tx - A0) * px, (tz - A0) * px, px + 0.5, px + 0.5);
    }
  }
  // the three tag pads read as rings
  ctx.strokeStyle = '#3dbde8';
  ctx.lineWidth = 1.5;
  for (const cp of map.controlPoints) {
    const tx = (cp.pos.x + 150) / 3, tz = (cp.pos.z + 150) / 3;
    ctx.beginPath();
    ctx.arc((tx - A0) * px, (tz - A0) * px, 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  return cvs;
}

function card(html: string, selected: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = `ob-card${selected ? ' selected' : ''}`;
  b.innerHTML = html;
  return b;
}

/** Mount the onboarding overlay for the current stage. Returns true if the
 *  overlay took the screen (the normal menu stays hidden behind it). */
export function mountOnboarding(host: OnboardingHost): boolean {
  const st = loadOnboarding();
  if (st.stage === 'done') return false;
  const root = $id('onboarding');
  root.classList.remove('hidden');
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'ob-wrap';
  root.appendChild(wrap);

  const skip = document.createElement('button');
  skip.className = 'ob-skip';
  skip.textContent = 'Skip boot camp — enlist as DRAFTEE';
  skip.onclick = () => {
    // permanent identity gets the same confirm the official Wall run gets
    if (!confirm('Skipping boot camp is permanent — you enlist as a DRAFTEE and the record remembers it forever. Skip?')) return;
    saveOnboarding({ ...st, stage: 'done', path: st.path ?? 'draftee' });
    root.classList.add('hidden');
    location.reload();
  };

  if (st.stage === 'skirmish') {
    const second = st.rounds.length >= 1;
    wrap.innerHTML = `
      <h1>${second ? 'ROUND 2 — YOU ARE THE PREY' : 'BOOT CAMP · THE PAINTBALL YARD'}</h1>
      <p class="ob-sub">${second
        ? 'The pack hunts YOU this time. Tag three points or outlive the clock. One splat and you sit.'
        : 'No manual. Pick a marker, pick a field, take it. Two-minute rounds — hunt the prey before the clock or the tag pads beat you.'}</p>
      <h2>Your marker</h2><div class="ob-row" id="ob-markers"></div>
      <h2>Your paint</h2><div class="ob-row ob-paints" id="ob-paints"></div>
      <h2>The field</h2><div class="ob-row" id="ob-fields"></div>
      <div class="ob-controls">⌨ <b>WASD</b> move · <b>mouse</b> aim · <b>LMB</b> shoot · <b>R</b> reload · <b>SPACE</b> hop — that's the whole manual</div>`;
    const paints = wrap.querySelector('#ob-paints')!;
    for (const c of PAINT_COLORS) {
      const sw = document.createElement('button');
      sw.className = `ob-swatch${(st.paint ?? PAINT_COLORS[0].name) === c.name ? ' selected' : ''}`;
      sw.title = c.name;
      sw.style.background = `#${c.hex.toString(16).padStart(6, '0')}`;
      sw.onclick = () => { st.paint = c.name; saveOnboarding(st); mountOnboarding(host); };
      paints.appendChild(sw);
    }
    const markers = wrap.querySelector('#ob-markers')!;
    for (const mk of PAINTBALL_MARKERS) {
      const def = WEAPONS[mk.id];
      // coach-ui: four DISTINCT silhouettes (spray burst / one ball / lobbed
      // arc / fan spread) — the icon slot differentiates again, and the
      // emoji's off-palette paint blobs leave the terminal (4 judges)
      const glyph = MARKER_GLYPHS[mk.id] ?? MARKER_GLYPHS.marker_blitz;
      const c = card(`<div class="ob-icon">${glyph}</div><b>${def.name}</b><span>${mk.blurb}</span>`, st.marker === mk.id);
      c.onclick = () => { st.marker = mk.id; saveOnboarding(st); mountOnboarding(host); };
      markers.appendChild(c);
    }
    const fields = wrap.querySelector('#ob-fields')!;
    for (const f of PAINTBALL_FIELDS) {
      const c = card(`<b>${f.name}</b><span>${f.blurb}</span>`, st.fieldId === f.id);
      c.prepend(fieldThumb(f.seed, f.theme));
      c.onclick = () => { st.fieldId = f.id; saveOnboarding(st); mountOnboarding(host); };
      fields.appendChild(c);
    }
    const go = document.createElement('button');
    go.className = 'ob-go';
    go.textContent = second ? 'TAKE THE FIELD — AS PREY' : 'TAKE THE FIELD';
    go.onclick = () => {
      const cfg = paintballConfig();
      root.classList.add('hidden');
      host.launch({ mode: 'paintball', theme: cfg.theme, seed: cfg.seed });
    };
    wrap.appendChild(go);
  } else if (st.stage === 'profile') {
    const cls = st.recommended ?? 'infantry';
    const gear = EQUIPMENT[st.gear ?? SIGNATURE_GEAR[cls]];
    const kills = st.rounds.reduce((a, r) => a + r.kills, 0);
    const longest = Math.max(0, ...st.rounds.map((r) => r.longestKill));
    wrap.innerHTML = `
      <h1>THE YARD READ YOUR FILE</h1>
      <p class="ob-sub">${kills} splats · longest ${longest.toFixed(0)}u · ${st.rounds.find((r) => r.role === 'prey')?.survived ? 'survived as prey' : 'caught as prey'}</p>
      <div class="ob-profile">
        <div class="ob-style">${STYLE_NAMES[cls]}</div>
        <div class="ob-class">Recommended: <b>${CLASSES[cls].name}</b> — ${CLASSES[cls].desc}</div>
        <div class="ob-gear">Signature issue for your first drop: <b>${gear?.icon ?? ''} ${gear?.name ?? ''}</b><br><span>${gear?.desc ?? ''}</span></div>
      </div>`;
    const go = document.createElement('button');
    go.className = 'ob-go';
    go.textContent = `DEPLOY AS ${CLASSES[cls].name.toUpperCase()}`;
    go.onclick = () => {
      saveOnboarding({ ...st, stage: 'war' });
      root.classList.add('hidden');
      host.launch({ mode: 'conquest', theme: 'savanna', classId: cls, equipment: st.gear ? [st.gear] : [] });
    };
    wrap.appendChild(go);
    // §14 decision: hating the recommendation costs ONE click, zero matches
    const reject = document.createElement('button');
    reject.className = 'ob-alt';
    reject.textContent = 'Not me. Show me everything.';
    reject.onclick = () => {
      saveOnboarding({ ...st, stage: 'war', recommended: undefined, gear: undefined });
      root.classList.add('hidden');
      location.reload(); // the full menu, nothing pre-picked
    };
    wrap.appendChild(reject);
  } else if (st.stage === 'war') {
    // the interstitial explains itself ONCE; after that it's pure friction —
    // veterans of one viewing get a quiet pass-through to the real menu
    if (st.warSeen) { root.classList.add('hidden'); return false; }
    wrap.innerHTML = `
      <h1>THE FRONT</h1>
      <p class="ob-sub">War drop ${st.warMatches + 1} of 3 before your path review. Your record is being written now — longest shot, clutch plays, all of it.</p>`;
    const go = document.createElement('button');
    go.className = 'ob-go';
    go.textContent = 'CONTINUE TO DEPLOYMENT';
    go.onclick = () => {
      saveOnboarding({ ...st, warSeen: true });
      root.classList.add('hidden'); // fall through to the real menu
    };
    wrap.appendChild(go);
  } else if (st.stage === 'split') {
    wrap.innerHTML = `
      <h1>PATH REVIEW — YOU'VE TASTED BLOOD</h1>
      <p class="ob-sub">Three drops in. Command has two folders open on you. This choice is about RESPONSIBILITY, not power — both paths fight the same war.</p>
      <div class="ob-row" id="ob-paths"></div>`;
    const row = wrap.querySelector('#ob-paths')!;
    const enlisted = card('<div class="ob-icon">🪖</div><b>ENLISTED</b><span>The grunt\'s road: squad life, playstyle ribbons, mastery of the kit. You fight the war.</span>', false);
    enlisted.onclick = () => {
      saveOnboarding({ ...st, stage: 'done', path: 'enlisted' });
      root.classList.add('hidden');
      location.reload();
    };
    const ocs = card('<div class="ob-icon">⭐</div><b>OFFICER CANDIDATE SCHOOL</b><span>The chain of command: qualification, judgment, orders that outlive your login (§7). You RUN the war.</span>', false);
    ocs.onclick = () => {
      saveOnboarding({ ...st, stage: 'done', path: 'ocs' });
      root.classList.add('hidden');
      location.reload();
    };
    row.appendChild(enlisted);
    row.appendChild(ocs);
  }
  wrap.appendChild(skip);
  return st.stage !== 'war'; // the war interstitial lets the menu show beneath
}
