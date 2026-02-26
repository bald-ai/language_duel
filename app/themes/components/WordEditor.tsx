"use client";

import { EDIT_MODES, type EditMode, type FieldType } from "../constants";
import { RegenerateConfirmModal } from "./RegenerateConfirmModal";
import { buttonStyles, colors } from "@/lib/theme";
import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_USER_FEEDBACK_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";

interface WordEditorProps {
  editingField: FieldType;
  editingWrongIndex: number;
  editMode: EditMode;
  oldValue: string;
  generatedValue: string;
  manualValue: string;
  currentPrompt: string;
  userFeedback: string;
  promptSummary: string;
  customInstructions: string;
  isGenerating: boolean;
  isRegenerating: boolean;
  showRegenerateModal: boolean;
  pendingManualWord: string;
  onGenerate: () => void;
  onGoToManual: () => void;
  onManualValueChange: (value: string) => void;
  onUserFeedbackChange: (value: string) => void;
  onCustomInstructionsChange: (value: string) => void;
  onAcceptGenerated: () => void;
  onRegenerate: () => void;
  onSaveManual: () => void;
  onRegenerateConfirm: () => void;
  onRegenerateSkip: () => void;
  onRegenerateCancel: () => void;
  onBack: () => void;
}

const rowActionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-2xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const primaryActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const outlineButtonClassName =
  "flex-1 border-2 rounded-2xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const outlineButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

export function WordEditor({
  editingField,
  editingWrongIndex,
  editMode,
  oldValue,
  generatedValue,
  manualValue,
  currentPrompt: _currentPrompt,
  userFeedback,
  promptSummary,
  customInstructions,
  isGenerating,
  isRegenerating,
  showRegenerateModal,
  pendingManualWord,
  onGenerate,
  onGoToManual,
  onManualValueChange,
  onUserFeedbackChange,
  onCustomInstructionsChange,
  onAcceptGenerated,
  onRegenerate,
  onSaveManual,
  onRegenerateConfirm,
  onRegenerateSkip,
  onRegenerateCancel,
  onBack,
}: WordEditorProps) {
  const fieldLabel =
    editingField === "word"
      ? "Word"
      : editingField === "answer"
        ? "Answer"
        : `Wrong ${editingWrongIndex + 1}`;

  const manualMaxLength =
    editingField === "word"
      ? THEME_WORD_INPUT_MAX_LENGTH
      : editingField === "answer"
        ? THEME_ANSWER_INPUT_MAX_LENGTH
        : THEME_WRONG_ANSWER_INPUT_MAX_LENGTH;

  return (
    <>
      <header className="w-full mb-4 animate-slide-up">
        <div
          className="w-full rounded-3xl border-2 py-4 px-5 backdrop-blur-sm shadow-lg"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 16px 40px ${colors.primary.glow}`,
          }}
        >
          <h1
            className="title-font text-2xl text-center uppercase tracking-wider"
            style={{
              background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Edit {fieldLabel}
          </h1>
        </div>
      </header>

      <div
        className="w-full rounded-3xl border-2 p-4 mb-4 flex-1 overflow-auto backdrop-blur-sm animate-slide-up delay-100"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        {/* Current Value Display */}
        <div
          className="mb-4 p-3 border-2 rounded-xl"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
          }}
        >
          <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
            Current Value
          </div>
          <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
            {oldValue}
          </div>
        </div>

        {/* Choice Mode */}
        {editMode === EDIT_MODES.CHOICE && (
          <>
            {/* Human-readable summary */}
            <div
              className="mb-4 p-3 border-2 rounded-xl"
              style={{
                backgroundColor: `${colors.secondary.DEFAULT}0D`,
                borderColor: `${colors.secondary.DEFAULT}33`,
              }}
            >
              <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
                What the AI will do
              </div>
              <div className="text-sm" style={{ color: colors.text.DEFAULT }}>
                {promptSummary}
              </div>
            </div>

            {/* Custom Instructions */}
            <div className="mb-4">
              <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
                Custom Instructions (optional)
              </div>
              <textarea
                value={customInstructions}
                onChange={(e) => {
                  if (e.target.value.length <= CUSTOM_INSTRUCTIONS_MAX_LENGTH) {
                    onCustomInstructionsChange(e.target.value);
                  }
                }}
                placeholder="Add specifications (e.g., 'use formal language', 'make it more challenging', 'prefer Latin American Spanish')"
                className="w-full p-3 border-2 rounded-xl text-sm focus:outline-none resize-none placeholder:opacity-60"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                  color: colors.text.DEFAULT,
                }}
                rows={3}
                data-testid="word-editor-custom-instructions"
              />
              <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
                {customInstructions.length}/{CUSTOM_INSTRUCTIONS_MAX_LENGTH}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onGenerate}
                disabled={isGenerating}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
                data-testid="word-editor-generate"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
              <button
                onClick={onGoToManual}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
                data-testid="word-editor-manual"
              >
                Manually
              </button>
              <button
                onClick={onBack}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
                data-testid="word-editor-cancel"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Generate Mode */}
        {editMode === EDIT_MODES.GENERATE && (
          <>
            {/* Old vs New Comparison */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div
                className="p-3 border-2 rounded-xl"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                }}
              >
                <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
                  Old {fieldLabel}
                </div>
                <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
                  {oldValue}
                </div>
              </div>
              <div
                className="p-3 border-2 rounded-xl"
                style={{
                  backgroundColor: `${colors.secondary.DEFAULT}1A`,
                  borderColor: `${colors.secondary.DEFAULT}66`,
                  color: colors.secondary.light,
                }}
              >
                <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
                  New {fieldLabel}
                </div>
                <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
                  {generatedValue}
                </div>
              </div>
            </div>

            {editingField !== "word" && (
              <div className="mb-4">
                <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
                  Feedback for regeneration (optional)
                </div>
                <textarea
                  value={userFeedback}
                  onChange={(e) => {
                    if (e.target.value.length <= THEME_USER_FEEDBACK_MAX_LENGTH) {
                      onUserFeedbackChange(e.target.value);
                    }
                  }}
                  placeholder="e.g. Make the wrong answer more challenging"
                  className="w-full p-3 border-2 rounded-xl text-sm focus:outline-none resize-none placeholder:opacity-60"
                  style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                  }}
                  rows={3}
                  maxLength={THEME_USER_FEEDBACK_MAX_LENGTH}
                  data-testid="word-editor-user-feedback"
                />
                <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
                  {userFeedback.length}/{THEME_USER_FEEDBACK_MAX_LENGTH}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onAcceptGenerated}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
                data-testid="word-editor-accept"
              >
                Accept
              </button>
              <button
                onClick={onRegenerate}
                disabled={isGenerating}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
                data-testid="word-editor-regenerate"
              >
                {isGenerating ? "..." : "Regenerate"}
              </button>
              <button
                onClick={onBack}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
                data-testid="word-editor-cancel"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* Manual Mode */}
        {editMode === EDIT_MODES.MANUAL && (
          <>
            {/* Manual Input */}
            <div className="mb-4">
              <div className="text-sm mb-2" style={{ color: colors.text.muted }}>
                Enter new value:
              </div>
              <input
                type="text"
                value={manualValue}
                onChange={(e) => {
                  if (e.target.value.length <= manualMaxLength) {
                    onManualValueChange(e.target.value);
                  }
                }}
                className="w-full p-4 border-2 rounded-xl text-lg focus:outline-none"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                  color: colors.text.DEFAULT,
                }}
                maxLength={manualMaxLength}
                autoFocus
                data-testid="word-editor-manual-input"
              />
              <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
                {manualValue.length}/{manualMaxLength}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onSaveManual}
                disabled={!manualValue.trim()}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
                data-testid="word-editor-save-manual"
              >
                Save
              </button>
              <button
                onClick={onBack}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
                data-testid="word-editor-cancel"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {/* Regenerate Confirmation Modal */}
      <RegenerateConfirmModal
        isOpen={showRegenerateModal}
        pendingWord={pendingManualWord}
        isRegenerating={isRegenerating}
        onConfirm={onRegenerateConfirm}
        onSkip={onRegenerateSkip}
        onCancel={onRegenerateCancel}
      />
    </>
  );
}
