"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { SOLO_TIMER_OPTIONS } from "./constants";
import {
  getSoloLearnTimerLabel,
  isSoloStudyTimerInfinite,
  shouldShowSoloLearnTimer,
} from "@/app/solo/learn/soloLearnTimer";
import { stripIrr } from "@/lib/stringUtils";
import { WordCard } from "./components/WordCard";
import { MemoizedWordCardWrapper, type HintState } from "./components/MemoizedWordCardWrapper";
import { LearnHeader } from "./components/LearnHeader";
import { SetAllDropdown } from "./components/SetAllDropdown";
import { CONFIDENCE_COLORS, type ConfidenceLevel } from "./components/ConfidenceSlider";
import { useDraggableList } from "./hooks/useDraggableList";
import { DEFAULT_DURATION, LAYOUT, TIMER_THRESHOLDS } from "./constants";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { ThemedPage } from "@/app/components/ThemedPage";
import { buttonStyles, colors } from "@/lib/theme";
import { useTTS } from "@/app/game/hooks/useTTS";
import { buildSessionWords, summarizeThemes } from "@/lib/sessionWords";
import { buildSoloSearchParams, sanitizeSoloReturnTo } from "@/lib/soloNavigation";

const DEFAULT_HINT_STATE = Object.freeze({
  hintCount: 0,
  revealedPositions: Object.freeze([] as number[]),
}) as HintState;

const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg";

const buildActionStyle = (variant: "primary" | "cta") => {
  const styles = buttonStyles[variant];
  return {
    backgroundImage: `linear-gradient(to bottom, ${styles.gradient.from}, ${styles.gradient.to})`,
    borderTopColor: styles.border.top,
    borderBottomColor: styles.border.bottom,
    borderLeftColor: styles.border.sides,
    borderRightColor: styles.border.sides,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
  };
};

const primaryActionStyle = buildActionStyle("primary");
const ctaActionStyle = buildActionStyle("cta");

const toggleButtonClassName =
  "px-4 py-2 rounded-xl border-2 text-xs sm:text-sm font-bold uppercase tracking-widest transition hover:brightness-110";

const toggleActiveStyle = {
  backgroundColor: colors.primary.DEFAULT,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

const toggleInactiveStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.muted,
};

const cardStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  boxShadow: `0 18px 50px ${colors.primary.glow}`,
};

const listCardStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  boxShadow: `0 20px 55px ${colors.primary.glow}`,
};

const listItemStyle = {
  contentVisibility: "auto",
  containIntrinsicSize: "220px 420px",
} as const;


export default function LearnPhasePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const themeId = searchParams.get("themeId");
  const themeIdsParam = searchParams.get("themeIds");
  const soloPracticeSessionId = searchParams.get("soloPracticeSessionId");
  const weeklyGoalId = searchParams.get("weeklyGoalId");
  const returnTo = sanitizeSoloReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || "Back to Home";
  const durationParam = searchParams.get("duration");
  const parsedDuration = Number.parseInt(durationParam ?? "", 10);
  const presetDuration = SOLO_TIMER_OPTIONS.includes(parsedDuration as (typeof SOLO_TIMER_OPTIONS)[number])
    ? parsedDuration
    : null;
  const initialDuration = presetDuration ?? DEFAULT_DURATION;
  const requestedThemeIds = useMemo(() => {
    if (themeIdsParam) {
      return themeIdsParam.split(",").filter(Boolean) as Id<"themes">[];
    }
    return themeId ? [themeId as Id<"themes">] : [];
  }, [themeId, themeIdsParam]);
  const themeIdsKey = useMemo(() => requestedThemeIds.join(","), [requestedThemeIds]);
  const sessionSourceKey = soloPracticeSessionId
    ? `solo-practice:${soloPracticeSessionId}`
    : weeklyGoalId
      ? `weeklyGoal:${weeklyGoalId}:${themeIdsKey}`
      : themeIdsKey || "no-theme";

  const practiceSession = useQuery(
    api.weeklyGoals.getBossPracticeSession,
    soloPracticeSessionId ? { soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions"> } : "skip"
  );
  const weeklyGoalPractice = useQuery(
    api.weeklyGoals.getWeeklyGoalPracticeThemes,
    !soloPracticeSessionId && weeklyGoalId
      ? {
          weeklyGoalId: weeklyGoalId as Id<"weeklyGoals">,
          themeIds: requestedThemeIds.length > 0 ? requestedThemeIds : undefined,
        }
      : "skip"
  );
  const allThemes = useQuery(api.themes.getThemes, soloPracticeSessionId || weeklyGoalId ? "skip" : {});
  const selectedThemes = useMemo(() => {
    if (weeklyGoalPractice?.ok) return weeklyGoalPractice.themes;
    if (!allThemes) return [];
    const themeMap = new Map(allThemes.map((theme) => [theme._id, theme]));
    return requestedThemeIds
      .flatMap((requestedThemeId) => {
        const theme = themeMap.get(requestedThemeId);
        return theme ? [theme] : [];
      });
  }, [allThemes, requestedThemeIds, weeklyGoalPractice]);
  const sessionWords = useMemo(
    () => practiceSession?.sessionWords ?? buildSessionWords(selectedThemes),
    [practiceSession?.sessionWords, selectedThemes]
  );
  const themeSummary = useMemo(
    () => practiceSession?.themeSummary ?? summarizeThemes(selectedThemes),
    [practiceSession?.themeSummary, selectedThemes]
  );
  const isSessionReady = soloPracticeSessionId
    ? practiceSession !== undefined && practiceSession !== null
    : weeklyGoalId
      ? Boolean(weeklyGoalPractice?.ok && selectedThemes.length > 0)
      : allThemes !== undefined && requestedThemeIds.length > 0 && selectedThemes.length === requestedThemeIds.length;

  // Timer state
  const duration = initialDuration;
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);

  // Hint states
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isAllRevealed, setIsAllRevealed] = useState(false);

  const { playingWordKey, playTTS } = useTTS();

  // Confidence level per word
  const [confidenceLevels, setConfidenceLevels] = useState<Record<string, ConfidenceLevel>>({});
  const [isConfidenceLegendDismissed, setIsConfidenceLegendDismissed] = useState(false);
  const [isSetAllOpen, setIsSetAllOpen] = useState(false);

  // Memoize initial order to avoid creating new array on every render
  const initialOrder = useMemo(() => sessionWords.map((_, i) => i), [sessionWords]);
  const gap = LAYOUT.GAP_TESTING;

  const {
    order: wordOrder,
    dragState,
    containerRef,
    itemRefs,
    dragLayerRef,
    handleMouseDown,
    getItemStyle,
  } = useDraggableList<number>(initialOrder, {
    itemCount: sessionWords.length,
    gap,
  });

  const confidenceLegendStorageKey = `soloLearnConfidenceLegendDismissed:${sessionId}:${sessionSourceKey}`;

  useEffect(() => {
    try {
      setIsConfidenceLegendDismissed(sessionStorage.getItem(confidenceLegendStorageKey) === "1");
    } catch {
      // ignore
    }
  }, [confidenceLegendStorageKey]);

  // --- Helper functions (memoized) ---
  const getConfidence = useCallback((wordKey: string): ConfidenceLevel => confidenceLevels[wordKey] ?? 0, [confidenceLevels]);

  const setConfidence = useCallback((wordKey: string, level: ConfidenceLevel) => {
    setConfidenceLevels((prev) => ({ ...prev, [wordKey]: level }));
  }, []);

  const revealLetter = useCallback((wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || DEFAULT_HINT_STATE;
      if (current.revealedPositions.includes(position)) return prev;
      return {
        ...prev,
        [wordKey]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, position],
        },
      };
    });
  }, []);

  const revealFullWord = useCallback((wordKey: string, answer: string) => {
    const strippedAnswer = stripIrr(answer);
    const allPositions = strippedAnswer
      .split("")
      .map((char, idx) => (char !== " " ? idx : -1))
      .filter((idx) => idx !== -1);
    setHintStates((prev) => ({
      ...prev,
      [wordKey]: {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      },
    }));
  }, []);

  const resetWord = useCallback((wordKey: string) => {
    setHintStates((prev) => {
      const newState = { ...prev };
      delete newState[wordKey];
      return newState;
    });
    setIsAllRevealed(false);
  }, []);

  const toggleRevealAll = useCallback(() => {
    if (isAllRevealed) {
      setHintStates({});
      setIsAllRevealed(false);
      return;
    }

    const nextHintStates: Record<string, HintState> = {};
    sessionWords.forEach((word, index) => {
      const allPositions = stripIrr(word.answer)
        .split("")
        .map((char, idx) => (char !== " " ? idx : -1))
        .filter((idx) => idx !== -1);

      nextHintStates[`${sessionSourceKey}-${index}`] = {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      };
    });

    setHintStates(nextHintStates);
    setIsAllRevealed(true);
  }, [isAllRevealed, sessionSourceKey, sessionWords]);

  const setAllConfidence = useCallback((level: ConfidenceLevel) => {
    if (sessionWords.length === 0) {
      setIsSetAllOpen(false);
      return;
    }

    setConfidenceLevels((prev) => {
      const next = { ...prev };
      sessionWords.forEach((_, index) => {
        next[`${sessionSourceKey}-${index}`] = level;
      });
      return next;
    });
    setIsSetAllOpen(false);
  }, [sessionSourceKey, sessionWords]);

  const playingWordIndex = useMemo(() => {
    if (!playingWordKey || !playingWordKey.startsWith("solo-learn-")) {
      return null;
    }
    const parsed = Number.parseInt(playingWordKey.replace("solo-learn-", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [playingWordKey]);

  // --- Timer logic ---
  useEffect(() => {
    if (!isSessionReady) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSessionReady]);

  useEffect(() => {
    if (timeRemaining === 0 && isSessionReady) {
      const params = buildSoloSearchParams({
        soloPracticeSessionId,
        weeklyGoalId,
        themeIds: requestedThemeIds,
        returnTo,
        returnLabel,
      });
      router.push(`/solo/${sessionId}?${params.toString()}`);
    }
  }, [timeRemaining, isSessionReady, router, sessionId, requestedThemeIds, soloPracticeSessionId, weeklyGoalId, returnTo, returnLabel]);

  // --- TTS ---
  const playWordTTS = useCallback(
    (wordIndex: number, spanishWord: string, storageId?: string) => {
      void playTTS(`solo-learn-${wordIndex}`, spanishWord, { storageId });
    },
    [playTTS]
  );

  // --- Navigation ---
  const handleSkip = useCallback(() => {
    const confidenceByWordIndex: Record<number, number> = {};
    sessionWords.forEach((_, wordIndex) => {
      const wordKey = `${sessionSourceKey}-${wordIndex}`;
      confidenceByWordIndex[wordIndex] = getConfidence(wordKey);
    });

    const urlParams = buildSoloSearchParams({
      soloPracticeSessionId,
      weeklyGoalId,
      themeIds: requestedThemeIds,
      returnTo,
      returnLabel,
    });
    urlParams.set("confidence", JSON.stringify(confidenceByWordIndex));

    router.push(`/solo/${sessionId}?${urlParams.toString()}`);
  }, [sessionWords, sessionSourceKey, requestedThemeIds, getConfidence, router, sessionId, soloPracticeSessionId, weeklyGoalId, returnTo, returnLabel]);

  const handleExit = useCallback(() => router.push(returnTo), [router, returnTo]);

  // --- Timer display (memoized) ---
  const timerStyle = useMemo(() => {
    if (isSoloStudyTimerInfinite(duration)) {
      return { color: colors.status.success.DEFAULT };
    }
    const percentage = timeRemaining / duration;
    if (percentage > TIMER_THRESHOLDS.GREEN) return { color: colors.status.success.DEFAULT };
    if (percentage > TIMER_THRESHOLDS.YELLOW) return { color: colors.status.warning.DEFAULT };
    return { color: colors.status.danger.DEFAULT };
  }, [timeRemaining, duration]);

  // --- Loading states ---
  if (!soloPracticeSessionId && !weeklyGoalId && requestedThemeIds.length === 0) {
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
              className={`${actionButtonClassName} mt-6`}
              style={primaryActionStyle}
              data-testid="solo-learn-back-home"
            >
              {returnLabel}
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

  if (
    (soloPracticeSessionId && practiceSession === undefined) ||
    (!soloPracticeSessionId && weeklyGoalId && weeklyGoalPractice === undefined) ||
    (!soloPracticeSessionId && !weeklyGoalId && allThemes === undefined)
  ) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6">
          <div
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up"
            style={cardStyle}
          >
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="mt-4 text-sm" style={{ color: colors.text.muted }}>
              Loading study session...
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

  if ((soloPracticeSessionId && practiceSession === null) || (!soloPracticeSessionId && weeklyGoalId && weeklyGoalPractice === null)) {
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
              This practice session is no longer available
            </p>
            <button
              onClick={handleExit}
              className={`${actionButtonClassName} mt-6`}
              style={primaryActionStyle}
            >
              {returnLabel}
            </button>
          </div>
        </div>
      </ThemedPage>
    );
  }

  if (!soloPracticeSessionId && weeklyGoalPractice && !weeklyGoalPractice.ok) {
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
              {weeklyGoalPractice.message}
            </p>
            <button
              onClick={handleExit}
              className={`${actionButtonClassName} mt-6`}
              style={primaryActionStyle}
              data-testid="solo-learn-back-home"
            >
              {returnLabel}
            </button>
          </div>
        </div>
      </ThemedPage>
    );
  }

  if (!soloPracticeSessionId && !weeklyGoalId && selectedThemes.length !== requestedThemeIds.length) {
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
              className={`${actionButtonClassName} mt-6`}
              style={primaryActionStyle}
              data-testid="solo-learn-back-home"
            >
              {returnLabel}
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

  // --- Main learning UI ---
  return (
    <ThemedPage>
      <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center w-full max-w-xl mx-auto px-6 pt-6 pb-0">
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
            data-testid="solo-learn-exit"
          >
            Exit
          </button>
        </div>

        <LearnHeader />

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
            <button
              type="button"
              onClick={toggleRevealAll}
              className={`${toggleButtonClassName} min-w-[10rem]`}
              style={isAllRevealed ? toggleActiveStyle : toggleInactiveStyle}
              data-testid="solo-learn-toggle-reveal-all"
            >
              {isAllRevealed ? "Hide All" : "Reveal All"}
            </button>
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
          <div
            ref={containerRef}
            className="w-full relative space-y-3"
          >
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
                      Confidence sets the starting practice level (0 quick check {'->'} 3 no hints).
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss confidence legend"
                      onClick={() => {
                        setIsConfidenceLegendDismissed(true);
                        try {
                          sessionStorage.setItem(confidenceLegendStorageKey, "1");
                        } catch {
                          // ignore
                        }
                      }}
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

            {wordOrder.map((originalIndex, orderIdx) => {
              const wordKey = `${sessionSourceKey}-${originalIndex}`;
              const state = hintStates[wordKey] || DEFAULT_HINT_STATE;
              const confidence = confidenceLevels[wordKey] ?? 0;

              return (
                <div key={originalIndex} style={listItemStyle}>
                  <MemoizedWordCardWrapper
                    originalIndex={originalIndex}
                    orderIdx={orderIdx}
                    word={sessionWords[originalIndex]}
                    themeId={sessionSourceKey}
                    hintState={state}
                    confidence={confidence}
                    playingWordIndex={playingWordIndex}
                    draggedIndex={dragState.draggedIndex}
                    setConfidence={setConfidence}
                    revealLetter={revealLetter}
                    revealFullWord={revealFullWord}
                    resetWord={resetWord}
                    playTTS={playWordTTS}
                    handleMouseDown={handleMouseDown}
                    getItemStyle={getItemStyle}
                    itemRefs={itemRefs}
                    dataTestIdBase={`solo-learn-word-${originalIndex}`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {dragState.draggedIndex !== null && wordOrder.length > 0 && (
          <div
            ref={dragLayerRef}
            className="fixed pointer-events-none z-50 will-change-transform"
            style={{
              // Initial position set here, subsequent moves use transform via ref
              left: 0,
              top: 0,
              transform: `translate3d(${dragState.mousePos.x - dragState.dragOffset.x}px, ${dragState.mousePos.y - dragState.dragOffset.y}px, 0)`,
            }}
          >
            {(() => {
              const originalIndex = wordOrder[dragState.draggedIndex];
              const word = sessionWords[originalIndex];
              const wordKey = `${sessionSourceKey}-${originalIndex}`;
              const state = hintStates[wordKey] || DEFAULT_HINT_STATE;
              const confidence = confidenceLevels[wordKey] ?? 0;
              const totalLetters = stripIrr(word.answer).split("").filter((l) => l !== " ").length;
              const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
              const hintsRemaining = Math.max(0, maxHints - state.hintCount);

              return (
                <WordCard
                  word={word}
                  confidence={confidence}
                  onConfidenceChange={() => {}}
                  revealedPositions={state.revealedPositions}
                  hintsRemaining={hintsRemaining}
                  onRevealLetter={() => {}}
                  onRevealFullWord={() => {}}
                  onResetWord={() => {}}
                  isTTSPlaying={playingWordIndex === originalIndex}
                  isTTSDisabled={playingWordIndex !== null}
                  onPlayTTS={() => {}}
                  isFloating
                />
              );
            })()}
          </div>
        )}

        <div className="w-full pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-slide-up delay-400">
          <button
            onClick={handleSkip}
            className={actionButtonClassName}
            style={ctaActionStyle}
            data-testid="solo-learn-skip"
          >
            Skip to Practice {'->'}
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
