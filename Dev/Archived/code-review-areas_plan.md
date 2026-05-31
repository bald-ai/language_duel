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

> **Status: all 15 areas reviewed (2026-05-22).** After the per-area reviews, a cross-area pass
> reconciled conflicting/overlapping suggestions and recorded scope corrections + coverage gaps:
> [`Dev/code_review_cross_area_reconciliation.md`](./code_review_cross_area_reconciliation.md).
> Read that first — it picks the single canonical fix for issues that recur across areas (button
> styles, type-contract drift, ModalShell/ConfirmModal, dead code, friendship helpers, etc.).
> Verdicts: **7 🔴 BLOCK** (1, 2, 3, 5, 6, 8, 11) · **8 🟡 APPROVE-WITH-CHANGES** (4, 7, 9, 10, 12, 13, 14, 15).

> **Status (2026-05-23): all 15 areas approved for implementation.** Each area file now carries an
> "Implementation Plan — approved" section with per-finding decisions (A = do it). The per-area
> plans are individually correct, but several **share files** or **must land in a specific order** —
> read the coordination note directly below before picking up any area in isolation.

---

## Implementation — cross-area coordination & sequencing

> Companion to [`code_review_cross_area_reconciliation.md`](./code_review_cross_area_reconciliation.md)
> (which picks the single canonical fix per recurring issue). This note is the *implementation-time*
> checklist: what order to work in, which files two+ areas both touch, and what to verify before
> handoff. None of these are blockers — they're the things that bite if an area is done in isolation.

### Hard sequencing — do in this order
1. **Dead-code deletions first** (all user-approved; remove orphaned tests in the same change):
   Area 5 #1 (~700 LOC dead `mode="duel"` level path), Area 6 #1/#2/#8/#9, Area 13 #1, Area 12
   #2/#3/#8, Area 11 #7, Area 7 #2/#3, Area 14 #1/#3, Area 9 #7. Biggest reduction, clears the field.
   *(Verified safe: the live duel screen `app/duel/` does not import the `Level*` components — only
   the solo page + tests render them.)*
2. **Schema as one coordinated pass** — `convex/schema.ts` is edited by 6 areas. Do Area 15 #4
   (difficulty-validator dedup) + #5 (`sessionSourceFields` spread) first; **Area 6 #10's adapter
   depends on Area 15 #5.** Fold the other schema edits into the same pass: Area 9 #3 (`mode`
   required), Area 11 #7 (event union), Area 12 #4/#8, Area 2 #9 (word-type validator).
3. **Shared UI primitives, built once:**
   - **`ConfirmModal`: Area 1 *creates* it → Area 3 *consumes* it. Area 1 must land before Area 3.**
   - **Button styles (C1):** one primitive `getButtonStyles` + two wrappers (`modalButtonStyles`,
     `getThemeActionButtonStyle`); every site consumes them — including Area 5's `levelButtonStyles.ts`,
     which must wrap them, not re-encode CSS-var strings.
   - Two-color-system sweep (T1) and shared icons (T7) per the reconciliation.
4. **Type-contract discipline (T2)** — derive from the server / canonical lib types everywhere a
   local `type`/`interface` mirrors a server return.
5. **Per-area structural refactors**, then canonical-helper routing (T6) + naming coordination.

   *(Full rationale + the canonical pick for each recurring issue: reconciliation §5.)*

### Shared files touched by 2+ areas — coordinate edits (merge-risk)

| File | Areas | Note |
|---|---|---|
| `convex/schema.ts` | 2, 6, 9, 11, 12, 15 | One coordinated pass; different sections (see seq. #2). |
| `app/components/modals/ChallengeModal.tsx` | 7, 15 | 7 decomposes the modal; 15 #7 swaps `words`→`wordCount`. |
| `app/components/modals/ThemeSelector.tsx` | 7, 15 | 7 #5 converges Compact onto it; 15 #7 reads `wordCount`. |
| `app/HomePageClient.tsx` | 7, 15 | 7 #7 modal wrapper (do last); 15 #3 chrome/icons/deep-link. |
| `…/useGoalsPageModel.ts` | 9, 11 | Same lines (~94–98): 9 lifts lock state + rename; 11 relocates `useCountdown`. |
| `convex/themes/mutations.ts` | 2, 13 | Different fns (2: delete/word-type/patch; 13 #1: TTS apply). |
| `lib/themes/wordTypes.ts` | 2, 3 | Both want `getDefaultWordType()` gone — **Area 3 deletes it**. |
| `app/solo/[sessionId]` + `learn/` pages | 5, 8, 13 | 8 decomposes; 5 removes level `mode` prop; 13 updates `useTTS` import. |
| `app/duel/…/useDuelActions.ts` | 4, 13 | 4 reshapes the view-model; 13 #4 deletes `useDuelAudio`. |
| `convex/weeklyGoals.ts` (+ schema event union) | 9, 11, 15 | 11 #7 drops `draft_expiring` from 9's writer + 15's schema. |

### Verify / decide before handoff
- **Self-duel (Area 6 #3)** — the *only* genuine behavior change (everything else is dead-code or
  pure refactor). After it lands, re-confirm the lobby's `createSelfDuel` path still aligns (C6 —
  Area 7 keeps its client helper as-is). Needs strong tests + a manual self-duel playthrough.
- **Seeded PRNG (Area 5 #5)** — ensure the sabotage-animation seed varies per round, or animations
  become visibly identical every time.
- **`mode` required (Area 9 #3)** — backfill any production goal rows missing `mode` *before*
  tightening the schema, or reads break.
- **TTS apply (Area 13 #1)** — resolve whether the Convex mutation can import from `lib/`; if not,
  delete the helper + its test instead of collapsing the mutation onto it.
- **Email-preferences trio** — the relocation is owned by **Area 12**; don't also handle it in Area 11.

---

## Theme content

- ✅ **1. Theme management UI** — `app/themes/` components + hooks (non-generation). ~4.0k LOC.
  - ⚠️ `ThemeDetail.tsx` (762), `ThemeList.tsx` (514), `WordEditor.tsx` (381).
  - Check the 7 controller hooks for overlapping/redundant indirection.
  - Findings: [`Dev/code_review_theme_management_ui.md`](./code_review_theme_management_ui.md) — **🔴 BLOCK**

- ✅ **2. Theme data & access layer** — `lib/theme.ts`, `lib/themeAccess.ts`, `lib/themes/*`
  (api, serverValidation, wordTypes, themeUiValidation, wordEditing), `convex/themes.ts` +
  `convex/themes/*`, `convex/helpers/themeAccess.ts` + `resolveAccessibleThemes.ts`. ~2.8k LOC.
  - Access model (private / shared / friend-edit) is the gotcha to scrutinize.
  - ⚠️ **Coverage gap:** `lib/theme.ts` (360) is the *appearance/color* system, not the
    language-theme data layer; the reviewer declined to grade its internals as misfiled. It still
    needs a quality pass + cross-area rename — see reconciliation **C7**.
  - Findings: [`Dev/code_review_theme_data_access_layer.md`](./code_review_theme_data_access_layer.md) — **🔴 BLOCK**

- ✅ **3. Theme generation & Pick-and-Prune** — `app/api/generate/*`, `lib/generate/*`
  (⚠️ `requestValidation.ts` 421, `prompts.ts` 338), generation modals/hooks in `app/themes/`
  (GenerateThemeModal, GenerateMoreModal, PickAndPruneReview, useThemeGenerator/Controller,
  usePickAndPrune). ~2.3k LOC.
  - Findings: [`Dev/code_review_theme_generation_pick_and_prune.md`](./code_review_theme_generation_pick_and_prune.md) — **🔴 BLOCK**

## Gameplay

- ✅ **4. Duel session — frontend** — `app/duel/[duelId]/*`
  (⚠️ `DuelView.tsx` 712, `AnswerOptionButton.tsx` 263; ~10 hooks). ~2.7k LOC.
  - Check the view-model / props-builder / hook layering for spaghetti.
  - Findings: [`Dev/code_review_duel_session_frontend.md`](./code_review_duel_session_frontend.md) — **🟡 APPROVE WITH CHANGES**

- ✅ **5. Game levels & sabotage effects** — `app/game/*`
  (⚠️ `Level1Input.tsx` 510, `Level2TypingInput.tsx` 438, `Level2MultipleChoice.tsx` 385;
  sabotage hooks/effects). ~3.1k LOC.
  - Watch for duplicated logic across Level0–3.
  - Findings: [`Dev/code_review_game_levels_sabotage.md`](./code_review_game_levels_sabotage.md) — **🔴 BLOCK** (headline: ~700 LOC dead `mode="duel"` path — needs user sign-off to delete)

- ✅ **6. Duel/challenge backend & rules** — `convex/duels.ts`, `challenges.ts` (459),
  `gameplay.ts`, `sabotage.ts`, `hints.ts`, `hintPool.ts`, `convex/rules/*`,
  `convex/helpers/{gameLogic,sessionCreation,duelInitialization,sessionWords}.ts`,
  `lib/{duel,sabotage,hints,hintPool,scoring,answerShuffle,duelMode,duelRole,sessionWords}`.
  ~2.5k LOC.
  - PvP/PvE mode enforcement (`assertDuelMode`) is the boundary to check.
  - Findings: [`Dev/code_review_duel_challenge_backend_rules.md`](./code_review_duel_challenge_backend_rules.md) — **🔴 BLOCK**

- ✅ **7. Challenge lobby (client orchestration)** — `hooks/challengeLobby/*` +
  `useChallengeLobby.ts`, `app/components/modals/ChallengeModal.tsx` (⚠️ 707),
  ModeSelectionButton, DuelModePicker, ThemeSelector, `lib/challengeLobby`. ~1.4k LOC.
  - Findings: [`Dev/code_review_challenge_lobby_client.md`](./code_review_challenge_lobby_client.md) — **🟡 APPROVE WITH CHANGES**

## Practice & progress

- ✅ **8. Solo practice & Learn** — `app/solo/*`
  (⚠️ `[sessionId]/page.tsx` 735, `learn/[sessionId]/page.tsx` 621),
  `lib/{soloPracticeRuntime,soloNavigation,soloLearnTimer}.ts`, `lib/contextClues/*`,
  SoloPracticeModal, `useSoloPracticeLauncher`. ~3.4k LOC.
  - The two big page files are prime decomposition candidates.
  - ⚠️ **Scope correction:** `lib/contextClues/*` (~491) is **prototype code** (sole consumer
    `app/components/prototypes/ContextCluesBeta.tsx`; `types.ts` self-labels "prototype") — excluded
    from grading per the permanent mock rule. Remove it from this area's scope. See reconciliation §3.
  - Findings: [`Dev/code_review_solo_practice_learn.md`](./code_review_solo_practice_learn.md) — **🔴 BLOCK**

- ✅ **9. Weekly goals & boss** — `app/goals/*`, `app/boss/*`, `convex/weeklyGoals.ts` +
  `convex/weeklyGoals/*` (⚠️ `mutations.ts` 525), `lib/weeklyGoals.ts` (423) +
  `weeklyGoalTiming.ts`, `convex/helpers/weeklyGoalSnapshots.ts`, `useWeeklyGoalThemeIds`.
  ~4.5k LOC.
  - Lifecycle state (draft/locked/grace/completed + derived `lock_proposed`) is the spaghetti risk.
  - Findings: [`Dev/code_review_weekly_goals_boss.md`](./code_review_weekly_goals_boss.md) — **🟡 APPROVE WITH CHANGES**

- ✅ **10. Spaced repetition** — `app/repetition/*` (⚠️ `RepetitionBoard.tsx` 412),
  `convex/weeklyGoalRepetitions.ts` + `convex/weeklyGoalRepetitions/*`,
  `lib/spacedRepetition.ts`. ~1.7k LOC.
  - Findings: [`Dev/code_review_spaced_repetition.md`](./code_review_spaced_repetition.md) — **🟡 APPROVE WITH CHANGES**

## Cross-cutting systems

- ✅ **11. Notifications & friends** — `app/notifications/*`
  (⚠️ `NotificationItem.tsx` 524, `FriendListItem.tsx` 344),
  `convex/{notifications,notificationHelpers,notificationPayloads,notificationPreferences}.ts`,
  `convex/friends.ts` (492), `lib/notifications/*` + templates/preferences/relationshipPolicy.
  ~3.3k LOC.
  - Note: the *email-preference* trio (`lib/notificationPreferences.ts`,
    `lib/notificationPreferencesDefaults.ts`, `convex/notificationPreferences.ts`) was reviewed here
    but conceptually belongs with Area 12 (email). See reconciliation §3.
  - Findings: [`Dev/code_review_notifications_friends.md`](./code_review_notifications_friends.md) — **🔴 BLOCK**

- ✅ **12. Email & reminders backend** — `convex/emails/*` (⚠️ `emailNotificationLog.ts` 326),
  `convex/crons.ts`. ~1.1k LOC.
  - Findings: [`Dev/code_review_email_reminders_backend.md`](./code_review_email_reminders_backend.md) — **🟡 APPROVE WITH CHANGES**

- ✅ **13. TTS pipeline** — `lib/tts/*` (`providerAdapters.ts` 307), `lib/themes/tts.ts`,
  `app/api/tts/*`, `convex/ttsGenerationLocks.ts`,
  `convex/themes/{generateThemeTtsAction,ttsPipeline}.ts`, `convex/helpers/themeTtsStorage.ts`,
  `useThemeTtsController`, `useTTS`, `useDuelAudio`. ~1.2k LOC.
  - Findings: [`Dev/code_review_tts_pipeline.md`](./code_review_tts_pipeline.md) — **🟡 APPROVE WITH CHANGES**

## Foundation & shell

- ✅ **14. Settings, preferences & appearance** — `app/settings/*`,
  appearance/background/preferences providers in `app/components/`, `lib/colorUtils.ts` (282),
  `lib/{userDisplay,displayFormat,credits,preferences}`, `convex/{userPreferences,credits}.ts`.
  ~2.2k LOC.
  - Findings: [`Dev/code_review_settings_preferences_appearance.md`](./code_review_settings_preferences_appearance.md) — **🟡 APPROVE WITH CHANGES**

- ✅ **15. App shell, auth, user sync & schema** — `app/HomePageClient.tsx` (499) +
  layout/page, shared `app/components/` (auth, Avatar, ModalShell, MenuButton, etc.),
  `hooks/{useSyncUser,usePresence}`, `convex/users.ts`,
  `convex/helpers/{auth,users,userSummary,permissions}.ts`, plus **`convex/schema.ts` (567)**
  and shared `lib/` primitives (types, constants, errors, stringUtils, timeUtils, prng,
  difficultyUtils, cleanup*). ~3.0k LOC.
  - Schema is the foundation every other area depends on.
  - Findings: [`Dev/code_review_app_shell_auth_schema.md`](./code_review_app_shell_auth_schema.md) — **🟡 APPROVE WITH CHANGES**

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
- `lib/contextClues/` (~491 LOC) — prototype-only (consumed solely by
  `app/components/prototypes/ContextCluesBeta.tsx`); discovered during Area 8. Mis-located under
  `lib/`; treat as excluded.
