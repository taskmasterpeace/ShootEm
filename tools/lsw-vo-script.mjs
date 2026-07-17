// ---------------------------------------------------------------------------
// THE LSW VOICE SCRIPT — who they are, what they say, and HOW (the direction).
// This file is the casting sheet and the recording script in one. The
// generator (gen-lsw-vo.mjs) performs it via google/gemini-3.1-flash-tts;
// the display lines (tag-stripped) are mirrored in src/sim/lsw.ts VO_LINES —
// keep them in sync when a line changes.
//
// THE CRAFT (Robert's discovery, and it's real): direction IS the
// performance. "eh!" under "She was punched" is a different clip than "eh!"
// under "She was shot and is dying". Personas give the model a body; notes
// give it a state; inline tags turn the read mid-line.
// ---------------------------------------------------------------------------

export const CAST = {
  firebrand: {
    voice: 'Puck',
    fx: 'none', // the performance carries it raw
    persona: 'Firebrand, a United Front Living Super Weapon — a fire-control specialist who fell in love with the fire. Young, quick, always half-grinning. Voice like a lit fuse.',
    scene: 'An open battlefield. Gunfire crackling, his own flames hissing on the grass around him.',
  },
  plaguebearer: {
    voice: 'Enceladus',
    fx: 'haz', // respirator lowpass + hiss bed
    persona: 'Plaguebearer, a Collective Living Super Weapon — a quarantine engineer who BECAME the outbreak. Soft, clinical, unhurried; every word through a respirator.',
    scene: 'Drifting gas. Muffled coughing somewhere. The hiss of his own canisters.',
  },
  frostbite: {
    voice: 'Kore',
    fx: 'ice', // crystal comb shimmer
    persona: 'Frostbite, a United Front Living Super Weapon — cryo-containment made flesh. A woman\'s voice, firm and flat, zero warmth. Words rationed like heat in winter.',
    scene: 'Wind. Ice creaking under boots. Distant gunfire dulled by snow.',
  },
  ragebeast: {
    voice: 'Algenib',
    fx: 'beast', // pitched-down double underneath
    persona: 'Ragebeast, a Collective Living Super Weapon — a containment failure with a name. Voice enormous, torn, half animal; words come out broken because the throat was not built for them.',
    scene: 'Metal groaning. His own chains dragging. The field going quiet around him.',
  },
  titan: {
    voice: 'Charon',
    fx: 'none', // the deep register carries it — no processing
    persona: 'Titan, a United Front Living Super Weapon — a mountain that learned to walk. Enormous, slow, geological calm; nothing hurries him and it never has. Voice deep and grinding, like boulders settling; he speaks rarely and never raises it.',
    scene: 'Deep rumble underfoot. Rubble sliding. Something heavy being lifted.',
  },
  announcer: {
    voice: 'Orus',
    fx: 'radio', // 300–3400Hz military net + soft clip
    persona: 'The War World field announcer — a military radio-net voice, clipped, professional, been doing this too long to be surprised. Equal parts air-traffic control and boxing ring.',
    scene: 'A command-post radio net. The match roars in the background.',
  },
};

/** The LSWs' own mouths — positional, only nearby ears hear them. */
export const VO = [
  // ---- FIREBRAND: the grin, then the turn ----
  { slot: 'vo_firebrand_arrive', who: 'firebrand', text: '[amused] Somebody call for a light?', notes: ['The grin must be audible.', 'He has been waiting in that pod all day.', 'No menace yet — that comes later.'] },
  { slot: 'vo_firebrand_kill3', who: 'firebrand', text: 'Three! [short pause] The fire\'s just getting to know everybody.', notes: ['Delighted — counting like a party trick.', 'Slightly out of breath from the fight.'] },
  { slot: 'vo_firebrand_ability', who: 'firebrand', text: 'All that paint I put down? [short pause] It was a promise.', notes: ['The turn: quiet, almost tender, right before violence.', 'The grin goes cold on the last word.'] },
  { slot: 'vo_firebrand_low', who: 'firebrand', text: '[strained] Burning low... [short pause] burning MEAN.', notes: ['Hurt, breath short, pride refusing to show it.', 'The last word flares.'] },
  { slot: 'vo_firebrand_death', who: 'firebrand', text: '[weak] Huh. [short pause] Finally... some shade.', notes: ['He is dying and knows it — keeps it light anyway.', 'Fading, almost relieved.'] },

  // ---- PLAGUEBEARER: the kindness IS the threat ----
  { slot: 'vo_plaguebearer_arrive', who: 'plaguebearer', text: '[calm] Deep breath, everyone.', notes: ['Gentle, like a nurse before a needle.', 'The kindness IS the threat.'] },
  { slot: 'vo_plaguebearer_kill3', who: 'plaguebearer', text: 'Three subjects. [short pause] The data is... agreeable.', notes: ['Mild satisfaction — a researcher logging results.', 'No cruelty. That is what makes it worse.'] },
  { slot: 'vo_plaguebearer_ability', who: 'plaguebearer', text: 'The ring is for your protection.', notes: ['Soothing, official — a public-safety broadcast.', 'He believes it completely.'] },
  { slot: 'vo_plaguebearer_low', who: 'plaguebearer', text: '[wheezing] Fascinating. [short pause] It spreads to me too.', notes: ['Genuinely curious about his own dying.', 'Breath failing between words.'] },
  { slot: 'vo_plaguebearer_death', who: 'plaguebearer', text: '[fading] I was... already gone.', notes: ['No fear at all — a quiet correction of the record.', 'Trails to nothing.'] },

  // ---- FROSTBITE: words rationed like heat ----
  { slot: 'vo_frostbite_arrive', who: 'frostbite', text: 'Winter\'s here.', notes: ['Two words, no drama — the temperature drop does the talking.', 'Absolute calm.'] },
  { slot: 'vo_frostbite_kill3', who: 'frostbite', text: 'Three. [short pause] Cold count.', notes: ['A ledger entry, not a boast.', 'Slightly quieter than expected.'] },
  { slot: 'vo_frostbite_ability', who: 'frostbite', text: '[flat] Hold still.', notes: ['Not a threat — an instruction.', 'The kind you obey before understanding why.'] },
  { slot: 'vo_frostbite_low', who: 'frostbite', text: '[tight] Cracks... in the ice.', notes: ['The first crack in the calm too.', 'Pain held behind the teeth.'] },
  { slot: 'vo_frostbite_death', who: 'frostbite', text: '[whisper] Thaw me... never.', notes: ['Final, proud — each word its own breath.', 'She chooses the cold.'] },

  // ---- RAGEBEAST: joy and fury are the same feeling ----
  { slot: 'vo_ragebeast_arrive', who: 'ragebeast', text: '[roaring] OUT. [short pause] FINALLY OUT.', notes: ['Joy and fury are the same feeling for him.', 'The first word is a door breaking.'] },
  { slot: 'vo_ragebeast_kill3', who: 'ragebeast', text: 'THREE MORE. [short pause] WHO ELSE.', notes: ['Not a question. Louder than necessary.', 'He wants an answer anyway.'] },
  { slot: 'vo_ragebeast_ability', who: 'ragebeast', text: 'GROUND. [short pause] BREAKS.', notes: ['Each word a slam.', 'Guttural, delighted, teeth together.'] },
  { slot: 'vo_ragebeast_low', who: 'ragebeast', text: '[panting] HURT ME. GOOD. [short pause] MORE.', notes: ['The wound FEEDS him.', 'Rising excitement where fear should be.'] },
  { slot: 'vo_ragebeast_death', who: 'ragebeast', text: '[fading growl] Still... hungry...', notes: ['The engine winding down, never satisfied.', 'Quieter than he has ever been.'] },

  // ---- TITAN: the mountain, unbothered ----
  { slot: 'vo_titan_arrive', who: 'titan', text: '[low, calm] Ground\'s mine now.', notes: ['Not a boast — a fact, like weather.', 'Deep and slow; he has all the time in the world.'] },
  { slot: 'vo_titan_kill3', who: 'titan', text: 'Three. [short pause] Small ones.', notes: ['Mild, almost bored.', 'They barely registered.'] },
  { slot: 'vo_titan_ability', who: 'titan', text: '[grinding] Up you go.', notes: ['Said while throwing something enormous.', 'Effortless — the strain is all on the thing being thrown.'] },
  { slot: 'vo_titan_low', who: 'titan', text: '[unshaken] Chipping... at a mountain.', notes: ['Hurt but unimpressed by it.', 'The calm does not crack.'] },
  { slot: 'vo_titan_death', who: 'titan', text: '[settling] Back... to stone.', notes: ['No fear — a return, not an end.', 'The voice grinds to a stop like a landslide settling.'] },
];

/** The announcer — map-wide, both teams, radio net. */
export const ANN = [
  { slot: 'ann_firebrand_inbound', text: 'FIREBRAND INBOUND. [short pause] CLEAR THE GRASS.' },
  { slot: 'ann_firebrand_landed', text: 'FIREBRAND ON THE FIELD. THE GROUND WILL BURN.' },
  { slot: 'ann_firebrand_down', text: 'FIREBRAND IS DOWN. THE FIRES GO WITH HIM.' },
  { slot: 'ann_firebrand_rampage', text: 'FIVE KILLS. FIREBRAND IS COOKING.' },
  { slot: 'ann_plaguebearer_inbound', text: 'PLAGUEBEARER INBOUND. SEAL YOUR MASKS.' },
  { slot: 'ann_plaguebearer_landed', text: 'PLAGUEBEARER WALKS THE FIELD. THE AIR IS NOT YOUR FRIEND.' },
  { slot: 'ann_plaguebearer_down', text: 'PLAGUEBEARER IS DOWN. VENTILATE AND ADVANCE.' },
  { slot: 'ann_plaguebearer_rampage', text: 'FIVE KILLS. THE OUTBREAK IS WINNING.' },
  { slot: 'ann_frostbite_inbound', text: 'FROSTBITE INBOUND. [short pause] DRESS FOR WINTER.' },
  { slot: 'ann_frostbite_landed', text: 'FROSTBITE DEPLOYED. THE COLD TAKES THE FIELD.' },
  { slot: 'ann_frostbite_down', text: 'FROSTBITE IS DOWN. [short pause] THE THAW BEGINS.' },
  { slot: 'ann_frostbite_rampage', text: 'FIVE KILLS. FROSTBITE IS AN ICE AGE.' },
  { slot: 'ann_ragebeast_inbound', text: 'RAGEBEAST INBOUND. DO NOT FEED IT.' },
  { slot: 'ann_ragebeast_landed', text: 'RAGEBEAST IS LOOSE. [short pause] GOOD LUCK.' },
  { slot: 'ann_ragebeast_down', text: 'RAGEBEAST IS DOWN. STAND EASY.' },
  { slot: 'ann_ragebeast_rampage', text: 'FIVE KILLS. [short pause] STOP FEEDING THE BEAST.' },
  { slot: 'ann_titan_inbound', text: 'TITAN INBOUND. [short pause] MOVE THE ARMOR.' },
  { slot: 'ann_titan_landed', text: 'TITAN ON THE FIELD. NOTHING STAYS WHERE IT STANDS.' },
  { slot: 'ann_titan_down', text: 'TITAN IS DOWN. [short pause] THE GROUND HOLDS STILL.' },
  { slot: 'ann_titan_rampage', text: 'FIVE KILLS. TITAN IS THROWING THE WHOLE FIELD.' },
];

export const ANN_NOTES = [
  'Clipped military radio — high urgency, zero fear.',
  'Every line lands in under three seconds.',
  'He has read a thousand of these. This one still matters.',
];
