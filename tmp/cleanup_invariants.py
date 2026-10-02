from pathlib import Path
import re

def edit(path,replacements):
 p=Path(path);s=p.read_text()
 for a,b in replacements:
  if a not in s: print('Pattern absent',path,a[:60])
  s=s.replace(a,b)
 p.write_text(s)
for root in ['app/duel','convex']:
 for p in Path(root).rglob('*.ts*'):
  s=p.read_text().replace('.duelQuestions.[','.duelQuestions[').replace('.duelQuestions?.[','.duelQuestions[')
  p.write_text(s)
edit('lib/duel/relayEngine.ts',[
 ('import type { SessionItem } from "../sessionItems";','import type { SessionItem } from "../sessionItems";\nimport { requireRelayValue } from "./relayState";'),
 ('duel.relayPicker ?? "challenger"','requireRelayValue(duel.relayPicker, "relayPicker")'),
 ('duel.relayResolvedIndices ?? []','requireRelayValue(duel.relayResolvedIndices, "relayResolvedIndices")'),
 ('duel.relayHardUpgradeIndices ?? []','requireRelayValue(duel.relayHardUpgradeIndices, "relayHardUpgradeIndices")'),
 ('duel.relayHardBudget ?? { challenger: 0, opponent: 0 }','requireRelayValue(duel.relayHardBudget, "relayHardBudget")'),
 ('const set = upgraded ? duel.relayHardQuestions : duel.duelQuestions;\n  return set?.[position];','const set = upgraded\n    ? requireRelayValue(duel.relayHardQuestions, "relayHardQuestions")\n    : duel.duelQuestions;\n  const question = set[position];\n  if (!question) throw new Error("Relay assigned position is missing its question");\n  return question;')])
edit('convex/relayDuel.ts',[
 ('import { RELAY_QUESTION_POINTS }','import { requireRelayValue, requireRelayState } from "../lib/duel/relayState";\nimport { RELAY_QUESTION_POINTS }'),
 ('duel.relayAnswerStartedAt ?? 0','requireRelayValue(duel.relayAnswerStartedAt, "relayAnswerStartedAt")'),
 ('(duel.relayHardBudget?.[playerRole] ?? 0)','requireRelayState(duel).relayHardBudget[playerRole]')])
edit('convex/duels.ts',[
 ('import { v } from "convex/values";','import { v } from "convex/values";\nimport { requireRelayState } from "../lib/duel/relayState";'),
 ('function buildRelaySafeDuel(duel: Doc<"duels">) {','function buildRelaySafeDuel(source: Doc<"duels">) {\n  const duel = requireRelayState(source);')])
edit('app/duel/[duelId]/components/RelayDuelView.tsx',[
 ('"use client";','"use client";\n\nimport { requireRelayState } from "@/lib/duel/relayState";'),
 ('  const phase = duel.relayPhase ?? "pick";\n  const picker = duel.relayPicker ?? "challenger";','  const state = requireRelayState(duel);\n  const phase = state.relayPhase;\n  const picker = state.relayPicker;'),
 ('duel.relayHardBudget?.[viewerRole] ?? 0','requireRelayState(duel).relayHardBudget[viewerRole]'),
 ('duel.relayRemainingPositions ?? []','duel.relayRemainingPositions'),
 ('duel.relayResolvedIndices?.length ?? 0','requireRelayState(duel).relayResolvedIndices.length'),
 ('  const itemAt = (position: number) =>\n    duel.sessionItems[duel.itemOrder[position]];','  const itemAt = (position: number) => {\n    const item = duel.sessionItems[duel.itemOrder[position]];\n    if (!item) throw new Error("Relay position is missing its session item");\n    return item;\n  };'),
 ('    if (!item) return "";\n',''),('itemAt(position)?.themeName ?? ""','itemAt(position).themeName'),('itemAt(position)?.kind','itemAt(position).kind')])
edit('app/duel/[duelId]/components/TurnByTurnView.tsx',[('  const themeName = sessionItem?.themeName ?? "";','  if (!sessionItem) throw new Error("Turn-by-turn round is missing its session item");\n  const themeName = sessionItem.themeName;')])
edit('convex/weeklyGoalRepetitions/board.ts',[
 ('import type { QueryCtx }','import { ConvexError } from "convex/values";\nimport type { QueryCtx }'),
 ('    if (!record || typeof goal.completedAt !== "number") {\n      continue;\n    }','    if (typeof goal.completedAt !== "number") {\n      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Completed goal is missing completion time." });\n    }\n    if (!record) continue;'),
 ('(a.dueAt ?? 0) - (b.dueAt ?? 0)','requireDueAt(a) - requireDueAt(b)'),
 ('  return goal !== null && goal.status === "completed" && typeof goal.completedAt === "number" && isGoalParticipant(goal, userId);','  if (goal === null || goal.status !== "completed" || !isGoalParticipant(goal, userId)) return false;\n  if (typeof goal.completedAt !== "number") {\n    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Completed goal is missing completion time." });\n  }\n  return true;')])
p=Path('convex/weeklyGoalRepetitions/board.ts');p.write_text(p.read_text()+'''\nfunction requireDueAt(item: BoardItem): number {
  if (item.dueAt === null) throw new ConvexError({ code: "INTERNAL_ERROR", message: "Pending repetition is missing its due time." });
  return item.dueAt;
}
''')
p=Path('convex/weeklyGoalRepetitions/attemptMutations.ts');s=p.read_text();a=s.index('    console.warn(\n      "Skipping spaced repetition advance: completed goal is missing completedAt."');b=s.index('\n  }',a);s=s[:a]+'''    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Completed goal is missing completion time." });'''+s[b:];p.write_text(s)
edit('app/notifications/components/NotificationCards.tsx',[
 ('  const payload = isChallengeInvitePayload(notification.payload) ? notification.payload : undefined;\n  const themeName = payload?.themeName || "Theme";','  const payload = notification.payload;\n  if (!isChallengeInvitePayload(payload)) throw new Error("Challenge notification has an invalid payload");\n  const themeName = payload.themeName;'),
 ('event: WeeklyGoalNotificationEvent | undefined','event: WeeklyGoalNotificationEvent'),
 ('  const payload = isWeeklyGoalPayload(notification.payload) ? notification.payload : undefined;\n  const archiveLabel = `Archive ${themeCountLabel(payload?.themeCount ?? 0)}`;\n  const content = weeklyGoalContent(notification, actions, payload?.event, archiveLabel);','  const payload = notification.payload;\n  if (!isWeeklyGoalPayload(payload)) throw new Error("Weekly goal notification has an invalid payload");\n  const archiveLabel = `Archive ${themeCountLabel(payload.themeCount)}`;\n  const content = weeklyGoalContent(notification, actions, payload.event, archiveLabel);'),
 ('{ payload?: ChallengeInvitePayload }','{ payload: ChallengeInvitePayload }'),
 ('payload?.duelDifficultyPreset','payload.duelDifficultyPreset'),('payload?.duelMode','payload.duelMode'),
 ('  if (!difficulty && !duelMode) return null;\n','')])
