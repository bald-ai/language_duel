"use client";

import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { colors } from "@/lib/theme";

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
  style: React.CSSProperties;
}

/**
 * Computes all boolean flags and styles for an answer option.
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

  // Compute styles
  let style: React.CSSProperties;
  if (isEliminated) {
    style = {
      borderColor: colors.neutral.dark,
      backgroundColor: colors.background.DEFAULT,
      color: colors.text.muted,
    };
  } else if (canEliminateThis) {
    style = {
      borderColor: colors.status.warning.DEFAULT,
      backgroundColor: `${colors.status.warning.DEFAULT}26`,
      color: colors.status.warning.dark,
    };
  } else if (isShowingFeedback) {
    if (isSelected) {
      style = isCorrectOption
        ? {
            borderColor: colors.status.success.DEFAULT,
            backgroundColor: `${colors.status.success.DEFAULT}26`,
            color: colors.status.success.dark,
          }
        : {
            borderColor: colors.status.danger.DEFAULT,
            backgroundColor: `${colors.status.danger.DEFAULT}26`,
            color: colors.status.danger.dark,
          };
    } else if (isCorrectOption) {
      style = {
        borderColor: colors.status.success.DEFAULT,
        backgroundColor: `${colors.status.success.DEFAULT}1A`,
        color: colors.status.success.dark,
      };
    } else {
      style = {
        borderColor: colors.neutral.dark,
        backgroundColor: colors.background.DEFAULT,
        color: colors.text.muted,
      };
    }
  } else if (isSelected) {
    style = {
      borderColor: colors.secondary.DEFAULT,
      backgroundColor: `${colors.secondary.DEFAULT}26`,
      color: colors.secondary.dark,
    };
  } else {
    style = {
      borderColor: colors.primary.dark,
      backgroundColor: colors.background.elevated,
      color: colors.text.DEFAULT,
    };
  }

  return {
    isSelected,
    isCorrectOption,
    isEliminated,
    canEliminateThis,
    opponentPickedThis,
    isNoneOfAbove,
    disabled,
    style,
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
  const mutedFeedback =
    state.disabled &&
    !state.isEliminated &&
    !state.canEliminateThis &&
    !state.isSelected &&
    !state.isCorrectOption;
  const stateClasses = [
    state.isEliminated ? "line-through opacity-40 cursor-not-allowed" : "",
    state.canEliminateThis ? "cursor-pointer animate-pulse hover:brightness-110" : "",
    mutedFeedback ? "opacity-50" : "",
    !state.disabled && !state.canEliminateThis ? "hover:brightness-110" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const combinedStyle = { ...style, ...state.style };

  return (
    <button
      disabled={state.disabled}
      onClick={onClick}
      style={combinedStyle}
      className={`${baseClasses} ${stateClasses}`}
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
        <span
          className="absolute -top-2 -right-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: colors.status.warning.DEFAULT, color: colors.text.inverse }}
        >
          ✕
        </span>
      )}

      {state.opponentPickedThis && (
        <span
          className="absolute -top-2 -left-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: colors.secondary.DEFAULT, color: colors.text.inverse }}
        >
          👤
        </span>
      )}

      {state.isNoneOfAbove && hasNoneOption && isShowingFeedback && (
        <span className="absolute top-2 right-2" style={{ color: colors.status.success.light }}>
          ✓
        </span>
      )}
    </button>
  );
}
