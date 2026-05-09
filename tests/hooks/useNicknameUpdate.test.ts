import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNicknameUpdate } from "@/app/settings/hooks/useNicknameUpdate";

const updateNicknameMutationMock = vi.fn();
const toastErrorMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => updateNicknameMutationMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      updateNickname: "updateNickname",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

describe("useNicknameUpdate", () => {
  beforeEach(() => {
    updateNicknameMutationMock.mockReset();
    toastErrorMock.mockClear();
    toastSuccessMock.mockClear();
  });

  it("keeps update failures inline without showing a duplicate error toast", async () => {
    updateNicknameMutationMock.mockRejectedValue(new Error("Nickname already taken"));

    const { result } = renderHook(() => useNicknameUpdate());
    let success: boolean | undefined;

    await act(async () => {
      success = await result.current.updateNickname("TakenName");
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe("Nickname already taken");
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
