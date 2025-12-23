"use client";

import { EDIT_MODES, type EditMode, type FieldType } from "../constants";
import { RegenerateConfirmModal } from "./RegenerateConfirmModal";
import { buttonStyles, colors } from "@/lib/theme";

interface WordEditorProps {
  editingField: FieldType;
  editingWrongIndex: number;
  editMode: EditMode;
  oldValue: string;
  generatedValue: string;
  manualValue: string;
  currentPrompt: string;
  userFeedback: string;
  isGenerating: boolean;
  isRegenerating: boolean;
  showRegenerateModal: boolean;
  pendingManualWord: string;
  onGenerate: () => void;
  onGoToManual: () => void;
  onManualValueChange: (value: string) => void;
  onUserFeedbackChange: (value: string) => void;
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
  currentPrompt,
  userFeedback,
  isGenerating,
  isRegenerating,
  showRegenerateModal,
  pendingManualWord,
  onGenerate,
  onGoToManual,
  onManualValueChange,
  onUserFeedbackChange,
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

        {/* Raw Prompt Display - hide for answer manual edit */}
        {!(editingField === "answer" && editMode === EDIT_MODES.MANUAL) && (
          <div className="mb-4">
            <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
              Prompt (from server)
            </div>
            <textarea
              value={currentPrompt}
              readOnly
              className="w-full p-3 border-2 rounded-xl font-mono text-xs focus:outline-none resize-none"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              rows={12}
            />
          </div>
        )}

        {/* Choice Mode */}
        {editMode === EDIT_MODES.CHOICE && (
          <div className="flex gap-3">
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className={rowActionButtonClassName}
              style={primaryActionStyle}
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={onGoToManual}
              className={outlineButtonClassName}
              style={outlineButtonStyle}
            >
              Manually
            </button>
            <button
              onClick={onBack}
              className={outlineButtonClassName}
              style={outlineButtonStyle}
            >
              Cancel
            </button>
          </div>
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
                  onChange={(e) => onUserFeedbackChange(e.target.value)}
                  placeholder="e.g. Make the wrong answer more challenging"
                  className="w-full p-3 border-2 rounded-xl text-sm focus:outline-none resize-none placeholder:opacity-60"
                  style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                  }}
                  rows={3}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onAcceptGenerated}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
              >
                Accept
              </button>
              <button
                onClick={onRegenerate}
                disabled={isGenerating}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
              >
                {isGenerating ? "..." : "Regenerate"}
              </button>
              <button
                onClick={onBack}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
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
                onChange={(e) => onManualValueChange(e.target.value)}
                className="w-full p-4 border-2 rounded-xl text-lg focus:outline-none"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                  color: colors.text.DEFAULT,
                }}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onSaveManual}
                disabled={!manualValue.trim()}
                className={rowActionButtonClassName}
                style={primaryActionStyle}
              >
                Save
              </button>
              <button
                onClick={onBack}
                className={outlineButtonClassName}
                style={outlineButtonStyle}
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
