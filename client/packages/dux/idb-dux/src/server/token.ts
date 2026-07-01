/**
 * `tokenFrom` — where `defineServerKit` reads the user's Instant refresh token
 * from a request ([dux-spec-server.md §4]). Cookie is the no-ceremony web
 * transport; bearer is the cross-platform one (native shells, the browser
 * extension, any cross-origin backend). The default reads either.
 */
import { tokenCookieName } from './cookies.js'

/** The built-in transports `tokenFrom` understands. */
export type IdbServerTokenTransport = 'cookie' | 'bearer' | 'cookieOrBearer'

/**
 * A read-only view of the incoming request handed to a custom `tokenFrom`
 * resolver. **Not** a web `Request` — only what a token resolver could need,
 * exposed framework-agnostically.
 */
export interface IdbServerRequestReader {
  /** Read a request cookie by name (`undefined` if absent). */
  cookie: (name: string) => string | undefined
  /** Read a request header by name, case-insensitive (`undefined` if absent). */
  header: (name: string) => string | undefined
  /** The resolved app id for this request (from `getAppId`). */
  appId: string
}

/**
 * Where the refresh token is carried on the request. Default `'cookieOrBearer'`.
 *
 * - `'cookie'` — the cookie `instant_token_<appId>`. Web, same-origin.
 * - `'bearer'` — `Authorization: Bearer <token>`. Cross-platform.
 * - `'cookieOrBearer'` — cookie first, else bearer. Serves both from one route.
 * - `{ transport?, cookieName? }` — a preset with a custom cookie name
 *   (`{ cookieName: 'acme_session' }` keeps `cookieOrBearer`, renames the cookie).
 * - `{ header }` — a non-standard header carries the raw token (`{ header: 'x-acme-token' }`).
 * - `(req) => …` — full control; return the token or `undefined`.
 */
export type IdbServerTokenSource
  = | IdbServerTokenTransport
    | { transport?: IdbServerTokenTransport, cookieName?: string }
    | { header: string }
    | ((req: IdbServerRequestReader) => string | undefined)

/** Pull the token out of an `Authorization: Bearer <token>` header. */
function parseBearer(header: string | undefined): string | undefined {
  if (!header)
    return undefined
  const match = /^Bearer (.+)$/i.exec(header.trim())
  return match?.[1]?.trim() || undefined
}

/** Read a token by a built-in transport, honoring an optional custom cookie name. */
function readByTransport(
  transport: IdbServerTokenTransport,
  req: IdbServerRequestReader,
  cookieName?: string,
): string | undefined {
  const cookie = (): string | undefined =>
    req.cookie(cookieName ?? tokenCookieName(req.appId)) || undefined
  const bearer = (): string | undefined => parseBearer(req.header('authorization'))
  switch (transport) {
    case 'cookie':
      return cookie()
    case 'bearer':
      return bearer()
    case 'cookieOrBearer':
      return cookie() ?? bearer()
  }
}

/** Resolve the refresh token from a request per a `tokenFrom` source. */
export function resolveToken(
  source: IdbServerTokenSource,
  req: IdbServerRequestReader,
): string | undefined {
  if (typeof source === 'function')
    return source(req)
  if (typeof source === 'string')
    return readByTransport(source, req)
  if ('header' in source)
    return req.header(source.header) || undefined
  return readByTransport(source.transport ?? 'cookieOrBearer', req, source.cookieName)
}
