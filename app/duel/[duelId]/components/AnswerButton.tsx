"use client";

import { memo } from "react";
import { stripIrr } from "@/lib/stringUtils";
import { colors } from "@/lib/theme";

type AnswerButtonProps = {
  answer: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  hasNoneOption: boolean;
  isShowingFeedback: boolean;
  isEliminated: boolean;
  canEliminate: boolean;
  opponentPickedThis: boolean;
  isRevealing: boolean;
  typedText: string;
  revealComplete: boolean;
  disabled: boolean;
  onClick: () => void;
  style?: React.CSSProperties;
  truncateText?: boolean;
  dataTestId?: string;
};

const AnswerButtonComponent = function AnswerButton({
  answer,
  selectedAnswer,
  correctAnswer,
  hasNoneOption,
  isShowingFeedback,
  isEliminated,
  canEliminate,
  opponentPickedThis,
  isRevealing,
  typedText,
  revealComplete,
  disabled,
  onClick,
  style,
  truncateText,
  dataTestId,
}: AnswerButtonProps) {
  const isNoneOfAbove = answer === "None of the above";
  const isWrongAnswer = isNoneOfAbove ? !hasNoneOption : answer !== correctAnswer;
  const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
  const isCorrectOption = hasNoneOption ? isNoneOfAbove : answer === correctAnswer;

  const baseClasses = `p-4 rounded-lg border-2 font-medium transition-all relative ${truncateText ? 'text-base' : 'text-lg'}`;

  let stateClasses = "";
  let stateStyle: React.CSSProperties = {
    borderColor: colors.primary.dark,
    backgroundColor: truncateText ? `${colors.background.elevated}F2` : colors.background.elevated,
    color: colors.text.DEFAULT,
  };

  if (isEliminated) {
    stateClasses = "line-through opacity-40 cursor-not-allowed";
    stateStyle = {
      borderColor: colors.neutral.dark,
      backgroundColor: colors.background.DEFAULT,
      color: colors.text.muted,
    };
  } else if (canEliminateThis) {
    stateClasses = "cursor-pointer animate-pulse";
    stateStyle = {
      borderColor: colors.status.warning.DEFAULT,
      backgroundColor: `${colors.status.warning.DEFAULT}26`,
      color: colors.status.warning.light,
    };
  } else if (isShowingFeedback) {
    if (selectedAnswer === answer) {
      stateStyle = isCorrectOption
        ? {
            borderColor: colors.status.success.DEFAULT,
            backgroundColor: `${colors.status.success.DEFAULT}26`,
            color: colors.status.success.light,
          }
        : {
            borderColor: colors.status.danger.DEFAULT,
            backgroundColor: `${colors.status.danger.DEFAULT}26`,
            color: colors.status.danger.light,
          };
    } else if (isCorrectOption) {
      stateStyle = {
        borderColor: colors.status.success.DEFAULT,
        backgroundColor: `${colors.status.success.DEFAULT}1A`,
        color: colors.status.success.light,
      };
    } else {
      stateClasses = "opacity-50";
      stateStyle = {
        borderColor: colors.neutral.dark,
        backgroundColor: colors.background.DEFAULT,
        color: colors.text.muted,
      };
    }
  } else if (selectedAnswer === answer) {
    stateStyle = {
      borderColor: colors.secondary.DEFAULT,
      backgroundColor: `${colors.secondary.DEFAULT}26`,
      color: colors.secondary.light,
    };
  }

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      data-testid={dataTestId}
      className={`${baseClasses} ${stateClasses} ${truncateText ? 'shadow-lg' : ''}`}
      style={{ ...stateStyle, ...style }}
    >
      {isNoneOfAbove && hasNoneOption && isRevealing ? (
        <span className="font-medium">
          {typedText}
          {!revealComplete && <span className="animate-pulse">|</span>}
        </span>
      ) : truncateText ? (
        <span className="truncate block">{stripIrr(answer)}</span>
      ) : (
        stripIrr(answer)
      )}
      {canEliminateThis && (
        <span
          className="absolute -top-2 -right-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: colors.status.warning.DEFAULT, color: colors.text.DEFAULT }}
        >
          ✕
        </span>
      )}
      {opponentPickedThis && (
        <span
          className="absolute -top-2 -left-2 text-xs px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: colors.secondary.DEFAULT, color: colors.text.DEFAULT }}
        >
          👤
        </span>
      )}
      {isNoneOfAbove && hasNoneOption && isShowingFeedback && (
        <span className="absolute top-2 right-2" style={{ color: colors.status.success.light }}>
          ✓
        </span>
      )}
    </button>
  );
};

export const AnswerButton = memo(
  AnswerButtonComponent,
  (prev, next) => {
    return (
      prev.answer === next.answer &&
      prev.selectedAnswer === next.selectedAnswer &&
      prev.correctAnswer === next.correctAnswer &&
      prev.hasNoneOption === next.hasNoneOption &&
      prev.isShowingFeedback === next.isShowingFeedback &&
      prev.isEliminated === next.isEliminated &&
      prev.canEliminate === next.canEliminate &&
      prev.opponentPickedThis === next.opponentPickedThis &&
      prev.isRevealing === next.isRevealing &&
      prev.typedText === next.typedText &&
      prev.revealComplete === next.revealComplete &&
      prev.disabled === next.disabled &&
      prev.truncateText === next.truncateText &&
      prev.onClick === next.onClick &&
      prev.style === next.style
    );
  }
);

export type { AnswerButtonProps };
