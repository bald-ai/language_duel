import type { CSSProperties } from "react";
import { getButtonStyles, type ThemeColors } from "@/lib/appearance";

/**
 * Shared button styling for the solo level inputs. The gradient/border colors
 * derive from the canonical `getButtonStyles` primitive (never re-encoded color
 * strings); only the layout className is level-specific. Named to avoid colliding
 * with `modalButtonStyles.actionButtonClassName`.
 */
export const levelActionButtonClassName =
  "bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-2 px-5 text-xs sm:text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

/** Primary ("Confirm") gradient, from the canonical `primary` button recipe. */
export const getLevelPrimaryActionStyle = (colors: ThemeColors): CSSProperties => {
  const buttonStyles = getButtonStyles(colors);
  return {
    backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
    borderTopColor: buttonStyles.primary.border.top,
    borderBottomColor: buttonStyles.primary.border.bottom,
    borderLeftColor: buttonStyles.primary.border.sides,
    borderRightColor: buttonStyles.primary.border.sides,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
  };
};

/** Secondary ("Don't Know" / ghost) outline style. */
export const getLevelSecondaryActionStyle = (colors: ThemeColors): CSSProperties => ({
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
});
