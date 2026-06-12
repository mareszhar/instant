import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbValidQuery } from './validation.js'

/**
 * A schema-bound `q`: validates the query and returns it, type intact.
 * The `const` type parameter keeps `$only: true`, `$as` names, and `indexBy`
 * keys literal — the shaping mirror depends on them.
 */
export interface IdbQueryBuilder<S extends IdbSchema> {
  <const Q extends IdbValidQuery<Q, S>>(query: Q): Q
}

/**
 * The multi-schema escape hatch: a `q` bound to an explicit schema type.
 * The runtime is schema-independent — all validation is type-level.
 *
 * @example
 *   const oq = defineQuery<OtherSchema>()
 *   const query = oq({ posts: {} })
 */
export function defineQuery<S extends IdbSchema = IdbRegisteredSchema>(): IdbQueryBuilder<S> {
  return query => query
}

/**
 * Schema-aware query authoring, ready-made via registration. Wrap a query in
 * `q()` to get completions and field-localized errors anywhere — inline,
 * named and shared, or inside a factory body:
 *
 * @example
 *   const { tasks } = db.useQuery(() => {
 *     if (!userId) return null
 *     return q({ tasks: { $: { where: { isDone: false } } } })
 *   })
 */
export const q: IdbQueryBuilder<IdbRegisteredSchema> = /* @__PURE__ */ defineQuery()
