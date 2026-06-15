/**
 * `@mszr/idb-dux/vue` — the Vue client.
 *
 * `init`, `defineDb`, the enhanced db (hooks, rooms, typed tx, pass-throughs),
 * and the `SignedIn`/`SignedOut`/`Cursors` components. SSR-resilient by
 * default; a thin overlay over the internal baseline.
 *
 * Spec: `../../../docs/dux-spec-vue.md`.
 */

// The branded error family ([§7.4]) — `e instanceof IdbError`.
export { IdbApiError, IdbError } from '../errors.js'
export type { IdbIssue } from '../errors.js'
// Schema-rooted room type extractors ([§6]) — room shapes read off your schema.
export type {
  IdbRoomName,
  IdbRoomPresence,
  IdbRooms,
  IdbRoomTopics,
} from '../schema/index.js'
// Re-exports — official names kept at the boundary.
export { id, lookup } from '../tx/index.js'
// Components — official names kept ([§7.3]). Shipped as `.ts` render functions.
export { Cursors, SignedIn, SignedOut } from './baseline/index.js'
// The enhanced db type; the value comes from init/defineDb.
export type { IdbClient } from './overlay/db.js'
export { defineDb, init } from './overlay/defineDb.js'
export type { IdbDefineDbOptions } from './overlay/defineDb.js'
export { makeResult } from './overlay/result.js'
export type { IdbResult } from './overlay/result.js'
export type {
  IdbAuthResult,
  IdbAuthResultRefs,
  IdbAuthResultState,
  IdbAuthUser,
  IdbClientConfig,
  IdbConnectionResult,
  IdbConnectionStatus,
  IdbInfiniteQueryResult,
  IdbLocalIdResult,
  IdbQueryResult,
  IdbQueryResultData,
  IdbQueryResultRefs,
  IdbQueryResultState,
  IdbUserOptions,
} from './overlay/types.js'
