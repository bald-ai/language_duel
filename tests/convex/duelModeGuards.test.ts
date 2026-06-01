import { describe, expect, it } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  assertDuelMode,
  assertRelayUnavailable,
  assertTbtUnavailable,
} from "@/convex/rules/duelModeGuards";

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

  // Regression for Slice 7: the legacy mode-specific mutations reject relay
  // duels because they assert a specific non-relay mode.
  it("rejects relay duels for PvP-only mutations (sabotage / hints)", () => {
    const relay = { duelMode: "relay" } as Pick<Doc<"duels">, "duelMode">;
    expect(() => assertDuelMode(relay, "pvp", "sendSabotage")).toThrow("WRONG_MODE");
    expect(() => assertDuelMode(relay, "pvp", "requestHint")).toThrow("WRONG_MODE");
  });

  it("rejects relay duels for PvE-only mutations (hint pool)", () => {
    expect(() =>
      assertDuelMode({ duelMode: "relay" } as Pick<Doc<"duels">, "duelMode">, "pve", "fireHint")
    ).toThrow("WRONG_MODE");
  });
});

describe("assertRelayUnavailable", () => {
  it("throws WRONG_MODE for relay on limited-lives surfaces", () => {
    expect(() => assertRelayUnavailable("relay", "boss duels")).toThrow(
      "Relay is not available for boss duels"
    );
    expect(() => assertRelayUnavailable("relay", "spaced repetition duels")).toThrow("WRONG_MODE");
  });

  it("allows pvp and pve", () => {
    expect(() => assertRelayUnavailable("pvp", "boss duels")).not.toThrow();
    expect(() => assertRelayUnavailable("pve", "spaced repetition duels")).not.toThrow();
  });
});

describe("assertTbtUnavailable", () => {
  it("throws WRONG_MODE for Tag Team on limited-lives surfaces", () => {
    expect(() => assertTbtUnavailable("tbt", "boss duels")).toThrow(
      "Tag Team is not available for boss duels"
    );
    expect(() => assertTbtUnavailable("tbt", "spaced repetition duels")).toThrow("WRONG_MODE");
  });

  it("allows pvp and pve", () => {
    expect(() => assertTbtUnavailable("pvp", "boss duels")).not.toThrow();
    expect(() => assertTbtUnavailable("pve", "spaced repetition duels")).not.toThrow();
  });
});
