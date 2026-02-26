# Known Issues - Delegated for Later

## Theme Sharing in Scheduled Duels

**Date identified:** 2026-02-02

**Context:** Arose during email notifications setup discussion. We discovered a gap in theme access for scheduled duels.

### The Problem

When User A schedules a duel with User B using a private theme:
- User B accepts the duel
- User B wants to study the theme before the duel starts
- But User B has no access — the theme is private and no `challenge` record exists yet (only created when both click Ready)

### Affected Scenarios

1. **Scheduled duels** — gap between accept and start (no `challenges` row yet)
2. **Weekly goals** — permanent gap (no access pathway exists at all)
3. **Immediate duels** — ✅ No gap (challenge row created immediately)

### Chosen Approach (For Now)

**Temporary access via `getTheme` checks** — not hard sharing.

Add access checks in `themes.getTheme`:
1. Is user a participant in an active `scheduledDuel` with this theme? → grant access
2. Is user a participant in an active `weeklyGoal` that includes this theme? → grant access

**Benefits:**
- Access scoped to just the participant, not all friends
- Auto-expires when duel/goal completes or expires
- No permanent sharing side effects
- Single place to implement

**Tradeoffs:**
- Extra DB queries in `getTheme` (2 lookups)
- Need proper indexes for performance

### Status

Not fully convinced this is the permanent solution. May revisit with:
- Per-friend sharing
- More granular visibility controls
- Different sharing model entirely

But this approach is cleaner than hard-sharing and avoids the "shares with everyone forever" problem.

---

## Avatar Color Inconsistency

**Date identified:** 2026-02-02

**Context:** Noticed the partner selector (e.g., in Weekly Goals) shows avatars with blue circles, but the logged-in user's avatar in the header shows green.

### The Problem

Two different systems render avatars with different colors:
- **Partner selector** (`PartnerSelector.tsx`): Uses `colors.primary.DEFAULT` from the app's theme palette
- **Header avatar**: Rendered by Clerk's `<UserButton />` with Clerk's own default styling (green)

This creates visual inconsistency — the same user might appear in different colors depending on where they're displayed.

### Future Consideration

Need to define a consistent avatar color strategy:
1. How should a player's avatar appear to themselves?
2. How should a player's avatar appear to opponents/partners?
3. Should Clerk's UserButton be themed to match the app palette, or should the app components match Clerk?

### Status

Parked for later. Requires design decision on avatar identity and color consistency across the app.

---

## Weekly Goal Decline Action Missing

**Date identified:** 2026-02-03

**Context:** Discovered during email notifications implementation prep. The plan includes a "weekly goal declined" email trigger, but no explicit decline mutation exists.

### The Problem

Weekly goals have no explicit "decline" action. When User A invites User B to a weekly goal:
- User B can open the goal and add/remove themes (editing phase)
- User B can lock the goal (accept)
- User B can delete the goal (while unlocked)
- But there's no "decline" button that notifies User A

Currently, if User B doesn't want to participate, they just ignore or delete — User A gets no notification.

### Impact on Email Notifications

Email trigger #10 ("weekly goal invite declined") cannot be implemented without this mutation.

### Options

1. **Add explicit decline mutation** — creates notification for User A, deletes the goal
2. **Skip this email trigger** — document that decline = silent ignore/delete
3. **Repurpose delete as decline** — treat `deleteGoal` as implicit decline, send email to partner

### Status

Parked. Will proceed with email notifications without this trigger for now.
