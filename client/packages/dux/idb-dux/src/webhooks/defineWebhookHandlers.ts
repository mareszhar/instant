/**
 * Authoring webhook handlers as plain object literals with full per-change
 * narrowing — no helper functions, no schema generics at the call site
 * (dux-spec-webhooks.md §4).
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { IdbWebhookHandlers } from './types.js'

/**
 * Define webhook handlers as a plain object literal. Contextual typing narrows
 * each handler's `change` per namespace and action ({ after } is
 * `IdbEntity<'ns'>`); pass several maps to merge them.
 *
 * Resolution per change matches the official dispatcher: `namespace.action` →
 * `namespace.$default` → top-level `$default`.
 *
 * @example
 *   export const handlers = defineWebhookHandlers({
 *     tasks: {
 *       create: ({ after }) => notifyAssignee(after),
 *       delete: ({ before }) => audit('task removed', before),
 *     },
 *     $default: change => log(change),
 *   })
 */
export function defineWebhookHandlers<S extends IdbSchema = IdbRegisteredSchema>(
  ...maps: IdbWebhookHandlers<S>[]
): IdbWebhookHandlers<S> {
  const result: Record<string, any> = {}
  for (const map of maps) {
    for (const key of Object.keys(map)) {
      if (key === '$default')
        result.$default = (map as Record<string, any>).$default
      else
        result[key] = { ...result[key], ...(map as Record<string, any>)[key] }
    }
  }
  return result as IdbWebhookHandlers<S>
}
