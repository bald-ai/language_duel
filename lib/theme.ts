/**
 * CENTRALIZED THEME CONFIGURATION
 * 
 * Change colors or fonts here, and they'll update everywhere in the app.
 * This is the SINGLE SOURCE OF TRUTH for all design tokens.
 */

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const colors = {
  // Primary - Your main brand color (used for most buttons, active states)
  primary: {
    DEFAULT: "#3C34C5",
    light: "#4F47D8",
    dark: "#2A248F",
    darkest: "#1F1A6B",
    glow: "rgba(60, 52, 197, 0.4)",
  },
  
  // CTA/Accent - Call-to-action color (use sparingly, 1-2 times per screen)
  cta: {
    DEFAULT: "#DE7321",
    light: "#F08535",
    lighter: "#F5A05C",
    dark: "#B55C1A",
    darkest: "#8F4711",
    glow: "rgba(222, 115, 33, 0.5)",
  },
  
  // Neutral - Decorative, muted elements
  neutral: {
    DEFAULT: "#B3A57A",
    light: "#C9BD94",
    dark: "#8A7F5E",
  },
  
  // Secondary - Supporting color (optional, for secondary buttons)
  secondary: {
    DEFAULT: "#397AAC",
    light: "#4A8FC2",
    dark: "#2A5D84",
  },
  
  // Background colors
  background: {
    DEFAULT: "#0B0A14",
    elevated: "#14132A",
  },
  
  // Text colors
  text: {
    DEFAULT: "#F4F3F0",
    muted: "#A09C8E",
    inverse: "#0B0A14",
  },

  // Status colors (feedback states)
  status: {
    success: {
      DEFAULT: "#3BB273",
      light: "#5CD192",
      dark: "#2A8A56",
    },
    warning: {
      DEFAULT: "#E3B341",
      light: "#F2C86D",
      dark: "#B98928",
    },
    danger: {
      DEFAULT: "#E35F5F",
      light: "#F27979",
      dark: "#B54848",
    },
  },
} as const;

// =============================================================================
// SEMANTIC COLOR ROLES
// =============================================================================

export const semanticColors = {
  // Button variants
  buttonPrimary: colors.primary,
  buttonCta: colors.cta,
  
  // UI elements
  badge: colors.cta.DEFAULT,
  badgeBorder: colors.cta.lighter,
  
  // Decorative
  accent: colors.neutral,
  
  // Backgrounds
  pageBg: colors.background.DEFAULT,
  cardBg: colors.background.elevated,
} as const;

// =============================================================================
// BUTTON STYLE PRESETS
// =============================================================================

export const buttonStyles = {
  primary: {
    gradient: {
      from: colors.primary.DEFAULT,
      to: colors.primary.dark,
    },
    gradientHover: {
      from: colors.primary.light,
      to: colors.primary.DEFAULT,
    },
    border: {
      top: colors.primary.light,
      bottom: colors.primary.darkest,
      sides: colors.primary.DEFAULT,
    },
    glow: colors.primary.glow,
  },
  
  cta: {
    gradient: {
      from: colors.cta.DEFAULT,
      to: colors.cta.dark,
    },
    gradientHover: {
      from: colors.cta.light,
      to: colors.cta.DEFAULT,
    },
    border: {
      top: colors.cta.lighter,
      bottom: colors.cta.darkest,
      sides: colors.cta.DEFAULT,
    },
    glow: colors.cta.glow,
  },
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ButtonVariant = keyof typeof buttonStyles;
