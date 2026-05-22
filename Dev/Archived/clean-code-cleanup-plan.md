# Clean Code Cleanup Plan

This is the single source of truth for the remaining clean-code refactor work. It supersedes the per-feature review notes in `Dev/Archived/` — those are kept for history but should not be used as the work list. Anything missing belongs in this file.

## Goal

Finish the remaining MUST clean-code refactor items across the repo: split god-modules, push business rules out of React, centralize duplicated rules, remove hidden side effects, and make naming consistent across the stack. Behavior stays unchanged unless an item explicitly says it changes naming or boundaries.

## Already done (do not redo — verify and skip if found)

- Theme edit friendship check
- TTS storage URL theme access check
- `duplicateTheme` access check
- TTS generation strict edit permission (tied to the friendship check above; very likely also done)
- In-memory DB filter support for the tests above

If grep + tests show one of these is already implemented, log it as "verified already done" and move on.

## Out of scope (do NOT implement here)

These are tracked separately or intentionally excluded:

- Stored theme TTS provider preference change
- Atomic credit reserve/finalize/refund system
- Duel safe DTO / hide `correctOption` before reveal (separate security track)
- Spaced-repetition solo server-owned completion (separate security track)
- Friend-bounded normal challenges — product policy already enforced in `convex/challenges.ts` via `areUsersFriendsInDb`. Chunk 9 item 32 below is verify-only.
- Old `weekly_plan` → Weekly Goal rename (unless touched incidentally inside an in-scope file)
- Theme word-count validation centralization
- Notification preference normalization deduplication

## Non-negotiable rules

- **No fallback code.** Do not add compatibility branches for old/new data shapes, legacy-message matching, silent defaults that hide a broken contract, or "just in case" branches. Enforce contracts with validation/errors. (Provider degradation chains, optional-field UX defaults, retries, and offline/empty states are fine — they are product behavior, not fallbacks.)
- If you find existing fallback code in a touched area that is **not** listed for removal in a chunk below, report it and ask — do not remove it on your own.
- **Naming consistency across the entire stack.** Renames must hit routes, tables, APIs, vars, tests, docs, and UI copy. No legacy aliases left behind unless a chunk explicitly allows a transition step.
- No new dependencies, no tooling changes.
- No `any` in app code; no `@ts-ignore` without a documented reason.
- Pages wire, components render, hooks orchestrate, lib holds pure logic. Keep core rules testable without React.
- File size guideline is ~700 LOC. `convex/weeklyGoals.ts` and `app/themes/hooks/useThemesController.ts` are documented exceptions in `AGENTS.md` — splitting them (Chunks 1 and 6) is wanted.
- Update docs only when behavior or naming actually changes.
- Add or update focused tests for changed business rules. Never delete or weaken a test to get green.

---

## Chunk 1 — Weekly Goals Backend

Target: `convex/weeklyGoals.ts` (~1646 LOC, AGENTS.md exception).

1. Split `convex/weeklyGoals.ts` into focused modules: goal CRUD, lifecycle, boss orchestration, notifications, cleanup/retention, read models, snapshots.
2. Extract `lockGoal` rules into a pure/testable planner. Side effects called explicitly after the planner returns.
3. Split `completeWeeklyGoalBoss` into explicit `completeMiniBoss` and `completeBigBoss` workflows. Keep the existing big-boss effects (goal completion, repetition record creation, notifications, challenge-notification dismissal) — just make them named and explicit.
4. Enforce weekly-goal theme completion rules on the backend: centralize `canToggleGoalThemeCompletion` in shared logic and enforce it in `toggleCompletion`.
5. Make `loadWeeklyGoalSessionThemesByThemeIds` strict after lock: split into a strict snapshot loader and an explicit live-theme loader. No silent fallback. Missing snapshots post-lock must throw.

Done when: file is split, planner has unit tests, completion flows are named and separated, backend rejects invalid completion states, strict loader throws on missing post-lock snapshots.

## Chunk 2 — Weekly Goals Lifecycle / Naming

6. Move `/goals` cleanup side effects out of page load. `syncGracePeriodGoalsForUser` moves to a cron/background job, OR the page calls a clearly-named explicit user action. Page load itself must be read-only.
7. Rename spaced-repetition "boss lives" → neutral "lives" across the entire stack: `bossLivesTotal` → `livesTotal`, `bossLivesRemaining` → `livesRemaining`, `getBossMissPatch` → `getLimitedLivesMissPatch` (or similar). Hits `convex/schema.ts`, `convex/gameplay.ts`, `convex/challenges.ts`, `convex/duels.ts`, `convex/weeklyGoalRepetitions.ts`, tests, docs, UI copy. No legacy aliases.
8. Rename `bossStatus` → `bigBossStatus` and `effectiveBossStatus` → `effectiveBigBossStatus` across stack.
9. Friend-removal weekly-goal cleanup: either separate friendship removal from goal cleanup, OR make the combined behavior explicit at the API boundary (named param like `alsoCleanupSharedWeeklyGoals: true` plus matching UI confirm copy). Pick one.

Done when: page load is read-only, both renames are end-to-end with no aliases, friend-removal cleanup is explicit by name or fully separated.

## Chunk 3 — Weekly Repetition

Target: `convex/weeklyGoalRepetitions.ts` (~747 LOC).

10. Split into four modules: rules, content loading, read model, attempt mutations.
11. Replace overloaded `ready` with explicit states: `isDueNow`, `contentAvailable`, `canStart`. Update consumers and tests.

Done when: four modules exist; readiness states are explicit in types and at every call site.

## Chunk 4 — Goals Frontend

Target: `app/goals/page.tsx` (~1050 LOC).

12. Split so page wiring, state orchestration, and rendering are not all in one file. Page wires only; orchestration moves into a hook; rendering moves into focused components.

Done when: page file is thin wiring; orchestration hook is testable in isolation; rendering composed of focused components.

## Chunk 5 — Themes Backend

Target: `convex/themes.ts` (~809 LOC).

First: verify the "already done" theme items at the top of this doc; log result. Then:

13. Split `convex/themes.ts` into focused modules: queries, mutations, access policy, TTS pipeline, archive/duplicate, cleanup helpers.
14. Centralize theme list/detail access: one `canViewTheme` + `shouldListTheme` used by both `getTheme` and `getThemes`. No parallel manual visible-list builder.
15. Split `generateThemeTTS` into explicit named steps: planning → provider generation → storage → apply → cleanup. Each step is a named function with its own test.
16. Add theme-level locking (or a per-word "still empty" check at apply time) for shared theme TTS races. Add a test that proves two concurrent generations on the same theme do not orphan files.
17. Make TTS cleanup explicit: extract from inside `updateTheme` into a named lifecycle helper. Callers that need cleanup call it explicitly.

Done when: themes file is split; single source of truth for theme access; `generateThemeTTS` pipeline is 5 named steps with tests; race protection has a test; TTS cleanup is called explicitly, not hidden in updates.

## Chunk 6 — Themes Frontend / Shared Hooks

Targets: `app/themes/hooks/useThemesController.ts` (~1105 LOC, AGENTS.md exception), `app/components/ThemeProvider.tsx`.

18. Split `useThemesController` into focused hooks/controllers: list, detail edit, generation, TTS, modal/navigation.
19. Remove duplicated client-side theme-name uppercase normalization. Use the single shared helper (likely already in `lib/themes/serverValidation.ts`) everywhere. `useThemeActions.update` must not silently uppercase.
20. Split word edit/generation rules: pure logic moves to shared lib; hooks consume it. Resolve overlap between `useWordEditor` and `useThemesController`.
21. Rename visual `ThemeProvider` to avoid clashing with learning-content "Theme". Use `AppearanceProvider`. Apply across stack: file rename, all imports, `ThemedPage` references, tests, docs. No alias kept.

Done when: hook is decomposed; one normalizer; rename consistent everywhere; word edit/generation rules live in lib with focused hooks on top.

## Chunk 7 — AI Generation API

Target: `app/api/generate/route.ts` (~781 LOC).

22. Split into: route adapter (HTTP only), generation service (workflow), OpenAI adapter (provider call + local response validation), validators (word-type-aware), response shaping.
23. Stop returning `prompt`/debug data in normal generation responses. Gate behind an explicit dev flag if needed; default off in all environments.
24. Enforce word-type rules in validation, not only in prompts: noun articles, verb infinitive markers, adjective/adverb rules per `lib/themes/wordTypes.ts`. Invalid generations are rejected by the validator regardless of prompt wording.

Done when: route is HTTP-only; validators reject invalid word types deterministically; prod responses contain no prompt/debug payload (asserted in a test).

## Chunk 8 — TTS API / Provider Cleanup

Target: `app/api/tts/route.ts` (~419 LOC). Splitting is responsibility-based, not size-based.

25. Split into: route adapter, provider adapters (Resemble, ElevenLabs), TTS orchestration service.
26. Create one shared Resemble/TTS provider abstraction used by both live TTS (`app/api/tts/route.ts`) and stored theme TTS (`convex/helpers/resembleTts.ts`). Single config, single fallback policy, single preset behavior.
27. Centralize TTS provider type/default/options. `"resemble" | "elevenlabs"` and the default value live in one module, imported by schema, Convex, API routes, hooks, and UI.
28. Rename `getOrCreateResemblePreset` → `ensureRemoteResemblePreset`. Name must make clear it calls the external provider and mutates remote state. Apply rename across stack.

Done when: providers implement one interface; types/defaults imported from one place everywhere; rename is consistent; live and stored TTS share the same provider abstraction.

## Chunk 9 — Duel / Challenge Runtime

Targets: `app/duel/[duelId]/DuelSession.tsx` (~619 LOC), `app/duel/[duelId]/hooks/useSabotageEffect.ts`, `hooks/useChallengeLobby.ts` (~277 LOC).

29. Reduce `DuelSession` controller responsibilities: extract sub-controllers/hooks for current question, feedback state, hints, sabotage, actions. `DuelSession` becomes a thin shell.
30. Separate sabotage timer/phase rules from React effect wiring. Pure rules module + thin effect hook consuming it. Track all timeout IDs; clear on unmount and on question change. Add a test that mounts/unmounts mid-question and asserts no pending timers.
31. Split `useChallengeLobby` responsibilities: modal state, Convex calls, routing, toasts, waiting status, solo launch. The 277 LOC size is fine; the responsibility mix is the problem.
32. Verify-only: normal challenges remain friend-bounded (already enforced via `areUsersFriendsInDb` in `createChallenge`). Confirm test coverage exists; if not, add a test that locks this in. Do not change the rule.

Done when: `DuelSession` is a shell over sub-hooks; sabotage rules are pure and tested; `useChallengeLobby` is split; friend-bounded invariant has a test.

---

## Progress log

Append progress to `Dev/clean-code-progress.md` (create if missing) per chunk:

```
## Chunk N — <title>
- Done: <item numbers>
- Skipped/Deferred: <bullets with reason>
- Risks: <bullets>
```

If interrupted, re-read this plan and the progress file, then resume at the first item not marked Done. Do not restart completed chunks.
