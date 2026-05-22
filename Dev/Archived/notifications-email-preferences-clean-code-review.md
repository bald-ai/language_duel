# Notifications / Email / Preferences Clean Code Review

Review scope: Area B - in-app notifications, email triggers, reminders, and preferences.

Review principles:
- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

This was a focused read-only pass over the notification/email/preference paths. Findings are filtered into Must / Might / Ignore.

## Must

1. **Email send claims are stored as if the email was already sent**
   - Files: `convex/emails/notificationEmails.ts:63-88`, `convex/emails/emailNotificationLog.ts:150-179`, `convex/schema.ts:470-479`
   - Principles: Avoid Hidden Side Effects, Clear Boundaries, Testable Business Logic
   - Problem: `sendNotificationEmail` creates an `emailNotificationLog` row before calling Resend. That row uses `sentAt` immediately and there is no `pending/sent/failed` state in the schema. If the action dies after the claim is written but before the send result is known, later attempts see the log as already sent and the email can be silently lost.
   - Fix direction: model email send state explicitly, for example `pending -> sent -> failed`, or use a separate short-lived claim/lock table and only write the durable sent log after provider success.

2. **Notification preference saves can overwrite each other from a stale client snapshot**
   - Files: `app/settings/notifications/hooks/useNotificationSettings.ts:23-33`, `convex/notificationPreferences.ts:62-107`
   - Principles: Clear Boundaries, Avoid Hidden Side Effects
   - Problem: the UI sends the full preference object for every small toggle. `updatePrefs` merges one changed field into the currently cached query result, then the mutation replaces the whole stored preference row. Two quick toggles can race: the later request can be based on an older snapshot and undo the earlier change.
   - Fix direction: make the backend mutation patch only explicit fields, or add a version/updatedAt check so stale full-row writes cannot quietly win.

3. **Email trigger context is too loose at the action boundary**
   - Files: `convex/emails/notificationEmails.ts:20-31`, `convex/emails/notificationEmailData.ts:79-135`, `lib/notificationTemplates.ts:53-151`
   - Principles: Clear Boundaries, Right Logic In Right Layer
   - Problem: every trigger accepts every context ID as optional. The data builder only enriches the email if IDs happen to be present, and templates then render generic fallback content. That means a weekly-goal email can be sent and logged without a `weeklyGoalId`, or a challenge email without a `challengeId`, instead of failing at the boundary.
   - Fix direction: define per-trigger input contracts, validate required context before rendering/logging, and fail loudly when a caller schedules an invalid email.

## Might

1. **Email trigger definitions are duplicated across schema and shared config**
   - Files: `convex/schema.ts:163-174`, `lib/notifications/definitions.ts:67-127`, `lib/notificationEmailTriggerContract.ts:1-5`
   - Principles: No Duplication Of Rules, Clear Naming
   - Problem: the Convex validator has a manual trigger union, while the app/shared layer has the trigger definition map. A future trigger can be added to settings/templates but forgotten in the schema, or the reverse.
   - Fix direction: keep one source of truth for trigger names and generate/derive the other side where Convex allows it.

2. **`convex/notificationHelpers.ts` mixes unrelated notification responsibilities**
   - File: `convex/notificationHelpers.ts:25-291`
   - Principles: Single Responsibility, Clear Boundaries
   - Problem: one helper file owns notification creation, email scheduling, payload guards, dismissal lookup, challenge dismissal, friend dismissal, weekly-goal dismissal, and weekly-goal upsert behavior.
   - Fix direction: split into focused modules: creation/scheduling, payload validation, dismissal helpers, and weekly-goal notification orchestration.

3. **Weekly-goal notifications overload one notification type for many events**
   - Files: `convex/notificationHelpers.ts:240-291`, `convex/weeklyGoals.ts:867-884`, `convex/weeklyGoals.ts:1263-1297`, `convex/weeklyGoals.ts:1632-1643`
   - Principles: Clear Naming, Clear Boundaries
   - Problem: `weekly_goal_invitation` represents invite, declined, partner locked, goal activated, and goal completed via payload `event`. This makes the type name misleading and puts too much meaning into a second field.
   - Fix direction: either rename the type to a neutral `weekly_goal_event`, or split important events into distinct notification types.

4. **Notification payload guards are shape-only**
   - File: `convex/notificationPayloads.ts:17-27`
   - Principles: Clear Boundaries, Testable Business Logic
   - Problem: guards only check whether a property exists, such as `"goalId" in payload`. That is currently enough because the schema shapes are simple, but it becomes fragile if payloads grow or overlap.
   - Fix direction: use explicit payload-kind/type validation, or keep each notification type tied to one payload validator.

5. **Reminder cron orchestration repeats the same participant/preference/send loops**
   - File: `convex/emails/reminderCrons.ts:26-203`
   - Principles: No Duplication Of Rules, Single Responsibility
   - Problem: fixed reminders, daily reminders, grace reminders, and draft-expiry reminders each fetch users/preferences and call `sendNotificationEmail` in their own loop shape. The pure planners are good, but the action-level orchestration can still drift.
   - Fix direction: keep the planners, but extract a small shared send-runner that handles participant iteration, preference loading, and error context consistently.

6. **Email data building is one broad cross-feature builder**
   - File: `convex/emails/notificationEmailData.ts:59-138`
   - Principles: Single Responsibility, Right Logic In Right Layer
   - Problem: one function builds challenge, weekly-goal, reminder, grace-period, sender-palette, progress, and timing data. This makes per-trigger requirements hard to see and test.
   - Fix direction: split into per-trigger or per-family builders, then call them from the stricter trigger contract.

7. **Settings UI owns trigger grouping logic**
   - Files: `app/settings/notifications/page.tsx:17-22`, `app/settings/notifications/page.tsx:118-148`
   - Principles: Right Logic In Right Layer, Testable Business Logic
   - Problem: the page groups triggers by inspecting each trigger's preference category. This is okay today, but the UI now knows how email trigger taxonomy works.
   - Fix direction: expose grouped trigger lists from `lib/notifications/definitions.ts` so the page only renders groups.

## Ignore

1. **Notification read/dismiss mutations are expected side effects**
   - Files: `convex/notifications.ts:107-151`
   - Marking a notification read or dismissed is a normal command, not a hidden side effect.

2. **Email/template fallback copy is acceptable for missing optional display names**
   - Files: `lib/notificationTemplates.ts:55-86`, `convex/emails/notificationEmailData.ts:63-76`
   - Generic names like `Someone` / `Player` are product fallbacks for optional user display data, not legacy compatibility fallback code.

3. **Existing pure reminder planners are a good boundary**
   - Files: `convex/emails/reminderPlanners.ts:38-135`, `tests/convex/reminderPlanners.test.ts:23-134`
   - The planner layer is already testable business logic. The cleanup should focus on the cron/action orchestration around it, not replacing the planners.

4. **Weekly goals / AI generation / TTS overlap is already covered elsewhere**
   - Files: `Dev/weekly-goals-boss-repetition-clean-code-review.md`, `Dev/ai-generation-tts-external-apis-clean-code-review.md`
   - This review only repeats notification/email edges that directly affect Area B.

## Validation

No code changed. Validators were not run because this was a review-only documentation change.
