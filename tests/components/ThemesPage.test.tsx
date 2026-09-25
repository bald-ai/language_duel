import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ThemesPage from "@/app/themes/page";
import { VIEW_MODES } from "@/app/themes/constants";

const mocks = vi.hoisted(() => ({
  controller: {} as Record<string, unknown>,
}));

vi.mock("next/dynamic", () => ({
  default: (loader: () => unknown) => {
    const source = loader.toString();
    const testId = source.includes("PickAndPruneSentenceReview")
      ? "sentence-pick-prune-review"
      : source.includes("SentenceThemeDetail")
        ? "sentence-theme-detail"
        : source.includes("SentenceRoundEditor")
          ? "sentence-round-editor"
          : source.includes("PickAndPruneReview") ? "word-pick-prune-review"
          : source.includes("ThemeDetail") ? "word-theme-detail"
          : source.includes("WordEditor") ? "word-editor"
          : "dynamic-component";

    const MockDynamicComponent = ((props: { isOpen?: boolean }) => {
      if ("isOpen" in props && !props.isOpen) return null;
      return <div data-testid={testId} />;
    }) as ComponentType<{ isOpen?: boolean }>;

    return MockDynamicComponent;
  },
}));

vi.mock("@/app/themes/hooks/useThemesController", () => ({
  useThemesController: () => mocks.controller,
}));

vi.mock("@/app/themes/components/ThemeList", () => ({
  ThemeList: () => <div data-testid="theme-list" />,
}));

vi.mock("@/app/components/ThemedPage", () => ({
  ThemedPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/app/components/AppearanceProvider", () => ({
  useAppearanceColors: () => ({
    primary: { DEFAULT: "#0ea5e9" },
    cta: { DEFAULT: "#f97316" },
    secondary: { DEFAULT: "#22c55e" },
  }),
}));

function setController(overrides: Record<string, unknown>) {
  mocks.controller = {
    viewMode: VIEW_MODES.DETAIL,
    selectedTheme: null,
    wordEditorState: { editingField: null },
    listProps: {},
    friendFilterModalProps: { isOpen: false },
    generateModalProps: { isOpen: false },
    pickAndPruneReviewProps: {},
    detailProps: {},
    addWordModalProps: { isOpen: false },
    addSentenceModalProps: { isOpen: false },
    generateMoreModalProps: { isOpen: false },
    wordEditorProps: {},
    deleteConfirmProps: { isOpen: false },
    discardPickAndPruneProps: { isOpen: false },
    isSentenceFlowActive: false,
    isSentenceReviewActive: false,
    sentenceEditField: null,
    sentenceDetailProps: null,
    sentenceEditorProps: null,
    sentenceGenerateModalProps: { isOpen: false },
    sentenceGenerateMoreModalProps: { isOpen: false },
    sentencePickAndPruneReviewProps: {},
    sentenceReviewDiscardProps: { isOpen: false },
    sentenceDiscardConfirmProps: { isOpen: false },
    contentTypeModalProps: { isOpen: false },
    ...overrides,
  };
}

describe("ThemesPage sentence review render priority", () => {
  beforeEach(() => {
    setController({});
  });

  it("renders sentence Pick & Prune without the underlying existing sentence editor", () => {
    setController({
      isSentenceFlowActive: true,
      isSentenceReviewActive: true,
      sentenceEditField: { roundIndex: 0, field: "spanish" },
      sentenceDetailProps: {},
      sentenceEditorProps: {},
      sentencePickAndPruneReviewProps: {},
    });

    render(<ThemesPage />);

    expect(screen.getByTestId("sentence-pick-prune-review")).toBeInTheDocument();
    expect(screen.queryByTestId("sentence-theme-detail")).toBeNull();
    expect(screen.queryByTestId("sentence-round-editor")).toBeNull();
  });

  it("still renders sentence detail when no sentence review is active", () => {
    setController({
      isSentenceFlowActive: true,
      isSentenceReviewActive: false,
      sentenceDetailProps: {},
    });

    render(<ThemesPage />);

    expect(screen.getByTestId("sentence-theme-detail")).toBeInTheDocument();
    expect(screen.queryByTestId("sentence-pick-prune-review")).toBeNull();
  });
});

describe("ThemesPage word and sentence content routing", () => {
  it.each([
    [VIEW_MODES.LIST, {}, "theme-list"],
    [VIEW_MODES.DETAIL, { selectedTheme: { name: "Animals" } }, "word-theme-detail"],
    [VIEW_MODES.EDIT_WORD, { wordEditorState: { editingField: "answer" } }, "word-editor"],
    [VIEW_MODES.PICK_AND_PRUNE_REVIEW, {}, "word-pick-prune-review"],
  ] as const)("renders %s content", (viewMode, extra, expected) => {
    setController({ viewMode, ...extra }); render(<ThemesPage />);
    expect(screen.queryByTestId(expected)).not.toBeNull();
    for (const id of ["theme-list", "word-theme-detail", "word-editor", "word-pick-prune-review"]) {
      if (id !== expected) expect(screen.queryByTestId(id)).toBeNull();
    }
  });
  it("shows the sentence field editor instead of detail or the list", () => {
    setController({ viewMode: VIEW_MODES.LIST, isSentenceFlowActive: true, sentenceEditField: { field: "english", roundIndex: 0 }, sentenceEditorProps: {}, sentenceDetailProps: {} });
    render(<ThemesPage />); expect(screen.queryByTestId("sentence-round-editor")).not.toBeNull(); expect(screen.queryByTestId("sentence-theme-detail")).toBeNull(); expect(screen.queryByTestId("theme-list")).toBeNull();
  });
  it("hides the list while new sentence generation is being reviewed", () => {
    setController({ viewMode: VIEW_MODES.LIST, isSentenceReviewActive: true }); render(<ThemesPage />);
    expect(screen.queryByTestId("sentence-pick-prune-review")).not.toBeNull(); expect(screen.queryByTestId("theme-list")).toBeNull();
  });
});
