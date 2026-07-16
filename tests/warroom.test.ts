// ---------------------------------------------------------------------------
// §11.5 The War Room — the pure parts, tested without a socket in sight:
// the status payload shape (from a real World fixture), the control-band
// mapping, the nudge writer and its §16 audit trail, and the shared key.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import {
  BAND_EDGE, FRONTS, NUDGE_LIMIT, SCAR_EDGE, applyNudge, bandOf, freshCampaign, stageOperation,
} from '../src/client/campaign';
import { campaignSummary, frontForRoom, keyOk, roomStatus } from '../src/server/warroom';
import { World } from '../src/sim/world';

describe('War Room status payload (§11.5 OBSERVE)', () => {
  it('shapes a room from a live World fixture — humans, bots, score, clock', () => {
    const w = new World({ seed: 7, mode: 'ctf', theme: 'savanna' });
    w.addSoldier('Watchstander', 'infantry', 0, 'human');
    w.addSoldier('Vex', 'infantry', 0, 'bot');
    w.addSoldier('Talon', 'heavy', 1, 'bot');
    const rs = roomStatus(w, 'savanna');
    expect(rs.mode).toBe('ctf');
    expect(rs.theme).toBe('savanna');
    expect(rs.front).toBe('Bridge Delta');           // ctf + savanna is Bridge Delta ground
    expect(rs.humans).toBe(1);
    expect(rs.bots).toBe(2);
    expect(rs.roster).toEqual([{ name: 'Watchstander', team: 0, kills: 0, deaths: 0 }]);
    expect(rs.scores).toEqual([0, 0]);
    expect(rs.over).toBe(false);
    expect(rs.timeLeft).toBeGreaterThan(0);          // a finite match clock, in seconds
  });

  it('endless clocks (horde) survive JSON as -1, not Infinity', () => {
    const w = new World({ seed: 3, mode: 'horde', theme: 'savanna' });
    const rs = roomStatus(w, 'savanna');
    expect(rs.timeLeft).toBe(-1);
    expect(JSON.parse(JSON.stringify(rs)).timeLeft).toBe(-1); // the wire agrees
  });

  it('front resolution: exact theme+mode beats mode-only, unknown mode is null', () => {
    expect(frontForRoom('ctf', 'europa')).toBe('The Port');       // exact
    expect(frontForRoom('ctf', 'titan')).toBe('Bridge Delta');    // mode-only fallback
    expect(frontForRoom('safehouse', 'savanna')).toBe(null);      // no front fights safehouse
  });

  it('campaign summary counts the standing and carries every front with its band', () => {
    const c = freshCampaign(1000);
    c.fronts.airbase.control = BAND_EDGE;      // exactly at the edge → held
    c.fronts.refinery.control = -80;
    c.fronts.refinery.scarActive = true;
    const s = campaignSummary(c);
    expect(s.fronts).toHaveLength(FRONTS.length);
    expect(s.standing).toEqual({ coalition: 1, contested: 8, collective: 1 });
    expect(s.frontsToWin).toBe(6);
    expect(s.season).toBe(1);
    expect(s.fronts.find((f) => f.id === 'airbase')?.band).toBe('coalition');
    expect(s.fronts.find((f) => f.id === 'refinery')).toMatchObject({ band: 'collective', scarActive: true, scar: 'fire' });
    // the band mapping itself, at the rails (22B)
    expect(bandOf(BAND_EDGE - 0.1)).toBe('contested');
    expect(bandOf(-BAND_EDGE)).toBe('collective');
  });
});

describe('the nudge writer (§11.5 NUDGE, §16 audit)', () => {
  it('tips control by the delta and signs the journal OPERATOR', () => {
    const c = freshCampaign(1000);
    const lines = applyNudge(c, 'airbase', 10, 2000);
    expect(c.fronts.airbase.control).toBe(10);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^OPERATOR: /);
    expect(lines[0]).toContain('+10');
    expect(c.dispatch[0]).toEqual({ text: lines[0], at: 2000, simulated: false });
  });

  it('clamps the thumb to ±NUDGE_LIMIT and the control to the ±100 rails', () => {
    const c = freshCampaign(1000);
    applyNudge(c, 'airbase', 999);                       // an over-eager operator
    expect(c.fronts.airbase.control).toBe(NUDGE_LIMIT);  // ...gets exactly 10
    for (let i = 0; i < 30; i++) applyNudge(c, 'airbase', 10);
    expect(c.fronts.airbase.control).toBe(100);          // the rail holds
  });

  it('band flips and scars announce themselves as decree, and fade the same way', () => {
    const c = freshCampaign(1000);
    c.fronts.the_port.control = BAND_EDGE - 5;
    let lines = applyNudge(c, 'the_port', 10);
    expect(lines.some((l) => l.includes('United Front ground — so says command'))).toBe(true);
    c.fronts.the_port.control = SCAR_EDGE - 5;
    lines = applyNudge(c, 'the_port', 10);
    expect(c.fronts.the_port.scarActive).toBe(true);
    expect(lines.some((l) => l.startsWith('OPERATOR:') && l.includes('carries a scar'))).toBe(true);
    // drag it all the way back to contested — the scar fades, still on the record
    c.fronts.the_port.control = BAND_EDGE + 2;
    lines = applyNudge(c, 'the_port', -10);
    expect(c.fronts.the_port.scarActive).toBe(false);
    expect(lines.some((l) => l.includes('scar fades'))).toBe(true);
    // every single line of all that was signed
    expect(c.dispatch.every((d) => d.text.startsWith('OPERATOR:'))).toBe(true);
  });

  it('a nudge is not a battle: lastBattleAt untouched, unknown front/zero delta write nothing', () => {
    const c = freshCampaign(1000);
    applyNudge(c, 'airbase', 10);
    expect(c.fronts.airbase.lastBattleAt).toBe(0);
    expect(applyNudge(c, 'atlantis', 10)).toEqual([]);
    expect(applyNudge(c, 'airbase', 0)).toEqual([]);
    expect(c.dispatch).toHaveLength(1); // only the one real nudge landed
  });

  it('stages an operation: codename upcased, note attached, journal capped at 60', () => {
    const c = freshCampaign(1000);
    const line = stageOperation(c, 'ember latch', 'take the port by night', 3000);
    expect(line).toBe('OPERATOR: Operation EMBER LATCH is staged — take the port by night.');
    expect(c.dispatch[0]).toEqual({ text: line, at: 3000, simulated: false });
    expect(stageOperation(c, '   ')).toContain('Operation UNNAMED');
    for (let i = 0; i < 70; i++) stageOperation(c, `op ${i}`);
    expect(c.dispatch).toHaveLength(60); // the journal never grows past its binding
  });
});

describe('the shared key (§11.5 ADMINISTRATE — Stage-2 hardening point)', () => {
  it('accepts only the exact configured string', () => {
    expect(keyOk('dev-key', 'dev-key')).toBe(true);
    expect(keyOk('DEV-KEY', 'dev-key')).toBe(false);
    expect(keyOk('', 'dev-key')).toBe(false);
    expect(keyOk(undefined, 'dev-key')).toBe(false);
    expect(keyOk(['dev-key'], 'dev-key')).toBe(false); // header arrays don't sneak by
  });
});
