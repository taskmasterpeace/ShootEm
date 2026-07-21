import { AMMO_INFO, CLASSES, EQUIPMENT, MODE_INFO, TEAM_NAMES, VEHICLES, WEAPONS, weaponProfile } from '../sim/data';
import { LSWS, VO_LINES } from '../sim/lsw';
import { audio, earshotFor } from './audio';
import { icon } from './icons';
import { T_CLIMB, T_WALL, losClear, houseAt } from '../sim/map';
import { LEGACY_GEOMETRY, halfDepth, halfWidth, worldDepth, worldWidth, type MapGeometry } from '../sim/map-geometry';
import { isZed, type SimEvent, type Soldier, type Team, type Vec3 } from '../sim/types';
import { drawGrade, drawNumber, RING_COLORS } from './ring';
import { weaponPortrait } from './weaponcam';
import { weaponBrand } from './models/weapons';
import { SegMeter } from './segmeter';
import { classLinger, MAX_LINGER } from '../sim/perception';
import type { World } from '../sim/world';
import { OPERATION_COMPLICATIONS, OPERATION_EFFECTS, type OperationHull, type OperationManifest, type OperationPlan } from '../sim/operations';
import type { OperationResult } from '../sim/operation-runtime';
import type { SettlementReceipt } from './campaign';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function minimapPoint(geometry: MapGeometry, size: number, pos: Vec3): [number, number] {
  return [
    ((pos.x + halfWidth(geometry)) / worldWidth(geometry)) * size,
    ((pos.z + halfDepth(geometry)) / worldDepth(geometry)) * size,
  ];
}

export function minimapWorldPoint(geometry: MapGeometry, size: number, x: number, z: number): Vec3 {
  return {
    x: (x / size) * worldWidth(geometry) - halfWidth(geometry),
    y: 0,
    z: (z / size) * worldDepth(geometry) - halfDepth(geometry),
  };
}

type OperationHudEvent = SimEvent & { type: 'operation_phase' | 'operation_progress' | 'operation_complete' };

export interface OperationHudState {
  plan: OperationPlan;
  phaseIndex: number;
  progress: number;
  startedAt: number;
  completed: boolean;
  won?: boolean;
  completionText?: string;
}

export function createOperationHudState(plan: OperationPlan, startedAt: number): OperationHudState {
  return { plan, phaseIndex: 0, progress: 0, startedAt, completed: false };
}

export function reduceOperationHud(state: OperationHudState, event: OperationHudEvent, _now: number): OperationHudState {
  if (event.operationId !== state.plan.id) return state;
  const phaseIndex = event.phaseId
    ? Math.max(0, state.plan.phases.findIndex((phase) => phase.id === event.phaseId))
    : state.phaseIndex;
  if (event.type === 'operation_complete') {
    return { ...state, phaseIndex, progress: 1, completed: true, won: event.won, completionText: event.text };
  }
  return { ...state, phaseIndex, progress: event.type === 'operation_progress' ? Math.max(0, Math.min(1, event.progress ?? 0)) : 0 };
}

const hudEsc = (value: unknown): string => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]!));

export function renderOperationHud(state: OperationHudState, now: number): string {
  const current = state.plan.phases[state.phaseIndex];
  const next = state.plan.phases[state.phaseIndex + 1];
  const elapsed = Math.max(0, now - state.startedAt);
  const clock = `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  const complication = OPERATION_COMPLICATIONS.find((entry) => entry.id === state.plan.complication)?.name ?? state.plan.complication;
  if (state.completed) {
    return `<section class="operation-hud ${state.won ? 'won' : 'lost'}"><span class="operation-hud-kicker">OPERATION ${state.won ? 'COMPLETE' : 'FAILED'} · ${clock}</span><b>${hudEsc(state.plan.codename)}</b><small>${hudEsc(current?.label ?? 'Final objective')} · ${hudEsc(state.completionText ?? (state.won ? 'All objectives secured.' : 'The force was withdrawn.'))}</small></section>`;
  }
  return `<section class="operation-hud"><div class="operation-hud-line"><span class="operation-hud-kicker">OPERATION ${hudEsc(state.plan.codename)} · ${clock}</span><span class="operation-hud-risk">RISK · ${hudEsc(complication)}</span></div><div class="operation-hud-current"><b>${hudEsc(current?.label ?? 'Awaiting orders')}</b><span class="mono">${Math.round(state.progress * 100)}%</span></div><div class="operation-hud-meter"><i style="width:${Math.round(state.progress * 100)}%"></i></div>${next ? `<small>NEXT · ${hudEsc(next.label)}</small>` : '<small>FINAL OBJECTIVE</small>'}</section>`;
}

export interface OperationAfterActionInput {
  plan: OperationPlan;
  manifest: OperationManifest;
  result: OperationResult;
  receipt: SettlementReceipt;
  inventory: readonly OperationHull[];
}

export function renderOperationAfterAction(input: OperationAfterActionInput): string {
  const byId = new Map(input.inventory.map((hull) => [hull.id, hull]));
  const status = (id: string) => input.receipt.hullsLost.includes(id) ? 'LOST' : 'RETURNED';
  const hulls = input.manifest.hullIds.map((id) => {
    const hull = byId.get(id);
    return `<li class="${status(id).toLowerCase()}"><b>${hudEsc(hull?.name ?? id)}</b><span>${hudEsc(hull?.kind.toUpperCase() ?? 'UNKNOWN')}</span><em>${status(id)}</em></li>`;
  }).join('');
  const reward = OPERATION_EFFECTS.find((entry) => entry.id === input.plan.effect)?.name ?? input.plan.effect;
  const delta = input.receipt.treasuryDelta >= 0 ? `+${input.receipt.treasuryDelta}` : String(input.receipt.treasuryDelta);
  return `<section id="operation-aar"><h3>OPERATION AFTER-ACTION · ${hudEsc(input.plan.codename)}</h3><div class="operation-aar-grid"><span>OBJECTIVES <b>${input.result.completedPhaseIds.length} / ${input.plan.phases.length}</b></span><span>ELAPSED <b>${Math.round(input.result.elapsed)}s</b></span><span>TREASURY <b>${delta}</b></span><span>REWARD <b>${hudEsc(input.result.won ? reward : 'DENIED')}</b></span></div><ul>${hulls}</ul></section>`;
}

/** A tactical-system waypoint drawn on the whole team's minimap. */
interface Waypoint { x: number; z: number; until: number; by: string }

/** W3.9 — rank insignia in the vitals row. Module-level (the boot path has
 *  no Hud instance yet); hidden until a dossier exists. */
export function setRankChip(insignia: string, name: string) {
  const chip = document.getElementById('rank-chip');
  if (!chip) return;
  chip.classList.remove('hidden');
  document.getElementById('rank-glyphs')!.textContent = insignia;
  document.getElementById('rank-name')!.textContent = name.toUpperCase();
}

export class Hud {
  private killfeedEl = $('killfeed');
  private announceEl = $('announce');
  private announceUntil = 0;
  private minimapEl = $('minimap') as HTMLCanvasElement;
  private minimapCtx = this.minimapEl.getContext('2d')!;
  private mapBg: HTMLCanvasElement | null = null;
  private mapBgGeometry = '';
  private minimapGeometry: MapGeometry = { ...LEGACY_GEOMETRY };
  /** HOLD-THEN-FADE: where the minimap last showed each hostile, and when — a
   *  lost contact dissolves from here instead of blinking off (W0.2). */
  private minimapContacts = new Map<number, { x: number; z: number; t: number }>();
  private waypoints: Waypoint[] = [];
  private lastTime = 0;
  /** set true when the local player carries the Tactical System */
  waypointsEnabled = false;
  /** multiplayer relays placed waypoints to teammates */
  onWaypoint: (x: number, z: number) => void = () => {};

  // ---- visual feedback layers (created dynamically) ----
  private vignette = document.createElement('div');
  private sysPips = document.createElement('div');
  private crewPips = document.createElement('div');
  private equipRow = document.createElement('div');
  private reloadBar = document.createElement('div');
  private stamBar = document.createElement('div');
  private lastEnergy = 100;
  private hullBar = document.createElement('div');
  private lswBar = document.createElement('div');
  private lastHp = -1;
  private lastRingKey = '';
  private wasAlive = false;
  private psiFlashUntil = 0;
  private equipSig = '';
  /** B1 weapon-cam: the weapon id currently baked into the plate */
  private wcamId = '';
  /** ammo-dwindle: pip count currently in the DOM — rebuild only on a change */
  private ammoPipCount = -1;
  /** status strip: the current chip-set key — rebuild DOM only when it changes */
  private stripKey = '';
  /** damage-direction: round-robin index into the pooled arcs */
  private dmgArcIdx = 0;
  private segMeter: SegMeter | null = null;
  private lswMeter: SegMeter | null = null;
  private operationHud: OperationHudState | null = null;

  constructor() {
    // §16.3: the viral chip wears the biohazard from the ONE icon vocabulary
    const vIco = document.getElementById('viral-ico');
    if (vIco) vIco.innerHTML = icon('infection');
    // §16.2 the MELEE STANCE LINE — built once (static icons), dimmed per
    // frame. STRIKE and GRAPPLE mount the vocabulary's last two glyphs.
    const stance = document.getElementById('stance-line');
    if (stance) {
      stance.innerHTML =
        `<span class="stance-chip" id="stance-strike">${icon('strike')}F STRIKE</span>` +
        `<span class="stance-chip" id="stance-guard">${icon('guard')}V GUARD</span>` +
        `<span class="stance-chip" id="stance-grapple">${icon('grapple')}Z GRAPPLE</span>`;
    }
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
      const point = minimapWorldPoint(this.minimapGeometry, S, mx, mz);
      this.addWaypoint(point.x, point.z, 'you');
      this.onWaypoint(point.x, point.z);
    });

    // damage/heal vignette overlay
    this.vignette.id = 'dmg-vignette';
    $('hud').appendChild(this.vignette);
    // M2 THE STAMINA BAR (Robert: "we need that energy meter and be able to
    // see it regenerate"): the tank now pays for sprint/dash/roll AND
    // abilities, so it earns a real horizontal bar under the ring — filling
    // edge visible, a flash on every spend.
    this.stamBar.id = 'stam-bar';
    this.stamBar.innerHTML = '<div id="stam-fill"></div>';
    $('health-block').appendChild(this.stamBar);
    // vehicle subsystem pips + reload progress live in the weapon block
    this.sysPips.id = 'sys-pips';
    this.reloadBar.id = 'reload-bar';
    this.reloadBar.innerHTML = '<div id="reload-fill"></div>';
    // THE HULL BAR (Robert: "when we get into a vehicle we can't see how much
    // health it has… I can tell when it's about to explode because it started
    // smoking, but I can't tell" — the number was there, the READING wasn't)
    this.hullBar.id = 'hull-bar';
    this.hullBar.innerHTML = '<div id="hull-fill"></div>';
    // THE SIGNATURE METER: an ascended pilot had NO cooldown readout anywhere —
    // nextLswActiveAt was never once read on the client (Robert, on Phantom:
    // "he doesn't have a meter to tell me when he could phase again").
    // B1: it speaks the ONE METER grammar now — its own SegMeter instance.
    this.lswBar.id = 'lsw-bar';
    const wb = $('weapon-block');
    wb.appendChild(this.reloadBar);
    wb.appendChild(this.hullBar);
    wb.appendChild(this.lswBar);
    wb.appendChild(this.sysPips);
    // B1 THE ONE METER (UX-LANGUAGE §8, decided): the segmented bar with the
    // amber lead-notch — reload, Impact Charge, and the vehicle WPN cycle all
    // speak through it; the god's signature gets its own instance below
    this.segMeter = new SegMeter($('seg-meter'));
    this.lswMeter = new SegMeter(this.lswBar);
    this.lswMeter.show(false);
    // THE CREW ROW (Robert: "little dots to show how many people are in the
    // vehicle with you, by how many seats it could hold, and then how many
    // people are actually in it")
    this.crewPips.id = 'crew-pips';
    wb.appendChild(this.crewPips);
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

  /** UI-BIBLE §09 — build the unified status strip from LIVE sim state. Each
   *  chip: short mono label + source-colored edge + a bottom timer bar scaled
   *  to time-left. Priority-ordered (critical first, §03); 6 shown then +N
   *  (§15). Derived every frame, never a second truth (§03 law 2). */
  private renderStatusStrip(s: Soldier, world: World) {
    const strip = $('status-strip');
    if (!s.alive || s.vehicleId >= 0) { strip.classList.add('hidden'); return; }
    const now = world.time;
    // amber=yours, red=danger, steel=info, viral-green=infection, green=recovery
    const RED = 'var(--danger)', AMBER = 'var(--accent)', STEEL = 'var(--muted)', VIRAL = 'oklch(0.72 0.17 145)';
    type Chip = { key: string; label: string; edge: string; crit?: boolean; frac?: number };
    const chips: Chip[] = [];
    const timed = (until: number, span: number) => Math.max(0, Math.min(1, (until - now) / span));
    // CRITICAL first (§03 alert hierarchy)
    if (s.encasedUntil !== undefined && now < s.encasedUntil)
      chips.push({ key: 'iced', label: 'ICED', edge: 'var(--wcam-tint,#8fd0ff)', crit: true, frac: timed(s.encasedUntil, 4) });
    if (s.markedUntil !== undefined && now < s.markedUntil)
      chips.push({ key: 'hunted', label: 'HUNTED', edge: RED, crit: true, frac: timed(s.markedUntil, 5) });
    // the enemy has eyes on you (§09 pinged/tagged) — a victim-side truth
    if (world.pinged.has(s.id) || (world.tagged.get(s.id) ?? 0) > now)
      chips.push({ key: 'pinged', label: 'PINGED', edge: RED });
    const viral = s.viralLoad ?? 0;
    if (viral >= 40) chips.push({ key: 'infected', label: viral >= 80 ? 'CRITICAL' : 'INFECTED', edge: VIRAL, crit: viral >= 80 });
    // overcharge / rage (yours = amber)
    if (s.rageMul !== undefined && s.rageMul > 1) chips.push({ key: 'power', label: 'POWER', edge: AMBER });
    // psi link (steel info)
    if (s.psiLinkUntil !== undefined && now < s.psiLinkUntil)
      chips.push({ key: 'link', label: 'LINK', edge: STEEL, frac: timed(s.psiLinkUntil, 8) });
    // concealment (steel)
    if (world.smoked.has(s.id)) chips.push({ key: 'smoked', label: 'SMOKED', edge: STEEL });
    if (s.cloaked) chips.push({ key: 'cloak', label: 'CLOAK', edge: STEEL });
    // spawn protection (steel shell, ending soon = amber) — held then fades
    if (now < s.protectedUntil) chips.push({ key: 'shield', label: 'SHIELD', edge: STEEL, frac: timed(s.protectedUntil, 3) });

    if (chips.length === 0) { strip.classList.add('hidden'); this.stripKey = ''; return; }
    strip.classList.remove('hidden');
    const shown = chips.slice(0, 6);
    const overflow = chips.length - shown.length;
    // rebuild the DOM only when the SET of chips changes; per-frame just move
    // the timer bars (§13 no per-frame layout churn)
    const key = shown.map((c) => c.key).join(',') + (overflow ? `+${overflow}` : '');
    if (key !== this.stripKey) {
      strip.innerHTML = shown.map((c) =>
        `<span class="status-chip${c.crit ? ' crit' : ''}" data-k="${c.key}" style="--chip-edge:${c.edge}">${c.label}` +
        (c.frac !== undefined ? '<span class="chip-timer"></span>' : '') + '</span>').join('') +
        (overflow ? `<span class="status-chip more">+${overflow}</span>` : '');
      this.stripKey = key;
    }
    // slide the timer bars to time-left (empties left→right as it runs out)
    shown.forEach((c) => {
      if (c.frac === undefined) return;
      const el = strip.querySelector(`[data-k="${c.key}"] .chip-timer`) as HTMLElement | null;
      if (el) el.style.transform = `scaleX(${c.frac.toFixed(3)})`;
    });
  }

  update(world: World, localId: number, scoreboardHeld: boolean, now: number) {
    const s = world.soldiers.get(localId);
    if (!s) return;
    const operationEl = document.getElementById('operation-objective');
    if (operationEl) {
      operationEl.classList.toggle('hidden', !this.operationHud);
      if (this.operationHud) operationEl.innerHTML = renderOperationHud(this.operationHud, now);
    }

    // vitals — THE RING, big (one language: you read your own at T2)
    const hasPlate = (s.maxArmor ?? 0) > 0;
    const ring = $('self-ring') as HTMLCanvasElement;
    const hpFrac = Math.max(0, Math.min(1, s.hp / s.maxHp));
    const arFrac = hasPlate ? Math.max(0, Math.min(1, s.armor / s.maxArmor)) : 0;
    const enFrac = Math.max(0, Math.min(1, s.energy / 100));
    // stamina bar: width tracks the tank; a chunk-spend (dash/roll/ability)
    // flashes the bar so the cost is FELT, and refill is visibly continuous
    const sf = $('stam-fill');
    sf.style.width = `${enFrac * 100}%`;
    sf.classList.toggle('low', enFrac < 0.25);
    if (this.lastEnergy - s.energy > 5) {
      this.stamBar.classList.remove('spent');
      void this.stamBar.offsetWidth; // restart the CSS animation
      this.stamBar.classList.add('spent');
    }
    this.lastEnergy = s.energy;
    const ringKey = `${Math.round(hpFrac * 100)}:${Math.round(arFrac * 20)}:${Math.round(enFrac * 20)}:${Math.ceil(s.hp)}`;
    if (ringKey !== this.lastRingKey) {
      this.lastRingKey = ringKey;
      const ctx = ring.getContext('2d')!;
      drawGrade(ctx, hpFrac, arFrac, RING_COLORS.hp(hpFrac), hasPlate);
      // the energy inner arc — thin, same grammar
      if (enFrac > 0.004) {
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = RING_COLORS.energy;
        ctx.beginPath();
        ctx.arc(64, 64, 34, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * enFrac);
        ctx.stroke();
      }
      drawNumber(ctx, Math.ceil(s.hp));
    }
    const hpNum = $('hp-num');
    hpNum.textContent = String(Math.ceil(s.hp));
    hpNum.classList.toggle('low', s.hp < s.maxHp * 0.35);
    $('en-num').textContent = String(Math.floor(s.energy));
    // issued plate: its label follows the plate arc on the ring
    $('ar-label').classList.toggle('hidden', !hasPlate);
    if (hasPlate) {
      $('ar-num').textContent = String(Math.ceil(s.armor));
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
        // aboard, the plate shows the VEHICLE's readouts — the carried gun waits
        if (this.wcamId) { this.wcamId = ''; $('wcam-plate').classList.add('hidden'); }
        this.segMeter?.show(false);
        $('ammo-pips').classList.add('hidden'); this.ammoPipCount = -1; // the mag pips wait too
        $('weapon-name').textContent = VEHICLES[v.kind].name;
        const ammoEl = $('ammo-count');
        ammoEl.classList.remove('reloading');
        // HULL, not "ARMOR": this read `${hp} ARMOR` — a bare number with no
        // maximum, so 90 meant nothing (a full buggy? a dying tank?) and it
        // never changed colour. Now it's a fraction with the same low/critical
        // warning states the ammo counter uses, over a bar you read at a glance.
        const hullFrac = Math.max(0, Math.min(1, v.hp / Math.max(1, v.maxHp)));
        ammoEl.textContent = `${Math.ceil(v.hp)} / ${v.maxHp} HULL`;
        ammoEl.classList.toggle('low-ammo', hullFrac <= 0.5 && hullFrac > 0.25);
        ammoEl.classList.toggle('no-ammo', hullFrac <= 0.25); // the smoke you already see, in a number
        // WPN cycle (backlog 1.7a — Robert: "we need to see when our gun is
        // recharged… for the vehicle that we're in"): slow mounted guns show
        // their recharge on the reload bar. Fast MGs (period < 0.5s) skip it —
        // a bar that strobes nine times a second is noise, not information.
        const wid = VEHICLES[v.kind].weapon;
        const wdef = wid ? WEAPONS[wid] : undefined;
        const period = wdef ? 1 / wdef.rof : 0;
        const wpnDead = (v.systems?.weapon ?? 1) <= 0;
        if (wdef && period >= 0.5 && !wpnDead) {
          // THE ONE METER (§8): the mounted gun's recharge speaks the same
          // segmented grammar as every other fill — green notches at READY
          const wait = Math.max(0, (v.nextFireAt ?? 0) - world.time);
          const ready = 1 - Math.min(1, wait / period);
          this.segMeter!.set(ready, ready >= 1 ? 'ready' : 'active');
          this.segMeter!.show(true);
        } else {
          this.segMeter!.show(false);
        }
        this.reloadBar.style.display = 'none'; // retired — the SegMeter carries it
        this.hullBar.style.display = 'block';
        const hf = $('hull-fill');
        hf.style.width = `${hullFrac * 100}%`;
        hf.style.background = hullFrac > 0.5 ? '#46d17a' : hullFrac > 0.25 ? '#f5b21a' : '#ff4736';
        // crew position
        const crew = VEHICLES[v.kind].crew;
        let role = s.seat === 0 ? 'DRIVER · W/S drive · A/D steer' : 'PASSENGER';
        if (crew && s.seat >= 1 && s.seat <= crew.length) role = crew[s.seat - 1].toUpperCase() + ' STATION';
        // UI P0 (docs/UI-MASTER.md §8): the homing duel + the flare pocket
        // finally get readouts — a seeker on YOUR hull says so in red, and
        // pilots see how many saves are left before they need one.
        const flying = !!VEHICLES[v.kind].flies;
        const flareTxt = flying ? ` · G flares ${'●'.repeat(Math.max(0, v.flares ?? 0)) || '—'}` : '';
        // B2 the ALT ladder (backlog 1.7c): which floor of the sky you own —
        // and at bands 2-3, the sanctuary reminder (only SAMs reach you)
        const band = v.band ?? 0;
        const altTxt = flying ? ` · ALT ${['▁', '▂', '▅', '█'][band]} ${band}/3${band >= 2 ? ' — SAM-only sky' : ''}` : '';
        let locked = false;
        for (const p of world.projectiles.values()) {
          if (p.homingVehicleId === v.id) { locked = true; break; }
        }
        const hintEl = $('ability-hint');
        hintEl.textContent = `${role} · E exit${altTxt}${flareTxt}${locked ? ' · ⚠ MISSILE INBOUND' : ''}`;
        hintEl.classList.toggle('warn', locked);
        // per-system damage record as pips: ENG WPN SEN ECM COM
        const max = VEHICLES[v.kind].systemHp ?? 60;
        this.sysPips.style.display = 'flex';
        this.sysPips.innerHTML = (['engine', 'weapon', 'sensors', 'ecm', 'comms'] as const).map((id) => {
          const hp = v.systems?.[id] ?? max;
          const state = hp <= 0 ? 'dead' : hp < max * 0.4 ? 'hurt' : 'ok';
          return `<span class="pip ${state}">${id.slice(0, 3).toUpperCase()}</span>`;
        }).join('');
        // one dot per SEAT: filled = someone is in it, ◉ = the wheel, white =
        // you. An empty wheel while others ride blinks — nobody is driving.
        const seats = v.seats;
        if (seats.length > 1) {
          this.crewPips.style.display = 'flex';
          const filled = seats.filter((id) => id >= 0).length;
          const dots = seats.map((occ, i) => {
            const cls = ['seat'];
            if (occ >= 0) cls.push('filled');
            if (i === 0) cls.push('driver');
            if (occ === s.id) cls.push('you');
            const glyph = i === 0 ? (occ >= 0 ? '◉' : '◌') : occ >= 0 ? '●' : '○';
            return `<span class="${cls.join(' ')}">${glyph}</span>`;
          }).join('');
          this.crewPips.innerHTML = `<span class="crew-count">CREW ${filled}/${seats.length}</span>${dots}`;
        } else {
          this.crewPips.style.display = 'none';
        }
      }
    } else {
      this.sysPips.style.display = 'none';
      this.crewPips.style.display = 'none';
      this.hullBar.style.display = 'none';
      const wid = s.weapons[s.weaponIdx];
      const def = WEAPONS[wid];
      // B1 THE WEAPON-CAM (Robert: "I wanna see what I'm using"): the plate
      // shows the EXACT equipped model — baked once per id, maker-tinted chrome
      if (wid !== this.wcamId) {
        this.wcamId = wid;
        const url = weaponPortrait(wid);
        const plate = $('wcam-plate');
        if (url) {
          ($('wcam-img') as HTMLImageElement).src = url;
          const brand = weaponBrand(wid);
          $('wcam-brand').textContent = brand.key.toUpperCase();
          plate.style.setProperty('--wcam-tint', `#${brand.tint.toString(16).padStart(6, '0')}`);
          plate.classList.remove('hidden');
        } else plate.classList.add('hidden');
      }
      // WEAPON MEMORY: the equipped gun's SERVICE RECORD, engraved on the plate
      // every frame (it grows as you fight). Distance is FAMILY-GATED — the
      // marksman line boasts its reach; a shotgun keeps the range off the face.
      const tally = $('wcam-tally');
      const led = this.gunLedger.get(wid);
      if (led && led.kills > 0) {
        const showRange = (def.tracer === 'bullet' || def.tracer === 'rail') && (def.range ?? 0) >= 40 && led.longest >= 20;
        // hull stamps as short mono tags (no emoji — the house type law): the
        // TYPES of vehicles this gun has killed, Robert's ask
        const hulls = Object.entries(led.hulls).filter(([, n]) => (n ?? 0) > 0)
          .map(([k, n]) => `${(VEHICLES[k as keyof typeof VEHICLES]?.name ?? k).slice(0, 4).toUpperCase()}${(n ?? 0) > 1 ? `×${n}` : ''}`).join(' ');
        tally.innerHTML = `${led.kills} CONFIRMED${showRange ? ` · ${led.longest.toFixed(0)}u` : ''}`
          + (hulls ? ` <span class="wt-hull">${hulls}</span>` : '');
        tally.classList.remove('hidden');
      } else tally.classList.add('hidden');
      // coach-ui: NO emoji in the lockup — the 🎯 rendered magenta (a house-law
      // violation) and full-color emoji broke the mono/stencil type system
      $('weapon-name').textContent = def.name;
      const ammoEl = $('ammo-count');
      // THE ONE METER (§8): reload first (they're exclusive), else the Impact
      // Charge — same segmented bar, same lead-notch, whatever it's measuring
      const meterCharge = s.meleeCharge ?? 0;
      if (s.reloadUntil > 0) {
        ammoEl.textContent = 'RELOADING';
        ammoEl.classList.add('reloading');
        ammoEl.classList.remove('low-ammo', 'no-ammo');
        $('ammo-pips').classList.add('hidden'); // the reload SegMeter carries the beat
        const k = Math.min(1, Math.max(0, 1 - (s.reloadUntil - world.time) / def.reloadTime));
        this.segMeter!.set(k, k >= 1 ? 'ready' : 'active');
        this.segMeter!.show(true);
        this.reloadBar.style.display = 'none'; // the old bar retires from the soldier branch
      } else {
        ammoEl.classList.remove('reloading');
        this.reloadBar.style.display = 'none';
        // the Impact Charge speaks through the SAME bar the reload uses —
        // one meter, whatever it happens to be measuring (§8)
        if (meterCharge > 0.02) {
          this.segMeter!.set(Math.min(meterCharge, 1.12), meterCharge >= 1.3 ? 'over' : meterCharge >= 0.71 ? 'max' : 'active');
          this.segMeter!.show(true);
        } else this.segMeter!.show(false);
        const clipN = s.clip[s.weaponIdx];
        const clip = Number.isFinite(clipN) ? clipN : '∞';
        // AMMO TYPE (OUTBREAK-SPEC §11): tag the loaded round when it's not
        // plain ball — and only on the ballistic weapons AP/INC actually
        // change. B cycles it; the tag is where the eye already reads the mag.
        const ballistic = def.tracer === 'bullet' || def.tracer === 'shell';
        // §11.3: the RESERVE number is what the next reload draws — the
        // selected special's POOL, or the classic reserve on ball
        const poolN = ballistic && s.ammoType ? (s.ammoPools?.[s.ammoType] ?? AMMO_INFO[s.ammoType]?.pool ?? 0) : undefined;
        const resN = poolN ?? s.reserve[s.weaponIdx];
        const res = Number.isFinite(resN) ? resN : '∞';
        const ammoTag = ballistic && s.ammoType ? ` · ${s.ammoType.toUpperCase()}` : '';
        ammoEl.textContent = `${clip} / ${res}${ammoTag}`;
        // the counter itself warns you before the click of an empty mag
        const lowMag = Number.isFinite(clipN) && clipN > 0 && clipN <= def.clip * 0.25;
        ammoEl.classList.toggle('no-ammo', Number.isFinite(clipN) && clipN === 0);
        ammoEl.classList.toggle('low-ammo', lowMag);
        // THE AMMO DWINDLE (Robert): the mag as PIPS that empty as you fire.
        // Finite clips only (energy/∞ arms hide it). The pip STRIP is rebuilt
        // only when the mag SIZE changes (weapon swap); per-shot we just flip
        // pips to `spent`, so it's a couple of class toggles a frame, not a
        // DOM rebuild. Big mags cap at 40 pips (each pip = a few rounds).
        const pips = $('ammo-pips');
        if (!Number.isFinite(clipN) || def.clip <= 1) {
          pips.classList.add('hidden');
          this.ammoPipCount = -1;
        } else {
          pips.classList.remove('hidden');
          const shown = Math.min(def.clip, 40);
          const perPip = def.clip / shown;             // rounds each pip stands for
          if (this.ammoPipCount !== shown) {           // rebuild only on a size change
            pips.innerHTML = Array.from({ length: shown }, () => '<i class="ap"></i>').join('');
            this.ammoPipCount = shown;
          }
          const litPips = Math.ceil(clipN / perPip);   // how many pips remain lit
          const kids = pips.children;
          for (let i = 0; i < kids.length; i++) kids[i].classList.toggle('spent', i >= litPips);
          pips.classList.toggle('low', lowMag);
        }
        // OUTBREAK-SPEC §11.2: the WEAPON'S tactical fingerprint — its role plus
        // PENetration / NoiSE / FIRe-hazard / CORpse-denial ratings as 3-notch
        // mono bars, right under the mag where the eye already reads it (§16.4
        // "keep it near the action"). Now WEAPON-derived (a silenced SMG and a
        // tank cannon no longer read identical) and shown for EVERY offensive
        // arm — the flamethrower's FIR▮▮▮ and the laser's NSE▯▯▯ are the point.
        // Melee and the medi-beam have no report to read, so they stay quiet.
        const infoEl = $('ammo-info');
        if (def.tracer !== 'none' && !def.heals) {
          const prof = weaponProfile(def, ballistic ? (s.ammoType ?? 'ball') : undefined);
          const bar = (n: number) => '▮'.repeat(n) + '▯'.repeat(3 - n);
          // §16.3: AP wears the pointed round, INC wears the flame
          const ico = ballistic && s.ammoType === 'ap' ? icon('ap') : ballistic && s.ammoType === 'inc' ? icon('incendiary') : '';
          infoEl.innerHTML = `${ico}${prof.role} · PEN${bar(prof.pen)} NSE${bar(prof.noise)} FIR${bar(prof.fire)} COR${bar(prof.corpse)}`;
          infoEl.classList.remove('hidden');
        } else {
          infoEl.classList.add('hidden');
        }
      }
      // secondary fire (right mouse) rides the weapon in hand — show its tank
      const alt = def.alt;
      const altTxt = !alt ? ''
        : alt.kind === 'overcharge' ? ' · RMB overcharge'
        : ` · RMB ${alt.kind} ×${s.altAmmo}`;
      // paintballers get paintball truth — never advertise frags they don't have.
      // The grenade bag shows WHAT'S IN YOUR HAND as PIPS: ➤ marks the pouch
      // G throws from (X cycles). UI P0 (docs/UI-MASTER.md §3, LOCKED): the
      // throw cooldown reads as the selected pouch's lead pip REFILLING
      // (◔◑◕ → ●) — the wait is visible exactly where the eye already is.
      // Also fixed here: the CONCUSSION pouch was missing from the bag.
      const sel = s.nadeSel ?? 0;
      const cdLeft = Math.max(0, (s.nextGrenadeAt ?? 0) - world.time);
      const cdK = Math.max(0, Math.min(1, 1 - cdLeft / 1.2)); // 1.2s base throw cd
      const sweep = cdK >= 1 ? '●' : cdK >= 0.66 ? '◕' : cdK >= 0.33 ? '◑' : '◔';
      const pouch = (idx: number, label: string, n: number) => {
        if (n <= 0) return '';
        const capped = Math.min(n, 5);
        const lead = sel === idx && cdLeft > 0 ? sweep : '●';
        const pips = lead + '●'.repeat(capped - 1) + (n > 5 ? `+${n - 5}` : '');
        return `${sel === idx ? '➤' : ''}${label} ${pips}`;
      };
      const bag = [
        pouch(0, s.classId === 'engineer' ? 'mines' : 'frags', s.grenades),
        pouch(1, 'smoke', s.smokes ?? 0),
        pouch(2, 'fire', s.firebombs ?? 0),
        pouch(3, 'conc', s.concs ?? 0),
      ].filter(Boolean).join(' · ');
      // WHAT Q ACTUALLY DOES. An ascended pilot was shown `CLASSES[classId].
      // abilityName` — the ability of the recruit they stopped being — while
      // the god's own activeLabel was never displayed anywhere in the game.
      // A god also carries no frag pouch now, so the bag line is a lie too.
      const god = s.ascendant ? LSWS[s.ascendant] : undefined;
      const hint = $('ability-hint');
      // GUARD (§12): a raised brace owns the hint line — you're not managing a
      // grenade bag, you're blocking. The .warn tint reads as "committed."
      const charge = s.meleeCharge ?? 0;
      // REAR CONTROL (OUTBREAK-SPEC §14.2/§16.2): you hold a pin — the hint tells
      // you the finisher is one press away, so the takedown is discoverable.
      const pin = s.grabbingId !== undefined ? world.soldiers.get(s.grabbingId) : undefined;
      const holdingPin = !!pin && pin.grabbedBy === s.id && pin.grabbedUntil !== undefined;
      if (holdingPin) {
        // §14.2 REAR CONTROL: a rear grab that landed is immediate control —
        // the whole outcome MENU is yours (no minigame). A front clinch has no
        // rear control and shows the plain takedown prompt.
        const rearControlled = pin!.ctrlStruggle?.locked === true;
        if (rearControlled) {
          hint.innerHTML = s.chokingId !== undefined
            ? `${icon('rear')} CHOKING — ${Math.round((pin!.chokeProgress ?? 0) * 100)}% · hold the grip`
            : pin!.humanShield
              ? `${icon('rear')} HUMAN SHIELD — move to advance · Z/F/E/SPACE to finish`
              : `${icon('rear')} REAR CONTROL — Z takedown · F disarm · E choke · SPACE throw`;
        } else {
          hint.innerHTML = `${icon('rear')} REAR CONTROL — press Z: TAKEDOWN`; // §16.3: hand behind a silhouette
        }
        hint.classList.add('warn');
      } else if (s.guarding) {
        hint.innerHTML = `${icon('guard')} GUARD — bracing · release V to lower`; // §16.3: angled brace
        hint.classList.add('warn');
      } else if (charge > 0.02) {
        // IMPACT CHARGE (§13): the SEGMENTED METER carries the fill now (§8,
        // one meter law) — the hint keeps only the state word.
        const band = charge >= 1.3 ? 'OVERCHARGE — release!' : charge >= 0.7 ? 'MAXIMUM' : charge >= 0.3 ? 'HEAVY' : 'wind-up';
        hint.innerHTML = `${icon('impact')} IMPACT CHARGE — ${band}`; // §16.3: the impact ring
        hint.classList.toggle('warn', charge >= 1.3);
      } else {
        hint.classList.remove('warn');
        hint.textContent = world.mode.id === 'paintball'
          ? 'R reload · one splat and you sit'
          : god
            ? `Q · ${god.activeLabel}`
            : `${CLASSES[s.classId].abilityName} · ${bag || 'bag empty'}${altTxt} · X swaps`;
      }

      // §16.2 the STANCE LINE: melee readiness at a glance — dim = not now.
      // STRIKE and GRAPPLE share the sim's own gates (meleeStrikeAt +
      // nextFireAt — the grab lunge books nextFireAt too, world.ts §14);
      // GUARD dims with an empty tank (the meter IS the mechanic). Hidden
      // where melee isn't yours to use: vehicles, gods, the dead.
      const stanceEl = $('stance-line');
      const stanceOn = s.alive && s.vehicleId < 0 && s.ascendant === undefined;
      stanceEl.classList.toggle('hidden', !stanceOn);
      if (stanceOn) {
        const meleeFree = s.meleeStrikeAt === 0 && world.time >= s.nextFireAt;
        $('stance-strike').classList.toggle('dim', !meleeFree);
        $('stance-guard').classList.toggle('dim', s.energy <= 0.5);
        $('stance-grapple').classList.toggle('dim', !meleeFree);
      }

      // THE SIGNATURE METER: fills back toward ready in the ONE grammar —
      // green notches = press it. Hidden for mortals.
      if (god) {
        const cd = Math.max(0.001, god.activeCd);
        const left = Math.max(0, (s.nextLswActiveAt ?? 0) - world.time);
        const k = Math.max(0, Math.min(1, 1 - left / cd));
        this.lswMeter!.set(k, k >= 1 ? 'ready' : 'active');
        this.lswMeter!.show(true);
      } else {
        this.lswMeter!.show(false);
      }
    }

    // THE OUTBREAK (OUTBREAK-SPEC §16): the infection STATE ladder reads with
    // the vitals — CLEAN (hidden) → EXPOSED → INFECTED → CRITICAL, sickly
    // green until the turn threshold, then breathing red. The % is the count.
    const vc = $('viral-chip');
    const viral = s.viralLoad ?? 0;
    if (viral > 0 && s.alive) {
      vc.classList.remove('hidden');
      const critical = viral >= 40;
      vc.classList.toggle('hot', critical);
      const state = viral >= 80 ? 'CRITICAL' : viral >= 40 ? 'INFECTED' : 'EXPOSED';
      $('viral-num').textContent = `${Math.round(viral)}% ${state}`;
    } else vc.classList.add('hidden');

    // UI-BIBLE §09 — THE UNIFIED STATUS STRIP. Every timed player state gets a
    // chip here, DERIVED from live sim fields (§03 law 2), priority-ordered
    // (§03: critical first), six visible then +N (§15). Replaces the scattered
    // one-off timers the bible flags.
    this.renderStatusStrip(s, world);

    // UI P0 (docs/UI-MASTER.md §2): YOU ARE DOWN — the bleedout clock and the
    // way out, breathing red near the action. Revive channel shows its math.
    const db = $('down-banner');
    if (s.alive && s.downed) {
      db.classList.remove('hidden');
      db.querySelector('b')!.textContent = 'DOWN';
      const left = Math.max(0, (s.downedUntil ?? 0) - world.time);
      $('down-timer').textContent = (s.reviveProgress ?? 0) > 0
        ? `medic on you — ${Math.round((s.reviveProgress ?? 0) * 100)}% lifted`
        : `bleeding out ${left.toFixed(0)}s · crawl — a medic can lift you`;
    } else if (s.alive && s.grabbedUntil !== undefined) {
      // GRABBED (OUTBREAK-SPEC §14): pinned. The banner turns into the struggle
      // prompt — mash the sticks and watch the break meter climb. A zombie's
      // grip is a BITE STRUGGLE (§15.5): break it before the jaws close.
      const grabber = s.grabbedBy != null ? world.soldiers.get(s.grabbedBy) : undefined;
      const bite = !!grabber && isZed(grabber.kind);
      db.classList.remove('hidden');
      const rearHeld = s.ctrlStruggle?.locked === true;
      if (rearHeld) {
        // §14.2: controlled from behind — no minigame, just fight free (mash)
        db.querySelector('b')!.innerHTML = `${icon('escape')} CONTROLLED`;
        const pct = Math.round(Math.min(1, s.struggle ?? 0) * 100);
        $('down-timer').textContent = (s.chokeProgress ?? 0) > 0
          ? ` — being choked out… ${Math.round((s.chokeProgress ?? 0) * 100)}%`
          : ` — he has your back · mash MOVE to break · ${pct}%`;
      } else {
        // §16.3: ESCAPE is the broken chain — the struggle wears the icon
        db.querySelector('b')!.innerHTML = `${icon('escape')} ${bite ? 'BITE STRUGGLE' : 'GRABBED'}`;
        const pct = Math.round(Math.min(1, s.struggle ?? 0) * 100);
        $('down-timer').textContent = bite
          ? ` — mash MOVE before the bite! · ${pct}%`
          : ` — mash MOVE to break free · ${pct}%`;
      }
    } else db.classList.add('hidden');

    // respawn overlay
    const ro = $('respawn-overlay');
    if (!s.alive) {
      ro.classList.remove('hidden');
      const t = Math.max(0, s.respawnAt - world.time);
      // paintball paint is final per ROUND: no countdown, just the promise —
      // and nobody DIES in the yard, so the header says paint, not K.I.A.
      const paintball = world.mode.id === 'paintball';
      ro.querySelector('h2')!.textContent = paintball ? 'SPLAT!' : 'K.I.A.';
      $('respawn-timer').textContent = world.mode.over ? ''
        : paintball ? 'you sit this round — back at the whistle'
        : `Respawning in ${t.toFixed(1)}s`;
      // DEATH RE-SELECT: the class rack rides the wait (not in paintball —
      // the yard has markers, not classes; and not once the match is over)
      const rackOn = !paintball && !world.mode.over;
      $('respawn-classes').classList.toggle('hidden', !rackOn);
      $('respawn-reselect-hint').classList.toggle('hidden', !rackOn);
    } else ro.classList.add('hidden');

    // context hint: vehicles, or the scientist escort in safehouse
    const hint = $('vehicle-hint');
    let showHint = false;
    if (s.alive && !inVehicle) {
      for (const v of world.vehicles.values()) {
        if (!v.alive || v.team !== s.team || !v.seats.includes(-1)) continue;
        if (Math.hypot(v.pos.x - s.pos.x, v.pos.z - s.pos.z) < VEHICLES[v.kind].radius + 2.2) {
          const aboard = v.seats.filter((x) => x >= 0).length;
          const seatDots = v.seats.map((x) => (x >= 0 ? '●' : '○')).join('');
          hint.textContent = `[E] Enter ${VEHICLES[v.kind].name} · ${aboard}/${v.seats.length} ${seatDots}`;
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
    if (now > this.subUntil) $('vo-sub').classList.remove('show');
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
      case 'paintball': {
        // the mode built for brand-new players gets the CLEAREST bar of all:
        // your role, the series score, the tag count — restated every frame
        const hunted = m.huntedTeam ?? 1;
        const prey = local.team === hunted;
        const tags = m.scores[hunted];
        const wins = m.roundWins ?? [0, 0];
        const mine = wins[local.team], theirs = wins[1 - local.team];
        chips = `<div class="obj-chip ${prey ? 't1' : 't0'}">${prey ? '🎯 YOU ARE THE PREY' : '🔫 HUNT THE PREY'}</div>
                 <div class="obj-chip ${mine >= theirs ? 't0' : 't1'}">R${m.round ?? 1} · YOU ${mine}–${theirs} · FIRST TO ${m.roundTarget ?? 3}</div>
                 <div class="obj-chip neutral">TAGS ${fmt(tags)}/${m.target}</div>
                 <div class="obj-chip neutral">${prey ? 'tag pads or survive' : 'one splat and they sit'}</div>`;
        break;
      }
    }
    // UI P0 (docs/UI-MASTER.md §7): a falling god is on EVERYONE's clock —
    // the telegraph window gets a chip with the name and the countdown,
    // amber if it's yours, red if it's theirs. The LZ ring marks the where;
    // this marks the when.
    const localTeam = local.team;
    for (const p of world.pendingLsw ?? []) {
      const left = Math.max(0, p.landsAt - world.time);
      const name = LSWS[p.id]?.name?.toUpperCase() ?? 'LSW';
      chips += `<div class="obj-chip ${p.team === localTeam ? 't0' : 't1'}">☄ ${name} INBOUND ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}</div>`;
    }
    // THE OUTBREAK (OUTBREAK-SPEC §3.2): the sector's biohazard status — a
    // colored alert chip that climbs yellow→orange→red as the level rises.
    if (world.outbreakEnabled && (world.outbreakLevel ?? 0) > 0) {
      const lvl = world.outbreakLevel;
      const label = ['', 'SUSPECTED', 'OUTBREAK', 'CONTAINMENT FAILURE', 'SECTOR LOST'][lvl];
      const tone = lvl >= 3 ? 't1' : 'neutral';
      chips += `<div class="obj-chip ${tone} biohazard lvl${lvl}">${icon('infection')} L${lvl} · ${label}</div>`;
    }
    // §6/§16.3: the NEAREST incubating corpse gets a proximity chip — the
    // body-with-timer while it cooks, the RISING silhouette (red) in the
    // final CRITICAL window. You were told; move, or burn it.
    if (world.outbreakEnabled && world.corpses.length && local.alive) {
      let near: (typeof world.corpses)[number] | undefined;
      let nd = 12; // earshot of a body you should be worrying about
      for (const c of world.corpses) {
        if (c.neutralized || c.reanimatesAt <= world.time) continue;
        const d = Math.hypot(c.pos.x - local.pos.x, c.pos.z - local.pos.z);
        if (d < nd) { nd = d; near = c; }
      }
      if (near) {
        const left = near.reanimatesAt - world.time;
        chips += left <= 2 // CORPSE_CRITICAL_WINDOW — the final thrash
          ? `<div class="obj-chip t1">${icon('rising')} ${near.name.toUpperCase()} IS RISING</div>`
          : `<div class="obj-chip neutral">${icon('corpse')} BODY ${nd.toFixed(0)}u · ${Math.ceil(left)}s</div>`;
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
    const geometry = world.map.geometry;
    this.minimapGeometry = geometry;
    const geometryKey = `${geometry.cols}x${geometry.rows}x${geometry.tile}:${world.map.seed}`;
    // canvas is 440×440 rendered in 220-space at 2× — crisp at both map sizes
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    if (!this.mapBg || this.mapBgGeometry !== geometryKey) {
      this.mapBgGeometry = geometryKey;
      this.mapBg = document.createElement('canvas');
      this.mapBg.width = this.mapBg.height = S;
      const b = this.mapBg.getContext('2d')!;
      b.fillStyle = 'rgba(20, 22, 18, 0.9)';
      b.fillRect(0, 0, S, S);
      const pxX = S / geometry.cols;
      const pxZ = S / geometry.rows;
      // walls solid, CLIMB barricades (§8.7) fainter — the minimap tells a
      // jump trooper where the flank routes are at a glance
      for (let z = 0; z < geometry.rows; z++)
        for (let x = 0; x < geometry.cols; x++) {
          const t = world.map.grid[z * geometry.cols + x];
          if (t !== T_WALL && t !== T_CLIMB) continue;
          b.fillStyle = t === T_WALL ? 'rgba(150, 145, 120, 0.55)' : 'rgba(150, 145, 120, 0.3)';
          b.fillRect(x * pxX, z * pxZ, pxX, pxZ);
        }
    }
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.mapBg, 0, 0);
    const toMap = (wx: number, wz: number) => minimapPoint(geometry, S, { x: wx, y: 0, z: wz });
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
      return d < range && losClear(grid, { ...from.pos, y: 1.4 }, { ...s.pos, y: 1.4 }, 1.4, geometry);
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
      const zed = s.kind !== 'human' && s.kind !== 'bot' && s.kind !== 'dog'; // dogs read as soldiers, not horde
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
        if (!seesEnemy(s)) {
          // HOLD THEN FADE (W0.2, Robert §11 row 6: "when you look away they
          // should fade over ~5s… never blink"). A hostile the map just lost
          // does not pop off — it holds at the spot the map last had it and
          // DISSOLVES over the same per-class linger the 3D ghost uses. A cloak
          // engaging mid-fade cuts it (cloak is TRUE).
          const mk = this.minimapContacts.get(s.id);
          if (mk && !s.cloaked) {
            const age = world.time - mk.t;
            const linger = classLinger(local.classId, local.equipment.includes('tracking_optics'));
            if (age <= linger) {
              ctx.globalAlpha = Math.max(0.12, 1 - age / linger);
              tri(mk.x, mk.z, s.team === 0 ? '#e8a33d' : '#3dbde8');
              ctx.globalAlpha = 1;
            }
          }
          continue;
        }
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
        const eh = houseAt(world.map.houses, s.pos.x, s.pos.z, geometry);
        if (eh >= 0 && !world.pinged.has(s.id) &&
            eh !== houseAt(world.map.houses, local.pos.x, local.pos.z, geometry)) continue;
        tri(s.pos.x, s.pos.z, s.team === 0 ? '#e8a33d' : '#3dbde8'); // hostile = triangle
        // remember this spot so the contact fades from HERE when the map loses it
        this.minimapContacts.set(s.id, { x: s.pos.x, z: s.pos.z, t: world.time });
      }
    }
    // drop marks past the longest possible fade so the map memory stays bounded
    for (const [id, mk] of this.minimapContacts) {
      if (world.time - mk.t > MAX_LINGER) this.minimapContacts.delete(id);
    }

    // vehicles: friendlies always; enemies when seen, or when their ECM is slagged
    for (const v of world.vehicles.values()) {
      if (!v.alive) continue;
      if (v.team !== local.team) {
        if (v.burrowed) continue; // a deep breacher is under the war — no sensor reads it
        const ecmDead = v.systems && v.systems.ecm <= 0;
        const d = Math.hypot(v.pos.x - local.pos.x, v.pos.z - local.pos.z);
        const seen = (d < 60 && losClear(grid, { ...local.pos, y: 1.4 }, { ...v.pos, y: 1.8 }, 1.4, geometry)) ||
          mates.some((mt) => Math.hypot(v.pos.x - mt.pos.x, v.pos.z - mt.pos.z) < 55 &&
            losClear(grid, { ...mt.pos, y: 1.4 }, { ...v.pos, y: 1.8 }, 1.4, geometry));
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
        // detail #6, the flesh-vs-chrome ledger: clones are the treasure,
        // machines are scrap — the scoreboard teaches the economy in one line
        let flesh = 0, chrome = 0;
        for (const s of soldiers) {
          if (s.team !== team) continue;
          if (s.kind === 'human') flesh += s.deaths; else chrome += s.deaths;
        }
        html += `<tr class="team-head t${team}"><td colspan="5">${TEAM_NAMES[team]} — ${Math.floor(m.scores[team])}` +
          `<span style="float:right;font-size:0.78em;color:var(--muted)">LOSSES — FLESH ${flesh} · CHROME ${chrome}</span></td></tr>`;
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

  /** Detail #1: which print of you is currently walking. You deploy as
   *  PRINT 1; every reprint increments. Reset when a fresh match's clock
   *  runs backwards past us. */
  private prints = 1;
  private lastSimTime = 0;
  /** WEAPON MEMORY slice 1 (Robert: "certain guns have the distance… the type
   *  of vehicles they've taken out"): a per-weapon-id session ledger, fed from
   *  the DeathReport stream, read by the weapon-cam plate. Client-side and
   *  match-scoped for now; the sim-owned serial registry is the later slice. */
  private gunLedger = new Map<string, { kills: number; longest: number; hulls: Partial<Record<string, number>> }>();
  private ledgerFor(id: string) {
    let g = this.gunLedger.get(id);
    if (!g) { g = { kills: 0, longest: 0, hulls: {} }; this.gunLedger.set(id, g); }
    return g;
  }

  applyEvents(events: SimEvent[], world: World, localId: number, now: number) {
    if (world.time < this.lastSimTime) { this.prints = 1; this.gunLedger.clear(); } // new match
    this.lastSimTime = world.time;
    if (!world.operation) this.operationHud = null;
    for (const event of events) {
      if (event.type !== 'operation_phase' && event.type !== 'operation_progress' && event.type !== 'operation_complete') continue;
      if (!this.operationHud && world.operation) {
        this.operationHud = createOperationHudState(world.operation.plan, now - world.operation.elapsed);
      }
      if (this.operationHud) this.operationHud = reduceOperationHud(this.operationHud, event as OperationHudEvent, now);
    }
    // UI-BIBLE §09 DAMAGE DIRECTION: on a hurt addressed to ME, rotate a
    // pooled red arc to the attacker's bearing. Fixed-north camera → world
    // bearing maps straight to screen rotation (atan2(dx, -dz), 0 = up).
    for (const e of events) {
      if (e.type !== 'hurt' || e.soldierId !== localId || !e.pos) continue;
      const me = world.soldiers.get(localId);
      if (!me) continue;
      const deg = (Math.atan2(e.pos.x - me.pos.x, -(e.pos.z - me.pos.z)) * 180) / Math.PI;
      const arcs = document.querySelectorAll('#dmg-dir .dmg-arc');
      if (arcs.length === 0) continue;
      const el = arcs[this.dmgArcIdx++ % arcs.length] as HTMLElement;
      el.style.setProperty('--deg', `${deg.toFixed(0)}deg`);
      el.classList.remove('on');
      void el.offsetWidth; // restart the fade animation
      el.classList.add('on');
    }
    for (const e of events) {
      // THE GUN REMEMBERS — only MY kills, keyed by the weapon that made them
      if (e.type === 'death' && e.killerId === localId && e.weaponId) {
        const g = this.ledgerFor(e.weaponId);
        g.kills++;
        if ((e.dist ?? 0) > g.longest) g.longest = Math.round((e.dist ?? 0) * 10) / 10;
      } else if (e.type === 'vehicle_destroyed' && e.killerId === localId && e.weaponId && e.vehKind) {
        this.ledgerFor(e.weaponId).hulls[e.vehKind] = (this.ledgerFor(e.weaponId).hulls[e.vehKind] ?? 0) + 1;
      }
    }
    for (const e of events) {
      if (e.type === 'death' && e.victimName) {
        const killerTeamCls = e.killerTeam !== undefined ? `t${e.killerTeam}` : 'zed';
        const entry = document.createElement('div');
        entry.className = 'kf-entry';
        // DEATH-DATA fix: a bleedout / environment kill has no WEAPONS name —
        // fall back to the weapon id so the feed never shows a blank cause.
        const cause = e.weaponName || (e.weaponId === 'bleedout' ? 'bled out' : e.weaponId ?? '');
        // long-range confirms wear their distance — the sniper's boast (family
        // gate lives in the weapon ledger; the feed just shows a real reach)
        const far = (e.dist ?? 0) >= 45 ? `<span class="kf-dist">${Math.round(e.dist!)}u</span>` : '';
        entry.innerHTML = e.killerName
          ? `<span class="${killerTeamCls}">${e.killerName}</span><span class="wpn">${cause}</span>${far}<span>${e.victimName}</span>`
          : `<span>${e.victimName} died</span>`;
        this.killfeedEl.prepend(entry);
        while (this.killfeedEl.children.length > 6) this.killfeedEl.lastChild?.remove();
        setTimeout(() => entry.remove(), 6000);
      }
      if (e.type === 'hit' && e.soldierId === localId) this.flashHitmarker();
      // §21 The Reprint: the announcer's one word when the printer finishes.
      // Local human only (localId is always this client's human; bots get no
      // ceremony), and never the match-start deployment — your first walk to
      // the front isn't a reprint, it's an enlistment. Paintball rounds are
      // exempt too: nobody dies in the yard, you just walk back on.
      if (e.type === 'respawn' && e.soldierId === localId && world.time > 1 && world.mode.id !== 'paintball') {
        // your death count becomes a character: by PRINT 9 it's dark comedy,
        // on a one-death match it's a quiet brag (detail #1)
        this.prints++;
        this.announce(`REPRINTED — PRINT ${this.prints}`, false, now);
      }
      if (e.type === 'psi_ping' && e.soldierId === localId) this.psiFlashUntil = now + 1;
      // W2.5 THE KILL CONFIRM: the killer's own line — name · range · spice.
      // Rides its own element under the reticle; the announce banner is
      // never blocked, the screen is never taken.
      if (e.type === 'kill_confirm' && e.soldierId === localId && e.text) {
        const s2 = world.soldiers.get(localId);
        const streak = s2?.streak ?? 0;
        const spice = e.big ? ' — NEW LONGEST' : streak >= 2 ? ` · ×${streak}` : '';
        const el = $('kill-confirm');
        el.textContent = `✕ ${e.text.toUpperCase()} · ${e.amount ?? 0}u${spice}`;
        el.classList.toggle('best', !!e.big);
        el.classList.remove('show');
        void el.offsetWidth; // restart the animation
        el.classList.add('show');
        audio.play('hitmarker', { volume: 0.5, rate: 0.7 }); // a lower, heavier tick than the hit ✕
      }
      if ((e.type === 'announce' || e.type === 'flag_taken' || e.type === 'flag_captured' ||
           e.type === 'flag_returned' || e.type === 'point_captured' || e.type === 'wave_start' ||
           e.type === 'match_over' || e.type === 'pod_incoming' || e.type === 'beacon_planted' ||
           e.type === 'system_damaged' || e.type === 'hacked' || e.type === 'operation_phase' ||
           e.type === 'operation_complete') && e.text) {
        this.announce(e.text, !!e.big, now);
      }
      // SUBTITLES (positional truth): an LSW's spoken line is captioned only
      // if the local player stands inside the voice's earshot — you read
      // what you could HEAR. The announcer's net has no captions here; its
      // text already owns the announce banner.
      if (e.type === 'vo' && e.pos && e.text) {
        const script = VO_LINES[e.text];
        const me = world.soldiers.get(localId);
        if (script && me?.alive) {
          const d = Math.hypot(e.pos.x - me.pos.x, e.pos.z - me.pos.z);
          if (d < earshotFor(e.text).range) {
            this.subtitle(LSWS[script.who].name, LSWS[script.who].color, script.line, now);
          }
        }
      }
    }
  }

  // ---- spoken-line subtitles ----
  private subUntil = 0;
  /** caption a nearby voice: "FIREBRAND: Somebody call for a light?" */
  subtitle(speaker: string, color: number, line: string, now: number) {
    const el = $('vo-sub');
    el.innerHTML = `<b style="color:#${color.toString(16).padStart(6, '0')}">${speaker.toUpperCase()}:</b> ${line}`;
    el.classList.add('show');
    this.subUntil = now + 3.4;
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
