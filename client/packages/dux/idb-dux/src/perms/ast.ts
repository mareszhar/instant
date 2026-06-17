/**
 * The expression layer: immutable, phantom-typed nodes that render to CEL.
 *
 * Every authoring helper (`e.title.eq('x')`, `er(...).contains(auth.id)`,
 * `f.or(...)`) builds one of these nodes; `.compile()` walks the tree and
 * emits the plain CEL strings Instant already accepts. The phantom `T` carries
 * the value type so fluent composition type-checks at the cursor; at runtime a
 * node is just a rendered string plus a precedence, so parentheses are added
 * deterministically and only where CEL precedence requires them.
 *
 * The renderer targets the exact bindings the backend installs
 * (`server/src/instant/db/cel.clj`): `auth`, `data`, `newData`, `linkedData`,
 * `ruleParams`, `request`, `rateLimit`.
 */

// ==========
// authoring types

/** A value position accepts a raw literal or another expression of that type. */
export type ExprArg<T> = T | Expr<T>

/**
 * A scalar CEL expression. `and`/`or`/`not` return a boolean expression so
 * fluent chains read subject-first (`b.isMember.and(b.isSignedIn)`); the
 * string methods are available everywhere but only meaningful on strings.
 */
export interface Expr<T = unknown> {
  // `null` is allowed so the `x != null` / `x == null` idiom reads naturally.
  eq: (value: ExprArg<T> | null) => Expr<boolean>
  neq: (value: ExprArg<T> | null) => Expr<boolean>
  gt: (value: ExprArg<T>) => Expr<boolean>
  gte: (value: ExprArg<T>) => Expr<boolean>
  lt: (value: ExprArg<T>) => Expr<boolean>
  lte: (value: ExprArg<T>) => Expr<boolean>
  in: (list: readonly ExprArg<T>[]) => Expr<boolean>
  and: (other: ExprArg<boolean>) => Expr<boolean>
  or: (other: ExprArg<boolean>) => Expr<boolean>
  not: () => Expr<boolean>
  startsWith: (value: ExprArg<string>) => Expr<boolean>
  endsWith: (value: ExprArg<string>) => Expr<boolean>
  includes: (value: ExprArg<string>) => Expr<boolean>
  matches: (value: ExprArg<string>) => Expr<boolean>
  render: () => string
}

/** The element view of a list — a JSON-array terminal yields a nested list. */
export type ItemExpr<T> = T extends readonly (infer E)[] ? ListExpr<E> : Expr<T>

/**
 * A list-valued CEL expression — what every ref helper (`er`/`ar`/`elr`) and
 * `request.modifiedFields` return. `.some`/`.every` compile to CEL's
 * `.exists`/`.all` macros.
 */
export interface ListExpr<T = unknown> {
  contains: (value: ExprArg<T>) => Expr<boolean>
  isEmpty: () => Expr<boolean>
  isNonEmpty: () => Expr<boolean>
  size: () => Expr<number>
  at: (index: number) => ItemExpr<T>
  some: (fn: (item: ItemExpr<T>) => Expr<boolean>) => Expr<boolean>
  every: (fn: (item: ItemExpr<T>) => Expr<boolean>) => Expr<boolean>
  render: () => string
}

// ==========
// precedence

/**
 * CEL operator precedence, low to high. A child operand is parenthesized only
 * when its precedence is lower than its parent's — minimal, correct, stable.
 * `raw` sits below everything so any composition around it is always wrapped.
 */
const RAW = 0
const OR = 1
const AND = 2
const NOT = 3
const CMP = 4
const ATOM = 5

// ==========
// the node

const BRAND = Symbol('idb-perms-expr')

/**
 * What a runtime-enum field/ref accessor attaches so `.conforms()` can render:
 * the declared values, and whether the node is a list (a ref → list conformance
 * via `.all`) or a scalar (a field → `in`).
 */
export interface ConformsInfo {
  values: readonly (string | number)[]
  list: boolean
}

/** The one runtime node behind both `Expr` and `ListExpr`. */
export class ExprNode {
  readonly [BRAND] = true
  constructor(
    readonly cel: string,
    readonly prec: number,
    /** Set only on a runtime-enum field/ref accessor — powers `.conforms()`. */
    readonly conformsTo?: ConformsInfo,
  ) {}

  render(): string {
    return this.cel
  }

  /**
   * Membership against the field's schema-declared runtime-enum values — a
   * scalar field renders `<field> in [...]`, a ref (list) renders
   * `<ref>.all(item, item in [...])`. Exposed by the type layer only on
   * runtime-enum accessors; the throw is the backstop for a bypass.
   */
  conforms(): ExprNode {
    if (this.conformsTo === undefined) {
      throw new Error(
        'DUXERR_PERMS_CONFORMS: .conforms() requires a runtime-enum field and definePerms(schema)',
      )
    }
    const { values, list } = this.conformsTo
    return list ? this.every(item => item.in(values)) : this.in(values)
  }

  private op(operator: string, value: unknown, prec: number): ExprNode {
    const right = coerce(value)
    return new ExprNode(`${wrap(this, prec)} ${operator} ${wrap(right, prec)}`, prec)
  }

  eq(value: unknown) { return this.op('==', value, CMP) }
  neq(value: unknown) { return this.op('!=', value, CMP) }
  gt(value: unknown) { return this.op('>', value, CMP) }
  gte(value: unknown) { return this.op('>=', value, CMP) }
  lt(value: unknown) { return this.op('<', value, CMP) }
  lte(value: unknown) { return this.op('<=', value, CMP) }
  in(list: unknown) { return this.op('in', list, CMP) }
  and(other: unknown) { return this.op('&&', other, AND) }
  or(other: unknown) { return this.op('||', other, OR) }

  not(): ExprNode {
    return new ExprNode(`!${this.prec < ATOM ? `(${this.cel})` : this.cel}`, NOT)
  }

  private method(name: string, value: unknown): ExprNode {
    return new ExprNode(`${wrap(this, ATOM)}.${name}(${coerce(value).cel})`, ATOM)
  }

  startsWith(value: unknown) { return this.method('startsWith', value) }
  endsWith(value: unknown) { return this.method('endsWith', value) }
  // CEL spells substring containment `string.contains`.
  includes(value: unknown) { return this.method('contains', value) }
  matches(value: unknown) { return this.method('matches', value) }

  // ----- list methods

  contains(value: unknown): ExprNode {
    // `value in list` — the membership test the backend optimizes for refs.
    return new ExprNode(`${coerce(value).cel} in ${wrap(this, CMP)}`, CMP)
  }

  isEmpty() { return new ExprNode(`${wrap(this, CMP)} == []`, CMP) }
  isNonEmpty() { return new ExprNode(`${wrap(this, CMP)} != []`, CMP) }
  size() { return new ExprNode(`size(${this.cel})`, ATOM) }
  at(index: number) { return new ExprNode(`${wrap(this, ATOM)}[${index}]`, ATOM) }

  some(fn: (item: any) => Expr<boolean>) { return this.macro('exists', fn) }
  every(fn: (item: any) => Expr<boolean>) { return this.macro('all', fn) }

  private macro(name: string, fn: (item: any) => Expr<boolean>): ExprNode {
    const variable = bindVarName(fn)
    const body = fn(new ExprNode(variable, ATOM)) as unknown as ExprNode
    return new ExprNode(`${wrap(this, ATOM)}.${name}(${variable}, ${body.render()})`, ATOM)
  }
}

function wrap(node: ExprNode, parentPrec: number): string {
  return node.prec < parentPrec ? `(${node.cel})` : node.cel
}

/** Is this an expression node (vs a raw literal value)? */
export function isExprNode(value: unknown): value is ExprNode {
  return typeof value === 'object' && value !== null && BRAND in value
}

// ==========
// literals

/** Single-quote a CEL string literal, escaping the characters CEL cares about. */
function quote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
  return `'${escaped}'`
}

/** Render a JS literal as a CEL atom. */
function literal(value: unknown): string {
  if (value === null || value === undefined)
    return 'null'
  if (typeof value === 'string')
    return quote(value)
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (value instanceof Date)
    return String(value.getTime())
  if (Array.isArray(value))
    return `[${value.map(literal).join(', ')}]`
  throw new TypeError(`Cannot render ${typeof value} as a CEL literal`)
}

/** Pass an expression through; turn anything else into an atom literal node. */
export function coerce(value: unknown): ExprNode {
  return isExprNode(value) ? value : new ExprNode(literal(value), ATOM)
}

// ==========
// node factories (used by the context helpers)

/** A bare CEL atom — identifiers, property/field access, calls. */
export function atom(cel: string): ExprNode {
  return new ExprNode(cel, ATOM)
}

/** An atom for a runtime-enum field/ref — carries the values `.conforms()` reads. */
export function enumAtom(cel: string, values: readonly (string | number)[], list: boolean): ExprNode {
  return new ExprNode(cel, ATOM, { values, list })
}

/** A raw, user-authored CEL string — always wrapped when composed. */
export function raw(cel: string): ExprNode {
  return new ExprNode(cel, RAW)
}

/**
 * Recover the macro variable name from the callback's source so the emitted
 * CEL reads naturally (`.exists(types, 'admin' in types)`); falls back to
 * `item` when the source can't be parsed.
 */
function bindVarName(fn: (item: any) => unknown): string {
  const match = /^[\s(]*([A-Z_$][\w$]*)/i.exec(fn.toString())
  return match?.[1] ?? 'item'
}
