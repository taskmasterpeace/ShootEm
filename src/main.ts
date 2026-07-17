import { CLASSES, EQUIPMENT, MODE_INFO, THEMES, WEAPONS } from './sim/data';
import { CLASS_ARMORY, familyWeapons } from './sim/arsenal';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd, type Team, type ThemeId, type WeaponDef, type WeaponFamily, type WeaponId } from './sim/types';
import { LSWS, lswAllowed, lswsForTeam } from './sim/lsw';
import { World, type Difficulty, type Loadout } from './sim/world';
import { WEATHER_MODS } from './sim/weather';
import { mountOnboarding, onMatchEnd, paintballConfig } from './client/onboarding';
import { audio } from './client/audio';
import { Chat } from './client/chat';
import { StaticOverlay } from './client/effects';
import { Hud } from './client/hud';
import { Input } from './client/input';
import { Renderer } from './client/renderer';
import { NetGame } from './client/net';
import { KILLCAM_CAM, MATCH_LINGER_LOCAL_MS, ReplayDirector } from './client/replay';
import { MatchTracker, RANKS, loadDossier, rankFor, saveDossier, type Dossier } from './client/record';
import { FRONTS, SCAR_TEXT, applyResult, bandOf, checkSeasonEnd, loadCampaign, saveCampaign, simulateTimeSkip, type Campaign } from './client/campaign';
import { RangeCourse, gradeFor, loadWall } from './client/range';
import { loadSettings, saveSettings, settings, type BloodLevel } from './client/settings';

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

function startLocal(renderer: Renderer, hud: Hud, input: Input, name: string, endGame: () => void) {
  const seed = seedOverride ?? (Math.random() * 0xffffffff) >>> 0;
  seedOverride = undefined;
  const world = new World({
    seed, mode: selectedMode, difficulty, botsPerTeam, matchMinutes, theme: selectedTheme,
    frontId: activeFrontId ?? undefined, // §8.2: a Scar deploy lands on AUTHORED ground
  });
  // carry the feel knobs into the match (Robert's global speed control)
  world.projectileSpeedMul = settings.projectileSpeed;
  world.moveSpeedMul = settings.moveSpeed;
  const me = world.addSoldier(name, selectedClass, 0, 'human', currentLoadout());
  applyScarMods(world, activeFrontId); // §8.5: the front's wound shapes the field
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
      world.addSoldier(wrap(n++), 'infantry', 1, 'bot', { primary: 'marker_pump' });
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
  hud.announce(MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
  // §7: tell the player the officer channel is open (once per deploy)
  if (lswAllowed(selectedMode)) {
    const [a, b] = lswsForTeam(0 as Team);
    if (a) hud.announce(`OFFICER CHANNEL — V: CALL ${LSWS[a].name.toUpperCase()}${b ? ` · SHIFT+V: ${LSWS[b].name.toUpperCase()}` : ''}`, false, 0);
  }
  (window as unknown as Record<string, unknown>).__ww = { world, me, renderer, hud, input, audio, recorder: director.recorder, replay: director.player, director }; // debug/testing handle

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
    else if ((e.key === 'v' || e.key === 'V') && !paused && !world.puppet) {
      // §7 THE OFFICER CHANNEL: V calls your faction's first LSW, ⇧V the
      // second. The LZ is WHERE YOU STAND — hold it through the telegraph
      // and the pod is yours: your trooper ascends into the weapon.
      const picks = lswsForTeam(0 as Team);
      const id = e.shiftKey ? picks[1] : picks[0];
      if (!id) return;
      if (world.requestLsw(id, 0, me.id)) {
        hud.announce(`${LSWS[id].name.toUpperCase()} CALLED — HOLD THE MARK, THE POD IS YOURS`, false, world.time);
      } else if (!lswAllowed(world.mode.id)) {
        hud.announce('NO LSW WALKS IN THE YARD', false, world.time);
      } else {
        hud.announce('OFFICER CHANNEL BUSY — ONE WEAPON PER FACTION', false, world.time);
      }
    }
  };
  window.addEventListener('keydown', onKey); // page reload on endGame cleans up
  const cmds = new Map<number, PlayerCmd>();
  // FPV drone feed: static builds as the link degrades; bursts on disconnect
  const staticFx = new StaticOverlay();
  let hadDrone = false;
  let nextStaticAt = 0;
  let pilotBody: string | undefined; // §7: announce each ascension exactly once

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
    const events = world.takeEvents();
    hud.applyEvents(events, world, me.id, world.time); // killfeed stays live
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
    if (world.mode.over && tracker) {
      void tracker.finalize(world, me.id).then((sum) => {
        if (!sum) return;
        renderBarracks(); // the record just grew
        // §17.B's third leg, finally visible: fight → record grew → WAR MOVED
        let extras = '';
        // the Living Campaign: this battle moves its front (22B)
        if (activeFrontId && campaign) {
          const front = campaign.fronts[activeFrontId];
          const before = front?.control ?? 0;
          applyResult(campaign, activeFrontId, sum.won);
          if (front) {
            const d = front.control - before;
            const fname = FRONTS.find((f) => f.id === activeFrontId)?.name ?? activeFrontId;
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
      });
    }

    const { renderWorld, banner: bannerText } = director.update(world, me.id, dt);
    const replaying = renderWorld !== world;
    setBanner(bannerText);
    // live-world VFX/sounds only belong on the live view — a replay scene
    // getting present-time explosions would show phantom battles
    if (!replaying) renderer.applyEvents(events, world, me.id);
    renderer.replayView = replaying;
    // killcam pulls in tight on the fight; otherwise the player's wheel zoom
    renderer.camDist = replaying && director.killcamActive ? KILLCAM_CAM : input.camDist;
    // duel framing: show the killer, answer "where did that come from?"
    renderer.killcamFocusId = replaying && director.killcamActive ? director.killerId : -1;
    // grenade throw preview: hold G → arc + landing ring at the cursor
    renderer.setGrenadePreview(world, me, !replaying && input.grenadeAiming ? input.aimPoint(renderer.camera) : null, input.grenadeLob);
    // §8.8: heavy weather closes the long view — the sky caps the wheel
    const wxMods = WEATHER_MODS[renderWorld.weather?.kind ?? 'clear'];
    input.weatherZoomCap = wxMods.zoomCap !== undefined && (renderWorld.weather?.intensity ?? 0) > 0.3
      ? wxMods.zoomCap : Infinity;
    renderer.update(renderWorld, me.id, dt, hud.getWaypoints());
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
          `<div class="bk-stat-row"><span>#${i + 1} ${w.callsign}${w.official ? '' : ' <em style=\"opacity:0.6\">(practice)</em>'}</span><b>${w.score}</b></div>`).join('');
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
    for (const pane of ['deploy', 'barracks', 'map']) {
      $(`tab-${pane}`).classList.toggle('hidden', pane !== t.dataset.tab);
    }
    if (t.dataset.tab === 'barracks') renderBarracks();
    if (t.dataset.tab === 'map') renderScarMap();
  });
}

void loadDossier((($('player-name') as HTMLInputElement)?.value || 'Recruit').slice(0, 16))
  .then((d) => { dossier = d; renderBarracks(); void saveDossier(d); });
void RANKS; // ladder is part of the public record API

// ---------------------------------------------------------------------------
// The Scar (§8.5): the theater map IS the front-selection screen. Markers are
// live overlays on the painted art; control moves with your battles (22B);
// absence is simulated honestly on launch (27B).
// ---------------------------------------------------------------------------
let campaign: Campaign | null = null;
let scarMarkers: Record<string, { n: number; name: string; x: number; y: number }> | null = null;

async function initCampaign() {
  campaign = loadCampaign();
  simulateTimeSkip(campaign);
  saveCampaign(campaign); // always: the absence clock starts at first boot
  try {
    scarMarkers = (await (await fetch('/scar-markers.json')).json()).fronts;
  } catch { scarMarkers = null; }
  renderScarMap();
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
  const selHtml = sel && selSt
    ? `<b style="font-size:1.05rem">${sel.name}</b>
       <p style="color:var(--muted);font-size:0.8rem;margin:0.3rem 0">${sel.mode.toUpperCase()} · ${sel.theme} · control <b>${selSt.control > 0 ? '+' : ''}${selSt.control}</b> (${bandOf(selSt.control)})</p>
       ${selSt.scarActive ? `<p style="font-size:0.8rem;color:var(--danger)">⚑ ${SCAR_TEXT[sel.scar]}</p>` : ''}
       <button id="front-deploy">⚔ DEPLOY — ${sel.name.toUpperCase()}</button>`
    : '<p class="bk-empty">Select a front on the theater map. Your battles move its control.</p>';
  const dispatch = c.dispatch.slice(0, 10).map((d) =>
    `<li>${d.simulated ? '<em style="color:var(--muted)">(simulated)</em> ' : ''}${d.text}<span class="when">${new Date(d.at).toLocaleString()}</span></li>`).join('')
    || '<li class="bk-empty" style="border:none">No dispatches yet — the war awaits its first battle.</li>';
  root.innerHTML = `
    <div id="scar-layout">
      <div id="scar-wrap"><img src="/scar-map.png" alt="THE SCAR — theater map" draggable="false" />${markers}</div>
      <div id="scar-side">
        <div class="bk-card">${selHtml}</div>
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

  // GLOBAL SPEED KNOBS (Robert): projectile + movement, live-tunable. The
  // sliders write settings AND push straight to any running match, so you
  // can dial a slower bullet and watch it change mid-fight. Applied to the
  // world at every deploy too (see startGame). 25–200% → 0.25–2.0×.
  const projSpd = $('set-projspeed') as HTMLInputElement;
  const projVal = $('projspd-val');
  const moveSpd = $('set-movespeed') as HTMLInputElement;
  const moveVal = $('movespd-val');
  const syncSpeed = () => {
    projSpd.value = String(Math.round(settings.projectileSpeed * 100));
    moveSpd.value = String(Math.round(settings.moveSpeed * 100));
    projVal.textContent = `${(settings.projectileSpeed).toFixed(2)}×`;
    moveVal.textContent = `${(settings.moveSpeed).toFixed(2)}×`;
  };
  const pushSpeed = () => {
    const live = (window as unknown as { __ww?: { world?: { projectileSpeedMul: number; moveSpeedMul: number } } }).__ww?.world;
    if (live) { live.projectileSpeedMul = settings.projectileSpeed; live.moveSpeedMul = settings.moveSpeed; }
  };
  syncSpeed();
  projSpd.oninput = () => { settings.projectileSpeed = Number(projSpd.value) / 100; projVal.textContent = `${settings.projectileSpeed.toFixed(2)}×`; saveSettings(); pushSpeed(); };
  moveSpd.oninput = () => { settings.moveSpeed = Number(moveSpd.value) / 100; moveVal.textContent = `${settings.moveSpeed.toFixed(2)}×`; saveSettings(); pushSpeed(); };
  ($('set-speed-reset') as HTMLButtonElement).onclick = () => {
    settings.projectileSpeed = 1; settings.moveSpeed = 1; saveSettings(); syncSpeed(); pushSpeed();
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
