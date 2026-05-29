import type { CSSProperties } from "react";
import type { ThemeColors } from "@/lib/appearance";

/**
 * Shared panel/pill styling for the Pick & Prune review screens. Both the word
 * review (`PickAndPruneReview`) and the sentence review
 * (`PickAndPruneSentenceReview`) render the same active/removed layout, so the
 * colour treatment lives here once.
 */

export function getCountPillStyle(colors: ThemeColors): CSSProperties {
  return {
    borderColor: colors.primary.DEFAULT,
    color: colors.primary.dark,
    backgroundColor: `${colors.primary.DEFAULT}1A`,
  };
}

export function getRemovedPillStyle(colors: ThemeColors): CSSProperties {
  return {
    borderColor: `${colors.status.danger.DEFAULT}88`,
    color: colors.status.danger.dark,
    backgroundColor: `${colors.status.danger.DEFAULT}14`,
  };
}

export function getActivePanelStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.background.DEFAULT}DD`,
    borderColor: `${colors.primary.DEFAULT}66`,
    boxShadow: `inset 0 1px 0 ${colors.background.elevated}`,
  };
}

export function getRemovedPanelStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.status.danger.DEFAULT}0F`,
    borderColor: `${colors.status.danger.DEFAULT}44`,
  };
}

export function getActiveRowStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, ${colors.background.elevated} 0%, ${colors.primary.DEFAULT}12 100%)`,
    borderColor: `${colors.primary.DEFAULT}55`,
    boxShadow: `0 1px 2px ${colors.primary.glow}33`,
  };
}

export function getRemovedRowStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.background.elevated}AA`,
    borderColor: `${colors.status.danger.DEFAULT}33`,
    opacity: 0.85,
  };
}

export function getActiveBadgeStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundImage: `linear-gradient(135deg, ${colors.cta.DEFAULT}40, ${colors.cta.dark}55)`,
    color: colors.cta.dark,
    border: `1px solid ${colors.cta.DEFAULT}66`,
  };
}

export function getRemovedBadgeStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.status.danger.DEFAULT}22`,
    color: colors.status.danger.dark,
    border: `1px solid ${colors.status.danger.DEFAULT}55`,
  };
}

export function getActiveActionButtonStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.status.danger.DEFAULT}18`,
    borderColor: `${colors.status.danger.DEFAULT}66`,
    color: colors.status.danger.dark,
  };
}

export function getRemovedActionButtonStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: `${colors.secondary.DEFAULT}1A`,
    borderColor: `${colors.secondary.DEFAULT}66`,
    color: colors.secondary.dark,
  };
}
