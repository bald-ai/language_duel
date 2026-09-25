import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ isPublic: vi.fn(), auth: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  createRouteMatcher: () => mocks.isPublic,
  clerkMiddleware: (callback: unknown) => callback,
}));
import middleware from "@/proxy";
afterEach(() => vi.resetAllMocks());
const run = () => (middleware as unknown as (auth: typeof mocks.auth, request: NextRequest) => Promise<Response | undefined>)(mocks.auth, new NextRequest("https://example.test/duels"));
describe("proxy authentication boundary", () => {
  it("allows public routes without authentication", async () => {
    mocks.isPublic.mockReturnValue(true);
    expect(await run()).toBeUndefined();
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated protected requests", async () => {
    mocks.isPublic.mockReturnValue(false);
    mocks.auth.mockResolvedValue({ userId: null });
    const response = await run();
    expect(response?.status).toBe(401);
    expect(await response?.text()).toBe("Unauthorized");
  });
  it("allows authenticated protected requests", async () => {
    mocks.isPublic.mockReturnValue(false);
    mocks.auth.mockResolvedValue({ userId: "user-1" });
    expect(await run()).toBeUndefined();
    expect(mocks.auth).toHaveBeenCalledTimes(1);
  });
});
