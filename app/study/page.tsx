"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";

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
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Find the selected theme
  const selectedTheme = themes?.find(t => t._id === selectedThemeId) || themes?.[0] || null;
  const currentVocabulary = selectedTheme?.words || [];

  const getHintState = (wordKey: string): HintState => {
    return hintStates[wordKey] || { hintCount: 0, revealedPositions: [] };
  };

  const revealLetter = (wordKey: string, position: number) => {
    setHintStates(prev => {
      const current = prev[wordKey] || { hintCount: 0, revealedPositions: [] };
      
      // If already revealed, do nothing
      if (current.revealedPositions.includes(position)) {
        return prev;
      }

      return {
        ...prev,
        [wordKey]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, position]
        }
      };
    });
  };

  const revealFullWord = (wordKey: string, answer: string) => {
    const allPositions = answer.split('').map((char, idx) => char !== ' ' ? idx : -1).filter(idx => idx !== -1);
    setHintStates(prev => ({
      ...prev,
      [wordKey]: {
        hintCount: allPositions.length,
        revealedPositions: allPositions
      }
    }));
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

  const playTTS = async (wordKey: string, spanishWord: string) => {
    if (playingWordKey === wordKey) return;
    
    setPlayingWordKey(wordKey);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spanishWord }),
      });
      
      if (!response.ok) {
        throw new Error('TTS request failed');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingWordKey(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setPlayingWordKey(null);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setPlayingWordKey(null);
    }
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
            <p className="text-sm text-gray-500">Go to the Themes section to generate vocabulary themes first.</p>
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
        
        {/* STUDY Header Section */}
        <header className="w-full mb-4 flex-shrink-0">
          {/* Study Room Title Bar */}
          <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-3">
            <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
              Study Room
            </h1>
          </div>
          
          {/* Theme Selection and Mode Toggle */}
          <div className="flex items-center justify-center gap-4">
            {/* Theme Selection - Custom Trigger that sizes to content */}
            <div className="relative">
              {/* Visual Trigger - Sizes to text */}
              <div className="px-6 py-3 rounded-2xl font-medium text-base border-2 border-gray-700 bg-gray-800 text-gray-200 flex items-center justify-center gap-2 min-w-[120px]">
                <span className="uppercase tracking-wide">{selectedTheme?.name}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2.5} 
                  stroke="currentColor" 
                  className="w-4 h-4 text-gray-400"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>

              {/* Hidden Select - Captures clicks */}
              <select
                value={selectedTheme?._id || ""}
                onChange={(e) => {
                  setSelectedThemeId(e.target.value);
                  setHintStates({});
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
              >
                {themes.map((theme) => (
                  <option key={theme._id} value={theme._id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Toggle Button */}
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className={`px-6 py-3 rounded-2xl font-medium text-base border-2 transition-colors uppercase tracking-wide min-w-[120px] ${
                isRevealed
                  ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                  : 'bg-green-500 border-green-600 text-white hover:bg-green-600'
              }`}
            >
              {isRevealed ? 'Testing' : 'Reveal'}
            </button>
          </div>
        </header>

        {/* Vocabulary List */}
        <div className="w-full flex-1 min-h-0 bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 pt-6 mb-4 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {currentVocabulary.map((word, index) => {
              const wordKey = `${selectedTheme?._id}-${index}`;
              const state = getHintState(wordKey);
              const { hintCount, revealedPositions } = state;
              const letters = word.answer.split('');
              const totalLetters = letters.filter(l => l !== ' ').length;
              const maxHints = Math.ceil(totalLetters / 3);
              const hintsRemaining = maxHints - hintCount;
              
              return (
                <div key={wordKey} className={`flex items-center gap-4 ${isRevealed ? 'justify-center' : 'justify-between'}`}>
                  {/* Word and Answer Section */}
                  <div className={`text-center ${isRevealed ? '' : 'flex-1'}`}>
                    <div className="text-lg font-medium text-white mb-1">
                      {word.word}
                    </div>
                    <div className="flex items-center justify-center">
                      {/* Letter slots - revealed mode or clickable hints */}
                      {isRevealed ? (
                        <span className="text-lg font-bold text-green-400">
                          {word.answer.toUpperCase()}
                        </span>
                      ) : (
                        <div className="flex gap-1 flex-wrap justify-center">
                          {letters.map((letter, idx) => (
                            letter === ' ' ? (
                              <div key={idx} className="w-3" /> // Space between words
                            ) : (
                              <div 
                                key={idx}
                                onClick={() => !revealedPositions.includes(idx) && hintsRemaining > 0 && revealLetter(wordKey, idx)}
                                className={`w-5 h-6 flex items-end justify-center border-b-2 border-gray-500 ${
                                  !revealedPositions.includes(idx) && hintsRemaining > 0 ? 'cursor-pointer hover:border-green-500' : ''
                                }`}
                                title={!revealedPositions.includes(idx) && hintsRemaining > 0 ? 'Click to reveal this letter' : undefined}
                              >
                                {revealedPositions.includes(idx) && (
                                  <span className="text-lg font-bold text-white">
                                    {letter.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Buttons Section - Hidden in revealed mode */}
                  {!isRevealed && (
                    <div className="flex gap-2 items-center">
                      {/* Hints Remaining Indicator */}
                      <div 
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                          hintsRemaining > 0 
                            ? 'border-gray-600 bg-gray-800 text-gray-200' 
                            : 'border-gray-700 bg-gray-800/50 text-gray-500'
                        }`}
                        title={hintsRemaining > 0 ? "Hints remaining - click empty letter slots to reveal" : "No hints remaining"}
                      >
                        {hintsRemaining > 0 ? hintsRemaining : '–'}
                      </div>

                      {/* Reset Button - Icon only */}
                      <button
                        onClick={() => resetWord(wordKey)}
                        className="bg-gray-700 border-2 border-gray-600 rounded-lg w-10 h-10 flex items-center justify-center text-white hover:bg-gray-600 transition-colors"
                        title="Reset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>

                      {/* Reveal Full Word Button */}
                      <button
                        onClick={() => revealFullWord(wordKey, word.answer)}
                        className="bg-gray-700 border-2 border-gray-600 rounded-lg w-10 h-10 flex items-center justify-center text-white hover:bg-gray-600 transition-colors"
                        title="Reveal full word"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>

                      {/* TTS Button */}
                      <button
                        onClick={() => playTTS(wordKey, word.answer)}
                        disabled={playingWordKey === wordKey}
                        className={`border-2 rounded-lg w-10 h-10 flex items-center justify-center transition-colors ${
                          playingWordKey === wordKey
                            ? 'bg-green-500 border-green-600 text-white'
                            : 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600'
                        }`}
                        title="Listen"
                      >
                        {playingWordKey === wordKey ? (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
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
