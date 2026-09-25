import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internalSendEmail } from "@/convex/emails/actions";
const { send, construct } = vi.hoisted(() => ({
  send: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
    constructor(key: string) {
      construct(key);
    }
  },
}));
const args = {
  to: "recipient@example.test",
  subject: "A reminder",
  html: "<p>Reminder</p>",
};
const run = () =>
  (
    internalSendEmail as unknown as {
      _handler: (ctx: unknown, message: typeof args) => Promise<unknown>;
    }
  )._handler({}, args);
describe("email delivery provider boundary", () => {
  beforeEach(() => {
    send.mockReset();
    construct.mockClear();
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it("passes the sender and exact message fields to the mocked provider", async () => {
    send.mockResolvedValue({ data: { id: "message" }, error: null });
    await expect(run()).resolves.toEqual({
      success: true,
      messageId: "message",
    });
    expect(construct).toHaveBeenCalledExactlyOnceWith("test-key");
    expect(send).toHaveBeenCalledExactlyOnceWith({
      from: "noreply@language-duel.com",
      ...args,
    });
  });
  it("rejects missing configuration before constructing a provider", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    await expect(run()).rejects.toThrow(
      "RESEND_API_KEY environment variable not set",
    );
    expect(construct).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
  it("reports provider-declared errors instead of successful delivery", async () => {
    send.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    await expect(run()).rejects.toThrow("Email send failed: rate limited");
  });
  it("propagates a rejected provider request", async () => {
    send.mockRejectedValue(new Error("network failed"));
    await expect(run()).rejects.toThrow("network failed");
  });
  it("preserves successful delivery when the provider omits the optional response data", async () => {
    send.mockResolvedValue({ data: null, error: null });
    await expect(run()).resolves.toEqual({
      success: true,
      messageId: undefined,
    });
  });
});
