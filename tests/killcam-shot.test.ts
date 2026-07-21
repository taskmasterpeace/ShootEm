// ---------------------------------------------------------------------------
// THE DEATH-CAM DIRECTOR (DEATH-DATA §5, STATUS §2 — "the death cam should vary
// by death"). pickKillcamShot frames a death by HOW it happened: a spawn-cut, a
// blast pulled wide, a precision autopsy, a ridden round, or the straight duel.
// Pure + branch-ordered, so these pin the table the killcam reads.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { KILLCAM_CAM, pickKillcamShot } from '../src/client/replay';

const base = { killerName: 'Merc', weaponName: 'Rifle', tracer: 'bullet', splash: 0, range: 12, timeAlive: 30 };

describe('pickKillcamShot — the director shot table', () => {
  it('a fresh-spawn death is a brisk SPAWN CUT, whatever the weapon', () => {
    const s = pickKillcamShot({ ...base, tracer: 'rail', range: 40, timeAlive: 2 });
    expect(s.kind).toBe('spawn');
    expect(s.brisk).toBe(true);
    expect(s.label).toContain('SPAWN CUT');
  });

  it('a blast pulls the camera WIDE', () => {
    const s = pickKillcamShot({ ...base, weaponName: 'GL', tracer: 'shell', splash: 3, range: 20 });
    expect(s.kind).toBe('wide');
    expect(s.cam).toBeGreaterThan(KILLCAM_CAM); // wider than the default duel
  });

  it('a precision rail/beam from range opens the AUTOPSY, tight', () => {
    expect(pickKillcamShot({ ...base, tracer: 'rail', range: 40 }).kind).toBe('autopsy');
    const s = pickKillcamShot({ ...base, tracer: 'beam', range: 33 });
    expect(s.kind).toBe('autopsy');
    expect(s.cam).toBeLessThan(KILLCAM_CAM); // pulled in tighter than the duel
    // a rail from point-blank is NOT an autopsy — it needs the distance
    expect(pickKillcamShot({ ...base, tracer: 'rail', range: 10 }).kind).not.toBe('autopsy');
  });

  it('a long bullet/shell is RIDE THE ROUND; a close one is the plain duel', () => {
    expect(pickKillcamShot({ ...base, tracer: 'bullet', range: 55 }).kind).toBe('ride');
    const duel = pickKillcamShot({ ...base, tracer: 'bullet', range: 12 });
    expect(duel.kind).toBe('duel');
    expect(duel.cam).toBe(KILLCAM_CAM);
  });

  it('no killer (self/environment) falls to the bare killcam', () => {
    const s = pickKillcamShot({ range: 0, timeAlive: 30, splash: 0 });
    expect(s.kind).toBe('duel');
    expect(s.label).toBe('☠ Killcam');
  });
});
