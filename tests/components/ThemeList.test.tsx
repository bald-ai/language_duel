import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeList } from "@/app/themes/components/ThemeList";
import type { ThemeWithOwner } from "@/convex/themes";
import type { Id } from "@/convex/_generated/dataModel";
const state = vi.hoisted(() => ({ goals: undefined as unknown }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));
vi.mock("convex/react", () => ({ useQuery: () => state.goals }));
function wordTheme(overrides: Partial<Extract<ThemeWithOwner, { contentType: "word" }>> = {}): ThemeWithOwner {
  return { _id: "word" as Id<"themes">, _creationTime: 1, createdAt: 1, ownerId: "user" as Id<"users">, name: "Animals", description: "Animal words", contentType: "word", wordType: "nouns", words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"] }], visibility: "private", isOwner: true, canEdit: true, ...overrides };
}
function sentenceTheme(): ThemeWithOwner {
  const round = { englishPrompt: "I eat bread", spanishSentence: "Yo como pan", wordMeanings: ["I", "eat", "bread"], freeWordPositions: [], distractors: ["Tu"], ttsStorageId: "audio" as Id<"_storage"> };
  return { _id: "sentence" as Id<"themes">, _creationTime: 1, createdAt: 1, ownerId: "friend" as Id<"users">, name: "Food", description: "Food sentences", contentType: "sentence", sentenceRounds: [round, { ...round, englishPrompt: "You eat bread", spanishSentence: "Tu comes pan" }], visibility: "shared", isOwner: false, canEdit: false, ownerNickname: "Friend" };
}
function props(overrides: Partial<ComponentProps<typeof ThemeList>> = {}): ComponentProps<typeof ThemeList> {
  return { themes: [wordTheme(), sentenceTheme()], deletingThemeId: null, duplicatingThemeId: null, onOpenTheme: vi.fn(), onDeleteTheme: vi.fn(), onDuplicateTheme: vi.fn(), onGenerateNew: vi.fn(), onBack: vi.fn(), ...overrides };
}
beforeEach(() => { state.goals = undefined; });
describe("theme lists and card menus", () => {
  it("shows content counts, categories, ownership, stored-audio state and goal markers", () => {
    state.goals = [{ goal: { themes: [{ themeId: "word" }] } }];
    const p = props(); render(<ThemeList {...p} />);
    expect(screen.getByText("2 themes available")).toBeInTheDocument();
    expect(screen.getByTestId("theme-open-word")).toHaveTextContent("1 word • Private");
    expect(screen.getByTestId("theme-open-sentence")).toHaveTextContent("2 sentences • Shared • by Friend");
    expect(screen.getByTestId("theme-content-type-badge-word")).toHaveTextContent("NOUNS");
    expect(screen.getByTestId("theme-content-type-badge-sentence")).toHaveTextContent("SENTENCES");
    expect(screen.getByTestId("theme-tts-status-word")).toHaveAttribute("title", "Some words are missing pre-generated TTS");
    expect(screen.getByTestId("theme-tts-status-sentence")).toHaveAttribute("title", "All sentences have pre-generated TTS");
    expect(within(screen.getByTestId("theme-card-word")).getByTestId("weekly-goal-theme-marker")).toBeInTheDocument();
    expect(within(screen.getByTestId("theme-card-sentence")).queryByTestId("weekly-goal-theme-marker")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-open-word")); expect(p.onOpenTheme).toHaveBeenCalledWith(p.themes[0]);
    fireEvent.click(screen.getByTestId("themes-generate-new")); expect(p.onGenerateNew).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("themes-back")); expect(p.onBack).toHaveBeenCalledOnce();
  });
  it("handles plural words, singular sentences, optional category/owner labels and inverse audio states", () => {
    const word = wordTheme({ isOwner: false, wordType: undefined });
    if (word.contentType !== "word") throw new Error("Expected word fixture");
    word.words = [{ ...word.words[0], ttsStorageId: "audio1" as Id<"_storage"> }, { ...word.words[0], ttsStorageId: "audio2" as Id<"_storage"> }];
    const sentence = sentenceTheme(); if (sentence.contentType !== "sentence") throw new Error("Expected sentence fixture");
    sentence.sentenceRounds = [{ ...sentence.sentenceRounds[0], ttsStorageId: undefined }];
    render(<ThemeList {...props({ themes: [word, sentence] })} />);
    expect(screen.getByTestId("theme-open-word")).toHaveTextContent("2 words");
    expect(screen.getByTestId("theme-open-word")).not.toHaveTextContent("by");
    expect(screen.getByTestId("theme-content-type-badge-word")).toHaveTextContent("NO CATEGORY");
    expect(screen.getByTestId("theme-tts-status-word")).toHaveTextContent("TTS up to date");
    expect(screen.getByTestId("theme-open-sentence")).toHaveTextContent("1 sentence");
    expect(screen.getByTestId("theme-tts-status-sentence")).toHaveTextContent("TTS missing");
  });
  it("filters content tabs without mutating the loaded list", () => {
    const change = vi.fn(); const p = props({ onContentTypeTabChange: change });
    const h = render(<ThemeList {...p} />);
    fireEvent.click(screen.getByTestId("themes-content-type-tab-sentence")); expect(change).toHaveBeenLastCalledWith("sentence");
    h.rerender(<ThemeList {...p} contentTypeTab="sentence" />);
    expect(screen.queryByTestId("theme-card-word")).toBeNull(); expect(screen.getByText("1 theme available")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("themes-content-type-tab-word")); expect(change).toHaveBeenLastCalledWith("word");
    h.rerender(<ThemeList {...p} contentTypeTab="word" />);
    expect(screen.queryByTestId("theme-card-sentence")).toBeNull(); expect(screen.getByTestId("theme-card-word")).toBeInTheDocument();
    expect(p.themes).toHaveLength(2);
  });
  it.each(["mine", "archived"] as const)("shows the %s filter and its controls", kind => {
    const open = vi.fn(), clear = vi.fn(), toggle = vi.fn();
    render(<ThemeList {...props({ themes: [wordTheme()], filter: { kind }, onOpenFriendFilter: open, onClearFriendFilter: clear, onToggleShowArchived: toggle })} />);
    expect(screen.getByText(`Filtering: ${kind === "mine" ? "My Themes" : "Archived Themes"} • 1 theme`)).toBeInTheDocument();
    expect(screen.getByTestId("themes-toggle-archived")).toHaveAttribute("title", kind === "archived" ? "Show Active Themes" : "Show Archived Themes");
    fireEvent.click(screen.getByTestId("themes-filter")); expect(open).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("themes-clear-filter")); expect(clear).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("themes-toggle-archived")); expect(toggle).toHaveBeenCalledOnce();
  });
  it("shows the selected friend handle and gracefully waits for an absent friend summary", () => {
    const p = props({ filter: { kind: "friend", friendId: "friend" as Id<"users"> }, selectedFriend: { friendId: "friend" as Id<"users">, friendshipId: "friendship" as Id<"friends">, nickname: "Amigo", discriminator: 1234, isOnline: true, createdAt: 1 } });
    const h = render(<ThemeList {...p} />); expect(screen.getByText("Filtering: Amigo#1234 • 2 themes")).toBeInTheDocument();
    h.rerender(<ThemeList {...p} selectedFriend={null} />); expect(screen.getByText("2 themes available")).toBeInTheDocument();
    h.rerender(<ThemeList {...p} themes={[]} selectedFriend={null} />); expect(screen.getByText("0 themes available")).toBeInTheDocument();
  });
  it("allows duplication for all accessible themes and deletion only for the owner", () => {
    const p = props(); render(<ThemeList {...p} />);
    fireEvent.click(screen.getByTestId("theme-menu-button-sentence"));
    expect(screen.queryByTestId("theme-delete-sentence")).toBeNull();
    fireEvent.click(screen.getByTestId("theme-duplicate-sentence")); expect(p.onDuplicateTheme).toHaveBeenCalledWith("sentence");
    expect(screen.queryByTestId("theme-menu-sentence")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-menu-button-word")); fireEvent.click(screen.getByTestId("theme-delete-word"));
    expect(p.onDeleteTheme).toHaveBeenCalledExactlyOnceWith("word", "Animals");
    expect(p.onOpenTheme).not.toHaveBeenCalled();
  });
  it.each([false, true])("toggles the card archive action (archived=%s)", archived => {
    const toggle = vi.fn(); render(<ThemeList {...props({ filter: { kind: archived ? "archived" : "all" }, onToggleArchive: toggle })} />);
    fireEvent.click(screen.getByTestId("theme-menu-button-word"));
    expect(screen.getByTestId("theme-archive-toggle-word")).toHaveTextContent(archived ? "Unarchive" : "Archive");
    fireEvent.click(screen.getByTestId("theme-archive-toggle-word")); expect(toggle).toHaveBeenCalledExactlyOnceWith("word"); expect(screen.queryByTestId("theme-menu-word")).not.toBeInTheDocument();
  });
  it.each(["deletingThemeId", "duplicatingThemeId"] as const)("disables actions during %s", field => {
    const p = props({ onToggleArchive: vi.fn() }); const h = render(<ThemeList {...p} />);
    fireEvent.click(screen.getByTestId("theme-menu-button-word"));
    h.rerender(<ThemeList {...p} {...{ [field]: "word" as Id<"themes"> }} />);
    expect(screen.getByTestId("theme-open-word")).toBeDisabled(); expect(screen.getByTestId("theme-menu-button-word")).toBeDisabled();
    for (const id of ["theme-duplicate-word", "theme-delete-word", "theme-archive-toggle-word"]) { expect(screen.getByTestId(id)).toBeDisabled(); fireEvent.click(screen.getByTestId(id)); }
    expect(p.onDuplicateTheme).not.toHaveBeenCalled(); expect(p.onDeleteTheme).not.toHaveBeenCalled(); expect(p.onToggleArchive).not.toHaveBeenCalled();
    expect(screen.getByTestId(field === "deletingThemeId" ? "theme-delete-word" : "theme-duplicate-word")).toHaveTextContent(field === "deletingThemeId" ? "Deleting..." : "Duplicating...");
  });
  it("positions the portal menu on resize/scroll and dismisses it with Escape or an outside click", () => {
    const p = props(); const h = render(<ThemeList {...p} />);
    const button = screen.getByTestId("theme-menu-button-word");
    const rect = vi.spyOn(button, "getBoundingClientRect").mockReturnValue({ bottom: 100, right: 300 } as DOMRect);
    fireEvent.click(button); let menu = screen.getByTestId("theme-menu-word");
    expect(h.container).not.toContainElement(menu); expect(menu).toHaveStyle({ top: "108px", right: `${window.innerWidth - 300}px` });
    rect.mockReturnValue({ bottom: 120, right: 400 } as DOMRect); fireEvent.resize(window); expect(menu).toHaveStyle({ top: "128px" });
    rect.mockReturnValue({ bottom: 150, right: 400 } as DOMRect); fireEvent.scroll(window); expect(menu).toHaveStyle({ top: "158px" });
    fireEvent.mouseDown(menu); fireEvent.mouseDown(button); fireEvent.keyDown(menu, { key: "Tab" }); expect(screen.getByTestId("theme-menu-word")).toBeInTheDocument();
    fireEvent.keyDown(menu, { key: "Escape" }); expect(screen.queryByTestId("theme-menu-word")).not.toBeInTheDocument();
    fireEvent.click(button); menu = screen.getByTestId("theme-menu-word"); fireEvent.mouseDown(document.body); expect(screen.queryByTestId("theme-menu-word")).not.toBeInTheDocument();
    rect.mockRestore();
  });
});
