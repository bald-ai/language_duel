# Solo Sentences — Plan

Bring sentence themes into the normal **Solo Practice** button flow as a sibling
of solo word practice, reusing the same two-phase shell (Study/Learn →
Practice). The sentence twist: a level means **how many words are blanked out**.
You climb by filling the blanks; the top rung is the whole sentence built from
scratch.

Scope is intentionally narrow for MVP:

- **In scope:** normal ad-hoc solo launched from the Solo Practice button,
  including mixed word + sentence theme selections.
- **Out of scope:** boss solo practice, weekly-goal solo practice, and
  spaced repetition. Keep their existing word-only guards.

Today the normal solo loader hard-blocks sentence items in
`app/solo/hooks/useSoloSessionSource.ts`. Persisted solo sessions also block
sentence items in `convex/helpers/sessionCreation.ts`, but that Convex guard
stays for this MVP because boss/SR are out of scope.

**Visual mock:** file:///private/tmp/solo-sentences.html — Study screen +
Practice screen with two looks (**Slots** and **Highlighter**). Use **Slots**
for MVP; the mock is reference only.

---

## Core idea (how it maps to word practice)

Word practice already has a mastery ladder per item
(`lib/soloPracticeRuntime.ts`): `masteryLevel: 0|1|2|3`, climb on correct / drop
on wrong, confidence in the Learn phase sets the starting mastery, and a pool
expands as items get mastered.

For sentences, do **not** force the existing word Level 0/1/2/3 UI to fit.
Instead, share the solo shell and mixed-deck pool, but add a custom sentence
runtime/card. For **words**, a level still means _input difficulty_ (read →
multiple choice → typing → strict typing). For **sentences**, a level means
_blank count_:

| Axis | Words (today) | Sentences (this MVP) |
|------|---------------|----------------------|
| What scales | input mode (read → MC → type) | number of blanked words |
| Easiest rung | recognize | 2 words blanked |
| Hardest rung | type it cold | every word blanked (build from scratch) |

One-line mental model: **"More rungs = more of the sentence is taken away, until
you're building the whole thing."**

Sentence progression is deliberately simpler than word practice. Words keep
their current freshness randomness and occasional two-rung promotion. Sentences
do **not** use that randomness: a correct sentence answer below its max moves up
exactly one rung, a correct answer at max completes the item, and a wrong answer
drops one rung with a floor of 0. This keeps blank growth easy to understand.

This is deliberately a bit repetitive (every rung is the same fill-the-blanks
interaction, just with more gaps). Accepted for MVP — no distractors, no
input-mode change. We can layer harder input later.

---

## The one rule that matters: cap short sentences

A sentence can't have more blanks than it has words, so the ladder must stop at
"build from scratch" and **show that final rung exactly once**. We must never
render L1/L2/L3 as the same full-build card.

Let `N = tokenizeSpanishSentence(spanishSentence).length`.

- **`maxLevel = Math.max(0, Math.min(3, N - 2))`** — the item's own ceiling
  (clamped into the 0–3 frame the solo shell uses).
- **`blanksForLevel(level)`** =
  `level >= maxLevel ? N : Math.round(2 + level * (N - 2) / maxLevel)`
  - the bottom rung is always **2 blanks**, the top rung is always the **full
    build** (`N` blanks);
  - the rungs between grow in **even steps**, so the gap count climbs steadily
    instead of staying flat then jumping at the end — mirroring how word levels
    escalate evenly.

Worked examples:

| N (words) | maxLevel | blanks per rung |
|-----------|----------|-----------------|
| 3 | 1 | L0: 2 → **L1: 3 (full)** |
| 4 | 2 | L0: 2, L1: 3 → **L2: 4 (full)** |
| 5 | 3 | L0: 2, L1: 3, L2: 4 → **L3: 5 (full)** |
| 6 | 3 | L0: 2, L1: 3, L2: 5 → **L3: 6 (full)** |
| 9 | 3 | L0: 2, L1: 4, L2: 7 → **L3: 9 (full)** |

So a 3-word sentence tops out at "L1," a 5+-word sentence uses the full 0–3
ladder, and longer sentences spread their gaps evenly across the rungs instead of
dumping them all onto the last step. **Each sentence's ceiling is set by its own
length** and the climb is clamped to `maxLevel` everywhere (question pick,
level-up, confidence start). Sentence Level 0 is still a cloze/build card, not the
word "Got it / Not yet" recognition UI.

**Blank selection must be nested.** Blanks at level `L+1` are a superset of level
`L`, so climbing only ever _removes more_ words, never swaps them around. Compute
once a seeded priority order of token positions (use `hashSeed` from
`lib/prng.ts`), then `blanksForLevel(level)` takes the first _k_ positions from
that order. Top rung = all positions.

---

## Decisions

| # | Decision |
|---|----------|
| 1 | Normal Solo Practice gains a sentence path under the Solo Practice button. Boss solo, weekly-goal solo practice, and spaced repetition stay word-only for MVP. |
| 2 | Support mixed word + sentence selections in one normal solo run; do not silently filter either kind. |
| 3 | A sentence level = blank count. Easiest = 2 blanks, hardest = full build. |
| 4 | Use custom sentence runtime/card behavior instead of the word Level 0/1/2/3 inputs. Share the solo shell, selection pool, progress, and Learn → Practice navigation. |
| 5 | Blank growth is nested (a superset each rung), seeded + deterministic; the gap **count** climbs in even steps (2 → … → N), matching how word levels escalate. |
| 6 | **No distractors in the bank** for MVP — the bank is exactly the blanked words. |
| 7 | The meaning hint (existing `wordMeanings`) shows **on a bank chip**, and only when that word is a **free word** (`freeWordPositions`). Pre-placed words show nothing. |
| 8 | Study shows the full English prompt + full Spanish sentence and a confidence slider; no sentence TTS in MVP. |
| 9 | Fill is in sentence order (fill the next open blank); wrong chip shakes, no text feedback. |
| 10 | Practice uses the **Slots** look from the mock; drop the Slots/Highlighter toggle. |
| 11 | `maxLevel = Math.max(0, Math.min(3, N - 2))`; the climb is clamped per sentence so short sentences cap and never duplicate the full-build rung. |
| 12 | Sentence mastery is deterministic one-rung progression. Word mastery keeps its existing randomness. |

---

## What we're building (plain language)

A learner clicks **Solo Practice**, picks word themes, sentence themes, or both,
and enters the normal solo Learn → Practice flow. First a **Study** pass: each
sentence shows its English prompt, full Spanish sentence, and confidence slider.
Then **Practice**: sentence cards appear with some words removed and a small word
bank below. Fill the blanks; get it right and more words disappear next time; get
it wrong and one comes back. Short sentences quickly reach "build the whole
thing" and stop there; longer sentences climb further. A bank word that was
_gifted_ in the theme editor shows its English meaning underneath, so you're
never stuck on vocab.

---

## Build plan (phased)

### Phase 1 — Scope gates + mixed item plumbing
- In `app/solo/hooks/useSoloSessionSource.ts`, allow mixed `SessionItem[]` only
  for the normal Solo Practice button flow (`!soloPracticeSessionId &&
  !weeklyGoalId`).
- In `app/HomePageClient.tsx`, stop filtering sentence themes before passing
  themes to `SoloPracticeModal`. Keep the weekly-goal filter in
  `app/goals/components/GoalPracticeModalHost.tsx` unchanged.
- Keep persisted solo sessions word-only for this MVP:
  - do **not** remove the sentence guard in `convex/helpers/sessionCreation.ts`;
  - keep boss solo and spaced repetition sentence rejection behavior;
  - if a persisted/weekly source returns sentence items, surface a clear error.
- Thread mixed items through the normal solo Learn/Practice hooks. Prefer
  `sessionItems`, `itemStates`, `itemIndex`, `currentItemIndex`,
  `completedMaxLevel`, and `answeredExpansionGate` in touched code instead of
  adding more sentence logic under `word*` names.
- Do not silently filter mixed decks. If the user selects word + sentence themes,
  both kinds appear in the same run.

### Phase 2 — Shared solo state + custom sentence runtime
- Keep the word question behavior as-is, but make the shared solo state
  item-aware:
  - words: `maxLevel = 3`, current Level 0/1/2/3 inputs stay unchanged;
  - sentences: `maxLevel = sentenceMaxLevel(tokenCount)`, custom cloze card.
- Make question-level picking kind-aware:
  - words keep the existing `pickSoloQuestionLevel` randomness;
  - sentences use the current mastery level directly, clamped to that sentence's
    `maxLevel` — no random one-rung-above question.
- Add pure sentence helpers in a new `lib/soloSentenceRuntime.ts`:
  - `sentenceMaxLevel(N)` → `Math.max(0, Math.min(3, N - 2))`;
  - `blanksForLevel(level, N)`;
  - `sentenceBlankPositions(spanishSentence, level)` → nested, seeded position
    set using `tokenizeSpanishSentence` + `hashSeed` from `lib/prng.ts`;
  - sentence mastery update helpers: correct below max climbs one rung, correct
    at max marks `completedMaxLevel`, wrong drops one rung but never below 0.
- Make pool expansion max-level-aware:
  - words keep the current "answered Level 2+" meaning;
  - sentences set `answeredExpansionGate` after a correct answer at
    `Math.min(2, maxLevel)` or after completion if their max is lower.
- Completion means every item is answered correctly at its own max level. A
  2-word sentence can complete at sentence Level 0 because Level 0 is a real
  cloze/full-build card for sentences.

### Phase 3 — Solo sentence question shape
- Add a solo cloze builder in `lib/soloSentenceRuntime.ts`: given a sentence item
  + level, return:
  - token list with blanked positions marked;
  - bank = exactly the blanked tokens, with no distractors;
  - per-bank-chip meaning when the token is a free word
    (`freeWordPositions ∩ blanked → wordMeanings[i]`).
- Validation: the filled sequence must equal the correct tokens at the blanked
  positions after the existing normalize-for-comparison logic.

### Phase 4 — Study phase (Learn screen)
- In `app/solo/learn/[sessionId]/`, branch by `item.kind`:
  - words keep the existing `WordCard`;
  - sentences render a new `SentenceStudyCard`.
- `SentenceStudyCard` shows number badge, theme label when relevant, English
  prompt, full Spanish sentence, and `ConfidenceSlider`.
- Add max-level support to `ConfidenceSlider` / set-all confidence controls, and
  clamp each item's confidence to its own `maxLevel`, including decoded
  `confidence` URL values when Practice starts.
- Make reveal controls mixed-safe:
  - word cards keep their existing letter/full-answer reveal behavior;
  - sentence cards always show the full sentence;
  - global Reveal All / Hide All affects word cards only, and is hidden for
    sentence-only decks.
- No sentence TTS in MVP.

### Phase 5 — Practice phase (Practice screen)
- In `app/solo/[sessionId]/components/`, branch by `item.kind`:
  - words keep `SoloQuestion`;
  - sentences render a new `SentenceClozeQuestion`.
- Use the **Slots** look from the mock. Do not ship a Slots/Highlighter toggle.
- `SentenceClozeQuestion` shows level badge, English cue, sentence slots, and
  word bank with per-chip meaning hints. Tap fills the next open blank; correct
  placements go green; wrong chip shakes with no text feedback.
- Bank chips must have stable IDs that include their source token position so
  repeated Spanish words remain distinct even when the visible chip text is the
  same.

### Phase 6 — Progress + completion wiring
- `masteredCount` counts items completed at their own max level.
- Rename mixed-deck UI/copy in touched surfaces from word-only language to
  item-safe language:
  - `SoloPracticeModal`: `words total` → mixed-aware `items total`;
  - `CompletionScreen`: `Words Mastered` / `totalWords` → item-safe naming/copy.
- Plain normal solo stays client-only. `useSoloCompletionReporting` remains for
  persisted boss/SR sessions and should not gain sentence-reporting behavior in
  this MVP.
- Existing word-only completion reporting stays unchanged because boss/SR remain
  word-only.

### Phase 7 — Tests + validation
- Unit-test sentence difficulty math: `maxLevel` per N, `blanksForLevel`
  monotonic and ending at N, nested superset growth, short-sentence cap, and
  confidence clamping.
- Unit-test the cloze builder: bank = blanked tokens, meanings only on free-word
  chips, and correctness validation.
- Update affected solo tests:
  - normal `useSoloSessionSource` accepts mixed items;
  - persisted/weekly/boss/SR paths still reject or filter sentences according to
    current scope;
  - mixed Learn and Practice pages render the correct card for each item kind;
  - `useSoloSession` completes short sentence items without getting stuck at
    word Level 0 behavior.
- Run eslint, `npm run typecheck`,
  `npx tsc --noEmit -p convex/tsconfig.json`, and the touched test files.

---

## Known trade-offs (accepted)

1. **Repetitive interaction.** Every rung is the same fill-the-blanks gesture
   with more gaps — no input-mode escalation like words have. Fine for MVP.
2. **Even-step gaps ramp earlier rungs sooner.** Because long sentences spread
   gaps evenly (e.g. 9 words → 2, 4, 7, 9) rather than easing in, rung 2 of a long
   sentence already blanks several words. Chosen on purpose to match how word
   levels escalate; if it feels harsh later, the curve is a one-function swap.
3. **No sentence TTS.** Study shows the full sentence as text only for MVP.
4. **Normal Solo Practice only.** Boss solo, weekly-goal solo practice,
   and spaced repetition stay word-only until separately planned.
5. **The mock** (file:///private/tmp/solo-sentences.html) is a reference prototype, not production code.

---

## Open questions before coding

None. Current choices: normal Solo Practice only, mixed decks supported, custom
sentence runtime, deterministic one-rung sentence progression, Slots UI,
even-step gap spread, no sentence TTS.
