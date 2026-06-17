/**
 * The runtime context — the object every authoring callback receives.
 *
 * One full context is built and handed to every callback; the *types* (in
 * `types.ts`) decide which helpers are visible where, so an action-only helper
 * (`eu`, `el`) simply isn't in scope outside its action. At runtime each helper
 * is a thin factory over the CEL globals the backend installs: `auth`, `data`,
 * `newData`, `linkedData`, `ruleParams`, `request`, `rateLimit`.
 *
 * `s` (staged) inlines the stored expression; `b` (bindings) renders the bare
 * alias the backend resolves from the emitted `bind` block.
 */
import type { ExprNode } from './ast.js'
import type { Enums } from './enums.js'
import type { Validator } from './validate.js'
import { atom, coerce, enumAtom, raw as rawNode } from './ast.js'
import { noEnums } from './enums.js'
import { noValidate } from './validate.js'

type EnumOf = (key: string) => readonly (string | number)[] | undefined

/** The mutable state a namespace/defaults builder threads into its callbacks. */
export interface ContextState {
  /** Staged name → its inlined expression. */
  staged: Record<string, ExprNode>
  /** Bound name → its emitted expression (the alias renders bare). */
  binds: Record<string, ExprNode>
}

/** A field atom — `enumAtom` when the field is a runtime enum, so `.conforms()` resolves. */
function fieldAtom(root: string, key: string, enumOf?: EnumOf): ExprNode {
  const cel = `${root}.${key}`
  const values = enumOf?.(key)
  return values ? enumAtom(cel, values, false) : atom(cel)
}

/** Property access over a CEL root: `entityProxy('data').title` → `data.title`. */
function entityProxy(root: string, check?: (key: string) => void, enumOf?: EnumOf): any {
  return new Proxy({}, {
    get: (_t, key: string) => {
      check?.(key)
      return fieldAtom(root, key, enumOf)
    },
  })
}

/** `data.ref(...)` / `auth.ref(...)` / `linkedData.ref(...)` — always a list. */
function refFn(root: string, check?: (path: string) => void, enumOf?: EnumOf) {
  return (path: string) => {
    check?.(path)
    const cel = `${root}.ref('${path}')`
    const values = enumOf?.(path)
    return values ? enumAtom(cel, values, true) : atom(cel)
  }
}

/** Functional composition helpers (`f` / `ops`). */
function makeFns() {
  const fold = (op: 'and' | 'or', empty: string) => (...exprs: unknown[]): ExprNode => {
    if (exprs.length === 0)
      return atom(empty)
    return exprs.map(coerce).reduce((acc, next) => acc[op](next))
  }
  return {
    and: fold('and', 'true'),
    or: fold('or', 'false'),
    not: (expr: unknown) => coerce(expr).not(),
    eq: (a: unknown, b: unknown) => coerce(a).eq(b),
    neq: (a: unknown, b: unknown) => coerce(a).neq(b),
    gt: (a: unknown, b: unknown) => coerce(a).gt(b),
    gte: (a: unknown, b: unknown) => coerce(a).gte(b),
    lt: (a: unknown, b: unknown) => coerce(a).lt(b),
    lte: (a: unknown, b: unknown) => coerce(a).lte(b),
    in: (item: unknown, list: unknown) => coerce(item).in(list as any),
    contains: (list: unknown, item: unknown) => coerce(list).contains(item),
    size: (value: unknown) => coerce(value).size(),
    list: (...values: unknown[]) => atom(`[${values.map(v => coerce(v).cel).join(', ')}]`),
    str: (value: unknown) => coerce(value),
    num: (value: unknown) => coerce(value),
    bool: (value: unknown) => coerce(value),
    null: () => atom('null'),
  }
}

/** Buckets resolve lazily: `rl.createTask.limit(auth.id)` → `rateLimit.createTask.limit(...)`. */
function rateLimitProxy(): any {
  return new Proxy({}, {
    get: (_t, bucket: string) => ({
      limit: (key: unknown) => atom(`rateLimit.${bucket}.limit(${coerce(key).cel})`),
    }),
  })
}

/**
 * Build the full context. The same object serves common, write, update,
 * link/unlink, default, and attrs callbacks — types gate visibility.
 */
export function makeContext(state: ContextState, v: Validator = noValidate, enums: Enums = noEnums): any {
  const fns = makeFns()
  return {
    auth: entityProxy('auth', undefined, enums.authField),
    ar: refFn('auth', v.authRef, enums.authRef),
    e: entityProxy('data', v.field, enums.field),
    ef: (key: string) => {
      v.field(key)
      return fieldAtom('data', key, enums.field)
    },
    er: refFn('data', v.ref, enums.ref),
    rp: (key: string) => {
      v.ruleParam(key)
      return atom(`ruleParams.${key}`)
    },
    req: entityProxy('request'),
    eu: entityProxy('newData', v.field, enums.field),
    euf: (key: string) => {
      v.field(key)
      return fieldAtom('newData', key, enums.field)
    },
    el: entityProxy('linkedData', v.linkedField, enums.linkedField),
    elf: (key: string) => {
      v.linkedField(key)
      return fieldAtom('linkedData', key, enums.linkedField)
    },
    elr: refFn('linkedData', v.linkedRef, enums.linkedRef),
    f: fns,
    ops: fns,
    raw: (cel: string) => rawNode(cel),
    rl: rateLimitProxy(),
    s: state.staged,
    b: new Proxy({}, { get: (_t, name: string) => atom(name) }),
  }
}
