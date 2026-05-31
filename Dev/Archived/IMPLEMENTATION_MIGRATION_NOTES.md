# Implementation — running migration / deletion notes

Working notes accumulated while implementing the code-review feedback. These are the
items the user must handle manually (data migrations, deploy-time checks). Code changes
themselves are done; nothing here runs until a Convex deploy.

## Deferred — needs a data backfill (NOT implemented)

- **Area 6 (duels.ts:62) — make `duels.wordOrder` required.** Kept `wordOrder` optional in the
  schema and kept the identity fallback in `buildViewerSafeDuel`
  (`wordIndexBySessionIndex.get(sessionWordIndex) ?? sessionWordIndex`), because old duels
  created before `wordOrder` existed have no array. The fallback is now documented with a
  comment; it is correct, not dead code. To tighten: backfill `wordOrder` on legacy `duels`
  rows (identity order `[0,1,2,…]` is fine for completed/old duels), then make `wordOrder`
  required in `convex/schema.ts` and drop the `?? sessionWordIndex` fallback. Low priority —
  only affects duels predating the shuffle feature.

## Deploy-time data checks (schema narrowed — verify before deploying)

- **Area 9 #3 — `weeklyGoals.mode` is now REQUIRED in the schema.** The code is done: `mode`
  is required in `convex/schema.ts`, and the `?? "shared"` fallback + unreachable branch in
  `lib/weeklyGoals.ts` (`normalizeWeeklyGoal`) are gone; `countCompletedThemes` /
  `areAllThemesCompleted` now take a required `mode`. **Before deploy**, every existing
  `weeklyGoals` row must already have a `mode` ("solo" or "shared") — Convex schema
  validation will reject any row missing it on deploy. Backfill first: set `mode` on every
  legacy `weeklyGoals` row (rows with a `partnerId` are "shared", rows without are "solo").
  If all existing rows already carry `mode`, nothing to do.

- **Area 11 #7 — removed `draft_expiring` from the notification payload `event` union**
  (`convex/schema.ts`) and stopped writing it (`convex/weeklyGoals.ts`). The
  `weekly_goal_draft_expiring` notification *type* still exists; only the redundant
  `payload.event` value was dropped. Before deploy, verify no `notifications` rows have
  `payload.event === "draft_expiring"` (delete/clear that field if any exist).

- **Area 12 #8 — deleted the unused `by_status` index on `emailNotificationLog`**
  (`convex/schema.ts`). Convex drops the index on deploy; no data migration, no row changes.

## Dependency cleanup (optional — no deploy impact)

- **Area 12 #5 — `emailNotificationLog.reminderOffsetMinutes` is now write-dead.** Per the review,
  this field was an idempotency arg that no index or lookup ever consulted. It was dropped from the
  `checkNotificationSent` / `claimNotificationSend` args and is no longer written on new rows. The
  schema column was kept (`convex/schema.ts`, `v.optional`) so existing rows stay valid — **no
  migration, no deploy impact**. If you ever want the column gone, clear it from old rows first, then
  remove it from the schema. Reminder-1/Reminder-2 emails dedupe on `(toUser, trigger, weeklyGoalId)`
  alone, which is the intended behavior.

- **Area 1 #4 — `react-window` is now unused.** The theme list used a `VariableSizeList`
  with manual size-measuring (two `ResizeObserver`s, a size map, per-row `useLayoutEffect`).
  The review's remedy offered two options: `FixedSizeList` *or* drop virtualization entirely
  "given typical user theme counts". `FixedSizeList` still needs an explicit pixel height/width,
  which without the ResizeObservers means adding `react-virtualized-auto-sizer` — installing
  that new package was blocked in this environment. So I took the review's second, co-equal
  option and **dropped virtualization**: `ThemeList` now renders a plain scrollable flex
  column (hugs content when few themes, scrolls when many — same behavior, pure CSS). All
  theme-list tests pass. `react-window` and `@types/react-window` are no longer imported
  anywhere; you can remove them with `npm uninstall react-window @types/react-window`. Pure
  code/dependency change — no data migration, nothing to deploy.

## Areas with NO migration / deploy actions (on record)

These areas were implemented in full and produced **nothing for you to do at deploy time** —
no schema field added/removed/retyped, no data backfill, no index dropped. Listed so the record
is complete:

- **Area 13 (TTS pipeline)** — pure code refactor (timeout ownership moved into
  `generateTtsAudioWithFallback`, shared Resemble response extractors, `useTTS` relocated, dead
  `useDuelAudio` deleted). No schema/data impact.
- **Area 14 (Settings, preferences & appearance)** — the `selectedColorSet` / `selectedBackground`
  schema fields were intentionally **left as `v.optional(v.string())`**; the new color-set/background
  validators only gate *new* writes (existing rows untouched), and the 4 added theme CSS variables
  are runtime-only. No backfill, no narrowing.
- **Area 15 (App shell, auth, user sync & schema)** — UI/hook refactors only (Avatar border,
  MenuButton/BackButton via `getButtonStyles`, HomeChrome/`useSoloDeepLink`/`NavIconButton`
  extractions, `ModalTheme.wordCount`, `MAX_USER_SEARCH_RESULTS`, `normalizeAccents` removal).
  The schema dedup (shared `sessionSourceFields` spread + `duelDifficultyPresetValidator` alias)
  produces **byte-identical** table definitions — same fields, same validators, no migration. The
  five `notifications` indexes were each confirmed to have a live query, so none were dropped.
