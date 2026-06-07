"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { cssVarColors as cssColors } from "@/app/components/themeCssVars";
import {
  buildSoloSentenceCloze,
  isSoloSentenceTokenMatch,
  validateSoloSentenceClozeAnswer,
  type SoloSentenceBankChip,
} from "@/lib/soloSentenceRuntime";
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";
import { getListenButtonStyle } from "@/lib/sentenceGameplay/listenButton";
import { Level0Input } from "@/app/game/levels";
import { SpeakerIcon } from "@/app/components/icons";
import type { SessionSentenceItem } from "@/lib/sessionItems";
import type { SoloSessionState } from "@/lib/soloPracticeRuntime";

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

interface FilledBlank {
  blankPosition: number;
  chip: SoloSentenceBankChip;
}

interface SentenceClozeQuestionProps {
  session: SoloSessionState;
  currentSentence: SessionSentenceItem;
  hasMultipleThemes: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  isTTSPlaying: boolean;
  isTTSDisabled: boolean;
  onPlayTTS: () => void;
}

export function SentenceClozeQuestion({
  session,
  currentSentence,
  hasMultipleThemes,
  onCorrect,
  onIncorrect,
  isTTSPlaying,
  isTTSDisabled,
  onPlayTTS,
}: SentenceClozeQuestionProps) {
  const colors = useAppearanceColors();
  const cloze = useMemo(
    () => buildSoloSentenceCloze(currentSentence, session.questionLevel),
    [currentSentence, session.questionLevel]
  );
  const bankFontSizeClass = getSentenceTilePoolFontSizeClass(
    cloze.bank.map((chip) => chip.text)
  );
  const [filledBlanks, setFilledBlanks] = useState<FilledBlank[]>([]);
  const [wrongChipId, setWrongChipId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Level 0 is a recognition rung, identical in role to word Level 0: the whole
  // sentence is shown and the learner self-assesses with "Got it / Not yet".
  // "Got it" counts as correct (climbs to the first build rung); "Not yet" as
  // incorrect (stays put). One-shot locked so the auto-advance delay can't be
  // double-clicked into a double answer.
  const isRecognition = session.questionLevel === 0;
  const [recognitionLocked, setRecognitionLocked] = useState(false);
  const showRecognitionListen = isRecognition && !!currentSentence.ttsStorageId;
  const listenDisabled = isTTSDisabled || isTTSPlaying;

  const handleRecognitionGotIt = () => {
    if (recognitionLocked) return;
    setRecognitionLocked(true);
    onCorrect();
  };
  const handleRecognitionNotYet = () => {
    if (recognitionLocked) return;
    setRecognitionLocked(true);
    onIncorrect();
  };

  const usedChipIds = useMemo(
    () => new Set(filledBlanks.map((entry) => entry.chip.id)),
    [filledBlanks]
  );
  const nextBlankPosition = cloze.blankPositions[filledBlanks.length] ?? null;

  // Keyboard navigation over the bank, mirroring the word levels: arrows move a
  // highlighted selection across the still-available chips and Enter places the
  // selected chip into the next blank. Selection starts on the first chip.
  const [selectedChipIndex, setSelectedChipIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const placeChip = useCallback(
    (chip: SoloSentenceBankChip) => {
      if (isLocked || usedChipIds.has(chip.id) || nextBlankPosition === null) return;

      const expectedToken = cloze.tokens[nextBlankPosition]?.text;
      if (!expectedToken || !isSoloSentenceTokenMatch(chip.text, expectedToken)) {
        setWrongChipId(chip.id);
        setIsLocked(true);
        onIncorrect();
        return;
      }

      const nextFilledBlanks = [
        ...filledBlanks,
        { blankPosition: nextBlankPosition, chip },
      ];
      setFilledBlanks(nextFilledBlanks);

      // Move the keyboard highlight onto the next still-available chip so the
      // learner can keep building with Enter alone.
      const newUsed = new Set(usedChipIds);
      newUsed.add(chip.id);
      const nextAvailable = cloze.bank.findIndex((candidate) => !newUsed.has(candidate.id));
      setSelectedChipIndex(nextAvailable === -1 ? 0 : nextAvailable);

      if (
        validateSoloSentenceClozeAnswer({
          spanishSentence: currentSentence.spanishSentence,
          blankPositions: cloze.blankPositions,
          filledTokens: nextFilledBlanks.map((entry) => entry.chip.text),
        })
      ) {
        setIsLocked(true);
        onCorrect();
      }
    },
    [
      isLocked,
      usedChipIds,
      nextBlankPosition,
      cloze,
      filledBlanks,
      currentSentence.spanishSentence,
      onIncorrect,
      onCorrect,
    ]
  );

  // Arrow keys traverse the available chips; Enter confirms (places) the
  // selected one. Inactive during recognition (Level 0 has its own keyboard
  // handling) and once the question is locked.
  useEffect(() => {
    if (isRecognition || isLocked) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const available = cloze.bank
        .map((chip, index) => ({ chip, index }))
        .filter(({ chip }) => !usedChipIds.has(chip.id))
        .map(({ index }) => index);
      if (available.length === 0) return;

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedChipIndex((prev) => {
          const position = available.indexOf(prev);
          return available[(position + 1) % available.length];
        });
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedChipIndex((prev) => {
          const position = available.indexOf(prev);
          const base = position === -1 ? available.length : position;
          return available[(base - 1 + available.length) % available.length];
        });
      } else if (event.key === "Enter") {
        event.preventDefault();
        const chip = cloze.bank[selectedChipIndex];
        if (chip && !usedChipIds.has(chip.id)) placeChip(chip);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecognition, isLocked, cloze.bank, usedChipIds, selectedChipIndex, placeChip]);

  // Focus the cloze container on mount so keyboard navigation works immediately.
  useEffect(() => {
    if (!isRecognition) containerRef.current?.focus();
  }, [isRecognition]);

  const filledByPosition = new Map(
    filledBlanks.map((entry) => [entry.blankPosition, entry.chip])
  );

  const baseCardStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  return (
    <section
      className="w-full rounded-3xl border-2 p-6 backdrop-blur-sm animate-slide-up delay-300"
      style={baseCardStyle}
      data-testid="solo-practice-sentence"
    >
      <div className="flex justify-center mb-4">
        <span
          className="inline-block px-3 py-1 rounded-full border-2 text-xs font-bold uppercase tracking-widest"
          style={levelBadgeStyles[session.questionLevel]}
          data-testid="solo-practice-sentence-level"
        >
          Level {session.questionLevel}
        </span>
      </div>

      {hasMultipleThemes && currentSentence.themeName ? (
        <div
          className="text-xs uppercase tracking-[0.25em] mb-3 text-center"
          style={{ color: colors.text.muted }}
        >
          {currentSentence.themeName}
        </div>
      ) : null}

      {isRecognition ? (
        <>
          <Level0Input
            word={currentSentence.englishPrompt}
            answer={currentSentence.spanishSentence}
            onGotIt={handleRecognitionGotIt}
            onNotYet={handleRecognitionNotYet}
            dataTestIdBase="solo-practice-sentence-level0"
          />
          {showRecognitionListen && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={listenDisabled ? undefined : onPlayTTS}
                disabled={listenDisabled}
                className="inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2 text-sm font-bold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                style={getListenButtonStyle(colors, isTTSPlaying)}
                data-testid="solo-practice-sentence-listen"
              >
                <SpeakerIcon className="h-4 w-4" />
                <span>{isTTSPlaying ? "Playing..." : "Listen"}</span>
              </button>
            </div>
          )}
        </>
      ) : (
        <div ref={containerRef} tabIndex={0} className="outline-none">
          <div className="text-center mb-5">
            <div
              className="text-2xl sm:text-3xl font-bold leading-tight"
              style={{ color: colors.text.DEFAULT }}
              data-testid="solo-practice-sentence-cue"
            >
              {currentSentence.englishPrompt}
            </div>
          </div>

          <div
            className="rounded-2xl border-2 p-4"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              {cloze.tokens.map((token) => {
                if (!token.isBlank) {
                  return (
                    <span
                      key={`token-${token.tokenIndex}`}
                      className="min-h-11 rounded-xl border-2 px-3 py-2 text-base font-semibold"
                      style={{
                        backgroundColor: colors.background.elevated,
                        borderColor: colors.primary.dark,
                        color: colors.text.DEFAULT,
                      }}
                    >
                      {formatSentenceTileForDisplay(token.text)}
                    </span>
                  );
                }

                const filledChip = filledByPosition.get(token.tokenIndex);
                // Highlighter look (from the mock): empty blanks are plain white
                // slots; a blank turns into a solid green "marker" block once
                // filled.
                return (
                  <span
                    key={`blank-${token.tokenIndex}`}
                    className="inline-flex min-h-11 min-w-[5.25rem] items-center justify-center rounded-xl border-2 px-3 py-2 text-base font-bold transition"
                    style={
                      filledChip
                        ? {
                            backgroundColor: colors.status.success.DEFAULT,
                            borderColor: "transparent",
                            color: "#ffffff",
                            boxShadow: `inset 0 -3px 0 ${colors.status.success.dark}`,
                          }
                        : {
                            backgroundColor: "#ffffff",
                            borderColor: colors.primary.dark,
                            color: colors.text.muted,
                          }
                    }
                    data-testid={`solo-practice-sentence-blank-${token.tokenIndex}`}
                  >
                    {filledChip ? formatSentenceTileForDisplay(filledChip.text) : ""}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3" data-testid="solo-practice-sentence-bank">
            {cloze.bank.map((chip, chipIndex) => {
              const isUsed = usedChipIds.has(chip.id);
              const isWrong = wrongChipId === chip.id;
              const isSelected = !isUsed && !isWrong && selectedChipIndex === chipIndex;
              return (
                <button
                  key={chip.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => placeChip(chip)}
                  disabled={isUsed || isLocked}
                  className={`min-h-[4.5rem] rounded-2xl border-2 px-3 py-2 font-bold transition active:scale-[0.98] ${bankFontSizeClass} ${
                    isWrong ? "solo-sentence-chip-wrong" : ""
                  }`}
                  style={{
                    backgroundColor: isUsed
                      ? `${colors.status.success.DEFAULT}26`
                      : isSelected
                        ? `${colors.secondary.DEFAULT}26`
                        : colors.background.DEFAULT,
                    borderColor: isWrong
                      ? colors.status.danger.DEFAULT
                      : isUsed
                        ? colors.status.success.DEFAULT
                        : isSelected
                          ? colors.secondary.DEFAULT
                          : colors.primary.dark,
                    color: isUsed ? colors.status.success.light : colors.text.DEFAULT,
                    opacity: isUsed ? 0.65 : 1,
                    boxShadow: isSelected ? `0 0 0 3px ${colors.secondary.DEFAULT}40` : undefined,
                    cursor: isUsed || isLocked ? "not-allowed" : "pointer",
                  }}
                  data-testid={`solo-practice-sentence-chip-${chip.tokenIndex}`}
                >
                  <span className="block leading-tight">
                    {formatSentenceTileForDisplay(chip.text)}
                  </span>
                  {chip.meaning && (
                    <span
                      className="mt-1 block text-[11px] font-semibold leading-tight"
                      style={{ color: colors.text.muted }}
                      data-testid={`solo-practice-sentence-chip-${chip.tokenIndex}-meaning`}
                    >
                      {chip.meaning}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Navigation hint, matching the word levels. */}
          <div className="mt-4 text-center text-xs" style={{ color: colors.text.muted }}>
            Arrow keys to navigate, Enter to place
          </div>
        </div>
      )}
      <style jsx>{`
        .solo-sentence-chip-wrong {
          animation: soloSentenceChipWrong 420ms ease-in-out both;
        }

        @keyframes soloSentenceChipWrong {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </section>
  );
}
