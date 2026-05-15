import type {
  InstantSchemaDef,
  RoomsOf,
} from '@instantdb/core'
import type { InstantVuxDatabase, InstantVuxInitConfig, UseUserRequirement } from './InstantVuxDatabase.js'
import { init } from './InstantVuxDatabase.js'

type MissingAppIdBehavior = 'throw' | null

export type DefineDbOptions<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  Missing extends MissingAppIdBehavior = 'throw',
  UseUserDefault extends UseUserRequirement = 'clientOnly',
> = Omit<InstantVuxInitConfig<Schema, UseDates, UseUserDefault>, 'appId' | 'schema'> & {
  schema: Schema
  getAppId: () => null | string | undefined
  missingAppId?: Missing
}

export function defineDb<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
>(
  config: DefineDbOptions<Schema, UseDates, null, UseUserDefault> & {
    missingAppId: null
  },
): () => InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault> | null
export function defineDb<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
>(
  config: DefineDbOptions<Schema, UseDates, 'throw', UseUserDefault> & {
    missingAppId?: 'throw'
  },
): () => InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault>
export function defineDb<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
>(
  config: DefineDbOptions<Schema, UseDates, MissingAppIdBehavior, UseUserDefault>,
): () => InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault> | null {
  const {
    getAppId,
    missingAppId = 'throw',
    ...staticConfig
  } = config

  let cachedDb: InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault> | null = null
  let cachedAppId: string | null = null

  return () => {
    const resolvedAppId = getAppId()?.trim() ?? ''

    if (!resolvedAppId) {
      if (missingAppId === null) {
        return null
      }

      throw new Error('Instant App ID is not configured.')
    }

    if (!cachedDb || cachedAppId !== resolvedAppId) {
      cachedDb = init<Schema, UseDates, UseUserDefault>({
        ...(staticConfig as Omit<InstantVuxInitConfig<Schema, UseDates, UseUserDefault>, 'appId'>),
        appId: resolvedAppId,
      })
      cachedAppId = resolvedAppId
    }

    return cachedDb
  }
}
