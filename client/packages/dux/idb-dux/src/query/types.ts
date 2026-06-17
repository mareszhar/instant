/**
 * The query-domain types: the authoring shape (`IdbQuery` and its node
 * types — also the completion source for `q`/`useQuery` literals), the
 * type-level shaping mirror (`IdbQueryData`, `IdbQueryEntity`), and the
 * renamed official types (`IdbQueryPageInfo`, `IdbQueryOptions`, …).
 */
import type {
  Cursor,
  DataAttrDef,
  PageInfoResponse,
  ResolveAttrs,
} from '@instantdb/core'
import type { IdbSchema } from '../schema/defineSchema.js'
import type {
  AttrsOf,
  AttrValue,
  FieldKeys,
  IndexedFieldKeys,
  LinkCardinality,
  LinkLabels,
  LinkTarget,
  PrimitiveFieldKeys,
  UniqueFieldKeys,
  WireValue,
} from '../schema/fields.js'
import type { IdbEnumFieldMarker } from '../schema/namespace.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbNamespaceName } from '../schema/types.js'
import type { Expand, UnionToIntersection } from '../schema/util.js'
import type { HasPick, ResolvedScopeKey } from './keys.js'

export type {
  FieldKeys,
  IndexedFieldKeys,
  LinkLabels,
  LinkTarget,
  UniqueFieldKeys,
  WireValue,
} from '../schema/fields.js'

// ==========
// hop counting — validation and completions stop at 3 hops (matches core)

type Depth = readonly unknown[]
export type MaxHops = 3
export type NextHop<D extends Depth> = D['length'] extends MaxHops ? D : [...D, unknown]

// ==========
// where authoring

/**
 * The operator object for one field. Every operator is present so the
 * completion list and the diagnostic are both intentional: operators the
 * field doesn't support are typed as the `QERR_*` message explaining why.
 */
export interface IdbWhereOps<V, _IsRequired, IsIndexed> {
  $in?: readonly WireValue<V>[]
  $not?: WireValue<V>
  $ne?: WireValue<V>
  $gt?: ComparableValue<V, IsIndexed, '$gt'>
  $lt?: ComparableValue<V, IsIndexed, '$lt'>
  $gte?: ComparableValue<V, IsIndexed, '$gte'>
  $lte?: ComparableValue<V, IsIndexed, '$lte'>
  $like?: StringPattern<V, IsIndexed, '$like'>
  $ilike?: StringPattern<V, IsIndexed, '$ilike'>
  $isNull?: boolean
}

type ComparableValue<V, IsIndexed, Op extends string> = [V] extends [
  string | number | boolean | Date,
]
  ? IsIndexed extends true
    ? WireValue<V>
    : `QERR_WHERE_OPERATOR_INVALID: Operator ${Op} is only available for indexed fields with a checked type.`
  : `QERR_WHERE_OPERATOR_INVALID: Operator ${Op} is only available for indexed fields with a checked type.`

type StringPattern<V, IsIndexed, Op extends string> = [V] extends [string]
  ? IsIndexed extends true
    ? string
    : `QERR_WHERE_OPERATOR_INVALID: Operator ${Op} is only available for indexed string fields.`
  : `QERR_WHERE_OPERATOR_INVALID: Operator ${Op} is only available for indexed string fields.`

type FieldWhereValue<A> = A extends DataAttrDef<infer V, infer R, infer I, any>
  ? WireValue<V> | IdbWhereOps<V, R, I> | undefined
  : never

type IdAttr = DataAttrDef<string, false, true, true>

/**
 * The where shape: fields, `id`, link labels (matching the linked entity's
 * id), linked dot-paths up to 3 hops, and `and`/`or`. `undefined` values
 * (`$skip`) drop the clause.
 *
 * Completions are enumerated, not just validated: every dot-path the cursor
 * could complete is a key here, so `where: { ⌶ }` suggests `memberships`,
 * `memberships.user`, and `memberships.user.email` alike. The value type for
 * each path is resolved by `WhereKeyAttr` (a link leaf matches the linked
 * entity's id; a field leaf takes its own type).
 */
export type IdbWhereShape<S extends IdbSchema, NS extends string> = {
  [F in FieldKeys<S, NS>]?: FieldWhereValue<AttrsOf<S, NS>[F]>
} & {
  [L in LinkLabels<S, NS>]?: FieldWhereValue<IdAttr>
} & {
  [P in WhereDotPaths<S, NS>]?: FieldWhereValue<WhereKeyAttr<S, NS, P>>
} & {
  id?: FieldWhereValue<IdAttr>
  and?: readonly IdbWhereShape<S, NS>[]
  or?: readonly IdbWhereShape<S, NS>[]
}

/**
 * A where leaf on a linked namespace: any field, any link label (a bare link
 * filters on the linked id), or `id`. A link label as a leaf is what lets a
 * dot-path stop on a relationship — e.g. `memberships.user`.
 */
type WhereLeaf<S extends IdbSchema, NS extends string>
  = FieldKeys<S, NS> | LinkLabels<S, NS> | 'id'

/**
 * Linked dot-paths for `where`, hops 2 and 3 (hop 1 — fields, `id`, link
 * labels — are direct keys on the shape above). Each non-terminal segment is
 * a link label; the terminal is any `WhereLeaf`. Bounded at 3 hops by
 * construction (the fixed depth policy — [dux-spec-root.md §3.3]).
 */
type WhereDotPaths<S extends IdbSchema, NS extends string> = {
  [L1 in LinkLabels<S, NS>]:
    | `${L1}.${WhereLeaf<S, LinkTarget<S, NS, L1>>}`
    | {
      [L2 in LinkLabels<S, LinkTarget<S, NS, L1>>]: `${L1}.${L2}.${WhereLeaf<
        S,
        LinkTarget<S, LinkTarget<S, NS, L1>, L2>
      >}`
    }[LinkLabels<S, LinkTarget<S, NS, L1>>]
}[LinkLabels<S, NS>]

/** Resolve the attr def a where key addresses — fields, id, labels, dot-paths ≤ 3 hops. */
export type WhereKeyAttr<
  S extends IdbSchema,
  NS extends string,
  K extends string,
  D extends Depth = [],
> = K extends FieldKeys<S, NS>
  ? AttrsOf<S, NS>[K]
  : K extends 'id'
    ? IdAttr
    : K extends `${infer L}.${infer Rest}`
      ? L extends LinkLabels<S, NS>
        ? D['length'] extends MaxHops
          ? never
          : WhereKeyAttr<S, LinkTarget<S, NS, L>, Rest, NextHop<D>>
        : never
      : K extends LinkLabels<S, NS>
        ? IdAttr
        : never

// ==========
// order, fields, $m authoring

/** Direct indexed fields and `serverCreatedAt` — ordering never traverses links. */
export type IdbOrderShape<S extends IdbSchema, NS extends string> = {
  [K in IndexedFieldKeys<S, NS> | 'serverCreatedAt']?: 'asc' | 'desc'
}

/** The `fields` array type for a namespace. */
export type IdbQueryFields<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = (FieldKeys<S, NS> | 'id')[]

/**
 * One `$m` transform (its result type is `MValue`):
 * - `indexBy` — a unique field (or `id`); a record keyed by the field's value
 *   type, looked-up entries possibly absent
 * - `groupBy` — a primitive field; a record keyed by the field's value type,
 *   each bucket narrowed to its key (present for a runtime-enum/boolean field,
 *   optional otherwise)
 * - `at` — a position (negative from the end); yields `Entity | undefined`
 */
export type IdbMTransform<S extends IdbSchema, NS extends string>
  = | { indexBy: UniqueFieldKeys<S, NS> | 'id' }
    | { groupBy: PrimitiveFieldKeys<S, NS> }
    | { at: number }

export type IdbMBlock<S extends IdbSchema, NS extends string> = Record<
  string,
  IdbMTransform<S, NS>
>

// ==========
// the authoring shape

interface IdbDuxDollarKeys {
  /** Coerce this scope to `Entity | undefined` and singularize its key. */
  $only?: true
  /** Pick the element at this position (negative from the end); singularizes the key. */
  $at?: number
  /** Rename this scope's result key explicitly — always wins. */
  $as?: string
}

interface IdbPaginationKeys {
  last?: number
  first?: number
  offset?: number
  after?: Cursor
  afterInclusive?: boolean
  before?: Cursor
  beforeInclusive?: boolean
}

export type IdbDollar<
  S extends IdbSchema,
  NS extends string,
  TopLevel extends boolean,
> = {
  where?: IdbWhereShape<S, NS>
  order?: IdbOrderShape<S, NS>
  fields?: readonly (FieldKeys<S, NS> | 'id')[]
  limit?: number
} & IdbDuxDollarKeys
& (TopLevel extends true ? IdbPaginationKeys : {})

/** One scope of a query: `$`, `$m`, and nested link labels (3 hops, then open). */
export type IdbQueryNode<
  S extends IdbSchema,
  NS extends string,
  D extends Depth = [],
  TopLevel extends boolean = false,
> = D['length'] extends MaxHops
  ? Record<string, any>
  : {
    $?: IdbDollar<S, NS, TopLevel>
    $m?: IdbMBlock<S, NS>
  } & {
    [L in LinkLabels<S, NS>]?: IdbQueryNode<S, LinkTarget<S, NS, L>, NextHop<D>>
  }

/**
 * The valid-query-object type — handy for function params. Authoring
 * completions for `q`/`useQuery` literals come from this shape; per-call
 * validation is `IdbValidQuery` (`validation.ts`).
 */
export type IdbQuery<S extends IdbSchema = IdbRegisteredSchema> = {
  [NS in IdbNamespaceName<S>]?: IdbQueryNode<S, NS, [], true>
}

/** The subquery shape for one namespace — what `IdbQueryEntity` accepts. */
export type IdbQuerySubquery<
  NS extends IdbNamespaceName<S>,
  S extends IdbSchema = IdbRegisteredSchema,
> = IdbQueryNode<S, NS>

// ==========
// the shaping mirror — must agree with shapeResult.ts by construction

type EntityFields<S extends IdbSchema, NS extends string, Node> = Node extends {
  $: { fields: infer F extends readonly string[] }
}
  ? Pick<
    ResolveAttrs<S['entities'], NS, false>,
      Exclude<F[number], 'id'> & keyof ResolveAttrs<S['entities'], NS, false>
  >
  : ResolveAttrs<S['entities'], NS, false>

type ChildKeys<Node> = Exclude<keyof Node & string, '$' | '$m'>

type ShapedChildren<S extends IdbSchema, NS extends string, Node> = {
  [L in ChildKeys<Node> as L extends LinkLabels<S, NS>
    ? ResolvedScopeKey<S, NS, L, Node[L]>
    : never]: L extends LinkLabels<S, NS> ? ChildData<S, NS, L, Node[L]> : never
}

type ChildData<
  S extends IdbSchema,
  NS extends string,
  L extends LinkLabels<S, NS>,
  Node,
> = HasPick<Node> extends true
  ? ShapedEntity<S, LinkTarget<S, NS, L>, Node> | undefined
  : LinkCardinality<S, NS, L> extends 'one'
    ? ShapedEntity<S, LinkTarget<S, NS, L>, Node> | undefined
    : ShapedEntity<S, LinkTarget<S, NS, L>, Node>[]

/**
 * The runtime record key for a field value — object keys are strings, so a
 * boolean groups under `'true'`/`'false'` (what `String(value)` produces); a
 * branded number keeps its brand.
 */
type RecordKey<V> = V extends boolean ? `${V}` : V extends string | number ? V : never

/** `E` with its grouped field narrowed to the one value of its group. */
type NarrowEntity<E, K extends string, Val> = Expand<Omit<E, K> & { [P in K]: Val }>

/**
 * Whether a value type is a *full* primitive (`string`/`number`/`boolean`)
 * rather than a finite literal union. Boolean counts as full: its universe is
 * its two literals, which the runtime always materializes.
 */
type IsFullPrimitive<V>
  = [string] extends [V] ? true
    : [number] extends [V] ? true
        : [boolean] extends [V] ? true
            : false

/** Whether a field declares its values at runtime (a runtime enum). */
type IsRuntimeEnum<Attr> = Attr extends IdbEnumFieldMarker ? true : false

/** The value type a `$m` key addresses — `id` is implicit, not in `attrs`. */
type MFieldValue<S extends IdbSchema, NS extends string, K extends string>
  = K extends 'id' ? string : AttrValue<AttrsOf<S, NS>[K]>

/** groupBy buckets — every value present, each entity narrowed to its key. */
type GroupsPresent<V, E, K extends string> = {
  [Val in V & (string | number | boolean) as RecordKey<Val>]: NarrowEntity<E, K, Val>[]
}

/** groupBy buckets — optional, since a value with no rows is genuinely absent. */
type GroupsMaybe<V, E, K extends string> = {
  [Val in V & (string | number | boolean) as RecordKey<Val>]?: NarrowEntity<E, K, Val>[]
}

/**
 * A *type-level enum* (`i.string<'a' | 'b'>()`) — finite keys the type can name
 * but the runtime can't pre-create, so its groupBy buckets are optional. A
 * runtime enum is runtime-backed, and a full primitive is open or boolean — both
 * let `GroupsPresent` stand (known keys for a runtime enum/boolean, an index
 * signature for `string`/`number`).
 */
type IsPhantomUnion<Attr, V>
  = IsRuntimeEnum<Attr> extends true ? false
    : IsFullPrimitive<V> extends true ? false
      : true

/**
 * `groupBy` keyed by the field's value type, each bucket narrowed to its key.
 * Buckets are guaranteed present (never `undefined`) when the runtime can
 * enumerate the field's universe — a runtime enum's declared values, or a
 * boolean's two literals. A type-level enum can't be enumerated, so its buckets
 * are optional; a full `string`/`number` is an index signature (`| undefined`
 * under `noUncheckedIndexedAccess` — the honest open keyspace).
 */
type GroupByValue<S extends IdbSchema, NS extends string, K extends string, E>
  = MFieldValue<S, NS, K> extends infer V
    ? IsPhantomUnion<AttrsOf<S, NS>[K], V> extends true
      ? GroupsMaybe<V, E, K>
      : GroupsPresent<V, E, K>
    : never

/** `indexBy` keyed by the field's value type; a looked-up entry may be absent. */
type IndexByValue<S extends IdbSchema, NS extends string, K extends string, E>
  = MFieldValue<S, NS, K> extends infer V
    ? IsFullPrimitive<V> extends true
      ? Record<RecordKey<V>, E>
      : Partial<Record<RecordKey<V>, E>>
    : never

type MValue<S extends IdbSchema, NS extends string, T, E>
  = T extends { indexBy: infer K extends string }
    ? IndexByValue<S, NS, K, E>
    : T extends { groupBy: infer K extends string }
      ? GroupByValue<S, NS, K, E>
      : T extends { at: number }
        ? E | undefined
        : never

/** The `$m` sibling keys a scope contributes beside its own result key. */
type MSiblings<S extends IdbSchema, NS extends string, Node> = Node extends {
  $m: infer M
}
  ? { -readonly [Label in keyof M]: MValue<S, NS, M[Label], ShapedEntity<S, NS, Node>> }
  : {}

type ChildrenMSiblings<S extends IdbSchema, NS extends string, Node> = [
  ChildKeys<Node>,
] extends [never]
  ? {}
  : UnionToIntersection<
    {
      [L in ChildKeys<Node>]: L extends LinkLabels<S, NS>
        ? MSiblings<S, LinkTarget<S, NS, L>, Node[L]>
        : {}
    }[ChildKeys<Node>]
  >

type ShapedEntity<S extends IdbSchema, NS extends string, Node> = Expand<
  { id: string } & EntityFields<S, NS, Node>
  & ShapedChildren<S, NS, Node>
  & ChildrenMSiblings<S, NS, Node>
>

/**
 * An entity shaped by query syntax — `$` and `$m` fully supported, including
 * `$: { fields }`.
 */
export type IdbQueryEntity<
  NS extends IdbNamespaceName<S>,
  Subquery = {},
  S extends IdbSchema = IdbRegisteredSchema,
> = ShapedEntity<S, NS, Subquery>

type TopScopeData<S extends IdbSchema, NS extends string, Node>
  = HasPick<Node> extends true
    ? ShapedEntity<S, NS, Node> | undefined
    : ShapedEntity<S, NS, Node>[]

type TopMSiblings<Q, S extends IdbSchema> = [keyof Q] extends [never]
  ? {}
  : UnionToIntersection<
    {
      [K in keyof Q & string]: K extends IdbNamespaceName<S>
        ? MSiblings<S, K, Q[K]>
        : {}
    }[keyof Q & string]
  >

/**
 * The shaped data for a query — the exact shape `useQuery`, `queryOnce`, and
 * `adminDb.query` deliver: normalized arrays, `$only`/`$at` coercion,
 * singularized/`$as` keys, `$m` siblings.
 */
export type IdbQueryData<Q, S extends IdbSchema = IdbRegisteredSchema> = Expand<
  {
    [K in keyof Q & string as K extends IdbNamespaceName<S>
      ? ResolvedScopeKey<S, null, K, Q[K]>
      : never]: K extends IdbNamespaceName<S> ? TopScopeData<S, K, Q[K]> : never
  } & TopMSiblings<Q, S>
>

// ==========
// options + pageInfo

type NamespaceRuleParams<RP> = RP extends Record<string, DataAttrDef<any, any, any, any>>
  ? { [K in keyof RP]?: AttrValue<RP[K]> }
  : {}

/**
 * Every rule param declared in the schema, merged and optional — the
 * query-level companion to the per-namespace tx typing.
 */
export type IdbSchemaRuleParams<S extends IdbSchema = IdbRegisteredSchema> = Expand<
  UnionToIntersection<
    {
      [NS in keyof S['$dux']['namespaces']]: NamespaceRuleParams<
        S['$dux']['namespaces'][NS]['ruleParams']
      >
    }[keyof S['$dux']['namespaces']]
  >
>

/** Per-call query options — `ruleParams` typed from the schema. */
export interface IdbQueryOptions<S extends IdbSchema = IdbRegisteredSchema> {
  ruleParams: IdbSchemaRuleParams<S>
}

/** Pagination cursors, keyed by the query's top-level namespace keys. */
export type IdbQueryPageInfo<Q = Record<string, unknown>> = PageInfoResponse<Q>
