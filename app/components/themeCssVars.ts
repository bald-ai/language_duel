import {
  getButtonStyles,
  THEME_COLOR_CSS_VARS,
  type CssVarTree,
  type ThemeColors,
} from "@/lib/appearance";

// Mirror of THEME_COLOR_CSS_VARS: each var-backed shade becomes a `var(--…)`
// reference. Built from the same manifest the writer uses, so the names cannot
// drift. The glow shades have no CSS variable and are computed below.
type VarRefTree<T> = {
  [K in keyof T]: T[K] extends string ? string : VarRefTree<T[K]>;
};

function buildVarReferences<T extends CssVarTree>(varTree: T): VarRefTree<T> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(varTree)) {
    const value = varTree[key];
    result[key] =
      typeof value === "string" ? `var(${value})` : buildVarReferences(value as CssVarTree);
  }
  return result as VarRefTree<T>;
}

const varColors = buildVarReferences(THEME_COLOR_CSS_VARS);

export const cssVarColors: ThemeColors = {
  ...varColors,
  primary: {
    ...varColors.primary,
    glow: "color-mix(in srgb, var(--color-primary) 35%, transparent)",
  },
  cta: {
    ...varColors.cta,
    glow: "color-mix(in srgb, var(--color-cta) 35%, transparent)",
  },
};

export const cssVarButtonStyles = getButtonStyles(cssVarColors);
