// ---------------------------------------------------------------------------
// W4.3 THE CORRECTIONS BOX — the paper corrects itself. Each edition runs ONE
// small retraction about the PREVIOUS issue, grounded in that issue's actual
// data and picked by the stable hash: the same pair of battles always prints
// the same correction. The Courier regrets the error.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { correctionLine, renderIssueHTML, type PressIssue } from '../src/client/newspaper';

const issue = (over: Partial<PressIssue> = {}): PressIssue => ({
  at: 1_700_000_000_000, season: 1, won: true, modeName: 'Team Deathmatch',
  aceName: 'ACE', aceKills: 0, longestShot: 0,
  myCost: 100, theirCost: 100, underdog: false,
  myKills: 10, theirKills: 8, medals: [],
  ...over,
});

describe('W4.3 — the corrections box', () => {
  it('the first edition has nothing to correct', () => {
    expect(correctionLine(undefined, issue())).toBeNull();
  });

  it('a bragged shot gets re-measured — grounded in the previous data', () => {
    const prev = issue({ longestShot: 48 });
    const cur = issue({ at: prev.at + 1000 });
    const line = correctionLine(prev, cur)!;
    expect(line).toContain('48u');
    expect(line).toContain('47u');
    expect(line).toContain('regrets');
  });

  it('deterministic: the same pair prints the same retraction, always', () => {
    const prev = issue({ longestShot: 30, aceKills: 7, underdog: true });
    const cur = issue({ at: prev.at + 5000 });
    expect(correctionLine(prev, cur)).toBe(correctionLine(prev, cur));
  });

  it('a front that flip-flops gets the continuity joke', () => {
    const prev = issue({ frontName: 'Verdant Line', controlDelta: 8 });
    const cur = issue({ at: prev.at + 2000, frontName: 'Verdant Line', controlDelta: -6, longestShot: 0, aceKills: 0 });
    const line = correctionLine(prev, cur)!;
    expect(line).toContain('VERDANT LINE');
    expect(line).toContain('changed hands again');
  });

  it('a flawless previous edition earns the apology for the inconvenience', () => {
    const prev = issue(); // no shot, no kills, no underdog, no front
    const line = correctionLine(prev, issue({ at: prev.at + 1000 }))!;
    expect(line).toContain('No factual errors');
  });

  it('the printed page carries the box — and the first page does not', () => {
    const prev = issue({ longestShot: 22 });
    const cur = issue({ at: prev.at + 1000 });
    expect(renderIssueHTML(cur, prev)).toContain('np-corrections');
    expect(renderIssueHTML(cur)).not.toContain('np-corrections');
  });
});
