// ═══════════════════════════════════════════════════════════════════════════
// THE SCHOOLS — the certification PROGRAMS.
//
// Robert: *"create the certification programs… don't stop until you have
// programs that help new players use any of the vehicles."* So a licence is
// not a checkbox you buy — it is a course you DRIVE, and the course teaches
// while it tests. Every drill carries a lesson in one line, because the
// player is learning the hull, not memorising a menu.
//
// A course is a list of DRILLS. Each drill lays down gates procedurally from
// its own shape (no hand-placed coordinates, no map dependency), so a course
// runs on any flat ground the Proving Grounds can offer. Drive the gates in
// order, inside par, and the school signs your papers.
//
// Pure data + pure layout maths — no THREE, no DOM, no rng. tests/courses.
// ═══════════════════════════════════════════════════════════════════════════
import type { LicenceId } from './licenses';
import type { VehicleKind, Vec3 } from './types';

export type DrillKind = 'straight' | 'slalom' | 'brakebox' | 'handbrake' | 'parking' | 'circuit';

export interface Drill {
  kind: DrillKind;
  /** The board outside the drill — what it's called. */
  name: string;
  /** THE LESSON: one line, taught before the gate, in the school's voice. */
  lesson: string;
}

export interface CourseGate {
  pos: Vec3;
  radius: number;
  /** which drill this gate belongs to (the HUD shows that drill's lesson) */
  drill: number;
}

export interface Course {
  licence: LicenceId;
  /** The hull the school puts you in — you learn on the machine you'll drive. */
  hull: VehicleKind;
  name: string;
  /** The instructor's opening line. */
  brief: string;
  drills: Drill[];
  /** Seconds to beat. Generous: this is a school, not a time trial. */
  par: number;
}

/** The programs, one per licence that can be taught. */
export const COURSES: Partial<Record<LicenceId, Course>> = {
  basic_driver: {
    licence: 'basic_driver', hull: 'sedan', name: 'Basic Driver',
    brief: 'A car goes where its weight is going. Learn that here and the rest of the war is easier.',
    par: 105,
    drills: [
      { kind: 'straight', name: 'The Lane', lesson: 'Throttle is a dial, not a switch — ease it on and the car settles.' },
      { kind: 'slalom', name: 'The Slalom', lesson: 'Weight moves BEFORE the car does. Turn late, turn once.' },
      { kind: 'brakebox', name: 'The Box', lesson: 'Brake in a straight line. Stop inside the box, not through it.' },
      { kind: 'parking', name: 'The Bay', lesson: 'Slow is smooth. Put it in the bay without touching the cones.' },
    ],
  },
  heavy_truck: {
    licence: 'heavy_truck', hull: 'movingtruck', name: 'Heavy Truck',
    brief: 'Five tonnes forgives nothing. Everything you learned in a car happens later and bigger here.',
    par: 135,
    drills: [
      { kind: 'straight', name: 'Getting Under Way', lesson: 'It builds speed slowly and loses it slower. Plan two corners ahead.' },
      { kind: 'brakebox', name: 'The Long Stop', lesson: 'Mass is why you brake early. Start the stop before you think you need it.' },
      { kind: 'slalom', name: 'The Wide Line', lesson: 'A long hull swings its tail. Give the corner room you do not think you need.' },
      { kind: 'parking', name: 'The Dock', lesson: 'Back it in slowly. Nobody was ever fired for taking a second look.' },
    ],
  },
  hovercraft: {
    licence: 'hovercraft', hull: 'hoverboard', name: 'Hovercraft & Decks',
    brief: 'Nothing touches the ground. The floor stops being your friend and momentum becomes the whole conversation.',
    par: 95,
    drills: [
      { kind: 'straight', name: 'The Float', lesson: 'No wheels, no bite. You steer the nose; the deck arrives when it arrives.' },
      { kind: 'slalom', name: 'The Weave', lesson: 'Lean early. A hover deck answers a question you asked a second ago.' },
      { kind: 'handbrake', name: 'The Pivot', lesson: 'Break the back loose on purpose, then catch it. That is the whole trick.' },
    ],
  },
  apc: {
    licence: 'apc', hull: 'apc', name: 'APC',
    brief: 'You are carrying people now. The hull protects them; your driving decides whether it has to.',
    par: 130,
    drills: [
      { kind: 'straight', name: 'The Column', lesson: 'Armour is heavy and blind. Speed is not the same thing as progress.' },
      { kind: 'brakebox', name: 'The Halt', lesson: 'Stop where the squad can dismount into cover, not into the open.' },
      { kind: 'circuit', name: 'The Route', lesson: 'Tracks corner by pivoting, not sliding — turn IN, then power out.' },
    ],
  },
  tank: {
    licence: 'tank', hull: 'tank', name: 'Tank',
    brief: 'Sixty tonnes. There is no handbrake, no slide and no second chance at a bridge.',
    par: 150,
    drills: [
      { kind: 'straight', name: 'The Advance', lesson: 'It never hurries. Commit to a line and the ground gives way, not you.' },
      { kind: 'brakebox', name: 'The Stand', lesson: 'A tank stops by deciding to, long before it arrives.' },
      { kind: 'circuit', name: 'The Sweep', lesson: 'Hull down, turret up: drive the body, aim the gun, never confuse them.' },
    ],
  },
  boat: {
    licence: 'boat', hull: 'speedboat', name: 'Boat',
    brief: 'Water has no brakes. You steer with the throttle and stop with patience.',
    par: 110,
    drills: [
      { kind: 'straight', name: 'The Channel', lesson: 'Power turns the boat; the rudder only suggests. Keep some on through the corner.' },
      { kind: 'slalom', name: 'The Buoys', lesson: 'A hull keeps sliding across the water. Aim where you will BE.' },
      { kind: 'brakebox', name: 'The Mooring', lesson: 'Come off the throttle a long way out. That is the stop.' },
    ],
  },
  helicopter: {
    licence: 'helicopter', hull: 'newsheli', name: 'Helicopter',
    brief: 'A rotor lets you stop in the sky. Everything else about that is your problem.',
    par: 120,
    drills: [
      { kind: 'straight', name: 'The Transit', lesson: 'Nose down to go, nose up to stop. The aircraft leans where it is going.' },
      { kind: 'slalom', name: 'The Corridor', lesson: 'Rotors need room. Bank gently and let the tail follow you round.' },
      { kind: 'parking', name: 'The Pad', lesson: 'A landing is a hover you slowly stop having.' },
    ],
  },
  fixed_wing: {
    licence: 'fixed_wing', hull: 'bushplane', name: 'Fixed Wing',
    brief: 'This one cannot stop flying. Let go of the throttle and it keeps going — that is not a fault, it is the aircraft.',
    par: 115,
    drills: [
      { kind: 'straight', name: 'The Run', lesson: 'You have a minimum speed. Below it there is no flying, only falling.' },
      { kind: 'circuit', name: 'The Pattern', lesson: 'Fly PASSES, never park in the sky. Come round again — you always can.' },
      { kind: 'slalom', name: 'The Gates', lesson: 'Bank into the turn and pull. The wing turns you; the rudder tidies it.' },
    ],
  },
  transport: {
    licence: 'transport', hull: 'transport', name: 'Transport',
    brief: 'Big, slow, full, and everybody is counting on you. Fly it like a bus with a good view.',
    par: 140,
    drills: [
      { kind: 'straight', name: 'The Lift', lesson: 'Loaded weight is patience. Give it the room it asks for.' },
      { kind: 'circuit', name: 'The Corridor', lesson: 'Plan the whole route before you roll. Passengers cannot see out.' },
      { kind: 'parking', name: 'The Ramp', lesson: 'Set it down flat and level, every time.' },
    ],
  },
  bomber: {
    licence: 'bomber', hull: 'bomber', name: 'Bomber',
    brief: 'The seat nobody gets early. You are slow, enormous, and the whole sky knows where you are.',
    par: 160,
    drills: [
      { kind: 'straight', name: 'The Approach', lesson: 'You cannot dodge. Your defence is the route you chose an hour ago.' },
      { kind: 'circuit', name: 'The Run In', lesson: 'Hold the line through the drop. A wobble here misses by a street.' },
      { kind: 'brakebox', name: 'The Egress', lesson: 'Leave the way you planned to leave. Improvising costs the airframe.' },
    ],
  },
  drone_pilot: {
    licence: 'drone_pilot', hull: 'buggy', name: 'Drone Pilot',
    brief: 'You are not in the vehicle. Nothing you feel is real — only what the feed tells you.',
    par: 100,
    drills: [
      { kind: 'slalom', name: 'The Feed', lesson: 'Trust the picture, not your stomach. The lag is part of the machine.' },
      { kind: 'straight', name: 'The Range', lesson: 'Signal thins with distance. Know where your leash ends.' },
      { kind: 'parking', name: 'The Return', lesson: 'Bring it home. A recovered drone flies again tomorrow.' },
    ],
  },
  dropship: {
    licence: 'dropship', hull: 'transportheli', name: 'Dropship',
    brief: 'The squad rides in the back. Insertion is a promise you make to eight people.',
    par: 145,
    drills: [
      { kind: 'straight', name: 'The Ingress', lesson: 'Fast and low. The longer you are visible, the longer they are.' },
      { kind: 'handbrake', name: 'The Flare', lesson: 'Kill the speed in one committed move, not five nervous ones.' },
      { kind: 'parking', name: 'The Drop', lesson: 'Down, doors, gone. Time on the ground is the only number that matters.' },
    ],
  },
};

// ── the layout: drills become gates, deterministically ─────────────────────

const GATE_R = 4.5;

/** Lay one drill down starting at `from`, running along +X. Returns its gates
 *  and where the next drill begins — so a course is a chain, not a map. */
function layDrill(d: Drill, from: Vec3, index: number): { gates: CourseGate[]; next: Vec3 } {
  const g: CourseGate[] = [];
  const at = (x: number, z: number, r = GATE_R) => g.push({ pos: { x, y: 0, z }, radius: r, drill: index });
  let x = from.x;
  const z0 = from.z;
  switch (d.kind) {
    case 'straight':
      for (let i = 0; i < 4; i++) { x += 26; at(x, z0); }
      break;
    case 'slalom':
      for (let i = 0; i < 6; i++) { x += 18; at(x, z0 + (i % 2 === 0 ? 11 : -11), 4); }
      x += 16; at(x, z0);
      break;
    case 'brakebox':
      x += 40; at(x, z0);            // arrive carrying speed
      x += 22; at(x, z0, 3.2);       // …and stop inside a tight box
      break;
    case 'handbrake':
      x += 30; at(x, z0);
      x += 14; at(x, z0 + 20, 4);    // the hairpin: 90° out
      x -= 6; at(x, z0 + 38, 4);     // …and back the other way
      x += 26; at(x, z0 + 30);
      break;
    case 'parking':
      x += 24; at(x, z0);
      x += 12; at(x, z0 + 14, 2.6);  // the bay — precision, not speed
      break;
    case 'circuit': {
      // the ring OPENS where the candidate arrives (angle π = its left edge),
      // so there is never a leap between the approach and gate one
      const cx = x + 46, cz = z0;
      for (let i = 0; i < 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI * 2;
        at(cx + Math.cos(a) * 46, cz + Math.sin(a) * 30);
      }
      x = cx - 46;
      break;
    }
  }
  const last = g[g.length - 1];
  return { gates: g, next: last ? { ...last.pos } : { ...from } };
}

/** The whole course as an ordered gate list, laid from an origin. Pure and
 *  deterministic: the same course is the same course on every machine. */
export function layCourse(course: Course, origin: Vec3 = { x: -120, y: 0, z: -55 }): CourseGate[] {
  const gates: CourseGate[] = [];
  let cursor = { ...origin };
  // THE SERPENTINE: drills run +X, but a four-drill course is ~330u of
  // ground and the world is 300 wide — so when a drill would push past the
  // fold line, the course TURNS BACK and runs the next one on a fresh lane.
  // (A course that leaves the map is a course nobody can finish.)
  const FOLD_X = 20; // the longest drill is ~124u — fold early enough that it still fits
  const LANE = 58;
  const LINK_STEP = 55; // no gap a driver has to guess their way across
  course.drills.forEach((d, i) => {
    if (cursor.x > FOLD_X) {
      // THE CONNECTING ROAD: a fold is a U-turn, and a U-turn the driver
      // cannot see is just a gap. Lay link gates back down the new lane so
      // the route stays continuous — they belong to the drill they lead TO.
      const turn = { x: cursor.x, y: 0, z: cursor.z + LANE };
      gates.push({ pos: { ...turn }, radius: GATE_R, drill: i });
      const span = turn.x - origin.x;
      const steps = Math.max(1, Math.ceil(span / LINK_STEP));
      for (let k = 1; k <= steps; k++) {
        gates.push({
          pos: { x: turn.x - (span * k) / steps, y: 0, z: turn.z },
          radius: GATE_R, drill: i,
        });
      }
      cursor = { x: origin.x, y: 0, z: turn.z };
    }
    const laid = layDrill(d, cursor, i);
    gates.push(...laid.gates);
    cursor = laid.next;
  });
  return gates;
}

/** The course a licence is earned on (undefined = no program yet). */
export function courseFor(licence: LicenceId): Course | undefined {
  return COURSES[licence];
}

/** Every program the school runs, in the licence ladder's own order. */
export function allCourses(): Course[] {
  return Object.values(COURSES) as Course[];
}
