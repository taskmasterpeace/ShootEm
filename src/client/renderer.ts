import * as THREE from 'three';
import { TEAM_COLORS, VEHICLES, WEAPONS } from '../sim/data';
import { GRID, T_COVER, T_WALL, T_WATER, TILE, WORLD } from '../sim/map';
import type { SimEvent, Soldier, Team, Vec3 } from '../sim/types';
import type { World } from '../sim/world';
import { audio, type SoundName } from './audio';
import { Particles, FlashLights } from './effects';
import { buildFlag, buildGadget, buildGate, buildPad, buildPickup, buildProp, buildSoldier, buildTurretMesh, buildVehicle } from './models';

const TRACER_COLORS: Record<string, number> = {
  bullet: 0xffd890, shell: 0xffb060, rocket: 0xff8840, plasma: 0x60c8ff,
  rail: 0xb090ff, flame: 0xff7020, beam: 0x70ffb0, acid: 0xa0e040, none: 0,
};

export class Renderer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: Particles;
  flashes: FlashLights;
  camPos = new THREE.Vector3();
  camShake = 0;

  private soldierMeshes = new Map<number, THREE.Group>();
  private vehicleMeshes = new Map<number, THREE.Group>();
  private recoilAt = new Map<number, number>();     // soldier id → time of last shot
  private vehRecoilAt = new Map<number, number>();  // vehicle id → time of last shot
  private turretMeshes = new Map<number, THREE.Group>();
  private projMeshes = new Map<number, THREE.Mesh>();
  private pickupMeshes = new Map<number, THREE.Group>();
  private mineMeshes = new Map<number, THREE.Mesh>();
  private gadgetMeshes = new Map<number, THREE.Group>();
  private spinners: THREE.Object3D[] = [];
  private beams: { mesh: THREE.Mesh; until: number }[] = [];
  private flagMeshes: THREE.Group[] = [];
  private cpRings: THREE.Mesh[] = [];
  private hillRing: THREE.Mesh | null = null;
  private nameSprites = new Map<number, THREE.Sprite>();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 400);
    this.scene.fog = new THREE.Fog(0xb8c4cc, 90, 240);
    this.scene.background = new THREE.Color(0xa8bccc);
    this.particles = new Particles(this.scene);
    this.flashes = new FlashLights(this.scene);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  buildStaticWorld(world: World) {
    // lights
    const hemi = new THREE.HemisphereLight(0xcfe0ee, 0x5a5648, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe8c0, 1.6);
    sun.position.set(60, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 130;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.far = 300;
    this.scene.add(sun);

    // ground: canvas-painted texture from the tile grid
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1024;
    const ctx = cvs.getContext('2d')!;
    const px = 1024 / GRID;
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const t = world.map.grid[z * GRID + x];
        const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
        const r = n - Math.floor(n);
        if (t === T_WATER) {
          ctx.fillStyle = `rgb(${40 + r * 10}, ${88 + r * 12}, ${110 + r * 14})`;
        } else {
          // dry savanna grass with patches
          const g = 96 + r * 26;
          ctx.fillStyle = r > 0.82
            ? `rgb(${g + 18}, ${g - 4}, ${52 + r * 12})`
            : `rgb(${g - 18}, ${g}, ${54 + r * 14})`;
        }
        ctx.fillRect(x * px, z * px, px + 1, px + 1);
      }
    }
    // base tint
    for (const team of [0, 1] as Team[]) {
      const b = world.map.basePos[team];
      const cx = ((b.x + WORLD / 2) / WORLD) * 1024;
      const cz = ((b.z + WORLD / 2) / WORLD) * 1024;
      const grad = ctx.createRadialGradient(cx, cz, 6, cx, cz, 70);
      const col = team === 0 ? '232, 163, 61' : '61, 189, 232';
      grad.addColorStop(0, `rgba(${col}, 0.35)`);
      grad.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 70, cz - 70, 140, 140);
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD, WORLD),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // walls as instanced boxes — skip tiles covered by props (rocks/trees render themselves)
    const propTiles = new Set<string>();
    for (const p of world.map.props) {
      const tx = Math.floor((p.pos.x + WORLD / 2) / TILE);
      const tz = Math.floor((p.pos.z + WORLD / 2) / TILE);
      const r = p.type === 'rock' ? 2 : p.type === 'bunker' ? 3 : 1;
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) propTiles.add(`${tx + dx},${tz + dz}`);
    }
    const wallTiles: [number, number][] = [];
    const coverTiles: [number, number][] = [];
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const t = world.map.grid[z * GRID + x];
        if (t === T_WALL && !propTiles.has(`${x},${z}`)) wallTiles.push([x, z]);
        if (t === T_COVER && !propTiles.has(`${x},${z}`)) coverTiles.push([x, z]);
      }
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x74705f, roughness: 0.9 });
    const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 4, TILE), wallMat, wallTiles.length);
    wallInst.castShadow = true;
    wallInst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    wallTiles.forEach(([x, z], i) => {
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, 2, (z + 0.5) * TILE - WORLD / 2);
      wallInst.setMatrixAt(i, m4);
    });
    this.scene.add(wallInst);

    const coverMat = new THREE.MeshStandardMaterial({ color: 0x8a7a54, roughness: 0.9 });
    const coverInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 0.95, 1.2, TILE * 0.95), coverMat, Math.max(coverTiles.length, 1));
    coverInst.castShadow = true;
    coverTiles.forEach(([x, z], i) => {
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, 0.6, (z + 0.5) * TILE - WORLD / 2);
      coverInst.setMatrixAt(i, m4);
    });
    this.scene.add(coverInst);

    // props
    for (const p of world.map.props) {
      if (p.type === 'crate') continue; // crates already rendered as cover boxes
      const mesh = buildProp(p.type, p.scale);
      mesh.position.set(p.pos.x, 0, p.pos.z);
      mesh.rotation.y = p.rot;
      this.scene.add(mesh);
    }

    // vehicle pads
    for (const pad of world.map.vehiclePads) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.2, 2.8, 24),
        new THREE.MeshBasicMaterial({ color: TEAM_COLORS[pad.team], transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pad.pos.x, 0.03, pad.pos.z);
      this.scene.add(ring);
    }

    // jump gates + grav-lift pads
    for (const gate of world.map.gates) {
      for (const end of [gate.a, gate.b]) {
        const arch = buildGate();
        arch.position.set(end.x, 0, end.z);
        this.scene.add(arch);
        const spin = arch.getObjectByName('spin');
        if (spin) this.spinners.push(spin);
      }
    }
    for (const pad of world.map.pads) {
      const disc = buildPad();
      disc.position.set(pad.pos.x, 0, pad.pos.z);
      this.scene.add(disc);
    }

    // mode objective markers
    const m = world.mode;
    if (m.id === 'koth') {
      this.hillRing = this.makeRing(m.hillPos!, m.hillRadius!, 0xffffff, 0.4);
    }
    if (m.id === 'conquest') {
      for (const cp of m.points!) this.cpRings.push(this.makeRing(cp.pos, cp.radius, 0xffffff, 0.35));
    }
    if (m.id === 'ctf') {
      for (const f of m.flags!) {
        const flag = buildFlag(f.team);
        this.scene.add(flag);
        this.flagMeshes.push(flag);
      }
    }
  }

  private makeRing(pos: Vec3, radius: number, color: number, opacity: number): THREE.Mesh {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.7, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.05, pos.z);
    this.scene.add(ring);
    return ring;
  }

  private makeNameSprite(name: string, team: Team): THREE.Sprite {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 48;
    const ctx = cvs.getContext('2d')!;
    ctx.font = '600 26px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = team === 0 ? '#e8a33d' : '#3dbde8';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(5.5, 1.05, 1);
    return sprite;
  }

  /** Sync all dynamic entities to the sim state, advance FX. */
  update(world: World, localId: number, dt: number) {
    const local = world.soldiers.get(localId);
    const localTeam = local?.team ?? 0;

    // soldiers
    for (const s of world.soldiers.values()) {
      let mesh = this.soldierMeshes.get(s.id);
      if (!mesh) {
        mesh = buildSoldier(s.team, s.classId, s.kind);
        // cache the animation joints — getObjectByName every frame is wasteful
        mesh.userData.joints = Object.fromEntries(
          ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'head', 'torso', 'gun', 'belly']
            .map((n) => [n, mesh!.getObjectByName(n)]),
        );
        this.scene.add(mesh);
        this.soldierMeshes.set(s.id, mesh);
        if (s.kind === 'bot' || s.kind === 'human' || s.kind === 'scientist') {
          const tag = this.makeNameSprite(s.name, s.team);
          tag.position.y = 2.6;
          mesh.add(tag);
          this.nameSprites.set(s.id, tag);
        }
      }
      const inVehicle = s.vehicleId >= 0;
      const corpse = !s.alive && world.time < s.respawnAt - 0.02;
      mesh.visible = (s.alive || corpse) && !inVehicle && !(s.cloaked && s.team !== localTeam && s.id !== localId);
      if (!mesh.visible) continue;
      const tag = this.nameSprites.get(s.id);
      if (tag) tag.visible = s.id !== localId && s.alive;
      mesh.position.set(s.pos.x, s.pos.y, s.pos.z);
      mesh.rotation.y = -s.yaw; // sim yaw is math-angle on XZ; three rotates opposite
      this.animateSoldier(mesh, s, world);
    }
    for (const [id, mesh] of this.soldierMeshes) {
      if (!world.soldiers.has(id)) {
        this.scene.remove(mesh);
        this.soldierMeshes.delete(id);
      }
    }

    // vehicles
    for (const v of world.vehicles.values()) {
      let mesh = this.vehicleMeshes.get(v.id);
      if (!mesh) {
        mesh = buildVehicle(v.kind, v.team);
        this.scene.add(mesh);
        this.vehicleMeshes.set(v.id, mesh);
      }
      mesh.visible = v.alive;
      if (!v.alive) continue;
      const hoverBob = v.kind === 'skiff' ? Math.sin(world.time * 3 + v.id) * 0.15 + 0.3 : 0;
      mesh.position.set(v.pos.x, hoverBob, v.pos.z);
      mesh.rotation.y = -v.yaw;
      const turret = mesh.getObjectByName('turret');
      if (turret) turret.rotation.y = -(v.turretYaw - v.yaw);
      // wheels roll with signed ground speed
      const wheels = mesh.userData.wheels as THREE.Group[] | undefined;
      if (wheels?.length) {
        const fwdSpeed = Math.cos(v.yaw) * v.vel.x + Math.sin(v.yaw) * v.vel.z;
        for (const axle of wheels) axle.rotation.z -= (fwdSpeed * dt) / 0.42;
      }
      // mounted-gun recoil
      const gunRecoil = mesh.getObjectByName('gunRecoil');
      if (gunRecoil) {
        const shotAt = this.vehRecoilAt.get(v.id) ?? -1;
        const kick = Math.max(0, 1 - (world.time - shotAt) / (v.kind === 'tank' ? 0.35 : 0.12));
        gunRecoil.position.x = -kick * (v.kind === 'tank' ? 0.4 : 0.15);
      }
      // skiff thruster glow pulse
      if (v.kind === 'skiff') {
        for (const name of ['thrustL', 'thrustR']) {
          const ring = mesh.getObjectByName(name) as THREE.Mesh | undefined;
          const rm = ring?.material as THREE.MeshStandardMaterial | undefined;
          if (rm) rm.emissiveIntensity = 0.7 + Math.sin(world.time * 9 + v.id) * 0.3;
        }
      }
    }

    // turrets
    for (const t of world.turrets.values()) {
      let mesh = this.turretMeshes.get(t.id);
      if (!mesh) {
        mesh = buildTurretMesh(t.team);
        mesh.position.set(t.pos.x, 0, t.pos.z);
        this.scene.add(mesh);
        this.turretMeshes.set(t.id, mesh);
      }
      const head = mesh.getObjectByName('head');
      if (head) head.rotation.y = -t.yaw;
      const eye = mesh.getObjectByName('eye') as THREE.Mesh | undefined;
      const em = eye?.material as THREE.MeshStandardMaterial | undefined;
      if (em) em.emissiveIntensity = 0.55 + Math.sin(world.time * 4 + t.id) * 0.45;
    }
    for (const [id, mesh] of this.turretMeshes) {
      if (!world.turrets.has(id)) {
        this.scene.remove(mesh);
        this.turretMeshes.delete(id);
      }
    }

    // projectiles
    for (const p of world.projectiles.values()) {
      let mesh = this.projMeshes.get(p.id);
      if (!mesh) {
        const def = WEAPONS[p.weapon];
        const color = TRACER_COLORS[def.tracer] || 0xffcc88;
        if (def.tracer === 'none') continue;
        const big = def.tracer === 'rocket' || def.tracer === 'shell';
        mesh = new THREE.Mesh(
          new THREE.BoxGeometry(big ? 0.5 : 0.9, 0.08, 0.08),
          new THREE.MeshBasicMaterial({ color }),
        );
        this.scene.add(mesh);
        this.projMeshes.set(p.id, mesh);
      }
      mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
      mesh.rotation.y = -Math.atan2(p.vel.z, p.vel.x);
    }
    for (const [id, mesh] of this.projMeshes) {
      if (!world.projectiles.has(id)) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        mesh.geometry.dispose();
        this.projMeshes.delete(id);
      }
    }

    // pickups
    for (const pk of world.pickups.values()) {
      let mesh = this.pickupMeshes.get(pk.id);
      if (!mesh) {
        mesh = buildPickup(pk.type);
        this.scene.add(mesh);
        this.pickupMeshes.set(pk.id, mesh);
      }
      mesh.visible = pk.respawnAt === 0;
      mesh.position.set(pk.pos.x, 0.5 + Math.sin(world.time * 2.5 + pk.id) * 0.15, pk.pos.z);
      mesh.rotation.y = world.time * 1.2;
    }

    // mines
    for (const m of world.mines.values()) {
      let mesh = this.mineMeshes.get(m.id);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.45, 0.18, 10),
          new THREE.MeshStandardMaterial({ color: 0x4a4a3a, emissive: TEAM_COLORS[m.team], emissiveIntensity: 0.4 }),
        );
        mesh.position.set(m.pos.x, 0.1, m.pos.z);
        this.scene.add(mesh);
        this.mineMeshes.set(m.id, mesh);
      }
    }
    for (const [id, mesh] of this.mineMeshes) {
      if (!world.mines.has(id)) {
        this.scene.remove(mesh);
        this.mineMeshes.delete(id);
      }
    }

    // gadgets: beacons, domes, drones, pods
    for (const g of world.gadgets.values()) {
      let mesh = this.gadgetMeshes.get(g.id);
      if (!mesh) {
        mesh = buildGadget(g.type, g.team);
        this.scene.add(mesh);
        this.gadgetMeshes.set(g.id, mesh);
      }
      mesh.position.set(g.pos.x, g.type === 'drone' || g.type === 'supply_pod' ? g.pos.y : 0, g.pos.z);
      const spin = mesh.getObjectByName('spin');
      if (spin) spin.rotation.z = world.time * 2.2;
      if (g.type === 'drone') {
        mesh.rotation.y = -(g.phase ?? 0) - Math.PI / 2;
        mesh.position.y = g.pos.y + Math.sin(world.time * 4 + g.id) * 0.15;
      }
      const pulse = mesh.getObjectByName('pulse') as THREE.Mesh | undefined;
      const pm = pulse?.material as THREE.MeshStandardMaterial | undefined;
      if (pm) {
        // orbital lamp blinks faster as it arms
        const rate = g.type === 'orbital' ? 4 + (world.time - g.bornAt) * 6 : 3;
        pm.emissiveIntensity = 0.5 + 0.5 * Math.sin(world.time * rate);
      }
    }
    for (const [id, mesh] of this.gadgetMeshes) {
      if (!world.gadgets.has(id)) {
        this.scene.remove(mesh);
        this.gadgetMeshes.delete(id);
      }
    }

    // orbital beams fade out
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const mm = b.mesh.material as THREE.MeshStandardMaterial;
      mm.opacity = Math.max(0, (b.until - world.time) / 0.9) * 0.85;
      b.mesh.scale.x = b.mesh.scale.z = 1 + (0.9 - (b.until - world.time)) * 0.6;
      if (world.time >= b.until) {
        this.scene.remove(b.mesh);
        mm.dispose();
        b.mesh.geometry.dispose();
        this.beams.splice(i, 1);
      }
    }

    // flags
    if (world.mode.flags) {
      world.mode.flags.forEach((f, i) => {
        const mesh = this.flagMeshes[i];
        if (!mesh) return;
        mesh.position.set(f.pos.x, f.carrierId >= 0 ? 1.2 : 0, f.pos.z);
        const cloth = mesh.getObjectByName('cloth');
        if (cloth) cloth.rotation.y = Math.sin(world.time * 2.2) * 0.25;
      });
    }

    // objective ring colors
    if (this.hillRing && world.mode.hillHolder !== undefined) {
      const h = world.mode.hillHolder;
      (this.hillRing.material as THREE.MeshBasicMaterial).color.setHex(h === -1 ? 0xffffff : TEAM_COLORS[h]);
    }
    if (world.mode.points) {
      world.mode.points.forEach((cp, i) => {
        const ring = this.cpRings[i];
        if (ring) (ring.material as THREE.MeshBasicMaterial).color.setHex(cp.owner === -1 ? 0xffffff : TEAM_COLORS[cp.owner]);
      });
    }

    // camera follow
    if (local) {
      const inVehicle = local.vehicleId >= 0;
      const dist = (window as unknown as { __camDist?: number }).__camDist ?? (inVehicle ? 40 : 30);
      const target = new THREE.Vector3(local.pos.x, 0, local.pos.z);
      const desired = new THREE.Vector3(local.pos.x, dist, local.pos.z + dist * 0.55);
      this.camPos.lerp(desired, 1 - Math.pow(0.001, dt));
      if (this.camShake > 0) {
        this.camPos.x += (Math.random() - 0.5) * this.camShake;
        this.camPos.z += (Math.random() - 0.5) * this.camShake;
        this.camShake = Math.max(0, this.camShake - dt * 2.5);
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(target);
      audio.listener = { x: local.pos.x, y: 0, z: local.pos.z };
    }

    this.particles.update(dt);
    this.flashes.update(world.time, dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Skeletal-ish animation driven straight from sim state. */
  private animateSoldier(mesh: THREE.Group, s: Soldier, world: World) {
    const j = mesh.userData.joints as Record<string, THREE.Object3D | undefined>;
    const t = world.time;
    const zed = s.kind !== 'human' && s.kind !== 'bot' && s.kind !== 'scientist';
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const moving = speed > 0.6;

    // ---- death: keel over and fade out ----
    let alpha = s.cloaked ? 0.3 : 1;
    if (!s.alive) {
      const deathTime = s.respawnAt - (zed ? 2 : 4); // matches sim respawn delays
      const k = Math.min(1, Math.max(0, (t - deathTime) / 0.45));
      mesh.rotation.z = -1.5 * k * k;
      mesh.position.y = 0.12 * k;
      alpha = Math.min(1, Math.max(0.05, (s.respawnAt - t) / 0.8));
      this.setAlpha(mesh, alpha);
      return;
    }

    // ---- gait ----
    const gaitRate = zed
      ? s.kind === 'sprinter' ? 15 : s.kind === 'brute' ? 4.5 : 6
      : 5.5 + speed * 0.75;
    const phase = t * gaitRate + (s.id % 9) * 0.77;
    const stride = moving
      ? (s.kind === 'brute' ? 0.75 : s.kind === 'sprinter' ? 0.9 : 0.55) * Math.min(1, speed / 5 + 0.35)
      : 0;
    const swing = Math.sin(phase) * stride;
    const airborne = s.pos.y > 0.6;

    if (j.legL && j.legR && j.shinL && j.shinR) {
      if (airborne) {
        // jetpack tuck
        j.legL.rotation.z = 0.55;
        j.legR.rotation.z = 0.3;
        j.shinL.rotation.z = -0.9;
        j.shinR.rotation.z = -0.7;
      } else {
        j.legL.rotation.z = swing;
        j.legR.rotation.z = -swing;
        j.shinL.rotation.z = stride ? -Math.max(0, Math.sin(phase + 0.5)) * 1.0 : 0;
        j.shinR.rotation.z = stride ? -Math.max(0, -Math.sin(phase + 0.5)) * 1.0 : 0;
      }
    }

    // body: bob while moving, breathe while idle, lean into the run
    const bob = moving ? Math.abs(Math.sin(phase)) * 0.055 : Math.sin(t * 1.8 + s.id) * 0.012;
    mesh.position.y = s.pos.y + bob;
    const lean = airborne ? -0.3 : -Math.min(speed / 14, 1) * (zed ? 0.18 : 0.09);
    mesh.rotation.z = lean + (s.kind === 'sprinter' ? -0.18 : 0);

    if (zed) {
      // undead: reaching arms sway, head lolls, brutes lumber
      const sway = s.kind === 'brute' ? 0.35 : 0.16;
      if (j.armL) j.armL.rotation.z = (s.kind === 'sprinter' ? -2.2 : -1.35) + Math.sin(phase * 0.55) * sway;
      if (j.armR) j.armR.rotation.z = (s.kind === 'sprinter' ? -2.0 : -1.05) + Math.cos(phase * 0.5) * sway;
      if (j.head) j.head.rotation.z = Math.sin(phase * 0.45) * 0.12;
      if (j.torso) j.torso.rotation.x = Math.sin(phase * 0.5) * (s.kind === 'brute' ? 0.1 : 0.07);
      if (j.belly) {
        const pulse = 1 + Math.sin(t * 6) * 0.06;
        j.belly.scale.setScalar(pulse);
      }
    } else if (j.gun) {
      // rifle recoil kick
      const shotAt = this.recoilAt.get(s.id) ?? -1;
      const kick = Math.max(0, 1 - (t - shotAt) / 0.09);
      j.gun.position.x = (j.gun.userData.baseX ?? 0.42) - kick * 0.11;
      if (j.torso) j.torso.rotation.z = -kick * 0.05;
    }

    this.setAlpha(mesh, alpha);
  }

  private setAlpha(mesh: THREE.Group, alpha: number) {
    if (mesh.userData.lastAlpha === alpha) return; // skip the traverse when nothing changed
    mesh.userData.lastAlpha = alpha;
    mesh.traverse((o) => {
      const mm = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mm && 'opacity' in mm) {
        mm.transparent = alpha < 1;
        mm.opacity = alpha;
      }
    });
  }

  /** Turn sim events into sound + particles. Returns events for the HUD layer too. */
  applyEvents(events: SimEvent[], world: World, localId: number) {
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          if (!e.pos || !e.weapon) break;
          const def = WEAPONS[e.weapon];
          // recoil bookkeeping for the animator
          if (e.soldierId !== undefined) {
            const shooter = world.soldiers.get(e.soldierId);
            if (shooter && shooter.vehicleId >= 0) this.vehRecoilAt.set(shooter.vehicleId, world.time);
            else this.recoilAt.set(e.soldierId, world.time);
          }
          audio.play(def.sound as SoundName, { pos: e.pos, volume: 0.7 });
          if (def.tracer !== 'beam' && def.tracer !== 'none') {
            this.particles.emit({ pos: e.pos, count: 3, color: 0xffcc66, speed: 3, life: 0.12, spread: 0.3, up: 1, size: 0.3 });
          }
          break;
        }
        case 'explosion': {
          if (!e.pos) break;
          const big = e.weapon === 'tank_cannon' || e.weapon === 'mml';
          audio.play(big ? 'explosion_big' : 'explosion', { pos: e.pos, volume: 1 });
          this.particles.emit({ pos: e.pos, count: big ? 60 : 35, color: 0xff9040, speed: big ? 14 : 9, life: 0.7, spread: 1, up: 7, gravity: 8 });
          this.particles.emit({ pos: e.pos, count: 20, color: 0x555555, speed: 4, life: 1.2, spread: 1.5, up: 5, gravity: 2 });
          this.flashes.flash(e.pos, 0xffaa44, big ? 90 : 45, world.time);
          const local = world.soldiers.get(localId);
          if (local) {
            const d = Math.hypot(e.pos.x - local.pos.x, e.pos.z - local.pos.z);
            if (d < 30) this.camShake = Math.max(this.camShake, (big ? 0.9 : 0.5) * (1 - d / 30));
          }
          break;
        }
        case 'hit':
          if (e.pos) {
            this.particles.emit({ pos: e.pos, count: 6, color: 0xffe0a0, speed: 5, life: 0.25, spread: 0.2, up: 2 });
            audio.play('hit', { pos: e.pos, volume: 0.5 });
          }
          break;
        case 'death':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1 }, count: 22, color: 0xa03030, speed: 5, life: 0.6, spread: 0.5, up: 4 });
            audio.play('death', { pos: e.pos, volume: 0.8 });
          }
          break;
        case 'heal':
          if (e.pos) this.particles.emit({ pos: { ...e.pos, y: 1.5 }, count: 6, color: 0x60ff90, speed: 2, life: 0.5, spread: 0.6, up: 3, gravity: -2 });
          break;
        case 'jetpack':
          if (e.pos) this.particles.emit({ pos: { ...e.pos, y: 0.7 }, count: 4, color: 0xff9840, speed: 2, life: 0.35, spread: 0.3, up: -4, gravity: -4 });
          if (e.soldierId === localId) audio.play('jetpack', { volume: 0.35 });
          break;
        case 'pickup': audio.play('pickup', { pos: e.pos, volume: 0.8 }); break;
        case 'reload': if (e.soldierId === localId) audio.play('reload', { volume: 0.7 }); break;
        case 'cloak': audio.play('cloak', { pos: e.pos, volume: 0.6 }); break;
        case 'respawn': if (e.soldierId === localId) audio.play('spawn', { volume: 0.6 }); break;
        case 'mine_planted': audio.play('mine_plant', { pos: e.pos, volume: 0.7 }); break;
        case 'turret_built': audio.play('turret_built', { pos: e.pos, volume: 0.8 }); break;
        case 'vehicle_destroyed':
          if (e.pos) {
            this.particles.emit({ pos: e.pos, count: 80, color: 0xff8030, speed: 16, life: 1, spread: 2, up: 10, gravity: 7 });
            audio.play('explosion_big', { pos: e.pos, volume: 1 });
          }
          break;
        case 'warp':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 26, color: 0x66e8ff, speed: 5, life: 0.5, spread: 0.6, up: 5, gravity: -3 });
            audio.play('warp', { pos: e.pos, volume: 0.85 });
          }
          break;
        case 'blink':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 18, color: 0x9a55dd, speed: 4, life: 0.45, spread: 0.5, up: 3, gravity: -2 });
            audio.play('blink', { pos: e.pos, volume: 0.8 });
          }
          break;
        case 'emp':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1 }, count: 50, color: 0x55aaff, speed: 13, life: 0.5, spread: 0.4, up: 2, gravity: 1 });
            this.flashes.flash(e.pos, 0x66aaff, 55, world.time, 0.25);
            audio.play('emp_burst', { pos: e.pos, volume: 0.95 });
          }
          break;
        case 'gravlift':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 0.4 }, count: 14, color: 0x9a66ff, speed: 3, life: 0.5, spread: 0.8, up: 9, gravity: -2 });
            audio.play('gravlift', { pos: e.pos, volume: 0.7 });
          }
          break;
        case 'beacon_planted':
          if (e.pos) {
            audio.play(e.big ? 'orbital_charge' : 'beacon', { pos: e.pos, volume: e.big ? 1 : 0.7 });
            this.particles.emit({ pos: { ...e.pos, y: 0.8 }, count: 8, color: e.big ? 0xff4030 : 0xffcf70, speed: 2, life: 0.4, spread: 0.4, up: 3 });
          }
          break;
        case 'orbital_strike': {
          if (!e.pos) break;
          const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.6, 90, 16, 1, true),
            new THREE.MeshStandardMaterial({
              color: 0xffe0b0, emissive: 0xffb050, emissiveIntensity: 2,
              transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
            }),
          );
          beam.position.set(e.pos.x, 45, e.pos.z);
          this.scene.add(beam);
          this.beams.push({ mesh: beam, until: world.time + 0.9 });
          this.particles.emit({ pos: e.pos, count: 120, color: 0xffb050, speed: 20, life: 1.1, spread: 2, up: 14, gravity: 8 });
          this.flashes.flash(e.pos, 0xffcc66, 140, world.time, 0.4);
          this.camShake = Math.max(this.camShake, 1.2);
          audio.play('explosion_big', { pos: e.pos, volume: 1 });
          break;
        }
        case 'pod_incoming':
          audio.play('thump', { volume: 0.6 });
          break;
        case 'pod_landed':
          if (e.pos) {
            this.particles.emit({ pos: e.pos, count: 40, color: 0xc8b880, speed: 9, life: 0.8, spread: 1.5, up: 6, gravity: 7 });
            audio.play('explosion', { pos: e.pos, volume: 0.8 });
          }
          break;
        case 'gadget_destroyed':
          if (e.pos) this.particles.emit({ pos: { ...e.pos, y: 1 }, count: 14, color: 0x99a0aa, speed: 6, life: 0.5, spread: 0.5, up: 4 });
          break;
        case 'flag_taken': audio.play('flag_taken', { volume: 0.9 }); break;
        case 'flag_captured': audio.play('flag_captured', { volume: 1 }); break;
        case 'flag_returned': audio.play('flag_returned', { volume: 0.9 }); break;
        case 'point_captured': audio.play('point_captured', { volume: 0.9 }); break;
        case 'wave_start': audio.play('wave_start', { volume: 1 }); break;
        case 'match_over': {
          const local = world.soldiers.get(localId);
          audio.play(e.team !== undefined && local && e.team === local.team ? 'victory' : e.team === undefined ? 'victory' : 'defeat', { volume: 1 });
          break;
        }
      }
    }
  }
}
