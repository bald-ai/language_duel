import { describe, expect, it } from "vitest";
import { readBackendErrorCode } from "@/lib/backendErrorCodes";

describe("readBackendErrorCode", () => {
  it("reads direct and nested backend error codes", () => {
    expect(readBackendErrorCode({ code: "AUTH_FAILED" })).toBe("AUTH_FAILED");
    expect(readBackendErrorCode({ data: { code: "CREDITS_EXHAUSTED" } })).toBe(
      "CREDITS_EXHAUSTED"
    );
  });

  it("ignores missing or non-string codes", () => {
    expect(readBackendErrorCode(null)).toBeUndefined();
    expect(readBackendErrorCode({ code: 401 })).toBeUndefined();
    expect(readBackendErrorCode({ data: { code: 402 } })).toBeUndefined();
  });
});
