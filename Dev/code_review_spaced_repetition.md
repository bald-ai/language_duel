# Code Review — Area 10: Spaced repetition

**Date:** 2026-05-22
**Scope:** `app/repetition/` (board + launch UI), `convex/weeklyGoalRepetitions.ts` + `convex/weeklyGoalRepetitions/` (server logic), `lib/spacedRepetition.ts` (scheduling). ~1.8k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- **lib:** `spacedRepetition.ts` (82)
- **app/repetition:**
  - `page.tsx` (55)
  - `[goalId]/page.tsx` (228)
  - `components/RepetitionBoard.tsx` (412)
  - `components/RepetitionProgress.tsx` (71)
- **convex/weeklyGoalRepetitions.ts** (77) and **convex/weeklyGoalRepetitions/:**
  - `board.ts` (181)
  - `soloPractice.ts` (198)
  - `attemptMutations.ts` (132)
  - `challengeCreation.ts` (102)
  - `contentLoading.ts` (71)
  - `readModel.ts` (59)
  - `duelCompletion.ts` (57)
  - `rules.ts` (41)
  - `types.ts` (31)

Excluded per brief: the rest of weekly goals (Area 9); notifications (Area 11).

**Headline:** `lib/spacedRepetition.ts` is exemplary — a small, pure, fully-tested scheduling module with zero React/Convex leakage; the convex side correctly consumes it everywhere (`board.ts`, `readModel.ts`, `attemptMutations.ts`) rather than re-deriving intervals. That is the special-focus question answered cleanly: scheduling logic does **not** leak into convex or UI. No 🔴 blockers. The medium issues are all on the client side: a hand-redeclared, already-drifted server contract; `RepetitionBoard.tsx` doing too many jobs in one 412-LOC file; and duplicated card/title/step derivation between the board and the launch page.

---

## 🔴 Blockers

None. There is no file over the 700-LOC guideline, no scheduling-logic leak, no fallback/compat code, and no `any` in the reviewed app code.

---

## 🟡 Medium

### 1. The client `BoardItem` / `BoardData` types are hand-redeclared and have already drifted from the server contract — `RepetitionBoard.tsx:19-43`

`board.ts` exports a precise `RepetitionBoard` type built from `buildBoardItem`'s return, but the client re-types the whole shape by hand (lines 19-43). The two are already out of sync:

- Server `partner` is `UserSummary | null` = `Pick<Doc<"users">, "_id"|"name"|"nickname"|"discriminator"|"imageUrl">` (`convex/helpers/userSummary.ts`). The client declares `partner: { nickname?; discriminator?; name?; email? } | null` — it invents an `email` field that does not exist on `UserSummary` and drops `_id`/`imageUrl`. The test fixture (`tests/components/RepetitionBoard.test.tsx:20`) even sends `partner: { email: ... }`, which the real query can never produce. This is exactly the loosely-shaped-ad-hoc-object the rubric flags: the type compiles but no longer describes the real boundary.
- The codebase already has the canonical pattern for this: `app/mock-online/components/RoomView.tsx:19` does `type RoomData = NonNullable<FunctionReturnType<typeof api.prototypeRooms.getRoom>>`.

**Remedy:** delete the local `BoardItem`/`BoardData` (25 LOC) and derive from the server:
```ts
import type { FunctionReturnType } from "convex/server";
type BoardData = FunctionReturnType<typeof api.weeklyGoalRepetitions.getBoard>;
type BoardItem = BoardData["all"][number];
```
This makes the contract single-sourced, kills the phantom `email` field, and forces the test fixture to use the real `UserSummary` shape (a correct tightening, not a loosened assertion).

### 2. `RepetitionBoard.tsx` (412 LOC) is one file doing card rendering, row rendering, section layout, tab state, and stats — decompose

The file is under the 700 guideline so this is not a blocker, but it bundles five independent presentational concerns plus the data type and four formatters. The natural seams are already visible as locally-defined components: `ReadyCard` (lines 94-204, ~110 LOC), `CompactRow` (206-259), `CompactSection` (261-284), `VisibleItems` (286-347, the section dispatcher), and the top-level stats/tabs shell (349-412).

**Remedy:** split into `RepetitionReadyCard.tsx`, `RepetitionCompactRow.tsx`, and a small `RepetitionSection`/`VisibleItems` module, leaving `RepetitionBoard.tsx` as the ~80-LOC shell (stats grid + tabs + `<VisibleItems>`). Pull `formatShortDate`, `partnerLabel`, `themeTitle`, `sectionTitle` into a tiny `boardItemDisplay.ts` so they can be shared with the launch page (see #4). Each card then declares only the `BoardItem` fields it consumes instead of the whole item.

### 3. `VisibleItems` reimplements `CompactSection`'s header for the "ready" branch instead of reusing it — `RepetitionBoard.tsx:313-326`

The `section.key === "ready"` branch hand-writes the same `<section><div flex justify-between><h2>…</h2><span>{meta}</span></div>` header markup that `CompactSection` (261-284) already provides, only so the body can be `space-y-3` cards instead of the bordered list panel. The header title is even hardcoded `"Ready Now"` (line 318) while `sectionTitle("ready")` (line 67) returns the identical string — two sources for one label.

**Remedy:** give `CompactSection` an optional `bodyClassName`/`unstyledBody` (or a `variant: "panel" | "cards"`) and render every section through it, including ready. Removes the special-case branch in `VisibleItems` and the duplicated header + hardcoded title. The `map` over `visibleSections` then has a single body.

### 4. Card title and "current step → interval" derivation are duplicated between the board and the launch page

`themeTitle` (`RepetitionBoard.tsx:57-62`) and the inline `title` ternary in the launch page (`[goalId]/page.tsx:106-111`) are byte-for-byte the same "first theme, else `+N more`, else `Completed goal`" logic. Likewise `const currentStep = step ?? totalSteps; const intervalDays = getSpacedRepetitionIntervalDaysForStep(currentStep)` appears in both (`RepetitionBoard.tsx:97-98`, `[goalId]/page.tsx:101-102`).

**Remedy:** extract `boardItemTitle(item)` and `currentStepOf(item)` into the shared display helper from #2 and call from both pages. Small, but it is copy-pasted product logic ("what does the card title say") living in two files.

### 5. `isDueNow` is a redundant field — `readModel.ts:51`

`buildBoardItem` already returns `bucket` and `canStart`. `isDueNow: bucket === "ready"` is a third encoding of the same fact and is never read by either client page (confirmed: only the test fixture and the type declaration reference it; `ReadyCard`/`CompactRow` key off `canStart`/`bucket`). It is pure surface bloat on the wire contract.

**Remedy:** delete `isDueNow` from `buildBoardItem` and from the client type/fixture. Consumers that want "is it ready" use `bucket === "ready"` (or `canStart` when they also need content readiness).

### 6. The board loads full snapshot content for every ready item but the board UI only needs the ok/error flags — `board.ts:91-94`

For each `ready` item the board calls `loadSpacedRepetitionSnapshotContent` (which queries all theme snapshots and runs `buildSessionWords` + `summarizeSessionWords`), but `buildBoardItem` only forwards `wordCount`, `contentAvailable`, and `unavailableReason` to the board — and the board JSX never even renders `wordCount` (only the launch page does, via `getLaunchPreview`). So the board pays the cost of materializing every ready goal's full word set and theme summary purely to compute an availability boolean it could get more cheaply.

**Remedy:** for the board, replace the full `loadSpacedRepetitionSnapshotContent` call with a lightweight `assertSnapshotContentReady(ctx, goal)` that returns `{ ok: true } | { ok: false; message }` after the existing per-theme missing/empty checks (the loop already in `contentLoading.ts:27-41`), skipping `buildSessionWords`/`summarizeSessionWords`. Keep the full loader for the launch preview and the start/challenge mutations, which genuinely need `sessionWords`/`themeSummary`. This removes wasted per-item work on the most-rendered query without changing behavior.

---

## 🟢 Minor / nit-level

- **`EMPTY_BOARD` is exported from `board.ts` and re-imported by `weeklyGoalRepetitions.ts:9` only to be returned from the unauthenticated branch.** Minor indirection. Fine to leave; if you touch the file, inlining `return { stats: {…0}, all: [], … }` at the query is one fewer cross-module export. Low priority.
- **`getThemeNames` (`rules.ts:7-9`) is a one-line `goal.themes.map(t => t.themeName)` wrapper with a single caller** (`readModel.ts:41`). It is the kind of thin pass-through the rubric dislikes, but it reads fine and `rules.ts` is the natural home for goal-shape accessors. Leave unless a second caller fails to appear.
- **`completeRepetitionSoloPractice` and `recordRepetitionSoloMastery` both run the "all words mastered → advance + mark completed" path** (`soloPractice.ts:112-127` and `172-192`). Not a bug — `completeRepetition…` is the explicit finish and `recordRepetition…` auto-finishes on the last word — but the duplicated `advanceUserIfReady(...) + patch({status:"completed", completedAt})` block could be a small `finalizeSoloSession(ctx, session, …)` helper if a third trigger ever appears. Acceptable today.
- **`soloPractice.ts` uses `console.warn` + `return { advanced: false }` for several invariant violations** (lines 54-110: wrong source type, already completed, incomplete server progress, step mismatch, missing goal). These are defensive guards on a server-owned flow, not legacy/compat fallbacks, so they are within the AGENTS rules — but note `recordRepetitionSoloMastery` throws `ConvexError` for analogous bad input while `completeRepetitionSoloPractice` swallows-and-warns. The split (idempotent "did we advance?" vs. "is this even a valid call") is defensible; just keep it deliberate.
- **`board.ts` `loadRepetitionBoardForUser` and `loadLaunchPreviewForUser` share the bucket→content→partner→`buildBoardItem` sequence** (lines 84-106 vs. 152-171). The board does it in a loop with batched `loadUsersById`; the preview does it once with a single `ctx.db.get`. The shared core is ~12 lines and the batching differs, so extracting a `buildBoardItemForGoal(ctx, goal, record, partner, now)` would only save the duplicated bucket+content selection. Worth it only if you are already in the file for #6.

---

## Implementation Plan — approved 2026-05-22

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · minors A.

Pure cleanup pass — no behavior change. `lib/spacedRepetition.ts` (the clean pure scheduling module) is untouched. Excluded per brief: rest of weekly goals (Area 9), notifications (Area 11). Run eslint + `npm run typecheck` + `npm run test:run` before handoff (the test fixture's `partner` shape must be corrected as part of Step 1).

**Step 1 — single-source the board contract (#1, #5).**
- Delete the hand-rolled `BoardItem`/`BoardData` (`RepetitionBoard.tsx:19-43`); derive from the server: `type BoardData = FunctionReturnType<typeof api.weeklyGoalRepetitions.getBoard>; type BoardItem = BoardData["all"][number]`.
- Fix the test fixture (`tests/components/RepetitionBoard.test.tsx:20`) to use the real `UserSummary` shape — drops the phantom `email` field.
- Delete redundant `isDueNow` from `buildBoardItem` (`readModel.ts:51`) and from the client type/fixture; consumers use `bucket === "ready"` / `canStart`.

**Step 2 — lighten the hottest query (#6).**
- Replace the full `loadSpacedRepetitionSnapshotContent` call in the board path (`board.ts:91-94`) with a lightweight `assertSnapshotContentReady(ctx, goal)` returning `{ ok: true } | { ok: false; message }` from the existing per-theme checks (`contentLoading.ts:27-41`), skipping `buildSessionWords`/`summarizeSessionWords`. Keep the full loader for the launch preview and start/challenge mutations.

**Step 3 — decompose the board + share display helpers (#2, #3, #4).**
- Split `RepetitionBoard.tsx` (412) into `RepetitionReadyCard.tsx`, `RepetitionCompactRow.tsx`, and a `RepetitionSection`/`VisibleItems` module; leave `RepetitionBoard.tsx` as the ~80-LOC shell (stats grid + tabs + `<VisibleItems>`).
- Give `CompactSection` a `variant: "panel" | "cards"` (or `unstyledBody`) and route every section through it, removing the special-case "ready" branch and hardcoded `"Ready Now"` title (#3).
- Extract `boardItemTitle(item)` and `currentStepOf(item)` (plus `formatShortDate`, `partnerLabel`, `themeTitle`, `sectionTitle`) into a shared `boardItemDisplay.ts`, called from both the board and the launch page (`[goalId]/page.tsx:101-111`) (#4).

**Minors — address opportunistically when in the relevant file.**
- Inline `EMPTY_BOARD` at the query (`weeklyGoalRepetitions.ts:9`) if touched.
- `getThemeNames` thin wrapper (`rules.ts:7-9`) — leave unless a second caller appears.
- Consider a `finalizeSoloSession` helper if a third "advance + mark completed" trigger appears (`soloPractice.ts:112-127`, `172-192`).
- Keep the warn-vs-throw split between `completeRepetitionSoloPractice` and `recordRepetitionSoloMastery` deliberate.
- Extract `buildBoardItemForGoal` only if already in `board.ts` for Step 2.

## Approval bar

Approvable with the medium items addressed. There is no structural regression, no scheduling-logic leak (the special-focus question passes cleanly — `lib/spacedRepetition.ts` is a clean, testable pure module), no oversized file, no fallback/compat code, and no `any`. The changes that gate a clean approval are: (1) single-source the board contract from the server type instead of a hand-rolled shape that has already grown a phantom `email` field, and (2) decompose the 412-LOC board into card/row/section modules with shared display helpers. #6 (redundant snapshot loading) and #5 (redundant `isDueNow`) are smaller correctness/cleanliness wins that should ride along.
