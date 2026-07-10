import { CLASSES, MODE_INFO } from './sim/data';
import type { ClassId, ModeId, PlayerCmd } from './sim/types';
import { World, type Difficulty } from './sim/world';
import { audio } from './client/audio';
import { Hud } from './client/hud';
import { Input } from './client/input';
import { Renderer } from './client/renderer';
import { NetGame } from './client/net';

const $ = (id: string) => document.getElementById(id)!;

const CLASS_ICONS: Record<ClassId, string> = {
  infantry: '🎖️', heavy: '💥', jump: '🚀', engineer: '🔧', medic: '⚕️', infiltrator: '👁️',
};

const BOT_NAMES = [
  'Vex', 'Talon', 'Havoc', 'Rook', 'Cinder', 'Drifter', 'Onyx', 'Piston',
  'Gault', 'Merc', 'Static', 'Bishop', 'Fang', 'Widow', 'Jinx', 'Saber',
  'Grit', 'Nomad', 'Ash', 'Ranger', 'Hex', 'Bolt',
];

let selectedMode: ModeId = 'ctf';
let selectedClass: ClassId = 'infantry';
let difficulty: Difficulty = 'veteran';
let botsPerTeam = 7;
let matchMinutes = 15;
let running = false;

function wireSetupControls() {
  const wirePills = (rootId: string, onPick: (v: string) => void) => {
    const root = $(rootId);
    root.querySelectorAll<HTMLButtonElement>('.pill').forEach((btn) => {
      btn.onclick = () => {
        audio.play('ui_click');
        root.querySelectorAll('.pill').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onPick(btn.dataset.v!);
      };
    });
  };
  wirePills('difficulty-select', (v) => { difficulty = v as Difficulty; });
  wirePills('length-select', (v) => { matchMinutes = parseInt(v); });
  const count = $('bots-count');
  $('bots-minus').onclick = () => {
    botsPerTeam = Math.max(0, botsPerTeam - 1);
    count.textContent = String(botsPerTeam);
    audio.play('ui_click');
  };
  $('bots-plus').onclick = () => {
    botsPerTeam = Math.min(12, botsPerTeam + 1);
    count.textContent = String(botsPerTeam);
    audio.play('ui_click');
  };
}

function buildMenu() {
  const modeRow = $('mode-select');
  modeRow.innerHTML = '';
  (Object.keys(MODE_INFO) as ModeId[]).forEach((id) => {
    const card = document.createElement('div');
    card.className = `select-card${id === selectedMode ? ' selected' : ''}`;
    card.innerHTML = `<div class="icon">${MODE_INFO[id].icon}</div><div class="name">${MODE_INFO[id].name}</div><div class="desc">${MODE_INFO[id].desc}</div>`;
    card.onclick = () => {
      selectedMode = id;
      audio.play('ui_click');
      modeRow.querySelectorAll('.select-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
    };
    modeRow.appendChild(card);
  });

  const classRow = $('class-select');
  classRow.innerHTML = '';
  (Object.keys(CLASSES) as ClassId[]).forEach((id) => {
    const c = CLASSES[id];
    const card = document.createElement('div');
    card.className = `select-card${id === selectedClass ? ' selected' : ''}`;
    card.innerHTML = `<div class="icon">${CLASS_ICONS[id]}</div><div class="name">${c.name}</div><div class="desc">${c.desc}</div>`;
    card.onclick = () => {
      selectedClass = id;
      audio.play('ui_click');
      classRow.querySelectorAll('.select-card').forEach((el) => el.classList.remove('selected'));
      card.classList.add('selected');
    };
    classRow.appendChild(card);
  });
}

async function startGame() {
  if (running) return;
  running = true;
  await audio.init();
  audio.resume();

  const name = (($('player-name') as HTMLInputElement).value || 'Recruit').slice(0, 16);
  const serverUrl = (($('server-url') as HTMLInputElement).value || '').trim();
  $('menu').classList.add('hidden');

  const canvas = $('game-canvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const hud = new Hud();
  const input = new Input(canvas);
  hud.show();

  const endGame = () => {
    running = false;
    hud.hide();
    $('menu').classList.remove('hidden');
    window.location.reload(); // clean slate: disposes scene, sockets, listeners
  };

  if (serverUrl) {
    // ---- multiplayer ----
    const net = new NetGame(serverUrl, name, selectedClass, selectedMode);
    try {
      await net.connect();
    } catch {
      hud.announce('Could not reach server — falling back to offline bots', true, 0);
      startLocal(renderer, hud, input, name, endGame);
      return;
    }
    net.run(renderer, hud, input, endGame);
    return;
  }
  startLocal(renderer, hud, input, name, endGame);
}

function startLocal(renderer: Renderer, hud: Hud, input: Input, name: string, endGame: () => void) {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const world = new World({ seed, mode: selectedMode, difficulty, botsPerTeam, matchMinutes });
  const me = world.addSoldier(name, selectedClass, 0, 'human');

  // populate bots
  const classPool: ClassId[] = ['infantry', 'infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator'];
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let n = 0;
  const wrap = (i: number) => names[i % names.length];
  if (selectedMode === 'survival') {
    for (let i = 0; i < Math.min(botsPerTeam, 5); i++) world.addSoldier(wrap(n++), classPool[i % classPool.length], 0, 'bot');
  } else {
    for (let i = 0; i < botsPerTeam; i++) world.addSoldier(wrap(n++), classPool[i % classPool.length], 0, 'bot');
    for (let i = 0; i < botsPerTeam + 1; i++) world.addSoldier(wrap(n++), classPool[(i + 3) % classPool.length], 1, 'bot');
  }

  renderer.buildStaticWorld(world);
  hud.announce(MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
  (window as unknown as Record<string, unknown>).__ww = { world, me }; // debug/testing handle

  const FIXED = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let overAt = 0;
  const cmds = new Map<number, PlayerCmd>();

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    while (acc >= FIXED) {
      acc -= FIXED;
      cmds.clear();
      if (me.alive || me.vehicleId >= 0) cmds.set(me.id, input.buildCmd(me, renderer.camera));
      world.step(FIXED, cmds);
    }
    const events = world.takeEvents();
    renderer.applyEvents(events, world, me.id);
    hud.applyEvents(events, world, me.id, world.time);
    renderer.update(world, me.id, dt);
    hud.update(world, me.id, input.scoreboardHeld, world.time);

    if (world.mode.over) {
      if (!overAt) overAt = now;
      else if (now - overAt > 9000) { endGame(); return; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

buildMenu();
wireSetupControls();
$('deploy-btn').addEventListener('click', () => { startGame(); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !running && !$('menu').classList.contains('hidden')) startGame();
});
