# Code Review — Area 2: Theme data & access layer

**Date:** 2026-05-22
**Scope:** `lib/theme*` + `lib/themes/*` (non-TTS, non-generation) + `convex/themes*` + the two theme access helpers. ~2.6k LOC.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

- **lib (pure logic):**
  - `lib/theme.ts` — 360 LOC *(see Blocker #0: this is the appearance/color-palette system, not the language-theme data layer — wrong area)*
  - `lib/themeAccess.ts` — 195 LOC
  - `lib/themes/api.ts` — 292 LOC
  - `lib/themes/serverValidation.ts` — 264 LOC
  - `lib/themes/wordTypes.ts` — 196 LOC
  - `lib/themes/themeUiValidation.ts` — 179 LOC
  - `lib/themes/wordEditing.ts` — 108 LOC
  - `lib/themes/constants.ts` — 20 LOC
- **convex (server):**
  - `convex/themes.ts` — 197 LOC (public wiring)
  - `convex/themes/accessPolicy.ts` — 6 LOC (pure re-export)
  - `convex/themes/archiveDuplicate.ts` — 44 LOC
  - `convex/themes/cleanupHelpers.ts` — 38 LOC
  - `convex/themes/listQueries.ts` — 192 LOC
  - `convex/themes/mutations.ts` — 293 LOC
  - `convex/themes/queries.ts` — 60 LOC
  - `convex/themes/readModels.ts` — 36 LOC
- **convex helpers:**
  - `convex/helpers/themeAccess.ts` — 125 LOC
  - `convex/helpers/resolveAccessibleThemes.ts` — 31 LOC

Excluded by instruction (other areas own them): `lib/themes/tts.ts`, `convex/themes/generateThemeTtsAction.ts`, `convex/themes/ttsPipeline.ts` (Area 13 TTS); generation flow (Area 3); `app/themes/` UI (Areas 1/3).
Read for boundary tracing but **not** in scope: `convex/helpers/permissions.ts`, `convex/helpers/relationshipPolicy.ts`, `lib/relationshipPolicy.ts`, `convex/themes/ttsPipeline.ts` (types), `lib/themes/wordTypes.ts` consumers. These are referenced because the access model leaks across that boundary (Blockers #1–#2).

No file is over the 700 LOC guideline; the biggest in-scope files are `lib/theme.ts` (360) and `lib/themes/api.ts` / `convex/themes/mutations.ts` (292/293). Size is **not** the problem in this area — **a fractured access model is.**

---

## 🔴 Blockers

### 0. `lib/theme.ts` (360 LOC) is the *appearance* theme system and does not belong in this area at all

`lib/theme.ts` is entirely about visual design tokens: `colorPalettes`, `deriveThemeColors`, `getButtonStyles`, `applyThemeCssVariables`, `ThemeName = "playful-duo" | …`. Its only consumers are `app/components/AppearanceProvider.tsx`, `app/components/themeCssVars.ts`, `app/themes/components/themeStyles.ts`, and `convex/userPreferences.ts` (the `colorSet` preference). It has **zero** relationship to the language-learning theme (vocabulary set) that every other file in this scope manipulates.

This is a genuine cross-stack naming collision of exactly the kind AGENTS.md forbids: two unrelated product concepts both called "theme". A reader landing in this area sees `lib/theme.ts` next to `lib/themeAccess.ts` and reasonably assumes they're related — they are not. `theme.ts` exposes `ThemeName`/`ThemeColors`; `themeAccess.ts` exposes `ThemeAccessData` keyed on `Id<"themes">`. Same word, two universes.

**Remedy:** This file belongs to the appearance/styling area (Area 1's `themeStyles`/`AppearanceProvider` cluster), not the theme-data area. Rename to surface the real concept — `lib/appearance/palettes.ts` (or `lib/colorSets.ts`, matching the `colorSet` preference name already used in `convex/userPreferences.ts:39`) — and move it out of this review's scope. I am **not** reviewing it for internal quality here because it is mis-filed; flagging the misclassification is the higher-value action. (For the record it is clean and self-consistent — `cloneThemeColors` at line 211 defends against mutation of shared token objects, which is fine.)

### 1. The "can this user edit this theme" predicate is implemented THREE times, in three layers, with three shapes

This is the central rot of the area. The rule "owner, OR (visibility=shared AND friendsCanEdit AND viewer is a friend of owner)" exists in three places:

1. `lib/themeAccess.ts:130` `canGenerateStoredThemeTts(userId, theme, friendships)` — pure, returns `boolean`.
2. `convex/helpers/permissions.ts:18` `requireThemeEditor(db, themeId, userId)` — does its own `ctx.db.get`, recomputes the same predicate inline (lines 28–40), throws `NOT_AUTHORIZED`.
3. The `canEdit` field in `convex/themes/readModels.ts:24` and the gate in `convex/themes/queries.ts:24` — both call `canGenerateStoredThemeTts` to mean "can edit".

`requireThemeEditor`'s body (`isOwner || (visibility==="shared" && friendsCanEdit===true && isFriendOfOwner)`) is a verbatim re-derivation of `canGenerateStoredThemeTts`'s body (`isOwner(...) || (theme.visibility==="shared" && theme.friendsCanEdit===true && hasFriendshipWithOwner(...))`). One throws, one returns a bool, but they are the *same policy*. If the friend-edit rule ever changes (e.g. add a block-list, or allow read-only shares to TTS but not edit), it must be changed in two unrelated files that don't reference each other, with a near-certainty of drift.

**Remedy:** Make the pure predicate in `lib/themeAccess.ts` the single source of truth and give it an honest name (see #2). `requireThemeEditor` should become: load theme, load friendships via `loadFriendshipsBetweenUsers`, call the pure `canEditTheme(...)`, throw if false — i.e. the same load-then-delegate shape `loadThemeForStoredTtsEditor` (`queries.ts:12`) already uses. That deletes the duplicated inline predicate at `permissions.ts:28–40` and the bespoke `isFriendOfOwner` (next blocker).

### 2. `canGenerateStoredThemeTts` is misnamed: it is the generic edit-permission check, mapped to a field literally called `canEdit`

`readModels.ts:24` assigns `canEdit: canGenerateStoredThemeTts(...)`. `queries.ts:24` calls it to gate the *stored-TTS editor*. The UI then reads `theme.canEdit` everywhere to gate **all** editing (`useThemeWordEditController.ts:29`, `useThemeDetailController.ts:147/163`, `useThemeTtsController.ts:26`). So a function named "can generate stored theme TTS" is the de-facto answer to "can the viewer edit this theme at all". The name describes one caller (TTS) while the function expresses the general edit policy — a name that lies about its contract.

**Remedy:** Rename `canGenerateStoredThemeTts` → `canEditTheme` in `lib/themeAccess.ts:130` and update the three call sites (`readModels.ts:24`, `queries.ts:24`, plus the test at `tests/lib/themeAccess.test.ts:282`). The `canEdit` field then trivially `= canEditTheme(...)`, and the TTS gate reads as "you may regenerate TTS because you may edit", which is the actual intent. This is the linchpin that lets #1 collapse to one predicate.

### 3. `isFriendOfOwner` in `permissions.ts:44` re-implements the canonical friendship helper

`permissions.ts:44–60` hand-rolls a two-direction `friends` query and `forward.some(...) || reverse.some(...)`. That is exactly `convex/helpers/relationshipPolicy.ts:7` `loadFriendshipsBetweenUsers` + `lib/relationshipPolicy.ts:8` `areUsersFriends` (and `areUsersFriendsInDb` at `relationshipPolicy.ts:32` already packages the two together). The list path (`listQueries.ts:159`) and the TTS query (`queries.ts:20`) already use the canonical helper; only `permissions.ts` rolls its own.

**Remedy:** Delete `isFriendOfOwner` (`permissions.ts:44–60`) and use `areUsersFriendsInDb(ctx, userId, ownerId)`. (Folds naturally into the #1 rewrite of `requireThemeEditor`.) Removes the third hand-rolled bidirectional-friendship scan in the codebase.

### 4. The list path re-derives view access per-theme with a 9-query fan-out, sequentially, after already loading by access-bearing indexes

`getThemeListForViewer` (`listQueries.ts:176`) first loads candidates through purpose-built indexed queries: owned (`by_owner`), friend-shared (`by_visibility_owner`), and draft-goal themes (`loadDraftGoalAccessThemes`). Every theme in that raw list is therefore *already known to be accessible* by construction. It then hands the whole list to `filterListableThemes` (`listQueries.ts:116`), which loops `for (const theme of args.themes)` and `await`s `shouldListTheme` → `canViewTheme` **per theme** (`listQueries.ts:125–137`). `canViewTheme` (`themeAccess.ts:18`) fires **nine** `collect()` queries (challenges×2, duels×2, solo, goals×2, friends×2) for *each* theme, one theme at a time.

So listing N themes costs ~9·N collects, fully serialized, purely to re-confirm access the index queries already established — plus `enrichThemesWithOwners` (`listQueries.ts:142`) then loads friendships *again* per owner. The only thing `filterListableThemes` actually needs to add is the archived-or-not gate (`shouldListTheme` lines 119–121), which is pure set membership and needs **zero** DB calls.

**Remedy:** Split `shouldListTheme`'s two responsibilities. The archived filter is pure (`archivedThemeIds.has(theme._id)`) — apply it directly in `getThemeListForViewer` with no async, no per-theme fan-out. Drop the per-theme `canViewTheme` re-check entirely: the raw-list loaders already encode the access rule (owner / shared-friend / draft-goal), so re-running the full 9-table access engine on each row is redundant work that also serializes the whole list. If a defense-in-depth recheck is truly wanted, it must not be an O(N) sequential 9-query scan — but the cleaner design is to trust the indexed load that just ran. This removes the single largest source of sequential DB work in the area.

### 5. `convex/themes/accessPolicy.ts` is a 6-line identity re-export that buys nothing and splinters the import graph

`accessPolicy.ts` (all 6 lines) re-exports `canViewTheme`, `loadThemeWithViewerAccess`, `shouldListTheme` straight from `../helpers/themeAccess` with no added behavior. The result is two names for one module and an inconsistent import graph:
- `convex/themes.ts:9`, `mutations.ts:19`, `queries.ts:9`, `listQueries.ts:5` import via `./accessPolicy`
- `convex/helpers/resolveAccessibleThemes.ts:4` imports the same symbol straight from `./themeAccess`

So `loadThemeWithViewerAccess` is reached through two different paths depending on the file. A reader can't tell whether `accessPolicy` is "the policy" or `helpers/themeAccess` is — and the actual policy logic (the 9-table `canViewTheme`) lives in neither file's name suggests.

**Remedy:** Delete `accessPolicy.ts` and import directly from `convex/helpers/themeAccess` everywhere (4 call sites). Better still, since `helpers/themeAccess.ts` *is* the access policy, rename it to `convex/themes/accessPolicy.ts` (a real module, not a re-export) and move it under the feature folder where its only consumers live — leaving `helpers/` for genuinely cross-feature code. Either way, one canonical name for theme-view access.

---

## 🟡 Medium

### 6. `themeUiValidation.ts` re-runs the full O(n) issue scan once per word (and several times per theme)

`getDuplicateWrongAnswerIndices` (line 56), `getWrongIndicesMatchingAnswer` (line 77), and `getThemeRepairIssueForFlags`'s feeders each call `collectThemeIssues([word])` / `getThemeRepairIssues(words)` separately. `getThemeRepairIssueForWords` (line 125) calls `checkThemeForDuplicateWords` + `checkThemeForWrongMatchingAnswer` + `checkThemeForDuplicateWrongAnswers` (lines 127–129) — **three** full `collectThemeIssues(words)` passes to answer one question, each scanning every word and rebuilding its `seenWords`/`seenWrongAnswers` maps. `serverValidation.ts:102` `collectThemeIssues` already returns *all* issues in one pass; these helpers throw most of it away and re-scan.

This is also a thin-wrapper smell: `hasDuplicateWrongAnswersInWord` (line 68), `doesWrongAnswerMatchCorrect` (line 88), `checkThemeForDuplicateWordsForDuplicate`-style booleans (lines 95/102/144) are all `getX(...).size > 0` / `getThemeRepairIssues(...).some(...)` one-liners over the same scan.

**Remedy:** Call `collectThemeIssues(words)` once and derive everything from that single `ThemeValidationIssue[]`: a `Set` of duplicate-word indices, a per-word map for wrong-answer issues, and the prioritized repair issue. Most of the `checkThemeForX` / `getXIndices` wrappers collapse into selectors over one result. (The UI consumers in Area 1 already over-call these per render — Area 1 review item #11 — so a single-pass core here is the right foundation.)

### 7. `isWordDuplicate` fabricates a fake `WordEntry` to reuse the duplicate scanner — a magic-shape hack

`themeUiValidation.ts:165` builds a dummy entry with `answer: "candidate", wrongAnswers: ["first","second","third"]` purely so `collectThemeIssues` won't trip its *other* validations, then inspects `firstWordIndex === 0`. The comment at line 167 admits the fields are meaningless. This couples duplicate detection to the unrelated wrong-answer-count rule (if `THEME_MIN_WRONG_ANSWER_COUNT` changed, the three dummy strings would silently need to change too) and runs the full multi-rule scan to answer a one-line question.

**Remedy:** Duplicate detection is just `normalizeForComparison`-equality. Extract a tiny pure helper (or expose the normalize step) so `isWordDuplicate(word, existing)` is `existing.some(e => normalizeForComparison(e.word) === normalizeForComparison(word))`. No fake entry, no dependency on wrong-answer rules.

### 8. `handleDeleteTheme`'s draft-goal dedup is an O(n²) hand-rolled distinct that duplicates `loadDraftGoalAccessThemes`

`mutations.ts:169–184` loads goals as creator + partner, then dedups with `goals.findIndex(candidate => candidate._id === goal._id) === index` *and* filters `status === "draft"` in the same `.filter`, then `.find`s the one containing the theme. `listQueries.ts:40` `loadDraftGoalAccessThemes` already loads exactly "creator∪partner draft goals" with a clean `new Set` dedup. Two different dedup idioms for the same query, and the `findIndex`-in-filter is quadratic.

**Remedy:** Extract a shared `loadDraftGoalsForUser(ctx, userId): Doc<"weeklyGoals">[]` (creator∪partner, status==="draft", `Map`/`Set` dedup) and reuse it in both `handleDeleteTheme` and `loadDraftGoalAccessThemes`. The delete check becomes `draftGoals.some(g => g.themes.some(t => t.themeId === themeId))`.

### 9. `ThemeWordType` literal union is a third hand-maintained copy of the word-type enum

`mutations.ts:22` declares `export type ThemeWordType = "nouns" | "verbs" | "adjectives" | "adverbs";`. The canonical enum already exists as `WordType = keyof typeof WORD_TYPE_CONFIG` in `lib/themes/wordTypes.ts:162`, and the Convex validator `wordTypeValidator` (`convex/schema.ts:23`) is a third spelling. Three sources for one closed set; add a fifth word type and you edit three files.

**Remedy:** `ThemeWordType` should be `WordType` from `lib/themes/wordTypes.ts` (import the canonical type). Ideally derive the schema validator from `WORD_TYPE_VALUES` too, so the enum has exactly one definition. At minimum drop the literal re-declaration in `mutations.ts`.

### 10. `WEEKLY_GOAL_ACCESS_STATUSES` is a one-element constant array dressed up as a set membership test

`themeAccess.ts:56` `const WEEKLY_GOAL_ACCESS_STATUSES = ["draft"] as const;` then line 165 does `WEEKLY_GOAL_ACCESS_STATUSES.includes(goal.status as typeof WEEKLY_GOAL_ACCESS_STATUSES[number])` — a cast plus an array scan to test `goal.status === "draft"`. The array-of-one + cast adds indirection and an `as` over what is a single equality.

**Remedy:** `goal.status === "draft"`. Delete the constant and the cast. (If the intent is "this list will grow", a comment is cheaper and honest; today it's one value.)

---

## 🟢 Minor / nit-level

- `serverValidation.ts:53–59`: `normalizeValue` (`= value.trim()`) and `normalizeComparableValue` (`= normalizeForComparison(value)`) are single-line identity wrappers around imports. `normalizeComparableValue` in particular just renames `normalizeForComparison`. Inline them or drop the aliases.
- `wordTypes.ts:177` `getWordTypeConfig` and `wordTypeAllowsCorrectAnswerMarker` (line 194) both default `undefined → DEFAULT_WORD_TYPE`; `getDefaultWordType` (line 190) is a one-line wrapper returning the exported `DEFAULT_WORD_TYPE` constant. Trivial pass-throughs — fine to keep, but `getDefaultWordType()` callers could read the constant.
- `mutations.ts:98` `const filteredUpdates: Record<string, unknown> = {}` loses the typed shape of a `themes` patch; a `Partial<Pick<Doc<"themes">, "name"|"description"|"words">>` would keep the boundary typed without the `unknown` bag. Low risk since values are normalized just above.
- `api.ts`: the six exported `Generate*Result` interfaces (`{ success: boolean; data?; error? }`) restate the discriminated result that `callGenerateApi` already returns precisely (`{success:true; data} | {success:false; error}`). The loose `success: boolean` + optional-everything shape is weaker than what's available; callers must re-check. Not load-bearing for this area's verdict (and `api.ts` is mostly the generation boundary, adjacent to Area 3) — leave unless Area 3 touches it.

---

## Recommended ordering

1. **Unify the edit predicate (#1 + #2 + #3).** Rename `canGenerateStoredThemeTts → canEditTheme`, rewrite `requireThemeEditor` to load-then-delegate, delete `isFriendOfOwner`. This is the highest-value structural fix and removes the worst drift risk.
2. **Fix the list access fan-out (#4).** Make the archived filter pure; stop re-running `canViewTheme` per row. Biggest runtime/structure win.
3. **Collapse `accessPolicy.ts` (#5)** — pick one module name for view-access and import it consistently.
4. **Single-pass validation core (#6, #7)** — one `collectThemeIssues` call feeding all selectors; kill the fake-entry hack.
5. **Reclassify `lib/theme.ts` (#0)** — rename/move out of this area (coordinate with Area 1).
6. **Enum + dedup cleanups (#8, #9, #10)** in any order.

## Approval bar

Not approvable as-is. Blockers:
- the core edit-permission rule is **triplicated** across `lib/themeAccess.ts`, `convex/helpers/permissions.ts`, and the `canEdit` read-model, with a function name (`canGenerateStoredThemeTts`) that lies about being the general edit check — a guaranteed-drift policy split (#1, #2);
- the canonical friendship helper is re-implemented a third time in `permissions.ts` (#3);
- the theme-list path re-derives view access with a sequential 9-query-per-theme fan-out over a list whose access was already established by the indexed loaders (#4);
- `accessPolicy.ts` is an identity re-export that splinters the import graph for the most security-relevant function in the area (#5);
- `lib/theme.ts` is mis-filed: it is the appearance/color system, an unrelated concept colliding on the word "theme" (#0).

The access model — the explicit special focus of this area — is precisely where the structure is weakest: it does **not** live in one canonical place. Once `canEditTheme` is the single predicate and view-access stops fanning out per row, the rest is routine cleanup.
