"use client";
import { useState } from "react";
import type { ThemeColors as Colors } from "@/lib/appearance";
import { RELAY_ANSWER_TIMEOUT_MS } from "@/lib/duelConstants";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { useRelayCountdown } from "../hooks/useRelayCountdown";
import type {
  RelaySafeDuel,
  RelayServedQuestion,
} from "../hooks/relaySessionTypes";
import {
  AnswerOptionButton,
  computeOptionState,
  type OptionContext,
} from "./AnswerOptionButton";
import { relayFooterButtonClass, buildRelayStyles } from "./relayStyles";

interface RelayAnswerAreaProps {
  served: RelayServedQuestion | null;
  amAnswerer: boolean;
  showFeedback: boolean;
  active: boolean;
  startedAt: number | undefined;
  onTimeout: () => void;
  lastResult: RelaySafeDuel["relayLastResult"] | null;
  theirName: string;
  isLastItem: boolean;
  onAnswer: (value: string) => void;
  onAdvance: () => void;
  colors: Colors;
}

// Owns the answerer's tentative selection. Keyed on the assigned position by the
// parent, so a new round remounts it and the selection resets without an effect.
export function RelayAnswerArea({
  served,
  amAnswerer,
  showFeedback,
  active,
  startedAt,
  onTimeout,
  lastResult,
  theirName,
  isLastItem,
  onAnswer,
  onAdvance,
  colors,
}: RelayAnswerAreaProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const secondsLeft = useRelayCountdown(
    active,
    startedAt,
    RELAY_ANSWER_TIMEOUT_MS,
    onTimeout,
  );

  const correctAnswer = getRevealedWordAnswer(served);
  const optionContext = getRelayOptionContext({
    selectedAnswer,
    showFeedback,
    lastResult,
    correctAnswer,
  });
  return (
    <>
      <RelayWordTimer
        showFeedback={showFeedback}
        secondsLeft={secondsLeft}
        colors={colors}
      />
      <RelayWordOptions
        served={served}
        amAnswerer={amAnswerer}
        showFeedback={showFeedback}
        correctAnswer={correctAnswer}
        optionContext={optionContext}
        setSelectedAnswer={setSelectedAnswer}
      />
      <RelayWordFeedback
        showFeedback={showFeedback}
        lastResult={lastResult}
        amAnswerer={amAnswerer}
        correctAnswer={correctAnswer}
        theirName={theirName}
        colors={colors}
      />
      <RelayWordActions
        amAnswerer={amAnswerer}
        showFeedback={showFeedback}
        selectedAnswer={selectedAnswer}
        onAnswer={onAnswer}
        onAdvance={onAdvance}
        isLastItem={isLastItem}
        colors={colors}
      />
    </>
  );
}
function getRevealedWordAnswer(
  served: RelayServedQuestion | null,
): string | null {
  const revealed = served?.answerRevealedToViewer === true;
  return revealed && served && "correctOption" in served
    ? served.correctOption
    : null;
}
function getRelayOptionContext({
  selectedAnswer,
  showFeedback,
  lastResult,
  correctAnswer,
}: Pick<RelayAnswerAreaProps, "showFeedback" | "lastResult"> & {
  selectedAnswer: string | null;
  correctAnswer: string | null;
}): OptionContext {
  return {
    answer: "",
    selectedAnswer: showFeedback
      ? (lastResult?.chosen ?? null)
      : selectedAnswer,
    correctAnswer,
    hasNoneOption:
      correctAnswer !== null ? correctAnswer === NONE_OF_ABOVE : null,
    isShowingFeedback: showFeedback,
    eliminatedOptions: [],
    canEliminate: false,
    opponentAnswer: null,
    showOpponentPick: false,
  };
}
function RelayWordTimer({
  showFeedback,
  secondsLeft,
  colors,
}: Pick<RelayAnswerAreaProps, "showFeedback" | "colors"> & {
  secondsLeft: number | null;
}) {
  return (
    <>
      {!showFeedback && secondsLeft !== null && (
        <div
          className="mb-4 text-3xl font-bold tabular-nums"
          style={{ color: colors.text.DEFAULT }}
          data-testid="relay-timer"
        >
          {secondsLeft}
          <span className="text-xs ml-1" style={{ color: colors.text.muted }}>
            sec
          </span>
        </div>
      )}
    </>
  );
}
function RelayWordOptions({
  served,
  amAnswerer,
  showFeedback,
  correctAnswer,
  optionContext,
  setSelectedAnswer,
}: Pick<RelayAnswerAreaProps, "served" | "amAnswerer" | "showFeedback"> & {
  correctAnswer: string | null;
  optionContext: OptionContext;
  setSelectedAnswer: (value: string) => void;
}) {
  return (
    <>
      {served && served.kind === "word" && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
          {served.options.map((option: string, index: number) => {
            const state = computeOptionState(option, {
              ...optionContext,
              answer: option,
            });
            return (
              <AnswerOptionButton
                key={`${option}-${index}`}
                answer={option}
                displayText={option}
                state={state}
                onClick={() => {
                  if (amAnswerer && !showFeedback) setSelectedAnswer(option);
                }}
                isShowingFeedback={showFeedback}
                hasNoneOption={correctAnswer === NONE_OF_ABOVE}
                dataTestId={`relay-answer-${index}`}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
function RelayWordFeedback({
  showFeedback,
  lastResult,
  amAnswerer,
  correctAnswer,
  theirName,
  colors,
}: Pick<
  RelayAnswerAreaProps,
  "showFeedback" | "lastResult" | "amAnswerer" | "theirName" | "colors"
> & { correctAnswer: string | null }) {
  return (
    <>
      {showFeedback && lastResult ? (
        <div
          className="mt-4 text-center text-sm font-medium"
          style={{
            color: lastResult.correct
              ? colors.status.success.light
              : colors.status.danger.light,
          }}
          data-testid="relay-feedback"
        >
          {feedbackText(lastResult.correct, amAnswerer, correctAnswer)}
        </div>
      ) : (
        !amAnswerer && (
          <div
            className="mt-4 text-sm"
            style={{ color: colors.text.muted }}
            data-testid="relay-watching"
          >
            {theirName} is answering…
          </div>
        )
      )}
    </>
  );
}
function RelayWordActions({
  amAnswerer,
  showFeedback,
  selectedAnswer,
  onAnswer,
  onAdvance,
  isLastItem,
  colors,
}: Pick<
  RelayAnswerAreaProps,
  | "amAnswerer"
  | "showFeedback"
  | "onAnswer"
  | "onAdvance"
  | "isLastItem"
  | "colors"
> & { selectedAnswer: string | null }) {
  const styles = buildRelayStyles(colors);
  return (
    <>
      {amAnswerer && !showFeedback && (
        <button
          className={relayFooterButtonClass}
          style={selectedAnswer ? styles.ctaEnabled : styles.ctaDisabled}
          disabled={!selectedAnswer}
          onClick={() => selectedAnswer && onAnswer(selectedAnswer)}
          data-testid="relay-confirm"
        >
          Confirm Answer
        </button>
      )}
      {amAnswerer && showFeedback && (
        <button
          className={relayFooterButtonClass}
          style={styles.ctaEnabled}
          onClick={onAdvance}
          data-testid="relay-continue"
        >
          {isLastItem ? "See Results" : "Continue"}
        </button>
      )}
    </>
  );
}

function feedbackText(
  correct: boolean,
  mine: boolean,
  correctAnswer: string | null,
): string {
  const who = mine ? "You" : "They";
  if (correct) return `${who} got it`;
  return `${who} missed${correctAnswer ? ` — answer: ${correctAnswer}` : ""}`;
}
