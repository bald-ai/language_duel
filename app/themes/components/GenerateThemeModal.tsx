"use client";

import type { WordType } from "@/lib/themes";
import {
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
  GENERATED_WORDS_COUNT,
} from "../constants";

interface GenerateThemeModalProps {
  isOpen: boolean;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  isGenerating: boolean;
  onThemeNameChange: (name: string) => void;
  onThemePromptChange: (prompt: string) => void;
  onWordTypeChange: (wordType: WordType) => void;
  onGenerate: () => void;
  onClose: () => void;
}

export function GenerateThemeModal({
  isOpen,
  themeName,
  themePrompt,
  wordType,
  isGenerating,
  onThemeNameChange,
  onThemePromptChange,
  onWordTypeChange,
  onGenerate,
  onClose,
}: GenerateThemeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4 text-center">New Theme</h2>

        {/* Word Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onWordTypeChange("nouns")}
            disabled={isGenerating}
            className={`flex-1 py-3 rounded-xl font-bold uppercase transition-colors ${
              wordType === "nouns"
                ? "bg-gray-700 text-white"
                : "bg-gray-800 border-2 border-gray-700 text-gray-200 hover:bg-gray-700"
            }`}
          >
            Nouns
          </button>
          <button
            onClick={() => onWordTypeChange("verbs")}
            disabled={isGenerating}
            className={`flex-1 py-3 rounded-xl font-bold uppercase transition-colors ${
              wordType === "verbs"
                ? "bg-gray-700 text-white"
                : "bg-gray-800 border-2 border-gray-700 text-gray-200 hover:bg-gray-700"
            }`}
          >
            Verbs
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <input
              type="text"
              value={themeName}
              onChange={(e) => {
                if (e.target.value.length <= THEME_NAME_MAX_LENGTH) {
                  onThemeNameChange(e.target.value);
                }
              }}
              placeholder="Theme name (e.g. Kitchen)"
              maxLength={THEME_NAME_MAX_LENGTH}
              className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {themeName.length}/{THEME_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <textarea
              value={themePrompt}
              onChange={(e) => {
                if (e.target.value.length <= THEME_PROMPT_MAX_LENGTH) {
                  onThemePromptChange(e.target.value);
                }
              }}
              placeholder="Optional: Specify details (e.g. small items)"
              maxLength={THEME_PROMPT_MAX_LENGTH}
              rows={2}
              className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none resize-none"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {themePrompt.length}/{THEME_PROMPT_MAX_LENGTH}
            </p>
          </div>
        </div>

        {isGenerating && (
          <div className="mb-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm text-gray-300">Generating {GENERATED_WORDS_COUNT} words... This may take a moment.</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={!themeName.trim() || isGenerating}
            className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
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
