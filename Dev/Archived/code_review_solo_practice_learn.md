# Code Review — Area 8: Solo practice & Learn

**Date:** 2026-05-22
**Scope:** `app/solo/` (practice + learn phase), the `lib/solo*` runtime/navigation/timer
helpers, the Solo Practice launch modal + launcher hook, and `lib/contextClues/`. ~3.0k LOC
(prototype `lib/contextClues/` ~491 LOC excluded from grading — see note).
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

- **Pages:** `app/solo/[sessionId]/page.tsx` (735), `app/solo/learn/[sessionId]/page.tsx` (621)
- **Practice components/hooks:** `app/solo/[sessionId]/hooks/useSoloSession.ts` (209),
  `app/solo/[sessionId]/components/CompletionScreen.tsx` (125),
  `app/solo/[sessionId]/translationDirection.ts` (29), `app/solo/[sessionId]/constants.ts` (19)
- **Learn components:** `ConfidenceSlider.tsx` (213), `WordCard.tsx` (216),
  `MemoizedWordCardWrapper.tsx` (92), `LetterGroups.tsx` (95), `SetAllDropdown.tsx` (58),
  `LearnHeader.tsx` (57), `app/solo/learn/[sessionId]/constants.ts` (20)
- **Shared solo:** `app/solo/components/SoloStatusCard.tsx` (72)
- **Lib:** `lib/soloPracticeRuntime.ts` (281), `lib/soloNavigation.ts` (67),
  `lib/soloLearnTimer.ts` (38)
- **Launch:** `app/components/modals/SoloPracticeModal.tsx` (285),
  `hooks/useSoloPracticeLauncher.ts` (20)
- **Prototype (excluded from grading):** `lib/contextClues/{content,session,types,constants,index}.ts`

> **`lib/contextClues/` is prototype code and is out of grading scope.** Its only consumer is
> `app/components/prototypes/ContextCluesBeta.tsx` (the `prototypes/` directory), and
> `lib/contextClues/types.ts:1-8` opens with "Context Clues **prototype**". Per the review's
> "IGNORE mock/prototype code" rule it is not held to the production bar. It is internally clean
> (pure functions, discriminated-union item model, seeded shuffle); the only thing worth a future
> note is that it was placed under `lib/` rather than beside its prototype component — see Minor.

---

## 🔴 Blockers

### 1. The two page files duplicate ~95 lines of session-resolution logic verbatim — extract `useSoloSessionSource`

`app/solo/[sessionId]/page.tsx:64-150` and `app/solo/learn/[sessionId]/page.tsx:94-159`
are, line for line, the same code: the same six `searchParams.get(...)` reads, the same
`requestedThemeIds` memo, the same three `useQuery` calls (`getBossPracticeSession`,
`getWeeklyGoalPracticeThemes`, `getThemes`) with the identical skip conditions, the same
`selectedThemes` map/flatMap memo, and the same `sessionWords` / `themeSummary` memos. I diffed
the blocks directly — they are character-identical through `themeSummary`.

It does not stop there. The **loading/error gate** is also duplicated five branches deep:
`page.tsx:286-401` vs `learn/page.tsx:349-442` render the same five `SoloStatusCard` states
("No theme selected" / "Loading…" / "no longer available" / weekly-goal `!ok` message /
"Theme not found"), each wrapped in the same `<ThemedPage> + bottom gradient bar` shell, with
only the testid prefix (`solo-practice-` vs `solo-learn-`) and the loading copy differing.

This is the textbook missing-abstraction smell from the rubric ("repeated conditionals signaling
a missing model"). Two ~700-line files are both ~130 lines of *identical* plumbing.

**Remedy:** create `app/solo/hooks/useSoloSessionSource.ts` (a hook is correct here — it owns
`useSearchParams` + `useQuery` orchestration) returning a discriminated result:

```ts
type SoloSessionSource =
  | { status: "invalid"; message: string }      // no theme / not found / weekly-goal !ok
  | { status: "loading" }
  | { status: "unavailable"; message: string }  // session/themes === null
  | { status: "ready"; sessionWords; themeSummary; requestedThemeIds;
      soloPracticeSessionId; weeklyGoalId; spacedRepetitionStep; isBossPractice;
      returnTo; returnLabel };
```

Then a tiny shared `<SoloStatusScreen status={...} returnLabel={...} onExit={...} testIdBase=…/>`
presentational component renders the four non-ready states (it just wraps `SoloStatusCard` in the
`ThemedPage`+gradient shell that is currently copy-pasted ~9 times across the two files). Each page
collapses to `if (source.status !== "ready") return <SoloStatusScreen .../>;` plus its own UI.
This deletes ~200 LOC across the two pages and removes the single largest maintenance hazard in the
area: today any change to the theme-resolution contract must be made in two places and kept in sync
by hand.

### 2. `app/solo/[sessionId]/page.tsx` (735 LOC) is past the project guideline and is three things glued together

Beyond the duplicated preamble (#1), this file mixes (a) session-source resolution, (b) **boss /
spaced-repetition completion-reporting orchestration** (the two `useEffect`s + three `useRef`
status latches + the mastery-write counter, lines 75-283), (c) a giant inline `header` JSX block
(424-481), and (d) a ~220-line `content` block that is a hand-rolled `level → input component`
dispatch (487-718). After #1 lands this is still well over 700 LOC.

**Remedy, in priority order:**

- **Move the completion-reporting orchestration into `useSoloSession` (or a sibling
  `useSoloCompletionReporting` hook).** Lines 75-218 + 226-283 are pure side-effect orchestration:
  three `useRef<"idle"|"pending"|"done">` latches, a `reportedMasteryIndicesRef` set, a
  `pendingMasteryWritesRef` mirrored into `masteryWritesPending` state, and two completion effects.
  None of this is "wiring" — it is stateful orchestration that AGENTS.md says belongs in a hook,
  not a page. It is also the most fragile code in the area (manual idle/pending/done state machines
  guarding against double-fire), so it deserves to be unit-testable. The page should end up calling
  `handleCorrect` and letting the hook decide whether to report mastery.

- **Replace the 220-line `level → component` ladder (lines 625-707) with a typed dispatch.** The
  body is six near-identical blocks differing only by `(questionLevel, direction, level2Mode) →
  Component + prop names`. The `key`, `onCorrect={handleCorrectWithProgress}`,
  `onSkip/onWrong={handleIncorrect}`, `mode="solo"` props are repeated verbatim in every branch.
  This is "branching complexity where a better abstraction should exist." Extract
  `app/solo/[sessionId]/components/SoloQuestion.tsx` that takes the resolved `currentWord` +
  `session` slice and internally picks the input. Note `lib/soloPracticeRuntime.ts` already owns
  `SoloQuestionLevel | SoloLevel2Mode | SoloTranslationDirection` — the dispatch key is already a
  typed model; only the JSX switch is missing.

- **Extract the inline `header` (424-481) to a `SoloPracticeHeader` component** — it is a sibling
  of the existing `LearnHeader.tsx` and shares its exact structure (see #3).

Target: page drops under ~250 LOC (status gate via #1, completion logic into a hook, question
dispatch + header into components).

### 3. `SoloPracticeHeader` and `LearnHeader` are the same component with a different subtitle/gradient

`app/solo/[sessionId]/page.tsx:424-481` (the inline `header`) and
`app/solo/learn/[sessionId]/components/LearnHeader.tsx:5-57` render byte-for-byte the same
scaffold: the `w-16 h-0.5 …via-current…` top rule, the `title-font text-3xl…` "Solo Practice"
heading with the `linear-gradient(135deg …) + WebkitBackgroundClip:text` treatment on both words,
and the identical three-element `w-8 h-px…/ w-1.5 h-1.5 rotate-45 / w-8 h-px…` bottom flourish.
The only real differences are the practice header's `title-text-outline`/`data-text` outline
styling vs the learn header's `drop-shadow`, and the learn header's "Study first, then jump into
practice" subtitle (the practice header has a theme-summary pill instead).

**Remedy:** one `SoloHeader` component in `app/solo/components/` taking
`{ subtitle?: ReactNode; variant: "outline" | "shadow" }`. The theme-summary pill on the practice
side becomes the `subtitle` slot. Deletes ~55 LOC of duplicated decorative markup and stops the two
headers from drifting.

### 4. The "Exit" button + bottom gradient bar + `ThemedPage` page chrome is copy-pasted across both pages

The danger-colored Exit button style block (`backgroundColor: colors.status.danger.DEFAULT`,
`borderTopColor … light`, `borderBottomColor … dark`, `color:"#FFFFFF"`, the same
`textShadow`) appears identically at `page.tsx:505-520` and `learn/page.tsx:449-464`. The bottom
`h-1` gradient bar (`linear-gradient(to right, primary, cta, secondary)`) appears **seven** times
across the two files (every loading/error branch plus the main return). `CompletionScreen.tsx:19`
and `learn/page.tsx:34` also each redeclare the same `actionButtonClassName` gradient-button string
that already exists canonically as `actionButtonClassName` in
`app/components/modals/modalButtonStyles.ts` (imported by `SoloPracticeModal.tsx:17`).

**Remedy:** (a) a shared `SoloExitButton` (or fold it into the `SoloHeader`/page shell);
(b) a single `SoloPageShell` wrapping `ThemedPage` + the bottom gradient bar so the gradient string
lives once; (c) import the canonical `actionButtonClassName` (and `getCtaActionStyle`) from
`modalButtonStyles.ts` in `CompletionScreen` and the learn page instead of re-declaring them. Each
of these is a small delete, but together they remove the "change the brand bar / exit button and
you must find 9 copies" tax.

---

## 🟡 Medium

### 5. `useSoloSession` hides a duplicated "advance" code path and an unnecessary `queueMicrotask`

`app/solo/[sessionId]/hooks/useSoloSession.ts`:
- `scheduleAutoAdvance` (73-84) and `selectNextQuestion` (119-124) contain the same three
  statements: `setSession(selectNextSoloQuestion)` + `setShowFeedback(false)` +
  `setFeedbackAnswer(null)`. Extract a single `advanceToNextQuestion()` and call it from both the
  timeout body and the Level-0 handlers. Removes the divergence risk between timed and immediate
  advance.
- The init effect (89-103) wraps `setSession`/`setStartTime` in `queueMicrotask` with the comment
  "avoid synchronous setState in effect body." Calling `setState` in an effect body is the normal,
  supported React pattern; the microtask defers initialization by a tick for no real benefit and is
  the kind of "magical" indirection the rubric flags. Set state directly.

### 6. `WordEntry` is redeclared in `useSoloSession` instead of using the canonical `SessionWordEntry`

`useSoloSession.ts:21-25` declares a local `interface WordEntry { word; answer; wrongAnswers }`.
The pages feed it `sessionWords`, whose element type is `SessionWordEntry` from
`lib/sessionWords.ts` (and `practiceSession.sessionWords` from the server). Re-declaring the shape
locally means the hook's contract can silently drift from the producer's, and it shadows the
project's already-canonical `WordEntry` in `lib/types.ts`. Import `SessionWordEntry` and type
`words: SessionWordEntry[] | undefined`.

### 7. The learn page owns ~120 lines of hint/confidence/timer state that belong in a hook

`app/solo/learn/[sessionId]/page.tsx:162-346` is `useState` + `useCallback` orchestration:
`hintStates`, `isAllRevealed`, `confidenceLevels`, `confidence legend dismissal`,
`isSetAllOpen`, the timer countdown effect, the time-up navigation effect, and seven memoized
mutators (`revealLetter`, `revealFullWord`, `resetWord`, `toggleRevealAll`, `setAllConfidence`,
`getConfidence`, `setConfidence`). Per AGENTS.md "hooks orchestrate state, pages wire," this is
hook-shaped, and extracting `useSoloLearnState({ sessionWords, sessionSourceKey })` would let the
reveal/confidence logic (currently untestable inside a page component) be unit-tested. After #1 +
this extraction the learn page is mostly JSX.

Note the `revealFullWord`/`toggleRevealAll`/`setAllConfidence` bodies all recompute "non-space
letter positions of `stripIrr(answer)`" (lines 207-220, 239-249, plus `WordCard.tsx:88-95` and
`LetterGroups.tsx:24-44`). That projection deserves one shared helper
(`revealablePositions(answer): number[]`) in `lib/` rather than four hand-inlined copies.

### 8. The learn timer's `useState(initialDuration)` + `const duration = initialDuration` is dead state churn

`learn/page.tsx:162-163`: `duration` is a `const` alias of `initialDuration` and never changes,
yet `timeRemaining` is initialized from it and the page also keeps `duration` around for the
`timerStyle` ratio (338-346). Since `duration` is constant, the whole thing is just "count down
from `initialDuration`." This is minor on its own but compounds #7: fold the timer into the
extracted hook (`useSoloLearnTimer(initialDuration, isSessionReady)`) returning `{ timeRemaining,
timerStyle }`, and drop the redundant alias. `lib/soloLearnTimer.ts` already holds the pure label
helpers; the countdown effect is the missing piece and belongs next to them behaviorally.

### 9. URL ↔ state (de)serialization is split between `lib/soloNavigation.ts` and ad-hoc page code

`buildSoloSearchParams` (lib) writes the `confidence` param as an opaque string, but the *encoding*
(`JSON.stringify(confidenceByWordIndex)`, `learn/page.tsx:330`) and the *decoding* (the 20-line
hand-rolled validator at `page.tsx:89-108`) live in the pages. The two sides of one wire format are
500 lines apart in different files, and the decoder silently returns `null` on any malformed
input — acceptable for a URL param, but the parse/serialize pair should be colocated and typed.

**Remedy:** add `encodeConfidenceParam(record): string` and
`decodeConfidenceParam(raw): Record<number, SoloMasteryLevel> | null` to `lib/soloNavigation.ts`
(or a small `lib/soloConfidenceParam.ts`) and have both pages call them. Removes the inline JSON
parsing from the page and makes the contract testable.

### 10. `currentWord.themeName` is accessed through `"themeName" in currentWord` + `typeof … === "string"` guards

`page.tsx:580-587` and `629-636` both do
`hasMultipleThemes && "themeName" in currentWord && typeof currentWord.themeName === "string"`.
`sessionWords` elements are `SessionWordEntry`; if that type carries `themeName`/`themeId` the
`in`-operator probing and `typeof` re-checks are unnecessary structural guesswork (the rubric's
"ad-hoc object shapes that obscure the real invariant"). Type `currentWord` as `SessionWordEntry`
(see #6) so `themeName` is a known optional field and the guard becomes a plain
`hasMultipleThemes && currentWord.themeName`. Also: the multi-theme label block is itself
duplicated between the feedback-hidden Level-0 branch and the non-Level-0 cue block — once
`SoloQuestion` is extracted (#2) it should render once.

### 11. `MemoizedWordCardWrapper` is a wrapper whose name describes its mechanism, not its job

`MemoizedWordCardWrapper.tsx` exists to (a) compute `hintsRemaining` from `hintState.hintCount`
and `maxHints`, and (b) bind the five `(wordKey, …)` callbacks down to zero-arg/`value`-arg
handlers for one word. That is a legitimate per-row adapter, but the name leaks the React
optimization (`Memoized…Wrapper`) instead of the concept. It also re-derives `wordKey` =
`${themeId}-${originalIndex}` (line 44) which the parent already computed and passed context for.
Rename to `SoloLearnWordRow` (it *is* the row), and pass the already-computed `wordKey` from the
parent's `.map` instead of recomputing it from `themeId`+`originalIndex` so the key format lives in
one place (the page currently builds the same `${sessionSourceKey}-${index}` string in five spots:
lines 245, 264, 319, 575, and indirectly here).

---

## 🟢 Minor / nit-level

- **`lib/contextClues/` location.** It is prototype code (excluded from grading) but sits under the
  production `lib/` tree while its only consumer is `app/components/prototypes/`. If/when prototypes
  are pruned this will be missed. Co-locating it under the prototype directory would make its status
  obvious. Leave until the prototype is promoted or removed.
- `ConfidenceSlider.tsx` ships a `compact` prop (86-88) and a `readOnly` prop that are never set by
  any caller in scope (`WordCard` passes neither). If no out-of-scope caller uses them, drop the
  dead optionality. (Verify against Area 9/10 first.)
- `WordCard.tsx:84-86`: `const computedStyle = useMemo(() => ({ ...cardStyleBase }), [])` is an
  identity spread of a frozen const into an empty-dep memo — pure ceremony. Use `cardStyleBase`
  directly.
- `MemoizedWordCardWrapper.tsx:45`: `const state = hintState;` is a pointless alias; use `hintState`.
- Both pages keep two color sources: a module-level `import { cssVarColors as colors }` *and* a
  `const colors = useAppearanceColors()` inside the component that shadows it (e.g.
  `page.tsx:12` vs `:65`; `SoloStatusCard.tsx:5` vs `:33`; `WordCard.tsx:10` vs `:82`;
  `CompletionScreen.tsx:8` vs `:42`). The static `cssVarColors` is only used to precompute static
  style objects; the live `colors` is used in render. This is an established pattern in the file set,
  but the shadowing (`colors` meaning two different things in one file) is a readability trap —
  consider naming the static import `cssColors`.
- `app/solo/[sessionId]/constants.ts` and `learn/.../constants.ts` are pure re-export shims over
  `lib/soloPracticeRuntime.ts` / `lib/soloLearnTimer.ts` plus one local threshold constant each.
  Harmless, but the re-export layer means a reader chasing `LEVEL_UP_PROBABILITY` hops
  page→constants→runtime. Importing the lib symbols directly where used would remove the hop; leave
  if the indirection is an intentional "feature constants live here" convention.

---

## Implementation Plan — approved 2026-05-22

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · #7 A · #8 A · #9 A · #10 A · #11 A · minors A.

This is a refactor / de-duplication pass — **not a behavior change**. The pure runtime
(`soloPracticeRuntime.ts`), navigation/timer helpers, and the learn leaf components
(`ConfidenceSlider`, `LetterGroups`, `SetAllDropdown`) stay untouched. `lib/contextClues/` is
**excluded** (prototype). Run eslint + `npm run typecheck` + `npm run test:run` before handoff
(code changed, so the gate applies).

Ordered steps:

### Step 1 — Extract the shared session-source layer (#1)
- Create `app/solo/hooks/useSoloSessionSource.ts`: owns `useSearchParams` + the three `useQuery`
  calls (`getBossPracticeSession`, `getWeeklyGoalPracticeThemes`, `getThemes`) + the
  `requestedThemeIds` / `selectedThemes` / `sessionWords` / `themeSummary` memos. Returns the
  discriminated `SoloSessionSource` (`invalid` / `loading` / `unavailable` / `ready`).
- Create `app/solo/components/SoloStatusScreen.tsx`: wraps `SoloStatusCard` in the
  `ThemedPage` + bottom-gradient shell, takes `{ status, returnLabel, onExit, testIdBase }`,
  renders the four non-ready states.
- Both pages collapse to `if (source.status !== "ready") return <SoloStatusScreen .../>;`.
- Deletes ~200 LOC across the two pages. Do first — it unblocks measuring both files.

### Step 2 — Shared page chrome (#3, #4)
- `app/solo/components/SoloHeader.tsx` taking `{ subtitle?: ReactNode; variant: "outline" | "shadow" }`;
  practice's theme-summary pill becomes the `subtitle` slot. (#3)
- Shared `SoloExitButton` (or fold into the shell) + a `SoloPageShell` wrapping `ThemedPage` + the
  bottom `h-1` gradient bar so the gradient string lives once. (#4)
- In `CompletionScreen` and the learn page, import the canonical `actionButtonClassName` (and
  `getCtaActionStyle`) from `app/components/modals/modalButtonStyles.ts` instead of re-declaring. (#4)
- Mechanical, low-risk; do before the big decomposition.

### Step 3 — Decompose `app/solo/[sessionId]/page.tsx` (#2)
- Move completion-reporting orchestration (the three `useRef` idle/pending/done latches,
  `reportedMasteryIndicesRef`, `pendingMasteryWritesRef`/`masteryWritesPending`, the two completion
  effects) into `useSoloSession` or a sibling `useSoloCompletionReporting` hook — make it
  unit-testable.
- Replace the 220-line `level → input component` ladder with a typed
  `app/solo/[sessionId]/components/SoloQuestion.tsx` that takes the resolved `currentWord` + session
  slice and picks the input internally (dispatch key already typed in `soloPracticeRuntime.ts`).
- Extract the inline header into `SoloHeader` (from Step 2).
- Target: page under ~250 LOC.

### Step 4 — Move learn-page state into hooks (#7, #8)
- `useSoloLearnState({ sessionWords, sessionSourceKey })`: `hintStates`, `isAllRevealed`,
  `confidenceLevels`, legend dismissal, `isSetAllOpen`, the seven memoized mutators. (#7)
- `useSoloLearnTimer(initialDuration, isSessionReady)` returning `{ timeRemaining, timerStyle }`;
  drop the redundant `const duration = initialDuration` alias. (#8)
- Add one shared `revealablePositions(answer): number[]` helper in `lib/` (currently inlined 4×:
  `learn/page.tsx` 207-220 & 239-249, `WordCard.tsx` 88-95, `LetterGroups.tsx` 24-44). (#7)

### Step 5 — Type the word contract (#6, #10)
- Import `SessionWordEntry` from `lib/sessionWords.ts`; in `useSoloSession` type
  `words: SessionWordEntry[] | undefined` and drop the local `interface WordEntry`. (#6)
- Type `currentWord` as `SessionWordEntry` so the `"themeName" in currentWord` + `typeof` guards
  become `hasMultipleThemes && currentWord.themeName`; render the multi-theme label once inside
  `SoloQuestion` (from Step 3). (#10)

### Step 6 — Codec + small dedupes (#9, #5, #11), any order
- Add `encodeConfidenceParam(record): string` + `decodeConfidenceParam(raw): Record<number,
  SoloMasteryLevel> | null` to `lib/soloNavigation.ts` (or `lib/soloConfidenceParam.ts`); both
  pages call them — removes the inline JSON parse/validate from the page. (#9)
- Extract `advanceToNextQuestion()` in `useSoloSession` (shared by `scheduleAutoAdvance` +
  `selectNextQuestion`); set init state directly, drop the `queueMicrotask`. (#5)
- Rename `MemoizedWordCardWrapper` → `SoloLearnWordRow`; pass the parent's already-computed
  `wordKey` instead of recomputing `${themeId}-${originalIndex}`, so the key format lives in one
  place. (#11)

### Minors block (fold into files touched above)
- Drop `ConfidenceSlider`'s unused `compact`/`readOnly` props — **verify against Area 9/10 first**.
- Use `cardStyleBase` directly in `WordCard.tsx` (kill the identity-spread empty-dep memo).
- Remove the `const state = hintState` alias in the row component.
- Rename the static `import { cssVarColors as colors }` to `cssColors` in the files where a live
  `useAppearanceColors()` shadows it (pages, `SoloStatusCard`, `WordCard`, `CompletionScreen`).
- **Deferred:** `lib/contextClues/` relocation (prototype-only) and the two `constants.ts`
  re-export shims — leave as-is.

## Approval bar

Not approvable as-is. The blocking issues are:
- **~95 lines of verbatim session-resolution logic plus a 5-branch loading/error gate duplicated
  across the two page files** (#1) — a missing shared hook/component, and the area's primary
  maintenance hazard.
- **`app/solo/[sessionId]/page.tsx` at 735 LOC** (#2) with an obvious decomposition: completion
  orchestration belongs in a hook, the 220-line level→component ladder belongs behind a typed
  dispatch component.
- **Three more copy-paste duplications across the page boundary** (header #3, exit button + gradient
  bar + re-declared button class #4) where one shared component each is the clear fix.

The pure runtime (`soloPracticeRuntime.ts`), the navigation helpers, the timer helpers, and the
learn leaf components (`ConfidenceSlider`, `LetterGroups`, `SetAllDropdown`) are in good shape; the
problem is concentrated in the two page files and the absence of a shared solo-session/source layer
between them.
