import { CLASSES, EQUIPMENT, MODE_INFO, THEMES, WEAPONS } from './sim/data';
import { CLASS_ARMORY, familyWeapons } from './sim/arsenal';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd, type ThemeId, type WeaponFamily } from './sim/types';
import { World, type Difficulty, type Loadout } from './sim/world';
import { audio } from './client/audio';
import { Chat } from './client/chat';
import { Hud } from './client/hud';
import { Input } from './client/input';
import { Renderer } from './client/renderer';
import { NetGame } from './client/net';
import { MATCH_LINGER_LOCAL_MS, ReplayDirector } from './client/replay';

const $ = (id: string) => document.getElementById(id)!;

const CLASS_ICONS: Record<ClassId, string> = {
  infantry: '🎖️', heavy: '💥', jump: '🚀', engineer: '🔧', medic: '⚕️', infiltrator: '👁️',
  pathfinder: '🌀', ghost: '📡',
};

const BOT_NAMES = [
  'Vex', 'Talon', 'Havoc', 'Rook', 'Cinder', 'Drifter', 'Onyx', 'Piston',
  'Gault', 'Merc', 'Static', 'Bishop', 'Fang', 'Widow', 'Jinx', 'Saber',
  'Grit', 'Nomad', 'Ash', 'Ranger', 'Hex', 'Bolt',
];

let selectedMode: ModeId = 'ctf';
let selectedClass: ClassId = 'infantry';
let selectedTheme: ThemeId = 'savanna';
let selectedEquipment: string[] = [];
let difficulty: Difficulty = 'veteran';
let botsPerTeam = 7;
let matchMinutes = 15;
let running = false;

/** The player's armory picks (empty string = class issue weapon). */
function currentLoadout(): Loadout {
  const primary = ($('primary-select') as HTMLSelectElement).value;
  const secondary = ($('secondary-select') as HTMLSelectElement).value;
  return {
    primary: primary || undefined,
    secondary: secondary || undefined,
    equipment: [...selectedEquipment],
  };
}

/** Rebuild the armory selects for the chosen class. */
function buildArmoryMenu() {
  const primarySel = $('primary-select') as HTMLSelectElement;
  const secondarySel = $('secondary-select') as HTMLSelectElement;
  const cls = CLASSES[selectedClass];

  primarySel.innerHTML = '';
  const issue = document.createElement('option');
  issue.value = '';
  issue.textContent = `Issue: ${WEAPONS[cls.primary].name}`;
  primarySel.appendChild(issue);
  for (const fam of CLASS_ARMORY[selectedClass]) {
    const group = document.createElement('optgroup');
    group.label = fam.replace('_', '-').toUpperCase();
    for (const w of familyWeapons(WEAPONS, fam as WeaponFamily)) {
      const o = document.createElement('option');
      o.value = w.id;
      o.textContent = w.name;
      group.appendChild(o);
    }
    primarySel.appendChild(group);
  }

  secondarySel.innerHTML = '';
  const issue2 = document.createElement('option');
  issue2.value = '';
  issue2.textContent = `Issue: ${WEAPONS[cls.secondary].name}`;
  secondarySel.appendChild(issue2);
  for (const w of familyWeapons(WEAPONS, 'pistol')) {
    const o = document.createElement('option');
    o.value = w.id;
    o.textContent = w.name;
    secondarySel.appendChild(o);
  }

  const stats = $('weapon-stats');
  const renderStats = () => {
    const id = primarySel.value || cls.primary;
    const w = WEAPONS[id];
    if (!w) { stats.textContent = ''; return; }
    const dps = Math.round(w.damage * w.pellets * w.rof);
    stats.innerHTML = `<b>${w.name}</b><br>DMG ${w.damage}${w.pellets > 1 ? `×${w.pellets}` : ''} · ROF ${w.rof}/s · DPS ~${dps}<br>RANGE ${w.range} · CLIP ${Number.isFinite(w.clip) ? w.clip : '∞'}${w.splash ? ` · SPLASH ${w.splash}` : ''}`;
  };
  primarySel.onchange = renderStats;
  renderStats();
}

/** Equipment grid: pick two. */
function buildEquipmentMenu() {
  const row = $('equip-select');
  row.innerHTML = '';
  for (const eq of Object.values(EQUIPMENT)) {
    const card = document.createElement('div');
    card.className = 'equip-card';
    card.innerHTML = `<div class="eq-name"><span class="ico">${eq.icon}</span>${eq.name}</div><div class="eq-desc">${eq.desc}</div>`;
    const sync = () => {
      card.classList.toggle('selected', selectedEquipment.includes(eq.id));
      card.classList.toggle('locked', !selectedEquipment.includes(eq.id) && selectedEquipment.length >= 2);
    };
    card.onclick = () => {
      audio.play('ui_click');
      if (selectedEquipment.includes(eq.id)) {
        selectedEquipment = selectedEquipment.filter((x) => x !== eq.id);
      } else if (selectedEquipment.length < 2) {
        selectedEquipment.push(eq.id);
      }
      row.querySelectorAll('.equip-card').forEach((c, i) => {
        const id = Object.values(EQUIPMENT)[i].id;
        c.classList.toggle('selected', selectedEquipment.includes(id));
        c.classList.toggle('locked', !selectedEquipment.includes(id) && selectedEquipment.length >= 2);
      });
    };
    sync();
    row.appendChild(card);
  }
}

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
      buildArmoryMenu(); // armory families follow the class
    };
    classRow.appendChild(card);
  });

  // environments: the war scales the solar system
  const themeRow = $('theme-select');
  themeRow.innerHTML = '';
  (Object.keys(THEMES) as ThemeId[]).forEach((id) => {
    const t = THEMES[id];
    const card = document.createElement('div');
    card.className = `select-card${id === selectedTheme ? ' selected' : ''}`;
    card.innerHTML = `<div class="icon">${t.icon}</div><div class="name">${t.name}</div><div class="desc">${t.desc}${t.gravity < 22 ? ` Low-g: ${t.gravity} m/s².` : ''}</div>`;
    card.onclick = () => {
      selectedTheme = id;
      audio.play('ui_click');
      themeRow.querySelectorAll('.select-card').forEach((el) => el.classList.remove('selected'));
      card.classList.add('selected');
    };
    themeRow.appendChild(card);
  });

  buildArmoryMenu();
  buildEquipmentMenu();
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
  const chat = new Chat(name);
  hud.show();
  chat.show();
  hud.waypointsEnabled = selectedEquipment.some((id) => EQUIPMENT[id]?.waypoints);
  chat.deliverMail(); // stored messages arrive the moment you deploy

  const endGame = () => {
    running = false;
    hud.hide();
    chat.hide();
    $('menu').classList.remove('hidden');
    window.location.reload(); // clean slate: disposes scene, sockets, listeners
  };

  if (serverUrl) {
    // ---- multiplayer ----
    const net = new NetGame(serverUrl, name, selectedClass, selectedMode, currentLoadout(), chat, hud);
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
  const world = new World({ seed, mode: selectedMode, difficulty, botsPerTeam, matchMinutes, theme: selectedTheme });
  const me = world.addSoldier(name, selectedClass, 0, 'human', currentLoadout());

  // replays: the director runs the killcam + match-highlights state machine
  const director = new ReplayDirector(seed, selectedMode, selectedTheme);
  const banner = $('replay-banner');
  const setBanner = (text: string | null) => {
    banner.classList.toggle('hidden', !text);
    if (text) banner.textContent = text;
  };

  // populate bots
  const classPool: ClassId[] = ['infantry', 'infantry', 'heavy', 'jump', 'engineer', 'medic', 'infiltrator', 'pathfinder', 'ghost'];
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  let n = 0;
  const wrap = (i: number) => names[i % names.length];
  if (isCoopMode(selectedMode)) {
    for (let i = 0; i < Math.min(botsPerTeam, 5); i++) world.addSoldier(wrap(n++), classPool[i % classPool.length], 0, 'bot');
  } else {
    for (let i = 0; i < botsPerTeam; i++) world.addSoldier(wrap(n++), classPool[i % classPool.length], 0, 'bot');
    for (let i = 0; i < botsPerTeam + 1; i++) world.addSoldier(wrap(n++), classPool[(i + 3) % classPool.length], 1, 'bot');
  }

  renderer.buildStaticWorld(world);
  hud.announce(MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
  (window as unknown as Record<string, unknown>).__ww = { world, me, renderer, hud, input, recorder: director.recorder, replay: director.player, director }; // debug/testing handle

  const FIXED = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let overAt = 0;
  const cmds = new Map<number, PlayerCmd>();

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // once highlights roll the live match is over and hidden — stop simming
    // it (no invisible battles burning CPU, no ghost VFX, no stray inputs)
    if (!director.highlightsRolling) {
      acc += dt;
      while (acc >= FIXED) {
        acc -= FIXED;
        cmds.clear();
        if (me.alive || me.vehicleId >= 0) cmds.set(me.id, input.buildCmd(me, renderer.camera));
        world.step(FIXED, cmds);
      }
    }
    const events = world.takeEvents();
    hud.applyEvents(events, world, me.id, world.time); // killfeed stays live

    const { renderWorld, banner: bannerText } = director.update(world, me.id, dt);
    const replaying = renderWorld !== world;
    setBanner(bannerText);
    // live-world VFX/sounds only belong on the live view — a replay scene
    // getting present-time explosions would show phantom battles
    if (!replaying) renderer.applyEvents(events, world, me.id);
    renderer.replayView = replaying;
    renderer.camDist = input.camDist;
    // grenade throw preview: hold G → arc + landing ring at the cursor
    renderer.setGrenadePreview(world, me, !replaying && input.grenadeAiming ? input.aimPoint(renderer.camera) : null);
    renderer.update(renderWorld, me.id, dt, hud.getWaypoints());
    hud.update(world, me.id, input.scoreboardHeld, world.time);

    // linger after the whistle: trophies + looping highlights deserve a look
    if (world.mode.over) {
      if (!overAt) overAt = now;
      else if (now - overAt > MATCH_LINGER_LOCAL_MS) { endGame(); return; }
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
