/**
 * COLOR SHADE DERIVATION UTILITY
 *
 * Automatically generates color shade variants from base hex colors.
 * Uses HSL color space manipulation for consistent, visually pleasing results.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type ColorShades = {
  DEFAULT: string;
  light: string;
  lighter: string;
  dark: string;
  darker: string;
  glow: string;
};

export type PrimaryShades = {
  DEFAULT: string;
  light: string;
  dark: string;
  darkest: string;
  glow: string;
};

export type CtaShades = {
  DEFAULT: string;
  light: string;
  lighter: string;
  dark: string;
  darkest: string;
  glow: string;
};

export type NeutralShades = {
  DEFAULT: string;
  light: string;
  dark: string;
};

export type SecondaryShades = {
  DEFAULT: string;
  light: string;
  dark: string;
};

// =============================================================================
// COLOR CONVERSION UTILITIES
// =============================================================================

/**
 * Parse a hex color string to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(
  h: number,
  s: number,
  l: number
): { r: number; g: number; b: number } {
  h /= 360;
  s /= 100;
  l /= 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parse hex to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

// =============================================================================
// SHADE DERIVATION FUNCTIONS
// =============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Derive primary color shades from a base color
 * Creates: DEFAULT, light, dark, darkest, glow
 */
export function derivePrimaryShades(baseColor: string): PrimaryShades {
  const { h, s, l } = hexToHsl(baseColor);

  return {
    DEFAULT: baseColor.toUpperCase(),
    light: hslToHex(h, clamp(s + 5, 0, 100), clamp(l + 10, 0, 100)),
    dark: hslToHex(h, clamp(s + 5, 0, 100), clamp(l - 15, 0, 100)),
    darkest: hslToHex(h, clamp(s + 8, 0, 100), clamp(l - 25, 0, 100)),
    glow: `rgba(${hexToRgb(baseColor).r}, ${hexToRgb(baseColor).g}, ${hexToRgb(baseColor).b}, 0.4)`,
  };
}

/**
 * Derive CTA/accent color shades from a base color
 * Creates: DEFAULT, light, lighter, dark, darkest, glow
 */
export function deriveCtaShades(baseColor: string): CtaShades {
  const { h, s, l } = hexToHsl(baseColor);

  return {
    DEFAULT: baseColor.toUpperCase(),
    light: hslToHex(h, clamp(s + 5, 0, 100), clamp(l + 10, 0, 100)),
    lighter: hslToHex(h, clamp(s - 5, 0, 100), clamp(l + 18, 0, 100)),
    dark: hslToHex(h, clamp(s + 5, 0, 100), clamp(l - 15, 0, 100)),
    darkest: hslToHex(h, clamp(s + 8, 0, 100), clamp(l - 25, 0, 100)),
    glow: `rgba(${hexToRgb(baseColor).r}, ${hexToRgb(baseColor).g}, ${hexToRgb(baseColor).b}, 0.5)`,
  };
}

/**
 * Derive neutral shades from a base color (desaturated version)
 * Creates: DEFAULT, light, dark
 */
export function deriveNeutralShades(baseColor: string): NeutralShades {
  const { h, s, l } = hexToHsl(baseColor);
  // Desaturate and adjust for neutral palette
  const neutralS = clamp(s * 0.5, 0, 40);

  return {
    DEFAULT: hslToHex(h, neutralS, clamp(l + 10, 40, 80)),
    light: hslToHex(h, neutralS - 5, clamp(l + 20, 50, 90)),
    dark: hslToHex(h, neutralS, clamp(l - 10, 30, 60)),
  };
}

/**
 * Derive secondary shades from primary (slightly shifted hue)
 * Creates: DEFAULT, light, dark
 */
export function deriveSecondaryShades(primaryColor: string): SecondaryShades {
  const { h, s, l } = hexToHsl(primaryColor);
  // Shift hue by ~60 degrees for complementary feel
  const secondaryH = (h + 180) % 360;

  return {
    DEFAULT: hslToHex(secondaryH, clamp(s - 10, 30, 70), clamp(l + 5, 30, 60)),
    light: hslToHex(secondaryH, clamp(s - 15, 30, 70), clamp(l + 15, 40, 70)),
    dark: hslToHex(secondaryH, clamp(s - 5, 30, 70), clamp(l - 10, 20, 50)),
  };
}

/**
 * Derive background colors from the bg base color
 * Creates: DEFAULT, elevated
 */
export function deriveBackgroundShades(bgColor: string): {
  DEFAULT: string;
  elevated: string;
} {
  const { h, s, l } = hexToHsl(bgColor);

  return {
    DEFAULT: bgColor.toUpperCase(),
    // Elevated is slightly lighter than base (bounded by 100)
    elevated: hslToHex(h, clamp(s - 5, 0, 100), clamp(l + 3, 0, 100)),
  };
}

/**
 * Derive text colors based on background darkness
 * Creates: DEFAULT, muted, inverse
 */
export function deriveTextShades(bgColor: string): {
  DEFAULT: string;
  muted: string;
  inverse: string;
} {
  const { l } = hexToHsl(bgColor);
  const isDark = l < 50;

  if (isDark) {
    return {
      DEFAULT: "#F4F3F0",
      muted: "#A09C8E",
      inverse: bgColor.toUpperCase(),
    };
  } else {
    return {
      DEFAULT: "#1A1A1A",
      muted: "#666666",
      inverse: "#F4F3F0",
    };
  }
}

/**
 * Get the RGB values from a hex color for use in rgba()
 */
export function hexToRgbString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}
