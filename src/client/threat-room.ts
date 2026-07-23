// ---------------------------------------------------------------------------
// THE THREAT ROOM — the runner and the panel.
//
// Robert: *"a threat room should feel like we can stumble across new gameplay
// stuff in it and test things out inside of there, so make sure you have
// maximum visibility."*
//
// So: a control panel that works with a thumb or a mouse, twenty preset
// experiments each asking one question, a summon shelf for everything else,
// and a live readout of what is standing in the room. Everything spawns in
// front of you, at a distance that suits what it is.
// ---------------------------------------------------------------------------
import {
  PRESET_TAGS, SUMMON_SHELF, THREAT_PRESETS, presetById, summonPositions,
  type SummonSpec, type ThreatPreset,
} from '../sim/threatroom';
import { LSWS } from '../sim/lsw';
import type { AscendantId, Soldier, Team, ZedKind } from '../sim/types';
import type { World } from '../sim/world';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Everything the room put in play, so CLEAR can take it all back out. */
export interface RoomState {
  soldiers: number[];
  vehicles: number[];
  lastPreset?: string;
}

export function newRoom(): RoomState { return { soldiers: [], vehicles: [] }; }

/** Drop one summon spec into the world in front of the player. */
export function summon(world: World, room: RoomState, me: Soldier, spec: SummonSpec): void {
  const positions = summonPositions(spec, me.pos, me.yaw);
  const team = (spec.team ?? 1) as Team;
  for (const pos of positions) {
    const k = spec.kind;
    if (k.what === 'vehicle') {
      const v = world.spawnVehicle(k.kind, team, pos);
      v.alive = true;
      room.vehicles.push(v.id);
      continue;
    }
    if (k.what === 'threat') {
      const z = world.addZombie(k.zed as ZedKind, pos);
      if (spec.hp) { z.hp = z.maxHp = spec.hp; }
      room.soldiers.push(z.id);
      continue;
    }
    // everything else is a soldier of some sort
    const classId = k.what === 'class' ? k.classId : k.what === 'blocker' ? 'heavy' : 'infantry';
    const label = k.what === 'dummy' ? (k.label ?? 'DUMMY')
      : k.what === 'blocker' ? 'SPARRING PARTNER'
      : k.what === 'mover' ? 'MOVING TARGET'
      : k.what === 'prop' ? (k.heavy ? 'HEAVY PROP' : 'PROP')
      : k.what === 'god' ? k.ascendant.toUpperCase()
      : classId.toUpperCase();
    // A GOD BELONGS TO ITS STABLE: ascendSoldier refuses a body on the
    // wrong side ('your stable, your body'), so the summon puts it on the
    // team that actually owns it — Titan fights FOR the Front, Ragebeast
    // against it. That is why the shelf offers one of each.
    const onTeam = k.what === 'god' ? (LSWS[k.ascendant as AscendantId]?.faction ?? team) : team;
    const s = world.addSoldier(label, classId, onTeam as Team, 'bot');
    s.pos = { ...pos };
    s.yaw = me.yaw + Math.PI; // everything faces the player — this is a lab
    s.alive = true;
    s.protectedUntil = 0;
    if (spec.hp) { s.hp = s.maxHp = spec.hp; }
    if (spec.respawns) { s.respawns = true; s.dummyHome = { ...pos }; }

    if (k.what === 'dummy' || k.what === 'prop') {
      // it stands and takes it — no brain, no gun. A PROP is a dummy that
      // exists to be knocked around, so it is light on its feet and unarmed.
      s.dummy = true;
      s.weapons = [];
      if (k.what === 'prop') {
        s.hp = s.maxHp = k.heavy ? 900 : 160;
        s.dummy = true;
      }
    } else if (k.what === 'blocker') {
      // THE POINT OF THE ROOM: something that KNOWS HOW TO BLOCK. It holds a
      // guard, so every melee tool has to actually open it.
      s.dummy = true;      // no bot brain — it does one thing, forever
      s.guarding = true;
      s.weapons = [];
      s.roomBlocker = true; // the runner re-arms the guard every tick
    } else if (k.what === 'mover') {
      // it PACES — the shooter's target. Dummy brain, but the room walks it.
      s.dummy = true;
      s.weapons = [];
      s.roomMover = { origin: { ...pos }, speed: k.speed ?? 7, dir: 1 };
    } else if (k.what === 'god') {
      world.ascendSoldier(s, k.ascendant as AscendantId, pos);
    }
    room.soldiers.push(s.id);
  }
}

/** Run one preset — clears the room first, so an experiment is clean. */
export function runPreset(world: World, room: RoomState, me: Soldier, id: string): ThreatPreset | undefined {
  const preset = presetById(id);
  if (!preset) return undefined;
  clearRoom(world, room);
  for (const spec of preset.summons) summon(world, room, me, spec);
  room.lastPreset = id;
  return preset;
}

/** Take everything back out — the lab resets between questions. */
export function clearRoom(world: World, room: RoomState): void {
  for (const id of room.soldiers) {
    const s = world.soldiers.get(id);
    if (s) { s.alive = false; s.respawns = false; world.soldiers.delete(id); }
  }
  for (const id of room.vehicles) {
    const v = world.vehicles.get(id);
    if (v) { v.alive = false; world.vehicles.delete(id); }
  }
  room.soldiers.length = 0;
  room.vehicles.length = 0;
}

/**
 * The room's own per-frame duties: hold the blockers' guards up and walk the
 * movers. Called from the match loop — cheap, and only ever touches bodies
 * the room itself put in play.
 */
export function stepRoom(world: World, room: RoomState, dt: number): void {
  for (const id of room.soldiers) {
    const s = world.soldiers.get(id);
    if (!s?.alive) continue;
    if (s.roomBlocker) {
      s.guarding = true;      // it never drops the guard — that IS the exercise
      s.energy = 100;         // and never gets tired of holding it
    }
    const mv = s.roomMover;
    if (mv) {
      // paces a line across your view — the lead-practice target
      s.pos.x += Math.cos(s.yaw + Math.PI / 2) * mv.speed * mv.dir * dt;
      s.pos.z += Math.sin(s.yaw + Math.PI / 2) * mv.speed * mv.dir * dt;
      const drift = Math.hypot(s.pos.x - mv.origin.x, s.pos.z - mv.origin.z);
      if (drift > 16) mv.dir *= -1;
    }
  }
}

/** What is standing in the room right now — the readout. */
export function roomCensus(world: World, room: RoomState): { alive: number; total: number; vehicles: number } {
  let alive = 0;
  for (const id of room.soldiers) if (world.soldiers.get(id)?.alive) alive++;
  let vehicles = 0;
  for (const id of room.vehicles) if (world.vehicles.get(id)?.alive) vehicles++;
  return { alive, total: room.soldiers.length, vehicles };
}

// ── THE PANEL ──────────────────────────────────────────────────────────────

export interface PanelHost {
  runPreset(id: string): void;
  summonById(id: string): void;
  clear(): void;
  heal(): void;
}

/** Build the control panel. Touch-first: every control is a real button. */
export function renderThreatPanel(host: HTMLElement, api: PanelHost): void {
  const byTag = PRESET_TAGS
    .map((tag) => ({ tag, list: THREAT_PRESETS.filter((p) => p.tag === tag) }))
    .filter((g) => g.list.length);
  const presetHtml = byTag.map((g) => `
    <div class="tr-group">
      <div class="tr-tag">${esc(g.tag)}</div>
      <div class="tr-cards">
        ${g.list.map((p) => `
          <button class="tr-card" data-preset="${p.id}">
            <b>${esc(p.name)}</b>
            <span>${esc(p.question)}</span>
          </button>`).join('')}
      </div>
    </div>`).join('');
  const shelfTags = [...new Set(SUMMON_SHELF.map((s) => s.tag))];
  const shelfHtml = shelfTags.map((tag) => `
    <div class="tr-group">
      <div class="tr-tag">${esc(tag)}</div>
      <div class="tr-shelf">
        ${SUMMON_SHELF.filter((s) => s.tag === tag).map((s) =>
          `<button class="tr-summon" data-summon="${s.id}">${esc(s.label)}</button>`).join('')}
      </div>
    </div>`).join('');

  host.innerHTML = `
    <div class="tr-head">
      <b>THE THREAT ROOM</b>
      <span id="tr-census">—</span>
      <button class="tr-act" data-act="heal">PATCH ME UP</button>
      <button class="tr-act" data-act="clear">CLEAR THE ROOM</button>
      <button class="tr-act" data-act="close">CLOSE ▸</button>
    </div>
    <div class="tr-body">
      <section><h4>THE TWENTY — each asks one question</h4>${presetHtml}</section>
      <section><h4>SUMMON — drop anything in front of you</h4>${shelfHtml}</section>
    </div>`;

  host.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((b) => {
    b.onclick = () => api.runPreset(b.dataset.preset!);
  });
  host.querySelectorAll<HTMLButtonElement>('[data-summon]').forEach((b) => {
    b.onclick = () => api.summonById(b.dataset.summon!);
  });
  host.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'clear') api.clear();
      else if (a === 'heal') api.heal();
      else host.classList.add('hidden');
    };
  });
}

/** Look up a shelf entry's spec. */
export function shelfSpec(id: string): SummonSpec | undefined {
  const entry = SUMMON_SHELF.find((s) => s.id === id);
  if (!entry) return undefined;
  const k = entry.kind;
  const range = k.what === 'vehicle' ? 16 : k.what === 'god' ? 26 : k.what === 'prop' ? 10 : 8;
  return { kind: k, count: 1, range, arc: 0, team: 1, respawns: k.what === 'dummy' || k.what === 'blocker' || k.what === 'mover' };
}
