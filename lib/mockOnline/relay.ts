import type { RelayContentWord, RelayDifficulty } from "./content";
import { addScore, otherSlot } from "./players";
import { shuffle, type Rng } from "./shuffle";
import type { PlayerSlot, RelayState, RelayWord } from "./state";

const DIFFICULTY_POINTS: Record<RelayDifficulty, number> = { easy: 1, medium: 2, hard: 3 };

// Clean mode scores every correct answer the same; stakes mode rewards harder words.
export function relayPoints(difficulty: RelayDifficulty, stakes: boolean): number {
  return stakes ? DIFFICULTY_POINTS[difficulty] : 1;
}

export function createRelayState(
  words: readonly RelayContentWord[],
  stakes: boolean,
  rng: Rng = Math.random
): RelayState {
  const pool: RelayWord[] = shuffle(words, rng).map((word) => ({
    id: word.id,
    prompt: word.prompt,
    answer: word.answer,
    options: shuffle([word.answer, ...word.distractors], rng),
    difficulty: word.difficulty,
  }));
  return {
    kind: "relay",
    stakes,
    pool,
    total: pool.length,
    picker: "host",
    phase: "pick",
    assigned: null,
    scores: { host: 0, guest: 0 },
    resolved: 0,
    lastResult: null,
  };
}

// The rival of the current picker — the one who answers the handed word.
export function relayAnswerer(state: RelayState): PlayerSlot {
  return otherSlot(state.picker);
}

export function isRelayFinished(state: RelayState): boolean {
  return state.pool.length === 0 && state.assigned === null;
}

export function pickRelayWord(state: RelayState, slot: PlayerSlot, wordId: string): RelayState {
  if (isRelayFinished(state)) return state;
  if (state.phase !== "pick" || slot !== state.picker) return state;
  const word = state.pool.find((candidate) => candidate.id === wordId);
  if (!word) return state;
  return {
    ...state,
    pool: state.pool.filter((candidate) => candidate.id !== wordId),
    assigned: word,
    phase: "answer",
  };
}

// The rival answers; the word stays on screen in a `feedback` phase so both
// players see the correct/wrong reveal before `advanceRelay` moves things on.
export function answerRelay(state: RelayState, slot: PlayerSlot, value: string): RelayState {
  if (isRelayFinished(state)) return state;
  if (state.phase !== "answer" || !state.assigned) return state;
  if (slot !== relayAnswerer(state)) return state;

  const word = state.assigned;
  const correct = value === word.answer;
  const gained = correct ? relayPoints(word.difficulty, state.stakes) : 0;
  const scorer = correct ? slot : null;
  return {
    ...state,
    phase: "feedback",
    scores: scorer ? addScore(state.scores, scorer, gained) : state.scores,
    lastResult: { prompt: word.prompt, answer: word.answer, chosen: value, correct, scorer, gained },
  };
}

// Leaves the feedback reveal: the rival who just answered becomes the next picker.
export function advanceRelay(state: RelayState, slot: PlayerSlot): RelayState {
  if (isRelayFinished(state)) return state;
  if (state.phase !== "feedback") return state;
  const answerer = relayAnswerer(state);
  if (slot !== answerer) return state;
  return {
    ...state,
    picker: answerer,
    assigned: null,
    phase: "pick",
    resolved: state.resolved + 1,
  };
}
