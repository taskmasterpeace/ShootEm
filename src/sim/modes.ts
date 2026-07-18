import { TEAM_NAMES, WEAPONS } from './data';
import { losClear, type GameMap } from './map';
import { isZed, type ModeId, type ModeState, type Team, type ZedKind, type IronKind } from './types';
import type { World } from './world';

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
  }
  return m;
}

export function stepMode(w: World, dt: number) {
  const m = w.mode;
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
    case 'paintball': stepPaintball(w, dt); break;
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

  // paint is final (per round): the splatted watch from the dead-box
  for (const s of w.humansAndBots()) {
    if (!s.alive) s.respawnAt = Infinity;
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
    const marker = s.weapons[0];
    s.weapons = [marker];
    s.clip = [WEAPONS[marker].clip];
    s.reserve = [WEAPONS[marker].reserve];
    s.weaponIdx = 0;
    s.grenades = 0;
  }
  w.emit({ type: 'whistle', pos: w.map.hillPos });
  w.emit({ type: 'announce', text: `ROUND ${m.round}`, big: true });
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

  if (zombies.length === 0) {
    if (m.nextWaveAt === undefined || !Number.isFinite(m.nextWaveAt)) {
      // wave just cleared — breather before the next one
      m.nextWaveAt = w.time + 6;
      if ((m.wave ?? 0) > 0) w.emit({ type: 'announce', text: `Wave ${m.wave} cleared — 6s to regroup` });
    } else if (w.time >= m.nextWaveAt) {
      m.wave = (m.wave ?? 0) + 1;
      const wave = m.wave;
      const count = 6 + wave * 3;
      for (let i = 0; i < count; i++) {
        const sp = w.map.zombieSpawns[w.rng.int(0, w.map.zombieSpawns.length - 1)];
        const jitter = { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) };
        // THE THIRD ACT (DD SS20, finish-list 12): from wave 4 the Iron
        // Eaters join the horde -- a quarter of every wave is scrap that
        // stood up, and the mix deepens as the waves do.
        const z = wave >= 4 && i % 4 === 3
          ? w.addIronEater(rollIronKind(w, wave), jitter)
          : w.addZombie(rollZedKind(w, wave), jitter);
        // waves scale hp
        z.hp *= 1 + wave * 0.12;
        z.maxHp = z.hp;
      }
      m.scores[0] = wave;
      m.nextWaveAt = Infinity; // re-armed when the wave is cleared
      w.emit({ type: 'wave_start', text: `WAVE ${wave}`, big: true });
    }
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
      const z = w.addZombie(rollZedKind(w, intensity), { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) });
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

function rollZedKind(w: World, tier: number): ZedKind {
  const roll = w.rng.next();
  if (roll < 0.1) return tier >= 3 ? 'brute' : 'zombie';
  if (roll < 0.19) return tier >= 2 ? 'bomber' : 'zombie';
  if (roll < 0.25) return tier >= 2 ? 'sprinter' : 'zombie'; // rare — the one you hear before you see
  if (roll < 0.29) return tier >= 3 ? 'stalker' : 'zombie';  // rare — blinks through walls
  if (roll < 0.45) return tier >= 2 ? 'spitter' : 'zombie';
  return 'zombie';
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

  // population target grows with time; difficulty scales it
  const diffMul = w.opts.difficulty === 'recruit' ? 0.7 : w.opts.difficulty === 'elite' ? 1.35 : 1;
  const targetPop = Math.min(8 + intensity * 3, 48) * diffMul;

  if (zombies.length < targetPop && w.time >= (m.nextWaveAt ?? 0)) {
    // spawn cadence accelerates from 1.6s down to 0.4s
    m.nextWaveAt = w.time + Math.max(0.4, 1.6 - w.time / 150);
    const burst = w.rng.int(1, Math.min(3, intensity));
    for (let i = 0; i < burst; i++) {
      const sp = w.map.zombieSpawns[w.rng.int(0, w.map.zombieSpawns.length - 1)];
      const jitter = { x: sp.x + w.rng.range(-2, 2), y: 0, z: sp.z + w.rng.range(-2, 2) };
      // THE THIRD ACT (DD SS20): from intensity 4 the Iron Eaters join --
      // a quarter of the pressure is scrap that stood up
      const z = intensity >= 4 && w.rng.next() < 0.25
        ? w.addIronEater(rollIronKind(w, intensity), jitter)
        : w.addZombie(rollZedKind(w, intensity), jitter);
      z.hp *= 1 + (intensity - 1) * 0.08;
      z.maxHp = z.hp;
    }
  }
}
