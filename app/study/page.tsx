"use client";

import { useState, useRef } from "react";
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
  const [playingWordKey, setPlayingWordKey] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
          <div className="flex items-center justify-center gap-4">
            {/* Theme Selection - Custom Trigger that sizes to content */}
            <div className="relative">
              {/* Visual Trigger - Sizes to text */}
              <div className="px-6 py-3 rounded-2xl font-medium text-base border-2 border-gray-400 bg-gray-200 text-gray-800 flex items-center justify-center gap-2 min-w-[120px]">
                <span className="uppercase tracking-wide">{selectedTheme?.name}</span>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth={2.5} 
                  stroke="currentColor" 
                  className="w-4 h-4 text-gray-600"
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

                      {/* Reset Button - Icon only */}
                      <button
                        onClick={() => resetWord(wordKey)}
                        className="bg-gray-200 border-2 border-gray-400 rounded-lg w-10 h-10 flex items-center justify-center text-gray-800 hover:bg-gray-300"
                        title="Reset"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>

                      {/* TTS Button */}
                      <button
                        onClick={() => playTTS(wordKey, word.answer)}
                        disabled={playingWordKey === wordKey}
                        className={`border-2 rounded-lg w-10 h-10 flex items-center justify-center transition-colors ${
                          playingWordKey === wordKey
                            ? 'bg-green-500 border-green-600 text-white'
                            : 'bg-gray-200 border-gray-400 text-gray-800 hover:bg-gray-300'
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
