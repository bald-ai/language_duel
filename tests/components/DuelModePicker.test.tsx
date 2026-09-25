import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DuelModePicker } from "@/app/components/modals/DuelModePicker";
import { DUEL_MODE_OPTIONS } from "@/app/components/modals/challengeOptions";

describe("duel mode selection", () => {
  it.each(["chips", "rows"] as const)("renders %s selections and reports every available mode", layout => {
    const onSelectMode = vi.fn();
    const { rerender } = render(<DuelModePicker selectedMode="pvp" onSelectMode={onSelectMode} dataTestIdPrefix="mode" layout={layout} />);
    for (const option of DUEL_MODE_OPTIONS) {
      const button = screen.getByTestId(`mode-${option.mode}`);
      expect(button).toHaveTextContent(option.label);
      expect(button).toHaveAttribute("aria-pressed", String(option.mode === "pvp"));
      fireEvent.click(button); expect(onSelectMode).toHaveBeenLastCalledWith(option.mode);
    }
    rerender(<DuelModePicker selectedMode="pve" onSelectMode={onSelectMode} dataTestIdPrefix="mode" layout={layout} />);
    expect(screen.getByTestId("mode-pve")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("mode-pvp")).toHaveAttribute("aria-pressed", "false");
    if (layout === "chips") expect(screen.getByTestId("mode-description")).toHaveTextContent("Hints · cooperate");
    else expect(screen.queryByTestId("mode-description")).toBeNull();
  });
  it.each(["chips", "rows"] as const)("shows a disabled reason and excludes disallowed modes in %s", layout => {
    const onSelectMode = vi.fn();
    render(<DuelModePicker selectedMode="pve" onSelectMode={onSelectMode} dataTestIdPrefix="mode" layout={layout} allowedModes={["pvp", "pve"]} disabledModes={{ pve: "Partner unavailable" }} />);
    expect(screen.queryByTestId("mode-relay")).toBeNull(); expect(screen.queryByTestId("mode-tbt")).toBeNull();
    const disabled = screen.getByTestId("mode-pve");
    expect(disabled.style.opacity).toBe("0.5");
    expect(disabled).toBeDisabled(); expect(disabled).toHaveAttribute("title", "Partner unavailable");
    expect(disabled).toHaveAttribute("aria-disabled", "true"); expect(disabled).toHaveAttribute("data-mode-disabled", "true");
    expect(screen.getByText(/Partner unavailable/)).toBeInTheDocument();
    fireEvent.click(disabled); expect(onSelectMode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("mode-pvp")); expect(onSelectMode).toHaveBeenCalledExactlyOnceWith("pvp");
  });
  it("updates the description when the allowed selection changes, including an empty option list", () => {
    const props = { selectedMode: "relay" as const, onSelectMode: vi.fn(), dataTestIdPrefix: "mode" };
    const { rerender } = render(<DuelModePicker {...props} allowedModes={["pve"]} />);
    expect(screen.getByTestId("mode-description")).toHaveTextContent("Hints · cooperate");
    rerender(<DuelModePicker {...props} allowedModes={[]} />);
    expect(screen.queryByRole("button")).toBeNull(); expect(screen.queryByTestId("mode-description")).toBeNull();
  });
});
