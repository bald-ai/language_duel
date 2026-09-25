import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundSelector } from "@/app/settings/components/BackgroundSelector";
import { ColorSetSelector } from "@/app/settings/components/ColorSetSelector";
import { AppearanceProvider } from "@/app/components/AppearanceProvider";
import { themeOptions } from "@/lib/appearance";
const state = vi.hoisted(() => ({ save: vi.fn(), error: vi.fn() }));
vi.mock("@/app/components/UserPreferencesProvider", () => ({ useUserPreferences: () => ({ userPreferences: { selectedColorSet: undefined }, isLoading: false, updateColorSet: state.save }) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); state.save.mockResolvedValue(undefined); });
describe("appearance selectors", () => {
  it("identifies the selected backdrop and dispatches another choice", () => {
    const select = vi.fn();
    const view = render(<BackgroundSelector selectedBackground="background.jpg" onSelect={select} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(buttons[1]); expect(select).toHaveBeenCalledExactlyOnceWith("background_2.jpg");
    view.rerender(<BackgroundSelector selectedBackground="background_2.jpg" onSelect={select} isUpdating />);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");
    for (const button of buttons) { expect(button).toBeDisabled(); fireEvent.click(button); }
    expect(select).toHaveBeenCalledOnce();
  });
  it("changes the active palette, local storage, CSS variables and server preference", async () => {
    render(<AppearanceProvider><ColorSetSelector /></AppearanceProvider>);
    await act(async () => {});
    const option = themeOptions[1];
    await act(async () => fireEvent.click(screen.getByTestId(`settings-color-set-${option.name}`)));
    expect(state.save).toHaveBeenCalledExactlyOnceWith(option.name);
    expect(localStorage.getItem("language-duel-color-set")).toBe(option.name);
    expect(document.documentElement.getAttribute("data-theme")).toBe(option.name);
    expect(screen.getByTestId(`settings-color-set-${option.name}`)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Active")).toHaveLength(1);
  });
  it("keeps the chosen palette visible and reports a failed save", async () => {
    state.save.mockRejectedValue(new Error("Palette save failed"));
    render(<AppearanceProvider><ColorSetSelector /></AppearanceProvider>);
    await act(async () => {});
    const option = themeOptions[1];
    await act(async () => fireEvent.click(screen.getByTestId(`settings-color-set-${option.name}`)));
    expect(state.error).toHaveBeenCalledExactlyOnceWith("Palette save failed");
    expect(screen.getByTestId(`settings-color-set-${option.name}`)).toHaveAttribute("aria-pressed", "true");
  });
});
