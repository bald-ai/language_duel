import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import { ThemeDetail } from "@/app/themes/components/ThemeDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}));

const baseTheme = {
  _id: "theme_1" as Id<"themes">,
  _creationTime: Date.now(),
  name: "ANIMALS",
  description: "Generated theme for animals",
  wordType: "nouns" as const,
  words: [],
  createdAt: Date.now(),
  visibility: "private" as const,
  isOwner: true,
  canEdit: true,
};

type ThemeDetailTheme = Doc<"themes"> & {
  ownerNickname?: string;
  ownerDiscriminator?: number;
  isOwner?: boolean;
  canEdit?: boolean;
};

function makeProps(overrides?: Partial<ComponentProps<typeof ThemeDetail>>) {
  const handlers = {
    onThemeNameChange: vi.fn(),
    onDeleteWord: vi.fn(),
    onEditWord: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onShowAddWordModal: vi.fn(),
    onAddWordInputChange: vi.fn(),
    onAddWord: vi.fn(),
    onAddWordReset: vi.fn(),
    onShowGenerateRandomModal: vi.fn(),
    onRandomCountChange: vi.fn(),
    onGenerateRandom: vi.fn(),
    onGenerateRandomReset: vi.fn(),
    onVisibilityChange: vi.fn(),
    onFriendsCanEditChange: vi.fn(),
    onGenerateTTS: vi.fn(),
    onPlayWordTTS: vi.fn(),
  };

  const props: ComponentProps<typeof ThemeDetail> = {
    theme: baseTheme as ThemeDetailTheme,
    localWords: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
      },
    ],
    isSaving: false,
    showAddWordModal: false,
    addWordState: { newWordInput: "", isAdding: false, error: null },
    showGenerateRandomModal: false,
    generateRandomState: { count: 5, isGenerating: false, error: null },
    visibility: "private",
    isUpdatingVisibility: false,
    friendsCanEdit: false,
    isUpdatingFriendsCanEdit: false,
    isGeneratingTTS: false,
    isTTSUpToDate: true,
    playingWordKey: null,
    ...handlers,
    ...overrides,
  };

  render(<ThemeDetail {...props} />);
  return { props, ...handlers };
}

describe("ThemeDetail behavior", () => {
  it("renders read-only mode with owner label and back button", () => {
    const { onCancel } = makeProps({
      theme: {
        ...baseTheme,
        isOwner: false,
        canEdit: false,
        ownerNickname: "Alex",
        ownerDiscriminator: 12,
      } as ThemeDetailTheme,
    });

    expect(screen.queryByTestId("theme-save")).toBeNull();
    expect(screen.getByText("by Alex#12")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("theme-back"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("edits theme name and saves uppercase value with Enter", () => {
    const { onThemeNameChange } = makeProps();

    fireEvent.click(screen.getByText("ANIMALS"));
    fireEvent.change(screen.getByTestId("theme-name-input"), {
      target: { value: "new animals" },
    });
    fireEvent.keyDown(screen.getByTestId("theme-name-input"), { key: "Enter" });

    expect(onThemeNameChange).toHaveBeenCalledWith("NEW ANIMALS");
  });

  it("cancels theme name editing on Escape", () => {
    const { onThemeNameChange } = makeProps();

    fireEvent.click(screen.getByText("ANIMALS"));
    fireEvent.change(screen.getByTestId("theme-name-input"), {
      target: { value: "new animals" },
    });
    fireEvent.keyDown(screen.getByTestId("theme-name-input"), { key: "Escape" });

    expect(onThemeNameChange).not.toHaveBeenCalled();
  });

  it("triggers visibility and friends-can-edit toggles", () => {
    const { onVisibilityChange, onFriendsCanEditChange } = makeProps({
      visibility: "shared",
      friendsCanEdit: false,
    });

    fireEvent.click(screen.getByTestId("theme-visibility-private"));
    fireEvent.click(screen.getByTestId("theme-visibility-shared"));
    fireEvent.click(screen.getByTestId("theme-friends-can-edit"));

    expect(onVisibilityChange).toHaveBeenCalledWith("private");
    expect(onVisibilityChange).toHaveBeenCalledWith("shared");
    expect(onFriendsCanEditChange).toHaveBeenCalledWith(true);
  });

  it("triggers add and generate actions from utility buttons", () => {
    const {
      onAddWordReset,
      onShowAddWordModal,
      onGenerateRandomReset,
      onShowGenerateRandomModal,
    } = makeProps();

    fireEvent.click(screen.getByTestId("theme-add-word"));
    fireEvent.click(screen.getByTestId("theme-generate"));

    expect(onAddWordReset).toHaveBeenCalledTimes(1);
    expect(onShowAddWordModal).toHaveBeenCalledWith(true);
    expect(onGenerateRandomReset).toHaveBeenCalledTimes(1);
    expect(onShowGenerateRandomModal).toHaveBeenCalledWith(true);
  });

  it("closes add/generate modals through cancel actions", () => {
    const {
      onAddWordReset,
      onShowAddWordModal,
      onGenerateRandomReset,
      onShowGenerateRandomModal,
    } = makeProps({
      showAddWordModal: true,
      showGenerateRandomModal: true,
    });

    fireEvent.click(screen.getByTestId("theme-add-word-cancel"));
    fireEvent.click(screen.getByTestId("theme-generate-random-cancel"));

    expect(onShowAddWordModal).toHaveBeenCalledWith(false);
    expect(onAddWordReset).toHaveBeenCalled();
    expect(onShowGenerateRandomModal).toHaveBeenCalledWith(false);
    expect(onGenerateRandomReset).toHaveBeenCalled();
  });

  it("routes word card actions to callbacks", () => {
    const onEditWord = vi.fn();
    const onDeleteWord = vi.fn();
    const onPlayWordTTS = vi.fn();
    const storageId = "storage_1" as Id<"_storage">;

    makeProps({
      onEditWord,
      onDeleteWord,
      onPlayWordTTS,
      localWords: [
        {
          word: "cat",
          answer: "kocka",
          wrongAnswers: ["strom", "auto", "more"],
          ttsStorageId: storageId,
        },
      ],
    });

    fireEvent.click(screen.getByTestId("theme-word-0-word"));
    fireEvent.click(screen.getByTestId("theme-word-0-answer"));
    fireEvent.click(screen.getByTestId("theme-word-0-wrong-0"));
    fireEvent.click(screen.getByTestId("theme-word-0-delete"));
    fireEvent.click(screen.getByTestId("theme-word-0-play-tts"));

    expect(onEditWord).toHaveBeenCalledWith(0, "word");
    expect(onEditWord).toHaveBeenCalledWith(0, "answer");
    expect(onEditWord).toHaveBeenCalledWith(0, "wrong", 0);
    expect(onDeleteWord).toHaveBeenCalledWith(0);
    expect(onPlayWordTTS).toHaveBeenCalledWith(0, "kocka", storageId);
  });

  it("disables save and shows warning when theme has duplicate words", () => {
    const duplicatedWords: WordEntry[] = [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "auto", "more"],
      },
      {
        word: "cat",
        answer: "macka",
        wrongAnswers: ["rieka", "hora", "cesta"],
      },
    ];

    makeProps({ localWords: duplicatedWords });

    expect(screen.getByTestId("theme-save")).toBeDisabled();
    expect(screen.getByText("Fix highlighted words to enable saving.")).toBeInTheDocument();
  });
});
