import { describe, expect, it } from "vitest";
import { canToggleGoalThemeCompletion } from "@/app/goals/helpers";

describe("goals helpers", () => {
  it("allows theme completion during normal draft planning", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "draft" })).toBe(true);
  });

  it("allows theme completion during lock_proposed planning", () => {
    expect(
      canToggleGoalThemeCompletion({
        effectiveStatus: "draft",
      })
    ).toBe(true);
  });

  it("keeps theme completion unavailable after the goal is completed", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "completed" })).toBe(false);
  });
});
