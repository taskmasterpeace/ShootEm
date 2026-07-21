# FORM P-1 — PATTERN REGISTRATION
### The Enlistment Office · the Pattern · the personas of everyone who fights
**Robert, 2026-07-21:** *"The body is a printout. This form is the person."* This document is the planning doc he asked for: the character-creation system, the bot personas it also powers, and the generated-voice pipeline underneath — **the thing nobody else can ship, because nobody else has per-player generated VO.**

**Status: DESIGN (build order: enters EXECUTION-ORDER after B10 VO wave 1 — the pipeline it rides).**
**Related law:** [VO-CATALOG.md](VO-CATALOG.md) (triggers + anti-spam + manifest) · [SQUADS.md](SQUADS.md) §5 (where personas talk) · the *Consequences of Failure* universe (factions from Robert's spreadsheet — placeholders until he names them).

---

## 1 · THE LORE FRAME — what survives the vat

Already decided in this universe: **you clone the character, not the gun.** So what exactly survives reprinting? Not the body — the body is a printout. What persists is the **PATTERN** — the person. Mind, voice, attitude, memories.

- Enlistment doesn't scan your body. It **records your Pattern**: who you are, where you're from, how you talk, what you fear.
- Every reprint is the same person waking in a fresh body. **PRINT #7 OF ODETTE BAPTISTE.** Same voice. Same opinions.
- **Clones remember dying.** The death counter already ships (`deaths`, print numbers, "REPRINTED — PRINT 4" notices) — it becomes a *dialogue trigger*: "That's the third time that man done shot me. Lord, give me strength."
- **Persona is orthogonal to class.** The class is her *job*. Class gives the verbs; the Pattern gives the voice. This is exactly why the old-lady infiltrator works — *nobody suspects grandma. She's been moving quiet since Sunday church.*

## 2 · THE INTAKE — diegetic, not a character creator

Not a menu. An **ENLISTMENT OFFICE**: a stencil-and-typewriter intake form in the tactical-terminal look (Saira Stencil headers, Share Tech Mono fields, hard edges, the stamp-and-carbon-paper energy). Seven questions. **All picks, no essays** — the only things ever typed are a place name and (optionally) one word for an unlisted job.

| # | Question | Input | What it drives |
|---|---|---|---|
| **Q1** | NATION OF ORIGIN | pick on the world map (real countries) | base dialect family, idiom bank |
| **Q2** | WHAT CITY? | one short typed field (`MIAMI GARDENS`) | **the accent down to the neighborhood — THE HOOK.** The voice pass resolves place at *city* level: Miami Gardens comes back sounding like Miami Gardens, not "generic Florida." New Orleans ≠ Baton Rouge. Belfast ≠ Dublin. The "wait — it KNOWS?" moment is the whole feature |
| **Q3** | AGE | dial, 18–75 | voice age, energy, what they compare things to (a 68-year-old and a 19-year-old do not describe a firefight the same way) |
| **Q4** | GENDER | Woman / Man / self-describe | voice cast |
| **Q5** | ETHNICITY | Black / White / Latino / Asian / Middle Eastern / Indigenous / mixed / self-describe / **skip** | cultural texture in the *writing*, handled by the author pass **with dignity — never caricature**. Skippable; the voice still builds |
| **Q6** | WHAT DID YOU DO BEFORE THE WAR? | pick one or type one word: Nurse · Preacher · Truck driver · Corrections officer · Line cook · Schoolteacher · Mechanic · Farmer · Fisherman · Rideshare driver · Mail carrier · Elevator inspector · Church organist · Barber · Debt collector · Bouncer · Librarian · Athlete (washed) · Musician (unpaid) · *Nothing, and don't ask again* | **the metaphor bank** — the ex-nurse calls your wound "a scratch, I've seen scratches"; the ex-elevator-inspector won't certify the bridge you're standing on |
| **Q7** | HOW DO YOU FEEL ABOUT DYING? | pick one | **the reprint-humor dial** (see below) |

**Q7 options (gates every death/reprint line):**
- **"Don't remind me."** → the character never mentions reprinting. *(default — the no-spam guarantee)*
- **"It's a paycheck."** → dark reprint jokes on respawn: "Why'd I die again? …oh. I'm back."
- **"Every print is a blessing."** → grateful, faintly unsettling.
- **"What happens in the vat stays in the vat."** → full denial comedy.

## 3 · WHO GETS A PATTERN

**Everyone.** Right now (Robert's call): **allowed for everybody** — persona *depth* may become premium later; the base personas ship free.

1. **The player's character** — authored via FORM P-1 at account/character creation.
2. **The bots** — the classes already exist, so **each class ships with authored default Patterns** (the "other personalities" Robert wants filled). A bot IS a filled-in P-1 form: same fields, authored by us instead of the player. Same pipeline, same triggers, zero special cases.
3. **Later:** squadmates are hand-picked Patterns (SQUADS §5); the faction leaders (backlog 3.7) are premium-authored Patterns.

## 4 · THE STARTER CAST — authored bot Patterns (ideas for Robert to pick from)

The flagship, from Robert directly: **Miss Odette Baptiste** — 68, New Orleans (Tremé), church organist before the war, **infiltrator**. A badass elderly Black lady, written with total dignity: warm, unhurried, lethal. *"Nobody suspects grandma."* Reprint attitude: "Every print is a blessing." — "Third time that man done shot me. Lord, give me strength."

And the tone-north-star: **Meltdown (Jagged Alliance 2)** — Robert's all-time favorite because *she's mean.* One cast slot is always the mean one.

| Class (job) | Pattern sketch | The voice hook |
|---|---|---|
| Infiltrator | **Miss Odette Baptiste**, 68, New Orleans, church organist | moves like Sunday service; deadliest voice is the gentlest |
| Infantry | **The mean one** (Meltdown homage), 34, Philly, ex-corrections officer | insults as suppressive fire; never satisfied, never quiet — but P1-tier barks only, mean ≠ spam |
| Medic | 51, Manila, ex-nurse | "That's a scratch. I've SEEN scratches." Triage deadpan |
| Engineer | 45, Cleveland, ex-elevator-inspector | certifies nothing: "I wouldn't ride that bridge, and I *inspected* bridges" |
| Heavy | 29, Apia, ex-bouncer | softest-spoken giant; counts to three exactly once |
| Pathfinder | 22, Lagos, ex-rideshare driver | narrates routes like pickups: "two minutes out, don't make it weird" |
| Marksman | 60, Tromsø, ex-fisherman | patience metaphors; weather-reads the battlefield |
| Officer | 47, Zürich, ex-debt-collector | "everyone pays eventually" — the ledger voice |

*(Sketches are pickable/replaceable — Robert strategically chooses or swaps; exact class mapping locks at build. Every one is written by the author pass with dignity: people, never caricatures.)*

## 5 · THE PIPELINE — form → person → voice

1. **P-1 answers → the PATTERN CARD** (a small JSON: nation, city, age, gender, ethnicity?, job, deathAttitude + derived dialect/idiom/metaphor banks). Deterministic, portable, tiny.
2. **The AUTHOR PASS** (LLM, offline batch): Pattern Card + the VO-CATALOG trigger table → a personalized line set (~380–450 lines per VO-CATALOG §4's variant counts), written in-voice: city idiom, age energy, job metaphors, death-attitude gating. Dignity guardrails are hard rules in the author prompt.
3. **The VOICE PASS** (Gemini TTS via `expressive-tts`/`gemini-fast-tts`): city-level accent resolution (Q2's hook), age + gender casting, the War World radio post-FX. ~$1–4 per full character set (VO-CATALOG §1 estimate).
4. **The MANIFEST** (VO-CATALOG §4 naming: `vo/<pattern-id>/<trigger>_<variant>.ogg`) — recastable: re-run the manifest, keep the person.
5. **Runtime**: the existing voice bus + P0–P3 anti-spam doctrine (VO-CATALOG §3) — Patterns make lines *personal*, the doctrine keeps them *rare*. Reprint-memory lines ride the existing death counter, gated by Q7, capped at ~1 per 3 deaths so the joke never wears out.

## 6 · GUARDRAILS (hard rules)

- **Dignity law:** ethnicity/city/age color the *writing* via the author pass — never accent-mockery, never caricature. Q5 is skippable and the voice still builds. Self-describe fields are honored verbatim.
- **The default is silence:** Q7 defaults to "Don't remind me" — a player who never touches the system never hears a reprint joke.
- **Anti-spam is inherited, not reinvented:** every Pattern line maps to an existing VO-CATALOG slot with its tier + cooldown. Personality changes WHAT is said, never HOW OFTEN.
- **Class barks stay canonical:** P0 combat-critical calls (MISSILE LOCK, GRENADE) keep meaning-first wording — the Pattern flavors delivery, never garbles information.

## 7 · MONETIZATION HOOKS (noted, not designed — Robert's call later)

- Base Patterns free for everyone (his current call). Possible premium: extra Pattern slots, the full custom author+voice pass, re-registration.
- **Charge-to-WIPE a character** (his earlier idea) only works because the Pattern makes the character endearing — this doc is that feature's foundation.

## 8 · BUILD PLAN

| Slice | What ships | Depends on |
|---|---|---|
| **P1** | The Pattern Card data model + FORM P-1 as the diegetic Enlistment Office screen (menu tab, stencil-typewriter look); answers saved to the Dossier | nothing — pure client + storage |
| **P2** | The authored starter cast: 8 bot Patterns as filled P-1 forms; bots display their Pattern name/origin on hover/killfeed/AAR | P1 |
| **P3** | The author pass + voice pass for the starter cast via the VO manifest (the first *heard* Patterns) | B10 (VO wave 1 pipeline) |
| **P4** | The player's OWN generated set (the per-player VO moment — the killer feature) + reprint-memory lines on the death counter | P3 |

*Filed 2026-07-21 from Robert's voice directive. The FORM P-1 text above is his draft, kept nearly verbatim — it's already right.*
