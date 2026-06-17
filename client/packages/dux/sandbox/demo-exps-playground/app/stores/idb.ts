import { init } from '@mszr/idb-dux/vue'
import schema from '~~/config/instant.schema'

export const useIdb = defineStore('idb', () => {
  const db = init({
    appId: useRuntimeConfig().public.instantAppId,
    schema,
    firstPartyPath: '/api/idb',
  })

  const { state: auth } = db.useAuth()

  return { db, auth }
})
