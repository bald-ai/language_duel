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
import type { HintType } from "@/lib/hintPool/types";
import { PVP_HINT_ELIMINATION_PICKS } from "@/lib/hints/constants";

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
  hintPool: {
    usedHints: HintType[];
    usedCount: number;
    totalCount: number;
    currentQuestionHintFired: boolean;
    fireHint: (hintType: HintType) => Promise<void>;
  };
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
  onFireHint: (hintType: HintType) => void;
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

  const isPve = input.duel.duelMode === "pve";
  const hints = isPve
    ? {
        canRequestHint: false,
        iRequestedHint: false,
        theyRequestedHint: false,
        hintAccepted: false,
        canAcceptHint: false,
        isHintProvider: false,
        canEliminate: false,
      }
    : input.hints;

  return {
    status: input.duel.status,
    duelMode: input.duel.duelMode,
    phase: input.phase,
    round: {
      wordsCount: input.duel.sessionWords.length,
      index: input.index,
      word: input.word,
      sourceThemeName: input.sourceThemeName,
      frozenData: input.frozenData,
      difficulty: input.difficulty,
      duelDuration: input.duelDuration,
      hintReveal: input.duel.currentQuestionHintReveal,
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
      ...hints,
      eliminatedOptionsCount: input.eliminatedOptions.length,
      pool: {
        usedHints: input.hintPool.usedHints,
        usedCount: input.hintPool.usedCount,
        totalCount: input.hintPool.totalCount,
        currentQuestionHintFired: input.hintPool.currentQuestionHintFired,
      },
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
      onFireHint: input.callbacks.onFireHint,
      onSendSabotage: input.callbacks.onSendSabotage,
      onExit: input.callbacks.onExit,
      onBackToHome: input.callbacks.onBackToHome,
    },
    audio: { isPlaying: input.isPlayingAudio },
  } as DuelViewProps;
}
