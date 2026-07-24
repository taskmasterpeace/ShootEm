// ---------------------------------------------------------------------------
// VANESSA'S PAINTBALL — THE PLACE (#122, the amusement-park law).
// Robert: "I want your character to appear at, like, the entrance… the same
// view from the combat… they walk up to one thing, do one thing, walk up to
// another." So: a real walkable interior in the game's own top-down view.
//
// The room is a hand-built GameMap — a sealed wall ring on the legacy grid,
// deck-plate floor, nothing outside to wander into. Stations (the counter,
// four marker booths, the door) are walk-up spots: proximity raises the
// prompt, E opens a comic-lettered conversation (#124), and "take it to the
// yard" writes st.marker through the SAME onboarding store the yard deploys
// from — one wire, proven twice now.
// ---------------------------------------------------------------------------
import { T_COVER, T_OPEN, T_WALL, S_DIRT, S_PLATE, type GameMap } from '../sim/map';
import { LEGACY_GEOMETRY, allocateLayer, tileToWorld } from '../sim/map-geometry';
import type { Soldier, Vec3, WeaponId } from '../sim/types';
import type { World } from '../sim/world';
import { loadOnboarding, saveOnboarding } from './onboarding';
import { STOCK, boothStats } from './vanessas-stock';
import { closeDialogue, dialogueOpen, openDialogue, type DialogueNode } from './dialogue';

// ---- the room (tile space) -------------------------------------------------
// interior: tx 44..56 × tz 45..55 — a 39u × 33u shop under the war's camera
const X0 = 44, X1 = 56, Z0 = 45, Z1 = 55;

export function buildVanessasMap(): GameMap {
  const g = LEGACY_GEOMETRY;
  const grid = allocateLayer(g, T_OPEN);
  const surface = allocateLayer(g, S_DIRT);
  // the sealed ring — a place has walls, not map edges
  for (let tx = X0 - 1; tx <= X1 + 1; tx++) {
    grid[(Z0 - 1) * g.cols + tx] = T_WALL;
    grid[(Z1 + 1) * g.cols + tx] = T_WALL;
  }
  for (let tz = Z0 - 1; tz <= Z1 + 1; tz++) {
    grid[tz * g.cols + (X0 - 1)] = T_WALL;
    grid[tz * g.cols + (X1 + 1)] = T_WALL;
  }
  // deck-plate shop floor inside
  for (let tz = Z0; tz <= Z1; tz++) {
    for (let tx = X0; tx <= X1; tx++) surface[tz * g.cols + tx] = S_PLATE;
  }
  // FURNITURE IS SIM-REAL (the round-1 walk phased straight through the
  // dress): the counter and every booth stand block on the grid — the dress
  // swallows the cover tiles visually, the sim owns the truth
  for (let tx = 49; tx <= 51; tx++) grid[(Z0 + 1) * g.cols + tx] = T_COVER; // the counter row
  for (const [btx, btz] of [[X0 + 1, 48], [X0 + 1, 52], [X1 - 1, 48], [X1 - 1, 52]] as const) {
    grid[btz * g.cols + btx] = T_COVER; // booth stands
  }
  const center = tileToWorld(g, (X0 + X1) >> 1, (Z0 + Z1) >> 1);
  const door = tileToWorld(g, (X0 + X1) >> 1, Z1); // just inside the south wall
  const back = tileToWorld(g, (X0 + X1) >> 1, Z0);
  return {
    seed: 9001, theme: 'savanna', geometry: { ...g },
    grid, grid2: allocateLayer(g, 0), surface,
    basePos: [{ ...door }, { ...back }],
    spawns: [[{ ...door }], [{ ...back }]],
    flagPos: [{ ...door }, { ...back }],
    hillPos: { ...center },
    controlPoints: [], vehiclePads: [], pickups: [], props: [],
    // THE ARCADE ROW along the shop's back wall — two cabinets you walk up to
    // and play. A pro shop with a couple of machines in the corner is exactly
    // where these belong: it is somewhere you already GO, and the walk is the
    // whole difference between a cabinet and the handheld in your pack.
    arcades: [
      { pos: { x: tileToWorld(g, X0 + 2, Z0 + 1).x, y: 0, z: tileToWorld(g, X0 + 2, Z0 + 1).z }, cart: 'orbit_run', name: 'ORBIT RUN', yaw: 0 },
      { pos: { x: tileToWorld(g, X0 + 4, Z0 + 1).x, y: 0, z: tileToWorld(g, X0 + 4, Z0 + 1).z }, cart: 'siege_tower', name: 'SIEGE TOWER', yaw: 0 },
    ],
    zombieSpawns: [], houses: [], gates: [], pads: [], propCovered: [],
  };
}

// ---- the stations (world space) --------------------------------------------
export interface ShopStation {
  id: string;
  pos: Vec3;
  /** the walk-up prompt, comic-plain */
  label: string;
  /** booth stations carry their stock id */
  marker?: WeaponId;
}

const W = (tx: number, tz: number): Vec3 => tileToWorld(LEGACY_GEOMETRY, tx, tz);

/** Booths hug both side walls so a visit WALKS the room; the counter holds
 *  the north wall; the door is where you came in. */
export const SHOP_STATIONS: ShopStation[] = [
  { id: 'counter', pos: W(50, Z0 + 2), label: 'TALK TO VANESSA' }, // the CUSTOMER side of the counter
  { id: `booth:${STOCK[0].id}`, pos: W(X0 + 1, 48), label: `LOOK AT THE ${STOCK[0].tag}`, marker: STOCK[0].id },
  { id: `booth:${STOCK[1].id}`, pos: W(X0 + 1, 52), label: `LOOK AT THE ${STOCK[1].tag}`, marker: STOCK[1].id },
  { id: `booth:${STOCK[2].id}`, pos: W(X1 - 1, 48), label: `LOOK AT THE ${STOCK[2].tag}`, marker: STOCK[2].id },
  { id: `booth:${STOCK[3].id}`, pos: W(X1 - 1, 52), label: `LOOK AT THE ${STOCK[3].tag}`, marker: STOCK[3].id },
  { id: 'exit', pos: W(50, Z1), label: 'BACK TO THE WAR' },
];

export const VANESSA_POS: Vec3 = W(50, Z0); // behind the counter, north wall

/** where the player appears — AT THE ENTRANCE (Robert's exact ask) */
export const SHOP_ENTRANCE: Vec3 = W(50, Z1 - 1);

export function spawnVanessa(world: World) {
  const v = world.addSoldier('Vanessa', 'infantry', 0, 'bot');
  v.dummy = true; // she stands her counter; no bot brain marches her
  v.pos = { ...VANESSA_POS };
  v.yaw = Math.PI / 2; // facing +z — into her shop, at her customers
  v.protectedUntil = Number.MAX_SAFE_INTEGER; // the house does not get splatted
  return v;
}

// ---- the conversations (#124 — comic lettering, Yes/No) --------------------

export function stationDialogue(st: ShopStation, onExit: () => void): { nodes: Record<string, DialogueNode>; start: string } | null {
  if (st.id === 'exit') {
    return {
      start: 'q',
      nodes: {
        q: {
          id: 'q', speaker: 'Vanessa', text: 'Heading back to the war already?',
          choices: [
            { label: 'YES — the yard calls', act: onExit },
            { label: 'Not yet' },
          ],
        },
      },
    };
  }
  if (st.id === 'counter') {
    return {
      start: 'hi',
      nodes: {
        hi: {
          id: 'hi', speaker: 'Vanessa',
          text: "Welcome to VANESSA'S, hon. Everything on these walls shoots paint. Walk up and get acquainted.",
          choices: [
            { label: 'What is this place?', next: 'lore' },
            { label: 'Just saying hi' },
          ],
        },
        lore: {
          id: 'lore', speaker: 'Vanessa',
          text: 'Opened the shop when the war got too serious. Paint washes out. Losing doesn\'t.',
          choices: [{ label: 'Noted.' }],
        },
      },
    };
  }
  const stock = STOCK.find((s) => st.marker === s.id);
  if (!stock) return null;
  const stats = boothStats(stock.id);
  const owned = loadOnboarding().marker === stock.id;
  return {
    start: 'pitch',
    nodes: {
      pitch: {
        id: 'pitch', speaker: 'Vanessa',
        text: `${stock.vanessa} — ${stats.name}: ${stats.rate}, ${stats.reach}, hopper ${stats.hopper}.`,
        choices: [
          {
            label: owned ? 'Already on my belt' : 'TAKE IT TO THE YARD',
            next: owned ? undefined : 'taken',
            act: owned ? undefined : () => {
              const s = loadOnboarding();
              s.marker = stock.id;
              saveOnboarding(s);
            },
          },
          { label: 'Just looking' },
        ],
      },
      taken: {
        id: 'taken', speaker: 'Vanessa',
        text: 'Good pick. See you in the yard.',
        choices: [{ label: '✓' }],
      },
    },
  };
}

// ---- the walk-up loop (the amusement-park verb) ----------------------------
const REACH = 3.6; // booth stands are sim-solid — you reach from the next tile
let promptEl: HTMLElement | null = null;
let nearId: string | null = null;
let keyBound = false;
let exitFn: (() => void) | null = null;

function openStation(id: string) {
  const st = SHOP_STATIONS.find((s) => s.id === id);
  if (!st) return;
  const tree = stationDialogue(st, () => exitFn?.());
  if (tree) openDialogue(tree);
}

/** live-verify handle (house convention, like __ww / __bodylab) —
 *  browser-only; the sim tests import this module from node */
const shopDebug = { eHits: 0, near: () => nearId, openStation, stations: SHOP_STATIONS };
if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>).__shop = shopDebug;

/** Per-frame while the place is live: nearest station raises the prompt,
 *  E opens its conversation, walking away pops the bubble. */
export function updateShopInteract(world: World, me: Soldier, onExit: () => void) {
  exitFn = onExit;
  if (!promptEl) {
    promptEl = document.createElement('div');
    promptEl.id = 'place-prompt';
    promptEl.className = 'hidden';
    document.body.appendChild(promptEl);
  }
  if (!keyBound) {
    keyBound = true;
    window.addEventListener('keydown', (e) => {
      shopDebug.eHits += e.key === 'e' || e.key === 'E' ? 1 : 0;
      if ((e.key === 'e' || e.key === 'E') && nearId && !dialogueOpen()) {
        openStation(nearId);
      }
    });
  }
  let best: ShopStation | null = null;
  let bestD = REACH;
  for (const st of SHOP_STATIONS) {
    const d = Math.hypot(st.pos.x - me.pos.x, st.pos.z - me.pos.z);
    if (d < bestD) { bestD = d; best = st; }
  }
  nearId = best?.id ?? null;
  if (dialogueOpen()) {
    promptEl.classList.add('hidden');
    if (!best) closeDialogue(); // walked off mid-sentence — the bubble pops
  } else if (best) {
    promptEl.innerHTML = `<b>E</b>${best.label}`;
    promptEl.classList.remove('hidden');
  } else {
    promptEl.classList.add('hidden');
  }
}
