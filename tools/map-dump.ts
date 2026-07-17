/** dev-only: dump a front's grid as ASCII to eyeball layouts without the BMP pipeline.
 *  npx tsx tools/map-dump.ts the_city small */
import { generateFront } from '../src/sim/fronts';

const CH: Record<number, string> = {
  0: '.', 1: '#', 2: 'c', 3: '~', 4: 'S', 5: 'D', 6: 'd', 7: 'M', 8: 'L', 9: '%', 10: '^',
};
const id = process.argv[2] ?? 'the_city';
const sizes = (process.argv[3] ? [process.argv[3]] : ['small', 'standard', 'large']) as ('small' | 'standard' | 'large')[];
for (const size of sizes) {
  const m = generateFront(id, 4207, size)!;
  console.log(`=== ${id}.${size} ===`);
  for (let z = 0; z < 100; z++) {
    let row = '';
    for (let x = 0; x < 100; x++) row += CH[m.grid[z * 100 + x]] ?? '?';
    console.log(row);
  }
}
