/**
 * `@mszr/idb-dux/hono` — the Hono adapter.
 *
 * `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` typed to a
 * Hono `Context`, returning native `(c) => Response` handlers. All request
 * lifecycle and verification logic lives in `/server`; this subpath is the thin
 * Hono binding.
 *
 * Spec: `../../../docs/dux-spec-server.md`.
 */
import type { Context } from 'hono'
import type {
  IdbAuthSyncConfig,
  IdbRegisteredSchema,
  IdbSchema,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbWebhookHandlers,
  IdbWebhookVerifyOpts,
} from '../server/index.js'
import {
  createAuthSyncHandler,
  createServerKit,
  createWebhookHandler,
} from '../server/index.js'
import { honoAdapter } from './adapter.js'

/** The per-request kit factory ([dux-spec-server.md §4]), typed to a Hono `Context`. */
export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S, Context>,
): IdbServerKitFactory<S, Context> {
  return createServerKit(honoAdapter, config)
}

/**
 * The `firstPartyPath` auth-sync route ([dux-spec-server.md §5]). Mount with
 * `app.post('/api/idb', defineAuthSyncHandler({ getAppId }))`. Cookie transport
 * only.
 */
export function defineAuthSyncHandler(
  config: IdbAuthSyncConfig<Context>,
): (c: Context) => Promise<Response> {
  const core = createAuthSyncHandler(honoAdapter, config)
  return async c => c.json(await core(c))
}

/**
 * The one-line webhook route ([dux-spec-server.md §6]). `c.req.text()` reads the
 * exact bytes signature verification needs — no extra route config required.
 */
export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): (c: Context) => Promise<Response> {
  const core = createWebhookHandler(honoAdapter, handlers, opts)
  return async c => c.json(await core(c))
}

// The official first-party route handler + its types, for apps that want the
// official cookie shape. Reached through `/server` (never `@instantdb/admin`).
export {
  createInstantRouteHandler,
  type InstantRouteHandlerBody,
  type InstantRouteHandlerPayloadByType,
  type InstantRouteHandlerType,
} from '../server/index.js'

// The kit/config/transport types, re-exported so consumers type routes without
// reaching into `/server`.
export type {
  IdbAdminClient,
  IdbAuthSyncConfig,
  IdbAuthSyncResult,
  IdbAuthUser,
  IdbServerCookieOptions,
  IdbServerKit,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbServerKitMode,
  IdbServerRequestReader,
  IdbServerTokenSource,
  IdbServerTokenTransport,
} from '../server/index.js'
