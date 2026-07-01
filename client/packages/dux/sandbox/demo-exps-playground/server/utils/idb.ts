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
import schema from '~~/config/instant.schema'

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

// Nuxt 4 / Nitro 2 still rides h3 v1, so this sandbox owns the small adapter over
// `@mszr/idb-dux/server` — the same bring-your-own recipe the main demo uses.
// Routes still get the delightful shape: one factory at module scope; one
// `await useServerIdb(event, mode)` per route.
// Docs: https://github.com/mareszhar/instant/blob/dux/client/packages/dux/docs/dux-spec-server.md
export const useServerIdb = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
