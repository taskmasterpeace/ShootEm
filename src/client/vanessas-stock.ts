// ---------------------------------------------------------------------------
// VANESSA'S PAINTBALL — the stock ledger (Robert, 2026-07-22: "you go to a
// paintball store. Call it Vanessa's paintball… you could choose your gun.
// Or rent a gun… go to the different booths — you should be able to see it.")
//
// This module is the SHOP'S TRUTH, kept apart from the scene so the test
// suite can hold it honest: every marker the arsenal ships must have a booth,
// a pitch, and a line from Vanessa. Stats on the card are read LIVE from
// WEAPONS — the shop never invents a number.
// ---------------------------------------------------------------------------
import { WEAPONS } from '../sim/data';
import type { WeaponId } from '../sim/types';

export interface BoothStock {
  id: WeaponId;
  /** the shelf tag — how the house files it */
  tag: string;
  /** the pitch on the card, one honest sentence */
  pitch: string;
  /** what Vanessa says when you step to the booth */
  vanessa: string;
  /** wall splat + trim color for the booth (hex) — NO PURPLE, house law */
  paint: number;
}

/** The booths, in shelf order — walk the wall left to right. */
export const STOCK: BoothStock[] = [
  {
    id: 'marker_blitz',
    tag: 'THE WORKHORSE',
    pitch: 'Hopper-fed semi — 30 balls deep, throws paint faster than anyone can apologize.',
    vanessa: 'The Blitz eats pods, hon. Bring dry gloves and a plan.',
    paint: 0xe8632c, // house orange
  },
  {
    id: 'marker_pump',
    tag: 'THE LONGBALL',
    pitch: 'One pump, one lane, the tightest string in the shop — the Belt was won with one.',
    vanessa: "That one's mine. You clean it before you bring it back.",
    paint: 0x35c8e8, // pool teal
  },
  {
    id: 'marker_scatter',
    tag: 'THE HALLWAY ANSWER',
    pitch: 'Seven balls a squeeze. Inside sixteen units there is no argument left.',
    vanessa: "The Fan doesn't aim, sweetheart. It VOTES.",
    paint: 0x7cc44a, // splat green
  },
  {
    id: 'marker_lobber',
    tag: 'THE RAINMAKER',
    pitch: 'Lobs paint over the bunker and paints everyone under the landing.',
    vanessa: 'Rent the Lobber and the maze plays different. Ask the ceiling.',
    paint: 0xe8a33d, // trophy amber
  },
];

/** Live card stats — read straight off the arsenal, never hand-copied. */
export function boothStats(id: WeaponId): { name: string; rate: string; reach: string; hopper: string; pods: string } {
  const d = WEAPONS[id];
  return {
    name: d.name,
    rate: d.pellets ? `${d.pellets} balls / squeeze` : `${d.rof} balls / sec`,
    reach: `${d.range}u${d.arc ? ' · lobbed' : ''}`,
    hopper: `${d.clip} balls`,
    pods: `${Math.ceil((d.reserve ?? 0) / Math.max(1, d.clip))} pods on the belt`,
  };
}
