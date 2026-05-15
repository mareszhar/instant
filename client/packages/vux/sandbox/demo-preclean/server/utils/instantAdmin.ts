import type { EventHandlerRequest, H3Event } from 'h3'
import type { AppSchema } from '../../instant.schema'
import { init as initAdmin } from '@instantdb/admin'
import { createError, getCookie } from 'h3'
import schema from '../../instant.schema'

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
  if (cached) {
    return cached
  }

  const adminDb = createAdminDb(appId, adminToken)

  adminDbCache.set(cacheKey, adminDb)
  return adminDb
}

export function getSyncedInstantUser(
  event: H3Event<EventHandlerRequest>,
): SyncedInstantUser | null {
  const runtimeConfig = useRuntimeConfig(event)
  const appId = runtimeConfig.public.instantAppId

  if (!appId) {
    return null
  }

  const cookieName = `instant_user_${appId}`
  const rawCookie = getCookie(event, cookieName)
  if (!rawCookie) {
    return null
  }

  const parsed = parseInstantCookie(rawCookie)
  if (!isSyncedInstantUser(parsed)) {
    return null
  }

  return parsed
}

function parseInstantCookie(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  }
  catch {
    try {
      return JSON.parse(decodeURIComponent(value)) as unknown
    }
    catch {
      return null
    }
  }
}

function isSyncedInstantUser(value: unknown): value is SyncedInstantUser {
  if (!value || typeof value !== 'object') {
    return false
  }

  const maybeUser = value as Record<string, unknown>
  if (typeof maybeUser.id !== 'string' || maybeUser.id.length === 0) {
    return false
  }

  if (
    typeof maybeUser.email !== 'undefined'
    && typeof maybeUser.email !== 'string'
  ) {
    return false
  }

  return typeof maybeUser.isGuest === 'boolean'
}
