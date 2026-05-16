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
import type * as helpers_duelInitialization from "../helpers/duelInitialization.js";
import type * as helpers_gameLogic from "../helpers/gameLogic.js";
import type * as helpers_index from "../helpers/index.js";
import type * as helpers_permissions from "../helpers/permissions.js";
import type * as helpers_relationshipPolicy from "../helpers/relationshipPolicy.js";
import type * as helpers_resembleTts from "../helpers/resembleTts.js";
import type * as helpers_sessionCreation from "../helpers/sessionCreation.js";
import type * as helpers_sessionWords from "../helpers/sessionWords.js";
import type * as helpers_themeAccess from "../helpers/themeAccess.js";
import type * as helpers_themeTtsStorage from "../helpers/themeTtsStorage.js";
import type * as helpers_users from "../helpers/users.js";
import type * as helpers_weeklyGoalSnapshots from "../helpers/weeklyGoalSnapshots.js";
import type * as hints from "../hints.js";
import type * as notificationHelpers from "../notificationHelpers.js";
import type * as notificationPayloads from "../notificationPayloads.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as notifications from "../notifications.js";
import type * as rules_duelGameplayRules from "../rules/duelGameplayRules.js";
import type * as rules_duelScoringRules from "../rules/duelScoringRules.js";
import type * as sabotage from "../sabotage.js";
import type * as themes from "../themes.js";
import type * as ttsGenerationLocks from "../ttsGenerationLocks.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as weeklyGoalRepetitions from "../weeklyGoalRepetitions.js";
import type * as weeklyGoals from "../weeklyGoals.js";

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
  "helpers/duelInitialization": typeof helpers_duelInitialization;
  "helpers/gameLogic": typeof helpers_gameLogic;
  "helpers/index": typeof helpers_index;
  "helpers/permissions": typeof helpers_permissions;
  "helpers/relationshipPolicy": typeof helpers_relationshipPolicy;
  "helpers/resembleTts": typeof helpers_resembleTts;
  "helpers/sessionCreation": typeof helpers_sessionCreation;
  "helpers/sessionWords": typeof helpers_sessionWords;
  "helpers/themeAccess": typeof helpers_themeAccess;
  "helpers/themeTtsStorage": typeof helpers_themeTtsStorage;
  "helpers/users": typeof helpers_users;
  "helpers/weeklyGoalSnapshots": typeof helpers_weeklyGoalSnapshots;
  hints: typeof hints;
  notificationHelpers: typeof notificationHelpers;
  notificationPayloads: typeof notificationPayloads;
  notificationPreferences: typeof notificationPreferences;
  notifications: typeof notifications;
  "rules/duelGameplayRules": typeof rules_duelGameplayRules;
  "rules/duelScoringRules": typeof rules_duelScoringRules;
  sabotage: typeof sabotage;
  themes: typeof themes;
  ttsGenerationLocks: typeof ttsGenerationLocks;
  userPreferences: typeof userPreferences;
  users: typeof users;
  weeklyGoalRepetitions: typeof weeklyGoalRepetitions;
  weeklyGoals: typeof weeklyGoals;
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
