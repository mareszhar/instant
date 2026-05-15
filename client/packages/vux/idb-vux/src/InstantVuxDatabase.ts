import type {
  Auth,
  AuthState,
  ConnectionStatus,
  IInstantDatabase,
  InfiniteQueryCallbackResponse,
  InfiniteQuerySubscription,
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
import type { ComputedRef, Ref } from 'vue'
import type {
  DefinedQuery,
  QueryAuthoringFactoryForSchema,
  QueryAuthoringInputForSchema,
  QueryAuthoringSourceForSchema,
  TypedQueryForSchema,
} from './defineQuery.js'
import {

  coerceQuery,
  init as coreInit,

  getInfiniteQueryInitialSnapshot,

  InstantError,

  txInit,

} from '@instantdb/core'
import {
  computed,

  getCurrentScope,
  isRef,
  onScopeDispose,
  reactive,
  readonly,
  ref,

  watchEffect,
} from 'vue'

import { InstantVuxRoom, rooms } from './InstantVuxRoom.js'
import version from './version.js'

const defaultState = {
  isLoading: true,
  data: undefined,
  pageInfo: undefined,
  error: undefined,
} as const

const defaultAuthState: AuthState = {
  isLoading: true,
  user: undefined,
  error: undefined,
}

const defaultInfiniteQueryState = {
  isLoading: true,
  data: undefined,
  error: undefined,
  canLoadNextPage: false,
} as const

function isServerRuntime() {
  return typeof window === 'undefined'
}

function getReactor(core: unknown): Record<string, any> | null {
  if (!core || typeof core !== 'object') {
    return null
  }

  return (core as any)._reactor ?? null
}

function isReactorReadyForSubscriptions(core: unknown) {
  const reactor = getReactor(core)
  return Boolean(
    reactor
    && reactor.querySubs
    && typeof reactor.querySubs.updateInPlace === 'function'
    && reactor.kv
    && typeof reactor.kv.updateInPlace === 'function',
  )
}

function attachScopeCleanup(cleanup: () => void) {
  if (getCurrentScope()) {
    onScopeDispose(cleanup)
  }
}

function stateForResult(result: unknown) {
  return {
    isLoading: !result,
    data: undefined,
    pageInfo: undefined,
    error: undefined,
    ...(result && typeof result === 'object' ? result : {}),
  }
}

export type UseQueryOptions = Partial<InstaQLOptions> & {
  /**
   * Keep the current data visible while a changed query waits for its first
   * result and no cached result exists for that exact query yet.
   */
  keepPreviousData?: boolean
}

export interface UseQueryResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
> {
  isLoading: ComputedRef<boolean>
  data: ComputedRef<InstaQLResponse<Schema, Q, UseDates> | undefined>
  pageInfo: ComputedRef<PageInfoResponse<Q> | undefined>
  error: ComputedRef<{ message: string } | undefined>
}

export interface UseInfiniteQueryResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
> {
  error: ComputedRef<{ message: string } | undefined>
  data: ComputedRef<InstaQLResponse<Schema, Q, UseDates> | undefined>
  isLoading: ComputedRef<boolean>
  canLoadNextPage: ComputedRef<boolean>
  loadNextPage: () => void
}

export interface UseAuthResult {
  isLoading: ComputedRef<AuthState['isLoading']>
  user: ComputedRef<AuthState['user']>
  error: ComputedRef<AuthState['error']>
}

export type UseUserRequirement = 'clientOnly' | 'yes' | 'no'

export type UseUserValue<
  Requirement extends UseUserRequirement,
> = Requirement extends 'yes' ? User : User | undefined

export interface UseUserOptions<
  Requirement extends UseUserRequirement = UseUserRequirement,
> {
  requireUser?: Requirement
}

export type InstantVuxInitConfig<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
> = Omit<InstantConfig<Schema, UseDates>, 'useDateObjects'> & {
  useDateObjects?: UseDates
  requireUserInUseUser?: UseUserDefault
}

export type UseAuthXRefs = UseAuthResult

export interface UseAuthXState {
  isLoading: AuthState['isLoading']
  user: AuthState['user']
  error: AuthState['error']
}

export type UseAuthXResult = UseAuthXRefs & {
  refs: UseAuthXRefs
  state: UseAuthXState
}

type QueryRootNamespaceKey<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
> = Extract<Extract<keyof Q, keyof Schema['entities']>, string>

type QueryNamespaceItems<
  Schema extends InstantSchemaDef<any, any, any>,
  RuntimeQ extends Record<string, any>,
  UseDates extends boolean,
  K extends string,
> = K extends keyof NonNullable<InstaQLResponse<Schema, RuntimeQ, UseDates>>
  ? NonNullable<NonNullable<InstaQLResponse<Schema, RuntimeQ, UseDates>>[K]> extends infer Items
    ? Items extends unknown[]
      ? Items
      : never[]
    : never[]
  : never[]

interface UseQueryState<
  Schema extends InstantSchemaDef<any, any, any>,
  RuntimeQ extends Record<string, any>,
  UseDates extends boolean,
> {
  isLoading: boolean
  data: InstaQLResponse<Schema, RuntimeQ, UseDates> | undefined
  pageInfo: PageInfoResponse<RuntimeQ> | undefined
  error: { message: string } | undefined
}

interface UseInfiniteQueryState<
  Schema extends InstantSchemaDef<any, any, any>,
  RuntimeQ extends Record<string, any>,
  UseDates extends boolean,
> {
  error: { message: string } | undefined
  data: InstaQLResponse<Schema, RuntimeQ, UseDates> | undefined
  isLoading: boolean
  canLoadNextPage: boolean
  loadNextPage: () => void
}

type UseQueryXAuthoringInput<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<Schema>,
> = QueryAuthoringInputForSchema<Schema, Q>

type UseQueryXAuthoringFactory<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<Schema>,
> = QueryAuthoringFactoryForSchema<Schema, Q>

type UseQueryXAuthoringSource<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<Schema>,
> = QueryAuthoringSourceForSchema<Schema, Q>

type UseQueryXRuntimeQuery<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<Schema>,
> = DefinedQuery<Q>

export type UseQueryXRefs<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = {
  isLoading: ComputedRef<UseQueryState<Schema, RuntimeQ, UseDates>['isLoading']>
  data: ComputedRef<UseQueryState<Schema, RuntimeQ, UseDates>['data']>
  pageInfo: ComputedRef<UseQueryState<Schema, RuntimeQ, UseDates>['pageInfo']>
  error: ComputedRef<UseQueryState<Schema, RuntimeQ, UseDates>['error']>
} & {
  [K in QueryRootNamespaceKey<Schema, Q>]: ComputedRef<QueryNamespaceItems<Schema, RuntimeQ, UseDates, K>>
}

export type UseQueryXState<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = {
  isLoading: UseQueryState<Schema, RuntimeQ, UseDates>['isLoading']
  data: UseQueryState<Schema, RuntimeQ, UseDates>['data']
  pageInfo: UseQueryState<Schema, RuntimeQ, UseDates>['pageInfo']
  error: UseQueryState<Schema, RuntimeQ, UseDates>['error']
} & {
  [K in QueryRootNamespaceKey<Schema, Q>]: QueryNamespaceItems<Schema, RuntimeQ, UseDates, K>
}

export type UseQueryXResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = UseQueryXRefs<Schema, Q, UseDates, RuntimeQ> & {
  refs: UseQueryXRefs<Schema, Q, UseDates, RuntimeQ>
  state: UseQueryXState<Schema, Q, UseDates, RuntimeQ>
}

export type UseInfiniteQueryXRefs<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = {
  isLoading: ComputedRef<UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['isLoading']>
  data: ComputedRef<UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['data']>
  error: ComputedRef<UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['error']>
  canLoadNextPage: ComputedRef<UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['canLoadNextPage']>
  loadNextPage: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['loadNextPage']
} & {
  [K in QueryRootNamespaceKey<Schema, Q>]: ComputedRef<QueryNamespaceItems<Schema, RuntimeQ, UseDates, K>>
}

export type UseInfiniteQueryXState<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = {
  isLoading: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['isLoading']
  data: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['data']
  error: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['error']
  canLoadNextPage: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['canLoadNextPage']
  loadNextPage: UseInfiniteQueryState<Schema, RuntimeQ, UseDates>['loadNextPage']
} & {
  [K in QueryRootNamespaceKey<Schema, Q>]: QueryNamespaceItems<Schema, RuntimeQ, UseDates, K>
}

export type UseInfiniteQueryXResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = UseInfiniteQueryXRefs<Schema, Q, UseDates, RuntimeQ> & {
  refs: UseInfiniteQueryXRefs<Schema, Q, UseDates, RuntimeQ>
  state: UseInfiniteQueryXState<Schema, Q, UseDates, RuntimeQ>
}

export type QueryOnceXResult<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
  RuntimeQ extends Record<string, any> = Q,
> = {
  data: InstaQLResponse<Schema, RuntimeQ, UseDates>
  pageInfo: PageInfoResponse<RuntimeQ>
} & {
  [K in QueryRootNamespaceKey<Schema, Q>]: QueryNamespaceItems<Schema, RuntimeQ, UseDates, K>
}

function createUseQueryResultRefs<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
>(
  state: UseQueryState<Schema, Q, UseDates>,
): UseQueryResult<Schema, Q, UseDates> {
  return {
    isLoading: computed(() => state.isLoading),
    data: computed(() => state.data),
    pageInfo: computed(() => state.pageInfo),
    error: computed(() => state.error),
  }
}

function createUseInfiniteQueryResultRefs<
  Schema extends InstantSchemaDef<any, any, any>,
  Q extends Record<string, any>,
  UseDates extends boolean,
>(
  state: UseInfiniteQueryState<Schema, Q, UseDates>,
): UseInfiniteQueryResult<Schema, Q, UseDates> {
  return {
    isLoading: computed(() => state.isLoading),
    data: computed(() => state.data),
    error: computed(() => state.error),
    canLoadNextPage: computed(() => state.canLoadNextPage),
    loadNextPage: state.loadNextPage,
  }
}

function createUseAuthResultRefs(
  state: AuthState,
): UseAuthResult {
  return {
    isLoading: computed(() => state.isLoading),
    user: computed(() => state.user),
    error: computed(() => state.error),
  }
}

function createUseAuthStateProjection(
  refs: UseAuthResult,
): UseAuthXState {
  const stateBaseTarget = {
    get isLoading() {
      return refs.isLoading.value
    },
    get user() {
      return refs.user.value
    },
    get error() {
      return refs.error.value
    },
  }

  return reactive(stateBaseTarget) as UseAuthXState
}

function namespaceKeyTrackerFromQuerySource<
  Q extends Record<string, any>,
>(
  query: (() => null | Q) | null | Q,
  isReservedKey: (key: string) => boolean,
) {
  const namespaceKeys = new Set<string>()

  const trackNamespaceKeys = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') {
      return
    }

    for (const key of Object.keys(candidate as Record<string, unknown>)) {
      if (isReservedKey(key) || key.startsWith('$$')) {
        continue
      }
      namespaceKeys.add(key)
    }
  }

  const trackedQuery
    = typeof query === 'function'
      ? () => {
          const resolvedQuery = (query as () => null | Q)()
          trackNamespaceKeys(resolvedQuery)
          return resolvedQuery
        }
      : query

  if (typeof query !== 'function') {
    trackNamespaceKeys(query)
  }

  return {
    namespaceKeys,
    trackedQuery,
  }
}

function createNamespaceXProjection<
  BaseRefs extends Record<string, unknown>,
>(
  baseRefsInput: BaseRefs,
  namespaceKeys: Set<string>,
) {
  const baseRefs = { ...baseRefsInput } as Record<string, unknown>

  const reservedKeys = new Set<string>([
    ...Object.keys(baseRefsInput),
    'refs',
    'state',
  ])

  const isReservedKey = (key: string) => reservedKeys.has(key)

  const namespaceRefCache = new Map<string, ComputedRef<unknown[]>>()

  const namespaceRefFor = (key: string): ComputedRef<unknown[]> => {
    let namespaceRef = namespaceRefCache.get(key)
    if (namespaceRef) {
      return namespaceRef
    }

    namespaceRef = computed<unknown[]>(() => {
      const dataRef = baseRefs.data
      const data
        = isRef(dataRef)
          ? (dataRef.value as Record<string, unknown> | undefined)
          : undefined
      const rows = data?.[key]
      return Array.isArray(rows) ? rows : []
    })

    namespaceRefCache.set(key, namespaceRef)
    return namespaceRef
  }

  const materializeKnownNamespaceRefs = () => {
    for (const key of namespaceKeys) {
      if (!(key in baseRefs)) {
        baseRefs[key] = namespaceRefFor(key)
      }
    }
  }

  const refsProxy = new Proxy(baseRefs, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !isReservedKey(prop) && !(prop in target)) {
        namespaceKeys.add(prop)
        target[prop] = namespaceRefFor(prop)
      }
      return Reflect.get(target, prop, receiver)
    },
    ownKeys(target) {
      materializeKnownNamespaceRefs()
      return Reflect.ownKeys(target)
    },
    getOwnPropertyDescriptor(target, prop) {
      if (typeof prop === 'string' && namespaceKeys.has(prop) && !(prop in target)) {
        target[prop] = namespaceRefFor(prop)
      }
      return Reflect.getOwnPropertyDescriptor(target, prop)
    },
  })

  const stateBaseTarget = {} as Record<string, unknown>
  for (const key of Object.keys(baseRefsInput)) {
    Object.defineProperty(stateBaseTarget, key, {
      enumerable: true,
      configurable: true,
      get() {
        const value = baseRefs[key]
        return isRef(value) ? value.value : value
      },
    })
  }

  const stateBase = reactive(stateBaseTarget) as Record<string, unknown>
  const stateProxy = new Proxy(stateBase, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !isReservedKey(prop) && !(prop in target)) {
        return namespaceRefFor(prop).value
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  return {
    refsProxy,
    stateProxy,
  }
}

export class InstantVuxDatabase<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  Rooms extends RoomSchemaShape = RoomsOf<Schema>,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
> implements IInstantDatabase<Schema> {
  public tx = txInit<Schema>()

  public auth: Auth
  public storage: Storage
  public streams: Streams
  public core: InstantCoreDatabase<Schema, UseDates>
  private readonly useUserDefaultRequirement: UseUserDefault

  constructor(
    core: InstantCoreDatabase<Schema, UseDates>,
    options?: {
      requireUserInUseUser?: UseUserDefault
    },
  ) {
    this.core = core
    this.auth = this.core.auth
    this.storage = this.core.storage
    this.streams = this.core.streams
    this.useUserDefaultRequirement
      = (options?.requireUserInUseUser ?? 'clientOnly') as UseUserDefault
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

  queryOnceX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): Promise<QueryOnceXResult<Schema, DefinedQuery<Q>, UseDates, UseQueryXRuntimeQuery<Schema, Q>>>
  async queryOnceX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): Promise<QueryOnceXResult<Schema, any, UseDates, any>> {
    const { namespaceKeys } = namespaceKeyTrackerFromQuerySource(
      query as Q,
      () => false,
    )

    const response = await this.queryOnce(
      query as any,
      opts,
    ) as {
      data: Record<string, unknown>
      pageInfo: Record<string, unknown>
    }

    const result = {
      ...response,
    } as Record<string, unknown>

    for (const key of namespaceKeys) {
      const rows = response.data?.[key]
      result[key] = Array.isArray(rows) ? rows : []
    }

    return result as any
  }

  useInfiniteQuery = <Q extends ValidQuery<Q, Schema>>(
    query: (() => null | Q) | null | Q,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryResult<Schema, Q, UseDates> => {
    let activeSub: InfiniteQuerySubscription | null = null

    const state = reactive({
      ...defaultInfiniteQueryState,
      loadNextPage: () => {
        activeSub?.loadNextPage()
      },
    }) as UseInfiniteQueryState<Schema, Q, UseDates>

    const refs = createUseInfiniteQueryResultRefs(state)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return refs
    }

    const stop = watchEffect((onCleanup) => {
      const resolvedQuery
        = typeof query === 'function' ? (query as () => null | Q)() : query

      activeSub = null
      state.isLoading = true
      state.data = undefined
      state.error = undefined
      state.canLoadNextPage = false

      if (!resolvedQuery) {
        return
      }

      const snapshot = getInfiniteQueryInitialSnapshot<Schema, Q, UseDates>(
        this.core,
        resolvedQuery,
        opts,
      ) as
      | InfiniteQueryCallbackResponse<Schema, Q, UseDates>
      | {
        canLoadNextPage: false
        data: undefined
        error: undefined
      }

      state.error = snapshot.error
      state.data = snapshot.data
      state.canLoadNextPage = snapshot.canLoadNextPage
      state.isLoading = !snapshot.data && !snapshot.error

      const sub = this.core.subscribeInfiniteQuery<Q>(
        resolvedQuery,
        (result) => {
          state.error = result.error
          state.data = result.data
          state.canLoadNextPage = result.canLoadNextPage
          state.isLoading = false
        },
        opts,
      )

      activeSub = sub

      onCleanup(() => {
        if (activeSub === sub) {
          activeSub = null
        }
        sub.unsubscribe()
      })
    })

    attachScopeCleanup(stop)

    return refs
  }

  useQuery = <Q extends ValidQuery<Q, Schema>>(
    query: (() => null | Q) | null | Q,
    opts?: UseQueryOptions,
  ): UseQueryResult<Schema, Q, UseDates> => {
    const state = reactive({ ...defaultState }) as UseQueryState<Schema, Q, UseDates>
    const refs = createUseQueryResultRefs(state)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return refs
    }

    const stop = watchEffect((onCleanup) => {
      const resolvedQuery
        = typeof query === 'function' ? (query as () => null | Q)() : query

      if (!resolvedQuery) {
        state.isLoading = true
        state.data = undefined as any
        state.pageInfo = undefined as any
        state.error = undefined
        return
      }

      let nextQuery = resolvedQuery
      if (opts && 'ruleParams' in opts) {
        nextQuery = {
          $$ruleParams: (opts as any).ruleParams,
          ...nextQuery,
        }
      }

      const coerced = coerceQuery(nextQuery)
      const prev = this.core._reactor.getPreviousResult?.(coerced)
      const prevState = stateForResult(prev)
      state.isLoading = prevState.isLoading
      if (prev || !opts?.keepPreviousData) {
        state.data = prevState.data
        state.pageInfo = prevState.pageInfo
      }
      state.error = prevState.error

      const unsub = this.core.subscribeQuery<Q, UseDates>(coerced, (result: any) => {
        state.isLoading = false
        state.data = result.data
        state.pageInfo = result.pageInfo
        state.error = result.error
      })

      onCleanup(unsub)
    })

    attachScopeCleanup(stop)

    return refs
  }

  useQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringInput<Schema, Q>,
    opts?: UseQueryOptions,
  ): UseQueryXResult<Schema, DefinedQuery<Q>, UseDates, UseQueryXRuntimeQuery<Schema, Q>>
  useQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringFactory<Schema, Q>,
    opts?: UseQueryOptions,
  ): UseQueryXResult<Schema, DefinedQuery<Q>, UseDates, UseQueryXRuntimeQuery<Schema, Q>>
  useQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringSource<Schema, Q>,
    opts?: UseQueryOptions,
  ): UseQueryXResult<Schema, any, UseDates, any> {
    const { namespaceKeys, trackedQuery } = namespaceKeyTrackerFromQuerySource(
      query as (() => null | Q) | null | Q,
      key => key === 'isLoading' || key === 'data' || key === 'pageInfo' || key === 'error',
    )

    const lifecycleState = this.useQuery(
      trackedQuery as any,
      opts,
    ) as UseQueryResult<
      Schema,
      UseQueryXRuntimeQuery<Schema, Q>,
      UseDates
    >

    const refsBase = {
      isLoading: lifecycleState.isLoading,
      data: lifecycleState.data,
      pageInfo: lifecycleState.pageInfo,
      error: lifecycleState.error,
    }

    const { refsProxy, stateProxy } = createNamespaceXProjection(
      refsBase,
      namespaceKeys,
    )

    const typedRefsProxy = refsProxy as UseQueryXRefs<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >
    const typedStateProxy = stateProxy as UseQueryXState<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >

    const result = typedRefsProxy as UseQueryXResult<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >
    result.refs = typedRefsProxy
    result.state = typedStateProxy

    return result as any
  }

  useInfiniteQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryXResult<Schema, DefinedQuery<Q>, UseDates, UseQueryXRuntimeQuery<Schema, Q>>
  useInfiniteQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringFactory<Schema, Q>,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryXResult<Schema, DefinedQuery<Q>, UseDates, UseQueryXRuntimeQuery<Schema, Q>>
  useInfiniteQueryX<const Q extends TypedQueryForSchema<Schema>>(
    query: UseQueryXAuthoringSource<Schema, Q>,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryXResult<Schema, any, UseDates, any> {
    const { namespaceKeys, trackedQuery } = namespaceKeyTrackerFromQuerySource(
      query as (() => null | Q) | null | Q,
      key => key === 'isLoading'
        || key === 'data'
        || key === 'error'
        || key === 'canLoadNextPage'
        || key === 'loadNextPage',
    )

    const lifecycleState = this.useInfiniteQuery(
      trackedQuery as any,
      opts,
    ) as UseInfiniteQueryResult<
      Schema,
      UseQueryXRuntimeQuery<Schema, Q>,
      UseDates
    >

    const refsBase = {
      isLoading: lifecycleState.isLoading,
      data: lifecycleState.data,
      error: lifecycleState.error,
      canLoadNextPage: lifecycleState.canLoadNextPage,
      loadNextPage: lifecycleState.loadNextPage,
    }

    const { refsProxy, stateProxy } = createNamespaceXProjection(
      refsBase,
      namespaceKeys,
    )

    const typedRefsProxy = refsProxy as UseInfiniteQueryXRefs<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >
    const typedStateProxy = stateProxy as UseInfiniteQueryXState<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >

    const result = typedRefsProxy as UseInfiniteQueryXResult<
      Schema,
      DefinedQuery<Q>,
      UseDates,
      UseQueryXRuntimeQuery<Schema, Q>
    >
    result.refs = typedRefsProxy
    result.state = typedStateProxy

    return result as any
  }

  useAuth = (): UseAuthResult => {
    const state = reactive(
      this.core._reactor._currentUserCached
        ? { ...this.core._reactor._currentUserCached }
        : { ...defaultAuthState },
    ) as AuthState
    const refs = createUseAuthResultRefs(state)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return refs
    }

    const unsub = this.core.subscribeAuth((auth: any) => {
      state.isLoading = false
      state.user = auth.user
      state.error = auth.error
    })

    attachScopeCleanup(unsub)

    return refs
  }

  useAuthX = (): UseAuthXResult => {
    const refs = this.useAuth() as UseAuthXRefs
    const state = createUseAuthStateProjection(refs)

    const result = refs as UseAuthXResult
    result.refs = refs
    result.state = state

    return result
  }

  useUser = <
    Requirement extends UseUserRequirement = UseUserDefault,
  >(
    options?: UseUserOptions<Requirement>,
  ): ComputedRef<UseUserValue<Requirement>> => {
    const auth = this.useAuth()

    return computed(() => {
      if (auth.user.value) {
        return auth.user.value
      }

      const requirement
        = (options?.requireUser ?? this.useUserDefaultRequirement) as UseUserRequirement

      if (requirement === 'no') {
        return undefined
      }

      if (
        requirement === 'clientOnly'
        && (isServerRuntime() || !isReactorReadyForSubscriptions(this.core))
      ) {
        return undefined
      }

      throw new InstantError(
        'useUser must be used within an auth-protected route',
      )
    }) as ComputedRef<UseUserValue<Requirement>>
  }

  useConnectionStatus = (): Readonly<Ref<ConnectionStatus>> => {
    const initialStatus = isReactorReadyForSubscriptions(this.core)
      ? (this.core._reactor.status as ConnectionStatus)
      : 'connecting'

    const status = ref(initialStatus)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return readonly(status)
    }

    const unsub = this.core.subscribeConnectionStatus(
      (newStatus: ConnectionStatus) => {
        status.value = newStatus
      },
    )

    attachScopeCleanup(unsub)

    return readonly(status)
  }

  useLocalId = (name: string): Readonly<Ref<string | null>> => {
    const localId = ref<string | null>(null)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return readonly(localId)
    }

    let mounted = true

    this.getLocalId(name)
      .then((resolvedId) => {
        if (mounted) {
          localId.value = resolvedId
        }
      })
      .catch(() => {
        if (mounted) {
          localId.value = null
        }
      })

    attachScopeCleanup(() => {
      mounted = false
    })

    return readonly(localId)
  }

  room<RoomType extends keyof Rooms>(
    type: RoomType = '_defaultRoomType' as RoomType,
    id: string = '_defaultRoomId',
  ) {
    return new InstantVuxRoom<Schema, Rooms, RoomType>(this.core, type, id)
  }

  rooms = rooms
}

export function init<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
>(
  config: InstantVuxInitConfig<Schema, UseDates, UseUserDefault>,
): InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault> {
  const {
    requireUserInUseUser,
    ...coreConfig
  } = config

  const coreDb = coreInit<Schema, UseDates>(coreConfig, undefined, undefined, {
    '@mszr/idb-vux': version,
  })

  const dbOptions
    = requireUserInUseUser === undefined
      ? undefined
      : { requireUserInUseUser }

  return new InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault>(
    coreDb,
    dbOptions,
  )
}
