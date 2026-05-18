import { describe, expect, it } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import { assertDuelMode } from "@/convex/rules/duelModeGuards";

describe("assertDuelMode", () => {
  it("allows the expected duel mode", () => {
    expect(() =>
      assertDuelMode({ duelMode: "pvp" } as Pick<Doc<"duels">, "duelMode">, "pvp", "sendSabotage")
    ).not.toThrow();
  });

  it("throws WRONG_MODE for mismatched mode-specific mutations", () => {
    expect(() =>
      assertDuelMode({ duelMode: "pve" } as Pick<Doc<"duels">, "duelMode">, "pvp", "sendSabotage")
    ).toThrow("sendSabotage is only available in PVP duels");
  });
});
