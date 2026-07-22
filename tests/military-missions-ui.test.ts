import { describe, expect, it } from 'vitest';
import { renderMilitaryMissionModeCard, renderMilitaryMissionModal } from '../src/client/military-missions-ui';

describe('Military Mission launcher presentation', () => {
  it('renders one launcher and six descriptive mission buttons', () => {
    const html = renderMilitaryMissionModal(null, false);
    expect(renderMilitaryMissionModeCard(false)).toContain('MILITARY MISSIONS');
    expect(html).toContain('role="dialog"');
    expect((html.match(/data-military-mission=/g) ?? [])).toHaveLength(6);
    for (const text of ['600×600u', '900×900u', '600×900u', '900×600u', 'LOCAL FIELD EXERCISE']) {
      expect(html).toContain(text);
    }
  });

  it('marks the chosen card and preserves staged-operation safety copy', () => {
    const html = renderMilitaryMissionModal('naval_hunt', true);
    expect(html).toContain('mission-card selected');
    expect(html).toContain('does not cancel or consume');
  });
});
