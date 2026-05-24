import type { H3Event } from 'h3'
import { init } from '@instantdb/admin'
import schema from '~~/config/instant.schema'

export interface SyncUserPayload {
  type: 'sync-user'
  appId: string
  user: AuthUser | null
}

export type AdminDb = ReturnType<typeof initAdminDb>

function initAdminDb(appId: string, adminToken: string) {
  return init({ appId, adminToken, schema })
}

const adminDbCache = new Map<string, AdminDb>()

function getAdminDb(event: H3Event) {
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
  const cachedAdminDb = adminDbCache.get(cacheKey)

  if (cachedAdminDb)
    return cachedAdminDb

  const adminDb = initAdminDb(appId, adminToken)
  adminDbCache.set(cacheKey, adminDb)
  return adminDb
}

export function getAuthCookieName(event: H3Event) {
  return `instant_token_${useRuntimeConfig(event).public.instantAppId}`
}

interface UseIdbAtAdminDbDepth {
  adminDb: AdminDb
}

type UseIdbAtUserDbDepth = UseIdbAtAdminDbDepth & {
  token: string
  userDb: AdminDb
}

type UseIdbAtUserDepth = UseIdbAtUserDbDepth & {
  user: AuthUser
}

export function useIdb(event: H3Event): UseIdbAtAdminDbDepth
export function useIdb(event: H3Event, depth: 'userDb'): UseIdbAtUserDbDepth
export function useIdb(event: H3Event, depth: 'user'): Promise<UseIdbAtUserDepth>
export function useIdb(
  event: H3Event,
  depth?: 'admin' | 'userDb' | 'user',
): UseIdbAtAdminDbDepth | UseIdbAtUserDbDepth | Promise<UseIdbAtUserDepth> {
  const adminDb = getAdminDb(event)

  if (!depth || depth === 'admin')
    return { adminDb }

  const token = getCookie(event, getAuthCookieName(event))

  if (!token)
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const userDb = adminDb.asUser({ token })

  if (depth === 'userDb')
    return { adminDb, token, userDb }

  return adminDb.auth.verifyToken(token).then(user => ({
    adminDb,
    token,
    userDb,
    user,
  }))
}
