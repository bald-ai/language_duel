"use client";

import { ReactNode } from "react";
import { buttonStyles, colors, type ButtonVariant } from "@/lib/theme";

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
 * Colors are defined in lib/theme.ts - change them there to update everywhere.
 */
export function MenuButton({ onClick, children, badge, variant = "primary", dataTestId }: MenuButtonProps) {
  const styles = buttonStyles[variant];

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        data-testid={dataTestId}
        className="
          w-full bg-gradient-to-b
          border-t-2 border-b-4 border-x-2
          rounded-xl py-3 px-6
          text-base font-bold uppercase tracking-widest
          hover:translate-y-0.5 hover:border-b-2 
          active:translate-y-1 active:border-b-0 
          transition-all duration-200 
          shadow-lg
          backdrop-blur-sm
        "
        style={{ 
          // Gradient background
          backgroundImage: `linear-gradient(to bottom, ${styles.gradient.from}, ${styles.gradient.to})`,
          // Border colors
          borderTopColor: styles.border.top,
          borderBottomColor: styles.border.bottom,
          borderLeftColor: styles.border.sides,
          borderRightColor: styles.border.sides,
          // Text color - white
          color: "white",
          // Text shadow
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
          letterSpacing: "0.15em",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundImage = `linear-gradient(to bottom, ${styles.gradientHover.from}, ${styles.gradientHover.to})`;
          e.currentTarget.style.boxShadow = `0 0 30px ${styles.glow}`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundImage = `linear-gradient(to bottom, ${styles.gradient.from}, ${styles.gradient.to})`;
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <span className="relative z-10 flex items-center justify-start gap-4 pl-2">
          {children}
        </span>
      </button>
      {badge !== undefined && badge > 0 && (
        <div 
          className="absolute -top-2 -right-2 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold leading-none shadow-lg border-2"
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderColor: colors.cta.lighter,
          }}
        >
          {badge}
        </div>
      )}
    </div>
  );
}
