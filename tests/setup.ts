import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - testing global polyfill
global.ResizeObserver = ResizeObserver;

// Components across the suite read appearance through useAppearanceColors /
// useAppearanceButtonStyles. Rather than wrap every render in a real
// AppearanceProvider (which would also drag in UserPreferencesProvider + Convex),
// default these two consumer hooks to the CSS-var colors for all tests. This keeps
// the production hooks free of any test-only fallback branch. The provider's own
// test opts out via vi.importActual to exercise the real provider + throw path.
vi.mock("@/app/components/AppearanceProvider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/components/AppearanceProvider")>();
  const { cssVarColors, cssVarButtonStyles } = await import(
    "@/app/components/themeCssVars"
  );
  return {
    ...actual,
    useAppearanceColors: () => cssVarColors,
    useAppearanceButtonStyles: () => cssVarButtonStyles,
  };
});
