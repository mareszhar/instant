/**
 * Runtime schema validation — the dev-time assertions `definePerms(schema)`
 * adds on top of the type layer. The types are the primary safety net
 * (principle 3); these catch the cases a dynamically-built rules object can
 * smuggle past the compiler, and turn a silent bad-CEL push into a clear throw
 * at author time.
 *
 * When no schema value is passed (`definePerms()` / `definePerms<S>()`), every
 * check is a no-op — there is nothing to validate against.
 */
import type { IdbSchema } from '../schema/defineSchema.js'

/** The per-callback validation hooks the context wires into its helpers. */
export interface Validator {
  field: (key: string) => void
  ref: (path: string) => void
  ruleParam: (key: string) => void
  authRef: (path: string) => void
  linkedField: (key: string) => void
  linkedRef: (path: string) => void
}

/** The inert validator — used in type-only mode. */
export const noValidate: Validator = {
  field: () => {},
  ref: () => {},
  ruleParam: () => {},
  authRef: () => {},
  linkedField: () => {},
  linkedRef: () => {},
}

function fail(message: string): never {
  throw new Error(`QERR_PERMS_SCHEMA: ${message}`)
}

function fieldExists(schema: IdbSchema, ns: string, key: string): boolean {
  if (key === 'id')
    return true
  return Boolean(schema.entities[ns]?.attrs?.[key])
}

function ruleParamExists(schema: IdbSchema, ns: string, key: string): boolean {
  return Boolean(schema.$dux?.namespaces?.[ns]?.ruleParams?.[key])
}

/**
 * Walk a `link(.link)*.attr` path to the namespace + field its terminal lives
 * on. Returns `undefined` if any link label along the way is unknown. Shared by
 * ref validation and ref-enum lookup ([enums.ts]) so the traversal lives once.
 */
export function refTerminal(
  schema: IdbSchema,
  ns: string,
  path: string,
): { ns: string, field: string } | undefined {
  const parts = path.split('.')
  const field = parts.pop()
  if (field === undefined)
    return undefined
  let current = ns
  for (const label of parts) {
    const target = schema.entities[current]?.links?.[label]?.entityName
    if (!target)
      return undefined
    current = target
  }
  return { ns: current, field }
}

/** Walk a `link(.link)*.attr` path; the terminal must be an attribute. */
function refValid(schema: IdbSchema, ns: string, path: string): boolean {
  const terminal = refTerminal(schema, ns, path)
  return terminal ? fieldExists(schema, terminal.ns, terminal.field) : false
}

/** Does the schema declare this namespace? */
export function namespaceExists(schema: IdbSchema, ns: string): boolean {
  return Boolean(schema.entities[ns])
}

/**
 * Build the validator for a namespace callback. `linkTarget` is set only when
 * resolving a specific link/unlink rule, so `el`/`elr` validate against the
 * linked namespace.
 */
export function makeValidator(
  schema: IdbSchema,
  ns: string,
  linkTarget?: string,
): Validator {
  return {
    field: key => fieldExists(schema, ns, key)
      || fail(`'${key}' is not a field on '${ns}'`),
    ref: path => refValid(schema, ns, path)
      || fail(`'${path}' is not a valid ref path from '${ns}'`),
    ruleParam: key => ruleParamExists(schema, ns, key)
      || fail(`'${key}' is not a declared ruleParam on '${ns}'`),
    authRef: path => refValid(schema, '$users', path.replace(/^\$user\./, ''))
      || fail(`'${path}' is not a valid auth ref path`),
    linkedField: key => (linkTarget && fieldExists(schema, linkTarget, key))
      || fail(`'${key}' is not a field on linked namespace '${linkTarget}'`),
    linkedRef: path => (linkTarget && refValid(schema, linkTarget, path))
      || fail(`'${path}' is not a valid ref path from linked namespace '${linkTarget}'`),
  }
}
