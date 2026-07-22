// ---------------------------------------------------------------------------
// THE YARD'S PEOPLE (docs/COMPETITIVE-ARC.md §4, Robert: "what if you're
// going against SPECIFIC people when you play paintball… make bots talk
// trash to you"). Seven named regulars. They are not random bots: every
// paintball roster is drawn from this table, so the same names come back
// match after match — the Cup lineage grows grudges, the Belt has a rival's
// name on it, and every one of them has a MOUTH.
//
// A persona is data the way a map is data: name, play style (drives the AI
// through pbStyleOf), signature marker, and three line tables — the whistle
// call, the splat taunt, and the PROXIMITY taunt (yelled when they close on
// a human; Robert: "they should be able to yell at me when they're within
// distance"). Lines render as overhead barks ('bark' events) — the words
// literally hang over their heads. Voice packs come later (#114); these
// tables are their scripts.
// ---------------------------------------------------------------------------
import type { WeaponId } from './types';
import type { PbStyle } from './paintball';

export interface PbPersona {
  id: string;
  name: string;
  style: PbStyle;
  marker: WeaponId;
  lines: { start: string[]; splat: string[]; taunt: string[] };
}

export const PB_PERSONAS: PbPersona[] = [
  {
    id: 'vex', name: 'Vex', style: 'rusher', marker: 'marker_blitz',
    lines: {
      start: ['CLOCK\'S RUNNING — SO AM I!', 'FIRST BALL\'S MINE. ALWAYS IS.', 'DON\'T BLINK OUT THERE!'],
      splat: ['WIPE THAT! OH WAIT — YOU CAN\'T!', 'TOO SLOW, SUNSHINE!', 'THAT\'S THE VEX SPECIAL!'],
      taunt: ['I CAN HEAR YOU BREATHING!', 'RUN! IT\'S FUNNIER!', 'CLOSER… CLOSER…'],
    },
  },
  {
    id: 'piston', name: 'Piston', style: 'rusher', marker: 'marker_scatter',
    lines: {
      start: ['SEVEN BALLS SAY HELLO.', 'DOORWAYS ARE MINE TODAY.', 'LET\'S GO LOUD.'],
      splat: ['WALL OF PAINT, BABY!', 'THE FAN FORGIVES NOBODY!', 'CLEAN SWEEP!'],
      taunt: ['WRONG HALLWAY, FRIEND!', 'STEP OUT. I DARE YOU.', 'YOU HEAR THE FAN SPINNING?'],
    },
  },
  {
    id: 'widow', name: 'Widow', style: 'flanker', marker: 'marker_pump',
    lines: {
      start: ['I\'ll take the long way.', 'One ball. That\'s all this needs.', 'You won\'t see me twice.'],
      splat: ['You checked every wall but mine.', 'One ball, like I said.', 'Quiet now.'],
      taunt: ['Behind you. Or am I?', 'Keep watching that corner.', 'You\'re walking my line.'],
    },
  },
  {
    id: 'jinx', name: 'Jinx', style: 'flanker', marker: 'marker_lobber',
    lines: {
      start: ['SKY PAINT INCOMING!', 'GRAVITY\'S ON MY TEAM!', 'HEADS UP — LITERALLY!'],
      splat: ['IT CAME FROM ABOVE!!', 'RAINBOW DELIVERY!', 'HA! DIDN\'T EVEN AIM!'],
      taunt: ['THE SKY IS FALLING! ON YOU!', 'INCOMING-ISH!', 'GUESS WHERE IT LANDS!'],
    },
  },
  {
    id: 'marrow', name: 'Marrow', style: 'anchor', marker: 'marker_pump',
    lines: {
      start: ['Holding.', 'Come.', 'Mine.'],
      splat: ['Next.', 'Told you.', 'Sit.'],
      taunt: ['Close enough.', 'Stop.', 'Here.'],
    },
  },
  {
    id: 'saber', name: 'Saber', style: 'anchor', marker: 'marker_blitz',
    lines: {
      start: ['Play it clean out there.', 'The pads are spoken for.', 'Good luck. You\'ll want it.'],
      splat: ['Good run. Not good enough.', 'Walk it off — that was fair paint.', 'The pad stays mine.'],
      taunt: ['You\'re in my yard now.', 'Turn back. Last courtesy.', 'I\'ve held worse ground than this.'],
    },
  },
  {
    id: 'grit', name: 'Grit', style: 'anchor', marker: 'marker_scatter',
    lines: {
      start: ['Been here since sunrise.', 'The junkyard remembers me.', 'Bring paint. Lots of it.'],
      splat: ['Kids these days.', 'That\'s a veteran\'s angle.', 'Add it to my tab.'],
      taunt: ['I\'ve slept in this bunker, kid.', 'You walk loud.', 'Wrong alley.'],
    },
  },
];

export const personaByName = new Map(PB_PERSONAS.map((p) => [p.name, p]));
