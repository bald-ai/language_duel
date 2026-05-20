import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { ApiRouteError } from "./serverErrors";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";

/**
 * Build a Convex HTTP client authenticated as the current Clerk user.
 * Throws ApiRouteError when Convex is unconfigured or the request is unauthenticated.
 */
export async function getAuthedConvexClient(): Promise<ConvexHttpClient> {
  if (!CONVEX_URL) {
    throw new ApiRouteError("CONFIG_ERROR", "Convex URL not configured", 500);
  }

  const authResult = await auth();
  if (!authResult.userId) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }

  const token = await authResult.getToken({ template: "convex" });
  if (!token) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}
