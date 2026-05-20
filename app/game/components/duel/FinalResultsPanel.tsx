"use client";

import { formatDuration, formatScore } from "@/lib/displayFormat";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatBossTrophy, getBossTrophy, type BossType } from "@/lib/limitedLives";

interface FinalResultsPanelProps {
  myName: string;
  theirName: string;
  myScore: number;
  theirScore: number;
  onBackToHome: () => void;
  // Optional duration display (for duel)
  duelDuration?: number;
  dataTestIdBack?: string;
  bossType?: BossType;
  livesRemaining?: number;
  livesTotal?: number;
}

/**
 * Final results panel shown when duel is completed.
 */
export function FinalResultsPanel({
  myName,
  theirName,
  myScore,
  theirScore,
  onBackToHome,
  duelDuration,
  dataTestIdBack,
  bossType,
  livesRemaining,
  livesTotal,
}: FinalResultsPanelProps) {
  const colors = useAppearanceColors();
  const isBossResult = !!bossType && typeof livesRemaining === "number";
  const bossFailed = isBossResult && livesRemaining <= 0;
  const bossTrophy = isBossResult && bossType === "big" && !bossFailed
    ? getBossTrophy(livesRemaining)
    : null;
  const showBossDetail = bossFailed || bossType === "big";

  const resultClass = (() => {
    if (bossFailed) return colors.status.danger.light;
    if (isBossResult) return colors.status.success.light;
    if (myScore === theirScore) return colors.status.warning.light;
    return myScore > theirScore
      ? colors.status.success.light
      : colors.status.danger.light;
  })();

  const resultText = (() => {
    if (bossFailed) return "Boss run failed";
    if (isBossResult) {
      return bossType === "mini" ? "Mini Boss defeated" : "Big Boss defeated";
    }
    if (myScore === theirScore) return "It's a tie!";
    return myScore > theirScore ? "You won! 🎉" : "You lost!";
  })();

  const panelStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const sectionStyle = {
    backgroundColor: colors.background.DEFAULT,
    borderColor: colors.primary.dark,
  };

  const primaryButtonStyle = {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  return (
    <div className="w-full max-w-md mt-4">
      <div className="rounded-xl p-6 border-2" style={panelStyle}>
        <div className="text-center text-xl font-bold mb-4" style={{ color: colors.cta.light }}>
          {isBossResult ? "Boss Attempt Complete" : "Duel Complete!"}
        </div>

        {/* Winner announcement */}
        <div className="text-center font-bold text-2xl mb-4" style={{ color: resultClass }}>
          {resultText}
        </div>

        {isBossResult && showBossDetail && (
          <div className="rounded-lg p-4 mb-4 border text-center" style={sectionStyle}>
            {bossFailed ? (
              <p className="font-semibold" style={{ color: colors.status.danger.light }}>
                You ran out of shared lives.
              </p>
            ) : (
              <>
                {bossTrophy && (
                  <>
                    <div className="text-sm mb-1" style={{ color: colors.text.muted }}>
                      Trophy Earned
                    </div>
                    <div className="text-2xl font-bold" style={{ color: colors.cta.light }}>
                      {formatBossTrophy(bossTrophy)}
                    </div>
                  </>
                )}
                <div className={bossTrophy ? "mt-3 text-sm font-semibold" : "text-sm font-semibold"} style={{ color: colors.status.success.light }}>
                  Lives Left: {livesRemaining}{typeof livesTotal === "number" ? `/${livesTotal}` : ""}
                </div>
              </>
            )}
          </div>
        )}

        {/* Total Duration */}
        {duelDuration !== undefined && duelDuration > 0 && (
          <div className="rounded-lg p-4 mb-4 border" style={sectionStyle}>
            <div className="text-center text-sm mb-1" style={{ color: colors.text.muted }}>
              Total Time
            </div>
            <div className="text-center text-2xl font-bold font-mono" style={{ color: colors.text.DEFAULT }}>
              {formatDuration(duelDuration)}
            </div>
          </div>
        )}

        {/* Final Scores */}
        <div className="rounded-lg p-4 mb-4 border" style={sectionStyle}>
          <div className="text-center text-sm mb-3" style={{ color: colors.text.muted }}>
            Final Score
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium" style={{ color: myColor }}>
              You ({myName?.split(" ")[0] || "You"})
            </span>
            <span className="text-2xl font-bold" style={{ color: myColor }}>
              {formatScore(myScore)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium" style={{ color: theirColor }}>
              {theirName?.split(" ")[0] || "Opponent"}
            </span>
            <span className="text-2xl font-bold" style={{ color: theirColor }}>
              {formatScore(theirScore)}
            </span>
          </div>
        </div>

        <button
          onClick={onBackToHome}
          className="w-full font-bold py-3 px-6 rounded-lg text-lg transition hover:brightness-110 border-2"
          style={primaryButtonStyle}
          data-testid={dataTestIdBack}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
