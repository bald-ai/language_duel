"use client";

import type { CSSProperties } from "react";
import { buttonStyles, colors } from "@/lib/theme";

/**
 * Primary modal CTA button with gradient background.
 */
export const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * CTA gradient colors and borders to match theme.
 */
export const ctaActionStyle: CSSProperties = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
  borderTopColor: buttonStyles.cta.border.top,
  borderBottomColor: buttonStyles.cta.border.bottom,
  borderLeftColor: buttonStyles.cta.border.sides,
  borderRightColor: buttonStyles.cta.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

/**
 * Secondary outline button for neutral actions.
 */
export const outlineButtonClassName =
  "w-full border-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Base outline button colors.
 */
export const outlineButtonStyle: CSSProperties = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

/**
 * Compact action buttons for inline accept/reject controls.
 */
export const smallActionButtonClassName =
  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest border-2 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * Success state for small inline buttons.
 */
export const successButtonStyle: CSSProperties = {
  backgroundColor: `${colors.status.success.DEFAULT}1A`,
  borderColor: `${colors.status.success.DEFAULT}66`,
  color: colors.status.success.light,
};

/**
 * Danger state for small inline buttons.
 */
export const dangerButtonStyle: CSSProperties = {
  backgroundColor: `${colors.status.danger.DEFAULT}1A`,
  borderColor: `${colors.status.danger.DEFAULT}66`,
  color: colors.status.danger.light,
};
