import { describe, expect, it } from "vitest";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "@/lib/bossUi";
import { colors } from "@/lib/theme";

describe("bossUi", () => {
  it("formats completed bosses with a checkmark", () => {
    expect(formatBossStatus("completed")).toBe("✓ Defeated");
    expect(formatBossStatus("available")).toBe("Ready");
    expect(formatBossStatus("locked")).toBe("Locked");
  });

  it("uses distinct styles for locked, available, and completed states", () => {
    expect(getBossButtonStyle("locked")).toEqual({
      borderColor: colors.primary.dark,
      backgroundColor: colors.background.DEFAULT,
    });
    expect(getBossButtonStyle("available")).toEqual({
      borderColor: colors.cta.DEFAULT,
      backgroundColor: `${colors.cta.DEFAULT}15`,
    });
    expect(getBossButtonStyle("completed")).toEqual({
      borderColor: colors.status.success.DEFAULT,
      backgroundColor: `${colors.status.success.DEFAULT}15`,
    });
  });

  it("disables every boss button that cannot be opened", () => {
    expect(isBossButtonDisabled("locked")).toBe(true);
    expect(isBossButtonDisabled("available")).toBe(false);
    expect(isBossButtonDisabled("completed")).toBe(true);
  });

  it("keeps the boss explainer copy simple and specific", () => {
    expect(BOSS_INFO_COPY.mini).toContain("half your themes");
    expect(BOSS_INFO_COPY.big).toContain("all your themes");
  });
});
