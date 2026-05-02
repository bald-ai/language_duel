import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useThemeActions } from "@/app/themes/hooks/useThemeActions";

const useMutationMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (...args: unknown[]) => useMutationMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    themes: {
      createTheme: "createTheme",
      updateTheme: "updateTheme",
      deleteTheme: "deleteTheme",
      duplicateTheme: "duplicateTheme",
    },
  },
}));

function standardMutations() {
  return {
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
    duplicateTheme: vi.fn(),
  };
}

function mockMutationsByArg(mocks: Record<string, ReturnType<typeof vi.fn>>) {
  useMutationMock.mockImplementation((arg: string) => mocks[arg] ?? vi.fn());
}

describe("useThemeActions", () => {
  beforeEach(() => {
    useMutationMock.mockReset();
  });

  describe("create", () => {
    it("rejects a second create call while first one is in-flight", async () => {
      let resolveCreate: ((value: Id<"themes">) => void) | null = null;
      const mocks = standardMutations();
      mocks.createTheme.mockImplementation(
        () =>
          new Promise<Id<"themes">>((resolve) => {
            resolveCreate = resolve;
          })
      );
      mockMutationsByArg({
        createTheme: mocks.createTheme,
        updateTheme: mocks.updateTheme,
        deleteTheme: mocks.deleteTheme,
        duplicateTheme: mocks.duplicateTheme,
      });

      const { result } = renderHook(() => useThemeActions());

      let firstCall!: Promise<{ ok: boolean; error?: string; themeId?: Id<"themes"> }>;
      let secondCall!: Promise<{ ok: boolean; error?: string; themeId?: Id<"themes"> }>;

      await act(async () => {
        firstCall = result.current.create(
          "ANIMALS",
          "Generated theme for animals",
          [{ word: "cat", answer: "kocka", wrongAnswers: ["strom", "auto", "more"] }],
          "nouns",
          "save-req-1"
        );
        secondCall = result.current.create(
          "ANIMALS",
          "Generated theme for animals",
          [{ word: "cat", answer: "kocka", wrongAnswers: ["strom", "auto", "more"] }],
          "nouns",
          "save-req-1"
        );
        await Promise.resolve();
      });

      expect(mocks.createTheme).toHaveBeenCalledTimes(1);

      const secondResult = await secondCall;
      expect(secondResult).toEqual({ ok: false, error: "Already creating" });

      await act(async () => {
        resolveCreate?.("theme_1" as Id<"themes">);
        await Promise.resolve();
      });

      const firstResult = await firstCall;
      expect(firstResult).toEqual({ ok: true, themeId: "theme_1" });
    });
  });

  describe("update", () => {
    it("rejects a second update call while first one is in-flight and uppercases name", async () => {
      let resolveUpdate: (() => void) | null = null;
      const mocks = standardMutations();
      mocks.updateTheme.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveUpdate = resolve;
          })
      );
      mockMutationsByArg({
        createTheme: mocks.createTheme,
        updateTheme: mocks.updateTheme,
        deleteTheme: mocks.deleteTheme,
        duplicateTheme: mocks.duplicateTheme,
      });

      const { result } = renderHook(() => useThemeActions());
      const words = [{ word: "cat", answer: "kocka", wrongAnswers: ["strom", "auto", "more"] }];

      let firstCall!: Promise<{ ok: boolean; error?: string }>;
      let secondCall!: Promise<{ ok: boolean; error?: string }>;

      await act(async () => {
        firstCall = result.current.update("theme_1" as Id<"themes">, "animals", words);
        secondCall = result.current.update("theme_1" as Id<"themes">, "animals", words);
        await Promise.resolve();
      });

      expect(mocks.updateTheme).toHaveBeenCalledTimes(1);
      expect(mocks.updateTheme).toHaveBeenCalledWith({
        themeId: "theme_1",
        name: "ANIMALS",
        words,
      });

      const secondResult = await secondCall;
      expect(secondResult).toEqual({ ok: false, error: "Already saving" });

      await act(async () => {
        resolveUpdate?.();
        await Promise.resolve();
      });

      const firstResult = await firstCall;
      expect(firstResult).toEqual({ ok: true });
    });
  });

  describe("remove", () => {
    it("rejects duplicate remove calls while first remove is in-flight", async () => {
      let resolveDelete: (() => void) | null = null;
      const mocks = standardMutations();
      mocks.deleteTheme.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          })
      );
      mockMutationsByArg({
        createTheme: mocks.createTheme,
        updateTheme: mocks.updateTheme,
        deleteTheme: mocks.deleteTheme,
        duplicateTheme: mocks.duplicateTheme,
      });

      const { result } = renderHook(() => useThemeActions());

      let removeFirst!: Promise<{ ok: boolean; error?: string }>;
      let removeSecond!: Promise<{ ok: boolean; error?: string }>;

      await act(async () => {
        removeFirst = result.current.remove("theme_1" as Id<"themes">);
        await Promise.resolve();
      });

      await act(async () => {
        removeSecond = result.current.remove("theme_1" as Id<"themes">);
        await Promise.resolve();
      });

      expect(mocks.deleteTheme).toHaveBeenCalledTimes(1);
      expect(await removeSecond).toEqual({ ok: false, error: "Already deleting" });

      await act(async () => {
        resolveDelete?.();
        await Promise.resolve();
      });

      expect(await removeFirst).toEqual({ ok: true });
    });
  });

  describe("duplicate", () => {
    it("rejects duplicate duplicate() calls while first duplicate is in-flight", async () => {
      let resolveDuplicate: (() => void) | null = null;
      const mocks = standardMutations();
      mocks.duplicateTheme.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDuplicate = resolve;
          })
      );
      mockMutationsByArg({
        createTheme: mocks.createTheme,
        updateTheme: mocks.updateTheme,
        deleteTheme: mocks.deleteTheme,
        duplicateTheme: mocks.duplicateTheme,
      });

      const { result } = renderHook(() => useThemeActions());

      let duplicateFirst!: Promise<{ ok: boolean; error?: string }>;
      let duplicateSecond!: Promise<{ ok: boolean; error?: string }>;

      await act(async () => {
        duplicateFirst = result.current.duplicate("theme_2" as Id<"themes">);
        await Promise.resolve();
      });

      await act(async () => {
        duplicateSecond = result.current.duplicate("theme_2" as Id<"themes">);
        await Promise.resolve();
      });

      expect(mocks.duplicateTheme).toHaveBeenCalledTimes(1);
      expect(await duplicateSecond).toEqual({ ok: false, error: "Already duplicating" });

      await act(async () => {
        resolveDuplicate?.();
        await Promise.resolve();
      });

      expect(await duplicateFirst).toEqual({ ok: true });
    });
  });
});
