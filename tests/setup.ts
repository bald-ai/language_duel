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

// Default appearance consumers to CSS variables; provider tests opt into the real context.
vi.mock("@/app/components/AppearanceProvider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/components/AppearanceProvider")>();
  const { cssVarColors } = await import(
    "@/app/components/themeCssVars"
  );
  return {
    ...actual,
    useAppearanceColors: () => cssVarColors,
  };
});
