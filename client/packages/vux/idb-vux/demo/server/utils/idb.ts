import type { InstantServerDb } from '@mszr/idb-vux/nuxt'
import type { H3Event } from 'h3'
import { init } from '@instantdb/admin'
import { defineServerIdb } from '@mszr/idb-vux/nuxt'
import schema from '~~/config/instant.schema'

export const getAppId = (event: H3Event) => useRuntimeConfig(event).public.instantAppId
const getAdminToken = (event: H3Event) => useRuntimeConfig(event).instantAppAdminToken

export const useIdbn = defineServerIdb({ init, schema, getAppId, getAdminToken })

export type ServerDb = InstantServerDb<AppSchema, 'all'>
export type BaseDb = InstantServerDb<AppSchema, 'baseDb'>
export type GuestDb = InstantServerDb<AppSchema, 'guestDb'>
export type UserDb = InstantServerDb<AppSchema, 'userDb'>
export type AdminDb = InstantServerDb<AppSchema, 'adminDb'>
