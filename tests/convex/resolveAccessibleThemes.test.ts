import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const loadThemeWithViewerAccessMock = vi.hoisted(() =>
  vi.fn<(ctx: unknown, userId: string, themeId: string) => Promise<Doc<"themes"> | null>>()
);

vi.mock("@/convex/helpers/themeAccess", () => ({
  loadThemeWithViewerAccess: loadThemeWithViewerAccessMock,
}));

import { resolveAccessibleThemes } from "@/convex/helpers/resolveAccessibleThemes";

function themeDoc(id: string): Doc<"themes"> {
  return {
    _id: id as Id<"themes">,
    _creationTime: 1,
    name: id,
    createdAt: 1,
    words: [],
  } as unknown as Doc<"themes">;
}

describe("resolveAccessibleThemes", () => {
  it("rejects empty input with INVALID_INPUT", async () => {
    await expect(
      resolveAccessibleThemes({} as never, "user_1" as Id<"users">, [])
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });

  it("rejects when any theme is inaccessible with NOT_FOUND", async () => {
    loadThemeWithViewerAccessMock.mockImplementation(async (_, __, themeId) =>
      themeId === "theme_2" ? null : themeDoc(themeId as string)
    );
    await expect(
      resolveAccessibleThemes({} as never, "user_1" as Id<"users">, [
        "theme_1" as Id<"themes">,
        "theme_2" as Id<"themes">,
      ])
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("dedupes input and returns non-null array on success", async () => {
    loadThemeWithViewerAccessMock.mockImplementation(async (_, __, themeId) =>
      themeDoc(themeId as string)
    );
    const result = await resolveAccessibleThemes(
      {} as never,
      "user_1" as Id<"users">,
      [
        "theme_1" as Id<"themes">,
        "theme_2" as Id<"themes">,
        "theme_1" as Id<"themes">,
      ]
    );
    expect(result).toHaveLength(2);
    expect(result.map((theme) => theme._id)).toEqual(["theme_1", "theme_2"]);
  });
});
