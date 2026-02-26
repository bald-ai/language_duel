import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NicknameEditor } from "@/app/settings/components/NicknameEditor";

describe("NicknameEditor", () => {
  it("does not submit unchanged nickname on form submit", async () => {
    const onUpdate = vi.fn(async () => true);

    render(
      <NicknameEditor
        currentNickname="PlayerOne"
        currentDiscriminator={1234}
        isUpdating={false}
        error={null}
        onUpdate={onUpdate}
        onClearError={vi.fn()}
      />
    );

    const input = screen.getByTestId("settings-nickname-input");
    const form = input.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  it("submits trimmed changed nickname", async () => {
    const onUpdate = vi.fn(async () => true);

    render(
      <NicknameEditor
        currentNickname="PlayerOne"
        currentDiscriminator={1234}
        isUpdating={false}
        error={null}
        onUpdate={onUpdate}
        onClearError={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId("settings-nickname-input"), {
      target: { value: "  NewName  " },
    });

    const form = screen.getByTestId("settings-nickname-input").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith("NewName");
    });
  });
});
