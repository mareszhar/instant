import type { EventHandlerRequest, H3Event } from 'h3'
import type { AppSchema } from '~~/config/instant.schema'
import { init as initAdmin } from '@instantdb/admin'
import { createError, getRequestHeaders, getRequestURL } from 'h3'
import schema from '~~/config/instant.schema'

export interface SyncedInstantUser {
  id: string
  email?: string
  isGuest: boolean
}

function createAdminDb(appId: string, adminToken: string) {
  return initAdmin<AppSchema>({
    appId,
    adminToken,
    schema,
  })
}

type AdminDb = ReturnType<typeof createAdminDb>

const adminDbCache = new Map<string, AdminDb>()

export function getAdminDb(event: H3Event<EventHandlerRequest>) {
  const runtimeConfig = useRuntimeConfig(event)
  const appId = runtimeConfig.public.instantAppId
  const adminToken = runtimeConfig.instantAppAdminToken

  if (!appId) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing public runtime config: instantAppId',
    })
  }

  if (!adminToken) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing private runtime config: instantAppAdminToken',
    })
  }

  const cacheKey = `${appId}:${adminToken}`
  const cached = adminDbCache.get(cacheKey)
  if (cached)
    return cached

  const adminDb = createAdminDb(appId, adminToken)
  adminDbCache.set(cacheKey, adminDb)
  return adminDb
}

export function getSyncedInstantUser(
  event: H3Event<EventHandlerRequest>,
): Promise<SyncedInstantUser | null> {
  const runtimeConfig = useRuntimeConfig(event)
  const appId = runtimeConfig.public.instantAppId
  if (!appId)
    return Promise.resolve(null)

  const headers = new Headers()
  for (const [key, value] of Object.entries(getRequestHeaders(event))) {
    if (typeof value === 'string')
      headers.set(key, value)
  }

  const request = new Request(getRequestURL(event), {
    method: 'GET',
    headers,
  })

  return getAdminDb(event).auth.getUserFromRequest(request, {
    disableValidation: true,
  }).then((user) => {
    if (!user?.id)
      return null

    return {
      id: user.id,
      email: user.email ?? undefined,
      isGuest: Boolean(user.isGuest || user.type === 'guest' || !user.email),
    } satisfies SyncedInstantUser
  }).catch(() => null)
}
