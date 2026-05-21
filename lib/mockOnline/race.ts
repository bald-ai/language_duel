import type { McqContentQuestion, OrderContentRound } from "./content";
import { addScore } from "./players";
import { shuffle, type Rng } from "./shuffle";
import type { McqState, OrderState, PlayerSlot } from "./state";

// ---------------- MCQ race (missing_chunk + speed) ----------------

export function createMcqState(questions: readonly McqContentQuestion[], rng: Rng = Math.random): McqState {
  return {
    kind: "mcq",
    questions: questions.map((question) => ({
      prompt: question.prompt,
      ...(question.sentenceStart !== undefined ? { sentenceStart: question.sentenceStart } : {}),
      ...(question.sentenceEnd !== undefined ? { sentenceEnd: question.sentenceEnd } : {}),
      options: shuffle(question.options, rng),
      correct: question.correct,
    })),
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    lastResolved: null,
  };
}

export function isMcqFinished(state: McqState): boolean {
  return state.index >= state.questions.length;
}

export function answerMcq(state: McqState, slot: PlayerSlot, value: string): McqState {
  if (isMcqFinished(state)) return state;
  if (isLocked(state, slot)) return state;

  const question = state.questions[state.index];
  if (value === question.correct) {
    return advanceMcq(state, slot, question.correct);
  }

  const lockedHost = slot === "host" ? true : state.lockedHost;
  const lockedGuest = slot === "guest" ? true : state.lockedGuest;
  if (lockedHost && lockedGuest) {
    return advanceMcq({ ...state, lockedHost, lockedGuest }, null, question.correct);
  }
  return { ...state, lockedHost, lockedGuest };
}

function isLocked(state: McqState, slot: PlayerSlot): boolean {
  return slot === "host" ? state.lockedHost : state.lockedGuest;
}

function advanceMcq(state: McqState, scorer: PlayerSlot | null, correct: string): McqState {
  return {
    ...state,
    index: state.index + 1,
    scores: scorer ? addScore(state.scores, scorer, 1) : state.scores,
    lockedHost: false,
    lockedGuest: false,
    lastResolved: { index: state.index, correct, scorer },
  };
}

// ---------------- Order race (rebuild_sentence) ----------------

export function createOrderState(rounds: readonly OrderContentRound[], rng: Rng = Math.random): OrderState {
  return {
    kind: "order",
    rounds: rounds.map((round) => ({
      english: round.english,
      words: shuffle(round.correct, rng),
      correctText: round.correct.join(" "),
    })),
    index: 0,
    scores: { host: 0, guest: 0 },
    lockedHost: false,
    lockedGuest: false,
    lastResolved: null,
  };
}

export function isOrderFinished(state: OrderState): boolean {
  return state.index >= state.rounds.length;
}

export function answerOrder(state: OrderState, slot: PlayerSlot, order: readonly number[]): OrderState {
  if (isOrderFinished(state)) return state;
  if (slot === "host" ? state.lockedHost : state.lockedGuest) return state;

  const round = state.rounds[state.index];
  const attempt = reconstruct(round.words, order);
  if (attempt !== null && attempt === round.correctText) {
    return advanceOrder(state, slot, round.correctText);
  }

  const lockedHost = slot === "host" ? true : state.lockedHost;
  const lockedGuest = slot === "guest" ? true : state.lockedGuest;
  if (lockedHost && lockedGuest) {
    return advanceOrder({ ...state, lockedHost, lockedGuest }, null, round.correctText);
  }
  return { ...state, lockedHost, lockedGuest };
}

// Rebuilds the sentence from an ordering of word indices. Returns null when the
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

function advanceOrder(state: OrderState, scorer: PlayerSlot | null, correctText: string): OrderState {
  return {
    ...state,
    index: state.index + 1,
    scores: scorer ? addScore(state.scores, scorer, 1) : state.scores,
    lockedHost: false,
    lockedGuest: false,
    lastResolved: { index: state.index, correctText, scorer },
  };
}
