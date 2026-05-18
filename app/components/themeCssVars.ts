import { getButtonStyles, type ThemeColors } from "@/lib/theme";

export const cssVarColors: ThemeColors = {
  primary: {
    DEFAULT: "var(--color-primary)",
    light: "var(--color-primary-light)",
    dark: "var(--color-primary-dark)",
    darkest: "var(--color-primary-dark)",
    glow: "color-mix(in srgb, var(--color-primary) 35%, transparent)",
  },
  cta: {
    DEFAULT: "var(--color-cta)",
    light: "var(--color-cta-light)",
    lighter: "var(--color-cta-light)",
    dark: "var(--color-cta-dark)",
    darkest: "var(--color-cta-dark)",
    glow: "color-mix(in srgb, var(--color-cta) 35%, transparent)",
  },
  neutral: {
    DEFAULT: "var(--color-neutral)",
    light: "var(--color-neutral-light)",
    dark: "var(--color-neutral-dark)",
  },
  secondary: {
    DEFAULT: "var(--color-secondary)",
    light: "var(--color-secondary-light)",
    dark: "var(--color-secondary-dark)",
  },
  background: {
    DEFAULT: "var(--color-background)",
    elevated: "var(--color-background-elevated)",
  },
  text: {
    DEFAULT: "var(--color-text)",
    muted: "var(--color-text-muted)",
    inverse: "var(--color-background)",
  },
  status: {
    success: {
      DEFAULT: "var(--color-success)",
      light: "var(--color-success-light)",
      dark: "var(--color-success-dark)",
    },
    warning: {
      DEFAULT: "var(--color-warning)",
      light: "var(--color-warning-light)",
      dark: "var(--color-warning-dark)",
    },
    danger: {
      DEFAULT: "var(--color-danger)",
      light: "var(--color-danger-light)",
      dark: "var(--color-danger-dark)",
    },
  },
};

export const cssVarButtonStyles = getButtonStyles(cssVarColors);
