/** dev-only: which cell does the connectivity law see as sealed? */
import { BUILDINGS } from '../src/sim/buildings';

const def = BUILDINGS.find((b) => b.id === (process.argv[2] ?? 'dome_hab'))!;
console.log(def.rows.join('\n'));
const h = def.rows.length;
const w = Math.max(...def.rows.map((r) => r.length));
const at = (x: number, z: number) => (def.rows[z] ?? '')[x] ?? ' ';
const pass = (ch: string) => ch === '.' || ch === 'D' || ch === 'P' || ch === 'L' || ch === ' ';
const seen = new Set<number>();
const q: [number, number][] = [];
for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
  const ch = at(x, z);
  const border = x === 0 || z === 0 || x === w - 1 || z === h - 1;
  if (ch === 'D' || (border && pass(ch))) { seen.add(z * w + x); q.push([x, z]); }
}
console.log('seeds:', q.map(([x, z]) => `(${x},${z})`).join(' '));
while (q.length) {
  const [x, z] = q.pop()!;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= w || nz >= h || seen.has(nz * w + nx)) continue;
    if (!pass(at(nx, nz))) continue;
    seen.add(nz * w + nx);
    q.push([nx, nz]);
  }
}
const sealed: string[] = [];
for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
  const ch = at(x, z);
  if ((ch === '.' || ch === 'P' || ch === 'L') && !seen.has(z * w + x)) sealed.push(`(${x},${z})='${ch}'`);
}
console.log('sealed:', sealed.join(' ') || 'NONE');
