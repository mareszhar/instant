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
} from '@instantdb/core'
import type { ComputedRef, MaybeRefOrGetter, Raw, Ref } from 'vue'
import type {
  DefinedQuery,
  ValidateTypedQueryForSchema,
} from './defineQuery.js'
import type { InstantVuxRoomHandle } from './InstantVuxRoom.js'
import type { StateFromRefs, XResult } from './xResult.js'
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
  markRaw,
  onScopeDispose,
  reactive,
  ref,
  toValue,
  watch,
  watchEffect,
} from 'vue'
import { InstantVuxRoom, rooms } from './InstantVuxRoom.js'
import version from './version.js'
import { createStateFromRefs, createXResult } from './xResult.js'

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

export type UseConnectionStatusResult = Readonly<Ref<ConnectionStatus>>

export type UseLocalIdResult = Readonly<Ref<string | null>>

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

export type UseAuthXState = StateFromRefs<UseAuthXRefs>

export type UseAuthXResult = XResult<UseAuthXRefs, UseAuthXState>

export interface UseConnectionStatusXRefs {
  status: UseConnectionStatusResult
}

export type UseConnectionStatusXState = StateFromRefs<UseConnectionStatusXRefs>

export type UseConnectionStatusXResult = XResult<
  UseConnectionStatusXRefs,
  UseConnectionStatusXState
>

export interface UseLocalIdXRefs {
  localId: UseLocalIdResult
}

export type UseLocalIdXState = StateFromRefs<UseLocalIdXRefs>

export type UseLocalIdXResult = XResult<
  UseLocalIdXRefs,
  UseLocalIdXState
>

export interface UseUserXRefs<
  Requirement extends UseUserRequirement = UseUserRequirement,
> {
  user: ComputedRef<UseUserValue<Requirement>>
}

export type UseUserXState<
  Requirement extends UseUserRequirement = UseUserRequirement,
> = StateFromRefs<UseUserXRefs<Requirement>>

export type UseUserXResult<
  Requirement extends UseUserRequirement = UseUserRequirement,
> = XResult<
  UseUserXRefs<Requirement>,
  UseUserXState<Requirement>
>

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

type IsAny<T> = 0 extends (1 & T) ? true : false

type QueryAuthoringInput<
  Schema extends InstantSchemaDef<any, any, any>,
  Q,
> = IsAny<Schema> extends true
  ? Q
  : ValidateTypedQueryForSchema<Schema, Q> & Q

type QueryAuthoringFactory<
  Schema extends InstantSchemaDef<any, any, any>,
  Q,
> = () => null | QueryAuthoringInput<Schema, Q>

type QueryAuthoringSource<
  Schema extends InstantSchemaDef<any, any, any>,
  Q,
>
  = | null
    | QueryAuthoringInput<Schema, Q>
    | QueryAuthoringFactory<Schema, Q>

type QueryInlineAuthoringQuery<Source>
  = Source extends () => null | infer Q
    ? NonNullable<Q>
    : Source

type QueryInlineAuthoringSource<
  Schema extends InstantSchemaDef<any, any, any>,
  Source,
> = Source extends () => null | infer Q
  ? Source & (() => null | QueryAuthoringInput<Schema, NonNullable<Q>>)
  : QueryAuthoringInput<Schema, Source>

type QueryMaybeRefOrGetterValue<Source>
  = Source extends () => null | infer Q
    ? NonNullable<Q>
    : Source extends ComputedRef<null | infer Q>
      ? NonNullable<Q>
      : Source extends Ref<null | infer Q>
        ? NonNullable<Q>
        : NonNullable<Source>

type QueryMaybeRefOrGetterSource<
  Schema extends InstantSchemaDef<any, any, any>,
  Source,
> = Source extends () => null | infer Q
  ? Source & (() => null | QueryAuthoringInput<Schema, NonNullable<Q>>)
  : Source extends ComputedRef<null | infer Q>
    ? Source & ComputedRef<null | QueryAuthoringInput<Schema, NonNullable<Q>>>
    : Source extends Ref<null | infer Q>
      ? Source & Ref<null | QueryAuthoringInput<Schema, NonNullable<Q>>>
      : Source extends null
        ? null
        : QueryAuthoringInput<Schema, NonNullable<Source>>

type QueryRuntimeQuery<Q> = DefinedQuery<Q extends Record<string, any> ? Q : never>

type QueryMaybeRefOrGetterRuntimeQuery<Source>
  = QueryRuntimeQuery<QueryMaybeRefOrGetterValue<Source>>

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
> = XResult<
  UseQueryXRefs<Schema, Q, UseDates, RuntimeQ>,
  UseQueryXState<Schema, Q, UseDates, RuntimeQ>
>

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
> = XResult<
  UseInfiniteQueryXRefs<Schema, Q, UseDates, RuntimeQ>,
  UseInfiniteQueryXState<Schema, Q, UseDates, RuntimeQ>
>

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
): XResult<Record<string, unknown>, Record<string, unknown>> {
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
      const data = toValue(dataRef as MaybeRefOrGetter<Record<string, unknown> | undefined>)
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

  const stateBase = createStateFromRefs(baseRefs) as Record<string, unknown>
  const stateProxy = new Proxy(stateBase, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && !isReservedKey(prop) && !(prop in target)) {
        return namespaceRefFor(prop).value
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  return createXResult(refsProxy, stateProxy)
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

  queryOnce = <const Q>(
    query: QueryAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): Promise<{
    data: InstaQLResponse<Schema, QueryRuntimeQuery<Q>, UseDates>
    pageInfo: PageInfoResponse<QueryRuntimeQuery<Q>>
  }> => {
    return this.core.queryOnce(query as any, opts) as any
  }

  queryOnceX<const Q>(
    query: QueryAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): Promise<QueryOnceXResult<Schema, QueryRuntimeQuery<Q>, UseDates, QueryRuntimeQuery<Q>>>
  async queryOnceX<const Q>(
    query: QueryAuthoringInput<Schema, Q>,
    opts?: InstaQLOptions,
  ): Promise<QueryOnceXResult<Schema, any, UseDates, any>> {
    const { namespaceKeys } = namespaceKeyTrackerFromQuerySource(
      query as any,
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

  useInfiniteQuery = <const Source>(
    query: QueryMaybeRefOrGetterSource<Schema, Source>,
    opts?: MaybeRefOrGetter<InstaQLOptions | null | undefined>,
  ): UseInfiniteQueryResult<Schema, QueryMaybeRefOrGetterRuntimeQuery<Source>, UseDates> => {
    let activeSub: InfiniteQuerySubscription | null = null

    const state = reactive({
      ...defaultInfiniteQueryState,
      loadNextPage: () => {
        activeSub?.loadNextPage()
      },
    }) as UseInfiniteQueryState<Schema, QueryMaybeRefOrGetterRuntimeQuery<Source>, UseDates>

    const refs = createUseInfiniteQueryResultRefs(state)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return refs
    }

    const stop = watchEffect((onCleanup) => {
      const resolvedQuery = toValue(query as MaybeRefOrGetter<any>)
      const resolvedOpts = toValue(opts)

      activeSub = null
      state.isLoading = true
      state.data = undefined
      state.error = undefined
      state.canLoadNextPage = false

      if (!resolvedQuery) {
        return
      }

      const snapshot = getInfiniteQueryInitialSnapshot(
        this.core,
        resolvedQuery as any,
        resolvedOpts ?? undefined,
      ) as
      | InfiniteQueryCallbackResponse<Schema, QueryMaybeRefOrGetterRuntimeQuery<Source>, UseDates>
      | {
        canLoadNextPage: false
        data: undefined
        error: undefined
      }

      state.error = snapshot.error
      state.data = snapshot.data
      state.canLoadNextPage = snapshot.canLoadNextPage
      state.isLoading = !snapshot.data && !snapshot.error

      const sub = this.core.subscribeInfiniteQuery(
        resolvedQuery as any,
        (result) => {
          state.error = result.error
          state.data = result.data
          state.canLoadNextPage = result.canLoadNextPage
          state.isLoading = false
        },
        resolvedOpts ?? undefined,
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

  useQuery = <const Source>(
    query: QueryMaybeRefOrGetterSource<Schema, Source>,
    opts?: MaybeRefOrGetter<UseQueryOptions | null | undefined>,
  ): UseQueryResult<Schema, QueryMaybeRefOrGetterRuntimeQuery<Source>, UseDates> => {
    const state = reactive({ ...defaultState }) as UseQueryState<Schema, QueryMaybeRefOrGetterRuntimeQuery<Source>, UseDates>
    const refs = createUseQueryResultRefs(state)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return refs
    }

    const stop = watchEffect((onCleanup) => {
      const resolvedQuery = toValue(query as MaybeRefOrGetter<any>)
      const resolvedOpts = toValue(opts)

      if (!resolvedQuery) {
        state.isLoading = true
        state.data = undefined as any
        state.pageInfo = undefined as any
        state.error = undefined
        return
      }

      let nextQuery = resolvedQuery
      if (resolvedOpts && 'ruleParams' in resolvedOpts) {
        nextQuery = {
          $$ruleParams: (resolvedOpts as any).ruleParams,
          ...nextQuery,
        }
      }

      const coerced = coerceQuery(nextQuery)
      const prev = this.core._reactor.getPreviousResult?.(coerced)
      const prevState = stateForResult(prev)
      state.isLoading = prevState.isLoading
      if (prev || !resolvedOpts?.keepPreviousData) {
        state.data = prevState.data
        state.pageInfo = prevState.pageInfo
      }
      state.error = prevState.error

      const unsub = this.core.subscribeQuery(coerced as any, (result: any) => {
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

  useQueryX<const Source>(
    query: QueryInlineAuthoringSource<Schema, Source>,
    opts?: UseQueryOptions,
  ): UseQueryXResult<
    Schema,
    QueryRuntimeQuery<QueryInlineAuthoringQuery<Source>>,
    UseDates,
    QueryRuntimeQuery<QueryInlineAuthoringQuery<Source>>
  >
  useQueryX<const Q>(
    query: QueryAuthoringSource<Schema, Q>,
    opts?: UseQueryOptions,
  ): UseQueryXResult<Schema, any, UseDates, any> {
    const { namespaceKeys, trackedQuery } = namespaceKeyTrackerFromQuerySource(
      query as any,
      key => key === 'isLoading' || key === 'data' || key === 'pageInfo' || key === 'error',
    )

    const lifecycleState = this.useQuery(
      trackedQuery as any,
      opts,
    ) as UseQueryResult<Schema, any, UseDates>

    const refsBase = {
      isLoading: lifecycleState.isLoading,
      data: lifecycleState.data,
      pageInfo: lifecycleState.pageInfo,
      error: lifecycleState.error,
    }

    const result = createNamespaceXProjection(
      refsBase,
      namespaceKeys,
    ) as UseQueryXResult<Schema, any, UseDates, any>

    return result as any
  }

  useInfiniteQueryX<const Source>(
    query: QueryInlineAuthoringSource<Schema, Source>,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryXResult<
    Schema,
    QueryRuntimeQuery<QueryInlineAuthoringQuery<Source>>,
    UseDates,
    QueryRuntimeQuery<QueryInlineAuthoringQuery<Source>>
  >
  useInfiniteQueryX<const Q>(
    query: QueryAuthoringSource<Schema, Q>,
    opts?: InstaQLOptions,
  ): UseInfiniteQueryXResult<Schema, any, UseDates, any> {
    const { namespaceKeys, trackedQuery } = namespaceKeyTrackerFromQuerySource(
      query as any,
      key => key === 'isLoading'
        || key === 'data'
        || key === 'error'
        || key === 'canLoadNextPage'
        || key === 'loadNextPage',
    )

    const lifecycleState = this.useInfiniteQuery(
      trackedQuery as any,
      opts,
    ) as UseInfiniteQueryResult<Schema, any, UseDates>

    const refsBase = {
      isLoading: lifecycleState.isLoading,
      data: lifecycleState.data,
      error: lifecycleState.error,
      canLoadNextPage: lifecycleState.canLoadNextPage,
      loadNextPage: lifecycleState.loadNextPage,
    }

    const result = createNamespaceXProjection(
      refsBase,
      namespaceKeys,
    ) as UseInfiniteQueryXResult<Schema, any, UseDates, any>

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
    return createXResult(refs) as UseAuthXResult
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

  useUserX = <
    Requirement extends UseUserRequirement = UseUserDefault,
  >(
    options?: UseUserOptions<Requirement>,
  ): UseUserXResult<Requirement> => {
    const user = this.useUser(options)
    const refs = {
      user,
    } as UseUserXRefs<Requirement>

    return createXResult(refs) as UseUserXResult<Requirement>
  }

  useConnectionStatus = (): UseConnectionStatusResult => {
    const initialStatus = isReactorReadyForSubscriptions(this.core)
      ? (this.core._reactor.status as ConnectionStatus)
      : 'connecting'

    const status = ref(initialStatus)
    const statusView = computed(() => status.value)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return statusView
    }

    const unsub = this.core.subscribeConnectionStatus(
      (newStatus: ConnectionStatus) => {
        status.value = newStatus
      },
    )

    attachScopeCleanup(unsub)

    return statusView
  }

  useConnectionStatusX = (): UseConnectionStatusXResult => {
    const status = this.useConnectionStatus()
    const refs = {
      status,
    } as UseConnectionStatusXRefs

    return createXResult(refs) as UseConnectionStatusXResult
  }

  useLocalId = (name: MaybeRefOrGetter<string>): UseLocalIdResult => {
    const localId = ref<string | null>(null)
    const localIdView = computed(() => localId.value)

    if (isServerRuntime() || !isReactorReadyForSubscriptions(this.core)) {
      return localIdView
    }

    let mounted = true
    let requestVersion = 0

    const stop = watch(
      () => toValue(name),
      (currentName) => {
        requestVersion += 1
        const currentRequestVersion = requestVersion

        this.getLocalId(currentName)
          .then((resolvedId) => {
            if (!mounted || currentRequestVersion !== requestVersion) {
              return
            }

            localId.value = resolvedId
          })
          .catch(() => {
            if (!mounted || currentRequestVersion !== requestVersion) {
              return
            }

            localId.value = null
          })
      },
      { immediate: true },
    )

    attachScopeCleanup(() => {
      mounted = false
      stop()
    })

    return localIdView
  }

  useLocalIdX = (
    name: MaybeRefOrGetter<string>,
  ): UseLocalIdXResult => {
    const localId = this.useLocalId(name)
    const refs = {
      localId,
    } as UseLocalIdXRefs

    return createXResult(refs) as UseLocalIdXResult
  }

  room<RoomType extends string & keyof Rooms>(
    type?: MaybeRefOrGetter<RoomType | undefined>,
    id?: MaybeRefOrGetter<string | undefined>,
  ) {
    const resolvedType = computed(
      () => (toValue(type) ?? '_defaultRoomType') as RoomType,
    )
    const resolvedId = computed(() => toValue(id) ?? '_defaultRoomId')

    const room = new InstantVuxRoom<Schema, Rooms, RoomType>(
      this.core,
      resolvedType,
      resolvedId,
    ) as InstantVuxRoomHandle<Schema, Rooms, RoomType>

    return markRaw(room)
  }

  rooms = rooms
}

export type InstantVuxDatabaseHandle<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  Rooms extends RoomSchemaShape = RoomsOf<Schema>,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
> = Raw<InstantVuxDatabase<Schema, UseDates, Rooms, UseUserDefault>>

export function init<
  Schema extends InstantSchemaDef<any, any, any>,
  UseDates extends boolean = false,
  UseUserDefault extends UseUserRequirement = 'clientOnly',
>(
  config: InstantVuxInitConfig<Schema, UseDates, UseUserDefault>,
): InstantVuxDatabaseHandle<Schema, UseDates, RoomsOf<Schema>, UseUserDefault> {
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

  return markRaw(new InstantVuxDatabase<Schema, UseDates, RoomsOf<Schema>, UseUserDefault>(
    coreDb,
    dbOptions,
  ))
}
