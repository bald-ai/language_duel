import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AppearanceProvider,
  useAppearanceColors,
  useColorSet,
} from "@/app/components/AppearanceProvider";
import { DEFAULT_THEME_NAME } from "@/lib/theme";

vi.mock("@/app/components/UserPreferencesProvider", () => ({
  useUserPreferences: () => ({
    userPreferences: undefined,
    isLoading: false,
    updateColorSet: vi.fn(),
  }),
}));

describe("AppearanceProvider", () => {
  it("fails loudly when appearance hooks are used outside the provider", () => {
    const originalFallback = globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__;
    globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__ = false;

    try {
      expect(() => renderHook(() => useAppearanceColors())).toThrow(
        "useAppearanceColors must be used within AppearanceProvider"
      );
    } finally {
      globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__ = originalFallback;
    }
  });

  it("provides selected theme state and derived colors", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AppearanceProvider>{children}</AppearanceProvider>
    );

    const { result } = renderHook(() => useColorSet(), { wrapper });

    await waitFor(() => expect(result.current.colorSetName).toBe(DEFAULT_THEME_NAME));

    expect(result.current.colorSetName).toBe(DEFAULT_THEME_NAME);
    expect(result.current.colors.primary.DEFAULT).toBeTruthy();
    expect(result.current.buttonStyles.primary.gradient.from).toBe(
      result.current.colors.primary.DEFAULT
    );
  });
});
