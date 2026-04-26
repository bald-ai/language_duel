import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LockButton } from "@/app/goals/components/LockButton";
import { DeleteGoalButton } from "@/app/goals/components/DeleteGoalButton";
import { GoalThemeList } from "@/app/goals/components/GoalThemeList";
import type { Id } from "@/convex/_generated/dataModel";

describe("Goal buttons", () => {
  it("LockButton triggers onLock when not partnerLocked", async () => {
    const onLock = vi.fn().mockResolvedValue(undefined);

    render(<LockButton partnerLocked={false} onLock={onLock} />);

    fireEvent.click(screen.getByTestId("goals-lock"));

    await waitFor(() => {
      expect(onLock).toHaveBeenCalledTimes(1);
    });
  });

  it("LockButton shows confirm flow when partnerLocked", () => {
    const onLock = vi.fn().mockResolvedValue(undefined);

    render(<LockButton partnerLocked onLock={onLock} />);

    fireEvent.click(screen.getByTestId("goals-lock"));

    expect(screen.getByTestId("goals-lock-cancel")).toBeInTheDocument();
    expect(screen.getByTestId("goals-lock-confirm")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("goals-lock-cancel"));
    expect(screen.queryByTestId("goals-lock-confirm")).not.toBeInTheDocument();
  });

  it("DeleteGoalButton confirm triggers onDelete", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(<DeleteGoalButton onDelete={onDelete} />);

    fireEvent.click(screen.getByTestId("goals-delete"));
    fireEvent.click(screen.getByTestId("goals-delete-confirm"));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  it("GoalThemeList allows toggling progress when enabled", () => {
    const onToggle = vi.fn();

    render(
      <GoalThemeList
        themes={[
          {
            themeId: "theme_1" as Id<"themes">,
            themeName: "Family",
            creatorCompleted: false,
            partnerCompleted: false,
          },
        ]}
        viewerRole="creator"
        isEditing
        canToggle
        onToggle={onToggle}
        onRemove={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("goal-theme-toggle-theme_1"));

    expect(onToggle).toHaveBeenCalledWith("theme_1");
  });

  it("GoalThemeList disables progress changes when completion is unavailable", () => {
    const onToggle = vi.fn();

    render(
      <GoalThemeList
        themes={[
          {
            themeId: "theme_1" as Id<"themes">,
            themeName: "Family",
            creatorCompleted: false,
            partnerCompleted: false,
          },
        ]}
        viewerRole="creator"
        isEditing={false}
        canToggle={false}
        onToggle={onToggle}
        onRemove={vi.fn()}
      />
    );

    const toggle = screen.getByTestId("goal-theme-toggle-theme_1");
    fireEvent.click(toggle);

    expect(toggle).toBeDisabled();
    expect(onToggle).not.toHaveBeenCalled();
  });
});
