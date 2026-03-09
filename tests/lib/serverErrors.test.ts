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
      message: "Unauthorized",
      status: 401,
    });
  });

  it("maps known auth wording variants", () => {
    expect(resolveApiError(new Error("Unauthorized"), fallback)).toEqual({
      code: "AUTH_FAILED",
      message: "Unauthorized",
      status: 401,
    });

    expect(resolveApiError(new Error("Not authenticated"), fallback)).toEqual({
      code: "AUTH_FAILED",
      message: "Not authenticated",
      status: 401,
    });
  });

  it("maps known config and credit messages", () => {
    expect(resolveApiError(new Error("Convex URL not configured"), fallback)).toEqual({
      code: "CONFIG_ERROR",
      message: "Convex URL not configured",
      status: 500,
    });

    expect(resolveApiError(new Error("LLM credits exhausted"), fallback)).toEqual({
      code: "CREDITS_EXHAUSTED",
      message: "LLM credits exhausted",
      status: 402,
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
      message: "Unknown failure",
      status: 500,
    });
  });
});
