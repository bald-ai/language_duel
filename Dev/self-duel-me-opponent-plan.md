# Self-Duel ("Me" Opponent) Plan

Final plan after 3 review iterations. Raw functionality only — no text/label cleanup, no design polish.

## Goal
Allow a user to play a duel against themselves from the classic Challenge flow.

## Product Behavior
- ChallengeModal opponent area shows a fixed "Me" row above the friends list. The Me row renders whenever the viewer query has resolved (`viewer != null`).
- Selecting "Me" hides the Mode picker (self-duels are PvE only). Difficulty and theme pickers stay visible. `selectedMode` is intentionally not reset to `"pve"` in local state — it is ignored on the self path and resetting would be noise.
- Pressing "Create Challenge" with "Me":
  - Calls a new mutation that skips the invite/accept dance entirely.
  - No `challenges` row, no notification, no WaitingModal, no success toast.
  - On failure surfaces a `toast.error` (mirroring the friend / accept paths).
  - Routes straight to `/duel/[duelId]` (reusing the existing JoiningModal).
  - The Cancel button is disabled while `isJoiningDuel || isCreatingChallenge` is true. (For the self path the modal is closed before `isJoiningDuel` flips, so the disabled binding mainly protects the friends-path; kept for parity.)
- Inside the duel the user plays the challenger side; each answer/timeout is mirrored to the opponent side server-side so the duel advances after one input.
- Self-duels are PvE-only:
  - Sabotage and PvP request/accept-hint UI are removed automatically by PvE.
  - The PvE shared hint pool (50/50, +15 Seconds, Anagram, Letter Count) works as in co-located PvE.

## Shared single-source helpers (`lib/`)

These exist so the same rule is never written twice. Each has a `*.test.ts` next to it.

### S1. `lib/duel/selfDuel.ts` — single source for the self-duel concept
- `export const SELF_DUEL_FORCED_MODE = "pve" as const;` — the one place that names the product rule "self-duels are PvE only".
- `export function isSelfDuel(duel: Pick<Doc<"duels">, "challengerId" | "opponentId">): boolean` → `duel.challengerId === duel.opponentId`.
- Pure (no React, no Convex client). Imported by `convex/`, hooks, and the view model. The convex schema `Doc` type is the only type import; the helper does not pull `convex/react`.
- Document the invariant in this file: in a self-duel `getDuelParticipant` returns `isChallenger: true` AND `isOpponent: true`, and `playerRole` resolves to `"challenger"` (ternary). Gameplay code must treat `isChallenger` as canonical and avoid `isOpponent`-only branches.

### S2. `lib/challengeLobby/isSelfDuelSelection.ts` — single source for the UI/lobby branch
- `export function isSelfDuelSelection(viewer: { _id: Id<"users"> } | null | undefined, opponentId: Id<"users"> | null | undefined): boolean`.
- Returns `false` if `viewer == null` or `opponentId == null`. Otherwise `viewer._id === opponentId`.
- Pure. Imported by `ChallengeModal` and `useChallengeLobby` so the rule is defined exactly once.

### S3. `convex/helpers/resolveAccessibleThemes.ts` — single source for theme-access validation
- `resolveAccessibleThemes(ctx, userId, themeIds): Promise<Doc<"themes">[]>`.
- Dedupes ids, rejects empty with `INVALID_INPUT`, calls `loadThemeWithViewerAccess` per id, rejects any `null` with `NOT_FOUND` ("One or more themes were not found or are not accessible"), returns the resolved non-null array.
- Existing `createChallenge` is refactored to call this helper; `createSelfDuel` (§1) calls the same helper. No second hand-rolled copy of the rule.

### S4. `convex/rules/selfDuelMirror.ts` — single source for the mirror step
- `mirrorPatchForSelfDuel<T extends AnswerPatch | TimeoutPatch>(patch: T, duel: Doc<"duels">): T`.
- If `!isSelfDuel(duel)`: return `patch` unchanged.
- If self-duel: return a new patch where the opponent half is copied from the challenger half (`opponentAnswered`, `opponentLastAnswer`, `opponentScore` mirror their `challenger*` siblings). Field-overwrite only; no second `getLimitedLivesMissPatch` call (it is a no-op for `sourceType: "normal"` and we keep the rule so self-duels can later widen to boss/SR without double-decrementing).
- Pure. Imported by `gameplay.ts` after `buildAnswerPatch` / `buildTimeoutPatch`.
- Has its own focused unit tests.

## Backend changes (`convex/`)

### 1. New mutation `createSelfDuel` in `convex/challenges.ts`
- Args: `themeIds: Id<"themes">[]`, `duelDifficultyPreset?: DuelDifficultyPreset`. No `duelMode` arg — hardcoded to `SELF_DUEL_FORCED_MODE` (imported from `lib/duel/selfDuel.ts`).
- Auth: `getAuthenticatedUser`; `user._id` is used for both `challengerId` and `opponentId`.
- No friend check (skips `areUsersFriendsInDb`).
- Validation: call the shared `resolveAccessibleThemes(ctx, user._id, themeIds)` helper (S3). No duplicated dedupe/empty/null logic.
- Session words: pass the array returned by `resolveAccessibleThemes` directly to `buildSessionWords(themes)`. One read pass; the resolved array IS the words source — the invariant is "access and words come from the same load", noted in a one-line comment at the call site. Reject an empty result with `INTERNAL_ERROR` ("Self-duel has no playable words").
- Insert via `buildDuelSession({ sourceType: "normal", challengeId: undefined, challengerId: user._id, opponentId: user._id, sessionWords, duelMode: SELF_DUEL_FORCED_MODE, duelDifficultyPreset, createdAt: now })`.
- Returns `{ duelId }`. No notifications, no email triggers.
- `buildChallengeInvite`'s existing self-target guard stays — deliberate, since the self path must never write to `challenges`.

### 2. `isSelfDuel` consumed from `lib/duel/selfDuel.ts`
- `convex/rules/duelGameplayRules.ts` re-exports nothing new for this concept; gameplay code imports `isSelfDuel` directly from `lib/duel/selfDuel.ts`.
- Existing references in convex modules are updated to use the shared helper. There is no second definition.

### 3. Mirror answer as an explicit post-builder step (NOT inside the builders)
- `buildAnswerPatch` and `buildTimeoutPatch` stay single-purpose. They do NOT learn about self-duels. Their names continue to honestly describe what they do.
- In `gameplay.ts`, right after the builder call, run `patch = mirrorPatchForSelfDuel(patch, duel)` (S4). For non-self-duels this is a pass-through; for self-duels it copies the challenger half onto the opponent half. The mirror step:
  - Sets `opponentAnswered = challengerAnswered` (which is `true`).
  - Sets `opponentLastAnswer = challengerLastAnswer` (the same selectedAnswer or `TIMEOUT_ANSWER`).
  - For answer patches: `opponentScore = challengerScore` (whichever `nextScore` the builder produced).
  - For timeout patches: scores are untouched in the original patch and therefore remain equal.
  - Never calls `getLimitedLivesMissPatch` a second time. Rule preserved for the boss/SR widening later.
- `haveBothPlayersAnswered` returns true after a single input, so existing advance logic in `gameplay.ts` is unchanged. `getHintClearFields` already resets per-round PvE state (`currentQuestionHintFired`, `currentQuestionHintReveal`, `eliminatedOptions`, `countdownSkipRequestedBy`).
- PvP hint fields (`hintRequestedBy`, `hintAccepted`, `eliminatedOptions`, `questionTimerPausedAt`) are never written in self-duels because the trigger conditions (other-side-answered-first) are unreachable; no mirror needed.

### 4. Countdown rules extracted to pure planners (`convex/rules/countdownPlanners.ts`)
Two pure functions own the decision; the mutations in `convex/gameplay.ts` call effects after.

- `planConfirmUnpauseCountdown(duel, now): { kind: "noop" } | { kind: "clearImmediately", questionStartTime } | { kind: "requirePeer" }`.
  - `noop` when `!duel.countdownPausedBy`.
  - `clearImmediately` when `isSelfDuel(duel)` and `duel.countdownPausedBy` exists. Computes the adjusted `questionStartTime` (existing pause-duration math). Does NOT require `countdownUnpauseRequestedBy`. Does NOT reject same-user.
  - `requirePeer` otherwise (existing two-player behavior; the mutation then runs the existing same-user reject / unpause-request requirement checks).
- `planSkipCountdown(duel, userRole): { skipRequestedBy: PlayerRole[]; bothSkipped: boolean }`.
  - For self-duel: `{ skipRequestedBy: ["challenger", "opponent"], bothSkipped: true }`.
  - For two-player: existing dedupe-then-append behavior, `bothSkipped = skipRequestedBy.length === 2`.

The mutations stay thin: they call the planner, then patch the DB according to the decision. This matches the existing `lockGoal` planner pattern, lets us unit-test the rule without booting Convex, and keeps `gameplay.ts` focused on effects.

- `pauseCountdown` unchanged. It pauses normally.
- `requestUnpauseCountdown` unchanged. The client will not call it for self-duels — see §13.

### 5. Sabotage unchanged
- PvE self-duels never reach `sendSabotage` because `assertDuelMode("pvp")` already throws. Forcing `duelMode: "pve"` makes a separate self-duel guard unnecessary.

### 6. Untouched but verified
- `convex/hintPool.ts` `fireHint`: independent of role/answered flags. PvE self-duels fire hints normally. `hintPoolUsed` is intentionally cumulative-per-duel and not reset by `getHintClearFields`.
- `convex/hints.ts` `requestHint` / `acceptHint` / `eliminateOption`: gated on `assertDuelMode("pvp")` → unreachable in self-duels.
- `convex/duels.ts` `getDuel`: `viewerRole` resolves to `"challenger"` (isChallenger-first); `buildViewerSafeDuel` reveals the answer once `challengerAnswered` flips, which the mirror flips on the same call.
- `convex/duels.ts` `stopDuel`: works unchanged; page-level redirect handles `"stopped"`.
- `useChallengeStatusWatcher`: inert (no `waitingChallengeId` for self).
- `convex/admin.ts` and `convex/helpers/themeAccess.ts` merge `by_challenger` + `by_opponent` and will see a self-duel twice. Delete is idempotent (`deleteOnce`); theme access is set-based — both safe today. Accepted for v1; no extra work in this plan.

## Frontend changes (`app/`, `hooks/`)

### 7. Viewer in challenge lobby data
- `hooks/challengeLobby/useChallengeData.ts`: load `useQuery(api.users.getCurrentUser, shouldLoad ? {} : "skip")` (gated like the other modal data for pattern consistency). Expose a new field `viewer: { _id, name, nickname, discriminator } | null | undefined` alongside `users` (friends-only).
- Tri-state preserved: `undefined` while loading, `null` if unauthenticated, object once loaded. The Me row in §8 renders only when `viewer != null`.

### 8. ChallengeModal: derive `isSelfSelected` at root via the shared helper, thread booleans down
- Compute `const isSelfSelected = isSelfDuelSelection(viewer, selectedOpponentId);` at `ChallengeModal`'s top level, importing the predicate from `lib/challengeLobby/isSelfDuelSelection.ts` (S2). No second inline copy of the rule.
- Pass `viewer` and `isSelfSelected` into `ChallengeCreateSurface`; pass `viewer` into `OpponentSelector`.
- `OpponentSelector`:
  - When `viewer != null`, render an explicit "Me" row at the top UNCONDITIONALLY (survives the `users === undefined` loading branch and the `users.length === 0` empty branch). The friends section renders below with its existing loading/empty branches.
  - Me row uses a hardcoded label `"Me"` (NOT routed through `formatVisibleUser`).
  - Selecting it sets `selectedOpponentId = viewer._id`.
  - Test id: `duel-modal-opponent-me` (consistent with `duel-modal-opponent-*`).
- `ChallengeModal` "Selected" footer lookup:
  ```ts
  const selectedOpponent = isSelfSelected
    ? viewer
    : (users?.find((u) => u._id === selectedOpponentId) ?? null);
  ```
- `ChallengeCreateSurface`:
  - When `isSelfSelected`, hide the Mode picker section entirely. This is UI mirroring of the product rule named in `SELF_DUEL_FORCED_MODE` (S1) — the backend remains authoritative; the UI just stops offering a choice that the server would override.
  - Difficulty picker stays visible.

### 9. Separate self-duel action in `hooks/challengeLobby/useChallengeActions.ts`
- Add `useMutation(api.challenges.createSelfDuel)`.
- Add exported `handleCreateSelfDuel(options: { themeIds, duelDifficultyPreset? })` returning `{ duelId }`.
  - No success toast.
  - Does not touch `waitingChallengeId` / `onChallengeCreated`.
- `handleCreateChallenge` shape unchanged.

### 10. Branching + error handling in `useChallengeLobby.ts`
- Expose `viewer` from the lobby hook.
- When `isSelfDuelSelection(viewer, opponentId)` is true (same shared helper as §8 — single source of the rule):
  - `modals.closeModal()`.
  - `setIsJoiningDuel(true)`.
  - ```ts
    try {
      const { duelId } = await actions.handleCreateSelfDuel({ themeIds, duelDifficultyPreset });
      router.push(`/duel/${duelId}`);
    } catch (error) {
      console.error("Failed to start self-duel:", error);
      toast.error("Failed to start duel. Please try again.");
    } finally {
      setIsJoiningDuel(false);
    }
    ```
- Else: existing path through `handleCreateChallenge` + WaitingModal.

### 11. Modal buttons disabled while busy
- `ChallengeModal` Cancel: `disabled={isJoiningDuel || isCreatingChallenge}`. (Mainly protects the friends path — the self path closes the modal before `isJoiningDuel` flips. Kept for parity.)
- `ChallengeModal` Create: `disabled={!canCreate || isCreatingChallenge || isJoiningDuel}`. This is minor UI safety: while accepting/joining an incoming duel, do not leave the create button clickable in the still-visible modal.

### 12. Create button branching
- Modal still calls `onCreateChallenge(options)` with the existing `CreateChallengeOptions` shape, including `duelMode`. The branching lives in `useChallengeLobby`. When `isSelfDuelSelection(viewer, opponentId)` is true, the lobby ignores/strips that mode before calling `handleCreateSelfDuel`, because the self-duel mutation has no `duelMode` arg and hardcodes `SELF_DUEL_FORCED_MODE`.
- `selectedMode` local state stays as-is on the self path. To keep the naming rule honest (a name that lies about whether the value is read is a #6 violation), add a one-line comment at its declaration: `// Intentionally unread when isSelfSelected; backend forces SELF_DUEL_FORCED_MODE.` so the next reader does not chase a dead branch.

### 13. Self-duel resume wiring in `useDuelSessionViewModel`
- Import `isSelfDuel` from `lib/duel/selfDuel.ts` (S1) — same helper the backend uses. No inline `duel.challengerId === duel.opponentId` recomputation.
- In the `callbacks` object passed to `buildDuelViewProps`, swap the resume callback:
  ```ts
  onRequestUnpause: isSelfDuel
    ? actions.confirmUnpauseCountdown
    : actions.requestUnpauseCountdown,
  ```
- This makes `CountdownControls`' "Paused, no unpause request" branch button hit the relaxed `confirmUnpauseCountdown` mutation directly for self-duels. No deeper changes to `CountdownControls` required.
- `onConfirmUnpause` stays wired to `actions.confirmUnpauseCountdown` for parity; the friends path uses it for the second-player confirmation step.
- Pause and Skip controls remain visible; their server-side behavior is already patched in §4.
- Pass the new `viewer` prop through every `ChallengeModal` call site:
  - `app/HomePageClient.tsx`
  - `app/notifications/components/FriendDuelLauncher.tsx`

## Tests
- `lib/duel/selfDuel.test.ts`:
  - `isSelfDuel` returns `true` when ids match, `false` otherwise.
  - `SELF_DUEL_FORCED_MODE === "pve"` (locks the named constant so a silent rename can't drift).
- `lib/challengeLobby/isSelfDuelSelection.test.ts`:
  - Returns `false` for `viewer == null`, `viewer == undefined`, `opponentId == null`.
  - Returns `true` only when `viewer._id === opponentId`.
- `convex/helpers/resolveAccessibleThemes.test.ts` (or extended existing test):
  - Empty input → `INVALID_INPUT`.
  - Any inaccessible id → `NOT_FOUND`.
  - Happy path returns the deduped non-null `Doc<"themes">[]`.
- `convex/rules/selfDuelMirror.test.ts`:
  - Non-self-duel patch passes through unchanged.
  - Self-duel answer patch mirrors `opponentAnswered`, `opponentLastAnswer`, `opponentScore` from the challenger fields.
  - Self-duel timeout patch mirrors `opponentAnswered` and `opponentLastAnswer`; scores untouched and equal.
  - Idempotent: applying the mirror twice yields the same patch (no double-decrement risk).
- `convex/rules/countdownPlanners.test.ts`:
  - `planConfirmUnpauseCountdown` returns `noop` when not paused.
  - Returns `clearImmediately` for a self-duel regardless of `countdownUnpauseRequestedBy` and same-user state, with the correct adjusted `questionStartTime`.
  - Returns `requirePeer` for a non-self-duel.
  - `planSkipCountdown` returns `["challenger","opponent"]` + `bothSkipped: true` for self-duel.
  - Non-self-duel preserves existing dedupe behavior.
- `createSelfDuel`:
  - Inserts a `duels` row with `challengerId === opponentId === user._id`, `duelMode === "pve"`, `sourceType === "normal"`.
  - No `challenges` row, no notifications/emails.
  - Rejects empty `themeIds` (`INVALID_INPUT`) and inaccessible themes (`NOT_FOUND`).
- Gameplay integration (`gameplay.ts` answer + timeout mutations):
  - Builders alone produce single-half patches (existing behavior unchanged).
  - After `mirrorPatchForSelfDuel`, self-duel patches have both answered flags flipped on one call, both `lastAnswer` mirrored, and (for answer) both scores equal to the same `nextScore`; (for timeout) both scores unchanged and equal.
  - `getLimitedLivesMissPatch` is invoked at most once per call for `sourceType: "normal"`.
- `haveBothPlayersAnswered` returns `true` after a single self-answer.
- Full-duel completion: a single self-answer on the last question patches `status === "completed"`; FinalResultsPanel resolves to a tie.
- `confirmUnpauseCountdown` self-duel:
  - Succeeds with no prior unpause request.
  - Succeeds after the same user's own unpause request.
  - Immediately clears pause fields instead of waiting for another player.
- `skipCountdown` self-duel returns `{ bothSkipped: true }` and writes `countdownSkipRequestedBy === ["challenger", "opponent"]`.
- PvE `fireHint` in a self-duel: patches `hintPoolUsed`, eliminates options, bumps `questionStartTime`; `currentQuestionHintFired` resets on next round.
- `useChallengeActions.handleCreateSelfDuel`: calls `createSelfDuel` (not `createChallenge`), returns `{ duelId }`, emits NO success toast.
- `useChallengeLobby` self-branch on `createSelfDuel` failure: emits `toast.error` and `isJoiningDuel` returns to `false`.
- ChallengeModal:
  - With `viewer` defined and `users === []`, the Me row still renders.
  - Selecting Me sets `selectedOpponentId === viewer._id`, hides the Mode picker, and the "Selected" footer shows the viewer's label.
  - Existing tests are updated for the new required `viewer` prop.
- Prefer mutation-level tests for `confirmUnpauseCountdown` and `skipCountdown`; the important behavior is enforced server-side, not in `CountdownControls`.

## Out of scope (v1) — explicit, accepted side effects
- Renaming UI labels ("Opponent", "Challenge", "duel") or relabeling the Me row.
- Stats / history flagging self-duels distinctly.
- Allowing self-duels for boss / spaced-repetition / weekly-goal sources.
- Allowing PvP mode (and therefore sabotage / PvP hints) in self-duels.
- Joining/loading UX beyond reusing the existing JoiningModal.
- Scoreboard / final results panel show the same user as both challenger and opponent (same display name and avatar) — accepted cosmetic.
- Skip button momentary flicker when `countdownSkipRequestedBy` flips both flags in one shot — functionally harmless, accepted cosmetic.

## Implementation order (suggested)
1. Shared helpers + their tests first: `lib/duel/selfDuel.ts` (S1), `lib/challengeLobby/isSelfDuelSelection.ts` (S2), `convex/helpers/resolveAccessibleThemes.ts` (S3), `convex/rules/selfDuelMirror.ts` (S4), `convex/rules/countdownPlanners.ts` (§4 planners).
2. Backend: `createSelfDuel` mutation using S3 + `SELF_DUEL_FORCED_MODE` (§1). Refactor `createChallenge` to use S3.
3. Backend: wire `mirrorPatchForSelfDuel` into `gameplay.ts` after the existing builders (§3). Builders unchanged.
4. Backend: replace inline countdown branches with planner calls (§4).
5. Backend integration tests for the gameplay path.
6. Frontend: `viewer` plumbing through `useChallengeData` + `useChallengeLobby` using S2 (§§7, 10).
7. Frontend: `useChallengeActions.handleCreateSelfDuel` (§9).
8. Frontend: ChallengeModal Me row + `isSelfSelected` (via S2) + Cancel disable (§§8, 11, 12).
9. Frontend: `useDuelSessionViewModel` resume swap (imports `isSelfDuel` from S1) + pass `viewer` through all modal call sites (§13).
10. Frontend tests.
11. Regenerate Convex API types after adding `createSelfDuel` so `api.challenges.createSelfDuel` exists for frontend typechecking.
12. Validation: run `npm run lint`, `npm run typecheck`, and focused `npm run test:run -- <changed test files>` (or full `npm run test:run` if the focused set is not enough).
13. Manual smoke pass: create self-duel, pause/skip/resume, fire PvE hints, finish to tie.

## Review history
- v1 → v2: fixed viewer-id-is-Convex-not-Clerk; `confirmUnpauseCountdown` / `skipCountdown` self-duel guards; separated `handleCreateSelfDuel` from friends flow; sabotage backend rejection; viewer rendered separately from friends; dropped the double-call to `getLimitedLivesMissPatch`; validation parity; helper placement; tests expanded.
- v2 → v3: `skipCountdown` must write `["challenger","opponent"]` (not clear); Me row renders even with no friends; "Selected: Unknown" footer fixed via viewer-aware lookup; PvE-only self-duels (forced) so sabotage and PvP-hint UI auto-disappear; Cancel disabled while busy; tests for completion + skipCountdown; viewer query ungated.
- v3 → v4: toast.error + try/catch on self-duel creation; `isSelfSelected` boolean threaded down; `confirmUnpauseCountdown` also allows confirm with no prior request; viewer tri-state preserved; `createSelfDuel` null-filter `NOT_FOUND` parity; `isSelfDuel` invariant documented; Me row test id `duel-modal-opponent-me`.
- v4 → v5 (this doc): §13 explicit callback swap (`onRequestUnpause` → `confirmUnpauseCountdown` for self); reuse themes from access checks (skip double-load); §11 reworded to clarify Cancel-disable mostly protects friends path; viewer query gated for pattern consistency; `selectedMode` not reset (noted); duplicate name/avatar in Scoreboard + Skip-button flicker accepted in Out of scope.
- v5 → v6: simplified self-duel countdown behavior to instant same-user unpause and instant same-user skip; clarified timeout patches do not use `nextScore`; made `ChallengeModal` call-site/test updates explicit; accepted duplicate self-duel theme-access query behavior for v1 with no extra work.
- v6 → v7: added Convex API regeneration and final validation gates; clarified that the modal still sends the existing options shape while the lobby strips/ignores `duelMode` for the self path; added minor Create-button busy disable; called out mutation-level countdown tests.
- v7 → v8: principle-aligned refactor before any feature code lands. Extracted four single-source helpers (S1 `lib/duel/selfDuel.ts` with `isSelfDuel` + `SELF_DUEL_FORCED_MODE`; S2 `lib/challengeLobby/isSelfDuelSelection.ts`; S3 `convex/helpers/resolveAccessibleThemes.ts` consumed by both `createChallenge` and `createSelfDuel`; S4 `convex/rules/selfDuelMirror.ts` so `buildAnswerPatch` / `buildTimeoutPatch` stay single-purpose). Lifted countdown self-duel rules into pure planners (`convex/rules/countdownPlanners.ts`) matching the `lockGoal` pattern. Updated §§1, 2, 3, 4, 8, 10, 12, 13 + Tests + Implementation order to consume the shared helpers everywhere. Added explicit tests for each new helper. Added an explanatory comment on `selectedMode` so its unread-on-self-path role is honest at the declaration site.
