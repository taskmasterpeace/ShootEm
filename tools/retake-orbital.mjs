#!/usr/bin/env node
/** Deterministic orbital-strike still: plant the designator on-camera, catch the beam. */
import { chromium } from 'playwright';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3400';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.querySelectorAll('#mode-select .select-card')[0].click(); // TDM
  document.querySelectorAll('#class-select .select-card')[6].click(); // Pathfinder
  document.getElementById('player-name').value = 'Robert';
  document.getElementById('deploy-btn').click();
});
await page.waitForFunction(() => window.__ww?.world?.time > 0.5, null, { timeout: 15000 });

await page.evaluate(() => {
  const g = window.__ww;
  const hill = g.world.map.hillPos;
  g.me.pos.x = hill.x - 6; g.me.pos.z = hill.z + 5;
  // plant the designator dead ahead where the camera can see the whole column
  g.world.spawnGadget('orbital', 0, g.me.id, { x: hill.x + 2, y: 0, z: hill.z - 2 }, 60);
  window.__camDist = 20;
  g.renderer.camPos.set(g.me.pos.x, 18, g.me.pos.z + 11);
  // stay alive and in place for the photo
  setInterval(() => {
    g.me.hp = g.me.maxHp;
    if (!g.me.alive) { g.me.alive = true; g.me.respawnAt = 0; }
    g.me.pos.x = hill.x - 6; g.me.pos.z = hill.z + 5;
  }, 150);
});
// beam fires 3s after planting; poll for the strike then shoot fast
await page.waitForFunction(() => {
  const g = window.__ww;
  return ![...g.world.gadgets.values()].some((x) => x.type === 'orbital');
}, null, { timeout: 8000 });
await page.waitForTimeout(120);
await page.screenshot({ path: join(OUT, 'orbital-strike.jpg'), type: 'jpeg', quality: 86 });
console.log('  📸 orbital-strike.jpg (retake)');
await browser.close();
