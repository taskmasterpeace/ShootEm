import { CLASSES, EQUIPMENT, MODE_INFO, THEMES, WEAPONS } from './sim/data';
import { CLASS_ARMORY, familyWeapons } from './sim/arsenal';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd, type Team, type ThemeId, type WeaponDef, type WeaponFamily, type WeaponId } from './sim/types';
import { LSWS, lswAllowed, lswsForTeam } from './sim/lsw';
import { World, type Difficulty, type Loadout } from './sim/world';
import { ammoReport, blackboxReport, type BbIncident, type BbSample } from './sim/blackbox';
import { mapSizeForPlayers } from './sim/fronts';
import { WEATHER_MODS } from './sim/weather';
import { mountOnboarding, onMatchEnd, paintballConfig } from './client/onboarding';
import { StableConsole, isCommissioned } from './client/stable';
import { audio } from './client/audio';
import { Chat } from './client/chat';
import { pauseCodex, renderCodex } from './client/codex';
import { StaticOverlay } from './client/effects';
import { Hud, setRankChip } from './client/hud';
import { initGodMode } from './client/godmode';
import { Input } from './client/input';
import { MusicDirector } from './client/music';
import { Renderer } from './client/renderer';
import { DamageText } from './client/damagetext';
import { NetGame } from './client/net';
import { MATCH_LINGER_LOCAL_MS, ReplayDirector } from './client/replay';
import { MatchTracker, RANKS, loadDossier, rankFor, rankInsignia, saveDossier, type Dossier } from './client/record';
import { FRONTS, SCAR_TEXT, applyResult, bandOf, cancelCampaignOperation, checkSeasonEnd, consumeOperationBattleBonuses, holdTheLine, loadCampaign, operationBattleBonuses, saveCampaign, settleCampaignOperation, stageCampaignOperation, type Campaign } from './client/campaign';
import { buildOperationBoardModel, createSuggestedManifest, renderManifestDialog, renderOperationsBoard } from './client/operations-ui';
import type { OperationManifest, OperationPlan } from './sim/operations';
import { fileIssue, renderIssueHTML, renderPressInto, loadPress } from './client/newspaper';
import { RangeCourse, loadWall } from './client/range';
import { RingDrill } from './client/ringdrill';
import { loadSettings, saveSettings, settings, type BloodLevel, type DarknessLevel } from './client/settings';
import { darknessUniforms } from './client/darkness';

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
/** §14 onboarding: a named paintball field pins the map seed for the match */
let seedOverride: number | undefined;
let difficulty: Difficulty = 'veteran';
let botsPerTeam = 12; // 32B: 12v12 target — bots fill every open position
let matchMinutes = 15;
/** THE ROSTER LAW (Robert): zombies fight alone unless the player opts in. */
let hordeRoster: 'zombies' | 'iron' | 'both' = 'zombies';
let running = false;

/** The player's armory picks ('' = class issue weapon). Chosen through the
 *  weapon picker, not a native dropdown. */
let primaryPick = '';
let secondaryPick = '';

function currentLoadout(): Loadout {
  return {
    primary: primaryPick || undefined,
    secondary: secondaryPick || undefined,
    equipment: [...selectedEquipment],
  };
}

/** Human-readable family names for the armory filter rail. */
const FAMILY_LABELS: Partial<Record<WeaponFamily, string>> = {
  pistol: 'Pistols', rifle: 'Rifles', carbine: 'Carbines', smg: 'SMGs',
  shotgun: 'Shotguns', slugger: 'Sluggers', laser: 'Lasers', lmg: 'LMGs',
  hmg: 'HMGs', at_rocket: 'AT Rockets', ap_rocket: 'AP Rockets', mortar: 'Mortars',
  artillery: 'Artillery', scatter: 'Scatter', sonic: 'Sonic', flamethrower: 'Flame',
  grenade: 'Grenades', special: 'Special',
};

/** One weapon's telemetry line — the readout a picker card and slot share. */
function weaponTelemetry(w: WeaponDef): string {
  const dps = Math.round(w.damage * w.pellets * w.rof);
  const clip = Number.isFinite(w.clip) ? w.clip : '∞';
  return `DMG ${w.damage}${w.pellets > 1 ? `×${w.pellets}` : ''} · ROF ${w.rof} · DPS ~${dps} · RNG ${w.range} · CLIP ${clip}${w.splash ? ` · SPL ${w.splash}` : ''}`;
}

/** Paint the two loadout slots with the current picks (or class issue). */
function renderArmorySlots() {
  const cls = CLASSES[selectedClass];
  const paint = (slot: 'primary' | 'secondary', pickId: string, issueId: WeaponId) => {
    const w = WEAPONS[pickId] ?? WEAPONS[issueId];
    const root = $(`slot-${slot}`);
    const isIssue = !pickId;
    root.querySelector('.slot-icon')!.textContent = w.icon ?? '▣';
    root.querySelector('.slot-name')!.textContent = w.name;
    root.querySelector('.slot-stats')!.textContent = weaponTelemetry(w);
    root.classList.toggle('is-issue', isIssue);
    root.querySelector('.slot-kind')!.textContent =
      (slot === 'primary' ? 'Primary' : 'Sidearm') + (isIssue ? ' · issue' : ' · custom');
  };
  paint('primary', primaryPick, cls.primary);
  paint('secondary', secondaryPick, cls.secondary);
}

/** The weapon picker overlay — search + family filter + telemetry grid.
 *  Replaces the old <select>. `which` decides the eligible families. */
let pickerFamily = '__all';
let pickerQuery = '';
function openWeaponPicker(which: 'primary' | 'secondary') {
  const cls = CLASSES[selectedClass];
  const families: WeaponFamily[] = which === 'primary' ? CLASS_ARMORY[selectedClass] : ['pistol'];
  const issueId = which === 'primary' ? cls.primary : cls.secondary;
  const currentPick = which === 'primary' ? primaryPick : secondaryPick;
  pickerFamily = '__all';
  pickerQuery = '';

  $('wp-title').textContent = which === 'primary' ? 'SELECT PRIMARY' : 'SELECT SIDEARM';
  const search = $('wp-search') as HTMLInputElement;
  search.value = '';

  // family filter rail (ALL + each eligible family) — hidden when only one
  const famRail = $('wp-families');
  famRail.innerHTML = '';
  const addFam = (key: string, label: string) => {
    const b = document.createElement('button');
    b.className = `wp-fam${key === pickerFamily ? ' selected' : ''}`;
    b.textContent = label;
    b.onclick = () => {
      pickerFamily = key; audio.play('ui_click');
      famRail.querySelectorAll('.wp-fam').forEach((x) => x.classList.remove('selected'));
      b.classList.add('selected');
      renderPickerGrid(which, families, issueId, currentPick);
    };
    famRail.appendChild(b);
  };
  famRail.style.display = families.length > 1 ? 'flex' : 'none';
  addFam('__all', 'All');
  for (const f of families) addFam(f, FAMILY_LABELS[f] ?? f.toUpperCase());

  search.oninput = () => { pickerQuery = search.value.toLowerCase(); renderPickerGrid(which, families, issueId, currentPick); };

  renderPickerGrid(which, families, issueId, currentPick);
  $('weapon-picker').classList.remove('hidden');
  search.focus();
}

function closeWeaponPicker() { $('weapon-picker').classList.add('hidden'); }

function renderPickerGrid(which: 'primary' | 'secondary', families: WeaponFamily[], issueId: WeaponId, currentPick: string) {
  const grid = $('wp-grid');
  grid.innerHTML = '';
  const chosen = pickerFamily === '__all' ? families : [pickerFamily as WeaponFamily];

  // build the row list: the class-issue option first, then every eligible weapon
  type Row = { id: string; w: WeaponDef; issue: boolean };
  const rows: Row[] = [{ id: '', w: WEAPONS[issueId], issue: true }];
  for (const fam of chosen) for (const w of familyWeapons(WEAPONS, fam)) rows.push({ id: w.id, w, issue: false });

  const q = pickerQuery.trim();
  const shown = rows.filter((r) => !q || r.w.name.toLowerCase().includes(q) || (r.w.family ?? '').includes(q));

  for (const r of shown) {
    const card = document.createElement('button');
    const selected = r.id === currentPick;
    card.className = `wp-card${selected ? ' selected' : ''}${r.issue ? ' issue' : ''}`;
    const tier = r.w.tier ? `<span class="wp-tier">MK${r.w.tier}</span>` : '';
    card.innerHTML =
      `<span class="wp-card-top"><span class="wp-ico">${r.w.icon ?? '▣'}</span>${tier}</span>` +
      `<span class="wp-name">${r.issue ? '◆ ISSUE · ' : ''}${r.w.name}</span>` +
      `<span class="wp-stats">${weaponTelemetry(r.w)}</span>`;
    card.onclick = () => {
      audio.play('ui_click');
      if (which === 'primary') primaryPick = r.id; else secondaryPick = r.id;
      renderArmorySlots();
      closeWeaponPicker();
    };
    grid.appendChild(card);
  }
  $('wp-count').textContent = `${shown.length} weapon${shown.length === 1 ? '' : 's'}`;
}

/** Rebuild the armory for the chosen class. Custom picks that the new class
 *  can't field fall back to its issue weapon. */
function buildArmoryMenu() {
  // a custom primary from another class's families is invalid — reset to issue
  if (primaryPick) {
    const fam = WEAPONS[primaryPick]?.family;
    if (!fam || !CLASS_ARMORY[selectedClass].includes(fam)) primaryPick = '';
  }
  renderArmorySlots();
}

/** Wire the two slots + picker chrome once at boot. */
function wireArmory() {
  ($('slot-primary') as HTMLButtonElement).onclick = () => { audio.play('ui_click'); openWeaponPicker('primary'); };
  ($('slot-secondary') as HTMLButtonElement).onclick = () => { audio.play('ui_click'); openWeaponPicker('secondary'); };
  $('wp-close').onclick = () => { audio.play('ui_click'); closeWeaponPicker(); };
  $('weapon-picker').onclick = (e) => { if (e.target === $('weapon-picker')) closeWeaponPicker(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('weapon-picker').classList.contains('hidden')) closeWeaponPicker();
  });
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
  wirePills('roster-select', (v) => { hordeRoster = v as typeof hordeRoster; });
  const count = $('bots-count');
  $('bots-minus').onclick = () => {
    botsPerTeam = Math.max(0, botsPerTeam - 1);
    count.textContent = String(botsPerTeam);
    audio.play('ui_click');
  };
  $('bots-plus').onclick = () => {
    botsPerTeam = Math.min(16, botsPerTeam + 1);
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
      // THE ROSTER LAW: the horde-composition pick only exists where a horde does
      $('roster-block').style.display = (id === 'horde' || id === 'survival') ? '' : 'none';
    };
    modeRow.appendChild(card);
  });
  $('roster-block').style.display = (selectedMode === 'horde' || selectedMode === 'survival') ? '' : 'none';

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
  pauseCodex(); // nothing else may hold a render loop once the match owns the frame
  await audio.init();
  audio.resume();

  const name = (($('player-name') as HTMLInputElement).value || 'Recruit').slice(0, 16);
  const serverUrl = (($('server-url') as HTMLInputElement).value || '').trim();
  $('menu').classList.add('hidden');

  const canvas = $('game-canvas') as HTMLCanvasElement;
  const renderer = new Renderer(canvas);
  const dmgText = new DamageText();
  const hud = new Hud();
  const input = new Input(canvas);
  const chat = new Chat(name);
  hud.show();
  chat.show();
  hud.waypointsEnabled = selectedEquipment.some((id) => EQUIPMENT[id]?.waypoints);
  chat.deliverMail(); // stored messages arrive the moment you deploy

  const endGame = () => {
    saveFlight(); // the match dies, its flight log doesn't
    running = false;
    hud.hide();
    chat.hide();
    $('menu').classList.remove('hidden');
    window.location.reload(); // clean slate: disposes scene, sockets, listeners
  };

  if (serverUrl) {
    // ---- multiplayer ----
    const net = new NetGame(serverUrl, name, selectedClass, selectedMode, currentLoadout(), chat, hud, isCommissioned(dossier));
    try {
      await net.connect();
    } catch {
      hud.announce('Could not reach server — falling back to offline bots', true, 0);
      startLocal(renderer, dmgText, hud, input, name, endGame);
      return;
    }
    net.run(renderer, dmgText, hud, input, endGame);
    return;
  }
  startLocal(renderer, dmgText, hud, input, name, endGame);
}

/** The front the player deployed to from the Scar (null = free play). */
let activeFrontId: string | null = null;

/** Scar modifiers v1 (§8.5): the front's wound shapes the battlefield. */
function applyScarMods(world: World, frontId: string | null) {
  if (!frontId || !campaign) return;
  const def = FRONTS.find((f) => f.id === frontId);
  const st = campaign.fronts[frontId];
  if (!def || !st?.scarActive) return;
  if (def.scar === 'fire') {
    // persistent fires seeded around the middle ground
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      world.spawnGadget('fire_field', i % 2 as 0 | 1, -1, {
        x: world.map.hillPos.x + Math.cos(a) * 14, y: 0, z: world.map.hillPos.z + Math.sin(a) * 14,
      }, 50, 9999);
    }
  } else if (def.scar === 'rubble') {
    // collapsed cover litters the approaches — stamped straight into the grid
    // BEFORE the renderer builds, so the boxes are real and rendered
    const g = world.map.grid;
    const GRID_N = 100;
    let h = 0x9e3779b9 ^ world.opts.seed;
    for (let i = 0; i < 26; i++) {
      h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0;
      const tx = 20 + (h % 60), tz = 20 + ((h >> 8) % 60);
      if (g[tz * GRID_N + tx] === 0) g[tz * GRID_N + tx] = 2; // T_OPEN -> T_COVER
    }
  }
  else if (def.scar === 'frozen') {
    // the front froze slick: every surface reads ICE (§8.6 movement rules)
    world.map.surface.fill(2 /* S_ICE */);
  } else if (def.scar === 'flooded') {
    // low ground under water: the mud ring around water swells to 3 tiles
    const g = world.map.grid, sf = world.map.surface, N = 100;
    for (let z = 3; z < N - 3; z++) for (let x = 3; x < N - 3; x++) {
      if (g[z * N + x] !== 3 /* T_WATER */) continue;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const i = (z + dz) * N + (x + dx);
        if (g[i] === 0 /* T_OPEN */) sf[i] = 6 /* S_MUD */;
      }
    }
  }
  // 'blocked' (route denial) waits for the arena/authored-front pass
}

// ---------------------------------------------------------------------------
// THE FLIGHT SAVER — endGame reloads the page, and the reload used to take
// the black box with it: the one match Robert actually played was the one
// nobody could autopsy. The local world registers itself in startLocal; the
// box is written to localStorage at match end, on tab close, and every 30s
// in between. __flight() (defined at boot, below) reads it back — from the
// menu, after the reload, any time.
// ---------------------------------------------------------------------------
let flightWorld: World | null = null;
function saveFlight() {
  if (!flightWorld || flightWorld.blackbox.samples.length === 0) return;
  try {
    localStorage.setItem('ww:lastFlight', JSON.stringify({
      at: new Date().toISOString(),
      mode: flightWorld.mode.id,
      simTime: +flightWorld.time.toFixed(0),
      scores: flightWorld.mode.scores,
      samples: flightWorld.blackbox.samples,
      incidents: flightWorld.blackbox.incidents,
    }));
  } catch { /* storage full or blocked — the log is a luxury, never a crash */ }
}
(window as unknown as Record<string, unknown>).__flight = (mode?: 'raw') => {
  const raw = localStorage.getItem('ww:lastFlight');
  if (!raw) return 'no stored flight — play a match first';
  const f = JSON.parse(raw) as { at: string; mode: string; simTime: number; scores: number[]; samples: BbSample[]; incidents: BbIncident[] };
  if (mode === 'raw') return f;
  return `LAST FLIGHT — ${f.mode} · ${f.simTime}s sim · scores ${f.scores.join(':')} · saved ${f.at}\n${blackboxReport(f)}`;
};

function startLocal(renderer: Renderer, dmgText: DamageText, hud: Hud, input: Input, name: string, endGame: () => void) {
  const deployedOperation = activeFrontId && campaign?.activeOperation?.plan.frontId === activeFrontId
    ? campaign.activeOperation
    : null;
  const seed = deployedOperation?.plan.seed ?? seedOverride ?? (Math.random() * 0xffffffff) >>> 0;
  seedOverride = undefined;
  const world = new World({
    seed, mode: selectedMode, difficulty, botsPerTeam, matchMinutes, theme: selectedTheme,
    hordeRoster, // THE ROSTER LAW: iron never mixes with zombies unless asked
    // B1: banked morale opens the stable richer for YOUR side (capped in-world)
    moraleBoost: [Math.min(3, dossier?.soldier.morale ?? 0), 0],
    // §8.2+33C: a Scar deploy lands on AUTHORED ground, at the tier the
    // lobby's headcount earns — the size rides the id (front@size) so
    // world.ts stays the LSW dev's untouched file.
    frontId: activeFrontId ? `${activeFrontId}@${mapSizeForPlayers(botsPerTeam)}` : undefined,
    // W3.4 PASS ESCALATION: a campaign battle fights at the front's pass —
    // P1 no gods, P2 their stable only, P3 both. Off the map: everything.
    lswPass: activeFrontId ? (campaign?.fronts[activeFrontId]?.pass ?? 3) : 3,
    operationBonuses: activeFrontId && campaign ? operationBattleBonuses(campaign, activeFrontId) : undefined,
    operation: deployedOperation?.plan,
    operationManifest: deployedOperation?.manifest,
    operationInventory: deployedOperation && campaign ? campaign.motorPool : undefined,
  });
  if (activeFrontId && campaign) {
    consumeOperationBattleBonuses(campaign, activeFrontId);
    saveCampaign(campaign);
  }
  // carry the feel knobs into the match (Robert's global speed control)
  world.projectileSpeedMul = settings.projectileSpeed;
  world.moveSpeedMul = settings.moveSpeed;
  world.vehicleSpeedMul = settings.vehicleSpeed;
  // the flight saver watches this world; tab close saves too (the endGame
  // reload fires beforeunload as well — a harmless double write)
  flightWorld = world;
  window.addEventListener('beforeunload', saveFlight);
  const me = world.addSoldier(name, selectedClass, 0, 'human', currentLoadout());
  applyScarMods(world, activeFrontId); // §8.5: the front's wound shapes the field
  // DEATH RE-SELECT (Robert: "select my stuff after every time I die and just
  // continue on"): the K.I.A. overlay grows a class rack. Clicking while dead
  // re-signs the next print — spawn() derives the whole kit from the choice.
  {
    const rack = $('respawn-classes');
    rack.innerHTML = '';
    (Object.keys(CLASSES) as ClassId[]).forEach((id) => {
      const b = document.createElement('button');
      b.className = `respawn-class${id === selectedClass ? ' selected' : ''}`;
      b.innerHTML = `<span class="rc-icon">${CLASS_ICONS[id]}</span><span class="rc-name">${CLASSES[id].name}</span>`;
      b.onclick = () => {
        if (me.alive) return; // the living change kit at the printer, not mid-fight
        if (world.redeployAs(me, id)) {
          audio.play('ui_click');
          rack.querySelectorAll('.respawn-class').forEach((el) => el.classList.remove('selected'));
          b.classList.add('selected');
        }
      };
      rack.appendChild(b);
    });
  }
  // GOD MODE (testing): backtick opens the stable and you can wear anything
  initGodMode(() => world, () => me);
  // THE STABLE (finish-list #3/#4): the officer's V channel. SP wires
  // straight into the sim — requestLsw prices the call and refuses politely.
  new StableConsole({
    mode: selectedMode,
    commissioned: isCommissioned(dossier),
    team: () => 0,
    call: (id) => world.requestLsw(id, 0, me.id),
    stock: () => world.materiel[0],
    announce: (t) => hud.announce(t, false, world.time),
  });
  // the Record (§3.4): fold this match into the dossier as it happens
  // the yard stays out of the Record (§14 Q3: one legacy beat per phase —
  // the dossier starts writing at the first WAR drop, not in the paint)
  const tracker = dossier && selectedMode !== 'paintball'
    ? new MatchTracker(dossier, name, selectedClass, selectedMode, seed) : null;
  // the Proving Grounds (§3.3): stage the course; 18B decided practice vs official
  const course = selectedMode === 'range'
    ? new RangeCourse(rangeOfficial, name, dossier, (t, big) => hud.announce(t, !!big, 0))
    : null;
  rangeOfficial = false; // one-shot flag — consumed by this deploy
  // READ THE RING (§UI): the boot-camp station — three dummies, splat the weakest
  const ringDrill = selectedMode === 'paintball'
    ? new RingDrill((t, big) => hud.announce(t, !!big, 0))
    : null;

  // THE SCORE (Robert's tracks): soldier combat → LSW inbound/walking → the
  // real monsters. The director reads the sim twice a second and crossfades.
  const music = new MusicDirector();

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
  // 32B: bots FILL to the team-size target (default 12v12; co-op 4-6).
  // Heavy bots carry MANPADS (49A) so the anti-air duel exists in bot wars.
  const botLoadout = (cls: ClassId) => (cls === 'heavy' ? { equipment: ['manpads'] } : undefined);
  if (selectedMode === 'range') {
    // the Proving Grounds are YOURS alone (§3.3) — no bots, just the work
  } else if (isCoopMode(selectedMode)) {
    for (let i = 0; i < Math.min(botsPerTeam, 5); i++) {
      const cls = classPool[i % classPool.length];
      world.addSoldier(wrap(n++), cls, 0, 'bot', botLoadout(cls));
    }
  } else if (selectedMode === 'paintball') {
    // §14 Hunters vs Hunted: the roster IS the asymmetry. Round 1 you hunt
    // with a pack of two; round 2 you're alone and three markers want you.
    const pb = paintballConfig();
    const packSize = 3;
    if (pb.role === 'hunter') {
      for (let i = 0; i < packSize - 1; i++) world.addSoldier(wrap(n++), 'infantry', 0, 'bot', { primary: 'marker_blitz' });
      world.addSoldier(wrap(n), 'infantry', 1, 'bot', { primary: 'marker_pump' });
    } else {
      for (let i = 0; i < packSize; i++) world.addSoldier(wrap(n++), 'infantry', 1, 'bot', { primary: 'marker_blitz' });
    }
    // everyone plays paintball RULES: marker only, no sidearm, no frags —
    // paint is the whole vocabulary of the yard
    for (const s of world.soldiers.values()) {
      const marker = s.id === me.id ? pb.marker : s.weapons[0];
      s.weapons = [marker];
      s.clip = [WEAPONS[marker].clip];
      s.reserve = [WEAPONS[marker].reserve];
      s.weaponIdx = 0;
      s.grenades = 0;
      s.equipment = [];
    }
  } else {
    for (let i = 0; i < Math.max(0, botsPerTeam - 1); i++) {
      const cls = classPool[i % classPool.length];
      world.addSoldier(wrap(n++), cls, 0, 'bot', botLoadout(cls));
    }
    for (let i = 0; i < botsPerTeam; i++) {
      const cls = classPool[(i + 3) % classPool.length];
      world.addSoldier(wrap(n++), cls, 1, 'bot', botLoadout(cls));
    }
    // §5.3: each side fields one K9, paired to its first infantry/engineer bot
    for (const team of [0, 1] as const) {
      const handler = [...world.soldiers.values()].find(
        (s) => s.kind === 'bot' && s.team === team && (s.classId === 'infantry' || s.classId === 'engineer'),
      );
      if (handler) world.addDog(handler);
    }
  }

  renderer.buildStaticWorld(world);
  course?.begin(world, me.id);
  ringDrill?.begin(world, me.id);
  hud.announce(MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
  // §7: tell the player the officer channel is open (once per deploy)
  if (lswAllowed(selectedMode)) {
    const [a, b] = lswsForTeam(0 as Team);
    if (a) hud.announce(`OFFICER CHANNEL — V: CALL ${LSWS[a].name.toUpperCase()}${b ? ` · SHIFT+V: ${LSWS[b].name.toUpperCase()}` : ''}`, false, 0);
  }
  // CROWD DIAGNOSTIC (Robert: "put something in there so you can look at the
  // logs… they all bunch up"). Call `__ww.crowd()` in the console any time for
  // each team's spread — average nearest-neighbour and the tightest pair. A
  // healthy fireteam sits ~3u+; anything averaging under ~2u is a knot. Pass
  // `true` to also start a once-a-second console log so you can watch it live.
  const crowd = (log?: boolean) => {
    const report = ([0, 1] as const).map((team) => {
      const b = [...world.soldiers.values()].filter((s) => s.alive && s.team === team && (s.kind === 'human' || s.kind === 'bot') && !s.ascendant);
      if (b.length < 2) return { team, n: b.length, avgNN: 0, minNN: 0 };
      let sum = 0, min = Infinity;
      for (const x of b) {
        let nn = Infinity;
        for (const y of b) if (y !== x) nn = Math.min(nn, Math.hypot(y.pos.x - x.pos.x, y.pos.z - x.pos.z));
        sum += nn; min = Math.min(min, nn);
      }
      return { team, n: b.length, avgNN: +(sum / b.length).toFixed(1), minNN: +min.toFixed(1) };
    });
    if (log) {
      const w = window as unknown as { __crowdTimer?: number };
      if (w.__crowdTimer) { clearInterval(w.__crowdTimer); w.__crowdTimer = undefined; return 'crowd log OFF'; }
      w.__crowdTimer = window.setInterval(() => {
        console.log('[crowd]', JSON.stringify(crowd()));
      }, 1000);
      return 'crowd log ON (call __ww.crowd(true) again to stop)';
    }
    return report;
  };
  // THE BLACK BOX (Robert: "put the tools in there so next time you can
  // diagnose it") — the sim records itself, always. This is the reader:
  //   __ww.blackbox()          → { samples, incidents } — full flight data
  //   __ww.blackbox('report')  → compact table + incident lines
  // Each new incident also console.warns live (see the frame loop below).
  const blackbox = (mode?: 'report') =>
    mode === 'report'
      ? `${blackboxReport(world.blackbox)}\n${ammoReport(world)}` // §13: the ammo economy rides the report
      : { samples: world.blackbox.samples, incidents: world.blackbox.incidents };
  (window as unknown as Record<string, unknown>).__ww = { world, me, renderer, hud, input, audio, recorder: director.recorder, replay: director.player, director, crowd, blackbox, darkness: darknessUniforms }; // debug/testing handle (darkness: live cone uniforms — eval-side imports get FRESH module instances, this doesn't)

  const FIXED = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let overAt = 0;
  let lingerSkip = false;
  // ESC pause (local matches only — the sim is ours to stop): Resume /
  // volume / Abandon. The clearly-marked exit every 15-minute match owed us.
  let paused = false;
  const pauseEl = $('pause-overlay');
  const setPaused = (p: boolean) => {
    paused = p;
    pauseEl.classList.toggle('hidden', !p);
    last = performance.now(); // no dt avalanche on resume
  };
  $('pause-resume').onclick = () => setPaused(false);
  $('pause-abandon').onclick = () => {
    if (confirm('Abandon this match and return to base? The round is forfeit.')) endGame();
  };
  {
    const pv = $('pause-volume') as HTMLInputElement;
    pv.value = String(Math.round(settings.masterVolume * 100));
    pv.oninput = () => {
      settings.masterVolume = Number(pv.value) / 100;
      audio.setMasterVolume(settings.masterVolume);
      saveSettings();
    };
  }
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'Escape' && !world.mode.over) setPaused(!paused);
    else if (world.mode.over) lingerSkip = true; // any key hurries the AAR along
    // §7 THE OFFICER CHANNEL moved into the STABLE CONSOLE (client/stable.ts):
    // V opens the full roster with prices and the materiel purse, and the
    // commission gate (D2) decides who gets a dial tone. The old quick-call
    // (first-unit-blind, ungated, unpriced) retired when the console shipped.
  };
  window.addEventListener('keydown', onKey); // page reload on endGame cleans up
  const cmds = new Map<number, PlayerCmd>();
  // FPV drone feed: static builds as the link degrades; bursts on disconnect
  const staticFx = new StaticOverlay();
  let hadDrone = false;
  let nextStaticAt = 0;
  let pilotBody: string | undefined; // §7: announce each ascension exactly once
  let bbWarned = 0; // black-box incidents already surfaced to the console
  let nextFlightSaveAt = 30000; // periodic flight-log write (wall clock, ms)

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // paused: the world holds its breath — no sim, no replay, just the overlay
    if (paused) { requestAnimationFrame(frame); return; }

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
    // the flight log persists every 30s — a crash loses half a minute, not
    // the match
    if (now >= nextFlightSaveAt) {
      nextFlightSaveAt = now + 30000;
      saveFlight();
    }
    // black-box incidents surface the moment they file — timestamped in sim
    // time so "it bunched up around minute 9" is findable after the fact
    while (bbWarned < world.blackbox.incidents.length) {
      const inc = world.blackbox.incidents[bbWarned++];
      const where = inc.nearBaseOf === null ? 'open field' : inc.nearBaseOf === me.team ? 'YOUR BASE' : 'enemy base';
      console.warn(`[blackbox] ${inc.kind.toUpperCase()} — team ${inc.team}, ${inc.members.length} bodies at (${inc.at.x}, ${inc.at.z}) [${where}] t=${inc.t}s — run __ww.blackbox('report') for the flight log`);
    }
    const events = world.takeEvents();
    hud.applyEvents(events, world, me.id, world.time); // killfeed stays live
    // the score follows the field: soldier → LSW → the monsters (music.ts)
    music.setVolume(settings.masterVolume);
    music.update(world, now);
    // §7: the moment YOU become the weapon (or hand the body back), say so —
    // the Q hint is the whole tutorial
    if (me.ascendant !== pilotBody) {
      pilotBody = me.ascendant;
      if (me.ascendant) {
        const d = LSWS[me.ascendant];
        hud.announce(`YOU ARE ${d.name.toUpperCase()} — Q: ${d.activeLabel}`, true, world.time);
      }
    }
    tracker?.applyEvents(events, world, me.id);
    tracker?.update(world, me.id, dt);
    course?.update(world, dt);
    ringDrill?.update(world, me.id, events);
    if (world.mode.over && tracker) {
      void tracker.finalize(world, me.id).then((sum) => {
        if (!sum) return;
        renderBarracks(); // the record just grew
        // §17.B's third leg, finally visible: fight → record grew → WAR MOVED
        let extras = '';
        // B1 THE WAR LEDGER on the closing screen: both sides' books, and the
        // morale event when the winner fought poor (Robert: "if you won and
        // were underfunded it increased your morale… that officer could do")
        {
          const myTeam = 0 as const;
          const mine = world.warCost(myTeam);
          const theirs = world.warCost(1);
          extras += `<p style="margin-top:0.35rem">⛁ WAR COST — yours ${mine} · theirs ${theirs}</p>`;
          if (world.mode.underdog === myTeam && dossier) {
            dossier.soldier.morale = (dossier.soldier.morale ?? 0) + 1;
            dossier.journal.unshift({
              text: `UNDERFUNDED VICTORY — we won on ${mine} against their ${theirs}. Morale rose to ${dossier.soldier.morale}. An army that believes fights on a fuller stable.`,
              at: Date.now(), matchRef: 'underdog',
            });
            void saveDossier(dossier);
            extras += `<p style="margin-top:0.2rem"><b>★ UNDERFUNDED VICTORY</b> — morale +1 (now ${dossier.soldier.morale}). Next deploy opens with a richer stable.</p>`;
          }
        }
        // the Living Campaign: this battle moves its front (22B)
        let pressFront: { name: string; control: number; delta: number } | undefined;
        if (activeFrontId && campaign) {
          const front = campaign.fronts[activeFrontId];
          const before = front?.control ?? 0;
          // W3.3: your dead spend the front's clones — and CLONE INFECTION
          // doubles the bill for every HOT death (the reprint + the body
          // that rose against the line)
          const viralBill = world.viralDeaths?.[0] ?? 0;
          const operationResult = world.operation?.result;
          if (operationResult) {
            const receipt = settleCampaignOperation(campaign, operationResult, Date.now());
            if (receipt.ok) {
              const treasury = receipt.treasuryDelta >= 0 ? `+${receipt.treasuryDelta}` : String(receipt.treasuryDelta);
              extras += `<p style="margin-top:0.35rem"><b>OPERATION ${operationResult.won ? 'COMPLETE' : 'FAILED'}</b> · treasury ${treasury} · ${receipt.hullsLost.length} hulls lost · ${receipt.hullsReturned.length} returned</p>`;
            } else {
              extras += `<p style="margin-top:0.35rem;color:var(--danger)">OPERATION SETTLEMENT HOLD · ${receipt.errors.join(' · ')}</p>`;
            }
          } else {
            applyResult(campaign, activeFrontId, sum.won, Date.now(), (sum.deaths ?? 0) + viralBill);
          }
          if (viralBill > 0) extras += `<p style="margin-top:0.35rem">☣ ${viralBill} turned — the vats paid double</p>`;
          if (front) {
            const d = front.control - before;
            const fname = FRONTS.find((f) => f.id === activeFrontId)?.name ?? activeFrontId;
            pressFront = { name: fname, control: front.control, delta: d };
            extras += `<p style="margin-top:0.35rem">⚑ ${fname.toUpperCase()}: control ${d >= 0 ? '+' : ''}${d} → ${front.control}</p>`;
          }
          // §13 (decided): a REAL battle can close the season — the Armistice
          const armistice = checkSeasonEnd(campaign);
          if (armistice && dossier) {
            const winnerName = armistice.winner === 'coalition' ? 'The United Front' : 'The Collective';
            dossier.journal.unshift({
              text: `ARMISTICE — Season ${armistice.season} ended with ${winnerName} holding ${armistice.frontsHeld} of ten fronts. I was there when the war closed.`,
              at: Date.now(), matchRef: `season:${armistice.season}`,
            });
            // a tour IS one season (4A): the next tour opens with the new season
            dossier.tours.push({ faction: 0, season: campaign.season, startedAt: Date.now() });
            void saveDossier(dossier);
            // NOTE: this used to `hud.careerHtml +=` and then get clobbered by
            // the assignment below — the Armistice pane never actually showed.
            extras += `<div style="margin-top:0.5rem"><h3>ARMISTICE</h3><p>Season ${armistice.season} is over — ${winnerName} takes the war. The theatre resets; your record remains.</p></div>`;
          }
          saveCampaign(campaign);
          renderScarMap();
        }
        // the goal-gradient line: how close the NEXT grade is, said at the
        // moment of maximum motivation (the Battlefield end-of-round lesson)
        const rk = dossier ? rankFor(dossier.soldier.rankPoints) : null;
        const toNext = rk?.next != null ? `<span>${rk.next - (dossier?.soldier.rankPoints ?? 0)} pts to next grade</span>` : '';
        hud.careerHtml = `<div id="career-pane"><h3>Career — what this match added</h3>
          <div class="cp-row"><span>+${sum.rankPointsGained} rank pts</span>
          <span>${sum.rankBefore === sum.rankAfter ? sum.rankAfter : `${sum.rankBefore} → <b>${sum.rankAfter}</b> ▲`}</span>
          ${toNext}
          <span>${sum.kills} kills · ${sum.deaths} deaths</span></div>
          ${sum.medals.length ? `<div class="cp-row" style="margin-top:0.4rem">${sum.medals.map((m) => `<span class="bk-medal">${m.icon} ${m.name}</span>`).join('')}</div>` : ''}
          ${sum.journal.length ? `<p style="margin-top:0.5rem;color:var(--muted)">📖 ${sum.journal[0].text}</p>` : ''}
          ${extras}</div>`;

        // THE AFTER-ACTION REPORT (Robert: "at the end of the match we need
        // WAY more details — we captured rich data, show rich stuff"): the
        // tracker's hoard + the roster's own counters, finally on screen.
        if (tracker) {
          const meS = world.soldiers.get(me.id);
          const wl = tracker.weaponLines().slice(0, 4);
          let ace = { name: '—', kills: 0 };
          let longShot = { name: '—', d: 0 };
          for (const s2 of world.humansAndBots()) {
            if (s2.kills > ace.kills) ace = { name: s2.name, kills: s2.kills };
            if (s2.longestKill > longShot.d) longShot = { name: s2.name, d: s2.longestKill };
          }
          const yours: string[] = [];
          if (tracker.longestHitDist > 0) yours.push(`🎯 longest ${tracker.longestHitDist.toFixed(0)}u`);
          if (meS && meS.vehicleKills > 0) yours.push(`⛨ hulls ×${meS.vehicleKills}`);
          if (meS && meS.healGiven > 0) yours.push(`✚ healed ${Math.round(meS.healGiven)}`);
          const moments = tracker.moments();
          const nem = tracker.nemesis();
          const prey = tracker.prey();
          const duels = [
            nem ? `<span>☠ nemesis — <b>${nem.name}</b> got you ×${nem.n}</span>` : '',
            prey ? `<span>🎯 your prey — <b>${prey.name}</b> ×${prey.n}</span>` : '',
          ].filter(Boolean).join('');
          hud.careerHtml += `<div id="aar-pane"><h3>After-Action Report</h3>
            ${wl.length ? `<div class="cp-row">${wl.map((w) => `<span>${w.weapon} <b>×${w.kills}</b></span>`).join('')}</div>` : ''}
            ${yours.length ? `<div class="cp-row" style="margin-top:0.3rem">${yours.map((y) => `<span>${y}</span>`).join('')}</div>` : ''}
            ${duels ? `<div class="cp-row" style="margin-top:0.3rem">${duels}</div>` : ''}
            ${moments.length ? `<div class="cp-row" style="margin-top:0.3rem">${moments.map((m) => `<span class="aar-moment">${m}</span>`).join('')}</div>` : ''}
            <div class="cp-row" style="margin-top:0.3rem"><span>★ battle ace — <b>${ace.name}</b> ×${ace.kills}</span>
            ${longShot.d > 0 ? `<span>🎯 longest shot of the match — <b>${longShot.name}</b>, ${longShot.d.toFixed(0)}u</span>` : ''}</div>
          </div>`;
        }

        // N1 THE PRESS FILES (Robert: "we could literally make newspapers…
        // to show all the three things that happened"). One issue per battle:
        // the duel, the money, the field. Archived as data in the MAP tab.
        {
          let ace = { name: '—', kills: 0 };
          let longest = 0;
          for (const s2 of world.humansAndBots()) {
            if (s2.kills > ace.kills) ace = { name: s2.name, kills: s2.kills };
            if (s2.longestKill > longest) longest = s2.longestKill;
          }
          const kills: [number, number] = [0, 0];
          for (const s2 of world.humansAndBots()) kills[s2.team] += s2.kills;
          fileIssue({
            at: Date.now(),
            season: campaign?.season ?? 1,
            frontName: pressFront?.name,
            controlAfter: pressFront?.control,
            controlDelta: pressFront?.delta,
            won: sum.won === true, // a draw prints as a hard day, not a win
            modeName: MODE_INFO[world.mode.id]?.name ?? world.mode.id.toUpperCase(),
            aceName: ace.name, aceKills: ace.kills, longestShot: Math.round(longest),
            myCost: world.warCost(0), theirCost: world.warCost(1),
            underdog: world.mode.underdog === 0,
            morale: dossier?.soldier.morale,
            myKills: kills[0], theirKills: kills[1],
            medals: sum.medals.map((m) => `${m.icon} ${m.name}`),
          });
          // the freshest front page goes straight onto the closing screen
          const latest = loadPress()[0];
          if (latest) hud.careerHtml += `<div style="margin-top:0.7rem">${renderIssueHTML(latest)}</div>`;
        }
      });
    }

    const { renderWorld, banner: bannerText } = director.update(world, me.id, dt);
    const replaying = renderWorld !== world;
    setBanner(bannerText);
    // live-world VFX/sounds only belong on the live view — a replay scene
    // getting present-time explosions would show phantom battles
    if (!replaying) renderer.applyEvents(events, world, me.id);
    if (!replaying) dmgText.applyEvents(events, me.id); // floating -HP (red) / -ARMOR (blue), YOURS only
    renderer.replayView = replaying;
    // killcam pulls in tight on the fight; otherwise the player's wheel zoom
    renderer.camDist = replaying && director.killcamActive ? director.killcamCam : input.camDist;
    // duel framing: show the killer, answer "where did that come from?"
    renderer.killcamFocusId = replaying && director.killcamActive ? director.killerId : -1;
    // grenade throw preview: hold G → arc + landing ring at the cursor
    renderer.setGrenadePreview(world, me, !replaying && input.grenadeAiming ? input.aimPoint(renderer.camera) : null, input.grenadeLob);
    // UI P0 bug fix: hover-to-read vitals were wired only in the NET loop —
    // offline matches never fed the cursor, so unit tags + enemy rings never
    // appeared. The cursor drives them here too. (docs/UI-MASTER.md §13)
    renderer.setHover(replaying ? null : input.aimPoint(renderer.camera));
    // §8.8: heavy weather closes the long view — the sky caps the wheel
    const wxMods = WEATHER_MODS[renderWorld.weather?.kind ?? 'clear'];
    input.weatherZoomCap = wxMods.zoomCap !== undefined && (renderWorld.weather?.intensity ?? 0) > 0.3
      ? wxMods.zoomCap : Infinity;
    renderer.update(renderWorld, me.id, dt, hud.getWaypoints());
    dmgText.update(dt, renderer.camera); // project the floating numbers after the camera moves
    hud.update(world, me.id, input.scoreboardHeld, world.time);

    // FPV drone feed: noise rises as the signal drops; disconnect = full burst
    const fpv = world.getPilotedDrone(me.id);
    staticFx.set(fpv ? Math.pow(1 - (fpv.signal ?? 1), 1.15) : 0);
    if (fpv && (fpv.signal ?? 1) < 0.45 && world.time > nextStaticAt) {
      audio.play('drone_static', { volume: 0.25 + (1 - (fpv.signal ?? 1)) * 0.6 });
      nextStaticAt = world.time + 0.75;
    }
    if (hadDrone && !fpv) { staticFx.flash(0.6); audio.play('drone_static', { volume: 0.9 }); }
    hadDrone = !!fpv;
    staticFx.update();

    // linger after the whistle: trophies + looping highlights deserve a look
    if (world.mode.over) {
      if (!overAt) {
        overAt = now;
        // §14: the onboarding machine reads every finished match exactly once —
        // by the WORLD's mode, never the module selection (a stray menu launch
        // once recorded a CTF match as a paintball skirmish through that gap)
        onMatchEnd(world, me.id, world.mode.id);
        // the yard's one legacy beat: the round's longest splat, celebrated
        // where it happened (Robert: 'show them whoever got the longest shot')
        if (world.mode.id === 'paintball') {
          const best = [...world.humansAndBots()].reduce((a, s) => (s.longestKill > a.longestKill ? s : a));
          if (best.longestKill > 0) {
            hud.careerHtml = `<div id="career-pane"><h3>YARD HIGHLIGHT</h3>
              <p>★ LONGEST SPLAT — <b>${best.name}</b>, ${best.longestKill.toFixed(0)}u${best.id === me.id ? ' — that one goes on the wall' : ''}</p></div>`;
          }
        }
      }
      // paintball rounds are snappy; their tail should be too — and any key
      // after a beat skips the linger in every mode (the AAR is a look, not a jail)
      else if (now - overAt > (world.mode.id === 'paintball' ? 8000 : MATCH_LINGER_LOCAL_MS)
        || (now - overAt > 3000 && lingerSkip)) { endGame(); return; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// The Dossier (§3.4) + the menu tab shell (6B): Deploy | Barracks | Map.
// ---------------------------------------------------------------------------
let dossier: Dossier | null = null;
let rangeOfficial = false; // 18B: set ONLY by the explicit confirm

function renderBarracks() {
  const root = $('barracks-root');
  if (!dossier) { root.innerHTML = '<p class="bk-empty">No record on file yet.</p>'; return; }
  const d = dossier;
  const rank = rankFor(d.soldier.rankPoints);
  const nextTxt = rank.next !== null ? `${d.soldier.rankPoints} / ${rank.next} pts to next grade` : `${d.soldier.rankPoints} pts — top of the ladder`;
  const classRows = Object.entries(d.lifetime.perClass).map(([id, r]) =>
    `<div class="bk-stat-row"><span>${id}</span><b>${r.kills} K · ${r.deaths} D · ${r.wins}/${r.matches} won</b></div>`).join('') ||
    '<p class="bk-empty">No deployments yet.</p>';
  const weaponRows = Object.entries(d.lifetime.perWeapon)
    .sort((x, y) => y[1].kills - x[1].kills).slice(0, 8).map(([w, r]) =>
      `<div class="bk-stat-row"><span>${w}</span><b>${r.kills} kills · best ${r.longestHit}u</b></div>`).join('') ||
    '<p class="bk-empty">The armory awaits its first story.</p>';
  const medals = d.medals.length
    ? d.medals.slice(-24).reverse().map((m) => `<span class="bk-medal" title="${new Date(m.earnedAt).toLocaleDateString()}">${m.icon} ${m.name}</span>`).join('')
    : '<p class="bk-empty">No decorations yet — they are earned, never bought.</p>';
  const journal = d.journal.length
    ? `<ul class="bk-journal">${d.journal.slice(0, 25).map((j) =>
        `<li>${j.text}<span class="when">${new Date(j.at).toLocaleString()}</span></li>`).join('')}</ul>`
    : '<p class="bk-empty">The journal opens with your first battle.</p>';
  root.innerHTML = `
    <div class="bk-head">
      <span class="bk-callsign">${d.soldier.callsign}</span>
      <span class="bk-rank">${rank.name}</span>
      <span class="bk-next">${nextTxt}</span>
    </div>
    <div class="bk-grid">
      <div class="bk-card"><h4>Service record</h4>
        <div class="bk-stat-row"><span>Matches</span><b>${d.lifetime.matches}</b></div>
        <div class="bk-stat-row"><span>Wins</span><b>${d.lifetime.wins}</b></div>
        <div class="bk-stat-row"><span>Kills / Deaths</span><b>${d.lifetime.kills} / ${d.lifetime.deaths}</b></div>
        <div class="bk-stat-row"><span>Score</span><b>${d.lifetime.score}</b></div>
      </div>
      <div class="bk-card"><h4>By class</h4>${classRows}</div>
      <div class="bk-card"><h4>Gun locker — service history</h4>${weaponRows}</div>
      <div class="bk-card"><h4>Qualifications — the Proving Grounds</h4>${(() => {
        const q = d.quals.infantry;
        const wall = loadWall();
        const top = wall.slice(0, 5).map((w, i) =>
          `<div class="bk-stat-row"><span>#${i + 1} ${w.callsign}${w.official ? '' : ' <em style="opacity:0.6">(practice)</em>'}</span><b>${w.score}</b></div>`).join('');
        return `${q
          ? `<p style="margin-bottom:0.4rem">🎖 <b>Infantry — ${q.grade}</b> · ${q.score} pts · ${q.percentile}th percentile<br><span class="bk-empty">official attempt, ${new Date(q.firstAttemptAt).toLocaleDateString()} — the Wall never forgets your first</span></p>`
          : '<p class="bk-empty" style="margin-bottom:0.4rem">Infantry course: unqualified. Practice free — the official run is one shot, forever (18B).</p>'}
        <div style="display:flex; gap:0.4rem; margin:0.4rem 0 0.6rem">
          <button class="pill" id="pg-practice">🎯 Practice run</button>
          ${q ? '' : '<button class="pill" id="pg-official" style="border-color:var(--accent);color:var(--accent)">⚠ Official attempt</button>'}
        </div>
        ${top ? `<h4 style="margin-top:0.5rem">The Wall (local)</h4>${top}` : ''}`;
      })()}</div>
    </div>
    <div class="bk-card" style="margin-bottom:0.75rem"><h4>Decorations (${d.medals.length})</h4>${medals}</div>
    <div class="bk-card"><h4>War journal</h4>${journal}</div>`;
  const practice = root.querySelector<HTMLButtonElement>('#pg-practice');
  if (practice) practice.onclick = () => {
    activeFrontId = null; rangeOfficial = false; selectedMode = 'range'; startGame();
  };
  const official = root.querySelector<HTMLButtonElement>('#pg-official');
  if (official) official.onclick = () => {
    // 18B: a permanent score is only meaningful when knowingly accepted
    const warning = 'OFFICIAL QUALIFICATION ATTEMPT\n\nThis one counts — forever. Your score and percentile go on The Wall and in your dossier, permanently. Practice runs are unlimited; official is one shot.\n\nReady?';
    if (confirm(warning)) {
      activeFrontId = null; rangeOfficial = true; selectedMode = 'range'; startGame();
    }
  };
}

function wireMenuTabs() {
  const tabs = document.querySelectorAll<HTMLButtonElement>('#menu-tabs .mtab');
  tabs.forEach((t) => t.onclick = () => {
    audio.play('ui_click');
    tabs.forEach((x) => x.classList.toggle('active', x === t));
    for (const pane of ['deploy', 'barracks', 'map', 'codex']) {
      $(`tab-${pane}`).classList.toggle('hidden', pane !== t.dataset.tab);
    }
    if (t.dataset.tab === 'barracks') renderBarracks();
    if (t.dataset.tab === 'map') { renderScarMap(); renderPressInto($('press-root')); }
    // the Codex owns a live turntable — it only spins while you are looking
    if (t.dataset.tab === 'codex') renderCodex($('codex-root')); else pauseCodex();
  });
}

void loadDossier((($('player-name') as HTMLInputElement)?.value || 'Recruit').slice(0, 16))
  .then((d) => {
    dossier = d; renderBarracks(); void saveDossier(d);
    // W3.9: the rank rides the in-match vitals from the moment the record loads
    const r = rankFor(d.soldier.rankPoints);
    setRankChip(rankInsignia(r.index), r.name);
  });
void RANKS; // ladder is part of the public record API

// ---------------------------------------------------------------------------
// The Scar (§8.5): the theater map IS the front-selection screen. Markers are
// live overlays on the painted art; control moves with your battles (22B);
// W3.1: the war only moves while you play — an absence writes ONE honest
// "the fronts held" line and touches nothing.
// ---------------------------------------------------------------------------
let campaign: Campaign | null = null;
let scarMarkers: Record<string, { n: number; name: string; x: number; y: number }> | null = null;
let operationManifestDraft: OperationManifest | null = null;
let operationManifestPlan: OperationPlan | null = null;

async function initCampaign() {
  campaign = loadCampaign();
  holdTheLine(campaign);
  if (campaign.activeOperation) {
    activeFrontId = campaign.activeOperation.plan.frontId;
    const front = FRONTS.find((entry) => entry.id === activeFrontId);
    if (front) { selectedMode = front.mode; selectedTheme = front.theme; }
  }
  saveCampaign(campaign); // always: the absence clock starts at first boot
  try {
    scarMarkers = (await (await fetch('/scar-markers.json')).json()).fronts;
  } catch { scarMarkers = null; }
  renderScarMap();
}

function closeOperationPlanner() {
  document.getElementById('operation-modal')?.remove();
  operationManifestDraft = null;
  operationManifestPlan = null;
}

function paintOperationPlanner() {
  if (!campaign || !operationManifestPlan || !operationManifestDraft) return;
  const old = document.getElementById('operation-modal');
  const scroll = old?.querySelector<HTMLElement>('.op-hulls')?.scrollTop ?? 0;
  old?.remove();
  document.body.insertAdjacentHTML('beforeend', renderManifestDialog({
    campaign,
    plan: operationManifestPlan,
    manifest: operationManifestDraft,
  }));
  const modal = document.getElementById('operation-modal')!;
  const hulls = modal.querySelector<HTMLElement>('.op-hulls');
  if (hulls) hulls.scrollTop = scroll;
  modal.querySelectorAll<HTMLInputElement>('[data-operation-hull]').forEach((input) => {
    input.onchange = () => {
      if (!operationManifestDraft) return;
      const id = input.dataset.operationHull!;
      operationManifestDraft.hullIds = input.checked
        ? [...new Set([...operationManifestDraft.hullIds, id])]
        : operationManifestDraft.hullIds.filter((hullId) => hullId !== id);
      paintOperationPlanner();
    };
  });
  const ammo = modal.querySelector<HTMLInputElement>('#operation-ammo');
  if (ammo) ammo.onchange = () => {
    if (!operationManifestDraft) return;
    operationManifestDraft.ammunition = Number(ammo.value);
    paintOperationPlanner();
  };
  const support = modal.querySelector<HTMLSelectElement>('#operation-support');
  if (support) support.onchange = () => {
    if (!operationManifestDraft) return;
    operationManifestDraft.support = support.value as OperationManifest['support'];
    paintOperationPlanner();
  };
  const close = () => closeOperationPlanner();
  modal.querySelector<HTMLButtonElement>('#operation-close')!.onclick = close;
  modal.querySelector<HTMLButtonElement>('#operation-abort')!.onclick = close;
  modal.onclick = (event) => { if (event.target === modal) close(); };
  const stage = modal.querySelector<HTMLButtonElement>('#operation-stage');
  if (stage) stage.onclick = () => {
    if (!campaign || !operationManifestPlan || !operationManifestDraft) return;
    const result = stageCampaignOperation(campaign, operationManifestPlan, operationManifestDraft);
    if (!result.ok) { paintOperationPlanner(); return; }
    activeFrontId = operationManifestPlan.frontId;
    saveCampaign(campaign);
    closeOperationPlanner();
    audio.play('ui_click');
    renderScarMap();
  };
}

function openOperationPlanner(plan: OperationPlan) {
  if (!campaign) return;
  operationManifestPlan = plan;
  operationManifestDraft = createSuggestedManifest(plan, campaign.motorPool);
  paintOperationPlanner();
}

function renderScarMap() {
  const root = $('map-root');
  if (!campaign) return;
  const c = campaign;
  const markers = FRONTS.map((f) => {
    const m = scarMarkers?.[f.id];
    const st = c.fronts[f.id];
    if (!m || !st) return '';
    const band = bandOf(st.control);
    const tip = `${f.name} — control ${st.control > 0 ? '+' : ''}${st.control}` +
      `${st.scarActive ? ` · ${SCAR_TEXT[f.scar]}` : ''}`;
    return `<button class="scar-marker band-${band}${activeFrontId === f.id ? ' sel' : ''}"
      style="left:${(m.x * 100).toFixed(2)}%; top:${(m.y * 100).toFixed(2)}%"
      data-front="${f.id}" title="${tip}"><span>${m.n}</span></button>`;
  }).join('');
  const sel = activeFrontId ? FRONTS.find((f) => f.id === activeFrontId) : null;
  const selSt = sel ? c.fronts[sel.id] : null;
  const operationModel = sel ? buildOperationBoardModel(c, sel.id) : null;
  const selHtml = sel && selSt
    ? `<b style="font-size:1.05rem">${sel.name}</b>
       <p style="color:var(--muted);font-size:0.8rem;margin:0.3rem 0">${sel.mode.toUpperCase()} · ${sel.theme} · control <b>${selSt.control > 0 ? '+' : ''}${selSt.control}</b> (${bandOf(selSt.control)})</p>
       ${selSt.scarActive ? `<p style="font-size:0.8rem;color:var(--danger)">⚑ ${SCAR_TEXT[sel.scar]}</p>` : ''}
       <button id="front-deploy">DEPLOY QUICK BATTLE · ${sel.name.toUpperCase()}</button>`
    : '<p class="bk-empty">Select a front on the theater map. Your battles move its control.</p>';
  const dispatch = c.dispatch.slice(0, 10).map((d) =>
    `<li>${d.simulated ? '<em style="color:var(--muted)">(simulated)</em> ' : ''}${d.text}<span class="when">${new Date(d.at).toLocaleString()}</span></li>`).join('')
    || '<li class="bk-empty" style="border:none">No dispatches yet — the war awaits its first battle.</li>';
  root.innerHTML = `
    <div id="scar-layout">
      <div id="scar-wrap"><img src="/scar-map.png" alt="THE SCAR — theater map" draggable="false" />${markers}</div>
      <div id="scar-side">
        <div class="bk-card">${selHtml}</div>
        ${operationModel ? renderOperationsBoard(operationModel) : ''}
        <div class="bk-card"><h4>Morning dispatch</h4><ul class="bk-journal">${dispatch}</ul></div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLButtonElement>('.scar-marker').forEach((btn) => {
    btn.onclick = () => {
      audio.play('ui_click');
      const f = FRONTS.find((x) => x.id === btn.dataset.front)!;
      activeFrontId = f.id;
      selectedMode = f.mode;
      selectedTheme = f.theme;
      renderScarMap();
    };
  });
  const dep = root.querySelector<HTMLButtonElement>('#front-deploy');
  if (dep) dep.onclick = () => { startGame(); };
  const plan = root.querySelector<HTMLButtonElement>('#operation-plan');
  if (plan && operationModel) plan.onclick = () => openOperationPlanner(operationModel.plan);
  const operationDeploy = root.querySelector<HTMLButtonElement>('#operation-deploy');
  if (operationDeploy) operationDeploy.onclick = () => { startGame(); };
  const cancel = root.querySelector<HTMLButtonElement>('#operation-cancel');
  if (cancel && c.activeOperation) cancel.onclick = () => {
    const active = c.activeOperation;
    if (!active || !window.confirm(`Cancel Operation ${active.plan.codename} and return its entire commitment?`)) return;
    cancelCampaignOperation(c, active.plan.id);
    saveCampaign(c);
    audio.play('ui_click');
    renderScarMap();
  };
}

void initCampaign();

buildMenu();
wireSetupControls();
wireArmory();
wireMenuTabs();

// settings (§18/§10.3): volume + comfort, persisted, applied live
loadSettings();
audio.setMasterVolume(settings.masterVolume);
{
  const vol = $('set-volume') as HTMLInputElement;
  const volVal = $('vol-val');
  vol.value = String(Math.round(settings.masterVolume * 100));
  volVal.textContent = `${vol.value}%`;
  vol.oninput = () => {
    settings.masterVolume = Number(vol.value) / 100;
    volVal.textContent = `${vol.value}%`;
    audio.setMasterVolume(settings.masterVolume);
    saveSettings();
  };
  const rm = $('set-reduced') as HTMLInputElement;
  rm.checked = settings.reducedMotion;
  rm.onchange = () => { settings.reducedMotion = rm.checked; saveSettings(); };
  const blood = $('set-blood') as HTMLSelectElement;
  blood.value = settings.blood;
  blood.onchange = () => { settings.blood = blood.value as BloodLevel; saveSettings(); };
  // READING THE DARK (plan A2 step 5): sight is accessibility — one click off
  const dark = $('set-darkness') as HTMLSelectElement;
  dark.value = settings.darkness;
  dark.onchange = () => { settings.darkness = dark.value as DarknessLevel; saveSettings(); };

  // GLOBAL SPEED KNOBS (Robert): projectile + movement + VEHICLE, live-tunable. The
  // sliders write settings AND push straight to any running match, so you
  // can dial a slower bullet and watch it change mid-fight. Applied to the
  // world at every deploy too (see startGame). 25–200% → 0.25–2.0×.
  const projSpd = $('set-projspeed') as HTMLInputElement;
  const projVal = $('projspd-val');
  const moveSpd = $('set-movespeed') as HTMLInputElement;
  const moveVal = $('movespd-val');
  // the hull knob exists because the other two created a bug: slow the rounds
  // to 0.35× and a 22u/s buggy simply outruns the grenade chasing it
  const vehSpd = $('set-vehspeed') as HTMLInputElement;
  const vehVal = $('vehspd-val');
  const syncSpeed = () => {
    projSpd.value = String(Math.round(settings.projectileSpeed * 100));
    moveSpd.value = String(Math.round(settings.moveSpeed * 100));
    vehSpd.value = String(Math.round(settings.vehicleSpeed * 100));
    projVal.textContent = `${(settings.projectileSpeed).toFixed(2)}×`;
    moveVal.textContent = `${(settings.moveSpeed).toFixed(2)}×`;
    vehVal.textContent = `${(settings.vehicleSpeed).toFixed(2)}×`;
  };
  const pushSpeed = () => {
    const live = (window as unknown as { __ww?: { world?: { projectileSpeedMul: number; moveSpeedMul: number; vehicleSpeedMul: number } } }).__ww?.world;
    if (live) {
      live.projectileSpeedMul = settings.projectileSpeed;
      live.moveSpeedMul = settings.moveSpeed;
      live.vehicleSpeedMul = settings.vehicleSpeed;
    }
  };
  syncSpeed();
  projSpd.oninput = () => { settings.projectileSpeed = Number(projSpd.value) / 100; projVal.textContent = `${settings.projectileSpeed.toFixed(2)}×`; saveSettings(); pushSpeed(); };
  moveSpd.oninput = () => { settings.moveSpeed = Number(moveSpd.value) / 100; moveVal.textContent = `${settings.moveSpeed.toFixed(2)}×`; saveSettings(); pushSpeed(); };
  vehSpd.oninput = () => { settings.vehicleSpeed = Number(vehSpd.value) / 100; vehVal.textContent = `${settings.vehicleSpeed.toFixed(2)}×`; saveSettings(); pushSpeed(); };
  // RESET GOES HOME, NOT TO 1.0 — home is Robert's tuned feel (0.35 / 0.80 /
  // 0.80), which is what "default" means here now. Resetting to 1.0 would have
  // quietly undone the tuning every time someone poked the button.
  ($('set-speed-reset') as HTMLButtonElement).onclick = () => {
    settings.projectileSpeed = 0.35; settings.moveSpeed = 0.8; settings.vehicleSpeed = 0.8;
    saveSettings(); syncSpeed(); pushSpeed();
  };
}
$('deploy-btn').addEventListener('click', () => { activeFrontId = null; startGame(); });
window.addEventListener('keydown', (e) => {
  // Enter deploys ONLY when the menu is the actual front surface — with the
  // onboarding overlay up, an Enter here once launched an invisible CTF
  // underneath and soft-locked boot camp (running=true killed its button)
  if (e.key === 'Enter' && !running && !$('menu').classList.contains('hidden')
    && $('onboarding').classList.contains('hidden')) startGame();
});

// §14 THE FIRST HOUR: new recruits skip the menu entirely — boot camp is a
// paintball match. The overlay drives marker/field pick → skirmishes →
// profile → first war drop → the path split; veterans never see it again.
mountOnboarding({
  launch(cfg) {
    selectedMode = cfg.mode;
    selectedTheme = cfg.theme;
    seedOverride = cfg.seed;
    if (cfg.classId) selectedClass = cfg.classId;
    if (cfg.equipment) selectedEquipment = cfg.equipment.filter((id) => EQUIPMENT[id]);
    activeFrontId = null;
    startGame();
  },
});
