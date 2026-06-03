# Free Words — Plan

Let learners tap words in a Spanish sentence to keep them permanently
translated ("free words"). The author curates which words are given away in the
theme editor; in a duel those words appear as normal tiles but show their
English meaning underneath, so a learner is never blocked by "I don't know this
word."

Editor look = **Variant B (interlinear gloss above the word)**.
Duel look = **Variant 2 (glossed tiles — word still placed, meaning underneath)**.

A visual exploration mock lives at `/mocks/sentence-words` (route:
`app/mocks/sentence-words/`). It is NOT wired to anything and should be deleted
once this feature lands.

---

## Core reframe (why the idea is sound)

We are **not** aligning the English sentence and the Spanish sentence word-for-
word — that breaks on grammar differences (Spanish drops subjects, idioms don't
translate literally, word order flips, some words have no clean English twin).

Instead, each freed word gets a small **per-word, in-context hint** that stands
on its own. There are two separate English things on screen and they do NOT have
to agree word-for-word:

1. The **fluent prompt** (e.g. "I'm not hungry but I want coffee") — overall meaning.
2. The **per-word hints** — word recognition (e.g. `hambre` → "hunger", `pero` → "but").

The hints are read in Spanish order and are never reassembled into an English
sentence, so order/idiom mismatches don't matter. Because freeing is opt-in, the
author naturally frees the clean-mapping words (connectors, simple nouns/verbs)
and skips the messy ones.

One-line mental model: **"The sentence decides what each word means; the hint
gets to say it in plain words."** The English sentence stays the source of truth
for *meaning*; we only loosen the rule that a hint must be a literal slice of it.

---

## Decisions

| # | Decision |
|---|----------|
| 1 | AI generates a short English **meaning per Spanish word**, in the context of that sentence. |
| 2 | Generated automatically on the backend; placeholders if anything is missing. |
| 3 | Meanings are trusted as-is — no hand-editing. |
| 4 | Nothing is free by default; the author taps to free each word. |
| 5 | In duel, free words are still placed as tiles, with their meaning shown underneath (Variant 2). |
| 6 | Applies to all sentence-capable duel surfaces (PvP, Relay, Tag Team, self-duel). Normal solo practice is still word-only and is not included for sentence themes. |
| 7 | No scoring / difficulty change. |
| 8 | Concept name across the stack: **"Free words"**. |
| 9 | Meaning is the in-context sense, not a literal slice of the English sentence. |
| 10 | One meaning per single Spanish word. |
| 11 | No "peek all" toggle — the author leans on the fluent English prompt shown above. |
| 12 | Editing a sentence regenerates its meanings; clears free picks if the words changed. |
| 13 | Missing-meaning placeholder = the Spanish word itself. |
| 14 | Free words are theme-level (everyone playing the theme gets the same help), not per-player. |
| 15 | Repeated words are freed together within the same sentence. If the author taps one `que`, every matching `que` in that sentence becomes free, because the learner experience is "this word is gifted," not "this one physical tile is gifted." |

---

## What we're building (plain language)

When a sentence theme is created, the backend quietly writes a short meaning for
every Spanish word ("pero → but", "Quiero → I want"). In the theme editor, each
sentence gets a row of its Spanish words you can tap; tapped words light up and
show their meaning floating above. In the actual duel, those tapped words appear
as normal tiles but wear their English meaning underneath, so a learner is never
blocked by "I don't know this word."

---

## Build plan (phased)

### Phase 1 — Data
- Add two fields to a sentence round (`convex/schema.ts`,
  `lib/themes/sentenceTypes.ts`):
  - `wordMeanings` — one English meaning per Spanish word, in token order.
  - `freeWordPositions` — which word slots (token indices) the author freed.
- Token order = `tokenizeSpanishSentence(spanishSentence)` (whitespace split),
  so `wordMeanings[i]` and `freeWordPositions` reference the same indices.
- Add validation + normalization in `lib/themes/sentenceValidation.ts`:
  - `wordMeanings.length` must equal the token count when meanings are present.
  - `freeWordPositions` must be valid token indices, sorted/unique after
    normalization.
  - Meanings are trimmed; blank/missing entries become the Spanish token itself.
  - Repeated Spanish tokens are normalized as a group: freeing one occurrence
    stores all matching positions for that sentence.
- Mirror both fields onto the weekly-goal snapshot shape so locked goals carry
  the data (`convex/helpers/weeklyGoalSnapshots.ts`,
  `convex/weeklyGoalRepetitions/contentLoading.ts`).

### Phase 2 — Generation + auto-fill
- Extend the AI generation prompt + schema (`lib/generate/prompts.ts`,
  `lib/generate/schemas.ts`) so generation returns a meaning for each Spanish
  word, aligned in order. Instruction: "for each space-separated Spanish word,
  in order, give a short English meaning as used in this sentence."
- Split generation clearly by source:
  - AI-created sentence themes / generated-more rounds: the existing Next
    generation route returns `wordMeanings` with the round, so the editor has
    meanings before the draft is saved.
  - Manually-added or edited saved rounds: the Convex save mutation stores a
    valid placeholder shape immediately (Spanish-token placeholders where needed)
    and schedules a Convex action to refresh `wordMeanings` asynchronously.
  - The refresh action reads the latest saved sentence text before applying
    results. If the text changed while the AI call was running, skip that stale
    result instead of patching old meanings onto new text.
  - If the AI call fails or the count doesn't match the token count, keep/fill
    placeholders (the Spanish word itself, per #13).
- On save (`convex/themes/mutations.ts`):
  - If the Spanish text changed → replace meanings with placeholders, clear free
    picks, and schedule regeneration.
  - If only the English changed → keep free picks, replace meanings with
    placeholders, and schedule regeneration. Token positions are still valid.
  - If only distractors changed → keep meanings and free picks.

This is not a permanent old-shape compatibility path. Missing/stale meanings are
repaired by save/generation behavior; once the feature is live, stored sentence
rounds should have the new shape.

### Phase 3 — Theme editor UI (Variant B)
- In `SentenceRoundCard.tsx`, below the existing Spanish field, add a
  **"Free words"** interlinear strip: the sentence's words as tappable chips;
  tapping toggles free; freed words show their meaning floating above (dotted
  underline on the rest). No "peek all" toggle (#11).
- Editing the sentence *text* stays on the existing field tap — freeing is a
  separate gesture, so the two don't collide.

### Phase 4 — Carry into gameplay
- Extend the session item + duel question snapshot (`convex/schema.ts`,
  `lib/sentenceGameplay/engine.ts` `buildSentenceQuestionSnapshot`) so each
  shuffled tile carries its meaning when it is a freed word (distractors carry
  none). Build tiles as `{text, meaning?}` before the seeded shuffle so the
  meaning rides along with the right occurrence, then expose a parallel
  `tileMeanings: (string | null)[]` aligned to `tilePool`.
- Confirm it passes the answer-masking boundary safely
  (`convex/duels.ts` → `buildViewerSafeDuel`). Meanings are hints, not the answer
  order, so they are safe to send to the client.

### Phase 5 — Duel board UI (Variant 2)
- In `SentenceBuildBoard.tsx`, render the meaning under a tile when present, with
  the subtle accent ring.
- `tileMeanings` rides on the server-built viewer-safe `question` DTO, so thread
  it through that path rather than treating every view as a direct board caller:
  - **3 direct board callers** render `SentenceBuildBoard` and pass
    `tileMeanings` to it: `SentenceBoard` (PvP), `TurnByTurnView` (Tag Team),
    `RelayDuelView` (Relay).
  - `SentenceRoundView` is a wrapper one level up: extend its `question` type and
    pass the DTO straight down into `SentenceBoard` (it does not call the board
    itself).
  - Add `tileMeanings` to the viewer-safe question in `convex/duels.ts`;
    `SentenceBoard` reads it off the `question` DTO, while `TurnByTurnView` and
    `RelayDuelView` build their own tile pool and pass `tileMeanings` directly.

### Phase 6 — Tests + validation
- Update / add tests: meaning-to-word alignment, snapshot tile-meaning mapping,
  editor freeing toggle, board gloss rendering, regenerate-on-edit.
- Run eslint, `npm run typecheck`, `npx tsc --noEmit -p convex/tsconfig.json`,
  and the touched test files before handoff.

---

## Known trade-offs (accepted)

1. **Freed tiles are slightly "marked."** Because a freed word shows a meaning
   and distractors don't, a player can tell a glossed tile is definitely a real
   word in the sentence. This is inherent to the feature (you are gifting that
   word) and matches the intent, so it's accepted.
2. **The exploration mock at `/mocks/sentence-words`** stays untouched during the
   build; delete that route as cleanup once the real feature lands (ask first).

---

## Open question before coding

- Build it all in one pass, or stop after Phase 3 (editor) for a look before
  wiring the duel side?
