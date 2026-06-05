# Plan: Enable Relay mode for sentence rounds

## Goal
Let a Relay duel include sentence themes (mixed word + sentence decks allowed). The
answerer builds the sentence on a tile board (build-and-confirm, same model PvP uses);
building the sentence correctly within the timer scores the relay flat point (1) — retries
are fine (Confirm means "check, try again," as in PvP); a timeout scores 0. A Confirm shows
the per-tile green/red correctness mask, identical to PvP (see scoring, decision #2).

## Core design decisions (the ones that make this tractable)

1. **Build-and-confirm only** for relay sentences (no per-tap). Matches the note already
   in `lib/sentenceGameplay/mode.ts` ("Relay … will reuse build-and-confirm later"). The
   answerer taps tiles in any order, peels/resets, hits Confirm. Correct Confirm = point.
2. **Forgiving completion scoring + per-tile correctness mask (retry-friendly, identical to
   PvP).** Building the sentence correctly within the timer awards `RELAY_QUESTION_POINTS`
   (1) to the answerer — no matter how many Confirms it took; a timeout / never-correct is 0.
   So Confirm means "check my work, try again," exactly as players know it from PvP. A Confirm
   returns the per-tile green/red correctness mask (same as PvP), so the answerer sees which
   words are right/wrong; a wrong Confirm stays in the answer phase to retry. (`failedConfirms`
   is tracked by the reused pure fn but does not affect score.) Score stays binary 1/0,
   consistent with words. Accepted tradeoff: because the mask is shown and retries are free,
   a non-speaker can in principle brute-force a short 1-distractor sentence (place → read
   colors → rearrange). This was a deliberate product call — the learning feedback of the mask
   is worth more than closing that edge for v1; tighten with more distractors later if needed.
3. **Hard-upgrade is disabled on sentence positions (v1).** Relay's only difficulty knob is
   the per-pick 🔥 hard-upgrade (budgeted); for v1 it does not apply to sentences. The 🔥
   toggle is hidden on sentence rows and `relayPick` rejects `hardUpgrade` for a sentence
   server-side. Relay sentences always show **1 distractor** (easy). This is the key
   simplifier: a sentence is always served from the base set (`duelQuestions`), so the
   answerer's board always equals the board the validator reads — no dual question-set
   hazard (see R1). (Future: 🔥 → +1 distractor; would need the validator to read the served
   snapshot — a small refactor, deferred.)
4. **Per-position answer window.** Word positions keep the **21s** `RELAY_ANSWER_TIMEOUT_MS`
   (`RELAY_ANSWER_TIMEOUT_SECONDS = 21`); sentence positions get 60s
   (`SENTENCE_RELAY_TIMER_SECONDS`). The window is derived from the served question's `kind`,
   in one helper, used by the scheduler delay, the stale check, **and the client countdown**.
   The client countdown anchor is `duel.relayAnswerStartedAt` (NOT `duel.questionStartTime`,
   which relay never sets) — see R8. So the extracted board cannot blindly reuse
   `SentencePvpBoard`'s `questionStartTime`-based timer; relay passes its own `secondsLeft`.
5. **Mixed decks allowed.** No need to forbid word+sentence in one relay deck; each
   position renders its own answer surface based on `relayServedQuestion.kind`.

## Picker watching (answers Q1)
During a sentence answer phase the picker watches the answerer's board fill in live — the
same "watch" relationship relay words already have (the picker sees the answer grid, just
can't tap). This works for free: `sentenceProgress` is shipped in the relay DTO (§4), so the
picker's locked board mirrors the answerer's placed tiles in real time.

## What does NOT need to change (verified)
- **Schema** — `duelQuestions` is already a `word | sentence` union, `relayHardQuestions`
  is `DuelQuestionSnapshot[]`, `sentenceProgress` already exists. No migration.
- **Server answer masking** — `hideQuestionAnswer` in `convex/duels.ts:65` already handles
  `kind === "sentence"` (strips `spanishSentence`, keeps `tilePool`/`englishPrompt`). So a
  sentence served question is already shipped correctly: masked during `answer`, revealed
  during `feedback`.
- **Index basis** — relay's `relayAssignedIndex` is a position into `wordOrder`, the same
  basis `duelQuestions`/`sentenceProgress.questionIndex` use. So `relayAssignedIndex`
  doubles as the `questionIndex` the sentence pure functions expect. No translation.
- **The existing PvP/PvE `relayAnswer` word guard** (`relayDuel.ts:155`) stays — `relayAnswer`
  remains the word-only path; sentences go through new confirm mutation.

---

## File-by-file changes (fake code)

### 1. `lib/answerShuffle.ts` — `buildRelayQuestionSet` must accept sentences
Currently throws on any non-word item (line 161). Change it to emit a sentence snapshot for
sentence items. Critical detail: build the sentence snapshot with a **fixed** distractor
count regardless of `level`, so the `medium` set (→ `duelQuestions`) and `hard` set (→
`relayHardQuestions`) produce an **identical** pool for sentence positions (the seed depends
only on the sentence text + index, so identical inputs → identical pool). Combined with
decision #3 (🔥 disabled on sentences), the answerer's served pool always equals the pool
the validator reads — no dual-set hazard.

```ts
export function buildRelayQuestionSet(items, wordOrder, level) {
  return wordOrder.map((sessionIndex, questionIndex) => {
    const item = items[sessionIndex];
    if (isSessionSentenceItem(item)) {
      // Fixed count (never 🔥-upgraded in v1), so medium and hard sets yield an
      // identical sentence pool — indices always align. Relay sentences show 1
      // distractor (easy). Count from the table, never a literal.
      return buildSentenceQuestionSnapshot({
        englishPrompt: item.englishPrompt,
        spanishSentence: item.spanishSentence,
        distractors: item.distractors,
        questionIndex,
        distractorCount: SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.easy,
      });
    }
    if (!isSessionWordItem(item)) throw new Error("unknown session item kind");
    return { ...buildDuelQuestionSnapshot(item, questionIndex, {
      level, wrongCount: DIFFICULTY_WRONG_COUNT[level],
    }), points: RELAY_QUESTION_POINTS };
  });
}
```

### 2. `lib/duel/relayEngine.ts` — answer window + sentence-aware served question
- Remove the "word-only" assumption in `buildInitialRelayState` comment.
- Add `relayAnswerWindowMs(duel)`: returns `SENTENCE_RELAY_TIMEOUT_MS` if the served
  question is a sentence, else `RELAY_ANSWER_TIMEOUT_MS`. Used everywhere the window is
  needed.
- `relayServedQuestion` is unchanged (already returns whatever `duelQuestions[idx]` is). For
  sentence positions it returns the sentence snapshot — good.

```ts
export function relayAnswerWindowMs(duel) {
  const served = relayServedQuestion(duel);
  return served?.kind === "sentence" ? SENTENCE_RELAY_TIMEOUT_MS : RELAY_ANSWER_TIMEOUT_MS;
}
```
(Add `SENTENCE_RELAY_TIMEOUT_MS = SENTENCE_RELAY_TIMER_SECONDS * 1000`. Put it next to
`SENTENCE_RELAY_TIMER_SECONDS` in `lib/themes/sentenceConstants.ts` and import it into the
relay engine, to avoid a new `duelConstants → sentenceConstants` cross-dependency.)

### 3. `convex/relayDuel.ts` — picker guard, per-position timeout, new sentence mutations
- **`relayPick`**: if the picked position is a sentence, reject `hardUpgrade` (decision #3).
  Compute the scheduler delay from the picked kind, not the constant:
```ts
const item = duel.sessionWords[duel.wordOrder[wordIndex]];
const isSentence = item?.kind === "sentence";
if (hardUpgrade && isSentence) {
  throw new ConvexError({ code: "INVALID_STATE", message: "Sentence rounds can't be hard-upgraded" });
}
const windowMs = isSentence ? SENTENCE_RELAY_TIMEOUT_MS : RELAY_ANSWER_TIMEOUT_MS;
const scheduledId = await ctx.scheduler.runAfter(windowMs, internal.relayDuel.relayTimeoutInternal, {...});
```
- **`resolveRelayTimeoutIfStale`**: replace the `RELAY_ANSWER_TIMEOUT_MS` literal in the
  window-elapsed check with `relayAnswerWindowMs(duel)` so sentence positions don't time out
  at 15s.
- **New mutations** (the answerer's build interaction), each guarded for relay:
  `relaySentenceTap`, `relaySentenceRemoveLast`, `relaySentenceReset`, `relaySentenceConfirm`.
  Shared guard helper:
```ts
function assertRelaySentenceTurn(duel, playerRole) {
  assertDuelMode(duel, "relay", ...); assertActive(duel);
  if (duel.relayPhase !== "answer") throw INVALID_STATE;
  if (playerRole !== relayAnswerer(duel)) throw NOT_AUTHORIZED;
  const served = relayServedQuestion(duel);
  if (served?.kind !== "sentence") throw WRONG_QUESTION_KIND;
  return duel.relayAssignedIndex; // = questionIndex for the pure fns
}
```
  Tap/peel/reset reuse the existing pure fns from `sentenceGameplayRules.ts`
  (`appendSentenceTile`, `removeLastSentenceTile`, `clearSentenceBoard`) with
  `questionIndex = relayAssignedIndex`, `role = answerer`, then `ctx.db.patch`. No
  parameter changes needed — a sentence is always served from the base set
  (`duelQuestions[idx]`, since 🔥 is disabled), exactly what those fns already read.

  **`relaySentenceConfirm`** is the scoring point:
```ts
const questionIndex = assertRelaySentenceTurn(duel, playerRole);
const { patch: progressPatch, result } = confirmSentenceRound({ duel, questionIndex, role: playerRole });
if (!result.completed) {
  // Wrong Confirm: stay in the answer phase, they retry. Return the per-tile
  // mask (same as PvP) so the answerer sees which words are right/wrong.
  await ctx.db.patch(duelId, progressPatch);
  return { completed: false, correctnessMask: result.correctnessMask };
}
// Correct build (any number of tries within the timer): award the flat relay
// point and go to feedback.
if (duel.relayTimeoutScheduledFunctionId) await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
await ctx.db.patch(duelId, {
  ...progressPatch,
  relayPhase: "feedback",
  relayAnswerStartedAt: undefined,
  relayTimeoutScheduledFunctionId: undefined,
  relayLastResult: { wordIndex: questionIndex, chosen: "", correct: true, scorer: playerRole },
  ...(playerRole === "challenger"
    ? { challengerScore: duel.challengerScore + RELAY_QUESTION_POINTS }
    : { opponentScore: duel.opponentScore + RELAY_QUESTION_POINTS }),
});
return { completed: true, correctnessMask: result.correctnessMask };
```
  Note: relay sentences do NOT route through `answerSentenceRound`/`buildSentenceAnswerPatch`
  (that is the PvP/PvE both-answered advance path). Handoff continues via the existing
  `relayAdvance`/`relayTimeout` → `buildRelayAdvancePatch`/`buildRelayTimeoutPatch`, which are
  kind-agnostic and need no change. Timeout on a sentence = wrong = no point, same as a word.

### 4. `convex/duels.ts` — widen relay served DTO typing
`buildRelaySafeDuel` logic already works (masking handles sentence). Only the TS return
typing (`RevealedDuelQuestion | MaskedDuelQuestion`) must allow the sentence variants — it
already does via the unions. Confirm no `as` cast narrows it to word.

### 5. `app/duel/[duelId]/hooks/relaySessionTypes.ts` — widen `RelayServedQuestion`
Currently word-only. Add the sentence variants (revealed has `spanishSentence`, masked drops
it, both keep `tilePool`/`englishPrompt`):
```ts
export type RelayServedQuestion =
  | (WordBaseQuestion & { answerRevealedToViewer: true })
  | (Omit<WordBaseQuestion, "correctOption"> & { answerRevealedToViewer: false })
  | (SentenceBaseQuestion & { answerRevealedToViewer: true })
  | (Omit<SentenceBaseQuestion, "spanishSentence"> & { answerRevealedToViewer: false });
```

### 6. Extract a presentational sentence board, reuse in relay
`SentencePvpBoard` hardcodes `duel.currentWordIndex`, `viewerRole`, and the
`api.gameplay.*` mutations. Extract the **pure presentational** inner board
(`SentenceBuildBoard`): props = `tilePool`, `placedTileIndices`, `correctnessMask`,
`locked`, `secondsLeft`, `englishPrompt`, `themeName`, and handlers
`onTap/onRemoveLast/onReset/onConfirm`. PvP wires gameplay mutations + `currentWordIndex` and
passes the per-tile `correctnessMask` (its existing colored feedback). Relay wires the new
relay mutations + `relayAssignedIndex` + `answerer` role and passes the per-tile
`correctnessMask` returned by `relaySentenceConfirm` — so the board shows the **same green/red
colors as PvP** (decision #2). The board owns the mask clear-on-edit behavior via props (relay
clears the mask on any tap/peel/reset, same as PvP).

### 7. `app/duel/[duelId]/components/RelayDuelView.tsx` — branch answer surface by kind
- `promptAt(position)`: branch — word → `item.word`; sentence → `item.englishPrompt`.
- `RelayPickList`: hide the 🔥 Hard toggle on sentence rows (decision #3 — disabled in v1).
- Answer phase: if `served?.kind === "sentence"`, render the relay sentence board (reads
  `duel.relayServedQuestion.tilePool`, `duel.sentenceProgress` filtered by
  `(relayAssignedIndex, answerer)`, and the per-position 60s countdown) instead of the MC
  grid. The picker sees a read-only/locked board ("X is building a sentence…"). On feedback,
  show the revealed `spanishSentence`.
- The countdown uses `relayAnswerWindowMs`-equivalent on the client (anchored on
  `relayAnswerStartedAt`, see R8): read served kind → 60s vs 21s.

### 8. Relax the three guards + the modal clamp
- `convex/challenges.ts:208` — drop the relay+sentence rejection.
- `convex/helpers/sessionCreation.ts:271` — drop the relay+sentence rejection.
- `app/components/modals/ChallengeModal.tsx` — remove `relayLocked`/`hasSentenceTheme`
  clamp and the disabled-reason tooltip; Relay chip is always selectable.
- `lib/sentenceGameplay/mode.ts` — update the comment (relay now supported; relay uses
  build-and-confirm but does NOT go through `isBuildConfirmSentenceMode`, which only drives
  the non-relay `SentenceRoundView` routing — leave the function as-is).

---

## Risks / edge cases

- **R1 (designed out): dual question-set index mismatch.** If a sentence position could be
  🔥-upgraded, the served pool (`relayHardQuestions[idx]`) would differ from the pool the
  validator reads (`duelQuestions[idx]`) → tile indices wouldn't line up. Killed by decision
  #3 (🔥 disabled on sentences) + building identical sentence snapshots in both sets (§1). If
  🔥-on-sentences is added later, this re-opens and needs the served-question refactor.
- **R2: validator reads `duelQuestions`, not the served question.** The pure fns
  (`appendSentenceTile`, `confirmSentenceRound`) read `duel.duelQuestions[questionIndex]`
  directly. In a mutation that's the raw `ctx.db.get` doc (un-masked), so `spanishSentence`
  is present. And since sentences are never 🔥-upgraded, `duelQuestions[idx]` is exactly what
  was served. Safe — but only because of R1's resolution.
- **R3: the sentence pure fns don't check relay phase/turn.** They only check item kind +
  finalized/completed. The new relay mutations MUST add phase + answerer guards
  (`assertRelaySentenceTurn`) or the picker (or a stale client) could tap. Covered in #3.
- **R4: timeout window plumbing.** Four touch-points use the window: scheduler delay
  (`relayDuel.ts:117`), stale check (`relayDuel.ts:72`), client countdown
  (`useRelayCountdown` in `RelayDuelView.tsx`), and **the relay tests**
  (`tests/convex/relayDuel.test.ts` references `RELAY_ANSWER_TIMEOUT_MS`). All currently
  hardcode the 21s constant. Miss one → sentence positions time out at 21s instead of 60s.
  Server side: centralize in `relayAnswerWindowMs(duel)`. Client side: `useRelayCountdown`
  must be **widened to take the window length as a parameter** (it currently imports the
  constant directly) — the relay view passes 60s for a sentence served-question, 21s for a
  word. Tests that assert timeout timing need a sentence-window case added.
- **R8: countdown anchor mismatch.** `SentencePvpBoard`/`SentenceRoundBoard` drive their
  timer off `duel.questionStartTime` + `getEffectiveQuestionStartTime`. Relay never sets
  `questionStartTime` — it uses `relayAnswerStartedAt` (set per pick). If the extracted
  board reused the PvP timer logic it would read `undefined` and the countdown would stick
  at full time / never fire client-side (only the server backstop would resolve). The
  extracted board must take `secondsLeft` as a prop; relay computes it from
  `relayAnswerStartedAt` + the per-position window (reusing the existing `useRelayCountdown`,
  widened to take the window length).
- **R5: completion when the last position is a sentence.** Correct Confirm → feedback →
  answerer hits Continue → `relayAdvance` → handoff resolves the index → `isRelayFinished`
  flips → duel completes. Same path as words; no change. Timeout-last works too.
- **R6: stale relay challenges created before this ships.** They are word-only by
  construction, so relaxing the guards can't retroactively break them.
- **R7: self-duel.** Relay is never offered for self-duels today; this plan does not change
  that. Out of scope.

## Open product decisions (from design review — need a call)
- **P1 — anti-brute-force → ACCEPTED TRADEOFF (decision #2).** The exploit: free retries +
  the per-tile green/red correctness mask let a non-speaker permute to the answer (place →
  read colors → rearrange) on a short 1-distractor sentence. The settled product call is to
  **keep the per-tile mask** — it matches PvP and the learning feedback is worth more than
  closing this edge for v1. Scoring stays forgiving and retry-friendly, so the Confirm button
  keeps its familiar PvP meaning. The brute-force edge is a known, accepted v1 risk; tighten
  later with more distractors if it proves to matter in play.
- **P2 — picker idle time.** The watching player is passive for up to 60s during a sentence
  build (vs ~21s for words). Options: keep 60s; trim to ~40–45s; or give the picker a small
  live action. Default: keep 60s for v1 (simplest), revisit if pacing feels bad in testing.
- **P3 — sentence point value.** A sentence is 1 point, same as a word, despite more effort.
  Consistent with relay's flat-point model (even 🔥 words are 1 point). Options: keep 1
  (consistent); bump to 2. Default: keep 1 for v1.

Minor (acknowledged, no action for v1): two-tier difficulty (words 🔥-able, sentences not)
is the accepted §3 tradeoff; word-MC↔sentence-tile interaction switch mid-relay is variety,
not a bug; picker seeing live tiles can in theory infer the answer (same class as relay
words exposing the answerer's pick).

## Resolved decisions (was: open questions)
- **Q1 → live spectator.** Picker watches the answerer's board fill in live, same as relay
  words. Free via shipped `sentenceProgress` (see "Picker watching" above).
- **Q2 → 60s.** Sentence relay answer window = `SENTENCE_RELAY_TIMER_SECONDS` (60s).
- **Q3 → 🔥 disabled on sentences (v1).** Relay's only difficulty knob is the per-pick 🔥
  upgrade; for v1 it does not apply to sentences (toggle hidden, `relayPick` rejects it).
  This keeps the served pool == the validated pool, eliminating R1. Future option: 🔥 → +1
  distractor, which would need the served-question refactor (noted in decision #3).

## Confidence
High on the backend flow (turn engine, scoring, masking, index basis all verified against
source). With 🔥 disabled on sentences, the shared sentence functions are untouched and the
riskiest correctness point (R1) is designed out. Medium on the UI extraction effort —
depends on how cleanly `SentencePvpBoard` splits into a presentational board; the file mixes
server-progress reads, timer, and the gameplay mutations, so the extraction is the fiddliest
part. Estimated **2–4 focused days**.
