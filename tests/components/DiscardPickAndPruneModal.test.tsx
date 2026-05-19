import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DiscardPickAndPruneModal } from "@/app/themes/components/DiscardPickAndPruneModal";

describe("DiscardPickAndPruneModal", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <DiscardPickAndPruneModal
        isOpen={false}
        reviewKind="new-theme"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(queryByTestId("theme-pick-prune-discard-modal")).toBeNull();
  });

  it("shows new-theme copy when reviewKind is new-theme", () => {
    render(
      <DiscardPickAndPruneModal
        isOpen
        reviewKind="new-theme"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-pick-prune-discard-message")).toHaveTextContent(
      "no theme will be created"
    );
  });

  it("shows existing-theme copy when reviewKind is existing-theme", () => {
    render(
      <DiscardPickAndPruneModal
        isOpen
        reviewKind="existing-theme"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-pick-prune-discard-message")).toHaveTextContent(
      "will not be added to the current theme"
    );
  });

  it("triggers confirm and cancel handlers", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <DiscardPickAndPruneModal
        isOpen
        reviewKind="new-theme"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByTestId("theme-pick-prune-discard-confirm"));
    fireEvent.click(screen.getByTestId("theme-pick-prune-discard-cancel"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
