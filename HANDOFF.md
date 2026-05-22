# Handoff — Mock Prototypes

Quick context for continuing this work (e.g. in Cloud).

## Relay Duel is now an online prototype

Relay Duel was promoted from the single-device mock into the real
Convex-backed **Online Mock Features** framework (room codes, two accounts,
realtime). It ships as **two lobby entries** that share one engine:

- **Relay Duel** (`game: "relay"`) — clean scoring, every correct answer = +1.
- **Relay Duel: Stakes** (`game: "relay_stakes"`) — words show difficulty and
  harder words score more (easy +1 / medium +2 / hard +3), so there is strategy
  in handing your rival the nastiest words.

Both reached via **Home → Online Mock Features**. Turn-based loop:
pick → answer → **feedback reveal** → (advance) → repeat until the shared pool
is empty. The rival who answers becomes the next picker.

**Visuals mirror the real duel** (`DuelView`): it renders full-bleed in the
same game container and reuses the real `Scoreboard`, `AnswerOptionButton`
(so the green/right + red/wrong reveal is identical), the difficulty pill, and
`FinalResultsPanel`. The **word-selection screen is a clean vertical list** in
the same duel styling (just the words; a difficulty pill per row only in Stakes
mode).

Relay files in the `mockOnline` feature:
- Engine: `lib/mockOnline/relay.ts` (+ `relay`/`relay_stakes` cases in
  `engine.ts`, validators/types in `state.ts`, words in `content.ts`).
  Phases: `pick → answer → feedback`; moves: `pick` / `answer` / `next`.
- UI: `app/mock-online/components/RelayDuelView.tsx`, rendered full-bleed
  straight from `app/mock-online/[roomId]/page.tsx` (relay bypasses the
  lobby-card `RoomView`). Listed in `app/mock-online/games.ts`.
- Tests: relay cases in `tests/lib/mockOnline/engine.test.ts` (incl. two
  full-game playthroughs).
- **Not yet verified live** — needs a Convex deploy + Clerk + two signed-in
  users. To feel it: open two browsers/accounts, create a room in one, join
  with the code in the other.

## Earlier single-device mocks (still present)

Reached via **Home → Mock Features**:

- **Sentence Builder** (`app/components/prototypes/SentenceBuilderBeta.tsx`) —
  duel-style screen where you tap words in order to assemble a sentence.
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
