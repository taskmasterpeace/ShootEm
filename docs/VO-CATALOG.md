# VO-CATALOG — every moment a character can speak

> Robert: *"Look at every interaction in the game that we will want to have the
> character actually say something — we need to start documenting that, because
> there's gonna come a time where we generate all that dialogue. Right now we
> can do it by classes. In a future version you could choose what country your
> character is from and they talk with that accent — really personalized voices
> via Gemini TTS. But I wouldn't want it to spam — we gotta figure that out
> intelligently."*

This document is that catalog: **every speakable trigger in the game**, who
says it, example lines in-voice, its priority tier, and its cooldown class —
so the whole script can be batch-generated per-voice through the existing TTS
pipeline (`expressive-tts` project skill; `gemini-fast-tts` global skill) the
day we press the button. **Design doc only — nothing here is wired yet except
where §0 and §5 say so.**

---

## 0 · The substrate — what already speaks today

The game already has a working VO system. Everything below EXTENDS it; nothing
replaces it.

| piece | where | what it does |
|---|---|---|
| `VO_LINES` | `src/sim/lsw.ts` (~line 595) | The spoken script: 40 LSW gods × 5 moments (`vo_<id>_<arrive\|kill3\|ability\|low\|death>`), each `{ who, line }`. `line` is the tag-stripped subtitle; the HUD shows it only inside earshot. `voSlot()` / `annSlot()` build slot names. |
| Recording script | `tools/lsw-vo-script.mjs` | The casting sheet + direction: per-character `{ voice, fx, persona, scene }` and per-line director's notes. **This is the format every new speaker copies.** |
| Announcer | `src/client/audio.ts` `SOUND_NAMES` | 160 `ann_<lsw>_<inbound\|landed\|down\|rampage>` slots, voiced (Orus, radio FX), verified clean in `docs/VO-DIRECTORS-NOTES.md`. |
| The `'vo'` SimEvent | `src/sim/types.ts` | `text` = sound slot; `pos` present = positional speech, absent = announcer net. Already emitted from `world.ts` (arrive/low/death/kill3/down/rampage/inbound/landed). |
| The voice bus | `src/client/audio.ts` (`voBus`, `voVoicesToCut`) | VO rides its own bus post-duck (a talking god cuts through the firefight, never ducks itself). **Cap: at most 2 positional god-mouths + 1 announcer**; oldest positional fades (80ms) when a new line needs the slot. `/^vo_/` earshot ≈ 34u; `/^ann_/` range 200 (net-wide). |
| `'announce'` events | `src/sim/world.ts` (many) | Today TEXT-ONLY banners (weather, outbreak levels, streaks, grenade/ammo select, Dr. Voss). Many of these are exactly the moments the announcer should VOICE — §2E maps them. |
| Generation | `tools/gen-lsw-vo.mjs` + `tools/tts-core.mjs` | `google/gemini-3.1-flash-tts` on Replicate. Idempotent (`--only`, `--force`), sci-fi FX pass (radio / beast / ice / haz), output `public/audio/vo_*.wav` → Opus. |
| Verification | `tools/transcribe-vo.mjs` → `tools/redo-off-vo.mjs` | The director's booth: whisper the tape back, diff vs script, regenerate OFF takes. Non-negotiable after every batch. |

---

## 1 · The Speaker Model — who can talk

| speaker | voice source | positional? | FX pass | status |
|---|---|---|---|---|
| **Player** (your own soldier) | class voice (v1 ladder below) | personal — always audible to you, no pan | raw / light breath | NEW |
| **Squadmates** (your fireteam bots, `squadId`) | class voice of each mate | radio if far (>34u), positional if near | `radio` when on comms | NEW |
| **Enemy soldiers** (other team, incl. their bots) | same class voice sets | positional only (34u earshot) | raw | NEW |
| **The Announcer** (the military net) | Orus, already cast | net-wide | `radio` (300–3400Hz bandpass + squelch) | EXISTS — extend |
| **LSW gods** (40) | cast in `tools/lsw-vo-script.mjs` | positional | per-god (beast/ice/haz/raw) | DONE (5 moments) — extend per §2H |
| **Dr. Voss** (safehouse scientist) | new cast entry (suggest: Vindemiatrix — dry, exhausted academic) | positional | raw | NEW |
| **Vehicle crew / pilot** (the hull's own warnings) | player's class voice, strained | personal (driver/crew only) | `radio` + cockpit compression | NEW |
| **The undead & Iron Eaters** | non-verbal vocalizations (shrieks, wet clicks, metal chitter) — the TTS grunt trick ("write the breath, not the words") works for these too | positional | beast-family | PARTIAL (SFX exist) |

Zeds never use words. A sprinter's wake-scream, the bomber's whimper-tick, a
stalker's held breath are VO in the pipeline sense (performed, per-kind,
variant-batched) but live outside the language script.

### The personalization ladder (Robert's roadmap)

| version | what the player hears | how it's made |
|---|---|---|
| **v1 — class voice (NOW)** | All 8 classes have a fixed voice: your Medic sounds like every Medic. | 8 cast entries × the full §2 slot set. One manifest run per class. |
| **v2 — chosen archetype** | At the barracks you pick a voice archetype (~12: Gravel Sergeant, Cool Professional, Wired Rookie, Deadpan Veteran, Southern Warmth, Quiet Menace…). Class no longer dictates voice. | Same manifest, re-rendered once per archetype. 12 × set, generated offline, shipped with the game. |
| **v3 — generated persona** | You choose country / accent / age / attitude ("a Black woman from the South") → a persona string is synthesized → YOUR whole line set is generated for you. | Same manifest again — persona is just the `persona`+`voice` fields. Generated on demand, cached per profile hash. At ~$0.001–0.01/clip a full personal set (~150 slots × 3 variants) costs roughly **$1–4 one-time**. |

The entire ladder is one bet: **the manifest is the product**. Voices are a
render pass over it (§4).

---

## 2 · The Catalog

Legend (full doctrine in §3):
**Tier** — P0 must-play alarm · P1 important · P2 tactical · P3 flavor.
**CD** — cooldown class: `CD0` none (2s identical-slot dedupe) · `A` alarm 6s/slot · `B` bark 10s/speaker/category · `C` callout 15s/speaker/category + 8s team dedupe on same subject · `D` flavor 20s + 30% chance gate · `E` idle 45–90s, combat-silenced.
Example lines are v1-neutral; each class/archetype manifest re-renders them in
its own mouth. `·` separates variants.

### 2A · Combat core (player + squadmates + enemies)

| slot (trigger_) | trigger | speaker | cat | tier | CD | example lines |
|---|---|---|---|---|---|---|
| `kill` | `death` event, you're the killer | player | bark | P3 | D | "Down." · "That's one for the ledger." · "Stay there." |
| `kill_revenge` | kill where victim = your `lastKillerId` | player | bark | P3 | D | "WE'RE EVEN." · "Told you I'd remember." · "Paid in full." |
| `kill_multi` | 2+ kills inside 4s (client counts) | player | bark | P2 | B | "Two! Keep 'em coming!" · "They're just lining up now." |
| `kill_streak` | streak hits 4 / 6 / 9 (`streak` field; text banners exist at world.ts ~4936) | announcer | announcer | P1 | A | "Four confirmed. HR has been informed." · "Nine confirmed. The enemy has filed a formal complaint." |
| `shutdown` | you end an enemy on a ×4+ streak (world.ts ~4923) | announcer | announcer | P1 | A | "Rampage terminated. Carry on." · "The paperwork on that one thanks you." |
| `death` | `death` (has `classId` for the cry) | player | reaction | P1 | CD0 | Non-verbal cry + occasional last words: "Ah— not like—" · "Tell my squad…" |
| `downed` | `downed` event, it's you | player | reaction | P1 | A | "I'M HIT — I'M DOWN!" · "Man down, man down!" · "Can't feel my legs—" |
| `downed_ally` | `downed`, squadmate within 40u | squadmate | callout | P1 | C | "MEDIC! Soldier down!" · "We got a bleeder — cover me!" |
| `reviving` | E-hold revive begins (`reviveProgress` rising) | rescuer | callout | P2 | B | "I got you, stay with me." · "Hands on — don't you quit." |
| `revived` | `revived` event | the revived | reaction | P2 | B | "…I owe you one." · "Back up. Gun still works." |
| `taking_fire` | ≥3 `hit`/near-miss on you in 2s (needs `suppressed`, §5) | player | reaction | P2 | B | "Taking fire!" · "They see me, they SEE me!" · "Contact — I'm pinned!" |
| `suppressed` | suppression state held >3s | player | reaction | P2 | B | "PINNED DOWN — need an angle!" · "Somebody shoot back, please!" |
| `reload` | `reload` event, clip was not empty | player | bark | P3 | D | "Reloading." · "Swapping mags." |
| `reload_dry` | `reload` with clip = 0 (needs dry flag, §5) | player | bark | P2 | B | "DRY — cover me!" · "Empty! Buying time!" |
| `ammo_low` | reserve < 1 clip (client-derived) | player | bark | P2 | B | "Running light on ammo." · "Down to my last mag." |
| `grenade_out` | own grenade thrown (needs event, §5) | player | callout | P2 | B | "FRAG OUT!" · "Cooking one — heads down!" · smoke: "Smoke going in." |
| `grenade_in` | enemy grenade lands <8u (`nade_bounce` has pos) | player/squad | callout | P1 | A | "GRENADE! MOVE!" · "Frag at your feet — GO!" |
| `heal_given` | `heal` event, you're the medic | medic | bark | P3 | D | "Patched. Try to keep it." · "Good as new. Ish." |
| `heal_received` | `heal`, you're the patient | player | bark | P3 | D | "Better. Thanks, doc." · "Okay. Okay. Back in it." |
| `pickup` | `pickup` event | player | bark | P3 | D | "Grabbing supplies." · flamer: "Oh, this'll do." |
| `last_stand` | `lastStandSaid` latch (exists on Soldier) | player | reaction | P1 | A | "Last one standing… fine. FINE." · "All on me? All on me." |
| `deploy` | your respawn/wave-in | player | flavor | P3 | E | "Back on the clock." · "Round two." · "Squad, on me." |

### 2B · The Outbreak ladder (personal horror — most of it is YOUR mouth)

| slot | trigger | speaker | cat | tier | CD | example lines |
|---|---|---|---|---|---|---|
| `infect_exposed` | `viralLoad` crosses 1 (client-derived from snapshot) | player | reaction | P2 | B | "Something got through the suit…" · "I'm marked. Watch me." |
| `infect_rising` | `viralLoad` crosses 40 (the corpse-booking line) | player | reaction | P1 | A | "It's IN me. It's climbing." · "If I turn — you know what to do." |
| `infect_critical` | `viralLoad` ≥ 75 | player | reaction | P0 | CD0 | "I can hear it… I can HEAR it—" · "Not much of me left in here. Hurry." |
| `bitten` | `grabbed` by a zed / bite struggle start | player | reaction | P0 | CD0 | "IT'S GOT ME — GET IT OFF!" · "TEETH! TEETH!" |
| `bite_break_win` | `grab_break`, you escaped | player | reaction | P1 | A | "Off! OFF! I'm clear!" · "Not today. NOT today." |
| `bite_break_loss` | grab hold expires on you (the bite lands) | player | reaction | P0 | CD0 | wet scream · "no no NO—" |
| `ally_turned` | announce `<NAME> HAS TURNED` (world.ts ~4549) | announcer + squadmate | announcer/reaction | P1 | A | ann: "We lost Alvarez. Weapons free on what's left." · squad: "That's… that WAS Alvarez. Put him down." |
| `corpse_critical` | `corpse_critical` event near you (<20u) | squadmate | callout | P1 | A | "That body's about to get back up — BURN IT!" · "Corpse is twitching — deny it NOW!" |
| `reanimated` | `reanimated` event near you | squadmate | reaction | P1 | A | "It's UP! The dead one's UP!" · "They don't stay down anymore!" |
| `nest_found` | `contamination` event / first sight of a nest | squadmate | callout | P1 | A | "The pile's… moving. That's a nest." · "Contamination site — nobody touch ANYTHING." |
| `outbreak_level` | announce `OUTBREAK LEVEL n` escalation (world.ts ~4596) | announcer | announcer | P1 | A | "Outbreak level two. Confirmed outbreak. Ammunition is now a medical instrument." · "Containment failure. The sector is negotiable." |
| `sprinter_wake` | `sprinter_wake` event | squadmate | callout | P0 | CD0 | "SPRINTER'S AWAKE — RUN OR SHOOT, PICK ONE!" |
| `corpse_burn` | incendiary denies a corpse (client-derived) | player | bark | P3 | D | "Stay dead this time." · "Cremation's free today." |

### 2C · Enemy spotted (per unit type)

All `spotted_*` need the `enemy_spotted` event (§5) or a client acquire-diff.
Speaker: whoever sees it first (player or squadmate). Category: callout. The
per-kind line IS the information — the words are the minimap.

| slot | target | tier | CD | example lines |
|---|---|---|---|---|
| `spotted_infantry` | enemy soldier(s) | P2 | C | "Contact — two o'clock!" · "Hostiles, moving in pairs." |
| `spotted_sniper` | infiltrator/cloak shimmer | P2 | C | "Cloak shimmer — ghost in the grass!" · "Sniper glint. Nobody stand still." |
| `spotted_dog` | K9 | P2 | C | "Dog! They brought a DOG!" · "War-hound loose — watch your flanks." |
| `spotted_tank` | tank / apc | P1 | C | "ARMOR! Battle tank on the lane!" · "APC rolling — it's a clown car of trouble." |
| `spotted_mech` | mech | P1 | C | "WALKER! Big stompy problem, front and center!" |
| `spotted_air` | any aircraft band ≥1 | P1 | C | "Air contact! Eyes UP!" · "Fast mover inbound — find a roof to hate." |
| `spotted_bomber_ac` | the Anvil | P0 | A | "BOMBER ON APPROACH — SCATTER!" |
| `spotted_god` | any LSW (backs the ann_ landed call, from a mortal mouth) | P1 | C | "That's a GOD — that is a whole GOD!" · "Ascendant on the field. We are the small print now." |
| `spotted_zombie` | walker(s) | P2 | C | "Shamblers, dead ahead. Literally." |
| `spotted_spitter` | spitter | P2 | C | "Spitter! Watch the arcs!" · "Acid-thrower — hug cover." |
| `spotted_brute` | brute | P1 | C | "BRUTE! Doors mean nothing to it!" |
| `spotted_sprinter` | dormant sprinter (not yet awake) | P1 | C | "Sleeper. Nobody. Makes. A sound." (whispered) |
| `spotted_bomber_z` | bomber zed | P1 | C | "Ticker! Shoot it FAR AWAY from me!" |
| `spotted_stalker` | stalker blink | P1 | C | "Stalker — it BLINKED. It's choosing." |
| `spotted_iron` | any Iron Eater | P2 | C | "Scrap's crawling again — Iron Eaters!" · "It's eating the TANK. It's EATING the tank." |

### 2D · Vehicles & the air war

| slot | trigger | speaker | cat | tier | CD | example lines |
|---|---|---|---|---|---|---|
| `veh_enter` | `vehicle_enter` (yours) | player | bark | P3 | D | "Mounting up." · "Shotgun's mine. Always was." |
| `veh_exit` | `vehicle_exit` | player | bark | P3 | D | "Boots down." |
| `veh_damaged` | hull <50% (client-derived) | crew | reaction | P2 | B | "We're taking hits — she's holding!" · "Paint's coming off THE HARD WAY." |
| `veh_system` | `system_damaged` (has `system`) | crew | callout | P2 | B | engine: "Engine's hit — we're a pillbox now!" · sensors: "Sensors dark. Driving by rumor." · weapon: "Gun's jammed!" |
| `veh_critical` | hull <20% | crew | reaction | P1 | A | "She's coming apart — decide NOW!" |
| `veh_bail` | exit while burning/moving (client-derived) | crew | reaction | P1 | A | "BAIL OUT! BAIL OUT!" · "Leave the tank, KEEP the lungs!" |
| `veh_destroyed_ours` | `vehicle_destroyed` (your team's, with cost) | announcer | announcer | P2 | B | "Command wrote off the Ares. Command is displeased." (already an announce banner, world.ts ~3686) |
| `veh_stolen` | hotwire completes (announce exists ~3713) | announcer | announcer | P2 | B | "Our buggy has defected. Recover or embarrass it." |
| `missile_lock` | homing missile tracking YOUR hull (needs event, §5) | cockpit | alarm | P0 | CD0 | "LOCK — MISSILE LOCK!" · "TONE! Break, break!" |
| `sam_launch` | `sam_launch` event, any pilot in earshot | cockpit | alarm | P0 | CD0 | "SAM in the air! SAM in the air!" |
| `flares` | flare pop (client-derived from gadget spawn) | pilot | bark | P2 | B | "Flares out — chase the sparkles." · "Sold it a decoy." |
| `band_up` / `band_down` | aircraft band change (Q/E) | pilot | bark | P3 | D | "Climbing." · "Taking her down on the deck." |
| `afterburner` | `burnerOn` first tick (renderer already detects; sonic-boom ring exists, renderer.ts ~1799) | pilot | bark | P3 | D | "Punch it — BURNING!" · after the boom: "You hear that? That was me." |
| `bomb_away` | `bomb_away` event | bombardier | callout | P1 | A | "Bombs gone. Iron on the way down." |
| `nuke_armed` | `nuke_armed` event | announcer | alarm | P0 | CD0 | "THE CRADLE IS ARMED. THE CRADLE IS ARMED. This is not a drill, and there is nowhere sensible to stand." |
| `pod_incoming` | `pod_incoming` | announcer | announcer | P2 | B | "Supply pod on the wire. Try to deserve it." |
| `lsw_drop` | officer LSW drop call (`ann_*_inbound` EXISTS) | announcer | announcer | P0 | CD0 | (already voiced — 40 gods) |

### 2E · Objectives, modes, and the announcer's desk

The announcer's personality is already set by the LSW pack + the text banners:
military-net deadpan with bureaucratic menace. Extend it, don't reinvent it.

| slot | trigger | tier | CD | example lines |
|---|---|---|---|---|
| `match_start` | first tick of a match (needs event or client hook, §5) | P1 | CD0 | tdm: "Weapons free. Fifty confirms buys you the afternoon off." · ctf: "Their flag would look better here. Go get it." |
| `match_over` | `match_over` | P0 | CD0 | win: "Objective complete. Drinks are hypothetical but earned." · loss: "Sector lost. The debrief will be… thorough." |
| `flag_taken` | `flag_taken` (ours/theirs variants) | P1 | A | "They have OUR flag. This is now personal property theft." · "We have their colors. RUN." |
| `flag_dropped` | `flag_dropped` | P2 | B | "Flag is on the ground. Flags do not belong on the ground." |
| `flag_returned` | `flag_returned` | P2 | B | "Colors recovered. Dignity partially restored." |
| `flag_captured` | `flag_captured` | P1 | CD0 | "CAPTURE CONFIRMED. Somebody chalk it." |
| `flag_carrier_self` | you picked it up | P1 | A | player: "I've got the flag — I am VERY popular now!" |
| `point_contested` | koth/conquest point flips to contested (needs event, §5) | P2 | B | "The hill is contested. The hill does not care who wins." |
| `point_captured` | `point_captured` | P1 | A | "Point secured. Hold it like rent is due." |
| `tickets_low` | conquest tickets < 20% | P1 | A | "We are running out of people. Consider not dying." |
| `wave_start` | `wave_start` (has wave #) | P1 | A | "Wave six. They are not getting more polite." · milestone 10: "Wave ten. Whatever you're doing — it's working. Statistically." |
| `whistle` | `whistle` (paintball rounds) | P1 | CD0 | "Round start! Paint, pride, no bleeding." · "Round over. Wash off the shame." |
| `underdog` | `underdog` set at match end | P2 | CD0 | "Won it underfunded. Accounting weeps with joy." |
| `weather` | weather front change (announce EXISTS, text-only — weather.ts ~88) | P2 | B | voice the existing lines: "WEATHER: FOG — trust your ears." · "NIGHTFALL — muzzle flashes glow. So do mistakes." |

### 2F · Squad comms (squads exist — orders are coming)

`squadId` is live (world.ts ~531); a player ORDER system isn't. These slots
are specced now so the order feature ships speaking. Radio FX when >34u.

| slot | trigger | speaker | tier | CD | example lines |
|---|---|---|---|---|---|
| `order_move` | player issues MOVE ping | player | P2 | B | "Squad — move on my mark!" · "Push there. Now." |
| `order_hold` | HOLD ping | player | P2 | B | "Hold this line. Grow roots." |
| `order_help` | HELP ping | player | P1 | A | "Squad, on ME — need bodies!" |
| `ack_move` | mate accepts move | squadmate | P3 | D | "Moving." · "On it." · "Copy, relocating." |
| `ack_hold` | mate accepts hold | squadmate | P3 | D | "Holding here." · "Roots. Got it." |
| `ack_help` | mate responds to help | squadmate | P2 | B | "Coming to you!" · "Hang ON, we're moving!" |
| `medic_call` | player calls for medic (needs binding + event, §5) | player | P1 | A | "MEDIC! Need a medic HERE!" |
| `medic_ack` | medic squadmate responds | squadmate | P2 | B | "Doc's coming — keep breathing!" |
| `ammo_call` | player calls for ammo | player | P2 | B | "Anyone got spare mags?" |
| `squad_wipe` | last mate down | player | P1 | A | "Squad's gone… squad's gone. Just me." |

### 2G · Melee, guard, grapple

| slot | trigger | speaker | cat | tier | CD | example lines |
|---|---|---|---|---|---|---|
| `melee_strike` | swing commit (`melee_windup`→strike) | attacker | bark | P3 | D | effort grunts: "HRAH!" · "Get—OFF!" |
| `melee_charged` | charged Power Strike release (`meleeCharge` ≥1) | attacker | bark | P2 | B | "TIMBER!" · a roar with intent |
| `melee_block` | `melee_block` — your GUARD caught it | defender | bark | P2 | B | "Not through ME." · "Blocked it — my turn." |
| `melee_parried` | your strike got parried | attacker | reaction | P2 | B | "Wall. That man is a WALL." |
| `grapple_land` | `grabbed` — you threw the hold | attacker | bark | P2 | B | "GOT you." · "Nowhere to be, friend?" |
| `grapple_held` | `grabbed` — you're pinned (by a human, not a zed) | victim | reaction | P1 | A | "Let — GO!" · "Grip like a tax office—" |
| `grapple_escape` | `grab_break` — you broke free | victim | reaction | P2 | B | "OFF me! Free!" |
| `axe_throw` / `axe_recall` | `axe_throw` / `axe_recall` events | thrower | bark | P3 | D | "Fetch." · recall: "Come home." |
| `encased` | `encased` — frozen alive | victim | reaction | P1 | A | (muffled, through ice) "COLD cold cold—" · squadmate: "Shoot the ICE, not the friend!" |

### 2H · LSW gods (extension of the DONE set)

The 40 gods have `arrive / kill3 / ability / low / death` + the 4 announcer
moments. Next moments worth writing, same casting sheet:

| new moment | trigger | tier | CD | example (Firebrand) |
|---|---|---|---|---|
| `vo_<id>_duel` | two LSWs within 20u of each other (client-derived) | P1 | A | "Another god? Good. I was getting bored of mortals." |
| `vo_<id>_kill_god` | an LSW kills an LSW | P1 | CD0 | "Turns out gods burn SLOWER. Not never." |
| `vo_<id>_idle` | 20s without a fight, someone in earshot | P3 | E | "Anyone else smell smoke? …That's me." |
| `vo_<id>_taunt` | killed the same soldier twice this match | P3 | D | "You again! I'll leave the light on." |

### 2I · Dr. Voss (safehouse) — the escort with opinions

Follow/hold announces exist as text (world.ts ~5124). Voice them and grow the set.

| slot | trigger | tier | CD | example lines |
|---|---|---|---|---|
| `voss_follow` | told to follow | P2 | B | "Fine. But if I die, the research dies, and THEN who's laughing?" |
| `voss_hold` | told to hold | P2 | B | "Holding position. Like a very educated sandbag." |
| `voss_danger` | zed within 12u of Voss | P1 | A | "IT'S NEAR ME. THE THING IS NEAR ME." |
| `voss_hurt` | Voss takes damage | P1 | A | "I am a DOCTOR, not a — ow — TARGET!" |
| `voss_safe` | reaching the safehouse | P1 | CD0 | "Inside! Lock it! …Thank you. All of you. Now never again." |
| `voss_lecture` | idle near players | P3 | E | "Fascinating — the reanimation latency drops with ambient heat. You're all in terrible danger, by the way." |

### 2J · Ambient & idle chatter (the P3 carpet)

| slot | trigger | speaker | tier | CD | example lines |
|---|---|---|---|---|---|
| `idle_squad` | 30s+ no combat, mates within 10u | squadmate | P3 | E | "Quiet. Don't say it's quiet. Nobody say it." · "Anybody actually READ the enlistment form?" |
| `idle_weather` | rain/snow/dust ongoing | player | P3 | E | rain: "My socks have surrendered." · snow: "Triton. Of all the moons, Triton." |
| `idle_night` | night weather | player | P3 | E | (low) "Muzzle flash gives you away out here. Learned that the loud way." |
| `walk_corpses` | passing 3+ corpses | player | P3 | E | "…Lot of bodies here. Keep your eyes on them." |
| `door_open` | `door` (yours) | player | P3 | E | "Going in — check your corners." |
| `door_breach` | `doorbreak` near you | squadmate | P2 | B | "DOOR'S DOWN — they're coming through!" |
| `wall_breach` | `wallbreak` near you | squadmate | P2 | B | "They made a NEW door!" |

---

## 3 · The Anti-Spam Doctrine (the intelligence Robert asked for)

The failure mode is known: LSW voices used to stack "a dozen gods talking at
once" until the voice bus + cap fixed it. That law scales up as follows.

### 3.1 Priority tiers

| tier | meaning | examples | rule |
|---|---|---|---|
| **P0** | must-play, safety-of-life | missile lock, nuke armed, sprinter wake, being bitten, match over | Always plays. Interrupts ANYTHING (80ms fade, the existing `fadeCutVo`). Never chance-gated. |
| **P1** | important — you'd be mad you missed it | downed, flag events, ally turned, wave start, LSW inbound | Plays unless a P0 is live; may interrupt P2/P3. Queues ≤2s, then drops. |
| **P2** | tactical texture | spotted, reload dry, taking fire, squad acks | Never interrupts anyone. Plays only into a free lane. Queues ≤1s, then drops silently. |
| **P3** | flavor | kill quips, idle chatter, enter/exit barks | Plays only into SILENCE on its lane, and only past its chance gate. Dropped, never queued. |

**The one law: important interrupts flavor, never vice versa.** Equal-priority
positional lines keep today's rule — newest wins, oldest fades.

### 3.2 The voice bus, extended (`voVoicesToCut` v2)

Today: at most **2 positional + 1 announcer**. Extended cap — **4 lanes**:

| lane | count | who rides it |
|---|---|---|
| announcer | 1 | `ann_*` — never talks over itself |
| personal | 1 | YOUR mouth + your cockpit alarms (no pan, always audible) |
| positional | 2 | everyone else within earshot — gods, enemies, squadmates on-site |
| radio | 1 | squad comms from beyond earshot (radio FX) |

Same pure-function shape as `voVoicesToCut` (testable without an
AudioContext): given live voices + incoming lane + tier, return who yields.
A speaker also never overlaps THEMSELF — a new line from the same soldier cuts
its own previous line first (one mouth per body).

### 3.3 Cooldown classes (the numbers)

| class | per-slot | per-speaker/category | team dedupe | chance gate |
|---|---|---|---|---|
| CD0 (P0) | 2s identical slot | — | — | 100% |
| A (alarm) | 6s | — | 6s same subject | 100% |
| B (bark) | — | 10s | — | 100% |
| C (callout) | — | 15s | 8s same subject (one "TANK!" per tank, not five) | 100% |
| D (flavor) | — | 20s | — | **30%** — silence is a feature |
| E (idle) | — | 45–90s (rolled) | — | 50%, combat-silences instantly |

**Dedupe windows**: identical slot never repeats within 10s (P0: 2s). The
announcer never repeats the same slot within 60s, keeps a queue of depth 2,
drops anything staler than 4s ("Flag taken" 8s late is worse than silence).

### 3.4 Radius rules

| scope | reach | pan | FX |
|---|---|---|---|
| personal | local player only | none | raw |
| positional | ~34u earshot (existing `/^vo_/` class) | stereo pan + distance | speaker's own |
| radio | net/squad-wide | none | `radio` bandpass |
| announcer | match-wide (existing `/^ann_/`, range 200) | none | `radio` |

Subtitles follow audio scope exactly (the existing VO_LINES contract: you read
what you could hear).

### 3.5 The global budget

| meter | target | hard cap | governor |
|---|---|---|---|
| lines heard per minute (any one player) | ≤ 10 | 14 | over target: P2 cooldowns ×2; at cap: P3 muted entirely |
| announcer lines per minute | 2–3 | 5 | over: only P0/P1 announcer slots play |
| your own mouth per minute | ≤ 6 | 8 | over: P3 self-barks muted |

Measured client-side with a rolling 60s window — cheap, and it makes "does it
spam?" a number a test can assert.

---

## 4 · The Generation Pipeline Spec

### 4.1 Slot & file naming

- **Slot id** (the `SOUND_NAMES` key, the thing a SimEvent carries):
  `vo_<speaker>_<trigger>_<variant>` — e.g. `vo_pc_medic_kill_2`,
  `vo_ann_flag_taken_1`, `vo_voss_danger_3`.
- **File path**: `public/audio/vo/<speaker>/<trigger>_<variant>.ogg`
  (slot id = path with `/`→`_`, minus extension). Speakers: `pc_<classId>`
  (v1) / `arch_<archetype>` (v2) / `p_<profileHash>` (v3), `ann`, `voss`,
  `lsw_<ascendantId>`.
- The **existing 160** flat `vo_<lsw>_<moment>` / `ann_<lsw>_<moment>` slots
  are grandfathered — never rename shipped audio.
- Variant selection at play time: shuffle-bag per slot (no immediate repeats).

### 4.2 The manifest (the product)

`tools/vo-manifest.mjs`, same shape as `tools/lsw-vo-script.mjs` (which stays
the LSW section of it):

```js
export const CAST = {
  pc_medic: {
    voice: 'Leda', fx: 'none',
    persona: 'A United Front field medic — mid-30s, warm but worn down, jokes to keep hands steady.',
    scene: 'A firefight. Someone is always yelling for her.',
  },
  ann: { /* Orus — exists */ },
  // v3 personas are GENERATED into this same shape from the player profile.
};

export const SLOTS = {
  kill:        { tier: 3, cd: 'D', variants: 4, note: 'Quiet satisfaction, never gloating. She still counts them.' },
  downed:      { tier: 1, cd: 'A', variants: 3, note: 'Real pain, real fear, still fighting the panic. [strained]' },
  bitten:      { tier: 0, cd: 'CD0', variants: 2, note: 'Pure animal terror. The teeth are IN. No composure survives.' },
  // …every §2 row. text lives per speaker: SCRIPT[speaker][slot] = ['line', …]
};
```

The subtitle law extends VO_LINES: one generated table maps every slot id →
tag-stripped display text, shared by sim and client, so subtitles can never
drift from tape.

### 4.3 Variant counts

| tier | variants | why |
|---|---|---|
| P0 | 2 | alarms must be instantly recognizable — consistency IS the feature |
| P1 | 3 | important but heard often |
| P2 | 3–4 | tactical texture, repetition kills it |
| P3 | 4–5 | flavor lives or dies on variety |

### 4.4 Director's notes per category (the craft, from expressive-tts)

| category | the note that makes it work |
|---|---|
| bark (P3 combat) | "Mid-firefight, breath short, words cost air. Clipped. No performance for the cheap seats." |
| callout (P2) | "Information first — a soldier REPORTING, loud enough to carry, scared enough to be fast." |
| reaction (downed/bitten) | "State, not adjectives: she is shot and knows it / the teeth are in and composure is gone. [strained], [short pause]." |
| alarm (P0) | "Zero irony. This is checklist voice at combat volume. Every syllable trained." |
| announcer | "Military net deadpan with bureaucratic menace. He has seen everything and files it all." |
| idle (P3) | "Low, conversational, off-duty mouth on an on-duty body. The joke is for one other person." |
| zed vocal | "Write the breath, not words: wet, wrong, hungry. Grunt-takes with hard direction." |

### 4.5 Generation & verification loop (names, don't run)

1. `node tools/gen-vo.mjs --speaker pc_medic` (the gen-lsw-vo pattern:
   idempotent, `--only`, `--force`, FX pass per cast entry).
2. `node tools/transcribe-vo.mjs --speaker pc_medic` — whisper the tape back,
   diff vs manifest (the model DOES read direction aloud on some takes —
   measured 55/160 once; the prompt wall in `tts-core.mjs buildPrompt()` fixed
   it, keep it).
3. `node tools/redo-off-vo.mjs` — regenerate OFF takes; re-transcribe to ~0.
4. `node tools/encode-audio.mjs` — Opus for ship.

### 4.6 The regeneration story (why the manifest wins)

- **Recast a speaker**: change one `voice`/`persona` field, rerun step 1–3 for
  that speaker. Nothing else moves.
- **v2 archetypes**: 12 × the same SLOTS/SCRIPT, batch overnight.
- **v3 personal voice**: synthesize a persona string from the player's picks
  (country, accent, age, attitude), run the same manifest under
  `p_<profileHash>`, cache. ~150 slots × 3 variants × ~$0.005 ≈ **$1–4 per
  player, once** — and `gemini-fast-tts` (the global skill) is the fallback
  fast path for cheap bulk takes.
- **Fix one line**: edit its text/note, `--only vo_pc_medic_downed_2 --force`.

---

## 5 · Wiring Notes — hooks that exist vs events to emit

**DO NOT add these now** — this is the shopping list for the wiring pass.

### 5.1 Already emitted — attach VO directly

`vo` (LSW moments, world.ts 744/780/807/4851/4877/4945), `downed`, `revived`,
`death` (carries `classId`), `heal`, `pickup`, `reload`, `grabbed`,
`grab_break`, `melee_block`, `melee_windup`, `sprinter_wake`,
`corpse_critical`, `contamination`, `reanimated`, `encased`, `sam_launch`,
`nuke_armed`, `bomb_away`, `pod_incoming`/`pod_landed`, `door`/`doorhit`/
`doorbreak`/`wallbreak`, `vehicle_enter`/`vehicle_exit`/`vehicle_destroyed`,
`system_damaged` (has `system`), `flag_taken`/`flag_dropped`/`flag_returned`/
`flag_captured`, `point_captured`, `wave_start`, `whistle`, `match_over`,
`nade_bounce` (enemy-grenade proximity), `axe_throw`/`axe_stick`/`axe_recall`.

Text-only `announce` banners that should ALSO speak (same trigger sites):
outbreak levels (~4596), `HAS TURNED` (~4549), streak lines (~4936), SHUTDOWN
(~4923), weather (~1570), vehicle write-off (~3686), hotwire theft (~3713),
Voss follow/hold (~5124).

### 5.2 Client-derivable — no new event needed (diff the snapshot)

`viralLoad` thresholds (1/40/75 crossings, local player), `streak`/
`lastKillerId` (revenge + multikill), hull hp % and bail (exit while
burning/moving), `burnerOn` rising edge + speed (afterburner/sonic boom — the
renderer already detects it, renderer.ts ~1799), `band` changes, flare gadget
spawn, LSW-near-LSW (duel), corpse-count-near-player (walk_corpses), squad
wipe (mates all downed), tickets-low, match start (first snapshot).

### 5.3 Genuinely missing — new SimEvents to emit (the wiring backlog)

| proposed event | fired by | feeds |
|---|---|---|
| `suppressed` | N near-misses/hits on one soldier inside 2s (sim counts; client can't see misses reliably) | `taking_fire`, `suppressed` |
| `reload` dry flag | `reload` gains `dry?: boolean` (clip was 0) | `reload_dry` |
| `grenade_out` | on throw, with `team` + `ownerId` (nade_bounce is too late for the thrower's own call) | `grenade_out` |
| `enemy_spotted` | first hostile acquire per target per 8s (`botAcqId` exists for bots; humans need a reticle/ping hook), carries target kind | all of §2C |
| `missile_lock` | homing missile selects `homingVehicleId` → tell THAT hull's crew | `missile_lock` (P0) |
| `point_contested` | koth/conquest meter enters contested | `point_contested` |
| `match_start` | mode init after countdown | `match_start` |
| `medic_call` / `squad_order` | new player comms keys (the squad-order feature itself) | all of §2F |

### 5.4 Client work implied (not events)

Extend `voVoicesToCut` to the 4-lane/tier model (§3.2) with its own pure-law
test beside the existing one; add the shuffle-bag variant picker; add the
rolling lines-per-minute governor; extend the subtitle table from `VO_LINES`
to the generated all-speaker script.

---

*Catalog totals: ~120 base slots × variants ≈ 380–450 clips per voice; 8
class voices ≈ ~3,400 clips for v1 — a weekend of batch generation and one
transcribe-verify loop, at roughly $15–35 per full voice set.*
