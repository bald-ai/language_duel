"use client";

import { formatDuration, formatScore } from "@/lib/displayFormat";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  formatBossTrophy,
  getBossTrophy,
  type BossType,
} from "@/lib/limitedLives";

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
  const result = resultAnnouncement({
    bossType,
    livesRemaining,
    myScore,
    theirScore,
  });
  const resultClass = colors.status[result.tone].light;

  const panelStyle = {
    backgroundColor: colors.background.elevated,
    borderColor: colors.primary.dark,
    boxShadow: `0 18px 45px ${colors.primary.glow}`,
  };

  const primaryButtonStyle = {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.dark,
    color: colors.text.DEFAULT,
  };

  return (
    <div className="w-full max-w-md mt-4">
      <div className="rounded-xl p-6 border-2" style={panelStyle}>
        <div
          className="text-center text-xl font-bold mb-4"
          style={{ color: colors.cta.light }}
        >
          {result.isBossResult ? "Boss Attempt Complete" : "Duel Complete!"}
        </div>

        {/* Winner announcement */}
        <div
          className="text-center font-bold text-2xl mb-4"
          style={{ color: resultClass }}
        >
          {result.text}
        </div>

        {result.isBossResult && (
          <BossResultDetails
            bossType={bossType}
            livesRemaining={livesRemaining!}
            livesTotal={livesTotal}
          />
        )}

        {/* Total Duration */}
        <ResultDuration duration={duelDuration} />

        {/* Final Scores */}
        <ResultScores
          myName={myName}
          theirName={theirName}
          myScore={myScore}
          theirScore={theirScore}
        />

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

function resultAnnouncement({
  bossType,
  livesRemaining,
  myScore,
  theirScore,
}: Pick<
  FinalResultsPanelProps,
  "bossType" | "livesRemaining" | "myScore" | "theirScore"
>): {
  isBossResult: boolean;
  tone: "danger" | "success" | "warning";
  text: string;
} {
  if (bossType && typeof livesRemaining === "number") {
    if (livesRemaining <= 0)
      return { isBossResult: true, tone: "danger", text: "Boss run failed" };
    return {
      isBossResult: true,
      tone: "success",
      text: bossType === "mini" ? "Mini Boss defeated" : "Big Boss defeated",
    };
  }
  if (myScore === theirScore)
    return { isBossResult: false, tone: "warning", text: "It's a tie!" };
  return {
    isBossResult: false,
    tone: myScore > theirScore ? "success" : "danger",
    text: myScore > theirScore ? "You won! 🎉" : "You lost!",
  };
}

function ResultSection({
  children,
  centered = false,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  const colors = useAppearanceColors();
  return (
    <div
      className={`rounded-lg p-4 mb-4 border${centered ? " text-center" : ""}`}
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      {children}
    </div>
  );
}

function BossResultDetails({
  bossType,
  livesRemaining,
  livesTotal,
}: Pick<FinalResultsPanelProps, "bossType" | "livesTotal"> & {
  livesRemaining: number;
}) {
  const colors = useAppearanceColors();
  if (livesRemaining <= 0)
    return (
      <ResultSection centered>
        <p
          className="font-semibold"
          style={{ color: colors.status.danger.light }}
        >
          You ran out of shared lives.
        </p>
      </ResultSection>
    );
  if (bossType !== "big") return null;
  const trophy = getBossTrophy(livesRemaining);
  return (
    <ResultSection centered>
      {trophy && (
        <>
          <div className="text-sm mb-1" style={{ color: colors.text.muted }}>
            Trophy Earned
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: colors.cta.light }}
          >
            {formatBossTrophy(trophy)}
          </div>
        </>
      )}
      <div
        className={
          trophy ? "mt-3 text-sm font-semibold" : "text-sm font-semibold"
        }
        style={{ color: colors.status.success.light }}
      >
        Lives Left: {livesRemaining}
        {typeof livesTotal === "number" ? `/${livesTotal}` : ""}
      </div>
    </ResultSection>
  );
}

function ResultDuration({ duration }: { duration?: number }) {
  const colors = useAppearanceColors();
  if (duration === undefined || duration <= 0) return null;
  return (
    <ResultSection>
      <div
        className="text-center text-sm mb-1"
        style={{ color: colors.text.muted }}
      >
        Total Time
      </div>
      <div
        className="text-center text-2xl font-bold font-mono"
        style={{ color: colors.text.DEFAULT }}
      >
        {formatDuration(duration)}
      </div>
    </ResultSection>
  );
}

function ResultScores({
  myName,
  theirName,
  myScore,
  theirScore,
}: Pick<
  FinalResultsPanelProps,
  "myName" | "theirName" | "myScore" | "theirScore"
>) {
  const colors = useAppearanceColors();
  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;
  return (
    <ResultSection>
      <div
        className="text-center text-sm mb-3"
        style={{ color: colors.text.muted }}
      >
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
    </ResultSection>
  );
}
