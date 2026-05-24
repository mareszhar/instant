import type { InstantSchemaDef } from '@instantdb/core'
import type { H3Event } from 'h3'
import { createError, getCookie } from 'h3'

type MaybeString = string | null | undefined

export type ServerIdbMode
  = | 'adminDb'
    | 'baseDb'
    | 'guestDb'
    | 'userDb?'
    | 'userDb!'
    | 'user?'
    | 'user!'
    | 'all?'
    | 'all!'

export type ServerIdbAsUserOptions
  = | { token: string }
    | { guest: true }
    | { email: string }

export interface ServerIdbClient<AuthUser = unknown> {
  auth: {
    verifyToken: (token: string) => Promise<AuthUser>
  }
  asUser: (options: ServerIdbAsUserOptions) => any
}

export interface ServerIdbInitConfig<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
> {
  appId: string
  adminToken?: string
  apiURI?: string
  schema?: Schema
  useDateObjects?: UseDates
  disableValidation?: boolean
  verbose?: boolean
  WritableStream?: any
  ReadableStream?: any
}

type StaticConfigFor<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean,
> = Omit<
  ServerIdbInitConfig<Schema, UseDates>,
  'appId' | 'adminToken'
>

type ScopedDbFor<Db extends ServerIdbClient> = ReturnType<Db['asUser']>
type AuthUserFor<Db extends ServerIdbClient> = Awaited<
  ReturnType<Db['auth']['verifyToken']>
>

export type DefineServerIdbOptions<
  Schema extends InstantSchemaDef<any, any, any>,
  Db extends ServerIdbClient,
  UseDates extends boolean = false,
  Event extends H3Event = H3Event,
> = StaticConfigFor<Schema, UseDates> & {
  /**
   * The `init` function from `@instantdb/admin`.
   */
  init: (config: ServerIdbInitConfig<Schema, UseDates>) => Db
  /**
   * Resolve the Instant app ID for this request.
   */
  getAppId: (event: Event) => MaybeString
  /**
   * Resolve the private admin token for modes that return `adminDb`.
   */
  getAdminToken?: (event: Event) => MaybeString
  /**
   * Override the cookie name used for token-backed auth modes.
   */
  getCookieName?: (appId: string, event: Event) => string
}

export interface UseServerIdbAdminResult<AdminDb> {
  adminDb: AdminDb
}

export interface UseServerIdbBaseResult<BaseDb> {
  baseDb: BaseDb
}

export interface UseServerIdbGuestResult<GuestDb> {
  guestDb: GuestDb
}

export interface UseServerIdbOptionalUserDbResult<UserDb> {
  token: string | null
  userDb: UserDb | null
}

export interface UseServerIdbRequiredUserDbResult<UserDb> {
  token: string
  userDb: UserDb
}

export type UseServerIdbOptionalUserResult<UserDb, AuthUser>
  = UseServerIdbOptionalUserDbResult<UserDb> & {
    user: AuthUser | null
  }

export type UseServerIdbRequiredUserResult<UserDb, AuthUser>
  = UseServerIdbRequiredUserDbResult<UserDb> & {
    user: AuthUser
  }

export type UseServerIdbOptionalAllResult<AdminDb, BaseDb, GuestDb, UserDb, AuthUser>
  = UseServerIdbAdminResult<AdminDb>
    & UseServerIdbBaseResult<BaseDb>
    & UseServerIdbGuestResult<GuestDb>
    & UseServerIdbOptionalUserResult<UserDb, AuthUser>

export type UseServerIdbRequiredAllResult<AdminDb, BaseDb, GuestDb, UserDb, AuthUser>
  = UseServerIdbAdminResult<AdminDb>
    & UseServerIdbBaseResult<BaseDb>
    & UseServerIdbGuestResult<GuestDb>
    & UseServerIdbRequiredUserResult<UserDb, AuthUser>

export interface UseServerIdb<
  Db extends ServerIdbClient,
  Event extends H3Event = H3Event,
> {
  /**
   * Return a privileged admin DB. Requires `getAdminToken`.
   */
  (event: Event): UseServerIdbAdminResult<Db>
  /**
   * Return a privileged admin DB. Requires `getAdminToken`.
   */
  (event: Event, mode: 'adminDb'): UseServerIdbAdminResult<Db>
  /**
   * Return an Admin SDK DB initialized without an admin token.
   */
  (event: Event, mode: 'baseDb'): UseServerIdbBaseResult<Db>
  /**
   * Return a guest-scoped DB.
   */
  (event: Event, mode: 'guestDb'): UseServerIdbGuestResult<ScopedDbFor<Db>>
  /**
   * Return a token-scoped DB when the auth cookie exists; otherwise return nulls.
   * This does not verify the token.
   */
  (event: Event, mode: 'userDb?'): UseServerIdbOptionalUserDbResult<ScopedDbFor<Db>>
  /**
   * Return a token-scoped DB when the auth cookie exists; otherwise throw 401.
   * This does not verify the token.
   */
  (event: Event, mode: 'userDb!'): UseServerIdbRequiredUserDbResult<ScopedDbFor<Db>>
  /**
   * Verify the auth cookie and return user auth state when valid; otherwise return nulls.
   */
  (
    event: Event,
    mode: 'user?',
  ): Promise<UseServerIdbOptionalUserResult<ScopedDbFor<Db>, AuthUserFor<Db>>>
  /**
   * Verify the auth cookie and return user auth state when valid; otherwise throw 401.
   */
  (
    event: Event,
    mode: 'user!',
  ): Promise<UseServerIdbRequiredUserResult<ScopedDbFor<Db>, AuthUserFor<Db>>>
  /**
   * Return admin, base, guest, and optional verified user auth state.
   */
  (
    event: Event,
    mode: 'all?',
  ): Promise<
    UseServerIdbOptionalAllResult<
      Db,
      Db,
      ScopedDbFor<Db>,
      ScopedDbFor<Db>,
      AuthUserFor<Db>
    >
  >
  /**
   * Return admin, base, guest, and required verified user auth state.
   */
  (
    event: Event,
    mode: 'all!',
  ): Promise<
    UseServerIdbRequiredAllResult<
      Db,
      Db,
      ScopedDbFor<Db>,
      ScopedDbFor<Db>,
      AuthUserFor<Db>
    >
  >
}

export function getDefaultServerIdbCookieName(appId: string) {
  return `instant_token_${appId}`
}

function normalizeRequiredConfig(value: MaybeString, name: string) {
  const resolved = value?.trim() ?? ''

  if (!resolved) {
    throw createError({
      statusCode: 500,
      statusMessage: `Missing required server IDB config: ${name}`,
    })
  }

  return resolved
}

function createUnauthorizedError(cause?: unknown) {
  const input: {
    statusCode: number
    statusMessage: string
    cause?: unknown
  } = {
    statusCode: 401,
    statusMessage: 'Unauthorized',
  }

  if (cause !== undefined)
    input.cause = cause

  return createError(input)
}

export function defineServerIdb<
  Schema extends InstantSchemaDef<any, any, any>,
  Db extends ServerIdbClient,
  UseDates extends boolean = false,
  Event extends H3Event = H3Event,
>(
  config: DefineServerIdbOptions<Schema, Db, UseDates, Event>,
): UseServerIdb<Db, Event> {
  const {
    init,
    getAppId,
    getAdminToken,
    getCookieName = getDefaultServerIdbCookieName,
    ...staticConfig
  } = config

  type UserDb = ScopedDbFor<Db>
  type AuthUser = AuthUserFor<Db>

  const baseDbCache = new Map<string, Db>()
  const adminDbCache = new Map<string, Db>()

  function resolveAppId(event: Event) {
    return normalizeRequiredConfig(getAppId(event), 'appId')
  }

  function resolveAdminToken(event: Event) {
    return normalizeRequiredConfig(getAdminToken?.(event), 'adminToken')
  }

  function getBaseDb(event: Event) {
    const appId = resolveAppId(event)
    const cached = baseDbCache.get(appId)

    if (cached)
      return cached

    const db = init({
      ...staticConfig,
      appId,
    } as ServerIdbInitConfig<Schema, UseDates>)

    baseDbCache.set(appId, db)
    return db
  }

  function getAdminDb(event: Event) {
    const appId = resolveAppId(event)
    const adminToken = resolveAdminToken(event)
    const cacheKey = `${appId}:${adminToken}`
    const cached = adminDbCache.get(cacheKey)

    if (cached)
      return cached

    const db = init({
      ...staticConfig,
      appId,
      adminToken,
    } as ServerIdbInitConfig<Schema, UseDates>)

    adminDbCache.set(cacheKey, db)
    return db
  }

  function getToken(event: Event) {
    const appId = resolveAppId(event)
    return getCookie(event, getCookieName(appId, event)) ?? null
  }

  function getUserDb(event: Event, required: boolean) {
    const token = getToken(event)

    if (!token) {
      if (required)
        throw createUnauthorizedError()

      return {
        token: null,
        userDb: null,
      }
    }

    return {
      token,
      userDb: getBaseDb(event).asUser({ token }) as UserDb,
    }
  }

  async function getVerifiedUser(event: Event, required: boolean) {
    const token = getToken(event)

    if (!token) {
      if (required)
        throw createUnauthorizedError()

      return {
        token: null,
        userDb: null,
        user: null,
      }
    }

    const baseDb = getBaseDb(event)

    try {
      const user = await baseDb.auth.verifyToken(token) as AuthUser

      return {
        token,
        userDb: baseDb.asUser({ token }) as UserDb,
        user,
      }
    }
    catch (error) {
      if (required)
        throw createUnauthorizedError(error)

      return {
        token: null,
        userDb: null,
        user: null,
      }
    }
  }

  function getGuestDb(event: Event) {
    return getBaseDb(event).asUser({ guest: true }) as UserDb
  }

  function useServerIdb(event: Event, mode: ServerIdbMode = 'adminDb') {
    switch (mode) {
      case 'adminDb':
        return { adminDb: getAdminDb(event) }
      case 'baseDb':
        return { baseDb: getBaseDb(event) }
      case 'guestDb':
        return { guestDb: getGuestDb(event) }
      case 'userDb?':
        return getUserDb(event, false)
      case 'userDb!':
        return getUserDb(event, true)
      case 'user?':
        return getVerifiedUser(event, false)
      case 'user!':
        return getVerifiedUser(event, true)
      case 'all?':
        return getVerifiedUser(event, false).then(auth => ({
          adminDb: getAdminDb(event),
          baseDb: getBaseDb(event),
          guestDb: getGuestDb(event),
          ...auth,
        }))
      case 'all!':
        return getVerifiedUser(event, true).then(auth => ({
          adminDb: getAdminDb(event),
          baseDb: getBaseDb(event),
          guestDb: getGuestDb(event),
          ...auth,
        }))
    }
  }

  return useServerIdb as UseServerIdb<Db, Event>
}
