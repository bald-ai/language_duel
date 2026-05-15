import { describe, expect, it } from "vitest";
import {
  applyTheme,
  DEFAULT_THEME_NAME,
  getActiveThemeName,
  isThemeName,
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

  it("themeOptions align with palettes", () => {
    expect(themeOptions).toHaveLength(colorPalettes.length);
    expect(themeOptions[0].name).toBe(colorPalettes[0].name);
  });

  it("applyTheme falls back to default for unknown names", () => {
    const name = applyTheme("not-a-theme" as never);
    expect(name).toBe(DEFAULT_THEME_NAME);
    expect(getActiveThemeName()).toBe(DEFAULT_THEME_NAME);
  });

  it("applyTheme sets the data-theme attribute and updates active theme name", () => {
    applyTheme(DEFAULT_THEME_NAME);

    const root = document.documentElement;
    expect(root.getAttribute("data-theme")).toBe(DEFAULT_THEME_NAME);
    expect(getActiveThemeName()).toBe(DEFAULT_THEME_NAME);
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

  it("semanticColors contains expected role keys", () => {
    expect(Object.keys(semanticColors)).toEqual(
      expect.arrayContaining(["badge", "badgeBorder", "buttonPrimary", "buttonCta", "accent", "pageBg", "cardBg"])
    );
  });

  it("buttonStyles has expected structural shape", () => {
    expect(buttonStyles.primary.gradient).toHaveProperty("from");
    expect(buttonStyles.primary.gradient).toHaveProperty("to");
    expect(buttonStyles.primary.gradientHover).toHaveProperty("from");
    expect(buttonStyles.primary.gradientHover).toHaveProperty("to");
    expect(buttonStyles.cta.gradient).toHaveProperty("from");
    expect(buttonStyles.cta.gradient).toHaveProperty("to");
  });

  it("semanticColors keys remain populated after switching themes", () => {
    const alternateTheme =
      colorPalettes.find((palette) => palette.name !== DEFAULT_THEME_NAME)?.name ??
      DEFAULT_THEME_NAME;

    applyTheme(alternateTheme);

    expect(semanticColors.badge).toBeTruthy();
    expect(semanticColors.badgeBorder).toBeTruthy();
    expect(semanticColors.buttonPrimary).toBeTruthy();
    expect(semanticColors.buttonCta).toBeTruthy();
    expect(semanticColors.accent).toBeTruthy();
    expect(semanticColors.pageBg).toBeTruthy();
    expect(semanticColors.cardBg).toBeTruthy();
  });
});
