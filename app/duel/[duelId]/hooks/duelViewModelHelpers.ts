import type { Doc } from "@/convex/_generated/dataModel";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { formatVisibleUser } from "@/lib/userDisplay";
import { PVP_HINT_ELIMINATION_PICKS } from "@/lib/hintPool/constants";
import {
  requireWordQuestion,
  requireWordSessionItem,
  type ViewerSafeDuelQuestion,
} from "./duelSessionTypes";
import type { DuelPlayerSummary } from "./useDuelSessionViewModel";
import type { FrozenData } from "../components/DuelView";

type DuelRole = "challenger" | "opponent";

export type DuelHintFlags = {
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  hintAccepted: boolean;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  canEliminate: boolean;
};

/**
 * The seven cooperative-hint flags for the viewer. This is the single source of
 * truth for hint policy: PvE has no cooperative hints, so it short-circuits to
 * all-false here rather than having a downstream layer discard the result.
 */
export function deriveHintFlags(args: {
  isPve: boolean;
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  hintRequestedBy: string | undefined;
  hintAccepted: boolean | undefined;
  eliminatedOptions: string[];
  myRole: DuelRole;
  theirRole: DuelRole;
}): DuelHintFlags {
  if (args.isPve) {
    return {
      canRequestHint: false,
      iRequestedHint: false,
      theyRequestedHint: false,
      hintAccepted: false,
      canAcceptHint: false,
      isHintProvider: false,
      canEliminate: false,
    };
  }

  const iRequestedHint = args.hintRequestedBy === args.myRole;
  const theyRequestedHint = args.hintRequestedBy === args.theirRole;
  const canAcceptHint = args.hasAnswered && theyRequestedHint && !args.hintAccepted;
  const isHintProvider = args.hasAnswered && theyRequestedHint && !!args.hintAccepted;
  const canEliminate =
    isHintProvider && args.eliminatedOptions.length < PVP_HINT_ELIMINATION_PICKS;

  return {
    canRequestHint:
      !args.hasAnswered && args.opponentHasAnswered && !args.hintRequestedBy,
    iRequestedHint,
    theyRequestedHint,
    hintAccepted: !!args.hintAccepted,
    canAcceptHint,
    isHintProvider,
    canEliminate,
  };
}

/** Resolve the viewer's and opponent's display names for the scoreboard. */
export function deriveScoreNames(
  isChallenger: boolean,
  challenger: DuelPlayerSummary | null,
  opponent: DuelPlayerSummary | null
): { myName: string; theirName: string } {
  return {
    myName: formatVisibleUser(isChallenger ? challenger : opponent, "You"),
    theirName: formatVisibleUser(isChallenger ? opponent : challenger, "Opponent"),
  };
}

/**
 * Reconstruct the "frozen" snapshot of the just-answered word question shown
 * during the reveal/transition phase. Pure on purpose: the phase machine
 * (`useDuelPhaseState`) owns *when* to freeze; this owns *what* the frozen card
 * contains. Word-only — `prevIndex` landing on a sentence position throws via
 * the narrowing helpers rather than silently rendering an empty grid.
 */
export function buildFrozenData(args: {
  duel: Doc<"duels">;
  prevIndex: number;
  lockedAnswer: string | null;
  theirLastAnswer: string | null | undefined;
}): FrozenData {
  const { duel, prevIndex, lockedAnswer, theirLastAnswer } = args;

  const prevActualIndex = duel.wordOrder[prevIndex];
  const rawPrev = duel.sessionWords[prevActualIndex];
  const prevWord = rawPrev
    ? requireWordSessionItem(rawPrev)
    : { word: "", answer: "", wrongAnswers: [] };
  const prevQuestion = requireWordQuestion(
    duel.duelQuestions![prevIndex] as ViewerSafeDuelQuestion
  );
  const prevCorrectOption = prevQuestion.correctOption ?? null;

  return {
    word: prevWord.word,
    correctAnswer:
      prevQuestion.answerRevealedToViewer === true ? prevWord.answer : null,
    shuffledAnswers: prevQuestion.options,
    selectedAnswer: lockedAnswer,
    opponentAnswer: theirLastAnswer || null,
    wordIndex: prevIndex,
    hasNoneOption:
      prevCorrectOption === null ? null : prevCorrectOption === NONE_OF_ABOVE,
    difficulty: {
      level: prevQuestion.difficulty,
      points: prevQuestion.points,
    },
  };
}
