# The Secretary of War — 3 Approaches

> **Recovered 2026-07-22** from session `51589d3a` for Robert's read.
> The pitch's recommendation was **#3 THE GOVERNMENT**.
> The decision is **OFF-1** on the Decision Desk / issue **#75**.

Three ways to build the chain of command — one spine, three feelings. Each already works in the single-player game **today** and blooms when the game is a hit. Pick the feeling; they can braid later.

The three approaches are genuinely different *philosophies* for what the chain-of-command IS:

1. **THE CLIMB** — it's one ladder *you* ascend (power fantasy).
2. **THE WAR ROOM** — it's three different *games* under one war (play the layer you love).
3. **THE GOVERNMENT** — it's a *political sim* with a public ledger, a press, elections and coups (the war grows a soap opera).

## The command chain

| Tier | Seat | Does |
|---|---|---|
| Top · Strategy | **Secretary of War** | treasury %, priority front, doctrine |
| Middle · Front | **Theater Commander** | runs one front's operations |
| Boots · Match | **Operation Officer** ▮ LIVE | buys the match manifest — **this rung already ships** |

**LAUNCH ORDER →** AI doctrine · human officers · public ledger · safeguards · elected Secretary

---

## 01 · THE CLIMB

*One ladder — and **you** climb the whole thing, from a match's loadout to steering the entire faction's war.*

**Now · single-player** — A strategy career. You start where the game already puts you — the Operation Officer buying a match's manifest. Earn certification → promoted to **Theater Commander** (pick which AI ops launch on your front + the standing orders your bots obey) → then **Secretary** (treasury %, priority front, doctrine, and all ten fronts bend to your call). The AI holds every seat above you until you earn it; the war never waits.

**When it's a hit** — Seats go contested. Highest-ranked player present holds each seat; one grade below can **Relieve you of Command** by beating you in a live op; the Secretary is elected. Same climb — now humans above and below you.

**★ The fun** — Grunt to warlord, and you **see** the power grow. The day you first set faction doctrine and watch ten fronts reshape is the hook. *"I named this operation and forty people ran it."*

**⌁ First slice** — Add **one rung** above the shipped planner: earn Theater Commander → a Front Orders screen that chooses the AI op on your front + one squad standing order. Proves "my strategic call changed the firefight" with two rungs.

**BUILDS ON:** command-cert ladder (already tops out at "Operation Officer") · rank + insignia · the Scar map · the shipped Operations planner

---

## 02 · THE WAR ROOM

*Not a ladder — three different **games** sharing one war. Log into the layer you love that day.*

**Now · single-player** — Three screens, one war. **Secretary** is a slow grand-strategy board (treasury sliders, doctrine cards, a priority-front map). **Theater Commander** is a front-level RTS (launch ops, set standing orders, pour clones). **Operation Officer** is boots-on-ground — the shipped planner + the right-click **command wheel** to order your squad mid-match. Solo, you hop between all three; the AI runs whatever you're not touching.

**When it's a hit** — Players **main** different layers. Strategy brains live in the Secretary seat — async, like a guild leader who never undocks. Tacticians run theaters. Most players are boots. EVE-nullsec energy: the spymaster who never fires a shot and the trigger-puller share one war — and the Secretary's doctrine literally changes what soldiers can buy this week.

**★ The fun** — The game becomes **many games under one roof**. A Paradox brain and a twitch-shooter both have a home — and their choices land on each other.

**⌁ First slice** — Build the **command wheel** (E1 — your own idea) for the boots layer, plus a minimal Theater screen whose front-orders decide what the AI launches. Two layers talking is the whole proof.

**BUILDS ON:** the command wheel (E1) · the shipped planner · coalitions (matchmaking) · the front / Scar map

---

## 03 · THE GOVERNMENT  ← recommended

*The chain is a **government with drama**. The launch order — AI → officers → ledger → safeguards → elections — **is** the arc of the faction's society.*

**Now · single-player** — A political career inside the war. AI officers get COF-lore faces, generated voices, and agendas. Every command spend is **public** — the newspaper reports it (and spins it per faction). Your reputation rises and falls on your record. You challenge incumbents, climb, and eventually **run for Secretary** against AI rivals who don't want to lose the seat.

**When it's a hit** — A player-run government. Real **elections**. Real **coups**. Ledger scandals the player-press breaks. The elected Secretary is someone your faction actually voted in — and can depose. Persistent-world faction politics with teeth.

**★ The fun** — The war grows a **soap opera the players write**. *"Our Secretary torched the clone budget, the paper caught him, we're voting him out — and I'm running."* Reputation, betrayal, redemption, revenge.

**⌁ First slice** — Wire the shipped **war ledger** into the shipped **newspaper** as a War Cabinet report card — who spent what, who won or lost their front — plus a reputation stat on the dossier. Transparency first; the drama follows on its own.

**BUILDS ON:** the war ledger · the Front Courier newspaper · COF lore + voices · ranks

---

## The spine already under you

None of these starts from zero. The **Operation Officer's planning phase** (treasury / ammo / hulls / support, with commitment + cost readouts) already ships — that's the bottom rung, live in the game. So does the **war ledger**, the command-cert ladder that already ends at the title **"Operation Officer,"** the **Front Courier** press, rank + insignia, and coalitions. Every pitch bolts onto working systems.

## And they braid

**The Climb** is the progression. **The War Room** is the surface area. **The Government** is the drama. A hit game probably wants all three eventually — but the **spine you commit to first** decides what the game *feels* like on day one. Pick the feeling, and I'll build the first slice.

---

## The recommendation (verbatim from the session)

> **My pick, if you want a POV:** lead with **The Government (03)** as the spine. It reuses the most already-shipped systems (the war ledger + the Front Courier newspaper + ranks) so the first slice is *cheap* — a "War Cabinet report card" in the paper + a reputation stat — yet it's the one that generates **stories players tell each other**, which is exactly what makes a strategy layer go viral when the game hits. It's great solo (a political career against AI rivals) and it's the truest reading of that launch-order line.
>
> Then bolt **The Climb's** progression on as the skeleton (clearest "what do I do next"), and save **The War Room's** role-specialization for the multiplayer expansion. They braid — but the spine you pick decides the day-one *feeling*.

---

## Appendix — where "officer" stands today (the 14:49 synthesis, same session)

The word "officer" is quietly doing **six** different jobs; three are shipped, three are still just talk.

**Shipped:** the OCS / ENLISTED / DRAFTEE fork at the 3-match review (`onboarding.ts`) · the commission gate `isCommissioned()` = took OCS or ≥ 8000 rank points (decision D2: "earned by record, never bought") · the Stable — the officer's V channel for LSW call-ins · `officer.ts` (the class-change judge) · rank ladder + officer insignia (Private→Colonel) · the Command-Certification ladder topping out at the earned title **"Operation Officer"** · the Operation Officer's planning phase at the Scar (`operations-ui.ts`, `operations.ts`) · the bot officer (AI-only factions auto-call LSWs) · the underfunded-victory morale beat.

**Discussed, not built:** the Secretary of War 3-layer chain itself (explicitly carved *out* of the shipped Operations release — `META-LAYER.md`) · the right-click command wheel (E1) · §7 "rank with teeth" (`DESIGN-DIRECTIVE.md`: name operations, standing orders that outlive logout, command-qualification course, Relief of Command, chain-of-command devolution) · safeguards/audit · elected Secretary · voiced faction leaders (W3.7) · officer clone-allocation to fronts.

**The one thing worth knowing:** the "officer" plumbing exists in **three disconnected places** — the OCS flag, the rank-point line, and the command-cert ladder — and the design *intends* to unify them but the code hasn't. The shipped Operations planner isn't gated by `isCommissioned`, and rank/commission don't yet grant any of the §7 command powers. The scaffolding is there; the "being an officer actually means something" layer is the unbuilt part.
