import type { CSSProperties } from "react";
import type { ThemeColors } from "@/lib/appearance";
import type { DifficultyPillData } from "./DuelView";

/**
 * Static, appearance-keyed style objects for the duel view. Presentation config
 * lifted out of DuelView so the component file is orchestration, not styling.
 */
/**
 * Vertical "eclipse" gradient for the duel card: nearly-solid at the top
 * (scoreboard / header) and bottom (action footer) so the chrome and buttons
 * read clearly, fading to see-through across the middle so the theme artwork
 * shows through the play area. Pair with a `backdrop-blur` on the element so the
 * see-through band stays a soft wash rather than busy detail.
 */
export function duelCardBackground(colors: ThemeColors): string {
  const base = colors.background.DEFAULT;
  const solid = `${base}F2`; // ~95% — top & bottom bands
  const sheer = `${base}73`; // ~45% — see-through middle
  return `linear-gradient(to bottom, ${solid} 0%, ${solid} 15%, ${sheer} 33%, ${sheer} 70%, ${solid} 88%, ${solid} 100%)`;
}

export function buildDuelViewStyles(colors: ThemeColors) {
  return {
    gameContainer: {
      background: duelCardBackground(colors),
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
