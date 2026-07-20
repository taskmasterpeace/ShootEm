// Does the FARM chunk land, and does the map still play? Crops must be walkable
// concealment (T_GRASS), landmarks must claim their tiles, and the bases must
// still reach each other.
import { generateMap, GRID, TILE, WORLD, isBlocked, nearestOpenTile, T_DOOR, T_DOOR_OPEN, T_GRASS } from '../src/sim/map';

const toTile = (wx: number, wz: number) => ({ x: Math.floor((wx + WORLD / 2) / TILE), z: Math.floor((wz + WORLD / 2) / TILE) });
const pass = (g: Uint8Array, x: number, z: number) => {
  const t = g[z * GRID + x];
  return !isBlocked(g, x, z) || t === T_DOOR || t === T_DOOR_OPEN;
};

let seedsWithFarm = 0, totalCrops = 0, totalLandmarks = 0, worst = 100;
for (let seed = 1; seed <= 20; seed++) {
  const m = generateMap(seed, 'ctf', 'savanna');
  const crops = m.props.filter((p) => p.type === 'crop').length;
  const marks = m.props.filter((p) => ['barn', 'silo_farm', 'windmill', 'watertower'].includes(p.type)).length;
  if (crops > 0 || marks > 0) seedsWithFarm++;
  totalCrops += crops; totalLandmarks += marks;

  // every crop must sit on WALKABLE tall grass — a field you can run through
  let cropsOnGrass = 0;
  for (const p of m.props) {
    if (p.type !== 'crop') continue;
    const t = toTile(p.pos.x, p.pos.z);
    if (m.grid[t.z * GRID + t.x] === T_GRASS) cropsOnGrass++;
  }

  // reachability: base0 -> base1 + hill
  const g = m.grid;
  let b0 = toTile(m.basePos[0].x, m.basePos[0].z);
  if (!pass(g, b0.x, b0.z)) { const o = nearestOpenTile(g, b0.x, b0.z, 6); if (o) b0 = o; }
  const seen = new Uint8Array(GRID * GRID); const q = [b0.z * GRID + b0.x]; seen[q[0]] = 1;
  let head = 0, reached = 0;
  while (head < q.length) {
    const idx = q[head++]; reached++;
    const x = idx % GRID, z = (idx / GRID) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= GRID || nz >= GRID) continue;
      const ni = nz * GRID + nx;
      if (seen[ni] || !pass(g, nx, nz)) continue;
      seen[ni] = 1; q.push(ni);
    }
  }
  let total = 0; for (let i = 0; i < g.length; i++) if (pass(g, i % GRID, (i / GRID) | 0)) total++;
  const b1 = toTile(m.basePos[1].x, m.basePos[1].z), hill = toTile(m.hillPos.x, m.hillPos.z);
  const pct = 100 * reached / total; worst = Math.min(worst, pct);
  const ok = !!seen[b1.z * GRID + b1.x] && !!seen[hill.z * GRID + hill.x];
  if (crops > 0 || marks > 0) {
    console.log(`seed ${String(seed).padStart(2)}: crops=${String(crops).padStart(3)} (on grass ${cropsOnGrass}) landmarks=${marks}  reach ${pct.toFixed(1)}%  base1+hill=${ok ? 'OK' : 'BROKEN'}`);
  }
}
console.log(`\n${seedsWithFarm}/20 seeds grew a farm · ${totalCrops} crops · ${totalLandmarks} landmarks · worst reachability ${worst.toFixed(1)}%`);
