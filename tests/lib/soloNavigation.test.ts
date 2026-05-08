import { describe, expect, it } from "vitest";
import { buildSoloSearchParams, buildSoloUrl, sanitizeSoloReturnTo } from "@/lib/soloNavigation";
import type { Id } from "@/convex/_generated/dataModel";

describe("soloNavigation", () => {
  it("prefers persisted solo-practice source over weekly-goal and normal themes", () => {
    const params = buildSoloSearchParams({
      soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      themeIds: ["theme_1" as Id<"themes">],
    });

    expect(params.get("soloPracticeSessionId")).toBe("solo_practice_1");
    expect(params.get("weeklyGoalId")).toBeNull();
    expect(params.get("themeIds")).toBeNull();
  });

  it("preserves weekly-goal source, selected themes, return target, and confidence", () => {
    const url = buildSoloUrl("session_1", "practice_only", {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      themeIds: ["theme_2" as Id<"themes">, "theme_1" as Id<"themes">],
      returnTo: "/goals",
      returnLabel: "Back to weekly goal",
      confidence: "{\"0\":2}",
    });

    const urlObj = new URL(url, "http://test.com");
    expect(urlObj.pathname).toBe("/solo/session_1");
    expect(urlObj.searchParams.get("weeklyGoalId")).toBe("goal_1");
    expect(urlObj.searchParams.get("themeIds")).toBe("theme_2,theme_1");
    expect(urlObj.searchParams.get("confidence")).toBe('{"0":2}');
    expect(urlObj.searchParams.get("returnTo")).toBe("/goals");
    expect(urlObj.searchParams.get("returnLabel")).toBe("Back to weekly goal");
  });

  it("does not duplicate persisted solo-practice ids in the path", () => {
    const url = buildSoloUrl("solo_practice_1", "learn_practice", {
      soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
      returnTo: "/repetition",
    });

    const urlObj = new URL(url, "http://test.com");
    expect(urlObj.pathname).toBe("/solo/learn/session");
    expect(urlObj.searchParams.get("soloPracticeSessionId")).toBe("solo_practice_1");
  });

  it("sanitizes unsafe return targets", () => {
    expect(sanitizeSoloReturnTo("https://example.com")).toBe("/");
    expect(sanitizeSoloReturnTo("//evil.test")).toBe("/");
    expect(sanitizeSoloReturnTo("/goals")).toBe("/goals");
  });
});
