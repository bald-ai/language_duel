"use client";

import { getSoloLearnTimerLabel, shouldShowSoloLearnTimer } from "@/lib/soloLearnTimer";
import { SoloLearnWordRow } from "./SoloLearnWordRow";
import { SentenceStudyCard } from "./SentenceStudyCard";
import { SetAllDropdown } from "./SetAllDropdown";
import { CONFIDENCE_COLORS } from "./ConfidenceSlider";
import { DEFAULT_HINT_STATE, type useSoloLearnState } from "../hooks/useSoloLearnState";
import type { useSoloLearnTimer } from "../hooks/useSoloLearnTimer";
import type { useSoloSessionSource } from "@/app/solo/hooks/useSoloSessionSource";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { ThemeColors } from "@/lib/appearance";
import { actionButtonClassName, getCtaActionStyle } from "@/app/components/modals/modalButtonStyles";
import { SoloPageShell } from "@/app/solo/components/SoloPageShell";
import { SoloExitButton } from "@/app/solo/components/SoloExitButton";
import { SoloHeader } from "@/app/solo/components/SoloHeader";
import { sentenceItemMaxLevel } from "@/lib/soloSentenceRuntime";

interface SoloLearnContentProps {
  source: ReturnType<typeof useSoloSessionSource>;
  study: ReturnType<typeof useSoloLearnState>;
  timer: ReturnType<typeof useSoloLearnTimer>;
  sessionSourceKey: string;
  playingWordIndex: number | null;
  hasMultipleThemes: boolean;
  playWordTTS: (index: number, text: string, storageId?: string, themeId?: string) => void;
  handleSkip: () => void;
  handleExit: () => void;
}

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

export function SoloLearnContent({ source, study, timer, sessionSourceKey, playingWordIndex, hasMultipleThemes, playWordTTS, handleSkip, handleExit }: SoloLearnContentProps) {
  const colors = useAppearanceColors();
  const ctaActionStyle = getCtaActionStyle(colors);
  const listCardStyle = getListCardStyle(colors);
  const { sessionItems, themeSummary } = source;
  const {
    hintStates, isConfidenceLegendDismissed, dismissConfidenceLegend, getConfidence,
    setConfidence, revealLetter, revealFullWord, revealAllPositions, resetWord,
  } = study;
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

        <SoloStudyControls themeSummary={themeSummary} hasRevealableItems={sessionItems.length > 0} study={study} timer={timer} />

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
                          item.ttsStorageId,
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

function SoloStudyControls({ themeSummary, hasRevealableItems, study, timer }: {
  themeSummary: string;
  hasRevealableItems: boolean;
  study: SoloLearnContentProps["study"];
  timer: SoloLearnContentProps["timer"];
}) {
  const colors = useAppearanceColors();
  const cardStyle = getCardStyle(colors);
  const toggleActiveStyle = getToggleActiveStyle(colors);
  const toggleInactiveStyle = getToggleInactiveStyle(colors);
  const { timeRemaining, timerStyle } = timer;
  const { isAllRevealed, toggleRevealAll, isSetAllOpen, setIsSetAllOpen, setAllConfidence } = study;
  return (
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
  );
}
