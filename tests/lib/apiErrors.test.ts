import { describe, expect, it } from "vitest";
import { getResponseErrorMessage } from "@/lib/api/errors";

describe("getResponseErrorMessage", () => {
  it("returns fallback text when response body is empty", async () => {
    const response = new Response("", { status: 500 });
    await expect(getResponseErrorMessage(response)).resolves.toBe("Request failed (500)");
  });

  it("returns error field from JSON body", async () => {
    const response = new Response(JSON.stringify({ error: "Bad Request" }), { status: 400 });
    await expect(getResponseErrorMessage(response)).resolves.toBe("Bad Request");
  });

  it("returns message field from JSON body", async () => {
    const response = new Response(JSON.stringify({ message: "No access" }), { status: 403 });
    await expect(getResponseErrorMessage(response)).resolves.toBe("No access");
  });

  it("returns raw text when body is not JSON", async () => {
    const response = new Response("Plain failure text", { status: 500 });
    await expect(getResponseErrorMessage(response)).resolves.toBe("Plain failure text");
  });

  it("returns fallback when reading response body throws", async () => {
    const badResponse = {
      status: 502,
      text: async () => {
        throw new Error("read failed");
      },
    } as unknown as Response;

    await expect(getResponseErrorMessage(badResponse)).resolves.toBe("Request failed (502)");
  });
});
