"use client";

import { NONE_OF_ABOVE } from "@/lib/answerShuffle";

import { cssVarColors as colors } from "@/app/components/themeCssVars";
/**
 * Context needed to compute option state for an answer button.
 */
export interface OptionContext {
  /** The answer text for this option */
  answer: string;
  /** Currently selected answer (if any), already resolved to the displayed question */
  selectedAnswer: string | null;
  /** The correct answer for this question, once the backend has revealed it */
  correctAnswer: string | null;
  /** Whether "None of the above" is the correct choice, once revealed */
  hasNoneOption: boolean | null;
  /** Whether feedback is being shown (locked, answered, or frozen) */
  isShowingFeedback: boolean;
  /** List of eliminated options */
  eliminatedOptions: string[];
  /** Whether this user can eliminate options (hint provider) */
  canEliminate: boolean;
  /** The opponent's answer for the displayed question (frozen-or-live), if known */
  opponentAnswer: string | null;
  /** Whether the opponent's pick should be surfaced (transition or completed) */
  showOpponentPick: boolean;
}

/**
 * Which color treatment an option gets, in the precedence the grid applies.
 * The `revealed*` and `picked*` tones only appear while feedback is showing.
 */
export type OptionTone =
  | "eliminated"
  | "eliminable"
  | "pickedCorrect"
  | "pickedWrong"
  | "revealedCorrect"
  | "revealedOther"
  | "selected"
  | "idle";

const OPTION_TONE_STYLES: Record<OptionTone, React.CSSProperties> = {
  eliminated: {
    borderColor: colors.neutral.dark,
    backgroundColor: colors.background.DEFAULT,
    color: colors.text.muted,
  },
  eliminable: {
    borderColor: colors.status.warning.DEFAULT,
    backgroundColor: `${colors.status.warning.DEFAULT}26`,
    color: colors.status.warning.dark,
  },
  pickedCorrect: {
    borderColor: colors.status.success.DEFAULT,
    backgroundColor: `${colors.status.success.DEFAULT}26`,
    color: colors.status.success.dark,
  },
  pickedWrong: {
    borderColor: colors.status.danger.DEFAULT,
    backgroundColor: `${colors.status.danger.DEFAULT}26`,
    color: colors.status.danger.dark,
  },
  revealedCorrect: {
    borderColor: colors.status.success.DEFAULT,
    backgroundColor: `${colors.status.success.DEFAULT}1A`,
    color: colors.status.success.dark,
  },
  revealedOther: {
    borderColor: colors.neutral.dark,
    backgroundColor: colors.background.DEFAULT,
    color: colors.text.muted,
  },
  selected: {
    borderColor: colors.secondary.DEFAULT,
    backgroundColor: `${colors.secondary.DEFAULT}26`,
    color: colors.secondary.dark,
  },
  idle: {
    borderColor: colors.primary.dark,
    backgroundColor: colors.background.elevated,
    color: colors.text.DEFAULT,
  },
};

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
  tone: OptionTone;
  style: React.CSSProperties;
}

/**
 * Computes all boolean flags and styles for an answer option.
 */
export function computeOptionState(
  answer: string,
  context: OptionContext,
): OptionState {
  const {
    selectedAnswer,
    correctAnswer,
    hasNoneOption,
    isShowingFeedback,
    eliminatedOptions,
    canEliminate,
    opponentAnswer,
    showOpponentPick,
  } = context;

  const isNoneOfAbove = answer === NONE_OF_ABOVE;
  const isEliminated = eliminatedOptions.includes(answer);
  const { answerIsRevealed, isWrongAnswer, isCorrectOption } = getAnswerTruth(
    answer,
    correctAnswer,
    hasNoneOption,
  );
  const canEliminateThis =
    canEliminate && answerIsRevealed && isWrongAnswer && !isEliminated;
  const isSelected = selectedAnswer === answer;

  const opponentPickedThis = showOpponentPick && opponentAnswer === answer;

  // Compute disabled state with proper precedence
  const disabled = (isShowingFeedback && !canEliminateThis) || isEliminated;

  const tone = getOptionTone({
    isEliminated,
    canEliminateThis,
    isShowingFeedback,
    isSelected,
    isCorrectOption,
  });

  return {
    isSelected,
    isCorrectOption,
    isEliminated,
    canEliminateThis,
    opponentPickedThis,
    isNoneOfAbove,
    disabled,
    tone,
    style: OPTION_TONE_STYLES[tone],
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
  /** Optional test id for E2E */
  dataTestId?: string;
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
  dataTestId,
}: AnswerOptionButtonProps) {
  const classes = getAnswerOptionClasses(state, isFlying);
  const combinedStyle = { ...style, ...state.style };

  return (
    <button
      disabled={state.disabled}
      onClick={onClick}
      data-testid={dataTestId}
      style={combinedStyle}
      className={classes}
    >
      <AnswerOptionLabel
        displayText={displayText}
        isNoneOfAbove={state.isNoneOfAbove}
        hasNoneOption={hasNoneOption}
        showTypeReveal={showTypeReveal}
        typedText={typedText}
        revealComplete={revealComplete}
        isFlying={isFlying}
      />

      <AnswerOptionMarkers
        state={state}
        hasNoneOption={hasNoneOption}
        isShowingFeedback={isShowingFeedback}
      />
    </button>
  );
}

function getAnswerTruth(
  answer: string,
  correctAnswer: string | null,
  hasNoneOption: boolean | null,
) {
  const isNoneOfAbove = answer === NONE_OF_ABOVE;
  const answerIsRevealed = correctAnswer !== null && hasNoneOption !== null;
  const isWrongAnswer = answerIsRevealed
    ? isNoneOfAbove
      ? !hasNoneOption
      : answer !== correctAnswer
    : false;
  const isCorrectOption = answerIsRevealed
    ? hasNoneOption
      ? answer === NONE_OF_ABOVE
      : answer === correctAnswer
    : false;
  return { answerIsRevealed, isWrongAnswer, isCorrectOption };
}

function getOptionTone({
  isEliminated,
  canEliminateThis,
  isShowingFeedback,
  isSelected,
  isCorrectOption,
}: Pick<
  OptionState,
  "isEliminated" | "canEliminateThis" | "isSelected" | "isCorrectOption"
> & { isShowingFeedback: boolean }): OptionTone {
  if (isEliminated) return "eliminated";
  if (canEliminateThis) return "eliminable";
  if (isShowingFeedback) {
    if (isSelected) return isCorrectOption ? "pickedCorrect" : "pickedWrong";
    return isCorrectOption ? "revealedCorrect" : "revealedOther";
  }
  return isSelected ? "selected" : "idle";
}

function getAnswerOptionClasses(state: OptionState, isFlying: boolean): string {
  const baseClasses = isFlying
    ? "p-4 rounded-lg border-2 text-base font-medium transition-colors relative shadow-lg"
    : "p-4 rounded-lg border-2 text-lg font-medium transition-all relative active:scale-95";
  const stateClasses = [
    state.isEliminated ? "line-through opacity-40 cursor-not-allowed" : "",
    state.canEliminateThis
      ? "cursor-pointer animate-pulse hover:brightness-110"
      : "",
    // Options that were neither picked nor correct fade back during feedback.
    state.tone === "revealedOther" ? "opacity-50" : "",
    !state.disabled && !state.canEliminateThis ? "hover:brightness-110" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `${baseClasses} ${stateClasses}`;
}
function AnswerOptionLabel({
  displayText,
  isNoneOfAbove,
  hasNoneOption,
  showTypeReveal,
  typedText,
  revealComplete,
  isFlying,
}: Pick<
  AnswerOptionButtonProps,
  | "displayText"
  | "hasNoneOption"
  | "showTypeReveal"
  | "typedText"
  | "revealComplete"
  | "isFlying"
> & { isNoneOfAbove: boolean }) {
  return (
    <>
      {isNoneOfAbove && hasNoneOption && showTypeReveal ? (
        <span className="font-medium">
          {typedText}
          {!revealComplete && <span className="animate-pulse">|</span>}
        </span>
      ) : isFlying ? (
        <span className="truncate block">{displayText}</span>
      ) : (
        displayText
      )}
    </>
  );
}
function AnswerOptionMarkers({
  state,
  hasNoneOption,
  isShowingFeedback,
}: Pick<
  AnswerOptionButtonProps,
  "state" | "hasNoneOption" | "isShowingFeedback"
>) {
  return (
    <>
      {state.canEliminateThis && (
        <span
          className="absolute -top-2 -right-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: colors.status.warning.DEFAULT,
            color: colors.text.inverse,
          }}
        >
          ✕
        </span>
      )}
      {state.opponentPickedThis && (
        <span
          className="absolute -top-2 -left-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: colors.secondary.DEFAULT,
            color: colors.text.inverse,
          }}
        >
          👤
        </span>
      )}
      {state.isNoneOfAbove && hasNoneOption && isShowingFeedback && (
        <span
          className="absolute top-2 right-2"
          style={{ color: colors.status.success.light }}
        >
          ✓
        </span>
      )}
    </>
  );
}
