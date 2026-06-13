/**
 * The `/admin` boundary module — every rename from `@instantdb/admin` lives
 * here and nowhere else (wrap-and-map, dux-spec-workspace.md §5.1). Two kinds
 * of type live side by side:
 *
 * - **aliases** for shapes dux keeps verbatim (`IdbAuthUser`, the storage and
 *   stream option/result types, the debug check result): pure renames over the
 *   official types, so upstream changes ride in for free and break loudly at
 *   the wrap points.
 * - **authored-fresh** for the subscription surface (`IdbQuerySubscription` and
 *   its payload/callback): a subscription emits the *shaped* data plane, the
 *   same `IdbQueryData<Q>` `query` returns — so its payload is dux-typed, not a
 *   pass-through of the official `InstaQLResponse` shape.
 *
 * Everything is registration-typed — no schema generic at any call site, with
 * the trailing escape-hatch param for multi-schema tools.
 */
import type {
  CreateReadStreamOpts,
  CreateWriteStreamOpts,
  DebugCheckResult,
  DeleteFileResponse,
  FileOpts,
  ImpersonationOpts,
  InstantAdminDatabase,
  InstantAPIError,
  InstantConfig,
  SubscriptionReadyState,
  UploadFileResponse,
  User,
} from '@instantdb/admin'
import type { IdbQueryData, IdbQueryPageInfo } from '../query/index.js'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'

// ==========
// init config

/**
 * `init` config — everything the official admin SDK supports, minus
 * `useDateObjects` (dux types `i.date()` fields as the wire format on every
 * surface) and with `schema` typed as your registered `S`. The schema unlocks
 * shaping and typed `ruleParams`; `apiURI` is for self-hosting.
 */
export type IdbAdminConfig<S extends IdbSchema = IdbRegisteredSchema> = Omit<
  InstantConfig<S, false>,
  'useDateObjects' | 'schema'
> & { schema?: S }

// ==========
// auth, storage, streams — official shapes, dux names

/** The authenticated user (official `User`). */
export type IdbAuthUser = User

/** The scope `asUser` accepts — a user email, an auth token, or a guest. */
export type IdbAdminImpersonation = ImpersonationOpts

/** Per-file upload metadata (official `FileOpts`). */
export type IdbStorageFileOpts = FileOpts
/** The result of a storage upload. */
export type IdbStorageUploadResult = UploadFileResponse
/** The result of a storage delete. */
export type IdbStorageDeleteResult = DeleteFileResponse

/** Options for opening a read stream. */
export type IdbStreamReadOpts = CreateReadStreamOpts
/** Options for opening a write stream. */
export type IdbStreamWriteOpts = CreateWriteStreamOpts

type AdminStreams = InstantAdminDatabase<IdbSchema, false>['streams']
/** A live readable stream of string chunks. */
export type IdbReadableStream = ReturnType<AdminStreams['createReadStream']>
/** A live writable stream of string chunks. */
export type IdbWritableStream = ReturnType<AdminStreams['createWriteStream']>

// ==========
// debug + transact results

/** One entity's permission-check result from `debugQuery` (official `DebugCheckResult`). */
export type IdbAdminCheckResult = DebugCheckResult
/** The summary `debugTransact` returns — tx id + an all-checks-ok flag. */
export type IdbAdminDebugTransactResult = Awaited<
  ReturnType<InstantAdminDatabase<IdbSchema, false>['debugTransact']>
>
/** The acknowledgement a write returns. */
export type IdbAdminTransactResult = Awaited<
  ReturnType<InstantAdminDatabase<IdbSchema, false>['transact']>
>

// ==========
// the subscription — authored fresh so payloads carry the shaped data plane

/** Whether a subscription's connection is open, connecting, or closed. */
export type IdbSubscriptionReadyState = SubscriptionReadyState

/**
 * Debug info about a subscription's session. Mirrors the official
 * `SubscribeQuerySessionInfo` shape, authored fresh because that type isn't
 * separately exported (the surrounding payload generic can't be instantiated
 * without a concrete query to satisfy its `ValidQuery` constraint).
 */
export interface IdbQuerySessionInfo {
  machineId: string
  sessionId: string
}

/**
 * One emission from `subscribeQuery` — `data` is the shaped data plane
 * (`IdbQueryData<Q>`, identical to `query`'s return), so a subscription and a
 * one-shot of the same query deliver the same shape.
 */
export type IdbQuerySubscriptionPayload<
  Q,
  S extends IdbSchema = IdbRegisteredSchema,
>
  = | {
    type: 'ok'
    data: IdbQueryData<Q, S>
    pageInfo: IdbQueryPageInfo<Q> | undefined
    sessionInfo: IdbQuerySessionInfo | null
  }
  | {
    type: 'error'
    error: InstantAPIError
    readyState: IdbSubscriptionReadyState
    isClosed: boolean
    sessionInfo: IdbQuerySessionInfo | null
  }

/** The callback form of `subscribeQuery`. */
export type IdbQuerySubscriptionCallback<
  Q,
  S extends IdbSchema = IdbRegisteredSchema,
> = (payload: IdbQuerySubscriptionPayload<Q, S>) => void

/**
 * A live subscription handle (official `SubscribeQueryResponse`, payloads
 * dux-shaped). Iterate it with `for await`, or pass a callback to
 * `subscribeQuery`; `close()` stops it.
 */
export interface IdbQuerySubscription<
  Q,
  S extends IdbSchema = IdbRegisteredSchema,
> {
  /** Stop the subscription and close the connection. */
  close: () => void
  /** Guards against synchronous iteration. */
  [Symbol.iterator]: () => never
  /** Async iterator of shaped query payloads. */
  [Symbol.asyncIterator]: () => AsyncIterableIterator<IdbQuerySubscriptionPayload<Q, S>>
  /** Ready state of the connection. */
  readonly readyState: IdbSubscriptionReadyState
  /** `true` once closed and no more payloads will arrive. */
  readonly isClosed: boolean
  /** Session debug info; `null` while the session initializes. */
  readonly sessionInfo: IdbQuerySessionInfo | null
}

// ==========
// debug-query options

/**
 * `debugQuery` options — typed `ruleParams` plus the rules/ip/origin overrides
 * the permission inspector accepts.
 */
export interface IdbAdminDebugQueryOpts<S extends IdbSchema = IdbRegisteredSchema> {
  ruleParams?: import('../query/index.js').IdbSchemaRuleParams<S>
  rules?: unknown
  ip?: string | null | undefined
  origin?: string | null | undefined
  cardinalityInference?: boolean
}

/** `debugTransact` options — rules/ip/origin overrides for the inspector. */
export interface IdbAdminDebugTransactOpts {
  rules?: unknown
  ip?: string | null | undefined
  origin?: string | null | undefined
}
