"use client";

import { EDIT_MODES, type EditMode, type FieldType } from "../constants";
import { RegenerateConfirmModal } from "./RegenerateConfirmModal";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";
import { ChoiceMode } from "./ChoiceMode";
import { GenerateMode } from "./GenerateMode";
import { ManualMode } from "./ManualMode";

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
  const colors = useAppearanceColors();
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

        {editMode === EDIT_MODES.CHOICE && (
          <ChoiceMode
            promptSummary={promptSummary}
            customInstructions={customInstructions}
            isGenerating={isGenerating}
            onCustomInstructionsChange={onCustomInstructionsChange}
            onGenerate={onGenerate}
            onGoToManual={onGoToManual}
            onBack={onBack}
          />
        )}

        {editMode === EDIT_MODES.GENERATE && (
          <GenerateMode
            fieldLabel={fieldLabel}
            editingField={editingField}
            oldValue={oldValue}
            generatedValue={generatedValue}
            userFeedback={userFeedback}
            isGenerating={isGenerating}
            onUserFeedbackChange={onUserFeedbackChange}
            onAcceptGenerated={onAcceptGenerated}
            onRegenerate={onRegenerate}
            onBack={onBack}
          />
        )}

        {editMode === EDIT_MODES.MANUAL && (
          <ManualMode
            manualValue={manualValue}
            manualMaxLength={manualMaxLength}
            onManualValueChange={onManualValueChange}
            onSaveManual={onSaveManual}
            onBack={onBack}
          />
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
