# Code Review — Area 11: Notifications & friends

**Date:** 2026-05-22
**Scope:** Notification list/render UI, friends UI, and the notification/friends Convex
backend (excluding the email-sending backend and auth). ~3.4k LOC.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

- **app/notifications/components/** (real LOC):
  `NotificationItem.tsx` (524), `FriendListItem.tsx` (344), `NotificationsTab.tsx` (186),
  `AddFriendSection.tsx` (170), `FriendsTab.tsx` (151), `NotificationPanel.tsx` (145),
  `FriendDuelLauncher.tsx` (49), `index.ts` (1)
- **app/notifications/hooks/**:
  `useNotificationPanel.ts` (61), `useNotifications.ts` (58), `useCountdown.ts` (55),
  `useWeeklyGoalNotificationActions.ts` (47), `useFriendNotificationActions.ts` (33),
  `useChallengeNotificationActions.ts` (32), `index.ts` (2)
- **app/notifications/**: `constants.ts` (13)
- **convex/**: `friends.ts` (492), `notificationHelpers.ts` (305), `notifications.ts` (179),
  `notificationPreferences.ts` (112), `notificationPayloads.ts` (27)
- **lib/**: `notificationTemplates.ts` (260), `notificationPreferencesDefaults.ts` (103),
  `notificationPreferences.ts` (61), `notifications/definitions.ts` (127),
  `relationshipPolicy.ts` (18)

Cross-referenced (not in scope, read for boundary checks only): `convex/schema.ts`
(`notificationPayloadValidator`, `notificationTypeValidator`),
`convex/helpers/relationshipPolicy.ts`, `lib/cleanupRetention.ts`,
`convex/weeklyGoals.ts` (payload writers).

Excluded per area split: `lib/notificationEmailTriggerContract.ts`, `convex/emails/*`,
`convex/crons.ts` (Area 12), user/auth (Area 15). Note `lib/notificationPreferences.ts`,
`lib/notificationPreferencesDefaults.ts`, and `convex/notificationPreferences.ts` are almost
entirely an email-preferences surface and arguably belong with Area 12 — see Minor.

---

## 🔴 Blockers

### 1. The notification "kind" is modeled four different ways; only one of them is the real one

There is a genuine, validated discriminated union for notification payloads in the schema
(`convex/schema.ts:176` `notificationPayloadValidator`) keyed by which id field is present
(`friendRequestId` | `goalId` | `challengeId`), and `convex/notificationPayloads.ts` already
derives clean `FriendRequestPayload` / `WeeklyGoalPayload` / `ChallengeInvitePayload` types
plus type guards from it. `lib/notifications/definitions.ts:3` adds a second clean model
(`NOTIFICATION_DEFINITIONS` with `type` → `payloadKind`/`category`/`dismissible`).

Then `NotificationItem.tsx:10-39` throws all of that away and re-declares its own payload
shape as one flat bag where **every field is optional**:

```ts
payload?: {
    challengeId?: ...; goalId?: ...; friendRequestId?: ...; themeName?: string;
    duelDifficultyPreset?: ...; duelMode?: DuelMode; themeCount?: number;
    event?: "invite" | "declined" | "partner_locked" | ... | "draft_expiring";
};
```

This loose shape forces the renderer to re-discriminate by hand with a 280-line
`switch (type)` containing nested `if (payload?.event === ...)` chains
(`NotificationItem.tsx:82-357`). The discrimination the schema already guarantees is
re-derived, untyped, in the component — the exact "scattered switch/if chains repeated across
build/render" smell. `NotificationData` is also a hand-maintained duplicate of what
`api.notifications.getNotifications` already returns (`useNotifications.ts:15`); nothing
imports it, and it will silently drift from the server type.

**Remedy:** delete the local `NotificationData`/`payload` re-declaration. Type the prop as the
inferred element type of the `getNotifications` query result (Convex generates this), so
`payload` is the real discriminated `NotificationPayload`. Drive rendering off `type` +
`payload.event` with the schema union, so the compiler enforces that every case is handled and
that, e.g., `themeName` is only read on the challenge branch. This is the precondition for #2.

### 2. `NotificationItem.tsx` (524 LOC) is an N-way type switch that should be a dispatch table of per-type components

`getNotificationContent()` (`NotificationItem.tsx:78-358`) is a 280-line function that returns
`{ icon, message, actions }` for nine distinct cases (friend request; six weekly-goal
`event` variants — `partner_locked`, `goal_unlocked`, `goal_activated`, `goal_completed`,
`goal_completed_solo`, `declined`, plus the default invite; draft-expiring; challenge invite;
fallback). Each case open-codes its own `<div className="flex gap-2 mt-3"> … </div>` action
row with the same two-or-three `<ActionButton>`s. The View/Dismiss pair alone is copy-pasted
verbatim five times (lines 112-130, 136-154, 160-178, plus variants).

This is the classic case for a dispatch table of small components rather than a switch:

**Remedy:** define a registry keyed by a discriminator (notification `type`, and for weekly
goals the `event`), each entry a tiny presentational component
(`<FriendRequestCard>`, `<ChallengeInviteCard>`, `<WeeklyGoalCard>` with an inner
event→content map, `<DraftExpiringCard>`). The outer `NotificationItem` shrinks to the chrome
(`NotificationItem.tsx:362-397`: icon bubble + relative time + slot) plus a lookup. Each card
declares only the callbacks and payload fields it actually uses, which simultaneously fixes #3.
Factor the repeated action rows into one `<NotificationActions>` taking a small button list.
Target: outer file well under 150 LOC, each card 20-40 LOC. The icon components
(`UserPlusIcon`/`CalendarIcon`/`SwordIcon`/`BellIcon`, lines 486-524) move next to the card
that uses them.

### 3. `NotificationItem` takes nine callbacks; any given notification uses at most three

`NotificationItemProps` (`NotificationItem.tsx:41-52`) declares
`onAcceptFriendRequest`, `onRejectFriendRequest`, `onAcceptChallenge`, `onDeclineChallenge`,
`onViewWeeklyGoal`, `onDeclineWeeklyGoal`, `onDismissWeeklyGoal`,
`onArchiveCompletedGoalThemes`, `onDismiss` — and `NotificationsTab.tsx:150-162` wires all
nine on every render for every notification regardless of type. A friend-request card ignores
seven of them; a challenge card ignores seven. This is the prop-pyramid symptom of the missing
per-type boundary (#2): the union of every type's actions is flattened onto one interface.

**Remedy:** after #2, each card receives only its own handlers. The cleanest version pushes the
mapping of `(notification → handlers)` out of `NotificationsTab`'s giant arrow-prop block and
into the per-type card + the `useNotifications` action bag, so `NotificationsTab` just renders
`<NotificationItem notification={n} />` and the card pulls the actions it needs from a context
or a passed `actions` object. Removes the nine-arg call site (`NotificationsTab.tsx:153-161`).

### 4. `NotificationsTab` re-implements an existing payload type guard with `unknown` + `isRecord`

`NotificationsTab.tsx:15-18` defines `hasGoalId(payload: unknown): payload is { goalId }` using
`isRecord` + `"goalId" in payload`, purely to extract `goalId` for `onViewWeeklyGoal`. That is
exactly `isWeeklyGoalPayload` from `convex/notificationPayloads.ts:21`
(re-exported via `notificationHelpers.ts:301`), which already narrows to the real
`WeeklyGoalPayload`. The bespoke `unknown`-typed guard exists only because the notification
type is loose at the boundary (#1).

**Remedy:** once the query result is typed against the schema union (#1), `goalId` is reachable
by narrowing on the payload directly; delete `hasGoalId` and the `isRecord`/`unknown` import.
If a guard is still wanted, import `isWeeklyGoalPayload` — do not hand-roll a parallel one.

### 5. `friends.removeFriend` hand-rolls the bidirectional friendship lookup that a canonical helper already does

`friends.ts:338-364` collects *all* of the caller's friendships and *all* of the target's
friendships with two full `by_user` `collect()`s, then `.find()`s each direction in JS:

```ts
const friendshipsFromUser = await ctx.db.query("friends").withIndex("by_user", q => q.eq("userId", user._id)).collect();
const outgoingFriendship = friendshipsFromUser.find(f => f.friendId === args.friendId) ?? null;
// ...same again for the other direction
```

`convex/helpers/relationshipPolicy.ts:7` `loadFriendshipsBetweenUsers(ctx, a, b)` already
returns exactly the (at most two) friendship rows between two users, using an indexed
`.filter(friendId === …)` instead of loading the entire friend list. `sendFriendRequest`
(`friends.ts:238-242`) and the challenge path (`convex/challenges.ts:201`) already use the
indexed-pair approach; `removeFriend` is the odd one out and is O(total friends) instead of
O(1).

**Remedy:** load the pair via the existing helper (or its underlying indexed query returning
the docs) and delete both rows. Keeps friendship-pair access in one canonical place and drops
the two full-table-for-user scans. (`areUsersFriendsInDb`/`loadFriendshipsBetweenUsers` are
the canonical layer here; `friends.ts` should consume them, not re-derive.)

---

## 🟡 Medium

### 6. `NOTIFICATION_TYPES` is a runtime `Object.fromEntries` whose result is hand-asserted back to a literal type

`lib/notifications/definitions.ts:36-43` builds the `FRIEND_REQUEST → "friend_request"` map at
runtime by upper-casing keys, then casts the `Record<string,string>` result to a hand-written
literal type listing all four members. The cast is load-bearing and must be edited in lockstep
with the source object — if a fifth type is added to `NOTIFICATION_DEFINITIONS`, the constant
silently keeps the old literal type and the new key is `string`-typed at call sites. This is a
"magic" derivation hiding a fixed shape.

**Remedy:** either write the four-entry `NOTIFICATION_TYPES` object literally (it is four lines
and fully typed with no cast), or derive it generically with a typed mapped-type helper that
does not need the manual literal annotation. Given there are only four types, the literal
object is the boring, correct choice.

### 7. `weekly_goal_draft_expiring` carries an `event: "draft_expiring"` that no reader uses

`convex/weeklyGoals.ts:315` writes `event: "draft_expiring"` into the draft-expiring
notification payload, the schema includes it in the union (`schema.ts:192`), and
`NotificationItem.tsx:35` lists it as a possible `event` — but the renderer's
`weekly_goal_draft_expiring` case (`NotificationItem.tsx:285`) ignores `event` entirely and
hardcodes the message, and no other code branches on `"draft_expiring"`. It is a written-but-
never-read field: dead surface that widens the payload union and the inline event type for
nothing.

**Remedy:** drop `event: "draft_expiring"` from the writer and from the schema event union
(the `type` already distinguishes this notification). One fewer event literal to thread through
schema, payload type, and renderer.

### 8. The weekly-goal `event` enum is duplicated three times by hand

The same event list (`"invite" | "declined" | "partner_locked" | "goal_unlocked" |
"goal_activated" | "goal_completed" | "goal_completed_solo"` [± `"draft_expiring"`]) is written
out independently in `schema.ts:185-192`, in `notificationHelpers.ts:251-257`
(`upsertWeeklyGoalNotificationForGoal`'s `event` param), and in `NotificationItem.tsx:27-35`.
Three sources of truth for one enum; adding an event means editing all three and they can
silently diverge (they already differ on `draft_expiring`, see #7).

**Remedy:** export a single `WeeklyGoalNotificationEvent` type derived from the schema payload
(`WeeklyGoalPayload["event"]`) and import it in the helper and the renderer. After #1 the
renderer gets it for free.

### 9. `NotificationItem` ad-hoc plurality copy duplicates the toast plurality in `NotificationsTab`

`NotificationItem.tsx:181-184` and `:210-213` compute an "Archive N theme(s)" button label with
an inline `themeCount === 1 ? "Archive 1 theme" : ...` (twice), and
`NotificationsTab.tsx:89-95` independently computes "Archived 1 theme" / "Archived N themes"
for the toast. Three near-identical pluralizers for the same count.

**Remedy:** one small helper (e.g. `themeCountLabel(n)` → `"1 theme"`/`"N themes"`) reused by
both files; the button/toast prepend their verb. Minor, but it removes the duplicated ternary
and the `|| 0` guards.

### 10. `ActionButton.getStyles()` is a non-exhaustive variant switch that should be a lookup

`NotificationItem.tsx:409-432` switches over the four button variants returning a style object;
the function has no `default` and relies on the union being exhaustive (TS allows the implicit
`undefined` return). This is the same shape as the documented theme-button-style duplication
flagged in Area 1.

**Remedy:** replace with a `Record<variant, (colors) => CSSProperties>` lookup, or — better —
check whether the app already has a canonical button-style helper (Area 1 noted
`getThemeActionButtonStyle`); a notification "accept/reject/dismiss/secondary" button is the
same concept as the theme action buttons and could share one styler instead of a third copy.

---

## 🟢 Minor / nit-level

- **`useCountdown` lives under `app/notifications/hooks/` but its only callers are
  `app/goals/`** (`useGoalsPageModel.ts:8,94,97`) — nothing in notifications uses it. It is a
  generic timer hook in the wrong feature folder. Move to a shared `hooks/` location (or
  `app/goals/hooks/`) so the ownership matches usage. Pure relocation.
- **Preferences trio is really Area 12.** `lib/notificationPreferences.ts`,
  `lib/notificationPreferencesDefaults.ts`, and `convex/notificationPreferences.ts` are
  entirely about *email* enable-flags and reminder offsets (`isNotificationEnabled` keys off
  the email trigger contract; every field is `…EmailEnabled`/`…OffsetMinutes`). They have no
  consumer in the in-app notification UI under review. Recommend moving them into the Area 12
  email review; flagging here only because they were listed in this scope.
- **`useNotificationPanel` sets `document.body.style.overflow` directly**
  (`useNotificationPanel.ts:42-51`). Several panels likely do this; if a canonical
  `useLockBodyScroll` exists elsewhere, reuse it. Low priority.
- **`NotificationPanel` className duplicates the responsive prefix**
  (`NotificationPanel.tsx:78`: `fixed top-14 left-2 right-2 sm:fixed sm:top-14 sm:left-2`) —
  the `sm:` repeats values already set at the base breakpoint. Cosmetic.
- **`getNotificationCount` reuses the `by_recipient` index and `.collect().length`**
  (`notifications.ts:80-88`) rather than a count; fine at current scale, noting only that it
  loads every pending row to count them.
- **`NotificationsTab.tsx:73` `handleViewWeeklyGoal(_goalId)` ignores its argument** and always
  routes to `/goals`. Either drop the unused param (and the `hasGoalId` extraction that feeds
  it — see #4) or use it to deep-link.

---

## Recommended ordering

1. **#1 type the notification at the boundary** (delete local `NotificationData`, use the
   schema union via the query type). Everything else keys off this.
2. **#2 + #3 decompose `NotificationItem` into a per-type dispatch table** with narrowed props.
3. **#4** delete `hasGoalId`; **#8/#7** collapse the event enum and drop dead `draft_expiring`.
4. **#5** route `removeFriend` through `loadFriendshipsBetweenUsers`.
5. **#6, #9, #10** lookup-table / helper cleanups.
6. Minor relocations (`useCountdown`, preferences trio) as housekeeping.

## Approval bar

Not approvable as-is. Blockers:

- a validated discriminated union (`notificationPayloadValidator`) and a clean
  `notificationPayloads.ts` type-guard layer already exist, but `NotificationItem.tsx`
  discards them for a re-declared all-optional payload and a 280-line stringly-typed switch
  (#1) — a boundary/type-contract regression and a missed dramatic simplification;
- `NotificationItem.tsx` (524 LOC, past the ~700 guideline only after counting, but
  structurally nine components fused into one switch) should be a dispatch table of small
  per-type cards (#2), which also dissolves the nine-callback prop bag (#3);
- a bespoke `unknown`-typed payload guard duplicates an existing canonical one (#4);
- `friends.removeFriend` re-implements the canonical friendship-pair lookup with two
  full-per-user table scans instead of the existing indexed helper (#5).

The friends/Convex backend (`friends.ts` aside from #5, `notificationHelpers.ts`,
`notifications.ts`) is otherwise in good shape: payload guards are reused, ownership checks are
centralized in `requireCallerOwnedNotificationPayload`, and there is no fallback/compat code.
The rot is concentrated in the UI render layer's refusal to consume the typed model the backend
already provides.
