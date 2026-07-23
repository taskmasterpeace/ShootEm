// ═══════════════════════════════════════════════════════════════════════════
// THE UI LAB — the HUD, laid out where you can actually change it.
//
// Robert: *"the ui elements at the bottom are too big… gun stuff on the right is
// too big… I need a way to resize and change stuff, to get exactly what I want.
// Build a UI thing in the harness — we should be able to see CANDIDATES, and
// EDIT the ui, put it in our unified dev harness."*
//
// So this is not a screenshot sheet. It is the real HUD blocks, at the size the
// game will actually draw them, with the knobs live: drag a slider and the
// block in front of you resizes. What you settle on is written to the same
// `settings` store the game reads (`applyHudVars`), so dialing it in here IS
// dialing in the game — there is no second copy of the numbers to drift.
//
// CANDIDATES are named starting points (COMPACT / DEFAULT / BIG), because
// "smaller" is easier to judge against something than in the abstract.
// ═══════════════════════════════════════════════════════════════════════════
import { applyHudVars, loadSettings, saveSettings, settings } from './settings';

/** A named starting point — somewhere to judge "too big" from. */
export interface UiCandidate {
  id: string;
  name: string;
  note: string;
  vitals: number;
  weapon: number;
  opacity: number;
}

export const UI_CANDIDATES: UiCandidate[] = [
  { id: 'compact', name: 'COMPACT', note: 'Both corners pulled in. The most screen for the world.', vitals: 0.75, weapon: 0.7, opacity: 0.9 },
  { id: 'default', name: 'AS DESIGNED', note: 'The shipped sizes — the baseline everything else is judged against.', vitals: 1, weapon: 1, opacity: 1 },
  { id: 'lean-gun', name: 'LEAN GUN', note: 'Vitals as designed, the weapon block cut down. Robert\'s "gun stuff is too big".', vitals: 1, weapon: 0.72, opacity: 1 },
  { id: 'big', name: 'BIG', note: 'For a television across the room, or tired eyes.', vitals: 1.25, weapon: 1.2, opacity: 1 },
];

export const applyCandidate = (c: UiCandidate): void => {
  settings.hudScaleVitals = c.vitals;
  settings.hudScaleWeapon = c.weapon;
  settings.hudOpacity = c.opacity;
  saveSettings();
  applyHudVars();
};

/** The knobs the lab exposes, so the panel is data and not markup. */
interface Knob {
  key: 'hudScaleVitals' | 'hudScaleWeapon' | 'hudOpacity';
  label: string;
  hint: string;
  min: number;
  max: number;
}
const KNOBS: Knob[] = [
  { key: 'hudScaleVitals', label: 'VITALS BLOCK', hint: 'bottom-left — health, energy, rank', min: 0.6, max: 1.4 },
  { key: 'hudScaleWeapon', label: 'WEAPON BLOCK', hint: 'bottom-right — the gun, ammo, the kit', min: 0.6, max: 1.4 },
  { key: 'hudOpacity', label: 'OPACITY', hint: 'how much of the world shows through', min: 0.4, max: 1 },
];

/**
 * Mount the lab into `host`. Live: every input writes the setting, saves it and
 * re-applies the CSS vars, so the HUD in the same page resizes as you drag.
 *
 * `onWorstCase` is handed the BAD DAY toggle — the page that owns the HUD
 * decides what a bad day looks like; the lab only asks for one.
 */
export function mountUiLab(host: HTMLElement, onWorstCase?: (loud: boolean) => void): void {
  loadSettings();
  applyHudVars();

  host.innerHTML = `
    <div class="uilab">
      <p class="uilab-lead">The real HUD blocks, at the size the game draws them.
        Drag a knob and the corner resizes under you — what you leave here is what you play with.</p>
      <div class="uilab-cands" id="uilab-cands"></div>
      <div class="uilab-knobs" id="uilab-knobs"></div>
      <label class="uilab-worst">
        <input type="checkbox" id="uilab-worst">
        <span>WORST CASE — every situational chip on (viral, moodle, corpse-burn,
          status strip). Size for this and the HUD never surprises you mid-fight.</span>
      </label>
      <div class="uilab-row">
        <button class="btn-wide" id="uilab-reset">RESET TO AS DESIGNED</button>
        <span class="uilab-read" id="uilab-read"></span>
      </div>
    </div>`;

  const cands = host.querySelector<HTMLElement>('#uilab-cands')!;
  const knobs = host.querySelector<HTMLElement>('#uilab-knobs')!;
  const read = host.querySelector<HTMLElement>('#uilab-read')!;

  const paintRead = (): void => {
    read.textContent = `vitals ${settings.hudScaleVitals.toFixed(2)}×  ·  `
      + `weapon ${settings.hudScaleWeapon.toFixed(2)}×  ·  opacity ${Math.round(settings.hudOpacity * 100)}%`;
  };

  cands.innerHTML = UI_CANDIDATES.map((c) => `
    <button class="uilab-cand" data-cand="${c.id}">
      <b>${c.name}</b><span>${c.note}</span>
    </button>`).join('');

  knobs.innerHTML = KNOBS.map((k) => `
    <label class="uilab-knob">
      <span class="uilab-k">${k.label}<i>${k.hint}</i></span>
      <input type="range" data-knob="${k.key}" min="${k.min}" max="${k.max}" step="0.01"
             value="${settings[k.key]}">
      <b data-out="${k.key}">${Number(settings[k.key]).toFixed(2)}</b>
    </label>`).join('');

  knobs.querySelectorAll<HTMLInputElement>('[data-knob]').forEach((el) => {
    el.addEventListener('input', () => {
      const key = el.dataset.knob as Knob['key'];
      settings[key] = Number(el.value);
      const out = knobs.querySelector<HTMLElement>(`[data-out="${key}"]`);
      if (out) out.textContent = Number(el.value).toFixed(2);
      saveSettings();
      applyHudVars();
      paintRead();
    });
  });

  cands.querySelectorAll<HTMLButtonElement>('[data-cand]').forEach((b) => {
    b.onclick = () => {
      const c = UI_CANDIDATES.find((x) => x.id === b.dataset.cand);
      if (!c) return;
      applyCandidate(c);
      knobs.querySelectorAll<HTMLInputElement>('[data-knob]').forEach((el) => {
        const key = el.dataset.knob as Knob['key'];
        el.value = String(settings[key]);
        const out = knobs.querySelector<HTMLElement>(`[data-out="${key}"]`);
        if (out) out.textContent = Number(settings[key]).toFixed(2);
      });
      cands.querySelectorAll('.uilab-cand').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      paintRead();
    };
  });

  const worst = host.querySelector<HTMLInputElement>('#uilab-worst')!;
  worst.onchange = () => onWorstCase?.(worst.checked);
  onWorstCase?.(false);

  host.querySelector<HTMLButtonElement>('#uilab-reset')!.onclick = () => {
    (cands.querySelector('[data-cand="default"]') as HTMLButtonElement | null)?.click();
  };

  paintRead();
}
