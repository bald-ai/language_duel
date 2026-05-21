import { describe, expect, it } from "vitest";
import {
  applyGameMove,
  createGameState,
  getWinner,
  isGameFinished,
} from "@/lib/mockOnline/engine";
import { applyMemoryFlip, createMemoryState, isMemoryFinished } from "@/lib/mockOnline/memory";
import {
  answerMcq,
  answerOrder,
  createMcqState,
  createOrderState,
  isMcqFinished,
  isOrderFinished,
} from "@/lib/mockOnline/race";
import type { McqState, MemoryState, OrderState } from "@/lib/mockOnline/state";

const fixedRng = () => 0;

function memoryState(overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    kind: "memory",
    cards: [
      { pairId: 0, face: "casa" },
      { pairId: 1, face: "perro" },
      { pairId: 0, face: "house" },
      { pairId: 1, face: "dog" },
    ],
    matched: [],
    firstPick: null,
    lastMismatch: null,
    turn: "host",
    scores: { host: 0, guest: 0 },
    ...overrides,
  };
}

function mcqState(overrides: Partial<McqState> = {}): McqState {
  return {
    kind: "mcq",
    questions: [
      { prompt: "dog", options: ["perro", "gato", "pez"], correct: "perro" },
      { prompt: "cat", options: ["gato", "perro", "pez"], correct: "gato" },
    ],
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    lastResolved: null,
    ...overrides,
  };
}

function orderState(overrides: Partial<OrderState> = {}): OrderState {
  return {
    kind: "order",
    rounds: [{ english: "I want water", words: ["agua", "Yo", "quiero"], correctText: "Yo quiero agua" }],
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    lastResolved: null,
    ...overrides,
  };
}

describe("memory", () => {
  it("creates two cards per pair with empty progress", () => {
    const state = createMemoryState([{ es: "casa", en: "house" }, { es: "sol", en: "sun" }], fixedRng);
    expect(state.cards).toHaveLength(4);
    expect(state.matched).toEqual([]);
    expect(state.turn).toBe("host");
    expect(state.cards.filter((c) => c.pairId === 0)).toHaveLength(2);
  });

  it("records the first pick", () => {
    const next = applyMemoryFlip(memoryState(), "host", 0);
    expect(next.firstPick).toBe(0);
  });

  it("scores and keeps the turn on a match", () => {
    const next = applyMemoryFlip(memoryState({ firstPick: 0 }), "host", 2);
    expect(next.matched).toEqual([0, 2]);
    expect(next.scores).toEqual({ host: 1, guest: 0 });
    expect(next.turn).toBe("host");
    expect(next.firstPick).toBeNull();
  });

  it("switches the turn and reveals on a mismatch", () => {
    const next = applyMemoryFlip(memoryState({ firstPick: 0 }), "host", 1);
    expect(next.turn).toBe("guest");
    expect(next.lastMismatch).toEqual([0, 1]);
    expect(next.scores).toEqual({ host: 0, guest: 0 });
  });

  it("ignores flips out of turn, on matched cards, and the same card twice", () => {
    expect(applyMemoryFlip(memoryState(), "guest", 0)).toEqual(memoryState());
    expect(applyMemoryFlip(memoryState({ matched: [0, 2] }), "host", 0)).toEqual(memoryState({ matched: [0, 2] }));
    expect(applyMemoryFlip(memoryState({ firstPick: 0 }), "host", 0)).toEqual(memoryState({ firstPick: 0 }));
    expect(applyMemoryFlip(memoryState(), "host", 99)).toEqual(memoryState());
  });

  it("detects completion and a winner", () => {
    const finished = memoryState({ matched: [0, 1, 2, 3], scores: { host: 2, guest: 0 } });
    expect(isMemoryFinished(finished)).toBe(true);
    expect(getWinner(finished)).toBe("host");
    expect(applyMemoryFlip(finished, "host", 0)).toEqual(finished);
  });
});

describe("mcq race", () => {
  it("scores the first correct answer and advances", () => {
    const next = answerMcq(mcqState(), "host", "perro");
    expect(next.index).toBe(1);
    expect(next.scores).toEqual({ host: 1, guest: 0 });
    expect(next.lastResolved).toEqual({ index: 0, correct: "perro", scorer: "host" });
  });

  it("locks a player on a wrong answer without advancing", () => {
    const next = answerMcq(mcqState(), "host", "gato");
    expect(next.index).toBe(0);
    expect(next.lockedHost).toBe(true);
    expect(next.scores).toEqual({ host: 0, guest: 0 });
  });

  it("advances with no points when both players are wrong", () => {
    const afterHost = answerMcq(mcqState(), "host", "gato");
    const afterBoth = answerMcq(afterHost, "guest", "pez");
    expect(afterBoth.index).toBe(1);
    expect(afterBoth.scores).toEqual({ host: 0, guest: 0 });
    expect(afterBoth.lastResolved?.scorer).toBeNull();
  });

  it("ignores answers from a locked player", () => {
    const locked = mcqState({ lockedHost: true });
    expect(answerMcq(locked, "host", "perro")).toEqual(locked);
  });

  it("is finished when past the last question", () => {
    expect(isMcqFinished(mcqState({ index: 2 }))).toBe(true);
    expect(answerMcq(mcqState({ index: 2 }), "host", "perro").index).toBe(2);
  });

  it("reports a tie when scores are equal at the end", () => {
    expect(getWinner(mcqState({ index: 2, scores: { host: 1, guest: 1 } }))).toBe("tie");
  });
});

describe("order race", () => {
  it("scores a correct ordering", () => {
    const next = answerOrder(orderState(), "guest", [1, 2, 0]);
    expect(next.index).toBe(1);
    expect(next.scores).toEqual({ host: 0, guest: 1 });
  });

  it("locks on a wrong ordering", () => {
    const next = answerOrder(orderState(), "host", [0, 1, 2]);
    expect(next.lockedHost).toBe(true);
    expect(next.index).toBe(0);
  });

  it("treats invalid permutations as wrong", () => {
    expect(answerOrder(orderState(), "host", [0, 1]).lockedHost).toBe(true);
    expect(answerOrder(orderState(), "host", [0, 0, 1]).lockedHost).toBe(true);
    expect(answerOrder(orderState(), "host", [0, 1, 9]).lockedHost).toBe(true);
  });

  it("advances with no points when both are wrong", () => {
    const afterHost = answerOrder(orderState(), "host", [0, 1, 2]);
    const afterBoth = answerOrder(afterHost, "guest", [2, 1, 0]);
    expect(afterBoth.index).toBe(1);
    expect(isOrderFinished(afterBoth)).toBe(true);
    expect(afterBoth.scores).toEqual({ host: 0, guest: 0 });
  });
});

describe("engine dispatch", () => {
  it("builds initial state for each game", () => {
    expect(createGameState("memory", fixedRng).kind).toBe("memory");
    expect(createGameState("missing_chunk", fixedRng).kind).toBe("mcq");
    expect(createGameState("speed", fixedRng).kind).toBe("mcq");
    expect(createGameState("rebuild_sentence", fixedRng).kind).toBe("order");
  });

  it("bakes the correct answer into every generated question", () => {
    const missing = createMcqState([{ prompt: "x", options: ["a", "b"], correct: "a" }], fixedRng);
    expect(missing.questions[0].options).toContain("a");
    const order = createOrderState([{ english: "x", correct: ["uno", "dos"] }], fixedRng);
    expect([...order.rounds[0].words].sort()).toEqual(["dos", "uno"]);
    expect(order.rounds[0].correctText).toBe("uno dos");
  });

  it("routes moves to the matching engine and ignores mismatched moves", () => {
    const memory = createGameState("memory", fixedRng);
    expect(applyGameMove(memory, "host", { kind: "answer", value: "x" })).toEqual(memory);
    const flipped = applyGameMove(memory, "host", { kind: "flip", index: 0 });
    expect(flipped.kind === "memory" && flipped.firstPick).toBe(0);

    const mcq = createGameState("missing_chunk", fixedRng);
    expect(applyGameMove(mcq, "host", { kind: "flip", index: 0 })).toEqual(mcq);
  });

  it("reports no winner while a game is unfinished", () => {
    expect(isGameFinished(createGameState("speed", fixedRng))).toBe(false);
    expect(getWinner(createGameState("speed", fixedRng))).toBeNull();
  });
});
