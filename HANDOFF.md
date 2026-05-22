# Handoff — Mock Prototypes

Quick context for continuing this work (e.g. in Cloud). Last updated after
merging the online Relay Duel branch into the Sentence Builder rework on `main`.

## Relay Duel is now an online prototype

Relay Duel was promoted from the single-device mock into the real
Convex-backed **Online Mock Features** framework (room codes, two accounts,
realtime). One lobby entry, one engine: `game: "relay"`.

Reached via **Home → Online Mock Features**. Turn-based loop:
pick → answer → **feedback reveal** → (advance) → repeat until the shared pool
is empty. The rival who answers becomes the next picker. Tapping a word in the
picker phase hands it off immediately — no separate confirm step. Every word
uses the medium duel layout (1 correct + 5 wrong) and every correct answer
banks one point — relay does not vary scoring by difficulty.

**Visuals mirror the real duel** (`DuelView`): it renders full-bleed in the
same game container and reuses the real `Scoreboard`, `AnswerOptionButton`
(so the green/right + red/wrong reveal is identical), and `FinalResultsPanel`.
The word-selection screen is a clean vertical list in the same duel styling.

Relay files in the `mockOnline` feature:
- Engine: `lib/mockOnline/relay.ts` (+ `relay` case in `engine.ts`, validators
  in `state.ts`, words in `content.ts`). Phases: `pick → answer → feedback`;
  moves: `pick` / `answer` / `next`.
- UI: `app/mock-online/components/RelayDuelView.tsx`, rendered full-bleed
  straight from `app/mock-online/[roomId]/page.tsx` (relay bypasses the
  lobby-card `RoomView`). Listed in `app/mock-online/games.ts`.
- Tests: relay cases in `tests/lib/mockOnline/engine.test.ts` (incl. a full
  game playthrough).
- **Not yet verified live** — needs a Convex deploy + Clerk + two signed-in
  users. To feel it: open two browsers/accounts, create a room in one, join
  with the code in the other.

## Earlier single-device mocks (still present)

Reached via **Home → Mock Features**:

- **Relay Duel** (`app/components/prototypes/RelayDuelBeta.tsx`) — the original
  single-device pass-and-play mock (kept alongside the online version, mirroring
  how memory/missing-chunk/etc. exist both offline and online). Its pick screen
  was also simplified to the clean word list.

## How the prototypes are wired

Same lightweight pattern for every prototype — all in `app/HomePageClient.tsx`:

1. `import` the component.
2. Add a string to the `HomeScreenMode` union (e.g. `"relay_duel"`).
3. Add an `if (screen === "...") { return <ThemedPage>...</ThemedPage> }` branch.
4. Add an icon component + a `MenuButton` inside the Mock Features menu.

Prototypes reuse read-only pieces only — `Scoreboard`
(`app/game/components/duel/Scoreboard.tsx`) and theme colors via
`useAppearanceColors`. **No backend / Convex wiring.** The real duel UI to
mirror lives in `app/duel/[duelId]/components/DuelView.tsx`.

> Note: a separate, real online feature (`app/mock-online/`) IS backed by
> Convex (`api.prototypeRooms`). That is unrelated to these home-menu mocks.

## Sentence Builder — online game (2 modes)

The old offline `SentenceBuilderBeta` home-menu mock was **removed** and rebuilt
as two real-time, two-player online games inside the `mock-online` system
(**Home → Online Mock Features**). Both reuse the generic room/code/join
backend (`convex/prototypeRooms.ts`) and the shared engine — no backend changes
were needed; the engine is dispatched purely by the `game` values.

- **Sentence Co-op** (`sentence_coop`) — one shared board, players alternate
  placing the next word; a finished sentence banks a shared point ("Team" score).
  A wrong tap passes the turn so the partner can place the right word.
- **Sentence Duel** (`sentence_duel`) — each player builds their **own** copy of
  the same sentence independently (no turns). A wrong tap is rejected and adds
  a mistake to that player. The round advances once **both** players complete
  the sentence; the slower player sees a "waiting for opponent" footer.
  **Fewest mistakes wins** at the end (lower is better, ties allowed).

Code:
- Engine: `lib/mockOnline/sentence.ts` (pure, fully unit-tested in
  `tests/lib/mockOnline/sentence.test.ts`).
- State/validators: `lib/mockOnline/state.ts` (`SentenceState`, `sentence` kind,
  `tap` move, `sentence_coop` / `sentence_duel` games, `mistakes` field).
- Content: `SENTENCE_ROUNDS` in `lib/mockOnline/content.ts`.
- UI: `app/mock-online/components/SentenceBuilder.tsx`, dispatched from
  `RoomView.tsx`; lobby entries in `app/mock-online/games.ts`.

Open / easy to tweak: co-op scoring is intentionally minimal (completion only);
duel uses mistakes-as-score (inverted: lower wins) and starting turn alternates
per round. No timer yet. Not browser-verified end to end (needs Clerk auth +
Convex + two sessions) — logic is covered by unit tests.

## How to remove a prototype

- **Single-device mock:** delete its file in `app/components/prototypes/` and
  revert its 4 small additions in `app/HomePageClient.tsx`. Nothing else touches it.
- **Online Relay Duel only:** drop the `relay` cases from `lib/mockOnline/engine.ts`,
  remove `relay.ts`, the relay validators in `state.ts`, `RELAY_WORDS` in
  `content.ts`, the two entries in `app/mock-online/games.ts`, the relay
  short-circuit in `app/mock-online/[roomId]/page.tsx`, the `case "relay"` arm of
  `RoomView.tsx`, `app/mock-online/components/RelayDuelView.tsx`, and the relay tests.
- **The whole online framework** is self-contained and safe to delete together:
  `lib/mockOnline`, `convex/prototypeRooms.ts`, `app/mock-online`, the
  `prototypeRooms` schema table, and the homepage button.
