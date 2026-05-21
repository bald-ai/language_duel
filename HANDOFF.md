# Handoff — Mock Prototypes

Quick context for continuing this work (e.g. in Cloud). Last updated after the
Relay Duel + Sentence Builder commit on `main`.

## What was just built

Homepage mock prototypes reached via **Home → Mock Features**:

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

## Sentence Builder — now an online game (3 modes)

The old offline `SentenceBuilderBeta` home-menu mock was **removed** and rebuilt
as three real-time, two-player online games inside the `mock-online` system
(**Home → Online Mock Features**). All three reuse the generic room/code/join
backend (`convex/prototypeRooms.ts`) and the shared engine — no backend changes
were needed; the engine is dispatched purely by the new `game` values.

- **Sentence Race** (`sentence_race`) — both players get the same sentence on
  their own board and race to assemble it. Free assembly with numbered badges,
  tap-a-tile-to-remove, **Undo** (last) and **Clear** (all); first correct
  **Submit** scores, a wrong submit locks you out for that round.
- **Sentence Co-op** (`sentence_coop`) — one shared board, players alternate
  placing the next word; a finished sentence banks a shared point ("Team" score).
- **Sentence Duel** (`sentence_duel`) — one shared board; a correct word scores
  you and **keeps** your turn, a wrong word **loses** your turn to the opponent.

Code:
- Engine: `lib/mockOnline/sentence.ts` (pure, fully unit-tested in
  `tests/lib/mockOnline/sentence.test.ts`).
- State/validators: `lib/mockOnline/state.ts` (`SentenceState`, `sentence` kind,
  `submit`/`tap` moves, `sentence_*` games).
- Content: `SENTENCE_ROUNDS` in `lib/mockOnline/content.ts`.
- UI: `app/mock-online/components/SentenceBuilder.tsx`, dispatched from
  `RoomView.tsx`; lobby entries in `app/mock-online/games.ts`.

Open / easy to tweak: co-op scoring is intentionally minimal (completion only);
duel "keep turn on correct" can let a strong player sweep a sentence (starting
turn alternates per round to balance). No timer yet. Not browser-verified end to
end (needs Clerk auth + Convex + two sessions) — logic is covered by unit tests.

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
