/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as constants from "../constants.js";
import type * as duel from "../duel.js";
import type * as gameplay from "../gameplay.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_gameLogic from "../helpers/gameLogic.js";
import type * as helpers_index from "../helpers/index.js";
import type * as hints from "../hints.js";
import type * as lobby from "../lobby.js";
import type * as sabotage from "../sabotage.js";
import type * as themes from "../themes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  constants: typeof constants;
  duel: typeof duel;
  gameplay: typeof gameplay;
  "helpers/auth": typeof helpers_auth;
  "helpers/gameLogic": typeof helpers_gameLogic;
  "helpers/index": typeof helpers_index;
  hints: typeof hints;
  lobby: typeof lobby;
  sabotage: typeof sabotage;
  themes: typeof themes;
  users: typeof users;
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
