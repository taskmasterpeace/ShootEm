# War World — Design Directive 01 (Rev 2)

**From matches to a war.** Every fight permanently matters. Grounded in real,
near-future military tech — and the exotic gear has to be *earned*.

- Prepared for: the dev team
- Classification: direction, not spec
- Presentation version: <https://claude.ai/code/artifact/dedca9ad-5780-420b-861f-748b5b80f9d2>

---

## 0. Situation

The game already has the fun part. Players spawn, fight, throw grenades, take a
point, win or lose. The problem is every match is an island.

We don't want players to feel like they *played a match*. We want them to feel
like they *fought a battle in a war that's still going*. The question the whole
team is solving: **how does every match permanently matter?**

> **Intel — we're closer than it looks.** The persistent-war features are mostly
> *saving and presenting things we already produce*. The sim already emits every
> kill, capture, death, class and weapon. We already hand out post-match honors
> (longest shot, top defender). We already record replays. The "career, medals,
> legacy" pillars are that same event stream — kept instead of thrown away at
> the scoreboard.

> **Constraint — one honest limit.** A truly global, shared war needs accounts
> and a backend we don't have yet — today it's offline-vs-bots plus LAN. So we
> build a **local-first war** that delivers the emotion offline now, shaped to
> sync to a server later. That decides the build order in §9.

---

## 1. Whose war is it? — Factions

The unanswered foundational question. Today "red vs blue" is assigned per match
and means nothing. The fix: **you don't pick a team. You enlist.**

| | **The Concord** | **The Meridian Pact** |
|---|---|---|
| Doctrine | Combined arms — armor columns, artillery superiority, air cavalry | Asymmetric & unmanned — drone swarms, EW, loitering munitions, raiding |
| Wins by | Mass and discipline | Precision and denial |
| Colors | Steel grey & cyan | Olive & amber |
| Tech lead | EM-gun line first | Drone program first |

*(Names are placeholders — rename at will; keep the structure.)*

**How enlistment works**

- **You sign for a tour** — one faction per campaign season. Your record,
  medals, and journal entries stamp the tour they were earned in.
- **Every match you play is fought for your faction.** Offline, bots wear both
  flags; you always deploy under yours, and your result moves your faction's
  fronts.
- **Doctrine is real:** your faction's tech tree, vehicle skins, and unlocked
  prototypes differ.
- **Defection is allowed between tours — and it's recorded.** "Two tours
  Concord, then crossed to the Pact" is a story your dossier tells forever.
- **The outbreak (§8.3) belongs to no one.** Quarantine ops are a joint task
  force — the one place both flags fight side by side; your containment record
  credits your faction.

> *You're not on a team. You're in an army. The difference is that an army
> remembers you.* — design north star

---

## 2. Setting — advanced, not sci-fi

A present-to-near-future conventional war on Earth. "Advanced tech" means
today's cutting edge and the next decade: drones, loitering munitions,
networked fires, EW, thermal optics, active protection. If a defense contractor
isn't building it, it isn't *standard issue*. (The exotic stuff still exists —
behind glass. See §6.)

| Current (sci-fi) | Grounded equivalent | Verdict |
|---|---|---|
| Jetpack trooper | **Jet-suit operator** — Gravity Industries suits are real; elite & rare | keep, reskin |
| Cloak / Infiltrator | **Adaptive + thermal camo** — harder to detect, not invisible | rework |
| Ghost / EMP / drone | **EW operator** — jamming, counter-drone, ISR quadcopter (all fielded) | keep |
| Pathfinder / warp beacon | **Pathfinder** + fast-rope insertion instead of teleport | rework |
| Orbital strike | **Call-for-fire** — artillery, airstrike, loitering munition | reskin |
| Railgun / plasma / impulse | **Prototype Program** — locked behind the war (§6) | gate it |
| Solar-system themes, low-g | **Earth theatres, standard gravity** (§8.2) | reskin |

Rifles, LMGs, DMRs, snipers, autocannons, ATGMs, mortars, tanks, IFVs,
flamethrowers, smoke, frags — already realistic. They stay.

---

## 3. The war, in three systems

These three cover all ten pillars from the original brief — and they're
inherently military-realistic: real armies keep records, award decorations, and
fight named campaigns.

### System A · The Record — identity, career, medals, legacy
A persistent soldier dossier: service history, lifetime stats, class mastery,
and **decorations earned from real events** — Iron Defender for holding a
point, Tank Killer for armor kills, a Purple Heart for surviving near-death.
Medals and rank ride the dossier and show on your soldier in-match. Works
entirely offline.

### System B · The War Journal — story, not just stats
After each match, mine the event log for the **narrative**: "Held Bridge Delta
14 minutes against a company-strength assault." Each entry links to its replay
clip. Two players with identical K/D get completely different histories. This
is the retention engine.

### System C · The Living Campaign — a war your matches move
Campaign state (local first) with named **fronts**; each match nudges
ownership, gates which maps/modes are live, escalates difficulty, and scars
maps permanently — a bridge you blow stays blown. You log in to "the Eastern
Front fell overnight," not a map list.

---

## 4. Blast physics & the grenade — combat feel

Explosions should move people. Today they only subtract HP.

> **Intel — the machinery already exists.** The sim already has a knockback
> pipeline (blast shove scaled by distance, victims popped airborne, power
> armor immune) — **but only one weapon uses it.** Grenades, rockets, cannon,
> artillery all set knockback to zero. This is a data + tuning pass, not an
> engine build.

### 4.1 Blast knockback — *build next*
- **Every splash weapon shoves.** Frag ~12, GL ~10, rocket ~14, tank cannon
  ~18, artillery ~22 — scaled by distance from center, capped so it's drama,
  not pinball.
- **Survivors stumble:** shoved, briefly off-aim, screen kick. **Kills
  launch:** the ragdoll already tips away from the killing blow — blast kills
  get the full send.
- **Airburst pop:** anyone inside the inner radius gets lifted — clearing a
  trench with a well-cooked frag should *look* like it.

### 4.2 The throw — ✅ SHIPPED (`b722960`)
The proven top-down mechanic, live in the game now:
- **Hold G to aim:** the sim's exact flight arc (dashed) + a splash ring on the
  landing point — the cursor, clamped to max reach (22u). Release to throw.
  Verified in-game: the frag detonates **0.09u** from the previewed ring.
- **All throwables cursor-target** through one clamp: frag, orbital designator,
  demo charge, warp beacon, EMP. **Bots too** — their frags land ON you now.
- Still to add from this section: **cooking** (fuse burns while held),
  **bounces** (bank through doorways), **throwback/dive-on** heroics.

---

## 5. Combat systems on the table

### 5.1 Anti-air — aircraft must sweat — *build next*
Flyers currently soar untouchable. Add the predator/prey loop: **MANPADS**
(shoulder-fired IR missile), a vehicle **SPAAG/SAM**, and radar **SAM sites** —
guided missiles with a lock-on tone. Aircraft counter with **flares**,
**chaff**, **terrain-masking**, and flying nap-of-the-earth.

> **Rule — the missile is a hair slower than the plane.** Missile top speed
> sits **~8% under** aircraft top speed. A pilot who commits — burns straight,
> pops a flare on the right beat — *just barely* outruns it. Panic and turn,
> and it closes. Skillful to fly, heroic to shoot down. Escape is a margin, not
> a guarantee; that margin is the whole game.

### 5.2 The Breacher — depth is stealth — *build next*
It *does* grind walls already; it just doesn't feel like it. Grounded model: an
**armored breaching vehicle** (think the armored D9). First pass: spinning
cutter, looping grind, faster chew, screen-shake, IED clearing.

Then the real mechanic — **the breacher can dig down, and depth buys silence:**

```
 SURFACE ────────────────────────────────────────────────
 SHALLOW (detectable):  ))) seismic rumble · dirt breaks
                        · pinged on the minimap
 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  depth threshold ─ ─ ─ ─ ─ ─ ─ ─ ─
 DEEP (undetectable):   silent · off minimap
                        · but slower and blind
```

Shallow: everyone knows something's coming. Deep: nothing — but you're slow
and blind. **The trade is the fun.** Counter-tunnel seismic sensors are real;
so is the drama of the ground opening up behind your lines.

### 5.3 Working dogs — *proposed*
A real capability that earns its slot as the **counter to stealth**: a Malinois
K9 that sniffs out camouflaged operators and explosives and marks them. Fast,
fragile, pack logic — reuses the existing chase AI.

### 5.4 Drones & ground robots — *proposed*
All fielded today: ISR quadcopters, strike drones, loitering munitions
(Switchblade), UGVs (Ripsaw/THeMIS, robot dogs). These are **the Meridian
Pact's doctrine** and the visible reward of §6 — hold the right fronts and your
faction's machines roll onto the field.

---

## 6. The Prototype Program — sci-fi behind glass

Don't delete the exotic tech. **Lock it behind the war.** The railgun, the
jet-suit squad, the drone swarm — these are prototypes, and prototypes have to
be earned, escorted, and kept alive.

- **The scientist is the tech tree.** Dr. Voss — already in the game via
  safehouse mode — becomes the head of your faction's weapons program.
  **Protect-the-scientist missions ARE research:** every successful defense or
  extraction banks research points for your faction.
- **Fronts gate fields:** hold the Airbase → aviation prototypes. Hold the
  Refinery → thermobarics. Hold the Lab district → the EM gun. Lose the front,
  the program stalls.
- **Prototypes are rare by design:** limited field-trial issue — one EM rifle
  per squad, one jet-suit per operation. Losing one is a Journal entry. Using
  one well is a medal.
- **Doctrine forks the tree (§1):** Concord unlocks the EM-gun line first; the
  Pact unlocks the swarm line first. The war decides who gets the future.

> *Standard issue is real. The future is a reward.*

---

## 7. Command — rank with teeth

Rank shouldn't be a badge. It should be **decisions**. And the chain of
command — the thing armies invented because people go missing — is also the
answer to "who's online?"

### 7.1 Officers choose things
- **Pick the front:** ranking officers choose where the faction attacks next —
  which maps/modes are live this session.
- **Name operations:** officers commission and *name* them — "Operation Black
  Ice" goes in every participant's service record forever.
- **Spend faction resources:** call a supply drop, unlock a vehicle pool for
  the op, greenlight a prototype field trial (§6).
- **Standing orders:** an officer's priorities persist while they're offline —
  bots and objective weighting follow them.

### 7.2 Relief of command — yes, you can take out your commander
Not a knife in the back — a **challenge on the field**. Any officer one grade
below can call a **Relief of Command**: a live operation where the challenger
attacks and the incumbent defends. Winner holds the rank; the whole thing —
challengers, defenders, the deciding play — is written into both War Journals.
Command trials generate the best stories in the game, and nobody gets
team-killed to do it.

### 7.3 The chain solves "who's online"

> **Insight — armies solved offline players centuries ago.** You can't know
> who'll be online. Neither can a real army — that's *why the chain of command
> exists*. If the colonel is absent, the major commands.

- Command powers always devolve to the **highest-ranked player present**.
- **Standing orders** cover the gaps.
- When you return, the **Morning Dispatch** — a War Journal digest — tells you
  everything your faction won, lost, and named while you were gone.

```
 COL Vasquez        MAJ Okafor              CPT Reyes
 [ OFFLINE ]  ───►  [ ONLINE·IN COMMAND ]   [ ONLINE·NEXT UP ]
```

---

## 8. Vehicles → missions · Terrain · The outbreak

### 8.1 Too many vehicles? Give each a mission
Missions bridge the vehicle roster and the war: each is a match with a job, and
its result feeds a front.

| Mission | The job | Vehicles that star |
|---|---|---|
| Armored Push | Break a dug-in line and hold ground | MBT, IFV, breacher, SPAAG |
| Convoy Escort | Move a transport across contested road, intact | transport, MRAP, buggy, attack helo |
| Air Interdiction | Own the sky / deny it — §5.1 as a mode | helo, drone, SAM, MANPADS |
| Breach & Clear | Open a fortified compound room by room | breacher, engineer, K9, UGV |
| Extraction | Reach a downed crew and get them out under fire | ambulance, helo, transport |
| Counter-Battery | Find and kill the guns shelling the front | recon drone, self-propelled artillery |
| Field Trial | Escort a prototype to the front — or steal the enemy's (§6) | whatever the program issues |

### 8.2 Terrain
Design maps as named fronts, several built to change with campaign state. Real
theatres, standard gravity:

- **Bridge Delta** — river chokepoint; blow the span and it *stays* blown,
  rerouting the next battle.
- **Fort Raven** — entrenched strongpoint siege; home of the Iron Defender medal.
- **Eastern Plains** — open farmland, armor country, long tank/ATGM duels.
- **The City** — dense urban, room-to-room, rubble that persists.
- **Highland Pass** · **Blacksite (Arctic)** · **Refinery** · **The Port** ·
  **Airbase** · **The Mine** — the breacher's map.

**Water & boats:** water tiles already exist in the engine (the skiff crosses
them). Verdict: **one assault boat + one amphibious mission (The Port)** — not
a naval layer. Big-water combat is a different game.

**The neighborhood already exists:** safehouse mode's searchable houses are the
"maze of rooms" — reuse for Breach & Clear and grenade-bounce gameplay.

### 8.3 The outbreak, grounded
Zombies can't be grounded — so reframe the PvE horde as a **CBRN/bioweapon
quarantine**: contaminated hostiles, hazmat teams, containment zones that
spread on the campaign map and threaten *both* coalitions. It stays canon, it
feeds the campaign, and it's the one theatre where the flags fight together.
The classic zombie mode stays as an off-canon arcade toggle for fun.

---

## 9. Build order

Each phase ships and is fun on its own. Local-first, then lift to a server for
the shared global war.

| Phase | What ships | Why now | State |
|---|---|---|---|
| This week | ~~Cursor-targeted grenade throw~~ ✅ (`b722960`) · Blast knockback (§4.1) · Breacher feel + depth-stealth (§5.2) · SAM/MANPADS loop (§5.1) | Combat feel — visible in the first minute of play | in progress |
| Slice 1 | The Record + War Journal, on the existing event stream | Offline, no backend, reuses awards + replays — biggest emotion, smallest build | spec ready |
| Slice 2 | Factions + Living Campaign (local): enlistment, fronts, missions, Prototype Program | Turns matches into a war with a flag on it | proposed |
| Slice 3 | Command: officer choices, named operations, relief of command, devolution | Needs ranks (Slice 1) + campaign (Slice 2) to mean anything | proposed |
| Slice 4 | Lift campaign + dossiers to a shared backend | The true global war — same state, now shared | later |

---

## 10. Screens — inventory & redo priority

Every player-facing screen, ranked worst-first. The combat sim outclasses the
menus around it; for a paid product the storefront has to match the game.

| # | Screen | Score | Verdict |
|---|---|---|---|
| 1 | Deployment / selection menu | 35% | **Redo — the big one** |
| 2 | Map setup | 0% | Doesn't exist — build the map generator here |
| 3 | Settings | 0% | Doesn't exist — mandatory for a paid product |
| 4 | Post-match / scoreboard | 45% | Redo second — it's a plain HTML table |
| 5 | Multiplayer connect | 25% | A raw `ws://` text box inside the menu |
| 6 | Respawn / K.I.A. + killcam | 55% | Bare "K.I.A." text; small polish pass |
| 7 | Chat / comms | 70% | Works, needs styling pass only |
| 8 | Combat HUD | 85% | Fine — killfeed, vignettes, equip chips all good |
| 9 | Harness + Sound Lab (dev tools) | 90% | Internal, done |

### 10.1 Why the deployment screen scores 35%

It's one endless vertical scroll of eight stacked sections — and the worst part
is the Armory: **200+ weapons in two native `<select>` dropdowns.** That's a
spreadsheet, not an armory. Classes are emoji + text cards with no soldier
preview — even though the game already has full 3D soldier models and the
harness literally renders them spinning on a turntable. All the ingredients
for a great screen exist; they're just not used here.

### 10.2 The redo — a tabbed flow

`DEPLOY | CLASS | ARMORY | MAP` (+ a reserved `BARRACKS` slot, see 10.3):

- **Class tab:** live 3D soldier preview (reuse the harness turntable), gear
  list, class stats.
- **Armory tab:** browsable weapon cards with stat bars (DMG / ROF / RANGE)
  instead of dropdowns, filtered by family.
- **Map tab:** the map generator — cheap to build, because `generateMap(seed)`
  is already deterministic and the minimap renderer already draws top-down
  maps. Seed field + 🎲 reroll + live minimap preview + theme/mode pickers.
  Pick the battlefield you like *before* deploying.
- **Deploy tab:** summary card + match setup + the DEPLOY button.

### 10.3 Billing readiness — the two hard gaps

Since the plan is to charge: **Settings (0%)** and **accounts/identity** are
the non-negotiables people expect from a paid game.

- Settings needs volume / video / keybind display at minimum — the per-sound
  volume persistence already exists, it just has no player-facing screen.
- The redesigned menu should **reserve a Barracks/Record tab slot** — that's
  where the service record, medals, and (eventually) purchases live, so the
  tab architecture anticipates it now instead of being rebuilt later.

### 10.4 Recommended order

1. **Deployment screen rebuild** (tabbed, 3D class preview + armory cards +
   map generator tab) — the storefront. Build the tab shell + map tab first
   (fast, immediately visible), then class preview and armory cards.
2. **Post-match AAR screen** — the trophies roll deserves better than a table,
   and it's where the Record/Journal retention systems (§3) plug in.
3. **Settings screen** — small but required.
4. **Respawn/killcam + chat polish** — quick pass, same visual language.

---

## Appendix A — Field status

- ✅ **Cursor-targeted throws shipped** (`b722960`): hold-G arc + landing ring,
  0.09u landing accuracy, all throwables + bots, 170 tests green.
- ✅ **Invisible walls verified fixed:** live-map probe — all solid tiles
  rendered or prop-covered; 0 invisible, 0-by-construction across every theme.
- ✅ **Knockback pipeline exists** in the sim (blast shove, airborne pop, armor
  immunity) — explosives just don't use it yet. §4.1 is data + tuning.
- ✅ **Water & neighborhood** already in the engine (water tiles, safehouse
  houses).
- ✅ **Audio:** 56-sound ElevenLabs pack, loudness-leveled, rifle & growl
  variety, review/replace tooling (`/sound-review.html`).
- ⚠️ **Decide:** faction names/doctrines (§1) are placeholders — rename at
  will; keep the enlistment/tour mechanics.
