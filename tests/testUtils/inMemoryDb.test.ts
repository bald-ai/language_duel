import { describe, expect, it } from "vitest";
import { createIndexedQuery } from "../convex/testUtils/inMemoryDb";

describe("indexed fixture uniqueness", () => {
  it("matches Convex unique semantics for zero, one and duplicate matches", async () => {
    const query = createIndexedQuery([{ _id: "1", user: "a" }, { _id: "2", user: "a" }, { _id: "3", user: "b" }]);
    await expect(query.withIndex("user", q => q.eq("user", "missing")).unique()).resolves.toBeNull();
    await expect(query.withIndex("user", q => q.eq("user", "b")).unique()).resolves.toEqual({ _id: "3", user: "b" });
    await expect(query.withIndex("user", q => q.eq("user", "a")).unique()).rejects.toThrow("more than one result");
    await expect(query.withIndex("user", q => q.eq("user", "a")).first()).resolves.toEqual({ _id: "1", user: "a" });
  });
});
