/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as deposit from "../deposit.js";
import type * as externalTransfer from "../externalTransfer.js";
import type * as invite from "../invite.js";
import type * as recovery from "../recovery.js";
import type * as settings from "../settings.js";
import type * as taskManagement from "../taskManagement.js";
import type * as team from "../team.js";
import type * as transaction from "../transaction.js";
import type * as user from "../user.js";
import type * as userNode from "../userNode.js";
import type * as withdrawal from "../withdrawal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  deposit: typeof deposit;
  externalTransfer: typeof externalTransfer;
  invite: typeof invite;
  recovery: typeof recovery;
  settings: typeof settings;
  taskManagement: typeof taskManagement;
  team: typeof team;
  transaction: typeof transaction;
  user: typeof user;
  userNode: typeof userNode;
  withdrawal: typeof withdrawal;
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
