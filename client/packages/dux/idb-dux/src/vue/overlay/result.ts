import type { Ref } from 'vue'
/**
 * The refs+state primitive — one shape, every stateful hook ([conventions §3],
 * [dux-spec-vue.md §3]). A result serves three reading styles over one
 * reactive source:
 *
 * - **top-level refs** for destructuring and watch sources,
 * - **`.refs`** for composable passthrough,
 * - **`.state`** for `.value`-free script reads.
 *
 * `state` is a `markRaw` plain object with getters over the underlying refs:
 * Pinia won't try to hydrate it, writing a property fails at the property
 * level, and Vue effects still track because each getter reads a reactive
 * source.
 */
import { markRaw } from 'vue'

/** The flat ref bag a hook produces (`{ isLoading, error, todos, … }`). */
export type RefsBag = Record<string, Ref<any>>

type Unref<R> = R extends Ref<infer V> ? V : never

// The type-level helpers don't constrain to `RefsBag`: a named ref-bag
// interface (e.g. `AuthRefs`) has no string index signature and so wouldn't
// satisfy `Record<string, Ref>`, even though every member is a `Ref`. They
// map over `keyof Refs` directly instead; `makeResult` keeps the runtime
// constraint where call sites pass object literals.

/** `.state` — getter projection over the refs, `.value`-free and read-only. */
export type StateOf<Refs> = {
  readonly [K in keyof Refs]: Unref<Refs[K]>
}

/** The full result: top-level refs (spread in), plus `.refs` and `.state`. */
export type IdbResult<Refs> = Refs & {
  refs: Refs
  state: StateOf<Refs>
}

/**
 * Wrap a hook's flat ref bag into the result pattern. The refs are spread to
 * the top level, exposed again under `.refs`, and projected read-only under a
 * raw `.state`.
 */
export function makeResult<Refs extends RefsBag>(refs: Refs): IdbResult<Refs> {
  const state = markRaw(
    Object.defineProperties(
      {},
      Object.fromEntries(
        Object.keys(refs).map(key => [
          key,
          { get: () => refs[key]!.value, enumerable: true },
        ]),
      ),
    ),
  ) as StateOf<Refs>

  return { ...refs, refs, state }
}

/**
 * The result pattern for hooks whose key set is *dynamic* (query scopes
 * depend on the query, which can change at runtime). `staticRefs` are always
 * present (`isLoading`, `error`, …); any other accessed key is resolved
 * through `scopeRef`, which the builder memoizes. Destructuring, `.refs`
 * passthrough, and the raw `.state` projection all work over arbitrary keys.
 */
export function makeDynamicResult<Static extends RefsBag>(
  staticRefs: Static,
  scopeRef: (key: string) => Ref<any>,
  extras: Record<string, unknown> = {},
): any {
  const cache = new Map<string, Ref<any>>()
  const refFor = (key: string): Ref<any> | undefined => {
    if (key in staticRefs)
      return staticRefs[key]
    if (typeof key !== 'string')
      return undefined
    let ref = cache.get(key)
    if (!ref) {
      ref = scopeRef(key)
      cache.set(key, ref)
    }
    return ref
  }

  const refs = new Proxy({} as RefsBag, {
    get: (_t, key: string) => refFor(key),
    has: () => true,
  })

  const state = markRaw(
    new Proxy(
      {},
      {
        get: (_t, key: string) => refFor(key)?.value,
        has: () => true,
        set: () => false, // writing a state property fails at the property level
      },
    ),
  )

  return new Proxy(
    {},
    {
      get: (_t, key: string) => {
        if (key === 'refs')
          return refs
        if (key === 'state')
          return state
        if (key in extras)
          return extras[key] // passthrough methods (e.g. loadNextPage)
        return refFor(key)
      },
      has: () => true,
    },
  )
}
