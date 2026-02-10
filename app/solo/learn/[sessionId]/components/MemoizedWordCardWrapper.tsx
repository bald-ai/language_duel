"use client";

import { memo, useCallback } from "react";
import type { CSSProperties, MouseEvent, RefObject } from "react";
import { stripIrr } from "@/lib/stringUtils";
import { LETTERS_PER_HINT } from "@/app/game/constants";
import { WordCard } from "./WordCard";

// State for each word: hintCount and revealedPositions
export interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

interface MemoizedWordCardWrapperProps {
  originalIndex: number;
  orderIdx: number;
  word: { word: string; answer: string; ttsStorageId?: string };
  themeId: string | null;
  isRevealed: boolean;
  hintState: HintState;
  confidence: number;
  playingWordIndex: number | null;
  draggedIndex: number | null;
  setConfidence: (wordKey: string, level: number) => void;
  revealLetter: (wordKey: string, position: number) => void;
  revealFullWord: (wordKey: string, answer: string) => void;
  resetWord: (wordKey: string) => void;
  playTTS: (wordIndex: number, spanishWord: string, storageId?: string) => void;
  handleMouseDown: (e: MouseEvent, orderIdx: number) => void;
  getItemStyle: (orderIdx: number, originalIndex: number) => CSSProperties;
  itemRefs: RefObject<Map<number, HTMLDivElement | null>>;
  dataTestIdBase?: string;
}

export const MemoizedWordCardWrapper = memo(function MemoizedWordCardWrapper({
  originalIndex,
  orderIdx,
  word,
  themeId,
  isRevealed,
  hintState,
  confidence,
  playingWordIndex,
  draggedIndex,
  setConfidence,
  revealLetter,
  revealFullWord,
  resetWord,
  playTTS,
  handleMouseDown,
  getItemStyle,
  itemRefs,
  dataTestIdBase,
}: MemoizedWordCardWrapperProps) {
  const wordKey = `${themeId}-${originalIndex}`;
  const state = hintState;
  const totalLetters = stripIrr(word.answer).split("").filter((l) => l !== " ").length;
  const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
  const hintsRemaining = maxHints - state.hintCount;

  // Memoize callbacks for this specific word
  const handleConfidenceChange = useCallback(
    (val: number) => setConfidence(wordKey, val),
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
    () => playTTS(originalIndex, word.answer, word.ttsStorageId),
    [playTTS, originalIndex, word.answer, word.ttsStorageId]
  );

  const handleMouseDownWrapper = useCallback(
    (e: MouseEvent) => handleMouseDown(e, orderIdx),
    [handleMouseDown, orderIdx]
  );

  // Inline ref callback - refs are stable by design, no need for useCallback
  const refCallback = (el: HTMLDivElement | null) => {
    itemRefs.current?.set(originalIndex, el);
  };

  const style = getItemStyle(orderIdx, originalIndex);

  return (
    <WordCard
      word={word}
      isRevealed={isRevealed}
      confidence={confidence}
      onConfidenceChange={handleConfidenceChange}
      revealedPositions={state.revealedPositions}
      hintsRemaining={hintsRemaining}
      onRevealLetter={handleRevealLetter}
      onRevealFullWord={handleRevealFullWord}
      onResetWord={handleResetWord}
      isTTSPlaying={playingWordIndex === originalIndex}
      isTTSDisabled={playingWordIndex !== null}
      onPlayTTS={handlePlayTTS}
      isDragging={draggedIndex === orderIdx}
      onMouseDown={handleMouseDownWrapper}
      style={style}
      refCallback={refCallback}
      dataTestIdBase={dataTestIdBase}
    />
  );
});
