import { describe, expect, it } from "vitest";
import {
  applyGameMove,
  createGameState,
  getWinner,
  isGameFinished,
} from "@/lib/mockOnline/engine";
import {
  createSentenceState,
  isSentenceFinished,
  tapSentence,
} from "@/lib/mockOnline/sentence";
import type {
  SentenceCoopState,
  SentenceDuelState,
  SentenceRound,
} from "@/lib/mockOnline/state";

const fixedRng = () => 0;

// Scrambled words: tile 0 = "agua", tile 1 = "Yo", tile 2 = "bebo".
// Correct build order is therefore tiles [1, 2, 0] -> "Yo bebo agua".
function round(): SentenceRound {
  return {
    english: "I drink water",
    words: ["agua", "Yo", "bebo"],
    solution: ["Yo", "bebo", "agua"],
    correctText: "Yo bebo agua",
  };
}

function coopState(overrides: Partial<SentenceCoopState> = {}): SentenceCoopState {
  return {
    kind: "sentence",
    mode: "coop",
    rounds: [round(), round()],
    index: 0,
    scores: { host: 0, guest: 0 },
    placed: [],
    turn: "host",
    lastError: null,
    lastResolved: null,
    ...overrides,
  };
}

function duelState(overrides: Partial<SentenceDuelState> = {}): SentenceDuelState {
  return {
    kind: "sentence",
    mode: "duel",
    rounds: [round(), round()],
    index: 0,
    mistakes: { host: 0, guest: 0 },
    placedHost: [],
    placedGuest: [],
    doneHost: false,
    doneGuest: false,
    lastError: null,
    lastResolved: null,
    ...overrides,
  };
}

describe("createSentenceState", () => {
  it("creates the coop shape", () => {
    const state = createSentenceState("coop", [{ english: "I drink water", correct: ["Yo", "bebo", "agua"] }], fixedRng);
    expect(state.kind).toBe("sentence");
    expect(state.mode).toBe("coop");
    if (state.mode !== "coop") throw new Error("expected coop");
    expect(state.turn).toBe("host");
    expect(state.placed).toEqual([]);
  });

  it("creates the duel shape with separate boards", () => {
    const state = createSentenceState("duel", [{ english: "I drink water", correct: ["Yo", "bebo", "agua"] }], fixedRng);
    expect(state.mode).toBe("duel");
    if (state.mode !== "duel") throw new Error("expected duel");
    expect(state.placedHost).toEqual([]);
    expect(state.placedGuest).toEqual([]);
    expect(state.doneHost).toBe(false);
    expect(state.doneGuest).toBe(false);
    expect(state.mistakes).toEqual({ host: 0, guest: 0 });
  });

  it("knows when the deck is finished", () => {
    expect(isSentenceFinished(coopState({ index: 2 }))).toBe(true);
    expect(isSentenceFinished(coopState())).toBe(false);
  });
});

describe("sentence coop", () => {
  it("ignores a tap when it is not your turn", () => {
    const state = coopState({ turn: "host" });
    expect(tapSentence(state, "guest", 1)).toEqual(state);
  });

  it("places a correct word and passes the turn", () => {
    const next = tapSentence(coopState(), "host", 1) as SentenceCoopState;
    expect(next.placed).toEqual([1]);
    expect(next.turn).toBe("guest");
    expect(next.lastError).toBeNull();
  });

  it("passes the turn and flags the error on a wrong word", () => {
    const next = tapSentence(coopState(), "host", 0) as SentenceCoopState;
    expect(next.placed).toEqual([]);
    expect(next.turn).toBe("guest");
    expect(next.lastError).toBe("host");
  });

  it("lets the partner continue placing after a wrong tap", () => {
    let state = tapSentence(coopState(), "host", 0) as SentenceCoopState; // wrong -> guest
    state = tapSentence(state, "guest", 1) as SentenceCoopState; // correct -> host
    expect(state.placed).toEqual([1]);
    expect(state.turn).toBe("host");
    expect(state.lastError).toBeNull();
  });

  it("banks a shared point and advances when the sentence is complete", () => {
    let state = coopState();
    state = tapSentence(state, "host", 1) as SentenceCoopState;
    state = tapSentence(state, "guest", 2) as SentenceCoopState;
    state = tapSentence(state, "host", 0) as SentenceCoopState;
    expect(state.index).toBe(1);
    expect(state.placed).toEqual([]);
    expect(state.scores).toEqual({ host: 1, guest: 1 });
    expect(state.lastResolved).toEqual({ index: 0, correctText: "Yo bebo agua" });
    expect(state.turn).toBe("guest");
  });
});

describe("sentence duel (per-player boards)", () => {
  it("each player builds their own board independently", () => {
    let state = duelState();
    state = tapSentence(state, "host", 1) as SentenceDuelState;
    state = tapSentence(state, "guest", 1) as SentenceDuelState;
    expect(state.placedHost).toEqual([1]);
    expect(state.placedGuest).toEqual([1]);
    expect(state.mistakes).toEqual({ host: 0, guest: 0 });
  });

  it("rejects a wrong tap (nothing placed) and adds a mistake", () => {
    const next = tapSentence(duelState(), "host", 0) as SentenceDuelState;
    expect(next.placedHost).toEqual([]);
    expect(next.mistakes).toEqual({ host: 1, guest: 0 });
    expect(next.lastError).toBe("host");
    expect(next.doneHost).toBe(false);
  });

  it("accumulates mistakes without ending the player's turn", () => {
    let state = duelState();
    state = tapSentence(state, "host", 0) as SentenceDuelState; // wrong
    state = tapSentence(state, "host", 2) as SentenceDuelState; // wrong
    state = tapSentence(state, "host", 1) as SentenceDuelState; // correct
    expect(state.placedHost).toEqual([1]);
    expect(state.mistakes).toEqual({ host: 2, guest: 0 });
  });

  it("marks a player done when they complete their sentence and waits for the other", () => {
    let state = duelState();
    state = tapSentence(state, "host", 1) as SentenceDuelState;
    state = tapSentence(state, "host", 2) as SentenceDuelState;
    state = tapSentence(state, "host", 0) as SentenceDuelState;
    expect(state.doneHost).toBe(true);
    expect(state.doneGuest).toBe(false);
    expect(state.index).toBe(0);
    expect(state.placedHost).toEqual([1, 2, 0]);
  });

  it("ignores further taps from a player who is already done", () => {
    let state = duelState({ doneHost: true, placedHost: [1, 2, 0] });
    state = tapSentence(state, "host", 0) as SentenceDuelState;
    expect(state.placedHost).toEqual([1, 2, 0]);
    expect(state.mistakes).toEqual({ host: 0, guest: 0 });
  });

  it("advances to the next sentence when both players finish", () => {
    let state = duelState();
    // host builds full sentence
    state = tapSentence(state, "host", 1) as SentenceDuelState;
    state = tapSentence(state, "host", 2) as SentenceDuelState;
    state = tapSentence(state, "host", 0) as SentenceDuelState;
    // guest builds full sentence (with one wrong pick mid-way)
    state = tapSentence(state, "guest", 1) as SentenceDuelState;
    state = tapSentence(state, "guest", 0) as SentenceDuelState; // wrong (expected "bebo")
    state = tapSentence(state, "guest", 2) as SentenceDuelState;
    state = tapSentence(state, "guest", 0) as SentenceDuelState;

    expect(state.index).toBe(1);
    expect(state.placedHost).toEqual([]);
    expect(state.placedGuest).toEqual([]);
    expect(state.doneHost).toBe(false);
    expect(state.doneGuest).toBe(false);
    expect(state.mistakes).toEqual({ host: 0, guest: 1 });
    expect(state.lastResolved).toEqual({ index: 0, correctText: "Yo bebo agua" });
  });
});

describe("sentence dispatch", () => {
  it("builds sentence state for each mode", () => {
    expect(createGameState("sentence_coop", fixedRng)).toMatchObject({ kind: "sentence", mode: "coop" });
    expect(createGameState("sentence_duel", fixedRng)).toMatchObject({ kind: "sentence", mode: "duel" });
  });

  it("routes tap moves and ignores unknown moves", () => {
    const coop = createGameState("sentence_coop", fixedRng);
    expect(applyGameMove(coop, "host", { kind: "answer", value: "x" })).toEqual(coop);
    const duel = createGameState("sentence_duel", fixedRng);
    expect(applyGameMove(duel, "host", { kind: "order", order: [0] })).toEqual(duel);
  });

  it("reports a duel winner from mistakes (lower wins)", () => {
    const finished = duelState({ index: 2, mistakes: { host: 1, guest: 3 } });
    expect(isGameFinished(finished)).toBe(true);
    expect(getWinner(finished)).toBe("host");
  });

  it("reports a tie when duel mistakes are equal", () => {
    const finished = duelState({ index: 2, mistakes: { host: 2, guest: 2 } });
    expect(getWinner(finished)).toBe("tie");
  });

  it("reports a tie for coop at the end (no individual winner)", () => {
    const finished = coopState({ index: 2, scores: { host: 2, guest: 2 } });
    expect(getWinner(finished)).toBe("tie");
  });
});
