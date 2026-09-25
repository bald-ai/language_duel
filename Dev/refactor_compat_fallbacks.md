# Refactor: remove compatibility fallbacks

Status: waiting on a Convex connection. Don't start until this folder is linked to the Convex project (`.env.local` with `CONVEX_DEPLOYMENT`), so production data can be checked.

## What this is about

AGENTS.md says "no fallback code": don't keep code that quietly copes with data the app no longer produces. A scan on 2026-09-25 (`language-duel-compat-fallbacks-verified-2026-09-25.md`, run on commit `2d07503`) found 21 such places. A spot check on `2e3f10c` showed all 21 are still in the code.

Example: every duel is created with both scores set to 0, and the schema requires them, but scoring still does `(duel.challengerScore || 0)`. If a score ever went missing, that code would hide the bug instead of failing.

## Why it's blocked

Most fixes mean making schema fields required. When you deploy, Convex checks every existing row against the schema. If any old production row is missing a field, the deploy fails. Some fallbacks probably exist because old rows really do lack these fields (for example, the credit refill for users created before credits existed).

Before tightening the schema:
1. Query production for rows missing each field listed in group A.
2. Delete or patch those rows. Production data is disposable (see AGENTS.md), but deleting still needs the maintainer's go-ahead.
3. Then make the fields required and remove the readers' fallbacks.

Line numbers drift, so search by file and pattern.

## Group A: schema optional, but every writer always sets it

Make required in `convex/schema.ts`, then remove the reader fallbacks.

1. **User credits**: `llmCreditsRemaining`, `ttsGenerationsRemaining`, `creditsMonth`. Remove the `=== undefined` refill checks in `normalizeCreditState` (`convex/credits.ts`), and keep only the month check.
2. **Theme `ownerId`, `visibility`, word-theme `wordType`** (also `wordType` on weekly goal snapshots). Readers:
   - `lib/themeAccess.ts` (missing-owner checks)
   - `convex/themes/listQueries.ts` and `convex/themes/readModels.ts` (`owner: null` path)
   - `visibility || "private"` in `app/themes/hooks/useThemesController.ts`
   - `wordType || DEFAULT_WORD_TYPE` in `app/themes/hooks/useThemeDetailController.ts`
   - the missing-type default in `lib/themes/wordTypes.ts`
   - the `"No category"` label in `app/themes/components/ThemeList.tsx`
   - `theme.wordType || "nouns"` on duplicate in `convex/themes/mutations.ts`

   Leave `friendsCanEdit` alone: duplicate still inserts without it. Leave the create-argument defaults alone too: those arguments are optional on purpose.
3. **Duel `duelQuestions`**. Readers use `duel.duelQuestions?.` in:
   - `convex/duels.ts`
   - `convex/tbtDuel.ts`
   - `convex/hints.ts`
   - `convex/rules/sentenceGameplayRules.ts`
   - `TurnByTurnView.tsx`
   - `useCrossKindRoundTransition.ts`

   Also remove the "Missing duel questions" branch in `app/duel/[duelId]/page.tsx`. Keep the relay answer-key strip in `buildRelaySafeDuel`: that one is intentional.
4. **Challenge and duel `duelDifficultyPreset`**. Keep the `preset ?? "easy"` default for the optional `createChallenge` argument.
5. **Notification `payload`**. Readers: `payload?.` in `app/notifications/components/NotificationCards.tsx`.
6. **User `nickname`**. Readers: `currentNickname || ""` in `app/settings/components/NicknameEditor.tsx`. `CurrentUser.nickname` in `convex/users.ts` becomes required.

Related payload tightening:
- `themeName` on challenge-invite payloads is always written. Remove `|| "Theme"` in `NotificationCards.tsx`.
- `event` on weekly-goal invitation payloads is always written. The draft-expiring notification omits it, so the payload validator may need splitting per type. The invite card's final return then handles only `event: "invite"`.

## Group B: schema already requires it, but readers still guard

These don't need prod data checks and can be done on their own.

7. `(duel.opponentScore || 0)` and `(duel.challengerScore || 0)` in `convex/rules/duelScoringRules.ts`.
8. `duel.currentItemIndex ?? 0` in `app/duel/[duelId]/hooks/useDuelSessionViewModel.ts`, and the `currentItemIndex === undefined` early return in `useDuelPhaseState.ts`. Keep solo `currentItemIndex ?? 0`: it's real null client state.
9. `themeName ?? ""` in `TurnByTurnView.tsx` and `RelayDuelView.tsx`, and the `{ themeName?: string }` cast in `useDuelSessionViewModel.ts`.
10. The blank-word placeholder `{ word: "", answer: "", wrongAnswers: [] }` in `app/duel/[duelId]/hooks/duelViewModelHelpers.ts`.
11. `theme.words ?? []` and `theme.sentenceRounds ?? []` after the content type is known:
    - `convex/themes/mutations.ts`
    - `lib/themes/themeContent.ts`
    - `lib/sessionItems.ts`
    - `app/themes/components/ThemeList.tsx` and `ThemeCard.tsx`
    - `useThemeDetailController.ts`
    - `app/goals/components/GoalThemeSelector.tsx`
    - `hooks/challengeLobby/useChallengeData.ts`

    Tighten `ThemeContentShape` and `SessionThemeInput` to the discriminated union.
12. `goal.createdAt ?? 0` in `convex/weeklyGoals/readModels.ts`. Keep `lockedAt ?? 0`: it's a real optional.
13. `word.wrongAnswers?.length` in `lib/answerShuffle.ts`. Keep the empty-array branch.
14. `normalizeNotificationPreferences(prefs)` on a loaded row in `convex/notificationPreferences.ts`. The table requires every field. Keep the no-row default and the normalization of partial update input.

## Group C: optional for a real reason, but defaulted where it can't be missing

15. **Relay state on a relay duel.** Replace the defaults with an assertion:
    - `relayAnswerStartedAt ?? 0` and `relayHardBudget?.[role] ?? 0` in `convex/relayDuel.ts`
    - `relayPicker ?? "challenger"`, `relayResolvedIndices ?? []`, `relayHardUpgradeIndices ?? []` and `relayHardBudget ?? {...}` in `lib/duel/relayEngine.ts`
    - the phase, picker and budget defaults in `RelayDuelView.tsx`

    Better: narrow the relay duel type once at the boundary.
16. **Completed weekly goal without `completedAt`**: the quiet skip and `null` return in `convex/weeklyGoalRepetitions/board.ts`. `readModel.ts` already throws. Also check the same check in `attemptMutations.ts`.
17. **`dueAt ?? 0`** on the `"ready"` and `"coming_up"` sorts in `convex/weeklyGoalRepetitions/board.ts`. The bucket rule guarantees a number.
18. **`themeCount ?? 0`** in the weekly-goal card in `NotificationCards.tsx`.
19. **Sentence duplicate** copies `wordMeanings` and `freeWordPositions` only when present, in `convex/themes/archiveDuplicate.ts`. Also check the same pattern in `app/themes/hooks/useSentenceThemeController.ts`, which the scan didn't cover.

## Don't touch (checked and rejected)

- Lives fallback in `duelScoringRules.ts`: normal and self duels omit `livesRemaining`.
- `friendsCanEdit ?? false`.
- Empty snapshot content checks in `weeklyGoalRepetitions/contentLoading.ts`.
- `viewerRole ?? "challenger"` in the duel page (loading state only).
- `correctOption ?? null` and `spanishSentence ?? null` (viewer-safe mask).
- Hint, countdown and sentence-progress `?? []` (absence means "none yet").
- `parseWordType` default and `fieldIndex` / `wrongIndex ?? 0` in `lib/generate`.
- TTS provider default (users never pick one on signup).
- Generic card for an unknown notification type (uncertain, low value).

## Before starting

The scan predates commit `37894dc` (the big gameplay and relay update). Before removing each fallback, recheck that every current writer still sets the value, especially relay and duel fields.
