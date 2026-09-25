import { renderHook } from "@testing-library/react";
import { ReadonlyURLSearchParams } from "next/navigation";
import { describe, expect, it } from "vitest";
import { useSoloDeepLink } from "@/hooks/useSoloDeepLink";

describe("solo practice deep links", () => {
  it.each([
    ["", undefined, undefined, null],
    ["openSolo=false&themeId=a&soloMode=practice_only", undefined, undefined, null],
    ["openSolo=true", [], undefined, ":"],
    ["openSolo=true&themeId=a", ["a"], undefined, "a:"],
    ["openSolo=true&themeIds=a,,b,&themeId=c&soloMode=practice_only", ["a", "b"], "practice_only", "a,,b,:practice_only"],
    ["openSolo=true&themeIds=&themeId=c&soloMode=learn", ["c"], undefined, ":learn"],
    ["openSolo=true&themeIds=a,b&soloMode=learn", ["a", "b"], undefined, "a,b:learn"],
  ])("parses %s", (query, soloThemeIds, soloInitialMode, soloDeepLinkKey) => {
    const { result } = renderHook(() => useSoloDeepLink(new ReadonlyURLSearchParams(query)));
    expect(result.current).toEqual({ soloThemeIds, soloInitialMode, soloDeepLinkKey });
  });
  it("retains theme selection identity until the URL selection changes", () => {
    const { result, rerender } = renderHook(({ query }) => useSoloDeepLink(new ReadonlyURLSearchParams(query)), { initialProps: { query: "openSolo=true&themeIds=a,b" } });
    const ids = result.current.soloThemeIds;
    rerender({ query: "openSolo=true&themeIds=a,b&unrelated=1" });
    expect(result.current.soloThemeIds).toBe(ids);
    rerender({ query: "openSolo=true&themeId=c" });
    expect(result.current.soloThemeIds).toEqual(["c"]);
    rerender({ query: "" });
    expect(result.current.soloDeepLinkKey).toBeNull(); expect(result.current.soloThemeIds).toBeUndefined();
  });
});
