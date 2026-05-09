import { describe, expect, it } from "vitest";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "@/app/goals/bossUi";
import { colors } from "@/lib/theme";

describe("bossUi", () => {
  it("formats defeated bosses with a checkmark", () => {
    expect(formatBossStatus("defeated")).toBe("✓ Defeated");
    expect(formatBossStatus("ready")).toBe("Ready");
    expect(formatBossStatus("unavailable")).toBe("Unavailable");
  });

  it("uses distinct styles for unavailable, ready, and defeated states", () => {
    const unavailable = getBossButtonStyle("unavailable");
    expect(unavailable.borderColor).toBe(colors.primary.dark);
    expect(unavailable.backgroundColor).toBe(colors.background.DEFAULT);

    const ready = getBossButtonStyle("ready");
    expect(ready.borderColor).toBe(colors.cta.DEFAULT);
    expect(ready.backgroundColor).toBe(`${colors.cta.DEFAULT}15`);

    const defeated = getBossButtonStyle("defeated");
    expect(defeated.borderColor).toBe(colors.status.success.DEFAULT);
    expect(defeated.backgroundColor).toBe(`${colors.status.success.DEFAULT}15`);
  });

  it("disables every boss button that cannot be opened", () => {
    expect(isBossButtonDisabled("unavailable")).toBe(true);
    expect(isBossButtonDisabled("ready")).toBe(false);
    expect(isBossButtonDisabled("defeated")).toBe(true);
  });

  it("keeps the boss explainer copy simple and specific", () => {
    expect(BOSS_INFO_COPY.mini).toMatch(/halfway/);
    expect(BOSS_INFO_COPY.mini).toMatch(/shared life/);
    expect(BOSS_INFO_COPY.big).toMatch(/shared/);
    expect(BOSS_INFO_COPY.big).toMatch(/themes are completed/i);
    expect(BOSS_INFO_COPY.big).toMatch(/Bronze or better/);
  });
});
