#!/usr/bin/env node
/** Action stills of the sci-fi kit: jump gates, warp beacons, orbital strike, phase stalker. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3400';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));

const shot = async (name) => {
  await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 86 });
  console.log(`  📸 ${name}.jpg`);
};

const deploy = async (modeIdx, classIdx) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(([m, c]) => {
    document.querySelectorAll('#mode-select .select-card')[m].click();
    document.querySelectorAll('#class-select .select-card')[c].click();
    document.getElementById('player-name').value = 'Robert';
    document.getElementById('deploy-btn').click();
  }, [modeIdx, classIdx]);
  await page.waitForFunction(() => window.__ww?.world?.time > 0.5, null, { timeout: 15000 });
};

console.log(`Capturing sci-fi stills from ${BASE}`);

// ---- 1. re-shoot the menu (7 modes, 8 classes, match setup) ----
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('menu');

// ---- 2. jump gate + pathfinder warp beacons in one frame ----
await deploy(0, 6); // TDM, Pathfinder
await page.evaluate(() => {
  const g = window.__ww;
  const gate = g.world.map.gates[0];
  g.me.pos.x = gate.a.x + 3; g.me.pos.z = gate.a.z + 2;
  g.me.energy = 100;
  // plant warp ALPHA right here, BETA further off so the pair exists
  g.world.spawnGadget('warpA', 0, g.me.id, { x: gate.a.x + 5, y: 0, z: gate.a.z + 4 }, 150);
  g.world.spawnGadget('warpB', 0, g.me.id, { x: gate.a.x + 40, y: 0, z: gate.a.z }, 150);
  window.__camDist = 12;
  g.renderer.camPos.set(g.me.pos.x, 11, g.me.pos.z + 7);
  g.world.step(1 / 60, new Map());
});
await page.waitForTimeout(700);
await shot('jump-gate');

// ---- 3. orbital strike, beam mid-fire ----
await page.evaluate(() => {
  const g = window.__ww;
  g.me.orbitals = 1;
  g.me.hp = g.me.maxHp;
  const canvas = document.getElementById('game-canvas');
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth * 0.68, clientY: innerHeight * 0.35, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', bubbles: true }));
});
// wait for the designator to land + arm + fire (~4s), then catch the beam
await page.waitForFunction(() => {
  const g = window.__ww;
  return [...g.world.gadgets.values()].some((x) => x.type === 'orbital');
}, null, { timeout: 8000 });
await page.waitForFunction(() => {
  const g = window.__ww;
  return ![...g.world.gadgets.values()].some((x) => x.type === 'orbital');
}, null, { timeout: 8000 });
await page.waitForTimeout(180); // beam is fading over 0.9s — catch it bright
await shot('orbital-strike');

// ---- 4. phase stalker + horde specials lineup ----
await deploy(5, 1); // Endless Horde, Heavy
await page.evaluate(() => {
  const g = window.__ww;
  const hill = g.world.map.hillPos;
  g.me.pos.x = hill.x; g.me.pos.z = hill.z + 4;
  const stalker = g.world.addZombie('stalker', { x: hill.x - 3, y: 0, z: hill.z - 2 });
  stalker.yaw = -Math.PI / 2;
  const sprinter = g.world.addZombie('sprinter', { x: hill.x + 2, y: 0, z: hill.z - 3 });
  sprinter.yaw = -Math.PI / 2;
  g.world.step(1 / 60, new Map());
  // freeze for the portrait
  g.world.step = () => {};
  window.__camDist = 9;
  g.renderer.camPos.set(g.me.pos.x, 8, g.me.pos.z + 6);
  g.renderer.scene.traverse((o) => { if (o.isSprite) o.visible = false; });
});
await page.waitForTimeout(500);
await shot('phase-stalker');

await browser.close();
console.log('Done.');
