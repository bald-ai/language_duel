import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemeNameDropdown } from "@/app/notifications/components/ThemeNameDropdown";

describe("ThemeNameDropdown", () => {
  it("renders plain text when themeId is missing", () => {
    render(
      <ThemeNameDropdown
        themeName="Animals"
        onSoloChallenge={vi.fn()}
      />
    );

    expect(screen.getByText("Animals")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Animals" })).toBeNull();
  });

  it("supports solo challenge and closes on outside click", async () => {
    const onSoloChallenge = vi.fn();

    render(
      <ThemeNameDropdown
        themeName="Animals"
        themeId={"theme_2" as Id<"themes">}
        onSoloChallenge={onSoloChallenge}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Animals" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo Challenge" }));

    expect(onSoloChallenge).toHaveBeenCalledWith("theme_2");

    fireEvent.click(screen.getByRole("button", { name: "Animals" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Solo Challenge" })).toBeInTheDocument();
    });
    fireEvent.mouseDown(window.document.body);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Solo Challenge" })).toBeNull();
    });
  });
});
