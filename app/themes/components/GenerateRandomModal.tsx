"use client";

import { MAX_RANDOM_WORD_COUNT } from "../constants";

interface GenerateRandomModalProps {
  isOpen: boolean;
  themeName: string;
  count: number;
  isGenerating: boolean;
  error: string | null;
  onCountChange: (count: number) => void;
  onGenerate: () => void;
  onClose: () => void;
}

export function GenerateRandomModal({
  isOpen,
  themeName,
  count,
  isGenerating,
  error,
  onCountChange,
  onGenerate,
  onClose,
}: GenerateRandomModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">Generate Random Words</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-2">Number of words to generate (1-{MAX_RANDOM_WORD_COUNT})</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max={MAX_RANDOM_WORD_COUNT}
              value={count}
              onChange={(e) => onCountChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              disabled={isGenerating}
            />
            <span className="w-8 text-center text-xl font-bold text-white">{count}</span>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-4 text-center">
          This will generate {count} new unique word{count > 1 ? "s" : ""} for the theme &quot;{themeName}&quot;
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-200 text-sm">
            {error}
          </div>
        )}

        {isGenerating && (
          <div className="mb-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm text-gray-300">Generating {count} words... This may take a moment.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex-1 bg-purple-600 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

