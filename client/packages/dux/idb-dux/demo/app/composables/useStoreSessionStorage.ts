import type { RemovableRef, UseStorageOptions } from '@vueuse/core'
import { skipHydrate } from 'pinia'

export function useStoreSessionStorage<T>(
  key: string,
  initialValue: T,
  options?: UseStorageOptions<T>,
): RemovableRef<T> {
  return skipHydrate(useSessionStorage(key, initialValue, options))
}
