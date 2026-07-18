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
  eclipse: {
    voice: 'Schedar',
    fx: 'none', // low, calm, and cold — the quiet of total dark
    persona: 'Eclipse, a Collective Living Super Weapon — a levitating controller who drapes the field in darkness. A woman\'s voice: calm, cold, unhurried, faintly amused that anyone still trusts their eyes. Soft the way a room goes soft when the lights die.',
    scene: 'Sound in a dark, muffled space. Distant, disoriented gunfire. A low, swallowing hush.',
  },
  dominator: {
    voice: 'Alnilam',
    fx: 'none', // deep, commanding, resonant — a voice used to being obeyed
    persona: 'Dominator, a Collective Living Super Weapon and the stable\'s FINALE — a levitating psychic puppeteer who treats enemy soldiers as his own limbs. Deep, imperious, resonant, unbearably calm; he never asks, he simply decides, and your body agrees.',
    scene: 'A low psychic resonance, like a struck bell held too long. Threads of force humming taut.',
  },
  riptide: {
    voice: 'Despina',
    fx: 'none', // easy and rolling — the surf carries it
    persona: 'Riptide, a United Front Living Super Weapon — a lifeguard the ocean kept. Easy, rolling, unhurried; the good humor of someone who has pulled a hundred people out of the water and thrown a hundred more back in. The counter-pick to every flame.',
    scene: 'Surf rolling in. Water sheeting off armor. A fire dying with a hiss somewhere close.',
  },
  gravwarden: {
    voice: 'Achird',
    fx: 'none', // measured and weightless — a judge of falling things
    persona: 'Gravity Warden, a United Front Living Super Weapon — a levitating controller who treats weight as a license he can revoke. Measured, serene, faintly amused watching people discover the floor is negotiable. Never hurried; things fall to HIM.',
    scene: 'A low hum of suspended dust. Loose gear drifting upward. Boots leaving the ground.',
  },
  chronos: {
    voice: 'Zubenelgenubi',
    fx: 'none', // precise and dry — a clockmaker keeping other people’s time
    persona: "Chronos, a Collective Living Super Weapon — a clockmaker who decided everyone else's seconds were his. Precise, dry, a little smug; speaks like every sentence was scheduled. The tick of something mechanical always under him.",
    scene: 'A thousand soft clock ticks slightly out of phase. A firefight moving like syrup nearby.',
  },
  venatrix: {
    voice: 'Erinome',
    fx: 'none', // a hunter of quiet places — patient, close, pleased
    persona: "Venatrix, a Collective Living Super Weapon — a trapper who hunts soldiers the way others hunt game. A woman's voice: hushed, patient, warmly pleased when something steps wrong. She likes her quarry careful; it makes the season longer.",
    scene: 'Wind through dry grass. A metal jaw creaking open. Something small stepping where it should not.',
  },
  vanguard: {
    voice: 'Sadaltager',
    fx: 'none', // a sergeant behind a shield — loud enough for the squad
    persona: "Vanguard, a United Front Living Super Weapon — a breacher who leads every entry shield-first. A sergeant's voice: loud, square, protective; every line is for the men BEHIND him.",
    scene: 'Rounds slapping a raised shield. Boots stacking up behind. A door about to give.',
  },
  pyroclasm: {
    voice: 'Achernar',
    fx: 'beast', // a furnace under the words
    persona: 'Pyroclasm, a Collective Living Super Weapon — a volcano given a walk. Slow, hot, patient the way magma is patient; every word smolders and the ground is his ledger.',
    scene: 'Lava pools ticking as they cool. Stone cracking with heat. A deep furnace draw.',
  },
  voidwalker: {
    voice: 'Zephyr',
    fx: 'none', // quick and close — a whisper from the wrong side
    persona: "Voidwalker, a Collective Living Super Weapon — an assassin who is never where he was. Quick, whispery, amused; half his sentences arrive from behind you. He thinks standing still is a joke everyone else fell for.",
    scene: 'The soft pop of displaced air. A footstep that starts on one side and ends on the other.',
  },
  crimson: {
    voice: 'Sulafat',
    fx: 'none', // rich and unhurried — a connoisseur at a battlefield
    persona: "Crimson, a Collective Living Super Weapon — an attritionist who treats the battlefield as a cellar. Rich, courteous, unhurried; he speaks of the dead the way sommeliers speak of vintages, and he is never in a rush because the field always provides.",
    scene: 'A quiet battlefield after the push. Something being poured. A heartbeat that is not his.',
  },
  mirage: {
    voice: 'Callirrhoe',
    fx: 'none', // bright and delighted — three of her talking over one another in spirit
    persona: "Mirage, a United Front Living Super Weapon — a trickster who is mostly rumors of herself. Bright, quick, endlessly amused; she narrates her own shell game and genuinely enjoys watching people shoot her copies.",
    scene: 'Heat shimmer. The same footsteps from three directions. A laugh that moves.',
  },
  blitz: {
    voice: 'Aoede',
    fx: 'none', // fast, clipped, breathless — always mid-stride
    persona: "Blitz, a United Front Living Super Weapon — momentum with a name tag. Fast, clipped, a little breathless, allergic to standing still; every line is delivered mid-stride because there is no other stride.",
    scene: 'Air snapping shut where someone just was. Footfalls too fast to count.',
  },
  shadowstep: {
    voice: 'Leda',
    fx: 'none', // a knife kept quiet
    persona: "Shadowstep, a United Front Living Super Weapon — the army's quiet knife. Soft, economical, close to the ear; he wastes neither words nor steps, and both arrive from behind.",
    scene: 'A footstep that never lands. A blade cleared of its sheath somewhere very close.',
  },
  specter: {
    voice: 'Vindemiatrix',
    fx: 'ice', // a faint choral shimmer — several of him, out of phase
    persona: "Specter, a Collective Living Super Weapon — a man who is a crowd. Eerie, layered, softly plural; he says 'we' when he means 'I' and it is never quite a mistake.",
    scene: 'Several identical footsteps out of phase. Glass humming. The same breath from three directions.',
  },
  pulse: {
    voice: 'Autonoe',
    fx: 'none', // resonant and certain — a man who hears everything
    persona: "Pulse, a United Front Living Super Weapon — a recon specialist whose ears outrange everyone's eyes. Resonant, calm, certain; walls are a rumor to him and he speaks like a sonar ping coming back true.",
    scene: 'A deep sonar sweep. Heartbeats through masonry. The hum of a wave about to break.',
  },
  venom: {
    voice: 'Umbriel',
    fx: 'haz', // through the same respirator family as the outbreak
    persona: "Venom, a United Front Living Super Weapon — a toxicologist who treats every engagement as a dosage question. Precise, faintly amused, professionally detached; he discusses dissolving armor the way chemists discuss titration.",
    scene: 'A dripping sound that should not be indoors. Metal fizzing. A respirator drawing steady breaths.',
  },
  nightmare: {
    voice: 'Pulcherrima',
    fx: 'ice', // a thin wrong shimmer under a calm voice
    persona: "Nightmare, a Collective Living Super Weapon — a disruptor who lives in other people's displays. Calm, intimate, quietly wrong; every sentence sounds like it was already on your minimap before he said it.",
    scene: 'Contact tones pinging for things that are not there. A map redrawing itself. Breathing very close.',
  },
  reaper: {
    voice: 'Algenib',
    fx: 'none', // the beast voice unprocessed — a duelist, not a monster
    persona: "Reaper, a Collective Living Super Weapon — a duelist with a ledger. Grim, level, unhurried; he speaks of targets as names to be crossed off, and his chain arrives before his sentences finish.",
    scene: 'A chain paying out link by link. A blade being drawn across a whetstone, slow.',
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

  // ---- ECLIPSE: trust your ears ----
  { slot: 'vo_eclipse_arrive', who: 'eclipse', text: '[calm, cold] Let there be dark.', notes: ['A quiet inversion of a familiar line.', 'Unhurried, certain.'] },
  { slot: 'vo_eclipse_kill3', who: 'eclipse', text: 'Three, [short pause] in the black.', notes: ['Detached — they never saw it, and neither did she care.'] },
  { slot: 'vo_eclipse_ability', who: 'eclipse', text: '[soft] Close your eyes.', notes: ['Almost tender, like tucking someone in.'] },
  { slot: 'vo_eclipse_low', who: 'eclipse', text: '[tightening] The light... finds me.', notes: ['The first note of unease as the dark thins.'] },
  { slot: 'vo_eclipse_death', who: 'eclipse', text: '[fading] Dawn... already?', notes: ['A quiet, almost disappointed surprise.'] },

  // ---- DOMINATOR: the finale — your body agrees ----
  { slot: 'vo_dominator_arrive', who: 'dominator', text: '[deep, certain] You belong to me now.', notes: ['Not a threat — a fact he has already decided.', 'Resonant and utterly calm.'] },
  { slot: 'vo_dominator_kill3', who: 'dominator', text: 'Three puppets. [short pause] Cut.', notes: ['Cutting strings, not lives — to him it is the same.'] },
  { slot: 'vo_dominator_ability', who: 'dominator', text: '[commanding] Feel each other.', notes: ['Said as the threads bind a squad into one nerve.'] },
  { slot: 'vo_dominator_low', who: 'dominator', text: '[straining] My grip... slips.', notes: ['The imperious calm cracks — control is everything to him.'] },
  { slot: 'vo_dominator_death', who: 'dominator', text: '[disbelieving] You were... mine.', notes: ['He cannot understand losing what he owned.', 'Fading, affronted.'] },
  // ---- RIPTIDE: the lifeguard the ocean kept ----
  { slot: 'vo_riptide_arrive', who: 'riptide', text: "[easy] Tide's coming in.", notes: ['Relaxed, almost pleased — the water does the work.', 'A smile you can hear.'] },
  { slot: 'vo_riptide_kill3', who: 'riptide', text: 'Three, [short pause] out with the tide.', notes: ['Matter-of-fact, like reading the surf report.'] },
  { slot: 'vo_riptide_ability', who: 'riptide', text: '[calling out] Everybody out of the pool.', notes: ['The lifeguard line, weaponized.', 'Said as the wave breaks.'] },
  { slot: 'vo_riptide_low', who: 'riptide', text: '[strained] Running... dry.', notes: ['The first crack in the easy humor.'] },
  { slot: 'vo_riptide_death', who: 'riptide', text: '[fading] The sea... takes me back.', notes: ['Peaceful — a return, not a loss.', 'The surf swallows the last word.'] },
  // ---- GRAVITY WARDEN: weight is a privilege ----
  { slot: 'vo_gravwarden_arrive', who: 'gravwarden', text: '[serene] Weight is a privilege.', notes: ['A rule stated by the man who grants it.', 'Calm, floating, unhurried.'] },
  { slot: 'vo_gravwarden_kill3', who: 'gravwarden', text: 'Three came down wrong.', notes: ['Clinical, faintly amused — the landing was their problem.'] },
  { slot: 'vo_gravwarden_ability', who: 'gravwarden', text: '[soft] Up.', notes: ['One word, and the world obeys.', 'Almost gentle.'] },
  { slot: 'vo_gravwarden_low', who: 'gravwarden', text: '[straining] Getting... heavy.', notes: ['The serenity cracks — weight is winning.'] },
  { slot: 'vo_gravwarden_death', who: 'gravwarden', text: '[falling] Falling... at last.', notes: ['Wonder, not fear — his first fall in years.'] },

  // ---- CHRONOS: everyone's seconds are his ----
  { slot: 'vo_chronos_arrive', who: 'chronos', text: '[precise] Right on time. I always am.', notes: ['Smug, scheduled, dry as a ledger.'] },
  { slot: 'vo_chronos_kill3', who: 'chronos', text: 'Three, ahead of schedule.', notes: ['A clockmaker pleased with his estimate.'] },
  { slot: 'vo_chronos_ability', who: 'chronos', text: '[dry] Take your time. I insist.', notes: ['Said as the bubble slows them to syrup.', 'The joke is the cruelty.'] },
  { slot: 'vo_chronos_low', who: 'chronos', text: '[tight] Borrowed time... spent.', notes: ['The ledger turning against him.'] },
  { slot: 'vo_chronos_death', who: 'chronos', text: '[winding down] Out of... seconds.', notes: ['The tick under his voice slows and stops.'] },
  // ---- VENATRIX: the season is open ----
  { slot: 'vo_venatrix_arrive', who: 'venatrix', text: '[hushed] Step lightly, little ones.', notes: ['A warm warning she hopes they ignore.'] },
  { slot: 'vo_venatrix_kill3', who: 'venatrix', text: 'Three for the wall.', notes: ['A collector, pleased with the day.'] },
  { slot: 'vo_venatrix_ability', who: 'venatrix', text: '[reeling] Come here.', notes: ['Said while the harpoon drags someone across the open.', 'Effort under the words.'] },
  { slot: 'vo_venatrix_low', who: 'venatrix', text: '[bitter] Caught... in my own season.', notes: ['The hunter, hunted — she knows the irony.'] },
  { slot: 'vo_venatrix_death', who: 'venatrix', text: '[settling] A fair... hunt.', notes: ['Respect for whoever got her.', 'No bitterness at the end.'] },
  // ---- VANGUARD: for the men behind him ----
  { slot: 'vo_vanguard_arrive', who: 'vanguard', text: '[loud] Form up behind me.', notes: ['An order and a promise in one.'] },
  { slot: 'vo_vanguard_kill3', who: 'vanguard', text: 'Three broke on the shield.', notes: ['Matter-of-fact — that is what shields are for.'] },
  { slot: 'vo_vanguard_ability', who: 'vanguard', text: '[roaring] MAKE A HOLE.', notes: ['The breach call — said mid-charge.'] },
  { slot: 'vo_vanguard_low', who: 'vanguard', text: '[strained] Shield arm... failing.', notes: ['The first thing he has ever admitted.'] },
  { slot: 'vo_vanguard_death', who: 'vanguard', text: '[fading] Hold... the line...', notes: ['His last order is for everyone else.'] },

  // ---- PYROCLASM: the ground is his ledger ----
  { slot: 'vo_pyroclasm_arrive', who: 'pyroclasm', text: '[smoldering] The ground remembers fire.', notes: ['Slow, hot, geological patience.'] },
  { slot: 'vo_pyroclasm_kill3', who: 'pyroclasm', text: 'Three, down to ash.', notes: ['An accounting, spoken over embers.'] },
  { slot: 'vo_pyroclasm_ability', who: 'pyroclasm', text: '[opening] Let it pour.', notes: ['Said as the rocks go up and the pools come down.'] },
  { slot: 'vo_pyroclasm_low', who: 'pyroclasm', text: '[cracking] Cracking... it wants OUT.', notes: ['The eruption is coming and he knows it.', 'The threshold is a threat.'] },
  { slot: 'vo_pyroclasm_death', who: 'pyroclasm', text: '[hissing out] Cooling... at last.', notes: ['A volcano going dormant — relief and loss at once.'] },

  // ---- VOIDWALKER: never where he was ----
  { slot: 'vo_voidwalker_arrive', who: 'voidwalker', text: '[whisper] Blink and miss me.', notes: ['A dare, close to the ear.'] },
  { slot: 'vo_voidwalker_kill3', who: 'voidwalker', text: 'Three never saw the third.', notes: ['Delighted by his own arithmetic.'] },
  { slot: 'vo_voidwalker_ability', who: 'voidwalker', text: '[from behind] Behind you.', notes: ['The oldest line, made literal.'] },
  { slot: 'vo_voidwalker_low', who: 'voidwalker', text: '[breathless] Nowhere... left to blink.', notes: ['The joke stops being funny.'] },
  { slot: 'vo_voidwalker_death', who: 'voidwalker', text: '[still] Caught... standing still.', notes: ['The one mistake his whole life avoided.'] },
  // ---- CRIMSON: the field always provides ----
  { slot: 'vo_crimson_arrive', who: 'crimson', text: '[rich] The field always provides.', notes: ['A connoisseur surveying a cellar.'] },
  { slot: 'vo_crimson_kill3', who: 'crimson', text: 'Three courses. [short pause] Generous.', notes: ['Courteous, satisfied, unhurried.'] },
  { slot: 'vo_crimson_ability', who: 'crimson', text: '[commanding] Rise. You owe me that.', notes: ['Spoken to a pool, not a person.', 'The brute answers.'] },
  { slot: 'vo_crimson_low', who: 'crimson', text: '[paler] Running... thin.', notes: ['A man discovering his own vintage.'] },
  { slot: 'vo_crimson_death', who: 'crimson', text: '[emptying] Spilled... at last.', notes: ['The irony is not lost on him.'] },

  // ---- MIRAGE: mostly rumors of herself ----
  { slot: 'vo_mirage_arrive', who: 'mirage', text: '[amused] Which one of me heard that?', notes: ['Delighted by her own arithmetic.'] },
  { slot: 'vo_mirage_kill3', who: 'mirage', text: '[laughing] Three! They keep shooting the wrong me.', notes: ['The shell game is going great.'] },
  { slot: 'vo_mirage_ability', who: 'mirage', text: '[moving] Over here. [short pause] No — here.', notes: ['The voice itself swaps sides mid-line.'] },
  { slot: 'vo_mirage_low', who: 'mirage', text: '[quieter] They found... the right one.', notes: ['The game stops being funny.'] },
  { slot: 'vo_mirage_death', who: 'mirage', text: '[fading] This one... was real.', notes: ['The last reveal of the shell game.'] },

  // ---- BLITZ: no other stride ----
  { slot: 'vo_blitz_arrive', who: 'blitz', text: '[breathless] Try to keep up.', notes: ['Already three steps into the sentence.'] },
  { slot: 'vo_blitz_kill3', who: 'blitz', text: 'Three — and the meter is still running.', notes: ['Clipped, mid-stride, pleased.'] },
  { slot: 'vo_blitz_ability', who: 'blitz', text: '[flashing past] Too slow. Always too slow.', notes: ['Said from where he ISN\'T anymore.'] },
  { slot: 'vo_blitz_low', who: 'blitz', text: '[gasping] Legs... betraying me.', notes: ['The one fear he has: slowing down.'] },
  { slot: 'vo_blitz_death', who: 'blitz', text: '[settling] Finally... standing... still.', notes: ['Stillness, at last — and it cost everything.'] },
  // ---- SHADOWSTEP: the quiet knife ----
  { slot: 'vo_shadowstep_arrive', who: 'shadowstep', text: '[soft] You will not hear the second step.', notes: ['Close, calm, already moving.'] },
  { slot: 'vo_shadowstep_kill3', who: 'shadowstep', text: 'Three. None saw the knife.', notes: ['Economical satisfaction.'] },
  { slot: 'vo_shadowstep_ability', who: 'shadowstep', text: '[behind] Behind you. Above the mine.', notes: ['The warning is also the trap.'] },
  { slot: 'vo_shadowstep_low', who: 'shadowstep', text: '[pressed] Too many... eyes.', notes: ['A quiet man discovered.'] },
  { slot: 'vo_shadowstep_death', who: 'shadowstep', text: '[exhaling] Seen... at last.', notes: ['Almost relieved.'] },

  // ---- SPECTER: a man who is a crowd ----
  { slot: 'vo_specter_arrive', who: 'specter', text: '[layered] Which of us said that?', notes: ['Softly plural — the choir is one man.'] },
  { slot: 'vo_specter_kill3', who: 'specter', text: 'Three. We all take credit.', notes: ['The plural is not a mistake.'] },
  { slot: 'vo_specter_ability', who: 'specter', text: '[rising] All of me, at once.', notes: ['Said as every image detonates.'] },
  { slot: 'vo_specter_low', who: 'specter', text: '[thinning] The mirrors... are emptying.', notes: ['The crowd is dying back to one.'] },
  { slot: 'vo_specter_death', who: 'specter', text: '[single voice] Alone... after all.', notes: ['One voice, for the first time.'] },

  // ---- PULSE: walls are a rumor ----
  { slot: 'vo_pulse_arrive', who: 'pulse', text: '[resonant] I can hear your heartbeat.', notes: ['Not a threat — a diagnosis.'] },
  { slot: 'vo_pulse_kill3', who: 'pulse', text: 'Three. Heard them all coming.', notes: ['Certain, unhurried.'] },
  { slot: 'vo_pulse_ability', who: 'pulse', text: '[booming] SPEAK UP.', notes: ['The wave itself, weaponized as a joke.'] },
  { slot: 'vo_pulse_low', who: 'pulse', text: '[wincing] Ringing... in my own ears now.', notes: ['The listener, deafened.'] },
  { slot: 'vo_pulse_death', who: 'pulse', text: '[fading] So this... is silence.', notes: ['His first silence, and his last.'] },
  // ---- VENOM: a dosage question ----
  { slot: 'vo_venom_arrive', who: 'venom', text: '[clinical] Breathe deep. Or better, do not.', notes: ['Professional advice, wickedly given.'] },
  { slot: 'vo_venom_kill3', who: 'venom', text: 'Three. The dose was correct.', notes: ['A chemist confirming his math.'] },
  { slot: 'vo_venom_ability', who: 'venom', text: '[pleased] Your armor is soup now.', notes: ['Said as a plate dissolves whole.'] },
  { slot: 'vo_venom_low', who: 'venom', text: '[coughing] Tasting... my own work.', notes: ['The irony burns going down.'] },
  { slot: 'vo_venom_death', who: 'venom', text: '[dissolving] Everything... dissolves.', notes: ['His life\'s thesis, proven on himself.'] },

  // ---- NIGHTMARE: already on your minimap ----
  { slot: 'vo_nightmare_arrive', who: 'nightmare', text: '[intimate] Your map is mine now.', notes: ['Quietly wrong, very close.'] },
  { slot: 'vo_nightmare_kill3', who: 'nightmare', text: 'Three chased the wrong ghost.', notes: ['The lies are working.'] },
  { slot: 'vo_nightmare_ability', who: 'nightmare', text: '[flat] Lights out.', notes: ['Said to one person, whose world goes dark.'] },
  { slot: 'vo_nightmare_low', who: 'nightmare', text: '[fraying] They see... through me.', notes: ['The illusionist, finally seen.'] },
  { slot: 'vo_nightmare_death', who: 'nightmare', text: '[fading] Wake up... all of you.', notes: ['The nightmare ends the only way they do.'] },

  // ---- REAPER: names to be crossed off ----
  { slot: 'vo_reaper_arrive', who: 'reaper', text: '[grim] One of you is already mine.', notes: ['The ledger is open before he lands.'] },
  { slot: 'vo_reaper_kill3', who: 'reaper', text: 'Three names, crossed off.', notes: ['Level, unhurried bookkeeping.'] },
  { slot: 'vo_reaper_ability', who: 'reaper', text: '[pulling] Come to the blade.', notes: ['Said as the chain reels a body in.'] },
  { slot: 'vo_reaper_low', who: 'reaper', text: '[surprised] My own... name... in the ledger.', notes: ['The bookkeeper, audited.'] },
  { slot: 'vo_reaper_death', who: 'reaper', text: '[settling] Harvested... fair enough.', notes: ['A professional\'s respect for the scythe that got him.'] },
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
  { slot: 'ann_eclipse_inbound', text: 'ECLIPSE INBOUND. [short pause] TRUST YOUR EARS.' },
  { slot: 'ann_eclipse_landed', text: 'ECLIPSE ON THE FIELD. THE DARK IS HERS.' },
  { slot: 'ann_eclipse_down', text: 'ECLIPSE IS DOWN. THE LIGHT RETURNS.' },
  { slot: 'ann_eclipse_rampage', text: 'FIVE KILLS. ECLIPSE HAS SWALLOWED THE LIGHT.' },
  { slot: 'ann_dominator_inbound', text: 'DOMINATOR INBOUND. [short pause] SCATTER. DO NOT BUNCH.' },
  { slot: 'ann_dominator_landed', text: 'DOMINATOR ON THE FIELD. YOUR FORMATION IS HIS WEAPON.' },
  { slot: 'ann_dominator_down', text: 'DOMINATOR IS DOWN. THE THREADS SNAP.' },
  { slot: 'ann_dominator_rampage', text: 'FIVE KILLS. DOMINATOR PULLS EVERY STRING.' },
  { slot: 'ann_riptide_inbound', text: 'RIPTIDE INBOUND. [short pause] HIGH GROUND, NOW.' },
  { slot: 'ann_riptide_landed', text: 'RIPTIDE ON THE FIELD. THE TIDE FIGHTS FOR US.' },
  { slot: 'ann_riptide_down', text: 'RIPTIDE IS DOWN. THE WATER STILLS.' },
  { slot: 'ann_riptide_rampage', text: 'FIVE KILLS. RIPTIDE IS DROWNING THE FIELD.' },
  { slot: 'ann_gravwarden_inbound', text: 'GRAVITY WARDEN INBOUND. [short pause] MIND YOUR FOOTING.' },
  { slot: 'ann_gravwarden_landed', text: 'GRAVITY WARDEN ON THE FIELD. DOWN IS A SUGGESTION NOW.' },
  { slot: 'ann_gravwarden_down', text: 'GRAVITY WARDEN IS DOWN. THE WEIGHT RETURNS.' },
  { slot: 'ann_gravwarden_rampage', text: 'FIVE KILLS. GRAVITY WARDEN OWNS THE SKY AND THE FLOOR.' },
  { slot: 'ann_chronos_inbound', text: 'CHRONOS INBOUND. [short pause] WATCH YOUR CLOCKS.' },
  { slot: 'ann_chronos_landed', text: 'CHRONOS ON THE FIELD. TIME IS HIS NOW.' },
  { slot: 'ann_chronos_down', text: 'CHRONOS IS DOWN. THE SECONDS RUN TRUE AGAIN.' },
  { slot: 'ann_chronos_rampage', text: 'FIVE KILLS. CHRONOS IS SPENDING YOUR TIME.' },
  { slot: 'ann_venatrix_inbound', text: 'VENATRIX INBOUND. [short pause] WATCH WHERE YOU STEP.' },
  { slot: 'ann_venatrix_landed', text: 'VENATRIX ON THE FIELD. THE GROUND IS BAITED.' },
  { slot: 'ann_venatrix_down', text: 'VENATRIX IS DOWN. SWEEP FOR HER TRAPS.' },
  { slot: 'ann_venatrix_rampage', text: 'FIVE KILLS. VENATRIX HAS A FULL TROPHY WALL.' },
  { slot: 'ann_vanguard_inbound', text: 'VANGUARD INBOUND. [short pause] THE DOOR IS ABOUT TO OPEN.' },
  { slot: 'ann_vanguard_landed', text: 'VANGUARD ON THE FIELD. FOLLOW THE SHIELD.' },
  { slot: 'ann_vanguard_down', text: 'VANGUARD IS DOWN. THE LINE IS YOURS TO HOLD.' },
  { slot: 'ann_vanguard_rampage', text: 'FIVE KILLS. VANGUARD IS THE DOOR NOW.' },
  { slot: 'ann_pyroclasm_inbound', text: 'PYROCLASM INBOUND. [short pause] THE FLOOR WILL NOT BE YOURS.' },
  { slot: 'ann_pyroclasm_landed', text: 'PYROCLASM ON THE FIELD. MIND THE POOLS.' },
  { slot: 'ann_pyroclasm_down', text: 'PYROCLASM IS DOWN. LET IT COOL.' },
  { slot: 'ann_pyroclasm_rampage', text: 'FIVE KILLS. PYROCLASM IS PAVING THE MAP.' },
  { slot: 'ann_voidwalker_inbound', text: 'VOIDWALKER INBOUND. [short pause] CHECK YOUR SHADOWS.' },
  { slot: 'ann_voidwalker_landed', text: 'VOIDWALKER ON THE FIELD. HE IS ALREADY BEHIND SOMEONE.' },
  { slot: 'ann_voidwalker_down', text: 'VOIDWALKER IS DOWN. THE SHADOWS EMPTY.' },
  { slot: 'ann_voidwalker_rampage', text: 'FIVE KILLS. VOIDWALKER IS EVERYWHERE AT ONCE.' },
  { slot: 'ann_crimson_inbound', text: 'CRIMSON INBOUND. [short pause] POLICE YOUR DEAD.' },
  { slot: 'ann_crimson_landed', text: 'CRIMSON ON THE FIELD. EVERY LOSS FEEDS HIM.' },
  { slot: 'ann_crimson_down', text: 'CRIMSON IS DOWN. THE POOLS GO STILL.' },
  { slot: 'ann_crimson_rampage', text: 'FIVE KILLS. CRIMSON DRINKS THE WHOLE FRONT.' },
  { slot: 'ann_mirage_inbound', text: 'MIRAGE INBOUND. [short pause] COUNT YOUR TARGETS TWICE.' },
  { slot: 'ann_mirage_landed', text: 'MIRAGE ON THE FIELD. ONE OF THEM IS REAL.' },
  { slot: 'ann_mirage_down', text: 'MIRAGE IS DOWN. THE REAL ONE, THIS TIME.' },
  { slot: 'ann_mirage_rampage', text: 'FIVE KILLS. MIRAGE IS AN ARMY OF ONE.' },
  { slot: 'ann_blitz_inbound', text: 'BLITZ INBOUND. [short pause] HE IS ALREADY MOVING.' },
  { slot: 'ann_blitz_landed', text: 'BLITZ ON THE FIELD. DO NOT LET HIM CHAIN.' },
  { slot: 'ann_blitz_down', text: 'BLITZ IS DOWN. CAUGHT BETWEEN DASHES.' },
  { slot: 'ann_blitz_rampage', text: 'FIVE KILLS. BLITZ HAS NOT STOPPED ONCE.' },
  { slot: 'ann_shadowstep_inbound', text: 'SHADOWSTEP INBOUND. [short pause] GUARD YOUR BACKS.' },
  { slot: 'ann_shadowstep_landed', text: 'SHADOWSTEP ON THE FIELD. DO NOT CHASE HIM.' },
  { slot: 'ann_shadowstep_down', text: 'SHADOWSTEP IS DOWN. CHECK IT TWICE.' },
  { slot: 'ann_shadowstep_rampage', text: 'FIVE KILLS. SHADOWSTEP IS EVERYWHERE YOU ARE NOT.' },
  { slot: 'ann_specter_inbound', text: 'SPECTER INBOUND. [short pause] COUNT THE SHADOWS.' },
  { slot: 'ann_specter_landed', text: 'SPECTER ON THE FIELD. THEY ALL WALK LIKE HIM.' },
  { slot: 'ann_specter_down', text: 'SPECTER IS DOWN. THE MIRRORS CRACK.' },
  { slot: 'ann_specter_rampage', text: 'FIVE KILLS. SPECTER IS A CROWD.' },
  { slot: 'ann_pulse_inbound', text: 'PULSE INBOUND. [short pause] WALLS WILL NOT SAVE YOU.' },
  { slot: 'ann_pulse_landed', text: 'PULSE ON THE FIELD. HE HEARS EVERYTHING.' },
  { slot: 'ann_pulse_down', text: 'PULSE IS DOWN. THE AIR STOPS RINGING.' },
  { slot: 'ann_pulse_rampage', text: 'FIVE KILLS. PULSE HAS THE WHOLE MAP TAGGED.' },
  { slot: 'ann_venom_inbound', text: 'VENOM INBOUND. [short pause] CHECK YOUR SEALS.' },
  { slot: 'ann_venom_landed', text: 'VENOM ON THE FIELD. THE AIR HAS TEETH.' },
  { slot: 'ann_venom_down', text: 'VENOM IS DOWN. LET IT DISPERSE.' },
  { slot: 'ann_venom_rampage', text: 'FIVE KILLS. VENOM OWNS EVERY BREATH.' },
  { slot: 'ann_nightmare_inbound', text: 'NIGHTMARE INBOUND. [short pause] TRUST NOTHING RED.' },
  { slot: 'ann_nightmare_landed', text: 'NIGHTMARE ON THE FIELD. YOUR MAP IS LYING.' },
  { slot: 'ann_nightmare_down', text: 'NIGHTMARE IS DOWN. THE CONTACTS CLEAR.' },
  { slot: 'ann_nightmare_rampage', text: 'FIVE KILLS. NIGHTMARE IS IN EVERY HEAD.' },
  { slot: 'ann_reaper_inbound', text: 'REAPER INBOUND. [short pause] NOBODY WANDERS ALONE.' },
  { slot: 'ann_reaper_landed', text: 'REAPER ON THE FIELD. SOMEBODY IS ALREADY MARKED.' },
  { slot: 'ann_reaper_down', text: 'REAPER IS DOWN. THE HUNT IS OFF.' },
  { slot: 'ann_reaper_rampage', text: 'FIVE KILLS. THE REAPER KEEPS HIS LEDGER.' },
];

export const ANN_NOTES = [
  'Clipped military radio — high urgency, zero fear.',
  'Every line lands in under three seconds.',
  'He has read a thousand of these. This one still matters.',
];
