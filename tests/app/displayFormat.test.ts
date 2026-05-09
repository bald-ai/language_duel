import { describe, expect, it } from "vitest";
import { formatDuration } from "@/app/utils/displayFormat";

describe("displayFormat", () => {
  it("formatDuration returns MM:SS or H:MM:SS", () => {
    expect(formatDuration(59)).toBe("0:59");
    expect(formatDuration(60)).toBe("1:00");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
