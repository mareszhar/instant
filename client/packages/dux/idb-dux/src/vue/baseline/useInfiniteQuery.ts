import type { InfiniteQuerySubscription, InstantCoreDatabase, InstantSchemaDef, InstaQLOptions, InstaQLResponse, ValidQuery } from '@instantdb/core'
import type { MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
// Vendored from @instantdb/vue/src/useInfiniteQuery.ts — see UPSTREAM.md.
// Delta: the SSR floor guard around the subscription.
import {
  getInfiniteQueryInitialSnapshot,

  weakHash,
} from '@instantdb/core'
import { ref, shallowRef, toValue, watch } from 'vue'

import { isClient, tryOnScopeDispose } from './utils.js'

export interface InfiniteQueryResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends ValidQuery<Q, Schema>,
  UseDates extends boolean,
> {
  isLoading: Ref<boolean>
  data: ShallowRef<InstaQLResponse<Schema, Q, UseDates> | undefined>
  error: ShallowRef<{ message: string } | undefined>
  canLoadNextPage: Ref<boolean>
  loadNextPage: () => void
}

/**
 * Subscribe to a query and incrementally load more items.
 *
 * Only one top-level namespace in the query is allowed. Changing the query or
 * options while the subscription is active resets and starts over.
 */
export function useInfiniteQuery<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends ValidQuery<Q, Schema>,
  UseDates extends boolean,
>(
  core: InstantCoreDatabase<Schema, UseDates>,
  query: MaybeRefOrGetter<Q | null>,
  opts?: MaybeRefOrGetter<InstaQLOptions | undefined>,
): InfiniteQueryResult<Schema, Q, UseDates> {
  const initialQuery = toValue(query)
  // DUX-DELTA(ssr): no initial snapshot read on the server.
  const snapshot = initialQuery && isClient()
    ? getInfiniteQueryInitialSnapshot(core, initialQuery, toValue(opts))
    : { data: undefined, error: undefined, canLoadNextPage: false }
  // END DUX-DELTA

  const isLoading = ref(!snapshot.data && !snapshot.error)
  const data = shallowRef<InstaQLResponse<Schema, Q, UseDates> | undefined>(
    snapshot.data as any,
  )
  const error = shallowRef<{ message: string } | undefined>(snapshot.error)
  const canLoadNextPage = ref(snapshot.canLoadNextPage)

  let subRef: InfiniteQuerySubscription | null = null

  const stop = watch(
    [() => weakHash(toValue(query)), () => weakHash(toValue(opts))],
    (_, __, onCleanup) => {
      subRef = null
      error.value = undefined
      data.value = undefined
      isLoading.value = true
      canLoadNextPage.value = false

      const q = toValue(query)
      if (!q)
        return

      // DUX-DELTA(ssr): no subscription on the server.
      if (!isClient())
        return
      // END DUX-DELTA

      const sub = core.subscribeInfiniteQuery(
        q,
        (resp: any) => {
          error.value = resp.error
          data.value = resp.data
          isLoading.value = false
          canLoadNextPage.value = resp.canLoadNextPage
        },
        toValue(opts),
      )

      subRef = sub

      onCleanup(() => {
        sub.unsubscribe()
        if (subRef === sub)
          subRef = null
      })
    },
    { immediate: true },
  )

  const loadNextPage = () => {
    subRef?.loadNextPage()
  }

  tryOnScopeDispose(stop)

  return {
    isLoading,
    data,
    error,
    canLoadNextPage,
    loadNextPage,
  } as InfiniteQueryResult<Schema, Q, UseDates>
}
