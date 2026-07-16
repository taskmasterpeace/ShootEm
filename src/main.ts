import { CLASSES, EQUIPMENT, MODE_INFO, THEMES, WEAPONS } from './sim/data';
import { CLASS_ARMORY, familyWeapons } from './sim/arsenal';
import { isCoopMode, type ClassId, type ModeId, type PlayerCmd, type ThemeId, type WeaponFamily } from './sim/types';
import { World, type Difficulty, type Loadout } from './sim/world';
import { audio } from './client/audio';
import { Chat } from './client/chat';
import { StaticOverlay } from './client/effects';
import { Hud } from './client/hud';
import { Input } from './client/input';
import { Renderer } from './client/renderer';
import { NetGame } from './client/net';
import { KILLCAM_CAM, MATCH_LINGER_LOCAL_MS, ReplayDirector } from './client/replay';
import { MatchTracker, RANKS, loadDossier, rankFor, saveDossier, type Dossier } from './client/record';
import { FRONTS, SCAR_TEXT, applyResult, bandOf, loadCampaign, saveCampaign, simulateTimeSkip, type Campaign } from './client/campaign';
import { RangeCourse, gradeFor, loadWall } from './client/range';
import { loadSettings, saveSettings, settings } from './client/settings';

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
let botsPerTeam = 12; // 32B: 12v12 target — bots fill every open position
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
  // 'frozen' / 'flooded' / 'blocked' arrive with the surface layer (§8.6)
}

function startLocal(renderer: Renderer, hud: Hud, input: Input, name: string, endGame: () => void) {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const world = new World({ seed, mode: selectedMode, difficulty, botsPerTeam, matchMinutes, theme: selectedTheme });
  const me = world.addSoldier(name, selectedClass, 0, 'human', currentLoadout());
  applyScarMods(world, activeFrontId); // §8.5: the front's wound shapes the field
  // the Record (§3.4): fold this match into the dossier as it happens
  const tracker = dossier ? new MatchTracker(dossier, name, selectedClass, selectedMode, seed) : null;
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
  } else {
    for (let i = 0; i < Math.max(0, botsPerTeam - 1); i++) {
      const cls = classPool[i % classPool.length];
      world.addSoldier(wrap(n++), cls, 0, 'bot', botLoadout(cls));
    }
    for (let i = 0; i < botsPerTeam; i++) {
      const cls = classPool[(i + 3) % classPool.length];
      world.addSoldier(wrap(n++), cls, 1, 'bot', botLoadout(cls));
    }
  }

  renderer.buildStaticWorld(world);
  course?.begin(world, me.id);
  hud.announce(MODE_INFO[selectedMode].name.toUpperCase(), true, 0);
  (window as unknown as Record<string, unknown>).__ww = { world, me, renderer, hud, input, recorder: director.recorder, replay: director.player, director }; // debug/testing handle

  const FIXED = 1 / 60;
  let acc = 0;
  let last = performance.now();
  let overAt = 0;
  const cmds = new Map<number, PlayerCmd>();
  // FPV drone feed: static builds as the link degrades; bursts on disconnect
  const staticFx = new StaticOverlay();
  let hadDrone = false;
  let nextStaticAt = 0;

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
    tracker?.applyEvents(events, world, me.id);
    tracker?.update(world, me.id, dt);
    course?.update(world, dt);
    if (world.mode.over && tracker) {
      void tracker.finalize(world, me.id).then((sum) => {
        if (!sum) return;
        renderBarracks(); // the record just grew
        // the Living Campaign: this battle moves its front (22B)
        if (activeFrontId && campaign) {
          applyResult(campaign, activeFrontId, sum.won);
          saveCampaign(campaign);
          renderScarMap();
        }
        hud.careerHtml = `<div id="career-pane"><h3>Career — what this match added</h3>
          <div class="cp-row"><span>+${sum.rankPointsGained} rank pts</span>
          <span>${sum.rankBefore === sum.rankAfter ? sum.rankAfter : `${sum.rankBefore} → <b>${sum.rankAfter}</b> ▲`}</span>
          <span>${sum.kills} kills · ${sum.deaths} deaths</span></div>
          ${sum.medals.length ? `<div class="cp-row" style="margin-top:0.4rem">${sum.medals.map((m) => `<span class="bk-medal">${m.icon} ${m.name}</span>`).join('')}</div>` : ''}
          ${sum.journal.length ? `<p style="margin-top:0.5rem;color:var(--muted)">📖 ${sum.journal[0].text}</p>` : ''}</div>`;
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
    renderer.setGrenadePreview(world, me, !replaying && input.grenadeAiming ? input.aimPoint(renderer.camera) : null);
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
      if (!overAt) overAt = now;
      else if (now - overAt > MATCH_LINGER_LOCAL_MS) { endGame(); return; }
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
}
$('deploy-btn').addEventListener('click', () => { activeFrontId = null; startGame(); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !running && !$('menu').classList.contains('hidden')) startGame();
});
