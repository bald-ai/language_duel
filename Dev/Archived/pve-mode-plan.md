# PvE Mode — Implementation Plan

**Status:** Ready to implement. Design phase complete.
**Sources:** `Dev/pve-mode-spec.md` · `CONTEXT.md` · `docs/adr/0001-shared-hint-pool-affecting-both-players.md` · `docs/adr/0002-physical-co-presence-assumption.md`

This plan supersedes any earlier draft in `tmp/pve-status.html`. The HTML status page was a snapshot; this is the working document. Mockup labels in the HTML included some model-invented copy (Easy/Hard description rewrites, "Partner" scoreboard) — those are **not** part of the plan and are removed here.

---

## Decisions locked during plan review

The plan below already reflects these decisions. They are listed here so the rationale is visible in one place.

1. **`duelMode` is required in the final schema** (not optional like `duelDifficultyPreset` is today). Existing rows get a one-time backfill to `"pvp"` before the deployed schema flips to required. Backfill execution is an end-of-implementation release step and must only happen after confirming with Michal. This honors AGENTS.md's no-fallback rule — no read-side "if missing treat as pvp" defaults anywhere.
2. **Phase 5 server-side mode-gating applies to exactly 5 mutations**: `sendSabotage`, `requestHint`, `acceptHint`, `eliminateOption` (all gated PvP-only), plus `fireHint` (gated PvE-only). All other duel-touching mutations (`answerDuel`, `timeoutAnswer`, `stopDuel`, `pauseCountdown`, `requestUnpauseCountdown`, `confirmUnpauseCountdown`, `skipCountdown`, completion mutations) are mode-agnostic and are not gated.
3. **No difficulty-row copy changes.** The current descriptions (*"All difficulty levels"*, *"Medium and hard questions only"*, *"Hard questions only"*) stay as-is. Phase 3 is purely a logic change: bump Medium's wrong-answer count from 4 to 5.
4. **No scoreboard label changes.** Scoreboard already renders the partner's real first name (e.g. "Maria"). The fallback "Opponent" stays unchanged for both modes.
5. **`MAX_ELIMINATED_OPTIONS_DUEL` is renamed to `PVP_HINT_ELIMINATION_PICKS`**, value stays at 2. The PvE 50/50 hint uses a separate helper that removes 50% of the currently visible options, rounded down, and never removes the correct answer. The two mechanics are not shared — they're different concepts that happen to write to the same field.
6. **`Level2MultipleChoice.tsx` needs no changes.** It already renders whatever `eliminatedOptions` it's passed. The PvE "both viewers see eliminations" behavior is implemented entirely in `buildDuelViewProps.ts` by passing eliminations through to both roles in PvE while keeping `canEliminate` false.

---

## Principles every phase respects

1. **Single Responsibility.** Each new file does one thing. `lib/hintPool/rules.ts` = pure rules. `convex/hintPool.ts` = wiring. `HintPoolUI` = render.
2. **Right Logic In Right Layer.** Pool rules live in `lib/` (no React, no Convex client imports). The Convex mutation calls the rules, then writes. UI never decides eligibility.
3. **No Duplication Of Rules.** The Medium 1+5 change lives in one place (`lib/difficultyUtils.ts`). `duelMode` validator defined once in schema, imported everywhere.
4. **Testable Business Logic.** Pool rules ship with `rules.test.ts`. Mode-gating helper is a pure function. 70% coverage threshold per AGENTS.md.
5. **Clear Boundaries.** All 5 mode-specific mutations validate `duelMode` at the boundary and throw typed `ConvexError`. No silent defaults.
6. **Clear Naming.** `duelMode` everywhere (mirrors `duelDifficultyPreset`). Hint type names match glossary ↔ schema ↔ mutation ↔ component.
7. **No Hidden Side Effects.** `fireHint` does only what its name says. Per-question hint reset happens explicitly in the question-advance path.

---

## Phase order

Eight phases. Recommended order: **1 → 3 → 4 → 5 → 2 → 6 → 7 → 8**.

- Phase 1 unblocks everything (schema).
- Phase 3 is independent of mode and can ship early.
- Phase 5 (backend gating) must land before Phase 7 (UI gating) so the contract is enforced at the boundary, not just hidden in the client.

---

## Phase 1 — Schema: add `duelMode` (Foundation, Risk: Low)

Persist PvP vs PvE on every challenge, the duel it creates, and the challenge-invite notification the joiner sees. Same pattern as `duelDifficultyPreset`: picked at creation, written to the challenge, copied to the duel on accept, surfaced on the invite. **Required field, not optional.**

### Backfill (prepared now, executed at release after confirmation)
- `convex/migrations/backfillDuelMode.ts` — one-time internal mutation that loops `challenges`, `duels`, and `challenge_invite` notifications, patching missing `duelMode` to `"pvp"`.
- Do **not** run this against the deployed DB during implementation.
- At the final release gate, confirm with Michal before running any deployed DB backfill.
- After the deployed backfill completes, flip the deployed schema validators to required.
- Delete the migration file in a follow-up commit.

### Schema
- `convex/schema.ts` — add `duelMode` (required) to `challenges`, `duels`, and the `challenge_invite` branch of `notificationPayloadValidator`.
- One new validator `duelModeValidator` defined alongside `duelDifficultyPresetValidator`. One definition, imported everywhere.

### Create paths
- `convex/challenges.ts` → `createChallenge` accepts and persists `duelMode`.
- `convex/weeklyGoals.ts` (or `convex/weeklyGoals/mutations.ts`) → `createBossChallenge` + `handleCreateBossChallenge`.
- `convex/weeklyGoalRepetitions.ts` (or `convex/weeklyGoalRepetitions/challengeCreation.ts`) → `createRepetitionChallenge` + `createRepetitionChallengeForCurrentUser`.
- Challenge-accept path → copy `duelMode` from challenge to the new duel.

### Notification
- `convex/notificationHelpers.ts` → `createChallengeInviteNotificationAndEmail` accepts `duelMode` and writes it into the payload.

### Client wiring
- `hooks/challengeLobby/types.ts` — extend `CreateChallengeOptions`.
- `hooks/challengeLobby/useChallengeActions.ts` — forward `duelMode` to the mutation.
- `hooks/useChallengeLobby.ts` — pass through the lobby orchestrator.

### Validation
- `npm run typecheck`; generated Convex types are clean.
- Backfill mutation has a dry-run/local validation path, but is **not** run against the deployed DB in this phase.
- Existing tests for all three challenge-creation mutations still pass.
- Payload deserializes with `duelMode` present.
- Deployed required-schema flip waits until the final release gate, after Michal confirms the deployed DB backfill.

### Depends on
Nothing. Ships first.

---

## Phase 2 — Mode picker UI on three creation surfaces + invite card (Risk: Low)

Anywhere a user can start a classic PvP duel today, they must also be able to pick PvE. Three creation surfaces need the picker. Plus the incoming-invite card needs to show the mode so the joiner isn't surprised.

### New file
- `app/components/modals/DuelModePicker.tsx` — one shared component: two `ModeSelectionButton`s (primitive already exists, used by `SoloPracticeModal`). PvP default (`selectedTone="primary"`), PvE alternative (`selectedTone="secondary"`). Consistent across all call sites.

### Surfaces
- `app/components/modals/ChallengeModal.tsx` — new section under Difficulty.
- `app/boss/[goalId]/[bossType]/page.tsx` — picker above "Challenge Partner".
- `app/repetition/[goalId]/page.tsx` — picker above "Start Duel".

### Shared options
- `app/components/modals/challengeOptions.ts` — add `DUEL_MODE_OPTIONS` (label + description per mode). Single source consumed by `DuelModePicker`.

### Invite card
- `app/notifications/components/NotificationItem.tsx` — wherever `duelDifficultyPreset` is rendered for a `challenge_invite`, render a sibling `duelMode` chip.

### Test IDs
- `duel-modal-mode-pvp` · `duel-modal-mode-pve`
- `boss-mode-pvp` · `boss-mode-pve`
- `repetition-mode-pvp` · `repetition-mode-pve`

### Validation
- Component test per surface: clicking each mode toggles selection; creating from each surface passes the chosen mode through.
- Accepting a challenge inherits the challenger's mode unchanged.
- Invite card renders the mode chip.

### Out of scope
- Friend-profile Quick Duel (delegates to challenge modal — gets the picker for free).
- Notification Accept (passive — mode comes from the original challenge).

### Depends on
Phase 1.

---

## Phase 3 — Medium difficulty: 1 correct + 5 wrong (Risk: Low)

Bump Medium from 1+4 options to 1+5 (= 6 total). **Applies to both PvP and PvE — not gated by mode.** No copy changes anywhere.

### Logic
- `lib/difficultyUtils.ts` — bump `DIFFICULTY_WRONG_COUNT.medium` from 4 to 5 and `DIFFICULTY_OPTION_COUNT.medium` from 5 to 6.

### No copy
- No changes to `challengeOptions.ts`. Difficulty descriptions stay as they are today.

### Tests
- Any question-generation tests with hard-coded "5 = 1+4" or "6 = 1+5" expectations.

### Validation
- Unit test for option-count derivation per preset.
- Manual smoke on a Medium duel.

### Depends on
Nothing. Can ship before, during, or after the rest.

---

## Phase 4 — Hint pool: backend + pure rules (Risk: Med)

Store the shared pool on the duel and add a `fireHint` mutation any player may call. The mutation delegates to a pure rules module in `lib/hintPool/`. The mutation also handles the universal +5s timer bump and marks the per-question cap.

### 50/50 elimination count (independent from PvP hint)

The PvP "Begging for help" hint and the PvE 50/50 hint are **different concepts** that happen to both write `eliminatedOptions`. They do not share code.

- PvP hint: workflow constant. The user manually picks N wrongs. Rename today's `MAX_ELIMINATED_OPTIONS_DUEL` (in `convex/constants.ts`) to `PVP_HINT_ELIMINATION_PICKS`, value stays 2.
- PvE 50/50: derived from the actual option list, not from PvP's pick limit. New helper removes 50% of currently visible options, rounded down, selecting only wrong answers and never the correct answer.

### New schema fields on `duels`
- `hintPoolUsed` — `v.array(hintTypeValidator)`. Which of the 4 are spent.
- `currentQuestionHintFired` — `v.boolean`. The per-question cap.
- `currentQuestionHintReveal` — `v.optional(...)` discriminated union: `{ kind: "anagram"; value: string } | { kind: "letterCount"; value: number }`.

Existing duel rows need these required fields backfilled before the deployed schema flips. Prepare the migration during implementation, but execute it only at the final release gate after confirming with Michal.

### New files
- `lib/hintPool/types.ts` — `HintType` enum, pool shape, reveal shape.
- `lib/hintPool/rules.ts` — pure:
  - `canFireHint(pool, type, currentQuestionHintFired)`
  - `resolveEffect(type, question)` returning the full effect (eliminations to apply, timer bonus already including the universal +5s, optional reveal value).
- `lib/hintPool/constants.ts` — `HINT_UNIVERSAL_TIMER_BONUS_SECONDS = 5`, `HINT_PLUS_TEN_BONUS_SECONDS = 10`.
- `lib/hintPool/rules.test.ts` — covers 1-per-type, 1-per-question, +5s universal, +10s → +15s effective total, 50/50 removes half of visible options and never removes the correct answer.
- `convex/hintPool.ts` — `fireHint` mutation: load duel, call rules, write.

### Effect contract (single combined timer write per fire)
- **50/50** → eliminates 50% of the currently visible options, rounded down, chosen only from wrong answers. Timer bonus +5s (universal).
- **+10 Seconds** → timer bonus +15s total (+10 effect + +5 universal, folded into one number).
- **Anagram** → writes `currentQuestionHintReveal = { kind: "anagram", value: shuffle(correctAnswer) }`. If the shuffle happens to match the original answer, that's acceptable. Timer bonus +5s.
- **Letter Count** → writes `currentQuestionHintReveal = { kind: "letterCount", value: correctAnswer.length }`. Timer bonus +5s.

### Anagram & Letter Count semantics
Both describe the **correct English answer**, not the prompt. The prompt is already visible; hinting on it is useless. Hints exist to nudge toward the right multiple-choice option.

### Per-question reset
The question-advance mutation (currently advances `currentWordIndex`) gains an explicit step that clears `currentQuestionHintFired` and `currentQuestionHintReveal`. Named, not hidden — lives in the advance handler with its own helper call. Initial-state correctness verified during implementation: new duels start with `hintPoolUsed: []`, `currentQuestionHintFired: false`, and no reveal.

### Validation
- Unit tests for pool rules: 1-per-type, 1-per-question, universal +5s, +10s = total +15s, 50/50 removes half of visible options and never removes the correct answer.
- Integration test on the mutation: second call same question rejected with typed error.

### Depends on
Phase 1 (needs `duelMode` on the duel). Phase 3 changes the generated visible option counts that 50/50 operates on.

---

## Phase 5 — Backend mode-gating on every mode-specific mutation (Foundation, Risk: Med)

Enforce the PvP/PvE contract at the server boundary, not in the client. Once this lands, Phase 7 hides UI for clarity, not safety.

### New helper
- `convex/rules/duelModeGuards.ts` — `assertDuelMode(duel, expected: "pvp" | "pve", mutationName)`. Pure function. Throws `ConvexError({ code: "WRONG_MODE", ... })`. Ships with its own `*.test.ts`.

### Touches (exactly these 5 mutations)
- `convex/sabotage.ts` → `sendSabotage`: `assertDuelMode(duel, "pvp", "sendSabotage")`.
- `convex/hints.ts` → `requestHint`, `acceptHint`, `eliminateOption`: same assertion with `"pvp"`.
- `convex/hintPool.ts` (from Phase 4) → `fireHint`: `assertDuelMode(duel, "pve", "fireHint")`.

### Validation
- Unit tests for `assertDuelMode`.
- Integration test per mutation: wrong-mode call throws `WRONG_MODE` with a clear message; right-mode call proceeds.

### Depends on
Phase 1 (needs `duelMode`) + Phase 4 (needs `fireHint` to exist before it's gated).

---

## Phase 6 — Hint pool: in-duel UI (Risk: Low)

New `HintPoolUI` rendered in the slot the sabotage panel uses today, in PvE only. Four emoji buttons (✂️ ⏰ 🔀 🔢), label *"Hint pool N/4"*. Convex subscription provides symmetric sync between devices for free.

### Button state (single greyed style)
- Unused + can fire: full color, clickable.
- Unused but blocked (something already fired this question, or pool exhausted): greyed and unclickable.
- Used (spent for the duel): greyed and unclickable.

All non-clickable states use the **same** greyed visual. No separate "spent" vs "blocked" visuals — the player reads the "Hint pool N/4" counter to know what they still own.

### New files
- `app/duel/[duelId]/components/HintPoolUI.tsx` — render only, no decisions.
- `app/duel/[duelId]/hooks/useHintPool.ts` — reads pool state, exposes `fireHint`.

### Touches
- `DuelView.tsx` — mutually exclusive render: `HintPoolUI` if PvE, `SabotageSystemUI` if PvP.
- `buildDuelViewProps.ts` — explicit mode branch: in PvE, eliminations are passed through to both viewers; `isHintProvider` and `canEliminate` stay false.
- Question card — render anagram / letter-count from `currentQuestionHintReveal` under the word.

### Test IDs
- `duel-hint-fifty-fifty` · `duel-hint-plus-ten` · `duel-hint-anagram` · `duel-hint-letter-count`
- Pattern matches the `dataTestIdBase="duel-hint"` convention used by `SabotageSystemUI`.

### Validation
- Component test: each button fires once, then greys out.
- Only one button per question stays enabled at a time.
- Two simulated clients see the same pool state.
- Anagram / letter count render under the question when reveal fields are set.

### Depends on
Phases 1, 2, 4, 5.

---

## Phase 7 — PvE-only UI cleanup (Risk: Low)

Gate two PvP-only affordances so they never render in PvE: the *"Begging for help!"* request-hint button and the entire sabotage panel. PvP keeps everything unchanged.

We do **not** add "no-op in PvE" branches to `useSabotageEffect` or similar client hooks — Phase 5 already enforces the contract at the server boundary, so a client-side guard would be exactly the "just in case" fallback AGENTS.md forbids.

### Touches
- `DuelView.tsx` — render `HintSystemUI` only when mode = PvP.
- `DuelView.tsx` — same gate around `SabotageSystemUI`.

### Explicit non-changes
- `useSabotageEffect.ts` — leave alone.

### Validation
- Component snapshot: PvE duel has no sabotage panel and no "Begging for help" button.
- PvP duel still renders both.

### Depends on
Phases 1, 5, 6.

---

## Phase 8 — Validation gate & handoff (Risk: Low)

Per AGENTS.md, before handoff:

- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:run` clean (full suite, single run, no watch).
- Coverage threshold (70%) still met for touched files.
- Before any deployed DB backfill runs, pause and confirm with Michal. Backfill execution is a release step, not an automatic implementation step.
- After confirmation, run the prepared deployed DB backfills for `duelMode` and required hint-pool duel fields, then flip the deployed schema validators to required.

### New tests
- `lib/hintPool/rules.test.ts`
- `convex/rules/duelModeGuards.test.ts`
- `HintPoolUI` component test
- Mode picker integration test per surface (3 tests)

### Existing tests likely to update
- `tests/convex/challenges.test.ts`
- `tests/convex/weeklyBossFlow.test.ts`
- `tests/convex/weeklyGoalRepetitions.test.ts`
- Any duel/challenge fixture that builds rows without `duelMode` (now required).
- Any sabotage test that exercises the existing PvP path — confirm the new `assertDuelMode` doesn't break it.

### Docs
- Short note in `docs/DOCUMENTATION.md` on the hint pool surface and the `assertDuelMode` boundary helper.

### Depends on
All previous phases.

---

## Deferred & parked

- **PvE scoring redesign.** Stays identical to PvP for v1; revisit after playtesting.
- **Hint fired at the exact moment a question times out.** Edge case noted in spec, not in v1 scope.
- **Analytics / telemetry mode dimension.** No event tagging in v1. If post-launch we want to compare PvP vs PvE usage, add a `mode` field to duel-related events. Parked.
- **Both-players-already-answered fire window.** If both players answer before the question advances, a fired hint has no useful effect (eliminations decided, timer irrelevant). v1 allows the fire; if playtesters report wasted hints, add a rule to reject.

---

## Visual mockups (HTML/CSS — phone-frame replicas)

These mockups are kept here as raw HTML so the file can be opened in a browser to see the proposed UI changes. Labels and copy are aligned to the locked plan above — no model-invented descriptions, no "Partner" labels, no "1+5 options" appendages in the difficulty rows.

The only real UI changes vs today are:
1. A **PvP/PvE mode picker** added under Difficulty in `ChallengeModal`.
2. In PvE, the **hint pool panel replaces the sabotage panel** in the duel screen.
3. In PvE, the **"Begging for help" button is removed**.

Everything else (difficulty descriptions, scoreboard label, themes section, CTA buttons) is unchanged from today.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PvE Mode — Mockups</title>
<style>
  :root {
    --ivory: #FAF9F5;
    --slate: #141413;
    --clay: #D97757;
    --rust: #B04A3F;
    --gray-100: #F0EEE6;
    --gray-300: #D1CFC5;
    --gray-500: #87867F;
    --gray-700: #3D3D3A;
    --white: #FFFFFF;
    --sans: system-ui, -apple-system, sans-serif;
    --mono: ui-monospace, 'SF Mono', Menlo, monospace;
    --serif: ui-serif, Georgia, serif;
  }
  body { margin: 0; padding: 40px 24px; background: var(--ivory); color: var(--slate); font-family: var(--sans); font-size: 15px; line-height: 1.6; }
  .page { max-width: 860px; margin: 0 auto; }
  h1 { font-family: var(--serif); font-weight: 500; font-size: 32px; margin: 0 0 24px; }
  h3 { font-family: var(--serif); font-weight: 500; font-size: 18px; margin: 28px 0 6px; }
  .mockup-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 18px; }
  @media (max-width: 720px) { .mockup-row { grid-template-columns: 1fr; } }
  .mockup-caption { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--gray-500); margin-bottom: 8px; font-weight: 600; }
  .mockup-caption .pill { display: inline-block; margin-left: 6px; font-family: var(--mono); font-size: 10px; background: var(--gray-100); color: var(--gray-700); border-radius: 4px; padding: 2px 6px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 600; }
  .mockup-caption .pill.new { background: #F4E4DA; color: var(--clay); }
  .legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; color: var(--gray-700); margin: 14px 0 0; }
  .legend-swatch { display: inline-block; width: 18px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .legend-swatch.new { background: var(--clay); }
  .legend-swatch.remove { background: var(--rust); }

  /* Phone frame — uses live app palette */
  .phone {
    --app-bg: #FFF8F1; --app-elevated: #FFFFFF;
    --app-primary: #FB7185; --app-primary-dark: #DA445D;
    --app-cta: #22C55E; --app-cta-dark: #16A34A;
    --app-text: #1F2937; --app-muted: #6B7280;
    width: 100%; max-width: 320px; margin: 0 auto;
    background: var(--app-bg); color: var(--app-text);
    border: 8px solid #1F2937; border-radius: 28px;
    padding: 14px 12px; font-family: var(--sans);
    box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  }
  .phone-title { font-size: 14px; font-weight: 700; text-align: center; margin: 2px 0 12px; }
  .phone-section-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--app-muted); font-weight: 700; margin: 12px 0 6px; }

  .opt { border: 2px solid var(--app-primary-dark); border-radius: 10px; padding: 8px 10px; background: var(--app-elevated); display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
  .opt .opt-label { font-weight: 700; }
  .opt .opt-desc { font-size: 10px; color: var(--app-muted); }
  .opt.selected { background: rgba(34, 197, 94, 0.10); border-color: var(--app-cta); }
  .opt.selected .opt-label { color: var(--app-cta-dark); }
  .opt .check { width: 14px; height: 14px; border-radius: 50%; background: var(--app-cta); color: white; font-size: 9px; display: inline-flex; align-items: center; justify-content: center; }

  .phone-cta { display: block; width: 100%; padding: 10px; background: var(--app-cta); color: white; border: 2px solid var(--app-cta-dark); border-radius: 10px; font-weight: 700; font-size: 13px; text-align: center; margin-top: 8px; }
  .phone-outline { display: block; width: 100%; padding: 8px; background: transparent; color: var(--app-text); border: 2px solid var(--app-primary-dark); border-radius: 10px; font-weight: 600; font-size: 12px; text-align: center; margin-top: 6px; }

  .mode-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .mode-btn { border: 2px solid var(--app-primary-dark); border-radius: 10px; padding: 8px 6px; text-align: center; background: var(--app-elevated); font-size: 11px; font-weight: 700; color: var(--app-text); }
  .mode-btn .mode-sub { display: block; font-size: 9px; font-weight: 500; color: var(--app-muted); margin-top: 2px; }
  .mode-btn.selected { background: rgba(34,197,94,0.10); border-color: var(--app-cta); color: var(--app-cta-dark); }

  .scoreboard { display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 0 2px 8px; border-bottom: 1px solid #F0EEE6; margin-bottom: 10px; }
  .scoreboard .timer { font-family: var(--mono); font-weight: 700; font-size: 14px; color: var(--app-primary-dark); }
  .question-word { text-align: center; font-size: 22px; font-weight: 700; margin: 4px 0 10px; }
  .answer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
  .answer { border: 2px solid var(--app-primary-dark); border-radius: 10px; background: var(--app-elevated); padding: 10px 6px; text-align: center; font-size: 12px; font-weight: 600; }

  .sab-label { text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.75; margin-bottom: 4px; font-weight: 600; }
  .sab-panel, .hint-panel { display: flex; justify-content: center; gap: 6px; background: rgba(255,248,241,0.8); border: 1.5px solid var(--app-primary-dark); border-radius: 14px; padding: 6px; }
  .sab-btn, .hint-btn { width: 36px; height: 36px; border-radius: 8px; border: 2px solid var(--app-primary-dark); background: var(--app-elevated); display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .hint-btn.used { opacity: 0.4; background: #F0EEE6; border-color: #D1CFC5; }
  .help-btn { display: block; width: 100%; margin: 8px 0; padding: 8px; border: 2px dashed var(--app-primary-dark); border-radius: 10px; background: transparent; font-size: 11px; text-align: center; color: var(--app-primary-dark); font-weight: 700; }

  .edited { position: relative; outline: 2px dashed var(--clay); outline-offset: 6px; border-radius: 12px; }
  .edit-tag { position: absolute; top: -10px; right: -6px; background: var(--clay); color: white; font-family: var(--mono); font-size: 9px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.12); }
  .removed { position: relative; outline: 2px dashed var(--rust); outline-offset: 6px; border-radius: 10px; opacity: 0.55; }
  .removed::after { content: "REMOVE"; position: absolute; top: -10px; right: -6px; background: var(--rust); color: white; font-family: var(--mono); font-size: 9px; letter-spacing: 0.05em; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
</style>
</head>
<body>
<div class="page">

  <h1>PvE Mode — Visual mockups</h1>
  <div class="legend">
    <span><span class="legend-swatch new"></span>New / edited UI</span>
    <span><span class="legend-swatch remove"></span>Removed in PvE</span>
  </div>

  <!-- Mockup 1: Duel creator -->
  <h3>1. Duel creator — <code>ChallengeModal</code></h3>
  <p style="margin: 0 0 14px; color: var(--gray-700); font-size: 13px;">
    Add a <strong>PvP / PvE mode toggle</strong> as a new section directly under <em>Difficulty</em>. Two equally-weighted buttons; default selection is PvP (today's behavior). Difficulty row copy is unchanged.
  </p>

  <div class="mockup-row">
    <!-- Today -->
    <div>
      <div class="mockup-caption">Today <span class="pill">current</span></div>
      <div class="phone">
        <div class="phone-title">Create Challenge</div>
        <div class="phone-section-label">Select Themes</div>
        <div class="opt selected">
          <div><div class="opt-label">Animals A1</div><div class="opt-desc">42 words</div></div>
          <span class="check">✓</span>
        </div>
        <div class="opt">
          <div><div class="opt-label">Travel basics</div><div class="opt-desc">28 words</div></div>
        </div>
        <div class="phone-section-label">Difficulty</div>
        <div class="opt selected">
          <div><div class="opt-label">Easy</div><div class="opt-desc">All difficulty levels</div></div>
          <span class="check">✓</span>
        </div>
        <div class="opt">
          <div><div class="opt-label">Medium</div><div class="opt-desc">Medium and hard questions only</div></div>
        </div>
        <div class="opt">
          <div><div class="opt-label">Hard</div><div class="opt-desc">Hard questions only</div></div>
        </div>
        <button class="phone-cta">Create Challenge</button>
        <button class="phone-outline">Cancel</button>
      </div>
    </div>

    <!-- Proposed -->
    <div>
      <div class="mockup-caption">Proposed <span class="pill new">PvE update</span></div>
      <div class="phone">
        <div class="phone-title">Create Challenge</div>
        <div class="phone-section-label">Select Themes</div>
        <div class="opt selected">
          <div><div class="opt-label">Animals A1</div><div class="opt-desc">42 words</div></div>
          <span class="check">✓</span>
        </div>
        <div class="opt">
          <div><div class="opt-label">Travel basics</div><div class="opt-desc">28 words</div></div>
        </div>
        <div class="phone-section-label">Difficulty</div>
        <div class="opt selected">
          <div><div class="opt-label">Easy</div><div class="opt-desc">All difficulty levels</div></div>
          <span class="check">✓</span>
        </div>
        <div class="opt">
          <div><div class="opt-label">Medium</div><div class="opt-desc">Medium and hard questions only</div></div>
        </div>
        <div class="opt">
          <div><div class="opt-label">Hard</div><div class="opt-desc">Hard questions only</div></div>
        </div>

        <div class="phone-section-label edited" style="display:inline-block; padding-right:8px;">
          <span class="edit-tag">New</span>
          Mode
        </div>
        <div class="mode-row edited" style="margin-top: 6px;">
          <span class="edit-tag">New</span>
          <div class="mode-btn selected">
            PvP
            <span class="mode-sub">Sabotages · compete</span>
          </div>
          <div class="mode-btn">
            PvE
            <span class="mode-sub">Hints · cooperate</span>
          </div>
        </div>

        <button class="phone-cta" style="margin-top: 14px;">Create Challenge</button>
        <button class="phone-outline">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Mockup 2: In-duel screen -->
  <h3>2. In-duel screen — <code>DuelView</code></h3>
  <p style="margin: 0 0 14px; color: var(--gray-700); font-size: 13px;">
    Same layout in both modes. In PvE the sabotage row is replaced 1-for-1 by the <strong>shared hint panel</strong>, and the <em>"Begging for help!"</em> request-hint button is removed. Scoreboard label is unchanged.
  </p>

  <div class="mockup-row">
    <!-- PvP today -->
    <div>
      <div class="mockup-caption">PvP (today) <span class="pill">unchanged</span></div>
      <div class="phone">
        <div class="scoreboard">
          <span>You <strong>3</strong> · <strong>2</strong> Maria</span>
          <span class="timer">0:14</span>
        </div>
        <div style="font-size:10px; text-align:center; color:#6B7280; text-transform:uppercase; letter-spacing:0.1em; font-weight:600;">
          Question 4 of 10
        </div>
        <div class="question-word">perro</div>
        <div class="answer-grid">
          <div class="answer">dog</div>
          <div class="answer">cat</div>
          <div class="answer">bird</div>
          <div class="answer">fish</div>
        </div>
        <button class="phone-cta" style="margin-bottom: 8px;">Confirm Answer</button>
        <button class="help-btn">💡 Begging for help!</button>
        <div class="sab-label">Sabotage <span style="font-family:var(--mono)">3/3</span></div>
        <div class="sab-panel">
          <div class="sab-btn" title="Sticky">📝</div>
          <div class="sab-btn" title="Ping Pong">🏓</div>
          <div class="sab-btn" title="Trampoline">🤸</div>
          <div class="sab-btn" title="Reverse">🔄</div>
        </div>
      </div>
    </div>

    <!-- PvE proposed -->
    <div>
      <div class="mockup-caption">PvE (new) <span class="pill new">PvE update</span></div>
      <div class="phone">
        <div class="scoreboard">
          <span>You <strong>3</strong> · <strong>2</strong> Maria</span>
          <span class="timer">0:14</span>
        </div>
        <div style="font-size:10px; text-align:center; color:#6B7280; text-transform:uppercase; letter-spacing:0.1em; font-weight:600;">
          Question 4 of 10
        </div>
        <div class="question-word">perro</div>
        <div class="answer-grid">
          <div class="answer">dog</div>
          <div class="answer">cat</div>
          <div class="answer">bird</div>
          <div class="answer">fish</div>
        </div>
        <button class="phone-cta" style="margin-bottom: 12px;">Confirm Answer</button>

        <!-- "Begging for help" removed in PvE -->
        <div class="removed help-btn" style="margin-top: 14px;">💡 Begging for help!</div>

        <!-- Hint pool replaces sabotage panel -->
        <div style="margin-top: 18px;" class="edited">
          <span class="edit-tag">Replaces sabotage</span>
          <div class="sab-label">Hint pool <span style="font-family:var(--mono)">3/4</span></div>
          <div class="hint-panel">
            <div class="hint-btn" title="50/50">✂️</div>
            <div class="hint-btn" title="+10 Seconds">⏰</div>
            <div class="hint-btn" title="Anagram">🔀</div>
            <div class="hint-btn used" title="Letter Count (used)">🔢</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <p style="margin: 22px 0 0; font-size: 12px; color: var(--gray-500);">
    Mockups are CSS approximations of the actual screens (<code>ChallengeModal.tsx</code>, <code>DuelView.tsx</code>, <code>SabotageSystemUI.tsx</code>). They reuse the live Playful Duo palette but are not pixel-exact.
  </p>

</div>
</body>
</html>
```
