import { CLASSES, EQUIPMENT, MODE_INFO, TEAM_NAMES, VEHICLES, WEAPONS } from '../sim/data';
import { GRID, T_WALL, WORLD, losClear, houseAt } from '../sim/map';
import type { SimEvent, Soldier, Team } from '../sim/types';
import type { World } from '../sim/world';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** A tactical-system waypoint drawn on the whole team's minimap. */
interface Waypoint { x: number; z: number; until: number; by: string }

export class Hud {
  private killfeedEl = $('killfeed');
  private announceEl = $('announce');
  private announceUntil = 0;
  private minimapEl = $('minimap') as HTMLCanvasElement;
  private minimapCtx = this.minimapEl.getContext('2d')!;
  private mapBg: HTMLCanvasElement | null = null;
  private waypoints: Waypoint[] = [];
  private lastTime = 0;
  /** set true when the local player carries the Tactical System */
  waypointsEnabled = false;
  /** multiplayer relays placed waypoints to teammates */
  onWaypoint: (x: number, z: number) => void = () => {};

  // ---- visual feedback layers (created dynamically) ----
  private vignette = document.createElement('div');
  private sysPips = document.createElement('div');
  private equipRow = document.createElement('div');
  private reloadBar = document.createElement('div');
  private lastHp = -1;
  private wasAlive = false;
  private psiFlashUntil = 0;
  private equipSig = '';

  constructor() {
    // M toggles the minimap between compact and the large tactical view
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || e.repeat) return;
      if (e.key.toLowerCase() === 'm') this.minimapEl.classList.toggle('large');
    });

    // tactical system: click the minimap to drop a team waypoint
    this.minimapEl.addEventListener('click', (e) => {
      if (!this.waypointsEnabled) return;
      const rect = this.minimapEl.getBoundingClientRect();
      const S = this.minimapEl.width;
      const mx = ((e.clientX - rect.left) / rect.width) * S;
      const mz = ((e.clientY - rect.top) / rect.height) * S;
      const wx = (mx / S) * WORLD - WORLD / 2;
      const wz = (mz / S) * WORLD - WORLD / 2;
      this.addWaypoint(wx, wz, 'you');
      this.onWaypoint(wx, wz);
    });

    // damage/heal vignette overlay
    this.vignette.id = 'dmg-vignette';
    $('hud').appendChild(this.vignette);
    // vehicle subsystem pips + reload progress live in the weapon block
    this.sysPips.id = 'sys-pips';
    this.reloadBar.id = 'reload-bar';
    this.reloadBar.innerHTML = '<div id="reload-fill"></div>';
    const wb = $('weapon-block');
    wb.appendChild(this.reloadBar);
    wb.appendChild(this.sysPips);
    // equipment status icons next to the vitals
    this.equipRow.id = 'equip-status';
    $('hud-bottom-left').appendChild(this.equipRow);
  }

  /** Live waypoints for the renderer's light pillars. */
  getWaypoints(): Waypoint[] { return this.waypoints; }

  addWaypoint(x: number, z: number, by: string) {
    this.waypoints.push({ x, z, until: this.lastTime + 25, by });
    if (this.waypoints.length > 8) this.waypoints.shift();
  }

  private hasEquip(s: Soldier, key: 'headcam' | 'seeCloaked' | 'seeMines' | 'waypoints'): boolean {
    return s.equipment?.some((id) => EQUIPMENT[id]?.[key]) ?? false;
  }

  show() { $('hud').classList.remove('hidden'); }
  hide() { $('hud').classList.add('hidden'); $('scoreboard').classList.add('hidden'); }

  update(world: World, localId: number, scoreboardHeld: boolean, now: number) {
    const s = world.soldiers.get(localId);
    if (!s) return;

    // vitals
    const hpNum = $('hp-num');
    hpNum.textContent = String(Math.ceil(s.hp));
    hpNum.classList.toggle('low', s.hp < s.maxHp * 0.35);
    $('en-num').textContent = String(Math.floor(s.energy));
    const hpFill = $('hp-fill');
    hpFill.style.width = `${(s.hp / s.maxHp) * 100}%`;
    hpFill.classList.toggle('low', s.hp < s.maxHp * 0.35);
    $('en-fill').style.width = `${s.energy}%`;
    // issued plate: its own bar, shown only when this life carries any
    const hasPlate = (s.maxArmor ?? 0) > 0;
    $('ar-label').classList.toggle('hidden', !hasPlate);
    $('ar-bar').classList.toggle('hidden', !hasPlate);
    if (hasPlate) {
      $('ar-num').textContent = String(Math.ceil(s.armor));
      $('ar-fill').style.width = `${(s.armor / s.maxArmor) * 100}%`;
    }

    // damage / heal vignette: the screen itself tells you what just happened
    if (s.alive && this.wasAlive && this.lastHp >= 0) {
      if (s.hp < this.lastHp - 0.5) this.flashVignette('hurt', Math.min(0.6, (this.lastHp - s.hp) / 40 + 0.2));
      else if (s.hp > this.lastHp + 3) this.flashVignette('heal', 0.3);
    }
    this.lastHp = s.hp;
    this.wasAlive = s.alive;

    this.updateEquipStatus(s, world.time);

    // weapon / vehicle line
    const inVehicle = s.vehicleId >= 0;
    if (inVehicle) {
      const v = world.vehicles.get(s.vehicleId);
      if (v) {
        $('weapon-name').textContent = VEHICLES[v.kind].name;
        const ammoEl = $('ammo-count');
        ammoEl.classList.remove('reloading', 'low-ammo', 'no-ammo');
        ammoEl.textContent = `${Math.ceil(v.hp)} ARMOR`;
        this.reloadBar.style.display = 'none';
        // crew position
        const crew = VEHICLES[v.kind].crew;
        let role = s.seat === 0 ? 'DRIVER · W/S drive · A/D steer' : 'PASSENGER';
        if (crew && s.seat >= 1 && s.seat <= crew.length) role = crew[s.seat - 1].toUpperCase() + ' STATION';
        $('ability-hint').textContent = `${role} · E exit`;
        // per-system damage record as pips: ENG WPN SEN ECM COM
        const max = VEHICLES[v.kind].systemHp ?? 60;
        this.sysPips.style.display = 'flex';
        this.sysPips.innerHTML = (['engine', 'weapon', 'sensors', 'ecm', 'comms'] as const).map((id) => {
          const hp = v.systems?.[id] ?? max;
          const state = hp <= 0 ? 'dead' : hp < max * 0.4 ? 'hurt' : 'ok';
          return `<span class="pip ${state}">${id.slice(0, 3).toUpperCase()}</span>`;
        }).join('');
      }
    } else {
      this.sysPips.style.display = 'none';
      const def = WEAPONS[s.weapons[s.weaponIdx]];
      $('weapon-name').textContent = `${def.icon ? def.icon + ' ' : ''}${def.name}`;
      const ammoEl = $('ammo-count');
      if (s.reloadUntil > 0) {
        ammoEl.textContent = 'RELOADING';
        ammoEl.classList.add('reloading');
        ammoEl.classList.remove('low-ammo', 'no-ammo');
        // reload progress bar fills toward ready
        this.reloadBar.style.display = 'block';
        const k = Math.min(1, Math.max(0, 1 - (s.reloadUntil - world.time) / def.reloadTime));
        ($('reload-fill')).style.width = `${k * 100}%`;
      } else {
        ammoEl.classList.remove('reloading');
        this.reloadBar.style.display = 'none';
        const clipN = s.clip[s.weaponIdx];
        const clip = Number.isFinite(clipN) ? clipN : '∞';
        const res = Number.isFinite(s.reserve[s.weaponIdx]) ? s.reserve[s.weaponIdx] : '∞';
        ammoEl.textContent = `${clip} / ${res}`;
        // the counter itself warns you before the click of an empty mag
        ammoEl.classList.toggle('no-ammo', Number.isFinite(clipN) && clipN === 0);
        ammoEl.classList.toggle('low-ammo', Number.isFinite(clipN) && clipN > 0 && clipN <= def.clip * 0.25);
      }
      // secondary fire (right mouse) rides the weapon in hand — show its tank
      const alt = def.alt;
      const altTxt = !alt ? ''
        : alt.kind === 'overcharge' ? ' · RMB overcharge'
        : ` · RMB ${alt.kind} ×${s.altAmmo}`;
      $('ability-hint').textContent = `${CLASSES[s.classId].abilityName} · ${s.grenades} ${s.classId === 'engineer' ? 'mines' : 'frags'}${altTxt}`;
    }

    // respawn overlay
    const ro = $('respawn-overlay');
    if (!s.alive) {
      ro.classList.remove('hidden');
      const t = Math.max(0, s.respawnAt - world.time);
      $('respawn-timer').textContent = world.mode.over ? '' : `Respawning in ${t.toFixed(1)}s`;
    } else ro.classList.add('hidden');

    // context hint: vehicles, or the scientist escort in safehouse
    const hint = $('vehicle-hint');
    let showHint = false;
    if (s.alive && !inVehicle) {
      for (const v of world.vehicles.values()) {
        if (!v.alive || v.team !== s.team || !v.seats.includes(-1)) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < VEHICLES[v.kind].radius + 2.2) {
          hint.textContent = `[E] Enter ${VEHICLES[v.kind].name}`;
          showHint = true;
          break;
        }
      }
      if (!showHint && world.mode.id === 'safehouse' && world.mode.scientistId !== undefined) {
        const sci = world.soldiers.get(world.mode.scientistId);
        if (sci?.alive && Math.hypot(sci.pos.x - s.pos.x, sci.pos.z - s.pos.z) < 3.2) {
          hint.textContent = sci.botTargetId === s.id ? '[E] Tell Dr. Voss to hide here' : '[E] Escort Dr. Voss';
          showHint = true;
        }
      }
    }
    hint.classList.toggle('hidden', !showHint);

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
      case 'safehouse': {
        const sci = m.scientistId !== undefined ? world.soldiers.get(m.scientistId) : undefined;
        const status = m.alert
          ? '<div class="obj-chip t1">⚠ FOUND — DEFEND</div>'
          : '<div class="obj-chip t0">HIDDEN</div>';
        chips = `<div class="obj-chip t0">🧪 ${sci ? Math.ceil(sci.hp) : 0} HP</div>
                 ${status}
                 <div class="obj-chip neutral">☠ ${fmt(m.scores[0])} · ${m.zombiesLeft ?? 0} up</div>`;
        break;
      }
    }
    bar.innerHTML = chips;
    $('mode-status').textContent = MODE_INFO[m.id].name;
    // §8.8 the sky, on the record — amber when it's costing you something
    const wx = world.weather;
    const chip = $('weather-chip');
    if (!wx || wx.kind === 'clear') { chip.textContent = ''; chip.className = ''; }
    else {
      const glyph = { rain: '🌧', storm: '⛈', fog: '🌫', snow: '🌨', dust: '🌪', night: '🌙' }[wx.kind] ?? '';
      chip.textContent = `${glyph} ${wx.kind}`;
      chip.className = wx.intensity > 0.6 ? 'rough' : '';
    }
    const t = m.timeLeft;
    $('match-timer').textContent = Number.isFinite(t)
      ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`
      : '';
  }

  private updateMinimap(world: World, local: Soldier) {
    const ctx = this.minimapCtx;
    const S = 220;
    // canvas is 440×440 rendered in 220-space at 2× — crisp at both map sizes
    ctx.setTransform(2, 0, 0, 2, 0, 0);
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
    // §18 second channel: hostiles read by SHAPE, not hue alone — triangles
    const tri = (wx: number, wz: number, color: string, r = 3) => {
      const [x, y] = toMap(wx, wz);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.9, y + r * 0.75);
      ctx.lineTo(x - r * 0.9, y + r * 0.75);
      ctx.closePath();
      ctx.fill();
    };
    // map tech: gates + lift pads
    for (const gate of world.map.gates) {
      for (const end of [gate.a, gate.b]) dot(end.x, end.z, '#66e8ff', 3);
    }
    for (const pad of world.map.pads) dot(pad.pos.x, pad.pos.z, '#30d0c0', 2.5);

    // deployed gadgets
    for (const g of world.gadgets.values()) {
      const mine = g.team === local.team;
      if (g.type === 'warpA' || g.type === 'warpB') dot(g.pos.x, g.pos.z, mine ? '#7dffdc' : '#ff8866', 3);
      else if (g.type === 'drone') dot(g.pos.x, g.pos.z, mine ? '#c8e8ff' : '#ffb0a0', 2);
      else if (g.type === 'orbital') dot(g.pos.x, g.pos.z, '#ff3020', 4);
      else if (g.type === 'supply_pod') dot(g.pos.x, g.pos.z, '#ffd870', 4);
      else if (g.type === 'shield') dot(g.pos.x, g.pos.z, mine ? '#e8a33d' : '#3dbde8', 3.5);
    }

    // objectives
    const m = world.mode;
    if (m.hillPos) dot(m.hillPos.x, m.hillPos.z, m.hillHolder === -1 ? '#ffffff' : m.hillHolder === 0 ? '#e8a33d' : '#3dbde8', 5);
    if (m.points) for (const p of m.points) dot(p.pos.x, p.pos.z, p.owner === -1 ? '#ffffff' : p.owner === 0 ? '#e8a33d' : '#3dbde8', 4.5);
    if (m.flags) for (const f of m.flags) dot(f.pos.x, f.pos.z, f.team === 0 ? '#e8a33d' : '#3dbde8', 4);

    // ---- advanced line of sight ----
    // You see what YOU can see. A head cam network adds everything your
    // teammates can see. Pings (beacons, drones, sensor crews, psi) mark
    // anyone. Smoke hides. IR goggles expose nearby cloaks.
    const hasHeadcam = this.hasEquip(local, 'headcam');
    const hasIR = this.hasEquip(local, 'seeCloaked');
    const grid = world.map.grid;
    const mates: Soldier[] = [];
    if (hasHeadcam) {
      for (const x of world.soldiers.values()) {
        if (x.alive && x.team === local.team && x.id !== local.id && (x.kind === 'human' || x.kind === 'bot')) mates.push(x);
      }
    }
    const eyeSees = (from: Soldier, s: Soldier, range: number) => {
      const d = Math.hypot(s.pos.x - from.pos.x, s.pos.z - from.pos.z);
      return d < range && losClear(grid, { ...from.pos, y: 1.4 }, { ...s.pos, y: 1.4 });
    };
    const seesEnemy = (s: Soldier): boolean => {
      if (world.smoked.has(s.id)) return Math.hypot(s.pos.x - local.pos.x, s.pos.z - local.pos.z) < 8;
      if (world.pinged.has(s.id)) return true;
      if (s.cloaked) return hasIR && Math.hypot(s.pos.x - local.pos.x, s.pos.z - local.pos.z) < 30;
      if (eyeSees(local, s, 55)) return true;
      for (const mate of mates) if (eyeSees(mate, s, 50)) return true;
      return false;
    };

    // entities
    for (const s of world.soldiers.values()) {
      if (!s.alive || s.id === local.id) continue;
      if (s.kind === 'scientist') {
        dot(s.pos.x, s.pos.z, '#f4ffd8', 4.5);
        dot(s.pos.x, s.pos.z, '#5aa845', 2.5);
        continue;
      }
      const zed = s.kind !== 'human' && s.kind !== 'bot';
      const pinged = world.pinged.has(s.id) && s.team !== local.team;
      if (pinged) {
        // targeting ring: revealed by beacon/drone/sensors/psi, cloak or not
        const [px, py] = toMap(s.pos.x, s.pos.z);
        ctx.strokeStyle = '#ff5040';
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (zed) {
        // the horde always reads on co-op radar — it's how squads survive
        const c = s.kind === 'sprinter' ? '#e06a50' : s.kind === 'bomber' ? '#b7e34a' : s.kind === 'stalker' ? '#3fe0c8' : '#8fce5a';
        dot(s.pos.x, s.pos.z, c, s.kind === 'brute' ? 3 : 2);
        continue;
      }
      if (s.team !== local.team) {
        if (!seesEnemy(s)) continue;
        if (s.cloaked && hasIR) {
          // IR ghost outline rather than a solid contact
          const [px, py] = toMap(s.pos.x, s.pos.z);
          ctx.strokeStyle = '#b8ffe8';
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.stroke();
          continue;
        }
      } else if (world.smoked.has(s.id)) {
        continue; // even friendlies vanish in smoke
      }
      if (s.team === local.team) dot(s.pos.x, s.pos.z, s.team === 0 ? '#e8a33d' : '#3dbde8');
      else {
        // concealment rule (§8.4/MAP-STRATEGY): an enemy under a roof is OFF
        // your map unless pinged — or you're inside the same building
        const eh = houseAt(world.map.houses, s.pos.x, s.pos.z);
        if (eh >= 0 && !world.pinged.has(s.id) &&
            eh !== houseAt(world.map.houses, local.pos.x, local.pos.z)) continue;
        tri(s.pos.x, s.pos.z, s.team === 0 ? '#e8a33d' : '#3dbde8'); // hostile = triangle
      }
    }

    // vehicles: friendlies always; enemies when seen, or when their ECM is slagged
    for (const v of world.vehicles.values()) {
      if (!v.alive) continue;
      if (v.team !== local.team) {
        if (v.burrowed) continue; // a deep breacher is under the war — no sensor reads it
        const ecmDead = v.systems && v.systems.ecm <= 0;
        const d = Math.hypot(v.pos.x - local.pos.x, v.pos.z - local.pos.z);
        const seen = (d < 60 && losClear(grid, { ...local.pos, y: 1.4 }, { ...v.pos, y: 1.8 })) ||
          mates.some((mt) => Math.hypot(v.pos.x - mt.pos.x, v.pos.z - mt.pos.z) < 55 &&
            losClear(grid, { ...mt.pos, y: 1.4 }, { ...v.pos, y: 1.8 }));
        if (!ecmDead && !seen) continue;
      }
      // friendly burrowed breachers read dimmed — the team knows, the enemy doesn't
      const dim = v.burrowed ? 'aa' : '';
      if (v.team === local.team) dot(v.pos.x, v.pos.z, (v.team === 0 ? '#c8882d' : '#2d9dc8') + dim, 3.5);
      else tri(v.pos.x, v.pos.z, (v.team === 0 ? '#c8882d' : '#2d9dc8') + dim, 4.2); // hostile = triangle
    }

    // mine detector: enemy mines read as hollow red squares
    if (this.hasEquip(local, 'seeMines')) {
      for (const mine of world.mines.values()) {
        if (mine.team === local.team) continue;
        const [px, py] = toMap(mine.pos.x, mine.pos.z);
        ctx.strokeStyle = '#ff5040';
        ctx.strokeRect(px - 3, py - 3, 6, 6);
      }
    }

    // tactical-system waypoints (diamonds, numbered)
    this.waypoints = this.waypoints.filter((wp) => wp.until > world.time);
    this.waypoints.forEach((wp, i) => {
      const [px, py] = toMap(wp.x, wp.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-4, -4, 8, 8);
      ctx.restore();
      ctx.fillStyle = '#ffe08a';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(String(i + 1), px + 6, py - 5);
    });
    this.lastTime = world.time;
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

  /** Post-match honors, computed straight from the trophy ledger. */
  private renderTrophies(world: World): string {
    const pool = world.humansAndBots();
    if (!pool.length) return '';
    const best = <K extends 'score' | 'kills' | 'longestKill' | 'healGiven' | 'vehicleKills'>(key: K) =>
      [...pool].sort((a, b) => (b[key] as number) - (a[key] as number))[0];
    const awards: { icon: string; title: string; s: Soldier; detail: string }[] = [];
    const mvp = best('score');
    if (mvp.score > 0) awards.push({ icon: '🏆', title: 'MVP', s: mvp, detail: `${Math.floor(mvp.score)} score` });
    const gun = best('kills');
    if (gun.kills > 0) awards.push({ icon: '💀', title: 'Top Gun', s: gun, detail: `${gun.kills} kills` });
    const marksman = best('longestKill');
    if (marksman.longestKill > 0) awards.push({ icon: '🎯', title: 'Longest Shot', s: marksman, detail: `${marksman.longestKill.toFixed(1)}u` });
    const medic = best('healGiven');
    if (medic.healGiven > 0) awards.push({ icon: '⚕️', title: 'Combat Medic', s: medic, detail: `${Math.round(medic.healGiven)} healed` });
    const buster = best('vehicleKills');
    if (buster.vehicleKills > 0) awards.push({ icon: '💥', title: 'Tank Buster', s: buster, detail: `${buster.vehicleKills} wrecks` });
    if (!awards.length) return '';
    return `<div class="trophy-row">${awards.map((a) =>
      `<div class="trophy"><div class="t-icon">${a.icon}</div><div class="t-title">${a.title}</div><div class="t-name t${a.s.team}">${a.s.name}</div><div class="t-detail">${a.detail}</div></div>`,
    ).join('')}</div>`;
  }

  private renderScoreboard(world: World, localId: number) {
    const sb = $('scoreboard');
    const m = world.mode;
    const soldiers = world.humansAndBots().sort((a, b) => b.score - a.score || b.kills - a.kills);
    const row = (s: Soldier) =>
      `<tr class="${s.id === localId ? 'me' : ''}"><td>${s.name}</td><td>${CLASSES[s.classId].name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${Math.floor(s.score)}</td></tr>`;
    let html = `<h2>${MODE_INFO[m.id].name}${m.over ? ` — ${m.winner === -1 ? 'Draw' : TEAM_NAMES[m.winner as Team] + ' wins'}` : ''}</h2>`;
    if (m.over) html += this.renderTrophies(world); // the honors roll
    html += `<table>
      <tr><th>Callsign</th><th>Class</th><th>K</th><th>D</th><th>Score</th></tr>`;
    if (m.id === 'survival' || m.id === 'horde' || m.id === 'safehouse') {
      html += soldiers.map(row).join('');
    } else {
      for (const team of [0, 1] as Team[]) {
        html += `<tr class="team-head t${team}"><td colspan="5">${TEAM_NAMES[team]} — ${Math.floor(m.scores[team])}</td></tr>`;
        html += soldiers.filter((s) => s.team === team).map(row).join('');
      }
    }
    html += '</table>';
    if (m.over && this.careerHtml) html += this.careerHtml; // §3.4: what this match added
    if (m.over) html += `<p style="margin-top:1rem;color:var(--muted)">Returning to menu…</p>`;
    sb.innerHTML = html;
  }

  /** Post-match career pane (the Record, §3.4) — set by the match tracker. */
  careerHtml = '';

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
      // §21 The Reprint: the announcer's one word when the printer finishes.
      // Local human only (localId is always this client's human; bots get no
      // ceremony), and never the match-start deployment — your first walk to
      // the front isn't a reprint, it's an enlistment.
      if (e.type === 'respawn' && e.soldierId === localId && world.time > 1) {
        this.announce('REPRINTED', false, now);
      }
      if (e.type === 'psi_ping' && e.soldierId === localId) this.psiFlashUntil = now + 1;
      if ((e.type === 'announce' || e.type === 'flag_taken' || e.type === 'flag_captured' ||
           e.type === 'flag_returned' || e.type === 'point_captured' || e.type === 'wave_start' ||
           e.type === 'match_over' || e.type === 'pod_incoming' || e.type === 'beacon_planted' ||
           e.type === 'system_damaged' || e.type === 'hacked') && e.text) {
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

  /** Red edge-glow when hurt, green when healed — snaps in, fades out. */
  private flashVignette(kind: 'hurt' | 'heal', strength: number) {
    const v = this.vignette;
    v.classList.remove('hurt', 'heal');
    v.classList.add(kind);
    v.style.transition = 'none';        // appear instantly…
    v.style.opacity = String(strength);
    void v.offsetWidth;                 // commit the jump
    v.style.transition = 'opacity 0.55s ease-out';
    v.style.opacity = '0';              // …then bleed away
  }

  /** Equipment icons with live cooldown/ready states. */
  private updateEquipStatus(s: Soldier, time: number) {
    const sig = s.equipment.join(',');
    if (sig !== this.equipSig) {
      this.equipSig = sig;
      this.equipRow.innerHTML = s.equipment
        .map((id) => {
          const eq = EQUIPMENT[id];
          return eq ? `<span class="eq-chip" data-eq="${id}" title="${eq.name}">${eq.icon}</span>` : '';
        })
        .join('');
    }
    for (const chip of this.equipRow.querySelectorAll<HTMLElement>('.eq-chip')) {
      const id = chip.dataset.eq!;
      let cooling = false;
      let label = '';
      if ((id === 'repair_kit' || id === 'hacking_kit') && time < s.nextRepairAt) {
        cooling = true;
        label = String(Math.ceil(s.nextRepairAt - time));
      }
      if (id === 'medikit' && !s.medikitReady) cooling = true;
      if (id === 'psi_scanner') chip.classList.toggle('flash', time < this.psiFlashUntil);
      chip.classList.toggle('cooling', cooling);
      chip.dataset.cd = label;
    }
  }

  announce(text: string, big: boolean, now: number) {
    this.announceEl.textContent = text;
    this.announceEl.classList.toggle('big', big);
    this.announceEl.classList.add('show');
    this.announceUntil = now + (big ? 4 : 2.5);
  }
}
