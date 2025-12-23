"use client";

import { MAX_RANDOM_WORD_COUNT } from "../constants";
import { buttonStyles, colors } from "@/lib/theme";

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

const actionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

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
  "flex-1 border-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const outlineButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

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
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Generate Random Words
        </h2>

        <div className="mb-4">
          <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>
            Number of words to generate (1-{MAX_RANDOM_WORD_COUNT})
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max={MAX_RANDOM_WORD_COUNT}
              value={count}
              onChange={(e) => onCountChange(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{ backgroundColor: colors.primary.dark }}
              disabled={isGenerating}
            />
            <span className="w-8 text-center text-xl font-bold" style={{ color: colors.text.DEFAULT }}>
              {count}
            </span>
          </div>
        </div>

        <p className="text-sm mb-4 text-center" style={{ color: colors.text.muted }}>
          This will generate {count} new unique word{count > 1 ? "s" : ""} for the theme &quot;{themeName}&quot;
        </p>

        {error && (
          <div
            className="mb-4 p-3 border-2 rounded-xl text-sm"
            style={{
              backgroundColor: `${colors.status.danger.DEFAULT}1A`,
              borderColor: `${colors.status.danger.DEFAULT}66`,
              color: colors.status.danger.light,
            }}
          >
            {error}
          </div>
        )}

        {isGenerating && (
          <div className="mb-4 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Generating {count} words... This may take a moment.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className={actionButtonClassName}
            style={primaryActionStyle}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
