import type { InstantVuxDatabase } from '@mszr/idb-vux'
import type { AppSchema } from '../../instant.schema'
import { init } from '@mszr/idb-vux'
import schema from '../../instant.schema'

let db: InstantVuxDatabase<AppSchema> | null = null

export function useDb(): InstantVuxDatabase<AppSchema> | null {
  const appId = useRuntimeConfig().public.instantAppId ?? ''

  if (!appId) {
    return null
  }

  if (!db) {
    db = init<AppSchema>({
      appId,
      schema,
      firstPartyPath: '/api/instant',
    })
  }

  return db
}
