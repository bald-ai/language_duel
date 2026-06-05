import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LearnPhasePage from "@/app/solo/learn/[sessionId]/page";

const pushMock = vi.fn();
const useQueryMock = vi.fn();
const playTTSMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ sessionId: "session_1" }),
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => {
      const params: Record<string, string> = {
        themeId: "theme_1",
        duration: "600",
      };
      return params[key] ?? null;
    },
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

vi.mock("@/app/components/ThemedPage", () => ({
  ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/useTTS", () => ({
  useTTS: () => ({
    playingWordKey: null,
    playTTS: playTTSMock,
  }),
}));

const themes = [
  {
    _id: "theme_1",
    name: "Basics",
    contentType: "word",
    words: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "casa", "mesa"],
      },
      {
        word: "house",
        answer: "casa",
        wrongAnswers: ["gato", "perro", "mesa"],
      },
    ],
  },
];

const sentenceThemes = [
  {
    _id: "theme_1",
    name: "Sentences",
    contentType: "sentence",
    sentenceRounds: [
      {
        englishPrompt: "I drink water",
        spanishSentence: "Yo bebo agua",
        wordMeanings: ["I", "drink", "water"],
        freeWordPositions: [2],
        distractors: ["pan", "leche", "cafe"],
      },
    ],
  },
];

function renderSoloLearnPage() {
  return render(<LearnPhasePage />);
}

function getLetter(wordIndex: number, letterIndex: number) {
  return screen.getByTestId(`solo-learn-word-${wordIndex}-hint-letter-${letterIndex}`);
}

function getConfidenceValue(wordIndex: number) {
  return screen.getByTestId(`solo-learn-word-${wordIndex}-confidence-value`);
}

describe("SoloLearnPage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    useQueryMock.mockReset();
    playTTSMock.mockReset();
    sessionStorage.clear();
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getThemes") {
        return themes;
      }
      return undefined;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts cards as hidden letter boxes and removes the old mode controls", () => {
    renderSoloLearnPage();

    expect(getLetter(0, 0)).toHaveTextContent("");
    expect(getLetter(0, 1)).toHaveTextContent("");
    expect(screen.queryByText("gato")).not.toBeInTheDocument();
    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Reveal All");
    expect(screen.getByTestId("solo-learn-set-all-trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("solo-learn-toggle-reveal")).not.toBeInTheDocument();
    expect(screen.queryByTestId("solo-learn-toggle-test")).not.toBeInTheDocument();
    expect(screen.queryByTestId("solo-learn-reset-all")).not.toBeInTheDocument();
  });

  it("reveals all words, hides all words, and marks bulk reveal off after a per-card hide", () => {
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));

    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Hide All");
    expect(getLetter(0, 0)).toHaveTextContent("G");
    expect(getLetter(0, 1)).toHaveTextContent("A");
    expect(getLetter(1, 0)).toHaveTextContent("C");
    expect(screen.getByTestId("solo-learn-word-0-hints-remaining")).toHaveTextContent("0");

    fireEvent.click(screen.getByTestId("solo-learn-word-0-reveal"));

    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Reveal All");
    expect(getLetter(0, 0)).toHaveTextContent("");
    expect(getLetter(1, 0)).toHaveTextContent("C");

    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));
    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));

    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Reveal All");
    expect(getLetter(0, 0)).toHaveTextContent("");
    expect(getLetter(1, 0)).toHaveTextContent("");
  });

  it("does not change confidence when revealing or hiding all cards", () => {
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-word-0-confidence-increment"));
    expect(getConfidenceValue(0)).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));
    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));

    expect(getConfidenceValue(0)).toHaveTextContent("1");
    expect(getConfidenceValue(1)).toHaveTextContent("0");
  });

  it("sets all confidence values, leaves reveal state alone, and closes the dropdown", async () => {
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));
    fireEvent.click(screen.getByTestId("solo-learn-set-all-trigger"));
    expect(screen.getByTestId("solo-learn-set-all-dropdown")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("solo-learn-set-all-level-3"));

    await waitFor(() => {
      expect(screen.queryByTestId("solo-learn-set-all-dropdown")).not.toBeInTheDocument();
    });
    expect(getConfidenceValue(0)).toHaveTextContent("3");
    expect(getConfidenceValue(1)).toHaveTextContent("3");
    expect(getLetter(0, 0)).toHaveTextContent("G");
    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Hide All");
  });

  it("closes the Set all dropdown on outside click", async () => {
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-set-all-trigger"));
    expect(screen.getByTestId("solo-learn-set-all-dropdown")).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId("solo-learn-set-all-dropdown")).not.toBeInTheDocument();
    });
  });

  it("passes updated confidence values forward when skipping to challenge", () => {
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-set-all-trigger"));
    fireEvent.click(screen.getByTestId("solo-learn-set-all-level-2"));
    fireEvent.click(screen.getByTestId("solo-learn-word-1-confidence-increment"));
    fireEvent.click(screen.getByTestId("solo-learn-skip"));

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0]?.[0] as string;
    const params = new URLSearchParams(pushedUrl.split("?")[1]);

    expect(JSON.parse(params.get("confidence") ?? "{}")).toEqual({
      0: 2,
      1: 3,
    });
  });

  it("passes updated confidence values forward when the timer expires", async () => {
    vi.useFakeTimers();
    renderSoloLearnPage();

    fireEvent.click(screen.getByTestId("solo-learn-set-all-trigger"));
    fireEvent.click(screen.getByTestId("solo-learn-set-all-level-2"));
    fireEvent.click(screen.getByTestId("solo-learn-word-1-confidence-increment"));

    await act(async () => {
      vi.advanceTimersByTime(600_000);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    const pushedUrl = pushMock.mock.calls[0]?.[0] as string;
    const params = new URLSearchParams(pushedUrl.split("?")[1]);

    expect(JSON.parse(params.get("confidence") ?? "{}")).toEqual({
      0: 2,
      1: 3,
    });
  });

  it("renders sentence study cards with hidden words, reveal controls, and clamped confidence", async () => {
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getThemes") {
        return sentenceThemes;
      }
      return undefined;
    });

    renderSoloLearnPage();

    expect(screen.getByTestId("solo-learn-sentence-0-english")).toHaveTextContent("I drink water");

    // Spanish words start hidden behind tap-to-reveal tiles, not shown outright.
    expect(screen.getByTestId("solo-learn-sentence-0-token-0")).not.toHaveTextContent("Yo");
    expect(screen.getByTestId("solo-learn-sentence-0-token-0")).toHaveTextContent("•••");

    // Reveal All now applies to sentence decks too (matches the study mock).
    fireEvent.click(screen.getByTestId("solo-learn-toggle-reveal-all"));
    expect(screen.getByTestId("solo-learn-sentence-0-token-0")).toHaveTextContent("Yo");
    expect(screen.getByTestId("solo-learn-sentence-0-token-1")).toHaveTextContent("bebo");
    expect(screen.getByTestId("solo-learn-sentence-0-token-2")).toHaveTextContent("agua");

    // A per-card hide turns the bulk toggle back off.
    fireEvent.click(screen.getByTestId("solo-learn-sentence-0-reveal"));
    expect(screen.getByTestId("solo-learn-toggle-reveal-all")).toHaveTextContent("Reveal All");
    expect(screen.getByTestId("solo-learn-sentence-0-token-0")).toHaveTextContent("•••");

    // "Yo bebo agua" is 3 words. Level 0 is recognition + Levels 1–2 are builds,
    // so the sentence caps at max level 2 and confidence clamps there. (We read
    // the value via aria-label, not text, because the slide animation briefly
    // keeps the previous digit in the DOM.)
    const sentenceIncrement = screen.getByTestId(
      "solo-learn-sentence-0-confidence-increment"
    );
    fireEvent.click(sentenceIncrement); // 0 -> 1
    fireEvent.click(sentenceIncrement); // 1 -> 2 (max)

    expect(screen.getByLabelText("Confidence level 2")).toBeInTheDocument();
    expect(sentenceIncrement).toBeDisabled();

    fireEvent.click(screen.getByTestId("solo-learn-set-all-trigger"));
    fireEvent.click(screen.getByTestId("solo-learn-set-all-level-3"));

    await waitFor(() => {
      expect(screen.queryByTestId("solo-learn-set-all-dropdown")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Confidence level 2")).toBeInTheDocument();
  });
});
