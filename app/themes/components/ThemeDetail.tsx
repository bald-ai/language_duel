"use client";

import { useState, useMemo } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { 
  getDuplicateWordIndices, 
  hasDuplicateWrongAnswersInWord, 
  doesWrongAnswerMatchCorrect 
} from "@/lib/themes";
import type { FieldType } from "../constants";
import { THEME_NAME_MAX_LENGTH } from "../constants";
import { AddWordModal } from "./AddWordModal";
import { GenerateRandomModal } from "./GenerateRandomModal";

interface ThemeDetailProps {
  theme: Doc<"themes"> & {
    ownerNickname?: string;
    ownerDiscriminator?: number;
    isOwner?: boolean;
  };
  localWords: WordEntry[];
  onThemeNameChange: (name: string) => void;
  onDeleteWord: (index: number) => void;
  onEditWord: (wordIndex: number, field: FieldType, wrongIndex?: number) => void;
  onSave: () => void;
  onCancel: () => void;
  // Add word modal
  showAddWordModal: boolean;
  onShowAddWordModal: (show: boolean) => void;
  addWordState: {
    newWordInput: string;
    isAdding: boolean;
    error: string | null;
  };
  onAddWordInputChange: (value: string) => void;
  onAddWord: () => void;
  onAddWordReset: () => void;
  // Generate random modal
  showGenerateRandomModal: boolean;
  onShowGenerateRandomModal: (show: boolean) => void;
  generateRandomState: {
    count: number;
    isGenerating: boolean;
    error: string | null;
  };
  onRandomCountChange: (count: number) => void;
  onGenerateRandom: () => void;
  onGenerateRandomReset: () => void;
  // Visibility
  visibility?: "private" | "shared";
  isUpdatingVisibility?: boolean;
  onVisibilityChange?: (visibility: "private" | "shared") => void;
}

export function ThemeDetail({
  theme,
  localWords,
  onThemeNameChange,
  onDeleteWord,
  onEditWord,
  onSave,
  onCancel,
  showAddWordModal,
  onShowAddWordModal,
  addWordState,
  onAddWordInputChange,
  onAddWord,
  onAddWordReset,
  showGenerateRandomModal,
  onShowGenerateRandomModal,
  generateRandomState,
  onRandomCountChange,
  onGenerateRandom,
  onGenerateRandomReset,
  visibility,
  isUpdatingVisibility,
  onVisibilityChange,
}: ThemeDetailProps) {
  const [isEditingThemeName, setIsEditingThemeName] = useState(false);
  const [editedThemeName, setEditedThemeName] = useState("");

  const isOwner = theme.isOwner !== false; // Default to true for backward compatibility
  const ownerDisplay = theme.ownerNickname && theme.ownerDiscriminator
    ? `${theme.ownerNickname}#${theme.ownerDiscriminator}`
    : null;

  // Compute duplicate word indices once, not per iteration
  const duplicateWordIndices = useMemo(
    () => getDuplicateWordIndices(localWords),
    [localWords]
  );

  const handleThemeNameBlur = () => {
    if (editedThemeName.trim() && editedThemeName.trim().toUpperCase() !== theme.name) {
      onThemeNameChange(editedThemeName.trim().toUpperCase());
    }
    setIsEditingThemeName(false);
  };

  const handleThemeNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editedThemeName.trim() && editedThemeName.trim().toUpperCase() !== theme.name) {
        onThemeNameChange(editedThemeName.trim().toUpperCase());
      }
      setIsEditingThemeName(false);
    } else if (e.key === "Escape") {
      setIsEditingThemeName(false);
    }
  };

  const handleAddWordClick = () => {
    onAddWordReset();
    onShowAddWordModal(true);
  };

  const handleAddWordClose = () => {
    onShowAddWordModal(false);
    onAddWordReset();
  };

  const handleGenerateRandomClick = () => {
    onGenerateRandomReset();
    onShowGenerateRandomModal(true);
  };

  const handleGenerateRandomClose = () => {
    onShowGenerateRandomModal(false);
    onGenerateRandomReset();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-900">
      {/* Fixed Header */}
      <header className="flex-shrink-0 w-full max-w-md mx-auto px-4 pt-6 pb-4">
        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4">
          {isEditingThemeName && isOwner ? (
            <input
              type="text"
              value={editedThemeName}
              onChange={(e) => {
                if (e.target.value.length <= THEME_NAME_MAX_LENGTH) {
                  setEditedThemeName(e.target.value.toUpperCase());
                }
              }}
              onBlur={handleThemeNameBlur}
              onKeyDown={handleThemeNameKeyDown}
              maxLength={THEME_NAME_MAX_LENGTH}
              className="w-full text-xl font-bold text-center text-gray-300 uppercase tracking-wide bg-transparent border-none outline-none focus:ring-0"
              autoFocus
            />
          ) : (
            <h1
              onClick={() => {
                if (isOwner) {
                  setEditedThemeName(theme.name);
                  setIsEditingThemeName(true);
                }
              }}
              className={`text-xl font-bold text-center text-gray-300 uppercase tracking-wide transition-colors ${isOwner ? "cursor-pointer" : ""}`}
              title={isOwner ? "Click to edit theme name" : ""}
            >
              {theme.name}
            </h1>
          )}
          
          {/* Owner info for friend's themes */}
          {!isOwner && ownerDisplay && (
            <p className="text-center text-sm text-gray-500 mt-1">
              by {ownerDisplay}
            </p>
          )}

          {/* Visibility toggle for owner */}
          {isOwner && onVisibilityChange && (
            <div className="flex justify-center mt-3">
              <div className="inline-flex rounded-lg overflow-hidden border-2 border-gray-600">
                <button
                  onClick={() => onVisibilityChange("private")}
                  disabled={isUpdatingVisibility}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    visibility === "private"
                      ? "bg-gray-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  } disabled:opacity-50`}
                >
                  Private
                </button>
                <button
                  onClick={() => onVisibilityChange("shared")}
                  disabled={isUpdatingVisibility}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    visibility === "shared"
                      ? "bg-amber-600 text-white"
                      : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                  } disabled:opacity-50`}
                >
                  Shared
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable Words List */}
      <div className="flex-1 overflow-y-auto px-4">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-gray-800 border-2 border-gray-700 rounded-2xl p-4">
            {/* Legend */}
            <div className="text-xs text-gray-300 mb-4 px-1">
              <span className="text-amber-400 font-medium">(Irr)</span> = Irregular verb
            </div>

            <div className="flex flex-col gap-4">
              {localWords.map((word, index) => {
                const isDuplicateWord = duplicateWordIndices.has(index);
                const hasDuplicateWrongAnswers = hasDuplicateWrongAnswersInWord(word);
                const wrongMatchesAnswer = doesWrongAnswerMatchCorrect(word);
                const hasInvalidChoices = hasDuplicateWrongAnswers || wrongMatchesAnswer;

                let badgeClass = "border-gray-600 text-gray-300 bg-gray-800";
                if (isDuplicateWord) {
                  badgeClass = "border-red-500 text-red-200 bg-red-500/10";
                } else if (hasInvalidChoices) {
                  badgeClass = "border-orange-500 text-orange-200 bg-orange-500/10";
                }

                return (
                  <div key={index} className="bg-gray-800/50 border-2 border-gray-700 rounded-xl p-4">
                    {/* Word number badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${badgeClass}`}
                      >
                        {index + 1}
                      </div>
                      {isDuplicateWord && (
                        <span className="text-red-500 text-sm font-bold" title="Duplicate word in theme">
                          !
                        </span>
                      )}
                      {hasInvalidChoices && (
                        <span
                          className="text-orange-500 text-sm font-bold"
                          title={
                            wrongMatchesAnswer
                              ? "Wrong answer matches correct answer"
                              : "Duplicate wrong answers"
                          }
                        >
                          ⚠
                        </span>
                      )}
                    </div>

                    {/* Word & Answer Row */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        onClick={() => isOwner && onEditWord(index, "word")}
                        disabled={!isOwner}
                        className={`p-2 bg-blue-500/10 border-2 border-blue-500/30 rounded-lg text-sm font-medium text-blue-200 transition-colors text-center ${
                          isOwner ? "hover:bg-blue-500/20 hover:border-blue-400/50 cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="text-xs text-blue-300 mb-1">Word</div>
                        {word.word}
                      </button>
                      <button
                        onClick={() => isOwner && onEditWord(index, "answer")}
                        disabled={!isOwner}
                        className={`p-2 bg-green-500/10 border-2 border-green-500/30 rounded-lg text-sm font-medium text-green-200 transition-colors text-center ${
                          isOwner ? "hover:bg-green-500/20 hover:border-green-400/50 cursor-pointer" : "cursor-default"
                        }`}
                      >
                        <div className="text-xs text-green-300 mb-1">Answer</div>
                        {word.answer}
                      </button>
                    </div>

                    {/* Wrong Answers Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {word.wrongAnswers.map((wrongAnswer, wrongIdx) => (
                        <button
                          key={wrongIdx}
                          onClick={() => isOwner && onEditWord(index, "wrong", wrongIdx)}
                          disabled={!isOwner}
                          className={`p-2 bg-orange-500/10 border-2 border-orange-500/30 rounded-lg text-sm font-medium text-orange-200 transition-colors text-center ${
                            isOwner ? "hover:bg-orange-500/20 hover:border-orange-400/50 cursor-pointer" : "cursor-default"
                          }`}
                        >
                          <div className="text-xs text-orange-300 mb-1">Wrong {wrongIdx + 1}</div>
                          {wrongAnswer}
                        </button>
                      ))}
                    </div>

                    {/* Delete Word Button */}
                    {isOwner && (
                      <button
                        onClick={() => onDeleteWord(index)}
                        className="mt-3 w-full py-2 bg-red-500/10 border-2 border-red-500/30 rounded-lg text-sm font-medium text-red-200 hover:bg-red-500/20 hover:border-red-400/50 transition-colors"
                      >
                        Delete Word
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* Bottom spacer for fixed footer */}
          <div className="h-36"></div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="flex-shrink-0 w-full bg-gray-900 border-t border-gray-800 px-4 py-4">
        <div className="w-full max-w-md mx-auto space-y-3">
          {/* Add Word / Generate Random Row - only for owner */}
          {isOwner && (
            <div className="flex gap-3">
              <button
                onClick={handleAddWordClick}
                className="flex-1 bg-blue-600 text-white rounded-2xl py-3 text-lg font-bold uppercase hover:bg-blue-700 transition-colors"
              >
                + Add Word
              </button>
              <button
                onClick={handleGenerateRandomClick}
                className="flex-1 bg-purple-600 text-white rounded-2xl py-3 text-lg font-bold uppercase hover:bg-purple-700 transition-colors"
              >
                + Generate
              </button>
            </div>
          )}

          {/* Save/Cancel Row */}
          <div className="flex gap-3">
            {isOwner ? (
              <>
                <button
                  onClick={onSave}
                  className="flex-1 bg-gray-800 text-white rounded-2xl py-4 text-lg font-bold uppercase hover:bg-gray-700 transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={onCancel}
                  className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-2xl py-4 text-lg font-bold text-white uppercase hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={onCancel}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-2xl py-4 text-lg font-bold text-white uppercase hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Word Modal */}
      <AddWordModal
        isOpen={showAddWordModal}
        newWordInput={addWordState.newWordInput}
        isAdding={addWordState.isAdding}
        error={addWordState.error}
        onInputChange={onAddWordInputChange}
        onAdd={onAddWord}
        onClose={handleAddWordClose}
      />

      {/* Generate Random Words Modal */}
      <GenerateRandomModal
        isOpen={showGenerateRandomModal}
        themeName={theme.name}
        count={generateRandomState.count}
        isGenerating={generateRandomState.isGenerating}
        error={generateRandomState.error}
        onCountChange={onRandomCountChange}
        onGenerate={onGenerateRandom}
        onClose={handleGenerateRandomClose}
      />
    </div>
  );
}

