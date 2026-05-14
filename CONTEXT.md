# CONTEXT

Canonical glossary of domain terms for Language Duel. Use these definitions consistently across code, UI copy, docs, tests, and conversation. Implementation details belong in `docs/DOCUMENTATION.md`, not here.

---

## Duel

A two-player session built around a sequence of language questions. Players join a duel together and play until completion. Each duel has a fixed **mode** (PvP or PvE) chosen at creation, a difficulty preset, a theme, and a base 21-second per-question timer.

A duel cannot change mode mid-session.

## Mode

The top-level character of a duel. Two modes exist:

- **PvP (Player vs. Player)** — competitive. Players use **sabotages** to hurt their opponent.
- **PvE (Player vs. Environment)** — cooperative. Players use **hints** to help each other.

Mode is set by the duel creator and shown to the joiner as a normal duel setting.

## Question

A single multiple-choice prompt within a duel. Both players see the same question and answer independently on their own device. A question is "complete" once both players have committed an answer or their timers have expired.

## Difficulty

Per-duel preset that controls answer-option count and scoring weight:

- **Easy** — 1 correct + 3 wrong = 4 options
- **Medium** — 1 correct + 5 wrong = 6 options
- **Hard** — 1 correct + 4 wrong = 5 options, with the "None of the above" mechanic

Applies to both PvP and PvE.

## Sabotage (PvP only)

An action a player takes to disadvantage their opponent on a question (e.g., adding distractors, reducing time). Sabotages exist on a per-duel budget. The PvP experience is built around using them tactically.

Sabotages do not exist in PvE.

## Hint (PvE only)

An action that helps **both players** on the current question. Hints are drawn from a **shared hint pool** owned jointly by the two players. Firing a hint affects both players' question state regardless of who clicked it. The PvE experience is built around using hints generously and collaboratively.

Hints do not exist in PvP.

### The Four Hints

1. **50/50** — Trims wrong options down to: correct + 1 wrong. Easy: removes 2; Medium: removes 3; Hard: removes 3.
2. **+10 Seconds** — Adds time to both players' question timers. Combined with the universal +5s bump, total effect is +15s.
3. **Anagram** — Displays the correct answer's letters scrambled, beneath the question.
4. **Letter Count** — Displays the number of letters in the correct answer, beneath the question.

### Hint Rules

- **Pool:** 1 use of each hint type per duel (4 total uses possible).
- **Per-question cap:** maximum 1 hint may be fired per question.
- **Universal +5s:** every hint adds +5s to both players' timers in addition to its main effect.
- **No consent required:** either player may fire any hint at any time during a question.
- **No score penalty:** hints do not reduce the points earned for a correct answer.
- **Symmetric panels:** both players see the same hint panel and remaining-uses state on their own device, fully synced.

## Shared Hint Pool

The PvE-specific resource pool from which hints are drawn. Owned jointly by both players. Once a hint type is used, it is unavailable to both for the rest of the duel. The shared pool is the only mechanism gating hint use; there is no per-player budget, no score cost, and no consent step.

## Question Timer

The 21-second base countdown each player has to answer a question, run independently per player on their own device. Hints can extend the timer (see "+10 Seconds" and the universal +5s bump). A player whose timer expires without answering forfeits that question.

## Physical Co-presence (assumption)

The product is designed for **two players physically together** (couch co-op style), even though the connection is online. Players are assumed to be able to talk in person. This assumption justifies the absence of in-app coordination affordances in PvE: no consent prompts, no notifications, no chat, no onboarding tutorial, no "I need help" ping.

See `docs/adr/0002-physical-co-presence-assumption.md`.
