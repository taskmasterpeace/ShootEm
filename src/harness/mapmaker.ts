// ---------------------------------------------------------------------------
// THE MAP MAKER — the harness's AAA map-editing tab. 2D top-down editor with
// the full terrain alphabet, surface paint, props, buildings, objectives,
// live law enforcement (the same six laws the suite enforces), undo, and a
// one-click 3D preview of the map you're actually editing.
// ---------------------------------------------------------------------------
import {
  loadFront, loadSkirmish, loadTheater, blankDoc, serializeDoc, deserializeDoc, validateDoc,
  paintTile, paintFloorTile, paintSurface, placeProp, erasePropAt,
  addControlPoint, addPickup, addPad, addMouth, moveObject, deleteObject, pickObject, objectPos,
  stamp, deleteHouse, undo, redo, buildingById,
  MAKER_TILES, MAKER_BUILDINGS,
  T_WALL, T_COVER, T_WATER, T_DEEP, T_SLIT, T_DOOR, T_DOOR_OPEN, T_METAL, T_LADDER, T_CLIMB,
  T_THIN_WALL_H, T_THIN_WALL_V, T_THIN_DOOR_H, T_THIN_DOOR_V, T_WINDOW_H, T_WINDOW_V,
  T_STAIRS_N, T_STAIRS_E, T_STAIRS_S, T_STAIRS_W, T_SECTION_SHUTTER,
  type MakerDoc, type LawReport, type MapJSON, type ObjectRef,
} from '../sim/mapedit';
import {
  F2_VOID, F2_FLOOR, F2_WALL, F2_THIN_WALL_H, F2_THIN_WALL_V, F2_DOOR_H, F2_DOOR_V,
  F2_WINDOW_H, F2_WINDOW_V, F2_WELL, F2_BALCONY, F2_STAIR_N, F2_STAIR_E, F2_STAIR_S, F2_STAIR_W, F2_SHUTTER,
  S_DIRT, S_GRASS, S_ICE, S_GRIT, S_PLATE, S_WET, S_MUD,
  type PropSpec, type PickupSpawn,
} from '../sim/map';
import { tileToWorld, worldToTile, worldDepth, worldWidth } from '../sim/map-geometry';
import { FRONTS } from '../client/campaign';
import { frontWalkable, type MapSize } from '../sim/fronts';
import type { GameMap } from '../sim/map';
import type { VehicleKind } from '../sim/types';
import { floorLayer } from '../sim/map-layers';
import { COUNTRY_MAP_PROFILES, citiesForCountry, type CityMapProfile } from '../sim/city-profile';
import { BUILDING_ARCHETYPES, generateCityBuilding, type BuildingArchetype, type BuildingSocket, type BuildingUse } from '../sim/building-generator';
import { buildingAuthoringLayoutFromMap, validateWholeBuilding } from '../sim/building-navigation';
import { generateScienceMission, type ScienceMissionSpec, type ScienceSite } from '../sim/science';
import { generateScienceOperationGraph, validateScienceOperationGraph, type ScienceOperationGraph } from '../sim/science-operation';

export interface GenerateBuildingDocOptions {
  cityId: string;
  archetype: BuildingArchetype;
  floors: 1 | 2 | 3;
  seed: number;
  prints?: number;
  missionSection?: 'west' | 'east' | 'single-choke';
}

export interface MapMakerArchetypeGroup {
  use: BuildingUse;
  label: string;
  options: BuildingArchetype[];
}

const ARCHETYPE_GROUPS: MapMakerArchetypeGroup[] = [
  { use: 'residential', label: 'Residential', options: ['cottage', 'row-house', 'apartment', 'command-villa'] },
  { use: 'commercial', label: 'Commercial', options: ['storefront', 'office', 'mall-section', 'hotel'] },
  { use: 'industrial', label: 'Industrial', options: ['workshop', 'factory', 'depot', 'processing-hall'] },
  { use: 'civic', label: 'Civic / Science', options: ['clinic', 'research-annex', 'government-office'] },
  { use: 'military', label: 'Military', options: ['barracks', 'armory', 'command-post', 'secure-archive'] },
];

export function mapMakerCityOptions(countryCode: string): readonly CityMapProfile[] {
  return citiesForCountry(countryCode);
}

export function mapMakerArchetypeOptions(): readonly MapMakerArchetypeGroup[] {
  return ARCHETYPE_GROUPS;
}

export function floorTabs(doc: MakerDoc): { floor: number; label: string }[] {
  const count = doc.map.buildingMeta?.floors ?? Math.min(3, 1 + (doc.map.upperLayers?.length ?? (doc.map.grid2.some(Boolean) ? 1 : 0)));
  return Array.from({ length: count }, (_, floor) => ({ floor, label: floor === 0 ? 'Ground' : `L${floor + 1}` }));
}

export function canLaunchOperation(doc: MakerDoc): boolean {
  const source = buildingAuthoringLayoutFromMap(doc.map);
  return !!source && validateWholeBuilding(source.layout).ok && validateDoc(doc).ok;
}

export function mapMakerImportNotice(json: { v?: number }): string | null {
  return json.v === 1 ? 'Legacy v1 map upgraded to indexed floor layers.' : null;
}

export interface MapMakerOperationOverlay {
  graph: ScienceOperationGraph;
  guardCount: number;
  armorPolicy: 'NONE';
  weaponProfile: 'PISTOLS / SMGS';
}

const authoredSocketWorld = (doc: MakerDoc, socket: BuildingSocket) => {
  const origin = doc.map.buildingMeta!.origin!;
  const pos = tileToWorld(doc.map.geometry, origin.tx + socket.x, origin.tz + socket.z);
  return {
    x: pos.x,
    y: socket.floor * 4,
    z: pos.z,
  };
};

/** Compile the editor's current document through the runtime graph generator. */
export function mapMakerOperationOverlay(doc: MakerDoc): MapMakerOperationOverlay | null {
  const meta = doc.map.buildingMeta;
  if (!meta?.origin || !meta.sockets?.length || !buildingAuthoringLayoutFromMap(doc.map)) return null;
  const allSockets = meta.sockets;
  const sockets = (kind: BuildingSocket['kind']) =>
    allSockets.filter((socket) => socket.kind === kind).map((socket) => authoredSocketWorld(doc, socket));
  const entry = sockets('entry')[0];
  const extraction = sockets('exit')[0];
  const objectives = sockets('objective');
  const guardPosts = sockets('guard');
  const reinforcementPosts = sockets('reinforcement');
  if (!entry || !extraction || !objectives.length || !guardPosts.length) return null;
  try {
    const graph = generateScienceOperationGraph({
      seed: doc.seed,
      map: doc.map,
      entry,
      extraction,
      objectives,
      guardPosts,
      reinforcementPosts: reinforcementPosts.length ? reinforcementPosts : [entry, extraction],
    });
    if (validateScienceOperationGraph(graph).length) return null;
    return { graph, guardCount: Math.min(7, Math.max(3, guardPosts.length)), armorPolicy: 'NONE', weaponProfile: 'PISTOLS / SMGS' };
  } catch {
    return null;
  }
}

export function mapMakerOperationSummaryHTML(overlay: MapMakerOperationOverlay): string {
  const metrics = overlay.graph.metrics;
  return `<div class="mk-operation-legend" aria-label="Operation graph legend">
    <label><input type="checkbox" data-operation-layer="critical" checked><i class="critical"></i>CRITICAL ROUTE</label>
    <label><input type="checkbox" data-operation-layer="patrols" checked><i class="patrols"></i>PATROLS</label>
    <label><input type="checkbox" data-operation-layer="reports" checked><i class="reports"></i>REPORT NODES</label>
    <label><input type="checkbox" data-operation-layer="response" checked><i class="response"></i>RESPONSE ROUTES</label>
  </div><div class="mk-operation-metrics">
    <span>ROOMS <b>${metrics.rooms}</b></span><span>EDGES <b>${metrics.edges}</b></span><span>LOOPS <b>${metrics.loops}</b></span>
    <span>CRITICAL <b>${metrics.criticalPoints}</b></span><span>PATROLS <b>${metrics.patrols}</b></span><span>REPORTS <b>${metrics.reports}</b></span>
    <span>GUARDS <b>${overlay.guardCount}</b></span><span>ARMOR <b>${overlay.armorPolicy}</b></span><span>WEAPONS <b>${overlay.weaponProfile}</b></span>
  </div>`;
}

/** Compile the drafting controls into the exact same document the canvas,
 * validator, serializer, 3D preview, and science runtime consume. */
export function generateBuildingDoc(options: GenerateBuildingDocOptions): MakerDoc {
  const generated = generateCityBuilding(options);
  const doc = blankDoc('small', options.seed);
  const tx = Math.floor((doc.map.geometry.cols - generated.width) / 2);
  const tz = Math.floor((doc.map.geometry.rows - generated.height) / 2);
  if (!stamp(doc, generated.def, tx, tz)) throw new Error('generated building did not fit the authoring canvas');
  doc.mode = 'science';
  doc.frontId = null;
  doc.map.buildingMeta = {
    ...generated.provenance,
    floors: generated.floors,
    footprint: generated.footprint,
    origin: { tx, tz },
    width: generated.width,
    height: generated.height,
    sockets: generated.sockets,
    sections: generated.sections,
  };
  return doc;
}

export const MAP_MAKER_COUNTRIES = COUNTRY_MAP_PROFILES;
export const MAP_MAKER_ARCHETYPES = BUILDING_ARCHETYPES;
import { THEATER_DEFS } from '../sim/theaters';
import type { TheaterId } from '../sim/theater-types';

// ---------------------------------------------------------------------------
// palette — reads EXACTLY like the atlas (same alphabet, same colors)
// ---------------------------------------------------------------------------
const TILE_COLORS: Record<number, string> = {
  [T_WALL]: '#282622', [T_METAL]: '#464a54', [T_COVER]: '#8c7846',
  [T_SLIT]: '#b4a05a', [T_DOOR]: '#be8c3c', [T_DOOR_OPEN]: '#d2aa5a',
  [T_WATER]: '#4882a0', [T_DEEP]: '#1e3e60', [T_LADDER]: '#dcc878', [T_CLIMB]: '#a05c30',
  [T_THIN_WALL_H]: '#d69b4f', [T_THIN_WALL_V]: '#d69b4f',
  [T_THIN_DOOR_H]: '#ead09b', [T_THIN_DOOR_V]: '#ead09b',
  [T_WINDOW_H]: '#43cedc', [T_WINDOW_V]: '#43cedc',
  [T_STAIRS_N]: '#72d8e5', [T_STAIRS_E]: '#72d8e5', [T_STAIRS_S]: '#72d8e5', [T_STAIRS_W]: '#72d8e5',
  [T_SECTION_SHUTTER]: '#df5c52',
};
const UPPER_TILE_COLORS: Record<number, string> = {
  [F2_VOID]: '#11151a', [F2_FLOOR]: '#343a3e', [F2_WALL]: '#ca8a42',
  [F2_THIN_WALL_H]: '#d79a52', [F2_THIN_WALL_V]: '#d79a52',
  [F2_DOOR_H]: '#ead09b', [F2_DOOR_V]: '#ead09b',
  [F2_WINDOW_H]: '#42cfdd', [F2_WINDOW_V]: '#42cfdd', [F2_WELL]: '#75d5e6',
  [F2_BALCONY]: '#d8d0b8', [F2_STAIR_N]: '#70d9e8', [F2_STAIR_E]: '#70d9e8',
  [F2_STAIR_S]: '#70d9e8', [F2_STAIR_W]: '#70d9e8', [F2_SHUTTER]: '#df5c52',
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
const PAD_KINDS: VehicleKind[] = [
  'tank', 'apc', 'buggy', 'bike', 'skiff', 'flyer', 'attackheli', 'transportheli',
  'strikejet', 'interceptor', 'bomber', 'aatrack', 'transport', 'ambulance',
  'tunneler', 'mech', 'boat', 'submarine', 'emplacement',
];
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
  launchScience?: (spec: ScienceMissionSpec) => void;
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
  let activeFloor = 0;
  let exploded = false;
  let showOperations = true;
  let operationOverlay: MapMakerOperationOverlay | null = null;
  const operationLayers = { critical: true, patrols: true, reports: true, response: true };

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
      <optgroup label="Vehicle theaters">${Object.values(THEATER_DEFS).map((theater) => `<option value="th:${theater.id}">${theater.name} · ${theater.id}</option>`).join('')}</optgroup>
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
  <section id="mk-draft" aria-label="City building generator">
    <div class="mk-draft-title"><span>WHOLE BUILDING</span><strong>City Grammar</strong></div>
    <label>Country<select id="mk-country">${MAP_MAKER_COUNTRIES.filter((country) => mapMakerCityOptions(country.code).length).map((country) => `<option value="${country.code}">${country.name}</option>`).join('')}</select></label>
    <label>City<select id="mk-city"></select></label>
    <label>Structure<select id="mk-archetype">${ARCHETYPE_GROUPS.map((group) => `<optgroup label="${group.label}">${group.options.map((id) => `<option value="${id}">${id.replaceAll('-', ' ')}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <label>Storeys<select id="mk-floors"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option></select></label>
    <label>Print reserve<input id="mk-prints" type="number" min="1" max="8" value="4"></label>
    <button class="mbtn primary mk-action" id="mk-generate">Generate building</button>
    <button class="mbtn" id="mk-explode" aria-pressed="false">Exploded view</button>
    <button class="mbtn mk-launch" id="mk-launch" disabled>Launch Science Operation</button>
    <div id="mk-provenance" role="status"></div>
  </section>
  <div id="mk-floorbar"><div id="mk-floor-tabs" role="tablist" aria-label="Building floor"></div><label><input id="mk-operations" type="checkbox" checked> Operation overlay</label></div>
  <div id="mk-body">
    <div id="mk-canvas-wrap"><canvas id="mk-canvas"></canvas>
      <div id="mk-hint"></div>
    </div>
    <div id="mk-side">
      <div class="mk-sec mk-operation-card"><h3>Operation Graph <span class="mk-sub">runtime-authored</span></h3><div id="mk-operation-panel"></div></div>
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
  const countrySel = root.querySelector<HTMLSelectElement>('#mk-country')!;
  const citySel = root.querySelector<HTMLSelectElement>('#mk-city')!;
  const archetypeSel = root.querySelector<HTMLSelectElement>('#mk-archetype')!;
  const floorsSel = root.querySelector<HTMLSelectElement>('#mk-floors')!;
  const printsIn = root.querySelector<HTMLInputElement>('#mk-prints')!;
  const floorTabsEl = root.querySelector<HTMLElement>('#mk-floor-tabs')!;
  const provenanceEl = root.querySelector<HTMLElement>('#mk-provenance')!;
  const launchBtn = root.querySelector<HTMLButtonElement>('#mk-launch')!;
  const operationEl = root.querySelector<HTMLElement>('#mk-operation-panel')!;
  frontSel.value = doc.frontId ?? 'the_city';

  function refreshCityOptions() {
    const cities = mapMakerCityOptions(countrySel.value);
    citySel.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name} · ${city.populationType}</option>`).join('');
  }

  function refreshFloorTabs() {
    const tabs = floorTabs(doc);
    activeFloor = Math.min(activeFloor, tabs.length - 1);
    floorTabsEl.innerHTML = '';
    for (const tab of tabs) {
      const button = document.createElement('button');
      button.className = `mk-floor-tab${activeFloor === tab.floor ? ' active' : ''}`;
      button.textContent = tab.label;
      button.role = 'tab';
      button.ariaSelected = String(activeFloor === tab.floor);
      button.onclick = () => { activeFloor = tab.floor; refreshFloorTabs(); draw(); };
      floorTabsEl.appendChild(button);
    }
    const meta = doc.map.buildingMeta;
    provenanceEl.textContent = meta
      ? `${meta.cityId} · ${meta.archetype.replaceAll('-', ' ')} · ${meta.floors}F · seed ${meta.seed ?? doc.seed} · grammar v${meta.grammarVersion}`
      : 'No city grammar provenance on this map.';
    launchBtn.disabled = !canLaunchOperation(doc);
  }

  function refreshOperationPanel() {
    operationOverlay = mapMakerOperationOverlay(doc);
    if (!operationOverlay) {
      operationEl.innerHTML = '<p class="mk-operation-empty">Generate a valid whole building to compile patrols, reports, and response routes.</p>';
      return;
    }
    operationEl.innerHTML = mapMakerOperationSummaryHTML(operationOverlay);
    operationEl.querySelectorAll<HTMLInputElement>('[data-operation-layer]').forEach((input) => {
      const layer = input.dataset.operationLayer as keyof typeof operationLayers;
      input.checked = operationLayers[layer];
      input.onchange = () => { operationLayers[layer] = input.checked; draw(); };
    });
  }

  function upperTileFor(tile: number): number {
    const mapping: Record<number, number> = {
      [0]: F2_FLOOR, [T_WALL]: F2_WALL, [T_METAL]: F2_WALL, [T_COVER]: F2_BALCONY,
      [T_SLIT]: F2_WINDOW_H, [T_DOOR]: F2_DOOR_H, [T_LADDER]: F2_WELL,
      [T_THIN_WALL_H]: F2_THIN_WALL_H, [T_THIN_WALL_V]: F2_THIN_WALL_V,
      [T_THIN_DOOR_H]: F2_DOOR_H, [T_THIN_DOOR_V]: F2_DOOR_V,
      [T_WINDOW_H]: F2_WINDOW_H, [T_WINDOW_V]: F2_WINDOW_V,
      [T_STAIRS_N]: F2_STAIR_N, [T_STAIRS_E]: F2_STAIR_E,
      [T_STAIRS_S]: F2_STAIR_S, [T_STAIRS_W]: F2_STAIR_W,
      [T_SECTION_SHUTTER]: F2_SHUTTER,
    };
    return mapping[tile] ?? F2_FLOOR;
  }

  refreshCityOptions();
  countrySel.onchange = refreshCityOptions;

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
    const { cols, rows } = doc.map.geometry;
    const s = Math.floor(Math.min(wrap.clientWidth / cols, (wrap.clientHeight - 24) / rows));
    px = doc.map.buildingMeta ? Math.max(9, s) : Math.max(3, s);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${cols * px}px`;
    canvas.style.height = `${rows * px}px`;
    canvas.width = cols * px * dpr;
    canvas.height = rows * px * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
    const meta = doc.map.buildingMeta;
    if (meta?.origin && meta.width && meta.height) requestAnimationFrame(() => {
      wrap.scrollLeft = (meta.origin!.tx + meta.width! / 2) * px - wrap.clientWidth / 2;
      wrap.scrollTop = (meta.origin!.tz + meta.height! / 2) * px - wrap.clientHeight / 2;
    });
  }

  function draw() {
    const m = doc.map;
    const { cols, rows } = m.geometry;
    ctx.clearRect(0, 0, cols * px, rows * px);
    const paintLayer = (floor: number, alpha: number) => {
      const layer = floorLayer(m, floor);
      ctx.globalAlpha = alpha;
      for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
        const index = z * cols + x;
        const t = layer[index];
        ctx.fillStyle = floor === 0
          ? TILE_COLORS[t] ?? SURF_TINT[m.surface[index]] ?? '#50504a'
          : UPPER_TILE_COLORS[t] ?? '#263037';
        ctx.fillRect(x * px, z * px, px + 0.5, px + 0.5);
      }
    };
    if (exploded && activeFloor > 0) paintLayer(activeFloor - 1, 0.2);
    paintLayer(activeFloor, 1);
    ctx.globalAlpha = 1;
    // orphan heat (the loupe's red)
    if (showOrphans && activeFloor === 0) {
      ctx.fillStyle = 'rgba(220,40,40,0.55)';
      for (let z = 0; z < rows; z++) for (let x = 0; x < cols; x++) {
        const i = z * cols + x;
        if (report.seen[i] === 0 && frontWalkable(m.grid[i])) {
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
    if (showOperations && m.buildingMeta?.origin) {
      for (const socket of m.buildingMeta.sockets ?? []) {
        if (socket.floor !== activeFloor) continue;
        const color = socket.kind === 'objective' ? '#f2cf5b'
          : socket.kind === 'guard' || socket.kind === 'dog-handler' ? '#ef6259'
            : socket.kind === 'civilian' ? '#8ddc9b' : '#75d5e6';
        dot(m.buildingMeta.origin.tx + socket.x, m.buildingMeta.origin.tz + socket.z, color, 1.5);
      }
      const graph = operationOverlay?.graph;
      if (graph) {
        const drawRoute = (points: readonly { x: number; y: number; z: number }[], color: string, width: number, dash: number[] = []) => {
          ctx.save();
          ctx.strokeStyle = color;
          ctx.lineWidth = width;
          ctx.setLineDash(dash);
          for (let i = 1; i < points.length; i++) {
            if (Math.round(points[i - 1].y / 4) !== activeFloor || Math.round(points[i].y / 4) !== activeFloor) continue;
            const [ax, az] = w2t(points[i - 1].x, points[i - 1].z);
            const [bx, bz] = w2t(points[i].x, points[i].z);
            line((ax + 0.5) * px, (az + 0.5) * px, (bx + 0.5) * px, (bz + 0.5) * px);
          }
          ctx.restore();
        };
        if (operationLayers.critical) drawRoute(graph.criticalRoute, '#f1ba55', 3.2);
        if (operationLayers.patrols) for (const route of graph.patrolRoutes) {
          drawRoute(route.points, '#54dce8', 1.6);
          const point = route.points.find((pos) => Math.round(pos.y / 4) === activeFloor);
          if (point) {
            const [tx, tz] = w2t(point.x, point.z);
            letter(tx, tz, '›', '#54dce8', true);
          }
        }
        if (operationLayers.response) for (const route of graph.responseRoutes) drawRoute(route, '#ef684b', 1.8, [6, 4]);
        if (operationLayers.reports) for (const node of graph.reportNodes) {
          if (node.floor !== activeFloor) continue;
          const [tx, tz] = w2t(node.pos.x, node.pos.z);
          ctx.save();
          ctx.translate((tx + 0.5) * px, (tz + 0.5) * px);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#ef684b';
          ctx.fillRect(-3.5, -3.5, 7, 7);
          ctx.restore();
        }
      }
    }
    // grid every 10
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    for (let x = 0; x <= cols; x += 10) line(x * px, 0, x * px, rows * px);
    for (let z = 0; z <= rows; z += 10) line(0, z * px, cols * px, z * px);
    // Ground-only strategic objects stay out of upper-storey drafting views.
    if (activeFloor === 0) {
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
    }
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
    worldToTile(doc.map.geometry, x, z);
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
        const floor = issue.floor === undefined ? '' : ` <span class="mk-law-floor">${issue.floor === 0 ? 'Ground' : `L${issue.floor + 1}`}</span>`;
        div.innerHTML = `<b>✕ ${issue.law}</b>${floor} ${issue.detail}`;
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
    refreshOperationPanel();
    draw();
    refreshFloorTabs();
    clearTimeout(lawTimer);
    lawTimer = window.setTimeout(() => {
      report = validateDoc(doc);
      refreshSide();
      refreshFloorTabs();
      try { localStorage.setItem('ww_maker_autosave', JSON.stringify(serializeDoc(doc))); } catch { /* quota — dev tool */ }
    }, 160);
  }

  function loadInto(frontId: string, size: MapSize, seed: number) {
    doc = loadFront(frontId, seed, size);
    sel = null;
    report = validateDoc(doc);
    activeFloor = 0;
    afterOp();
  }

  // ---- canvas mouse ---------------------------------------------------------
  const tileAtEvent = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.max(0, Math.min(doc.map.geometry.cols - 1, Math.floor(((e.clientX - r.left) / r.width) * doc.map.geometry.cols))),
      Math.max(0, Math.min(doc.map.geometry.rows - 1, Math.floor(((e.clientY - r.top) / r.height) * doc.map.geometry.rows))),
    ];
  };
  const w = (tx: number, tz: number) => tileToWorld(doc.map.geometry, tx, tz);

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
      case 'tile':
        if (activeFloor === 0) paintTile(doc, tx, tz, tool.tile, brush);
        else paintFloorTile(doc, activeFloor as 1 | 2, tx, tz, upperTileFor(tool.tile), brush);
        break;
      case 'surface':
        if (activeFloor === 0) paintSurface(doc, tx, tz, tool.surf, brush);
        else flashHint('surface paint belongs to Ground');
        break;
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
    const idx = tz * doc.map.geometry.cols + tx;
    const t = floorLayer(doc.map, activeFloor)[idx];
    const tName = activeFloor === 0 ? (MAKER_TILES.find((x) => x.id === t)?.name ?? `T${t}`) : `architecture ${t}`;
    const sName = SURF_NAMES.find(([id]) => id === doc.map.surface[idx])?.[1] ?? '';
    const hi = doc.map.houses.findIndex((h) => tx >= h.tx && tx < h.tx + h.tw && tz >= h.tz && tz < h.tz + h.th);
    const detail = `${activeFloor === 0 ? 'Ground' : `L${activeFloor + 1}`} · (${tx},${tz}) ${tName}${activeFloor === 0 && sName ? ' · ' + sName : ''}${hi >= 0 ? ` · building ${hi}` : ''} — ${toolLabel()}`;
    hintEl.textContent = `${worldWidth(doc.map.geometry)}×${worldDepth(doc.map.geometry)}u · ${detail}`;
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
  root.querySelector<HTMLButtonElement>('#mk-generate')!.onclick = () => {
    if (doc.map.buildingMeta && !window.confirm('Replace the current generated building? Undo remains available.')) return;
    doc = generateBuildingDoc({
      cityId: citySel.value,
      archetype: archetypeSel.value as BuildingArchetype,
      floors: Number(floorsSel.value) as 1 | 2 | 3,
      seed: Number(seedIn.value) >>> 0,
      prints: Math.max(1, Math.min(8, Number(printsIn.value) || 4)),
    });
    activeFloor = 0;
    report = validateDoc(doc);
    afterOp();
    fit();
    flashHint('whole building generated — edit, validate, preview, or launch');
  };
  root.querySelector<HTMLButtonElement>('#mk-explode')!.onclick = (event) => {
    exploded = !exploded;
    const button = event.currentTarget as HTMLButtonElement;
    button.ariaPressed = String(exploded);
    button.classList.toggle('active', exploded);
    draw();
  };
  root.querySelector<HTMLInputElement>('#mk-operations')!.onchange = (event) => {
    showOperations = (event.currentTarget as HTMLInputElement).checked;
    draw();
  };
  const siteFor = (archetype: BuildingArchetype): ScienceSite => {
    if (archetype === 'command-villa' || archetype === 'cottage' || archetype === 'row-house' || archetype === 'apartment') return 'officer-villa';
    if (archetype === 'factory' || archetype === 'workshop' || archetype === 'processing-hall') return 'foundry';
    if (archetype === 'depot') return 'rail-yard';
    if (archetype === 'clinic') return 'field-hospital';
    if (archetype === 'secure-archive' || archetype === 'armory' || archetype === 'barracks') return 'clone-vault';
    if (archetype === 'command-post') return 'comms-relay';
    return 'research-annex';
  };
  launchBtn.onclick = () => {
    if (!canLaunchOperation(doc)) return;
    const prints = Math.max(1, Math.min(8, Number(printsIn.value) || 4));
    printsIn.value = String(prints);
    const spec = generateScienceMission(doc.seed, {
      cityId: doc.map.buildingMeta!.cityId,
      site: siteFor(doc.map.buildingMeta!.archetype as BuildingArchetype),
      squadSize: prints,
      complication: null,
    });
    if (deps.launchScience) deps.launchScience(spec);
    else deps.preview3D(doc.map);
  };
  root.querySelector<HTMLButtonElement>('#mk-load')!.onclick = () => {
    const v = frontSel.value;
    if (v.startsWith('sk:')) {
      doc = loadSkirmish(v.slice(3) as import('../sim/types').ThemeId, Number(seedIn.value) >>> 0);
      sel = null; report = validateDoc(doc); afterOp();
    } else if (v.startsWith('th:')) {
      doc = loadTheater(v.slice(3) as TheaterId, Number(seedIn.value) >>> 0);
      sel = null; report = validateDoc(doc); afterOp();
    } else {
      loadInto(v, sizeSel.value as MapSize, Number(seedIn.value) >>> 0);
    }
  };
  root.querySelector<HTMLButtonElement>('#mk-blank')!.onclick = () => {
    doc = blankDoc(sizeSel.value as MapSize, Number(seedIn.value) >>> 0);
    sel = null; activeFloor = 0; report = validateDoc(doc); afterOp();
  };
  root.querySelector<HTMLButtonElement>('#mk-undo')!.onclick = () => { if (undo(doc)) { report = validateDoc(doc); afterOp(); } };
  root.querySelector<HTMLButtonElement>('#mk-redo')!.onclick = () => { if (redo(doc)) { report = validateDoc(doc); afterOp(); } };
  root.querySelector<HTMLButtonElement>('#mk-3d')!.onclick = () => deps.preview3D(doc.map);
  window.addEventListener('keydown', (e) => {
    if (document.body.dataset.mode !== 'maker') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); if (undo(doc)) { report = validateDoc(doc); afterOp(); } }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); if (redo(doc)) { report = validateDoc(doc); afterOp(); } }
    if (e.key === 'Delete' && sel) { deleteObject(doc, sel); afterOp(); }
    if (!e.ctrlKey && !e.metaKey && ['1', '2', '3'].includes(e.key)) {
      const floor = Number(e.key) - 1;
      if (floor < floorTabs(doc).length) { activeFloor = floor; refreshFloorTabs(); draw(); }
    }
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
      const notice = mapMakerImportNotice(json);
      doc = deserializeDoc(json);
      sel = null; activeFloor = 0; report = validateDoc(doc); afterOp();
      if (notice) flashHint(notice);
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
  refreshFloorTabs();
  refreshOperationPanel();
  fit();
  new ResizeObserver(fit).observe(root.querySelector<HTMLElement>('#mk-canvas-wrap')!);
  afterOp();
}
