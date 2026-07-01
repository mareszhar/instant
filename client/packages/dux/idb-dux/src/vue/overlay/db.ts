import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type { IdbQueryData, IdbQueryOptions, IdbValidQuery } from '../../query/index.js'
import type { IdbSchema } from '../../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../../schema/register.js'
import type { IdbTx, IdbTxChunkInput } from '../../tx/index.js'
import type { IdbDuxDatabase } from '../baseline/index.js'
import type {
  IdbAuthResult,
  IdbAuthUser,
  IdbConnectionResult,
  IdbInfiniteQueryResult,
  IdbLocalIdResult,
  IdbQueryResult,
  IdbUserOptions,
} from './types.js'
import { InstantError } from '@instantdb/core'
/**
 * The enhanced db — the only public client surface. A thin overlay over the
 * vendored baseline ([dux-spec-vue.md §1]): hooks compose baseline hooks and
 * reshape through the pure `shapeResult`, never forking the baseline. SSR
 * resilience comes from the baseline guards; shaping and the result pattern
 * are added here.
 */
import { computed, toValue } from 'vue'
import { resultKeys, shapeResult, shapingSchema, toWireQuery } from '../../query/index.js'
import { typedTx } from '../../tx/index.js'
import { makeDynamicResult, makeResult } from './result.js'
import { rooms as overlayRooms } from './rooms/index.js'

/** A query input: a query, a ref/getter of one, or a factory returning null to pause. */
type QueryInput<Q> = MaybeRefOrGetter<Q | null>

export class IdbClient<S extends IdbSchema = IdbRegisteredSchema> {
  /** The schema-typed tx chain — shared machinery with `/admin` ([root §5]). */
  public readonly tx: IdbTx<S> = typedTx<S>()
  /** Rooms hooks — stateful ones return the result pattern ([§6]). */
  public readonly rooms = overlayRooms

  readonly #baseline: IdbDuxDatabase<S>
  readonly #schema: IdbSchema

  constructor(baseline: IdbDuxDatabase<S>, schema: IdbSchema | undefined) {
    this.#baseline = baseline
    this.#schema = shapingSchema(schema)
  }

  // ----- pass-throughs to the baseline -----

  get auth() {
    return this.#baseline.auth
  }

  get storage() {
    return this.#baseline.storage
  }

  get streams() {
    return this.#baseline.streams
  }

  transact = (chunks: IdbTxChunkInput<S> | IdbTxChunkInput<S>[]) =>
    this.#baseline.transact(chunks as any)

  getAuth = (): Promise<IdbAuthUser | null> => this.#baseline.getAuth()

  /**
   * The current user's Instant `refresh_token`, or `null` when unauthenticated.
   * The one client-side piece the bearer transport needs: read it here and
   * attach it as `Authorization: Bearer <token>` on requests to your `/api`
   * from native shells and cross-origin surfaces ([dux-spec-server.md §7]).
   */
  getCurrentRefreshToken = async (): Promise<string | null> =>
    (await this.getAuth())?.refresh_token ?? null

  getLocalId = (name: string): Promise<string> => this.#baseline.getLocalId(name)

  room = ((type?: any, id?: any) => this.#baseline.room(type, id)) as
    IdbDuxDatabase<S>['room']

  // ----- the data plane -----

  /**
   * Subscribe to a query. Destructure top-level scopes directly — full
   * shaping ($only/$at/$as/$m, array normalization, singularization) per the
   * root spec, plus the result pattern. A factory returning `null` pauses.
   */
  useQuery = <const Q extends IdbValidQuery<Q, S>>(
    query: QueryInput<Q>,
    opts?: MaybeRefOrGetter<IdbQueryOptions<S> | null | undefined>,
  ): IdbQueryResult<Q, S> => {
    const duxQuery = computed(() => toValue(query) as Record<string, any> | null)
    const base = this.#baseline.useQuery(
      (() => {
        const q = duxQuery.value
        return q ? toWireQuery(q) : null
      }) as any,
      opts as any,
    )
    const shaped = computed(() => {
      const q = duxQuery.value
      return q ? shapeResult(base.data.value, q, this.#schema) : {}
    })
    return makeDynamicResult(
      { isLoading: base.isLoading, error: base.error, pageInfo: base.pageInfo },
      key => computed(() => shaped.value[key]),
    )
  }

  /** Imperative one-shot with identical shaping — plain shaped data, no refs. */
  queryOnce = async <const Q extends IdbValidQuery<Q, S>>(
    query: Q,
    opts?: IdbQueryOptions<S>,
  ): Promise<IdbQueryData<Q, S>> => {
    const { data } = await this.#baseline.queryOnce(
      toWireQuery(query as Record<string, any>) as any,
      opts as any,
    )
    return shapeResult(data, query as Record<string, any>, this.#schema) as IdbQueryData<Q, S>
  }

  /** The data plane, paginated — same shaping, plus `loadNextPage`. */
  useInfiniteQuery = <const Q extends IdbValidQuery<Q, S>>(
    query: QueryInput<Q>,
    opts?: MaybeRefOrGetter<IdbQueryOptions<S> | undefined>,
  ): IdbInfiniteQueryResult<Q, S> => {
    const duxQuery = computed(() => toValue(query) as Record<string, any> | null)
    const base = this.#baseline.useInfiniteQuery(
      (() => {
        const q = duxQuery.value
        return q ? toWireQuery(q) : null
      }) as any,
      opts as any,
    )
    const shaped = computed(() => {
      const q = duxQuery.value
      return q ? shapeResult(base.data.value, q, this.#schema) : {}
    })
    return makeDynamicResult(
      { isLoading: base.isLoading, error: base.error, canLoadNextPage: base.canLoadNextPage },
      key => computed(() => shaped.value[key]),
      { loadNextPage: base.loadNextPage },
    )
  }

  // ----- auth, connection, identity -----

  useAuth = (): IdbAuthResult => {
    const { isLoading, user, error } = this.#baseline.useAuth()
    // dux types `user` as IdbAuthUser | undefined — fold the official null.
    const userRef = computed(() => user.value ?? undefined)
    return makeResult({ isLoading, user: userRef, error })
  }

  /**
   * The user-centric projection. `requireUser: true` types `user` present and
   * throws at access when there's none; the default leaves it optional.
   */
  useUser(opts: { requireUser: true }): ComputedRef<IdbAuthUser>
  useUser(opts?: IdbUserOptions): ComputedRef<IdbAuthUser | undefined>
  useUser(opts?: IdbUserOptions): ComputedRef<IdbAuthUser | undefined> {
    const { user } = this.useAuth()
    return computed(() => {
      if (!user.value && opts?.requireUser) {
        throw new InstantError(
          'useUser({ requireUser: true }) must be used behind an auth gate',
        )
      }
      return user.value
    })
  }

  useConnectionStatus = (): IdbConnectionResult => {
    const status = this.#baseline.useConnectionStatus()
    return makeResult({ status })
  }

  useLocalId = (name: MaybeRefOrGetter<string>): IdbLocalIdResult => {
    const localId = this.#baseline.useLocalId(name)
    return makeResult({ localId })
  }
}

void resultKeys // exported utility; kept available for tooling
