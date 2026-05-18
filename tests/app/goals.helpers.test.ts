import { describe, expect, it } from "vitest";
import { canToggleGoalThemeCompletion } from "@/lib/weeklyGoals";

describe("goals helpers", () => {
  it("allows theme completion during draft planning", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "draft" })).toBe(true);
  });

  it("allows theme completion when the goal is locked", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "locked" })).toBe(true);
  });

  it("keeps theme completion unavailable after the goal is completed", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "completed" })).toBe(false);
  });

  it("keeps theme completion unavailable when effective status is undefined", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: undefined })).toBe(false);
  });
});
