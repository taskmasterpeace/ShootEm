# THE BUSINESS PLAN — Machine King Labs, games division

### Written 2026-07-23 against the code, the commit log, and the issue board. Not against the pitch.

> Robert: *"Write up like a biz plan, a way for me to be successful with this game… I'm thinking about putting out Ascendants as a standalone game and then having this as the whole thing so you could be a superhero in this military space."*

**The short answer to that question is yes — and the order is the opposite of what it sounds like.** Ascendants is not the spin-off. It is the front door, and War World is the building. This document argues that from the numbers.

Everything below is deliberately unflattering where the evidence is unflattering. You asked for a plan, not a pitch deck.

---

## 0. THE LEDGER — what actually exists, measured

| | WAR WORLD: EARTH | ASCENDANTS (`D:/lsw`) |
|---|---|---|
| Age | 13 days (first commit 2026-07-10) | **2 days** (2026-07-22) |
| Commits | **885** | 44 |
| Source | 75,507 lines TS, 221 files | 14,318 lines JS, 42 files |
| Tests | 238 files, **~1,895 assertions**, CI-gated | none |
| Runtime deps | `three`, `ws`. That's it. | `three` |
| **Shipped build size** | **265 MB of assets** + JS | **1.48 MB. One file.** |
| Multiplayer | designed (#108), **0 of 6 milestones built** | local 2P, split-input, no netcode |
| Open issues | **84** (16 tagged `[EPIC]`) | a BACKLOG.md |
| Playable end-to-end today | modes yes, *reason to return* no | **yes — pick, fight, KO, level** |

Two facts in that table do more work than the rest of this document combined:

1. **Ascendants' entire shipping build is 1.48 MB of JavaScript and 9 KB of HTML.** No asset directory. The audio is synthesized in the browser. That is a game you can put behind a link in a Discord message and someone is playing it four seconds later, on a work laptop, with no install and no launcher.
2. **War World ships 265 MB of assets, of which 216 MB is `.wav` files that have `.ogg` twins totalling 14.4 MB.** 755 WAVs, 755 OGGs, same names. A browser game that downloads a quarter of a gigabyte is not a browser game — it is a download with extra steps. This is an afternoon's work to fix and it is currently the single largest gap between what War World *is* and what it *claims to be*.

---

## 1. THE THESIS — what is actually differentiated

Let me kill the wrong answers first, because they're the ones that feel best.

**Not differentiated:** "a deep military sim." Arma, Squad, Foxhole, Hell Let Loose and Ready or Not all exist and all have teams. **Not differentiated:** "a superhero action game." **Not differentiated:** "one shared universe." Shared universes are worth approximately zero until product #1 has an audience; Marvel worked because *Iron Man* was good, not because a filing cabinet of lore existed. **Not differentiated (yet):** 169 nations, 48 civilian vehicles, 22 secondary skills. That is *depth*, and depth converts people who already care. It acquires nobody.

Here is what is actually defensible, ranked:

### 1.1 Zero-friction distribution of a game with console-tier depth — **the wedge**

Every competitor who wants to be in a browser tab pays a 20–80 MB WASM tax to get there (Unity WebGL, Godot web export, Unreal doesn't really go there at all). You hand-rolled Three.js and pay **1.48 MB**. That is not a technical footnote; it is a distribution channel almost nobody else can use, and it stacks:

- A link in a Discord message is a playable game. No store page, no install, no age gate, no launcher.
- It works on a locked-down work machine, a school Chromebook, a borrowed laptop.
- It works on the HTML5 portals (CrazyGames, Poki, Newgrounds, itch) that have *tens of millions* of reported monthly users and near-zero indie competition at this fidelity, because everyone good ships to Steam.
- The marginal cost of one more player is a CDN request.

The set of "instant 3D action games in a tab that are actually good" is small and mostly bad. That is the gap.

**The honest counterweight:** browser games carry a legitimacy tax. Press, streamers, and a chunk of players discount them on sight, and there is no browser equivalent of a Steam wishlist. The plan must therefore be *browser for acquisition, Steam for revenue and legitimacy* — never browser alone.

### 1.2 The production rate is itself an asset — with a caveat that matters

885 commits in 13 days, 75k lines, 1,895 tests, peak of 257 commits in one day. That is not "a fast indie." It is a different production regime, and it means you can do things competitors structurally cannot: ship a themed content update every week, respond to a community request the same day, run five experiments where a normal studio runs one.

**The caveat, stated plainly: velocity is also how you build the wrong game very quickly.** Shipping twenty systems in thirteen days is exactly the mechanism that produces "too many systems, no core loop." Your own `THE-TOWN.md` says it better than I could:

> *"So the gap is not content. It is CONNECTIVE TISSUE. Six real places exist and the player reaches every one of them through a list."*

You have built more game than most studios build in two years and you have not yet built a reason to log in tomorrow. That is not a criticism of the work; it is a statement about what the *next* thirteen days must be spent on.

### 1.3 The deterministic, test-gated sim — the quiet real moat

`tests/threat-measure.test.ts` drops all 40 superhuman units against their designated counter-force and **fails CI if a balance band moves.** Forty measured time-to-kill figures, in the repo, enforced. I have not seen that in an indie project. Its strategic value is not "balance is good" — it is:

- server-authoritative multiplayer becomes cheap (the verdict in #20 is already made);
- replays are free and byte-stable across versions;
- **the auto-generated newspaper is credible**, because the sim is a source of truth rather than a vibe;
- and an AI collaborator can be turned loose on the sim without breaking it, which is the actual reason the velocity in §1.2 is sustainable.

### 1.4 The content engine — a real differentiator, currently unrealized

The world generates its own press (`newspaper.ts`, GONET BROADCAST, the radio lane in #108) at a scoped budget of **<$0.50/day**. A game that writes an endless stream of on-brand marketing copy about things players actually did is a marketing machine with an operating cost of fifteen dollars a month. Nobody else has this because nobody else has a deterministic sim *and* an LLM pipeline *and* a lore bible. See §6.

### The thesis, in one line

> **Console-depth action games that start in three seconds, in a tab, and generate their own news.**
> The delivery is the wedge. The depth is the retention. The universe is the marketing.

---

## 2. PORTFOLIO STRATEGY — the recommendation

**Ship ASCENDANTS first, as a commercial product. Freeze War World feature work. Use one shared account to funnel between them.**

Not "consider it." Do it. The reasoning:

| Criterion | Ascendants | War World | Verdict |
|---|---|---|---|
| Time-to-fun | ~15 seconds (pick hero, fight) | ~5 minutes (enlist, GONET, brief, deploy) | Ascendants |
| Download | 1.48 MB | 265 MB | Ascendants, decisively |
| Complete without netcode? | **Yes** — duel/survival/rumble/training all work solo or 2P local | **No** — a persistent war with no other people is a diorama | Ascendants |
| Complete without accounts? | Yes (localStorage) | No (#83 unstarted) | Ascendants |
| Legible in a 15-second clip? | Beam clash, ragdoll KO, flight — yes | Squad sim — no | Ascendants |
| Marginal hour of dev → player value | very high (2 days old) | diminishing (884 commits deep, 84 open issues) | Ascendants |
| Long-term defensibility | medium (crowded arena-fighter space) | **high** (nobody else is building this) | War World |
| Audience willingness to pay | high (see §3.1) | high but small and demanding | tie |

The counter-argument deserves a fair hearing: **War World is the more original product and the harder thing to copy.** It is the moat. But you cannot monetize a moat that nobody has walked to, and War World's promise — *a persistent war that everyone is inside* — is structurally undeliverable until #108's M4 lands. That is quarters of work, not weeks, and it is work with no player feedback attached.

### The sequencing, concretely

```
ASCENDANTS (browser, free)  →  ASCENDANTS (Steam, paid)  →  WAR WORLD (browser alpha, same account)
        the hook                    the revenue                     the destination
```

- **Ascendants is the door.** Free in the browser, forever. It is the demo, the ad, and the top of the funnel.
- **Ascendants on Steam is the business.** Paid, native-wrapped, controller and Steam Deck, the full roster, the character creator with saves.
- **War World is the destination,** and it is where the Ascendants player goes when they want the same universe with weight. The GONET account is the bridge — the same identity, the same certifications, the same war.

### On putting War World's gun combat into Ascendants

Do it — **but as the first major post-launch update, not before launch.** It is genuinely differentiating ("the superhero game where the mortals shoot back, and sometimes win"), it is the technical bridge that starts converging two codebases, and the lore already justifies it perfectly: **the jackals.** A jackal update — human specialists with rifles, vans, and a body-bag economy hunting an Ascendant — is the single best content beat available in either product, and it exports both ways.

It is also the textbook scope-creep vector. Ship the fighter first.

---

## 3. TARGET AUDIENCE — who actually pays

### 3.1 Ascendants

The strongest audience insight in this whole portfolio: **the superhero-with-a-character-creator audience is real, large, vocal, and demonstrably underserved.**

*City of Heroes* shut down in 2012 and its community built and still runs private servers with tens of thousands of registered players fourteen years later. *Champions Online* limps. *DC Universe Online* is old. Every few months a thread with tens of thousands of upvotes asks the same question — *why is there no good superhero game with a character creator?* — and the answer is that licensing makes big publishers build Marvel/DC games instead. **You are not licensed, so you can build the game they keep asking for.** You already have ORIGIN, the point-buy creator, in the codebase.

| Segment | Size / behavior | Comparable games | Reaches them via |
|---|---|---|---|
| **Superhero-creator refugees** (30–50, nostalgic, high willingness to pay) | small but ferocious; the CoH diaspora | City of Heroes, Freedom Force, Champions Online | Reddit (r/Cityofheroes, r/gaming), YouTube retrospectives, Discord |
| **Arena/anime power-fighter fans** (18–35) | large, fragmented, clip-driven | Bid For Power, Dragon Ball Xenoverse/Sparking!, Battlerite | YouTube Shorts, TikTok, fighting-game Discords |
| **Browser-action players** (13–24) | very large, **will not pay**, but will retain and clip | Krunker, Shell Shockers, Roblox superhero games | CrazyGames, Poki, itch, Newgrounds |
| **Roguelite action buyers** (22–40) | the Steam money | Hades, Ravenswatch, Risk of Rain 2 | Steam wishlists, Next Fest, streamers |

Segment 3 is your acquisition and telemetry. Segments 1, 2 and 4 are your revenue. Design the browser build for 3, the Steam build for 1/2/4.

### 3.2 War World

| Segment | Comparable games | Honest read |
|---|---|---|
| Persistent-war MMO players | **Foxhole**, Eve, Planetside 2 | The closest spiritual comp, and it proves the niche supports a studio. But Foxhole needs *hundreds* of concurrent players per shard to feel alive. A persistent war with twelve people is a screensaver. |
| Mil-sim / tactical shooter | Arma Reforger, Squad, Ready or Not | Hardcore, demanding, and they will judge your browser fidelity harshly. |
| Squad-RPG / character-attachment | Jagged Alliance 2, Xenonauts, Battle Brothers | **This is your best War World audience.** The prints, the certifications, the memorial, the endearing-characters instinct — that's JA2, and JA2's audience has been starving since 1999. |
| Infantry Online cult | Infantry Online (dead) | Tiny. Loyal. Great for a first hundred testers, useless as a market. |

**Read:** War World's audience is smaller, more demanding, and gated behind multiplayer. It is a 2027 product with a 2026 alpha. The JA2 angle — *characters you get attached to, who can die, in a war that remembers* — is the framing that sells it, not "military sim."

---

## 4. GO-TO-MARKET

### 4.1 The browser is the top of the funnel, not the business

| Channel | Effort | Realistic first-year reach | Money | Notes |
|---|---|---|---|---|
| **itch.io (HTML5, free)** | hours | 1k–10k plays | ~$0 | Zero-friction, real discovery for browser-playables, devlog integration built in. **Start here.** |
| **CrazyGames / Poki** | days (SDK + review) | 50k–500k+ plays | ad rev-share, realistically **$300–3,000/mo at scale** | Reported tens of millions of MAU each. Young audience, won't buy, but gives you retention data and clip fuel for free. Apply once the game is genuinely polished — rejection is common. |
| **Newgrounds** | hours | 5k–50k | small | Still alive, still loves an ambitious browser game, good for a first spike. |
| **Own domain** (`ascendants.game` or similar) | hours | — | — | The canonical link. Everything points here. Analytics live here. |
| **Steam** | ~1–2 weeks | **the revenue** | see §5 | See below. |

### 4.2 The Steam problem, and the fix

**Steam does not accept browser-embedded games.** You need a native executable. Your options:

| Wrapper | Bundle size | Verdict |
|---|---|---|
| **Electron** (`electron/main.cjs` + `dist:win`/`dist:linux` — **already scaffolded in War World**) | ~120–180 MB installed | **Acceptable, and it's already built.** Bundles its own Chromium, so rendering is identical everywhere and you never debug someone's WebView2. On Steam nobody sees the install size before they buy. |
| **Tauri** | ~5–12 MB (uses the system WebView) | Better on paper. Uses the OS WebView, which means **your WebGL behaviour now varies by OS and OS version** — on a game this GPU-heavy that is a real QA surface. |
| NW.js | ~120 MB | No. |

**Recommendation: use what you have.** The Electron scaffold in `electron/` already exists and `dist:win` already builds. Ship Ascendants on that same scaffold — it is a day of work to point it at the other bundle, versus a week to learn Tauri and then own a cross-platform WebGL matrix. The 1.48 MB figure is the *browser* advantage, and the browser build is the free funnel; nobody buying on Steam cares that the installer is 140 MB. **Revisit Tauri only if install size measurably costs you conversions** — and it almost certainly won't.

Then the Steam mechanics, which are unforgiving and worth respecting:

- **Wishlists before launch are the single best predictor of launch-day units.** The rough industry rule is that day-one sales land somewhere around 10–20% of accumulated wishlists. 7,000 wishlists at launch is the commonly cited threshold for the algorithm to notice you.
- **Steam Next Fest with a real demo now outperforms a trailer.** A browser build that *is* the demo is a genuine structural advantage here — most devs have to build a demo; you already have one and it's already public.
- Steam takes 30%. Regional pricing and VAT take another ~10–15% of gross. **Net per $14.99 sale ≈ $9.**
- Put the store page up *months* before launch. A Steam page with no wishlist runway is a wasted launch.

### 4.3 Build in public — your strongest and most-underused asset

You have the receipts almost nobody else has: a public commit log showing 885 commits in 13 days, 1,895 CI-gated tests, and a balance suite that measures forty superhuman units against their counter-forces. "Solo dev + AI shipping at studio pace" is currently one of the most engaging narratives in game development, and most people telling it are lying. You aren't.

**Cadence to actually hold (assume the 257-commits/day pace halves; plan for the sustainable number, not the peak):**

| Frequency | Artifact | Cost |
|---|---|---|
| Daily | One GIF or 15-second clip of the day's change, on X/Bluesky/Discord | 10 min |
| Weekly | A devlog post — itch devlog + Reddit (r/gamedev, r/webgames, r/threejs) | 45 min |
| Weekly | One YouTube Short / TikTok — the loudest 20 seconds of the week | 30 min |
| Monthly | A longer written piece with real numbers (the balance suite, the 1.5 MB build, the determinism bet) | 2 hrs |

**Two warnings.**

1. **The AI-assisted angle draws real hostility** in parts of r/gamedev, Bluesky, and indie Twitter. Do not evangelize the tooling. Lead with the game, be matter-of-fact and unapologetic if asked, disclose asset provenance clearly, and never make "made with AI" the headline. The story that works is *"I shipped this,"* not *"AI shipped this."*
2. **Scrub the derivations from anything public.** `D:/lsw/README.md` currently annotates heroes as "KANO (Goku)", "VEGA (Vegeta)", "AURUM (Green Lantern)", "SPECTER (Vision)", "APEX (Cell)". Those notes are perfectly fine as internal design shorthand and a **legal and reputational liability the moment they are public.** Before anything ships: remove the parentheticals, and audit silhouettes, colour palettes and power names so no character reads as a direct copy of a specific licensed figure. This is cheap now and expensive later.

### 4.4 Discord is the home

Not a nice-to-have. A superhero game with a character creator generates *share-my-build* behaviour, and that behaviour has no home on itch or Steam. One server, three channels that matter: `#builds` (creator exports), `#clips`, `#the-daily-edition` (the auto-generated newspaper, posted by a bot — see §6). Target 500 members by month 6; that's a realistic and sufficient number.

---

## 5. MONETIZATION — ranked, with the risk attached

### 5.0 The cost base, because it changes everything

| Line | Annual |
|---|---|
| Steam Direct (per app) | $100 |
| Domain + CDN | ~$50 |
| VPS (multiplayer, later) | $240–500 |
| AI tooling (dev + content pipeline) | $2,400–5,000 |
| Generated assets (music/TTS/images) | $600–1,800 |
| Contingency | $1,000 |
| **Total** | **≈ $4,400 – $8,500 / year** |

Two runtime dependencies, MIT licensed, no engine royalty. **Break-even on Steam is roughly 500–950 units at $14.99.** That is a genuinely achievable number.

**Which means the financial risk here is low and the real risk is opportunity cost of your time.** Frame every decision in this plan against that, not against money.

### 5.1 The ranked options

| # | Model | Realistic Y1 | Risk | Verdict |
|---|---|---|---|---|
| 1 | **Premium on Steam, free in browser.** Ascendants $12.99–14.99. Browser build = 6 heroes, duel + survival. Steam = full roster, creator saves, campaign, controller, Deck. | Median indie outcome: 1.5k–3k units ≈ **$13k–27k**. Good outcome with a working browser funnel: 15k–40k units ≈ **$135k–360k**. | Cannibalization if the free build is too complete. Mitigate by *content* gating (roster, creator persistence), never by *quality* gating — a crippled free build kills the funnel. | **Do this.** The primary business. |
| 2 | **Hero packs / creator content DLC** | $3–6k Y1 on top | A content treadmill on a solo dev. Keep packs small (3 heroes) and infrequent (quarterly). | **Do this, from month 8.** |
| 3 | **Ad rev-share (CrazyGames / Poki)** | $500–5,000 | Near zero. Requires an SDK integration and portal approval. | **Do this.** It is free money that also buys you telemetry. |
| 4 | **Patreon / Ko-fi on the devlog** | $600–3,000 | Low. Requires you to keep publishing, which you should do anyway. | **Do this, small.** Don't gate anything behind it. |
| 5 | **War World as F2P with cosmetics** | 0 in Y1 | High. Needs accounts, payments, moderation, scale, and a live-ops discipline a solo dev does not have. | **Defer past 12 months.** |
| 6 | **The war chest / treasury / marketplace as real currency** | — | **Very high.** Real-money in-game economies attract loot-box regulation (EU/UK/BE), chargebacks, RMT fraud, and a support burden. `treasury.ts` is an excellent *design* system. | **Do not.** Keep it soft currency, permanently. Revisit only if there is a company and a lawyer. |
| 7 | **Licensing the engine / sim tech** | — | Distraction. | **Only if someone approaches you.** Do not sell it. |

### 5.2 Pricing note

$14.99 is the right Ascendants price if the roster is 12+ and the creator persists. $9.99 if you ship lean. **Do not launch below $9.99** — sub-$10 signals "asset flip" on Steam and permanently anchors your DLC pricing. Discount later; you can never raise.

---

## 6. THE CONTENT ENGINE — the universe as a marketing department

You have something unusual: a world that writes about itself, at a scoped cost of **less than fifty cents a day** (#108). Most studios pay a marketing person for what this pipeline does automatically. Realize it in this order:

| Output | Source already built | Effort | Marketing value |
|---|---|---|---|
| **THE DAILY EDITION** — a generated newspaper of what players did yesterday, auto-posted to Discord + X + an RSS feed | `newspaper.ts`, blackbox, war ledger, #108 M2 | days | **Highest.** Endless, on-brand, free, and *only possible because the sim is deterministic.* It is also the thing that makes a persistent war feel persistent when the population is small. |
| **Shorts / clips** — 15–30s, announcer + generated score | GONET BROADCAST reels, the music library | ongoing, ~30 min/wk | High. This is how the arena fighter is sold. |
| **THE AUDIO DRAMA** — the five movements of `THE-LORE.md` (The Survey → The Sorting → The Harvest → The Factories → The War That Squanders The Clock) as five 20–35 min episodes | the lore doc is already written; you have `expressive-tts`, `gemini-fast-tts`, and ad-lab's music/voice scripts | ~2 weeks total | **Underrated.** YouTube and podcast platforms have essentially no game-marketing competition in narrative audio. The lore is genuinely strong — the blood economy, the jackals, the four-season farmer, the print who remembers wrong. This is the cheapest way to make people care about the universe before they play anything. |
| **In-world radio** — faction anthems, fake artists, DJs reading yesterday's press | Suno pipeline exists in ad-lab; #109 | days | Medium-high, and it doubles as in-game content. |
| **Web series / animated shorts** | — | weeks each | ❌ **Cut.** Wrong ROI by an order of magnitude. Rendered animation is where indie marketing budgets go to die. |

**Rule for this whole section: cap it at 4 hours a week of human time, and automate anything that recurs.** The Daily Edition should be a cron job, not a chore. The moment content production competes with development for your attention, it has failed.

---

## 7. MILESTONES

Each phase has a **gate** — a number that decides whether you proceed or change plan. Gates are not optional; they are the mechanism that stops you building for eighteen months into silence.

### 90 DAYS — *"Ascendants is a product people can play"* (by ~2026-10-21)

| # | Deliverable | Definition of done |
|---|---|---|
| 1 | **Ascendants public browser build** at its own domain + itch | Cold load → playable in **under 4 seconds** on a mid laptop, measured, not assumed |
| 2 | **Roster cut to 10–12, each excellent** | Every hero has a distinct silhouette, a distinct answer, and a 10-second clip that reads |
| 3 | **The IP scrub** (§4.3) | Zero public references to licensed characters; a design-lead sign-off on every silhouette and power name |
| 4 | **Steam page live** with trailer, screenshots, and a wishlist button | Page is up ≥ 4 months before launch |
| 5 | **ORIGIN creator shipped as a headline feature** with shareable build codes | A build is a string you can paste in Discord. No accounts required. |
| 6 | **Devlog cadence running** (daily clip / weekly post) | 12 consecutive weeks, no gaps |
| 7 | **Discord live** | `#builds`, `#clips`, `#bugs` |
| 8 | **War World: the asset diet** — delete the 216 MB of redundant WAVs, verify the OGG path, fix #32's blocking preload | `public/` under **25 MB**; first deploy does not block on audio |
| 9 | **War World: #108 M0 + M1 only** — determinism at 30 Hz, Node server, join-by-code | Two browsers, one fight, no divergence. **Then stop.** |

> **GATE:** 1,000 unique browser players and **2,000 Steam wishlists**. If wishlists are under 800 at day 90, the marketing is broken, not the game — fix the channel before writing more code.

### 6 MONTHS — *"Ascendants earns money"* (by ~2027-01-21)

| # | Deliverable | Definition of done |
|---|---|---|
| 1 | **Ascendants on Steam, $12.99–14.99**, on the existing Electron scaffold (`electron/`, `dist:win`) | Ships with controller support and Steam Deck Verified submitted |
| 2 | **Steam Next Fest participation** with the browser build as the demo | — |
| 3 | **CrazyGames + Poki live** | SDK integrated, ad rev-share flowing |
| 4 | **The campaign / progression spine** — the single biggest gap in an arena fighter | A reason to play tomorrow that isn't "fight again." Survival mode with meta-progression is the cheapest honest answer. |
| 5 | **War World: #108 M2** — co-op science missions, 2–4 friends | Private beta with 20 testers from the Discord |
| 6 | **THE DAILY EDITION v1** live, bot-posted to Discord | Runs on a cron, costs < $0.50/day, has a corrections box |
| 7 | **The audio drama, movements I–II** published | YouTube + a podcast feed |

> **GATE:** 7,000 wishlists at launch, **2,500 units in month one**. If month one lands under 800 units, the Steam channel is not working — pivot marketing spend to the portals and Discord and treat Steam as a long tail.

### 12 MONTHS — *"There is a company here"* (by ~2027-07-21)

| # | Deliverable | Definition of done |
|---|---|---|
| 1 | **Ascendants: THE JACKALS update** — War World gun combat lands in the superhero game | The mortals shoot back, and it's the best content beat you have |
| 2 | **Two hero packs** shipped, quarterly cadence proven | — |
| 3 | **War World: #108 M3 + M4** — accounts and server-authoritative PvP | The GONET login becomes real; the shared account bridges both games |
| 4 | **War World free browser alpha**, funnelled from Ascendants | Same account, same universe, one click across |
| 5 | **The audio drama complete** (I–V) | — |
| 6 | **The decision** | Based on twelve months of real data: pick the one product to go deep on and put the other into maintenance. Do not run two live games solo. |

> **GATE:** $40k+ cumulative revenue, 500+ Discord members, and a **D1 retention above 25%** on the browser build. If revenue is under $10k, this is a portfolio hobby with a great engine — which is a fine outcome, but plan accordingly and stop treating it as a business.

### The one number that matters more than the rest

**Day-1 retention on the free browser build.** Not plays, not wishlists, not commits. If someone plays Ascendants and comes back tomorrow, everything in this plan works. If they don't, nothing downstream — no Steam page, no lore, no newspaper — will save it. Instrument it in week one and put it on a wall.

---

## 8. THE HONEST RISKS

Ordered by how likely they are to actually kill this.

### R1 — "Too many systems, no core loop" — **the highest risk, and it's already happening**

**Evidence, from your own documents.** `THE-TOWN.md`: *"the gap is not content. It is CONNECTIVE TISSUE. Six real places exist and the player reaches every one of them through a list."* `THE-GONET.md` describes a desk that was reporting four invented numbers because the systems behind them didn't answer. `TEETH.md` is literally a document about five features that existed, had UI, had documentation, **and did nothing.**

You have built a racing league, a music library, a hoverboard trick economy, a certification register, a newspaper, a promotion board, a paintball mode, a track builder, a garage, a treasury, a clock, and a procedural city generator — in thirteen days — and there is still no answer to *"why do I open this tomorrow?"*

**The mitigation is behavioural, not technical:** stop building new systems until one game has 1,000 players. Every system built before an audience is a bet placed with the lights off. §9 is the specific list.

### R2 — The 265 MB browser game

Covered in §0. It invalidates the wedge for War World *today*. It is an afternoon's fix (216 MB of WAVs duplicating 14.4 MB of OGGs, plus issue #32's blocking preload of 460 files). **Fix it in the first week and then measure cold-load time in a real browser on a real connection**, because "we deleted the files" and "it loads fast" are different claims.

### R3 — The browser performance ceiling is real and documented

Your own perf board has the numbers: soldier bodies at **~60 draw calls each** (#37); up to **900 individual transparent splat meshes** (#34); roofs and second storeys at one mesh per tile (#33); per-client `JSON.stringify` as the rooms-per-core ceiling (#36). A mid-range laptop on WebGL2 realistically sustains **~1,500–3,000 draw calls at 60 fps**. Twenty-four soldiers × 60 draw calls = 1,440 *before* the world, the vehicles, or the effects.

**Implication:** War World's player counts are capped by the renderer, not the netcode, and that cap is lower than a persistent-war game wants. Ascendants doesn't have this problem yet (fewer entities, tighter arenas) — another reason it goes first. Batch/instance the soldier body before promising anyone a 32-player match.

### R4 — Multiplayer is the unbuilt half of War World's entire promise

#108 has six milestones and **zero of them are started.** A persistent war whose whole pitch is *"everything you do changes the next battle for everyone"* delivers none of that single-player. And population is brutal: Foxhole needs hundreds concurrent per shard to feel alive. A war with twelve people is a diorama. **This is the specific reason War World is not the launch product.**

### R5 — Discoverability

Steam ships roughly 40–50 new titles a day. Browser games have no algorithm to appeal to. Without a channel, a good game and a nonexistent game are indistinguishable. Your cheap answers are (a) build-in-public with genuinely remarkable receipts, (b) the HTML5 portals, (c) the CoH-diaspora audience who are *actively looking* for what you're building. Work all three. None of them is optional.

### R6 — Bus factor of one

75,507 lines, 221 files, 1,895 tests, one person. If you're out for a month, the project stops; if you're out for six, it's dead. The unusual mitigation you already have is that **the tests and the docs are the handover** — they are far better than typical, and a competent TypeScript dev could get productive from `docs/HARNESS.md`, `TEETH.md` and the test suite. Formalize it: identify one contractor, pay them to build and run the project once, and keep them warm. Costs a few hundred dollars; buys a company that survives a hospital visit.

### R7 — Velocity regression to the mean

257 commits in a day is not a sustainable operating point, and every milestone in §7 assumes the pace roughly halves. If you plan against the peak, every date slips and you'll read that as failure when it's arithmetic. **Plan against 40–80 commits a day and treat anything above that as slack.**

### R8 — IP exposure

Covered in §4.3. Internal shorthand naming heroes after Goku, Vegeta, Green Lantern, Vision and Cell is fine; publishing it is not. Fix before the first public build.

### R9 — Scope arithmetic

84 open issues, 16 of them `[EPIC]`, six tagged `needs-robert`. Every epic spawns issues. At the observed pace this is still months of work, and the board is *growing faster than it's closing* — 45 commits on 2026-07-23 and five new issues filed the same day. **An issue board that grows monotonically is a wish list, not a plan.** §9 cuts it.

---

## 9. WHAT TO CUT — the section that actually matters

The hardest discipline here is that almost everything below is *good*. Cutting bad work is easy. This is a list of good work that is on the wrong side of the launch line.

### 9.1 Cut or freeze in WAR WORLD (all of it, immediately)

| Cut | Issues | Why |
|---|---|---|
| **The racing league** — the Circuit, hull-to-hull collision, the track builder remainder, the record board as a priority | #131 #137 #138 #139 | This is a *second game inside a game*, and it is the clearest single example of R1. Keep the vehicle physics (they serve combat). Freeze the league. |
| **The walkable town hub** | #122, `THE-TOWN.md §2` | Right instinct, wrong year. It converts twenty menus into twenty buildings that must be modelled, lit, populated and pathed. Ship the menus with better framing and revisit after multiplayer. |
| **The outbreak / zombie layer** | #70 | A second genre bolted to a war game. Either it is the game or it is cut. It is not the game. |
| **The tablet / mobile build** | #128, `e42e119` | Real market, wrong time. Touch twin-sticks on a game with this input surface is a separate product with separate QA. |
| **169 nations at full data depth** | — | You need ~20 that matter and a lookup table for the rest. Nobody will ever read the other 149. |
| **48 civilian vehicles** | #94 | You need ~12. Cut the forklift, the cement mixer, the blimp, the hang glider, the golf cart, the crop duster. Each one is a model, a def, a Codex entry and a test — for a prop that drives past. |
| **22 secondary skills** | `skills.ts` | Pick 8. Twenty-two skills at +12% max is twenty-two things a player cannot feel. |
| **The 755 redundant WAVs** | #32 | 216 MB. Delete. |
| **The music library / headphones system** | `THE-GONET.md §4–5` | Genuinely lovely and it is already built, so leave it alone — but **do not extend it.** Zero acquisition value. |
| **THE-TOWN Tier 3** — cinema, radio station, barber, impound, gym, memorial-as-a-place | `THE-TOWN.md §3` | The memorial is the best idea in that document and it should be a *screen*, not a building. |

### 9.2 Cut in ASCENDANTS (before launch)

| Cut | Why |
|---|---|
| **Roster expansion past 12** | Depth per hero beats hero count in every fighting game ever shipped. Fourteen mediocre heroes lose to ten excellent ones. |
| **Cross-machine netcode** | Local 2P + bots is a complete product. Netcode is the single biggest sinkhole available to you and it does not gate revenue. |
| **City-scale arenas with police, if they cost frame budget** | The arena *is* the product. Do not let world simulation compete with combat for frames. |
| **The tabletop attribute layer expanding further** | Seven attributes on a ten-rank ladder is already more depth than the fight needs. Freeze it. |

### 9.3 Cut organizationally

- **Collapse 16 `[EPIC]` issues into 4.** An epic open for three days with no owner and no gate is a wish. Wishes belong in a doc, not on a board.
- **Close the `needs-robert` decision backlog in one sitting** (#75, #63, #67, #69, #71, #72, #130). Seven open decisions is the most expensive form of work-in-progress you have — every one of them blocks work and costs attention every time you read the board. Two hours, seven rulings, done.
- **Stop opening a `LOOP-LOG` entry per feature.** Ten of the last forty commits are docs about the other thirty. Documentation is load-bearing here and I'd normally defend it, but the ratio has tipped.

### 9.4 The meta-cut

> **Build no new system until one game has 1,000 players.**

Everything from here until the 90-day gate should be *finishing, polishing, cutting, and publishing* — not building. You have thirteen days of extraordinary output and zero days of player feedback. The next thirteen days are worth more spent on the second number than the first.

---

## 10. THE ONE-PAGE VERSION

| | |
|---|---|
| **Thesis** | Console-depth action that starts in 3 seconds in a tab, and generates its own news. Delivery is the wedge; depth is the retention; the universe is the marketing. |
| **Ship first** | **ASCENDANTS.** 1.48 MB, complete without netcode or accounts, legible in a clip, highest marginal return per dev hour. |
| **Ship second** | **WAR WORLD**, as the destination, once multiplayer and accounts exist. Same universe, one account, one funnel. |
| **Audience** | The City of Heroes diaspora and the arena-fighter clip audience buy Ascendants. The Jagged Alliance 2 audience buys War World. |
| **Channel** | Free in the browser (itch, CrazyGames, Poki, own domain) → paid on Steam via the Electron scaffold you already have. Build in public. Discord is home. |
| **Money** | Premium Steam $12.99–14.99 + portal ad rev-share + hero packs. **Never** real-money treasury. Break-even ≈ 500–950 units. |
| **Biggest risk** | Too many systems, no core loop — and it is already happening. |
| **Biggest cut** | The racing league, the walkable town, the outbreak layer, mobile, and 216 MB of duplicate audio. |
| **The number** | Day-1 retention on the free browser build. Instrument it this week. |

---

### A closing note, since you asked for honesty over flattery

The engineering here is not the problem, and it is not close to the problem. The sim is deterministic and CI-enforced, the balance table is measured rather than guessed, the build is 1.48 MB, and the pace is genuinely exceptional — those are real, verifiable, and rare.

**The problem is that you have been rewarded for building, and you have never once been rewarded for shipping.** Every one of the last 885 commits landed to an audience of one. The whole plan above is one idea in different clothes: get a game in front of a thousand strangers, find out what they actually do with it, and let that — not the backlog, not the lore, not the next great system — decide what gets built next.

You could keep going at this pace for another year and end up with the most impressive game nobody has played. Don't.
