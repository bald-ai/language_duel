"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { SOLO_TIMER_OPTIONS } from "./constants";
import { formatDuration, stripIrr } from "@/lib/stringUtils";
import { WordCard } from "./components/WordCard";
import { MemoizedWordCardWrapper, type HintState } from "./components/MemoizedWordCardWrapper";
import { LearnHeader } from "./components/LearnHeader";
import { useDraggableList } from "./hooks/useDraggableList";
import { DEFAULT_DURATION, LAYOUT, TIMER_THRESHOLDS } from "./constants";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { ThemedPage } from "@/app/components/ThemedPage";
import { buttonStyles, colors } from "@/lib/theme";
import { useTTS } from "@/app/game/hooks/useTTS";

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

const timerOptionClassName =
  "px-5 py-3 rounded-2xl border-2 text-xs sm:text-sm font-bold uppercase tracking-widest transition hover:brightness-110";

const timerOptionActiveStyle = {
  backgroundColor: colors.primary.DEFAULT,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
  boxShadow: `0 12px 30px ${colors.primary.glow}`,
};

const timerOptionInactiveStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.muted,
};

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

const resetToggleStyle = {
  backgroundColor: colors.background.DEFAULT,
  borderColor: colors.neutral.dark,
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

  // Fetch theme data
  const theme = useQuery(
    api.themes.getTheme,
    themeId ? { themeId: themeId as Id<"themes"> } : "skip"
  );

  // Timer state
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_DURATION);
  const [isStarted, setIsStarted] = useState(false);

  // Hint states
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isRevealed, setIsRevealed] = useState(true);

  const { playingWordKey, playTTS } = useTTS();

  // Confidence level per word
  const [confidenceLevels, setConfidenceLevels] = useState<Record<string, number>>({});
  const [isConfidenceLegendDismissed, setIsConfidenceLegendDismissed] = useState(false);

  // Memoize initial order to avoid creating new array on every render
  const initialOrder = useMemo(() => theme?.words.map((_, i) => i) ?? null, [theme?.words]);
  const gap = isRevealed ? LAYOUT.GAP_REVEALED : LAYOUT.GAP_TESTING;

  const {
    order: wordOrder,
    dragState,
    containerRef,
    itemRefs,
    dragLayerRef,
    handleMouseDown,
    getItemStyle,
  } = useDraggableList<number>(initialOrder, {
    itemCount: theme?.words.length ?? 0,
    gap,
  });

  const confidenceLegendStorageKey = `soloLearnConfidenceLegendDismissed:${sessionId}:${themeId ?? "no-theme"}`;

  useEffect(() => {
    try {
      setIsConfidenceLegendDismissed(sessionStorage.getItem(confidenceLegendStorageKey) === "1");
    } catch {
      // ignore
    }
  }, [confidenceLegendStorageKey]);

  // --- Helper functions (memoized) ---
  const getConfidence = useCallback((wordKey: string): number => confidenceLevels[wordKey] ?? 0, [confidenceLevels]);

  const setConfidence = useCallback((wordKey: string, level: number) => {
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
  }, []);

  const resetAll = useCallback(() => setHintStates({}), []);

  const playingWordIndex = useMemo(() => {
    if (!playingWordKey || !playingWordKey.startsWith("solo-learn-")) {
      return null;
    }
    const parsed = Number.parseInt(playingWordKey.replace("solo-learn-", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [playingWordKey]);

  // --- Timer logic ---
  const handleStart = useCallback(() => {
    setTimeRemaining(duration);
    setIsStarted(true);
  }, [duration]);

  useEffect(() => {
    if (!isStarted) return;
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
  }, [isStarted]);

  useEffect(() => {
    if (timeRemaining === 0 && isStarted) {
      router.push(`/solo/${sessionId}?themeId=${themeId}`);
    }
  }, [timeRemaining, isStarted, router, sessionId, themeId]);

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
    theme?.words.forEach((_, wordIndex) => {
      const wordKey = `${themeId}-${wordIndex}`;
      confidenceByWordIndex[wordIndex] = getConfidence(wordKey);
    });

    const urlParams = new URLSearchParams();
    if (themeId) urlParams.set("themeId", themeId);
    urlParams.set("confidence", JSON.stringify(confidenceByWordIndex));

    router.push(`/solo/${sessionId}?${urlParams.toString()}`);
  }, [theme?.words, themeId, getConfidence, router, sessionId]);

  const handleExit = useCallback(() => router.push("/"), [router]);

  // --- Timer display (memoized) ---
  const timerStyle = useMemo(() => {
    const percentage = timeRemaining / duration;
    if (percentage > TIMER_THRESHOLDS.GREEN) return { color: colors.status.success.DEFAULT };
    if (percentage > TIMER_THRESHOLDS.YELLOW) return { color: colors.status.warning.DEFAULT };
    return { color: colors.status.danger.DEFAULT };
  }, [timeRemaining, duration]);

  // --- Loading states ---
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
              className={`${actionButtonClassName} mt-6`}
              style={primaryActionStyle}
              data-testid="solo-learn-back-home"
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

  if (!theme) {
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

  // --- Pre-start screen ---
  if (!isStarted) {
    return (
      <ThemedPage>
        <div className="relative z-10 flex-1 flex flex-col items-center justify-start w-full max-w-xl mx-auto px-6 pt-6 pb-8">
          <LearnHeader />

          <section
            className="w-full rounded-3xl border-2 p-6 text-center backdrop-blur-sm animate-slide-up delay-200"
            style={cardStyle}
          >
            <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
              Theme
            </div>
            <h2 className="mt-1 text-2xl font-bold" style={{ color: colors.text.DEFAULT }}>
              {theme.name}
            </h2>

            <p className="mt-3 text-sm" style={{ color: colors.text.muted }}>
              Set your study time
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {SOLO_TIMER_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setDuration(option)}
                  className={timerOptionClassName}
                  style={duration === option ? timerOptionActiveStyle : timerOptionInactiveStyle}
                  data-testid={`solo-learn-timer-${option}`}
                >
                  {formatDuration(option)}
                </button>
              ))}
            </div>

            <div
              className="mt-5 inline-flex items-center gap-2 px-3 py-1 rounded-full border-2 text-xs uppercase tracking-widest"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.muted,
              }}
            >
              {theme.words.length} words to study
            </div>
          </section>

          <div className="w-full mt-6 grid gap-3 animate-slide-up delay-300">
            <button
              onClick={handleStart}
              className={actionButtonClassName}
              style={ctaActionStyle}
              data-testid="solo-learn-start"
            >
              Start Learning
            </button>
            <button
              onClick={handleExit}
              className={actionButtonClassName}
              style={primaryActionStyle}
              data-testid="solo-learn-back-home"
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
          className="w-full rounded-3xl border-2 p-5 text-center backdrop-blur-sm animate-slide-up delay-200"
          style={cardStyle}
        >
          <div className="text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
            Study Session
          </div>
          <div className="mt-1 text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
            {theme.name}
          </div>
          <div
            className="mt-4 text-5xl sm:text-6xl font-bold tracking-tight"
            style={timerStyle}
          >
            {formatDuration(timeRemaining)}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setIsRevealed(true)}
              className={toggleButtonClassName}
              style={isRevealed ? toggleActiveStyle : toggleInactiveStyle}
              data-testid="solo-learn-toggle-reveal"
            >
              Reveal
            </button>
            <button
              onClick={() => setIsRevealed(false)}
              className={toggleButtonClassName}
              style={!isRevealed ? toggleActiveStyle : toggleInactiveStyle}
              data-testid="solo-learn-toggle-test"
            >
              Test
            </button>
            {!isRevealed && (
              <button
                onClick={resetAll}
                className={toggleButtonClassName}
                style={resetToggleStyle}
                data-testid="solo-learn-reset-all"
              >
                Reset All
              </button>
            )}
          </div>
        </section>

        <section
          className="w-full flex-1 min-h-0 rounded-3xl border-2 p-4 pt-6 mb-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-300"
          style={listCardStyle}
        >
          <div
            ref={containerRef}
            className={`w-full relative ${isRevealed ? "space-y-2" : "space-y-3"}`}
          >
            {!isConfidenceLegendDismissed && (
              <div className="sticky top-2 z-10 w-fit">
                <div
                  className="rounded-2xl border-2 px-3 py-2 backdrop-blur-sm"
                  style={{
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.primary.dark,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-2 w-20 overflow-hidden rounded-full border"
                      style={{ borderColor: colors.primary.dark }}
                    >
                      {/* Level 0 uses fixed grey (#6B7280) for consistency across palettes */}
                      <div className="flex-1" style={{ backgroundColor: "#6B7280" }} />
                      <div className="flex-1" style={{ backgroundColor: colors.status.success.DEFAULT }} />
                      <div className="flex-1" style={{ backgroundColor: colors.status.warning.DEFAULT }} />
                      <div className="flex-1" style={{ backgroundColor: colors.status.danger.DEFAULT }} />
                    </div>
                    <div className="text-[11px] leading-tight" style={{ color: colors.text.muted }}>
                      Confidence sets the starting challenge level (0 quick check {'->'} 3 no hints).
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
                      className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full transition hover:brightness-110"
                      style={{ color: colors.text.muted }}
                      data-testid="solo-learn-confidence-dismiss"
                    >
                      <span className="text-base leading-none">x</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {wordOrder.map((originalIndex, orderIdx) => {
              const wordKey = `${themeId}-${originalIndex}`;
              const state = hintStates[wordKey] || DEFAULT_HINT_STATE;
              const confidence = confidenceLevels[wordKey] ?? 0;

              return (
                <div key={originalIndex} style={listItemStyle}>
                  <MemoizedWordCardWrapper
                    originalIndex={originalIndex}
                    orderIdx={orderIdx}
                    word={theme.words[originalIndex]}
                    themeId={themeId}
                    isRevealed={isRevealed}
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
              const word = theme.words[originalIndex];
              const wordKey = `${themeId}-${originalIndex}`;
              const state = hintStates[wordKey] || DEFAULT_HINT_STATE;
              const confidence = confidenceLevels[wordKey] ?? 0;
              const totalLetters = stripIrr(word.answer).split("").filter((l) => l !== " ").length;
              const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
              const hintsRemaining = maxHints - state.hintCount;

              return (
                <WordCard
                  word={word}
                  isRevealed={isRevealed}
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
            Skip to Challenge {'->'}
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
