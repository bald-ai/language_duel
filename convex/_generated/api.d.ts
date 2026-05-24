/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as challenges from "../challenges.js";
import type * as constants from "../constants.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as duels from "../duels.js";
import type * as emails_actions from "../emails/actions.js";
import type * as emails_emailNotificationLog from "../emails/emailNotificationLog.js";
import type * as emails_notificationEmailData from "../emails/notificationEmailData.js";
import type * as emails_notificationEmails from "../emails/notificationEmails.js";
import type * as emails_reminderCrons from "../emails/reminderCrons.js";
import type * as emails_reminderPlanners from "../emails/reminderPlanners.js";
import type * as friends from "../friends.js";
import type * as gameplay from "../gameplay.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_index from "../helpers/index.js";
import type * as helpers_permissions from "../helpers/permissions.js";
import type * as helpers_relationshipPolicy from "../helpers/relationshipPolicy.js";
import type * as helpers_resolveAccessibleThemes from "../helpers/resolveAccessibleThemes.js";
import type * as helpers_sessionCreation from "../helpers/sessionCreation.js";
import type * as helpers_sessionWords from "../helpers/sessionWords.js";
import type * as helpers_shuffle from "../helpers/shuffle.js";
import type * as helpers_themeAccess from "../helpers/themeAccess.js";
import type * as helpers_themeTtsStorage from "../helpers/themeTtsStorage.js";
import type * as helpers_userSummary from "../helpers/userSummary.js";
import type * as helpers_users from "../helpers/users.js";
import type * as helpers_weeklyGoalSnapshots from "../helpers/weeklyGoalSnapshots.js";
import type * as hintPool from "../hintPool.js";
import type * as hints from "../hints.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notificationPayloads from "../notificationPayloads.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as notifications from "../notifications.js";
import type * as prototypeRooms from "../prototypeRooms.js";
import type * as rules_countdownPlanners from "../rules/countdownPlanners.js";
import type * as rules_duelGameplayRules from "../rules/duelGameplayRules.js";
import type * as rules_duelModeGuards from "../rules/duelModeGuards.js";
import type * as rules_duelScoringRules from "../rules/duelScoringRules.js";
import type * as rules_selfDuelMirror from "../rules/selfDuelMirror.js";
import type * as sabotage from "../sabotage.js";
import type * as themes from "../themes.js";
import type * as themes_archiveDuplicate from "../themes/archiveDuplicate.js";
import type * as themes_cleanupHelpers from "../themes/cleanupHelpers.js";
import type * as themes_generateThemeTtsAction from "../themes/generateThemeTtsAction.js";
import type * as themes_listQueries from "../themes/listQueries.js";
import type * as themes_mutations from "../themes/mutations.js";
import type * as themes_queries from "../themes/queries.js";
import type * as themes_readModels from "../themes/readModels.js";
import type * as themes_ttsPipeline from "../themes/ttsPipeline.js";
import type * as ttsGenerationLocks from "../ttsGenerationLocks.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as weeklyGoalRepetitions from "../weeklyGoalRepetitions.js";
import type * as weeklyGoalRepetitions_attemptMutations from "../weeklyGoalRepetitions/attemptMutations.js";
import type * as weeklyGoalRepetitions_board from "../weeklyGoalRepetitions/board.js";
import type * as weeklyGoalRepetitions_challengeCreation from "../weeklyGoalRepetitions/challengeCreation.js";
import type * as weeklyGoalRepetitions_contentLoading from "../weeklyGoalRepetitions/contentLoading.js";
import type * as weeklyGoalRepetitions_duelCompletion from "../weeklyGoalRepetitions/duelCompletion.js";
import type * as weeklyGoalRepetitions_readModel from "../weeklyGoalRepetitions/readModel.js";
import type * as weeklyGoalRepetitions_rules from "../weeklyGoalRepetitions/rules.js";
import type * as weeklyGoalRepetitions_soloPractice from "../weeklyGoalRepetitions/soloPractice.js";
import type * as weeklyGoalRepetitions_types from "../weeklyGoalRepetitions/types.js";
import type * as weeklyGoals from "../weeklyGoals.js";
import type * as weeklyGoals_bossWorkflows from "../weeklyGoals/bossWorkflows.js";
import type * as weeklyGoals_cleanup from "../weeklyGoals/cleanup.js";
import type * as weeklyGoals_createGoal from "../weeklyGoals/createGoal.js";
import type * as weeklyGoals_invitationMutations from "../weeklyGoals/invitationMutations.js";
import type * as weeklyGoals_mutations from "../weeklyGoals/mutations.js";
import type * as weeklyGoals_notifications from "../weeklyGoals/notifications.js";
import type * as weeklyGoals_participants from "../weeklyGoals/participants.js";
import type * as weeklyGoals_practiceThemes from "../weeklyGoals/practiceThemes.js";
import type * as weeklyGoals_queries from "../weeklyGoals/queries.js";
import type * as weeklyGoals_readModels from "../weeklyGoals/readModels.js";
import type * as weeklyGoals_types from "../weeklyGoals/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  challenges: typeof challenges;
  constants: typeof constants;
  credits: typeof credits;
  crons: typeof crons;
  duels: typeof duels;
  "emails/actions": typeof emails_actions;
  "emails/emailNotificationLog": typeof emails_emailNotificationLog;
  "emails/notificationEmailData": typeof emails_notificationEmailData;
  "emails/notificationEmails": typeof emails_notificationEmails;
  "emails/reminderCrons": typeof emails_reminderCrons;
  "emails/reminderPlanners": typeof emails_reminderPlanners;
  friends: typeof friends;
  gameplay: typeof gameplay;
  "helpers/auth": typeof helpers_auth;
  "helpers/index": typeof helpers_index;
  "helpers/permissions": typeof helpers_permissions;
  "helpers/relationshipPolicy": typeof helpers_relationshipPolicy;
  "helpers/resolveAccessibleThemes": typeof helpers_resolveAccessibleThemes;
  "helpers/sessionCreation": typeof helpers_sessionCreation;
  "helpers/sessionWords": typeof helpers_sessionWords;
  "helpers/shuffle": typeof helpers_shuffle;
  "helpers/themeAccess": typeof helpers_themeAccess;
  "helpers/themeTtsStorage": typeof helpers_themeTtsStorage;
  "helpers/userSummary": typeof helpers_userSummary;
  "helpers/users": typeof helpers_users;
  "helpers/weeklyGoalSnapshots": typeof helpers_weeklyGoalSnapshots;
  hintPool: typeof hintPool;
  hints: typeof hints;
  notificationHelpers: typeof notificationHelpers;
  notificationPayloads: typeof notificationPayloads;
  notificationPreferences: typeof notificationPreferences;
  notifications: typeof notifications;
  prototypeRooms: typeof prototypeRooms;
  "rules/countdownPlanners": typeof rules_countdownPlanners;
  "rules/duelGameplayRules": typeof rules_duelGameplayRules;
  "rules/duelModeGuards": typeof rules_duelModeGuards;
  "rules/duelScoringRules": typeof rules_duelScoringRules;
  "rules/selfDuelMirror": typeof rules_selfDuelMirror;
  sabotage: typeof sabotage;
  themes: typeof themes;
  "themes/archiveDuplicate": typeof themes_archiveDuplicate;
  "themes/cleanupHelpers": typeof themes_cleanupHelpers;
  "themes/generateThemeTtsAction": typeof themes_generateThemeTtsAction;
  "themes/listQueries": typeof themes_listQueries;
  "themes/mutations": typeof themes_mutations;
  "themes/queries": typeof themes_queries;
  "themes/readModels": typeof themes_readModels;
  "themes/ttsPipeline": typeof themes_ttsPipeline;
  ttsGenerationLocks: typeof ttsGenerationLocks;
  userPreferences: typeof userPreferences;
  users: typeof users;
  weeklyGoalRepetitions: typeof weeklyGoalRepetitions;
  "weeklyGoalRepetitions/attemptMutations": typeof weeklyGoalRepetitions_attemptMutations;
  "weeklyGoalRepetitions/board": typeof weeklyGoalRepetitions_board;
  "weeklyGoalRepetitions/challengeCreation": typeof weeklyGoalRepetitions_challengeCreation;
  "weeklyGoalRepetitions/contentLoading": typeof weeklyGoalRepetitions_contentLoading;
  "weeklyGoalRepetitions/duelCompletion": typeof weeklyGoalRepetitions_duelCompletion;
  "weeklyGoalRepetitions/readModel": typeof weeklyGoalRepetitions_readModel;
  "weeklyGoalRepetitions/rules": typeof weeklyGoalRepetitions_rules;
  "weeklyGoalRepetitions/soloPractice": typeof weeklyGoalRepetitions_soloPractice;
  "weeklyGoalRepetitions/types": typeof weeklyGoalRepetitions_types;
  weeklyGoals: typeof weeklyGoals;
  "weeklyGoals/bossWorkflows": typeof weeklyGoals_bossWorkflows;
  "weeklyGoals/cleanup": typeof weeklyGoals_cleanup;
  "weeklyGoals/createGoal": typeof weeklyGoals_createGoal;
  "weeklyGoals/invitationMutations": typeof weeklyGoals_invitationMutations;
  "weeklyGoals/mutations": typeof weeklyGoals_mutations;
  "weeklyGoals/notifications": typeof weeklyGoals_notifications;
  "weeklyGoals/participants": typeof weeklyGoals_participants;
  "weeklyGoals/practiceThemes": typeof weeklyGoals_practiceThemes;
  "weeklyGoals/queries": typeof weeklyGoals_queries;
  "weeklyGoals/readModels": typeof weeklyGoals_readModels;
  "weeklyGoals/types": typeof weeklyGoals_types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
