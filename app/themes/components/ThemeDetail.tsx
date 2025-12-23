"use client";

import { useState, useMemo } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { 
  getDuplicateWordIndices, 
  checkThemeForDuplicateWrongAnswers,
  checkThemeForWrongMatchingAnswer,
  hasDuplicateWrongAnswersInWord, 
  doesWrongAnswerMatchCorrect 
} from "@/lib/themes";
import { buttonStyles, colors } from "@/lib/theme";
import type { FieldType } from "../constants";
import { THEME_NAME_MAX_LENGTH } from "../constants";
import { AddWordModal } from "./AddWordModal";
import { GenerateRandomModal } from "./GenerateRandomModal";

interface ThemeDetailProps {
  theme: Doc<"themes"> & {
    ownerNickname?: string;
    ownerDiscriminator?: number;
    isOwner?: boolean;
    canEdit?: boolean;
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
  // Friends can edit
  friendsCanEdit?: boolean;
  isUpdatingFriendsCanEdit?: boolean;
  onFriendsCanEditChange?: (canEdit: boolean) => void;
}

const rowActionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-2xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg";

const primaryActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const ctaActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
  borderTopColor: buttonStyles.cta.border.top,
  borderBottomColor: buttonStyles.cta.border.bottom,
  borderLeftColor: buttonStyles.cta.border.sides,
  borderRightColor: buttonStyles.cta.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const outlineButtonClassName =
  "flex-1 border-2 rounded-2xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest transition hover:brightness-110";

const outlineButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

const secondaryActionStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

const secondaryAccentStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.secondary.dark,
  color: colors.secondary.light,
};

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
  friendsCanEdit,
  isUpdatingFriendsCanEdit,
  onFriendsCanEditChange,
}: ThemeDetailProps) {
  const [isEditingThemeName, setIsEditingThemeName] = useState(false);
  const [editedThemeName, setEditedThemeName] = useState("");

  const isOwner = theme.isOwner !== false; // Default to true for backward compatibility
  const canEdit = theme.canEdit !== false; // Default to true for backward compatibility
  const ownerDisplay = theme.ownerNickname && theme.ownerDiscriminator
    ? `${theme.ownerNickname}#${theme.ownerDiscriminator}`
    : null;

  // Compute duplicate word indices once, not per iteration
  const duplicateWordIndices = useMemo(
    () => getDuplicateWordIndices(localWords),
    [localWords]
  );
  const hasDuplicateWords = duplicateWordIndices.size > 0;
  const hasThemeDuplicateWrongAnswers = useMemo(
    () => checkThemeForDuplicateWrongAnswers(localWords),
    [localWords]
  );
  const hasThemeWrongMatchingAnswer = useMemo(
    () => checkThemeForWrongMatchingAnswer(localWords),
    [localWords]
  );
  const hasThemeIssues =
    hasDuplicateWords || hasThemeDuplicateWrongAnswers || hasThemeWrongMatchingAnswer;

  const visibilityButtonClassName =
    "px-4 py-1.5 text-sm font-medium transition hover:brightness-110 disabled:opacity-50";
  const privateButtonStyle =
    visibility === "private"
      ? { backgroundColor: colors.primary.DEFAULT, color: colors.text.DEFAULT }
      : { backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
  const sharedButtonStyle =
    visibility === "shared"
      ? { backgroundColor: colors.secondary.DEFAULT, color: colors.text.DEFAULT }
      : { backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
  const lockButtonStyle = friendsCanEdit
    ? {
        backgroundColor: `${colors.secondary.DEFAULT}26`,
        borderColor: `${colors.secondary.DEFAULT}66`,
        color: colors.secondary.light,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      };

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
    <div
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: `${colors.background.DEFAULT}E6` }}
    >
      {/* Fixed Header */}
      <header className="flex-shrink-0 w-full max-w-xl mx-auto px-6 pt-6 pb-4 relative z-10 animate-slide-up">
        <div
          className="w-full rounded-3xl border-2 py-4 px-5 backdrop-blur-sm shadow-lg"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 16px 40px ${colors.primary.glow}`,
          }}
        >
          {isEditingThemeName && canEdit ? (
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
              className="title-font w-full text-xl font-bold text-center uppercase tracking-wider bg-transparent border-none outline-none focus:ring-0"
              style={{ color: colors.text.DEFAULT }}
              autoFocus
            />
          ) : (
            <h1
              onClick={() => {
                if (canEdit) {
                  setEditedThemeName(theme.name);
                  setIsEditingThemeName(true);
                }
              }}
              className={`title-font text-2xl sm:text-3xl text-center uppercase tracking-wider transition-colors ${canEdit ? "cursor-pointer" : ""}`}
              style={{
                background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
              title={canEdit ? "Click to edit theme name" : ""}
            >
              {theme.name}
            </h1>
          )}
          
          {/* Owner info for friend's themes */}
          {!isOwner && ownerDisplay && (
            <p className="text-center text-sm mt-1" style={{ color: colors.text.muted }}>
              by {ownerDisplay}
            </p>
          )}

          {/* Visibility toggle for owner */}
          {isOwner && onVisibilityChange && (
            <div className="flex justify-center items-center gap-2 mt-3">
              <div
                className="inline-flex rounded-xl overflow-hidden border-2"
                style={{ borderColor: colors.primary.dark }}
              >
                <button
                  onClick={() => onVisibilityChange("private")}
                  disabled={isUpdatingVisibility}
                  className={visibilityButtonClassName}
                  style={privateButtonStyle}
                >
                  Private
                </button>
                <button
                  onClick={() => onVisibilityChange("shared")}
                  disabled={isUpdatingVisibility}
                  className={visibilityButtonClassName}
                  style={sharedButtonStyle}
                >
                  Shared
                </button>
              </div>
              
              {/* Lock/Unlock toggle - only shown when shared */}
              {visibility === "shared" && onFriendsCanEditChange && (
                <button
                  onClick={() => onFriendsCanEditChange(!friendsCanEdit)}
                  disabled={isUpdatingFriendsCanEdit}
                  title={friendsCanEdit ? "Friends can edit - Click to lock" : "Friends can view only - Click to unlock"}
                  className="p-1.5 rounded-xl border-2 transition hover:brightness-110 disabled:opacity-50"
                  style={lockButtonStyle}
                >
                  {friendsCanEdit ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Scrollable Words List */}
      <div className="flex-1 overflow-y-auto px-6 relative z-10">
        <div className="w-full max-w-xl mx-auto">
          <div
            className="rounded-3xl border-2 p-4 backdrop-blur-sm animate-slide-up delay-100"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
              boxShadow: `0 20px 60px ${colors.primary.glow}`,
            }}
          >
            {/* Legend */}
            <div className="text-xs mb-4 px-1" style={{ color: colors.text.muted }}>
              <span className="font-medium" style={{ color: colors.status.warning.light }}>
                (Irr)
              </span>{" "}
              = Irregular verb
            </div>

            <div className="flex flex-col gap-4">
              {localWords.map((word, index) => {
                const isDuplicateWord = duplicateWordIndices.has(index);
                const hasDuplicateWrongAnswers = hasDuplicateWrongAnswersInWord(word);
                const wrongMatchesAnswer = doesWrongAnswerMatchCorrect(word);
                const hasInvalidChoices = hasDuplicateWrongAnswers || wrongMatchesAnswer;

                const badgeStyle = isDuplicateWord
                  ? {
                      backgroundColor: `${colors.status.danger.DEFAULT}1A`,
                      borderColor: colors.status.danger.dark,
                      color: colors.status.danger.light,
                    }
                  : hasInvalidChoices
                    ? {
                        backgroundColor: `${colors.status.warning.DEFAULT}1A`,
                        borderColor: colors.status.warning.dark,
                        color: colors.status.warning.light,
                      }
                    : {
                        backgroundColor: colors.background.DEFAULT,
                        borderColor: colors.primary.dark,
                        color: colors.text.DEFAULT,
                      };

                const wordButtonStyle = {
                  backgroundColor: `${colors.primary.DEFAULT}1A`,
                  borderColor: `${colors.primary.light}66`,
                  color: colors.text.DEFAULT,
                };

                const answerButtonStyle = {
                  backgroundColor: `${colors.secondary.DEFAULT}1A`,
                  borderColor: `${colors.secondary.light}66`,
                  color: colors.text.DEFAULT,
                };

                const wrongButtonStyle = {
                  backgroundColor: `${colors.cta.DEFAULT}1A`,
                  borderColor: `${colors.cta.light}66`,
                  color: colors.text.DEFAULT,
                };

                return (
                  <div
                    key={index}
                    className="border-2 rounded-2xl p-4"
                    style={{
                      backgroundColor: colors.background.DEFAULT,
                      borderColor: colors.primary.dark,
                    }}
                  >
                    {/* Word number badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
                        style={badgeStyle}
                      >
                        {index + 1}
                      </div>
                      {isDuplicateWord && (
                        <span
                          className="text-sm font-bold"
                          style={{ color: colors.status.danger.DEFAULT }}
                          title="Duplicate word in theme"
                        >
                          !
                        </span>
                      )}
                      {hasInvalidChoices && (
                        <span
                          className="text-sm font-bold"
                          style={{ color: colors.status.warning.DEFAULT }}
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
                        onClick={() => canEdit && onEditWord(index, "word")}
                        disabled={!canEdit}
                        className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
                          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
                        }`}
                        style={wordButtonStyle}
                      >
                        <div className="text-xs mb-1" style={{ color: colors.primary.light }}>
                          Word
                        </div>
                        {word.word}
                      </button>
                      <button
                        onClick={() => canEdit && onEditWord(index, "answer")}
                        disabled={!canEdit}
                        className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
                          canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
                        }`}
                        style={answerButtonStyle}
                      >
                        <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
                          Answer
                        </div>
                        {word.answer}
                      </button>
                    </div>

                    {/* Wrong Answers Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {word.wrongAnswers.map((wrongAnswer, wrongIdx) => (
                        <button
                          key={wrongIdx}
                          onClick={() => canEdit && onEditWord(index, "wrong", wrongIdx)}
                          disabled={!canEdit}
                          className={`p-2 border-2 rounded-lg text-sm font-medium transition text-center ${
                            canEdit ? "cursor-pointer hover:brightness-110" : "cursor-default"
                          }`}
                          style={wrongButtonStyle}
                        >
                          <div className="text-xs mb-1" style={{ color: colors.cta.light }}>
                            Wrong {wrongIdx + 1}
                          </div>
                          {wrongAnswer}
                        </button>
                      ))}
                    </div>

                    {/* Delete Word Button */}
                    {canEdit && (
                      <button
                        onClick={() => onDeleteWord(index)}
                        className="mt-3 w-full py-2 border-2 rounded-lg text-sm font-medium transition hover:brightness-110"
                        style={{
                          backgroundColor: `${colors.status.danger.DEFAULT}1A`,
                          borderColor: `${colors.status.danger.DEFAULT}66`,
                          color: colors.status.danger.light,
                        }}
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
      <div
        className="flex-shrink-0 w-full border-t px-6 py-4 backdrop-blur-sm relative z-10 animate-slide-up delay-200"
        style={{
          backgroundColor: `${colors.background.DEFAULT}E6`,
          borderColor: colors.primary.dark,
        }}
      >
        <div className="w-full max-w-xl mx-auto space-y-3">
          {/* Add Word / Generate Random Row - only for those with edit permission */}
          {canEdit && (
            <div className="flex gap-3">
              <button
                onClick={handleAddWordClick}
                className={`${outlineButtonClassName} text-sm sm:text-base`}
                style={secondaryActionStyle}
              >
                + Add Word
              </button>
              <button
                onClick={handleGenerateRandomClick}
                className={`${outlineButtonClassName} text-sm sm:text-base`}
                style={secondaryAccentStyle}
              >
                + Generate
              </button>
            </div>
          )}

          {/* Save/Cancel Row */}
          <div className="flex gap-3">
            {canEdit ? (
              <>
                <button
                  onClick={onSave}
                  disabled={hasThemeIssues}
                  className={`${rowActionButtonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
                  style={ctaActionStyle}
                >
                  Save
                </button>
                <button
                  onClick={onCancel}
                  className={outlineButtonClassName}
                  style={outlineButtonStyle}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={onCancel}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
              >
                Back
              </button>
            )}
          </div>
        </div>
        {canEdit && hasThemeIssues && (
          <div
            className="mt-3 w-full max-w-xl mx-auto rounded-2xl border-2 px-4 py-2 text-xs font-medium"
            style={{
              backgroundColor: `${colors.status.warning.DEFAULT}1A`,
              borderColor: `${colors.status.warning.DEFAULT}66`,
              color: colors.status.warning.light,
            }}
          >
            Theme contains issues. Fix the highlighted words to enable saving.
          </div>
        )}
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
