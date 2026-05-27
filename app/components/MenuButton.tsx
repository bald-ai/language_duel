"use client";

import { ReactNode } from "react";
import { getButtonStyles, type ButtonVariant } from "@/lib/appearance";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface MenuButtonProps {
  onClick: () => void;
  children: ReactNode;
  badge?: number;
  variant?: ButtonVariant;
  dataTestId?: string;
}

/**
 * Design System:
 * - primary: Standard menu buttons - used for most actions
 * - cta: Call-to-action for the MOST important action - use sparingly, ideally only once per screen
 *
 * Gradient/border colors come from the canonical getButtonStyles (lib/appearance.ts),
 * the same source the modal CTA buttons use, so a palette change reaches every button.
 */
export function MenuButton({ onClick, children, badge, variant = "primary", dataTestId }: MenuButtonProps) {
  const colors = useAppearanceColors();
  const buttonStyle = getButtonStyles(colors)[variant];

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        data-testid={dataTestId}
        className="
          w-full bg-gradient-to-b
          border-t-2 border-b-4 border-x-2
          rounded-xl py-2 px-4
          text-sm font-bold uppercase tracking-widest
          hover:translate-y-0.5 hover:border-b-2 hover:brightness-110
          active:translate-y-1 active:border-b-0 active:scale-[0.98]
          transition-all duration-200
          shadow-lg
          backdrop-blur-sm
        "
        style={{
          backgroundImage: `linear-gradient(to bottom, ${buttonStyle.gradient.from}, ${buttonStyle.gradient.to})`,
          borderTopColor: buttonStyle.border.top,
          borderBottomColor: buttonStyle.border.bottom,
          borderLeftColor: buttonStyle.border.sides,
          borderRightColor: buttonStyle.border.sides,
          color: "white",
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
          letterSpacing: "0.15em",
        }}
      >
        <span className="relative z-10 flex items-center justify-start gap-3 pl-1">
          {children}
        </span>
      </button>
      {badge !== undefined && badge > 0 && (
        <div
          className="absolute -top-2 -right-2 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold leading-none shadow-lg border-2"
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderColor: colors.cta.light,
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}
