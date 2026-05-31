# PvE TbT — turn-by-turn sentence mode (plan)

Goal: add a **turn-by-turn cooperative sentence** mode. Two players share **one**
sentence board and **alternate turns** placing the next tile. A correct tap
places the tile and passes the turn; a wrong tap passes the turn (placing
nothing) so the partner can try; finishing a sentence banks a **shared** point
for both. It is collaborative — there is no winner.

---

## 0. Naming & framing (decided)

This mode is the **cooperative family's turn-by-turn variant**. Important context
that makes the name make sense:

- In this app, **"PvE" already means "cooperate"**, not "vs a bot". The existing
  picker shows PvE as *"Hints · cooperate" 🤝* (two humans helping each other),
  next to PvP *"Sabotages · compete" ⚔️*. So our new mode sits naturally in the
  PvE/cooperative family.
- **One version only.** We do **not** build a competitive (PvP) turn-by-turn
  flavor — that would be a different game. Just the one cooperative mode.

| Surface | Name |
|---|---|
| Picker label | **PvE TbT** |
| Picker description | **"Take turns · build together"** (the label "TbT" is shorthand; the description is what actually tells the user what it does) |
| Picker icon | cooperative + turn-ish (🤝 / 🔁) |
| Concept / full name in code & comments | **turn-by-turn** |
| `duelMode` value | **`"tbt"`** (matches the short lowercase style of `"pvp"`/`"pve"`/`"relay"`) |
| Files | `lib/duel/tbtEngine.ts`, `convex/tbtDuel.ts`, `app/duel/[duelId]/components/TurnByTurnView.tsx` |
| Doc fields | `tbtTurn`, `tbtTurnStartedAt`, `tbtTimeoutScheduledFunctionId` |
| Guard | `assertTbtUnavailable` |

> **History note.** Earlier drafts called this "Co-op". It is the same mechanic,
> renamed to **PvE TbT / turn-by-turn** to fit the app's existing cooperative
> ("PvE") family. All identifiers below use `tbt`.

---

## 0b. Decisions locked for this version

| # | Question | Choice |
|---|----------|--------|
| Q1 | Build it at all, now relay does sentences? | **Yes.** Distinct cooperative experience; cheaper than before thanks to reuse. |
| Q2 | Reuse existing sentence machinery vs new engine | **Reuse.** TbT is a thin turn/score layer over the existing validated-tap helper + tile board. (Watch the line — see §1.) |
| Q3 | Turn mechanic | **Tap-by-tap, instant feedback.** Correct tap locks the tile + passes turn; wrong tap places nothing + passes turn. |
| Q4 | Board storage | **Reuse `sentenceProgress`** with one shared row (single canonical key), not new per-board fields. |
| Q5 | End screen | **Out of scope this version.** Bare minimum so it isn't *wrong* (don't show "It's a tie!"); no design polish. |
| Q6 | AFK on your turn | **Pass the turn, no penalty.** Keeps the game alive. |
| Q7 | "Mistakes together" counter | **Skip for v1.** Cosmetic only. |
| Q8 | Word-deck guard | **Grey out in picker + server backstop.** TbT is sentence-only. |
| Naming | UI vs code names | **"PvE TbT"** (label), **turn-by-turn** (concept), **`"tbt"`** (mode value). One version, in the PvE/cooperative family (§0). |

### Verified by reading the code (closed, not open)

- **Schema validator** hard-codes only 3 mode literals — adding `tbt` needs an
  explicit `v.literal(DUEL_MODES[3])` (one-line fix, §3.2).
- **Self-duel** force-sets `SELF_DUEL_FORCED_MODE = "pve"` server-side
  (`lib/duel/selfDuel.ts:14`, `convex/challenges.ts:267`); TbT can't leak into a
  self-duel.
- **Question generation** — `buildDuelQuestionSet` already emits sentence
  snapshots with `tilePool` + `spanishSentence` (`lib/answerShuffle.ts` →
  `buildSentenceQuestionSnapshot`). No generation work.
- **Shared-row safety (verified).** Searched every reader of `sentenceProgress`:
  nothing iterates it expecting one row per real player. Round completion is
  driven by the `challengerAnswered`/`opponentAnswered` booleans, **not** by the
  board rows, so a single shared row doesn't confuse it. Storing the shared board
  under one fixed role key (§3.2) is safe.
- **Client DTO (verified).** `buildViewerSafeDuel`'s non-relay branch spreads the
  whole duel doc and ships `sentenceProgress` **as-is** (only per-question
  `spanishSentence` is masked). So the shared board reaches both clients for free,
  answer key still stripped. No DTO change.
- **Completion side-effects (verified).** Relay completes inline and fires no
  extra lifecycle work; the normal path's side effects (weekly-goal /
  spaced-repetition / notifications) are **all gated on a goal/boss/SR source**,
  and there is **no** ranking/history/stats step on completion. TbT is
  normal-source-only, so inline completion (§3.4) skips **nothing it needs**.
  Caveat already covered: the §3.5b guards keep a goal/boss/SR source off TbT.

---

## 1. The reuse boundary (the "tight line")

The risk with reuse is collapsing two things that *look* alike but serve
different purposes. The line we hold:

**Reuse as-is (identical business logic):**
- `applySentenceTap` (`convex/rules/sentenceGameplayRules.ts:71`) — validates a
  tapped tile against the answer key for `(questionIndex, role)`, places it on a
  correct match, rejects on a wrong one. This **is** TbT's per-tile rule. TbT
  calls it directly; it does not reimplement tokenize/normalize/compare.
- `SentenceBuildBoard` (`app/duel/[duelId]/components/SentenceBuildBoard.tsx`) —
  a pure presentational tile board (no mutations, no timer logic). TbT renders
  through it exactly like `SentencePvpBoard` and `RelaySentenceAnswer` do.
- `sentenceProgress` storage + its DTO masking — the per-`(questionIndex, role)`
  board store, already shared by PvE/PvP/relay.

**Build new (genuinely TbT's own purpose — NOT duplication):**
- **Turn ownership & passing.** Whose turn it is, and the rule that *both* a
  correct and a wrong tap hand the turn to the partner. No existing mode does
  per-tile alternation — this is TbT's reason to exist.
- **Shared, no-winner scoring.** On sentence completion, both scores +1, kept
  equal. Distinct from PvE's clean/messy ladder and PvP's competitive ladder.
- **A TbT view wrapper** that reads the *single shared* board row (not the
  viewer's own row) and shows a "Your turn / Partner's turn" banner.

Rule of thumb: if logic reads/writes a tile against the answer key, reuse it. If
logic decides *who plays next* or *how the team scores*, it's TbT's own.

> **Heads-up on reuse cost:** `applySentenceTap` also increments a per-row
> `mistakes` counter on a wrong tap. TbT skips the mistakes feature (Q7), so we
> simply ignore that field — it's harmless and *not* worth forking the helper to
> remove. Ignoring an extra number is cheaper than maintaining a second copy of
> the validation logic.

---

## 2. Architectural approach: clone the relay *skeleton*, reuse the sentence *machinery*

The existing parallel duel loop (`answerDuel` → `advanceDuelIfBothAnswered` →
`haveBothPlayersAnswered`) assumes **each player answers their own question in
parallel**. TbT breaks that on three axes (shared board, strict turns, shared
score) — exactly the axes relay already broke. So we copy relay's *structural*
escape hatch:

- A new `duelMode` value (`"tbt"`).
- Its own state fields on the `duels` doc.
- Its own mutations (`convex/tbtDuel.ts`) that **never** route through
  `advanceDuelIfBothAnswered` — they advance inline.
- Its own view (`TurnByTurnView`) branched at the top of `DuelSession.tsx`.
- Rejected from boss/SR surfaces; normal-source only.

The difference from old drafts: the *contents* of those pieces lean on the
existing sentence helpers (§1) instead of a hand-rolled engine.

---

## 3. File-by-file plan

### 3.1 `lib/duelMode.ts` — register the mode

```ts
export const DUEL_MODES = ["pvp", "pve", "relay", "tbt"] as const;

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  pvp: "PvP",
  pve: "PvE",
  relay: "Relay",
  tbt: "PvE TbT",
};

// Boss / spaced-repetition launch surfaces offer this turn-based-excluding set.
// (Name is now slightly off — it excludes relay AND tbt. Either rename to
//  STANDARD_PARALLEL_MODES or update the comment. Low stakes; see I2.)
export const NON_RELAY_DUEL_MODES: readonly DuelMode[] = ["pvp", "pve"];
```

**I1 (still real):** `duelModeValidator` in `convex/schema.ts` is hand-written as
three indexed literals (`DUEL_MODES[0..2]`). Adding a 4th member does NOT extend
it — a `"tbt"` duel fails schema validation on insert. **Fix in §3.2.**

**I2 (minor):** `NON_RELAY_DUEL_MODES` now excludes tbt too. The boss/SR pickers
reuse this list, so tbt is correctly excluded — just rename or re-comment.

### 3.2 `convex/schema.ts` — validator + minimal TbT fields

```ts
export const duelModeValidator = v.union(
  v.literal(DUEL_MODES[0]),
  v.literal(DUEL_MODES[1]),
  v.literal(DUEL_MODES[2]),
  v.literal(DUEL_MODES[3]), // "tbt"  <-- I1 fix
);
```

TbT fields on the `duels` doc — **deliberately minimal**, because the board
itself lives in the reused `sentenceProgress` (Q4):

```ts
// Turn-by-turn (PvE TbT) state. Only set when duelMode === "tbt"; absent otherwise.
tbtTurn: v.optional(playerRoleValidator),                  // whose turn it is
tbtTurnStartedAt: v.optional(v.number()),                  // AFK-timeout anchor + freshness token
tbtTimeoutScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
```

We drop any `tbtPlaced` array (the board is the shared `sentenceProgress` row)
and any mistakes field (Q7 skip). `challengerScore` / `opponentScore` /
`currentWordIndex` are reused as-is.

**The shared-board key (Q4 mechanism — verified safe).** `sentenceProgress` rows
are keyed by `(questionIndex, role)`. TbT has one shared board, so all taps from
**both** players write the row under a single fixed canonical key. Use the
existing `"challenger"` role value as that key (a constant, e.g.
`TBT_BOARD_ROLE = "challenger"`). Zero schema change to `sentenceProgress`; lets
us call `applySentenceTap` unchanged. Semantically the row's `role` field is just
"the shared TbT board", not "the challenger's board" — documented at the call
site. (Alternative: widen the role validator with a `"tbt"` literal — ripples
through every sentence helper; not worth it.)

> Confirmed by code search: no reader of `sentenceProgress` assumes a row per
> real player, and completion is decided by `challengerAnswered`/
> `opponentAnswered` booleans, not by the rows. See §0b.

### 3.3 `lib/duel/tbtEngine.ts` — NEW, thin turn/score layer

Small — validation/placement is delegated to `applySentenceTap`.

```ts
import type { Doc } from "../../convex/_generated/dataModel";
import type { PlayerRole } from "../../convex/helpers/auth";

export const TBT_BOARD_ROLE: PlayerRole = "challenger"; // the shared-board key

// Alternate who opens each sentence so neither player always starts.
export function tbtOpener(index: number): PlayerRole {
  return index % 2 === 0 ? "challenger" : "opponent";
}

export function buildInitialTbtState(now: number): Partial<Doc<"duels">> {
  return { tbtTurn: tbtOpener(0), tbtTurnStartedAt: now };
}

export function otherRole(role: PlayerRole): PlayerRole {
  return role === "challenger" ? "opponent" : "challenger";
}

/** Bank the shared point and move to the next sentence (or complete the duel). */
export function buildTbtAdvancePatch(duel: Doc<"duels">, now: number): Partial<Doc<"duels">> {
  const nextIndex = duel.currentWordIndex + 1;
  const finished = nextIndex >= (duel.duelQuestions?.length ?? 0);

  const base: Partial<Doc<"duels">> = {
    challengerScore: duel.challengerScore + 1,
    opponentScore: duel.opponentScore + 1, // shared point, kept equal
  };

  if (finished) {
    return {
      ...base,
      status: "completed",
      currentWordIndex: Math.max(0, nextIndex - 1), // clamp like buildFinalCompletionPatch
      tbtTurn: undefined,
      tbtTurnStartedAt: undefined,
    };
  }
  return { ...base, currentWordIndex: nextIndex, tbtTurn: tbtOpener(nextIndex), tbtTurnStartedAt: now };
}

/** Turn-timeout (AFK, Q6): just hand the turn to the partner. No score change. */
export function buildTbtTurnTimeoutPatch(duel: Doc<"duels">, now: number): Partial<Doc<"duels">> {
  const turn = duel.tbtTurn ?? "challenger";
  return { tbtTurn: otherRole(turn), tbtTurnStartedAt: now };
}
```

There is **no `applyTbtTap` doing validation** — the mutation composes
`applySentenceTap` + these helpers (§3.4). Each completed sentence simply moves
to a fresh `(nextIndex, TBT_BOARD_ROLE)` row, so there's no explicit board reset.

### 3.4 `convex/tbtDuel.ts` — NEW mutations (relay-shaped, sentence-reused)

```ts
import { applySentenceTap } from "./rules/sentenceGameplayRules";
import { TBT_BOARD_ROLE, buildTbtAdvancePatch, otherRole,
         buildTbtTurnTimeoutPatch } from "../lib/duel/tbtEngine";
import { TBT_TURN_TIMEOUT_MS } from "../lib/duelConstants";

export const tbtTap = mutation({
  args: { duelId: v.id("duels"), tileIndex: v.number() },
  handler: async (ctx, { duelId, tileIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "tbt", "tbtTap");
    if (duel.status !== "active") throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "..." });

    // Turn enforcement — the heart of TbT (TbT's own logic, not reused).
    if (playerRole !== (duel.tbtTurn ?? "challenger")) {
      throw new ConvexError({ code: "NOT_AUTHORIZED", message: "It is not your turn" });
    }

    const index = duel.currentWordIndex;
    const now = Date.now();

    // REUSE: validate + place against the shared board row.
    const { patch: tapPatch } = applySentenceTap({
      duel, questionIndex: index, role: TBT_BOARD_ROLE, tileIndex,
    });

    // Did this tap finish the sentence? (applySentenceTap set completed on the row.)
    const rowAfter = (tapPatch.sentenceProgress ?? duel.sentenceProgress ?? [])
      .find((r) => r.questionIndex === index && r.role === TBT_BOARD_ROLE);
    const completed = rowAfter?.completed ?? false;

    // TbT turn/score layer on top of the reused placement:
    let patch: Partial<Doc<"duels">>;
    if (completed) {
      patch = { ...tapPatch, ...buildTbtAdvancePatch(duel, now) };
    } else {
      // Both correct-but-not-final AND wrong taps pass the turn (Q3).
      patch = { ...tapPatch, tbtTurn: otherRole(playerRole), tbtTurnStartedAt: now };
    }

    // AFK backstop: cancel + reschedule unless the duel just finished.
    if (duel.tbtTimeoutScheduledFunctionId) await ctx.scheduler.cancel(duel.tbtTimeoutScheduledFunctionId);
    let scheduledId: Id<"_scheduled_functions"> | undefined;
    if (patch.status !== "completed") {
      scheduledId = await ctx.scheduler.runAfter(
        TBT_TURN_TIMEOUT_MS, internal.tbtDuel.tbtTurnTimeoutInternal,
        { duelId, expectedTurnStartedAt: now },
      );
    }
    await ctx.db.patch(duelId, { ...patch, tbtTimeoutScheduledFunctionId: scheduledId });
  },
});

export const tbtTurnTimeout = mutation({ /* client fast-path */
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "tbt", "tbtTurnTimeout");
    await resolveTbtTimeoutIfStale(ctx, duelId, duel, { requireWindowElapsed: true });
  },
});

export const tbtTurnTimeoutInternal = internalMutation({
  args: { duelId: v.id("duels"), expectedTurnStartedAt: v.number() },
  handler: async (ctx, { duelId, expectedTurnStartedAt }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) return;
    if (duel.tbtTurnStartedAt !== expectedTurnStartedAt) return; // turn already moved
    await resolveTbtTimeoutIfStale(ctx, duelId, duel, { requireWindowElapsed: false });
  },
});
```

`resolveTbtTimeoutIfStale` mirrors `resolveRelayTimeoutIfStale`: bail unless
mode=tbt + active; optionally check the window elapsed; cancel the scheduled fn;
apply `buildTbtTurnTimeoutPatch`. Add `TBT_TURN_TIMEOUT_MS` to
`lib/duelConstants.ts`. A turn = placing **one** tile, so ~20s is plenty (shorter
than relay's 60s whole-sentence window).

**I5 (freshness token):** TbT has no per-turn index, so we use `tbtTurnStartedAt`
as the token (`expectedTurnStartedAt`). If a real tap moved the turn after the
backstop was scheduled, the timestamps differ and the internal timeout no-ops —
prevents a stale backstop double-passing the turn.

**Completion is inline and safe (verified, §0b):** TbT is normal-source-only, so
setting `status: "completed"` directly (like relay) skips nothing it needs — the
goal/boss/SR lifecycle is gated on a source TbT never has, and there's no
ranking/history step. The §3.5b guards keep such a source off TbT.

> **Important — no Confirm path.** TbT is per-tap (Q3), so it does **not** use
> `appendSentenceTile` / `confirmSentenceRound` (the build-and-confirm model). It
> uses `applySentenceTap` (the validated-per-tap model). Do not wire the
> Confirm/Reset mutations into TbT.

### 3.5 `convex/helpers/sessionCreation.ts` — build + sentence-only guard (NET NEW)

Old drafts said "mirror the relay sentence guard here." **That guard no longer
exists** — relay accepts mixed word+sentence decks now. So TbT's guard is
net-new, not a mirror:

```ts
// In buildDuelSession, near the existing isRelay branch (~line 275):
if (args.duelMode === "tbt" && sessionWords.some((i) => !isSessionSentenceItem(i))) {
  throw new ConvexError({
    code: "INVALID_INPUT",
    message: "PvE TbT duels can only include sentence themes",
  });
}

const isTbt = args.duelMode === "tbt";
// TbT uses the NORMAL sentence-bearing question set (not the relay set):
const duelQuestions = isRelay
  ? buildRelayQuestionSet(sessionWords, wordOrder, "medium")
  : buildDuelQuestionSet(sessionWords, wordOrder, duelDifficultyPreset);
// ...and seed TbT turn state alongside relayState:
const tbtState = isTbt ? buildInitialTbtState(now) : {};
return { ...relayState, ...tbtState, /* ...rest */ };
```

`buildDuelSession` runs on `acceptChallenge` (challenge → active duel), so this
sentence-only guard is the **authoritative** check: even a stale client that
bypassed the picker/creation guards can't insert a word-bearing TbT duel.

(Confirm `now`/`Date.now()` is available in this scope; `buildInitialRelayState`
doesn't take a timestamp today, so this is a small addition — pass `Date.now()`
or thread the existing `now` if one is in scope.)

### 3.5b `convex/rules/duelModeGuards.ts` + boss/SR surfaces — source-type guard

D9 (normal-source-only) needs a *server* guard, mirroring relay's
`assertRelayUnavailable`. Add a sibling:

```ts
export function assertTbtUnavailable(duelMode: DuelMode, surfaceLabel: string) {
  if (duelMode !== "tbt") return;
  throw new ConvexError({ code: "WRONG_MODE", message: `PvE TbT is not available for ${surfaceLabel}` });
}
```

Call it next to each existing `assertRelayUnavailable(...)`:
- `convex/weeklyGoals/bossWorkflows.ts` (boss creation)
- `convex/weeklyGoalRepetitions/challengeCreation.ts` (spaced-repetition creation)

This is also what guarantees TbT never gets a goal/boss/SR source attached, which
is what makes the inline completion (§3.4) safe. (Alternatively collapse both
into `assertTurnBasedModeUnavailable` — fewer call sites, bigger blast radius on
the relay guard. Recommend the dedicated guard to stay additive.)

### 3.6 `convex/challenges.ts` — creation-time theme guard (NET NEW)

There is currently **no** relay theme guard in `challenges.ts` to mirror (removed
when relay learned sentences). Add TbT's directly:

```ts
if (duelMode === "tbt" && resolvedThemes.some((t) => !isSentenceTheme(t))) {
  throw new ConvexError({
    code: "INVALID_INPUT",
    message: "PvE TbT duels can only include sentence themes",
  });
}
```

Self-duel path is unaffected: it force-sets `SELF_DUEL_FORCED_MODE = "pve"`
(`challenges.ts:267`), so TbT can never reach a self-duel (confirmed in code).

### 3.7 `app/duel/[duelId]/DuelSession.tsx` — routing

```tsx
export default function DuelSession(props: DuelSessionProps) {
  if (props.duel.duelMode === "relay") return <RelayDuelView ... />;
  if (props.duel.duelMode === "tbt") {
    return (
      <TurnByTurnView
        duel={props.duel}            // Doc<"duels"> directly — no masked type needed
        viewerRole={props.viewerRole}
        challenger={props.challenger}
        opponent={props.opponent}
      />
    );
  }
  return <NonRelayDuelSession {...props} />;
}
```

Branch at the top, before any view-model hook (the file already documents this
rule so neither hook is conditional).

**No `TbtSafeDuel` type needed.** Relay needs `RelaySafeDuel` because its DTO
*removes* fields. TbT removes no top-level fields (only the per-question
`spanishSentence`, already masked for all non-relay duels), so `TurnByTurnView`
takes `Doc<"duels">` as-is.

### 3.8 `app/duel/[duelId]/components/TurnByTurnView.tsx` — NEW view

A thin wrapper around the reused `SentenceBuildBoard` — model it on
`SentencePvpBoard` / `RelaySentenceAnswer`, but read the **shared** row and run
the per-tap (no Confirm) flow:

- Read the shared board row: `findSentenceProgress(duel, currentWordIndex,
  TBT_BOARD_ROLE)` → `placedTileIndices`. **This is the one spot that differs from
  every other sentence view:** read the shared `TBT_BOARD_ROLE` row, **not** the
  viewer's own role. (The existing views read `viewerRole`; for TbT the
  opponent's `viewerRole` row would not exist, so reading by viewer role would
  show an empty board for one player.)
- Read `duel.tbtTurn`; `myTurn = duel.tbtTurn === viewerRole`.
- Render `SentenceBuildBoard` with:
  - `placedTileIndices` from the shared row,
  - `correctnessMask={null}` (only correct tiles ever land, so the board is always
    a correct prefix — no mask needed),
  - `showActions={false}` (no Confirm/Reset in per-tap TbT),
  - `locked={!myTurn}` (UI half of turn enforcement),
  - `onTileClick={(i) => tbtTap({ duelId, tileIndex: i })}`.
- A prominent **"Your turn" / "Partner's turn"** banner (via `belowActions` or a
  wrapping header).
- On a wrong tap by me: brief shake/red on the tile (local, off the rejected
  mutation), then it's the partner's turn.
- Per-turn countdown (reuse the sentence-timer styling) anchored on
  `tbtTurnStartedAt`; on local expiry of *my* turn, optionally call
  `tbtTurnTimeout` (server still backstops).

### 3.9 `convex/duels.ts` — DTO (no change required, verified)

`buildViewerSafeDuel`'s **non-relay branch** spreads the whole duel doc and only
replaces `sessionWords` + `duelQuestions` with masked copies. So TbT's `tbtTurn`
/ `tbtTurnStartedAt` and the shared `sentenceProgress` row ship to both clients
automatically, while per-question `spanishSentence` is still stripped (taps
validate server-side). TbT must NOT take the relay branch — and it doesn't, since
that branch is gated on `=== "relay"`. **No DTO code change.**

### 3.10 Mode picker + gating (NET NEW — nothing to mirror)

Relay's old sentence gating (`RELAY_SENTENCE_DISABLED_REASON`, `disabledModes`
from `hasSentenceTheme`) was **removed**. `DuelModePicker` still accepts a generic
`disabledModes?: Partial<Record<DuelMode, string>>` prop, so we wire TbT gating
fresh in `ChallengeModal.tsx`:

```ts
// TbT is sentence-only. Disable it unless EVERY selected theme is a sentence
// theme (a mixed word+sentence deck has no TbT tile mechanic for the words).
const allSentence = selectedThemes.length > 0 && selectedThemes.every(isSentenceTheme);
const disabledModes: Partial<Record<DuelMode, string>> | undefined = allSentence
  ? undefined
  : { tbt: TBT_REQUIRES_SENTENCE_REASON };
```

Add `TBT_REQUIRES_SENTENCE_REASON` (e.g. "PvE TbT needs sentence themes only").
Add a `tbt` entry to `DUEL_MODE_OPTIONS` (`challengeOptions.ts`):

```ts
{
  mode: "tbt",
  label: "PvE TbT",
  description: "Take turns · build together",
  icon: "🔁",            // cooperative + turn-ish
  selectedTone: "secondary",  // same tone family as PvE (cooperative)
},
```

> **Gating must match the guard.** The server guard (§3.5/§3.6) rejects *any*
> non-sentence theme, so the picker condition must be **all-sentence**, not
> "has at least one sentence". Otherwise the UI would let a mixed deck through and
> the server would reject it with an error. (Corrected version of the old I9,
> which used "has a sentence theme".)
>
> **Confirm the variable name** for the selected-themes list in `ChallengeModal`
> (`selectedThemes` above is a placeholder) and that `isSentenceTheme` is
> importable there — trivial, but verify on open.

**I9 (still noted):** if themes are chosen *after* mode, UI gating is best-effort;
the creation guards (§3.5 + §3.6) are the real enforcement and always run.

### 3.11 End-of-duel screen — MINIMAL only (Q5)

Out of scope to polish this version. The one thing we must not ship is the
current `FinalResultsPanel` (`app/game/components/duel/FinalResultsPanel.tsx`)
calling TbT's always-equal scores **"It's a tie!"**. Bare-minimum fix: a
`duel.duelMode === "tbt"` branch at the top that shows a neutral line (e.g.
"You built N sentences together", N = `challengerScore`) instead of
win/lose/tie. No celebration design, no new component — just don't lie about the
result. Revisit polish later.

### 3.12 Tests

- `lib/duel/tbtEngine.test.ts`: opener alternates by index; advance banks +1 to
  both scores and bumps `currentWordIndex`; last-sentence advance sets
  `status: "completed"` with clamped index; timeout patch flips the turn with no
  score change.
- `convex/tbtDuel.test.ts` (if convex mutation tests exist): off-turn player
  rejected; correct tap places + passes turn; wrong tap places nothing + passes
  turn; completing the sentence advances + banks shared point; freshness token
  prevents a stale backstop double-pass.
- We do **not** re-test `applySentenceTap` (already covered) — only the TbT
  turn/score layer wrapping it.

---

## 4. Cross-cutting issues

- **C1 — `haveBothPlayersAnswered` never satisfied in TbT.** Fine: `tbtTap`
  advances inline and never sets the answered flags or routes through
  `advanceDuelIfBothAnswered` (same as relay). The completed screen reads scores,
  not answered-flags.

- **C2 — Winner-assuming results screen.** De-scoped to the minimal fix (§3.11)
  this version (Q5). Still must avoid rendering "It's a tie!".

- **C3 — Timer model.** No conflict: TbT never mounts `SentenceRoundView`
  (DuelSession routes TbT to `TurnByTurnView`). TbT's clock is per-*turn*,
  anchored on `tbtTurnStartedAt`, separate from `questionStartTime`.

- **C4 — Optimistic UI / races.** Convex serializes mutations per doc and the turn
  check rejects the off-turn player, so simultaneous taps can't both apply. Each
  tap round-trips (~50–150ms); the tile shows a pending state until the shared
  board updates. Turn-based pacing tolerates this.

- **C5 — Abandoned game.** If both go AFK, the turn-timeout just ping-pongs the
  turn (Q6) and the duel sits "active" forever — same as any abandoned duel today
  (no global stale-duel reaper). Acceptable for v1; noted.

- **C6 — Reconnect / refresh.** All state is on the duel doc (incl. the shared
  `sentenceProgress` row), so a reload rehydrates correctly.

- **C7 — Mistakes counter.** Dropped for v1 (Q7). `applySentenceTap` still
  increments the row's `mistakes` field; we ignore it (cheaper than forking).

---

## 5. Effort recap (lower than the original ~2–3 weeks)

Reuse (Q2) removes the from-scratch engine and most of the board work:

- **Backend:** schema validator fix + 3 small fields, thin `tbtEngine.ts`,
  `tbtDuel.ts` (compose `applySentenceTap` + turn/score), creation guards, source
  guard, one constant. (~2–3 days incl. tests)
- **Frontend:** routing branch, `TurnByTurnView` wrapper around the existing
  `SentenceBuildBoard`, mode-picker entry + all-sentence gating, the minimal
  results branch. (~2–3 days)
- **Polish:** turn-timeout edge cases, pending-tap/wrong-tap UX, reconnect check.
  (~1–2 days)

Biggest remaining friction is the **turn-timeout freshness handling (I5)** and
getting the **shared-row read** right in the view (read `TBT_BOARD_ROLE`, not
`viewerRole` — §3.8). Everything else is reuse + a thin turn/score layer.

---

## 6. Self-assessment

High confidence; the two risks that could have forced a redesign are both
verified clear (§0b): the shared-row storage is safe (nothing assumes per-player
rows; completion is flag-driven), and inline completion misses no needed
side-effects (TbT is normal-source-only). The novel part — per-tile alternation
on one shared board with no-winner scoring — is isolated to a small turn/score
layer; every other surface (validated-tap rule, tile board UI, progress storage,
DTO, mode picker, guards) has a direct existing analogue we reuse. The reuse
boundary (§1) is explicit so TbT's turn/score logic stays separate from the
shared placement logic, even though both touch the same board.
