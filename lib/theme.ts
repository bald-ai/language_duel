/**
 * CENTRALIZED THEME CONFIGURATION
 *
 * Change colors or fonts here, and they'll update everywhere in the app.
 * This is the SINGLE SOURCE OF TRUTH for all design tokens.
 *
 * The theme system uses a simplified 3-color palette approach:
 * - bg: Background base color
 * - primary: Main brand color for buttons and UI elements
 * - accent: Call-to-action color for highlights and emphasis
 *
 * All other color variants (light, dark, etc.) are automatically derived.
 */

import {
  derivePrimaryShades,
  deriveCtaShades,
  deriveNeutralShades,
  deriveSecondaryShades,
  deriveBackgroundShades,
  deriveTextShades,
} from "./colorUtils";

// =============================================================================
// PALETTE DEFINITIONS
// =============================================================================

/**
 * A color palette definition with just 3 base colors
 */
export type ColorPalette = {
  name: string;
  label: string;
  bg: string;
  primary: string;
  accent: string;
};

/**
 * The 5 available color palettes
 */
export const colorPalettes: ColorPalette[] = [
  {
    name: "playful-duo",
    label: "Playful Duo",
    bg: "#FFF8F1",
    primary: "#FB7185",
    accent: "#22C55E",
  },
  {
    name: "toybox-adventure",
    label: "Toybox Adventure",
    bg: "#FDF4FF",
    primary: "#A855F7",
    accent: "#FACC15",
  },
  {
    name: "warm-mischief",
    label: "Warm Mischief",
    bg: "#FFF7ED",
    primary: "#F97316",
    accent: "#0EA5E9",
  },
  {
    name: "friendly-rivalry",
    label: "Friendly Rivalry",
    bg: "#F0F9FF",
    primary: "#2563EB",
    accent: "#FB7185",
  },
  {
    name: "candy-coop",
    label: "Candy Co-op",
    bg: "#FFF1F2",
    primary: "#EC4899",
    accent: "#22D3EE",
  },
];

// =============================================================================
// THEME SHAPES (maintained for backward compatibility)
// =============================================================================

type ThemeColors = {
  primary: {
    DEFAULT: string;
    light: string;
    dark: string;
    darkest: string;
    glow: string;
  };
  cta: {
    DEFAULT: string;
    light: string;
    lighter: string;
    dark: string;
    darkest: string;
    glow: string;
  };
  neutral: {
    DEFAULT: string;
    light: string;
    dark: string;
  };
  secondary: {
    DEFAULT: string;
    light: string;
    dark: string;
  };
  background: {
    DEFAULT: string;
    elevated: string;
  };
  text: {
    DEFAULT: string;
    muted: string;
    inverse: string;
  };
  status: {
    success: {
      DEFAULT: string;
      light: string;
      dark: string;
    };
    warning: {
      DEFAULT: string;
      light: string;
      dark: string;
    };
    danger: {
      DEFAULT: string;
      light: string;
      dark: string;
    };
  };
};

type ThemeDefinition = {
  label: string;
  colors: ThemeColors;
};

// =============================================================================
// DERIVE THEME COLORS FROM PALETTE
// =============================================================================

/**
 * Generate full ThemeColors from a 3-color palette
 */
function deriveThemeColors(palette: ColorPalette): ThemeColors {
  return {
    primary: derivePrimaryShades(palette.primary),
    cta: deriveCtaShades(palette.accent),
    neutral: deriveNeutralShades(palette.accent),
    secondary: deriveSecondaryShades(palette.primary),
    background: deriveBackgroundShades(palette.bg),
    text: deriveTextShades(palette.bg),
    // Status colors remain consistent across all palettes for accessibility
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
  };
}

// =============================================================================
// THEME DEFINITIONS (generated from palettes)
// =============================================================================

export const themes = colorPalettes.reduce(
  (acc, palette) => {
    acc[palette.name] = {
      label: palette.label,
      colors: deriveThemeColors(palette),
    };
    return acc;
  },
  {} as Record<string, ThemeDefinition>
);

// Add backward-compatible "default" and "forest" aliases
themes["default"] = themes["playful-duo"];
themes["forest"] = themes["toybox-adventure"];

export type ThemeName = string;
export const DEFAULT_THEME_NAME = "playful-duo";

export const themeOptions = colorPalettes.map((palette) => ({
  name: palette.name,
  label: palette.label,
  preview: {
    bg: palette.bg,
    primary: palette.primary,
    accent: palette.accent,
  },
}));

// =============================================================================
// MUTABLE RUNTIME TOKENS
// =============================================================================

const cloneThemeColors = (source: ThemeColors): ThemeColors => ({
  primary: { ...source.primary },
  cta: { ...source.cta },
  neutral: { ...source.neutral },
  secondary: { ...source.secondary },
  background: { ...source.background },
  text: { ...source.text },
  status: {
    success: { ...source.status.success },
    warning: { ...source.status.warning },
    danger: { ...source.status.danger },
  },
});

const assignGroup = <T extends Record<string, string>>(target: T, source: T) => {
  Object.assign(target, source);
};

const applyThemeColors = (target: ThemeColors, source: ThemeColors) => {
  assignGroup(target.primary, source.primary);
  assignGroup(target.cta, source.cta);
  assignGroup(target.neutral, source.neutral);
  assignGroup(target.secondary, source.secondary);
  assignGroup(target.background, source.background);
  assignGroup(target.text, source.text);
  assignGroup(target.status.success, source.status.success);
  assignGroup(target.status.warning, source.status.warning);
  assignGroup(target.status.danger, source.status.danger);
};

export const isThemeName = (value: string): value is ThemeName =>
  Object.prototype.hasOwnProperty.call(themes, value);

let activeThemeName: ThemeName = DEFAULT_THEME_NAME;

export const colors: ThemeColors = cloneThemeColors(themes[activeThemeName].colors);

// =============================================================================
// SEMANTIC COLOR ROLES
// =============================================================================

type SemanticColors = {
  buttonPrimary: ThemeColors["primary"];
  buttonCta: ThemeColors["cta"];
  badge: string;
  badgeBorder: string;
  accent: ThemeColors["neutral"];
  pageBg: string;
  cardBg: string;
};

export const semanticColors: SemanticColors = {
  buttonPrimary: colors.primary,
  buttonCta: colors.cta,
  badge: colors.cta.DEFAULT,
  badgeBorder: colors.cta.lighter,
  accent: colors.neutral,
  pageBg: colors.background.DEFAULT,
  cardBg: colors.background.elevated,
};

const applySemanticColors = (target: SemanticColors, themeColors: ThemeColors) => {
  target.buttonPrimary = colors.primary;
  target.buttonCta = colors.cta;
  target.badge = themeColors.cta.DEFAULT;
  target.badgeBorder = themeColors.cta.lighter;
  target.accent = colors.neutral;
  target.pageBg = themeColors.background.DEFAULT;
  target.cardBg = themeColors.background.elevated;
};

// =============================================================================
// BUTTON STYLE PRESETS
// =============================================================================

type ButtonStyles = {
  primary: {
    gradient: {
      from: string;
      to: string;
    };
    gradientHover: {
      from: string;
      to: string;
    };
    border: {
      top: string;
      bottom: string;
      sides: string;
    };
    glow: string;
  };
  cta: {
    gradient: {
      from: string;
      to: string;
    };
    gradientHover: {
      from: string;
      to: string;
    };
    border: {
      top: string;
      bottom: string;
      sides: string;
    };
    glow: string;
  };
};

const createButtonStyles = (themeColors: ThemeColors): ButtonStyles => ({
  primary: {
    gradient: {
      from: themeColors.primary.DEFAULT,
      to: themeColors.primary.dark,
    },
    gradientHover: {
      from: themeColors.primary.light,
      to: themeColors.primary.DEFAULT,
    },
    border: {
      top: themeColors.primary.light,
      bottom: themeColors.primary.darkest,
      sides: themeColors.primary.DEFAULT,
    },
    glow: themeColors.primary.glow,
  },
  cta: {
    gradient: {
      from: themeColors.cta.DEFAULT,
      to: themeColors.cta.dark,
    },
    gradientHover: {
      from: themeColors.cta.light,
      to: themeColors.cta.DEFAULT,
    },
    border: {
      top: themeColors.cta.lighter,
      bottom: themeColors.cta.darkest,
      sides: themeColors.cta.DEFAULT,
    },
    glow: themeColors.cta.glow,
  },
});

export const buttonStyles: ButtonStyles = createButtonStyles(colors);

const applyButtonStyles = (target: ButtonStyles, source: ButtonStyles) => {
  assignGroup(target.primary.gradient, source.primary.gradient);
  assignGroup(target.primary.gradientHover, source.primary.gradientHover);
  assignGroup(target.primary.border, source.primary.border);
  target.primary.glow = source.primary.glow;
  assignGroup(target.cta.gradient, source.cta.gradient);
  assignGroup(target.cta.gradientHover, source.cta.gradientHover);
  assignGroup(target.cta.border, source.cta.border);
  target.cta.glow = source.cta.glow;
};

// =============================================================================
// RUNTIME THEME SWITCHING
// =============================================================================

export const getActiveThemeName = () => activeThemeName;

const applyCssVariables = (themeColors: ThemeColors, themeName: ThemeName) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", themeName);

  root.style.setProperty("--color-primary", themeColors.primary.DEFAULT);
  root.style.setProperty("--color-primary-light", themeColors.primary.light);
  root.style.setProperty("--color-primary-dark", themeColors.primary.dark);

  root.style.setProperty("--color-cta", themeColors.cta.DEFAULT);
  root.style.setProperty("--color-cta-light", themeColors.cta.light);
  root.style.setProperty("--color-cta-dark", themeColors.cta.dark);

  root.style.setProperty("--color-neutral", themeColors.neutral.DEFAULT);
  root.style.setProperty("--color-neutral-light", themeColors.neutral.light);
  root.style.setProperty("--color-neutral-dark", themeColors.neutral.dark);

  root.style.setProperty("--color-secondary", themeColors.secondary.DEFAULT);
  root.style.setProperty("--color-secondary-light", themeColors.secondary.light);
  root.style.setProperty("--color-secondary-dark", themeColors.secondary.dark);

  root.style.setProperty("--color-background", themeColors.background.DEFAULT);
  root.style.setProperty("--color-background-elevated", themeColors.background.elevated);

  root.style.setProperty("--color-text", themeColors.text.DEFAULT);
  root.style.setProperty("--color-text-muted", themeColors.text.muted);

  root.style.setProperty("--color-success", themeColors.status.success.DEFAULT);
  root.style.setProperty("--color-success-light", themeColors.status.success.light);
  root.style.setProperty("--color-success-dark", themeColors.status.success.dark);
  root.style.setProperty("--color-warning", themeColors.status.warning.DEFAULT);
  root.style.setProperty("--color-warning-light", themeColors.status.warning.light);
  root.style.setProperty("--color-warning-dark", themeColors.status.warning.dark);
  root.style.setProperty("--color-danger", themeColors.status.danger.DEFAULT);
  root.style.setProperty("--color-danger-light", themeColors.status.danger.light);
  root.style.setProperty("--color-danger-dark", themeColors.status.danger.dark);
};

export const applyTheme = (themeName: ThemeName) => {
  const theme = themes[themeName] ?? themes[DEFAULT_THEME_NAME];
  activeThemeName = themes[themeName] ? themeName : DEFAULT_THEME_NAME;

  applyThemeColors(colors, theme.colors);
  applyButtonStyles(buttonStyles, createButtonStyles(theme.colors));
  applySemanticColors(semanticColors, theme.colors);
  applyCssVariables(theme.colors, activeThemeName);

  return activeThemeName;
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ButtonVariant = keyof typeof buttonStyles;
