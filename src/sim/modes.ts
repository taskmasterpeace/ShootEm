import { TEAM_NAMES, WEAPONS } from './data';
import { losClear, type GameMap } from './map';
import { isBoard, isZed, type ModeId, type ModeState, type RacerState, type RaceTrack, type Team, type ZedKind, type IronKind } from './types';
import type { World } from './world';
import { stepScienceMission } from './science-runtime';
import { pbBark, pbProximityTaunts } from './paintball';

const MATCH_TIME = 15 * 60;

export function initMode(id: ModeId, map: GameMap, minutes?: number): ModeState {
  const m: ModeState = {
    id, timeLeft: (minutes ?? 15) * 60 || MATCH_TIME, scores: [0, 0], target: 0, over: false, winner: -1,
  };
  switch (id) {
    case 'range':
      // the Proving Grounds never end — you leave when you're done
      m.timeLeft = Infinity;
      break;
    case 'paintball':
      // §14 decision: rounds are TWO MINUTES — three rounds fit inside seven,
      // and a new player sees the war before the war bores them
      m.timeLeft = 120;
      m.target = 3; // the prey wins by tagging all three points…
      m.points = map.controlPoints.map((cp, i) => ({
        id: i, name: cp.name, pos: { ...cp.pos }, owner: -1, progress: 0, radius: 3.5,
      }));
      // …and the MATCH is a series (Robert: "best out of 5") — first to 3
      // round wins. One lucky splat costs a round, never the afternoon.
      m.round = 1;
      m.roundWins = [0, 0];
      m.roundTarget = 3;
      m.intermission = 0;
      break;
    case 'tdm':
      m.target = 50;
      break;
    case 'ctf':
      m.target = 3;
      m.flags = ([0, 1] as Team[]).map((team) => ({
        team,
        homePos: { ...map.flagPos[team] },
        pos: { ...map.flagPos[team] },
        carrierId: -1,
        atHome: true,
        droppedAt: 0,
      }));
      break;
    case 'koth':
      m.target = 120;
      m.hillPos = { ...map.hillPos };
      m.hillRadius = 9;
      m.hillHolder = -1;
      break;
    case 'conquest':
      m.target = 500;
      m.points = map.controlPoints.map((cp, i) => ({
        id: i, name: cp.name, pos: { ...cp.pos }, owner: -1, progress: 0, radius: 8,
      }));
      break;
    case 'survival':
      m.wave = 0;
      m.zombiesLeft = 0;
      m.nextWaveAt = 5;
      m.target = 0;
      m.timeLeft = Infinity;
      break;
    case 'horde':
      m.wave = 0;          // repurposed: intensity level shown on the HUD
      m.zombiesLeft = 0;
      m.nextWaveAt = 3;    // first spawn
      m.target = 0;
      m.timeLeft = Infinity;
      break;
    case 'safehouse':
      m.timeLeft = 5 * 60; // evac countdown — reaching zero is the WIN
      m.wave = 0;
      m.zombiesLeft = 0;
      m.nextWaveAt = 6;
      m.target = 0;
      m.alertUntil = 0;
      m.alert = false;
      break;
    case 'science':
      m.timeLeft = Infinity;
      m.target = 0;
      break;
    case 'race':      // Grand Prix — first past the laps vs the pack
      m.raceKind = 'circuit';
      m.raceLaps = 3;
      m.target = 3;
      m.timeLeft = 8 * 60;  // a generous cap; the race really ends on the flag
      m.countdown = 4.5;
      break;
    case 'timetrial': // Time Trial — you vs your ghost, no clock pressure
      m.raceKind = 'trial';
      m.raceLaps = 3;
      m.target = 3;
      m.timeLeft = Infinity;
      m.countdown = 4.5;
      break;
  }
  return m;
}

export function stepMode(w: World, dt: number) {
  const m = w.mode;
  // race grid countdown runs BEFORE any clock — the lights aren't out yet
  if ((m.id === 'race' || m.id === 'timetrial') && (m.countdown ?? 0) > 0) {
    stepRace(w, dt);
    return;
  }
  if (Number.isFinite(m.timeLeft)) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      if (m.id === 'safehouse') {
        // surviving to the end of the countdown IS the victory
        endMatch(w, 0);
        w.emit({ type: 'announce', text: 'EVAC ARRIVED — DR. VOSS IS SAFE', big: true });
      } else if (m.id === 'paintball') {
        // the prey outlived the pack's clock — that round is THEIRS
        w.emit({ type: 'announce', text: 'TIME — THE PREY SURVIVED', big: true });
        endPaintballRound(w, m.huntedTeam ?? 1);
      } else {
        endMatch(w, m.scores[0] === m.scores[1] ? -1 : m.scores[0] > m.scores[1] ? 0 : 1);
      }
      return;
    }
  }
  switch (m.id) {
    case 'tdm': stepTdm(w); break;
    case 'ctf': stepCtf(w, dt); break;
    case 'koth': stepKoth(w, dt); break;
    case 'conquest': stepConquest(w, dt); break;
    case 'survival': stepSurvival(w, dt); break;
    case 'horde': stepHorde(w, dt); break;
    case 'safehouse': stepSafehouse(w, dt); break;
    case 'science': stepScienceMission(w, dt); break;
    case 'paintball': stepPaintball(w, dt); break;
    case 'race': case 'timetrial': stepRace(w, dt); break;
    case 'range': break; // no clock, no whistle — just the work
  }
}

// ---------- paintball: hunters vs hunted (§3.3/§14) ----------

/**
 * The onboarding yard's whole ruleset: one outnumbered prey, one pack.
 * Splatted players SIT — no respawn inside a round. The prey wins by tagging
 * all three points or by outliving the clock; the pack wins by painting the
 * prey out. Which side is "hunted" is read off the roster: the smaller team.
 */
function stepPaintball(w: World, dt: number) {
  const m = w.mode;
  // the smaller side is the prey — decided once, from the starting roster
  if (m.huntedTeam === undefined) {
    const count: [number, number] = [0, 0];
    for (const s of w.humansAndBots()) count[s.team]++;
    m.huntedTeam = count[0] <= count[1] ? 0 : 1;
    // THE BREAK (real paintball's "ten seconds — GO!"): the pack's guns
    // stay COLD off the opening whistle while the rabbit breaks into the
    // maze. Without this the AI probe showed 6-second rounds — the pack
    // met the prey mid-field and the chase never existed.
    holdThePack(w, m.huntedTeam);
  }
  const hunted = m.huntedTeam;

  // between rounds: the yard holds its breath, then everyone walks back on
  if ((m.intermission ?? 0) > 0) {
    m.intermission! -= dt;
    if (m.intermission! <= 0) {
      m.intermission = 0;
      startPaintballRound(w);
    }
    return;
  }

  // A PRACTICE YARD (the Gallery): when one side has no roster at all —
  // drill dummies aren't players (humansAndBots excludes them) — there is
  // nothing to referee. The round machinery stands down entirely, or the
  // whistle would end a phantom round every 4 seconds and keep re-spawning
  // the shooter off their own firing line.
  {
    const count: [number, number] = [0, 0];
    for (const s of w.humansAndBots()) count[s.team]++;
    if (count[0] === 0 || count[1] === 0) return;
  }

  // paint is final (per round): the splatted watch from the dead-box.
  // A FRESH splat gets a bark from whoever threw the paint — the play types
  // talk (Robert: "our play types are gonna drive what they say").
  for (const s of w.humansAndBots()) {
    if (!s.alive) {
      s.respawnAt = Infinity;
      if (!s.pbSplatBarked) {
        s.pbSplatBarked = true;
        const killer = s.lastKillerId >= 0 ? w.soldiers.get(s.lastKillerId) : undefined;
        if (killer?.alive && killer.kind === 'bot') pbBark(w, killer, 'splat');
      }
    }
  }

  // tag points: a live prey standing on an untagged pad claims it in 2s
  let tags = 0;
  for (const p of m.points!) {
    if (p.owner === hunted) { tags++; continue; }
    const onPad = [...w.soldiers.values()].some((s) =>
      s.alive && s.team === hunted && Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < p.radius);
    if (onPad) {
      p.progress += dt;
      if (p.progress >= 2) {
        p.owner = hunted;
        tags++;
        w.emit({ type: 'announce', text: `Point ${p.name} TAGGED — ${tags}/3`, big: false });
      }
    } else {
      p.progress = 0; // stepping off resets the spray-down
    }
  }
  m.scores = hunted === 0 ? [tags, 0] : [0, tags];

  // the mouths run when they close on a human (persona proximity taunts)
  pbProximityTaunts(w);

  const liveHunted = [...w.soldiers.values()].some((s) => s.alive && s.team === hunted && (s.kind === 'human' || s.kind === 'bot'));
  const liveHunters = [...w.soldiers.values()].some((s) => s.alive && s.team !== hunted && (s.kind === 'human' || s.kind === 'bot'));
  if (tags >= m.target) endPaintballRound(w, hunted);            // tagged out the yard
  // the trade-out goes to the PREY: a hunted who takes the whole pack with
  // them has EARNED the round (consistent with the clock tie, where a prey
  // splatted the same tick the timer dies still wins)
  else if (!liveHunters) endPaintballRound(w, hunted);           // the prey ATE the pack
  else if (!liveHunted) endPaintballRound(w, (1 - hunted) as Team); // painted out
  else if (m.timeLeft <= 0) endPaintballRound(w, hunted);        // survived the clock
}

/** A round of the series just ended. Bank it; the series ends at roundTarget
 *  wins, otherwise the yard takes a 4-second breath and resets. */
function endPaintballRound(w: World, winner: Team) {
  const m = w.mode;
  if (m.over || (m.intermission ?? 0) > 0) return; // one whistle per round
  const wins = (m.roundWins ??= [0, 0]);
  wins[winner]++;
  w.emit({ type: 'whistle', pos: w.map.hillPos });
  const hunted = m.huntedTeam ?? 1;
  const packWins = wins[1 - hunted], preyWins = wins[hunted];
  if (wins[winner] >= (m.roundTarget ?? 3)) {
    endMatch(w, winner); // series over — the real whistle
    return;
  }
  w.emit({
    type: 'announce', big: true,
    text: `ROUND ${m.round ?? 1} — ${winner === hunted ? 'PREY' : 'PACK'} · ${packWins}–${preyWins}`,
  });
  // match point gets called out — tension is the product
  if (wins.some((x) => x === (m.roundTarget ?? 3) - 1)) {
    w.emit({ type: 'announce', text: 'MATCH POINT', big: false });
  }
  // park the clock so the generic timer can't double-call the round while
  // the yard resets; startPaintballRound deals the real clock
  m.timeLeft = 120;
  m.intermission = 4;
}

/** THE BREAK: EVERY trigger stays shut for the opening seconds of a round —
 *  the prey runs, the pack walks on, nobody shoots (the first cut held only
 *  the pack, and the prey executed three frozen hunters — real paintball
 *  counts everyone down together). Grenades hold a beat longer. */
function holdThePack(w: World, _hunted: Team) {
  for (const s of w.humansAndBots()) {
    s.nextFireAt = Math.max(s.nextFireAt, w.time + 8);
    s.nextGrenadeAt = Math.max(s.nextGrenadeAt, w.time + 12);
  }
  w.emit({ type: 'announce', text: 'TEN SECONDS — GO!', big: false });
}

/** Walk everyone back onto the yard: fresh clip, fresh clock, wiped pads.
 *  The paint on the field STAYS — the yard remembers the series. */
function startPaintballRound(w: World) {
  const m = w.mode;
  m.round = (m.round ?? 1) + 1;
  m.timeLeft = 120;
  for (const p of m.points!) { p.owner = -1; p.progress = 0; }
  w.projectiles.clear(); // no ball in flight outlives the whistle
  for (const s of w.humansAndBots()) {
    w.spawn(s); // fresh hp/pos + brief protection…
    // …but spawn() deals the ARMY kit (sidearm + frags). Yard law is marker
    // only — re-impose it every round or round 2 turns into a grenade fight.
    // The bag carries paint: two paint grenades per round (the world.ts
    // paintball branch is the only thing G can throw here).
    const marker = s.weapons[0];
    s.weapons = [marker];
    s.clip = [WEAPONS[marker].clip];
    s.reserve = [WEAPONS[marker].reserve];
    s.weaponIdx = 0;
    s.grenades = 2;
    s.smokes = 0; s.firebombs = 0; s.concs = 0; s.gravs = 0; s.plasmas = 0; s.timebombs = 0;
    s.pbSplatBarked = false; // fresh round, fresh trash talk
  }
  w.emit({ type: 'whistle', pos: w.map.hillPos });
  w.emit({ type: 'announce', text: `ROUND ${m.round}`, big: true });
  holdThePack(w, m.huntedTeam ?? 1); // every round opens as a chase
  // one hunter calls their play at the whistle — the pack has a MOOD now
  const pack = [...w.humansAndBots()].filter((s) => s.kind === 'bot' && s.team !== (m.huntedTeam ?? 1));
  if (pack.length) pbBark(w, pack[(m.round ?? 0) % pack.length], 'start');
}

// ─────────────────────────────────────────────────────────────────────────────
// THE MOTOR TRIALS — hoverboard racing (Robert: "two modes, ghosts, 3 boards,
// racing AI"). Circuit = first past N laps vs the pack; Trial = beat your ghost.
// The track is the carved ring on w.map.raceTrack; racers are the soldiers on
// boards. All progress is snapshot-serializable on m.racers, so it replays.
// ─────────────────────────────────────────────────────────────────────────────

/** "1:07.4" — a lap time, minutes only when it needs them. */
export function fmtLap(t: number): string {
  if (!isFinite(t) || t <= 0) return '—';
  const total = Math.round(t * 10);              // whole tenths, no float floor
  const s = Math.floor(total / 10), tenths = total % 10;
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}.${tenths}` : `${s}.${tenths}s`;
}

/** The human in the field (the ghost/HUD headline is written from their car). */
function localRacer(w: World, racers: RacerState[]): RacerState | undefined {
  return racers.find((r) => w.soldiers.get(r.id)?.kind === 'human');
}

/** Everyone currently on a board is a racer. Built lazily once the grid fills. */
function collectRacers(w: World): RacerState[] {
  const racers: RacerState[] = [];
  for (const s of w.soldiers.values()) {
    if (s.vehicleId < 0) continue;
    const v = w.vehicles.get(s.vehicleId);
    if (v && isBoard(v.kind)) {
      racers.push({ id: s.id, next: 0, lap: 0, bestLap: 0, lapStart: w.time, finished: false, finishTime: 0, place: 0 });
    }
  }
  return racers;
}

/** Rank racers: finishers by finish order, the rest by track progress. */
function computePlaces(w: World, racers: RacerState[], track: RaceTrack): void {
  const N = track.checkpoints.length;
  const progress = (r: RacerState): number => {
    const s = w.soldiers.get(r.id);
    let d = 9999;
    if (s) { const cp = track.checkpoints[r.next]; const dx = s.pos.x - cp.pos.x, dz = s.pos.z - cp.pos.z; d = Math.sqrt(dx * dx + dz * dz); }
    return (r.lap * N + r.next) * 10000 - d; // further round the loop = higher
  };
  const order = [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return progress(b) - progress(a);
  });
  order.forEach((r, i) => { r.place = i + 1; });
}

function stepRace(w: World, dt: number): void {
  const m = w.mode;
  const track = w.map.raceTrack;
  if (!track) return;

  // ── the grid countdown: 3 · 2 · 1 · GO! ──
  if ((m.countdown ?? 0) > 0) {
    const before = Math.ceil(m.countdown!);
    m.countdown! -= dt;
    const after = Math.ceil(Math.max(0, m.countdown!));
    if (after !== before) w.emit({ type: 'announce', text: after > 0 ? String(after) : 'GO!', big: true });
    if (m.countdown! <= 0) {
      m.countdown = 0;
      m.racers = collectRacers(w);
      for (const r of m.racers) r.lapStart = w.time;
    }
    return;
  }
  if (!m.racers || !m.racers.length) { m.racers = collectRacers(w); for (const r of m.racers) r.lapStart = w.time; }
  const racers = m.racers;
  const laps = m.raceLaps ?? 3;
  const N = track.checkpoints.length;

  for (const r of racers) {
    if (r.finished) continue;
    const s = w.soldiers.get(r.id);
    if (!s) continue;
    const cp = track.checkpoints[r.next];
    const dx = s.pos.x - cp.pos.x, dz = s.pos.z - cp.pos.z;
    if (dx * dx + dz * dz > cp.radius * cp.radius) continue;
    r.next = (r.next + 1) % N;
    if (r.next !== 0) continue;               // still mid-lap
    // crossed the start/finish line → a lap is banked
    const lapTime = w.time - r.lapStart;
    r.lap++;
    r.lapStart = w.time;
    if (r.bestLap === 0 || lapTime < r.bestLap) r.bestLap = lapTime;
    if (m.raceBest === undefined || lapTime < m.raceBest) {
      m.raceBest = lapTime;
      w.emit({ type: 'announce', text: `FASTEST LAP ${fmtLap(lapTime)} — ${s.name}`, big: false });
    }
    if (r.lap >= laps) { r.finished = true; r.finishTime = w.time; }
    else if (r.lap === laps - 1 && s.kind === 'human') w.emit({ type: 'announce', text: 'FINAL LAP', big: true });
  }

  computePlaces(w, racers, track);

  if (m.raceKind === 'circuit') {
    const first = racers.find((r) => r.finished);
    if (first) {
      const champ = w.soldiers.get(first.id);
      w.emit({ type: 'announce', text: `${champ?.name ?? 'The winner'} TAKES THE CHECKERED FLAG`, big: true });
      endMatch(w, champ?.team ?? 0);
    }
  } else { // trial ends when the human completes their laps
    const me = localRacer(w, racers);
    if (me?.finished) {
      w.emit({ type: 'announce', text: `TRIAL COMPLETE — BEST LAP ${fmtLap(me.bestLap)}`, big: true });
      endMatch(w, w.soldiers.get(me.id)?.team ?? 0);
    }
  }
}

function endMatch(w: World, winner: Team | -1) {
  const m = w.mode;
  if (m.over) return;
  m.over = true;
  m.winner = winner;
  w.emit({
    type: 'match_over', team: winner === -1 ? undefined : winner,
    text: winner === -1 ? 'DRAW' : `${TEAM_NAMES[winner]} WINS`, big: true,
  });
  // B1 THE AUDIT (Robert: "if you won and were underfunded it increased your
  // morale"). The whistle compares the books: a winner whose whole bill —
  // spend plus wrecks — comes in at three-quarters of the loser's or less
  // fought poor and won anyway. That is worth announcing, and worth morale.
  if (winner !== -1) {
    const wCost = w.warCost(winner);
    const lCost = w.warCost((1 - winner) as Team);
    if (lCost >= 4 && wCost <= lCost * 0.75) {
      m.underdog = winner;
      w.emit({
        type: 'announce', team: winner, big: true,
        text: `UNDERFUNDED VICTORY — ${TEAM_NAMES[winner]} won on ${wCost} against ${lCost}. MORALE RISES.`,
      });
    }
  }
}

// ---------- TDM ----------

function stepTdm(w: World) {
  const m = w.mode;
  const kills: [number, number] = [0, 0];
  for (const s of w.humansAndBots()) kills[s.team] += s.kills;
  m.scores = kills;
  if (kills[0] >= m.target) endMatch(w, 0);
  else if (kills[1] >= m.target) endMatch(w, 1);
}

// ---------- CTF ----------

function stepCtf(w: World, _dt: number) {
  const m = w.mode;
  for (const flag of m.flags!) {
    const enemyTeam = (1 - flag.team) as Team;

    if (flag.carrierId >= 0) {
      const carrier = w.soldiers.get(flag.carrierId);
      if (!carrier || !carrier.alive) {
        // dropped
        flag.carrierId = -1;
        flag.droppedAt = w.time;
        if (carrier) { flag.pos = { x: carrier.pos.x, y: 0, z: carrier.pos.z }; carrier.carryingFlag = -1; }
        w.emit({ type: 'flag_dropped', pos: flag.pos, team: flag.team });
      } else {
        flag.pos = { ...carrier.pos };
        // capture: carrier reaches own base while own flag is home
        const ownFlag = m.flags![carrier.team];
        const base = w.map.basePos[carrier.team];
        if (ownFlag.atHome && Math.hypot(carrier.pos.x - base.x, carrier.pos.z - base.z) < 7) {
          m.scores[carrier.team]++;
          carrier.score += 50;
          carrier.captures = (carrier.captures ?? 0) + 1; // CTF: credit the runner
          carrier.carryingFlag = -1;
          flag.carrierId = -1;
          flag.atHome = true;
          flag.pos = { ...flag.homePos };
          w.emit({ type: 'flag_captured', pos: base, team: carrier.team, text: `${carrier.name} captured the flag!`, big: true });
          if (m.scores[carrier.team] >= m.target) endMatch(w, carrier.team);
        }
      }
      continue;
    }

    // flag on ground / at home
    for (const s of w.soldiers.values()) {
      if (!s.alive || (s.kind !== 'human' && s.kind !== 'bot') || s.vehicleId >= 0) continue;
      const d = Math.hypot(s.pos.x - flag.pos.x, s.pos.z - flag.pos.z);
      if (d > 2.2) continue;
      if (s.team === enemyTeam && s.carryingFlag < 0) {
        // enemy grabs it
        flag.carrierId = s.id;
        flag.atHome = false;
        s.carryingFlag = flag.team;
        s.cloaked = false;
        w.emit({ type: 'flag_taken', pos: flag.pos, team: flag.team, text: `${s.name} has the ${TEAM_NAMES[flag.team]} flag!` });
        break;
      }
      if (s.team === flag.team && !flag.atHome) {
        // defender returns it
        flag.atHome = true;
        flag.pos = { ...flag.homePos };
        s.score += 10;
        s.flagReturns = (s.flagReturns ?? 0) + 1; // CTF: credit the defender
        w.emit({ type: 'flag_returned', pos: flag.homePos, team: flag.team, text: `${TEAM_NAMES[flag.team]} flag returned` });
        break;
      }
    }

    // auto-return after 25s on the ground
    if (!flag.atHome && flag.carrierId < 0 && w.time - flag.droppedAt > 25) {
      flag.atHome = true;
      flag.pos = { ...flag.homePos };
      w.emit({ type: 'flag_returned', pos: flag.homePos, team: flag.team, text: `${TEAM_NAMES[flag.team]} flag returned` });
    }
  }
}

// ---------- KOTH ----------

function stepKoth(w: World, dt: number) {
  const m = w.mode;
  const counts: [number, number] = [0, 0];
  for (const s of w.soldiers.values()) {
    if (!s.alive || (s.kind !== 'human' && s.kind !== 'bot')) continue;
    if (Math.hypot(s.pos.x - m.hillPos!.x, s.pos.z - m.hillPos!.z) < m.hillRadius!) counts[s.team]++;
  }
  const holder: Team | -1 = counts[0] > 0 && counts[1] === 0 ? 0 : counts[1] > 0 && counts[0] === 0 ? 1 : -1;
  if (holder !== m.hillHolder) {
    m.hillHolder = holder;
    if (holder !== -1) w.emit({ type: 'announce', text: `${TEAM_NAMES[holder]} holds the hill`, team: holder });
  }
  if (holder !== -1) {
    m.scores[holder] += dt;
    if (m.scores[holder] >= m.target) endMatch(w, holder);
  }
}

// ---------- Conquest ----------

function stepConquest(w: World, dt: number) {
  const m = w.mode;
  const owned: [number, number] = [0, 0];
  for (const cp of m.points!) {
    const counts: [number, number] = [0, 0];
    for (const s of w.soldiers.values()) {
      if (!s.alive || (s.kind !== 'human' && s.kind !== 'bot')) continue;
      if (Math.hypot(s.pos.x - cp.pos.x, s.pos.z - cp.pos.z) < cp.radius) counts[s.team]++;
    }
    const dir = counts[0] - counts[1]; // +ve pulls toward team 0
    if (dir !== 0) {
      cp.progress = Math.max(-100, Math.min(100, cp.progress + dir * 22 * dt));
      if (cp.progress >= 100 && cp.owner !== 0) {
        cp.owner = 0;
        w.emit({ type: 'point_captured', pos: cp.pos, team: 0, text: `${TEAM_NAMES[0]} captured point ${cp.name}` });
      } else if (cp.progress <= -100 && cp.owner !== 1) {
        cp.owner = 1;
        w.emit({ type: 'point_captured', pos: cp.pos, team: 1, text: `${TEAM_NAMES[1]} captured point ${cp.name}` });
      }
    }
    if (cp.owner !== -1) owned[cp.owner]++;
  }
  // holding more points earns tickets
  if (owned[0] !== owned[1]) {
    const lead = owned[0] > owned[1] ? 0 : 1;
    m.scores[lead] += (owned[lead] - owned[1 - lead]) * 2.2 * dt;
    if (m.scores[lead] >= m.target) endMatch(w, lead as Team);
  }
}

// ---------- Survival ----------

function stepSurvival(w: World, _dt: number) {
  const m = w.mode;
  const humansAlive = w.humansAndBots().some((s) => s.alive || s.kind === 'human');
  const anyLiving = w.humansAndBots().some((s) => s.alive);
  if (!anyLiving) {
    endMatch(w, 1);
    w.emit({ type: 'announce', text: `Overrun on wave ${m.wave}`, big: true });
    return;
  }

  const zombies = [...w.soldiers.values()].filter((s) => s.alive && isZed(s.kind));
  m.zombiesLeft = zombies.length;

  // The horde must never FREEZE on a straggler: a kited spitter, a wedged
  // stalker, or a phase-stalker beyond its blink gate could keep the count
  // above 0 forever (nextWaveAt stayed Infinity, so the marquee mode stalled
  // where Horde/Safehouse's continuous targetPop doesn't). So: a full clear
  // arms the short breather; a handful of stragglers arm a longer GRACE, after
  // which the next wave rolls in ON TOP. All deterministic (time-based, no rng).
  const alive = zombies.length;
  const STRAGGLERS = 3, GRACE = 40;
  if (alive === 0) {
    // fully cleared — (re)set the short breather, overriding any straggler grace
    if (!Number.isFinite(m.nextWaveAt ?? Infinity) || (m.nextWaveAt ?? 0) > w.time + 6) {
      m.nextWaveAt = w.time + 6;
      if ((m.wave ?? 0) > 0) w.emit({ type: 'announce', text: `Wave ${m.wave} cleared — 6s to regroup` });
    }
  } else if (alive <= STRAGGLERS && !Number.isFinite(m.nextWaveAt ?? Infinity)) {
    m.nextWaveAt = w.time + GRACE; // stragglers won't hold the horde hostage
  }
  if (m.nextWaveAt !== undefined && Number.isFinite(m.nextWaveAt) && w.time >= m.nextWaveAt) {
    m.wave = (m.wave ?? 0) + 1;
    const wave = m.wave;
    const count = 6 + wave * 3;
    for (let i = 0; i < count; i++) {
      const sp = w.map.zombieSpawns[w.rng.int(0, w.map.zombieSpawns.length - 1)];
      const jitter = { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) };
      // THE ROSTER LAW (Robert: "the iron eater should NEVER be with the
      // zombies"): the flesh horde fights alone by default. 'iron' fields
      // only the machine race; 'both' is the OPT-IN that restores THE THIRD
      // ACT (DD SS20) — from wave 4 a quarter of every wave is scrap.
      const roster = w.opts.hordeRoster ?? 'zombies';
      const z = roster === 'iron'
        ? w.addIronEater(rollIronKind(w, wave), jitter)
        : roster === 'both' && wave >= 4 && i % 4 === 3
          ? w.addIronEater(rollIronKind(w, wave), jitter)
          : w.addZombie(rollZedKind(w), jitter);
      // waves scale hp
      z.hp *= 1 + wave * 0.12;
      z.maxHp = z.hp;
    }
    m.scores[0] = wave;
    m.nextWaveAt = Infinity; // re-armed when the wave is cleared (or stragglers time out)
    w.emit({ type: 'wave_start', text: `WAVE ${wave}`, big: true });
  }
  void humansAlive;
}

// ---------- Protect the Scientist ----------

const ALERT_MEMORY = 12;   // seconds the horde remembers a sighting
const SIGHT_RANGE = 9;     // how close a zombie must get to spot him

function stepSafehouse(w: World, _dt: number) {
  const m = w.mode;
  const sci = m.scientistId !== undefined ? w.soldiers.get(m.scientistId) : undefined;

  // loss conditions
  if (!sci || !sci.alive) {
    endMatch(w, 1);
    w.emit({ type: 'announce', text: 'DR. VOSS IS DEAD — MISSION FAILED', big: true });
    return;
  }
  if (!w.humansAndBots().some((s) => s.alive)) {
    endMatch(w, 1);
    w.emit({ type: 'announce', text: 'SQUAD WIPED — THE HORDE TAKES THE SCIENTIST', big: true });
    return;
  }

  const zombies = [...w.soldiers.values()].filter((s) => s.alive && isZed(s.kind));
  m.zombiesLeft = zombies.length;
  m.scores[0] = w.humansAndBots().reduce((a, s) => a + s.kills, 0);

  // the hunt: any zombie that gets eyes on the scientist refreshes the alert
  for (const z of zombies) {
    const d = Math.hypot(z.pos.x - sci.pos.x, z.pos.z - sci.pos.z);
    if (d < SIGHT_RANGE && losClear(w.map.grid, { ...z.pos, y: 1.2 }, { ...sci.pos, y: 1.2 })) {
      m.alertUntil = w.time + ALERT_MEMORY;
      break;
    }
  }
  const alertNow = (m.alertUntil ?? 0) > w.time;
  if (alertNow && !m.alert) {
    w.emit({ type: 'wave_start', text: 'THE HORDE FOUND HIM — DEFEND!', big: true });
  } else if (!alertNow && m.alert) {
    w.emit({ type: 'announce', text: 'The horde lost the trail — relocate Dr. Voss (E to escort)' });
  }
  m.alert = alertNow;

  // pressure ramps toward evac: quiet start, overrun finish
  const elapsed = 5 * 60 - m.timeLeft;
  const intensity = 1 + Math.floor(elapsed / 45);
  if (intensity !== m.wave) {
    m.wave = intensity;
    if (intensity > 1) w.emit({ type: 'announce', text: `The horde grows (intensity ${intensity})` });
  }
  const diffMul = w.opts.difficulty === 'recruit' ? 0.7 : w.opts.difficulty === 'elite' ? 1.3 : 1;
  const targetPop = Math.min(5 + intensity * 3, 42) * diffMul * (alertNow ? 1.25 : 1);

  if (zombies.length < targetPop && w.time >= (m.nextWaveAt ?? 0)) {
    m.nextWaveAt = w.time + Math.max(0.5, 2.2 - elapsed / 130);
    const burst = w.rng.int(1, Math.min(3, intensity));
    for (let i = 0; i < burst; i++) {
      const sp = w.map.zombieSpawns[w.rng.int(0, w.map.zombieSpawns.length - 1)];
      const z = w.addZombie(rollZedKind(w), { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) });
      z.hp *= 1 + (intensity - 1) * 0.07;
      z.maxHp = z.hp;
    }
  }
}

/** Special-zombie table. `tier` = wave number (Survival) or intensity level (Horde). */
/** the deeper the waves, the heavier the scrap */
function rollIronKind(w: World, wave: number): IronKind {
  const r = w.rng.next();
  if (wave >= 8 && r < 0.15) return 'ravager';
  if (wave >= 6 && r < 0.35) return 'weaver';
  return r < 0.6 ? 'scraprat' : 'junkhound';
}

// OUTBREAK-SPEC §21.17 / §22.1 — the flesh horde's PRODUCTION ROSTER is base
// SHAMBLERS plus a RARE sprinter (spec: 0.5–2%). No brute/bomber/stalker/spitter
// in the spawned horde (Robert: "remove special zombies… 1% sprinters"). They
// still EXIST — a heavy who dies rises a brute via riseKind, and the third-act
// iron race fields its own roster — but the horde you fight is shamblers, with
// the odd sprinter you hear before you see. Draws exactly one rng.next() (the
// stream position is unchanged; only the composition moves).
function rollZedKind(w: World): ZedKind {
  return w.rng.next() < 0.01 ? 'sprinter' : 'zombie';
}

// ---------- Endless Horde ----------

function stepHorde(w: World, _dt: number) {
  const m = w.mode;
  const anyLiving = w.humansAndBots().some((s) => s.alive);
  if (!anyLiving) {
    endMatch(w, 1);
    const mins = Math.floor(w.time / 60);
    const secs = Math.floor(w.time % 60);
    w.emit({ type: 'announce', text: `Overrun — survived ${mins}:${String(secs).padStart(2, '0')}`, big: true });
    return;
  }

  const zombies = [...w.soldiers.values()].filter((s) => s.alive && isZed(s.kind));
  m.zombiesLeft = zombies.length;
  m.scores[0] = w.humansAndBots().reduce((a, s) => a + s.kills, 0); // squad kill count
  const intensity = 1 + Math.floor(w.time / 30); // ramps every 30s
  if (intensity !== m.wave) {
    m.wave = intensity;
    if (intensity > 1) w.emit({ type: 'wave_start', text: `INTENSITY ${intensity}`, big: true });
  }

  // population target grows with time; difficulty scales it. MORE SHAMBLERS
  // (Robert): the O(S²) scan tail is gone (opt #11/#38), so the horde runs
  // DENSER now — base 12→cap 80 (was 8→48), and it fills faster. The mass is
  // the menace: a wall of shamblers, not a zoo of specials.
  const diffMul = w.opts.difficulty === 'recruit' ? 0.7 : w.opts.difficulty === 'elite' ? 1.35 : 1;
  const targetPop = Math.min(12 + intensity * 4, 80) * diffMul;

  if (zombies.length < targetPop && w.time >= (m.nextWaveAt ?? 0)) {
    // spawn cadence accelerates from 1.4s down to 0.35s
    m.nextWaveAt = w.time + Math.max(0.35, 1.4 - w.time / 150);
    const burst = w.rng.int(1, Math.min(5, intensity));
    for (let i = 0; i < burst; i++) {
      const sp = w.map.zombieSpawns[w.rng.int(0, w.map.zombieSpawns.length - 1)];
      const jitter = { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) };
      // THE ROSTER LAW: zombies-only by default; 'iron' is all machine;
      // 'both' opts back into THE THIRD ACT (DD SS20) — from intensity 4
      // a quarter of the pressure is scrap that stood up.
      const roster = w.opts.hordeRoster ?? 'zombies';
      const z = roster === 'iron'
        ? w.addIronEater(rollIronKind(w, intensity), jitter)
        : roster === 'both' && intensity >= 4 && w.rng.next() < 0.25
          ? w.addIronEater(rollIronKind(w, intensity), jitter)
          : w.addZombie(rollZedKind(w), jitter);
      z.hp *= 1 + (intensity - 1) * 0.08;
      z.maxHp = z.hp;
    }
  }
}
