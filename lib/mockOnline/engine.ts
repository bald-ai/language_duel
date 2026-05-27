import { SENTENCE_ROUNDS } from "./content";
import { createSentenceState, isSentenceFinished, tapSentence } from "./sentence";
import type { Rng } from "./shuffle";
import type { GameState, Move, MockGame, PlayerSlot } from "./state";

export function createGameState(game: MockGame, rng: Rng = Math.random): GameState {
  switch (game) {
    case "sentence_coop":
      return createSentenceState("coop", SENTENCE_ROUNDS, rng);
    case "sentence_duel":
      return createSentenceState("duel", SENTENCE_ROUNDS, rng);
  }
}

export function applyGameMove(state: GameState, slot: PlayerSlot, move: Move): GameState {
  return move.kind === "tap" ? tapSentence(state, slot, move.tile) : state;
}

export function isGameFinished(state: GameState): boolean {
  return isSentenceFinished(state);
}

export type GameWinner = PlayerSlot | "tie";

export function getWinner(state: GameState): GameWinner | null {
  if (!isGameFinished(state)) return null;
  if (state.mode === "duel") {
    const { host, guest } = state.mistakes;
    if (host === guest) return "tie";
    return host < guest ? "host" : "guest";
  }
  // Coop scores stay equal — there's no individual winner.
  return "tie";
}
