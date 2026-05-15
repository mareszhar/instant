import { defineDb } from '@mszr/idb-vux'
import schema from '~~/config/instant.schema'

export const useDb = defineDb({
  schema,
  firstPartyPath: '/api/instant',
  getAppId: () => useRuntimeConfig().public.instantAppId,
})
