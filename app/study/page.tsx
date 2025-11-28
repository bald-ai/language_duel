"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

// Types matching Convex schema
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface Theme {
  _id: Id<"themes">;
  name: string;
  description: string;
  words: WordEntry[];
  createdAt: number;
}

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

export default function StudyPage() {
  const router = useRouter();
  
  // Fetch themes from Convex
  const themes = useQuery(api.themes.getThemes) as Theme[] | undefined;
  
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isRevealed, setIsRevealed] = useState(false);

  // Find the selected theme
  const selectedTheme = themes?.find(t => t._id === selectedThemeId) || themes?.[0] || null;
  const currentVocabulary = selectedTheme?.words || [];

  const getHintState = (wordKey: string): HintState => {
    return hintStates[wordKey] || { hintCount: 0, revealedPositions: [] };
  };

  const pressHint = (wordKey: string, answer: string) => {
    setHintStates(prev => {
      const current = prev[wordKey] || { hintCount: 0, revealedPositions: [] };
      
      // Find all non-space letter positions
      const letterPositions = answer.split('').map((char, idx) => char !== ' ' ? idx : -1).filter(idx => idx !== -1);
      
      // If all letters revealed, do nothing
      if (current.hintCount >= letterPositions.length) {
        return prev;
      }

      // Find letter positions not yet revealed (excluding spaces)
      const availablePositions = letterPositions.filter(p => !current.revealedPositions.includes(p));
      
      // Pick a random position to reveal
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      const newPosition = availablePositions[randomIndex];

      return {
        ...prev,
        [wordKey]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, newPosition]
        }
      };
    });
  };

  const resetWord = (wordKey: string) => {
    setHintStates(prev => {
      const newState = { ...prev };
      delete newState[wordKey];
      return newState;
    });
  };

  const resetAll = () => {
    setHintStates({});
  };

  const goBack = () => {
    router.push("/");
  };

  // Loading state
  if (themes === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-100">
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-4 py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-800"></div>
          <p className="mt-4 text-gray-600">Loading themes...</p>
        </div>
      </div>
    );
  }

  // Empty state - no themes created yet
  if (themes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-100">
        <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
          <header className="w-full mb-4">
            <div className="w-full bg-gray-300 border-2 border-gray-400 rounded-lg py-3 px-4 mb-3">
              <h1 className="text-xl font-bold text-center text-gray-800 uppercase tracking-wide">
                Study Room
              </h1>
            </div>
          </header>
          <div className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl p-6 mb-4 text-center">
            <p className="text-gray-600 mb-4">No themes available yet.</p>
            <p className="text-sm text-gray-500">Go to the Themes section to generate vocabulary themes first.</p>
          </div>
          <button
            onClick={goBack}
            className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl py-4 text-xl font-bold text-gray-800 uppercase tracking-wide hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* Main container - mobile-first centered layout */}
      <div className="flex-1 flex flex-col items-center justify-start w-full max-w-md mx-auto px-4 py-6">
        
        {/* STUDY Header Section */}
        <header className="w-full mb-4">
          {/* Study Room Title Bar */}
          <div className="w-full bg-gray-300 border-2 border-gray-400 rounded-lg py-3 px-4 mb-3">
            <h1 className="text-xl font-bold text-center text-gray-800 uppercase tracking-wide">
              Study Room
            </h1>
          </div>
          
          {/* Theme Selection and Mode Toggle */}
          <div className="flex items-center gap-4">
            {/* Theme Selection Dropdown - 50% width */}
            <select
              value={selectedTheme?._id || ""}
              onChange={(e) => {
                setSelectedThemeId(e.target.value);
                setHintStates({});
              }}
              className="flex-1 px-4 py-3 rounded-2xl font-medium text-base border-2 border-gray-400 bg-gray-200 text-gray-800 cursor-pointer"
            >
              {themes.map((theme) => (
                <option key={theme._id} value={theme._id}>
                  {theme.name}
                </option>
              ))}
            </select>

            {/* Mode Toggle - 50% width */}
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className={`flex-1 px-4 py-3 rounded-2xl font-medium text-base border-2 transition-colors ${
                isRevealed
                  ? 'bg-green-500 border-green-600 text-white'
                  : 'bg-gray-200 border-gray-400 text-gray-800 hover:bg-gray-300'
              }`}
            >
              {isRevealed ? 'Revealed' : 'Testing'}
            </button>
          </div>
        </header>

        {/* Vocabulary List */}
        <div className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl p-4 pt-6 mb-4 max-h-96 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {currentVocabulary.map((word, index) => {
              const wordKey = `${selectedTheme?._id}-${index}`;
              const state = getHintState(wordKey);
              const { hintCount, revealedPositions } = state;
              const letters = word.answer.split('');
              const isHintActive = hintCount > 0;
              
              return (
                <div key={wordKey} className={`flex items-center gap-4 ${isRevealed ? 'justify-center' : 'justify-between'}`}>
                  {/* Word and Answer Section */}
                  <div className={`text-center ${isRevealed ? '' : 'flex-1'}`}>
                    <div className="text-lg font-medium text-gray-800 mb-1">
                      {word.word}
                    </div>
                    <div className="flex items-center justify-center">
                      {/* Letter slots - revealed mode, hint mode, or solid line */}
                      {isRevealed ? (
                        <span className="text-lg font-bold text-green-600">
                          {word.answer}
                        </span>
                      ) : isHintActive ? (
                        <div className="flex gap-1 flex-wrap justify-center">
                          {letters.map((letter, idx) => (
                            letter === ' ' ? (
                              <div key={idx} className="w-3" /> // Space between words
                            ) : (
                              <div 
                                key={idx}
                                className="w-5 h-6 flex items-end justify-center border-b-2 border-gray-500"
                              >
                                {revealedPositions.includes(idx) && (
                                  <span className="text-lg font-bold text-gray-800">
                                    {letter}
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="border-b-2 border-solid border-gray-700"
                          style={{ width: `${word.word.length * 0.6}rem` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Buttons Section - Hidden in revealed mode */}
                  {!isRevealed && (
                    <div className="flex gap-2">
                      {/* Hint Button with badge */}
                      <div className="relative">
                        <button
                          onClick={() => pressHint(wordKey, word.answer)}
                          className={`px-4 py-2 rounded-lg font-bold text-sm uppercase border-2 transition-colors ${
                            isHintActive 
                              ? 'bg-gray-400 border-gray-500 text-gray-600' 
                              : 'bg-gray-200 border-gray-400 text-gray-800 hover:bg-gray-300'
                          }`}
                        >
                          Hint
                        </button>
                        {/* Hint count badge */}
                        {hintCount > 0 && (
                          <div className="absolute -top-2 -right-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">
                            {hintCount}
                          </div>
                        )}
                      </div>

                      {/* Reset Button */}
                      <button
                        onClick={() => resetWord(wordKey)}
                        className="bg-gray-200 border-2 border-gray-400 rounded-lg px-4 py-2 font-bold text-sm uppercase text-gray-800 hover:bg-gray-300"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Buttons */}
        <div className="w-full flex gap-4">
          <button
            onClick={goBack}
            className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-2xl py-4 text-xl font-bold text-gray-800 uppercase tracking-wide hover:bg-gray-300"
          >
            Back
          </button>
          <button
            onClick={resetAll}
            className="flex-1 bg-gray-200 border-2 border-gray-400 rounded-2xl py-4 text-xl font-bold text-gray-800 uppercase tracking-wide hover:bg-gray-300"
          >
            Reset All
          </button>
        </div>
      </div>
    </div>
  );
}
