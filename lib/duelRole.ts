import type { SabotageState } from "./sabotage/types";

export type DuelRole = "challenger" | "opponent";

type DuelDoc = {
  challengerScore: number;
  opponentScore: number;
  challengerAnswered: boolean;
  opponentAnswered: boolean;
  challengerLastAnswer?: string;
  opponentLastAnswer?: string;
  challengerSabotage?: SabotageState;
  opponentSabotage?: SabotageState;
  challengerSabotagesUsed?: number;
  opponentSabotagesUsed?: number;
};

export type DuelRoleView = {
  myScore: number;
  theirScore: number;
  myAnswered: boolean;
  theirAnswered: boolean;
  myLastAnswer?: string;
  theirLastAnswer?: string;
  mySabotage?: SabotageState;
  theirSabotage?: SabotageState;
  mySabotagesUsed: number;
  theirSabotagesUsed: number;
  theirRole: DuelRole;
};

function participantView(duel: DuelDoc, role: DuelRole) {
  return {
    score: duel[`${role}Score`],
    answered: duel[`${role}Answered`],
    lastAnswer: duel[`${role}LastAnswer`],
    sabotage: duel[`${role}Sabotage`],
    sabotagesUsed: duel[`${role}SabotagesUsed`] ?? 0,
  };
}

export function forRole(duel: DuelDoc, role: DuelRole): DuelRoleView {
  const myRole = role === "challenger" ? "challenger" : "opponent";
  const theirRole = myRole === "challenger" ? "opponent" : "challenger";
  const mine = participantView(duel, myRole);
  const theirs = participantView(duel, theirRole);
  return {
    myScore: mine.score, theirScore: theirs.score,
    myAnswered: mine.answered, theirAnswered: theirs.answered,
    myLastAnswer: mine.lastAnswer, theirLastAnswer: theirs.lastAnswer,
    mySabotage: mine.sabotage, theirSabotage: theirs.sabotage,
    mySabotagesUsed: mine.sabotagesUsed, theirSabotagesUsed: theirs.sabotagesUsed,
    theirRole,
  };
}
