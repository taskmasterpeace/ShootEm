# MULTIPLAYER — what is actually running
### Status: **BUILT (a game) / NOT BUILT (a service).** Real authoritative netcode; no matchmaking, no accounts, and two gates that do not hold online. Verified against code 2026-07-23.

> **Read this before `MULTIPLAYER-PLAN.md`.** That document is the *plan* and much of its staged road is already built. This one is the *status*.

---

## 0 · FOR THE NEXT AI

**Multiplayer is real and it works.** There is a dedicated authoritative Node WebSocket server running the **same deterministic sim** the single-player game runs, with per-client interest culling. This is not "replay dressed as multiplayer".

What it is **not** is a service: there is no matchmaking, no lobby, no accounts, no auth, no TLS, and no server-side persistence. You paste a URL. The code says so itself — it is littered with honest "Stage-2 hardening" notes and describes its own wire format as fine "for LAN play".

**Start it:**
```bash
npm run server        # tsx src/server/server.ts — WebSocket on :3401
```
Then in the client, paste the server URL into the `server-url` field (`main.ts:695`).

**The files that ARE the feature:**
| File | What it owns |
|---|---|
| `src/server/server.ts` (~500 lines) | The authoritative server: rooms, the tick loop, join/leave, chat, the war-room HTTP surface. |
| `src/client/net.ts` | The thin puppet client: command send, snapshot apply, dead reckoning. |
| `src/sim/snapshot.ts` | `takeSnapshot` · `cullSnapshotFor` (anti-cheat) · `applySnapshot` · `createPuppetWorld`. |
| `src/server/input-queue.ts` | Per-client command queue (one press per tick, held-repeat when starved). |
| `src/server/warroom.ts` + `src/warroom/` | The operator console (observe, kick, restart, nudge). |

**The one thing to know before touching it:** `createPuppetWorld` is the **single recipe shared by multiplayer AND replay**. Change how a puppet world is built and you change the killcam too.

---

## 1 · WHAT EXISTS AND RUNS

| System | Status | Detail | Cite |
|---|---|---|---|
| Authoritative server | ✅ | `WebSocketServer`, HTTP listen on **:3401** by default. Launched by `npm run server`. | `server.ts:433`, `:496` |
| Server-authoritative sim | ✅ | One `Room` per mode, each running the **same** `World.step` at **30 Hz** (`TICK = 1/30`). | `server.ts:50`, `:26` |
| Snapshot rate | ✅ | Broadcast at **15 Hz** (`SNAP_EVERY = 2`). | `server.ts:27` |
| Tick loop | ✅ | An **accumulator** loop, so GC/event-loop stalls cannot dilate sim time. | `server.ts:115` |
| Thin-puppet client | ✅ | `createPuppetWorld` (server state is truth); sends `{t:'cmd'}` ~30 Hz; applies authoritative snapshots and **dead-reckons between them**. | `net.ts:56`, `:136`, `:148` |
| **Interest management / anti-cheat** | ✅ | `cullSnapshotFor` builds a **per-viewer** snapshot: cloak, smoke, mine-detector and submarine detection all gate what reaches the wire. *"Nobody's wire carries an enemy they couldn't perceive — ESP reads static."* A genuine architectural measure, not a stub. | `snapshot.ts:176`, `server.ts:210` |
| Bot backfill | ✅ | Rooms fill with bots (`TEAM_TARGET` 12/side); a join swaps a bot out, a leave swaps one back in, so the match never shrinks. Finished matches auto-restart after 12 s. | `server.ts:86`, `:125`, `:185`, `:214` |
| Comms over the wire | ✅ | Chat with team filtering, an **offline mailbox** delivered on next join, tactical waypoints relayed to teammates. | `server.ts:152`, `:40`, `:142`, `:164` |
| LSW call over the wire | ✅ | `callLsw` → `world.requestLsw`, judged **server-side**. | `server.ts:178` |
| Compression | ✅ | `permessage-deflate` on the socket (~5× on snapshots). | `server.ts:433` |
| Operator "War Room" | ✅ | `GET /warroom/status`, `POST /warroom/cmd` (observe / end / restart / announce / kick / nudge), behind a shared `x-warroom-key`. | `server.ts:389` |
| Graceful fallback | ✅ | If the socket cannot be reached the client **drops to offline bots** — you always get a game. | `main.ts:750` |
| One sim, both modes | ✅ | Single-player and multiplayer share the same deterministic sim. This was always the bet, and it paid. | — |

---

## 2 · WHAT IS NOT THERE

| Missing | Detail | Cite |
|---|---|---|
| 🔴 **No way in from the front door** | The GONET's MULTIPLAYER tile is a **disabled "COMING SOON"**. The working server is unreachable from the shipped UI — you must paste a URL into the deploy screen's `server-url` field. *A running feature nobody can find is, to a player, an unbuilt one.* | `frontend.ts:142`, `gonet/index.ts:239` |
| ⬜ Matchmaking / lobby / server browser | You paste a URL into a text input. One fixed room per mode. | `main.ts:695`, `:747` |
| ⬜ Accounts / auth | None. Career (the Dossier) is **IndexedDB-local**, so rank, medals and honours live on one browser. Blocks seats, votes, and any shared identity. | — |
| ⬜ Server-side persistence | In-memory mailbox + a JSON campaign file. Nothing else survives a restart. | — |
| ⬜ TLS / hardening | Plain HTTP, dev-key default, wide-open CORS. The code flags this repeatedly as "Stage-2 hardening — not before it runs public". | `server.ts:24`, `:320` |
| ⬜ Delta compression | Full-world JSON snapshots, quantised to 3 decimals. Self-described: *"Fine for LAN play at 15 Hz."* First thing to break past LAN scale. | `snapshot.ts:46`, `:90` |
| ⬜ Science / military missions online | Deliberately forced local and omitted from public rooms. | `main.ts:745`, `server.ts:32` |
| ⬜ The political layer | Command seats, votes of confidence, taking over an AI-held seat — the whole `GOVERNMENT.md` endgame. Blocked on accounts. | `COMMAND-AUDIT.md §6` |

---

## 3 · INTEGRITY HOLES — read this before going public

These are not missing features; they are **gates that exist offline and silently do not hold online.** The cause is the same in both cases: the server constructs its world as `new World({ seed, mode, theme })` — passing **neither `rank` nor `papers`** (`server.ts:106`, `:224`).

| Hole | What happens | Cite |
|---|---|---|
| **The commission gate is skipped.** | `requestLsw` only enforces rank when `opts.rank !== undefined`. Online it is undefined, so **any human can call a god regardless of rank.** The `commissioned` flag the client sends is decorative; only the client-side console UI respects it. "Earned responsibility" is an honour system in MP. | `world.ts:1207`, `COMMAND-AUDIT.md §6` |
| **The licence gate is skipped.** | `mayDrive` treats `papers === undefined` as ISSUED, so **every online body can drive anything.** The whole certification system is singleplayer-only today. | `world.ts:5458`, `CERTIFICATIONS.md §1.2` |
| **`godmode` ships in the live client.** | A backtick-key panel that makes you an untouchable any-LSW god, imported into `main.ts:22`. Fine for dev; it needs a build flag or admin gate before public exposure. | `main.ts:22` |
| **The human never gets the dog online.** | The server pairs the K9 to the first `kind === 'bot'` explicitly, so the handler panel is dead in MP. | `server.ts:96` |

---

## 4 · WHAT WE ARE AIMING AT

From `MULTIPLAYER-PLAN.md` and Robert directly:

> *"we need net play… deploy this… read the news and see what other people have done."*

The ambition is not just "play together" — it is **a world that writes about itself**: every day a human plays, the Courier digests real match data into an edition, and the radio sings about it. Deployment target is *a URL Robert can hand anyone*.

The staged road was M0 harden determinism → M1 the Node server → **M2 co-op science missions first** (2–4 friends, small worlds, cheat-softness acceptable among friends) → competitive later. **M0 and M1 are done.** M2 is explicitly *not* — science is forced local today, which is a direct contradiction of the plan's own ordering.

The endgame (`GOVERNMENT.md`): empty command seats are **visibly AI** and a qualified human can **take** one; a second human **splits** command; a **vote of confidence** seats and unseats people, weighing their war record. None of that exists, and all of it needs accounts.

---

## 5 · THE GAP, RANKED

1. **Accounts (#83).** Everything else is downstream: no persistent identity means no seats, no votes, no shared records, no cross-device career, no anti-griefing.
2. **The two skipped gates** (§3). Small code, real integrity — and they get harder to add once people are playing.
3. **No matchmaking.** "Paste a URL" is not a product; it is a demo.
4. **Co-op science was supposed to be first** and is currently the one thing forced offline.
5. **Hardening** — TLS, a real admin key, CORS.
6. **Delta snapshots** — only once past LAN scale.

---

## 6 · MY RECOMMENDATION

**Before anything else: open the front door.** The single strangest fact in this file is that a working authoritative server sits behind a **disabled "COMING SOON" tile**. We have built multiplayer and then hidden it. Wiring that tile to the server-URL flow is trivial and it turns an invisible system into a visible one — the same "make the built thing perceivable" theme that runs through the whole audit.

**Then close the two gates, before anyone plays online.** Passing `rank` and `papers` when the server builds its world is a handful of lines, and it converts two systems that *look* enforced into two that *are*. Right now a public build would quietly teach players that rank and licences are decorative — and that is very hard to walk back once it is folk knowledge.

**Then do co-op science missions, exactly as the plan said.** It is the smallest genuinely shippable multiplayer: 2–4 friends, tiny worlds, no competitive integrity burden, and it is the mode most improved by another human. It is currently forced local, which means the *easiest* multiplayer win is the one thing switched off. I would spend the next multiplayer effort there rather than on competitive polish.

**Accounts are the real fork, and I would not start them casually.** They unlock the entire political layer (seats, votes, a shared record board, cross-device career) and they are the single largest remaining system in the game. Before writing code I would want a decision on §7.1 — because "self-host for friends" and "hosted service" want very different account systems, and building the wrong one is months.

**What I would not do:** delta compression, or any netcode optimisation. The wire is fine at the scale anyone will actually play at, and there is a long list of correctness work in front of it.

---

## 7 · OPEN QUESTIONS

1. **Self-host or hosted service?** (a) A LAN/self-host build — the honest current state; you hand friends a URL. (b) A hosted service — needs matchmaking, accounts, hardening, and someone paying for servers. **Every deferred item hangs off this one answer.**
2. **One career or two, synced?** The war Dossier and the yard's Field Record are deliberately separate local books. If accounts arrive, do they become one identity? Does the Yard Cup / Longball Belt lineage go global, or stay per-player?
3. **Is racing a ranked online sport?** (see `RACING.md §4.3`) — that would need a ladder and matchmaking, or it stays local + async ghosts and shared boards.
4. **Does the news go world-wide?** Today only *your own* battles file press issues. A shared wire service — other players' fronts filing into one Courier — is the thing that makes Robert's "read the news and see what other people have done" literally true, and it is a server feature.

---

## 8 · TRAPS

- **`createPuppetWorld` is shared with the replay/killcam.** Changing it changes both.
- **The server passes neither `rank` nor `papers`** (`server.ts:106`, `:224`). Any gate you add via `WorldOptions` will silently not exist online unless you add it there too. **This is the recurring bug in this file.**
- **Bots read `pingedLast`, not `pinged`** — recon fills the current buffer after brains run. Relevant to any wire-visibility work.
- **Interest culling is per-viewer.** If you add a new entity type to the snapshot, decide its visibility rule or you have opened an ESP hole.
- **Science and military missions are deliberately excluded** from public rooms (`server.ts:32`). That is a choice, not an oversight — but it contradicts the plan's M2.
- **The input queue is one press per tick with held-repeat when starved** — do not "fix" it into latest-wins; that was the previous design and it lost inputs.

---

*Verified against `main`, 2026-07-23. Companion: `MULTIPLAYER-PLAN.md` (the intent). See `FEATURES.md` for the trust rule.*
