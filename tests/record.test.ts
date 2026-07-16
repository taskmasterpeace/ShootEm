// ---------------------------------------------------------------------------
// The Record (§3.4): the dossier folds the same event stream the HUD reads.
// Storage is exercised only where available — the fold logic is pure.
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { MatchTracker, freshDossier, rankFor } from '../src/client/record';
import { World } from '../src/sim/world';

describe('the Record — dossier pipeline', () => {
  it('the rank ladder climbs and tops out', () => {
    expect(rankFor(0).name).toBe('Private');
    expect(rankFor(160).name).toBe('Lance Corporal');
    expect(rankFor(999999).name).toBe('Colonel');
    expect(rankFor(999999).next).toBeNull();
  });

  it('kills, weapons, medals, and journal fold from a lived match', async () => {
    const w = new World({ seed: 3, mode: 'tdm' });
    const d = freshDossier('Reyes');
    const me = w.addSoldier('Reyes', 'infantry', 0, 'human');
    const foe = w.addSoldier('Bolt', 'infantry', 1, 'human');
    const tracker = new MatchTracker(d, 'Reyes', 'infantry', 'tdm', 3);

    // establish baselines, then take first blood at long range
    tracker.applyEvents(w.takeEvents(), w, me.id);
    me.pos = { x: -40, y: 0, z: 0 };
    foe.pos = { x: 40, y: 0, z: 0 };
    w.step(1 / 60, new Map());
    w.damageSoldier(foe, 999, me.id, 'rifle');
    tracker.applyEvents(w.takeEvents(), w, me.id);

    w.mode.over = true;
    w.mode.winner = 0;
    const sum = await tracker.finalize(w, me.id);
    expect(sum).not.toBeNull();
    expect(sum!.kills).toBe(1);
    expect(sum!.won).toBe(true);
    expect(d.lifetime.kills).toBe(1);
    expect(d.lifetime.matches).toBe(1);
    expect(d.lifetime.wins).toBe(1);
    expect(d.lifetime.perClass.infantry?.kills).toBe(1);
    // 80u kill: first blood AND marksman
    expect(d.medals.some((m) => m.id === 'first_blood')).toBe(true);
    expect(d.medals.some((m) => m.id === 'marksman')).toBe(true);
    // the weapon enters the gun locker with its history
    const wep = Object.keys(d.lifetime.perWeapon)[0];
    expect(d.lifetime.perWeapon[wep].kills).toBe(1);
    expect(d.armory).toContain(wep);
    // the journal wrote the story
    expect(d.journal.length).toBeGreaterThan(0);
    expect(d.soldier.rankPoints).toBeGreaterThan(0);
    // finalize is idempotent — the whistle only blows once
    expect(await tracker.finalize(w, me.id)).toBeNull();
    expect(d.lifetime.matches).toBe(1);
  });

  it('deaths are recorded and losses read like losses', async () => {
    const w = new World({ seed: 4, mode: 'tdm' });
    const d = freshDossier('Ash');
    const me = w.addSoldier('Ash', 'heavy', 0, 'human');
    const foe = w.addSoldier('Vex', 'infantry', 1, 'human');
    const tracker = new MatchTracker(d, 'Ash', 'heavy', 'tdm', 4);
    tracker.applyEvents(w.takeEvents(), w, me.id);
    w.damageSoldier(me, 999, foe.id, 'rifle');
    tracker.applyEvents(w.takeEvents(), w, me.id);
    w.mode.over = true; w.mode.winner = 1;
    const sum = await tracker.finalize(w, me.id);
    expect(sum!.deaths).toBe(1);
    expect(sum!.won).toBe(false);
    expect(d.lifetime.deaths).toBe(1);
    expect(d.lifetime.wins).toBe(0);
  });
});
