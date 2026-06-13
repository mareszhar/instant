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
import type { Validator } from './validate.js'
import { atom, coerce, raw as rawNode } from './ast.js'
import { noValidate } from './validate.js'

/** The mutable state a namespace/defaults builder threads into its callbacks. */
export interface ContextState {
  /** Staged name → its inlined expression. */
  staged: Record<string, ExprNode>
  /** Bound name → its emitted expression (the alias renders bare). */
  binds: Record<string, ExprNode>
}

/** Property access over a CEL root: `entityProxy('data').title` → `data.title`. */
function entityProxy(root: string, check?: (key: string) => void): any {
  return new Proxy({}, {
    get: (_t, key: string) => {
      check?.(key)
      return atom(`${root}.${key}`)
    },
  })
}

/** `data.ref(...)` / `auth.ref(...)` / `linkedData.ref(...)` — always a list. */
function refFn(root: string, check?: (path: string) => void) {
  return (path: string) => {
    check?.(path)
    return atom(`${root}.ref('${path}')`)
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
export function makeContext(state: ContextState, v: Validator = noValidate): any {
  const fns = makeFns()
  return {
    auth: entityProxy('auth'),
    ar: refFn('auth', v.authRef),
    e: entityProxy('data', v.field),
    ef: (key: string) => {
      v.field(key)
      return atom(`data.${key}`)
    },
    er: refFn('data', v.ref),
    rp: (key: string) => {
      v.ruleParam(key)
      return atom(`ruleParams.${key}`)
    },
    req: entityProxy('request'),
    eu: entityProxy('newData', v.field),
    euf: (key: string) => {
      v.field(key)
      return atom(`newData.${key}`)
    },
    el: entityProxy('linkedData', v.linkedField),
    elf: (key: string) => {
      v.linkedField(key)
      return atom(`linkedData.${key}`)
    },
    elr: refFn('linkedData', v.linkedRef),
    f: fns,
    ops: fns,
    raw: (cel: string) => rawNode(cel),
    rl: rateLimitProxy(),
    s: state.staged,
    b: new Proxy({}, { get: (_t, name: string) => atom(name) }),
  }
}
