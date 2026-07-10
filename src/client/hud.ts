import { CLASSES, MODE_INFO, TEAM_NAMES, VEHICLES, WEAPONS } from '../sim/data';
import { GRID, T_WALL, WORLD } from '../sim/map';
import type { SimEvent, Soldier, Team } from '../sim/types';
import type { World } from '../sim/world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export class Hud {
  private killfeedEl = $('killfeed');
  private announceEl = $('announce');
  private announceUntil = 0;
  private minimapCtx = ($('minimap') as HTMLCanvasElement).getContext('2d')!;
  private mapBg: HTMLCanvasElement | null = null;

  show() { $('hud').classList.remove('hidden'); }
  hide() { $('hud').classList.add('hidden'); $('scoreboard').classList.add('hidden'); }

  update(world: World, localId: number, scoreboardHeld: boolean, now: number) {
    const s = world.soldiers.get(localId);
    if (!s) return;

    // vitals
    $('hp-num').textContent = String(Math.ceil(s.hp));
    $('en-num').textContent = String(Math.floor(s.energy));
    const hpFill = $('hp-fill');
    hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    hpFill.classList.toggle('low', s.hp < s.maxHp * 0.35);
    $('en-fill').style.width = `${s.energy}%`;

    // weapon / vehicle line
    const inVehicle = s.vehicleId >= 0;
    if (inVehicle) {
      const v = world.vehicles.get(s.vehicleId);
      if (v) {
        $('weapon-name').textContent = VEHICLES[v.kind].name;
        const ammoEl = $('ammo-count');
        ammoEl.classList.remove('reloading');
        ammoEl.textContent = `${Math.ceil(v.hp)} ARMOR`;
        $('ability-hint').textContent = s.seat === 0 ? 'E exit · W/S drive · A/D steer' : 'E exit (passenger)';
      }
    } else {
      const def = WEAPONS[s.weapons[s.weaponIdx]];
      $('weapon-name').textContent = def.name;
      const ammoEl = $('ammo-count');
      if (s.reloadUntil > 0) {
        ammoEl.textContent = 'RELOADING';
        ammoEl.classList.add('reloading');
      } else {
        ammoEl.classList.remove('reloading');
        const clip = Number.isFinite(s.clip[s.weaponIdx]) ? s.clip[s.weaponIdx] : '∞';
        const res = Number.isFinite(s.reserve[s.weaponIdx]) ? s.reserve[s.weaponIdx] : '∞';
        ammoEl.textContent = `${clip} / ${res}`;
      }
      $('ability-hint').textContent = `${CLASSES[s.classId].abilityName} · ${s.grenades} ${s.classId === 'engineer' ? 'mines' : 'frags'}`;
    }

    // respawn overlay
    const ro = $('respawn-overlay');
    if (!s.alive) {
      ro.classList.remove('hidden');
      const t = Math.max(0, s.respawnAt - world.time);
      $('respawn-timer').textContent = world.mode.over ? '' : `Respawning in ${t.toFixed(1)}s`;
    } else ro.classList.add('hidden');

    // vehicle hint
    const hint = $('vehicle-hint');
    let nearVehicle = false;
    if (s.alive && !inVehicle) {
      for (const v of world.vehicles.values()) {
        if (!v.alive || v.team !== s.team || !v.seats.includes(-1)) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < VEHICLES[v.kind].radius + 2.2) {
          hint.textContent = `[E] Enter ${VEHICLES[v.kind].name}`;
          nearVehicle = true;
          break;
        }
      }
    }
    hint.classList.toggle('hidden', !nearVehicle);

    this.updateObjectives(world, s);
    this.updateMinimap(world, s);

    const sb = $('scoreboard');
    if (scoreboardHeld || world.mode.over) {
      this.renderScoreboard(world, localId);
      sb.classList.remove('hidden');
    } else sb.classList.add('hidden');

    if (now > this.announceUntil) this.announceEl.classList.remove('show');
  }

  private updateObjectives(world: World, local: Soldier) {
    const m = world.mode;
    const bar = $('objective-bar');
    const fmt = (n: number) => String(Math.floor(n));
    let chips = '';
    const tc = (t: Team) => `t${t}`;
    switch (m.id) {
      case 'tdm':
        chips = `<div class="obj-chip t0">${TEAM_NAMES[0]} ${fmt(m.scores[0])}</div>
                 <div class="obj-chip neutral">→ ${m.target}</div>
                 <div class="obj-chip t1">${TEAM_NAMES[1]} ${fmt(m.scores[1])}</div>`;
        break;
      case 'ctf': {
        const f = m.flags!;
        const st = (i: number) => f[i].carrierId >= 0 ? '✊' : f[i].atHome ? '⚑' : '⚠';
        chips = `<div class="obj-chip t0">${st(0)} ${fmt(m.scores[0])}/${m.target}</div>
                 <div class="obj-chip t1">${st(1)} ${fmt(m.scores[1])}/${m.target}</div>`;
        break;
      }
      case 'koth': {
        const holder = m.hillHolder;
        chips = `<div class="obj-chip t0">${fmt(m.scores[0])}s</div>
                 <div class="obj-chip ${holder === -1 ? 'neutral' : tc(holder as Team)}">HILL${holder === -1 ? '' : ': ' + TEAM_NAMES[holder as Team]}</div>
                 <div class="obj-chip t1">${fmt(m.scores[1])}s</div>`;
        break;
      }
      case 'conquest': {
        const pts = m.points!.map((p) =>
          `<div class="obj-chip ${p.owner === -1 ? 'neutral' : tc(p.owner as Team)}">${p.name}</div>`).join('');
        chips = `<div class="obj-chip t0">${fmt(m.scores[0])}</div>${pts}<div class="obj-chip t1">${fmt(m.scores[1])}</div>`;
        break;
      }
      case 'survival':
        chips = `<div class="obj-chip t0">WAVE ${m.wave ?? 0}</div>
                 <div class="obj-chip neutral">${m.zombiesLeft ?? 0} left</div>
                 <div class="obj-chip t1">☠ ${local.kills}</div>`;
        break;
      case 'horde': {
        const t = world.time;
        const clock = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        chips = `<div class="obj-chip t0">🕐 ${clock}</div>
                 <div class="obj-chip neutral">INTENSITY ${m.wave ?? 1}</div>
                 <div class="obj-chip t1">☠ ${fmt(m.scores[0])} · ${m.zombiesLeft ?? 0} up</div>`;
        break;
      }
    }
    bar.innerHTML = chips;
    $('mode-status').textContent = MODE_INFO[m.id].name;
    const t = m.timeLeft;
    $('match-timer').textContent = Number.isFinite(t)
      ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
      : '';
  }

  private updateMinimap(world: World, local: Soldier) {
    const ctx = this.minimapCtx;
    const S = 220;
    if (!this.mapBg) {
      this.mapBg = document.createElement('canvas');
      this.mapBg.width = this.mapBg.height = S;
      const b = this.mapBg.getContext('2d')!;
      b.fillStyle = 'rgba(20, 22, 18, 0.9)';
      b.fillRect(0, 0, S, S);
      b.fillStyle = 'rgba(150, 145, 120, 0.55)';
      const px = S / GRID;
      for (let z = 0; z < GRID; z++)
        for (let x = 0; x < GRID; x++)
          if (world.map.grid[z * GRID + x] === T_WALL) b.fillRect(x * px, z * px, px, px);
    }
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.mapBg, 0, 0);
    const toMap = (wx: number, wz: number) => [((wx + WORLD / 2) / WORLD) * S, ((wz + WORLD / 2) / WORLD) * S] as const;
    const dot = (wx: number, wz: number, color: string, r = 2.5) => {
      const [x, y] = toMap(wx, wz);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // objectives
    const m = world.mode;
    if (m.hillPos) dot(m.hillPos.x, m.hillPos.z, m.hillHolder === -1 ? '#ffffff' : m.hillHolder === 0 ? '#e8a33d' : '#3dbde8', 5);
    if (m.points) for (const p of m.points) dot(p.pos.x, p.pos.z, p.owner === -1 ? '#ffffff' : p.owner === 0 ? '#e8a33d' : '#3dbde8', 4.5);
    if (m.flags) for (const f of m.flags) dot(f.pos.x, f.pos.z, f.team === 0 ? '#e8a33d' : '#3dbde8', 4);
    // entities
    for (const s of world.soldiers.values()) {
      if (!s.alive || s.id === local.id) continue;
      const zed = s.kind !== 'human' && s.kind !== 'bot';
      if (zed) {
        const c = s.kind === 'sprinter' ? '#e06a50' : s.kind === 'bomber' ? '#b7e34a' : '#8fce5a';
        dot(s.pos.x, s.pos.z, c, s.kind === 'brute' ? 3 : 2);
        continue;
      }
      if (s.cloaked && s.team !== local.team) continue;
      dot(s.pos.x, s.pos.z, s.team === 0 ? '#e8a33d' : '#3dbde8');
    }
    for (const v of world.vehicles.values()) {
      if (v.alive) dot(v.pos.x, v.pos.z, v.team === 0 ? '#c8882d' : '#2d9dc8', 3.5);
    }
    // local player: white with facing tick
    const [lx, ly] = toMap(local.pos.x, local.pos.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + Math.cos(local.yaw) * 8, ly + Math.sin(local.yaw) * 8);
    ctx.stroke();
  }

  private renderScoreboard(world: World, localId: number) {
    const sb = $('scoreboard');
    const m = world.mode;
    const soldiers = world.humansAndBots().sort((a, b) => b.score - a.score || b.kills - a.kills);
    const row = (s: Soldier) =>
      `<tr class="${s.id === localId ? 'me' : ''}"><td>${s.name}</td><td>${CLASSES[s.classId].name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${Math.floor(s.score)}</td></tr>`;
    let html = `<h2>${MODE_INFO[m.id].name}${m.over ? ` — ${m.winner === -1 ? 'Draw' : TEAM_NAMES[m.winner as Team] + ' wins'}` : ''}</h2><table>
      <tr><th>Callsign</th><th>Class</th><th>K</th><th>D</th><th>Score</th></tr>`;
    if (m.id === 'survival' || m.id === 'horde') {
      html += soldiers.map(row).join('');
    } else {
      for (const team of [0, 1] as Team[]) {
        html += `<tr class="team-head t${team}"><td colspan="5">${TEAM_NAMES[team]} — ${Math.floor(m.scores[team])}</td></tr>`;
        html += soldiers.filter((s) => s.team === team).map(row).join('');
      }
    }
    html += '</table>';
    if (m.over) html += `<p style="margin-top:1rem;color:var(--muted)">Returning to menu…</p>`;
    sb.innerHTML = html;
  }

  applyEvents(events: SimEvent[], world: World, localId: number, now: number) {
    for (const e of events) {
      if (e.type === 'death' && e.victimName) {
        const killerTeamCls = e.killerTeam !== undefined ? `t${e.killerTeam}` : 'zed';
        const entry = document.createElement('div');
        entry.className = 'kf-entry';
        entry.innerHTML = e.killerName
          ? `<span class="${killerTeamCls}">${e.killerName}</span><span class="wpn">${e.weaponName ?? ''}</span><span>${e.victimName}</span>`
          : `<span>${e.victimName} died</span>`;
        this.killfeedEl.prepend(entry);
        while (this.killfeedEl.children.length > 6) this.killfeedEl.lastChild?.remove();
        setTimeout(() => entry.remove(), 6000);
      }
      if (e.type === 'hit' && e.soldierId === localId) this.flashHitmarker();
      if ((e.type === 'announce' || e.type === 'flag_taken' || e.type === 'flag_captured' ||
           e.type === 'flag_returned' || e.type === 'point_captured' || e.type === 'wave_start' ||
           e.type === 'match_over') && e.text) {
        this.announce(e.text, !!e.big, now);
      }
    }
  }

  flashHitmarker() {
    const el = $('hitmarker');
    el.textContent = '✕';
    el.classList.remove('show');
    void el.offsetWidth; // restart animation
    el.classList.add('show');
  }

  announce(text: string, big: boolean, now: number) {
    this.announceEl.textContent = text;
    this.announceEl.classList.toggle('big', big);
    this.announceEl.classList.add('show');
    this.announceUntil = now + (big ? 4 : 2.5);
  }
}
