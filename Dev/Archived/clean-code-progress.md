## Chunk 1 — Weekly Goals Backend
- Done: 1, 2, 3, 4, 5
- Skipped/Deferred: none
- Risks:
  - `convex/weeklyGoals.ts` is split into focused helpers/workflow modules. Public read-model logic now delegates to `convex/weeklyGoals/queries.ts`, and gameplay calls `completeMiniBoss` / `completeBigBoss` directly instead of the removed combined completion helper.
  - The strict snapshot loader is now enforced for all non-draft weekly-goal session loading, so any old locked goal without snapshots will now fail instead of using live themes.

## Chunk 2 — Weekly Goals Lifecycle / Naming
- Done: 6, 7, 8, 9
- Skipped/Deferred: none
- Risks:
  - Stored Convex lifecycle/lives fields were renamed in code/schema. Existing persisted data needs review/migration before this runs against a database that still contains the pre-cleanup field names.
  - The old user-triggered retention mutation was removed; `cleanupWeeklyGoalRetention` is the only retained retention owner.

## Chunk 3 — Weekly Repetition
- Done: 10, 11
- Skipped/Deferred: none
- Risks:
  - `weeklyGoalRepetitions.ts` now delegates rules, content loading, read-model shaping, and attempt mutation helpers to focused modules; the public Convex function file remains as API wiring.

## Chunk 4 — Goals Frontend
- Done: 12
- Skipped/Deferred: none
- Risks:
  - The route file is thin, goal selection stays in `useGoalsController`, and page-level queries/mutations/effects/derived flags now live in `useGoalsPageModel`. `GoalsPageContent` is still a large render component and should be split further if this screen grows again.

## Chunk 5 — Themes Backend
- Done: 13, 14, 15, 16, 17
- Skipped/Deferred:
  - Verified already done: theme edit friendship check, TTS storage URL theme access check, `duplicateTheme` access check, TTS generation strict edit permission, and in-memory DB filter support.
- Risks:
  - `convex/themes.ts` remains the public Convex API wiring file, with focused helper modules for access policy, list/read models, duplicate/archive helpers, TTS pipeline, and cleanup helpers.
  - Stored theme TTS generation still consumes credits after successful storage, matching existing behavior; the out-of-scope atomic reserve/finalize/refund system was not changed.

## Chunk 6 — Themes Frontend / Shared Hooks
- Done: 18, 19, 20, 21
- Skipped/Deferred: none
- Risks:
  - `useThemesController` is now a thin orchestrator over focused list, detail, generation, TTS, and word-edit hooks. The generation and word-edit hooks still own async UI workflow details, but pure word-edit application rules now live in `lib/themes/wordEditing.ts` with tests.
  - Visual color-set context is renamed to `AppearanceProvider`; only the cleanup plan/history notes still mention the old `ThemeProvider` name.

## Chunk 7 — AI Generation API
- Done: 22, 23, 24
- Skipped/Deferred: none
- Risks:
  - `/api/generate` now only includes prompt/debug payloads when `GENERATE_API_INCLUDE_DEBUG_PROMPT=true`; normal success and validation responses omit prompts.
  - Word-type validation is deterministic and stricter than prompt-only guidance, especially noun article checks, verb infinitive checks, marker bans, and obvious plural-form rejection for adjective/adverb outputs.

## Chunk 8 — TTS API / Provider Cleanup
- Done: 25, 26, 27, 28
- Skipped/Deferred: none
- Risks:
  - Live TTS and stored theme TTS now share the same provider adapters, fallback order, and Resemble preset behavior. Stored theme TTS still does not expose a user-facing provider preference, but it now uses the shared default/fallback chain instead of a separate Resemble-only helper.
  - `convex/helpers/resembleTts.ts` was removed; provider implementation now lives in `lib/tts/providerAdapters.ts`, with provider IDs/default/options in `lib/tts/providers.ts`.

## Chunk 9 — Duel / Challenge Runtime
- Done: 29, 30, 31, 32
- Skipped/Deferred: none
- Risks:
  - `DuelSession` is smaller and delegates answer-lock state, type reveal, outgoing sabotage status, and duration tracking to hooks, but it still owns the high-level duel view composition and mutation callbacks.
  - `useChallengeLobby` now composes focused challenge lobby hooks from `hooks/challengeLobby/`; exported helper hooks are preserved through the main module.
  - Normal challenge friend-bounding remains enforced in `createChallenge`, with a regression test for non-friend rejection.

## Follow-up cleanup — 2026-05-16
- Done: Chunk 1 public weekly-goal mutation bodies now delegate to `convex/weeklyGoals/mutations.ts`; retention cleanup delegates to `convex/weeklyGoals/cleanup.ts`.
- Done: Chunk 4 `GoalsPageContent` now composes focused panels for creation, participants, timing, boss progress, practice, and the practice modal instead of rendering the full screen inline.
- Done: Chunk 5 `generateThemeTTS` now delegates the stored-TTS action workflow to `convex/themes/generateThemeTtsAction.ts`.
- Done: Chunk 9 `DuelSession` is now a thin shell over `useDuelSessionViewModel`; the route component no longer owns mutations, phase transitions, question derivation, hint rules, answer handling, or `DuelView` prop assembly.
- Done: Chunk 2 naming residue `resolveBossLives` was renamed to `resolveBossChallengeLives`.
- Skipped/Deferred: none.
- Risks:
  - These changes are structural only; validation should confirm no behavior drift.

## Follow-up cleanup round 2 — 2026-05-16
- Done: Chunk 3 `convex/weeklyGoalRepetitions.ts` is now thin Convex wiring; board read model, challenge creation, solo practice, and duel completion live in `convex/weeklyGoalRepetitions/{board,challengeCreation,soloPractice,duelCompletion}.ts`.
- Done: Chunk 5 `convex/themes.ts` is now thin Convex wiring; all mutation bodies (create/update/delete/duplicate/visibility/friendsCanEdit/apply-TTS/archive) live in `convex/themes/mutations.ts`; non-list query helpers live in `convex/themes/queries.ts`.
- Done: Chunk 5 awkward `as Parameters<typeof reconcileThemeWordTts>` casts in `updateTheme` are gone; `lib/themes/tts.ts` types are now generic over the storage-id type, so Convex `Id<"_storage">` flows through without unsafe casts.
- Done: Chunk 9 `useDuelSessionViewModel` split: answer-phase machine (`useDuelPhaseState`), write-side handlers (`useDuelActions`), and view-prop assembly (`buildDuelViewProps` + `deriveHintFlags`) are now separate. The main hook is composition only.
- Skipped/Deferred: none.
- Risks:
  - Structural-only changes; behavior unchanged. Validation passed: `npm run typecheck`, `npm run lint`, `npm run test:run` (704 tests passed).
