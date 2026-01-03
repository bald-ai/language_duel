"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { WordEntry } from "@/lib/types";
import { StudyHeader, WordItem } from "./components";
import { useTTS } from "./hooks/useTTS";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";
import { stripIrr } from "@/lib/stringUtils";
import {
  VariableSizeList as List,
  type ListChildComponentProps,
  type VariableSizeList,
} from "react-window";

interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

const DEFAULT_HINT_STATE = Object.freeze({
  hintCount: 0,
  revealedPositions: Object.freeze([] as number[]),
}) as HintState;

const LIST_GAP = 12;
const DEFAULT_ROW_HEIGHT = 164;

interface WordRowData {
  words: WordEntry[];
  getWordKey: (word: WordEntry) => string;
  playingWordKey: string | null;
  getHintState: (wordKey: string) => HintState;
  onRevealLetter: (wordKey: string, position: number) => void;
  onRevealFullWord: (wordKey: string, answer: string) => void;
  onResetWord: (wordKey: string) => void;
  onPlayTTS: (wordKey: string, answer: string) => void;
  setRowSize: (index: number, size: number) => void;
}

const WordRow = memo(function WordRow({
  index,
  style,
  data,
}: ListChildComponentProps<WordRowData>) {
  const word = data.words[index];
  const contentRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!contentRef.current) {
      return;
    }

    const rect = contentRef.current.getBoundingClientRect();

    if (rect.height > 0) {
      data.setRowSize(index, Math.ceil(rect.height + LIST_GAP));
    }
  }, [data, index, word]);

  if (!word) {
    return null;
  }

  const wordKey = data.getWordKey(word);
  const hintState = data.getHintState(wordKey);
  const isTTSPlaying = data.playingWordKey === wordKey;
  const isTTSDisabled = data.playingWordKey !== null;

  return (
    <div style={{ ...style, paddingBottom: LIST_GAP }}>
      <div ref={contentRef}>
        <WordItem
          word={word}
          hintState={hintState}
          isTTSPlaying={isTTSPlaying}
          isTTSDisabled={isTTSDisabled}
          onRevealLetter={(position) => data.onRevealLetter(wordKey, position)}
          onRevealFullWord={() => data.onRevealFullWord(wordKey, word.answer)}
          onReset={() => data.onResetWord(wordKey)}
          onPlayTTS={() => data.onPlayTTS(wordKey, word.answer)}
        />
      </div>
    </div>
  );
});

export default function StudyPage() {
  const router = useRouter();
  const themes = useQuery(api.themes.getThemes, {});
  const themeList = useMemo(() => themes ?? [], [themes]);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isAllRevealed, setIsAllRevealed] = useState(false);
  const listRef = useRef<VariableSizeList | null>(null);
  const sizeMapRef = useRef<Map<number, number>>(new Map());
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);
  const { playingWordKey, playTTS } = useTTS();

  const resolvedThemeId = useMemo(() => {
    if (themeList.length === 0) {
      return "";
    }

    if (selectedThemeId && themeList.some((theme) => theme._id === selectedThemeId)) {
      return selectedThemeId;
    }

    return themeList[0]._id;
  }, [selectedThemeId, themeList]);

  const selectedTheme = useMemo(
    () => themeList.find((theme) => theme._id === resolvedThemeId) ?? null,
    [resolvedThemeId, themeList]
  );

  const words = useMemo(() => selectedTheme?.words ?? [], [selectedTheme]);

  useEffect(() => {
    sizeMapRef.current.clear();
    listRef.current?.resetAfterIndex(0, true);
  }, [words]);

  useEffect(() => {
    const container = listContainerRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListHeight(Math.max(0, Math.floor(entry.contentRect.height)));
        setListWidth(Math.max(0, Math.floor(entry.contentRect.width)));
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  const setRowSize = useCallback((index: number, size: number) => {
    const currentSize = sizeMapRef.current.get(index);

    if (currentSize === size) {
      return;
    }

    sizeMapRef.current.set(index, size);
    listRef.current?.resetAfterIndex(index);
  }, []);

  const getRowSize = useCallback(
    (index: number) => sizeMapRef.current.get(index) ?? DEFAULT_ROW_HEIGHT,
    []
  );

  const getHintState = useCallback(
    (wordKey: string) => hintStates[wordKey] ?? DEFAULT_HINT_STATE,
    [hintStates]
  );

  const getWordKey = useCallback(
    (word: WordEntry) => `${resolvedThemeId}-${word.word}-${word.answer}`,
    [resolvedThemeId]
  );

  const revealLetter = useCallback((wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || DEFAULT_HINT_STATE;
      if (current.revealedPositions.includes(position)) {
        return prev;
      }
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
      if (!prev[wordKey]) {
        return prev;
      }
      const next = { ...prev };
      delete next[wordKey];
      return next;
    });
    // When any word is hidden, we're no longer in "all revealed" state
    setIsAllRevealed(false);
  }, []);

  const handleThemeChange = useCallback((themeId: string) => {
    setSelectedThemeId(themeId);
  }, []);

  // Reset isAllRevealed when theme changes
  useEffect(() => {
    setIsAllRevealed(false);
  }, [resolvedThemeId]);

  const handleToggleRevealAll = useCallback(() => {
    if (isAllRevealed) {
      // Hide all: clear all hint states
      setHintStates({});
      setIsAllRevealed(false);
    } else {
      // Reveal all: iterate through all words and reveal them
      const newHintStates: Record<string, HintState> = {};
      words.forEach((word) => {
        const wordKey = `${resolvedThemeId}-${word.word}-${word.answer}`;
        const strippedAnswer = stripIrr(word.answer);
        const allPositions = strippedAnswer
          .split("")
          .map((char, idx) => (char !== " " ? idx : -1))
          .filter((idx) => idx !== -1);
        newHintStates[wordKey] = {
          hintCount: allPositions.length,
          revealedPositions: allPositions,
        };
      });
      setHintStates(newHintStates);
      setIsAllRevealed(true);
    }
  }, [isAllRevealed, words, resolvedThemeId]);

  const wordRowData = useMemo(
    () => ({
      words,
      getWordKey,
      playingWordKey,
      getHintState,
      onRevealLetter: revealLetter,
      onRevealFullWord: revealFullWord,
      onResetWord: resetWord,
      onPlayTTS: playTTS,
      setRowSize,
    }),
    [
      words,
      getWordKey,
      playingWordKey,
      getHintState,
      revealLetter,
      revealFullWord,
      resetWord,
      playTTS,
      setRowSize,
    ]
  );

  const listViewportHeight = useMemo(() => {
    if (listHeight > 0) {
      return listHeight;
    }

    const visibleCount = Math.min(words.length, 4);
    return Math.max(DEFAULT_ROW_HEIGHT, visibleCount * DEFAULT_ROW_HEIGHT);
  }, [listHeight, words.length]);

  const listViewportWidth = useMemo(() => Math.max(1, listWidth), [listWidth]);

  const itemKey = useCallback(
    (index: number, data: WordRowData) => {
      const word = data.words[index];
      return word ? data.getWordKey(word) : `row-${index}`;
    },
    []
  );

  const handleExit = useCallback(async () => {
    router.push("/");
  }, [router]);

  return (
    <ThemedPage>
      <main className="relative z-10 flex-1 min-h-0 flex flex-col">
        <div className="px-6 pt-6 pb-4">
          <div className="max-w-xl mx-auto">
            <StudyHeader
              themes={themeList}
              selectedTheme={selectedTheme}
              onThemeChange={handleThemeChange}
              isAllRevealed={isAllRevealed}
              onToggleRevealAll={handleToggleRevealAll}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 px-6 pb-4 flex flex-col">
          <div className="max-w-xl mx-auto w-full flex-1 min-h-0 flex flex-col">
            <div
              className="w-full rounded-3xl border-2 p-4 flex-1 min-h-0 overflow-hidden backdrop-blur-sm"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                boxShadow: `0 20px 60px ${colors.primary.glow}`,
              }}
            >
              <div ref={listContainerRef} className="h-full">
                {selectedTheme ? (
                  <List
                    ref={listRef}
                    height={listViewportHeight}
                    itemCount={words.length}
                    itemSize={getRowSize}
                    estimatedItemSize={DEFAULT_ROW_HEIGHT}
                    overscanCount={3}
                    width={listViewportWidth}
                    itemData={wordRowData}
                    itemKey={itemKey}
                  >
                    {WordRow}
                  </List>
                ) : (
                  <div
                    className="h-full flex items-center justify-center text-sm"
                    style={{ color: colors.text.muted }}
                  >
                    Select a theme to start studying.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-8">
          <div className="max-w-xl mx-auto">
            <button
              onClick={handleExit}
              className="w-full border-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
            >
              Back
            </button>
          </div>
        </div>
      </main>
    </ThemedPage>
  );
}
