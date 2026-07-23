# QUESTIONS FOR ROBERT — the forks that actually change what I build

> *"Ask me questions that will have the most impact, or guide us to where we
> need to be."*

I've built a lot of systems into this game. Reading them back, the thing that
stands out is not that anything is missing — it's that **I don't know what a
session looks like.** Almost every question below is a version of that.

**How to use this:** each question has my current best guess. If the guess is
right, say "yes to 3" and I'll build on it. If it's wrong, correcting it is
worth more than a long answer. The ones marked ⚑ are the ones I'd most like
answered before I build anything else.

---

## ⚑ 1. What does a good 45 minutes look like?

This is the big one and everything else is downstream of it.

Right now the game contains: a war with four modes, military operations,
science missions, an outbreak, a paintball yard, a racing league, a threat
room, driving schools, a garage, a track builder, a laptop with eight apps,
and a handheld with cartridges. **Every one of those is real and none of them
knows about the others.**

A player sits down. What happens? Walk me through it like you're describing
someone else playing.

**My guess:** you log into the GONET, read what changed since yesterday (mail,
the front, the news), pick one thing off the board — a briefed operation most
nights — fight it, come back, and the world has moved because of it. Fifteen
minutes of laptop, thirty of fighting.

**What changes:** if that's right, the laptop is the hub and I should make the
*consequences* land there. If it's wrong — if you want people to launch
straight into a fight — then the laptop is over-built and I should thin it.

---

## ⚑ 2. Is this single-player-with-a-living-world, or is multiplayer the point?

I've been building as if a single player is the audience: bots fill the war,
the world clock derives from UTC with no server, the treasury is local. All of
that is *correct for single-player and wrong for multiplayer*, and the further
I build the more expensive the switch gets.

**My guess:** single-player first, multiplayer eventually, and you'd rather I
not compromise the single-player game to keep the door open.

**What changes:** if multiplayer is the actual goal, three things need to
change *now* rather than later — the clock needs one authority, the economy
needs to be server-side, and the sim's determinism needs to be tested across
machines rather than just across runs. That's weeks, and it's much cheaper now
than after another 40 systems.

---

## ⚑ 3. What is THE progression? There are four.

Right now a player is progressing along four separate tracks and I built three
of them:

| Track | What it is | What it gates |
|---|---|---|
| **Certifications** | 12 licences, earned at schools | which hulls you may drive |
| **Rank** | read off service | whether you may call a god / take command |
| **Secondary skills** | 22, levelled through use | small accuracy/speed edges |
| **The 8 master stats** | the canon roster | (currently nothing much) |

Your law is *"knowledge, certifications, rank and reputation ARE the
progression; stats help."* I followed it. But a new player now meets four
systems, and I suspect that's three too many to *feel*.

**My guess:** certifications and rank are the two that matter, skills are
flavour the player never manages directly, and the 8 stats are for the
Ascendants side rather than the soldier side.

**What changes:** whichever you name, I'd make it the spine of the service file
and demote the others visually.

---

## ⚑ 4. Onboarding: what should the first ten minutes FEEL like?

You said onboarding isn't there yet, and I agree — but I want to know which
*kind* of not-there.

Today: name → country dossier → city/hometown → psych questions → print
authorization → the laptop. That's five screens of reading before a single shot.
It has weight now, but weight is not the same as momentum.

Three directions, and they're mutually exclusive:

- **A — CEREMONY.** Intake is the point. Lean in: make it longer, more
  official, more like being processed. The player earns the right to fight.
- **B — COLD OPEN.** You start mid-firefight in someone else's body, die, and
  *then* wake up in intake. The paperwork means something because you've
  already seen what it's for.
- **C — FAST DOOR.** Name, flag, go. Everything else — hometown, psych, the
  dossier — is available later in the laptop but never blocks the first fight.

**My guess:** B. This universe's best idea is that you are a *print*, and the
strongest possible tutorial is dying once before the game explains anything.
"Well… guess I'm back" hits infinitely harder as the second thing you hear.

**What changes:** B means building a scripted opening fight. That's real work
and I don't want to start it on a guess.

---

## 5. How permanent is anything?

Prints are the universe's best idea and I don't know the rules.

- When a print dies in a match, is that *a* death or *the* death?
- Do you have a limited number of prints? Does the account buy more?
- Does a print accumulate anything a new one loses? (Right now: licences and
  rank survive, because the account owns them — I made that call myself.)
- Can you have several prints and *switch* between them, like a roster?

**My guess:** the account owns everything institutional (rank, papers, money,
records) and the print owns everything personal (skills, morale, the body).
Dying costs you the personal layer and nothing else, and printing a new one
costs money.

**What changes:** if a print can permanently die and that *matters*, this game
becomes a very different, much more tense game — and I'd want to know before
building anything else on top.

---

## 6. How do WAR WORLD and ASCENDANTS relate for a player who has both?

You're thinking about shipping Ascendants standalone with this as the whole
thing. For me the question is narrower: **does a player's stuff cross over?**

- Same account, one identity, two games?
- Does an Ascendant you capture here appear over there?
- Is Ascendants the "superhero mode" of this game, or a separate product that
  shares a universe and nothing else?

**My guess:** shared universe, shared lore, *separate saves* — because linking
saves across two engines is a support nightmare and buys less than it costs.

---

## 7. What is the tone, exactly?

I've been writing in a register that's dry, procedural and a bit bleak — the
ministry voice. Mail from the war office, a memorial, a print that's illegal at
home.

But the game also has a food truck that raises morale, a paintball yard, a
racing league and a cartridge called HARVEST 88.

Both are good. I don't know the ratio, and the wrong ratio makes it feel
confused rather than textured.

**My guess:** the WORLD is bleak and the PEOPLE are funny. The ministry never
jokes; soldiers do constantly. That's *Catch-22*, and it's the most durable
version of this.

---

## 8. Who is this for?

Genuinely asking, because the answer changes what I polish.

Comparables I can see in what you've built: Jagged Alliance 2 (you named it),
Battlefield, Rimworld's story-generation, and — in the sports/laptop/cartridge
layer — something closer to a *life sim*.

**My guess:** people who liked JA2 and want a modern one, who will forgive
rough edges for depth and systems that talk to each other.

**What changes:** if it's a broader/younger audience, the first-hour polish
matters far more than the depth, and I'd reprioritise hard.

---

## 9. The town / places — where do activities live now?

You told me not to build a hub map because you're doing the map maker. Good.
But the six real places (yard, range, schools, garage, circuit, threat room)
are still reached through a list.

- Do you want them as **places in your generated cities** (I'd need a door
  convention from your map maker), or
- **Rooms on the laptop** (cheap, works today, less magic), or
- **A single base map** you author once and everything hangs off?

**My guess:** the base. One authored military base with real doors, dropped
into whatever city the map maker generates around it.

---

## 10. Sports — how many, and how deep?

You said sports are a big part of this. I've built the league frame with
racing live and four more disciplines specced.

- Are sports a *side activity* (a nice thing between deployments), or a
  **parallel career** with its own progression, sponsors and money?
- Do bots/NPCs compete in them, so there's a season happening without you?

**My guess:** parallel career, and yes — a league that runs without you is what
makes the world feel like it exists when you're not looking.

---

## 11. What have you played that made you want to build this?

Not a design question. The single most useful thing you could tell me.

When I know the three games you'd point at and say *"this feeling, but ours"*,
I stop guessing about a hundred small calls a week.

---

## 12. What's the ONE thing that, if it were perfect, would make this game?

If everything else stayed rough — what's the thing that has to be great?

**My guess:** the feeling of being *trusted with something* — the bomber, the
platoon, the front. You've said it three separate ways in three separate
conversations, which is usually how you can tell what a game is actually about.

---

## Smaller, but I'd still like answers

13. **Does the player have a face?** There's an appearance phase in intake that
    goes nowhere, and no paper doll. You mentioned not knowing what the dogs
    look like — do you want a character viewer before more systems?
14. **How real is the money?** The war chest sets your manifest. Should there be
    a *personal* wallet — pay for a print, buy a car, lose it gambling on a
    race?
15. **Jackals — playable?** The capture mechanic exists. A jackal contract board
    is one system away and it's the best non-war content in the design.
16. **How much do you want the press to lie?** The newspaper reports facts.
    Faction spin would be a strong feature and a big tone commitment.
17. **Difficulty:** is there one, or does the world scale to you?
18. **Do you want a campaign** with an ending, or an endless war?

---

## What I'd do next, if you said nothing at all

So you're not blocked on me:

1. Hull-to-hull collision (#137) — racing needs it and it's cheap.
2. The Gun Run (#138) — the parts exist; it's assembly.
3. The scripted cold open (Q4-B) — the biggest single upgrade to first
   impressions, and I'd build it on my own guess if you don't correct me.
