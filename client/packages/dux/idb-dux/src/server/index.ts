/**
 * `@mszr/idb-dux/server` — the server plane's framework-agnostic core.
 *
 * The `IdbDuxServerAdapter` port plus the three `create*` cores
 * (`createServerKit`, `createAuthSyncHandler`, `createWebhookHandler`) that the
 * framework adapters (`/h3`, `/hono`, `/elysia`) bind. Imports no
 * framework; composes the dux `/admin` and `/webhooks` layers. Power users wire
 * any other framework by supplying an adapter to these cores.
 *
 * Spec: `../../../docs/dux-spec-server.md`.
 */

// The official first-party route handler, for apps that want the official cookie
// shape (and official `getUserFromRequest` compatibility). Reached through the
// admin layer — the server plane never imports `@instantdb/admin` directly.
export {
  createInstantRouteHandler,
  type InstantRouteHandlerBody,
  type InstantRouteHandlerPayloadByType,
  type InstantRouteHandlerType,
} from '../admin/index.js'

// The admin client + auth user — the types of the kit's `adminDb`/`userDb`/`user`,
// re-exported so adapters and routes name them without reaching into `/admin`.
export type { IdbAdminClient, IdbAuthUser } from '../admin/index.js'

// Base type vocabulary an adapter needs for its generic signatures, re-exported
// so adapters import solely from `/server` + their framework (boundary law).
export type { IdbSchema } from '../schema/defineSchema.js'
export type { IdbRegisteredSchema } from '../schema/register.js'

export type { IdbWebhookHandlers, IdbWebhookVerifyOpts } from '../webhooks/index.js'
// The adapter port — implement this to support a new framework.
export type { IdbDuxServerAdapter } from './adapter.js'

export { createAuthSyncHandler } from './authSync.js'
export type { IdbAuthSyncConfig, IdbAuthSyncResult } from './authSync.js'
// Cookie vocabulary shared by the write (auth-sync) and read (kit) sides.
export { DEFAULT_COOKIE_OPTIONS, tokenCookieName } from './cookies.js'

export type { IdbServerCookieOptions } from './cookies.js'
// The three framework-agnostic cores.
export { createServerKit } from './serverKit.js'
export type {
  IdbServerKit,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbServerKitMode,
} from './serverKit.js'
// Token transport — the `tokenFrom` source and the request reader a resolver gets.
export { resolveToken } from './token.js'
export type {
  IdbServerRequestReader,
  IdbServerTokenSource,
  IdbServerTokenTransport,
} from './token.js'
export { createWebhookHandler } from './webhook.js'

export type { IdbWebhookRouteResult } from './webhook.js'
