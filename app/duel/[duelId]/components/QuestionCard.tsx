"use client";

import type { CSSProperties } from "react";
import {
  Level1Input,
  Level2TypingInput,
  Level2MultipleChoice,
  Level3Input,
} from "@/app/game/levels";
import { colors } from "@/lib/theme";

interface Word {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface PlayerStats {
  questionsAnswered: number;
}

interface QuestionCardProps {
  currentWord: Word;
  myCurrentLevel: number | null;
  myLevel2Mode: "typing" | "multiple_choice";
  myCurrentWordIndex: number;
  myStats: PlayerStats | null;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  feedbackAnswer: string | null;
  showFlashHint: boolean;
  flashHintAnswer: string | null;
  canRequestHint: boolean;
  hintRequested: boolean;
  hintAccepted: boolean | undefined;
  hintType: string | null;
  hintRevealedPositions: number[];
  onRequestHint: (typedLetters: string[], revealedPositions: number[]) => void | Promise<void>;
  onRequestSimpleHint: () => void | Promise<void>;
  onCancelHint: () => void | Promise<void>;
  onUpdateHintState: (typedLetters: string[], revealedPositions: number[]) => void | Promise<void>;
  canRequestHintL2: boolean;
  hintRequestedL2: boolean;
  hintL2Accepted: boolean | undefined;
  hintL2EliminatedOptions: string[];
  onRequestHintL2: (options: string[]) => void | Promise<void>;
  onCancelHintL2: () => void | Promise<void>;
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
  onSkip: () => void;
}

export function QuestionCard({
  currentWord,
  myCurrentLevel,
  myLevel2Mode,
  myCurrentWordIndex,
  myStats,
  showFeedback,
  feedbackCorrect,
  feedbackAnswer,
  showFlashHint,
  flashHintAnswer,
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  hintRevealedPositions,
  onRequestHint,
  onRequestSimpleHint,
  onCancelHint,
  onUpdateHintState,
  canRequestHintL2,
  hintRequestedL2,
  hintL2Accepted,
  hintL2EliminatedOptions,
  onRequestHintL2,
  onCancelHintL2,
  onCorrect,
  onWrong,
  onSkip,
}: QuestionCardProps) {
  const levelBadgeStyles: Record<0 | 1 | 2 | 3, CSSProperties> = {
    0: {
      color: colors.text.muted,
      borderColor: colors.neutral.dark,
      backgroundColor: `${colors.neutral.dark}26`,
    },
    1: {
      color: colors.status.success.light,
      borderColor: colors.status.success.DEFAULT,
      backgroundColor: `${colors.status.success.DEFAULT}26`,
    },
    2: {
      color: colors.status.warning.light,
      borderColor: colors.status.warning.DEFAULT,
      backgroundColor: `${colors.status.warning.DEFAULT}26`,
    },
    3: {
      color: colors.status.danger.light,
      borderColor: colors.status.danger.DEFAULT,
      backgroundColor: `${colors.status.danger.DEFAULT}26`,
    },
  };

  const inputKey = `${myCurrentWordIndex}-${myStats?.questionsAnswered}`;

  return (
    <div
      className="w-full max-w-md rounded-xl p-6 border"
      style={{
        backgroundColor: `${colors.background.elevated}CC`,
        borderColor: colors.primary.dark,
        boxShadow: `0 18px 45px ${colors.primary.glow}`,
      }}
    >
      {/* Level indicator */}
      <div className="flex justify-center mb-4">
        <span
          className="inline-block px-3 py-1 rounded-full border text-sm font-medium"
          style={levelBadgeStyles[(myCurrentLevel || 1) as 0 | 1 | 2 | 3]}
        >
          Level {myCurrentLevel || 1}
        </span>
      </div>

      {/* Word to translate */}
      <div className="text-center mb-6">
        <div className="text-3xl font-bold mb-2" style={{ color: colors.text.DEFAULT }}>
          {currentWord.word}
        </div>
        <div className="text-sm" style={{ color: colors.text.muted }}>
          Translate to Spanish
        </div>
      </div>

      {/* Feedback overlay */}
      {showFeedback && (
        <div
          className="text-center py-4 mb-4 rounded-lg"
          style={
            feedbackCorrect
              ? {
                  backgroundColor: `${colors.status.success.DEFAULT}26`,
                  color: colors.status.success.light,
                }
              : {
                  backgroundColor: `${colors.status.danger.DEFAULT}26`,
                  color: colors.status.danger.light,
                }
          }
        >
          <div className="text-2xl font-bold mb-2">
            {feedbackCorrect ? "✓ Correct!" : "✗ Wrong"}
          </div>
          {feedbackAnswer && (
            <div className="text-lg">
              Answer: <span className="font-bold" style={{ color: colors.text.DEFAULT }}>{feedbackAnswer}</span>
            </div>
          )}
        </div>
      )}

      {/* Flash hint overlay - brief neutral answer flash */}
      {showFlashHint && flashHintAnswer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-pulse">
          <div
            className="backdrop-blur-sm px-8 py-6 rounded-2xl shadow-2xl border-2"
            style={{
              backgroundColor: `${colors.secondary.DEFAULT}E6`,
              borderColor: colors.secondary.light,
              color: colors.text.DEFAULT,
            }}
          >
            <div className="text-sm mb-1 text-center" style={{ color: colors.text.muted }}>
              ⚡ Hint
            </div>
            <div className="text-4xl font-bold text-center">{flashHintAnswer}</div>
          </div>
        </div>
      )}

      {/* Input based on level */}
      {!showFeedback && (
        <>
          {myCurrentLevel === 1 && (
            <Level1Input
              key={inputKey}
              answer={currentWord.answer}
              onCorrect={onCorrect}
              onSkip={onSkip}
              // Hint system props
              canRequestHint={canRequestHint}
              hintRequested={hintRequested}
              hintAccepted={hintAccepted}
              hintType={hintType}
              hintRevealedPositions={hintRevealedPositions}
              onRequestHint={onRequestHint}
              onCancelHint={onCancelHint}
              onUpdateHintState={onUpdateHintState}
            />
          )}

          {myCurrentLevel === 2 && myLevel2Mode === "typing" && (
            <Level2TypingInput
              key={inputKey}
              answer={currentWord.answer}
              onCorrect={onCorrect}
              onWrong={onWrong}
              onSkip={onSkip}
              // Hint system props
              canRequestHint={canRequestHint}
              hintRequested={hintRequested}
              hintAccepted={hintAccepted}
              hintType={hintType}
              onRequestHint={onRequestSimpleHint}
              onCancelHint={onCancelHint}
            />
          )}

          {myCurrentLevel === 2 && myLevel2Mode === "multiple_choice" && (
            <Level2MultipleChoice
              key={inputKey}
              answer={currentWord.answer}
              wrongAnswers={currentWord.wrongAnswers}
              onCorrect={onCorrect}
              onWrong={onWrong}
              onSkip={onSkip}
              // L2 hint props
              canRequestHint={canRequestHintL2}
              hintRequested={hintRequestedL2}
              hintAccepted={hintL2Accepted}
              eliminatedOptions={hintL2EliminatedOptions}
              onRequestHint={onRequestHintL2}
              onCancelHint={onCancelHintL2}
            />
          )}

          {myCurrentLevel === 3 && (
            <Level3Input
              key={inputKey}
              answer={currentWord.answer}
              onCorrect={onCorrect}
              onWrong={onWrong}
              onSkip={onSkip}
              // Hint system props
              canRequestHint={canRequestHint}
              hintRequested={hintRequested}
              hintAccepted={hintAccepted}
              hintType={hintType}
              onRequestHint={onRequestSimpleHint}
              onCancelHint={onCancelHint}
            />
          )}
        </>
      )}
    </div>
  );
}
