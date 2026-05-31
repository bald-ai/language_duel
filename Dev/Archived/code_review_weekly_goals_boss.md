# Code Review — Area 9: Weekly goals & boss

**Date:** 2026-05-22
**Scope:** `app/goals/*`, `app/boss/*`, `convex/weeklyGoals.ts` + `convex/weeklyGoals/*` (excl. spaced-repetition & notification-only modules), `lib/weeklyGoals.ts`, `lib/weeklyGoalTiming.ts`, `convex/helpers/weeklyGoalSnapshots.ts`, `hooks/useWeeklyGoalThemeIds.ts`, `app/components/WeeklyGoalThemeMarker.tsx`. ~4.6k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

Real LOC (`wc -l`):

- **lib:** `weeklyGoals.ts` (423), `weeklyGoalTiming.ts` (15)
- **convex (in scope):** `weeklyGoals.ts` (350), `weeklyGoals/mutations.ts` (525), `weeklyGoals/bossWorkflows.ts` (220), `weeklyGoals/queries.ts` (219), `weeklyGoals/cleanup.ts` (188), `weeklyGoals/createGoal.ts` (133), `weeklyGoals/practiceThemes.ts` (114), `weeklyGoals/readModels.ts` (84), `weeklyGoals/participants.ts` (36), `weeklyGoals/notifications.ts` (35), `weeklyGoals/types.ts` (26), `helpers/weeklyGoalSnapshots.ts` (165)
- **app/goals:** `hooks/useGoalsPageModel.ts` (370), `components/GoalsPageContent.tsx` (309), `components/GoalThemeSelector.tsx` (237), `components/GoalThemeList.tsx` (195), `components/GoalTimingPanel.tsx` (182), `components/GoalBossProgressPanel.tsx` (145), `components/GoalSwitcher.tsx` (141), `components/GoalParticipantsPanel.tsx` (119), `components/PartnerSelector.tsx` (117), `components/GoalCreationPanel.tsx` (112), `components/LockButton.tsx` (109), `components/GoalPracticeModalHost.tsx` (107), `components/DeleteGoalButton.tsx` (88), `hooks/useGoalsController.ts` (67), `components/GoalPracticePanel.tsx` (42), `bossUi.ts` (39), `constants.ts` (10), `page.tsx` (5)
- **app/boss:** `[goalId]/[bossType]/page.tsx` (241)
- **other:** `WeeklyGoalThemeMarker.tsx` (43), `useWeeklyGoalThemeIds.ts` (23)

Excluded per instructions: `convex/weeklyGoalRepetitions*`, `app/repetition/*`, `lib/spacedRepetition.ts` (Area 10); notifications (Area 11).

No single file exceeds the 700 LOC guideline. The largest, `mutations.ts` (525), is the one to watch — see #5. The headline issue is **not** size; it is the lifecycle state model, which is reconstructed from scattered conditionals rather than expressed once.

---

## 🔴 Blockers

None. There is no structural regression severe enough to block, and no file-size explosion. But the lifecycle/lock state is duplicated across four layers (#1, #2) and should be consolidated before this area grows further; I would not let new lifecycle features land on top of the current shape.

---

## 🟡 Medium

### 1. The lifecycle status is a four-way fork between *stored* `status` and *derived* `effectiveStatus`, and the divergence is reconstructed everywhere

`weeklyGoals.status` is persisted as `draft | locked | grace_period | completed` (schema `convex/schema.ts`), but the *truth* the app uses is `getEffectiveGoalStatus(goal, now)` (`lib/weeklyGoals.ts:221-242`), which overrides the stored value in two ways:

- `bigBossStatus === "defeated"` ⇒ `completed` (even if `status === "locked"`),
- `status === "locked"` *and* `now > endDate` ⇒ `grace_period` (even though the row hasn't been migrated yet by the cron).

So a `locked` row can effectively be `grace_period` or `completed`, and *every* read path has to know this. The "is it past end date / grace" rule alone is re-derived in **four** independent forms:

- `getEffectiveGoalStatus` (`lib/weeklyGoals.ts:237`, `now > goal.endDate`),
- `isGoalInGracePeriod` (`lib/weeklyGoals.ts:182-196`, `now > endDate! && now < deleteAt`),
- `isGoalPastGracePeriod` / `isGoalPastEndDate` (`lib/cleanupExpiry.ts:19-38`),
- raw Convex index predicates in `weeklyGoals.ts:213-275`, `cleanup.ts:138-171`, `queries.ts:38-59`, `createGoal.ts:30-72`.

`shouldIncludeGoal` (`readModels.ts:16-31`) then mixes two of these systems in one function — it calls `getEffectiveGoalStatus` for the draft/completed decision and `isGoalPastGracePeriod` for the grace decision. A reader has to hold all four mental models to know whether a goal is live.

**Remedy:** make `getEffectiveGoalStatus` the *single* derivation and express every other "is it past end date / in grace / playable" predicate in terms of it.
- `isGoalInGracePeriod` should be `getEffectiveGoalStatus(goal, now) === "grace_period"` — its body (lines 190-195) is a third hand-rolled copy of the same `endDate`/`deleteAt` arithmetic the status function already does, and its only caller is `isGoalPlayable` two lines down (line 208), where the `effectiveStatus` is *already in scope*. The whole function can be deleted and `isGoalPlayable` reduced to `const s = getEffectiveGoalStatus(...); return s === "locked" || s === "grace_period";`.
- `shouldIncludeGoal` should switch on `getEffectiveGoalStatus` alone (`completed`→false, otherwise true) and drop the `isGoalPastGracePeriod` import; the cron predicate is the only place that legitimately needs the raw arithmetic, because it runs *before* `getEffectiveGoalStatus` would reclassify.
This collapses four overlapping notions of "expired" into one canonical function with a couple of index-level predicates that exist only because Convex can't run JS in a `withIndex`.

### 2. The "one participant locked, waiting for the other" state (the derived lock-proposed state) is reconstructed from raw `creatorLocked`/`partnerLocked` in five places with role logic re-implemented each time

There is no stored representation of "this viewer has locked, the other hasn't" — it is recomputed from the two booleans plus `viewerRole` everywhere it's needed:

- `useGoalsPageModel.ts:279-289` — `viewerLocked` and `partnerLocked`, full `viewerRole === "creator"/"partner"` fork, with `creatorLocked` typed `boolean` but `partnerLocked` typed `boolean | undefined` so one side uses `=== true` and the other doesn't (lines 283-284 vs 288-289).
- `useGoalsPageModel.ts:151` — `lockedRole = goal.creatorLocked ? "creator" : goal.partnerLocked ? "partner" : null` (a *third* notion, "which single role is locked", used only for the unlock toast).
- `mutations.ts:104-108` — the same `lockedParticipantId` derivation in `handleRemoveTheme`.
- `GoalParticipantsPanel.tsx:59,110` — reads the raw booleans again to render the ✓ marks.
- `lib/weeklyGoals.ts:343-372` — `planWeeklyGoalLock` re-derives "is the *other* side already locked" (`bothLocked`).

Five copies of the same role↔lock mapping is exactly the "repeated conditionals signaling a missing model" smell. `buildGoalWithUsers` (`readModels.ts:33-58`) already normalizes the goal for the client and is the natural single owner.

**Remedy:** compute the lock view once in `buildGoalWithUsers` and put it on `GoalWithUsers`, e.g. `lockState: "none" | "viewer_locked" | "partner_locked" | "both_locked"` (or `{ viewerLocked: boolean; partnerLocked: boolean }`). `useGoalsPageModel`'s 11-line `viewerLocked`/`partnerLocked` block, the `lockedRole` line, and the panel's raw-boolean reads all collapse to reading that field. The `partnerLocked === true` vs truthy inconsistency disappears because normalization happens in one typed place. Server-side, `planWeeklyGoalLock` already owns the canonical transition; leave it, but it becomes the *only* place that touches the raw booleans for writes.

### 3. `mode` is `v.optional` in the schema and `normalizeWeeklyGoal` falls back to `"shared"`, but every insert always writes `mode` — this is migration-residue fallback the AGENTS "no fallback" rule targets

Both create paths set `mode` unconditionally (`createGoal.ts:76` `mode: "shared"`, `:125` `mode: "solo"`), so no live row can lack it. Yet:

- the schema marks `mode: v.optional(...)`,
- `normalizeWeeklyGoal` opens with `const effectiveMode = goal.mode ?? "shared"` (`lib/weeklyGoals.ts:97`) and carries a third unreachable branch (`lines 134-137`, "Weekly goal mode is missing") that can only fire if `mode` is neither solo nor shared — impossible given the validator,
- `countCompletedThemes` / `areAllThemesCompleted` take `mode: WeeklyGoalMode | undefined` (`lib/weeklyGoals.ts:142,153`) purely to thread that optionality through.

This is a silent default papering over a contract that is, in fact, always satisfied. Per AGENTS this should be enforced, not defaulted. (If there is genuinely un-migrated production data without `mode`, that is a one-time backfill, not a permanent `?? "shared"` in the hottest helper.)

**Remedy:** make `mode` required in the schema (backfill first if needed), drop the `?? "shared"` and the unreachable third branch in `normalizeWeeklyGoal`, and tighten `countCompletedThemes`/`areAllThemesCompleted` to `mode: WeeklyGoalMode`. Removes one fallback, one dead branch, and a layer of `| undefined` from the pure layer.

### 4. The solo-vs-shared "theme completed" predicate is copy-pasted four times instead of reusing the canonical helper

`countCompletedThemes` (`lib/weeklyGoals.ts:144-148`) already encodes "completed = solo ? creatorCompleted : creatorCompleted && partnerCompleted". The identical ternary is re-written in:

- `bossWorkflows.ts:33-37` (`getEligibleThemeIdsForBoss`, mini branch),
- `GoalThemeList.tsx:67-69` (`bothCompleted`),
- `useGoalsPageModel.ts:296-300` (`allSelectedThemesCompleted`, which also re-derives `countCompletedThemes === themes.length`, i.e. a hand-inlined `areAllThemesCompleted`).

**Remedy:** export a single `isGoalThemeCompleted(theme, mode): boolean` from `lib/weeklyGoals.ts` and have `countCompletedThemes`, `getEligibleThemeIdsForBoss`, and `GoalThemeList` call it. Replace `useGoalsPageModel.ts:296-300` with `areAllThemesCompleted(selectedGoal.goal.themes, selectedGoal.mode)` — the canonical helper already exists and is unused by the UI.

### 5. `mutations.ts` (525 LOC) mixes goal-editing, boss-launch, lock, delete, and three notification-driven handlers; split before it crosses 700

The file is the largest in scope and is really five concerns glued together: theme add/remove/toggle/end-date (`40-303`), boss launch (`172-260`, which mostly delegates to `bossWorkflows`), lock (`305-376`), delete (`378-393`), and notification-payload handlers (`395-525`, `dismiss`/`archive`/`decline`). The notification trio is the odd group — it operates on `notifications` rows and payload guards, not on goal editing, and `handleArchiveCompletedGoalThemesFromNotification` (413-472) is a 60-line dedup/archive routine that has nothing to do with the rest.

**Remedy:** move the three `*FromNotification` / `*Invitation` handlers into a `weeklyGoals/invitationMutations.ts` (they already share `requireCallerOwnedNotificationPayload` + `isWeeklyGoalPayload`), and move the two boss-launch wrappers next to the boss logic they call in `bossWorkflows.ts`. Leaves `mutations.ts` as goal-editing CRUD (~250 LOC) and removes the "where does boss vs invite logic live" ambiguity.

### 6. `handleLockGoal` performs a multi-step non-atomic write with the actual status patch last

`handleLockGoal` (`mutations.ts:334-375`) on the `activate_goal` path does, in order: `createWeeklyGoalThemeSnapshots` (inserts N snapshot rows, can throw `NOT_FOUND` if a theme vanished — `weeklyGoalSnapshots.ts:78-84`), then `upsertWeeklyGoalNotificationForGoal`, then `scheduleNotificationEmail`, and only *then* `ctx.db.patch(goalId, lockPlan.updates)` to set `status: "locked"`. The same ordering risk is in `completeBigBoss` (`bossWorkflows.ts:111-163`): patch status `completed`, then `ensureRepetitionRecordsForCompletedGoal`, then two notifications, then a challenge query+dismiss. Convex mutations are transactional, so this is not a correctness bug today — but the snapshot insert is the step most likely to throw, and it runs before the state transition, so the ordering buys nothing and reads as fragile.

**Remedy:** validate-and-snapshot, then perform the goal `patch`, then fire notifications/emails last (notifications are the least critical and most likely to be reworked). Keeping the canonical state transition adjacent to the snapshot it depends on, with side-effect fan-out after, makes the atomic intent obvious. Note also `lockPlan.updates` already contains `lockedAt`, but the snapshot is created with the locally computed `now` (line 335) — fine since they're the same value, but the duplication is one more reason to order the writes deliberately.

### 7. `canTriggerGoalBoss` is exported and tested but never called in production; the real boss gate re-implements it inline

`canTriggerGoalBoss` (`lib/weeklyGoals.ts:411-423`) encapsulates exactly "`isGoalPlayable` AND the selected boss status is `ready`". The production path in `validateAndPrepareBoss` (`bossWorkflows.ts:78-88`) re-derives the same thing by hand: `if (!isGoalPlayable(...)) throw`, then `effectiveStatus = mini ? getEffectiveMiniBossStatus : getEffectiveBigBossStatus`, then `if (effectiveStatus !== "ready") throw`. Only `tests/lib/weeklyGoals.test.ts` calls the helper, so it's a canonical utility duplicated by its own production caller.

**Remedy:** either have `validateAndPrepareBoss` call `canTriggerGoalBoss` (it still needs the per-type status for the error message, so this is a judgement call), or delete `canTriggerGoalBoss` and point the test at the real path. Do not keep a tested-but-unused public helper next to a hand-rolled copy.

### 8. `resolveWeeklyGoalPracticeThemeIds` builds a selection set then throws it away and re-filters the goal order

`resolveWeeklyGoalPracticeThemeIds` (`practiceThemes.ts:11-46`) validates the requested `themeIds`, accumulates `selectedThemeIds` (line 35), checks it's non-empty (line 38)… then returns `goalThemeIds.filter((id) => seen.has(String(id)))` (line 44) — i.e. it discards `selectedThemeIds` and recomputes the result from `goalThemeIds` to preserve goal order. The `selectedThemeIds` array is therefore only used for the emptiness check; the `seen` set carries the real signal.

**Remedy:** drop `selectedThemeIds`; check `seen.size === 0` for the empty case and return the `goalThemeIds.filter(...)`. One fewer parallel collection tracking the same membership.

---

## 🟢 Minor / nit-level

- **Duplicated grace/draft countdown formatter naming.** `useGoalsPageModel.ts:95,98` both run `formatGoalGraceCountdown` — fine, but the draft one is named `formattedDraftCountdown` while using the *grace* formatter. The formatter is generic (`HH:MM:SS`); rename it `formatGoalCountdown` so the draft usage doesn't look like a copy-paste bug.
- **`getDraftGoalsExpiringSoon` magic window.** `weeklyGoals.ts:261-263` computes a `[TTL-2h, TTL]` reminder window with inline `22 * oneHourMs` / `24 * oneHourMs`. Name these (e.g. `DRAFT_EXPIRY_REMINDER_WINDOW_MS`) in `weeklyGoalTiming.ts` alongside the other timing constants per the constants rule.
- **`buildGoalWithUsers` non-null asserts.** `readModels.ts:50` uses `goal.partnerId!` inside the `mode === "solo" ? null : ...` branch; since `normalizeWeeklyGoal` already produced a `SharedGoal` with `partnerId` present, destructure off `normalizedGoal` (the `SharedGoal` type) so TS narrows and the `!` disappears. Same for `queries.ts:205` (`goal.partnerId!`).
- **`GoalBossProgressPanel` status copy is a 4-branch conditional cascade.** `GoalBossProgressPanel.tsx:121-142` is four mutually-exclusive `{!isDraft && ...}` / `{isDraft && ...}` paragraphs. A small `getBossHintCopy(status)` switch (sibling to `bossUi.ts`) would read better, but it's localized — leave unless the panel grows.
- **`useGoalsController.setShowCreationFlow` is exported but unused.** `useGoalsController.ts:63` returns `setShowCreationFlow` in addition to the `showCreateGoal`/`hideCreateGoal` wrappers; no consumer reads the raw setter. Drop it.
- **`GoalSwitcher.tsx` indentation is inconsistent** (mixed 2/4-space, e.g. lines 26-32 vs the rest). Cosmetic; a formatter pass fixes it. Same stray-tab issue at the bottom of `DeleteGoalButton.tsx:74-88`.
- **`GoalPracticeModalHost` redeclares the practice-themes shape inline** (`GoalPracticeModalHost.tsx:13-34`) instead of importing the query return type. If the query result shape changes this silently drifts; prefer a shared type from `practiceThemes.ts`/`types.ts`.

---

## Implementation Plan — approved 2026-05-22

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · #7 A · #8 A · minors A.

This is a de-duplication / lifecycle-consolidation pass — no behavior change for live goals. The pure runtime helpers in `lib/weeklyGoalTiming.ts` and the clean leaf panels are untouched. Excluded per scope: `convex/weeklyGoalRepetitions*`, `app/repetition/*`, `lib/spacedRepetition.ts` (Area 10) and notifications (Area 11). Code changes here, so run eslint + `npm run typecheck` + `npm run test:run` before handoff.

**Step 1 — Consolidate the lifecycle derivation (#1).** Make `getEffectiveGoalStatus` (`lib/weeklyGoals.ts:221-242`) the single canonical "what state is this goal in" function. Delete `isGoalInGracePeriod` (`lib/weeklyGoals.ts:182-196`) and reduce `isGoalPlayable` (line ~208) to `const s = getEffectiveGoalStatus(...); return s === "locked" || s === "grace_period";` (the `effectiveStatus` is already in scope). Route `shouldIncludeGoal` (`readModels.ts:16-31`) through `getEffectiveGoalStatus` alone (`completed`→false, else true) and drop the `isGoalPastGracePeriod` import. Leave the raw Convex `withIndex` predicates (`weeklyGoals.ts:213-275`, `cleanup.ts:138-171`, `queries.ts:38-59`, `createGoal.ts:30-72`) — those run before reclassification and legitimately need raw arithmetic. Highest leverage; collapses four "expired" notions into one.

**Step 2 — Lift the lock state into the read model (#2) + reuse the completed-theme helper (#4).**
- #2: Compute the lock view once in `buildGoalWithUsers` (`readModels.ts:33-58`) and expose it on `GoalWithUsers`, e.g. `lockState: "none" | "viewer_locked" | "partner_locked" | "both_locked"`. Collapse `useGoalsPageModel.ts:279-289` (the 11-line `viewerLocked`/`partnerLocked` block), the `lockedRole` line (`:151`), and `GoalParticipantsPanel.tsx:59,110` raw-boolean reads to read that field. The `partnerLocked === true` vs truthy inconsistency disappears in the one typed place. Server-side `planWeeklyGoalLock` stays the only writer of the raw booleans; `mutations.ts:104-108` reads from the normalized view.
- #4: Export `isGoalThemeCompleted(theme, mode): boolean` from `lib/weeklyGoals.ts`; have `countCompletedThemes`, `getEligibleThemeIdsForBoss` (`bossWorkflows.ts:33-37`), and `GoalThemeList.tsx:67-69` call it. Replace `useGoalsPageModel.ts:296-300` with `areAllThemesCompleted(selectedGoal.goal.themes, selectedGoal.mode)` (canonical helper already exists, currently unused by UI).

**Step 3 — Make `mode` required, drop the fallback (#3).** Backfill any un-migrated rows first if production data without `mode` exists. Then make `mode` required in the schema, drop the `?? "shared"` in `normalizeWeeklyGoal` (`lib/weeklyGoals.ts:97`) and its unreachable third branch (lines 134-137), and tighten `countCompletedThemes`/`areAllThemesCompleted` (`:142,153`) to `mode: WeeklyGoalMode`. Removes one fallback, one dead branch, and a `| undefined` from the pure layer.

**Step 4 — Split `mutations.ts` (#5).** Move the three `*FromNotification` / `*Invitation` handlers (`395-525`) into `weeklyGoals/invitationMutations.ts` (they share `requireCallerOwnedNotificationPayload` + `isWeeklyGoalPayload`). Move the two boss-launch wrappers (`172-260`) next to the boss logic they delegate to in `bossWorkflows.ts`. Leaves `mutations.ts` as goal-editing CRUD (~250 LOC).

**Step 5 — Order the lock/complete writes deliberately (#6).** In `handleLockGoal` (`mutations.ts:334-375`, `activate_goal` path) and `completeBigBoss` (`bossWorkflows.ts:111-163`): validate-and-snapshot → perform the goal `patch` (state transition) → fire notifications/emails last. Keeps the canonical state transition adjacent to the snapshot it depends on, side-effects after.

**Step 6 — Resolve remaining duplication (#7, #8).**
- #7: Either route `validateAndPrepareBoss` (`bossWorkflows.ts:78-88`) through `canTriggerGoalBoss` (`lib/weeklyGoals.ts:411-423`), or delete `canTriggerGoalBoss` and point `tests/lib/weeklyGoals.test.ts` at the real path. Don't keep a tested-but-unused public helper next to a hand-rolled copy. (Judgement call: prod path still needs per-type status for the error message.)
- #8: In `resolveWeeklyGoalPracticeThemeIds` (`practiceThemes.ts:11-46`), drop `selectedThemeIds`; check `seen.size === 0` for empty and return `goalThemeIds.filter((id) => seen.has(String(id)))`.

**Minors.** Rename `formatGoalGraceCountdown` → `formatGoalCountdown` so the draft usage (`useGoalsPageModel.ts:95,98`) doesn't read as a copy-paste bug; name the draft-expiry window constant (e.g. `DRAFT_EXPIRY_REMINDER_WINDOW_MS`) in `weeklyGoalTiming.ts` (`weeklyGoals.ts:261-263`); remove `partnerId!` non-null asserts by destructuring off the narrowed `SharedGoal` (`readModels.ts:50`, `queries.ts:205`); optional `getBossHintCopy(status)` switch beside `bossUi.ts` for `GoalBossProgressPanel.tsx:121-142`; drop unused `setShowCreationFlow` (`useGoalsController.ts:63`); formatter pass for mixed indentation (`GoalSwitcher.tsx`, `DeleteGoalButton.tsx:74-88`); import the practice-themes shape into `GoalPracticeModalHost.tsx:13-34` instead of redeclaring it.

## Approval bar

Approvable with changes. There is no blocking structural regression and no file over guideline, so this is not a 🔴. But it is held back from 🟢 by:
- a lifecycle state model whose single most important fact (effective status / lock-proposed) is reconstructed from raw timestamps and booleans in 4–5 places instead of derived once (#1, #2),
- an AGENTS "no fallback" violation — optional `mode` + `?? "shared"` + unreachable branch papering over a contract that's always met (#3),
- canonical helpers (`areAllThemesCompleted`, `canTriggerGoalBoss`, `countCompletedThemes`'s predicate) duplicated by their own callers (#4, #7),
- `mutations.ts` conflating five concerns and trending toward the size guideline (#5).

None are individually fatal; together they make the lifecycle harder to scan than it should be. Land #1–#4 and this comfortably reaches 🟢.
