import type { MemoryPair } from "./content";
import { addScore, otherSlot } from "./players";
import { shuffle, type Rng } from "./shuffle";
import type { MemoryState, PlayerSlot } from "./state";

export function createMemoryState(pairs: readonly MemoryPair[], rng: Rng = Math.random): MemoryState {
  const cards = shuffle(
    pairs.flatMap((pair, pairId) => [
      { pairId, face: pair.es },
      { pairId, face: pair.en },
    ]),
    rng
  );
  return {
    kind: "memory",
    cards,
    matched: [],
    firstPick: null,
    lastMismatch: null,
    turn: "host",
    scores: { host: 0, guest: 0 },
  };
}

export function isMemoryFinished(state: MemoryState): boolean {
  return state.cards.length > 0 && state.matched.length === state.cards.length;
}

export function applyMemoryFlip(state: MemoryState, slot: PlayerSlot, index: number): MemoryState {
  if (isMemoryFinished(state)) return state;
  if (state.turn !== slot) return state;
  if (index < 0 || index >= state.cards.length) return state;
  if (state.matched.includes(index)) return state;
  if (state.firstPick === index) return state;

  if (state.firstPick === null) {
    return { ...state, firstPick: index, lastMismatch: null };
  }

  const first = state.firstPick;
  const isMatch = state.cards[first].pairId === state.cards[index].pairId;
  if (isMatch) {
    // Matching keeps the turn so a skilled player can run the board.
    return {
      ...state,
      matched: [...state.matched, first, index],
      firstPick: null,
      lastMismatch: null,
      scores: addScore(state.scores, slot, 1),
    };
  }
  return { ...state, firstPick: null, lastMismatch: [first, index], turn: otherSlot(slot) };
}
