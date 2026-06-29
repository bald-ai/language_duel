"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { FormError } from "@/app/components/FormError";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { SENTENCE_ENGLISH_PROMPT_MAX_LENGTH } from "@/lib/themes/sentenceConstants";
import {
  getThemeActionButtonStyle,
  getThemeOutlineButtonStyle,
  themeActionButtonClassName,
  themeOutlineButtonClassName,
} from "./themeStyles";

interface AddSentenceModalProps {
  isOpen: boolean;
  englishPrompt: string;
  isAdding: boolean;
  error: string | null;
  onPromptChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddSentenceModal({
  isOpen,
  englishPrompt,
  isAdding,
  error,
  onPromptChange,
  onAdd,
  onClose,
}: AddSentenceModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <ModalShell title="Add New Sentence" dataTestId="theme-add-sentence-modal">
      <div className="mb-4">
        <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>
          English Sentence
        </label>
        <textarea
          value={englishPrompt}
          onChange={(event) => {
            if (event.target.value.length <= SENTENCE_ENGLISH_PROMPT_MAX_LENGTH) {
              onPromptChange(event.target.value);
            }
          }}
          placeholder="Enter an English sentence..."
          rows={3}
          className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60 resize-none"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          maxLength={SENTENCE_ENGLISH_PROMPT_MAX_LENGTH}
          disabled={isAdding}
          autoFocus
          data-testid="theme-add-sentence-input"
        />
        <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
          {englishPrompt.length}/{SENTENCE_ENGLISH_PROMPT_MAX_LENGTH}
        </p>
      </div>

      {error && <FormError message={error} className="mb-4" />}

      {isAdding && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Generating Spanish sentence, word meanings, and distractors...
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onAdd}
          disabled={!englishPrompt.trim() || isAdding}
          className={themeActionButtonClassName}
          style={getThemeActionButtonStyle("primary", colors)}
          data-testid="theme-add-sentence-submit"
        >
          {isAdding ? "Adding..." : "Add"}
        </button>
        <button
          onClick={onClose}
          disabled={isAdding}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="theme-add-sentence-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
