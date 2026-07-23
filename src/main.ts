import { CLASSES, EQUIPMENT, MODE_INFO, THEMES, WEAPONS } from './sim/data';
import { CLASS_ARMORY, familyWeapons } from './sim/arsenal';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd, type Team, type ThemeId, type VehicleKind, type WeaponDef, type WeaponFamily, type WeaponId } from './sim/types';
import { LSWS, lswAllowed, lswsForTeam } from './sim/lsw';
import { World, type Difficulty, type Loadout } from './sim/world';
import { ammoReport, blackboxReport, type BbIncident, type BbSample } from './sim/blackbox';
import { vehicleTelemetryReport, vehicleTelemetrySnapshot, type VehicleTelemetrySnapshot } from './sim/vehicle-telemetry';
import { mapSizeForPlayers } from './sim/fronts';
import { WEATHER_MODS } from './sim/weather';
import { loadOnboarding, mountOnboarding, onMatchEnd, paintballConfig } from './client/onboarding';
import { buildVanessasMap, SHOP_ENTRANCE, spawnVanessa, updateShopInteract } from './client/vanessas-place';
import { clockLabel, gameNow } from './client/worldclock';
import { mountFrontend } from './client/frontend';
import { GhostPlayer, GhostRecorder, ghostKey, loadGhost, saveGhost } from './client/ghost';
import { clearIdentity, factionTeam, loadIdentity, type PlayerIdentity } from './client/identity';
import { StableConsole, isCommissioned } from './client/stable';
import { audio } from './client/audio';
import { Chat } from './client/chat';
import { pauseCodex, renderCodex } from './client/codex';
import { StaticOverlay } from './client/effects';
import { Hud, renderOperationAfterAction, setRankChip, setStatChips } from './client/hud';
import { initGodMode } from './client/godmode';
import { Input } from './client/input';
import { TouchControls, isTouchDevice } from './client/touch';
import { currentSession, restoreSession, signOut, supabaseConfigured } from './client/auth';
import { MusicDirector } from './client/music';
import { Renderer } from './client/renderer';
import { DamageText } from './client/damagetext';
import { NetGame } from './client/net';
import { MATCH_LINGER_LOCAL_MS, ReplayDirector } from './client/replay';
import { MatchTracker, RANKS, commandCertification, loadDossier, rankFor, rankInsignia, recordOperationService, saveDossier, type Dossier } from './client/record';
import {
  FRONTS, SCAR_TEXT, applyResult, bandOf, cancelCampaignOperation, checkSeasonEnd,
  consumeOperationBattleBonuses, holdTheLine, loadCampaign, operationBattleBonuses,
  saveCampaign, scienceWindowsFor, settleCampaignOperation, stageCampaignOperation,
  type Campaign, type SettlementReceipt,
} from './client/campaign';
import { esc, fileIssue, renderIssueHTML, renderPressInto, loadPress } from './client/newspaper';
import { finalizeScienceLaunch, prepareScarScienceMission, prepareScienceMission, type ScienceLaunchState } from './client/science-flow';
import { renderSciencePanel, scienceCampaignBankHTML, scienceDebriefHTML } from './client/science';
import { scienceReward } from './sim/science';
import { buildOperationBoardModel, createSuggestedManifest, renderManifestDialog, renderOperationsBoard } from './client/operations-ui';
import { OPERATION_EFFECTS, OPERATION_SITES, type OperationManifest, type OperationPlan } from './sim/operations';
import { MILITARY_MISSIONS, createMilitaryMissionLaunch, type MilitaryMissionId } from './sim/military-missions';
import { renderMilitaryMissionModeCard, renderMilitaryMissionModal } from './client/military-missions-ui';
import { RangeCourse, loadWall } from './client/range';
import { RingDrill } from './client/ringdrill';
import { FieldTracker, advanceGauntlet, loadFieldRecord, saveFieldRecord } from './client/fieldrecord';
import { checkBelt, holderOf, loadTrophies, settleCup } from './client/trophies';
import { PAINTBALL_FIELDS } from './sim/map';
import { PB_PERSONAS } from './sim/personas';
import { GalleryDrill } from './client/gallerydrill';
import { loadSettings, saveSettings, settings, type BloodLevel, type DarknessLevel, type ReticleStyle } from './client/settings';
import { darknessUniforms } from './client/darkness';
import { k9HandlerForTeam } from './sim/k9-orders';
import { SCIENCE_PRESETS, prepareSciencePreset, sciencePresetCardHTML } from './client/science-presets';

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
/** THE GAUNTLET (COMPETITIVE-ARC §2): armed = the next paintball deploy is a
 *  ladder series (you alone vs a pack the size of your current rung). */
let gauntletArmed = false;
/** THE GALLERY (§6): armed = the next paintball deploy is the target range. */
let galleryArmed = false;
/** MOTOR TRIALS: which raceboard the player takes to the grid (comet/vector/sprite). */
let selectedRaceBoard: VehicleKind = 'vector';
let selectedClass: ClassId = 'infantry';
let selectedTheme: ThemeId = 'savanna';
let selectedMilitaryMissionId: MilitaryMissionId | null = null;
let selectedEquipment: string[] = [];
/** §14 onboarding: a named paintball field pins the map seed for the match */
let seedOverride: number | undefined;
let difficulty: Difficulty = 'veteran';
/** The side you deploy on — your enlisted faction (identity.ts). 0 = The United
 *  Front, 1 = The Collective. Set from the assigned faction at boot/enlistment. */
let playerTeam: Team = 0;
let botsPerTeam = 12; // 32B: 12v12 target — bots fill every open position
let scienceClones = 4;
let queuedScienceLaunch: ScienceLaunchState | null = null;
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
  grenade: 'Grenades', special: 'Special', melee: 'Unarmed', melee_weapon: 'Melee',
  marker: 'Markers',
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
  wirePills('race-board-select', (v) => { selectedRaceBoard = v as VehicleKind; });
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
  const scienceCount = $('science-clones-count');
  $('science-clones-minus').onclick = () => {
    scienceClones = Math.max(1, scienceClones - 1);
    scienceCount.textContent = String(scienceClones);
    audio.play('ui_click');
  };
  $('science-clones-plus').onclick = () => {
    scienceClones = Math.min(8, scienceClones + 1);
    scienceCount.textContent = String(scienceClones);
    audio.play('ui_click');
  };
}

function paintMilitaryMissionEntry() {
  const modeRow = $('mode-select');
  let host = document.getElementById('military-missions-entry');
  if (!host) {
    host = document.createElement('div');
    host.id = 'military-missions-entry';
    modeRow.appendChild(host);
  }
  host.innerHTML = renderMilitaryMissionModeCard(selectedMilitaryMissionId !== null, selectedMilitaryMissionId);
  const card = $('military-missions-card') as HTMLButtonElement;
  card.onclick = () => {
    audio.play('ui_click');
    openMilitaryMissionModal();
  };
  ($('deploy-btn') as HTMLButtonElement).textContent = selectedMilitaryMissionId ? 'DEPLOY MISSION' : 'DEPLOY';
}

function closeMilitaryMissionModal() {
  document.getElementById('military-missions-modal')?.remove();
  document.removeEventListener('keydown', onMilitaryMissionModalKey);
  ($('military-missions-card') as HTMLButtonElement | null)?.focus();
}

function onMilitaryMissionModalKey(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMilitaryMissionModal();
}

function openMilitaryMissionModal() {
  document.getElementById('military-missions-modal')?.remove();
  document.body.insertAdjacentHTML('beforeend', renderMilitaryMissionModal(selectedMilitaryMissionId, !!campaign?.activeOperation));
  const backdrop = $('military-missions-modal');
  const dialog = backdrop.querySelector<HTMLElement>('[role="dialog"]')!;
  const close = () => { audio.play('ui_click'); closeMilitaryMissionModal(); };
  backdrop.querySelectorAll<HTMLButtonElement>('[data-military-close]').forEach((button) => { button.onclick = close; });
  backdrop.onclick = (event) => { if (event.target === backdrop) close(); };
  backdrop.querySelectorAll<HTMLButtonElement>('[data-military-mission]').forEach((button) => {
    button.onclick = () => {
      const id = button.dataset.militaryMission as MilitaryMissionId;
      const mission = MILITARY_MISSIONS.find((entry) => entry.id === id);
      if (!mission) return;
      selectedMilitaryMissionId = id;
      selectedMode = mission.mode;
      activeFrontId = null;
      $('mode-select').querySelectorAll('.select-card').forEach((entry) => entry.classList.remove('selected'));
      audio.play('ui_click');
      closeMilitaryMissionModal();
      paintMilitaryMissionEntry();
      $('roster-block').style.display = 'none';
    };
  });
  document.addEventListener('keydown', onMilitaryMissionModalKey);
  requestAnimationFrame(() => {
    const selected = backdrop.querySelector<HTMLButtonElement>('.mission-card.selected');
    (selected ?? dialog).focus();
  });
}

/** The gauntlet block: toggle + the ladder's standing line (rung, depth, and
 *  who currently wears the honors — the yard's shelf at a glance). */
function paintGauntletBlock() {
  const name = ($('player-name') as HTMLInputElement)?.value?.trim() || 'You';
  const st = loadFieldRecord(name);
  const t = loadTrophies();
  const btn = $('gauntlet-toggle') as HTMLButtonElement;
  btn.textContent = gauntletArmed
    ? `🏆 GAUNTLET ARMED — RUNG ${st.gauntlet.rung} (1v${st.gauntlet.rung})`
    : '🏆 Casual yard (click to arm the Gauntlet)';
  btn.classList.toggle('selected', gauntletArmed);
  const gbtn = $('gallery-toggle') as HTMLButtonElement;
  gbtn.textContent = galleryArmed ? '🎯 THE GALLERY — ON THE LINE' : '🎯 THE GALLERY';
  gbtn.classList.toggle('selected', galleryArmed);
  const cup = holderOf(t.cup);
  const belt = t.belt.reigns.length ? t.belt.reigns[t.belt.reigns.length - 1] : null;
  $('gauntlet-status').textContent =
    `depth ${st.record.gauntletDepth || '—'} · best run ${st.record.gauntletBestRun || '—'}`
    + ` · CUP: ${cup ?? 'vacant'} · BELT: ${belt ? `${belt.holder} (${belt.score})` : 'unclaimed'}`
    + ` · GALLERY: ${t.gallery ? `${t.gallery.holder} (${t.gallery.score})` : 'no house score'}`;
}

function buildMenu() {
  const modeRow = $('mode-select');
  modeRow.innerHTML = '';
  (Object.keys(MODE_INFO) as ModeId[]).filter((id) => id !== 'shop').forEach((id) => {
    const card = document.createElement('div');
    card.className = `select-card${id === selectedMode ? ' selected' : ''}`;
    card.innerHTML = `<div class="icon">${MODE_INFO[id].icon}</div><div class="name">${MODE_INFO[id].name}</div><div class="desc">${MODE_INFO[id].desc}</div>`;
    card.onclick = () => {
      selectedMode = id;
      activeFrontId = null;
      queuedScienceLaunch = null;
      selectedMilitaryMissionId = null;
      audio.play('ui_click');
      modeRow.querySelectorAll('.select-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      paintMilitaryMissionEntry();
      // THE ROSTER LAW: the horde-composition pick only exists where a horde does
      $('roster-block').style.display = (id === 'horde' || id === 'survival') ? '' : 'none';
      $('science-clone-block').style.display = id === 'science' ? '' : 'none';
      // the board pick only exists on the grid
      $('race-board-block').style.display = (id === 'race' || id === 'timetrial') ? '' : 'none';
      $('gauntlet-block').style.display = id === 'paintball' ? '' : 'none';
      if (id === 'paintball') paintGauntletBlock();
    };
    modeRow.appendChild(card);
  });
  paintMilitaryMissionEntry();
  $('roster-block').style.display = (selectedMode === 'horde' || selectedMode === 'survival') ? '' : 'none';
  $('science-clone-block').style.display = selectedMode === 'science' ? '' : 'none';
  $('race-board-block').style.display = (selectedMode === 'race' || selectedMode === 'timetrial') ? '' : 'none';
  $('gauntlet-block').style.display = selectedMode === 'paintball' ? '' : 'none';
  if (selectedMode === 'paintball') paintGauntletBlock();
  ($('gauntlet-toggle') as HTMLButtonElement).onclick = () => {
    gauntletArmed = !gauntletArmed;
    if (gauntletArmed) galleryArmed = false; // one arm at a time
    audio.play('ui_click');
    paintGauntletBlock();
  };
  ($('gallery-toggle') as HTMLButtonElement).onclick = () => {
    galleryArmed = !galleryArmed;
    if (galleryArmed) gauntletArmed = false;
    audio.play('ui_click');
    paintGauntletBlock();
  };
  // VANESSA'S PAINTBALL (#122 — A PLACE, not a page): your soldier appears at
  // the entrance in the war's own view, walks the booths, talks to Vanessa
  // (#124 comic conversations), and TAKE writes the same onboarding store the
  // yard deploys from. (The /vanessas.html glide-cam page stays as the
  // brochure for anyone who types the URL.)
  ($('vanessas-btn') as HTMLButtonElement).onclick = () => {
    audio.play('ui_click');
    selectedMode = 'shop';
    startGame();
  };

  const quickDeploy = $('science-preset-cards');
  quickDeploy.innerHTML = SCIENCE_PRESETS.map(sciencePresetCardHTML).join('');
  quickDeploy.querySelectorAll<HTMLButtonElement>('[data-science-preset]').forEach((button) => {
    button.onclick = () => {
      const preset = SCIENCE_PRESETS.find((candidate) => candidate.id === button.dataset.sciencePreset);
      if (!preset || running) return;
      selectedMode = 'science';
      selectedClass = preset.classId;
      selectedTheme = preset.options.theme!;
      scienceClones = 8;
      primaryPick = '';
      secondaryPick = '';
      activeFrontId = null;
      seedOverride = undefined;
      queuedScienceLaunch = prepareSciencePreset(preset);
      selectedMilitaryMissionId = null;
      quickDeploy.querySelectorAll<HTMLButtonElement>('button').forEach((card) => { card.disabled = true; });
      audio.play('ui_click');
      void startGame();
    };
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
  // THE TABLET (Robert's mobile goal): coarse pointer → the twin-stick touch
  // layer mounts and body.touch lights the CSS. Same PlayerCmd seams as the
  // gamepad — the sim never learns a finger exists.
  if (isTouchDevice()) {
    const touch = new TouchControls();
    touch.mount($('touch-layer'));
    input.touch = touch;
    document.body.classList.add('touch');
    // fullscreen wants a gesture — the first touch on the field is it
    $('touch-layer').addEventListener('pointerdown', () => {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* iOS: the PWA shell owns fullscreen */ });
      }
    }, { once: true });
  }
  $('k9-sic').onclick = () => input.queueK9('sic');
  $('k9-stay').onclick = () => input.queueK9('stay');
  chat.show();
  hud.waypointsEnabled = selectedEquipment.some((id) => EQUIPMENT[id]?.waypoints);
  chat.deliverMail(); // stored messages arrive the moment you deploy

  const endGame = () => {
    saveFlight(); // the match dies, its flight log doesn't
    running = false;
    renderSciencePanel($('science-mission-panel'), undefined);
    hud.hide();
    chat.hide();
    $('menu').classList.remove('hidden');
    window.location.reload(); // clean slate: disposes scene, sockets, listeners
  };

  if (serverUrl && selectedMode !== 'science' && !selectedMilitaryMissionId) {
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
  if (serverUrl && selectedMode === 'science') {
    hud.announce('Science missions run on the local operation host in v1', false, 0);
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
      vehicles: vehicleTelemetrySnapshot(flightWorld.vehicleTelemetry),
    }));
  } catch { /* storage full or blocked — the log is a luxury, never a crash */ }
}
(window as unknown as Record<string, unknown>).__flight = (mode?: 'raw') => {
  const raw = localStorage.getItem('ww:lastFlight');
  if (!raw) return 'no stored flight — play a match first';
  const f = JSON.parse(raw) as { at: string; mode: string; simTime: number; scores: number[]; samples: BbSample[]; incidents: BbIncident[]; vehicles?: VehicleTelemetrySnapshot };
  if (mode === 'raw') return f;
  return `LAST FLIGHT — ${f.mode} · ${f.simTime}s sim · scores ${f.scores.join(':')} · saved ${f.at}\n${blackboxReport(f)}${f.vehicles ? `\n${vehicleTelemetryReport(f.vehicles)}` : ''}`;
};

// #123 THE ONE CLOCK — the corner chip ticks every few seconds, everywhere:
// menu, match, forever. One formula, one truth (src/client/worldclock.ts).
function paintWorldClock() {
  const c = gameNow();
  const el = $('world-clock');
  $('wc-text').textContent = clockLabel(c);
  el.classList.toggle('night', c.night);
}
paintWorldClock();
setInterval(paintWorldClock, 5000);

function startLocal(renderer: Renderer, dmgText: DamageText, hud: Hud, input: Input, name: string, endGame: () => void) {
  const exercise = selectedMilitaryMissionId ? createMilitaryMissionLaunch(selectedMilitaryMissionId) : null;
  const campaignFrontId = exercise || selectedMode === 'science' ? null : activeFrontId;
  const deployedOperation = campaignFrontId && campaign?.activeOperation?.plan.frontId === campaignFrontId
    ? campaign.activeOperation
    : null;
  const seed = exercise?.seed ?? queuedScienceLaunch?.spec.seed ?? deployedOperation?.plan.seed
    ?? seedOverride ?? (Math.random() * 0xffffffff) >>> 0;
  seedOverride = undefined;
  const scienceLaunch = selectedMode === 'science'
    ? (queuedScienceLaunch ?? prepareScienceMission(seed, null, scienceClones, { theme: selectedTheme }))
    : null;
  queuedScienceLaunch = null;
  const world = new World({
    seed, mode: exercise?.mode ?? selectedMode, difficulty, matchMinutes, theme: selectedTheme,
    // A PLACE (#122) is hand-built ground with nobody in it but the keeper
    map: selectedMode === 'shop' ? buildVanessasMap() : undefined,
    botsPerTeam: selectedMode === 'shop' ? 0 : botsPerTeam,
    // #123 THE ONE CLOCK: hand the sim the world's day-fraction at launch —
    // the sky obeys the same clock the corner chip shows
    clockPhase: gameNow().phase01,
    scienceMission: scienceLaunch?.spec,
    hordeRoster, // THE ROSTER LAW: iron never mixes with zombies unless asked
    // B1: banked morale opens the stable richer for YOUR side (capped in-world)
    moraleBoost: [Math.min(3, dossier?.soldier.morale ?? 0), 0],
    // §8.2+33C: a Scar deploy lands on AUTHORED ground, at the tier the
    // lobby's headcount earns — the size rides the id (front@size) so
    // world.ts stays the LSW dev's untouched file.
    frontId: campaignFrontId ? `${campaignFrontId}@${mapSizeForPlayers(botsPerTeam)}` : undefined,
    // W3.4 PASS ESCALATION: a campaign battle fights at the front's pass —
    // P1 no gods, P2 their stable only, P3 both. Off the map: everything.
    lswPass: campaignFrontId ? (campaign?.fronts[campaignFrontId]?.pass ?? 3) : 3,
    operationBonuses: campaignFrontId && campaign ? operationBattleBonuses(campaign, campaignFrontId) : undefined,
    operation: exercise?.plan ?? deployedOperation?.plan,
    operationManifest: exercise?.manifest ?? deployedOperation?.manifest,
    operationInventory: exercise?.inventory ?? (deployedOperation && campaign ? campaign.motorPool : undefined),
  });
  if (campaignFrontId && campaign) {
    consumeOperationBattleBonuses(campaign, campaignFrontId);
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
  // Your enlisted faction is the side you deploy on — but only in the standard
  // team-vs-team war. Paintball (hunter/prey roles), co-op & science (PvE) and
  // the range keep the local player on team 0, where their rosters are pinned.
  const isRace = selectedMode === 'race' || selectedMode === 'timetrial';
  const factionModes = !(selectedMode === 'paintball' || isCoopMode(selectedMode)
    || selectedMode === 'range' || selectedMode === 'science' || isRace
    || selectedMode === 'shop');
  const pt: Team = factionModes ? playerTeam : 0;
  const et: Team = (1 - pt) as Team;
  const me = world.addSoldier(name, selectedClass, pt, 'human', currentLoadout());
  setStatChips(me.stats); // #127: your three, worn beside the rank all match
  applyScarMods(world, campaignFrontId); // §8.5: the front's wound shapes the field
  // THE PLACE (#122): you appear AT THE ENTRANCE (Robert's exact ask), facing
  // the shop; Vanessa keeps her counter; the war HUD steps back to place-size
  if (selectedMode === 'shop') {
    me.pos = { ...SHOP_ENTRANCE };
    me.yaw = -Math.PI / 2; // facing north — into the shop, at the counter
    spawnVanessa(world);
    $('hud').classList.add('place');
  }
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
    team: () => pt,
    call: (id) => world.requestLsw(id, pt, me.id),
    stock: () => world.materiel[0],
    announce: (t) => hud.announce(t, false, world.time),
  });
  // the Record (§3.4): fold this match into the dossier as it happens
  // the yard stays out of the Record (§14 Q3: one legacy beat per phase —
  // the dossier starts writing at the first WAR drop, not in the paint)
  const trackedDossier = exercise && dossier ? structuredClone(dossier) : dossier;
  const tracker = trackedDossier && selectedMode !== 'paintball' && selectedMode !== 'science'
    ? new MatchTracker(trackedDossier, name, selectedClass, selectedMode, seed, !exercise) : null;
  // the Proving Grounds (§3.3): stage the course; 18B decided practice vs official
  const course = selectedMode === 'range'
    ? new RangeCourse(rangeOfficial, name, dossier, (t, big) => hud.announce(t, !!big, 0))
    : null;
  rangeOfficial = false; // one-shot flag — consumed by this deploy
  // READ THE RING (§UI): the boot-camp station — three dummies, splat the
  // weakest. ONE station, ever (Robert, live: "my teammates in paintball
  // don't do anything" — the ring dummies wear your colors and read as a
  // broken squad if the lesson never lands; taught-or-timed-out, they retire)
  const ringDrill = selectedMode === 'paintball' && !gauntletArmed && !galleryArmed && !loadOnboarding().ringDone
    ? new RingDrill((t, big) => hud.announce(t, !!big, 0))
    : null;
  // THE GALLERY (§6): the target range takes over the yard when armed
  const galleryDrill = selectedMode === 'paintball' && galleryArmed
    ? new GalleryDrill(name, (t, big) => hud.announce(t, !!big, world.time))
    : null;
  // THE FIELD RECORD (COMPETITIVE-ARC §1): every yard match folds into the
  // paintball card — splats, outnumbered splits, spills, the longest ball.
  // The tracker also feeds the BELT live: beat the standing distance and the
  // honor moves mid-match.
  const yardField = selectedMode === 'paintball'
    ? (PAINTBALL_FIELDS.find((f) => f.theme === selectedTheme)?.name ?? selectedTheme)
    : '';
  const fieldTracker = selectedMode === 'paintball' ? new FieldTracker(name, yardField) : null;
  let honorsSettled = false;
  if (fieldTracker) {
    const trophies = loadTrophies();
    fieldTracker.onSplat = (dist, fld) => {
      const line = checkBelt(trophies, name, dist, fld);
      if (line) hud.announce(line, true, world.time);
    };
  }

  // THE SCORE (Robert's tracks): soldier combat → LSW inbound/walking → the
  // real monsters. The director reads the sim twice a second and crossfades.
  const music = new MusicDirector();

  // replays: the director runs the killcam + match-highlights state machine
  const director = new ReplayDirector(seed, world.mode.id, world.map.theme, world.map.theater?.id);
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
  if (isRace) {
    // MOTOR TRIALS: put the player on pole on their chosen board; the circuit
    // fills the rest of the grid with AI racers on the far team so a winner
    // reads out, the time trial runs solo against the ghost.
    const track = world.map.raceTrack;
    if (track) {
      const RACE_BOARDS: VehicleKind[] = ['comet', 'vector', 'sprite'];
      const meBoard = world.spawnVehicle(selectedRaceBoard, me.team, track.grid[0]);
      meBoard.yaw = track.startYaw;
      me.pos = { ...track.grid[0] };
      world.forceBoard(me, meBoard);
      const field = selectedMode === 'timetrial' ? 0 : Math.min(track.grid.length - 1, 7);
      for (let i = 1; i <= field; i++) {
        const racer = world.addSoldier(wrap(n++), 'infantry', et, 'bot');
        const board = world.spawnVehicle(RACE_BOARDS[i % 3], racer.team, track.grid[i]);
        board.yaw = track.startYaw;
        racer.pos = { ...track.grid[i] };
        world.forceBoard(racer, board);
      }
    }
  } else if (selectedMode === 'range' || selectedMode === 'science' || selectedMode === 'shop') {
    // range is solo; science populated its authored roster; a PLACE (#122)
    // fields nobody — the keeper is spawned by the place itself
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
    // THE YARD'S PEOPLE (COMPETITIVE-ARC §4): every paintball bot is a NAMED
    // persona — same names, same styles, same mouths, match after match.
    // You're going against specific people, not bots (Robert).
    const dealPersona = (idx: number, team: Team) => {
      const p = PB_PERSONAS[idx % PB_PERSONAS.length];
      const b = world.addSoldier(p.name, 'infantry', team, 'bot', { primary: p.marker });
      b.pbStyle = p.style;
      return b;
    };
    if (galleryArmed) {
      // THE GALLERY (§6): just you and the targets — the drill below spawns
      // its own dummies and runs the range
    } else if (gauntletArmed) {
      // THE GAUNTLET (COMPETITIVE-ARC §2): you, alone, against a pack the
      // size of your rung — the roster IS the asymmetry, so 1v1 through 1v7
      // all resolve through the same hunters-vs-hunted law. The crew joins
      // in a fixed order: rung 1 is always Vex; by rung 7 the whole yard
      // is on the field.
      const rung = loadFieldRecord(name).gauntlet.rung;
      for (let i = 0; i < rung; i++) dealPersona(i, 1);
    } else if (pb.role === 'hunter') {
      // casual rotates who shows up (seed-dealt), so the whole crew cycles
      for (let i = 0; i < packSize - 1; i++) dealPersona(seed + i, 0);
      dealPersona(seed + packSize - 1, 1);
    } else {
      for (let i = 0; i < packSize; i++) dealPersona(seed + i, 1);
    }
    // everyone plays paintball RULES: marker only, no sidearm, no live frags —
    // paint is the whole vocabulary of the yard. The bag holds TWO paint
    // grenades (world.ts's paintball branch is the only thing G can throw).
    for (const s of world.soldiers.values()) {
      const marker = s.id === me.id ? pb.marker : s.weapons[0];
      s.weapons = [marker];
      s.clip = [WEAPONS[marker].clip];
      s.reserve = [WEAPONS[marker].reserve];
      s.weaponIdx = 0;
      s.grenades = 2;
      // empty every other pouch so the X-cycle can't even ADVERTISE ordnance
      s.smokes = 0; s.firebombs = 0; s.concs = 0; s.gravs = 0; s.plasmas = 0; s.timebombs = 0;
      s.equipment = [];
    }
  } else {
    // your side fills around you (one fewer — you're the last seat); the enemy
    // faction fills full. pt/et carry your enlisted faction into the roster.
    for (let i = 0; i < Math.max(0, botsPerTeam - 1); i++) {
      const cls = classPool[i % classPool.length];
      world.addSoldier(wrap(n++), cls, pt, 'bot', botLoadout(cls));
    }
    for (let i = 0; i < botsPerTeam; i++) {
      const cls = classPool[(i + 3) % classPool.length];
      world.addSoldier(wrap(n++), cls, et, 'bot', botLoadout(cls));
    }
  }
  // §5.3: each fighting side fields one K9, including authored science
  // rosters. An eligible local soldier owns the friendly dog; AI fills in.
  if (selectedMode !== 'range' && selectedMode !== 'paintball' && !isRace) {
    for (const team of [0, 1] as const) {
      const handler = k9HandlerForTeam(world.soldiers.values(), team, team === pt ? me.id : -1);
      if (handler) world.addDog(handler);
    }
  }

  // THE GHOST (Motor Trials): record the local racer's laps; when one beats the
  // stored best, keep it and replay it as a translucent phantom next lap.
  const ghostK = ghostKey(seed, selectedRaceBoard);
  const ghostRec = isRace ? new GhostRecorder() : null;
  let ghostPlay: GhostPlayer | null = null;
  let ghostLapStart = 0;   // world.time the current recorded lap began
  let ghostLastLap = -1;   // me's completed-lap count last frame
  if (isRace) {
    const stored = loadGhost(ghostK);
    if (stored) { ghostPlay = new GhostPlayer(stored.samples); renderer.setGhostBoard(selectedRaceBoard); }
  }

  renderer.buildStaticWorld(world);
  renderSciencePanel($('science-mission-panel'), world.science);
  course?.begin(world, me.id);
  ringDrill?.begin(world, me.id);
  galleryDrill?.begin(world, me.id);
  hud.announce(exercise ? `${exercise.missionName.toUpperCase()} · ${exercise.theaterName.toUpperCase()}` : MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
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
      ? `${blackboxReport(world.blackbox)}\n${vehicleTelemetryReport(world.vehicleTelemetry)}\n${ammoReport(world)}` // §13: the ammo economy rides the report
      : { samples: world.blackbox.samples, incidents: world.blackbox.incidents, vehicles: vehicleTelemetrySnapshot(world.vehicleTelemetry) };
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
    // THE GHOST: sample the local racer once racing has begun; on a lap change
    // bank the lap (keeping it if it's a new best), and show the phantom at the
    // current lap clock. Client-only — never touches the sim.
    if (isRace && ghostRec) {
      const racer = world.mode.racers?.find((r) => r.id === me.id);
      const board = me.vehicleId >= 0 ? world.vehicles.get(me.vehicleId) : undefined;
      if (racer && board && (world.mode.countdown ?? 0) <= 0) {
        if (ghostLastLap < 0) { ghostLastLap = racer.lap; ghostLapStart = world.time; ghostRec.startLap(world.time); }
        if (racer.lap !== ghostLastLap) {
          const lapTime = world.time - ghostLapStart;
          const samples = ghostRec.takeLap();
          const prev = loadGhost(ghostK);
          if (samples.length > 4 && (!prev || lapTime < prev.lapTime)) {
            saveGhost(ghostK, lapTime, samples);
            ghostPlay = new GhostPlayer(samples);
            renderer.setGhostBoard(selectedRaceBoard);
          }
          ghostLastLap = racer.lap;
          ghostLapStart = world.time;
          ghostRec.startLap(world.time);
        }
        ghostRec.record(world.time, board.pos.x, board.pos.y, board.pos.z, board.yaw);
        renderer.moveGhost(ghostPlay ? ghostPlay.at(world.time - racer.lapStart) : null);
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
    // the amusement-park verb (#122): walk up, read the prompt, press E
    if (world.mode.id === 'shop') updateShopInteract(world, me, endGame);
    // #127 THE VAULT: banked god-blood persists on this client — the spend
    // arrives with the meta-layer economy (#63); the vault fills today
    for (const e of events) {
      if (e.type === 'dna' && e.text) {
        try {
          const vault = JSON.parse(localStorage.getItem('ww_dna_vault') ?? '{}') as Record<string, number>;
          vault[e.text] = (vault[e.text] ?? 0) + 1;
          localStorage.setItem('ww_dna_vault', JSON.stringify(vault));
        } catch { /* a full vault never crashes the war */ }
      }
    }
    galleryDrill?.update(world, me.id, events, dt);
    fieldTracker?.step(world, events, me.id);
    // the whistle settles the HONORS and the LADDER — exactly once (never on
    // the range: a Gallery run is target practice, not a series)
    if (fieldTracker?.finished && !honorsSettled && !galleryArmed) {
      honorsSettled = true;
      const trophies = loadTrophies();
      const cupLine = settleCup(trophies, world, me.id, yardField, gauntletArmed);
      if (cupLine) hud.announce(cupLine, true, world.time);
      if (gauntletArmed) {
        const st = fieldTracker.stored;
        const line = advanceGauntlet(st, world.mode.winner === me.team);
        saveFieldRecord(st);
        hud.announce(line, true, world.time);
      }
    }
    if (world.mode.over && scienceLaunch && world.science) {
      const aftermath = finalizeScienceLaunch(scienceLaunch, world.science, campaign ?? undefined);
      if (aftermath) {
        fileIssue(aftermath.issue);
        if (aftermath.campaignApplied && campaign) {
          saveCampaign(campaign);
          renderScarMap();
        }
        hud.careerHtml = `${scienceDebriefHTML({ ...aftermath.result, briefing: world.science.spec.briefing })}
          <div style="margin-top:0.7rem">${renderIssueHTML(aftermath.issue)}</div>`;
      }
    }
    if (world.mode.over && tracker) {
      void tracker.finalize(world, me.id).then((sum) => {
        if (!sum) return;
        const operationResult = world.operation?.result
          ? { ...world.operation.result, hullKills: tracker.operationHullKills() }
          : undefined;
        let operationReceipt: SettlementReceipt | undefined;
        renderBarracks(); // the record just grew
        // §17.B's third leg, finally visible: fight → record grew → WAR MOVED
        let extras = '';
        if (exercise && operationResult) {
          extras += `<p style="margin-top:0.35rem"><b>FIELD EXERCISE ${operationResult.won ? 'COMPLETE' : 'FAILED'}</b> · ${exercise.plan.codename} · ${operationResult.completedPhaseIds.length}/${exercise.plan.phases.length} phases · ${exercise.theaterName}</p>`;
        }
        // B1 THE WAR LEDGER on the closing screen: both sides' books, and the
        // morale event when the winner fought poor (Robert: "if you won and
        // were underfunded it increased your morale… that officer could do")
        {
          const myTeam = pt;
          const mine = world.warCost(myTeam);
          const theirs = world.warCost(et);
          extras += `<p style="margin-top:0.35rem">⛁ WAR COST — yours ${mine} · theirs ${theirs}</p>`;
          if (!exercise && world.mode.underdog === myTeam && dossier) {
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
        if (campaignFrontId && campaign) {
          const front = campaign.fronts[campaignFrontId];
          const before = front?.control ?? 0;
          // W3.3: your dead spend the front's clones — and CLONE INFECTION
          // doubles the bill for every HOT death (the reprint + the body
          // that rose against the line)
          const viralBill = world.viralDeaths?.[0] ?? 0;
          if (operationResult) {
            operationReceipt = settleCampaignOperation(campaign, operationResult, Date.now());
            if (operationReceipt.ok) {
              const treasury = operationReceipt.treasuryDelta >= 0 ? `+${operationReceipt.treasuryDelta}` : String(operationReceipt.treasuryDelta);
              extras += `<p style="margin-top:0.35rem"><b>OPERATION ${operationResult.won ? 'COMPLETE' : 'FAILED'}</b> · treasury ${treasury} · ${operationReceipt.hullsLost.length} hulls lost · ${operationReceipt.hullsReturned.length} returned</p>`;
              if (dossier && deployedOperation) {
                const service = recordOperationService(dossier, {
                  plan: deployedOperation.plan,
                  manifest: deployedOperation.manifest,
                  result: operationResult,
                  receipt: operationReceipt,
                  inventory: campaign.motorPool,
                });
                if (service.recorded) {
                  const next = service.certification.nextAt === null ? 'maximum grade' : `${service.certification.nextAt - service.certification.points} pts to next grade`;
                  extras += `<p style="margin-top:0.25rem">COMMAND CERTIFICATION · <b>${service.certification.name}</b> · ${service.certification.points} pts · ${next}</p>`;
                  void saveDossier(dossier);
                }
              }
            } else {
              extras += `<p style="margin-top:0.35rem;color:var(--danger)">OPERATION SETTLEMENT HOLD · ${operationReceipt.errors.join(' · ')}</p>`;
            }
          } else {
            applyResult(campaign, campaignFrontId, sum.won, Date.now(), (sum.deaths ?? 0) + viralBill);
          }
          if (viralBill > 0) extras += `<p style="margin-top:0.35rem">☣ ${viralBill} turned — the vats paid double</p>`;
          if (front) {
            const d = front.control - before;
            const fname = FRONTS.find((f) => f.id === campaignFrontId)?.name ?? campaignFrontId;
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
            dossier.tours.push({ faction: playerTeam, season: campaign.season, startedAt: Date.now() });
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
        if (operationResult && operationReceipt?.ok && deployedOperation && campaign) {
          hud.careerHtml += renderOperationAfterAction({
            plan: deployedOperation.plan,
            manifest: deployedOperation.manifest,
            result: operationResult,
            receipt: operationReceipt,
            inventory: campaign.motorPool,
          });
        }

        // N1 THE PRESS FILES (Robert: "we could literally make newspapers…
        // to show all the three things that happened"). One issue per battle:
        // the duel, the money, the field. Archived as data in the MAP tab.
        if (!exercise) {
          let ace = { name: '—', kills: 0 };
          let longest = 0;
          for (const s2 of world.humansAndBots()) {
            if (s2.kills > ace.kills) ace = { name: s2.name, kills: s2.kills };
            if (s2.longestKill > longest) longest = s2.longestKill;
          }
          const kills: [number, number] = [0, 0];
          for (const s2 of world.humansAndBots()) kills[s2.team] += s2.kills;
          const operationAce = operationResult
            ? Object.entries(operationResult.hullKills ?? {}).map(([id, byKind]) => ({
              id,
              kills: Object.values(byKind).reduce((total, count) => total + (count ?? 0), 0),
            })).sort((a, b) => b.kills - a.kills)[0]
            : undefined;
          const operationSite = deployedOperation
            ? OPERATION_SITES.find((site) => site.id === deployedOperation.plan.site)?.name
            : undefined;
          const operationReward = deployedOperation
            ? OPERATION_EFFECTS.find((effect) => effect.id === deployedOperation.plan.effect)?.name
            : undefined;
          fileIssue({
            at: Date.now(),
            season: campaign?.season ?? 1,
            frontName: pressFront?.name,
            controlAfter: pressFront?.control,
            controlDelta: pressFront?.delta,
            won: operationResult?.won ?? sum.won === true, // a draw prints as a hard day, not a win
            modeName: operationResult ? 'Military Operation' : MODE_INFO[world.mode.id]?.name ?? world.mode.id.toUpperCase(),
            aceName: ace.name, aceKills: ace.kills, longestShot: Math.round(longest),
            myCost: world.warCost(0), theirCost: world.warCost(1),
            underdog: world.mode.underdog === 0,
            morale: dossier?.soldier.morale,
            myKills: kills[0], theirKills: kills[1],
            medals: sum.medals.map((m) => `${m.icon} ${m.name}`),
            ...(operationResult && deployedOperation ? { operation: {
              codename: deployedOperation.plan.codename,
              site: operationSite ?? deployedOperation.plan.site,
              outcome: operationResult.won ? 'victory' as const : 'defeat' as const,
              hullsLost: operationResult.destroyedHullIds.length,
              ...(operationAce ? { aceHull: campaign?.motorPool.find((hull) => hull.id === operationAce.id)?.name ?? operationAce.id } : {}),
              objectivesCompleted: operationResult.completedPhaseIds.length,
              objectivesTotal: deployedOperation.plan.phases.length,
              ...(operationResult.won && operationReward ? { reward: operationReward } : {}),
            } } : {}),
          });
          // the freshest front page goes straight onto the closing screen
          const latest = loadPress()[0];
          if (latest) hud.careerHtml += `<div style="margin-top:0.7rem">${renderIssueHTML(latest)}</div>`;
        }
      });
    }

    // THE REWARD KILL-CAM (Robert's shot #4): a GREAT local kill — a long snipe,
    // a multi-kill, or a clutch while nearly dead — earns a brief cut of the
    // moment, framing the soldier YOU dropped. Turns the killcam from a
    // punishment into a reward. Rate-limited inside the director; a longshot
    // RIDES the round in. (Conservative triggers — tune to taste in play.)
    if (me.alive && !world.mode.over) {
      for (const e of events) {
        if (e.type !== 'death' || e.killerId !== me.id || e.soldierId === undefined || e.soldierId === me.id) continue;
        const dist = Math.round(e.dist ?? 0);
        const streak = me.streak ?? 0;
        let reason = ''; let kind: 'ride' | 'duel' = 'duel';
        if (dist >= 65) { reason = `LONGSHOT · ${dist}u`; kind = 'ride'; }
        else if (streak >= 6) reason = `RAMPAGE ×${streak}`;
        else if (streak >= 4) reason = `MULTI-KILL ×${streak}`;
        else if (me.hp <= 25) reason = `CLUTCH — ${Math.max(0, Math.round(me.hp))} HP`;
        if (reason && director.rewardKillCam(world, e.soldierId, `★ ${reason}`, kind)) break;
      }
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
    // the shot list (Robert): the renderer flies the round / pins the shot line
    renderer.killcamShotKind = replaying && director.killcamActive ? director.shotKind : null;
    renderer.killcamLocalIsShooter = replaying && director.killcamActive ? director.localIsShooter : false;
    // a REWARD cut wears gold — a confirmed kill reads as a reward, not a death
    $('replay-banner').classList.toggle('reward', replaying && director.killcamActive && director.localIsShooter);
    // THE DEATH TREATMENT (Robert: "I don't know where the kill cam is… I
    // haven't seen it yet"): the cam fired all along, but it played UNDER the
    // full alive HUD in the same tactical view — it read as the game carrying
    // on without you. While a cam rolls, the HUD steps back: letterbox bars,
    // the live clusters gone, the banner grown into a title card (styles.css
    // #hud.killcam). The reward cut wears the same frame in gold.
    $('hud').classList.toggle('killcam', replaying && director.killcamActive);
    // THE TERMINAL READOUT — a stencil/mono card pinned over the shot. The
    // director preps it for every kind that earns it (autopsy · ride · wreck);
    // gating on autopsy alone left most deaths with no read (the wiring gap).
    const kro = $('killcam-readout');
    if (replaying && director.killcamActive && director.readout) {
      const r = director.readout;
      const kroTitle = director.shotKind === 'ride' ? '➤ THE ROUND'
        : director.shotKind === 'wreck' ? '✸ THE WRECK' : '⌖ AUTOPSY';
      kro.innerHTML = `<div class="kro-h">${kroTitle}</div>`
        + `<div class="kro-row"><span>SHOOTER</span><b>${r.shooter}</b></div>`
        + `<div class="kro-row"><span>WEAPON</span><b>${r.weapon}</b></div>`
        + `<div class="kro-row"><span>RANGE</span><b>${r.range}u</b></div>`
        + `<div class="kro-row"><span>DAMAGE</span><b>${r.damage || '—'}</b></div>`;
      kro.classList.remove('hidden');
    } else kro.classList.add('hidden');
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
    renderSciencePanel($('science-mission-panel'), world.science);

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
  const certification = commandCertification(d.operations);
  const vehicleAces = Object.values(d.operations.vehicles)
    .sort((a, b) => Object.values(b.killsByKind).reduce((sum, n) => sum + (n ?? 0), 0) - Object.values(a.killsByKind).reduce((sum, n) => sum + (n ?? 0), 0))
    .slice(0, 5).map((vehicle) => {
      const kills = Object.values(vehicle.killsByKind).reduce((sum, n) => sum + (n ?? 0), 0);
      return `<div class="bk-stat-row"><span>${vehicle.name} · ${vehicle.kind}</span><b>${kills} kills · ${vehicle.sorties} sorties${vehicle.lost ? ' · LOST' : ''}</b></div>`;
    }).join('') || '<p class="bk-empty">No named hull has entered Operation service.</p>';
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
      <div class="bk-card"><h4>Operation command</h4>
        <div class="bk-stat-row"><span>Certification</span><b>${certification.name} · ${certification.points} pts</b></div>
        <div class="bk-stat-row"><span>Sorties / wins</span><b>${d.operations.sorties} / ${d.operations.wins}</b></div>
        <div class="bk-stat-row"><span>Clean sheets</span><b>${d.operations.cleanSheets}</b></div>
        <div class="bk-stat-row"><span>Fiscal Efficiency</span><b>${d.operations.fiscalEfficiency}</b></div>
        <h4 style="margin-top:0.65rem">Vehicle aces</h4>${vehicleAces}
      </div>
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
    <div class="bk-card" style="margin-bottom:0.75rem"><h4>THE CLUBHOUSE — the yard's book (COMPETITIVE-ARC)</h4>${(() => {
      // the paintball scene: the card, the ladder, the honors, the house
      const fr = loadFieldRecord(d.soldier.callsign);
      const r = fr.record;
      const t = loadTrophies();
      const acc = r.paintThrown > 0 ? ` · ${Math.round((r.splats / r.paintThrown) * 100)}% paint on target` : '';
      const outRows = (['1v1', '1v2', '1v3', '1v4', '1v5plus'] as const)
        .filter((k) => r.outnumbered[k])
        .map((k) => { const b = r.outnumbered[k]!; return `<div class="bk-stat-row"><span>${k === '1v5plus' ? '1v5+' : k}</span><b>${b.won}–${b.rounds - b.won}</b></div>`; })
        .join('') || '<p class="bk-empty">No outnumbered rounds on the books yet.</p>';
      const reignRow = (rg: { holder: string; takenFrom: string | null; score: string; field: string; at: number }) =>
        `<div class="bk-stat-row"><span>${rg.holder}${rg.takenFrom ? ` <em style="opacity:0.6">took it from ${rg.takenFrom}</em>` : ' <em style="opacity:0.6">inaugural</em>'}</span><b>${rg.score} · ${rg.field}</b></div>`;
      const cupRows = t.cup.reigns.slice(-5).reverse().map(reignRow).join('') || '<p class="bk-empty">THE YARD CUP sits unclaimed.</p>';
      const beltRows = t.belt.reigns.slice(-5).reverse().map(reignRow).join('') || '<p class="bk-empty">THE LONGBALL BELT awaits its first long ball.</p>';
      return `
        <div class="bk-stat-row"><span>Series / rounds</span><b>${r.series.won}/${r.series.played} · ${r.rounds.won}/${r.rounds.played}</b></div>
        <div class="bk-stat-row"><span>Splats / outs</span><b>${r.splats} / ${r.outs}${acc}</b></div>
        <div class="bk-stat-row"><span>Off the break · clutches · clock-outs</span><b>${r.offTheBreak} · ${r.clutches} · ${r.clockOuts}</b></div>
        <div class="bk-stat-row"><span>Longest splat</span><b>${r.longestSplat ? `${r.longestSplat.toFixed(1)}u · ${r.longestSplatField}` : '—'}</b></div>
        <div class="bk-stat-row"><span>Gauntlet</span><b>depth ${r.gauntletDepth || '—'} · best run ${r.gauntletBestRun || '—'} · next: 1v${fr.gauntlet.rung}</b></div>
        <div class="bk-stat-row"><span>Gallery</span><b>best ${r.galleryBest ?? '—'} · house ${t.gallery ? `${t.gallery.score} (${t.gallery.holder})` : 'unset'}</b></div>
        <h4 style="margin-top:0.65rem">The outnumbered book</h4>${outRows}
        <h4 style="margin-top:0.65rem">THE YARD CUP — lineage</h4>${cupRows}
        <h4 style="margin-top:0.65rem">THE LONGBALL BELT — lineage</h4>${beltRows}`;
    })()}</div>
    <div class="bk-card"><h4>War journal</h4>${journal}</div>`;
  const practice = root.querySelector<HTMLButtonElement>('#pg-practice');
  if (practice) practice.onclick = () => {
    activeFrontId = null; selectedMilitaryMissionId = null; rangeOfficial = false; selectedMode = 'range'; startGame();
  };
  const official = root.querySelector<HTMLButtonElement>('#pg-official');
  if (official) official.onclick = () => {
    // 18B: a permanent score is only meaningful when knowingly accepted
    const warning = 'OFFICIAL QUALIFICATION ATTEMPT\n\nThis one counts — forever. Your score and percentile go on The Wall and in your dossier, permanently. Practice runs are unlimited; official is one shot.\n\nReady?';
    if (confirm(warning)) {
      activeFrontId = null; selectedMilitaryMissionId = null; rangeOfficial = true; selectedMode = 'range'; startGame();
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

function scarScienceSeed(frontId: string, pass: number, season: number): number {
  let hash = (season * 0x9e3779b1) ^ (pass * 0x85ebca6b);
  for (let i = 0; i < frontId.length; i++) hash = Math.imul(hash ^ frontId.charCodeAt(i), 16777619);
  return hash >>> 0;
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
  modal.onkeydown = (event) => { if (event.key === 'Escape') close(); };
  modal.focus();
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
  const sciencePreview = sel && selSt
    ? prepareScienceMission(scarScienceSeed(sel.id, selSt.pass, c.season), sel, scienceClones)
    : null;
  const scienceWindows = sel && selSt ? scienceWindowsFor(c, sel.id, selSt.pass) : 0;
  const operationModel = sel ? buildOperationBoardModel(c, sel.id) : null;
  const selHtml = sel && selSt
    ? `<b style="font-size:1.05rem">${sel.name}</b>
       <p style="color:var(--muted);font-size:0.8rem;margin:0.3rem 0">${sel.mode.toUpperCase()} · ${sel.theme} · control <b>${selSt.control > 0 ? '+' : ''}${selSt.control}</b> (${bandOf(selSt.control)})</p>
       ${selSt.scarActive ? `<p style="font-size:0.8rem;color:var(--danger)">⚑ ${SCAR_TEXT[sel.scar]}</p>` : ''}
       <button id="front-deploy">⚔ DEPLOY — ${sel.name.toUpperCase()}</button>
       <div class="scar-science-brief">
         <div><span>SCIENCE WINDOW</span><b>${scienceWindows}/2 · PASS ${selSt.pass}</b></div>
         <h4>${esc(sciencePreview!.spec.id)} · ${esc(sciencePreview!.spec.verb.toUpperCase())}</h4>
         <p>${esc(sciencePreview!.spec.briefing)}</p>
         <p class="scar-science-pay">${sciencePreview!.spec.squadSize} CLONES · ${esc(scienceReward(sciencePreview!.spec.reward).label.toUpperCase())}</p>
         <p class="scar-science-ledger">ENEMY PRINT PRESSURE ${selSt.enemyClonePressure} · CLONE INSURANCE ${selSt.cloneInsurance}</p>
         <button id="front-science" ${scienceWindows <= 0 ? 'disabled' : ''}>${scienceWindows > 0 ? '⌬ RUN SCIENCE MISSION' : 'NO SCIENCE WINDOWS THIS PASS'}</button>
       </div>`
    : '<p class="bk-empty">Select a front on the theater map. Your battles move its control.</p>';
  const dispatch = c.dispatch.slice(0, 10).map((d) =>
    `<li>${d.simulated ? '<em style="color:var(--muted)">(simulated)</em> ' : ''}${d.text}<span class="when">${new Date(d.at).toLocaleString()}</span></li>`).join('')
    || '<li class="bk-empty" style="border:none">No dispatches yet — the war awaits its first battle.</li>';
  // opt #29 (L7): the theater bitmap renders ONCE — every re-render used to
  // rebuild the whole innerHTML, re-decoding a multi-megapixel image on every
  // marker click. Now the <img> node survives: markers and the side panel
  // mutate in place, the bitmap never decodes twice. (Asset also cut: the
  // 3.6MB PNG became a 610KB 2048w JPEG — same map at menu resolution.)
  let wrap = root.querySelector<HTMLElement>('#scar-wrap');
  if (!wrap) {
    root.innerHTML = `
    <div id="scar-layout">
      <div id="scar-wrap"><img src="/scar-map.jpg" alt="THE SCAR — theater map" draggable="false" /></div>
      <div id="scar-side"></div>
    </div>`;
    wrap = root.querySelector<HTMLElement>('#scar-wrap')!;
  }
  wrap.querySelectorAll('.scar-marker').forEach((m) => m.remove());
  wrap.insertAdjacentHTML('beforeend', markers);
  root.querySelector<HTMLElement>('#scar-side')!.innerHTML = `
        <div class="bk-card">${selHtml}</div>
        <div class="bk-card">${scienceCampaignBankHTML(c.scienceBonuses)}</div>
        ${operationModel ? renderOperationsBoard(operationModel) : ''}
        <div class="bk-card"><h4>Morning dispatch</h4><ul class="bk-journal">${dispatch}</ul></div>`;
  root.querySelectorAll<HTMLButtonElement>('.scar-marker').forEach((btn) => {
    btn.onclick = () => {
      audio.play('ui_click');
      const f = FRONTS.find((x) => x.id === btn.dataset.front)!;
      activeFrontId = f.id;
      selectedMilitaryMissionId = null;
      selectedMode = f.mode;
      selectedTheme = f.theme;
      queuedScienceLaunch = null;
      renderScarMap();
    };
  });
  const dep = root.querySelector<HTMLButtonElement>('#front-deploy');
  if (dep && sel) dep.onclick = () => {
    selectedMode = sel.mode;
    selectedTheme = sel.theme;
    queuedScienceLaunch = null;
    void startGame();
  };
  const science = root.querySelector<HTMLButtonElement>('#front-science');
  if (science && sel && selSt) science.onclick = () => {
    const launch = prepareScarScienceMission(c, sel.id, scarScienceSeed(sel.id, selSt.pass, c.season), scienceClones);
    if (!launch) { renderScarMap(); return; }
    queuedScienceLaunch = launch;
    selectedMode = 'science';
    selectedTheme = launch.spec.theme;
    saveCampaign(c); // the sortie window is spent before deployment
    void startGame();
  };
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
  // opt #31: the QUALITY tier — read once at renderer construction, so a
  // change applies on the next match (no mid-match shader recompiles)
  const qual = $('set-quality') as HTMLSelectElement;
  qual.value = settings.quality;
  qual.onchange = () => { settings.quality = qual.value as 'high' | 'low'; saveSettings(); };
  // #89: HUD widget transparency — applies live via the CSS var
  const hop = $('set-hud-op') as HTMLInputElement;
  const hopVal = $('hud-op-val');
  const applyHop = () => document.documentElement.style.setProperty('--hud-op', String(settings.hudOpacity));
  hop.value = String(Math.round(settings.hudOpacity * 100));
  hopVal.textContent = hop.value + '%';
  applyHop();
  hop.oninput = () => { settings.hudOpacity = Number(hop.value) / 100; hopVal.textContent = hop.value + '%'; applyHop(); saveSettings(); };
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

  // THE RETICLE (Robert): style / color / distance / size / laser — all live,
  // read by the renderer every frame, so a change shows in the next match instantly.
  const ret = $('set-reticle') as HTMLSelectElement;
  ret.value = settings.reticle;
  ret.onchange = () => { settings.reticle = ret.value as ReticleStyle; saveSettings(); };
  const retColor = $('set-reticle-color') as HTMLSelectElement;
  retColor.value = '0x' + settings.reticleColor.toString(16).padStart(6, '0');
  retColor.onchange = () => { settings.reticleColor = Number(retColor.value); saveSettings(); };
  const retFacing = $('set-reticle-facing') as HTMLSelectElement;
  retFacing.value = settings.reticleFacing;
  retFacing.onchange = () => { settings.reticleFacing = retFacing.value as 'shooter' | 'screen'; saveSettings(); };
  const retDist = $('set-reticle-dist') as HTMLInputElement;
  const retDistVal = $('ret-dist-val');
  retDist.value = String(Math.round(settings.reticleDist * 100));
  retDistVal.textContent = `${retDist.value}%`;
  retDist.oninput = () => { settings.reticleDist = Number(retDist.value) / 100; retDistVal.textContent = `${retDist.value}%`; saveSettings(); };
  const retSize = $('set-reticle-size') as HTMLInputElement;
  const retSizeVal = $('ret-size-val');
  retSize.value = String(Math.round(settings.reticleScale * 100));
  retSizeVal.textContent = `${settings.reticleScale.toFixed(1)}×`;
  retSize.oninput = () => { settings.reticleScale = Number(retSize.value) / 100; retSizeVal.textContent = `${settings.reticleScale.toFixed(1)}×`; saveSettings(); };
  const laser = $('set-laser') as HTMLInputElement;
  laser.checked = settings.laser;
  laser.onchange = () => { settings.laser = laser.checked; saveSettings(); };

  // CONTROLLER (Robert: "controller configuration in the menu"). The twin-stick
  // gamepad already ships; these knobs feed input.ts's pollGamepad live.
  const padOn = $('set-pad-enabled') as HTMLInputElement;
  padOn.checked = settings.padEnabled;
  padOn.onchange = () => { settings.padEnabled = padOn.checked; saveSettings(); };
  const padDz = $('set-pad-deadzone') as HTMLInputElement;
  const padDzVal = $('pad-dz-val');
  padDz.value = String(Math.round(settings.padDeadzone * 100));
  padDzVal.textContent = `${Math.round(settings.padDeadzone * 100)}%`;
  padDz.oninput = () => { settings.padDeadzone = Number(padDz.value) / 100; padDzVal.textContent = `${padDz.value}%`; saveSettings(); };
  const padSens = $('set-pad-sens') as HTMLInputElement;
  const padSensVal = $('pad-sens-val');
  padSens.value = String(Math.round(settings.padSensitivity * 100));
  padSensVal.textContent = `${settings.padSensitivity.toFixed(1)}×`;
  padSens.oninput = () => { settings.padSensitivity = Number(padSens.value) / 100; padSensVal.textContent = `${settings.padSensitivity.toFixed(1)}×`; saveSettings(); };
  const padInv = $('set-pad-inverty') as HTMLInputElement;
  padInv.checked = settings.padInvertY;
  padInv.onchange = () => { settings.padInvertY = padInv.checked; saveSettings(); };
  // live connection status (Chrome only lists a pad after a button press)
  const padStatus = $('pad-status');
  const refreshPadStatus = () => {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const pad = pads.find((p) => p);
    if (!pad) { padStatus.textContent = '🎮 No controller detected — plug one in and press a button'; padStatus.classList.remove('on'); }
    else { padStatus.textContent = `🎮 ${(pad.id.replace(/\(.*?\)/g, '').trim() || 'Controller')} connected · ${pad.buttons.length} buttons`; padStatus.classList.add('on'); }
  };
  refreshPadStatus();
  window.addEventListener('gamepadconnected', refreshPadStatus);
  window.addEventListener('gamepaddisconnected', refreshPadStatus);
  setInterval(refreshPadStatus, 1000);
}
$('deploy-btn').addEventListener('click', () => { activeFrontId = null; startGame(); });
window.addEventListener('keydown', (e) => {
  // Enter deploys ONLY when the menu is the actual front surface — with the
  // onboarding overlay up, an Enter here once launched an invisible CTF
  // underneath and soft-locked boot camp (running=true killed its button)
  if (e.key === 'Enter' && !running && !$('menu').classList.contains('hidden')
    && $('onboarding').classList.contains('hidden')) startGame();
});

// THE FRONT DOOR: first run enlists you (name → homeland → the faction the
// sheet assigns you); every run after lands on the main menu (Single Player /
// Multiplayer soon / Options). SINGLE PLAYER drops the overlay to this deploy
// screen; the assigned faction becomes the side you deploy on.
function applyIdentity(id: PlayerIdentity) {
  const nameInput = $('player-name') as HTMLInputElement;
  if (nameInput) nameInput.value = id.callsign;
  playerTeam = factionTeam(id.faction);
}
// §14 THE FIRST HOUR, re-hung (#48): the front-door commit orphaned the boot
// camp — mountOnboarding lost its only caller and the paintball yard became
// dead code. The host below is the recovered pre-front-door launch wiring;
// mountOnboarding self-guards (stage==='done' → returns false, mounts nothing).
const onboardingHost = {
  launch(cfg: { mode: ModeId; theme: ThemeId; seed?: number; classId?: ClassId; equipment?: string[] }) {
    selectedMilitaryMissionId = null;
    selectedMode = cfg.mode;
    selectedTheme = cfg.theme;
    seedOverride = cfg.seed;
    if (cfg.classId) selectedClass = cfg.classId;
    if (cfg.equipment) selectedEquipment = cfg.equipment.filter((id) => EQUIPMENT[id]);
    activeFrontId = null;
    startGame();
  },
};
mountFrontend({
  enterMenu() {
    $('menu').classList.remove('hidden');
    // a fresh recruit's first SINGLE PLAYER goes to the paintball yard — the
    // boot camp overlay mounts OVER the deploy screen until its state machine
    // says done; veterans (and skippers) never see it again
    mountOnboarding(onboardingHost);
  },
  onIdentity: applyIdentity,
});
// a returning player already has an identity — seed the team before any deploy
{ const id0 = loadIdentity(); if (id0) playerTeam = factionTeam(id0.faction); }

// ── THE PWA SHELL (Robert's tablet goal) ────────────────────────────────────
// Production builds register the service worker (offline boot + install
// prompt); the dev server stays raw so HMR never fights a cache.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => { /* http / private mode */ });
}
// touch-first machines get the CSS treatment even on the menus (bigger
// targets, safe-area padding) before any match starts
if (isTouchDevice()) document.body.classList.add('touch');

// ── THE SERVICE RECORD (auth) — who this device says you are ───────────────
// Local sessions are the offline truth; the Supabase door lights up when a
// project + env vars exist (auth.ts). The strip lives under the main menu.
{
  const session = currentSession();
  void restoreSession();
  const menuInner = document.querySelector('.menu-inner');
  if (menuInner) {
    const strip = document.createElement('div');
    strip.id = 'service-record';
    const id0 = loadIdentity();
    const who = id0 ? `${id0.callsign} · ${id0.faction === 'collective' ? 'THE COLLECTIVE' : 'THE UNITED FRONT'}` : 'UNREGISTERED';
    const how = session.provider === 'supabase'
      ? `NET ACCOUNT ${session.email ?? ''}`
      : `DEVICE SESSION ${session.userId.slice(0, 8).toUpperCase()}`;
    strip.innerHTML = `<span class="sr-label">SERVICE RECORD</span>`
      + `<span class="sr-who">${who}</span><span class="sr-how">${how}</span>`
      + (supabaseConfigured && session.provider !== 'supabase' ? `<button id="sr-signin" type="button">SIGN IN</button>` : '')
      + `<button id="sr-signout" type="button" title="Sign out and muster a new soldier on next boot">SIGN OUT</button>`;
    menuInner.appendChild(strip);
    (strip.querySelector('#sr-signout') as HTMLButtonElement).onclick = () => {
      signOut();
      clearIdentity(); // the front door re-enlists on reload
      window.location.reload();
    };
  }
}
// MID-COURSE RESUME: the yard advances by reloading the page between rounds —
// if boot camp is genuinely IN PROGRESS (past the untouched default), remount
// it immediately over the front menu so round 2 / the profile read greets the
// recruit without an extra click. A brand-new player still gets the front door
// first (enlist → menu → SINGLE PLAYER → the yard).
{
  const ob = loadOnboarding();
  if (loadIdentity() && ob.stage !== 'done' && (ob.stage !== 'skirmish' || ob.rounds.length > 0)) {
    mountOnboarding(onboardingHost);
  }
}
