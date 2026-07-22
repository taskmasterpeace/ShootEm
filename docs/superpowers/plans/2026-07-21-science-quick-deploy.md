# Science Mission Quick Deploy Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five one-click, deterministic Science Mission cards to the main Deploy menu.

**Architecture:** A focused preset catalog owns mission composition and prepares launches through the existing Science flow. `main.ts` renders the catalog and translates a card click into the existing `queuedScienceLaunch` plus `startGame()` path; HTML/CSS provide a permanent responsive shelf without creating another game mode.

**Tech Stack:** TypeScript, DOM, existing Science Mission generator/runtime, Vitest, Vite, in-app browser.

## Global Constraints

- Cards launch directly with one click and never spend a campaign Science window.
- Five presets ship: K9 House Clear, Researcher Rescue, Clone Vault Raid, Quarantine Sweep, and Airfield Ambush.
- Every preset is deterministic, commits eight prints, chooses a suitable class/theme, and resets to that class's issue weapons.
- The generic random Science Mission card and Scar Science flow remain unchanged.
- Cards are semantic buttons, keyboard accessible, at least 44px tall, responsive, and reduced-motion compliant.
- No push. Stage files explicitly and omit `Co-Authored-By` lines.

---

### Task 1: Typed Quick-Deploy Catalog

**Files:**
- Create: `src/client/science-presets.ts`
- Test: `tests/science-presets.test.ts`

**Interfaces:**
- Produces `SciencePresetId`, `SciencePreset`, `SCIENCE_PRESETS`, `prepareSciencePreset(preset): ScienceLaunchState`, and `sciencePresetCardHTML(preset): string`.
- `SciencePreset` includes `id`, `icon`, `title`, `description`, `classId`, `seed`, `tags`, and typed `options`.

- [x] **Step 1: Write failing catalog tests** proving five unique IDs, exact verb/site/class combinations, eight prints, determinism, and no `frontId`.

```ts
expect(SCIENCE_PRESETS.map((p) => p.id)).toEqual([
  'k9-house-clear', 'researcher-rescue', 'clone-vault-raid',
  'quarantine-sweep', 'airfield-ambush',
]);
const k9 = SCIENCE_PRESETS[0];
expect(k9).toMatchObject({ classId: 'infantry', options: { verb: 'hunt', site: 'officer-villa', complication: null } });
expect(prepareSciencePreset(k9).spec.squadSize).toBe(8);
expect(prepareSciencePreset(k9).frontId).toBeUndefined();
expect(prepareSciencePreset(k9)).toEqual(prepareSciencePreset(k9));
```

- [x] **Step 2: Run `npx vitest run tests/science-presets.test.ts`; confirm RED** because the module does not exist.

- [x] **Step 3: Implement the frozen catalog and helper** by calling `prepareScienceMission(preset.seed, null, 8, preset.options)`.

- [x] **Step 4: Run the focused test and `npx tsc --noEmit`; confirm GREEN.**

- [x] **Step 5: Commit** with `feat: define science quick deploy missions`.

---

### Task 2: Menu Shelf and One-Click Launch

**Files:**
- Modify: `index.html`
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Test: `tests/science-presets.test.ts`

**Interfaces:**
- Consumes `SCIENCE_PRESETS` and `prepareSciencePreset`.
- Produces menu container `#science-quick-deploy` and `renderScienceQuickDeploy()`.

- [x] **Step 1: Add failing presentation assertions** that `index.html` contains the labelled quick-deploy region and `sciencePresetCardHTML` emits one semantic button with `data-science-preset`, title, description, class, and tags for every preset ID.

- [x] **Step 2: Run the focused test; confirm RED** on the missing region/render helper.

- [x] **Step 3: Add the HTML region** as the first Deploy action with heading, explanatory copy, and `#science-preset-cards`.

- [x] **Step 4: Render the five buttons in `main.ts`** by joining `sciencePresetCardHTML`. Attach listeners through each stable `data-science-preset` value. On click set Science mode, preset class/theme, issue weapons, eight prints, clear front state, assign `queuedScienceLaunch = prepareSciencePreset(preset)`, and call `startGame()`.

- [x] **Step 5: Add production styles** for amber operation cards, tag pills, 10px corners, hover/focus/disabled states, >=44px targets, responsive wrapping, and reduced motion.

- [x] **Step 6: Run focused tests, TypeScript, and ESLint; confirm GREEN.**

- [x] **Step 7: Commit** with `feat: add science quick deploy menu`.

---

### Task 3: Browser Verification and Release Gates

**Files:**
- Modify: `docs/SCIENCE-MISSIONS.md`
- Modify: `docs/SHIPPING-LOG.md`
- Modify: `docs/superpowers/plans/2026-07-21-science-quick-deploy.md`

**Interfaces:** None new.

- [x] **Step 1: Start Vite and inspect the shelf** at desktop and narrow widths. Confirm all five cards are readable, clickable, and do not cover existing menu controls.

- [x] **Step 2: Launch K9 House Clear** and confirm Hunt + officer villa + eight prints + local dog/K9 controls.

- [x] **Step 3: Return and launch a non-K9 preset**; confirm its expected verb/site/class and no campaign mutation. Check console errors.

- [x] **Step 4: Document exact cards and verified behavior.**

- [ ] **Step 5: Run `npx tsc --noEmit`, `npx vitest run`, `npm run lint`, and `npm run build`.**

- [ ] **Step 6: Run repository hygiene checks and commit** with `docs: ship science quick deploy cards`.
