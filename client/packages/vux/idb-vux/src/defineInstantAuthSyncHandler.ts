import type {
  InstantRouteHandlerBody,
  InstantRouteHandlerPayloadByType,
} from '@instantdb/core'
import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import {
  createError,
  defineEventHandler,
  deleteCookie,
  getRequestProtocol,
  readBody,
  setCookie,
} from 'h3'

const DEFAULT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

type MaybeString = string | null | undefined

/**
 * Default cookie name shared by Vux's Nuxt auth-sync and server DB helpers.
 *
 * The auth sync endpoint writes this cookie, and `defineServerIdb` reads it for
 * token-scoped and verified-user modes.
 */
export function getDefaultServerIdbCookieName(appId: string) {
  return `instant_token_${appId}`
}

/**
 * Minimum user shape needed by Vux's auth-sync handler.
 *
 * Instant sends the full current user to `firstPartyPath`, but Vux only stores
 * `refresh_token` in the server cookie by default.
 */
type InstantAuthSyncRefreshToken
  = NonNullable<
    InstantRouteHandlerPayloadByType['sync-user']['user']
  >['refresh_token']

export interface InstantAuthSyncUser {
  refresh_token: InstantAuthSyncRefreshToken | null | undefined
}

/**
 * Request body Instant sends to the configured `firstPartyPath` endpoint when
 * client auth state changes.
 *
 * Use `InstantAuthSyncBody<MyUser>` when authoring a custom endpoint that wants
 * to inspect more user fields than Vux's default handler needs.
 */
export type InstantAuthSyncBody<
  UserLike extends InstantAuthSyncUser = InstantAuthSyncUser,
> = Omit<InstantRouteHandlerBody<'sync-user'>, 'user'> & {
  user: UserLike | null
}

export type InstantAuthSyncCookieOptions = NonNullable<
  Parameters<typeof setCookie>[3]
>

/**
 * Cookie options for the auth-sync cookie.
 *
 * Pass an object for static options, or a function when options depend on the
 * current request or app ID.
 */
export type InstantAuthSyncCookieOptionsInput<
  Event extends H3Event = H3Event,
>
  = | InstantAuthSyncCookieOptions
    | ((event: Event, appId: string) => InstantAuthSyncCookieOptions)

/**
 * Options for `defineInstantAuthSyncHandler`.
 */
export interface DefineInstantAuthSyncHandlerOptions<
  Event extends H3Event = H3Event,
> {
  /**
   * Resolve the Instant app ID for this request.
   */
  getAppId: (event: Event) => MaybeString
  /**
   * Override the cookie name used for server-side token-backed auth modes.
   * Use the same resolver passed to `defineServerIdb`.
   */
  getCookieName?: (appId: string, event: Event) => string
  /**
   * Override or extend the cookie options used when syncing auth.
   *
   * Defaults are `path: '/'`, `httpOnly: true`, `sameSite: 'strict'`,
   * `maxAge: 7 days`, and `secure` when the request protocol is HTTPS.
   */
  cookieOptions?: InstantAuthSyncCookieOptionsInput<Event>
}

function normalizeRequiredConfig(value: MaybeString, name: string) {
  const resolved = value?.trim() ?? ''

  if (!resolved) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing required auth sync config: ${name}`,
    })
  }

  return resolved
}

function createCookieOptions<Event extends H3Event>(
  event: Event,
  appId: string,
  input: InstantAuthSyncCookieOptionsInput<Event> | undefined,
) {
  const resolved = typeof input === 'function' ? input(event, appId) : input

  return {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: DEFAULT_COOKIE_MAX_AGE_SECONDS,
    secure: getRequestProtocol(event) === 'https',
    ...resolved,
  } satisfies InstantAuthSyncCookieOptions
}

function createDeleteCookieOptions(options: InstantAuthSyncCookieOptions) {
  const {
    expires: _expires,
    maxAge: _maxAge,
    ...deleteOptions
  } = options

  return deleteOptions
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function getRefreshTokenFromUser(user: unknown) {
  if (user === null || user === undefined) {
    return undefined
  }

  if (!isRecord(user)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid "user" field',
    })
  }

  const token = user.refresh_token

  if (token === null || token === undefined || token === '') {
    return undefined
  }

  if (typeof token !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid "user.refresh_token" field',
    })
  }

  return token
}

/**
 * Create a Nuxt/H3 event handler for Instant's `firstPartyPath` auth sync.
 *
 * The handler accepts Instant's `sync-user` payload, verifies that the payload
 * app ID matches `getAppId(event)`, stores `user.refresh_token` in an
 * HTTP-only cookie, and clears the cookie when the synced user is missing.
 *
 * The cookie is token-only by design. It is read by `defineServerIdb` for
 * `userDb?`, `userDb!`, `user?`, `user!`, `all?`, and `all!` modes.
 *
 * @example
 * ```ts
 * // server/api/auth.post.ts
 * export default defineInstantAuthSyncHandler({
 *   getAppId: event => useRuntimeConfig(event).public.instantAppId,
 * })
 * ```
 */
export function defineInstantAuthSyncHandler<
  Event extends H3Event = H3Event,
  UserLike extends InstantAuthSyncUser = InstantAuthSyncUser,
>(
  config: DefineInstantAuthSyncHandlerOptions<Event>,
): EventHandler<EventHandlerRequest, Promise<null>> {
  const {
    cookieOptions,
    getAppId,
    getCookieName = getDefaultServerIdbCookieName,
  } = config

  return defineEventHandler(async (event) => {
    const typedEvent = event as Event
    const appId = normalizeRequiredConfig(getAppId(typedEvent), 'appId')
    const body = await readBody<Partial<InstantAuthSyncBody<UserLike>> | null>(
      typedEvent,
    )

    if (!body?.type) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing "type" field',
      })
    }

    if (body.appId !== appId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'App ID mismatch',
      })
    }

    if (body.type !== 'sync-user') {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown type: ${body.type}`,
      })
    }

    const name = getCookieName(appId, typedEvent)
    const options = createCookieOptions(typedEvent, appId, cookieOptions)
    const token = getRefreshTokenFromUser(body.user)

    if (token) {
      setCookie(typedEvent, name, token, options)
    }
    else {
      deleteCookie(typedEvent, name, createDeleteCookieOptions(options))
    }

    return null
  })
}
