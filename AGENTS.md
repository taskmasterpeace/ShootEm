# War World — Working Notes

This repo was briefly worked by several agents at once; **it's now a single
agent** (combat / LSW / sim) under one human, Robert. The old multi-agent
machinery — territories, one-worktree-per-agent, an integrator role — no longer
applies. Work directly on `main`. What still holds:

## The gates — all four must pass before you say "done"

```bash
npx tsc --noEmit     # typecheck
npx vitest run       # full suite — every test, not just the ones you touched
npm run lint         # zero errors
npm run build        # the bundle emits
```

## Git discipline

- **Commit early, commit small.** Coherent slice → commit. Clean messages, no
  `Co-Authored-By` lines.
- **No pushing.** The repo is ~200 commits ahead of `origin` by design — Robert
  decides when to publish. Never push without his explicit go-ahead.
- **No destructive git without Robert's go-ahead:** `git reset --hard`,
  `git checkout -- <paths>`, `git restore <paths>`, `git clean`, `git branch -D`,
  `git stash drop`, force-push. Committing, branching, and merging are fine.
- **Read the room first:** `git status` and `git log --oneline -10` before you
  start. Stale worktrees may linger under `.claude/worktrees/*` from the
  multi-agent era — ignore them unless Robert asks you to prune. `.claude/` is
  gitignored; stage files **by name**, never `git add -A`.

## Why the git rules are strict (the cautionary tale)

Two agents once shared one working tree and reverted each other's uncommitted
work twice; a mid-flight edit once broke the build. That's over now, but the
hygiene — commit small, gates before done, never destructive, never push — is
what keeps a 200-commit-deep unpushed history safe. Keep it.
