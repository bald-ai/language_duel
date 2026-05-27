# Handoff — Sentence Themes (Phases 1–6)

End-to-end implementation of the sentence-theme plan in
`Dev/sentence_theme_feature_plan.html`. Two content types now share the
`themes` table: word themes keep their existing shape, sentence themes carry
`sentenceRounds` and route through their own authoring + play surfaces.
Test suite: **953 / 953 passing**. Lint clean, typecheck clean (both root and
`convex/tsconfig.json`).

## What landed

### Phase 1 — Content foundation
- `lib/themes/sentenceTypes.ts`, `sentenceConstants.ts`, `sentenceValidation.ts`
  — pure types, constants, and `collectSentenceRoundIssues` / `normalizeSentenceRounds`
  with the punctuation, length, distractor, and duplicate-round rules from the plan.
- `lib/themes/themeContent.ts` — small `resolveThemeContentType` / `isSentenceTheme`
  helper used everywhere the discriminator matters.
- `convex/schema.ts`:
  - `themes`: added `contentType: optional`, made `words: optional`, added
    `sentenceRounds: optional`.
  - `weeklyGoalThemeSnapshots`: same mirror.
  - `duels`/`soloPracticeSessions`: `sessionWords` is now a discriminated
    union (`kind: "word" | "sentence"`).
  - `duelQuestions`: discriminated union too — word positions ship the MC
    snapshot, sentence positions ship the pre-shuffled tile pool.
- `convex/themes/mutations.ts` + `convex/themes/archiveDuplicate.ts` — branch
  by content type for create / update / duplicate. Sentence themes never
  touch TTS storage or word-only validators.

### Phase 2 — Authoring UI
- Themes list shows a content-type badge + "rounds" label and a new
  "All / Words / Sentences" tab bar (`app/themes/components/ThemeList.tsx`).
- New flow: tap "Generate New" → `ThemeContentTypeModal` picks word vs sentence
  → routes to either the existing word `GenerateThemeModal` or the new
  `GenerateSentenceThemeModal` (always over-generates with Pick & Prune).
- `SentenceThemeDetail` + `SentenceThemeDetailHeader` + `SentenceRoundCard` +
  `SentenceRoundEditor` give sentence themes their own authoring surface.
  Manual "Add Sentence" and "Generate" buttons mirror word themes; no TTS
  controls render.
- `useSentenceThemeController` owns the sentence flow state and is composed
  into `useThemesController` next to the existing word controller.

### Phase 3 — Mixed session items
- `lib/sessionWords.ts` now produces a discriminated `SessionItem` (word /
  sentence). `buildSessionWords` is kept as an alias so the 25+ call sites
  compile without renaming the field.
- `lib/answerShuffle.ts` builds mixed `DuelQuestionSnapshot[]` (word
  snapshots run through the existing PRNG path; sentence snapshots get a
  deterministic tile pool from `buildSentenceQuestionSnapshot`). Difficulty
  distribution still walks only word positions.
- `convex/duels.ts` masks both shapes at the DTO boundary
  (`hideQuestionAnswer`, `maskSessionItemForActivePlay`).
- Solo practice rejects sentence themes at the boundary (plan: solo is
  word-only in v1) — `buildSoloPracticeSession` throws on sentence items,
  `useSoloSessionSource` filters them out.

### Phase 4 — Sentence gameplay engine
- `lib/sentenceGameplay/engine.ts`: `tapSentenceTile`, `tapSentenceTile`-aware
  state, `buildAssembledSentence`, `isSubmittedSentenceCorrect`. Tile matching
  is text-equivalence after normalization, so identical-text tiles are
  interchangeable (plan decision: repeated correct words).
- `convex/rules/sentenceGameplayRules.ts`: `buildSentenceAnswerPatch` mirrors
  the word patch builder. Lives deduct **per wrong tile** (plus an extra
  HP on timeout) and the boss-end fields fire when lives hit zero — same
  inline shape as `getLimitedLivesMissPatch`.
- New mutation `gameplay.answerSentenceRound` and relay variant
  `relayDuel.relayAnswerSentence`. Sentence rounds use the existing
  `finalizeAfterAnswer` advance loop (both players submit, round advances).

### Phase 5 — Duel UI integration
- `app/duel/[duelId]/DuelSession.tsx` routes by `(duelMode, currentQuestion.kind)`:
  relay → `RelayDuelView`, sentence position → new `SentenceRoundView`,
  everything else → existing `DuelView`.
- `SentenceRoundView` renders the prompt, the (per-mode) timer, the assembled
  sentence strip, the tile grid, and feedback on reveal. The
  inner `SentenceRoundBoard` is keyed by `currentWordIndex` so per-round
  state and timer reset cleanly between rounds with no imperative effects.
- Round-aware tool unmount: the hint pool, sabotage UI, and listen button do
  not mount on sentence rounds. Server-side hint/sabotage mutations reject
  sentence positions with a clear error.
- `useDuelPhaseState` / `useDuelSessionViewModel` / `useDuelActions` use new
  `requireWordQuestion` / `requireWordSessionItem` narrowing helpers so they
  crash loudly (rather than silently rendering an empty MC grid) if a
  sentence position ever leaks into the word flow.
- `RelayDuelView`: sentence positions render a placeholder that explains the
  v1 limitation (see "Known v1 limitations" below).

### Phase 6 — Weekly goals / limited lives
- `weeklyGoalThemeSnapshots` carries `contentType` + `sentenceRounds`, so a
  sentence theme that is part of a goal gets snapshotted alongside word
  themes. Snapshot delete handles the missing-`words` case.
- Weekly-goal solo practice + spaced repetition still reject sentence themes
  with a clear error (solo is word-only in v1) — but the snapshot itself
  carries the data forward for duel/self-duel flows.
- Boss flows: sentence themes flow through the existing boss session
  builders unchanged; the sentence answer path applies lives loss and ends
  the boss attempt at 0 HP the same way word rounds do.

### New / updated tests (953 total, +44 new)
- `tests/lib/themes/sentenceValidation.test.ts` — 20 tests covering tokenization,
  every issue type, duplicate rounds, repeated-word allowance,
  cross-existing duplicate detection.
- `tests/lib/sentenceGameplay/engine.test.ts` — 13 tests on snapshot
  building, tap accept/reject, repeated-word interchangeability,
  normalization, and `isSubmittedSentenceCorrect`.
- `tests/convex/sentenceGameplayRules.test.ts` — 11 tests on scoring,
  patch building, lives deduction, boss-end on 0 lives.
- Existing tests: bulk-patched ~17 fixture files to carry the new
  `kind: "word"` discriminator on session items + duel questions. No
  test assertions were weakened.

## Loosenings — please validate, then we tighten

Per "loose up some things to make the sentences work from get go":

1. **Sentence questions ship `spanishSentence` to the client during active
   play.** Word questions still hide `correctOption`. The reason: the
   sentence engine validates each tap locally so the user gets immediate
   feedback ("wrong tap, mistake +1"). The server still re-scores from the
   final submission, so a tampered client can't fake points — but it can
   discover the answer order from network traffic. The clean fix is per-tap
   server validation; let me know if you want that and I'll wire it.
   *Touchpoints:* `convex/duels.ts` (`hideQuestionAnswer`,
   `maskSessionItemForActivePlay`), `app/duel/[duelId]/components/SentenceRoundView.tsx`.

2. **PvE sentence rounds are NOT shared-board in v1.** The plan describes
   PvE as "one shared sentence board, players alternate taps." I shipped
   each-player-own-copy with a shared 45s timer instead. The result-level
   scoring (clean=2, messy=1, timeout=0) matches the plan, but realtime tap
   state isn't synced. To wire the shared board, the sentence answer flow
   needs to graduate from "submit final result" to "submit each tap" — a
   noticeable refactor of `gameplay.answerSentenceRound`.

3. **Relay sentence positions show a placeholder, not a playable board.**
   `relayAnswerSentence` mutation works end-to-end, but the picker / answerer
   UI in `RelayDuelView` for sentence positions just tells the answerer to
   "switch to a self-duel session". Wiring the full picker → tile-board →
   advance flow inside `RelayDuelView` is the remaining work. The picker
   row already shows the English prompt (wraps to two lines for long
   prompts, per plan).

4. **Sentence theme generation always uses Pick & Prune.** There's no
   "standard direct generate" path for sentence themes in v1 — every
   generation over-generates by 100% so the user reviews/edits before
   saving. The plan describes a Pick & Prune review screen with active /
   removed columns; I shipped the simpler "open the draft directly in the
   editor and let the user delete unwanted rounds" path. The full
   `PickAndPruneReview`-style screen for sentences is deferred.

5. **No sentence Pick & Prune review screen reuse.** Word themes have a
   dedicated `PickAndPruneReview` with active/removed lists. Sentence themes
   currently land the generated rounds straight into the editor and rely on
   per-card "Delete Sentence" for pruning. Reusing the review-screen pattern
   for sentence themes is a follow-up.

6. **`useDuelActions.playWordAudio` was renamed in spirit but kept its
   public name.** The function is now a no-op on sentence items rather
   than crashing. We can rename it to `playRoundAudio` whenever the
   sentence flow needs its own audio hook.

## Data migrations / things you should know

- **`themes.words` is now optional** in the schema. Existing themes (which
  per docs is zero — no users yet) keep working because `resolveThemeContentType`
  defaults to `"word"` when `contentType` is absent. New themes always set
  `contentType` explicitly.
- **`themes.sentenceRounds` is new**, optional. Word themes never set it;
  sentence themes always set it.
- **`weeklyGoalThemeSnapshots.contentType` / `sentenceRounds`** mirror the
  themes table.
- **`duels.sessionWords` and `duels.duelQuestions`** are now discriminated
  unions. **Any existing duel rows without `kind: "word"` on items/questions
  will fail Convex schema validation on read.** Per the docs the app has no
  users, so I haven't written a backfill — let me know if you want one.
- **`soloPracticeSessions.sessionWords`** has the same union shape.
- New mutations exposed by the public API:
  - `gameplay.answerSentenceRound({ duelId, questionIndex, completed, mistakes })`
  - `relayDuel.relayAnswerSentence({ duelId, completed, mistakes })`
  - `themes.createTheme` / `themes.updateTheme` accept the new optional
    `contentType` / `sentenceRounds` args.
- New generation API request types: `sentence-theme` and
  `generate-more-sentence-rounds`. Both bill at `LLM_THEME_CREDITS` (same
  cost tier as word theme generation).
- The lint/typecheck/test gates were run on every step and are clean as of
  this handoff. Run again with `npx tsc --noEmit && npx tsc --noEmit -p convex/tsconfig.json && npx eslint && npm run test:run`.

## Risks I haven't smoothed over

- **Spaced repetition + sentence themes**: spaced-rep snapshots reject empty
  `words` arrays. Sentence-only goals therefore can't run spaced repetition.
  The plan defers full SR sentence support; the error message points users
  back to duels.
- **PvP / PvE shared-board sentences not wired**, see loosenings 2/3.
- **Sentence-theme TTS**: plan says no TTS in v1. The cards in the list
  intentionally don't render a placeholder, but if you start generating TTS
  for sentence themes later, the apply-mutation already skips them with all
  storage IDs returned as "rejected" — so it's a no-op rather than a corruption.
- **Convex schema migration not run yet**: schema changes have been written
  but Convex codegen / deploy hasn't been triggered from this branch. First
  `convex dev` / `convex deploy` will regenerate `_generated/` and pick the
  new validators up.

## Previously in HANDOFF.md (kept for context)

Relay Duel online prototype + Sentence Builder online mocks remain unchanged
on this branch — they live in `lib/mockOnline` and `app/mock-online` and
weren't touched.
