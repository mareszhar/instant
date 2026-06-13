/**
 * `defineAuthSyncHandler` — the route handler for Instant's `firstPartyPath`
 * auth sync ([dux-spec-nuxt.md §3]). One line to mount.
 *
 * Intentional cookie divergence: the official handler stores the full user JSON
 * in `instant_user_<appId>`. dux stores only the `refresh_token` in
 * `instant_token_<appId>` — a smaller cookie, less user data on the wire; the
 * server kit re-derives the user from the token when a mode asks for it.
 * Cookie attributes (SameSite/secure/path/expiry) follow the official handler;
 * `createInstantRouteHandler` remains re-exported for the official shape.
 */
import type { EventHandler } from 'h3'
import type { IdbAuthSyncConfig } from './types.js'
import { defineEventHandler, deleteCookie, readBody, setCookie, setResponseStatus } from 'h3'

const COOKIE_OPTS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 604800, // 7 days, matching the official handler
} as const

interface SyncBody {
  type?: string
  appId?: string
  user?: { refresh_token?: string } | null
}

export function defineAuthSyncHandler(config: IdbAuthSyncConfig): EventHandler {
  return defineEventHandler(async (event) => {
    const appId = config.getAppId(event)

    let body: SyncBody | undefined
    try {
      body = await readBody<SyncBody>(event)
    }
    catch {
      setResponseStatus(event, 400)
      return { ok: false, error: 'Invalid JSON body' }
    }

    if (!body?.type) {
      setResponseStatus(event, 400)
      return { ok: false, error: 'Missing "type" field' }
    }
    if (body.appId !== appId) {
      setResponseStatus(event, 403)
      return { ok: false, error: 'App ID mismatch' }
    }
    if (body.type !== 'sync-user') {
      setResponseStatus(event, 400)
      return { ok: false, error: `Unknown type: ${body.type}` }
    }

    const name = `instant_token_${appId}`
    const token = body.user?.refresh_token
    if (token)
      setCookie(event, name, token, COOKIE_OPTS)
    else
      deleteCookie(event, name, { path: COOKIE_OPTS.path, httpOnly: true, secure: true, sameSite: 'strict' })

    return { ok: true }
  })
}
