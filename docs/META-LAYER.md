# THE META-LAYER — countries, money, missions, and the war around the war
### The planning doc Robert asked for (2026-07-21). The loop stays combat; everything here wraps it.

**Robert's brief:** *"I'm trying to figure out how to make people have something to do outside of combat… The loop should just be combat. But you can help the war effort with science missions, military missions for money, personal missions for your locker. You choose which country you sign up for. You and your buddy sign up for the same country → same squad. And everything's gonna cost money."*

**Status: DESIGN / DECISION. Nothing here is built. This doc exists so Robert picks the build order off a real map — and calls the four forks in §4 that gate everything.**

**Guardrail (his law):** *"Don't allow me to destroy things."* Every path below is **additive** — the tactical combat game we've spent this whole run polishing is never touched. The meta bolts *on top*.

---

## 1 · THE MARRIAGE — this already half-exists, in two repos

Robert has **two** of his own projects that are two halves of one game:

| | **War World: Earth** (`D:/git/ShootEM`, this repo) | **SuperHero Tactics / SHT** (`D:/git/sht`) |
|---|---|---|
| **Strong** | the *combat* — firefight, LSWs, vehicles, outbreak, 200-gun armory, the Pattern character system | the *strategic meta* — countries, cities, economy, missions, warboard |
| **Weak** | the meta is thin: 10 fronts, a materiel purse, clones, passes | its own docs say **combat is "the least complete part of the game"** |

SHT is a running React/TS/Zustand game whose meta is exactly the thing Robert wants around War World's combat. **The move is not to rebuild SHT's meta — it's to feed SHT's DATA + design into War World's already-shipped meta scaffolding.** What SHT has, verified this session:

- **168 countries** (`MVP/src/data/allCountries.ts`, 38 stat fields, all presidents + mottos filled). Every input the vision needs is already a column: **`cloning`** (Banned/Regulated/Legal — literally "how each government feels about cloning"), **`science`**, **`lswActivity`**, **`lswRegulations`**, **`gdpNational` / `militaryBudget`** (the war-chest inputs), `governmentCorruption`, `mediaFreedom`, an **allies/enemies** column, and `cultureCode`/`cultureGroup` (region + name-generation keys).
- **1,170 cities** (`allCities.ts` + supplemental) — `crimeIndex` / `safetyIndex` (0–100), `cityTypes[]` (Military/Political/Industrial/Educational/…), `hvt` (high-value target), real lat/lon, and a baked **sector** on a 40×24 grid.
- **168 national LSW agencies** (`countryOrganizations.ts`) — each a real org with a stance: **`sponsors / regulates / hunts / denies`**. This *is* "LSWs come from their respective countries," already authored as data.
- **Per-country character-gen flavor** (`countryProfiles.ts`) — origin weights, stat tendencies, taglines. Fuel for our Pattern/JA2 layer.
- A **working economy** (`economySystem.ts` + a `$75k` budget) — shop, prices, weekly payday, mission rewards all wired.
- A **working mission system** (`missionSystem.ts` — 11 op types, rewards scaled by city type + crime + country stats) whose `combatResultsHandler.ts` already distributes money / XP / loot / fame / reputation / **auto-generated news articles**.
- A **live world map with a territory-control warboard** (`WorldMapGrid.tsx` + `territorySystem.ts`) — sectors tinted by controlling faction, `controlPercent`, `liberationProgress`, traveling units drawn on it.
- A **faction reputation system** (`factionSystem.ts`, 1008 standings, 6 faction types per country, price/travel modifiers, an alliance cascade matrix).

**The convergence is already real:** our own `docs/PATTERN-REGISTRATION.md` says Q1 = *pick a real country on the world map*, Q2 = *type your city* (accent at neighborhood level). SHT is 168 real countries and 1,170 real cities. The character layer we designed **assumes exactly SHT's data.**

---

## 2 · THE ARCHITECTURAL LAW — N countries in the meta, every battle stays 2-sided

Robert's oldest blocker: the team model `(1 - team)` is baked through the whole combat core (the "true third faction" is the DSOA spec's biggest structural ask). The unlock that gives him 168 countries **without touching that core**:

> **The countries live in the META. Every BATTLE is still two sides.** A match is *your country vs one enemy country* — team 0 vs team 1 under the hood, exactly as today. The warboard, the economy, the rosters, the LSW lineup, the presidents, the squads-by-country — all N-country. The firefight never changes. This is *how* "don't destroy things" is honored structurally, not just carefully.

Everything below obeys this law. Nothing here needs the combat core rewritten.

---

## 3 · THE ASSET MAP — Robert's vision → what already exists to carry it

| Robert wants | Rides on (War World, shipped) | Fed by (SHT data) |
|---|---|---|
| Choose your country; squad-by-country | the 2-faction `faction: Team` model + `FactionSelection` | `allCountries.ts` (168) + presidents/mottos |
| Everything costs money | `materiel` purse + `warLedger` + priced LSW calls | `economySystem` ($ budget, shop, prices) |
| **Science → clones** | the **clone reserve already exists** (W3.3 front `clones`) | country `science` + `cloning` policy |
| **Military → money** | the war chest (§ above) | mission reward scaling by country stat |
| **Personal → your locker (losable)** | dropped-weapon LOOT (shipped) + the death-drop | SHT loadout/inventory + injury/loss model |
| LSWs from their countries | LSW `faction` tag + `lswsForTeam` + `requestLsw` | `countryOrganizations.ts` (168 agencies) |
| The global warboard | the Scar map (10 fronts, `control`/`clones`/`pass`) | `territorySystem.ts` (sector control) + 40×24 grid |
| Cities with crime/science, missions there | (new) | `allCities.ts` (crime/type/hvt/coords) |
| The president, the slogan | the officer channel (just built) + Front Courier | `president` + `motto` per country |
| Characters you care about (JA2) | `PATTERN-REGISTRATION.md` + VO pipeline | `countryProfiles.ts` + city-accent |
| **Newspaper after a match** | **the Front Courier + corrections box (shipped today)** | (+ SHT's `newsGenerator` as a model) |

Read that column of "shipped" — the meta scaffolding is further along than it feels. The clone economy, the money purse, the officer, the press, loot-you-can-lose, the front map: all live. The gap is mostly **content (SHT's data) + connective tissue**, not new engines.

---

## 4 · THE FORKS — the calls only Robert makes (these gate everything)

**F1 — Integration model.** *(recommended: A)*
- **(A) ABSORB** SHT's data + design into War World's meta. Import the country/city/org tables as data; grow our own `campaign.ts` / `materiel` / `clones` / officer to use them. One codebase, additive, no-destroy. **Fast, safe.**
- **(B) MERGE** the two codebases — War World becomes SHT's combat scene. Enormous, risky, touches "destroy" territory. Probably a someday, not a now.

**F2 — Faction identity.** SHT is **168 real countries** (Algeria, Norway…) with *fictional presidents*. The *Consequences of Failure* canon (your other spreadsheet) is **fictional governments** with real-world character *origins*. Which is War World's roster?
- **(A)** Import SHT's 168 real countries as-is (ship now; rename later).
- **(B)** Use Consequences-of-Failure fictional governments, with SHT's stats as the *template* per government.
- Memory law stands either way: **faction names are placeholders until you name them from the spreadsheet.**

**F3 — The three tanks.** Your framing is science→clones, military→money, personal→locker. SHT's actual reward primitives are money/XP/loot/fame/reputation. Confirm the mapping: do the three mission *types* each pay a *different* resource (your design), or does everything pay money and clones/gear are bought with it? *(Your three-tank version is cleaner and I'd build that.)*

**F4 — Individual stats.** You said you're leaning toward finally turning them on (aiming, money as stats). Yes/no gates the character depth: do we add per-character MEL/AGL/STR/INT-style stats (SHT has `statTendencies` per country ready to seed them), or stay class-only?

---

## 5 · THE BUILD MENU — you pick the order

Ordered cheap-on-existing → big. Each says what it rides so you can see the cost.

1. **Newspaper *after* the match** — surface the Front Courier issue on the post-match screen (it's built; it only shows in the MAP tab today). *Your "might be the move." Smallest, most visible.*
2. **The war chest** — promote `materiel` into money: a national purse, income from wins, first price tags on gear (LSW calls are already priced). *The spine everything else hangs on.*
3. **Countries as data** — import `allCountries.ts` (F2 decides which set); enlist-with-a-nation with its president + slogan, replacing flat United-Front/Collective. *Pure data + the enlistment hook we already designed.*
4. **LSWs by country** — retag the god roster from 2 factions to nation-owned via `countryOrganizations.ts`. *Data retag; the battle stays 2-sided (§2).*
5. **The three tanks** (F3) — science missions pay clones (the reserve exists), military pay money, personal pay locker gear you can lose. *The "something to do" loop.*
6. **The city warboard** — the 10 fronts grow into cities-on-a-map with crime/science driving what missions spawn where. *Rides the Scar map + `territorySystem` model.*
7. **The Pattern / enlistment office** — build `PATTERN-REGISTRATION.md`: character, city-accent, the generated voice. *The JA2 killer feature; its own wave.*
8. **Individual stats** (F4) · **the Secretary of War** · **squads-by-country in multiplayer** (needs the netcode stack) — bigger, later.

---

## 6 · WHAT I'M NOT DOING

Not building any of this yet — you're ordering it. Not merging codebases. Not renaming factions (placeholders until your spreadsheet). Not touching the combat loop. When you call the forks in §4 and pick a first move from §5, I'll fold the choice into `docs/MASTER-BACKLOG.md` as ritual rows and build it the way everything else shipped this run: gates green, on-screen proof, one slice at a time.
