// ───────────────────────────────────────────────────────────────────────────
// THE UI LAB — the HUD size knobs.
//
// Robert: "the ui elements at the bottom are too big… I need a way to resize
// and change stuff, to get exactly what I want."
//
// The trap this suite exists for: a lab candidate whose numbers sit OUTSIDE the
// loader's clamp. You would click it, watch the HUD resize, be happy — and then
// reload and find yourself silently snapped back. The lab and the loader have
// to agree about the legal range or the lab is lying to you.
// ───────────────────────────────────────────────────────────────────────────
import { beforeEach, describe, expect, it } from 'vitest';
import { UI_CANDIDATES, applyCandidate } from '../src/client/uilab';
import { loadSettings, saveSettings, settings } from '../src/client/settings';

// the two browser things settings.ts touches, stubbed just enough to run
let store: Record<string, string> = {};
const vars: Record<string, string> = {};
beforeEach(() => {
  store = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
  };
  (globalThis as Record<string, unknown>).document = {
    documentElement: { style: { setProperty: (k: string, v: string) => { vars[k] = v; } } },
  };
  settings.hudScaleVitals = 1;
  settings.hudScaleWeapon = 1;
  settings.hudOpacity = 1;
});

const SCALE = { min: 0.6, max: 1.4 };
const OPACITY = { min: 0.4, max: 1 };

describe('the UI Lab candidates', () => {
  it('offers a starting point and never a duplicate id', () => {
    expect(UI_CANDIDATES.length).toBeGreaterThanOrEqual(3);
    expect(new Set(UI_CANDIDATES.map((c) => c.id)).size).toBe(UI_CANDIDATES.length);
  });

  it('every candidate survives a save/load round trip unchanged', () => {
    for (const c of UI_CANDIDATES) {
      applyCandidate(c);
      // wipe the in-memory copy so load has to come off the store
      settings.hudScaleVitals = 0; settings.hudScaleWeapon = 0; settings.hudOpacity = 0;
      loadSettings();
      expect(settings.hudScaleVitals, `${c.name} vitals`).toBe(c.vitals);
      expect(settings.hudScaleWeapon, `${c.name} weapon`).toBe(c.weapon);
      expect(settings.hudOpacity, `${c.name} opacity`).toBe(c.opacity);
    }
  });

  it('keeps every candidate inside the sliders it is edited with', () => {
    for (const c of UI_CANDIDATES) {
      expect(c.vitals, `${c.name} vitals`).toBeGreaterThanOrEqual(SCALE.min);
      expect(c.vitals, `${c.name} vitals`).toBeLessThanOrEqual(SCALE.max);
      expect(c.weapon, `${c.name} weapon`).toBeGreaterThanOrEqual(SCALE.min);
      expect(c.weapon, `${c.name} weapon`).toBeLessThanOrEqual(SCALE.max);
      expect(c.opacity, `${c.name} opacity`).toBeGreaterThanOrEqual(OPACITY.min);
      expect(c.opacity, `${c.name} opacity`).toBeLessThanOrEqual(OPACITY.max);
    }
  });

  it('keeps a baseline that is the shipped HUD, untouched', () => {
    const base = UI_CANDIDATES.find((c) => c.id === 'default');
    expect(base).toBeDefined();
    expect([base!.vitals, base!.weapon, base!.opacity]).toEqual([1, 1, 1]);
  });

  it('answers the complaint it was built for — something smaller than shipped', () => {
    expect(UI_CANDIDATES.some((c) => c.weapon < 1)).toBe(true);
    expect(UI_CANDIDATES.some((c) => c.vitals < 1)).toBe(true);
  });
});

describe('the loader guards the range', () => {
  it('clamps a hand-edited profile back into the legal band', () => {
    store.ww_settings = JSON.stringify({ hudScaleVitals: 9, hudScaleWeapon: 0.01, hudOpacity: 0 });
    loadSettings();
    expect(settings.hudScaleVitals).toBe(SCALE.max);
    expect(settings.hudScaleWeapon).toBe(SCALE.min);
    expect(settings.hudOpacity).toBe(OPACITY.min);
  });

  it('leaves a profile that never met the knobs at the shipped size', () => {
    store.ww_settings = JSON.stringify({ masterVolume: 0.3 });
    loadSettings();
    expect(settings.hudScaleVitals).toBe(1);
    expect(settings.hudScaleWeapon).toBe(1);
  });

  it('persists the scales so the game reads what the lab set', () => {
    settings.hudScaleWeapon = 0.72;
    saveSettings();
    expect(JSON.parse(store.ww_settings).hudScaleWeapon).toBe(0.72);
  });
});
