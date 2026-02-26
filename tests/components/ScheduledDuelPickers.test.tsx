import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Id } from "@/convex/_generated/dataModel";
import {
  CompactThemePicker,
  TimePickerDropdown,
  type ThemeOption,
} from "@/app/notifications/components/ScheduledDuelPickers";

function themeOption(overrides: Partial<ThemeOption> = {}): ThemeOption {
  return {
    _id: "theme_1" as Id<"themes">,
    name: "Animals",
    words: [{ word: "dog" }],
    visibility: "shared",
    ...overrides,
  };
}

describe("ScheduledDuelPickers", () => {
  it("CompactThemePicker shows empty-state message when no themes exist", () => {
    render(
      <CompactThemePicker
        themes={[]}
        selectedThemeId={null}
        selectedTheme={null}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("No shared themes available. Make a theme shared first.")).toBeInTheDocument();
  });

  it("CompactThemePicker opens dropdown and selects theme", async () => {
    const onSelect = vi.fn();
    const themes = [
      themeOption({ _id: "theme_1" as Id<"themes">, name: "Animals" }),
      themeOption({ _id: "theme_2" as Id<"themes">, name: "Travel", words: [{ word: "plane" }] }),
    ];

    render(
      <CompactThemePicker
        themes={themes}
        selectedThemeId={null}
        selectedTheme={null}
        onSelect={onSelect}
        dataTestIdPrefix="theme-picker"
      />
    );

    fireEvent.click(screen.getByTestId("theme-picker-trigger"));
    fireEvent.click(await screen.findByTestId("theme-picker-option-theme_2"));

    expect(onSelect).toHaveBeenCalledWith("theme_2");

    await waitFor(() => {
      expect(screen.queryByTestId("theme-picker-option-theme_2")).not.toBeInTheDocument();
    });
  });

  it("TimePickerDropdown renders empty-state message when there are no slots", async () => {
    const onSelect = vi.fn();
    render(
      <TimePickerDropdown
        timeSlots={[]}
        selectedTime={null}
        onSelect={onSelect}
        dataTestIdPrefix="time-picker"
      />
    );

    fireEvent.click(screen.getByTestId("time-picker-trigger"));
    expect(screen.getByText("No available time slots for today")).toBeInTheDocument();
  });

  it("TimePickerDropdown selects a slot", async () => {
    const onSelect = vi.fn();
    const slotTimestamp = Date.now() + 60_000;

    render(
      <TimePickerDropdown
        timeSlots={[
          {
            hour: 10,
            minute: 30,
            label: "10:30 AM",
            timestamp: slotTimestamp,
          },
        ]}
        selectedTime={null}
        onSelect={onSelect}
        dataTestIdPrefix="time-picker"
      />
    );

    fireEvent.click(screen.getByTestId("time-picker-trigger"));
    fireEvent.click(await screen.findByTestId(`time-picker-option-${slotTimestamp}`));

    expect(onSelect).toHaveBeenCalledWith(slotTimestamp);
  });
});
