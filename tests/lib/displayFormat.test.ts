import { describe, expect, it } from "vitest";
import { formatDateInputValue, formatDuration, formatScore } from "@/lib/displayFormat";

describe("displayFormat", () => {
  it("formatDuration returns MM:SS or H:MM:SS", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("formatScore keeps integers and gives one decimal otherwise", () => {
    expect(formatScore(7)).toBe(7);
    expect(formatScore(7.25)).toBe("7.3");
  });

  it("formatDateInputValue produces a local YYYY-MM-DD string or empty", () => {
    const date = new Date(2026, 4, 9); // local May 9, 2026
    expect(formatDateInputValue(date.getTime())).toBe("2026-05-09");
    expect(formatDateInputValue(undefined)).toBe("");
  });
});
