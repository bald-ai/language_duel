import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_THEME_NAME } from "@/lib/appearance";

vi.mock("@/app/components/UserPreferencesProvider", () => ({
  useUserPreferences: () => ({
    userPreferences: undefined,
    isLoading: false,
    updateColorSet: vi.fn(),
  }),
}));

// This suite exercises the real provider + hooks, so opt out of the global
// appearance-hook mock in tests/setup.ts and use the actual implementation.
const { AppearanceProvider, useAppearanceColors, useColorSet } =
  await vi.importActual<typeof import("@/app/components/AppearanceProvider")>(
    "@/app/components/AppearanceProvider"
  );

describe("AppearanceProvider", () => {
  it("fails loudly when appearance hooks are used outside the provider", () => {
    expect(() => renderHook(() => useAppearanceColors())).toThrow(
      "useAppearanceColors must be used within AppearanceProvider"
    );
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
