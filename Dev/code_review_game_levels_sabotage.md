# Code Review — Area 5: Game levels & sabotage effects

**Date:** 2026-05-22
**Scope:** `app/game/` (recursively) — Level0–3 input components, sabotage hooks/effects/renderer, and the shared duel components colocated there. ~3.1k LOC.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

Real LOC via `wc -l`:

- **Level components:** `Level1Input.tsx` (510), `Level2TypingInput.tsx` (438),
  `Level2MultipleChoice.tsx` (385), `Level3Input.tsx` (260), `Level0Input.tsx` (107),
  `levels/types.ts` (65), `levels/constants.ts` (11), `levels/index.ts` (10),
  `levels/hooks/useTwoOptionKeyboard.ts` (66)
- **Sabotage:** `sabotage/SabotageRenderer.tsx` (23), `sabotage/index.ts` (23),
  `sabotage/options.ts` (8), `sabotage/effects/StickyNotes.tsx` (96),
  `sabotage/hooks/useBounceOptions.ts` (126), `sabotage/hooks/useTrampolineOptions.ts` (175),
  `sabotage/hooks/useReverseAnswers.ts` (81), `sabotage/utils/textTransforms.ts` (17)
- **Shared duel components:** `components/duel/Scoreboard.tsx` (62),
  `components/duel/CountdownControls.tsx` (175), `components/duel/FinalResultsPanel.tsx` (166),
  `components/duel/HintSystemUI.tsx` (118)
- **Hooks:** `hooks/useTTS.ts` (162)
- **Misc:** `constants.ts` (7)

Excluded per scope: prototype/mock files; `app/duel/` sabotage UI (Area 4); backend
`lib/sabotage/*` + `convex/sabotage.ts` (Area 6). Referenced where boundaries touch.

**Cross-file fact that drives the headline finding** (traced, not assumed): the *only*
production consumer of any `LevelXInput` is `app/solo/[sessionId]/page.tsx`, and it passes
`mode="solo"` at every one of the 6 call sites (lines 637–706) and **never passes a single
hint prop**. The live duel screen (`app/duel/[duelId]/page.tsx` → `DuelSession.tsx` →
`components/DuelView.tsx`) renders its *own* `AnswerOptionButton` grid and its *own*
`HintSystemUI` — it does not import the level components at all (`grep "game/levels" app/duel`
→ empty). So the entire "duel mode" half of these components is dead in production.

---

## 🔴 Blockers

### 1. The `mode === "duel"` path in all four level components is dead code (this is the prime target)

The level files advertise themselves as dual-purpose ("Works for both solo study and duel
modes" — `Level1Input.tsx:14`, `Level2TypingInput.tsx:12`, `Level2MultipleChoice.tsx:12`,
`Level3Input.tsx:16`). That dual purpose was abandoned: the duel screen uses
`AnswerOptionButton` + `HintSystemUI` instead. Everything gated on `isDuelMode === true`, plus
the entire `HintProps` surface, is unreachable from production. Concretely dead:

- **The duplicated "Hint System UI" block**, copy-pasted four times, ~70 lines each:
  `Level1Input.tsx:380–455`, `Level2TypingInput.tsx:368–435`,
  `Level2MultipleChoice.tsx:315–382`, `Level3Input.tsx:114–181`. These four blocks are nearly
  character-identical (request button → "Waiting for opponent…" → "Request another hint" →
  Cancel), differing only in trivial padding (`px-4` vs `px-5`). ~280 LOC of pure duplication,
  none of it ever rendered.
- **The anagram hint feature** in `Level2TypingInput.tsx` (`handleSubmitAnagram`, `handleDrop`,
  `handleDragStart/Over/End`, `handleShuffleAnagram`, `renderAnagramTiles`, the entire
  `hintIsAnagram` JSX branch lines 220–277, the `anagramLetters`/`anagramResult`/`dragIndexRef`
  state) — ~150 LOC reachable only when `hintAccepted && hintType === "anagram"`, which solo
  never sets. Same for `Level3Input.tsx`'s `showAnagramHint` path (lines 49–55, 102, 108–112).
- **The duel-only manual Confirm button** + `handleConfirm` in `Level1Input.tsx` (lines 72–78,
  457–481), the `onUpdateHintState` sync effect (234–238), `handleRequestHint` (241–245),
  `revealHint`'s duel branch, and the `hintRevealedPositions` apply effect (215–231) with its
  `eslint-disable react-hooks/exhaustive-deps`.
- **The duel-mode keyboard branch** in `Level2MultipleChoice.tsx:112–119` (number-key select),
  the `eliminatedOptions` handling (lines 59, 117, 186, 195–201), `handleRequestHint`,
  and `handleDontKnow`'s reveal-then-skip (only wired in duel, lines 89–97, 266).
- **The whole `HintProps` interface** (`types.ts:28–37`) and the per-level `onRequestHint`
  signatures (`types.ts:43,51,58`). No production code constructs these.

The only thing keeping this alive is the test suite, which passes `mode="duel"` and asserts on
`-hint-request` / `-confirm` / anagram testids (`Level1Input.test.tsx:48–`, all four
`LevelX.test.tsx`). Those tests validate code with no caller — they are guarding dead branches,
not behavior.

This is precisely the "dual-path old/new behavior" / "branches with no real caller" the project
rules forbid (AGENTS.md "No fallback code"). Per AGENTS.md, removing discovered dead/dual-path
code is a user decision, so I am flagging rather than prescribing deletion unilaterally — but the
recommendation is unambiguous:

**Remedy:** delete the duel half. Drop the `mode` prop and `isDuelMode`; the components become
solo-only and lose every `isDuelMode ? A : B` ternary (these riddle the styling — e.g.
`Level1Input.tsx:308–314, 353, 462, 487; Level2TypingInput.tsx:303, 319–357; Level3Input.tsx:94,
188–235; Level2MultipleChoice.tsx:240, 267–280`). Delete `HintProps`, the anagram feature, the
duel Confirm button, the duel keyboard branch. Update the tests to assert solo behavior only
(remove the `mode="duel"` cases). Expected impact: `Level1Input` ~510→~250, `Level2TypingInput`
~438→~210, `Level2MultipleChoice` ~385→~250, `Level3Input` ~260→~150. That is ~700 LOC removed
across the four files with **zero** production behavior change. If product genuinely intends to
re-route duel through these components later, that is a future feature with its own wiring — it
should not sit half-built in `main` (AGENTS.md: no `v2`/just-in-case scaffolding). Confirm intent
with the user before deleting; if they want it kept, it must be wired into `DuelView` and the
duplication below still has to be fixed.

### 2. Even within solo-only code, three components hand-roll the identical "Confirm / Don't Know" button pair and its style constants

After #1, Level2Typing, Level2MultipleChoice, and Level3 still each carry their own copy of:

- `actionButtonClassName` (the `bg-gradient-to-b border-t-2 border-b-4 …` string) —
  verbatim in `Level2TypingInput.tsx:125–126`, `Level2MultipleChoice.tsx:155–156`,
  `Level3Input.tsx:217` (inlined), and `Level0Input.tsx:10–11`.
- `primaryActionStyle` (the `linear-gradient(... buttonStyles.primary …)` object) — verbatim in
  `Level2TypingInput.tsx:128–136`, `Level2MultipleChoice.tsx:158–166`, `Level3Input.tsx:221–229`,
  `Level0Input.tsx:14–22`.
- `ghostActionStyle` / `secondaryActionStyle` (elevated bg + primary.dark border) —
  `Level2TypingInput.tsx:138–143`, `Level2MultipleChoice.tsx:168–173`, `Level0Input.tsx:24–29`,
  and inline in `Level3Input.tsx:195–200`.
- The "Don't Know" + "Confirm" two-button footer JSX itself — structurally identical in
  `Level2TypingInput.tsx:316–358`, `Level2MultipleChoice.tsx:264–296`, `Level3Input.tsx:185–240`.

This is the same `getThemeActionButtonStyle`-style duplication called out in Area 1, just in a
different feature.

**Remedy:** extract a shared `levels/components/` (or reuse the canonical button helper if one
exists in `themeCssVars`): a `<LevelActions onSkip onConfirm confirmDisabled dataTestIdBase />`
sub-component plus a single `levelButtonStyles.ts` exporting `actionButtonClassName`,
`primaryActionStyle`, `secondaryActionStyle`. Collapses four copies to one and removes ~120 LOC.
The style constants are currently rebuilt on **every render** inside each component body
(`Level2TypingInput.tsx:125`, `Level2MultipleChoice.tsx:155`) — hoisting them also stops that.

### 3. The word-grouping render loop (`buildLetterSlots` → split into per-word rows with `•` separators) is duplicated between Level1 and Level2Typing

`Level1Input.renderSlots` (lines 251–346) and `Level2TypingInput.renderAnagramTiles`
(lines 160–216) implement the *same* algorithm: walk `letterSlots`, detect a word boundary via
`slot.originalIndex - lastIdx > 1`, flush `currentWord` into a `flex` row, push a `•` spacer.
Two independent ~60-line hand-rolled grouping loops with the same off-by-one bookkeeping
(`lastOriginalIndex`/`lastIdx`, `key={`word-${elements.length}`}`).

**Remedy:** add a pure helper to `lib/stringUtils.ts` (next to `buildLetterSlots`):
`groupSlotsByWord(slots): {char,originalIndex}[][]` returning slots bucketed per word. Both
components then `.map` words → rows and `.map` slots → tiles, deciding only what to render in
each tile. Removes the duplicated control flow and makes the grouping unit-testable without
React (AGENTS.md: "core rules testable without React"). If #1 deletes the anagram path, this
collapses to a single caller, but the helper is still the right home for the logic.

### 4. `useBounceOptions` and `useTrampolineOptions` are the same physics-animation hook with two force models

`useBounceOptions.ts` (126) and `useTrampolineOptions.ts` (175) are structurally identical:
same `[options, positionsRef, animationRef]` triple, same `if (activeSabotage !== "<x>")`
cleanup block with the same `queueMicrotask(() => setOptions([]))` dance (bounce 39–53,
trampoline 47–60), same `screenWidth/Height` SSR guard, same `Array.from({length: optionCount})`
init, same `requestAnimationFrame(animate)` loop that does `positionsRef.current.map(...)` →
`setOptions([...positionsRef.current])`, same teardown. The *only* real difference is the
per-frame integrator (constant-velocity wall bounce vs. gravity + shake→fly state machine).

**Remedy:** extract `useAnimatedOptions<T>({ activeSabotage, effect, optionCount, init, step })`
that owns the rAF lifecycle, the cleanup/`queueMicrotask` boilerplate, and the
`positionsRef`↔state mirroring; pass `init(i, screen)` and `step(opt, dt, screen)` callbacks for
the physics. Bounce and trampoline shrink to ~40 LOC of pure physics each, and the rAF/cleanup
correctness lives in one tested place instead of two. Note `useReverseAnswers.ts` shares the same
"clear on deactivate, defer setState" shape but uses timers, not rAF — it can stay separate, but
its triple-duplicated "clear timers + defer setState null" block (lines 38–42, 47–51, 54–57)
should collapse to one local helper.

---

## 🟡 Medium

### 5. `useBounceOptions` / `useTrampolineOptions` use `Math.random()` directly — inconsistent with the codebase's seeded-PRNG convention

Both hooks call `Math.random()` for initial positions/velocities and per-bounce kicks
(`useBounceOptions.ts:66–69`; `useTrampolineOptions.ts:123–151`). Everything else in this area
that needs randomness is deterministic and seedable — `Level2MultipleChoice` uses
`hashSeed`+`seededShuffle` (lines 42–44), `StickyNotes` uses `mulberry32(hashSeed(...))`
(line 39), and `lib/prng.ts` is the canonical home (`generateAnagramLetters`, `seededShuffle`,
`mulberry32`). Sabotage is a shared multiplayer effect; using unseeded `Math.random()` here is
both an inconsistency and the reason these two animations can't be made reproducible like the
rest. Flagging the boundary inconsistency, not demanding determinism if product wants per-client
chaos — but it should be a deliberate choice, not an accident of two hooks ignoring `lib/prng`.

### 6. The two animation hooks defer state with `queueMicrotask` / `setTimeout(…, 0)` to dodge a React warning — papering over the real lifecycle

`useBounceOptions.ts:47–50, 73–74`, `useTrampolineOptions.ts:53–57, 91–92`, and
`useReverseAnswers.ts:37–57` all wrap `setState` in `queueMicrotask` / `setTimeout(0)` with
comments like "Defer cleanup to avoid sync setState warning" / "defer state updates and avoid
cascading renders." That warning means state is being set synchronously during render/commit of
the *parent* (`DuelView`) — the deferral hides the symptom rather than fixing where the effect
runs. This is fragile (microtask vs. macrotask timing differences between the three hooks) and
exactly the "silent workaround that hides a broken contract" the rules discourage.

**Remedy:** once #4 centralizes the rAF lifecycle, set initial state inside the effect normally
(effects run after commit, so no warning) and drive subsequent updates from the rAF callback —
the deferral should disappear entirely. If a genuine ordering need remains, document the precise
React invariant instead of "avoid warning."

### 7. `Level2MultipleChoice` keyboard handler is a 38-line `useEffect` with a disabled lint rule and a `setTimeout(…, 0)` around the submit

`Level2MultipleChoice.tsx:107–146` mixes solo arrow-nav and duel number-keys in one window-level
listener, suppresses `react-hooks/exhaustive-deps`, keeps a parallel `selectedIndexRef`
(lines 50–53) *and* reads `options[selectedIndexRef.current]`, and wraps the Enter submit in
`setTimeout(() => {…}, 0)` (lines 132–138) with no explanation. After #1 removes the duel branch,
the solo arrow-nav is small enough to read inline; the `selectedIndexRef` mirror and the
`setTimeout(0)` should go (they exist to work around stale-closure in the effect, which the ref
already handles — the timeout is redundant). If kept generic, this belongs in a small
`useListKeyboard` hook rather than an ad-hoc effect with a lint escape hatch.

### 8. `Level0Input` shadows its `colors` import and ships duplicated button styling

`Level0Input.tsx:9` imports `cssVarColors as colors`, then line 37 declares
`const colors = useAppearanceColors()` — the import is shadowed and dead (only
`buttonStyles` from that import is used, plus `colors.text.DEFAULT` from the module-level consts
at lines 14–29, which read the *static* import, not the live hook value). Same pattern flagged in
Area 1's `DeleteConfirmModal`. The `primaryActionStyle`/`secondaryActionStyle`/
`actionButtonClassName` here are the same constants as #2.

**Remedy:** drop the shadow; route the static button consts through the shared
`levelButtonStyles.ts` from #2 (or accept they read static `cssVarColors` and remove the unused
hook), so there's one source of truth for whether these buttons track live appearance colors.

---

## 🟢 Minor / nit-level

- `Level1Input.tsx:191–209`: `revealHint`'s "find next unfilled slot" uses nested
  `setTypedLetters(curr => { setRevealedPositions(currRev => {…}); return curr; })` purely to
  read current state — a read-only `setState` updater abused as a getter. A `useRef` mirror of
  the two values (or computing next-unfilled from the already-available `letterSlots` +
  functional update) would be clearer. Low risk; localized.
- `Level3Input.tsx:10–12` defines `Level3ExtendedProps` to bolt `HintProps` + `onRequestHint`
  onto `Level3Props`, while `types.ts:62–65` keeps `Level3Props` hint-free. The other three
  levels fold hint props into the exported interface. Inconsistent. Moot if #1 lands (all hint
  types deleted); otherwise unify.
- `SabotageRenderer.tsx` is a one-case `switch` (lines 16–21) over `effect` that only handles
  `"sticky"` — the comment explains bounce/trampoline/reverse are handled elsewhere. Fine today,
  but a `switch` with one real arm + `default: return null` is just `effect === "sticky"`.
  Leave it if more overlay effects are imminent.
- `StickyNotes.tsx:12–30`: `STICKY_COLORS` / `STICKY_TEXTS` are content arrays living in a
  component file. Harmless, but if any other effect ever needs taunt copy, move to a data module.
- `useTTS.ts:85–87`: the empty `catch {}` around the storage-URL lookup with comment "should fall
  back to live generation" is a legitimate product degradation (storage miss → regenerate), not a
  banned fallback — fine. Noting it only so the next reviewer doesn't misclassify it.
- `Scoreboard.tsx`, `FinalResultsPanel.tsx`, `CountdownControls.tsx`, `HintSystemUI.tsx` are
  clean, focused, well under the size guideline, and correctly memoized where it matters. No
  action. (`CountdownControls` four-state render is verbose but each state is genuinely distinct;
  acceptable.)

---

## Recommended ordering

1. **Confirm intent on #1 with the user**, then delete the duel-mode half of all four level
   components + `HintProps` + anagram feature, and retarget the tests to solo-only. Biggest LOC
   delete (~700), removes the dual-path violation, and shrinks every file under guideline.
2. Extract `levelButtonStyles.ts` + `<LevelActions>` (#2) and `groupSlotsByWord` (#3) — both get
   simpler once #1 is done.
3. `useAnimatedOptions` extraction (#4), which then lets you remove the `queueMicrotask`/`setTimeout(0)`
   deferrals (#6) and is the natural place to address the PRNG inconsistency (#5).
4. Mediums #7, #8 in any order.

## Approval bar

Not approvable as-is. Blockers:
- a fully **dead dual-path** (`mode="duel"` + entire hint/anagram surface) shipped in `main`,
  with ~280 LOC of four-way copy-pasted hint UI and a test suite guarding code that has no
  production caller — a direct AGENTS.md "no dual-path / no caller-less branches" violation;
- canonical-helper-style duplication of button styling and the word-grouping render loop across
  the level components;
- two near-identical physics hooks that should share one rAF-lifecycle abstraction, currently
  held together by fragile `setState`-deferral workarounds.
The fix is overwhelmingly **deletion**, not rearrangement: removing the abandoned duel half makes
roughly two-thirds of this area's complexity disappear before any extraction work begins.
