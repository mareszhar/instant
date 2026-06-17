import { defineAuthSyncHandler } from '@mszr/idb-dux/nuxt'

export default defineAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
