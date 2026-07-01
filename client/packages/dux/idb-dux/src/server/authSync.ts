/**
 * `createAuthSyncHandler` — the framework-agnostic core behind every adapter's
 * `defineAuthSyncHandler` ([dux-spec-server.md §5]): the route for Instant's
 * `firstPartyPath` auth sync.
 *
 * **Cookie transport only.** This handler exists to set a cookie; bearer clients
 * hold the token and attach it themselves, so a bearer-only backend never mounts
 * it.
 *
 * Intentional cookie divergence: the official handler stores the full user JSON
 * in `instant_user_<appId>`. dux stores only the `refresh_token` in
 * `instant_token_<appId>` — a smaller cookie, less user data on the wire; the
 * server kit re-derives the user from the token when a mode asks for it.
 */
import type { IdbDuxServerAdapter } from './adapter.js'
import type { IdbServerCookieOptions } from './cookies.js'
import { DEFAULT_COOKIE_OPTIONS, tokenCookieName } from './cookies.js'

/** `defineAuthSyncHandler` config — the app id, plus optional cookie customization. */
export interface IdbAuthSyncConfig<Ctx> {
  /** Resolve the app id from the request (must match the client's app id). */
  getAppId: (event: Ctx) => string
  /** Cookie name to write/clear. Default `instant_token_<appId>` — match `tokenFrom`'s. */
  cookieName?: string
  /** Override cookie attributes — `sameSite`/`secure`/`domain`/`path`/`maxAge`. */
  cookie?: Partial<IdbServerCookieOptions>
  /**
   * Full control: receive the refresh token (or `undefined` to clear) and
   * persist it however you like — custom name, expiry, store. When provided, the
   * default cookie write/clear is skipped; the appId/type validation and the
   * `{ ok: true }` response are not.
   */
  persistToken?: (token: string | undefined, event: Ctx) => void | Promise<void>
}

/** The `sync-user` body Instant's client POSTs to `firstPartyPath`. */
interface SyncBody {
  type?: string
  appId?: string
  user?: { refresh_token?: string } | null
}

/** The handler's response shape — `{ ok: true }`, or `{ ok: false, error }` with a 4xx status set. */
export interface IdbAuthSyncResult {
  ok: boolean
  error?: string
}

/**
 * Build the auth-sync core over an adapter. An adapter's `defineAuthSyncHandler`
 * wraps this in its native handler shape.
 */
export function createAuthSyncHandler<Ctx>(
  adapter: IdbDuxServerAdapter<Ctx>,
  config: IdbAuthSyncConfig<Ctx>,
): (event: Ctx) => Promise<IdbAuthSyncResult> {
  return async (event) => {
    const appId = config.getAppId(event)

    let body: SyncBody | undefined
    try {
      body = await adapter.readJsonBody<SyncBody>(event)
    }
    catch {
      adapter.setStatus(event, 400)
      return { ok: false, error: 'Invalid JSON body' }
    }

    if (!body?.type) {
      adapter.setStatus(event, 400)
      return { ok: false, error: 'Missing "type" field' }
    }
    if (body.appId !== appId) {
      adapter.setStatus(event, 403)
      return { ok: false, error: 'App ID mismatch' }
    }
    if (body.type !== 'sync-user') {
      adapter.setStatus(event, 400)
      return { ok: false, error: `Unknown type: ${body.type}` }
    }

    const token = body.user?.refresh_token || undefined

    if (config.persistToken) {
      await config.persistToken(token, event)
      return { ok: true }
    }

    const name = config.cookieName ?? tokenCookieName(appId)
    const opts: IdbServerCookieOptions = { ...DEFAULT_COOKIE_OPTIONS, ...config.cookie }
    if (token)
      adapter.setCookie(event, name, token, opts)
    else
      adapter.deleteCookie(event, name, opts)

    return { ok: true }
  }
}
