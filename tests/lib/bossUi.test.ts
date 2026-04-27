import { describe, expect, it } from "vitest";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "@/lib/bossUi";
import { colors } from "@/lib/theme";

describe("bossUi", () => {
  it("formats defeated bosses with a checkmark", () => {
    expect(formatBossStatus("defeated")).toBe("✓ Defeated");
    expect(formatBossStatus("ready")).toBe("Ready");
    expect(formatBossStatus("unavailable")).toBe("Unavailable");
  });

  it("uses distinct styles for unavailable, ready, and defeated states", () => {
    expect(getBossButtonStyle("unavailable")).toEqual({
      borderColor: colors.primary.dark,
      backgroundColor: colors.background.DEFAULT,
    });
    expect(getBossButtonStyle("ready")).toEqual({
      borderColor: colors.cta.DEFAULT,
      backgroundColor: `${colors.cta.DEFAULT}15`,
    });
    expect(getBossButtonStyle("defeated")).toEqual({
      borderColor: colors.status.success.DEFAULT,
      backgroundColor: `${colors.status.success.DEFAULT}15`,
    });
  });

  it("disables every boss button that cannot be opened", () => {
    expect(isBossButtonDisabled("unavailable")).toBe(true);
    expect(isBossButtonDisabled("ready")).toBe(false);
    expect(isBossButtonDisabled("defeated")).toBe(true);
  });

  it("keeps the boss explainer copy simple and specific", () => {
    expect(BOSS_INFO_COPY.mini).toContain("halfway through shared completed themes");
    expect(BOSS_INFO_COPY.mini).toContain("+1 shared life");
    expect(BOSS_INFO_COPY.big).toContain("Lives are shared");
    expect(BOSS_INFO_COPY.big).toContain("Bronze or better");
  });
});
