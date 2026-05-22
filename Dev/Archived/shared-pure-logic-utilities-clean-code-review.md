# Shared Pure Logic / Utilities Clean Code Review

Scope: Shared pure helpers and utilities in `lib/`, focused on cross-feature utilities, validation, time/string formatting, retention, cleanup helpers, preferences, theme access/validation, and AI request validation.

Review principles:
- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

Overlap note: a few findings touch Weekly Goals, Themes, and AI generation because these shared utilities are called by those areas. I am not re-reviewing those areas here; this pass stays focused on the shared helper boundary.

## Must

1. **Stored theme TTS permission is not a complete edit/access policy**
   - Files: `lib/themeAccess.ts`, `convex/helpers/themeAccess.ts`, `convex/themes.ts`
   - Evidence: `hasThemeAccess` grants view access through challenges, duels, solo sessions, draft weekly goals, or friend sharing (`lib/themeAccess.ts:58-75`). `loadThemeWithViewerAccess` uses that broad view helper before returning a theme (`convex/helpers/themeAccess.ts:70-103`). `generateThemeTTS` then checks `canGenerateStoredThemeTts` (`convex/themes.ts:570-584`), but that helper only checks owner or `visibility === "shared" && friendsCanEdit === true` (`lib/themeAccess.ts:107-113`).
   - Problem: A non-owner who can view a shared editable theme through a challenge/duel/session/goal can pass the TTS edit check without the helper proving they are actually a friend/editor. This is a real boundary issue because TTS generation consumes credits and mutates stored theme words/storage.
   - Principles: Clear Boundaries, Right Logic In Right Layer, Avoid Hidden Side Effects.
   - Fix direction: replace `canGenerateStoredThemeTts` with a real backend edit policy that takes the viewer relationship context, or reuse `requireThemeEditor`/a shared `canEditTheme` policy instead of deriving edit permission from view access plus theme flags.

## Might

1. **Theme word-count validation has multiple sources**
   - Files: `convex/constants.ts`, `convex/themes.ts`, `lib/themes/constants.ts`, `lib/themes/serverValidation.ts`
   - Evidence: Convex defines `MIN_THEME_WORDS = 1` (`convex/constants.ts:130-134`) and `validateThemeHasWords` throws its own message (`convex/themes.ts:80-83`). Shared validation separately defines `THEME_MIN_WORD_COUNT = 1` and `THEME_MAX_WORD_COUNT = 200` (`lib/themes/constants.ts:14-15`) and `normalizeThemeWords` enforces both bounds with a different message (`lib/themes/serverValidation.ts:231-240`).
   - Problem: The rule is currently aligned, but it is split across backend constants, backend mutation helpers, and shared validation. This is exactly the kind of validation drift the shared utility layer is meant to prevent.
   - Fix direction: make `normalizeThemeWords` the single backend entry point for word-count validation, or export one shared rule/message that both paths call.

2. **Weekly-goal timing constants cross the `lib`/`convex` boundary in both directions**
   - Files: `lib/weeklyGoalTiming.ts`, `convex/constants.ts`, `lib/weeklyGoals.ts`
   - Evidence: Shared timing constants live in `lib/weeklyGoalTiming.ts:1-15` and are re-exported by `convex/constants.ts:136-144`. But `lib/weeklyGoals.ts` imports those values back from `../convex/constants` (`lib/weeklyGoals.ts:1`) before using them for `getGoalDeleteAt` and `getGoalDraftExpiresAt` (`lib/weeklyGoals.ts:43-60`).
   - Problem: Pure shared code should not depend on the Convex layer. The current import loop makes the source of truth harder to see and weakens the "lib holds pure logic, Convex calls it" boundary.
   - Fix direction: import weekly-goal timing directly from `lib/weeklyGoalTiming.ts` in shared helpers, and let Convex import/re-export only when Convex needs those values.

3. **Some shared constants are duplicated instead of truly shared**
   - Files: `lib/constants.ts`, `convex/constants.ts`, `app/goals/constants.ts`, `convex/weeklyGoals.ts`
   - Evidence: `TIMER_OPTIONS` exists in both `lib/constants.ts:1-5` and `convex/constants.ts:11-16`. `MAX_THEMES_PER_GOAL` is duplicated in `app/goals/constants.ts:7-10` and `convex/weeklyGoals.ts:51`.
   - Problem: This is low-risk today because the numbers match, but these are cross-layer product rules. If they drift, UI and backend will disagree.
   - Fix direction: keep shared product limits in one shared module and import them from both UI and backend.

4. **Notification preference normalization fills missing fields but does not validate stored numeric fields**
   - Files: `lib/notificationPreferencesDefaults.ts`, `convex/notificationPreferences.ts`, `convex/schema.ts`, `convex/emails/reminderPlanners.ts`
   - Evidence: Reminder offsets are plain numbers in schema (`convex/schema.ts:459-462`). Writes validate min/max (`convex/notificationPreferences.ts:82-93`), but reads call `normalizeNotificationPreferences`, which copies any existing offset number as-is (`lib/notificationPreferencesDefaults.ts:75-83`). Reminder planners then use those normalized offsets directly (`convex/emails/reminderPlanners.ts:46-75`). Existing tests even assert old partial records preserve stored offsets like `999` (`tests/convex/notificationPreferences.test.ts:74-97`).
   - Problem: Normalization sounds like it makes preferences safe, but it only fills missing fields. It does not guarantee valid integers/ranges for data already in storage.
   - Fix direction: either rename it to make the behavior clear, or add a strict normalization/validation helper for backend reads that clamps/rejects invalid reminder offsets.

5. **Time formatting helpers hide `Date.now()` inside otherwise pure-looking utilities**
   - File: `lib/timeUtils.ts`
   - Evidence: `generateTimeSlots`, `isTimeInFuture`, `formatScheduledTime`, `getRelativeTime`, `formatCountdown`, and `isWithinWindow` read current time internally (`lib/timeUtils.ts:15-17`, `59-60`, `66-70`, `102-104`, `130-132`, `165-167`). Tests need fake timers to cover normal behavior (`tests/lib/timeUtils.test.ts:12-20`).
   - Problem: These functions are still testable, but they are less clean than the timezone helpers that accept `nowTimestamp` explicitly (`lib/timeUtils.ts:244-253`). Hidden time reads are easy to misuse in UI hooks and scheduled logic.
   - Fix direction: add optional `now`/`nowTimestamp` parameters for the display helpers, keeping defaults for ergonomics.

6. **Spaced repetition stores a step number but shared logic mostly trusts array length**
   - Files: `lib/spacedRepetition.ts`, `convex/weeklyGoalRepetitions.ts`
   - Evidence: `getSpacedRepetitionCurrentStep` returns `completedSteps.length + 1` (`lib/spacedRepetition.ts:23-31`), `isSpacedRepetitionDone` checks only length (`lib/spacedRepetition.ts:37-41`), and `getSpacedRepetitionDueAt` uses the last array entry as the previous completion (`lib/spacedRepetition.ts:55-59`). Backend writes also append `{ step, intervalDays }` to the array (`convex/weeklyGoalRepetitions.ts:453-465`).
   - Problem: The stored `step` field and `intervalDays` field are not really authoritative. If the array ever gets out of order or duplicated, the utility layer will still calculate readiness from length/last item.
   - Fix direction: either make `step` derived-only and remove the duplicate stored rule, or add a shared invariant check that validates the completed-step sequence before calculating readiness.

7. **Theme validation logic is split between two shared validators**
   - Files: `lib/themes/serverValidation.ts`, `lib/themes/validators.ts`
   - Evidence: `collectThemeIssues` finds duplicate words, duplicate wrong answers, and wrong answers matching correct answers (`lib/themes/serverValidation.ts:99-189`). `lib/themes/validators.ts` repeats similar checks for UI repair issues (`lib/themes/validators.ts:46-189`).
   - Problem: The split is understandable because one helper returns detailed server issues and one returns UI repair state, but the core duplicate/match rules are duplicated.
   - Fix direction: have UI repair helpers consume `collectThemeIssues` or share smaller duplicate/match primitives underneath both modules.

8. **Error helpers are split between structured API errors and generic UI messages**
   - Files: `lib/api/serverErrors.ts`, `lib/backendErrorCodes.ts`, `lib/errors.ts`
   - Evidence: API routes use `resolveApiError` plus `readBackendErrorCode` for structured codes/status (`lib/api/serverErrors.ts:41-75`, `lib/backendErrorCodes.ts:50-63`). UI hooks use `getErrorMessage`, which only reads `data.message` or `Error.message` (`lib/errors.ts:1-10`).
   - Problem: This is not a bug by itself, but shared error handling has two different concepts of "backend error": one code-aware and one message-only. That makes future behavior like friendly messages for `NOT_AUTHORIZED`/`LIMIT_REACHED` easy to implement inconsistently.
   - Fix direction: expose one shared `readBackendError` shape with `{ code, message }`, then let API routes and UI toasts format it differently.

## Ignore

1. **`stripIrr` is narrow but acceptable**
   - File: `lib/stringUtils.ts`
   - Evidence: It intentionally strips a trailing `(irr)` marker before comparison (`lib/stringUtils.ts:8-12`, `18-30`).
   - Reason to ignore: This is a real product rule for verb answers, and the helper is small and explicit.

2. **`sanitizeSoloReturnTo` is intentionally conservative**
   - File: `lib/soloNavigation.ts`
   - Evidence: It only accepts single-slash app-local paths and falls back to `/` (`lib/soloNavigation.ts:15-20`), with tests for external and protocol-relative URLs (`tests/lib/soloNavigation.test.ts:48-50`).
   - Reason to ignore: The fallback is a legitimate safe navigation default, not legacy compatibility code.

3. **`cleanupRetention.ts` helpers are small and appropriately pure**
   - File: `lib/cleanupRetention.ts`
   - Evidence: The helpers take `now` and `ttlMs` explicitly and only return booleans (`lib/cleanupRetention.ts:5-43`).
   - Reason to ignore: This is the right shape for cleanup policy helpers.

4. **`bossLives.ts` is appropriately small**
   - File: `lib/bossLives.ts`
   - Evidence: It owns starting lives and trophy label formatting only (`lib/bossLives.ts:1-35`).
   - Reason to ignore: Broader boss lifecycle problems belong to the weekly-goals review, not this utility file.

5. **`lib/preferences/backgrounds.ts` is fine as a tiny allowlist**
   - File: `lib/preferences/backgrounds.ts`
   - Evidence: It defines valid background filenames, a default, and a type guard (`lib/preferences/backgrounds.ts:1-9`).
   - Reason to ignore: This is a clear boundary and low-maintenance.

## Validation

No code changed. No validators, tests, typecheck, or lint were run because this was a documentation-only review.
