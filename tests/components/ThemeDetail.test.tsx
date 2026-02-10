import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeDetail } from "@/app/themes/components/ThemeDetail";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const baseTheme = {
  _id: "theme_1" as Id<"themes">,
  _creationTime: Date.now(),
  name: "ANIMALS",
  description: "Generated theme for: animals",
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

const baseWord = {
  word: "cat",
  answer: "kocka",
  wrongAnswers: ["strom", "auto", "more"],
};

function renderThemeDetail(isSaving: boolean) {
  return render(
    <ThemeDetail
      theme={baseTheme as ThemeDetailTheme}
      localWords={[baseWord]}
      onThemeNameChange={vi.fn()}
      onDeleteWord={vi.fn()}
      onEditWord={vi.fn()}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      isSaving={isSaving}
      showAddWordModal={false}
      onShowAddWordModal={vi.fn()}
      addWordState={{ newWordInput: "", isAdding: false, error: null }}
      onAddWordInputChange={vi.fn()}
      onAddWord={vi.fn()}
      onAddWordReset={vi.fn()}
      showGenerateRandomModal={false}
      onShowGenerateRandomModal={vi.fn()}
      generateRandomState={{ count: 5, isGenerating: false, error: null }}
      onRandomCountChange={vi.fn()}
      onGenerateRandom={vi.fn()}
      onGenerateRandomReset={vi.fn()}
      visibility="private"
      isUpdatingVisibility={false}
      onVisibilityChange={vi.fn()}
      friendsCanEdit={false}
      isUpdatingFriendsCanEdit={false}
      onFriendsCanEditChange={vi.fn()}
    />
  );
}

describe("ThemeDetail save controls", () => {
  it("disables save and cancel while saving", () => {
    renderThemeDetail(true);

    const saveButton = screen.getByTestId("theme-save");
    const cancelButton = screen.getByTestId("theme-cancel");

    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveTextContent("Saving...");
    expect(cancelButton).toBeDisabled();
  });

  it("keeps save enabled when not saving and data is valid", () => {
    renderThemeDetail(false);

    const saveButton = screen.getByTestId("theme-save");
    const cancelButton = screen.getByTestId("theme-cancel");

    expect(saveButton).toBeEnabled();
    expect(saveButton).toHaveTextContent("Save");
    expect(cancelButton).toBeEnabled();
  });
});
