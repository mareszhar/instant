import type { InstantServerDb } from '@mszr/idb-vux/nuxt'
import { init } from '@instantdb/admin'
import { defineServerIdb } from '@mszr/idb-vux/nuxt'
import schema from '~~/config/instant.schema'

export const useIdb = defineServerIdb({
  init,
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})

export type ServerDb = InstantServerDb<AppSchema, 'all'>
export type BaseDb = InstantServerDb<AppSchema, 'baseDb'>
export type GuestDb = InstantServerDb<AppSchema, 'guestDb'>
export type UserDb = InstantServerDb<AppSchema, 'userDb'>
export type AdminDb = InstantServerDb<AppSchema, 'adminDb'>
