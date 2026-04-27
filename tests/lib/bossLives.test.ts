import { describe, expect, it } from "vitest";
import {
  calculateBossStartingLives,
  formatBossTrophy,
  getBossTrophy,
} from "@/lib/bossLives";

describe("bossLives", () => {
  it("starts mini boss with one more life than the included theme count", () => {
    expect(
      calculateBossStartingLives({
        bossType: "mini",
        themeCount: 3,
        miniBossDefeated: false,
      })
    ).toBe(4);
  });

  it("adds one big boss life when mini boss was defeated first", () => {
    expect(
      calculateBossStartingLives({
        bossType: "big",
        themeCount: 10,
        miniBossDefeated: true,
      })
    ).toBe(4);
    expect(
      calculateBossStartingLives({
        bossType: "big",
        themeCount: 10,
        miniBossDefeated: false,
      })
    ).toBe(3);
  });

  it("derives big boss trophies from lives left", () => {
    expect(getBossTrophy(4)).toBe("gold");
    expect(getBossTrophy(3)).toBe("gold");
    expect(getBossTrophy(2)).toBe("silver");
    expect(getBossTrophy(1)).toBe("bronze");
    expect(getBossTrophy(0)).toBeNull();
    expect(formatBossTrophy("gold")).toBe("Gold Trophy");
  });
});
