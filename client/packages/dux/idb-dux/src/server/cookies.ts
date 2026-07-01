/**
 * Cookie attributes and the default token-cookie name — the small shared
 * vocabulary the auth-sync write side and the kit's read side agree on
 * ([dux-spec-server.md §5]).
 */

/** Attributes of the auth cookie `defineAuthSyncHandler` writes. */
export interface IdbServerCookieOptions {
  /** Cookie `Path`. Default `'/'`. */
  path: string
  /** `HttpOnly` — keep the cookie out of `document.cookie`. Default `true`. */
  httpOnly: boolean
  /** `Secure` — HTTPS only. Default `true`. */
  secure: boolean
  /** `SameSite` policy. Default `'strict'`. */
  sameSite: 'strict' | 'lax' | 'none'
  /** `Max-Age` in seconds. Default `604800` (7 days), matching the official handler. */
  maxAge: number
  /** `Domain` — unset by default (host-only). Set to share one cookie across subdomains. */
  domain?: string
}

/** The auth cookie's default attributes — parity with the official route handler. */
export const DEFAULT_COOKIE_OPTIONS: IdbServerCookieOptions = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 604800,
}

/**
 * The default token-cookie name for an app: `instant_token_<appId>`. Both
 * `defineAuthSyncHandler` (write) and `tokenFrom: 'cookie'` (read) derive the
 * name this way, so they agree without configuration.
 */
export const tokenCookieName = (appId: string): string => `instant_token_${appId}`
