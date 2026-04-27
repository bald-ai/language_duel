export type BossType = "mini" | "big";
export type BossTrophy = "gold" | "silver" | "bronze";

export function calculateBossStartingLives({
  bossType,
  themeCount,
  miniBossDefeated,
}: {
  bossType: BossType;
  themeCount: number;
  miniBossDefeated: boolean;
}): number {
  if (bossType === "mini") {
    return Math.max(0, themeCount) + 1;
  }

  return miniBossDefeated ? 4 : 3;
}

export function getBossTrophy(livesRemaining: number): BossTrophy | null {
  if (livesRemaining >= 3) return "gold";
  if (livesRemaining === 2) return "silver";
  if (livesRemaining === 1) return "bronze";
  return null;
}

export function formatBossTrophy(trophy: BossTrophy): string {
  switch (trophy) {
    case "gold":
      return "Gold Trophy";
    case "silver":
      return "Silver Trophy";
    case "bronze":
      return "Bronze Trophy";
  }
}
