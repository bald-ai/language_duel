# Code Review — Area 1: Theme management UI

**Date:** 2026-05-22
**Scope:** `app/themes/` components + hooks (non-generation, non-TTS). ~4.0k LOC.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

- **Components:** `ThemeDetail.tsx`, `ThemeList.tsx`, `WordEditor.tsx`, `ThemeCardMenu.tsx`,
  `FriendFilterModal.tsx`, `AddWordModal.tsx`, `DeleteConfirmModal.tsx`,
  `RegenerateConfirmModal.tsx`, `themeStyles.ts`
- **Hooks:** `useThemesController.ts`, `useThemeDetailController.ts`,
  `useThemeListController.ts`, `useThemeWordEditController.ts`, `useThemeActions.ts`,
  `useWordEditor.ts`, `themeControllerTypes.ts`
- **Page:** `page.tsx`, `constants.ts`

Excluded (covered by Area 3): `GenerateThemeModal`, `GenerateMoreModal`, `PickAndPruneReview`,
`DiscardPickAndPruneModal`, `useGenerateMore`, `usePickAndPrune`,
`useThemeGenerationController`, `useThemeGenerator`.
Excluded (covered by Area 13): `useThemeTtsController`.

---

## 🔴 Blockers

### 1. `ThemeDetail.tsx` (762 LOC) is past the 700 LOC project guideline and is structurally three components glued together

`WordCard` is defined inline (~225 LOC of presentation + ~10 derived style objects). The
header section (rename input + visibility toggle + friends-can-edit lock + TTS button +
status badge) is another ~170 LOC chunk that has nothing to do with the word list. The
action dock at the bottom is a third block.

**Remedy:** split into `ThemeDetailHeader.tsx`, `ThemeWordCard.tsx`, and
`ThemeActionDock.tsx`. Drops the file under 250 LOC. The 30-prop interface on `ThemeDetail`
is a direct consequence of this conflation and shrinks naturally once the pieces are split.

### 2. `ThemeDetail` prop pyramid hides a missing boundary

AddWordModal and GenerateMoreModal are independent sub-features threaded *through*
`ThemeDetail` just so they can render next to it (with grouped `addWordState` /
`generateMoreState` shims and `handleX_Click` / `handleX_Close` wrappers).

**Remedy:** render `<AddWordModal>` and `<GenerateMoreModal>` directly in `page.tsx`
next to `<ThemeDetail>` — the same pattern already used for `DeleteConfirmModal` /
`DiscardPickAndPruneModal`. Removes ~15 props from `ThemeDetailProps`, removes the two
wrapper handlers, removes the `addWordState` / `generateMoreState` grouping shim.

### 3. `useThemesController.detailProps` `useMemo` is a fiction — it never memoizes

The dep array (lines 96–143) is `[detail, generation, list, …, tts, wordEdit.handleEditWord]`.
`detail`, `generation`, `list`, `tts` are whole hook-result objects rebuilt every render,
so the memo recomputes every render and only adds noise.

**Remedy:** drop the `useMemo` entirely, or — better — eliminate the props bag (see #2)
so each sub-feature owns its own JSX in `page.tsx`.

### 4. `ThemeList` variable-size virtualization is incidental complexity solving a problem that doesn't exist

The list drags in: a `VariableSizeList`, a manual `sizeMapRef`, a per-row
`useLayoutEffect` that measures and calls `setRowSize`, two `ResizeObserver`s (one for
height, one for width), an `availableHeight` state, a `listWidth` state, an
`estimatedAvailableHeight` fallback, and a `LIST_VIEWPORT_RESERVED_PX` magic number.
Every card is the same shape: title + one-line metadata + status badge + menu. Variance
is only whatever line-wrap the title produces, and the `<h3>` already has `truncate`.

**Remedy:** use `FixedSizeList` with `ITEM_SIZE`, or drop virtualization entirely given
typical user theme counts. Deletes the entire size-map + content-ref + setRowSize +
ResizeObserver dance (~100 LOC).

### 5. Four modals hand-roll the same chrome and ignore the canonical `ModalShell`

`AddWordModal`, `DeleteConfirmModal`, `RegenerateConfirmModal`, `FriendFilterModal` all repeat
(`DiscardPickAndPruneModal` has the identical problem but is owned by **Area 3** — see Area 3 #4/#5
and [cross-area reconciliation C2/C3](./code_review_cross_area_reconciliation.md); the shared
`ConfirmModal` that resolves the delete/regenerate/discard confirms is built once, not per-area):

```
fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4
  → rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm
  → centered title <h2>
```

`app/components/modals/ModalShell.tsx` is the canonical home for exactly this and
already handles SSR mount + portaling + appearance colors.

**Remedy:** wrap with `<ModalShell title="…">`. Eliminates `getThemeModalPanelStyle` and
the `if (!isOpen) return null` boilerplate from all four files.

### 6. `DeleteConfirmModal` mixes two color systems and duplicates `getThemeActionButtonStyle("danger")`

The file imports `cssVarColors as colors` at the top *and* calls `useAppearanceColors()`
inside the component (the local `colors` shadows the import). The static
`dangerActionStyle` constant is a verbatim copy of the `"danger"` branch of
`getThemeActionButtonStyle` in `themeStyles.ts`.

**Remedy:** delete `dangerActionStyle` and the `cssVarColors` import, call
`getThemeActionButtonStyle("danger", colors)` instead.

### 7. List filter state in `useThemeListController` is three flags pretending to be a discriminated union

`selectedFriendFilter | myThemesOnly | showArchived` are mutually exclusive, but the
exclusion is enforced by hand-clearing in each setter. The mode also drives `queryArgs`,
`filterDisplay`, `isFiltering` as three separate derivations.

**Remedy:** model as
`type ListFilter = {kind:"all"} | {kind:"mine"} | {kind:"friend", friendId} | {kind:"archived"}`
with a single `setFilter`. Three setters collapse to one, `queryArgs` becomes a single
`switch`, and `filterDisplay` (in `ThemeList`'s ternary chain) becomes a switch over the
discriminated union.

---

## 🟡 Medium

### 8. `WordEditor.tsx` (381 LOC) renders three independent mode sub-trees inline

The `CHOICE`, `GENERATE`, and `MANUAL` blocks (lines ~143–367) share almost no JSX. Each
is essentially its own component.

**Remedy:** extract `<ChoiceMode/>`, `<GenerateMode/>`, `<ManualMode/>` — each declares
only the props it consumes (currently every mode receives every prop). Drops the file
~200 LOC.

### 9. `useThemesController` returns ~18 fields; `page.tsx` reads only ~6

Dead exports: `selectedTheme`, `localWords`, `themes`, `showGenerateModal`,
`setShowGenerateModal`, `deleteConfirm`, `setDeleteConfirm`, `goBack`, `wordEditorState`.

**Remedy:** trim to `viewMode + the *Props bundles + the two render-gate fields`.
Removes the parallel "raw state" boundary that would tempt future code to bypass the
props-builder layer.

### 10. `useWordEditor.setEditMode` is dead code

Exported (lines 86–88) but no caller reads it. Mode transitions happen via `startEdit` /
`goToManual` / `generate`'s success path.

**Remedy:** delete.

### 11. Repair-issue detection runs at two layers per render

`ThemeDetail` computes `getThemeRepairIssueForWords(localWords)` for save-disable; the
list `map` recomputes `getDuplicateWordIndices` + `getDuplicateWrongAnswerIndices` +
`getWrongIndicesMatchingAnswer` per row; each `WordCard` recomputes its own
`getThemeRepairIssueForFlags`.

**Remedy:** one parent `useMemo` returning `{ saveError, perWord: Map<index, RowIssues> }`,
pass each card its slice. Drops 4 of `WordCard`'s 7 issue-related props.

### 12. Non-null assertions on `editingField` / `editingWordIndex` leak through the props builder

`useThemeWordEditController` uses `wordEditor.editingWordIndex!` and `editingField!`
inside setters that already gated on `=== null`.

**Remedy:** destructure after the guard so TS narrows naturally. Drops ~6 `!` assertions.

### 13. `ThemeDetail` rename-input duplicates commit logic

`handleThemeNameBlur` and the Enter branch of `handleThemeNameKeyDown` do the same
`normalizeThemeName → compare → onThemeNameChange` work.

**Remedy:** extract `commitThemeName()` and call from both.

---

## 🟢 Minor / nit-level

- `useThemeDetailController.handleVisibilityChange` and `handleFriendsCanEditChange` are
  near-identical "if unsaved → patch draft, else → mutation + setState + toast". Could
  share a small helper if a third field appears — fine to leave today.
- `themeControllerTypes.ts` is a 3-type file. Inlining `DeleteConfirmState` and
  `SelectedThemeState` into their respective controllers would mean one less hop.
  Stylistic, leave it.

---

## Recommended ordering

1. ModalShell adoption (#5, #6) — biggest LOC delete, lowest risk.
2. ThemeDetail decomposition (#1).
3. Props-pyramid removal (#2) + drop the false `useMemo` (#3).
4. ThemeList virtualization simplification (#4).
5. Filter discriminated union (#7).
6. Medium items in any order.

## Approval bar

Not approvable as-is. Blockers:
- file > project guideline (`ThemeDetail.tsx` 762 LOC) with a clear decomposition path,
- canonical-helper duplication (`ModalShell` not used; danger style duplicated),
- a controller layer that pretends to memoize but doesn't, with a vestigial public surface,
- incidental complexity (variable-size virtualization, three-flag filter state) where a
  simpler model is obvious.
