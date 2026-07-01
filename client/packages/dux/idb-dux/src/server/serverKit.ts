/**
 * `createServerKit` — the framework-agnostic core behind every adapter's
 * `defineServerKit` ([dux-spec-server.md §4]). One factory at module scope, one
 * `await` in the route, typed results; the route declares its auth strictness
 * (the mode) and the kit's keys follow, so there is no hand-rolled token
 * reading, verification, or 401 boilerplate.
 *
 * Request-scoped caching (principle 8): the admin db is built once per process,
 * and the token read + verification promise + per-request `userDb` are cached on
 * the adapter's per-request state, so repeated kit calls in one request reuse
 * them — and concurrent calls share a single verification.
 */
import type { IdbAdminClient, IdbAuthUser } from '../admin/index.js'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbDuxServerAdapter } from './adapter.js'
import type { IdbServerRequestReader, IdbServerTokenSource } from './token.js'
import { init as adminInit } from '../admin/index.js'
import { resolveToken } from './token.js'

const CTX_USER = 'idbDuxKitUser'
const CTX_TOKEN = 'idbDuxKitToken'
const CTX_USERDB = 'idbDuxKitUserDb'

/** `defineServerKit` config — the schema plus lazy, request-scoped credential reads. */
export interface IdbServerKitConfig<S extends IdbSchema, Ctx> {
  /** Your registered schema — unlocks shaping and typed `ruleParams`. */
  schema: S
  /** Resolve the app id from the request (runtime config, env indirection, …). */
  getAppId: (event: Ctx) => string
  /** Resolve the admin token from the request. */
  getAdminToken: (event: Ctx) => string
  /**
   * Where the user's refresh token is carried on the request. Default
   * `'cookieOrBearer'` — reads the auth cookie for web clients and the
   * `Authorization: Bearer` header for shells/cross-origin, from one route.
   */
  tokenFrom?: IdbServerTokenSource
  /** Base URL for the Instant API (self-hosting Instant). Unrelated to your own backend. */
  apiURI?: string
}

/**
 * How strict the kit is about auth, declared at the call site. The kit's keys
 * follow the mode, so there is no manual narrowing or repeated 401 boilerplate.
 */
export type IdbServerKitMode = 'user?' | 'user' | 'userDb?' | 'userDb'

/** The kit a given mode yields — keys typed per the declared strictness. */
export type IdbServerKit<Mode extends IdbServerKitMode | undefined, S extends IdbSchema>
  = Mode extends undefined
    ? { adminDb: IdbAdminClient<S> }
    : Mode extends 'user'
      ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser }
      : Mode extends 'user?'
        ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser | undefined }
        : Mode extends 'userDb'
          ? { adminDb: IdbAdminClient<S>, user: IdbAuthUser, userDb: IdbAdminClient<S> }
          : { adminDb: IdbAdminClient<S>, user: IdbAuthUser | undefined, userDb: IdbAdminClient<S> | undefined }

/** The request-kit factory an adapter's `defineServerKit` returns. */
export interface IdbServerKitFactory<S extends IdbSchema, Ctx> {
  (event: Ctx): Promise<IdbServerKit<undefined, S>>
  <Mode extends IdbServerKitMode>(event: Ctx, mode: Mode): Promise<IdbServerKit<Mode, S>>
}

/**
 * Build a request-kit factory over an adapter. An adapter's `defineServerKit`
 * is just `createServerKit(theAdapter, config)`.
 */
export function createServerKit<S extends IdbSchema, Ctx>(
  adapter: IdbDuxServerAdapter<Ctx>,
  config: IdbServerKitConfig<S, Ctx>,
): IdbServerKitFactory<S, Ctx> {
  let adminDb: IdbAdminClient<S> | undefined
  const tokenSource: IdbServerTokenSource = config.tokenFrom ?? 'cookieOrBearer'

  // Built once per process — only the per-user work is per-request.
  const getAdminDb = (event: Ctx): IdbAdminClient<S> =>
    (adminDb ??= adminInit<S>({
      appId: config.getAppId(event),
      adminToken: config.getAdminToken(event),
      schema: config.schema,
      ...(config.apiURI ? { apiURI: config.apiURI } : {}),
    }))

  // One token read + one verification promise per request, shared by every
  // kit call on the same request (concurrent calls await the same promise).
  async function resolveAuth(
    event: Ctx,
    db: IdbAdminClient<S>,
    appId: string,
  ): Promise<{ user: IdbAuthUser | undefined, token: string | undefined }> {
    const state = adapter.state(event)
    if (!(CTX_USER in state)) {
      const reader: IdbServerRequestReader = {
        cookie: name => adapter.getCookie(event, name),
        header: name => adapter.getHeader(event, name),
        appId,
      }
      const token = resolveToken(tokenSource, reader)
      state[CTX_TOKEN] = token
      state[CTX_USER] = token
        ? db.auth.verifyToken(token).then(
            (u: IdbAuthUser) => u,
            () => undefined,
          )
        : Promise.resolve(undefined)
    }
    return {
      user: await (state[CTX_USER] as Promise<IdbAuthUser | undefined>),
      token: state[CTX_TOKEN] as string | undefined,
    }
  }

  async function useServerKit(
    event: Ctx,
    mode?: IdbServerKitMode,
  ): Promise<Record<string, unknown>> {
    const db = getAdminDb(event)
    if (!mode)
      return { adminDb: db }

    const { user, token } = await resolveAuth(event, db, config.getAppId(event))
    if ((mode === 'user' || mode === 'userDb') && !user)
      throw adapter.httpError(401, 'Unauthorized')

    if (mode === 'user' || mode === 'user?')
      return { adminDb: db, user }

    const state = adapter.state(event)
    const userDb
      = user && token ? (state[CTX_USERDB] ??= db.asUser({ token })) : undefined
    return { adminDb: db, user, userDb }
  }

  return useServerKit as IdbServerKitFactory<S, Ctx>
}
