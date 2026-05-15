import { describe, expect, it } from "vitest";
import {
  formatPaddedHandle,
  formatVisibleUser,
  getVisibleUserInitials,
} from "@/lib/userDisplay";

describe("userDisplay", () => {
  it("formats padded handles only when nickname and finite discriminator exist", () => {
    expect(formatPaddedHandle({ nickname: "Alex", discriminator: 7 })).toBe("Alex#0007");
    expect(formatPaddedHandle({ nickname: "Alex", discriminator: NaN })).toBeNull();
    expect(formatPaddedHandle({ nickname: "Alex", discriminator: null })).toBeNull();
  });

  it("uses handle, nickname, name, email prefix, then fallback for visible labels", () => {
    expect(formatVisibleUser({ nickname: "Alex", discriminator: 12 })).toBe("Alex#0012");
    expect(formatVisibleUser({ nickname: "Alex" })).toBe("Alex");
    expect(formatVisibleUser({ name: "Alex Smith" })).toBe("Alex Smith");
    expect(formatVisibleUser({ email: "alex@example.com" })).toBe("alex");
    expect(formatVisibleUser(null, "Unknown")).toBe("Unknown");
  });

  it("returns compact initials for handles, names, and fallbacks", () => {
    expect(getVisibleUserInitials({ nickname: "Alex", discriminator: 12 })).toBe("A");
    expect(getVisibleUserInitials({ name: "Alex Smith" })).toBe("AS");
    expect(getVisibleUserInitials(null)).toBe("?");
  });
});
