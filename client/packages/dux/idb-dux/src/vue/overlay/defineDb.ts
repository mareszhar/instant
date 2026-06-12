import type { IdbSchema } from '../../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../../schema/register.js'
import type { IdbClientConfig } from './types.js'
/**
 * Setup — `init` (eager) and `defineDb` (memoized lazy factory). `defineDb`
 * gives first-class support to the app-id-resolves-at-runtime pattern instead
 * of a hand-rolled lazy-init-and-memoize dance ([dux-spec-vue.md §2]).
 */
import { init as baselineInit } from '../baseline/index.js'
import { IdbClient } from './db.js'

/** Build the db eagerly — for apps whose config is available at module load. */
export function init<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbClientConfig<S>,
): IdbClient<S> {
  const baseline = baselineInit(config as any)
  return new IdbClient<S>(baseline as any, config.schema)
}

/** `defineDb` options: the schema, a lazy `getAppId`, and the rest of config. */
export type IdbDefineDbOptions<S extends IdbSchema> = Omit<IdbClientConfig<S>, 'appId'> & {
  /** Resolved on first use (framework runtime config, env indirection, …). */
  getAppId: () => string
}

/**
 * Returns a factory: the first call resolves config and creates the db;
 * subsequent calls return the same instance. No framework-wide singleton —
 * global state stays the app's responsibility.
 *
 * @example
 *   export const useDb = defineDb({
 *     schema,
 *     getAppId: () => useRuntimeConfig().public.instantAppId,
 *     firstPartyPath: '/api/idb',
 *   })
 */
export function defineDb<S extends IdbSchema = IdbRegisteredSchema>(
  options: IdbDefineDbOptions<S>,
): () => IdbClient<S> {
  let instance: IdbClient<S> | undefined
  const { getAppId, ...config } = options
  return () => {
    if (!instance)
      instance = init<S>({ ...config, appId: getAppId() } as IdbClientConfig<S>)
    return instance
  }
}
