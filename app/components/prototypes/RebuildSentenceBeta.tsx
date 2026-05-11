"use client";

import { useCallback, useState } from "react";
import { PrototypeActionButton } from "./PrototypeActionButton";
import { PrototypeShell } from "./PrototypeShell";
import { SentenceCompletion } from "./SentenceCompletion";

type SentenceFeedbackState = "idle" | "wrong" | "correct";

interface RebuildSentenceExercise {
  english: string;
  tokens: string[];
}

const REBUILD_SENTENCE_EXERCISES: RebuildSentenceExercise[] = [
  {
    english: "I write at night.",
    tokens: ["Yo", "escribo", "por", "la", "noche."],
  },
  {
    english: "The dog runs fast.",
    tokens: ["El", "perro", "corre", "rápido."],
  },
  {
    english: "We live in Madrid.",
    tokens: ["Nosotros", "vivimos", "en", "Madrid."],
  },
];

interface RebuildSentenceSessionState {
  currentCardIndex: number;
  builtTokenIndexes: number[];
  shuffledTokens: string[];
  solved: boolean;
  completed: boolean;
  feedback: SentenceFeedbackState;
}

function shuffleTokens(tokens: string[]): string[] {
  const copy = [...tokens];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function joinSentenceTokens(tokens: string[]): string {
  return tokens.join(" ");
}

function createSessionState(cardIndex = 0): RebuildSentenceSessionState {
  return {
    currentCardIndex: cardIndex,
    builtTokenIndexes: [],
    shuffledTokens: shuffleTokens(REBUILD_SENTENCE_EXERCISES[cardIndex].tokens),
    solved: false,
    completed: false,
    feedback: "idle",
  };
}

interface RebuildSentenceBetaProps {
  onBack: () => void;
  onSwitchToMissingChunk: () => void;
}

export function RebuildSentenceBeta({ onBack, onSwitchToMissingChunk }: RebuildSentenceBetaProps) {
  const [session, setSession] = useState<RebuildSentenceSessionState>(() => createSessionState());

  const exercise = REBUILD_SENTENCE_EXERCISES[session.currentCardIndex];
  const builtTokens = session.builtTokenIndexes.map((index) => session.shuffledTokens[index]);

  const handleAddToken = useCallback((tokenIndex: number) => {
    setSession((current) => {
      if (current.solved || current.completed || current.builtTokenIndexes.includes(tokenIndex)) {
        return current;
      }
      return {
        ...current,
        builtTokenIndexes: [...current.builtTokenIndexes, tokenIndex],
        feedback: "idle",
      };
    });
  }, []);

  const handleRemoveToken = useCallback((builtIndex: number) => {
    setSession((current) => {
      if (current.solved || current.completed) return current;
      return {
        ...current,
        builtTokenIndexes: current.builtTokenIndexes.filter((_, index) => index !== builtIndex),
        feedback: "idle",
      };
    });
  }, []);

  const handleUndo = useCallback(() => {
    setSession((current) => {
      if (current.solved || current.completed || current.builtTokenIndexes.length === 0) return current;
      return {
        ...current,
        builtTokenIndexes: current.builtTokenIndexes.slice(0, -1),
        feedback: "idle",
      };
    });
  }, []);

  const handleClear = useCallback(() => {
    setSession((current) => {
      if (current.solved || current.completed || current.builtTokenIndexes.length === 0) return current;
      return { ...current, builtTokenIndexes: [], feedback: "idle" };
    });
  }, []);

  const handleCheck = useCallback(() => {
    setSession((current) => {
      if (current.solved || current.completed) return current;
      const ex = REBUILD_SENTENCE_EXERCISES[current.currentCardIndex];
      const assembled = joinSentenceTokens(
        current.builtTokenIndexes.map((tokenIndex) => current.shuffledTokens[tokenIndex])
      );
      const correct = joinSentenceTokens(ex.tokens);
      const isCorrect = assembled === correct;
      return { ...current, feedback: isCorrect ? "correct" : "wrong", solved: isCorrect };
    });
  }, []);

  const handleNext = useCallback(() => {
    setSession((current) => {
      if (!current.solved) return current;
      const isLastCard = current.currentCardIndex === REBUILD_SENTENCE_EXERCISES.length - 1;
      if (isLastCard) return { ...current, completed: true };
      return createSessionState(current.currentCardIndex + 1);
    });
  }, []);

  const handleRestart = useCallback(() => setSession(createSessionState()), []);

  if (session.completed) {
    return (
      <PrototypeShell title="Rebuild Sentence" testIdPrefix="rebuild_sentence" onBack={onBack}>
        <SentenceCompletion
          title="Rebuild Sentence finished"
          testIdPrefix="prototype-rebuild_sentence"
          otherModeLabel="Try Other Mode"
          onRestart={handleRestart}
          onBack={onBack}
          onSwitchMode={onSwitchToMissingChunk}
        />
      </PrototypeShell>
    );
  }

  const correctSentence = joinSentenceTokens(exercise.tokens);

  return (
    <PrototypeShell title="Rebuild Sentence" testIdPrefix="rebuild_sentence" onBack={onBack}>
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--color-cta-dark)" }}
          >
            Card {session.currentCardIndex + 1} of {REBUILD_SENTENCE_EXERCISES.length}
          </p>
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sentence Beta: Rebuild Sentence
          </h2>
          <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
            Tap tokens to rebuild the Spanish sentence, then check it.
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
                Your answer
              </p>
              <div
                className="mt-2 min-h-24 rounded-2xl border-2 border-dashed p-3"
                style={{ borderColor: "color-mix(in srgb, var(--color-primary) 60%, transparent)" }}
              >
                {session.solved ? (
                  <p
                    className="text-xl font-semibold leading-8"
                    style={{ color: "var(--color-cta-dark)" }}
                  >
                    {correctSentence}
                  </p>
                ) : builtTokens.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Tap tokens below to build the sentence.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {builtTokens.map((token, index) => (
                      <button
                        key={`${token}-${index}`}
                        type="button"
                        onClick={() => handleRemoveToken(index)}
                        disabled={session.solved}
                        className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                        data-testid={`rebuild-built-token-${index}`}
                        style={{
                          borderColor: "color-mix(in srgb, var(--color-cta) 65%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--color-cta) 18%, transparent)",
                          color: "var(--color-text)",
                        }}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <PrototypeActionButton
                fullWidth
                variant="ghost"
                onClick={handleUndo}
                disabled={session.solved || builtTokens.length === 0}
                dataTestId="rebuild-sentence-undo"
              >
                Undo
              </PrototypeActionButton>
              <PrototypeActionButton
                fullWidth
                variant="ghost"
                onClick={handleClear}
                disabled={session.solved || builtTokens.length === 0}
                dataTestId="rebuild-sentence-clear"
              >
                Clear
              </PrototypeActionButton>
            </div>
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Available tokens
          </p>
          <div className="flex flex-wrap gap-2">
            {session.shuffledTokens.map((token, index) => {
              const isUsed = session.builtTokenIndexes.includes(index);
              return (
                <button
                  key={`${token}-${index}`}
                  type="button"
                  onClick={() => handleAddToken(index)}
                  disabled={isUsed || session.solved}
                  className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid={`rebuild-token-${index}`}
                  style={{
                    borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                    color: "var(--color-text)",
                  }}
                >
                  {token}
                </button>
              );
            })}
          </div>
        </div>

        {session.feedback === "wrong" && (
          <p className="text-sm font-semibold text-center text-red-500" data-testid="rebuild-sentence-feedback-wrong">
            That order is not right yet. Keep trying.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <PrototypeActionButton
            fullWidth
            variant="primary"
            onClick={handleCheck}
            disabled={session.solved || builtTokens.length === 0}
            dataTestId="rebuild-sentence-check"
          >
            Check
          </PrototypeActionButton>
          <PrototypeActionButton
            fullWidth
            onClick={handleNext}
            disabled={!session.solved}
            dataTestId="rebuild-sentence-next"
          >
            Next
          </PrototypeActionButton>
        </div>

        <PrototypeActionButton fullWidth variant="ghost" onClick={onBack} dataTestId="rebuild-sentence-back-home">
          Back to Home
        </PrototypeActionButton>
      </div>
    </PrototypeShell>
  );
}
