"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";

/**
 * Sentence Builder (mock prototype).
 *
 * Vision: reuse the real DUEL multiple-choice screen — same full-screen themed
 * card, scoreboard header, prompt, timer and 2-column grid of option buttons —
 * but instead of picking the ONE correct answer, the player taps the words in
 * order. Each tap stamps the word with its position in the sentence (1, 2, 3 …)
 * and the sentence assembles under the prompt.
 *
 * This is a UI mock to convey the idea: tapping builds order and "Confirm"
 * checks it, but there is no scoring, timer, or backend wiring.
 */

interface SentenceExercise {
  english: string;
  /** Words in their correct order. */
  words: string[];
}

const EXERCISES: SentenceExercise[] = [
  { english: "I write at night.", words: ["Yo", "escribo", "por", "la", "noche"] },
  { english: "The dog runs fast.", words: ["El", "perro", "corre", "rápido"] },
  { english: "We live in Madrid.", words: ["Nosotros", "vivimos", "en", "Madrid"] },
];

type Feedback = "idle" | "wrong" | "correct";

// Mock-only flavour so the screen reads like a real duel.
const MOCK_TIMER_SECONDS = 18;
const MOCK_MY_SCORE = 2;
const MOCK_THEIR_SCORE = 1;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface SentenceBuilderBetaProps {
  onBack: () => void;
}

export function SentenceBuilderBeta({ onBack }: SentenceBuilderBetaProps) {
  const colors = useAppearanceColors();
  const [cardIndex, setCardIndex] = useState(0);
  const [placedOrder, setPlacedOrder] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("idle");

  const exercise = EXERCISES[cardIndex];

  // Words shown in shuffled order, like the duel's shuffled answer options.
  const shuffledWords = useMemo(
    () => shuffle(exercise.words.map((word) => word)),
    [exercise]
  );

  const solved = feedback === "correct";
  const assembled = placedOrder.map((i) => shuffledWords[i]).join(" ");
  const allPlaced = placedOrder.length === shuffledWords.length;

  const handleToggle = useCallback(
    (optionIndex: number) => {
      if (solved) return;
      setFeedback("idle");
      setPlacedOrder((current) =>
        current.includes(optionIndex)
          ? current.filter((i) => i !== optionIndex)
          : [...current, optionIndex]
      );
    },
    [solved]
  );

  const handleConfirm = useCallback(() => {
    const built = placedOrder.map((i) => shuffledWords[i]).join(" ");
    setFeedback(built === exercise.words.join(" ") ? "correct" : "wrong");
  }, [placedOrder, shuffledWords, exercise]);

  const handleNext = useCallback(() => {
    setCardIndex((current) => (current + 1) % EXERCISES.length);
    setPlacedOrder([]);
    setFeedback("idle");
  }, []);

  // ---- Styles mirrored from DuelView ----
  const gameContainerStyle = {
    "--duel-bg": `${colors.background.DEFAULT}E6`,
    "--duel-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as CSSProperties;
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };
  const mutedTextStyle = { color: colors.text.muted };
  const exitButtonStyle = { backgroundColor: colors.status.danger.DEFAULT, color: colors.text.inverse };

  const difficultyPillStyle = {
    color: colors.status.warning.light,
    backgroundColor: `${colors.status.warning.DEFAULT}33`,
    borderColor: colors.status.warning.DEFAULT,
  };

  const confirmDisabled = !allPlaced && !solved;
  const confirmButtonStyle = confirmDisabled
    ? { backgroundColor: colors.background.elevated, borderBottomColor: colors.neutral.dark, color: colors.text.muted }
    : { backgroundColor: colors.cta.DEFAULT, borderBottomColor: colors.cta.dark, color: colors.text.DEFAULT };

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      {/* Game Container - full screen on mobile, centered card on desktop */}
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={gameContainerStyle}
      >
        {/* Header: Scoreboard + Exit */}
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 border-b"
          style={subtleBorderStyle}
        >
          <Scoreboard myName="You" theirName="Rival" myScore={MOCK_MY_SCORE} theirScore={MOCK_THEIR_SCORE} />
          <button
            onClick={onBack}
            className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
            style={exitButtonStyle}
            data-testid="sentence-builder-exit"
          >
            Exit Duel
          </button>
        </header>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          {/* Progress + difficulty */}
          <div className="text-center mb-3">
            <div className="text-sm mb-1" style={mutedTextStyle}>
              Sentence #{cardIndex + 1} of {EXERCISES.length}
            </div>
            <span
              className="inline-block px-3 py-1 rounded-full border text-sm font-medium"
              style={difficultyPillStyle}
            >
              MEDIUM (+2 pts)
            </span>
          </div>

          {/* Prompt: the sentence to build */}
          <div className="text-center mb-3">
            <div className="text-xs uppercase tracking-[0.25em] mb-2" style={mutedTextStyle}>
              Build this sentence
            </div>
            <div className="text-2xl md:text-3xl font-bold">{exercise.english}</div>
          </div>

          {/* The sentence being assembled */}
          <div
            className="w-full max-w-md min-h-12 rounded-xl border-2 border-dashed p-3 text-center text-lg font-semibold mb-4"
            style={{
              borderColor: `${colors.primary.dark}80`,
              color: solved ? colors.status.success.light : colors.text.DEFAULT,
            }}
            data-testid="sentence-builder-assembled"
          >
            {assembled || (
              <span className="text-sm font-normal" style={mutedTextStyle}>
                Tap the words in order…
              </span>
            )}
          </div>

          {/* Timer (mock) */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-4xl font-bold tabular-nums">{MOCK_TIMER_SECONDS}</span>
            <span className="text-xs" style={mutedTextStyle}>sec</span>
          </div>

          {/* Word options - 2-column grid, exactly like the duel answer grid,
              but tapping stamps each word with its order position. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
            {shuffledWords.map((word, optionIndex) => {
              const orderPos = placedOrder.indexOf(optionIndex);
              const isPlaced = orderPos !== -1;

              const buttonStyle: CSSProperties = solved
                ? {
                    backgroundColor: `${colors.status.success.DEFAULT}26`,
                    borderColor: colors.status.success.DEFAULT,
                    color: colors.status.success.light,
                  }
                : isPlaced
                  ? {
                      backgroundColor: `${colors.secondary.DEFAULT}26`,
                      borderColor: colors.secondary.DEFAULT,
                      color: colors.secondary.light,
                    }
                  : {
                      backgroundColor: colors.background.DEFAULT,
                      borderColor: colors.primary.dark,
                      color: colors.text.DEFAULT,
                    };

              return (
                <button
                  key={`${word}-${optionIndex}`}
                  type="button"
                  onClick={() => handleToggle(optionIndex)}
                  disabled={solved}
                  className="relative p-4 rounded-lg border-2 text-lg font-medium transition-all hover:brightness-110 disabled:cursor-not-allowed"
                  style={buttonStyle}
                  data-testid={`sentence-builder-word-${optionIndex}`}
                >
                  {isPlaced && (
                    <span
                      className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: colors.secondary.DEFAULT, color: colors.text.inverse }}
                    >
                      {orderPos + 1}
                    </span>
                  )}
                  {word}
                </button>
              );
            })}
          </div>

          {feedback === "wrong" && (
            <div className="mt-4 text-center text-sm font-medium" style={{ color: colors.status.danger.light }}>
              Not the right order yet — tap a word to remove it and try again.
            </div>
          )}
          {feedback === "correct" && (
            <div className="mt-4 text-center text-sm font-medium" style={{ color: colors.status.success.light }}>
              ¡Correcto! That is the right order.
            </div>
          )}
        </div>

        {/* Footer: Confirm */}
        <footer
          className="flex-shrink-0 flex flex-col items-center gap-2 w-full px-4 py-3 md:pb-4 border-t"
          style={subtleBorderStyle}
        >
          {solved ? (
            <button
              className="w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl transition-all active:scale-95 border-b-4 hover:brightness-110"
              style={{ backgroundColor: colors.cta.DEFAULT, borderBottomColor: colors.cta.dark, color: colors.text.DEFAULT }}
              onClick={handleNext}
              data-testid="sentence-builder-next"
            >
              Next Sentence
            </button>
          ) : (
            <button
              className="w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110"
              style={confirmButtonStyle}
              disabled={confirmDisabled}
              onClick={handleConfirm}
              data-testid="sentence-builder-confirm"
            >
              Confirm Answer
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
