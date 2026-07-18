// ═══════════════════════════════════════════════════════════════════════════
// THE MATCHUP STAGE — pick any United Front LSW, pick any Collective LSW,
// drop them at opposite ends of an authored street, and WATCH. The fight is
// the real sim (the same brains, the same threat, the same laws); the street
// is authored into a live World; and the ground is EDITABLE mid-fight —
// click a tile to cycle open → crate → wall and watch the bots repath
// around your thumb on the scale. The last roster-goal gate, opened.
//
// Additive module: mounts into #matchup, owns its own THREE group, ticks
// from the harness frame loop at the topbar's time scale (the Time slider
// slows the fight — the sliders audit, live).
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { WEAPONS } from '../sim/data';
import { LSW_TINT } from '../client/models/soldiers';
import { LSWS, lswsForTeam } from '../sim/lsw';
import { GRID, T_COVER, T_GRASS, T_OPEN, T_WALL, TILE, WORLD } from '../sim/map';
import type { AscendantId } from '../sim/types';
import { World } from '../sim/world';

export interface MatchupDeps {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  canvas: HTMLCanvasElement;
}

export interface MatchupCtl {
  tick(dt: number): void;
  setActive(on: boolean): void;
  readonly active: boolean;
}

// the street: a canyon of building faces with doorways, crates midline
const AX0 = 30, AX1 = 70, AZ0 = 44, AZ1 = 56; // tile bounds of the arena

export function mountMatchup(root: HTMLElement, deps: MatchupDeps): MatchupCtl {
  let active = false;
  let world: World | null = null;
  let fightTime = 0;
  let winner: string | null = null;
  let ufPick: AscendantId = lswsForTeam(0)[0];
  let collPick: AscendantId = lswsForTeam(1)[0];

  const group = new THREE.Group();
  group.visible = false;
  deps.scene.add(group);

  // ---- the panel (no pulldowns — chips, the house way) ---------------------
  const style = document.createElement('style');
  style.textContent = `
    #matchup { position: fixed; right: 12px; top: 56px; width: 320px; max-height: calc(100vh - 70px);
      overflow-y: auto; background: rgba(14,13,10,0.94); border: 1px solid #f5b21a; padding: 10px 12px;
      font: 12px 'Courier New', monospace; color: #e8e0c8; z-index: 30; letter-spacing: 0.03em; }
    #matchup h3 { color: #f5b21a; font-size: 12px; margin: 8px 0 4px; }
    #matchup .mu-chips { display: flex; flex-wrap: wrap; gap: 3px; }
    #matchup .mu-chip { border: 1px solid #4a4436; background: #23201a; color: #cfc7b0; padding: 2px 6px;
      cursor: pointer; font: 11px 'Courier New', monospace; }
    #matchup .mu-chip:hover { border-color: #f5b21a; }
    #matchup .mu-chip.on { background: #33291b; color: #f5b21a; border-color: #f5b21a; }
    #matchup #mu-fight { width: 100%; margin-top: 10px; padding: 7px 0; background: #f5b21a; color: #14110b;
      border: 0; font: bold 13px 'Courier New', monospace; cursor: pointer; letter-spacing: 0.08em; }
    #matchup #mu-status { margin-top: 8px; white-space: pre-line; min-height: 60px; }
    #matchup .mu-note { opacity: 0.55; margin-top: 6px; }
  `;
  document.head.appendChild(style);

  root.innerHTML = `
    <h3>▌UNITED FRONT</h3><div class="mu-chips" id="mu-uf"></div>
    <h3>▌THE COLLECTIVE</h3><div class="mu-chips" id="mu-coll"></div>
    <button id="mu-fight">⚔ FIGHT</button>
    <div id="mu-status">Pick a matchup. The street is waiting.</div>
    <div class="mu-note">Click any street tile mid-fight to cycle open → crate → wall — the bots repath live. The topbar Time slider slows the whole bout.</div>
  `;

  const chipRow = (host: HTMLElement, ids: AscendantId[], get: () => AscendantId, set: (id: AscendantId) => void) => {
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'mu-chip';
      b.textContent = `${LSWS[id].name} T${LSWS[id].threat}`;
      b.title = WEAPONS[LSWS[id].weapon]?.name ?? '';
      b.onclick = () => { set(id); refreshChips(); };
      b.dataset.id = id;
      host.appendChild(b);
    }
    const refresh = () => {
      for (const b of Array.from(host.children) as HTMLButtonElement[]) b.classList.toggle('on', b.dataset.id === get());
    };
    return refresh;
  };
  const refreshUf = chipRow(root.querySelector('#mu-uf')!, lswsForTeam(0), () => ufPick, (id) => { ufPick = id; });
  const refreshColl = chipRow(root.querySelector('#mu-coll')!, lswsForTeam(1), () => collPick, (id) => { collPick = id; });
  const refreshChips = () => { refreshUf(); refreshColl(); };
  refreshChips();
  const status = root.querySelector<HTMLDivElement>('#mu-status')!;

  // ---- arena geometry (rebuilt on fight start and on every live edit) ------
  let terrain = new THREE.Group();
  group.add(terrain);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7f6a, roughness: 0.9 });
  const coverMat = new THREE.MeshStandardMaterial({ color: 0xa08c62, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7c8a48, roughness: 1 });

  function rebuildTerrain() {
    group.remove(terrain);
    terrain.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); } });
    terrain = new THREE.Group();
    if (!world) return;
    const m4 = new THREE.Matrix4();
    const walls: [number, number][] = [], covers: [number, number][] = [], grass: [number, number][] = [];
    for (let z = AZ0 - 2; z <= AZ1 + 2; z++) {
      for (let x = AX0 - 2; x <= AX1 + 2; x++) {
        const t = world.map.grid[z * GRID + x];
        if (t === T_WALL) walls.push([x, z]);
        else if (t === T_COVER) covers.push([x, z]);
        else if (t === T_GRASS) grass.push([x, z]);
      }
    }
    const put = (tiles: [number, number][], geo: THREE.BoxGeometry, mat: THREE.Material, y: number) => {
      const inst = new THREE.InstancedMesh(geo, mat, Math.max(tiles.length, 1));
      inst.count = tiles.length;
      tiles.forEach(([x, z], i) => { m4.setPosition((x + 0.5) * TILE - WORLD / 2, y, (z + 0.5) * TILE - WORLD / 2); inst.setMatrixAt(i, m4); });
      inst.castShadow = true;
      terrain.add(inst);
    };
    put(walls, new THREE.BoxGeometry(TILE, 4, TILE), wallMat, 2);
    put(covers, new THREE.BoxGeometry(TILE * 0.95, 1.2, TILE * 0.95), coverMat, 0.6);
    put(grass, new THREE.BoxGeometry(TILE * 0.9, 1.1, TILE * 0.9), grassMat, 0.55);
    // the street floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry((AX1 - AX0 + 5) * TILE, (AZ1 - AZ0 + 5) * TILE),
      new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(((AX0 + AX1) / 2 + 0.5) * TILE - WORLD / 2, 0.01, ((AZ0 + AZ1) / 2 + 0.5) * TILE - WORLD / 2);
    floor.receiveShadow = true;
    terrain.add(floor);
    group.add(terrain);
  }

  // ---- fighters + rounds (rebuilt per fight, updated per frame) -----------
  const bodies = new Map<number, THREE.Group>();
  const bars = new Map<number, THREE.Sprite>();
  let shots = new THREE.Group();
  group.add(shots);

  function makeBody(id: AscendantId): THREE.Group {
    const tintDef = LSW_TINT[id] ?? { tint: 0xcccccc, scale: 1.3 };
    const g = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 2.1, 8),
      new THREE.MeshStandardMaterial({ color: tintDef.tint, roughness: 0.6 }));
    torso.position.y = 1.15; torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6),
      new THREE.MeshStandardMaterial({ color: tintDef.tint, roughness: 0.4, emissive: tintDef.tint, emissiveIntensity: 0.25 }));
    head.position.y = 2.5;
    g.add(torso, head);
    g.scale.setScalar(tintDef.scale);
    return g;
  }

  function makeBar(): THREE.Sprite {
    const cvs = document.createElement('canvas');
    cvs.width = 64; cvs.height = 8;
    const tex = new THREE.CanvasTexture(cvs);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(3.4, 0.42, 1);
    return sp;
  }

  function drawBar(sp: THREE.Sprite, frac: number, plateFrac: number) {
    const cvs = (sp.material.map as THREE.CanvasTexture).image as HTMLCanvasElement;
    const ctx = cvs.getContext('2d')!;
    ctx.clearRect(0, 0, 64, 8);
    ctx.fillStyle = '#221e16'; ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#e04a3a'; ctx.fillRect(1, 1, 62 * Math.max(0, frac), 4);
    ctx.fillStyle = '#9fb6c9'; ctx.fillRect(1, 5, 62 * Math.max(0, plateFrac), 2);
    (sp.material.map as THREE.CanvasTexture).needsUpdate = true;
  }

  // ---- the street, authored -----------------------------------------------
  function authorStreet(w: World) {
    const g = w.map.grid;
    for (let z = AZ0; z <= AZ1; z++) {
      for (let x = AX0; x <= AX1; x++) {
        g[z * GRID + x] = T_OPEN;
      }
    }
    for (let x = AX0; x <= AX1; x++) {
      // building faces with doorways every 8 tiles — sightlines broken, never sealed
      g[AZ0 * GRID + x] = (x - AX0) % 8 === 4 ? T_OPEN : T_WALL;
      g[AZ1 * GRID + x] = (x - AX0) % 8 === 2 ? T_OPEN : T_WALL;
    }
    // crates midline + a grass pocket each side: cover to spend, rumor to hide in
    for (const [cx, cz] of [[40, 50], [45, 48], [50, 51], [55, 49], [60, 50], [50, 47]] as const) {
      g[cz * GRID + cx] = T_COVER;
    }
    for (const [gx, gz] of [[37, 52], [38, 52], [37, 53], [63, 47], [62, 47], [63, 48]] as const) {
      g[gz * GRID + gx] = T_GRASS;
    }
  }

  // ---- fight control -------------------------------------------------------
  function startFight() {
    // dispose old
    for (const b of bodies.values()) group.remove(b);
    for (const s of bars.values()) group.remove(s);
    bodies.clear(); bars.clear();
    group.remove(shots); shots = new THREE.Group(); group.add(shots);

    const w = new World({ seed: (Math.random() * 0xffffffff) >>> 0, mode: 'tdm', botsPerTeam: 0, matchMinutes: 15 });
    // THE DRIVE FIX (Robert: "these **** **** don't fight"): the bare world
    // let both gods walk to objective points computed from the GENERATED
    // map's bases — they froze 95u apart, never perceiving (the range is 65).
    // The street is the whole war now: seal the generated map outside it,
    // and plant the bases INSIDE the lane (±30u) so both objective anchors
    // land ~26u apart — they meet in sight of each other and it HAS to burn.
    for (let z = 0; z < GRID; z++) for (let x = 0; x < GRID; x++) {
      if (x <= AX0 || x >= AX1 || z <= AZ0 || z >= AZ1) w.map.grid[z * GRID + x] = T_WALL;
    }
    authorStreet(w);
    world = w;
    fightTime = 0;
    winner = null;
    const west = { x: (AX0 + 2.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
    const east = { x: (AX1 - 1.5) * TILE - WORLD / 2, y: 0, z: 50.5 * TILE - WORLD / 2 };
    w.map.basePos = [{ x: -30, y: 0, z: west.z }, { x: 30, y: 0, z: west.z }];
    w.map.hillPos = { x: 0, y: 0, z: west.z };
    const uf = w.addLsw(ufPick, 0, west)!;
    const coll = w.addLsw(collPick, 1, east)!;
    for (const s of [uf, coll]) {
      const body = makeBody(s.ascendant as AscendantId);
      const bar = makeBar();
      bodies.set(s.id, body); bars.set(s.id, bar);
      group.add(body, bar);
    }
    rebuildTerrain();
    // camera over the street
    const cx = ((AX0 + AX1) / 2 + 0.5) * TILE - WORLD / 2;
    const cz = 50.5 * TILE - WORLD / 2;
    deps.camera.position.set(cx, 46, cz + 34);
    deps.controls.target.set(cx, 0, cz);
    status.textContent = `${LSWS[ufPick].name} vs ${LSWS[collPick].name} — the street decides.`;
  }
  root.querySelector<HTMLButtonElement>('#mu-fight')!.onclick = startFight;

  // ---- live navmesh tweak: click a street tile, cycle its state ------------
  const ray = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  deps.canvas.addEventListener('pointerdown', (ev) => {
    if (!active || !world || ev.button !== 0 || (ev.target as HTMLElement)?.closest('#matchup')) return;
    const r = deps.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, deps.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(groundPlane, hit)) return;
    const tx = Math.floor((hit.x + WORLD / 2) / TILE), tz = Math.floor((hit.z + WORLD / 2) / TILE);
    if (tx <= AX0 || tx >= AX1 || tz <= AZ0 || tz >= AZ1) return; // the faces + rim stay authored
    const idx = tz * GRID + tx;
    const t = world.map.grid[idx];
    // open → crate → wall → open: the monotonic law is a MATCH law; the
    // editor's whole point is tweaking the mesh mid-fight
    world.map.grid[idx] = t === T_OPEN ? T_COVER : t === T_COVER ? T_WALL : T_OPEN;
    rebuildTerrain();
  });

  // ---- per-frame -----------------------------------------------------------
  const shotGeo = new THREE.SphereGeometry(0.14, 6, 4);
  const shotMat = new THREE.MeshBasicMaterial({ color: 0xffe9a0 });
  function tick(dt: number) {
    if (!active || !world || dt <= 0 || winner) return;
    world.step(Math.min(dt, 0.05), new Map());
    fightTime += dt;
    // fighters
    for (const [id, body] of bodies) {
      const s = world.soldiers.get(id);
      if (!s) continue;
      body.visible = s.alive;
      body.position.set(s.pos.x, s.pos.y, s.pos.z);
      body.rotation.y = -s.yaw;
      const bar = bars.get(id)!;
      bar.visible = s.alive;
      bar.position.set(s.pos.x, s.pos.y + 3.6, s.pos.z);
      drawBar(bar, s.hp / s.maxHp, s.maxArmor > 0 ? s.armor / s.maxArmor : 0);
    }
    // rounds in the air — pooled, capped
    while (shots.children.length < Math.min(world.projectiles.size, 64)) shots.add(new THREE.Mesh(shotGeo, shotMat));
    let i = 0;
    for (const p of world.projectiles.values()) {
      if (i >= shots.children.length) break;
      const m = shots.children[i++];
      m.visible = true;
      m.position.set(p.pos.x, Math.max(p.pos.y, 0.3), p.pos.z);
    }
    for (; i < shots.children.length; i++) shots.children[i].visible = false;
    // the verdict
    const fighters = [...bodies.keys()].map((id) => world!.soldiers.get(id)!);
    const dead = fighters.find((s) => !s.alive);
    if (dead) {
      const alive = fighters.find((s) => s.alive);
      winner = alive ? LSWS[alive.ascendant as AscendantId]?.name ?? alive.name : 'nobody';
      status.textContent = `${winner.toUpperCase()} TAKES THE STREET — ${fightTime.toFixed(1)}s\n(${LSWS[ufPick].name} vs ${LSWS[collPick].name})`;
    } else {
      const [a, b] = fighters;
      status.textContent = `${fightTime.toFixed(1)}s\n` +
        `${LSWS[ufPick].name}: ${Math.ceil(a?.hp ?? 0)} hp\n${LSWS[collPick].name}: ${Math.ceil(b?.hp ?? 0)} hp`;
    }
  }

  function setActive(on: boolean) {
    active = on;
    group.visible = on;
    root.classList.toggle('hidden', !on);
    if (on && !world) startFight();
  }

  return { tick, setActive, get active() { return active; } };
}
