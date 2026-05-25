"use client";

import { memo, useCallback } from "react";
import { stripIrr } from "@/lib/stringUtils";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { WordCard } from "./WordCard";
import type { ConfidenceLevel } from "./ConfidenceSlider";

// State for each word: hintCount and revealedPositions
export interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

interface SoloLearnWordRowProps {
  originalIndex: number;
  word: { word: string; answer: string; ttsStorageId?: string; themeId?: string };
  /** Stable per-word key (`${sessionSourceKey}-${index}`) computed by the page. */
  wordKey: string;
  hintState: HintState;
  confidence: ConfidenceLevel;
  playingWordIndex: number | null;
  setConfidence: (wordKey: string, level: ConfidenceLevel) => void;
  revealLetter: (wordKey: string, position: number) => void;
  revealFullWord: (wordKey: string, answer: string) => void;
  resetWord: (wordKey: string) => void;
  playTTS: (wordIndex: number, spanishWord: string, storageId?: string, themeId?: string) => void;
  dataTestIdBase?: string;
}

/**
 * One row in the Learn word list: derives `hintsRemaining` for this word and
 * binds the shared `(wordKey, …)` mutators down to the zero-/value-arg handlers
 * {@link WordCard} expects. Memoized so unrelated word updates don't re-render it.
 */
export const SoloLearnWordRow = memo(function SoloLearnWordRow({
  originalIndex,
  word,
  wordKey,
  hintState,
  confidence,
  playingWordIndex,
  setConfidence,
  revealLetter,
  revealFullWord,
  resetWord,
  playTTS,
  dataTestIdBase,
}: SoloLearnWordRowProps) {
  const totalLetters = stripIrr(word.answer).split("").filter((l) => l !== " ").length;
  const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
  const hintsRemaining = Math.max(0, maxHints - hintState.hintCount);

  // Memoize callbacks for this specific word
  const handleConfidenceChange = useCallback(
    (val: ConfidenceLevel) => setConfidence(wordKey, val),
    [setConfidence, wordKey]
  );

  const handleRevealLetter = useCallback(
    (pos: number) => revealLetter(wordKey, pos),
    [revealLetter, wordKey]
  );

  const handleRevealFullWord = useCallback(
    () => revealFullWord(wordKey, word.answer),
    [revealFullWord, wordKey, word.answer]
  );

  const handleResetWord = useCallback(
    () => resetWord(wordKey),
    [resetWord, wordKey]
  );

  const handlePlayTTS = useCallback(
    () => playTTS(originalIndex, word.answer, word.ttsStorageId, word.themeId),
    [playTTS, originalIndex, word.answer, word.ttsStorageId, word.themeId]
  );

  return (
    <WordCard
      word={word}
      confidence={confidence}
      onConfidenceChange={handleConfidenceChange}
      revealedPositions={hintState.revealedPositions}
      hintsRemaining={hintsRemaining}
      onRevealLetter={handleRevealLetter}
      onRevealFullWord={handleRevealFullWord}
      onResetWord={handleResetWord}
      isTTSPlaying={playingWordIndex === originalIndex}
      isTTSDisabled={playingWordIndex !== null}
      onPlayTTS={handlePlayTTS}
      position={originalIndex + 1}
      dataTestIdBase={dataTestIdBase}
    />
  );
});
