import { describe, expect, it } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage", () => {
  it("maps common backend codes to plain user messages", () => {
    expect(
      getErrorMessage(
        { data: { code: "NOT_AUTHORIZED", message: "Not authorized" } },
        "Failed to save theme"
      )
    ).toBe("You do not have permission to do that.");

    expect(
      getErrorMessage(
        { data: { code: "CREDITS_EXHAUSTED", message: "LLM credits exhausted" } },
        "Generation failed"
      )
    ).toBe("You are out of AI generation credits.");
  });

  it("keeps specific plain backend messages when they are useful", () => {
    expect(
      getErrorMessage(
        { data: { code: "NOT_AUTHORIZED", message: "You can only create goals with friends" } },
        "Failed to create goal"
      )
    ).toBe("You can only create goals with friends");
  });

  it("parses Convex-style JSON embedded in an error message", () => {
    const error = new Error(
      'Uncaught ConvexError: {"code":"AUTH_FAILED","message":"Unauthorized"}'
    );

    expect(getErrorMessage(error, "Failed to accept challenge")).toBe(
      "Please sign in and try again."
    );
  });

  it("uses a plain retry fallback for technical messages and non-errors", () => {
    expect(getErrorMessage(new Error("Internal server error"), "Failed to update")).toBe(
      "Failed to update. Please try again."
    );
    expect(getErrorMessage(null, "Failed to update")).toBe(
      "Failed to update. Please try again."
    );
  });
});
