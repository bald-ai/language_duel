import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOLO_STUDY_DURATION,
  getSoloLearnTimerLabel,
  getSoloLearnTimerTestIdSuffix,
  isSoloStudyTimerInfinite,
  SOLO_INFINITE_STUDY_SECONDS,
  SOLO_TIMER_OPTIONS,
} from "@/lib/soloLearnTimer";
import { SOLO_INFINITE_STUDY_SECONDS as BackendSoloInfinite } from "@/convex/constants";

describe("solo learn timer", () => {
  it("keeps backend and client infinite sentinel in sync", () => {
    expect(BackendSoloInfinite).toBe(SOLO_INFINITE_STUDY_SECONDS);
  });

  it("exposes 10, 15 minutes and infinite (sentinel), default 10 min", () => {
    expect(SOLO_TIMER_OPTIONS).toEqual([600, 900, SOLO_INFINITE_STUDY_SECONDS]);
    expect(DEFAULT_SOLO_STUDY_DURATION).toBe(600);
  });

  it("isSoloStudyTimerInfinite matches sentinel only", () => {
    expect(isSoloStudyTimerInfinite(SOLO_INFINITE_STUDY_SECONDS)).toBe(true);
    expect(isSoloStudyTimerInfinite(600)).toBe(false);
    expect(isSoloStudyTimerInfinite(900)).toBe(false);
  });

  it("getSoloLearnTimerLabel uses infinity symbol for the sentinel", () => {
    expect(getSoloLearnTimerLabel(SOLO_INFINITE_STUDY_SECONDS)).toBe("∞");
    expect(getSoloLearnTimerLabel(600)).toBe("10:00");
    expect(getSoloLearnTimerLabel(900)).toBe("15:00");
  });

  it("getSoloLearnTimerTestIdSuffix maps sentinel to 'infinite'", () => {
    expect(getSoloLearnTimerTestIdSuffix(600)).toBe("600");
    expect(getSoloLearnTimerTestIdSuffix(900)).toBe("900");
    expect(getSoloLearnTimerTestIdSuffix(SOLO_INFINITE_STUDY_SECONDS)).toBe("infinite");
  });
});
