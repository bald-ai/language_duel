import { describe, expect, it } from "vitest";
import { ApiRouteError, resolveApiError } from "@/lib/api/serverErrors";

describe("resolveApiError", () => {
  const fallback = {
    defaultCode: "UNKNOWN_ERROR" as const,
    defaultStatus: 500,
    defaultMessage: "Unknown failure",
  };

  it("returns explicit ApiRouteError code and status", () => {
    const resolved = resolveApiError(
      new ApiRouteError("AUTH_FAILED", "Unauthorized", 401),
      fallback
    );

    expect(resolved).toEqual({
      code: "AUTH_FAILED",
      message: "Please sign in and try again.",
      status: 401,
    });
  });

  it("maps structured backend codes", () => {
    const authError = new Error("Unauthorized") as Error & { data: { code: string } };
    authError.data = { code: "AUTH_FAILED" };
    expect(resolveApiError(authError, fallback)).toEqual({
      code: "AUTH_FAILED",
      message: "Please sign in and try again.",
      status: 401,
    });

    const creditError = new Error("LLM credits exhausted") as Error & { data: { code: string } };
    creditError.data = { code: "CREDITS_EXHAUSTED" };
    expect(resolveApiError(creditError, fallback)).toEqual({
      code: "CREDITS_EXHAUSTED",
      message: "You are out of AI generation credits.",
      status: 402,
    });
  });

  it("cleans message-only credit errors without classifying the code", () => {
    expect(resolveApiError(new Error("LLM credits exhausted"), fallback)).toEqual({
      code: "UNKNOWN_ERROR",
      message: "You are out of AI generation credits.",
      status: 500,
    });
  });

  it("falls back for unknown error messages and non-errors", () => {
    expect(resolveApiError(new Error("Something else"), fallback)).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Something else",
      status: 500,
    });

    expect(resolveApiError(null, fallback)).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Unknown failure. Please try again.",
      status: 500,
    });
  });
});
