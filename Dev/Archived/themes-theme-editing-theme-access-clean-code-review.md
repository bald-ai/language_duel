# Themes / Theme Editing / Theme Access Clean Code Review

Review scope: Themes, theme editing, and theme access.

Review principles:
- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

This review was produced from 7 parallel subagent reviews, one per principle, then filtered into Must / Might / Ignore.

## Must

1. **Theme edit permission is too broad**
   - Files: `convex/helpers/permissions.ts`, `convex/themes.ts`
   - Principles: Clear Boundaries, No Duplication Of Rules, Right Logic In Right Layer
   - Problem: `friendsCanEdit` allows non-owner editing without verifying the user is actually a friend.
   - Fix direction: centralize backend `canEditTheme` / `requireThemeEditor` with owner + friendship checks.

2. **TTS generation repeats the same weak edit permission**
   - File: `convex/themes.ts`
   - Principles: Avoid Hidden Side Effects, Clear Boundaries
   - Problem: `generateThemeTTS` can trigger credits, storage writes, and theme mutation using the same broad `shared && friendsCanEdit` rule.
   - Fix direction: reuse the same strict backend edit policy as normal theme edits.

3. **Theme duplication bypasses access checks**
   - File: `convex/themes.ts`
   - Principles: Clear Boundaries, Right Logic In Right Layer
   - Problem: `duplicateTheme` fetches any theme by ID and copies it after auth only.
   - Fix direction: require view access before duplication.

4. **TTS storage URL has no theme access boundary**
   - File: `convex/themes.ts`
   - Principle: Clear Boundaries
   - Problem: `getTtsStorageUrl` returns a URL for any storage ID to any authenticated user.
   - Fix direction: accept theme/snapshot context and verify the storage ID belongs to an accessible theme.

5. **`useThemesController` has too many responsibilities**
   - File: `app/themes/hooks/useThemesController.ts`
   - Principles: Single Responsibility, Testable Business Logic
   - Problem: list state, edit state, routing, modals, generation, pick/prune, TTS, archive/delete/save all live in one hook.
   - Fix direction: split into focused list, detail edit, generation, TTS, and modal/navigation controllers.

6. **`convex/themes.ts` is a backend god module**
   - File: `convex/themes.ts`
   - Principles: Single Responsibility, Clear Boundaries
   - Problem: queries, mutations, permissions, duplication, archive, TTS, cleanup, and access enrichment are all in one file.
   - Fix direction: split by backend domain: queries, mutations, access, TTS, archive/duplicate helpers.

7. **Theme list access and theme detail access can drift**
   - Files: `convex/themes.ts`, `lib/themeAccess.ts`
   - Principles: No Duplication Of Rules, Right Logic In Right Layer
   - Problem: `getTheme` uses `hasThemeAccess`; `getThemes` manually builds a different visible-theme list.
   - Fix direction: centralize `canViewTheme` and `shouldListTheme`.

8. **Theme word count validation is duplicated**
   - Files: `convex/constants.ts`, `lib/themes/constants.ts`, `convex/themes.ts`, `lib/themes/serverValidation.ts`
   - Principle: No Duplication Of Rules
   - Problem: minimum word rules/messages exist in multiple places.
   - Fix direction: keep one shared theme word-count validation source.

## Might

1. **`ThemeDetail.tsx` is doing too much**
   - Rendering, name editing, access controls, TTS controls, validation display, modals, and save/cancel logic are mixed.

2. **Visibility/friend-edit changes save immediately**
   - File: `app/themes/hooks/useThemesController.ts`
   - Might surprise users because normal edits wait for `Save`, but access changes do not.

3. **`updateTheme` has hidden TTS cleanup side effects**
   - File: `convex/themes.ts`
   - A normal theme update can delete storage files.

4. **Deleting a theme does best-effort TTS cleanup after DB delete**
   - File: `convex/themes.ts`
   - Cleanup failure can leave orphaned storage while caller sees success.

5. **`createTheme` idempotency ignores changed payloads**
   - File: `convex/themes.ts`
   - Same `saveRequestId` returns existing theme even if later request differs.

6. **Weekly-goal max theme count is duplicated**
   - Files: `convex/weeklyGoals.ts`, `app/goals/constants.ts`
   - `MAX_THEMES_PER_GOAL` exists in separate frontend/backend places.

7. **Weekly-goal theme eligibility is split**
   - Files: `convex/weeklyGoals.ts`, `app/goals/components/GoalThemeSelector.tsx`
   - Backend owns real rules; frontend owns partial count logic.

8. **`hasThemeAccess` name is too broad**
   - File: `lib/themeAccess.ts`
   - It means view access, not edit/manage access. Better: `hasThemeViewAccess`.

9. **`visibility` and `friendsCanEdit` naming is vague**
   - Files: schema/theme UI/backend
   - Better names: `sharingMode`, `sharedWithFriends`, `friendEditingEnabled`.

10. **Generic theme selector knows about weekly goals**
    - File: `app/components/modals/ThemeSelector.tsx`
    - Weekly-goal marker logic leaks into generic selection UI.

11. **Draft weekly goal themes appear in theme list**
    - File: `convex/themes.ts`
    - Might be correct, but should expose an `accessReason` like `owned`, `friendShared`, `draftGoal`.

12. **`lib/themeAccess.ts` lives in neutral `lib` but owns backend domain access**
    - Might be better as backend access policy with data-loading helpers.

13. **TTS invalidation rules are private inside controller**
    - File: `app/themes/hooks/useThemesController.ts`
    - Extract to pure helper for easier tests.

14. **`ThemeWithOwner` name understates what it contains**
    - File: `convex/themes.ts`
    - It also carries viewer permission metadata.

15. **`duplicateTheme` behavior is not obvious**
    - File: `convex/themes.ts`
    - It strips TTS and resets sharing to private; this may need clearer naming/copy.

## Ignore

1. **Repeated word-count display in cards/selectors**
   - Presentation duplication, not a real clean-code issue.

2. **`ThemeCardMenu` owner-only UI checks**
   - Backend also enforces ownership; acceptable duplication for UX.

3. **`lib/theme.ts` visual-theme naming collision**
   - Slightly confusing because product themes also exist, but not worth prioritizing unless touched later.

4. **`WeeklyGoalThemeMarker` name precision**
   - Could become `ActiveWeeklyGoalThemeMarker`, but current risk is low.

5. **Some frontend/backend validation duplication**
   - Keep backend authoritative; frontend duplication is acceptable when only used for friendly UX, as long as backend remains strict.

## Validation

Not run. This is a documentation-only review note; no code changed.
