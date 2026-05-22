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
import {
  advanceRelay,
  answerRelay,
  createRelayState,
  isRelayFinished,
  pickRelayWord,
} from "@/lib/mockOnline/relay";
import { RELAY_WORDS } from "@/lib/mockOnline/content";
import { otherSlot } from "@/lib/mockOnline/players";
import type { GameState, McqState, MemoryState, OrderState, RelayState, RelayWord } from "@/lib/mockOnline/state";

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

const mapWord: RelayWord = {
  id: "map",
  prompt: "map",
  answer: "mapa",
  options: ["mapa", "carta", "calle", "libro", "plano", "guía"],
};
const airportWord: RelayWord = {
  id: "airport",
  prompt: "airport",
  answer: "aeropuerto",
  options: ["aeropuerto", "estación", "puerto", "frontera", "carretera", "muelle"],
};

function relayState(overrides: Partial<RelayState> = {}): RelayState {
  return {
    kind: "relay",
    pool: [mapWord, airportWord],
    total: 2,
    picker: "host",
    phase: "pick",
    assigned: null,
    scores: { host: 0, guest: 0 },
    resolved: 0,
    lastResult: null,
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

describe("relay duel", () => {
  it("builds a shuffled pool with six options that include the answer", () => {
    const state = createRelayState(RELAY_WORDS, fixedRng);
    expect(state.kind).toBe("relay");
    expect(state.pool).toHaveLength(RELAY_WORDS.length);
    expect(state.total).toBe(RELAY_WORDS.length);
    expect(state.picker).toBe("host");
    expect(state.phase).toBe("pick");
    for (const word of state.pool) {
      expect(word.options).toContain(word.answer);
      expect(word.options).toHaveLength(6);
    }
  });

  it("hands the picked word to the rival and flips to the answer phase", () => {
    const next = pickRelayWord(relayState(), "host", "map");
    expect(next.phase).toBe("answer");
    expect(next.assigned?.id).toBe("map");
    expect(next.pool.map((word) => word.id)).toEqual(["airport"]);
  });

  it("ignores a pick out of turn, in the wrong phase, or of an unknown word", () => {
    expect(pickRelayWord(relayState(), "guest", "map")).toEqual(relayState());
    const answering = relayState({ phase: "answer", assigned: mapWord, pool: [airportWord] });
    expect(pickRelayWord(answering, "host", "airport")).toEqual(answering);
    expect(pickRelayWord(relayState(), "host", "nope")).toEqual(relayState());
  });

  it("reveals a correct answer in the feedback phase before advancing", () => {
    const answering = relayState({ phase: "answer", assigned: mapWord, pool: [airportWord] });
    const revealed = answerRelay(answering, "guest", "mapa");
    // Feedback keeps the word on screen and the picker unchanged until advance.
    expect(revealed.phase).toBe("feedback");
    expect(revealed.scores).toEqual({ host: 0, guest: 1 });
    expect(revealed.picker).toBe("host");
    expect(revealed.assigned?.id).toBe("map");
    expect(revealed.resolved).toBe(0);
    expect(revealed.lastResult).toEqual({
      prompt: "map",
      answer: "mapa",
      chosen: "mapa",
      correct: true,
      scorer: "guest",
    });

    const advanced = advanceRelay(revealed, "guest");
    expect(advanced.phase).toBe("pick");
    expect(advanced.picker).toBe("guest");
    expect(advanced.assigned).toBeNull();
    expect(advanced.resolved).toBe(1);
  });

  it("reveals a wrong answer with no points, then advances", () => {
    const answering = relayState({ phase: "answer", assigned: mapWord, pool: [airportWord] });
    const revealed = answerRelay(answering, "guest", "carta");
    expect(revealed.phase).toBe("feedback");
    expect(revealed.scores).toEqual({ host: 0, guest: 0 });
    expect(revealed.lastResult?.correct).toBe(false);
    expect(revealed.lastResult?.scorer).toBeNull();

    const advanced = advanceRelay(revealed, "guest");
    expect(advanced.phase).toBe("pick");
    expect(advanced.picker).toBe("guest");
    expect(advanced.resolved).toBe(1);
  });

  it("ignores answers from the picker or in the pick phase", () => {
    const answering = relayState({ phase: "answer", assigned: mapWord, pool: [airportWord] });
    expect(answerRelay(answering, "host", "mapa")).toEqual(answering);
    expect(answerRelay(relayState(), "guest", "mapa")).toEqual(relayState());
  });

  it("only lets the answerer leave the feedback reveal", () => {
    const feedback = relayState({ phase: "feedback", assigned: mapWord, pool: [airportWord] });
    expect(advanceRelay(feedback, "host")).toEqual(feedback); // host is the picker, not the answerer
    expect(advanceRelay(relayState(), "guest")).toEqual(relayState()); // not in feedback
    expect(advanceRelay(feedback, "guest").phase).toBe("pick");
  });

  it("is finished only once the pool is empty and nothing is in flight", () => {
    expect(isRelayFinished(relayState({ pool: [], assigned: null }))).toBe(true);
    expect(isRelayFinished(relayState({ pool: [], assigned: mapWord, phase: "feedback" }))).toBe(false);
    const finished = relayState({ pool: [], assigned: null, scores: { host: 3, guest: 1 } });
    expect(getWinner(finished)).toBe("host");
  });

  // Drives a whole game through the public dispatch the way two clients would:
  // the picker hands the top word over, the rival answers it, then becomes the
  // next picker — until the shared pool is exhausted.
  function playAllCorrect(): GameState {
    let state = createGameState("relay", fixedRng);
    let guard = 0;
    while (!isGameFinished(state) && guard < 100) {
      guard += 1;
      if (state.kind !== "relay") break;
      if (state.phase === "pick") {
        state = applyGameMove(state, state.picker, { kind: "pick", wordId: state.pool[0].id });
      } else if (state.phase === "answer" && state.assigned) {
        state = applyGameMove(state, otherSlot(state.picker), { kind: "answer", value: state.assigned.answer });
      } else if (state.phase === "feedback") {
        state = applyGameMove(state, otherSlot(state.picker), { kind: "next" });
      }
    }
    return state;
  }

  it("plays a full game where every correct answer banks one point", () => {
    const state = playAllCorrect();
    expect(state.kind).toBe("relay");
    if (state.kind !== "relay") return;
    expect(isRelayFinished(state)).toBe(true);
    expect(state.resolved).toBe(RELAY_WORDS.length);
    expect(state.scores.host + state.scores.guest).toBe(RELAY_WORDS.length);
    // Roles strictly alternate, so each player answers half of the eight words.
    expect(state.scores).toEqual({ host: 4, guest: 4 });
  });
});

describe("engine dispatch", () => {
  it("builds initial state for each game", () => {
    expect(createGameState("memory", fixedRng).kind).toBe("memory");
    expect(createGameState("missing_chunk", fixedRng).kind).toBe("mcq");
    expect(createGameState("speed", fixedRng).kind).toBe("mcq");
    expect(createGameState("rebuild_sentence", fixedRng).kind).toBe("order");
    expect(createGameState("relay", fixedRng).kind).toBe("relay");
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

    const relay = relayState();
    const pickedId = relay.pool[0].id;
    const picked = applyGameMove(relay, "host", { kind: "pick", wordId: pickedId });
    expect(picked.kind === "relay" && picked.phase).toBe("answer");
    expect(applyGameMove(relay, "host", { kind: "flip", index: 0 })).toEqual(relay);
  });

  it("reports no winner while a game is unfinished", () => {
    expect(isGameFinished(createGameState("speed", fixedRng))).toBe(false);
    expect(getWinner(createGameState("speed", fixedRng))).toBeNull();
  });
});
