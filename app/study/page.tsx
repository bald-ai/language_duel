"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { useHintManager, useTTS } from "./hooks";
import { StudyHeader, WordItem } from "./components";

interface Theme {
  _id: Id<"themes">;
  name: string;
  description: string;
  words: WordEntry[];
  createdAt: number;
}

export default function StudyPage() {
  const router = useRouter();

  // Fetch themes from Convex
  const themes = useQuery(api.themes.getThemes) as Theme[] | undefined;

  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  // Custom hooks
  const {
    getHintState,
    revealLetter,
    revealFullWord,
    resetWord,
    resetAll,
  } = useHintManager();

  const { playingWordKey, playTTS } = useTTS();

  // Find the selected theme
  const selectedTheme =
    themes?.find((t) => t._id === selectedThemeId) || themes?.[0] || null;
  const currentVocabulary = selectedTheme?.words || [];

  const handleThemeChange = (themeId: string) => {
    setSelectedThemeId(themeId);
    resetAll();
  };

  const goBack = () => {
    router.push("/");
  };

  // Loading state
  if (themes === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <p className="mt-4 text-gray-300">Loading themes...</p>
        </div>
      </div>
    );
  }

  // Empty state - no themes created yet
  if (themes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
          <header className="w-full mb-4">
            <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-3">
              <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
                Study Room
              </h1>
            </div>
          </header>
          <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-6 mb-4 text-center">
            <p className="text-gray-300 mb-4">No themes available yet.</p>
            <p className="text-sm text-gray-500">
              Go to the Themes section to generate vocabulary themes first.
            </p>
          </div>
          <button
            onClick={goBack}
            className="w-full bg-gray-700 border-2 border-gray-600 rounded-2xl py-4 text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-600 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* Main container - mobile-first centered layout */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 pt-6 pb-0">
        <StudyHeader
          themes={themes}
          selectedTheme={selectedTheme}
          isRevealed={isRevealed}
          onThemeChange={handleThemeChange}
          onToggleReveal={() => setIsRevealed(!isRevealed)}
        />

        {/* Vocabulary List */}
        <div className="w-full flex-1 min-h-0 bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 pt-6 mb-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {currentVocabulary.map((word) => {
              // Use content-based stable ID to prevent hint misalignment on reorder
              const stableId = `${word.word}-${word.answer}`;
              const wordKey = `${selectedTheme?._id}-${stableId}`;
              return (
                <WordItem
                  key={wordKey}
                  word={word}
                  isRevealed={isRevealed}
                  hintState={getHintState(wordKey)}
                  isPlaying={playingWordKey === wordKey}
                  onRevealLetter={(position) => revealLetter(wordKey, position)}
                  onRevealFullWord={() => revealFullWord(wordKey, word.answer)}
                  onReset={() => resetWord(wordKey)}
                  onPlayTTS={() => playTTS(wordKey, word.answer)}
                />
              );
            })}
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="w-full flex gap-4 flex-shrink-0 mt-auto pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <button
            onClick={goBack}
            className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
          >
            Back
          </button>
          <button
            onClick={resetAll}
            className="flex-1 bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
