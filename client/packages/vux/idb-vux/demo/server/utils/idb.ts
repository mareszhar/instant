import type { H3Event } from 'h3'
import { init } from '@instantdb/admin'
import schema from '~~/config/instant.schema'

export interface SyncUserPayload {
  type: 'sync-user'
  appId: string
  user: AuthUser | null
}

export function useAdminDb(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)

  return init({
    appId: runtimeConfig.public.instantAppId,
    adminToken: runtimeConfig.instantAppAdminToken,
    schema,
  })
}

export type AdminDb = ReturnType<typeof useAdminDb>

export function getAuthCookieName(event: H3Event) {
  return `instant_user_${useRuntimeConfig(event).public.instantAppId}`
}
