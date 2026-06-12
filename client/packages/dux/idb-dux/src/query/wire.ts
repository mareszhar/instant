/**
 * The wire boundary: everything dux-only is stripped here, so what leaves the
 * process is always a query instaql already accepts. Consumed by `/vue` and
 * `/admin` right before the query reaches core — authoring keeps the dux keys
 * (shaping needs them).
 *
 * Strips, without mutating the input:
 * - the dux-only `$` keys (`$only`, `$at`, `$as`)
 * - `$m` projection blocks
 * - `where` clauses whose value is `undefined` (`$skip`)
 */

const DUX_DOLLAR_KEYS = ['$only', '$at', '$as'] as const

export function toWireQuery<Q extends Record<string, any>>(query: Q): Q {
  // `$`-prefixed namespaces ($users, …) are scopes like any other; only the
  // internal ruleParams envelope passes through untouched.
  return mapValues(query, (node, key) =>
    key === '$$ruleParams' ? node : wireNode(node)) as Q
}

function wireNode(node: unknown): unknown {
  if (node === null || typeof node !== 'object')
    return node
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$m')
      continue
    if (key === '$') {
      const dollar = wireDollar(value)
      if (dollar !== undefined)
        out[key] = dollar
      continue
    }
    out[key] = wireNode(value)
  }
  return out
}

function wireDollar(dollar: unknown): unknown {
  if (dollar === null || typeof dollar !== 'object')
    return dollar
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(dollar)) {
    if ((DUX_DOLLAR_KEYS as readonly string[]).includes(key))
      continue
    if (key === 'where') {
      const where = wireWhere(value)
      if (where !== undefined)
        out[key] = where
      continue
    }
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function wireWhere(where: unknown): unknown {
  if (where === null || typeof where !== 'object')
    return where
  const out: Record<string, any> = {}
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) // $skip — drop the clause
      continue
    if (key === 'and' || key === 'or') {
      if (Array.isArray(value)) {
        const kept = value.map(wireWhere).filter(clause => clause !== undefined)
        if (kept.length > 0)
          out[key] = kept
        continue
      }
    }
    out[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function mapValues(
  obj: Record<string, any>,
  fn: (value: any, key: string) => any,
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fn(value, key)]),
  )
}
