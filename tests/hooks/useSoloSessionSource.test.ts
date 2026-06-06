import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSoloSessionSource } from "@/app/solo/hooks/useSoloSessionSource";
import type { SessionItem, SessionThemeInput } from "@/lib/sessionItems";
import type { Id } from "@/convex/_generated/dataModel";

// Per-test search params. The hook only ever calls `.get(key)`.
let searchParams: Record<string, string | null> = {};
const useQueryMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParams[key] ?? null,
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getBossPracticeSession: "getBossPracticeSession",
      getWeeklyGoalPracticeThemes: "getWeeklyGoalPracticeThemes",
    },
    themes: {
      getThemes: "getThemes",
    },
  },
}));

const sentenceTheme: SessionThemeInput = {
  _id: "theme_1" as Id<"themes">,
  name: "Basics",
  contentType: "sentence",
  sentenceRounds: [
    {
      englishPrompt: "I eat",
      spanishSentence: "Yo como",
      wordMeanings: ["I", "eat"],
      freeWordPositions: [],
      distractors: ["bebo", "leo", "duermo"],
    },
  ],
};

const sentenceSessionItem: SessionItem = {
  kind: "sentence",
  englishPrompt: "I eat",
  spanishSentence: "Yo como",
  wordMeanings: ["I", "eat"],
  freeWordPositions: [],
  distractors: ["bebo", "leo", "duermo"],
  themeId: "theme_1" as Id<"themes">,
  themeName: "Basics",
};

beforeEach(() => {
  searchParams = {};
  useQueryMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSoloSessionSource sentence support", () => {
  it("accepts a sentence theme in weekly-goal practice", () => {
    searchParams = { weeklyGoalId: "goal_1" };
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getWeeklyGoalPracticeThemes") {
        return { ok: true, themes: [sentenceTheme] };
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useSoloSessionSource({ loadingMessage: "Loading..." })
    );

    expect(result.current.status).toBe("ready");
    expect(result.current.sessionItems).toHaveLength(1);
    expect(result.current.sessionItems[0].kind).toBe("sentence");
  });

  it("accepts a sentence item in a persisted boss session", () => {
    searchParams = { soloPracticeSessionId: "session_1" };
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getBossPracticeSession") {
        return {
          sessionItems: [sentenceSessionItem],
          themeSummary: "Basics",
          sourceType: "boss",
        };
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useSoloSessionSource({ loadingMessage: "Loading..." })
    );

    expect(result.current.status).toBe("ready");
    expect(result.current.isBossPractice).toBe(true);
    expect(result.current.sessionItems).toHaveLength(1);
    expect(result.current.sessionItems[0].kind).toBe("sentence");
  });

  it("rejects a sentence item that leaks into a persisted spaced-repetition session", () => {
    searchParams = { soloPracticeSessionId: "session_1" };
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getBossPracticeSession") {
        return {
          sessionItems: [sentenceSessionItem],
          themeSummary: "Basics",
          sourceType: "spaced_repetition",
          spacedRepetitionStep: 1,
        };
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useSoloSessionSource({ loadingMessage: "Loading..." })
    );

    expect(result.current.status).toBe("invalid");
    expect(result.current.statusMessage).toBe(
      "Sentence themes aren't available in spaced-repetition practice yet."
    );
    expect(result.current.sessionItems).toHaveLength(0);
  });
});
