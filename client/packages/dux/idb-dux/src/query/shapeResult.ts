/**
 * The one place result-shaping logic exists. `/vue` wraps it reactively,
 * `/admin` applies it post-`await` — both deliver identical shapes for the
 * same query by construction. The type-level mirror is `IdbQueryData`
 * (`types.ts`); the two derive from the same schema source so the runtime key
 * and the TypeScript key always match.
 *
 * Shaping per scope:
 * - top-level namespaces normalize to `Entity[]` — never `undefined`
 * - `$only` picks element 0, `$at: n` picks position n (negative from the
 *   end); both rename the scope key to its singular form per the schema
 * - `$as` renames explicitly and always wins
 * - `$m` adds labeled sibling keys (`indexBy` / `groupBy` / `at`) computed in
 *   a single pass over the scope's data, leaving the original key untouched
 * - nested link scopes shape recursively inside each entity; untouched
 *   subtrees are returned by reference, never copied
 */

import type { IdbSchema } from '../schema/defineSchema.js'
import { singularize } from '../schema/singularize.js'

type AnyRecord = Record<string, any>

interface MTransform {
  indexBy?: string
  groupBy?: string
  at?: number
}

/**
 * The top-level keys a shaped result will carry for a query — the resolved
 * scope keys plus every `$m` sibling label — derived from the query structure
 * alone, no data needed. The client overlay uses this to expose one reactive
 * ref per scope for destructuring.
 */
export function resultKeys(query: AnyRecord, schema: IdbSchema): string[] {
  const keys: string[] = []
  for (const [key, node] of Object.entries(query)) {
    if (key === '$$ruleParams')
      continue
    const dollar: AnyRecord = (node as AnyRecord)?.$ ?? {}
    const pick = dollar.$only === true || typeof dollar.$at === 'number'
    keys.push(
      typeof dollar.$as === 'string'
        ? dollar.$as
        : pick
          ? resolveSingularKey(key, null, schema)
          : key,
    )
    const m = (node as AnyRecord)?.$m
    if (m)
      keys.push(...Object.keys(m))
  }
  return keys
}

/**
 * A schema with a usable `$dux` projection for runtime shaping — the real
 * schema when one is registered, a permissive stub otherwise (singularize
 * 'auto', no declared singulars, no link metadata). Both clients reach for it
 * so a query with no schema still shapes consistently.
 */
export function shapingSchema(schema: IdbSchema | undefined): IdbSchema {
  if (schema)
    return schema
  return {
    entities: {},
    links: {},
    rooms: {},
    $dux: { namespaces: {}, linkSingulars: {}, options: { singularize: 'auto' } },
  } as unknown as IdbSchema
}

export function shapeResult(
  rawData: AnyRecord | undefined,
  query: AnyRecord,
  schema: IdbSchema,
): AnyRecord {
  const out: AnyRecord = {}
  for (const [key, node] of Object.entries(query)) {
    // `$`-prefixed namespaces ($users, …) are data; only the internal
    // ruleParams envelope is not a scope.
    if (key === '$$ruleParams')
      continue
    shapeScopeInto(out, rawData?.[key] ?? [], key, node ?? {}, null, key, schema)
  }
  return out
}

/**
 * Shapes one scope into `out`: the resolved scope key, plus any `$m` sibling
 * keys. `parentNs` is the namespace the scope key sits on (`null` for
 * top-level scopes); `ns` is the namespace the scope's entities belong to.
 */
function shapeScopeInto(
  out: AnyRecord,
  raw: unknown,
  key: string,
  node: AnyRecord,
  parentNs: string | null,
  ns: string,
  schema: IdbSchema,
): void {
  const dollar: AnyRecord = node.$ ?? {}
  const value = shapeChildren(raw, node, ns, schema)

  if (node.$m && Array.isArray(value))
    applyMSiblings(out, value, node.$m as Record<string, MTransform>)

  const pick = dollar.$only === true ? 0 : typeof dollar.$at === 'number' ? dollar.$at : null
  const picked = pick !== null && Array.isArray(value) ? value.at(pick) : value
  const outputKey = typeof dollar.$as === 'string'
    ? dollar.$as
    : pick !== null
      ? resolveSingularKey(key, parentNs, schema)
      : key
  out[outputKey] = picked
}

/**
 * Recursively shapes the nested link scopes inside each entity of a scope
 * whose entities belong to `ns`. Entities are copied only along paths that
 * actually change.
 */
function shapeChildren(
  raw: unknown,
  node: AnyRecord,
  ns: string,
  schema: IdbSchema,
): unknown {
  const childKeys = Object.keys(node).filter(k => k !== '$' && k !== '$m')
  if (childKeys.length === 0 || !childKeys.some(k => subtreeReshapes(node[k])))
    return raw

  const shapeEntity = (entity: unknown): unknown => {
    if (entity === null || typeof entity !== 'object')
      return entity
    const copy: AnyRecord = { ...entity }
    for (const childKey of childKeys) {
      const childRaw = copy[childKey]
      delete copy[childKey]
      const childNs = linkTarget(schema, ns, childKey)
      shapeScopeInto(copy, childRaw, childKey, node[childKey] ?? {}, ns, childNs, schema)
    }
    return copy
  }

  return Array.isArray(raw) ? raw.map(shapeEntity) : shapeEntity(raw)
}

/** The namespace a link label on `ns` points to, via the enriched entity defs. */
function linkTarget(schema: IdbSchema, ns: string, label: string): string {
  return schema.entities[ns]?.links?.[label]?.entityName ?? label
}

/** Whether a subtree contains any directive that changes the data shape. */
function subtreeReshapes(node: unknown): boolean {
  if (node === null || typeof node !== 'object')
    return false
  const record = node as AnyRecord
  if (record.$m !== undefined)
    return true
  const dollar = record.$
  if (dollar && (dollar.$only !== undefined || dollar.$at !== undefined || dollar.$as !== undefined))
    return true
  return Object.keys(record).some(k => k !== '$' && k !== '$m' && subtreeReshapes(record[k]))
}

/** All `$m` projections for one scope, computed in a single pass. */
function applyMSiblings(
  out: AnyRecord,
  entities: AnyRecord[],
  transforms: Record<string, MTransform>,
): void {
  const labels = Object.entries(transforms)
  for (const [label, transform] of labels) {
    out[label] = typeof transform.at === 'number'
      ? entities.at(transform.at)
      : {}
  }
  for (const entity of entities) {
    for (const [label, transform] of labels) {
      if (transform.indexBy !== undefined) {
        const indexValue = entity[transform.indexBy]
        if (indexValue !== null && indexValue !== undefined)
          out[label][String(indexValue)] = entity
      }
      else if (transform.groupBy !== undefined) {
        const groupValue = entity[transform.groupBy]
        if (groupValue !== null && groupValue !== undefined)
          (out[label][String(groupValue)] ??= []).push(entity)
      }
    }
  }
}

/**
 * The singular form of a scope key — declared `singular` first (namespace
 * `singular` for top-level keys, link label `singular` for nested keys), the
 * shared algorithm as the `'auto'` fallback, honoring `options.singularize`.
 */
function resolveSingularKey(
  key: string,
  parentNs: string | null,
  schema: IdbSchema,
): string {
  const meta = schema.$dux
  const mode = meta.options.singularize
  if (mode === 'off')
    return key
  const declared = parentNs === null
    ? meta.namespaces[key]?.singular
    : meta.linkSingulars[parentNs]?.[key]
  if (declared !== undefined)
    return declared
  return mode === 'auto' ? singularize(key) : key
}
