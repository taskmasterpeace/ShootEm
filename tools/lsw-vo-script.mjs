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
  voltstriker: {
    voice: 'Fenrir',
    fx: 'none', // the crackle is in the performance
    persona: 'Volt Striker, a United Front Living Super Weapon — an anti-cluster electrocutioner who genuinely enjoys a crowd. Fast, bright, gleeful; a little static crackles under every word. He finds bunched-up enemies funny.',
    scene: 'Ozone in the air. Electric snaps and arcs. A transformer humming somewhere close.',
  },
  sniperhawk: {
    voice: 'Iapetus',
    fx: 'none', // clean and close-mic'd — a patient voice
    persona: 'Sniperhawk, a United Front Living Super Weapon — a marksman who perches and waits. Patient, precise, quiet; a predator that has already decided the outcome. Never rushed, never loud.',
    scene: 'Wind over a high perch. Distant, muffled gunfire below. The slow click of a bolt.',
  },
  barrier: {
    voice: 'Algieba',
    fx: 'none', // steady and even — the voice of a wall
    persona: 'Barrier, a United Front Living Super Weapon — a defender who became a wall. Steady, immovable, low and even; he does not threaten, he simply informs you where the line is. Nothing rattles him.',
    scene: 'A low electric hum of a force field. Rounds pinging off energy and coming back.',
  },
  reactor: {
    voice: 'Rasalgethi',
    fx: 'none', // warm, generous — a slightly unstable hum under it
    persona: 'Reactor, a United Front Living Super Weapon — a walking power core who exists to make everyone else stronger. Warm, generous, encouraging, with a faint electric instability under the good humor. He gives too much of himself, gladly.',
    scene: 'A deep reactor hum building and releasing. Energy pouring into someone nearby.',
  },
  oblivion: {
    voice: 'Umbriel',
    fx: 'none', // cold and clean — the vastness is in the delivery
    persona: 'Oblivion, a Collective Living Super Weapon — a levitating void that speaks in absolutes. Cold, vast, hollow; utterly certain that everything ends and mildly bored by how long it is taking. Never raises its voice because it never needs to.',
    scene: 'A low gravitational hum. Sound bending inward. A distant, deep collapse.',
  },
  tremor: {
    voice: 'Gacrux',
    fx: 'none', // low and grinding — the rumble is in the delivery
    persona: 'Tremor, a Collective Living Super Weapon — a siege engine that fights from under the dirt. Heavy, slow, seismic; patient the way tectonic plates are patient. Speaks in short, ground-shaking statements and is never in a hurry.',
    scene: 'A deep subterranean rumble. Soil shifting. The crack of stone under pressure.',
  },
  magnetar: {
    voice: 'Sadachbia',
    fx: 'none', // cold, controlled, a faint electromagnetic whine under it
    persona: 'Magnetar, a Collective Living Super Weapon — an anti-ranged controller who finds bullets beneath contempt. Cold, precise, smug; he treats incoming gunfire as raw material for his own armor. Unhurried and quietly superior.',
    scene: 'A high electromagnetic whine. Metal debris orbiting and clicking. Rounds curving away with a hum.',
  },
  wraith: {
    voice: 'Laomedeia',
    fx: 'none', // breathy and close — a whisper that steals things
    persona: 'Wraith, a Collective Living Super Weapon — a levitating thief who possesses machines rather than fighting them. Sly, whispery, delighted by taking what is yours. Never raises its voice; it does not have to when your own turrets turn on you.',
    scene: 'A low electrical whisper. Machinery powering over to a new master. Servos turning the wrong way.',
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

  // ---- VOLT STRIKER: the crowd is the punchline ----
  { slot: 'vo_voltstriker_arrive', who: 'voltstriker', text: "[crackling] Everybody's grounded now.", notes: ['A pun he finds delightful.', 'Fast and bright, static riding under the voice.'] },
  { slot: 'vo_voltstriker_kill3', who: 'voltstriker', text: 'Three on one arc. [short pause] Tidy.', notes: ['Proud of the efficiency, like a good score.'] },
  { slot: 'vo_voltstriker_ability', who: 'voltstriker', text: '[gleeful] Hold hands!', notes: ['Said to a cluster the instant before it chains.', 'Delighted menace.'] },
  { slot: 'vo_voltstriker_low', who: 'voltstriker', text: '[flickering] Losing... current.', notes: ['The crackle stutters and browns out.', 'Fear under the static.'] },
  { slot: 'vo_voltstriker_death', who: 'voltstriker', text: '[fading buzz] Ground... fault.', notes: ['One last pun, weaker.', 'The hum dies out.'] },

  // ---- SNIPERHAWK: patient, already decided ----
  { slot: 'vo_sniperhawk_arrive', who: 'sniperhawk', text: 'Found my perch.', notes: ['Quiet, settled, unhurried.', 'He has all the time he needs.'] },
  { slot: 'vo_sniperhawk_kill3', who: 'sniperhawk', text: 'Three. [short pause] All center mass.', notes: ['A professional noting his own accuracy.', 'No pleasure, just the record.'] },
  { slot: 'vo_sniperhawk_ability', who: 'sniperhawk', text: "[low] Line 'em up.", notes: ['Said as the shot goes through several at once.', 'Almost a courtesy.'] },
  { slot: 'vo_sniperhawk_low', who: 'sniperhawk', text: '[tight] Position... compromised.', notes: ['The calm cracks, just slightly.', 'A professional problem, not yet a panic.'] },
  { slot: 'vo_sniperhawk_death', who: 'sniperhawk', text: "[breath] Should've... moved.", notes: ['A marksman who broke his own rule.', 'Wry, fading.'] },

  // ---- BARRIER: the wall informs you ----
  { slot: 'vo_barrier_arrive', who: 'barrier', text: '[even] This far. [short pause] No further.', notes: ['Not a threat — a statement of fact.', 'Immovable calm.'] },
  { slot: 'vo_barrier_kill3', who: 'barrier', text: 'Three broke on the wall.', notes: ['Mild, matter-of-fact.', 'The wall did the work, not him.'] },
  { slot: 'vo_barrier_ability', who: 'barrier', text: '[low] Send it back.', notes: ['Said as fire reflects toward its shooters.', 'A quiet, certain instruction.'] },
  { slot: 'vo_barrier_low', who: 'barrier', text: '[strained] The wall... is cracking.', notes: ['The first uncertainty in an unshakable voice.'] },
  { slot: 'vo_barrier_death', who: 'barrier', text: '[settling] Line... held.', notes: ['Satisfied, not afraid — the job was done.'] },

  // ---- REACTOR: gives too much, gladly ----
  { slot: 'vo_reactor_arrive', who: 'reactor', text: '[warm] Who needs a boost?', notes: ['Genuinely offering, like a friend with a jump-start.', 'A faint electric hum under the warmth.'] },
  { slot: 'vo_reactor_kill3', who: 'reactor', text: "Three — and I'm just the battery.", notes: ['Deflecting credit to his team, pleased about it.'] },
  { slot: 'vo_reactor_ability', who: 'reactor', text: "[surging] Take everything I've got.", notes: ['Said while pouring power into an ally.', 'Generous to the point of self-harm.'] },
  { slot: 'vo_reactor_low', who: 'reactor', text: '[unstable] Core... destabilizing.', notes: ['The hum turns dangerous.', 'Worry, but more for others than himself.'] },
  { slot: 'vo_reactor_death', who: 'reactor', text: '[rising whine] Going... critical.', notes: ['A reactor about to go — ominous, not frightened.', 'The whine climbs and cuts out.'] },

  // ---- OBLIVION: everything ends, and it's bored of waiting ----
  { slot: 'vo_oblivion_arrive', who: 'oblivion', text: '[cold] All of it. [short pause] Ends.', notes: ['A statement of physics, not a threat.', 'Vast, hollow, unhurried.'] },
  { slot: 'vo_oblivion_kill3', who: 'oblivion', text: 'Three. [short pause] Erased.', notes: ['No satisfaction — just accounting.', 'They were never going to matter.'] },
  { slot: 'vo_oblivion_ability', who: 'oblivion', text: '[low] Fall in.', notes: ['Said as the black hole opens.', 'Almost gentle. That is worse.'] },
  { slot: 'vo_oblivion_low', who: 'oblivion', text: '[fraying] Even I... unravel.', notes: ['The certainty wavers for the first time.', 'A distant surprise.'] },
  { slot: 'vo_oblivion_death', who: 'oblivion', text: '[dissolving] Nothing... lasts.', notes: ['Proven right about itself, at the end.', 'The voice thins into silence.'] },

  // ---- TREMOR: patient as tectonics ----
  { slot: 'vo_tremor_arrive', who: 'tremor', text: '[low, grinding] The ground answers to me.', notes: ['A geological fact, stated flatly.', 'Deep and unhurried.'] },
  { slot: 'vo_tremor_kill3', who: 'tremor', text: 'Three. [short pause] Buried.', notes: ['Matter-of-fact, like filling graves is just work.'] },
  { slot: 'vo_tremor_ability', who: 'tremor', text: '[rumbling] Feel that?', notes: ['Said as the earth heaves — almost conversational.', 'The rumble is under the words.'] },
  { slot: 'vo_tremor_low', who: 'tremor', text: '[strained] Cracks... running deep.', notes: ['The first fault line in his composure.'] },
  { slot: 'vo_tremor_death', who: 'tremor', text: '[settling] Back... underground.', notes: ['No fear — a return to where he came from.', 'The rumble fades into the earth.'] },

  // ---- MAGNETAR: your bullets are raw material ----
  { slot: 'vo_magnetar_arrive', who: 'magnetar', text: '[cool, amused] Guns? [short pause] How quaint.', notes: ['Contempt without heat — he simply finds bullets primitive.', 'A faint whine under the voice.'] },
  { slot: 'vo_magnetar_kill3', who: 'magnetar', text: 'Three. Their bullets built my armor.', notes: ['Pleased in a detached, technical way.'] },
  { slot: 'vo_magnetar_ability', who: 'magnetar', text: '[flat] Jammed.', notes: ['A single word, like flipping a switch on someone.'] },
  { slot: 'vo_magnetar_low', who: 'magnetar', text: '[straining] Field... collapsing.', notes: ['The control slips; the whine wavers.'] },
  { slot: 'vo_magnetar_death', who: 'magnetar', text: '[powering down] De... magnetized.', notes: ['The field dies with a descending whine.'] },

  // ---- WRAITH: what's yours is his ----
  { slot: 'vo_wraith_arrive', who: 'wraith', text: "[whispering] What's yours is mine.", notes: ['Delighted, intimate, like sharing a secret.', 'A breathy electrical whisper.'] },
  { slot: 'vo_wraith_kill3', who: 'wraith', text: 'Three. [short pause] Their own guns did it.', notes: ['Pleased by the irony, quietly.'] },
  { slot: 'vo_wraith_ability', who: 'wraith', text: '[coaxing] Come to me.', notes: ['Said to a machine, not a person — coaxing it over.'] },
  { slot: 'vo_wraith_low', who: 'wraith', text: '[thinning] Fading... need a host.', notes: ['The whisper grows faint, hungry.'] },
  { slot: 'vo_wraith_death', who: 'wraith', text: "[dissolving] You can't kill... a ghost.", notes: ['Amused even in death, trailing into static.'] },
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
  { slot: 'ann_voltstriker_inbound', text: 'VOLT STRIKER INBOUND. [short pause] SPREAD OUT.' },
  { slot: 'ann_voltstriker_landed', text: 'VOLT STRIKER ON THE FIELD. DO NOT BUNCH UP.' },
  { slot: 'ann_voltstriker_down', text: 'VOLT STRIKER IS DOWN. THE AIR GOES QUIET.' },
  { slot: 'ann_voltstriker_rampage', text: 'FIVE KILLS. VOLT STRIKER IS ARCING.' },
  { slot: 'ann_sniperhawk_inbound', text: 'SNIPERHAWK INBOUND. [short pause] BREAK LINE OF SIGHT.' },
  { slot: 'ann_sniperhawk_landed', text: 'SNIPERHAWK IS PERCHED. WATCH THE LANES.' },
  { slot: 'ann_sniperhawk_down', text: 'SNIPERHAWK IS DOWN. THE LANES ARE YOURS.' },
  { slot: 'ann_sniperhawk_rampage', text: 'FIVE KILLS. SNIPERHAWK OWNS THE SIGHTLINES.' },
  { slot: 'ann_barrier_inbound', text: 'BARRIER INBOUND. [short pause] YOUR SHOTS MAY COME BACK.' },
  { slot: 'ann_barrier_landed', text: 'BARRIER ON THE FIELD. MIND THE WALLS.' },
  { slot: 'ann_barrier_down', text: 'BARRIER IS DOWN. THE LANES OPEN.' },
  { slot: 'ann_barrier_rampage', text: 'FIVE KILLS. BARRIER WILL NOT BREAK.' },
  { slot: 'ann_reactor_inbound', text: 'REACTOR INBOUND. [short pause] KILL THE BATTERY FIRST.' },
  { slot: 'ann_reactor_landed', text: 'REACTOR ON THE FIELD. THEIR CARRY JUST GOT STRONGER.' },
  { slot: 'ann_reactor_down', text: 'REACTOR IS DOWN. THE OVERCHARGE FADES.' },
  { slot: 'ann_reactor_rampage', text: 'FIVE KILLS. REACTOR IS FEEDING THE WHOLE LINE.' },
  { slot: 'ann_oblivion_inbound', text: 'OBLIVION INBOUND. [short pause] DO NOT CLUSTER.' },
  { slot: 'ann_oblivion_landed', text: 'OBLIVION IS ON THE FIELD. WATCH FOR THE PULL.' },
  { slot: 'ann_oblivion_down', text: 'OBLIVION IS DOWN. THE VOID CLOSES.' },
  { slot: 'ann_oblivion_rampage', text: 'FIVE KILLS. OBLIVION IS SWALLOWING THE MAP.' },
  { slot: 'ann_tremor_inbound', text: 'TREMOR INBOUND. [short pause] KEEP OFF THE OPEN GROUND.' },
  { slot: 'ann_tremor_landed', text: 'TREMOR HAS SURFACED. WATCH THE SOIL.' },
  { slot: 'ann_tremor_down', text: 'TREMOR IS DOWN. THE GROUND IS STILL.' },
  { slot: 'ann_tremor_rampage', text: 'FIVE KILLS. TREMOR IS AN EARTHQUAKE.' },
  { slot: 'ann_magnetar_inbound', text: "MAGNETAR INBOUND. [short pause] YOUR BULLETS WON'T LAND." },
  { slot: 'ann_magnetar_landed', text: 'MAGNETAR ON THE FIELD. CLOSE THE DISTANCE.' },
  { slot: 'ann_magnetar_down', text: 'MAGNETAR IS DOWN. OPEN FIRE.' },
  { slot: 'ann_magnetar_rampage', text: 'FIVE KILLS. MAGNETAR EATS EVERY ROUND.' },
  { slot: 'ann_wraith_inbound', text: 'WRAITH INBOUND. [short pause] EMPTY YOUR VEHICLES.' },
  { slot: 'ann_wraith_landed', text: 'WRAITH ON THE FIELD. YOUR MACHINES ARE HIS.' },
  { slot: 'ann_wraith_down', text: 'WRAITH IS DOWN. RECLAIM YOUR HARDWARE.' },
  { slot: 'ann_wraith_rampage', text: 'FIVE KILLS. WRAITH IS WEARING YOUR ARMY.' },
];

export const ANN_NOTES = [
  'Clipped military radio — high urgency, zero fear.',
  'Every line lands in under three seconds.',
  'He has read a thousand of these. This one still matters.',
];
