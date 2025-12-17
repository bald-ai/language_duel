"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { formatDuration } from "@/lib/stringUtils";

// Feature-local imports
import { useSoloSession } from "./hooks";
import { CompletionScreen } from "./components";
import { LEVEL_COLORS } from "./constants";

// Shared Level components
import {
  Level0Input,
  Level1Input,
  Level2TypingInput,
  Level2MultipleChoice,
  Level3Input,
} from "@/app/game/levels";

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

  // Loading states
  if (!themeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">No theme selected</div>
      </div>
    );
  }

  if (theme === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (theme === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">Theme not found</div>
      </div>
    );
  }

  if (!session.initialized || !currentWord) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Completion screen
  if (session.completed) {
    return (
      <CompletionScreen
        questionsAnswered={session.questionsAnswered}
        correctAnswers={session.correctAnswers}
        totalWords={theme.words.length}
        totalDuration={elapsedTime}
        onExit={handleExit}
      />
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 relative">
      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
      >
        Exit Challenge
      </button>

      {/* Progress Header */}
      <div className="w-full max-w-md mb-8 mt-16">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-300">{theme.name}</h1>
          <div className="text-2xl font-mono text-gray-400 mt-2">
            {formatDuration(elapsedTime)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="bg-gray-700 rounded-full h-4 mb-2">
          <div
            className="bg-green-500 rounded-full h-4 transition-all duration-300"
            style={{ width: `${(masteredCount / theme.words.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>
            {masteredCount} / {theme.words.length} words mastered
          </span>
          <span>Pool: {session.activePool.length} active</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="w-full max-w-md bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        {/* Level indicator */}
        <div className="flex justify-center mb-4">
          <span
            className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${LEVEL_COLORS[session.questionLevel]}`}
          >
            Level {session.questionLevel}
          </span>
        </div>

        {/* Word to translate */}
        {session.questionLevel !== 0 && (
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-white mb-2">{currentWord.word}</div>
            <div className="text-sm text-gray-400">Translate to Spanish</div>
          </div>
        )}

        {/* Feedback overlay */}
        {showFeedback && (
          <div
            className={`text-center py-4 mb-4 rounded-lg ${
              feedbackCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            <div className="text-2xl font-bold mb-2">
              {feedbackCorrect ? "✓ Correct!" : "✗ Wrong"}
            </div>
            {feedbackAnswer && (
              <div className="text-lg">
                Answer: <span className="font-bold text-white">{feedbackAnswer}</span>
              </div>
            )}
          </div>
        )}

        {/* Input based on level */}
        {!showFeedback && (
          <>
            {session.questionLevel === 0 && (
              <Level0Input
                word={currentWord.word}
                answer={currentWord.answer}
                onGotIt={handleLevel0GotIt}
                onNotYet={handleLevel0NotYet}
              />
            )}

            {session.questionLevel === 1 && (
              <Level1Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onSkip={handleIncorrect}
              />
            )}

            {session.questionLevel === 2 && session.level2Mode === "typing" && (
              <Level2TypingInput
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleIncorrect}
                onSkip={handleIncorrect}
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
              />
            )}

            {session.questionLevel === 3 && (
              <Level3Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleIncorrect}
                onSkip={handleIncorrect}
              />
            )}
          </>
        )}
      </div>

      {/* Stats footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        Questions: {session.questionsAnswered} | Correct: {session.correctAnswers}
      </div>
    </main>
  );
}
