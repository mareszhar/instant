import { init } from '@mszr/idb-vux'
import schema from '~~/config/instant.schema'

export const useIdb = defineStore('idb', () => {
  const db = init({
    appId: useRuntimeConfig().public.instantAppId,
    schema,
    firstPartyPath: '/api/idb',
  })

  const { state: auth } = db.useAuthX()

  return { db, auth }
})
