"use client";

import { NONE_OF_ABOVE } from "@/lib/answerShuffle";

/**
 * Context needed to compute option state for an answer button.
 */
export interface OptionContext {
  /** The answer text for this option */
  answer: string;
  /** Currently selected answer (if any) */
  selectedAnswer: string | null;
  /** The correct answer for this question */
  correctAnswer: string;
  /** Whether "None of the above" is the correct choice */
  hasNoneOption: boolean;
  /** Whether feedback is being shown (locked, answered, or frozen) */
  isShowingFeedback: boolean;
  /** List of eliminated options */
  eliminatedOptions: string[];
  /** Whether this user can eliminate options (hint provider) */
  canEliminate: boolean;
  /** Opponent's last answer (for showing their pick) */
  opponentLastAnswer: string | null;
  /** Current game status */
  status: string;
  /** Frozen data for transition phase */
  frozenData: { opponentAnswer: string | null } | null;
}

/**
 * Computed state for an answer option button.
 */
export interface OptionState {
  isSelected: boolean;
  isCorrectOption: boolean;
  isEliminated: boolean;
  canEliminateThis: boolean;
  opponentPickedThis: boolean;
  isNoneOfAbove: boolean;
  disabled: boolean;
  className: string;
}

/**
 * Computes all boolean flags and className for an answer option.
 */
export function computeOptionState(
  answer: string,
  context: OptionContext
): OptionState {
  const {
    selectedAnswer,
    correctAnswer,
    hasNoneOption,
    isShowingFeedback,
    eliminatedOptions,
    canEliminate,
    opponentLastAnswer,
    status,
    frozenData,
  } = context;

  const isNoneOfAbove = answer === NONE_OF_ABOVE;
  const isEliminated = eliminatedOptions.includes(answer);
  const isWrongAnswer = isNoneOfAbove ? !hasNoneOption : answer !== correctAnswer;
  const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
  const isCorrectOption = hasNoneOption
    ? answer === NONE_OF_ABOVE
    : answer === correctAnswer;
  const isSelected = selectedAnswer === answer;

  const opponentPickedThis = frozenData
    ? frozenData.opponentAnswer === answer
    : status === "completed" && opponentLastAnswer === answer;

  // Compute disabled state with proper precedence
  const disabled = (isShowingFeedback && !canEliminateThis) || isEliminated;

  // Compute className
  let className: string;
  if (isEliminated) {
    className =
      "border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed";
  } else if (canEliminateThis) {
    className =
      "border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse";
  } else if (isShowingFeedback) {
    if (isSelected) {
      className = isCorrectOption
        ? "border-green-500 bg-green-500/20 text-green-400"
        : "border-red-500 bg-red-500/20 text-red-400";
    } else if (isCorrectOption) {
      className = "border-green-500 bg-green-500/10 text-green-400";
    } else {
      className = "border-gray-600 bg-gray-800 text-gray-400 opacity-50";
    }
  } else if (isSelected) {
    className = "border-blue-500 bg-blue-500/20 text-blue-400";
  } else {
    className = "border-gray-600 bg-gray-800 hover:border-gray-500 text-white";
  }

  return {
    isSelected,
    isCorrectOption,
    isEliminated,
    canEliminateThis,
    opponentPickedThis,
    isNoneOfAbove,
    disabled,
    className,
  };
}

/**
 * Props for the AnswerOptionButton component.
 */
export interface AnswerOptionButtonProps {
  /** The original answer text */
  answer: string;
  /** Displayed text (may be reversed for sabotage) */
  displayText: string;
  /** Computed option state */
  state: OptionState;
  /** Click handler */
  onClick: () => void;
  /** Whether to show the type reveal effect (for None of the above) */
  showTypeReveal?: boolean;
  /** Typed text for reveal effect */
  typedText?: string;
  /** Whether reveal is complete */
  revealComplete?: boolean;
  /** Whether "None of the above" is correct and showing feedback */
  hasNoneOption?: boolean;
  /** Whether feedback is being shown */
  isShowingFeedback?: boolean;
  /** Additional style for positioning (bounce/trampoline) */
  style?: React.CSSProperties;
  /** Whether this is a flying button (bounce/trampoline) */
  isFlying?: boolean;
}

/**
 * Shared answer option button component used by grid, bounce, and trampoline layouts.
 */
export function AnswerOptionButton({
  displayText,
  state,
  onClick,
  showTypeReveal = false,
  typedText = "",
  revealComplete = false,
  hasNoneOption = false,
  isShowingFeedback = false,
  style,
  isFlying = false,
}: AnswerOptionButtonProps) {
  const baseClasses = isFlying
    ? "p-4 rounded-lg border-2 text-base font-medium transition-colors relative shadow-lg"
    : "p-4 rounded-lg border-2 text-lg font-medium transition-all relative";

  return (
    <button
      disabled={state.disabled}
      onClick={onClick}
      style={style}
      className={`${baseClasses} ${state.className}`}
    >
      {state.isNoneOfAbove && hasNoneOption && showTypeReveal ? (
        <span className="font-medium">
          {typedText}
          {!revealComplete && <span className="animate-pulse">|</span>}
        </span>
      ) : isFlying ? (
        <span className="truncate block">{displayText}</span>
      ) : (
        displayText
      )}

      {state.canEliminateThis && (
        <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          ✕
        </span>
      )}

      {state.opponentPickedThis && (
        <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          👤
        </span>
      )}

      {state.isNoneOfAbove && hasNoneOption && isShowingFeedback && (
        <span className="absolute top-2 right-2 text-green-400">✓</span>
      )}
    </button>
  );
}

