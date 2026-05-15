import type {
  Cursor,
  DataAttrDef,
  InstantSchemaDef,
  Order,
} from '@instantdb/core'

type PrevDepth = [never, 0, 1, 2, 3, 4, 5]

type NonEmpty<T extends object> = {
  [K in keyof T]-?: Required<Pick<T, K>> & Partial<Omit<T, K>>
}[keyof T]

type StrictStringKeyOf<T> = Extract<{
  [K in keyof T]-?:
  string extends K
    ? never
    : number extends K
      ? never
      : symbol extends K
        ? never
        : K
}[keyof T], string>

type PreferredStringKeyOf<T> = StrictStringKeyOf<T>

type SchemaEntities<S extends InstantSchemaDef<any, any, any>>
  = S extends InstantSchemaDef<infer E, any, any> ? E : never

type EntityName<S extends InstantSchemaDef<any, any, any>>
  = PreferredStringKeyOf<SchemaEntities<S>>

type AttrDefsFor<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = SchemaEntities<S>[E]['attrs']

type AttrName<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = PreferredStringKeyOf<AttrDefsFor<S, E>>

type LinkName<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = PreferredStringKeyOf<SchemaEntities<S>[E]['links']>

type LinkedEntityName<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  L extends LinkName<S, E>,
> = SchemaEntities<S>[E]['links'][L]['entityName'] & EntityName<S>

type AttrRequired<A extends DataAttrDef<any, any, any, boolean>>
  = A extends DataAttrDef<any, infer R, any, boolean> ? R : false

type AttrIndexed<A extends DataAttrDef<any, any, any, boolean>>
  = A extends DataAttrDef<any, any, infer I, boolean> ? I : false

type AttrValue<A extends DataAttrDef<any, any, any, boolean>>
  = A extends DataAttrDef<infer V, any, any, boolean> ? V : unknown

type IsAny<T> = 0 extends (1 & T) ? true : false

type ScalarForAttr<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrValue<A>> extends true
    ? string | number | boolean | Date | null
    : AttrValue<A> extends Date
      ? Date | number | string
      : AttrValue<A>

interface EqualityOperators<A extends DataAttrDef<any, any, any, boolean>> {
  in?: ScalarForAttr<A>[]
  $in?: ScalarForAttr<A>[]
  $not?: ScalarForAttr<A>
  $ne?: ScalarForAttr<A>
}

type NullableOperator<A extends DataAttrDef<any, any, any, boolean>>
  = AttrRequired<A> extends false ? { $isNull?: boolean } : {}

type StringOperators<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrValue<A>> extends true
    ? { $like?: string }
    : ScalarForAttr<A> extends string ? { $like?: string } : {}

type IndexedComparisonOperators<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrIndexed<A>> extends true
    ? {}
    : AttrIndexed<A> extends true
      ? {
          $gt?: ScalarForAttr<A>
          $lt?: ScalarForAttr<A>
          $gte?: ScalarForAttr<A>
          $lte?: ScalarForAttr<A>
        }
      : {}

type IndexedStringOperators<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrIndexed<A>> extends true
    ? {}
    : AttrIndexed<A> extends true
      ? IsAny<AttrValue<A>> extends true
        ? { $ilike?: string }
        : ScalarForAttr<A> extends string
          ? { $ilike?: string }
          : {}
      : {}

type OperatorObject<A extends DataAttrDef<any, any, any, boolean>> = NonEmpty<
  EqualityOperators<A>
  & NullableOperator<A>
  & StringOperators<A>
  & IndexedComparisonOperators<A>
  & IndexedStringOperators<A>
>

type WhereValue<A extends DataAttrDef<any, any, any, boolean>>
  = | ScalarForAttr<A>
    | OperatorObject<A>

type IdAttrDef = DataAttrDef<string, false, true, boolean>
type LooseWhereValue = WhereValue<DataAttrDef<any, false, true, boolean>>

type DotPathKeys<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  Depth extends number,
> = Depth extends 0
  ? never
  : {
      [L in LinkName<S, E>]:
        | `${L}`
        | `${L}.id`
        | `${L}.${AttrName<S, LinkedEntityName<S, E, L>>}`
        | `${L}.${DotPathKeys<S, LinkedEntityName<S, E, L>, PrevDepth[Depth]>}`
    }[LinkName<S, E>]

type DotPathKeysForHints<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  Depth extends number,
  PreviousEntity extends EntityName<S> | never = never,
> = Depth extends 0
  ? never
  : {
      [L in LinkName<S, E>]:
      LinkedEntityName<S, E, L> extends PreviousEntity
        ? never
        : | `${L}`
          | `${L}.id`
          | `${L}.${AttrName<S, LinkedEntityName<S, E, L>>}`
          | `${L}.${DotPathKeysForHints<S, LinkedEntityName<S, E, L>, PrevDepth[Depth], E>}`
    }[LinkName<S, E>]

type WhereHintPathKey<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = DotPathKeysForHints<S, E, 2>

type AnyWherePathKey<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = DotPathKeys<S, E, 5>

type LooseWherePathKey<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = Exclude<AnyWherePathKey<S, E>, WhereHintPathKey<S, E>>

type ResolvePathAttrDef<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  Path extends string,
> = Path extends 'id'
  ? IdAttrDef
  : Path extends AttrName<S, E>
    ? AttrDefsFor<S, E>[Path]
    : Path extends `${infer L}.${infer Rest}`
      ? L extends LinkName<S, E>
        ? Rest extends ''
          ? IdAttrDef
          : ResolvePathAttrDef<S, LinkedEntityName<S, E, L>, Rest>
        : never
      : Path extends LinkName<S, E>
        ? IdAttrDef
        : never

type WhereHintLeafKey<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
>
  = | AttrName<S, E>
    | 'id'
    | WhereHintPathKey<S, E>

interface WhereAuthoringOperatorObject {
  in?: unknown
  $in?: unknown
  $not?: unknown
  $ne?: unknown
  $isNull?: boolean
  $like?: string
  $ilike?: string
  $gt?: unknown
  $lt?: unknown
  $gte?: unknown
  $lte?: unknown
  [key: string]: unknown
}

type WhereAuthoringValue
  = string
    | number
    | boolean
    | Date
    | null
    | WhereAuthoringOperatorObject

type WhereObject<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = {
  [K in WhereHintLeafKey<S, E>]?: WhereAuthoringValue | undefined
} & {
  /**
   * Soft-cap authoring fallback: any extra key can still be typed, but strict
   * IntelliSense remains focused on practical 2-hop suggestions.
   */
  [key: string]: WhereAuthoringValue | WhereObject<S, E>[] | undefined
} & {
  and?: WhereObject<S, E>[] | undefined
  or?: WhereObject<S, E>[] | undefined
}

type FieldName<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
> = AttrName<S, E> | 'id'

type DollarQuery<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  TopLevel extends boolean,
> = {
  where?: WhereObject<S, E> | undefined
  fields?: FieldName<S, E>[] | undefined
  order?: Order<S, E> | undefined
  limit?: number | undefined
} & (TopLevel extends true
  ? {
      last?: number | undefined
      first?: number | undefined
      offset?: number | undefined
      after?: Cursor | undefined
      afterInclusive?: boolean | undefined
      before?: Cursor | undefined
      beforeInclusive?: boolean | undefined
    }
  : {})

type QueryNode<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  TopLevel extends boolean,
  Depth extends number = 2,
> = {
  $?: DollarQuery<S, E, TopLevel> | undefined
} & (Depth extends 0
  ? {
      [key: string]: unknown
    }
  : {
      [L in LinkName<S, E>]?: QueryNode<
        S,
        LinkedEntityName<S, E, L>,
        false,
        PrevDepth[Depth]
      >
    })

type TypedQuery<S extends InstantSchemaDef<any, any, any>> = {
  [E in EntityName<S>]?: QueryNode<S, E, true>
}

type Merge<T> = { [K in keyof T]: T[K] }

type UndefinedValueKeys<T extends object> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

type DefinedValueKeys<T extends object> = Exclude<keyof T, UndefinedValueKeys<T>>

type NormalizeUndefinedValues<T extends object> = Merge<
  { [K in DefinedValueKeys<T>]: T[K] }
  & { [K in UndefinedValueKeys<T>]?: Exclude<T[K], undefined> }
>

type NormalizeWhereNode<T> = T extends object
  ? NormalizeUndefinedValues<T>
  : T

type NormalizeDollarNode<T> = T extends { where?: infer W }
  ? Merge<Omit<T, 'where'> & {
    where?: W extends object ? NormalizeWhereNode<W> : W
  }>
  : T

type NormalizeDefinedQuery<Q> = Q extends object
  ? {
      [K in keyof Q]: K extends '$'
        ? NormalizeDollarNode<Q[K]>
        : Q[K] extends object
          ? NormalizeDefinedQuery<Q[K]>
          : Q[K]
    }
  : Q

export type DefinedQuery<Q> = NormalizeDefinedQuery<Q>

interface ValidationError<Message extends string> {
  readonly __error_message__: Message
}

type KnownWhereOperatorKey
  = | 'in'
    | '$in'
    | '$not'
    | '$ne'
    | '$isNull'
    | '$like'
    | '$ilike'
    | '$gt'
    | '$lt'
    | '$gte'
    | '$lte'

type ComparisonOperatorKey = '$gt' | '$lt' | '$gte' | '$lte'

type KeysOfObject<T>
  = T extends object ? Extract<keyof T, string> : never

type UnknownWhereOperatorKeys<V>
  = Exclude<KeysOfObject<V>, KnownWhereOperatorKey>

type HasAnyOperator<
  V extends object,
  Keys extends string,
> = [Extract<KeysOfObject<V>, Keys>] extends [never]
  ? false
  : true

type SupportsComparison<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrIndexed<A>> extends true
    ? true
    : AttrIndexed<A> extends true
      ? true
      : false

type SupportsStringLike<A extends DataAttrDef<any, any, any, boolean>>
  = IsAny<AttrValue<A>> extends true
    ? true
    : ScalarForAttr<A> extends string
      ? true
      : false

type SupportsIndexedILike<A extends DataAttrDef<any, any, any, boolean>>
  = SupportsComparison<A> extends true
    ? SupportsStringLike<A>
    : false

type ValidateComparisonOperatorUsage<
  A extends DataAttrDef<any, any, any, boolean>,
  E extends string,
  K extends string,
  V extends object,
> = HasAnyOperator<V, ComparisonOperatorKey> extends true
  ? SupportsComparison<A> extends true
    ? true
    : ValidationError<`QERR_WHERE_INDEX_REQUIRED: ${E}.${K} cannot use comparison operators ($gt/$gte/$lt/$lte). Mark the attribute as indexed to enable range filters.`>
  : true

type ValidateLikeOperatorUsage<
  A extends DataAttrDef<any, any, any, boolean>,
  E extends string,
  K extends string,
  V extends object,
> = HasAnyOperator<V, '$like'> extends true
  ? SupportsStringLike<A> extends true
    ? true
    : ValidationError<`QERR_WHERE_STRING_REQUIRED: ${E}.${K} cannot use $like. Use a string attribute or switch to a compatible operator.`>
  : true

type ValidateILikeOperatorUsage<
  A extends DataAttrDef<any, any, any, boolean>,
  E extends string,
  K extends string,
  V extends object,
> = HasAnyOperator<V, '$ilike'> extends true
  ? SupportsIndexedILike<A> extends true
    ? true
    : ValidationError<`QERR_WHERE_INDEXED_STRING_REQUIRED: ${E}.${K} cannot use $ilike. Use an indexed string attribute for case-insensitive search.`>
  : true

type ValidateWhereOperatorUsage<
  A extends DataAttrDef<any, any, any, boolean>,
  E extends string,
  K extends string,
  V extends object,
> = ValidateComparisonOperatorUsage<A, E, K, V> extends true
  ? ValidateLikeOperatorUsage<A, E, K, V> extends true
    ? ValidateILikeOperatorUsage<A, E, K, V>
    : ValidateLikeOperatorUsage<A, E, K, V>
  : ValidateComparisonOperatorUsage<A, E, K, V>

type ValidateOperatorObjectValue<
  A extends DataAttrDef<any, any, any, boolean>,
  E extends string,
  K extends string,
  V extends object,
> = UnknownWhereOperatorKeys<V> extends never
  ? ValidateWhereOperatorUsage<A, E, K, V> extends true
    ? V extends OperatorObject<A>
      ? V
      : ValidationError<`QERR_WHERE_VALUE_INVALID: ${E}.${K} has an invalid where value. Use a scalar or supported operator object.`>
    : ValidateWhereOperatorUsage<A, E, K, V>
  : ValidationError<`QERR_WHERE_OPERATOR_UNKNOWN: ${Extract<UnknownWhereOperatorKeys<V>, string>} is not supported for ${E}.${K}. Use one of in,$in,$not,$ne,$isNull,$like,$ilike,$gt,$gte,$lt,$lte.`>

type ValidateStrictWhereValue<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  K extends string,
  V,
> = ResolvePathAttrDef<S, E, K> extends infer A extends DataAttrDef<any, any, any, boolean>
  ? V extends undefined
    ? V
    : V extends ScalarForAttr<A>
      ? V
      : V extends object
        ? ValidateOperatorObjectValue<A, Extract<E, string>, K, V>
        : ValidationError<`QERR_WHERE_VALUE_INVALID: ${Extract<E, string>}.${K} has an invalid where value. Use a scalar or supported operator object.`>
  : ValidationError<`QERR_WHERE_VALUE_INVALID: ${Extract<E, string>}.${K} has an invalid where value. Use a scalar or supported operator object.`>

type ValidateWhereKeyValue<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  K extends string,
  V,
> = K extends 'and' | 'or'
  ? V extends ReadonlyArray<infer Item>
    ? ValidateWhereObject<S, E, Item>[] | undefined
    : ValidationError<`QERR_WHERE_GROUP_INVALID: ${K} must be an array of where clauses.`>
  : K extends WhereHintLeafKey<S, E>
    ? ValidateStrictWhereValue<S, E, K, V>
    : K extends LooseWherePathKey<S, E>
      ? V extends LooseWhereValue | undefined
        ? V
        : ValidationError<`QERR_WHERE_VALUE_INVALID: ${Extract<E, string>}.${K} has an invalid where value. Use a scalar or supported operator object.`>
      : ValidationError<`QERR_WHERE_KEY_UNKNOWN: ${K} is not a valid where key on ${Extract<E, string>}. Use attrs or linked dot-path attrs.`>

type ValidateWhereObject<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  W,
> = W extends object
  ? {
      [K in keyof W]: K extends string
        ? ValidateWhereKeyValue<S, E, K, W[K]>
        : ValidationError<'where keys must be strings.'>
    }
  : ValidationError<'where must be an object.'>

type ValidateDollarKeyValue<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  TopLevel extends boolean,
  K extends string,
  V,
> = K extends 'where'
  ? V extends undefined
    ? V
    : ValidateWhereObject<S, E, V>
  : K extends 'fields'
    ? V extends FieldName<S, E>[] | undefined
      ? V
      : ValidationError<`Invalid "$.fields" on "${Extract<E, string>}".`>
    : K extends 'order'
      ? V extends Order<S, E> | undefined
        ? V
        : ValidationError<`Invalid "$.order" on "${Extract<E, string>}".`>
      : K extends 'limit'
        ? V extends number | undefined
          ? V
          : ValidationError<`Invalid "$.limit" on "${Extract<E, string>}".`>
        : TopLevel extends true
          ? K extends 'last' | 'first' | 'offset'
            ? V extends number | undefined
              ? V
              : ValidationError<`Invalid "$.${K}" on "${Extract<E, string>}".`>
            : K extends 'after' | 'before'
              ? V extends Cursor | undefined
                ? V
                : ValidationError<`Invalid "$.${K}" on "${Extract<E, string>}".`>
              : K extends 'afterInclusive' | 'beforeInclusive'
                ? V extends boolean | undefined
                  ? V
                  : ValidationError<`QERR_QUERY_OPTION_INVALID: $.${K} on ${Extract<E, string>} has an invalid value type.`>
                : ValidationError<`QERR_QUERY_OPTION_UNKNOWN: $.${K} is not a valid query option on ${Extract<E, string>}.`>
          : ValidationError<`QERR_QUERY_OPTION_UNKNOWN: $.${K} is not a valid query option on ${Extract<E, string>}.`>

type ValidateDollarObject<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  TopLevel extends boolean,
  D,
> = D extends object
  ? {
      [K in keyof D]: K extends string
        ? ValidateDollarKeyValue<S, E, TopLevel, K, D[K]>
        : ValidationError<'$ keys must be strings.'>
    }
  : ValidationError<'$ must be an object.'>

type ValidateQueryNode<
  S extends InstantSchemaDef<any, any, any>,
  E extends EntityName<S>,
  TopLevel extends boolean,
  Node,
  Depth extends number = 2,
> = Node extends object
  ? {
      [K in keyof Node]: K extends '$'
        ? ValidateDollarObject<S, E, TopLevel, Node[K]>
        : Depth extends 0
          ? Node[K]
          : K extends LinkName<S, E>
            ? ValidateQueryNode<
              S,
              LinkedEntityName<S, E, K>,
              false,
              Node[K],
              PrevDepth[Depth]
            >
            : K extends string
              ? ValidationError<`QERR_QUERY_NESTED_KEY_UNKNOWN: ${K} is not a valid nested key on ${Extract<E, string>}.`>
              : ValidationError<'query keys must be strings.'>
    }
  : ValidationError<'query node must be an object.'>

type ValidateTypedQuery<
  S extends InstantSchemaDef<any, any, any>,
  Q,
> = Q extends object
  ? {
      [K in keyof Q]: K extends EntityName<S>
        ? ValidateQueryNode<S, K, true, Q[K], 2>
        : K extends string
          ? ValidationError<`QERR_QUERY_ROOT_KEY_UNKNOWN: ${K} is not a valid top-level key in q() query.`>
          : ValidationError<'query keys must be strings.'>
    }
  : ValidationError<'q() expects an object query.'>

export type TypedQueryForSchema<S extends InstantSchemaDef<any, any, any>>
  = TypedQuery<S>

export type ValidateTypedQueryForSchema<
  S extends InstantSchemaDef<any, any, any>,
  Q,
> = ValidateTypedQuery<S, Q>

export type QueryAuthoringInputForSchema<
  S extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<S>,
> = ValidateTypedQueryForSchema<S, Q> & Q

export type QueryAuthoringFactoryForSchema<
  S extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<S>,
> = () => null | QueryAuthoringInputForSchema<S, Q>

export type QueryAuthoringSourceForSchema<
  S extends InstantSchemaDef<any, any, any>,
  Q extends TypedQueryForSchema<S>,
>
  = | null
    | QueryAuthoringInputForSchema<S, Q>
    | QueryAuthoringFactoryForSchema<S, Q>

export interface DefineQueryHelper<S extends InstantSchemaDef<any, any, any>> {
  <const Q extends TypedQuery<S>>(query: QueryAuthoringInputForSchema<S, Q>): DefinedQuery<Q>
  where: <E extends EntityName<S>, const W extends WhereObject<S, E>>(
    entity: E,
    where: ValidateWhereObject<S, E, W> & W,
  ) => W
}

/**
 * Identity helper that improves query-authoring IntelliSense while preserving
 * the regular plain-object query shape expected by db.useQuery().
 */
export function defineQuery<
  S extends InstantSchemaDef<any, any, any>,
>(): DefineQueryHelper<S> {
  const helper = ((query: unknown) => query) as DefineQueryHelper<S>
  helper.where = (_entity, where) => where
  return helper
}
