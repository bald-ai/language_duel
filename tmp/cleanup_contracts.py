from pathlib import Path

def edit(path, replacements):
 p=Path(path); s=p.read_text()
 for a,b in replacements:
  if a not in s: print('Pattern absent:',path,a[:70])
  s=s.replace(a,b)
 p.write_text(s)
edit('convex/schema.ts',[
 ('nickname: v.optional(v.string())','nickname: v.string()'),
 ('llmCreditsRemaining: v.optional(v.number())','llmCreditsRemaining: v.number()'),
 ('ttsGenerationsRemaining: v.optional(v.number())','ttsGenerationsRemaining: v.number()'),
 ('creditsMonth: v.optional(v.string())','creditsMonth: v.string()'),
 ('wordType: optionalWordTypeValidator','wordType: wordTypeValidator'),
 ('ownerId: v.optional(v.id("users"))','ownerId: v.id("users")'),
 ('visibility: v.optional(v.union(v.literal("private"), v.literal("shared")))','visibility: v.union(v.literal("private"), v.literal("shared"))'),
 ('duelDifficultyPreset: v.optional(duelDifficultyPresetValidator)','duelDifficultyPreset: duelDifficultyPresetValidator'),
 ('duelQuestions: v.optional(v.array(duelQuestionValidator))','duelQuestions: v.array(duelQuestionValidator)'),
 ('payload: v.optional(notificationPayloadValidator)','payload: notificationPayloadValidator'),
 ('themeName: v.optional(v.string())','themeName: v.string()'),
 ('event: v.optional(\n      v.union(','event: v.union('),
 ('v.literal("goal_completed_solo")\n      )\n    ),','v.literal("goal_completed_solo")\n    ),'),
 ('  v.object({\n    challengeId: v.id("challenges"),','  v.object({\n    goalId: v.id("weeklyGoals"),\n    themeCount: v.number(),\n  }),\n  v.object({\n    challengeId: v.id("challenges"),'),
])
edit('convex/credits.ts', [('user.creditsMonth !== creditsMonth ||\n    user.llmCreditsRemaining === undefined ||\n    user.ttsGenerationsRemaining === undefined','user.creditsMonth !== creditsMonth'),('user.llmCreditsRemaining!','user.llmCreditsRemaining'),('user.ttsGenerationsRemaining!','user.ttsGenerationsRemaining')])
edit('convex/users.ts',[('nickname?: string','nickname: string'),('u.nickname?.toLowerCase()','u.nickname.toLowerCase()')])
edit('app/settings/components/NicknameEditor.tsx',[('currentNickname || ""','currentNickname')])
edit('convex/rules/duelScoringRules.ts',[('(duel.opponentScore || 0)','duel.opponentScore'),('(duel.challengerScore || 0)','duel.challengerScore')])
edit('lib/answerShuffle.ts',[('word.wrongAnswers?.length','word.wrongAnswers.length')])
edit('convex/weeklyGoals/readModels.ts',[('goal.createdAt ?? 0','goal.createdAt')])
edit('lib/themeAccess.ts',[
 ('ownerId: Id<"users"> | undefined','ownerId: Id<"users">'),('visibility: "private" | "shared" | undefined','visibility: "private" | "shared"'),
 ('    if (!ownerId) {\n        return false;\n    }\n\n',''),('theme: { ownerId?: Id<"users"> | undefined }','theme: { ownerId: Id<"users"> }'),
 ('theme.visibility !== "shared" || !theme.ownerId','theme.visibility !== "shared"')])
edit('convex/themes/readModels.ts',[('theme.ownerId ? friendshipsWithOwner : []','friendshipsWithOwner')])
edit('convex/themes/listQueries.ts',[
 ('    .map((theme) => theme.ownerId)\n    .filter((ownerId): ownerId is Id<"users"> => ownerId !== undefined)','    .map((theme) => theme.ownerId)'),
 ('owner: theme.ownerId ? (ownersById.get(theme.ownerId) ?? null) : null','owner: ownersById.get(theme.ownerId) ?? null'),
 ('friendshipsWithOwner: theme.ownerId\n        ? (friendshipPairsByOwnerId.get(String(theme.ownerId)) ?? [])\n        : []','friendshipsWithOwner: friendshipPairsByOwnerId.get(String(theme.ownerId)) ?? []')])
edit('lib/themes/themeContent.ts',[
 ('export interface ThemeContentShape {\n  contentType: ThemeContentType;\n  words?: WordEntry[];\n  sentenceRounds?: SentenceRoundInput[];\n}','export type ThemeContentShape =\n  | { contentType: "word"; words: WordEntry[] }\n  | { contentType: "sentence"; sentenceRounds: SentenceRoundInput[] };'),
 ('theme.sentenceRounds?.length ?? 0','theme.sentenceRounds.length'),('theme.words?.length ?? 0','theme.words.length')])
edit('lib/sessionItems.ts',[
 ('import type { SentenceRoundInput, ThemeContentType }','import type { SentenceRoundInput }'),
 ('export interface SessionThemeInput {','type SessionThemeIdentity = {'),
 ('  contentType: ThemeContentType;\n  words?: Array<{\n    word: string;\n    answer: string;\n    wrongAnswers: string[];\n    ttsStorageId?: Id<"_storage">;\n  }>;\n  sentenceRounds?: SentenceRoundInput[];\n}','};\n\nexport type SessionThemeInput = SessionThemeIdentity & (\n  | { contentType: "word"; words: Array<Omit<SessionWordItem, "kind" | "themeId" | "themeName">> }\n  | { contentType: "sentence"; sentenceRounds: SentenceRoundInput[] }\n);'),
 ('theme.sentenceRounds ?? []','theme.sentenceRounds'),('theme.words ?? []','theme.words')])
for path in ['convex/themes/mutations.ts','app/themes/components/ThemeList.tsx','app/themes/components/ThemeCard.tsx','app/goals/components/GoalThemeSelector.tsx','hooks/challengeLobby/useChallengeData.ts']:
 p=Path(path); s=p.read_text()
 for field in ['words','sentenceRounds']:
  s=s.replace(f'theme.{field} ?? []',f'theme.{field}').replace(f'theme.{field}?.length ?? 0',f'theme.{field}.length')
 s=s.replace('theme.wordType || "nouns"','theme.wordType').replace('        fallback: "No category",\n','')
 s=s.replace('theme.sentenceRounds ??\n      []','theme.sentenceRounds')
 p.write_text(s)
edit('lib/themes/wordTypes.ts',[
 ('  wordType: WordType | undefined,\n  options?: { fallback?: string; uppercase?: boolean }','  wordType: WordType,\n  options?: { uppercase?: boolean }'),
 ('  const label = wordType ? WORD_TYPE_CONFIG[wordType]?.label : undefined;\n  const resolved = label ?? options?.fallback ?? WORD_TYPE_CONFIG[DEFAULT_WORD_TYPE].label;\n  return options?.uppercase ? resolved.toUpperCase() : resolved;','  const label = WORD_TYPE_CONFIG[wordType].label;\n  return options?.uppercase ? label.toUpperCase() : label;')])
edit('app/themes/components/ThemeDetail.tsx',[('wordType?: WordType','wordType: WordType'),('visibility?: "private" | "shared"','visibility: "private" | "shared"')])
edit('app/themes/hooks/useThemeDetailController.ts',[
 ('      // Saved themes can be sentence themes too — those flow through a\n      // separate controller (`useSentenceThemeController`). When a word-theme\n      // path lands here for a sentence theme (which shouldn\'t happen because\n      // `useThemesController.handleOpenTheme` routes sentence themes\n      // elsewhere), surface an empty `words` array rather than letting\n      // `undefined` leak into the editor.\n      const savedWords = isWordTheme(saved) ? saved.words : [];','      if (!isWordTheme(saved)) throw new Error("Word editor requires a word theme");'),
 ('words: (savedWords ?? []) as ThemeDetailTheme["words"]','words: saved.words'),
 ('const selectedWordType = selectedTheme?.wordType || DEFAULT_WORD_TYPE','const selectedWordType = selectedTheme === null ? DEFAULT_WORD_TYPE : selectedTheme.wordType'),
 ('      setSelectedThemeState({ kind: "saved", theme });\n      const themeWords = isWordTheme(theme) ? theme.words : [];\n      setLocalWords([...(themeWords ?? [])]);','      if (!isWordTheme(theme)) throw new Error("Word editor requires a word theme");\n      setSelectedThemeState({ kind: "saved", theme });\n      setLocalWords([...theme.words]);')])
edit('app/themes/hooks/useThemesController.ts',[('detail.selectedTheme?.visibility || "private"','detail.selectedTheme === null ? "private" : detail.selectedTheme.visibility'),('sentenceController.selectedTheme.visibility || "private"','sentenceController.selectedTheme.visibility')])
for path in ['convex/duels.ts','convex/tbtDuel.ts','convex/hints.ts','convex/rules/sentenceGameplayRules.ts','app/duel/[duelId]/components/TurnByTurnView.tsx','app/duel/[duelId]/hooks/useCrossKindRoundTransition.ts']:
 p=Path(path);s=p.read_text().replace('duel.duelQuestions?.','duel.duelQuestions.').replace('duel.duelQuestions?.[','duel.duelQuestions[');p.write_text(s)
edit('app/duel/[duelId]/components/DuelPageContent.tsx',[('  if (duel.duelMode !== "relay" && !duel.duelQuestions?.length)\n    return "Duel data is incomplete. Missing duel questions.";\n','')])
edit('app/duel/[duelId]/hooks/duelViewModelHelpers.ts',[('  const prevWord = rawPrev\n    ? requireWordSessionItem(rawPrev)\n    : { word: "", answer: "", wrongAnswers: [] };','  if (!rawPrev) throw new Error("Frozen round is missing its session item");\n  const prevWord = requireWordSessionItem(rawPrev);'),('duel.duelQuestions!','duel.duelQuestions')])
edit('app/duel/[duelId]/hooks/useDuelSessionViewModel.ts',[
 ('duel.currentItemIndex ?? 0','duel.currentItemIndex'),('duel.duelQuestions!','duel.duelQuestions'),
 ('  const themeName = (visibleItem as { themeName?: string } | undefined)\n    ?.themeName;\n  return typeof themeName === "string" ? themeName : null;','  if (!visibleItem) throw new Error("Round is missing its session item");\n  return visibleItem.themeName;')])
edit('app/duel/[duelId]/hooks/useDuelPhaseState.ts',[('currentItemIndex === undefined || ','')])
edit('convex/notificationPreferences.ts',[('...normalizeNotificationPreferences(prefs)','...prefs'),('      ...prefs,\n      userId: args.userId','      ...(prefs === null ? DEFAULT_NOTIFICATION_PREFS : prefs),\n      userId: args.userId')])
edit('convex/notificationPayloads.ts',[
 ('  { goalId: Id<"weeklyGoals"> }','  { goalId: Id<"weeklyGoals">; event: string }'),
 ('!!payload && "goalId" in payload','!!payload && "goalId" in payload && "event" in payload')])
edit('convex/notificationHelpers.ts',[('themeName?: string','themeName: string'),('duelDifficultyPreset?: "easy" | "medium" | "hard"','duelDifficultyPreset: "easy" | "medium" | "hard"')])
edit('convex/challenges.ts',[('    const now = Date.now();\n    const challengeId = await ctx.db.insert("challenges", buildChallengeInvite({','    const now = Date.now();\n    const resolvedDifficultyPreset = duelDifficultyPreset ?? "easy";\n    const challengeId = await ctx.db.insert("challenges", buildChallengeInvite({'),('      duelDifficultyPreset,\n      duelMode,\n      createdAt: now,','      duelDifficultyPreset: resolvedDifficultyPreset,\n      duelMode,\n      createdAt: now,')])
edit('convex/themes/archiveDuplicate.ts',[('import type { SentenceRoundInput } from "../../lib/themes/sentenceTypes";','import type { NormalizedSentenceRoundInput } from "../../lib/themes/sentenceValidation";'),('sentenceRounds: SentenceRoundInput[]','sentenceRounds: NormalizedSentenceRoundInput[]'),('round.wordMeanings ? [...round.wordMeanings] : undefined','[...round.wordMeanings]'),('round.freeWordPositions ? [...round.freeWordPositions] : undefined','[...round.freeWordPositions]')])
edit('app/themes/hooks/useSentenceThemeController.ts',[
 ('(theme.sentenceRounds as SentenceRoundInput[])','theme.sentenceRounds'),('(refreshedTheme.sentenceRounds as SentenceRoundInput[])','refreshedTheme.sentenceRounds')])
# Only stored rounds have required metadata; generated/manual drafts retain optional-input handling.
p=Path('app/themes/hooks/useSentenceThemeController.ts');s=p.read_text()
for start,end in [('  const openSavedTheme','  const openGenerateModal'),('  const applyRefreshedSentenceTheme','  const ')]:
 a=s.index(start);b=s.index(end,a+len(start));part=s[a:b]
 import re
 part=re.sub(r'round\.wordMeanings\s*\? \[\.\.\.round\.wordMeanings\]\s*: undefined','[...round.wordMeanings]',part)
 part=re.sub(r'round\.freeWordPositions\s*\? \[\.\.\.round\.freeWordPositions\]\s*: undefined','[...round.freeWordPositions]',part)
 s=s[:a]+part+s[b:]
p.write_text(s)
