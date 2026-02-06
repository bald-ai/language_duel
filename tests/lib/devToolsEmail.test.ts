import { describe, expect, it } from "vitest";
import {
  formatEmailSuccessOutput,
  formatEmailErrorOutput,
  parseEmailArg,
  validateEmailFormat,
  type SendEmailResult,
} from "@/lib/devToolsEmail";

describe("devToolsEmail", () => {
  describe("formatEmailSuccessOutput", () => {
    it("formats success output with all fields", () => {
      const result: SendEmailResult = {
        success: true,
        sentTo: "user@example.com",
        messageId: "msg_123abc",
      };
      const output = formatEmailSuccessOutput(result);
      expect(output).toContain("✅ Email sent successfully!");
      expect(output).toContain("   To: user@example.com");
      expect(output).toContain("   Message ID: msg_123abc");
    });

    it("handles undefined messageId", () => {
      const result: SendEmailResult = {
        success: true,
        sentTo: "test@test.com",
        messageId: undefined,
      };
      const output = formatEmailSuccessOutput(result);
      expect(output).toContain("   To: test@test.com");
      expect(output).toContain("   Message ID: undefined");
    });
  });

  describe("formatEmailErrorOutput", () => {
    it("formats error message", () => {
      const output = formatEmailErrorOutput("Connection refused");
      expect(output).toBe("\n❌ Failed to send email: Connection refused");
    });

    it("handles empty error message", () => {
      const output = formatEmailErrorOutput("");
      expect(output).toBe("\n❌ Failed to send email: ");
    });
  });

  describe("parseEmailArg", () => {
    it("returns undefined for undefined input", () => {
      expect(parseEmailArg(undefined)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      expect(parseEmailArg("")).toBeUndefined();
    });

    it("returns undefined for whitespace-only string", () => {
      expect(parseEmailArg("   ")).toBeUndefined();
    });

    it("trims whitespace from valid email", () => {
      expect(parseEmailArg("  user@example.com  ")).toBe("user@example.com");
    });

    it("returns email as-is when no trimming needed", () => {
      expect(parseEmailArg("user@example.com")).toBe("user@example.com");
    });
  });

  describe("validateEmailFormat", () => {
    it("returns true for valid email", () => {
      expect(validateEmailFormat("user@example.com")).toBe(true);
    });

    it("returns true for email with subdomain", () => {
      expect(validateEmailFormat("user@mail.example.com")).toBe(true);
    });

    it("returns true for email with plus sign", () => {
      expect(validateEmailFormat("user+tag@example.com")).toBe(true);
    });

    it("returns false for email without @", () => {
      expect(validateEmailFormat("userexample.com")).toBe(false);
    });

    it("returns false for email without domain", () => {
      expect(validateEmailFormat("user@")).toBe(false);
    });

    it("returns false for email without TLD", () => {
      expect(validateEmailFormat("user@example")).toBe(false);
    });

    it("returns false for email with spaces", () => {
      expect(validateEmailFormat("user @example.com")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateEmailFormat("")).toBe(false);
    });
  });
});