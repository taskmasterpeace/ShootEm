// ---------------------------------------------------------------------------
// THE MAP MAKER — the harness's AAA map-editing tab. 2D top-down editor with
// the full terrain alphabet, surface paint, props, buildings, objectives,
// live law enforcement (the same six laws the suite enforces), undo, and a
// one-click 3D preview of the map you're actually editing.
// ---------------------------------------------------------------------------
import {
  loadFront, loadSkirmish, blankDoc, serializeDoc, deserializeDoc, validateDoc,
  paintTile, paintSurface, placeProp, erasePropAt,
  addControlPoint, addPickup, addPad, addMouth, moveObject, deleteObject, pickObject, objectPos,
  stamp, deleteHouse, undo, redo, buildingById,
  MAKER_TILES, MAKER_BUILDINGS,
  T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB,
  type MakerDoc, type LawReport, type MapJSON, type ObjectRef,
} from '../sim/mapedit';
import {
  GRID, TILE, WORLD,
  S_DIRT, S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
  type PropSpec, type PickupSpawn,
} from '../sim/map';
import { FRONTS } from '../client/campaign';
import type { MapSize } from '../sim/fronts';
import type { GameMap } from '../sim/map';
import type { VehicleKind } from '../sim/types';

// ---------------------------------------------------------------------------
// palette — reads EXACTLY like the atlas (same alphabet, same colors)
// ---------------------------------------------------------------------------
const TILE_COLORS: Record<number, string> = {
  [T_WALL]: '#282622', [T_METAL]: '#464a54', [T_COVER]: '#8c7846',
  [T_SLIT]: '#b4a05a', [T_DOOR]: '#be8c3c', [T_DOOR_OPEN]: '#d2aa5a',
  [T_WATER]: '#4882a0', [T_DEEP]: '#1e3e60', [T_LADDER]: '#dcc878', [T_CLIMB]: '#a05c30',
};
const SURF_TINT: Record<number, string> = {
  [S_DIRT]: '#6b5f4c', [S_GRASS]: '#56764a', [S_ICE]: '#bcd0d8',
  [S_GRIT]: '#7a6c58', [S_PLATE]: '#60646a', [S_WET]: '#466068', [S_MUD]: '#5e4e3a',
};
const SURF_NAMES: [number, string][] = [
  [S_DIRT, 'Dirt'], [S_GRASS, 'Grass'], [S_ICE, 'Ice'], [S_GRIT, 'Grit'], [S_PLATE, 'Plate'], [S_WET, 'Wet'], [S_MUD, 'Mud'],
];
const PROP_COLORS: Record<string, string> = {
  rock: '#9a9a94', tree: '#3e6e34', crate: '#a07c3c', wreck: '#b05c30',
  silo: '#c8ccd4', flare_stack: '#e8843c', crane: '#e8c83c', memorial: '#e8b83c',
  bunker: '#4a4640', clone_bay: '#3cbde8',
};
const PROP_KINDS: PropSpec['type'][] = ['rock', 'tree', 'crate', 'wreck', 'silo', 'flare_stack', 'crane', 'memorial', 'bunker', 'clone_bay'];
const PAD_KINDS: VehicleKind[] = ['tank', 'apc', 'buggy', 'bike', 'skiff', 'flyer', 'transport', 'ambulance', 'tunneler', 'mech', 'boat', 'emplacement'];
const PICKUP_KINDS: PickupSpawn['type'][] = ['medkit', 'ammo', 'energy', 'flamer'];

type Tool =
  | { kind: 'select' }
  | { kind: 'tile'; tile: number }
  | { kind: 'surface'; surf: number }
  | { kind: 'prop'; prop: PropSpec['type'] }
  | { kind: 'eraseProp' }
  | { kind: 'building'; id: string }
  | { kind: 'delHouse' }
  | { kind: 'addCP' }
  | { kind: 'addPickup'; pickup: PickupSpawn['type'] }
  | { kind: 'addPad'; pad: VehicleKind }
  | { kind: 'addMouth' };

interface Deps {
  /** hand a map to the 3D environment preview and show it */
  preview3D: (map: GameMap) => void;
}

export function mountMaker(root: HTMLElement, deps: Deps) {
  // ---- state -------------------------------------------------------------
  let doc: MakerDoc = loadFront('the_city', 4207, 'large');
  let tool: Tool = { kind: 'select' };
  let brush = 1;
  let sel: ObjectRef | null = null;
  let hover: [number, number] | null = null;
  let dragging = false;
  const showOrphans = true;
  let report: LawReport = validateDoc(doc);

  // ---- dom ----------------------------------------------------------------
  root.innerHTML = `
  <div id="mk-top">
    <select id="mk-front">
      <optgroup label="The ten fronts">${FRONTS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}</optgroup>
      <optgroup label="Skirmish — procedural">
        <option value="sk:savanna">🌍 Savanna farmstead</option>
        <option value="sk:titan">🪐 Titan colony</option>
        <option value="sk:starship">🚀 Starship deck</option>
        <option value="sk:europa">🌊 Europa domes</option>
        <option value="sk:triton">❄️ Triton station</option>
        <option value="sk:asteroid">☄️ Asteroid mine</option>
      </optgroup>
    </select>
    <select id="mk-size">
      <option value="small">small · ≤6/team</option>
      <option value="standard">standard · 7–9</option>
      <option value="large" selected>large · 10+</option>
    </select>
    <input type="number" id="mk-seed" value="4207" title="seed">
    <button class="mbtn" id="mk-load">Load</button>
    <button class="mbtn" id="mk-blank" title="sealed blank canvas at this tier">Blank</button>
    <span class="mk-sep"></span>
    <button class="mbtn" id="mk-undo" title="Ctrl+Z">↶ Undo</button>
    <button class="mbtn" id="mk-redo" title="Ctrl+Y">↷ Redo</button>
    <span class="mk-sep"></span>
    <button class="mbtn primary" id="mk-3d">◈ Preview 3D</button>
    <span id="mk-badge" title="the six front laws, live"></span>
  </div>
  <div id="mk-body">
    <div id="mk-canvas-wrap"><canvas id="mk-canvas"></canvas>
      <div id="mk-hint"></div>
    </div>
    <div id="mk-side">
      <div class="mk-sec"><h3>Objects</h3><div id="mk-objects"></div></div>
      <div class="mk-sec"><h3>Laws <span class="mk-sub">live</span></h3><div id="mk-laws"></div></div>
      <div class="mk-sec"><h3>File</h3>
        <div class="mk-filebtns">
          <button class="mbtn" id="mk-dl">⬇ Download</button>
          <button class="mbtn" id="mk-copy">⧉ Copy JSON</button>
        </div>
        <textarea id="mk-json" placeholder="paste a map JSON here and hit Import" spellcheck="false"></textarea>
        <div class="mk-filebtns">
          <button class="mbtn" id="mk-import">⇪ Import</button>
          <button class="mbtn" id="mk-restore" title="reload the autosave from this browser">Restore autosave</button>
        </div>
      </div>
    </div>
  </div>`;

  const canvas = root.querySelector<HTMLCanvasElement>('#mk-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const hintEl = root.querySelector<HTMLElement>('#mk-hint')!;
  const objectsEl = root.querySelector<HTMLElement>('#mk-objects')!;
  const lawsEl = root.querySelector<HTMLElement>('#mk-laws')!;
  const badgeEl = root.querySelector<HTMLElement>('#mk-badge')!;
  const frontSel = root.querySelector<HTMLSelectElement>('#mk-front')!;
  const sizeSel = root.querySelector<HTMLSelectElement>('#mk-size')!;
  const seedIn = root.querySelector<HTMLInputElement>('#mk-seed')!;
  frontSel.value = doc.frontId ?? 'the_city';

  // ---- tools are mounted into the LEFT harness panel (#mk-palette) --------
  const palHost = document.getElementById('mk-palette');
  if (palHost) {
    palHost.innerHTML = `
      <div class="mk-pal-group"><label>Tool</label><div class="grid" id="mk-tools-main"></div></div>
      <div class="mk-pal-group"><label>Terrain alphabet</label><div class="grid g3" id="mk-tools-tiles"></div></div>
      <div class="mk-pal-group"><label>Surface paint</label><div class="grid g3" id="mk-tools-surfs"></div></div>
      <div class="mk-pal-group"><label>Brush</label><div class="grid g3" id="mk-brushes"></div></div>
      <div class="mk-pal-group"><label>Props</label><div class="grid g3" id="mk-tools-props"></div></div>
      <div class="mk-pal-group"><label>Buildings (stamp)</label><select id="mk-bdef"></select>
        <button class="mbtn" id="mk-stamp" style="margin-top:4px">Stamp building</button>
        <button class="mbtn" id="mk-delhouse" style="margin-top:4px">✕ Delete a building…</button></div>
      <div class="mk-pal-group"><label>Add objective</label><div class="grid g3" id="mk-tools-objs"></div></div>`;
    const bdef = palHost.querySelector<HTMLSelectElement>('#mk-bdef')!;
    // the stamp shelf, grouped by function with biome-fit shown — the same
    // two axes the skirmish builder picks from
    const cats: [string, string][] = [['house', 'Houses'], ['commercial', 'Commercial'], ['industrial', 'Industrial'], ['military', 'Military'], ['ruin', 'Ruins']];
    bdef.innerHTML = cats.map(([kind, label]) => {
      const opts = MAKER_BUILDINGS.filter((b) => b.kind === kind)
        .map((b) => `<option value="${b.id}">${b.name}${b.biomes ? ' · ' + b.biomes.join(',') : ''}</option>`).join('');
      return opts ? `<optgroup label="${label}">${opts}</optgroup>` : '';
    }).join('');

    const mkBtn = (label: string, title: string, on: () => void, id?: string) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = label; b.title = title;
      if (id) b.dataset.toolid = id;
      b.onclick = () => { on(); refreshToolButtons(); };
      return b;
    };
    palHost.querySelector('#mk-tools-main')!.append(
      mkBtn('⇱ Select / move', 'click: pick object · drag: move · Del: delete', () => { tool = { kind: 'select' }; }, 'select'),
      mkBtn('⌫ Erase prop', 'click/drag: remove props and open their tiles', () => { tool = { kind: 'eraseProp' }; }, 'eraseProp'),
    );
    const tilesHost = palHost.querySelector('#mk-tools-tiles')!;
    for (const t of MAKER_TILES) tilesHost.append(mkBtn(t.name, t.hint, () => { tool = { kind: 'tile', tile: t.id }; }, `tile-${t.id}`));
    const surfsHost = palHost.querySelector('#mk-tools-surfs')!;
    for (const [id, name] of SURF_NAMES) surfsHost.append(mkBtn(name, `paint ${name.toLowerCase()} ground`, () => { tool = { kind: 'surface', surf: id }; }, `surf-${id}`));
    const brushHost = palHost.querySelector('#mk-brushes')!;
    for (const s of [1, 3, 5]) brushHost.append(mkBtn(`${s}×${s}`, 'brush size', () => { brush = s; }, `brush-${s}`));
    const propsHost = palHost.querySelector('#mk-tools-props')!;
    for (const p of PROP_KINDS) propsHost.append(mkBtn(p.replace('_', ' '), `place ${p}`, () => { tool = { kind: 'prop', prop: p }; }, `prop-${p}`));
    palHost.querySelector<HTMLButtonElement>('#mk-stamp')!.onclick = () => { tool = { kind: 'building', id: bdef.value }; refreshToolButtons(); };
    palHost.querySelector<HTMLButtonElement>('#mk-delhouse')!.onclick = () => { tool = { kind: 'delHouse' }; refreshToolButtons(); };
    const objsHost = palHost.querySelector('#mk-tools-objs')!;
    objsHost.append(mkBtn('CP', 'add control point', () => { tool = { kind: 'addCP' }; }, 'add-cp'));
    for (const p of PICKUP_KINDS) objsHost.append(mkBtn(p, `add ${p} drop`, () => { tool = { kind: 'addPickup', pickup: p }; }, `add-pickup-${p}`));
    objsHost.append(mkBtn('mouth', 'add quarantine mouth', () => { tool = { kind: 'addMouth' }; }, 'add-mouth'));
    const padSel = document.createElement('select');
    padSel.innerHTML = PAD_KINDS.map((k) => `<option>${k}</option>`).join('');
    padSel.onchange = () => { tool = { kind: 'addPad', pad: padSel.value as VehicleKind }; refreshToolButtons(); };
    objsHost.append(padSel);
  }

  function refreshToolButtons() {
    document.querySelectorAll<HTMLButtonElement>('#mk-palette [data-toolid]').forEach((b) => {
      const id = b.dataset.toolid!;
      const active =
        (id === 'select' && tool.kind === 'select') ||
        (id === 'eraseProp' && tool.kind === 'eraseProp') ||
        (id.startsWith('tile-') && tool.kind === 'tile' && tool.tile === Number(id.slice(5))) ||
        (id.startsWith('surf-') && tool.kind === 'surface' && tool.surf === Number(id.slice(5))) ||
        (id.startsWith('brush-') && brush === Number(id.slice(6))) ||
        (id.startsWith('prop-') && tool.kind === 'prop' && tool.prop === id.slice(5)) ||
        (id === 'add-cp' && tool.kind === 'addCP') ||
        (id.startsWith('add-pickup-') && tool.kind === 'addPickup' && tool.pickup === id.slice(11)) ||
        (id === 'add-mouth' && tool.kind === 'addMouth');
      b.classList.toggle('active', active);
    });
  }

  // ---- rendering -----------------------------------------------------------
  let px = 6; // pixels per tile
  function fit() {
    const wrap = root.querySelector<HTMLElement>('#mk-canvas-wrap')!;
    const s = Math.floor(Math.min(wrap.clientWidth, wrap.clientHeight - 24) / GRID);
    px = Math.max(3, s);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${GRID * px}px`;
    canvas.style.height = `${GRID * px}px`;
    canvas.width = GRID * px * dpr;
    canvas.height = GRID * px * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    const m = doc.map;
    ctx.clearRect(0, 0, GRID * px, GRID * px);
    // ground: terrain alphabet over surface tints
    for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
      const t = m.grid[z * GRID + x];
      ctx.fillStyle = TILE_COLORS[t] ?? SURF_TINT[m.surface[z * GRID + x]] ?? '#50504a';
      ctx.fillRect(x * px, z * px, px + 0.5, px + 0.5);
    }
    // orphan heat (the loupe's red)
    if (showOrphans) {
      ctx.fillStyle = 'rgba(220,40,40,0.55)';
      for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
        const i = z * GRID + x;
        if (report.seen[i] === 0 && m.grid[i] !== T_WALL && m.grid[i] !== T_METAL && m.grid[i] !== T_COVER
          && m.grid[i] !== T_SLIT && m.grid[i] !== T_CLIMB) {
          ctx.fillRect(x * px, z * px, px + 0.5, px + 0.5);
        }
      }
    }
    // houses: roof rect + door
    ctx.setLineDash([3, 2]);
    for (const h of m.houses) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(h.tx * px - 0.5, h.tz * px - 0.5, h.tw * px + 1, h.th * px + 1);
      const [dx, dz] = w2t(h.door.x, h.door.z);
      dot(dx, dz, '#e8e8e8', 1.6);
    }
    ctx.setLineDash([]);
    // grid every 10
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i <= GRID; i += 10) {
      line(i * px, 0, i * px, GRID * px);
      line(0, i * px, GRID * px, i * px);
    }
    // props
    for (const p of m.props) {
      const [tx, tz] = w2t(p.pos.x, p.pos.z);
      dot(tx, tz, PROP_COLORS[p.type] ?? '#ccc', p.type === 'crate' ? 1.4 : 2);
    }
    // pickups: letter tiles
    for (const p of m.pickups) {
      const [tx, tz] = w2t(p.pos.x, p.pos.z);
      letter(tx, tz, p.type[0].toUpperCase(), '#d8e858');
    }
    // zombie mouths
    for (const zp of m.zombieSpawns) {
      const [tx, tz] = w2t(zp.x, zp.z);
      dot(tx, tz, '#e84c3d', 2);
    }
    // vehicle pads: team ring + kind letter
    for (const v of m.vehiclePads) {
      const [tx, tz] = w2t(v.pos.x, v.pos.z);
      ringAt(tx, tz, v.team === 0 ? '#e8a33d' : '#3dbde8');
      letter(tx, tz, v.kind[0].toUpperCase(), v.team === 0 ? '#e8a33d' : '#3dbde8');
    }
    // control points + hill
    for (const c of m.controlPoints) {
      const [tx, tz] = w2t(c.pos.x, c.pos.z);
      letter(tx, tz, c.name[0], '#ffffff', true);
    }
    {
      const [tx, tz] = w2t(m.hillPos.x, m.hillPos.z);
      ringAt(tx, tz, '#e8a33d', 2.4);
      letter(tx, tz, 'H', '#e8a33d', true);
    }
    // bases
    m.basePos.forEach((b, team) => {
      const [tx, tz] = w2t(b.x, b.z);
      ringAt(tx, tz, team === 0 ? '#e8a33d' : '#3dbde8', 3);
      letter(tx, tz, team === 0 ? 'W' : 'E', team === 0 ? '#e8a33d' : '#3dbde8', true);
    });
    // selection
    if (sel) {
      const p = objectPos(doc, sel);
      const [tx, tz] = w2t(p.x, p.z);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx * px - 2, tz * px - 2, px + 4, px + 4);
    }
    // hover
    if (hover) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1;
      const r = Math.floor(brush / 2);
      const wpx = (tool.kind === 'tile' || tool.kind === 'surface') ? brush * px : px;
      ctx.strokeRect((hover[0] - (tool.kind === 'tile' || tool.kind === 'surface' ? r : 0)) * px, (hover[1] - (tool.kind === 'tile' || tool.kind === 'surface' ? r : 0)) * px, wpx, wpx);
    }
  }

  const w2t = (x: number, z: number): [number, number] =>
    [Math.floor((x + WORLD / 2) / TILE), Math.floor((z + WORLD / 2) / TILE)];
  function dot(tx: number, tz: number, color: string, r = 2) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc((tx + 0.5) * px, (tz + 0.5) * px, r * (px / 4 + 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  function ringAt(tx: number, tz: number, color: string, r = 2) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc((tx + 0.5) * px, (tz + 0.5) * px, r * (px / 4 + 1.4), 0, Math.PI * 2);
    ctx.stroke();
  }
  function letter(tx: number, tz: number, ch: string, color: string, bold = false) {
    ctx.fillStyle = color;
    ctx.font = `${bold ? '700' : '600'} ${Math.max(8, px * 1.4)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, (tx + 0.5) * px, (tz + 0.55) * px);
  }
  function line(x0: number, y0: number, x1: number, y1: number) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }

  // ---- objects list + laws -------------------------------------------------
  function refreshSide() {
    const m = doc.map;
    const row = (label: string, ref: ObjectRef | null, del: (() => void) | null, jump: () => void) => {
      const div = document.createElement('div');
      div.className = 'mk-obj';
      const a = document.createElement('span');
      a.textContent = label;
      a.onclick = jump;
      if (ref && sel && JSON.stringify(sel) === JSON.stringify(ref)) div.classList.add('sel');
      div.appendChild(a);
      if (del) {
        const x = document.createElement('button');
        x.textContent = '✕'; x.title = 'delete';
        x.onclick = del;
        div.appendChild(x);
      }
      return div;
    };
    objectsEl.innerHTML = '';
    const jumpTo = (p: { x: number; z: number }) => () => { hover = w2t(p.x, p.z); draw(); };
    objectsEl.append(
      row(`⚑ Base West`, { kind: 'base', team: 0 }, null, jumpTo(m.basePos[0])),
      row(`⚑ Base East`, { kind: 'base', team: 1 }, null, jumpTo(m.basePos[1])),
      row(`◆ Hill`, { kind: 'hill' }, null, jumpTo(m.hillPos)),
    );
    m.controlPoints.forEach((c, i) => objectsEl.append(row(`◇ CP ${c.name}`, { kind: 'cp', index: i },
      () => { deleteObject(doc, { kind: 'cp', index: i }); afterOp(); }, jumpTo(c.pos))));
    m.pickups.forEach((p, i) => objectsEl.append(row(`+ ${p.type}`, { kind: 'pickup', index: i },
      () => { deleteObject(doc, { kind: 'pickup', index: i }); afterOp(); }, jumpTo(p.pos))));
    m.vehiclePads.forEach((v, i) => objectsEl.append(row(`▣ ${v.kind} (t${v.team})`, { kind: 'pad', index: i },
      () => { deleteObject(doc, { kind: 'pad', index: i }); afterOp(); }, jumpTo(v.pos))));
    m.zombieSpawns.forEach((zp, i) => objectsEl.append(row(`☠ mouth ${i}`, { kind: 'mouth', index: i },
      () => { deleteObject(doc, { kind: 'mouth', index: i }); afterOp(); }, jumpTo(zp))));
    m.houses.forEach((h, i) => objectsEl.append(row(`⌂ bldg ${i} (${h.tw}×${h.th}${h.floors === 2 ? ', 2F' : ''})`, null,
      () => { deleteHouse(doc, i); afterOp(); }, jumpTo(h.center))));

    // laws
    lawsEl.innerHTML = '';
    if (report.ok) {
      lawsEl.innerHTML = '<div class="mk-law ok">✓ ALL SIX LAWS HOLD — sealed rim · zero orphans · readable · enterable · indoors · walls</div>';
    } else {
      for (const issue of report.issues) {
        const div = document.createElement('div');
        div.className = 'mk-law bad';
        div.innerHTML = `<b>✕ ${issue.law}</b> ${issue.detail}`;
        if (issue.tiles.length) {
          div.onclick = () => { hover = issue.tiles[0]; draw(); };
          div.title = 'jump to the first offending tile';
        }
        lawsEl.appendChild(div);
      }
    }
    badgeEl.textContent = report.ok ? '✓ laws' : `✕ ${report.issues.length}`;
    badgeEl.className = report.ok ? 'ok' : 'bad';
  }

  // ---- ops + persistence ----------------------------------------------------
  let lawTimer = 0;
  function afterOp() {
    sel = null;
    draw();
    clearTimeout(lawTimer);
    lawTimer = window.setTimeout(() => {
      report = validateDoc(doc);
      refreshSide();
      try { localStorage.setItem('ww_maker_autosave', JSON.stringify(serializeDoc(doc))); } catch { /* quota — dev tool */ }
    }, 160);
  }

  function loadInto(frontId: string, size: MapSize, seed: number) {
    doc = loadFront(frontId, seed, size);
    sel = null;
    report = validateDoc(doc);
    afterOp();
  }

  // ---- canvas mouse ---------------------------------------------------------
  const tileAtEvent = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(GRID - 1, Math.floor((e.clientX - r.left) / px))),
      Math.max(0, Math.min(GRID - 1, Math.floor((e.clientY - r.top) / px))),
    ];
  };
  const w = (tx: number, tz: number) => ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

  canvas.addEventListener('mousedown', (e) => {
    const [tx, tz] = tileAtEvent(e);
    dragging = true;
    if (tool.kind === 'select') {
      const wp = w(tx, tz);
      sel = pickObject(doc, wp.x, wp.z);
      if (!sel) { // maybe a house door / center — houses are selectable via the list only
        draw();
        return;
      }
      refreshSide();
      draw();
      return;
    }
    applyTool(tx, tz);
  });
  canvas.addEventListener('mousemove', (e) => {
    const [tx, tz] = tileAtEvent(e);
    if (!dragging) { hover = [tx, tz]; updateHint(tx, tz); draw(); return; }
    if (tool.kind === 'select') {
      if (sel) { moveObject(doc, sel, tx, tz); draw(); }
      return;
    }
    applyTool(tx, tz);
  });
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; afterOp(); } });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });

  function applyTool(tx: number, tz: number) {
    switch (tool.kind) {
      case 'tile': paintTile(doc, tx, tz, tool.tile, brush); break;
      case 'surface': paintSurface(doc, tx, tz, tool.surf, brush); break;
      case 'prop': placeProp(doc, tool.prop, tx, tz, 1, Math.random() * Math.PI * 2); break;
      case 'eraseProp': erasePropAt(doc, tx, tz); break;
      case 'building': {
        const def = buildingById(tool.id);
        if (!stamp(doc, def, tx, tz)) flashHint(`no room for ${def.name} there`);
        break;
      }
      case 'delHouse': {
        const i = doc.map.houses.findIndex((h) => tx >= h.tx && tx < h.tx + h.tw && tz >= h.tz && tz < h.tz + h.th);
        if (i >= 0) deleteHouse(doc, i);
        break;
      }
      case 'addCP': addControlPoint(doc, tx, tz); break;
      case 'addPickup': addPickup(doc, tool.pickup, tx, tz); break;
      case 'addPad': addPad(doc, tool.pad, tx, tz); break;
      case 'addMouth': addMouth(doc, tx, tz); break;
      case 'select': break;
    }
    draw();
  }

  function updateHint(tx: number, tz: number) {
    const t = doc.map.grid[tz * GRID + tx];
    const tName = MAKER_TILES.find((x) => x.id === t)?.name ?? `T${t}`;
    const sName = SURF_NAMES.find(([id]) => id === doc.map.surface[tz * GRID + tx])?.[1] ?? '';
    const hi = doc.map.houses.findIndex((h) => tx >= h.tx && tx < h.tx + h.tw && tz >= h.tz && tz < h.tz + h.th);
    hintEl.textContent = `(${tx},${tz}) ${tName}${sName ? ' · ' + sName : ''}${hi >= 0 ? ` · building ${hi}` : ''} — ${toolLabel()}`;
  }
  function toolLabel(): string {
    const t = tool; // a local const keeps the discriminated-union narrowing alive inside closures
    switch (t.kind) {
      case 'select': return 'select/move';
      case 'tile': return `paint ${MAKER_TILES.find((x) => x.id === t.tile)?.name}`;
      case 'surface': return `paint surface`;
      case 'prop': return `place ${t.prop}`;
      case 'eraseProp': return 'erase props';
      case 'building': return `stamp ${buildingById(t.id).name}`;
      case 'delHouse': return 'click a building to delete it';
      case 'addCP': return 'add control point';
      case 'addPickup': return `add ${t.pickup}`;
      case 'addPad': return `add ${t.pad} pad`;
      case 'addMouth': return 'add quarantine mouth';
    }
  }
  function flashHint(msg: string) {
    hintEl.textContent = `⚠ ${msg}`;
    setTimeout(() => { if (hover) updateHint(hover[0], hover[1]); }, 1600);
  }

  // ---- top bar wiring --------------------------------------------------------
  root.querySelector<HTMLButtonElement>('#mk-load')!.onclick = () => {
    const v = frontSel.value;
    if (v.startsWith('sk:')) {
      doc = loadSkirmish(v.slice(3) as import('../sim/types').ThemeId, Number(seedIn.value) >>> 0);
      sel = null; report = validateDoc(doc); afterOp();
    } else {
      loadInto(v, sizeSel.value as MapSize, Number(seedIn.value) >>> 0);
    }
  };
  root.querySelector<HTMLButtonElement>('#mk-blank')!.onclick = () => {
    doc = blankDoc(sizeSel.value as MapSize, Number(seedIn.value) >>> 0);
    sel = null; report = validateDoc(doc); afterOp();
  };
  root.querySelector<HTMLButtonElement>('#mk-undo')!.onclick = () => { if (undo(doc)) { report = validateDoc(doc); afterOp(); } };
  root.querySelector<HTMLButtonElement>('#mk-redo')!.onclick = () => { if (redo(doc)) { report = validateDoc(doc); afterOp(); } };
  root.querySelector<HTMLButtonElement>('#mk-3d')!.onclick = () => deps.preview3D(doc.map);
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.mode !== 'maker') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); if (undo(doc)) { report = validateDoc(doc); afterOp(); } }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); if (redo(doc)) { report = validateDoc(doc); afterOp(); } }
    if (e.key === 'Delete' && sel) { deleteObject(doc, sel); afterOp(); }
  });

  // ---- file ------------------------------------------------------------------
  root.querySelector<HTMLButtonElement>('#mk-dl')!.onclick = () => {
    const blob = new Blob([JSON.stringify(serializeDoc(doc))], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.frontId ?? 'custom'}.${doc.size}.map.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  root.querySelector<HTMLButtonElement>('#mk-copy')!.onclick = async () => {
    await navigator.clipboard.writeText(JSON.stringify(serializeDoc(doc)));
    flashHint('map JSON copied to the clipboard');
  };
  root.querySelector<HTMLButtonElement>('#mk-import')!.onclick = () => {
    try {
      const json = JSON.parse(root.querySelector<HTMLTextAreaElement>('#mk-json')!.value) as MapJSON;
      doc = deserializeDoc(json);
      sel = null; report = validateDoc(doc); afterOp();
    } catch (err) {
      flashHint(`import failed: ${(err as Error).message}`);
    }
  };
  root.querySelector<HTMLButtonElement>('#mk-restore')!.onclick = () => {
    const raw = localStorage.getItem('ww_maker_autosave');
    if (!raw) { flashHint('no autosave yet'); return; }
    try {
      doc = deserializeDoc(JSON.parse(raw) as MapJSON);
      sel = null; report = validateDoc(doc); afterOp();
    } catch (err) {
      flashHint(`autosave is unreadable: ${(err as Error).message}`);
    }
  };

  // ---- go ---------------------------------------------------------------------
  refreshToolButtons();
  refreshSide();
  fit();
  new ResizeObserver(fit).observe(root.querySelector<HTMLElement>('#mk-canvas-wrap')!);
  afterOp();
}
