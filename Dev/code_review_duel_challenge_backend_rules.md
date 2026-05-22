# Code Review — Area 6: Duel/challenge backend & rules

**Date:** 2026-05-22
**Scope:** Duel/challenge Convex backend + duel rules/helpers + the `lib/` pure
logic that backs them (PvP/PvE, self-duel, sabotage, hints, hint pool, scoring,
answer shuffling). ~2.9k LOC.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

Real LOC via `wc -l`:

- **Convex mutations/queries:** `duels.ts` (142), `challenges.ts` (459),
  `gameplay.ts` (353), `sabotage.ts` (71), `hints.ts` (140), `hintPool.ts` (62)
- **Rules:** `rules/duelGameplayRules.ts` (136), `rules/duelScoringRules.ts` (113),
  `rules/countdownPlanners.ts` (61), `rules/selfDuelMirror.ts` (34),
  `rules/duelModeGuards.ts` (18)
- **Helpers:** `helpers/gameLogic.ts` (328), `helpers/sessionCreation.ts` (291),
  `helpers/duelInitialization.ts` (84), `helpers/sessionWords.ts` (64)
- **Lib:** `duel/selfDuel.ts` (20), `sabotage/active.ts` (69),
  `sabotage/constants.ts` (40), `sabotage/effectPhases.ts` (42),
  `sabotage/types.ts` (5), `hints/constants.ts` (1), `hintPool/constants.ts` (3),
  `hintPool/rules.ts` (87), `hintPool/types.ts` (24), `scoring.ts` (43),
  `answerShuffle.ts` (96), `duelMode.ts` (8), `duelRole.ts` (57),
  `sessionWords.ts` (73)

No file exceeds the ~700 LOC guideline; the largest is `challenges.ts` (459),
then `gameplay.ts` (353) and `gameLogic.ts` (328). The problems here are **dead
modules, duplicated source-of-truth, and a self-duel special case grafted onto
the PvP shape** — not file size.

**Headline:** the mode boundary (`assertDuelMode`) is genuinely clean and
canonical — that part is good. But ~300 LOC of `gameLogic.ts` plus the entire
`duelInitialization.ts` are dead (solo logic was reimplemented in
`lib/soloPracticeRuntime.ts` and never deleted here), and the self-duel model
leaks `isSelfDuel` checks into three separate rule modules instead of being
resolved once.

---

## 🔴 Blockers

### 1. `helpers/duelInitialization.ts` (84 LOC) is entirely dead code

`buildSoloInitState` — the only export — has **zero callers** anywhere in
`convex/`, `lib/`, or `app/` (`grep -rn buildSoloInitState` returns only its own
definition). It builds challenger/opponent word-pool + level state for a "solo
duel" shape that no mutation reads. The `duels` schema
(`convex/schema.ts:321`) has no `activePool` / `wordStates` / `currentLevel` /
`level2Mode` fields, so this state could not be persisted even if it were called.

**Remedy:** delete the file. (Not test-covered, so nothing else moves.)

### 2. `helpers/gameLogic.ts` (328 LOC) is ~70% dead: only `shuffleArray` + `createShuffledWordOrder` have live callers

Tracing every export across `convex/lib/app` (excluding `gameLogic.ts` itself and
the dead `duelInitialization.ts`):

| export | external callers |
|---|---|
| `shuffleArray` | 1 (`weeklyGoals/bossWorkflows.ts:50`) |
| `createShuffledWordOrder` | 1 (`helpers/sessionCreation.ts:234`) |
| `shuffleArraySeeded`, `initializeWordPoolsSeeded`, `createInitialWordStates`, `shouldExpandPool`, `expandPoolSeeded`, `determineInitialLevelSeeded`, `determineLevel2ModeSeeded`, `calculateNextLevelOnCorrectSeeded`, `updateWordStateAfterAnswerSeeded`, `pickNextQuestionSeeded`, `updatePlayerStats`, `advanceSeed` | **0** |

The entire "Word Pool Management (Solo Mode)" + "Level Progression (Solo Mode)"
machinery (lines 101–328) is a **stale duplicate** of logic that was
reimplemented from scratch in `lib/soloPracticeRuntime.ts` (which has its own
`SoloWordState`, `activePool`, `wordStates`, `masteryLevel`, level progression,
*and its own copy of `LEVEL_2_TYPING_PROBABILITY`*). `soloPracticeRuntime.ts`
does not import `gameLogic.ts` at all. This is exactly the "dual old/new path
left behind after a rename/refactor" that AGENTS.md forbids — the old path was
never removed.

`advanceSeed` is the one wrinkle: it's the LCG step used by all the dead
seeded helpers, but it is *not* used by `shuffleArray` (which uses `Math.random`)
or `createShuffledWordOrder`. So once the dead helpers go, `advanceSeed` and the
`LCG_*` / `LEVEL_*_PROBABILITY` constant imports go with them.

**Remedy:** delete the seeded-pool/level block. Keep only `shuffleArray`,
`createShuffledWordOrder` (+ the `Array.from` index helper they share). The file
shrinks from 328 → ~40 LOC and could fold into `helpers/sessionWords.ts` or a
small `helpers/shuffle.ts`.

**Note on tests:** `tests/convex/gameLogic.test.ts` covers the *dead* functions.
Per AGENTS.md ("never delete tests just to get green"), the right move is: delete
the dead source **and** the now-orphaned test cases together, with a one-line
handoff rationale ("removed solo word-pool helpers superseded by
`lib/soloPracticeRuntime.ts`"). This is tests pinning dead code, not behavior —
it should not block the deletion.

### 3. Self-duel is a special case smeared across three rule modules instead of resolved once

`isSelfDuel(duel)` is branched on in **three** independent places, each
re-deriving "this is me-vs-me" and hand-writing the mirrored behavior:

- `rules/selfDuelMirror.ts` — mirrors challenger answer/score/lastAnswer onto the
  opponent half (`gameplay.ts:111,156`).
- `rules/countdownPlanners.ts:16` — `planConfirmUnpauseCountdown` returns
  `clearImmediately` for self-duels (skip the peer-confirm handshake).
- `rules/countdownPlanners.ts:38` — `planSkipCountdown` returns
  `bothSkipped: true` immediately for self-duels.

Each of these exists because the data model stores a self-duel as a *normal
two-player PvP row with `challengerId === opponentId`*, then every consumer has
to remember "oh, and if it's a self-duel, the second player is a mirror of the
first." The `selfDuelMirror.ts` doc comment even spells out the fragility: "in a
self-duel `getDuelParticipant` returns `isChallenger: true` AND
`isOpponent: true` … Gameplay code must treat `isChallenger` as canonical and
avoid `isOpponent`-only branches." That is an invariant enforced by *prose*, not
by types — exactly the kind of "weird if-statements in random places" the rubric
calls a design problem.

The mirror is also structurally brittle: `mirrorPatchForSelfDuel`
(`selfDuelMirror.ts:21-33`) copies fields by name via
`hasOwnProperty("challengerAnswered")` etc., so any new challenger-side field in
a future answer patch silently fails to mirror. And it is applied to the
**answer/timeout** patches but *not* to `buildNextRoundPatch` /
`buildFinalCompletionPatch` — which is only safe today because
`getHintProviderBonusPatch` (the only score write in those patches) can never
fire in a self-duel (hints are PvP-gated, self-duel is forced PvE). That is a
non-obvious cross-module invariant holding the correctness together.

**Remedy (code judo):** stop modeling a self-duel as a PvP row.
`SELF_DUEL_FORCED_MODE = "pve"` already says a self-duel *is* a PvE session.
Resolve the player at the boundary (`getDuelParticipant` /`forRole`) and treat
PvE as inherently single-actor:
- In a PvE/self-duel, "the opponent" is not a second human — there is nothing to
  mirror. The cleanest framing is that PvE answer/timeout writes the single
  player's progress and `haveBothPlayersAnswered` is trivially true once that one
  player acts. The countdown handshake (`requirePeer`) and the answer-mirror both
  collapse to "single actor advances immediately" — i.e. the *PvE* branch the
  code already needs, not a *self-duel* branch.
- If the two-row mirror must stay for now, at minimum collapse the three
  `isSelfDuel` sites into a single derived `isSingleActorDuel(duel)` policy and
  push the answer-mirror to cover *all* score-bearing patches (next-round /
  completion included) so the invariant is structural, not "happens to be PvE."

This deletes the `clearImmediately` vs `requirePeer` fork and the
`bothSkipped`-shortcut fork, because "single actor" is the same concept in all
three places.

### 4. Sabotage effect literals are a triplicated source of truth

The set `{ sticky, bounce, trampoline, reverse }` is declared **three times**:

- `lib/sabotage/types.ts:2` — `type SabotageEffect = "sticky" | … | "reverse"`
- `convex/schema.ts:129` — `sabotageEffectValidator` (the `v.union` of the same
  four literals)
- `convex/sabotage.ts:17-20` — an **inline** `v.union(v.literal("sticky"), …)`
  as the `effect` mutation arg

The schema already exports `sabotageEffectValidator`. The mutation re-spells the
union instead of importing it, so adding/removing an effect requires editing
three places and they can drift.

**Remedy:** import `sabotageEffectValidator` from `./schema` for the
`sendSabotage` arg (the same way `hintPool.ts` imports `hintTypeValidator` and
`challenges.ts` imports `duelModeValidator`). Ideally `sabotageEffectValidator`
is derived from `SABOTAGE_EFFECTS` (a `lib/sabotage` `as const` array) the way
`duelModeValidator` is built from `DUEL_MODES`, so the literal list lives once in
`lib`.

### 5. `SabotagePhase` is defined twice, identically

`lib/sabotage/types.ts:4` and `lib/sabotage/effectPhases.ts:8` both declare
`export type SabotagePhase = "wind-up" | "full" | "wind-down"`. `types.ts` is the
obvious home (it's the shared types module), yet `effectPhases.ts` redeclares it
rather than importing.

**Remedy:** delete the redeclaration in `effectPhases.ts`; import from
`./types`. (`effectPhases.ts` already imports `SabotageEffect` from `./types`, so
this is a one-line change.)

---

## 🟡 Medium

### 6. `gameplay.ts`: the post-answer "completed?" tail is duplicated verbatim between `answerDuel` and `timeoutAnswer`

`answerDuel` (lines 126–137) and `timeoutAnswer` (lines 165–177) end with the
identical sequence: re-`get` the duel, if `active` call
`advanceDuelIfBothAnswered`, else if `completed` return
`{ completed: true, completeWeeklyGoalMilestone: shouldCompleteWeeklyGoalBoss(…),
completeSpacedRepetition: shouldCompleteSpacedRepetitionDuel(…) }`, else
`noLifecycleIntent`. The `completed` object is also a hand-rebuilt copy of the
`DuelLifecycleIntent` shape that `advanceDuelIfBothAnswered` already constructs.

**Remedy:** extract one helper, e.g.
`finalizeAfterAnswer(ctx, duelId, duel) → DuelLifecycleIntent`, that does the
re-get + active/completed dispatch. Both mutations become: build patch → mirror →
patch → `return finalizeAfterAnswer(...)`. Removes ~20 duplicated LOC and the
risk of the two tails drifting.

### 7. `lib/sabotage/active.ts`: optional-duration params are pure indirection, and the 25 s "fallback" branch papers over an invariant

Two issues in one small file:

(a) `getSabotageExpiryAt` and `isSabotageActive` both take optional
`sabotageDurationMs` / `sabotageFallbackDurationMs` params that **default to the
exact constants the module already imports**. The only external caller
(`app/duel/[duelId]/hooks/useOutgoingSabotageStatus.ts:27-31`) passes
`SABOTAGE_FALLBACK_DURATION_MS` — i.e. re-supplies the default. The
parameterization buys nothing and just widens the signature.

(b) The `SABOTAGE_FALLBACK_DURATION_MS` (25 s) path only triggers when
`questionStartTime` is `undefined`. But every active duel sets `questionStartTime`
(`buildDuelSession` seeds it; `buildNextRoundPatch` resets it each round), and
`sendSabotage` already errors if the target has answered. So for a *live*
sabotage this 25 s branch is a silent default for a state that shouldn't occur —
the "silent defaults that hide a broken contract" case in AGENTS.md. It also
makes `isSabotageActive` carry two stacked code paths (the early
`sabotage.timestamp >= questionStartTime` return for non-sticky, lines 55-59,
*then* the expiry computation) that are hard to scan.

**Remedy:** drop the optional params and read the constants directly. Then decide
the contract for missing `questionStartTime`: either treat it as "no active
sabotage" (return `null` / `false`) explicitly, or assert it's present. Either
way removes the 25 s magic fallback and collapses `isSabotageActive` to a single
clear path. (Confirm the frontend hook in Area 4/5 doesn't depend on the 25 s
window before deleting — but the duration *parameterization* is safe to remove
now regardless.)

### 8. `helpers/sessionWords.ts`: two exported helpers are dead (test-only)

`getThemeIdsFromChallenge` (lines 13-17) and `getThemeIdsFromSessionWords`
(lines 60-64) have **no production callers** — `getThemeIdsFromChallenge` returns
`challenge.themeIds` unchanged (a pure identity wrapper), and
`getThemeIdsFromSessionWords` just re-exports `getUniqueThemeIds` from
`lib/sessionWords`. Both are referenced only by
`tests/convex/sessionWords.test.ts`.

**Remedy:** delete both (and their orphaned tests, with a handoff note). Callers
that need unique theme IDs already import `getUniqueThemeIds` from
`lib/sessionWords` directly (`sessionCreation.ts` does).

### 9. `lib/sessionWords.ts`: `getUniqueThemeNames` is dead (test-only)

`getUniqueThemeNames` (lines 49-63) has no `convex/lib/app` caller — only
`tests/lib/sessionWords.test.ts`. The live "names" path is
`summarizeSessionWords` → `summarizeThemeNames` over a `Set` of names
(`helpers/sessionWords.ts:19`), which dedupes inline and never calls this.

**Remedy:** delete `getUniqueThemeNames` + its test. If a dedup-by-(id,name) is
ever needed, it can come back, but right now it's an unused parallel to
`summarizeSessionWords`.

### 10. `challenges.ts`: the boss / spaced-repetition / normal source split in `insertDuelSessionForChallenge` re-validates fields the discriminated union already guarantees

`insertDuelSessionForChallenge` (lines 71-123) branches on
`challenge.sourceType`, then inside each branch re-checks
`if (!challenge.weeklyGoalId || !challenge.bossType) throw …` before spreading
into `buildDuelSession`. But `buildDuelSession` → `validateDuelSourceFields`
(`sessionCreation.ts:137-159`) *already* enforces exactly these source-field
invariants and throws the same class of `INVALID_INPUT` error. So each branch
validates twice: once against the loosely-typed `challenges` doc, once inside the
builder. The double-check exists because the `challenges` table stores
`weeklyGoalId`/`bossType`/`spacedRepetitionStep` as independent optionals rather
than a discriminated union mirroring `DuelSourceFields`.

**Remedy:** give `challenges` the same discriminated `DuelSourceFields` shape
(or a `challengeToDuelSourceFields(challenge)` adapter in `sessionCreation.ts`
that does the narrowing once and returns a typed `DuelSourceFields`). Then
`insertDuelSessionForChallenge` is one `buildDuelSession({ ...baseSession,
...sourceFields })` call with no per-branch `throw`s. (Schema change touches
Area 15, but the adapter + dedup lives here.)

### 11. `acceptChallengeFromNotification` / `declineChallengeFromNotification` duplicate the body of `acceptChallenge` / `declineChallenge`

`acceptChallengeFromNotification` (lines 373-405) repeats the pending-check +
opponent-check + `rejectExpiredChallenge` + `acceptChallengeCore` sequence that
`acceptChallenge` (321-338) already performs; same for the decline pair
(340-354 vs 407-437). The only real difference is *how the challenge is
resolved* — directly by id, vs via a notification payload
(`requireCallerOwnedNotificationPayload`).

**Remedy:** extract `resolveAcceptableChallenge(ctx, challenge, userId)` that
runs the pending/opponent/expiry guards, and have all four mutations call it
after they've each obtained the challenge (one via `getChallengeParticipant`,
one via the notification payload). Collapses four near-identical guard blocks to
one. (Cross-check the `challenge_invite` payload handling with Area 11
Notifications — but the dedup itself is local.)

---

## 🟢 Minor / nit-level

- **`sessionCreation.ts:131` `validateDuelMode` is a defensive check for an
  impossible state.** Every caller (`createChallenge`, `createSelfDuel`,
  `acceptChallenge`, the weekly-goal/repetition creators) passes a
  `duelModeValidator`-typed `DuelMode`, so `mode !== "pvp" && mode !== "pve"` is
  unreachable at runtime. It's a builder-boundary guard, so not egregious, but it
  re-asserts a contract the validator already enforces. Consider dropping it (or,
  if kept as a belt-and-suspenders builder invariant, leave it — low priority).

- **`hints.ts:122` `const update: Record<string, unknown>`** loses type safety on
  a `duels` patch. The other mutations build `Partial<Doc<"duels">>`. Type it as
  `Partial<Doc<"duels">>` so the timer-resume fields are checked.

- **`duels.ts:62` `wordIndexBySessionIndex.get(sessionWordIndex) ?? sessionWordIndex`**
  silently falls back to the raw index when `wordOrder` lacks an entry. Given
  `wordOrder` is always built 1:1 with `sessionWords` in `buildDuelSession`, the
  `??` papers over a "can't happen" gap. Minor, but it's the same silent-default
  smell as #7 — an explicit invariant (every session word has a wordOrder slot)
  would read cleaner.

- **`hintPool/constants.ts` (3 LOC) + `hints/constants.ts` (1 LOC)** are
  single-constant files. `hints/constants.ts` holds only
  `PVP_HINT_ELIMINATION_PICKS`; it could live in `hintPool/constants.ts` (or a
  shared `lib/hints` constants module) so the two hint systems' tunables aren't
  split across two near-empty files. Cosmetic.

- **`getSabotageExpiryAt` `SabotageState` type** is redeclared locally
  (`active.ts:7-10`) instead of importing the `{ effect, timestamp }` shape that
  `duelRole.ts:5-8` (`DuelSabotage`) and `schema.ts` (`sabotageValidator`)
  already define. Low-stakes, but it's a third copy of the same two-field shape.

---

## Recommended ordering

1. **Delete dead code first** (#1 `duelInitialization.ts`, #2 `gameLogic.ts`
   solo block, #8/#9 dead sessionWords helpers) — biggest LOC reduction, lowest
   risk, and it clears the field before the structural work. Remove orphaned
   tests in the same change.
2. **De-duplicate sources of truth** (#4 sabotage effect literals, #5
   `SabotagePhase`) — trivial, prevents drift.
3. **Self-duel model** (#3) — the headline structural fix; do after dead code is
   gone so the mirror's blast radius is clear.
4. **`gameplay.ts` tail extraction** (#6) and **`active.ts` cleanup** (#7).
5. **Challenge-creation dedup** (#10, #11) — touches schema (Area 15) /
   notifications (Area 11) at the edges, so sequence last.
6. Minor items opportunistically.

## Approval bar

Not approvable as-is. Blocking reasons:

- **Dead modules left behind after a refactor** — all of `duelInitialization.ts`
  and ~70% of `gameLogic.ts` are a stale duplicate of `lib/soloPracticeRuntime.ts`
  (AGENTS.md "no dual old/new path" violation).
- **Triplicated / duplicated source of truth** — sabotage effect literals (3×)
  and `SabotagePhase` (2×).
- **Self-duel is a special case grafted onto the PvP row** — `isSelfDuel`
  branched in three rule modules, correctness held together by a prose invariant
  and a "happens to be PvE" coincidence, with a name-based mirror that silently
  skips unmirrored fields.

The mode boundary itself (`assertDuelMode` as the single canonical PvP/PvE gate,
consistently called in `sabotage.ts`, `hints.ts`, `hintPool.ts`) is clean and
should be preserved exactly as-is. The pure-logic `lib` files (`scoring.ts`,
`answerShuffle.ts`, `hintPool/rules.ts`, `duelRole.ts`, `duelMode.ts`) are in the
right layer and are fine.
