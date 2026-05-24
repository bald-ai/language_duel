"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { formatDuration } from "@/lib/displayFormat";
import { decodeConfidenceParam } from "@/lib/soloConfidenceParam";

// Feature-local imports
import { useSoloSession } from "./hooks/useSoloSession";
import { useSoloCompletionReporting } from "./hooks/useSoloCompletionReporting";
import { CompletionScreen } from "./components/CompletionScreen";
import { SoloQuestion } from "./components/SoloQuestion";
import { getDirectionalCopy } from "./translationDirection";

// Shared solo chrome
import { useSoloSessionSource } from "@/app/solo/hooks/useSoloSessionSource";
import { SoloStatusScreen } from "@/app/solo/components/SoloStatusScreen";
import { SoloStatusCard } from "@/app/solo/components/SoloStatusCard";
import { SoloPageShell } from "@/app/solo/components/SoloPageShell";
import { SoloExitButton } from "@/app/solo/components/SoloExitButton";
import { SoloHeader } from "@/app/solo/components/SoloHeader";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

/**
 * Solo Practice Page - Controller component
 * Wires the shared session-source resolution to the session state machine, the
 * server progress reporting, and the question dispatch. Pre-session states are
 * delegated to {@link SoloStatusScreen}.
 */
export default function SoloPracticePage() {
  const colors = useAppearanceColors();
  const router = useRouter();
  const source = useSoloSessionSource({ loadingMessage: "Loading practice..." });
  const {
    status,
    statusMessage,
    sessionWords,
    themeSummary,
    soloPracticeSessionId,
    returnTo,
    returnLabel,
    spacedRepetitionStep,
    isBossPractice,
    confidenceParam,
  } = source;

  const initialConfidenceByWordIndex = useMemo(
    () => decodeConfidenceParam(confidenceParam),
    [confidenceParam]
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
    words: sessionWords,
    initialConfidenceByWordIndex,
  });

  const { handleCorrectWithProgress } = useSoloCompletionReporting({
    soloPracticeSessionId,
    spacedRepetitionStep,
    isBossPractice,
    session,
    handleCorrect,
  });

  // Navigation
  const handleExit = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    router.push(returnTo);
  }, [router, returnTo]);

  const hasMultipleThemes = useMemo(
    () => new Set(sessionWords.map((word) => String(word.themeId))).size > 1,
    [sessionWords]
  );

  if (status !== "ready") {
    return (
      <SoloStatusScreen
        status={status}
        message={statusMessage}
        returnLabel={returnLabel}
        onExit={handleExit}
        testIdBase="solo-practice"
      />
    );
  }

  if (sessionWords.length === 0) {
    return (
      <SoloPageShell>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <SoloStatusCard
            message="This theme has no words to practice"
            variant="error"
            buttonLabel={returnLabel}
            onButtonClick={handleExit}
            dataTestId="solo-practice-back-home"
          />
        </div>
      </SoloPageShell>
    );
  }

  if (!session.initialized || !currentWord) {
    return (
      <SoloPageShell>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <SoloStatusCard message="Preparing your next question..." variant="loading" />
        </div>
      </SoloPageShell>
    );
  }

  const { cueText, helperText, expectedAnswer } = getDirectionalCopy(
    currentWord,
    session.translationDirection
  );

  const baseCardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const progressPercentage = sessionWords.length
    ? Math.min(100, (masteredCount / sessionWords.length) * 100)
    : 0;

  const themePill = (
    <div
      className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs uppercase tracking-widest max-w-full"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      }}
    >
      <span className="truncate max-w-[240px]">{themeSummary}</span>
    </div>
  );

  const content = session.completed ? (
    <CompletionScreen
      questionsAnswered={session.questionsAnswered}
      correctAnswers={session.correctAnswers}
      totalWords={sessionWords.length}
      totalDuration={elapsedTime}
      onExit={handleExit}
      exitLabel={returnLabel}
    />
  ) : (
    <>
      <div
        className="w-full flex justify-end animate-slide-up delay-100"
        style={{
          paddingTop: "max(1rem, var(--sat))",
          paddingRight: "max(0px, var(--sar))",
        }}
      >
        <SoloExitButton onExit={handleExit} dataTestId="solo-practice-exit" />
      </div>

      <SoloHeader variant="outline" subtitle={themePill} />

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
              {masteredCount} / {sessionWords.length}
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

      <SoloQuestion
        session={session}
        currentWord={currentWord}
        cueText={cueText}
        helperText={helperText}
        expectedAnswer={expectedAnswer}
        hasMultipleThemes={hasMultipleThemes}
        showFeedback={showFeedback}
        feedbackCorrect={feedbackCorrect}
        feedbackAnswer={feedbackAnswer}
        onCorrect={handleCorrectWithProgress}
        onIncorrect={handleIncorrect}
        onLevel0GotIt={handleLevel0GotIt}
        onLevel0NotYet={handleLevel0NotYet}
      />

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
    <SoloPageShell>
      <div className={containerClassName}>{content}</div>
    </SoloPageShell>
  );
}
