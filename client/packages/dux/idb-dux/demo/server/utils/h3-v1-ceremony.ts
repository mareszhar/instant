/*
Nuxt 5 will move from h3 v1 + nitro v2 to h3 v2 + nitro v3.

idb-dux ships a future-ready adapter built for h3 v2. It can't also ship a
h3 v1 adapter under the same import ('h3' can only resolve to one package,
not two versions at once) — and shipping a separate package just for v1
adds overhead for a version that's about to become legacy.

So idb-dux takes a two-layer approach:
  - Ready-to-use utils (`defineAuthSyncHandler`, `defineWebhookHandler`,
    `defineServerKit`) at `@mszr/idb-dux/(h3 | hono | elysia)` for whoever's
    already on the new version.
  - A framework-agnostic layer at `@mszr/idb-dux/server` for everyone else,
    to build their own adapter against.

This file is that: a custom h3 v1 adapter built on the agnostic layer, since
no prebuilt v1 adapter exists. Once Nuxt 5 lands, this file won't be needed,
and the demo can import directly from `@mszr/idb-dux/h3`.

PS: the v2 utils already work today — just not with Nuxt 4. In a standalone
h3 v2 backend, you can use them right now with zero ceremony.

Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-server.md
*/

/*
CUSTOM H3 v1 ADAPTER FOR IDB-DUX SERVER UTILS

idb-dux treats h3 v2 as the zero-ceremony happy path, in anticipation of
Nuxt 5. Until then, this file is the (small) ceremony needed for the same
DX on Nuxt 4. Copy-paste it into any Nuxt 4 project so you don't have to
write your own h3 v1 adapter from scratch.
*/

import type {
  IdbAuthSyncConfig,
  IdbDuxServerAdapter,
  IdbRegisteredSchema,
  IdbSchema,
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbWebhookHandlers,
  IdbWebhookVerifyOpts,
} from '@mszr/idb-dux/server'
import type { EventHandler, H3Event } from 'h3'
import {
  createAuthSyncHandler,
  createServerKit,
  createWebhookHandler,
} from '@mszr/idb-dux/server'
import {
  createError,
  defineEventHandler,
  deleteCookie,
  getCookie,
  getHeader,
  readBody,
  readRawBody,
  setCookie,
  setResponseStatus,
} from 'h3'

const nuxt4H3Adapter: IdbDuxServerAdapter<H3Event> = {
  getCookie: (event, name) => getCookie(event, name),
  getHeader: (event, name) => getHeader(event, name),
  readJsonBody: <T>(event: H3Event): Promise<T> => readBody<T>(event),
  readRawText: async event => (await readRawBody(event, 'utf8')) ?? '',
  state: event => event.context as Record<string, unknown>,
  setCookie: (event, name, value, opts) => setCookie(event, name, value, opts),
  deleteCookie: (event, name, opts) => deleteCookie(event, name, opts),
  setStatus: (event, code) => setResponseStatus(event, code),
  httpError: (code, message) => createError({ statusCode: code, statusMessage: message }),
}

export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S, H3Event>,
): IdbServerKitFactory<S, H3Event> {
  return createServerKit(nuxt4H3Adapter, config)
}

export function defineAuthSyncHandler(config: IdbAuthSyncConfig<H3Event>): EventHandler {
  const core = createAuthSyncHandler(nuxt4H3Adapter, config)
  return defineEventHandler(event => core(event))
}

export function defineWebhookHandler<S extends IdbSchema = IdbRegisteredSchema>(
  handlers: IdbWebhookHandlers<S>,
  opts?: IdbWebhookVerifyOpts,
): EventHandler {
  const core = createWebhookHandler(nuxt4H3Adapter, handlers, opts)
  return defineEventHandler(event => core(event))
}
