# THE MULTIPLAYER MASTER PLAN — net play, deployment, and the living newspaper
### 2026-07-22. THE source-of-truth doc for going online (Robert: "we need net play… deploy this… read the news and see what other people have done"). Mirrored as the master ticket; a fresh AI should be able to execute from this document alone.

## What we're building
People play War World over the internet; **every day a human plays, the world writes about it** — the Courier digests real match data into a daily edition; the radio sings about it. Deployment target: a URL Robert can hand anyone.

## The foundation is already poured (do not re-derive)
- **The sim is deterministic** (seeded RNG only, fixed-step, no Date.now in src/sim) — verified #20 (closed). This was always the multiplayer bet.
- **Whole-world snapshot serialization exists** (the killcam records it; `cullSnapshotFor` already fogs per-client).
- **Per-client input queue** shipped (#3 closed, `src/server/input-queue.ts` + test).
- The perf/netcode board (#1–#42) documents the wire-format and tick-rate hazards with measurements: 53KB/tick JSON (#17), 60-vs-30Hz bot divergence (#16), setInterval drift (#15), loadout trust (#14), interest-management leaks (#4), JSON.stringify ceiling (#36), interpolation buffer (#35), prediction (#40), 30Hz server (#41).

## The staged road (each stage is playable; no stage bets on the next)
**M0 — Harden determinism at 30Hz.** Fix #16 (probability rolls per-tick → per-second), pin a cross-run replay hash test. Gate: two headless runs, byte-identical.
**M1 — The Node server.** One process runs the sim at 30Hz (fix #15's drift with an accumulator), WebSocket transport, thin lobby (create/join by code). Reuses input-queue. Gate: two browsers, one fight, no divergence.
**M2 — Co-op science missions FIRST** (2–4 players, friends-only, tiny worlds). Lockstep-soft is fine here — cheat-softness doesn't matter among friends. This is the first SHIPPABLE multiplayer.
**M3 — Accounts + persistence (#83).** Auth (email+screenname; scrypt), the dossier/prints/certs move server-side. DB: SQLite first (one file, zero ops), Postgres when concurrency demands. The GONET laptop becomes real login.
**M4 — PvP on snapshots.** Server-authoritative: clients send inputs, server sims, sends culled snapshots (fix #17 binary/delta + #4 interest + #35 interpolation + #40 reconciliation + #14 server-side loadout law). Mixed human/bot Warfront-style matches.
**M5 — Sessions at scale.** Reconnect, late-join (snapshot catch-up), per-core rooms (#36), the leaderboard.
**Deploy:** client = static dist on any CDN; server = one Node process on a VPS (Docker; LogNog for logs). Same-origin WSS behind nginx. Cost: one small box.

## THE DAILY EDITION — the loop that makes it a world (build alongside M2, not after M5)
1. **Every match already ends in a blackbox + war ledger.** Server-side: append each match's digest (who/where/hometowns/K-D/flags/budget/deaths-by, ~2KB JSON) to a **day file**.
2. **The 6am press run** (cron): if any human played yesterday → feed the day file to the LLM → **the daily Courier edition** (HTML now; AI front-page image when Robert hands over the key — WAR-3). Corrections box reads the previous edition. Player names, hometowns, print numbers in headlines.
3. **The radio (same pipeline, audio lane):** Suno (ad-lab scripts exist: `generate-music.js`) makes faction anthems + the fake artists — the faction rapper cutting tracks about yesterday's front, True Foe on the Chicago station. News beds via expressive-tts. Cache everything; a song is reused for weeks.
4. **Budget law: < $0.50/day.** One text edition (~$0.02), one image (~$0.04, when keyed), one song every few days (~$0.10 amortized), TTS beds pennies. Enforced by a spend ledger in the pipeline; skip-days when nobody played cost $0.
5. Delivery: the newspaper/radio are static files the client fetches — no live infra beyond the daily cron.

## Trust boundaries (the laws)
Server owns truth (inputs in, snapshots out) · loadout/class legality checked server-side (#14) · fog culled server-side (shipped pattern) · determinism = the anti-cheat for co-op, authority = the anti-cheat for PvP · replays stay byte-stable across versions via replay-format version stamps.

## Order of work & gates
M0 → M1 → M2 (SHIP: friends co-op + daily edition v1) → M3 → M4 (SHIP: public PvP) → M5. Every stage: tsc/vitest/build green + a two-client smoke test on the deployed box. The Daily Edition pipeline lands with M2 and never waits for PvP.

## Open calls for Robert
Hosting (his VPS vs rent one) · the image key (WAR-3) · public playtest timing (after M2 or M4) · screenname policy.
