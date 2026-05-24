"use client";

import type { ThemeColors } from "@/lib/appearance";
import type { HintReveal } from "@/lib/hintPool/types";
import type { DifficultyPillData } from "./DuelView";
import { buildDuelViewStyles, getDifficultyPillStyle } from "./duelViewStyles";

interface DuelRoundHeaderProps {
  wordsCount: number;
  index: number;
  word: string;
  sourceThemeName?: string | null;
  difficulty: DifficultyPillData;
  hintReveal?: HintReveal;
  phase: "idle" | "answering" | "transition";
  colors: ThemeColors;
}

/** Word progress, difficulty pill, the word to translate, and the hint reveal. */
export function DuelRoundHeader({
  wordsCount,
  index,
  word,
  sourceThemeName,
  difficulty,
  hintReveal,
  phase,
  colors,
}: DuelRoundHeaderProps) {
  const styles = buildDuelViewStyles(colors);

  return (
    <>
      {/* Word progress and difficulty */}
      <div className="text-center mb-3">
        <div className="text-sm mb-1" style={styles.mutedText}>
          Word #{index + 1} of {wordsCount}
        </div>
        <div>
          <span
            className="inline-block px-3 py-1 rounded-full border text-sm font-medium"
            style={getDifficultyPillStyle(colors, difficulty.level)}
          >
            {difficulty.level.toUpperCase()} (+{difficulty.points === 1 ? "1" : difficulty.points} pts)
          </span>
        </div>
      </div>

      {/* The word to translate */}
      <div className="text-center mb-4">
        {sourceThemeName && (
          <div
            className="text-xs uppercase tracking-[0.25em] mb-2"
            style={styles.mutedText}
          >
            {sourceThemeName}
          </div>
        )}
        <div className="text-2xl md:text-3xl font-bold">{word}</div>
        {hintReveal && phase === "answering" && (
          <div
            className="mt-2 rounded-full border px-3 py-1 text-sm font-semibold"
            style={styles.hintReveal}
            data-testid="duel-hint-reveal"
          >
            {hintReveal.kind === "anagram" ? (
              `Anagram: ${hintReveal.value}`
            ) : (
              <span className="inline-flex items-end gap-3 align-middle">
                {hintReveal.value.map((wordLength, wordIdx) => (
                  <span key={wordIdx} className="inline-flex items-end gap-1">
                    {Array.from({ length: wordLength }).map((_, slotIdx) => (
                      <span
                        key={slotIdx}
                        className="inline-block w-3 border-b-2"
                        style={{ borderColor: colors.secondary.dark }}
                      />
                    ))}
                  </span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
