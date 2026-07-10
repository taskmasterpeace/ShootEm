#!/usr/bin/env node
/**
 * Repeatable action-screenshot capture for docs.
 *   1. npm run dev        (game at :3400)
 *   2. node tools/capture-screenshots.mjs [baseUrl]
 * Writes JPEGs to docs/screenshots/. Uses the window.__ww debug handle to
 * position the player inside the action deterministically.
 */
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

const deploy = async (modeIdx, classIdx = 1) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.click(`#mode-select .select-card:nth-child(${modeIdx})`);
  await page.click(`#class-select .select-card:nth-child(${classIdx})`);
  await page.fill('#player-name', 'Robert');
  await page.click('#deploy-btn');
  await page.waitForFunction(() => window.__ww?.world?.time > 0.5, null, { timeout: 15000 });
};

/** Wait until the sim shows real action near the player (projectiles in flight). */
const waitForAction = (min = 5, timeout = 30000) =>
  page.waitForFunction((m) => window.__ww && window.__ww.world.projectiles.size >= m, min, { timeout }).catch(() => {});

const evalGame = (fn) => page.evaluate(fn);

console.log(`Capturing from ${BASE} → ${OUT}`);

// ---- 1. main menu (match setup front end) ----
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('menu');

// ---- 2. CTF midfield firefight ----
await deploy(2, 1); // CTF, Infantry
await evalGame(() => {
  const g = window.__ww;
  g.me.pos.x = 0; g.me.pos.z = 6; // drop into midfield
});
await page.waitForTimeout(2500);
await evalGame(() => {
  // throw a frag for pyrotechnics and open fire toward the east
  const canvas = document.getElementById('game-canvas');
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth * 0.72, clientY: innerHeight * 0.38, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'g', bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
await waitForAction(6);
await page.waitForTimeout(900); // grenade lands mid-burst
await shot('ctf-firefight');
await evalGame(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));

// ---- 3. tank assault ----
await evalGame(() => {
  const g = window.__ww;
  const tank = [...g.world.vehicles.values()].find((v) => v.team === 0 && v.kind === 'tank' && v.alive);
  if (tank) { tank.pos.x = -20; tank.pos.z = 0; g.me.pos.x = tank.pos.x + 2; g.me.pos.z = tank.pos.z; }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }));
});
await page.waitForTimeout(400);
await evalGame(() => {
  const canvas = document.getElementById('game-canvas');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth * 0.7, clientY: innerHeight * 0.35, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
await page.waitForTimeout(1400); // cannon fires + shell in flight
await shot('tank-assault');
await evalGame(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
});

// ---- 4. scoreboard ----
await page.keyboard.down('Tab');
await page.waitForTimeout(350);
await shot('scoreboard');
await page.keyboard.up('Tab');

// ---- 5. zombie survival ----
await deploy(5, 2); // Survival, Heavy
await page.waitForFunction(() => {
  const g = window.__ww;
  return g && [...g.world.soldiers.values()].some((s) => s.kind === 'zombie' && s.alive);
}, null, { timeout: 30000 });
await evalGame(() => {
  const g = window.__ww;
  const zeds = [...g.world.soldiers.values()].filter((s) => (s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute') && s.alive);
  if (zeds.length) {
    // stand in the horde's path and open up
    const cx = zeds.reduce((a, z) => a + z.pos.x, 0) / zeds.length;
    const cz = zeds.reduce((a, z) => a + z.pos.z, 0) / zeds.length;
    const d = Math.hypot(cx - g.me.pos.x, cz - g.me.pos.z) || 1;
    g.me.pos.x = cx + ((g.me.pos.x - cx) / d) * 12;
    g.me.pos.z = cz + ((g.me.pos.z - cz) / d) * 12;
  }
  const canvas = document.getElementById('game-canvas');
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth * 0.6, clientY: innerHeight * 0.35, bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
await page.waitForTimeout(2200);
await shot('zombie-survival');
await evalGame(() => window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true })));

// ---- 6. conquest point fight ----
await deploy(4, 4); // Conquest, Engineer
await evalGame(() => {
  const g = window.__ww;
  const cp = g.world.mode.points[1];
  g.me.pos.x = cp.pos.x - 6; g.me.pos.z = cp.pos.z + 3;
  // build a sentry for the shot
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'q', bubbles: true }));
});
await page.waitForTimeout(5000); // let bots contest the point
await shot('conquest-point');

// ---- 7. mobile viewport check (for the feasibility report) ----
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await shot('mobile-menu');

await browser.close();
console.log('Done.');
