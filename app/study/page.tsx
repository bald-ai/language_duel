"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Vocabulary themes - nouns only (podstatné mená)
const themes: Record<string, { id: number; spanish: string; english: string }[]> = {
  bathroom: [
    { id: 1, spanish: "Bañera", english: "Bathtub" },
    { id: 2, spanish: "Ducha", english: "Shower" },
    { id: 3, spanish: "Lavabo", english: "Sink" },
    { id: 4, spanish: "Inodoro", english: "Toilet" },
    { id: 5, spanish: "Espejo", english: "Mirror" },
    { id: 6, spanish: "Toalla", english: "Towel" },
    { id: 7, spanish: "Jabón", english: "Soap" },
    { id: 8, spanish: "Champú", english: "Shampoo" },
    { id: 9, spanish: "Cepillo", english: "Brush" },
    { id: 10, spanish: "Alfombra", english: "Mat" },
  ],
  kitchen: [
    { id: 11, spanish: "Nevera", english: "Fridge" },
    { id: 12, spanish: "Horno", english: "Oven" },
    { id: 13, spanish: "Sartén", english: "Pan" },
    { id: 14, spanish: "Olla", english: "Pot" },
    { id: 15, spanish: "Plato", english: "Plate" },
    { id: 16, spanish: "Taza", english: "Cup" },
    { id: 17, spanish: "Cuchillo", english: "Knife" },
    { id: 18, spanish: "Tenedor", english: "Fork" },
    { id: 19, spanish: "Cuchara", english: "Spoon" },
    { id: 20, spanish: "Mesa", english: "Table" },
  ],
};

const themeNames: Record<string, string> = {
  bathroom: "Bathroom",
  kitchen: "Kitchen",
};

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

export default function StudyPage() {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState<string>("bathroom");
  const [hintStates, setHintStates] = useState<Record<number, HintState>>({});

  const currentVocabulary = themes[selectedTheme] || [];

  const getHintState = (wordId: number): HintState => {
    return hintStates[wordId] || { hintCount: 0, revealedPositions: [] };
  };

  const pressHint = (wordId: number, wordLength: number) => {
    setHintStates(prev => {
      const current = prev[wordId] || { hintCount: 0, revealedPositions: [] };
      
      // If all letters revealed, do nothing
      if (current.hintCount >= wordLength) {
        return prev;
      }

      // Find positions not yet revealed
      const allPositions = Array.from({ length: wordLength }, (_, i) => i);
      const availablePositions = allPositions.filter(p => !current.revealedPositions.includes(p));
      
      // Pick a random position to reveal
      const randomIndex = Math.floor(Math.random() * availablePositions.length);
      const newPosition = availablePositions[randomIndex];

      return {
        ...prev,
        [wordId]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, newPosition]
        }
      };
    });
  };

  const resetWord = (wordId: number) => {
    setHintStates(prev => {
      const newState = { ...prev };
      delete newState[wordId];
      return newState;
    });
  };

  const resetAll = () => {
    setHintStates({});
  };

  const goBack = () => {
    router.push("/");
  };

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
          
          {/* Theme Selection Dropdown */}
          <div className="flex justify-center">
            <select
              value={selectedTheme}
              onChange={(e) => {
                setSelectedTheme(e.target.value);
                setHintStates({});
              }}
              className="px-4 py-2 rounded-lg font-medium text-sm border-2 border-gray-400 bg-gray-200 text-gray-800 cursor-pointer"
            >
              {Object.keys(themes).map((themeKey) => (
                <option key={themeKey} value={themeKey}>
                  {themeNames[themeKey]}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Vocabulary List */}
        <div className="w-full bg-gray-200 border-2 border-gray-400 rounded-2xl p-4 mb-4 max-h-96 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {currentVocabulary.map((word) => {
              const state = getHintState(word.id);
              const { hintCount, revealedPositions } = state;
              const letters = word.spanish.split('');
              const isHintActive = hintCount > 0;
              
              return (
                <div key={word.id} className="flex items-center justify-between gap-4">
                  {/* Word and Answer Section */}
                  <div className="flex-1 text-center">
                    <div className="text-lg font-medium text-gray-800 mb-1">
                      {word.english}
                    </div>
                    <div className="flex items-center justify-center">
                      {/* Letter slots - solid line or individual slots with revealed letters */}
                      {isHintActive ? (
                        <div className="flex gap-1">
                          {letters.map((letter, index) => (
                            <div 
                              key={index}
                              className="w-5 h-6 flex items-end justify-center border-b-2 border-gray-500"
                            >
                              {revealedPositions.includes(index) && (
                                <span className="text-lg font-bold text-gray-800">
                                  {letter}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          className="border-b-2 border-solid border-gray-700"
                          style={{ width: `${word.english.length * 1.25}rem` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Buttons Section */}
                  <div className="flex gap-2">
                    {/* Hint Button with badge */}
                    <div className="relative">
                      <button
                        onClick={() => pressHint(word.id, letters.length)}
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
                      onClick={() => resetWord(word.id)}
                      className="bg-gray-200 border-2 border-gray-400 rounded-lg px-4 py-2 font-bold text-sm uppercase text-gray-800 hover:bg-gray-300"
                    >
                      Reset
                    </button>
                  </div>
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
