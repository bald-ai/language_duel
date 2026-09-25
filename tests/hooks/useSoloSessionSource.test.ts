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

  it("accepts a sentence item in a persisted spaced-repetition session", () => {
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

    expect(result.current.status).toBe("ready");
    expect(result.current.spacedRepetitionStep).toBe(1);
    expect(result.current.sessionItems).toHaveLength(1);
    expect(result.current.sessionItems[0].kind).toBe("sentence");
  });
});

const wordTheme: SessionThemeInput = {
  _id: "theme_2" as Id<"themes">,
  name: "Greetings",
  contentType: "word",
  words: [{ word: "hello", answer: "hola", wrongAnswers: ["adios"] }],
};

function sourceWith(data: Record<string, unknown>) {
  useQueryMock.mockImplementation((query: string, args: unknown) => args === "skip" ? undefined : data[query]);
  return renderHook(() => useSoloSessionSource({ loadingMessage: "Preparing lesson" }));
}

describe("solo source entry gates and query precedence", () => {
  it("requires a selection even while the theme list loads", () => {
    const { result } = sourceWith({});
    expect(result.current).toMatchObject({ status: "invalid", statusMessage: "No theme selected", isSessionReady: false });
  });

  it.each([
    [undefined, "loading", "Preparing lesson"],
    [[], "invalid", "Theme not found"],
  ])("handles an ad-hoc list of %j", (themes, status, statusMessage) => {
    searchParams = { themeId: "theme_1" };
    const { result } = sourceWith({ getThemes: themes });
    expect(result.current).toMatchObject({ status, statusMessage, isSessionReady: false, sessionItems: [] });
  });

  it("retains requested order for mixed content and filters empty theme ids", () => {
    searchParams = { themeId: "ignored", themeIds: ",theme_2,,theme_1,", confidence: "1,2", duration: "30", returnTo: "/goals", returnLabel: "My goals" };
    const { result } = sourceWith({ getThemes: [sentenceTheme, wordTheme] });
    expect(result.current).toMatchObject({ status: "ready", statusMessage: "", isSessionReady: true,
      requestedThemeIds: ["theme_2", "theme_1"], returnTo: "/goals", returnLabel: "My goals", confidenceParam: "1,2", durationParam: "30" });
    expect(result.current.sessionItems.map(item => item.kind)).toEqual(["word", "sentence"]);
    expect(result.current.sessionItems[0]).toMatchObject({ word: "hello", answer: "hola", themeName: "Greetings" });
    expect(result.current.themeSummary).toBe("2 themes");
    expect(useQueryMock.mock.calls).toContainEqual(["getThemes", {}]);
  });

  it("rejects partial theme resolution and sanitizes external return routes", () => {
    searchParams = { themeIds: "theme_1,missing", returnTo: "https://outside.test", returnLabel: "" };
    const { result } = sourceWith({ getThemes: [sentenceTheme] });
    expect(result.current).toMatchObject({ status: "invalid", statusMessage: "Theme not found", isSessionReady: false, returnTo: "/", returnLabel: "Back to Home" });
  });

  it.each(["soloPracticeSessionId", "weeklyGoalId"])("waits and reports deletion for %s", (key) => {
    searchParams = { [key]: "saved", themeId: "theme_1" };
    const query = key === "soloPracticeSessionId" ? "getBossPracticeSession" : "getWeeklyGoalPracticeThemes";
    const data: Record<string, unknown> = {};
    const { result, rerender } = sourceWith(data);
    expect(result.current).toMatchObject({ status: "loading", statusMessage: "Preparing lesson", isSessionReady: false });
    data[query] = null;
    rerender();
    expect(result.current).toMatchObject({ status: "unavailable", statusMessage: "This practice session is no longer available", isSessionReady: false });
    expect(useQueryMock.mock.calls).toContainEqual(["getThemes", "skip"]);
  });

  it("uses saved session ahead of weekly goal and ad-hoc selections", () => {
    searchParams = { soloPracticeSessionId: "session", weeklyGoalId: "goal", themeId: "theme_2" };
    const { result } = sourceWith({ getBossPracticeSession: { sourceType: "boss", sessionItems: [sentenceSessionItem], themeSummary: "Saved deck" } });
    expect(result.current).toMatchObject({ status: "ready", isSessionReady: true, themeSummary: "Saved deck", sessionItems: [sentenceSessionItem], isBossPractice: true, spacedRepetitionStep: null });
    expect(useQueryMock.mock.calls).toContainEqual(["getBossPracticeSession", { soloPracticeSessionId: "session" }]);
    expect(useQueryMock.mock.calls).toContainEqual(["getWeeklyGoalPracticeThemes", "skip"]);
  });

  it("shows weekly-goal validation failures verbatim", () => {
    searchParams = { weeklyGoalId: "goal" };
    const { result } = sourceWith({ getWeeklyGoalPracticeThemes: { ok: false, message: "No accessible themes" } });
    expect(result.current).toMatchObject({ status: "invalid", statusMessage: "No accessible themes", isSessionReady: false });
    expect(useQueryMock.mock.calls).toContainEqual(["getWeeklyGoalPracticeThemes", { weeklyGoalId: "goal", themeIds: undefined }]);
  });

  it("passes optional weekly selection and preserves empty-deck readiness semantics", () => {
    searchParams = { weeklyGoalId: "goal", themeIds: "theme_1,theme_2" };
    const data = { getWeeklyGoalPracticeThemes: { ok: true, themes: [] as SessionThemeInput[] } };
    const { result, rerender } = sourceWith(data);
    expect(result.current).toMatchObject({ status: "ready", isSessionReady: false, sessionItems: [] });
    expect(useQueryMock.mock.calls).toContainEqual(["getWeeklyGoalPracticeThemes", { weeklyGoalId: "goal", themeIds: ["theme_1", "theme_2"] }]);
    data.getWeeklyGoalPracticeThemes = { ok: true, themes: [wordTheme] };
    rerender();
    expect(result.current).toMatchObject({ status: "ready", isSessionReady: true });
    expect(result.current.sessionItems[0]).toMatchObject({ kind: "word", answer: "hola" });
  });

  it.each([undefined, 0, 3])("preserves repetition step %s including zero", (step) => {
    searchParams = { soloPracticeSessionId: "session" };
    const { result } = sourceWith({ getBossPracticeSession: { sourceType: "spaced_repetition", spacedRepetitionStep: step, sessionItems: [], themeSummary: "" } });
    expect(result.current).toMatchObject({ spacedRepetitionStep: step ?? null, isBossPractice: false, isSessionReady: true, themeSummary: "", sessionItems: [] });
  });
});
