import type { AttrsDefs, DataAttrDef, EntityDef as EntityDefType } from '@instantdb/core'
import { i as officialI } from '@instantdb/core'
import { room } from './room.js'

/**
 * The dux metadata a namespace declaration carries into `defineSchema`,
 * where it is hoisted onto the schema's own (non-enumerable) `$dux` meta.
 */
export interface IdbNamespaceMeta<
  Singular extends string | undefined = string | undefined,
  RuleParams extends AttrsDefs | undefined = AttrsDefs | undefined,
> {
  readonly singular: Singular
  readonly ruleParams: RuleParams
}

/**
 * What `i.namespace()` returns: a real official `EntityDef` (so the schema's
 * enumerable projection stays exactly what Instant's tooling consumes), with
 * the dux metadata riding along non-enumerably under `$dux`.
 */
export type IdbNamespaceDef<
  Fields extends AttrsDefs = AttrsDefs,
  Singular extends string | undefined = string | undefined,
  RuleParams extends AttrsDefs | undefined = AttrsDefs | undefined,
> = EntityDefType<Fields, {}, void> & {
  readonly $dux: IdbNamespaceMeta<Singular, RuleParams>
}

/**
 * The constraint for `defineSchema`'s `namespaces` block. Deliberately the
 * official* `EntityDef` shape, without the `$dux` slot: a generic constraint
 * doubles as the contextual type of the config literal, and a contextual
 * `$dux: IdbNamespaceMeta<any, any>` would poison `i.namespace`'s inference
 * (literal singulars widen, ruleParams collapse to `any`). The meta is
 * extracted conditionally where it's needed instead.
 */
export type IdbNamespacesDef = Record<string, EntityDefType<any, any, any>>

/**
 * The validation arm for `fields`/`ruleParams` (and room `presence`/`topics`):
 * non-builder members carry the diagnostic on the offending key; valid members
 * contribute nothing.
 */
export type ValidFieldBuilders<F> = {
  [K in keyof F]: F[K] extends DataAttrDef<any, any, any, any>
    ? unknown
    : `DUXERR_SCHEMA_FIELD_INVALID: ${K & string} must be a field builder (i.string(), i.number(), …)`
}

/**
 * `Fields` and `RuleParams` are deliberately unconstrained: a generic's
 * constraint becomes the contextual type of the matching config property, and
 * an `AttrsDefs` context degrades unchained builder calls (a bare
 * `i.string()`) to `DataAttrDef<any, …>`. Validation rides in a parallel
 * intersection arm instead, and the return type re-tightens via `Extract`.
 */
export interface IdbNamespaceConfig<Fields, Singular, RuleParams> {
  /**
   * The singular form of the namespace name — the single source of truth for
   * auto-singularization of `$only`/`$at` result keys. Defaults to the
   * built-in English algorithm when omitted.
   */
  singular?: Singular
  /** The namespace's local data attributes. */
  fields: Fields & ValidFieldBuilders<Fields>
  /**
   * The namespace's rule params, declared once and typed end-to-end: in the
   * tx chain, in query options, and in perms.
   */
  ruleParams?: RuleParams & ValidFieldBuilders<RuleParams>
}

/**
 * The namespace constructor — the single home for everything that describes
 * a namespace: its fields, its singular name, and its rule params.
 *
 * @example
 *   workspaces: i.namespace({
 *     fields: { name: i.string().indexed() },
 *     ruleParams: { inviteCode: i.string() },
 *   }),
 */
function namespace<
  Fields,
  const Singular extends string | undefined = undefined,
  RuleParams = undefined,
>(
  config: IdbNamespaceConfig<Fields, Singular, RuleParams>,
): IdbNamespaceDef<
  Extract<Fields, AttrsDefs>,
  Singular,
  Extract<RuleParams, AttrsDefs | undefined>
> {
  const def = officialI.entity(config.fields as AttrsDefs) as IdbNamespaceDef<
    Extract<Fields, AttrsDefs>,
    Singular,
    Extract<RuleParams, AttrsDefs | undefined>
  >
  Object.defineProperty(def, '$dux', {
    value: { singular: config.singular, ruleParams: config.ruleParams },
    enumerable: false,
  })
  return def
}

/**
 * The marker a **runtime enum** carries: its declared values. A type-only
 * (phantom) enum — `i.string<'a' | 'b'>()` — narrows the type but records
 * nothing, so `groupBy` can only promise an optional bucket per value; a runtime
 * enum lets the runtime *see* the universe and pre-create a present, narrowed
 * bucket for every value. The values double as the type-level detector (their
 * presence *is* the marker), so there is no separate phantom flag.
 *
 * Docs: [dux-spec-root.md §2.6](../../docs/dux-spec-root.md#26-enum-fields), §4.4
 */
export interface IdbEnumFieldMarker {
  readonly duxEnumValues: readonly (string | number)[]
}

/**
 * A **runtime enum** field def. It *is* an official `DataAttrDef` — every core
 * type utility and the wire projection treat it as one — that additionally
 * carries its declared values and re-types its builder methods so the values
 * survive `.indexed()`/`.optional()`/`.unique()` chaining. (`DataAttrDef` is a
 * type-only export from core, so this is a typed view over a tagged instance,
 * not a subclass.)
 *
 * The override methods come first so they win call resolution; the full
 * `DataAttrDef` is intersected in so `V` stays inferrable (it is phantom in
 * `DataAttrDef` — present only in method returns) and the type is still a
 * `DataAttrDef` to every core utility.
 */
export type IdbEnumAttrDef<
  V,
  R extends boolean,
  I extends boolean,
  U extends boolean = false,
> = {
  optional: () => IdbEnumAttrDef<V, false, I, U>
  unique: () => IdbEnumAttrDef<V, R, I, true>
  indexed: () => IdbEnumAttrDef<V, R, true, U>
  clientRequired: () => IdbEnumAttrDef<V, true, I, U>
} & IdbEnumFieldMarker & DataAttrDef<V, R, I, U>

type AnyDataAttrDef = DataAttrDef<any, any, any, any>

const CHAIN_METHODS = ['optional', 'unique', 'indexed', 'clientRequired'] as const

/**
 * Tag a field def as a runtime enum with its declared values. The values ride
 * along non-enumerably (so `JSON.stringify(schema)` — what CLI push and platform
 * validation consume — stays wire-clean), and each builder method is wrapped to
 * re-tag its result, because core's methods construct a fresh def that would
 * otherwise drop the tag. `shapeResult` reads `duxEnumValues` to pre-create
 * groups; `definePerms`' `.conforms()` will read it to enforce membership.
 */
function markEnum<T extends AnyDataAttrDef>(def: T, values: readonly (string | number)[]): T {
  Object.defineProperty(def, 'duxEnumValues', { value: values, enumerable: false, configurable: true })
  for (const method of CHAIN_METHODS) {
    const original = (def as Record<string, unknown>)[method]
    if (typeof original !== 'function')
      continue
    Object.defineProperty(def, method, {
      value: (...args: unknown[]) => markEnum(original.apply(def, args) as AnyDataAttrDef, values),
      enumerable: false,
      configurable: true,
      writable: true,
    })
  }
  return def
}

/**
 * A string field. Pass a values array (`i.string(['a', 'b'])`) to declare a
 * **runtime enum** — the union is inferred *and* recorded at runtime, so
 * `groupBy` yields guaranteed, narrowed, never-`undefined` groups. The
 * type-level form (`i.string<'a' | 'b'>()`) narrows the type only, and accepts
 * any type — a branded or template string, a union — not just enums.
 */
function string<Type extends string = string>(): DataAttrDef<Type, true, false>
function string<const E extends string>(values: readonly E[]): IdbEnumAttrDef<E, true, false>
function string(values?: readonly string[]): AnyDataAttrDef {
  return values === undefined ? officialI.string() : markEnum(officialI.string(), values)
}

/**
 * A number field. Pass a values array (`i.number([1, 2, 3])`) to declare a
 * **runtime enum** (see `string`). The type-level form narrows only and accepts
 * any number type — a literal union or a branded number (`i.number<Cents>()`).
 */
function number<Type extends number = number>(): DataAttrDef<Type, true, false>
function number<const E extends number>(values: readonly E[]): IdbEnumAttrDef<E, true, false>
function number(values?: readonly number[]): AnyDataAttrDef {
  return values === undefined ? officialI.number() : markEnum(officialI.number(), values)
}

/**
 * dux's authoring dialect: `i.namespace` and `i.room` plus the field builders.
 * There is no `i.entity` / `i.schema` / `i.graph` — one dialect, one vocabulary.
 * `string` and `number` add the runtime-enum form ([§2.6]); the rest are the
 * official implementations verbatim.
 */
export const i = {
  namespace,
  room,
  string,
  number,
  boolean: officialI.boolean,
  date: officialI.date,
  json: officialI.json,
  any: officialI.any,
}
