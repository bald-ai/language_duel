# Sentence Duel — Two Versions to Test

**Status:** Product exploration. Not yet decided. We will build and test two
fundamentally different versions, and iterate *within* each.

## Why this doc

The current sentence duel works, but it doesn't feel right yet. Before polishing,
we want to settle a more fundamental question: **how should two players relate to
the sentence they're building?** There are two genuinely different answers, and
they lead to different feel, different fun, and different code. We test both.

---

## Version A — Independent boards (what we have today)

Each player gets their **own** copy of the sentence and their **own** tile pool.
They build it on their own, in parallel, racing against the clock.

- Two boards, two sentences-in-progress, one per player.
- No interaction between the players during the round — you don't see or affect
  the other person's board.
- The round ends when both have submitted (finished or timed out).
- Feels **competitive / parallel**: "we're both doing the same task, who does it
  cleaner and faster."

## Version B — Shared board, take turns (the coop idea)

Both players build **one shared sentence together**, alternating taps.

- P1 taps the first word → P2 taps the next word → P1 taps the next → and so on.
- One board, one sentence-in-progress, visible to both.
- Each person is responsible for "their" positions in the sentence; a wrong tap
  by either player affects the shared result.
- Feels **cooperative / collaborative**: "we're building this together, don't
  mess up your turn."

**The hypothesis:** Version B may be more *enjoyable as a coop experience* — the
back-and-forth of taking turns on the same sentence could be more engaging and
social than each person quietly racing on their own board.

**Decided:** Version B does **not** apply to Solo. Taking turns requires two
players; with one person filling both sides there is no turn to pass. Solo always
uses Version A.

---

## What's the same across both

- Tap word tiles in order to assemble the Spanish translation of an English prompt.
- Server-authoritative: the server tracks the placed sequence and mistakes; the
  client can't fake completion.
- Scoring intent stays on the same scale (clean / messy / didn't finish).

## What differs (the fork)

| | Version A (current) | Version B (shared, turn-taking) |
|---|---|---|
| Boards | One per player | One shared |
| Interaction during round | None | Constant — you alternate taps |
| Feel | Competitive / parallel race | Cooperative / collaborative |
| Whose mistake counts | Only your own | Either player's, on the shared sentence |
| Pacing | Both go at once | Turn-by-turn, gated on the other person |

---

## Open questions to resolve while testing

These are the things each version will force us to decide. We'll iterate on them
*within* each version.

**Version A (iterate within):**
- Is the parallel race fun, or does not-seeing-the-opponent feel lonely?
- Should you see the opponent's progress (e.g. "they've placed 3/6")?

**Version B (iterate within):**
- Whose turn is it — how do we make that crystal clear on screen?
- What happens if the player whose turn it is stalls or times out? Does the turn
  pass? Does the round end? Does the other player get to take over?
- How is scoring split or shared when it's one sentence built by two people?
- Does turn-taking apply to PvE/boss, or PvP only? (Solo is ruled out — see below.)
- Whose tile pool is it — shared pool, or do players only see their own options?

**Cross-cutting:**
- How does each version behave across the existing modes (PvP, PvE/boss, Solo)?
  - **Solo: Version B does not apply — only one player, no turn to pass. Solo is
    always Version A. (Decided.)**
- Timer: per-player vs per-turn vs whole-sentence.

---

## Testing plan (fill in as we go)

1. [ ] Get Version A to a clean, testable state (UI now matches the word-duel look).
2. [ ] Build Version B behind a toggle so we can switch between them.
3. [ ] Playtest both, same themes, back to back.
4. [ ] Capture notes on feel, confusion points, and fun per version.
5. [ ] Decide: keep one, keep both as options, or merge the best of each.

---

## PvP Sentence Mode — interaction + scoring (decided)

The build-and-confirm interaction we prototyped (see
`Dev/sentence_build_confirm_prototype.html`, **Variant 1**) is the **PvP** sentence
experience. It is also the likely interaction we reuse if/when we add **Relay**
support for sentences. (Solo and PvE are out of scope for this mode — see below.)

### Interaction (Variant 1)
- Tap word tiles in any order to build the sentence — **no checking per tap**.
- Each placed tile shows an **order-number badge**.
- **Removal is last-only**: only the most recently placed tile can be removed
  (tap it again — it carries an ✕ badge). Earlier words can't be pulled out of
  the middle; you peel back from the end.
- **Confirm** verifies the whole sentence at once. Correct tiles turn green,
  wrong tiles turn red. No separate readout box and no feedback banner — the
  feedback lives on the tiles.
- After a Confirm, you can keep editing (peel + re-Confirm) until correct or time runs out.

### Scoring ladder

The competitive twist: getting it wrong can cost you points, but the punishment
is capped.

| Mistakes this round | Points |
|---|---|
| 0 (correct first try) | **+1** (clean win) |
| 1 | **0** |
| 2 or more | **−1** (floor — never worse than this) |

- The floor is **−1**. No matter how many mistakes, you never lose more than 1 point.
- A clean first-try is worth **+1**. *(Decided — not the +2 the word/old-sentence
  scheme used.)*

> **Decided:** a "mistake" = **one failed Confirm attempt** (you hit Confirm and the
> sentence was wrong) — not per-word. This fits the build-then-check loop.

### Mode scope
- **PvP:** uses this interaction + this scoring. (This mode.)
- **Relay:** future reuse of the same interaction once relay supports sentences.
- **Solo / PvE:** **not** part of this mode. They keep the current sentence flow
  for now; whether they migrate to build-and-confirm is a separate decision.
  (Negative scoring in particular doesn't obviously belong in a solo practice.)

---

*Created during product discussion. Implementation plan for the PvP mode lives in
`Dev/pvp_sentence_mode_implementation_plan.md`.*
