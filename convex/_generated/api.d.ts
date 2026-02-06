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
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as duel from "../duel.js";
import type * as emails_actions from "../emails/actions.js";
import type * as emails_notificationEmails from "../emails/notificationEmails.js";
import type * as emails_reminderCrons from "../emails/reminderCrons.js";
import type * as emails_templates from "../emails/templates.js";
import type * as emails_types from "../emails/types.js";
import type * as friends from "../friends.js";
import type * as gameplay from "../gameplay.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_gameLogic from "../helpers/gameLogic.js";
import type * as helpers_index from "../helpers/index.js";
import type * as hints from "../hints.js";
import type * as lobby from "../lobby.js";
import type * as migrations_001_add_nickname_system from "../migrations/001_add_nickname_system.js";
import type * as migrations_002_add_theme_ownership from "../migrations/002_add_theme_ownership.js";
import type * as migrations_003_normalize_notifications from "../migrations/003_normalize_notifications.js";
import type * as notificationPayloads from "../notificationPayloads.js";
import type * as notificationPreferences from "../notificationPreferences.js";
import type * as notifications from "../notifications.js";
import type * as sabotage from "../sabotage.js";
import type * as scheduledDuels from "../scheduledDuels.js";
import type * as themes from "../themes.js";
import type * as userPreferences from "../userPreferences.js";
import type * as users from "../users.js";
import type * as weeklyGoals from "../weeklyGoals.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  constants: typeof constants;
  crons: typeof crons;
  duel: typeof duel;
  "emails/actions": typeof emails_actions;
  "emails/notificationEmails": typeof emails_notificationEmails;
  "emails/reminderCrons": typeof emails_reminderCrons;
  "emails/templates": typeof emails_templates;
  "emails/types": typeof emails_types;
  friends: typeof friends;
  gameplay: typeof gameplay;
  "helpers/auth": typeof helpers_auth;
  "helpers/gameLogic": typeof helpers_gameLogic;
  "helpers/index": typeof helpers_index;
  hints: typeof hints;
  lobby: typeof lobby;
  "migrations/001_add_nickname_system": typeof migrations_001_add_nickname_system;
  "migrations/002_add_theme_ownership": typeof migrations_002_add_theme_ownership;
  "migrations/003_normalize_notifications": typeof migrations_003_normalize_notifications;
  notificationPayloads: typeof notificationPayloads;
  notificationPreferences: typeof notificationPreferences;
  notifications: typeof notifications;
  sabotage: typeof sabotage;
  scheduledDuels: typeof scheduledDuels;
  themes: typeof themes;
  userPreferences: typeof userPreferences;
  users: typeof users;
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
