/**
 * `@mszr/idb-dux/elysia` — the Elysia adapter.
 *
 * `defineServerKit`, `defineAuthSyncHandler`, `defineWebhookHandler` typed to an
 * Elysia `Context`, returning native handlers (Elysia serializes the returned
 * value). All request lifecycle and verification logic lives in `/server`; this
 * subpath is the thin Elysia binding.
 *
 * The webhook route must opt into raw text so signature verification sees the
 * exact bytes: `app.post('/webhooks', defineWebhookHandler(handlers), { parse: 'text' })`.
 *
 * Spec: `../../../docs/dux-spec-server.md`.
 */
import type { Context } from 'elysia'
import type {
  IdbAuthSyncConfig,
  IdbAuthSyncResult,
  IdbRegisteredSchema,
  IdbSchema,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbWebhookHandlers,
  IdbWebhookRouteResult,
  IdbWebhookVerifyOpts,
} from '../server/index.js'
import {
  createAuthSyncHandler,
  createServerKit,
  createWebhookHandler,
} from '../server/index.js'
import { elysiaAdapter } from './adapter.js'

/** The per-request kit factory ([dux-spec-server.md §4]), typed to an Elysia `Context`. */
export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S, Context>,
): IdbServerKitFactory<S, Context> {
  return createServerKit(elysiaAdapter, config)
}

/**
 * The `firstPartyPath` auth-sync route ([dux-spec-server.md §5]). Mount with
 * `app.post('/api/idb', defineAuthSyncHandler({ getAppId }))`. Cookie transport
 * only.
 */
export function defineAuthSyncHandler(
  config: IdbAuthSyncConfig<Context>,
): (ctx: Context) => Promise<IdbAuthSyncResult> {
  const core = createAuthSyncHandler(elysiaAdapter, config)
  return ctx => core(ctx)
}

/**
 * The one-line webhook route ([dux-spec-server.md §6]). Mount it with
 * `{ parse: 'text' }` so `ctx.body` is the raw signature bytes.
 */
export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): (ctx: Context) => Promise<IdbWebhookRouteResult> {
  const core = createWebhookHandler(elysiaAdapter, handlers, opts)
  return ctx => core(ctx)
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
