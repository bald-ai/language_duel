# Weekly Goals / Boss / Repetition Clean Code Review

Scope: Weekly Goals / Boss / Repetition code paths.

Method: 7 pure-review subagents, one per clean-code principle:

- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

Instruction to reviewers: include more issues rather than fewer; findings can be filtered later.

## Must

1. **`convex/weeklyGoals.ts` is doing too much**
   - Owns goal CRUD, lifecycle, boss, notifications, emails, cleanup, snapshots, challenges, sessions, archive flows.
   - Violates Single Responsibility, Clear Boundaries, and Testable Business Logic.
   - Direction: split into goal lifecycle, boss orchestration, notifications, cleanup/retention, and read models.

2. **`lockGoal` mixes domain rules, persistence, snapshots, notifications, and emails**
   - File: `convex/weeklyGoals.ts`
   - Direction: extract a pure lock-transition planner, then call explicit side-effect helpers.

3. **`completeWeeklyGoalBoss` hides major lifecycle side effects**
   - File: `convex/weeklyGoals.ts`
   - Mini boss only defeats mini boss, but big boss completes the whole goal, creates repetition records, sends notifications, and dismisses challenge notifications.
   - Direction: split/rename into explicit mini-boss and big-boss completion workflows.

4. **Opening the Goals page can mutate/delete backend data**
   - `app/goals/page.tsx` calls `syncGracePeriodGoalsForUser`.
   - Visiting `/goals` can move goals to grace period, delete expired goals, delete sessions, snapshots, notifications, and storage.
   - Direction: move cleanup to cron/background jobs, or make this side effect explicit.

5. **Theme completion rule exists mainly in UI**
   - Files: `app/goals/helpers.ts`, `convex/weeklyGoals.ts`
   - UI blocks completed goals, but backend `toggleCompletion` does not fully enforce the same lifecycle policy.
   - Direction: centralize `canToggleGoalThemeCompletion` in shared logic and enforce it server-side.

6. **Snapshot/live theme boundary is unsafe**
   - File: `convex/helpers/weeklyGoalSnapshots.ts`
   - `loadWeeklyGoalSessionThemesByThemeIds` silently falls back to live themes if snapshots are missing.
   - Direction: split into strict snapshot loader and explicit live-theme loader.

7. **Gameplay layer contains boss/repetition domain logic**
   - File: `convex/gameplay.ts`
   - Answer progression also handles boss lives, boss defeat, goal completion, and repetition advancement.
   - Direction: extract a lives-attempt reducer and call explicit boss/repetition completion commands.

8. **Spaced repetition uses boss-lives naming/storage**
   - Files: `convex/schema.ts`, `convex/gameplay.ts`, `convex/challenges.ts`, `convex/duels.ts`, `convex/weeklyGoalRepetitions.ts`
   - SR uses `bossLivesTotal`, `bossLivesRemaining`, and `getBossMissPatch`.
   - Direction: rename to neutral `livesTotal`, `livesRemaining`, `limitedLivesAttempt`.

9. **Challenge/duel source contracts are too loose**
   - Files: `convex/schema.ts`, `convex/helpers/sessionCreation.ts`
   - Optional fields allow invalid combinations of `sourceType`, `weeklyGoalId`, `bossType`, `spacedRepetitionStep`, and lives.
   - Direction: introduce discriminated builders/contracts for normal, boss, and repetition attempts.

10. **`convex/weeklyGoalRepetitions.ts` has too many responsibilities**
    - Mixes repetition rules, snapshot loading, board DTOs, duel creation, solo creation, and advancement.
    - Direction: split rules, content loading, read model, and attempt mutations.

11. **Repetition readiness is not clearly modeled**
    - File: `convex/weeklyGoalRepetitions.ts`
    - `ready` can mean due date ready, content available, or launchable.
    - Direction: separate `isDueNow`, `contentAvailable`, and `canStart`.

12. **Old weekly-plan naming conflicts with Weekly Goal**
    - Examples: `weekly_plan_invitation`, `WeeklyPlanPayload`, `PlanSwitcher`, `selectedPlan`
    - Direction: standardize on Weekly Goal unless plan intentionally means draft/planning state.

13. **`bossStatus` really means Big Boss status**
    - Files: `convex/schema.ts`, `lib/weeklyGoals.ts`, `convex/weeklyGoals.ts`
    - Direction: rename toward `bigBossStatus` and `effectiveBigBossStatus`.

14. **Friend removal deletes weekly goal data**
    - Files: `convex/friends.ts`, `convex/weeklyGoals.ts`
    - Removing a friend also closes/deletes visible weekly goals and related play/notification/snapshot data.
    - Direction: make this explicit in contract/UI or separate friendship removal from goal cleanup.

15. **`MAX_THEMES_PER_GOAL` is duplicated**
    - Files: `app/goals/constants.ts`, `convex/weeklyGoals.ts`
    - Direction: move to shared `lib/weeklyGoals.ts`.

## Might

1. **Participant authorization is repeated many times**
   - Repeated `creatorId === userId || partnerId === userId`.
   - Direction: shared `isWeeklyGoalParticipant` / `getWeeklyGoalViewerRole`.

2. **Goal visibility/lifecycle predicates are scattered**
   - Examples: `shouldIncludeGoal`, raw status filters, duplicate pair checks, cleanup/reminder rules.
   - Direction: shared predicates like `isVisibleGoal`, `isExpiredGoal`, `isGraceWindowGoal`.

3. **Boss preview and boss start validation can drift**
   - Direction: shared `getBossAvailability` / `prepareBossLaunch`.

4. **Mini-boss availability is recomputed in UI**
   - Files: `lib/weeklyGoals.ts`, `app/goals/page.tsx`
   - Direction: backend/shared view model should return exact display/access state.

5. **Practice eligibility differs between UI and backend**
   - UI requires minimum themes; backend allows any non-empty selected set.
   - Direction: decide intended rule and enforce it in one place.

6. **End-date normalization lives in UI**
   - File: `app/goals/page.tsx`
   - Direction: backend/shared helper should define date semantics.

7. **Batch add themes is non-atomic**
   - File: `app/goals/page.tsx`
   - One UI action fires multiple mutations and allows partial success.
   - Direction: backend `addThemesToGoal` batch mutation.

8. **Notification/email side effects are inline in mutations**
   - Weekly goal mutations directly upsert notifications and schedule emails.
   - Direction: explicit notification intent helpers.

9. **`weekly_plan_invitation` notification type is overloaded**
   - Used for invite, lock, activation, decline, and completion.
   - Direction: rename to `weekly_goal_event` or split notification types.

10. **Theme access through weekly goals is distributed**
    - Files: `convex/themes.ts`, `lib/themeAccess.ts`, `convex/weeklyGoals.ts`
    - Direction: centralize weekly-goal theme access/eligibility.

11. **Deletion/retention cleanup is broad and duplicated**
    - Files: `convex/weeklyGoals.ts`, `convex/admin.ts`
    - Direction: one cleanup policy helper with modes.

12. **Boss/SR duplicate-attempt checks are embedded in mutations**
    - Direction: extract reusable duplicate-attempt finder.

13. **SR lives rule is duplicated**
    - `goal.themes.length + 1` appears in multiple places.
    - Direction: `calculateSpacedRepetitionStartingLives(themeCount)`.

14. **UI pages/components are large controllers**
    - Files: `app/goals/page.tsx`, `app/repetition/[goalId]/page.tsx`, `app/repetition/components/RepetitionBoard.tsx`
    - Direction: extract controller hooks and pure view-model helpers.

15. **`getBossPracticeSession` also handles repetition sessions**
    - Name/module boundary is unclear.
    - Direction: move to neutral solo/session API or split boss vs repetition queries.

16. **Snapshot deletion also deletes TTS storage**
    - Helper: `deleteWeeklyGoalThemeSnapshots`
    - Direction: rename or delegate storage cleanup explicitly.

17. **Labels/status formatting is scattered**
    - Boss, repetition, and weekly goal labels exist across UI/backend.
    - Direction: shared display helpers.

18. **`buildDeferredSnapshotContent` returns `ok: true` without content**
    - Direction: use union status: `loaded | deferred | unavailable`.

## Ignore / Low Priority

1. **Live fallback helper has no write side effect**
   - Still confusing, but not dangerous as a mutation by itself.

2. **User-facing “Start Duel” wording in repetition**
   - Product-language concern, not a clean-code blocker.

3. **Fallback copy `Completed goal` is vague**
   - Prefer `Completed weekly goal`, but low risk.

4. **`WeeklyGoalThemeMarker` says “In your weekly goal”**
   - Slightly vague if multiple goals exist; low priority.

5. **Duplicated `BossType = "mini" | "big"`**
   - Worth centralizing eventually, but small compared with lifecycle/schema issues.
