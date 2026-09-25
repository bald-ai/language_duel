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


it("starts with an empty nickname, clears errors while editing, and preserves a rejected value", async () => {
  const onUpdate = vi.fn().mockResolvedValue(false), onClearError = vi.fn();
  const props = { isUpdating: false, error: "Already taken", onUpdate, onClearError };
  const view = render(<NicknameEditor {...props} />);
  const input = screen.getByTestId("settings-nickname-input") as HTMLInputElement;
  const submit = screen.getByTestId("settings-nickname-submit") as HTMLButtonElement;
  expect(input.value).toBe("");
  expect(submit.disabled).toBe(true);
  expect(screen.queryByText("Already taken")).not.toBeNull();
  fireEvent.change(input, { target: { value: "   " } });
  fireEvent.submit(input.closest("form")!);
  expect(onUpdate).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: "  NewName  " } });
  expect(onClearError).toHaveBeenCalledTimes(2);
  fireEvent.click(submit);
  await waitFor(() => expect(onUpdate).toHaveBeenCalledExactlyOnceWith("NewName"));
  expect(input.value).toBe("  NewName  ");
  view.rerender(<NicknameEditor {...props} isUpdating />);
  expect(input.disabled).toBe(true);
  expect(submit.disabled).toBe(true);
  expect(submit.textContent).toBe("Updating...");
});
