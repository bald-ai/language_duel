"use client";

import type { Level0Props } from "./types";

/**
 * Level 0 - Introduction/Reveal mode
 * Shows the word and answer, user indicates if they know it or not
 * Used only in solo study mode
 */
export function Level0Input({ word, answer, onGotIt, onNotYet }: Level0Props) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold text-white mb-2">{word}</div>
        <div className="text-sm text-gray-400 mb-3">Answer</div>
        <div className="text-2xl font-bold text-green-400">{answer}</div>
      </div>

      <div className="flex gap-3 w-full">
        <button
          onClick={onGotIt}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-colors"
        >
          Got it!
        </button>
        <button
          onClick={onNotYet}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
        >
          Not yet
        </button>
      </div>
    </div>
  );
}

