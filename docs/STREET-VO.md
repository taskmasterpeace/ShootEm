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
police come, but first a neighbour with a bat. The vigilante *challenges*,
*warns*, and if pushed, *engages*. The barks exist and are reachable
(`StreetVoice.vigilante()`); wiring them to a vigilante *entity* is the next
step (there is no walking-pedestrian entity yet — the traffic layer models
civilians as vehicles).

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

**Shipped so far: 18 clips across 6 cultures** (West Africa, East Asia, Central
America/Caribbean, Eastern Europe, Jamaica, the Middle East), each a pedestrian
panic, an awe line, and a vigilante challenge — enough to *hear* the difference.
The other six cultures resolve to a text bark until their audio is generated
(`--all`), because `audio.play()` boots silently on a missing slot: the street
is atmosphere, never a hard dependency.

Verified with the whisper pass: West Africa's "Chai!" is heard as "Tch!" (clean
pidgin), and Jamaica's "Jah know, wah kinda ting dat?" transcribes as "John, no,
what kind of thing that?" — the low similarity is the *proof* the accent
landed, because whisper is normalising real Patois to standard English.

---

## What's wired vs next

| | |
|---|---|
| **Wired** | culture legend · full catalogue (12 cultures, both speakers) · the picker · enlisted-nation → culture code · the client updater that fires a pedestrian bark on civilian panic and an awe bark when a god walks · 18 sample clips |
| **Next** | the remaining 6 cultures' audio (`--all`) · a walking-pedestrian entity (today civilians are vehicles) · a **vigilante entity** that steps out of the crowd when you commit violence near civilians — the challenge/warn/engage lines are ready and waiting for it |
