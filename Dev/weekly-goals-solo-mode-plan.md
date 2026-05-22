# Weekly Goals: Solo Mode — Plan v3

> Iteration on v2, with: tightened notification surface (solo gets reminders + completion only — everything else is intentionally absent), explicit `handleAddTheme` solo branch, explicit `planWeeklyGoalLock` type and early-return changes, rollout constraint for `assertSharedGoalShape`, fixture list correction, and removal of the bogus `existingPartnerIds` "bug" rationale.

## Coordination with self-duel plan (now shipped for `sourceType: "normal"`)

The self-duel ("Me" opponent) feature per `Dev/self-duel-me-opponent-plan.md` is **shipped** (currently uncommitted but in the working tree) for `sourceType: "normal"` only. **Both plans must read consistently; we coordinate, we do not duplicate.**

- **Self-duel v1 scope:** ONLY `sourceType: "normal"` (the classic Challenge flow). Self-duels for `boss` / spaced-repetition / weekly-goal sources are NOT YET implemented — they remain Phase 2 work in this document.
- **Implication for this plan (v1):** the solo-mode restrictions below stay as written — solo goals do NOT yet support boss duels or SR duels against the user themselves, because the self-duel mechanism does not cover those sources yet. The "Practice Solo" path is the only boss launch route for solo goals in v1.
- **Shared helpers — verified to exist, do not duplicate.** Where the solo-mode work touches the same concepts the self-duel feature already centralizes, import from the existing helpers; never redefine:
  - `lib/duel/selfDuel.ts` — exports `isSelfDuel(duel)` and `SELF_DUEL_FORCED_MODE: DuelMode = "pve"`. [shipped]
  - `lib/challengeLobby/isSelfDuelSelection.ts` — UI predicate `isSelfDuelSelection(viewer, opponentId)`. [shipped]
  - `convex/helpers/resolveAccessibleThemes.ts` — theme access validation reused by `createChallenge` and `createSelfDuel`, and by any future boss/SR self-duel creator. [shipped]
  - `convex/rules/selfDuelMirror.ts` — `mirrorPatchForSelfDuel(patch, duel)` answer/timeout mirror step. [shipped]
  - `convex/rules/countdownPlanners.ts` — `planConfirmUnpauseCountdown` / `planSkipCountdown` pure planners. [shipped]
- **Files self-duel did NOT touch** (confirmed — solo-mode v1 has zero merge conflicts with self-duel v1):
  - `convex/schema.ts` weekly-goal portion.
  - `convex/weeklyGoals/*`, `convex/weeklyGoalRepetitions/*`.
  - `lib/weeklyGoals.ts`, `lib/themeAccess.ts`.
  - All weekly-goal UI under `app/goals/`, `app/boss/`, `app/repetition/`.
- **Phase 2 (widen self-duel to boss/SR `sourceType`):** see the dedicated section at the bottom of this document. Prerequisites are now satisfied on the self-duel side; the remaining prerequisite is shipping this plan (solo-mode v1) first.
- **Until Phase 2 lands, the rejections in this plan are correct.** `handleCreateBossChallenge` rejects solo with `INVALID_STATE`. `createRepetitionChallengeForCurrentUser` rejects solo with `INVALID_STATE`. The boss launch page hides the duel-mode picker. These are NOT fallbacks — they are explicit boundary errors that will be relaxed in Phase 2 by routing to the widened self-duel path.

## Decisions (no options, no fallbacks)

- Two modes: `shared` (current) and `solo`. Mode is fixed at creation. No conversion either way.
- `solo` goal has exactly one human: the creator. No partner anywhere in data, UI, notifications, or emails.
- `solo` lock is single-action: creator's lock activates the goal immediately, no `lock_proposed`, no "waiting for partner" copy.
- `solo` theme completion uses `creatorCompleted` only. Mini boss / big boss thresholds use `creatorCompleted` only.
- `solo` boss runs only as solo practice. The boss launch page hides the duel-mode picker and "Challenge Partner" CTA.
- `solo` goal completion (big boss defeated) creates one `weeklyGoalRepetitions` row, for the creator only. SR duels are not available for solo goals in v1 (the row's `duelAvailable` is `false`, the UI shows progress only). The row IS still written so Phase 2 can light up an SR self-duel CTA against the same row without a backfill migration.
- Friend removal does **not** touch solo goals. Admin user-delete fully removes the user's solo goals (including snapshots and SR rows).
- Solo goal theme eligibility: only themes owned by the creator.
- Per-user concurrency: at most one visible solo goal per user (using existing `shouldIncludeGoal`). The existing "one visible shared goal per partner pair" rule is unchanged.
- Default mode on the create panel: **Solo**. The "With a friend" choice is opt-in, regardless of whether the user has friends.
- **Solo notification surface is intentionally minimal.** The only things solo emits are:
  - Reminder emails: `weekly_goal_daily_reminder`, `weekly_goal_reminder_1`, `weekly_goal_reminder_2`, `weekly_goal_grace_period_reminder`.
  - The existing creator-only in-app notification `weekly_goal_draft_expiring` (already creator-only, unchanged).
  - The new in-app "GZ at the end" notification with event `goal_completed_solo` on big-boss defeat.
  - Everything else that exists for shared (invite, accepted, locked, declined, partner_locked, goal_unlocked, goal_activated, partner-unlock-on-theme-removal, challenge invites, SR availability) is **not produced for solo** and should not be added later "for parity". Solo is intentionally quieter.

## Data model

### Step 1: schema migration order (do this in two phases, not one)

`convex/schema.ts` validator changes must be **forward-compatible with existing rows** because Convex validates the entire collection on schema deploy.

Phase A (deploy):

- Add `mode: v.optional(v.union(v.literal("solo"), v.literal("shared")))` (optional now).
- Make `partnerId: v.optional(v.id("users"))`.
- Make `partnerLocked: v.optional(v.boolean())`.
- Inside `themes` array element, make `partnerCompleted: v.optional(v.boolean())`.
- Update `notificationPayloadValidator.event` union (in `convex/schema.ts`) to include `v.literal("goal_completed_solo")`.

Phase B (one-shot migration mutation in `convex/migrations/stampWeeklyGoalsMode.ts`) — **mandatory, not optional**:

- Stamp every existing `weeklyGoals` row with `mode: "shared"`.
- Run it whether or not you believe rows exist; Phase C will refuse to deploy if a single row still has `mode === undefined`.

Phase C (tighten):

- Change `mode` to required (`v.union(...)`). Keep `partnerId`/`partnerLocked`/`partnerCompleted` as optional forever (they are genuinely absent for solo).

This sequence is required because shipping Phase C immediately would fail Convex schema validation on existing rows.

Concrete deploy/codegen order:

1. Land/deploy **only** Phase A schema + the stamp mutation. Do not land solo feature code in this same step.
2. Run Convex codegen after Phase A so TypeScript sees optional `mode`/partner fields during the migration window.
3. Run `stampWeeklyGoalsMode` once and verify every existing goal has `mode: "shared"`.
4. Land/deploy Phase C schema tightening, then run Convex codegen again.
5. Only after Phase C/codegen, land the solo feature code that assumes `goal.mode` is present.

This avoids a temporary half-state where application code branches on `goal.mode` while existing rows or generated types still allow it to be missing.

### TypeScript shape (`lib/weeklyGoals.ts`)

Use a discriminated union, not a free-floating `mode` arg passed around to helpers:

```
export type WeeklyGoalMode = "solo" | "shared";

export type SoloThemeProgress = { mode: "solo"; creatorCompleted: boolean };
export type SharedThemeProgress = {
  mode: "shared";
  creatorCompleted: boolean;
  partnerCompleted: boolean;
};
```

But for **on-disk** Convex shape, the `themes` row stays a single struct: `{ themeId, themeName, creatorCompleted, partnerCompleted?: boolean }`. The discriminated TS type is constructed at the read boundary (`buildGoalWithUsers`, `lib/weeklyGoals` helpers) by inspecting `goal.mode`. This keeps the schema flat and keeps client-facing types strict.

Because Convex cannot express "required only when `mode === shared`" inside this table shape, add explicit shared-row validation at the read/helper boundary:

- Add `normalizeWeeklyGoal(goal): SoloGoal | SharedGoal` in `lib/weeklyGoals.ts`. Single canonical name. Do NOT introduce a separate `assertSharedGoalShape` helper — `normalizeWeeklyGoal` IS the assertion: it returns the typed discriminated union and throws on a broken contract.
- For `mode: "shared"`, fail loudly (throw `WeeklyGoalRuleViolation("INVALID_STATE", ...)`) if `partnerId`, `partnerLocked`, or any theme's `partnerCompleted` is missing.
- For `mode: "solo"`, fail loudly if partner fields are present where the solo contract says they must be absent.
- Use this normalized shape in `buildGoalWithUsers`, helper calls, boss/SR logic, and mutation paths before code assumes partner fields exist.

This is contract enforcement, not fallback behavior. It prevents a broken shared row from quietly rendering like a solo goal or "deleted participant" case.

Implementation style rule:

- Normalize once near the model/read boundary, then pass a clean typed shape into helpers.
- Do not scatter optional-partner checks everywhere as the main design. Local checks are fine at I/O edges, but core weekly-goal logic should receive a normalized `solo` or `shared` shape whenever practical.
- If a helper truly needs raw Convex docs, keep the raw access small and immediately call `normalizeWeeklyGoal` before reading partner fields.
- This keeps the implementation future-AI-readable and avoids turning `goal.mode === "solo"` into repeated defensive clutter across the codebase.

Migration-window safety rule (do NOT skip):

- `normalizeWeeklyGoal` is designed to throw on `mode === undefined`. During Phase A and the Phase B stamp mutation window, rows legally still have `mode === undefined`. The helper therefore MUST NOT be reachable from any code path that runs in Phase A or in the stamp mutation itself. The solo feature code (which imports the helper) lands only after Phase C + codegen.

Helper updates (all in `lib/weeklyGoals.ts`):

- `countCompletedThemes(themes, mode)`: in solo, count `creatorCompleted` only; in shared, count `creatorCompleted && partnerCompleted` (unchanged behavior for shared).
- `areAllThemesCompleted(themes, mode)`: same rule.
- `getEffectiveMiniBossStatus(goal, now)` and `getEffectiveBigBossStatus(goal, now)`: read `goal.mode` and pass it down.
- `planWeeklyGoalLock({ goal, role, now })` becomes mode-aware. Three concrete changes that the v2 spec did not call out:
  1. `WeeklyGoalLockableState` type: `partnerLocked` must become `partnerLocked?: boolean` (and so does `partnerCompleted?: boolean` on theme rows). Without this, every `planWeeklyGoalLock` caller breaks at the type boundary the moment the schema goes optional.
  2. The solo branch must be an **early return at the top** of the function, before the existing `bothLocked = goal.partnerLocked` check. Otherwise the current code path reads `goal.partnerLocked` as `undefined`, treats it as falsy, and returns `kind: "first_lock"` — which is wrong for solo. The early return for solo is: `role` must be `"creator"` (reject `"partner"` with `INVALID_STATE`); `goal.partnerLocked` and `goal.partnerId` must both be `undefined`; `goal.status` must be `"draft"` (reject anything else with `INVALID_STATE` — same gate the shared first-lock path enforces today, prevents silent re-activation); the only legal outcome is `kind: "activate_goal"` with updates `{ creatorLocked: true, status: "locked", lockedAt: now }`. No `partner*` field is written.
  3. In `mode: "shared"`, existing behavior is unchanged.
- `canEditGoalEndDate(goal, now)` and `validateGoalEndDateAtLeast24hAhead`: behavior is identical for both modes; ≥24h-from-now still applies to solo. Plan calls this out explicitly so it isn't accidentally relaxed.

### Single-source participant-id helper (mandatory)

`getGoalParticipantIds(goal)` already exists in `convex/weeklyGoals/notifications.ts`. It is not notification-specific — it is the canonical "who are the human participants of this goal" rule.

- Move `getGoalParticipantIds` out of `convex/weeklyGoals/notifications.ts` into a new neutral file `convex/weeklyGoals/participants.ts`. Re-export from `notifications.ts` if convenient for existing callers, but the new canonical import path is `convex/weeklyGoals/participants`.
  - It stays in `convex/` (not `lib/`) because `lib/` is import-pure and does not import `Id` from `convex/_generated/dataModel`. This matches the existing repo split (rules in `lib/`, id-typed access helpers in `convex/helpers` / `convex/weeklyGoals`).
- Update its signature to be mode-aware: `(goal: { creatorId: Id<"users">; partnerId?: Id<"users"> }) => Id<"users">[]`. Return `[creatorId, partnerId]` when partner exists, `[creatorId]` otherwise.
- **All call sites that today build `[goal.creatorId, goal.partnerId]` inline must switch to `getGoalParticipantIds(goal)`**. This is the single source of truth for the rule.

Concrete call sites to convert (verified against current `rg` output):

- `convex/weeklyGoals/notifications.ts → dismissGoalNotifications` (already in this module; just call the helper).
- `convex/weeklyGoals/queries.ts → getVisibleGoalsForViewer`, `getGoalForViewer`.
- `convex/weeklyGoals/cleanup.ts → dismissAndDeleteGoals` (already uses the helper for the challenge dismiss; do the same for the participant set construction).
- `convex/weeklyGoals/bossWorkflows.ts` (already uses the helper, no change).
- `convex/weeklyGoalRepetitions/rules.ts → ensureRepetitionRecordsForCompletedGoal`.
- `convex/weeklyGoalRepetitions/board.ts → loadCompletedGoalsForUser` partner-id list (use `goal.partnerId` directly per-row OR a dedicated `getGoalPartnerIdForViewer` helper — see next bullet).
- `convex/emails/reminderCrons.ts` (×3 crons).
- `convex/admin.ts → deleteUserFully` participant cleanup.
- `convex/emails/notificationEmailData.ts` partner-id resolution.

Also add a sibling helper in the same `convex/weeklyGoals/participants.ts`:

- `getGoalPartnerIdForViewer(goal, viewerId): Id<"users"> | undefined` → returns the OTHER participant from the viewer's perspective, or `undefined` if the goal is solo. Replaces the existing inline `goal.creatorId === userId ? goal.partnerId : goal.creatorId` pattern in `convex/weeklyGoalRepetitions/rules.ts → getGoalPartnerId`, `convex/admin.ts → deleteUserFully` (the `remainingParticipantId` line), `convex/weeklyGoals/mutations.ts` (the 4 places that compute `opponentId` / `otherUserId` / `lockedParticipantId === goal.creatorId ? goal.partnerId : goal.creatorId`), and `convex/emails/notificationEmailData.ts`.

Rule of thumb during implementation: if you find yourself writing `goal.creatorId === X ? goal.partnerId : goal.creatorId`, STOP and call `getGoalPartnerIdForViewer`. If you find yourself writing `[goal.creatorId, goal.partnerId]`, STOP and call `getGoalParticipantIds`. No exceptions.

### `lib/themeAccess.ts`

- `WeeklyGoalAccessData.partnerId` becomes `Id<"users"> | undefined`.
- `hasAccessViaWeeklyGoal` uses `goal.creatorId === userId || (goal.partnerId !== undefined && goal.partnerId === userId)`.
- `convex/helpers/themeAccess.ts → buildThemeAccessParams` must propagate `partnerId: goal.partnerId` as `Id<"users"> | undefined` (TS will surface the breakage; fix at the type and at the mapped call sites).
- **Add `canAttachThemeToGoal({ goal, theme }): boolean` in `lib/themeAccess.ts` (pure, no Convex imports).** Rule body:
  - For `goal.mode === "solo"`: returns `theme.ownerId === goal.creatorId`.
  - For `goal.mode === "shared"`: returns `theme.ownerId === goal.creatorId || theme.ownerId === goal.partnerId`.
  - This is the single source of truth for "is this theme eligible to be attached to this goal" and must be used by BOTH the write boundary (`handleAddTheme`) AND the list query (`getEligibleThemesForViewer`). Do not duplicate the branch in either place. The function takes `{ ownerId }` and `{ mode, creatorId, partnerId? }` slices only — no Convex types — so it is fully testable in pure unit tests.
  - Add a focused test file `tests/lib/themeAccess.canAttachThemeToGoal.test.ts` covering: solo accepts owner==creator only, solo rejects owner==anyone-else, shared accepts owner==creator OR owner==partner, shared rejects third-party owners.

## Backend

### `convex/weeklyGoals.ts` public API

- **Remove** the existing `createGoal` mutation. Per AGENTS.md no-fallback rule, do not leave dual-path mutations.
- Add two replacements:
  - `createSharedGoal({ partnerId })` — current friendship+partner conflict rules.
  - `createSoloGoal({})` — single visible solo goal per user rule, no friendship check, no notification, no email.
- Internal queries (`getLockedGoalsWithEndDate`, `getGoalsInGraceWindow`, `getDraftGoalsExpiringSoon`) return both modes; reminder crons filter as described below.

### `convex/weeklyGoals/mutations.ts`

- Split `handleCreateGoal` into `handleCreateSharedGoal(ctx, partnerId)` and `handleCreateSoloGoal(ctx)`. Move them into a new file `convex/weeklyGoals/createGoal.ts` (mutations.ts is already ~600 LOC and is near the AGENTS.md 700 LOC ceiling).
- `handleCreateSoloGoal`:
  - Auth user; reject with `WeeklyGoalRuleViolation("INVALID_STATE", "You already have an active solo goal")` if any goal where `goal.creatorId === user._id`, `goal.mode === "solo"`, and `shouldIncludeGoal(goal, now)` is true. (Use the same `INVALID_STATE` code shared mutations already use for duplicate-goal rejections; do not invent a new code.)
  - Insert `{ creatorId, mode: "solo", themes: [], creatorLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", status: "draft", createdAt }`. No `partnerId`, no `partnerLocked`.
  - Do not create or schedule any notification or email. No invite event.
- `handleAddTheme`, `handleRemoveTheme`, `handleSetGoalEndDate`, `handleToggleCompletion`, `handleDeleteGoal`:
  - Auth check: `goal.creatorId === user._id || (goal.partnerId !== undefined && goal.partnerId === user._id)`.
  - `handleAddTheme`:
    - Theme-ownership check: call `canAttachThemeToGoal({ goal, theme })` from `lib/themeAccess.ts`. Reject with `INVALID_INPUT "Theme is not eligible for this goal"` when it returns false. Do NOT inline the solo/shared branch here — the rule lives in `lib/themeAccess.ts` and is shared with `getEligibleThemesForViewer`.
    - When appending the new theme entry, **omit `partnerCompleted` entirely** for solo. Writing `partnerCompleted: false` for solo violates the on-disk contract the discriminated TS shape advertises (`normalizeWeeklyGoal` would reject the row on the next read).
  - `handleRemoveTheme`: skip the partner-unlock notification block when `goal.mode === "solo"` (there's nobody to notify).
  - `handleToggleCompletion`: if `goal.mode === "solo"`, always toggle `creatorCompleted`; never touch `partnerCompleted`.
- `handleLockGoal`:
  - Solo path runs `planWeeklyGoalLock` with `mode: "solo"`; never calls `upsertWeeklyGoalNotificationForGoal` or `scheduleNotificationEmail`. Still runs `createWeeklyGoalThemeSnapshots`.
- `handleCreateBossChallenge`:
  - Reject with `INVALID_STATE "Solo goals do not support boss duels"` when `goal.mode === "solo"`. This is an explicit boundary error, not a fallback. It will be relaxed in Phase 2 (boss/SR self-duel widening — see bottom of this document) by routing solo callers to a `createBossSelfDuel` mutation that reuses the self-duel helpers (`isSelfDuel`, `SELF_DUEL_FORCED_MODE`, `mirrorPatchForSelfDuel`).
- `handleStartBossSoloPractice`: unchanged.
- `handleDismissWeeklyGoalInvitation`: can remain a generic weekly-goal notification dismiss action, because solo completed notifications reuse dismissal.
- `handleArchiveCompletedGoalThemesFromNotification`: accept completed shared and completed solo notifications. Stays a single mutation (the archive effect is identical for both modes). At the entry, explicitly assert `payload.event === "goal_completed" || payload.event === "goal_completed_solo"` as a named event-union boundary check, and throw `INVALID_STATE` for anything else. This keeps Single Responsibility ("archive the completed goal's themes from a completed-goal notification") clean while still enforcing the boundary. If the archive behavior ever needs to diverge by mode, that's the moment to split — not before.
- `handleDeclineWeeklyGoalInvitation`: explicitly assert `goal.mode === "shared"` after loading the goal. This mutation exists only for shared invites; solo goals must never hit it.

### `convex/weeklyGoals/queries.ts`

- `getVisibleGoalsForViewer`:
  - `by_creator` query already covers solo; `by_partner` query naturally returns nothing for solo (no partnerId stored).
  - Replace `loadUsersById(ctx, [...].flatMap(g => [g.creatorId, g.partnerId]))` with `loadUsersById(ctx, goals.flatMap(getGoalParticipantIds))`. Do NOT write the partner-filter inline — use the helper.
- `getGoalForViewer`: build the id list via `getGoalParticipantIds(goal)`. Replace the `isPartner` check with `goal.partnerId !== undefined && goal.partnerId === userId`.
- `getEligibleThemesForViewer`:
  - For solo, skip the partner-owned index query entirely (don't pay the read cost for a branch that always returns nothing).
  - For BOTH modes, the final filter pass calls `canAttachThemeToGoal({ goal, theme })` from `lib/themeAccess.ts`. This deduplicates the rule shared with `handleAddTheme` and guarantees the picker UI and the write boundary agree.

### `convex/weeklyGoals/readModels.ts`

- `buildGoalWithUsers`: when `goal.mode === "solo"`, set `partner: null` and force `viewerRole: "creator"`. The `GoalWithUsers` type already allows `partner: UserSummary | null`, no type change needed.
- Add a `mode: WeeklyGoalMode` field on `GoalWithUsers` so the UI doesn't have to dig into `goal.mode` everywhere.
- Add direct tests for the read-model/query behavior:
  - Solo visible goals load without calling user loading with `undefined`.
  - Solo `getGoalForViewer` returns viewer role `creator`, `partner: null`, and `mode: "solo"`.
  - Shared malformed rows fail loudly through normalization instead of rendering as solo/deleted-participant cases.

### `convex/weeklyGoals/bossWorkflows.ts`

- `getEligibleThemeIdsForBoss(goal, "mini")`: branch on `goal.mode`. Solo uses `creatorCompleted` only.
- `validateAndPrepareBoss`: auth check uses the mode-aware participant check.
- `completeMiniBoss`: unchanged.
- `completeBigBoss`:
  - For solo: emit one notification with `event: "goal_completed_solo"` from creator to creator (`fromUserId === toUserId === creatorId`). Do not call `dismissChallengeNotifications` (solo cannot have boss challenges).
  - For shared: unchanged.

### `convex/weeklyGoals/notifications.ts`

- `dismissGoalNotifications`: use `getGoalParticipantIds(goal)` (imported from the new `convex/weeklyGoals/participants.ts`).
- The previous home of `getGoalParticipantIds` (this file) re-exports from `participants.ts` only if existing imports would otherwise churn too much; the canonical import path going forward is `convex/weeklyGoals/participants`.

### `convex/weeklyGoals/cleanup.ts`

- `dismissAndDeleteGoals`: build the participant set with `getGoalParticipantIds(goal).forEach(id => set.add(id))`. No inline partner check.
- `closeVisibleGoalsBetweenParticipants`: no code change (filter naturally excludes solo goals). Add a regression test instead.

### `convex/weeklyGoalRepetitions/`

- `rules.ts`:
  - Delete the local `getGoalPartnerId(goal, userId)` function. Replace all callers with the canonical `getGoalPartnerIdForViewer` from `convex/weeklyGoals/participants.ts` (single source of truth for the partner-from-viewer rule).
  - `isGoalParticipant`: same mode-aware check, expressed as `goal.creatorId === userId || (goal.partnerId !== undefined && goal.partnerId === userId)`. Optionally extract into a tiny `isGoalParticipant(goal, userId)` helper in `participants.ts` and call it from rules.ts.
  - `ensureRepetitionRecordsForCompletedGoal`: iterate `getGoalParticipantIds(goal)` from `participants.ts`. No inline partner check.
- `board.ts`:
  - `loadCompletedGoalsForUser`: unchanged (solo appears via `by_creator`).
  - `partnerIds = goals.flatMap(g => { const p = getGoalPartnerIdForViewer(g, userId); return p ? [p] : []; })`.
  - `loadLaunchPreviewForUser`: short-circuit the partner load when `getGoalPartnerIdForViewer(goal, userId)` is `undefined`; return `partner: null` and `duelAvailable: false`.
- `readModel.ts → buildBoardItem`: accept the normalized goal (`SoloGoal | SharedGoal`) and derive `mode` inside. Do NOT add `mode` as a separate input param alongside the goal — that invites drift. Expose `mode` on the board item so the UI can render "Solo" instead of treating null partner as "Deleted participant".
- `challengeCreation.ts → createRepetitionChallengeForCurrentUser` (mutation entry): reject with `INVALID_STATE "Solo goals cannot run SR duels"` when `goal.mode === "solo"`. Explicit boundary error; relaxed in Phase 2 by routing solo callers to `createRepetitionSelfDuel` (self-duel widened to the SR sourceType). Until then, solo SR shows only the progress row, no duel CTA.
- `duelCompletion.ts`: unchanged.

## Notifications & email

### Notification payload

- `convex/schema.ts → notificationPayloadValidator.event` union gains `"goal_completed_solo"`.
- `app/notifications/components/NotificationItem.tsx`:
  - Add branch for `event === "goal_completed_solo"`. Copy: `"You defeated your weekly goal."` Reuse existing CTA buttons (View / Archive themes / Dismiss).
  - Existing `goal_completed` branch is unchanged.
- `app/notifications/hooks/useWeeklyGoalNotificationActions.ts`: route `goal_completed_solo` to the same archive/dismiss mutations as `goal_completed`.
- `convex/weeklyGoals/mutations.ts → handleArchiveCompletedGoalThemesFromNotification`: at the entry, explicitly accept the event union `"goal_completed" | "goal_completed_solo"` and reject anything else with `INVALID_STATE`. Solo completed notifications intentionally reuse archive/dismiss actions; the named event-union assert is the boundary check, not a fallback.
- `handleDismissWeeklyGoalInvitation` can remain generic dismiss behavior for weekly-goal notifications. `handleDeclineWeeklyGoalInvitation` must stay shared-only because solo goals have no invitation to decline.

### Email triggers and templates

- `convex/emails/reminderPlanners.ts`:
  - Change `WeeklyGoalReminderGoal.partnerId` to `partnerId?: Id<"users">`.
  - Add `mode?: WeeklyGoalMode` field for completeness (used by template selection downstream).
- `convex/emails/notificationEmailData.ts → buildEmailData`:
  - Wrap the goal-level partner fetch with `if (goal.partnerId !== undefined) { ... }`. Do **not** call `getUserById` with undefined.
  - `completedCount` derivation uses creator/partner branch only when partner exists; solo always uses `creatorCompleted`.
  - Pass `mode: goal.mode` into `EmailData` so templates can render solo copy.
  - **Solo triggers must never pass `fromUserId`.** `buildEmailData` has a second partner-name source at the top: `if (args.fromUserId) { data.partnerName = data.senderName }`. None of the four solo reminder triggers currently pass `fromUserId`, so it's safe today, but a future "self-pat" email would silently re-inject a partner-shaped string into solo copy. Codify this as an invariant: any call site scheduling a solo trigger omits `fromUserId`, and the trigger-specific branch in `buildEmailData` for the four solo reminders asserts `args.fromUserId === undefined` when `goal.mode === "solo"`.
- `convex/emails/reminderCrons.ts`:
  - Build participants with `getGoalParticipantIds(goal)` for all three crons. No inline partner check.
  - The `weekly_goal_reminder_1`, `weekly_goal_reminder_2`, `weekly_goal_daily_reminder`, and `weekly_goal_grace_period_reminder` triggers fire for solo creators with solo-aware copy. These are the **only** email triggers solo ever produces.
  - The `weekly_goal_invite`, `weekly_goal_accepted`, `weekly_goal_locked` triggers must never fire for solo goals. Inside `convex/emails/notificationEmailData.ts → buildEmailData`, in each of those three trigger-specific branches, throw `new ConvexError("INVALID_STATE: solo goal hit shared-only email trigger '<trigger>'")` when `goal.mode === "solo"`. Cheap defensive guard; prevents future regressions if someone wires them up by mistake.
- `lib/notificationTemplates.ts`:
  - `EmailData` gains `mode?: WeeklyGoalMode`.
  - `getSubjectForTrigger` and `getBodyForTrigger` add solo branches for `weekly_goal_daily_reminder`, `weekly_goal_reminder_1`, `weekly_goal_reminder_2`, `weekly_goal_grace_period_reminder`. Solo copy never references a partner. Sample solo daily body: `"Your weekly goal ends at <time>. You're at X/Y themes. Keep the momentum going."`. (Final wording is a small product call.)
  - **Do not** keep the `partner = data.partnerName ?? "your rival"` line as a silent default for solo — that's exactly the kind of fallback AGENTS.md prohibits. For solo, the template path is explicit, not "rival as fallback".

### Notification (in-app)

- `convex/notificationHelpers.ts → upsertWeeklyGoalNotificationForGoal` event union gains `"goal_completed_solo"`.
- Solo lifecycle in-app surface (complete list, intentionally short):
  - `weekly_goal_draft_expiring` (creator-only, already exists, no change for solo).
  - `weekly_goal_completed_solo` ("GZ at the end") emitted on big-boss defeat, `fromUserId === toUserId === creatorId`.
  - No invite, no accepted, no locked, no declined, no partner-locked, no goal_unlocked, no goal_activated, no challenge invite.
- `convex/notificationPayloads.ts` requires no changes: `WeeklyGoalPayload` is `Extract<NotificationPayload, { goalId: ... }>` and inherits the new event literal automatically from the schema validator.

## Admin & friends cleanup

### `convex/friends.ts → removeFriend`

- No code change. Solo goals don't appear in `closeVisibleGoalsBetweenParticipants` because their `partnerId === secondUserId` evaluates `false`.

### `convex/admin.ts → deleteUserFully`

Add explicit solo-goal block before the existing shared logic:

- Query `weeklyGoals` by `by_creator` filtered to `mode === "solo"`.
- For each solo goal owned by the deleted user:
  - Delete its `weeklyGoalThemeSnapshots`.
  - Delete its `weeklyGoalRepetitions` row (creator only).
  - Delete related `challenges`, `duels`, `soloPracticeSessions` (via existing `deleteGoalPlayRecordsForGoal`).
  - Delete the goal row.
- The shared branch is unchanged in behavior, but rewrite its `remainingParticipantId = goal.creatorId === userId ? goal.partnerId : goal.creatorId` line to use `getGoalPartnerIdForViewer(goal, userId)`. This both deduplicates the rule and makes it solo-safe (defense in depth in case ordering ever changes).

## UI

### `app/goals/components/GoalCreationPanel.tsx`

- Render a two-state segmented toggle at the top: `Solo` (default) / `With a friend`.
- `Solo` selected: hide `PartnerSelector`. Submit button label: `Create Solo Goal`. Submit calls `createSoloGoal`.
- `With a friend` selected: render existing `PartnerSelector`. Submit label: `Create Goal`. Submit calls `createSharedGoal({ partnerId })`. Submit disabled unless a partner is picked.

### `app/goals/hooks/useGoalsPageModel.ts`

- Add `creationMode: "solo" | "shared"` state, default `"solo"`.
- Replace `createGoal` mutation with both `createSoloGoal` and `createSharedGoal`. `handleCreateGoal` branches on `creationMode`.
- Setting `creationMode` to `"solo"` clears `selectedPartnerId`.
- `existingPartnerIds` cleanup (shape-driven, NOT a bug fix):
  - Today's code is harmless: viewer never appears in their own friends list, and solo goals contribute `undefined` partner ids that `.filter(Boolean)` already drops.
  - Once we discriminate on `mode`, filter solo goals out of the exclude-set construction so the intent of the code ("exclude users I already share a goal with") matches the shape of the data. Behavior is unchanged today.
- `partnerLocked` derived flag: `false` when `goal.mode === "solo"`.
- `viewerLocked` derived flag for solo: `selectedGoal.goal.creatorLocked`.
- `handleRemoveTheme` toast that says "your partner's lock was cleared": skip in solo (there is no partner; in solo, removing themes while creator is locked just unlocks the creator silently).

### `app/goals/components/GoalSwitcher.tsx`

- When `goalWithUsers.mode === "solo"`: render the creator's own initial/avatar and `formatVisibleUser(creator, "You")`, with a small "Solo" badge after the name. No "Partner" fallback text.
- Status indicator dot logic is unchanged.

### `app/goals/components/GoalParticipantsPanel.tsx`

- When `selectedGoal.mode === "solo"`: render a single centered column with the creator's avatar/name and a "Solo" pill. Do not render the partner avatar slot.
- Status text and date copy unchanged.
- For shared: render `partnerLocked` ✓ only when `selectedGoal.goal.partnerLocked === true` (defensive against optional field).

### `app/goals/components/GoalThemeList.tsx`

- Accept the normalized typed goal (`SoloGoal | SharedGoal`) or a discriminated `themes` prop derived from it. Do NOT accept raw Convex theme rows here — the normalization at the read boundary (`buildGoalWithUsers`) guarantees `partnerCompleted: boolean` is non-optional for shared themes, so no defensive `?? false` is needed.
- For solo: render only the "You" indicator and use `bothCompleted = theme.creatorCompleted` for the styled "completed" state. Hide the "Partner: …" indicator.
- For shared: unchanged behavior. Use `theme.partnerCompleted` directly (no coalesce). If TypeScript complains, the bug is upstream — `buildGoalWithUsers` is not passing the normalized shape through. Fix it there.

### `app/components/WeeklyGoalThemeMarker.tsx`

- Mode-aware "completed" indicator (solo: `creatorCompleted`; shared: both).

### `app/goals/components/LockButton.tsx`

- Solo: label becomes "Start goal". Keep the snapshot-warning confirmation modal (it's about snapshotting themes, not about partners).
- Solo, after creator locks (`creatorLocked === true`): the button must NOT render at all (or render as a disabled "Started" pill). There is no second actor whose lock is awaited, so leaving the button visible is misleading. Today shared keeps it visible for the partner — that's the only reason it stays.
- Shared: unchanged.

### `app/goals/components/GoalsPageContent.tsx`

- Hide the "Waiting for partner to lock..." block when `selectedGoal.mode === "solo"`.
- The boss-launch CTA still routes to `/boss/:goalId/:bossType`. The page itself does the duel-mode work.

### `app/boss/[goalId]/[bossType]/page.tsx` (the real boss launch page)

- Extend `getBossLaunchPreviewForViewer` (lives in `convex/weeklyGoals/bossWorkflows.ts`) to include `mode: WeeklyGoalMode` on its return shape. Update the TS preview type accordingly.
- When `preview.mode === "solo"`:
  - Hide `DuelModePicker` and the "Challenge Partner" CTA entirely.
  - Show only "Practice Solo".
  - Header copy: "Launch a solo boss run." (instead of "Launch a shared multi-theme boss duel, or warm up with solo practice first.").
  - Phase 2 note: once self-duel widens to `sourceType: "boss"`, this branch swaps from "hide picker, show Practice Solo only" to "show a single 'Duel Yourself' CTA that creates a boss self-duel". Practice Solo can stay alongside it as the lower-stakes warm-up. Do NOT pre-build this UI in v1 — wait for the self-duel mutation that accepts the boss source.
- Shared: unchanged.

### `app/repetition/components/RepetitionBoard.tsx`

- Mode-aware label. When `item.mode === "solo"`, render "Solo goal" instead of the partner-name slot (and never render "Deleted participant").
- Plumb `mode` from `buildBoardItem`.
- Route note: the canonical current route is `/repetition`. `/goals/repetition` currently redirects to `/repetition`; do not move the SR board back under `/goals/repetition` unless that is an explicit product decision.

### `app/notifications/components/NotificationItem.tsx`

- Add `goal_completed_solo` event branch with solo-specific copy and actions (View / Archive themes / Dismiss).
- Because `goal_completed_solo` is a self-notification (`fromUserId === toUserId`), the solo branch must NOT fall through to any shared-path rendering that shows a sender avatar/name/"X sent you" label. The dedicated branch renders the goal name, the GZ copy, and the three CTA buttons — nothing keyed off `fromUser`. Add a test in `tests/components/NotificationItem.solo.test.tsx` that mounts the item with `fromUserId === toUserId` and asserts no sender avatar / no "X sent you" copy is rendered.
- Update the component's local payload event union too, not only backend schema/types, so UI tests and mock notification payloads stay aligned.

### `app/notifications/components/FriendListItem.tsx` and `FriendsTab.tsx`

- No change required if `closeVisibleGoalsBetweenParticipants` is untouched. UI copy that mentions "your shared goals will be deleted" stays accurate (only shared goals get deleted on unfriend).

## Tests

### New test files

- `tests/lib/weeklyGoals.solo.test.ts`:
  - `countCompletedThemes` solo: counts `creatorCompleted` only.
  - `areAllThemesCompleted` solo: same rule.
  - `getEffectiveMiniBossStatus` / `getEffectiveBigBossStatus` solo: branch logic.
  - `planWeeklyGoalLock` solo: rejects `role === "partner"`, accepts `role === "creator"` and produces a single `activate_goal` plan.
- `tests/lib/themeAccess.solo.test.ts`:
  - Solo goal grants theme access only to the creator.
- `tests/lib/notificationTemplates.solo.test.ts`:
  - Daily, reminder 1, reminder 2, grace-period bodies and subjects for solo don't include "your rival", "you and X", or "your partner".
- `tests/convex/weeklyGoals.createSoloGoal.test.ts`:
  - Creates a goal with mode solo, no partner, no notifications, no email scheduled.
  - Second solo create returns CONFLICT.
- `tests/convex/weeklyGoals.lockGoal.solo.test.ts`:
  - Single lock activates and snapshots themes; emits zero notifications and zero email schedules.
- `tests/convex/weeklyGoals.toggleCompletion.solo.test.ts`:
  - Only flips `creatorCompleted`.
- `tests/convex/weeklyGoals.removeTheme.solo.test.ts`:
  - No partner-notify branch fires.
- `tests/convex/weeklyGoals.practiceThemes.solo.test.ts`:
  - Practice flow works using snapshot source post-lock; only creator-owned themes are eligible.
- `tests/convex/weeklyGoals.queries.solo.test.ts`:
  - Visible solo goals load as creator-only, with `partner: null` and no undefined user lookup.
  - Solo `getGoalForViewer` authorizes only the creator.
  - Solo `getEligibleThemesForViewer` returns only creator-owned themes.
- `tests/convex/weeklyBossFlow.solo.test.ts`:
  - `createBossChallenge` rejects solo with INVALID_STATE.
  - `startBossSoloPractice` works.
  - `completeBigBoss` emits exactly one `goal_completed_solo` self-notification and zero dismiss-challenge calls.
- `tests/convex/weeklyGoals.archiveCompletedGoalThemes.solo.test.ts`:
  - A `goal_completed_solo` notification archives the completed solo goal themes successfully.
  - The same mutation still accepts the existing shared `goal_completed` event.
  - Non-completed weekly-goal events still reject.
- `tests/convex/weeklyGoalRepetitions.solo.test.ts`:
  - On big-boss completion, exactly one repetition row exists.
  - `createRepetitionChallengeForCurrentUser` rejects solo with INVALID_STATE.
- `tests/convex/reminderCrons.solo.test.ts`:
  - Daily reminder, reminder_1, reminder_2, grace-period: only the creator is targeted; partner queries are never made.
- `tests/convex/notificationEmails.solo.test.ts`:
  - `buildEmailData` for solo daily reminder produces no partnerName, never calls `getUserById` with undefined.
- `tests/convex/friends.removeFriend.solo.test.ts`:
  - Setup: user A creates a solo goal, then A and B become friends.
  - Action: A removes friend B.
  - Assert: A's solo goal is still present, visible to A, with all fields intact and `shouldIncludeGoal` still true.

- `tests/convex/notificationEmails.soloAbsence.test.ts` (new, cheap and high-value):
  - Walk a solo goal through every lifecycle action: create → add 2 themes → lock → toggle theme completion → big-boss defeat.
  - Assert: across the entire run, the ONLY events ever emitted are `weekly_goal_draft_expiring` (if the draft timer fires in the test) and `goal_completed_solo`. No `weekly_goal_invite`, `weekly_goal_accepted`, `weekly_goal_locked`, `weekly_goal_declined`, `partner_locked`, `goal_unlocked`, `goal_activated`, challenge invites, or SR availability events.
  - This is the cheapest guard against a future PR silently adding "parity" events for solo.
- `tests/convex/admin.deleteUserFully.solo.test.ts`:
  - Solo goal is fully deleted (goal row + snapshots + repetition row + related play records).
- `tests/components/GoalCreationPanel.solo.test.tsx`:
  - Mode toggle defaults to Solo, submit calls `createSoloGoal`.
  - Toggling to With-a-friend reveals partner picker, submit calls `createSharedGoal`.
- `tests/components/GoalParticipantsPanel.solo.test.tsx`:
  - Renders only one avatar plus "Solo" pill.
- `tests/components/GoalThemeList.solo.test.tsx`:
  - No partner indicator; `bothCompleted` styling fires on `creatorCompleted` alone.
- `tests/components/RepetitionBoard.solo.test.tsx`:
  - Solo item shows "Solo goal", not "Deleted participant".
- `tests/components/NotificationItem.solo.test.tsx`:
  - `goal_completed_solo` renders solo copy and wires View / Archive themes / Dismiss actions.

### Existing tests: add `mode: "shared"` to fixtures, do not weaken assertions

Files that hard-code goal fixtures and must be updated:

- `tests/convex/weeklyGoals.deleteGoal.ttsCleanup.test.ts`
- `tests/convex/weeklyGoals.removeTheme.test.ts`
- `tests/convex/reminderCrons.test.ts`
- `tests/convex/friends.removeFriend.test.ts`
- `tests/convex/weeklyBossFlow.test.ts`
- `tests/convex/weeklyGoals.retention.test.ts`
- `tests/convex/weeklyGoals.addTheme.test.ts`
- `tests/convex/weeklyGoals.practiceThemes.test.ts`
- `tests/convex/weeklyGoals.toggleCompletion.test.ts`
- `tests/convex/themes.core.test.ts`
- `tests/convex/reminderPlanners.test.ts`
- `tests/convex/admin.deleteUserFully.test.ts`
- `tests/convex/weeklyGoals.declineWeeklyGoalInvitation.test.ts`
- `tests/convex/challenges.test.ts`
- `tests/convex/weeklyGoals.lockGoal.test.ts`
- `tests/convex/weeklyGoalRepetitions.test.ts`
- `tests/convex/weeklyGoalSnapshots.test.ts`
- `tests/lib/themeAccess.test.ts`
- `tests/lib/notificationTemplates.test.ts`
- `tests/lib/notificationPreferences.test.ts` (only if it builds goal-like fixtures)
- `tests/components/NotificationsTab.test.tsx`
- `tests/components/FriendListItem.test.tsx`
- `tests/components/WeeklyGoalThemeMarkerSurfaces.test.tsx`
- `tests/components/GoalThemeSelector.test.tsx`
- `tests/hooks/useNotificationSettings.test.ts`
- `tests/hooks/useWeeklyGoalThemeIds.test.ts`

For each: add `mode: "shared"` to the fixture row. No existing assertion is loosened.

Run `rg "creatorId:|partnerId:|weeklyGoals" tests/` TWICE:

1. Right before starting Phase A, to catch any goal-fixture builder this list missed. The list above is verified against the current `tests/` tree, but new fixtures can appear between writing this plan and starting the work.
2. Right after Phase A lands and codegen runs, because the schema tightening surfaces type errors that point at fixtures the rg missed.

## File-size and structure compliance

- `convex/weeklyGoals/mutations.ts` is already ~600 LOC. Adding solo branches risks crossing 700 LOC. Mitigation: extract `handleCreateSharedGoal` and `handleCreateSoloGoal` into `convex/weeklyGoals/createGoal.ts`, and extract the lock helpers into `convex/weeklyGoals/lockGoal.ts` if `mutations.ts` still goes over.
- `app/goals/hooks/useGoalsPageModel.ts` is already ~358 LOC. Adding `creationMode` state and mode branches is small, but if it grows over ~500 LOC, split the create-goal pieces into a sub-hook (`useCreateGoalForm`).

## Migration / rollout

- Phase A (schema additive) → Phase B (one-shot stamp mutation, **mandatory** — run it whether or not you think any rows exist; Phase C will refuse to deploy otherwise) → Phase C (tighten `mode` to required).
- **`normalizeWeeklyGoal` must not be reachable from any code path that runs before Phase B completes.** During the migration window rows have `mode === undefined`, and the helper is designed to throw on that. Concretely:
  - Do not import the normalization helper from any function that runs in Phase A or in the stamp mutation itself.
  - Land the solo feature code (which depends on the helper) only after Phase C + codegen.
- **Hard gate between phases.** Phase A and Phase C are two separate deploys with the stamp mutation run between them. Do NOT bundle the Phase C tightening commit with Phase A in the same deploy.
- No feature flag. Ship as a normal feature.

## Explicit non-goals (v1)

- Converting a solo goal to/from shared.
- Boss duels from a solo goal. (Deferred to Phase 2 once self-duel widens to `sourceType: "boss"`.)
- SR duels from a solo goal. (Deferred to Phase 2 once self-duel widens to the SR sourceType.)
- Sharing a solo goal's themes through the goal record.
- Public/leaderboard views of solo goals.
- Editing solo-vs-shared mode after creation.

## Phase 2: self-duel widening to boss & SR (NOT part of v1)

This phase is a follow-up that depends on BOTH this plan AND `Dev/self-duel-me-opponent-plan.md` being shipped. The self-duel side is already in (for `sourceType: "normal"`); the only remaining prerequisite is shipping solo-mode v1 (this plan). The work below is sketched here so v1 reviewers can sanity-check that the v1 rejections are the right shape to unblock later, and so the self-duel widening work has a clear target.

Prerequisites:
- Self-duel v1 is shipped (`createSelfDuel`, `mirrorPatchForSelfDuel`, `isSelfDuel`, `SELF_DUEL_FORCED_MODE`, countdown planners, `resolveAccessibleThemes` all live). **[satisfied]**
- Solo weekly goals v1 (this plan) is shipped. **[pending]**

Widening tasks (owned by the self-duel agent, consumed by weekly goals):

1. **Allow `sourceType: "boss" | "weeklyGoalRepetition"` in the self-duel creator.** Either generalize `createSelfDuel` to accept a `source` argument (`{ kind: "normal" } | { kind: "boss", goalId, bossType } | { kind: "weeklyGoalRepetition", repetitionId }`) or split into `createBossSelfDuel` / `createRepetitionSelfDuel` siblings that share `resolveAccessibleThemes`, `buildDuelSession`, and the mirror step. Naming preference: the siblings, because each has a distinct `sourceType` and distinct auth gate, and lumping them under one mutation invites a single-responsibility violation. Final choice belongs to the self-duel agent.
2. **Auth & eligibility checks for boss self-duels:** the goal must be `solo` (or the user must be opting in for a shared goal's solo path — out of scope here), the boss must be `ready`, the themes are the snapshotted boss-eligible set, etc. Reuse the existing boss eligibility helpers from `convex/weeklyGoals/bossWorkflows.ts`.
3. **Auth & eligibility checks for SR self-duels:** the repetition row must belong to the viewer and not already be `duelCompletedAt`. Reuse existing SR validation from `convex/weeklyGoalRepetitions/`.

Weekly-goal side changes that unlock when Phase 2 ships:

- **`handleCreateBossChallenge`**: when `goal.mode === "solo"`, instead of rejecting, route to the boss self-duel creator. Keep the rejection for any state self-duel does not cover (e.g., wrong boss status).
- **`createRepetitionChallengeForCurrentUser`**: when `goal.mode === "solo"`, route to the SR self-duel creator. Same fallthrough rule.
- **Boss launch page (`app/boss/[goalId]/[bossType]/page.tsx`)**: for solo, expose a single "Duel Yourself" CTA (alongside Practice Solo). Drives `createBossSelfDuel`.
- **`RepetitionBoard`** solo item: `duelAvailable` flips to `true`, the CTA reads "Duel Yourself" and drives `createRepetitionSelfDuel`. The `Solo goal` badge stays.
- **`getBossLaunchPreviewForViewer`** and `loadLaunchPreviewForUser` adjust their `duelAvailable` derivation for solo to reflect Phase 2 availability.

What stays the same after Phase 2:
- Solo notification surface (still just reminders + `goal_completed_solo`). A self-duel does NOT emit invite/accepted/locked-style events even when it widens — those events do not exist on the self-duel path.
- `goal_completed_solo` still fires once the big-boss self-duel completes (the completion path runs `completeBigBoss`, which already emits the solo notification).
- The discriminated `normalizeWeeklyGoal` shape, `getGoalParticipantIds`, `canAttachThemeToGoal` helpers — all unchanged.

No-duplication guard for Phase 2:
- Phase 2 must NOT add a second copy of `isSelfDuel` / `SELF_DUEL_FORCED_MODE` / mirror logic inside `convex/weeklyGoals/` or `convex/weeklyGoalRepetitions/`. Import from `lib/duel/selfDuel.ts` and `convex/rules/selfDuelMirror.ts`. Anywhere we widened `getGoalParticipantIds` etc. in this plan stays the canonical source.

## Effort estimate

2–4 focused days:
- ~0.75 day: schema migration + pure logic + discriminated union refactor.
- ~1 day: backend (queries, mutations, boss workflow, SR, admin, notifications, email data + templates).
- ~0.75 day: UI (creation panel, participants, theme list, switcher, boss launch page, repetition board, notification item).
- ~0.75 day: tests (new files + fixture updates).
- ~0.25 day: lint/typecheck/test pass and copy polish.
