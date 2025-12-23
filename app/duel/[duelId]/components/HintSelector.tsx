"use client";

/**
 * HintSelector - Modal component for choosing what type of hint to provide
 */
import { colors } from "@/lib/theme";

export type HintOption = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

// Global hints available on all levels
export const GLOBAL_HINT_OPTIONS: HintOption[] = [
  { id: "flash", label: "Flash Answer", description: "Brief glimpse (0.5s)", icon: "⚡" },
  { id: "tts", label: "Play Sound", description: "Pronounce the word", icon: "🔊" },
];

// L1-specific hints (letters reveal only makes sense for typing)
export const L1_HINT_OPTIONS: HintOption[] = [
  { id: "letters", label: "Reveal Letters", description: "Show up to 3 letters", icon: "🔤" },
  ...GLOBAL_HINT_OPTIONS,
];

// L2 multiple choice specific hints
export const L2_MC_HINT_OPTIONS: HintOption[] = [
  { id: "eliminate", label: "Eliminate Options", description: "Remove 2 wrong answers", icon: "❌" },
  ...GLOBAL_HINT_OPTIONS,
];

// L2 typing and L3 only get global hints
export const TYPING_HINT_OPTIONS: HintOption[] = [
  { id: "anagram", label: "Anagram", description: "Scrambled letters to rearrange", icon: "🔀" },
  ...GLOBAL_HINT_OPTIONS,
];

interface HintSelectorProps {
  requesterName: string;
  word: string;
  hintOptions: HintOption[];
  onSelectHint: (hintType: string) => void;
  onDismiss: () => void;
}

export function HintSelector({
  requesterName,
  word,
  hintOptions,
  onSelectHint,
  onDismiss,
}: HintSelectorProps) {
  const modalStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.secondary.dark,
    boxShadow: `0 24px 60px ${colors.secondary.DEFAULT}33`,
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl p-6 max-w-sm w-full border relative" style={modalStyle}>
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-xl w-8 h-8 flex items-center justify-center rounded-full transition hover:brightness-110"
          style={{ color: colors.text.muted }}
        >
          ✕
        </button>
        
        <div className="text-center mb-6">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
            style={{ backgroundColor: `${colors.secondary.DEFAULT}26` }}
          >
            <span className="text-2xl">🆘</span>
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: colors.text.DEFAULT }}>
            {requesterName} needs help!
          </h3>
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Choose how to help with: <span className="font-medium" style={{ color: colors.secondary.light }}>{word}</span>
          </p>
        </div>
        <div className="space-y-3">
          {hintOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelectHint(option.id)}
              className="w-full p-4 rounded-xl border transition-all group hover:brightness-110"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
              }}
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {option.icon}
                </div>
                <div className="text-left">
                  <div className="font-semibold transition-colors" style={{ color: colors.text.DEFAULT }}>
                    {option.label}
                  </div>
                  <div className="text-sm" style={{ color: colors.text.muted }}>
                    {option.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <button
          onClick={onDismiss}
          className="w-full mt-4 py-2 text-sm transition hover:brightness-110"
          style={{ color: colors.text.muted }}
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
