/**
 * `/admin` setup and the composed admin db. dux's `init` owns
 * `@instantdb/admin` as an optional peer — apps never construct an official
 * admin db to hand in ([dux-spec-admin.md §2]). `IdbAdminClient` wraps the
 * official instance: the data plane is shaped, tx/debug carry the schema-typed
 * machinery, and every pass-through keeps its official verb.
 *
 * `asUser` rebuilds the same wrapper over the scoped official instance, which
 * is what keeps every treatment intact on the permission-scoped db.
 */
import type { InstantAdminDatabase } from '@instantdb/admin'
import type {
  IdbQueryData,
  IdbQueryOptions,
  IdbValidQuery,
} from '../query/index.js'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbTx, IdbTxChunkInput } from '../tx/index.js'
import type { IdbWebhooks } from '../webhooks/index.js'
import type {
  IdbAdminCheckResult,
  IdbAdminConfig,
  IdbAdminDebugQueryOpts,
  IdbAdminDebugTransactOpts,
  IdbAdminDebugTransactResult,
  IdbAdminImpersonation,
  IdbAdminTransactResult,
  IdbQuerySubscription,
  IdbQuerySubscriptionCallback,
} from './types.js'
import { init as adminInit } from '@instantdb/admin'
import { shapeResult, shapingSchema, toWireQuery } from '../query/index.js'
import { typedTx } from '../tx/index.js'
import { runQuery, runSubscribeQuery } from './query.js'
import { adminWebhooks } from './webhooks.js'

type OfficialDb<S extends IdbSchema> = InstantAdminDatabase<S, false>

/** The full server surface — the dux data plane over `@instantdb/admin`. */
export class IdbAdminClient<S extends IdbSchema = IdbRegisteredSchema> {
  /** The schema-typed tx chain — shared machinery with `/vue` ([root §5]). */
  public readonly tx: IdbTx<S> = typedTx<S>()

  readonly #official: OfficialDb<S>
  readonly #schema: IdbSchema
  #webhooks: IdbWebhooks<S> | undefined

  constructor(official: OfficialDb<S>, schema: IdbSchema | undefined) {
    this.#official = official
    this.#schema = shapingSchema(schema)
  }

  // ----- the data plane -----

  /**
   * Read once. Destructure top-level scopes directly — full shaping
   * (`$only`/`$at`/`$as`/`$m`, array normalization, singularization) per the
   * root spec. `opts` carries schema-typed `ruleParams`.
   */
  query = <const Q extends IdbValidQuery<Q, S>>(
    query: Q,
    opts?: IdbQueryOptions<S>,
  ): Promise<IdbQueryData<Q, S>> =>
    runQuery(this.#official, this.#schema, query as Record<string, any>, opts) as Promise<
      IdbQueryData<Q, S>
    >

  /**
   * Live-subscribe with the same per-emission shaping. Pass a callback, or
   * iterate the handle with `for await`; `close()` stops it.
   */
  subscribeQuery = <const Q extends IdbValidQuery<Q, S>>(
    query: Q,
    cb?: IdbQuerySubscriptionCallback<Q, S>,
    opts?: IdbQueryOptions<S>,
  ): IdbQuerySubscription<Q, S> =>
    runSubscribeQuery<Q, S>(this.#official, this.#schema, query as Record<string, any>, cb, opts)

  // ----- typed tx + debug -----

  /** Write data — the typed tx chain, schema-typed `ruleParams`, dot-path `.link`. */
  transact = (chunks: IdbTxChunkInput<S> | IdbTxChunkInput<S>[]): Promise<IdbAdminTransactResult> =>
    this.#official.transact(chunks as any)

  /**
   * Like `query`, but returns permission-check debug info alongside the shaped
   * result. Requires a user/guest context — call it on an `asUser` db.
   */
  debugQuery = async <const Q extends IdbValidQuery<Q, S>>(
    query: Q,
    opts?: IdbAdminDebugQueryOpts<S>,
  ): Promise<{ result: IdbQueryData<Q, S>, checkResults: IdbAdminCheckResult[] }> => {
    const { result, checkResults } = await this.#official.debugQuery(
      toWireQuery(query as Record<string, any>) as any,
      opts as any,
    )
    return {
      result: shapeResult(result, query as Record<string, any>, this.#schema) as IdbQueryData<Q, S>,
      checkResults,
    }
  }

  /** Like `transact`, but writes nothing — returns permission-check debug info. */
  debugTransact = (
    chunks: IdbTxChunkInput<S> | IdbTxChunkInput<S>[],
    opts?: IdbAdminDebugTransactOpts,
  ): Promise<IdbAdminDebugTransactResult> =>
    this.#official.debugTransact(chunks as any, opts as any)

  // ----- asUser + pass-throughs -----

  /** Scope every read/write to a user, guest, or token — same dux surface, permission-scoped. */
  asUser = (opts: IdbAdminImpersonation): IdbAdminClient<S> =>
    new IdbAdminClient<S>(this.#official.asUser(opts) as OfficialDb<S>, this.#schema)

  get auth(): OfficialDb<S>['auth'] {
    return this.#official.auth
  }

  get storage(): OfficialDb<S>['storage'] {
    return this.#official.storage
  }

  get streams(): OfficialDb<S>['streams'] {
    return this.#official.streams
  }

  get rooms(): OfficialDb<S>['rooms'] {
    return this.#official.rooms
  }

  /** Webhook handling + management, admin-token wired ([§5]). */
  get webhooks(): IdbWebhooks<S> {
    return (this.#webhooks ??= adminWebhooks<S>({
      appId: this.#official.config.appId,
      adminToken: this.#official.config.adminToken,
      apiURI: this.#official.config.apiURI,
    }))
  }
}

/**
 * Create the admin db. `appId` + `adminToken` + `schema` is the usual setup;
 * the schema unlocks shaping and typed `ruleParams`.
 *
 * @example
 *   const adminDb = init({ appId, adminToken, schema })
 *   const { workspaces } = await adminDb.query(q({ workspaces: {} }))
 */
export function init<S extends IdbSchema = IdbRegisteredSchema>(
  config: IdbAdminConfig<S>,
): IdbAdminClient<S> {
  const official = adminInit<S, false>(config as any) as OfficialDb<S>
  return new IdbAdminClient<S>(official, config.schema)
}
