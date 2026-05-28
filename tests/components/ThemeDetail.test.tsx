import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeDetail, type ThemeDetailTheme } from "@/app/themes/components/ThemeDetail";
import type { Id } from "@/convex/_generated/dataModel";

const baseTheme = {
  _id: "theme_1" as Id<"themes">,
  _creationTime: Date.now(),
  name: "ANIMALS",
  description: "Generated theme for: animals",
  contentType: "word" as const,
  wordType: "nouns" as const,
  words: [],
  createdAt: Date.now(),
  visibility: "private" as const,
  isOwner: true,
  canEdit: true,
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
      onOpenAddWord={vi.fn()}
      onOpenGenerateMore={vi.fn()}
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
