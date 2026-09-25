import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThemeDetailHeader } from "@/app/themes/components/ThemeDetailHeader";
import { THEME_NAME_MAX_LENGTH } from "@/app/themes/constants";

function props(
  overrides: Partial<ComponentProps<typeof ThemeDetailHeader>> = {},
): ComponentProps<typeof ThemeDetailHeader> {
  return {
    themeName: "ANIMALS",
    contentType: "word",
    canEdit: true,
    isOwner: true,
    ownerDisplay: null,
    onThemeNameChange: vi.fn(),
    onOpenAddItem: vi.fn(),
    onOpenGenerateMore: vi.fn(),
    visibility: "private",
    onVisibilityChange: vi.fn(),
    friendsCanEdit: false,
    onFriendsCanEditChange: vi.fn(),
    onGenerateTTS: vi.fn(),
    ...overrides,
  };
}

describe("shared theme header", () => {
  it.each(["word", "sentence"] as const)(
    "routes %s add, generation and TTS actions",
    (contentType) => {
      const p = props({ contentType });
      render(<ThemeDetailHeader {...p} />);
      const add = screen.getByTestId(`theme-add-${contentType}`);
      expect(add.textContent).toBe(
        contentType === "word" ? "+ Add Word" : "+ Add Sentence",
      );
      fireEvent.click(add);
      fireEvent.click(screen.getByTestId("theme-generate"));
      fireEvent.click(screen.getByTestId("theme-generate-tts"));
      expect(p.onOpenAddItem).toHaveBeenCalledTimes(1);
      expect(p.onOpenGenerateMore).toHaveBeenCalledTimes(1);
      expect(p.onGenerateTTS).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("theme-tts-status").textContent).toBe(
        "TTS up to date",
      );
    },
  );

  it("normalizes a changed name on blur and keeps blank/unchanged names", () => {
    const p = props();
    render(<ThemeDetailHeader {...p} />);
    for (const value of ["  ", "ANIMALS", "  sea  animals  "]) {
      fireEvent.click(screen.getByRole("heading"));
      const input = screen.getByTestId("theme-name-input");
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
    }
    expect(p.onThemeNameChange).toHaveBeenCalledTimes(1);
    expect(p.onThemeNameChange).toHaveBeenCalledWith("SEA  ANIMALS");
  });

  it("enforces the name length limit and cancels keyboard editing", () => {
    const p = props();
    render(<ThemeDetailHeader {...p} />);
    fireEvent.click(screen.getByRole("heading"));
    const input = screen.getByTestId("theme-name-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "x".repeat(THEME_NAME_MAX_LENGTH) },
    });
    expect(input.value).toHaveLength(THEME_NAME_MAX_LENGTH);
    fireEvent.change(input, {
      target: { value: "x".repeat(THEME_NAME_MAX_LENGTH + 1) },
    });
    expect(input.value).toHaveLength(THEME_NAME_MAX_LENGTH);
    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.queryByTestId("theme-name-input")).not.toBeNull();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByTestId("theme-name-input")).toBeNull();
    expect(p.onThemeNameChange).not.toHaveBeenCalled();
  });

  it("commits keyboard editing on Enter", () => {
    const p = props();
    render(<ThemeDetailHeader {...p} />);
    fireEvent.click(screen.getByRole("heading"));
    fireEvent.change(screen.getByTestId("theme-name-input"), {
      target: { value: "fish" },
    });
    fireEvent.keyDown(screen.getByTestId("theme-name-input"), { key: "Enter" });
    expect(p.onThemeNameChange).toHaveBeenCalledWith("FISH");
    expect(screen.queryByTestId("theme-name-input")).toBeNull();
  });

  it("shows attribution and prevents changes for a viewer", () => {
    render(
      <ThemeDetailHeader
        {...props({ canEdit: false, isOwner: false, ownerDisplay: "Sam#1234" })}
      />,
    );
    expect(screen.getByText("by Sam#1234")).not.toBeNull();
    fireEvent.click(screen.getByRole("heading"));
    expect(screen.queryByTestId("theme-name-input")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("hides the editor when editing permission is withdrawn", () => {
    const p = props();
    const { rerender } = render(<ThemeDetailHeader {...p} />);
    fireEvent.click(screen.getByRole("heading"));
    rerender(<ThemeDetailHeader {...p} canEdit={false} />);
    expect(screen.queryByTestId("theme-name-input")).toBeNull();
  });

  it("supports private/shared selection and blocks it while saving", () => {
    const p = props();
    const { rerender } = render(<ThemeDetailHeader {...p} />);
    fireEvent.click(screen.getByTestId("theme-visibility-shared"));
    fireEvent.click(screen.getByTestId("theme-visibility-private"));
    expect(p.onVisibilityChange).toHaveBeenNthCalledWith(1, "shared");
    expect(p.onVisibilityChange).toHaveBeenNthCalledWith(2, "private");
    rerender(
      <ThemeDetailHeader {...p} visibility="shared" isUpdatingVisibility />,
    );
    fireEvent.click(screen.getByTestId("theme-visibility-private"));
    expect(p.onVisibilityChange).toHaveBeenCalledTimes(2);
  });

  it("toggles friends' editing permissions only on shared themes", () => {
    const p = props({ visibility: "shared" });
    const { rerender } = render(<ThemeDetailHeader {...p} />);
    fireEvent.click(screen.getByTestId("theme-friends-can-edit"));
    expect(p.onFriendsCanEditChange).toHaveBeenLastCalledWith(true);
    rerender(<ThemeDetailHeader {...p} friendsCanEdit />);
    fireEvent.click(screen.getByTestId("theme-friends-can-edit"));
    expect(p.onFriendsCanEditChange).toHaveBeenLastCalledWith(false);
    rerender(<ThemeDetailHeader {...p} isUpdatingFriendsCanEdit />);
    fireEvent.click(screen.getByTestId("theme-friends-can-edit"));
    expect(p.onFriendsCanEditChange).toHaveBeenCalledTimes(2);
    rerender(<ThemeDetailHeader {...p} visibility="private" />);
    expect(screen.queryByTestId("theme-friends-can-edit")).toBeNull();
  });

  it("shows stale TTS status and blocks duplicate generation while pending", () => {
    const p = props({ isGeneratingTTS: true, isTTSUpToDate: false });
    render(<ThemeDetailHeader {...p} />);
    expect(screen.getByTestId("theme-tts-status").textContent).toBe(
      "TTS not up to date",
    );
    expect(screen.getByTestId("theme-generate-tts").textContent).toBe(
      "Generating TTS...",
    );
    fireEvent.click(screen.getByTestId("theme-generate-tts"));
    expect(p.onGenerateTTS).not.toHaveBeenCalled();
  });

  it("omits controls whose optional actions are unavailable", () => {
    render(
      <ThemeDetailHeader
        {...props({
          visibility: "shared",
          onVisibilityChange: undefined,
          onFriendsCanEditChange: undefined,
          onGenerateTTS: undefined,
          isOwner: true,
        })}
      />,
    );
    expect(screen.queryByTestId("theme-visibility-private")).toBeNull();
    expect(screen.queryByTestId("theme-friends-can-edit")).toBeNull();
    expect(screen.queryByTestId("theme-generate-tts")).toBeNull();
    expect(screen.queryByText(/^by /)).toBeNull();
  });
});
