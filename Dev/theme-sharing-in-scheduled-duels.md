# Theme Sharing in Scheduled Duels

**Date identified:** 2026-02-02

**Context:** Arose during email notifications setup discussion. We discovered a gap in theme access for scheduled duels.

## The Problem (Original)

When User A schedules a duel with User B using a private theme:
- User B accepts the duel
- User B wants to study the theme before the duel starts
- But User B has no access because the theme is private and no `challenge` record exists yet. That record is only created when both click Ready.

## Current State — Two-Player Case Is Solved

`lib/themeAccess.ts` already handles this. The `hasThemeAccess` function checks five access paths in order:

1. Is the user the theme owner?
2. Is the user in an active challenge using this theme?
3. Is the user in an active scheduled duel (pending/accepted/counter-proposed) using this theme?
4. Is the user in an active weekly goal (editing/active/expired) using this theme?
5. Is the theme shared and the user is friends with the owner?

Check #3 covers the scheduled duel gap — access appears the moment the scheduled duel exists and disappears when it ends. Check #4 covers the weekly goal gap the same way.

No code changes needed for the two-player case.

## Open Question: Multi-Player Theme Sharing

**Date:** 2026-04-15

What happens when themes cross player boundaries in unexpected ways? Example: I created themes on P1, but P3 invited me to a duel with P2. Now P2 needs access to themes that originated from P1 via P3's invite — the current model doesn't account for this kind of transitive access. None of the five access checks connect P2 to P1's theme.

This is a design question, not a bug. Parked for later.

## Status

Two-player case: **resolved** (already implemented in `lib/themeAccess.ts`).
Multi-player transitive access: **parked** — needs a design decision about how far access should travel.
