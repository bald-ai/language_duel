import { describe, expect, it } from "vitest";
import {
  applyTheme,
  colors,
  DEFAULT_THEME_NAME,
  getActiveThemeName,
  isThemeName,
  themes,
  colorPalettes,
  themeOptions,
  semanticColors,
  buttonStyles,
} from "@/lib/theme";

describe("theme", () => {
  it("isThemeName returns true for known palettes and false for unknown", () => {
    expect(isThemeName(colorPalettes[0].name)).toBe(true);
    expect(isThemeName("unknown-theme")).toBe(false);
  });

  it("themes do not include legacy aliases", () => {
    expect(themes.default).toBeUndefined();
    expect(themes.forest).toBeUndefined();
    expect(isThemeName("default")).toBe(false);
    expect(isThemeName("forest")).toBe(false);
  });

  it("themeOptions align with palettes", () => {
    expect(themeOptions).toHaveLength(colorPalettes.length);
    expect(themeOptions[0].name).toBe(colorPalettes[0].name);
  });

  it("applyTheme falls back to default for unknown names", () => {
    const name = applyTheme("not-a-theme" as never);
    expect(name).toBe(DEFAULT_THEME_NAME);
    expect(getActiveThemeName()).toBe(DEFAULT_THEME_NAME);
  });

  it("applyTheme updates css variables when document is available", () => {
    applyTheme(DEFAULT_THEME_NAME);

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_THEME_NAME);
    expect(root.style.getPropertyValue("--color-primary")).toBe(colors.primary.DEFAULT);
    expect(root.style.getPropertyValue("--color-cta")).toBe(colors.cta.DEFAULT);
  });

  it("applyTheme skips css variables when document is undefined", () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const name = applyTheme(DEFAULT_THEME_NAME);
    expect(name).toBe(DEFAULT_THEME_NAME);

    // restore
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });

  it("semantic colors and button styles track active colors", () => {
    applyTheme(DEFAULT_THEME_NAME);
    expect(semanticColors.badge).toBe(colors.cta.DEFAULT);
    expect(buttonStyles.primary.gradient.from).toBe(colors.primary.DEFAULT);
  });
});
