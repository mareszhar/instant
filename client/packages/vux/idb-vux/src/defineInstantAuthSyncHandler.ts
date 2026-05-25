import type { User } from '@instantdb/core'
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

export function getDefaultServerIdbCookieName(appId: string) {
  return `instant_token_${appId}`
}

export interface InstantAuthSyncUser {
  refresh_token: string | null | undefined
}

export interface InstantAuthSyncBody<
  UserLike extends InstantAuthSyncUser = User,
> {
  type: 'sync-user'
  appId: string
  user: UserLike | null
}

export type InstantAuthSyncCookieOptions = NonNullable<
  Parameters<typeof setCookie>[3]
>

export type InstantAuthSyncCookieOptionsInput<
  Event extends H3Event = H3Event,
>
  = | InstantAuthSyncCookieOptions
    | ((event: Event, appId: string) => InstantAuthSyncCookieOptions)

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

export function defineInstantAuthSyncHandler<
  Event extends H3Event = H3Event,
  UserLike extends InstantAuthSyncUser = User,
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
    const token = body.user?.refresh_token

    if (token) {
      setCookie(typedEvent, name, token, options)
    }
    else {
      deleteCookie(typedEvent, name, createDeleteCookieOptions(options))
    }

    return null
  })
}
