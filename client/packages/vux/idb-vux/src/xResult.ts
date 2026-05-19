import type { ComputedRef, Ref, ShallowRef } from 'vue'
import { isRef, markRaw } from 'vue'

export type XRefLike<T = unknown>
  = | Ref<T>
    | ShallowRef<T>
    | ComputedRef<T>

export type StateFromRefs<Refs extends object> = {
  readonly [K in keyof Refs]: Refs[K] extends XRefLike<infer V> ? V : Refs[K]
}

export type XResult<
  Refs extends object,
  State extends object = StateFromRefs<Refs>,
> = Refs & {
  refs: Refs
  state: Readonly<State>
}

export function createStateFromRefs<Refs extends object>(
  refs: Refs,
): StateFromRefs<Refs> {
  const refsObject = refs as Record<string, unknown>
  const stateBaseTarget = {} as Record<string, unknown>

  for (const key of Object.keys(refsObject)) {
    Object.defineProperty(stateBaseTarget, key, {
      enumerable: true,
      configurable: true,
      get() {
        const value = refsObject[key]
        return isRef(value) ? value.value : value
      },
    })
  }

  return markRaw(stateBaseTarget) as StateFromRefs<Refs>
}

export function createXResult<Refs extends object>(
  refs: Refs,
): XResult<Refs>
export function createXResult<
  Refs extends object,
  State extends object,
>(
  refs: Refs,
  state: State,
): XResult<Refs, State>
export function createXResult<
  Refs extends object,
  State extends object,
>(
  refs: Refs,
  state?: State,
): XResult<Refs> | XResult<Refs, State> {
  if (state !== undefined) {
    const result = markRaw(refs) as XResult<Refs, State>
    result.refs = refs
    result.state = markRaw(state)
    return result
  }

  const result = markRaw(refs) as XResult<Refs>
  result.refs = refs
  result.state = createStateFromRefs(refs)
  return result
}
