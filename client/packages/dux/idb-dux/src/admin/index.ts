/**
 * `@mszr/idb-dux/admin` — the full server surface.
 *
 * `init` owns `@instantdb/admin` (optional peer); shaped `query` +
 * `subscribeQuery`, typed tx and debug, `asUser`, the pass-throughs, and
 * `adminDb.webhooks`. Framework-agnostic, token-scoped, never bundled
 * client-side.
 *
 * Spec: `../../../docs/dux-spec-admin.md`.
 */

// The branded error family — `e instanceof IdbError` (the admin fetch path
// throws `IdbApiError`, which extends `IdbError`).
export { IdbApiError, IdbError } from '../errors.js'
export type { IdbIssue } from '../errors.js'
// Schema-rooted room type extractor — `rooms.getPresence` reads against it.
export type { IdbRoomPresence } from '../schema/index.js'
// Re-exports — official names kept at the boundary.
export { id, lookup } from '../tx/index.js'
export { IdbAdminClient, init } from './init.js'
export type {
  IdbAdminCheckResult,
  IdbAdminConfig,
  IdbAdminDebugQueryOpts,
  IdbAdminDebugTransactOpts,
  IdbAdminDebugTransactResult,
  IdbAdminImpersonation,
  IdbAdminTransactResult,
  IdbAuthUser,
  IdbQuerySessionInfo,
  IdbQuerySubscription,
  IdbQuerySubscriptionCallback,
  IdbQuerySubscriptionPayload,
  IdbReadableStream,
  IdbStorageDeleteResult,
  IdbStorageFileOpts,
  IdbStorageUploadResult,
  IdbStreamReadOpts,
  IdbStreamWriteOpts,
  IdbSubscriptionReadyState,
  IdbWritableStream,
} from './types.js'
// The official first-party route handler, re-exported for apps that want the
// official cookie shape ([dux-spec-nuxt.md §3]) — and the only path by which
// `/nuxt` reaches it (the official package enters via this layer).
export {
  createInstantRouteHandler,
  type InstantRouteHandlerBody,
  type InstantRouteHandlerPayloadByType,
  type InstantRouteHandlerType,
} from '@instantdb/admin'
