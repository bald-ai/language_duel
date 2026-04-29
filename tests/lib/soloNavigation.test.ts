import { describe, expect, it } from "vitest";
import { buildSoloSearchParams, buildSoloUrl, sanitizeSoloReturnTo } from "@/lib/soloNavigation";
import type { Id } from "@/convex/_generated/dataModel";

describe("soloNavigation", () => {
  it("prefers challenge source over weekly-goal and normal themes", () => {
    const params = buildSoloSearchParams({
      challengeId: "challenge_1" as Id<"challenges">,
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      themeIds: ["theme_1" as Id<"themes">],
    });

    expect(params.get("challengeId")).toBe("challenge_1");
    expect(params.get("weeklyGoalId")).toBeNull();
    expect(params.get("themeIds")).toBeNull();
  });

  it("preserves weekly-goal source, selected themes, return target, and confidence", () => {
    const url = buildSoloUrl("session_1", "challenge_only", {
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      themeIds: ["theme_2" as Id<"themes">, "theme_1" as Id<"themes">],
      returnTo: "/goals",
      returnLabel: "Back to weekly goal",
      confidence: "{\"0\":2}",
    });

    expect(url).toBe(
      "/solo/session_1?weeklyGoalId=goal_1&themeIds=theme_2%2Ctheme_1&confidence=%7B%220%22%3A2%7D&returnTo=%2Fgoals&returnLabel=Back+to+weekly+goal"
    );
  });

  it("sanitizes unsafe return targets", () => {
    expect(sanitizeSoloReturnTo("https://example.com")).toBe("/");
    expect(sanitizeSoloReturnTo("//evil.test")).toBe("/");
    expect(sanitizeSoloReturnTo("/goals")).toBe("/goals");
  });
});
