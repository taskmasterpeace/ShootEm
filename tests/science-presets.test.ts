import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SCIENCE_PRESETS,
  prepareSciencePreset,
  sciencePresetCardHTML,
} from '../src/client/science-presets';

describe('Science Mission quick deploy presets', () => {
  it('mounts a labelled quick-deploy shelf on the main menu', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('id="science-quick-deploy"');
    expect(html).toContain('aria-labelledby="science-quick-title"');
    expect(html).toContain('id="science-preset-cards"');
    expect(html.indexOf('id="science-quick-deploy"')).toBeLessThan(html.indexOf('id="mode-select"'));
  });

  it('ships five distinct representative operations in menu order', () => {
    expect(SCIENCE_PRESETS.map((preset) => preset.id)).toEqual([
      'k9-house-clear',
      'researcher-rescue',
      'clone-vault-raid',
      'quarantine-sweep',
      'airfield-ambush',
    ]);
    expect(new Set(SCIENCE_PRESETS.map((preset) => preset.id)).size).toBe(SCIENCE_PRESETS.length);
    expect(SCIENCE_PRESETS.map((preset) => ({
      id: preset.id,
      classId: preset.classId,
      verb: preset.options.verb,
      site: preset.options.site,
      complication: preset.options.complication,
    }))).toEqual([
      { id: 'k9-house-clear', classId: 'infantry', verb: 'hunt', site: 'officer-villa', complication: null },
      { id: 'researcher-rescue', classId: 'medic', verb: 'rescue', site: 'research-annex', complication: null },
      { id: 'clone-vault-raid', classId: 'engineer', verb: 'raid', site: 'clone-vault', complication: 'alarm-net' },
      { id: 'quarantine-sweep', classId: 'heavy', verb: 'deny', site: 'quarantine-zone', complication: 'third-party' },
      { id: 'airfield-ambush', classId: 'heavy', verb: 'ambush', site: 'enemy-airfield', complication: null },
    ]);
  });

  it('prepares deterministic eight-print free-play launches', () => {
    for (const preset of SCIENCE_PRESETS) {
      const first = prepareSciencePreset(preset);
      const second = prepareSciencePreset(preset);
      expect(first).toEqual(second);
      expect(first.frontId).toBeUndefined();
      expect(first.spec.squadSize).toBe(8);
      expect(first.spec.seed).toBe(preset.seed);
      expect(first.spec.verb).toBe(preset.options.verb);
      expect(first.spec.site).toBe(preset.options.site);
      expect(first.spec.theme).toBe(preset.options.theme);
    }
  });

  it('renders every preset as a labelled semantic launch button', () => {
    for (const preset of SCIENCE_PRESETS) {
      const html = sciencePresetCardHTML(preset);
      expect(html).toContain('<button');
      expect(html).toContain('type="button"');
      expect(html).toContain(`data-science-preset="${preset.id}"`);
      expect(html).toContain(preset.title);
      expect(html).toContain(preset.description);
      expect(html).toContain(preset.classLabel);
      for (const tag of preset.tags) expect(html).toContain(tag);
    }
  });
});
