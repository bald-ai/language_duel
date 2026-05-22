# Code Review Areas — Thermo-Nuclear Quality Audit

## How to use this file

This is the **todo list** for running the `thermo-nuclear-code-quality-review` skill
(`~/Desktop/thermo-nuclear-code-quality-review.md`) across the whole codebase, one chunk
at a time.

- Work through the areas **one at a time**. For each area, run the skill scoped to exactly
  the files/dirs listed for that area — nothing more.
- When you start an area, change ⬜ to 🔵 (in progress). When the review is done and
  findings are recorded, change it to ✅.
- Save each area's review into its own new `.md` file in the `Dev` folder, named
  `code_review_<area_name>.md` (e.g. `Dev/code_review_theme_management_ui.md`). Do not
  record findings inline in this file — link to that review file from the area's line.
- **Ignore all mock/prototype code** — it is intentionally excluded (see bottom).
- The skill cares most about: files over ~700 LOC (project guideline; skill flags >1k hard),
  spaghetti conditionals, weak/duplicated abstractions, and logic living in the wrong layer.
  Items marked ⚠️ are the obvious size/decomposition targets — start there within each area.

Status legend: ⬜ not started · 🔵 in progress · ✅ done

Total reviewable: ~43k LOC across 15 areas.

---

## Theme content

- ✅ **1. Theme management UI** — `app/themes/` components + hooks (non-generation). ~4.0k LOC.
  - ⚠️ `ThemeDetail.tsx` (762), `ThemeList.tsx` (514), `WordEditor.tsx` (381).
  - Check the 7 controller hooks for overlapping/redundant indirection.
  - Findings: [`Dev/code_review_theme_management_ui.md`](./code_review_theme_management_ui.md) — **BLOCK**

- ⬜ **2. Theme data & access layer** — `lib/theme.ts`, `lib/themeAccess.ts`, `lib/themes/*`
  (api, serverValidation, wordTypes, themeUiValidation, wordEditing), `convex/themes.ts` +
  `convex/themes/*`, `convex/helpers/themeAccess.ts` + `resolveAccessibleThemes.ts`. ~2.8k LOC.
  - Access model (private / shared / friend-edit) is the gotcha to scrutinize.

- ⬜ **3. Theme generation & Pick-and-Prune** — `app/api/generate/*`, `lib/generate/*`
  (⚠️ `requestValidation.ts` 421, `prompts.ts` 338), generation modals/hooks in `app/themes/`
  (GenerateThemeModal, GenerateMoreModal, PickAndPruneReview, useThemeGenerator/Controller,
  usePickAndPrune). ~2.3k LOC.

## Gameplay

- ⬜ **4. Duel session — frontend** — `app/duel/[duelId]/*`
  (⚠️ `DuelView.tsx` 712, `AnswerOptionButton.tsx` 263; ~10 hooks). ~2.7k LOC.
  - Check the view-model / props-builder / hook layering for spaghetti.

- ⬜ **5. Game levels & sabotage effects** — `app/game/*`
  (⚠️ `Level1Input.tsx` 510, `Level2TypingInput.tsx` 438, `Level2MultipleChoice.tsx` 385;
  sabotage hooks/effects). ~3.1k LOC.
  - Watch for duplicated logic across Level0–3.

- ⬜ **6. Duel/challenge backend & rules** — `convex/duels.ts`, `challenges.ts` (459),
  `gameplay.ts`, `sabotage.ts`, `hints.ts`, `hintPool.ts`, `convex/rules/*`,
  `convex/helpers/{gameLogic,sessionCreation,duelInitialization,sessionWords}.ts`,
  `lib/{duel,sabotage,hints,hintPool,scoring,answerShuffle,duelMode,duelRole,sessionWords}`.
  ~2.5k LOC.
  - PvP/PvE mode enforcement (`assertDuelMode`) is the boundary to check.

- ⬜ **7. Challenge lobby (client orchestration)** — `hooks/challengeLobby/*` +
  `useChallengeLobby.ts`, `app/components/modals/ChallengeModal.tsx` (⚠️ 707),
  ModeSelectionButton, DuelModePicker, ThemeSelector, `lib/challengeLobby`. ~1.4k LOC.

## Practice & progress

- ⬜ **8. Solo practice & Learn** — `app/solo/*`
  (⚠️ `[sessionId]/page.tsx` 735, `learn/[sessionId]/page.tsx` 621),
  `lib/{soloPracticeRuntime,soloNavigation,soloLearnTimer}.ts`, `lib/contextClues/*`,
  SoloPracticeModal, `useSoloPracticeLauncher`. ~3.4k LOC.
  - The two big page files are prime decomposition candidates.

- ⬜ **9. Weekly goals & boss** — `app/goals/*`, `app/boss/*`, `convex/weeklyGoals.ts` +
  `convex/weeklyGoals/*` (⚠️ `mutations.ts` 525), `lib/weeklyGoals.ts` (423) +
  `weeklyGoalTiming.ts`, `convex/helpers/weeklyGoalSnapshots.ts`, `useWeeklyGoalThemeIds`.
  ~4.5k LOC.
  - Lifecycle state (draft/locked/grace/completed + derived `lock_proposed`) is the spaghetti risk.

- ⬜ **10. Spaced repetition** — `app/repetition/*` (⚠️ `RepetitionBoard.tsx` 412),
  `convex/weeklyGoalRepetitions.ts` + `convex/weeklyGoalRepetitions/*`,
  `lib/spacedRepetition.ts`. ~1.7k LOC.

## Cross-cutting systems

- ⬜ **11. Notifications & friends** — `app/notifications/*`
  (⚠️ `NotificationItem.tsx` 524, `FriendListItem.tsx` 344),
  `convex/{notifications,notificationHelpers,notificationPayloads,notificationPreferences}.ts`,
  `convex/friends.ts` (492), `lib/notifications/*` + templates/preferences/relationshipPolicy.
  ~3.3k LOC.

- ⬜ **12. Email & reminders backend** — `convex/emails/*` (⚠️ `emailNotificationLog.ts` 326),
  `convex/crons.ts`. ~1.1k LOC.

- ⬜ **13. TTS pipeline** — `lib/tts/*` (`providerAdapters.ts` 307), `lib/themes/tts.ts`,
  `app/api/tts/*`, `convex/ttsGenerationLocks.ts`,
  `convex/themes/{generateThemeTtsAction,ttsPipeline}.ts`, `convex/helpers/themeTtsStorage.ts`,
  `useThemeTtsController`, `useTTS`, `useDuelAudio`. ~1.2k LOC.

## Foundation & shell

- ⬜ **14. Settings, preferences & appearance** — `app/settings/*`,
  appearance/background/preferences providers in `app/components/`, `lib/colorUtils.ts` (282),
  `lib/{userDisplay,displayFormat,credits,preferences}`, `convex/{userPreferences,credits}.ts`.
  ~2.2k LOC.

- ⬜ **15. App shell, auth, user sync & schema** — `app/HomePageClient.tsx` (499) +
  layout/page, shared `app/components/` (auth, Avatar, ModalShell, MenuButton, etc.),
  `hooks/{useSyncUser,usePresence}`, `convex/users.ts`,
  `convex/helpers/{auth,users,userSummary,permissions}.ts`, plus **`convex/schema.ts` (567)**
  and shared `lib/` primitives (types, constants, errors, stringUtils, timeUtils, prng,
  difficultyUtils, cleanup*). ~3.0k LOC.
  - Schema is the foundation every other area depends on.

---

## Excluded (mock/prototype — do NOT review)

**Never review mock features — this is a permanent rule, not a one-time list.**
Mock features are throwaway experiments and are intentionally held to a different bar, so the
quality skill must skip them entirely. This applies to **any** mock feature, including new ones
that appear after this file was written. If you encounter a file or folder whose name is related
to "mock" (e.g. contains `mock`), skip it — do not flag it, do not include it in any area's
scope, and do not add it to the list above.

Known excluded today (~4.8k LOC):

- `app/mock-online/`
- `app/components/prototypes/` (MemoryGame, RelayDuelBeta)
- `convex/prototypeRooms.ts`
- `lib/mockOnline/`
