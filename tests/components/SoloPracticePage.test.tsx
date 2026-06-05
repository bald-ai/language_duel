import type { ReactNode } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SoloPracticePage from "@/app/solo/[sessionId]/page";

const pushMock = vi.fn();
const useQueryMock = vi.fn();
const useSoloSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === "themeId" ? "theme_1" : null),
  }),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => vi.fn(async () => ({ advanced: true })),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getBossPracticeSession: "getBossPracticeSession",
      getWeeklyGoalPracticeThemes: "getWeeklyGoalPracticeThemes",
    },
    weeklyGoalRepetitions: {
      completeSolo: "completeSolo",
    },
    themes: {
      getThemes: "getThemes",
    },
  },
}));

vi.mock("@/app/solo/[sessionId]/hooks/useSoloSession", () => ({
  useSoloSession: (...args: unknown[]) => useSoloSessionMock(...args),
}));

vi.mock("@/app/solo/[sessionId]/components/CompletionScreen", () => ({
  CompletionScreen: () => <div data-testid="completion-screen">Complete</div>,
}));

vi.mock("@/app/components/ThemedPage", () => ({
  ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/game/levels", () => ({
  Level0Input: ({ word, answer }: { word: string; answer: string }) => (
    <div data-testid="solo-practice-level0">{`${word}:${answer}`}</div>
  ),
  Level1Input: ({ answer }: { answer: string }) => (
    <div data-testid="solo-practice-level1">{`Level1:${answer}`}</div>
  ),
  Level2TypingInput: ({ answer }: { answer: string }) => (
    <div data-testid="solo-practice-level2-typing">{`Level2Typing:${answer}`}</div>
  ),
  Level2MultipleChoice: ({ answer }: { answer: string }) => (
    <div data-testid="solo-practice-level2-mc">{`Level2MC:${answer}`}</div>
  ),
  Level3Input: ({ answer }: { answer: string }) => (
    <div data-testid="solo-practice-level3">{`Level3:${answer}`}</div>
  ),
}));

const themes = [
  {
    _id: "theme_1",
    name: "Basics",
    words: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "casa", "mesa"],
      },
    ],
  },
];

type SessionMock = {
  initialized: boolean;
  activePool: number[];
  remainingPool: number[];
  itemStates: Map<number, unknown>;
  lastQuestionIndex: number | null;
  lastItemIndex: number | null;
  currentItemIndex: number | null;
  questionKey: number;
  questionLevel: 0 | 1 | 2 | 3;
  translationDirection: "forward" | "reverse";
  level2Mode: "typing" | "multiple_choice";
  questionsAnswered: number;
  correctAnswers: number;
  completed: boolean;
};

type HookReturnMock = {
  session: SessionMock;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  feedbackAnswer: string | null;
  elapsedTime: number;
  handleCorrect: ReturnType<typeof vi.fn>;
  handleIncorrect: ReturnType<typeof vi.fn>;
  handleLevel0GotIt: ReturnType<typeof vi.fn>;
  handleLevel0NotYet: ReturnType<typeof vi.fn>;
  currentItem:
    | {
        kind: "word";
        word: string;
        answer: string;
        wrongAnswers: string[];
        themeId: string;
        themeName: string;
      }
    | {
        kind: "sentence";
        englishPrompt: string;
        spanishSentence: string;
        wordMeanings: string[];
        freeWordPositions: number[];
        distractors: string[];
        themeId: string;
        themeName: string;
      }
    | null;
  masteredCount: number;
};

function buildSessionState(overrides: Partial<SessionMock> = {}) {
  return {
    ...createBaseSession(),
    ...overrides,
  };
}

function createBaseSession(): SessionMock {
  return {
    initialized: true,
    activePool: [0],
    remainingPool: [],
    itemStates: new Map(),
    lastQuestionIndex: null,
    lastItemIndex: null,
    currentItemIndex: 0,
    questionKey: 0,
    questionLevel: 1 as const,
    translationDirection: "forward" as const,
    level2Mode: "typing" as const,
    questionsAnswered: 0,
    correctAnswers: 0,
    completed: false,
  };
}

function createHookReturn(overrides: Partial<HookReturnMock> = {}) {
  return {
    ...createBaseHookReturn(),
    ...overrides,
  };
}

function createBaseHookReturn(): HookReturnMock {
  return {
    session: createBaseSession(),
    showFeedback: false,
    feedbackCorrect: false,
    feedbackAnswer: null,
    elapsedTime: 0,
    handleCorrect: vi.fn(),
    handleIncorrect: vi.fn(),
    handleLevel0GotIt: vi.fn(),
    handleLevel0NotYet: vi.fn(),
    currentItem: {
      kind: "word" as const, word: "cat",
      answer: "gato",
      wrongAnswers: ["perro", "casa", "mesa"],
      themeId: "theme_1",
      themeName: "Basics",
    },
    masteredCount: 0,
  };
}

describe("SoloPracticePage", () => {
  beforeEach(() => {
    pushMock.mockReset();
    useQueryMock.mockReset();
    useSoloSessionMock.mockReset();
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getThemes") {
        return themes;
      }
      return undefined;
    });
  });

  it("shows reverse Level 1 Spanish cue text and mounts Level2TypingInput", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 1,
          translationDirection: "reverse",
        }),
        currentItem: {
          kind: "word" as const, word: "to speak",
          answer: "hablar (Irr)",
          wrongAnswers: ["comer", "beber", "vivir"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByText("hablar")).toBeInTheDocument();
    expect(screen.getByText("Translate to English")).toBeInTheDocument();
    expect(screen.getByTestId("solo-practice-level2-typing")).toHaveTextContent("Level2Typing:to speak");
    expect(screen.queryByTestId("solo-practice-level1")).not.toBeInTheDocument();
  });

  it("keeps forward Level 1 on Level1Input with Translate to Spanish", () => {
    useSoloSessionMock.mockReturnValue(createHookReturn());

    render(<SoloPracticePage />);

    expect(screen.getByText("cat")).toBeInTheDocument();
    expect(screen.getByText("Translate to Spanish")).toBeInTheDocument();
    expect(screen.getByTestId("solo-practice-level1")).toHaveTextContent("Level1:gato");
    expect(screen.queryByTestId("solo-practice-level2-typing")).not.toBeInTheDocument();
  });

  it("shows an explicit empty theme error instead of preparing forever", () => {
    useQueryMock.mockImplementation((query: unknown) => {
      if (query === "getThemes") {
        return [{ _id: "theme_1", name: "Basics", words: [] }];
      }
      return undefined;
    });
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({ initialized: false, currentItemIndex: null }),
        currentItem: null,
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByText("This selection has no items to practice")).toBeInTheDocument();
    expect(screen.getByTestId("solo-practice-back-home")).toHaveTextContent("Back to Home");
    expect(screen.queryByText("Preparing your next question...")).not.toBeInTheDocument();
  });

  it("keeps Level 2 multiple choice unchanged", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 2,
          translationDirection: "forward",
          level2Mode: "multiple_choice",
        }),
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByText("Translate to Spanish")).toBeInTheDocument();
    expect(screen.getByTestId("solo-practice-level2-mc")).toHaveTextContent("Level2MC:gato");
    expect(screen.queryByTestId("solo-practice-level2-typing")).not.toBeInTheDocument();
  });

  it("renders the recognition card for a Level 0 sentence", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 0,
          translationDirection: "forward",
        }),
        currentItem: {
          kind: "sentence",
          englishPrompt: "I eat",
          spanishSentence: "Yo como",
          wordMeanings: ["I", "eat"],
          freeWordPositions: [1],
          distractors: ["bebo", "leo", "duermo"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByTestId("solo-practice-sentence")).toBeInTheDocument();
    // Level 0 mirrors word Level 0: the whole sentence is shown for recognition,
    // not a cloze to fill.
    expect(screen.getByTestId("solo-practice-level0")).toHaveTextContent("I eat:Yo como");
    expect(screen.queryByTestId("solo-practice-sentence-bank")).not.toBeInTheDocument();
  });

  it("renders the sentence cloze card for a Level 1+ sentence", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 1,
          translationDirection: "forward",
        }),
        currentItem: {
          kind: "sentence",
          englishPrompt: "I eat",
          spanishSentence: "Yo como",
          wordMeanings: ["I", "eat"],
          freeWordPositions: [1],
          distractors: ["bebo", "leo", "duermo"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByTestId("solo-practice-sentence")).toBeInTheDocument();
    expect(screen.getByTestId("solo-practice-sentence-cue")).toHaveTextContent("I eat");
    expect(screen.getByTestId("solo-practice-sentence-bank")).toBeInTheDocument();
    expect(screen.queryByTestId("solo-practice-level0")).not.toBeInTheDocument();
  });

  it("keeps a completed sentence cloze locked while waiting to advance", () => {
    let hookReturn = createHookReturn({
      session: buildSessionState({
        questionLevel: 1,
        translationDirection: "forward",
      }),
      currentItem: {
        kind: "sentence",
        englishPrompt: "I eat",
        spanishSentence: "Yo como",
        wordMeanings: ["I", "eat"],
        freeWordPositions: [],
        distractors: ["bebo", "leo", "duermo"],
        themeId: "theme_1",
        themeName: "Basics",
      },
    });
    useSoloSessionMock.mockImplementation(() => hookReturn);

    const { rerender } = render(<SoloPracticePage />);

    fireEvent.click(screen.getByTestId("solo-practice-sentence-chip-0"));
    fireEvent.click(screen.getByTestId("solo-practice-sentence-chip-1"));
    expect(hookReturn.handleCorrect).toHaveBeenCalledTimes(1);

    hookReturn = createHookReturn({
      ...hookReturn,
      session: buildSessionState({
        questionLevel: 1,
        translationDirection: "forward",
        questionsAnswered: 1,
      }),
    });
    rerender(<SoloPracticePage />);

    expect(screen.getByTestId("solo-practice-sentence-chip-0")).toBeDisabled();
    expect(screen.getByTestId("solo-practice-sentence-chip-1")).toBeDisabled();
  });

  it("places a sentence chip with arrow-key navigation and Enter", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 1,
          translationDirection: "forward",
        }),
        currentItem: {
          kind: "sentence",
          englishPrompt: "I eat",
          spanishSentence: "Yo como",
          wordMeanings: ["I", "eat"],
          freeWordPositions: [],
          distractors: ["bebo", "leo", "duermo"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloPracticePage />);

    // The first blank expects "Yo" (rendered lowercase as "yo" on the tiles).
    // Find that chip's position in the bank (the bank order is shuffled), arrow
    // over to it, then Enter to place it.
    const chips = screen.getAllByTestId(/^solo-practice-sentence-chip-\d+$/);
    const yoIndex = chips.findIndex((chip) => chip.textContent?.includes("yo"));
    for (let step = 0; step < yoIndex; step += 1) {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    }
    fireEvent.keyDown(window, { key: "Enter" });

    expect(screen.getByTestId("solo-practice-sentence-blank-0")).toHaveTextContent("yo");
  });

  it("shows the English answer in wrong-answer feedback for reverse Level 1", () => {
    useSoloSessionMock.mockReturnValue(
      createHookReturn({
        session: buildSessionState({
          questionLevel: 1,
          translationDirection: "reverse",
        }),
        showFeedback: true,
        feedbackAnswer: "to speak",
        currentItem: {
          kind: "word" as const, word: "to speak",
          answer: "hablar (Irr)",
          wrongAnswers: ["comer", "beber", "vivir"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloPracticePage />);

    expect(screen.getByText("hablar")).toBeInTheDocument();
    expect(screen.getByText("Translate to English")).toBeInTheDocument();
    expect(screen.getByText("Answer:")).toBeInTheDocument();
    expect(screen.getByText("to speak")).toBeInTheDocument();
  });
});
