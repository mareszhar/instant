import type { AttrsDefs, DataAttrDef, EntityDef as EntityDefType } from '@instantdb/core'
import { i as officialI } from '@instantdb/core'

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
 * The validation arm for `fields`/`ruleParams`: non-builder members carry
 * the diagnostic on the offending key; valid members contribute nothing.
 */
type ValidFieldBuilders<F> = {
  [K in keyof F]: F[K] extends DataAttrDef<any, any, any, any>
    ? unknown
    : `QERR_SCHEMA_FIELD_INVALID: ${K & string} must be a field builder (i.string(), i.number(), …)`
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
 * dux's authoring dialect: `i.namespace` plus the official field builders.
 * There is no `i.entity` / `i.schema` / `i.graph` — one dialect, one
 * vocabulary; the builders themselves are the official implementations.
 */
export const i = {
  namespace,
  string: officialI.string,
  number: officialI.number,
  boolean: officialI.boolean,
  date: officialI.date,
  json: officialI.json,
  any: officialI.any,
}
