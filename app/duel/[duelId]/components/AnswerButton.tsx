"use client";

import { stripIrr } from "@/lib/stringUtils";

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
};

export function AnswerButton({
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
}: AnswerButtonProps) {
  const isNoneOfAbove = answer === "None of the above";
  const isWrongAnswer = isNoneOfAbove ? !hasNoneOption : answer !== correctAnswer;
  const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
  const isCorrectOption = hasNoneOption ? isNoneOfAbove : answer === correctAnswer;

  const baseClasses = `p-4 rounded-lg border-2 font-medium transition-all relative ${truncateText ? 'text-base' : 'text-lg'}`;
  
  const stateClasses = isEliminated
    ? 'border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed'
    : canEliminateThis
      ? 'border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse'
      : isShowingFeedback
        ? selectedAnswer === answer
          ? isCorrectOption
            ? 'border-green-500 bg-green-500/20 text-green-400'
            : 'border-red-500 bg-red-500/20 text-red-400'
          : isCorrectOption
            ? 'border-green-500 bg-green-500/10 text-green-400'
            : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
        : selectedAnswer === answer
          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
          : `border-gray-600 ${truncateText ? 'bg-gray-800/95' : 'bg-gray-800'} hover:border-gray-500 text-white`;

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={style}
      className={`${baseClasses} ${stateClasses} ${truncateText ? 'shadow-lg' : ''}`}
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
        <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          ✕
        </span>
      )}
      {opponentPickedThis && (
        <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          👤
        </span>
      )}
      {isNoneOfAbove && hasNoneOption && isShowingFeedback && (
        <span className="absolute top-2 right-2 text-green-400">✓</span>
      )}
    </button>
  );
}

export type { AnswerButtonProps };

