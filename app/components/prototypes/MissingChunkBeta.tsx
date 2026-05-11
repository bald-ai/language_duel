"use client";

import { useCallback, useState } from "react";
import { PrototypeActionButton } from "./PrototypeActionButton";
import { PrototypeShell } from "./PrototypeShell";
import { SentenceCompletion } from "./SentenceCompletion";

type SentenceFeedbackState = "idle" | "wrong" | "correct";

interface MissingChunkExercise {
  english: string;
  sentenceStart: string;
  sentenceEnd: string;
  correctChunk: string;
  options: string[];
}

const MISSING_CHUNK_EXERCISES: MissingChunkExercise[] = [
  {
    english: "I want water.",
    sentenceStart: "Yo",
    sentenceEnd: "agua.",
    correctChunk: "quiero",
    options: ["quiero", "tengo", "bebo"],
  },
  {
    english: "We are at home.",
    sentenceStart: "Nosotros estamos",
    sentenceEnd: "casa.",
    correctChunk: "en",
    options: ["en", "con", "para"],
  },
  {
    english: "She eats with friends.",
    sentenceStart: "Ella come",
    sentenceEnd: "amigos.",
    correctChunk: "con",
    options: ["con", "sin", "sobre"],
  },
];

interface MissingChunkSessionState {
  currentCardIndex: number;
  selectedOption: string | null;
  solved: boolean;
  completed: boolean;
  feedback: SentenceFeedbackState;
}

function createSessionState(): MissingChunkSessionState {
  return {
    currentCardIndex: 0,
    selectedOption: null,
    solved: false,
    completed: false,
    feedback: "idle",
  };
}

interface MissingChunkBetaProps {
  onBack: () => void;
  onSwitchToRebuildSentence: () => void;
}

export function MissingChunkBeta({ onBack, onSwitchToRebuildSentence }: MissingChunkBetaProps) {
  const [session, setSession] = useState<MissingChunkSessionState>(createSessionState);

  const exercise = MISSING_CHUNK_EXERCISES[session.currentCardIndex];

  const handleOption = useCallback((option: string) => {
    setSession((current) => {
      if (current.solved || current.completed) return current;
      const isCorrect = option === MISSING_CHUNK_EXERCISES[current.currentCardIndex].correctChunk;
      return {
        ...current,
        selectedOption: option,
        feedback: isCorrect ? "correct" : "wrong",
        solved: isCorrect,
      };
    });
  }, []);

  const handleNext = useCallback(() => {
    setSession((current) => {
      if (!current.solved) return current;
      const isLastCard = current.currentCardIndex === MISSING_CHUNK_EXERCISES.length - 1;
      if (isLastCard) return { ...current, completed: true };
      return {
        currentCardIndex: current.currentCardIndex + 1,
        selectedOption: null,
        solved: false,
        completed: false,
        feedback: "idle",
      };
    });
  }, []);

  const handleRestart = useCallback(() => setSession(createSessionState()), []);

  if (session.completed) {
    return (
      <PrototypeShell title="Missing Chunk" testIdPrefix="missing_chunk" onBack={onBack}>
        <SentenceCompletion
          title="Missing Chunk finished"
          testIdPrefix="prototype-missing_chunk"
          otherModeLabel="Try Other Mode"
          onRestart={handleRestart}
          onBack={onBack}
          onSwitchMode={onSwitchToRebuildSentence}
        />
      </PrototypeShell>
    );
  }

  return (
    <PrototypeShell title="Missing Chunk" testIdPrefix="missing_chunk" onBack={onBack}>
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--color-cta-dark)" }}
          >
            Card {session.currentCardIndex + 1} of {MISSING_CHUNK_EXERCISES.length}
          </p>
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sentence Beta: Missing Chunk
          </h2>
          <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
            Tap the chunk that correctly completes the Spanish sentence.
          </p>
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
                English meaning
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                {exercise.english}
              </p>
            </div>

            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Spanish sentence
              </p>
              <p
                className="mt-2 text-xl font-semibold leading-8"
                style={{
                  color: session.solved ? "var(--color-cta-dark)" : "var(--color-text)",
                }}
              >
                {session.solved ? (
                  `${exercise.sentenceStart} ${exercise.correctChunk} ${exercise.sentenceEnd}`
                ) : (
                  <>
                    {exercise.sentenceStart}{" "}
                    <span
                      className="inline-flex min-w-24 items-center justify-center rounded-xl border border-dashed px-3 py-1 text-base"
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-cta) 70%, transparent)",
                        color: "var(--color-cta-dark)",
                      }}
                    >
                      ______
                    </span>{" "}
                    {exercise.sentenceEnd}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {exercise.options.map((option) => {
            const isSelected = session.selectedOption === option;
            const isCorrectSelected = isSelected && session.feedback === "correct";
            const isWrongSelected = isSelected && session.feedback === "wrong";

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleOption(option)}
                disabled={session.solved}
                className="w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                data-testid={`missing-chunk-option-${option}`}
                style={{
                  backgroundColor: isCorrectSelected
                    ? "color-mix(in srgb, var(--color-cta) 22%, transparent)"
                    : isWrongSelected
                      ? "rgba(239, 68, 68, 0.12)"
                      : "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                  borderColor: isCorrectSelected
                    ? "var(--color-cta)"
                    : isWrongSelected
                      ? "rgb(239 68 68)"
                      : "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                  color: "var(--color-text)",
                }}
              >
                {option}
                {session.solved && option === exercise.correctChunk ? "  ✓" : ""}
              </button>
            );
          })}
        </div>

        {session.feedback === "wrong" && (
          <p className="text-sm font-semibold text-center text-red-500" data-testid="missing-chunk-feedback-wrong">
            Not quite. Try another chunk.
          </p>
        )}

        <div className="flex gap-3">
          <PrototypeActionButton
            fullWidth
            variant="ghost"
            onClick={onBack}
            dataTestId="missing-chunk-back-home"
          >
            Back to Home
          </PrototypeActionButton>
          <PrototypeActionButton
            fullWidth
            variant="primary"
            onClick={handleNext}
            disabled={!session.solved}
            dataTestId="missing-chunk-next"
          >
            Next
          </PrototypeActionButton>
        </div>
      </div>
    </PrototypeShell>
  );
}
