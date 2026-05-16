import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  getSpacedRepetitionBucket,
  getSpacedRepetitionCurrentStep,
  getSpacedRepetitionDueAt,
  SPACED_REPETITION_INTERVAL_DAYS,
} from "@/lib/spacedRepetition";

describe("spacedRepetition helpers", () => {
  it("makes the first repetition due from goal completion time", () => {
    const completedAt = 1_000_000;
    const dueAt = getSpacedRepetitionDueAt({
      completedSteps: [],
      goalCompletedAt: completedAt,
    });

    expect(dueAt).toBe(completedAt + SPACED_REPETITION_INTERVAL_DAYS[0] * DAY_MS);
  });

  it("makes later repetitions due from the previous SR completion time", () => {
    const goalCompletedAt = 1_000_000;
    const previousCompletedAt = goalCompletedAt + 10 * DAY_MS;

    const dueAt = getSpacedRepetitionDueAt({
      goalCompletedAt,
      completedSteps: [
        {
          completedAt: previousCompletedAt,
        },
      ],
    });

    expect(getSpacedRepetitionCurrentStep([{ completedAt: previousCompletedAt }])).toBe(2);
    expect(dueAt).toBe(previousCompletedAt + SPACED_REPETITION_INTERVAL_DAYS[1] * DAY_MS);
  });

  it("returns no current step after the schedule is complete", () => {
    const completedSteps = SPACED_REPETITION_INTERVAL_DAYS.map((_, index) => ({
      completedAt: (index + 1) * DAY_MS,
    }));

    expect(getSpacedRepetitionCurrentStep(completedSteps)).toBeNull();
    expect(getSpacedRepetitionDueAt({ completedSteps, goalCompletedAt: 1 })).toBeNull();
  });

  it("buckets ready, coming up, and done states", () => {
    const now = 100 * DAY_MS;

    expect(
      getSpacedRepetitionBucket(
        { completedSteps: [], goalCompletedAt: now - 3 * DAY_MS },
        now
      )
    ).toBe("ready");

    expect(
      getSpacedRepetitionBucket(
        { completedSteps: [], goalCompletedAt: now - 2 * DAY_MS },
        now
      )
    ).toBe("coming_up");

    expect(
      getSpacedRepetitionBucket(
        {
          goalCompletedAt: now - 500 * DAY_MS,
          completedSteps: SPACED_REPETITION_INTERVAL_DAYS.map((_, index) => ({
            completedAt: now - (6 - index) * DAY_MS,
          })),
        },
        now
      )
    ).toBe("done");
  });
});
