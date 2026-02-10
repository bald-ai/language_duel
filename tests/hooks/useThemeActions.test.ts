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

describe("useThemeActions create guard", () => {
  beforeEach(() => {
    useMutationMock.mockReset();
  });

  it("rejects a second create call while first one is in-flight", async () => {
    let resolveCreate: ((value: Id<"themes">) => void) | null = null;
    const createMutation = vi.fn(
      () =>
        new Promise<Id<"themes">>((resolve) => {
          resolveCreate = resolve;
        })
    );
    const updateMutation = vi.fn();
    const deleteMutation = vi.fn();
    const duplicateMutation = vi.fn();

    useMutationMock
      .mockReturnValueOnce(createMutation)
      .mockReturnValueOnce(updateMutation)
      .mockReturnValueOnce(deleteMutation)
      .mockReturnValueOnce(duplicateMutation);

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

    expect(createMutation).toHaveBeenCalledTimes(1);

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
