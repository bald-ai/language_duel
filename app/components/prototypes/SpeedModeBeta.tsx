"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildDuelQuestionSnapshot } from "@/lib/answerShuffle";
import type { WordEntry } from "@/lib/types";
import { PrototypeActionButton } from "./PrototypeActionButton";
import { PrototypeShell } from "./PrototypeShell";

type SpeedModeFeedbackState = "idle" | "correct" | "wrong" | "timed_out";
type SpeedModeExercise = Pick<WordEntry, "word" | "answer" | "wrongAnswers">;

const SPEED_MODE_CARD_SECONDS = 5;
const SPEED_MODE_FEEDBACK_DELAY_MS = 700;

const SPEED_MODE_EXERCISES: SpeedModeExercise[] = [
  {
    word: "el padre",
    answer: "father",
    wrongAnswers: ["mother", "brother", "grandfather", "uncle", "son"],
  },
  {
    word: "la madre",
    answer: "mother",
    wrongAnswers: ["sister", "grandmother", "daughter", "aunt", "wife"],
  },
  {
    word: "el hermano",
    answer: "brother",
    wrongAnswers: ["father", "cousin", "husband", "boyfriend", "nephew"],
  },
  {
    word: "la hermana",
    answer: "sister",
    wrongAnswers: ["mother", "girlfriend", "daughter", "grandmother", "niece"],
  },
  {
    word: "el abuelo",
    answer: "grandfather",
    wrongAnswers: ["uncle", "father", "brother", "grandson", "godfather"],
  },
  {
    word: "la abuela",
    answer: "grandmother",
    wrongAnswers: ["mother", "aunt", "sister", "granddaughter", "mother-in-law"],
  },
];

interface SpeedModeSessionState {
  currentCardIndex: number;
  score: number;
  selectedOption: string | null;
  feedback: SpeedModeFeedbackState;
  secondsRemaining: number;
  completed: boolean;
  locked: boolean;
}

function createSessionState(cardIndex = 0, score = 0): SpeedModeSessionState {
  return {
    currentCardIndex: cardIndex,
    score,
    selectedOption: null,
    feedback: "idle",
    secondsRemaining: SPEED_MODE_CARD_SECONDS,
    completed: false,
    locked: false,
  };
}

interface SpeedModeBetaProps {
  onBack: () => void;
}

export function SpeedModeBeta({ onBack }: SpeedModeBetaProps) {
  const [session, setSession] = useState<SpeedModeSessionState>(() => createSessionState());

  const exercise = SPEED_MODE_EXERCISES[session.currentCardIndex];
  const question = useMemo(() => {
    if (!exercise) return null;
    return buildDuelQuestionSnapshot(exercise, session.currentCardIndex, { level: "easy", wrongCount: 3 });
  }, [exercise, session.currentCardIndex]);

  const handleAnswer = useCallback((option: string) => {
    setSession((current) => {
      if (current.locked || current.completed) return current;
      const q = buildDuelQuestionSnapshot(
        SPEED_MODE_EXERCISES[current.currentCardIndex],
        current.currentCardIndex,
        { level: "easy", wrongCount: 3 }
      );
      const isCorrect = option === q.correctOption;
      return {
        ...current,
        selectedOption: option,
        feedback: isCorrect ? "correct" : "wrong",
        score: current.score + (isCorrect ? 1 : 0),
        locked: true,
      };
    });
  }, []);

  const handleRestart = useCallback(() => setSession(createSessionState()), []);

  useEffect(() => {
    if (session.completed || session.locked) return;

    const timeoutId = window.setTimeout(() => {
      setSession((current) => {
        if (current.completed || current.locked) return current;
        if (current.secondsRemaining <= 1) {
          return { ...current, secondsRemaining: 0, feedback: "timed_out", locked: true };
        }
        return { ...current, secondsRemaining: current.secondsRemaining - 1 };
      });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [session.completed, session.locked, session.secondsRemaining]);

  useEffect(() => {
    if (session.completed || !session.locked || session.feedback === "idle") return;

    const timeoutId = window.setTimeout(() => {
      setSession((current) => {
        if (current.completed || !current.locked) return current;
        const isLastCard = current.currentCardIndex === SPEED_MODE_EXERCISES.length - 1;
        if (isLastCard) return { ...current, completed: true };
        return createSessionState(current.currentCardIndex + 1, current.score);
      });
    }, SPEED_MODE_FEEDBACK_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [session.completed, session.feedback, session.locked]);

  if (session.completed) {
    return (
      <PrototypeShell title="Speed Mode" testIdPrefix="speed" onBack={onBack}>
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <p
              className="text-xs font-black uppercase tracking-[0.24em]"
              style={{ color: "var(--color-cta-dark)" }}
            >
              Prototype Complete
            </p>
            <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
              Speed Mode finished
            </h2>
            <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
              You cleared all {SPEED_MODE_EXERCISES.length} cards and scored {session.score} point
              {session.score === 1 ? "" : "s"}.
            </p>
          </div>

          <div
            className="rounded-3xl border-2 px-4 py-5"
            data-testid="speed-mode-final-score"
            style={{
              borderColor: "color-mix(in srgb, var(--color-cta) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-cta-light) 18%, white 82%)",
            }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--color-cta-dark)" }}
            >
              Final Score
            </p>
            <p className="mt-2 text-4xl font-black" style={{ color: "var(--color-text)" }}>
              {session.score}/{SPEED_MODE_EXERCISES.length}
            </p>
          </div>

          <div className="grid gap-3">
            <PrototypeActionButton
              fullWidth
              variant="primary"
              onClick={handleRestart}
              dataTestId="speed-mode-restart"
            >
              Restart
            </PrototypeActionButton>
            <PrototypeActionButton
              fullWidth
              onClick={onBack}
              dataTestId="speed-mode-back-home"
            >
              Back to Home
            </PrototypeActionButton>
          </div>
        </div>
      </PrototypeShell>
    );
  }

  const feedbackMessage = {
    idle: "Answer before the timer hits zero.",
    correct: "Nice. +1 point.",
    wrong: "Wrong answer. Moving to the next card.",
    timed_out: "Time ran out. Moving to the next card.",
  } satisfies Record<SpeedModeFeedbackState, string>;

  if (!exercise || !question) return null;

  return (
    <PrototypeShell title="Speed Mode" testIdPrefix="speed" onBack={onBack}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-score"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-cta-light) 26%, white 74%)",
              borderColor: "color-mix(in srgb, var(--color-cta) 20%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-cta-dark)" }}>
              Score
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {session.score}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-card-progress"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary-light) 24%, white 76%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-primary-dark)" }}>
              Card
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {session.currentCardIndex + 1}/{SPEED_MODE_EXERCISES.length}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-time-left"
            style={{
              backgroundColor:
                session.secondsRemaining <= 2
                  ? "rgba(239, 68, 68, 0.12)"
                  : "color-mix(in srgb, var(--color-neutral) 14%, white 86%)",
              borderColor:
                session.secondsRemaining <= 2
                  ? "rgba(239, 68, 68, 0.42)"
                  : "color-mix(in srgb, var(--color-neutral) 32%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text)" }}>
              Time Left
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {session.secondsRemaining}s
            </p>
          </div>
        </div>

        <div
          className="rounded-3xl border-2 p-4 sm:p-5 backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
          }}
        >
          <div className="space-y-3">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Spanish word
              </p>
              <p className="mt-1 text-xl font-semibold leading-8" style={{ color: "var(--color-text)" }}>
                {exercise.word}
              </p>
            </div>

            <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
              Pick the English meaning as fast as you can, just like a duel multiple-choice card.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {question.options.map((option, index) => {
            const isSelected = session.selectedOption === option;
            const isCorrectOption = option === question.correctOption;
            const showCorrectState =
              session.locked && (session.feedback === "correct" || isCorrectOption);
            const showWrongState = isSelected && session.feedback === "wrong";

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleAnswer(option)}
                disabled={session.locked}
                data-testid={`speed-mode-answer-${index}`}
                className="w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-80"
                style={{
                  backgroundColor: showCorrectState
                    ? "color-mix(in srgb, var(--color-cta) 22%, transparent)"
                    : showWrongState
                      ? "rgba(239, 68, 68, 0.12)"
                      : "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                  borderColor: showCorrectState
                    ? "var(--color-cta)"
                    : showWrongState
                      ? "rgb(239 68 68)"
                      : "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                  color: "var(--color-text)",
                }}
              >
                {option}
                {showCorrectState && isCorrectOption ? "  ✓" : ""}
                {showWrongState ? "  ✕" : ""}
              </button>
            );
          })}
        </div>

        <p
          className={`text-sm font-semibold text-center ${
            session.feedback === "correct"
              ? "text-emerald-600"
              : session.feedback === "wrong" || session.feedback === "timed_out"
                ? "text-red-500"
                : ""
          }`}
          style={{
            color: session.feedback === "idle" ? "var(--color-text)" : undefined,
          }}
          data-testid={`speed-mode-feedback-${session.feedback}`}
        >
          {feedbackMessage[session.feedback]}
        </p>

        {session.locked && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
            }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Duel Answer
            </p>
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--color-text)" }}>
              {`"${exercise.word}" means "${exercise.answer}".`}
            </p>
          </div>
        )}
      </div>
    </PrototypeShell>
  );
}
