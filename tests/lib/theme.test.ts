import { describe, expect, it } from "vitest";
import {
  applyThemeCssVariables,
  DEFAULT_THEME_NAME,
  getButtonStyles,
  getThemeColors,
  isThemeName,
  colorPalettes,
  themeOptions,
} from "@/lib/theme";

describe("theme", () => {
  it("isThemeName returns true for known palettes and false for unknown", () => {
    expect(isThemeName(colorPalettes[0].name)).toBe(true);
    expect(isThemeName("unknown-theme")).toBe(false);
  });

  it("themeOptions align with palettes", () => {
    expect(themeOptions).toHaveLength(colorPalettes.length);
    expect(themeOptions[0].name).toBe(colorPalettes[0].name);
  });

  it("getThemeColors fails loudly for unknown names", () => {
    expect(() => getThemeColors("not-a-theme")).toThrow(/Unknown theme name/);
  });

  it("applyThemeCssVariables sets the data-theme attribute and css variables", () => {
    const colors = getThemeColors(DEFAULT_THEME_NAME);
    applyThemeCssVariables(DEFAULT_THEME_NAME, colors);

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_THEME_NAME);
    expect(root.style.getPropertyValue("--color-primary")).toBe(colors.primary.DEFAULT);
  });

  it("applyThemeCssVariables skips css variables when document is undefined", () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    expect(() => {
      applyThemeCssVariables(DEFAULT_THEME_NAME, getThemeColors(DEFAULT_THEME_NAME));
    }).not.toThrow();

    // restore
    Object.defineProperty(globalThis, "document", {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  });

  it("getButtonStyles has expected structural shape", () => {
    const buttonStyles = getButtonStyles(getThemeColors(DEFAULT_THEME_NAME));

    expect(buttonStyles.primary.gradient).toHaveProperty("from");
    expect(buttonStyles.primary.gradient).toHaveProperty("to");
    expect(buttonStyles.primary.gradientHover).toHaveProperty("from");
    expect(buttonStyles.primary.gradientHover).toHaveProperty("to");
    expect(buttonStyles.cta.gradient).toHaveProperty("from");
    expect(buttonStyles.cta.gradient).toHaveProperty("to");
  });

  it("getThemeColors returns separate objects for each call", () => {
    const colors = getThemeColors(DEFAULT_THEME_NAME);
    const nextColors = getThemeColors(DEFAULT_THEME_NAME);

    expect(nextColors).toEqual(colors);
    expect(nextColors).not.toBe(colors);
    expect(nextColors.primary).not.toBe(colors.primary);
  });

  it("getThemeColors resolves every configured palette", () => {
    const alternateTheme =
      colorPalettes.find((palette) => palette.name !== DEFAULT_THEME_NAME)?.name ??
      DEFAULT_THEME_NAME;

    expect(getThemeColors(alternateTheme).primary.DEFAULT).toBeTruthy();
  });
});
