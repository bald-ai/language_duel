import { defineSchema, defineTable } from "convex/server";
import { v, type Infer } from "convex/values";
import { TTS_PROVIDER_IDS } from "../lib/tts/providers";
import { DUEL_MODES } from "../lib/duelMode";
import { HINT_TYPES } from "../lib/hintPool/types";
import { SABOTAGE_EFFECTS } from "../lib/sabotage/types";
import type { WordType } from "../lib/themes/wordTypes";
import { THEME_CONTENT_TYPES } from "../lib/themes/sentenceTypes";
import type { ThemeContentType } from "../lib/themes/sentenceTypes";
import type { NotificationEmailTrigger } from "../lib/notifications/definitions";
import {
  gameStateValidator,
  mockGameValidator,
  roomStatusValidator,
} from "../lib/mockOnline/state";

// ===========================================
// Shared Validators
// ===========================================

const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

// Sentence themes store the editable source: an English prompt, the canonical
// Spanish sentence, and 3 single-word distractors (decisions: round shape).
// Gameplay tokenizes the Spanish sentence on whitespace at play time.
// `ttsStorageId` holds the pre-generated audio of the canonical Spanish
// sentence (theme editor only — never carried onto session items). Reused for
// the sentence branch of `weeklyGoalThemeSnapshots` so locked-goal audio is
// preserved and storage cleanup stays consistent with word themes.
const sentenceRoundValidator = v.object({
  englishPrompt: v.string(),
  spanishSentence: v.string(),
  distractors: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

export const themeContentTypeValidator = v.union(
  v.literal(THEME_CONTENT_TYPES[0]),
  v.literal(THEME_CONTENT_TYPES[1])
);

// Drift guard: the contentType validator must match the canonical
// ThemeContentType (lib/themes/sentenceTypes.ts). If they diverge, this
// assignment fails typecheck.
type AssertContentTypeMatches = [Infer<typeof themeContentTypeValidator>] extends [ThemeContentType]
  ? [ThemeContentType] extends [Infer<typeof themeContentTypeValidator>]
    ? true
    : never
  : never;
const _contentTypeValidatorMatches: AssertContentTypeMatches = true;
void _contentTypeValidatorMatches;

export const wordTypeValidator = v.union(
  v.literal("nouns"),
  v.literal("verbs"),
  v.literal("adjectives"),
  v.literal("adverbs")
);

// Drift guard: wordTypeValidator must stay in sync with the canonical WordType
// (lib/themes/wordTypes.ts). If they diverge, this assignment fails typecheck.
type AssertExact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _wordTypeValidatorMatchesWordType: AssertExact<
  Infer<typeof wordTypeValidator>,
  WordType
> = true;
void _wordTypeValidatorMatchesWordType;

export const ttsProviderValidator = v.union(
  v.literal(TTS_PROVIDER_IDS.RESEMBLE),
  v.literal(TTS_PROVIDER_IDS.ELEVENLABS)
);

export const optionalWordTypeValidator = v.optional(wordTypeValidator);

// Each session item carries a `kind` discriminator so mixed word+sentence
// decks can flow through the same `sessionItems` array. The word variant
// preserves the historical word fields (so existing consumers can narrow once
// and keep the same property access). The sentence variant carries the
// editable sentence source verbatim — the gameplay tile pool is derived at
// play time from `spanishSentence`.
const sessionWordItemValidator = v.object({
  kind: v.literal("word"),
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
  themeId: v.id("themes"),
  themeName: v.string(),
});

const sessionSentenceItemValidator = v.object({
  kind: v.literal("sentence"),
  englishPrompt: v.string(),
  spanishSentence: v.string(),
  distractors: v.array(v.string()),
  themeId: v.id("themes"),
  themeName: v.string(),
});

const sessionItemValidator = v.union(
  sessionWordItemValidator,
  sessionSentenceItemValidator
);

const playerRoleValidator = v.union(v.literal("challenger"), v.literal("opponent"));
const difficultyLevelValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const challengeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled")
);

const duelStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("stopped")
);

const soloPracticeStatusValidator = v.union(
  v.literal("learning"),
  v.literal("practicing"),
  v.literal("completed"),
  v.literal("stopped")
);

const duelSourceTypeValidator = v.union(
  v.literal("normal"),
  v.literal("boss"),
  v.literal("spaced_repetition")
);

const soloPracticeSourceTypeValidator = v.union(
  v.literal("weekly_goal"),
  v.literal("boss"),
  v.literal("spaced_repetition")
);

const bossTypeValidator = v.union(v.literal("mini"), v.literal("big"));

// A duel's chosen difficulty preset uses the same three levels as a question's
// difficulty — one validator, not two near-identical copies.
const duelDifficultyPresetValidator = difficultyLevelValidator;

export const duelModeValidator = v.union(
  v.literal(DUEL_MODES[0]),
  v.literal(DUEL_MODES[1]),
  v.literal(DUEL_MODES[2]),
  v.literal(DUEL_MODES[3])
);

const relayPhaseValidator = v.union(
  v.literal("pick"),
  v.literal("answer"),
  v.literal("feedback")
);

const relayLastResultValidator = v.object({
  wordIndex: v.number(),
  chosen: v.string(),
  correct: v.boolean(),
  scorer: v.union(playerRoleValidator, v.null()),
});

const relayHardBudgetValidator = v.object({
  challenger: v.number(),
  opponent: v.number(),
});

// Per-player sentence-round progress. The server is the only authority for
// `placedTileIndices` / `mistakes` / `completed`: each tap is its own mutation
// (`tapSentenceTile`), and `answerSentenceRound` reads this state — it doesn't
// trust client-reported completion or mistakes. One row per (questionIndex,
// role); rows are appended lazily on first tap.
const sentenceProgressEntryValidator = v.object({
  questionIndex: v.number(),
  role: playerRoleValidator,
  placedTileIndices: v.array(v.number()),
  mistakes: v.number(),
  completed: v.boolean(),
  finalized: v.boolean(),
  // PvP build-and-confirm only: count of failed Confirm attempts this round.
  // Drives the competitive scoring ladder (0 fails → +1, 1 → 0, ≥2 → −1).
  // Absent on per-tap (PvE/Solo) rows; coalesced to 0 in the rules.
  failedConfirms: v.optional(v.number()),
  // PvP build-and-confirm only: the board snapshot recorded on the last failed
  // Confirm. Re-confirming the identical board (e.g. a double-click) is a no-op
  // so penalties can't stack without the player actually changing the sentence.
  lastFailedConfirmTileIndices: v.optional(v.array(v.number())),
});

export const hintTypeValidator = v.union(
  v.literal(HINT_TYPES[0]),
  v.literal(HINT_TYPES[1]),
  v.literal(HINT_TYPES[2]),
  v.literal(HINT_TYPES[3])
);

const hintRevealValidator = v.union(
  v.object({
    kind: v.literal("anagram"),
    value: v.string(),
  }),
  v.object({
    kind: v.literal("letterCount"),
    value: v.array(v.number()),
  })
);

// duelQuestions is parallel to wordOrder: one snapshot per position in the
// deck. Word positions store the shuffled multiple-choice snapshot;
// sentence positions store the pre-shuffled tile pool plus the canonical
// solution (server-only — masked at the DTO boundary in convex/duels.ts).
const duelWordQuestionValidator = v.object({
  kind: v.literal("word"),
  options: v.array(v.string()),
  correctOption: v.string(),
  difficulty: difficultyLevelValidator,
  points: v.number(),
});

const duelSentenceQuestionValidator = v.object({
  kind: v.literal("sentence"),
  englishPrompt: v.string(),
  spanishSentence: v.string(),
  tilePool: v.array(v.string()),
});

const duelQuestionValidator = v.union(
  duelWordQuestionValidator,
  duelSentenceQuestionValidator
);

const playerStatsValidator = v.object({
  questionsAnswered: v.number(),
  correctAnswers: v.number(),
});

export const sabotageEffectValidator = v.union(
  v.literal(SABOTAGE_EFFECTS[0]),
  v.literal(SABOTAGE_EFFECTS[1]),
  v.literal(SABOTAGE_EFFECTS[2]),
  v.literal(SABOTAGE_EFFECTS[3])
);

const sabotageValidator = v.object({
  effect: sabotageEffectValidator,
  timestamp: v.number(),
});

// Fields shared by every session-source table (challenges, duels,
// soloPracticeSessions): the themes played plus the optional weekly-goal / boss /
// spaced-repetition linkage. Each table adds its own `sourceType` union, and
// soloPracticeSessions overrides `weeklyGoalId` to required.
const sessionSourceFields = {
  themeIds: v.array(v.id("themes")),
  weeklyGoalId: v.optional(v.id("weeklyGoals")),
  bossType: v.optional(bossTypeValidator),
  spacedRepetitionStep: v.optional(v.number()),
};

// ===========================================
// Schema Definition
// ===========================================

// Notification type validator
export const notificationTypeValidator = v.union(
  v.literal("friend_request"),
  v.literal("weekly_goal_invitation"),
  v.literal("weekly_goal_draft_expiring"),
  v.literal("challenge_invite")
);

const notificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("read"),
  v.literal("dismissed")
);

const weeklyGoalLifecycleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("locked"),
  v.literal("grace_period"),
  v.literal("completed")
);

const weeklyGoalBossStatusValidator = v.union(
  v.literal("unavailable"),
  v.literal("ready"),
  v.literal("defeated")
);

const weeklyGoalModeValidator = v.union(
  v.literal("solo"),
  v.literal("shared")
);

export const notificationPayloadValidator = v.union(
  v.object({
    friendRequestId: v.id("friendRequests"),
  }),
  v.object({
    goalId: v.id("weeklyGoals"),
    themeCount: v.number(),
    event: v.optional(
      v.union(
        v.literal("invite"),
        v.literal("declined"),
        v.literal("partner_locked"),
        v.literal("goal_unlocked"),
        v.literal("goal_activated"),
        v.literal("goal_completed"),
        v.literal("goal_completed_solo")
      )
    ),
  }),
  v.object({
    challengeId: v.id("challenges"),
    themeName: v.optional(v.string()),
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),
    duelMode: duelModeValidator,
  })
);

export type NotificationPayload = Infer<typeof notificationPayloadValidator>;

// Email notification trigger types
export const emailNotificationTriggerValidator = v.union(
  v.literal("immediate_challenge_invite"),
  v.literal("weekly_goal_invite"),
  v.literal("weekly_goal_locked"),
  v.literal("weekly_goal_accepted"),
  v.literal("weekly_goal_daily_reminder"),
  v.literal("weekly_goal_draft_expiring"),
  v.literal("weekly_goal_grace_period_reminder"),
  v.literal("weekly_goal_reminder_1"),
  v.literal("weekly_goal_reminder_2")
);

// Drift guard: the trigger validator must match the canonical trigger contract
// (NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS in lib/notifications/definitions.ts).
// If they diverge, this assignment fails typecheck.
const _emailTriggerValidatorMatchesContract: AssertExact<
  Infer<typeof emailNotificationTriggerValidator>,
  NotificationEmailTrigger
> = true;
void _emailTriggerValidatorMatchesContract;

export default defineSchema({
  // -------------------------------------------
  // Users Table
  // -------------------------------------------
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    nickname: v.optional(v.string()),
    discriminator: v.optional(v.number()),
    llmCreditsRemaining: v.optional(v.number()),
    ttsGenerationsRemaining: v.optional(v.number()),
    // TTS provider preference. Default lives in lib/tts/providers.
    ttsProvider: v.optional(ttsProviderValidator),
    creditsMonth: v.optional(v.string()),
    // User preferences for theme system
    selectedColorSet: v.optional(v.string()),
    selectedBackground: v.optional(v.string()),
    // Archived themes (hidden from main list)
    archivedThemeIds: v.optional(v.array(v.id("themes"))),
    // Guard against concurrent theme-level TTS generation runs
    ttsGenerationLockToken: v.optional(v.string()),
    ttsGenerationLockExpiresAt: v.optional(v.number()),
    // Presence tracking
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_nickname_discriminator", ["nickname", "discriminator"]),

  // -------------------------------------------
  // Themes Table
  //
  // Two content types share this table: word themes carry `words`, sentence
  // themes carry `sentenceRounds`. `contentType` is the discriminator and the
  // table is a discriminated union: word themes require `words` and reject
  // `sentenceRounds`, sentence themes require `sentenceRounds` and reject
  // `words`. `wordType` only applies to word themes.
  // -------------------------------------------
  themes: defineTable(
    v.union(
      v.object({
        name: v.string(),
        description: v.string(),
        contentType: v.literal("word"),
        wordType: optionalWordTypeValidator,
        words: v.array(wordValidator),
        createdAt: v.number(),
        ownerId: v.optional(v.id("users")),
        visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
        friendsCanEdit: v.optional(v.boolean()),
        saveRequestId: v.optional(v.string()),
      }),
      v.object({
        name: v.string(),
        description: v.string(),
        contentType: v.literal("sentence"),
        sentenceRounds: v.array(sentenceRoundValidator),
        createdAt: v.number(),
        ownerId: v.optional(v.id("users")),
        visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
        friendsCanEdit: v.optional(v.boolean()),
        saveRequestId: v.optional(v.string()),
      })
    )
  )
    .index("by_owner", ["ownerId"])
    .index("by_visibility", ["visibility"])
    .index("by_visibility_owner", ["visibility", "ownerId"])
    .index("by_owner_save_request", ["ownerId", "saveRequestId"]),

  // -------------------------------------------
  // Friend Requests Table
  // -------------------------------------------
  friendRequests: defineTable({
    senderId: v.id("users"),
    receiverId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_receiver", ["receiverId", "status"])
    .index("by_sender_status", ["senderId", "status"])
    .index("by_sender", ["senderId"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // -------------------------------------------
  // Friends Table (bidirectional)
  // -------------------------------------------
  friends: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_friend", ["friendId"]),

  // -------------------------------------------
  // Challenges Table
  // -------------------------------------------
  challenges: defineTable({
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    ...sessionSourceFields,
    sourceType: duelSourceTypeValidator,
    status: challengeStatusValidator,
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),
    duelMode: duelModeValidator,
    duelId: v.optional(v.id("duels")),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_status", ["status"])
    .index("by_weeklyGoalId", ["weeklyGoalId"]),

  // -------------------------------------------
  // Duels Table
  // -------------------------------------------
  duels: defineTable({
    challengeId: v.optional(v.id("challenges")),
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    ...sessionSourceFields,
    sessionWords: v.array(sessionItemValidator),
    sourceType: duelSourceTypeValidator,
    livesTotal: v.optional(v.number()),
    livesRemaining: v.optional(v.number()),
    status: duelStatusValidator,
    createdAt: v.number(),

    currentWordIndex: v.number(),
    wordOrder: v.array(v.number()),
    duelQuestions: v.optional(v.array(duelQuestionValidator)),
    challengerAnswered: v.boolean(),
    opponentAnswered: v.boolean(),
    challengerScore: v.number(),
    opponentScore: v.number(),
    challengerPerfectRun: v.optional(v.boolean()),
    opponentPerfectRun: v.optional(v.boolean()),
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),
    duelMode: duelModeValidator,

    questionStartTime: v.optional(v.number()),
    questionTimerPausedAt: v.optional(v.number()),
    questionTimerPausedBy: v.optional(playerRoleValidator),

    challengerLastAnswer: v.optional(v.string()),
    opponentLastAnswer: v.optional(v.string()),

    hintRequestedBy: v.optional(playerRoleValidator),
    hintAccepted: v.optional(v.boolean()),
    eliminatedOptions: v.optional(v.array(v.string())),
    hintPoolUsed: v.array(hintTypeValidator),
    currentQuestionHintFired: v.boolean(),
    currentQuestionHintReveal: v.optional(hintRevealValidator),

    countdownPausedBy: v.optional(playerRoleValidator),
    countdownUnpauseRequestedBy: v.optional(playerRoleValidator),
    countdownPausedAt: v.optional(v.number()),
    countdownSkipRequestedBy: v.optional(v.array(playerRoleValidator)),

    challengerSabotage: v.optional(sabotageValidator),
    opponentSabotage: v.optional(sabotageValidator),
    challengerSabotagesUsed: v.optional(v.number()),
    opponentSabotagesUsed: v.optional(v.number()),

    // Relay-mode state. Only set when duelMode === "relay"; absent otherwise.
    // Indices below are positions into wordOrder (same basis as duelQuestions).
    relayPicker: v.optional(playerRoleValidator),
    relayPhase: v.optional(relayPhaseValidator),
    relayAssignedIndex: v.optional(v.number()),
    relayResolvedIndices: v.optional(v.array(v.number())),
    relayHardUpgradeIndices: v.optional(v.array(v.number())),
    relayHardBudget: v.optional(relayHardBudgetValidator),
    relayAnswerStartedAt: v.optional(v.number()),
    relayTimeoutScheduledFunctionId: v.optional(v.id("_scheduled_functions")),
    relayLastResult: v.optional(relayLastResultValidator),
    // Parallel to duelQuestions: the hard-upgrade variant per position.
    // Server-only — never shipped to clients.
    relayHardQuestions: v.optional(v.array(duelQuestionValidator)),

    // PvE turn-by-turn (TbT) state. Only set when duelMode === "tbt". Both
    // players share ONE sentence board (keyed by TBT_BOARD_ROLE) and alternate
    // turns; `tbtTurn` is whose tap is next. Timing rides on the shared
    // `questionStartTime` (one 90s budget per sentence), same as the
    // word/sentence duels — there is no per-turn clock or scheduler.
    tbtTurn: v.optional(playerRoleValidator),
    // The tile the previous player just tapped that was WRONG (placed nothing).
    // Lingers as a subtle marker so the next player can see what their partner
    // tried; cleared on any correct placement and on sentence advance.
    tbtLastWrongTileIndex: v.optional(v.number()),
    // Legacy per-turn AFK fields, no longer written (kept optional so any
    // in-flight duel doc still validates). Safe to drop once no live TbT duels
    // carry them.
    tbtTurnStartedAt: v.optional(v.number()),
    tbtTimeoutScheduledFunctionId: v.optional(v.id("_scheduled_functions")),

    // Per-(questionIndex, role) sentence-round progress. The server is the only
    // authority — see `sentenceProgressEntryValidator` above.
    sentenceProgress: v.optional(v.array(sentenceProgressEntryValidator)),

    seed: v.number(),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_status", ["status"])
    .index("by_weeklyGoalId", ["weeklyGoalId"]),

  // -------------------------------------------
  // Solo Practice Sessions Table
  // -------------------------------------------
  soloPracticeSessions: defineTable({
    userId: v.id("users"),
    ...sessionSourceFields,
    // Solo practice always belongs to a weekly goal, so weeklyGoalId is required here.
    weeklyGoalId: v.id("weeklyGoals"),
    sessionWords: v.array(sessionItemValidator),
    sourceType: soloPracticeSourceTypeValidator,
    status: soloPracticeStatusValidator,
    completedAt: v.optional(v.number()),
    finalStats: v.optional(playerStatsValidator),
    masteredWordIndices: v.optional(v.array(v.number())),
    progressUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_weeklyGoalId", ["weeklyGoalId"])
    .index("by_user_status", ["userId", "status"]),

  // -------------------------------------------
  // Weekly Goals Table
  // -------------------------------------------
  weeklyGoals: defineTable({
    creatorId: v.id("users"),
    mode: weeklyGoalModeValidator,
    partnerId: v.optional(v.id("users")),
    themes: v.array(
      v.object({
        themeId: v.id("themes"),
        themeName: v.string(),
        creatorCompleted: v.boolean(),
        partnerCompleted: v.optional(v.boolean()),
      })
    ),
    creatorLocked: v.boolean(),
    partnerLocked: v.optional(v.boolean()),
    lockedAt: v.optional(v.number()),
    endDate: v.optional(v.number()),
    miniBossStatus: weeklyGoalBossStatusValidator,
    bigBossStatus: weeklyGoalBossStatusValidator,
    status: weeklyGoalLifecycleStatusValidator,
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_partner", ["partnerId"])
    .index("by_status", ["status"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_status_endDate", ["status", "endDate"]),

  // -------------------------------------------
  // Weekly Goal Spaced Repetition Table
  // -------------------------------------------
  weeklyGoalRepetitions: defineTable({
    weeklyGoalId: v.id("weeklyGoals"),
    userId: v.id("users"),
    completedSteps: v.array(
      v.object({
        completedAt: v.number(),
        completedVia: v.union(v.literal("duel"), v.literal("solo_practice")),
        duelId: v.optional(v.id("duels")),
        soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_goal", ["weeklyGoalId"])
    .index("by_goal_user", ["weeklyGoalId", "userId"]),

  // -------------------------------------------
  // Weekly Goal Theme Snapshots Table
  // -------------------------------------------
  weeklyGoalThemeSnapshots: defineTable(
    v.union(
      v.object({
        weeklyGoalId: v.id("weeklyGoals"),
        originalThemeId: v.id("themes"),
        order: v.number(),
        name: v.string(),
        description: v.string(),
        contentType: v.literal("word"),
        wordType: optionalWordTypeValidator,
        words: v.array(wordValidator),
        lockedAt: v.number(),
        createdAt: v.number(),
      }),
      v.object({
        weeklyGoalId: v.id("weeklyGoals"),
        originalThemeId: v.id("themes"),
        order: v.number(),
        name: v.string(),
        description: v.string(),
        contentType: v.literal("sentence"),
        sentenceRounds: v.array(sentenceRoundValidator),
        lockedAt: v.number(),
        createdAt: v.number(),
      })
    )
  )
    .index("by_weeklyGoal", ["weeklyGoalId"])
    .index("by_weeklyGoal_order", ["weeklyGoalId", "order"])
    .index("by_weeklyGoal_originalTheme", ["weeklyGoalId", "originalThemeId"])
    .index("by_originalTheme", ["originalThemeId"]),

  // -------------------------------------------
  // Notifications Table
  // -------------------------------------------
  notifications: defineTable({
    type: notificationTypeValidator,
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    status: notificationStatusValidator,
    payload: v.optional(notificationPayloadValidator),
    createdAt: v.number(),
  })
    .index("by_recipient", ["toUserId", "status"])
    .index("by_type_status", ["type", "toUserId", "status"])
    .index("by_type", ["type", "toUserId"])
    .index("by_type_only", ["type"])
    .index("by_type_status_createdAt", ["type", "status", "createdAt"]),

  // -------------------------------------------
  // Notification Preferences Table
  // -------------------------------------------
  notificationPreferences: defineTable({
    userId: v.id("users"),

    // Challenge Invites
    challengeInviteEmailsEnabled: v.boolean(),
    challengeInviteEmailEnabled: v.boolean(),

    // Weekly Goals
    weeklyGoalEmailsEnabled: v.boolean(),
    weeklyGoalInviteEmailEnabled: v.boolean(),
    weeklyGoalAcceptedEmailEnabled: v.boolean(),
    weeklyGoalLockedEmailEnabled: v.boolean(),
    weeklyGoalDailyReminderEmailEnabled: v.boolean(),
    weeklyGoalGracePeriodReminderEmailEnabled: v.boolean(),
    weeklyGoalDraftExpiringEmailEnabled: v.boolean(),
    weeklyGoalReminder1EmailEnabled: v.boolean(),
    weeklyGoalReminder1OffsetMinutes: v.number(),
    weeklyGoalReminder2EmailEnabled: v.boolean(),
    weeklyGoalReminder2OffsetMinutes: v.number(),

    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // -------------------------------------------
  // Email Notification Log Table (idempotency)
  // -------------------------------------------
  emailNotificationLog: defineTable({
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    dedupeKey: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_user_trigger_weeklyGoal", ["toUserId", "trigger", "weeklyGoalId"])
    .index("by_user_trigger_weeklyGoal_dedupeKey", [
      "toUserId",
      "trigger",
      "weeklyGoalId",
      "dedupeKey",
    ])
    .index("by_user_trigger_challenge", ["toUserId", "trigger", "challengeId"])
    .index("by_user_trigger_duel", ["toUserId", "trigger", "duelId"])
    .index("by_user_trigger_soloPracticeSession", [
      "toUserId",
      "trigger",
      "soloPracticeSessionId",
    ])
    .index("by_user_trigger", ["toUserId", "trigger"])
    .index("by_sentAt", ["sentAt"]),

  // -------------------------------------------
  // Prototype Rooms Table
  // Self-contained backing for the "Online Mock Features" prototypes. Not wired
  // into duels/challenges/themes — safe to drop together with the mockOnline
  // feature (lib/mockOnline, convex/prototypeRooms.ts, app/mock-online).
  // -------------------------------------------
  prototypeRooms: defineTable({
    code: v.string(),
    game: mockGameValidator,
    hostId: v.id("users"),
    guestId: v.optional(v.id("users")),
    status: roomStatusValidator,
    state: gameStateValidator,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_code", ["code"]),
});
