import { buttonStyles, colors } from "@/lib/theme";

export const themeActionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

export const themeOutlineButtonClassName =
  "flex-1 border-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

export function getThemeActionButtonStyle(
  variant: "primary" | "cta" | "danger"
): React.CSSProperties {
  if (variant === "danger") {
    return {
      backgroundImage: `linear-gradient(to bottom, ${colors.status.danger.DEFAULT}, ${colors.status.danger.dark})`,
      borderTopColor: colors.status.danger.light,
      borderBottomColor: colors.status.danger.dark,
      borderLeftColor: colors.status.danger.DEFAULT,
      borderRightColor: colors.status.danger.DEFAULT,
      color: colors.text.DEFAULT,
      textShadow: "0 2px 4px rgba(0,0,0,0.4)",
    };
  }

  const style = variant === "cta" ? buttonStyles.cta : buttonStyles.primary;

  return {
    backgroundImage: `linear-gradient(to bottom, ${style.gradient.from}, ${style.gradient.to})`,
    borderTopColor: style.border.top,
    borderBottomColor: style.border.bottom,
    borderLeftColor: style.border.sides,
    borderRightColor: style.border.sides,
    color: colors.text.DEFAULT,
    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
  };
}

export const themeOutlineButtonStyle: React.CSSProperties = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

export const themeModalPanelStyle: React.CSSProperties = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  boxShadow: `0 20px 60px ${colors.primary.glow}`,
};