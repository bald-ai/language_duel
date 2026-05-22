import type { SentenceContentRound } from "./content";
import { addScore, otherSlot } from "./players";
import { shuffle, type Rng } from "./shuffle";
import type {
  PlayerSlot,
  Scores,
  SentenceCoopState,
  SentenceDuelState,
  SentenceMode,
  SentenceState,
} from "./state";

// Alternates which side opens each coop round so neither player always opens.
function startTurn(index: number): PlayerSlot {
  return index % 2 === 0 ? "host" : "guest";
}

function buildRounds(rounds: readonly SentenceContentRound[], rng: Rng) {
  return rounds.map((round) => ({
    english: round.english,
    words: shuffle(round.correct, rng),
    solution: [...round.correct],
    correctText: round.correct.join(" "),
  }));
}

export function createSentenceState(
  mode: SentenceMode,
  rounds: readonly SentenceContentRound[],
  rng: Rng = Math.random
): SentenceState {
  const built = buildRounds(rounds, rng);
  if (mode === "coop") {
    return {
      kind: "sentence",
      mode: "coop",
      rounds: built,
      index: 0,
      scores: { host: 0, guest: 0 },
      placed: [],
      turn: startTurn(0),
      lastError: null,
      lastResolved: null,
    };
  }
  return {
    kind: "sentence",
    mode: "duel",
    rounds: built,
    index: 0,
    mistakes: { host: 0, guest: 0 },
    placedHost: [],
    placedGuest: [],
    doneHost: false,
    doneGuest: false,
    lastError: null,
    lastResolved: null,
  };
}

export function isSentenceFinished(state: SentenceState): boolean {
  return state.index >= state.rounds.length;
}

export function tapSentence(
  state: SentenceState,
  slot: PlayerSlot,
  tile: number
): SentenceState {
  if (isSentenceFinished(state)) return state;
  const round = state.rounds[state.index];
  if (tile < 0 || tile >= round.words.length) return state;
  return state.mode === "coop"
    ? tapCoop(state, slot, tile, round.solution, round.words, round.correctText)
    : tapDuel(state, slot, tile, round.solution, round.words, round.correctText);
}

// Coop: every tap hands the turn over. A correct tap advances the shared
// sentence; a wrong tap passes so a partner can place the right word.
function tapCoop(
  state: SentenceCoopState,
  slot: PlayerSlot,
  tile: number,
  solution: readonly string[],
  words: readonly string[],
  correctText: string
): SentenceCoopState {
  if (state.turn !== slot) return state;
  if (state.placed.includes(tile)) return state;

  const expected = solution[state.placed.length];
  const correct = words[tile] === expected;
  if (!correct) {
    return { ...state, turn: otherSlot(slot), lastError: slot };
  }
  const placed = [...state.placed, tile];
  if (placed.length === solution.length) {
    return advanceCoop(state, correctText);
  }
  return { ...state, placed, turn: otherSlot(slot), lastError: null };
}

function advanceCoop(state: SentenceCoopState, correctText: string): SentenceCoopState {
  const nextIndex = state.index + 1;
  return {
    ...state,
    index: nextIndex,
    scores: addShared(state.scores),
    placed: [],
    turn: startTurn(nextIndex),
    lastError: null,
    lastResolved: { index: state.index, correctText },
  };
}

// Duel: each player builds their own copy. Wrong taps add a mistake and place
// nothing; correct taps progress your own board. When both players finish the
// same sentence the round advances.
function tapDuel(
  state: SentenceDuelState,
  slot: PlayerSlot,
  tile: number,
  solution: readonly string[],
  words: readonly string[],
  correctText: string
): SentenceDuelState {
  const done = slot === "host" ? state.doneHost : state.doneGuest;
  if (done) return state;

  const playerPlaced = slot === "host" ? state.placedHost : state.placedGuest;
  if (playerPlaced.includes(tile)) return state;

  const expected = solution[playerPlaced.length];
  const correct = words[tile] === expected;
  if (!correct) {
    return {
      ...state,
      mistakes: addScore(state.mistakes, slot, 1),
      lastError: slot,
    };
  }

  const nextPlaced = [...playerPlaced, tile];
  const sentenceComplete = nextPlaced.length === solution.length;
  const placedHost = slot === "host" ? nextPlaced : state.placedHost;
  const placedGuest = slot === "guest" ? nextPlaced : state.placedGuest;
  const doneHost = slot === "host" ? sentenceComplete : state.doneHost;
  const doneGuest = slot === "guest" ? sentenceComplete : state.doneGuest;

  if (doneHost && doneGuest) {
    return advanceDuel(state, correctText);
  }
  return {
    ...state,
    placedHost,
    placedGuest,
    doneHost,
    doneGuest,
    lastError: null,
  };
}

function advanceDuel(state: SentenceDuelState, correctText: string): SentenceDuelState {
  return {
    ...state,
    index: state.index + 1,
    placedHost: [],
    placedGuest: [],
    doneHost: false,
    doneGuest: false,
    lastError: null,
    lastResolved: { index: state.index, correctText },
  };
}

function addShared(scores: Scores): Scores {
  return { host: scores.host + 1, guest: scores.guest + 1 };
}
