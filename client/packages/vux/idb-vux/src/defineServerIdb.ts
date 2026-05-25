import type {
  ImpersonationOpts,
  init as initAdmin,
  InstantAdminDatabase,
  InstantConfig,
  InstantSchemaDef,
} from '@instantdb/admin'
import type { H3Event } from 'h3'
import { createError, getCookie } from 'h3'

type MaybeString = string | null | undefined
declare const instantServerDbKind: unique symbol

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

export type InstantServerDbKind
  = | 'adminDb'
    | 'baseDb'
    | 'guestDb'
    | 'userDb'

export type InstantServerDbMode = InstantServerDbKind | 'all'

interface ServerDbKindBrand<Mode extends InstantServerDbMode> {
  readonly [instantServerDbKind]: Mode extends 'all' ? InstantServerDbKind : Mode
}

export type InstantServerDb<
  Schema extends InstantSchemaDef<any, any, any>,
  Mode extends InstantServerDbMode = 'all',
  UseDates extends boolean = false,
> = InstantAdminDatabase<Schema, UseDates, InstantConfig<Schema, UseDates>>
  & ServerDbKindBrand<Mode>

type BrandedServerDb<
  Db,
  Mode extends InstantServerDbKind,
> = Db & ServerDbKindBrand<Mode>

export type ServerIdbAsUserOptions = ImpersonationOpts

export interface ServerIdbClient<AuthUser = unknown> {
  auth: {
    verifyToken: (token: string) => Promise<AuthUser>
  }
  asUser: (options: ServerIdbAsUserOptions) => any
}

export type ServerIdbInitConfig<
  Schema extends InstantSchemaDef<any, any, any> = InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
> = Parameters<typeof initAdmin<Schema, UseDates>>[0]

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
  (event: Event): UseServerIdbAdminResult<BrandedServerDb<Db, 'adminDb'>>
  /**
   * Return a privileged admin DB. Requires `getAdminToken`.
   */
  (event: Event, mode: 'adminDb'): UseServerIdbAdminResult<BrandedServerDb<Db, 'adminDb'>>
  /**
   * Return an Admin SDK DB initialized without an admin token.
   */
  (event: Event, mode: 'baseDb'): UseServerIdbBaseResult<BrandedServerDb<Db, 'baseDb'>>
  /**
   * Return a guest-scoped DB.
   */
  (event: Event, mode: 'guestDb'): UseServerIdbGuestResult<BrandedServerDb<ScopedDbFor<Db>, 'guestDb'>>
  /**
   * Return a token-scoped DB when the auth cookie exists; otherwise return nulls.
   * This does not verify the token.
   */
  (event: Event, mode: 'userDb?'): UseServerIdbOptionalUserDbResult<BrandedServerDb<ScopedDbFor<Db>, 'userDb'>>
  /**
   * Return a token-scoped DB when the auth cookie exists; otherwise throw 401.
   * This does not verify the token.
   */
  (event: Event, mode: 'userDb!'): UseServerIdbRequiredUserDbResult<BrandedServerDb<ScopedDbFor<Db>, 'userDb'>>
  /**
   * Verify the auth cookie and return user auth state when valid; otherwise return nulls.
   */
  (
    event: Event,
    mode: 'user?',
  ): Promise<UseServerIdbOptionalUserResult<BrandedServerDb<ScopedDbFor<Db>, 'userDb'>, AuthUserFor<Db>>>
  /**
   * Verify the auth cookie and return user auth state when valid; otherwise throw 401.
   */
  (
    event: Event,
    mode: 'user!',
  ): Promise<UseServerIdbRequiredUserResult<BrandedServerDb<ScopedDbFor<Db>, 'userDb'>, AuthUserFor<Db>>>
  /**
   * Return admin, base, guest, and optional verified user auth state.
   */
  (
    event: Event,
    mode: 'all?',
  ): Promise<
    UseServerIdbOptionalAllResult<
      BrandedServerDb<Db, 'adminDb'>,
      BrandedServerDb<Db, 'baseDb'>,
      BrandedServerDb<ScopedDbFor<Db>, 'guestDb'>,
      BrandedServerDb<ScopedDbFor<Db>, 'userDb'>,
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
      BrandedServerDb<Db, 'adminDb'>,
      BrandedServerDb<Db, 'baseDb'>,
      BrandedServerDb<ScopedDbFor<Db>, 'guestDb'>,
      BrandedServerDb<ScopedDbFor<Db>, 'userDb'>,
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

  const requestCacheKey = Symbol('idb-vux:server-idb-cache')

  interface RequestCache {
    appId?: string
    adminToken?: string
    token: string | null
    tokenResolved: boolean
    adminDb?: BrandedServerDb<Db, 'adminDb'>
    baseDb?: BrandedServerDb<Db, 'baseDb'>
    guestDb?: BrandedServerDb<UserDb, 'guestDb'>
    userDbByToken: Map<string, BrandedServerDb<UserDb, 'userDb'>>
    verifiedUserByToken: Map<string, Promise<AuthUser>>
  }

  const baseDbCache = new Map<string, BrandedServerDb<Db, 'baseDb'>>()
  const adminDbCache = new Map<string, BrandedServerDb<Db, 'adminDb'>>()

  function createRequestCache(): RequestCache {
    return {
      token: null,
      tokenResolved: false,
      userDbByToken: new Map(),
      verifiedUserByToken: new Map(),
    }
  }

  function getRequestCache(event: Event) {
    const context = event.context as Event['context'] & {
      [requestCacheKey]?: RequestCache
    }

    context[requestCacheKey] ??= createRequestCache()
    return context[requestCacheKey]
  }

  function resolveAppId(event: Event) {
    const requestCache = getRequestCache(event)

    if (requestCache.appId)
      return requestCache.appId

    const appId = normalizeRequiredConfig(getAppId(event), 'appId')
    requestCache.appId = appId

    return appId
  }

  function resolveAdminToken(event: Event) {
    const requestCache = getRequestCache(event)

    if (requestCache.adminToken)
      return requestCache.adminToken

    const adminToken = normalizeRequiredConfig(getAdminToken?.(event), 'adminToken')
    requestCache.adminToken = adminToken

    return adminToken
  }

  function getBaseDb(event: Event) {
    const requestCache = getRequestCache(event)

    if (requestCache.baseDb)
      return requestCache.baseDb

    const appId = resolveAppId(event)
    const cached = baseDbCache.get(appId)

    if (cached) {
      requestCache.baseDb = cached
      return cached
    }

    const db = init({
      ...staticConfig,
      appId,
    } as ServerIdbInitConfig<Schema, UseDates>) as BrandedServerDb<Db, 'baseDb'>

    baseDbCache.set(appId, db)
    requestCache.baseDb = db

    return db
  }

  function getAdminDb(event: Event) {
    const requestCache = getRequestCache(event)

    if (requestCache.adminDb)
      return requestCache.adminDb

    const appId = resolveAppId(event)
    const adminToken = resolveAdminToken(event)
    const cacheKey = `${appId}:${adminToken}`
    const cached = adminDbCache.get(cacheKey)

    if (cached) {
      requestCache.adminDb = cached
      return cached
    }

    const db = init({
      ...staticConfig,
      appId,
      adminToken,
    } as ServerIdbInitConfig<Schema, UseDates>) as BrandedServerDb<Db, 'adminDb'>

    adminDbCache.set(cacheKey, db)
    requestCache.adminDb = db

    return db
  }

  function getToken(event: Event) {
    const requestCache = getRequestCache(event)

    if (requestCache.tokenResolved)
      return requestCache.token

    const appId = resolveAppId(event)
    const token = getCookie(event, getCookieName(appId, event)) ?? null

    requestCache.token = token
    requestCache.tokenResolved = true

    return token
  }

  function getUserDbForToken(event: Event, token: string) {
    const requestCache = getRequestCache(event)
    const cached = requestCache.userDbByToken.get(token)

    if (cached)
      return cached

    const userDb = getBaseDb(event).asUser({ token }) as BrandedServerDb<UserDb, 'userDb'>

    requestCache.userDbByToken.set(token, userDb)
    return userDb
  }

  function verifyToken(event: Event, token: string) {
    const requestCache = getRequestCache(event)
    const cached = requestCache.verifiedUserByToken.get(token)

    if (cached)
      return cached

    const verifiedUser = getBaseDb(event).auth.verifyToken(token) as Promise<AuthUser>

    requestCache.verifiedUserByToken.set(token, verifiedUser)
    return verifiedUser
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
      userDb: getUserDbForToken(event, token),
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

    try {
      const user = await verifyToken(event, token)

      return {
        token,
        userDb: getUserDbForToken(event, token),
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
    const requestCache = getRequestCache(event)

    if (requestCache.guestDb)
      return requestCache.guestDb

    const guestDb = getBaseDb(event).asUser({ guest: true }) as BrandedServerDb<UserDb, 'guestDb'>

    requestCache.guestDb = guestDb
    return guestDb
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
