import type { SentenceContentRound } from "./content";
import { addScore, otherSlot } from "./players";
import { shuffle, type Rng } from "./shuffle";
import type { PlayerSlot, Scores, SentenceMode, SentenceState } from "./state";

// Whoever starts a coop/duel round alternates by round so neither player always
// opens. Race mode ignores `turn` (each player builds independently).
function startTurn(index: number): PlayerSlot {
  return index % 2 === 0 ? "host" : "guest";
}

export function createSentenceState(
  mode: SentenceMode,
  rounds: readonly SentenceContentRound[],
  rng: Rng = Math.random
): SentenceState {
  return {
    kind: "sentence",
    mode,
    rounds: rounds.map((round) => ({
      english: round.english,
      words: shuffle(round.correct, rng),
      solution: [...round.correct],
      correctText: round.correct.join(" "),
    })),
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    placed: [],
    turn: startTurn(0),
    lastError: null,
    lastResolved: null,
  };
}

export function isSentenceFinished(state: SentenceState): boolean {
  return state.index >= state.rounds.length;
}

// ---------------- Race: independent boards, first correct submission scores ----------------

export function submitSentence(
  state: SentenceState,
  slot: PlayerSlot,
  order: readonly number[]
): SentenceState {
  if (state.mode !== "race") return state;
  if (isSentenceFinished(state)) return state;
  if (slot === "host" ? state.lockedHost : state.lockedGuest) return state;

  const round = state.rounds[state.index];
  const attempt = reconstruct(round.words, order);
  if (attempt !== null && attempt === round.correctText) {
    return advanceRace(state, slot, round.correctText);
  }

  const lockedHost = slot === "host" ? true : state.lockedHost;
  const lockedGuest = slot === "guest" ? true : state.lockedGuest;
  if (lockedHost && lockedGuest) {
    return advanceRace({ ...state, lockedHost, lockedGuest }, null, round.correctText);
  }
  return { ...state, lockedHost, lockedGuest };
}

function advanceRace(
  state: SentenceState,
  scorer: PlayerSlot | null,
  correctText: string
): SentenceState {
  return {
    ...state,
    index: state.index + 1,
    scores: scorer ? addScore(state.scores, scorer, 1) : state.scores,
    lockedHost: false,
    lockedGuest: false,
    lastResolved: { index: state.index, correctText, scorer },
  };
}

// ---------------- Coop + Duel: one shared board, place the next word ----------------

export function tapSentence(
  state: SentenceState,
  slot: PlayerSlot,
  tile: number
): SentenceState {
  if (state.mode === "race") return state;
  if (isSentenceFinished(state)) return state;
  if (state.turn !== slot) return state;

  const round = state.rounds[state.index];
  if (tile < 0 || tile >= round.words.length || state.placed.includes(tile)) return state;

  const expected = round.solution[state.placed.length];
  const correct = round.words[tile] === expected;
  return state.mode === "coop"
    ? tapCoop(state, slot, tile, correct)
    : tapDuel(state, slot, tile, correct);
}

// Coop: every tap hands the turn over. A correct tap advances the shared
// sentence; a wrong tap just passes so a partner can place the right word.
function tapCoop(
  state: SentenceState,
  slot: PlayerSlot,
  tile: number,
  correct: boolean
): SentenceState {
  if (!correct) {
    return { ...state, turn: otherSlot(slot), lastError: slot };
  }
  const placed = [...state.placed, tile];
  const round = state.rounds[state.index];
  if (placed.length === round.solution.length) {
    return advanceShared(state, "shared", round.correctText);
  }
  return { ...state, placed, turn: otherSlot(slot), lastError: null };
}

// Duel: a correct tap scores you and keeps your turn; a wrong tap ends your turn
// and hands the same slot to the opponent.
function tapDuel(
  state: SentenceState,
  slot: PlayerSlot,
  tile: number,
  correct: boolean
): SentenceState {
  if (!correct) {
    return { ...state, turn: otherSlot(slot), lastError: slot };
  }
  const placed = [...state.placed, tile];
  const scores = addScore(state.scores, slot, 1);
  const round = state.rounds[state.index];
  if (placed.length === round.solution.length) {
    return advanceShared({ ...state, scores }, slot, round.correctText);
  }
  return { ...state, placed, scores, turn: slot, lastError: null };
}

function advanceShared(
  state: SentenceState,
  scorer: PlayerSlot | "shared",
  correctText: string
): SentenceState {
  const nextIndex = state.index + 1;
  const scores: Scores = scorer === "shared" ? addShared(state.scores) : state.scores;
  return {
    ...state,
    index: nextIndex,
    scores,
    placed: [],
    turn: startTurn(nextIndex),
    lastError: null,
    lastResolved: { index: state.index, correctText, scorer },
  };
}

function addShared(scores: Scores): Scores {
  return { host: scores.host + 1, guest: scores.guest + 1 };
}

// Rebuilds the sentence from an ordering of tile indices. Returns null when the
// ordering is not a valid permutation of the scrambled words.
function reconstruct(words: readonly string[], order: readonly number[]): string | null {
  if (order.length !== words.length) return null;
  const seen = new Set<number>();
  const parts: string[] = [];
  for (const i of order) {
    if (i < 0 || i >= words.length || seen.has(i)) return null;
    seen.add(i);
    parts.push(words[i]);
  }
  return parts.join(" ");
}
