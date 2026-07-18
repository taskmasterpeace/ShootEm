// ═══════════════════════════════════════════════════════════════════════════
// THE COMBAT LAB (was the Matchup Stage) — pick a United Front LSW and a
// Collective LSW, drop them in an authored street, and WATCH THEM FIGHT with
// the REAL game renderer: real models, real movement (leaps · blinks · flight),
// signature attacks, and VO. A live COMBAT LOG streams every hit, death,
// signature and spoken line so bugs surface fast.
//
// Renders on its OWN canvas (#lab-canvas) through a real game `Renderer`
// instance — NOT the harness inspector scene — so everything the game shows,
// the lab shows. The harness frame loop calls tick() at the Time-slider scale.
// ═══════════════════════════════════════════════════════════════════════════
import { WEAPONS } from '../sim/data';
import { LSWS, lswsForTeam } from '../sim/lsw';
import { GRID, T_COVER, T_GRASS, T_OPEN, T_WALL, TILE, WORLD } from '../sim/map';
import type { AscendantId, SimEvent } from '../sim/types';
import { World } from '../sim/world';
import { Renderer } from '../client/renderer';
import { audio } from '../client/audio';

export interface MatchupCtl {
  tick(dt: number): void;
  setActive(on: boolean): void;
  readonly active: boolean;
}

// the street: a canyon of building faces with doorways, crates midline
const AX0 = 30, AX1 = 70, AZ0 = 44, AZ1 = 56;

export function mountMatchup(root: HTMLElement): MatchupCtl {
  let active = false;
  let world: World | null = null;
  let fightTime = 0;
  let winner: string | null = null;
  let ufPick: AscendantId = lswsForTeam(0)[0];
  let collPick: AscendantId = lswsForTeam(1)[0];
  let focusId = -1;

  const labCanvas = document.getElementById('lab-canvas') as HTMLCanvasElement;
  let gr: Renderer | null = null;

  // ---- panel + combat-log styles ------------------------------------------
  const style = document.createElement('style');
  style.textContent = `
    #matchup { position: fixed; right: 12px; top: 56px; width: 340px; max-height: calc(100vh - 70px);
      overflow-y: auto; background: rgba(14,13,10,0.94); border: 1px solid #f5b21a; padding: 10px 12px;
      font: 12px 'Courier New', monospace; color: #e8e0c8; z-index: 30; letter-spacing: 0.03em; }
    #matchup h3 { color: #f5b21a; font-size: 12px; margin: 8px 0 4px; }
    #matchup .mu-chips { display: flex; flex-wrap: wrap; gap: 3px; }
    #matchup .mu-chip { border: 1px solid #4a4436; background: #23201a; color: #cfc7b0; padding: 2px 6px;
      cursor: pointer; font: 11px 'Courier New', monospace; }
    #matchup .mu-chip:hover { border-color: #f5b21a; }
    #matchup .mu-chip.on { background: #33291b; color: #f5b21a; border-color: #f5b21a; }
    #matchup #mu-fight { width: 100%; margin-top: 10px; padding: 7px 0; background: #f5b21a; color: #14110b;
      border: 0; font: bold 13px 'Courier New', monospace; cursor: pointer; letter-spacing: 0.08em; }
    #matchup #mu-status { margin-top: 8px; white-space: pre-line; min-height: 42px; }
    #matchup #mu-log { margin-top: 4px; height: 220px; overflow-y: auto; background: #0c0b08;
      border: 1px solid #2a251b; padding: 4px 6px; font: 10.5px 'Courier New', monospace; line-height: 1.45; }
    #matchup .mu-logline { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #a89f88; }
    #matchup .mu-logline .t { color: #5c5545; }
    #matchup .lg-dmg { color: #ff7a6a; }
    #matchup .lg-armor { color: #6cc6ff; }
    #matchup .lg-death { color: #ff4736; font-weight: bold; }
    #matchup .lg-sig { color: #f5b21a; font-weight: bold; }
    #matchup .lg-vo { color: #b7e08a; }
    #matchup .lg-exp { color: #ffb057; }
    #matchup .mu-note { opacity: 0.55; margin-top: 6px; }
  `;
  document.head.appendChild(style);

  root.innerHTML = `
    <h3>▌UNITED FRONT</h3><div class="mu-chips" id="mu-uf"></div>
    <h3>▌THE COLLECTIVE</h3><div class="mu-chips" id="mu-coll"></div>
    <button id="mu-fight">⚔ FIGHT</button>
    <div id="mu-status">Pick a matchup. The street is waiting.</div>
    <h3>▌COMBAT LOG</h3><div id="mu-log"></div>
    <div class="mu-note">Real models, movement, signatures &amp; VO — the game renderer drives this. The topbar Time slider slows the bout.</div>
  `;

  const chipRow = (host: HTMLElement, ids: AscendantId[], get: () => AscendantId, set: (id: AscendantId) => void) => {
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'mu-chip';
      b.textContent = `${LSWS[id].name} T${LSWS[id].threat}`;
      b.title = WEAPONS[LSWS[id].weapon]?.name ?? '';
      b.onclick = () => { set(id); refreshChips(); };
      b.dataset.id = id;
      host.appendChild(b);
    }
    const refresh = () => {
      for (const b of Array.from(host.children) as HTMLButtonElement[]) b.classList.toggle('on', b.dataset.id === get());
    };
    return refresh;
  };
  const refreshUf = chipRow(root.querySelector('#mu-uf')!, lswsForTeam(0), () => ufPick, (id) => { ufPick = id; });
  const refreshColl = chipRow(root.querySelector('#mu-coll')!, lswsForTeam(1), () => collPick, (id) => { collPick = id; });
  const refreshChips = () => { refreshUf(); refreshColl(); };
  refreshChips();
  const status = root.querySelector<HTMLDivElement>('#mu-status')!;
  const logEl = root.querySelector<HTMLDivElement>('#mu-log')!;

  // ---- combat log ----------------------------------------------------------
  const nameOf = (id: number): string => {
    const s = world?.soldiers.get(id);
    if (!s) return id < 0 ? '—' : `#${id}`;
    return s.ascendant ? LSWS[s.ascendant].name : s.name;
  };
  function log(txt: string, cls = ''): void {
    const line = document.createElement('div');
    line.className = `mu-logline ${cls}`;
    line.innerHTML = `<span class="t">${fightTime.toFixed(1)}</span> ${txt}`;
    logEl.appendChild(line);
    while (logEl.children.length > 200) logEl.firstChild!.remove();
    logEl.scrollTop = logEl.scrollHeight;
  }
  function logEvents(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'damage':
          if ((e.amount ?? 0) >= 1) log(`${nameOf(e.ownerId ?? -1)} → ${nameOf(e.soldierId ?? -1)}  −${Math.round(e.amount!)}${e.armorHit ? ' armor' : ''}`, e.armorHit ? 'lg-armor' : 'lg-dmg');
          break;
        case 'death': log(`☠ ${nameOf(e.soldierId ?? -1)} DOWN`, 'lg-death'); break;
        case 'lsw_active': log(`⚡ ${LSWS[e.text as AscendantId]?.name ?? e.text} — SIGNATURE`, 'lg-sig'); break;
        case 'vo': if (e.soldierId !== undefined && e.text) log(`🗣 ${nameOf(e.soldierId)}`, 'lg-vo'); break;
        case 'explosion': log('💥 blast', 'lg-exp'); break;
      }
    }
  }

  // ---- the street, authored into a live World ------------------------------
  function authorStreet(w: World): void {
    const g = w.map.grid;
    // seal the generated map down to the lane, then carve the street
    for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
      if (x <= AX0 || x >= AX1 || z <= AZ0 || z >= AZ1) g[z * GRID + x] = T_WALL;
    }
    for (let z = AZ0; z <= AZ1; z++) for (let x = AX0; x <= AX1; x++) g[z * GRID + x] = T_OPEN;
    for (let x = AX0; x <= AX1; x++) {
      // building faces with doorways every 8 tiles — sightlines broken, never sealed
      g[AZ0 * GRID + x] = (x - AX0) % 8 === 4 ? T_OPEN : T_WALL;
      g[AZ1 * GRID + x] = (x - AX0) % 8 === 2 ? T_OPEN : T_WALL;
    }
    for (const [cx, cz] of [[40, 50], [45, 48], [50, 51], [55, 49], [60, 50], [50, 47]] as const) g[cz * GRID + cx] = T_COVER;
    for (const [gx, gz] of [[37, 52], [38, 52], [37, 53], [63, 47], [62, 47], [63, 48]] as const) g[gz * GRID + gx] = T_GRASS;
  }

  // ---- fight control -------------------------------------------------------
  function startFight(): void {
    // the FIGHT click is a user gesture — unlock audio so the gods can speak
    void audio.init(); audio.resume();
    logEl.innerHTML = '';
    const w = new World({ seed: (Math.random() * 0xffffffff) >>> 0, mode: 'tdm', botsPerTeam: 0, matchMinutes: 15 });
    authorStreet(w);
    // plant the bases INSIDE the lane so both objective anchors land ~26u apart —
    // the gods meet in sight of each other and it HAS to burn (the drive fix).
    const west = { x: (AX0 + 2.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
    const east = { x: (AX1 - 1.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
    w.map.basePos = [{ x: -30, y: 0, z: west.z }, { x: 30, y: 0, z: west.z }];
    w.map.hillPos = { x: 0, y: 0, z: west.z };
    const uf = w.addLsw(ufPick, 0, west)!;
    w.addLsw(collPick, 1, east); // spawn the Collective god (camera focuses the UF one)
    world = w;
    fightTime = 0;
    winner = null;
    focusId = uf.id; // spectate the United Front god (camera follows the fight)

    const r = ensureRenderer();
    r.buildStaticWorld(w);
    r.replayView = false;
    r.killcamFocusId = -1;
    r.camDist = 36;
    status.textContent = `${LSWS[ufPick].name} vs ${LSWS[collPick].name}\nthe street decides.`;
    log(`⚔ ${LSWS[ufPick].name} vs ${LSWS[collPick].name}`, 'lg-sig');
  }

  function ensureRenderer(): Renderer {
    if (!gr) {
      gr = new Renderer(labCanvas);
      // debug handle for live verification: __lab.pick('titan','ragebeast') to
      // stage a matchup, __lab.renderer.camDist to zoom, __lab.world() to inspect.
      (window as unknown as Record<string, unknown>).__lab = {
        get renderer() { return gr; },
        world: () => world,
        get focusId() { return focusId; },
        pick: (uf: AscendantId, coll: AscendantId) => { ufPick = uf; collPick = coll; refreshChips(); startFight(); },
      };
    }
    return gr;
  }

  // ---- per-frame (driven by the harness loop at the Time-slider scale) ------
  function tick(dt: number): void {
    if (!active || !world || !gr) return;
    if (!winner && dt > 0) {
      world.step(Math.min(dt, 0.05), new Map());
      fightTime += dt;
    }
    const events = world.takeEvents();
    logEvents(events);
    gr.applyEvents(events, world, focusId);
    gr.update(world, focusId, dt);

    // the verdict
    const fighters = [...world.soldiers.values()].filter((s) => s.ascendant);
    const uf = fighters.find((s) => s.team === 0);
    const coll = fighters.find((s) => s.team === 1);
    if (!winner) {
      const down = fighters.find((s) => !s.alive);
      if (down) {
        const up = fighters.find((s) => s.alive);
        winner = up ? (up.ascendant ? LSWS[up.ascendant].name : up.name) : 'nobody';
        status.textContent = `${winner.toUpperCase()} TAKES THE STREET — ${fightTime.toFixed(1)}s\n(${LSWS[ufPick].name} vs ${LSWS[collPick].name})`;
        log(`🏁 ${winner.toUpperCase()} takes the street — ${fightTime.toFixed(1)}s`, 'lg-sig');
      } else {
        status.textContent = `${fightTime.toFixed(1)}s\n${LSWS[ufPick].name}: ${Math.ceil(uf?.hp ?? 0)} hp\n${LSWS[collPick].name}: ${Math.ceil(coll?.hp ?? 0)} hp`;
      }
    }
  }

  function setActive(on: boolean): void {
    active = on;
    root.classList.toggle('hidden', !on);
    labCanvas.style.display = on ? 'block' : 'none';
    if (on) {
      ensureRenderer();
      if (!world) startFight();
    }
  }

  root.querySelector<HTMLButtonElement>('#mu-fight')!.onclick = startFight;

  return { tick, setActive, get active() { return active; } };
}
