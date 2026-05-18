import "@testing-library/jest-dom/vitest";

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - testing global polyfill
global.ResizeObserver = ResizeObserver;

globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__ = true;
