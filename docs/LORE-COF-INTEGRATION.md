# LORE ↔ COF INTEGRATION — the master document
### War World is a story set in the Consequences of Failure universe. This maps the marriage.
### Mined from D:/git/COF 2026-07-22 (Robert's direction: "aliens in 8 years; the nations are tearing themselves apart").

> **The frame, in one line:** *aliens are coming to Earth in 8 years — and the
> nations are spending those years tearing each other apart.* That is COF's
> locked premise (`COF/bible/PREMISE.md`), and it is already War World's
> LORE.md year-2222 doom clock. Same tragedy, same silence: nobody in-world
> says "doom clock," every broadcast plays under one.
>
> **The COF Golden Rule applies here too** (`COF/CLAUDE.md`): creator
> originals + Robert's word beat everything; conflicts get **flagged, never
> silently resolved**; anything invented below is marked `[PROPOSED]` until
> Robert blesses it.

---

## 1. THE COF CANON MAP — what is actually written

### 1.1 The premise (locked)
Source: `COF/bible/PREMISE.md`, `COF/bible/CANON_STATUS.md`.
- **The Greys** (allies, NOT invaders) select ~**1,000 people worldwide, of
  sound mind**, and return them transformed into **Living Super Weapons
  (LSWs)** — they don't GIVE weapons, they **turn people INTO weapons** — to
  prepare Earth for the invasion. Humanity weaponizes them against each other
  instead. The Greys misjudged us.
- **There are no supervillains.** Selection (via the data-lifeform **"Its
  Voice"** — every camera its eyes, every mic its ears) picks only people who
  will *protect rather than prey*. The antagonist is human nature and the
  systems people build.
- **The grudge** (`COF/bible/factions/THE_ALLIANCE_OF_FOUR.md`,
  `COF/canon/aliens/RADIO_WAVE_INCIDENT.md`, `Zuma Rock.txt`): Earth's radio
  waves — carried across space by the Greys' own travel — annihilated an
  energy-based species (**the Auralith**, the galaxy's translators; "the
  Silent Requiem"). The Greys covered up their role; the galaxy pinned it on
  Earth ("chronic polluters — now they pollute across space"). The **Concord
  of Living Continuance** ("Conclave of the Stars") ruled against us; the
  war party became the Alliance.
- **Zuma Rock, Nigeria** = the Greys' hidden gateway base
  (`COF/canon/aliens/Zuma Rock.txt`).

### 1.2 The invaders — three tiers, in canon order
- **THE PRECURSOR — the Iron Eaters** (`COF/Alien Type_ Iron Eaters.txt`,
  `COF/canon/aliens/Iron_Eaters.txt`): self-evolving metal-eating nanites of
  a long-dead race, planted as **"dust" on the Greys' own ship**, delivered
  by a **crashing satellite** (South America, ~Year 4 — a Year-3 telling is
  flagged, unruled). They are the Strategist doctrine made real: *weaken
  Earth first, then set up shop.* Canon breeds: **Selectives** (specialist
  metal-hunters — will level a city for the right alloy), **Berserkers**
  (eat everything, deadliest to civilians), **Stealth** (mimic fridges,
  power tools, cars — "an incredibly dangerous Honda Civic"). They travel
  alone or in packs of 3–5, rarely more than 7. Deck 52 captures and
  weaponizes them into **RoboForge v2**. **They are NOT one of the Four.**
  → *Already in-game* (`docs/LORE.md`, `IronKind` roster: scraprat /
  junkhound / weaver / ravager) — the game's molt-and-scrap bestiary is the
  licensed expression of this file.
- **THE ALLIANCE OF FOUR** (`COF/bible/factions/THE_ALLIANCE_OF_FOUR.md`,
  re-cut 2026-06-29): the armada that arrives at the END of the 8 years.
  Current roster: **the Xanthi** (Doorwalkers — dimensional infiltrators;
  the Lock/anchor rule; the Mark, a "mind virus" that makes anyone they've
  been near a permanent doorway) · **the Slaught**
  (`COF/canon/aliens/Alien Type_ The Slaught.txt` — insectoid swarms:
  drones / overlings / Queens / Queenlings, paralytic venom, cross-a-room-
  in-a-second speed, win by numbers) · **the Mountain-Eaters** (living siege
  continents — ⚠️ OPEN: Robert twice flagged "too slow to threaten Earth";
  solve or swap) · **the Ash-Weather** `[PROPOSED]` (atmosphere-rebuilders —
  the phased invasion is a *biological necessity*: most of the Alliance
  can't breathe Earth as-is).
  **DUMPED from the Four:** The Deep and the Strategist Race ("too
  generic") — The Deep's file (`Alien Type_ The Deep.txt`) survives as a
  parked species bank, not an invader slot.
- **THE DEAD DRAFT (never use):** "6 alien races coming to extract Earth's
  oxygen" (`COF/canon/countries/COUNTRIES, SEASONS & AI.txt`) — explicitly
  abandoned per `PREMISE.md` §CANON vs ABANDONED. Also noise: Max/Jessica/
  Tom, "the Paragon," the White Witch, Sarah Lee, Zachary Taylor, Lily.

### 1.3 The timeline (8 seasons ≈ 10 years)
Source: `COF/canon/COF_TIMELINE_CORRECTED.md` (creator session).
| Year | The big thing |
|---|---|
| 1 | **THE WARNING** — Rusty Richards returns from space: the Alliance arrives in 8 years. LSWs assemble; nations organize programs. |
| 2 | **THE SAGES** — knowledge-LSWs revealed (complete knowledge of ONE college course — the course source is a late reveal). |
| 3 | **THE JACKALS** — bounty hunters harvesting LSW blood/fluids; the black market explodes; LSWs go into hiding; paranoia. |
| 4 | **IRON EATERS ARRIVE EARLY** — the satellite crash; the precursor wave; infrastructure starts vanishing. |
| 5 | **THE IRON EATER WAR** — a year-long apocalyptic war; desperate, unprecedented cooperation turns the tide. |
| 6 | **GOVERNMENT CONTROL** — states seize their LSWs; China's program turns oppressive; Chinese LSWs plot to steal a spacecraft and found a moon colony. |
| 7–8 | **THE ARRIVAL** — the Alliance of Four lands. Nanovirus outbreak (Iron Eaters near **Muo spheres** → Muos die → black powder → **brain-eating nanovirus**). Kaiser assassinated; Spain attacks Turkey. |
| 9–10 | **THE END** — deliberately unresolved. |

### 1.4 The factions of record (never invent locally — standing law)
Source: `COF/bible/CHARACTER_ROSTER.md`, `COF/bible/factions/*`.
- **Nation-states** — the geopolitical spine is the **Country Master Sheet**
  (`COF/canon/countries/Country Master Sheet - Country.csv`, 170+ countries,
  quantified: LSWActivity, cloning, corruption, presidents). **Canonical** —
  and already War World's enlistment data (`src/data/nations.ts`,
  regenerated by `tools/gen-nations.mjs`; faction DERIVED from doctrine
  stats, never transcribed).
- **Deck 52** (Charles Sapphire) — card-deck PMC; captured Iron Eaters →
  **RoboForge** (prompt-a-robot, metal-fueled).
- **FIST** (Vaughn Galloway, cmdr Todd "Shogun" Benchley) — the US-only
  fallback after the UN **rejects SPEAR. SPEAR is never created.**
- **Establishment 24** (India — Col. Raghavan Reddy, Major Gupta, Asha).
- **The Jackals** (first Jackal: **Sandra**, a Black woman; her ring is a
  node of **Its Voice**) — LSW blood-hunters.
- **Hand of Uganda** (Mr. Paul, Moses Apio; govt LSW bodyguards **Abeo /
  Jelani / Kamaria**) · **Cuatro Dedos** cartel (Mexico) · **I Deserve
  Better** (the AI-directed justice movement) · **The Shooter's Club** (two
  unrelated: the corrupt LAPD unit AND Pole Zimmerman's biker gang) ·
  **Akrahuhum** (the terror group) · **The Otherworld** (the powerless
  mirror world LSWs flee to) `[in dev]`.
- **The treaty:** the **Living Super Weapon Threshold Treaty** — bars LSWs
  crossing borders into foreign conflicts; bars *governments* from wielding
  LSWs directly (companies are the workaround). Constantly violated —
  **which is exactly the war War World depicts.**

### 1.5 How War World sits inside this `[PROPOSED — the reconciliation]`
War World's two factions — **the United Front** (combined-arms doctrine)
and **the Collective** (machine doctrine) — are **treaty-era COALITIONS**:
blocs of Country-Master-Sheet nations grouped by doctrine (already how
`gen-nations.mjs` derives them). The vocabulary law survives intact: the
Collective built its stable and says "living super weapons"; UF infantry
say "gods." The clone/reprint system, robots, and Iron Eaters in-game are
the war of Years 1–6: the squandered prep decade. The final season is
Years 7–8. *(Naming note for Robert: COF ruled the universe name is
"Consequences of Failure" and reserved "Superhero Tactics" for a video-game
adaptation — where War World's title sits in that ruling is his call.
Flagged, not resolved.)*

---

## 2. THE SEASON ARC — from today to the invasion

Today the game's season tells three acts — **war → outbreak → Iron Eaters**
(`docs/LORE.md` escalation ladder, DD §20.5). Robert wants MORE, and the
final season is the aliens. Proposal: **six seasons**, each a named campaign
span (DD §13's armistice machinery unchanged), tracking the COF year ladder.
The first three formalize what already ships; 4–6 are the build.

| # | Season name | COF year | What changes in play |
|---|---|---|---|
| **S1** | **THE WARNING** | Yr 1–2 | *Exists today.* The pure human war: clones, robots, LSW drops, the treaty violated nightly. Rusty Richards' broadcast voice enters the between-match radio (see §4). Enlistment (country → hometown → derived faction) is the season's fiction. |
| **S2** | **THE JACKAL YEARS** | Yr 3 | **Extraction mode debuts** (§5 — the Jackal Run). LSW blood is the new currency: killing an enemy god drops a harvestable sample; Sandra/the Jackals appear as a third-party field event. Sages arrive as science-mission intel (the science ops already ship). Paranoia dress: LSWs get bounties, the locker's serialized-gear economy opens. |
| **S3** | **IRON RAIN** | Yr 4 | *Mostly exists (the Iron Eater roster).* The satellite comes down ON a front mid-season — a live event. Eaters join every mode from wave 1; **Stealth Eaters** ship (a prop that stands up — the mimic, straight from the canon file); parked vehicles are picnics. Metal becomes a tracked resource: hulls the Eaters eat leave the seasonal motor pool. |
| **S4** | **THE IRON WAR** | Yr 5 | The year-long war, apocalyptic register. Eater heavies get their identities (weaver/ravager signatures, the walking-foundry Leviathan). **The canon turn: unprecedented cooperation** — scheduled CEASEFIRE OPERATIONS where UF and Collective fight the SAME Eater horde on one map (co-op inside pvp, the fronts' first joint objectives). Extraction runs now pay in **live Eater cores** → a RoboForge-style tech track (captured-nanite gadgets, per Deck 52 canon). |
| **S5** | **THE CRACKDOWN** | Yr 6 | Governments seize the stables. LSW drops get state minders; defection windows open (DD already specs defection); playing an LSW can now trigger a **rogue** state — your own faction posts the bounty (China-rebellion canon). **The Outbreak is retconned INTO canon**: the zombie horde IS the nanovirus (Iron Eaters near Muo spheres → black powder → brain-eating plague, `COF_TIMELINE_CORRECTED.md` Yr 7–8) — the infected can't be reprinted, exactly as LORE.md already ships. |
| **S6** | **ARRIVAL** *(the final season)* | Yr 7–8 | **The Alliance of Four lands and you fight alien races.** Both factions fold into ONE human side (the war the whole game was practice for). Wave structure by canon invasion phasing: **Ash-Weather** first (weather/atmosphere warfare — the shipped weather system turned hostile), then **Slaught swarms** (the horde tech at alien speed: drones/overlings/Queens; kill the Queen or drown), then **Xanthi door ambushes** (warp-gate tech as enemy AI — they arrive ANYWHERE; the Mark mechanic: a marked soldier is a spawn beacon until cleansed), and the **Mountain-Eater** as the season's siege-terrain finale `[pending Robert's solve — its slowness IS the horror: the front it lands on is simply lost]`. The Greys' hand shows: LSW materiel flows free — the gods were always meant for THIS. |

**Sequencing law:** each season keeps the armistice reset (DD §13) — seasons
are campaign spans, so "more seasons" costs fiction + events + one system
apiece (S2 extraction, S4 co-op ops, S5 rogue states, S6 alien brains), never
an engine rewrite.

---

## 3. THE LSW RENAME TABLE — gods → COF canon characters

Law applied: kits, threat bands, and factions DO NOT MOVE (the measured
table is law); the rename brings **name, country, face, and voice**. Where a
COF character exists, the game god becomes them ("make them as in the game
too" — the COF character IS the in-game god). Inventions with no COF
counterpart keep their names — they're the ~960 chosen the anthology never
wrote, which is itself canon (only ~110 of 1,000 are named).
Voice work rides the shipped expressive-TTS pipeline (5 moments each).

### Matches (rename + re-country)
| ShootEM id (kit) | Becomes (COF) | Country | Why it's the same power | Voice note |
|---|---|---|---|---|
| `oblivion` (void bolts, black-hole drag) | **John Rivers "STAMPEDE"** | USA (Los Angeles) | Canon power IS "tiny black holes — flies + wrecks" (`canon/characters/Stampede.txt`) | Ex-LAPD, low American growl; grief under discipline |
| `reactor` (overcharge an ally, nova) | **LIU XIAO** | China (Beijing) | The Muo spheres GRANT temporary power to others — the overcharge is a sphere handed to an ally (`Liu Xaio Story Spine.txt`) | ~60, formerly blind masseur; gentle Mandarin-accented; says "Muo" on cast |
| `chronos` (time bubble, 3s echo) | **ASHA** | India | One of the ONLY two time-travelers (future); each trip costs memory — the echo is a trip, and it costs her (`Establishment 24.txt`) | Female, Indian English; slightly frayed, each echo line more distant |
| `venatrix` (snap-traps, harpoon) | **SANDRA, "the L.A. Jackal"** | USA (roams) | The first Jackal — hunts and EXTRACTS LSWs alive ("clean" captures); the trap/reel kit is Jackal fieldcraft (`bible/factions/THE_JACKALS.md`) | Black American woman, unhurried, clinical; the ring whispers under her lines (Its Voice duck) |
| `pulse` (sonic wave, deafening burst) | **JAWAH MATU** | Tanzania (Dar es Salaam) | THE sound-domain LSW — absorbs sound to 70 dB and gives it back (`Jawah Matu .txt`); the burst that mutes your ears is his absorption weaponized | Male, Swahili-accented English; war-hero calm; albino character model |
| `dominator` (psychic links, lance) | **KARINE ABRAHAMIAN** | Armenia | NuroNuro nano-tech — subdividing and SHARING brains across a network; the damage-link IS NuroNuro weaponized (`Karina.txt`) | Female, Armenian accent, linguist's precision; recites in Armenian when bloodied |
| `vanguard` (shield bash, barricades) | **Col. RAGHAVAN REDDY** | India (Establishment 24) | Divine Metamorphosis — the golden Garuda armor; the breacher-commander (`Establishment 24.txt`) | Male, Indian officer clip; calls targets like a colonel |
| `inferno` (true flight, dive-bomb blasts) | **KING STEFANOS** (Alexandr Stefanos) | Greece | Concentrates energy, FIRES detonating motes, or PROPELS — flight + explosive dives (`bible/characters/KING_STEFANOS.md`). Re-skin flame → white-gold energy | Male, Greek statesman; TV-polished, wounded rage; the first LSW branded a war criminal |
| `nightmare` (fear pulse, the blind) | **ZEPHANIAH MWANGAZA** | Tanzania | Seer + MIND CONTROL (`bible/characters/ZEPHANIAH_MWANGAZA.md`); the lying map and the stolen eyes are her domain. Canon: she is DEAD — the Collective prints her from a stolen imprint `[PROPOSED — dark, on-theme: the game's reprint tech desecrating a martyr]` | Female, Tanzanian; two layers — her voice and the recording of her voice |
| `firebrand` (paints fire, cashes the board) | **Major ARASH TEHRANI** | Iran | Index canon: "heat sovereign" (`CHARACTER_ROSTER.md` wider roster) | Male, Farsi-accented, quiet arithmetic — he counts the patches out loud |
| `titan` (grabs vehicles, ground pound) | **MATEUS "O GIGANTE" FERREIRA** | Brazil | Density manipulation, the PCC's giant — O Gigante IS the game's giant | Male, Brazilian Portuguese bravado |
| `venom` (poison volley, acid glob) | **VALENTINA "LA VENENOSA" CASTRO** | Colombia | Toxin synthesis — the name literally means The Poisonous | Female, Colombian Spanish; endearments before the acid |
| `tremor` (earthquake stomp, soil ripple) | **ELIF KORKMAZ** | Turkey | Sand shaper — the ground answering her | Female, Turkish; low, patient |
| `riptide` (wave, whirlpool) | **SITI NURHALIZA RAHMAN** | Indonesia | Hydro-orchestration (alt: Nguyen Thi Minh, Vietnam — hydrokinetic; Robert picks) | Female, Indonesian; tide-calm |
| `pyroclasm` (molten rocks, erupts at 25%) | **BUDI "KRAKATOA" SANTOSO** | Indonesia | Barometric dominion, called KRAKATOA — the eruption threshold is his name made law | Male, Indonesian; rumbles, then the roar |
| `crusher` (charge through cover, hurl terrain) | **TARIQ AL-HASSAN** | Palestine | Stone whisperer — he remodels the map because stone obeys him | Male, Palestinian Arabic-accented; talks TO the stone |
| `magnetar` (bullet halo, magnetic pulse) | **ABEO** | Uganda (Hand of Uganda) | The metal-power bodyguard of the Ugandan trio | Male, Ugandan English; presidential-guard formality |
| `blitz` (dash chain, afterimages) | **JELANI** | Uganda (Hand of Uganda) | The strength-speed bodyguard | Male, Ugandan; short words, all business |
| `phantom` (phases through walls, machine ride) | **KAMARIA** | Uganda (Hand of Uganda) | The PHASING bodyguard — a literal power match | Female, Ugandan; barely above a whisper (she's inside the wall) |
| `mirage` (decoys, the swap) | **JANCE BLOOMBERG, "ECHO MIRAGE"** | USA/Mexico | His canon LSW name is ECHO MIRAGE — voice/perception impersonation; the decoys are his echoes (`Jance Bloomberg.txt`) | Male, American; every decoy speaks with a slightly different voice — the tell nobody notices |
| `eclipse` (moving darkness dome) | **LONBRAJ** `[PROPOSED]` | Haiti | "The Shadow" — operates in darkness against the dictator Limyè, "The Light" (`COUNTRIES, SEASONS & AI.txt` Haiti section — country material, not the dead draft; needs Robert's bless) | Male, Haitian Creole cadence; speaks from inside the dark |
| `sniperhawk` (piercing rail, laser telegraph) | **HANK "CROSSFIRE" FOSTER** `[loose]` | USA (Arkansas) | Probability/supernatural luck — the shot that cannot miss; "Crossfire" was already his name (`Hank Foster.txt`) | Male, Arkansas drawl; thanks God after every rail |
| `stormcaller` (tornado, 8s both-sides storm) | **the Kyrgyz season-turner** `[PROPOSED — unnamed in canon]` | Kyrgyzstan | The young woman who controls the seasons; her village called her a witch (`COUNTRIES, SEASONS & AI.txt`). Needs a creator name before shipping | Female, Kyrgyz-accented; prays into the wind — both sides fear her, which is canon AND the kit |
| `barrier` (energy wall, reflect) | **SOMCHAI "GOLDEN TRIANGLE" PHAN** `[loose]` | Thailand | Coral symbiont — walls that GROW; re-skin energy → living reef | Male, Thai; unhurried |

### Inventions — no COF counterpart, names stand (they're among the unwritten ~890)
`frostbite` · `shadowstep` · `voidwalker` · `specter` · `wraith` ·
`overload` · `voltstriker` · `gravwarden` · `reaper` · `crimson` ·
`ragebeast` · `gargoyle` · `leviathan` · `cataclysm` · `steelweaver` ·
`plaguebearer` · `oblivion`→taken (Stampede) — plus whichever of the loose
matches Robert declines.
Thematic ties worth keeping in the flavor text (not renames): **Crimson**'s
blood economy = the Jackals' blood market made flesh; **Steel Weaver**'s
exosuit = RoboForge-adjacent tech; **Wraith/Phantom** machine-possession =
what Its Voice does to cameras, in a body.
`[FLAG for Robert]` **Reaper**'s mark-the-hunted kit fits **Ramiro Guzman,
the Clown-Sheriff** (Mexico) perfectly in dread — but Guzman is non-powered
in canon. Powerizing him needs a ruling; until then Reaper stays Reaper.

---

## 4. CHARACTER IMPORTS — COF people who walk into the game

The mortal-class voice-pack pipeline already ships (the audio merge,
`62bf609`); hometowns already matter (enlistment picks REAL cities from the
COF city CSV). These are the named-character layer on top.

| Character | From | In-game role |
|---|---|---|
| **MOSES APIO** — *the flagship Ugandan, with a real accent* | Mbarara mechanic bonded to the Atlas Protocol symbiont (`prose/Atlas Protocol Episodes.txt`) — surveillance, regen, shapeshift | **Playable named operator** (infiltrator-class hero skin + full Ugandan-English VO pack) — the symbiont reads as his class kit (self-revive = regen, recon pings = the Protocol watching). The Hand-of-Uganda trio (§3) are his countrymen — enlisting from Uganda should FEEL like their country. Cast a Ugandan VO or direct the TTS on real Ugandan English — never generic "African accent." |
| **TRUE FOE** — *Robert's rapper friend, Chicago* | No COF counterpart — `[PROPOSED new canon, creator-sourced]` | **Named UF operator from Chicago, IL** (hometown row already exists in the city data). Drill-cadence VO pack (intro lines, kill lines, revive lines with actual bars); one unlockable track of his on the armory/lobby radio. Canon placement `[PROPOSED]`: a Chicago artist in Rusty Richards' musician orbit (Rusty's circle — "2 Glocks" — is canon precedent for rapper friends), enlisted the day the treaty broke his city. Flag to COF: add him to the roster as creator-blessed. |
| **RUSTY RICHARDS, "the Tomorrow Man"** | THE herald — non-powered; announced the 8 years (`prose/Episode 0.txt`) | **The voice of the doom clock**: between-match radio, season-open/close broadcasts, the S6 call to unite. HARD LAW: he never fights, never commands, never drops — he is a VOICE. This is the cleanest way to honor the WAR.md §7 "every broadcast plays under the clock" rule. |
| **JOHNNY RAIN, "Sun of the Soil"** | Ugandan musician-activist, non-powered (`canon/characters/Jonny Rain.txt`) | Faction-radio personality for African-theater fronts; his song "Freedom" as licensed-in-fiction lobby music; morale-event NPC. Never a combatant. |
| **KAISER EZIOBI, "Son of the Soil"** | Igbo pilot from Okigwe, 56; holds the memories of everyone who ever lived across a huge radius of Africa (`canon/characters/Eziobi.txt`, `bible/characters/KAISER_EZIOBI.md`) | **The memory of the war**: the dossier/journal voice for African-front campaigns — the man who remembers every clone you burned. Season-5 story beat: his assassination (canon) as a live event. Non-combat presence; his power is testimony. |
| **TODD "SHOGUN" BENCHLEY** | Black ex-Airborne Ranger Colonel, commands FIST (`Benchley Series.txt`) | **The OCS voice** — the officer-commission review, mission briefings for military operations. The chain-of-command finally has a face. |
| **VAUGHN GALLOWAY** | Billionaire, built FIST after the UN killed SPEAR | Stable-console flavor (the LSW purse/materiel economy is EXACTLY his business); S6 vindication beat: "SPEAR was the answer" — the joint human front IS SPEAR, eight years late. |
| **CISSY OLIVA** | "Oprah of Uganda," genetic-engineering Sage (`COF Notes.txt`) | Science-mission quest-giver: the clone-tech questline (her cloning insight IS the game's reprint economy — you can't clone without aging the clone). |
| **ZHANG WEI** | The second time-traveler (PAST, China) | S5 crackdown-season NPC: the loyalty auditor — a science-mission antagonist who already knows what you did last match `[PROPOSED]`. |
| **SANDRA** (also §3 Venatrix) | The first Jackal | Extraction-mode's marquee third-party spawn — the run's apex threat. |

---

## 5. THE EXTRACTION MODE — the lore hook

**The mode is called THE JACKAL RUN.** `[PROPOSED name]` It is Year 3 made
playable, and every rule an extraction shooter needs already exists in COF
canon or War World law:

- **Why you go in:** the LSW-blood black market (Year 3 canon — Jackals
  harvest LSW biological samples; LSW fluid becomes drugs, consumer
  products, weapons). A downed god's landing zone, a Jackal cache, a
  crashed-satellite debris field seeded with Iron-Eater dust, a black-site
  lab. The loot ladder: **LSW samples** (top prize) → **live Eater cores**
  (Deck-52-style RoboForge tech track, S4) → **Grey artifacts** (S6 setup)
  → serialized gear off the dead.
- **Why death is final for the run — the imprint gap:** Jackal work is
  OFF-BOOKS. The treaty bars governments from this, so your faction sends
  you **deniable — without an imprint refresh**. Die on a run and there is
  no reprint of the you that went in: the last backup wakes at base missing
  the whole run — the loot, the route, the memory. *"What happens off the
  record stays off the record."* This is LORE.md's own clone law
  (the RECORD is you) inverted into stakes, and it needs zero new fiction.
- **Why your gear drops and circulates:** the locker law already written
  (META-LAYER.md §locker): serialized OWNED items drop, persist, and
  reappear in other players' hands / the black market / recovery missions.
  The Jackal Run is that economy's HOME — the black market is literally
  canon (Year 3).
- **Why third parties hunt you:** everyone in the zone is deniable —
  rival faction runners, Jackal NPC crews (Sandra as apex spawn), Iron
  Eaters drawn to the metal you're carrying (carry more, ring louder —
  the canon "berserkers eat everything" as a risk dial), and from S5 the
  infected (the nanovirus zones can't be reprinted EITHER — symmetry).
- **Why it fits the 8-year tragedy:** the run is the war's most honest
  indictment — with the invasion eight years out, humanity's elite units
  are spending the countdown robbing each other's gods for parts. The mode
  IS the theme.
- **Season evolution:** S2 debuts blood-running → S3–4 adds Eater-core
  salvage from live infestation zones → S6 flips it: the same maps, but now
  you're extracting **survivors and Grey artifacts** ahead of the Alliance —
  the skill you built looting the war becomes how you save people from the
  invasion. The Jackal becomes the rescuer. That's the redemption arc of
  the whole player base, authored by a mode.

---

## 6. WHAT MUST NOT BE CONTRADICTED — hard canon laws

1. **The Greys are ALLIES.** They turned people INTO weapons (~1,000, of
   sound mind) — they never armed Earth openly, never invade. No "Grey
   enemy faction," ever.
2. **No supervillains.** Every LSW was psychologically selected to protect,
   not prey. War World's frame already obeys this — two stables, no heroes
   and villains, the tragedy is systems, not evil.
3. **Iron Eaters are the PRECURSOR, not one of the Four.** They eat metal,
   arrived years early as dust on the Greys' own ship via a crashing
   satellite, run Selective/Berserker/Stealth breeds, packs of 3–7. (Timing
   Year 3 vs Year 4 is an OPEN creator flag — don't hard-date it in-game.)
4. **The Alliance of Four** (current re-cut): Xanthi + Slaught +
   Mountain-Eaters (unresolved) + Ash-Weather `[PROPOSED]`. **The Deep and
   the Strategist Race are DUMPED** — never ship them as invaders. The
   "6 races / oxygen extraction" draft is DEAD.
5. **Exactly TWO time-travelers:** Asha (future) and Zhang Wei (past).
   Nobody else time-travels — not an LSW kit, not a mission gimmick.
   (Chronos→Asha satisfies this; the echo is her power, uniquely.)
6. **Rusty Richards is non-powered and never commands.** Herald only.
7. **SPEAR was never created.** The UN rejected it; FIST is the US-only
   fallback. No "SPEAR team" may appear before S6 — and if the S6 united
   front takes the name, that's Galloway's vindication, done deliberately.
8. **The treaty is the "Living Super Weapon Threshold Treaty"** (not
   "Lethal"). Governments wielding LSWs directly is the ultimate violation —
   which is why the war's stables are officially coalition/company assets.
9. **The term is "Living Super Weapons."** The UF-says-gods /
   Collective-says-LSW vocabulary split stays a writing law.
10. **No plot armor — outcomes follow quantified power** (COF
    `VISION_AND_GOALS.md` §4). War World's measured threat bands and
    every-god-dies-to-rifles law are the same principle; keep both.
11. **Locked character facts:** Sandra is a Black woman and the FIRST
    Jackal · Kaiser: Okigwe, 56, Igbo, assassinated by US/Western powers ·
    Jawah Matu is Tanzanian (the index's "Indian Lawal" is an error) ·
    Stampede is John Rivers (never "Marcus Williams"), cousin Rebecca
    Carranza · Cissy (not Sissy) Oliva · Benchley is "Shogun" (not Ravage).
12. **Never invent faction names locally** (War World standing law) — every
    nation fact regenerates from the COF Country Master Sheet; every new
    org name must exist in `COF/bible/` first or go to Robert as
    `[PROPOSED]`.
13. **Write the country, not a backdrop** (`COF/CLAUDE.md`): real cities,
    real accents directed specifically (Ugandan English, not "African"),
    the local tongue where it counts. The enlistment flow's real-city
    picker is this law in code — voice packs must meet the same bar.
14. **The calendar:** COF is near-modern; War World says 2222/2230. The
    INVARIANT is the 8-year doom clock, not the year number. Flagged to
    Robert (adaptation license vs. re-dating) — until ruled, never print a
    COF character next to a hard in-game date.
15. **House law: no purple.** COF inherits it (Machine King standard);
    every new alien VFX palette obeys.

---

*Sources walked for this document: `COF/CLAUDE.md`, `COF/bible/{PREMISE,
CANON_STATUS,CHARACTER_ROSTER,VISION_AND_GOALS}.md`, `COF/canon/
COF_TIMELINE_CORRECTED.md`, `COF/canon/aliens/*` (Iron Eaters, Slaught,
Deep, Zuma Rock, Potential Alien Types), `COF/bible/factions/
THE_ALLIANCE_OF_FOUR.md`, `COF/canon/characters/*` (Stampede, Eziobi,
Jonny Rain, Jawah Matu, Jance Bloomberg, Karina, King Stefanos), `COF/
canon/countries/*` — against ShootEM `docs/{LORE,ASCENDANTS,DESIGN-
DIRECTIVE,META-LAYER,WAR}.md` and `src/sim/lsw.ts` / `src/data/nations.ts`.*
