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
  submitSentence,
  tapSentence,
} from "@/lib/mockOnline/sentence";
import type { SentenceMode, SentenceRound, SentenceState } from "@/lib/mockOnline/state";

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

function sentenceState(mode: SentenceMode, overrides: Partial<SentenceState> = {}): SentenceState {
  return {
    kind: "sentence",
    mode,
    rounds: [round(), round()],
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    placed: [],
    turn: "host",
    lastError: null,
    lastResolved: null,
    ...overrides,
  };
}

describe("createSentenceState", () => {
  it("scrambles words but keeps the solution and joined text", () => {
    const state = createSentenceState("duel", [{ english: "I drink water", correct: ["Yo", "bebo", "agua"] }], fixedRng);
    expect(state.kind).toBe("sentence");
    expect(state.mode).toBe("duel");
    expect(state.rounds[0].solution).toEqual(["Yo", "bebo", "agua"]);
    expect([...state.rounds[0].words].sort()).toEqual(["Yo", "bebo", "agua"].sort());
    expect(state.rounds[0].correctText).toBe("Yo bebo agua");
    expect(state.turn).toBe("host");
    expect(state.placed).toEqual([]);
  });

  it("knows when the deck is finished", () => {
    expect(isSentenceFinished(sentenceState("race", { index: 2 }))).toBe(true);
    expect(isSentenceFinished(sentenceState("race"))).toBe(false);
  });
});

describe("sentence race", () => {
  it("scores a correct submission and advances", () => {
    const next = submitSentence(sentenceState("race"), "host", [1, 2, 0]);
    expect(next.index).toBe(1);
    expect(next.scores).toEqual({ host: 1, guest: 0 });
    expect(next.lastResolved).toEqual({ index: 0, correctText: "Yo bebo agua", scorer: "host" });
  });

  it("locks a wrong submission without advancing", () => {
    const next = submitSentence(sentenceState("race"), "host", [0, 1, 2]);
    expect(next.index).toBe(0);
    expect(next.lockedHost).toBe(true);
    expect(next.scores).toEqual({ host: 0, guest: 0 });
  });

  it("advances with no score when both players submit wrong", () => {
    const afterHost = submitSentence(sentenceState("race"), "host", [0, 1, 2]);
    const afterBoth = submitSentence(afterHost, "guest", [2, 1, 0]);
    expect(afterBoth.index).toBe(1);
    expect(afterBoth.scores).toEqual({ host: 0, guest: 0 });
    expect(afterBoth.lastResolved?.scorer).toBeNull();
  });

  it("treats invalid permutations as wrong", () => {
    expect(submitSentence(sentenceState("race"), "host", [0, 1]).lockedHost).toBe(true);
    expect(submitSentence(sentenceState("race"), "host", [0, 0, 1]).lockedHost).toBe(true);
    expect(submitSentence(sentenceState("race"), "host", [0, 1, 9]).lockedHost).toBe(true);
  });

  it("ignores submissions from a locked player and taps in race mode", () => {
    const locked = sentenceState("race", { lockedHost: true });
    expect(submitSentence(locked, "host", [1, 2, 0])).toEqual(locked);
    const fresh = sentenceState("race");
    expect(tapSentence(fresh, "host", 1)).toEqual(fresh);
  });
});

describe("sentence coop", () => {
  it("ignores a tap when it is not your turn", () => {
    const state = sentenceState("coop", { turn: "host" });
    expect(tapSentence(state, "guest", 1)).toEqual(state);
  });

  it("places a correct word and passes the turn", () => {
    const next = tapSentence(sentenceState("coop"), "host", 1);
    expect(next.placed).toEqual([1]);
    expect(next.turn).toBe("guest");
    expect(next.lastError).toBeNull();
    expect(next.scores).toEqual({ host: 0, guest: 0 });
  });

  it("passes the turn and flags the error on a wrong word", () => {
    const next = tapSentence(sentenceState("coop"), "host", 0);
    expect(next.placed).toEqual([]);
    expect(next.turn).toBe("guest");
    expect(next.lastError).toBe("host");
  });

  it("banks a shared point and advances when the sentence is complete", () => {
    let state = sentenceState("coop");
    state = tapSentence(state, "host", 1);
    state = tapSentence(state, "guest", 2);
    state = tapSentence(state, "host", 0);
    expect(state.index).toBe(1);
    expect(state.placed).toEqual([]);
    expect(state.scores).toEqual({ host: 1, guest: 1 });
    expect(state.lastResolved).toEqual({ index: 0, correctText: "Yo bebo agua", scorer: "shared" });
    expect(state.turn).toBe("guest");
  });
});

describe("sentence duel", () => {
  it("scores and keeps your turn on a correct word", () => {
    const next = tapSentence(sentenceState("duel"), "host", 1);
    expect(next.placed).toEqual([1]);
    expect(next.scores).toEqual({ host: 1, guest: 0 });
    expect(next.turn).toBe("host");
    expect(next.lastError).toBeNull();
  });

  it("loses your turn with no score on a wrong word", () => {
    const next = tapSentence(sentenceState("duel"), "host", 0);
    expect(next.placed).toEqual([]);
    expect(next.scores).toEqual({ host: 0, guest: 0 });
    expect(next.turn).toBe("guest");
    expect(next.lastError).toBe("host");
  });

  it("awards each word to whoever placed it and advances on completion", () => {
    let state = sentenceState("duel");
    state = tapSentence(state, "host", 1); // "Yo" correct, host keeps turn
    state = tapSentence(state, "host", 0); // wrong, turn passes to guest
    expect(state.scores).toEqual({ host: 1, guest: 0 });
    expect(state.turn).toBe("guest");
    state = tapSentence(state, "guest", 2); // "bebo" correct, guest keeps turn
    state = tapSentence(state, "guest", 0); // "agua" completes the sentence
    expect(state.index).toBe(1);
    expect(state.scores).toEqual({ host: 1, guest: 2 });
    expect(state.lastResolved).toEqual({ index: 0, correctText: "Yo bebo agua", scorer: "guest" });
    expect(state.turn).toBe("guest");
  });
});

describe("sentence dispatch", () => {
  it("builds sentence state for each mode", () => {
    expect(createGameState("sentence_race", fixedRng)).toMatchObject({ kind: "sentence", mode: "race" });
    expect(createGameState("sentence_coop", fixedRng)).toMatchObject({ kind: "sentence", mode: "coop" });
    expect(createGameState("sentence_duel", fixedRng)).toMatchObject({ kind: "sentence", mode: "duel" });
  });

  it("routes moves to the engine and ignores cross-mode moves", () => {
    const race = createGameState("sentence_race", fixedRng);
    expect(applyGameMove(race, "host", { kind: "tap", tile: 0 })).toEqual(race);
    const coop = createGameState("sentence_coop", fixedRng);
    expect(applyGameMove(coop, "host", { kind: "submit", order: [0] })).toEqual(coop);
  });

  it("reports finished and a winner from scores", () => {
    const finished = sentenceState("duel", { index: 2, scores: { host: 3, guest: 1 } });
    expect(isGameFinished(finished)).toBe(true);
    expect(getWinner(finished)).toBe("host");
  });
});
