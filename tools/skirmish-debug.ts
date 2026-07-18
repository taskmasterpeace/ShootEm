/** dev-only: show the law violations for a skirmish roll. */
import { generateSkirmishMap } from '../src/sim/skirmish';
import { validateDoc, type MakerDoc } from '../src/sim/mapedit';
import { Rng } from '../src/sim/rng';
import type { GameMap } from '../src/sim/map';
import type { ThemeId } from '../src/sim/types';

const theme = (process.argv[2] ?? 'savanna') as ThemeId;
const seed = Number(process.argv[3] ?? 7);
const map = generateSkirmishMap(theme, seed);
const asDoc = (m: GameMap): MakerDoc => ({
  frontId: null, size: 'small', seed: m.seed, mode: 'tdm', map: m,
  claims: m.propCovered.map((idx) => ({ idx, t: m.grid[idx] })),
  rng: new Rng(m.seed), undoStack: [], redoStack: [],
});
const report = validateDoc(asDoc(map));
for (const i of report.issues) {
  console.log(`${i.law}: ${i.detail}`);
  console.log('  tiles:', i.tiles.map(([x, z]) => `(${x},${z})`).join(' '));
}
if (report.ok) console.log('CLEAN');
console.log('bases:', map.basePos.map((b) => `(${b.x.toFixed(1)},${b.z.toFixed(1)})`).join(' '));
console.log('houses:', map.houses.map((h) => `(${h.tx},${h.tz} ${h.tw}x${h.th})`).join(' '));

const CH: Record<number, string> = {
  0: '.', 1: '#', 2: 'c', 3: '~', 4: 'S', 5: 'D', 6: 'd', 7: 'M', 8: 'L', 9: '%', 10: '^',
};
for (let z = 0; z < 100; z++) {
  let row = '';
  for (let x = 0; x < 100; x++) row += CH[map.grid[z * 100 + x]] ?? '?';
  console.log(row);
}
