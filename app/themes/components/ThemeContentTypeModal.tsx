"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { getThemeOutlineButtonStyle, themeOutlineButtonClassName } from "./themeStyles";

interface ThemeContentTypeModalProps {
  isOpen: boolean;
  onPickWord: () => void;
  onPickSentence: () => void;
  onClose: () => void;
}

/**
 * Initial picker shown when the user taps "Generate New" from the themes list:
 * decide whether the new theme is a word theme or a sentence theme. Each path
 * opens its own dedicated generation modal (`GenerateThemeModal` /
 * `GenerateSentenceThemeModal`).
 */
export function ThemeContentTypeModal({
  isOpen,
  onPickWord,
  onPickSentence,
  onClose,
}: ThemeContentTypeModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  const pickButtonClassName =
    "flex-1 border-2 rounded-2xl p-4 text-left transition hover:brightness-110";

  const wordStyle = {
    backgroundColor: `${colors.primary.DEFAULT}1A`,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  const sentenceStyle = {
    backgroundColor: `${colors.secondary.DEFAULT}1A`,
    borderColor: colors.secondary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <ModalShell title="New Theme" dataTestId="theme-content-type-modal">
      <p className="mb-4 text-sm" style={{ color: colors.text.muted }}>
        Choose the kind of content this theme will hold.
      </p>
      <div className="flex flex-col gap-3 mb-6">
        <button
          onClick={onPickWord}
          className={pickButtonClassName}
          style={wordStyle}
          data-testid="theme-content-type-word"
        >
          <div className="font-bold text-sm uppercase tracking-wider mb-1">Word theme</div>
          <div className="text-xs" style={{ color: colors.text.muted }}>
            English -&gt; Spanish word with multiple-choice answers.
          </div>
        </button>
        <button
          onClick={onPickSentence}
          className={pickButtonClassName}
          style={sentenceStyle}
          data-testid="theme-content-type-sentence"
        >
          <div className="font-bold text-sm uppercase tracking-wider mb-1">Sentence theme</div>
          <div className="text-xs" style={{ color: colors.text.muted }}>
            English prompt -&gt; build the Spanish sentence from word tiles.
          </div>
        </button>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="theme-content-type-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
