"use client";

import { cssVarColors as cssColors } from "@/app/components/themeCssVars";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { SessionWordEntry } from "@/lib/sessionWords";
import type { SoloSessionState } from "@/lib/soloPracticeRuntime";
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
    color: cssColors.status.success.DEFAULT,
    borderColor: cssColors.status.success.DEFAULT,
    backgroundColor: `${cssColors.status.success.DEFAULT}26`,
  },
  2: {
    color: cssColors.status.warning.DEFAULT,
    borderColor: cssColors.status.warning.DEFAULT,
    backgroundColor: `${cssColors.status.warning.DEFAULT}26`,
  },
  3: {
    color: cssColors.status.danger.DEFAULT,
    borderColor: cssColors.status.danger.DEFAULT,
    backgroundColor: `${cssColors.status.danger.DEFAULT}26`,
  },
};

interface SoloQuestionProps {
  session: SoloSessionState;
  currentWord: SessionWordEntry;
  cueText: string;
  helperText: string;
  expectedAnswer: string;
  hasMultipleThemes: boolean;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  feedbackAnswer: string | null;
  onCorrect: () => void;
  onIncorrect: () => void;
  onLevel0GotIt: () => void;
  onLevel0NotYet: () => void;
}

/**
 * The question card: level badge, the (multi-theme) cue, feedback, and the
 * level → input dispatch. Owns the mapping from the typed session state
 * (`questionLevel` / `translationDirection` / `level2Mode`) to the right Level
 * input so the page no longer carries a 220-line ladder.
 */
export function SoloQuestion({
  session,
  currentWord,
  cueText,
  helperText,
  expectedAnswer,
  hasMultipleThemes,
  showFeedback,
  feedbackCorrect,
  feedbackAnswer,
  onCorrect,
  onIncorrect,
  onLevel0GotIt,
  onLevel0NotYet,
}: SoloQuestionProps) {
  const colors = useAppearanceColors();
  const baseCardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const questionKey = `${session.currentWordIndex}-${session.questionsAnswered}`;

  // Multi-theme label: defined once, rendered in whichever branch is active.
  const themeLabel =
    hasMultipleThemes && currentWord.themeName ? (
      <div
        className="text-xs uppercase tracking-[0.25em] mb-2 text-center"
        style={{ color: colors.text.muted }}
      >
        {currentWord.themeName}
      </div>
    ) : null;

  return (
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
          {themeLabel}
          <div className="text-3xl font-bold" style={{ color: colors.text.DEFAULT }}>
            {cueText}
          </div>
          <div className="text-xs uppercase tracking-widest mt-2" style={{ color: colors.text.muted }}>
            {helperText}
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
            <>
              {themeLabel}
              <Level0Input
                key={questionKey}
                word={currentWord.word}
                answer={currentWord.answer}
                onGotIt={onLevel0GotIt}
                onNotYet={onLevel0NotYet}
                dataTestIdBase="solo-practice-level0"
              />
            </>
          )}

          {session.questionLevel === 1 && session.translationDirection === "forward" && (
            <Level1Input
              key={questionKey}
              answer={expectedAnswer}
              onCorrect={onCorrect}
              onSkip={onIncorrect}
              dataTestIdBase="solo-practice-level1"
            />
          )}

          {session.questionLevel === 1 && session.translationDirection === "reverse" && (
            <Level2TypingInput
              key={questionKey}
              answer={expectedAnswer}
              onCorrect={onCorrect}
              onWrong={onIncorrect}
              onSkip={onIncorrect}
              dataTestIdBase="solo-practice-level1-reverse"
            />
          )}

          {session.questionLevel === 2 && session.level2Mode === "typing" && (
            <Level2TypingInput
              key={questionKey}
              answer={expectedAnswer}
              onCorrect={onCorrect}
              onWrong={onIncorrect}
              onSkip={onIncorrect}
              dataTestIdBase="solo-practice-level2-typing"
            />
          )}

          {session.questionLevel === 2 && session.level2Mode === "multiple_choice" && (
            <Level2MultipleChoice
              key={questionKey}
              answer={expectedAnswer}
              wrongAnswers={currentWord.wrongAnswers}
              onCorrect={onCorrect}
              onWrong={onIncorrect}
              onSkip={onIncorrect}
              dataTestIdBase="solo-practice-level2-mc"
            />
          )}

          {session.questionLevel === 3 && (
            <Level3Input
              key={questionKey}
              answer={expectedAnswer}
              onCorrect={onCorrect}
              onWrong={onIncorrect}
              onSkip={onIncorrect}
              dataTestIdBase="solo-practice-level3"
            />
          )}
        </>
      )}
    </section>
  );
}
