import * as THREE from 'three';
import { TEAM_COLORS, VEHICLES, WEAPONS } from '../sim/data';
import { CLIMB_H, F2_SLIT, F2_WALL, F2_WELL, GRID, T_CLIMB, T_DEEP, S_GRIT, S_ICE, S_MUD, S_PLATE, S_WET, T_COVER, T_DOOR, T_DOOR_OPEN, T_GRASS, T_LADDER, T_METAL, T_OPEN, T_SLIT, T_WALL, T_WATER, TILE, WORLD, blocksShot, houseAt, losClear, surfaceAt, tileAt } from '../sim/map';
import { materialForSurface, materialOf, type ImpactKind } from '../sim/materials';
import { TORCH_MULT, classLinger, eyesSeePoint, perceivesNow, seenRecently, type SeenMark } from '../sim/perception';
import { paintColorFor } from './onboarding';
import type { WeatherKind } from '../sim/weather';
import type { SimEvent, Soldier, Team, Vec3 } from '../sim/types';
import { HAND_FRAG_REACH, aimSpreadMul, meleeWindupFor, type World } from '../sim/world';
import { audio, type SoundName } from './audio';
import { BIOME_AUDIO } from './soundscape';
import { settings } from './settings';
import { darknessFloor, setDarknessFrame, sweepDarkness } from './darkness';
import { Particles, FlashLights, Fireballs } from './effects';
import { JOINT_NAMES, isUndead, poseSoldierJoints, CAST_SCHOOL, FLIGHT_POSES, RECOIL_SCALE, stepYawSpring, throwArmCurve, WEAPON_HOLDS, type GaitState, type CastSchool } from './animation';
import { chunkCount, drawChunks, drawGrade, drawNotches, drawNumber, makeRingMesh, RING_COLORS, ringChunkTexture, ringTier } from './ring';
import { ICE_HOLD_DRAIN, LSWS, STRUGGLE_HP, type LswDef } from '../sim/lsw';
import { hash01 } from '../sim/rng';
import { collapseStyleFor, type CollapseStyle } from './deathpose';
import { buildFlag, buildGadget, buildGate, buildPad, buildPickup, buildProp, buildSoldier, buildTurretMesh, buildVehicle, dressAsLsw } from './models';

const TRACER_COLORS: Record<string, number> = {
  bullet: 0xffd890, shell: 0xffb060, rocket: 0xff8840, plasma: 0x60c8ff,
  rail: 0x8fd0ff, flame: 0xff7020, beam: 0x70ffb0, acid: 0xa0e040,
  canister: 0xd8d2c0, paint: 0xffffff, none: 0, // paint is recolored per shooter; canister per weapon
};
/** PER-WEAPON TINT: a projectile color keyed by weapon id, winning over the
 *  family default AND the god's body tint. Canister bands (smoke pale, fire
 *  red) plus the BEAM SEVEN — each god's beam a distinct, readable hue so a
 *  wall of energy fire reads as many weapons, not one mint smear. No purple. */
export const WEAPON_TINTS: Record<string, number> = {
  smoke_nade: 0xd8d2c0, fire_nade: 0xd84a20,
  // THE BEAM SEVEN
  lsw_reactor: 0x58ff88,   // hot reactor green
  lsw_crimson: 0xe02838,   // arterial red — the blood siphon
  lsw_magnetar: 0xf8f8f0,  // arc-weld white — induction flash
  lsw_pulse: 0xffe040,     // klaxon yellow — sound made visible
  lsw_frostbite: 0xa0e0ff, // glacial blue-white
  lsw_mirage: 0x50e0e0,    // heat-shimmer teal
  lsw_eclipse: 0xfff0d0,   // corona pale — sheathes the dark core (makeProjectile)
  // ARC / EXOTIC extras — electric whites & blues, water, void
  lsw_voltstriker: 0xbfe8ff, lsw_overload: 0xffd858, lsw_stormcaller: 0xe8f4ff,
  lsw_wraith: 0xc8d8cc, lsw_dominator: 0xffb0a0, lsw_riptide: 0x48b8ff,
  lsw_oblivion: 0x303038,  // dark-core void (black, never purple)
};

// ---- ragdoll ----
/** Joints the ragdoll goes limp on (all swing on local Z). */
const RAG_JOINTS = ['legL', 'legR', 'shinL', 'shinR', 'armL', 'armR', 'head', 'torso'] as const;
interface RagState { t0: number; pitch: number; roll: number; cap: Record<string, number>; seed: number; style: CollapseStyle; yaw0: number }
/** Overshoot-and-settle ease — gives limbs a floppy, physical follow-through. */
function easeOutBack(x: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Environment palettes — sky, fog, terrain, and architecture per theme. */
export interface ThemePalette {
  sky: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  sun: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  wall: number;
  cover: number;
  /** ground painter: open tile rgb from noise r; water tile rgb */
  open: (r: number) => string;
  water: (r: number) => string;
}

export const THEME_PALETTES: Record<string, ThemePalette> = {
  savanna: {
    sky: 0xa8bccc, fog: 0xb8c4cc, fogNear: 90, fogFar: 240,
    sun: 0xffe8c0, sunIntensity: 1.6, hemiSky: 0xcfe0ee, hemiGround: 0x5a5648,
    wall: 0x74705f, cover: 0x8a7a54,
    open: (r) => { const g = 96 + r * 26; return r > 0.82 ? `rgb(${g + 18}, ${g - 4}, ${52 + r * 12})` : `rgb(${g - 18}, ${g}, ${54 + r * 14})`; },
    water: (r) => `rgb(${40 + r * 10}, ${88 + r * 12}, ${110 + r * 14})`,
  },
  starship: {
    sky: 0x05070d, fog: 0x0a0e16, fogNear: 110, fogFar: 300,
    sun: 0xcfe2ff, sunIntensity: 1.1, hemiSky: 0x8fa5c0, hemiGround: 0x1c2028,
    wall: 0x4a5260, cover: 0x39404c,
    open: (r) => { const g = 52 + r * 14 + (r > 0.9 ? 22 : 0); return `rgb(${g}, ${g + 3}, ${g + 8})`; }, // deck plate
    water: (r) => `rgb(${20 + r * 8}, ${60 + r * 10}, ${70 + r * 10})`, // coolant sump
  },
  asteroid: {
    sky: 0x070808, fog: 0x141210, fogNear: 70, fogFar: 210,
    sun: 0xfff2d8, sunIntensity: 1.9, hemiSky: 0x6a6458, hemiGround: 0x201c16,
    wall: 0x5c5348, cover: 0x4c443a,
    open: (r) => { const g = 62 + r * 22; return `rgb(${g + 8}, ${g}, ${g - 10})`; }, // regolith
    water: (r) => `rgb(${30 + r * 8}, ${34 + r * 8}, ${40 + r * 10})`, // tar pool
  },
  europa: {
    sky: 0x08202e, fog: 0x0e2c3e, fogNear: 55, fogFar: 160,
    sun: 0x9fd8e8, sunIntensity: 1.0, hemiSky: 0x5a90a8, hemiGround: 0x0e2028,
    wall: 0x8fb2c0, cover: 0x6a92a2,
    open: (r) => { const g = 120 + r * 24; return `rgb(${g - 40}, ${g - 8}, ${g + 10})`; }, // pale seabed
    water: (r) => `rgb(${20 + r * 10}, ${120 + r * 30}, ${150 + r * 30})`, // glowing vents
  },
  titan: {
    sky: 0xc08240, fog: 0xb87e42, fogNear: 40, fogFar: 130,
    sun: 0xffb060, sunIntensity: 1.3, hemiSky: 0xd8a068, hemiGround: 0x5a4428,
    wall: 0x7a5c3a, cover: 0x6a5232,
    open: (r) => { const g = 105 + r * 26; return `rgb(${g + 20}, ${g - 20}, ${44 + r * 10})`; }, // methane dunes
    water: (r) => `rgb(${50 + r * 8}, ${38 + r * 8}, ${24 + r * 6})`, // methane lake
  },
  triton: {
    sky: 0x10161e, fog: 0x1a2430, fogNear: 60, fogFar: 190,
    sun: 0xd8e8f8, sunIntensity: 0.9, hemiSky: 0x7a90a8, hemiGround: 0x141c24,
    wall: 0xb8ccd8, cover: 0x8aa2b2,
    open: (r) => { const g = 150 + r * 30; return `rgb(${g - 24}, ${g - 8}, ${g + 4})`; }, // nitrogen ice
    water: (r) => `rgb(${16 + r * 6}, ${34 + r * 10}, ${52 + r * 12})`, // crevasse deep
  },
};

/** EMBODIMENT: the LSW's attackPose (on its def, upper-case) → the pose the
 *  animator plays (CastSchool, lower-case). SLAM/CHANNEL/THRUST already ship
 *  from the signature power-cast; LOB/BRACE/SHOULDER/FLICK are the four added
 *  for regular attacks so a sniper braces, a thrower lobs, an assassin flicks. */
const POSE_TO_SCHOOL: Record<NonNullable<LswDef['attackPose']>, CastSchool> = {
  SLAM: 'slam', CHANNEL: 'channel', THRUST: 'thrust',
  LOB: 'lob', BRACE: 'brace', SHOULDER: 'shoulder', FLICK: 'flick',
};

// OUTBREAK §6/§1 — THE VISIBLE CORPSE. A booked body must never be an invisible
// spawn point: it lingers where it fell and, in its final seconds, THRASHES
// before it rises. A cheap prone form authored flat (no standing-rig pivot to
// fight), sharing one set of geometry + one dead-tinted material, so forty of
// them cost almost nothing.
const CORPSE_REVEAL_DELAY = 3.7; // stay hidden until the dead-soldier mesh clears (RESPAWN_DELAY 4s)
const CORPSE_CRIT = 2;           // the final thrash window, matching sim CORPSE_CRITICAL_WINDOW
/** STATUS §2 / death show (Robert: "corpses should linger 20-30s — a fought-on
 *  battlefield"). In NON-outbreak modes a fallen soldier's body stays where it
 *  fell for this long, decoupled from the 4s respawn, then sinks away. (Outbreak
 *  modes already render the reanimating `world.corpses`.) */
const BATTLEFIELD_CORPSE_LINGER = 24;
let _corpseGeo: { torso: THREE.BoxGeometry; head: THREE.SphereGeometry; limb: THREE.BoxGeometry } | null = null;
let _corpseMat: THREE.MeshLambertMaterial | null = null;
function buildCorpseMesh(): THREE.Group {
  if (!_corpseGeo) {
    _corpseGeo = {
      torso: new THREE.BoxGeometry(0.5, 0.26, 0.92),
      head: new THREE.SphereGeometry(0.16, 8, 6),
      limb: new THREE.BoxGeometry(0.13, 0.13, 0.58),
    };
    _corpseMat = new THREE.MeshLambertMaterial({ color: 0x4a4034 }); // desaturated, dead — no purple
  }
  const g = new THREE.Group();
  const torso = new THREE.Mesh(_corpseGeo.torso, _corpseMat!); torso.position.set(0, 0.16, 0);
  const head = new THREE.Mesh(_corpseGeo.head, _corpseMat!); head.position.set(0, 0.15, 0.58);
  const mk = (x: number, z: number) => { const m = new THREE.Mesh(_corpseGeo!.limb, _corpseMat!); m.position.set(x, 0.1, z); return m; };
  g.add(torso, head, mk(0.32, 0.16), mk(-0.32, 0.16), mk(0.15, -0.5), mk(-0.15, -0.5));
  g.rotation.y = Math.random() * Math.PI * 2; // varied facing — this is presentation, not sim
  return g;
}

// STATUS §1 / W1.2 — THE AIM RING (Robert: "an aim ring orbiting the character,
// showing facing + accuracy bloom"). A faint orbit ring around the local player
// with a two-arm WEDGE that points where you aim and OPENS with the cone: it
// tightens when you crouch or hold still, and sprays wide when you sprint or
// fire airborne — the readout for the accuracy-by-movement the sim now applies.
// The literal spread is a fraction of a degree, so AIM_SCALE exaggerates it into
// a cone the eye can actually read (an indicator, not a projected hitbox).
const AIM_SCALE = 6;
function buildAimRing(): THREE.Group {
  const g = new THREE.Group();
  const amber = 0xe8a33d;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.14, 40),
    new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
  g.add(ring);
  const armGeo = new THREE.BoxGeometry(0.05, 0.02, 1.6);
  const armMat = new THREE.MeshBasicMaterial({ color: amber, transparent: true, opacity: 0.72, depthWrite: false });
  for (const name of ['aimL', 'aimR'] as const) {
    const pivot = new THREE.Group(); pivot.name = name;
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0, 0.05, 1.35); // reaches out from the ring edge along the aim
    pivot.add(arm);
    g.add(pivot);
  }
  return g;
}

export class Renderer {
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  particles: Particles;
  flashes: FlashLights;
  camPos = new THREE.Vector3();
  camShake = 0;
  private fireballs!: Fireballs;
  /** World-space cursor, fed each frame by the client. Health meters read it:
   *  Robert asked that they stop rendering on every body at once and appear
   *  only under the pointer — "don't render it for the people unless I put my
   *  mouse around the area." null = no cursor (replay, menus) → nothing shows. */
  private hoverAt: { x: number; z: number } | null = null;
  /** how close the cursor must come before a body shows its vitals */
  private static readonly HOVER_R = 7;

  /** The client hands us the ground point under the mouse once per frame. */
  setHover(at: { x: number; z: number } | null) { this.hoverAt = at; }

  /** Is the cursor near enough to this body to be asking about it? */
  private hovered(x: number, z: number): boolean {
    const h = this.hoverAt;
    if (!h) return false;
    const dx = x - h.x, dz = z - h.z;
    return dx * dx + dz * dz < Renderer.HOVER_R * Renderer.HOVER_R;
  }
  /** wheel-zoom distance, fed by Input each frame */
  camDist = 30;
  /** true while a killcam/highlights puppet world is being rendered —
   *  mutes animation-marker audio, freezes the listener, hides live-time
   *  overlays, and switches entity cleanup from delete to hide (the live
   *  and replay rosters differ; deleting would thrash meshes every swap) */
  replayView = false;
  private lookAhead = new THREE.Vector3();

  private soldierMeshes = new Map<number, THREE.Group>();
  private vehicleMeshes = new Map<number, THREE.Group>();
  private recoilAt = new Map<number, number>();     // soldier id → time of last shot
  private vehRecoilAt = new Map<number, number>();  // vehicle id → time of last shot
  private turretMeshes = new Map<number, THREE.Group>();
  private projMeshes = new Map<number, THREE.Object3D>();
  private pickupMeshes = new Map<number, THREE.Group>();
  private mineMeshes = new Map<number, THREE.Mesh>();
  private gadgetMeshes = new Map<number, THREE.Group>();
  /** OUTBREAK §6: prone meshes for the incubating corpses, keyed by the corpse
   *  object itself (they carry no id). bornAt gates the reveal handoff. */
  private corpseMeshes = new Map<World['corpses'][number], { mesh: THREE.Group; bornAt: number }>();
  /** STATUS §2: lingering battlefield bodies in non-outbreak modes — booked on
   *  the alive→dead edge, they outlast the respawn and sink away at LINGER. */
  private battlefieldCorpses: { bornAt: number; mesh: THREE.Group }[] = [];
  private prevAlive = new Map<number, boolean>();
  private lastCorpseWorld: World | null = null;
  /** STATUS §1: the local player's aim ring — facing + the live accuracy cone. */
  private aimRing: THREE.Group | null = null;
  private spinners: THREE.Object3D[] = [];
  private beams: { mesh: THREE.Mesh; until: number }[] = [];
  /** §BEAMS row 188: live HELD streams, one per pouring soldier — a unit
   *  cylinder stretched muzzle→impact every frame while beamingUntil holds. */
  private heldBeams = new Map<number, THREE.Mesh>();
  /** PRISM sub-rays fanned from the node body — thin children of a held stream */
  private heldPrismSubs = new Map<number, THREE.Mesh[]>();
  /** §BEAMS row 189: clash-node meshes keyed by the sim's clash key */
  private clashNodes = new Map<string, THREE.Mesh>();
  /** row 246: pale ice quads over the water tiles Frostbite has frozen */
  private frostSheets = new Map<number, THREE.Mesh>();
  /** held-beam impact glow beads riding each stream's endpoint (eye-candy) */
  private heldBeamBeads = new Map<number, THREE.Mesh>();
  /** the MELEE PULSE-RING UI (Robert): grab-reach pulses that expand outward,
   *  and a persistent guard arc under the local player. */
  private grabPulses: { mesh: THREE.Mesh; born: number; x: number; z: number }[] = [];
  private guardArc: THREE.Mesh | null = null;
  /** THE GROUND SPREAD CIRCLE (Robert): a ring at the aim point sized to the
   *  live weapon spread — "where your bullets land," shotgun wide, pistol tight. */
  private spreadRing: THREE.Mesh | null = null;
  /** UI-MASTER §4 — the Impact Charge ring orbiting YOUR body: tightens as it
   *  winds up, snaps to a bright amber MAXIMUM band, then a red OVERCHARGE
   *  pulse. Reads `meleeCharge` (the same value the action-line meter shows). */
  private chargeRing: THREE.Mesh | null = null;
  /** UI-BIBLE §09 struggle bars: a world-space meter over each grabbed body,
   *  showing break progress (amber→green) or the choke reversal (red). */
  private struggleBars = new Map<number, { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string }>();
  /** the LOCAL player's encased drain-choice label (MASH vs HOLD) — one sprite, static text, shown only while YOU are the block */
  private encaseHint?: THREE.Sprite;
  private flagMeshes: THREE.Group[] = [];
  private cpRings: THREE.Mesh[] = [];
  private hillRing: THREE.Mesh | null = null;
  private nameSprites = new Map<number, { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string }>();
  private localId = -1; // set each frame in update(); lets animateSoldier know which soldier is YOU
  // tunneler support: map tile index → wall/cover instance so digs collapse visually
  private wallInst: THREE.InstancedMesh | null = null;
  private coverInst: THREE.InstancedMesh | null = null;
  private climbInst: THREE.InstancedMesh | null = null;      // §8.7 barricade bodies
  private climbLipInst: THREE.InstancedMesh | null = null;   // ...and their grab-lips
  private wallInstanceByTile = new Map<number, number>();
  private coverInstanceByTile = new Map<number, number>();
  private climbInstanceByTile = new Map<number, number>();
  // ---- visual feedback state ----
  private pingMarkers = new Map<number, THREE.Sprite>();   // revealed enemies get a chevron
  private pingTexture: THREE.Texture | null = null;
  private sweepRings: { mesh: THREE.Mesh; born: number }[] = []; // sensor-station radar pulses
  /** ✦ sonic-boom vapor rings (afterburner at speed) + per-hull burner edge memory */
  private boomRings: { mesh: THREE.Mesh; born: number }[] = [];
  private burnerWas = new Map<number, boolean>();
  /** LSW landing-zone dread rings, keyed by team:landsAt (UI P0) */
  private lzRings = new Map<string, THREE.Mesh>();
  private nextSweepAt = new Map<number, number>();          // vehicle id → next sweep time
  private ecmRings = new Map<number, THREE.Mesh>();         // crewed ECM jam-radius rings
  private nextSmokeAt = new Map<number, number>();          // vehicle id → next damage-smoke puff
  private nextMoundAt = new Map<number, number>();          // vehicle id → next burrow dirt-mound puff
  private wpPillars: THREE.Mesh[] = [];                     // pooled waypoint light pillars
  // melee feel: telegraph windows (arms up) keyed by attacker, and the arc slashes
  private meleeTelegraphs = new Map<number, { at: number; until: number }>();
  private throwPoses = new Map<number, { at: number; until: number }>();
  private castPoses = new Map<number, { at: number; until: number; school: CastSchool }>();
  private slashes: { mesh: THREE.Mesh; until: number }[] = [];
  // blink afterimages: a fading snapshot of the body left at the old spot
  private blinkGhosts: { mesh: THREE.Group; born: number; ttl: number; style: 'gold' | 'collapse' | 'flicker' }[] = [];
  // §19.2 sound-and-movement: footstep clocks for enemies you HEAR but can't
  // see, and the smudges their noise smears through the dark
  private unseenStepAt = new Map<number, number>();
  private smudges: { mesh: THREE.Mesh; until: number }[] = [];
  // THE BLAST RINGS (Robert: "a circle in the center, and a radius around
  // that"). Each explosion stamps two ground rings sized to the SIM's own
  // numbers — a bright kill DISC (die inside it) and an expanding splash
  // RING (the reach, chip damage at the rim). Pooled, capped, ~0.5s life.
  private blastRings: { mesh: THREE.Mesh; born: number; life: number; r0: number; r1: number; grow: boolean; peak: number }[] = [];
  /** rounds that already cracked past the local ear — one whiz per bullet */
  private whizzed = new Set<number>();
  // PAINTBALL: splatter STAYS (Robert) — flat paint decals, whole-match life,
  // capped FIFO. One shared circle geometry; one cached material per shade.
  private splats: THREE.Mesh[] = [];
  private splatGeo?: THREE.CircleGeometry;
  private splatMats = new Map<number, THREE.MeshBasicMaterial>();
  private nextLockToneAt = 0;                               // missile-lock warning throttle
  /** killcam duel framing: soldier id of the local player's killer (-1 = none).
   *  Set by the frame loops from the director; the camera frames victim+killer
   *  together and a red ring marks the killer. */
  killcamFocusId = -1;
  /** rotates the crew-chatter bark so the squad doesn't repeat itself */
  private crewLine = 0;
  private killerRing: THREE.Mesh | null = null;             // pulsing marker over the killer
  /** cutaway roofs (§8.4): fade when the viewed soldier stands beneath one */
  private roofs: { group: THREE.Group; mats: THREE.MeshStandardMaterial[]; house: { tx: number; tz: number; tw: number; th: number } }[] = [];
  /** second-storey shells (walls + floor slab) per two-storey house — faded
   *  like roofs when the focus stands on the ground floor beneath them */
  private uppers: { group: THREE.Group; house: { tx: number; tz: number; tw: number; th: number }; mats: THREE.MeshStandardMaterial[] }[] = [];
  private ladderMeshes: THREE.Group[] = [];
  /** persistent drill debris — capped FIFO so long sieges don't leak */
  private rubble: THREE.Mesh[] = [];
  private rubbleMat?: THREE.MeshStandardMaterial;

  // ---- §8.8 weather + the high sky ----
  private baseAtmo?: { fogNear: number; fogFar: number; sky: THREE.Color; fogColor: THREE.Color; hemi: number; sun: number };
  private hemiLight?: THREE.HemisphereLight;
  private sunLight?: THREE.DirectionalLight;
  /** drifting cloud deck at altitude — density follows the weather */
  private clouds: { mesh: THREE.Mesh; drift: number }[] = [];
  private cloudMat?: THREE.MeshLambertMaterial;
  private shelfMat?: THREE.MeshLambertMaterial; // B2: the low cloud shelf (bands 2-3)
  /** active precipitation system, rebuilt when the weather kind changes */
  private precip?: { kind: WeatherKind; obj: THREE.Object3D; pos: Float32Array; n: number };
  private nextFlashAt = 0;
  private flashUntil = 0;
  /** the ground material + a smoothed 0..1 wetness — rain darkens & slicks it */
  private groundMat?: THREE.MeshStandardMaterial;
  private groundWet = 0;
  /** live door slabs — swung by grid state (E toggles it in the sim) */
  private doors: { mesh: THREE.Mesh; idx: number; spansX: boolean; base: THREE.Vector3 }[] = [];
  /** the camera height actually used last frame (killcam duels exceed camDist)
   *  — overhead UI scales against it so names/meters hold constant SCREEN size */
  private viewDist = 30;
  /** far-zoom unit blips: team-colored ground discs that fade in as the models
   *  shrink — at command height the disc IS the soldier (RTS strategic icons) */
  private blipMats: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial] | null = null;
  private blipGeo: THREE.CircleGeometry | null = null;
  private blipRingGeo: THREE.RingGeometry | null = null;
  private blips = new Map<number, THREE.Mesh>();
  private nadeArc: THREE.Line | null = null;                // grenade-throw preview: dashed arc…
  private nadeRing: THREE.Mesh | null = null;               // …and the landing/splash ring
  private flyerAlt = new Map<number, number>();             // smoothed flyer altitude per id
  private flyerShadows = new Map<number, THREE.Mesh>();      // B2: ground blob, scales with altitude
  private flyerShadowGeo?: THREE.CircleGeometry;
  private frameDt = 1 / 60;                                 // dt of the current update()
  private darkSweepN = 0;                                   // READING THE DARK: sweep cadence counter
  /** C1 ROW 81 — the PER-VIEWER seen trail: marks stamped by the LOCAL eye
   *  alone, read by the 3D soldier draw (the minimap keeps the TEAM trail) */
  private localSeen = new Map<number, SeenMark>();
  private localSeenWorld?: World;
  private deathFall = new Map<number, { x: number; z: number }>(); // ragdoll tip dir per id

  /** Red chevron sprite texture for revealed-enemy markers (built once). */
  private getPingTexture(): THREE.Texture {
    if (this.pingTexture) return this.pingTexture;
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 64;
    const ctx = cvs.getContext('2d')!;
    ctx.fillStyle = '#ff4638';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(10, 12); ctx.lineTo(54, 12); ctx.lineTo(32, 46); ctx.closePath();
    ctx.stroke();
    ctx.fill();
    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.pingTexture = tex;
    return tex;
  }

  /** Hide the wall/cover instance on a dug tile (scale to zero). */
  /** DESTRUCTION: a knee-high pile where masonry died — the visible face of a
   *  T_RUBBLE tile. Rides the same capped `rubble` pool as tunneler chunks. */
  private breachPile(x: number, z: number) {
    for (let ri = 0; ri < 6; ri++) {
      const sz = 0.4 + Math.random() * 0.55;
      const chunk = new THREE.Mesh(
        new THREE.BoxGeometry(sz, sz * 0.7, sz * 0.85),
        this.rubbleMat ?? (this.rubbleMat = new THREE.MeshStandardMaterial({ color: 0x6f6656, roughness: 0.95 })),
      );
      chunk.position.set(
        x + (Math.random() - 0.5) * TILE * 0.85,
        sz * 0.3 + (ri % 2) * 0.18, // a real PILE, not a scatter — some chunks ride others
        z + (Math.random() - 0.5) * TILE * 0.85,
      );
      chunk.rotation.set(Math.random() * 0.6, Math.random() * Math.PI, Math.random() * 0.6);
      chunk.castShadow = true;
      this.scene.add(chunk);
      this.rubble.push(chunk);
    }
    while (this.rubble.length > 240) {
      const old = this.rubble.shift()!;
      this.scene.remove(old);
      old.geometry.dispose();
    }
  }

  collapseTile(tileIdx: number) {
    const zero = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    const wi = this.wallInstanceByTile.get(tileIdx);
    if (wi !== undefined && this.wallInst) {
      this.wallInst.setMatrixAt(wi, zero);
      this.wallInst.instanceMatrix.needsUpdate = true;
    }
    const ci = this.coverInstanceByTile.get(tileIdx);
    if (ci !== undefined && this.coverInst) {
      this.coverInst.setMatrixAt(ci, zero);
      this.coverInst.instanceMatrix.needsUpdate = true;
    }
    // barricades are drill food too (§8.7 + DRILL_EATS): body and lip go together
    const bi = this.climbInstanceByTile.get(tileIdx);
    if (bi !== undefined && this.climbInst) {
      this.climbInst.setMatrixAt(bi, zero);
      this.climbInst.instanceMatrix.needsUpdate = true;
      if (this.climbLipInst) {
        this.climbLipInst.setMatrixAt(bi, zero);
        this.climbLipInst.instanceMatrix.needsUpdate = true;
      }
    }
  }

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
    this.fireballs = new Fireballs(this.scene);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  /** §8.8 WEATHER render pass: cloud deck, atmosphere grading, precipitation
   *  around the camera, storm lightning. Everything lerps back to the theme
   *  baseline when the sky clears — no state leaks between fronts. */
  private updateWeather(world: World, dt: number) {
    if (!this.baseAtmo) return;
    const w = world.weather ?? { kind: 'clear' as WeatherKind, intensity: 0, until: 0 };
    const k = w.kind, hard = w.intensity;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // clouds drift forever; the weather decides how heavy the deck hangs
    const cloudTarget =
      k === 'clear' ? 0.42 : k === 'night' ? 0.26 : k === 'fog' ? 0.22 :
      0.55 + 0.3 * hard;
    if (this.cloudMat) this.cloudMat.opacity += (cloudTarget - this.cloudMat.opacity) * Math.min(1, dt * 1.5);
    const wrap = WORLD / 2 + 80;
    for (const c of this.clouds) {
      c.mesh.position.x += c.drift * dt;
      c.mesh.position.z += c.drift * 0.3 * dt;
      if (c.mesh.position.x > wrap) c.mesh.position.x = -wrap;
      if (c.mesh.position.z > wrap) c.mesh.position.z = -wrap;
    }

    // atmosphere grading toward the front's mood
    const fogK: Record<WeatherKind, [number, number]> = {
      clear: [1, 1], rain: [0.8, 0.72], storm: [0.55, 0.48], fog: [0.3, 0.3],
      snow: [0.55, 0.5], dust: [0.5, 0.48], night: [0.95, 0.82],
    };
    const fog = this.scene.fog as THREE.Fog;
    fog.near += (this.baseAtmo.fogNear * lerp(1, fogK[k][0], hard) - fog.near) * Math.min(1, dt * 1.2);
    fog.far += (this.baseAtmo.fogFar * lerp(1, fogK[k][1], hard) - fog.far) * Math.min(1, dt * 1.2);
    // FOG/STORM are the "see only a radius" skies — pin the visual murk to the
    // live perception radius so the world greys out roughly where enemies
    // vanish from the wire (Robert: sight pulls to a radius, lean on instruments).
    if (k === 'fog' || k === 'storm') {
      const pr = world.perceiveRange();
      fog.far = Math.min(fog.far, pr * 2.2);
      fog.near = Math.min(fog.near, pr * 0.4);
    }

    // rain works the terrain a little (Robert): the ground darkens and gains a
    // wet sheen (lower roughness), eased in with the front. The mud itself is
    // the moveMult drag in weather.ts — this is only its look.
    const wetTarget = (k === 'rain' || k === 'storm') ? hard : 0;
    this.groundWet += (wetTarget - this.groundWet) * Math.min(1, dt * 0.8);
    if (this.groundMat) {
      const wv = this.groundWet;
      this.groundMat.color.setRGB(1 - 0.26 * wv, 1 - 0.24 * wv, 1 - 0.2 * wv);
      this.groundMat.roughness = 0.95 - 0.4 * wv;
    }

    const skyMul =
      k === 'night' ? lerp(1, 0.22, hard) : k === 'storm' ? lerp(1, 0.5, hard) :
      k === 'dust' ? lerp(1, 0.78, hard) : k === 'fog' ? lerp(1, 0.88, hard) :
      (k === 'rain' || k === 'snow') ? lerp(1, 0.72, hard) : 1;
    (this.scene.background as THREE.Color).copy(this.baseAtmo.sky).multiplyScalar(skyMul);
    fog.color.copy(this.baseAtmo.fogColor).multiplyScalar(skyMul);
    if (k === 'dust') {
      (this.scene.background as THREE.Color).lerp(new THREE.Color(0xa9825a), 0.4 * hard);
      fog.color.lerp(new THREE.Color(0xa9825a), 0.4 * hard);
    }

    // light: night drops the war into blue-black; a storm flashes back
    const hemiMul =
      k === 'night' ? lerp(1, 0.4, hard) : k === 'storm' ? lerp(1, 0.65, hard) :
      k === 'clear' ? 1 : lerp(1, 0.8, hard);
    const sunMul = k === 'night' ? lerp(1, 0.22, hard) : k === 'storm' ? lerp(1, 0.55, hard) : hemiMul;
    let flash = 0;
    if (k === 'storm' && hard > 0.35) {
      if (world.time >= this.nextFlashAt) {
        this.flashUntil = world.time + 0.14;
        this.nextFlashAt = world.time + 3.5 + Math.random() * 6;
      }
      if (world.time < this.flashUntil) flash = 2.4;
    }
    if (this.hemiLight) this.hemiLight.intensity = this.baseAtmo.hemi * hemiMul + flash;
    if (this.sunLight) this.sunLight.intensity = this.baseAtmo.sun * sunMul;

    // precipitation rides the camera — the storm is wherever you look
    const wantsPrecip = k === 'rain' || k === 'storm' || k === 'snow' || k === 'dust';
    if (this.precip && (!wantsPrecip || this.precip.kind !== k)) {
      this.scene.remove(this.precip.obj);
      ((this.precip.obj as THREE.Points).geometry as THREE.BufferGeometry).dispose();
      this.precip = undefined;
    }
    if (wantsPrecip && !this.precip) this.precip = this.buildPrecip(k);
    if (this.precip) {
      this.precip.obj.position.set(this.camera.position.x, 0, this.camera.position.z);
      const pos = this.precip.pos, n = this.precip.n;
      if (k === 'rain' || k === 'storm') {
        const fall = (k === 'storm' ? 64 : 46) * dt;
        const drift = (k === 'storm' ? 9 : 3.5) * dt;
        for (let i = 0; i < n; i++) {
          const j = i * 6;
          pos[j + 1] -= fall; pos[j + 4] -= fall;
          pos[j] += drift; pos[j + 3] += drift;
          if (pos[j + 1] < 0) {
            const x = (Math.random() - 0.5) * 84, z = (Math.random() - 0.5) * 84, y = 26 + Math.random() * 10;
            pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
            pos[j + 3] = x - (k === 'storm' ? 0.55 : 0.22); pos[j + 4] = y - 1.7; pos[j + 5] = z;
          }
        }
      } else if (k === 'snow') {
        for (let i = 0; i < n; i++) {
          const j = i * 3;
          pos[j + 1] -= 3.2 * dt;
          pos[j] += Math.sin(world.time * 1.4 + i) * 0.7 * dt;
          if (pos[j + 1] < 0) {
            pos[j] = (Math.random() - 0.5) * 84; pos[j + 1] = 22 + Math.random() * 10; pos[j + 2] = (Math.random() - 0.5) * 84;
          }
        }
      } else { // dust: a horizontal river of grit
        for (let i = 0; i < n; i++) {
          const j = i * 3;
          pos[j] += (14 + (i % 7)) * dt;
          pos[j + 1] += Math.sin(world.time * 2 + i) * 0.4 * dt;
          if (pos[j] > 46) pos[j] = -46;
        }
      }
      const geo = (this.precip.obj as THREE.Points).geometry as THREE.BufferGeometry;
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      const mat = (this.precip.obj as THREE.Points).material as THREE.PointsMaterial;
      mat.opacity = (k === 'storm' ? 0.55 : k === 'rain' ? 0.4 : k === 'snow' ? 0.85 : 0.5) * Math.max(0.4, hard);
    }
  }

  /** Paint hits the ground and STAYS — the yard remembers every ball all
   *  match. Random squash + spin per splat so 200 of them read organic. */
  /**
   * A GOOEY splat (Robert: "I want it to look more gooey if possible").
   * One clean disc reads as a sticker. Real paint lands as a body with
   * satellites — so a paint hit throws a main blob plus a few smaller
   * droplets flung off it, all sharing the pooled geometry and the cached
   * material, so the cost is a handful of extra meshes and nothing else.
   */
  private spawnGoo(pos: { x: number; z: number }, colorHex: number, size: number) {
    this.spawnSplat(pos, colorHex, size);
    const drops = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < drops; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = size * (0.8 + Math.random() * 1.5);
      this.spawnSplat(
        { x: pos.x + Math.cos(a) * r, z: pos.z + Math.sin(a) * r },
        colorHex,
        size * (0.18 + Math.random() * 0.3),
      );
    }
  }

  private spawnSplat(pos: { x: number; z: number }, colorHex: number, size: number) {
    if (!this.splatGeo) this.splatGeo = new THREE.CircleGeometry(1, 10);
    let mat = this.splatMats.get(colorHex);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.82, depthWrite: false });
      this.splatMats.set(colorHex, mat);
    }
    const m = new THREE.Mesh(this.splatGeo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.scale.set(size * (0.7 + Math.random() * 0.6), size * (0.7 + Math.random() * 0.6), 1);
    m.position.set(pos.x + (Math.random() - 0.5) * 0.3, 0.05 + this.splats.length * 0.0004, pos.z + (Math.random() - 0.5) * 0.3);
    this.scene.add(m);
    this.splats.push(m);
    // Headroom: a gooey paint hit lands a blob plus satellites, so the yard
    // fills this pool ~4x faster than it used to — and blood, bullet pocks and
    // dirt all share it. Too small a cap and a firefight erases its own record.
    if (this.splats.length > 900) {
      const old = this.splats.shift()!;
      this.scene.remove(old); // geometry+material are shared/cached — keep them
    }
  }

  /**
   * §16.4 / W7.4 — the world answers a round in its OWN material's voice. One
   * table drives it (`materials.ts` `.impact`), so the debris can never drift
   * from the substance: metal sparks, stone chips, masonry hangs dust, WOOD
   * throws splinters, WATER leaps a crown, ICE shatters bright, GRASS rustles,
   * earth puffs. (Audio maps to the three shipped impact sounds until the
   * announcer kit lands wood/water/ice reports — the debris is the deliverable.)
   */
  private spawnImpactFx(kind: ImpactKind, pos: { x: number; y: number; z: number }) {
    const P = this.particles;
    const rate = 0.85 + Math.random() * 0.3;
    switch (kind) {
      case 'spark': // metal — a white FLASH and gold sparks that BOUNCE off
        P.emit({ pos, count: 3, color: 0xffffff, speed: 1, life: 0.08, spread: 0.1, up: 0.5, size: 0.3 });
        P.emit({ pos, count: 9, color: 0xffd890, speed: 8, life: 0.22, spread: 0.3, up: 2.5, size: 0.16 });
        P.emit({ pos, count: 4, color: 0xffb060, speed: 6, life: 0.6, spread: 0.4, up: 3.5, gravity: 12, size: 0.12 });
        audio.play('impact_metal', { pos, volume: 0.5, rate });
        break;
      case 'chips': // stone — hard grey CHIPS spall off, sharp and fast
        P.emit({ pos, count: 9, color: 0x8f8880, speed: 6.5, life: 0.35, spread: 0.28, up: 2.2, gravity: 9, size: 0.13 });
        P.emit({ pos, count: 3, color: 0xb0a89c, speed: 1.4, life: 0.7, spread: 0.4, up: 0.7, gravity: 0.6, size: 0.22 });
        this.spawnSplat(pos, 0x4f4a44, 0.15 + Math.random() * 0.07);
        audio.play('impact_stone', { pos, volume: 0.5, rate });
        break;
      case 'dust': // masonry/rubble — CHIPS plus a cloud that HANGS in the air
        P.emit({ pos, count: 8, color: 0x9a938a, speed: 5.5, life: 0.3, spread: 0.3, up: 2.5, gravity: 8, size: 0.14 });
        P.emit({ pos, count: 6, color: 0xb8b0a4, speed: 1.2, life: 0.95, spread: 0.55, up: 0.8, gravity: 0.4, size: 0.32 });
        this.spawnSplat(pos, 0x55504a, 0.16 + Math.random() * 0.08);
        audio.play('impact_stone', { pos, volume: 0.5, rate });
        break;
      case 'splinter': // wood — pale SPLINTERS kick out on a woody knock
        P.emit({ pos, count: 8, color: 0xc8a06a, speed: 6, life: 0.4, spread: 0.3, up: 2.6, gravity: 10, size: 0.12 });
        P.emit({ pos, count: 3, color: 0xe0c496, speed: 1.4, life: 0.55, spread: 0.4, up: 1.0, gravity: 1.5, size: 0.16 });
        this.spawnSplat(pos, 0x5a4428, 0.12 + Math.random() * 0.06);
        audio.play('impact_stone', { pos, volume: 0.42, rate });
        break;
      case 'splash': // water/mud — a crown of droplets LEAPS and rains back
        P.emit({ pos, count: 12, color: 0xbfe0ee, speed: 6, life: 0.45, spread: 0.22, up: 5, gravity: 16, size: 0.11 });
        P.emit({ pos, count: 5, color: 0xeaf6fb, speed: 2, life: 0.3, spread: 0.5, up: 1.2, gravity: 6, size: 0.16 });
        this.spawnSplat(pos, 0x33566a, 0.2 + Math.random() * 0.1);
        audio.play('impact_dirt', { pos, volume: 0.45, rate });
        break;
      case 'shatter': // ice — bright shards spray on a hard GLINT
        P.emit({ pos, count: 3, color: 0xffffff, speed: 1, life: 0.09, spread: 0.12, up: 0.5, size: 0.28 });
        P.emit({ pos, count: 10, color: 0xcdeaf5, speed: 7, life: 0.4, spread: 0.35, up: 3, gravity: 13, size: 0.12 });
        this.spawnSplat(pos, 0x8fb8c8, 0.13 + Math.random() * 0.06);
        audio.play('impact_stone', { pos, volume: 0.48, rate });
        break;
      case 'rustle': // grass — a soft scatter of green, low and quick
        P.emit({ pos, count: 6, color: 0x6f8f42, speed: 3.5, life: 0.4, spread: 0.4, up: 1.8, gravity: 7, size: 0.12 });
        audio.play('impact_dirt', { pos, volume: 0.38, rate });
        break;
      case 'puff': default: // dirt/earthwork/grit — a low brown PUFF and a pock
        P.emit({ pos, count: 7, color: 0x6b5636, speed: 4, life: 0.35, spread: 0.35, up: 2.5, gravity: 7 });
        P.emit({ pos, count: 4, color: 0x8a7a5c, speed: 1, life: 0.8, spread: 0.5, up: 1.0, gravity: 0.8, size: 0.28 });
        this.spawnSplat(pos, 0x4a3c28, 0.14 + Math.random() * 0.08);
        audio.play('impact_dirt', { pos, volume: 0.45, rate });
        break;
    }
  }

  /** §19.2: a sound you heard but couldn't see leaves a brief ring — the
   *  ear's version of a muzzle flash. Pooled and capped; never louder than
   *  a hint (the smudge aims your caution, it doesn't paint a target). */
  private spawnSmudge(pos: { x: number; z: number }, size: number, now: number) {
    if (this.smudges.length >= 12) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(size * 0.55, size, 20),
      new THREE.MeshBasicMaterial({ color: 0xcfc6b8, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.15, pos.z);
    this.scene.add(ring);
    this.smudges.push({ mesh: ring, until: now + 0.7 });
  }

  /** Stamp the two blast rings sized to the sim (kill radius + splash reach).
   *  color tints the pair — orange for HE, blue for a concussion pulse. */
  private spawnBlastRings(pos: { x: number; z: number }, killR: number, splashR: number, color: number, now: number) {
    if (this.blastRings.length > 40) {
      const gone = this.blastRings.shift()!;
      this.scene.remove(gone.mesh); gone.mesh.geometry.dispose(); (gone.mesh.material as THREE.Material).dispose();
    }
    // the KILL DISC — a filled heart, brightest, gone in a blink
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.4, killR), 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pos.x, 0.12, pos.z);
    this.scene.add(disc);
    this.blastRings.push({ mesh: disc, born: now, life: 0.42, r0: killR, r1: killR, grow: false, peak: 0.5 });
    // the SPLASH RING — a shockwave that shoots out to the true reach, then fades
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1.0, 44),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.14, pos.z);
    ring.scale.setScalar(splashR * 0.35);
    this.scene.add(ring);
    this.blastRings.push({ mesh: ring, born: now, life: 0.5, r0: splashR * 0.35, r1: splashR, grow: true, peak: 0.7 });
  }

  /** Build one precipitation particle system for the given sky. */
  private buildPrecip(k: WeatherKind): { kind: WeatherKind; obj: THREE.Object3D; pos: Float32Array; n: number } {
    if (k === 'rain' || k === 'storm') {
      const n = k === 'storm' ? 700 : 450;
      const pos = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        const j = i * 6;
        const x = (Math.random() - 0.5) * 84, z = (Math.random() - 0.5) * 84, y = Math.random() * 34;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
        pos[j + 3] = x - 0.25; pos[j + 4] = y - 1.7; pos[j + 5] = z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
        color: 0xbcd0e8, transparent: true, opacity: 0.4, depthWrite: false,
      }));
      obj.frustumCulled = false;
      this.scene.add(obj);
      return { kind: k, obj, pos, n };
    }
    const n = k === 'snow' ? 600 : 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      pos[j] = (Math.random() - 0.5) * 84;
      pos[j + 1] = k === 'dust' ? Math.random() * 7 : Math.random() * 30;
      pos[j + 2] = (Math.random() - 0.5) * 84;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const obj = new THREE.Points(geo, new THREE.PointsMaterial({
      color: k === 'snow' ? 0xffffff : 0xc09a62, size: k === 'snow' ? 0.4 : 0.32,
      transparent: true, opacity: k === 'snow' ? 0.85 : 0.5, depthWrite: false, sizeAttenuation: true,
    }));
    obj.frustumCulled = false;
    this.scene.add(obj);
    return { kind: k, obj, pos, n };
  }

  buildStaticWorld(world: World) {
    const pal = THEME_PALETTES[world.map.theme] ?? THEME_PALETTES.savanna;
    // sky + atmosphere per environment — kept as MUTABLE baselines so the
    // weather pass (§8.8) can tax them and always find its way back to clear
    this.scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);
    this.scene.background = new THREE.Color(pal.sky);
    this.baseAtmo = {
      fogNear: pal.fogNear, fogFar: pal.fogFar, sky: new THREE.Color(pal.sky),
      fogColor: new THREE.Color(pal.fog), hemi: 0.85, sun: pal.sunIntensity,
    };

    // lights
    const hemi = new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, 0.85);
    this.scene.add(hemi);
    this.hemiLight = hemi;
    const sun = new THREE.DirectionalLight(pal.sun, pal.sunIntensity);
    this.sunLight = sun;
    sun.position.set(60, 90, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const S = 130;
    sun.shadow.camera.left = -S; sun.shadow.camera.right = S;
    sun.shadow.camera.top = S; sun.shadow.camera.bottom = -S;
    sun.shadow.camera.far = 300;
    this.scene.add(sun);

    // THE HIGH SKY: a drifting cloud deck at altitude — you only notice it
    // zoomed out, which is exactly the point (the battlefield feels HIGH
    // under it). Density and mood follow the weather pass each frame.
    for (const c of this.clouds) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    this.clouds = [];
    this.cloudMat?.dispose();
    this.cloudMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(pal.hemiSky).lerp(new THREE.Color(0xffffff), 0.5),
      transparent: true, opacity: 0.5, depthWrite: false,
    });
    const cloudRng = (i: number) => { const n = Math.sin(i * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
    for (let i = 0; i < 14; i++) {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const m = new THREE.Mesh(geo, this.cloudMat);
      m.scale.set(9 + cloudRng(i) * 10, 2 + cloudRng(i + 50) * 1.6, 6 + cloudRng(i + 99) * 8);
      m.position.set((cloudRng(i + 7) - 0.5) * (WORLD + 80), 48 + cloudRng(i + 13) * 20, (cloudRng(i + 31) - 0.5) * (WORLD + 80));
      m.rotation.y = cloudRng(i + 43) * Math.PI;
      m.castShadow = false; m.receiveShadow = false;
      this.scene.add(m);
      this.clouds.push({ mesh: m, drift: 1.1 + cloudRng(i + 71) * 1.4 });
    }
    // B2 THE CLOUD SHELF (Robert: "when you get to the highest level you should
    // kind of be IN the clouds"): a thin, wide deck sitting BETWEEN band 2
    // (~8.6u) and band 3 (~14u) — a band-3 flyer skims its top, a band-2 flyer
    // runs just beneath it, so the climb reads as breaking cloud cover. Sparse
    // and low-opacity so it grades the sky without hiding the fight below.
    if (!this.shelfMat) {
      this.shelfMat = new THREE.MeshLambertMaterial({
        color: new THREE.Color(pal.hemiSky).lerp(new THREE.Color(0xffffff), 0.62),
        transparent: true, opacity: 0.28, depthWrite: false,
      });
    } else this.shelfMat.color = new THREE.Color(pal.hemiSky).lerp(new THREE.Color(0xffffff), 0.62);
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const m = new THREE.Mesh(geo, this.shelfMat);
      m.scale.set(11 + cloudRng(i + 200) * 12, 1.1 + cloudRng(i + 250) * 0.8, 9 + cloudRng(i + 299) * 10);
      m.position.set((cloudRng(i + 207) - 0.5) * (WORLD + 60), 11 + cloudRng(i + 213) * 2, (cloudRng(i + 231) - 0.5) * (WORLD + 60));
      m.rotation.y = cloudRng(i + 243) * Math.PI;
      m.castShadow = false; m.receiveShadow = false;
      this.scene.add(m);
      this.clouds.push({ mesh: m, drift: 0.6 + cloudRng(i + 271) * 0.9 });
    }
    // weather particles rebuild lazily against the new sky — and last match's
    // paint comes off the field (a fresh yard deserves fresh canvas)
    if (this.precip) { this.scene.remove(this.precip.obj); this.precip = undefined; }
    for (const sp of this.splats) this.scene.remove(sp);
    this.splats = [];

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
        ctx.fillStyle = t === T_WATER || t === T_DEEP ? pal.water(r) : t === T_GRASS ? '#6b7c40' : pal.open(r);
        if (t === T_DEEP) {
          // deep channel: the same water, drowned darker
          ctx.fillStyle = pal.water(r).replace(/\d+/g, (n) => String(Math.round(Number(n) * 0.55)));
        }
        ctx.fillRect(x * px, z * px, px + 1, px + 1);
        // §8.6 surface tints: the ground SHOWS what it does to your boots
        if (t !== T_WATER && t !== T_DEEP) {
          const sf = world.map.surface[z * GRID + x];
          const tint = sf === S_MUD ? 'rgba(62,44,26,0.55)'
            : sf === S_ICE ? 'rgba(190,220,235,0.28)'
            : sf === S_PLATE ? 'rgba(120,130,145,0.22)'
            : sf === S_GRIT ? 'rgba(150,120,70,0.18)'
            : sf === S_WET ? 'rgba(60,110,120,0.16)'
            : null;
          if (tint) { ctx.fillStyle = tint; ctx.fillRect(x * px, z * px, px + 1, px + 1); }
        }
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
    this.groundMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 });
    this.groundWet = 0;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Walls as instanced boxes. The generator records EXACTLY which tiles a
    // prop's mesh stands in for (map.propCovered) — the renderer skips that
    // set and nothing else. No footprint math here, ever: re-deriving radii
    // is how every invisible-wall bug was born. Any blocking tile the set
    // doesn't claim gets a box — including tile types this code has never
    // heard of (future T_SLIT etc.), which render as walls and warn instead
    // of becoming invisible collision. Guarded by tests/walls.test.ts.
    const covered = new Set(world.map.propCovered);
    const wallTiles: [number, number][] = [];
    const coverTiles: [number, number][] = [];
    const grassTiles: [number, number][] = [];
    const climbTiles: [number, number][] = [];
    const slitTiles: [number, number][] = [];
    const metalTiles: [number, number][] = [];
    const doorTiles: [number, number][] = [];
    const ladderTiles: [number, number][] = [];
    let unknownWarned = false;
    for (let z = 0; z < GRID; z++) {
      for (let x = 0; x < GRID; x++) {
        const idx = z * GRID + x;
        const t = world.map.grid[idx];
        if (t === T_OPEN || t === T_WATER || t === T_DEEP || t === T_LADDER || covered.has(idx)) continue;
        if (t === T_GRASS) {
          grassTiles.push([x, z]);
        } else if (t === T_COVER) {
          coverTiles.push([x, z]);
        } else if (t === T_CLIMB) {
          climbTiles.push([x, z]);
        } else if (t === T_SLIT) {
          slitTiles.push([x, z]);
        } else if (t === T_METAL) {
          metalTiles.push([x, z]);
        } else if (t === T_DOOR || t === T_DOOR_OPEN) {
          doorTiles.push([x, z]);
        } else {
          // T_WALL — and any unknown blocking type, visible by construction
          if (t !== T_WALL && !unknownWarned) {
            unknownWarned = true;
            console.warn(`renderer: unknown blocking tile type ${t} — rendered as wall; teach the renderer about it`);
          }
          wallTiles.push([x, z]);
        }
      }
    }
    // ASSET-LIBRARY wall tint: a house's walls take a warm stucco/plaster
    // shade keyed to the SAME hash as its roof, so walls and roof coordinate
    // and a street reads as a row of DISTINCT homes. Only tiles inside a house
    // footprint are tinted — compound walls, barricades, and tree-trunks (all
    // also T_WALL) keep the theme colour so the base still reads as one place.
    const HOUSE_WALLS = [0xd8c8a8, 0xe1d6c1, 0xcdb992, 0xd2c0a0, 0xc8ad86, 0xc7a074, 0xdacbb0, 0xbfb29a];
    const houseTint = new Map<number, number>();
    for (const h of world.map.houses) {
      const rk = (h.tx * 73856 + h.tz * 19349) >>> 0;
      const wc = HOUSE_WALLS[rk % HOUSE_WALLS.length];
      for (let dz = 0; dz < h.th; dz++) {
        const bit = h.maskRows?.[dz];
        for (let dx = 0; dx < h.tw; dx++) {
          if (bit !== undefined && !(bit & (1 << dx))) continue; // shaped by footprint
          houseTint.set((h.tz + dz) * GRID + (h.tx + dx), wc);
        }
      }
    }
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const wallInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 4, TILE), wallMat, wallTiles.length);
    wallInst.castShadow = true;
    wallInst.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    const wallBase = new THREE.Color(pal.wall);
    const tintCol = new THREE.Color();
    wallTiles.forEach(([x, z], i) => {
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, 2, (z + 0.5) * TILE - WORLD / 2);
      wallInst.setMatrixAt(i, m4);
      const tint = houseTint.get(z * GRID + x);
      // base material is white, so the instance colour is the final albedo:
      // house tile → its stucco shade, everything else → the theme wall colour
      wallInst.setColorAt(i, tint !== undefined ? tintCol.setHex(tint) : wallBase);
      this.wallInstanceByTile.set(z * GRID + x, i); // so the tunneler can grind it away
    });
    if (wallInst.instanceColor) wallInst.instanceColor.needsUpdate = true;
    this.scene.add(wallInst);
    this.wallInst = wallInst;

    // TALL GRASS (finish-list 18): crossed blades per tile, wind-still and
    // cheap -- the meadow reads at command zoom without hiding the fight.
    if (grassTiles.length) {
      const bladeGeo = new THREE.PlaneGeometry(TILE * 0.9, 1.25);
      bladeGeo.translate(0, 0.62, 0);
      const grassMat = new THREE.MeshStandardMaterial({
        color: 0x7c8a48, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      });
      const grassInst = new THREE.InstancedMesh(bladeGeo, grassMat, grassTiles.length * 2);
      const gm = new THREE.Matrix4();
      const gq = new THREE.Quaternion();
      const gs = new THREE.Vector3(1, 1, 1);
      grassTiles.forEach(([x, z], i) => {
        const wx = (x + 0.5) * TILE - WORLD / 2, wz = (z + 0.5) * TILE - WORLD / 2;
        const a = ((x * 31 + z * 17) % 7) / 7 * Math.PI; // deterministic lean
        for (let b = 0; b < 2; b++) {
          gq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + b * Math.PI / 2);
          gm.compose(new THREE.Vector3(wx, 0, wz), gq, gs);
          grassInst.setMatrixAt(i * 2 + b, gm);
        }
      });
      grassInst.receiveShadow = true;
      this.scene.add(grassInst);
    }

    const coverMat = new THREE.MeshStandardMaterial({ color: pal.cover, roughness: 0.9 });
    const coverInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 0.95, 1.2, TILE * 0.95), coverMat, Math.max(coverTiles.length, 1));
    coverInst.castShadow = true;
    coverTiles.forEach(([x, z], i) => {
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, 0.6, (z + 0.5) * TILE - WORLD / 2);
      coverInst.setMatrixAt(i, m4);
      this.coverInstanceByTile.set(z * GRID + x, i);
    });
    this.scene.add(coverInst);
    this.coverInst = coverInst;

    // §8.7 CLIMB barricades: 2.5u container walls a shade lighter than the
    // theme's masonry, wearing a wider grab-lip at the top — the lip IS the
    // word "climbable" written in geometry. Jump troopers jet over; everyone
    // else reads the ledge and walks around (or brings the breacher).
    const climbColor = new THREE.Color(pal.wall).lerp(new THREE.Color(0xd8cfba), 0.28);
    const climbMat = new THREE.MeshStandardMaterial({ color: climbColor, roughness: 0.85 });
    const climbInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, CLIMB_H, TILE), climbMat, Math.max(climbTiles.length, 1));
    climbInst.castShadow = climbInst.receiveShadow = true;
    const lipColor = new THREE.Color(pal.wall).lerp(new THREE.Color(0xe8e0cc), 0.45);
    const lipMat = new THREE.MeshStandardMaterial({ color: lipColor, roughness: 0.7 });
    const climbLipInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE * 1.16, 0.18, TILE * 1.16), lipMat, Math.max(climbTiles.length, 1));
    climbLipInst.castShadow = true;
    climbTiles.forEach(([x, z], i) => {
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, CLIMB_H / 2, (z + 0.5) * TILE - WORLD / 2);
      climbInst.setMatrixAt(i, m4);
      m4.setPosition((x + 0.5) * TILE - WORLD / 2, CLIMB_H - 0.09, (z + 0.5) * TILE - WORLD / 2);
      climbLipInst.setMatrixAt(i, m4);
      this.climbInstanceByTile.set(z * GRID + x, i); // drill food — collapses like walls
    });
    this.scene.add(climbInst, climbLipInst);
    this.climbInst = climbInst;
    this.climbLipInst = climbLipInst;

    // §8.4 firing slits: two stacked boxes with a gap at 1.2–1.8 — the
    // geometry tells the truth, no textures needed. Defenders shoot out.
    if (slitTiles.length) {
      const lowInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 1.2, TILE), wallMat, slitTiles.length);
      const highInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 2.2, TILE), wallMat, slitTiles.length);
      lowInst.castShadow = highInst.castShadow = true;
      slitTiles.forEach(([x, z], i) => {
        m4.setPosition((x + 0.5) * TILE - WORLD / 2, 0.6, (z + 0.5) * TILE - WORLD / 2);
        lowInst.setMatrixAt(i, m4);
        m4.setPosition((x + 0.5) * TILE - WORLD / 2, 2.9, (z + 0.5) * TILE - WORLD / 2);
        highInst.setMatrixAt(i, m4);
      });
      this.scene.add(lowInst, highInst);
    }

    // METAL walls: the breacher's nemesis — steel sheen, same silhouette
    if (metalTiles.length) {
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.75, roughness: 0.35 });
      const metalInst = new THREE.InstancedMesh(new THREE.BoxGeometry(TILE, 4, TILE), metalMat, metalTiles.length);
      metalInst.castShadow = metalInst.receiveShadow = true;
      metalTiles.forEach(([x, z], i) => {
        m4.setPosition((x + 0.5) * TILE - WORLD / 2, 2, (z + 0.5) * TILE - WORLD / 2);
        metalInst.setMatrixAt(i, m4);
      });
      this.scene.add(metalInst);
    }

    // LADDERS: rails + rungs at every ladder foot — the climb to the storey above
    for (let z = 0; z < GRID; z++)
      for (let x = 0; x < GRID; x++)
        if (world.map.grid[z * GRID + x] === T_LADDER) ladderTiles.push([x, z]);
    for (const g of this.ladderMeshes) { this.scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
    this.ladderMeshes = [];
    for (const c of this.rubble) { this.scene.remove(c); c.geometry.dispose(); }
    this.rubble = [];
    if (ladderTiles.length) {
      // STAIRS, not rails (Robert: "inside we should have stairs and such") —
      // a steep ship-style staircase per L tile: treads climbing to the
      // storey, slope stringers under the edges. Same tile, same E to climb;
      // the mechanics never changed, the metaphor finally reads.
      const railMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.7 });
      const STEPS = 7;
      const runSpan = TILE * 0.8;
      for (const [x, z] of ladderTiles) {
        const g = new THREE.Group();
        const wx = (x + 0.5) * TILE - WORLD / 2, wz = (z + 0.5) * TILE - WORLD / 2;
        for (let i = 0; i < STEPS; i++) {
          const tread = new THREE.Mesh(new THREE.BoxGeometry(TILE * 0.62, 0.14, 0.5), railMat);
          tread.position.set(0, ((i + 1) / STEPS) * 4 - 0.07, TILE * 0.36 - (i + 0.5) * (runSpan / STEPS));
          g.add(tread);
        }
        // stringers follow the slope under the tread edges
        const rise = 4 * ((STEPS - 1) / STEPS);
        const run = runSpan * ((STEPS - 1) / STEPS);
        const tilt = Math.atan2(run, rise);
        for (const side of [-TILE * 0.28, TILE * 0.28]) {
          const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.1, Math.hypot(rise, run) + 0.6, 0.14), railMat);
          stringer.position.set(side, (4 + 0.57) / 2 - 0.07, TILE * 0.36 - runSpan / 2);
          stringer.rotation.x = tilt;
          g.add(stringer);
        }
        g.position.set(wx, 0, wz);
        // the climb tops out against the nearest solid neighbor, like the
        // old leaned ladder did — the top step lands at the wall side
        const idx = z * GRID + x;
        const solid = (t: number) => t === T_WALL || t === T_METAL || t === T_SLIT;
        if (solid(world.map.grid[idx - 1])) g.rotation.y = Math.PI / 2;
        else if (solid(world.map.grid[idx + 1])) g.rotation.y = -Math.PI / 2;
        else if (solid(world.map.grid[idx - GRID])) g.rotation.y = 0;
        else g.rotation.y = Math.PI;
        g.traverse((o) => { (o as THREE.Mesh).castShadow = true; });
        this.scene.add(g);
        this.ladderMeshes.push(g);
      }
    }

    // THE SECOND STOREY (§8.4 Phase-2): per-house shells built from grid2 —
    // upper walls at 4..8, window slits with the 5.2–5.8 fire band, and a
    // floor slab with a hole over the ladder well. Per-house materials so
    // the cutaway can fade a single building's upstairs.
    for (const u of this.uppers) { this.scene.remove(u.group); u.group.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); u.mats.forEach((m) => m.dispose()); }
    this.uppers = [];
    for (const h of world.map.houses) {
      if ((h as { floors?: number }).floors !== 2) continue;
      const group = new THREE.Group();
      const matU = new THREE.MeshStandardMaterial({ color: pal.wall, roughness: 0.9, transparent: true, opacity: 0.97 });
      const matF = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.95, transparent: true, opacity: 0.97 });
      for (let z = h.tz; z < h.tz + h.th; z++) {
        for (let x = h.tx; x < h.tx + h.tw; x++) {
          const t2 = world.map.grid2[z * GRID + x];
          if (t2 === 0 /* F2_VOID */) continue;
          const wx = (x + 0.5) * TILE - WORLD / 2, wz = (z + 0.5) * TILE - WORLD / 2;
          if (t2 !== F2_WELL) {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.25, TILE), matF);
            slab.position.set(wx, 4.1, wz);
            group.add(slab);
          }
          if (t2 === F2_WALL) {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(TILE, 3.75, TILE), matU);
            wall.position.set(wx, 6.1, wz);
            wall.castShadow = true;
            group.add(wall);
          } else if (t2 === F2_SLIT) {
            const low = new THREE.Mesh(new THREE.BoxGeometry(TILE, 1.0, TILE), matU);
            low.position.set(wx, 4.72, wz);
            const high = new THREE.Mesh(new THREE.BoxGeometry(TILE, 2.2, TILE), matU);
            high.position.set(wx, 6.9, wz);
            low.castShadow = high.castShadow = true;
            group.add(low, high);
          }
        }
      }
      group.renderOrder = 2;
      this.scene.add(group);
      this.uppers.push({ group, house: h, mats: [matU, matF] });
    }

    // DOORS: a slab per doorway that tracks grid state live — closed fills
    // the frame, open swings the slab to the jamb. E is the key.
    for (const d of this.doors) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); (d.mesh.material as THREE.Material).dispose(); }
    this.doors = [];
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.8 });
    for (const [x, z] of doorTiles) {
      const idx = z * GRID + x;
      // orientation: neighbors solid left/right => the door spans X
      const solid = (t: number) => t === T_WALL || t === T_METAL || t === T_SLIT || t === T_DOOR || t === T_DOOR_OPEN;
      const spansX = solid(world.map.grid[idx - 1]) || solid(world.map.grid[idx + 1]);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(spansX ? TILE : 0.35, 2.2, spansX ? 0.35 : TILE),
        doorMat.clone(),
      );
      mesh.position.set((x + 0.5) * TILE - WORLD / 2, 1.1, (z + 0.5) * TILE - WORLD / 2);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.doors.push({ mesh, idx, spansX, base: mesh.position.clone() });
    }

    // §8.4 cutaway roofs, phase 1: every house gets a lid. Opaque from
    // outside — the enemy inside is CONCEALED until you breach; fades to
    // cutaway when you (or the killcam's subject) are under it. Fading
    // transparents need depthWrite OFF and a late renderOrder or the walls
    // beneath sort wrong (the classic three.js trap).
    for (const r of this.roofs) { this.scene.remove(r.group); r.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); r.mats.forEach((m) => m.dispose()); }
    this.roofs = [];
    for (const h of world.map.houses) {
      const style = h.roof ?? 'flat';
      if (style === 'none') continue; // a shelled ruin is open to the sky
      const roofY = h.floors === 2 ? 8.15 : 4.15;
      const group = new THREE.Group();
      // ASSET-LIBRARY VARIETY (Robert: "feel like they came from an asset
      // library"): every house draws a roof colour from a curated pack —
      // terracotta, slate, weathered green, clay, tin — keyed deterministically
      // to its footprint, so a street reads as a row of DISTINCT houses, not
      // one tan box stamped N times. Commercial/industrial keep the cooler
      // metal roofs; homes wear the warm tiles.
      const HOME_ROOFS = [0xa8583a, 0x8f4034, 0xb0724a, 0x6b7a4a, 0x8a6a44, 0x9c5a3c];
      const CIVIC_ROOFS = [0x556069, 0x5e6a72, 0x6b7480, 0x4a545c];
      const rk = (h.tx * 73856 + h.tz * 19349) >>> 0;
      const warm = style === 'gable' || style === 'flat';
      const roofHex = (warm ? HOME_ROOFS : CIVIC_ROOFS)[rk % (warm ? HOME_ROOFS.length : CIVIC_ROOFS.length)];
      const rmat = new THREE.MeshStandardMaterial({
        color: roofHex, roughness: 0.82, transparent: true, opacity: 0.97,
      });
      const mats = [rmat];
      const cx = (h.tx + h.tw / 2) * TILE - WORLD / 2;
      const cz = (h.tz + h.th / 2) * TILE - WORLD / 2;
      const covered = (rx: number, rz: number) =>
        !h.maskRows || ((h.maskRows[rz] ?? 0) & (1 << rx)) !== 0;
      if (style === 'gable') {
        // a REAL pitched roof: two sloped planes to a ridge + gable end caps.
        // Ridge runs along the longer axis; rise scales with the short span.
        const alongX = h.tw >= h.th;
        const spanW = (alongX ? h.th : h.tw) * TILE;   // slope direction
        const spanL = (alongX ? h.tw : h.th) * TILE;   // ridge direction
        // a real ~20-32° pitch — the OLD 2.2 cap made a 64u manor a 7° slope
        // that read as "flat with a crease", the #1 procedural tell. Rise ~30%
        // of the short span, capped so a huge footprint doesn't spike.
        const rise = Math.min(6.5, spanW * 0.3);
        const slopeLen = Math.hypot(spanW / 2, rise) + 0.15;
        for (const side of [1, -1]) {
          const slope = new THREE.Mesh(new THREE.BoxGeometry(spanL + 0.2, 0.22, slopeLen), rmat);
          slope.position.set(0, rise / 2, side * spanW / 4);
          slope.rotation.x = side * Math.atan2(rise, spanW / 2);
          if (!alongX) { slope.rotation.y = Math.PI / 2; slope.position.set(side * spanW / 4, rise / 2, 0); slope.rotation.x = 0; slope.rotation.z = -side * Math.atan2(rise, spanW / 2); }
          slope.castShadow = true;
          group.add(slope);
        }
        // gable end caps: triangular prisms via cylinder(3) is ugly — two
        // thin boxes stacked in a wedge read cleanly at our tile scale
        for (const end of [1, -1]) {
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, rise * 0.85, spanW * 0.55), rmat);
          if (alongX) cap.position.set(end * (spanL / 2 - 0.12), rise * 0.4, 0);
          else { cap.rotation.y = Math.PI / 2; cap.position.set(0, rise * 0.4, end * (spanL / 2 - 0.12)); }
          group.add(cap);
        }
        // a brick CHIMNEY off the ridge — the small authored detail that turns
        // a roof into a house (its own dark material, not the roof tile)
        const chimMat = new THREE.MeshStandardMaterial({ color: 0x4a3b34, roughness: 0.9, transparent: true, opacity: 0.97 });
        mats.push(chimMat);
        const chim = new THREE.Mesh(new THREE.BoxGeometry(0.9, rise + 1.4, 0.9), chimMat);
        const off = (spanL / 2) * 0.45;
        if (alongX) chim.position.set(off, rise / 2 + 0.5, 0); else chim.position.set(0, rise / 2 + 0.5, off);
        group.add(chim);
        group.position.set(cx, roofY, cz);
      } else {
        // footprint-true flat lid: one slab PER COVERED TILE — an L-shaped
        // house gets an L-shaped roof, full stop
        for (let rz = 0; rz < h.th; rz++) {
          for (let rx = 0; rx < h.tw; rx++) {
            if (!covered(rx, rz)) continue;
            const slab = new THREE.Mesh(new THREE.BoxGeometry(TILE, 0.3, TILE), rmat);
            slab.position.set((h.tx + rx + 0.5) * TILE - WORLD / 2 - cx, 0, (h.tz + rz + 0.5) * TILE - WORLD / 2 - cz);
            slab.castShadow = true;
            group.add(slab);
          }
        }
        if (style === 'parapet') {
          // commercial: a raised lip around the rect edge
          for (const [px, pz, pw, pd] of [
            [0, -h.th * TILE / 2 + TILE * 0.15, h.tw * TILE, 0.3],
            [0, h.th * TILE / 2 - TILE * 0.15, h.tw * TILE, 0.3],
            [-h.tw * TILE / 2 + TILE * 0.15, 0, 0.3, h.th * TILE],
            [h.tw * TILE / 2 - TILE * 0.15, 0, 0.3, h.th * TILE],
          ] as const) {
            const lip = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.55, pd), rmat);
            lip.position.set(px, 0.35, pz);
            group.add(lip);
          }
        } else if (style === 'vents') {
          // industry: rooftop vents + a skylight strip
          const vmat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.97 });
          mats.push(vmat);
          for (let i = 0; i < Math.max(2, Math.floor(h.tw / 5)); i++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 1.1), vmat);
            vent.position.set((i - Math.floor(h.tw / 10)) * 4.5, 0.55, (i % 2 ? 1 : -1) * h.th * TILE * 0.18);
            group.add(vent);
          }
          const sky = new THREE.Mesh(new THREE.BoxGeometry(h.tw * TILE * 0.5, 0.18, 1.2), vmat);
          sky.position.set(0, 0.32, 0);
          group.add(sky);
        }
        group.position.set(cx, roofY, cz);
      }
      group.renderOrder = 3;
      group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
      this.scene.add(group);
      this.roofs.push({ group, mats, house: h });
    }

    // walls the sim already dug (mid-match join) come down immediately
    for (const idx of world.dug) this.collapseTile(idx);
    // DESTRUCTION: breached tiles arrive as knee-high piles (late joins too)
    for (const idx of world.breached) {
      this.collapseTile(idx);
      if (world.map.grid[idx] !== T_OPEN) {
        this.breachPile((idx % GRID + 0.5) * TILE - WORLD / 2, (Math.floor(idx / GRID) + 0.5) * TILE - WORLD / 2);
      }
    }

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
    if (m.points) {
      // any mode with points gets world-space rings — conquest capture zones
      // AND paintball tag pads. An objective you can't SEE isn't an objective.
      for (const cp of m.points) this.cpRings.push(this.makeRing(cp.pos, cp.radius, 0xffffff, 0.35));
    }
    if (m.id === 'ctf') {
      for (const f of m.flags!) {
        const flag = buildFlag(f.team);
        this.scene.add(flag);
        this.flagMeshes.push(flag);
      }
    }
  }

  /** Robert's MELEE PULSE-RING UI: the grab-reach pulses expand to the grab
   *  radius and fade; the guard arc lights a blue frontal wedge under you
   *  while you brace. Both are local-player tells, world-space under the feet. */
  private updateMeleeRings(world: World, local: Soldier | undefined) {
    const t = world.time;
    // grab pulses — expand 0.2 → ~2.3u over 0.35s, fading out
    for (let i = this.grabPulses.length - 1; i >= 0; i--) {
      const p = this.grabPulses[i];
      const k = (t - p.born) / 0.35;
      if (k >= 1) {
        this.scene.remove(p.mesh); (p.mesh.material as THREE.Material).dispose(); p.mesh.geometry.dispose();
        this.grabPulses.splice(i, 1);
        continue;
      }
      const r = 0.3 + k * 2.0;
      p.mesh.scale.setScalar(r / 0.34); // geometry outer radius is 0.34
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
    // guard arc — a blue 150° frontal wedge, on while you brace, off otherwise
    const guarding = !!local && local.alive && local.guarding && local.vehicleId < 0;
    if (guarding) {
      if (!this.guardArc) {
        // RingGeometry lives in XY; after the -90° X-flip a geometry angle θ
        // lands at ground bearing -θ, so bake -yaw into thetaStart at draw.
        // UI-BIBLE ruling (delegated by Robert): guard is a YOURS/committed
        // state → house amber, not blue (cyan is team-identity only, and blue
        // isn't in the semantic system). The bible outranks the earlier aside.
        this.guardArc = new THREE.Mesh(
          new THREE.RingGeometry(1.0, 1.35, 28, 1, 0, (150 * Math.PI) / 180),
          new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
        );
        this.guardArc.rotation.order = 'YXZ';
        this.scene.add(this.guardArc);
      }
      const arc = this.guardArc;
      arc.visible = true;
      arc.position.set(local!.pos.x, 0.06, local!.pos.z);
      // face the wedge along the player's yaw: flat on the ground (-90° X),
      // then spin so the 150° opening is centred on the facing.
      arc.rotation.set(-Math.PI / 2, 0, -local!.yaw - (75 * Math.PI) / 180);
      (arc.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 8) * 0.12; // a soft brace pulse
    } else if (this.guardArc) {
      this.guardArc.visible = false;
    }
    // THE GROUND SPREAD CIRCLE (Robert: "a circle on the ground… it auto-sizes
    // to the spread radius, rotates around you — where your bullets land, keeps
    // the system honest"). A thin ring at the aim point ahead of the player,
    // its RADIUS read straight off the weapon's own `spread` at that distance —
    // shotgun blooms wide, pistol stays a dot. Hidden aboard vehicles, for
    // spreadless/beam arms, and for gods (their aim isn't a cone).
    const wid = local?.weapons[local.weaponIdx];
    const wdef = wid ? WEAPONS[wid] : undefined;
    const showSpread = !!local && local.alive && local.vehicleId < 0 && !local.ascendant
      && !!wdef && wdef.spread > 0.001 && wdef.range > 3 && wdef.tracer !== 'beam';
    if (showSpread) {
      if (!this.spreadRing) {
        this.spreadRing = new THREE.Mesh(
          new THREE.RingGeometry(0.9, 1.0, 40),
          new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
        );
        this.spreadRing.rotation.x = -Math.PI / 2;
        this.scene.add(this.spreadRing);
      }
      const ring = this.spreadRing;
      ring.visible = true;
      // aim distance: a representative reach (60% of range, capped) — v1 fixed;
      // the "choose how far" knob lands with the reticle-picker slice.
      const dist = Math.min(wdef!.range * 0.6, 22);
      const radius = Math.max(0.18, Math.tan(wdef!.spread) * dist); // spread cone → ground radius
      const ax = local!.pos.x + Math.cos(local!.yaw) * dist;
      const az = local!.pos.z + Math.sin(local!.yaw) * dist;
      ring.position.set(ax, 0.05, az);
      ring.scale.set(radius, radius, 1); // ring is in XY (pre X-flip) so x,y scale the disc
    } else if (this.spreadRing) {
      this.spreadRing.visible = false;
    }
    // THE IMPACT CHARGE RING (UI-MASTER §4): the wind-up made legible ON the
    // body, not just the corner meter. It ORBITS you and tightens as the charge
    // builds, snaps to a bright amber MAXIMUM band (≥0.71), then a red
    // OVERCHARGE pulse (≥1.3 = the fumble zone) — the same bands the HUD meter
    // reads (`meleeCharge`). Hidden aboard vehicles.
    const charge = (!!local && local.alive && local.vehicleId < 0) ? (local.meleeCharge ?? 0) : 0;
    if (charge > 0.02) {
      if (!this.chargeRing) {
        this.chargeRing = new THREE.Mesh(
          new THREE.RingGeometry(0.86, 1.0, 44),
          new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }),
        );
        this.chargeRing.rotation.x = -Math.PI / 2;
        this.scene.add(this.chargeRing);
      }
      const ring = this.chargeRing;
      ring.visible = true;
      const over = charge >= 1.3, max = charge >= 0.71;
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.color.setHex(over ? 0xff3b30 : 0xe8a33d);
      // it TIGHTENS as it winds up (1.5u → 1.0u), then holds; overcharge pulses
      const wind = Math.min(1, charge / 1.3);
      const radius = 1.5 - wind * 0.5;
      mat.opacity = over ? 0.55 + Math.sin(t * 22) * 0.22 : max ? 0.6 : 0.28 + wind * 0.3;
      ring.position.set(local!.pos.x, 0.07, local!.pos.z);
      ring.scale.set(radius, radius, 1);
    } else if (this.chargeRing) {
      this.chargeRing.visible = false;
    }
    this.updateStruggleBars(world);
  }

  /** UI-BIBLE §09 — the struggle bar OVER THE BODIES (not a corner label). One
   *  world-space billboard per grabbed soldier: it fills as they fight free
   *  (amber → green near escape) and flips RED as a choke controls them — so
   *  progress AND reversal read from across the field. Derived live. */
  private updateStruggleBars(world: World) {
    const live = new Set<number>();
    for (const s of world.soldiers.values()) {
      if (s.grabbedUntil === undefined || !s.alive) continue;
      live.add(s.id);
      let bar = this.struggleBars.get(s.id);
      if (!bar) {
        const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 64;
        const ctx = cvs.getContext('2d')!;
        const tex = new THREE.CanvasTexture(cvs);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
        sprite.userData.uiOverlay = true;
        this.scene.add(sprite);
        bar = { sprite, ctx, tex, key: '' };
        this.struggleBars.set(s.id, bar);
      }
      const choke = s.chokeProgress ?? 0;
      const mode = choke > 0 ? 'choke' : 'break';
      const frac = choke > 0 ? Math.min(1, choke) : Math.min(1, s.struggle ?? 0);
      const key = `${mode}${Math.round(frac * 24)}`;
      if (key !== bar.key) { this.drawStruggleBar(bar.ctx, frac, mode); bar.tex.needsUpdate = true; bar.key = key; }
      bar.sprite.position.set(s.pos.x, s.pos.y + 2.05, s.pos.z);
      bar.sprite.scale.set(1.5, 0.38, 1);
    }
    for (const [id, bar] of this.struggleBars) {
      if (!live.has(id)) {
        this.scene.remove(bar.sprite); bar.tex.dispose(); (bar.sprite.material as THREE.Material).dispose();
        this.struggleBars.delete(id);
      }
    }
  }

  private drawStruggleBar(ctx: CanvasRenderingContext2D, frac: number, mode: 'break' | 'choke') {
    ctx.clearRect(0, 0, 256, 64);
    const bw = 188, bh = 16, bx = (256 - bw) / 2, by = 30;
    // dark backing (this ONE meter earns a plate — it's the read that decides a life)
    ctx.fillStyle = 'rgba(10,12,11,0.6)'; ctx.fillRect(bx - 4, by - 4, bw + 8, bh + 8);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(bx, by, bw, bh);           // empty track
    // fill: break = house amber, warming to recovery green near escape; choke = signal red
    ctx.fillStyle = mode === 'choke' ? '#ff3b30' : frac > 0.66 ? '#4cd964' : '#e8a33d';
    ctx.fillRect(bx, by, Math.max(0, bw * frac), bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.5; ctx.strokeRect(bx - 0.75, by - 0.75, bw + 1.5, bh + 1.5);
    // label above the bar
    ctx.font = '700 20px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const label = mode === 'choke' ? 'CHOKING' : 'BREAK FREE';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3.5; ctx.strokeText(label, 128, 18);
    ctx.fillStyle = mode === 'choke' ? '#ff6b62' : '#f6f5f0'; ctx.fillText(label, 128, 18);
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

  /** The overhead unit tag (friendlies only): a slim health meter with the name
   *  under it — team-colored text, a LIGHT (white) outline, and NO black plate,
   *  box, or dark stroke anywhere. Redrawn only when hp/armor/name change
   *  (keyed by the caller). Replaces the old name sprite AND the friendly ground
   *  ring, so a squad reads as clean tags instead of a black mess. */
  private makeUnitTag(): { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 64;
    const ctx = cvs.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cvs);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.userData.uiOverlay = true; // setAlpha must NOT clobber this — see below
    return { sprite, ctx, tex };
  }

  private drawUnitTag(ctx: CanvasRenderingContext2D, name: string, team: Team, hpFrac: number, arFrac: number) {
    ctx.clearRect(0, 0, 256, 64);
    // slim health meter — a LIGHT-framed bar, never a black plate
    const bw = 148, bh = 10, bx = (256 - bw) / 2, by = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';             // empty track (light, not black)
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = hpFrac > 0.5 ? '#46d17a' : hpFrac > 0.25 ? '#f5b21a' : '#ff4736';
    ctx.fillRect(bx, by, Math.max(0, bw * hpFrac), bh);   // health fill
    if (arFrac > 0) { ctx.fillStyle = '#4cc2ff'; ctx.fillRect(bx, by - 4, Math.max(0, bw * arFrac), 3); } // armor over health
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; // light frame
    ctx.strokeRect(bx - 0.75, by - 0.75, bw + 1.5, bh + 1.5);
    // name under the meter — team color with a LIGHT (white) outline, no black
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3.5;
    ctx.strokeText(name, 128, 52);
    ctx.fillStyle = team === 0 ? '#e8a33d' : '#3dbde8';
    ctx.fillText(name, 128, 52);
  }

  /** Light-touch label: team-colored text with a THIN low-alpha rim for
   *  legibility — readable without shouting over the head. */
  private makeNameSprite(name: string, team: Team): THREE.Sprite {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 48;
    const ctx = cvs.getContext('2d')!;
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeText(name, 128, 32);
    ctx.fillStyle = team === 0 ? '#e8a33d' : '#3dbde8';
    ctx.fillText(name, 128, 32);
    const tex = new THREE.CanvasTexture(cvs);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.82, depthWrite: false }));
    sprite.scale.set(3.0, 0.56, 1);
    return sprite;
  }

  /** THE RING (§UI: one health language, three resolutions) — a ground ring
   *  at each soldier's feet: 3 chunks for grunts, a continuous grade +
   *  plate arc for recon/squad, the exact number for medics/optics. The
   *  tier gate's data path is unchanged; the glyph is the language now. */
  private ringMaps = new Map<number, {
    mesh: THREE.Mesh; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string;
  }>();

  private makeRingMap(): { mesh: THREE.Mesh; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 128;
    const ctx = cvs.getContext('2d')!;
    const tex = new THREE.CanvasTexture(cvs);
    return { mesh: makeRingMesh(tex), ctx, tex };
  }

  /** Sync all dynamic entities to the sim state, advance FX. */
  update(world: World, localId: number, dt: number, waypoints?: { x: number; z: number; until: number }[]) {
    this.localId = localId;
    const local = world.soldiers.get(localId);
    const localTeam = local?.team ?? 0;
    this.frameDt = dt;
    this.updateMeleeRings(world, local);

    // READING THE DARK (plan A2): patch new lit materials on a slow cadence
    // (GLBs, drops, corpses arrive between sweeps), then feed the eye — the
    // same yaw the sim's cone uses, the same perceiveRange the fog pins to.
    if ((this.darkSweepN++ % 90) === 0) sweepDarkness(this.scene);
    const dl = settings.darkness ?? 'subtle';
    const floor = local && local.alive && dl !== 'off' ? darknessFloor(dl) : 1;
    // §10: a lit torch stretches the visible beam exactly as far as it
    // stretches the sim's eye (TORCH_MULT — one law, two surfaces)
    const eyeRange = world.perceiveRange() * (local?.torchOn ? TORCH_MULT : 1);
    setDarknessFrame(local?.pos.x ?? 0, 0, local?.pos.z ?? 0, local?.yaw ?? 0, eyeRange, floor);

    // LOCAL FOG for the trail-less (§19.1). Living enemies ride the sim's
    // per-tick lastSeen trail, but the two things that carry NO trail — enemy
    // CORPSES (#44) and enemy VEHICLES (#45) — were drawn unconditionally, so a
    // dead man and a parked tank read through every wall across the whole map.
    // The multiplayer culler already tests them live against friendly eyes
    // (snapshot.ts cullSnapshotFor); local play now shares that exact rule via
    // eyesSeePoint. Puppets arrive pre-culled by the server → skip (null eyes).
    const fogEyes = (!world.puppet && local)
      ? [...world.soldiers.values()].filter((e) => e.alive && e.team === localTeam)
      : null;
    const fogRange = world.perceiveRange();
    /** Should an ENEMY thing at this spot be drawn? True (no local cull) for
     *  puppets/spectators; otherwise only where a friendly eye has LOS to it. */
    const enemyVisibleAt = (x: number, z: number, y = 1.4): boolean =>
      fogEyes === null || eyesSeePoint(world.map.grid, fogEyes, x, z, fogRange, y);

    // C1 ROW 81 — THE SPLIT (Robert: "3D shows what YOU see; the minimap
    // shows what your TEAM sees"). The sim's lastSeen trail is the TEAM's
    // shared memory — the minimap instrument keeps reading it (hud.ts,
    // unchanged). The 3D world instead rides THIS per-viewer trail, stamped
    // by the LOCAL eye alone under the same laws (cone+ring, skyline, smoke,
    // grass, pings, muzzle reveal — perceivesNow, one pair of eyes; the
    // torch rides free). Stamped BEFORE the soldier loop so a perceived
    // enemy is fresh at any sim speed. While you're DEAD the squad's radio
    // keeps painting (the loop falls back to the team trail) so the death
    // cam still frames your killer.
    if (this.localSeenWorld !== world) { this.localSeenWorld = world; this.localSeen.clear(); }
    if (!world.puppet && local?.alive) {
      // muzzle flash reveals — the same one-line law updateLastSeen computes
      const revealed = new Set<number>();
      for (const e of world.soldiers.values()) {
        if (e.alive && e.nextFireAt > 0 && e.nextFireAt > world.time - 0.9 && e.nextFireAt <= world.time + 2) revealed.add(e.id);
      }
      for (const s of world.soldiers.values()) {
        if (!s.alive || s.team === localTeam) continue;
        if (perceivesNow(world.map.grid, [local], world.pinged, s, fogRange, world.smokeBlobs, revealed, world.map.grid2)) {
          this.localSeen.set(s.id, { t: world.time, x: s.pos.x, z: s.pos.z });
        }
      }
    }

    // ambience: the theme's bed hums low under the match. Self-managing —
    // retries until the audio context + buffer exist, swaps beds if the
    // rendered theme changes, and stays silent for unfilled slots.
    const amb = BIOME_AUDIO[world.map.theme];
    if (amb && !audio.looping(amb.ambience)) {
      for (const other of Object.values(BIOME_AUDIO)) {
        if (other.ambience !== amb.ambience && audio.looping(other.ambience)) audio.stopLoop(other.ambience);
      }
      audio.loop(amb.ambience, amb.ambVol);
    }

    // doors track the sim: open slides the slab to the jamb, closed refills.
    // A tile that stopped being a door got broken down — the slab is gone.
    for (const d of this.doors) {
      const t = world.map.grid[d.idx];
      if (t !== T_DOOR && t !== T_DOOR_OPEN) {
        d.mesh.visible = false;
        continue;
      }
      const open = t === T_DOOR_OPEN;
      const off = open ? TILE * 0.82 : 0;
      const tx = d.base.x + (d.spansX ? off : 0);
      const tz = d.base.z + (d.spansX ? 0 : off);
      d.mesh.position.x += (tx - d.mesh.position.x) * Math.min(1, dt * 10);
      d.mesh.position.z += (tz - d.mesh.position.z) * Math.min(1, dt * 10);
    }

    // THE EARS' WORLD MODEL: walls between you and a sound muffle it (the
    // audio engine asks this test per shot), and the weather dulls the whole
    // battlefield — §8.8's sound column, finally real
    audio.occlusionTest = (p) => !losClear(world.map.grid,
      { x: audio.listener.x, y: 1.4, z: audio.listener.z }, { x: p.x, y: 1.4, z: p.z });
    {
      const wk = world.weather?.kind;
      audio.weatherDull = (wk === 'snow' ? 0.5 : wk === 'storm' ? 0.4 : wk === 'rain' ? 0.25 : wk === 'dust' ? 0.2 : 0)
        * (world.weather?.intensity ?? 0);
    }

    // §8.8 the sky's turn: clouds drift, weather taxes the atmosphere
    this.updateWeather(world, dt);

    // §8.4 phase 3 — the WINDOW TRUTH: an enemy you legitimately perceive
    // (window LOS, ping, skyline, or the SEEN_LINGER trail) must never hide
    // under an opaque lid — "I looked in the open window and the house lied."
    // Puppet worlds trust the wire (the server culled to what we may see);
    // local worlds ask the sim's lastSeen trail directly.
    const revealRoof = new Set<number>();   // house idx: seen hostile on its top floor
    const revealUpper = new Set<number>();  // 2-storey house idx: seen hostile downstairs
    {
      const focus = world.soldiers.get(localId);
      if (focus) {
        for (const s of world.soldiers.values()) {
          if (!s.alive || s.team === focus.team || s.vehicleId >= 0) continue;
          if (!world.puppet && !seenRecently(world.lastSeen, world.pinged, focus.team, s, world.time,
            classLinger(focus.classId, focus.equipment.includes('tracking_optics')))) continue;
          const hIdx = houseAt(world.map.houses, s.pos.x, s.pos.z);
          if (hIdx < 0) continue;
          const topFloor = world.map.houses[hIdx].floors === 2 ? 1 : 0;
          if ((s.floor ?? 0) >= topFloor) revealRoof.add(hIdx);
          else revealUpper.add(hIdx);
        }
      }
    }

    // second-storey shells: fade when the focus stands on the ground floor
    // INSIDE that house (you need to see your own room, not their ceiling) —
    // or when a hostile you've genuinely seen is holed up down there
    if (this.uppers.length) {
      const focus = world.soldiers.get(localId);
      for (const u of this.uppers) {
        const uIdx = world.map.houses.indexOf(u.house as typeof world.map.houses[number]);
        const inThis = (focus && focus.floor === 0 &&
          houseAt(world.map.houses, focus.pos.x, focus.pos.z) === uIdx) || revealUpper.has(uIdx);
        const target = inThis ? 0.13 : 0.97;
        for (const m of u.mats) {
          m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
          m.depthWrite = m.opacity > 0.9;
        }
      }
    }

    // §8.4 cutaway: the roof over YOUR head (or the killcam subject's) opens —
    // and so does any roof you're standing NEXT TO. The doorway peek: an
    // attacker one step inside a doorway must never be invisible at melee
    // range (a zombie under a neighbor's roof once killed a player who never
    // saw it). Distance is to the house RECT, so long walls peek too.
    if (this.roofs.length) {
      const focus = world.soldiers.get(localId);
      const inHouse = focus ? houseAt(world.map.houses, focus.pos.x, focus.pos.z) : -1;
      for (const r of this.roofs) {
        const hIdx = world.map.houses.indexOf(r.house as typeof world.map.houses[number]);
        let open = hIdx === inHouse || revealRoof.has(hIdx);
        if (!open && focus) {
          const h = r.house;
          const x0 = h.tx * TILE - WORLD / 2, z0 = h.tz * TILE - WORLD / 2;
          const dx = Math.max(x0 - focus.pos.x, 0, focus.pos.x - (x0 + h.tw * TILE));
          const dz = Math.max(z0 - focus.pos.z, 0, focus.pos.z - (z0 + h.th * TILE));
          open = dx * dx + dz * dz < 4.5 * 4.5;
        }
        const target = open ? 0.12 : 0.97;
        for (const m of r.mats) {
          m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
          m.depthWrite = m.opacity > 0.9; // fading lids must not write depth
        }
      }
    }

    // zoom-adaptive overhead: names/meters are INSTRUMENTS, not props — they
    // scale with the camera so they hold constant screen size at every zoom,
    // and past mid-zoom a team disc fades in under each soldier so the tiny
    // models stay findable at command height
    const uiK = Math.min(2.1, Math.max(0.85, this.viewDist / 30));
    const blipAlpha = Math.min(0.8, Math.max(0, (this.viewDist - 34) / 14));
    if (!this.blipMats) {
      this.blipGeo = new THREE.CircleGeometry(0.85, 24);
      this.blipRingGeo = new THREE.RingGeometry(0.5, 0.9, 24); // hostiles: ring, not disc (§18)
      this.blipMats = [0, 1].map((t) => new THREE.MeshBasicMaterial({
        color: TEAM_COLORS[t], transparent: true, opacity: 0, depthWrite: false,
      })) as [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial];
    }
    this.blipMats[0].opacity = blipAlpha;
    this.blipMats[1].opacity = blipAlpha;

    // soldiers
    for (const s of world.soldiers.values()) {
      let mesh = this.soldierMeshes.get(s.id);
      // §7: a soldier can CHANGE BODIES mid-match — ascend into an LSW, or
      // die and come back mortal. The cache is by id, so a body swap means
      // tear down and rebuild (the dress is baked into materials and scale).
      if (mesh && (s.ascendant ?? '') !== ((mesh.userData.lsw as string | undefined) ?? '')) {
        this.scene.remove(mesh);
        this.soldierMeshes.delete(s.id);
        mesh = undefined;
        // this id now holds a DIFFERENT body (a mid-match ascension, or a
        // harness re-pick reusing the id): drop its stale time-based transients
        // so a leftover pose can't render with a garbage envelope on the newcomer
        this.castPoses.delete(s.id);
        this.throwPoses.delete(s.id);
        this.meleeTelegraphs.delete(s.id);
        this.recoilAt.delete(s.id);
      }
      // the CARRIED weapon is part of the body now (weapons.ts): a switch to
      // the sidearm — or an armory re-draw on respawn — rebuilds the mesh so
      // the hands close on the right silhouette. Humans and bots only; zeds,
      // dogs and the doctor never wear an armory piece.
      const wantWeapon = (s.kind === 'human' || s.kind === 'bot')
        ? (s.weapons[s.weaponIdx] ?? '') : '';
      if (mesh && (mesh.userData.weaponId ?? '') !== wantWeapon) {
        this.scene.remove(mesh);
        this.soldierMeshes.delete(s.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = buildSoldier(s.team, s.classId, s.kind, wantWeapon || undefined);
        // AN LSW READS AS AN LSW (§21.6, Robert: "make sure visually the
        // LSWs look different… I want them to look like they're on fire"):
        // scale the whole body up past a trooper, tint it its faction shade,
        // and hang the signature aura the animator keeps alive.
        if (s.ascendant) dressAsLsw(mesh, s.ascendant);
        // cache the animation joints — getObjectByName every frame is wasteful
        mesh.userData.joints = Object.fromEntries(
          JOINT_NAMES.map((n) => [n, mesh!.getObjectByName(n)]),
        );
        this.scene.add(mesh);
        this.soldierMeshes.set(s.id, mesh);
      }
      const inVehicle = s.vehicleId >= 0;
      const corpse = !s.alive && world.time < s.respawnAt - 0.02;
      // §19.1 the DARK: in local worlds every soldier exists in memory — the
      // cone decides which ENEMIES actually draw. The sim's lastSeen trail
      // already encodes every rule (cone+ring, skyline, ping, flag, cloak):
      // a fresh mark = live pose; a linger mark = a ghost FROZEN where you
      // lost them; nothing = not drawn. Puppets skip this — the server's
      // cull already decided, and its ghosts arrive pre-frozen.
      let ghost: SeenMark | undefined;
      let dark = false;
      mesh.userData.ghostAlpha = 1;
      if (!world.puppet && local && s.team !== localTeam && s.alive && !inVehicle) {
        // ROW 81: alive → YOUR eyes decide the 3D world (the per-viewer
        // trail above); dead → the squad's radio paints (team trail), so
        // the death cam still frames the killer.
        const mark = (local.alive ? this.localSeen : world.lastSeen[localTeam]).get(s.id);
        const fresh = mark !== undefined && world.time - mark.t < 0.07;
        if (!fresh) {
          // §11 row 6: per-CLASS linger (recon holds longest, max 5s), and the
          // ghost DISSOLVES across the window instead of popping at its end
          const linger = classLinger(local.classId, local.equipment.includes('tracking_optics'));
          if (mark && world.time - mark.t <= linger && !(s.cloaked && !world.pinged.has(s.id))) {
            ghost = mark;
            mesh.userData.ghostAlpha = Math.max(0.05, 1 - (world.time - mark.t) / linger);
          } else dark = true;
        }
      }
      // #44 CORPSE FOG: a dead enemy carries no seen-trail (the sim deletes its
      // mark the tick it dies), so cull it LIVE against friendly eyes exactly as
      // the multiplayer culler does — a body you never had eyes on, across the
      // map or behind a wall, must not read through it. A corpse you can see
      // (you watched him drop, or you have LOS to the spot) still draws.
      if (!world.puppet && local && s.team !== localTeam && corpse && !enemyVisibleAt(s.pos.x, s.pos.z)) {
        dark = true;
      }
      // SOUND AND MOVEMENT (§19.2): your ears keep working where your eyes
      // stop. An unseen mover inside earshot still lands footsteps — and
      // each one smears a brief smudge through the dark. Hearing is a skill.
      if (dark && s.alive && !inVehicle && local && !this.replayView) {
        const dHear = Math.hypot(s.pos.x - local.pos.x, s.pos.z - local.pos.z);
        const sp = Math.hypot(s.vel.x, s.vel.z);
        if (dHear < 20 && sp > 0.8) {
          const lastAt = this.unseenStepAt.get(s.id) ?? -9;
          if (world.time - lastAt > Math.max(0.26, 1.7 / sp)) {
            this.unseenStepAt.set(s.id, world.time);
            const step = BIOME_AUDIO[world.map.theme]?.footstep;
            if (!step || !audio.play(step, { pos: s.pos, volume: 0.4 })) {
              audio.play('footstep', { pos: s.pos, volume: 0.4 });
            }
            this.spawnSmudge(s.pos, 1.3, world.time);
          }
        }
      }

      // THE SURFER IS THE EXCEPTION to "occupants are invisible" (Robert:
      // "the hoverboard needs to look like the character is actually on it").
      // An open deck hides nothing — the real soldier mesh rides it, class,
      // gun, nameplate and all, instead of a generic stand-in.
      const surfBoard = inVehicle ? world.vehicles.get(s.vehicleId) : undefined;
      const surfing = surfBoard?.kind === 'hoverboard' && surfBoard.alive;
      mesh.visible = (s.alive || corpse) && (!inVehicle || surfing) && !dark && !(s.cloaked && s.team !== localTeam && s.id !== localId);
      if (!mesh.visible) continue;
      // UI P0 (docs/UI-MASTER.md §2): a DOWNED FRIENDLY is marked — a pulsing
      // amber ground ring under the body (enemies' downed stay unmarked: the
      // hover-ring already skips them deliberately), and while a revive
      // channels, a green arc CLOSES around the body — progress both the
      // medic and the fallen can read. Stored on the mesh, self-cleaning.
      {
        const showDown = s.alive && !!s.downed && s.team === localTeam;
        let dr = mesh.userData.downRing as THREE.Mesh | undefined;
        if (showDown && !dr) {
          dr = new THREE.Mesh(
            new THREE.RingGeometry(0.9, 1.15, 28),
            new THREE.MeshBasicMaterial({ color: 0xe8a33d, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
          );
          dr.rotation.x = -Math.PI / 2;
          dr.position.y = 0.06;
          mesh.add(dr);
          mesh.userData.downRing = dr;
        } else if (!showDown && dr) {
          mesh.remove(dr); dr.geometry.dispose(); (dr.material as THREE.Material).dispose();
          mesh.userData.downRing = undefined;
          dr = undefined;
        }
        if (dr) {
          const urgency = Math.max(0, 1 - Math.max(0, ((s.downedUntil ?? 0) - world.time)) / 20);
          (dr.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.3 * Math.abs(Math.sin(world.time * (2 + urgency * 6)));
        }
        const prog = s.alive && !!s.downed ? (s.reviveProgress ?? 0) : 0;
        let ra = mesh.userData.reviveArc as THREE.Mesh | undefined;
        if (prog > 0) {
          if (ra) { mesh.remove(ra); ra.geometry.dispose(); (ra.material as THREE.Material).dispose(); }
          ra = new THREE.Mesh(
            new THREE.RingGeometry(1.25, 1.45, 28, 1, 0, prog * Math.PI * 2),
            new THREE.MeshBasicMaterial({ color: 0x46d17a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
          );
          ra.rotation.x = -Math.PI / 2;
          ra.position.y = 0.07;
          mesh.add(ra);
          mesh.userData.reviveArc = ra;
        } else if (ra) {
          mesh.remove(ra); ra.geometry.dispose(); (ra.material as THREE.Material).dispose();
          mesh.userData.reviveArc = undefined;
        }
      }
      // UI P0 (docs/UI-MASTER.md §5): SPAWN PROTECTION wears a visible shell —
      // a slow-turning wire sphere that thins as the window expires. Stored on
      // the mesh so body rebuilds tear it down with everything else.
      {
        const protLeft = (s.protectedUntil ?? 0) - world.time;
        let shell = mesh.userData.protShell as THREE.Mesh | undefined;
        if (s.alive && protLeft > 0) {
          if (!shell) {
            shell = new THREE.Mesh(
              new THREE.IcosahedronGeometry(0.95, 1),
              new THREE.MeshBasicMaterial({ color: 0x8fd4e8, wireframe: true, transparent: true, opacity: 0.3, depthWrite: false }),
            );
            shell.position.y = 1.1;
            mesh.add(shell);
            mesh.userData.protShell = shell;
          }
          const k = Math.min(1, protLeft / 5);
          (shell.material as THREE.MeshBasicMaterial).opacity = 0.06 + 0.26 * k * (0.8 + 0.2 * Math.sin(world.time * 6));
          shell.rotation.y = world.time * 0.7;
        } else if (shell) {
          mesh.remove(shell);
          shell.geometry.dispose();
          (shell.material as THREE.Material).dispose();
          mesh.userData.protShell = undefined;
        }
      }
      // squad-only overhead: name + vitals circles. Enemy plates were clutter
      // AND free intel — enemies now read as silhouettes and team color.
      // ON DEMAND, NOT ALWAYS. Every friendly used to wear a name + health
      // meter permanently, which is the clutter Robert is complaining about:
      // twelve stacked tags between you and the fight. Now a body speaks when
      // you point at it — the information is all still there, you ask for it.
      const squad = !!local && s.id !== localId && s.alive &&
        (s.team === localTeam || s.kind === 'scientist') &&
        (s.kind === 'bot' || s.kind === 'human' || s.kind === 'scientist' || s.kind === 'dog') &&
        this.hovered(s.pos.x, s.pos.z);
      let tag = this.nameSprites.get(s.id);
      if (squad && !tag) {
        tag = { ...this.makeUnitTag(), key: '' };
        mesh.add(tag.sprite);
        this.nameSprites.set(s.id, tag);
      }
      if (tag) {
        tag.sprite.visible = squad;
        if (squad) {
          const hpFrac = Math.max(0, Math.min(1, s.hp / s.maxHp));
          const arFrac = (s.maxArmor ?? 0) > 0 ? Math.max(0, Math.min(1, s.armor / s.maxArmor)) : 0;
          const key = `${s.name}:${s.team}:${Math.round(hpFrac * 24)}:${Math.round(arFrac * 12)}`;
          if (key !== tag.key) { tag.key = key; this.drawUnitTag(tag.ctx, s.name, s.team, hpFrac, arFrac); tag.tex.needsUpdate = true; }
          // constant screen size: grow with zoom, and climb so the stack never overlaps
          tag.sprite.scale.set(3.4 * uiK, 0.85 * uiK, 1);
          tag.sprite.position.y = (s.kind === 'dog' ? 1.55 : 2.55) + 0.85 * uiK; // the K9 wears its name low
        }
      }
      // far-zoom blip: the disc IS the soldier at command height
      if (s.kind === 'bot' || s.kind === 'human' || s.kind === 'scientist') {
        let blip = this.blips.get(s.id);
        if (!blip) {
          // §18 second channel at command height too: hostiles ring, friends disc
          const hostile = s.team !== localTeam;
          blip = new THREE.Mesh(hostile ? this.blipRingGeo! : this.blipGeo!, this.blipMats![s.team]);
          blip.rotation.x = -Math.PI / 2;
          blip.position.y = 0.06;
          blip.userData.uiOverlay = true; // its own alpha — keep setAlpha off it
          mesh.add(blip);
          this.blips.set(s.id, blip);
        }
        blip.visible = s.alive && blipAlpha > 0.01;
        blip.scale.setScalar(uiK);
      }
      // THE RING (§UI): every soldier you may see wears the one glyph.
      // squad = faction color with plate; enemy = signal red, numbers only
      // when your kit earns them. Cloaked = no ring (cloak stays TRUE).
      const enemyRing = s.team !== localTeam && s.id !== localId && mesh.visible && s.alive && !s.downed;
      // friendlies now carry health on the overhead tag's meter, so the ground
      // ring is enemy-only — no more double health readout, less ground clutter.
      // the enemy health ring answers the same way — point at a man to read
      // how hurt he is, instead of the floor being a wall of dials
      const ringWanted = enemyRing && !s.cloaked && this.hovered(s.pos.x, s.pos.z);
      let ring = this.ringMaps.get(s.id);
      if (ringWanted && !ring) {
        ring = { ...this.makeRingMap(), key: '' };
        ring.mesh.userData.uiOverlay = true; // its own alpha — keep setAlpha off it (else black disc)
        mesh.add(ring.mesh);
        this.ringMaps.set(s.id, ring);
      }
      if (ring) {
        ring.mesh.visible = ringWanted;
        if (ringWanted) {
          const hpFrac = Math.max(0, Math.min(1, s.hp / s.maxHp));
          const arFrac = (s.maxArmor ?? 0) > 0 ? Math.max(0, Math.min(1, s.armor / s.maxArmor)) : 0;
          // the tier: class tier + optics(+1) + commission(+1), squad ≥ grade
          const tier = ringTier({
            viewerRecon: !!local && ['ghost', 'infiltrator', 'pathfinder'].includes(local.classId),
            viewerMedic: !!local && local.classId === 'medic',
            viewerOptics: !!local && local.equipment.includes('tracking_optics'),
            viewerCommissioned: false, // the officer's commission rides its own arc when it ships
            squadmate: squad,
          });
          const color = squad ? (s.team === 0 ? '#e8a33d' : '#3dbde8') : RING_COLORS.hostile;
          const exact = tier === 2 ? Math.ceil(s.hp) : null;
          const threat = s.ascendant ? (LSWS[s.ascendant]?.threat ?? 0) : 0;
          const key = `${tier}:${Math.round(hpFrac * 100)}:${Math.round(arFrac * 20)}:${exact ?? '-'}:${squad}:${threat}`;
          if (key !== ring.key) {
            ring.key = key;
            if (tier === 0 && !s.ascendant) {
              // chunks use the SHARED cached textures — 4 ever drawn
              (ring.mesh.material as THREE.MeshBasicMaterial).map = ringChunkTexture(chunkCount(hpFrac), color);
            } else {
              (ring.mesh.material as THREE.MeshBasicMaterial).map = ring.tex;
              if (tier === 0) drawChunks(ring.ctx, chunkCount(hpFrac), color);
              else drawGrade(ring.ctx, hpFrac, squad ? arFrac : 0, color, squad);
              if (threat > 0) drawNotches(ring.ctx, threat, color); // the god's tier is public
              if (exact !== null) drawNumber(ring.ctx, exact);
              ring.tex.needsUpdate = true;
            }
            (ring.mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
          }
          // the ring obeys perception exactly like the body does
          (ring.mesh.material as THREE.MeshBasicMaterial).opacity = (mesh.userData.ghostAlpha as number | undefined) ?? 1;
          // LSWs wear it larger — threat is public
          const ringScale = s.ascendant ? 1.9 : 1;
          ring.mesh.scale.setScalar(ringScale * uiK);
        }
      }
      // a ghost holds the spot you lost them — never their live path
      mesh.position.set(ghost?.x ?? s.pos.x, s.pos.y, ghost?.z ?? s.pos.z);
      // in the water: waders splash at boot height, swimmers sink to the neck
      {
        const wt = world.map.grid[Math.floor((s.pos.z + WORLD / 2) / TILE) * GRID + Math.floor((s.pos.x + WORLD / 2) / TILE)];
        if (wt === T_DEEP && s.pos.y < 0.5) {
          mesh.position.y -= 0.95 - Math.sin(world.time * 2.2 + s.id) * 0.06; // swimming: chin on the waterline
          if ((s.vel.x !== 0 || s.vel.z !== 0) && Math.random() < 0.15) {
            this.particles.emit({ pos: { x: s.pos.x, y: 0.15, z: s.pos.z }, count: 2, color: 0xbfe2ec, speed: 1.5, life: 0.4, spread: 0.5, up: 1.5, gravity: 5 });
          }
        } else if (wt === T_WATER && s.pos.y < 0.5) {
          mesh.position.y -= 0.28; // wading: shins under
          if ((s.vel.x !== 0 || s.vel.z !== 0) && Math.random() < 0.08) {
            this.particles.emit({ pos: { x: s.pos.x, y: 0.1, z: s.pos.z }, count: 1, color: 0xbfe2ec, speed: 1.2, life: 0.3, spread: 0.4, up: 1.2, gravity: 5 });
          }
        }
      }
      // DUCK (finish-list 18): the silhouette folds -- head below the grass line
      if (s.crouching && !s.ascendant && s.pos.y < 0.5) mesh.position.y -= 0.5;
      // THE TURN (feel pass #1): the body CATCHES UP to the aim instead of
      // teleporting to it. A per-soldier yaw spring: fast while moving,
      // measured at rest — and the head LEADS the body (animateSoldier picks
      // up yawDiff below), which is what sells "he's turning" over "statue
      // on a lazy susan". Sim yaw is math-angle on XZ; three rotates opposite.
      {
        const ys = (mesh.userData.yaw ??= { v: -s.yaw }) as { v: number };
        // a surfer's body follows the BOARD, not the mouse — the deck decides
        const wantYaw = surfing && surfBoard ? -surfBoard.yaw : -s.yaw;
        mesh.userData.yawDiff = stepYawSpring(ys, wantYaw, this.frameDt, Math.hypot(s.vel.x, s.vel.z) > 0.6);
        mesh.rotation.y = ys.v;
      }
      if (surfing && surfBoard) {
        // feet on the deck: the same bob the board mesh rides (see the vehicle
        // pass), deck top at 0.51, minus a crouch dip the surf pose expects
        const bob = Math.sin(world.time * 4 + surfBoard.id) * 0.1 + 0.25;
        mesh.position.set(surfBoard.pos.x, bob + 0.51 - 0.14, surfBoard.pos.z);
      }
      this.animateSoldier(mesh, s, world);
      if (s.ascendant) this.lswAura(mesh, s, world);
      if (s.encasedUntil !== undefined || this.iceBlocks.has(s.id)) this.updateIceBlock(s);
    }
    for (const [id, mesh] of this.soldierMeshes) {
      if (!world.soldiers.has(id)) {
        // during a replay the live/puppet rosters differ — hide, don't
        // delete, or every swap thrashes (and leaks) dozens of meshes
        if (this.replayView) { mesh.visible = false; continue; }
        // detach the blip BEFORE the traverse below — its geometry/material
        // are shared across every soldier and must never be disposed
        const blip = this.blips.get(id);
        if (blip) { mesh.remove(blip); this.blips.delete(id); }
        this.scene.remove(mesh);
        mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mm = m.material as THREE.Material | undefined;
          mm?.dispose();
        });
        const tag = this.nameSprites.get(id);
        if (tag) {
          tag.sprite.material.map?.dispose();
          tag.sprite.material.dispose();
          this.nameSprites.delete(id);
        }
        const ring = this.ringMaps.get(id);
        if (ring) {
          ring.tex.dispose();
          (ring.mesh.material as THREE.MeshBasicMaterial).dispose();
          this.ringMaps.delete(id);
        }
        this.soldierMeshes.delete(id);
        this.meleeTelegraphs.delete(id);
      }
    }

    // OUTBREAK §6/§1 — the INCUBATING CORPSES draw as prone bodies (local play;
    // a puppet already has a culled snapshot). Each lingers where it fell, then
    // THRASHES in its final seconds before it rises — so the horde is seen to
    // grow from a body, never a blank spawn. Hidden until the dead-soldier mesh
    // has cleared (RESPAWN_DELAY), so there is never a doubled corpse.
    const liveCorpses = new Set<World['corpses'][number]>();
    if (!world.puppet) {
      for (const c of world.corpses) {
        if (c.neutralized) continue;
        liveCorpses.add(c);
        let entry = this.corpseMeshes.get(c);
        if (!entry) {
          const cm = buildCorpseMesh();
          cm.position.set(c.pos.x, 0, c.pos.z);
          this.scene.add(cm);
          entry = { mesh: cm, bornAt: world.time };
          this.corpseMeshes.set(c, entry);
        }
        const revealed = world.time - entry.bornAt >= CORPSE_REVEAL_DELAY;
        entry.mesh.visible = revealed;
        if (revealed) {
          // still early, convulsing hard in the last CORPSE_CRIT seconds
          const crit = Math.max(0, Math.min(1, 1 - (c.reanimatesAt - world.time) / CORPSE_CRIT));
          const amp = 0.015 + crit * 0.34;
          const f = 3 + crit * 22;
          entry.mesh.rotation.z = Math.sin(world.time * f + entry.bornAt * 7) * amp;
          entry.mesh.position.y = Math.abs(Math.sin(world.time * f * 0.7)) * crit * 0.13;
        }
      }
    }
    for (const [c, entry] of this.corpseMeshes) {
      if (!liveCorpses.has(c)) { this.scene.remove(entry.mesh); this.corpseMeshes.delete(c); }
    }

    // row 246 THE FROST BRIDGE: a pale translucent sheet over each water tile
    // Frostbite has frozen — the crossing you can SEE before you trust it.
    // Synced to the sim's frozenWater map (lazy: only live entries draw).
    {
      const liveFrost = new Set<number>();
      for (const [idx, thaw] of world.frozenWater) {
        if (thaw <= world.time) continue;
        liveFrost.add(idx);
        let sheet = this.frostSheets.get(idx);
        if (!sheet) {
          sheet = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE, TILE),
            new THREE.MeshBasicMaterial({ color: 0xcfeaf5, transparent: true, opacity: 0.62, depthWrite: false }),
          );
          sheet.rotation.x = -Math.PI / 2;
          const tx = idx % GRID, tz = Math.floor(idx / GRID);
          sheet.position.set(tx * TILE - WORLD / 2 + TILE / 2, 0.06, tz * TILE - WORLD / 2 + TILE / 2);
          this.scene.add(sheet);
          this.frostSheets.set(idx, sheet);
        }
      }
      for (const [idx, sheet] of this.frostSheets) {
        if (!liveFrost.has(idx)) {
          this.scene.remove(sheet); (sheet.material as THREE.Material).dispose(); sheet.geometry.dispose();
          this.frostSheets.delete(idx);
        }
      }
    }

    // STATUS §2 — the FOUGHT-ON BATTLEFIELD (Robert: "corpses should linger
    // 20-30s"). In non-outbreak modes a fallen body stays where it dropped,
    // decoupled from the 4s respawn, then SINKS away — booked on the alive→dead
    // edge. Outbreak modes leave lingering to the reanimating world.corpses.
    if (this.lastCorpseWorld !== world) {
      for (const bc of this.battlefieldCorpses) this.scene.remove(bc.mesh);
      this.battlefieldCorpses.length = 0;
      this.prevAlive.clear();
      this.lastCorpseWorld = world;
    }
    if (!world.puppet && !world.outbreakEnabled && !world.mode.over) {
      for (const s of world.soldiers.values()) {
        const was = this.prevAlive.get(s.id);
        if (was === true && !s.alive && (s.kind === 'human' || s.kind === 'bot')) {
          if (this.battlefieldCorpses.length >= 60) {
            const old = this.battlefieldCorpses.shift(); if (old) this.scene.remove(old.mesh);
          }
          const cm = buildCorpseMesh();
          cm.position.set(s.pos.x, 0, s.pos.z);
          cm.visible = false;
          this.scene.add(cm);
          this.battlefieldCorpses.push({ bornAt: world.time, mesh: cm });
        }
        this.prevAlive.set(s.id, s.alive);
      }
    }
    for (let i = this.battlefieldCorpses.length - 1; i >= 0; i--) {
      const bc = this.battlefieldCorpses[i];
      const age = world.time - bc.bornAt;
      if (age >= BATTLEFIELD_CORPSE_LINGER) { this.scene.remove(bc.mesh); this.battlefieldCorpses.splice(i, 1); continue; }
      // hidden until the dead-soldier mesh clears; in its final second it SINKS
      // into the ground instead of popping out of existence
      bc.mesh.visible = age >= CORPSE_REVEAL_DELAY;
      bc.mesh.position.y = -Math.max(0, age - (BATTLEFIELD_CORPSE_LINGER - 1)) * 0.5;
    }

    // STATUS §1 / W1.2 — the AIM RING follows the local player, facing where you
    // aim, its wedge OPENING with the live accuracy cone (crouch tightens, a
    // sprint or an airborne shot sprays). Hidden in a vehicle (you aim the
    // turret), while dead, or on any replay/killcam.
    if (local && local.alive && local.vehicleId < 0 && !this.replayView && !world.mode.over) {
      if (!this.aimRing) { this.aimRing = buildAimRing(); this.scene.add(this.aimRing); }
      this.aimRing.visible = true;
      this.aimRing.position.set(local.pos.x, local.pos.y + 0.02, local.pos.z);
      this.aimRing.rotation.y = -local.yaw; // sim yaw is math-angle; three rotates opposite
      const wdef = WEAPONS[local.weapons[local.weaponIdx]];
      const half = Math.min(0.55, (wdef?.spread ?? 0.03) * aimSpreadMul(local) * AIM_SCALE);
      (this.aimRing.getObjectByName('aimL') as THREE.Object3D | null)?.rotation.set(0, half, 0);
      (this.aimRing.getObjectByName('aimR') as THREE.Object3D | null)?.rotation.set(0, -half, 0);
    } else if (this.aimRing) {
      this.aimRing.visible = false;
    }

    // vehicles
    for (const v of world.vehicles.values()) {
      let mesh = this.vehicleMeshes.get(v.id);
      // hotwired hulls fly the thief's colors — rebuild the model when the team flips
      if (mesh && mesh.userData.team !== v.team) {
        this.scene.remove(mesh);
        this.vehicleMeshes.delete(v.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = buildVehicle(v.kind, v.team);
        mesh.userData.team = v.team;
        this.scene.add(mesh);
        this.vehicleMeshes.set(v.id, mesh);
      }
      mesh.visible = v.alive;
      if (!v.alive) continue;
      // #45 VEHICLE FOG: an enemy hull carries no seen-trail either, and was
      // drawn wherever it was alive — a tank on the far side of the map, behind
      // every building, read straight through them. Mirror the multiplayer
      // culler (snapshot.ts) exactly: your own team always shows; a burrowed
      // digger is truly gone; dead ECM broadcasts you; otherwise a friendly eye
      // must hold LOS to the hull (tested at ~1.8u, a turret's height).
      if (!world.puppet && local && v.team !== localTeam) {
        const ecmDead = !!v.systems && v.systems.ecm <= 0;
        if (v.burrowed || (!ecmDead && !enemyVisibleAt(v.pos.x, v.pos.z, 1.8))) {
          mesh.visible = false;
          continue;
        }
      }
      // open vehicles show their rider only while someone's actually aboard
      const rider = mesh.getObjectByName('rider');
      if (rider) rider.visible = v.seats[0] >= 0;
      let hoverBob =
        v.kind === 'skiff' ? Math.sin(world.time * 3 + v.id) * 0.15 + 0.3 :
        v.kind === 'boat' ? Math.sin(world.time * 2.1 + v.id) * 0.08 + 0.05 :
        v.kind === 'hoverboard' ? Math.sin(world.time * 4 + v.id) * 0.1 + 0.25 :
        0;
      // flyers earn their altitude: parked on skids, rotors spool with a
      // pilot aboard, then the bird climbs to cruise height
      if (v.kind === 'flyer') {
        const lift = VEHICLES.flyer.liftoffTime ?? 2.5;
        const hasPilot = v.seats[0] >= 0;
        const spoolLeft = Math.max(0, (v.spoolUntil ?? 0) - world.time);
        const k = hasPilot ? 1 - Math.min(1, spoolLeft / lift) : 0;
        const cruiseF = [0.3, 1.9, 3.4, 3.4][Math.max(0, Math.min(3, v.band ?? 2))];
        const target = 0.3 + k * (cruiseF - 0.3 + Math.sin(world.time * 2.2 + v.id) * 0.25 * k);
        const prev = this.flyerAlt.get(v.id) ?? 0.3;
        const alt = prev + (target - prev) * Math.min(1, dt * 2.2);
        this.flyerAlt.set(v.id, alt);
        hoverBob = alt;
        // rotors wind from idle tick-over to a full blur as the spool completes
        for (const rn of ['rotorL', 'rotorR']) {
          const rotor = mesh.getObjectByName(rn);
          if (rotor) rotor.rotation.y += dt * (1.5 + (hasPilot ? k * 17 : 0));
        }
      }
      // THE FIXED WING EARNS THE SKY TOO (Robert: "planes have to start off
      // grounded"). Only the flyer had altitude code — strikejet, interceptor
      // and bomber rendered at deck height forever, parked AND flying. A
      // parked jet now sits flat on its gear; a piloted one climbs to cruise
      // as its spool completes, and it BANKS into turns (bankAngle shipped in
      // V2's defs and was read by nobody until now).
      const vdef = VEHICLES[v.kind];
      // J1 THE SKY HAS FLOORS: a BAND is drawable in a way raw height never
      // was — each one is a distinct deck the eye can learn. 1 rooftop-low,
      // 2 clear of every roof, 3 the jets' own country.
      // B2 THE AIR FIX (Robert: "it kind of feels like we're still low… it
      // should VISUALLY feel like we're high"): band 2 finally clears the 8u
      // roofline its own comment promises, and band 3 is genuinely UP — the
      // sanctuary the sim now enforces reads as one.
      const BAND_ALT = [0.12, 2.0, 8.6, 14.0];
      if (vdef.flies && v.kind !== 'flyer') {
        const lift = vdef.liftoffTime ?? 1.4;
        const hasPilot = v.seats[0] >= 0;
        const spoolLeft = Math.max(0, (v.spoolUntil ?? 0) - world.time);
        const k = hasPilot ? 1 - Math.min(1, spoolLeft / lift) : 0;
        const cruise = BAND_ALT[Math.max(0, Math.min(3, v.band ?? 0))];
        const target = 0.12 + k * (cruise - 0.12 + Math.sin(world.time * 1.7 + v.id) * 0.18 * k);
        const prev = this.flyerAlt.get(v.id) ?? 0.12;
        const alt = prev + (target - prev) * Math.min(1, dt * 1.6);
        this.flyerAlt.set(v.id, alt);
        hoverBob = alt;
        // the burner shows: the thrust flame STRETCHES on the thrust axis
        // (a lance of fire, not a bigger candle) and flickers at 30Hz
        for (const tn of ['thrustL', 'thrustR']) {
          const fl = mesh.getObjectByName(tn);
          if (fl) {
            const want = v.burnerOn ? 2.6 : 1;
            const cur = (fl.scale.x + (want - fl.scale.x) * Math.min(1, dt * 8));
            const flick = v.burnerOn ? 1 + Math.sin(world.time * 60 + v.id) * 0.12 : 1;
            fl.scale.set(cur * flick, 0.65 + cur * 0.35, 0.65 + cur * 0.35);
          }
        }
        // ✦ THE SOUND BARRIER BREAKS (Robert: "I want the ring showing that
        // it's breaking the sound barrier"): the tick the afterburner lights
        // at real airspeed, a white vapor cone-ring snaps perpendicular to
        // the fuselage, expands and shreds, with a double-crack boom. Once
        // per burn — the ring is the receipt for the commitment.
        {
          const wasBurning = this.burnerWas.get(v.id) ?? false;
          const speed = Math.hypot(v.vel.x, v.vel.z);
          if (v.burnerOn && !wasBurning && speed > vdef.speed * 0.55) {
            const geo = new THREE.RingGeometry(0.7, 1.5, 26);
            const mat2 = new THREE.MeshBasicMaterial({
              color: 0xf4f8ff, transparent: true, opacity: 0.85,
              side: THREE.DoubleSide, depthWrite: false,
            });
            const ring = new THREE.Mesh(geo, mat2);
            ring.position.set(v.pos.x, hoverBob, v.pos.z);
            // plane faces the direction of flight: ring lies perpendicular
            ring.rotation.set(0, -v.yaw + Math.PI / 2, 0);
            this.scene.add(ring);
            this.boomRings.push({ mesh: ring, born: world.time });
            // the double-crack: two thumps a hair apart, the second softer
            audio.play('thump', { pos: v.pos, volume: 0.9 });
            setTimeout(() => audio.play('thump', { pos: { ...v.pos }, volume: 0.45 }), 90);
          }
          this.burnerWas.set(v.id, !!v.burnerOn);
        }
      }
      mesh.position.set(v.pos.x, hoverBob, v.pos.z);
      mesh.rotation.y = -v.yaw;
      // B2 THE SHADOW ALTIMETER (Robert: "it should VISUALLY feel like we're
      // high"): a flyer casts a ground blob that GROWS and FADES as it climbs —
      // a big soft ghost = way up, a tight dark disc = on the deck. You read a
      // plane's altitude off the dirt without ever seeing a number.
      if (vdef.flies && v.kind !== 'flyer') {
        let sh = this.flyerShadows.get(v.id);
        if (!sh) {
          if (!this.flyerShadowGeo) this.flyerShadowGeo = new THREE.CircleGeometry(1, 20);
          sh = new THREE.Mesh(this.flyerShadowGeo, new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false,
          }));
          sh.rotation.x = -Math.PI / 2;
          this.scene.add(sh);
          this.flyerShadows.set(v.id, sh);
        }
        // altitude drives the blob: on the deck ~1.4u tight/dark, up high ~4u
        // wide/faint. hoverBob runs 0.12→14 across the bands.
        const t = Math.min(1, hoverBob / 12);
        const rad = 1.3 + t * 3.0;
        sh.position.set(v.pos.x, 0.03, v.pos.z);
        sh.scale.set(rad, rad, 1);
        (sh.material as THREE.MeshBasicMaterial).opacity = (0.34 - t * 0.24) * (v.alive ? 1 : 0);
        sh.visible = v.alive;
      }
      // roll: jets bank into their turn rate; the hoverboard heels into its
      // drift. Order YXZ makes rotation.x a roll about the hull's own nose.
      {
        const prevYaw = (mesh.userData.prevYaw as number | undefined) ?? v.yaw;
        let yawRate = (v.yaw - prevYaw) / Math.max(dt, 1e-4);
        if (yawRate > 9) yawRate -= (Math.PI * 2) / Math.max(dt, 1e-4) * Math.sign(yawRate);
        mesh.userData.prevYaw = v.yaw;
        let roll = 0;
        if (vdef.bankAngle && v.seats[0] >= 0) {
          roll = Math.max(-1, Math.min(1, yawRate / vdef.turnRate)) * vdef.bankAngle;
        } else if (vdef.slip) {
          const latV = -v.vel.x * Math.sin(v.yaw) + v.vel.z * Math.cos(v.yaw);
          roll = Math.max(-0.32, Math.min(0.32, latV * 0.03));
        }
        if (roll !== 0 || mesh.userData.hadRoll) {
          mesh.rotation.order = 'YXZ';
          const prevRoll = (mesh.userData.roll as number | undefined) ?? 0;
          const sm = prevRoll + (roll - prevRoll) * Math.min(1, dt * 6);
          mesh.userData.roll = sm;
          mesh.userData.hadRoll = Math.abs(sm) > 0.002;
          mesh.rotation.x = sm;
        }
      }
      if (v.kind === 'mech') {
        // the walk cycle: hips scissor with ground speed, planted when still
        const vSpeed = Math.hypot(v.vel.x, v.vel.z);
        const ph = ((mesh.userData.stride as number | undefined) ?? 0) + dt * (1.5 + vSpeed * 1.6);
        mesh.userData.stride = ph;
        const swing = Math.min(1, vSpeed / 3) * 0.5;
        const legL = mesh.getObjectByName('legL');
        const legR = mesh.getObjectByName('legR');
        if (legL && legR) {
          legL.rotation.z = Math.sin(ph) * swing;
          legR.rotation.z = -Math.sin(ph) * swing;
        }
      }
      if (v.kind === 'tunneler') {
        const drill = mesh.getObjectByName('drill');
        const vSpeed = Math.hypot(v.vel.x, v.vel.z);
        if (drill) drill.rotation.x += dt * (2 + vSpeed * 3);
        // deep runs sink the hull out of sight; both teams only see churned earth
        const sink = (mesh.userData.sink as number | undefined) ?? 0;
        const nextSink = sink + ((v.burrowed ? -1.6 : 0) - sink) * Math.min(1, dt * 3);
        mesh.userData.sink = nextSink;
        mesh.position.y = nextSink;
        if (v.burrowed && vSpeed > 0.5 && world.time >= (this.nextMoundAt.get(v.id) ?? 0)) {
          this.nextMoundAt.set(v.id, world.time + 0.16);
          this.particles.emit({ pos: { x: v.pos.x, y: 0.15, z: v.pos.z }, count: 3, color: 0x6b5636, speed: 1.2, life: 0.9, spread: 1.3, up: 1.8, gravity: 5, size: 0.5 });
        }
      }
      // THE RING at the hull's feet: vehicles wear chunks too — the tank's
      // state of the fight reads in one glance at any zoom
      {
        let vring = this.ringMaps.get(v.id);
        if (!vring) {
          vring = { ...this.makeRingMap(), key: '' };
          vring.mesh.scale.setScalar(2.2); // hulls wear it bigger than boots
          mesh.add(vring.mesh);
          this.ringMaps.set(v.id, vring);
        }
        const hpFrac = Math.max(0, Math.min(1, v.hp / v.maxHp));
        const key = `${chunkCount(hpFrac)}:${v.team}`;
        if (key !== vring.key) {
          vring.key = key;
          (vring.mesh.material as THREE.MeshBasicMaterial).map = ringChunkTexture(chunkCount(hpFrac), v.team === 0 ? '#e8a33d' : '#3dbde8');
          (vring.mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
      }

      // ambulance lightbar + tunneler warning lamp pulse
      const vPulse = mesh.getObjectByName('pulse') as THREE.Mesh | undefined;
      const vpm = vPulse?.material as THREE.MeshStandardMaterial | undefined;
      if (vpm) vpm.emissiveIntensity = 0.6 + 0.4 * Math.sin(world.time * 6 + v.id);
      // transport radar bar sweeps
      const radar = mesh.getObjectByName('spin');
      if (radar) radar.rotation.y = world.time * 2.5;
      // ambulance heal aura breathes so the radius reads at a glance
      const healRing = mesh.getObjectByName('healRing') as THREE.Mesh | undefined;
      if (healRing) {
        const hm = healRing.material as THREE.MeshBasicMaterial;
        hm.opacity = 0.18 + 0.14 * Math.sin(world.time * 2.5);
        healRing.rotation.z = world.time * 0.4;
      }

      // ---- crew-station feedback ----
      // a crewed, live sensor station sends visible radar sweeps
      const sensorOp = world.crewAt(v, 'sensors');
      if (sensorOp?.alive && v.systems.sensors > 0) {
        if (world.time >= (this.nextSweepAt.get(v.id) ?? 0)) {
          this.nextSweepAt.set(v.id, world.time + 2);
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.92, 1.0, 40),
            new THREE.MeshBasicMaterial({
              color: TEAM_COLORS[v.team], transparent: true, opacity: 0.55,
              side: THREE.DoubleSide, depthWrite: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(v.pos.x, 0.15, v.pos.z);
          this.scene.add(ring);
          this.sweepRings.push({ mesh: ring, born: world.time });
        }
      }
      // a crewed, live ECM station shows its 14u jamming footprint
      const ecmOp = world.crewAt(v, 'ecm');
      const jamming = !!ecmOp?.alive && v.systems.ecm > 0;
      let ecmRing = this.ecmRings.get(v.id);
      if (jamming && !ecmRing) {
        ecmRing = new THREE.Mesh(
          new THREE.RingGeometry(13.4, 14, 48),
          new THREE.MeshBasicMaterial({
            color: 0x66e8ff, transparent: true, opacity: 0.18,
            side: THREE.DoubleSide, depthWrite: false,
          }),
        );
        ecmRing.rotation.x = -Math.PI / 2;
        this.scene.add(ecmRing);
        this.ecmRings.set(v.id, ecmRing);
      }
      if (ecmRing) {
        ecmRing.visible = jamming;
        if (jamming) {
          ecmRing.position.set(v.pos.x, 0.12, v.pos.z);
          (ecmRing.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.08 * Math.sin(world.time * 3 + v.id);
        }
      }

      // ---- battle damage: dead systems smoke, dying hulls burn ----
      const sysDead = v.systems && (v.systems.engine <= 0 || v.systems.weapon <= 0 ||
        v.systems.sensors <= 0 || v.systems.ecm <= 0 || v.systems.comms <= 0);
      const burning = v.hp < v.maxHp * 0.35;
      if ((sysDead || burning) && world.time >= (this.nextSmokeAt.get(v.id) ?? 0)) {
        this.nextSmokeAt.set(v.id, world.time + (burning ? 0.18 : 0.4));
        const at = { x: v.pos.x, y: hoverBob + 1.6, z: v.pos.z };
        if (sysDead) this.particles.emit({ pos: at, count: 2, color: 0x5a5a5a, speed: 1.2, life: 1.4, spread: 0.7, up: 2.5, gravity: -1.5, size: 0.6 });
        if (burning) {
          this.particles.emit({ pos: at, count: 2, color: 0xff8030, speed: 1.5, life: 0.5, spread: 0.5, up: 3 });
          this.particles.emit({ pos: at, count: 1, color: 0x333333, speed: 1, life: 1.8, spread: 0.5, up: 3, gravity: -2, size: 0.8 });
        }
      }
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
      // TANK HULL WOBBLE (W1.6, Robert): the cannon doesn't just kick the barrel —
      // its recoil ROCKS the whole hull, which pitches up and SETTLES in a quick
      // damped wobble. Tanks only (their big gun shoves the chassis; a tank has
      // no bank/slip, so rotation.x is ours to drive — YXZ makes it a local pitch
      // along the barrel, not a world-axis tip).
      if (v.kind === 'tank') {
        mesh.rotation.order = 'YXZ';
        const since = world.time - (this.vehRecoilAt.get(v.id) ?? -Infinity);
        if (since >= 0 && since < 0.6) {
          const env = Math.exp(-since * 7) * Math.cos(since * 26); // damped settle
          mesh.rotation.x = -env * 0.09;   // nose heaves up on the shot, then rocks back
          mesh.position.y += env * 0.05;   // and the chassis bounces on its tracks
        } else {
          mesh.rotation.x = 0;             // flat at rest between shots
        }
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
        // tracer 'none' means "the SWING is the visual" — a fist, a claw, a
        // stomp, where a flying mesh would be nonsense. It was never meant to
        // mean "ranged and invisible", but four LSW needlers wear it too, and
        // this line silently refused to draw them: Phantom's Wall-Whisper
        // (34u), Nightmare (40u), Specter (30u), Shadowstep (22u) all fired
        // rounds that damaged, pierced three men, and appeared as NOTHING.
        // (Robert, playing Phantom: "I don't have a projectile. Or it's
        // invisible?" — it was invisible.) The harness already worked around
        // this by remapping none→bullet, which is the tell. Melee is the
        // 2-14u band; past that, a round is a round and gets drawn.
        if (def.tracer === 'none' && def.range <= 14) continue;
        // paintballs FLY in their shooter's paint — the rack is identity
        const paintball = world.mode.id === 'paintball' && p.weapon.startsWith('marker');
        // an LSW's round/beam glows its OWN signature color (Task 11 — kills the
        // shared mint-green beam); everyone else keeps the family tracer color
        const owner = world.soldiers.get(p.ownerId);
        const lswTint = owner?.ascendant ? LSWS[owner.ascendant].color : undefined;
        // precedence: AP rounds streak white-hot · paintball keys off the owner ·
        // a per-weapon tint (the beam seven) wins over the god's body tint (else
        // it's shadowed) · then body tint · then the family default
        const projColor = p.pierceArmor ? 0xffffff
          : paintball ? paintColorFor(p.ownerId, localId)
          : WEAPON_TINTS[p.weapon] ?? lswTint ?? (TRACER_COLORS[def.tracer] || 0xffcc88);
        mesh = this.makeProjectile(def.tracer, projColor, def.beam, p.weapon);
        mesh.userData.tracer = def.tracer;
        this.scene.add(mesh);
        this.projMeshes.set(p.id, mesh);
      }
      mesh.visible = true; // may have been hidden during a replay swap
      mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
      mesh.rotation.y = -Math.atan2(p.vel.z, p.vel.x);
      // per-round motion + flight trails make each family read distinctly
      const tr = mesh.userData.tracer as string;
      if (tr === 'paint') {
        // it WOBBLES rather than spins — a ball of liquid under its own skin
        const goo = mesh.getObjectByName('goo');
        const w = Math.sin(world.time * 26 + p.id) * 0.08;
        if (goo) goo.scale.set(1 + w, 0.86 - w, 1 + w * 0.5);
      }
      else if (tr === 'shell') mesh.rotation.x += dt * 22; // tumbling shell
      if (tr === 'frag') { mesh.rotation.x += dt * 13; mesh.rotation.z += dt * 9; } // end-over-end can
      else if (tr === 'canister') mesh.rotation.x += dt * 9; // lazy end-over-end tin
      else if (tr === 'rocket') {
        this.particles.emit({ pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, count: 1, color: 0x552e18, speed: 1, life: 0.5, spread: 0.15, up: 0, gravity: -1.5, size: 0.5 });
        this.particles.emit({ pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, count: 1, color: 0xff8c30, speed: 1.5, life: 0.14, spread: 0.1, up: 0, size: 0.35 });
      } else if (tr === 'plasma') {
        const halo = mesh.getObjectByName('halo');
        if (halo) halo.scale.setScalar(0.9 + Math.sin(world.time * 30 + p.id) * 0.2);
        this.particles.emit({ pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, count: 1, color: 0x60c8ff, speed: 0.5, life: 0.2, spread: 0.08, up: 0, size: 0.22 });
      } else if (tr === 'flame') {
        this.particles.emit({ pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, count: 2, color: 0xff7020, speed: 1, life: 0.25, spread: 0.4, up: 1, size: 0.4 });
      } else if (tr === 'acid') {
        this.particles.emit({ pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z }, count: 1, color: 0xa0e040, speed: 0.4, life: 0.3, spread: 0.1, up: -1, gravity: 3, size: 0.2 });
      }
    }
    // THE WHIZ (Robert: "if somebody shoots near you, you should hear it"):
    // a hostile round passing inside ~3u of your head cracks by, once per
    // round. It's pure information — the miss tells you where the fire is.
    const meWhiz = world.soldiers.get(localId);
    if (meWhiz?.alive && !this.replayView) {
      for (const p of world.projectiles.values()) {
        if (p.team === meWhiz.team || p.arc || this.whizzed.has(p.id)) continue;
        const d = Math.hypot(p.pos.x - meWhiz.pos.x, p.pos.z - meWhiz.pos.z);
        if (d < 3.2 && Math.abs(p.pos.y - 1.4) < 2.2) {
          this.whizzed.add(p.id);
          audio.play('whiz', { pos: p.pos, volume: 0.65, rate: 0.9 + Math.random() * 0.25 });
        }
      }
    }
    for (const [id, mesh] of this.projMeshes) {
      if (!world.projectiles.has(id)) {
        if (this.replayView) { mesh.visible = false; continue; }
        this.scene.remove(mesh);
        mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          (m.material as THREE.Material | undefined)?.dispose();
        });
        this.projMeshes.delete(id);
        this.whizzed.delete(id);
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
    // consumed one-shots and expired loot must leave the SCENE too (this
    // sweep was missing — supply-pod crates ghosted forever once taken)
    for (const [id, mesh] of this.pickupMeshes) {
      if (!world.pickups.has(id)) {
        this.scene.remove(mesh);
        this.pickupMeshes.delete(id);
      }
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
      // FPV drones face their heading; a dead-stick drone tumbles as it falls
      if (g.type === 'drone') {
        if (g.crashing) {
          mesh.rotation.x += dt * 9;
          mesh.rotation.z += dt * 6.5;
        } else {
          mesh.rotation.x = 0;
          mesh.rotation.z = 0;
          if (g.yaw !== undefined) mesh.rotation.y = -g.yaw;
        }
      }
      if (g.type === 'skitter') {
        if (g.yaw !== undefined) mesh.rotation.y = -g.yaw;
        // six legs scurrying — alternating strokes, fast and wrong-looking
        let k = 0;
        for (const c of mesh.children) {
          if (c.name === 'leg') c.rotation.x = (k++ % 2 ? 1 : -1) * Math.sin(world.time * 26 + k) * 0.7;
        }
      }
      // spy cameras pan back and forth, watching
      const camHead = mesh.getObjectByName('camHead');
      if (camHead) camHead.rotation.y = Math.sin(world.time * 0.7 + g.id) * 0.9;
      // smoke drifts and thins as it expires; phosphorus flames flicker
      if (g.type === 'smoke_field') {
        mesh.rotation.y = world.time * 0.35;
        const life = Math.min(1, Math.max(0, (g.expiresAt - world.time) / 3));
        for (const c of mesh.children) {
          if (c.name !== 'puff') continue;
          const mm = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mm.opacity = 0.45 * life;
          c.position.y += dt * 0.25;
        }
      } else if (g.type === 'fire_field') {
        for (let ci = 0; ci < mesh.children.length; ci++) {
          const c = mesh.children[ci];
          if (c.name !== 'flame') continue;
          c.scale.y = 0.8 + 0.4 * Math.sin(world.time * 9 + ci * 1.7);
        }
        // ONE FIRE, ONE LOOK (Robert: "I like the flamethrower look" — an
        // LSW's burning trail should lick the same way the flamethrower does).
        // The wobbling mesh reads static on its own; these are the exact
        // flamethrower flame particles, so every fire in the game — trail,
        // pool, eruption, or gout — flickers alike. Throttled per field.
        if (Math.random() < 0.5) {
          this.particles.emit({
            pos: { x: g.pos.x + (Math.random() - 0.5) * 2.4, y: 0.2, z: g.pos.z + (Math.random() - 0.5) * 2.4 },
            count: 1, color: 0xff7020, speed: 1, life: 0.25, spread: 0.4, up: 1.4, size: 0.4,
          });
        }
      } else if (g.type === 'flare') {
        // decoy sun: sinks slowly, sputters a stream of falling sparks
        const y = Math.max(0.4, 2.4 - (world.time - g.bornAt) * 0.55);
        for (const c of mesh.children) c.position.y = y;
        this.particles.emit({
          pos: { x: g.pos.x, y, z: g.pos.z }, count: 1, color: 0xffa030,
          speed: 1.5, life: 0.45, spread: 0.25, up: 1.2, gravity: 5, size: 0.25,
        });
      }
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

    // §19.2 sound smudges: heard-not-seen noise leaves a fading ring where it
    // happened — rough position, brief life, just enough to aim your caution
    for (let i = this.smudges.length - 1; i >= 0; i--) {
      const sm = this.smudges[i];
      const left = sm.until - world.time;
      const k = Math.max(0, left / 0.7);
      (sm.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.28;
      sm.mesh.scale.setScalar(1 + (1 - k) * 1.1);
      if (left <= 0) {
        this.scene.remove(sm.mesh);
        sm.mesh.geometry.dispose();
        (sm.mesh.material as THREE.Material).dispose();
        this.smudges.splice(i, 1);
      }
    }

    // the blast rings: the disc flashes and dies; the shockwave shoots to the
    // true splash reach, then fades — both stamped to the sim's own radii
    for (let i = this.blastRings.length - 1; i >= 0; i--) {
      const b = this.blastRings[i];
      const age = world.time - b.born;
      const k = Math.max(0, 1 - age / b.life);
      const mat = b.mesh.material as THREE.MeshBasicMaterial;
      if (b.grow) {
        const grow = Math.min(1, age / 0.12); // the shockwave snaps out fast
        b.mesh.scale.setScalar(b.r0 + (b.r1 - b.r0) * grow);
        mat.opacity = b.peak * k;
      } else {
        b.mesh.scale.setScalar(1 + (1 - k) * 0.15); // the disc barely swells
        mat.opacity = b.peak * k * k; // and snaps out
      }
      if (age >= b.life) {
        this.scene.remove(b.mesh); b.mesh.geometry.dispose(); mat.dispose();
        this.blastRings.splice(i, 1);
      }
    }

    // melee claw-arcs sweep outward and vanish fast
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      const left = sl.until - world.time;
      const k = Math.max(0, left / 0.22);
      (sl.mesh.material as THREE.MeshBasicMaterial).opacity = k * 0.55;
      sl.mesh.scale.setScalar(1 + (1 - k) * 0.25);
      if (left <= 0) {
        this.scene.remove(sl.mesh);
        sl.mesh.geometry.dispose();
        (sl.mesh.material as THREE.Material).dispose();
        this.slashes.splice(i, 1);
      }
    }

    // blink afterimages: the snapshot fades where the god just stood — Chronos
    // gold, Voidwalker imploding inward, Specter mirror-flickering
    for (let i = this.blinkGhosts.length - 1; i >= 0; i--) {
      const g = this.blinkGhosts[i];
      const k = (world.time - g.born) / g.ttl;
      if (k >= 1) {
        this.scene.remove(g.mesh);
        g.mesh.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; m?.dispose(); });
        this.blinkGhosts.splice(i, 1);
        continue;
      }
      const fade = 1 - k;
      if (g.style === 'collapse') g.mesh.scale.setScalar((g.mesh.userData.g0 as number) * fade); // implode
      if (g.style === 'flicker') g.mesh.visible = Math.floor(k * 12) % 2 === 0;                   // mirror-flicker
      g.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && 'opacity' in m) m.opacity = fade * 0.6;
      });
    }

    // §BEAMS row 188: HELD streams — while a soldier's beamingUntil holds, a
    // cylinder connects the muzzle to the SAME walked endpoint the sim pours
    // into (same walk, same math — what you see is what damages). The stream
    // shivers, sparks at the impact, and dies ~0.1s after the trigger lifts.
    {
      const pouring = new Set<number>();
      for (const s of world.soldiers.values()) {
        if (s.beamingUntil === undefined || world.time > s.beamingUntil || !s.alive) continue;
        const hdef = WEAPONS[s.weapons[s.weaponIdx]];
        if (!hdef?.held) continue;
        pouring.add(s.id);
        let hm = this.heldBeams.get(s.id);
        if (!hm) {
          const tint = WEAPON_TINTS[hdef.id] ?? (s.ascendant ? LSWS[s.ascendant].color : undefined) ?? TRACER_COLORS.beam;
          hm = new THREE.Mesh(
            new THREE.CylinderGeometry(0.09, 0.15, 1, 6, 1, true),
            new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.85, depthWrite: false }),
          );
          hm.geometry.rotateX(Math.PI / 2); // unit length along +Z: lookAt + scale.z stretches it
          this.scene.add(hm);
          this.heldBeams.set(s.id, hm);
        }
        const fx = Math.cos(s.yaw), fz = Math.sin(s.yaw);
        // §BEAMS row 189: a stream locked in a CLASH pours into the node —
        // both streams draw to it and the style walk is suspended (the sim
        // isn't damaging bodies either; the node eats both).
        let clashPt: { x: number; z: number } | undefined;
        for (const c of world.beamClashes.values()) {
          if (c.aId === s.id || c.bId === s.id) { clashPt = c; break; }
        }
        if (clashPt) {
          const clen = Math.max(0.6, Math.hypot(clashPt.x - s.pos.x, clashPt.z - s.pos.z) - 0.8);
          const cax = s.pos.x + fx * 0.8, caz = s.pos.z + fz * 0.8;
          hm.position.set((cax + clashPt.x) / 2, 1.25, (caz + clashPt.z) / 2);
          hm.scale.set(1 + Math.sin(world.time * 40) * 0.25, 1, clen);
          hm.lookAt(clashPt.x, 1.25, clashPt.z);
          const subsC = this.heldPrismSubs.get(s.id);
          if (subsC) {
            for (const sm of subsC) { this.scene.remove(sm); (sm.material as THREE.Material).dispose(); sm.geometry.dispose(); }
            this.heldPrismSubs.delete(s.id);
          }
          continue; // the clash pass below draws the node itself
        }
        // the SAME style walk the sim pours with: a LANCE's stream drills
        // visibly through its pierce count, a TORRENT catches at its width —
        // the drawn endpoint must never lie about who's drinking.
        const catchR2 = (hdef.held.catchR ?? 1.1) ** 2;
        let drills = hdef.held.pierce ?? 0;
        const seen = new Set<number>();
        let end = hdef.range;
        let nodeE: (typeof s) | undefined; // PRISM: the body the stream stopped in
        walk: for (let d = 1; d <= hdef.range; d += 1) {
          const px = s.pos.x + fx * d, pz = s.pos.z + fz * d;
          if (blocksShot(world.map.grid, px, pz, 1.3)) { end = d; break; }
          // the drawn stream STOPS at a hull, same as the sim's damage walk —
          // the beam no longer visually passes through vehicles
          for (const v of world.vehicles.values()) {
            if (!v.alive || v.team === s.team) continue;
            const vr = (VEHICLES[v.kind]?.radius ?? 2) + 0.4;
            if ((v.pos.x - px) ** 2 + (v.pos.z - pz) ** 2 <= vr * vr) {
              if (drills <= 0) { end = d; break walk; }
              drills--;
              break;
            }
          }
          for (const e of world.soldiers.values()) {
            if (!e.alive || e.team === s.team || seen.has(e.id)) continue;
            const dx = e.pos.x - px, dz = e.pos.z - pz;
            if (dx * dx + dz * dz <= catchR2) {
              seen.add(e.id);
              if (drills <= 0) { end = d; nodeE = e; break walk; }
              drills--;
            }
          }
        }
        // PRISM: fan the SAME nearest-first, id-tiebroken, line-checked picks
        // the sim damages — thin sub-rays from the node to each drinker.
        const subsWanted: { x: number; z: number }[] = [];
        if (hdef.held.prism && nodeE) {
          const pr = hdef.held.prism;
          const cands: { e: typeof s; d2: number }[] = [];
          for (const e of world.soldiers.values()) {
            if (!e.alive || e.team === s.team || e.id === nodeE.id || seen.has(e.id)) continue;
            const dx = e.pos.x - nodeE.pos.x, dz = e.pos.z - nodeE.pos.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= pr.radius * pr.radius) cands.push({ e, d2 });
          }
          cands.sort((a, b) => a.d2 - b.d2 || a.e.id - b.e.id);
          let fans = 0;
          for (const c of cands) {
            if (fans >= pr.count) break;
            if (!losClear(world.map.grid, nodeE.pos, c.e.pos, 1.3)) continue;
            subsWanted.push({ x: c.e.pos.x, z: c.e.pos.z });
            fans++;
          }
        }
        const subs = this.heldPrismSubs.get(s.id) ?? [];
        while (subs.length < subsWanted.length) {
          const sub = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.07, 1, 5, 1, true),
            (hm.material as THREE.MeshBasicMaterial).clone(),
          );
          sub.geometry.rotateX(Math.PI / 2);
          (sub.material as THREE.MeshBasicMaterial).opacity = 0.6;
          this.scene.add(sub);
          subs.push(sub);
        }
        while (subs.length > subsWanted.length) {
          const m = subs.pop()!;
          this.scene.remove(m); (m.material as THREE.Material).dispose(); m.geometry.dispose();
        }
        if (nodeE) subsWanted.forEach((t2, i) => {
          const m = subs[i];
          const len = Math.max(0.4, Math.hypot(t2.x - nodeE!.pos.x, t2.z - nodeE!.pos.z));
          m.position.set((nodeE!.pos.x + t2.x) / 2, 1.15, (nodeE!.pos.z + t2.z) / 2);
          m.scale.set(1, 1, len);
          m.lookAt(t2.x, 1.0, t2.z);
        });
        if (subs.length) this.heldPrismSubs.set(s.id, subs); else this.heldPrismSubs.delete(s.id);
        const ax = s.pos.x + fx * 0.8, az = s.pos.z + fz * 0.8;
        const bx = s.pos.x + fx * end, bz = s.pos.z + fz * end;
        hm.position.set((ax + bx) / 2, 1.25, (az + bz) / 2);
        hm.scale.set(1 + Math.sin(world.time * 31) * 0.15, 1, Math.max(0.6, end - 0.8));
        hm.lookAt(bx, 1.1, bz);
        // IMPACT EYE-CANDY (Robert: "put some eye candy on it like when it
        // hits"): the endpoint SPLASHES — a hot white core spray fanned back
        // toward the wielder plus a throbbing glow bead riding the hit point,
        // so the beam READS as landing somewhere, not just existing.
        const hitCol = (hm.material as THREE.MeshBasicMaterial).color.getHex();
        this.particles.emit({ pos: { x: bx, y: 1.1, z: bz }, count: 3, color: hitCol, speed: 5, life: 0.2, spread: 1.0, up: 1.6, size: 0.34 });
        if (Math.random() < 0.6) {
          this.particles.emit({ pos: { x: bx, y: 1.1, z: bz }, count: 2, color: 0xffffff, speed: 2.5, life: 0.14, spread: 0.5, up: 0.8, size: 0.5 });
        }
        let bead = this.heldBeamBeads.get(s.id);
        if (!bead) {
          bead = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: hitCol, transparent: true, opacity: 0.9, depthWrite: false }));
          this.scene.add(bead); this.heldBeamBeads.set(s.id, bead);
        }
        bead.position.set(bx, 1.1, bz);
        bead.scale.setScalar(0.8 + Math.sin(world.time * 34) * 0.35);
      }
      for (const [sid, m] of this.heldBeams) {
        if (!pouring.has(sid)) {
          this.scene.remove(m);
          (m.material as THREE.Material).dispose(); m.geometry.dispose();
          this.heldBeams.delete(sid);
          const subs2 = this.heldPrismSubs.get(sid);
          if (subs2) {
            for (const sm of subs2) { this.scene.remove(sm); (sm.material as THREE.Material).dispose(); sm.geometry.dispose(); }
            this.heldPrismSubs.delete(sid);
          }
          const bead2 = this.heldBeamBeads.get(sid);
          if (bead2) { this.scene.remove(bead2); (bead2.material as THREE.Material).dispose(); bead2.geometry.dispose(); this.heldBeamBeads.delete(sid); }
        }
      }
      // §BEAMS row 189: the CLASH NODES — a white-hot knot where two streams
      // meet, throbbing hard, hemorrhaging sparks. Lives exactly as long as
      // the sim's clash does.
      const liveClash = new Set<string>();
      for (const [key, c] of world.beamClashes) {
        liveClash.add(key);
        let nm = this.clashNodes.get(key);
        if (!nm) {
          nm = new THREE.Mesh(
            new THREE.SphereGeometry(0.55, 10, 8),
            new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0.95, depthWrite: false }),
          );
          this.scene.add(nm);
          this.clashNodes.set(key, nm);
        }
        nm.position.set(c.x, 1.25, c.z);
        const throb = 1 + Math.sin(world.time * 26) * 0.3;
        nm.scale.setScalar(throb);
        if (Math.random() < 0.7) {
          this.particles.emit({ pos: { x: c.x, y: 1.25, z: c.z }, count: 3, color: 0xffe9a0, speed: 6, life: 0.25, spread: 1.2, up: 2, size: 0.32 });
        }
      }
      for (const [key, nm] of this.clashNodes) {
        if (!liveClash.has(key)) {
          this.scene.remove(nm); (nm.material as THREE.Material).dispose(); nm.geometry.dispose();
          this.clashNodes.delete(key);
        }
      }
    }

    // orbital beams fade out (k clamped: replay clocks run behind live time)
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      const mm = b.mesh.material as THREE.MeshStandardMaterial;
      const k = Math.min(1, Math.max(0, (b.until - world.time) / 0.9));
      mm.opacity = k * 0.85;
      b.mesh.scale.x = b.mesh.scale.z = 1 + (1 - k) * 0.6;
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

    // ---- sensor sweeps expand and fade (k clamped for replay clocks) ----
    for (let i = this.sweepRings.length - 1; i >= 0; i--) {
      const sw = this.sweepRings[i];
      const age = world.time - sw.born;
      const k = Math.min(1, Math.max(0, age / 1.6)); // full 28u radius as it dies
      sw.mesh.scale.setScalar(1 + k * 27);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      if (k >= 1) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.sweepRings.splice(i, 1);
      }
    }
    // UI P0 (docs/UI-MASTER.md §7): THE LSW DROP has a place — each pending
    // god marks its LZ with a pulsing ground ring that TIGHTENS as the pod
    // falls (the dread made spatial; both teams see it, that's the point).
    {
      const live = new Set<string>();
      const localTeamNow = world.soldiers.get(localId)?.team;
      for (const p of world.pendingLsw ?? []) {
        const key = `${p.team}:${p.landsAt.toFixed(2)}`;
        live.add(key);
        let ring = this.lzRings.get(key);
        if (!ring) {
          ring = new THREE.Mesh(
            new THREE.RingGeometry(0.88, 1.0, 40),
            new THREE.MeshBasicMaterial({
              color: p.team === localTeamNow ? 0xe8a33d : 0xff4736,
              transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false,
            }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(p.pos.x, 0.06, p.pos.z);
          this.scene.add(ring);
          this.lzRings.set(key, ring);
        }
        const left = Math.max(0, p.landsAt - world.time);
        ring.scale.setScalar(2.2 + Math.min(1, left / 30) * 5.5); // tightens as it falls
        (ring.material as THREE.MeshBasicMaterial).opacity =
          0.3 + 0.3 * Math.abs(Math.sin(world.time * (left < 5 ? 9 : 3))); // panic-pulse at T-5
      }
      for (const [key, ring] of this.lzRings) {
        if (live.has(key)) continue;
        this.scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
        this.lzRings.delete(key);
      }
    }
    // ✦ sonic-boom rings: snap out fast, shred as they die (0.4s life)
    for (let i = this.boomRings.length - 1; i >= 0; i--) {
      const br = this.boomRings[i];
      const k = Math.min(1, Math.max(0, (world.time - br.born) / 0.4));
      br.mesh.scale.setScalar(1 + k * 4.5);
      (br.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k) * (1 - k);
      if (k >= 1) {
        this.scene.remove(br.mesh);
        br.mesh.geometry.dispose();
        (br.mesh.material as THREE.Material).dispose();
        this.boomRings.splice(i, 1);
      }
    }
    // drop ECM rings whose vehicles died or despawned
    for (const [vid, ring] of this.ecmRings) {
      const v = world.vehicles.get(vid);
      if (!v || !v.alive) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        (ring.material as THREE.Material).dispose();
        this.ecmRings.delete(vid);
      }
    }

    // ---- revealed enemies wear a red chevron (visible through walls) ----
    for (const s of world.soldiers.values()) {
      const revealed = s.alive && s.team !== localTeam && world.pinged.has(s.id);
      let marker = this.pingMarkers.get(s.id);
      if (revealed && !marker) {
        marker = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.getPingTexture(), transparent: true, depthTest: false, depthWrite: false,
        }));
        marker.scale.set(0.9, 0.9, 1);
        marker.renderOrder = 998;
        this.scene.add(marker);
        this.pingMarkers.set(s.id, marker);
      }
      if (marker) {
        marker.visible = revealed;
        if (revealed) {
          marker.position.set(s.pos.x, s.pos.y + 2.6 + Math.sin(world.time * 4) * 0.12, s.pos.z);
          marker.material.opacity = 0.75 + 0.25 * Math.sin(world.time * 5);
        }
      }
    }
    for (const [id, marker] of this.pingMarkers) {
      if (!world.soldiers.has(id)) {
        this.scene.remove(marker);
        marker.material.dispose();
        this.pingMarkers.delete(id);
      }
    }

    // ---- tactical waypoints: amber light pillars on the field ----
    // (live-time overlays don't belong in a replayed scene)
    if (this.replayView) {
      for (const pillar of this.wpPillars) if (pillar) pillar.visible = false;
    } else if (waypoints) {
      for (let i = 0; i < Math.min(waypoints.length, 8); i++) {
        let pillar = this.wpPillars[i];
        if (!pillar) {
          pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.5, 9, 10, 1, true),
            new THREE.MeshBasicMaterial({
              color: 0xffd870, transparent: true, opacity: 0.4,
              side: THREE.DoubleSide, depthWrite: false,
            }),
          );
          this.scene.add(pillar);
          this.wpPillars[i] = pillar;
        }
        const wp = waypoints[i];
        const left = wp.until - world.time;
        pillar.visible = left > 0;
        pillar.position.set(wp.x, 4.5, wp.z);
        (pillar.material as THREE.MeshBasicMaterial).opacity =
          Math.min(0.42, Math.max(0.08, left / 10)) * (0.8 + 0.2 * Math.sin(world.time * 3 + i));
      }
      for (let i = waypoints.length; i < this.wpPillars.length; i++) {
        if (this.wpPillars[i]) this.wpPillars[i].visible = false;
      }
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

    // missile-lock warning: a heat-seeker is homing on YOUR aircraft
    if (local && local.vehicleId >= 0 && world.time >= this.nextLockToneAt) {
      for (const p of world.projectiles.values()) {
        if (p.homingVehicleId === local.vehicleId) {
          this.nextLockToneAt = world.time + 0.6;
          audio.play('beacon', { volume: 0.35 });
          break;
        }
      }
    }

    // camera follow: wheel-zoomable, and it leads toward where you're aiming —
    // you see more of the fight ahead and less of the ground behind you.
    // Flying an FPV drone hands the camera to the drone: you ARE the feed.
    // killcam duel: frame the victim AND the killer, so every death answers
    // "where did that come from?" — midpoint camera, zoomed to fit both
    const killer = this.replayView && this.killcamFocusId >= 0 && local
      ? world.soldiers.get(this.killcamFocusId) : undefined;
    const duel = killer && killer.id !== localId ? killer : undefined;
    if (this.killerRing) {
      this.killerRing.visible = !!duel;
      if (duel) {
        this.killerRing.position.set(duel.pos.x, 0.12, duel.pos.z);
        const pulse = 1 + 0.18 * Math.sin(world.time * 5);
        this.killerRing.scale.setScalar(pulse);
      }
    } else if (duel) {
      this.killerRing = this.makeRing(duel.pos, 2.1, 0xff4040, 0.85);
    }
    if (local) {
      const fpv = world.getPilotedDrone(localId);
      const focusPos = fpv ? fpv.pos : local.pos;
      const focusYaw = fpv ? (fpv.yaw ?? local.yaw) : local.yaw;
      const inVehicle = local.vehicleId >= 0;
      let dist = (window as unknown as { __camDist?: number }).__camDist
        ?? this.camDist * (inVehicle ? 1.25 : 1) * (fpv ? 0.75 : 1);
      const lead = dist * 0.32; // how far the view shifts toward your facing
      this.lookAhead.lerp(
        duel ? new THREE.Vector3(0, 0, 0) // duel view: no aim-lead, hold the pair
          : new THREE.Vector3(Math.cos(focusYaw) * lead, 0, Math.sin(focusYaw) * lead),
        1 - Math.pow(0.005, dt), // eases so flick-aims don't yank the world
      );
      let target = new THREE.Vector3(
        focusPos.x + this.lookAhead.x, 0, focusPos.z + this.lookAhead.z);
      if (duel) {
        // midpoint between corpse and killer, pulled out just enough to fit both
        const sep = Math.hypot(duel.pos.x - local.pos.x, duel.pos.z - local.pos.z);
        dist = Math.min(46, Math.max(dist, sep * 0.85 + 6));
        target = new THREE.Vector3(
          (local.pos.x + duel.pos.x) / 2 + this.lookAhead.x, 0,
          (local.pos.z + duel.pos.z) / 2 + this.lookAhead.z);
      }
      const desired = new THREE.Vector3(target.x, dist, target.z + dist * 0.55);
      this.viewDist = dist; // overhead UI scales against the height actually flown
      this.camPos.lerp(desired, 1 - Math.pow(0.001, dt));
      if (settings.reducedMotion) this.camShake = 0; // §18 comfort valve
      if (this.camShake > 0) {
        this.camPos.x += (Math.random() - 0.5) * this.camShake;
        this.camPos.z += (Math.random() - 0.5) * this.camShake;
        this.camShake = Math.max(0, this.camShake - dt * 2.5);
      }
      // KNOCKBACK KICK: when a blast shoves YOU, the camera rides the shove.
      // The sim's push impulse already decays e^-5t, so borrowing it directly
      // gives a kick-and-settle with no extra state — the view lurches the way
      // your boots do and recovers exactly as fast.
      if (!settings.reducedMotion && (local.pushX !== 0 || local.pushZ !== 0)) {
        this.camPos.x += local.pushX * 0.055;
        this.camPos.z += local.pushZ * 0.055;
      }
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(target);
      // replays must not drag the audio listener to your PAST position —
      // any remaining live sounds (UI, killfeed) stay panned to the present
      if (!this.replayView) audio.listener = { x: local.pos.x, y: 0, z: local.pos.z };
    }

    this.particles.update(dt);
    this.flashes.update(world.time, dt);
    this.fireballs.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  /** Skeletal-ish animation driven straight from sim state. */
  /** The signature aura, fed every frame the LSW is alive (Robert: "the fire
   *  — I want them to look like they're on fire. When they shoot energy
   *  blasts, shoot it"). Pure particles on the shipped emitter — flame licks
   *  up a Firebrand, poison motes drift off a Plaguebearer. */
  private lswAura(mesh: THREE.Group, s: Soldier, world: World) {
    const id = mesh.userData.lsw as string | undefined;
    if (!id || !s.alive || this.replayView) return;
    if ((world.tick + s.id) % 2 !== 0) return; // every other frame — plenty
    if (id === 'firebrand') {
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.4 + Math.random() * 1.6, z: s.pos.z }, count: 2,
        color: Math.random() < 0.5 ? 0xff5a12 : 0xffb038, speed: 1.2, life: 0.5,
        spread: 0.5, up: 3.5, gravity: -4, size: 0.5,
      });
    } else if (id === 'plaguebearer') {
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.6 + Math.random() * 1.4, z: s.pos.z }, count: 1,
        color: 0x8fbe42, speed: 0.6, life: 0.9, spread: 0.7, up: 1.2, gravity: 1, size: 0.6,
      });
    } else if (id === 'frostbite') {
      // cold fog rolling off him, and frost crystals drifting DOWN
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.3 + Math.random() * 1.4, z: s.pos.z }, count: 1,
        color: 0xcdeef7, speed: 0.5, life: 1.0, spread: 0.8, up: 0.3, gravity: 2, size: 0.55,
      });
    } else if (id === 'ragebeast') {
      // embers of fury — hotter and thicker the more wounded he is
      const fury = 1 - s.hp / s.maxHp;
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.4 + Math.random() * 1.6, z: s.pos.z }, count: fury > 0.5 ? 2 : 1,
        color: 0xd83a1a, speed: 1.4, life: 0.4, spread: 0.6, up: 2.5, gravity: -3, size: 0.4,
      });
    } else if (id === 'titan') {
      // dust and grit kicked up around a walking mountain — heavy motes that
      // hang low and drift DOWN (positive gravity), stone and shadow
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.2 + Math.random() * 1.3, z: s.pos.z }, count: 1,
        color: Math.random() < 0.5 ? 0x9a8466 : 0x7a6a52, speed: 0.5, life: 1.1,
        spread: 0.9, up: 0.6, gravity: 2, size: 0.6,
      });
    } else if (id === 'voltstriker') {
      // crackling sparks — bright, quick, jittering off him
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: 0.6 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) }, count: 2,
        color: Math.random() < 0.5 ? 0xf5f06a : 0xffffff, speed: 2.0, life: 0.25,
        spread: 0.8, up: 1.5, gravity: 0, size: 0.28,
      });
    } else if (id === 'sniperhawk') {
      // a cold scope-glint — sparse, sharp, steel-cyan, up near the optic
      this.particles.emit({
        pos: { x: s.pos.x, y: 1.2 + Math.random() * 0.8, z: s.pos.z }, count: 1,
        color: 0x9fe0ee, speed: 0.3, life: 0.5, spread: 0.3, up: 0.4, gravity: 0, size: 0.22,
      });
    } else if (id === 'barrier') {
      // a steady emerald shimmer — the field that holds the line
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.5 + Math.random() * 1.5, z: s.pos.z }, count: 1,
        color: 0x3fd9a0, speed: 0.4, life: 0.7, spread: 0.6, up: 0.5, gravity: 0, size: 0.35,
      });
    } else if (id === 'reactor') {
      // radiant golden energy rising off an unstable core
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.5 + Math.random() * 1.6, z: s.pos.z }, count: 2,
        color: Math.random() < 0.5 ? 0xffb020 : 0xffe07a, speed: 1.0, life: 0.5,
        spread: 0.5, up: 2.0, gravity: -1, size: 0.3,
      });
    } else if (id === 'oblivion') {
      // the void — black and white motes drifting IN toward him, no purple
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.6 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0x0a0a12 : 0xe6ecf2, speed: 0.6, life: 0.8,
        spread: 0.4, up: 0.2, gravity: 0.4, size: 0.34,
      });
    } else if (id === 'tremor') {
      // dirt and grit shaken loose low to the ground, falling back down
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.1 + Math.random() * 0.8, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0xa05a2a : 0x6a4520, speed: 0.5, life: 0.7,
        spread: 0.7, up: 0.8, gravity: 1.5, size: 0.4,
      });
    } else if (id === 'magnetar') {
      // metal debris orbiting him in a tight ring — the halo that eats bullets
      const a = world.time * 3 + s.id;
      this.particles.emit({
        pos: { x: s.pos.x + Math.cos(a) * 1.6, y: 1.0 + Math.sin(a * 1.7) * 0.6, z: s.pos.z + Math.sin(a) * 1.6 }, count: 1,
        color: Math.random() < 0.5 ? 0x9aa2ae : 0x5a6270, speed: 0.2, life: 0.4, spread: 0.2, up: 0, gravity: 0, size: 0.24,
      });
    } else if (id === 'wraith') {
      // spectral wisps rising off him — pale, slow, ghostly
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: 0.5 + Math.random() * 1.8, z: s.pos.z + (Math.random() - 0.5) }, count: 1,
        color: Math.random() < 0.5 ? 0x8fd0b0 : 0xd8f0e4, speed: 0.4, life: 1.0, spread: 0.5, up: 1.0, gravity: -0.5, size: 0.4,
      });
    } else if (id === 'eclipse') {
      // darkness pooling around her — big, dark, slow motes swallowing the light
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.6, y: 0.4 + Math.random() * 1.8, z: s.pos.z + (Math.random() - 0.5) * 1.6 }, count: 1,
        color: Math.random() < 0.5 ? 0x1a222a : 0x3d5566, speed: 0.4, life: 0.9, spread: 0.6, up: 0.3, gravity: 0.3, size: 0.5,
      });
    } else if (id === 'riptide') {
      // sea spray — teal and whitecap mist curling off him
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.2, y: 0.3 + Math.random() * 1.4, z: s.pos.z + (Math.random() - 0.5) * 1.2 }, count: 1,
        color: Math.random() < 0.5 ? 0x2fa8c8 : 0xdff4fa, speed: 0.7, life: 0.7,
        spread: 0.7, up: 1.0, gravity: 1, size: 0.38,
      });
    } else if (id === 'gravwarden') {
      // motes falling UP — the local law of gravity, repealed
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.1 + Math.random() * 0.6, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0x9fc4e8 : 0xe8f2fa, speed: 0.3, life: 0.9,
        spread: 0.3, up: 2.2, gravity: -2.5, size: 0.3,
      });
    } else if (id === 'chronos') {
      // clockwork brass shimmer — and THE ECHO GLOW: his 3s-old breadcrumb
      // burns gold on the ground (camp it — that's where a dead man returns)
      this.particles.emit({
        pos: { x: s.pos.x, y: 0.6 + Math.random() * 1.4, z: s.pos.z }, count: 1,
        color: 0xc8a24b, speed: 0.5, life: 0.6, spread: 0.5, up: 0.8, gravity: 0, size: 0.3,
      });
      const crumb = s.lswTrail?.[0];
      if (crumb && !s.lswFlagA) {
        this.particles.emit({
          pos: { x: crumb.x, y: 0.2, z: crumb.z }, count: 1,
          color: 0xffd870, speed: 0.2, life: 0.5, spread: 0.4, up: 0.6, gravity: 0, size: 0.35,
        });
      }
    } else if (id === 'venatrix') {
      // dry-leaf motes and a faint brass wink — the hunter's stillness
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.2, y: 0.2 + Math.random() * 1.0, z: s.pos.z + (Math.random() - 0.5) * 1.2 }, count: 1,
        color: Math.random() < 0.6 ? 0x8f9e3a : 0xd8c86a, speed: 0.3, life: 0.7, spread: 0.5, up: 0.5, gravity: 0.8, size: 0.26,
      });
    } else if (id === 'vanguard') {
      // brass sparks skittering off the raised shield
      this.particles.emit({
        pos: { x: s.pos.x + Math.cos(s.yaw) * 0.8, y: 0.8 + Math.random() * 0.8, z: s.pos.z + Math.sin(s.yaw) * 0.8 }, count: 1,
        color: 0xe8d47a, speed: 1.2, life: 0.3, spread: 0.5, up: 0.8, gravity: 2, size: 0.22,
      });
    } else if (id === 'pyroclasm') {
      // magma seeping — heavy orange gobbets that FALL and linger
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.2, y: 0.4 + Math.random() * 1.4, z: s.pos.z + (Math.random() - 0.5) * 1.2 }, count: 1,
        color: Math.random() < 0.5 ? 0xff8c2a : 0xffc24a, speed: 0.5, life: 0.8, spread: 0.4, up: 0.4, gravity: 3, size: 0.4,
      });
    } else if (id === 'voidwalker') {
      // shreds of shadow trailing off him — dark, quick, gone
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: 0.4 + Math.random() * 1.4, z: s.pos.z + (Math.random() - 0.5) }, count: 1,
        color: Math.random() < 0.7 ? 0x14171d : 0x3a4150, speed: 0.8, life: 0.4, spread: 0.8, up: 0.3, gravity: 0, size: 0.3,
      });
    } else if (id === 'crimson') {
      // a fine red mist drawn INWARD — the field feeding him
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.6, y: 0.3 + Math.random() * 1.2, z: s.pos.z + (Math.random() - 0.5) * 1.6 }, count: 1,
        color: Math.random() < 0.6 ? 0xa11d2e : 0x5c0f18, speed: 0.5, life: 0.6, spread: 0.3, up: 0.4, gravity: 0.5, size: 0.28,
      });
    } else if (id === 'mirage') {
      // heat shimmer — gold air bending around something not quite there
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: 0.5 + Math.random() * 1.5, z: s.pos.z + (Math.random() - 0.5) }, count: 1,
        color: 0xd8b84a, speed: 0.4, life: 0.5, spread: 0.6, up: 0.9, gravity: -0.5, size: 0.24,
      });
    } else if (id === 'blitz') {
      // speed lines — pale streaks shed behind his motion
      this.particles.emit({
        pos: { x: s.pos.x - s.vel.x * 0.08, y: 0.6 + Math.random() * 1.0, z: s.pos.z - s.vel.z * 0.08 }, count: 1,
        color: 0xe8e2d0, speed: 0.3, life: 0.3, spread: 0.3, up: 0.2, gravity: 0, size: 0.26,
      });
    } else if (id === 'shadowstep') {
      // barely there — a thin dark wisp only when he moves
      if (Math.hypot(s.vel.x, s.vel.z) > 1) this.particles.emit({
        pos: { x: s.pos.x, y: 0.4 + Math.random(), z: s.pos.z }, count: 1,
        color: 0x2c342c, speed: 0.3, life: 0.35, spread: 0.4, up: 0.3, gravity: 0, size: 0.22,
      });
    } else if (id === 'specter') {
      // mirror-fog — silvered motes that flicker in and out
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.5 + Math.random() * 1.4, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0xbcc7cf : 0xe8eef2, speed: 0.4, life: 0.4, spread: 0.6, up: 0.5, gravity: 0, size: 0.24,
      });
    } else if (id === 'pulse') {
      // sonar rings — teal motes pushed OUTWARD in beats
      const beat = Math.floor(world.time * 2) % 2 === 0;
      if (beat) this.particles.emit({
        pos: { x: s.pos.x, y: 1.0, z: s.pos.z }, count: 2,
        color: 0x5adfd0, speed: 2.4, life: 0.4, spread: 1.0, up: 0.1, gravity: 0, size: 0.22,
      });
    } else if (id === 'venom') {
      // toxin drip — green beads that fall and sizzle
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.2, y: 0.6 + Math.random() * 1.2, z: s.pos.z + (Math.random() - 0.5) * 1.2 }, count: 1,
        color: Math.random() < 0.6 ? 0x7fd43a : 0xb8f06a, speed: 0.4, life: 0.6, spread: 0.3, up: 0.2, gravity: 2.5, size: 0.26,
      });
    } else if (id === 'nightmare') {
      // the darkness with edges — near-black motes that eat the light around him
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.6, y: 0.4 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) * 1.6 }, count: 1,
        color: Math.random() < 0.7 ? 0x10141c : 0x3a4356, speed: 0.5, life: 0.7, spread: 0.5, up: 0.4, gravity: 0.2, size: 0.36,
      });
    } else if (id === 'reaper') {
      // grave-cold wisps trailing off the scythe arm
      this.particles.emit({
        pos: { x: s.pos.x + Math.cos(s.yaw) * 0.7, y: 0.9 + Math.random() * 0.9, z: s.pos.z + Math.sin(s.yaw) * 0.7 }, count: 1,
        color: Math.random() < 0.5 ? 0x8a8f98 : 0xc6ccd6, speed: 0.4, life: 0.5, spread: 0.4, up: 0.5, gravity: 0.5, size: 0.26,
      });
    } else if (id === 'leviathan') {
      // the ground remembers every footfall — dust rings at his feet
      if (Math.hypot(s.vel.x, s.vel.z) > 0.5 || s.pos.y > 0.5) this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 2, y: 0.15, z: s.pos.z + (Math.random() - 0.5) * 2 }, count: 2,
        color: Math.random() < 0.5 ? 0x3f6e6a : 0x6a5c48, speed: 0.7, life: 0.6, spread: 1.0, up: 0.4, gravity: 2, size: 0.3,
      });
    } else if (id === 'cataclysm') {
      // basalt splitting — ember seams glow through the cracks
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.3 + Math.random() * 1.4, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0xff7a30 : 0x7a4a30, speed: 0.5, life: 0.5, spread: 0.5, up: 0.5, gravity: 1, size: 0.26,
      });
    } else if (id === 'inferno') {
      // a body that is partly fire — embers stream off him, more in a dive
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: s.pos.y + 0.5 + Math.random() * 1.2, z: s.pos.z + (Math.random() - 0.5) }, count: 2,
        color: Math.random() < 0.6 ? 0xff6a2a : 0xffc23a, speed: 1.2, life: 0.45, spread: 0.7, up: 1.4, gravity: -1, size: 0.26,
      });
    } else if (id === 'stormcaller') {
      // static skitters around her — the air itself is charged
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.6, y: s.pos.y + 0.4 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) * 1.6 }, count: 1,
        color: Math.random() < 0.6 ? 0x9fd8ff : 0xffffff, speed: 2.0, life: 0.18, spread: 0.9, up: 0.6, gravity: 0, size: 0.2,
      });
    } else if (id === 'gargoyle') {
      // grit sifting off stone skin — heavier when he moves
      if (Math.hypot(s.vel.x, s.vel.z) > 0.5 || Math.random() < 0.3) this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: s.pos.y + 0.3 + Math.random(), z: s.pos.z + (Math.random() - 0.5) }, count: 1,
        color: Math.random() < 0.5 ? 0x8d8578 : 0x6e675c, speed: 0.4, life: 0.5, spread: 0.5, up: -0.2, gravity: 3, size: 0.22,
      });
    } else if (id === 'phantom') {
      // the hover: pale motes sinking away beneath a body that never touches down
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 0.8, y: 0.15, z: s.pos.z + (Math.random() - 0.5) * 0.8 }, count: 1,
        color: Math.random() < 0.7 ? 0xd9e4e6 : 0x9fb8bc, speed: 0.3, life: 0.7, spread: 0.3, up: -0.4, gravity: 0, size: 0.2,
      });
    } else if (id === 'crusher') {
      // quarry dust shaken off with every stride
      if (Math.hypot(s.vel.x, s.vel.z) > 1) this.particles.emit({
        pos: { x: s.pos.x, y: 0.2 + Math.random() * 0.8, z: s.pos.z }, count: 1,
        color: Math.random() < 0.5 ? 0xb0783a : 0x8a5f2e, speed: 0.5, life: 0.6, spread: 0.7, up: 0.6, gravity: 2, size: 0.34,
      });
    } else if (id === 'steelweaver') {
      // weld sparks skittering off the worn panels
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5), y: 0.7 + Math.random() * 1.1, z: s.pos.z + (Math.random() - 0.5) }, count: 1,
        color: Math.random() < 0.5 ? 0xffd88a : 0x9aa4b0, speed: 1.4, life: 0.25, spread: 0.6, up: 0.8, gravity: 3, size: 0.2,
      });
    } else if (id === 'overload') {
      // live-wire arcs snapping around him — amber, quick, angry
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.2, y: 0.4 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) * 1.2 }, count: 2,
        color: Math.random() < 0.6 ? 0xffd23a : 0xfff2b0, speed: 2.2, life: 0.2, spread: 0.9, up: 1.0, gravity: 0, size: 0.22,
      });
    } else if (id === 'dominator') {
      // crimson psychic tendrils reaching up and out — the puppeteer's threads
      this.particles.emit({
        pos: { x: s.pos.x + (Math.random() - 0.5) * 1.4, y: 0.8 + Math.random() * 1.6, z: s.pos.z + (Math.random() - 0.5) * 1.4 }, count: 1,
        color: Math.random() < 0.5 ? 0xd83a5a : 0xf07a92, speed: 0.5, life: 0.6, spread: 0.5, up: 1.2, gravity: -0.5, size: 0.3,
      });
    }
    // the LSW's VOICE: an Ascendant is an event you can HEAR coming. A
    // per-unit signature on a throttle (roar/hiss/whoosh), and it gets more
    // insistent as Ragebeast bleeds. Frostbite's voice is the freeze event.
    const nextVoice = (mesh.userData.nextVoice as number | undefined) ?? 0;
    if (world.time >= nextVoice) {
      const roar = id === 'ragebeast', hiss = id === 'plaguebearer', whoosh = id === 'firebrand';
      const snd = roar ? 'ragebeast_growl' : hiss ? 'gas_hiss' : whoosh ? 'fire_whoosh' : null; // Robert's custom growl on the fury cadence

      if (snd) {
        const gap = roar ? 3.5 - (1 - s.hp / s.maxHp) * 1.8 : 4 + Math.random() * 2;
        mesh.userData.nextVoice = world.time + gap;
        audio.play(snd as SoundName, { pos: s.pos, volume: roar ? 0.7 : 0.5 });
      } else {
        mesh.userData.nextVoice = world.time + 5;
      }
    }
  }

  /** An encased soldier is a block of ice — a translucent cyan box over the
   *  frozen body, pooled per soldier. (§21.6 the ice block.) The ice ITSELF is
   *  the break meter (UI-MASTER §6): a crack web rides the block and spreads
   *  with your struggle (0→1), so anyone can read how close it is to going. */
  private iceBlocks = new Map<number, THREE.Mesh>();
  private updateIceBlock(s: Soldier) {
    let ice = this.iceBlocks.get(s.id);
    const encased = s.encasedUntil !== undefined && s.alive;
    if (encased && !ice) {
      ice = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 2.3, 1.7),
        new THREE.MeshStandardMaterial({
          color: 0xafe6f5, emissive: 0x4a9fc4, emissiveIntensity: 0.35,
          transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0.05, depthWrite: false,
        }),
      );
      // the crack web — invisible at struggle 0, a full fracture as it nears 1
      const cracks = new THREE.LineSegments(
        this.makeIceCrackGeo(),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
      );
      cracks.name = 'cracks';
      ice.add(cracks);
      this.scene.add(ice);
      this.iceBlocks.set(s.id, ice);
    }
    if (ice) {
      const wasVisible = ice.visible;
      ice.visible = encased;
      if (encased) {
        ice.position.set(s.pos.x, 1.15, s.pos.z);
        // THE ICE IS THE METER: cracks bloom with the mash, and the block
        // stresses brighter as it's about to give (emissive climbs).
        const frac = Math.min(1, s.struggle ?? 0);
        const cracks = ice.getObjectByName('cracks') as THREE.LineSegments | undefined;
        if (cracks) (cracks.material as THREE.LineBasicMaterial).opacity = frac * 0.9;
        (ice.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + frac * 0.5;
      } else if (wasVisible && !this.replayView) {
        // the block just broke — shatter shards + a glassy crack
        this.particles.emit({ pos: { x: s.pos.x, y: 1.2, z: s.pos.z }, count: 20, color: 0xcdeef7, speed: 6, life: 0.5, spread: 0.7, up: 3, gravity: 9, size: 0.2 });
        audio.play('ice_shatter', { pos: s.pos, volume: 0.75 });
      }
    }
    // THE DRAIN CHOICE (UI-MASTER §6): only YOU can act on your own block, so
    // the two ways out float over your body while you're frozen — MASH to
    // shatter it (costs hp) or HOLD to wait out the melt (bleeds slowly).
    if (s.id === this.localId) {
      if (encased) {
        if (!this.encaseHint) this.encaseHint = this.makeEncaseHint();
        this.encaseHint.position.set(s.pos.x, s.pos.y + 2.75, s.pos.z);
        this.encaseHint.visible = true;
      } else if (this.encaseHint) {
        this.encaseHint.visible = false;
      }
    }
  }

  /** A jagged fracture web across the four vertical faces of the ice box,
   *  authored once per block in the box's own local space (renderer-side, so
   *  Math.random is fine — it never touches the sim). Revealed by opacity. */
  private makeIceCrackGeo(): THREE.BufferGeometry {
    const pts: number[] = [];
    const hw = 0.85, hh = 1.15, hd = 0.85;
    const faces: { axis: 'z' | 'x'; s: number }[] = [
      { axis: 'z', s: 1 }, { axis: 'z', s: -1 }, { axis: 'x', s: 1 }, { axis: 'x', s: -1 },
    ];
    for (const f of faces) {
      for (let root = 0; root < 2; root++) {
        let u = (Math.random() - 0.5) * 1.6, v = (Math.random() - 0.5) * 1.8; // normalized on the face
        const segs = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < segs; i++) {
          const nu = Math.max(-0.98, Math.min(0.98, u + (Math.random() - 0.5) * 0.8));
          const nv = Math.max(-0.98, Math.min(0.98, v + (Math.random() - 0.5) * 0.8));
          const p0 = f.axis === 'z' ? [hw * u, hh * v, f.s * hd] : [f.s * hw, hh * v, hd * u];
          const p1 = f.axis === 'z' ? [hw * nu, hh * nv, f.s * hd] : [f.s * hw, hh * nv, hd * nu];
          pts.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2]);
          u = nu; v = nv;
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }

  /** The static two-line drain-choice label over your own ice block. Numbers
   *  are the sim's own (STRUGGLE_HP / ICE_HOLD_DRAIN) so the readout can't lie. */
  private makeEncaseHint(): THREE.Sprite {
    const cvs = document.createElement('canvas'); cvs.width = 256; cvs.height = 96;
    const ctx = cvs.getContext('2d')!;
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const line = (text: string, y: number, fill: string) => {
      ctx.font = '700 22px Inter, system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.72)'; ctx.lineWidth = 4; ctx.strokeText(text, 128, y);
      ctx.fillStyle = fill; ctx.fillText(text, 128, y);
    };
    line('❄ ENCASED', 24, '#8fd0ff');
    line(`MASH — BREAK −${STRUGGLE_HP}`, 54, '#e8a33d');       // house amber (the active out)
    line(`HOLD — BLEED ${ICE_HOLD_DRAIN}/s`, 82, '#a7b0b8');   // steel (the patient out)
    const tex = new THREE.CanvasTexture(cvs);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.userData.uiOverlay = true;
    sprite.scale.set(2.2, 0.82, 1);
    this.scene.add(sprite);
    return sprite;
  }

  /** EMBODIMENT (Task 4): play an LSW's attack pose when it fires or swings.
   *  Sustained poses (channel/shoulder — beams, launchers) hold while firing;
   *  one-shot poses (slam/thrust/lob/brace/flick) fire once per motion — a
   *  melee windup sets it and the strike that follows finds it live and doesn't
   *  restart it, so the swing telegraphs before it lands. Shares the castPoses
   *  map with the signature power-cast, so there's one pose code path. */
  private setLswPose(s: Soldier, now: number) {
    const asc = s.ascendant;
    if (!asc) return;
    const pose = LSWS[asc].attackPose;
    if (!pose) return;
    const school = POSE_TO_SCHOOL[pose];
    const sustained = school === 'channel' || school === 'shoulder';
    const cur = this.castPoses.get(s.id);
    if (cur && now < cur.until) {
      if (sustained) cur.until = Math.max(cur.until, now + 0.4); // keep the channel held out
      return; // one motion at a time — never restart a pose already playing
    }
    this.castPoses.set(s.id, { at: now, until: now + 0.42, school });
  }

  /** Drop all time-based per-entity transients (poses, recoil, telegraphs).
   *  Call when a fresh World replaces the old one (the harness re-pick) so no
   *  entry keyed by a reused soldier id renders against the new world's clock —
   *  otherwise a leftover pose plays with a negative envelope on the newcomer. */
  resetTransient(): void {
    this.castPoses.clear();
    this.throwPoses.clear();
    this.meleeTelegraphs.clear();
    this.recoilAt.clear();
    this.vehRecoilAt.clear();
  }

  /** Blink afterimage: leave a fading snapshot of the body where it just was.
   *  style tints + drives the fade — gold (Chronos), collapse (Voidwalker
   *  implodes inward), flicker (Specter mirror-flickers). Cloned materials go
   *  transparent so the fade never touches the live body. */
  private spawnBlinkGhost(src: THREE.Group, x: number, z: number, now: number, style: 'gold' | 'collapse' | 'flicker', tint: number) {
    const ghost = src.clone(true);
    ghost.userData = { g0: ghost.scale.x };
    ghost.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) { o.visible = false; return; } // no ghost nameplates
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m) {
        const c = m.clone();
        c.transparent = true; c.opacity = 0.6; c.depthWrite = false;
        if ('emissive' in c) { c.emissive = new THREE.Color(tint); c.emissiveIntensity = 0.6; }
        if (c.color) c.color.lerp(new THREE.Color(tint), 0.4);
        (o as THREE.Mesh).material = c;
      }
    });
    ghost.position.set(x, src.position.y, z);
    this.scene.add(ghost);
    this.blinkGhosts.push({ mesh: ghost, born: now, ttl: 0.3, style });
  }

  private animateSoldier(mesh: THREE.Group, s: Soldier, world: World) {
    const j = mesh.userData.joints as Record<string, THREE.Object3D | undefined>;
    const t = world.time;
    const zed = isUndead(s.kind);
    const speed = Math.hypot(s.vel.x, s.vel.z);
    const moving = speed > 0.6;

    // ---- death: ragdoll collapse + fade out ----
    // YOUR cloak reads at 0.5 so you can SEE you're hidden; everyone else cloaks
    // deeper (0.3). setAlpha applies this to the body each frame.
    const cloakAlpha = s.cloaked ? (s.id === this.localId ? 0.5 : 0.3) : 1;
    let alpha = cloakAlpha * ((mesh.userData.ghostAlpha as number | undefined) ?? 1);
    if (!s.alive) {
      // capture the pose + fall direction the instant the body first goes down
      let rag = mesh.userData.rag as RagState | undefined;
      if (!rag) {
        const fall = this.deathFall.get(s.id) ?? { x: Math.cos(s.yaw), z: Math.sin(s.yaw) };
        const fwd = fall.x * Math.cos(s.yaw) + fall.z * Math.sin(s.yaw);   // tip pitch (local Z)
        const side = -fall.x * Math.sin(s.yaw) + fall.z * Math.cos(s.yaw); // tip roll (local X)
        const cap: Record<string, number> = {};
        for (const n of RAG_JOINTS) { const o = j[n]; if (o) cap[n] = o.rotation.z; }
        // STATUS §2: the body falls by HOW it was killed — captured once, here
        const style = collapseStyleFor(s.lastKillWeapon ? WEAPONS[s.lastKillWeapon] : undefined);
        rag = mesh.userData.rag = { t0: t, pitch: -fwd * 1.45, roll: side * 1.2, cap, seed: hash01(s.id), style, yaw0: mesh.rotation.y };
      }
      // a clean energy kill (straight) crumples FAST; the rest topple over 0.55s
      const dur = rag.style === 'straight' ? 0.4 : 0.55;
      const k = Math.min(1, Math.max(0, (t - rag.t0) / dur));
      const settle = 1 - (1 - k) * (1 - k);          // body tip eases flat, no ground clip
      const flop = easeOutBack(k);                   // limbs overshoot then settle — floppy
      // the whole body topples the way the shot pushed it, with a brief hop.
      // STRAIGHT drops with barely any tip (you drop where you stood); the rest
      // topple full. sim physics stop for corpses, so an airborne kill keeps its
      // death-height — settle it down to the ground as it goes limp.
      const pitchMul = rag.style === 'straight' ? 0.35 : 1;
      mesh.rotation.z = rag.pitch * pitchMul * settle;
      mesh.rotation.x = rag.roll * settle;
      mesh.position.y = s.pos.y * (1 - settle) + 0.12 * Math.sin(k * Math.PI);
      // MELEE SPIN: a close blow knocks the body spinning as it goes down
      if (rag.style === 'spin') mesh.rotation.y = rag.yaw0 + settle * 4.2 * (rag.seed > 0.5 ? 1 : -1);
      // limbs go limp toward a slack, per-body-varied pose
      const v = (rag.seed - 0.5) * 0.7;
      // FIRE WRITHE: burning bodies THRASH — a decaying flail on the limbs
      const writhe = rag.style === 'writhe' ? Math.sin(t * 21 + rag.seed * 6) * 0.42 * (1 - k) : 0;
      const limp: Record<string, number> = {
        legL: 0.45 + v + writhe, legR: -0.55 - v - writhe, shinL: -1.35, shinR: -1.05,
        armL: -2.2 + v - writhe, armR: -1.7 - v + writhe, head: 0.5 * rag.seed, torso: 0.2,
      };
      for (const n of RAG_JOINTS) {
        const o = j[n];
        if (o && rag.cap[n] !== undefined) o.rotation.z = rag.cap[n] + (limp[n] - rag.cap[n]) * flop;
      }
      if (j.head) j.head.rotation.x = 0.45 * flop;
      if (j.torso) j.torso.rotation.x = 0.3 * flop;
      alpha = Math.min(1, Math.max(0.05, (s.respawnAt - t) / 0.8));
      this.setAlpha(mesh, alpha);
      return;
    }
    // alive again: clear ragdoll state and undo the slump. For the living,
    // poseSoldierJoints only re-poses legs/shins, so the arms, head, and torso
    // the ragdoll bent must be restored here or a respawned body keeps the flop.
    const priorRag = mesh.userData.rag as RagState | undefined;
    if (priorRag) {
      mesh.userData.rag = undefined;
      mesh.rotation.x = 0;
      for (const n of RAG_JOINTS) { const o = j[n]; if (o && priorRag.cap[n] !== undefined) o.rotation.z = priorRag.cap[n]; }
      if (j.head) j.head.rotation.x = 0;
      if (j.torso) j.torso.rotation.x = 0;
    }

    // ---- THE SURF STANCE (Robert: "the hoverboard needs to look like the
    // character is actually on it"). The rider is the REAL soldier mesh —
    // feet apart along the deck, knees bent, arms out for balance, body
    // leaning INTO the drift so the slide reads in the spine, not just the
    // hull. Arms belong to the weapon-hold layer normally, so their pose is
    // captured on mount and restored on the first frame back on boots.
    const board = s.vehicleId >= 0 ? world.vehicles.get(s.vehicleId) : undefined;
    if (board?.kind === 'hoverboard' && board.alive) {
      if (!mesh.userData.surfCap) {
        const c: Record<string, [number, number, number]> = {};
        for (const n of ['armL', 'armR', 'legL', 'legR', 'shinL', 'shinR', 'head', 'torso']) {
          const o = j[n];
          if (o) c[n] = [o.rotation.x, o.rotation.y, o.rotation.z];
        }
        mesh.userData.surfCap = c;
      }
      // lateral slide in board-local terms — lean INTO it
      const latV = -board.vel.x * Math.sin(board.yaw) + board.vel.z * Math.cos(board.yaw);
      const lean = Math.max(-0.35, Math.min(0.35, latV * 0.035));
      const breathe = Math.sin(t * 4 + board.id) * 0.04; // arms ride the deck bob
      if (j.legL) { j.legL.rotation.z = 0.5; j.legL.rotation.x = 0.12; }
      if (j.legR) { j.legR.rotation.z = -0.42; j.legR.rotation.x = -0.12; }
      if (j.shinL) j.shinL.rotation.z = -0.55;
      if (j.shinR) j.shinR.rotation.z = -0.4;
      if (j.armL) { j.armL.rotation.x = 0.85 + breathe; j.armL.rotation.z = 0.25; }
      if (j.armR) { j.armR.rotation.x = -0.75 - breathe; j.armR.rotation.z = -0.2; }
      if (j.torso) { j.torso.rotation.z = 0.16; j.torso.rotation.x = lean; }
      if (j.head) { j.head.rotation.z = -0.12; j.head.rotation.x = -lean * 0.6; }
      this.setAlpha(mesh, alpha);
      return;
    }
    // back on boots: restore the pose the weapon hold had authored
    const surfCap = mesh.userData.surfCap as Record<string, [number, number, number]> | undefined;
    if (surfCap) {
      mesh.userData.surfCap = undefined;
      for (const [n, r] of Object.entries(surfCap)) {
        const o = j[n];
        if (o) o.rotation.set(r[0], r[1], r[2]);
      }
    }

    // ---- gait + undead reach (shared verbatim with the model harness) ----
    const airborne = s.pos.y > 0.6;
    const gaitState = (mesh.userData.gait ??= {}) as GaitState;
    const markers = poseSoldierJoints(j, {
      kind: s.kind, time: t, id: s.id, speed, airborne,
      dt: this.frameDt, state: gaitState,
    });
    const { phase } = markers;

    // ---- synchronized animation markers ----
    // the animation module integrates a continuous per-body phase (robust to
    // speed changes and render-world swaps) and reports the exact frames a
    // boot lands or an undead reach crests; replays stay silent
    if (!this.replayView) {
      if (markers.footstep && s.ascendant !== 'wraith') { // the wraith hovers — no footfalls
        // per-biome surface step (soundscape designation); the universal
        // footstep covers any slot a designer hasn't filled yet
        const step = BIOME_AUDIO[world.map.theme]?.footstep;
        if (!step || !audio.play(step, { pos: s.pos, volume: zed ? 0.25 : 0.35, rate: zed ? 0.8 : 1 })) {
          audio.play('footstep', { pos: s.pos, volume: zed ? 0.25 : 0.35, rate: zed ? 0.8 : 1 });
        }
        // CRUSH-WALK (§Task 9): Leviathan's footfalls shake the ground — a heavy
        // dust ring and a near-camera shudder on every step
        if (s.ascendant === 'leviathan') {
          this.particles.emit({ pos: { x: s.pos.x, y: 0.12, z: s.pos.z }, count: 10, color: Math.random() < 0.5 ? 0x6a5c48 : 0x3f6e6a, speed: 4, life: 0.5, spread: 1.5, up: 1.2, gravity: -2.5, size: 0.5 });
          const d = Math.hypot(s.pos.x - this.camPos.x, s.pos.z - this.camPos.z);
          if (d < 26) this.camShake = Math.max(this.camShake, 0.3 * (1 - d / 26));
        }
      }
      if (markers.growl && hash01(s.id * 13.37 + markers.phase) < 0.4) {
        // three growl takes, chosen per-growl so a horde sounds like many throats
        const growl = (['growl', 'growl2', 'growl3'] as const)[Math.floor(hash01(s.id * 7.13 + markers.phase * 2.9) * 3)];
        audio.play(growl, { pos: s.pos, volume: 0.5, rate: s.kind === 'brute' ? 0.7 : s.kind === 'sprinter' ? 1.25 : 1 });
      }
    }

    // THE HEAD LEADS THE TURN (feel pass #1): while the body spring is
    // catching up, the head has already arrived — the overshoot IS the read.
    if (j.head && !zed) {
      const yawDiff = (mesh.userData.yawDiff as number | undefined) ?? 0;
      j.head.rotation.y = Math.max(-0.6, Math.min(0.6, yawDiff));
    }

    // body: bob while moving, breathe while idle, lean into the run
    const bob = moving ? Math.abs(Math.sin(phase)) * 0.055 : Math.sin(t * 1.8 + s.id) * 0.012;
    mesh.position.y = s.pos.y + bob;
    // HOVER BOB (§Task 9): the wraith never touches down — a slow float on top
    // of its 0.6u hover, so the body drifts instead of standing on air
    if (s.ascendant === 'wraith') mesh.position.y += Math.sin(t * 2 + s.id) * 0.09;
    const lean = airborne ? -0.3 : -Math.min(speed / 14, 1) * (zed ? 0.18 : 0.09);
    // STAGGER (Robert: "a little bit of knock back" — the shove was always in
    // the sim; nothing SOLD it). Tip the body along the blast's forward
    // component: shoved from behind you pitch back on your heels, shoved from
    // the front you fold forward. Gods barely rock — mass is a statement.
    let stagger = 0;
    if ((s.pushX !== 0 || s.pushZ !== 0) && !airborne) {
      const fwd = s.pushX * Math.cos(s.yaw) + s.pushZ * Math.sin(s.yaw);
      stagger = Math.max(-0.38, Math.min(0.38, fwd * 0.042)) * (s.ascendant ? 0.35 : 1);
      const p2 = s.pushX * s.pushX + s.pushZ * s.pushZ;
      // boot-skid dust while the impulse drags them — throttled by dice, and
      // the shove itself only lasts ~0.4s, so a few puffs per stagger
      if (p2 > 7 && s.pos.y < 0.3 && Math.random() < 0.35) {
        this.particles.emit({ pos: { x: s.pos.x, y: 0.15, z: s.pos.z }, count: 2, color: 0x8a7a5c, speed: 2.2, life: 0.35, spread: 0.5, up: 1.6, gravity: 5 });
      }
    }
    // M2 MOVEMENT DRESS: the dash leans HARD, the roll is a sideways barrel
    // spin, and a ragdolled body is flat on the deck until the get-up.
    let verbLean = 0;
    let verbRollX = 0;
    if (s.dashUntil !== undefined && t < s.dashUntil) verbLean = -0.45;
    // SLIDE-OFF-SPRINT: a deeper backward lean than the dash — the body reads
    // as skidding low along the deck, eased out over the slide's tail.
    if (s.slideUntil !== undefined && t < s.slideUntil) verbLean = -0.7 * ((s.slideUntil - t) / 0.55);
    if (s.rollUntil !== undefined && t < s.rollUntil) {
      const k = 1 - (s.rollUntil - t) / 0.5;
      verbRollX = (s.rollDir ?? 1) * k * Math.PI * 2; // one full sideways revolution
      mesh.position.y = s.pos.y + Math.sin(k * Math.PI) * 0.25;
    }
    if (verbRollX !== 0) mesh.rotation.x = verbRollX;
    if (s.ragdollUntil !== undefined && t < s.ragdollUntil) {
      // luggage: flat fast, then the last 0.35s is the rise
      const remain = s.ragdollUntil - t;
      const flat = Math.min(1, remain / 0.35);
      mesh.rotation.z = -1.45 * flat;
      mesh.position.y = s.pos.y + 0.12 * (1 - flat) + 0.05;
    } else {
      mesh.rotation.z = lean + (s.kind === 'sprinter' ? -0.18 : 0) + stagger + verbLean;
    }

    // ---- LEAP DRESS (movement dress §Task 8): crouch-squash on launch, stretch
    // through the arc, crater-thud squash on landing. Leapers only — a flier's
    // dive is not a ground leap — and modulated around the LSW's dressed base
    // scale so the god keeps its size; the body widens as it squashes (volume).
    if (s.ascendant && LSWS[s.ascendant].moves === 'leap') {
      const base = (mesh.userData.baseScaleY ??= mesh.scale.y) as number;
      const ud = mesh.userData as { baseScaleY?: number; leapStartAt?: number; landAt?: number; craterDone?: boolean };
      let sy = base;
      if (s.diveAt !== undefined) {
        ud.landAt = undefined; ud.craterDone = false;
        if (ud.leapStartAt === undefined) ud.leapStartAt = t;
        const since = t - ud.leapStartAt;
        sy = since < 0.12
          ? base * (0.7 + 0.3 * (since / 0.12))            // crouch, then release
          : base * (1 + 0.16 * Math.min(1, s.pos.y / 4));  // stretch with height
      } else if (ud.leapStartAt !== undefined) {
        if (ud.landAt === undefined) ud.landAt = t;
        const since = t - ud.landAt;
        if (since < 0.04 && !ud.craterDone) {               // the thud — a ring of dust
          this.particles.emit({ pos: { x: s.pos.x, y: 0.12, z: s.pos.z }, count: 16, color: 0xbfae90, speed: 5.5, life: 0.5, spread: 1.8, up: 1.6, gravity: -3, size: 0.5 });
          ud.craterDone = true;
        }
        if (since < 0.22) sy = base * (0.78 + 0.22 * (since / 0.22)); // squash → recover
        else { ud.leapStartAt = undefined; ud.landAt = undefined; ud.craterDone = false; }
      }
      mesh.scale.y = sy;
      const wide = base * Math.sqrt(base / sy);
      mesh.scale.x = wide; mesh.scale.z = wide;
    }

    // ---- BLINK DRESS (movement dress §Task 9): a blink-walker leaves a fading
    // afterimage where it stood and pops in 1.2->1 at the destination. The hop
    // is 5..15u instant; a re-pick respawn is farther, so bound the jump.
    if (s.ascendant && LSWS[s.ascendant].moves === 'blinkwalk') {
      const last = mesh.userData.blinkLast as { x: number; z: number } | undefined;
      if (last) {
        const jump = Math.hypot(s.pos.x - last.x, s.pos.z - last.z);
        if (jump > 4 && jump < 22) {
          const style = s.ascendant === 'chronos' ? 'gold' : s.ascendant === 'voidwalker' ? 'collapse' : 'flicker';
          const tint = style === 'gold' ? 0xffcf5a : style === 'collapse' ? 0x30407a : 0xbfe8ff;
          this.spawnBlinkGhost(mesh, last.x, last.z, t, style, tint);
          mesh.userData.blinkPopAt = t;
        }
      }
      mesh.userData.blinkLast = { x: s.pos.x, z: s.pos.z };
      const popAt = mesh.userData.blinkPopAt as number | undefined;
      if (popAt !== undefined) {
        const since = t - popAt;
        const base = (mesh.userData.baseScaleY ??= mesh.scale.y) as number;
        if (since < 0.15) mesh.scale.setScalar(base * (1.2 - 0.2 * (since / 0.15)));
        else { mesh.scale.setScalar(base); mesh.userData.blinkPopAt = undefined; }
      }
    }

    // ---- melee telegraph: claws flash UP through the windup, whip DOWN on
    // the strike. Zeds get the ADDITIVE shoulder swing (their arms re-pose
    // every frame, offsets can't accumulate). LIVING soldiers get the ELBOW
    // (W6.2): the forearm cocks back through the windup and SNAPS on the
    // strike — written absolute-from-rest each frame (nothing else drives
    // the elbow, and the run-carry below owns the shoulders).
    const wu = this.meleeTelegraphs.get(s.id);
    if (wu) {
      if (t > wu.until + 0.3) {
        this.meleeTelegraphs.delete(s.id); // window long gone — stop tracking
      } else if (t >= wu.at) {
        const raise = Math.min(1, (t - wu.at) / Math.max(wu.until - wu.at, 0.01));
        if (zed && (j.armL || j.armR)) {
          // positive z-rotation swings a hanging limb forward/up (animation.ts)
          const lift = t < wu.until
            ? raise * 0.9                                   // wind up: arms climb overhead
            : -0.7 * Math.max(0, 1 - (t - wu.until) / 0.15); // strike: slash past rest, ease back
          if (j.armL) j.armL.rotation.z += lift;
          if (j.armR) j.armR.rotation.z += lift * 0.85;
        } else if (!zed && j.elbowR) {
          const eRest = (mesh.userData.elbowRest ??= { R: j.elbowR.rotation.z }) as { R: number };
          const k = t < wu.until
            ? raise * 0.85                                    // cock the forearm back
            : -1.05 * Math.max(0, 1 - (t - wu.until) / 0.18); // snap through, ease home
          j.elbowR.rotation.z = eRest.R + k;
        }
      }
    }

    // ---- the RUN CARRY (Robert: "his arms don't move, the gun is always
    // up"): a soldier sprinting between fights PUMPS his arms counter to
    // the legs and drops the rifle to a patrol carry. The moment a shot
    // fires (his own recoil timestamp), the gun snaps back up and the arms
    // return to the two-handed hold. Blended, never snapped — and it runs
    // for EVERY living soldier, Robert's GLB bodies and the procedural
    // troopers alike.
    let carryBlend = 0; // hoisted for the per-weapon holds below
    if (!zed && s.kind !== 'scientist' && (j.armL || j.armR)) {
      const rest = (mesh.userData.armRest ??= {
        L: j.armL?.rotation.z ?? -0.75,
        R: j.armR?.rotation.z ?? -0.5,
      }) as { L: number; R: number };
      const shotAt = this.recoilAt.get(s.id) ?? -Infinity;
      const fighting = t - shotAt < 1.1;               // the gun stays up while it's hot
      const running = moving && speed > 3.5 && !fighting && !airborne;
      const blend = (mesh.userData.runBlend ??= { v: 0 }) as { v: number };
      blend.v += ((running ? 1 : 0) - blend.v) * Math.min(1, this.frameDt * 7);
      const b = blend.v;
      carryBlend = b;
      const pump = Math.sin(phase) * 0.42 * Math.min(1, speed / 6);
      // arms counter the legs (legL is +sin): hold-pose eases off as b rises
      if (j.armL) j.armL.rotation.z = rest.L * (1 - b * 0.7) + -pump * b;
      if (j.armR) j.armR.rotation.z = rest.R * (1 - b * 0.7) + pump * b;
      if (j.gun) {
        const baseY = (j.gun.userData.baseY ??= j.gun.position.y) as number;
        j.gun.rotation.z = -0.42 * b;                  // muzzle dips off the shoulder
        j.gun.position.y = baseY - 0.14 * b;
      }
    }

    // ---- PER-WEAPON HOLDS (feel pass #2): the silhouette says what's in
    // the hands before the tracer does. Additive on the solved grip; the
    // sprint carry fades them, the fight brings them back.
    if (!zed && s.kind !== 'scientist' && j.gun) {
      const fam = WEAPONS[s.weapons[s.weaponIdx]]?.family ?? 'rifle';
      const hold = WEAPON_HOLDS[fam] ?? WEAPON_HOLDS.rifle;
      // EMBODIMENT (kill the guns): a melee LSW fights with fists/blade, so its
      // gun mesh must stay hidden. dressAsLsw hides it once at build, but this
      // per-frame hold re-shows every armed body — without the rig check Titan
      // picks his rifle back up on the next frame. Armed rigs (gauntlet/palm/
      // rifle/launcher/…) still carry the model until per-rig holds land.
      const rig = s.ascendant ? LSWS[s.ascendant]?.rig : undefined;
      const meleeRig = rig === 'fists' || rig === 'blade' || rig === 'thrower'; // throwers carry a hose
      // THE CAPE LIVES (dressAsLsw hangs it; this waves it — same law as the
      // CTF flag's cloth): a breeze sway, and it TRAILS when the god moves.
      if (s.ascendant) {
        const cape = mesh.getObjectByName('cape');
        if (cape) {
          const spd = Math.hypot(s.vel.x, s.vel.z);
          cape.rotation.x = -0.12 - Math.min(1, spd / 9) * 0.55 + Math.sin(t * 2.1 + s.id) * 0.06;
          cape.rotation.y = Math.sin(t * 1.7 + s.id * 2) * 0.1;
        }
        const dial = mesh.getObjectByName('clockdial');
        if (dial) dial.rotation.x = t * 0.45; // chronos' clock turns, slowly, always
      }
      if (hold.hideGun || meleeRig) {
        j.gun.visible = false; // unarmed — arms swing free (zed-style, but human)
      } else {
        j.gun.visible = true;
        const wgt = 1 - carryBlend * 0.8;
        if (j.armL) j.armL.rotation.z += hold.armL * wgt;
        if (j.armR) j.armR.rotation.z += hold.armR * wgt;
        const baseY = (j.gun.userData.holdBaseY ??= j.gun.position.y) as number;
        const baseZ = (j.gun.userData.holdBaseZ ??= j.gun.position.z) as number;
        j.gun.position.y = baseY + hold.gunY * wgt;
        j.gun.position.z = baseZ + hold.gunZ * wgt;
        j.gun.rotation.z += hold.gunRotZ * wgt;
        if (hold.torsoX && j.torso) j.torso.rotation.x += hold.torsoX * wgt;
      }
    }

    // ---- THE GRENADE THROW (feel pass #3): wind back, whip, settle. The
    // right arm sells the lob; the gun rides the left while it's out.
    if (!zed && j.armR) {
      const tp = this.throwPoses.get(s.id);
      if (tp) {
        if (t > tp.until) this.throwPoses.delete(s.id);
        else {
          const k = Math.min(1, (t - tp.at) / (tp.until - tp.at)); // 0..1 through the motion
          j.armR.rotation.z += throwArmCurve(k);
          if (j.gun) j.gun.position.y -= 0.08 * (1 - k); // rides low on the left hand
        }
      }
    }

    // rifle recoil kick for the living gunners — SCALED BY FAMILY (feel pass
    // #4): a slugger's whole torso shoves and takes 0.35s to recover; a
    // shotgun kicks hard; an SMG just shivers.
    if (!zed && j.gun) {
      const fam = WEAPONS[s.weapons[s.weaponIdx]]?.family ?? 'rifle';
      const rs = RECOIL_SCALE[fam] ?? RECOIL_SCALE.rifle;
      const shotAt = this.recoilAt.get(s.id) ?? -1;
      const kick = Math.max(0, 1 - (t - shotAt) / rs.recover);
      const shiver = fam === 'smg' && t - shotAt < 0.3 ? Math.sin(t * 90) * 0.012 : 0;
      j.gun.position.x = (j.gun.userData.baseX ?? 0.42) - kick * 0.11 * rs.kick;
      j.gun.rotation.z += kick * rs.flip + shiver;
      if (j.torso) j.torso.rotation.z = -kick * 0.05 * rs.kick;
    }

    // ---- C-1 RIG PASS (Robert: "we need to change that model, bro, so we
    // can get these movements"). The verbs stop being camera tricks and
    // become POSTURES. Composed LAST so the run carry / weapon holds /
    // throw arcs can't fight them — these blocks own the frame's final say.
    // THE SLIDE SKID: the body drops INTO the deck and pitches back, legs
    // thrust forward along the travel, shins near-straight, off arm trails
    // for balance, the gun arm braces high. (+z swings a hanging limb
    // forward — rig law, tests/rig.test.ts.)
    if (!zed && s.slideUntil !== undefined && t < s.slideUntil && !(s.ragdollUntil !== undefined && t < s.ragdollUntil)) {
      const k = Math.max(0, Math.min(1, (s.slideUntil - t) / 0.55)); // 1 at launch → 0 at rest
      mesh.position.y = s.pos.y - 0.34 * k;
      if (j.legL) j.legL.rotation.z = 1.15 * k;
      if (j.legR) j.legR.rotation.z = 0.95 * k;
      if (j.shinL) j.shinL.rotation.z = -0.15 * k;
      if (j.shinR) j.shinR.rotation.z = -0.2 * k;
      if (j.armL) j.armL.rotation.z = -0.85 * k;   // off arm plants back
      if (j.armR) j.armR.rotation.z += 0.5 * k;    // gun arm rides the brace
      if (j.head) j.head.rotation.z = 0.3 * k;     // eyes stay downrange
      // heel dust while the skid is hot
      if (k > 0.25 && s.pos.y < 0.3 && Math.random() < 0.5) {
        this.particles.emit({ pos: { x: s.pos.x, y: 0.1, z: s.pos.z }, count: 2, color: 0x8a7a5c, speed: 2.5, life: 0.3, spread: 0.5, up: 1.4, gravity: 6 });
      }
    }
    // THE DASH LUNGE: arms DRIVE the burst, chin tucks — a sprint-start,
    // not a glide. Additive over the carry so the silhouette keeps its gun.
    if (!zed && s.dashUntil !== undefined && t < s.dashUntil) {
      const k = Math.max(0, Math.min(1, (s.dashUntil - t) / 0.28));
      if (j.armL) j.armL.rotation.z += 0.55 * k;
      if (j.armR) j.armR.rotation.z += 0.4 * k;
      if (j.head) j.head.rotation.z = -0.15 * k;
    }
    // THE GUARD BRACE (§12 made visible — C-1 slice 2): a raised guard was
    // INVISIBLE; the whole triangle's most defensive verb read as standing
    // still. Held V now shows: both arms rise into a cross-brace, the
    // forearm folds across, chin tucks behind the arms, the stance sets
    // low, and the gun leaves the hands (the sim already lowered it).
    // Blended so the raise/drop is a deliberate act, not a pop.
    if (!zed && s.kind !== 'scientist') {
      const gb = (mesh.userData.guardBlend ??= { v: 0 }) as { v: number };
      gb.v += ((s.guarding && !s.downed ? 1 : 0) - gb.v) * Math.min(1, this.frameDt * 8);
      if (gb.v > 0.02) {
        const g = gb.v;
        if (j.armL) j.armL.rotation.z = j.armL.rotation.z * (1 - g) + 1.35 * g;
        if (j.armR) j.armR.rotation.z = j.armR.rotation.z * (1 - g) + 1.15 * g;
        if (j.elbowR) j.elbowR.rotation.z += 0.9 * g;   // forearm folds across the face
        if (j.head) j.head.rotation.z = j.head.rotation.z * (1 - g) + -0.12 * g;
        mesh.position.y -= 0.05 * g;                     // the stance sets
        if (j.gun) j.gun.visible = g < 0.5;              // the brace owns the hands
      }
    }
    // THE GRAPPLE HOLD (§14 made visible): the grabber WRAPS — arms closed
    // around the target, body leaning INTO the hold — and the grabbed body
    // WRITHES, arms clawing alternately, head thrashing: the mash-to-break
    // struggle you can finally SEE. (Latched shamblers ride the same read.)
    if (s.grabbingId !== undefined && world.soldiers.has(s.grabbingId)) {
      if (j.armL) j.armL.rotation.z = 1.05;
      if (j.armR) j.armR.rotation.z = 0.95;
      mesh.rotation.z += 0.14;
    }
    if (s.grabbedBy !== undefined && s.alive) {
      const shake = Math.sin(t * 17 + s.id);
      if (j.armL) j.armL.rotation.z = 1.4 + shake * 0.35;
      if (j.armR) j.armR.rotation.z = 0.7 - shake * 0.35;
      if (j.head) j.head.rotation.z = shake * 0.16;
      mesh.rotation.y += shake * 0.07;                   // the writhe
    }
    // THE MANTLE VAULT: a grounded hop crossing LOW COVER plants the lead
    // hand and tucks the trail leg — the vault the movement system already
    // performs (blocksAir passes T_COVER above 0.9u) finally shows on the
    // body. Gated to the hop arc so a plain jump in the open stays a jump.
    if (!zed && !s.ascendant && s.pos.y > 0.35 && s.pos.y < 1.4 && s.vehicleId < 0) {
      const overCover = tileAt(world.map.grid, s.pos.x, s.pos.z) === T_COVER;
      if (overCover) {
        if (j.armL) { j.armL.rotation.z = 1.25; }        // lead hand plants down-forward
        if (j.legL) j.legL.rotation.z = 0.9;             // lead leg clears
        if (j.legR) j.legR.rotation.z = -0.35;           // trail leg tucks under
        if (j.shinL) j.shinL.rotation.z = -1.0;
        if (j.shinR) j.shinR.rotation.z = -0.75;
        mesh.rotation.z += -0.22;                        // shoulders dip over the plant
      }
    }

    // ---- POWER-CAST POSES (feel pass #6): the god throws its signature.
    // 0.6s additive by school — SLAM overhead-and-down, THRUST punched
    // forward, CHANNEL one arm held out and sustained.
    if (s.ascendant && (j.armL || j.armR)) {
      const cp = this.castPoses.get(s.id);
      if (cp) {
        if (t > cp.until) this.castPoses.delete(s.id);
        else {
          const k = Math.min(1, (t - cp.at) / (cp.until - cp.at));
          const env = Math.sin(k * Math.PI); // up-and-down envelope
          if (cp.school === 'slam') {
            const swing = k < 0.55 ? 2.4 * (k / 0.55) : 2.4 - 3.6 * ((k - 0.55) / 0.45);
            if (j.armL) j.armL.rotation.z += swing;
            if (j.armR) j.armR.rotation.z += swing;
            if (j.torso) j.torso.rotation.x += (k < 0.55 ? -0.2 : 0.35) * env;
          } else if (cp.school === 'channel') {
            if (j.armR) j.armR.rotation.z += 1.5 * env;
            if (j.torso) j.torso.rotation.z += -0.12 * env;
          } else if (cp.school === 'lob') {
            // overhand hurl: the throwing arm cocks back over the shoulder, then
            // whips down-and-forward; the torso leans back then drives through
            const cock = Math.min(1, k / 0.4);
            const whip = Math.max(0, (k - 0.4) / 0.6);
            if (j.armR) j.armR.rotation.z += 2.8 * cock - 3.3 * whip;
            if (j.armL) j.armL.rotation.z += 0.6 * cock;
            if (j.torso) j.torso.rotation.x += -0.3 * cock + 0.45 * whip;
          } else if (cp.school === 'brace') {
            // cheek-weld both arms to the eye line, hard recoil shove at the shot
            const kick = Math.max(0, 1 - k / 0.3);
            if (j.armL) j.armL.rotation.z += 1.2;
            if (j.armR) j.armR.rotation.z += 1.2;
            if (j.torso) j.torso.rotation.x += -0.22 * kick;
          } else if (cp.school === 'shoulder') {
            // launcher up on the shoulder — both arms raised and braced, small kick
            const kick = Math.max(0, 1 - k / 0.35);
            if (j.armL) j.armL.rotation.z += 0.9;
            if (j.armR) j.armR.rotation.z += 1.5;
            if (j.torso) j.torso.rotation.x += -0.12 * kick;
          } else if (cp.school === 'flick') {
            // fast, low-tell snap of the throwing arm — no big wind-up (assassins)
            const snap = Math.sin(Math.min(1, k / 0.4) * Math.PI);
            if (j.armR) j.armR.rotation.z += 1.1 * snap;
          } else {
            const punch = Math.min(1, k / 0.25) * (1 - Math.max(0, (k - 0.7) / 0.3));
            if (j.armL) j.armL.rotation.z += 1.9 * punch;
            if (j.armR) j.armR.rotation.z += 1.9 * punch;
            if (j.torso) j.torso.rotation.x += 0.15 * env;
          }
        }
      }
    }

    // ---- FLIGHT STYLES (feel pass #5): each flier owns a silhouette in the
    // air. Blended over everything above with a spring, so takeoffs read.
    if (s.ascendant === 'inferno' || s.ascendant === 'stormcaller' || s.ascendant === 'gargoyle') {
      const airborne2 = s.pos.y > 2.5 || (s.flightAlt ?? 0) > 2.5;
      const fblend = (mesh.userData.flyBlend ??= { v: 0 }) as { v: number };
      fblend.v += ((airborne2 ? 1 : 0) - fblend.v) * Math.min(1, this.frameDt / 0.3);
      const fb = fblend.v;
      // capture the built arm PITCH before flight ever bends it — rotation.z
      // is re-based every frame by the run carry, but nothing else owns
      // rotation.x, so without a restore the flight pose leaked and a landed
      // flier kept its wings folded forever (the character audit)
      const restX = (mesh.userData.armRestX ??= {
        L: j.armL?.rotation.x ?? 0, R: j.armR?.rotation.x ?? 0,
      }) as { L: number; R: number };
      if (fb > 0.01) {
        const diving = s.ascendant === 'gargoyle' && s.diveAt !== undefined && t < s.diveAt;
        const pose = FLIGHT_POSES[diving ? 'gargoyle_dive' : s.ascendant];
        mesh.rotation.z = mesh.rotation.z * (1 - fb) + pose.pitch * fb;
        if (j.armL) { j.armL.rotation.z += (pose.armZ - j.armL.rotation.z) * fb; j.armL.rotation.x += (pose.armX - j.armL.rotation.x) * fb; }
        if (j.armR) { j.armR.rotation.z += (pose.armZ - j.armR.rotation.z) * fb; j.armR.rotation.x += (-pose.armX - j.armR.rotation.x) * fb; }
        if (j.head) j.head.rotation.z += (pose.headZ - j.head.rotation.z) * fb;
        if (j.legL) j.legL.rotation.z += (0.25 - j.legL.rotation.z) * fb;
        if (j.legR) j.legR.rotation.z += (0.15 - j.legR.rotation.z) * fb;
        if (j.shinL) j.shinL.rotation.z += (-0.35 - j.shinL.rotation.z) * fb;
        if (j.shinR) j.shinR.rotation.z += (-0.25 - j.shinR.rotation.z) * fb;
      } else {
        // landed: ease the arm pitch home
        const k = Math.min(1, this.frameDt / 0.25);
        if (j.armL) j.armL.rotation.x += (restX.L - j.armL.rotation.x) * k;
        if (j.armR) j.armR.rotation.x += (restX.R - j.armR.rotation.x) * k;
      }
      // THE PERCH: clinging to his tile, he hunches — folded and watching
      const perched = s.perchTile !== undefined && !airborne2;
      const pblend = (mesh.userData.perchBlend ??= { v: 0 }) as { v: number };
      pblend.v += ((perched ? 1 : 0) - pblend.v) * Math.min(1, this.frameDt / 0.3);
      const pb = pblend.v;
      if (pb > 0.01) {
        if (j.torso) j.torso.rotation.x += 0.5 * pb;
        if (j.shinL) j.shinL.rotation.z += (-0.9 - j.shinL.rotation.z) * pb;
        if (j.shinR) j.shinR.rotation.z += (-0.9 - j.shinR.rotation.z) * pb;
        if (j.head) j.head.rotation.z += (0.25 - j.head.rotation.z) * pb;
      }
    }

    this.setAlpha(mesh, alpha);
  }

  /** A distinct in-flight round per tracer family — you can tell a rocket from
   *  a plasma bolt from a rail lance at a glance. Long axis is local +X (the
   *  update loop yaws each round to face its velocity). */
  private makeProjectile(tracer: string, color: number, beam?: string, weapon?: string): THREE.Object3D {
    const solid = (geo: THREE.BufferGeometry, c: number) =>
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c }));
    const glow = (geo: THREE.BufferGeometry, c: number, op = 0.5) =>
      new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    switch (tracer) {
      case 'rocket': { // missile: metal body + bright nose + exhaust glow (trail added in flight)
        const g = new THREE.Group();
        const body = solid(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 7), 0x55504a);
        body.rotation.z = Math.PI / 2; g.add(body);
        const nose = solid(new THREE.ConeGeometry(0.11, 0.24, 7), color);
        nose.rotation.z = -Math.PI / 2; nose.position.x = 0.35; g.add(nose);
        const exhaust = glow(new THREE.SphereGeometry(0.26, 8, 6), 0xffb050, 0.6);
        exhaust.position.x = -0.32; g.add(exhaust);
        return g;
      }
      case 'paint': {
        // A PAINTBALL IS A WET THING (Robert: "I want it to look more gooey").
        // A fat squashed sphere with a soft skin over it — the shell casing it
        // used to borrow read as hard, metallic and fast, which is three
        // wrong answers. Slight vertical squash so it looks heavy and full.
        const g = new THREE.Group();
        const core = solid(new THREE.SphereGeometry(0.19, 9, 7), color);
        core.scale.set(1, 0.86, 1);
        core.name = 'goo';
        g.add(core);
        // the skin: a hair larger, translucent, so the ball has depth and a
        // wet edge instead of a flat silhouette
        const skin = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 9, 7),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }),
        );
        skin.scale.set(1, 0.86, 1);
        g.add(skin);
        return g;
      }
      case 'plasma': { // pulsing energy orb with an additive halo
        const g = new THREE.Group();
        g.add(solid(new THREE.SphereGeometry(0.16, 10, 8), color));
        const halo = glow(new THREE.SphereGeometry(0.34, 10, 8), color, 0.45);
        halo.name = 'halo'; g.add(halo);
        return g;
      }
      case 'rail': { // bright hypervelocity lance + faint sheath
        const g = new THREE.Group();
        g.add(solid(new THREE.BoxGeometry(2.6, 0.05, 0.05), 0xffffff));
        g.add(glow(new THREE.BoxGeometry(2.8, 0.16, 0.16), color, 0.4));
        return g;
      }
      case 'shell': // stubby tumbling slug (shotgun, paint)
        return solid(new THREE.BoxGeometry(0.3, 0.15, 0.15), color);
      case 'frag': { // an honest-to-god GRENADE: olive segmented body, steel
        // collar, safety spoon still riding the side. Oversized a touch —
        // at our camera height a to-scale frag is a flying pixel, and the
        // whole point of the shape is that you RECOGNIZE the thing that's
        // about to ruin your afternoon.
        const g = new THREE.Group();
        const body = solid(new THREE.IcosahedronGeometry(0.17, 1), 0x4a5d3a);
        g.add(body);
        const band = solid(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 8), 0x333a2c);
        g.add(band); // the frag-segmentation groove, read as a dark equator
        const collar = solid(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6), 0x8f9296);
        collar.position.y = 0.2; g.add(collar);
        const spoon = solid(new THREE.BoxGeometry(0.045, 0.22, 0.09), 0xa8adb2);
        spoon.position.set(0.1, 0.12, 0); spoon.rotation.z = -0.35; g.add(spoon);
        return g;
      }
      case 'canister': { // hand canister (smoke/incendiary): a small tin with a band
        const g = new THREE.Group();
        const tin = solid(new THREE.CylinderGeometry(0.09, 0.09, 0.26, 7), 0x5d6656);
        g.add(tin);
        const band = solid(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 7), color);
        band.position.y = 0.06;
        g.add(band);
        return g;
      }
      case 'acid': // wet green glob
        return solid(new THREE.SphereGeometry(0.2, 8, 6), color);
      case 'flame': // flickering ember (fire trail added in flight)
        return glow(new THREE.SphereGeometry(0.24, 7, 5), color, 0.85);
      case 'beam': { // beam PROFILE (projectile-fx Task 7): the silhouette tells
        // the school — a lance is long and thin, a hose is a fat stream, a charge
        // bolt is the fattest, a ricochet round medium, a zap the default streak
        const dim: Record<string, [number, number]> = {
          lance: [2.8, 0.06], hose: [1.1, 0.17], charge: [1.3, 0.24], ricochet: [1.2, 0.09],
        };
        const [len, w] = dim[beam ?? ''] ?? [1.4, 0.05];
        const g = new THREE.Group();
        if (weapon === 'lsw_eclipse') {
          // THE LIGHTDRINKER (no-purple solve): a beam that EATS light — a solid
          // near-black core (normal blending, occludes what's behind it) wrapped
          // in a thin additive pale-corona sheath. Unmistakable, and no purple.
          const core = solid(new THREE.BoxGeometry(len, w, w), 0x101018);
          core.name = 'darkcore';
          g.add(core);
          g.add(glow(new THREE.BoxGeometry(len * 1.02, w * 2.4, w * 2.4), 0xfff0d0, 0.5));
          return g;
        }
        g.add(solid(new THREE.BoxGeometry(len, w, w), color));
        if (beam === 'charge' || beam === 'hose') g.add(glow(new THREE.BoxGeometry(len * 1.05, w * 2.1, w * 2.1), color, 0.4));
        return g;
      }
      default: { // an actual ROUND — but at ROUND scale. The first cut of
        // "bullets should look like bullets" shipped a 1.6u pencil (a
        // soldier is 1.8u tall; Robert's screenshot was a field of floating
        // crayons). Same anatomy, honest size: a dark-brass slug with a pale
        // nose, and a thin bright tracer doing the at-zoom visibility work.
        // Long axis is +X (the update loop yaws it to face its velocity).
        const g = new THREE.Group();
        const slug = solid(new THREE.CylinderGeometry(0.032, 0.055, 0.17, 6), 0x8a6a30);
        slug.rotation.z = -Math.PI / 2; slug.position.x = 0.04; // +Y → +X (travel)
        const tip = solid(new THREE.ConeGeometry(0.032, 0.08, 6), 0xd9b25f);
        tip.rotation.z = -Math.PI / 2; tip.position.x = 0.165;
        // the tracer LINE does the at-zoom work: bright solid core, soft halo
        const streak = solid(new THREE.BoxGeometry(0.72, 0.05, 0.05), color);
        streak.position.x = -0.41;
        const tracer = glow(new THREE.BoxGeometry(0.88, 0.11, 0.11), color, 0.42);
        tracer.position.x = -0.43; // the glow rides the streak, behind the slug
        g.add(slug, tip, streak, tracer);
        return g;
      }
    }
  }

  /** Grenade-throw preview while G is held: the sim's exact arc (same math as
   *  throwProjectile) to the cursor, clamped to max reach, plus a splash ring
   *  on the landing point. Pass aim=null to hide. */
  setGrenadePreview(world: World, s: Soldier | undefined, aim: { x: number; z: number } | null, loft = 1) {
    if (!s || !aim || !s.alive) {
      if (this.nadeArc) { this.nadeArc.visible = false; this.nadeRing!.visible = false; }
      return;
    }
    const N = 24;
    if (!this.nadeArc) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.nadeArc = new THREE.Line(geo, new THREE.LineDashedMaterial({
        color: 0xf5b21a, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.95, depthWrite: false,
      }));
      this.nadeArc.frustumCulled = false;
      this.scene.add(this.nadeArc);
      this.nadeRing = new THREE.Mesh(
        new THREE.RingGeometry(4.55, 5, 40),
        new THREE.MeshBasicMaterial({ color: 0xf5b21a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
      );
      this.nadeRing.rotation.x = -Math.PI / 2;
      this.scene.add(this.nadeRing);
    }
    const dx = aim.x - s.pos.x, dz = aim.z - s.pos.z;
    const reach = Math.max(4, Math.min(Math.hypot(dx, dz), HAND_FRAG_REACH));
    const yaw = Math.atan2(dz, dx);
    // mirror throwProjectile EXACTLY, loft included — a preview that lies
    // about the arc is worse than no preview (the wheel dials loft 0..1).
    // ×1.3 is the raised mortar ceiling (Robert: "a higher arc").
    let speed = 16;
    const muzzleY = 1.4, gArc = world.gravity * 0.7;
    const t0 = reach / speed;
    const vyFull = Math.max(2, 0.5 * gArc * t0 - muzzleY / t0) * 1.3;
    const vy = 2.2 + (Math.max(vyFull, 2.2) - 2.2) * Math.max(0, Math.min(1, loft));
    const t = (vy + Math.sqrt(vy * vy + 2 * gArc * muzzleY)) / gArc;
    speed = reach / t;
    const sx = s.pos.x + Math.cos(yaw) * 0.8, sz = s.pos.z + Math.sin(yaw) * 0.8;
    const pos = (this.nadeArc.geometry.getAttribute('position') as THREE.BufferAttribute);
    for (let i = 0; i < N; i++) {
      const tt = (i / (N - 1)) * t;
      pos.setXYZ(i,
        sx + Math.cos(yaw) * speed * tt,
        Math.max(0.06, s.pos.y + muzzleY + vy * tt - 0.5 * gArc * tt * tt),
        sz + Math.sin(yaw) * speed * tt);
    }
    pos.needsUpdate = true;
    this.nadeArc.geometry.computeBoundingSphere();
    this.nadeArc.computeLineDistances();
    this.nadeArc.visible = true;
    this.nadeRing!.position.set(sx + Math.cos(yaw) * speed * t, 0.06, sz + Math.sin(yaw) * speed * t);
    this.nadeRing!.visible = true;
  }

  private setAlpha(mesh: THREE.Group, alpha: number) {
    if (mesh.userData.lastAlpha === alpha) return; // skip the traverse when nothing changed
    mesh.userData.lastAlpha = alpha;
    mesh.traverse((o) => {
      // UI overlays (name tag, health ring, blip) manage their OWN alpha. If
      // setAlpha forces transparent=false on them at full alpha, their mostly-
      // transparent CanvasTextures render as SOLID BLACK boxes/discs — that was
      // the "black mess" behind every name and under every unit.
      if (o.userData.uiOverlay) return;
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
            // THE GRENADE THROW (feel pass #3): a lobbed family starts the
            // wind-up → whip → settle on the shooter's right arm
            if (def.family === 'grenade' && !shooter?.ascendant) {
              this.throwPoses.set(e.soldierId, { at: world.time, until: world.time + 0.45 });
            }
            // EMBODIMENT (Task 4): an LSW plays its own attack pose on every
            // shot — the sniper braces, the thrower lobs, the beam-god channels
            if (shooter?.ascendant) this.setLswPose(shooter, world.time);
          }
          // rifle has two takes — alternate at random so sustained fire varies
          let shotSnd = def.sound as SoundName;
          if (shotSnd === 'rifle' && Math.random() < 0.5) shotSnd = 'rifle2';
          // Ragebeast's claws have three takes (Robert's pack) — pick one per
          // swing so the 3/s rending never reads as one looped sample
          else if (shotSnd === 'ragebeast_attack1') shotSnd = (['ragebeast_attack1', 'ragebeast_attack2', 'ragebeast_attack3'] as const)[Math.floor(Math.random() * 3)];
          audio.play(shotSnd, { pos: e.pos, volume: 0.7 });
          if (def.tracer !== 'beam' && def.tracer !== 'none') {
            this.particles.emit({ pos: e.pos, count: 3, color: 0xffcc66, speed: 3, life: 0.12, spread: 0.3, up: 1, size: 0.3 });
          } else if (def.tracer === 'beam') {
            // BEAM BIRTH (row 190): a beam has no powder flash — the aperture
            // BLOOMS. A corona in the beam's OWN signature hue (the beam seven /
            // the god's color, same precedence as the projectile) around a
            // white-hot core pip — the muzzle tell that a beam was just born.
            const birthOwner = e.soldierId !== undefined ? world.soldiers.get(e.soldierId) : undefined;
            const beamHue = WEAPON_TINTS[e.weapon]
              ?? (birthOwner?.ascendant ? LSWS[birthOwner.ascendant].color : undefined)
              ?? TRACER_COLORS.beam;
            this.particles.emit({ pos: { ...e.pos }, count: 12, color: beamHue, speed: 6.5, life: 0.24, spread: 1.5, up: 0.2, size: 0.34 });
            this.particles.emit({ pos: { ...e.pos }, count: 5, color: 0xffffff, speed: 2.2, life: 0.13, spread: 0.5, up: 0.3, size: 0.5 });
          }
          // §19.2: a gunshot you can't SEE still tells your ears where it
          // came from — smear the smudge at the muzzle. (Events cross the
          // wire uncalled: hearing an unseen shooter is fair by design.)
          if (!this.replayView && e.soldierId !== undefined) {
            const localS = world.soldiers.get(localId);
            const shooter = world.soldiers.get(e.soldierId);
            const unseenEnemy = !!localS && e.soldierId !== localId && (!shooter
              ? true // puppet worlds: a culled shooter is one you genuinely can't see
              : shooter.team !== localS.team && !world.puppet &&
                !seenRecently(world.lastSeen, world.pinged, localS.team, shooter, world.time,
                  classLinger(localS.classId, localS.equipment.includes('tracking_optics'))));
            if (unseenEnemy) this.spawnSmudge(e.pos, def.range <= 2.5 ? 1.5 : 3, world.time);
          }

          // melee strike: a pale claw-arc sweeps the ground where the swing landed
          if (def.range <= 2.5 && e.soldierId !== undefined) {
            const attacker = world.soldiers.get(e.soldierId);
            // the sim locked the swing direction at windup — draw the arc there.
            // RingGeometry angles live in XY; after the -90° X-flip a geometry
            // angle θ lands at ground bearing -θ, so bake -yaw into thetaStart.
            const yaw = attacker ? (attacker.meleeYaw ?? attacker.yaw) : 0;
            const slash = new THREE.Mesh(
              new THREE.RingGeometry(0.6, def.range + 0.6, 14, 1, -yaw - Math.PI / 4, Math.PI / 2),
              new THREE.MeshBasicMaterial({
                color: 0xffe2c0, transparent: true, opacity: 0.55,
                side: THREE.DoubleSide, depthWrite: false,
              }),
            );
            slash.rotation.x = -Math.PI / 2;
            slash.position.set(e.pos.x, 0.25, e.pos.z);
            this.scene.add(slash);
            this.slashes.push({ mesh: slash, until: world.time + 0.22 });
          }
          break;
        }
        case 'melee_windup': {
          // the telegraph: arms flash up (animateSoldier reads this window)
          // and a low scrape warns anyone standing in the wedge
          if (e.soldierId === undefined) break;
          const attacker = world.soldiers.get(e.soldierId);
          const rof = e.weapon ? WEAPONS[e.weapon]?.rof ?? 1.2 : 1.2;
          const windup = Math.min(meleeWindupFor(attacker?.kind ?? 'zombie'), 0.8 / rof);
          this.meleeTelegraphs.set(e.soldierId, { at: world.time, until: world.time + windup });
          // EMBODIMENT (Task 4): a melee LSW starts its swing HERE (the windup),
          // so the SLAM/blade arc reads before the strike lands
          if (attacker?.ascendant) this.setLswPose(attacker, world.time);
          if (e.pos) audio.play('claw', { pos: e.pos, volume: 0.3 });
          break;
        }
        case 'grab_reach': {
          // Robert's pulse-ring: on YOUR grab press a ring PULSES OUTWARD from
          // your feet to the grab radius — "you reach out in that radius." Only
          // your own reach draws (it's a first-person tell, not the whole map).
          if (e.pos === undefined || e.soldierId !== localId) break;
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.34, 32),
            new THREE.MeshBasicMaterial({ color: 0xffc24a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(e.pos.x, 0.07, e.pos.z);
          this.scene.add(ring);
          this.grabPulses.push({ mesh: ring, born: world.time, x: e.pos.x, z: e.pos.z });
          break;
        }
        case 'explosion': {
          if (!e.pos) break;
          const big = e.weapon === 'tank_cannon' || e.weapon === 'mml';
          audio.play(big ? 'explosion_big' : 'explosion', { pos: e.pos, volume: 1 });
          this.particles.emit({ pos: e.pos, count: big ? 60 : 35, color: 0xff9040, speed: big ? 14 : 9, life: 0.7, spread: 1, up: 7, gravity: 8 });
          this.particles.emit({ pos: e.pos, count: 20, color: 0x555555, speed: 4, life: 1.2, spread: 1.5, up: 5, gravity: 2 });
          this.flashes.flash(e.pos, 0xffaa44, big ? 90 : 45, world.time);
          // the ACTUAL explosion (the rings below are the damage law; this is
          // the violence). Sized from the sim's own radii when the event
          // carries them; the bare emit sites get a stock frag-scale boom.
          this.fireballs.boom(e.pos, e.radius ?? (big ? 6.5 : 5.4), e.killRadius ?? 2.2, big);
          // SEE THE BLAST: two ground rings at the sim's exact radii. A blue
          // pulse marks a concussion (knockback, not death); HE is orange.
          if (e.radius) {
            const conc = e.weapon === 'conc_nade';
            this.spawnBlastRings(e.pos, e.killRadius ?? e.radius * 0.4, e.radius, conc ? 0x5cc8ff : 0xff7a30, world.time);
          }
          const local = world.soldiers.get(localId);
          if (local) {
            const d = Math.hypot(e.pos.x - local.pos.x, e.pos.z - local.pos.z);
            if (d < 30) this.camShake = Math.max(this.camShake, (big ? 0.9 : 0.5) * (1 - d / 30));
            // a CLOSE boom pushes the whole mix down for a beat — the duck is
            // what makes it feel big; loudness is relative, not absolute
            if (d < 40) audio.duck((big ? 0.55 : 0.35) * (1 - d / 40) + 0.15, big ? 0.7 : 0.45);
          }
          break;
        }
        case 'hit':
          if (e.pos) {
            // paintballs burst in their shooter's shade — and the splat STAYS.
            // A tagged soldier reports the shooter in soldierId; a ball that
            // ate a wall reports it in ownerId. Either way we want the thrower:
            // the yard should end up wearing everyone's colors, not one.
            if (world.mode.id === 'paintball' && e.weapon?.startsWith('marker')) {
              const paint = paintColorFor(e.ownerId ?? e.soldierId ?? -1, localId);
              this.particles.emit({ pos: e.pos, count: 10, color: paint, speed: 6, life: 0.3, spread: 0.3, up: 2.5 });
              this.spawnGoo(e.pos, paint, 0.55 + Math.random() * 0.4);
              // paint lands WET — the splat class's own jitter keeps 30
              // balls a minute organic (humanization lives in ONE place now)
              audio.play('splat', { pos: e.pos, volume: 0.55 });
              break;
            }
            if (e.soldierId !== undefined) {
              // BLOOD (Robert: "when shooting someone when armor is gone we
              // should see light blood splatter"). The sim tells us whether
              // the round met plate or flesh; the setting decides whether we
              // show it. Plate always sparks — that's information, not gore.
              const gore = settings.blood !== 'off' && e.bare && world.mode.id !== 'paintball';
              if (gore) {
                const full = settings.blood === 'full';
                this.particles.emit({
                  pos: e.pos, count: full ? 10 : 5, color: 0x8e1f1f,
                  speed: full ? 5 : 3.5, life: 0.3, spread: 0.22, up: 1.6, gravity: 9, size: 0.13,
                });
                // the ground remembers — small, dark, and it fades with the
                // rest of the field's paint (same capped FIFO decal pool)
                this.spawnSplat(e.pos, 0x6b1414, (full ? 0.3 : 0.19) + Math.random() * 0.12);
              } else {
                this.particles.emit({ pos: e.pos, count: 6, color: 0xffe0a0, speed: 5, life: 0.25, spread: 0.2, up: 2 });
              }
              audio.play('hit', { pos: e.pos, volume: 0.5 });
            } else {
              // the round hit the WORLD — it answers in its MATERIAL'S voice
              // (Robert: "hear it impact something" + W7.4 per-material VFX).
              // One table decides (materials.ts): a structural tile speaks as
              // its fabric (wall→dust, door→splinter, metal→spark, water→splash),
              // open ground as the SURFACE you'd walk on (ice→shatter, deck→
              // spark, grass→rustle, dirt→puff). No more three-bucket lumping.
              const t = tileAt(world.map.grid, e.pos.x, e.pos.z);
              const onFloor = t === T_OPEN || t === T_LADDER;
              const mat = onFloor ? materialForSurface(surfaceAt(world.map.surface, e.pos.x, e.pos.z)) : materialOf(t);
              this.spawnImpactFx(mat.impact, e.pos);
            }
          }
          break;
        case 'death':
          if (e.pos) {
            // a splatted paintballer goes down in the winner's color — the
            // biggest splat on the field marks where they sat down (no blood,
            // no death cry: it's PAINT — but the ragdoll still tumbles)
            if (world.mode.id === 'paintball') {
              const victim = e.soldierId !== undefined ? world.soldiers.get(e.soldierId) : undefined;
              const paint = paintColorFor(victim?.lastKillerId ?? -1, localId);
              this.particles.emit({ pos: { ...e.pos, y: 1 }, count: 26, color: paint, speed: 6, life: 0.6, spread: 0.6, up: 4 });
              this.spawnGoo(e.pos, paint, 1.7);
              audio.play('splat_big', { pos: e.pos, volume: 0.85 });
              if (e.soldierId !== undefined && e.fallX !== undefined) {
                this.deathFall.set(e.soldierId, { x: e.fallX, z: e.fallZ ?? 0 });
              }
              break;
            }
            // a death splashes only as hard as the setting allows (§18)
            if (settings.blood !== 'off') {
              const full = settings.blood === 'full';
              this.particles.emit({ pos: { ...e.pos, y: 1 }, count: full ? 22 : 12, color: 0xa03030, speed: 5, life: 0.6, spread: 0.5, up: 4 });
              this.spawnSplat(e.pos, 0x5e1010, full ? 0.85 : 0.5);
              // GORE / GIBS (STATUS §2, the death show): a VIOLENT death — an
              // explosive, or a heavy round that overkills — doesn't just splash,
              // it comes APART. Chunky flesh bits arc out and fall (high gravity,
              // long life), over a wetter mist and a wider pool. Still gated on
              // the blood setting, so reduced-gore players never see it.
              const wd = e.weaponId ? WEAPONS[e.weaponId] : undefined;
              if (wd && ((wd.splash ?? 0) > 0 || wd.damage >= 40)) {
                this.particles.emit({ pos: { ...e.pos, y: 1 }, count: full ? 14 : 8, color: 0x7a1e1e, speed: 7, life: 0.85, spread: 0.7, up: 5, gravity: 14, size: full ? 0.34 : 0.28 }); // the chunks
                this.particles.emit({ pos: { ...e.pos, y: 1.1 }, count: full ? 16 : 9, color: 0xb84040, speed: 6, life: 0.4, spread: 0.6, up: 4.5, gravity: 8, size: 0.15 }); // wet mist
                this.spawnSplat(e.pos, 0x4a0e0e, full ? 1.2 : 0.8); // a wider pool
              }
            }
            // each class has its own death cry; zombies/scientist use the generic
            const cry = e.classId ? (`death_${e.classId}` as SoundName) : 'death';
            audio.play(cry, { pos: e.pos, volume: 0.85 });
          }
          // hand the ragdoll its fall direction (away from the killing shot)
          if (e.soldierId !== undefined && e.fallX !== undefined) {
            this.deathFall.set(e.soldierId, { x: e.fallX, z: e.fallZ ?? 0 });
          }
          break;
        case 'heal':
          if (e.pos) this.particles.emit({ pos: { ...e.pos, y: 1.5 }, count: 6, color: 0x60ff90, speed: 2, life: 0.5, spread: 0.6, up: 3, gravity: -2 });
          break;
        case 'whistle':
          // the referee owns the yard: not positional — a round bookend
          // should never be quiet because you sat down across the field.
          // The duck clears the air so the pea cuts through the paint.
          audio.duck(0.35, 0.4);
          audio.play('whistle', { volume: 0.7 });
          break;
        case 'encased':
          // the ice takes someone — a crystalline shimmer that snaps shut
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 16, color: 0xcdeef7, speed: 3, life: 0.5, spread: 0.5, up: 3, gravity: -1 });
            audio.play('ice_freeze', { pos: e.pos, volume: 0.8 });
          }
          break;
        case 'water_froze':
          // row 246: a tile crusts over — a low crystalline puff at the waterline
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 0.15 }, count: 6, color: 0xdcf1f9, speed: 1.6, life: 0.55, spread: 1.1, up: 1, gravity: -0.5, size: 0.3 });
          }
          break;
        case 'dash': {
          // the burst reads as lines peeling off the mover
          if (e.pos) this.particles.emit({ pos: { x: e.pos.x, y: 0.9, z: e.pos.z }, count: 7, color: 0xdfe9f2, speed: 7, life: 0.28, spread: 0.6, up: 0.4, gravity: 0 });
          break;
        }
        case 'leap': {
          // the coil released — a kick of dirt where the spring left the deck
          if (e.pos) this.particles.emit({ pos: { x: e.pos.x, y: 0.3, z: e.pos.z }, count: 8, color: 0xcdb98f, speed: 5, life: 0.35, spread: 0.9, up: 1.4, gravity: 6 });
          if (e.soldierId === localId) audio.play('gravlift', { volume: 0.3, rate: 1.35 });
          break;
        }
        case 'leapland': {
          // the LOUD landing — a dust ring and a flat thump. The map heard it.
          if (e.pos) {
            this.particles.emit({ pos: { x: e.pos.x, y: 0.25, z: e.pos.z }, count: 14, color: 0x9a8a68, speed: 6, life: 0.45, spread: 1.4, up: 0.8, gravity: 9 });
            audio.play('thump', { pos: e.pos, volume: 0.5, rate: 0.8 });
          }
          break;
        }
        case 'torch': // §10: the flashlight clicks
          if (e.soldierId === localId) audio.play('ui_click', { volume: 0.4, rate: 1.3 });
          break;
        case 'corpse_slam': {
          // A BODY MEETS MASONRY (Robert: "knock you into a wall or
          // something?"). Dust off the wall, a smear where it hit, and the
          // low flat report of dead weight arriving — not a gunshot, a THUD.
          if (e.pos) {
            this.particles.emit({ pos: { x: e.pos.x, y: 0.9, z: e.pos.z }, count: 12, color: 0x8a7a5c, speed: 4.5, life: 0.5, spread: 1.1, up: 2.5, gravity: 8 });
            if (settings.blood !== 'off') {
              const full = settings.blood === 'full';
              this.particles.emit({ pos: { x: e.pos.x, y: 1.1, z: e.pos.z }, count: full ? 14 : 7, color: 0xa03030, speed: 4, life: 0.5, spread: 0.9, up: 1.6, gravity: 10, size: 0.14 });
              this.spawnSplat(e.pos, 0x5e1010, full ? 0.7 : 0.42);
            }
            audio.play('thump', { pos: e.pos });
          }
          if (e.soldierId === localId) this.camShake = Math.max(this.camShake, 0.7);
          break;
        }
        case 'vehicle_enter': {
          // A SQUADMATE ABOARD IS NEWS (Robert: "when the bots get in a
          // vehicle with you, them telling you to do something like Let's Go
          // — so you know"). Two cases speak: a bot drops into a ride YOU are
          // in, or you take a ride bots are already holding. Silence for
          // everything happening to other people's vehicles.
          if (e.vehicleId === undefined || e.soldierId === undefined) break;
          const me = world.soldiers.get(localId);
          if (!me || me.vehicleId !== e.vehicleId) break;
          const veh = world.vehicles.get(e.vehicleId);
          if (!veh) break;
          const boarder = world.soldiers.get(e.soldierId);
          const botJoinedMe = e.soldierId !== localId && boarder?.kind === 'bot';
          const iJoinedBots = e.soldierId === localId
            && veh.seats.some((id) => id >= 0 && id !== localId && world.soldiers.get(id)?.kind === 'bot');
          if (botJoinedMe || iJoinedBots) {
            const lines = ['crew_letsgo', 'crew_gogogo', 'crew_punchit', 'crew_allin'] as const;
            audio.play(lines[(this.crewLine++) % lines.length], { pos: e.pos });
          }
          break;
        }
        case 'ragdoll': {
          if (e.pos) this.particles.emit({ pos: { x: e.pos.x, y: 0.4, z: e.pos.z }, count: 6, color: 0x8a7a5c, speed: 3, life: 0.4, spread: 0.8, up: 2, gravity: 6 });
          if (e.soldierId === localId) this.camShake = Math.max(this.camShake, 0.55);
          break;
        }
        case 'nade_bounce':
          // the TING of a steel can on the deck — the sound that says GET AWAY.
          // Rate jitter keeps the second and third bounce from being the first
          // one twice; the settle tick arrives naturally quieter (energy's spent).
          if (e.pos) audio.play('nade_tink', { pos: e.pos, volume: 0.6, rate: 0.92 + Math.random() * 0.34 });
          break;
        case 'vo':
          // a spoken line: positional = the LSW's own mouth (only nearby
          // ears hear it — the earshot class does the math); no pos = the
          // announcer's radio net, map-wide and exact
          if (e.text) {
            if (e.pos) audio.play(e.text as SoundName, { pos: e.pos, volume: 0.95 });
            else audio.play(e.text as SoundName, { volume: 0.85 });
          }
          break;
        case 'lsw_active': {
          // THE POWER-CAST (feel pass #6): the body throws the signature
          // before it lands — SLAM / THRUST / CHANNEL by school
          if (e.soldierId !== undefined && e.text) {
            this.castPoses.set(e.soldierId, {
              at: world.time, until: world.time + 0.6,
              school: CAST_SCHOOL[e.text] ?? 'thrust',
            });
          }
          // a piloted LSW fired its signature — each speaks in its own voice
          if (!e.pos) break;
          if (e.text === 'firebrand') {
            audio.play('fire_whoosh', { pos: e.pos, volume: 0.95 });
            this.particles.emit({ pos: { ...e.pos, y: 0.6 }, count: 24, color: 0xff7a20, speed: 8, life: 0.5, spread: 1.4, up: 4, gravity: -2 });
          } else if (e.text === 'plaguebearer') {
            audio.play('gas_hiss', { pos: e.pos, volume: 0.9 });
            this.particles.emit({ pos: { ...e.pos, y: 0.8 }, count: 22, color: 0x8fbe42, speed: 5, life: 0.8, spread: 1.6, up: 2, gravity: 1 });
          } else if (e.text === 'ragebeast') {
            audio.play('rage_roar', { pos: e.pos, volume: 0.95 });
            this.particles.emit({ pos: { ...e.pos, y: 0.3 }, count: 30, color: 0x8a7f6a, speed: 9, life: 0.7, spread: 1.8, up: 5, gravity: 7 });
            const localS = world.soldiers.get(localId);
            if (localS) {
              const d = Math.hypot(e.pos.x - localS.pos.x, e.pos.z - localS.pos.z);
              if (d < 22) this.camShake = Math.max(this.camShake, 0.6 * (1 - d / 22));
            }
          } else if (e.text === 'frostbite') {
            // the freeze itself speaks via the encased event — this is just
            // the pilot's cast flourish
            this.particles.emit({ pos: { ...e.pos, y: 1 }, count: 10, color: 0xcdeef7, speed: 3, life: 0.4, spread: 0.6, up: 2, gravity: -1 });
          }
          break;
        }
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
            const lv = world.soldiers.get(localId);
            const dv = lv ? Math.hypot(e.pos.x - lv.pos.x, e.pos.z - lv.pos.z) : 99;
            if (dv < 50) audio.duck(0.5 * (1 - dv / 50) + 0.15, 0.7);
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
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 18, color: 0x3fe0c8, speed: 4, life: 0.45, spread: 0.5, up: 3, gravity: -2 });
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
            this.particles.emit({ pos: { ...e.pos, y: 0.4 }, count: 14, color: 0x40d8c0, speed: 3, life: 0.5, spread: 0.8, up: 9, gravity: -2 });
            audio.play('gravlift', { pos: e.pos, volume: 0.7 });
          }
          break;
        case 'beacon_planted':
          if (e.pos) {
            if (e.text === 'Smoke deployed') {
              // the smoke POP: a pressure hiss and a fast-blooming bank —
              // this is a grenade paying off, not a gadget beeping
              audio.play('gas_hiss', { pos: e.pos, volume: 0.85 });
              this.particles.emit({ pos: { ...e.pos, y: 0.5 }, count: 26, color: 0xc8c4b6, speed: 3.5, life: 1.4, spread: 1.6, up: 1.6, gravity: 0.4, size: 0.9 });
              this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 14, color: 0xb8b4a8, speed: 2, life: 1.8, spread: 1.2, up: 1, gravity: 0.2, size: 1.1 });
            } else {
              audio.play(e.big ? 'orbital_charge' : 'beacon', { pos: e.pos, volume: e.big ? 1 : 0.7 });
              this.particles.emit({ pos: { ...e.pos, y: 0.8 }, count: 8, color: e.big ? 0xff4030 : 0xffcf70, speed: 2, life: 0.4, spread: 0.4, up: 3 });
            }
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
          audio.duck(0.6, 0.9); // an orbital strike SILENCES the field for a breath
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
        case 'drone_crash':
          // an FPV drone hit the dirt: dust, plastic shards, rotor bits
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 0.4 }, count: 18, color: 0x8a7f6a, speed: 5, life: 0.7, spread: 0.8, up: 3, gravity: 7 });
            this.particles.emit({ pos: { ...e.pos, y: 0.4 }, count: 10, color: 0x3a3f46, speed: 7, life: 0.5, spread: 0.4, up: 4, gravity: 9 });
            audio.play('drone_crash', { pos: e.pos, volume: 0.9 });
          }
          break;
        case 'door':
          if (e.pos) {
            if (!audio.play('door', { pos: e.pos, volume: 0.7 })) audio.play('reload', { pos: e.pos, volume: 0.4, rate: 0.7 });
          }
          break;
        case 'sparks':
          if (e.pos) {
            // the drill met metal: white-hot spray, zero progress
            this.particles.emit({ pos: e.pos, count: 16, color: 0xffe9a0, speed: 7, life: 0.35, spread: 0.4, up: 3, gravity: 9, size: 0.22 });
            this.particles.emit({ pos: e.pos, count: 6, color: 0xffffff, speed: 9, life: 0.2, spread: 0.3, up: 2, gravity: 9, size: 0.16 });
            audio.play('hit', { pos: e.pos, volume: 0.55, rate: 1.6 });
          }
          break;
        case 'doorhit': {
          // something is banging on a door — splinters fly, wood thuds
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 8, color: 0x8a5a2a, speed: 4, life: 0.45, spread: 0.7, up: 2.5, gravity: 8 });
            if (!audio.play('door_hit', { pos: e.pos, volume: 0.65 })) {
              audio.play('thump', { pos: e.pos, volume: 0.4, rate: 1.4 });
            }
          }
          break;
        }
        case 'ladder': {
          if (e.pos && !audio.play('footstep_metal', { pos: e.pos, volume: 0.6, rate: 0.75 })) {
            audio.play('reload', { pos: e.pos, volume: 0.4, rate: 1.3 });
          }
          break;
        }
        case 'doorbreak': {
          // the door gave way — a plank storm and a wood crash
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.3 }, count: 26, color: 0x8a5a2a, speed: 6, life: 0.8, spread: 1.1, up: 4, gravity: 8 });
            this.particles.emit({ pos: { ...e.pos, y: 0.8 }, count: 12, color: 0x6b4a2a, speed: 4, life: 0.6, spread: 0.9, up: 3, gravity: 9 });
            if (!audio.play('door_break', { pos: e.pos, volume: 0.85 })) {
              audio.play('autocannon', { pos: e.pos, rate: 0.5, volume: 0.6 });
            }
            const local = world.soldiers.get(localId);
            if (local && e.pos) {
              const d = Math.hypot(e.pos.x - local.pos.x, e.pos.z - local.pos.z);
              if (d < 18) this.camShake = Math.max(this.camShake, 0.35 * (1 - d / 18));
            }
          }
          break;
        }
        case 'wallbreak': {
          // DESTRUCTION: masonry breached to a rubble TILE — drop the wall,
          // pile a knee-high breach (the tile is real cover now), dust + crash
          if (e.tile !== undefined) this.collapseTile(e.tile);
          if (e.pos) {
            this.breachPile(e.pos.x, e.pos.z);
            this.particles.emit({ pos: { ...e.pos, y: 1.8 }, count: 34, color: 0x8a7f6a, speed: 6, life: 0.9, spread: 1.3, up: 5, gravity: 7 });
            if (!audio.play('explosion', { pos: e.pos, volume: 0.7 })) audio.play('impact_stone', { pos: e.pos, volume: 0.8 });
            const local = world.soldiers.get(localId);
            if (local) {
              const d = Math.hypot(e.pos.x - local.pos.x, e.pos.z - local.pos.z);
              if (d < 20) this.camShake = Math.max(this.camShake, 0.4 * (1 - d / 20));
            }
          }
          break;
        }
        case 'dig': {
          // the tunneler ground a wall to rubble — drop the instance, kick up
          // dust, and LEAVE THE RUBBLE: low-poly chunks stay where the wall
          // died (walkable debris — the collision is already gone)
          if (e.tile !== undefined) this.collapseTile(e.tile);
          if (e.pos) {
            for (let ri = 0; ri < 3; ri++) {
              const sz = 0.35 + Math.random() * 0.5;
              const chunk = new THREE.Mesh(
                new THREE.BoxGeometry(sz, sz * 0.6, sz * 0.8),
                this.rubbleMat ?? (this.rubbleMat = new THREE.MeshStandardMaterial({ color: 0x6f6656, roughness: 0.95 })),
              );
              chunk.position.set(
                e.pos.x + (Math.random() - 0.5) * TILE * 0.8,
                sz * 0.25,
                e.pos.z + (Math.random() - 0.5) * TILE * 0.8,
              );
              chunk.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
              chunk.castShadow = true;
              this.scene.add(chunk);
              this.rubble.push(chunk);
            }
            // cap the debris field — the oldest chunks crumble away
            while (this.rubble.length > 240) {
              const old = this.rubble.shift()!;
              this.scene.remove(old);
              old.geometry.dispose();
            }
            this.particles.emit({ pos: { ...e.pos, y: 1.5 }, count: 26, color: 0x8a7f6a, speed: 5, life: 0.8, spread: 1.2, up: 4, gravity: 6 });
            // slowed autocannon reads as teeth chewing rock, not a blast
            audio.play('autocannon', { pos: e.pos, rate: 0.6, volume: 0.55 });
            // anyone standing close feels the grind through their boots
            const local = world.soldiers.get(localId);
            if (local) {
              const d = Math.hypot(e.pos.x - local.pos.x, e.pos.z - local.pos.z);
              if (d < 24) this.camShake = Math.max(this.camShake, 0.45 * (1 - d / 24));
            }
          }
          break;
        }
        case 'system_damaged':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.6 }, count: 18, color: 0xffc040, speed: 7, life: 0.5, spread: 0.6, up: 4 });
            audio.play('emp_burst', { pos: e.pos, volume: 0.5 });
          }
          break;
        case 'hacked':
          if (e.pos) {
            this.particles.emit({ pos: { ...e.pos, y: 1.2 }, count: 22, color: 0x60ff90, speed: 4, life: 0.6, spread: 0.5, up: 3, gravity: -1 });
            audio.play('cloak', { pos: e.pos, volume: 0.8 });
          }
          break;
        case 'psi_ping':
          // your scanner found someone: a teal flare where they are
          if (e.pos && e.soldierId === localId) {
            this.particles.emit({ pos: { ...e.pos, y: 1.6 }, count: 12, color: 0x3fe0c8, speed: 2.5, life: 0.7, spread: 0.4, up: 3, gravity: -2 });
            audio.play('beacon', { volume: 0.5 });
          }
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
