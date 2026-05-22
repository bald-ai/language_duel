# Code Review — Area 4: Duel session — frontend

**Date:** 2026-05-22
**Scope:** `app/duel/` (the live duel-playing UI), excluding `useDuelAudio.ts` (Area 13 TTS).
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

Real LOC via `wc -l`:

- **Page / shell:** `[duelId]/page.tsx` (75), `[duelId]/DuelSession.tsx` (43)
- **Components:** `components/DuelView.tsx` (712), `components/AnswerOptionButton.tsx` (263),
  `components/HintPoolUI.tsx` (114), `components/SabotageSystemUI.tsx` (105)
- **Hooks:** `hooks/useDuelSessionViewModel.ts` (271), `hooks/buildDuelViewProps.ts` (220),
  `hooks/useDuelActions.ts` (211), `hooks/useDuelPhaseState.ts` (188),
  `hooks/useDuelQuestionTimer.ts` (93), `hooks/useDuelCountdown.ts` (60),
  `hooks/useDuelTypeReveal.ts` (59), `hooks/useOutgoingSabotageStatus.ts` (57),
  `hooks/useSabotageEffect.ts` (104), `hooks/useHintPool.ts` (44),
  `hooks/useIndexedAnswerLock.ts` (43), `hooks/useDuelDuration.ts` (26),
  `hooks/useDuelRaceErrors.ts` (21)

Total in-scope ≈ 2.6k LOC.

Excluded: `hooks/useDuelAudio.ts` (Area 13); `convex/*` + `lib/duel,sabotage,hints,hintPool`
duel logic (Area 6); `app/game/*` duel sub-components — `Scoreboard`, `CountdownControls`,
`HintSystemUI`, `FinalResultsPanel`, `SabotageRenderer`, the bounce/trampoline/reverse hooks
(Area 5).

**Overall:** the hook decomposition here is genuinely good — `useDuelActions` (write-side),
`useDuelPhaseState` (the answer state machine), `useSabotageEffect`, `useOutgoingSabotageStatus`,
and the `lib/sabotage/effectPhases` extraction are clean separations with the pure logic correctly
pushed into `lib`. This is a much healthier feature than Area 1. The problems are concentrated in
**two places**: the `buildDuelViewProps` indirection layer, and the 712-LOC `DuelView.tsx`. Neither
is a correctness problem, so this is APPROVE-WITH-CHANGES rather than BLOCK — but both should be
addressed before this area is considered done.

---

## 🔴 Blockers

### 1. The `buildDuelViewProps` layer is a 220-LOC pass-through that earns almost nothing

This is the central structural problem and the thing the special-focus brief asks about. The
honest answer: **the props-builder is not earning its keep.** It is a flat-in / nested-out remap
that introduces a *third* shape of the same data and a parallel duplicate type system.

Walk the actual data path for a single field. `onPauseCountdown` is:

1. created in `useDuelActions` as `pauseCountdown`,
2. assigned into `callbacks.onPauseCountdown` in `useDuelSessionViewModel` (line 253),
3. passed as `input.callbacks.onPauseCountdown` into `buildDuelViewProps`,
4. copied to `actions.onPauseCountdown` in the builder (line 204),
5. destructured back out of `actions` in `DuelView` (line 216),
6. handed to `<CountdownControls onPause={onPauseCountdown}>` (line 486).

Six hops for one callback. The builder's entire `actions` block (lines 203–217) is a hand-written
identity copy: thirteen `onX: input.callbacks.onX` lines that could be `actions: input.callbacks`.
The `DuelViewCallbacks` type (`buildDuelViewProps.ts:100–114`) and `DuelViewProps["actions"]`
(`DuelView.tsx:122–136`) are the **same 13 callbacks declared twice** and must be kept in lockstep
by hand.

The cost is concrete:
- **Three shapes of the duel for the same render:** `forRole` view + the flat `DuelViewPropsInput`
  (55 fields, `buildDuelViewProps.ts:55–98`) + the nested `DuelViewProps` (`DuelView.tsx:52–140`).
  A reader tracing any field crosses all three.
- **Duplicated type maintenance:** the flat input type largely re-declares the same fields the
  nested output type already declares, with the builder as the only thing tying them together.
- **The `as DuelViewProps` cast at `buildDuelViewProps.ts:219`** papers over the fact that the
  builder's hand-assembled object isn't trusted to structurally match the target. A pure remap that
  needs a cast at the end is a smell: the type system can't confirm the mapping is total/correct,
  so the cast silences exactly the check that would justify the layer's existence.

**Remedy — delete the flat input layer; build the nested `DuelViewProps` groups directly in the
view-model.** `useDuelSessionViewModel` already computes every value. Have it assemble
`round`, `timer`, `countdown`, `answers`, `hints`, `sabotage`, `score`, `actions`, `audio`
inline (or via small local `const round = {...}` blocks) and return them, with **no cast**. That
removes `DuelViewPropsInput` (44 lines), `DuelViewCallbacks` (15 lines), the 13-line identity
`actions` copy, the cast, and the entire second shape. `actions: input.callbacks` collapses to
just passing the actions object through.

Keep only the two pieces that contain real logic, as plain exported pure functions the view-model
calls:
- `deriveHintFlags(...)` — already pure and tested-shaped, fine as-is.
- the **PvE hint-zeroing** + `myName`/`theirName` formatting (`buildDuelViewProps.ts:117–137`) —
  the only non-mechanical work the builder does. Pull into a tiny `deriveScoreNames()` /
  fold the PvE override into `deriveHintFlags` (see #2).

This is the highest-value code-judo move in the area: it removes a whole layer and a whole
duplicate type surface while keeping every behavior. Note: `tests/components/DuelSession.test.tsx`
asserts against the nested `latestProps` shape, so the *output* contract is what's pinned — the
flat input layer is internal and free to delete.

### 2. The PvE hint-flag override is split across two layers and silently shadows `deriveHintFlags`

`useDuelSessionViewModel` computes `hints = deriveHintFlags({...})` (line 176) — which already
takes `myRole`/`theirRole` and produces the seven flags. Then `buildDuelViewProps` (lines 126–137)
**throws that result away** when `duelMode === "pve"` and substitutes an all-`false` literal. So the
real hint policy lives in two files, and a reader of `deriveHintFlags` has no way to know its output
is conditionally discarded downstream. This is exactly the "weird conditional bolted onto an
unrelated flow" the rubric warns about — the PvE rule is a property of *hint derivation*, not of
*prop assembly*.

**Remedy:** push the mode into `deriveHintFlags` (it already knows roles): early-return the
all-`false` object when `isPve`. One source of truth for hint flags; the override disappears from
the builder entirely (and the builder largely disappears per #1).

### 3. `DuelView.tsx` (712 LOC) is over the project guideline and is three components glued together

712 LOC, past the ~700 guideline, and it is structurally a header + a body + a footer that share
almost nothing but `colors` and a handful of phase booleans. The brief asks directly whether this
should be decomposed: **yes.**

Concrete seams already visible in the file:
- **Answer grid + the two sabotage overlays** (`DuelView.tsx:510–618`) — the bounce block
  (545–579) and trampoline block (582–616) are near-identical `displayAnswers.map` loops that
  differ only in the position object and the style literal. They duplicate the `computeOptionState` +
  `stripIrr` + `<AnswerOptionButton isFlying>` body three times (grid, bounce, trampoline).
- **The ~115 lines of inline style objects** (`DuelView.tsx:284–353`): `gameContainerStyle`,
  `listenButtonStyle`, `confirmButtonStyle`, `waitingMessageStyle`, `levelStyles`, the
  `difficultyPill` JSX. This is presentation config, not orchestration.
- **The header** (Scoreboard + Exit, 368–390) and **footer** (Confirm + Hint/Sabotage + Waiting +
  FinalResults, 622–708) are independent regions.

**Remedy:** extract `DuelAnswerGrid` (owns the grid + bounce + trampoline loops behind one
`renderOption(ans, i, posStyle?)` helper — collapses the triplicate map to one), a
`DuelRoundHeader` (word/progress/difficulty/hint-reveal block, 394–454), and move the static style
objects into a `duelViewStyles.ts` builder keyed on `colors` (same pattern as `themeStyles.ts` in
Area 1). Each of these drops 80–150 LOC and the file lands well under 400. The triplicate-overlay
collapse alone removes ~70 LOC of copy-paste.

### 4. `DuelView`'s 90-line "destructure everything" preamble is a direct symptom of #1

`DuelView.tsx:142–230` destructures the nested props back into ~55 flat locals — i.e. it *undoes*
the nesting the builder just *did*. The builder nests the bag; the consumer immediately un-nests it.
That round-trip (flat actions → nested groups → flat locals) is pure motion with no payoff and is
the clearest evidence the props-builder layer is shuffling rather than abstracting.

**Remedy:** with #1 done, keep the props grouped and read `round.word`, `actions.onConfirmAnswer`,
etc. at the use sites (or destructure per-subcomponent after the #3 split, where each child takes
only the group it needs). Either way the 90-line preamble shrinks to nothing. After #3, each
extracted child receives exactly one group object and destructures only what it uses.

---

## 🟡 Medium

### 5. `frozenData ? frozenData.X : X` is repeated ~8 times — the "display vs live" choice wants one model

`DuelView.tsx:232–237` computes `displayWord/displayIndex/displayAnswers/displaySelectedAnswer/
displayCorrectAnswer/displayHasNone`, and the same `frozenData ? ... : ...` ternary recurs for
`currentDifficulty` (328) and inside `optionContext` (266–268). The view-model *also* does the same
freeze-vs-live branching for audio (`useDuelSessionViewModel.ts:204–209`) and theme name (139–147).
This is a missing model: "the question currently on screen" is either the live question or the
frozen one, and that selection should be made **once**.

**Remedy:** have `useDuelPhaseState` (or the view-model) emit a single
`displayedQuestion = frozenData ?? liveQuestion` object with `word/answers/selected/correct/
hasNone/difficulty/wordIndex` already resolved. `DuelView` then reads `displayed.word` with no
ternary, and `handlePlayAudio` reads `displayed`. Removes ~8 scattered ternaries and the
`displayAnswersForReverse` alias (`DuelView.tsx:242`, which is just `displayAnswers` renamed).

### 6. `useDuelDuration` re-derives phase transitions that `useDuelPhaseState` already tracks

`useDuelDuration` (lines 6–16) keeps its **own** `prevPhaseRef` to detect the first
`→ "answering"` edge, duplicating the identical `prevPhaseRef` edge-detector inside
`useDuelPhaseState` (`useDuelPhaseState.ts:162–171`). Two hooks independently watch the same phase
transition. It also takes `status` and `phase` as args when it could take a single
`hasStarted`/`isCompleted` signal.

**Remedy:** since the duel start time is a property of the phase machine, compute `duelDuration`
inside (or alongside) `useDuelPhaseState` where the `answering` edge is already detected, or have
the view-model pass the already-known "first answering edge" down rather than re-detecting it. One
phase-edge detector for the feature, not two.

### 7. `useIndexedAnswerLock` exposes refs it doesn't need to, and the index-guarding is subtle

The hook returns `isLockedIndexRef` and `selectedAnswerIndexRef` (lines 35–36) but **no caller
reads them** — `useDuelPhaseState` only uses the getters/setters. More importantly, the whole
"answer is valid only for the index it was set on" mechanism (two value+index ref pairs, three
`getXForIndex` accessors) is clever but opaque; a reader has to reverse-engineer *why* a selection
is index-scoped (answer: to discard a stale selection when the server advances the question
mid-interaction). 

**Remedy:** drop the two unused ref exports. Add a one-line comment at the hook head stating the
invariant ("a selection/lock is only honored for the question index it was made on; reads for any
other index return the empty value"). This is borderline — the mechanism is correct and reasonably
small — but the unused exports are dead surface and should go.

### 8. Naming drift: `HintPoolUI` shows "+15 Seconds" for the `plus_ten_seconds` / `duel-hint-plus-ten` hint

`HintPoolUI.tsx:20–24` labels the hint `"+15 Seconds"` with `testId: "duel-hint-plus-ten"` and type
`plus_ten_seconds`. The label is *numerically* right (universal +5 from
`HINT_UNIVERSAL_TIMER_BONUS_SECONDS` plus +10 from `HINT_PLUS_TEN_BONUS_SECONDS` = 15), but the
identifier, the constant name, and the test id all say "ten" while the product copy says "15". Per
AGENTS.md "naming across the entire stack is non-negotiable," the concept is now described two
different ways. A future reader will reasonably assume a bug.

**Remedy:** rename the type/constant/testid to reflect the actual effective bonus (`plus_seconds`
or `plus_fifteen_seconds`) **or** make the label render the resolved value from the rule so copy and
logic can't drift. NOTE: the canonical `HintType` union + constants live in `lib/hintPool/*`
(Area 6) and the rule applies the +5 there; coordinate the rename across areas rather than only
relabeling the button. Flagging here because it surfaces at the in-scope `HintPoolUI`.

### 9. `ViewerSafeDuelQuestion` is declared twice, verbatim

The exact type `NonNullable<Doc<"duels">["duelQuestions"]>[number] & { correctOption?: string;
answerRevealedToViewer?: boolean }` appears in both `useDuelSessionViewModel.ts:25–28` and
`useDuelPhaseState.ts:11–14`. Both hooks then `as ViewerSafeDuelQuestion`-cast the raw question.
The repeated cast also hints the backend DTO type isn't surfacing these viewer-only fields — the
"safe" augmentation is being bolted on at the consumer.

**Remedy:** declare `ViewerSafeDuelQuestion` once (a shared `duelSessionTypes.ts` next to the hooks,
or — better — have the Area-6 `getDuel` DTO type already include `correctOption?` /
`answerRevealedToViewer?` so the cast disappears). At minimum, dedupe the local declaration.

---

## 🟢 Minor / nit-level

- **Magic `5` in `useDuelPhaseState.ts:140`** (`setCountdown(5)`) duplicates
  `TRANSITION_COUNTDOWN_SECONDS = 5`, which the timer hook already imports
  (`useDuelQuestionTimer.ts:8`). Use the constant — AGENTS.md "name repeated numbers."
- **Dead-shaped `"done"` sentinel** in `useDuelSessionViewModel.ts:131`
  (`|| { word: "done", answer: "done", wrongAnswers: [] }`) and the matching `word !== "done"` /
  `displayWord !== "done"` guards scattered through `DuelView` (511, 627, 640, 659, 684) and
  `SabotageSystemUI.tsx:40`. A string sentinel standing in for "no current word" is exactly the kind
  of silent-default the no-fallback rule dislikes; the completed-duel case is already known via
  `status === "completed"`. Consider deriving an explicit `isRoundOver` boolean once and gating on
  that instead of string-comparing `"done"` in six places. (Borderline product-default, hence minor,
  but the sentinel is fragile.)
- **`AnswerOptionButton.tsx` mixes two color systems**, same issue flagged in Area 1's
  `DeleteConfirmModal`: it imports `cssVarColors as colors` (line 6, used inside `computeOptionState`)
  *and* calls `useAppearanceColors()` (line 199, used in the component). The static styles in
  `computeOptionState` therefore can't react to appearance changes the way the component's badges do.
  If appearance theming is meant to be live, `computeOptionState` should take `colors` as a param;
  if not, the component's `useAppearanceColors()` is the inconsistent one. Pick one.
- **`SabotageSystemUI` recomputes `disabled` inside `.map`** (`SabotageSystemUI.tsx:77–82`) although
  it doesn't depend on `option` — it's loop-invariant. Hoist above the `.map`. Trivial.
- **Stale comment** in `SabotageSystemUI.tsx:21–25` ("extracted from the main DuelSession to adhere
  to the 'Skinny Page' rule") references an architecture that no longer matches (it's rendered from
  `DuelView`, not `DuelSession`). Drop or correct.
- **`toSabotageEffect` (`useSabotageEffect.ts:31–33`)** is an `as SabotageEffect` cast wrapped in a
  function — an identity wrapper around a cast. The real fix is for `SabotageData.effect` to be typed
  `SabotageEffect` at the source rather than `string`; the wrapper just relocates the cast. Minor.
- **`page.tsx` and `DuelSession.tsx` both render a full-screen "Sign in first." / "not part of this
  duel" message.** `page.tsx:49,54` gate on `!user` / `duelData === null`, and `DuelSession` repeats
  `signin`/`forbidden` states (DuelSession.tsx:34–40) that — given `page.tsx` already guards `!user`
  and a non-null `duelData` — are effectively unreachable from this caller. Not harmful, but the
  view-model's `signin`/`forbidden` branch is dead given the page's gating; consider whether the
  view-model should own those checks *or* the page should, not both.

---

## Recommended ordering

1. **Collapse the props-builder (#1) + fold PvE hint override into `deriveHintFlags` (#2).** Biggest
   structural win, removes a layer + a duplicate type surface + a cast. Output contract is
   test-pinned, so risk is contained.
2. **Decompose `DuelView.tsx` (#3)** — extract `DuelAnswerGrid` (collapsing the triplicate overlay
   loops), `DuelRoundHeader`, and `duelViewStyles.ts`. Do after #1 so children can take grouped props.
3. **Drop the un-nesting preamble (#4)** — falls out of #1 + #3 naturally.
4. **Single `displayedQuestion` model (#5)** + **unify phase-edge detection / `useDuelDuration`
   (#6).**
5. Mediums #7, #9, then the naming coordination in #8 (cross-area).
6. Minors as convenient.

## Approval bar

Approvable only after the props-builder collapse (#1/#2/#4) and the `DuelView` decomposition (#3).
The hook layer is otherwise in good shape and does **not** block: the state-machine, sabotage, and
write-action hooks are cleanly separated with pure logic correctly living in `lib`. What keeps this
from a clean APPROVE:
- a 220-LOC indirection layer that re-shapes data into a second type system, ends in an `as` cast,
  and is immediately un-shaped by its only consumer (no behavior earned),
- a 712-LOC component over the project guideline with three obvious sub-components and a triplicated
  render loop,
- one piece of feature logic (PvE hint policy) split across two layers and silently overriding a
  pure helper.

None are correctness defects, so 🟡 rather than 🔴 — but they are real maintainability regressions
with clear, low-risk remedies and should land before this area is signed off.
