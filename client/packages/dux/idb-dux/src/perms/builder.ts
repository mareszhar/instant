/**
 * The builder runtime and the `.compile()` pipeline.
 *
 * The chainable builders accumulate authoring state (staged expressions, bind
 * aliases, allow/fields rules) and `.compile()` walks them into the plain
 * `IdbPerms` object — CEL strings under ordinary Instant keys. Creativity is in
 * the authoring surface; the output is exactly what Instant already accepts.
 *
 * Inheritance follows the backend (`server/.../rule.clj` `with-binds`):
 * `$default.bind` is concatenated into every namespace there, so dux emits an
 * inherited bind once under `$default.bind` and references it by bare alias —
 * never re-emitting it per namespace. Staged values are authoring-only and are
 * copied into each namespace's scope so `s.*` resolves.
 */
import type { InstantRules } from '@instantdb/core'
import type { IdbSchema } from '../schema/defineSchema.js'
import type { IdbRegisteredSchema } from '../schema/register.js'
import type { ExprNode } from './ast.js'
import type { IdbPermsRateLimits, PermsBuilder } from './types.js'
import { makeContext } from './context.js'
import { makeEnums, noEnums } from './enums.js'
import { makeValidator, namespaceExists, noValidate } from './validate.js'

type RuleValue = boolean | ExprNode | ((ctx: any) => boolean | ExprNode)
type Ctx = any

// ==========
// resolution

function asCel(value: boolean | ExprNode): string {
  return typeof value === 'boolean' ? String(value) : value.render()
}

function resolveRule(rule: RuleValue, ctx: Ctx): string {
  return asCel(typeof rule === 'function' ? rule(ctx) : rule)
}

function renderBinds(binds: Record<string, ExprNode>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(binds).map(([name, node]) => [name, node.render()]),
  )
}

const ACTIONS = ['view', 'create', 'update', 'delete'] as const

// ==========
// namespace builder

class NamespaceRuntime {
  /** Common staged values — inlined, inherited from defaults, merged into every action. */
  private readonly commonStaged: Record<string, ExprNode>
  /** All emitted bind aliases — common and action-specific share one block. */
  private readonly binds: Record<string, ExprNode> = {}
  /** Per-whole-entity-action staged values, visible only in that action. */
  private readonly actionStaged: Record<string, Record<string, ExprNode>> = {}
  /** Per-(dir, label) staged values, visible only in that link/unlink rule. */
  private readonly linkStaged: Record<string, Record<string, Record<string, ExprNode>>> = {}
  private readonly inheritedBindNames: Set<string>
  private allowOut: Record<string, any> = {}
  private fieldsOut: Record<string, string> = {}

  constructor(
    private readonly schema: IdbSchema | undefined,
    private readonly ns: string,
    defaultStaged: Record<string, ExprNode>,
    defaultBindNames: string[],
  ) {
    this.commonStaged = { ...defaultStaged }
    this.inheritedBindNames = new Set(defaultBindNames)
  }

  /** Is this name already a common staged value, an emitted bind, or inherited? */
  private known(name: string): boolean {
    return name in this.commonStaged || name in this.binds || this.inheritedBindNames.has(name)
  }

  private linkTargetOf(label: string): string | undefined {
    return this.schema?.entities[this.ns]?.links?.[label]?.entityName
  }

  /** Build a context over a staged snapshot, validating against ns (or a link target). */
  private ctxFor(staged: Record<string, ExprNode>, linkTarget?: string): Ctx {
    const validator = this.schema
      ? makeValidator(this.schema, this.ns, linkTarget)
      : noValidate
    const enums = this.schema
      ? makeEnums(this.schema, this.ns, linkTarget)
      : noEnums
    return makeContext({ staged, binds: this.binds }, validator, enums)
  }

  private mergedStaged(action: string): Record<string, ExprNode> {
    return { ...this.commonStaged, ...this.actionStaged[action] }
  }

  private mergedLinkStaged(dir: string, label: string): Record<string, ExprNode> {
    return { ...this.commonStaged, ...this.linkStaged[dir]?.[label] }
  }

  private add(
    produced: Record<string, ExprNode>,
    into: Record<string, ExprNode>,
    guard: boolean,
    seen: (name: string) => boolean,
  ): this {
    for (const [name, node] of Object.entries(produced)) {
      if (guard && seen(name))
        throw new Error(`IDBDUXERR_PERMS_DUPLICATE_NAME: '${name}' is already defined on '${this.ns}' — use .overrideStage/.overrideBind`)
      into[name] = node
    }
    return this
  }

  stage(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.add(fn(this.ctxFor(this.commonStaged)), this.commonStaged, true, n => this.known(n))
  }

  overrideStage(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.add(fn(this.ctxFor(this.commonStaged)), this.commonStaged, false, () => false)
  }

  bind(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.add(fn(this.ctxFor(this.commonStaged)), this.binds, true, n => this.known(n))
  }

  overrideBind(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.add(fn(this.ctxFor(this.commonStaged)), this.binds, false, () => false)
  }

  stageFor(actionOrDir: string, labelOrFn: any, maybeFn?: any) {
    if (maybeFn === undefined) {
      const action = actionOrDir
      const into = (this.actionStaged[action] ??= {})
      return this.add(
        labelOrFn(this.ctxFor(this.mergedStaged(action))),
        into,
        true,
        n => this.known(n) || n in into,
      )
    }
    const [dir, label] = [actionOrDir, labelOrFn]
    const into = ((this.linkStaged[dir] ??= {})[label] ??= {})
    return this.add(
      maybeFn(this.ctxFor(this.mergedLinkStaged(dir, label), this.linkTargetOf(label))),
      into,
      true,
      n => this.known(n) || n in into,
    )
  }

  bindFor(actionOrDir: string, labelOrFn: any, maybeFn?: any) {
    if (maybeFn === undefined) {
      const action = actionOrDir
      return this.add(labelOrFn(this.ctxFor(this.mergedStaged(action))), this.binds, true, n => this.known(n))
    }
    const [dir, label] = [actionOrDir, labelOrFn]
    return this.add(
      maybeFn(this.ctxFor(this.mergedLinkStaged(dir, label), this.linkTargetOf(label))),
      this.binds,
      true,
      n => this.known(n),
    )
  }

  allow(input: any) {
    const block = typeof input === 'function' ? input(this.ctxFor(this.commonStaged)) : input
    for (const action of ACTIONS) {
      if (block[action] !== undefined)
        this.allowOut[action] = resolveRule(block[action], this.ctxFor(this.mergedStaged(action)))
    }
    for (const dir of ['link', 'unlink'] as const) {
      const labels = block[dir]
      if (!labels)
        continue
      const map: Record<string, string> = this.allowOut[dir] ?? {}
      for (const [label, rule] of Object.entries(labels)) {
        if (rule !== undefined) {
          const ctx = this.ctxFor(this.mergedLinkStaged(dir, label), this.linkTargetOf(label))
          map[label] = resolveRule(rule as RuleValue, ctx)
        }
      }
      this.allowOut[dir] = map
    }
    return this
  }

  fields(input: any) {
    const ctx = this.ctxFor(this.commonStaged)
    const block = typeof input === 'function' ? input(ctx) : input
    for (const [field, rule] of Object.entries(block)) {
      if (rule !== undefined)
        this.fieldsOut[field] = resolveRule(rule as RuleValue, ctx)
    }
    return this
  }

  /** The compiled namespace block. */
  block(): any {
    const out: any = { allow: this.allowOut }
    const bind = renderBinds(this.binds)
    if (Object.keys(bind).length)
      out.bind = bind
    if (Object.keys(this.fieldsOut).length)
      out.fields = this.fieldsOut
    return out
  }
}

// ==========
// defaults builder

class DefaultsRuntime {
  readonly staged: Record<string, ExprNode> = {}
  readonly binds: Record<string, ExprNode> = {}
  allowOut: Record<string, any> = {}

  constructor(private readonly schema: IdbSchema | undefined) {}

  private ctx(): Ctx {
    // The default context is namespace-loose; the type layer narrows it. Enums
    // are `$users`-rooted only (no namespace), so `auth`/`ar` `.conforms()`
    // resolves while field/ref reads stay loose.
    const enums = this.schema ? makeEnums(this.schema) : noEnums
    return makeContext({ staged: this.staged, binds: this.binds }, noValidate, enums)
  }

  private known(name: string): boolean {
    return name in this.staged || name in this.binds
  }

  private collect(fn: (ctx: Ctx) => Record<string, ExprNode>, into: Record<string, ExprNode>) {
    for (const [name, node] of Object.entries(fn(this.ctx()))) {
      if (this.known(name))
        throw new Error(`IDBDUXERR_PERMS_DUPLICATE_NAME: '${name}' is already defined in defaults — use .overrideStage/.overrideBind`)
      into[name] = node
    }
    return this
  }

  stage(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.collect(fn, this.staged)
  }

  bind(fn: (ctx: Ctx) => Record<string, ExprNode>) {
    return this.collect(fn, this.binds)
  }

  allow(input: any) {
    const ctx = this.ctx()
    const block = typeof input === 'function' ? input(ctx) : input
    for (const key of ['$default', ...ACTIONS]) {
      if (block[key] !== undefined)
        this.allowOut[key] = resolveRule(block[key], ctx)
    }
    return this
  }
}

// ==========
// attrs builder

class AttrsRuntime {
  out: { create?: string } = {}

  constructor(private readonly schema: IdbSchema | undefined) {}

  allow(input: any) {
    const enums = this.schema ? makeEnums(this.schema) : noEnums
    const ctx = makeContext({ staged: {}, binds: {} }, noValidate, enums)
    const block = typeof input === 'function' ? input(ctx) : input
    if (block.create !== undefined)
      this.out.create = resolveRule(block.create, ctx)
    return this
  }
}

// ==========
// the top-level builder

class PermsRuntime {
  private defaultStaged: Record<string, ExprNode> = {}
  private defaultBinds: Record<string, ExprNode> = {}
  private defaultAllow: Record<string, any> | undefined
  private hasDefaults = false
  private attrsOut: { create?: string } | undefined
  private rateLimitsConfig: IdbPermsRateLimits | undefined
  private nsBuilders: Record<string, NamespaceRuntime> = {}

  constructor(private readonly schema?: IdbSchema) {}

  attrs(fn: (a: AttrsRuntime) => AttrsRuntime) {
    const a = new AttrsRuntime(this.schema)
    fn(a)
    this.attrsOut = a.out
    return this
  }

  defaults(fn: (d: DefaultsRuntime) => DefaultsRuntime) {
    const d = new DefaultsRuntime(this.schema)
    fn(d)
    this.hasDefaults = true
    this.defaultStaged = d.staged
    this.defaultBinds = d.binds
    this.defaultAllow = d.allowOut
    return this
  }

  rateLimits(config: IdbPermsRateLimits) {
    this.rateLimitsConfig = config
    return this
  }

  namespaces(map: Record<string, (ns: NamespaceRuntime) => NamespaceRuntime>) {
    const defaultBindNames = Object.keys(this.defaultBinds)
    for (const [ns, build] of Object.entries(map)) {
      if (this.schema && !namespaceExists(this.schema, ns))
        throw new Error(`IDBDUXERR_PERMS_SCHEMA: '${ns}' is not a namespace in the schema`)
      const nsb = new NamespaceRuntime(this.schema, ns, this.defaultStaged, defaultBindNames)
      build(nsb)
      this.nsBuilders[ns] = nsb
    }
    return this
  }

  compile(): InstantRules<any> {
    const out: Record<string, any> = {}

    if (this.attrsOut) {
      out.attrs = {
        allow: this.attrsOut.create !== undefined ? { create: this.attrsOut.create } : {},
      }
    }

    if (this.hasDefaults) {
      const block: any = { allow: this.defaultAllow ?? {} }
      const bind = renderBinds(this.defaultBinds)
      if (Object.keys(bind).length)
        block.bind = bind
      out.$default = block
    }

    if (this.rateLimitsConfig)
      out.$rateLimits = this.rateLimitsConfig

    for (const [ns, nsb] of Object.entries(this.nsBuilders))
      out[ns] = nsb.block()

    return out as InstantRules<any>
  }
}

// ==========
// definePerms

/**
 * The typed permissions authoring entry. With the schema registered, no
 * argument is needed; pass the schema value to add runtime validation; pass an
 * explicit type param for a different schema (spec §2).
 *
 * @example
 *   export default definePerms(schema)
 *     .namespaces({
 *       tasks: ns => ns.allow({ view: true }),
 *     })
 *     .compile()
 */
export function definePerms<S extends IdbSchema>(schema: S): PermsBuilder<S>
export function definePerms<S extends IdbSchema = IdbRegisteredSchema>(): PermsBuilder<S>
export function definePerms(schema?: IdbSchema): PermsBuilder<any> {
  return new PermsRuntime(schema) as unknown as PermsBuilder<any>
}
