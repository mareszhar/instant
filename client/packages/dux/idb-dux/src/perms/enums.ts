/**
 * Runtime-enum value lookup — the bridge between a schema's declared enum values
 * ([dux-spec-root.md §2.6]) and `.conforms()` in perms. Parallel to the
 * `Validator` ([validate.ts]): one lookup bundle is built per callback scope
 * (namespace, or a link target for `el`/`elr`), and the context helpers consult
 * it to tag a field/ref accessor with the values `.conforms()` renders.
 *
 * When no schema value is passed (`definePerms()` / `definePerms<S>()`) the
 * `noEnums` bundle returns `undefined` everywhere, so `.conforms()` has nothing
 * to render — matching the spec: it needs `definePerms(schema)`.
 */
import type { IdbSchema } from '../schema/defineSchema.js'
import { refTerminal } from './validate.js'

/** A field/ref's declared runtime-enum values, or `undefined` if it has none. */
type EnumValues = readonly (string | number)[] | undefined

/** The per-callback enum-lookup hooks the context wires into its helpers. */
export interface Enums {
  field: (key: string) => EnumValues
  authField: (key: string) => EnumValues
  ref: (path: string) => EnumValues
  authRef: (path: string) => EnumValues
  linkedField: (key: string) => EnumValues
  linkedRef: (path: string) => EnumValues
}

/** The inert lookup — used in type-only mode. */
export const noEnums: Enums = {
  field: () => undefined,
  authField: () => undefined,
  ref: () => undefined,
  authRef: () => undefined,
  linkedField: () => undefined,
  linkedRef: () => undefined,
}

/** The declared values of a field, if it is a runtime enum. */
function fieldEnum(schema: IdbSchema, ns: string, key: string): EnumValues {
  const attr = schema.entities[ns]?.attrs?.[key] as
    | { duxEnumValues?: readonly (string | number)[] }
    | undefined
  return attr?.duxEnumValues
}

/** The declared values of a ref path's terminal field, if it is a runtime enum. */
function refEnum(schema: IdbSchema, ns: string, path: string): EnumValues {
  const terminal = refTerminal(schema, ns, path)
  return terminal ? fieldEnum(schema, terminal.ns, terminal.field) : undefined
}

/**
 * Build the enum lookup for a callback scope. `ns` is absent for the
 * namespace-loose `.defaults`/`.attrs` contexts (so only the `$users`-rooted
 * `auth`/`ar` lookups resolve there); `linkTarget` is set only when resolving a
 * specific link/unlink rule, so `el`/`elr` read the linked namespace.
 */
export function makeEnums(schema: IdbSchema, ns?: string, linkTarget?: string): Enums {
  return {
    field: key => (ns ? fieldEnum(schema, ns, key) : undefined),
    authField: key => fieldEnum(schema, '$users', key),
    ref: path => (ns ? refEnum(schema, ns, path) : undefined),
    authRef: path => refEnum(schema, '$users', path.replace(/^\$user\./, '')),
    linkedField: key => (linkTarget ? fieldEnum(schema, linkTarget, key) : undefined),
    linkedRef: path => (linkTarget ? refEnum(schema, linkTarget, path) : undefined),
  }
}
