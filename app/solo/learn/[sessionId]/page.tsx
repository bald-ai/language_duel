"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { SOLO_TIMER_OPTIONS, DEFAULT_DURATION } from "./constants";
import {
  getSoloLearnTimerLabel,
  shouldShowSoloLearnTimer,
} from "@/lib/soloLearnTimer";
import { SoloLearnWordRow } from "./components/SoloLearnWordRow";
import { SentenceStudyCard } from "./components/SentenceStudyCard";
import { SetAllDropdown } from "./components/SetAllDropdown";
import { CONFIDENCE_COLORS } from "./components/ConfidenceSlider";
import { useSoloLearnState, DEFAULT_HINT_STATE } from "./hooks/useSoloLearnState";
import { useSoloLearnTimer } from "./hooks/useSoloLearnTimer";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { ThemeColors } from "@/lib/appearance";
import { useTTS } from "@/hooks/useTTS";
import { buildSoloSearchParams } from "@/lib/soloNavigation";
import { encodeConfidenceParam } from "@/lib/soloConfidenceParam";
import { actionButtonClassName, getCtaActionStyle } from "@/app/components/modals/modalButtonStyles";

// Shared solo chrome
import { useSoloSessionSource } from "@/app/solo/hooks/useSoloSessionSource";
import { SoloStatusScreen } from "@/app/solo/components/SoloStatusScreen";
import { SoloPageShell } from "@/app/solo/components/SoloPageShell";
import { SoloExitButton } from "@/app/solo/components/SoloExitButton";
import { SoloHeader } from "@/app/solo/components/SoloHeader";
import { sentenceItemMaxLevel } from "@/lib/soloSentenceRuntime";

const toggleButtonClassName =
  "px-4 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold uppercase tracking-widest transition hover:brightness-110";

const getToggleActiveStyle = (colors: ThemeColors) => ({
  backgroundColor: colors.primary.DEFAULT,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
});

const getToggleInactiveStyle = (colors: ThemeColors) => ({
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.muted,
});

const getCardStyle = (colors: ThemeColors) => ({
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.primary.dark,
  boxShadow: `0 18px 50px ${colors.primary.glow}`,
});

const getListCardStyle = (colors: ThemeColors) => ({
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.primary.dark,
  boxShadow: `0 20px 55px ${colors.primary.glow}`,
});

const listItemStyle = {
  contentVisibility: "auto",
  containIntrinsicSize: "220px 420px",
} as const;

export default function LearnPhasePage() {
  const colors = useAppearanceColors();
  const ctaActionStyle = getCtaActionStyle(colors);
  const toggleActiveStyle = getToggleActiveStyle(colors);
  const toggleInactiveStyle = getToggleInactiveStyle(colors);
  const cardStyle = getCardStyle(colors);
  const listCardStyle = getListCardStyle(colors);

  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const source = useSoloSessionSource({ loadingMessage: "Loading study session..." });
  const {
    status,
    statusMessage,
    sessionItems,
    themeSummary,
    requestedThemeIds,
    soloPracticeSessionId,
    weeklyGoalId,
    returnTo,
    returnLabel,
    isSessionReady,
    durationParam,
  } = source;

  const initialDuration = useMemo(() => {
    const parsed = Number.parseInt(durationParam ?? "", 10);
    const presetDuration = SOLO_TIMER_OPTIONS.includes(parsed as (typeof SOLO_TIMER_OPTIONS)[number])
      ? parsed
      : null;
    return presetDuration ?? DEFAULT_DURATION;
  }, [durationParam]);

  const themeIdsKey = useMemo(() => requestedThemeIds.join(","), [requestedThemeIds]);
  const sessionSourceKey = soloPracticeSessionId
    ? `solo-practice:${soloPracticeSessionId}`
    : weeklyGoalId
      ? `weeklyGoal:${weeklyGoalId}:${themeIdsKey}`
      : themeIdsKey || "no-theme";

  const {
    hintStates,
    isAllRevealed,
    isConfidenceLegendDismissed,
    isSetAllOpen,
    setIsSetAllOpen,
    dismissConfidenceLegend,
    getConfidence,
    setConfidence,
    revealLetter,
    revealFullWord,
    revealAllPositions,
    resetWord,
    toggleRevealAll,
    setAllConfidence,
  } = useSoloLearnState({ sessionItems, sessionSourceKey, sessionId });

  const { timeRemaining, timerStyle } = useSoloLearnTimer(initialDuration, isSessionReady);

  const { playingWordKey, playTTS } = useTTS();

  const playingWordIndex = useMemo(() => {
    if (!playingWordKey || !playingWordKey.startsWith("solo-learn-")) {
      return null;
    }
    const parsed = Number.parseInt(playingWordKey.replace("solo-learn-", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [playingWordKey]);

  // Both word and sentence cards support hide/reveal, so the bulk Reveal All
  // control shows for any non-empty deck (matches the sentence study mock).
  const hasRevealableItems = sessionItems.length > 0;

  const hasMultipleThemes = useMemo(
    () => new Set(sessionItems.map((item) => String(item.themeId))).size > 1,
    [sessionItems]
  );

  const buildPracticeUrl = useCallback(() => {
    const confidenceByItemIndex: Record<number, number> = {};
    sessionItems.forEach((item, itemIndex) => {
      const itemKey = `${sessionSourceKey}-${itemIndex}`;
      const maxLevel = item.kind === "sentence" ? sentenceItemMaxLevel(item) : 3;
      confidenceByItemIndex[itemIndex] = getConfidence(itemKey, maxLevel);
    });

    const urlParams = buildSoloSearchParams({
      soloPracticeSessionId,
      weeklyGoalId,
      themeIds: requestedThemeIds,
      returnTo,
      returnLabel,
    });
    urlParams.set("confidence", encodeConfidenceParam(confidenceByItemIndex));

    return `/solo/${sessionId}?${urlParams.toString()}`;
  }, [
    getConfidence,
    requestedThemeIds,
    returnLabel,
    returnTo,
    sessionId,
    sessionItems,
    sessionSourceKey,
    soloPracticeSessionId,
    weeklyGoalId,
  ]);

  // Auto-advance to practice when the study timer runs out.
  useEffect(() => {
    if (timeRemaining === 0 && isSessionReady) {
      router.push(buildPracticeUrl());
    }
  }, [buildPracticeUrl, timeRemaining, isSessionReady, router]);

  const playWordTTS = useCallback(
    (wordIndex: number, spanishWord: string, storageId?: string, themeId?: string) => {
      void playTTS(`solo-learn-${wordIndex}`, spanishWord, { storageId, themeId });
    },
    [playTTS]
  );

  const handleSkip = useCallback(() => {
    router.push(buildPracticeUrl());
  }, [buildPracticeUrl, router]);

  const handleExit = useCallback(() => router.push(returnTo), [router, returnTo]);

  if (status !== "ready") {
    return (
      <SoloStatusScreen
        status={status}
        message={statusMessage}
        returnLabel={returnLabel}
        onExit={handleExit}
        testIdBase="solo-learn"
      />
    );
  }

  // --- Main learning UI ---
  return (
    <SoloPageShell>
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-xl mx-auto px-6 pt-6 pb-0">
        <div className="absolute top-4 right-4 z-20 animate-slide-up delay-100">
          <SoloExitButton onExit={handleExit} dataTestId="solo-learn-exit" />
        </div>

        <SoloHeader
          variant="shadow"
          subtitle={
            <p
              className="mt-2 text-xs sm:text-sm font-light tracking-wide"
              style={{ color: colors.text.muted }}
            >
              Study first, then jump into practice
            </p>
          }
        />

        <section
          className="relative z-30 w-full overflow-visible rounded-3xl border-2 p-5 text-center backdrop-blur-sm animate-slide-up delay-200"
          style={cardStyle}
        >
          <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Study Session
          </div>
          <div className="mt-1 text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
            {themeSummary}
          </div>
          {shouldShowSoloLearnTimer(timeRemaining) && (
            <div
              className="mt-4 text-5xl sm:text-6xl font-bold tracking-tight"
              style={timerStyle}
            >
              {getSoloLearnTimerLabel(timeRemaining)}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {hasRevealableItems && (
              <button
                type="button"
                onClick={toggleRevealAll}
                className={`${toggleButtonClassName} min-w-[10rem]`}
                style={isAllRevealed ? toggleActiveStyle : toggleInactiveStyle}
                data-testid="solo-learn-toggle-reveal-all"
              >
                {isAllRevealed ? "Hide All" : "Reveal All"}
              </button>
            )}
            <div className="relative">
              {/*
                SetAllDropdown closes on any document `pointerdown` outside it.
                Stopping propagation here prevents the trigger's own pointerdown
                from being treated as an outside click, which would close the
                dropdown a frame before the click that opened it could register.
              */}
              <button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setIsSetAllOpen((open) => !open)}
                className={toggleButtonClassName}
                style={isSetAllOpen ? toggleActiveStyle : toggleInactiveStyle}
                data-testid="solo-learn-set-all-trigger"
              >
                Set all
              </button>
              {isSetAllOpen && (
                <SetAllDropdown
                  onSelect={setAllConfidence}
                  onClose={() => setIsSetAllOpen(false)}
                />
              )}
            </div>
          </div>
        </section>

        <section
          className="relative z-10 w-full flex-1 min-h-0 rounded-3xl border-2 p-4 pt-6 mb-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-300"
          style={listCardStyle}
        >
          <div className="w-full relative space-y-3">
            {!isConfidenceLegendDismissed && (
              <div className="sticky top-2 z-10 max-w-full">
                <div
                  className="rounded-2xl border-2 px-4 py-3 backdrop-blur-sm"
                  style={{
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                  }}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div
                      className="flex h-3 w-28 shrink-0 overflow-hidden rounded-full border"
                      style={{ borderColor: colors.primary.dark }}
                    >
                      <div className="flex-1" style={{ backgroundColor: CONFIDENCE_COLORS[0] }} />
                      <div className="flex-1" style={{ backgroundColor: CONFIDENCE_COLORS[1] }} />
                      <div className="flex-1" style={{ backgroundColor: CONFIDENCE_COLORS[2] }} />
                      <div className="flex-1" style={{ backgroundColor: CONFIDENCE_COLORS[3] }} />
                    </div>
                    <div className="max-w-[520px] flex-1 text-sm leading-snug" style={{ color: colors.text.muted }}>
                      Confidence sets the starting practice level.
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss confidence legend"
                      onClick={dismissConfidenceLegend}
                      className="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition hover:brightness-110"
                      style={{ color: colors.text.muted }}
                      data-testid="solo-learn-confidence-dismiss"
                    >
                      <span className="text-lg leading-none">x</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sessionItems.map((item, originalIndex) => {
              const itemKey = `${sessionSourceKey}-${originalIndex}`;
              const maxConfidenceLevel =
                item.kind === "sentence" ? sentenceItemMaxLevel(item) : 3;
              const confidence = getConfidence(itemKey, maxConfidenceLevel);

              return (
                <div key={originalIndex} style={listItemStyle}>
                  {item.kind === "word" ? (
                    <SoloLearnWordRow
                      originalIndex={originalIndex}
                      word={item}
                      wordKey={itemKey}
                      hintState={hintStates[itemKey] || DEFAULT_HINT_STATE}
                      confidence={confidence}
                      playingWordIndex={playingWordIndex}
                      setConfidence={setConfidence}
                      revealLetter={revealLetter}
                      revealFullWord={revealFullWord}
                      resetWord={resetWord}
                      playTTS={playWordTTS}
                      dataTestIdBase={`solo-learn-word-${originalIndex}`}
                    />
                  ) : (
                    <SentenceStudyCard
                      sentence={item}
                      confidence={confidence}
                      maxConfidenceLevel={maxConfidenceLevel}
                      onConfidenceChange={(level) =>
                        setConfidence(itemKey, level, maxConfidenceLevel)
                      }
                      position={originalIndex + 1}
                      showThemeLabel={hasMultipleThemes}
                      revealedPositions={
                        (hintStates[itemKey] || DEFAULT_HINT_STATE).revealedPositions
                      }
                      onRevealToken={(tokenIndex) => revealLetter(itemKey, tokenIndex)}
                      onRevealAll={(positions) => revealAllPositions(itemKey, positions)}
                      onHide={() => resetWord(itemKey)}
                      isTTSPlaying={playingWordIndex === originalIndex}
                      isTTSDisabled={playingWordIndex !== null}
                      onPlayTTS={() =>
                        playWordTTS(
                          originalIndex,
                          item.spanishSentence,
                          undefined,
                          String(item.themeId)
                        )
                      }
                      dataTestIdBase={`solo-learn-sentence-${originalIndex}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div className="w-full pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-slide-up delay-400">
          <button
            onClick={handleSkip}
            className={actionButtonClassName}
            style={ctaActionStyle}
            data-testid="solo-learn-skip"
          >
            Skip to Practice {"->"}
          </button>
        </div>
      </div>
    </SoloPageShell>
  );
}
