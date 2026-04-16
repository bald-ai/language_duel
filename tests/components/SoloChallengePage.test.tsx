import type { ReactNode } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SoloChallengePage from "@/app/solo/[sessionId]/page";

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
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    weeklyGoals: {
      getBossPracticeSession: "getBossPracticeSession",
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
    <div data-testid="level0-input">{`${word}:${answer}`}</div>
  ),
  Level1Input: ({ answer }: { answer: string }) => (
    <div data-testid="level1-input">{`Level1:${answer}`}</div>
  ),
  Level2TypingInput: ({ answer }: { answer: string }) => (
    <div data-testid="level2-typing-input">{`Level2Typing:${answer}`}</div>
  ),
  Level2MultipleChoice: ({ answer }: { answer: string }) => (
    <div data-testid="level2-mc-input">{`Level2MC:${answer}`}</div>
  ),
  Level3Input: ({ answer }: { answer: string }) => (
    <div data-testid="level3-input">{`Level3:${answer}`}</div>
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
  wordStates: Map<number, unknown>;
  lastQuestionIndex: number | null;
  currentWordIndex: number | null;
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
  currentWord: {
    word: string;
    answer: string;
    wrongAnswers: string[];
    themeId: string;
    themeName: string;
  };
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
    wordStates: new Map(),
    lastQuestionIndex: null,
    currentWordIndex: 0,
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
    currentWord: {
      word: "cat",
      answer: "gato",
      wrongAnswers: ["perro", "casa", "mesa"],
      themeId: "theme_1",
      themeName: "Basics",
    },
    masteredCount: 0,
  };
}

describe("SoloChallengePage", () => {
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
        currentWord: {
          word: "to speak",
          answer: "hablar (Irr)",
          wrongAnswers: ["comer", "beber", "vivir"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloChallengePage />);

    expect(screen.getByText("hablar")).toBeInTheDocument();
    expect(screen.getByText("Translate to English")).toBeInTheDocument();
    expect(screen.getByTestId("level2-typing-input")).toHaveTextContent("Level2Typing:to speak");
    expect(screen.queryByTestId("level1-input")).not.toBeInTheDocument();
  });

  it("keeps forward Level 1 on Level1Input with Translate to Spanish", () => {
    useSoloSessionMock.mockReturnValue(createHookReturn());

    render(<SoloChallengePage />);

    expect(screen.getByText("cat")).toBeInTheDocument();
    expect(screen.getByText("Translate to Spanish")).toBeInTheDocument();
    expect(screen.getByTestId("level1-input")).toHaveTextContent("Level1:gato");
    expect(screen.queryByTestId("level2-typing-input")).not.toBeInTheDocument();
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

    render(<SoloChallengePage />);

    expect(screen.getByText("Translate to Spanish")).toBeInTheDocument();
    expect(screen.getByTestId("level2-mc-input")).toHaveTextContent("Level2MC:gato");
    expect(screen.queryByTestId("level2-typing-input")).not.toBeInTheDocument();
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
        currentWord: {
          word: "to speak",
          answer: "hablar (Irr)",
          wrongAnswers: ["comer", "beber", "vivir"],
          themeId: "theme_1",
          themeName: "Basics",
        },
      })
    );

    render(<SoloChallengePage />);

    expect(screen.getByText("hablar")).toBeInTheDocument();
    expect(screen.getByText("Translate to English")).toBeInTheDocument();
    expect(screen.getByText("Answer:")).toBeInTheDocument();
    expect(screen.getByText("to speak")).toBeInTheDocument();
  });
});
