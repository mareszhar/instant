/**
 * `@mszr/idb-dux/h3` — the h3 v2 adapter.
 *
 * `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` typed to
 * `H3Event`, returning native h3 v2 handlers. All request lifecycle and
 * verification logic lives in `/server`; this subpath is the thin h3 binding
 * for standalone h3, Nitro 3 / Nuxt 5, and h3-dux.
 *
 * Spec: `../../../docs/dux-spec-server.md`.
 */
import type { EventHandler, H3Event } from 'h3'
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
import { h3Adapter } from './adapter.js'

/**
 * The per-request kit factory ([dux-spec-server.md §4]). One factory at module
 * scope, one `await` per route; the mode declares auth strictness and the kit's
 * keys follow. Reads the token via `config.tokenFrom` (default `cookieOrBearer`).
 */
export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S, H3Event>,
): IdbServerKitFactory<S, H3Event> {
  return createServerKit(h3Adapter, config)
}

/**
 * The `firstPartyPath` auth-sync route ([dux-spec-server.md §5]) — writes/clears
 * the token-only cookie. Cookie transport only; mount it for web clients.
 */
export function defineAuthSyncHandler(config: IdbAuthSyncConfig<H3Event>): EventHandler {
  const core = createAuthSyncHandler(h3Adapter, config)
  return event => core(event)
}

/**
 * The one-line webhook route ([dux-spec-server.md §6]) — verify → fetch →
 * dispatch over `/webhooks`, with official 2xx/4xx retry mapping.
 */
export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): EventHandler {
  const core = createWebhookHandler(h3Adapter, handlers, opts)
  return event => core(event)
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
