import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GoalPracticeModalHost } from "@/app/goals/components/GoalPracticeModalHost";
import type { Id } from "@/convex/_generated/dataModel";

// Capture whatever props the host hands to SoloPracticeModal. `next/dynamic`
// is stubbed to return this component synchronously so the picker mounts in the
// test without resolving a real lazy import.
const soloModalProps = vi.fn();

vi.mock("next/dynamic", () => ({
  default: () => (props: unknown) => {
    soloModalProps(props);
    return null;
  },
}));

vi.mock("@/app/components/AppearanceProvider", () => ({
  useAppearanceColors: () => ({
    background: { elevated: "#fff", DEFAULT: "#eee" },
    primary: { dark: "#000" },
    status: { danger: { DEFAULT: "#f00" } },
    text: { DEFAULT: "#111" },
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: { weeklyGoals: { getWeeklyGoalPracticeThemes: "getWeeklyGoalPracticeThemes" } },
}));

type ModalProps = {
  themes: Array<{ _id: string; name: string; contentType: string; itemCount: number }>;
  initialDraftThemeIds: string[];
};

const wordTheme = {
  _id: "theme_word" as Id<"themes">,
  name: "Verbs",
  contentType: "word" as const,
  words: [
    { word: "eat", answer: "comer", wrongAnswers: ["beber"] },
    { word: "drink", answer: "beber", wrongAnswers: ["comer"] },
  ],
  sentenceRounds: undefined,
};

const sentenceTheme = {
  _id: "theme_sentence" as Id<"themes">,
  name: "Phrases",
  contentType: "sentence" as const,
  words: undefined,
  sentenceRounds: [
    {
      englishPrompt: "I eat",
      spanishSentence: "Yo como",
      wordMeanings: ["I", "eat"],
      freeWordPositions: [],
      distractors: ["bebo"],
    },
  ],
};

beforeEach(() => {
  soloModalProps.mockReset();
});

describe("GoalPracticeModalHost", () => {
  it("includes sentence themes in the picker with their round count", () => {
    render(
      <GoalPracticeModalHost
        goalId={"goal_1" as Id<"weeklyGoals">}
        weeklyGoalPracticeThemes={{
          ok: true,
          source: "live",
          themes: [wordTheme, sentenceTheme],
          // The host only reads ok/source/themes; cast covers the wider query type.
        } as never}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const props = soloModalProps.mock.calls[0][0] as ModalProps;
    const sentence = props.themes.find((theme) => theme._id === "theme_sentence");

    expect(props.themes).toHaveLength(2);
    expect(sentence).toBeDefined();
    expect(sentence?.contentType).toBe("sentence");
    expect(sentence?.itemCount).toBe(1);
    expect(props.initialDraftThemeIds).toContain("theme_sentence");
  });
});


it("shows loading until the query resolves and allows closing a failed practice source", () => {
  const onClose = vi.fn();
  const props = { goalId: "goal_1" as Id<"weeklyGoals">, onContinue: vi.fn(), onClose };
  const view = render(<GoalPracticeModalHost {...props} weeklyGoalPracticeThemes={undefined} />);
  expect(screen.queryByText("Loading goal themes...")).not.toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  expect(soloModalProps).not.toHaveBeenCalled();
  view.rerender(<GoalPracticeModalHost {...props} weeklyGoalPracticeThemes={{ ok: false, message: "Theme no longer available" }} />);
  expect(screen.queryByText("Theme no longer available")).not.toBeNull();
  expect(screen.queryByText("Loading goal themes...")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledOnce();
});

it("explains snapshot practice and retains the supplied launch and close actions", () => {
  const onContinue = vi.fn(), onClose = vi.fn();
  render(<GoalPracticeModalHost goalId={"goal_1" as Id<"weeklyGoals">} onContinue={onContinue} onClose={onClose}
    weeklyGoalPracticeThemes={{ ok: true, weeklyGoalId: "goal_1" as Id<"weeklyGoals">, source: "snapshot", themes: [wordTheme, sentenceTheme] }} />);
  const props = soloModalProps.mock.calls[0][0];
  expect(props.themeSelectorNotice).toContain("snapshot taken when this goal was locked");
  expect(props.forceThemeSelectorFirst).toBe(true);
  expect(props.hideCreateThemeButton).toBe(true);
  expect(props.onContinue).toBe(onContinue);
  expect(props.onClose).toBe(onClose);
});
