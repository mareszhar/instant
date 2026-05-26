import { defineInstantAuthSyncHandler } from '@mszr/idb-vux/nuxt'

export default defineInstantAuthSyncHandler({
  getAppId: event => useRuntimeConfig(event).public.instantAppId,
})
