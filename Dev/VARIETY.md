# Variety — design notes (parked)

**Status: Parked.** This file is not a task list or committed backlog. It captures **clarity from usage and discussion**: the app feels samey when every round is English → Spanish, and two useful axes for future ideas are **depth of language testing** (sentences, audio, richer context) versus **gamification / format** (same vocabulary, different interaction). Individual bullets ship only when pulled into a separately scoped piece of work.

## Problem (context)

All current exercises follow the same pattern: see English word → produce Spanish translation (across 4 levels). After ~100 words the experience feels repetitive. GF specifically requested sentences.

## Reference exercise shapes (not a backlog)

### Direction Reversal

- **Spanish → English** — Show the Spanish word (e.g. "tiburón"), type or pick the English translation ("shark"). Zero new content needed, doubles what you can do with existing themes.

**Implementation constraints (as of now)**

- **Free typing** is the natural fit (same L2-typing / L3-style inputs as forward mode; cue and expected string are swapped). Guided letter-by-letter slots are a poor match for English cues and add little value here.
- **Multiple choice in the reversed direction is not supported by current theme data.** Each word has `wrongAnswers` as distractors for the **Spanish** correct answer only. There are no pre-generated wrong **English** options per word, so Spanish → English MC cannot reuse the existing wrong-answer list without new generation (or another distractor strategy, e.g. pooling other English words from the same theme — that would be a separate design).

### Sentence Exercises

- **Fill the blank** — "El ___ nada en el océano" → pick/type "tiburón". Uses existing words in context. Needs AI generation per theme.
- **Unscramble** — Given jumbled Spanish words from a sentence, put them in correct order. Tests grammar intuition, not just vocabulary.
- **Pick the correct sentence** — Multiple choice but with full sentences instead of single words. Tests reading comprehension.
- **Spot the error** — "El tiburón nada en la océano" → tap the wrong word. Tests grammatical awareness (articles, conjugation, gender).

### Pressure / Pacing

- **Speed round** — Rapid-fire L2 multiple choice, ~5 seconds each, score as many as you can. Same data, different pressure. Good for the boss round.

### Memory / Association

- **Match pairs (grid)** — 6-8 cards, half English / half Spanish. Tap two → if they match (shark ↔ tiburón), they stay revealed. Clear the board. Different cognitive exercise (memory + association vs. recall). Works great on shared screen for couch co-op. Uses existing theme data, zero new content.

### Boss Round

- Random mix of all the above exercise types across all themes learned that week. The variety IS the boss — you never know what's coming next.

---

## Future (Not Now)

These are parked until prerequisites are met.

### TTS-Dependent

> Blocked by: TTS quality not good enough yet. Close, but needs update — new provider versions likely available.

- **Audio-first rounds** — Hear TTS, pick or type what you heard. Tests listening comprehension.
- **Dictation** — Hear a full sentence via TTS, type what you heard.

### Spoken Word (Mic Input)

> Blocked by: Needs speech recognition integration.

- **Pronunciation practice** — Hear the word, say it back, get feedback on pronunciation via mic.

### Full Sentence Translation

> Blocked by: Too hard for current skill level. Add when users are more advanced.

- **Translate full sentence** — "The shark swims in the ocean" → type the full Spanish translation.
