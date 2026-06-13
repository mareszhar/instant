/**
 * `defineServerKit` — the per-request kit factory ([dux-spec-nuxt.md §2]). One
 * factory at module scope, one `await` in the route, typed results; the route
 * declares its auth strictness (the mode) and the kit's keys follow, so there
 * is no hand-rolled token reading, verification, or 401 boilerplate.
 *
 * Request-scoped caching (principle 8): the admin db is built once per process,
 * and the token read + verification promise + per-request `userDb` are cached on
 * `event.context`, so repeated kit calls in one request reuse them — and
 * concurrent calls share a single verification.
 */
import type { H3Event } from 'h3'
import type { IdbAdminClient, IdbAuthUser } from '../admin/index.js'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type {
  IdbServerKitConfig,
  IdbServerKitFactory,
  IdbServerKitMode,
} from './types.js'
import { createError, getCookie } from 'h3'
import { init as adminInit } from '../admin/index.js'

const CTX_USER = 'idbDuxKitUser'
const CTX_TOKEN = 'idbDuxKitToken'
const CTX_USERDB = 'idbDuxKitUserDb'

export function defineServerKit<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbServerKitConfig<S>,
): IdbServerKitFactory<S> {
  let adminDb: IdbAdminClient<S> | undefined

  // Built once per process — only the per-user work is per-request.
  const getAdminDb = (event: H3Event): IdbAdminClient<S> =>
    (adminDb ??= adminInit<S>({
      appId: config.getAppId(event),
      adminToken: config.getAdminToken(event),
      schema: config.schema,
      ...(config.apiURI ? { apiURI: config.apiURI } : {}),
    }))

  // One token read + one verification promise per request, shared by every
  // kit call on the same event (concurrent calls await the same promise).
  async function resolveAuth(
    event: H3Event,
    db: IdbAdminClient<S>,
    appId: string,
  ): Promise<{ user: IdbAuthUser | undefined, token: string | undefined }> {
    const ctx = event.context as Record<string, unknown>
    if (!(CTX_USER in ctx)) {
      const token = getCookie(event, `instant_token_${appId}`) || undefined
      ctx[CTX_TOKEN] = token
      ctx[CTX_USER] = token
        ? db.auth.verifyToken(token).then(
            (u: IdbAuthUser) => u,
            () => undefined,
          )
        : Promise.resolve(undefined)
    }
    return {
      user: await (ctx[CTX_USER] as Promise<IdbAuthUser | undefined>),
      token: ctx[CTX_TOKEN] as string | undefined,
    }
  }

  async function useServerKit(
    event: H3Event,
    mode?: IdbServerKitMode,
  ): Promise<Record<string, unknown>> {
    const db = getAdminDb(event)
    if (!mode)
      return { adminDb: db }

    const { user, token } = await resolveAuth(event, db, config.getAppId(event))
    if ((mode === 'user' || mode === 'userDb') && !user)
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    if (mode === 'user' || mode === 'user?')
      return { adminDb: db, user }

    const ctx = event.context as Record<string, unknown>
    const userDb
      = user && token ? (ctx[CTX_USERDB] ??= db.asUser({ token })) : undefined
    return { adminDb: db, user, userDb }
  }

  return useServerKit as IdbServerKitFactory<S>
}
