"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { formatDuration } from "@/lib/stringUtils";

// Feature-local imports
import { useSoloSession } from "./hooks/useSoloSession";
import { CompletionScreen } from "./components/CompletionScreen";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";

// Shared Level components
import {
  Level0Input,
  Level1Input,
  Level2TypingInput,
  Level2MultipleChoice,
  Level3Input,
} from "@/app/game/levels";

// Fixed grey for level 0 to remain consistent across all palettes
const LEVEL_0_GREY = "#9CA3AF";
const LEVEL_0_GREY_DARK = "#6B7280";

const levelBadgeStyles: Record<0 | 1 | 2 | 3, { color: string; borderColor: string; backgroundColor: string }> = {
  0: {
    color: LEVEL_0_GREY,
    borderColor: LEVEL_0_GREY_DARK,
    backgroundColor: `${LEVEL_0_GREY_DARK}26`,
  },
  1: {
    color: colors.status.success.DEFAULT,
    borderColor: colors.status.success.DEFAULT,
    backgroundColor: `${colors.status.success.DEFAULT}26`,
  },
  2: {
    color: colors.status.warning.DEFAULT,
    borderColor: colors.status.warning.DEFAULT,
    backgroundColor: `${colors.status.warning.DEFAULT}26`,
  },
  3: {
    color: colors.status.danger.DEFAULT,
    borderColor: colors.status.danger.DEFAULT,
    backgroundColor: `${colors.status.danger.DEFAULT}26`,
  },
};

/**
 * Solo Challenge Page - Controller component
 * Orchestrates the solo learning experience by connecting:
 * - Theme data from Convex
 * - Session state from useSoloSession hook
 * - Level input components
 */
export default function SoloChallengePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const themeId = searchParams.get("themeId");
  const confidenceParam = searchParams.get("confidence");

  // Parse initial confidence levels from URL
  const initialConfidenceByWordIndex = useMemo(() => {
    if (!confidenceParam) return null;
    try {
      const parsed = JSON.parse(confidenceParam) as unknown;
      if (!parsed || typeof parsed !== "object") return null;

      const record = parsed as Record<string, unknown>;
      const levels: Record<number, 0 | 1 | 2 | 3> = {};
      for (const [key, value] of Object.entries(record)) {
        const wordIndex = Number(key);
        if (!Number.isFinite(wordIndex)) continue;
        if (typeof value !== "number") continue;
        if (![0, 1, 2, 3].includes(value)) continue;
        levels[wordIndex] = value as 0 | 1 | 2 | 3;
      }
      return levels;
    } catch {
      return null;
    }
  }, [confidenceParam]);

  // Fetch theme data
  const theme = useQuery(
    api.themes.getTheme,
    themeId ? { themeId: themeId as Id<"themes"> } : "skip"
  );

  // Session state management (extracted hook)
  const {
    session,
    showFeedback,
    feedbackCorrect,
    feedbackAnswer,
    elapsedTime,
    handleCorrect,
    handleIncorrect,
    handleLevel0GotIt,
    handleLevel0NotYet,
    currentWord,
    masteredCount,
  } = useSoloSession({
    words: theme?.words,
    initialConfidenceByWordIndex,
  });

  // Navigation
  const handleExit = () => router.push("/");

  const baseCardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  // Loading states
  if (!themeId) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <div
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.status.danger.DEFAULT,
              boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
            }}
          >
            <p className="text-lg font-semibold" style={{ color: colors.status.danger.light }}>
              No theme selected
            </p>
            <button
              onClick={handleExit}
              className="mt-6 px-4 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid="solo-challenge-back-home"
            >
              Back to Home
            </button>
          </div>
        </div>
        <div
          className="relative z-10 h-1"
          style={{
            background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
          }}
        />
      </ThemedPage>
    );
  }

  if (theme === undefined) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <div
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
            style={baseCardStyle}
          >
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="mt-4 text-sm" style={{ color: colors.text.muted }}>
              Loading challenge...
            </p>
          </div>
        </div>
        <div
          className="relative z-10 h-1"
          style={{
            background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
          }}
        />
      </ThemedPage>
    );
  }

  if (theme === null) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <div
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.status.danger.DEFAULT,
              boxShadow: `0 18px 45px ${colors.status.danger.DEFAULT}33`,
            }}
          >
            <p className="text-lg font-semibold" style={{ color: colors.status.danger.light }}>
              Theme not found
            </p>
            <button
              onClick={handleExit}
              className="mt-6 px-4 py-2 rounded-xl border-2 text-xs font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid="solo-challenge-back-home"
            >
              Back to Home
            </button>
          </div>
        </div>
        <div
          className="relative z-10 h-1"
          style={{
            background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
          }}
        />
      </ThemedPage>
    );
  }

  if (!session.initialized || !currentWord) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <div
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
            style={baseCardStyle}
          >
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="mt-4 text-sm" style={{ color: colors.text.muted }}>
              Preparing your next question...
            </p>
          </div>
        </div>
        <div
          className="relative z-10 h-1"
          style={{
            background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
          }}
        />
      </ThemedPage>
    );
  }

  const header = (
    <header className="w-full flex flex-col items-center text-center pb-4 animate-slide-up">
      <div
        className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
        style={{ color: colors.neutral.DEFAULT }}
      />

      <h1 className="title-font text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none text-center">
        <span
          className="title-text-outline"
          data-text="Solo"
          style={{
            background: `linear-gradient(135deg, ${colors.primary.dark} 0%, ${colors.primary.light} 50%, ${colors.primary.dark} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Solo
        </span>{" "}
        <span
          className="title-text-outline-accent"
          data-text="Challenge"
          style={{
            background: `linear-gradient(135deg, ${colors.cta.dark} 0%, ${colors.cta.light} 50%, ${colors.cta.dark} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Challenge
        </span>
      </h1>

      <div
        className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs uppercase tracking-widest max-w-full"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          color: colors.text.muted,
        }}
      >
        <span className="truncate max-w-[240px]">{theme.name}</span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div
          className="w-8 h-px bg-gradient-to-r from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
        <div className="w-1.5 h-1.5 rotate-45" style={{ backgroundColor: colors.primary.DEFAULT }} />
        <div
          className="w-8 h-px bg-gradient-to-l from-transparent to-current"
          style={{ color: colors.primary.DEFAULT }}
        />
      </div>
    </header>
  );

  const progressPercentage = theme.words.length
    ? Math.min(100, (masteredCount / theme.words.length) * 100)
    : 0;

  const content = session.completed ? (
    <CompletionScreen
      questionsAnswered={session.questionsAnswered}
      correctAnswers={session.correctAnswers}
      totalWords={theme.words.length}
      totalDuration={elapsedTime}
      onExit={handleExit}
    />
  ) : (
    <>
      <div className="absolute top-4 right-4 z-20 animate-slide-up delay-100">
        <button
          onClick={handleExit}
          className="px-5 py-3 rounded-xl border-2 border-b-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 hover:translate-y-0.5 active:translate-y-1 shadow-lg"
          style={{
            backgroundColor: colors.status.danger.DEFAULT,
            borderTopColor: colors.status.danger.light,
            borderBottomColor: colors.status.danger.dark,
            borderLeftColor: colors.status.danger.DEFAULT,
            borderRightColor: colors.status.danger.DEFAULT,
            color: "#FFFFFF",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
          data-testid="solo-challenge-exit"
        >
          Exit
        </button>
      </div>

      {header}

      <section
        className="w-full rounded-3xl border-2 p-4 sm:p-5 mb-4 backdrop-blur-sm animate-slide-up delay-200"
        style={baseCardStyle}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
              Elapsed Time
            </div>
            <div className="mt-1 text-3xl sm:text-4xl font-mono" style={{ color: colors.text.DEFAULT }}>
              {formatDuration(elapsedTime)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
              Mastered
            </div>
            <div className="mt-1 text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
              {masteredCount} / {theme.words.length}
            </div>
            <div className="text-xs" style={{ color: colors.text.muted }}>
              Pool {session.activePool.length} active
            </div>
          </div>
        </div>

        <div
          className="mt-4 h-2 rounded-full border-2"
          style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progressPercentage}%`,
              backgroundImage: `linear-gradient(90deg, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT})`,
            }}
          />
        </div>
      </section>

      <section
        className="w-full rounded-3xl border-2 p-6 backdrop-blur-sm animate-slide-up delay-300"
        style={baseCardStyle}
      >
        <div className="flex justify-center mb-4">
          <span
            className="inline-block px-3 py-1 rounded-full border-2 text-xs font-bold uppercase tracking-widest"
            style={levelBadgeStyles[session.questionLevel]}
          >
            Level {session.questionLevel}
          </span>
        </div>

        {session.questionLevel !== 0 && (
          <div className="text-center mb-6">
            <div className="text-3xl font-bold" style={{ color: colors.text.DEFAULT }}>
              {currentWord.word}
            </div>
            <div className="text-xs uppercase tracking-widest mt-2" style={{ color: colors.text.muted }}>
              Translate to Spanish
            </div>
          </div>
        )}

        {showFeedback && (
          <div
            className="text-center py-4 mb-4 rounded-2xl border-2"
            style={
              feedbackCorrect
                ? {
                    borderColor: colors.status.success.DEFAULT,
                    backgroundColor: `${colors.status.success.DEFAULT}26`,
                    color: colors.status.success.light,
                  }
                : {
                    borderColor: colors.status.danger.DEFAULT,
                    backgroundColor: `${colors.status.danger.DEFAULT}26`,
                    color: colors.status.danger.light,
                  }
            }
          >
            <div className="text-2xl font-bold mb-2">
              {feedbackCorrect ? "Correct" : "Wrong"}
            </div>
            {feedbackAnswer && (
              <div className="text-base" style={{ color: colors.text.DEFAULT }}>
                Answer: <span className="font-bold">{feedbackAnswer}</span>
              </div>
            )}
          </div>
        )}

        {!showFeedback && (
          <>
            {session.questionLevel === 0 && (
              <Level0Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                word={currentWord.word}
                answer={currentWord.answer}
                onGotIt={handleLevel0GotIt}
                onNotYet={handleLevel0NotYet}
                dataTestIdBase="solo-challenge-level0"
              />
            )}

            {session.questionLevel === 1 && (
              <Level1Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onSkip={handleIncorrect}
                mode="solo"
                dataTestIdBase="solo-challenge-level1"
              />
            )}

            {session.questionLevel === 2 && session.level2Mode === "typing" && (
              <Level2TypingInput
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleIncorrect}
                onSkip={handleIncorrect}
                mode="solo"
                dataTestIdBase="solo-challenge-level2-typing"
              />
            )}

            {session.questionLevel === 2 && session.level2Mode === "multiple_choice" && (
              <Level2MultipleChoice
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                wrongAnswers={currentWord.wrongAnswers}
                onCorrect={handleCorrect}
                onWrong={handleIncorrect}
                onSkip={handleIncorrect}
                mode="solo"
                dataTestIdBase="solo-challenge-level2-mc"
              />
            )}

            {session.questionLevel === 3 && (
              <Level3Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleIncorrect}
                onSkip={handleIncorrect}
                mode="solo"
                dataTestIdBase="solo-challenge-level3"
              />
            )}
          </>
        )}
      </section>

      <div
        className="mt-4 text-xs uppercase tracking-widest"
        style={{ color: colors.text.DEFAULT }}
      >
        Questions: {session.questionsAnswered} | Correct: {session.correctAnswers}
      </div>
    </>
  );

  const containerClassName = `relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-xl mx-auto px-6 pt-6 pb-0 ${
    session.completed ? "justify-center" : ""
  }`;

  return (
    <ThemedPage>
      <div className={containerClassName}>{content}</div>
      <div
        className="relative z-10 h-1"
        style={{
          background: `linear-gradient(to right, ${colors.primary.DEFAULT}, ${colors.cta.DEFAULT}, ${colors.secondary.DEFAULT})`,
        }}
      />
    </ThemedPage>
  );
}
