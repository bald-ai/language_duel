"use client";

/**
 * HintSelector - Modal component for choosing what type of hint to provide
 */

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
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-purple-500/50 shadow-2xl shadow-purple-500/20 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full mb-3">
            <span className="text-2xl">🆘</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {requesterName} needs help!
          </h3>
          <p className="text-sm text-gray-400">
            Choose how to help with: <span className="text-purple-300 font-medium">{word}</span>
          </p>
        </div>
        <div className="space-y-3">
          {hintOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelectHint(option.id)}
              className="w-full p-4 rounded-xl border border-gray-600 bg-gray-700/50 hover:bg-purple-500/20 hover:border-purple-500 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {option.icon}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {option.label}
                  </div>
                  <div className="text-sm text-gray-400">
                    {option.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <button
          onClick={onDismiss}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

