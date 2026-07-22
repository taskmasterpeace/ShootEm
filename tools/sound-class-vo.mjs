#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPrompt, generateClip } from './tts-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = join(ROOT, 'public', 'audio');
const MANIFEST_PATH = join(AUDIO_DIR, 'casting', 'mortal-classes-manifest.json');
export const LANGUAGE_CODE = 'en-US';

export const CLASS_CAST = {
  infantry: {
    name: 'Gabriel "Gabe" Reyes',
    role: 'Infantry',
    voice: 'Achird',
    safePersona: 'Gabe Reyes, a warm working-man South Texas baritone with calm, grounded authority and restrained practical humor.',
    persona: 'Gabriel "Gabe" Reyes, a 34-year-old Mexican-American infantryman from South Texas. Warm working-man baritone with a restrained South Texas cadence. Dependable, observant, and quietly protective: the squad anchor rather than a shouting drill sergeant. His humor is practical and sparse, and immediate danger strips every joke away.',
    fadePersona: 'Gabriel "Gabe" Reyes, a warm South Texas working-man baritone. His breath is weak but his instinct is still to protect the squad.',
    style: ['Keep the delivery plainspoken and grounded, never a movie-trailer soldier.', 'Let warmth appear most clearly when he helps another trooper.'],
  },
  heavy: {
    name: 'Omar "Big O" Haddad',
    role: 'Heavy Weapons',
    voice: 'Algenib',
    safePersona: 'Omar Haddad, a cavernous textured Detroit bass with patient warmth, precise timing, and gently underplayed humor.',
    persona: 'Omar "Big O" Haddad, a 43-year-old Lebanese-American heavy-weapons operator from Dearborn. Cavernous textured bass with a Detroit edge and the warmth of a patient favorite uncle. He treats enormous firepower like ordinary factory equipment: careful, competent, faintly amused. Never play him as stupid, lumbering, or a cartoon giant.',
    fadePersona: 'Omar "Big O" Haddad, a deep textured Detroit bass. His great physical presence is failing, but he remains concerned about the squad and the loaded weapon beside him.',
    style: ['Use measured weight and an audible smile in dry lines.', 'When danger spikes, turn the bass into a clear protective command without slowing the information.'],
  },
  jump: {
    name: 'Keisha "Kite" Bell',
    role: 'Jump Trooper',
    voice: 'Laomedeia',
    safePersona: 'Keisha "Kite" Bell, a quick bright South Florida alto with agile sarcasm, clean diction, and breath that tracks rapid motion.',
    persona: 'Keisha "Kite" Bell, a 28-year-old Black woman from Miami Gardens and a veteran jump trooper. Quick bright alto, authentic South Florida Black English rhythm, streetwise observation, and agile sarcasm. Her breath and pace track the jetpack: controlled before launch, exhilarated in flight, breathless after landing, genuinely alarmed when thrust fails. No caricature and no invented slang.',
    fadePersona: 'Keisha "Kite" Bell, a quick bright South Florida alto now thinned by failing breath. The confidence drops away and her care for the squad comes through.',
    style: ['Keep the wit quick and specific; never turn every line into a punch line.', 'Let altitude, acceleration, breath, and landing impact physically change the read.'],
  },
  engineer: {
    name: 'Naveen "Patch" Singh',
    role: 'Combat Engineer',
    voice: 'Sadaltager',
    safePersona: 'Naveen "Patch" Singh, a textured knowledgeable Brampton tenor with methodical patience and extremely dry understatement.',
    persona: 'Naveen "Patch" Singh, a 48-year-old Punjabi-Canadian combat engineer from Brampton. Textured knowledgeable tenor with an easy Canadian cadence and subtle Punjabi musicality. Methodical, patient, and extremely dry. He speaks to machinery more gently than he speaks to careless soldiers, but his concern becomes sincere when somebody is hurt.',
    fadePersona: 'Naveen "Patch" Singh, a textured patient Brampton tenor. His focus narrows to one last practical concern as strength leaves him.',
    style: ['Deliver technical observations as lived competence, not robotic jargon.', 'Dry remarks stay underplayed; emergencies become loud, exact, and human.'],
  },
  medic: {
    name: 'Dr. Amina "Doc" Okafor',
    role: 'Field Medic',
    voice: 'Kore',
    safePersona: 'Doctor Amina "Doc" Okafor, a controlled Nigerian-British contralto with crisp authority, clinical precision, and direct warmth.',
    persona: 'Doctor Amina "Doc" Okafor, a 39-year-old Nigerian-British field medic. Controlled contralto with crisp London-influenced English and a natural Nigerian cadence. Brisk, authoritative, and intolerant of preventable injuries. The clinical wit protects a deeply compassionate core that becomes unmistakable when a patient is frightened or fading.',
    fadePersona: 'Doctor Amina "Doc" Okafor, a controlled contralto whose breath is now barely supported. Even at the edge of consciousness she is thinking about the patient beside her.',
    style: ['Make commands medically precise and instantly obeyable.', 'When treating a critical patient, lose the dryness and reveal direct human warmth.'],
  },
  pathfinder: {
    name: 'Mateo "Skip" Alvarez',
    role: 'Pathfinder',
    voice: 'Sadachbia',
    safePersona: 'Mateo "Skip" Alvarez, a fast buoyant Bronx tenor with warm rhythm, forward momentum, and delight in clever timing.',
    persona: 'Mateo "Skip" Alvarez, a 30-year-old Puerto Rican pathfinder from the Bronx. Fast buoyant tenor with warm New York rhythm and restless forward momentum. He sees battlefields as doors, angles, and shortcuts. Clever without being slippery, upbeat without being childish, and most alive when a route nobody else saw suddenly works.',
    fadePersona: 'Mateo "Skip" Alvarez, a warm quick Bronx tenor slowed almost to stillness. He uses the last breath to keep the squad route safe.',
    style: ['Keep his pace agile but every tactical word intelligible.', 'His pleasure comes from geometry and timing, not reckless chaos.'],
  },
  ghost: {
    name: 'Elias "Switch" Baptiste',
    role: 'Ghost',
    voice: 'Schedar',
    safePersona: 'Elias "Switch" Baptiste, a soft low Brooklyn baritone with measured cadence, close-headset focus, and quiet observational confidence.',
    persona: 'Elias "Switch" Baptiste, a 35-year-old Haitian-American Ghost operator from Brooklyn. Soft low baritone, measured Brooklyn cadence, and intense observational focus. He is quiet because he is listening, not because he is supernatural. Nearly conversational during surveillance work, sharply louder when physical danger reaches the team. Never play him as sinister or emotionless.',
    fadePersona: 'Elias "Switch" Baptiste, a soft low Brooklyn baritone losing signal and breath together. The final words are a factual sign-off with fear underneath.',
    style: ['Recon lines stay close, low, and intimate as though sharing one headset.', 'Emergency lines break the hush immediately and carry exact spatial information.'],
  },
};

const COMMON_MOMENTS = {
  intro: ['The match begins and this operator introduces themself over close squad comms.', ['Give the squad a memorable first impression without sounding like a résumé.', 'Land the final promise as genuine capability.']],
  deploy: ['The deployment gate opens and the squad takes its first steps into live fire.', ['Speak while checking equipment and moving.', 'Confident readiness, with no ceremonial announcer cadence.']],
  move: ['The operator calls a short tactical relocation while the squad is exposed.', ['Keep the instruction clipped and useful.', 'Physical movement must be audible under the words.']],
  attack: ['The squad commits to an attack and the operator calls the opening push.', ['Project over weapons with immediate command energy.', 'No theatrical battle speech; this is happening now.']],
  hold: ['The squad has reached defensible ground and must stop an enemy push.', ['Firm controlled command rather than panic.', 'The character believes this position can be held.']],
  taking_fire: ['Incoming rounds snap close and the operator identifies the threat direction.', ['Urgent battlefield shout with sharp consonants.', 'Fear may flash through, but the information stays clear.']],
  grenade_in: ['A live grenade lands inside the squad position with only seconds to move.', ['Full alarm shout; no humor survives this moment.', 'Fast enough to save a life, never garbled.']],
  reload: ['The weapon runs low during contact and the operator asks the squad to cover the lane.', ['Short breath and active hands under the line.', 'Report the vulnerability without melodrama.']],
  kill: ['A single enemy drops and the operator immediately checks for the next threat.', ['Controlled confirmation rather than celebration.', 'Let the personality color the release after danger.']],
  kill_multi: ['Several enemies fall in one fast exchange and a lane suddenly opens.', ['Allow a brief flash of satisfaction.', 'Keep momentum pointed toward the next action.']],
  low_health: ['The operator is badly wounded but remains upright and combat-capable.', ['Strained breath and real pain beneath professional control.', 'Do not make the injury sound trivial.']],
  downed: ['The operator hits the ground wounded and cannot fight until a teammate reaches them.', ['Painfully loud enough for nearby help.', 'Vulnerability replaces swagger without becoming melodrama.']],
  ally_downed: ['A teammate falls nearby and the operator commits to reaching them.', ['Protective urgency aimed at both the casualty and the squad.', 'Keep moving while speaking.']],
  reviving: ['The operator kneels under danger and works to bring a wounded teammate back.', ['Close, direct voice meant for one frightened person.', 'Warmth and focus matter more than wit.']],
  revived: ['A teammate has just pulled the operator back from the edge and they regain their feet.', ['Unsteady first breath, then returning purpose.', 'Gratitude can be brief but must be real.']],
  death: ['Strength gives way and the battlefield recedes while the operator manages a final thought.', ['Barely supported voice with breath failing between phrases.', 'No scream, no melodrama, and no added words.']],
  flag_pickup: ['The operator takes the enemy flag and immediately begins the dangerous route home.', ['Report possession while already moving.', 'The increased danger is understood beneath the personality.']],
  carrier_escort: ['A friendly carrier crosses exposed ground and needs the squad to close around them.', ['Protective tactical command first.', 'Keep pace with a moving carrier.']],
  flag_dropped: ['The friendly carrier falls and both teams begin converging on the loose flag.', ['Immediate battlefield yell with clean information.', 'No joke; the recovery window is brief.']],
  flag_capture: ['The flag reaches home after a dangerous run and the squad earns one breath of relief.', ['Controlled celebration that belongs to this character.', 'Finish ready to reset for the next run.']],
};

const SPECIAL_MOMENTS = {
  frag_ready: ['A grenade is in hand while the squad identifies a protected enemy pocket.', ['Controlled warning to friendlies nearby.', 'Build anticipation without dragging the timing.']],
  frag_throw: ['The operator throws a live fragmentation grenade into the called pocket.', ['Sharp throwing exertion and loud warning.', 'The line lands with the release of the arm.']],
  frag_cook: ['The operator holds the fuse for a dangerous beat before throwing.', ['Count the risk in a tight controlled voice.', 'Explode into the final word as the grenade leaves.']],
  frag_bad_bounce: ['The thrown grenade ricochets back toward friendly ground.', ['Immediate alarm yell with genuine surprise.', 'Drop all composure and save the squad.']],
  frag_flush: ['The blast forces enemies out of cover into the rifle lane.', ['Quick confirmation while reacquiring the rifle sight.', 'The satisfaction is tactical, not cruel.']],
  shield_up: ['The heavy plants a shield dome as fire closes around nearby teammates.', ['Large protective command that invites the squad inside.', 'Relief and responsibility arrive together.']],
  shield_failing: ['Impacts fracture the dome and only moments of protection remain.', ['Full warning shout over cracking energy.', 'Make the squad choose new cover immediately.']],
  autocannon_brace: ['The heavy plants their feet, shoulders the autocannon, and opens a sustained lane.', ['Deep braced breath with controlled anticipation.', 'The last phrase releases the weapon’s weight.']],
  missile_armor: ['The launcher finds a crewed armored target and a missile leaves the tube.', ['Clear anti-armor call above mechanical noise.', 'Respect the danger of the target.']],
  missile_hit: ['The missile strikes the target vehicle and visibly damages it.', ['Solid professional confirmation.', 'Underplay the satisfaction.']],
  autocannon_empty: ['The autocannon belt ends during an exposed fight.', ['Dry surprise under immediate vulnerability.', 'Keep working the mechanism while speaking.']],
  jet_ignite: ['The jump trooper squeezes the controls and the jetpack lifts hard from the ground.', ['Voice rises physically with acceleration.', 'A bright confident launch, not a posed catchphrase.']],
  airborne_attack: ['The jump trooper dives through an enemy blind angle and fires in motion.', ['Shout through wind and acceleration.', 'Fast, delighted, and fully committed.']],
  fuel_low: ['The fuel gauge falls into reserve while the trooper is still airborne.', ['Breath tightens and confidence becomes calculation.', 'Urgent report without panic.']],
  fuel_empty: ['Thrust cuts out at dangerous altitude and the trooper begins falling.', ['Genuine alarm shout with breath knocked loose.', 'The landing warning must dominate everything.']],
  hard_landing: ['The trooper hits the ground hard after a fast descent.', ['Speak through the impact and recovery breath.', 'Dry humor arrives only after confirming survival.']],
  jet_ready: ['The pack finishes recharging and can lift again.', ['Energy and confidence return to the voice.', 'Keep the line moving toward the next launch.']],
  air_watched: ['Enemy weapons begin tracking the trooper’s altitude and expected path.', ['Quick tactical recalculation in mid-air.', 'No bravado; changing altitude is survival.']],
  turret_built: ['The engineer locks a sentry into position and verifies its firing arc.', ['Satisfied technical confirmation.', 'Hands remain on the mechanism during the line.']],
  turret_target: ['The sentry rotates and acquires approaching movement.', ['Warn the squad without competing with the weapon.', 'Quiet confidence in the machine.']],
  turret_lost: ['Enemy fire destroys the engineer’s deployed sentry.', ['Personal irritation breaks through professional focus.', 'The loss is tactical, not sentimental melodrama.']],
  mine_planted: ['The engineer arms a concealed mine on ground friendlies may cross later.', ['Low precise warning for nearby teammates.', 'Make the location feel memorable without adding coordinates.']],
  vehicle_repair: ['The engineer works inside a damaged engine compartment while the fight continues.', ['Speak through effort and clattering tools.', 'Calm the driver while diagnosing the machine.']],
  vehicle_repaired: ['The damaged vehicle returns to dependable operating condition.', ['Measured satisfaction after listening to the engine.', 'The dry warning is affectionate toward the machine.']],
  contamination_cleared: ['The engineer purges corrosive contamination from a vehicle system.', ['Relief after careful dangerous work.', 'Treat the machine like a patient without becoming whimsical.']],
  heal_start: ['The medic connects the medi-beam to a moving wounded teammate.', ['Firm close instruction with controlled care.', 'The patient needs to trust the voice immediately.']],
  heal_critical: ['A teammate is fading and the medic fights to keep them conscious.', ['Drop the wit entirely and speak with fierce warmth.', 'Make each breath instruction precise and personal.']],
  heal_complete: ['The patient stabilizes and can return to the fight.', ['Professional relief, still monitoring them.', 'The warning is protective rather than scolding.']],
  self_stim: ['The medic injects herself while wounded so she can continue treating others.', ['Brief pain and clinical control.', 'The line is a decision, not a joke.']],
  infection_reduced: ['Treatment lowers a dangerous viral load before it can take hold.', ['Reassuring authority over a frightening diagnosis.', 'Keep panic out of both voices.']],
  beam_empty: ['The medi-beam charge empties while wounded teammates still need help.', ['Urgent command with restrained frustration.', 'The recharge window feels dangerous.']],
  patient_moving: ['A wounded teammate repeatedly dodges out of the medi-beam.', ['Project across the firefight with exasperated authority.', 'The irritation comes from genuine concern.']],
  beacon_alpha: ['The pathfinder plants the first end of a warp route in defensible ground.', ['Quick location confirmation with forward momentum.', 'This is half a plan, not a completed victory.']],
  beacon_beta: ['The second beacon locks in near the objective and completes the surprise route.', ['Excited but tactically clear.', 'Let the success of the geometry light the voice.']],
  link_live: ['The two warp beacons synchronize and the corridor opens.', ['Warn newcomers about the physical transition.', 'Pleased confidence without slowing traffic.']],
  warp_enter: ['The pathfinder steps into the live warp corridor under enemy pressure.', ['Low quick commitment close to the microphone.', 'The line disappears into the transition.']],
  impulse_fire: ['The impulse cannon releases a concussive shot toward grouped enemies.', ['Strong exertion and immediate space-making command.', 'Enjoy the physics without sounding cruel.']],
  impulse_kill: ['A knocked enemy is carried away and finished by the impact.', ['Brief surprised satisfaction.', 'Keep scanning the new lane.']],
  beacon_destroyed: ['Enemy fire destroys one endpoint and collapses the route.', ['Sharp disappointed warning to the squad.', 'The tactical loss matters more than wounded pride.']],
  drone_launch: ['The Ghost releases a compact recon drone into the air.', ['Quiet intimate send-off close to one headset.', 'Almost no projection; conceal the operator’s position.']],
  drone_fpv: ['The Ghost’s vision transfers into the piloted drone while their body stays exposed.', ['Low precise report as attention leaves the body.', 'Trust the squad with the vulnerability.']],
  drone_mark: ['The drone identifies an enemy through a wall and feeds an exact offset.', ['Very quiet close-mic spatial instruction.', 'Measured certainty; do not make the mark theatrical.']],
  signal_low: ['Distance and interference begin breaking the drone video feed.', ['Controlled low warning under electronic strain.', 'Decision-making stays calm as information degrades.']],
  drone_destroyed: ['The drone feed flashes out after enemy fire destroys it.', ['A small involuntary reaction, then a factual report.', 'The loss leaves the voice more exposed.']],
  emp_planted: ['The Ghost arms an EMP charge beside an active enemy vehicle.', ['Near-whispered confidence while remaining hidden.', 'The threat is technical and imminent.']],
  emp_stall: ['The EMP discharges and the enemy vehicle loses power.', ['Quiet confirmation that immediately drives team movement.', 'Do not celebrate before the squad exploits the opening.']],
};

function moment(slot, text) {
  const direction = COMMON_MOMENTS[slot] ?? SPECIAL_MOMENTS[slot];
  if (!direction) throw new Error('missing direction for moment ' + slot);
  return { moment: slot, text, scene: direction[0], notes: direction[1] };
}

function linesFor(classId, rows) {
  return rows.map(([name, text, overrides]) => {
    const entry = moment(name, text);
    return {
      slot: name === 'death' ? 'death_' + classId : 'vo_' + classId + '_' + name,
      text: entry.text,
      scene: overrides?.scene ?? entry.scene,
      notes: overrides?.notes ?? entry.notes,
    };
  });
}

const infantry = [
  ['intro', 'Gabe Reyes. Rifle up, eyes open. Stay near me and we all get home.'],
  ['deploy', 'Nothing fancy. We take the ground, then we keep it.'],
  ['move', 'On me. Short rushes.'],
  ['attack', 'Front sight, center mass. Work ’em.'],
  ['hold', 'This patch is ours. Make ’em pay rent.'],
  ['taking_fire', 'Contact, front-left! Get small!'],
  ['grenade_in', 'Frag! Off the wall—move!'],
  ['reload', 'Changing magazine. Cover my lane.'],
  ['kill', 'One down. Keep scanning.'],
  ['kill_multi', 'Lane’s clear. Push it before they reconsider.'],
  ['low_health', 'I’m hit. Still useful.'],
  ['downed', 'I’m down, not done. Drag me in.'],
  ['ally_downed', 'We got one down! I’m going.'],
  ['reviving', 'Stay with me. Breathe and look at me.'],
  ['revived', 'There we go. Back in the fight.'],
  ['death', 'Tell ’em... we held.', {
    notes: ['Breath is failing, but articulate “Tell ’em” as two distinct words before the pause.', 'Fade on “held” without adding a scream or extra words.'],
  }],
  ['flag_pickup', 'Flag’s with me. Build me a road.'],
  ['carrier_escort', 'Carrier moving. Shoulders out, eyes wide.'],
  ['flag_dropped', 'Flag loose! Nobody dies staring at it!'],
  ['flag_capture', 'That’s home. That’s a point. Reset.'],
  ['frag_ready', 'Frag ready. Call the pocket.'],
  ['frag_throw', 'Sending one!'],
  ['frag_cook', 'Cooking it... now!'],
  ['frag_bad_bounce', 'Bad bounce! Break!'],
  ['frag_flush', 'There they go. Rifles finish it.'],
];

const heavy = [
  ['intro', 'Omar Haddad. You bring me targets; I bring the weather.'],
  ['deploy', 'Big gun, small doorway. We will negotiate.'],
  ['move', 'I am moving. The ammunition is moving slower.'],
  ['attack', 'Heavy fire, coming through!'],
  ['hold', 'Behind me. We make our stand here.'],
  ['taking_fire', 'Rounds on the heavy! I noticed!'],
  ['grenade_in', 'Grenade! Outside the dome—move!'],
  ['reload', 'Long reload. This is why I have friends.'],
  ['kill', 'That problem has become spare parts.'],
  ['kill_multi', 'See? A very efficient meeting.'],
  ['low_health', 'Armor’s gone. Omar remains.'],
  ['downed', 'Big target is down. Little help?'],
  ['ally_downed', 'Stay there. I am bringing the wall.'],
  ['reviving', 'Easy, my friend. Heavy hands can still be gentle.'],
  ['revived', 'Ah. Back to being everybody’s wall.'],
  ['death', 'Gun’s still loaded... do not waste it.'],
  ['flag_pickup', 'I have the flag. This was not the fast plan.'],
  ['carrier_escort', 'Stay behind the heavy. Yes, that is me.'],
  ['flag_dropped', 'Flag is down! I will make room around it!'],
  ['flag_capture', 'Slow delivery. Same receipt.'],
  ['shield_up', 'Dome up! Bring your breathing inside.'],
  ['shield_failing', 'Dome is cracking! Choose your next cover!'],
  ['autocannon_brace', 'Bracing. Let it eat.'],
  ['missile_armor', 'Armor marked. Missile away!'],
  ['missile_hit', 'Direct hit. The machine felt that.'],
  ['autocannon_empty', 'Cannon dry. This is socially awkward.'],
];

const jump = [
  ['intro', 'Keisha Bell—Kite on comms. If you lose me, look up.'],
  ['deploy', 'Y’all take the road. I’m allergic to traffic.'],
  ['move', 'Roofline. Meet me there.'],
  ['attack', 'Dropping in—make room!'],
  ['hold', 'I got high side. Don’t make me babysit low.'],
  ['taking_fire', 'Oh, they mad-mad! Shots from the east!'],
  ['grenade_in', 'Grenade! Cute—move!'],
  ['reload', 'Reloading in the air. Terrible life choices.'],
  ['kill', 'Caught you looking straight ahead.'],
  ['kill_multi', 'That whole corner needed an attitude adjustment.'],
  ['low_health', 'Jet’s fine. I am less fine.'],
  ['downed', 'Okay, gravity won one. Come get me.'],
  ['ally_downed', 'Hold on! I’m coming over the wall!'],
  ['reviving', 'Don’t quit while I’m down here being responsible.'],
  ['revived', 'See? Can’t keep good trouble grounded.'],
  ['death', 'Hey... don’t let ’em take the sky.', {
    notes: ['Weak breath, but articulate every word after the pause and make “sky” unmistakably distinct.', 'The care for the squad replaces the usual sarcasm.'],
  }],
  ['flag_pickup', 'Got the flag. Tell the ground crew to keep up.'],
  ['carrier_escort', 'Carrier below me. Touch them and I drop on you.'],
  ['flag_dropped', 'Flag down! I can reach it—cover me!'],
  ['flag_capture', 'Air mail, delivered.'],
  ['jet_ignite', 'Kite going vertical.'],
  ['airborne_attack', 'From your blind side!'],
  ['fuel_low', 'Tank’s coughing. I’m coming down.'],
  ['fuel_empty', 'No thrust! Clear my landing!'],
  ['hard_landing', 'Feet down. Knees filing complaints.'],
  ['jet_ready', 'Fuel’s back. Sky’s mine.'],
  ['air_watched', 'They got eyes up. Changing altitude.'],
];

const engineer = [
  ['intro', 'Naveen Singh. Patch if something is broken. Mister Singh if you broke it.'],
  ['deploy', 'Give me thirty seconds and one defensible corner.'],
  ['move', 'Moving the workshop.'],
  ['attack', 'Tools down. Shotgun up.'],
  ['hold', 'This position has good bones. Let me improve it.'],
  ['taking_fire', 'They are shooting the engineer. Predictable and rude.'],
  ['grenade_in', 'Explosive in the workspace! Clear!'],
  ['reload', 'Feeding the problem-solver.'],
  ['kill', 'Diagnosis: poor maintenance.', {
    notes: ['Articulate “Diagnosis” clearly before a small dry pause.', 'Underplay the joke and keep scanning the lane.'],
  }],
  ['kill_multi', 'That repair is beyond warranty.'],
  ['low_health', 'Leaking in several non-approved places.'],
  ['downed', 'Patch requires patching. Yes, I hear it.'],
  ['ally_downed', 'Patient on the floor. Cover me.'],
  ['reviving', 'I fix people reluctantly. Hold still.'],
  ['revived', 'Excellent. I remain billable.'],
  ['death', 'Don’t leave... the turret facing the wall.'],
  ['flag_pickup', 'Flag acquired. I did not bring the fast boots.'],
  ['carrier_escort', 'Bring the carrier through my sentry arc.'],
  ['flag_dropped', 'Flag down near me! I can fortify it!'],
  ['flag_capture', 'Delivered within acceptable tolerances.'],
  ['turret_built', 'Sentry seated. Arc is clear.'],
  ['turret_target', 'Sentry has movement. Heads down.'],
  ['turret_lost', 'My sentry is gone. I take that personally.'],
  ['mine_planted', 'Mine armed. Remember where your feet are.'],
  ['vehicle_repair', 'Hold her steady. I have the engine.'],
  ['vehicle_repaired', 'Vehicle is clean. Try not to invent a new noise.'],
  ['contamination_cleared', 'Contamination cleared. Metal may breathe again.'],
];

const medic = [
  ['intro', 'Doctor Amina Okafor. I keep you alive; you make that difficult.'],
  ['deploy', 'Check your seals, your magazines, and the person beside you.'],
  ['move', 'Move. Bleeding may continue en route.'],
  ['attack', 'Contact. I am a doctor with a weapon, not a pacifist.'],
  ['hold', 'Triage point here. Bring me anyone still arguing.'],
  ['taking_fire', 'They are targeting the medic. How original.'],
  ['grenade_in', 'Grenade! Patients and future patients—move!'],
  ['reload', 'Reloading. Please avoid emergencies for three seconds.'],
  ['kill', 'Threat treated.'],
  ['kill_multi', 'Preventive medicine.'],
  ['low_health', 'I am injured. Inconvenient, not terminal.'],
  ['downed', 'Medic down. Yes, the irony is noted.'],
  ['ally_downed', 'I see you. Keep pressure on it.'],
  ['reviving', 'Eyes open. You are not leaving my shift.'],
  ['revived', 'Thank you. Now point me at my patient.'],
  ['death', 'Keep... the beam on them.'],
  ['flag_pickup', 'I have the flag. Apparently everyone else was bleeding.'],
  ['carrier_escort', 'Protect the carrier. I will keep them moving.'],
  ['flag_dropped', 'Flag down! Stabilize the lane first!'],
  ['flag_capture', 'Objective secured. Now who needs stitches?'],
  ['heal_start', 'Beam on you. Stop dodging your healthcare.'],
  ['heal_critical', 'Stay with me. Breathe when I tell you.'],
  ['heal_complete', 'Stable. Try not to reopen anything.'],
  ['self_stim', 'Self-stim. Doctor’s orders.'],
  ['infection_reduced', 'Load reduced. Infection is not permission to panic.'],
  ['beam_empty', 'Beam is dry. Cover me while it charges.'],
  ['patient_moving', 'If you want treatment, stop running from the doctor!'],
];

const pathfinder = [
  ['intro', 'Mateo Alvarez. Call me Skip. Maps show where people went; I show where we’re going.'],
  ['deploy', 'The long way is for people with no imagination.'],
  ['move', 'Cutting left. Trust me for six seconds.'],
  ['attack', 'I’m in their side pocket—push!'],
  ['hold', 'This lane bends through me now.'],
  ['taking_fire', 'They found the shortcut! Need pressure!'],
  ['grenade_in', 'Grenade on the route! Reroute!'],
  ['reload', 'Reloading. Keep the doorway rude.'],
  ['kill', 'You watched the road. Rookie mistake.'],
  ['kill_multi', 'Shortcut just became a toll booth.'],
  ['low_health', 'I’m clipped. Speed’s still paid for.'],
  ['downed', 'Route’s closed. Need a pickup.'],
  ['ally_downed', 'I can reach them. Hold the lane.'],
  ['reviving', 'Took the fast way to you. Stay awake.'],
  ['revived', 'Back on my feet. Where’s the gap?'],
  ['death', 'Close... the route behind me.'],
  ['flag_pickup', 'Flag on the express line. Clear my exit.'],
  ['carrier_escort', 'I’m opening a lane for the carrier.'],
  ['flag_dropped', 'Flag fell off-route! Swing back!'],
  ['flag_capture', 'Shortest distance between us and winning.'],
  ['beacon_alpha', 'Beacon Alpha planted. This is where we leave.'],
  ['beacon_beta', 'Beacon Beta live. This is where we surprise them.'],
  ['link_live', 'Pair is hot. Step clean or lose your lunch.'],
  ['warp_enter', 'Taking the shortcut—now.'],
  ['impulse_fire', 'Impulse out! Give ’em room to fly!'],
  ['impulse_kill', 'Sent them the scenic way.'],
  ['beacon_destroyed', 'Link is dead. Somebody found my door.'],
];

const ghost = [
  ['intro', 'Elias Baptiste. Switch on comms. I see the room before the room sees us.'],
  ['deploy', 'Keep talking. Noise gives me edges.'],
  ['move', 'Moving underneath their attention.'],
  ['attack', 'Marked lane. Take the shot.'],
  ['hold', 'I have eyes through the wall. Hold still and listen.', {
    notes: ['Keep this low and close as though sharing one headset.', 'The quiet is tactical concentration, never a spooky affectation.'],
  }],
  ['taking_fire', 'They found my body! Break their sightline!'],
  ['grenade_in', 'Charge in! Three steps, any direction!'],
  ['reload', 'Reloading. Drone keeps watch.'],
  ['kill', 'Contact erased.'],
  ['kill_multi', 'Their picture just went dark.'],
  ['low_health', 'I’m bleeding. Signal remains.'],
  ['downed', 'Switch is down. Feed is still live.'],
  ['ally_downed', 'Friendly down. I have the safe approach.'],
  ['reviving', 'Stay quiet. Let them think the room is empty.'],
  ['revived', 'Back online.'],
  ['death', 'Feed... terminated.'],
  ['flag_pickup', 'Flag in hand. Their cameras missed the exchange.'],
  ['carrier_escort', 'Carrier covered. I am watching the watchers.'],
  ['flag_dropped', 'Flag down. Enemy eyes converging.'],
  ['flag_capture', 'They never saw the handoff.'],
  ['drone_launch', 'Little eye, up.'],
  ['drone_fpv', 'Taking the drone. Guard the quiet body.'],
  ['drone_mark', 'Marked. Through the wall, three meters right.'],
  ['signal_low', 'Signal degrading. Bringing the eye home.', {
    notes: ['Quietly articulate “signal degrading” as two distinct technical words.', 'Stay controlled and close to the headset while information breaks up.'],
  }],
  ['drone_destroyed', 'Eye is gone. We work blind.'],
  ['emp_planted', 'EMP set. Armor’s about to forget its name.'],
  ['emp_stall', 'Vehicle stalled. Move before it remembers.'],
];

export const CLASS_LINES = {
  infantry: linesFor('infantry', infantry),
  heavy: linesFor('heavy', heavy),
  jump: linesFor('jump', jump),
  engineer: linesFor('engineer', engineer),
  medic: linesFor('medic', medic),
  pathfinder: linesFor('pathfinder', pathfinder),
  ghost: linesFor('ghost', ghost),
};

export function allClassLines() {
  return Object.entries(CLASS_LINES).flatMap(([classId, lines]) => lines.map((entry) => ({ classId, ...entry })));
}

export function classPrompt(classId, entry, { safe = false } = {}) {
  const actor = CLASS_CAST[classId];
  if (!actor) throw new Error('unknown mortal class ' + classId);
  if (safe) {
    return buildPrompt({
      persona: actor.safePersona,
      scene: 'A fictional game operator speaks one short line during a fast team exercise.',
      notes: [
        'Voice only the supplied line with natural physical energy implied by its punctuation.',
        'Speak only the supplied dialogue. Add no labels, directions, introductions, music, effects, or extra words.',
        ...actor.style,
      ],
    });
  }
  return buildPrompt({
    persona: entry.slot === 'death_' + classId ? actor.fadePersona : actor.persona,
    scene: entry.scene,
    notes: [
      'Perform the exact physical and emotional moment; do not flatten the pack into one audiobook cadence.',
      'Speak only the supplied dialogue. Add no labels, stage directions, introductions, music, effects, or extra words.',
      ...actor.style,
      ...entry.notes,
    ],
  });
}

export function validateClassManifest() {
  const errors = [];
  const lines = allClassLines();
  if (lines.length !== 186) errors.push('expected 186 approved lines, got ' + lines.length);
  const seen = new Set();
  for (const entry of lines) {
    if (seen.has(entry.slot)) errors.push('duplicate slot: ' + entry.slot);
    seen.add(entry.slot);
    if (!entry.text || !entry.text.trim()) errors.push(entry.slot + ': empty text');
    if (!entry.scene || !entry.scene.trim()) errors.push(entry.slot + ': empty scene');
    if (!Array.isArray(entry.notes) || entry.notes.length < 2) errors.push(entry.slot + ': needs two acting notes');
  }
  for (const classId of Object.keys(CLASS_CAST)) {
    if (!seen.has('vo_' + classId + '_intro')) errors.push(classId + ': missing intro');
    if (!seen.has('death_' + classId)) errors.push(classId + ': missing live death slot');
  }
  return errors;
}

export function oggPathFor(wavPath) {
  return wavPath.replace(/\.wav$/i, '.ogg');
}

export function performanceTextFor(entry) {
  if (entry.slot === 'death_jump') return '[strained] Hey... [short pause] [clearly] don’t let ’em take the sky.';
  if (entry.slot === 'vo_engineer_kill') return '[clearly] Diagnosis. [short pause] Poor maintenance.';
  return entry.text;
}

export function retryDelayMs(error, attempt) {
  const message = error?.message ?? String(error);
  if (/replicate 429/i.test(message)) {
    const seconds = Number(message.match(/retry_after["']?\s*:\s*(\d+)/i)?.[1]) || 5;
    return Math.max(1000, seconds * 1000);
  }
  if (/replicate 4\d\d/i.test(message)) return null;
  return 1500 * attempt;
}

function encodeOgg(wavPath) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', oggPathFor(wavPath)]);
}

function writeManifest() {
  mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify({
    title: 'War World Mortal Class Cast',
    language: LANGUAGE_CODE,
    total: allClassLines().length,
    cast: CLASS_CAST,
    lines: allClassLines(),
  }, null, 2) + '\n');
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function generateOne(entry, force) {
  const out = join(AUDIO_DIR, entry.slot + '.wav');
  if (!force && existsSync(out)) return { slot: entry.slot, state: 'kept' };
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const safe = attempt === 3 && /sensitive|E005/i.test(lastError?.message ?? '');
      await generateClip({
        text: performanceTextFor(entry),
        prompt: classPrompt(entry.classId, entry, { safe }),
        voice: CLASS_CAST[entry.classId].voice,
        language: LANGUAGE_CODE,
        out,
      });
      encodeOgg(out);
      return { slot: entry.slot, state: 'recorded' };
    } catch (error) {
      lastError = error;
      const delay = retryDelayMs(error, attempt);
      if (attempt >= 3 || delay === null) break;
      console.warn('  retry ' + entry.slot + ' in ' + delay + 'ms: ' + error.message);
      await new Promise((done) => setTimeout(done, delay));
    }
  }
  return { slot: entry.slot, state: 'failed', error: lastError?.message ?? String(lastError) };
}

async function main() {
  const errors = validateClassManifest();
  if (errors.length) {
    errors.forEach((error) => console.error('- ' + error));
    process.exitCode = 1;
    return;
  }
  writeManifest();
  if (process.argv.includes('--check')) {
    console.log('Mortal class manifest valid: ' + allClassLines().length + ' unique directed moments.');
    return;
  }
  if (process.argv.includes('--list')) {
    console.table(allClassLines().map(({ classId, slot, text }) => ({ classId, slot, text })));
    return;
  }
  if (process.argv.includes('--catalog')) {
    for (const [classId, lines] of Object.entries(CLASS_LINES)) {
      console.log('  // ' + classId);
      const slots = lines.filter((entry) => !entry.slot.startsWith('death_')).map((entry) => "'" + entry.slot + "'");
      for (let i = 0; i < slots.length; i += 4) console.log('  ' + slots.slice(i, i + 4).join(', ') + ',');
    }
    return;
  }

  const only = argValue('--only');
  const requestedClass = argValue('--class');
  const force = process.argv.includes('--force');
  const concurrency = Math.max(1, Math.min(5, Number(argValue('--concurrency')) || 3));
  let jobs = allClassLines();
  if (requestedClass) jobs = jobs.filter((entry) => entry.classId === requestedClass);
  if (only) jobs = jobs.filter((entry) => entry.slot === only);
  if (!jobs.length) throw new Error('no mortal class slots matched the requested filter');

  let cursor = 0;
  const results = [];
  async function worker() {
    while (cursor < jobs.length) {
      const entry = jobs[cursor++];
      const result = await generateOne(entry, force);
      results.push(result);
      if (result.state === 'failed') console.error('  x ' + entry.slot + ': ' + result.error);
      else console.log('  ' + (result.state === 'recorded' ? 'ok' : '--') + ' ' + entry.slot);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  const recorded = results.filter((result) => result.state === 'recorded').length;
  const kept = results.filter((result) => result.state === 'kept').length;
  const failed = results.filter((result) => result.state === 'failed').length;
  console.log(recorded + ' recorded, ' + kept + ' kept, ' + failed + ' failed - ' + jobs.length + ' mortal class slots.');
  if (failed) process.exitCode = 1;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) await main();
