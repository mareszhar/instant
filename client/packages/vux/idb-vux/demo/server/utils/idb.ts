import { init } from '@instantdb/admin'
import { defineServerIdb } from '@mszr/idb-vux/nuxt'
import schema from '~~/config/instant.schema'

export const useIdbn = defineServerIdb({
  init,
  schema,
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
  getAdminToken: event => useRuntimeConfig(event).instantAppAdminToken,
})
