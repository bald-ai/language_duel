"use client";

interface LetterGroupsProps {
  answer: string;
  revealedPositions: number[];
  hintsRemaining: number;
  onRevealLetter: (position: number) => void;
}

export function LetterGroups({
  answer,
  revealedPositions,
  hintsRemaining,
  onRevealLetter,
}: LetterGroupsProps) {
  const letters = answer.split("");
  
  // Group letters by words (split on spaces)
  const wordGroups: Array<Array<{ idx: number; letter: string }>> = [];
  let currentGroup: Array<{ idx: number; letter: string }> = [];

  letters.forEach((letter, idx) => {
    if (letter === " ") {
      if (currentGroup.length > 0) {
        wordGroups.push(currentGroup);
        currentGroup = [];
      }
      return;
    }
    currentGroup.push({ idx, letter });
  });

  if (currentGroup.length > 0) {
    wordGroups.push(currentGroup);
  }

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
                onClick={() => canReveal && onRevealLetter(idx)}
                className={`w-5 h-6 flex items-end justify-center rounded bg-white/5 border-b-2 border-gray-500 transition-colors cursor-default ${
                  canReveal
                    ? "cursor-pointer hover:border-green-500 hover:bg-white/10"
                    : isRevealed
                    ? ""
                    : "cursor-not-allowed opacity-50"
                }`}
              >
                {isRevealed && (
                  <span className="text-base font-bold text-green-400">
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
}

