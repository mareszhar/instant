/**
 * The `/vue` overlay's public types: the config rename, the result-pattern
 * shapes per domain, and the auth/connection renames. Every stateful hook
 * returns `Idb<Domain>Result` with `-Data`/`-State`/`-Refs` subparts
 * ([conventions §3]).
 */
import type {
  ConnectionStatus,
  InstantConfig,
  User,
} from '@instantdb/core'
import type { Ref } from 'vue'
import type { IdbQueryData, IdbQueryPageInfo } from '../../query/index.js'
import type { IdbSchema } from '../../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../../schema/register.js'
import type { IdbResult, StateOf } from './result.js'

// ==========
// config + auth/connection renames

/**
 * `init`/`defineDb` config — everything core supports, including `devtool`
 * and `apiURI`/`websocketURI` (self-hosting). `i.date()` fields are typed as
 * the wire format everywhere, so `useDateObjects` stays off.
 */
export type IdbClientConfig<S extends IdbSchema = IdbRegisteredSchema> = Omit<
  InstantConfig<S, false>,
  'useDateObjects' | 'schema'
> & { schema?: S }

/** The authenticated user (official `User`). */
export type IdbAuthUser = User

/** Connection status union (official `ConnectionStatus`). */
export type IdbConnectionStatus = ConnectionStatus

// ==========
// result-pattern shapes

type QueryRefs<Q, S extends IdbSchema> = {
  isLoading: Ref<boolean>
  error: Ref<{ message: string } | undefined>
  pageInfo: Ref<IdbQueryPageInfo<Q> | undefined>
} & {
  [K in keyof IdbQueryData<Q, S>]: Ref<IdbQueryData<Q, S>[K]>
}

export type IdbQueryResultRefs<Q, S extends IdbSchema = IdbRegisteredSchema> = QueryRefs<Q, S>
export type IdbQueryResultData<Q, S extends IdbSchema = IdbRegisteredSchema> = IdbQueryData<Q, S>
export type IdbQueryResultState<Q, S extends IdbSchema = IdbRegisteredSchema> = StateOf<QueryRefs<Q, S>>
export type IdbQueryResult<Q, S extends IdbSchema = IdbRegisteredSchema> = IdbResult<QueryRefs<Q, S>>

type InfiniteRefs<Q, S extends IdbSchema> = {
  isLoading: Ref<boolean>
  error: Ref<{ message: string } | undefined>
  canLoadNextPage: Ref<boolean>
} & {
  [K in keyof IdbQueryData<Q, S>]: Ref<IdbQueryData<Q, S>[K]>
}

export type IdbInfiniteQueryResult<Q, S extends IdbSchema = IdbRegisteredSchema>
  = IdbResult<InfiniteRefs<Q, S>> & { loadNextPage: () => void }

interface AuthRefs {
  isLoading: Ref<boolean>
  user: Ref<IdbAuthUser | undefined>
  error: Ref<{ message: string } | undefined>
}
export type IdbAuthResultRefs = AuthRefs
export type IdbAuthResultState = StateOf<AuthRefs>
export type IdbAuthResult = IdbResult<AuthRefs>

interface ConnectionRefs { status: Ref<IdbConnectionStatus> }
export type IdbConnectionResult = IdbResult<ConnectionRefs>

interface LocalIdRefs { localId: Ref<string | null> }
export type IdbLocalIdResult = IdbResult<LocalIdRefs>

export interface IdbUserOptions {
  /** Type `user` as present and treat a missing user as a dev-time error. */
  requireUser?: boolean
}
