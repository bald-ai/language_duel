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

    const infoButton = screen.getByLabelText("Information");
    fireEvent.mouseOver(infoButton);
    expect(screen.getByText("Helpful details")).toBeInTheDocument();

    fireEvent.mouseOut(infoButton);
    await waitFor(() => {
      expect(screen.queryByText("Helpful details")).toBeNull();
    });
  });
});
