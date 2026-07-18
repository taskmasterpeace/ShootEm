// ---------------------------------------------------------------------------
// THE STABLE'S BRAINS (§5): one file per LSW — `src/sim/lsw/<id>.ts` — each
// deterministic and DOM-free, each carrying BOTH abilities. `step` is the
// bot's cadence + passives (called every tick the LSW is alive); `active` is
// the pilot's Q — it returns true only when the signature actually fired, so
// world.ts charges the cooldown ONLY on a real cast (whiffs keep the key hot).
// ---------------------------------------------------------------------------
import type { AscendantId, Soldier } from '../types';
import type { World } from '../world';
import * as barrier from './barrier';
import * as chronos from './chronos';
import * as dominator from './dominator';
import * as eclipse from './eclipse';
import * as firebrand from './firebrand';
import * as frostbite from './frostbite';
import * as gravwarden from './gravwarden';
import * as magnetar from './magnetar';
import * as oblivion from './oblivion';
import * as plaguebearer from './plaguebearer';
import * as ragebeast from './ragebeast';
import * as reactor from './reactor';
import * as riptide from './riptide';
import * as sniperhawk from './sniperhawk';
import * as titan from './titan';
import * as tremor from './tremor';
import * as voltstriker from './voltstriker';
import * as wraith from './wraith';

export interface LswBrain {
  step: (w: World, s: Soldier, dt: number) => void;
  active: (w: World, s: Soldier) => boolean;
}

export const LSW_BRAINS: Record<AscendantId, LswBrain> = {
  firebrand, plaguebearer, frostbite, ragebeast, titan, voltstriker,
  sniperhawk, barrier, reactor, oblivion, tremor, magnetar, wraith,
  eclipse, dominator, riptide, gravwarden, chronos,
};
