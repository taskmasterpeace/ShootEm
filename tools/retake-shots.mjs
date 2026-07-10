#!/usr/bin/env node
/** Retakes for tank-assault and zombie-survival with tighter staging. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:3400';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

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

// ---- tank assault: quiet flank, full health, cannon mid-flight ----
await deploy(1, 1); // TDM
await page.evaluate(() => {
  const g = window.__ww;
  const tank = [...g.world.vehicles.values()].find((v) => v.team === 0 && v.kind === 'tank' && v.alive);
  tank.pos.x = -45; tank.pos.z = -28; tank.yaw = 0;
  g.me.hp = g.me.maxHp;
  g.me.pos.x = tank.pos.x + 2; g.me.pos.z = tank.pos.z;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'e', bubbles: true }));
});
await page.waitForTimeout(300);
await page.evaluate(() => {
  const canvas = document.getElementById('game-canvas');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: innerWidth * 0.72, clientY: innerHeight * 0.32, bubbles: true }));
});
await page.waitForTimeout(900);
await page.evaluate(() => {
  document.getElementById('game-canvas').dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
await page.waitForTimeout(260); // shell + muzzle particles in flight
await shot('tank-assault');
await page.evaluate(() => {
  window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));
});

// ---- zombie survival: horde in frame ----
await deploy(5, 2); // Survival, Heavy
await page.waitForFunction(() => {
  const g = window.__ww;
  return g && [...g.world.soldiers.values()].filter((s) => (s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute') && s.alive).length >= 4;
}, null, { timeout: 40000 });
await page.evaluate(() => {
  const g = window.__ww;
  const zeds = [...g.world.soldiers.values()].filter((s) => (s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute') && s.alive);
  // nearest zombie; stand 9 units from it on the line toward map center
  zeds.sort((a, b) => Math.hypot(a.pos.x, a.pos.z) - Math.hypot(b.pos.x, b.pos.z));
  const z = zeds[0];
  const d = Math.hypot(z.pos.x, z.pos.z) || 1;
  g.me.hp = g.me.maxHp;
  g.me.pos.x = z.pos.x - (z.pos.x / d) * 9;
  g.me.pos.z = z.pos.z - (z.pos.z / d) * 9;
});
// wait until 3+ zombies are within 14 units of the player, then fire
await page.waitForFunction(() => {
  const g = window.__ww;
  const close = [...g.world.soldiers.values()].filter((s) =>
    (s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute') && s.alive &&
    Math.hypot(s.pos.x - g.me.pos.x, s.pos.z - g.me.pos.z) < 14).length;
  return close >= 3;
}, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => {
  const g = window.__ww;
  // aim at the closest zombie
  const zeds = [...g.world.soldiers.values()].filter((s) => (s.kind === 'zombie' || s.kind === 'spitter' || s.kind === 'brute') && s.alive);
  zeds.sort((a, b) => Math.hypot(a.pos.x - g.me.pos.x, a.pos.z - g.me.pos.z) - Math.hypot(b.pos.x - g.me.pos.x, b.pos.z - g.me.pos.z));
  const z = zeds[0];
  const canvas = document.getElementById('game-canvas');
  // project roughly: aim in the zombie's screen direction using world delta
  const dx = z.pos.x - g.me.pos.x, dz = z.pos.z - g.me.pos.z;
  canvas.dispatchEvent(new MouseEvent('mousemove', {
    clientX: innerWidth / 2 + dx * 18, clientY: innerHeight / 2 + dz * 18, bubbles: true,
  }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
});
await page.waitForTimeout(700);
await shot('zombie-survival');

await browser.close();
console.log('Done.');
