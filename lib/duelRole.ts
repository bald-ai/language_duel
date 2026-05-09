import type { Doc } from "../convex/_generated/dataModel";

export type DuelRole = "challenger" | "opponent";

type DuelDoc = Doc<"duels">;

export type DuelRoleView = {
  myScore: number;
  theirScore: number;
  myAnswered: boolean;
  theirAnswered: boolean;
  myLastAnswer?: string;
  theirLastAnswer?: string;
  mySabotage?: DuelDoc["challengerSabotage"];
  theirSabotage?: DuelDoc["challengerSabotage"];
  mySabotagesUsed: number;
  theirSabotagesUsed: number;
  theirRole: DuelRole;
};

export function forRole(duel: DuelDoc, role: DuelRole): DuelRoleView {
  const isChallenger = role === "challenger";

  return {
    myScore: isChallenger ? duel.challengerScore : duel.opponentScore,
    theirScore: isChallenger ? duel.opponentScore : duel.challengerScore,
    myAnswered: isChallenger ? duel.challengerAnswered : duel.opponentAnswered,
    theirAnswered: isChallenger ? duel.opponentAnswered : duel.challengerAnswered,
    myLastAnswer: isChallenger ? duel.challengerLastAnswer : duel.opponentLastAnswer,
    theirLastAnswer: isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer,
    mySabotage: isChallenger ? duel.challengerSabotage : duel.opponentSabotage,
    theirSabotage: isChallenger ? duel.opponentSabotage : duel.challengerSabotage,
    mySabotagesUsed: isChallenger
      ? (duel.challengerSabotagesUsed ?? 0)
      : (duel.opponentSabotagesUsed ?? 0),
    theirSabotagesUsed: isChallenger
      ? (duel.opponentSabotagesUsed ?? 0)
      : (duel.challengerSabotagesUsed ?? 0),
    theirRole: isChallenger ? "opponent" : "challenger",
  };
}
