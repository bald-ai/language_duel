import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ModalShell } from "@/app/components/modals/ModalShell";

describe("ModalShell", () => {
  it("renders content and tooltip interactions", async () => {
    render(
      <ModalShell
        title="Info Title"
        maxHeight
        infoTooltip="Helpful details"
        panelClassName="custom-panel"
      >
        <div>Body Content</div>
      </ModalShell>
    );

    expect(screen.getByText("Info Title")).toBeInTheDocument();
    expect(screen.getByText("Body Content")).toBeInTheDocument();

    const tooltipTriggerContainer = screen.getByLabelText("Information").parentElement;
    if (!tooltipTriggerContainer) {
      throw new Error("Tooltip trigger container missing");
    }

    fireEvent.mouseEnter(tooltipTriggerContainer);
    expect(screen.getByText("Helpful details")).toBeInTheDocument();

    fireEvent.mouseLeave(tooltipTriggerContainer);
    await waitFor(() => {
      expect(screen.queryByText("Helpful details")).toBeNull();
    });
  });
});
