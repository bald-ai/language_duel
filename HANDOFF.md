# Handoff — Mock Prototypes

Quick context for continuing this work (e.g. in Cloud). Last updated after the
Relay Duel + Sentence Builder commit on `main`.

## What was just built

Two new homepage mock prototypes, both reached via **Home → Mock Features**:

- **Sentence Builder** (`app/components/prototypes/SentenceBuilderBeta.tsx`) —
  duel-style screen where you tap words in order to assemble a sentence.
- **Relay Duel** (`app/components/prototypes/RelayDuelBeta.tsx`) — turn-based
  duel variant. Two players **share one word pool** and alternate roles:
  pick a word for your rival → they answer → they pick one for you → repeat
  until the pool is exhausted. Correct answers bank that word's points
  (easy +1 / medium +2 / hard +3). Single-device pass-and-play UI mock.

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

## Relay Duel — design notes / open decisions

- Phases: `pick → handoff → answer → feedback → (loop) → done`.
- "You" in the scoreboard follows whoever holds the device (the current actor).
- Added a **hand-off screen** between pick and answer to sell the two-player
  turn-taking on one device. Not in the original spec — easy to drop if a
  direct jump to the answer screen is preferred.
- Word bank is hardcoded in `RelayDuelBeta.tsx` (`WORDS`, 8 words / 2 themes).
- No timer (the real duel has one) — could be added for fidelity.
- All single-device mock; real PvP would need backend like `mock-online/`.

## How to remove a prototype

Delete its file in `app/components/prototypes/` and revert its 4 small
additions in `app/HomePageClient.tsx`. Nothing else touches it.
