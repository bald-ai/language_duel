# Plan — Unify sentence PvE/PvP on build-and-confirm, then add the PvE hint pool

## Revised goal
Make sentence rounds work like **word** rounds: **one shared structure** for every mode, with
the *only* difference being the tools layer.

- **Structure (all modes): build-and-confirm, built strictly in order.** Tiles fill slot 1,
  then 2, then 3 … (append-only: a tap goes to the next open position), peel the last, verify
  the whole sentence on Confirm. No per-tap correctness check. This is already what PvP and
  self-duels do today; we extend it to real two-player PvE (and boss PvE), retiring the per-tap
  validation model entirely.
- **Tools differ, same as words:**
  - **PvE → cooperative hint pool** (the 3 hints below).
  - **PvP → sabotages** (the symmetric counterpart — see Part C; all four ship, designed).

The three PvE hints (unchanged from our discussion):
1. **Freeze time (+30s)**
2. **Remove a distractor**
3. **Mark 2 correct tiles + reveal their slot**

Same team-state semantics as the word hint pool: one shared pool per duel, either player fires,
the effect hits both boards, no consent, one hint per question.

**UX prototypes (decisions locked):** the "mark 2 tiles" look and its Reset/Peel behavior were
prototyped in `Dev/sentence_hint_mark_tiles_prototype.html` (visual options) and
`Dev/sentence_hint_reset_interaction_prototype.html` (interaction options). Picks: **strict
in-order placement**, reveal behavior = **"Active next-step"** (persistent marks + a pulse on
the next-due tile), and the working visual = **top-right amber corner badge**. Full rules in B9.

---

## Current state (what we're changing)

- `SentenceRoundView.tsx:130` forks on `isBuildConfirmSentenceMode(duel)`:
  - **true** (`pvp` OR self-duel) → `SentencePvpBoard` — build-and-confirm.
  - **false** (real two-player `pve`, boss) → `SentenceRoundBoard` — per-tap, each tap
    validated server-side.
- `isBuildConfirmSentenceMode` (`lib/sentenceGameplay/mode.ts:20`) = `duelMode === "pvp" || isSelfDuel(duel)`.
- Per-tap server path: `tapSentenceTile` mutation → `applySentenceTap`
  (`convex/rules/sentenceGameplayRules.ts:71`), scored by `scoreSentenceSubmission` (clean/messy
  2/1/0), lives via `getSentenceLivesPatch`.
- Build-confirm server path: `appendSentenceTile` / peel `removeLast` / `confirmSentenceRound`
  → scored by `scorePvpSentenceSubmission` (ladder 1/0/-1), lives via `getLimitedLivesMissPatch`.
- `buildSentenceAnswerPatch` (`sentenceGameplayRules.ts:477`) already branches on
  `isBuildConfirmSentenceMode`.
- Timers: `SENTENCE_PVE_TIMER_SECONDS = 90` (per-tap), `SENTENCE_PVP_TIMER_SECONDS = 60`,
  `SENTENCE_SELF_DUEL_TIMER_SECONDS = 60`; chosen in `pickTimerSeconds`.
- **No footer tools exist on sentence rounds today** — neither hints nor sabotages
  (`SentenceRoundView.tsx:67` comment).

---

## Part A — Unify everything on build-and-confirm

**A1. `lib/sentenceGameplay/mode.ts`** — make build-and-confirm the only sentence model.
`isBuildConfirmSentenceMode` returns `true` for all sentence duels (or delete the helper and
its callers' branches). Update the file's doc comment.

**A2. `SentenceRoundView.tsx`** — always render the build-and-confirm board. Delete the
per-tap branch (lines 138–146) and the `SentenceRoundBoard` component (lines 152–end). Rename
`SentencePvpBoard` → `SentenceBoard` since it is now mode-agnostic.

**A3. Retire the per-tap server path (now dead):**
- `convex/gameplay.ts`: **KEEP the `tapSentenceTile` mutation** — it is the shared placement
  entry point the board calls (`SentencePvpBoard.tsx:67`) and it internally branches on
  `isBuildConfirmSentenceMode` to call `appendSentenceTile`. Just delete its per-tap branch (the
  `applySentenceTap` call at `gameplay.ts:~217`) so it always appends. (Round-4 blocker: do not
  delete the mutation itself.)
- `convex/rules/sentenceGameplayRules.ts`: remove `applySentenceTap`, and the per-tap scoring
  helpers used only by it (`scoreSentenceSubmission`, `readServerSubmission`,
  `getSentenceLivesPatch`). Keep `appendSentenceTile`, `removeLast`, `confirmSentenceRoundRule`,
  `scorePvpSentenceSubmission`.
- `lib/sentenceGameplay/engine.ts`: remove the pure `tapSentenceTile` helper (used only by the
  per-tap tests; not imported by production client code).
- `buildSentenceAnswerPatch`: drop the `else` (per-tap) branch — build-confirm is the only path.
- `convex/gameplay.ts`: the peel/reset/confirm mutations guard with `requireBuildConfirmMode`
  (~lines 227, 247, 273, 302). After unification these can never throw — delete the helper and
  the guards as dead code (Round-5 cleanup; not a blocker).

**A3-tests. Test impact (Round-4 scope catch):** the unification removes ~30 per-tap test
cases. Delete/rewrite:
- `tests/convex/sentenceGameplayRules.test.ts`: `describe("scoreSentenceSubmission")` (~5),
  `describe("applySentenceTap …")` (~8), `describe("buildSentenceAnswerPatch — legacy per-tap
  scoring (PvE / Solo)")` (~7).
- `tests/lib/sentenceGameplay/engine.test.ts`: the `tapSentenceTile` suite (~10).
Add new coverage: build-confirm scoring applies to PvE; `fireSentenceHint` effects; reveal
duplicate-word matching; timer-bonus clamp.

**A4. Timer** — one duration for all sentence modes. Keep 60s (today's PvP/self value); delete
`SENTENCE_PVE_TIMER_SECONDS` and collapse `pickTimerSeconds` to a single constant.
`pickTimerSeconds` is currently **duplicated** in `SentenceRoundView.tsx:54` and
`SentencePvpBoard.tsx:41` — consolidate to one (a shared constant, now that there is no
per-mode branch). *(Tuning: PvE used to get 90s; the +30 freeze hint plus build-and-confirm's
free reset/peel compensates. Adjust the single constant if 60s feels tight.)*

**A5. Scoring** — all sentences use the build-confirm ladder `scorePvpSentenceSubmission`
(0 fails → +1, 1 fail → 0, 2+ → −1). **Decision (Issue S1):** the −1 floor is competitive in
spirit; for co-op PvE consider flooring at 0. Recommend keeping the ladder identical for true
symmetry and only revisiting if PvE feels punishing.

**A6. Boss / spaced-rep PvE** — these were per-tap; they become build-and-confirm too. Lives
now deduct via `getLimitedLivesMissPatch` (build-confirm) instead of the per-tap path. Verify
the boss lifecycle and lives flow against the build-confirm submission. *(Was called out in the
old `mode.ts` comment as "boss keeps per-tap" — that assumption is being removed.)*

After Part A, the board, timer, scoring, and submission are identical across PvE/PvP/self.
Only the footer tools differ.

---

## Part B — PvE hint pool on the unified build-and-confirm board

Because the board is now build-and-confirm only, all the old per-tap reveal hazards disappear:
tiles are placed in any order, so a "slot N → tile" reveal is always coherent and never forces
a mistake.

### B1. `lib/sentenceGameplay/hints.ts` (NEW) — pure types + resolver

```ts
export const SENTENCE_HINT_TYPES = ["freeze_time", "remove_distractor", "reveal_tiles"] as const;
export type SentenceHintType = (typeof SENTENCE_HINT_TYPES)[number];

// Every sentence hint grants this universal time bump (mirrors the word pool's
// +5, scaled up for the longer 60s sentence round). Decision Q5.
export const SENTENCE_HINT_UNIVERSAL_TIMER_BONUS_SECONDS = 10;
// The freeze hint adds this ON TOP of the universal bump → 10 + 20 = 30s total.
export const SENTENCE_HINT_FREEZE_EXTRA_SECONDS = 20;
export const SENTENCE_HINT_REVEAL_COUNT = 2;
export const SENTENCE_HINT_POOL_SIZE = SENTENCE_HINT_TYPES.length; // 3

// Keyed by POSITION (slot), not a single tile: repeated words make several
// pool tiles equally valid for one slot. `tileIndices` lists every pool tile
// whose normalized text fills this slot.
export type SentenceTileReveal = { position: number; tileIndices: number[] };

export type SentenceHintEffect = {
  type: SentenceHintType;
  timerBonusSeconds: number;            // 30 for freeze_time, else 0
  eliminatedTileIndices: number[];      // remove_distractor
  revealedTiles: SentenceTileReveal[];  // reveal_tiles
};

// Map each correct-token position -> the set of pool indices that fill it,
// using the SAME tokenize + normalizeForComparison as confirmSentenceRound, so
// "valid tile for slot" matches exactly what Confirm accepts. Leftover indices
// (no slot) are distractors.
export function buildTileSolution(tilePool: string[], spanishSentence: string): {
  positionToTileIndices: number[][]; // index = slot, value = all valid pool indices
  distractorTileIndices: number[];
} { /* ... */ }

export function resolveSentenceHint(
  type: SentenceHintType,
  args: { tilePool: string[]; spanishSentence: string;
          alreadyEliminated: number[]; seed: number },
): SentenceHintEffect { /* per-hint logic below */ }
```

Per-hint logic (Q5: **every** hint also grants the universal +10s bump, like words):
- base `timerBonusSeconds = SENTENCE_HINT_UNIVERSAL_TIMER_BONUS_SECONDS` (10) for all three hints.
- **freeze_time** → `timerBonusSeconds = 10 + 20 = 30` (the dedicated time hint).
- **remove_distractor** → eliminate **all** `distractorTileIndices` (minus `alreadyEliminated`);
  +10s (Q6: remove all decoys, not just one). Still leaves the +10s bump.
- **reveal_tiles** → reveal `min(SENTENCE_HINT_REVEAL_COUNT, tokenCount − 1)` **seeded**
  positions (deterministic from `seed`, so both players see the same marks and a re-fire is
  stable). The `min(…, tokenCount − 1)` guard means a short sentence is never fully solved.
  Each reveal carries the slot's full set of valid tile indices. *(Seeded, not
  "lowest" — the board now builds strictly in order with a persistent badge + pulse (see B9),
  so a reveal for a later slot like slot 5 is fine: its badge waits and its pulse lights when
  the player reaches it. This matches the picked prototype, which revealed slots 2 and 5.)*

### B2. `convex/schema.ts`
- `sentenceHintTypeValidator` = union of the 3 literals.
- On `duels`:
  - `sentenceHintPoolUsed: v.array(sentenceHintTypeValidator)` (cumulative per duel, init `[]`)
  - `currentQuestionEliminatedTileIndices: v.optional(v.array(v.number()))`
  - `currentQuestionRevealedTiles: v.optional(v.array(v.object({ position: v.number(), tileIndices: v.array(v.number()) })))`
  - `currentQuestionTimerBonusSeconds: v.optional(v.number())`

### B3. `convex/helpers/sessionCreation.ts`
- Initialize `sentenceHintPoolUsed: []` in `buildDuelSession` (required field).

### B4. `convex/hintPool.ts` — new mutation `fireSentenceHint`
- Mirror `fireHint`: assert `pve`, active, not-already-used (vs `sentenceHintPoolUsed`),
  one-per-question (`currentQuestionHintFired`).
- Require `currentQuestion.kind === "sentence"` (the word `fireHint` keeps its `kind === "word"`
  gate; the shared `currentQuestionHintFired` flag is safe since a round is one kind only).
- `seed = hashSeed(\`${duel.seed}:${currentWordIndex}:${hintType}\`)`.
- `effect = resolveSentenceHint(...)` from server-side `spanishSentence` + `tilePool` +
  existing `currentQuestionEliminatedTileIndices`.
- Patch:
  ```ts
  sentenceHintPoolUsed: [...duel.sentenceHintPoolUsed, hintType],
  currentQuestionHintFired: true,
  currentQuestionEliminatedTileIndices: Array.from(new Set([...existing, ...effect.eliminatedTileIndices])),
  currentQuestionRevealedTiles: effect.revealedTiles.length ? effect.revealedTiles : duel.currentQuestionRevealedTiles,
  currentQuestionTimerBonusSeconds: (duel.currentQuestionTimerBonusSeconds ?? 0) + effect.timerBonusSeconds,
  ```
  **Do NOT push `questionStartTime`** — the bonus field is the single source of truth
  (Issue S4: pushing it AND reading the bonus field in the clamp would double-count).
- No self-duel mirror (fields are not role-specific; matches word `fireHint`).

### B5. Timer clamp fix — `SentenceRoundView.tsx` timer effect (now the only sentence board)
- Today `clampTimerSeconds(base − elapsed, base)` caps remaining at `base`, eating the bonus.
- Fix: read `duel.currentQuestionTimerBonusSeconds ?? 0` and use it in **both** value and
  ceiling: `clampTimerSeconds(base + bonus − elapsed, base + bonus)`. Single source (no
  questionStartTime push), so no double count. Word path is untouched (Issue S4b: the word
  `+15` hint's pre-existing "tops-up-to-base" quirk is out of scope).

### B6. Reset on advance — `convex/rules/duelScoringRules.ts`
- Extend `getHintClearFields()` to also clear `currentQuestionEliminatedTileIndices`,
  `currentQuestionRevealedTiles`, `currentQuestionTimerBonusSeconds`. Keep `sentenceHintPoolUsed`.
- Runs on word advances too; setting these optional fields to `undefined` is the same
  clear-by-undefined idiom already used for `eliminatedOptions`, so it is harmless there.

### B7. View model — `useDuelSessionViewModel.ts` / `duelViewModelHelpers.ts`
- Add `hints.sentencePool`: `{ usedHints: duel.sentenceHintPoolUsed, usedCount,
  totalCount: SENTENCE_HINT_POOL_SIZE, currentQuestionHintFired }`.
- Surface `eliminatedTileIndices` + `revealedTiles` to the board.
- `onFireSentenceHint(type)` → `useSentenceHintPool` hook calling `fireSentenceHint`.

### B8. UI — `SentenceHintPoolUI.tsx` (NEW), mounted in the unified board's footer
- Three buttons (freeze ⏱️ / remove-distractor ✂️ / reveal ✨), disabled when in
  `sentenceHintPoolUsed`, or `currentQuestionHintFired`, or pool exhausted. Header `x/3`.
- Mode fork in the board footer (mirrors `DuelFooter`): **`isPve` → `SentenceHintPoolUI`**;
  **PvP → sabotage UI (Part C)**. Replaces the old "no footer" decision; update the comment.

### B9. Board rendering of effects (the single `SentenceBoard`) — picked from prototypes

**Placement model (decision):** the sentence is built **strictly in order** — tiles fill slot 1,
then 2, then 3 … (this is exactly the append-only board today: a tap goes to the next open
position, Peel removes the last, Reset clears). There is **no per-tap correctness check** — a
wrong tile can still occupy a position; the whole sentence is graded on **Confirm**. "Right
order" = sequential building, which makes the reveal pulse below well-defined.

**Visual treatment (picked):** the reveal mark is an **amber corner badge in the top-right** of
the tile showing its slot number, so it coexists with the existing **order badge in the
top-left** (the placement-order number / red ✕ on the peelable last tile). Amber stays distinct
from the green a tile turns when Confirm marks it correct. *(Prototype 1 offered 4 looks; the
top-right corner badge is the working pick — revisit if you prefer the tray/ghost/pill style.)*

**Reveal behavior — "Active next-step" (picked):**
- **Persistent.** A revealed tile keeps its slot badge for the whole round, whether it's in the
  pool or already placed. The marks do **not** disappear with progress.
- **Right/wrong feedback.** Once a revealed tile is placed, its badge turns **green ✓** if its
  placement order equals its slot, otherwise stays **amber** (still pointing at where it belongs).
- **Pulse the next-due tile.** The revealed tile whose slot equals the next open position
  (`placedCount + 1`) gently pulses "place me now". At most one pulses at a time.
- **Recalculate on every place / peel / reset.** The pulse target is derived from the player's
  own `placedTileIndices` (per-player local view); the revealed *positions* themselves are the
  shared duel field.
  - **Place** → badge rides along (green/amber); pulse moves to the next due revealed tile.
  - **Peel** → pulse recalculates.
  - **Reset** → board clears, **marks + pulse stay and restart from slot 1** (the hint you paid
    for is never lost to a Reset).
- **eliminatedTileIndices**: grey + disable those tiles; skip in the tap/append handler.
  (Reveal + eliminate never coexist on one round — one-hint-per-question gate — so no
  badge-on-eliminated-tile case to handle.)

Note: because the *positions* are a shared field but the *coloring/pulse* derive from each
client's own placement, two real PvE players each see the pulse advance with their own board —
correct and intended.

---

## Part C — PvP sabotage parity (DESIGNED — locked, see C-Decisions)

For full word-like symmetry, PvP sentence rounds get **sabotages** where PvE gets hints. We ship
**all four existing sabotages** (`sticky`, `bounce`, `trampoline`, `reverse`) on the
build-and-confirm board — no new sabotage types. The firing/plumbing layer is already
content-agnostic; the only real work is making each effect *draw itself* on a tile board instead
of a multiple-choice grid.

**Key constraint that makes whole-round effects safe:** the duel now enforces **one sabotage per
question per player** (`convex/sabotage.ts`, `SABOTAGE_ALREADY_SENT_THIS_QUESTION`). So even a
persistent effect is just "the opponent spent their single shot to make this question chaotic" —
bounded and fair.

### C1. `convex/sabotage.ts` — remove the sentence block
Delete the early-return that rejects sabotages on sentence rounds (the `currentQuestion?.kind ===
"sentence"` guard, ~lines 39–45). Everything else stays untouched:
- `assertDuelMode(duel, "pvp", …)` — sabotages remain **PvP-only** (PvE's symmetric tool is the
  hint pool from Part B).
- `MAX_SABOTAGES = 5` — **shared budget** across the whole duel. In a mixed word+sentence duel a
  player has 5 total to spend across both round kinds (C-Decision Q4 = shared; the only reason to
  split would be to *guarantee* sabotages on each kind — deliberately not doing that).
- One-per-question rule and the `theirAnswered` guard — both already work for sentences:
  `answerSentenceRound` sets `challengerAnswered/opponentAnswered = true` on submit
  (`sentenceGameplayRules.ts:529,535`), so "can't sabotage after they've answered" and the
  footer's `opponentHasAnswered` are correct with no change.

No schema changes — sabotage state (`challengerSabotage`/`opponentSabotage`, `*SabotagesUsed`) is
already on the duel and kind-agnostic.

### C2. Mount the sabotage footer on the sentence board — `SentenceRoundView.tsx` + board
Today the sentence round renders **no footer** (it was deliberately left off). Add the existing
`SabotageSystemUI` beneath the build board, **PvP only** (`duelMode === "pvp"` and not a
self-duel). Reuse it as-is — same control word duels already have. This replaces the old
"intentionally does NOT mount the hint/sabotage footer" comment (line ~67); update it to: PvE →
`SentenceHintPoolUI` (Part B8), PvP → `SabotageSystemUI`.

The footer needs the same inputs the word `DuelFooter` feeds it (`sabotagesRemaining`,
`isOutgoingSabotageActive`, `opponentHasAnswered`, `onSendSabotage`). These come from the same
view-model fields already computed for word PvP — wire them through to the sentence surface.

### C3. Receive + render effects — `SentenceBuildBoard` (the unified `SentenceBoard`)
The board must consume the **incoming** sabotage (`mySabotage` = the effect my opponent sent me)
via the existing `useSabotageEffect` hook, which yields `{ activeSabotage, sabotagePhase }`. The
board already knows `locked`; it must also report a `phase` (`"answering"` while building,
`"transition"` on advance) so persistent effects clear on round change. Then:

**Sticky — drop-in.** Render `<SabotageRenderer effect phase />` (the full-screen sticky-note
overlay) over the board. Content-agnostic; obscures the view, touches nothing. Timed schedule
(auto-clears after ~7s) is unchanged.

**Bounce & Trampoline — only the *unplaced* pool tiles fly (Q1 = A).** Placed tiles (with their
order badges) and the Confirm/Reset row stay anchored so the player can still build, peel, and
confirm. Implementation mirrors `DuelAnswerGrid`: the unplaced tiles go `invisible` in their grid
slots (so layout doesn't shift) and flying copies render in a `fixed inset-0 z-50` overlay.
  - *Pin each flyer by tile index, never by `optionCount`.* When a tile is placed, **only that
    tile** leaves the flying set — the remaining tiles keep their exact trajectories, no reshuffle
    or teleport. (This is the bug to avoid: re-init from `optionCount` would re-scatter everyone.)
  - *Pick behavior (locked):* tapping a flying tile → it **flies back to its own home grid slot**
    and settles there as a placed tile (order badge), exactly where it sits in the anchored grid.
    The other tiles carry on bouncing.
  - *Persistence:* active from when the opponent sends it until the player's **first Confirm**
    (or timeout / round transition, whichever comes first) — see the shared "Confirm clears any
    sabotage" rule below.

**Reverse — flip letters of *unplaced* pool tiles only (Q3 = A).** Each unplaced tile's text is
reversed/scrambled (`useReverseAnswers` + `reverseText`, fed the unplaced tile texts). Placed
tiles render normally so the player can read the sentence they've built. No per-tile
"ever-confirmed stays unscrambled" tracking — superseded by the Confirm-clears rule below (the
whole effect ends on first Confirm, so the retry is already clean).
  - *Persistence:* same as bounce/trampoline — until first Confirm / timeout / transition.

**Confirm clears any active sabotage (locked, applies to all four effects).** The first build
attempt happens under chaos; the instant the player presses Confirm, the active effect is cleared
so **the second attempt is always a clean board** — we don't keep sabotaging across retries.
Implement on the client: `handleConfirm` clears the active effect (expose a `clear()` from
`useSabotageEffect`, or drive it off a phase signal). One-sabotage-per-question already prevents
the opponent re-sending, and `useSabotageEffect`'s `lastSabotageTimestampRef` prevents the same
effect re-triggering — so a client-side clear is sufficient; no server write needed. Sticky's own
~7s timer is unchanged (it'll usually be gone before Confirm anyway).

### C4. Tests
- `convex/sabotage.test.ts`: remove/replace the "rejected on sentence rounds" case with cases that
  a sabotage **is** accepted on a sentence round (PvP), still rejected in PvE/self-duel, still
  capped at 5 total, and still blocked by the one-per-question rule.
- Component tests for the sentence board: unplaced tiles fly / reverse; placed tiles stay
  anchored / readable; ever-confirmed tiles stay unscrambled after peel; sticky overlay mounts.

---

## Decisions — LOCKED
- **Q1 — Boss lives.** Boss sentence rounds become build-and-confirm: lose a life per *unsolved
  round* (on Confirm), not per wrong tap. Gentler, consistent with every mode. ✅
- **Q2 — Scoring.** Keep the build-confirm ladder including the −1 floor for PvE too (full
  symmetry with PvP). ✅
- **Q3 — Timer.** Single **60s** base for all sentence modes (was 90s for PvE per-tap). ✅
- **Q4 — Mixed duels.** Two separate hint budgets — word rounds keep their 4-hint pool, sentence
  rounds get their own 3-hint pool. ✅
- **Q5 — Time bumps.** Mirror words: **every** sentence hint adds a universal **+10s**; the
  freeze hint is the dedicated time hint at **30s total** (10 + 20). ✅
- **Q6 — remove_distractor.** Removes **all** distractor tiles, not just one. (Tradeoff: on Hard
  this clears all 3 decoys, leaving an all-correct pool — the player still has to find the right
  order. Accepted.) ✅
- **Q7 — Visual.** Top-right amber corner badge (the picked prototype look). ✅
- **Q8 — Sabotages.** Now designed (see Part C). All four existing sabotages ship on the sentence
  board. **PvP-only**, shared 5-per-duel budget, one-per-question. Bounce/trampoline fly only the
  *unplaced* tiles (placed + actions stay anchored), each flyer pinned by index so placing one
  doesn't disturb the rest, and a picked tile flies back to its own home slot. Reverse flips only
  *unplaced* tile text. Sticky is a drop-in overlay. **Confirm clears any active sabotage** so the
  second attempt is always clean (this replaced the earlier reverse "keep confirmed tiles
  unscrambled" idea). Effects persist from send until first Confirm / timeout / transition; sticky
  keeps its ~7s timer. ✅
- **Q9 — Reveal slots.** Any slots may be revealed, including slot 1. ✅

## Do I have a grip? Yes — plan is FROZEN, ready to implement.
The unification is mostly deletion (per-tap path) plus flipping one mode helper, which removes
the hairy per-tap edge cases. The PvE hint pool is then a faithful clone of the word pool with
tile-index-shaped effects on a single build-and-confirm board. PvP sabotages reuse the existing
content-agnostic plumbing — the only real work is redrawing four effects on a tile board (fly the
unplaced tiles, reverse the unplaced text, drop in the sticky overlay) and mounting the footer.
Plan is FROZEN across Parts A, B, and C — ready to implement.
