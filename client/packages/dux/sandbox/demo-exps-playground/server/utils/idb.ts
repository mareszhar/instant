import { defineServerKit } from '@mszr/idb-dux/nuxt'
import schema from '~~/config/instant.schema'

export const useServerIdb = defineServerKit({
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
