# Code Review — Area 12: Email & reminders backend

**Date:** 2026-05-22
**Scope:** `convex/emails/` (all files), `convex/crons.ts`, `lib/notificationEmailTriggerContract.ts`. ~1.08k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- `convex/emails/emailNotificationLog.ts` — **326 LOC** (idempotency claim/log + cleanup)
- `convex/emails/reminderCrons.ts` — **204 LOC** (cron action orchestration)
- `convex/emails/notificationEmailData.ts` — **167 LOC** (per-id queries + `buildEmailData`)
- `convex/emails/notificationEmails.ts` — **135 LOC** (`sendNotificationEmail` action)
- `convex/emails/reminderPlanners.ts` — **136 LOC** (pure send-planning helpers)
- `convex/emails/actions.ts` — **41 LOC** (Resend provider wrapper)
- `convex/crons.ts` — **64 LOC**
- `lib/notificationEmailTriggerContract.ts` — **5 LOC** (re-export shim)

Cross-file boundaries traced (not expanded): `lib/notifications/definitions.ts` (the real
contract source), `convex/schema.ts:207-217` (`emailNotificationTriggerValidator`) and
`:519-549` (`emailNotificationLog` table + 8 indexes), `lib/notificationPreferences.ts`,
`lib/cleanupRetention.ts`, `convex/notificationHelpers.ts:74-89` (the other `sendNotificationEmail`
caller), `convex/constants.ts:114`.

Overall this area is in much better shape than Area 1: the layer separation is real (pure
planners in `reminderPlanners.ts`, server actions on top, provider isolated in `actions.ts`),
the claim→send→mark state machine is sound, and the per-context idempotency model is correct.
The problems are concentrated: ~75 lines of dead/duplicated code in `emailNotificationLog.ts`,
a hand-mirrored validator that can silently drift from the contract, an inert `reminderOffsetMinutes`
arg threaded through five layers, and a contract "boundary" file that is a triple re-export.

---

## 🔴 Blockers

### 1. `emailNotificationLog.ts`: `findEmailNotificationLog` and `checkEmailNotificationSent` are the same 60-line index ladder copied twice

`checkEmailNotificationSent` (lines 25-102) and `findEmailNotificationLog` (lines 104-164) are
byte-for-byte the same five-way dispatch over the same indexes
(`weeklyGoal+dedupeKey` → `challenge` → `duel` → `soloPracticeSession` → `weeklyGoal` →
`by_user_trigger`). The *only* difference is the final expression: `check` returns
`log?.status === "sent"`, `find` returns the doc. That is ~120 lines encoding one lookup twice.

**Remedy:** keep `findEmailNotificationLog` as the single lookup. Delete `checkEmailNotificationSent`
entirely and define the check in terms of the finder:

```ts
async function checkEmailNotificationSent(ctx, args) {
  const log = await findEmailNotificationLog(ctx, args);
  return log?.status === "sent";
}
```

Drops ~75 LOC and removes the maintenance hazard where a future index change must be mirrored
across both ladders.

### 2. `emailNotificationLog.ts`: `logNotificationSent` (lines 182-213) is dead code

Grep across the repo (excluding `_generated`) returns exactly one hit: the definition itself.
The live send path is `claimNotificationSend` → `markNotificationSendSent` (see
`notificationEmails.ts:102-125`). `logNotificationSent` is a second, parallel "insert a sent row"
mutation that nothing calls and that bypasses the claim/pending machinery the rest of the system
relies on. Leaving it invites a future caller to write `sent` rows that race the claim flow.

**Remedy:** delete the export (32 LOC). If a callable "force-mark-sent" is ever needed it should
go through the claim model, not a second insert path.

### 3. `emailNotificationLog.ts`: `resetEmailNotificationLogForStatusCutover` (lines 313-326) is a one-off migration with no caller — forbidden by AGENTS.md

The name ("...ForStatusCutover") and body (delete every row in the table) make this a
post-migration cleanup mutation tied to a `status`-field rollout that has already shipped (the
`status` field is now a required schema column, schema.ts:522). It has zero callers. AGENTS.md
"No fallback code" explicitly covers "compatibility branches for removed code paths" and one-off
cutover scaffolding; this is dead migration code that should not live in the production module.

**Remedy:** delete it (14 LOC). If the table genuinely needs a wipe again, that is an ad-hoc
ops action, not a permanent export named after a finished migration.

### 4. The trigger set is declared twice and hand-kept in sync — `emailNotificationTriggerValidator` should derive from the contract

`schema.ts:207-217` hand-writes a `v.union(...)` of nine string literals. `lib/notifications/definitions.ts:67-121`
independently lists the same nine keys in `NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS`. I diffed both:
they match today, but nothing enforces that. Add a tenth trigger to the contract and every consumer
(`isNotificationEnabled`, templates, planners) compiles, while the validator silently rejects it at
the Convex boundary — a drift bug that typechecks. This is exactly the "make the type boundary
explicit so the contract is enforced" standard, and the contract object already exists as the
single source of truth.

**Remedy:** derive the validator from the contract keys instead of re-listing them, e.g. build the
union from `NOTIFICATION_EMAIL_TRIGGERS` (or assert equivalence with a `satisfies`/type-level check
so a mismatch fails `typecheck`). One source of truth; the schema literal list disappears.

---

## 🟡 Medium

### 5. `reminderOffsetMinutes` is threaded through five layers as an idempotency arg but is never used as one

It is declared on `checkNotificationSent`, `logNotificationSent`, and `claimNotificationSend`
(emailNotificationLog.ts:174, 190, 223), stored on every inserted row (lines 207, 256), declared
on the schema table (schema.ts:527), and passed from `notificationEmails.ts:109` and the cron
(`reminderCrons.ts:59`). But **no index includes it** and **no `find`/`check` branch reads it** —
the `weekly_goal_reminder_1` / `_2` triggers are de-duplicated purely by `(toUserId, trigger,
weeklyGoalId)` via `by_user_trigger_weeklyGoal`. So `reminderOffsetMinutes` is dead weight in the
idempotency layer: it travels through claim/check/log signatures pretending to be a discriminator
that the dedupe key never consults.

This is fine *as a stored audit field* on the row, but it should not be in the `checkNotificationSent`
/ `claimNotificationSend` *argument lists*, because its presence implies it participates in the
lookup and it does not. (Compare `dedupeKey`, which genuinely selects the
`by_user_trigger_weeklyGoal_dedupeKey` index.)

**Remedy:** drop `reminderOffsetMinutes` from the args of `checkNotificationSent` and
`claimNotificationSend` (keep it only where the row is *written* — i.e. as an insert payload field
on the claim, if the audit value is wanted). That removes it from `EmailNotificationLogLookupArgs`
and clarifies that reminder_1/reminder_2 dedupe on trigger alone. If two different offsets for the
same trigger must be sent separately, that is a real requirement — but then it needs an index and a
`find` branch, not a silently-ignored arg.

### 6. `lib/notificationEmailTriggerContract.ts` is a triple re-export with one consumer — the "boundary" is indirection, not a boundary

The full file is a rename-only re-export of three symbols from `lib/notifications/definitions.ts`
(`NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS as NOTIFICATION_EMAIL_TRIGGER_CONTRACT`,
`NOTIFICATION_EMAIL_TRIGGERS`, `NotificationEmailTrigger as NotificationTrigger`). Its only importer
is `lib/notificationPreferences.ts:11-15`, which then **re-exports the same three symbols a third
time** (notificationPreferences.ts:52-56). Everything downstream (`emailNotificationLog.ts`,
`notificationEmails.ts`, `notificationEmailData.ts`, `notificationTemplates.ts`) imports
`NotificationTrigger` from `lib/notificationPreferences`, not from this file.

So the chain is `definitions.ts` → `notificationEmailTriggerContract.ts` (rename) →
`notificationPreferences.ts` (rename re-export) → consumers. The middle file buys nothing: it is
not a published seam (single internal importer), and it does not add validation, narrowing, or
documentation — it only renames `*_DEFINITIONS` to `*_CONTRACT`. This is a thin identity layer of
exactly the kind the rubric flags ("delete a layer of indirection rather than polish it").

Note also the rename `NotificationEmailTrigger` → `NotificationTrigger` actively *broadens* the name:
the type is email-trigger-only, but the whole stack now calls it `NotificationTrigger`, which reads
like it also covers in-app notification types (it does not — those live in `NotificationType`,
definitions.ts:34). That is the AGENTS.md "naming across the stack" smell: two different concepts
(`NotificationType` for in-app, `NotificationTrigger` for email) with confusingly overlapping names.

**Remedy:** delete `lib/notificationEmailTriggerContract.ts`. Have `notificationPreferences.ts`
import directly from `./notifications/definitions`. If a stable name `NOTIFICATION_EMAIL_TRIGGER_CONTRACT`
is desired, export it under that name from `definitions.ts` itself (one file owns the contract).
Separately, prefer keeping the type name `NotificationEmailTrigger` end-to-end so it cannot be
mistaken for the in-app `NotificationType`.

### 7. `EMAIL_SEND_CLAIM_STALE_MS` magic number lives inline instead of in `constants.ts`

`emailNotificationLog.ts:13` defines `const EMAIL_SEND_CLAIM_STALE_MS = 10 * 60 * 1000;` at module
scope. Its sibling retention knob `EMAIL_LOG_TTL_MS` is in `convex/constants.ts:114` with a doc
comment. AGENTS.md requires non-obvious tuning numbers in `constants.ts`; this 10-minute claim TTL
is exactly such a knob and is currently invisible to anyone scanning the constants file.

**Remedy:** move it to `convex/constants.ts` next to `EMAIL_LOG_TTL_MS` with a one-line comment
("stale pending-claim reclaim window for email idempotency").

### 8. `by_status` index (schema.ts:548) is defined but never queried

Grep for `by_status` in `convex/` returns no email-side query. The `status` field is read only by
direct-doc lookups in `claimNotificationSend` (via `findEmailNotificationLog`) and in the cleanup
loop, neither of which uses this index. The likely intent was a "retry failed sends" sweep that
was never built — `failed` rows are written (markNotificationSendFailed) but never re-read.

**Remedy:** either (a) delete the unused `by_status` index, or (b) if failed-send retry is
intended, that is a missing cron + query, not a dangling index. Given the rest of this review,
delete it until the retry path exists.

### 9. Cron path fetches prefs and re-checks `isNotificationEnabled` twice

In the cron flow, `reminderPlanners.ts` already calls `isNotificationEnabled(trigger, prefs)` for
every planned send (e.g. lines 48, 64, 88, 106, 134), gated on prefs the cron just fetched
(`reminderCrons.ts:41-44`, `:93-95`). Then `sendNotificationEmail` (notificationEmails.ts:78-84)
fetches prefs **again** and calls `isNotificationEnabled` **again**. For the weekly-goal crons
that is a redundant per-recipient query (and the prefs query already runs once per participant
inside a nested goal×participant loop).

The send-side check is the legitimate canonical gate — `sendNotificationEmail` is *also* called
directly from `notificationHelpers.scheduleNotificationEmail` (immediate triggers that never touch
the planners), so it must keep its own enablement check. The duplication is on the *planner* side.

**Remedy:** treat `sendNotificationEmail`'s prefs check as the single gate and drop the
`isNotificationEnabled` checks from the planners (they become pure "what would this send look like"
shapers, not policy). The planners' value is the typed send descriptors, not re-deciding
enablement. This also removes the planner's dependency on `prefs` for the enable decision (it would
still need prefs only for `reminderOffsetMinutes` in `planFixedReminderEmails`). Net: one prefs
query per recipient instead of the decision being made in two layers.

### 10. `notificationEmailData.ts`: four near-identical one-line `internalQuery` getters

`getUserById`, `getChallengeById`, `getWeeklyGoalById`, `getThemeById` (lines 20-46) are each
`{ args: { id }, handler: (ctx, a) => ctx.db.get(a.id) }`. These are generic "get by id" wrappers
that exist only because `buildEmailData` runs in an action and must hop through queries. That is a
legitimate constraint, but four copies of the same body is boilerplate, and `getUserById` in
particular is re-implemented here while user-by-id reads exist elsewhere in the codebase.

**Remedy:** low priority given the action→query constraint, but consider a single generic
`getDocById` internal query (or reuse a canonical user getter for `getUserById`) rather than four
identical exports. At minimum, note that these are pure plumbing so they are not mistaken for
domain queries.

---

## 🟢 Minor / nit-level

- `notificationEmails.ts:65` — `const trigger = args.trigger as NotificationTrigger;` is a redundant
  cast. `args.trigger` is already typed by `emailNotificationTriggerValidator`, whose inferred type
  is the same literal union as `NotificationTrigger`. Drop the cast (and once #4 derives the
  validator from the contract, they are provably identical).
- `notificationEmailData.ts:113-125` — two `throw new Error("INVALID_STATE: ...")` guards use raw
  `Error`, while the rest of this area uses `ConvexError({ code, message })` (notificationEmails.ts,
  actions.ts). For consistency at the boundary, prefer `ConvexError` here too.
- `cleanupEmailNotificationLog` (emailNotificationLog.ts:290-311) double-guards retention: the
  `by_sentAt` index range already filters `sentAt < cutoff`, then the loop re-checks
  `isEmailLogPastRetention(...)` with the same TTL. The per-row check is harmless (and keeps the
  pure helper as the authority) but is logically redundant with the index bound; a short comment
  noting "index gives candidates, helper is the authority" would justify it.
- `reminderCrons.ts:19-25` — `runEmailSend` swallows errors with `console.error`. This is correct
  for a best-effort fan-out cron (one bad recipient must not abort the batch) and is *not* a
  forbidden fallback. Fine as-is; worth a one-line comment that the swallow is intentional batch
  isolation.
- `crons.ts` — the scheduling is clean and flat: nine `crons.interval`/`crons.hourly`
  registrations, descriptive kebab-case names, one job per concern. No ad-hoc orchestration, no
  conditional registration. The `send-daily-weekly-goal-reminder-emails` job runs hourly and
  self-gates on local hour inside the action (`sendDailyWeeklyGoalReminderEmails`, reminderCrons.ts:75)
  rather than via `minuteUTC`-only scheduling — that is the right call given the
  timezone-relative requirement and is not a smell.

---

## Implementation Plan — approved 2026-05-23

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · #7 A · #8 A · #9 A · #10 A · minors A.
All accepted. Documentation only — implementation not yet authorized.

**Step 1 — delete dead code (#2, #3).** Zero-risk, ~46 LOC.
- Delete `logNotificationSent` (`emailNotificationLog.ts:182-213`) — no callers; the live path is
  `claimNotificationSend` → `markNotificationSendSent`.
- Delete `resetEmailNotificationLogForStatusCutover` (`emailNotificationLog.ts:313-326`) — finished
  one-off cutover migration, forbidden by AGENTS.md "no fallback/compat code".

**Step 2 — collapse the duplicated lookup ladder (#1).** Behavior-preserving, ~75 LOC.
- Keep `findEmailNotificationLog` (`:104-164`) as the single index lookup.
- Delete `checkEmailNotificationSent`'s copied ladder (`:25-102`) and redefine it as
  `const log = await findEmailNotificationLog(ctx, args); return log?.status === "sent";`.

**Step 3 — derive the trigger validator from the contract (#4).** Closes the silent-drift hole.
- Build `emailNotificationTriggerValidator` (`schema.ts:207-217`) from the contract keys
  (`NOTIFICATION_EMAIL_TRIGGERS` in `lib/notifications/definitions.ts:67-121`) instead of re-listing
  the nine literals, or add a `satisfies`/type-level equivalence assert so a mismatch fails
  `typecheck`. One source of truth.

**Step 4 — delete the re-export shim (#6) + drop the inert idempotency arg (#5).**
- Delete `lib/notificationEmailTriggerContract.ts`; have `lib/notificationPreferences.ts:11-15`
  import directly from `./notifications/definitions`. Keep the precise name `NotificationEmailTrigger`
  end-to-end (do not broaden to `NotificationTrigger`, which collides with in-app `NotificationType`).
- Drop `reminderOffsetMinutes` from the arg lists of `checkNotificationSent` and
  `claimNotificationSend` (`emailNotificationLog.ts:174, 223`) and from
  `EmailNotificationLogLookupArgs`; keep it only as a written audit field on the claimed row
  (`:256`) and on the schema column (`schema.ts:527`). reminder_1/reminder_2 dedupe on trigger alone.

**Step 5 — constants + unused index (#7, #8).**
- Move `EMAIL_SEND_CLAIM_STALE_MS` (`emailNotificationLog.ts:13`) to `convex/constants.ts` next to
  `EMAIL_LOG_TTL_MS` (`:114`) with a one-line comment.
- Delete the unused `by_status` index (`schema.ts:548`) — no query reads it; retry path doesn't exist.

**Step 6 — single prefs gate (#9), generic getter (#10), minors.**
- Make `sendNotificationEmail`'s prefs check (`notificationEmails.ts:78-84`) the single enablement
  gate; drop the `isNotificationEnabled` checks from the planners (`reminderPlanners.ts:48,64,88,106,134`)
  so they become pure send-descriptor shapers. Keep the send-side check (also hit directly by
  `notificationHelpers.scheduleNotificationEmail`).
- Collapse the four get-by-id getters (`notificationEmailData.ts:20-46`) to one generic `getDocById`
  (or reuse a canonical user getter for `getUserById`). Low priority.
- Minors: drop redundant cast (`notificationEmails.ts:65`); switch raw `Error` →
  `ConvexError` (`notificationEmailData.ts:113-125`); add the justify-with-a-comment notes on
  `cleanupEmailNotificationLog`'s double-guard and `runEmailSend`'s intentional error swallow.

**Coordination note:** Area 11's minor "move the email-preferences trio to Area 12" — this area owns
that relocation; pull `lib/notificationPreferences.ts`'s email-pref helpers/UI into scope here so it
isn't handled twice.

**Gate at implementation time (docs-only now, so not run yet):** eslint + `npm run typecheck` +
`npm run test:run`.

## Approval bar

Approve-with-changes, not block. There is no structural regression and the core state machine is
sound, but four items must land before this is clean:

- ~120 lines of dead/duplicated code in `emailNotificationLog.ts` (#1, #2, #3), including a
  forbidden post-migration cutover mutation;
- a hand-mirrored trigger validator that can drift from the contract without failing typecheck (#4);
- a contract "boundary" file (`notificationEmailTriggerContract.ts`) that is pure triple-re-export
  indirection with a single consumer and a name that broadens the concept (#6);
- an idempotency argument (`reminderOffsetMinutes`) threaded through five layers that no lookup or
  index ever consults (#5).

None of these are functional bugs; all are maintainability/contract-cleanliness defects with
concrete, behavior-preserving remedies.
