# Friends / Challenges / User Relationships Review

Review scope: **Friends / Challenges / User Relationships**

Primary areas reviewed:

- Friend requests and friendships
- Challenge invite / accept flow that creates duels
- User search and identity display
- Related relationship hooks and notification-panel UI

Principles reviewed:

- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

This was a read-only review. The only file created was this review document.

## Must

| Issue | Evidence |
|---|---|
| Normal challenges are not bounded to friends, even though the relationship model says users connect through friends before collaborating. `createChallenge` only blocks self-targeting, verifies the opponent exists, and checks theme access for the challenger; it never verifies an accepted friendship. The UI also feeds the challenge modal with `getUsers`, which returns all users except the current user, not just friends. This makes friend relationships optional for duels and weakens the boundary between "user search" and "challenge someone". | `convex/challenges.ts:151-172`, `convex/users.ts:48-65`, `hooks/useChallengeLobby.ts:21-31`, `app/components/modals/ChallengeModal.tsx:327-387` |
| Expired challenge cleanup is driven by notification records instead of the challenge record itself. `cleanupExpiredChallengeInvites` queries old pending/read `challenge_invite` notifications, reads `payload.challengeId`, then cancels the challenge. If the notification is missing, dismissed early, or otherwise not in those two statuses, the pending challenge can survive past TTL. The schema already has challenge `status`, `createdAt`, and a `by_status` index, but the cleanup does not use them as the source of truth. | `convex/challenges.ts:362-402`, `convex/schema.ts:253-272`, `convex/notificationHelpers.ts:192-213` |
| User discovery exposes too much of the identity graph in one broad query. `searchUsers` scans up to `MAX_USERS_QUERY`, supports two-character frontend searches, and matches partial email strings. That means a signed-in user can discover accounts by broad fragments like `@example.com`, then use the returned user IDs for friend requests or challenges. If exact handle search is the intended identity model, this is a real boundary problem; if broad discovery is intended, it should be explicit product behavior and tested as such. | `convex/users.ts:185-230`, `app/notifications/components/AddFriendSection.tsx:24-27`, `app/notifications/components/AddFriendSection.tsx:52` |

## Might

| Issue | Evidence |
|---|---|
| Relationship rules are split across several places instead of one small relationship-policy layer. Friend existence is checked in `sendFriendRequest`, accepted friend rows are created in `acceptFriendRequestCore`, remove-friend closes weekly goals, theme access separately checks both friendship directions, and weekly goals have their own friend check. The behavior is currently understandable, but the rule "what relationship is required for this action?" is not easy to audit in one place. | `convex/friends.ts:112-135`, `convex/friends.ts:225-279`, `convex/friends.ts:336-371`, `convex/helpers/themeAccess.ts:54-67`, `convex/weeklyGoals.ts:797-804` |
| User summary shaping is duplicated. `friends.ts`, `challenges.ts`, `users.ts`, `duels.ts`, and `lib/userDisplay.ts` each define or build slightly different public user shapes. This is not currently breaking padded-handle display, but it makes identity changes easy to miss in one surface. | `convex/friends.ts:20-45`, `convex/challenges.ts:34-46`, `convex/users.ts:22-46`, `convex/duels.ts:45-69`, `lib/userDisplay.ts:1-58` |
| `acceptChallenge` and `acceptChallengeFromNotification` repeat participant/status checks instead of sharing one boundary function. The shared core only creates the duel and resolves the challenge, while the public entry points each re-check pending/opponent authorization separately. The duplication is small, but this is the exact boundary where stale invites, notification actions, and duel creation meet. | `convex/challenges.ts:91-105`, `convex/challenges.ts:243-257`, `convex/challenges.ts:294-323` |
| Challenge creation mixes validation, persistence, theme summarization, notification creation, and email scheduling in one mutation. It is not huge, but the business rule is less testable than the lower-level `buildChallengeInvite` / `buildDuelSession` helpers. | `convex/challenges.ts:139-199`, `convex/helpers/sessionCreation.ts:71-154`, `convex/notificationHelpers.ts:108-137` |
| `useChallengeLobby` still owns modal state, Convex calls, routing, toasts, waiting-state polling, and solo-practice launch wiring. This overlaps with the reusable UI/shared hooks review; for Area C, the relationship-specific concern is that challenge lifecycle behavior is hard to test outside React. | `hooks/useChallengeLobby.ts:21-31`, `hooks/useChallengeLobby.ts:67-149`, `hooks/useChallengeLobby.ts:157-181`, `hooks/useChallengeLobby.ts:184-269` |
| `FriendsTab` couples friend rendering with weekly-goal relationship checks and remove-friend mutation side effects. The server correctly performs the real close-goal behavior, but the UI also derives warning copy by scanning visible goals locally. | `app/notifications/components/FriendsTab.tsx:27-52`, `app/notifications/components/FriendListItem.tsx:171-185`, `convex/friends.ts:362-371` |
| Nickname validation is duplicated between the frontend hook and backend mutation. They share constants, so this is not a bug today, but it is still two implementations of the same identity rule. | `app/settings/hooks/useNicknameUpdate.ts:21-32`, `convex/users.ts:146-178` |
| Friend rows are modeled as two separate directional documents, but there is no unique pair helper or pair-level invariant. Most code compensates by reading both directions where needed. This is acceptable at small scale, but it makes cleanup/repair logic more fragile if one direction is missing or duplicated. | `convex/schema.ts:240-248`, `convex/friends.ts:124-134`, `convex/friends.ts:343-369`, `convex/helpers/themeAccess.ts:54-67` |

## Ignore / Low Priority

| Issue | Reason |
|---|---|
| `FriendListItem` mixes row display, context menu, portal, long-press, and confirmation dialog. | Already covered by the reusable UI/shared hooks review. It is cleanup-worthy, but not a relationship correctness issue. |
| `usePresence` uses module-level singleton state and silently updates the backend. | Already covered by the reusable UI/shared hooks review. For this area, it only supports online/offline friend display and is not a friend/challenge rule. |
| `userPreferences.ts` and `credits.ts` are in the area file list but do not contain relationship or challenge business rules. | They are mostly separate user settings/credit boundaries and did not show Area C-specific clean-code problems in this pass. |
| Completed weekly goals remain after removing a friend. | This matches the product documentation that completed goals are retained and is covered by an existing remove-friend test. |
| Frontend and backend nickname checks both use shared constants. | The duplication is noted under Might, but the current shared constants reduce drift risk enough that this is not a Must. |

## Validation

No app code was changed. No validators were run because this was a read-only code review and only this review document was created.
