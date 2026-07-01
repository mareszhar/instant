/**
 * `@mszr/idb-dux/h3-v1` — the h3 **v1** adapter (Nuxt 4 / Nitro 2).
 *
 * `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` typed to
 * `H3Event`, returning `defineEventHandler`-wrapped handlers. All request
 * lifecycle and verification logic lives in `/server`; this subpath is the thin
 * h3 v1 binding. For h3 **v2** / Nitro 3 / h3-dux use `@mszr/idb-dux/h3`.
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
import { defineEventHandler } from 'h3'
import {
  createAuthSyncHandler,
  createServerKit,
  createWebhookHandler,
} from '../server/index.js'
import { h3v1Adapter } from './adapter.js'

/**
 * The per-request kit factory ([dux-spec-server.md §4]). One factory at module
 * scope, one `await` per route; the mode declares auth strictness and the kit's
 * keys follow. Reads the token via `config.tokenFrom` (default `cookieOrBearer`).
 */
export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S, H3Event>,
): IdbServerKitFactory<S, H3Event> {
  return createServerKit(h3v1Adapter, config)
}

/**
 * The `firstPartyPath` auth-sync route ([dux-spec-server.md §5]) — writes/clears
 * the token-only cookie. Cookie transport only; mount it for web clients.
 */
export function defineAuthSyncHandler(config: IdbAuthSyncConfig<H3Event>): EventHandler {
  const core = createAuthSyncHandler(h3v1Adapter, config)
  return defineEventHandler(event => core(event))
}

/**
 * The one-line webhook route ([dux-spec-server.md §6]) — verify → fetch →
 * dispatch over `/webhooks`, with official 2xx/4xx retry mapping.
 */
export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): EventHandler {
  const core = createWebhookHandler(h3v1Adapter, handlers, opts)
  return defineEventHandler(event => core(event))
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
