import { TEAM_NAMES } from './data';
import type { GameMap } from './map';
import { isZed, type FlagState, type ModeId, type ModeState, type Team, type ZedKind } from './types';
import type { World } from './world';

const MATCH_TIME = 15 * 60;

export function initMode(id: ModeId, map: GameMap, minutes?: number): ModeState {
  const m: ModeState = {
    id, timeLeft: (minutes ?? 15) * 60 || MATCH_TIME, scores: [0, 0], target: 0, over: false, winner: -1,
  };
  switch (id) {
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
  }
  return m;
}

export function stepMode(w: World, dt: number) {
  const m = w.mode;
  if (Number.isFinite(m.timeLeft)) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      endMatch(w, m.scores[0] === m.scores[1] ? -1 : m.scores[0] > m.scores[1] ? 0 : 1);
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

function stepCtf(w: World, dt: number) {
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

function stepSurvival(w: World, dt: number) {
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
        const z = w.addZombie(rollZedKind(w, wave), jitter);
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

/** Special-zombie table. `tier` = wave number (Survival) or intensity level (Horde). */
function rollZedKind(w: World, tier: number): ZedKind {
  const roll = w.rng.next();
  if (roll < 0.1) return tier >= 3 ? 'brute' : 'zombie';
  if (roll < 0.19) return tier >= 2 ? 'bomber' : 'zombie';
  if (roll < 0.25) return tier >= 2 ? 'sprinter' : 'zombie'; // rare — the one you hear before you see
  if (roll < 0.45) return tier >= 2 ? 'spitter' : 'zombie';
  return 'zombie';
}

// ---------- Endless Horde ----------

function stepHorde(w: World, dt: number) {
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
      const z = w.addZombie(rollZedKind(w, intensity), jitter);
      z.hp *= 1 + (intensity - 1) * 0.08;
      z.maxHp = z.hp;
    }
  }
}
