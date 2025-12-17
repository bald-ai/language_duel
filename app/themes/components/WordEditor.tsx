"use client";

import { EDIT_MODES, type EditMode, type FieldType } from "../constants";
import { RegenerateConfirmModal } from "./RegenerateConfirmModal";

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
      <header className="w-full mb-4">
        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4">
          <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
            Edit {fieldLabel}
          </h1>
        </div>
      </header>

      <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 mb-4 flex-1 overflow-auto">
        {/* Current Value Display */}
        <div className="mb-4 p-3 bg-gray-900 border-2 border-gray-700 rounded-xl">
          <div className="text-xs text-gray-400 mb-1">Current Value</div>
          <div className="text-lg font-bold text-white">{oldValue}</div>
        </div>

        {/* Raw Prompt Display - hide for answer manual edit */}
        {!(editingField === "answer" && editMode === EDIT_MODES.MANUAL) && (
          <div className="mb-4">
            <div className="text-xs text-gray-400 mb-1">Prompt (from server)</div>
            <textarea
              value={currentPrompt}
              readOnly
              className="w-full p-3 border-2 border-gray-700 bg-gray-900 rounded-xl text-gray-200 font-mono text-xs focus:border-blue-500 focus:outline-none resize-none"
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
              className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase hover:bg-gray-700 transition-colors disabled:bg-gray-500"
            >
              {isGenerating ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={onGoToManual}
              className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
            >
              Manually
            </button>
            <button
              onClick={onBack}
              className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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
              <div className="p-3 bg-gray-900 border-2 border-gray-700 rounded-xl">
                <div className="text-xs text-gray-400 mb-1">Old {fieldLabel}</div>
                <div className="text-lg font-bold text-white">{oldValue}</div>
              </div>
              <div className="p-3 bg-green-500/10 border-2 border-green-500/30 rounded-xl">
                <div className="text-xs text-green-300 mb-1">New {fieldLabel}</div>
                <div className="text-lg font-bold text-green-200">{generatedValue}</div>
              </div>
            </div>

            {editingField !== "word" && (
              <div className="mb-4">
                <div className="text-xs text-gray-400 mb-1">Feedback for regeneration (optional)</div>
                <textarea
                  value={userFeedback}
                  onChange={(e) => onUserFeedbackChange(e.target.value)}
                  placeholder="e.g. Make the wrong answer more challenging"
                  className="w-full p-3 border-2 border-gray-700 bg-gray-900 rounded-xl text-gray-200 text-sm focus:border-blue-500 focus:outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onAcceptGenerated}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={onRegenerate}
                disabled={isGenerating}
                className="flex-1 bg-gray-800 text-white rounded-xl py-3 font-bold uppercase hover:bg-gray-700 transition-colors disabled:bg-gray-500"
              >
                {isGenerating ? "..." : "Regenerate"}
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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
              <div className="text-sm text-gray-300 mb-2">Enter new value:</div>
              <input
                type="text"
                value={manualValue}
                onChange={(e) => onManualValueChange(e.target.value)}
                className="w-full p-4 border-2 border-gray-700 bg-gray-900 rounded-xl text-white focus:border-blue-500 focus:outline-none text-lg"
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onSaveManual}
                disabled={!manualValue.trim()}
                className="flex-1 bg-green-600 text-white rounded-xl py-3 font-bold uppercase hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Save
              </button>
              <button
                onClick={onBack}
                className="flex-1 bg-gray-700 border-2 border-gray-600 rounded-xl py-3 font-bold text-white uppercase hover:bg-gray-600 transition-colors"
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

