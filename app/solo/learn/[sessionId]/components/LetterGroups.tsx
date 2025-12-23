"use client";

import { memo, useMemo, useCallback } from "react";
import { colors } from "@/lib/theme";

interface LetterGroupsProps {
  answer: string;
  revealedPositions: number[];
  hintsRemaining: number;
  onRevealLetter: (position: number) => void;
}

// Memoized static styles
const letterSlotStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
} as const;

const revealedLetterStyle = {
  color: colors.secondary.light,
} as const;

export const LetterGroups = memo(function LetterGroups({
  answer,
  revealedPositions,
  hintsRemaining,
  onRevealLetter,
}: LetterGroupsProps) {
  // Memoize word groups computation to avoid recalculating on every render
  const wordGroups = useMemo(() => {
    const letters = answer.split("");
    const groups: Array<Array<{ idx: number; letter: string }>> = [];
    let currentGroup: Array<{ idx: number; letter: string }> = [];

    letters.forEach((letter, idx) => {
      if (letter === " ") {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
          currentGroup = [];
        }
        return;
      }
      currentGroup.push({ idx, letter });
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    return groups;
  }, [answer]);

  // Create a stable click handler
  const handleLetterClick = useCallback((idx: number, canReveal: boolean) => {
    if (canReveal) {
      onRevealLetter(idx);
    }
  }, [onRevealLetter]);

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 cursor-default">
      {wordGroups.map((group, groupIdx) => (
        <div key={groupIdx} className="inline-flex gap-1 flex-nowrap">
          {group.map(({ idx, letter }) => {
            const isRevealed = revealedPositions.includes(idx);
            const canReveal = !isRevealed && hintsRemaining > 0;

            return (
              <div
                key={idx}
                onClick={() => handleLetterClick(idx, canReveal)}
                className={`w-5 h-6 flex items-end justify-center rounded border-b-2 transition-colors cursor-default ${
                  canReveal
                    ? "cursor-pointer hover:brightness-110"
                    : isRevealed
                    ? ""
                    : "cursor-not-allowed opacity-50"
                }`}
                style={letterSlotStyle}
              >
                {isRevealed && (
                  <span className="text-base font-bold" style={revealedLetterStyle}>
                    {letter.toUpperCase()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

LetterGroups.displayName = "LetterGroups";
