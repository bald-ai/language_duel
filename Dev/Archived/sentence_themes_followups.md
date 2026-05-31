# Sentence Themes — Follow-up Plan

Work through these top to bottom. The order is chosen so each step compiles cleanly on top of the previous one. Don't skip anything unless the task itself says to.

Out of scope for this pass (don't add them back):
- Per-character forbidden-punctuation tests (one round with multiple forbidden chars covers the rule cheaper).
- Widening `relayLastResult.chosen` (moot until the relay sentence UI is wired).
- The relay sentence playable flow itself.
- PvE shared tile board.
- Sentence-theme TTS.
- Sentence Pick & Prune review screen.
- Spaced repetition for sentence themes.

---

## 1 — Make `contentType` required end-to-end

Today the helper `resolveThemeContentType` silently defaults to `"word"` when the field is missing, the create mutation does the same, and the schema marks it optional. Existing data is disposable (see AGENTS.md). Make `contentType` required everywhere: schema, mutation args, helpers. Delete the `?? "word"` default.

**Files:** `lib/themes/themeContent.ts`, `convex/themes/mutations.ts`, `convex/schema.ts`.

## 2 — Schema enforces one-of `words` / `sentenceRounds`

Once `contentType` is required, tighten the schema so a word theme cannot carry `sentenceRounds` and a sentence theme cannot carry `words`. The mutation already enforces this; this adds defense in depth at the DB layer.

**Files:** `convex/schema.ts`.

## 3 — Solo session loader throws on sentence items

Today `useSoloSessionSource` silently filters sentence items out. Handoff claims "the boundary rejects with a clear error" — that's the server, but the client strips first. Replace the silent filter with the explicit error.

**Files:** `app/solo/hooks/useSoloSessionSource.ts:107-110`.

## 4 — `playWordAudio` errors instead of no-opping on sentence items

The routing already guarantees the listen button doesn't mount on sentence rounds, so the silent no-op is dead defense. Make it throw so any future routing bug surfaces loudly.

**Files:** `app/duel/[duelId]/hooks/useDuelActions.ts:180-195`.

## 5 — Fix the completion crash when the last round is a sentence

`buildFinalCompletionPatch` sets `currentWordIndex` one past the end. The duel page falls through to the word view, which then throws on the sentence position. Decide whether the post-completion index should clamp to the last real position, or whether `DuelSession` should gate on `status === "completed"` before calling the word-only narrowing helpers.

**Files:** `convex/rules/duelGameplayRules.ts:133`, `app/duel/[duelId]/DuelSession.tsx:40-45`, `app/duel/[duelId]/hooks/useDuelSessionViewModel.ts:55,131`.

## 6 — Shared sentence timer: reuse `duel.questionStartTime`

Today the sentence timer uses `Date.now()` captured per client at mount, so players see different countdowns. Word duels already do this right: the server writes `questionStartTime` into the duel doc and every client subtracts from that same anchor. Make sentence rounds use the same field.

**Files:** `app/duel/[duelId]/components/SentenceRoundView.tsx:173-183`. Pattern to mirror: `app/duel/[duelId]/hooks/useDuelQuestionTimer.ts`.

## 7 — Friend-owned sentence themes respect real permissions

`useSentenceThemeController`'s `selectedTheme` unconditionally sets `isOwner: true, canEdit: true` and drops the real owner flags from `ThemeWithOwner`. Pass the real flags through, like the word-theme controller does.

**Files:** `app/themes/hooks/useSentenceThemeController.ts:114-138, 146`.

## 8 — `gameplay.timeoutAnswer` rejects sentence positions

`answerDuel` already guards via `requireWordDuelQuestion`. `timeoutAnswer` doesn't, so a stale tab can apply the word-style miss patch to a sentence position. Same one-line guard.

**Files:** `convex/gameplay.ts:155-177`.

## 9 — HP rule: 1 HP per wrong tap, no extra on timeout

Today `getSentenceLivesPatch` deducts `mistakes + (incomplete ? 1 : 0)`, so 1 wrong tap + timeout = 2 HP. Plan said "mirror word HP." Word HP is 1-or-0, not additive. Change to wrong-taps-only. Update the matching test (it currently codifies the wrong behavior).

**Files:** `convex/rules/sentenceGameplayRules.ts:55`, `tests/convex/sentenceGameplayRules.test.ts:133-149`.

## 10 — Block hard-upgrade on sentence picks (UI + server)

Plan: hard-upgrade is word-only. Today `relayPick` accepts `hardUpgrade: true` for any position; the relay picker UI lets you select it on a sentence row. Add a server guard and disable the toggle in the UI when the picked position is a sentence.

**Files:** `convex/relayDuel.ts:88-130`, relay picker UI in `app/duel/[duelId]/components/RelayDuelView.tsx`.

## 11 — Distractor-vs-correct check strips punctuation

Today `"cafe"` distractor passes validation against `"Quiero cafe."` because `normalizeForComparison` keeps trailing punctuation. Strip punctuation in the comparison only (don't change how the tile renders).

**Files:** `lib/themes/sentenceValidation.ts:145-178`.

## 12 — Cancelling the Sentence Generate modal returns to the list

Today `handlePickSentenceContentType` switches to the detail view before any draft exists, so Cancel leaves a blank page. Don't switch view mode until generation actually returns.

**Files:** `app/themes/hooks/useThemesController.ts:105-109`.

## 13 — Discard-confirm modal for sentence editor cancel

Cancelling the sentence editor today wipes ~20 generated rounds with no confirm. Mirror the word-theme pattern exactly — same modal copy, same shape.

**This is the rule: when a sentence flow has a word equivalent, mirror it. Apply this everywhere it isn't already true.**

**Files:** `app/themes/hooks/useSentenceThemeController.ts:384-387`. Pattern to mirror: word-theme `DiscardPickAndPruneModal`.

## 14 — Spaced-repetition error says SR doesn't support sentence themes yet

Today the message reads "X snapshot has no words. Spaced repetition cannot start." Replace with a message that names the real reason (SR doesn't support sentence themes in v1).

**Files:** `convex/weeklyGoalRepetitions/contentLoading.ts:50,84-85,108`.

## 15 — Sentence themes show "X rounds", not "X words"

Theme selectors (challenge lobby, solo modal, weekly-goal selector) currently flatten both content types into a single `wordCount` and render "X words". Sentence themes should say "X rounds" everywhere.

**Files:** `hooks/challengeLobby/useChallengeData.ts:30-36`, `app/components/modals/ThemeSelector.tsx:151,214`, `app/components/modals/SoloPracticeModal.tsx:195`.

## 16 — Filter sentence themes out of solo-style pickers

Plan says solo is word-only in v1. Today the solo modal and the boss-solo warmup both let users pick sentence themes; the server then throws on Start. Filter sentence themes out at the picker level so the user never reaches the broken state.

**Files:** `app/goals/components/GoalPracticeModalHost.tsx:35-56`, `convex/weeklyGoals/bossWorkflows.ts:177`, related solo entry-points.

## 17 — "Generate More" routes through Pick & Prune

Today it asks for 5 rounds and appends them directly — no over-generation, no prune step. Plan said always over-generate 100%. The constant `SENTENCE_GENERATE_MORE_PICK_AND_PRUNE_ROUND_COUNT = 10` already exists but is unused. Wire it up and route through the same prune flow the initial generation uses.

**Files:** `app/themes/hooks/useSentenceThemeController.ts:248-269`, `app/themes/components/GenerateMoreSentenceRoundsModal.tsx`, `lib/themes/sentenceConstants.ts:24`.

## 18 — Add 5–15 round-count picker to the New Sentence Theme modal

Plan promised a user-chosen count (5–15, default 10). Today the modal only takes name + optional prompt and the count is hardcoded to 20 (Pick & Prune output). Add the picker; constants are already defined in `sentenceConstants.ts`.

**Files:** `app/themes/components/GenerateSentenceThemeModal.tsx`.

## 19 — Weekly-goal theme selector: Words / Sentences tabs

Plan wireframe shows tabs. Today it's a single combined list. Add the tabs to `GoalThemeSelector`.

**Files:** `app/goals/components/GoalThemeSelector.tsx`.

## 20 — Relay sentence support (blocked in v1)

Relay is word-only in v1. The challenge modal disables Relay for sentence themes, backend challenge/session creation rejects Relay + sentence content, and the old placeholder/mutation path was removed. Future sentence Relay support needs a fresh picker → tile-board → advance design.

**Files:** `app/components/modals/ChallengeModal.tsx`, `convex/challenges.ts`, `convex/helpers/sessionCreation.ts`, `app/duel/[duelId]/components/RelayDuelView.tsx`, `lib/duel/relayEngine.ts`.

## 21 — Server scores sentences from the tile sequence

`answerSentenceRound` now reads server-tracked tile progress instead of trusting client-reported completion/mistakes. Keep/expand tests around DTO masking and per-tap validation so future regressions surface quickly.

**Files:** `convex/gameplay.ts`, `convex/rules/sentenceGameplayRules.ts`, `convex/duels.ts`.

## 22 — Tests

Add these. Each one closes a real coverage gap that would have caught a bug above.

- Sentence DTO masking — lock in the post-fix behavior so future regressions surface (`tests/convex/duels.safeDto.test.ts`).
- `requireWordQuestion` / `requireWordSessionItem` throw on sentence input.
- Boss-flow tests use a sentence theme at least once (`tests/convex/weeklyBossFlow.test.ts`).
- `SentenceRoundView` core paths: render, tap correct, tap wrong, timeout, feedback reveal.
- Duplicate-round detection across case/accent/whitespace variants (current test uses byte-identical fixtures).
