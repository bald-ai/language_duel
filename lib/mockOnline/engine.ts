import {
  MEMORY_PAIRS,
  MISSING_CHUNK_QUESTIONS,
  REBUILD_SENTENCES,
  SENTENCE_ROUNDS,
  SPEED_QUESTIONS,
} from "./content";
import { applyMemoryFlip, createMemoryState, isMemoryFinished } from "./memory";
import {
  answerMcq,
  answerOrder,
  createMcqState,
  createOrderState,
  isMcqFinished,
  isOrderFinished,
} from "./race";
import {
  createSentenceState,
  isSentenceFinished,
  tapSentence,
} from "./sentence";
import type { Rng } from "./shuffle";
import type { GameState, Move, MockGame, PlayerSlot } from "./state";

export function createGameState(game: MockGame, rng: Rng = Math.random): GameState {
  switch (game) {
    case "memory":
      return createMemoryState(MEMORY_PAIRS, rng);
    case "missing_chunk":
      return createMcqState(MISSING_CHUNK_QUESTIONS, rng);
    case "speed":
      return createMcqState(SPEED_QUESTIONS, rng);
    case "rebuild_sentence":
      return createOrderState(REBUILD_SENTENCES, rng);
    case "sentence_coop":
      return createSentenceState("coop", SENTENCE_ROUNDS, rng);
    case "sentence_duel":
      return createSentenceState("duel", SENTENCE_ROUNDS, rng);
  }
}

export function applyGameMove(state: GameState, slot: PlayerSlot, move: Move): GameState {
  switch (state.kind) {
    case "memory":
      return move.kind === "flip" ? applyMemoryFlip(state, slot, move.index) : state;
    case "mcq":
      return move.kind === "answer" ? answerMcq(state, slot, move.value) : state;
    case "order":
      return move.kind === "order" ? answerOrder(state, slot, move.order) : state;
    case "sentence":
      return move.kind === "tap" ? tapSentence(state, slot, move.tile) : state;
  }
}

export function isGameFinished(state: GameState): boolean {
  switch (state.kind) {
    case "memory":
      return isMemoryFinished(state);
    case "mcq":
      return isMcqFinished(state);
    case "order":
      return isOrderFinished(state);
    case "sentence":
      return isSentenceFinished(state);
  }
}

export type GameWinner = PlayerSlot | "tie";

export function getWinner(state: GameState): GameWinner | null {
  if (!isGameFinished(state)) return null;
  if (state.kind === "sentence") {
    if (state.mode === "duel") {
      const { host, guest } = state.mistakes;
      if (host === guest) return "tie";
      return host < guest ? "host" : "guest";
    }
    // Coop scores stay equal — there's no individual winner.
    return "tie";
  }
  const { host, guest } = state.scores;
  if (host === guest) return "tie";
  return host > guest ? "host" : "guest";
}
