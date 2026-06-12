import type { InstantUnknownSchemaDef } from '@instantdb/core'
import type { IdbSchema, IdbSchemaDef } from './defineSchema.js'

/**
 * Tell dux your schema once — every `Idb*` type utility and the exported `q`
 * then default to it, project-wide:
 *
 * ```ts
 * // instant.schema.ts
 * export const schema = defineSchema({ ... })
 *
 * declare module '@mszr/idb-dux' {
 *   interface IdbRegister { schema: typeof schema }
 * }
 * ```
 *
 * Registration supplies types, not values — factories that need the schema
 * object (`defineDb`, `init`, `definePerms(schema)`) still receive it
 * explicitly.
 */
export interface IdbRegister {}

/** The fallback when no schema is registered: untyped namespaces, default options. */
export type IdbUnknownSchema = IdbSchemaDef<
  InstantUnknownSchemaDef['entities'],
  InstantUnknownSchemaDef['rooms'],
  {
    readonly namespaces: Record<string, { singular: undefined, ruleParams: undefined }>
    readonly linkSingulars: Record<string, Record<string, never>>
    readonly options: { readonly singularize: 'auto' }
  }
>

/** The registered schema, or `IdbUnknownSchema` when nothing is registered. */
export type IdbRegisteredSchema = IdbRegister extends { schema: infer S }
  ? S extends IdbSchema
    ? S
    : IdbUnknownSchema
  : IdbUnknownSchema
