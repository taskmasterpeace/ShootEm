// ---------------------------------------------------------------------------
// THE INTERIOR COMPLEX (Robert: "maybe the entire map is indoors — wide
// corridor fights and down long hallways and such"). The starship/corridors
// theme stops being random scatter and becomes a real building interior: one
// LONG central hallway spine running the length of the map, a rank of ROOMS
// hanging off both sides (CQB alcoves, doors onto the hall), and two WIDE
// cross-corridors that let a flank sweep from the north rank to the south.
//
// Everything is authored on the WEST half and mirrored x→GRID-1-x, so the two
// hulls are identical. The base compounds stamp on top at the ends (they run
// last in generateMap); this owns the contested middle. Walls are metal hull
// (T_METAL) — breachable by the tunneler/demo, opaque to sight, a real CQB
// maze. Rooms are stocked with cover and the odd supply cache.
// ---------------------------------------------------------------------------
import { GRID, TILE, WORLD, T_CLIMB, T_COVER, T_DOOR, T_METAL, T_OPEN } from './map';
import type { PickupSpawn, PropSpec, TileClaim } from './map';
import type { Rng } from './rng';

const toWorld = (tx: number, tz: number) =>
  ({ x: (tx + 0.5) * TILE - WORLD / 2, y: 0, z: (tz + 0.5) * TILE - WORLD / 2 });

export const HALL_HALF = 3;   // the main hallway is 2·HALL_HALF+1 = 7 tiles wide
const ROOM_W = 12;            // room bay width along the hall
const MARGIN = 4;             // keep clear of the very edge (border + base skirt)

interface InteriorCtx {
  grid: Uint8Array;
  claims: TileClaim[];
  props: PropSpec[];
  pickups: PickupSpawn[];
  rng: Rng;
}

/**
 * Carve a whole-map interior into an already-open grid (the corridors gen
 * skips its scatter and calls this instead). half = GRID/2.
 */
export function carveInterior(ctx: InteriorCtx, half: number): void {
  const { grid, claims, props } = ctx;
  const mirror = (x: number) => GRID - 1 - x;
  const wall = (x: number, z: number) => {
    for (const wx of [x, mirror(x)]) {
      if (wx < 1 || z < 1 || wx >= GRID - 1 || z >= GRID - 1) continue;
      grid[z * GRID + wx] = T_METAL;
    }
  };
  const door = (x: number, z: number) => {
    for (const wx of [x, mirror(x)]) {
      if (wx < 1 || z < 1 || wx >= GRID - 1 || z >= GRID - 1) continue;
      grid[z * GRID + wx] = T_DOOR;
    }
  };

  const HZ0 = half - HALL_HALF, HZ1 = half + HALL_HALF; // the central hall z-range
  // room bands, north and south of the hall; each becomes a 2-deep grid of
  // rooms (a hall-side room and an outer room), split by a horizontal wall
  const bands: [number, number][] = [[MARGIN, HZ0 - 1], [HZ1 + 1, GRID - 1 - MARGIN]];

  const openTile = (x: number, z: number) => {
    for (const wx of [x, mirror(x)]) {
      if (wx < 1 || z < 1 || wx >= GRID - 1 || z >= GRID - 1) continue;
      grid[z * GRID + wx] = T_OPEN;
    }
  };

  for (const [bz0, bz1] of bands) {
    const hallEdge = bz0 < half ? bz1 : bz0;   // the row nearest the hall
    const mid = Math.floor((bz0 + bz1) / 2);   // the inner/outer split row

    // VERTICAL partitions divide the band into room columns. Each column keeps
    // an OPEN mouth onto the hall (its hall-edge tile), so the wide corridor
    // fight pours straight into the rooms — no funnel.
    for (let x = MARGIN + ROOM_W; x < half - 3; x += ROOM_W) {
      for (let z = bz0; z <= bz1; z++) wall(x, z);
    }
    // HORIZONTAL split — the back wall between the hall-side room and the
    // outer room, with a DOOR per column so every outer room is reachable
    for (let x = MARGIN; x < half; x++) wall(x, mid);
    for (let x = MARGIN + Math.floor(ROOM_W / 2); x < half - 3; x += ROOM_W) door(x, mid);
    // the outer (border-side) wall of the band is the hull skin
    for (let x = MARGIN; x < half; x++) wall(x, bz0 < half ? bz0 : bz1);
    // re-open every column's mouth onto the hall (a partition may have capped it)
    for (let x = MARGIN; x < half; x++) if (grid[hallEdge * GRID + x] !== T_DOOR) openTile(x, hallEdge);
  }

  // the CENTRAL HALLWAY spine — the long open artery, guaranteed clear across
  // the whole map (the compounds re-draw their own walls over the ends after)
  for (let z = HZ0; z <= HZ1; z++) for (let x = MARGIN; x < half; x++) openTile(x, z);

  // TWO WIDE CROSS-CORRIDORS (3 tiles) — vertical flank arteries linking the
  // north rooms, the hall, and the south rooms; they gap every wall they cross
  for (const cx of [MARGIN + Math.floor(ROOM_W * 1.5), half - 7]) {
    for (let z = MARGIN; z <= GRID - 1 - MARGIN; z++)
      for (let dx = -1; dx <= 1; dx++) openTile(cx + dx, z);
  }

  // CONTAINER STACKS — low CLIMB barricades (2.5u) a jump trooper vaults for
  // a real flank route over the room walls; everyone else takes the door.
  // Placed in the outer rooms, mirrored, clear of the hall and cross-corridors.
  for (let x = MARGIN + Math.floor(ROOM_W / 2); x < half - 6; x += ROOM_W * 2) {
    for (const [bz0, bz1] of bands) {
      const cz = bz0 < half ? bz0 + 2 : bz1 - 2; // toward the outer wall
      for (let i = -1; i <= 1; i++) {
        for (const wx of [x + i, mirror(x + i)]) {
          if (wx < 1 || wx >= GRID - 1) continue;
          if (grid[cz * GRID + wx] === T_OPEN) grid[cz * GRID + wx] = T_CLIMB;
        }
      }
    }
  }

  // STOCK THE ROOMS — a crate cluster or a supply cache per room, mirrored,
  // kept toward the room center (never on the hall or a cross-corridor)
  for (let x = MARGIN + Math.floor(ROOM_W / 2); x < half - 6; x += ROOM_W) {
    for (const [bz0, bz1] of bands) {
      for (const rz of [Math.floor((bz0 + Math.floor((bz0 + bz1) / 2)) / 2), Math.floor((Math.floor((bz0 + bz1) / 2) + bz1) / 2)]) {
        if (ctx.rng.next() < 0.55) {
          for (const wx of [x, mirror(x)]) {
            if (grid[rz * GRID + wx] !== T_OPEN) continue;
            claims.push({ idx: rz * GRID + wx, t: T_COVER });
            grid[rz * GRID + wx] = T_COVER;
            props.push({ type: 'crate', pos: toWorld(wx, rz), scale: 1, rot: ctx.rng.range(0, Math.PI) });
          }
        } else {
          for (const wx of [x, mirror(x)]) {
            if (grid[rz * GRID + wx] !== T_OPEN) continue;
            ctx.pickups.push({ type: ctx.rng.next() < 0.5 ? 'ammo' : 'medkit', pos: toWorld(wx, rz) });
          }
        }
      }
    }
  }
}
