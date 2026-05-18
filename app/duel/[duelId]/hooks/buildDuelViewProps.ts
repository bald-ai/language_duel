import type { Doc } from "@/convex/_generated/dataModel";
import { MAX_SABOTAGES } from "@/lib/sabotage/constants";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { formatVisibleUser } from "@/lib/userDisplay";
import type {
  DifficultyPillData,
  DuelViewProps,
  FrozenData,
} from "../components/DuelView";
import type { SabotagePhase } from "./useSabotageEffect";
import type { DuelPlayerSummary } from "./useDuelSessionViewModel";

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

export function deriveHintFlags(args: {
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  hintRequestedBy: string | undefined;
  hintAccepted: boolean | undefined;
  eliminatedOptions: string[];
  myRole: DuelRole;
  theirRole: DuelRole;
}): DuelHintFlags {
  const iRequestedHint = args.hintRequestedBy === args.myRole;
  const theyRequestedHint = args.hintRequestedBy === args.theirRole;
  const canAcceptHint = args.hasAnswered && theyRequestedHint && !args.hintAccepted;
  const isHintProvider = args.hasAnswered && theyRequestedHint && !!args.hintAccepted;
  const canEliminate = isHintProvider && args.eliminatedOptions.length < 2;

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

export type DuelViewPropsInput = {
  duel: Doc<"duels">;
  viewerRole: DuelRole;
  isChallenger: boolean;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  index: number;
  word: string;
  sourceThemeName: string | null;
  frozenData: FrozenData | null;
  difficulty: DifficultyPillData;
  duelDuration: number;
  questionTimer: number | null;
  countdownValue: number | null;
  phase: "idle" | "answering" | "transition";
  shuffledAnswers: string[];
  selectedAnswer: string | null;
  currentCorrectAnswer: string | null;
  hasNoneOption: boolean | null;
  eliminatedOptions: string[];
  opponentLastAnswer: string | null | undefined;
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  isLocked: boolean;
  activeSabotage: SabotageEffect | null;
  sabotagePhase: SabotagePhase;
  isOutgoingSabotageActive: boolean;
  myScore: number;
  theirScore: number;
  mySabotagesUsed: number;
  hints: DuelHintFlags;
  isPlayingAudio: boolean;
  callbacks: DuelViewCallbacks;
};

export type DuelViewCallbacks = {
  onPauseCountdown: () => void;
  onRequestUnpause: () => void;
  onConfirmUnpause: () => void;
  onSkipCountdown: () => void;
  onPlayAudio: () => void;
  onOptionClick: (ans: string, canEliminateThis: boolean, isEliminated: boolean) => void;
  onConfirmAnswer: () => void;
  onRequestHint: () => void;
  onAcceptHint: () => void;
  onSendSabotage: (effect: SabotageEffect) => void;
  onExit: () => void;
  onBackToHome: () => void;
};

export function buildDuelViewProps(input: DuelViewPropsInput): DuelViewProps {
  const myName = formatVisibleUser(
    input.isChallenger ? input.challenger : input.opponent,
    "You"
  );
  const theirName = formatVisibleUser(
    input.isChallenger ? input.opponent : input.challenger,
    "Opponent"
  );

  return {
    status: input.duel.status,
    phase: input.phase,
    round: {
      wordsCount: input.duel.sessionWords.length,
      index: input.index,
      word: input.word,
      sourceThemeName: input.sourceThemeName,
      frozenData: input.frozenData,
      difficulty: input.difficulty,
      duelDuration: input.duelDuration,
    },
    timer: {
      questionTimer: input.questionTimer,
      questionTimerPausedAt: input.duel.questionTimerPausedAt,
    },
    countdown: {
      value: input.countdownValue,
      pausedBy: input.duel.countdownPausedBy,
      unpauseRequestedBy: input.duel.countdownUnpauseRequestedBy,
      skipRequestedBy: input.duel.countdownSkipRequestedBy || [],
      userRole: input.viewerRole,
    },
    answers: {
      shuffledAnswers: input.shuffledAnswers,
      selectedAnswer: input.selectedAnswer,
      correctAnswer: input.currentCorrectAnswer,
      hasNoneOption: input.hasNoneOption,
      eliminatedOptions: input.eliminatedOptions,
      opponentLastAnswer: input.opponentLastAnswer || null,
      isRevealing: input.isRevealing,
      typedText: input.typedText,
      revealComplete: input.revealComplete,
      hasAnswered: input.hasAnswered,
      opponentHasAnswered: input.opponentHasAnswered,
      isLocked: input.isLocked,
    },
    hints: {
      ...input.hints,
      eliminatedOptionsCount: input.eliminatedOptions.length,
    },
    sabotage: {
      activeSabotage: input.activeSabotage,
      sabotagePhase: input.sabotagePhase,
      sabotagesRemaining: MAX_SABOTAGES - input.mySabotagesUsed,
      isOutgoingSabotageActive: input.isOutgoingSabotageActive,
    },
    score: {
      myName,
      theirName,
      myScore: input.myScore,
      theirScore: input.theirScore,
      bossType: input.duel.bossType,
      livesRemaining: input.duel.livesRemaining,
      livesTotal: input.duel.livesTotal,
    },
    actions: {
      onPauseCountdown: input.callbacks.onPauseCountdown,
      onRequestUnpause: input.callbacks.onRequestUnpause,
      onConfirmUnpause: input.callbacks.onConfirmUnpause,
      onSkipCountdown: input.callbacks.onSkipCountdown,
      onPlayAudio: input.callbacks.onPlayAudio,
      onOptionClick: input.callbacks.onOptionClick,
      onConfirmAnswer: input.callbacks.onConfirmAnswer,
      onRequestHint: input.callbacks.onRequestHint,
      onAcceptHint: input.callbacks.onAcceptHint,
      onSendSabotage: input.callbacks.onSendSabotage,
      onExit: input.callbacks.onExit,
      onBackToHome: input.callbacks.onBackToHome,
    },
    audio: { isPlaying: input.isPlayingAudio },
  } as DuelViewProps;
}
