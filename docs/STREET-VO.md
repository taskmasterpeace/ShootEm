# STREET VO — the pedestrians and the vigilante, in the local voice

> Robert: *"do vigilante and pedestrian audio. Different cities sound like the
> culture code. Use the culture codes."*

The culture code was already in the game — every city in `map-cities.json`
carries one, and the architecture system already reads it for courtyards and
balconies. It had never driven a **voice**. Now it does: a pedestrian in a Lagos
street (code 2) and one in a Kingston street (code 13) say the same thing in a
different mouth.

---

## The two speakers

**THE PEDESTRIAN** — the world's bystander, and the voice of the civilian
traffic that already drives the streets (`traffic.ts`). When gunfire scares a
civilian into a panic, the street cries out. When a god walks past, it gasps.
When you drive like that, it curses you.

**THE VIGILANTE** — the pedestrian who does *not* run. The lore's seed
(docs/THE-LORE.md): do bad things in a print and the street turns on you — the
police come, but first a neighbour with a bat.

**Now wired, GTA2-style** (Robert: *"think gta2"*). The street keeps score.
`src/client/streetheat.ts` is a **wanted level for the corner**: mayhem near
civilians stokes a temper — firing your weapon on their street (small), nearly
running someone down (medium), getting one of them killed (large) — and the
temper cools when you behave. Crossing each line makes the nearest bystander
say something worse:

| Temper | The street |
|---|---|
| ≥ 0.50 | **CHALLENGE** — "That is enough." |
| ≥ 0.85 | **WARN** — the last word before it turns physical |
| ≥ 1.25 | **ENGAGE** — it swears it will fight |
| you go down while hostile | **TRIUMPH** — it stands over you |

The ladder relaxes as the temper falls, so a later spree re-escalates. It is a
pure, unit-tested state machine (`tests/streetheat.test.ts`) and, like the whole
street layer, **client-side and read-only** — it can never perturb the sim.

*Still a voice, not a body:* there is no walking-pedestrian entity yet (the
traffic layer models civilians as vehicles), so the vigilante shouts and the
street turns hostile, but nobody physically swings yet. A vigilante **entity**
is the next step — the lines are already voiced and waiting for it.

---

## The culture legend

`src/sim/culture.ts` — reverse-engineered from the countries that actually carry
each code in `map-cities.json`, so it is grounded in the data, not invented. A
cadence and a place, never a caricature (the same rule the map-maker set for the
buildings).

| Code | Region | Voiced by | Anchored in |
|---|---|---|---|
| 1 | The Maghreb | Algenib | Algeria, Egypt, Morocco |
| 2 | West Africa | Sadaltager | Nigeria, Ghana, Ivory Coast |
| 3 | Southern Africa | Schedar | South Africa, Angola |
| 5 | South Asia | Alnilam | India, Bangladesh, Sri Lanka |
| 6 | East Asia | Iapetus | China, Japan, Korea |
| 8 | Central America & Caribbean | Achird | Mexico, Cuba, Haiti |
| 9 | Western Europe | Vindemiatrix | France, Germany, Italy |
| 10 | Eastern Europe | Rasalgethi | Russia, Ukraine, Greece |
| 11 | Oceania | Zubenelgenubi | Australia, New Zealand |
| 12 | South America | Laomedeia | Brazil, Argentina, Colombia |
| 13 | Jamaica | Gacrux | Jamaica |
| 14 | The Middle East | Sadachbia | Iran, Iraq, Israel, Saudi Arabia |

A city with no code (`null`) speaks with a neutral voice — nowhere is mute.

---

## How a city gets its voice

The world is handed a `cultureCode` at launch (`WorldOptions.cultureCode`), and
the client reads it to pick the local mouth. Today it comes from the **player's
enlisted nation** — a Nigerian recruit's deploys carry West African street VO, a
Brazilian's carry code 12 — via a generated `country → culture` lookup
(`src/data/country-culture.json`, built from `map-cities.json`). When the map
maker lands real cities, it can pass the *city's* own code instead and nothing
else changes.

---

## The audio

`src/client/streetvo.ts` holds the catalogue (pedestrian + vigilante lines per
culture) and the deterministic picker; a bark never consumes an rng draw.
`tools/gen-street-vo.mjs` voices it via `google/gemini-3.1-flash-tts`, reading
the legend for each accent.

```bash
node tools/gen-street-vo.mjs            # a representative SAMPLE (6 cultures × 3 events)
node tools/gen-street-vo.mjs --all      # every clip (216 — slow)
node tools/gen-street-vo.mjs --culture 12   # just South America
node tools/gen-street-vo.mjs --list     # print the plan, generate nothing
```

**Shipped: the whole catalogue — 216 clips, 12 cultures × 9 events × 2 takes.**
Every pedestrian reaction (idle · gunfire · flee · god · reckless) and the full
vigilante ladder (challenge · warn · engage · triumph) is voiced in all twelve
mouths, two takes apiece so a corner never loops one phrase.

**One source of truth.** The lines live in `src/data/street-lines.json` — the
same file the runtime catalogue (`streetvo.ts`) imports and the generator reads.
A voiced clip can no longer drift from the words on screen, which is exactly how
`triumph` and every second take went unvoiced before (the tool carried a stale
hand-copied mirror). `tests/streetvo.test.ts` pins the arrangement.

A slot with no take resolves to a text bark rather than silence-with-a-hole,
because `audio.play()` boots silently on a missing file: the street is
atmosphere, never a hard dependency.

Verified with the whisper pass: West Africa's "Chai!" is heard as "Tch!" (clean
pidgin), and Jamaica's "Jah know, wah kinda ting dat?" transcribes as "John, no,
what kind of thing that?" — the low similarity is the *proof* the accent
landed, because whisper is normalising real Patois to standard English.

---

## What's wired vs next

| | |
|---|---|
| **Wired** | culture legend · one-source-of-truth catalogue (`street-lines.json`) · the picker · enlisted-nation → culture code · **216 clips — every culture, every event, both takes** · **STREET HEAT**, the vigilante wanted-level (challenge→warn→engage→triumph) · the reactive updater: **idle** chatter on a calm corner, **gunfire** at the shot, **flee** as they run past you, **god** awe, and **reckless** when you drive at them |
| **Next** | a **walking-pedestrian entity** (today civilians are vehicles, so the "pedestrian" is a car with a voice) · a **vigilante entity** that physically steps out of the crowd — the street already turns on you in *voice*, but nobody swings yet · a `wounded` cry (the one typed event with no lines written) · a HUD tell for the temper, so you can *see* the corner turning |
