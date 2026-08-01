/**
 * The one validation surface — applied by `q`, `defineQuery`, and every
 * query-accepting API on `/vue` and `/admin`.
 *
 * `IdbValidQuery<Q, S>` is an intersection of two arms:
 *
 * 1. the input-independent authoring shape (`IdbQuery<S>`, `types.ts`) —
 *    completions and structural/value checking;
 * 2. an input-mapped arm that re-walks the *user's* keys and types each
 *    violation as an `IDBDUXERR_*` message string, so the error lands on the
 *    offending key and carries an actionable, stable-coded message.
 *
 * Valid positions in arm 2 resolve to `unknown` (the intersection identity),
 * so it adds nothing where the query is fine.
 *
 * The `IDBDUXERR_*` codes: ROOT_KEY_UNKNOWN, NESTED_KEY_UNKNOWN, OPTION_UNKNOWN,
 * OPTION_TOP_LEVEL_ONLY, WHERE_KEY_UNKNOWN, WHERE_VALUE_TYPE,
 * WHERE_OPERATOR_INVALID (lives in the ops shape, `types.ts`),
 * ORDER_KEY_INVALID, RESULT_KEY_RESERVED, M_LABEL_COLLISION,
 * M_TRANSFORM_UNKNOWN, M_INDEXBY_NOT_UNIQUE, M_GROUPBY_NOT_PRIMITIVE.
 */
import type { DataAttrDef } from '@instantdb/core'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbNamespaceName } from '../schema/types.js'
import type { ReservedResultKey, ResolvedScopeKey } from './keys.js'
import type {
  FieldKeys,
  IdbQuery,
  IndexedFieldKeys,
  LinkLabels,
  LinkTarget,
  MaxHops,
  NextHop,
  UniqueFieldKeys,
  WhereKeyAttr,
  WireValue,
} from './types.js'

type Depth = readonly unknown[]

type TypeName<V> = V extends string
  ? 'string'
  : V extends number
    ? 'number'
    : V extends boolean
      ? 'boolean'
      : V extends Date
        ? 'date'
        : 'json'

// ==========
// $ validation

type SharedDollarKeys = 'where' | 'order' | 'fields' | 'limit' | '$only' | '$at' | '$as'
type PaginationKeys
  = | 'last'
    | 'first'
    | 'offset'
    | 'after'
    | 'afterInclusive'
    | 'before'
    | 'beforeInclusive'

type ValidDollar<
  Dollar,
  S extends IdbSchema,
  NS extends string,
  TopLevel extends boolean,
> = Dollar extends object
  ? {
      [K in keyof Dollar & string]: K extends 'where'
        ? ValidWhere<Dollar[K], S, NS>
        : K extends 'order'
          ? ValidOrder<Dollar[K], S, NS>
          : K extends SharedDollarKeys
            ? unknown
            : K extends PaginationKeys
              ? TopLevel extends true
                ? unknown
                : `IDBDUXERR_QUERY_OPTION_TOP_LEVEL_ONLY: ${K} is only available on top-level scopes`
              : `IDBDUXERR_QUERY_OPTION_UNKNOWN: ${K} is not a valid query option`
    }
  : unknown

// ==========
// where validation

type ValidWhere<W, S extends IdbSchema, NS extends string> = W extends object
  ? {
      [K in keyof W & string]: K extends 'and' | 'or'
        ? ValidWhereList<W[K], S, NS>
        : [WhereKeyAttr<S, NS, K>] extends [never]
            ? `IDBDUXERR_WHERE_KEY_UNKNOWN: ${K} is not a valid where key on ${NS}`
            : WhereKeyAttr<S, NS, K> extends DataAttrDef<infer V, any, any, any>
              ? ValidWhereValue<W[K], V, K>
              : `IDBDUXERR_WHERE_KEY_UNKNOWN: ${K} is not a valid where key on ${NS}`
    }
  : unknown

type ValidWhereList<L, S extends IdbSchema, NS extends string> = L extends readonly any[]
  ? { [I in keyof L]: ValidWhere<L[I], S, NS> }
  : unknown

type ValidWhereValue<Input, V, K extends string> = Input extends undefined
  ? unknown // $skip — the clause is dropped
  : Input extends WireValue<V>
    ? unknown
    : Input extends object
      ? unknown // operator objects are validated by the authoring shape
      : `IDBDUXERR_WHERE_VALUE_TYPE: Type '${TypeName<Input>}' is not assignable to field '${K}' of type ${TypeName<V>}`

// ==========
// order validation

type ValidOrder<O, S extends IdbSchema, NS extends string> = O extends object
  ? {
      [K in keyof O & string]: K extends IndexedFieldKeys<S, NS> | 'serverCreatedAt'
        ? unknown
        : `IDBDUXERR_ORDER_KEY_INVALID: ${K} is not orderable — order accepts indexed fields and serverCreatedAt`
    }
  : unknown

// ==========
// $m validation

type ValidM<
  M,
  S extends IdbSchema,
  NS extends string,
  OwnKey extends string,
> = M extends object
  ? {
      [Label in keyof M & string]: Label extends OwnKey
        ? `IDBDUXERR_M_LABEL_COLLISION: ${Label} collides with the scope's own result key`
        : ValidMTransform<M[Label], S, NS>
    }
  : unknown

type ValidMTransform<T, S extends IdbSchema, NS extends string> = T extends object
  ? {
      [K in keyof T & string]: K extends 'indexBy'
        ? T[K] extends UniqueFieldKeys<S, NS> | 'id'
          ? unknown
          : `IDBDUXERR_M_INDEXBY_NOT_UNIQUE: indexBy requires a unique field on ${NS}`
        : K extends 'groupBy'
          ? T[K] extends FieldKeys<S, NS>
            ? unknown
            : `IDBDUXERR_M_GROUPBY_NOT_PRIMITIVE: groupBy requires a string, number, or boolean field on ${NS}`
          : K extends 'at'
            ? unknown
            : `IDBDUXERR_M_TRANSFORM_UNKNOWN: ${K} is not a valid $m transform — use indexBy, groupBy, or at`
    }
  : unknown

// ==========
// node + query validation

type ValidNode<
  Node,
  S extends IdbSchema,
  NS extends string,
  ParentNS extends string | null,
  Key extends string,
  D extends Depth,
  TopLevel extends boolean,
> = Node extends object
  ? {
      [K in keyof Node & string]: K extends '$'
        ? ValidDollar<Node[K], S, NS, TopLevel>
        : K extends '$m'
          ? ValidM<Node[K], S, NS, ResolvedScopeKey<S, ParentNS, Key, Node>>
          : K extends LinkLabels<S, NS>
            ? ValidNode<Node[K], S, LinkTarget<S, NS, K>, NS, K, NextHop<D>, false>
            : D['length'] extends MaxHops
              ? unknown
              : `IDBDUXERR_QUERY_NESTED_KEY_UNKNOWN: ${K} is not a valid nested key on ${NS}`
    }
  : unknown

// ==========
// result-key collision — a top-level output key that would clash with a hook
// result field (`isLoading`, `error`, `refs`, `state`, …). Catches `$as` to a
// reserved name and singularization that lands on one (e.g. `states` → `state`)
// alike, because both flow through `ResolvedScopeKey`. Nested scopes can't
// collide, so only the top level is checked.

type TopMLabels<Node> = Node extends { $m: infer M } ? keyof M & string : never

type ReservedScopeMsg<
  S extends IdbSchema,
  Key extends string,
  Node,
> = ResolvedScopeKey<S, null, Key, Node> extends ReservedResultKey
  ? `IDBDUXERR_RESULT_KEY_RESERVED: result key '${ResolvedScopeKey<S, null, Key, Node> & string}' is reserved — it clashes with a hook result field; rename this scope`
  : [Extract<TopMLabels<Node>, ReservedResultKey>] extends [never]
      ? false
      : `IDBDUXERR_RESULT_KEY_RESERVED: $m label '${Extract<TopMLabels<Node>, ReservedResultKey>}' is reserved — it clashes with a hook result field; choose another label`

/**
 * The per-call validating type. Use as a self-referential constraint:
 * `<Q extends IdbValidQuery<Q, S>>(query: Q)`.
 */
export type IdbValidQuery<Q, S extends IdbSchema> = IdbQuery<S> & {
  [K in keyof Q & string]: K extends IdbNamespaceName<S>
    ? ReservedScopeMsg<S, K, Q[K]> extends infer Msg extends string
      ? Msg
      : ValidNode<Q[K], S, K, null, K, [], true>
    : `IDBDUXERR_QUERY_ROOT_KEY_UNKNOWN: ${K} is not a valid top-level namespace`
}
