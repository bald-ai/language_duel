import type { CSSProperties } from "react";
import type { ThemeColors } from "@/lib/appearance";
import type { DifficultyPillData } from "./DuelView";

/**
 * Static, appearance-keyed style objects for the duel view. Presentation config
 * lifted out of DuelView so the component file is orchestration, not styling.
 */
export function buildDuelViewStyles(colors: ThemeColors) {
  return {
    gameContainer: {
      "--duel-bg": `${colors.background.DEFAULT}E6`,
      "--duel-bg-elevated": `${colors.background.elevated}80`,
      borderColor: colors.primary.dark,
    } as CSSProperties,
    subtleBorder: { borderColor: `${colors.primary.dark}80` } as CSSProperties,
    mutedText: { color: colors.text.muted } as CSSProperties,
    exitButton: {
      backgroundColor: colors.status.danger.DEFAULT,
      color: colors.text.inverse,
    } as CSSProperties,
    waitingMessage: {
      color: colors.status.warning.light,
      backgroundColor: `${colors.background.DEFAULT}99`,
      borderColor: `${colors.status.warning.DEFAULT}4D`,
    } as CSSProperties,
    hintReveal: {
      borderColor: colors.secondary.dark,
      backgroundColor: `${colors.secondary.DEFAULT}22`,
      color: colors.text.DEFAULT,
    } as CSSProperties,
  };
}

export function getListenButtonStyle(colors: ThemeColors, isPlaying: boolean): CSSProperties {
  return isPlaying
    ? {
        backgroundColor: colors.status.success.DEFAULT,
        borderColor: colors.status.success.dark,
        color: colors.text.DEFAULT,
      }
    : {
        backgroundColor: colors.secondary.DEFAULT,
        borderColor: colors.secondary.dark,
        color: colors.text.DEFAULT,
      };
}

export function getConfirmButtonStyle(colors: ThemeColors, disabled: boolean): CSSProperties {
  return disabled
    ? {
        backgroundColor: colors.background.elevated,
        borderBottomColor: colors.neutral.dark,
        color: colors.text.muted,
      }
    : {
        backgroundColor: colors.cta.DEFAULT,
        borderBottomColor: colors.cta.dark,
        color: colors.text.DEFAULT,
      };
}

export function getDifficultyPillStyle(
  colors: ThemeColors,
  level: DifficultyPillData["level"]
): CSSProperties {
  const byLevel: Record<DifficultyPillData["level"], CSSProperties> = {
    easy: {
      color: colors.status.success.light,
      backgroundColor: `${colors.status.success.DEFAULT}33`,
      borderColor: colors.status.success.DEFAULT,
    },
    medium: {
      color: colors.status.warning.light,
      backgroundColor: `${colors.status.warning.DEFAULT}33`,
      borderColor: colors.status.warning.DEFAULT,
    },
    hard: {
      color: colors.status.danger.light,
      backgroundColor: `${colors.status.danger.DEFAULT}33`,
      borderColor: colors.status.danger.DEFAULT,
    },
  };
  return byLevel[level];
}
