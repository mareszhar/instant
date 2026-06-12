// Vendored from @instantdb/vue/src/InstantVueDatabase.ts — see UPSTREAM.md.
// Deltas: class rename (InstantVueDatabase → InstantDuxDatabase), the SSR
// floor guards on every reactive hook, and the framework version tag.
import type {
  Auth,
  AuthState,
  ConnectionStatus,
  IInstantDatabase,
  InstantConfig,
  InstantCoreDatabase,
  InstantSchemaDef,
  InstaQLOptions,
  InstaQLResponse,
  PageInfoResponse,
  RoomSchemaShape,
  RoomsOf,
  Storage,
  Streams,
  TransactionChunk,
  User,
  ValidQuery,
} from '@instantdb/core'
import type { ComputedRef, MaybeRefOrGetter, Ref, ShallowRef } from 'vue'
import type { InfiniteQueryResult } from './useInfiniteQuery.js'
import {
  coerceQuery,
  init as core_init,
  InstantError,
  txInit,
  weakHash,
} from '@instantdb/core'
import { computed, ref, shallowRef, toValue, watch } from 'vue'
import { InstantDuxRoom, rooms } from './InstantDuxRoom.js'
import { useInfiniteQuery } from './useInfiniteQuery.js'
import { isClient, tryOnScopeDispose } from './utils.js'
import version from './version.js'

// ------
// Types

export interface UseQueryReturn<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends ValidQuery<Q, Schema>,
  UseDates extends boolean,
> {
  isLoading: Ref<boolean>
  data: ShallowRef<InstaQLResponse<Schema, Q, UseDates> | undefined>
  pageInfo: ShallowRef<PageInfoResponse<Q> | undefined>
  error: ShallowRef<{ message: string } | undefined>
}

export interface UseAuthReturn {
  isLoading: Ref<boolean>
  user: ShallowRef<User | null | undefined>
  error: ShallowRef<{ message: string } | undefined>
}

export class InstantDuxDatabase<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  Rooms extends RoomSchemaShape = RoomsOf<Schema>,
> implements IInstantDatabase<Schema> {
  public tx = txInit<Schema>()

  public auth: Auth
  public storage: Storage
  public streams: Streams
  public core: InstantCoreDatabase<Schema, UseDates>

  constructor(core: InstantCoreDatabase<Schema, UseDates>) {
    this.core = core
    this.auth = this.core.auth
    this.storage = this.core.storage
    this.streams = this.core.streams
  }

  getLocalId = (name: string): Promise<string> => {
    return this.core.getLocalId(name)
  }

  transact = (
    chunks: TransactionChunk<any, any> | TransactionChunk<any, any>[],
  ) => {
    return this.core.transact(chunks)
  }

  getAuth(): Promise<User | null> {
    return this.core.getAuth()
  }

  queryOnce = <Q extends ValidQuery<Q, Schema>>(
    query: Q,
    opts?: InstaQLOptions,
  ): Promise<{
    data: InstaQLResponse<Schema, Q, UseDates>
    pageInfo: PageInfoResponse<Q>
  }> => {
    return this.core.queryOnce(query, opts)
  }

  // -----------
  // Vue reactive hooks

  useQuery = <Q extends ValidQuery<Q, Schema>>(
    query: MaybeRefOrGetter<Q | null>,
    opts?: MaybeRefOrGetter<InstaQLOptions | null | undefined>,
  ): UseQueryReturn<Schema, Q, UseDates> => {
    const isLoading = ref(true)
    const data = shallowRef<InstaQLResponse<Schema, Q, UseDates> | undefined>(
      undefined,
    )
    const pageInfo = shallowRef<PageInfoResponse<Q> | undefined>(undefined)
    const error = shallowRef<{ message: string } | undefined>(undefined)

    const resolvedQuery = computed(() => {
      const q = toValue(query)
      if (!q)
        return null
      const o = toValue(opts)
      const withParams
        = o && 'ruleParams' in o
          ? ({ $$ruleParams: (o as any).ruleParams, ...q } as Q)
          : q
      return coerceQuery(withParams)
    })

    const queryHash = computed(() => weakHash(resolvedQuery.value))

    const stop = watch(
      queryHash,
      (_, __, onCleanup) => {
        const q = resolvedQuery.value

        // DUX-DELTA(ssr): inert state on the server — never read the cache or
        // open a subscription. The client path below is the official one.
        if (!isClient()) {
          isLoading.value = !!q
          return
        }
        // END DUX-DELTA

        const cached: any = q ? this.core._reactor.getPreviousResult(q) : null
        isLoading.value = !cached
        data.value = cached?.data
        pageInfo.value = cached?.pageInfo
        error.value = cached?.error

        if (!q)
          return

        const unsub = this.core.subscribeQuery<Q, UseDates>(q, (r: any) => {
          isLoading.value = false
          data.value = r.data
          pageInfo.value = r.pageInfo
          error.value = r.error
        })
        onCleanup(unsub)
      },
      { immediate: true },
    )

    tryOnScopeDispose(stop)

    return { isLoading, data, pageInfo, error } as UseQueryReturn<
      Schema,
      Q,
      UseDates
    >
  }

  useInfiniteQuery = <Q extends ValidQuery<Q, Schema>>(
    query: MaybeRefOrGetter<Q | null>,
    opts?: MaybeRefOrGetter<InstaQLOptions | undefined>,
  ): InfiniteQueryResult<Schema, Q, UseDates> => {
    return useInfiniteQuery<Schema, Q, UseDates>(this.core, query, opts)
  }

  useAuth = (): UseAuthReturn => {
    const cached = this.core._reactor._currentUserCached as
      | AuthState
      | undefined

    const isLoading = ref(cached?.isLoading ?? true)
    const user = shallowRef<User | null | undefined>(cached?.user)
    const error = shallowRef<{ message: string } | undefined>(cached?.error)

    // DUX-DELTA(ssr): no auth subscription on the server — inert loading state.
    if (!isClient())
      return { isLoading, user, error }
    // END DUX-DELTA

    const unsub = this.core.subscribeAuth((auth: any) => {
      isLoading.value = false
      user.value = auth.user ?? null
      error.value = auth.error
    })

    tryOnScopeDispose(unsub)

    return { isLoading, user, error }
  }

  useUser = (): ComputedRef<User> => {
    const { user } = this.useAuth()
    return computed(() => {
      if (!user.value) {
        throw new InstantError(
          'useUser must be used within an auth-protected route',
        )
      }
      return user.value
    })
  }

  useConnectionStatus = (): Ref<ConnectionStatus> => {
    const status = ref<ConnectionStatus>(
      this.core._reactor.status as ConnectionStatus,
    )

    // DUX-DELTA(ssr): no connection subscription on the server.
    if (!isClient())
      return status
    // END DUX-DELTA

    const unsub = this.core.subscribeConnectionStatus((newStatus) => {
      status.value = newStatus
    })

    tryOnScopeDispose(unsub)

    return status
  }

  useLocalId = (name: MaybeRefOrGetter<string>): Ref<string | null> => {
    const localId = ref<string | null>(null)

    // DUX-DELTA(ssr): localId is a client-storage concern — inert on server.
    if (!isClient())
      return localId
    // END DUX-DELTA

    const stop = watch(
      () => toValue(name),
      (currentName) => {
        this.getLocalId(currentName).then((id) => {
          // Drop a late resolve if `name` has since changed.
          if (toValue(name) === currentName) {
            localId.value = id
          }
        })
      },
      { immediate: true },
    )

    tryOnScopeDispose(stop)
    return localId
  }

  room<RoomType extends string & keyof Rooms>(
    type?: MaybeRefOrGetter<RoomType | undefined>,
    id?: MaybeRefOrGetter<string | undefined>,
  ) {
    const _type = computed(
      () => (toValue(type) ?? '_defaultRoomType') as RoomType,
    )
    const _id = computed(() => toValue(id) ?? '_defaultRoomId')
    return new InstantDuxRoom<Schema, Rooms, RoomType>(this.core, _type, _id)
  }

  rooms = rooms
}

// -----------
// init

export function init<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
>(
  config: Omit<InstantConfig<Schema, UseDates>, 'useDateObjects'> & {
    useDateObjects?: UseDates
  },
): InstantDuxDatabase<Schema, UseDates> {
  const coreDb = core_init<Schema, UseDates>(config, undefined, undefined, {
    '@mszr/idb-dux': version,
  })
  return new InstantDuxDatabase<Schema, UseDates>(coreDb)
}
