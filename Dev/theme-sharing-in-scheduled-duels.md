# Theme Sharing in Scheduled Duels

**Date identified:** 2026-02-02

**Context:** Arose during email notifications setup discussion. We discovered a gap in theme access for scheduled duels.

## The Problem

When User A schedules a duel with User B using a private theme:
- User B accepts the duel
- User B wants to study the theme before the duel starts
- But User B has no access because the theme is private and no `challenge` record exists yet. That record is only created when both click Ready.

## Affected Scenarios

1. **Scheduled duels**: Gap between accept and start because no `challenges` row exists yet
2. **Weekly goals**: Permanent gap because no access pathway exists at all
3. **Immediate duels**: No gap because the challenge row is created immediately

## Chosen Approach (For Now)

**Temporary access via `getTheme` checks** instead of hard sharing.

Add access checks in `themes.getTheme`:
1. Is the user a participant in an active `scheduledDuel` with this theme? If yes, grant access.
2. Is the user a participant in an active `weeklyGoal` that includes this theme? If yes, grant access.

## Benefits

- Access is scoped to the participant instead of all friends
- Access auto-expires when the duel or goal completes or expires
- No permanent sharing side effects
- Single place to implement

## Tradeoffs

- Extra database queries in `getTheme` because it needs two lookups
- Proper indexes are needed for performance

## Status

Not fully convinced this is the permanent solution. This may be revisited later with:
- Per-friend sharing
- More granular visibility controls
- A different sharing model entirely

For now, this approach is cleaner than hard-sharing and avoids the "shares with everyone forever" problem.
