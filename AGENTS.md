# War World — Multi-Agent Working Agreement

**Read this before writing any code.** You are one of several AI agents
working on this repository at the same time, under one human coordinator
(Robert). This file is the whole agreement. It exists because two agents
sharing one working directory once destroyed a day of work twice. Follow it
and that never happens again.

---

## The Seven Rules

### 1. One working tree per agent — never two agents in one directory
If you need to work alongside another agent, make your own worktree:

```bash
git worktree add .claude/worktrees/<your-name> -b <your-branch>
```

`.claude/worktrees/` is gitignored; `node_modules` resolves from the parent
repo, so `npx tsc`, `npx vitest`, and `npm run build` all work inside it.
If you were assigned an existing directory, do NOT create a second one.

### 2. Territory is law
Your assignment names the files/areas you own. Work only there. The current
map is in **§ Territories** below. Need something outside your territory?
Either route around it (an additive hook in your own file beats an edit in
someone else's), or stop and ask the coordinator to sequence it.

If you find uncommitted changes in the tree that you did not make, they are
**another agent's intentional work**. Do not revert, "clean up", or stage
them — not even to be helpful. Leave them exactly as they are.

### 3. Commit early, commit small, commit on YOUR branch
Uncommitted work is one stray `git reset` away from gone — commits are
immortal. Commit every coherent slice. Small commits make merges free.

### 4. Integration is a job, not an accident
`main` is the canonical line (or the shared integration branch the
coordinator names). One agent at a time is the **integrator** — only they
merge others' work. When your milestone lands, the coordinator weaves it;
then you **retarget**: point your worktree at the updated branch and
continue from there. Long-running divergence is the enemy; weave often.

### 5. The gates are the shared contract
Before you say "done", all of these must pass on your tree:

```bash
npx tsc --noEmit     # typecheck
npx vitest run       # full suite — every test, not just yours
npm run lint         # zero NEW errors (some may pre-exist)
npm run build        # the bundle emits
```

A red gate after a merge names its owner: your territory, you fix it now;
someone else's, you flag it to the coordinator — you do not guess at
another agent's logic to make red go away.

### 6. No destructive git, ever, without the coordinator
Banned without an explicit go-ahead from the human:
`git reset --hard` · `git checkout -- <paths>` · `git restore <paths>` ·
`git clean` · `git stash drop` · `git branch -D` · force-push · pushing to
any remote at all. Branch switching, committing, and merging per this
agreement are fine.

### 7. Read the room before your first commit
Check `git log --oneline -10` and `git status` when you start. Other agents
may be mid-flight. If your brief mentions another agent's area, treat it as
occupied. When in doubt, ask the coordinator — a question costs a minute; a
clobber costs a day.

---

## Territories (current assignment map)

**The coordinator speaks FEATURES, not files.** You will never be asked to
name a source file. Assignments sound like *"you're doing maps"* or *"you're
on the LSW units"* — and the agent's first job is to turn that feature into
a concrete file territory from the cards below, **declare it in one line**
("I own `fronts.ts`, `skirmish.ts`, and their tests"), and update this table
if the work moves.

| Card | Plain-English scope | Files / directories | Owner |
|---|---|---|---|
| **Maps** | fronts, map generation, the Map Maker, buildings | `src/sim/fronts.ts`, `src/sim/skirmish.ts`, `src/sim/mapedit.ts`, `src/sim/buildings.ts`, `src/harness/mapmaker.ts`, `tests/fronts.test.ts`, `tests/mapedit.test.ts`, `tests/skirmish.test.ts`, `tests/buildings.test.ts`, `tools/front-atlas.ts`, `tools/map-*`, `tools/atlas-*`, `tools/stencil-debug.ts` | maps agent |
| **Soldier bodies & motion** | gait, grip, soldier GLB pipeline | `src/client/animation.ts`, `src/client/models/grip.ts`, `tests/animation.test.ts`, `tests/grip.test.ts`, `tools/glb-*`, `tools/rig-*`, `tools/grip-*` | maps agent |
| **LSW / combat sim** | the 40 units, shared mechanics, world sim, renderer, soldier meshes | `src/sim/world.ts`, `src/sim/lsw.ts`, `src/sim/lsw/**`, `src/sim/types.ts`, `src/sim/data.ts`, `src/client/renderer.ts`, `src/client/audio.ts`, `src/client/models/soldiers.ts`, `tests/ascendants.test.ts` + LSW-mechanic tests | LSW agent |
| **Sound & music** | soundscape, VO, audio tooling | `src/client/soundscape.ts`, `src/client/audio.ts`*, `tools/gen-*.mjs`, `tools/tts-*`, `tools/*sound*` | unassigned |
| **UI & screens** | menu, HUD, onboarding, warroom | `src/client/hud.ts`, `src/client/onboarding.ts`, `src/warroom/**`, `src/styles.css`, `*.html` | unassigned |
| **Shared, ask first** | anything cross-cutting | `src/main.ts`, `src/harness/harness.ts`, `src/client/campaign.ts`, `package.json`, CI/config | coordinator sequences |
| **Docs** | `docs/*` | edit only the sections your card owns | whoever owns the work |

\* where two cards legitimately touch one file, the human's assignment names
the primary owner; the other coordinates.

If your feature doesn't fit a card, stop and ask the coordinator to draw a
new one — don't quietly annex files.

---

## The merge procedure (integrator only)

1. `git status` clean on both sides. Note both branch tips.
2. `git merge <their-branch> --no-edit` from the integration branch.
3. Run all four gates. Fix your territory's reds; flag theirs.
4. Commit. Tell the coordinator: what merged, gate results, anything flagged.
5. Workers retarget onto the updated branch and continue.

---

## The cautionary tale (why these rules exist)

Two agents once worked this repo in one directory on one branch. Agent A's
uncommitted map work kept "reappearing" after Agent B reverted it as
unfamiliar clutter — twice — until both realized the other existed. The
recoveries were manual and lucky. Since then: worktrees, territories,
commit early, one integrator, and the rules above. The merges since have
had **zero conflicts**. Keep it that way.
