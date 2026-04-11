# Avatar Color Inconsistency

**Date identified:** 2026-02-02

**Context:** Noticed the partner selector, for example in Weekly Goals, shows avatars with blue circles, but the logged-in user's avatar in the header shows green.

## The Problem

Two different systems render avatars with different colors:
- **Partner selector** (`PartnerSelector.tsx`): Uses `colors.primary.DEFAULT` from the app theme palette
- **Header avatar**: Rendered by Clerk's `<UserButton />` with Clerk's default styling, which appears green

This creates visual inconsistency because the same user can appear in different colors depending on where they are displayed.

## Future Consideration

Need a consistent avatar color strategy:
1. How should a player's avatar appear to themselves?
2. How should a player's avatar appear to opponents or partners?
3. Should Clerk's `UserButton` be themed to match the app palette, or should app components match Clerk?

## Status

Parked for later. This needs a design decision about avatar identity and color consistency across the app.
