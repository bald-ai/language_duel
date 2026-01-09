"use client";

import type { CSSProperties } from "react";
import { colors } from "@/lib/theme";

interface OpponentStatusIndicatorProps {
  theirName: string | undefined;
  theirCurrentWordIndex: number | undefined;
  theirCurrentLevel: number | undefined;
  theirCompleted: boolean;
  opponentAnswerFeedback: "correct" | "wrong" | null;
  opponentLastAnsweredWord: string | null;
  opponentFeedbackMessage: string | null;
  themeWords: Array<{ word: string }>;
  theirColor: string;
}

export function OpponentStatusIndicator({
  theirName,
  theirCurrentWordIndex,
  theirCurrentLevel,
  theirCompleted,
  opponentAnswerFeedback,
  opponentLastAnsweredWord,
  opponentFeedbackMessage,
  themeWords,
  theirColor,
}: OpponentStatusIndicatorProps) {
  if (theirCurrentWordIndex === undefined || theirCurrentLevel === undefined || theirCompleted) {
    return null;
  }

  const opponentLabel = theirName?.split(" ")[0] || "Opponent";

  const levelBadgeStyles: Record<0 | 1 | 2 | 3, CSSProperties> = {
    0: {
      color: colors.text.muted,
      borderColor: colors.neutral.dark,
      backgroundColor: `${colors.neutral.dark}26`,
    },
    1: {
      color: colors.status.success.light,
      borderColor: colors.status.success.DEFAULT,
      backgroundColor: `${colors.status.success.DEFAULT}26`,
    },
    2: {
      color: colors.status.warning.light,
      borderColor: colors.status.warning.DEFAULT,
      backgroundColor: `${colors.status.warning.DEFAULT}26`,
    },
    3: {
      color: colors.status.danger.light,
      borderColor: colors.status.danger.DEFAULT,
      backgroundColor: `${colors.status.danger.DEFAULT}26`,
    },
  };

  const statusStyle =
    opponentAnswerFeedback === "correct"
      ? {
          backgroundColor: `${colors.status.success.DEFAULT}26`,
          borderColor: colors.status.success.DEFAULT,
          boxShadow: `0 0 20px ${colors.status.success.DEFAULT}66`,
        }
      : opponentAnswerFeedback === "wrong"
        ? {
            backgroundColor: `${colors.status.danger.DEFAULT}26`,
            borderColor: colors.status.danger.DEFAULT,
            boxShadow: `0 0 20px ${colors.status.danger.DEFAULT}66`,
          }
        : {
            backgroundColor: `${colors.background.elevated}E6`,
            borderColor: colors.primary.dark,
          };

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-1">
      <div className="rounded-full px-4 py-2 transition-all duration-300 border" style={statusStyle}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: colors.text.muted }}>
            {opponentLabel}:
          </span>
          <span className="font-medium text-sm" style={{ color: theirColor }}>
            {opponentLastAnsweredWord || themeWords[theirCurrentWordIndex]?.word || "..."}
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs font-medium border"
            style={levelBadgeStyles[(theirCurrentLevel || 1) as 0 | 1 | 2 | 3]}
          >
            L{theirCurrentLevel}
          </span>
          {opponentAnswerFeedback && (
            <span
              className="text-xs font-bold"
              style={{
                color:
                  opponentAnswerFeedback === "correct"
                    ? colors.status.success.light
                    : colors.status.danger.light,
              }}
            >
              {opponentAnswerFeedback === "correct" ? "✓" : "✗"}
            </span>
          )}
        </div>
      </div>
      {opponentFeedbackMessage && (
        <div
          className="text-xs font-bold px-4"
          style={{
            color:
              opponentFeedbackMessage === "Word completed!"
                ? colors.status.success.light
                : colors.status.danger.light,
          }}
        >
          {opponentFeedbackMessage}
        </div>
      )}
    </div>
  );
}
