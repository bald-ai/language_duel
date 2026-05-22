# Game / Solo / Duel Runtime Clean Code Review

Review scope: Game / Solo / Duel Runtime: gameplay loop, scoring, hints, sabotage, duel/solo session orchestration.

Review principles:
- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

This was a focused read-only review of the Area A runtime paths. Existing shared UI/hook findings are only repeated where they directly affect gameplay correctness.

## Must

1. **Duel answer keys are exposed to both clients before the answer is submitted**
   - Files: `convex/duels.ts:39-44`, `app/duel/[duelId]/page.tsx:28-70`, `app/duel/[duelId]/DuelSession.tsx:129-130`, `convex/rules/duelGameplayRules.ts:45-56`
   - Problem: `getDuel` returns the full `duel` document, including `duel.duelQuestions`. Each question snapshot contains `correctOption`, and `DuelSession` reads `duel.duelQuestions![index]` directly. The backend then scores by checking `selectedAnswer === currentQuestion.correctOption`.
   - Why it matters: any participant can inspect the Convex query payload and know the correct option before answering. This breaks duel fairness and makes scoring client-trust-based in practice.
   - Direction: return a viewer-safe question DTO from `getDuel` that hides `correctOption` until feedback/results are allowed, and keep authoritative scoring on the server.

2. **Spaced-repetition solo completion is trusted from client-local state**
   - Files: `app/solo/[sessionId]/page.tsx:178-198`, `convex/weeklyGoalRepetitions.ts:611-680`
   - Problem: the page calls `completeRepetitionSoloPractice` when the local React hook says `session.completed`. The mutation only verifies session ownership/source/step, then advances repetition and writes perfect `finalStats` using `wordCount` for both answered and correct.
   - Why it matters: a user can complete a spaced-repetition step without the server seeing any answered questions. This is a real correctness boundary issue because repetition progress is durable product state.
   - Direction: persist solo answer/progress events server-side for repetition sessions, or make the completion mutation validate a server-owned attempt state before advancing.

3. **`convex/gameplay.ts` still owns boss and spaced-repetition completion side effects**
   - Files: `convex/gameplay.ts:23-54`, `convex/rules/duelGameplayRules.ts:131-137`, `convex/weeklyGoals.ts:1143-1160`, `convex/weeklyGoalRepetitions.ts:471-520`
   - Problem: answering the final duel question patches normal duel completion, then conditionally completes weekly-goal bosses and spaced-repetition duels. The helper names look like gameplay progression, but the mutation can complete goals, advance repetition records, and trigger wider lifecycle effects through imported domain modules.
   - Why it matters: this makes the gameplay loop hard to reason about and hard to test safely. A small answer-flow change can silently affect weekly-goal or repetition state.
   - Direction: have gameplay produce an explicit attempt-completion result, then call separate boss/repetition completion commands with clear names and tests around each workflow.

4. **Session source contracts are too loose for normal, boss, and spaced-repetition attempts**
   - Files: `convex/schema.ts:253-288`, `convex/helpers/sessionCreation.ts:71-153`, `convex/challenges.ts:63-88`
   - Problem: `sourceType`, `weeklyGoalId`, `bossType`, `spacedRepetitionStep`, and lives fields are optional pieces that can be combined incorrectly. The builders mostly copy whatever combination they receive; `insertDuelSessionForChallenge` derives lives from `sourceType`, but does not enforce a single valid shape before insertion.
   - Why it matters: runtime code later has to infer intent from partial fields, for example `isBossAttempt`, `isLivesAttempt`, and `shouldCompleteSpacedRepetitionDuel`. That keeps correctness spread across schema, builders, scoring, and lifecycle code.
   - Direction: introduce discriminated builders/contracts for `normal`, `boss`, and `spaced_repetition` attempts, and reject invalid combinations at creation time.

5. **Solo practice business rules are duplicated and mostly live inside a React hook**
   - Files: `app/solo/[sessionId]/hooks/useSoloSession.ts:100-177`, `app/solo/[sessionId]/hooks/useSoloSession.ts:190-253`, `app/solo/[sessionId]/hooks/useSoloSession.ts:258-355`, `convex/helpers/gameLogic.ts:111-318`, `convex/helpers/duelInitialization.ts:38-84`
   - Problem: solo progression, pool expansion, level choice, random selection, and mastery updates live in `useSoloSession`, while similar seeded pure helpers exist in `convex/helpers/gameLogic.ts` and `convex/helpers/duelInitialization.ts`. The active UI path uses `Math.random()` and local React state instead of a shared/testable runtime reducer.
   - Why it matters: solo behavior is difficult to test as business logic, can drift from backend helpers, and cannot support server-validated progress without another rewrite.
   - Direction: extract the active solo state machine into shared pure logic with an injected RNG/seed, then let React only render and dispatch actions.

## Might

1. **`DuelSession` is still a large runtime controller**
   - Files: `app/duel/[duelId]/DuelSession.tsx:53-127`, `app/duel/[duelId]/DuelSession.tsx:150-227`, `app/duel/[duelId]/DuelSession.tsx:324-442`, `app/duel/[duelId]/DuelSession.tsx:517-607`
   - It owns local phase state, answer locking, frozen feedback, type reveal, timer wiring, hint mutations, sabotage status, audio, routing, toasts, and DTO assembly.
   - Direction: split into a duel controller hook plus smaller pure view-model helpers for current question, feedback state, hints, sabotage, and actions.

2. **Hint rules are split between backend mutations, scoring helpers, and UI state**
   - Files: `convex/hints.ts:21-136`, `convex/rules/duelScoringRules.ts:82-110`, `app/duel/[duelId]/DuelSession.tsx:486-498`, `app/game/components/duel/HintSystemUI.tsx:70-106`
   - Backend owns request/accept/eliminate rules, scoring helper owns provider bonus, and UI derives who can request/accept/eliminate. These can drift.
   - Direction: centralize a `getHintStateForRole` / `applyHintEvent` rule set and have UI consume the resulting state.

3. **Sabotage active-duration semantics are duplicated across server/shared/client code**
   - Files: `convex/sabotage.ts:36-54`, `lib/sabotage/active.ts:12-69`, `app/duel/[duelId]/hooks/useSabotageEffect.ts:62-81`, `app/duel/[duelId]/DuelSession.tsx:341-378`
   - Shared logic determines outgoing active state, while the incoming visual hook separately hardcodes persistent effects and timers.
   - Direction: expose shared sabotage classification/timing helpers for both mutation validation and client rendering.

4. **Auto-advance timers in solo practice are not lifecycle-safe**
   - Files: `app/solo/[sessionId]/hooks/useSoloSession.ts:307-310`, `app/solo/[sessionId]/hooks/useSoloSession.ts:352-355`
   - The hook schedules delayed `selectNextQuestion` calls without tracking or clearing them. This overlaps with the existing reusable UI/shared-hooks review, but it matters here because duplicate clicks, navigation, or unmounts can still advance stale local gameplay state.
   - Direction: track timeout IDs and clear them on unmount/question change, or make answer handling idempotent through a reducer phase.

5. **Scoring constants are split between Convex and shared duel difficulty helpers**
   - Files: `convex/constants.ts:61-73`, `lib/difficultyUtils.ts:15-27`, `convex/rules/duelScoringRules.ts:82-110`, `lib/answerShuffle.ts:25-27`
   - Duel question points come from `lib/difficultyUtils.ts`, while hint bonus and old point constants live in `convex/constants.ts`.
   - Direction: keep one gameplay scoring constants module for duel question points and hint bonuses.

6. **`duelInitialization` and parts of `gameLogic` look like dead or future-state runtime code**
   - Files: `convex/helpers/duelInitialization.ts:16-84`, `convex/helpers/gameLogic.ts:222-318`, `convex/constants.ts:24-37`
   - `duelInitialization` exports solo-like per-player state that is not referenced by the active runtime, and the related constants are marked `[NOT ACTIVE]`.
   - Direction: either remove this path or clearly move it to a future/experimental area so it does not look like active duel runtime.

7. **Duel duration is client-local, not session-owned**
   - Files: `app/duel/[duelId]/DuelSession.tsx:90-99`, `app/duel/[duelId]/DuelSession.tsx:286-299`, `app/game/components/duel/FinalResultsPanel.tsx:74-81`
   - The displayed duration starts from the viewer's local first answering phase and is calculated on that client at completion.
   - Direction: if duration matters, derive it from server timestamps; if it is just decorative, name it as local/display-only.

8. **Normal challenge content is resolved at accept time, not invite time**
   - Files: `convex/challenges.ts:48-60`, `convex/challenges.ts:177-185`, `convex/helpers/sessionCreation.ts:71-103`
   - A challenge stores only theme IDs, then builds session words when accepted. Edits between invite and accept can change the actual duel content.
   - Direction: decide whether this is intended. If invites should be stable, snapshot words at challenge creation.

## Ignore / Low Priority

1. **Duel UI still has some presentation duplication**
   - `DuelView` repeats option rendering for normal, bounce, and trampoline layouts. This is not the main runtime risk while scoring and completion boundaries are still loose.

2. **Some display copy is rough**
   - Example: hint buttons use playful labels in `app/duel/[duelId]/components/DuelView.tsx:603-604`. Product copy cleanup is lower priority than runtime correctness.

3. **`getDuel` also returns live theme names for display**
   - `convex/duels.ts:36-43` reloads themes for labels, but authoritative playable words already come from `duel.sessionWords`. This is acceptable unless stable historical theme labels become important.

4. **Frontend/backend validation duplication for friendly UI**
   - Some duplication is acceptable when backend remains authoritative. The problem cases above are where backend is not authoritative enough.

## Validation

No code changed. No validators were run because this is a documentation-only review note.
