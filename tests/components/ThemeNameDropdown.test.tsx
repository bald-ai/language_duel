import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemeNameDropdown } from "@/app/notifications/components/ThemeNameDropdown";

describe("ThemeNameDropdown", () => {
  it("renders plain text when themeId is missing", () => {
    render(
        <ThemeNameDropdown
          themeName="Animals"
          onSoloPractice={vi.fn()}
        />
    );

    expect(screen.getByText("Animals")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Animals" })).toBeNull();
  });

  it("supports solo practice and closes on outside click", async () => {
    const onSoloPractice = vi.fn();

    render(
        <ThemeNameDropdown
          themeName="Animals"
          themeId={"theme_2" as Id<"themes">}
          onSoloPractice={onSoloPractice}
        />
    );

    fireEvent.click(screen.getByRole("button", { name: "Animals" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo Practice" }));

    expect(onSoloPractice).toHaveBeenCalledWith("theme_2");

    fireEvent.click(screen.getByRole("button", { name: "Animals" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Solo Practice" })).toBeInTheDocument();
    });
    fireEvent.mouseDown(window.document.body);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Solo Practice" })).toBeNull();
    });
  });
});
